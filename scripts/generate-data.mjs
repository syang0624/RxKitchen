#!/usr/bin/env node
/**
 * RxKitchen synthetic dataset generator (PRD §6, §7).
 * Deterministic: seeded PRNG, fixed dates — same output on every run.
 * Never hand-edit the generated JSON; change this script and regenerate (PRD §11).
 *
 * Usage: node scripts/generate-data.mjs
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { hardCheck, softScore, triageDonation } from "./lib/clinical.mjs";

const OUT = join(process.cwd(), "data");
const SEED = 42;
const WEEK = "2026-07-20"; // demo week (Monday)
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ---------- deterministic PRNG ----------
function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(SEED);
const ri = (min, max) => min + Math.floor(rand() * (max - min + 1));
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const weighted = (pairs) => {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rand() * total;
  for (const [v, w] of pairs) { r -= w; if (r <= 0) return v; }
  return pairs[pairs.length - 1][0];
};
const sampleN = (arr, n) => {
  const copy = [...arr], out = [];
  while (out.length < n && copy.length) out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]);
  return out;
};

// ---------- meal catalog (80 meals, 8 cuisines × 10) ----------
const MEAT = ["chicken", "beef", "pork", "turkey", "fish", "shrimp", "milkfish", "cod", "salmon"];
// [name, ingredients, sodium_mg, carbs_g, allergens, reheat]
const MEAL_TEMPLATES = {
  Filipino: [
    ["Low-Sodium Chicken Adobo with Rice", ["chicken", "garlic", "vinegar", "rice"], 420, 52, ["soy"], "microwave"],
    ["Pork Sinigang with Brown Rice", ["pork", "tamarind", "kangkong", "brown rice"], 480, 55, [], "microwave"],
    ["Chicken Tinola with Rice", ["chicken", "ginger", "green papaya", "rice"], 390, 48, [], "microwave"],
    ["Arroz Caldo", ["chicken", "rice", "ginger"], 450, 58, [], "microwave"],
    ["Pancit Bihon", ["rice noodles", "chicken", "carrots", "cabbage"], 520, 62, ["soy"], "microwave"],
    ["Ginataang Gulay with Rice", ["squash", "green beans", "coconut milk", "rice"], 380, 54, [], "microwave"],
    ["Baked Bangus with Garlic Rice", ["milkfish", "tomatoes", "rice"], 410, 50, ["fish"], "microwave"],
    ["Heart-Healthy Beef Kaldereta", ["beef", "potatoes", "bell pepper"], 540, 46, [], "microwave"],
    ["Chicken Afritada with Rice", ["chicken", "potatoes", "peas", "rice"], 500, 53, [], "microwave"],
    ["Lumpiang Sariwa", ["vegetables", "wheat wrapper", "peanut sauce"], 460, 44, ["peanut", "gluten", "egg"], "none"],
  ],
  Chinese: [
    ["Chicken Congee with Scallions", ["chicken", "rice", "ginger"], 380, 48, [], "microwave"],
    ["Steamed Fish with Ginger and Rice", ["fish", "ginger", "rice"], 420, 47, ["fish"], "microwave"],
    ["Vegetable Stir-Fry with Tofu", ["tofu", "bok choy", "carrots", "rice"], 510, 45, ["soy"], "microwave"],
    ["Beef and Broccoli with Brown Rice", ["beef", "broccoli", "brown rice"], 560, 50, ["soy"], "microwave"],
    ["Mild Mapo Tofu with Rice", ["tofu", "ground pork", "rice"], 580, 52, ["soy"], "microwave"],
    ["Cashew Chicken with Rice", ["chicken", "cashews", "bell pepper", "rice"], 540, 49, ["tree_nut", "soy"], "microwave"],
    ["Shrimp Chow Mein", ["shrimp", "wheat noodles", "cabbage"], 610, 58, ["shellfish", "gluten", "soy"], "microwave"],
    ["Buddha's Delight", ["tofu", "mushrooms", "napa cabbage", "rice"], 430, 51, ["soy"], "microwave"],
    ["Vegetable Egg Fried Rice", ["rice", "egg", "peas", "carrots"], 520, 60, ["egg", "soy"], "microwave"],
    ["Winter Melon Soup with Chicken and Rice", ["winter melon", "chicken", "rice"], 350, 42, [], "microwave"],
  ],
  Vietnamese: [
    ["Pho Ga (Chicken Pho)", ["chicken", "rice noodles", "herbs"], 540, 55, [], "microwave"],
    ["Lemongrass Chicken with Rice", ["chicken", "lemongrass", "rice"], 470, 50, [], "microwave"],
    ["Bun Bowl with Grilled Pork", ["pork", "rice noodles", "cucumber", "herbs"], 490, 56, ["peanut"], "microwave"],
    ["Com Tam with Grilled Chicken", ["chicken", "broken rice", "pickled vegetables"], 510, 57, [], "microwave"],
    ["Canh Chua (Sour Fish Soup) with Rice", ["fish", "pineapple", "tomato", "rice"], 450, 46, ["fish"], "microwave"],
    ["Fresh Spring Rolls with Chicken", ["chicken", "rice paper", "vermicelli", "peanut sauce"], 400, 44, ["peanut"], "none"],
    ["Ginger Chicken Claypot with Rice", ["chicken", "ginger", "rice"], 530, 51, [], "microwave"],
    ["Tofu and Vegetable Curry with Rice", ["tofu", "coconut milk", "vegetables", "rice"], 460, 53, ["soy"], "microwave"],
    ["Beef Pho with Rice Noodles", ["beef", "rice noodles", "herbs"], 590, 54, [], "microwave"],
    ["Steamed Rice Rolls with Mushrooms", ["rice flour", "mushrooms", "shallots"], 430, 49, [], "microwave"],
  ],
  Mexican: [
    ["Chicken Fajita Bowl", ["chicken", "bell pepper", "onion", "brown rice"], 480, 55, [], "microwave"],
    ["Black Bean and Rice Bowl", ["black beans", "rice", "corn", "tomato"], 440, 58, [], "microwave"],
    ["Veggie Enchiladas", ["corn tortilla", "vegetables", "cheese"], 570, 50, ["dairy"], "microwave"],
    ["Pork Carnitas Bowl", ["pork", "rice", "pico de gallo"], 520, 52, [], "microwave"],
    ["Baja Fish Tacos", ["fish", "corn tortilla", "cabbage slaw"], 500, 47, ["fish"], "microwave"],
    ["Chicken Pozole Verde", ["chicken", "hominy", "tomatillo"], 590, 45, [], "microwave"],
    ["Chicken Tinga with Rice", ["chicken", "chipotle", "tomato", "rice"], 460, 48, [], "microwave"],
    ["Calabacitas con Pollo", ["chicken", "zucchini", "corn", "rice"], 380, 44, [], "microwave"],
    ["Turkey Picadillo with Rice", ["turkey", "potatoes", "olives", "rice"], 440, 47, [], "microwave"],
    ["Bean and Cheese Burrito", ["flour tortilla", "pinto beans", "cheese"], 620, 65, ["dairy", "gluten"], "microwave"],
  ],
  American: [
    ["Herb Roasted Chicken with Mashed Potatoes", ["chicken", "potatoes", "green beans"], 420, 45, ["dairy"], "microwave"],
    ["Turkey Meatloaf with Roasted Vegetables", ["turkey", "carrots", "potatoes"], 480, 42, ["egg"], "microwave"],
    ["Baked Salmon with Quinoa", ["salmon", "quinoa", "asparagus"], 390, 42, ["fish"], "microwave"],
    ["Grilled Chicken Garden Salad", ["chicken", "lettuce", "tomato", "cucumber"], 320, 36, [], "none"],
    ["Turkey and Avocado Sandwich", ["turkey", "whole wheat bread", "avocado"], 580, 48, ["gluten"], "none"],
    ["Hearty Beef Stew", ["beef", "potatoes", "carrots", "celery"], 520, 44, [], "microwave"],
    ["Chicken Pot Pie", ["chicken", "wheat crust", "peas", "cream"], 640, 52, ["gluten", "dairy"], "oven"],
    ["Three-Bean Veggie Chili", ["kidney beans", "black beans", "tomato", "corn"], 450, 50, [], "microwave"],
    ["BBQ Chicken with Corn and Slaw", ["chicken", "corn", "cabbage slaw"], 560, 58, [], "microwave"],
    ["Overnight Oats with Berries", ["oats", "yogurt", "berries"], 300, 54, ["dairy"], "none"],
  ],
  Mediterranean: [
    ["Chicken Shawarma Bowl", ["chicken", "rice", "cucumber", "tomato"], 510, 52, [], "microwave"],
    ["Falafel Plate with Hummus", ["chickpeas", "pita", "tahini"], 480, 58, ["sesame", "gluten"], "microwave"],
    ["Greek Chicken with Orzo", ["chicken", "orzo", "spinach", "lemon"], 470, 50, ["gluten"], "microwave"],
    ["Hearty Lentil Soup with Vegetables", ["lentils", "carrots", "celery", "tomato"], 420, 45, [], "microwave"],
    ["Baked Cod with Herbed Couscous", ["cod", "couscous", "zucchini"], 380, 44, ["fish", "gluten"], "microwave"],
    ["Vegetable Moussaka", ["eggplant", "potatoes", "béchamel"], 520, 40, ["dairy"], "oven"],
    ["Tabbouleh with Grilled Chicken", ["bulgur", "parsley", "chicken", "tomato"], 400, 42, ["gluten"], "none"],
    ["Quinoa-Stuffed Bell Peppers", ["bell pepper", "quinoa", "tomato", "herbs"], 430, 48, [], "microwave"],
    ["Shakshuka with Whole-Grain Pita", ["egg", "tomato", "pita"], 490, 44, ["egg", "gluten"], "microwave"],
    ["Hummus and Veggie Wrap", ["hummus", "whole wheat wrap", "vegetables"], 450, 52, ["sesame", "gluten"], "none"],
  ],
  Indian: [
    ["Chicken Tikka with Basmati Rice", ["chicken", "yogurt", "basmati rice"], 520, 55, ["dairy"], "microwave"],
    ["Dal Tadka with Brown Rice", ["lentils", "tomato", "brown rice"], 430, 58, [], "microwave"],
    ["Chana Masala with Rice", ["chickpeas", "tomato", "onion", "rice"], 460, 56, [], "microwave"],
    ["Vegetable Korma with Rice", ["vegetables", "cashews", "cream", "rice"], 540, 50, ["dairy", "tree_nut"], "microwave"],
    ["Tandoori Chicken with Rice and Raita", ["chicken", "yogurt", "rice"], 480, 49, ["dairy"], "microwave"],
    ["Palak Paneer with Rice", ["spinach", "paneer", "rice"], 510, 46, ["dairy"], "microwave"],
    ["Vegetable Biryani", ["basmati rice", "vegetables", "spices"], 500, 62, [], "microwave"],
    ["Rajma (Kidney Bean Curry) with Rice", ["kidney beans", "tomato", "rice"], 440, 57, [], "microwave"],
    ["Mild Chicken Curry with Rice", ["chicken", "tomato", "onion", "rice"], 530, 52, [], "microwave"],
    ["Kitchari with Seasonal Vegetables", ["lentils", "rice", "vegetables"], 400, 54, [], "microwave"],
  ],
  Italian: [
    ["Chicken Pasta Primavera", ["chicken", "wheat pasta", "zucchini", "tomato"], 490, 60, ["gluten"], "microwave"],
    ["Turkey Bolognese with Whole-Wheat Pasta", ["turkey", "wheat pasta", "tomato"], 540, 58, ["gluten"], "microwave"],
    ["Minestrone with Whole-Grain Roll", ["vegetables", "cannellini beans", "wheat roll"], 480, 52, ["gluten"], "microwave"],
    ["Baked Ziti", ["wheat pasta", "ricotta", "tomato"], 620, 64, ["gluten", "dairy"], "microwave"],
    ["Chicken Piccata with Rice", ["chicken", "lemon", "capers", "rice"], 470, 45, [], "microwave"],
    ["Eggplant Parmesan", ["eggplant", "mozzarella", "breadcrumbs"], 580, 48, ["dairy", "gluten"], "oven"],
    ["Mushroom Risotto", ["arborio rice", "mushrooms", "parmesan"], 510, 62, ["dairy"], "microwave"],
    ["Pesto Pasta with Green Beans", ["wheat pasta", "basil pesto", "pine nuts"], 560, 61, ["gluten", "tree_nut", "dairy"], "microwave"],
    ["Tuscan White Bean Soup", ["cannellini beans", "kale", "tomato"], 420, 50, [], "microwave"],
    ["Grilled Chicken with Creamy Polenta", ["chicken", "polenta", "spinach"], 450, 53, ["dairy"], "microwave"],
  ],
};

function buildMeals() {
  const meals = [];
  let n = 1;
  for (const [cuisine, templates] of Object.entries(MEAL_TEMPLATES)) {
    for (const [name, ingredients, baseSodium, baseCarbs, allergens, reheat] of templates) {
      const sodium_mg = baseSodium + ri(-30, 30);
      const carbs_g = baseCarbs + ri(-3, 3);
      const diet_tags = [];
      if (sodium_mg <= 550) diet_tags.push("heart-healthy");
      if (carbs_g >= 35 && carbs_g <= 60) diet_tags.push("diabetic-friendly");
      if (sodium_mg <= 430) diet_tags.push("renal-friendly");
      if (!allergens.includes("gluten")) diet_tags.push("gluten-free");
      if (!ingredients.some((i) => MEAT.some((m) => i.includes(m)))) diet_tags.push("vegetarian");
      // Full nutrition, from a per-meal PRNG (leaves the global stream — and
      // thus the rest of the dataset — untouched). Calories are derived from
      // the macros (4/4/9), so the label always adds up; the validator checks.
      const nRand = mulberry32(9000 + n);
      const nri = (min, max) => min + Math.floor(nRand() * (max - min + 1));
      const hasMeat = ingredients.some((i) => MEAT.some((m) => i.includes(m)));
      const hasVegProtein = ingredients.some((i) =>
        /tofu|beans|lentils|chickpeas|paneer|egg|yogurt|cashews|hummus/.test(i));
      const protein_g = hasMeat ? nri(24, 34) : hasVegProtein ? nri(16, 24) : nri(10, 16);
      const fat_g = nri(9, 20);
      const fiber_g = nri(3, 9);
      const calories = carbs_g * 4 + protein_g * 4 + fat_g * 9;
      meals.push({
        id: `M${String(n++).padStart(3, "0")}`,
        name, cuisine, sodium_mg, carbs_g,
        calories, protein_g, fat_g, fiber_g,
        allergens, key_ingredients: ingredients, diet_tags,
        stock_qty: ri(40, 140),
        source: weighted([["kitchen", 0.7], ["donated", 0.15], ["purchased", 0.15]]),
        reheat_method: reheat,
      });
    }
  }
  // Story beat (PRD §4): the hero's best match starts stock-constrained so the
  // Kitchen Planning Agent has a real shortfall to solve with a new adobo batch.
  const adobo = meals.find((m) => m.name.startsWith("Low-Sodium Chicken Adobo"));
  adobo.stock_qty = 8;
  adobo.source = "kitchen";
  return meals;
}

// ---------- clients (150, hero = 1042) ----------
const FIRST = ["Maria","Jose","Ana","Carlos","Mei","Wei","Liang","Thuy","Minh","Huong","Rosa","Miguel","Sofia","James","Mary","Robert","Linda","David","Aisha","Omar","Fatima","Priya","Raj","Anita","Elena","Dmitri","Olga","Marcus","Keisha","Darnell","Grace","Samuel","Ruth","Daniel","Esther","Victor","Lourdes","Ramon","Corazon","Benigno"];
const LAST = ["Santos","Reyes","Cruz","Garcia","Chen","Wong","Li","Nguyen","Tran","Pham","Martinez","Lopez","Rodriguez","Smith","Johnson","Williams","Brown","Jones","Hassan","Ali","Khan","Patel","Sharma","Singh","Ivanov","Petrov","Washington","Jefferson","Jackson","Robinson","Kim","Park","Lee","Torres","Ramos","Flores","Mendoza","Aquino","Bautista","Villanueva"];
const HOSPITALS = ["Zuckerberg San Francisco General","UCSF Medical Center","CPMC Van Ness","Kaiser Permanente San Francisco","Chinese Hospital","Saint Francis Memorial"];
const ZONES = ["Tenderloin","Mission","Bayview-Hunters Point","Sunset","Richmond","SoMa","Excelsior","Chinatown","Western Addition","Visitacion Valley"];
const ALLERGENS = ["peanut","shellfish","dairy","gluten","soy","egg","tree_nut","fish","sesame"];
const DISLIKES = ["lentils","mushrooms","tofu","beef","pork","cilantro","coconut milk","eggplant","kidney beans"];

const HERO = {
  id: 1042,
  name: "Rosa Dela Cruz",
  referring_hospital: "Zuckerberg San Francisco General",
  diet_orders: ["diabetic", "cardiovascular"],
  allergies: ["peanut"],
  max_sodium_mg: 600,
  carb_range_g: [45, 60],
  cuisine_pref: "Filipino",
  dislikes: ["lentils"],
  cooking_ability: "microwave",
  address_zone: "Tenderloin",
  meals_per_week: 7,
};

function buildClients() {
  const clients = [];
  const usedNames = new Set([HERO.name]);
  for (let i = 0; i < 150; i++) {
    const id = 1001 + i;
    if (id === 1042) { clients.push(HERO); continue; }
    let name;
    do { name = `${pick(FIRST)} ${pick(LAST)}`; } while (usedNames.has(name));
    usedNames.add(name);
    const diet_orders = weighted([
      [["diabetic"], 0.30], [["cardiovascular"], 0.25], [["diabetic", "cardiovascular"], 0.22],
      [["renal"], 0.08], [["renal", "cardiovascular"], 0.05], [["diabetic", "renal"], 0.04],
      [["cardiovascular", "diabetic", "renal"], 0.02], [["low-sodium"], 0.04],
    ]);
    const nAllergies = weighted([[0, 0.55], [1, 0.28], [2, 0.13], [3, 0.04]]);
    const allergies = sampleN(ALLERGENS, nAllergies);
    let max_sodium_mg = 800;
    if (diet_orders.includes("cardiovascular") || diet_orders.includes("low-sodium")) max_sodium_mg = pick([600, 650, 700]);
    if (diet_orders.includes("renal")) max_sodium_mg = pick([500, 550, 600]);
    const carb_range_g = diet_orders.includes("diabetic") ? pick([[45, 60], [40, 55], [45, 65]]) : pick([[40, 70], [45, 75], [35, 70]]);
    clients.push({
      id, name,
      referring_hospital: pick(HOSPITALS),
      diet_orders, allergies, max_sodium_mg, carb_range_g,
      cuisine_pref: weighted([["Chinese", 0.18], ["American", 0.18], ["Mexican", 0.15], ["Filipino", 0.12], ["Vietnamese", 0.10], ["Italian", 0.10], ["Mediterranean", 0.09], ["Indian", 0.08]]),
      dislikes: sampleN(DISLIKES, weighted([[0, 0.45], [1, 0.35], [2, 0.20]])),
      cooking_ability: weighted([["none", 0.05], ["microwave", 0.40], ["stovetop", 0.30], ["full", 0.25]]),
      address_zone: pick(ZONES),
      meals_per_week: weighted([[5, 0.3], [7, 0.5], [10, 0.2]]),
    });
  }
  return clients;
}

// ---------- grocery inventory ----------
const GROCERY_ITEMS = [
  // [name, sodium, carbs, allergens, prep_complexity, stock]
  ["Brown Rice (2 lb bag)", 5, 45, [], "microwave", 200],
  ["Instant Oatmeal (unsweetened, 10-pack)", 0, 27, [], "microwave", 180],
  ["Quinoa Cup (microwavable)", 10, 39, [], "microwave", 120],
  ["Low-Sodium Canned Black Beans", 140, 22, [], "microwave", 160],
  ["Frozen Mixed Vegetables (1 lb)", 45, 12, [], "microwave", 220],
  ["Pre-Cooked Chicken Breast Strips (8 oz)", 200, 0, [], "microwave", 150],
  ["Low-Sodium Canned Tuna", 180, 0, ["fish"], "none", 140],
  ["Low-Sodium Vegetable Soup (microwavable)", 340, 18, [], "microwave", 170],
  ["Unsalted Whole-Grain Crackers", 30, 20, ["gluten"], "none", 130],
  ["Fresh Apples (3-pack)", 0, 25, [], "none", 200],
  ["Bananas (bunch)", 1, 27, [], "none", 200],
  ["Whole-Wheat Tortillas (8-pack)", 220, 24, ["gluten"], "none", 110],
  ["Shelf-Stable Milk (1 qt)", 120, 12, ["dairy"], "none", 100],
  ["Plain Greek Yogurt (4-pack)", 60, 8, ["dairy"], "none", 120],
  ["Natural Peanut Butter (unsalted)", 5, 7, ["peanut"], "none", 90],
  ["Microwavable Brown Rice Cup", 15, 34, [], "microwave", 160],
  ["Low-Sodium Chicken Noodle Soup", 360, 16, ["gluten"], "microwave", 140],
  ["Steam-in-Bag Broccoli Florets", 30, 6, [], "microwave", 180],
  ["Canned No-Salt-Added Diced Tomatoes", 20, 6, [], "stovetop", 150],
  ["Dry Red Lentils (1 lb)", 10, 30, [], "stovetop", 100],
  ["Eggs (dozen)", 70, 1, ["egg"], "stovetop", 110],
  ["Corn Tortillas (12-pack)", 15, 22, [], "microwave", 130],
  ["Unsalted Almonds (8 oz)", 0, 8, ["tree_nut"], "none", 90],
  ["Shelf-Stable Hummus Cups", 130, 9, ["sesame"], "none", 100],
  ["Frozen Berries (1 lb)", 0, 17, [], "none", 120],
];

function buildInventory() {
  return GROCERY_ITEMS.map(([name, sodium_mg, carbs_g, allergens, prep_complexity, stock_qty], i) => ({
    id: `G${String(i + 1).padStart(3, "0")}`,
    name,
    nutrition: { sodium_mg, carbs_g },
    allergens,
    stock_qty,
    prep_complexity, // none | microwave | stovetop
  }));
}

// ---------- donations ----------
// triage_status / routed_to are DERIVED from triageDonation() in lib/clinical.mjs
// (like diet tags from nutrition numbers) so the data can never disagree with
// the rules the agent-run pipeline reasons from.
const RAW_DONATIONS = [
  { id: "D001", donor: "Golden State Rice Cooperative", received_at: "2026-07-19T08:30:00Z", condition: "good",
    items: [{ name: "Jasmine Rice (50 lb sacks)", qty: 12, unit: "sack", allergens: [] }] },
  { id: "D002", donor: "Bay Area Produce Exchange", received_at: "2026-07-19T09:15:00Z", condition: "good",
    items: [{ name: "Fresh Bok Choy (cases)", qty: 8, unit: "case", allergens: [] }, { name: "Carrots (25 lb bags)", qty: 6, unit: "bag", allergens: [] }] },
  { id: "D003", donor: "Mission Community Market", received_at: "2026-07-19T10:00:00Z", condition: "good",
    items: [{ name: "Canned Low-Sodium Beans (flats)", qty: 20, unit: "flat", allergens: [] }] },
  { id: "D004", donor: "Sunrise Bakery", received_at: "2026-07-19T11:20:00Z", condition: "good",
    items: [{ name: "Whole-Wheat Rolls (dozens)", qty: 15, unit: "dozen", allergens: ["gluten"] }] },
  { id: "D005", donor: "Pacific Seafood Distributors", received_at: "2026-07-19T12:05:00Z", condition: "good",
    items: [{ name: "Frozen Cod Fillets (10 lb boxes)", qty: 10, unit: "box", allergens: ["fish"] }] },
  { id: "D006", donor: "Anonymous Drop-off", received_at: "2026-07-19T13:40:00Z", condition: "expired",
    items: [{ name: "Assorted Canned Goods (past date)", qty: 4, unit: "case", allergens: [] }] },
  { id: "D007", donor: "Valley Poultry Farms", received_at: "2026-07-19T14:10:00Z", condition: "good",
    items: [{ name: "Chicken Thighs (40 lb cases)", qty: 9, unit: "case", allergens: [] }] },
  { id: "D008", donor: "Richmond Grocery Outlet", received_at: "2026-07-19T15:00:00Z", condition: "good",
    items: [{ name: "Instant Oatmeal (cases)", qty: 12, unit: "case", allergens: [] }] },
  { id: "D009", donor: "Sunset Farmers Market", received_at: "2026-07-19T15:45:00Z", condition: "over_ripe",
    items: [{ name: "Over-Ripe Bananas (cases)", qty: 7, unit: "case", allergens: [] }] },
  { id: "D010", donor: "Corporate Cafeteria Surplus", received_at: "2026-07-19T16:30:00Z", condition: "unknown_provenance",
    items: [{ name: "Prepared Sandwich Trays", qty: 6, unit: "tray", allergens: ["gluten", "dairy"] }] },
  { id: "D011", donor: "SoMa Wholesale Foods", received_at: "2026-07-20T08:20:00Z", condition: "good",
    items: [{ name: "Brown Rice (25 lb bags)", qty: 10, unit: "bag", allergens: [] }] },
  { id: "D012", donor: "Peninsula Dairy Collective", received_at: "2026-07-20T09:10:00Z", condition: "good",
    items: [{ name: "Plain Greek Yogurt (cases)", qty: 8, unit: "case", allergens: ["dairy"] }] },
];

function buildDonations() {
  return RAW_DONATIONS.map((d) => {
    const triage = triageDonation(d, BATCHES);
    return { ...d, triage_status: triage.status, routed_to: triage.routed_to };
  });
}

// ---------- kitchen capacity & production plan ----------
function buildKitchen() {
  return [
    { date: "2026-07-20", labor_hours_available: 42, equipment_slots: 6, batch_min: 20, batch_max: 120 },
    { date: "2026-07-21", labor_hours_available: 38, equipment_slots: 6, batch_min: 20, batch_max: 120 },
    { date: "2026-07-22", labor_hours_available: 40, equipment_slots: 5, batch_min: 20, batch_max: 120 },
  ];
}

const BATCHES = [
  { id: "B1", meal_name: "Low-Sodium Chicken Adobo with Rice", qty: 80, labor_hours: 9, date: "2026-07-20", ingredients_from: ["D001", "D007"] },
  { id: "B2", meal_name: "Chicken Congee with Scallions", qty: 100, labor_hours: 7, date: "2026-07-20", ingredients_from: ["D002", "D011"] },
  { id: "B3", meal_name: "Baked Cod with Herbed Couscous", qty: 60, labor_hours: 8, date: "2026-07-21", ingredients_from: ["D005"] },
];

// ---------- clinical matching (rule-based; hard constraints per PRD §5) ----------
// hardCheck / softScore live in lib/clinical.mjs, shared with the agent-run pipeline.

function constraintChecks(client, meal) {
  return {
    allergen: { status: "pass", client_allergies: client.allergies, meal_allergens: meal.allergens },
    sodium: { status: "pass", value: meal.sodium_mg, limit: client.max_sodium_mg },
    carbs: { status: "pass", value: meal.carbs_g, range: client.carb_range_g },
    diet_orders: { status: "pass", orders: client.diet_orders, meal_tags: meal.diet_tags },
  };
}

function composeGroceryKit(client, inventory, days) {
  const safe = inventory.filter((g) => {
    if (g.allergens.some((a) => client.allergies.includes(a))) return false;
    if (client.cooking_ability === "none" && g.prep_complexity !== "none") return false;
    if (client.cooking_ability === "microwave" && g.prep_complexity === "stovetop") return false;
    if (client.dislikes.some((d) => g.name.toLowerCase().includes(d))) return false;
    return true;
  });
  const byCat = (names) => safe.find((g) => names.some((n) => g.name.includes(n)));
  const picks = [
    byCat(["Brown Rice Cup", "Quinoa", "Oatmeal"]),
    byCat(["Chicken Breast", "Tuna", "Black Beans", "Eggs"]),
    byCat(["Mixed Vegetables", "Broccoli"]),
    byCat(["Soup"]),
    byCat(["Apples", "Bananas", "Berries"]),
  ].filter(Boolean);
  const items = picks.map((g) => ({ grocery_id: g.id, name: g.name, qty: days,
    constraint_checks: { allergen: { status: "pass" }, sodium: { status: "pass", value: g.nutrition.sodium_mg, limit: client.max_sodium_mg } } }));
  const microwave = client.cooking_ability !== "none";
  const prep_instructions = [
    `Each kit day combines one grain, one protein, and one vegetable item (per-day totals stay under ${client.max_sodium_mg} mg sodium and within ${client.carb_range_g[0]}–${client.carb_range_g[1]} g carbs).`,
    microwave ? "Microwave the grain cup for 90 seconds; let stand 1 minute." : "All items are ready to eat — no heating required.",
    microwave ? "Microwave the vegetable bag for 3–4 minutes until steaming." : "Rinse fruit before eating.",
    "Add the protein on top of the grain; season with pepper or lemon — no added salt.",
    "Refrigerate any opened items and use within 2 days.",
  ];
  return { items, prep_instructions, covers_days: days };
}

// The kitchen cooks 3–5 recipes per day, not a bespoke plate per client.
const MENU_MIN = 3;
const MENU_MAX = 5;

/**
 * Plan the daily menus: seed each day with the hero's scripted Filipino week
 * and the story-batch meals, then greedy set-cover so every coverable client
 * can eat from that day's menu, breaking ties by cuisine-preference matches
 * and week-level variety.
 */
