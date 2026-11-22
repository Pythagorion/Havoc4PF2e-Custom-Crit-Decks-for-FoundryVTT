import { ATTACK_TYPES, DECKS, GENERAL_ONLY, TEMPLATES } from "./constants.js";
import { damageTypeLabel, getCardDamageTypes, getPool } from "./deck.js";
import { getSetting, localize, setSetting } from "./utils.js";
import { beginDraw } from "./player-draw.js";

/*
 * Manual draw: lets the GM start a draw without a triggering roll, e.g. from the
 * "Draw Critical Card" macro in the module's compendium (packs/_source/macros). The draw itself runs exactly like a triggered one (GM window or
 * player draw, depending on the settings), so the GM can still decline the card.
 */

const GM_CHOOSER = "gm";
const GENERAL_CHOICES = { include: "HCD.Manual.General.include", exclude: "HCD.Manual.General.exclude" };

/** "Any" plus the damage types of the cards that fit the deck and attack type, by name. */
function damageChoicesFor(deck, attackType) {
  const types = getCardDamageTypes(deck, attackType)
    .map((type) => [type, damageTypeLabel(type)])
    .sort((a, b) => a[1].localeCompare(b[1]));
  return { "": localize("HCD.DamageType.any"), ...Object.fromEntries(types) };
}

/**
 * Keep the dialog in line with the chosen deck and attack type: "General cards" only matters
 * unless general cards are drawn anyway, and the damage types offered are those of the fitting cards
 * (hidden if no card fits a damage type).
 */
function updateDialog(form) {
  const deck = form.elements.deck.value;
  const attackType = form.elements.attackType.value;
  form.querySelector("[data-row=generalCards]").hidden = attackType === GENERAL_ONLY;
  const select = form.elements.damageType;
  const choices = damageChoicesFor(deck, attackType);
  const selected = select.value in choices ? select.value : "";
  select.replaceChildren(...Object.entries(choices).map(([value, label]) => new Option(label, value, false, value === selected)));
  form.querySelector("[data-row=damageType]").hidden = Object.keys(choices).length < 2;
}

/**
 * Ask the GM which deck to draw from (and for whom), then start the draw.
 * The dialog starts with the options the GM picked last time; a selected token takes precedence for the actor.
 * @param {object} [defaults]  Preselected values: { deck, attackType, generalCards, damageType, actorUuid, chooserId }
 */
