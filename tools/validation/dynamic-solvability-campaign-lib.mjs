/** Shared resumable campaign helpers for the pre-chest dynamic baseline. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  API,
  setSeed,
  buildContext,
  encode,
} from "./dynamic-solver.mjs";
import {
  packState,
  packedStateContract,
} from "./dynamic-solver-packed.mjs";
import { explorePacked } from "./dynamic-solver-packed-graph.mjs";
import {
  solvePackedGraph,
  packedWitness,
  classifyPacked,
  guaranteedPolicySummary,
} from "./dynamic-solver-packed-solve.mjs";
import { analyzePackedScc } from "./dynamic-solver-packed-scc.mjs";
import { key, eq, neighbors, bfs } from "./route-lab.mjs";

export const OUT = path.resolve("docs/archive/route-dynamic-solvability-01");
export const REPORT = {
  mission: "ROTA-DYNAMIC-SOLVABILITY-01",
  PRE_CHEST_BASELINE: true,
};
export const MODES = ["easy", "medium", "hard"];
export const ROUTES = [1, 2, 3];

const CONTRACT_FILES = [
  "tools/validation/dynamic-solver.mjs",
  "tools/validation/dynamic-solver-packed.mjs",
  "tools/validation/dynamic-solver-packed-successors.mjs",
  "tools/validation/dynamic-solver-packed-graph.mjs",
  "tools/validation/dynamic-solver-packed-solve.mjs",
  "tools/validation/dynamic-solver-packed-scc.mjs",
  "src/games/escape-maze/useEscapeMaze.ts",
  "src/engine/difficulty.ts",
];

export function hashValue(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function hashFiles(files = CONTRACT_FILES) {
  const hash = crypto.createHash("sha256");
  for (const file of files) {
    hash.update(file);
    hash.update(fs.readFileSync(path.resolve(file)));
  }
  return hash.digest("hex");
}

export function campaignIdentity(name, config) {
  const contractHash = hashFiles();
  const configHash = hashValue(JSON.stringify(config));
  return {
    name,
    solverRuntimeContractHash: contractHash,
    configHash,
    id: `${name}-${hashValue(`${contractHash}:${configHash}`).slice(0, 16)}`,
  };
}

export function assertEquivalenceGate() {
  const gatePath = path.join(OUT, "solver-encoding-equivalence.json");
  const gate = JSON.parse(fs.readFileSync(gatePath, "utf8"));
  if (!gate.gateMet) throw new Error("Packed solver campaign blocked: equivalence gate is not met");
  return {
    path: "docs/archive/route-dynamic-solvability-01/solver-encoding-equivalence.json",
    generatedAt: gate.generatedAt,
    statesTested: gate.encoding.statesTested,
    successorPairsTested: gate.successorSets.pairsTested,
    attractorStatesCompared: gate.attractors.statesCompared,
  };
}

export function writeJsonAtomic(target, value) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temporary, JSON.stringify(value, null, 2));
  fs.renameSync(temporary, target);
}

export function makeMap(seed, difficulty, stage) {
  setSeed(seed);
  return API.generateMaze(difficulty, stage);
}

const kOf = (position) => API.posKey(position);

/** Replays the exact naive agent that produced the archived suspect records. */
export function reconstructSuspiciousState(archived) {
  const map = makeMap(archived.seed, archived.mode, archived.route);
  const zone = API.computePortalDefenceZone(map.playerStart, map.exitPosition, map.walls);
  let sentinel = API.createSentinelState(map, zone);
  let hunter = { ...map.guardianStart };
  let player = { ...map.playerStart };
  const remaining = map.collectibleStars.map((star) => ({ ...star }));
  const armed = new Set();
  const sentinelHistory = [];
  let terminal = null;
  let turns = 0;
  for (let turn = 1; turn <= 160 && !terminal; turn += 1) {
    turns = turn;
    const goal = remaining.length ? remaining[0] : map.exitPosition;
    const toGoal = bfs(goal, map.walls);
    const options = neighbors(player, map.walls).filter(
      (next) => !eq(next, hunter) && !eq(next, sentinel.position),
    );
    if (!options.length) {
      terminal = "NO_LEGAL_AGENT_MOVE";
      break;
    }
    options.sort((left, right) => {
      const bonus = (cell) =>
        map.traps.some((trap) => eq(trap, cell)) && !armed.has(kOf(cell)) ? -1 : 0;
      return ((toGoal.get(key(left)) ?? 99) + bonus(left)) -
        ((toGoal.get(key(right)) ?? 99) + bonus(right));
    });
    player = options[0];
    if (map.traps.some((trap) => eq(trap, player)) && !armed.has(kOf(player))) {
      armed.add(kOf(player));
    }
    const light = remaining.findIndex((candidate) => eq(candidate, player));
    if (light >= 0) remaining.splice(light, 1);
    if (!remaining.length && eq(player, map.exitPosition)) {
      terminal = "WIN";
      break;
    }
    hunter = API.chooseGuardianMove(
      hunter, player, map.exitPosition, map.walls, archived.mode, armed,
    );
    if (eq(hunter, player)) {
      terminal = "LOSS_HUNTER";
      break;
    }
    const previousSentinel = sentinel;
    sentinel = API.decideSentinelMove(
      sentinel, player, map.exitPosition, map.walls, zone, 3, armed,
    );
    if (eq(sentinel.position, hunter) && kOf(sentinel.position) !== kOf(previousSentinel.position)) {
      sentinel = previousSentinel;
    }
    sentinelHistory.push(sentinel.target ? kOf(sentinel.target) : "home");
    if (eq(sentinel.position, player)) {
      terminal = "LOSS_SENTINEL";
      break;
    }
  }
  if (!terminal) terminal = "TURN_LIMIT";

  let lights = 0;
  for (let index = 0; index < map.collectibleStars.length; index += 1) {
    if (!remaining.some((candidate) => eq(candidate, map.collectibleStars[index]))) lights |= 1 << index;
  }
  let traps = 0;
  for (let index = 0; index < map.traps.length; index += 1) {
    if (armed.has(kOf(map.traps[index]))) traps |= 1 << index;
  }
  const accessKeys = zone.accesses.map(kOf);
  const canonicalState = {
    e: kOf(player),
    h: kOf(hunter),
    s: kOf(sentinel.position),
    t: sentinel.target ? accessKeys.indexOf(kOf(sentinel.target)) : -1,
    c: sentinel.commitLeft,
    lights,
    traps,
  };
  const tail = sentinelHistory.slice(-24);
  const alternatingBetween = [...new Set(tail)];
  const checks = {
    portal: kOf(map.exitPosition) === archived.portal,
    accesses: JSON.stringify(accessKeys) === JSON.stringify(archived.accesses),
    activeTraps: JSON.stringify([...armed]) === JSON.stringify(archived.activeTraps),
    lightsLeft: remaining.length === archived.lightsLeft,
    alternatingBetween:
      JSON.stringify(alternatingBetween) === JSON.stringify(archived.alternatingBetween),
  };
  return {
    method: "exact replay of tools/validation/trap-strategy-closeout.mjs naive agent",
    sourceWasFullState: false,
    terminal,
    turns,
    canonicalState,
    stateKey: encode(canonicalState),
    sentinelTail: tail,
    reconstructed: {
      portal: kOf(map.exitPosition),
      accesses: accessKeys,
      activeTraps: [...armed],
      lightsLeft: remaining.length,
      alternatingBetween,
    },
    archived: {
      portal: archived.portal,
      accesses: archived.accesses,
      activeTraps: archived.activeTraps,
      lightsLeft: archived.lightsLeft,
      alternatingBetween: archived.alternatingBetween,
    },
    checks,
    metadataMatchesArchive: Object.values(checks).every(Boolean),
  };
}

