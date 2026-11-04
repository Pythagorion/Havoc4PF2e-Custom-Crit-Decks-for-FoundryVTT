import { MODULE_ID } from "./constants.js";
import { DEFAULT_CARDS } from "./default-cards.js";
import { CardManager } from "./apps/card-manager.js";

export function registerSettings() {
  const register = (key, data) => game.settings.register(MODULE_ID, key, {
    name: `HCD.Settings.${key}.Name`,
    hint: `HCD.Settings.${key}.Hint`,
    scope: "world",
    config: true,
    restricted: true,
    ...data
  });
  const choices = (key, values) => Object.fromEntries(values.map((v) => [v, `HCD.Settings.${key}.${v}`]));

  game.settings.registerMenu(MODULE_ID, "cardManager", {
    name: "HCD.Settings.cardManager.Name",
    label: "HCD.Settings.cardManager.Label",
    hint: "HCD.Settings.cardManager.Hint",
    icon: "fa-solid fa-layer-group",
    type: CardManager,
    restricted: true
  });

  register("enableHitDeck", { type: Boolean, default: true });
  register("enableFumbleDeck", { type: Boolean, default: true });

  // Which rolls can trigger a deck
  register("triggerAttacks", { type: Boolean, default: true });
  register("triggerSaves", { type: Boolean, default: false });
  register("triggerSkills", { type: Boolean, default: false });
  register("triggerAllRolls", { type: Boolean, default: false });

  register("triggerMode", {
    type: String,
    default: "natural",
    choices: choices("triggerMode", ["natural", "degree", "either", "both"])
  });
  register("hitNaturals", { type: String, default: "20" });
  register("fumbleNaturals", { type: String, default: "1" });
  register("triggerActors", {
    type: String,
    default: "players",
    choices: choices("triggerActors", ["players", "all"])
  });
  register("gmPrompt", {
    type: String,
    default: "ask",
    choices: choices("gmPrompt", ["ask", "auto"])
  });
  register("playerDraw", { type: Boolean, default: true });
  register("useDamageTypes", { type: Boolean, default: false });
  register("deckBehavior", {
    type: String,
    default: "replace",
    choices: choices("deckBehavior", ["replace", "discard"])
  });
  register("revealPopup", { type: Boolean, default: true });
  register("animations", { type: Boolean, default: true, scope: "client", restricted: false });

  // Hidden data storage
  game.settings.register(MODULE_ID, "cards", {
    scope: "world",
    config: false,
    type: Array,
    default: foundry.utils.deepClone(DEFAULT_CARDS)
  });
  game.settings.register(MODULE_ID, "discardPile", {
    scope: "world",
    config: false,
    type: Object,
    default: { hit: [], fumble: [] }
  });}
