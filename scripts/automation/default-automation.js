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
  hcdFumMelee00006: [{ type: "persistent", recipient: "self", formula: "1d4", damageType: "bleed" }]
};
