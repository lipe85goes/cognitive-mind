/**
 * ROTA2-SENTINEL-SOLVER-FIDELITY-03 — the census: every Route × mode over many seeds, the reference solvers before
 * the correction (the exact base f5826b2) and after it, held against the hook and against production.
 *
 *   A  generation    1080 maps (3 Routes × 3 modes × 120 seeds, the seeds of the DYNAMIC-TRAPS-01 and
 *                    DEPENDENT-OBJECTIVES-02 censuses) generated on this tree AND on the base: a tooling mission must not
 *                    move one map or one draw (the draws each generation makes are counted).
 *   B  runtime       the REAL hook on every map, two scripted games each (a trap tour; the doors that are traps first),
 *                    every pre-Chest turn held against both Rota 2.0 solvers (and both static solvers on Route 1 turns
 *                    on the certified board). Every turn's production Sentinel decision is classified by a read-only
 *                    recorder (`decisionRecorder`); a disagreement is filed by class and by what differs (the
 *                    Sentinel's cell, its held door, its commitment, the terminal outcome). The same games on the base
 *                    tree's hook: same turns, same draws.
 *   C  focused       where a commitment, a trap and the active maze make the blocked-target case possible — a trap
 *                    armed, or a door that is a trap within three steps — a depth-2 PRODUCTION exploration around the
 *                    turn (`oracleSuccessors`: reference Hunter support, the real `decideSentinelMove`), and a decision
 *                    grid around every door that is a trap. Each pair against both solvers; the static solvers against
 *                    the string reference.
 *   D  classes       the exact PRE_CHEST classes of the 72-map solver sample of the earlier censuses, under the product's
 *                    rules (the dynamic maze; Routes 2/3 wait for the passage), base solver vs corrected solver.
 *   E  performance   context preparation, successor enumeration per transition, exploration throughput and heap, base vs
 *                    corrected (timings are run metadata, never verdict).
 *
 * Usage: node tools/validation/rota2-sentinel-solver-fidelity-census.mjs [--check|--update]
 *        (`ROUTE_VALIDATION_OUT=<dir>` to write elsewhere; `FIDELITY_CENSUS_QUICK=1` a small sample, nothing written)
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import { openEvidence } from "./evidence.mjs";
import { loadRouteRuntime } from "./route-runtime-harness.mjs";
import { ACTIONS, buildContext, successors as stringReferenceSuccessors } from "./dynamic-solver.mjs";
import {
  FIDELITY_BASE,
  attachDrawCounter,
  attachRecorder,
  canon,
  cellId,
  decisionClass,
  decisionRecorder,
  keyOf,
  loadSolvers,
  oracleContext,
  oracleSuccessors,
  packedAnswer,
  parseCanon,
  playFixtureGames,
  productionIntercept,
  rota2Answer,
  sameAnswer,
} from "./rota2-sentinel-solver-fidelity-lib.mjs";
import { ROTA2_ADAPTIVE_HUNTER_FILES, reverseAdaptive } from "./rota2-adaptive-hunter-edit.mjs";

const QUICK = process.env.FIDELITY_CENSUS_QUICK === "1";
const DIFFICULTIES = ["easy", "medium", "hard"];
const ROUTES = [1, 2, 3];
const MAPS_PER_COMBINATION = QUICK ? 6 : 120;
const SOLVER_PER_COMBINATION = QUICK ? 0 : 8;
const EXPLORE_PER_GAME = 150;
const GRID = { masks: 4, sentinels: 8, arrivals: 5 };
const started = performance.now();
const log = (...m) => console.log(...m);
const seedFor = (route, difficulty, index) => 9_200_000 + route * 10_000 + DIFFICULTIES.indexOf(difficulty) * 1_000 + index;
const sortedKeys = (set) => [...set].sort();
const mapFields = (m) =>
  JSON.stringify({ grid: m.grid, walls: sortedKeys(m.walls), playerStart: m.playerStart, guardianStart: m.guardianStart, exitPosition: m.exitPosition, collectibleStars: m.collectibleStars, traps: m.traps, chest: m.chest, trapLinks: m.trapLinks ?? null });
const tally = (object, key, n = 1) => {
  object[key] = (object[key] ?? 0) + n;
};
const manhattanIds = (a, b) => Math.abs(Math.floor(a / 9) - Math.floor(b / 9)) + Math.abs((a % 9) - (b % 9));
const short = (label) => ({ GUARANTEED_SOLVABLE_PRE_CHEST: "G", POSSIBLE_BUT_NOT_GUARANTEED_PRE_CHEST: "P", PROVED_UNSOLVABLE_PRE_CHEST: "U", INCONCLUSIVE_RESOURCE_LIMIT: "I" })[label] ?? label;

const NOW = loadRouteRuntime({ directDifficulty: true, transforms: [decisionRecorder()] });
const PRE = loadRouteRuntime({ directDifficulty: true, rev: FIDELITY_BASE, transforms: [decisionRecorder(FIDELITY_BASE)] });
const recorder = attachRecorder(NOW);
const preRecorder = attachRecorder(PRE);
const nowDraws = attachDrawCounter(NOW);
const preDraws = attachDrawCounter(PRE);
const CANDIDATE = await loadSolvers();
const BASE = await loadSolvers({ rev: FIDELITY_BASE });
/**
 * ROTA2-ADAPTIVE-HUNTER-04 came after this mission and changed production on Routes 2/3 on purpose. The census keeps
 * holding TODAY's hook: the oracle and the corrected solver model its Hunter (Route, production interception module,
 * remembered direction); the base solvers (f5826b2) predate it, so transitions where production intercepted are left
 * out of THEIR comparisons (counted). "The base tree's hook is identical" now reads: the working tree with exactly that
 * mission's pinned hunks reversed (rota2-adaptive-hunter-edit.mjs) plays the base's games turn for turn.
 */