function witnessMetrics(witness) {
  if (!witness) return null;
  const explorerVisits = new Map();
  let accessSwitches = 0;
  let trapActivations = 0;
  let previousTarget = null;
  let previousTraps = 0;
  for (const step of witness) {
    if (step.state === "WIN") continue;
    const [explorer, , , target, , , traps] = step.state.split("|");
    explorerVisits.set(explorer, (explorerVisits.get(explorer) ?? 0) + 1);
    if (previousTarget !== null && target !== previousTarget) accessSwitches += 1;
    if (Number(traps) !== previousTraps) trapActivations += 1;
    previousTarget = target;
    previousTraps = Number(traps);
  }
  return {
    turns: witness.length,
    accessSwitches,
    trapActivations,
    revisitedExplorerCells: [...explorerVisits.values()].filter((count) => count > 1).length,
    backtrackingOrRevisits: [...explorerVisits.values()].some((count) => count > 1),
  };
}

function compactScc(scc) {
  if (!scc) return null;
  return {
    completeGraph: true,
    componentCount: scc.componentCount,
    largestComponentStates: scc.largestComponentStates,
    cyclicComponents: scc.cyclicComponents,
    closedNonWinningComponents: scc.closedNonWinningComponents.slice(0, 100),
    closedNonWinningComponentCount: scc.closedNonWinningComponents.length,
    closedNonWinningStates: scc.closedNonWinningStates,
    elapsedMs: scc.elapsedMs,
  };
}

