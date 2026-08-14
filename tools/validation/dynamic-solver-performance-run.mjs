/** Profile the reference and packed solvers on seed 8801008. */
import fs from "node:fs";
import path from "node:path";
import {
  API,
  ACTIONS,
  setSeed,
  buildContext,
  initialState,
  encode,
  hunterSupport,
  existential,
  guaranteed,
} from "./dynamic-solver.mjs";
import { explorePacked } from "./dynamic-solver-packed-graph.mjs";
import { solvePackedGraph } from "./dynamic-solver-packed-solve.mjs";
import { analyzePackedScc } from "./dynamic-solver-packed-scc.mjs";

const OUT = path.resolve(
  process.env.ROUTE_VALIDATION_OUT ?? "docs/archive/route-dynamic-solvability-01",
);
const TARGET = path.join(OUT, "solver-performance.json");
const REFERENCE_BUDGET = Number(process.argv.includes("--reference-budget")
  ? process.argv[process.argv.indexOf("--reference-budget") + 1]
  : 5_000);
const PACKED_BUDGET = Number(process.argv.includes("--packed-budget")
  ? process.argv[process.argv.indexOf("--packed-budget") + 1]
  : 120_000);

const kOf = (position) => API.posKey(position);
const same = (left, right) => left.row === right.row && left.col === right.col;
const toCell = (key) => {
  const [row, col] = key.split(",").map(Number);
  return { row, col };
};

function profiledSuccessors(ctx, state, action, profile) {
  const { map, difficulty, zone, accessKeys, lightKeys, trapKeys } = ctx;
  const from = toCell(state.e);
  const next = { row: from.row + action.row, col: from.col + action.col };
  if (next.row < 0 || next.col < 0 || next.row >= 9 || next.col >= 9) return null;
  const nextKey = kOf(next);
  if (map.walls.has(nextKey)) return null;
  if (nextKey === state.h || nextKey === state.s) return { outcomes: [{ terminal: "LOSS" }] };
  let lights = state.lights;
  const lightIndex = lightKeys.indexOf(nextKey);
  if (lightIndex >= 0) lights |= 1 << lightIndex;
  let traps = state.traps;
  const trapIndex = trapKeys.indexOf(nextKey);
  if (trapIndex >= 0) traps |= 1 << trapIndex;
  if (nextKey === kOf(map.exitPosition) && lights === (1 << lightKeys.length) - 1) {
    return { outcomes: [{ terminal: "WIN" }] };
  }
  const armed = new Set();
  for (let index = 0; index < trapKeys.length; index += 1) {
    if (traps & (1 << index)) armed.add(trapKeys[index]);
  }
  const outcomes = [];
  const seen = new Set();
  for (const hunter of hunterSupport(
    toCell(state.h), next, map.exitPosition, map.walls, difficulty, armed,
    toCell(state.s),
  )) {
    if (same(hunter, next)) {
      if (!seen.has("LOSS")) {
        seen.add("LOSS");
        outcomes.push({ terminal: "LOSS" });
      }
      continue;
    }
    const sentinelBefore = {
      position: toCell(state.s),
      target: state.t >= 0 ? toCell(accessKeys[state.t]) : null,
      commitLeft: state.c,
    };
    const after = API.decideSentinelMove(
      sentinelBefore, next, map.exitPosition, map.walls, zone, 3, armed,
    );
    const sentinelPosition = same(after.position, hunter) &&
      !same(after.position, sentinelBefore.position)
      ? sentinelBefore.position
      : after.position;
    if (same(sentinelPosition, next)) {
      if (!seen.has("LOSS")) {
        seen.add("LOSS");
        outcomes.push({ terminal: "LOSS" });
      }
      continue;
    }
    const nextState = {
      e: nextKey,
      h: kOf(hunter),
      s: kOf(sentinelPosition),
      t: after.target ? accessKeys.indexOf(kOf(after.target)) : -1,
      c: after.commitLeft,
      lights,
      traps,
    };
    const encodingStarted = performance.now();
    const key = encode(nextState);
    profile.encodingInsideSuccessorsMs += performance.now() - encodingStarted;
    if (seen.has(key)) continue;
    seen.add(key);
    outcomes.push({ state: nextState });
  }
  return { outcomes };
}

