import { MODULE_ID } from "../constants.js";
import { format, getSetting } from "../utils.js";
import { DEFAULT_AUTOMATION } from "./default-automation.js";
import { normalizeSteps } from "./schema.js";
import { buildPlan } from "./apply.js";
import { runPlan } from "./saves.js";
import { AutomationReview } from "./review.js";

export { bindResultListeners } from "./results.js";
export { bindSaveListeners, onAutomationSocket } from "./saves.js";

/** A card's own steps (custom cards), otherwise the shipped automation of a default card. */
export function getAutomation(card) {
  return normalizeSteps(card.automation ?? DEFAULT_AUTOMATION[card.id]);
}

/**
 * After a card was revealed: show the GM what would be applied and apply it on confirmation.
 * Does nothing unless automation is enabled and the card has steps.
 */
export async function offerAutomation(card, { info = {}, damageTypes = [] } = {}) {
  if (!game.user.isGM || !getSetting("automation") || game.system.id !== "pf2e") return;
  const steps = getAutomation(card);
  if (!steps.length) return;

  try {
    const plan = await AutomationReview.wait({ card, plan: buildPlan(steps, { card, info, damageTypes }), info });
    if (!plan) return;
    await runPlan(plan, { card, info }, format("HCD.Auto.Result.Title", { title: card.title }));
  } catch (err) {
    console.error(`${MODULE_ID} | Card automation failed`, err);
  }
}
