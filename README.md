# Havoc4PF2e - Custom Crit Decks for FoundryVTT

This module for FoundryVTT (Version 14) is a custom critical card deck for Pathfinder 2e. I know that there is a function for critical decks already on-board, but I made this module anyways as I wanted to implement some features the default solution couldn't give me. The Module comes with a base deck of cards, but you can add custom cards on your own through the module's Card Manager. By now, the cards only consist of plain text which does not interact with the ruleset, so every effect on the cards must be applied by the GMs manually (automatic application is something I want to implement in the future though). The module also comes with some settings for you to customize your experience with the module. Just look them up in the module's own settings.

## What is different to the known card decks from Paizo?
Instead of just replicating the critical card decks from Paizo, i chose to go for a new approach on the card types. There are two card types: `specific cards` and `general cards`. The specific cards are these you already know: They are specified by damage type (such as piercing or slashing) and/or attack type (such as melee or unarmed). A new category I added are the "general cards". They are neither bound to a damage type nor a attack type. They can be used universal in any scenario. The module will draw them no matter what attack or damage type triggered the card deck. 

Another driving force for me to develop this module were some cards that are too powerful. In the official deck there are cards which can kill characters in an instant (e.g. when they fail a save), so with some bad luck someone could die easily. Although the critical card decks count as "variant rules", such cards always feel unfair, so I tried to design cards that will not kill anyone without them to be able to intervene (if you liked these cards, you can add them on your own via the Card manager mentioned above). 

## Future plans for this module
The next step would be to actually implement the integration into the Pathfinder 2e Foundry System, meaning: As I mentioned before the cards are only plain text at the moment. One of my future plans would be to give the cards functionaliy automatically applying their effect to characters. 
Another plan would be to add more different card types. I thought of specific cards based on e.g. ancestries or classes or even just traits. This way the variety of this module could go further. 
Other plans would be to add support for other developers to add more cards via "add-on modules". By now the cards are added via hard-code directly into the module itself. In the future it should be possible for others to add new content to this module. 

## Transparency about AI Usage
This module is NOT a Zero AI module. I used AI while developing this module in the following ways: 
- Brainstorming for Card ideas (I have not blindly copied any text from the AI, but the AI generated me ideas I based on the final card texts)
- Assisting in Coding. I used Claude for reviewing my code and giving me hints to improve my code. I also used Claude for doing some research how to implement features I did not know how to implement.
- Help with Documentation: While this README is written by myself, Claude helped me with documenting the code itself. I wrote the initial comments for the functions just for me. As I am not really good in documenting code for others, I asked Claude to revise my code comments so that others could understand what I was doing (or what the code does)

I did NOT vibe code this module and I will NOT accept any merge requests which were vibe coded.

## License & Legal Notice:
- **The Code:** The source code of Havoc4PF2e is licensed under the MIT License (as stated in the LINCENSE.MD of this repository).
- **Compatibility & Content:** Havoc4PF2e is an independent module for Foundry VTT and is not affiliated with or endorsed by Paizo Inc. Pathfinder and associated marks/logos are trademarks of Paizo Inc. This product uses Open Game Content under the Open Game License v1.0a / ORC License. The FoundryVTT software and its associated marks/logos are trademarks of Foundry Gaming, LLC. All rights belong to their respective owners.
