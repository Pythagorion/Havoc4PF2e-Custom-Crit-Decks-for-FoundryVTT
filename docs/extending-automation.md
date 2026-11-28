# Extending the automation

The step schema in `scripts/automation/schema.js` drives the review dialog's edit form. It is meant to drive a future card editor and logic editor as well. Keep it that way: anything a step can do should be described there, not hard-coded in the dialog.

## Ground rules

Every new feature should keep these guarantees:

1. **Nothing happens without the GM.** Steps are applied only after *Apply* in the review dialog (`AutomationReview`). Anything chosen on the canvas (creatures, spaces) happens after that click, and can be skipped.
2. **Everything can be undone.** Each change to a document gets an undo record (see [Undo records](#undo-records)). The only exception is damage and healing, where PF2e's own damage message already offers an undo.
3. **Every roll can be made at the table.** GMs may play with physical dice. A step that rolls must ask first when `askForRolls()` is true, and let the GM enter the result (`table-rolls.js`). Saves and damage already do.
4. **Players roll for their own creatures.** If a connected player owns the creature, they roll themselves (see `saves.js`).
5. **Automation stays optional.** With the `automation` setting off, no automation code may change anything. Card texts and compendium links must work on their own.
6. **Fail safely.** An apply function may throw. `applyPlan` catches the error, logs it and shows a notification naming the step, then carries on with the other steps.

## Adding a step type

Example: a hypothetical `resistance` step.

### 1. Schema (`schema.js`)

```js
resistance: {
  icon: "fa-solid fa-shield",
  fields: { recipient: "recipient", damageType: "damageType", formula: "formula", duration: "duration" },
  defaults: { recipient: "self", damageType: WEAPON_DAMAGE, formula: "@level", duration: "selfNextStart" }
}
```

- **`fields` maps each editable field to a *field kind*:**
  - **Generic kinds**, rendered without any extra code: `number` and `dc` (number input), `boolean` (checkbox), and `text` and `formula` (text input).
  - **Select kinds:** `recipient`, `center`, `condition`, `duration`, `selector`, `modifierType`, `against`, `damageType`, `save`, `affects`, `pick`, `moveMode`, `distance`. Their options come from `#choices()` in `review.js`.
- **Fields that aren't editable** (like `rules` or `predicate`) go only in `defaults`, or in the step data.
- **`normalizeSteps`** fills in the defaults, and drops steps whose type isn't in `STEP_TYPES`.

### 2. Apply function (`apply.js`, `APPLY`)

```js
async resistance(step, creature, ctx) {
  const rule = { key: "Resistance", type: step.damageType, value: Math.max(Number(step.formula) || 1, 1) };
  await createEffect(creature, ctx, { label: describeEffect(step, ctx.creatures), rules: [rule], duration: step.duration });
}
```

- **Signature:** `(step, creature, ctx)`.
  - `creature` is `{ actor, token }`.
  - `ctx` is `{ creatures, card, records, name, info }`.
- **Formulas** are already resolved: placeholders are filled in, and dice-free formulas are calculated.
- **Return `false`** if the step wasn't applied (the GM skipped it, or nothing to do). It then won't show in the result message.
- **Effects:** use `createEffect`. It handles the name, duration, origin, description with compendium links, the card flag and the undo record.

### 3. Description (`apply.js`)

The review and the result message describe each step in one line.
- **Steps that create an effect:** add a case to `describeEffect`. The text becomes the effect's label and name too, e.g. "Resistance 5 to fire".
- **Other steps:** add a case to `describeStep`.

### 4. Localization (`lang/en.json` and `lang/de.json`)

- `HCD.Auto.Field.<field>` for each new field.
- `HCD.Auto.Describe.<type>` for the description.
- Labels for any new select options.

Both files need every key.

### 5. Undo (`undoRecords`), if needed

`createEffect` and conditions already record what they create. A step that changes something else needs its own record type (see below).

## Undo records

`ctx.records` collects plain objects. They are stored in the result message and replayed in reverse by `undoRecords`:

| `type` | Fields | Undo |
| --- | --- | --- |
| `created` | `actorUuid`, `itemId` | Delete the item |
| `value` | `actorUuid`, `itemId`, `previous` | Set the condition back to `previous` |
| `reduced` | `actorUuid`, `condition`, `itemId`, `previous` | Restore the value, re-creating the condition if it was removed |
| `move` | `tokenUuid`, `x`, `y` | Move the token back (`action: "displace"`) |

New record types need a branch in `undoRecords`. Records must be JSON (UUIDs and numbers, never documents), because they live in chat message flags.

## Other extension points

| To add | Change |
| --- | --- |
| A duration | `DURATIONS` in `schema.js`, using an `anchor` of `self`, `target` or `recipient` for turn-based ones. Add `HCD.Auto.Duration.<key>`, plus `HCD.Auto.EffectName.Duration.<key>` if it has an anchor. |
| A DC source | `DC_SOURCES` in `schema.js`, a `case` in `resolveDC` (`apply.js`), and `HCD.Auto.DC.<key>`. |
| A modifier selector | `MODIFIER_SELECTORS`, plus `DEFENSE_SELECTORS` if it's a defense (so `against` uses `origin:`). Add `HCD.Auto.Selector.<key>`. |
| A formula placeholder | `FORMULA_PLACEHOLDERS`, `formulaVars` and `resolveFormula` in `apply.js`. The value usually comes from `info`, so add it in `trigger.js` (and `manual-draw.js` for draws without a roll). |
| A recipient or center | `RECIPIENTS` / `CENTERS`, and `resolveCreatures`. The creature must be stored in `info` as UUIDs, because `info` travels through sockets and chat flags. |
| A movement mode | `MOVE_MODES`, and `findDestinations` in `placement.js`. |
| A new field kind with options | `#choices()` in `review.js`. |

## Plan vs. steps

- **Steps** are what a card stores: localization keys, placeholders, DC source names.
- **The plan** (`buildPlan`) is one draw's resolved copy of the steps: localized names, numbers, chosen creatures. The GM edits the plan, never the card.

Put anything that depends on the current draw in `buildPlan`, or in the apply functions. Never write it back into the card.

## Toward a card editor

What is already in place:

- **Self-describing steps.** Types, fields, field kinds, defaults and options are all in `schema.js`.
- **Generic editing.** The review dialog edits any step from that description, including nested save outcomes (`#flatten` in `review.js`).
- **Stored automation.** Custom cards keep an `automation` array (`normalizeCard`). The Card Manager keeps it when a card is saved, and `getAutomation` prefers it over `DEFAULT_AUTOMATION`.

What an editor still needs:
- adding, removing and reordering steps and outcomes.
- editing `rules` and `predicate`.
- a place in the Card Manager.
