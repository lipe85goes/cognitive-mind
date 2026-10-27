/**
 * ROTA2-DEPENDENT-OBJECTIVES-02 — the census: every Route × mode over many seeds, nothing hand-picked.
 *
 *   A  generation    1080 maps (3 Routes × 3 modes × 120 seeds) generated on this tree AND on the mission's base
 *                    (32c419a, DYNAMIC-TRAPS-01's tree): the objective plan draws nothing, so every map must be the
 *                    same map. Also the cost of evaluating the objectives.
 *   B  structure     every map through rota2-objectives-structure.mjs (written apart from production): trap reachable
 *                    without the passage, lights reachable, portal reachable after the prerequisites, both orders,
 *                    the Pickaxe path, the Second Chance path, circular dependencies, impossible objectives — and the
 *                    production inspector (`requiredPassageWall`) on every passage-closed topology the Explorer can
 *                    reach (Chest closed, Second Chance taken, the Pickaxe spent on any other reachable wall).
 *   C  adversarial   the exact PRE_CHEST solver on a stratified sample: DYNAMIC-TRAPS-01 rules (the portal wakes on
 *                    the lights) against DEPENDENT-OBJECTIVES-02 rules (Routes 2/3 also wait for the passage). Every
 *                    newly proven-impossible map is investigated: structural witness, and why the defenders win.
 *   D  runtime       the REAL hook. Route 1: one seeded game per map (all 360) against the base, render by render,
 *                    event by event (expected: 0 maps changed). Routes 2/3: lights → trap, trap → lights,
 *                    lights → Pickaxe, Pickaxe → lights, Second Chance → trap, the portal visited early, restart and
 *                    the next Route, with the inspector on every render and every pre-Chest step held against the
 *                    solver's exact support under the mission's rule.
 *
 * Usage: node tools/validation/rota2-dependent-objectives-census.mjs [--check|--update]
 *        (`ROUTE_VALIDATION_OUT=<dir>` to write elsewhere)
 */
import { cellKey, loadRouteRuntime, pathBetween, sameCell, walkableNeighbours } from "./route-runtime-harness.mjs";
import { ACTIONS } from "./dynamic-solver.mjs";
import { buildDynamicContext, classifyMap, dynamicSuccessorSet, packDynamicState } from "./rota2-dynamic-solver.mjs";
import { objectiveStructure, reachableFrom } from "./rota2-objectives-structure.mjs";
import { openEvidence } from "./evidence.mjs";

const BASE = "32c419a2784b54043f38f08afd60c8628f44f54c";
const V1 = "9f8ebb5d8c0c747e68d8719e523ecab3ecbdab00";
const DIFFICULTIES = ["easy", "medium", "hard"];
const ROUTES = [1, 2, 3];
// `ROTA2_CENSUS_QUICK=1` (debugging only): a small sample, no solver classes, and nothing written.
const QUICK = process.env.ROTA2_CENSUS_QUICK === "1";
const MAPS_PER_COMBINATION = QUICK ? 12 : 120;
const SOLVER_PER_COMBINATION = QUICK ? 0 : 8;
const RUNTIME_PER_COMBINATION = 12;
const started = performance.now();

const keyToCell = (key) => {
  const [row, col] = key.split(",").map(Number);
  return { row, col };
};
const manhattan = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
const sortedKeys = (set) => [...set].sort();
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const seedFor = (route, difficulty, index) => 9_200_000 + route * 10_000 + DIFFICULTIES.indexOf(difficulty) * 1_000 + index;
const mapFields = (m) =>
  JSON.stringify({ grid: m.grid, walls: sortedKeys(m.walls), playerStart: m.playerStart, guardianStart: m.guardianStart, exitPosition: m.exitPosition, collectibleStars: m.collectibleStars, traps: m.traps, chest: m.chest, trapLinks: m.trapLinks ?? null });
const tally = (object, key) => {
  object[key] = (object[key] ?? 0) + 1;
};
const log = (...m) => console.log(...m);

// Read-only recorder lines: every domain event, and the walls each Hunter decision was given.
const INSTRUMENT = {
  "src/games/escape-maze/route-events.ts": (source) => {
    const anchor = "): RouteStateAction[] {\n";
    if (source.split(anchor).length !== 2) throw new Error("census: routeStateActionsForEvent anchor");
    return source.replace(anchor, `${anchor}  (globalThis as any).__obj?.events.push(event);\n`);
  },
  "src/games/escape-maze/route-defenders.ts": (source) => {
    const anchor = "  blockedForDefenders: Set<string> = EMPTY_BLOCKED,\n): GridPosition {\n";
    if (source.split(anchor).length !== 2) throw new Error("census: chooseGuardianMove anchor");
    return source.replace(anchor, `${anchor}  (globalThis as any).__obj?.hunter.push({ walls });\n`);
  },
};
const NOW = loadRouteRuntime({ directDifficulty: true, transforms: [INSTRUMENT] });
const PRE = loadRouteRuntime({ directDifficulty: true, rev: BASE, transforms: [INSTRUMENT] });
for (const rt of [NOW, PRE]) rt.LAB.sb.__obj = { events: [], hunter: [] };
const generate = (rt, seed, difficulty, route) => {
  rt.LAB.setSeed(seed);
  return rt.API.generateMaze(difficulty, route);
};
const objectivesModule = NOW.LAB.graph.require("src/games/escape-maze/route-objectives.ts");

