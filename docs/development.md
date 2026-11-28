# Development

## Setup

The module code needs no build step. Foundry loads the files in `scripts/`, `templates/`, `styles/` and `lang/` as they are. To work on it, put (or link) the repository folder into Foundry's `Data/modules/havoc-critdeck` folder, and reload Foundry (F5) after each change.

Node.js is only needed for the compendium packs:

```
npm install
```

To check PF2e APIs, the installed system's source is at `%LOCALAPPDATA%/FoundryVTT/Data/systems/pf2e/pf2e.mjs` (minified, but searchable).

## Compendium packs

The module ships one pack, **Critical Deck Macros** (`packs/macros`), with the *Draw Critical Card* macro.

| Path | What |
| --- | --- |
| `packs/_source/macros/*.json` | Editable source, one JSON file per document |
| `packs/macros/` | Compiled LevelDB that Foundry loads. Don't edit it by hand. |

```
npm run pack     # packs/_source -> packs   (after editing the JSON source, and before every release)
npm run unpack   # packs -> packs/_source   (after changing documents inside Foundry)
```

**Close Foundry first:** a running world locks the LevelDB files.

The macro only calls `game.modules.get("havoc-critdeck").api.manualDraw()`. Changes to the manual draw therefore need no new pack, only changes to the macro's own command, name or icon do.

## Localization

- **Files:** all UI text is in `lang/en.json` and `lang/de.json`. Keys start with `HCD.`, and **both files must contain every key**. A missing key shows up as the raw key in the UI.
- **Card texts** (`default-cards.js`) are not localized; titles and effects are English.
- **Automation texts that end up in documents** are localization keys in the steps (effect names `HCD.Auto.Effects.*`, notes `HCD.Auto.Notes.*`). They are translated when the plan is built, so an effect gets the GM's language at the time it is created.
- **PF2e terms:** match the official PF2e translation. Condition and damage type names come from PF2e itself (`CONFIG.PF2E`), so they are always right.
- **Placeholders** use `{name}` syntax with `format()` from `utils.js`. Use `localize()` for keys without placeholders.

Main key groups:

| Group | Used for |
| --- | --- |
| `HCD.Settings.<key>.Name` / `.Hint` | Settings |
| `HCD.Manual.*` | Manual draw dialog |
| `HCD.Auto.Review.*` | Review dialog |
| `HCD.Auto.Describe.*` | Step descriptions |
| `HCD.Auto.Field.*` | Edit-form labels |
| `HCD.Auto.Effects.*`, `HCD.Auto.Notes.*` | Effect names and reminder notes of default cards |

## Settings

Registered in `scripts/settings.js`. `register()` creates GM-only world settings by default, labelled `HCD.Settings.<key>.Name` and `.Hint`.

| Key | Scope | Purpose |
| --- | --- | --- |
| `enableHitDeck`, `enableFumbleDeck` | world | Turn the decks on or off |
| `triggerAttacks`, `triggerSaves`, `triggerSkills`, `triggerAllRolls` | world | Which rolls can trigger |
| `triggerMode`, `hitNaturals`, `fumbleNaturals` | world | Naturals and/or degree of success |
| `triggerActors` | world | Player characters only, or all actors |
| `gmPrompt` | world | Ask the GM before drawing, or draw right away |
| `playerDraw` | world | Players pick from face-down cards, or the GM draws |
| `useDamageTypes` | world | Filter specific cards by the attack's damage type |
| `deckBehavior` | world | Put cards back, or discard until reshuffled |
| `revealPopup` | world | Show the revealed card to everyone |
| `automation` | world | Card automation (default off) |
| `cardRolls` | world | Ask about dice rolled at the table, or always roll in Foundry |
| `animations` | client | Card animations |
| `cards` | world, hidden | All cards; its default is `DEFAULT_CARDS` |
| `discardPile` | world, hidden | Discarded card IDs per deck |
| `manualDrawOptions` | user, hidden | The options last used in the manual draw |

