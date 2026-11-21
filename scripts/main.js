import { MODULE_ID, SOCKET, TEMPLATES } from "./constants.js";
import { registerSettings } from "./settings.js";
import { onCreateChatMessage } from "./trigger.js";
import { bindPromptListeners } from "./prompt.js";
import { onSocketMessage, revealCard } from "./reveal.js";
import { beginDraw, onPlayerDrawSocket, startPlayerDraw } from "./player-draw.js";
import { drawCard, getCards, reshuffle } from "./deck.js";
import { openDrawApp } from "./apps/card-draw.js";
import { CardManager } from "./apps/card-manager.js";
import { openManualDraw } from "./manual-draw.js";
import { localize } from "./utils.js";
import { bindResultListeners, bindSaveListeners, getAutomation, onAutomationSocket } from "./automation/index.js";

Hooks.once("init", () => {
  registerSettings();
  foundry.applications.handlebars.loadTemplates(Object.values(TEMPLATES));

  game.modules.get(MODULE_ID).api = {
    /** Open the GM draw window, e.g. from a macro: api.openDraw({ deck: "fumble", attackType: "melee" }) */
    openDraw: openDrawApp,
    /** Start a public player draw: api.startPlayerDraw({ deck: "hit", info: { userId: "<user id>" } }) */
    startPlayerDraw,
    /** Draw the way the module settings want (GM window or player draw) */
    beginDraw,
    /** Ask the GM for deck, attack type and creature, then draw without a roll (used by the bundled macro) */
    manualDraw: openManualDraw,
    openManager: () => new CardManager().render({ force: true }),
    drawCard,
    revealCard,
    getCards,
    /** The automation steps of a card (see scripts/automation/schema.js) */
    getAutomation,
    reshuffle
  };
});

Hooks.once("ready", () => {
  if (game.system.id !== "pf2e" && game.user.isGM) ui.notifications.warn(localize("HCD.Warn.NotPF2e"));
  game.socket.on(SOCKET, (data) => {
    if (data?.action?.startsWith("pd-")) onPlayerDrawSocket(data);
    else if (data?.action?.startsWith("auto-")) onAutomationSocket(data);
    else onSocketMessage(data);
  });
});

Hooks.on("createChatMessage", onCreateChatMessage);
Hooks.on("renderChatMessageHTML", bindPromptListeners);
Hooks.on("renderChatMessageHTML", bindResultListeners);
Hooks.on("renderChatMessageHTML", bindSaveListeners);
