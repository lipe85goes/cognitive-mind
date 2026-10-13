/**
 * Game 03 — copy each room's audited measurements into its scene module
 * (GAME03-INTERACTIONS-04; the calibration suite's C22 holds `measured` to the
 * audit). For every pool object, the `measured: { visible, edge, clutter }`
 * line of the scene module is rewritten from
 * docs/archive/hidden-objects/<room>/review/<kit>/fairness.json — the kit the
 * module's plate names. Nothing else in the module changes.
 *
 * Usage: node tools/assets/sync-hidden-objects-measured.mjs
 */
import fs from "node:fs";

const ROOMS = [
  { id: "explorer-studio", file: "src/games/hidden-objects/scenes/explorer-studio.ts" },
  { id: "explorer-observatory", file: "src/games/hidden-objects/scenes/explorer-observatory.ts" },
];

for (const room of ROOMS) {
  let text = fs.readFileSync(room.file, "utf8");
  const kit = /SCENE_ASSET_BASE = "[^"]*\/(v\d+)"/.exec(text)[1];
  const audit = JSON.parse(fs.readFileSync(`docs/archive/hidden-objects/${room.id}/review/${kit}/fairness.json`, "utf8"));
  let changed = 0;
  for (const row of audit.targets) {
    const start = text.indexOf(`    id: "${row.id}",`);
    if (start === -1) throw new Error(`${room.id}/${row.id}: not in ${room.file}`);
    const line = /    measured: \{ visible: [\d.]+, edge: [\d.]+, clutter: [\d.]+ \},/.exec(text.slice(start));
    const next = `    measured: { visible: ${row.visible}, edge: ${row.edge}, clutter: ${row.clutter} },`;
    if (line[0] !== next) changed += 1;
    text = text.slice(0, start + line.index) + next + text.slice(start + line.index + line[0].length);
  }
  fs.writeFileSync(room.file, text);
  console.log(`${room.id} (${kit}): ${changed} of ${audit.targets.length} measurements updated`);
}
