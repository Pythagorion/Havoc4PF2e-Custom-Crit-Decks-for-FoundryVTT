import { MODULE_ID, TEMPLATES } from "../constants.js";
import { getDamageTypeChoices } from "../deck.js";
import { localize } from "../utils.js";
import { DURATIONS, MODIFIER_SELECTORS, MODIFIER_TYPES, RECIPIENTS, STEP_TYPES } from "./schema.js";
import { describeStep, resolveCreatures } from "./apply.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * GM window listing what a card is about to apply. The GM applies the plan as shown,
 * edits it first, or skips the automation (the card then stays plain text).
 */
export class AutomationReview extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: [MODULE_ID, "hcd-review"],
    tag: "form",
    window: { title: "HCD.Auto.Review.Title", icon: "fa-solid fa-list-check" },
    position: { width: 480, height: "auto" },
    actions: {
      apply: AutomationReview.#onApply,
      edit: AutomationReview.#onEdit,
      skip: AutomationReview.#onSkip
    }
  };

  static PARTS = {
    main: { template: TEMPLATES.review }
  };

  /**
   * Show the review and wait for the GM.
   * @returns {Promise<object[]|null>}  The (edited) plan to apply, or null if skipped.
   */
  static wait({ card, plan, info }) {
    return new Promise((resolve) => new AutomationReview({ card, plan, info, resolve }).render({ force: true }));
  }

  #resolve;
  #editing = false;

  constructor(options = {}) {
    super(options);
    this.card = options.card;
    this.plan = foundry.utils.deepClone(options.plan);
    this.creatures = resolveCreatures(options.info);
    this.#resolve = options.resolve;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const choices = this.#choices();
    return Object.assign(context, {
      title: this.card.title,
      editing: this.#editing,
      steps: this.plan.map((step, index) => ({
        index,
        enabled: step.enabled,
        isNote: step.type === "note",
        icon: STEP_TYPES[step.type].icon,
        description: describeStep(step, this.creatures),
        fields: Object.entries(STEP_TYPES[step.type].fields).map(([key, kind]) => ({
          key,
          kind,
          label: `HCD.Auto.Field.${key}`,
          value: step[key] ?? "",
          choices: choices[kind] ?? null,
          isNumber: kind === "number"
        }))
      })),
      hasSteps: this.plan.some((s) => s.enabled && s.type !== "note")
    });
  }

  /** Options of the select field kinds. */
  #choices() {
    const recipient = Object.fromEntries(Object.entries(RECIPIENTS).map(([key, label]) => {
      const name = this.creatures[key]?.actor.name ?? localize("HCD.Auto.NoRecipient");
      return [key, `${localize(label)} (${name})`];
    }));
    const condition = Object.fromEntries(Object.entries(CONFIG.PF2E?.conditionTypes ?? {})
      .map(([slug, label]) => [slug, localize(label)])
      .sort((a, b) => a[1].localeCompare(b[1])));
    return {
      recipient,
      condition,
      duration: Object.fromEntries(Object.keys(DURATIONS).map((key) => [key, `HCD.Auto.Duration.${key}`])),
      selector: MODIFIER_SELECTORS,
      modifierType: MODIFIER_TYPES,
      damageType: getDamageTypeChoices()
    };
  }

  /** Read the edit form back into the plan. */
  #syncFromForm() {
    if (!this.#editing || !this.element) return;
    const data = foundry.utils.expandObject(new foundry.applications.ux.FormDataExtended(this.element).object);
    for (const [index, values] of Object.entries(data.steps ?? {})) {
      const step = this.plan[Number(index)];
      if (step) Object.assign(step, values, { enabled: !!values.enabled });
    }
  }

  static #onApply() {
    this.#syncFromForm();
    this.#finish(this.plan);
  }

  static #onEdit() {
    this.#editing = true;
    this.render();
  }

  static #onSkip() {
    this.#finish(null);
  }

  #finish(result) {
    this.#resolve?.(result);
    this.#resolve = null;
    this.close();
  }

  _onClose(options) {
    super._onClose(options);
    this.#resolve?.(null); // closing the window counts as skipping
    this.#resolve = null;
  }
}
