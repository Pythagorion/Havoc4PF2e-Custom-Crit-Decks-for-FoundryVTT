import { MODULE_ID } from "../constants.js";
import { damageTypeLabel } from "../deck.js";
import { escapeHTML, format, localize, textToHTML } from "../utils.js";
import {
  AFFECTS, DEFENSE_SELECTORS, DURATIONS, MODIFIER_SELECTORS, MODIFIER_TYPES, SAVES, SPEED_DISTANCES, STEP_TYPES,
  WEAPON_DAMAGE
} from "./schema.js";
import { askDamage, askForRolls } from "./table-rolls.js";
import { linkCompendiumEntries } from "../compendium-links.js";
import { findDestinations, gridlessMessage, moveLabel, noDestinationsMessage, pickDestination } from "./placement.js";

const EFFECT_ICON = "systems/pf2e/icons/default-icons/effect.svg";

/* -------------------------------------------- */
/*  Creatures                                   */
/* -------------------------------------------- */

/**
 * The creatures a card can affect, from the draw info. `saver` is only set while the
 * outcome of a save is applied.
 * @returns {{self: Creature|null, target: Creature|null, saver: Creature|null}}
 * @typedef {{actor: Actor, token: TokenDocument|null}} Creature
 */
export function resolveCreatures(info = {}) {
  return {
    self: resolveCreature(info.tokenUuid, info.actorUuid),
    target: resolveCreature(info.targetTokenUuid, info.targetActorUuid),
    saver: resolveCreature(info.saverTokenUuid, info.saverActorUuid)
  };
}

function resolveCreature(tokenUuid, actorUuid) {
  const token = tokenUuid ? fromUuidSync(tokenUuid) : null;
  const actor = token?.actor ?? (actorUuid ? fromUuidSync(actorUuid) : null);
  if (!actor) return null;
  return { actor, token: token ?? actor.getActiveTokens(false, true)[0] ?? null };
}

const creatureName = (creature) => creature.token?.name ?? creature.actor.name;

/**
 * The creatures a step applies to. Area steps use the creatures the GM chose in the
 * review; area steps that weren't reviewed (save outcomes) take all matches, or the closest.
 */
export function resolveRecipients(step, creatures) {
  if (step.recipient !== "area") {
    const creature = creatures[step.recipient];
    return creature ? [creature] : [];
  }
  if (Array.isArray(step.chosen)) return step.chosen.map((uuid) => resolveCreature(uuid, null)).filter(Boolean);
  const found = findAreaCreatures(step, creatures);
  return step.pick === "one" ? found.slice(0, 1) : found;
}

/** Creatures on the canvas matching an area step, closest first. */
export function findAreaCreatures(step, creatures) {
  const center = creatures[step.center]?.token?.object;
  if (!canvas.ready || !center || center.document.parent !== canvas.scene) return [];
  const self = creatures.self?.actor ?? null;
  const target = creatures.target?.token ?? null;
  const found = [];
  for (const token of canvas.tokens.placeables) {
    const actor = token.actor;
    if (!actor?.isOfType("creature") || isDefeated(token)) continue;
    if (token === center) {
      if (step.includeCenter) found.push({ token, distance: 0 });
      continue;
    }
    if (step.excludeTarget && token.document === target) continue;
    if (step.affects === "enemies" && !(self && actor.isEnemyOf(self))) continue;
    if (step.affects === "allies" && !(self && actor.isAllyOf(self))) continue;
    const distance = center.distanceTo(token);
    if (distance <= step.radius) found.push({ token, distance });
  }
  return found.sort((a, b) => a.distance - b.distance).map(({ token }) => ({ actor: token.actor, token: token.document }));
}

function isDefeated(token) {
  return !!token.combatant?.isDefeated || (token.actor.hitPoints?.value ?? 1) <= 0;
}

/**
 * Find the creatures of an area step for the review: `candidates` are all matches,
 * `chosen` the token UUIDs that will be affected (all, or the closest one).
 */