const INTERCEPT = productionIntercept(NOW);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const W0 = loadRouteRuntime({
  directDifficulty: true,
  sourceOverrides: Object.fromEntries(ROTA2_ADAPTIVE_HUNTER_FILES.map((file) => [file, reverseAdaptive(file, fs.readFileSync(path.join(ROOT, file), "utf8").replace(/\r\n/g, "\n"))])),
  transforms: [decisionRecorder()],
});

// =================================================================================================
// A — generation
// =================================================================================================
log("A  generation: this tree against the base");
const generation = { maps: 0, throws: 0, sameAsBase: 0, changedVsBase: 0, drawsSameAsBase: 0, totalDraws: 0, digest: null, changedExamples: [] };
const allMaps = [];
const digest = createHash("sha256");
for (const route of ROUTES) {
  for (const difficulty of DIFFICULTIES) {
    for (let i = 0; i < MAPS_PER_COMBINATION; i += 1) {
      const seed = seedFor(route, difficulty, i);
      generation.maps += 1;
      let map;
      let before;
      let drawsNow;
      let drawsPre;
      try {
        NOW.LAB.setSeed(seed);
        let d0 = nowDraws.draws;
        map = NOW.API.generateMaze(difficulty, route);
        drawsNow = nowDraws.draws - d0;
        PRE.LAB.setSeed(seed);
        d0 = preDraws.draws;
        before = PRE.API.generateMaze(difficulty, route);
        drawsPre = preDraws.draws - d0;
      } catch {
        generation.throws += 1;
        continue;
      }
      const fields = mapFields(map);
      digest.update(fields);
      generation.totalDraws += drawsNow;
      if (fields === mapFields(before)) generation.sameAsBase += 1;
      else {
        generation.changedVsBase += 1;
        if (generation.changedExamples.length < 5) generation.changedExamples.push({ seed, route, difficulty });
      }
      if (drawsNow === drawsPre) generation.drawsSameAsBase += 1;
      allMaps.push({ seed, route, difficulty, map });
    }
  }
}
generation.digest = digest.digest("hex");
log(`   ${generation.maps} maps · same as base ${generation.sameAsBase} · draws same ${generation.drawsSameAsBase} · throws ${generation.throws}`);

