/**
 * GAME03-CALIBRATION-02A — where the round model's numbers come from.
 *
 * The search-load ruler (hidden-objects-difficulty.ts: SEARCH_RULER,
 * POP_OUT_BELOW) and the round floors (hidden-objects-scene.ts: ROUND_FLOORS and
 * each preset's minDecoys) are not invented: they are what Difficulty V2 asked
 * for, measured on the art it was playtested on. This module recomputes them
 * from that tree — the calibration's base, both rooms — so the calibration tool
 * can report them and the calibration suite can hold the product's constants to
 * them:
 *
 *   ruler  — the anchors of each measured part: the fairness floor and the 90th
 *            percentile of the V2 kits' edges; the 10th/90th percentiles of their
 *            clutter and of their objects' √area;
 *   popOut — halfway between the mean load of the V2 kits' A objects and their B;
 *   floors — over every V2 Difícil round of both rooms (enumerated by that
 *            tree's own round rules), measured with the ruler: the lower
 *            quartile (Fácil), the mean (Médio) and the maximum (Difícil) of the
 *            round's mean search load, and the same three of its look-alike
 *            pressure.
 *
 * A room's objects are measured the way the product's are: `visible` and `edge`
 * from the room's audit (docs/archive/hidden-objects/<room>/review/<kit>/
 * fairness.json), `clutter` on its shipped layers composed at rest
 * (tools/assets/hidden-objects-art-kit.mjs, measureClutter). Read-only.
 */
import { composeShipped, measureClutter } from "../assets/hidden-objects-art-kit.mjs";
import { readBinary } from "./hidden-objects-harness.mjs";
import { createModuleGraph, openSourceTree } from "./route-module-loader.mjs";

/** The tree Difficulty V2 was last playtested on: GAME03-MULTISCENE-03's final state (this mission's base). */
export const CALIBRATION_BASE = "3b122cf140303ebcec4f803f01a0a3205b7a57c6";
export const DIFFICULTIES = ["easy", "medium", "hard"];

/** Linear-interpolated percentile of a sorted list (p in [0, 1]). */
export function percentile(sortedValues, p) {
  const index = (sortedValues.length - 1) * p;
  const lo = Math.floor(index);
  const hi = Math.ceil(index);
  return sortedValues[lo] + (sortedValues[hi] - sortedValues[lo]) * (index - lo);
}
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / values.length;
const round = (value, digits) => Number(value.toFixed(digits));
const sideOf = (region) => (region.kind === "rect" ? Math.sqrt(region.w * region.h) : 2 * region.r);

/** The art kit folder of a room (its plate's folder name: v1, v2…) and its audit. */
export function auditOf(tree, room) {
  const plate = room.layers.find((layer) => layer.id === "plate");
  const kit = plate.src.replace(/\/[^/]+$/, "").split("/").pop();
  const file = `docs/archive/hidden-objects/${room.id}/review/${kit}/fairness.json`;
  return { kit, file, audit: tree.exists(file) ? JSON.parse(tree.read(file)) : null };
}

/** One measurement per tree (it composes and scans every room's art): the promise is kept. */
const measuring = new WeakMap();

/**
 * Every room of a tree with its objects measured: `measured` from the room's
 * audit and its shipped art (whatever the tree's own scene data says — the base
 * has none).
 */
export function measuredRooms(tree) {
  if (!measuring.has(tree)) measuring.set(tree, measureRooms(tree));
  return measuring.get(tree);
}

async function measureRooms(tree) {
  const graph = createModuleGraph({ tree, mocks: {}, globals: {} });
  const registry = graph.require("src/games/hidden-objects/hidden-objects-scenes.ts");
  const rooms = [];
  for (const scene of registry.SCENES) {
    const { audit, file } = auditOf(tree, scene);
    if (!audit) throw new Error(`no audit at ${file}`);
    const rows = Object.fromEntries(audit.targets.map((row) => [row.id, row]));
    const composed = await composeShipped(scene, (publicPath) => readBinary(tree, publicPath));
    const pool = scene.pool.map((target) => ({
      ...target,
      measured: {
        visible: rows[target.id]?.visible ?? NaN,
        edge: rows[target.id]?.edge ?? NaN,
        clutter: measureClutter(composed, scene.width, scene.height, target.region),
      },
    }));
    rooms.push({ scene, measuredScene: { ...scene, pool }, audit, auditFile: file });
  }
  return { graph, rooms };
}

/** The ruler's anchors, from a tree's measured rooms (every object of every room, pooled). */
export function deriveRuler(rooms) {
  const targets = rooms.flatMap((room) => room.measuredScene.pool);
  const sorted = (values) => [...values].sort((a, b) => a - b);
  const edges = sorted(targets.map((t) => t.measured.edge));
  const clutter = sorted(targets.map((t) => t.measured.clutter));
  const sides = sorted(targets.map((t) => sideOf(t.region)));
  return {
    edge: { pops: round(percentile(edges, 0.9), 2), blends: 1.3 },
    clutter: { calm: round(percentile(clutter, 0.1), 3), busy: round(percentile(clutter, 0.9), 3) },
    side: { large: Math.round(percentile(sides, 0.9)), small: Math.round(percentile(sides, 0.1)) },
  };
}

/**
 * Difficulty V2's rounds measured with today's ruler (`difficulty`: the working
 * tree's hidden-objects-difficulty module): every V2 round of every room of the
 * base tree, by difficulty, with its mean search load and its look-alike
 * pressure; and the reference values the floors are taken from.
 */
export async function deriveReference(baseTree, difficulty) {
  const { graph, rooms } = await measuredRooms(baseTree);
  const rounds = graph.require("src/games/hidden-objects/hidden-objects-rounds.ts");
  const loadOf = (room, id) => difficulty.searchLoad(room.measuredScene, room.measuredScene.pool.find((t) => t.id === id));
  const decoysOf = (room, id) => room.scene.lookAlikes.filter((l) => l.resembles === id).length;
  const v2 = {};
  for (const d of DIFFICULTIES) {
    v2[d] = rooms.map((room) => ({
      room: room.scene.id,
      rounds: rounds.validRounds(room.scene, d).map((ids) => ({
        ids: [...ids],
        search: mean(ids.map((id) => loadOf(room, id))),
        decoys: mean(ids.map((id) => decoysOf(room, id))),
      })),
    }));
  }
  const hard = v2.hard.flatMap((room) => room.rounds);
  const searchSorted = hard.map((r) => r.search).sort((a, b) => a - b);
  const decoySorted = hard.map((r) => r.decoys).sort((a, b) => a - b);
  const tierLoads = (tier) => rooms.flatMap((room) => room.measuredScene.pool.filter((t) => t.tier === tier).map((t) => loadOf(room, t.id)));
  return {
    rooms,
    ruler: deriveRuler(rooms),
    popOut: round((mean(tierLoads("A")) + mean(tierLoads("B"))) / 2, 3),
    floors: {
      easy: round(percentile(searchSorted, 0.25), 3),
      medium: round(mean(searchSorted), 3),
      hard: round(searchSorted.at(-1), 3),
    },
    decoyFloors: {
      easy: round(percentile(decoySorted, 0.25), 3),
      medium: round(mean(decoySorted), 3),
      hard: round(decoySorted.at(-1), 3),
    },
    v2,
  };
}

/** The base tree, opened once. */
export const openBase = () => openSourceTree({ rev: CALIBRATION_BASE });
