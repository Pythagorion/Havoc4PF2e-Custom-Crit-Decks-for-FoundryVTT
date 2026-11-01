import {
  ATTACK_TYPES, CARD_TYPES, DECKS, FALLBACK_DAMAGE_TYPES, GENERAL_ONLY, ROLL_KIND_LABELS, TEMPLATES
} from "./constants.js";
import { format, getSetting, localize, setSetting, textToHTML } from "./utils.js";

/**
 * @typedef {object} CritCard
 * @property {string} id
 * @property {"hit"|"fumble"} deck
 * @property {"general"|"specific"} type
 * @property {"melee"|"ranged"|"unarmed"|"spell"|null} attackType  Specific cards only; null = any attack type.
 * @property {string|null} damageType  Specific cards only; null = any damage type. Ignored unless damage types are enabled.
 * @property {string} title
 * @property {string} effect     Plain text, may contain Foundry enrichers like [[/r 1d6]].
 * @property {boolean} enabled
 */

/**
 * @typedef {object} DrawFilter
 * @property {string|null} [attackType]   Attack type of the roll; null = any, "none" = general cards only.
 * @property {string[]} [damageTypes]     Damage types of the roll; empty = any.
 */

/** Bring arbitrary (form/imported) data into a valid card shape. */
export function normalizeCard(data = {}) {
  const specific = data.type === "specific";
  return {
    id: data.id || foundry.utils.randomID(),
    deck: data.deck in DECKS ? data.deck : "hit",
    type: specific ? "specific" : "general",
    attackType: specific && data.attackType in ATTACK_TYPES ? data.attackType : null,
    damageType: specific && data.damageType ? String(data.damageType) : null,
    title: String(data.title ?? "").trim(),
    effect: String(data.effect ?? "").trim(),
    enabled: data.enabled !== false
  };
}

/** @returns {CritCard[]} */
export function getCards() {
  return (getSetting("cards") ?? []).map(normalizeCard);
}

/** Damage types offered in the UI: PF2e's list if available, else a built-in one. */
export function getDamageTypeChoices() {
  const pf2e = CONFIG.PF2E?.damageTypes;
  if (pf2e && Object.keys(pf2e).length) return { ...pf2e };
  return Object.fromEntries(FALLBACK_DAMAGE_TYPES.map((type) => [type, `HCD.DamageType.${type}`]));
}

export function damageTypeLabel(type) {
  const key = getDamageTypeChoices()[type];
  return key ? localize(key) : type;
}

/** Whether a card may be drawn for a roll matching the filter. */
export function cardMatches(card, { attackType = null, damageTypes = [] } = {}) {
  if (card.type === "general") return true;
  if (attackType === GENERAL_ONLY) return false;
  if (attackType && card.attackType && card.attackType !== attackType) return false;
  if (getSetting("useDamageTypes") && card.damageType && damageTypes.length
    && !damageTypes.includes(card.damageType)) return false;
  return true;
}

/** All enabled cards of a deck that may be drawn for the given filter. */
export function getPool(deck, filter = {}) {
  return getCards().filter((c) => c.enabled && c.deck === deck && cardMatches(c, filter));
}

function getDiscarded(deck) {
  if (getSetting("deckBehavior") !== "discard") return new Set();
  return new Set(getSetting("discardPile")?.[deck] ?? []);
}

/** Number of cards in the pool that are not on the discard pile. */
export function countRemaining(deck, filter = {}) {
  const discarded = getDiscarded(deck);
  return getPool(deck, filter).filter((c) => !discarded.has(c.id)).length;
}

/**
 * Draw a random card.
 * @param {string} deck
 * @param {DrawFilter} filter
 * @param {Set<string>} seen      Cards already shown during this draw (skipped when possible).
 * @param {string|null} currentId Card currently shown, never drawn twice in a row if avoidable.
 * @returns {Promise<CritCard|null>}
 */
export async function drawCard(deck, filter = {}, seen = new Set(), currentId = null) {
  const pool = getPool(deck, filter);
  if (!pool.length) return null;

  const discarded = getDiscarded(deck);
  let available = pool.filter((c) => !discarded.has(c.id));
  if (!available.length) {
    await reshuffleWithNotice(deck);
    available = pool;
  }

  let fresh = available.filter((c) => !seen.has(c.id));
  if (!fresh.length) {
    seen.clear();
    if (available.length > 1) ui.notifications.info(localize("HCD.Draw.Cycled"));
    fresh = available.length > 1 ? available.filter((c) => c.id !== currentId) : available;
  }
  return fresh[Math.floor(CONFIG.Dice.randomUniform() * fresh.length)];
}

