/**
 * ROTA2-ADAPTIVE-HUNTER-04 — the census: every Route × mode over many seeds, the real hook on this tree and on the
 * exact base, the exact solvers, nothing hand-picked.
 *
 *   A  generation    1080 maps (3 Routes × 3 modes × 120 seeds — the seeds of the earlier Rota 2.0 censuses) on this
 *                    tree and on the base (ec3e564): the policy draws nothing and generation is untouched, so every map
 *                    and every generation's draw count must be the same.
 *   B  Route 1       one seeded game per Route 1 map (360) on both trees under a policy that opens the Chest, takes the
 *                    Pickaxe or the Second Chance, bumps walls and runs straight: render for render, event for event,
 *                    draw for draw, message, turns, result and score.
 *   C  runtime       3240 games per tree (straight runs, a turner that never repeats, a runner through the opened link
 *                    wall, the mixed Chest policy): wins, captures and stops per Route × mode, base against this tree;
 *                    the Hunter's draws; how often the policy fires and every situation the mission names; every
 *                    pre-Chest turn held against the production-backed oracle and the dynamic solver (and the static
 *                    solver while the link wall stands); fairness — after each interception, can the Explorer still
 *                    step somewhere no defender reaches next turn, and did the interception (not the maze) take that
 *                    away; restart and continuation.
 *   D  state space   the exact PRE_CHEST classes on the 72-map stratified sample of the earlier censuses: the base
 *                    solver against this tree's, explored states, resource limits; Route 1's exact direction quotient
 *                    against the base graph, and Route 1's full direction-carrying graph (what the component costs);
 *                    transitions where the interception supplied, and changed, the Hunter's support. A map that hits a
 *                    limit stays INCONCLUSIVE.
 *   E  cost          the policy's cost per call on real turns, renders per input, census time and heap.
 *
 * Usage: node tools/validation/rota2-adaptive-hunter-census.mjs [--check|--update]
 *        `ROTA2_CENSUS_QUICK=1`: a small sample, no exact classes, nothing written (debugging only).
 *        `ROTA2_CENSUS_EXTENDED=1`: also re-explore every INCONCLUSIVE map of D with an explicit, larger limit
 *        (reported apart; never replaces the 3 M-state class).
 */
import { cellKey, loadRouteRuntime, pathBetween, sameCell } from "./route-runtime-harness.mjs";
import { ACTIONS, API as REFERENCE_API, buildContext, hunterSupport as referenceHunterSupport } from "./dynamic-solver.mjs";
import { packedStateContract } from "./dynamic-solver-packed.mjs";
import {
  canonD,
  cellId,
  loadSolvers,
  oracleContext,
  oracleSuccessors,
  packedAnswer,
  productionIntercept,
  rota2Answer,
} from "./rota2-sentinel-solver-fidelity-lib.mjs";
import {
  ADAPTIVE_BASE,
  DELTA,
  DIFFICULTIES,
  INSTRUMENT,
  INTERCEPT_MESSAGE,
  POLICIES,
  ROUTES,
  actionIndexOf,
  add,
  analyseTurn,
  attachTrace,
  canonicalOf,
  contractInterception,
  drawLogOf,
  inBoard,
  legalDirections,
  manhattan,
  planKey,
  playGame,
  sameJson,
  tally,
} from "./rota2-adaptive-hunter-lib.mjs";
import { openEvidence } from "./evidence.mjs";

const QUICK = process.env.ROTA2_CENSUS_QUICK === "1";
const EXTENDED = process.env.ROTA2_CENSUS_EXTENDED === "1";
const MAPS_PER_COMBINATION = QUICK ? 10 : 120;
const SOLVER_PER_COMBINATION = QUICK ? 0 : 8;
const started = performance.now();
let peakHeap = 0;
const sampleHeap = () => {
  peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed);
};
const timings = {};
const time = (name, fn) => {
  const t0 = performance.now();
  const out = fn();
  timings[name] = Math.round(performance.now() - t0);
  sampleHeap();
  return out;
};
const log = (...m) => console.log(...m);
const seedFor = (route, difficulty, index) => 9_200_000 + route * 10_000 + DIFFICULTIES.indexOf(difficulty) * 1_000 + index;
const mapFields = (m) =>
  JSON.stringify({ grid: m.grid, walls: [...m.walls].sort(), playerStart: m.playerStart, guardianStart: m.guardianStart, exitPosition: m.exitPosition, collectibleStars: m.collectibleStars, traps: m.traps, chest: m.chest, trapLinks: m.trapLinks ?? null });
const short = (label) => ({ GUARANTEED_SOLVABLE_PRE_CHEST: "G", POSSIBLE_BUT_NOT_GUARANTEED_PRE_CHEST: "P", PROVED_UNSOLVABLE_PRE_CHEST: "U", INCONCLUSIVE_RESOURCE_LIMIT: "I" })[label] ?? label;
const pct = (n, d) => (d === 0 ? null : Math.round((1000 * n) / d) / 10);

const NOW = loadRouteRuntime({ directDifficulty: true, transforms: [INSTRUMENT] });
const PRE = loadRouteRuntime({ directDifficulty: true, rev: ADAPTIVE_BASE, transforms: [INSTRUMENT] });
const nowTrace = attachTrace(NOW);
const preTrace = attachTrace(PRE);
const nowDraws = drawLogOf(NOW);
const preDraws = drawLogOf(PRE);
const intercept = productionIntercept(NOW);
const solvers = await loadSolvers();
const preSolvers = await loadSolvers({ rev: ADAPTIVE_BASE });

