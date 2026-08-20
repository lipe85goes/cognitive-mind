/**
 * ROTA-DYNAMIC-SOLVABILITY-02 — deterministic runtime-state and occupancy proof.
 *
 * This suite drives production pure rules and the real useEscapeMaze hook. It
 * does not infer gameplay from Babylon or duplicate the shipped transition loop.
 */
import fs from "node:fs";
import path from "node:path";
import {
  loadRouteRuntime,
  cellKey,
  sameCell,
  pathBetween,
  walkableNeighbours,
} from "./route-runtime-harness.mjs";

const OUT = path.resolve(
  process.env.ROUTE_VALIDATION_OUT ??
    "docs/archive/route-dynamic-solvability-02",
);
fs.mkdirSync(OUT, { recursive: true });
const RT = loadRouteRuntime();
const { API, LAB } = RT;
const DIFFICULTIES = ["easy", "medium", "hard"];
const ROUTES = [1, 2, 3];
const MAPS_PER_COMBINATION = 260;
const SENTINEL_RUNS_PER_COMBINATION = 20;
const RUNTIME_RUNS_PER_COMBINATION = 8;
const failures = [];
const assert = (condition, code, detail = null) => {
  if (!condition) failures.push({ code, detail });
};
const snapshot = (map, sentinel, overrides = {}) => ({
  mazeMap: map,
  player: map.playerStart,
  guardian: map.guardianStart,
  sentinel: sentinel.position,
  collectedStars: [],
  triggeredTraps: [],
  chestOpened: false,
  rewardSelected: null,
  rewardSpent: false,
  brokenWall: null,
  status: "playing",
  ...overrides,
});
const makeMap = (seed, difficulty, route) => {
  LAB.setSeed(seed);
  return API.generateMaze(difficulty, route);
};
const zoneOf = (map, walls = map.walls) =>
  API.computePortalDefenceZone(map.playerStart, map.exitPosition, walls);
const sentinelOf = (map, walls = map.walls) =>
  API.createSentinelState(map, zoneOf(map, walls));

const report = {
  mission: "ROTA-DYNAMIC-SOLVABILITY-02",
  contractVersion: 1,
  maps: {
    requested: ROUTES.length * DIFFICULTIES.length * MAPS_PER_COMBINATION,
    generated: 0,
    generationThrows: 0,
    initialValid: 0,
    initialTopologicallySolvable: 0,
    internalWallsOpened: 0,
    connectivityRegressions: 0,
  },
  occupancy: {
    defenderOverlaps: 0,
    preventedHunterEntries: 0,
    playerDefenderPlayingDetected: false,
    defenderDefenderDetected: false,
    playerChestPendingAllowed: false,
    sentinelChestAllowed: false,
    inactivePortalPlayerAllowed: false,
    sentinelPortalDetected: false,
    terminalCaptureAllowed: false,
  },
  sentinel: {
    turns: 0,
    moves: 0,
    stationaryPolicyDecisions: 0,
    stationaryAtTarget: 0,
    stationaryHomeGuard: 0,
    stationaryNoStrictImprovement: 0,
    settlementOccupancyBlocks: 0,
    unexplainedStalls: 0,
    longestStationaryRun: 0,
    longestStationarySample: null,
  },
  runtime: {
    runs: 0,
    observedStates: 0,
    invalidPlayingStates: 0,
    topologicalSoftlocks: 0,
    chestPauses: 0,
    pickaxeSelections: 0,
    secondChanceSelections: 0,
    wallsBroken: 0,
    rejectedSecondPickaxeUses: 0,
    restarts: 0,
    cleanRestarts: 0,
    wins: 0,
    losses: 0,
  },
};

