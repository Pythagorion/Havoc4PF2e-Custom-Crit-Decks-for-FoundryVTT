import { DECKS, MODULE_ID, SOCKET } from "./constants.js";
import { renderCardHTML } from "./deck.js";
import { animationsEnabled, escapeHTML, format, getSetting, localize, wait } from "./utils.js";

function caption(info = {}) {
  if (!info.actorName) return "";
  if (!info.itemName) return info.actorName;
  return format("HCD.Reveal.Caption", { actor: info.actorName, item: info.itemName });
}

/**
 * Show a card to everyone: chat message for the record, popup for the drama.
 * @param {object} [options]
 * @param {boolean} [options.popup]  Send the reveal popup (skipped when players already saw the card).
 */
export async function revealCard(card, info = {}, { popup = true } = {}) {
  // Chat content is enriched by Foundry when the message renders, so pass the raw text.
  const cardHTML = await renderCardHTML(card, { flat: true, enrich: false });
  const text = caption(info);
  await ChatMessage.create({
    content: `<div class="hcd-chat-reveal">${text ? `<p class="hcd-caption">${escapeHTML(text)}</p>` : ""}${cardHTML}</div>`,
    speaker: { alias: localize(DECKS[card.deck].label) },
    flags: { [MODULE_ID]: { reveal: { cardId: card.id, deck: card.deck } } }
  });

  if (popup && getSetting("revealPopup")) game.socket.emit(SOCKET, { action: "reveal", card, info });
}

/** Full-screen animated popup with the revealed card. */
export async function showRevealOverlay(card, info = {}) {
  const cardHTML = await renderCardHTML(card, { animate: animationsEnabled() });
  const text = caption(info);

  const overlay = document.createElement("div");
  overlay.className = "hcd-overlay";
  overlay.innerHTML = `
    <div class="hcd-overlay-content">
      ${cardHTML}
      ${text ? `<p class="hcd-overlay-caption">${escapeHTML(text)}</p>` : ""}
      <p class="hcd-overlay-hint">${localize("HCD.Reveal.Hint")}</p>
    </div>`;

  overlay.addEventListener("click", async (event) => {
    if (event.target.closest("a, button")) return; // let inline rolls / links work
    overlay.classList.add("hcd-closing");
    await wait(300);
    overlay.remove();
  });
  document.body.append(overlay);
}

export function onSocketMessage(data) {
  if (data?.action === "reveal") showRevealOverlay(data.card, data.info);
}