## Public API

The API is at `game.modules.get("havoc-critdeck").api` and is set up in `main.js`. Macros and other modules may use it, so keep these signatures stable:

| Function | Purpose |
| --- | --- |
| `manualDraw(defaults?)` | The manual draw dialog (used by the bundled macro). `defaults` can preselect `deck`, `attackType`, `generalCards`, `damageType`, `actorUuid`, `chooserId`. |
| `beginDraw(trigger)` | Draw the way the settings want (GM window or player draw) |
| `openDraw(trigger)` | GM draw window, e.g. `{ deck: "fumble", attackType: "melee" }` |
| `startPlayerDraw(trigger)` | Player draw |
| `drawCard(deck, filter?)` | Draw a random card without showing it |
| `revealCard(card, info?)` | Post a card to chat (and offer its automation) |
| `getCards()` | All cards of the world |
| `getAutomation(card)` | A card's normalized automation steps |
| `openManager()` | The Card Manager |
| `reshuffle(deck?)` | Clear the discard pile |

A `trigger` is `{ deck, rollKind, attackType, damageTypes, excludeGeneral, matchDamage, info }`, see [Architecture](architecture.md#from-roll-to-card).

## Conventions

- **Foundry v14 APIs only.** Use `foundry.applications.api.ApplicationV2` with `HandlebarsApplicationMixin`, or `DialogV2`, and `foundry.applications.handlebars.renderTemplate`. Don't use the old `Application`, `Dialog` or global `renderTemplate`.
- **ApplicationV2 template parts** must render exactly one root element. Wrap the template in a `<div>`, or Foundry throws *Template part "main" must render a single HTML element*.
- **Listeners on the application's root element** (`this.element`, delegated listeners) go in `_onFirstRender`, because the root survives re-renders and listeners added in `_onRender` pile up. Listeners on elements inside a template part can stay in `_onRender`, because the part's HTML is replaced on every render.
- **GM-only work** (evaluating rolls, applying automation, owning a player-draw session) runs on `game.users.activeGM` or checks `game.user.isGM`. Players reach it through the socket.
- **Data in sockets and chat flags** must be JSON. Pass UUIDs, not documents.
- **New templates** need a path in `TEMPLATES` (`constants.js`) so they are preloaded.

## Testing

There are no automated tests. Before a release, at least:

1. Run `node --check` on every changed `.js` file. A syntax error stops the whole module from loading; it shows in the browser console as *Uncaught SyntaxError*.
2. Check that every key used in the code exists in both language files.
3. In a PF2e test world (watch the console, F12):
   - Roll a natural 20 and a natural 1 on an attack. Try both GM draw and player draw, and the GM prompt.
   - Use the manual draw macro with different options. Reopen it and check that it remembers them.
   - With automation on, try one card of each kind:
     - a simple condition.
     - a timed effect: check its name and that it expires.
     - a save, rolled by a player and by the GM, and entered as rolled at the table.
     - an area card: with and without auto-found creatures, and with *Use selected tokens*.
     - a movement card.
     - damage.

     Use *Undo* on each.
   - With automation off, the review must never open, and compendium links must still work.

## Releases

1. Update `module.json`:
   - `version`.
   - **and** the version in the `download` URL.

   Both must match the release tag.
2. Run `npm run pack` if the pack source changed.
3. Write the changelog. Mention any new default cards, because existing worlds don't get them by themselves (see [Adding cards](adding-cards.md#pitfalls)).
4. Create `havoc-critdeck.zip` with `module.json` at the top level, plus `scripts/`, `templates/`, `styles/`, `lang/`, `packs/`, `LICENSE` and `README.md`. Leave out `node_modules/`, and build the zip with Foundry closed (`packs/macros/LOCK`).
5. Attach `module.json` and the zip to the GitHub release. The manifest URL points to `releases/latest/download/module.json`.