let first = null;
for (const route of ROUTES) {
  for (const difficulty of DIFFICULTIES) {
    for (let sample = 0; sample < MAPS_PER_COMBINATION; sample += 1) {
      const seed = 9_200_000 + route * 100_000 + DIFFICULTIES.indexOf(difficulty) * 10_000 + sample;
      let map;
      try {
        map = makeMap(seed, difficulty, route);
      } catch (error) {
        report.maps.generationThrows += 1;
        failures.push({ code: "GENERATION_THROW", detail: { seed, route, difficulty, error: String(error) } });
        continue;
      }
      report.maps.generated += 1;
      const sentinel = sentinelOf(map);
      if (!first) first = { map, sentinel };
      const initial = API.inspectDynamicMazeState(snapshot(map, sentinel));
      if (initial.valid) report.maps.initialValid += 1;
      if (initial.topologicallySolvable) report.maps.initialTopologicallySolvable += 1;
      assert(initial.solvable, "INITIAL_STATE_INVALID", { seed, route, difficulty, issues: initial.issues });

      const baseReachable = API.getReachableDistances(map.playerStart, map.walls).size;
      for (const wallKey of map.walls) {
        const opened = API.inspectDynamicMazeState(snapshot(map, sentinel, {
          chestOpened: true,
          rewardSelected: "pickaxe",
          rewardSpent: true,
          brokenWall: wallKey,
        }));
        report.maps.internalWallsOpened += 1;
        const monotonic = opened.effectiveWalls.size === map.walls.size - 1 &&
          API.getReachableDistances(map.playerStart, opened.effectiveWalls).size >= baseReachable;
        if (!opened.solvable || !monotonic) report.maps.connectivityRegressions += 1;
        assert(opened.solvable && monotonic, "PICKAXE_CONNECTIVITY_REGRESSION", {
          seed, route, difficulty, wallKey, issues: opened.issues,
        });
      }

      if (sample >= SENTINEL_RUNS_PER_COMBINATION) continue;
      const zone = zoneOf(map);
      let s = sentinel;
      let hunter = { ...map.guardianStart };
      let player = { ...map.playerStart };
      let stationaryRun = 0;
      const toPortal = API.getReachableDistances(map.exitPosition, map.walls);
      for (let turn = 1; turn <= 120; turn += 1) {
        const options = API.getNeighbors(player, map.walls).filter(
          (cell) => !sameCell(cell, hunter) && !sameCell(cell, s.position),
        );
        if (!options.length) break;
        options.sort((a, b) => (toPortal.get(cellKey(a)) ?? 99) - (toPortal.get(cellKey(b)) ?? 99));
        player = options[turn % options.length];
        const unrestrictedHunter = API.chooseGuardianMove(
          hunter, player, map.exitPosition, map.walls, difficulty,
        );
        const blocked = new Set([cellKey(s.position)]);
        const nextHunter = API.chooseGuardianMove(
          hunter, player, map.exitPosition, map.walls, difficulty, blocked,
        );
        if (sameCell(unrestrictedHunter, s.position) && !sameCell(nextHunter, s.position)) {
          report.occupancy.preventedHunterEntries += 1;
        }
        if (sameCell(nextHunter, player)) break;

        const before = s;
        const raw = API.decideSentinelMove(s, player, map.exitPosition, map.walls, zone);
        const settlementBlocked =
          sameCell(raw.position, nextHunter) && !sameCell(raw.position, s.position);
        s = settlementBlocked ? { ...raw, position: s.position } : raw;
        report.sentinel.turns += 1;
        if (settlementBlocked) report.sentinel.settlementOccupancyBlocks += 1;
        if (sameCell(s.position, nextHunter)) {
          report.occupancy.defenderOverlaps += 1;
          failures.push({ code: "DEFENDER_OVERLAP", detail: { seed, route, difficulty, turn } });
        }
        if (!sameCell(s.position, before.position)) {
          report.sentinel.moves += 1;
          stationaryRun = 0;
        } else {
          stationaryRun += 1;
          report.sentinel.longestStationaryRun = Math.max(
            report.sentinel.longestStationaryRun,
            stationaryRun,
          );
          if (stationaryRun === report.sentinel.longestStationaryRun) {
            report.sentinel.longestStationarySample = {
              seed, route, difficulty, turn, length: stationaryRun,
              player: cellKey(player), hunter: cellKey(nextHunter),
              sentinel: cellKey(s.position),
              target: s.target ? cellKey(s.target) : null,
              commitLeft: s.commitLeft,
            };
          }
          if (settlementBlocked) {
            // The policy wanted to move; occupancy settlement deliberately held it.
          } else {
            report.sentinel.stationaryPolicyDecisions += 1;
            const target = s.target ?? map.exitPosition;
            const legal = API.getNeighbors(before.position, map.walls).filter((cell) => {
              if (sameCell(cell, map.exitPosition)) return false;
              const homeDistance = API.findPathLength(cell, map.exitPosition, map.walls);
              return homeDistance !== null && homeDistance <= 4;
            });
            const toTarget = API.getReachableDistances(target, map.walls);
            const stayScore = toTarget.get(cellKey(before.position)) ?? 99;
            const bestScore = Math.min(...legal.map((cell) => toTarget.get(cellKey(cell)) ?? 99), 99);
            const explained = legal.length === 0 || bestScore >= stayScore;
            if (!explained) {
              report.sentinel.unexplainedStalls += 1;
              failures.push({ code: "UNEXPLAINED_SENTINEL_STALL", detail: report.sentinel.longestStationarySample });
            } else if (s.target && sameCell(s.position, s.target)) {
              report.sentinel.stationaryAtTarget += 1;
            } else if (!s.target && API.findPathLength(s.position, map.exitPosition, map.walls) === 1) {
              report.sentinel.stationaryHomeGuard += 1;
            } else {
              report.sentinel.stationaryNoStrictImprovement += 1;
            }
          }
        }
        hunter = nextHunter;
        if (sameCell(s.position, player)) break;
      }
    }
  }
}

