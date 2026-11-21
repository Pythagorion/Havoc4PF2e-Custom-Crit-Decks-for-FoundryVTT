import { DEGREES, MODULE_ID, SOCKET } from "../constants.js";
import { escapeHTML, format, localize } from "../utils.js";
import { OUTCOME_FALLBACK, SAVES } from "./schema.js";
import { applyPlan, resolveCreatures } from "./apply.js";
import { postResult } from "./results.js";

/*
 * Save steps. A creature controlled by a connected player gets a chat card with a roll
 * button for that player; any other creature is rolled for by the GM right away. Once the
 * degree of success is known, the GM client applies the steps of that outcome.
 *
 * Pending saves live in the chat message flags, so they survive a reload. The GM can roll
 * for the player or set the result by hand from the same chat card.
 */

/**
 * Apply a plan, post the result message, then start its saves (so the result of a save
 * always comes after the message that announced it).
 * @param {string} title
 * @param {object} [options]
 * @param {boolean} [options.always]  Post the result message even if nothing was applied.
 */
export async function runPlan(plan, { card, info = {} }, title, { always = false } = {}) {
  const { lines, notes, records, saves } = await applyPlan(plan, { card, info });
  if (always || lines.length || notes.length) await postResult(title, lines, notes, records);
  for (const step of saves) await requestSave(step, { card, info });
}

/** Active non-GM users owning the actor. */
function controllingPlayers(actor) {
  return game.users.filter((u) => u.active && !u.isGM && actor.testUserPermission(u, "OWNER"));
}

async function requestSave(step, { card, info }) {
  const creature = resolveCreatures(info)[step.recipient];
  if (!creature) return;
  const { actor, token } = creature;
  const request = {
    actorUuid: actor.uuid,
    actorName: token?.name ?? actor.name,
    save: step.save,
    dc: step.dc,
    outcomes: step.outcomes ?? {},
    card: { id: card.id, title: card.title, effect: card.effect },
    info,
    state: "pending",
    degree: null
  };

  const players = controllingPlayers(actor);
  if (!players.length) {
    const degree = await rollSave(request, { skipDialog: true });
    if (degree !== null) return resolveSave(request, degree);
  }
  // A player rolls themselves (or the GM's roll was cancelled): ask in chat
  await ChatMessage.create({
    content: renderRequest(request),
    speaker: { alias: localize("HCD.ModuleShort") },
    whisper: players.length ? [] : game.users.filter((u) => u.isGM).map((u) => u.id),
    flags: { [MODULE_ID]: { saveRequest: request } }
  });
}

/**
 * Roll the save (or flat check) of a request on this client.
 * @returns {Promise<number|null>}  Degree of success index (see DEGREES), null if cancelled.
 */
async function rollSave(request, { skipDialog, event } = {}) {
  const actor = fromUuidSync(request.actorUuid);
  if (!actor) return null;
  if (request.save === "flat") {
    const roll = await new Roll("1d20").evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: format("HCD.Auto.FlatFlavor", { title: request.card.title, dc: request.dc })
    });
    return roll.total >= request.dc ? 2 : 1;
  }
  const statistic = actor.getStatistic?.(request.save);
  if (!statistic) return null;
  const origin = request.info?.actorUuid ? fromUuidSync(request.info.actorUuid) : null;
  const roll = await statistic.roll({
    dc: { value: request.dc },
    origin: origin ?? undefined,
    skipDialog,
    event
  });
  return typeof roll?.degreeOfSuccess === "number" ? roll.degreeOfSuccess : null;
}

/** GM side: apply the outcome of a save and close its chat card. */
async function resolveSave(request, degree, message = null) {
  const outcome = DEGREES[degree];
  if (!outcome) return;
  if (message) {
    const resolved = { ...request, state: "resolved", degree };
    await message.update({ content: renderRequest(resolved), [`flags.${MODULE_ID}.saveRequest`]: resolved });
  }
  const steps = request.outcomes[outcome] ?? request.outcomes[OUTCOME_FALLBACK[outcome]] ?? [];
  const title = format("HCD.Auto.Result.SaveTitle", {
    title: request.card.title,
    actor: request.actorName,
    outcome: localize(`HCD.Auto.Degree.${outcome}`)
  });
  await runPlan(steps, { card: request.card, info: request.info }, title, { always: true });
}