// =================================================================================================
// A — generation
// =================================================================================================
log("A  generation, this tree vs the base");
const generation = { maps: 0, identical: 0, drawsIdentical: 0, exceptions: 0, linked: 0 };
const allMaps = time("A", () => {
  const out = [];
  for (const route of ROUTES) {
    for (const difficulty of DIFFICULTIES) {
      for (let index = 0; index < MAPS_PER_COMBINATION; index += 1) {
        const seed = seedFor(route, difficulty, index);
        try {
          NOW.LAB.setSeed(seed);
          const d0 = nowDraws.values.length;
          const map = NOW.API.generateMaze(difficulty, route);
          const nowCount = nowDraws.values.length - d0;
          PRE.LAB.setSeed(seed);
          const p0 = preDraws.values.length;
          const pre = PRE.API.generateMaze(difficulty, route);
          const preCount = preDraws.values.length - p0;
          generation.maps += 1;
          if (mapFields(map) === mapFields(pre)) generation.identical += 1;
          if (nowCount === preCount) generation.drawsIdentical += 1;
          if ((map.trapLinks ?? []).length) generation.linked += 1;
          out.push({ seed, route, difficulty, map });
        } catch {
          generation.exceptions += 1;
        }
      }
    }
  }
  return out;
});
log(`   ${generation.identical}/${generation.maps} identical · draws identical ${generation.drawsIdentical} · exceptions ${generation.exceptions}`);

// =================================================================================================
// B — Route 1, render for render against the base
// =================================================================================================
log("B  Route 1, this tree vs the base");
const observeRender = (g) => g?.mazeMap ? JSON.stringify({
  status: g.status, message: g.message, turns: g.turns, errors: g.errors, blockedMoves: g.blockedMoves,
  player: g.player, guardian: g.guardian, sentinel: g.sentinel, sentinelTarget: g.sentinelTarget, sentinelCommitLeft: g.sentinelCommitLeft,
  walls: [...g.walls].sort(), armed: [...g.triggeredTrapSet].sort(), collected: [...g.collectedSet].sort(), score: g.score,
  chestOpened: g.chestOpened, rewardSelected: g.rewardSelected, rewardSpent: g.rewardSpent, brokenWall: g.brokenWall,
  trapOpenedWalls: g.trapOpenedWalls, portalActive: g.portalActive,
}) : null;
const route1 = time("B", () => {
  const out = { games: 0, renders: 0, turns: 0, hunterDraws: 0, messages: 0, mapsDiffer: 0, rendersDiffer: 0, eventsDiffer: 0, drawsDiffer: 0, messagesDiffer: 0, resultsDiffer: 0, wins: 0, losses: 0, captures: { hunter: 0, sentinel: 0, "explorer-step": 0 }, secondChances: 0, pickaxeWalls: 0, linkedTrapArmed: 0, examples: [] };
  for (const { seed, difficulty, map } of allMaps.filter((m) => m.route === 1)) {
    const index = seed % 1000;
    const spec = { seed, route: 1, difficulty, policy: "mixed", reward: index % 2 ? "pickaxe" : "second-chance" };
    const framesNow = [];
    const framesPre = [];
    const now = playGame(NOW, nowTrace, nowDraws, spec, POLICIES.mixed, { onRender: (g) => framesNow.push(observeRender(g)) });
    const pre = playGame(PRE, preTrace, preDraws, spec, POLICIES.mixed, { onRender: (g) => framesPre.push(observeRender(g)) });
    out.games += 1;
    out.renders += framesNow.length;
    out.turns += now.turns.length;
    if (mapFields(now.map) !== mapFields(map) || mapFields(pre.map) !== mapFields(map)) out.mapsDiffer += 1;
    if (!sameJson(framesNow, framesPre)) {
      out.rendersDiffer += 1;
      if (out.examples.length < 3) {
        const at = framesNow.findIndex((f, k) => f !== framesPre[k]);
        out.examples.push({ seed, difficulty, render: at });
      }
    }
    const events = (game) => JSON.stringify(game.turns.map((t) => t.events));
    if (events(now) !== events(pre)) out.eventsDiffer += 1;
    const draws = (game) => JSON.stringify(game.turns.map((t) => t.draws));
    if (draws(now) !== draws(pre)) out.drawsDiffer += 1;
    out.hunterDraws += now.turns.reduce((n, t) => n + t.draws.length, 0);
    const messages = (game) => JSON.stringify(game.turns.map((t) => t.after.message));
    out.messages += now.turns.length;
    if (messages(now) !== messages(pre)) out.messagesDiffer += 1;
    if (JSON.stringify(now.run.completions) !== JSON.stringify(pre.run.completions)) out.resultsDiffer += 1;
    for (const t of now.turns) {
      for (const e of t.events) {
        if (e.type === "EXPLORER_CAPTURED") out.captures[e.by] += 1;
        if (e.type === "SECOND_CHANCE_USED") out.secondChances += 1;
        if (e.type === "WALL_OPENED") out.pickaxeWalls += 1;
        if (e.type === "WALL_OPENED_BY_TRAP") out.linkedTrapArmed += 1;
      }
    }
    if (now.run.state.status === "won") out.wins += 1;
    if (now.run.state.status === "lost") out.losses += 1;
    now.run.unmount();
    pre.run.unmount();
  }
  return out;
});
log(`   ${route1.games} games · renders differ ${route1.rendersDiffer} · events ${route1.eventsDiffer} · draws ${route1.drawsDiffer} · messages ${route1.messagesDiffer} · results ${route1.resultsDiffer}`);

