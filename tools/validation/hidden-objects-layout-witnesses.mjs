/**
 * GAME03-REPLAYABILITY-05 — review witnesses of the rooms' seeded layouts, composed
 * from the shipped files exactly as the game composes them (the plate, every
 * thing's picture from the room's atlas on the slot the seed gives it, the
 * pieces, the foreground layers).
 *
 * Writes docs/archive/hidden-objects/replayability/:
 *   <room>-layouts.webp     six explorations of the room (Fácil, Médio, four Difícil) — each the whole
 *                           room, its list outlined (red), the things that are not where the room was
 *                           painted outlined (blue), labelled with seed, difficulty and layout signature
 *   <room>-compare.webp     the same corner of the room across the six seeds, side by side
 *   <room>-kept.webp        a round whose object kept behind a piece stands on its second spot: shut, then open
 *   witnesses.json          what each tile shows (seed, difficulty, signature, list, moved things)
 *
 * Usage: node tools/validation/hidden-objects-layout-witnesses.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createModuleGraph, openSourceTree } from "./route-module-loader.mjs";
import { allOpen, composeLayout, oneOpen } from "../assets/hidden-objects-sprites.mjs";

const sharp = createRequire(import.meta.url)("sharp");
const ROOT = process.cwd();
const OUT = path.join(ROOT, "docs/archive/hidden-objects/replayability");
fs.mkdirSync(OUT, { recursive: true });

const graph = createModuleGraph({ tree: openSourceTree(), mocks: {}, globals: {} });
const L = graph.require("src/games/hidden-objects/hidden-objects-layout.ts");
const R = graph.require("src/games/hidden-objects/hidden-objects-rounds.ts");
const REG = graph.require("src/games/hidden-objects/hidden-objects-scenes.ts");
const LEVEL = { easy: "Fácil", medium: "Médio", hard: "Difícil" };
const readShipped = async (src) => fs.readFileSync(path.join(ROOT, "public", src));
const boxOf = (r) => (r.kind === "rect" ? { x: r.x, y: r.y, w: r.w, h: r.h } : { x: r.cx - r.r, y: r.cy - r.r, w: 2 * r.r, h: 2 * r.r });
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;");

/** The room as the game paints (seed, difficulty): the composed picture and what it shows. */
async function compose(scene, difficulty, seed, states = "rest") {
  const draw = R.selectRound(scene, difficulty, seed);
  const things = L.layoutThings(scene);
  const keys = things.map((t) => L.placementKey(t.id, t.placements[draw.layout.picks[t.id] ?? 0].slot));
  const rects = new Map(Object.entries(scene.placementArt).filter(([, a]) => a.sprite).map(([k, a]) => [k, a.sprite]));
  const { png } = await composeLayout(scene, readShipped, scene.atlas.src, rects, keys, states);
  const placed = L.placedScene(scene, draw.layout);
  const moved = things.filter((t) => (draw.layout.picks[t.id] ?? 0) !== 0).map((t) => ({ id: t.id, role: t.role, box: L.placedBox(scene, t, t.placements[draw.layout.picks[t.id]]) }));
  const listed = draw.targets.map((id) => ({ id, box: boxOf(placed.pool.find((t) => t.id === id).region) }));
  return { png, draw, moved, listed, movedShare: moved.length / things.length };
}

/** The composed room, outlined and labelled, scaled to `width`. */
async function tile(scene, shot, label, width, crop = null) {
  const W = scene.width;
  const H = scene.height;
  const rect = (b, color, dash) => `<rect x="${b.x - 4}" y="${b.y - 4}" width="${b.w + 8}" height="${b.h + 8}" fill="none" stroke="${color}" stroke-width="6" ${dash ? 'stroke-dasharray="14 8"' : ""}/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${shot.moved.map((m) => rect(m.box, "#4aa8ff", true)).join("")}${shot.listed.map((t) => rect(t.box, "#ff4d4d", false)).join("")}</svg>`;
  let img = sharp(await sharp(shot.png).composite([{ input: Buffer.from(svg) }]).png().toBuffer());
  const area = crop ?? { left: 0, top: 0, width: W, height: H };
  if (crop) img = sharp(await img.extract(crop).png().toBuffer());
  const height = Math.round((width * area.height) / area.width);
  const scaled = await img.resize(width, height).png().toBuffer();
  const band = 30;
  const text = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${band}"><rect width="${width}" height="${band}" fill="#111"/><text x="8" y="21" font-family="sans-serif" font-size="17" fill="#fff">${esc(label)}</text></svg>`;
  return sharp({ create: { width, height: height + band, channels: 3, background: "#111" } })
    .composite([{ input: Buffer.from(text), left: 0, top: 0 }, { input: scaled, left: 0, top: band }])
    .png()
    .toBuffer();
}

