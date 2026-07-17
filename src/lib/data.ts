/**
 * Static dataset loading (PRD §6): all JSON artifacts are bundled at build
 * time — zero network dependencies at demo time. Steven owns generation;
 * this module only loads and indexes.
 */
import type {
  Allocation,
  AgentRun,
  ClientProfile,
  DeliveryData,
  Donation,
  GroceryItem,
  KitchenDay,
  Meal,
  ProductionPlan,
  Scenario,
} from "./types";

import clientsJson from "../../data/clients.json";
import mealsJson from "../../data/meals.json";
import inventoryJson from "../../data/inventory.json";
import donationsJson from "../../data/donations.json";
import kitchenJson from "../../data/kitchen.json";
import deliveryJson from "../../data/delivery.json";
import allocationsJson from "../../data/allocations.json";
import productionPlanJson from "../../data/production_plan.json";
import heroRunJson from "../../data/agent_runs/client-1042.json";
import stockoutRunJson from "../../data/agent_runs/client-1042-stockout.json";
import happyPathJson from "../../data/scenarios/happy_path.json";
import stockoutScenarioJson from "../../data/scenarios/stockout_replan.json";
import donationScenarioJson from "../../data/scenarios/donation_sim.json";

export const clients = clientsJson as ClientProfile[];
export const meals = mealsJson as Meal[];
export const inventory = inventoryJson as GroceryItem[];
export const donations = donationsJson as Donation[];
export const kitchen = kitchenJson as KitchenDay[];
export const delivery = deliveryJson as unknown as DeliveryData;
export const allocations = allocationsJson as unknown as Allocation[];
export const productionPlan = productionPlanJson as ProductionPlan;

export const heroRun = heroRunJson as AgentRun;
export const stockoutRun = stockoutRunJson as AgentRun;
export const happyPathScenario = happyPathJson as Scenario;
export const stockoutScenario = stockoutScenarioJson as Scenario;
export const donationScenario = donationScenarioJson as Scenario;

export const HERO_CLIENT_ID = happyPathScenario.client_id; // 1042

export const clientById = new Map(clients.map((c) => [c.id, c]));
export const mealById = new Map(meals.map((m) => [m.id, m]));
export const groceryById = new Map(inventory.map((g) => [g.id, g]));
export const donationById = new Map(donations.map((d) => [d.id, d]));
export const allocationByClientId = new Map(
  allocations.map((a) => [a.client_id, a]),
);
