/**
 * ROTA2-SENTINEL-SOLVER-FIDELITY-03 — the reference solvers' Sentinel, held against the hook's.
 *
 * Production is the truth: `decideSentinelMove` (route-defenders.ts) on the graph `runDefenderPhase` gives it — the
 * turn's walls plus the armed traps — with `getReachableDistances(target, graph)` (route-geometry.ts) as the distance
 * it releases and scores by. That BFS seeds its start cell even when the cell is an armed trap. The packed solvers read
 * an all-pairs table whose BFS skips a blocked start row, so a door the Explorer arms looked unreachable to them: they
 * released the commitment the hook keeps and scored every move 99 (the 25/2016 "held door became an armed trap" gap of
 * ROTA2-DEPENDENT-OBJECTIVES-02). The correction reads every target distance through `sentinel-target-distance.mjs`.
 *
 * What is compared, on one tree (the working tree, or `--rev`), always against:
 *   - the REAL hook (route-runtime-harness.mjs): every pre-Chest turn of scripted games — the Route 1 portal rush that
 *     measured the gap, and trap tours on seeds where the arming, the release and the union of doors happen;
 *   - the PRODUCTION turn composed from production pieces (`oracleSuccessors`): reference Hunter support, the REAL
 *     `decideSentinelMove` and `computePortalDefenceZone` on the maze after the step — on those turns, on a depth-2
 *     exploration around every turn where a trap matters, and on an exhaustive decision grid around every door that is
 *     a trap;
 *   - the string reference (`dynamic-solver.mjs` `successors`, production `decideSentinelMove` on the certified board)
 *     for the static solver;
 *   - the pre-mission solvers (f5826b2) for what must not move.
 * Held door identity is compared as a CELL (the Rota 2.0 solver indexes it in the union of both topologies' doors).
 *
 * Checks are tagged:
 *   [fidelity]   the corrected semantics — must FAIL on the exact base (`--rev=f5826b2`) and PASS here;
 *   [preserved]  what the correction must not move — must PASS on both.
 *
 * Usage:
 *   node tools/validation/rota2-sentinel-solver-fidelity-tests.mjs                 # S00–S12 (check evidence)
 *   node tools/validation/rota2-sentinel-solver-fidelity-tests.mjs --update        # rewrite the evidence
 *   node tools/validation/rota2-sentinel-solver-fidelity-tests.mjs --rev=f5826b2   # counterfactual (check/--update)
 *   node tools/validation/rota2-sentinel-solver-fidelity-tests.mjs --mutants       # M01–M12 (check/--update)
 *
 * Exit: 0 pass · 1 a check (or counterfactual/mutant expectation) failed · 2 evidence diverged · 3 usage.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { EXIT_USAGE, EXIT_VALIDATION_FAILED, openEvidence } from "./evidence.mjs";
import { loadRouteRuntime } from "./route-runtime-harness.mjs";
import { ACTIONS, API as REFERENCE_API, buildContext, encode, initialState, setSeed as setReferenceSeed, successors as stringReferenceSuccessors } from "./dynamic-solver.mjs";
import {
  FIDELITY_BASE,
  HELPER_FILE,
  PACKED_FILE,
  REPO_ROOT,
  ROTA2_FILE,
  SOLVER_FILES,
  attachRecorder,
  canon,
  cellId,
  cellOf,
  decisionClass,
  decisionRecorder,
  keyOf,
  loadSolvers,
  oracleContext,
  oracleSuccessors,
  packedAnswer,
  parseCanon,
  playFixtureGames,
  rota2Answer,
  sameAnswer,
  sentinelMoveBody,
} from "./rota2-sentinel-solver-fidelity-lib.mjs";

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
const MUTANTS = args.includes("--mutants");
const known = new Set([revArg, "--mutants", "--check", "--update"].filter(Boolean));
if (args.some((arg) => !known.has(arg)) || REV === "" || (REV && MUTANTS)) {
  console.error("usage: node tools/validation/rota2-sentinel-solver-fidelity-tests.mjs [--check|--update] [--rev=<commit> | --mutants]");
  process.exit(EXIT_USAGE);
}
const OUT = process.env.ROUTE_VALIDATION_OUT ?? "docs/archive/rota2-sentinel-solver-fidelity-03";
const DIFFICULTIES = ["easy", "medium", "hard"];

// =================================================================================================
// fixtures — the real hook, nothing hand-placed
// =================================================================================================

/** The walk that measured the gap (ROTA2-DEPENDENT-OBJECTIVES-02 census D3): Route 1, seeds 6400–6439, every mode. */
const PORTAL_RUSH = DIFFICULTIES.flatMap((difficulty) => Array.from({ length: 40 }, (_, i) => ({ seed: 6_400 + i, route: 1, difficulty, policy: "portalRush" })));
/**
 * Trap tours on census seeds (rota2-sentinel-solver-fidelity-census.mjs seeds) where the hook releases a commitment
 * (a blocked door the target-root BFS cannot reach from the Sentinel; a walkable door another armed trap cuts off) and
 * where the opened maze re-indexes the Sentinel's doors with a trap on one of them. Each check below asserts the shape
 * it needs actually occurs, so a seed that stops being a witness fails loudly rather than thinning the proof.
 */
const TOUR_SEEDS = [
  [9_212_036, 1, "hard"], [9_221_100, 2, "medium"], [9_222_105, 2, "hard"], [9_222_118, 2, "hard"],
  [9_211_042, 1, "medium"], [9_212_021, 1, "hard"], [9_212_083, 1, "hard"], [9_212_092, 1, "hard"],
  [9_220_042, 2, "easy"], [9_221_104, 2, "medium"], [9_222_089, 2, "hard"],
];
const TOURS = TOUR_SEEDS.flatMap(([seed, route, difficulty]) => ["trapTour", "doorTraps"].map((policy) => ({ seed, route, difficulty, policy })));
/** Second Chance games (S11): the Chest, the Second Chance, then into the Hunter. */
const SECOND_CHANCE_SEEDS = [[9_221_000, 2, "medium"], [9_232_000, 3, "hard"], [9_210_005, 1, "easy"]];

/**
 * Witnesses the pre-correction solver produced and the closed records still carry (ROTA-DYNAMIC-SOLVABILITY-02A
 * shortest existential witnesses, which ROTA-ADVERSARIAL-SOLVABILITY-03 re-validates step by step). Each step is
 * judged by production (the string reference: production `decideSentinelMove` on the certified board); the static
 * solver must accept exactly the steps production accepts, up to the first one production does not make.
 */
const ARCHIVED_WITNESSES = "docs/archive/route-dynamic-solvability-02a/hash-1/suspect-seeds-analysis.json";
function archivedWitnessSteps() {
  const report = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, ARCHIVED_WITNESSES), "utf8"));
  const steps = [];
  const witnesses = [];
  for (const item of report.cases) {
    const witness = item.shortestExistentialWitness ?? [];
    if (witness.length === 0) continue;
    setReferenceSeed(item.seed);
    const map = REFERENCE_API.generateMaze(item.mode, item.route);
    const ctx = buildContext(map, item.mode);
    const id = (k) => cellId({ row: +k.split(",")[0], col: +k.split(",")[1] });
    const toCanonical = (st) => ({ e: id(st.e), h: id(st.h), s: id(st.s), target: st.t < 0 ? -1 : id(ctx.accessKeys[st.t]), c: st.c, lights: st.lights, traps: st.traps });
    let state = initialState(ctx);
    let firstNonProduction = null;
    for (let index = 0; index < witness.length; index += 1) {
      const step = witness[index];
      const actionIndex = ACTIONS.findIndex((a) => a.name === step.action);
      const res = stringReferenceSuccessors(ctx, state, ACTIONS[actionIndex]);
      const productionHas = Boolean(res) && (step.state === "WIN" ? res.outcomes.some((o) => o.terminal === "WIN") : res.outcomes.some((o) => o.state && encode(o.state) === step.state));
      let target = "WIN";
      if (step.state !== "WIN") {
        const [e, h, sn, t, c, lights, traps] = step.state.split("|");
        target = canon(toCanonical({ e, h, s: sn, t: Number(t), c: Number(c), lights: Number(lights), traps: Number(traps) }));
      }
      steps.push({ seed: item.seed, route: item.route, mode: item.mode, index: index + 1, map, ctx, state: toCanonical(state), actionIndex, target, productionHas });
      if (!productionHas) {
        firstNonProduction = index + 1;
        break;
      }
      if (step.state === "WIN") break;
      const [e, h, sn, t, c, lights, traps] = step.state.split("|");
      state = { e, h, s: sn, t: Number(t), c: Number(c), lights: Number(lights), traps: Number(traps) };
    }
    witnesses.push({ seed: item.seed, route: item.route, mode: item.mode, length: witness.length, firstNonProductionStep: firstNonProduction });
  }
  return { steps, witnesses };
}