async function grid(tiles, columns, file) {
  const metas = await Promise.all(tiles.map((t) => sharp(t).metadata()));
  const w = Math.max(...metas.map((m) => m.width));
  const h = Math.max(...metas.map((m) => m.height));
  const rows = Math.ceil(tiles.length / columns);
  await sharp({ create: { width: columns * (w + 6) - 6, height: rows * (h + 6) - 6, channels: 3, background: "#222" } })
    .composite(tiles.map((input, i) => ({ input, left: (i % columns) * (w + 6), top: Math.floor(i / columns) * (h + 6) })))
    .webp({ quality: 80 })
    .toFile(path.join(OUT, file));
}

const record = {};
const PLAN = [
  ["easy", 0x3e1],
  ["medium", 0x3e2],
  ["hard", 0x3e3],
  ["hard", 0x3e4],
  ["hard", 0x3e5],
  ["hard", 0x3e6],
];
/** The corner each room's comparison shows (the busiest station). */
const CORNER = { "explorer-studio": { left: 1060, top: 760, width: 1080, height: 700 }, "explorer-observatory": { left: 1240, top: 300, width: 1160, height: 980 } };

for (const scene of REG.SCENES) {
  const shots = [];
  for (const [difficulty, seed] of PLAN) shots.push({ difficulty, seed, shot: await compose(scene, difficulty, seed) });
  const signatures = new Set(shots.map((s) => s.shot.draw.layout.signature));
  if (signatures.size !== shots.length) throw new Error(`${scene.id}: the six witnesses are not six layouts`);
  const label = (s) => `${LEVEL[s.difficulty]} · seed ${s.seed} · ${s.shot.draw.layout.signature.slice(0, 18)}… · ${Math.round(s.shot.movedShare * 100)}% off home`;
  await grid(await Promise.all(shots.map((s) => tile(scene, s.shot, label(s), 1000))), 2, `${scene.id}-layouts.webp`);
  await grid(await Promise.all(shots.map((s) => tile(scene, s.shot, label(s), 620, CORNER[scene.id]))), 3, `${scene.id}-compare.webp`);
  // a kept object on its second spot: shut, then its piece open
  const gated = L.layoutThings(scene).find((t) => t.gate && t.placements.length > 1);
  let keptSeed = null;
  for (let seed = 1; seed < 50_000 && keptSeed === null; seed += 1) {
    const d = R.selectRound(scene, "medium", seed);
    if (d.targets.includes(gated.id) && d.layout.picks[gated.id] === 1) keptSeed = seed;
  }
  const shut = await compose(scene, "medium", keptSeed, "rest");
  const open = await compose(scene, "medium", keptSeed, oneOpen(scene, gated.gate));
  const box = L.placedBox(scene, gated, gated.placements[1]);
  const crop = { left: Math.max(0, Math.round(box.x - 260)), top: Math.max(0, Math.round(box.y - 200)), width: 600, height: 460 };
  await grid([await tile(scene, shut, `Médio · seed ${keptSeed} · ${gated.id} kept behind ${gated.gate}: shut`, 600, crop), await tile(scene, open, `the same, ${gated.gate} open: ${gated.id} on ${gated.placements[1].slot}`, 600, crop)], 2, `${scene.id}-kept.webp`);
  void allOpen;
  record[scene.id] = {
    layouts: shots.map((s) => ({ difficulty: s.difficulty, seed: s.seed, signature: s.shot.draw.layout.signature, listed: s.shot.draw.targets, offHome: s.shot.moved.map((m) => m.id), offHomeShare: Number(s.shot.movedShare.toFixed(3)) })),
    kept: { seed: keptSeed, object: gated.id, piece: gated.gate, slot: gated.placements[1].slot },
  };
  console.log(`${scene.id}: ${signatures.size} layouts, kept witness seed ${keptSeed}`);
}
fs.writeFileSync(path.join(OUT, "witnesses.json"), `${JSON.stringify(record, null, 2)}\n`);