export function planArea(step, creatures) {
  const found = findAreaCreatures(step, creatures);
  step.candidates = found.map((c) => ({ uuid: c.token.uuid, name: creatureName(c) }));
  step.chosen = (step.pick === "one" ? found.slice(0, 1) : found).map((c) => c.token.uuid);
}

/** How many creatures an area step may affect at most. */
export const areaLimit = (step) => (step.pick === "one" ? 1 : Infinity);

/**
 * Let the tokens the GM selected on the canvas be the creatures of an area step
 * (when the automatic search found nobody, or the wrong creatures).
 * @returns {string|null}  Localization key of a warning, or null if the selection was used.
 */
export function chooseSelectedTokens(step) {
  const tokens = (canvas.tokens?.controlled ?? []).filter((t) => t.actor?.isOfType("creature"));
  if (!tokens.length) return "HCD.Auto.Review.SelectFirst";
  if (tokens.length > areaLimit(step)) return "HCD.Auto.Review.TooMany";
  const candidates = step.candidates ?? [];
  for (const token of tokens) {
    if (!candidates.some((c) => c.uuid === token.document.uuid)) {
      candidates.push({ uuid: token.document.uuid, name: token.document.name ?? token.actor.name });
    }
  }
  step.candidates = candidates;
  step.chosen = tokens.map((t) => t.document.uuid);
  step.enabled = true;
  return null;
}

/* -------------------------------------------- */
/*  Plan                                        */
/* -------------------------------------------- */

/**
 * Turn card steps into the plan shown to the GM: texts localized, the weapon's damage type,
 * DCs and area creatures filled in, steps without a recipient switched off.
 * Outcome steps of saves are only resolved once the save was rolled.
 */
export function buildPlan(steps, { card = null, info = {}, damageTypes = [] } = {}) {
  const creatures = resolveCreatures(info);
  const vars = formulaVars(info, creatures);
  const prepare = (step, nested) => {
    // Alternatives ship switched off, the GM can switch them on
    const planned = { ...step, enabled: step.enabled !== false };
    if (step.type === "effect" && !planned.name && card) planned.name = card.title;
    if (planned.name) planned.name = localize(planned.name);
    if (planned.text) planned.text = localize(planned.text);
    if (planned.damageType === WEAPON_DAMAGE) planned.damageType = damageTypes[0] ?? "bludgeoning";
    if (typeof planned.formula === "string") planned.formula = resolveFormula(planned.formula, vars);
    if (!nested && "recipient" in STEP_TYPES[step.type].fields) {
      if (step.recipient === "area") planArea(planned, creatures);
      if (!resolveRecipients(planned, creatures).length) planned.enabled = false;
    }
    if (step.type === "save") {
      planned.dc = resolveDC(step.dc, creatures);
      if (planned.dc === null) planned.enabled = false;
      planned.outcomes = Object.fromEntries(Object.entries(step.outcomes ?? {})
        .map(([degree, list]) => [degree, list.map((child) => prepare(child, true))]));
    }
    return planned;
  };
  return steps.map((step) => prepare(step, false));
}

/** Values of the FORMULA_PLACEHOLDERS for a draw. */
function formulaVars(info, creatures) {
  return {
    level: creatures.self?.actor.level ?? 1,
    rank: Number(info.spellRank) || 1,
    die: info.weaponDie || "1d6"
  };
}

/**
 * Fill in @level, @rank and @die. Formulas without dice are calculated right away,
 * so "floor(@rank / 2)" becomes "1" and shows as a plain number in the review.
 */
export function resolveFormula(formula, vars) {
  const filled = String(formula)
    .replaceAll("@level", vars.level)
    .replaceAll("@rank", vars.rank)
    .replaceAll("@die", vars.die);
  if (/\d*d\d/i.test(filled.replace(/\[[^\]]*\]/g, ""))) return filled;
  try {
    return String(Math.floor(Roll.safeEval(filled.replace(/\[[^\]]*\]/g, ""))));
  } catch {
    return filled;
  }
}

/** DC of a save step: a fixed number or one of DC_SOURCES; null if it can't be determined. */
export function resolveDC(dc, creatures) {
  if (typeof dc === "number") return dc;
  const self = creatures.self?.actor;
  const target = creatures.target?.actor;
  switch (dc) {
    case "classDC": return self ? classDC(self) : null;
    case "spellDC": return self ? spellDC(self) : null;
    case "targetHard": return target ? levelDC(target.level) + 2 : null;
  }
  return Number(dc) || null;
}

