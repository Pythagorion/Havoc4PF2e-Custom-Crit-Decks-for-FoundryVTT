import { DECKS, MODULE_ID, PLAYER_DRAW_COUNT, SOCKET, TEMPLATES } from "./constants.js";
import { dealCards, describeTrigger, discardCard, renderCardHTML } from "./deck.js";
import { resolvePrompt } from "./prompt.js";
import { revealCard } from "./reveal.js";
import { openDrawApp } from "./apps/card-draw.js";
import { animationsEnabled, format, getSetting, localize, wait } from "./utils.js";

/*
 * Player draw: a number of cards is dealt face down in front of everyone and the
 * rolling player picks one. The GM client that started the draw owns the session
 * (including the hidden card texts); all other clients only receive a public state
 * in which face-down cards carry no card data.
 */

/** GM side: full sessions, keyed by id. */
const sessions = new Map();
/** All clients: open overlays, keyed by session id. */
const overlays = new Map();

/** Start a draw the way the module settings want it: GM draw window or player draw. */
export function beginDraw(trigger) {
  if (getSetting("playerDraw")) return startPlayerDraw(trigger);
  return openDrawApp(trigger);
}

/* -------------------------------------------- */
/*  GM side                                     */
/* -------------------------------------------- */

export async function startPlayerDraw({ deck, rollKind = "attack", attackType = null, damageTypes = [], info = {}, promptMessageId = null }) {
  if (!game.user.isGM) return ui.notifications.warn(localize("HCD.Warn.GMOnly"));
  const session = {
    id: foundry.utils.randomID(),
    deck,
    rollKind,
    attackType,
    damageTypes,
    filter: { attackType, damageTypes },
    info,
    promptMessageId,
    chooserId: findChooser(info),
    seen: new Set(),
    slots: [],
    phase: "choosing",
    dealId: 0,
    revealedIndex: null
  };
  if (!(await deal(session))) return ui.notifications.warn(localize("HCD.Draw.Empty"));
  sessions.set(session.id, session);
  if (promptMessageId) await resolvePrompt(promptMessageId, "playerDrawing");
  broadcast(session);
}

/** The rolling player, an active player owning the actor, or the GM as fallback. */
function findChooser(info) {
  const author = game.users.get(info.userId);
  if (author?.active && !author.isGM) return author.id;
  const actor = info.actorUuid ? fromUuidSync(info.actorUuid) : null;
  const owner = actor && game.users.find((u) => u.active && !u.isGM && actor.testUserPermission(u, "OWNER"));
  return owner?.id ?? game.user.id;
}

async function deal(session) {
  const cards = await dealCards(session.deck, session.filter, PLAYER_DRAW_COUNT, session.seen);
  if (!cards.length) return false;
  for (const card of cards) session.seen.add(card.id);
  session.slots = cards.map((card) => ({ card, state: "hidden" }));
  session.phase = "choosing";
  session.revealedIndex = null;
  session.dealId++;
  return true;
}

/** The chooser may pick; a GM may pick for them if they disconnected. */
function mayChoose(session, userId) {
  if (userId === session.chooserId) return true;
  return !!game.users.get(userId)?.isGM && !game.users.get(session.chooserId)?.active;
}

function handleChoose(session, slotIndex, userId) {
  if (session.phase !== "choosing" || !mayChoose(session, userId)) return;
  const slot = session.slots[slotIndex];
  if (slot?.state !== "hidden") return;
  slot.state = "revealed";
  session.phase = "revealed";
  session.revealedIndex = slotIndex;
  broadcast(session);
}