// =================================================================================================
// A — generation
// =================================================================================================
log("A  generation: this tree against the mission's base");
const generation = { maps: 0, throws: 0, sameAsBase: 0, changedVsBase: 0, changedExamples: [], linkedMaps: 0, evaluation: null };
const allMaps = [];
for (const route of ROUTES) {
  for (const difficulty of DIFFICULTIES) {
    for (let i = 0; i < MAPS_PER_COMBINATION; i += 1) {
      const seed = seedFor(route, difficulty, i);
      generation.maps += 1;
      let map;
      let before;
      try {
        map = generate(NOW, seed, difficulty, route);
        before = generate(PRE, seed, difficulty, route);
      } catch {
        generation.throws += 1;
        continue;
      }
      if (mapFields(map) === mapFields(before)) generation.sameAsBase += 1;
      else {
        generation.changedVsBase += 1;
        if (generation.changedExamples.length < 5) generation.changedExamples.push({ seed, route, difficulty });
      }
      if ((map.trapLinks ?? []).length === 1) generation.linkedMaps += 1;
      allMaps.push({ seed, route, difficulty, map });
    }
  }
}
{
  // The cost of the evaluator: what the hook pays per render (and per step / Pickaxe break).
  const plans = ROUTES.map((n) => objectivesModule.routeObjectivePlan(n));
  const inputs = allMaps.map(({ route, map }) => ({ plan: plans[route - 1], mazeMap: map, collectedStars: map.collectibleStars.slice(0, 1).map(cellKey), walls: map.walls }));
  const rounds = 200;
  const t0 = performance.now();
  let ready = 0;
  for (let r = 0; r < rounds; r += 1) for (const input of inputs) if (objectivesModule.evaluateRouteObjectives(input).portalReady) ready += 1;
  const elapsed = performance.now() - t0;
  generation.evaluation = { evaluations: rounds * inputs.length, microsecondsPerEvaluation: Number(((elapsed * 1000) / (rounds * inputs.length)).toFixed(3)), readyCount: ready };
}
log(`   ${generation.maps} maps · same as base ${generation.sameAsBase} · changed ${generation.changedVsBase} · throws ${generation.throws} · evaluation ${generation.evaluation.microsecondsPerEvaluation} µs`);

// =================================================================================================
// B — structure
// =================================================================================================
log("B  structural completability");
const structure = {
  standardMaps: 0, standardCompletable: 0,
  dependentMaps: 0, completable: 0, trapReachable: 0, lightsReachable: 0, portalReachableAfterPrerequisites: 0,
  lightsFirst: 0, passageFirst: 0, bothOrders: 0, pickaxePath: 0, secondChancePath: 0, circular: 0, impossible: 0,
  inspector: { states: 0, notSolvable: 0, invalid: 0, examples: [] },
  impossibleExamples: [],
};
const API = NOW.API;
/**
 * A legal resting state (as rota2-dynamic-traps-census.mjs builds it): the Explorer where the override puts it, the
 * Hunter on its seat, the Sentinel on the nearest zone cell that is none of those, nor the linked trap.
 */