function classDC(actor) {
  return actor.classDC?.dc?.value ?? actor.system.attributes?.classDC?.value ?? levelDC(actor.level);
}

/** Best spell DC of the creature, its class DC if it can't cast spells. */
function spellDC(actor) {
  const dcs = (actor.spellcasting?.contents ?? []).map((entry) => entry.statistic?.dc?.value).filter(Number.isFinite);
  return dcs.length ? Math.max(...dcs) : classDC(actor);
}

/** DCs by level (GM Core, "DCs by Level"). */
const LEVEL_DCS = [14, 15, 16, 18, 19, 20, 22, 23, 24, 26, 27, 28, 30, 31, 32, 34, 35, 36, 38, 39, 40, 42, 44, 46, 48, 50];

function levelDC(level = 0) {
  if (level < 0) return 13;
  return LEVEL_DCS[Math.min(level, LEVEL_DCS.length - 1)];
}

/** Movement distance in feet: a number, or a share of the creature's land Speed (rounded down to 5 ft). */
export function resolveDistance(distance, actor) {
  if (distance in SPEED_DISTANCES) {
    const speed = Number(actor?.system?.movement?.speeds?.land?.value) || 25;
    return Math.max(5, Math.floor((speed * SPEED_DISTANCES[distance]) / 5) * 5);
  }
  return Math.max(0, Number(distance) || 0);
}

/** Who a step affects, e.g. "Goblin", "Goblin, Orc" or "enemies within 30 ft of Valeros". */
function recipientLabel(step, creatures) {
  if (step.recipient === "area") {
    if (Array.isArray(step.chosen)) {
      const names = step.chosen.map((uuid) => step.candidates?.find((c) => c.uuid === uuid)?.name).filter(Boolean);
      return names.length ? names.join(", ") : localize("HCD.Auto.NoRecipient");
    }
    const center = creatures[step.center];
    return format("HCD.Auto.Describe.area", {
      affects: localize(AFFECTS[step.affects] ?? step.affects),
      radius: step.radius,
      center: center ? creatureName(center) : localize(`HCD.Auto.Recipient.${step.center}`)
    });
  }
  const creature = creatures[step.recipient];
  if (creature) return creatureName(creature);
  return step.recipient === "saver" ? localize("HCD.Auto.Recipient.saver") : localize("HCD.Auto.NoRecipient");
}

/**
 * One line describing a step, e.g. "Goblin: Frightened 1 (until the end of its next turn)".
 * @param {string} [name]  Recipient name to use instead of the step's recipient(s).
 */
export function describeStep(step, creatures, name = recipientLabel(step, creatures)) {
  const duration = step.duration && step.duration !== "unlimited" ? ` (${localize(`HCD.Auto.Duration.${step.duration}`)})` : "";
  const effect = describeEffect(step, creatures);
  if (effect !== null) return `${name}: ${effect}${duration}`;
  switch (step.type) {
    case "heal":
      return `${name}: ${format("HCD.Auto.Describe.heal", { formula: step.formula })}`;
    case "reduceCondition": {
      const label = localize(CONFIG.PF2E?.conditionTypes?.[step.condition] ?? step.condition);
      return `${name}: ${format("HCD.Auto.Describe.reduceCondition", { condition: label, value: step.value })}`;
    }
    case "damage":
      return `${name}: ${format("HCD.Auto.Describe.damage", { formula: step.formula, type: damageTypeLabel(step.damageType) })}`;
    case "persistent":
      return `${name}: ${format("HCD.Auto.Describe.persistent", { formula: step.formula, type: damageTypeLabel(step.damageType) })}`;
    case "note":
      return step.text;
    case "save":
      return `${name}: ${format("HCD.Auto.Describe.save", { save: localize(SAVES[step.save] ?? step.save), dc: step.dc ?? "?" })}`;
    case "move": {
      const from = creatures[step.from];
      const distance = step.distance in SPEED_DISTANCES
        ? localize(`HCD.Auto.Distance.${step.distance}`)
        : `${step.distance} ${canvas.scene?.grid.units || "ft"}`;
      return moveLabel(name, step.mode, distance, from ? creatureName(from) : localize(`HCD.Auto.Recipient.${step.from}`));
    }
  }
  return "";
}