async function handleControl(session, action, userId) {
  if (!game.users.get(userId)?.isGM || session.busy) return;
  session.busy = true;
  try {
    switch (action) {
      case "accept": {
        if (session.phase !== "revealed") return;
        const card = session.slots[session.revealedIndex].card;
        session.phase = "done";
        broadcast(session);
        sessions.delete(session.id);
        await revealCard(card, session.info, { popup: false });
        await discardCard(session.deck, card.id);
        if (session.promptMessageId) await resolvePrompt(session.promptMessageId, "revealed", card.title);
        break;
      }
      case "again": {
        if (session.phase !== "revealed" || !session.slots.some((s) => s.state === "hidden")) return;
        session.slots[session.revealedIndex].state = "rejected";
        session.phase = "choosing";
        session.revealedIndex = null;
        broadcast(session);
        break;
      }
      case "redeal": {
        if (await deal(session)) broadcast(session);
        else ui.notifications.warn(localize("HCD.Draw.Empty"));
        break;
      }
      case "cancel": {
        session.phase = "cancelled";
        broadcast(session);
        sessions.delete(session.id);
        if (session.promptMessageId) await resolvePrompt(session.promptMessageId, "declined");
        break;
      }
    }
  } finally {
    session.busy = false;
  }
}

/** State sent to every client. Face-down cards carry no card data. */
function publicState(session) {
  return {
    id: session.id,
    deck: session.deck,
    rollKind: session.rollKind,
    attackType: session.attackType,
    damageTypes: session.damageTypes,
    info: session.info,
    chooserId: session.chooserId,
    phase: session.phase,
    dealId: session.dealId,
    slots: session.slots.map((s) => ({ state: s.state, card: s.state === "hidden" ? null : s.card }))
  };
}

function broadcast(session) {
  const state = publicState(session);
  game.socket.emit(SOCKET, { action: "pd-state", state });
  showState(state);
}

/* -------------------------------------------- */
/*  Requests (any client -> session owner)      */
/* -------------------------------------------- */

function requestChoose(sessionId, slot) {
  const session = sessions.get(sessionId);
  if (session) handleChoose(session, slot, game.user.id);
  else game.socket.emit(SOCKET, { action: "pd-choose", sessionId, slot, userId: game.user.id });
}

function requestControl(sessionId, control) {
  const session = sessions.get(sessionId);
  if (session) handleControl(session, control, game.user.id);
  else game.socket.emit(SOCKET, { action: "pd-control", sessionId, control, userId: game.user.id });
}

/** Socket handler for all player draw messages. */
export function onPlayerDrawSocket(data) {
  switch (data.action) {
    case "pd-state":
      return showState(data.state);
    case "pd-choose": {
      const session = sessions.get(data.sessionId);
      if (session) handleChoose(session, data.slot, data.userId);
      return;
    }
    case "pd-control": {
      const session = sessions.get(data.sessionId);
      if (session) handleControl(session, data.control, data.userId);
    }
  }
}

/* -------------------------------------------- */
/*  Overlay (all clients)                       */
/* -------------------------------------------- */

function showState(state) {
  let overlay = overlays.get(state.id);
  if (!overlay) {
    if (state.phase === "cancelled") return;
    overlay = new PlayerDrawOverlay(state.id);
    overlays.set(state.id, overlay);
  }
  overlay.update(state);
}

class PlayerDrawOverlay {
  /** @type {object|null} Last rendered state, used to decide which animations to play. */
  #previous = null;
  #queue = Promise.resolve();
  #closing = false;

