import { MODULE_ID } from "../constants.js";
import { damageTypeLabel } from "../deck.js";
import { escapeHTML, format, localize, textToHTML } from "../utils.js";
import { DURATIONS, MODIFIER_SELECTORS, MODIFIER_TYPES, SAVES, STEP_TYPES, WEAPON_DAMAGE } from "./schema.js";

const EFFECT_ICON = "systems/pf2e/icons/default-icons/effect.svg";

/* -------------------------------------------- */
/*  Context                                     */
/* -------------------------------------------- */

/**
 * The creatures a card can affect, from the draw info.
 * @returns {{self: Creature|null, target: Creature|null}}
 * @typedef {{actor: Actor, token: TokenDocument|null}} Creature
 */
export function resolveCreatures(info = {}) {
  return {
    self: resolveCreature(info.tokenUuid, info.actorUuid),
    target: resolveCreature(info.targetTokenUuid, info.targetActorUuid)
  };
}

function resolveCreature(tokenUuid, actorUuid) {
  const token = tokenUuid ? fromUuidSync(tokenUuid) : null;
  const actor = token?.actor ?? (actorUuid ? fromUuidSync(actorUuid) : null);
  if (!actor) return null;
  return { actor, token: token ?? actor.getActiveTokens(false, true)[0] ?? null };
}

/* -------------------------------------------- */
/*  Plan                                        */
/* -------------------------------------------- */

/**
 * Turn card steps into the plan shown to the GM: texts localized, the weapon's damage
 * type filled in, steps without a recipient switched off.
 */
export function buildPlan(steps, { info = {}, damageTypes = [] } = {}) {
  const creatures = resolveCreatures(info);
  const prepare = (step) => {
    const planned = { ...step, enabled: true };
    if (planned.name) planned.name = localize(planned.name);
    if (planned.text) planned.text = localize(planned.text);
    if (planned.damageType === WEAPON_DAMAGE) planned.damageType = damageTypes[0] ?? "bludgeoning";
    if ("recipient" in STEP_TYPES[step.type].fields && !creatures[planned.recipient]) planned.enabled = false;
    if (step.type === "save") {
      planned.dc = resolveDC(step.dc, creatures);
      if (planned.dc === null) planned.enabled = false;
      planned.outcomes = Object.fromEntries(Object.entries(step.outcomes ?? {}).map(([degree, list]) => [degree, list.map(prepare)]));
    }
    return planned;
  };
  return steps.map(prepare);
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

/** One line describing a step, e.g. "Goblin: Frightened 1 (until the end of its next turn)". */
export function describeStep(step, creatures) {
  const name = creatures[step.recipient]?.actor.name ?? localize("HCD.Auto.NoRecipient");
  const duration = step.duration && step.duration !== "unlimited" ? ` (${localize(`HCD.Auto.Duration.${step.duration}`)})` : "";
  switch (step.type) {
    case "condition": {
      const label = localize(CONFIG.PF2E?.conditionTypes?.[step.condition] ?? step.condition);
      const value = isValued(step.condition) ? ` ${step.value}` : "";
      return `${name}: ${label}${value}${duration}`;
    }
    case "modifier": {
      const value = format("HCD.Auto.Describe.modifier", {
        value: step.value > 0 ? `+${step.value}` : step.value,
        type: localize(MODIFIER_TYPES[step.modifierType] ?? step.modifierType),
        selector: localize(MODIFIER_SELECTORS[step.selector] ?? step.selector)
      });
      return `${name}: ${value}${duration}`;
    }
    case "effect":
      return `${name}: ${step.name}${duration}`;
    case "damage":
      return `${name}: ${format("HCD.Auto.Describe.damage", { formula: step.formula, type: damageTypeLabel(step.damageType) })}`;
    case "persistent":
      return `${name}: ${format("HCD.Auto.Describe.persistent", { formula: step.formula, type: damageTypeLabel(step.damageType) })}`;
    case "note":
      return step.text;
    case "save":
      return `${name}: ${format("HCD.Auto.Describe.save", { save: localize(SAVES[step.save] ?? step.save), dc: step.dc ?? "?" })}`;
  }
  return "";
}

function isValued(slug) {
  const condition = game.pf2e?.ConditionManager?.getCondition(slug);
  return typeof condition?._source.system.value.value === "number";
}

/* -------------------------------------------- */
/*  Apply                                       */
/* -------------------------------------------- */

/**
 * Apply the enabled steps of a plan. Save steps are not rolled here but returned, so
 * the caller can start them after announcing the result (see saves.js, runPlan).
 * @returns {Promise<{lines: string[], notes: string[], records: object[], saves: object[]}>}
 *   Descriptions of what was applied, reminders for the GM, undo records, save steps to roll.
 */
export async function applyPlan(plan, { card, info = {} }) {
  const creatures = resolveCreatures(info);
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
    const creature = creatures[step.recipient];
    if (!creature) continue;
    if (step.type === "save") {
      saves.push(step);
      lines.push(format("HCD.Auto.Result.SaveRequested", { step: describeStep(step, creatures) }));
      continue;
    }
    try {
      await APPLY[step.type](step, creature, { creatures, card, records });
      lines.push(describeStep(step, creatures));
    } catch (err) {
      console.error(`${MODULE_ID} | Failed to apply`, step, err);
      ui.notifications.error(format("HCD.Auto.ApplyFailed", { step: describeStep(step, creatures) }));
    }
  }
  return { lines, notes, records, saves };
}

