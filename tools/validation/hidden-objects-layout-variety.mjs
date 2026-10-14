/**
 * GAME03-REPLAYABILITY-05 — the layout variety report: how much each room
 * changes between explorations, measured on the real code (the module graph
 * over the working tree, or a commit with --rev).
 *
 * Per room:
 *   - what can move: things by role (pool objects, look-alikes, props), fixed
 *     and movable, authored slots and placements;
 *   - the layout space: the composer's independent components (things whose
 *     placements can clash with one another) and, exactly, how many complete
 *     rooms each admits — the room's reachable layouts are their product;
 *   - sampled explorations (every difficulty, seeds 1…N, the game's own
 *     selectRound): unique layouts, immediate repeats between consecutive
 *     seeds, the share of things that move between two explorations, per-thing
 *     slot use and its normalised entropy, how often a listed object, a
 *     look-alike or a kept object stands where it stood the exploration
 *     before, and any clash (there must be none);
 *   - Difícil, per object with two Difícil placements or more: how its rounds
 *     spread over them;
 *   - sessions: 20 consecutive explorations through the anti-repeat
 *     (explorationSeed), as a visit plays them;
 *   - cost: composition steps, layout attempts, draws, and time per round.
 *
 * Usage: node tools/validation/hidden-objects-layout-variety.mjs [--rev=<commit>] [--n=3000] [--json FILE]
 * Writes only the --json file when given. Exit 0 (a report, not a gate: the suites gate).
 */
import fs from "node:fs";
import { createModuleGraph, openSourceTree } from "./route-module-loader.mjs";
import { lcg } from "./hidden-objects-harness.mjs";

const args = process.argv.slice(2);
const rev = args.find((a) => a.startsWith("--rev="))?.slice(6) ?? null;
const N = Number(args.find((a) => a.startsWith("--n="))?.slice(4) ?? 3000);
const jsonAt = args.indexOf("--json");
const JSON_OUT = jsonAt === -1 ? null : args[jsonAt + 1];

const tree = openSourceTree(rev ? { rev } : {});
const graph = createModuleGraph({ tree, mocks: {}, globals: {} });
const L = graph.require("src/games/hidden-objects/hidden-objects-layout.ts");
const R = graph.require("src/games/hidden-objects/hidden-objects-rounds.ts");
const REG = graph.require("src/games/hidden-objects/hidden-objects-scenes.ts");
const DIFFICULTIES = ["easy", "medium", "hard"];
const round3 = (v) => Number(v.toFixed(3));

/** Exactly how many complete assignments a component of things admits (with every fixed thing in place). */
function countComponent(scene, things, component, fixedKeys) {
  const keysOf = (t) => things[t].placements.map((p) => L.placementKey(things[t].id, p.slot));
  const domains = component.map((t) => keysOf(t).filter((k) => fixedKeys.every((f) => !L.placementsClash(scene, k, f))));
  const chosen = [];
  let count = 0;
  const go = (i) => {
    if (i === component.length) {
      count += 1;
      return;
    }
    for (const k of domains[i]) {
      if (chosen.some((c) => L.placementsClash(scene, k, c))) continue;
      chosen.push(k);
      go(i + 1);
      chosen.pop();
    }
  };
  go(0);
  return count;
}

/** The composer's components, recomputed from the clash rule (things whose placements can clash, transitively). */
function componentsOf(scene, things) {
  const movable = [...things.keys()].filter((t) => things[t].placements.length > 1);
  const keys = (t) => things[t].placements.map((p) => L.placementKey(things[t].id, p.slot));
  const linked = (a, b) => keys(a).some((p) => keys(b).some((q) => L.placementsClash(scene, p, q)));
  const seen = new Set();
  const out = [];
  for (const start of movable) {
    if (seen.has(start)) continue;
    const comp = [start];
    seen.add(start);
    for (let i = 0; i < comp.length; i += 1)
      for (const other of movable) {
        if (seen.has(other) || !linked(comp[i], other)) continue;
        seen.add(other);
        comp.push(other);
      }
    out.push(comp.sort((a, b) => a - b));
  }
  return out;
}

