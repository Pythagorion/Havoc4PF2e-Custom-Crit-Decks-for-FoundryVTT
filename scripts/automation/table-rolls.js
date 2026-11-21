import { DEGREES } from "../constants.js";
import { escapeHTML, format, getSetting, localize } from "../utils.js";

/*
 * Dice rolled at the table. Unless the "cardRolls" setting says to always roll in Foundry,
 * the GM is asked before every roll a card needs: enter the result rolled at the table,
 * or let Foundry roll.
 */

const { DialogV2 } = foundry.applications.api;

/** Whether the GM wants to be asked before card rolls. */
export function askForRolls() {
  return getSetting("cardRolls") !== "foundry";
}

/**
 * Ask how a save is rolled.
 * @param {object} options
 * @param {string} options.title       Card title.
 * @param {string} options.check       E.g. "Goblin: Fortitude save DC 24".
 * @param {boolean} options.flat       Flat check: success and failure only.
 * @param {boolean} options.playerRolls A player rolls in Foundry (chat card) instead of the GM.
 * @returns {Promise<number|"foundry"|null>}  Degree of success index, "foundry", or null if closed.
 */
export async function askSaveResult({ title, check, flat, playerRolls }) {
  const degrees = flat ? [2, 1] : [3, 2, 1, 0];
  const action = await DialogV2.wait({
    window: { title: format("HCD.Auto.TableRoll.SaveTitle", { title }), icon: "fa-solid fa-dice-d20" },
    classes: ["hcd-table-roll"],
    position: { width: 440 },
    content: `<p><strong>${escapeHTML(check)}</strong></p><p class="hint">${localize("HCD.Auto.TableRoll.SaveHint")}</p>`,
    buttons: [
      ...degrees.map((d) => ({ action: `degree-${d}`, label: `HCD.Auto.Degree.${DEGREES[d]}` })),
      {
        action: "foundry",
        label: playerRolls ? "HCD.Auto.TableRoll.PlayerRolls" : "HCD.Auto.TableRoll.Foundry",
        icon: "fa-solid fa-dice-d20",
        default: true
      }
    ],
    rejectClose: false
  });
  if (action === "foundry") return "foundry";
  const degree = Number(/^degree-(\d)$/.exec(action ?? "")?.[1]);
  return Number.isInteger(degree) ? degree : null;
}

/**
 * Ask how damage is rolled.
 * @param {object} options
 * @param {string} options.title   Card title.
 * @param {string} options.damage  E.g. "Valeros: 1d6 slashing damage".
 * @returns {Promise<number|"foundry"|null>}  Total rolled at the table, "foundry", or null if closed.
 */
export async function askDamage({ title, damage }) {
  const result = await DialogV2.wait({
    window: { title: format("HCD.Auto.TableRoll.DamageTitle", { title }), icon: "fa-solid fa-heart-crack" },
    classes: ["hcd-table-roll"],
    position: { width: 400 },
    content: `<p><strong>${escapeHTML(damage)}</strong></p>
      <div class="form-group">
        <label>${localize("HCD.Auto.TableRoll.DamageTotal")}</label>
        <input type="number" name="total" min="0" step="1">
      </div>`,
    buttons: [
      {
        action: "table",
        label: "HCD.Auto.TableRoll.ApplyTotal",
        icon: "fa-solid fa-check",
        callback: (event, button) => {
          const total = button.form.elements.total.valueAsNumber;
          return Number.isFinite(total) ? Math.max(Math.trunc(total), 0) : null;
        }
      },
      { action: "foundry", label: "HCD.Auto.TableRoll.Foundry", icon: "fa-solid fa-dice", default: true }
    ],
    rejectClose: false
  });
  return typeof result === "number" || result === "foundry" ? result : null;
}