function planDailyMenus(clients, meals) {
  const slots = new Map(); // client_id -> Map(day -> servings)
  for (const c of clients) {
    const m = new Map();
    for (let i = 0; i < c.meals_per_week; i++) {
      const d = DAYS[i % 7];
      m.set(d, (m.get(d) ?? 0) + 1);
    }
    slots.set(c.id, m);
  }
  const eligible = new Map(
    clients.map((c) => [
      c.id,
      new Set(meals.filter((m) => hardCheck(c, m).length === 0).map((m) => m.id)),
    ]),
  );
  const byName = new Map(meals.map((m) => [m.name, m]));
  const SEEDS = {
    Mon: ["Low-Sodium Chicken Adobo with Rice"],
    Tue: ["Baked Bangus with Garlic Rice"],
    Wed: ["Ginataang Gulay with Rice"],
    Thu: ["Chicken Tinola with Rice"],
    Fri: ["Pork Sinigang with Brown Rice"],
    Sat: ["Chicken Congee with Scallions"],
    Sun: ["Baked Cod with Herbed Couscous"],
  };
  const usedThisWeek = new Map(); // meal_id -> days already on a menu
  const menus = new Map(); // day -> meal_id[]
  for (const day of DAYS) {
    const dayClients = clients.filter((c) => (slots.get(c.id).get(day) ?? 0) > 0);
    const menu = [];
    const covered = new Set();
    const add = (meal) => {
      menu.push(meal.id);
      usedThisWeek.set(meal.id, (usedThisWeek.get(meal.id) ?? 0) + 1);
      for (const c of dayClients) {
        if (eligible.get(c.id).has(meal.id)) covered.add(c.id);
      }
    };
    for (const name of SEEDS[day] ?? []) add(byName.get(name));
    while (menu.length < MENU_MAX) {
      let best = null;
      let bestScore = -Infinity;
      let bestGain = 0;
      for (const m of meals) {
        if (menu.includes(m.id)) continue;
        let gain = 0;
        let prefs = 0;
        for (const c of dayClients) {
          if (!eligible.get(c.id).has(m.id)) continue;
          if (!covered.has(c.id)) gain++;
          if (m.cuisine === c.cuisine_pref) prefs++;
        }
        const score = gain * 10000 + prefs * 10 - (usedThisWeek.get(m.id) ?? 0) * 40;
        if (score > bestScore) {
          bestScore = score;
          best = m;
          bestGain = gain;
        }
      }
      if (!best) break;
      // Once everyone coverable is covered, keep adding preference picks only
      // up to a modest menu (variety without kitchen sprawl).
      if (bestGain === 0 && menu.length >= Math.max(MENU_MIN, 4)) break;
      add(best);
    }
    menus.set(day, menu);
  }
  return { menus, slots, eligible };
}