const baseSnapshot = (map, overrides) => {
  const zone = API.computePortalDefenceZone(map.playerStart, map.exitPosition, map.walls);
  const linkedTrap = map.trapLinks[0].trap;
  const player = overrides.player ?? map.playerStart;
  const post = zone.zone.find(
    (cell) => ![map.exitPosition, player, map.guardianStart].some((c) => cellKey(c) === cellKey(cell)) && cellKey(cell) !== linkedTrap,
  ) ?? API.createSentinelState(map, zone).position;
  return {
    mazeMap: map, player, guardian: map.guardianStart, sentinel: post,
    collectedStars: [], triggeredTraps: [], chestOpened: false, rewardSelected: null, rewardSpent: false,
    brokenWall: null, trapOpenedWalls: [], status: "playing", ...overrides,
  };
};
for (const { seed, route, difficulty, map } of allMaps) {
  const s = objectiveStructure(map, { requirePassage: route >= 2 });
  if (route === 1) {
    structure.standardMaps += 1;
    if (s.completable && s.portalReachableAfterPrerequisites) structure.standardCompletable += 1;
    continue;
  }
  structure.dependentMaps += 1;
  if (s.completable && s.lightsReachable && s.portalReachableAfterPrerequisites) structure.completable += 1;
  else {
    structure.impossible += 1;
    if (structure.impossibleExamples.length < 5) structure.impossibleExamples.push({ seed, route, difficulty });
  }
  if (s.trapReachable) structure.trapReachable += 1;
  if (s.lightsReachable) structure.lightsReachable += 1;
  if (s.portalReachableAfterPrerequisites) structure.portalReachableAfterPrerequisites += 1;
  if (s.orders.lightsFirst) structure.lightsFirst += 1;
  if (s.orders.passageFirst) structure.passageFirst += 1;
  if (s.orders.lightsFirst && s.orders.passageFirst) structure.bothOrders += 1;
  if (s.pickaxePath) structure.pickaxePath += 1;
  if (s.secondChancePath) structure.secondChancePath += 1;
  if (s.circular) structure.circular += 1;
  // The production inspector, passage still closed, in every way the Explorer can be holding the Chest.
  const wall = map.trapLinks[0].mutation.wall;
  const sensibleWalls = (() => {
    const reach = reachableFrom(map.playerStart, map.walls);
    return [...map.walls].filter((w) => w !== wall && walkableNeighbours(keyToCell(w), map.walls).some((c) => reach.has(cellKey(c))));
  })();
  const variants = [
    {},
    map.chest && { chestOpened: true, rewardSelected: "second-chance", player: map.chest },
    map.chest && { chestOpened: true, rewardSelected: "second-chance", rewardSpent: true, player: map.chest },
    map.chest && { chestOpened: true, rewardSelected: "pickaxe", player: map.chest },
    ...(map.chest ? sensibleWalls.map((broken) => ({ chestOpened: true, rewardSelected: "pickaxe", rewardSpent: true, brokenWall: broken, player: map.chest })) : []),
  ].filter(Boolean);
  for (const v of variants) {
    const verdict = API.inspectDynamicMazeState(baseSnapshot(map, { ...v, requiredPassageWall: wall }));
    structure.inspector.states += 1;
    if (!verdict.valid) {
      structure.inspector.invalid += 1;
      if (structure.inspector.examples.length < 5) structure.inspector.examples.push({ seed, route, difficulty, v, issues: verdict.issues });
    }
    if (!verdict.topologicallySolvable) {
      structure.inspector.notSolvable += 1;
      if (structure.inspector.examples.length < 5) structure.inspector.examples.push({ seed, route, difficulty, v, issues: verdict.issues, unreachable: verdict.unreachableObjectives });
    }
  }
}
log(`   R2/R3 ${structure.dependentMaps} maps · completable ${structure.completable} · circular ${structure.circular} · impossible ${structure.impossible} · both orders ${structure.bothOrders} · inspector states ${structure.inspector.states} (not solvable ${structure.inspector.notSolvable})`);

// =================================================================================================
// C — exact adversarial classes, DYNAMIC-TRAPS-01 rules against DEPENDENT-OBJECTIVES-02 rules
// =================================================================================================
log("C  exact PRE_CHEST solver, dynamic-traps rules vs dependent-objectives rules");
const short = (label) => ({ GUARANTEED_SOLVABLE_PRE_CHEST: "G", POSSIBLE_BUT_NOT_GUARANTEED_PRE_CHEST: "P", PROVED_UNSOLVABLE_PRE_CHEST: "U", INCONCLUSIVE_RESOURCE_LIMIT: "I", NOT_ANALYSED_ACCESSES_DIFFER: "N" })[label] ?? label;
const rank = { G: 0, P: 1, U: 2 };
const adversarial = { maps: 0, byRoute: {}, traps01: {}, objectives02: {}, transitions: {}, harder: 0, easier: 0, unchanged: 0, inconclusive: 0, route1Changed: 0, newlyImpossible: [], harderExamples: [] };
const solverSample = ROUTES.flatMap((route) => DIFFICULTIES.flatMap((difficulty) => allMaps.filter((m) => m.route === route && m.difficulty === difficulty).slice(0, SOLVER_PER_COMBINATION)));
for (const { seed, route, difficulty, map } of solverSample) {
  const before = classifyMap(map, difficulty, { dynamic: true, requirePassage: false });
  const after = classifyMap(map, difficulty, { dynamic: true, requirePassage: route >= 2 });
  const a = short(before.label);
  const b = short(after.label);
  adversarial.maps += 1;
  tally(adversarial.traps01, a);
  tally(adversarial.objectives02, b);
  adversarial.byRoute[route] ??= { traps01: {}, objectives02: {} };
  tally(adversarial.byRoute[route].traps01, a);
  tally(adversarial.byRoute[route].objectives02, b);
  tally(adversarial.transitions, `${a}->${b}`);
  if (route === 1 && a !== b) adversarial.route1Changed += 1;
  if (rank[a] === undefined || rank[b] === undefined) adversarial.inconclusive += 1;
  else if (rank[b] > rank[a]) {
    adversarial.harder += 1;
    const s = objectiveStructure(map, { requirePassage: true });
    const link = map.trapLinks[0];
    const trap = keyToCell(link.trap);
    const row = {
      seed, route, difficulty, pair: `${a}->${b}`,
      structuralWitness: s.completable && s.orders.lightsFirst && s.orders.passageFirst,
      circular: s.circular,
      trapToExit: manhattan(trap, map.exitPosition),
      trapToStart: manhattan(trap, map.playerStart),
      trapToHunterStart: manhattan(trap, map.guardianStart),
      // Under the old rule, could the Explorer win without ever arming the linked trap? (If so, the new rule asked
      // for a detour the defenders can always punish.)
      oldWinsWithoutPassage: (() => {
        const g = before.graph;
        for (let k = 0; k < g.actionSource.length; k += 1) {
          if (g.actionFlags.data[k] & 1 && !(g.nodes.numericState(g.actionSource.data[k]).traps & before.dctx.linkBit)) return true;
        }
        return false;
      })(),
    };
    if (b === "U") adversarial.newlyImpossible.push(row);
    else if (adversarial.harderExamples.length < 8) adversarial.harderExamples.push(row);
  } else if (rank[b] < rank[a]) adversarial.easier += 1;
  else adversarial.unchanged += 1;
  log(`   R${route} ${difficulty} ${seed}: traps-01 ${a} (${before.explored}) → objectives-02 ${b} (${after.explored})`);
}

