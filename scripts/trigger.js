import { DEGREES, GENERAL_ONLY, MODULE_ID, ROLL_KINDS, VERSATILE_DAMAGE } from "./constants.js";
import { getDamageTypeChoices } from "./deck.js";
import { getSetting, parseNumberList, waitForDiceSoNice } from "./utils.js";
import { createGmPrompt } from "./prompt.js";
import { beginDraw } from "./player-draw.js";

/** createChatMessage hook. Only the active GM evaluates rolls, so nothing fires twice. */
export async function onCreateChatMessage(message) {
  if (!game.users.activeGM?.isSelf) return;
  try {
    const trigger = evaluateMessage(message);
    if (!trigger) return;
    await waitForDiceSoNice(message.id);
    if (getSetting("gmPrompt") === "auto") await beginDraw(trigger);
    else await createGmPrompt(trigger);
  } catch (err) {
    console.error(`${MODULE_ID} | Failed to evaluate chat message`, err);
  }
}

/**
 * Check whether a chat message contains a d20 roll that should trigger a deck.
 * @returns {{deck: string, rollKind: string, attackType: string, damageTypes: string[], info: object}|null}
 */
export function evaluateMessage(message) {
  if (message.flags?.[MODULE_ID] || !message.rolls?.length) return null;

  const context = message.flags?.pf2e?.context ?? {};
  if (context.type === "damage-roll") return null;
  const rollKind = getRollKind(context);
  if (!isRollKindEnabled(rollKind)) return null;

  const roll = message.rolls.find((r) => r.dice?.some((die) => die.faces === 20));
  if (!roll) return null;
  const natural = roll.dice.find((die) => die.faces === 20).total; // respects fortune/misfortune (2d20kh/kl)
  const outcome = context.outcome ?? DEGREES[roll.degreeOfSuccess] ?? null;

  const actor = message.actor ?? ChatMessage.getSpeakerActor(message.speaker);
  if (getSetting("triggerActors") === "players" && !isPlayerRoll(message, actor)) return null;

  const deck = determineDeck(natural, outcome);
  if (!deck) return null;

  const item = rollKind === "attack" ? getItem(message) : null;
  return {
    deck,
    rollKind,
    attackType: rollKind === "attack" ? classifyAttack(context, item) : GENERAL_ONLY,
    damageTypes: rollKind === "attack" ? getRollDamageTypes(context, item) : [],
    info: {
      actorName: actor?.name ?? message.speaker?.alias ?? message.author?.name ?? "",
      itemName: item?.name ?? "",
      natural,
      sourceMessageId: message.id,
      userId: message.author?.id ?? null,
      actorUuid: actor?.uuid ?? null
    }
  };
}

function getRollKind(context) {
  for (const [kind, types] of Object.entries(ROLL_KINDS)) {
    if (types.includes(context.type)) return kind;
  }
  return "other";
}

function isRollKindEnabled(kind) {
  if (getSetting("triggerAllRolls")) return true;
  switch (kind) {
    case "attack": return getSetting("triggerAttacks");
    case "save": return getSetting("triggerSaves");
    case "skill": return getSetting("triggerSkills");
    default: return false;
  }
}

/** Player-owned actor, or – for rolls without an actor – rolled by a non-GM user. */
function isPlayerRoll(message, actor) {
  if (actor) return actor.hasPlayerOwner;
  return message.author ? !message.author.isGM : false;
}

function determineDeck(natural, outcome) {
  const mode = getSetting("triggerMode");
  const matches = (naturals, critOutcome) => {
    const natMatch = parseNumberList(naturals).has(natural);
    const degreeMatch = outcome === critOutcome;
    switch (mode) {
      case "degree": return degreeMatch;
      case "either": return natMatch || degreeMatch;
      case "both": return natMatch && degreeMatch;
      default: return natMatch;
    }
  };
  if (getSetting("enableHitDeck") && matches(getSetting("hitNaturals"), "criticalSuccess")) return "hit";
  if (getSetting("enableFumbleDeck") && matches(getSetting("fumbleNaturals"), "criticalFailure")) return "fumble";
  return null;
}

function getItem(message) {
  try {
    return message.item ?? null;
  } catch {
    return null;
  }
}

/** Map a PF2e attack to one of the module's attack types: melee, ranged, unarmed, spell. */
export function classifyAttack(context, item) {
  const options = new Set(context.options ?? []);
  const traits = new Set(item?.system?.traits?.value ?? []);

  if (context.type === "spell-attack-roll" || item?.type === "spell"
    || traits.has("spell") || traits.has("impulse") || options.has("item:type:spell")) return "spell";

  if (item?.system?.category === "unarmed" || traits.has("unarmed")
    || options.has("item:category:unarmed") || options.has("item:trait:unarmed")) return "unarmed";

  if (item?.isRanged || options.has("item:ranged")) return "ranged";

  return "melee";
}

/**
 * Damage types the attack can deal. Versatile weapons return several types,
 * since the choice is only made when rolling damage.
 */
export function getRollDamageTypes(context, item) {
  const types = new Set();
  for (const option of context.options ?? []) {
    const match = option.match(/^item:damage:type:(.+)$/);
    if (match) types.add(match[1]);
  }

  const system = item?.system ?? {};
  if (!types.size && system.damage?.damageType) types.add(system.damage.damageType); // weapons
  for (const partial of Object.values(system.damageRolls ?? {})) {                     // NPC attacks
    if (partial?.damageType) types.add(partial.damageType);
  }
  if (item?.type === "spell") {
    for (const partial of Object.values(system.damage ?? {})) {
      if (partial?.type) types.add(partial.type);
    }
  }
  for (const trait of system.traits?.value ?? []) {
    const match = trait.match(/^versatile-(.+)$/);
    if (match) types.add(VERSATILE_DAMAGE[match[1]] ?? match[1]);
  }

  const known = getDamageTypeChoices();
  return [...types].filter((type) => type in known);
}