// =================================================================================================
// B — the real hook, every map
// =================================================================================================
log("B  runtime: every map, two games, every pre-Chest turn against both solvers");
const SPECS = allMaps.flatMap(({ seed, route, difficulty }) => ["trapTour", "doorTraps"].map((policy) => ({ seed, route, difficulty, policy })));
const tB = performance.now();
const turns = playFixtureGames(NOW, recorder, SPECS);
const preTurns = playFixtureGames(PRE, preRecorder, SPECS);
const w0Turns = playFixtureGames(W0, attachRecorder(W0), SPECS);
const hookMs = performance.now() - tB;
const turnLine = (t) => `${t.spec.seed}|${t.spec.route}|${t.spec.difficulty}|${t.spec.policy}|${t.k}|${canon(t.before)}|${canon(t.after)}|${t.status}|${t.draws}`;
const hookSameOnBase = w0Turns.length === preTurns.length && w0Turns.every((t, i) => turnLine(t) === turnLine(preTurns[i]));
log(`   ${turns.length} turns in ${SPECS.length} games (${Math.round(hookMs)} ms, both trees) · base tree's hook identical: ${hookSameOnBase}`);

const contexts = new Map();
const contextOf = (spec, map, requirePassage) => {
  const key = `${spec.seed}|${spec.route}|${spec.difficulty}`;
  if (!contexts.has(key)) {
    contexts.set(key, {
      key, spec, map, requirePassage,
      octx: oracleContext(NOW.API, map, spec.difficulty, { requirePassage, routeNumber: spec.route, intercept: INTERCEPT }),
      d: { candidate: CANDIDATE.rota2.buildDynamicContext(map, spec.difficulty, { requirePassage, routeNumber: spec.route, intercept: INTERCEPT }), base: BASE.rota2.buildDynamicContext(map, spec.difficulty, { requirePassage }) },
      s: { candidate: buildContext(map, spec.difficulty), base: buildContext(map, spec.difficulty) },
      staticCtx: buildContext(map, spec.difficulty),
    });
  }
  return contexts.get(key);
};
const hookIn = (status, post, answer) => {
  if (!answer) return false;
  if (status === "lost") return answer.hasLoss;
  if (status === "won") return answer.hasWin;
  return answer.states.includes(canon(post));
};
const shapeOf = (status, post, answer) => {
  if (!answer) return ["noAnswer"];
  if (status !== "playing") return ["terminal"];
  const same = answer.states.map(parseCanon).filter((x) => x.e === post.e && x.h === post.h && x.lights === post.lights && x.traps === post.traps);
  if (same.length === 0) return answer.hasLoss ? ["terminal"] : ["hunterOrOther"];
  const best = same.map((x) => [x.s !== post.s, x.target !== post.target, x.c !== post.c]).sort((a, b) => a.filter(Boolean).length - b.filter(Boolean).length)[0];
  const out = [];
  if (best[0]) out.push("position");
  if (best[1]) out.push("target");
  if (best[2]) out.push("commitLeft");
  return out.length ? out : ["other"];
};
const emptyDiff = () => ({ disagreements: 0, byClass: {}, byShape: {} });
const runtime = {
  games: SPECS.length,
  transitions: 0,
  byClass: {},
  heldTargetIsTrapCell: 0,
  armedDuringCommitment: 0,
  heldDoorArmedThisTurn: 0,
  openTopologyTurns: 0,
  base: emptyDiff(),
  candidate: emptyDiff(),
  staticRoute1: { transitions: 0, base: emptyDiff(), candidate: emptyDiff() },
  hunter: { isolatedTurns: 0, supportDiffers: 0, hookHunterOutside: 0 },
  // ROTA2-ADAPTIVE-HUNTER-04: turns where production's Hunter intercepted (left out of the base solvers' comparisons).
  interceptingTurns: 0,
  hookDraws: 0,
  hookSameOnBaseTree: hookSameOnBase,
  reproducing: {},
  candidateExamples: [],
  baseExamples: [],
};
const fileDiff = (bucket, cls, shapes) => {
  bucket.disagreements += 1;
  tally(bucket.byClass, cls);
  for (const s of shapes) tally(bucket.byShape, s);
};
const relevantRoots = [];
for (const turn of turns) {
  const c = contextOf(turn.spec, turn.map, turn.requirePassage);
  const decision = turn.decisions[0] ?? null;
  const cls = decisionClass(decision);
  runtime.transitions += 1;
  runtime.hookDraws += turn.draws;
  tally(runtime.byClass, cls);
  const trapCells = c.octx.trapKeys;
  if (turn.before.target >= 0 && trapCells.includes(keyOf(turn.before.target))) runtime.heldTargetIsTrapCell += 1;
  if (turn.before.c > 0 && turn.before.target >= 0 && trapCells.some((k, i) => turn.after.traps & (1 << i) && k === keyOf(turn.before.target))) runtime.armedDuringCommitment += 1;
  if (turn.before.c > 0 && turn.before.target === turn.after.e && turn.after.traps !== turn.before.traps) runtime.heldDoorArmedThisTurn += 1;
  if (turn.open) runtime.openTopologyTurns += 1;
  const answers = {
    candidate: rota2Answer(CANDIDATE, c.d.candidate, turn.before, turn.actionIndex),
    base: rota2Answer(BASE, c.d.base, turn.before, turn.actionIndex),
  };
  const intercepting = Boolean(oracleSuccessors(c.octx, turn.before, turn.actionIndex)?.intercepting);
  if (intercepting) runtime.interceptingTurns += 1;
  for (const which of ["candidate", "base"]) {
    if (which === "base" && intercepting) continue;
    if (hookIn(turn.status, turn.after, answers[which])) continue;
    const shapes = shapeOf(turn.status, turn.after, answers[which]);
    fileDiff(runtime[which], cls, shapes);
    if (which === "base") tally(runtime.reproducing, `${turn.spec.route}|${turn.spec.difficulty}|${turn.spec.seed}`);
    const examples = runtime[`${which}Examples`];
    if (examples.length < 5) examples.push({ seed: turn.spec.seed, route: turn.spec.route, difficulty: turn.spec.difficulty, policy: turn.spec.policy, turn: turn.k, cls, shapes, before: canon(turn.before), hook: canon(turn.after), solver: answers[which]?.states.slice(0, 3) });
  }
  // Hunter: where the Sentinel cannot reach the Explorer's cell, the two solvers' Hunter outcomes must be the same.
  if (turn.status === "playing" && manhattanIds(turn.before.s, turn.after.e) > 1 && !intercepting) {
    runtime.hunter.isolatedTurns += 1;
    const hs = (a) => [...new Set((a?.states ?? []).map((x) => parseCanon(x).h))].sort().join(",") + (a?.hasLoss ? "|L" : "");
    if (hs(answers.candidate) !== hs(answers.base)) runtime.hunter.supportDiffers += 1;
  }
  if (turn.status === "playing" && !(answers.candidate?.states ?? []).some((x) => parseCanon(x).h === turn.after.h)) runtime.hunter.hookHunterOutside += 1;
  // The static (v1-topology) solvers, on Route 1 turns that stay on the certified board.
  if (turn.spec.route === 1 && !turn.open) {
    runtime.staticRoute1.transitions += 1;
    for (const which of ["candidate", "base"]) {
      const answer = packedAnswer(which === "candidate" ? CANDIDATE : BASE, c.s[which], turn.before, turn.actionIndex);
      if (!hookIn(turn.status, turn.after, answer)) fileDiff(runtime.staticRoute1[which], cls, shapeOf(turn.status, turn.after, answer));
    }
  }
  if (turn.status === "playing") {
    const doorTraps = c.octx.zones[turn.after.traps & c.octx.linkBit ? 1 : 0].accesses.map(cellId).filter((id) => trapCells.includes(keyOf(id)));
    if (turn.after.traps !== 0 || doorTraps.some((d) => manhattanIds(d, turn.after.e) <= 3)) relevantRoots.push({ c, turn });
  }
}
runtime.reproducingCount = Object.keys(runtime.reproducing).length;
log(`   transitions ${runtime.transitions} · base disagreements ${runtime.base.disagreements} ${JSON.stringify(runtime.base.byClass)} · candidate ${runtime.candidate.disagreements} ${JSON.stringify(runtime.candidate.byClass)}`);
log(`   held target is a trap cell ${runtime.heldTargetIsTrapCell} · armed during a commitment ${runtime.armedDuringCommitment} · static R1 base ${runtime.staticRoute1.base.disagreements} candidate ${runtime.staticRoute1.candidate.disagreements}`);