function allocateAll(clients, meals, inventory) {
  const { menus, slots, eligible } = planDailyMenus(clients, meals);
  const mealBy = new Map(meals.map((m) => [m.id, m]));
  const allocations = [];
  for (const client of clients) {
    const need = client.meals_per_week;
    // Hero (PRD §4, FR7): the scripted week is 5 matched meals Mon–Fri plus a
    // grocery kit covering the 2 gap days — her weekend slots are skipped on purpose.
    const skipDays = client.id === HERO.id ? new Set(["Sat", "Sun"]) : new Set();
    const items = [];
    let coveredServings = 0;
    for (const day of DAYS) {
      const count = slots.get(client.id).get(day) ?? 0;
      if (!count || skipDays.has(day)) continue;
      const options = menus
        .get(day)
        .map((id) => mealBy.get(id))
        .filter((m) => eligible.get(client.id).has(m.id))
        .sort((a, b) => softScore(client, b) - softScore(client, a));
      if (!options.length) continue; // nothing on today's menu fits — kit day
      const usedIds = new Set(items.map((i) => i.meal_id));
      const pick = options.find((m) => !usedIds.has(m.id)) ?? options[0];
      items.push({
        meal_id: pick.id, meal_name: pick.name, qty: count, day,
        from_batch: null, // assigned by markFromBatch once production is planned
        constraint_checks: constraintChecks(client, pick),
      });
      coveredServings += count;
    }
    const gapDays = need - coveredServings;
    const grocery_kit = gapDays > 0 ? composeGroceryKit(client, inventory, gapDays) : null;
    allocations.push({
      client_id: client.id, week: WEEK, items, grocery_kit,
      fallback_level: 0, // finalized by markFromBatch
      fully_compliant_meals: gapDays === 0,
    });
  }
  return allocations;
}