/**
 * What a step that creates an effect does, without recipient and duration, e.g. "Frightened 1"
 * or "–1 circumstance to AC". Used for the review line and the effect name. Null for other steps.
 */
function describeEffect(step, creatures) {
  switch (step.type) {
    case "condition": {
      const label = localize(CONFIG.PF2E?.conditionTypes?.[step.condition] ?? step.condition);
      return isValued(step.condition) ? `${label} ${step.value}` : label;
    }
    case "modifier": {
      const value = format("HCD.Auto.Describe.modifier", {
        value: step.value > 0 ? `+${step.value}` : String(step.value).replace("-", "–"),
        type: localize(MODIFIER_TYPES[step.modifierType] ?? step.modifierType),
        selector: localize(MODIFIER_SELECTORS[step.selector] ?? step.selector)
      });
      const against = step.against ? ` ${format(`HCD.Auto.Describe.against.${step.against}`, { name: againstName(step, creatures) })}` : "";
      return `${value}${against}`;
    }
    case "tempHP":
      return format("HCD.Auto.Describe.tempHP", { formula: step.formula });
    case "weakness":
      return format("HCD.Auto.Describe.weakness", { formula: step.formula, type: damageTypeLabel(step.damageType) });
    case "effect":
      return step.name;
  }
  return null;
}

/**
 * Name of an effect created by a card: "Can't Step (until the end of Valeros's next turn) [from: Overcommitted Lunge]".
 * The duration names the creature whose turn counts; effects without an end leave it out.
 */
function effectName(label, duration, card, anchors) {
  const anchor = DURATIONS[duration]?.anchor;
  const creature = anchor ? anchors[anchor] : null;
  if (!duration || duration === "unlimited") return format("HCD.Auto.EffectName.unlimited", { label, card: card.title });
  const until = creature
    ? format(`HCD.Auto.EffectName.Duration.${duration}`, { name: creatureName(creature) })
    : localize(`HCD.Auto.Duration.${duration}`);
  return format("HCD.Auto.EffectName.timed", { label, duration: until, card: card.title });
}

/** The creature a modifier's `against` refers to. */
function againstCreature(step, creatures) {
  return { self: creatures.self, notSelf: creatures.self, target: creatures.target, notTarget: creatures.target }[step.against] ?? null;
}

function againstName(step, creatures) {
  const creature = againstCreature(step, creatures);
  if (creature) return creatureName(creature);
  return localize(`HCD.Auto.Recipient.${step.against.replace(/^not/, "").toLowerCase()}`);
}

function isValued(slug) {
  const condition = game.pf2e?.ConditionManager?.getCondition(slug);
  return typeof condition?._source.system.value.value === "number";
}

/* -------------------------------------------- */
/*  Apply                                       */
/* -------------------------------------------- */

/**
 * Apply the enabled steps of a plan to each of their recipients. Save steps are not rolled
 * here but returned, so the caller can start them after announcing the result (see saves.js, runPlan).
 * @returns {Promise<{lines: string[], notes: string[], records: object[], saves: {step: object, creature: Creature}[]}>}
 *   Descriptions of what was applied, reminders for the GM, undo records, saves to roll.
 */