// =================================================================================================
// C — focused production exploration and decision grid
// =================================================================================================
log("C  focused: depth-2 production exploration around relevant turns, decision grid around trapped doors");
const focused = {
  pairs: 0, bySource: {}, byClass: {},
  base: emptyDiff(), candidate: emptyDiff(),
  static: { pairs: 0, byClass: {}, base: emptyDiff(), candidate: emptyDiff(), oracleVsStringReference: 0 },
  sentinelOnBlocked: { base: 0, candidate: 0 },
  candidateExamples: [],
};
const seenPairs = new Set();
const evalPair = (c, state, actionIndex, source) => {
  const key = `${c.key}#${canon(state)}#${actionIndex}`;
  if (seenPairs.has(key)) return null;
  const oracle = oracleSuccessors(c.octx, state, actionIndex, recorder);
  if (!oracle) return null;
  seenPairs.add(key);
  const cls = decisionClass(oracle.decisions[0] ?? null);
  focused.pairs += 1;
  tally(focused.bySource, source);
  tally(focused.byClass, cls);
  const expected = { hasWin: oracle.hasWin, hasLoss: oracle.hasLoss, states: oracle.states };
  if (oracle.intercepting) tally(focused, "interceptingPairs");
  for (const which of ["candidate", "base"]) {
    // ROTA2-ADAPTIVE-HUNTER-04: the base solvers predate the interception; such a pair is not theirs to answer.
    if (which === "base" && oracle.intercepting) continue;
    const answer = rota2Answer(which === "candidate" ? CANDIDATE : BASE, c.d[which], state, actionIndex);
    if (!sameAnswer(answer, expected)) {
      fileDiff(focused[which], cls, [answer && answer.states.length !== expected.states.length ? "supportSize" : "content"]);
      if (which === "candidate" && focused.candidateExamples.length < 5) focused.candidateExamples.push({ map: c.key, source, cls, state: canon(state), action: ACTIONS[actionIndex].name, production: expected.states.slice(0, 3), solver: answer?.states.slice(0, 3) });
    }
    for (const s of answer?.states ?? []) {
      const x = parseCanon(s);
      const topology = x.traps & c.octx.linkBit ? 1 : 0;
      if (c.octx.walls[topology].has(keyOf(x.s)) || c.octx.trapKeys.some((k, i) => x.traps & (1 << i) && k === keyOf(x.s))) focused.sentinelOnBlocked[which] += 1;
    }
  }
  // The static model: no piece on a wall of the certified board, the held door one of its doors.
  const accessKeys = c.staticCtx.accessKeys;
  if ((state.target < 0 || accessKeys.includes(keyOf(state.target))) && ![state.e, state.h, state.s].some((id) => c.map.walls.has(keyOf(id)))) {
    const st = { e: keyOf(state.e), h: keyOf(state.h), s: keyOf(state.s), t: state.target < 0 ? -1 : accessKeys.indexOf(keyOf(state.target)), c: state.c, lights: state.lights, traps: state.traps };
    const res = stringReferenceSuccessors(c.staticCtx, st, ACTIONS[actionIndex]);
    if (res) {
      const id = (k) => cellId({ row: +k.split(",")[0], col: +k.split(",")[1] });
      const ref = { hasWin: false, hasLoss: false, states: [] };
      const set = new Set();
      for (const o of res.outcomes) {
        if (o.terminal === "WIN") ref.hasWin = true;
        else if (o.terminal === "LOSS") ref.hasLoss = true;
        else set.add(canon({ e: id(o.state.e), h: id(o.state.h), s: id(o.state.s), target: o.state.t < 0 ? -1 : id(accessKeys[o.state.t]), c: o.state.c, lights: o.state.lights, traps: o.state.traps }));
      }
      ref.states = [...set].sort();
      c.octxStatic ??= oracleContext(NOW.API, c.map, c.spec.difficulty, { dynamic: false });
      const so = oracleSuccessors(c.octxStatic, state, actionIndex, recorder);
      const scls = decisionClass(so?.decisions[0] ?? null);
      focused.static.pairs += 1;
      tally(focused.static.byClass, scls);
      if (!sameAnswer(so && { hasWin: so.hasWin, hasLoss: so.hasLoss, states: so.states }, ref)) focused.static.oracleVsStringReference += 1;
      for (const which of ["candidate", "base"]) {
        const answer = packedAnswer(which === "candidate" ? CANDIDATE : BASE, c.s[which], state, actionIndex);
        if (!sameAnswer(answer, ref)) fileDiff(focused.static[which], scls, ["content"]);
      }
    }
  }
  return oracle;
};
const perGame = new Map();
const tC = performance.now();
for (const { c, turn } of relevantRoots) {
  const gameKey = `${c.key}|${turn.spec.policy}`;
  let budget = perGame.get(gameKey) ?? EXPLORE_PER_GAME;
  let frontier = [turn.after];
  for (let depth = 0; depth < 2 && budget > 0; depth += 1) {
    const next = [];
    for (const state of frontier) {
      for (let a = 0; a < ACTIONS.length && budget > 0; a += 1) {
        const oracle = evalPair(c, state, a, "explored");
        if (!oracle) continue;
        budget -= 1;
        if (depth === 0) for (const s of oracle.states) next.push(parseCanon(s));
      }
    }
    frontier = next;
  }
  perGame.set(gameKey, budget);
}
for (const c of contexts.values()) {
  const { octx } = c;
  const unionDoors = [...new Set([...octx.zones[0].accesses, ...(octx.zones[1] ?? octx.zones[0]).accesses].map(cellId))];
  for (const door of unionDoors) {
    const bit = octx.trapKeys.indexOf(keyOf(door));
    if (bit < 0) continue;
    const masks = [];
    for (let mask = 0; mask < 1 << octx.trapKeys.length && masks.length < GRID.masks; mask += 1) if (mask & (1 << bit)) masks.push(mask);
    for (const mask of masks) {
      const topology = mask & octx.linkBit ? 1 : 0;
      const walls = octx.walls[topology];
      const armed = new Set(octx.trapKeys.filter((_, i) => mask & (1 << i)));
      const home = octx.API.getReachableDistances(octx.map.exitPosition, new Set([...walls, ...armed]));
      const sentinels = [...home.entries()].filter(([, d]) => d >= 1 && d <= 4).map(([k]) => cellId({ row: +k.split(",")[0], col: +k.split(",")[1] })).slice(0, GRID.sentinels);
      const arrivals = [];
      for (let id = 0; id < 81 && arrivals.length < GRID.arrivals; id += 1) {
        if (walls.has(keyOf(id)) || id === octx.exitId || manhattanIds(id, door) > 3) continue;
        if (octx.trapKeys.includes(keyOf(id)) && !armed.has(keyOf(id))) continue;
        arrivals.push(id);
      }
      for (const s of sentinels) {
        for (const next of arrivals) {
          if (next === s) continue;
          const from = ACTIONS.map((a, k) => ({ k, r: Math.floor(next / 9) - a.row, col: (next % 9) - a.col }))
            .map((x) => ({ ...x, id: x.r * 9 + x.col }))
            .find(({ id, r, col }) => r >= 0 && col >= 0 && r < 9 && col < 9 && !walls.has(keyOf(id)) && id !== s && id !== octx.exitId);
          if (!from) continue;
          let hunter = -1;
          for (let id = 0; id < 81; id += 1) {
            if (walls.has(keyOf(id)) || armed.has(keyOf(id)) || id === octx.exitId || [s, next, from.id].includes(id)) continue;
            if (hunter < 0 || manhattanIds(id, next) + manhattanIds(id, s) > manhattanIds(hunter, next) + manhattanIds(hunter, s)) hunter = id;
          }
          for (let commit = 0; commit <= 3; commit += 1) evalPair(c, { e: from.id, h: hunter, s, target: door, c: commit, lights: 0, traps: mask }, from.k, "grid");
        }
      }
    }
  }
}
const focusedMs = performance.now() - tC;
log(`   pairs ${focused.pairs} ${JSON.stringify(focused.bySource)} · base vs production ${focused.base.disagreements} ${JSON.stringify(focused.base.byClass)} · candidate ${focused.candidate.disagreements}`);
log(`   static pairs ${focused.static.pairs} · base vs string reference ${focused.static.base.disagreements} · candidate ${focused.static.candidate.disagreements} · oracle vs string reference ${focused.static.oracleVsStringReference}`);