function profileReference(ctx, budget) {
  const profile = {
    encodingInsideSuccessorsMs: 0,
    encodingGraphKeysMs: 0,
    successorEnumerationMs: 0,
    visitedLookupMs: 0,
    queueOperationsMs: 0,
    graphStorageMs: 0,
  };
  const heapBefore = process.memoryUsage().heapUsed;
  const started = performance.now();
  const start = initialState(ctx);
  let timer = performance.now();
  const startKey = encode(start);
  profile.encodingGraphKeysMs += performance.now() - timer;
  const nodes = new Map([[startKey, start]]);
  const edges = new Map();
  const queue = [startKey];
  let transitions = 0;
  let head = 0;
  let truncated = false;
  let peakFrontier = 1;
  while (head < queue.length) {
    if (nodes.size > budget) {
      truncated = true;
      break;
    }
    timer = performance.now();
    const key = queue[head++];
    profile.queueOperationsMs += performance.now() - timer;
    timer = performance.now();
    const state = nodes.get(key);
    profile.visitedLookupMs += performance.now() - timer;
    const list = [];
    for (const action of ACTIONS) {
      timer = performance.now();
      const result = profiledSuccessors(ctx, state, action, profile);
      profile.successorEnumerationMs += performance.now() - timer;
      if (!result) continue;
      const outcomeKeys = [];
      let hasWin = false;
      let hasLoss = false;
      for (const outcome of result.outcomes) {
        transitions += 1;
        if (outcome.terminal === "WIN") {
          hasWin = true;
          outcomeKeys.push("WIN");
          continue;
        }
        if (outcome.terminal === "LOSS") {
          hasLoss = true;
          outcomeKeys.push("LOSS");
          continue;
        }
        timer = performance.now();
        const outcomeKey = encode(outcome.state);
        profile.encodingGraphKeysMs += performance.now() - timer;
        outcomeKeys.push(outcomeKey);
        timer = performance.now();
        const known = nodes.has(outcomeKey);
        profile.visitedLookupMs += performance.now() - timer;
        if (!known) {
          timer = performance.now();
          nodes.set(outcomeKey, outcome.state);
          profile.visitedLookupMs += performance.now() - timer;
          timer = performance.now();
          queue.push(outcomeKey);
          profile.queueOperationsMs += performance.now() - timer;
        }
      }
      timer = performance.now();
      list.push({ action: action.name, outcomeKeys, hasWin, hasLoss });
      profile.graphStorageMs += performance.now() - timer;
    }
    timer = performance.now();
    edges.set(key, list);
    profile.graphStorageMs += performance.now() - timer;
    peakFrontier = Math.max(peakFrontier, queue.length - head);
  }
  const explorationMs = performance.now() - started;
  timer = performance.now();
  const existentialSet = existential({ start: startKey, nodes, edges });
  const existentialMs = performance.now() - timer;
  timer = performance.now();
  const guaranteedSet = guaranteed({ start: startKey, nodes, edges });
  const guaranteedMs = performance.now() - timer;
  const heapAfter = process.memoryUsage().heapUsed;
  const totalMs = performance.now() - started;
  const encodingMs = profile.encodingInsideSuccessorsMs + profile.encodingGraphKeysMs;
  return {
    graph: { start: startKey, nodes, edges, transitions, truncated, explored: nodes.size },
    metrics: {
      budget,
      states: nodes.size,
      transitions,
      truncated,
      frontier: queue.length - head,
      peakFrontier,
      elapsedMs: totalMs,
      explorationMs,
      statesPerSecond: nodes.size / (totalMs / 1000),
      transitionsPerSecond: transitions / (totalMs / 1000),
      encodingMs,
      encodingTimePercent: encodingMs / totalMs * 100,
      successorEnumerationMs: profile.successorEnumerationMs,
      successorExclusiveMs: Math.max(0, profile.successorEnumerationMs - profile.encodingInsideSuccessorsMs),
      successorTimePercent: profile.successorEnumerationMs / totalMs * 100,
      visitedMs: profile.visitedLookupMs,
      visitedTimePercent: profile.visitedLookupMs / totalMs * 100,
      queueMs: profile.queueOperationsMs,
      graphStorageMs: profile.graphStorageMs,
      existentialMs,
      guaranteedMs,
      sccMs: null,
      sccAvailability: "OLD_IMPLEMENTATION_HAS_NO_SCC",
      heapBeforeBytes: heapBefore,
      heapAfterBytes: heapAfter,
      heapDeltaBytes: heapAfter - heapBefore,
      estimatedStringKeyBytes: [...nodes.keys()].reduce((sum, key) => sum + key.length * 2, 0),
      initialExistential: existentialSet.has(startKey),
      initialGuaranteed: guaranteedSet.has(startKey),
    },
  };
}