export async function applyPlan(plan, { card, info = {} }) {
  const creatures = resolveCreatures(info);
  const vars = formulaVars(info, creatures);
  const records = [];
  const lines = [];
  const notes = [];
  const saves = [];
  for (const step of plan) {
    if (!step.enabled) continue;
    if (step.type === "note") {
      notes.push(step.text);
      continue;
    }
    for (const creature of resolveRecipients(step, creatures)) {
      const name = creatureName(creature);
      if (step.type === "save") {
        saves.push({ step, creature });
        lines.push(format("HCD.Auto.Result.SaveRequested", { step: describeStep(step, creatures, name) }));
        continue;
      }
      // Formulas of steps that didn't pass through buildPlan are filled in here
      const ready = typeof step.formula === "string" ? { ...step, formula: resolveFormula(step.formula, vars) } : step;
      try {
        // An apply function returns false if the GM skipped the step
        const applied = await APPLY[step.type](ready, creature, { creatures, card, records, name, info });
        if (applied !== false) lines.push(describeStep(ready, creatures, name));
        // Effects without rules don't do anything by themselves: say so once
        const reminder = localize("HCD.Auto.Notes.reminderEffect");
        if (applied !== false && step.type === "effect" && !step.rules?.length && !notes.includes(reminder)) notes.push(reminder);
      } catch (err) {
        console.error(`${MODULE_ID} | Failed to apply`, step, err);
        ui.notifications.error(format("HCD.Auto.ApplyFailed", { step: describeStep(ready, creatures, name) }));
      }
    }
  }
  return { lines, notes, records, saves };
}