// =================================================================================================
// D — exact classes on the earlier censuses' solver sample, base vs corrected
// =================================================================================================
log("D  exact PRE_CHEST classes, base solver vs corrected solver (product rules)");
const classes = { maps: 0, base: {}, candidate: {}, transitions: {}, changed: [], exploredDiffers: 0 };
const solverSample = ROUTES.flatMap((route) => DIFFICULTIES.flatMap((difficulty) => allMaps.filter((m) => m.route === route && m.difficulty === difficulty).slice(0, SOLVER_PER_COMBINATION)));
const classTimes = { base: 0, candidate: 0 };
for (const { seed, route, difficulty, map } of solverSample) {
  const rules = { dynamic: true, requirePassage: route >= 2 };
  let t = performance.now();
  const b = BASE.rota2.classifyMap(map, difficulty, rules);
  classTimes.base += performance.now() - t;
  t = performance.now();
  const a = CANDIDATE.rota2.classifyMap(map, difficulty, rules);
  classTimes.candidate += performance.now() - t;
  const pair = `${short(b.label)}->${short(a.label)}`;
  classes.maps += 1;
  tally(classes.base, short(b.label));
  tally(classes.candidate, short(a.label));
  tally(classes.transitions, pair);
  if (b.explored !== a.explored) classes.exploredDiffers += 1;
  if (short(b.label) !== short(a.label)) classes.changed.push({ seed, route, difficulty, pair, exploredBase: b.explored, exploredCandidate: a.explored });
  log(`   R${route} ${difficulty} ${seed}: base ${short(b.label)} (${b.explored}) → corrected ${short(a.label)} (${a.explored})`);
}

