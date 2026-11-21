/*
 * Data model of card automation. A card's automation is a list of plain JSON steps,
 * e.g. { type: "condition", recipient: "target", condition: "frightened", value: 1 }.
 *
 * Every step type lists its editable fields with a field kind. The review dialog builds
 * its edit form from these definitions, and a future card editor can reuse them as is:
 * a new step type only needs an entry here and an apply function in apply.js.
 */

/** Who a step is applied to. */
export const RECIPIENTS = {
  self: "HCD.Auto.Recipient.self",
  target: "HCD.Auto.Recipient.target"
};

/**
 * Effect durations. `anchor` is the creature whose turn the duration is counted on
 * ("your next turn" = self, "its next turn" = target). `next` durations end on the
 * anchor's next turn, which may still be in the current round.
 */
export const DURATIONS = {
  unlimited: { unit: "unlimited", value: -1, expiry: null },
  selfTurnEnd: { unit: "rounds", value: 0, expiry: "turn-end", anchor: "self" },
  selfNextStart: { unit: "rounds", value: 1, expiry: "turn-start", anchor: "self", next: true },
  selfNextEnd: { unit: "rounds", value: 1, expiry: "turn-end", anchor: "self", next: true },
  targetNextStart: { unit: "rounds", value: 1, expiry: "turn-start", anchor: "target", next: true },
  targetNextEnd: { unit: "rounds", value: 1, expiry: "turn-end", anchor: "target", next: true },
  minute: { unit: "minutes", value: 1, expiry: "turn-start" },
  encounter: { unit: "encounter", value: -1, expiry: null }
};

/** Statistics a modifier step can change, mapped to PF2e rule element selectors. */
export const MODIFIER_SELECTORS = {
  ac: "HCD.Auto.Selector.ac",
  "attack-roll": "HCD.Auto.Selector.attack-roll",
  damage: "HCD.Auto.Selector.damage",
  perception: "HCD.Auto.Selector.perception",
  "saving-throw": "HCD.Auto.Selector.saving-throw",
  fortitude: "HCD.Auto.Selector.fortitude",
  reflex: "HCD.Auto.Selector.reflex",
  will: "HCD.Auto.Selector.will",
  "skill-check": "HCD.Auto.Selector.skill-check",
  "all-speeds": "HCD.Auto.Selector.all-speeds"
};

export const MODIFIER_TYPES = {
  circumstance: "HCD.Auto.ModifierType.circumstance",
  status: "HCD.Auto.ModifierType.status",
  untyped: "HCD.Auto.ModifierType.untyped"
};

/** Damage type placeholder: the damage type of the triggering attack. */
export const WEAPON_DAMAGE = "weapon";

/** Checks a save step can ask for; "flat" is a flat check (success or failure only). */
export const SAVES = {
  fortitude: "HCD.Auto.Save.fortitude",
  reflex: "HCD.Auto.Save.reflex",
  will: "HCD.Auto.Save.will",
  flat: "HCD.Auto.Save.flat"
};

/**
 * Where a save's DC comes from. A step's `dc` is one of these keys or a fixed number;
 * the review dialog always shows the resolved number.
 */
export const DC_SOURCES = {
  classDC: "HCD.Auto.DC.classDC",       // class DC of the drawing creature
  spellDC: "HCD.Auto.DC.spellDC",       // spell DC of the drawing creature
  targetHard: "HCD.Auto.DC.targetHard"  // hard level-based DC for the target's level
};

/** Degrees of success, best first. Missing critical outcomes fall back to the plain ones. */
export const OUTCOMES = ["criticalSuccess", "success", "failure", "criticalFailure"];
export const OUTCOME_FALLBACK = { criticalSuccess: "success", criticalFailure: "failure" };

/**
 * Field kinds: recipient, condition, duration, selector, modifierType, damageType (select fields),
 * number, text, formula (input fields).
 */
export const STEP_TYPES = {
  condition: {
    icon: "fa-solid fa-bolt",
    fields: { recipient: "recipient", condition: "condition", value: "number", duration: "duration" },
    defaults: { recipient: "target", condition: "off-guard", value: 1, duration: "unlimited" }
  },
  modifier: {
    icon: "fa-solid fa-plus-minus",
    fields: { recipient: "recipient", selector: "selector", modifierType: "modifierType", value: "number", duration: "duration" },
    defaults: { recipient: "target", selector: "ac", modifierType: "circumstance", value: -1, duration: "unlimited" }
  },
  effect: {
    // A named effect on the token, optionally with PF2e rule elements (`rules`, not editable in the dialog)
    icon: "fa-solid fa-wand-magic-sparkles",
    fields: { recipient: "recipient", name: "text", duration: "duration" },
    defaults: { recipient: "target", name: "", duration: "unlimited", rules: [] }
  },
  damage: {
    icon: "fa-solid fa-heart-crack",
    fields: { recipient: "recipient", formula: "formula", damageType: "damageType" },
    defaults: { recipient: "target", formula: "1d6", damageType: WEAPON_DAMAGE }
  },
  persistent: {
    icon: "fa-solid fa-droplet",
    fields: { recipient: "recipient", formula: "formula", damageType: "damageType" },
    defaults: { recipient: "target", formula: "1d4", damageType: "bleed" }
  },
  note: {
    // Not applied, shown to the GM as a reminder
    icon: "fa-solid fa-note-sticky",
    fields: { text: "text" },
    defaults: { text: "" }
  },
  save: {
    // The recipient rolls; the steps of the rolled degree of success are applied afterwards.
    // `outcomes` maps OUTCOMES keys to step lists, e.g. { failure: [{ type: "condition", … }] }.
    icon: "fa-solid fa-dice-d20",
    fields: { recipient: "recipient", save: "save", dc: "dc" },
    defaults: { recipient: "target", save: "fortitude", dc: "classDC", outcomes: {} }
  }
};

/** Bring a stored step list into a valid shape; unknown step types are dropped. */
export function normalizeSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps
    .filter((step) => step?.type in STEP_TYPES)
    .map((step) => {
      const normalized = { ...foundry.utils.deepClone(STEP_TYPES[step.type].defaults), ...foundry.utils.deepClone(step) };
      if (step.type === "save") {
        normalized.outcomes = Object.fromEntries(OUTCOMES
          .filter((degree) => Array.isArray(normalized.outcomes?.[degree]))
          .map((degree) => [degree, normalizeSteps(normalized.outcomes[degree])]));
      }
      return normalized;
    });
}