// =================================================================================================
// D — the real hook
// =================================================================================================
log("D  runtime");
const trace = NOW.LAB.sb.__obj;
const runtime = {
  route1: { maps: 0, games: 0, mapsChanged: 0, divergences: [], wins: 0, portalActivations: 0, frames: 0 },
  scenarios: {},
  portalActivatedTwice: 0,
  wonWithoutActivation: 0,
  earlyVisits: 0,
  earlyWins: 0,
  rendersInspected: 0,
  invalidPlayingRenders: 0,
  passageTruthMismatch: 0,
  restart: { attempted: 0, reached: 0, fresh: 0 },
  nextRoute: { attempted: 0, fresh: 0 },
  // `defenderModelGap`: the hook's state is missing from the support under the OLD win rule too — a gap of the
  // reference defender model (the Sentinel's commitment once traps are armed; see `referenceGap`), not of the
  // objective condition, which only decides whether a step onto the exit wins.
  differential: { transitions: 0, unsound: 0, heldDoorArmed: 0, defenderModelGap: 0, objectiveUnsound: 0, wins: 0, afterPassage: 0, examples: [], gapExamples: [] },
};
const observe = (g) => ({
  status: g.status, message: g.message, turns: g.turns, errors: g.errors, blockedMoves: g.blockedMoves,
  player: cellKey(g.player), guardian: cellKey(g.guardian), sentinel: cellKey(g.sentinel),
  collected: [...g.collectedSet], triggered: [...g.triggeredTrapSet], walls: sortedKeys(g.walls), brokenWall: g.brokenWall,
  trapOpenedWalls: g.trapOpenedWalls, chestOpened: g.chestOpened, rewardSelected: g.rewardSelected, rewardSpent: g.rewardSpent,
  portalActive: g.portalActive, score: g.score, valid: g.dynamicSolvability.valid,
});

// D1 · Route 1, every map, against the base
for (const { seed, difficulty } of allMaps.filter((m) => m.route === 1)) {
  const play = (rt) => {
    const box = rt.LAB.sb.__obj;
    const run = rt.mount({ seed, difficulty, routeNumber: 1 });
    box.events.length = 0;
    let lcg = seed >>> 0;
    const rand = () => ((lcg = (Math.imul(lcg, 1664525) + 1013904223) >>> 0) / 2 ** 32);
    const frames = [observe(run.state)];
    for (let i = 0; i < 140 && run.state.status === "playing"; i += 1) {
      const g = run.state;
      if (g.rewardChoicePending) run.choose(rand() < 0.5 ? "pickaxe" : "second-chance");
      else if (g.breakTargets.length && rand() < 0.3) run.break(g.breakTargets[Math.floor(rand() * g.breakTargets.length)].cell);
      else {
        const remaining = g.mazeMap.collectibleStars.filter((s) => !g.collectedSet.has(cellKey(s)));
        const trap = (g.mazeMap.trapLinks ?? [])[0]?.trap;
        const goal = rand() < 0.15 && trap && !g.triggeredTrapSet.has(trap) ? keyToCell(trap) : remaining[0] ?? g.mazeMap.exitPosition;
        const legal = walkableNeighbours(g.player, g.walls);
        const blocked = new Set([...g.walls, cellKey(g.guardian), cellKey(g.sentinel)]);
        blocked.delete(cellKey(goal));
        const route = pathBetween(g.player, goal, blocked);
        const next = rand() < 0.3 || !route || route.length < 2 ? legal[Math.floor(rand() * legal.length)] : route[1];
        if (!next) break;
        run.stepTo(next);
      }
      frames.push(observe(run.state));
    }
    return { frames, events: JSON.stringify(box.events, (k, v) => (v instanceof Set ? [...v].sort() : v)), completion: JSON.stringify(run.completions) };
  };
  const a = play(NOW);
  const b = play(PRE);
  runtime.route1.maps += 1;
  runtime.route1.games += 1;
  runtime.route1.frames += a.frames.length;
  if (a.frames.at(-1).status === "won") runtime.route1.wins += 1;
  runtime.route1.portalActivations += (a.events.match(/"PORTAL_ACTIVATED"/g) ?? []).length;
  if (!sameJson(a.frames, b.frames) || a.events !== b.events || a.completion !== b.completion) {
    runtime.route1.mapsChanged += 1;
    if (runtime.route1.divergences.length < 5) runtime.route1.divergences.push({ seed, difficulty, at: a.frames.findIndex((f, k) => !sameJson(f, b.frames[k])) });
  }
}
log(`   Route 1: ${runtime.route1.games} games vs base · changed ${runtime.route1.mapsChanged} · wins ${runtime.route1.wins}`);