// =================================================================================================
// C — runtime, both trees
// =================================================================================================
log("C  runtime: straight, turner, linkRunner, mixed — this tree and the base");
const POLICY_PLAN = (route, index) => [
  { policy: "straight", trapFirst: index % 2 === 1 },
  { policy: "turner" },
  ...(route >= 2 ? [{ policy: "linkRunner" }] : []),
  ...(index < 40 ? [{ policy: "mixed", reward: index % 2 ? "pickaxe" : "second-chance" }] : []),
];
const outcomes = { now: {}, base: {} };
const hunterDraws = { now: {}, base: {} };
const renders = { now: { inputs: 0, renders: 0 }, base: { inputs: 0, renders: 0 } };
const coverage = {};
const triggers = {};
const interceptionSummary = { turns: 0, captures: 0, illegal: 0, moreThanOneCell: 0, messageMissing: 0, messageWithout: 0, moduleDisagrees: 0, pursuitCouldNotHaveMadeIt: 0 };
const solverAgreement = { turns: 0, interceptionTurns: 0, outsideOracle: 0, outsideDynamic: 0, staticTurns: 0, outsideStatic: 0, oracleDynamicPairs: 0, oracleDynamicDisagreements: 0, pairsChangedByPolicy: 0, examples: [] };
const fairness = {
  interceptionTurns: 0, withASafeStep: 0, withoutASafeStep: 0, withoutASafeStepUnderEveryPursuitMove: 0, interceptionTookTheLastSafeStep: 0,
  pursuitTurns: 0, pursuitWithASafeStep: 0,
  nextStep: { continued: 0, turned: 0, continuedThenCaptured3: 0, turnedThenCaptured3: 0 },
  continuingWasSafe: 0, continuingWasUnsafe: 0, turningWasSafe: 0,
  examples: [],
};
const softlock = { now: { noMove: 0, unsolvableWhilePlaying: 0, invalidWhilePlaying: 0 }, base: { noMove: 0, unsolvableWhilePlaying: 0, invalidWhilePlaying: 0 } };
const contexts = new Map();
const contextOf = (turn) => {
  const key = `${turn.spec.seed}|${turn.spec.route}|${turn.spec.difficulty}`;
  if (!contexts.has(key)) {
    const requirePassage = turn.before.passageRequired;
    const octx = oracleContext(NOW.API, turn.map, turn.spec.difficulty, { requirePassage, routeNumber: turn.spec.route, intercept });
    const dctx = solvers.rota2.buildDynamicContext(turn.map, turn.spec.difficulty, { requirePassage, routeNumber: turn.spec.route, intercept });
    const sctx = buildContext(turn.map, turn.spec.difficulty);
    sctx.routeNumber = turn.spec.route;
    sctx.intercept = intercept;
    contexts.set(key, { octx, dctx, sctx });
  }
  return contexts.get(key);
};
const actionTarget = (cell, a) => ({ row: cell.row + ACTIONS[a].row, col: cell.col + ACTIONS[a].col });
/** The Explorer's steps from `state` (canonical) after which no defender can reach it next turn (every outcome safe). */
const safeSteps = (octx, state) => {
  const out = [];
  for (let a = 0; a < ACTIONS.length; a += 1) {
    const o = oracleSuccessors(octx, state, a);
    if (o && !o.hasLoss) out.push(a);
  }
  return out;
};

