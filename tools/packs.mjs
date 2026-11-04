/**
 * Build or extract the module's compendium packs.
 *
 *   npm run pack     packs/_source/<pack>/*.json  ->  packs/<pack>   (LevelDB, loaded by Foundry)
 *   npm run unpack   packs/<pack>                 ->  packs/_source/<pack>/*.json
 *
 * The JSON files in packs/_source are the editable source. Run "npm run pack"
 * after changing them, and before zipping a release. Close Foundry first:
 * a running world locks the LevelDB files.
 */
import { compilePack, extractPack } from "@foundryvtt/foundryvtt-cli";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

const SOURCE = "packs/_source";
const OUTPUT = "packs";
const mode = process.argv[2];

const packs = readdirSync(SOURCE, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);

for (const pack of packs) {
  const src = path.join(SOURCE, pack);
  const dest = path.join(OUTPUT, pack);
  if (mode === "pack") {
    console.log(`Packing ${src} -> ${dest}`);
    await compilePack(src, dest, { log: true, recursive: true });
  } else if (mode === "unpack") {
    if (!existsSync(dest)) continue;
    console.log(`Unpacking ${dest} -> ${src}`);
    await extractPack(dest, src, { log: true, clean: true });
  } else {
    console.error('Usage: node tools/packs.mjs <pack|unpack>');
    process.exit(1);
  }
}