function trapRole(mainGraph, mainSolved, noTrapGraph, noTrapSolved) {
  const mainWin = Boolean(mainSolved.existentialWinning[mainGraph.startId]);
  const withoutTrapWin = Boolean(noTrapSolved.existentialWinning[noTrapGraph.startId]);
  if (mainWin && !withoutTrapWin) return "TRAP_REQUIRED_FOR_WIN_PRE_CHEST";
  if (withoutTrapWin) {
    let activeTrapWinningState = false;
    for (let node = 0; node < mainGraph.nodes.count; node += 1) {
      if (mainGraph.nodes.traps[node] !== 0 && mainSolved.existentialWinning[node]) {
        activeTrapWinningState = true;
        break;
      }
    }
    return activeTrapWinningState
      ? "TRAP_OPTIONAL_PRE_CHEST"
      : "TRAP_NOT_NEEDED_PRE_CHEST";
  }
  return "TRAP_NOT_NEEDED_PRE_CHEST";
}

export function analyzeCase({ seed, route, mode, limits, archived = null, includeTrapVariant = false }) {
  const caseStarted = performance.now();
  const map = makeMap(seed, mode, route);
  const ctx = buildContext(map, mode);
  const contract = packedStateContract(ctx);
  const graph = explorePacked(ctx, limits);
  const solved = solvePackedGraph(graph);
  const classification = classifyPacked(graph, solved);
  const witness = packedWitness(graph);
  let scc = null;
  if (!graph.truncated) scc = analyzePackedScc(graph, solved);

  let suspicious = null;
  let auxiliaryClassifications = [];
  if (archived) {
    const reconstruction = reconstructSuspiciousState(archived);
    const suspiciousKey = packState(ctx, reconstruction.canonicalState);
    const nodeId = graph.nodes.ids.get(suspiciousKey);
    const graphSupportsExactClassification = !graph.truncated && nodeId !== undefined;
    const existential = graphSupportsExactClassification
      ? Boolean(solved.existentialWinning[nodeId])
      : null;
    const guaranteed = graphSupportsExactClassification
      ? Boolean(solved.guaranteedWinning[nodeId])
      : null;
    let component = null;
    if (scc && nodeId !== undefined) {
      const componentId = scc.component[nodeId];
      const closed = scc.closedNonWinningComponents.find((item) => item.componentId === componentId);
      component = { componentId, closedNonWinning: Boolean(closed), statesIfClosed: closed?.states ?? null };
    }
    suspicious = {
      ...reconstruction,
      packedKey: suspiciousKey,
      presentInInitialReachableGraph: nodeId !== undefined,
      nodeId: nodeId ?? null,
      exactClassificationAvailable: graphSupportsExactClassification,
      existential,
      guaranteed,
      winningExit: existential,
      deadRegion: existential === false,
      trapState: reconstruction.canonicalState.traps,
      sentinelCommitment: {
        targetAccess: reconstruction.canonicalState.t,
        commitTurnsRemaining: reconstruction.canonicalState.c,
      },
      component,
    };
    if (guaranteed) auxiliaryClassifications.push("AGENT_OSCILLATION_WITH_GUARANTEED_EXIT");
    else if (existential) auxiliaryClassifications.push("AGENT_OSCILLATION_WITH_LUCK_DEPENDENCE");
    else if (existential === false) auxiliaryClassifications.push("TRUE_DYNAMIC_LOCK_PRE_CHEST");
  }
  if (!graph.truncated && !solved.existentialWinning[graph.startId]) {
    auxiliaryClassifications.push("INITIAL_UNSOLVABLE_PRE_CHEST");
  }
  if (!graph.truncated && solved.existentialCount < graph.nodes.count) {
    auxiliaryClassifications.push("PLAYER_REACHABLE_NON_WINNING_REGION_PRE_CHEST");
  }
  auxiliaryClassifications = [...new Set(auxiliaryClassifications)];

  let trapAnalysis = null;
  if (includeTrapVariant) {
    const noTrapGraph = explorePacked(ctx, limits, { activateTraps: false });
    const noTrapSolved = solvePackedGraph(noTrapGraph);
    trapAnalysis = {
      classification: noTrapGraph.truncated
        ? "INCONCLUSIVE_RESOURCE_LIMIT"
        : trapRole(graph, solved, noTrapGraph, noTrapSolved),
      mainExistential: Boolean(solved.existentialWinning[graph.startId]),
      mainGuaranteed: Boolean(solved.guaranteedWinning[graph.startId]),
      noTrapExistential: Boolean(noTrapSolved.existentialWinning[noTrapGraph.startId]),
      noTrapGuaranteed: Boolean(noTrapSolved.guaranteedWinning[noTrapGraph.startId]),
      noTrapStates: noTrapGraph.explored,
      noTrapTransitions: noTrapGraph.transitions,
      noTrapTruncated: noTrapGraph.truncated,
      noTrapResourceLimit: noTrapGraph.resourceLimit,
      noTrapElapsedMs: noTrapGraph.elapsedMs + noTrapSolved.profile.totalMs,
    };
  }

  return {
    ...REPORT,
    seed,
    route,
    mode,
    limits,
    stateContract: contract,
    classification,
    initial: {
      existential: Boolean(solved.existentialWinning[graph.startId]),
      guaranteed: Boolean(solved.guaranteedWinning[graph.startId]),
    },
    states: graph.explored,
    processedStates: graph.processedNodes,
    transitions: graph.transitions,
    truncated: graph.truncated,
    resourceLimit: graph.resourceLimit,
    frontier: graph.frontier,
    peakFrontier: graph.peakFrontier,
    elapsedMs: performance.now() - caseStarted,
    graphElapsedMs: graph.elapsedMs,
    solveProfile: solved.profile,
    memory: graph.memory,
    shortestExistentialWitness: witness,
    shortestExistentialWin: witness?.length ?? null,
    guaranteedPolicy: guaranteedPolicySummary(graph, solved),
    witnessMetrics: witnessMetrics(witness),
    reachableWinning: solved.existentialCount,
    existentialAttractorStates: solved.existentialCount,
    guaranteedAttractorStates: solved.guaranteedCount,
    reachableNonWinning: graph.nodes.count - solved.existentialCount,
    auxiliaryClassifications,
    suspicious,
    scc: compactScc(scc),
    trapAnalysis,
  };
}