assert(first !== null, "NO_CONTROL_MAP");
if (first) {
  const { map, sentinel } = first;
  const chest = map.chest;
  if (chest) {
    const pending = API.inspectDynamicMazeState(snapshot(map, sentinel, {
      player: chest, chestOpened: true,
    }));
    report.occupancy.playerChestPendingAllowed = pending.solvable;
    assert(pending.solvable, "PLAYER_CHEST_PENDING_REJECTED", pending.issues);

    const defenderOnChest = API.inspectDynamicMazeState(snapshot(map, sentinel, {
      guardian: chest,
    }));
    report.occupancy.sentinelChestAllowed = defenderOnChest.solvable;
    assert(defenderOnChest.solvable, "MOBILE_CHEST_OCCUPANCY_REJECTED", defenderOnChest.issues);
  }
  const portalPlayer = API.inspectDynamicMazeState(snapshot(map, sentinel, {
    player: map.exitPosition,
  }));
  report.occupancy.inactivePortalPlayerAllowed = portalPlayer.solvable;
  assert(portalPlayer.solvable, "INACTIVE_PORTAL_PLAYER_REJECTED", portalPlayer.issues);

  const playerDefender = API.inspectDynamicMazeState(snapshot(map, sentinel, {
    player: map.guardianStart,
  }));
  report.occupancy.playerDefenderPlayingDetected =
    playerDefender.issues.includes("PLAYER_DEFENDER_CO_OCCUPANCY");
  const defenderDefender = API.inspectDynamicMazeState(snapshot(map, sentinel, {
    guardian: sentinel.position,
  }));
  report.occupancy.defenderDefenderDetected =
    defenderDefender.issues.includes("DEFENDER_CO_OCCUPANCY");
  const sentinelPortal = API.inspectDynamicMazeState(snapshot(map, sentinel, {
    sentinel: map.exitPosition,
  }));
  report.occupancy.sentinelPortalDetected =
    sentinelPortal.issues.includes("SENTINEL_ON_PORTAL");
  const terminalCapture = API.inspectDynamicMazeState(snapshot(map, sentinel, {
    player: map.guardianStart, status: "lost",
  }));
  report.occupancy.terminalCaptureAllowed =
    !terminalCapture.issues.includes("PLAYER_DEFENDER_CO_OCCUPANCY");
  assert(report.occupancy.playerDefenderPlayingDetected, "PLAYER_DEFENDER_NOT_DETECTED");
  assert(report.occupancy.defenderDefenderDetected, "DEFENDER_DEFENDER_NOT_DETECTED");
  assert(report.occupancy.sentinelPortalDetected, "SENTINEL_PORTAL_NOT_DETECTED");
  assert(report.occupancy.terminalCaptureAllowed, "TERMINAL_CAPTURE_REJECTED");

  const invalidMap = { ...map, walls: new Set(map.walls) };
  const target = map.collectibleStars[0];
  for (const cell of [
    { row: target.row - 1, col: target.col },
    { row: target.row + 1, col: target.col },
    { row: target.row, col: target.col - 1 },
    { row: target.row, col: target.col + 1 },
  ]) {
    if (cell.row >= 0 && cell.row < 9 && cell.col >= 0 && cell.col < 9) {
      invalidMap.walls.add(cellKey(cell));
    }
  }
  const impossible = API.inspectDynamicMazeState(snapshot(invalidMap, sentinel));
  assert(!impossible.topologicallySolvable, "IMPOSSIBLE_MAP_NOT_DETECTED");
}

