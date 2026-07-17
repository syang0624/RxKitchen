// Generate photorealistic dish images for every meal the UI can display,
// using OpenAI's gpt-image-1. Reads OPENAI_APIKEY from .env, writes
// public/meals/<meal_id>.webp plus a manifest at src/lib/meal-images.json
// so components know which meals have art. Idempotent: existing files are
// skipped (pass --force to regenerate).
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "meals");
const MANIFEST = path.join(ROOT, "src", "lib", "meal-images.json");
const FORCE = process.argv.includes("--force");
const CONCURRENCY = 4;

async function loadJson(rel) {
  return JSON.parse(await readFile(path.join(ROOT, rel), "utf8"));
}

// .env is not auto-loaded for plain node scripts; parse the one key we need.
async function apiKey() {
  if (process.env.OPENAI_APIKEY) return process.env.OPENAI_APIKEY;
  const env = await readFile(path.join(ROOT, ".env"), "utf8");
  const m = env.match(/^OPENAI_APIKEY=(.+)$/m);
  if (!m) throw new Error("OPENAI_APIKEY not found in .env");
  return m[1].trim();
}

// Every meal id the UI can render: weekly allocations, kitchen batches,
// and the meals surfaced by the pre-generated stockout re-plan stream.
async function neededMealIds() {
  const ids = new Set();
  for (const a of await loadJson("data/allocations.json")) {
    for (const it of a.items) ids.add(it.meal_id);
  }
  for (const b of (await loadJson("data/production_plan.json")).batches) {
    ids.add(b.meal_id);
  }
  const stockout = await loadJson("data/agent_runs/client-1042-stockout.json");
  for (const e of stockout.events ?? []) {
    if (e.data?.meal_id) ids.add(e.data.meal_id);
  }
  return ids;
}

function prompt(meal) {
  return (
    `Appetizing overhead food photograph of a single serving of ` +
    `${meal.name}, a ${meal.cuisine} dish made with ` +
    `${meal.key_ingredients.join(", ")}. Plated in a simple round white ` +
    `bowl on a light warm-gray surface, soft natural daylight, shallow ` +
    `depth of field, realistic home-kitchen style, healthy portion. ` +
    `No text, no hands, no cutlery brands.`
  );
}

async function generate(meal, key) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt: prompt(meal),
      size: "1024x1024",
      quality: "medium",
      output_format: "webp",
      output_compression: 80,
    }),
  });
  if (!res.ok) {
    throw new Error(`${meal.id}: HTTP ${res.status} — ${await res.text()}`);
  }
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error(`${meal.id}: no image data in response`);
  await writeFile(path.join(OUT_DIR, `${meal.id}.webp`), Buffer.from(b64, "base64"));
}

const key = await apiKey();
const meals = await loadJson("data/meals.json");
const wanted = await neededMealIds();
const targets = meals.filter((m) => wanted.has(m.id));
await mkdir(OUT_DIR, { recursive: true });

const queue = targets.filter(
  (m) => FORCE || !existsSync(path.join(OUT_DIR, `${m.id}.webp`)),
);
console.log(
  `${targets.length} meals shown in the UI; generating ${queue.length}` +
    (queue.length < targets.length ? " (rest already on disk)" : ""),
);

const failures = [];
let done = 0;
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    let meal;
    while ((meal = queue.shift())) {
      try {
        await generate(meal, key);
        console.log(`  ✓ ${meal.id} ${meal.name} (${++done}/${done + queue.length})`);
      } catch (err) {
        failures.push(meal.id);
        console.error(`  ✗ ${err.message}`);
      }
    }
  }),
);

// Manifest = what actually exists on disk, so the UI never 404s.
const have = targets
  .map((m) => m.id)
  .filter((id) => existsSync(path.join(OUT_DIR, `${id}.webp`)))
  .sort();
await writeFile(MANIFEST, JSON.stringify(have, null, 2) + "\n");
console.log(`manifest: ${have.length} images listed in src/lib/meal-images.json`);
if (failures.length) {
  console.error(`FAILED: ${failures.join(", ")} — re-run to retry`);
  process.exit(1);
}