const APPLY = {
  async condition(step, creature, ctx) {
    if (!step.duration || step.duration === "unlimited") return applyCondition(step, creature.actor, ctx.records);
    // Timed conditions are granted by an effect, so they end together with it
    const uuid = await getConditionUuid(step.condition);
    const rule = { key: "GrantItem", uuid, inMemoryOnly: true };
    if (isValued(step.condition)) rule.alterations = [{ mode: "override", property: "badge-value", value: Number(step.value) || 1 }];
    await createEffect(creature, ctx, { label: describeEffect(step, ctx.creatures), rules: [rule], duration: step.duration });
  },

  async modifier(step, creature, ctx) {
    // The weapon of the triggering attack has its own selectors
    const itemId = ctx.info.itemId;
    const selector = {
      "weapon-attack": itemId ? `${itemId}-attack` : "strike-attack-roll",
      "weapon-damage": itemId ? `${itemId}-damage` : "strike-damage"
    }[step.selector] ?? step.selector;
    const predicate = [...(step.predicate ?? [])];
    // "Against you": attacks aim at the creature (target:), defenses face its attacks (origin:)
    const other = step.against ? againstCreature(step, ctx.creatures) : null;
    if (other?.actor.signature) {
      const prefix = DEFENSE_SELECTORS.has(step.selector) ? "origin" : "target";
      const option = `${prefix}:signature:${other.actor.signature}`;
      predicate.push(step.against.startsWith("not") ? { not: option } : option);
    }
    const rule = {
      key: "FlatModifier",
      selector,
      type: step.modifierType,
      value: Number(step.value) || 0,
      label: ctx.card.title
    };
    if (predicate.length) rule.predicate = predicate;
    await createEffect(creature, ctx, { label: describeEffect(step, ctx.creatures), rules: [rule], duration: step.duration });
  },

  async heal(step, { actor, token }, ctx) {
    if (!token) throw new Error(`${actor.name} has no token to heal`);
    const roll = await new Roll(step.formula).evaluate();
    if (roll.dice.length) await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor, token }), flavor: ctx.card.title });
    // Negative damage is healing; PF2e posts its own message with an undo button
    await actor.applyDamage({ damage: -Math.max(roll.total, 0), token });
  },

  async tempHP(step, creature, ctx) {
    const value = Math.max(Number(step.formula) || 0, 0);
    await createEffect(creature, ctx, { label: describeEffect(step, ctx.creatures), rules: [{ key: "TempHP", value }], duration: step.duration });
  },

  async weakness(step, creature, ctx) {
    const rule = { key: "Weakness", type: step.damageType, value: Math.max(Number(step.formula) || 1, 1) };
    await createEffect(creature, ctx, { label: describeEffect(step, ctx.creatures), rules: [rule], duration: step.duration });
  },

  /** Lower a valued condition; returns false (not applied) if the creature doesn't have it. */
  async reduceCondition(step, { actor }, ctx) {
    const existing = actor.itemTypes.condition.find((c) => c.slug === step.condition && !c.isLocked);
    const previous = existing?._source.system.value.value;
    if (typeof previous !== "number") return false;
    await game.pf2e.ConditionManager.updateConditionValue(existing.id, actor, Math.max(previous - (Number(step.value) || 1), 0));
    ctx.records.push({ type: "reduced", actorUuid: actor.uuid, condition: step.condition, itemId: existing.id, previous });
  },

  async effect(step, creature, ctx) {
    await createEffect(creature, ctx, { label: step.name || ctx.card.title, rules: step.rules ?? [], duration: step.duration });
  },

  async damage(step, { actor, token }, ctx) {
    if (!token) throw new Error(`${actor.name} has no token to apply damage to`);
    // Rolled at the table: the GM's total replaces the formula, damage type and IWR still apply
    let formula = step.formula;
    if (askForRolls()) {
      const choice = await askDamage({ title: ctx.card.title, damage: describeStep(step, ctx.creatures, ctx.name) });
      if (choice === null) return false;
      if (typeof choice === "number") formula = String(choice);
    }
    const DamageRoll = CONFIG.Dice.rolls.find((cls) => cls.name === "DamageRoll");
    const roll = await new DamageRoll(`(${formula})[${step.damageType}]`).evaluate();
    await roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor, token }),
      flavor: ctx.card.title,
      flags: { pf2e: { suppressDamageButtons: true } }
    });
    // PF2e posts its own "damage taken" message with an undo button
    await actor.applyDamage({ damage: roll, token });
  },

  async persistent(step, { actor }, ctx) {
    const source = game.pf2e.ConditionManager.getCondition("persistent-damage").toObject();
    foundry.utils.mergeObject(source, {
      system: { persistent: { formula: step.formula, damageType: step.damageType, dc: 15 } },
      flags: { [MODULE_ID]: { cardId: ctx.card.id } }
    });
    const [item] = await actor.createEmbeddedDocuments("Item", [source]);
    if (item) ctx.records.push({ type: "created", actorUuid: actor.uuid, itemId: item.id });
  },

  /** The GM places the token on one of the highlighted spaces (placement.js). */
  async move(step, { actor, token }, ctx) {
    if (!token?.object || token.parent !== canvas.scene) {
      ui.notifications.warn(format("HCD.Auto.Move.OtherScene", { name: ctx.name }));
      return false;
    }
    if (canvas.grid.isGridless) {
      ui.notifications.warn(gridlessMessage());
      return false;
    }
    const from = step.mode === "free" ? null : ctx.creatures[step.from]?.token ?? null;
    if (step.mode !== "free" && (!from?.object || from === token)) {
      ui.notifications.warn(format("HCD.Auto.Move.NoOrigin", { name: ctx.name }));
      return false;
    }
    const distance = resolveDistance(step.distance, actor);
    const destinations = findDestinations(token, { distance, mode: step.mode, from });
    if (!destinations.length) {
      ui.notifications.warn(noDestinationsMessage(ctx.name));
      return false;
    }
    const label = describeStep({ ...step, distance }, ctx.creatures, ctx.name);
    const destination = await pickDestination(token, destinations, label);
    if (!destination) return false;
    const previous = { x: token.x, y: token.y };
    // Spaces were checked for walls already; forced movement costs nothing
    await token.move({ x: destination.x, y: destination.y }, { constrainOptions: { ignoreWalls: true, ignoreCost: true } });
    ctx.records.push({ type: "move", tokenUuid: token.uuid, x: previous.x, y: previous.y });
  }
};

/** Untimed conditions: valued ones are raised to the card's value, never lowered. */
async function applyCondition(step, actor, records) {
  const valued = isValued(step.condition);
  const value = valued ? Math.max(Number(step.value) || 1, 1) : null;
  const existing = actor.itemTypes.condition.find((c) => c.slug === step.condition && !c.isLocked);
  if (existing) {
    const previous = existing._source.system.value.value;
    if (!valued || previous >= value) return;
    await game.pf2e.ConditionManager.updateConditionValue(existing.id, actor, value);
    records.push({ type: "value", actorUuid: actor.uuid, itemId: existing.id, previous });
    return;
  }
  const source = game.pf2e.ConditionManager.getCondition(step.condition).toObject();
  source.system.value.value = value;
  const [item] = await actor.createEmbeddedDocuments("Item", [source]);
  if (item) records.push({ type: "created", actorUuid: actor.uuid, itemId: item.id });
}

