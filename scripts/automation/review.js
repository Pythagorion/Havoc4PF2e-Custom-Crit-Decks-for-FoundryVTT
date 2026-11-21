import { MODULE_ID, TEMPLATES } from "../constants.js";
import { getDamageTypeChoices } from "../deck.js";
import { localize } from "../utils.js";
import {
  AFFECTS, AREA_DEFAULTS, AREA_FIELDS, CENTERS, DURATIONS, MODIFIER_SELECTORS, MODIFIER_TYPES, MOVE_MODES,
  OUTCOME_FALLBACK, OUTCOMES, PICKS, RECIPIENTS, SAVES, SPEED_DISTANCES, STEP_TYPES
} from "./schema.js";
import { describeStep, planArea, resolveCreatures } from "./apply.js";

/** Editable fields of a step: those of its type, plus the area fields for area recipients. */
function fieldsOf(step) {
  const fields = { ...STEP_TYPES[step.type].fields };
  if (step.recipient === "area") Object.assign(fields, AREA_FIELDS);
  return fields;
}

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
      steps: this.#flatten(this.plan, "steps", 0).map(({ step, path, depth, heading }) => ({
        path,
        depth,
        heading,
        enabled: step.enabled,
        isNote: step.type === "note",
        icon: STEP_TYPES[step.type].icon,
        description: describeStep(step, this.creatures),
        fields: Object.entries(fieldsOf(step)).map(([key, kind]) => ({
          key,
          kind,
          label: `HCD.Auto.Field.${key}`,
          value: step[key] ?? "",
          choices: choices[kind] ?? null,
          isNumber: kind === "number" || kind === "dc",
          isBoolean: kind === "boolean"
        })),
        // Creatures found for an area step; the GM picks who is affected
        hasCandidates: Array.isArray(step.candidates),
        candidates: step.candidates?.map((c, index) => ({ index, name: c.name, checked: step.chosen?.includes(c.uuid) }))
      })),
      hasSteps: this.plan.some((s) => s.enabled && s.type !== "note")
    });
  }

  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    // Who is affected changed: find the creatures of the area again
    this.element.addEventListener("change", (event) => {
      if (!this.#editing) return;
      const match = /^(steps\.\d+)\.(recipient|center|radius|affects|pick|includeCenter|excludeTarget)$/.exec(event.target.name ?? "");
      if (!match) return;
      this.#syncFromForm();
      const step = this.#getStep(match[1]);
      if (!step) return;
      if (step.recipient === "area") {
        for (const [key, value] of Object.entries(AREA_DEFAULTS)) step[key] ??= value;
        planArea(step, this.creatures);
      } else {
        delete step.candidates;
        delete step.chosen;
      }
      this.render();
    });
  }

  /** A plan step by its form path, e.g. "steps.0" or "steps.0.outcomes.failure.1". */
  #getStep(path) {
    return path.split(".").reduce((node, key) => node?.[key], { steps: this.plan });
  }

  /**
   * The plan as a flat list: the outcome steps of a save follow it, one level deeper,
   * with the degree of success as heading. `path` is the form name prefix of a step.
   */
  #flatten(steps, prefix, depth) {
    return steps.flatMap((step, index) => {
      const path = `${prefix}.${index}`;
      const entries = [{ step, path, depth, heading: null }];
      if (step.type !== "save") return entries;
      for (const degree of OUTCOMES) {
        const children = step.outcomes?.[degree];
        if (!children?.length) continue;
        // A missing critical outcome uses this one, so name both
        const covers = Object.entries(OUTCOME_FALLBACK)
          .filter(([critical, plain]) => plain === degree && !step.outcomes[critical]?.length)
          .map(([critical]) => critical);
        const heading = [degree, ...covers].map((d) => localize(`HCD.Auto.Degree.${d}`)).join(" / ");
        this.#flatten(children, `${path}.outcomes.${degree}`, depth + 1)
          .forEach((entry, i) => entries.push(i === 0 && entry.depth === depth + 1 ? { ...entry, heading } : entry));
      }
      return entries;
    });
  }

  /** Options of the select field kinds. */
  #choices() {
    // "Target (Goblin)"; the saver and area creatures are only known later
    const withName = (entries) => Object.fromEntries(Object.entries(entries).map(([key, label]) => {
      if (!(key in CENTERS)) return [key, localize(label)];
      const creature = this.creatures[key];
      const name = creature ? (creature.token?.name ?? creature.actor.name) : localize("HCD.Auto.NoRecipient");
      return [key, `${localize(label)} (${name})`];
    }));
    const condition = Object.fromEntries(Object.entries(CONFIG.PF2E?.conditionTypes ?? {})
      .map(([slug, label]) => [slug, localize(label)])
      .sort((a, b) => a[1].localeCompare(b[1])));
    const units = canvas.scene?.grid.units || "ft";
    return {
      recipient: withName(RECIPIENTS),
      center: withName(CENTERS),
      condition,
      duration: Object.fromEntries(Object.keys(DURATIONS).map((key) => [key, `HCD.Auto.Duration.${key}`])),
      selector: MODIFIER_SELECTORS,
      modifierType: MODIFIER_TYPES,
      damageType: getDamageTypeChoices(),
      save: SAVES,
      affects: AFFECTS,
      pick: PICKS,
      moveMode: MOVE_MODES,
      distance: {
        ...Object.fromEntries([5, 10, 15, 20, 25, 30, 40, 50, 60].map((d) => [d, `${d} ${units}`])),
        ...Object.fromEntries(Object.keys(SPEED_DISTANCES).map((key) => [key, `HCD.Auto.Distance.${key}`]))
      }
    };
  }

  /** Read the edit form back into the plan. */
  #syncFromForm() {
    if (!this.#editing || !this.element) return;
    const data = foundry.utils.expandObject(new foundry.applications.ux.FormDataExtended(this.element).object);
    const merge = (steps, values = {}) => {
      for (const [index, stepValues] of Object.entries(values)) {
        const step = steps[Number(index)];
        if (!step) continue;
        const { outcomes, chosen, ...fields } = stepValues;
        Object.assign(step, fields, { enabled: !!fields.enabled });
        if (step.candidates && chosen) step.chosen = step.candidates.filter((c, i) => chosen[i]).map((c) => c.uuid);
        for (const [degree, children] of Object.entries(outcomes ?? {})) merge(step.outcomes?.[degree] ?? [], children);
      }
    };
    merge(this.plan, data.steps);
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
