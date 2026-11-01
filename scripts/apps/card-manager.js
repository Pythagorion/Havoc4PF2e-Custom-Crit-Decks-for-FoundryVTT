import { ATTACK_TYPES, CARD_TYPES, DECKS, MODULE_ID, TEMPLATES } from "../constants.js";
import { getCards, getDamageTypeChoices, normalizeCard, reshuffle } from "../deck.js";
import { getSetting, localize, setSetting } from "../utils.js";
import { openDrawApp } from "./card-draw.js";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

/** Settings menu to create, edit, delete, import and export cards. */
export class CardManager extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-card-manager`,
    tag: "form",
    classes: [MODULE_ID, "hcd-manager"],
    window: { title: "HCD.Manager.Title", icon: "fa-solid fa-layer-group", resizable: true },
    position: { width: 760, height: 780 },
    form: { handler: CardManager.#onSubmit, closeOnSubmit: false, submitOnChange: false },
    actions: {
      addCard: CardManager.#onAddCard,
      deleteCard: CardManager.#onDeleteCard,
      testDraw: CardManager.#onTestDraw,
      exportCards: CardManager.#onExport,
      importCards: CardManager.#onImport,
      reshuffle: CardManager.#onReshuffle
    }
  };

  static PARTS = {
    main: { template: TEMPLATES.manager, scrollable: [".hcd-manager-body"] }
  };

  /** Working copy of the cards; only written to the setting on save. */
  cards = null;

  #focusId = null;

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    this.cards ??= getCards();
    const indexed = this.cards.map((card, index) => ({
      ...card,
      index,
      isGeneral: card.type === "general",
      attackValue: card.attackType ?? "",
      damageValue: card.damageType ?? ""
    }));
    return Object.assign(context, {
      sections: Object.entries(DECKS).map(([deck, cfg]) => ({
        deck,
        label: localize(cfg.label),
        icon: cfg.icon,
        cards: indexed.filter((c) => c.deck === deck)
      })),
      typeChoices: CARD_TYPES,
      attackChoices: { "": "HCD.AttackType.any", ...ATTACK_TYPES },
      damageChoices: { "": "HCD.DamageType.any", ...getDamageTypeChoices() },
      useDamageTypes: getSetting("useDamageTypes"),
      discardMode: getSetting("deckBehavior") === "discard"
    });
  }

  _onRender(context, options) {
    super._onRender(context, options);
    // Attack and damage type only matter for specific cards
    for (const select of this.element.querySelectorAll("select.hcd-type-select")) {
      select.addEventListener("change", () => {
        for (const field of select.closest(".hcd-card-row").querySelectorAll("select.hcd-specific-select")) {
          field.disabled = select.value !== "specific";
        }
      });
    }
    if (this.#focusId) {
      this.element.querySelector(`.hcd-card-row[data-card-id="${this.#focusId}"] input[type=text]`)?.focus();
      this.#focusId = null;
    }
  }

  /** Read the current form state into the working copy, so re-renders keep unsaved edits. */
  #syncFromForm() {
    if (!this.element) return;
    const data = foundry.utils.expandObject(new foundry.applications.ux.FormDataExtended(this.element).object);
    this.cards = Object.entries(data.cards ?? {})
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([, card]) => normalizeCard(card));
  }

  static async #onSubmit() {
    this.#syncFromForm();
    this.cards = this.cards.filter((c) => c.title || c.effect);
    await setSetting("cards", this.cards);
    ui.notifications.info(localize("HCD.Manager.Saved"));
    this.render();
  }

  static #onAddCard(event, target) {
    this.#syncFromForm();
    const card = normalizeCard({ deck: target.dataset.deck, type: "general" });
    this.cards.push(card);
    this.#focusId = card.id;
    this.render();
  }

  static #onDeleteCard(event, target) {
    this.#syncFromForm();
    this.cards.splice(Number(target.dataset.index), 1);
    this.render();
  }

  static #onTestDraw(event, target) {
    openDrawApp({ deck: target.dataset.deck });
  }

  static #onExport() {
    this.#syncFromForm();
    foundry.utils.saveDataToFile(JSON.stringify(this.cards, null, 2), "text/json", `${MODULE_ID}-cards.json`);
  }

  static #onImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      let imported;
      try {
        imported = JSON.parse(await foundry.utils.readTextFromFile(file));
        if (!Array.isArray(imported)) throw new Error("Not an array");
      } catch (err) {
        console.error(err);
        return ui.notifications.error(localize("HCD.Manager.ImportInvalid"));
      }

      const mode = await DialogV2.wait({
        window: { title: "HCD.Manager.Import" },
        content: `<p>${game.i18n.format("HCD.Manager.ImportQuestion", { count: imported.length })}</p>`,
        buttons: [
          { action: "append", label: "HCD.Manager.ImportAppend", icon: "fa-solid fa-plus", default: true },
          { action: "replace", label: "HCD.Manager.ImportReplace", icon: "fa-solid fa-arrows-rotate" }
        ],
        rejectClose: false
      });
      if (!mode) return;

      this.#syncFromForm();
      // New ids for appended cards so they never collide with existing ones
      const cards = imported.map((c) => normalizeCard(mode === "append" ? { ...c, id: null } : c));
      this.cards = mode === "replace" ? cards : [...this.cards, ...cards];
      ui.notifications.info(game.i18n.format("HCD.Manager.Imported", { count: cards.length }));
      this.render();
    });
    input.click();
  }

  static async #onReshuffle() {
    await reshuffle();
    ui.notifications.info(localize("HCD.Manager.Reshuffled"));
  }
}
