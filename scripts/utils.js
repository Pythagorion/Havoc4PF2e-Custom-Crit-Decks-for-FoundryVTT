import { MODULE_ID } from "./constants.js";

export const getSetting = (key) => game.settings.get(MODULE_ID, key);
export const setSetting = (key, value) => game.settings.set(MODULE_ID, key, value);

export const localize = (key) => game.i18n.localize(key);
export const format = (key, data) => game.i18n.format(key, data);

export const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function animationsEnabled() {
  return getSetting("animations") && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Parse a list like "20" or "1, 2" or "18-20" into a Set of numbers.
 * @param {string} value
 * @returns {Set<number>}
 */
export function parseNumberList(value) {
  const result = new Set();
  for (const raw of String(value ?? "").split(/[,;]+/)) {
    const part = raw.trim();
    if (!part) continue;
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const [from, to] = [Number(range[1]), Number(range[2])].sort((a, b) => a - b);
      for (let n = from; n <= to; n++) result.add(n);
    } else if (/^\d+$/.test(part)) {
      result.add(Number(part));
    }
  }
  return result;
}

export function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** Turn plain card text into safe HTML, keeping line breaks. */
export function textToHTML(text) {
  return escapeHTML(text).replace(/\r?\n/g, "<br>");
}

/**
 * Wait until Dice So Nice has finished animating a message, so the prompt
 * does not spoil the roll. Resolves immediately if DSN is not active.
 */
export function waitForDiceSoNice(messageId, timeout = 8000) {
  if (!game.modules.get("dice-so-nice")?.active) return Promise.resolve();
  return new Promise((resolve) => {
    const hookId = Hooks.on("diceSoNiceRollComplete", (id) => {
      if (id !== messageId) return;
      Hooks.off("diceSoNiceRollComplete", hookId);
      resolve();
    });
    setTimeout(() => {
      Hooks.off("diceSoNiceRollComplete", hookId);
      resolve();
    }, timeout);
  });
}