const entropy = (counts) => {
  const total = counts.reduce((s, c) => s + c, 0);
  if (!total || counts.length < 2) return 0;
  const h = counts.filter((c) => c > 0).reduce((s, c) => s - (c / total) * Math.log(c / total), 0);
  return h / Math.log(counts.length);
};

const report = { rev: tree.rev ?? "working tree", samplesPerDifficulty: N, rooms: {} };
for (const scene of REG.SCENES) {
  const things = L.layoutThings(scene);
  const byRole = (role) => things.filter((t) => t.role === role);
  const movable = things.filter((t) => t.placements.length > 1);
  const fixedKeys = things.filter((t) => t.placements.length === 1).map((t) => L.placementKey(t.id, t.placements[0].slot));
  const components = componentsOf(scene, things);
  const perComponent = components.map((c) => countComponent(scene, things, c, fixedKeys));
  const log10Reachable = perComponent.reduce((s, c) => s + Math.log10(c), 0);

  // sampled explorations
  const usage = new Map(things.map((t) => [t.id, new Array(t.placements.length).fill(0)]));
  const sigs = new Set();
  let repeats = 0;
  let moved = 0;
  let pairs = 0;
  let clashes = 0;
  const stayed = { target: [0, 0], lookalike: [0, 0], prop: [0, 0], kept: [0, 0], listed: [0, 0] };
  let worstSteps = 0;
  let worstAttempt = 0;
  let worstDraws = 0;
  let fallbacks = 0;
  let ms = 0;
  let worstMs = 0;
  const hard = new Map();
  const shares = [];
  for (const d of DIFFICULTIES) {
    let previous = null;
    for (let seed = 1; seed <= N; seed += 1) {
      const t0 = performance.now();
      const draw = R.selectRound(scene, d, seed);
      const dt = performance.now() - t0;
      ms += dt;
      worstMs = Math.max(worstMs, dt);
      worstAttempt = Math.max(worstAttempt, draw.attempt);
      worstDraws = Math.max(worstDraws, draw.draws);
      fallbacks += draw.fallback ? 1 : 0;
      const { layout } = draw;
      sigs.add(layout.signature);
      for (const t of things) usage.get(t.id)[layout.picks[t.id] ?? 0] += 1;
      const keys = things.map((t) => L.placementKey(t.id, t.placements[layout.picks[t.id] ?? 0].slot));
      for (let i = 0; i < keys.length; i += 1) for (let j = i + 1; j < keys.length; j += 1) if (L.placementsClash(scene, keys[i], keys[j])) clashes += 1;
      if (d === "hard")
        for (const id of draw.targets) {
          const t = things.find((x) => x.id === id);
          if (!t || t.placements.length < 2) continue;
          const row = hard.get(id) ?? new Array(t.placements.length).fill(0);
          row[layout.picks[id] ?? 0] += 1;
          hard.set(id, row);
        }
      if (previous) {
        pairs += 1;
        if (previous.layout.signature === layout.signature) repeats += 1;
        const diff = L.layoutDifference(scene, previous.layout, layout);
        moved += diff.moved / things.length;
        shares.push(diff.moved / things.length);
        for (const t of movable) {
          const same = (previous.layout.picks[t.id] ?? 0) === (layout.picks[t.id] ?? 0);
          const bucket = t.gate ? "kept" : t.role;
          stayed[bucket][0] += same ? 1 : 0;
          stayed[bucket][1] += 1;
          if (t.role === "target" && draw.targets.includes(t.id) && previous.targets.includes(t.id)) {
            stayed.listed[0] += same ? 1 : 0;
            stayed.listed[1] += 1;
          }
        }
      }
      previous = draw;
      worstSteps = Math.max(worstSteps, L.composeLayout(scene, L.derivedSeed(seed, `layout:${draw.attempt === R.LAYOUT_ATTEMPTS ? 0 : draw.attempt}`)).steps);
    }
  }
  const total = DIFFICULTIES.length * N;
  shares.sort((a, b) => a - b);

  // sessions: 20 explorations as a visit plays them
  const sessions = [];
  for (let visit = 0; visit < 20; visit += 1) {
    const next = lcg(0x5e55 + visit);
    let previous = null;
    const visitSigs = [];
    let visitMoved = 0;
    let prevLayout = null;
    for (let i = 0; i < 20; i += 1) {
      const { seed, signature } = R.explorationSeed(scene, "medium", previous, () => Math.floor(next() * 2 ** 32));
      const layout = R.selectRound(scene, "medium", seed).layout;
      if (prevLayout) visitMoved += L.layoutDifference(scene, prevLayout, layout).moved / things.length;
      visitSigs.push(signature);
      previous = signature;
      prevLayout = layout;
    }
    sessions.push({ unique: new Set(visitSigs).size, immediateRepeats: visitSigs.filter((s, i) => i && s === visitSigs[i - 1]).length, meanMoved: visitMoved / 19 });
  }

  const slotUse = Object.fromEntries(
    movable.map((t) => {
      const counts = usage.get(t.id);
      const sum = counts.reduce((a, b) => a + b, 0);
      return [t.id, { role: t.role, placements: Object.fromEntries(t.placements.map((p, i) => [p.slot, round3(counts[i] / sum)])), entropy: round3(entropy(counts)) }];
    }),
  );
  const maxShare = Math.max(...movable.map((t) => Math.max(...usage.get(t.id)) / total));
  report.rooms[scene.id] = {
    things: { total: things.length, targets: byRole("target").length, lookAlikes: byRole("lookalike").length, props: byRole("prop").length, movable: movable.length, fixed: things.length - movable.length },
    movableByRole: { targets: movable.filter((t) => t.role === "target").length, lookAlikes: movable.filter((t) => t.role === "lookalike").length, props: movable.filter((t) => t.role === "prop").length },
    slots: scene.slots.length,
    placements: things.reduce((s, t) => s + t.placements.length, 0),
    layoutSpace: { components: components.length, componentSizes: components.map((c) => c.length).sort((a, b) => b - a), reachableLayouts: `10^${log10Reachable.toFixed(2)}`, perComponent },
    sampled: {
      explorations: total,
      uniqueLayouts: sigs.size,
      immediateRepeatsBetweenConsecutiveSeeds: repeats,
      movedShareOfAllThings: { mean: round3(moved / pairs), p10: round3(shares[Math.floor(shares.length * 0.1)]), p90: round3(shares[Math.floor(shares.length * 0.9)]), min: round3(shares[0]), max: round3(shares.at(-1)) },
      clashesInSampledLayouts: clashes,
      fallbacks,
      mostTakenPlacementShare: round3(maxShare),
      meanSlotEntropy: round3(movable.reduce((s, t) => s + entropy(usage.get(t.id)), 0) / movable.length),
      sameSpotAsThePreviousExploration: Object.fromEntries(Object.entries(stayed).map(([k, [same, n]]) => [k, n ? round3(same / n) : null])),
    },
    hard: Object.fromEntries([...hard].map(([id, row]) => [id, row.map((c) => round3(c / row.reduce((a, b) => a + b, 0)))])),
    sessionsOf20: {
      visits: sessions.length,
      allUnique: sessions.every((s) => s.unique === 20),
      immediateRepeats: sessions.reduce((s, v) => s + v.immediateRepeats, 0),
      meanMoved: round3(sessions.reduce((s, v) => s + v.meanMoved, 0) / sessions.length),
    },
    cost: { meanRoundMs: round3(ms / total), worstRoundMs: round3(worstMs), worstCompositionSteps: worstSteps, stepBound: L.LAYOUT_STEPS, worstLayoutAttempt: worstAttempt, attemptBound: R.LAYOUT_ATTEMPTS, worstDraws, drawBound: R.ROUND_DRAWS },
    slotUse,
  };
}

const short = Object.fromEntries(Object.entries(report.rooms).map(([id, r]) => [id, { ...r, slotUse: undefined }]));
console.log(JSON.stringify(short, null, 2));
if (JSON_OUT) fs.writeFileSync(JSON_OUT, `${JSON.stringify(report, null, 2)}\n`);