for (const route of ROUTES) {
  for (const difficulty of DIFFICULTIES) {
    for (let sample = 0; sample < RUNTIME_RUNS_PER_COMBINATION; sample += 1) {
      const seed = 9_800_000 + route * 10_000 + DIFFICULTIES.indexOf(difficulty) * 1_000 + sample;
      const run = RT.mount({ seed, difficulty, routeNumber: route });
      report.runtime.runs += 1;
      let chosen = false;
      for (let turn = 0; turn < 80; turn += 1) {
        const game = run.state;
        report.runtime.observedStates += 1;
        if (game.status === "playing") {
          if (!game.dynamicSolvability.valid) report.runtime.invalidPlayingStates += 1;
          if (!game.dynamicSolvability.topologicallySolvable) report.runtime.topologicalSoftlocks += 1;
        }
        if (game.status !== "playing") {
          if (game.status === "won") report.runtime.wins += 1;
          if (game.status === "lost") report.runtime.losses += 1;
          break;
        }
        if (game.rewardChoicePending) {
          report.runtime.chestPauses += 1;
          const reward = (sample + route) % 2 === 0 ? "pickaxe" : "second-chance";
          run.choose(reward);
          chosen = true;
          if (reward === "pickaxe") report.runtime.pickaxeSelections += 1;
          else report.runtime.secondChanceSelections += 1;
          continue;
        }
        if (game.pickaxeAvailable && game.breakTargets.length > 0) {
          const targetWall = game.breakTargets[0].cell;
          const beforeWalls = game.walls.size;
          run.break(targetWall);
          if (run.state.brokenWall === cellKey(targetWall) && run.state.walls.size === beforeWalls - 1) {
            report.runtime.wallsBroken += 1;
          }
          const brokenBefore = run.state.brokenWall;
          const wallsBeforeSecondAttempt = run.state.walls.size;
          run.break(targetWall);
          const secondUseRejected =
            run.state.brokenWall === brokenBefore &&
            run.state.walls.size === wallsBeforeSecondAttempt;
          if (secondUseRejected) {
            report.runtime.rejectedSecondPickaxeUses += 1;
          }
          assert(secondUseRejected, "PICKAXE_SECOND_USE_MUTATED_STATE", { seed, route, difficulty });
          continue;
        }
        const target = !chosen && game.chestPosition
          ? game.chestPosition
          : game.mazeMap.collectibleStars.find((cell) => !game.collectedSet.has(cellKey(cell)))
            ?? game.mazeMap.exitPosition;
        const pathToTarget = pathBetween(game.player, target, game.walls);
        let next = pathToTarget?.[1] ?? null;
        if (next && (sameCell(next, game.guardian) || sameCell(next, game.sentinel))) next = null;
        if (!next) {
          next = walkableNeighbours(game.player, game.walls).find(
            (cell) => !sameCell(cell, game.guardian) && !sameCell(cell, game.sentinel),
          ) ?? null;
        }
        if (!next) break;
        run.stepTo(next);
      }
      assert(run.state.dynamicSolvability.valid || run.state.status !== "playing", "REAL_RUNTIME_INVALID", {
        seed, route, difficulty, issues: run.state.dynamicSolvability.issues,
      });
      if (sample === 0) {
        run.restart();
        report.runtime.restarts += 1;
        const clean = run.state.status === "playing" &&
          !run.state.chestOpened &&
          run.state.rewardSelected === null &&
          run.state.brokenWall === null &&
          run.state.dynamicSolvability.solvable;
        if (clean) report.runtime.cleanRestarts += 1;
        assert(clean, "RESTART_STATE_LEAK", { seed, route, difficulty });
      }
    }
  }
}

assert(report.maps.generationThrows === 0, "GENERATION_THROWS");
assert(report.maps.connectivityRegressions === 0, "CONNECTIVITY_REGRESSIONS");
assert(report.occupancy.defenderOverlaps === 0, "DEFENDER_OVERLAPS");
assert(report.sentinel.unexplainedStalls === 0, "SENTINEL_STALLS");
assert(report.runtime.invalidPlayingStates === 0, "INVALID_RUNTIME_STATES");
assert(report.runtime.topologicalSoftlocks === 0, "RUNTIME_SOFTLOCKS");
assert(report.runtime.cleanRestarts === report.runtime.restarts, "UNCLEAN_RESTARTS");
assert(report.runtime.wallsBroken > 0, "NO_RUNTIME_WALL_BREAK");
assert(report.runtime.secondChanceSelections > 0, "NO_SECOND_CHANCE_SELECTION");

report.failures = failures;
report.gateMet = failures.length === 0;
fs.writeFileSync(
  path.join(OUT, "dynamic-solvability-02-tests.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
console.log(report.gateMet ? "DYNAMIC_SOLVABILITY_02_OK" : "DYNAMIC_SOLVABILITY_02_FAILED");
if (!report.gateMet) process.exitCode = 1;