// D2 · Routes 2/3 scenarios
let margin = 1;
let dctx = null;
let dctxOld = null;
let currentRun = null;
const decodeKey = (key) => {
  const m = dctx.closed.packed;
  let x = key;
  const traps = x % m.trapRadix;
  x = (x - traps) / m.trapRadix;
  const lights = x % m.lightRadix;
  x = (x - lights) / m.lightRadix;
  const c = x % 4;
  x = (x - c) / 4;
  const t = (x % m.targetRadix) - 1;
  x = (x - (t + 1)) / m.targetRadix;
  const s = x % 81;
  x = (x - s) / 81;
  const h = x % 81;
  return { e: (x - h) / 81, h, s, t, c, lights, traps };
};
const numericOf = (g) => {
  const id = (p) => p.row * 9 + p.col;
  let lights = 0;
  g.mazeMap.collectibleStars.forEach((s, i) => {
    if (g.collectedSet.has(cellKey(s))) lights |= 1 << i;
  });
  let traps = 0;
  g.mazeMap.traps.forEach((t, i) => {
    if (g.triggeredTrapSet.has(cellKey(t))) traps |= 1 << i;
  });
  const t = g.sentinelTarget ? [...dctx.unionAccessIds].indexOf(id(g.sentinelTarget)) : -1;
  return { e: id(g.player), h: id(g.guardian), s: id(g.sentinel), t, c: g.sentinelCommitLeft, lights, traps };
};
const inspect = (g) => {
  if (!g || !g.mazeMap) return;
  runtime.rendersInspected += 1;
  if (g.status === "playing" && !g.dynamicSolvability.valid) runtime.invalidPlayingRenders += 1;
  const link = g.mazeMap.trapLinks[0];
  const open = !g.walls.has(link.mutation.wall);
  if (g.objectives.passage.open !== open || g.portalActive !== (g.objectives.lights.complete && (!g.objectives.passage.required || open))) runtime.passageTruthMismatch += 1;
};
const step = (run, cell) => {
  const before = run.state;
  const preChest = !before.chestOpened && before.rewardSelected === null;
  const pre = preChest && dctx && dctx.map === before.mazeMap && !dctx.accessesDiffer ? numericOf(before) : null;
  const actionIndex = ACTIONS.findIndex((a) => a.row === cell.row - before.player.row && a.col === cell.col - before.player.col);
  if (sameCell(cell, before.mazeMap.exitPosition) && !before.portalActive) runtime.earlyVisits += 1;
  run.stepTo(cell);
  const after = run.state;
  inspect(after);
  if (sameCell(cell, before.mazeMap.exitPosition) && !before.portalActive && !after.portalActive && after.status === "won") runtime.earlyWins += 1;
  if (pre && actionIndex >= 0 && !after.rewardChoicePending && after.turns === before.turns + 1) {
    const support = dynamicSuccessorSet(dctx, pre, actionIndex);
    const d = runtime.differential;
    d.transitions += 1;
    if (after.trapOpenedWalls.length) d.afterPassage += 1;
    let sound;
    if (after.status === "lost") sound = Boolean(support?.hasLoss);
    else if (after.status === "won") {
      sound = Boolean(support?.hasWin);
      d.wins += 1;
    } else sound = Boolean(support) && support.states.includes(packDynamicState(dctx, numericOf(after)));
    if (!sound) {
      d.unsound += 1;
      const post = numericOf(after);
      const armedNow = after.triggeredTrapSet.size > before.triggeredTrapSet.size;
      const heldDoor = before.sentinelTarget ? cellKey(before.sentinelTarget) : null;
      const samePieces = (support?.states ?? []).map(decodeKey).some((x) => x.e === post.e && x.h === post.h && x.s === post.s && x.lights === post.lights && x.traps === post.traps);
      const oldSupport = dctxOld ? dynamicSuccessorSet(dctxOld, pre, actionIndex) : null;
      const oldAlsoMisses = after.status === "playing" && oldSupport && !oldSupport.hasWin && !oldSupport.states.includes(packDynamicState(dctxOld, post));
      if (after.status === "playing" && armedNow && heldDoor === cellKey(after.player) && samePieces) d.heldDoorArmed += 1;
      else if (oldAlsoMisses && !support?.hasWin) {
        d.defenderModelGap += 1;
        if (d.gapExamples.length < 3) d.gapExamples.push({ ...currentRun, sentinel: [cellKey(before.sentinel), cellKey(after.sentinel)], heldDoor, traps: post.traps });
      } else {
        d.objectiveUnsound += 1;
        if (d.examples.length < 5) {
          d.examples.push({
            ...currentRun, status: after.status, solverWin: Boolean(support?.hasWin), pre, post, armedNow, heldDoor,
            player: [cellKey(before.player), cellKey(after.player)], hunter: [cellKey(before.guardian), cellKey(after.guardian)],
            sentinel: [cellKey(before.sentinel), cellKey(after.sentinel)], support: (support?.states ?? []).map(decodeKey),
          });
        }
      }
    }
  }
  return after;
};
const stepToward = (run, target, avoidKeys) => {
  const g = run.state;
  const avoid = new Set(avoidKeys);
  if (g.mazeMap.chest && !g.chestOpened) avoid.add(cellKey(g.mazeMap.chest));
  avoid.add(cellKey(g.mazeMap.exitPosition));
  if (margin >= 0) {
    for (const t of g.mazeMap.traps) avoid.add(cellKey(t));
    for (const s of g.mazeMap.collectibleStars) if (!g.collectedSet.has(cellKey(s))) avoid.add(cellKey(s));
  }
  avoid.delete(cellKey(target));
  const reach = margin > 0 ? [g.guardian, g.sentinel, ...walkableNeighbours(g.guardian, g.walls), ...walkableNeighbours(g.sentinel, g.walls)] : [g.guardian, g.sentinel];
  const careful = new Set([...g.walls, ...avoid, ...reach.map(cellKey)]);
  careful.delete(cellKey(target));
  careful.delete(cellKey(g.player));
  let route = pathBetween(g.player, target, careful);
  if (!route) {
    const plain = new Set([...g.walls, ...avoid, cellKey(g.guardian), cellKey(g.sentinel)]);
    plain.delete(cellKey(target));
    route = pathBetween(g.player, target, plain);
  }
  if (!route || route.length < 2) return false;
  step(run, route[1]);
  return true;
};
const walk = (run, target, avoidKeys = [], budget = 60) => {
  for (let i = 0; i < budget; i += 1) {
    const g = run.state;
    if (sameCell(g.player, target)) return true;
    if (g.status !== "playing" || g.rewardChoicePending) return false;
    if (!stepToward(run, target, avoidKeys)) return false;
  }
  return sameCell(run.state.player, target);
};
const walkBeside = (run, cell, avoidKeys = []) => {
  for (const n of walkableNeighbours(cell, run.state.walls).sort((a, b) => manhattan(a, run.state.player) - manhattan(b, run.state.player))) {
    if (walk(run, n, [cellKey(cell), ...avoidKeys])) return true;
    if (run.state.status !== "playing") return false;
  }
  return false;
};
const collectLights = (run, avoidKeys = []) => {
  for (let guard = 0; guard < 12; guard += 1) {
    const g = run.state;
    const left = g.mazeMap.collectibleStars.filter((s) => !g.collectedSet.has(cellKey(s))).sort((a, b) => manhattan(a, g.player) - manhattan(b, g.player));
    if (left.length === 0) return true;
    if (!walkBeside(run, left[0], avoidKeys)) return false;
    step(run, left[0]);
    if (run.state.status !== "playing") return false;
  }
  return false;
};
const toExit = (run, avoidKeys = []) => {
  if (run.state.status !== "playing" || !walkBeside(run, run.state.mazeMap.exitPosition, avoidKeys)) return false;
  step(run, run.state.mazeMap.exitPosition);
  return true;
};
const trapStep = (run, link) => {
  const trap = keyToCell(link.trap);
  if (!walkBeside(run, trap)) return false;
  step(run, trap);
  return sameCell(run.state.player, trap) && run.state.status === "playing";
};
const breakPassage = (run, link) => {
  const wall = keyToCell(link.mutation.wall);
  if (!walkBeside(run, wall, [link.trap])) return false;
  if (!run.state.breakTargets.some(({ cell }) => sameCell(cell, wall))) return false;
  run.break(wall);
  inspect(run.state);
  return run.state.status === "playing";
};
const takeChest = (run, link, reward) => {
  const map = run.state.mazeMap;
  if (!map.chest || !walk(run, map.chest, [link.trap]) || !run.state.rewardChoicePending) return false;
  run.choose(reward);
  inspect(run.state);
  return run.state.status === "playing";
};
const SCENARIOS = {
  "lights->trap": (run, link) => collectLights(run, [link.trap]) && earlyVisit(run, link) && trapStep(run, link) && toExit(run),
  "trap->lights": (run, link) => trapStep(run, link) && earlyVisit(run, link) && collectLights(run) && toExit(run),
  "lights->pickaxe": (run, link) => takeChest(run, link, "pickaxe") && collectLights(run, [link.trap]) && breakPassage(run, link) && toExit(run, [link.trap]),
  "pickaxe->lights": (run, link) => takeChest(run, link, "pickaxe") && breakPassage(run, link) && collectLights(run, [link.trap]) && toExit(run, [link.trap]),
  "secondChance->trap": (run, link) => takeChest(run, link, "second-chance") && trapStep(run, link) && collectLights(run) && toExit(run),
};
// The portal visited early: once, while something is still missing; the Route must go on.
function earlyVisit(run, link) {
  const g = run.state;
  if (g.status !== "playing" || g.portalActive) return true;
  if (!walkBeside(run, g.mazeMap.exitPosition, [link.trap])) return run.state.status === "playing";
  step(run, run.state.mazeMap.exitPosition);
  return run.state.status === "playing";
}
const runtimeSample = [2, 3].flatMap((route) => DIFFICULTIES.flatMap((difficulty) => allMaps.filter((m) => m.route === route && m.difficulty === difficulty).slice(0, RUNTIME_PER_COMBINATION)));
for (const name of Object.keys(SCENARIOS)) runtime.scenarios[name] = { attempted: 0, completed: 0, won: 0, portalActivations: 0, passageCompletedBy: {} };
for (const { seed, route, difficulty } of runtimeSample) {
  for (const [name, scenario] of Object.entries(SCENARIOS)) {
    const row = runtime.scenarios[name];
    row.attempted += 1;
    for (const m of [1, 0, -1]) {
      margin = m;
      const run = NOW.mount({ seed, difficulty, routeNumber: route });
      trace.events.length = 0;
      currentRun = { seed, route, difficulty, scenario: name, margin: m };
      dctx = buildDynamicContext(run.state.mazeMap, difficulty, { requirePassage: true });
      dctxOld = buildDynamicContext(run.state.mazeMap, difficulty, { requirePassage: false });
      inspect(run.state);
      const link = run.state.mazeMap.trapLinks[0];
      scenario(run, link);
      const g = run.state;
      const activations = trace.events.filter((e) => e.type === "PORTAL_ACTIVATED").length;
      if (activations > 1) runtime.portalActivatedTwice += 1;
      if (g.status === "won" && activations !== 1) runtime.wonWithoutActivation += 1;
      if (g.status !== "won") continue;
      row.won += 1;
      row.completed += 1;
      row.portalActivations += activations;
      tally(row.passageCompletedBy, g.trapOpenedWalls.includes(link.mutation.wall) ? "trap" : g.brokenWall === link.mutation.wall ? "pickaxe" : "other");
      break;
    }
    margin = 1;
  }
  // restart, and the next Route, after both prerequisites
  {
    const run = NOW.mount({ seed, difficulty, routeNumber: route });
    dctx = null;
    const link = run.state.mazeMap.trapLinks[0];
    runtime.restart.attempted += 1;
    if (trapStep(run, link)) {
      runtime.restart.reached += 1;
      run.restart();
      const g = run.state;
      if (g.objectives.passage.complete === false && g.objectives.lights.collected === 0 && !g.portalActive && g.trapOpenedWalls.length === 0) runtime.restart.fresh += 1;
    }
  }
  if (route === 2) {
    const run = NOW.mount({ seed, difficulty, routeNumber: 2 });
    const link = run.state.mazeMap.trapLinks[0];
    runtime.nextRoute.attempted += 1;
    trapStep(run, link);
    for (let i = 0; i < 200 && run.state.status === "playing"; i += 1) {
      const g = run.state;
      if (g.rewardChoicePending) {
        run.choose("pickaxe");
        continue;
      }
      const toward = pathBetween(g.player, g.guardian, g.walls);
      if (!toward || toward.length < 2) break;
      run.stepTo(toward[1]);
    }
    if (run.state.status !== "playing") {
      const next = run.nextSession({ seed: seed + 1 }).state;
      if (next.routeNumber === 3 && next.objectives.passage.required && !next.objectives.passage.complete && next.objectives.lights.collected === 0 && !next.portalActive) runtime.nextRoute.fresh += 1;
    }
  }
}
for (const [name, row] of Object.entries(runtime.scenarios)) log(`   ${name}: won ${row.won}/${row.attempted} · passage by ${JSON.stringify(row.passageCompletedBy)}`);
log(`   early visits ${runtime.earlyVisits} (wins ${runtime.earlyWins}) · differential ${runtime.differential.transitions} (unsound ${runtime.differential.unsound}: objective ${runtime.differential.objectiveUnsound}, held-door ${runtime.differential.heldDoorArmed}, defender-model gap ${runtime.differential.defenderModelGap})`);