/**
 * Production planning from real demand: the story batches (B1–B3, wired to
 * donations) always exist; any other menu meal whose weekly demand exceeds
 * current stock gets its own batch. Labor ≈ 1 h per 12 servings.
 */
function planProduction(allocations, meals, kitchen) {
  const mealBy = new Map(meals.map((m) => [m.id, m]));
  const demand = new Map();
  for (const a of allocations) {
    for (const it of a.items) demand.set(it.meal_id, (demand.get(it.meal_id) ?? 0) + it.qty);
  }
  const round10 = (n) => Math.ceil(n / 10) * 10;
  const batches = [];
  for (const b of BATCHES) {
    const meal = meals.find((m) => m.name === b.meal_name);
    b.meal_id = meal.id;
    const shortfall = Math.max(0, (demand.get(meal.id) ?? 0) - meal.stock_qty);
    b.qty = Math.max(20, round10(shortfall + 5));
    b.labor_hours = Math.max(2, Math.ceil(b.qty / 12));
    batches.push(b);
  }
  const storyIds = new Set(batches.map((b) => b.meal_id));
  let n = BATCHES.length + 1;
  const extras = [...demand.entries()]
    .filter(([id, q]) => !storyIds.has(id) && q > mealBy.get(id).stock_qty)
    .sort(([a], [b]) => (a < b ? -1 : 1));
  for (const [id, q] of extras) {
    const meal = mealBy.get(id);
    const qty = Math.max(20, round10(q - meal.stock_qty + 5));
    batches.push({
      id: `B${n}`,
      meal_id: id,
      meal_name: meal.name,
      qty,
      labor_hours: Math.max(2, Math.ceil(qty / 12)),
      date: kitchen[(n - 1) % kitchen.length].date,
      ingredients_from: [],
    });
    n++;
  }
  return batches;
}