// =================================================================================================
// E — performance (run metadata)
// =================================================================================================
log("E  performance");
const perf = {};
{
  const sample = allMaps.slice(0, Math.min(allMaps.length, 270));
  const timePrep = (solvers) => {
    const t = performance.now();
    for (const { map, difficulty, route } of sample) solvers.rota2.buildDynamicContext(map, difficulty, { requirePassage: route >= 2 });
    return (performance.now() - t) / sample.length;
  };
  timePrep(CANDIDATE);
  perf.prepareMsPerMap = { base: Number(timePrep(BASE).toFixed(3)), candidate: Number(timePrep(CANDIDATE).toFixed(3)) };
  // Per transition: the same runtime (state, action) set, every turn, through each solver.
  const work = turns.slice(0, 20_000).map((t) => ({ c: contexts.get(`${t.spec.seed}|${t.spec.route}|${t.spec.difficulty}`), t }));
  const timeEnum = (which, solvers) => {
    let n = 0;
    const t0 = performance.now();
    for (let round = 0; round < 3; round += 1) {
      for (const { c, t } of work) {
        solvers.rota2.dynamicSuccessorSet(c.d[which], { e: t.before.e, h: t.before.h, s: t.before.s, t: t.before.target < 0 ? -1 : [...c.d[which].unionAccessIds].indexOf(t.before.target), c: t.before.c, lights: t.before.lights, traps: t.before.traps }, t.actionIndex);
        n += 1;
      }
    }
    return ((performance.now() - t0) * 1000) / n;
  };
  timeEnum("base", BASE);
  timeEnum("candidate", CANDIDATE);
  perf.microsecondsPerTransition = { base: Number(timeEnum("base", BASE).toFixed(3)), candidate: Number(timeEnum("candidate", CANDIDATE).toFixed(3)), transitions: work.length * 3 };
  // Exploration throughput and heap on a fixed set of maps, same budget.
  const explorationMaps = allMaps.filter((m, i) => i % 45 === 0).slice(0, 24);
  const timeExplore = (solvers) => {
    let states = 0;
    let ms = 0;
    let heap = 0;
    for (const { map, difficulty, route } of explorationMaps) {
      const dctx = solvers.rota2.buildDynamicContext(map, difficulty, { requirePassage: route >= 2 });
      const h0 = process.memoryUsage().heapUsed;
      const g = solvers.rota2.exploreDynamic(dctx, { maxStates: 200_000, maxElapsedMs: 20_000 });
      heap = Math.max(heap, process.memoryUsage().heapUsed - h0);
      states += g.explored;
      ms += g.elapsedMs;
    }
    return { states, ms: Math.round(ms), statesPerSecond: Math.round((states * 1000) / ms), peakHeapDeltaMb: Number((heap / 2 ** 20).toFixed(1)) };
  };
  perf.exploration = { maps: explorationMaps.length, base: timeExplore(BASE), candidate: timeExplore(CANDIDATE) };
  perf.classifyMs = { base: Math.round(classTimes.base), candidate: Math.round(classTimes.candidate) };
  perf.phasesMs = { hook: Math.round(hookMs), focused: Math.round(focusedMs) };
  log(`   ${JSON.stringify(perf)}`);
}

