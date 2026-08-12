/**
 * Lossless encoding, key equivalence, successor-set equivalence, and solver
 * attractor equivalence gates for ROTA-DYNAMIC-SOLVABILITY-01.
 */
import fs from "node:fs";
import path from "node:path";
import {
  API,
  ACTIONS,
  setSeed,
  buildContext,
  initialState,
  encode,
  successors,
  existential,
  guaranteed,
} from "./dynamic-solver.mjs";
import {
  numericToCanonical,
  packState,
  unpackState,
  packedStateContract,
} from "./dynamic-solver-packed.mjs";
import { packedSuccessorSet } from "./dynamic-solver-packed-successors.mjs";
import { explorePacked } from "./dynamic-solver-packed-graph.mjs";
import { solvePackedGraph } from "./dynamic-solver-packed-solve.mjs";

const OUT = path.resolve("docs/archive/route-dynamic-solvability-01");
const REPORT_PATH = path.join(OUT, "solver-encoding-equivalence.json");
const MODES = ["easy", "medium", "hard"];
const ROUTES = [1, 2, 3];
const report = {
  mission: "ROTA-DYNAMIC-SOLVABILITY-01",
  PRE_CHEST_BASELINE: true,
  generatedAt: new Date().toISOString(),
};

const makeMap = (seed, difficulty, stage) => {
  setSeed(seed);
  return API.generateMaze(difficulty, stage);
};

function sameCanonical(left, right) {
  return encode(left) === encode(right);
}

function createPrng(seed) {
  let value = seed >>> 0;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return value >>> 0;
  };
}

function controlledAndGeneratedStates(ctx, count) {
  const start = initialState(ctx);
  const base = {
    e: Number(start.e.split(",")[0]) * 9 + Number(start.e.split(",")[1]),
    h: Number(start.h.split(",")[0]) * 9 + Number(start.h.split(",")[1]),
    s: Number(start.s.split(",")[0]) * 9 + Number(start.s.split(",")[1]),
    t: start.t,
    c: start.c,
    lights: start.lights,
    traps: start.traps,
  };
  const states = [];
  for (let cell = 0; cell < 81; cell += 1) {
    states.push({ ...base, e: cell });
    states.push({ ...base, h: cell });
    states.push({ ...base, s: cell });
  }
  const contract = packedStateContract(ctx);
  for (let target = -1; target < contract.accessCount; target += 1) {
    for (let commit = 0; commit <= 3; commit += 1) states.push({ ...base, t: target, c: commit });
  }
  for (let lights = 0; lights < 2 ** contract.lightCount; lights += 1) {
    states.push({ ...base, lights });
  }
  for (let traps = 0; traps < 2 ** contract.trapCount; traps += 1) {
    states.push({ ...base, traps });
  }
  const random = createPrng(0x5eeda11);
  while (states.length < count) {
    states.push({
      e: random() % 81,
      h: random() % 81,
      s: random() % 81,
      t: (random() % (contract.accessCount + 1)) - 1,
      c: random() % 4,
      lights: random() % (2 ** contract.lightCount),
      traps: random() % (2 ** contract.trapCount),
    });
    if ((states.length & 31) === 0) states.push({ ...states[states.length - 1] });
  }
  return states;
}

