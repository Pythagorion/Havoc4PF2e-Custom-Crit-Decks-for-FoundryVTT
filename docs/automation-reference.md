# Automation reference

A card's automation is a list of plain JSON **steps**. Everything here is defined in `scripts/automation/schema.js`, which is the single source of truth. The review dialog builds its edit form from it, and a future card editor is meant to do the same.

```js
[
  { type: "condition", recipient: "target", condition: "off-guard", duration: "selfNextStart" },
  { type: "effect", recipient: "self", name: "HCD.Auto.Effects.noStep", duration: "selfNextEnd" }
]
```

Fields a step leaves out get the defaults of its type (`STEP_TYPES[type].defaults`). Every step may also have:

| Field | Meaning |
| --- | --- |
| `enabled: false` | An **alternative**: shown unchecked in the review, so the GM can switch it on ("If the target has no shield, …"). |

## Recipients

| `recipient` | Who |
| --- | --- |
| `self` | The creature that rolled and drew the card |
| `target` | The target of that roll (for manual draws: the GM's current target) |
| `saver` | The creature that rolled a save. Only valid inside the `outcomes` of a `save` step. |
| `area` | Creatures found around a center, see [Area steps](#area-steps) |

A step whose recipient doesn't exist (e.g. no target) is switched off in the plan. The GM can still edit it.

## Step types

| `type` | Fields (default) | What it does |
| --- | --- | --- |
| `condition` | `condition` (`off-guard`), `value` (1), `duration` (`unlimited`) | **Unlimited:** adds the PF2e condition. A valued condition is raised to `value`, never lowered. **Timed:** creates an effect that grants the condition, so both end together. |
| `modifier` | `selector` (`ac`), `modifierType` (`circumstance`), `value` (-1), `against` (`""`), `duration` | Effect with a PF2e `FlatModifier` rule. `predicate` (array, optional, not editable in the dialog) narrows it further, e.g. `["item:ranged"]`. |
| `effect` | `name`, `duration`, `rules` (`[]`) | A named effect. `rules` are PF2e rule elements and can't be edited in the dialog. Without rules, it is a reminder the GM enforces by hand. |
| `damage` | `formula` (`1d6`), `damageType` (`weapon`) | Rolls a PF2e damage roll and applies it (IWR included). Offers "rolled at the table". Needs a token. |
| `persistent` | `formula` (`1d4`), `damageType` (`bleed`) | Adds persistent damage (recovery DC 15). |
| `heal` | `formula` (`@level`) | Heals by the rolled amount. Needs a token. |
| `tempHP` | `formula` (`@level`), `duration` (`minute`) | Effect with a `TempHP` rule. The formula must reduce to a number (no dice). |
| `weakness` | `damageType` (`weapon`), `formula` (`@rank`), `duration` (`selfNextEnd`) | Effect with a `Weakness` rule. The formula must reduce to a number (no dice). |
| `reduceCondition` | `condition` (`frightened`), `value` (1) | Lowers a valued condition. Skipped if the creature doesn't have it. |
| `note` | `text` | Not applied; shown to the GM in the review and in the result message. |
| `save` | `save` (`fortitude`), `dc` (`classDC`), `outcomes` (`{}`) | The recipient rolls; then the steps of the rolled degree of success are applied. See [Saves](#saves). |
| `move` | `mode` (`push`), `from` (`self`), `distance` (5) | The GM places a marker on a highlighted space; the token moves there. See [Movement](#movement). |

`recipient` is a field of every type except `note`.

The `name` and `text` fields may hold a localization key (`HCD.Auto.Effects.noStep`) or plain text.

### Conditions

`condition` is a PF2e condition slug (`CONFIG.PF2E.conditionTypes`), e.g. `frightened`, `off-guard`, `prone`, `stunned`, `persistent-damage`. Whether a condition has a value is read from PF2e, so `value` is ignored for conditions like `prone`.

### Modifiers

| `selector` | Rolls |
| --- | --- |
| `ac`, `perception`, `saving-throw`, `fortitude`, `reflex`, `will`, `skill-check`, `intimidation` | As named |
| `attack-roll`, `damage` | All attacks / all damage |
| `strike-attack-roll`, `strike-damage` | Strikes only |
| `spell-attack-roll`, `spell-dc` | Spells only |
| `all-speeds`, `land-speed` | Speeds (value in feet) |
| `weapon-attack`, `weapon-damage` | The weapon of the triggering attack (falls back to all Strikes) |

`modifierType`: `circumstance`, `status`, `untyped`.

`against` limits the modifier to one opponent:

| `against` | Meaning |
| --- | --- |
| `""` | Any |
| `self` | Only against the drawing creature |
| `target` | Only against the target |
| `notSelf` | Against anyone except the drawing creature |
| `notTarget` | Against anyone except the target |

It works on both sides:
- **Attacks** (attack rolls, damage, skill checks): "against X" means aimed at X, using the predicate `target:signature:…`.
- **Defenses** (`DEFENSE_SELECTORS`: AC and saves): it means against X's attacks or effects, using `origin:signature:…`.

## Durations

The *anchor* is the creature whose turn counts. PF2e counts the duration from the effect's origin, so the module sets the anchor as the origin.

| `duration` | Ends | Anchor |
| --- | --- | --- |
| `unlimited` | When removed | – |
| `selfTurnEnd` | End of the drawing creature's current turn | self |
| `selfNextStart` / `selfNextEnd` | Start / end of the drawing creature's next turn | self |
| `targetNextStart` / `targetNextEnd` | Start / end of the target's next turn | target |
| `ownNextStart` / `ownNextEnd` | Start / end of the recipient's own next turn (for area creatures and savers) | recipient |
| `minute` | 1 minute | – |
| `encounter` | End of the encounter | – |

"Next turn" durations end on the anchor's turn later in this round if it hasn't acted yet (`resolveDuration` in `apply.js`).

**Effect names** are built automatically:
- **Timed:** `{label} ({duration with the anchor's name}) [from: {card title}]`, e.g. *Can't Step (until the end of Valeros's next turn) [from: Overcommitted Lunge]*.
- **Unlimited:** `{label} [from: {card title}]`.

`label` is the step's `name` (effect steps) or its description (conditions, modifiers, temporary HP, weaknesses). Names can't hold links, so the effect's description starts with the linked label, followed by the linked card text.

## Formulas

`formula` fields accept dice expressions and these placeholders (`FORMULA_PLACEHOLDERS`):

| Placeholder | Value | Fallback |
| --- | --- | --- |
| `@level` | Level of the drawing creature | 1 |
| `@rank` | Rank of the triggering spell | 1 |
| `@die` | One damage die of the triggering weapon, e.g. `1d8` | `1d6` |

- **Without dice,** a formula is calculated when the plan is built, so `"floor(@rank / 2)"` shows as a number in the review.
- **Damage categories** in brackets work as in PF2e, e.g. `"1d6[precision]"`.

`damageType: "weapon"` (`WEAPON_DAMAGE`) means the damage type of the triggering attack, or bludgeoning if unknown.

## Area steps

With `recipient: "area"`, a step gets these extra fields (`AREA_FIELDS`, defaults in `AREA_DEFAULTS`):

| Field | Default | Meaning |
| --- | --- | --- |
| `center` | `self` | `self` or `target` |
| `radius` | 5 | In feet; 5 = adjacent |
| `affects` | `creatures` | `enemies`, `allies` (seen from the drawing creature, using PF2e alliances) or `creatures` |
| `pick` | `all` | `all`, or `one` (the closest) |
| `includeCenter` | false | The center creature counts too |
| `excludeTarget` | false | Leave out the target |

Example, "each enemy within 30 feet of you except the target":
```js
{ type: "save", recipient: "area", center: "self", radius: 30, affects: "enemies", excludeTarget: true, save: "will", dc: "classDC", outcomes: { … } }
```

**Finding the creatures.** When the plan is built, `planArea` searches the tokens on the current scene. It skips defeated creatures and non-creatures, and stores `candidates` (all matches) and `chosen` (who is affected). In the review the GM can:
- tick and untick candidates in edit mode.
- click **Use selected tokens** to use the tokens selected on the canvas instead.

**Limit.** With `pick: "one"` at most one creature may be chosen, whether through the checkboxes or the selection. `areaLimit` in `apply.js` enforces it.

## Saves

```js
{
  type: "save", recipient: "target", save: "reflex", dc: "classDC",
  outcomes: {
    success: [],
    failure: [{ type: "condition", recipient: "saver", condition: "prone" }]
  }
}
```

- **`save`:** `fortitude`, `reflex`, `will`, or `flat` (a flat check: success or failure only).
- **`dc`:** a number, or a `DC_SOURCES` key:
  - `classDC`: the drawing creature's class DC.
  - `spellDC`: its best spell DC, or its class DC if it can't cast spells.
  - `targetHard`: the hard DC for the target's level.

  NPCs without a class DC use the DC for their level.
- **`outcomes`** maps `criticalSuccess`, `success`, `failure`, `criticalFailure` to step lists:
  - **A missing critical outcome** falls back to the plain one (`OUTCOME_FALLBACK`).
  - **An empty list** means "nothing happens".
  - **Outcome steps** usually use `recipient: "saver"`, but `self` and `target` work too.
- **Each creature of an area save rolls separately.**
- **Who rolls:** a creature owned by a connected player gets a chat card for that player to roll. Otherwise the GM rolls, or enters a result rolled at the table.

## Movement

```js
{ type: "move", recipient: "target", mode: "push", from: "self", distance: 10 }
```

| `mode` | The recipient moves |
| --- | --- |
| `push` | Away from `from` |
| `free` | To any space |
| `adjacent` | To a space adjacent to `from` |

- **`distance`:** feet, or `speed` / `halfSpeed` (of the moving creature's land Speed, rounded down to 5 ft).
- **Placing:** after the GM applies the plan, the allowed spaces are highlighted. The GM left-clicks one; right-click or Esc skips the step.
- **Requirements:** the scene must have a grid, and the token must be on the scene the GM is viewing.
- **Undo:** moves the token back.

Forced movement ignores movement cost, but spaces behind walls are not offered.
