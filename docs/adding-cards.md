# Adding cards

A card has two parts that live in different places:

| Part | Where | Stored in the world? |
| --- | --- | --- |
| Text and filters (title, effect, deck, attack and damage type) | `scripts/default-cards.js` → `DEFAULT_CARDS` | Yes, in the `cards` setting |
| Automation steps | `scripts/automation/default-automation.js` → `DEFAULT_AUTOMATION[cardId]` | No, always read from the code |

The automation is looked up by card ID at draw time (`getAutomation` in `automation/index.js`). Improvements to a default card's automation therefore reach every world with the next module update. Its text doesn't, see [Pitfalls](#pitfalls).

## 1. Add the card text

Add an entry to `DEFAULT_CARDS` in `scripts/default-cards.js`, next to cards of the same kind:

```js
{ id: "hcdHitBludgeon07", deck: "hit", type: "specific", attackType: null, damageType: "bludgeoning", title: "Bell Ringer",
  effect: "The target is Stunned 1. If it is already Stunned, it is Frightened 1 instead." },
```

| Field | Values | Notes |
| --- | --- | --- |
| `id` | 16 characters, unique | Never change an ID once released. Automation, discard piles and exported decks all refer to it. |
| `deck` | `"hit"`, `"fumble"` | |
| `type` | `"general"`, `"specific"` | General cards can be drawn for any roll, and are the only cards drawn for saves and skill checks. |
| `attackType` | `"melee"`, `"ranged"`, `"unarmed"`, `"spell"`, `null` | Specific cards only. `null` = any attack type. |
| `damageType` | a PF2e damage type slug, or leave it out | Specific cards only. Filters only if *Use damage types* is on, or the GM picks one in the manual draw. |
| `title` | text | Shown as is. Card texts are not localized. |
| `effect` | text | Plain text. Foundry enrichers like `[[/r 1d6]]` or `@UUID[...]{...}` work. |

**ID scheme:** `hcd` + `Hit`/`Fum` + a category + a zero-padded number filling the ID to 16 characters. The categories in use are:
- **Card type or attack type:** `General`, `Melee`, `Ranged`, `Unarmed`, `Spell`.
- **Physical damage type:** `Slashing`, `Bludgeon`, `Piercing`.

Examples: `hcdHitGeneral034`, `hcdFumSpell00020`, `hcdHitBludgeon06`. Take the next free number in the category.

**Card label.** The label on the card is built from the card's fields (`cardTypeLabel` in `deck.js`):

| Card | Label |
| --- | --- |
| General card | General |
| Attack type only | e.g. Melee |
| Attack and damage type | e.g. Melee · Slashing |
| Damage type only | e.g. Bludgeoning |
| Specific card with neither | Specific |

**Compendium links.** You don't need to write links. Condition names (any case) and capitalized action names (*Step*, *Raise a Shield*) are linked automatically when the card is shown (`compendium-links.js`). So capitalize actions that should link, and write ordinary words in lower case ("stand up" stays plain text).

## 2. Add the automation

Add the steps under the same ID in `DEFAULT_AUTOMATION`, with a comment naming the card:

```js
// Bell Ringer: Frightened is the alternative if the target is already Stunned
hcdHitBludgeon07: [
  { type: "condition", recipient: "target", condition: "stunned", value: 1 },
  { type: "condition", recipient: "target", condition: "frightened", value: 1, enabled: false }
],
```

The [Automation reference](automation-reference.md) lists every step type and field. Rules of thumb:

- **Automate what PF2e can enforce,** such as conditions, modifiers, damage, temporary HP and weaknesses.
- **"Either/or" cards** get the most likely branch switched on and the other branches as alternatives with `enabled: false`. The GM switches between them in the review dialog.
- **Parts that can't be automated** get a `note` step. These are items, terrain, reactions, "only the next roll", and choices only the players can make. The shared notes at the top of the file (`MANUAL`, `NEXT_ROLL_ONLY`, `BLEED_LINKED`) cover common cases.
- **Reminders without rules** use an `effect` step with a descriptive `name` such as `HCD.Auto.Effects.noStep` ("Can't Step"). The module adds the duration and the card title to the name itself. Without a `name`, the effect is named after the card, which tells the players nothing.
- **Use placeholders instead of fixed numbers** wherever the card scales: `@level`, `@rank`, `@die`.
- **Keep the order of the card text.** Steps are applied and shown in order.

If you add new texts (note texts, effect names), add the keys to **both** `lang/en.json` and `lang/de.json` (see [Development](development.md#localization)).

## 3. Check it

There are no automated tests yet. At minimum:

1. Run `node --check scripts/default-cards.js` and `node --check scripts/automation/default-automation.js`. A missing comma between two cards breaks the whole module.
2. In Foundry, turn on *Card automation*. Then draw the card with the macro, a token selected and a target set, and look at the review dialog:
   - Every line should describe the right creature.
   - Alternatives should show unchecked.
   - Area steps should find the right creatures.
3. Apply it, check the actor, then click *Undo* and check that everything is gone.

## Cards without automation

A default card without a `DEFAULT_AUTOMATION` entry is plain text. The review dialog doesn't open for it, even with automation on.

## Custom cards

Cards created in the Card Manager have random IDs and therefore no default automation. They can carry their own steps in an `automation` array, which takes precedence over `DEFAULT_AUTOMATION`. There is no editor for this yet. For now the steps can be added to an exported deck JSON and imported again:

```json
{ "id": "aB3dE5fG7hJ9kL1m", "deck": "hit", "type": "general", "attackType": null, "title": "My Card",
  "effect": "The target is Frightened 2.", "enabled": true,
  "automation": [{ "type": "condition", "recipient": "target", "condition": "frightened", "value": 2 }] }
```

`normalizeCard` keeps the array, and `normalizeSteps` fills in defaults and drops unknown step types. An empty array (`"automation": []`) switches automation off for that card, even for a default card.

## Pitfalls

- **New default cards don't reach existing worlds by themselves.** `DEFAULT_CARDS` is only the *default value* of the `cards` setting. Once a world has saved its cards (any edit or import in the Card Manager), it keeps its own list, and cards added in a later version are missing there. There is no migration or "restore default cards" button yet. Mention new cards in the changelog, and ideally ship them as an importable JSON file. Automation for cards a world already has always works.
- **Exporting and re-importing with *Append* creates new IDs,** so those copies lose their default automation. *Replace* keeps the IDs.
- **Changing a card's ID** detaches its automation, removes it from discard piles and breaks exported decks. Don't.
- **Titles are used in effect names** ("Can't Step (…) [from: *Title*]"), so keep them short.
