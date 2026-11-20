import { MODULE_ID } from "../constants.js";
import { escapeHTML, format, getSetting, localize } from "../utils.js";
import { DEFAULT_AUTOMATION } from "./default-automation.js";
import { normalizeSteps } from "./schema.js";
import { applyPlan, buildPlan, undoRecords } from "./apply.js";
import { AutomationReview } from "./review.js";

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
    const plan = await AutomationReview.wait({ card, plan: buildPlan(steps, { info, damageTypes }), info });
    if (!plan) return;
    const { lines, records } = await applyPlan(plan, { card, info });
    const notes = plan.filter((s) => s.enabled && s.type === "note").map((s) => s.text);
    if (lines.length || notes.length) await postResult(card, lines, notes, records);
  } catch (err) {
    console.error(`${MODULE_ID} | Card automation failed`, err);
  }
}

/** GM-only chat message listing what was applied, with an undo button. */
async function postResult(card, lines, notes, records) {
  const list = (items, cls = "") => items.length
    ? `<ul class="hcd-result-list ${cls}">${items.map((l) => `<li>${escapeHTML(l)}</li>`).join("")}</ul>`
    : "";
  const undo = records.length
    ? `<button type="button" data-hcd-action="undo"><i class="fa-solid fa-rotate-left"></i> ${localize("HCD.Auto.Result.Undo")}</button>`
    : "";
  await ChatMessage.create({
    content: `<div class="hcd-result">
      <p class="hcd-result-header">${escapeHTML(format("HCD.Auto.Result.Title", { title: card.title }))}</p>
      ${list(lines)}${list(notes, "hcd-result-notes")}${undo}
    </div>`,
    whisper: game.users.filter((u) => u.isGM).map((u) => u.id),
    speaker: { alias: localize("HCD.ModuleShort") },
    flags: { [MODULE_ID]: { automation: { records, undone: false } } }
  });
}

/** renderChatMessageHTML hook: wire up the undo button. */
export function bindResultListeners(message, html) {
  const data = message.getFlag(MODULE_ID, "automation");
  const button = html.querySelector("[data-hcd-action=undo]");
  if (!data || !button) return;
  if (data.undone || !game.user.isGM) {
    button.disabled = true;
    if (data.undone) button.innerHTML = `<i class="fa-solid fa-check"></i> ${localize("HCD.Auto.Result.Undone")}`;
    return;
  }
  button.addEventListener("click", async (event) => {
    event.preventDefault();
    button.disabled = true;
    await undoRecords(data.records);
    await message.setFlag(MODULE_ID, "automation", { ...data, undone: true });
  });
}