function runEncodingGate() {
  const contexts = [];
  for (const stage of ROUTES) {
    for (let modeIndex = 0; modeIndex < MODES.length; modeIndex += 1) {
      const mode = MODES[modeIndex];
      const seed = 9_710_000 + stage * 100 + modeIndex;
      contexts.push({ seed, stage, mode, ctx: buildContext(makeMap(seed, mode, stage), mode) });
    }
  }
  let statesTested = 0;
  let roundTripMismatches = 0;
  let falseMerges = 0;
  let falseSplits = 0;
  const samples = [];
  const contracts = [];
  for (const item of contexts) {
    contracts.push({ seed: item.seed, route: item.stage, mode: item.mode, ...packedStateContract(item.ctx) });
    const oldToNew = new Map();
    const newToOld = new Map();
    for (const numeric of controlledAndGeneratedStates(item.ctx, 4_000)) {
      statesTested += 1;
      const canonical = numericToCanonical(numeric);
      const oldKey = encode(canonical);
      const packed = packState(item.ctx, canonical);
      const unpacked = unpackState(item.ctx, packed);
      if (!sameCanonical(canonical, unpacked)) {
        roundTripMismatches += 1;
        if (samples.length < 10) samples.push({ type: "ROUND_TRIP", canonical, packed, unpacked });
      }
      const previousPacked = oldToNew.get(oldKey);
      if (previousPacked !== undefined && previousPacked !== packed) {
        falseSplits += 1;
        if (samples.length < 10) samples.push({ type: "FALSE_SPLIT", oldKey, previousPacked, packed });
      }
      const previousOld = newToOld.get(packed);
      if (previousOld !== undefined && previousOld !== oldKey) {
        falseMerges += 1;
        if (samples.length < 10) samples.push({ type: "FALSE_MERGE", packed, previousOld, oldKey });
      }
      oldToNew.set(oldKey, packed);
      newToOld.set(packed, oldKey);
    }
  }
  return {
    statesTested,
    contextsTested: contexts.length,
    contracts,
    allBoardPositionsTestedPerComponent: true,
    allCommitCountersTested: true,
    allLightMasksTested: true,
    allTrapMasksTested: true,
    roundTripMismatches,
    falseMerges,
    falseSplits,
    samples,
    gateMet: roundTripMismatches === 0 && falseMerges === 0 && falseSplits === 0,
  };
}

function canonicalOutcomeSet(result) {
  if (!result) return null;
  const outcomes = [];
  for (const outcome of result.outcomes) {
    outcomes.push(outcome.terminal ?? encode(outcome.state));
  }
  return [...new Set(outcomes)].sort();
}

function packedOutcomeSet(ctx, result) {
  if (!result) return null;
  const outcomes = result.states.map((key) => encode(unpackState(ctx, key)));
  if (result.hasWin) outcomes.push("WIN");
  if (result.hasLoss) outcomes.push("LOSS");
  return [...new Set(outcomes)].sort();
}

function runSuccessorGate() {
  let pairsTested = 0;
  let mismatches = 0;
  const samples = [];
  const contextResults = [];
  for (const stage of ROUTES) {
    for (let modeIndex = 0; modeIndex < MODES.length; modeIndex += 1) {
      const mode = MODES[modeIndex];
      const seed = 9_720_000 + stage * 100 + modeIndex;
      const ctx = buildContext(makeMap(seed, mode, stage), mode);
      const graph = explorePacked(ctx, { maxStates: 1_200 });
      const localLimit = Math.min(graph.nodes.count, 180);
      let localPairs = 0;
      for (let node = 0; node < localLimit; node += 1) {
        const numeric = graph.nodes.numericState(node);
        const canonical = numericToCanonical(numeric);
        for (let action = 0; action < ACTIONS.length; action += 1) {
          const oldSet = canonicalOutcomeSet(successors(ctx, canonical, ACTIONS[action]));
          const newSet = packedOutcomeSet(ctx, packedSuccessorSet(ctx, numeric, action));
          pairsTested += 1;
          localPairs += 1;
          if (JSON.stringify(oldSet) !== JSON.stringify(newSet)) {
            mismatches += 1;
            if (samples.length < 20) {
              samples.push({ seed, route: stage, mode, state: encode(canonical), action: ACTIONS[action].name, oldSet, newSet });
            }
          }
        }
      }
      contextResults.push({ seed, route: stage, mode, reachableStatesSampled: localLimit, pairsTested: localPairs });
    }
  }
  return {
    pairsTested,
    contextsTested: contextResults.length,
    contextResults,
    mismatches,
    samples,
    identityComparedNotOnlyCount: true,
    gateMet: pairsTested >= 6_000 && mismatches === 0,
  };
}