// D3 · the reference solver's one pre-existing gap, measured on the v1 tree and on this tree alike
const referenceGap = {};
for (const [label, rev] of QUICK ? [] : [["v1-9f8ebb5", V1], ["this-tree", null]]) {
  const rt = loadRouteRuntime({ directDifficulty: true, rev });
  const row = { transitions: 0, unsound: 0, heldDoorArmed: 0, other: 0 };
  for (const difficulty of DIFFICULTIES) for (let i = 0; i < 40; i += 1) {
    const seed = 6_400 + i;
    const run = rt.mount({ seed, difficulty, routeNumber: 1 });
    const map = run.state.mazeMap;
    dctx = buildDynamicContext(map, difficulty, {});
    for (let k = 0; k < 40 && run.state.status === "playing" && !run.state.chestOpened; k += 1) {
      const g = run.state;
      if (sameCell(g.player, map.exitPosition)) break;
      const blocked = new Set([...g.walls, cellKey(g.guardian), cellKey(g.sentinel), ...(map.chest ? [cellKey(map.chest)] : [])]);
      const path = pathBetween(g.player, map.exitPosition, blocked);
      if (!path || path.length < 2) break;
      const pre = numericOf(g);
      const actionIndex = ACTIONS.findIndex((a) => a.row === path[1].row - g.player.row && a.col === path[1].col - g.player.col);
      run.stepTo(path[1]);
      const after = run.state;
      if (after.chestOpened) break;
      const support = dynamicSuccessorSet(dctx, pre, actionIndex);
      row.transitions += 1;
      const sound = after.status === "lost" ? support?.hasLoss : after.status === "won" ? support?.hasWin : support && support.states.includes(packDynamicState(dctx, numericOf(after)));
      if (sound) continue;
      row.unsound += 1;
      const post = numericOf(after);
      const armedNow = after.triggeredTrapSet.size > g.triggeredTrapSet.size;
      const samePieces = (support?.states ?? []).map(decodeKey).some((x) => x.e === post.e && x.h === post.h && x.s === post.s && x.lights === post.lights && x.traps === post.traps);
      if (after.status === "playing" && armedNow && g.sentinelTarget && sameCell(g.sentinelTarget, after.player) && samePieces) row.heldDoorArmed += 1;
      else row.other += 1;
    }
  }
  referenceGap[label] = row;
}
log(`   reference gap (portal rush, Route 1): ${JSON.stringify(referenceGap)}`);