time("C", () => {
  for (const { seed, route, difficulty } of allMaps) {
    const index = seed % 1000;
    for (const plan of POLICY_PLAN(route, index)) {
      const spec = { seed, route, difficulty, ...plan };
      for (const [tree, rt, trace, draws] of [["now", NOW, nowTrace, nowDraws], ["base", PRE, preTrace, preDraws]]) {
        let renderCount = 0;
        const game = playGame(rt, trace, draws, spec, POLICIES[plan.policy], { onRender: () => (renderCount += 1) });
        renders[tree].inputs += game.turns.length;
        renders[tree].renders += renderCount - 2; // mount and start are not inputs
        const key = `R${route}-${difficulty}`;
        const row = (outcomes[tree][key] ??= { games: 0, won: 0, lost: 0, budget: 0, noMove: 0, capturedBy: { hunter: 0, sentinel: 0, "explorer-step": 0 }, secondChances: 0, turns: 0 });
        row.games += 1;
        row.turns += game.turns.length;
        if (game.stopped === "won") row.won += 1;
        else if (game.stopped === "lost") row.lost += 1;
        else if (game.stopped === "no-move") row.noMove += 1;
        else row.budget += 1;
        if (game.stopped === "no-move") softlock[tree].noMove += 1;
        for (const t of game.turns) {
          for (const e of t.events) {
            if (e.type === "EXPLORER_CAPTURED") row.capturedBy[e.by] += 1;
            if (e.type === "SECOND_CHANCE_USED") row.secondChances += 1;
          }
          if (t.after.status === "playing" && !t.after.solvable) softlock[tree].unsolvableWhilePlaying += 1;
          if (t.after.status === "playing" && !t.after.valid) softlock[tree].invalidWhilePlaying += 1;
          if (t.stepped && !t.after.rewardChoicePending) tally((hunterDraws[tree][key] ??= {}), "draws", t.draws.length);
          if (t.stepped && !t.after.rewardChoicePending) tally((hunterDraws[tree][key] ??= {}), "steps");
        }
        if (tree === "base") {
          game.run.unmount();
          continue;
        }
        // --- this tree: every answered step, read -----------------------------------------------------------------
        for (const t of game.turns) analyseTurn(t, intercept);
        const answeredTurns = game.turns.filter((t) => t.input);
        for (let k = 0; k < answeredTurns.length; k += 1) {
          const t = answeredTurns[k];
          const trig = (triggers[key] ??= { steps: 0, repeats: 0, interceptions: 0, oneCell: 0, twoCell: 0, ties: 0, fallbackOnRepeat: 0 });
          trig.steps += 1;
          if (t.repeat) trig.repeats += 1;
          if (t.repeat && route >= 2 && !t.contract) trig.fallbackOnRepeat += 1;
          if (planKey(t.helper) !== planKey(t.contract)) interceptionSummary.moduleDisagrees += 1;
          // coverage of every situation the mission names
          if (t.repeat) tally(coverage, "repeatedDirection");
          if (!t.repeat && t.input.previous !== null) tally(coverage, "directionChanges");
          if (route >= 2 && t.repeat && manhattan(t.input.hunter, t.input.explorer) > 1) {
            const p1 = add(t.input.explorer, DELTA[t.input.direction]);
            const p1Wall = !inBoard(p1) || t.input.walls.has(cellKey(p1));
            const p1Illegal = !p1Wall && (sameCell(p1, t.input.exit) || t.input.blocked.has(cellKey(p1)));
            if (p1Wall) tally(coverage, "projectedCellBehindAClosedWall");
            if (p1Illegal) tally(coverage, "blockedProjectedCell");
            if (!p1Wall && !p1Illegal && !t.contract) tally(coverage, "noLegalInterceptionMove");
            if (difficulty === "hard" && !p1Wall) {
              const p2 = add(t.input.explorer, DELTA[t.input.direction], 2);
              if (!inBoard(p2) || t.input.walls.has(cellKey(p2)) || sameCell(p2, t.input.exit) || t.input.blocked.has(cellKey(p2))) tally(coverage, "hardTwoCellBlocked");
            }
          }
          if (route >= 2 && t.repeat && !t.contract) tally(coverage, "legacyFallback");
          if (t.events.some((e) => e.type === "WALL_OPENED_BY_TRAP")) {
            tally(coverage, "trapActivationAndWallOpeningSameTurn");
            if (t.repeat && route >= 2) tally(coverage, "repeatOnTheTurnTheWallOpened");
            if (t.contract) tally(coverage, "interceptionOnTheTurnTheWallOpened");
          }
          if (t.events.some((e) => e.type === "PORTAL_ACTIVATED")) tally(coverage, "portalActivated");
          if (t.events.some((e) => e.type === "EXPLORER_CAPTURED")) tally(coverage, "capture");
          if (t.events.some((e) => e.type === "SECOND_CHANCE_USED")) tally(coverage, "secondChance");
          if (!t.contract) continue;
          // --- an interception (by the contract) -------------------------------------------------------------------
          trig.interceptions += 1;
          if (t.contract.horizon === 1) {
            trig.oneCell += 1;
            tally(coverage, "oneCellProjection");
          } else {
            trig.twoCell += 1;
            tally(coverage, "twoCellProjection");
          }
          if (t.contract.moves.length > 1) {
            trig.ties += 1;
            tally(coverage, "tiesBetweenLegalInterceptionMoves");
          }
          const obstacles = new Set([...t.input.blocked, cellKey(t.input.exit), cellKey(t.input.explorer)]);
          const fromHunter = REFERENCE_API.findPathLength(t.input.hunter, t.contract.target, t.input.walls, obstacles);
          tally(coverage, fromHunter === 1 ? "hunterAdjacentToPredictedCell" : "hunterFartherFromPredictedCell");
          if (t.after.trapOpenedWalls.length && planKey(contractInterception({ ...t.input, walls: t.map.walls })) !== planKey(t.contract)) tally(coverage, "projectionOnTheOpenedTopology");
          if (!t.observed) continue;
          interceptionSummary.turns += 1;
          if (sameCell(t.hunterAfter, t.after.player)) interceptionSummary.captures += 1;
          if (!t.contract.moves.some((c) => sameCell(c, t.hunterAfter))) interceptionSummary.illegal += 1;
          if (manhattan(t.hunterAfter, t.input.hunter) > 1) interceptionSummary.moreThanOneCell += 1;
          if (!t.legacy.some((c) => sameCell(c, t.hunterAfter))) interceptionSummary.pursuitCouldNotHaveMadeIt += 1;
          const outranked = t.events.some((e) => ["LIGHT_COLLECTED", "TRAP_ARMED", "WALL_OPENED_BY_TRAP", "PORTAL_ACTIVATED"].includes(e.type)) || sameCell(t.after.player, t.map.exitPosition);
          if (t.events.some((e) => e.type === "DEFENDERS_SETTLED") && !outranked && t.after.message !== INTERCEPT_MESSAGE) interceptionSummary.messageMissing += 1;
        }
        for (const t of answeredTurns) if (!t.contract && t.after.message === INTERCEPT_MESSAGE) interceptionSummary.messageWithout += 1;

        // --- solvers and the oracle, pre-Chest -------------------------------------------------------------------------
        for (let k = 0; k < answeredTurns.length; k += 1) {
          const t = answeredTurns[k];
          if (t.before.chestOpened || t.after.chestOpened || t.secondChanceByDefender || t.after.status === "won") continue;
          const { octx, dctx, sctx } = contextOf(t);
          const before = canonicalOf(t, "before");
          const after = canonD(canonicalOf(t, "after"));
          const a = actionIndexOf(t.action.direction);
          const lost = t.after.status === "lost";
          const has = (answer) => answer && (lost ? answer.hasLoss : answer.statesD.includes(after));
          solverAgreement.turns += 1;
          const o = oracleSuccessors(octx, before, a);
          if (o.intercepting) solverAgreement.interceptionTurns += 1;
          if (!has(o)) {
            solverAgreement.outsideOracle += 1;
            if (solverAgreement.examples.length < 5) solverAgreement.examples.push({ who: "oracle", seed, route, difficulty, policy: plan.policy, k: t.k });
          }
          const dyn = rota2Answer(solvers, dctx, before, a);
          if (!has(dyn)) {
            solverAgreement.outsideDynamic += 1;
            if (solverAgreement.examples.length < 5) solverAgreement.examples.push({ who: "dynamic", seed, route, difficulty, policy: plan.policy, k: t.k });
          }
          if (!t.before.trapOpenedWalls.length && !t.after.trapOpenedWalls.length && !sameCell(t.after.player, t.map.exitPosition)) {
            solverAgreement.staticTurns += 1;
            if (!has(packedAnswer(solvers, sctx, before, a))) {
              solverAgreement.outsideStatic += 1;
              if (solverAgreement.examples.length < 5) solverAgreement.examples.push({ who: "static", seed, route, difficulty, policy: plan.policy, k: t.k });
            }
          }
          // The oracle's whole support against the dynamic solver's, for every action from the real state.
          for (let b = 0; b < ACTIONS.length; b += 1) {
            const ob = b === a ? o : oracleSuccessors(octx, before, b);
            const db = b === a ? dyn : rota2Answer(solvers, dctx, before, b);
            if (ob === null && db === null) continue;
            solverAgreement.oracleDynamicPairs += 1;
            if (ob === null || db === null || ob.hasWin !== db.hasWin || ob.hasLoss !== db.hasLoss || !sameJson(ob.statesD, db.statesD)) solverAgreement.oracleDynamicDisagreements += 1;
            if (ob?.intercepting && !sameJson(oracleSuccessors({ ...octx, intercept: null }, before, b).statesD, ob.statesD)) solverAgreement.pairsChangedByPolicy += 1;
          }
          // --- fairness: after the defenders answered, can the Explorer step somewhere safe? ------------------------
          if (lost || route === 1) continue;
          const afterState = canonicalOf(t, "after");
          const safe = safeSteps(octx, afterState);
          if (t.contract && t.observed) {
            fairness.interceptionTurns += 1;
            if (safe.length) fairness.withASafeStep += 1;
            else {
              fairness.withoutASafeStep += 1;
              // Would the pursuit's every possible move have left no safe step either? Then the maze, not the
              // interception, closed the Explorer in.
              const pursuitLeaves = t.legacy.map((h) => safeSteps(octx, { ...afterState, h: cellId(h) }).length);
              if (pursuitLeaves.every((n) => n === 0)) fairness.withoutASafeStepUnderEveryPursuitMove += 1;
              else {
                fairness.interceptionTookTheLastSafeStep += 1;
                if (fairness.examples.length < 5) fairness.examples.push({ seed, route, difficulty, policy: plan.policy, k: t.k, pursuitSafeSteps: pursuitLeaves });
              }
            }
            const continuing = actionIndexOf(t.action.direction);
            const continuingCell = actionTarget(t.after.player, continuing);
            if (inBoard(continuingCell) && !t.after.walls.has(cellKey(continuingCell))) {
              if (safe.includes(continuing)) fairness.continuingWasSafe += 1;
              else fairness.continuingWasUnsafe += 1;
              if (safe.some((x) => x !== continuing)) fairness.turningWasSafe += 1;
            }
            // What the scripted Explorer did next, and whether it was caught within three turns.
            const next = answeredTurns[k + 1];
            if (next && next.k === t.k + 1) {
              const turned = next.action.direction !== t.action.direction;
              const later = game.turns.slice(t.k + 1, t.k + 4);
              const caught = later.some((x) => x.events.some((e) => e.type === "EXPLORER_CAPTURED"));
              if (turned) {
                fairness.nextStep.turned += 1;
                if (caught) fairness.nextStep.turnedThenCaptured3 += 1;
              } else {
                fairness.nextStep.continued += 1;
                if (caught) fairness.nextStep.continuedThenCaptured3 += 1;
              }
            }
          } else if (t.observed && manhattan(t.input.hunter, t.input.explorer) > 1) {
            fairness.pursuitTurns += 1;
            if (safe.length) fairness.pursuitWithASafeStep += 1;
          }
        }
        game.run.unmount();
      }
    }
    sampleHeap();
  }
});
log(`   interceptions ${interceptionSummary.turns} · solver turns ${solverAgreement.turns} · outside oracle ${solverAgreement.outsideOracle} / dynamic ${solverAgreement.outsideDynamic} / static ${solverAgreement.outsideStatic}`);