// =================================================================================================
// verdict
// =================================================================================================
const checks = {
  noGenerationChange: generation.changedVsBase === 0 && generation.throws === 0 && generation.sameAsBase === generation.maps,
  noGenerationDrawChange: generation.drawsSameAsBase === generation.maps,
  hookIdenticalOnBaseTree: runtime.hookSameOnBaseTree,
  // The gap the mission corrects is reproduced on the base, inside its class and nowhere else …
  baseReproducesTheGap: runtime.base.disagreements > 0 && (runtime.base.byClass.BLOCKED_KEPT ?? 0) === runtime.base.disagreements,
  baseGapOnlyInBlockedTargetClass: Object.keys(runtime.base.byClass).every((k) => k === "BLOCKED_KEPT") && Object.keys(focused.base.byClass).every((k) => k === "BLOCKED_KEPT") && Object.keys(focused.static.base.byClass).every((k) => k === "BLOCKED_KEPT"),
  // … and gone after the correction: every hook turn in the corrected support, every production pair equal.
  candidateAgreesWithHook: runtime.candidate.disagreements === 0 && runtime.staticRoute1.candidate.disagreements === 0,
  candidateAgreesWithProduction: focused.candidate.disagreements === 0 && focused.static.candidate.disagreements === 0,
  oracleIsTheStringReference: focused.static.oracleVsStringReference === 0,
  sentinelNeverOnBlockedCell: focused.sentinelOnBlocked.candidate === 0,
  hunterUnchanged: runtime.hunter.supportDiffers === 0 && runtime.hunter.hookHunterOutside === 0,
  blockedTargetCaseExercised: (runtime.byClass.BLOCKED_KEPT ?? 0) > 0 && (focused.byClass.BLOCKED_KEPT ?? 0) > 0 && runtime.armedDuringCommitment > 0,
};
const allPass = Object.values(checks).every(Boolean);
for (const [name, pass] of Object.entries(checks)) log(`${pass ? "PASS" : "FAIL"}  ${name}`);
log(allPass ? "ROTA2_SENTINEL_FIDELITY_CENSUS_OK" : "ROTA2_SENTINEL_FIDELITY_CENSUS_FAILED");
if (QUICK) {
  log(JSON.stringify({ runtime: { ...runtime, reproducing: undefined }, focused }, null, 1).slice(0, 6000));
  process.exit(allPass ? 0 : 1);
}
const EVIDENCE = openEvidence(process.env.ROUTE_VALIDATION_OUT ?? "docs/archive/rota2-sentinel-solver-fidelity-03");
EVIDENCE.write(
  "census.json",
  {
    mission: "ROTA2-SENTINEL-SOLVER-FIDELITY-03",
    base: FIDELITY_BASE,
    allPass,
    checks,
    sizes: { routes: ROUTES, difficulties: DIFFICULTIES, mapsPerCombination: MAPS_PER_COMBINATION, gamesPerMap: 2, explorePerGame: EXPLORE_PER_GAME, grid: GRID, solverPerCombination: SOLVER_PER_COMBINATION },
    generation,
    runtime,
    focused,
    classes,
    performance: perf,
    run: { elapsedMs: Math.round(performance.now() - started) },
  },
  { metadata: ["run", "performance"] },
);
process.exitCode = EVIDENCE.finish({ ok: allPass });
