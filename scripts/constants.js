export const MODULE_ID = "havoc-critdeck";
export const SOCKET = `module.${MODULE_ID}`;

const TEMPLATE_PATH = `modules/${MODULE_ID}/templates`;
export const TEMPLATES = {
  card: `${TEMPLATE_PATH}/card.hbs`,
  draw: `${TEMPLATE_PATH}/draw-app.hbs`,
  manager: `${TEMPLATE_PATH}/card-manager.hbs`,
  prompt: `${TEMPLATE_PATH}/gm-prompt.hbs`,
  playerDraw: `${TEMPLATE_PATH}/player-draw.hbs`
};

/** Number of face-down cards dealt when players draw themselves. */
export const PLAYER_DRAW_COUNT = 3;

export const DECKS = {
  hit: { label: "HCD.Deck.hit", icon: "fa-solid fa-burst" },
  fumble: { label: "HCD.Deck.fumble", icon: "fa-solid fa-person-falling" }
};

export const CARD_TYPES = {
  general: "HCD.CardType.general",
  specific: "HCD.CardType.specific"
};

export const ATTACK_TYPES = {
  melee: "HCD.AttackType.melee",
  ranged: "HCD.AttackType.ranged",
  unarmed: "HCD.AttackType.unarmed",
  spell: "HCD.AttackType.spell"
};

/**
 * Roll kinds the triggers can be enabled for, mapped to PF2e check types
 * (flags.pf2e.context.type). Anything else with a d20 counts as "other".
 */
export const ROLL_KINDS = {
  attack: ["attack-roll", "spell-attack-roll"],
  save: ["saving-throw"],
  skill: ["skill-check", "perception-check"]
};

export const ROLL_KIND_LABELS = {
  attack: "HCD.RollKind.attack",
  save: "HCD.RollKind.save",
  skill: "HCD.RollKind.skill",
  other: "HCD.RollKind.other"
};

/** Filter value meaning "only general cards may be drawn" (rolls without an attack type). */
export const GENERAL_ONLY = "none";

/** Used when CONFIG.PF2E.damageTypes is unavailable. */
export const FALLBACK_DAMAGE_TYPES = [
  "bludgeoning", "piercing", "slashing", "acid", "cold", "electricity", "fire", "sonic",
  "force", "vitality", "void", "mental", "poison", "spirit", "bleed"
];

/** Short damage type suffixes used by PF2e's versatile traits (versatile-p, versatile-fire, ...). */
export const VERSATILE_DAMAGE = { b: "bludgeoning", p: "piercing", s: "slashing" };

/** PF2e degree of success index -> outcome key. */
export const DEGREES = ["criticalFailure", "failure", "success", "criticalSuccess"];
