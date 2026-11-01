import { ATTACK_TYPES, DECKS, GENERAL_ONLY, MODULE_ID, TEMPLATES } from "../constants.js";
import {
  cardTypeLabel, countRemaining, describeTrigger, discardCard, drawCard, getDamageTypeChoices, getPool, renderCardHTML
} from "../deck.js";
import { resolvePrompt } from "../prompt.js";
import { revealCard } from "../reveal.js";
import { animationsEnabled, format, getSetting, localize, wait } from "../utils.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Open (or focus) the GM draw window.
 * @param {object} options
 * @param {"hit"|"fumble"} options.deck
 * @param {string} [options.rollKind]          attack | save | skill | other
 * @param {string|null} [options.attackType]   null = any, "none" = general cards only
 * @param {string[]} [options.damageTypes]
 * @param {object} [options.info]              Source roll info (actorName, itemName, natural).
 * @param {string} [options.promptMessageId]   GM prompt chat message to resolve afterwards.
 */
export function openDrawApp({ deck, rollKind = "attack", attackType = null, damageTypes = [], info = {}, promptMessageId = null }) {
  if (!game.user.isGM) return ui.notifications.warn(localize("HCD.Warn.GMOnly"));
  const id = `${MODULE_ID}-draw-${promptMessageId ?? foundry.utils.randomID()}`;
  const existing = foundry.applications.instances.get(id);
  if (existing) return existing.bringToFront();
  return new CardDrawApp({ id, deck, rollKind, attackType, damageTypes, info, promptMessageId }).render({ force: true });
}

/** GM-only window: shows a drawn card and lets the GM decline, redraw, pick or reveal it. */
export class CardDrawApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: [MODULE_ID, "hcd-draw-app"],
    window: { icon: "fa-solid fa-layer-group", resizable: false },
    position: { width: 360, height: "auto" },
    actions: {
      redraw: CardDrawApp.#onRedraw,
      decline: CardDrawApp.#onDecline,
      reveal: CardDrawApp.#onReveal
    }
  };

  static PARTS = {
    main: { template: TEMPLATES.draw }
  };

  /** @type {import("../deck.js").CritCard|null} */
  card = null;

  #seen = new Set();
  #initialized = false;
  #animate = false;
  #busy = false;

  constructor(options = {}) {
    super(options);
    this.deck = options.deck in DECKS ? options.deck : "hit";
    this.rollKind = options.rollKind ?? "attack";
    this.attackType = options.attackType ?? null;
    this.damageTypes = options.damageTypes ?? [];
    this.info = options.info ?? {};
    this.promptMessageId = options.promptMessageId ?? null;
  }

  get title() {
    return localize(DECKS[this.deck].label);
  }

  /** @returns {import("../deck.js").DrawFilter} */
  get filter() {
    return { attackType: this.attackType, damageTypes: this.damageTypes };
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    if (!this.#initialized) {
      this.#initialized = true;
      await this.#drawNext();
    }

    const pool = getPool(this.deck, this.filter);
    const animate = this.#animate;
    this.#animate = false; // only animate renders caused by a new card

    const useDamageTypes = getSetting("useDamageTypes");
    return Object.assign(context, {
      deck: this.deck,
      sourceLine: this.info.actorName
        ? format("HCD.Draw.Source", { actor: this.info.actorName, details: describeTrigger(this), natural: this.info.natural })
        : "",
      cardHTML: this.card ? await renderCardHTML(this.card, { animate }) : null,
      pool: pool.map((c) => ({ id: c.id, label: `${c.title} (${cardTypeLabel(c)})`, current: c.id === this.card?.id })),
      attackChoices: { "": "HCD.AttackType.any", [GENERAL_ONLY]: "HCD.AttackType.none", ...ATTACK_TYPES },
      attackType: this.attackType ?? "",
      useDamageTypes,
      damageChoices: { "": "HCD.DamageType.any", ...getDamageTypeChoices() },
      // Several types (versatile weapons) can't be shown in a single select; they show as "any" until changed
      damageType: this.damageTypes.length === 1 ? this.damageTypes[0] : "",
      remaining: format("HCD.Draw.Remaining", { count: countRemaining(this.deck, this.filter) }),
      canRedraw: pool.length > 1
    });
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.element.querySelector("select[name=choose]")?.addEventListener("change", (event) => {
      const card = getPool(this.deck, this.filter).find((c) => c.id === event.target.value);
      if (card) this.#showCard(card);
    });
    this.element.querySelector("select[name=attackType]")?.addEventListener("change", async (event) => {
      this.attackType = event.target.value || null;
      this.#seen.clear();
      await this.#replaceCard();
    });
    this.element.querySelector("select[name=damageType]")?.addEventListener("change", async (event) => {
      this.damageTypes = event.target.value ? [event.target.value] : [];
      this.#seen.clear();
      await this.#replaceCard();
    });
  }

  async #drawNext() {
    const card = await drawCard(this.deck, this.filter, this.#seen, this.card?.id);
    this.card = card ?? null;
    if (card) this.#seen.add(card.id);
    this.#animate = animationsEnabled();
  }

  #showCard(card) {
    this.card = card;
    this.#seen.add(card.id);
    this.#animate = animationsEnabled();
    this.render();
  }

  /** Throw the current card away (animated) and draw a new one. */
  async #replaceCard() {
    if (this.#busy) return;
    this.#busy = true;
    try {
      const cardEl = this.element.querySelector(".hcd-card");
      if (cardEl && animationsEnabled()) {
        cardEl.classList.add("hcd-discard");
        await wait(350);
      }
      await this.#drawNext();
      await this.render();
    } finally {
      this.#busy = false;
    }
  }

  static async #onRedraw() {
    await this.#replaceCard();
  }

  static async #onDecline() {
    if (this.promptMessageId) await resolvePrompt(this.promptMessageId, "declined");
    await this.close();
  }

  static async #onReveal() {
    if (!this.card || this.#busy) return;
    this.#busy = true;
    try {
      await revealCard(this.card, this.info);
      await discardCard(this.deck, this.card.id);
      if (this.promptMessageId) await resolvePrompt(this.promptMessageId, "revealed", this.card.title);
      await this.close();
    } finally {
      this.#busy = false;
    }
  }
}