/**
 * Walk allocations in order: the first `stock_qty` servings of each meal come
 * from current stock, the rest from that meal's scheduled batch. Then finalize
 * each client's fallback level (PRD §5 ladder).
 */
function markFromBatch(allocations, meals, batches) {
  const left = new Map(meals.map((m) => [m.id, m.stock_qty]));
  const batchByMeal = new Map(batches.map((b) => [b.meal_id, b.id]));
  for (const a of allocations) {
    for (const it of a.items) {
      const l = left.get(it.meal_id) ?? 0;
      if (l >= it.qty) left.set(it.meal_id, l - it.qty);
      else if (batchByMeal.has(it.meal_id)) it.from_batch = batchByMeal.get(it.meal_id);
    }
  }
  // Hero story beat: her adobo serving is explicitly the batch-B1 unit (PRD §4).
  const heroAlloc = allocations.find((a) => a.client_id === HERO.id);
  const adoboItem = heroAlloc?.items.find((i) => i.meal_name.startsWith("Low-Sodium Chicken Adobo"));
  if (adoboItem) adoboItem.from_batch = "B1";
  for (const a of allocations) {
    const usedBatch = a.items.some((i) => i.from_batch);
    a.fallback_level = a.items.length === 0 ? 2 : usedBatch ? 1 : a.grocery_kit ? 2 : 0;
  }
}

// ---------- delivery ----------
const WINDOWS = ["10:00–12:00", "12:00–14:00", "14:00–16:00"];
function buildDelivery(clients) {
  const zones = ZONES.map((zone) => ({ zone, depot_distance_mi: ri(2, 9), cold_chain_limit_hours: 4 }));
  const batches = [];
  for (const zone of ZONES) {
    const zoneClients = clients.filter((c) => c.address_zone === zone).map((c) => c.id);
    for (let i = 0; i < zoneClients.length; i += 12) {
      batches.push({
        route_id: `R-${zone.split(/[\s-]/)[0].toUpperCase().slice(0, 4)}-${Math.floor(i / 12) + 1}`,
        zone,
        clients: zoneClients.slice(i, i + 12),
        window: WINDOWS[batches.length % WINDOWS.length],
        delivery_date: "2026-07-21",
        cold_chain_ok: true,
      });
    }
  }
  return { zones, batches };
}

