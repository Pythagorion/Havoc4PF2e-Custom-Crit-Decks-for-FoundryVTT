/*
 * Data model of card automation. A card's automation is a list of plain JSON steps,
 * e.g. { type: "condition", recipient: "target", condition: "frightened", value: 1 }.
 *
 * Every step type lists its editable fields with a field kind. The review dialog builds
 * its edit form from these definitions, and a future card editor can reuse them as is:
 * a new step type only needs an entry here and an apply function in apply.js.
 */

/**
 * Who a step is applied to. "saver" is the creature that rolled a save (only in the
 * outcomes of a save step); "area" are the creatures found by the step's AREA_FIELDS.
 */
export const RECIPIENTS = {
  self: "HCD.Auto.Recipient.self",
  target: "HCD.Auto.Recipient.target",
  saver: "HCD.Auto.Recipient.saver",
  area: "HCD.Auto.Recipient.area"
};

/** Creatures that can be the center of an area or the origin of a movement. */
export const CENTERS = {
  self: "HCD.Auto.Recipient.self",
  target: "HCD.Auto.Recipient.target"
};

/**
 * Extra fields of steps whose recipient is "area", e.g. "each enemy within 30 feet of you"
 * = { center: "self", radius: 30, affects: "enemies", pick: "all" }. "Adjacent" is radius 5.
 * Enemies and allies are seen from the drawing creature.
 */
export const AREA_FIELDS = {
  center: "center",
  radius: "number",
  affects: "affects",
  pick: "pick",
  includeCenter: "boolean",
  excludeTarget: "boolean"
};
export const AREA_DEFAULTS = { center: "self", radius: 5, affects: "creatures", pick: "all", includeCenter: false, excludeTarget: false };

export const AFFECTS = {
  enemies: "HCD.Auto.Affects.enemies",
  allies: "HCD.Auto.Affects.allies",
  creatures: "HCD.Auto.Affects.creatures"
};

export const PICKS = {
  all: "HCD.Auto.Pick.all",
  one: "HCD.Auto.Pick.one"
};

/**
 * How a move step moves its recipient:
 * push = away from `from`, free = to any space, adjacent = to a space adjacent to `from`;
 * always at most `distance` feet from where it stands.
 */
export const MOVE_MODES = {
  push: "HCD.Auto.MoveMode.push",
  free: "HCD.Auto.MoveMode.free",
  adjacent: "HCD.Auto.MoveMode.adjacent"
};

/** Distance placeholders resolved from the moving creature's land Speed. */
export const SPEED_DISTANCES = { speed: 1, halfSpeed: 0.5 };

/**
 * Effect durations. `anchor` is the creature whose turn the duration is counted on
 * ("your next turn" = self, "its next turn" = target or recipient). `next` durations end on the
 * anchor's next turn, which may still be in the current round.
 */
export const DURATIONS = {
  unlimited: { unit: "unlimited", value: -1, expiry: null },
  selfTurnEnd: { unit: "rounds", value: 0, expiry: "turn-end", anchor: "self" },
  selfNextStart: { unit: "rounds", value: 1, expiry: "turn-start", anchor: "self", next: true },
  selfNextEnd: { unit: "rounds", value: 1, expiry: "turn-end", anchor: "self", next: true },
  targetNextStart: { unit: "rounds", value: 1, expiry: "turn-start", anchor: "target", next: true },
  targetNextEnd: { unit: "rounds", value: 1, expiry: "turn-end", anchor: "target", next: true },
  // Counted on the turn of the creature that receives the effect (area creatures, save outcomes)
  ownNextStart: { unit: "rounds", value: 1, expiry: "turn-start", anchor: "recipient", next: true },
  ownNextEnd: { unit: "rounds", value: 1, expiry: "turn-end", anchor: "recipient", next: true },
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
 * Field kinds: recipient, condition, duration, selector, modifierType, damageType, save, center,
 * affects, pick, moveMode (select fields), number, dc, distance (number inputs), text, formula
 * (text inputs), boolean (checkbox).
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
  },
  move: {
    // The GM places a marker on one of the highlighted spaces; `distance` may be a SPEED_DISTANCES key
    icon: "fa-solid fa-arrows-up-down-left-right",
    fields: { recipient: "recipient", mode: "moveMode", from: "center", distance: "distance" },
    defaults: { recipient: "target", mode: "push", from: "self", distance: 5 }
  }
};

/** Bring a stored step list into a valid shape; unknown step types are dropped. */
export function normalizeSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps
    .filter((step) => step?.type in STEP_TYPES)
    .map((step) => {
      const defaults = { ...STEP_TYPES[step.type].defaults, ...(step.recipient === "area" ? AREA_DEFAULTS : {}) };
      const normalized = { ...foundry.utils.deepClone(defaults), ...foundry.utils.deepClone(step) };
      if (step.type === "save") {
        normalized.outcomes = Object.fromEntries(OUTCOMES
          .filter((degree) => Array.isArray(normalized.outcomes?.[degree]))
          .map((degree) => [degree, normalizeSteps(normalized.outcomes[degree])]));
      }
      return normalized;
    });
}
