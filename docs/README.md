# Developer documentation

Documentation for people working on the module's code. Players and GMs: see the [README](../README.md) in the repository root.

| Document | What it covers |
| --- | --- |
| [Architecture](architecture.md) | Folder layout, and how a roll turns into a drawn card and then into applied effects |
| [Adding cards](adding-cards.md) | Adding a default card with its automation, step by step, plus the pitfalls |
| [Automation reference](automation-reference.md) | Every step type, recipient, area option, duration, DC source and formula placeholder |
| [Extending the automation](extending-automation.md) | New step types, field kinds, durations or DC sources; the rules every new step must follow |
| [Development](development.md) | Setup, compendium packs, localization, settings, the API, sockets, testing and releases |

## Things to know first

- The module needs Foundry VTT v14 and the PF2e system. There is no build step for the code: Foundry loads `scripts/main.js` as an ES module directly.
- Card automation is **optional** and **off by default** (world setting `automation`). With it off, cards are text only, but condition and action names still link to the PF2e compendiums.
- The GM always confirms automation. A card never changes an actor before the GM clicks *Apply* in the review dialog, and the chat message that follows has an *Undo* button.
- Card texts and automation are stored separately. The text sits in the world's `cards` setting; the automation of default cards ships in the code, keyed by card ID. [Adding cards](adding-cards.md) explains why this matters.