// ---------- agent runs (hero + stockout) ----------
function heroEvents(client, meals, allocation, batchB1, kitchenToday) {
  const chosen = allocation.items;
  const rejectedExamples = meals
    .filter((m) => m.cuisine === "Filipino")
    .map((m) => ({ meal: m, failures: hardCheck(client, m) }))
    .filter((x) => x.failures.length > 0)
    .slice(0, 3);

  let t = 0; let seq = 0;
  const ev = (agent, type, title, detail, data = null) => {
    t += ri(900, 2600);
    return { seq: seq++, t_offset_ms: t, agent, type, title, detail, ...(data ? { data } : {}) };
  };

  return [
    ev("orchestrator", "status", "Referral received", `New referral from ${client.referring_hospital} for client ${client.id}. Starting intake pipeline.`),
    ev("intake", "thought", "Parsing referral", "HL7-style discharge summary detected. Extracting diet orders, allergy list, and hard nutritional limits."),
    ev("intake", "check", "Diet orders identified", `Diet orders: ${client.diet_orders.join(" + ")}. Allergy: ${client.allergies.join(", ")}. Sodium ceiling ${client.max_sodium_mg} mg/meal, carbohydrates ${client.carb_range_g[0]}–${client.carb_range_g[1]} g/meal.`),
    ev("intake", "output", "Client profile structured", `Preferences captured: ${client.cuisine_pref} cuisine, dislikes ${client.dislikes.join(", ")}, cooking ability: ${client.cooking_ability}-only, ${client.meals_per_week} meals/week, zone: ${client.address_zone}.`, { client_profile_id: client.id }),
    ev("orchestrator", "status", "Dispatching Clinical Matching Agent", "Profile validated. Hard constraint hierarchy locked: allergens → sodium → carbs → diet-order tags. These are exclusion rules, never scoring penalties."),
    ev("matching", "thought", "Scanning inventory", `Scoring all ${meals.length} meals against hard constraints first, then ranking survivors by cuisine preference and dislike avoidance.`),
    ...rejectedExamples.map((x) => ev("matching", "check", `Rejected: ${x.meal.name}`, `Excluded — ${x.failures[0]}. Hard constraint: cannot be scored down, must be removed.`, { meal_id: x.meal.id, result: "fail" })),
    ...chosen.slice(0, 5).map((it) => ev("matching", "check", `Matched: ${it.meal_name}`, `All hard checks pass — sodium ${it.constraint_checks.sodium.value}/${it.constraint_checks.sodium.limit} mg ✓, carbs ${it.constraint_checks.carbs.value} g (target ${client.carb_range_g[0]}–${client.carb_range_g[1]}) ✓, no ${client.allergies.join("/")} ✓.${it.from_batch ? " Sourced from today's kitchen batch." : ""}`, { meal_id: it.meal_id, result: "pass" })),
    ev("matching", "thought", "Shortfall detected", `Only ${chosen.filter((i) => !i.from_batch).length} compliant servings available from current stock against a ${client.meals_per_week}-meal plan. Escalating shortfall to Kitchen Planning; composing grocery bundle for remaining gap days.`),
    ev("kitchen", "thought", "Aggregating unmet demand", "Compliant Filipino-style, diabetic + heart-healthy meals are stock-constrained across today's queue. Evaluating a production batch against remaining capacity."),
    ev("kitchen", "output", "Batch scheduled: Low-Sodium Chicken Adobo", `Batch B1: ${batchB1.qty} servings, ${batchB1.labor_hours} labor hours, fits today's remaining capacity (${kitchenToday.labor_hours_available} h available, ${kitchenToday.equipment_slots} equipment slots). Recipe meets ${client.max_sodium_mg} mg sodium ceiling at ${meals.find((m) => m.id === batchB1.meal_id).sodium_mg} mg/serving.`, { batch_id: "B1" }),
    ev("donation", "check", "Donation D001 triaged", "Incoming jasmine rice donation (12 × 50 lb) classified as kitchen ingredient — condition good, no allergens. Routing to batch B1.", { donation_id: "D001", result: "kitchen_ingredient" }),
    ev("donation", "check", "Donation D007 triaged", "Chicken thighs (9 cases) — cold chain intact. Routing to batch B1 as primary protein.", { donation_id: "D007", result: "kitchen_ingredient" }),
    ev("fallback", "output", "Grocery kit composed", `Gap of ${allocation.grocery_kit ? allocation.grocery_kit.covers_days : 0} day(s) covered with a microwave-only kit: ${allocation.grocery_kit ? allocation.grocery_kit.items.map((i) => i.name).join(", ") : ""}. All items peanut-free; numbered prep steps limited to microwave use.`, { fallback_level: allocation.fallback_level }),
    ev("delivery", "thought", "Scheduling pickup", `Client zone is ${client.address_zone}. Pickup batch R-TEND-1 is prepared for the 10:00–12:00 window with cold-chain margin.`),
    ev("delivery", "output", "Pickup scheduled", `Meals for client ${client.id} will be ready for pickup 2026-07-21, window 10:00–12:00 (batch R-TEND-1, ${client.address_zone} group). Cold chain OK.`, { route_id: "R-TEND-1" }),
    ev("orchestrator", "output", "Plan complete", `Client ${client.id}: ${chosen.length} compliant meals (${chosen.filter((i) => i.from_batch).length} from batch B1)${allocation.grocery_kit ? ` + grocery kit covering ${allocation.grocery_kit.covers_days} day(s)` : ""}. 0 hard-constraint violations. Total pipeline time: ${(t / 1000 / 60).toFixed(1)} min.`),
  ];
}

function stockoutEvents(client, meals, allocation) {
  const depleted = allocation.items[0];
  const replacement = meals
    .filter((m) => m.id !== depleted.meal_id && hardCheck(client, m).length === 0 && !allocation.items.some((i) => i.meal_id === m.id))
    .sort((a, b) => softScore(client, b) - softScore(client, a))[0];
  let t = 0; let seq = 0;
  const ev = (agent, type, title, detail, data = null) => {
    t += ri(800, 2200);
    return { seq: seq++, t_offset_ms: t, agent, type, title, detail, ...(data ? { data } : {}) };
  };
  return [
    ev("orchestrator", "status", "Stock alert", `${depleted.meal_name} (${depleted.meal_id}) marked depleted by inventory. One allocation for client ${client.id} is affected. Triggering re-plan.`, { meal_id: depleted.meal_id }),
    ev("matching", "thought", "Re-scoring alternatives", "Re-running hard-constraint filter over remaining stock. Constraint hierarchy unchanged: clinical limits are never relaxed, only preferences."),
    ev("matching", "check", `Replacement candidate: ${replacement.name}`, `Sodium ${replacement.sodium_mg}/${client.max_sodium_mg} mg ✓, carbs ${replacement.carbs_g} g ✓, allergen-free for this client ✓, ${replacement.reheat_method === "microwave" ? "microwave-ready ✓" : "ready to eat ✓"}.`, { meal_id: replacement.id, result: "pass" }),
    ev("matching", "output", "Allocation updated", `Swapped ${depleted.meal_name} → ${replacement.name} for ${depleted.day}. ${replacement.cuisine === client.cuisine_pref ? "Cuisine preference preserved." : `Cuisine preference relaxed (soft constraint) — clinical limits held.`}`),
    ev("kitchen", "thought", "Demand signal updated", `Depletion of ${depleted.meal_id} raises tomorrow's batch priority for this recipe family.`),
    ev("orchestrator", "output", "Re-plan complete", `Client ${client.id} remains fully covered with 0 clinical violations. Re-plan latency: ${(t / 1000).toFixed(0)} s.`),
  ];
}

/**
 * Donation-intake sim stream (FR12, P2): a new donation arrives, the Donation
 * Triage Agent classifies it with the shared rule, and routes it into a batch
 * or inventory. Anchored to the first client whose plan draws from the target
 * batch so the wrap-up can tie the donation to a real client outcome.
 * Template placeholder — the Claude pipeline upgrades it in place
 * (generate-agent-runs.mjs --scenario donation).
 */