/**
 * Create a card effect on the recipient.
 * @param {object} options
 * @param {string} options.label  What the effect does, e.g. "Can't Step"; also the start of its name.
 */
async function createEffect(recipient, { creatures, card, records }, { label, rules, duration }) {
  // "own" durations are counted on the recipient's turn
  const anchors = { ...creatures, recipient };
  const data = resolveDuration(duration, anchors);
  const anchor = data.anchor ? anchors[data.anchor] : null;
  // Names are plain text, so the compendium links (e.g. to Step) go into the description
  const [labelHTML, cardHTML] = await Promise.all([label, card.effect].map(async (text) => textToHTML(await linkCompendiumEntries(text))));
  const source = {
    type: "effect",
    name: effectName(label, duration, card, anchors),
    img: EFFECT_ICON,
    system: {
      rules,
      duration: { value: data.value, unit: data.unit, expiry: data.expiry, sustained: false },
      description: { value: `<p><strong>${labelHTML}</strong></p><p><em>${escapeHTML(card.title)}:</em> ${cardHTML}</p>` },
      // PF2e counts turn-based durations on the turn of the effect's origin
      context: anchor ? {
        origin: { actor: anchor.actor.uuid, token: anchor.token?.uuid ?? null, item: null, spellcasting: null, rollOptions: [] },
        target: null,
        roll: null
      } : null
    },
    flags: { [MODULE_ID]: { cardId: card.id } }
  };
  const [item] = await recipient.actor.createEmbeddedDocuments("Item", [source]);
  if (item) records.push({ type: "created", actorUuid: recipient.actor.uuid, itemId: item.id });
}

/**
 * PF2e duration data for a duration key. "Next turn" durations end on the anchor's turn
 * later in this round if it hasn't acted yet, otherwise on its turn in the next round.
 * @param {object} creatures  Including `recipient`, the anchor of "own" durations.
 */
function resolveDuration(key, creatures) {
  const data = { ...(DURATIONS[key] ?? DURATIONS.unlimited) };
  if (data.anchor && !creatures[data.anchor]) delete data.anchor;
  const combat = game.combat;
  if (data.next && data.anchor && combat?.started) {
    const actor = creatures[data.anchor].actor;
    const index = combat.turns.findIndex((c) => c.actor === actor);
    if (index > combat.turn) data.value = 0;
  }
  return data;
}

async function getConditionUuid(slug) {
  const pack = game.packs.get("pf2e.conditionitems");
  const index = await pack.getIndex({ fields: ["system.slug"] });
  const entry = index.find((e) => e.system?.slug === slug);
  if (!entry) throw new Error(`Unknown condition: ${slug}`);
  return entry.uuid ?? `Compendium.pf2e.conditionitems.Item.${entry._id}`;
}

/* -------------------------------------------- */
/*  Undo                                        */
/* -------------------------------------------- */

/** Remove created effects and conditions, restore raised condition values, move tokens back. */
export async function undoRecords(records = []) {
  for (const record of [...records].reverse()) {
    if (record.type === "move") {
      const token = fromUuidSync(record.tokenUuid);
      await token?.move({ x: record.x, y: record.y, action: "displace" });
      continue;
    }
    const actor = fromUuidSync(record.actorUuid);
    const item = actor?.items.get(record.itemId);
    if (record.type === "reduced" && actor) {
      // Reducing to 0 removed the condition: add it again with its old value
      if (item) await game.pf2e.ConditionManager.updateConditionValue(item.id, actor, record.previous);
      else {
        const source = game.pf2e.ConditionManager.getCondition(record.condition).toObject();
        source.system.value.value = record.previous;
        await actor.createEmbeddedDocuments("Item", [source]);
      }
      continue;
    }
    if (!item) continue;
    if (record.type === "created") await item.delete();
    else if (record.type === "value") await game.pf2e.ConditionManager.updateConditionValue(item.id, actor, record.previous);
  }
}