// --- restart and continuation -------------------------------------------------------------------------------------
const sessions = time("C-sessions", () => {
  const out = { sequences: 0, rememberedBeforeReset: 0, nullAfterRestart: 0, nullAfterModeChange: 0, nullOnNextRoute: 0, firstStepOfNewSessionIntercepted: 0 };
  for (const route of [1, 2]) {
    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < (QUICK ? 1 : 4); i += 1) {
        const run = NOW.mount({ seed: seedFor(route, difficulty, 200 + i), difficulty, routeNumber: route });
        const walk = () => {
          for (let s = 0; s < 5 && run.state.status === "playing"; s += 1) {
            const legal = legalDirections(run.state, { chest: false });
            if (!legal.length) break;
            run.move(DELTA[legal[0]]);
          }
          return run.state.lastExplorerDirection;
        };
        out.sequences += 1;
        const a = walk();
        run.restart();
        if (run.state.lastExplorerDirection === null) out.nullAfterRestart += 1;
        const b = walk();
        run.changeDifficulty(difficulty === "hard" ? "easy" : "hard");
        if (run.state.lastExplorerDirection === null) out.nullAfterModeChange += 1;
        run.act((g) => g.startGame());
        const c = walk();
        if (a && b && c) out.rememberedBeforeReset += 1;
        for (let s = 0; s < 200 && run.state.status === "playing"; s += 1) {
          const g = run.state;
          if (g.rewardChoicePending) {
            run.choose("pickaxe");
            continue;
          }
          const toward = pathBetween(g.player, g.guardian, g.walls);
          if (!toward || toward.length < 2) break;
          run.stepTo(toward[1]);
        }
        if (run.completions.at(-1)?.continuation) {
          const next = run.nextSession();
          if (next.state.lastExplorerDirection === null) out.nullOnNextRoute += 1;
          const legal = legalDirections(next.state, { chest: false });
          if (legal.length) {
            next.move(DELTA[legal[0]]);
            if (next.state.message === INTERCEPT_MESSAGE) out.firstStepOfNewSessionIntercepted += 1;
          }
          next.unmount();
        }
        run.unmount();
      }
    }
  }
  return out;
});
tally(coverage, "restartAndContinuationSequences", sessions.sequences);

