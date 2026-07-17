/**
 * Domain types mirroring Steven's frozen JSON schemas (data/README.md, PRD §7).
 * The agent-run event shape is also the future live API contract (PRD §11) —
 * keep it stable.
 */

export type CookingAbility = "none" | "microwave" | "stovetop" | "full";

export interface ClientProfile {
  id: number;
  name: string;
  referring_hospital: string;
  diet_orders: string[];
  allergies: string[];
  max_sodium_mg: number;
  carb_range_g: [number, number];
  cuisine_pref: string;
  dislikes: string[];
  cooking_ability: CookingAbility;
  address_zone: string;
  meals_per_week: number;
}

export interface Meal {
  id: string;
  name: string;
  cuisine: string;
  sodium_mg: number;
  carbs_g: number;
  calories: number;
  protein_g: number;
  fat_g: number;
  fiber_g: number;
  allergens: string[];
  key_ingredients: string[];
  diet_tags: string[];
  stock_qty: number;
  source: "kitchen" | "donated" | "purchased";
  reheat_method: "none" | "microwave" | "stovetop" | "oven";
}

export interface GroceryItem {
  id: string;
  name: string;
  nutrition: { sodium_mg: number; carbs_g: number };
  allergens: string[];
  stock_qty: number;
  prep_complexity: "none" | "microwave" | "stovetop";
}

export interface Donation {
  id: string;
  donor: string;
  received_at: string;
  condition: string;
  items: { name: string; qty: number; unit: string; allergens: string[] }[];
  triage_status: string;
  routed_to: string | null;
}

export interface KitchenDay {
  date: string;
  labor_hours_available: number;
  equipment_slots: number;
  batch_min: number;
  batch_max: number;
}

export interface DeliveryZone {
  zone: string;
  depot_distance_mi: number;
  cold_chain_limit_hours: number;
}

export interface DeliveryRoute {
  route_id: string;
  zone: string;
  clients: number[];
  window: string;
  delivery_date: string;
  cold_chain_ok: boolean;
}

export interface DeliveryData {
  zones: DeliveryZone[];
  batches: DeliveryRoute[];
}

export interface AllocationItem {
  meal_id: string;
  meal_name: string;
  qty: number;
  day: string;
  from_batch: string | null;
  /** Generator-declared checks — the UI re-verifies these live, never trusts them. */
  constraint_checks: unknown;
}

export interface GroceryKitItem {
  grocery_id: string;
  name: string;
  qty: number;
  constraint_checks: unknown;
}

export interface GroceryKit {
  items: GroceryKitItem[];
  prep_instructions: string[];
  covers_days: number;
}

export interface Allocation {
  client_id: number;
  week: string;
  items: AllocationItem[];
  grocery_kit: GroceryKit | null;
  fallback_level: 0 | 1 | 2;
  fully_compliant_meals: boolean;
}

export interface ProductionBatch {
  id: string;
  meal_id: string;
  meal_name: string;
  qty: number;
  labor_hours: number;
  date: string;
  ingredients_from: string[];
}

export interface ProductionPlan {
  week: string;
  batches: ProductionBatch[];
  capacity_utilization: number;
}

// --- agent run event stream (replay contract, future live API — PRD §11) ---

export type AgentName =
  | "orchestrator"
  | "intake"
  | "matching"
  | "kitchen"
  | "donation"
  | "delivery"
  | "fallback";

export type AgentEventType = "status" | "thought" | "check" | "output";

export interface AgentEvent {
  seq: number;
  t_offset_ms: number;
  agent: AgentName;
  type: AgentEventType;
  title: string;
  detail: string;
  data?: {
    meal_id?: string;
    result?: string;
    batch_id?: string;
    donation_id?: string;
    route_id?: string;
    fallback_level?: number;
    client_profile_id?: number;
  };
}

export interface AgentRun {
  client_id: number;
  scenario: string;
  /** Provenance: "template" (deterministic) or the Claude model id that authored the reasoning offline. */
  generator?: string;
  events: AgentEvent[];
}

export interface Scenario {
  id: string;
  title: string;
  client_id: number;
  run: string;
  depleted_meal_id?: string;
  /** Donation-intake sim (FR12): the donation this scenario triages. */
  donation_id?: string;
  description: string;
}