export async function openManualDraw(defaults = {}) {
  if (!game.user.isGM) return ui.notifications.warn(localize("HCD.Warn.GMOnly"));

  const last = getSetting("manualDrawOptions") ?? {};
  const actors = getActorChoices();
  const selectedActor = canvas?.tokens?.controlled?.[0]?.actor ?? null;
  let actorUuid = defaults.actorUuid ?? selectedActor?.uuid ?? last.actorUuid ?? "";
  if (!(actorUuid in actors)) actorUuid = "";
  const playerDraw = getSetting("playerDraw");

  const deckChoices = Object.fromEntries(Object.entries(DECKS).map(([key, deck]) => [key, deck.label]));
  const attackChoices = { "": "HCD.AttackType.any", [GENERAL_ONLY]: "HCD.AttackType.none", ...ATTACK_TYPES };
  const chooserChoices = getChooserChoices();
  // The last chooser only fits if the actor is still the same one
  const lastChooser = actorUuid === (last.actorUuid ?? "") ? last.chooserId : undefined;
  const pick = (value, choices, fallback) => (value != null && value in choices ? value : fallback);
  const deck = pick(defaults.deck ?? last.deck, deckChoices, "hit");
  const attackType = pick(defaults.attackType ?? last.attackType, attackChoices, "");
  // All damage types for now; the dialog narrows them down to the fitting ones when it opens
  const damageChoices = { "": localize("HCD.DamageType.any"), ...Object.fromEntries(
    getCardDamageTypes(deck, "").map((type) => [type, damageTypeLabel(type)])) };

  const content = await foundry.applications.handlebars.renderTemplate(TEMPLATES.manualDraw, {
    deckChoices,
    deck,
    attackChoices,
    attackType,
    generalChoices: GENERAL_CHOICES,
    generalCards: pick(defaults.generalCards ?? last.generalCards, GENERAL_CHOICES, "include"),
    damageChoices,
    damageType: pick(defaults.damageType ?? last.damageType, damageChoices, ""),
    actorChoices: { "": localize("HCD.Manual.NoActor"), ...actors },
    actorUuid,
    playerDraw,
    chooserChoices,
    chooserId: pick(defaults.chooserId ?? lastChooser, chooserChoices, defaultChooser(actorUuid))
  });

  const data = await foundry.applications.api.DialogV2.wait({
    window: { title: "HCD.Manual.Title", icon: "fa-solid fa-hand-sparkles" },
    position: { width: 400 },
    content,
    buttons: [
      {
        action: "draw",
        label: "HCD.Prompt.Draw",
        icon: "fa-solid fa-hand-sparkles",
        default: true,
        callback: (event, button) => new foundry.applications.ux.FormDataExtended(button.form).object
      },
      { action: "cancel", label: "HCD.PlayerDraw.Cancel", icon: "fa-solid fa-xmark" }
    ],
    render: (event, dialog) => {
      const form = dialog.element.querySelector("form") ?? dialog.element;
      updateDialog(form);
      form.addEventListener("change", (e) => {
        if (["deck", "attackType"].includes(e.target.name)) updateDialog(form);
      });
    },
    rejectClose: false
  });
  if (!data || typeof data !== "object") return;
  // Fields hidden by the current settings keep their previously saved value
  await setSetting("manualDrawOptions", { ...last, ...data });

  const drawDeck = data.deck in DECKS ? data.deck : "hit";
  const filter = {
    attackType: data.attackType || null,
    // "General cards only" ignores the general cards option
    excludeGeneral: data.attackType !== GENERAL_ONLY && data.generalCards === "exclude",
    damageTypes: [],
    matchDamage: false
  };
  // A damage type only counts if the deck has fitting cards with it (the row was shown)
  if (data.damageType && getCardDamageTypes(drawDeck, data.attackType ?? "").includes(data.damageType)) {
    filter.damageTypes = [data.damageType];
    filter.matchDamage = true;
  }
  if (!getPool(drawDeck, filter).length) return ui.notifications.warn(localize("HCD.Manual.NoCards"));

  const actor = data.actorUuid ? fromUuidSync(data.actorUuid) : null;
  // Without a roll, the card automation uses the selected token and the GM's current target
  const token = canvas?.tokens?.controlled?.find((t) => t.actor === actor)?.document ?? null;
  const target = game.user.targets.first()?.document ?? null;
  const chooserId = data.chooserId === GM_CHOOSER || !data.chooserId ? game.user.id : data.chooserId;
  return beginDraw({
    deck: drawDeck,
    rollKind: "manual",
    ...filter,
    chooserId,
    info: {
      actorName: actor?.name ?? "",
      itemName: "",
      natural: null,
      sourceMessageId: null,
      userId: chooserId,
      actorUuid: actor?.uuid ?? null,
      tokenUuid: token?.uuid ?? null,
      targetActorUuid: target?.actor?.uuid ?? null,
      targetTokenUuid: target?.uuid ?? null
    }
  });
}

/** Player characters plus the actors of all selected tokens. */
function getActorChoices() {
  const actors = new Map();
  for (const token of canvas?.tokens?.controlled ?? []) {
    if (token.actor) actors.set(token.actor.uuid, token.actor.name);
  }
  for (const actor of game.actors.filter((a) => a.hasPlayerOwner).sort((a, b) => a.name.localeCompare(b.name))) {
    actors.set(actor.uuid, actor.name);
  }
  return Object.fromEntries(actors);
}

/** Who picks the card in a player draw: an active player or the GM. */
function getChooserChoices() {
  const choices = { [GM_CHOOSER]: localize("HCD.Manual.ChooserGM") };
  for (const user of game.users.filter((u) => u.active && !u.isGM)) choices[user.id] = user.name;
  return choices;
}

/** An active player owning the actor, otherwise the GM. */
function defaultChooser(actorUuid) {
  const actor = actorUuid ? fromUuidSync(actorUuid) : null;
  const owner = actor && game.users.find((u) => u.active && !u.isGM && actor.testUserPermission(u, "OWNER"));
  return owner?.id ?? GM_CHOOSER;
}
