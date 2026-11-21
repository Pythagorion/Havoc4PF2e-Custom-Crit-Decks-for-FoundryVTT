import { MODULE_ID } from "../constants.js";
import { escapeHTML, localize } from "../utils.js";
import { undoRecords } from "./apply.js";

/**
 * GM-only chat message listing what was applied, with an undo button.
 * @param {string} title     Header, e.g. "Applied: Gut Instinct".
 * @param {string[]} lines   Applied steps.
 * @param {string[]} notes   Reminders for the GM.
 * @param {object[]} records Undo records from applyPlan.
 */
export async function postResult(title, lines, notes, records) {
  const list = (items, cls = "") => items.length
    ? `<ul class="hcd-result-list ${cls}">${items.map((l) => `<li>${escapeHTML(l)}</li>`).join("")}</ul>`
    : "";
  const empty = !lines.length && !notes.length ? `<p class="hcd-result-empty">${localize("HCD.Auto.Result.Nothing")}</p>` : "";
  const undo = records.length
    ? `<button type="button" data-hcd-action="undo"><i class="fa-solid fa-rotate-left"></i> ${localize("HCD.Auto.Result.Undo")}</button>`
    : "";
  await ChatMessage.create({
    content: `<div class="hcd-result">
      <p class="hcd-result-header">${escapeHTML(title)}</p>
      ${list(lines)}${list(notes, "hcd-result-notes")}${empty}${undo}
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