/**
 * Deal several distinct cards at once (player draw).
 * @param {string} deck
 * @param {DrawFilter} filter
 * @param {number} count
 * @param {Set<string>} avoid  Cards already dealt in this session, only used again if nothing else is left.
 * @returns {Promise<CritCard[]>}
 */
export async function dealCards(deck, filter = {}, count = 3, avoid = new Set()) {
  const pool = getPool(deck, filter);
  if (!pool.length) return [];

  const discarded = getDiscarded(deck);
  let available = pool.filter((c) => !discarded.has(c.id));
  if (available.length < Math.min(count, pool.length)) {
    await reshuffleWithNotice(deck);
    available = pool;
  }

  const fresh = shuffle(available.filter((c) => !avoid.has(c.id)));
  const seen = shuffle(available.filter((c) => avoid.has(c.id)));
  return [...fresh, ...seen].slice(0, count);
}

function shuffle(cards) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(CONFIG.Dice.randomUniform() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
  return cards;
}

async function reshuffleWithNotice(deck) {
  await reshuffle(deck);
  ui.notifications.info(format("HCD.Draw.Reshuffled", { deck: localize(DECKS[deck].label) }));
}

/** Put a revealed card on the discard pile (only in "discard" deck mode). */
export async function discardCard(deck, cardId) {
  if (getSetting("deckBehavior") !== "discard") return;
  const pile = foundry.utils.deepClone(getSetting("discardPile") ?? {});
  pile[deck] = [...new Set([...(pile[deck] ?? []), cardId])];
  await setSetting("discardPile", pile);
}

/** Clear the discard pile of one deck, or of all decks. */
export async function reshuffle(deck = null) {
  const pile = foundry.utils.deepClone(getSetting("discardPile") ?? {});
  for (const key of Object.keys(DECKS)) {
    if (!deck || deck === key) pile[key] = [];
  }
  await setSetting("discardPile", pile);
}

/**
 * Short description of what triggered a draw, e.g. "Longsword · Melee · Slashing" or "Saving Throw".
 * @param {{rollKind?: string, attackType?: string, damageTypes?: string[], info?: object}} trigger
 */
export function describeTrigger({ rollKind = "attack", attackType = null, damageTypes = [], info = {} }) {
  if (rollKind !== "attack") return localize(ROLL_KIND_LABELS[rollKind] ?? ROLL_KIND_LABELS.other);
  const parts = [info.itemName || localize(ROLL_KIND_LABELS.attack)];
  if (attackType in ATTACK_TYPES) parts.push(localize(ATTACK_TYPES[attackType]));
  if (getSetting("useDamageTypes") && damageTypes.length) parts.push(damageTypes.map(damageTypeLabel).join("/"));
  return parts.join(" · ");
}

export function cardTypeLabel(card) {
  if (card.type === "general") return localize(CARD_TYPES.general);
  const parts = [];
  if (card.attackType) parts.push(localize(ATTACK_TYPES[card.attackType]));
  if (card.damageType && getSetting("useDamageTypes")) parts.push(damageTypeLabel(card.damageType));
  return parts.join(" · ") || localize(CARD_TYPES.specific);
}

/**
 * Render a card to HTML.
 * @param {CritCard} card
 * @param {object} [options]
 * @param {boolean} [options.animate]  Play the deal & flip animation.
 * @param {boolean} [options.flat]     Compact, front-only version (chat messages).
 * @param {boolean} [options.enrich]   Run the effect through TextEditor.enrichHTML.
 * @param {string} [options.extraClasses]  Additional CSS classes for the card element.
 */
export async function renderCardHTML(card, { animate = false, flat = false, enrich = true, extraClasses = "" } = {}) {
  const deck = DECKS[card.deck] ?? DECKS.hit;
  const text = textToHTML(card.effect);
  const effectHTML = enrich
    ? await foundry.applications.ux.TextEditor.implementation.enrichHTML(text)
    : text;
  return foundry.applications.handlebars.renderTemplate(TEMPLATES.card, {
    deck: card.deck,
    icon: deck.icon,
    deckLabel: localize(deck.label),
    typeLabel: cardTypeLabel(card),
    badge: card.type === "general" ? "general" : (card.attackType ?? "any"),
    title: card.title,
    effectHTML,
    animate,
    flat,
    extraClasses
  });
}