  constructor(id) {
    this.id = id;
    this.element = document.createElement("div");
    this.element.className = "hcd-overlay hcd-pd-overlay";
    this.element.addEventListener("click", this.#onClick.bind(this));
    document.body.append(this.element);
  }

  update(state) {
    // Renders are async; queue them so states never apply out of order
    this.#queue = this.#queue.then(() => this.#render(state)).catch((err) => console.error(`${MODULE_ID} |`, err));
  }

  async #render(state) {
    if (this.#closing) return;
    if (state.phase === "cancelled") return this.close();

    const previous = this.#previous;
    this.#previous = state;
    const newDeal = previous?.dealId !== state.dealId;
    const animate = animationsEnabled();
    const isChooser = state.chooserId === game.user.id
      || (game.user.isGM && !game.users.get(state.chooserId)?.active);
    const canChoose = state.phase === "choosing" && isChooser;

    const slots = await Promise.all(state.slots.map(async (slot, index) => {
      const hidden = slot.state === "hidden";
      const justRevealed = !newDeal && !hidden && previous?.slots[index]?.state === "hidden";
      const classes = [];
      if (hidden) classes.push("hcd-facedown");
      if (newDeal && animate) classes.push("hcd-dealt");
      if (justRevealed && animate) classes.push("hcd-flipping");
      if (slot.state === "rejected" || (state.phase === "done" && slot.state !== "revealed")) classes.push("hcd-unchosen");
      const card = slot.card ?? { deck: state.deck, type: "general", title: "", effect: "" };
      return {
        index,
        choosable: canChoose && hidden,
        rejected: slot.state === "rejected",
        html: await renderCardHTML(card, { enrich: !hidden, extraClasses: classes.join(" ") })
      };
    }));

    const deckLabel = localize(DECKS[state.deck].label);
    const chooserName = game.users.get(state.chooserId)?.name ?? "";
    this.element.innerHTML = await foundry.applications.handlebars.renderTemplate(TEMPLATES.playerDraw, {
      deck: state.deck,
      icon: DECKS[state.deck].icon,
      title: state.info.actorName
        ? format("HCD.PlayerDraw.Title", { actor: state.info.actorName, deck: deckLabel })
        : deckLabel,
      details: state.info.actorName ? `${describeTrigger(state)} · ${format("HCD.PlayerDraw.Natural", { natural: state.info.natural })}` : "",
      slots,
      status: this.#statusText(state, isChooser, chooserName),
      canHide: !game.user.isGM && state.phase !== "done",
      controls: game.user.isGM ? this.#controls(state) : []
    });
    this.element.classList.toggle("hcd-pd-done", state.phase === "done");

    if (state.phase === "done") {
      await wait(5000);
      this.close();
    }
  }

  #statusText(state, isChooser, chooserName) {
    switch (state.phase) {
      case "choosing":
        return isChooser ? localize("HCD.PlayerDraw.ChooseYou") : format("HCD.PlayerDraw.Choosing", { name: chooserName });
      case "revealed":
        return game.user.isGM ? localize("HCD.PlayerDraw.RevealedGM") : localize("HCD.PlayerDraw.Revealed");
      case "done":
        return localize("HCD.PlayerDraw.Accepted");
      default:
        return "";
    }
  }

  #controls(state) {
    const redeal = { action: "redeal", icon: "fa-solid fa-layer-group", label: "HCD.PlayerDraw.Redeal" };
    const cancel = { action: "cancel", icon: "fa-solid fa-ban", label: "HCD.PlayerDraw.Cancel" };
    if (state.phase === "choosing") return [redeal, cancel];
    if (state.phase !== "revealed") return [];
    const controls = [{ action: "accept", icon: "fa-solid fa-check", label: "HCD.PlayerDraw.Accept", primary: true }];
    if (state.slots.some((s) => s.state === "hidden")) {
      controls.push({ action: "again", icon: "fa-solid fa-hand-pointer", label: "HCD.PlayerDraw.Again" });
    }
    controls.push(redeal, cancel);
    return controls;
  }

  #onClick(event) {
    if (event.target.closest("a.inline-roll, a.content-link")) return;
    const state = this.#previous;
    if (!state) return;

    const control = event.target.closest("[data-pd-action]");
    if (control) return requestControl(this.id, control.dataset.pdAction);

    if (event.target.closest("[data-pd-hide]") || state.phase === "done") return this.close();

    const slot = event.target.closest(".hcd-can-choose");
    if (slot) {
      this.element.querySelectorAll(".hcd-can-choose").forEach((el) => el.classList.remove("hcd-can-choose"));
      requestChoose(this.id, Number(slot.dataset.slot));
    }
  }

  async close() {
    if (this.#closing) return;
    this.#closing = true;
    overlays.delete(this.id);
    this.element.classList.add("hcd-closing");
    await wait(300);
    this.element.remove();
  }
}
