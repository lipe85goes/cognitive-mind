/**
 * ROTA-DIFFICULTY-04-BASELINE
 *
 * Measures the current Route x Difficulty system without changing gameplay.
 * Geometry uses production generation. Policy probes drive the real
 * useEscapeMaze hook and are comparative instruments, never human models.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { hunterSupport } from "./dynamic-solver.mjs";
import { loadInstrumented } from "./instrumented-generator.mjs";
import {
  loadRouteRuntime,
  sameCell,
  walkableNeighbours,
} from "./route-runtime-harness.mjs";

const ROUTES = [1, 2, 3];
const MODES = ["easy", "medium", "hard"];
const POLICY_DEFINITIONS = [
  {
    id: "OBJECTIVE_ROUTE_GREEDY_SECOND_CHANCE",
    navigation: "objective-route-greedy",
    chestAware: false,
    reward: "second-chance",
    description:
      "Follows the current shortest all-objectives route and reacts only to occupied cells.",
  },
  {
    id: "THREAT_AWARE_SECOND_CHANCE",
    navigation: "threat-aware",
    chestAware: false,
    reward: "second-chance",
    description:
      "Uses lexicographic immediate-threat, route-progress and revisit avoidance.",
  },
  {
    id: "CHEST_AWARE_SECOND_CHANCE",
    navigation: "threat-aware",
    chestAware: true,
    reward: "second-chance",
    description:
      "Visits the Chest first, then uses the same threat-aware navigation.",
  },
  {
    id: "CHEST_AWARE_PICKAXE",
    navigation: "threat-aware",
    chestAware: true,
    reward: "pickaxe",
    description:
      "Visits the Chest first and opens an adjacent wall only when it strictly shortens the remaining objective route.",
  },
];
const DEFAULTS = {
  geometrySeeds: 120,
  uiSeeds: 30,
  policySeeds: 24,
  maxTurns: 160,
  quiet: false,
};
const GEOMETRY_SEED_BASE = 12_400_000;
const UI_SEED_BASE = 13_300_000;
const POLICY_SEED_BASE = 14_200_000;

const modeIndex = (mode) => MODES.indexOf(mode);
const keyOf = (position) => `${position.row},${position.col}`;
const round = (value, digits = 4) =>
  Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const mean = (values) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const quantile = (values, q) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * q;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
};
const summarize = (values) =>
  values.length
    ? {
        min: round(Math.min(...values)), p10: round(quantile(values, 0.1)),
        p50: round(quantile(values, 0.5)), mean: round(mean(values)),
        p90: round(quantile(values, 0.9)), max: round(Math.max(...values)),
      }
    : { min: null, p10: null, p50: null, mean: null, p90: null, max: null };
const rate = (numerator, denominator) =>
  denominator ? round(numerator / denominator) : 0;
const hashJson = (value) =>
  crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const seedFor = (base, route, mode, sample) =>
  base + route * 10_000 + modeIndex(mode) * 1_000 + sample;

function mapIdentity(map) {
  return {
    walls: [...map.walls].sort(),
    guardian: keyOf(map.guardianStart),
    exit: keyOf(map.exitPosition),
    lights: map.collectibleStars.map(keyOf),
    traps: map.traps.map(keyOf),
    chest: map.chest ? keyOf(map.chest) : null,
  };
}

function mapHash(map) {
  return hashJson(mapIdentity(map));
}

function graphMetrics(api, map, objective) {
  const nodes = [];
  const adjacency = new Map();
  for (let row = 0; row < api.ROWS; row += 1) {
    for (let col = 0; col < api.COLS; col += 1) {
      const position = { row, col };
      if (map.walls.has(keyOf(position))) continue;
      const key = keyOf(position);
      nodes.push(key);
      adjacency.set(key, api.getNeighbors(position, map.walls).map(keyOf));
    }
  }

  const edgeCount =
    [...adjacency.values()].reduce((sum, neighbours) => sum + neighbours.length, 0) / 2;
  const junctions = nodes.filter((key) => adjacency.get(key).length >= 3).length;
  const deadEnds = nodes.filter((key) => adjacency.get(key).length <= 1).length;
  const corridorCells = nodes.filter((key) => adjacency.get(key).length === 2).length;

  let index = 0;
  const indexes = new Map();
  const lows = new Map();
  const articulation = new Set();
  const visit = (node, parent = null) => {
    indexes.set(node, index);
    lows.set(node, index);
    index += 1;
    let children = 0;
    for (const next of adjacency.get(node)) {
      if (!indexes.has(next)) {
        children += 1;
        visit(next, node);
        lows.set(node, Math.min(lows.get(node), lows.get(next)));
        if (parent === null && children > 1) articulation.add(node);
        if (parent !== null && lows.get(next) >= indexes.get(node)) articulation.add(node);
      } else if (next !== parent) {
        lows.set(node, Math.min(lows.get(node), indexes.get(next)));
      }
    }
  };
  if (nodes.length) visit(nodes[0]);

  let decisions = 0;
  let longestForcedStreak = 0;
  let forcedStreak = 0;
  for (let i = 0; i < objective.cells.length - 1; i += 1) {
    const current = objective.cells[i];
    const previous = i > 0 ? objective.cells[i - 1] : null;
    const options = api.getNeighbors(current, map.walls).filter(
      (next) => !previous || !sameCell(next, previous),
    );
    if (options.length >= 2) {
      decisions += 1;
      forcedStreak = 0;
    } else {
      forcedStreak += 1;
      longestForcedStreak = Math.max(longestForcedStreak, forcedStreak);
    }
  }
  const objectiveSteps = Math.max(1, objective.cells.length - 1);
  const routeArticulations = new Set(
    objective.cells.map(keyOf).filter((key) => articulation.has(key)),
  );

  return {
    walkableCells: nodes.length,
    edgeCount,
    cycleRank: edgeCount - nodes.length + 1,
    junctions,
    deadEnds,
    corridorRatio: corridorCells / nodes.length,
    articulationPoints: articulation.size,
    objectiveArticulationPoints: routeArticulations.size,
    objectiveDecisionRatio: decisions / objectiveSteps,
    objectiveLongestForcedStreak: longestForcedStreak,
  };
}

function pairwiseDistanceMean(api, positions, walls) {
  const distances = [];
  for (let i = 0; i < positions.length; i += 1) {
    for (let j = i + 1; j < positions.length; j += 1) {
      const distance = api.findPathLength(positions[i], positions[j], walls);
      if (distance !== null) distances.push(distance);
    }
  }
  return distances.length ? mean(distances) : 0;
}

function bestPickaxeGeometry(api, map, objectiveMoves) {
  let beneficialWalls = 0;
  let bestImprovement = 0;
  let bestWall = null;
  const byWall = new Map();
  for (const wall of map.walls) {
    const opened = new Set(map.walls);
    opened.delete(wall);
    const route = api.computeObjectiveRoute(
      map.playerStart,
      map.collectibleStars,
      map.exitPosition,
      opened,
    );
    if (!route) continue;
    const improvement = objectiveMoves - route.moves;
    byWall.set(wall, improvement);
    if (improvement > 0) beneficialWalls += 1;
    if (
      improvement > bestImprovement ||
      (improvement === bestImprovement && improvement > 0 && wall < bestWall)
    ) {
      bestImprovement = improvement;
      bestWall = wall;
    }
  }

  let chestAdjacentBest = 0;
  let chestAdjacentWall = null;
  if (map.chest) {
    for (const cell of [
      { row: map.chest.row - 1, col: map.chest.col },
      { row: map.chest.row + 1, col: map.chest.col },
      { row: map.chest.row, col: map.chest.col - 1 },
      { row: map.chest.row, col: map.chest.col + 1 },
    ]) {
      const key = keyOf(cell);
      const improvement = byWall.get(key) ?? 0;
      if (improvement > chestAdjacentBest) {
        chestAdjacentBest = improvement;
        chestAdjacentWall = key;
      }
    }
  }
  return {
    beneficialWalls,
    bestImprovement,
    bestWall,
    chestAdjacentBest,
    chestAdjacentWall,
  };
}

function analyseGeometry(api, map, metadata) {
  const objective = api.computeObjectiveRoute(
    map.playerStart,
    map.collectibleStars,
    map.exitPosition,
    map.walls,
  );
  if (!objective) throw new Error("Certified map has no objective route");
  const fromStart = api.getReachableDistances(map.playerStart, map.walls);
  const lightDistances = map.collectibleStars.map(
    (light) => fromStart.get(keyOf(light)) ?? Number.POSITIVE_INFINITY,
  );
  const trapDistances = map.traps.map(
    (trap) => fromStart.get(keyOf(trap)) ?? Number.POSITIVE_INFINITY,
  );
  const chestDistance = map.chest
    ? fromStart.get(keyOf(map.chest)) ?? Number.POSITIVE_INFINITY
    : Number.POSITIVE_INFINITY;
  const withChest =
    map.chest &&
    api.computeObjectiveRoute(
      map.playerStart,
      [...map.collectibleStars, map.chest],
      map.exitPosition,
      map.walls,
    );
  const zone = api.computePortalDefenceZone(
    map.playerStart,
    map.exitPosition,
    map.walls,
  );
  const graph = graphMetrics(api, map, objective);
  const pickaxe = bestPickaxeGeometry(api, map, objective.moves);
  return {
    ...metadata,
    mapHash: mapHash(map),
    wallCount: map.walls.size,
    lightCount: map.collectibleStars.length,
    trapCount: map.traps.length,
    portalDistance: fromStart.get(keyOf(map.exitPosition)),
    guardianStartDistance: api.findPathLength(
      map.playerStart,
      map.guardianStart,
      map.walls,
    ),
    chestDistance,
    chestDetour: withChest ? withChest.moves - objective.moves : null,
    objectiveMoves: objective.moves,
    lightDistanceMean: mean(lightDistances),
    lightDistanceMax: Math.max(...lightDistances),
    lightDispersion: pairwiseDistanceMean(api, map.collectibleStars, map.walls),
    trapDistanceMean: mean(trapDistances),
    portalZoneCells: zone.zone.length,
    portalAccesses: zone.accesses.length,
    ...graph,
    pickaxeBeneficialWalls: pickaxe.beneficialWalls,
    pickaxeBestImprovement: pickaxe.bestImprovement,
    pickaxeBestWall: pickaxe.bestWall,
    chestAdjacentPickaxeImprovement: pickaxe.chestAdjacentBest,
    chestAdjacentPickaxeWall: pickaxe.chestAdjacentWall,
  };
}

const GEOMETRY_FIELDS = [
  "wallCount",
  "walkableCells",
  "lightCount",
  "trapCount",
  "portalDistance",
  "guardianStartDistance",
  "chestDistance",
  "chestDetour",
  "objectiveMoves",
  "lightDistanceMean",
  "lightDistanceMax",
  "lightDispersion",
  "trapDistanceMean",
  "junctions",
  "deadEnds",
  "corridorRatio",
  "cycleRank",
  "articulationPoints",
  "objectiveArticulationPoints",
  "objectiveDecisionRatio",
  "objectiveLongestForcedStreak",
  "portalZoneCells",
  "portalAccesses",
  "pickaxeBeneficialWalls",
  "pickaxeBestImprovement",
  "chestAdjacentPickaxeImprovement",
];

function aggregateGeometry(samples) {
  return ROUTES.flatMap((route) =>
    MODES.map((mode) => {
      const group = samples.filter(
        (sample) => sample.route === route && sample.mode === mode,
      );
      return {
        route,
        mode,
        maps: group.length,
        metrics: Object.fromEntries(
          GEOMETRY_FIELDS.map((field) => [
            field,
            summarize(group.map((sample) => sample[field])),
          ]),
        ),
        pickaxeBeneficialMapRate: rate(
          group.filter((sample) => sample.pickaxeBestImprovement > 0).length,
          group.length,
        ),
        chestAdjacentPickaxeBeneficialRate: rate(
          group.filter((sample) => sample.chestAdjacentPickaxeImprovement > 0).length,
          group.length,
        ),
      };
    }),
  );
}

function remainingLights(game) {
  return game.mazeMap.collectibleStars.filter(
    (light) => !game.collectedSet.has(keyOf(light)),
  );
}

function routeCostFrom(api, game, position) {
  const lights = remainingLights(game).filter((light) => !sameCell(light, position));
  const route = api.computeObjectiveRoute(
    position,
    lights,
    game.mazeMap.exitPosition,
    game.walls,
  );
  return route?.moves ?? Number.POSITIVE_INFINITY;
}

function chooseMove(api, game, policy, visits) {
  const neighbours = walkableNeighbours(game.player, game.walls).filter(
    (cell) => !sameCell(cell, game.guardian) && !sameCell(cell, game.sentinel),
  );
  if (!neighbours.length) return null;
  const chestTarget =
    policy.chestAware && !game.chestOpened ? game.chestPosition : null;
  let preferred = null;
  if (chestTarget) {
    preferred = api.findPathCells(game.player, chestTarget, game.walls)?.[1] ?? null;
  } else {
    preferred = api.computeObjectiveRoute(
      game.player,
      remainingLights(game),
      game.mazeMap.exitPosition,
      game.walls,
    )?.cells[1] ?? null;
  }

  const scored = neighbours.map((cell) => {
    const progress = chestTarget
      ? api.findPathLength(cell, chestTarget, game.walls) ?? 999
      : routeCostFrom(api, game, cell);
    const hunterDistance =
      api.findPathLength(cell, game.guardian, game.walls) ?? 999;
    const sentinelDistance =
      api.findPathLength(cell, game.sentinel, game.walls) ?? 999;
    return {
      cell,
      progress,
      danger: Number(hunterDistance <= 2) + Number(sentinelDistance <= 2),
      defenderMargin: Math.min(hunterDistance, sentinelDistance),
      visits: visits.get(keyOf(cell)) ?? 0,
    };
  });

  if (policy.navigation === "objective-route-greedy" && preferred) {
    const exact = scored.find((entry) => sameCell(entry.cell, preferred));
    if (exact) return exact.cell;
  }
  scored.sort((a, b) => {
    if (policy.navigation === "threat-aware" && a.danger !== b.danger) {
      return a.danger - b.danger;
    }
    if (a.progress !== b.progress) return a.progress - b.progress;
    if (a.visits !== b.visits) return a.visits - b.visits;
    if (policy.navigation === "threat-aware" && a.defenderMargin !== b.defenderMargin) {
      return b.defenderMargin - a.defenderMargin;
    }
    return keyOf(a.cell).localeCompare(keyOf(b.cell));
  });
  return scored[0].cell;
}

function chooseBeneficialBreak(api, game) {
  if (!game.pickaxeAvailable || !game.breakTargets.length) return null;
  const base = routeCostFrom(api, game, game.player);
  const candidates = game.breakTargets.map((target) => {
    const opened = new Set(game.walls);
    opened.delete(keyOf(target.cell));
    const route = api.computeObjectiveRoute(
      game.player,
      remainingLights(game),
      game.mazeMap.exitPosition,
      opened,
    );
    return {
      target,
      improvement: route ? base - route.moves : 0,
    };
  });
  candidates.sort(
    (a, b) =>
      b.improvement - a.improvement ||
      keyOf(a.target.cell).localeCompare(keyOf(b.target.cell)),
  );
  return candidates[0]?.improvement > 0 ? candidates[0].target : null;
}

function captureSupport(api, game, playerAfterMove, armedTraps) {
  const hunters = hunterSupport(
    game.guardian,
    playerAfterMove,
    game.mazeMap.exitPosition,
    game.walls,
    game.difficulty,
    armedTraps,
    game.sentinel,
  );
  let hunterCapture = false;
  let sentinelCapture = false;
  for (const hunter of hunters) {
    if (sameCell(hunter, playerAfterMove)) {
      hunterCapture = true;
      continue;
    }
    const before = {
      position: game.sentinel,
      target: game.sentinelTarget,
      commitLeft: game.sentinelCommitLeft,
    };
    const after = api.decideSentinelMove(
      before,
      playerAfterMove,
      game.mazeMap.exitPosition,
      game.walls,
      game.portalDefenceZone,
      3,
      armedTraps,
    );
    const settled =
      sameCell(after.position, hunter) && !sameCell(after.position, before.position)
        ? before.position
        : after.position;
    if (sameCell(settled, playerAfterMove)) sentinelCapture = true;
  }
  return {
    branches: hunters.length,
    hunterCapture,
    sentinelCapture,
  };
}

function pressureSnapshot(api, game) {
  const hunterDistance =
    api.findPathLength(game.player, game.guardian, game.walls) ?? 999;
  const sentinelDistance =
    api.findPathLength(game.player, game.sentinel, game.walls) ?? 999;
  const portalBase =
    api.findPathLength(game.player, game.mazeMap.exitPosition, game.walls) ?? 999;
  const portalBlocked =
    api.findPathLength(
      game.player,
      game.mazeMap.exitPosition,
      game.walls,
      new Set([keyOf(game.sentinel)]),
    ) ?? 999;
  return {
    hunterDistance,
    sentinelDistance,
    sentinelBlocksPortalRoute: portalBlocked > portalBase,
    sentinelInZone: game.portalDefenceZone.zoneKeys.has(keyOf(game.sentinel)),
    sentinelCommitted: game.sentinelTarget !== null,
  };
}

function simulatePolicy(runtime, api, config) {
  const { seed, route, mode, policy, maxTurns } = config;
  const run = runtime.mount({ seed, difficulty: mode, routeNumber: route });
  const initialHash = mapHash(run.state.mazeMap);
  const visits = new Map([[keyOf(run.state.player), 1]]);
  const metrics = {
    observations: 0,
    hunterThreatTurns: 0,
    sentinelThreatTurns: 0,
    sentinelPortalBlockTurns: 0,
    sentinelZoneTurns: 0,
    sentinelCommittedTurns: 0,
    hunterBranches: 0,
    branchObservations: 0,
    potentialHunterCaptures: 0,
    potentialSentinelCaptures: 0,
    hunterMoves: 0,
    sentinelMoves: 0,
    commitmentsStarted: 0,
    secondChanceActivations: 0,
    wallsBroken: 0,
    validThroughout: true,
  };
  let noLegalMove = false;
  let decisions = 0;

  const observeAction = (playerAfterMove, armed, action) => {
    const before = run.state;
    const pressure = pressureSnapshot(api, before);
    const support = captureSupport(api, before, playerAfterMove, armed);
    metrics.observations += 1;
    metrics.hunterThreatTurns += Number(pressure.hunterDistance <= 2);
    metrics.sentinelThreatTurns += Number(pressure.sentinelDistance <= 2);
    metrics.sentinelPortalBlockTurns += Number(pressure.sentinelBlocksPortalRoute);
    metrics.sentinelZoneTurns += Number(pressure.sentinelInZone);
    metrics.sentinelCommittedTurns += Number(pressure.sentinelCommitted);
    metrics.hunterBranches += support.branches;
    metrics.branchObservations += 1;
    metrics.potentialHunterCaptures += Number(support.hunterCapture);
    metrics.potentialSentinelCaptures += Number(support.sentinelCapture);
    const beforeSecondChance = before.secondChanceAvailable;
    const hunterBefore = before.guardian;
    const sentinelBefore = before.sentinel;
    const commitBefore = before.sentinelCommitLeft;
    action();
    const after = run.state;
    metrics.hunterMoves += Number(!sameCell(hunterBefore, after.guardian));
    metrics.sentinelMoves += Number(!sameCell(sentinelBefore, after.sentinel));
    metrics.commitmentsStarted += Number(
      commitBefore === 0 && after.sentinelCommitLeft === 3,
    );
    metrics.secondChanceActivations += Number(
      beforeSecondChance && after.secondChanceSpent,
    );
    metrics.validThroughout =
      metrics.validThroughout &&
      (after.status !== "playing" || after.dynamicSolvability.valid);
  };

  while (
    run.state.status === "playing" &&
    run.state.turns < maxTurns &&
    decisions < maxTurns + 20
  ) {
    const game = run.state;
    if (game.rewardChoicePending) {
      run.choose(policy.reward);
      decisions += 1;
      continue;
    }
    const breakTarget =
      policy.reward === "pickaxe" ? chooseBeneficialBreak(api, game) : null;
    if (breakTarget) {
      const armed = new Set(game.triggeredTrapSet);
      observeAction(game.player, armed, () => run.break(breakTarget.cell));
      metrics.wallsBroken += Number(
        run.state.brokenWall === keyOf(breakTarget.cell),
      );
      decisions += 1;
      continue;
    }

    const next = chooseMove(api, game, policy, visits);
    if (!next) {
      noLegalMove = true;
      break;
    }
    const armed = new Set(game.triggeredTrapSet);
    if (game.mazeMap.traps.some((trap) => sameCell(trap, next))) {
      armed.add(keyOf(next));
    }
    observeAction(next, armed, () => run.stepTo(next));
    visits.set(keyOf(next), (visits.get(keyOf(next)) ?? 0) + 1);
    decisions += 1;
  }

  const game = run.state;
  let outcome = "timeout";
  if (game.status === "won") outcome = "won";
  else if (game.status === "lost") {
    if (sameCell(game.player, game.guardian)) outcome = "caught-hunter";
    else if (sameCell(game.player, game.sentinel)) outcome = "caught-sentinel";
    else outcome = "lost-other";
  } else if (noLegalMove) outcome = "no-legal-move";

  return {
    seed,
    route,
    mode,
    policy: policy.id,
    mapHash: initialHash,
    outcome,
    turns: game.turns,
    decisions,
    chestOpened: game.chestOpened,
    rewardSelected: game.rewardSelected,
    rewardSpent: game.rewardSpent,
    trapsTriggered: game.trapsTriggered,
    completionRecorded: run.completions.length > 0,
    ...metrics,
  };
}

function aggregatePolicies(runs) {
  return ROUTES.flatMap((route) =>
    MODES.flatMap((mode) =>
      POLICY_DEFINITIONS.map((policy) => {
        const group = runs.filter(
          (run) =>
            run.route === route &&
            run.mode === mode &&
            run.policy === policy.id,
        );
        const outcomes = Object.fromEntries(
          ["won", "caught-hunter", "caught-sentinel", "lost-other", "no-legal-move", "timeout"].map(
            (outcome) => [
              outcome,
              group.filter((run) => run.outcome === outcome).length,
            ],
          ),
        );
        const observations = group.reduce((sum, run) => sum + run.observations, 0);
        const branchObservations = group.reduce(
          (sum, run) => sum + run.branchObservations,
          0,
        );
        return {
          route,
          mode,
          policy: policy.id,
          runs: group.length,
          outcomes,
          winRate: rate(outcomes.won, group.length),
          timeoutRate: rate(outcomes.timeout, group.length),
          turns: summarize(group.map((run) => run.turns)),
          winningTurns: summarize(
            group.filter((run) => run.outcome === "won").map((run) => run.turns),
          ),
          hunterThreatShare: rate(
            group.reduce((sum, run) => sum + run.hunterThreatTurns, 0),
            observations,
          ),
          sentinelThreatShare: rate(
            group.reduce((sum, run) => sum + run.sentinelThreatTurns, 0),
            observations,
          ),
          sentinelPortalBlockShare: rate(
            group.reduce((sum, run) => sum + run.sentinelPortalBlockTurns, 0),
            observations,
          ),
          sentinelZoneShare: rate(
            group.reduce((sum, run) => sum + run.sentinelZoneTurns, 0),
            observations,
          ),
          sentinelCommittedShare: rate(
            group.reduce((sum, run) => sum + run.sentinelCommittedTurns, 0),
            observations,
          ),
          effectiveHunterBranching: rate(
            group.reduce((sum, run) => sum + run.hunterBranches, 0),
            branchObservations,
          ),
          potentialHunterCaptureShare: rate(
            group.reduce((sum, run) => sum + run.potentialHunterCaptures, 0),
            observations,
          ),
          potentialSentinelCaptureShare: rate(
            group.reduce((sum, run) => sum + run.potentialSentinelCaptures, 0),
            observations,
          ),
          chestOpenRate: rate(
            group.filter((run) => run.chestOpened).length,
            group.length,
          ),
          rewardSpentRate: rate(
            group.filter((run) => run.rewardSpent).length,
            group.length,
          ),
          secondChanceActivations: group.reduce(
            (sum, run) => sum + run.secondChanceActivations,
            0,
          ),
          wallsBroken: group.reduce((sum, run) => sum + run.wallsBroken, 0),
          invalidRuns: group.filter((run) => !run.validThroughout).length,
        };
      }),
    ),
  );
}

function progression(matrix) {
  const metric = (route, mode, field) =>
    matrix.find((row) => row.route === route && row.mode === mode).metrics[field].mean;
  const difficulty = ROUTES.flatMap((route) =>
    [
      ["wallCount", "higher"],
      ["objectiveMoves", "higher"],
      ["objectiveLongestForcedStreak", "higher"],
      ["guardianStartDistance", "lower"],
      ["lightCount", "higher"],
      ["trapCount", "higher"],
    ].map(([field, expectedDirection]) => {
      const values = Object.fromEntries(
        MODES.map((mode) => [mode, metric(route, mode, field)]),
      );
      const monotonic =
        expectedDirection === "higher"
          ? values.easy <= values.medium && values.medium <= values.hard
          : values.easy >= values.medium && values.medium >= values.hard;
      return { axis: "difficulty", route, field, expectedDirection, values, monotonic };
    }),
  );
  const routeAxis = MODES.flatMap((mode) =>
    [
      ["wallCount", "higher"],
      ["objectiveMoves", "higher"],
      ["objectiveLongestForcedStreak", "higher"],
      ["cycleRank", "lower"],
    ].map(([field, expectedDirection]) => {
      const values = Object.fromEntries(
        ROUTES.map((route) => [`route${route}`, metric(route, mode, field)]),
      );
      const monotonic =
        expectedDirection === "higher"
          ? values.route1 <= values.route2 && values.route2 <= values.route3
          : values.route1 >= values.route2 && values.route2 >= values.route3;
      return { axis: "route", mode, field, expectedDirection, values, monotonic };
    }),
  );
  return {
    difficulty,
    route: routeAxis,
    difficultyMonotonic: difficulty.filter((item) => item.monotonic).length,
    difficultyChecks: difficulty.length,
    routeMonotonic: routeAxis.filter((item) => item.monotonic).length,
    routeChecks: routeAxis.length,
  };
}

function selectOutliers(samples, field, direction, limit, id) {
  const sorted = [...samples].sort((a, b) => {
    const delta = direction === "desc" ? b[field] - a[field] : a[field] - b[field];
    return (
      delta ||
      a.route - b.route ||
      modeIndex(a.mode) - modeIndex(b.mode) ||
      a.seed - b.seed
    );
  });
  return {
    id,
    metric: field,
    direction,
    witnesses: sorted.slice(0, limit).map((sample) => ({
      seed: sample.seed,
      route: sample.route,
      mode: sample.mode,
      value: round(sample[field]),
      mapHash: sample.mapHash,
      pickaxeBestWall: sample.pickaxeBestWall,
    })),
  };
}

function parameterTable(api) {
  const rows = [
    {
      parameter: "board",
      scope: "all",
      currentValue: `${api.ROWS}x${api.COLS}; start ${keyOf(api.PLAYER_START)}`,
      effect: "Fixed movement space and common start.",
    },
    {
      parameter: "generation budget",
      scope: "all",
      currentValue: {
        randomAttempts: api.MAX_GENERATION_ATTEMPTS,
        recoveryRounds: api.RECOVERY_ROUNDS,
        retriesPerSlot: api.RECOVERY_RETRIES_PER_SLOT,
      },
      effect: "Reliability only; rejected candidates do not change difficulty semantics.",
    },
    {
      parameter: "move input guard",
      scope: "all",
      currentValue: api.MOVE_INPUT_GUARD_MS,
      effect: "150 ms duplicate-input suppression; no turn-speed difference by mode.",
    },
    {
      parameter: "Sentinel",
      scope: "all",
      currentValue: {
        zoneRadius: api.PORTAL_ZONE_RADIUS,
        leash: api.SENTINEL_LEASH,
        threatHorizon: api.SENTINEL_THREAT_HORIZON,
        commitTurns: api.SENTINEL_COMMIT_TURNS,
      },
      effect: "Same territorial policy for every route and difficulty; geometry changes its realised pressure.",
    },
    {
      parameter: "Chest rewards",
      scope: "all",
      currentValue: "one explicit choice: one-use Pickaxe or one-use Second Chance",
      effect: "Same rules in all combinations; map geometry changes usefulness.",
    },
  ];
  for (const mode of MODES) {
    rows.push({
      parameter: "difficulty play brief",
      scope: mode,
      currentValue: api.DIFFICULTY_PLAY_BRIEF[mode],
      effect: "Acceptance thresholds for decisions, forced corridors, idle dead ends and Hunter start range.",
    });
    rows.push({
      parameter: "Hunter policy",
      scope: mode,
      currentValue:
        mode === "easy"
          ? "50% any neighbour; otherwise non-pursuit when available"
          : mode === "medium"
            ? "75% best closer move when available; otherwise any neighbour"
            : "best closer move whenever available; random tie-break",
      effect: "Increasing pursuit pressure; all random tie outcomes remain positive-probability support.",
    });
  }
  for (const route of ROUTES) {
    rows.push({
      parameter: "route structure",
      scope: `route${route}`,
      currentValue: {
        templates: api.ROUTE_STAGE_TEMPLATES[route].length,
        exits: api.ROUTE_STAGE_EXIT_CANDIDATES[route].map(keyOf),
        guardianCandidates: api.ROUTE_STAGE_GUARDIAN_CANDIDATES[route].map(keyOf),
        minimumPortalPath: api.getMinimumPathLength(route),
        quality: api.ROUTE_STAGE_QUALITY[route],
      },
      effect: "Later routes use denser templates, more constrained exits and stricter objective placement.",
    });
    for (const mode of MODES) {
      rows.push({
        parameter: "route x difficulty generation",
        scope: `route${route}/${mode}`,
        currentValue: {
          wallLimits: api.getWallLimits(mode, route),
          lights: api.getStarCount(mode, route),
          objectiveSeparation: api.getStarMinSeparation(mode, route),
          traps: api.getTrapCount(mode, route),
        },
        effect: "Directly changes density, objective count and defender-blocking trap opportunities.",
      });
    }
  }
  return rows;
}

function legacyAudit() {
  const source =
    "docs/archive/route-dual-guardians-maps-01b/sentinel-runtime-gameplay.json";
  const archived = JSON.parse(fs.readFileSync(source, "utf8"));
  const selected = archived.combinations
    .filter(
      (item) =>
        (item.route === 2 && item.mode === "hard") ||
        (item.route === 3 && item.mode === "easy") ||
        (item.route === 3 && item.mode === "hard"),
    )
    .map((item) => ({
      route: item.route,
      mode: item.mode,
      games: item.games,
      outcomes: item.outcomes,
    }));
  return {
    classification: "PARTIALLY_STALE",
    citedDocumentationClaims: [
      { route: 2, mode: "hard", won: 0, timeouts: 19 },
      { route: 3, mode: "easy", won: 1, timeouts: 15 },
      { route: 3, mode: "hard", won: 3, timeouts: 16 },
    ],
    archivedJsonSource: source,
    archivedJsonSelectedRows: selected,
    provenanceMismatch:
      "The cited counts do not exactly match the versioned JSON artifact (0/18, 1/16, 2/16).",
    currentParts: [
      "production generateMaze",
      "production chooseGuardianMove",
      "production decideSentinelMove",
      "current seeded RNG implementation",
      "160-turn budget",
    ],
    staleOrMissingParts: [
      "real useEscapeMaze transition loop",
      "Chest pause and reward choice",
      "Pickaxe and opened topology",
      "Second Chance",
      "result/remount UI generation path",
      "objective ordering beyond map array order",
      "threat-aware or Chest-aware player policy",
    ],
    playerPolicy:
      "Fixed map-array light order; shortest path to one target; avoids only current defender cells.",
    interpretation:
      "Correctness smoke signal only. Its wins, losses and timeouts are not current practical-difficulty estimates.",
  };
}

export function runDifficultyBaseline(options = {}) {
  const config = { ...DEFAULTS, ...options };
  const directLab = loadInstrumented({ bare: true });
  const api = directLab.API;
  const uiRuntime = loadRouteRuntime();
  const directRuntime = loadRouteRuntime({ directDifficulty: true });
  const geometrySamples = [];
  const uiSamples = [];
  const policyRuns = [];
  const failures = [];

  for (const route of ROUTES) {
    for (const mode of MODES) {
      for (let sample = 0; sample < config.geometrySeeds; sample += 1) {
        const seed = seedFor(GEOMETRY_SEED_BASE, route, mode, sample);
        try {
          directLab.setSeed(seed);
          const map = api.generateMaze(mode, route);
          geometrySamples.push(analyseGeometry(api, map, { seed, route, mode }));
        } catch (error) {
          failures.push({ phase: "geometry", seed, route, mode, error: String(error) });
        }
      }

      for (let sample = 0; sample < config.uiSeeds; sample += 1) {
        const seed = seedFor(UI_SEED_BASE, route, mode, sample);
        const first = uiRuntime.mount({ seed, difficulty: mode, routeNumber: route });
        const second =
          sample < Math.min(3, config.uiSeeds)
            ? uiRuntime.mount({ seed, difficulty: mode, routeNumber: route })
            : null;
        directLab.setSeed(seed);
        const directMap = api.generateMaze(mode, route);
        uiSamples.push({
          seed,
          requestedRoute: route,
          requestedMode: mode,
          actualRoute: first.state.routeNumber,
          actualMode: first.state.difficulty,
          uiMapHash: mapHash(first.state.mazeMap),
          repeatedUiMapHash: second ? mapHash(second.state.mazeMap) : null,
          directMapHash: mapHash(directMap),
          deterministic: second
            ? mapHash(first.state.mazeMap) === mapHash(second.state.mazeMap)
            : null,
          validationGenerationEqualsUi:
            mapHash(first.state.mazeMap) === mapHash(directMap),
          dynamicStateValid: first.state.dynamicSolvability.valid,
        });
      }

      for (let sample = 0; sample < config.policySeeds; sample += 1) {
        const seed = seedFor(POLICY_SEED_BASE, route, mode, sample);
        directLab.setSeed(seed);
        const expectedHash = mapHash(api.generateMaze(mode, route));
        for (const policy of POLICY_DEFINITIONS) {
          const run = simulatePolicy(directRuntime, api, {
            seed,
            route,
            mode,
            policy,
            maxTurns: config.maxTurns,
          });
          run.mapMatchedDirectGeneration = run.mapHash === expectedHash;
          policyRuns.push(run);
        }
      }
      if (!config.quiet) {
        console.log(
          `route${route}/${mode}: geometry=${config.geometrySeeds} ui=${config.uiSeeds} policy=${config.policySeeds * POLICY_DEFINITIONS.length}`,
        );
      }
    }
  }

  const matrix = aggregateGeometry(geometrySamples);
  const policies = aggregatePolicies(policyRuns);
  const uiRouteResets = uiSamples.filter(
    (sample) => sample.actualRoute !== sample.requestedRoute,
  );
  const report = {
    mission: "ROTA-DIFFICULTY-04-BASELINE",
    contractVersion: 1,
    sample: {
      geometrySeedsPerCombination: config.geometrySeeds,
      uiSeedsPerCombination: config.uiSeeds,
      policySeedsPerCombination: config.policySeeds,
      policyCount: POLICY_DEFINITIONS.length,
      maxTurns: config.maxTurns,
      directGeometryMaps: geometrySamples.length,
      uiGenerationAttempts: uiSamples.length,
      policyRuns: policyRuns.length,
      seedFormula:
        "base + route*10000 + modeIndex*1000 + sample; bases geometry=12400000, ui=13300000, policy=14200000",
    },
    semantics: {
      topological: "Static paths exist while moving defenders are ignored.",
      runtimeValid: "The shipped hook preserves state and occupancy contracts.",
      possible: "At least one finite positive-probability win trace exists.",
      guaranteed: "One Explorer policy wins for every supported RNG result.",
      practical:
        "Observed burden across geometry and explicitly labelled comparative policies; not a human-skill estimate.",
    },
    parameterTable: parameterTable(api),
    legacySimulatorAudit: legacyAudit(),
    uiVsValidationGeneration: {
      classification: "NOT_EQUAL",
      uiSamples,
      determinismChecks: uiSamples.filter(
        (sample) => sample.deterministic !== null,
      ).length,
      deterministicSamples: uiSamples.filter((sample) => sample.deterministic === true).length,
      directIdentityMatches: uiSamples.filter(
        (sample) => sample.validationGenerationEqualsUi,
      ).length,
      requestedCombinationPreserved: uiSamples.filter(
        (sample) =>
          sample.actualRoute === sample.requestedRoute &&
          sample.actualMode === sample.requestedMode,
      ).length,
      routeResetCount: uiRouteResets.length,
      routeResetRequestedCombinations: [
        ...new Set(
          uiRouteResets.map(
            (sample) => `route${sample.requestedRoute}/${sample.requestedMode}`,
          ),
        ),
      ],
      staticCallSequence: {
        easy:
          "initial easy map on hook mount, then a second easy map on Start",
        mediumHard:
          "initial easy map, selected-mode setup map on changeDifficulty, then selected-mode map on Start",
        routeSelection:
          "changeDifficulty explicitly sets routeNumber to 1 and generates Route 1",
        laterRoutes:
          "result replay remounts with nextRouteNumber but difficulty resets to easy; selecting medium/hard resets the route to 1",
        rngCoupling:
          "Within one mounted journey, later map identity also depends on Math.random calls consumed by earlier gameplay.",
      },
    },
    routeDifficultyMatrix: matrix,
    geometrySamples,
    policyDefinitions: POLICY_DEFINITIONS,
    runtimePolicyMatrix: policies,
    policyRuns,
    progression: progression(matrix),
    outliers: [
      selectOutliers(geometrySamples, "objectiveMoves", "desc", 6, "LONGEST_OBJECTIVE_ROUTE"),
      selectOutliers(geometrySamples, "guardianStartDistance", "asc", 6, "CLOSEST_HUNTER_START"),
      selectOutliers(geometrySamples, "objectiveLongestForcedStreak", "desc", 6, "LONGEST_FORCED_STREAK"),
      selectOutliers(geometrySamples, "articulationPoints", "desc", 6, "MOST_CHOKE_POINTS"),
      selectOutliers(geometrySamples, "chestDetour", "desc", 6, "LARGEST_CHEST_DETOUR"),
      selectOutliers(geometrySamples, "pickaxeBestImprovement", "desc", 6, "LARGEST_PICKAXE_UPPER_BOUND"),
    ],
    integrity: {
      generationFailures: failures,
      invalidUiStates: uiSamples.filter((sample) => !sample.dynamicStateValid).length,
      invalidPolicyRuns: policyRuns.filter((run) => !run.validThroughout).length,
      policyMapMismatches: policyRuns.filter(
        (run) => !run.mapMatchedDirectGeneration,
      ).length,
    },
  };
  report.gateMet =
    failures.length === 0 &&
    matrix.length === 9 &&
    geometrySamples.length === config.geometrySeeds * 9 &&
    uiSamples.every((sample) => sample.dynamicStateValid) &&
    uiSamples
      .filter((sample) => sample.deterministic !== null)
      .every((sample) => sample.deterministic) &&
    policyRuns.every(
      (run) => run.validThroughout && run.mapMatchedDirectGeneration,
    );
  report.determinismFingerprint = hashJson(report);
  return report;
}

function optionNumber(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? Number(process.argv[index + 1]) : fallback;
}

function main() {
  const out = path.resolve(
    process.env.ROUTE_VALIDATION_OUT ??
      "docs/archive/route-difficulty-04-baseline",
  );
  const report = runDifficultyBaseline({
    geometrySeeds: optionNumber("--geometry-seeds", DEFAULTS.geometrySeeds),
    uiSeeds: optionNumber("--ui-seeds", DEFAULTS.uiSeeds),
    policySeeds: optionNumber("--policy-seeds", DEFAULTS.policySeeds),
    maxTurns: optionNumber("--max-turns", DEFAULTS.maxTurns),
    quiet: process.argv.includes("--quiet"),
  });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(
    path.join(out, "difficulty-baseline.json"),
    JSON.stringify(report, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        sample: report.sample,
        ui: {
          classification: report.uiVsValidationGeneration.classification,
          directIdentityMatches: report.uiVsValidationGeneration.directIdentityMatches,
          routeResetCount: report.uiVsValidationGeneration.routeResetCount,
        },
        progression: {
          difficulty: `${report.progression.difficultyMonotonic}/${report.progression.difficultyChecks}`,
          route: `${report.progression.routeMonotonic}/${report.progression.routeChecks}`,
        },
        gateMet: report.gateMet,
        fingerprint: report.determinismFingerprint,
      },
      null,
      2,
    ),
  );
  console.log(report.gateMet ? "DIFFICULTY_BASELINE_OK" : "DIFFICULTY_BASELINE_FAILED");
  if (!report.gateMet) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) main();