function referenceGraphFromPacked(graph) {
  const keys = Array.from({ length: graph.nodes.count }, (_, node) =>
    encode(numericToCanonical(graph.nodes.numericState(node))));
  const nodes = new Map(keys.map((key, node) => [key, numericToCanonical(graph.nodes.numericState(node))]));
  const edges = new Map();
  for (let node = 0; node < graph.processedNodes; node += 1) {
    const list = [];
    const actionStart = graph.nodes.actionOffset[node];
    const actionEnd = actionStart + graph.nodes.actionCount[node];
    for (let action = actionStart; action < actionEnd; action += 1) {
      const outcomeKeys = [];
      const flags = graph.actionFlags.data[action];
      if (flags & 1) outcomeKeys.push("WIN");
      if (flags & 2) outcomeKeys.push("LOSS");
      const successorStart = graph.actionSuccessorOffset.data[action];
      const successorEnd = successorStart + graph.actionSuccessorCount.data[action];
      for (let index = successorStart; index < successorEnd; index += 1) {
        outcomeKeys.push(keys[graph.successorIds.data[index]]);
      }
      list.push({
        action: ACTIONS[graph.actionName.data[action]].name,
        outcomeKeys,
        hasWin: Boolean(flags & 1),
        hasLoss: Boolean(flags & 2),
      });
    }
    edges.set(keys[node], list);
  }
  return { start: keys[0], nodes, edges, keys };
}

function runAttractorGate() {
  let statesCompared = 0;
  let existentialMismatches = 0;
  let guaranteedMismatches = 0;
  const cases = [];
  const samples = [];
  for (let modeIndex = 0; modeIndex < MODES.length; modeIndex += 1) {
    const mode = MODES[modeIndex];
    const seed = 9_730_000 + modeIndex;
    const ctx = buildContext(makeMap(seed, mode, 1), mode);
    const graph = explorePacked(ctx, { maxStates: 1_500 });
    const solved = solvePackedGraph(graph);
    const reference = referenceGraphFromPacked(graph);
    const oldExistential = existential(reference);
    const oldGuaranteed = guaranteed(reference);
    let localExistential = 0;
    let localGuaranteed = 0;
    for (let node = 0; node < graph.nodes.count; node += 1) {
      statesCompared += 1;
      const key = reference.keys[node];
      if (oldExistential.has(key) !== Boolean(solved.existentialWinning[node])) {
        existentialMismatches += 1;
        localExistential += 1;
        if (samples.length < 20) samples.push({ type: "EXISTENTIAL", seed, mode, state: key });
      }
      if (oldGuaranteed.has(key) !== Boolean(solved.guaranteedWinning[node])) {
        guaranteedMismatches += 1;
        localGuaranteed += 1;
        if (samples.length < 20) samples.push({ type: "GUARANTEED", seed, mode, state: key });
      }
    }
    cases.push({ seed, mode, states: graph.nodes.count, existentialMismatches: localExistential, guaranteedMismatches: localGuaranteed });
  }
  return {
    statesCompared,
    cases,
    existentialMismatches,
    guaranteedMismatches,
    samples,
    gateMet: existentialMismatches === 0 && guaranteedMismatches === 0,
  };
}

console.log("ENCODING EQUIVALENCE");
const encoding = runEncodingGate();
console.log(`  states ${encoding.statesTested} | round-trip ${encoding.roundTripMismatches} | merges ${encoding.falseMerges} | splits ${encoding.falseSplits}`);
console.log("SUCCESSOR SET EQUIVALENCE");
const successorSets = runSuccessorGate();
console.log(`  pairs ${successorSets.pairsTested} | mismatches ${successorSets.mismatches}`);
console.log("ATTRACTOR EQUIVALENCE");
const attractors = runAttractorGate();
console.log(`  states ${attractors.statesCompared} | existential ${attractors.existentialMismatches} | guaranteed ${attractors.guaranteedMismatches}`);

const gateMet = encoding.gateMet && successorSets.gateMet && attractors.gateMet;
const serializationStarted = performance.now();
const output = {
  ...report,
  claim: "oldStringKey(A) == oldStringKey(B) iff packedKey(A) == packedKey(B); optimized successors and attractors are identity-equivalent to the reference implementation.",
  encoding,
  successorSets,
  attractors,
  gateMet,
};
const serializationBytes = Buffer.byteLength(JSON.stringify(output, null, 2));
output.serializationMs = performance.now() - serializationStarted;
output.serializationBytes = serializationBytes;
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(REPORT_PATH, JSON.stringify(output, null, 2));
console.log(gateMet ? "SOLVER_ENCODING_EQUIVALENCE_OK" : "SOLVER_ENCODING_EQUIVALENCE_FAILED");
if (!gateMet) process.exitCode = 1;
