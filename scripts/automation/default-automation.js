/**
 * Automation of the cards shipped with the module, keyed by card id. Kept apart from
 * DEFAULT_CARDS so that worlds which stored the cards in an older version still get it.
 * A card's own `automation` list (custom cards, later) takes precedence over this.
 *
 * Effects without a `name` are named after the card. Parts of a card that can't be
 * automated (items, terrain, reactions, "the next roll only") get a reminder note.
 */

/** Reminder: the rest of the card is applied by hand. */
const MANUAL = { type: "note", text: "HCD.Auto.Notes.manual" };
/** Reminder: a modifier that only counts for one roll. */
const NEXT_ROLL_ONLY = { type: "note", text: "HCD.Auto.Notes.nextRollOnly" };
const BLEED_LINKED = { type: "note", text: "HCD.Auto.Notes.bleedLinked" };

export const DEFAULT_AUTOMATION = {
  // Witching Hour
  hcdHitGeneral001: [{ type: "condition", recipient: "target", condition: "frightened", value: 1 }],
  // On Unstable Grounds
  hcdHitGeneral002: [{ type: "condition", recipient: "target", condition: "off-guard", duration: "selfNextStart" }],
  // Advantage is on your Side
  hcdHitGeneral003: [
    { type: "modifier", recipient: "self", selector: "attack-roll", modifierType: "circumstance", value: 1, duration: "selfTurnEnd" },
    { type: "note", text: "HCD.Auto.Notes.nextStrikeOnly" }
  ],
  // Miracle of an Obstacle
  hcdHitGeneral006: [{ type: "condition", recipient: "target", condition: "prone" }],
  // Ringing Ears
  hcdHitGeneral008: [{ type: "condition", recipient: "target", condition: "deafened", duration: "targetNextEnd" }],
  // No Time to React
  hcdHitGeneral009: [{ type: "effect", recipient: "target", name: "HCD.Auto.Effects.noReactions", duration: "targetNextStart" }],
  // Dominant Aura
  hcdHitGeneral007: [{
    type: "save", recipient: "area", center: "self", radius: 60, affects: "enemies", excludeTarget: true,
    save: "will", dc: "classDC",
    outcomes: { failure: [{ type: "condition", recipient: "saver", condition: "slowed", value: 2 }] }
  }],
  // Battle Cry
  hcdHitGeneral019: [{
    type: "modifier", recipient: "area", center: "self", radius: 30, affects: "allies",
    selector: "attack-roll", modifierType: "status", value: 1, duration: "selfNextStart"
  }],
  // Demoralizing Display
  hcdHitGeneral021: [{
    type: "save", recipient: "area", center: "self", radius: 30, affects: "enemies",
    save: "will", dc: "classDC",
    outcomes: { failure: [{ type: "condition", recipient: "saver", condition: "frightened", value: 1 }] }
  }],
  // Startled Ranks
  hcdHitGeneral022: [{
    type: "condition", recipient: "area", center: "target", radius: 5, affects: "enemies", pick: "one",
    condition: "off-guard", duration: "selfNextStart"
  }],
  // Seize the Moment
  hcdHitGeneral031: [{
    type: "move", recipient: "area", center: "self", radius: 30, affects: "allies", pick: "one",
    mode: "free", distance: "halfSpeed"
  }],
  // Domino Effect
  hcdHitGeneral032: [{
    type: "save", recipient: "area", center: "target", radius: 5, affects: "enemies", excludeTarget: true, pick: "one",
    save: "reflex", dc: "classDC",
    outcomes: { failure: [{ type: "condition", recipient: "saver", condition: "prone" }] }
  }],
  // Drive Back
  hcdHitMelee00002: [
    { type: "move", recipient: "target", mode: "push", from: "self", distance: 5 },
    { type: "move", recipient: "self", mode: "free", distance: 5 }
  ],
  // Hook and Pull
  hcdHitMelee00005: [
    { type: "move", recipient: "target", mode: "adjacent", from: "self", distance: 5 },
    { type: "note", text: "HCD.Auto.Notes.noReactionsForced" }
  ],
  // Knocked Back
  hcdHitBludgeon06: [
    { type: "move", recipient: "target", mode: "push", from: "self", distance: 10 },
    { type: "note", text: "HCD.Auto.Notes.collisionDamage" }
  ],
  // Covering Fire
  hcdHitRanged0006: [{
    type: "move", recipient: "area", center: "target", radius: 5, affects: "allies", pick: "one",
    mode: "free", distance: 5
  }],
  // Redirected Force
  hcdHitUnarmed008: [
    { type: "move", recipient: "target", mode: "adjacent", from: "self", distance: 5 },
    { type: "note", text: "HCD.Auto.Notes.noReactionsForced" }
  ],
  // Kinetic Shove
  hcdHitSpell00011: [
    { type: "move", recipient: "target", mode: "push", from: "self", distance: 10 },
    { type: "note", text: "HCD.Auto.Notes.noReactionsForced" }
  ],
  // Shockwave
  hcdHitSpell00019: [{
    type: "save", recipient: "area", center: "target", radius: 5, affects: "creatures",
    save: "fortitude", dc: "spellDC",
    outcomes: { failure: [{ type: "move", recipient: "saver", mode: "push", from: "target", distance: 5 }] }
  }],
  // Gut Instinct
  hcdHitGeneral012: [{
    type: "save", recipient: "target", save: "fortitude", dc: "classDC",
    outcomes: { failure: [{ type: "condition", recipient: "target", condition: "sickened", value: 1 }] }
  }],
  // Exhausting Blow
  hcdHitGeneral026: [{
    type: "save", recipient: "target", save: "fortitude", dc: "classDC",
    outcomes: { failure: [{ type: "condition", recipient: "target", condition: "fatigued", duration: "minute" }] }
  }],
  // Concussion
  hcdHitBludgeon02: [{
    type: "save", recipient: "target", save: "fortitude", dc: "classDC",
    outcomes: { failure: [{ type: "condition", recipient: "target", condition: "stunned", value: 1 }] }
  }],
  // Leg Sweep
  hcdHitUnarmed004: [{
    type: "save", recipient: "target", save: "reflex", dc: "classDC",
    outcomes: { failure: [{ type: "condition", recipient: "target", condition: "prone" }] }
  }],
  // Withering Touch
  hcdHitSpell00010: [{
    type: "save", recipient: "target", save: "fortitude", dc: "spellDC",
    outcomes: { failure: [{ type: "condition", recipient: "target", condition: "drained", value: 1 }] }
  }],
  // Soul Rattle
  hcdHitSpell00016: [{
    type: "save", recipient: "target", save: "will", dc: "spellDC",
    outcomes: { failure: [{ type: "condition", recipient: "target", condition: "frightened", value: 1 }] }
  }],

  // Torn Strap
  hcdFumGeneral028: [{ type: "modifier", recipient: "self", selector: "ac", modifierType: "circumstance", value: -1 }],
  // Slipped Helmet
  hcdFumGeneral029: [{ type: "modifier", recipient: "self", selector: "perception", modifierType: "circumstance", value: -2 }],
  // Pulled Muscle
  hcdFumGeneral030: [{ type: "condition", recipient: "self", condition: "enfeebled", value: 1 }],
  // It's just a Flesh Wound
  hcdFumMelee00002: [
    { type: "damage", recipient: "self", formula: "1d6", damageType: "weapon" },
    { type: "persistent", recipient: "self", formula: "1", damageType: "bleed" }
  ],
  // Like a Papercut
  hcdFumMelee00006: [{ type: "persistent", recipient: "self", formula: "1d4", damageType: "bleed" }],
  // Overextended
  hcdFumGeneral011: [{ type: "move", recipient: "target", mode: "free", distance: 5 }],
  // Bumped Ally
  hcdFumGeneral023: [{
    type: "save", recipient: "area", center: "self", radius: 5, affects: "allies", pick: "one",
    save: "reflex", dc: "classDC",
    outcomes: { failure: [{ type: "condition", recipient: "saver", condition: "off-guard", duration: "ownNextStart" }] }
  }],
  // Distracting Blunder
  hcdFumGeneral024: [{
    type: "modifier", recipient: "area", center: "self", radius: 10, affects: "allies",
    selector: "perception", modifierType: "circumstance", value: -1, duration: "selfNextStart"
  }],
  // Enemy Rally
  hcdFumGeneral026: [
    {
      type: "move", recipient: "area", center: "self", radius: 30, affects: "enemies", excludeTarget: true, pick: "one",
      mode: "free", distance: "halfSpeed"
    },
    { type: "note", text: "HCD.Auto.Notes.reactionStride" }
  ],
  // Mixed Signals
  hcdFumGeneral033: [{
    type: "save", recipient: "area", center: "self", radius: 5, affects: "allies", pick: "one",
    save: "will", dc: "classDC",
    outcomes: { failure: [{ type: "effect", recipient: "saver", name: "HCD.Auto.Effects.noReactions", duration: "ownNextStart" }] }
  }],
  // Overswing
  hcdFumMelee00008: [
    { type: "move", recipient: "self", mode: "free", distance: 5 },
    { type: "note", text: "HCD.Auto.Notes.triggersReactions" }
  ],
  // Rebound
  hcdFumBludgeon03: [
    { type: "move", recipient: "self", mode: "push", from: "target", distance: 5 },
    { type: "note", text: "HCD.Auto.Notes.triggersReactions" }
  ],
  // Thrown Off
  hcdFumUnarmed007: [
    { type: "move", recipient: "self", mode: "adjacent", from: "target", distance: 5 },
    { type: "note", text: "HCD.Auto.Notes.noReactionsForced" }
  ],
  // Toxic Fumes
  hcdFumSpell00016: [{
    type: "save", recipient: "area", center: "self", radius: 5, affects: "creatures", includeCenter: true,
    save: "fortitude", dc: "spellDC",
    outcomes: { failure: [{ type: "condition", recipient: "saver", condition: "sickened", value: 1 }] }
  }],
  // Recoil
  hcdFumSpell00018: [
    { type: "move", recipient: "self", mode: "push", from: "target", distance: 5 },
    { type: "note", text: "HCD.Auto.Notes.noReactionsForced" }
  ],
  // Too Much Power
  hcdFumGeneral035: [{
    type: "save", recipient: "self", save: "reflex", dc: "targetHard",
    outcomes: { failure: [{ type: "note", text: "HCD.Auto.Notes.weaponBroken" }] }
  }],
  // Heavy Momentum
  hcdFumBludgeon02: [{
    type: "save", recipient: "self", save: "flat", dc: 11,
    outcomes: { failure: [{ type: "condition", recipient: "self", condition: "prone" }] }
  }],
  // Draining Echo
  hcdFumSpell00008: [{
    type: "save", recipient: "self", save: "fortitude", dc: "spellDC",
    outcomes: { failure: [{ type: "condition", recipient: "self", condition: "drained", value: 1 }] }
  }],

  /* ---------- Critical Hit – general ---------- */

  // Cautious Movements
  hcdHitGeneral004: [{ type: "effect", recipient: "self", duration: "selfTurnEnd" }, MANUAL],
  // In a Rage
  hcdHitGeneral005: [{ type: "effect", recipient: "target" }, MANUAL],
  // Lost in Thought: the Sustain branch is the alternative
  hcdHitGeneral010: [
    { type: "condition", recipient: "target", condition: "stupefied", value: 1, duration: "targetNextEnd" },
    {
      type: "save", recipient: "target", save: "will", dc: "classDC", enabled: false,
      outcomes: { failure: [{ type: "note", text: "HCD.Auto.Notes.sustainEnds" }] }
    }
  ],
  // In the Spotlight
  hcdHitGeneral011: [{
    type: "modifier", recipient: "target", selector: "attack-roll", modifierType: "circumstance", value: -2,
    against: "notSelf", duration: "targetNextEnd"
  }],
  // No Way Out
  hcdHitGeneral013: [{ type: "effect", recipient: "target", duration: "targetNextEnd" }],
  // Like the Nibelung Saga
  hcdHitGeneral014: [{ type: "effect", recipient: "target", duration: "selfNextEnd" }, MANUAL],
  // Momentum of Adrenaline
  hcdHitGeneral015: [{ type: "heal", recipient: "self", formula: "@level" }],
  // Solid as a Rock
  hcdHitGeneral016: [{ type: "modifier", recipient: "self", selector: "ac", modifierType: "circumstance", value: 1, duration: "selfNextStart" }],
  // At the Right Time
  hcdHitGeneral017: [{ type: "move", recipient: "self", mode: "free", distance: 5 }],
  // A Boost for Body & Soul
  hcdHitGeneral018: [{
    type: "tempHP", recipient: "area", center: "self", radius: 30, affects: "allies", pick: "one",
    formula: "@level", duration: "minute"
  }],
  // Steadying Example: the bonus is the alternative if no ally is Frightened
  hcdHitGeneral020: [
    { type: "reduceCondition", recipient: "area", center: "self", radius: 30, affects: "allies", pick: "one", condition: "frightened", value: 1 },
    {
      type: "modifier", recipient: "area", center: "self", radius: 30, affects: "allies", pick: "one", enabled: false,
      selector: "attack-roll", modifierType: "status", value: 1, duration: "ownNextEnd"
    },
    NEXT_ROLL_ONLY
  ],
  // Shaken Grip
  hcdHitGeneral023: [{ type: "modifier", recipient: "target", selector: "damage", modifierType: "circumstance", value: -1, duration: "targetNextEnd" }],
  // Unsteady
  hcdHitGeneral024: [{ type: "modifier", recipient: "target", selector: "reflex", modifierType: "circumstance", value: -2, duration: "selfNextEnd" }],
  // Lasting Impression
  hcdHitGeneral025: [{ type: "condition", recipient: "target", condition: "frightened", value: 1 }, MANUAL],
  // Read the Fight: the bonus is the alternative if the target has no weaknesses or resistances
  hcdHitGeneral027: [
    MANUAL,
    {
      type: "modifier", recipient: "self", selector: "attack-roll", modifierType: "circumstance", value: 1,
      against: "target", duration: "selfNextEnd", enabled: false
    }
  ],
  // Heroic Moment: the temporary Hit Points are the alternative if the character has Hero Points
  hcdHitGeneral028: [
    { type: "note", text: "HCD.Auto.Notes.heroPoint" },
    { type: "tempHP", recipient: "self", formula: "@level", duration: "minute", enabled: false }
  ],
  // Turn of the Tide
  hcdHitGeneral029: [{
    type: "modifier", recipient: "area", center: "self", radius: 30, affects: "allies",
    selector: "saving-throw", modifierType: "status", value: 1, duration: "selfNextStart"
  }],
  // Shoulder to Shoulder
  hcdHitGeneral030: [{
    type: "modifier", recipient: "area", center: "self", radius: 5, affects: "allies", pick: "one",
    selector: "ac", modifierType: "circumstance", value: 1, duration: "selfNextStart"
  }],
  // Wavering Line
  hcdHitGeneral033: [{
    type: "modifier", recipient: "area", center: "target", radius: 5, affects: "enemies",
    selector: "attack-roll", modifierType: "circumstance", value: -1, duration: "selfNextStart"
  }],
  // Shatter your Enemy like Glass
  hcdHitGeneral034: [MANUAL],

  /* ---------- Critical Hit – specific ---------- */

  // Deep Cut
  hcdHitMelee00001: [{ type: "persistent", recipient: "target", formula: "1d6", damageType: "bleed" }],
  // Disarming Swing
  hcdHitMelee00003: [{
    type: "save", recipient: "target", save: "reflex", dc: "classDC",
    outcomes: { failure: [{ type: "note", text: "HCD.Auto.Notes.dropWeapon" }] }
  }],
  // Shield Breaker
  hcdHitMelee00004: [{ type: "condition", recipient: "target", condition: "off-guard", duration: "selfNextStart" }, MANUAL],
  // Lingering Threat
  hcdHitMelee00006: [{ type: "effect", recipient: "target", duration: "selfNextStart" }, MANUAL],
  // Brow Cut
  hcdHitSlashing03: [
    { type: "persistent", recipient: "target", formula: "1", damageType: "bleed" },
    { type: "condition", recipient: "target", condition: "dazzled" },
    BLEED_LINKED
  ],
  // Cut Purse
  hcdHitSlashing04: [MANUAL],
  // Rattled Senses
  hcdHitBludgeon04: [{ type: "condition", recipient: "target", condition: "stupefied", value: 1, duration: "targetNextEnd" }],
  // Cracked Ribs
  hcdHitBludgeon05: [{ type: "effect", recipient: "target", duration: "targetNextEnd" }, MANUAL],
  // Vital Spot
  hcdHitPiercing03: [{ type: "damage", recipient: "target", formula: "1d6[precision]", damageType: "weapon" }],
  // Lodged Projectile
  hcdHitPiercing04: [{ type: "condition", recipient: "target", condition: "clumsy", value: 1 }, MANUAL],
  // Keep at Bay
  hcdHitPiercing05: [{ type: "effect", recipient: "target", duration: "selfNextStart" }, MANUAL],
  // Gap in the Armour
  hcdHitPiercing06: [{ type: "modifier", recipient: "target", selector: "ac", modifierType: "circumstance", value: -1, duration: "selfNextEnd" }],
  // Riposte Stance
  hcdHitPiercing07: [{
    type: "modifier", recipient: "self", selector: "ac", modifierType: "circumstance", value: 2,
    against: "target", duration: "selfNextStart"
  }],
  // Severed Strap
  hcdHitSlashing01: [{ type: "modifier", recipient: "target", selector: "ac", modifierType: "circumstance", value: -1 }],
  // Hamstrung
  hcdHitSlashing02: [
    { type: "persistent", recipient: "target", formula: "1d4", damageType: "bleed" },
    { type: "modifier", recipient: "target", selector: "all-speeds", modifierType: "status", value: -5 },
    BLEED_LINKED
  ],
  // Numbed Arm
  hcdHitBludgeon03: [{ type: "effect", recipient: "target", duration: "targetNextEnd" }],
  // Pierced Grip
  hcdHitPiercing02: [{ type: "modifier", recipient: "target", selector: "attack-roll", modifierType: "circumstance", value: -1, duration: "targetNextEnd" }],
  // Pinned Down
  hcdHitRanged0001: [{ type: "condition", recipient: "target", condition: "immobilized" }, MANUAL],
  // Hobbling Shot
  hcdHitRanged0002: [{ type: "modifier", recipient: "target", selector: "all-speeds", modifierType: "status", value: -10, duration: "targetNextEnd" }],
  // Eye Shot
  hcdHitRanged0003: [{ type: "condition", recipient: "target", condition: "dazzled", duration: "targetNextEnd" }],
  // Ricochet
  hcdHitRanged0004: [{
    type: "damage", recipient: "area", center: "target", radius: 10, affects: "creatures", pick: "one",
    formula: "@die", damageType: "weapon"
  }],
  // Suppressing Fire
  hcdHitRanged0005: [
    { type: "modifier", recipient: "target", selector: "attack-roll", modifierType: "circumstance", value: -2, duration: "targetNextEnd" },
    NEXT_ROLL_ONLY
  ],
  // Exposed
  hcdHitRanged0007: [{ type: "condition", recipient: "target", condition: "off-guard", duration: "selfNextStart" }, MANUAL],
  // Rapid Reload
  hcdHitRanged0008: [MANUAL],
  // Whistling Shot
  hcdHitRanged0009: [{ type: "modifier", recipient: "target", selector: "perception", modifierType: "circumstance", value: -2, duration: "targetNextEnd" }],
  // Crushing Blow
  hcdHitBludgeon01: [{ type: "condition", recipient: "target", condition: "clumsy", value: 1, duration: "targetNextEnd" }],
  // Skewered
  hcdHitPiercing01: [
    { type: "persistent", recipient: "target", formula: "1d4", damageType: "bleed" },
    { type: "condition", recipient: "target", condition: "off-guard", duration: "selfNextStart" }
  ],
  // Wind Knocked Out
  hcdHitUnarmed001: [{ type: "condition", recipient: "target", condition: "slowed", value: 1, duration: "targetNextEnd" }],
  // Clinch: Off-Guard is the alternative without a free hand
  hcdHitUnarmed002: [
    { type: "condition", recipient: "target", condition: "grabbed", duration: "selfNextEnd" },
    { type: "condition", recipient: "target", condition: "off-guard", duration: "selfNextStart", enabled: false }
  ],
  // Pressure Point
  hcdHitUnarmed003: [{ type: "condition", recipient: "target", condition: "enfeebled", value: 1, duration: "targetNextEnd" }],
  // Flowing Rhythm
  hcdHitUnarmed005: [MANUAL],
  // Body Shot
  hcdHitUnarmed006: [{ type: "condition", recipient: "target", condition: "fatigued", duration: "targetNextEnd" }],
  // Tightened Hold
  hcdHitUnarmed007: [MANUAL],
  // Arcane Overload
  hcdHitSpell00001: [{ type: "condition", recipient: "target", condition: "dazzled", duration: "selfNextEnd" }],
  // Lingering Energy
  hcdHitSpell00002: [{ type: "persistent", recipient: "target", formula: "@rank", damageType: "weapon" }],
  // Resonant Echo
  hcdHitSpell00003: [{ type: "effect", recipient: "self", duration: "selfNextEnd" }, MANUAL],
  // Scorched Ground
  hcdHitSpell00004: [{ type: "effect", recipient: "target", duration: "selfNextEnd" }, MANUAL],
  // Frozen Joints
  hcdHitSpell00005: [{ type: "condition", recipient: "target", condition: "clumsy", value: 1, duration: "targetNextEnd" }],
  // Chain Arc
  hcdHitSpell00006: [{
    type: "damage", recipient: "area", center: "target", radius: 10, affects: "enemies", excludeTarget: true, pick: "one",
    formula: "2 * @rank", damageType: "electricity"
  }],
  // Corroded Armour
  hcdHitSpell00007: [{ type: "modifier", recipient: "target", selector: "ac", modifierType: "status", value: -1, duration: "minute" }],
  // Shattering Tone
  hcdHitSpell00008: [{ type: "condition", recipient: "target", condition: "deafened", duration: "minute" }],
  // Mind Fog
  hcdHitSpell00009: [{ type: "condition", recipient: "target", condition: "stupefied", value: 1, duration: "targetNextEnd" }],
  // Overcharge
  hcdHitSpell00012: [{ type: "weakness", recipient: "target", damageType: "weapon", formula: "@rank", duration: "selfNextEnd" }],
  // Spell Surge
  hcdHitSpell00013: [{ type: "modifier", recipient: "self", selector: "spell-attack-roll", modifierType: "status", value: 1, duration: "selfNextEnd" }],
  // Purging Light
  hcdHitSpell00014: [
    { type: "condition", recipient: "target", condition: "enfeebled", value: 1, duration: "targetNextEnd" },
    { type: "effect", recipient: "target", name: "HCD.Auto.Effects.noHealing", duration: "targetNextEnd" }
  ],
  // Weakened Constitution
  hcdHitSpell00015: [{ type: "modifier", recipient: "target", selector: "fortitude", modifierType: "status", value: -1, duration: "minute" }],
  // Icy Patch
  hcdHitSpell00017: [MANUAL],
  // Magnetized: the Speed penalty is the alternative without metal gear
  hcdHitSpell00018: [
    { type: "condition", recipient: "target", condition: "clumsy", value: 1, duration: "targetNextEnd" },
    { type: "modifier", recipient: "target", selector: "all-speeds", modifierType: "status", value: -5, duration: "targetNextEnd", enabled: false }
  ],
  // Arcane Mark
  hcdHitSpell00020: [{ type: "effect", recipient: "target", duration: "selfNextEnd" }, MANUAL],
  // Effortless Flow
  hcdHitSpell00021: [MANUAL],
  // Siphoned Power
  hcdHitSpell00022: [{ type: "tempHP", recipient: "self", formula: "2 * @rank", duration: "minute" }],
  // Restored Focus: the bonus is the alternative if the focus pool is full
  hcdHitSpell00023: [
    { type: "note", text: "HCD.Auto.Notes.focusPoint" },
    { type: "modifier", recipient: "self", selector: "spell-attack-roll", modifierType: "status", value: 1, duration: "selfNextEnd", enabled: false },
    NEXT_ROLL_ONLY
  ],
  // Catching Fire
  hcdHitSpell00024: [{ type: "persistent", recipient: "target", formula: "1d6", damageType: "fire" }],
  // Heat Haze
  hcdHitSpell00025: [{ type: "effect", recipient: "target", duration: "selfNextStart" }, MANUAL],

  /* ---------- Critical Fumble – general ---------- */

  // Loose Footing
  hcdFumGeneral001: [{ type: "condition", recipient: "self", condition: "prone" }],
  // Lost Nerve
  hcdFumGeneral002: [{ type: "condition", recipient: "self", condition: "frightened", value: 1 }],
  // Uncovered Flank
  hcdFumGeneral003: [{ type: "condition", recipient: "self", condition: "off-guard", duration: "selfNextStart" }],
  // Carried away by the Wind
  hcdFumGeneral004: [
    { type: "move", recipient: "self", mode: "free", distance: 10 },
    { type: "note", text: "HCD.Auto.Notes.triggersReactions" }
  ],
  // A Wrong Move
  hcdFumGeneral005: [
    { type: "condition", recipient: "self", condition: "prone" },
    { type: "condition", recipient: "self", condition: "slowed", value: 1, duration: "selfNextEnd" }
  ],
  // Careless Mistake
  hcdFumGeneral006: [MANUAL],
  // A Moment of Shock
  hcdFumGeneral007: [{ type: "condition", recipient: "self", condition: "stunned", value: 1 }],
  // A Misguided Move
  hcdFumGeneral008: [MANUAL],
  // I've picked Poison
  hcdFumGeneral009: [{ type: "effect", recipient: "self" }, MANUAL],
  // Leveraged
  hcdFumGeneral010: [{ type: "condition", recipient: "self", condition: "fatigued" }],
  // Telegraphed
  hcdFumGeneral012: [{
    type: "modifier", recipient: "target", selector: "ac", modifierType: "circumstance", value: 2,
    against: "self", duration: "selfNextStart"
  }],
  // Emboldened Foe
  hcdFumGeneral013: [{
    type: "modifier", recipient: "target", selector: "attack-roll", modifierType: "status", value: 1,
    against: "self", duration: "targetNextEnd"
  }],
  // Opening for the Enemy
  hcdFumGeneral014: [MANUAL],
  // Dust in the Eyes
  hcdFumGeneral015: [{ type: "condition", recipient: "self", condition: "dazzled", duration: "selfNextEnd" }],
  // Out of Breath
  hcdFumGeneral016: [{ type: "effect", recipient: "self", name: "HCD.Auto.Effects.noReactions", duration: "selfNextStart" }],
  // Gear Spill
  hcdFumGeneral017: [MANUAL],
  // Shattered Focus
  hcdFumGeneral018: [{
    type: "save", recipient: "self", save: "flat", dc: 11,
    outcomes: { failure: [{ type: "note", text: "HCD.Auto.Notes.sustainEnds" }] }
  }],
  // Twisted Knee
  hcdFumGeneral019: [{ type: "modifier", recipient: "self", selector: "all-speeds", modifierType: "status", value: -5 }],
  // Laughingstock
  hcdFumGeneral020: [{ type: "modifier", recipient: "self", selector: "intimidation", modifierType: "circumstance", value: -2, duration: "encounter" }],
  // Lingering Doubt
  hcdFumGeneral021: [
    { type: "modifier", recipient: "self", selector: "attack-roll", modifierType: "circumstance", value: -1, duration: "selfNextEnd" },
    NEXT_ROLL_ONLY
  ],
  // Awkward Recovery
  hcdFumGeneral022: [{ type: "condition", recipient: "self", condition: "clumsy", value: 1, duration: "selfNextEnd" }],
  // Lucky Break
  hcdFumGeneral025: [MANUAL],
  // Taunted
  hcdFumGeneral027: [{
    type: "modifier", recipient: "self", selector: "attack-roll", modifierType: "circumstance", value: -1,
    against: "notTarget", duration: "selfNextEnd"
  }],
  // Tangled Feet
  hcdFumGeneral031: [{ type: "effect", recipient: "self", duration: "selfNextEnd" }, MANUAL],
  // Churned Ground
  hcdFumGeneral032: [MANUAL],
  // Blocked Path
  hcdFumGeneral034: [MANUAL],

  /* ---------- Critical Fumble – specific ---------- */

  // Stuck Fast
  hcdFumMelee00001: [{ type: "effect", recipient: "self" }, MANUAL],
  // Slippery Weapon Handle
  hcdFumMelee00003: [MANUAL],
  // Epic Bad Luck
  hcdFumMelee00004: [MANUAL],
  // Material Stress
  hcdFumMelee00005: [MANUAL],
  // A jammed Parade
  hcdFumMelee00007: [{ type: "effect", recipient: "self" }, MANUAL],
  // Lost Grip
  hcdFumMelee00009: [MANUAL],
  // Shield Slip
  hcdFumMelee00010: [{ type: "effect", recipient: "self", duration: "selfNextStart" }, MANUAL],
  // Caught Blade
  hcdFumMelee00011: [MANUAL],
  // Wild Swing
  hcdFumMelee00012: [{ type: "modifier", recipient: "self", selector: "attack-roll", modifierType: "untyped", value: -2, duration: "selfTurnEnd" }],
  // Dulled Edge
  hcdFumSlashing01: [{ type: "modifier", recipient: "self", selector: "weapon-damage", modifierType: "circumstance", value: -1 }],
  // Wide Arc
  hcdFumSlashing02: [{
    type: "save", recipient: "area", center: "self", radius: 5, affects: "allies", pick: "one",
    save: "reflex", dc: "classDC",
    outcomes: { failure: [{ type: "damage", recipient: "saver", formula: "@die", damageType: "weapon" }] }
  }],
  // Self-Inflicted Nick
  hcdFumSlashing03: [{ type: "persistent", recipient: "self", formula: "1d4", damageType: "bleed" }],
  // Snagged
  hcdFumSlashing04: [{ type: "effect", recipient: "self" }, MANUAL],
  // Jarring Impact
  hcdFumBludgeon01: [{ type: "condition", recipient: "self", condition: "enfeebled", value: 1, duration: "selfNextEnd" }],
  // Ringing Clang
  hcdFumBludgeon04: [{ type: "condition", recipient: "self", condition: "deafened", duration: "selfNextEnd" }],
  // Bent Tip
  hcdFumPiercing01: [{ type: "modifier", recipient: "self", selector: "weapon-attack", modifierType: "circumstance", value: -1 }],
  // Pricked Hand
  hcdFumPiercing02: [
    { type: "damage", recipient: "self", formula: "1d4", damageType: "piercing" },
    { type: "modifier", recipient: "self", selector: "attack-roll", modifierType: "circumstance", value: -1, duration: "selfNextEnd" },
    NEXT_ROLL_ONLY
  ],
  // Snapped Point
  hcdFumPiercing03: [{ type: "modifier", recipient: "self", selector: "weapon-damage", modifierType: "circumstance", value: -1, duration: "encounter" }],
  // Fletching Cut
  hcdFumPiercing04: [{ type: "persistent", recipient: "self", formula: "1", damageType: "bleed" }],
  // Fumbled Ammunition
  hcdFumRanged0001: [MANUAL],
  // Loading Jam
  hcdFumRanged0002: [{ type: "effect", recipient: "self" }, MANUAL],
  // Scattered ammunition
  hcdFumRanged0003: [MANUAL],
  // Deviated Trajectory
  hcdFumRanged0004: [
    { type: "modifier", recipient: "target", selector: "ac", modifierType: "circumstance", value: 4, against: "self", duration: "minute" },
    { type: "note", text: "HCD.Auto.Notes.rangedOnly" }
  ],
  // Friendly Fire
  hcdFumRanged0005: [{
    type: "save", recipient: "area", center: "target", radius: 10, affects: "allies", pick: "one",
    save: "reflex", dc: "classDC",
    outcomes: { failure: [{ type: "damage", recipient: "saver", formula: "@die", damageType: "weapon" }] }
  }],
  // Lost Sight
  hcdFumRanged0006: [{ type: "effect", recipient: "target", duration: "selfNextStart" }, MANUAL],
  // String Slap
  hcdFumRanged0007: [
    { type: "damage", recipient: "self", formula: "1", damageType: "bludgeoning" },
    {
      type: "modifier", recipient: "self", selector: "strike-attack-roll", modifierType: "circumstance", value: -1,
      predicate: ["item:ranged"], duration: "selfNextEnd"
    }
  ],
  // Wasted Shot
  hcdFumRanged0008: [MANUAL],
  // Fumbled Weapon
  hcdFumRanged0009: [MANUAL],
  // Revealed Position
  hcdFumRanged0010: [
    {
      type: "modifier", recipient: "target", selector: "strike-attack-roll", modifierType: "circumstance", value: 1,
      against: "self", predicate: ["item:ranged"], duration: "targetNextEnd"
    },
    MANUAL
  ],
  // Jammed Knuckles
  hcdFumUnarmed001: [
    { type: "damage", recipient: "self", formula: "1d4", damageType: "bludgeoning" },
    {
      type: "modifier", recipient: "self", selector: "strike-attack-roll", modifierType: "circumstance", value: -1,
      predicate: ["item:category:unarmed"], duration: "selfNextEnd"
    }
  ],
  // Sprained joint
  hcdFumUnarmed002: [{ type: "condition", recipient: "self", condition: "enfeebled", value: 1 }],
  // Bloodied Knuckles
  hcdFumUnarmed003: [
    { type: "damage", recipient: "self", formula: "1d4", damageType: "bludgeoning" },
    { type: "note", text: "HCD.Auto.Notes.addStrength" }
  ],
  // Dislocated Ankle
  hcdFumUnarmed004: [{ type: "modifier", recipient: "self", selector: "land-speed", modifierType: "untyped", value: -10, duration: "selfNextEnd" }],
  // Caught Limb
  hcdFumUnarmed005: [{ type: "condition", recipient: "self", condition: "grabbed", duration: "selfNextEnd" }],
  // Overcommitted Lunge
  hcdFumUnarmed006: [
    { type: "condition", recipient: "self", condition: "off-guard", duration: "selfNextStart" },
    { type: "effect", recipient: "self", duration: "selfNextEnd" }
  ],
  // Hollow Thud
  hcdFumUnarmed008: [{
    type: "modifier", recipient: "self", selector: "strike-damage", modifierType: "circumstance", value: -1,
    predicate: ["item:category:unarmed"], duration: "selfNextEnd"
  }],
  // Backlash
  hcdFumSpell00001: [{ type: "condition", recipient: "self", condition: "stupefied", value: 1, duration: "selfNextEnd" }],
  // Arcane Recoil
  hcdFumSpell00002: [
    { type: "damage", recipient: "self", formula: "1d6 + @rank", damageType: "force" },
    { type: "condition", recipient: "self", condition: "stupefied", value: 1, duration: "selfNextEnd" }
  ],
  // Torn-out Spellbook-Page
  hcdFumSpell00003: [MANUAL],
  // Magical Confusion
  hcdFumSpell00004: [{ type: "condition", recipient: "self", condition: "confused", duration: "selfNextStart" }],
  // Glowing Residue
  hcdFumSpell00005: [{ type: "effect", recipient: "self", duration: "selfNextEnd" }, MANUAL],
  // Shaky Hands
  hcdFumSpell00006: [{ type: "effect", recipient: "self", duration: "selfNextEnd" }, MANUAL],
  // Feedback Loop
  hcdFumSpell00007: [{ type: "persistent", recipient: "self", formula: "@rank", damageType: "weapon" }],
  // Scorched Fingers
  hcdFumSpell00009: [{ type: "persistent", recipient: "self", formula: "1d4", damageType: "fire" }],
  // Frost Coating
  hcdFumSpell00010: [{ type: "modifier", recipient: "self", selector: "all-speeds", modifierType: "status", value: -10, duration: "selfNextEnd" }],
  // Grounded Shock: basic Reflex save
  hcdFumSpell00011: [{
    type: "save", recipient: "area", center: "self", radius: 5, affects: "creatures", includeCenter: true,
    save: "reflex", dc: "spellDC",
    outcomes: {
      criticalSuccess: [],
      success: [{ type: "damage", recipient: "saver", formula: "floor(@rank / 2)", damageType: "electricity" }],
      failure: [{ type: "damage", recipient: "saver", formula: "@rank", damageType: "electricity" }],
      criticalFailure: [{ type: "damage", recipient: "saver", formula: "2 * @rank", damageType: "electricity" }]
    }
  }],
  // Psychic Backwash
  hcdFumSpell00012: [{ type: "condition", recipient: "self", condition: "fascinated", duration: "selfNextEnd" }],
  // Drifting Focus
  hcdFumSpell00013: [
    { type: "modifier", recipient: "self", selector: "spell-attack-roll", modifierType: "status", value: -1, duration: "selfNextEnd" },
    { type: "modifier", recipient: "self", selector: "spell-dc", modifierType: "status", value: -1, duration: "selfNextEnd" }
  ],
  // Sapped Vigor
  hcdFumSpell00014: [{ type: "condition", recipient: "self", condition: "enfeebled", value: 1, duration: "selfNextEnd" }],
  // Chill of the Void
  hcdFumSpell00015: [{ type: "effect", recipient: "self", name: "HCD.Auto.Effects.noHealing", duration: "selfNextStart" }],
  // Echoing Boom
  hcdFumSpell00017: [{ type: "condition", recipient: "self", condition: "deafened", duration: "selfNextEnd" }],
  // Corroded Focus
  hcdFumSpell00019: [MANUAL],
  // Unmoored Spirit
  hcdFumSpell00020: [{ type: "modifier", recipient: "self", selector: "will", modifierType: "status", value: -1, duration: "selfNextEnd" }]
};