function summarizePacked(graph, solved, scc) {
  const totalMs = graph.elapsedMs + solved.profile.totalMs + scc.elapsedMs;
  return {
    budget: PACKED_BUDGET,
    states: graph.explored,
    processedStates: graph.processedNodes,
    transitions: graph.transitions,
    truncated: graph.truncated,
    resourceLimit: graph.resourceLimit,
    frontier: graph.frontier,
    peakFrontier: graph.peakFrontier,
    elapsedMs: totalMs,
    explorationMs: graph.elapsedMs,
    statesPerSecond: graph.explored / (graph.elapsedMs / 1000),
    transitionsPerSecond: graph.transitions / (graph.elapsedMs / 1000),
    encodingMs: graph.profile.packingMs,
    encodingTimePercent: graph.profile.packingMs / graph.elapsedMs * 100,
    successorEnumerationMs: graph.profile.successorEnumerationMs,
    successorTimePercent: graph.profile.successorEnumerationMs / graph.elapsedMs * 100,
    visitedMs: graph.profile.visitedLookupMs,
    visitedTimePercent: graph.profile.visitedLookupMs / graph.elapsedMs * 100,
    queueMs: graph.profile.queueOperationsMs,
    queueImplementation: "implicit FIFO by monotonic BFS node ID",
    graphStorageMs: graph.profile.graphStorageMs,
    existentialMs: solved.profile.existentialMs,
    guaranteedMs: solved.profile.guaranteedMs,
    predecessorBuildMs: solved.profile.predecessorBuildMs,
    sccMs: scc.elapsedMs,
    memory: graph.memory,
    initialExistential: Boolean(solved.existentialWinning[graph.startId]),
    initialGuaranteed: Boolean(solved.guaranteedWinning[graph.startId]),
  };
}

console.log(`OLD_IMPLEMENTATION seed 8801008 budget ${REFERENCE_BUDGET}`);
setSeed(8_801_008);
const oldMap = API.generateMaze("easy", 1);
const oldContext = buildContext(oldMap, "easy");
const oldProfile = profileReference(oldContext, REFERENCE_BUDGET);
console.log(`  ${oldProfile.metrics.states} states | ${oldProfile.metrics.elapsedMs.toFixed(1)}ms | ${oldProfile.metrics.statesPerSecond.toFixed(1)} states/s`);

console.log(`PACKED_IMPLEMENTATION seed 8801008 budget ${PACKED_BUDGET}`);
setSeed(8_801_008);
const packedMap = API.generateMaze("easy", 1);
const packedContext = buildContext(packedMap, "easy");
const packedGraph = explorePacked(packedContext, { maxStates: PACKED_BUDGET });
const packedSolved = solvePackedGraph(packedGraph);
const packedScc = analyzePackedScc(packedGraph, packedSolved);
const packedMetrics = summarizePacked(packedGraph, packedSolved, packedScc);
console.log(`  ${packedMetrics.states} states | ${packedMetrics.elapsedMs.toFixed(1)}ms | ${packedMetrics.statesPerSecond.toFixed(1)} states/s`);

const historical = {
  seed: 8_801_008,
  route: 1,
  mode: "easy",
  statesExplored: 120_001,
  budget: 120_000,
  truncated: true,
  elapsedMs: 261_200,
  statesPerSecond: 459,
  result: "INCONCLUSIVE_RESOURCE_LIMIT",
  source: "measurement preserved from the pre-optimization working tree",
};
const output = {
  mission: "ROTA-DYNAMIC-SOLVABILITY-01",
  PRE_CHEST_BASELINE: true,
  generatedAt: new Date().toISOString(),
  seed: 8_801_008,
  route: 1,
  mode: "easy",
  historicalReference: historical,
  OLD_IMPLEMENTATION: oldProfile.metrics,
  PACKED_IMPLEMENTATION: packedMetrics,
  comparison: {
    sameSeedRouteMode: true,
    throughputGainVsHistorical: packedMetrics.statesPerSecond / historical.statesPerSecond,
    throughputGainVsInstrumentedReference: packedMetrics.statesPerSecond / oldProfile.metrics.statesPerSecond,
    exactnessGate: "solver-encoding-equivalence.json gateMet must be true",
  },
  interpretation: "The profile distinguishes canonical encoding from successor enumeration; no bottleneck attribution is inferred from throughput alone.",
};
const serializationStarted = performance.now();
const serializationBytes = Buffer.byteLength(JSON.stringify(output, null, 2));
output.serializationMs = performance.now() - serializationStarted;
output.serializationBytes = serializationBytes;
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(TARGET, JSON.stringify(output, null, 2));
console.log("SOLVER_PERFORMANCE_PROFILE_OK");
