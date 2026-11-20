import { MODULE_ID } from "./constants.js";

/*
 * Turns condition and action names in card texts into compendium links, e.g.
 * "Frightened 1" -> @UUID[Compendium.pf2e.conditionitems.Item.…]{Frightened} 1.
 * Works for plain text cards and for custom cards, nothing has to be written by hand.
 */

const PACKS = {
  // Conditions are matched case-insensitively ("prone", "Off-Guard")
  condition: { pack: "pf2e.conditionitems", ignoreCase: true },
  // Actions only when capitalized, so everyday words ("stand up", "rest") stay plain text
  action: { pack: "pf2e.actionspf2e", ignoreCase: false }
};

/** Attitudes and detection states are conditions too, but read like ordinary words. */
const IGNORED_SLUGS = new Set(["friendly", "helpful", "hostile", "indifferent", "unfriendly", "observed"]);

/** Existing enrichers (@UUID[…]{…}, @Check[…], [[/r …]]) are never touched. */
const ENRICHER = /(@\w+\[[^\]]*\](?:\{[^}]*\})?|\[\[.*?\]\]\]?)/s;

let matchers = null;

/** Build the regular expressions from the compendium indexes once. */
function loadMatchers() {
  matchers ??= Promise.all(Object.values(PACKS).map(buildMatcher))
    .then((list) => list.filter(Boolean))
    .catch((err) => {
      console.error(`${MODULE_ID} | Failed to load compendium links`, err);
      return [];
    });
  return matchers;
}

async function buildMatcher({ pack: packId, ignoreCase }) {
  const pack = game.packs.get(packId);
  if (!pack) return null;
  const index = await pack.getIndex({ fields: ["system.slug", "flags.babele.originalName"] });

  const uuids = new Map();
  const add = (name, uuid) => {
    const key = ignoreCase ? name?.toLowerCase() : name;
    if (key && !uuids.has(key)) uuids.set(key, uuid);
  };
  for (const entry of index) {
    const slug = entry.system?.slug;
    if (IGNORED_SLUGS.has(slug)) continue;
    const uuid = entry.uuid ?? `Compendium.${packId}.Item.${entry._id}`;
    add(entry.name, uuid);
    // English names still match when a translation module renamed the entries
    add(entry.flags?.babele?.originalName, uuid);
    if (ignoreCase && slug) add(slug.replaceAll("-", " "), uuid);
  }
  if (!uuids.size) return null;

  // Longest names first, so "Raise a Shield" wins over shorter names inside it
  const names = [...uuids.keys()].sort((a, b) => b.length - a.length).map(escapeRegExp);
  const regex = new RegExp(`(?<![\\w-])(${names.join("|")})(?![\\w-])`, ignoreCase ? "giu" : "gu");
  return { regex, uuids, ignoreCase };
}

/**
 * Insert compendium links into a plain card text.
 * @param {string} text
 * @returns {Promise<string>}
 */
export async function linkCompendiumEntries(text) {
  if (!text || game.system.id !== "pf2e") return text ?? "";
  let result = text;
  for (const { regex, uuids, ignoreCase } of await loadMatchers()) {
    result = result.split(ENRICHER).map((part, i) => {
      if (i % 2) return part; // odd parts are the enrichers themselves
      return part.replace(regex, (match) => {
        const name = match.replace(/\s+/g, " ");
        return `@UUID[${uuids.get(ignoreCase ? name.toLowerCase() : name)}]{${name}}`;
      });
    }).join("");
  }
  return result;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
}