// =================================================================================================
// D — exact state space and classes
// =================================================================================================
log("D  exact PRE_CHEST classes: base solver vs this tree");
const stateSpace = {
  maps: 0, byRoute: {}, base: {}, now: {}, transitions: {}, route1QuotientEqualsBase: 0, route1QuotientLabelEqualsBase: 0,
  route1Full: { maps: 0, explored: 0, baseExplored: 0, labels: {}, limited: 0 },
  representationOnly: { maps: 0, explored: 0, baseExplored: 0 },
  interceptingTransitions: 0, supportChangedTransitions: 0, policyCalls: 0,
  limits: { base: {}, now: {} }, rows: [], extended: [], cardinality: null,
};
const solverSample = allMaps.filter((m) => m.seed % 1000 < SOLVER_PER_COMBINATION);
time("D", () => {
  for (const { seed, route, difficulty, map } of solverSample) {
    const requirePassage = route >= 2;
    const counts = { calls: 0, intercepting: 0, changed: 0 };
    const counting = {
      ...intercept,
      hunterAdaptsOnRoute: intercept.hunterAdaptsOnRoute,
      planHunterInterception: (input) => {
        counts.calls += 1;
        const plan = intercept.planHunterInterception(input);
        if (plan) {
          counts.intercepting += 1;
          // The pursuit's support for the same transition (the adapter's `blocked` holds the armed traps and the Sentinel).
          const pursuit = referenceHunterSupport(input.hunter, input.explorer, input.exitPosition, input.walls, input.difficulty, input.blocked, null).map(cellKey).sort();
          if (!sameJson(pursuit, plan.moves.map(cellKey).sort())) counts.changed += 1;
        }
        return plan;
      },
    };
    const before = preSolvers.rota2.classifyMap(map, difficulty, { dynamic: true, requirePassage });
    const after = solvers.rota2.classifyMap(map, difficulty, { dynamic: true, requirePassage, routeNumber: route, intercept: counting });
    const b = short(before.label);
    const a = short(after.label);
    stateSpace.maps += 1;
    tally(stateSpace.base, b);
    tally(stateSpace.now, a);
    tally(stateSpace.transitions, `${b}->${a}`);
    (stateSpace.byRoute[route] ??= { base: {}, now: {} });
    tally(stateSpace.byRoute[route].base, b);
    tally(stateSpace.byRoute[route].now, a);
    if (before.graph.resourceLimit) tally(stateSpace.limits.base, before.graph.resourceLimit);
    if (after.graph.resourceLimit) tally(stateSpace.limits.now, after.graph.resourceLimit);
    stateSpace.interceptingTransitions += counts.intercepting;
    stateSpace.supportChangedTransitions += counts.changed;
    stateSpace.policyCalls += counts.calls;
    const row = { seed, route, difficulty, base: b, baseExplored: before.explored, now: a, nowExplored: after.explored, nowQuotient: after.directionQuotient, nowLimit: after.graph.resourceLimit ?? null, policyCalls: counts.calls, intercepting: counts.intercepting, supportChanged: counts.changed, baseMs: before.elapsedMs, nowMs: after.elapsedMs };
    if (route === 1) {
      if (after.explored === before.explored) stateSpace.route1QuotientEqualsBase += 1;
      if (a === b) stateSpace.route1QuotientLabelEqualsBase += 1;
      // What the component costs where it is never read: Route 1 without the quotient.
      const full = solvers.rota2.classifyMap(map, difficulty, { dynamic: true, requirePassage, routeNumber: 1, intercept, directionQuotient: false });
      stateSpace.route1Full.maps += 1;
      stateSpace.route1Full.explored += full.explored;
      stateSpace.route1Full.baseExplored += before.explored;
      tally(stateSpace.route1Full.labels, `${b}->${short(full.label)}`);
      if (full.graph.resourceLimit) stateSpace.route1Full.limited += 1;
      row.route1Full = { label: short(full.label), explored: full.explored, limit: full.graph.resourceLimit ?? null };
    } else if (seed % 1000 < 2) {
      // Routes 2/3: the direction carried but the policy off — the representation's share of the growth.
      const off = solvers.rota2.classifyMap(map, difficulty, { dynamic: true, requirePassage, routeNumber: 1, intercept, directionQuotient: false });
      stateSpace.representationOnly.maps += 1;
      stateSpace.representationOnly.explored += off.explored;
      stateSpace.representationOnly.baseExplored += before.explored;
      row.representationOnly = { label: short(off.label), explored: off.explored, limit: off.graph.resourceLimit ?? null };
    }
    if (EXTENDED && a === "I") {
      const ext = solvers.rota2.classifyMap(map, difficulty, { dynamic: true, requirePassage, routeNumber: route, intercept, maxStates: 10_000_000, maxElapsedMs: 900_000 });
      stateSpace.extended.push({ seed, route, difficulty, label: short(ext.label), explored: ext.explored, limit: ext.graph.resourceLimit ?? null, elapsedMs: ext.elapsedMs });
    }
    stateSpace.rows.push(row);
    log(`   R${route} ${difficulty} ${seed}: base ${b} (${before.explored}) → now ${a} (${after.explored}${after.graph.resourceLimit ? `, ${after.graph.resourceLimit}` : ""})${row.route1Full ? ` · full ${row.route1Full.label} ${row.route1Full.explored}` : ""}${row.representationOnly ? ` · d-only ${row.representationOnly.label} ${row.representationOnly.explored}` : ""}`);
    sampleHeap();
  }
  if (solverSample.length) {
    const sample = solverSample[0];
    const ctx = buildContext(sample.map, sample.difficulty);
    const contract = packedStateContract(ctx);
    stateSpace.cardinality = {
      example: { seed: sample.seed, route: sample.route, difficulty: sample.difficulty },
      directionValues: contract.directionValues,
      mixedRadixStateCardinality: contract.mixedRadixStateCardinality,
      withoutDirection: contract.mixedRadixStateCardinality / contract.directionValues,
      factor: contract.directionValues,
      numberSafe: contract.numberSafe,
    };
  }
});

