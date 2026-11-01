import { DECKS, MODULE_ID, TEMPLATES } from "./constants.js";
import { describeTrigger } from "./deck.js";
import { format, localize } from "./utils.js";
import { beginDraw } from "./player-draw.js";

/** Whisper a "draw a card?" question to all GMs. */
export async function createGmPrompt({ deck, rollKind, attackType, damageTypes, info }) {
  const prompt = { deck, rollKind, attackType, damageTypes, info, state: "pending", cardTitle: null };
  return ChatMessage.create({
    content: await renderPromptContent(prompt),
    whisper: game.users.filter((u) => u.isGM).map((u) => u.id),
    speaker: { alias: localize("HCD.ModuleShort") },
    flags: { [MODULE_ID]: { prompt } }
  });
}

async function renderPromptContent(prompt) {
  const deckLabel = localize(DECKS[prompt.deck].label);
  const stateLabels = {
    ignored: localize("HCD.Prompt.State.ignored"),
    declined: localize("HCD.Prompt.State.declined"),
    playerDrawing: localize("HCD.Prompt.State.playerDrawing"),
    revealed: format("HCD.Prompt.State.revealed", { title: prompt.cardTitle ?? "" })
  };
  return foundry.applications.handlebars.renderTemplate(TEMPLATES.prompt, {
    deck: prompt.deck,
    icon: DECKS[prompt.deck].icon,
    deckLabel,
    summary: format("HCD.Prompt.Summary", {
      actor: prompt.info.actorName,
      natural: prompt.info.natural,
      details: describeTrigger(prompt)
    }),
    question: format("HCD.Prompt.Question", { deck: deckLabel }),
    pending: prompt.state === "pending",
    stateLabel: stateLabels[prompt.state] ?? ""
  });
}

/** Mark a prompt as handled and remove its buttons. */
export async function resolvePrompt(messageId, state, cardTitle = null) {
  const message = game.messages.get(messageId);
  const prompt = message?.getFlag(MODULE_ID, "prompt");
  if (!prompt) return;
  const updated = { ...prompt, state, cardTitle };
  await message.update({
    content: await renderPromptContent(updated),
    [`flags.${MODULE_ID}.prompt`]: updated
  });
}

/** renderChatMessageHTML hook: wire up the prompt buttons. */
export function bindPromptListeners(message, html) {
  const prompt = message.getFlag(MODULE_ID, "prompt");
  if (!prompt || prompt.state !== "pending" || !game.user.isGM) return;

  html.querySelector("[data-hcd-action=draw]")?.addEventListener("click", (event) => {
    event.preventDefault();
    beginDraw({ ...prompt, promptMessageId: message.id });
  });
  html.querySelector("[data-hcd-action=ignore]")?.addEventListener("click", (event) => {
    event.preventDefault();
    resolvePrompt(message.id, "ignored");
  });
}