const mapKey = (spec) => `${spec.seed}|${spec.route}|${spec.difficulty}`;
const pairKey = (state, actionIndex) => `${canon(state)}#${actionIndex}`;
const manhattanIds = (a, b) => Math.abs(Math.floor(a / 9) - Math.floor(b / 9)) + Math.abs((a % 9) - (b % 9));

function srcUnchanged(rev) {
  const run = (argv) => execFileSync("git", argv, { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  const committed = rev ? run(["diff", "--name-only", FIDELITY_BASE, rev, "--", "src/"]) : run(["diff", "--name-only", FIDELITY_BASE, "--", "src/"]);
  const untracked = rev ? "" : run(["status", "--porcelain", "--", "src/"]);
  return { committed: committed ? committed.split("\n") : [], untracked: untracked ? untracked.split("\n") : [] };
}

/** Second Chance games on one runtime: every render's pieces and the event stream. */
function secondChanceGames(RT) {
  const out = [];
  for (const [seed, route, difficulty] of SECOND_CHANCE_SEEDS) {
    const frames = [];
    const run = RT.mount({ seed, difficulty, routeNumber: route, onRender: (g) => g?.mazeMap && frames.push([g.status, keyOf(cellId(g.player)), keyOf(cellId(g.guardian)), keyOf(cellId(g.sentinel)), g.sentinelCommitLeft, g.rewardSelected, g.rewardSpent, g.errors]) });
    const map = run.state.mazeMap;
    const walkTo = (goal) => {
      for (let i = 0; i < 80 && run.state.status === "playing" && !run.state.rewardChoicePending; i += 1) {
        const g = run.state;
        if (g.player.row === goal.row && g.player.col === goal.col) return true;
        const blocked = new Set([...g.walls, keyOf(cellId(g.guardian)), keyOf(cellId(g.sentinel))]);
        blocked.delete(keyOf(cellId(goal)));
        const queue = [cellId(g.player)];
        const prev = new Map([[cellId(g.player), -1]]);
        for (let h = 0; h < queue.length && !prev.has(cellId(goal)); h += 1) {
          for (const a of ACTIONS) {
            const r = Math.floor(queue[h] / 9) + a.row;
            const c = (queue[h] % 9) + a.col;
            const id = r * 9 + c;
            if (r < 0 || c < 0 || r > 8 || c > 8 || prev.has(id) || blocked.has(keyOf(id))) continue;
            prev.set(id, queue[h]);
            queue.push(id);
          }
        }
        if (!prev.has(cellId(goal))) return false;
        let cursor = cellId(goal);
        while (prev.get(cursor) !== cellId(g.player)) cursor = prev.get(cursor);
        run.stepTo(cellOf(cursor));
      }
      return run.state.player.row === goal.row && run.state.player.col === goal.col;
    };
    let reachedChest = false;
    let used = false;
    if (map.chest && walkTo(map.chest) && run.state.rewardChoicePending) {
      reachedChest = true;
      run.choose("second-chance");
      for (let i = 0; i < 60 && run.state.status === "playing"; i += 1) {
        const before = run.state.rewardSpent;
        const g = run.state;
        const toward = [...ACTIONS].map((a) => ({ row: g.player.row + a.row, col: g.player.col + a.col }))
          .filter((c) => c.row >= 0 && c.col >= 0 && c.row < 9 && c.col < 9 && !g.walls.has(keyOf(cellId(c))))
          .sort((a, b) => manhattanIds(cellId(a), cellId(g.guardian)) - manhattanIds(cellId(b), cellId(g.guardian)))[0];
        if (!toward) break;
        run.stepTo(toward);
        if (!before && run.state.rewardSpent) used = true;
      }
    }
    out.push({ seed, route, difficulty, reachedChest, used, status: run.state.status, frames: JSON.stringify(frames), completions: JSON.stringify(run.completions) });
    run.unmount();
  }
  return out;
}

/**
 * Everything that does not depend on the solver under test: the hook's turns on the tree under test (and, for S10/S11,
 * the same games on the other tree), the production answer for every pair, the string reference's for the static
 * pairs, and the pre-mission solvers' answers.
 */
async function collectFixtures(rev, log) {
  const RT = loadRouteRuntime({ directDifficulty: true, rev, transforms: [decisionRecorder(rev)] });
  const recorder = attachRecorder(RT);
  const t0 = performance.now();
  const turns = playFixtureGames(RT, recorder, [...PORTAL_RUSH, ...TOURS]);
  log(`   hook: ${turns.length} pre-Chest turns in ${PORTAL_RUSH.length + TOURS.length} games (${Math.round(performance.now() - t0)} ms)`);

  // The same games on the other tree: the hook (src/) is not this mission's, so its turns and draws must not move.
  const otherRev = rev === null ? FIDELITY_BASE : null;
  const RT2 = loadRouteRuntime({ directDifficulty: true, rev: otherRev, transforms: [decisionRecorder(otherRev)] });
  const turns2 = playFixtureGames(RT2, attachRecorder(RT2), [...PORTAL_RUSH, ...TOURS]);
  const secondChance = { here: secondChanceGames(RT), other: secondChanceGames(RT2), otherRev: otherRev ?? "working tree" };

  // --- per-map production contexts -------------------------------------------------------------------------------------
  const maps = new Map();
  const mapOf = (turn) => {
    const key = mapKey(turn.spec);
    if (!maps.has(key)) {
      const map = turn.map;
      maps.set(key, {
        key, spec: turn.spec, map, difficulty: turn.spec.difficulty, requirePassage: turn.requirePassage,
        octx: oracleContext(RT.API, map, turn.spec.difficulty, { requirePassage: turn.requirePassage }),
        staticCtx: buildContext(map, turn.spec.difficulty),
      });
    }
    return maps.get(key);
  };

  // --- pairs ------------------------------------------------------------------------------------------------------------
  const pairs = [];
  const seen = new Map();
  const addPair = (m, state, actionIndex, source, turn = null) => {
    const key = `${m.key}#${pairKey(state, actionIndex)}`;
    if (seen.has(key)) {
      if (turn) seen.get(key).turns.push(turn);
      return null;
    }
    const oracle = oracleSuccessors(m.octx, state, actionIndex, recorder);
    if (!oracle) return null;
    const decision = oracle.decisions[0] ?? null;
    const pair = {
      key, m, state, actionIndex, source, turns: turn ? [turn] : [], oracle, decision, cls: decisionClass(decision),
      held: state.c > 0 && state.target >= 0,
      armingNow: oracle.next !== undefined && (oracle.traps ?? state.traps) !== state.traps,
    };
    pairs.push(pair);
    seen.set(key, pair);
    return pair;
  };
  for (const turn of turns) addPair(mapOf(turn), turn.before, turn.actionIndex, "runtime", turn);
  log(`   runtime pairs: ${pairs.length}`);

  // Depth-2 production exploration around every turn where a trap matters: something armed, or a door that is a trap
  // within three steps of the Explorer.
  const PER_GAME = 400;
  const perGame = new Map();
  for (const turn of turns) {
    if (turn.status !== "playing") continue;
    const m = mapOf(turn);
    const doorTraps = m.octx.zones[turn.after.traps & m.octx.linkBit ? 1 : 0].accesses.map(cellId).filter((id) => m.octx.trapKeys.includes(keyOf(id)));
    const relevant = turn.after.traps !== 0 || doorTraps.some((d) => manhattanIds(d, turn.after.e) <= 3);
    if (!relevant) continue;
    const gameKey = `${m.key}|${turn.spec.policy}`;
    let budget = perGame.get(gameKey) ?? PER_GAME;
    const frontier = [turn.after];
    for (let depth = 0; depth < 2 && budget > 0; depth += 1) {
      const next = [];
      for (const state of frontier) {
        for (let a = 0; a < ACTIONS.length && budget > 0; a += 1) {
          const pair = addPair(m, state, a, "explored");
          if (!pair) continue;
          budget -= 1;
          if (depth === 0) for (const s of pair.oracle.states) next.push(parseCanon(s));
        }
      }
      frontier.splice(0, frontier.length, ...next);
    }
    perGame.set(gameKey, budget);
  }
  log(`   + explored: ${pairs.length} pairs`);

  // The decision grid: around every door that is a trap, the trap armed (with every other trap armed or not), the
  // Sentinel on every cell it can stand on within its leash, holding that door with every commitment (or none),
  // the Explorer arriving on every cell near the door; the Hunter parked away from both.
  const GRID_MASKS = 8;
  let gridPairs = 0;
  for (const m of maps.values()) {
    const { octx } = m;
    const unionDoors = [...new Set([...octx.zones[0].accesses, ...(octx.zones[1] ?? octx.zones[0]).accesses].map(cellId))];
    for (const door of unionDoors) {
      const bit = octx.trapKeys.indexOf(keyOf(door));
      if (bit < 0) continue;
      const masks = [];
      for (let mask = 0; mask < 1 << octx.trapKeys.length && masks.length < GRID_MASKS; mask += 1) if (mask & (1 << bit)) masks.push(mask);
      for (const mask of masks) {
        const topology = mask & octx.linkBit ? 1 : 0;
        const walls = octx.walls[topology];
        const armed = new Set(octx.trapKeys.filter((_, i) => mask & (1 << i)));
        const graph = new Set([...walls, ...armed]);
        const homeDistance = octx.API.getReachableDistances(octx.map.exitPosition, graph);
        const sentinels = [...homeDistance.entries()].filter(([k, d]) => d >= 1 && d <= 4 && k !== keyOf(door)).map(([k]) => cellId({ row: +k.split(",")[0], col: +k.split(",")[1] }));
        const arrivals = [];
        for (let id = 0; id < 81; id += 1) {
          if (walls.has(keyOf(id)) || id === octx.exitId || manhattanIds(id, door) > 3) continue;
          if (octx.trapKeys.includes(keyOf(id)) && !armed.has(keyOf(id))) continue;
          arrivals.push(id);
        }
        for (const s of sentinels) {
          for (const next of arrivals.slice(0, 10)) {
            if (next === s) continue;
            const from = ACTIONS.map((a, k) => ({ k, id: (Math.floor(next / 9) - a.row) * 9 + ((next % 9) - a.col), r: Math.floor(next / 9) - a.row, c: (next % 9) - a.col }))
              .find(({ id, r, c }) => r >= 0 && c >= 0 && r < 9 && c < 9 && !walls.has(keyOf(id)) && id !== s && id !== octx.exitId);
            if (!from) continue;
            let hunter = -1;
            for (let id = 0; id < 81; id += 1) {
              if (walls.has(keyOf(id)) || armed.has(keyOf(id)) || id === octx.exitId || [s, next, from.id].includes(id)) continue;
              if (hunter < 0 || manhattanIds(id, next) + manhattanIds(id, s) > manhattanIds(hunter, next) + manhattanIds(hunter, s)) hunter = id;
            }
            for (let c = 0; c <= 3; c += 1) {
              if (addPair(m, { e: from.id, h: hunter, s, target: door, c, lights: 0, traps: mask }, from.k, "grid")) gridPairs += 1;
            }
          }
        }
      }
    }
  }
  log(`   + decision grid: ${gridPairs} pairs (${pairs.length} in all)`);

  // The string reference for every pair the static model can state: no piece on a wall of the certified board (the
  // opened wall is walkable only in the dynamic model), the held door one of the certified board's doors.
  let staticPairs = 0;
  for (const pair of pairs) {
    const ctx = pair.m.staticCtx;
    const accessKeys = ctx.accessKeys;
    if (pair.state.target >= 0 && !accessKeys.includes(keyOf(pair.state.target))) continue;
    if ([pair.state.e, pair.state.h, pair.state.s].some((id) => pair.m.map.walls.has(keyOf(id)))) continue;
    const st = { e: keyOf(pair.state.e), h: keyOf(pair.state.h), s: keyOf(pair.state.s), t: pair.state.target < 0 ? -1 : accessKeys.indexOf(keyOf(pair.state.target)), c: pair.state.c, lights: pair.state.lights, traps: pair.state.traps };
    const res = stringReferenceSuccessors(ctx, st, ACTIONS[pair.actionIndex]);
    if (!res) continue;
    const states = new Set();
    let hasWin = false;
    let hasLoss = false;
    for (const o of res.outcomes) {
      if (o.terminal === "WIN") hasWin = true;
      else if (o.terminal === "LOSS") hasLoss = true;
      else {
        const x = o.state;
        const id = (k) => cellId({ row: +k.split(",")[0], col: +k.split(",")[1] });
        states.add(canon({ e: id(x.e), h: id(x.h), s: id(x.s), target: x.t < 0 ? -1 : id(accessKeys[x.t]), c: x.c, lights: x.lights, traps: x.traps }));
      }
    }
    pair.staticRef = { hasWin, hasLoss, states: [...states].sort() };
    staticPairs += 1;
  }
  log(`   static reference on ${staticPairs} pairs`);

  // The production composition with the link ignored, where the string reference also answers (S00b) — and the
  // static model's own production decision class (on the certified board the Sentinel may aim at another door).
  for (const pair of pairs) {
    if (!pair.staticRef) continue;
    pair.m.octxStatic ??= oracleContext(RT.API, pair.m.map, pair.m.difficulty, { dynamic: false });
    const o = oracleSuccessors(pair.m.octxStatic, pair.state, pair.actionIndex, recorder);
    pair.staticOracle = o && { hasWin: o.hasWin, hasLoss: o.hasLoss, states: o.states };
    pair.staticCls = o ? decisionClass(o.decisions[0] ?? null) : null;
  }

  const archived = archivedWitnessSteps();
  log(`   archived witnesses: ${archived.witnesses.length}, ${archived.steps.length} steps judged by production`);

  return { RT, turns, turns2, secondChance, maps: [...maps.values()], pairs, archived, otherRev: otherRev ?? "working tree" };
}

/** A solver tree's answers on every pair (Rota 2.0 solver everywhere; static solver where the string reference answers). */
function answerAll(solvers, fixtures) {
  const dctx = new Map();
  const sctx = new Map();
  const out = new Map();
  for (const pair of fixtures.pairs) {
    const m = pair.m;
    if (!dctx.has(m.key)) dctx.set(m.key, solvers.rota2.buildDynamicContext(m.map, m.difficulty, { requirePassage: m.requirePassage }));
    if (!sctx.has(m.key)) sctx.set(m.key, buildContext(m.map, m.difficulty));
    const dynamic = rota2Answer(solvers, dctx.get(m.key), pair.state, pair.actionIndex);
    const stat = pair.staticRef ? packedAnswer(solvers, sctx.get(m.key), pair.state, pair.actionIndex) : null;
    out.set(pair.key, { dynamic, stat });
  }
  return { answers: out, dctx, sctx };
}

const oracleAnswer = (pair) => ({ hasWin: pair.oracle.hasWin, hasLoss: pair.oracle.hasLoss, states: pair.oracle.states });
/** Does the hook's turn lie in `answer`? */
function hookInSupport(turn, answer) {
  if (!answer) return false;
  if (turn.status === "lost") return answer.hasLoss;
  if (turn.status === "won") return answer.hasWin;
  return answer.states.includes(canon(turn.after));
}
/** How a missed hook turn differs from the closest successor (same Explorer, Hunter, lights, traps). */
function missShape(turn, answer) {
  const post = turn.after;
  const same = (answer?.states ?? []).map(parseCanon).filter((x) => x.e === post.e && x.h === post.h && x.lights === post.lights && x.traps === post.traps);
  if (same.length === 0) return { position: true, target: true, commitLeft: true, noComparable: true };
  const x = same[0];
  return { position: x.s !== post.s, target: x.target !== post.target, commitLeft: x.c !== post.c };
}
const blockedIn = (pair, cell, traps) => {
  const topology = traps & pair.m.octx.linkBit ? 1 : 0;
  return pair.m.octx.walls[topology].has(keyOf(cell)) || pair.m.octx.trapKeys.some((k, i) => traps & (1 << i) && k === keyOf(cell));
};

// =================================================================================================
// the checks — one solver tree against the fixtures
// =================================================================================================

function runChecks(solvers, fixtures, pre, { quiet = false, label = "" } = {}) {
  const log = quiet ? () => {} : (...m) => console.log(...m);
  const results = [];
  const record = (id, tag, name, pass, detail = {}) => {
    results.push({ id, tag, name, pass: Boolean(pass), detail });
    log(`${pass ? "PASS" : "FAIL"}  ${id} [${tag}] — ${name}`);
    for (const [k, v] of Object.entries(detail)) {
      const text = typeof v === "object" ? JSON.stringify(v) : String(v);
      log(`        ${k}: ${text.length > 400 ? `${text.slice(0, 397)}...` : text}`);
    }
  };
  const guarded = (id, tag, name, fn) => {
    try {
      const { pass, ...detail } = fn();
      record(id, tag, name, pass, detail);
    } catch (error) {
      record(id, tag, name, false, { error: String(error?.stack ?? error).split("\n").slice(0, 3).join(" | ") });
    }
  };
  if (label) log(label);
  const { answers, dctx } = answerAll(solvers, fixtures);
  const preAnswers = pre.answers;
  const { pairs } = fixtures;
  const runtimePairs = pairs.filter((p) => p.source === "runtime");
  const runtimeTurns = runtimePairs.flatMap((p) => p.turns.map((turn) => ({ turn, pair: p })));
  const firstMisses = (list, limit = 3) => list.slice(0, limit).map((p) => ({ map: p.m.key, state: canon(p.state), action: ACTIONS[p.actionIndex].name, cls: p.cls, oracle: p.oracle.states.slice(0, 3), solver: answers.get(p.key).dynamic?.states.slice(0, 3) }));
  /** Solver == production on every pair of `list`; hook ∈ solver support on every runtime turn of it. */
  const agree = (list, which = "dynamic") => {
    const wrong = list.filter((p) => !sameAnswer(answers.get(p.key)[which], which === "dynamic" ? oracleAnswer(p) : p.staticRef));
    const turnsIn = [];
    const hookMiss = [];
    for (const p of list) {
      for (const turn of p.turns) {
        turnsIn.push(turn);
        if (!hookInSupport(turn, answers.get(p.key)[which])) hookMiss.push({ turn, pair: p });
      }
    }
    return { wrong, hookMiss, turnsIn };
  };
  const unchanged = (list, which = "dynamic") => list.filter((p) => !sameAnswer(answers.get(p.key)[which], preAnswers.get(p.key)[which]));

  // ---------------------------------------------------------------------------------------------- S00
  guarded("S00", "preserved", "THE_PRODUCTION_ORACLE_IS_THE_HOOK", () => {
    const outside = runtimeTurns.filter(({ turn, pair }) => !hookInSupport(turn, oracleAnswer(pair)));
    const staticPairs = pairs.filter((p) => p.staticRef && p.staticOracle);
    const disagree = staticPairs.filter((p) => !sameAnswer(p.staticOracle, p.staticRef));
    return {
      pass: runtimeTurns.length > 2000 && outside.length === 0 && staticPairs.length > 1000 && disagree.length === 0,
      hookTurns: runtimeTurns.length, hookTurnsOutsideOracle: outside.length,
      staticPairs: staticPairs.length, oracleVsStringReference: disagree.length,
      note: "every real hook turn is in the composed production support; with the link ignored the composition equals the string reference (production decideSentinelMove on the certified board)",
    };
  });

  // ---------------------------------------------------------------------------------------------- S01
  guarded("S01", "preserved", "HELD_OPEN_TARGET_NO_TRAP_UNCHANGED", () => {
    const list = pairs.filter((p) => p.cls === "NO_TRAP" && p.held);
    const { wrong, hookMiss, turnsIn } = agree(list);
    const moved = unchanged(list);
    return { pass: list.length > 500 && turnsIn.length > 100 && wrong.length === 0 && hookMiss.length === 0 && moved.length === 0, pairs: list.length, hookTurns: turnsIn.length, vsProduction: wrong.length, hookOutside: hookMiss.length, vsPreMission: moved.length, examples: firstMisses(wrong) };
  });

  // ---------------------------------------------------------------------------------------------- S02
  guarded("S02", "fidelity", "ARMED_TRAP_TARGET_KEPT_AS_THE_HOOK_KEEPS_IT", () => {
    const list = pairs.filter((p) => p.cls === "BLOCKED_KEPT");
    const { wrong, hookMiss, turnsIn } = agree(list);
    const runtime = list.filter((p) => p.source === "runtime");
    const armingHeld = runtime.filter((p) => p.armingNow && p.held && p.state.target === p.oracle.next);
    const laterHeld = runtime.filter((p) => !p.armingNow && p.held);
    const fresh = runtime.filter((p) => !p.held);
    // The Sentinel walks toward the trapped door: production's successor moves it (not just bookkeeping).
    const moving = runtime.filter((p) => p.oracle.states.some((s) => parseCanon(s).s !== p.state.s));
    const shapes = hookMiss.map(({ turn, pair }) => missShape(turn, answers.get(pair.key).dynamic));
    // The measurement that found the gap (DEPENDENT-OBJECTIVES-02 census D3: Route 1 portal rush, seeds 6400–6439,
    // 25 of 2016 turns outside the support), replayed: every portal-rush turn, whatever its class.
    const rush = runtimeTurns.filter(({ turn }) => turn.spec.policy === "portalRush");
    const portalRushReplay = {
      turns: rush.length,
      preMissionOutside: rush.filter(({ turn, pair }) => !hookInSupport(turn, preAnswers.get(pair.key).dynamic)).length,
      outside: rush.filter(({ turn, pair }) => !hookInSupport(turn, answers.get(pair.key).dynamic)).length,
    };
    return {
      pass: list.length > 100 && armingHeld.length > 0 && laterHeld.length > 0 && moving.length > 0 && wrong.length === 0 && hookMiss.length === 0,
      pairs: list.length, runtimePairs: runtime.length, hookTurns: turnsIn.length, portalRushReplay,
      witnesses: { armingTheHeldDoor: armingHeld.length, laterTurnsOfTheCommitment: laterHeld.length, freshCommitmentToAnArmedDoor: fresh.length, sentinelMoves: moving.length },
      vsProduction: wrong.length, hookOutside: hookMiss.length,
      hookMissShapes: { position: shapes.filter((s) => s.position).length, target: shapes.filter((s) => s.target).length, commitLeft: shapes.filter((s) => s.commitLeft).length },
      firstWitness: armingHeld[0] ? { map: armingHeld[0].m.key, policy: armingHeld[0].turns[0].spec.policy, turn: armingHeld[0].turns[0].k, before: canon(armingHeld[0].state), hook: canon(armingHeld[0].turns[0].after) } : null,
      examples: firstMisses(wrong),
    };
  });

  // ---------------------------------------------------------------------------------------------- S03
  guarded("S03", "preserved", "UNREACHABLE_COMMITMENT_RELEASED_EXACTLY_WHEN_PRODUCTION_RELEASES", () => {
    const list = pairs.filter((p) => p.cls === "BLOCKED_RELEASED" || p.cls === "OPEN_RELEASED");
    const { wrong, hookMiss, turnsIn } = agree(list);
    const runtime = list.filter((p) => p.source === "runtime");
    const blockedRuntime = runtime.filter((p) => p.cls === "BLOCKED_RELEASED");
    const openRuntime = runtime.filter((p) => p.cls === "OPEN_RELEASED");
    return {
      pass: blockedRuntime.length > 0 && openRuntime.length > 0 && wrong.length === 0 && hookMiss.length === 0,
      pairs: list.length, byClass: { blockedTargetUnreached: list.filter((p) => p.cls === "BLOCKED_RELEASED").length, openTargetCutOff: list.filter((p) => p.cls === "OPEN_RELEASED").length },
      runtimeWitnesses: { blockedTargetUnreached: blockedRuntime.length, openTargetCutOff: openRuntime.length }, hookTurns: turnsIn.length,
      vsProduction: wrong.length, hookOutside: hookMiss.length, examples: firstMisses(wrong),
      firstWitness: blockedRuntime[0] ? { map: blockedRuntime[0].m.key, policy: blockedRuntime[0].turns[0].spec.policy, before: canon(blockedRuntime[0].state), hook: canon(blockedRuntime[0].turns[0].after) } : null,
    };
  });

  // ---------------------------------------------------------------------------------------------- S04
  guarded("S04", "preserved", "TRAP_ON_ANOTHER_CELL_POLICY_PRESERVED", () => {
    const list = pairs.filter((p) => p.cls === "OTHER_TRAP" && p.held);
    const { wrong, hookMiss, turnsIn } = agree(list);
    const moved = unchanged(list);
    return { pass: list.length > 500 && turnsIn.length > 50 && wrong.length === 0 && hookMiss.length === 0 && moved.length === 0, pairs: list.length, hookTurns: turnsIn.length, vsProduction: wrong.length, hookOutside: hookMiss.length, vsPreMission: moved.length, examples: firstMisses(wrong) };
  });

  // ---------------------------------------------------------------------------------------------- S05
  guarded("S05", "fidelity", "OPENED_MAZE_KEEPS_UNION_DOOR_IDENTITY", () => {
    const list = pairs.filter((p) => p.oracle.open);
    const { wrong, hookMiss, turnsIn } = agree(list);
    // A turn on the opened maze where the door the Sentinel aims at has another index in that maze's own list than
    // in the union — identity must survive the re-indexing.
    const remapped = list.filter((p) => {
      if (p.source !== "runtime" || !p.decision) return false;
      const d = dctx.get(p.m.key);
      const target = cellId({ row: +p.decision.target.split(",")[0], col: +p.decision.target.split(",")[1] });
      const local = [...d.open.packed.accessIds].indexOf(target);
      const union = [...d.unionAccessIds].indexOf(target);
      return union >= 0 && local !== union;
    });
    const blockedOpen = list.filter((p) => p.source === "runtime" && p.cls === "BLOCKED_KEPT");
    // The hook's held door (a cell) is the solver's held door read back through the union, on every opened turn.
    const identity = turnsIn.filter((turn) => turn.status === "playing").filter((turn) => {
      const d = dctx.get(mapKey(turn.spec));
      const t = turn.after.target;
      return t >= 0 && !d.unionAccessIds.includes(t);
    });
    return {
      pass: turnsIn.length > 100 && remapped.length > 0 && blockedOpen.length > 0 && wrong.length === 0 && hookMiss.length === 0 && identity.length === 0,
      pairs: list.length, hookTurns: turnsIn.length, remappedDoorTurns: remapped.length, armedTrapTargetOnOpenedMaze: blockedOpen.length,
      mapsWithDifferentDoorsWhenOpen: [...new Set(list.filter((p) => dctx.get(p.m.key).accessesDiffer).map((p) => p.m.key))].length,
      vsProduction: wrong.length, hookOutside: hookMiss.length, heldDoorOutsideUnion: identity.length, examples: firstMisses(wrong),
    };
  });

  // ---------------------------------------------------------------------------------------------- S06
  guarded("S06", "fidelity", "STATIC_TOPOLOGY_SAME_CORRECTED_SEMANTICS", () => {
    const list = pairs.filter((p) => p.staticRef);
    const wrong = list.filter((p) => !sameAnswer(answers.get(p.key).stat, p.staticRef));
    const blocked = list.filter((p) => p.staticCls === "BLOCKED_KEPT");
    // Route 1 turns on the certified board (the link still closed after the step): the v1-topology solver IS the hook.
    const route1 = runtimeTurns.filter(({ turn, pair }) => turn.spec.route === 1 && !pair.oracle.open && pair.staticRef);
    const hookMiss = route1.filter(({ turn, pair }) => !hookInSupport(turn, answers.get(pair.key).stat));
    const route1Blocked = route1.filter(({ pair }) => pair.staticCls === "BLOCKED_KEPT");
    // The witnesses the pre-correction solver left in closed records: the solver accepts a step iff production does.
    const archivedCtx = new Map();
    const archivedWrong = fixtures.archived.steps.filter((step) => {
      const key = `${step.seed}|${step.route}|${step.mode}`;
      if (!archivedCtx.has(key)) archivedCtx.set(key, buildContext(step.map, step.mode));
      const answer = packedAnswer(solvers, archivedCtx.get(key), step.state, step.actionIndex);
      const solverHas = Boolean(answer) && (step.target === "WIN" ? answer.hasWin : answer.states.includes(step.target));
      return solverHas !== step.productionHas;
    });
    const archivedWitnesses = {
      witnesses: fixtures.archived.witnesses.length,
      stepsJudged: fixtures.archived.steps.length,
      notProductionTransitions: fixtures.archived.witnesses.filter((w) => w.firstNonProductionStep !== null).map((w) => ({ seed: w.seed, route: w.route, mode: w.mode, step: w.firstNonProductionStep, of: w.length })),
      solverDisagreesWithProduction: archivedWrong.map((step) => ({ seed: step.seed, step: step.index, productionHas: step.productionHas })),
    };
    return {
      pass: list.length > 1000 && blocked.length > 0 && route1Blocked.length > 0 && wrong.length === 0 && hookMiss.length === 0 && archivedWrong.length === 0,
      archivedWitnesses,
      pairs: list.length, armedTrapTargetPairs: blocked.length, vsStringReference: wrong.length,
      route1HookTurns: route1.length, route1ArmedTrapTargetTurns: route1Blocked.length, route1HookOutside: hookMiss.length,
      examples: wrong.slice(0, 3).map((p) => ({ map: p.m.key, state: canon(p.state), action: ACTIONS[p.actionIndex].name, ref: p.staticRef.states.slice(0, 2), solver: answers.get(p.key).stat?.states.slice(0, 2) })),
    };
  });

  // ---------------------------------------------------------------------------------------------- S07
  guarded("S07", "preserved", "NO_TRAP_STATES_EQUIVALENT_TO_PRE_MISSION", () => {
    const list = pairs.filter((p) => p.cls === "NO_TRAP" || (p.cls === "NO_DECISION" && p.oracle.traps === 0));
    const { wrong, hookMiss, turnsIn } = agree(list);
    const moved = unchanged(list);
    const movedStatic = unchanged(pairs.filter((p) => p.staticRef && (p.staticCls === "NO_TRAP" || (p.staticCls === "NO_DECISION" && p.oracle.traps === 0))), "stat");
    return { pass: list.length > 1000 && wrong.length === 0 && hookMiss.length === 0 && moved.length === 0 && movedStatic.length === 0, pairs: list.length, hookTurns: turnsIn.length, vsProduction: wrong.length, hookOutside: hookMiss.length, vsPreMission: moved.length, staticVsPreMission: movedStatic.length, examples: firstMisses(wrong) };
  });

  // ---------------------------------------------------------------------------------------------- S08
  guarded("S08", "preserved", "ORDINARY_TRAP_STATES_EQUIVALENT_TO_PRE_MISSION", () => {
    const list = pairs.filter((p) => p.cls === "OTHER_TRAP" || p.cls === "OPEN_RELEASED");
    const { wrong, hookMiss, turnsIn } = agree(list);
    const moved = unchanged(list);
    const movedStatic = unchanged(pairs.filter((p) => p.staticRef && (p.staticCls === "OTHER_TRAP" || p.staticCls === "OPEN_RELEASED")), "stat");
    return { pass: list.length > 1000 && wrong.length === 0 && hookMiss.length === 0 && moved.length === 0 && movedStatic.length === 0, pairs: list.length, hookTurns: turnsIn.length, vsProduction: wrong.length, hookOutside: hookMiss.length, vsPreMission: moved.length, staticVsPreMission: movedStatic.length, examples: firstMisses(wrong) };
  });

  // ---------------------------------------------------------------------------------------------- S09
  guarded("S09", "fidelity", "MOVE_SCORING_DISTANCE_IS_THE_TARGET_ROOT_BFS", () => {
    // (a) the helper against production getReachableDistances: every cell as target, every cell as `from`, every
    //     armed-trap mask, both topologies, on every fixture map with a door that is a trap.
    const helper = solvers.helper;
    let helperPairs = 0;
    let helperWrong = 0;
    let variantsChecked = 0;
    let variantsWrong = 0;
    const helperExamples = [];
    const maps = fixtures.maps.filter((m) => m.octx.zones.some((z) => z && z.accesses.some((a) => m.octx.trapKeys.includes(keyOf(cellId(a))))));
    if (helper) {
      for (const m of maps) {
        const d = dctx.get(m.key);
        for (const [topology, meta] of [[0, d.closed.packed], ...(m.octx.link ? [[1, d.open.packed]] : [])]) {
          for (let mask = 0; mask < meta.trapRadix; mask += 1) {
            if (Boolean(mask & m.octx.linkBit) !== (topology === 1)) continue;
            const walls = m.octx.walls[topology];
            const armed = new Set(m.octx.trapKeys.filter((_, i) => mask & (1 << i)));
            const graph = new Set([...walls, ...armed]);
            // An independent table: BFS from every walkable cell on the walkable graph (what trapVariant builds).
            const blocked = (id) => graph.has(keyOf(id));
            const distances = new Uint8Array(81 * 81).fill(255);
            for (let s = 0; s < 81; s += 1) {
              if (blocked(s)) continue;
              const q = [s];
              distances[s * 81 + s] = 0;
              for (let h = 0; h < q.length; h += 1) {
                for (const a of ACTIONS) {
                  const r = Math.floor(q[h] / 9) + a.row;
                  const c = (q[h] % 9) + a.col;
                  const n = r * 9 + c;
                  if (r < 0 || c < 0 || r > 8 || c > 8 || blocked(n) || distances[s * 81 + n] !== 255) continue;
                  distances[s * 81 + n] = distances[s * 81 + q[h]] + 1;
                  q.push(n);
                }
              }
            }
            const own = meta.trapVariants[mask];
            if (own) {
              variantsChecked += 1;
              if (!own.distances.every((v, i) => v === distances[i])) variantsWrong += 1;
            }
            const variant = own ?? { distances };
            for (let target = 0; target < 81; target += 1) {
              const prod = m.octx.API.getReachableDistances(cellOf(target), graph);
              for (let from = 0; from < 81; from += 1) {
                helperPairs += 1;
                const expected = prod.get(keyOf(from)) ?? 255;
                const got = helper.sentinelTargetDistance(meta, variant, mask, from, target);
                if (got !== expected) {
                  helperWrong += 1;
                  if (helperExamples.length < 3) helperExamples.push({ map: m.key, mask, target: keyOf(target), from: keyOf(from), production: expected, helper: got });
                }
              }
            }
          }
        }
      }
    }
    // (b) every decision of the grid — the Sentinel on every cell of its leash, holding a trapped door or not —
    //     equals production's, so every candidate it considers is scored as the target-root BFS scores it.
    const grid = pairs.filter((p) => p.source === "grid");
    const gridWrong = grid.filter((p) => !sameAnswer(answers.get(p.key).dynamic, oracleAnswer(p)));
    // (c) structurally: `sentinelMove` reads every distance to the target through the helper, in both solvers.
    const structure = [PACKED_FILE, ROTA2_FILE].map((file) => {
      const body = sentinelMoveBody(solvers.sources[file] ?? "") ?? "";
      return { file, helperReads: (body.match(/sentinelTargetDistance\(/g) ?? []).length, rawTargetReads: (body.match(/distances\[(?:sentinel|next) \* CELL_COUNT \+ target\]/g) ?? []).length };
    });
    // (d) no successor of any pair puts the Sentinel on a blocked cell (an armed trap or a wall).
    const onBlocked = pairs.filter((p) => (answers.get(p.key).dynamic?.states ?? []).some((s) => {
      const x = parseCanon(s);
      return blockedIn(p, x.s, x.traps);
    }));
    return {
      pass: Boolean(helper) && helperPairs > 100_000 && helperWrong === 0 && variantsWrong === 0 && grid.length > 1000 && gridWrong.length === 0 && structure.every((s) => s.helperReads === 3 && s.rawTargetReads === 0) && onBlocked.length === 0,
      helperPresent: Boolean(helper), helperPairs, helperVsProductionBfs: helperWrong, solverVariantsChecked: variantsChecked, solverVariantsWrong: variantsWrong, helperMaps: maps.length,
      gridDecisions: grid.length, gridVsProduction: gridWrong.length, structure, sentinelOnBlockedCell: onBlocked.length,
      helperExamples, gridExamples: firstMisses(gridWrong),
    };
  });

  // ---------------------------------------------------------------------------------------------- S10
  guarded("S10", "preserved", "HUNTER_SUPPORT_AND_RNG_DRAWS_UNCHANGED", () => {
    // (a) Where the Sentinel cannot reach the Explorer's cell this turn, every Hunter outcome is observable: the cells
    //     it survives on, and the capture. They must be production's support and the pre-mission solver's.
    const isolated = pairs.filter((p) => !p.oracle.hasWin && p.oracle.next !== undefined && p.oracle.hunters.length > 0 && manhattanIds(p.state.s, p.oracle.next) > 1);
    const view = (answer) => answer && { hunters: [...new Set(answer.states.map((s) => parseCanon(s).h))].sort((a, b) => a - b).join(","), loss: answer.hasLoss };
    const expected = (p) => ({ hunters: p.oracle.hunters.filter((h) => h !== p.oracle.next).join(","), loss: p.oracle.hunters.includes(p.oracle.next) });
    const same = (a, b) => a && b && a.hunters === b.hunters && a.loss === b.loss;
    const vsProduction = isolated.filter((p) => !same(view(answers.get(p.key).dynamic), expected(p)));
    const vsPre = isolated.filter((p) => !same(view(answers.get(p.key).dynamic), view(preAnswers.get(p.key).dynamic)));
    // (b) the hook's own Hunter move is in the solver's support on every turn that went on.
    const hunterMiss = runtimeTurns.filter(({ turn, pair }) => turn.status === "playing" && !(answers.get(pair.key).dynamic?.states ?? []).some((s) => parseCanon(s).h === turn.after.h));
    // (c) the hook's draws, turn by turn, equal the other tree's (the hook is not this mission's).
    const a = fixtures.turns.map((t) => `${mapKey(t.spec)}|${t.spec.policy}|${t.k}|${canon(t.before)}|${canon(t.after)}|${t.draws}`);
    const b = fixtures.turns2.map((t) => `${mapKey(t.spec)}|${t.spec.policy}|${t.k}|${canon(t.before)}|${canon(t.after)}|${t.draws}`);
    const drawsSame = a.length === b.length && a.every((x, i) => x === b[i]);
    const totalDraws = fixtures.turns.reduce((n, t) => n + (t.draws ?? 0), 0);
    // (d) the solvers draw nothing.
    const drawing = SOLVER_FILES.filter((file) => /Math\.random|routeRandom/.test(solvers.sources[file] ?? ""));
    return {
      pass: isolated.length > 1000 && vsProduction.length === 0 && vsPre.length === 0 && hunterMiss.length === 0 && drawsSame && totalDraws > 0 && drawing.length === 0,
      isolatedPairs: isolated.length, hunterSupportVsProduction: vsProduction.length, hunterSupportVsPreMission: vsPre.length,
      hookHunterOutsideSupport: hunterMiss.length, hookTurnsAndDrawsEqualOtherTree: drawsSame, otherTree: fixtures.otherRev, hookDraws: totalDraws,
      solverFilesDrawing: drawing,
      examples: vsProduction.slice(0, 2).map((p) => ({ map: p.m.key, state: canon(p.state), solver: view(answers.get(p.key).dynamic), production: expected(p) })),
    };
  });

  // ---------------------------------------------------------------------------------------------- S11
  guarded("S11", "preserved", "TERMINAL_AND_SECOND_CHANCE_UNCHANGED", () => {
    const winWrong = pairs.filter((p) => answers.get(p.key).dynamic?.hasWin !== p.oracle.hasWin || answers.get(p.key).dynamic?.hasWin !== preAnswers.get(p.key).dynamic?.hasWin);
    const forcedLoss = pairs.filter((p) => p.oracle.hasLoss && (p.oracle.next === p.state.h || p.oracle.next === p.state.s || p.oracle.perHunter.some((x) => x.outcome === "HUNTER_CAPTURE")));
    const lossMissed = forcedLoss.filter((p) => !answers.get(p.key).dynamic?.hasLoss);
    const ended = runtimeTurns.filter(({ turn }) => turn.status !== "playing");
    const cause = ({ turn, pair }) => (turn.status === "won" ? "win" : pair.oracle.next === turn.before.h || pair.oracle.next === turn.before.s ? "step" : turn.after.h === turn.after.e ? "hunter" : "sentinel");
    const byCause = {};
    for (const x of ended) byCause[cause(x)] = (byCause[cause(x)] ?? 0) + 1;
    const nonSentinel = ended.filter((x) => cause(x) !== "sentinel");
    const endedWrong = nonSentinel.filter(({ turn, pair }) => !hookInSupport(turn, answers.get(pair.key).dynamic) || !hookInSupport(turn, preAnswers.get(pair.key).dynamic));
    const sc = fixtures.secondChance;
    const scSame = sc.here.length === sc.other.length && sc.here.every((g, i) => g.frames === sc.other[i].frames && g.completions === sc.other[i].completions && g.status === sc.other[i].status);
    const scUsed = sc.here.filter((g) => g.used).length;
    return {
      pass: winWrong.length === 0 && forcedLoss.length > 0 && lossMissed.length === 0 && nonSentinel.length > 0 && endedWrong.length === 0 && scSame && scUsed > 0,
      winFlagDiffers: winWrong.length, explorerOrHunterCapturePairs: forcedLoss.length, captureMissed: lossMissed.length,
      endedTurns: byCause, endedTurnsDisagreeing: endedWrong.length,
      secondChanceGames: sc.here.map((g) => ({ seed: g.seed, route: g.route, reachedChest: g.reachedChest, used: g.used, status: g.status })), secondChanceSameAsOtherTree: scSame, otherTree: sc.otherRev,
      note: "PRE_CHEST solvers: a Second Chance never reaches them; the hook's Second Chance path is src/, identical on both trees",
    };
  });

  // ---------------------------------------------------------------------------------------------- S12
  guarded("S12", "preserved", "NO_PRODUCTION_FILE_CHANGED", () => {
    const diff = srcUnchanged(fixtures.rev);
    return { pass: diff.committed.length === 0 && diff.untracked.length === 0, base: FIDELITY_BASE, changedUnderSrc: diff.committed, uncommittedUnderSrc: diff.untracked };
  });

  return results;
}

function fixtureSummary(fixtures) {
  const tally = {};
  for (const p of fixtures.pairs) tally[`${p.source}:${p.cls}`] = (tally[`${p.source}:${p.cls}`] ?? 0) + 1;
  return {
    games: { portalRush: PORTAL_RUSH.length, trapTours: TOURS.length, secondChance: SECOND_CHANCE_SEEDS.length },
    hookTurns: fixtures.turns.length,
    pairs: fixtures.pairs.length,
    byClass: Object.fromEntries(Object.entries(tally).sort()),
    staticPairs: fixtures.pairs.filter((p) => p.staticRef).length,
  };
}

// =================================================================================================
// mutants — in-memory edits of the working tree's solvers; each must fail a check it targets
// =================================================================================================

const edit = (from, to, id) => (source) => {
  if (source.split(from).length !== 2) throw new Error(`mutant ${id}: anchor not found exactly once`);
  return source.replace(from, to);
};
const chain = (...fns) => (source) => fns.reduce((s, fn) => fn(s), source);
const RELEASE = "    sentinelTargetDistance(meta, variant, traps, sentinel, target) === UNREACHABLE\n";
const RELEASE_OLD = "    variant.distances[sentinel * CELL_COUNT + target] === UNREACHABLE\n";
const SCORE = "    const rawScore = sentinelTargetDistance(meta, variant, traps, next, target);\n";
const SCORE_OLD = "    const rawScore = variant.distances[next * CELL_COUNT + target];\n";
const STAY = "  const rawStayScore = sentinelTargetDistance(meta, variant, traps, sentinel, target);\n";
const STAY_OLD = "  const rawStayScore = variant.distances[sentinel * CELL_COUNT + target];\n";
const revert = (id) => chain(edit(RELEASE, RELEASE_OLD, `${id} release`), edit(SCORE, SCORE_OLD, `${id} score`), edit(STAY, STAY_OLD, `${id} stay`));
const both = (fn) => ({ [PACKED_FILE]: fn, [ROTA2_FILE]: fn });
const MUTANTS_LIST = [
  { id: "M01", name: "a blocked target is always UNREACHABLE", targets: ["S02", "S09"], edits: { [HELPER_FILE]: edit("  if (from === target) return 0;\n", "  return SENTINEL_UNREACHABLE;\n", "M01") } },
  { id: "M02", name: "the old release condition on a blocked target is restored", targets: ["S02", "S05", "S06"], edits: both(edit(RELEASE, RELEASE_OLD, "M02")) },
  { id: "M03", name: "a blocked target is at distance zero", targets: ["S09"], edits: { [HELPER_FILE]: edit("  if (from === target) return 0;\n", "  return 0;\n", "M03") } },
  { id: "M04", name: "only the first legal neighbour of a blocked target is considered", targets: ["S09"], edits: { [HELPER_FILE]: edit("    if (distance < best) best = distance;\n", "    if (distance < best) best = distance;\n    break;\n", "M04") } },
  { id: "M05", name: "candidate and stay positions scored off the target-root BFS", targets: ["S02", "S09"], edits: both(chain(edit(SCORE, SCORE_OLD, "M05 score"), edit(STAY, STAY_OLD, "M05 stay"))) },
  { id: "M06", name: "the static solver fixed, the Rota 2.0 solver left wrong", targets: ["S02", "S05"], edits: { [ROTA2_FILE]: revert("M06") } },
  { id: "M07", name: "the Rota 2.0 solver fixed, the static solver left wrong", targets: ["S06"], edits: { [PACKED_FILE]: revert("M07") } },
  {
    id: "M08", name: "the Sentinel may step onto an armed trap", targets: ["S09"],
    edits: both(edit("  for (const next of variant.neighbours[sentinel]) {\n    if (next === meta.exitId) continue;\n    const homeDistance = variant.distances[next * CELL_COUNT + meta.exitId];\n",
      "  for (const next of meta.baseNeighbours[sentinel]) {\n    if (next === meta.exitId) continue;\n    const homeDistance = meta.baseDistances[next * CELL_COUNT + meta.exitId];\n", "M08")),
  },
  { id: "M09", name: "the held door read through the opened maze's own door list, not the union", targets: ["S05"], edits: { [ROTA2_FILE]: edit("    target = meta.unionAccessIds[heldTarget];\n", "    target = heldTarget < meta.accessIds.length ? meta.accessIds[heldTarget] : meta.unionAccessIds[heldTarget];\n", "M09") } },
  { id: "M10", name: "no-trap move tie-break changes", targets: ["S07", "S01"], edits: both(edit("    if (score < bestScore) {\n", "    if (score < bestScore || (traps === 0 && score === bestScore)) {\n", "M10")) },
  { id: "M11", name: "a genuinely unreachable commitment is kept", targets: ["S03"], edits: both(edit("    traps !== 0 && heldTarget >= 0 &&\n", "    false && traps !== 0 && heldTarget >= 0 &&\n", "M11")) },
  {
    id: "M12", name: "the Hunter's random tie-break modelled as one fixed draw", targets: ["S10"],
    edits: both(edit("        if (meta.manhattan[next * CELL_COUNT + player] === bestDistance) preferred.push(next);\n", "        if (meta.manhattan[next * CELL_COUNT + player] === bestDistance) { preferred.push(next); break; }\n", "M12")),
  },
];

// =================================================================================================
// main
// =================================================================================================

async function main() {
  const started = performance.now();
  const log = (...m) => console.log(...m);
  const treeLabel = REV ?? "working tree";
  log(`ROTA2 sentinel solver fidelity — ${MUTANTS ? "mutants" : REV ? `counterfactual on ${REV}` : "suite"} (${treeLabel})\n`);
  log("fixtures");
  const fixtures = await collectFixtures(REV, log);
  fixtures.rev = REV;
  const preSolvers = await loadSolvers({ rev: FIDELITY_BASE });
  const pre = answerAll(preSolvers, fixtures);
  const summary = fixtureSummary(fixtures);
  log(`   ${JSON.stringify(summary.byClass)}\n`);

  if (MUTANTS) {
    const clean = runChecks(await loadSolvers(), fixtures, pre, { quiet: true });
    const cleanFailing = clean.filter((r) => !r.pass).map((r) => r.id);
    if (cleanFailing.length) {
      log(`the clean tree fails ${cleanFailing.join(", ")} — mutants are meaningless until it passes`);
      return EXIT_VALIDATION_FAILED;
    }
    const rows = [];
    for (const mutant of MUTANTS_LIST) {
      let outcome;
      try {
        const solvers = await loadSolvers({ edits: mutant.edits });
        const failing = runChecks(solvers, fixtures, pre, { quiet: true }).filter((r) => !r.pass).map((r) => r.id);
        const caughtBy = mutant.targets.filter((id) => failing.includes(id));
        outcome = { caught: caughtBy.length > 0, caughtBy, alsoFailing: failing.filter((id) => !mutant.targets.includes(id)) };
      } catch (error) {
        outcome = { caught: false, broken: String(error?.message ?? error).split("\n")[0] };
      }
      rows.push({ id: mutant.id, name: mutant.name, targets: mutant.targets, ...outcome });
      log(`${outcome.caught ? "CAUGHT" : outcome.broken ? "BROKEN" : "MISSED"}  ${mutant.id} — ${mutant.name}${outcome.caughtBy ? ` (by ${outcome.caughtBy.join(", ")}${outcome.alsoFailing.length ? `; also ${outcome.alsoFailing.join(", ")}` : ""})` : ""}${outcome.broken ? `: ${outcome.broken}` : ""}`);
    }
    const caught = rows.filter((r) => r.caught).length;
    const allCaught = caught === rows.length;
    log(`\n${caught}/${rows.length} mutants caught`);
    log(allCaught ? "ROTA2_SENTINEL_FIDELITY_MUTANTS_CAUGHT" : "ROTA2_SENTINEL_FIDELITY_MUTANTS_MISSED");
    const EVIDENCE = openEvidence(OUT);
    EVIDENCE.write("mutants.json", { mission: "ROTA2-SENTINEL-SOLVER-FIDELITY-03", base: FIDELITY_BASE, allCaught, caught, total: rows.length, fixtures: summary, mutants: rows, run: { elapsedMs: Math.round(performance.now() - started) } }, { metadata: ["run"] });
    return EVIDENCE.finish({ ok: allCaught });
  }

  const solvers = await loadSolvers({ rev: REV });
  const results = runChecks(solvers, fixtures, pre);

  if (REV) {
    const wrong = results.filter((r) => (r.tag === "fidelity" ? r.pass : !r.pass));
    const n = (tag, pass) => results.filter((r) => r.tag === tag && r.pass === pass).length;
    const all = (tag) => results.filter((r) => r.tag === tag).length;
    log(`\nfidelity failing ${n("fidelity", false)}/${all("fidelity")} · preserved holding ${n("preserved", true)}/${all("preserved")}`);
    if (wrong.length) log(`unexpected: ${wrong.map((r) => `${r.id}(${r.pass ? "passed" : "failed"})`).join(", ")}`);
    const holds = wrong.length === 0;
    log(holds ? "ROTA2_SENTINEL_FIDELITY_COUNTERFACTUAL_HOLDS" : "ROTA2_SENTINEL_FIDELITY_COUNTERFACTUAL_BROKEN");
    const EVIDENCE = openEvidence(OUT);
    EVIDENCE.write(`counterfactual-${REV.slice(0, 7)}.json`, {
      mission: "ROTA2-SENTINEL-SOLVER-FIDELITY-03", rev: REV, holds,
      fidelityFailing: n("fidelity", false), fidelityTotal: all("fidelity"), preservedHolding: n("preserved", true), preservedTotal: all("preserved"),
      fixtures: summary, checks: results.map(({ id, tag, name, pass, detail }) => ({ id, tag, name, pass, detail })),
      run: { elapsedMs: Math.round(performance.now() - started) },
    }, { metadata: ["run"] });
    return EVIDENCE.finish({ ok: holds });
  }

  const passed = results.filter((r) => r.pass).length;
  const allPass = passed === results.length;
  log(`\n${passed}/${results.length} passed${allPass ? "" : ` · failing: ${results.filter((r) => !r.pass).map((r) => r.id).join(", ")}`}`);
  log(allPass ? "ROTA2_SENTINEL_FIDELITY_TESTS_OK" : "ROTA2_SENTINEL_FIDELITY_TESTS_FAILED");
  const EVIDENCE = openEvidence(OUT);
  EVIDENCE.write("fidelity-tests.json", {
    mission: "ROTA2-SENTINEL-SOLVER-FIDELITY-03", base: FIDELITY_BASE, allPass, passed, total: results.length, fixtures: summary,
    checks: results.map(({ id, tag, name, pass, detail }) => ({ id, tag, name, pass, detail })),
    run: { elapsedMs: Math.round(performance.now() - started) },
  }, { metadata: ["run"] });
  return EVIDENCE.finish({ ok: allPass });
}

process.exitCode = await main();