function donationSimEvents({ donation, triage, batch, contrast, contrastTriage, anchorClient, anchorItem, servingsFromBatch }) {
  const localRand = mulberry32(anchorClient.id * 7919 + 101);
  const jitter = (min, max) => min + Math.floor(localRand() * (max - min + 1));
  let t = 0; let seq = 0;
  const ev = (agent, type, title, detail, data = null) => {
    t += jitter(900, 2600);
    return { seq: seq++, t_offset_ms: t, agent, type, title, detail, ...(data ? { data } : {}) };
  };
  const itemsText = donation.items.map((i) => `${i.name} × ${i.qty} ${i.unit}`).join(", ");
  const allergens = [...new Set(donation.items.flatMap((i) => i.allergens))];

  const events = [
    ev("orchestrator", "status", "Donation intake", `New drop-off from ${donation.donor}: ${itemsText}. Received ${donation.received_at.replace("T", " ").replace(":00Z", "")}. Dispatching Donation Triage Agent.`, { donation_id: donation.id }),
    ev("donation", "thought", "Inspecting condition and contents", `Condition reported '${donation.condition}'. Declared allergens: ${allergens.length ? allergens.join(", ") : "none"}. Checking against the food-safety gate, open batch ingredient needs, and inventory gaps.`),
    ev("donation", "check", "Food-safety gate", `Condition '${donation.condition}' ${donation.condition === "good" ? "passes the intake gate." : "fails the intake gate — only 'good' is accepted."}`, { donation_id: donation.id, result: donation.condition === "good" ? "pass" : "fail" }),
    ev("donation", "check", `Triaged: ${triage.status === "kitchen_ingredient" ? "kitchen ingredient" : triage.status === "usable_as_is" ? "usable as-is" : "non-compliant"}`, `${triage.reasons.join("; ")}.`, { donation_id: donation.id, result: triage.status }),
  ];
  if (batch) {
    events.push(ev("kitchen", "output", `Ingredient logged for batch ${batch.id}`, `${itemsText} booked as ingredient for batch ${batch.id} (${batch.meal_name}, ${batch.qty} servings on ${batch.date}). No change to scheduled labor hours.`, { batch_id: batch.id }));
  } else if (triage.status === "usable_as_is") {
    events.push(ev("donation", "output", "Shelved to grocery inventory", `${itemsText} added to grocery inventory for fallback kits and as-is distribution.`, { donation_id: donation.id }));
  }
  if (contrast) {
    events.push(ev("donation", "check", `Contrast: ${contrast.id} rejected at the same gate`, `Earlier intake from ${contrast.donor} (${contrast.items.map((i) => i.name).join(", ")}) was classified non-compliant: ${contrastTriage.reasons.join("; ")}. The gate is a hard rule, not a score.`, { donation_id: contrast.id, result: "non_compliant" }));
  }
  events.push(ev("orchestrator", "output", "Donation processed", `${donation.id} routed to ${triage.routed_to ?? "rejection"}. ${batch ? `Batch ${batch.id} supplies ${servingsFromBatch} serving(s) across this week's plans, including ${anchorClient.name}'s ${anchorItem.day} ${anchorItem.meal_name} (client ${anchorClient.id}). ` : ""}0 hard-constraint violations introduced; donation utilization updated.`));
  return events;
}

/**
 * Generic per-client event stream (Phase 4 batch-run: every referral gets a
 * replayable run, so the scale view can drill into any client). Deliberately
 * uses its own PRNG seeded by client id — pacing is stable per client and the
 * global PRNG stream (which shapes the core dataset) is untouched. These are
 * placeholders the Claude pipeline (generate-agent-runs.mjs) upgrades in place.
 */
function templateEvents(client, meals, allocation, route, donations, batches) {
  const localRand = mulberry32(client.id * 7919 + 17);
  const jitter = (min, max) => min + Math.floor(localRand() * (max - min + 1));
  let t = 0; let seq = 0;
  const ev = (agent, type, title, detail, data = null) => {
    t += jitter(900, 2600);
    return { seq: seq++, t_offset_ms: t, agent, type, title, detail, ...(data ? { data } : {}) };
  };
  const or = (arr, fallbackText) => (arr.length ? arr.join(", ") : fallbackText);

  const rejected = meals
    .map((m) => ({ meal: m, failures: hardCheck(client, m) }))
    .filter((x) => x.failures.length > 0)
    .sort((a, b) => softScore(client, b.meal) - softScore(client, a.meal))
    .slice(0, 2);
  const passes = allocation.items.slice(0, 3);
  const batchIds = [...new Set(allocation.items.map((i) => i.from_batch).filter(Boolean))];

  const events = [
    ev("orchestrator", "status", "Referral received", `New referral from ${client.referring_hospital} for client ${client.id}. Starting intake pipeline.`),
    ev("intake", "output", "Client profile structured", `Diet orders: ${or(client.diet_orders, "general")}. Allergies: ${or(client.allergies, "none")}. Sodium ceiling ${client.max_sodium_mg} mg/meal, carbs ${client.carb_range_g[0]}–${client.carb_range_g[1]} g/meal. Prefers ${client.cuisine_pref}; dislikes ${or(client.dislikes, "nothing noted")}. Cooking ability: ${client.cooking_ability}. ${client.meals_per_week} meals/week, zone ${client.address_zone}.`),
    ev("orchestrator", "status", "Dispatching Clinical Matching Agent", "Hard constraint hierarchy locked: allergens → sodium → carbs → diet-order tags. Exclusion rules, never scoring penalties."),
    ev("matching", "thought", "Scanning inventory", `Scoring all ${meals.length} meals against hard constraints, then ranking survivors by cuisine preference and dislike avoidance.`),
    ...rejected.map((x) => ev("matching", "check", `Rejected: ${x.meal.name}`, `Excluded — ${x.failures[0]}.`, { meal_id: x.meal.id, result: "fail" })),
    ...passes.map((it) => ev("matching", "check", `Matched: ${it.meal_name}`, `All hard checks pass — sodium ${it.constraint_checks.sodium.value}/${it.constraint_checks.sodium.limit} mg ✓, carbs ${it.constraint_checks.carbs.value} g (target ${client.carb_range_g[0]}–${client.carb_range_g[1]}) ✓${client.allergies.length ? `, no ${client.allergies.join("/")} ✓` : ""}.${it.from_batch ? ` Sourced from kitchen batch ${it.from_batch}.` : ""}`, { meal_id: it.meal_id, result: "pass" })),
  ];

  if (allocation.items.length === 0) {
    events.push(ev("matching", "thought", "No compliant meal in stock", "No existing meal passes every hard constraint for this profile. Escalating to Fallback Composer — preferences may be relaxed, clinical limits never are."));
  }
  for (const batchId of batchIds) {
    const batch = batches.find((b) => b.id === batchId);
    events.push(ev("kitchen", "output", `Batch allocated: ${batch.meal_name}`, `Serving drawn from scheduled batch ${batch.id} (${batch.qty} servings, ${batch.labor_hours} labor hours on ${batch.date}).`, { batch_id: batch.id }));
    const donation = donations.find((d) => batch.ingredients_from.includes(d.id));
    if (donation) events.push(ev("donation", "check", `Donation ${donation.id} feeds batch ${batch.id}`, `${donation.items.map((i) => i.name).join(", ")} from ${donation.donor} — triaged as kitchen ingredient.`, { donation_id: donation.id, result: "kitchen_ingredient" }));
  }
  if (allocation.grocery_kit) {
    events.push(ev("fallback", "output", "Grocery kit composed", `${allocation.grocery_kit.covers_days} gap day(s) covered: ${allocation.grocery_kit.items.map((i) => i.name).join(", ")}. All items allergen-safe for this client; prep steps match ${client.cooking_ability === "none" ? "no-cook" : client.cooking_ability} ability.`, { result: "pass" }));
  }
  if (route) {
    events.push(ev("delivery", "output", "Pickup scheduled", `Meals for client ${client.id} ready for pickup ${route.delivery_date}, window ${route.window} (${route.zone} group). Cold chain OK.`, { route_id: route.route_id }));
  }
  events.push(ev("orchestrator", "output", "Plan complete", `Client ${client.id}: ${allocation.items.length} compliant meal(s)${allocation.grocery_kit ? ` + grocery kit covering ${allocation.grocery_kit.covers_days} day(s)` : ""} at fallback level ${allocation.fallback_level}. 0 hard-constraint violations.`));
  return events;
}