function renderRequest(request) {
  const save = localize(SAVES[request.save] ?? request.save);
  const check = `${escapeHTML(request.actorName)}: ${escapeHTML(format("HCD.Auto.Describe.save", { save, dc: request.dc }))}`;
  if (request.state !== "pending") {
    return `<div class="hcd-save-request hcd-resolved">
      <p class="hcd-result-header">${escapeHTML(request.card.title)}</p>
      <p>${check}</p>
      <p class="hcd-save-outcome">${localize(`HCD.Auto.Degree.${DEGREES[request.degree]}`)}</p>
    </div>`;
  }
  // Flat checks only know success and failure
  const degrees = request.save === "flat" ? [2, 1] : [3, 2, 1, 0];
  const manual = degrees.map((d) => `<button type="button" data-hcd-degree="${d}">${localize(`HCD.Auto.Degree.${DEGREES[d]}`)}</button>`).join("");
  return `<div class="hcd-save-request">
    <p class="hcd-result-header">${escapeHTML(request.card.title)}</p>
    <p>${check}</p>
    <button type="button" data-hcd-action="roll-save"><i class="fa-solid fa-dice-d20"></i> ${escapeHTML(format("HCD.Auto.Save.Roll", { save }))}</button>
    <div class="hcd-gm-only">
      <p class="hint">${localize("HCD.Auto.Save.GMHint")}</p>
      <div class="hcd-save-degrees">${manual}</div>
    </div>
  </div>`;
}

/** renderChatMessageHTML hook: roll button for the owners, result buttons for the GM. */
export function bindSaveListeners(message, html) {
  const request = message.getFlag(MODULE_ID, "saveRequest");
  if (!request) return;
  if (!game.user.isGM) html.querySelectorAll(".hcd-gm-only").forEach((el) => el.remove());
  if (request.state !== "pending") return;

  const rollButton = html.querySelector("[data-hcd-action=roll-save]");
  if (rollButton && !fromUuidSync(request.actorUuid)?.isOwner) rollButton.remove();
  rollButton?.addEventListener("click", async (event) => {
    event.preventDefault();
    rollButton.disabled = true;
    const degree = await rollSave(request, { event });
    if (degree === null) rollButton.disabled = false;
    else submitResult(message.id, degree);
  });
  for (const button of html.querySelectorAll("[data-hcd-degree]")) {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      submitResult(message.id, Number(button.dataset.hcdDegree));
    });
  }
}

/** Players can't update the GM's message, so their result goes to the GM via socket. */
function submitResult(messageId, degree) {
  if (game.user.isGM) return handleResult(messageId, degree, game.user.id);
  game.socket.emit(SOCKET, { action: "auto-save-result", messageId, degree, userId: game.user.id });
}

/** Messages currently being resolved, so a result is never applied twice. */
const resolving = new Set();

async function handleResult(messageId, degree, userId) {
  const message = game.messages.get(messageId);
  const request = message?.getFlag(MODULE_ID, "saveRequest");
  if (!request || request.state !== "pending" || resolving.has(messageId)) return;
  const user = game.users.get(userId);
  const actor = fromUuidSync(request.actorUuid);
  if (!user?.isGM && !actor?.testUserPermission(user, "OWNER")) return;

  resolving.add(messageId);
  try {
    await resolveSave(request, degree, message);
  } finally {
    resolving.delete(messageId);
  }
}

/** Socket handler for automation messages; only the active GM acts on them. */
export function onAutomationSocket(data) {
  if (data.action === "auto-save-result" && game.users.activeGM?.isSelf) {
    handleResult(data.messageId, data.degree, data.userId);
  }
}