const APPLY = {
  async condition(step, { actor }, ctx) {
    if (!step.duration || step.duration === "unlimited") return applyCondition(step, actor, ctx.records);
    // Timed conditions are granted by an effect, so they end together with it
    const uuid = await getConditionUuid(step.condition);
    const rule = { key: "GrantItem", uuid, inMemoryOnly: true };
    if (isValued(step.condition)) rule.alterations = [{ mode: "override", property: "badge-value", value: Number(step.value) || 1 }];
    const label = localize(CONFIG.PF2E.conditionTypes[step.condition] ?? step.condition);
    await createEffect(actor, ctx, { name: `${ctx.card.title} (${label})`, rules: [rule], duration: step.duration });
  },

  async modifier(step, { actor }, ctx) {
    const rule = {
      key: "FlatModifier",
      selector: step.selector,
      type: step.modifierType,
      value: Number(step.value) || 0,
      label: ctx.card.title
    };
    await createEffect(actor, ctx, { name: ctx.card.title, rules: [rule], duration: step.duration });
  },

  async effect(step, { actor }, ctx) {
    await createEffect(actor, ctx, { name: step.name || ctx.card.title, rules: step.rules ?? [], duration: step.duration });
  },

  async damage(step, { actor, token }, ctx) {
    if (!token) throw new Error(`${actor.name} has no token to apply damage to`);
    const DamageRoll = CONFIG.Dice.rolls.find((cls) => cls.name === "DamageRoll");
    const roll = await new DamageRoll(`(${step.formula})[${step.damageType}]`).evaluate();
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

async function createEffect(actor, { creatures, card, records }, { name, rules, duration }) {
  const data = resolveDuration(duration, creatures);
  const anchor = data.anchor ? creatures[data.anchor] : null;
  const source = {
    type: "effect",
    name,
    img: EFFECT_ICON,
    system: {
      rules,
      duration: { value: data.value, unit: data.unit, expiry: data.expiry, sustained: false },
      description: { value: `<p><strong>${escapeHTML(card.title)}</strong></p><p>${textToHTML(card.effect)}</p>` },
      // PF2e counts turn-based durations on the turn of the effect's origin
      context: anchor ? {
        origin: { actor: anchor.actor.uuid, token: anchor.token?.uuid ?? null, item: null, spellcasting: null, rollOptions: [] },
        target: null,
        roll: null
      } : null
    },
    flags: { [MODULE_ID]: { cardId: card.id } }
  };
  const [item] = await actor.createEmbeddedDocuments("Item", [source]);
  if (item) records.push({ type: "created", actorUuid: actor.uuid, itemId: item.id });
}

/**
 * PF2e duration data for a duration key. "Next turn" durations end on the anchor's turn
 * later in this round if it hasn't acted yet, otherwise on its turn in the next round.
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

/** Remove created effects and conditions, restore raised condition values. */
export async function undoRecords(records = []) {
  for (const record of [...records].reverse()) {
    const actor = fromUuidSync(record.actorUuid);
    const item = actor?.items.get(record.itemId);
    if (!item) continue;
    if (record.type === "created") await item.delete();
    else if (record.type === "value") await game.pf2e.ConditionManager.updateConditionValue(item.id, actor, record.previous);
  }
}