// ---------- write everything ----------
function main() {
  const meals = buildMeals();
  const clients = buildClients();
  const inventory = buildInventory();
  const donations = buildDonations();
  const kitchen = buildKitchen();
  const allocations = allocateAll(clients, meals, inventory);
  const productionBatches = planProduction(allocations, meals, kitchen);
  markFromBatch(allocations, meals, productionBatches);
  const delivery = buildDelivery(clients);
  const hero = clients.find((c) => c.id === 1042);
  const heroAlloc = allocations.find((a) => a.client_id === 1042);

  const production_plan = {
    week: WEEK,
    batches: productionBatches.map(({ id, meal_id, meal_name, qty, labor_hours, date, ingredients_from }) => ({ id, meal_id, meal_name, qty, labor_hours, date, ingredients_from })),
    capacity_utilization: Number((productionBatches.reduce((s, b) => s + b.labor_hours, 0) / kitchen.reduce((s, k) => s + k.labor_hours_available, 0)).toFixed(2)),
  };

  mkdirSync(join(OUT, "agent_runs"), { recursive: true });
  mkdirSync(join(OUT, "scenarios"), { recursive: true });
  const write = (rel, obj) => writeFileSync(join(OUT, rel), JSON.stringify(obj, null, 2) + "\n");

  write("clients.json", clients);
  write("meals.json", meals);
  write("inventory.json", inventory);
  write("donations.json", donations);
  write("kitchen.json", kitchen);
  write("delivery.json", delivery);
  write("allocations.json", allocations);
  write("production_plan.json", production_plan);
  // Agent runs: never clobber a Claude-authored run (generator = model id).
  // Template runs are placeholders the offline Claude pipeline upgrades in place.
  let runsWritten = 0, runsPreserved = 0;
  const writeRun = (rel, obj) => {
    const path = join(OUT, rel);
    if (existsSync(path)) {
      const existing = JSON.parse(readFileSync(path, "utf8"));
      if (existing.generator && existing.generator !== "template") { runsPreserved++; return; }
    }
    write(rel, obj);
    runsWritten++;
  };

  writeRun("agent_runs/client-1042.json", { client_id: 1042, scenario: "happy_path", generator: "template", events: heroEvents(hero, meals, heroAlloc, productionBatches.find((b) => b.id === "B1"), kitchen[0]) });
  writeRun("agent_runs/client-1042-stockout.json", { client_id: 1042, scenario: "stockout_replan", generator: "template", events: stockoutEvents(hero, meals, heroAlloc) });
  for (const c of clients) {
    if (c.id === 1042) continue;
    const alloc = allocations.find((a) => a.client_id === c.id);
    const route = delivery.batches.find((b) => b.clients.includes(c.id)) ?? null;
    writeRun(`agent_runs/client-${c.id}.json`, { client_id: c.id, scenario: "happy_path", generator: "template", events: templateEvents(c, meals, alloc, route, donations, productionBatches) });
  }
  // Donation-intake sim (FR12): D011 arrives demo morning (2026-07-20) and the
  // triage rule routes it into batch B2; the contrast donation shows the
  // food-safety gate rejecting. Anchor = first client drawing from that batch.
  const SIM_DONATION_ID = "D011";
  // The anchor client can move when the allocator changes — drop stale
  // template donation runs so exactly one sim stream exists.
  for (const f of readdirSync(join(OUT, "agent_runs"))) {
    if (!f.endsWith("-donation.json")) continue;
    const existing = JSON.parse(readFileSync(join(OUT, "agent_runs", f), "utf8"));
    if (!existing.generator || existing.generator === "template") unlinkSync(join(OUT, "agent_runs", f));
  }
  const simDonation = donations.find((d) => d.id === SIM_DONATION_ID);
  const simTriage = triageDonation(simDonation, BATCHES);
  const simBatch = BATCHES.find((b) => b.ingredients_from.includes(SIM_DONATION_ID)) ?? null;
  if (!simBatch) throw new Error(`donation sim: ${SIM_DONATION_ID} is not routed to any batch — pick a kitchen_ingredient donation`);
  const servingsFromBatch = allocations.reduce((s, a) => s + a.items.filter((i) => i.from_batch === simBatch.id).reduce((x, i) => x + i.qty, 0), 0);
  const anchorAlloc = allocations.find((a) => a.items.some((i) => i.from_batch === simBatch.id));
  const anchorClient = clients.find((c) => c.id === anchorAlloc.client_id);
  const anchorItem = anchorAlloc.items.find((i) => i.from_batch === simBatch.id);
  const contrast = donations.find((d) => d.condition !== "good");
  writeRun(`agent_runs/client-${anchorClient.id}-donation.json`, {
    client_id: anchorClient.id, scenario: "donation_sim", generator: "template",
    events: donationSimEvents({ donation: simDonation, triage: simTriage, batch: simBatch, contrast, contrastTriage: triageDonation(contrast, BATCHES), anchorClient, anchorItem, servingsFromBatch }),
  });

  write("scenarios/happy_path.json", { id: "happy_path", title: "Referral to pickup: Client 1042", client_id: 1042, run: "agent_runs/client-1042.json", description: "Hospital referral arrives; minutes later a complete, clinically-safe weekly plan exists (PRD §4)." });
  write("scenarios/stockout_replan.json", { id: "stockout_replan", title: "Stress beat: stock depletion re-plan", client_id: 1042, run: "agent_runs/client-1042-stockout.json", depleted_meal_id: heroAlloc.items[0].meal_id, description: "A meal's stock is marked depleted; agents re-plan the allocation live (PRD §4, FR10)." });
  write("scenarios/donation_sim.json", { id: "donation_sim", title: "Donation intake: a new arrival is triaged live", client_id: anchorClient.id, run: `agent_runs/client-${anchorClient.id}-donation.json`, donation_id: SIM_DONATION_ID, description: "A new donation is dropped off; the Donation Triage Agent classifies it against the food-safety gate and routes it into a scheduled kitchen batch (FR12, PRD §4)." });

  const matched = allocations.filter((a) => a.fallback_level <= 1 && a.items.length > 0).length;
  const kits = allocations.filter((a) => a.grocery_kit).length;
  console.log(`clients: ${clients.length} | meals: ${meals.length} | grocery items: ${inventory.length} | donations: ${donations.length}`);
  console.log(`allocations: ${allocations.length} | matched to compliant meals (level 0/1): ${matched} (${((matched / allocations.length) * 100).toFixed(1)}%) | grocery kits issued: ${kits}`);
  console.log(`fallback levels: 0=${allocations.filter((a) => a.fallback_level === 0).length}, 1=${allocations.filter((a) => a.fallback_level === 1).length}, 2=${allocations.filter((a) => a.fallback_level === 2).length}`);
  console.log(`agent runs: ${runsWritten} written, ${runsPreserved} Claude-authored preserved`);
  const menuSizes = DAYS.map((d) => new Set(allocations.flatMap((a) => a.items.filter((i) => i.day === d).map((i) => i.meal_id))).size);
  console.log(`daily menu sizes (Mon–Sun): ${menuSizes.join(", ")} | batches: ${productionBatches.length} | labor: ${productionBatches.reduce((x, b) => x + b.labor_hours, 0)}h of ${kitchen.reduce((x, k) => x + k.labor_hours_available, 0)}h`);
}

main();