// =================================================================================================
// E — cost
// =================================================================================================
log("E  cost");
const cost = time("E", () => {
  // The policy on real inputs: every answered step of the Route 2/3 straight games of the first 20 seeds per mode.
  const inputs = [];
  for (const { seed, route, difficulty } of allMaps.filter((m) => m.route >= 2 && m.seed % 1000 < 20)) {
    const spec = { seed, route, difficulty, policy: "straight" };
    const game = playGame(NOW, nowTrace, nowDraws, spec, POLICIES.straight);
    for (const t of game.turns) {
      analyseTurn(t, intercept);
      if (t.input) inputs.push(t.input);
    }
    game.run.unmount();
  }
  const measure = (list) => {
    if (!list.length) return null;
    const rounds = 20;
    const t0 = performance.now();
    for (let r = 0; r < rounds; r += 1) {
      for (const input of list) {
        intercept.planHunterInterception({ routeNumber: input.route, difficulty: input.difficulty, previousDirection: input.previous, direction: input.direction, hunter: input.hunter, explorer: input.explorer, exitPosition: input.exit, walls: input.walls, blocked: input.blocked });
      }
    }
    return Math.round(((performance.now() - t0) * 1000 * 100) / (rounds * list.length)) / 100;
  };
  return {
    inputs: inputs.length,
    microsecondsPerCall: measure(inputs),
    microsecondsPerRepeatedStep: measure(inputs.filter((i) => i.previous === i.direction)),
    microsecondsPerOtherStep: measure(inputs.filter((i) => i.previous !== i.direction)),
    rendersPerInput: { now: Math.round((renders.now.renders / renders.now.inputs) * 1000) / 1000, base: Math.round((renders.base.renders / renders.base.inputs) * 1000) / 1000 },
  };
});