// =================================================================================================
// verdict
// =================================================================================================
const scenarioRows = Object.values(runtime.scenarios);
const checks = {
  noGenerationChange: generation.changedVsBase === 0 && generation.throws === 0 && generation.sameAsBase === 1080,
  everyMapLinked: generation.linkedMaps === 1080,
  route1StructurallyV1: structure.standardCompletable === structure.standardMaps,
  dependentObjectivesStructurallyCompletable: structure.completable === structure.dependentMaps && structure.dependentMaps === 720,
  noCircularDependency: structure.circular === 0,
  noImpossibleObjective: structure.impossible === 0,
  trapAlwaysReachableWithoutThePassage: structure.trapReachable === structure.dependentMaps,
  bothOrdersRepresentable: structure.bothOrders === structure.dependentMaps,
  secondChanceNeverNeedsThePickaxe: structure.secondChancePath === structure.dependentMaps,
  inspectorAgreesPassageOpenable: structure.inspector.notSolvable === 0 && structure.inspector.invalid === 0,
  route1UnchangedAdversarially: adversarial.route1Changed === 0,
  noNewImpossibleFromStructure: adversarial.newlyImpossible.every((r) => r.structuralWitness && !r.circular),
  route1RuntimeEquivalent: runtime.route1.mapsChanged === 0 && runtime.route1.games === 360,
  everyScenarioWonSomewhere: scenarioRows.every((r) => r.won > 0),
  bothOrdersObserved: runtime.scenarios["lights->trap"].won > 0 && runtime.scenarios["trap->lights"].won > 0 && runtime.scenarios["lights->pickaxe"].won > 0 && runtime.scenarios["pickaxe->lights"].won > 0,
  portalActivatedOnceExactly: runtime.portalActivatedTwice === 0 && runtime.wonWithoutActivation === 0,
  earlyPortalNeverWins: runtime.earlyVisits > 0 && runtime.earlyWins === 0,
  restartAndNextRouteFresh: runtime.restart.reached > 0 && runtime.restart.fresh === runtime.restart.reached && runtime.nextRoute.fresh > 0,
  everyPlayingRenderValid: runtime.invalidPlayingRenders === 0,
  passageTruthIsTheTopology: runtime.passageTruthMismatch === 0,
  solverSoundAgainstHook: runtime.differential.objectiveUnsound === 0 && runtime.differential.transitions > 0 && runtime.differential.wins > 0,
  // The reference solver's gap on a portal rush is the same on the v1 tree and here: it predates Rota 2.0.
  referenceGapIsPreExisting: QUICK || sameJson(referenceGap["v1-9f8ebb5"], referenceGap["this-tree"]),
};
const allPass = Object.values(checks).every(Boolean);
for (const [name, pass] of Object.entries(checks)) log(`${pass ? "PASS" : "FAIL"}  ${name}`);
log(`\nadversarial (pre-Chest, ${adversarial.maps} maps): traps-01 ${JSON.stringify(adversarial.traps01)} → objectives-02 ${JSON.stringify(adversarial.objectives02)} · ${JSON.stringify(adversarial.transitions)}`);
log(allPass ? "ROTA2_OBJECTIVES_CENSUS_OK" : "ROTA2_OBJECTIVES_CENSUS_FAILED");

if (QUICK) {
  log(JSON.stringify(runtime.differential.examples, null, 1).slice(0, 6000));
  log(JSON.stringify(structure.inspector, null, 1).slice(0, 2000));
  process.exit(allPass ? 0 : 1);
}
const EVIDENCE = openEvidence(process.env.ROUTE_VALIDATION_OUT ?? "docs/archive/rota2-dependent-objectives-02");
EVIDENCE.write(
  "census.json",
  {
    mission: "ROTA2-DEPENDENT-OBJECTIVES-02",
    base: BASE,
    allPass,
    checks,
    sizes: { routes: ROUTES, difficulties: DIFFICULTIES, mapsPerCombination: MAPS_PER_COMBINATION, solverPerCombination: SOLVER_PER_COMBINATION, runtimePerCombination: RUNTIME_PER_COMBINATION },
    generation,
    structure,
    adversarial,
    runtime,
    referenceGap,
    run: { elapsedMs: Math.round(performance.now() - started) },
  },
  { metadata: ["run", "generation.evaluation.microsecondsPerEvaluation"] },
);
process.exitCode = EVIDENCE.finish({ ok: allPass });
