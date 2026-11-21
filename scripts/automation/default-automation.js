/**
 * Automation of the cards shipped with the module, keyed by card id. Kept apart from
 * DEFAULT_CARDS so that worlds which stored the cards in an older version still get it.
 * A card's own `automation` list (custom cards, later) takes precedence over this.
 */
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
  }]
};