// =================================================================================================
// verdict
// =================================================================================================
const REQUIRED_COVERAGE = [
  "repeatedDirection", "directionChanges", "oneCellProjection", "twoCellProjection", "blockedProjectedCell",
  "projectedCellBehindAClosedWall", "projectionOnTheOpenedTopology", "hunterAdjacentToPredictedCell",
  "hunterFartherFromPredictedCell", "tiesBetweenLegalInterceptionMoves", "noLegalInterceptionMove", "legacyFallback",
  "trapActivationAndWallOpeningSameTurn", "portalActivated", "restartAndContinuationSequences", "capture", "secondChance",
];
const rates = {};
for (const tree of ["base", "now"]) {
  for (const [key, row] of Object.entries(outcomes[tree])) {
    (rates[key] ??= {})[tree] = { games: row.games, winRate: pct(row.won, row.games), captureRate: pct(row.lost, row.games), stoppedRate: pct(row.budget + row.noMove, row.games), capturedBy: row.capturedBy, secondChances: row.secondChances };
  }
}
const drawSummary = {};
for (const tree of ["base", "now"]) {
  for (const [key, row] of Object.entries(hunterDraws[tree])) (drawSummary[key] ??= {})[tree] = { steps: row.steps ?? 0, draws: row.draws ?? 0, perStep: row.steps ? Math.round((1000 * (row.draws ?? 0)) / row.steps) / 1000 : null };
}
const checks = [
  ["A1", "1080 maps identical to the base (draws included)", generation.maps === (QUICK ? 90 : 1080) && generation.identical === generation.maps && generation.drawsIdentical === generation.maps && generation.exceptions === 0],
  ["B1", "Route 1 identical to the base: every render, event, draw, message and result", route1.games === (QUICK ? 30 : 360) && route1.mapsDiffer + route1.rendersDiffer + route1.eventsDiffer + route1.drawsDiffer + route1.messagesDiffer + route1.resultsDiffer === 0],
  ["C1", "every real turn in the oracle's and both solvers' support; oracle = dynamic solver", solverAgreement.turns > 0 && solverAgreement.interceptionTurns > 0 && solverAgreement.outsideOracle + solverAgreement.outsideDynamic + solverAgreement.outsideStatic + solverAgreement.oracleDynamicDisagreements === 0],
  ["C2", "the interception is the contract's, one legal cell, never a capture; its message only when it moved", interceptionSummary.turns > 0 && interceptionSummary.captures + interceptionSummary.illegal + interceptionSummary.moreThanOneCell + interceptionSummary.messageMissing + interceptionSummary.messageWithout + interceptionSummary.moduleDisagrees === 0],
  ["C3", "every situation the mission names was observed", REQUIRED_COVERAGE.every((k) => (coverage[k] ?? 0) > 0)],
  ["C4", "restart, mode change and the next Route forget the direction; a new session's first step never intercepts", sessions.sequences > 0 && sessions.rememberedBeforeReset === sessions.sequences && sessions.nullAfterRestart === sessions.sequences && sessions.nullAfterModeChange === sessions.sequences && sessions.nullOnNextRoute > 0 && sessions.firstStepOfNewSessionIntercepted === 0],
  ["C5", "no state goes invalid or unsolvable while playing (both trees)", softlock.now.invalidWhilePlaying === 0 && softlock.now.unsolvableWhilePlaying === 0 && softlock.base.invalidWhilePlaying === 0],
  ["D1", "Route 1's exact quotient is the base graph, state for state", QUICK || (stateSpace.route1QuotientEqualsBase === stateSpace.route1Full.maps && stateSpace.route1QuotientLabelEqualsBase === stateSpace.route1Full.maps)],
  ["D2", "a map at a resource limit stays INCONCLUSIVE", QUICK || stateSpace.rows.every((r) => (r.nowLimit !== null) === (r.now === "I"))],
];
const failing = checks.filter(([, , pass]) => !pass).map(([id]) => id);
for (const [id, name, pass] of checks) log(`${pass ? "PASS" : "FAIL"}  ${id} — ${name}`);
console.log(`\n${checks.length - failing.length}/${checks.length} checks${failing.length ? ` · failing: ${failing.join(", ")}` : ""}`);
console.log(failing.length ? "ROTA2_ADAPTIVE_HUNTER_CENSUS_FAILED" : "ROTA2_ADAPTIVE_HUNTER_CENSUS_OK");
sampleHeap();

const payload = {
  mission: "ROTA2-ADAPTIVE-HUNTER-04",
  base: ADAPTIVE_BASE,
  checks: checks.map(([id, name, pass]) => ({ id, name, pass })),
  generation,
  route1,
  runtime: { rates, outcomes, hunterDraws: drawSummary, triggers, interceptions: interceptionSummary, coverage, softlock, sessions },
  solverAgreement,
  fairness,
  stateSpace,
  cost: { inputs: cost.inputs, rendersPerInput: cost.rendersPerInput },
  run: { timingsMs: timings, totalMs: Math.round(performance.now() - started), peakHeapMB: Math.round(peakHeap / 1048576), rssMB: Math.round(process.memoryUsage().rss / 1048576), policyCost: { microsecondsPerCall: cost.microsecondsPerCall, microsecondsPerRepeatedStep: cost.microsecondsPerRepeatedStep, microsecondsPerOtherStep: cost.microsecondsPerOtherStep }, baseMs: stateSpace.rows.map((r) => r.baseMs), nowMs: stateSpace.rows.map((r) => r.nowMs) },
};
// Timings inside the rows are run metadata too.
for (const row of payload.stateSpace.rows) {
  delete row.baseMs;
  delete row.nowMs;
}
if (QUICK) {
  for (const [name, value] of Object.entries({ interceptionSummary, solverAgreement, fairness, cost, sessions, coverage, triggers, drawSummary, softlock, rates })) console.log(`${name}: ${JSON.stringify(value)}`);
  process.exit(failing.length ? 1 : 0);
}
const EVIDENCE = openEvidence(process.env.ROUTE_VALIDATION_OUT ?? "docs/archive/rota2-adaptive-hunter-04");
EVIDENCE.write("census.json", payload, { metadata: ["run"] });
process.exitCode = EVIDENCE.finish({ ok: failing.length === 0 });
