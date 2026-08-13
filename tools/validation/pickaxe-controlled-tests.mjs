/**
 * ROTA-CHEST-REWARDS-01 — the Pickaxe contract, asserted (§27 A–N, §28, §29).
 *
 * REVISED AFTER THE MANUAL PLAYTEST. The suite this replaced proved that only a
 * certified subset could be opened. That is now the opposite of the contract:
 *
 *   PICKAXE_TARGET = ANY_INTERNAL_MAZE_WALL
 *
 * So the burden of proof flipped. It is no longer enough to show the rules are
 * enforced; the suite has to show the game does NOT restrict the choice — that a
 * wall the old certifier rejected is still perfectly legal to break, and that a
 * strategically terrible choice is still allowed to be made.
 *
 * The old certifier is loaded here purely as a source of "walls the previous
 * design would have refused", so test B can prove they are now targets.
 *
 * Usage: node tools/validation/pickaxe-controlled-tests.mjs
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
import { auditBreakableWalls } from "./breakable-wall-certifier.mjs";

const OUT = path.resolve("docs/archive/route-chest-rewards-01");
fs.mkdirSync(OUT, { recursive: true });

const RT = loadRouteRuntime();
const API = RT.API;
const tests = [];
const record = (id, name, pass, detail) => {
  tests.push({ id, name, pass, ...detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${name}`);
  for (const [k, v] of Object.entries(detail)) {
    console.log(`        ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  }
};

const COMBOS = [
  { difficulty: "easy", routeNumber: 1 },
  { difficulty: "medium", routeNumber: 2 },
  { difficulty: "hard", routeNumber: 3 },
];
const adjacent = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
const toCell = (key) => {
  const [row, col] = key.split(",").map(Number);
  return { row, col };
};

function walkToCell(run, target, budget = 60) {
  for (let step = 0; step < budget; step += 1) {
    const g = run.state;
    if (sameCell(g.player, target)) return true;
    if (g.status !== "playing" || g.rewardChoicePending) return false;
    const blocked = new Set([...g.walls, cellKey(g.guardian), cellKey(g.sentinel)]);
    blocked.delete(cellKey(target));
    const route = pathBetween(g.player, target, blocked);
    if (!route || route.length < 2) return false;
    if (sameCell(route[1], g.guardian) || sameCell(route[1], g.sentinel)) return false;
    run.stepTo(route[1]);
  }
  return false;
}

/** What the retired certifier would have said about this board. */
function certifiedSetOf(game) {
  const map = game.mazeMap;
  return new Set(
    auditBreakableWalls(
      API,
      map.walls,
      map.playerStart,
      map.guardianStart,
      map.exitPosition,
      map.collectibleStars,
      map.traps,
      map.chest,
    )
      .filter((c) => c.certified)
      .map((c) => cellKey(c.position)),
  );
}

/** A live route holding the Pickaxe, standing next to at least `wanted` walls. */
function setupPickaxeRun(combo, baseSeed, { wantedAdjacentWalls = 1, limit = 90 } = {}) {
  for (let i = 0; i < limit; i += 1) {
    const seed = baseSeed + i;
    const run = RT.mount({ seed, ...combo });
    const chest = run.state.chestPosition;
    if (!chest || !walkToCell(run, chest)) continue;
    if (!run.state.rewardChoicePending) continue;
    run.choose("pickaxe");
    if (run.state.status !== "playing") continue;

    // Any walkable cell with enough walls around it will do. The Explorer walks
    // there; nothing about the map is arranged.
    const wallsAround = (cell) =>
      [
        { row: cell.row - 1, col: cell.col },
        { row: cell.row + 1, col: cell.col },
        { row: cell.row, col: cell.col - 1 },
        { row: cell.row, col: cell.col + 1 },
      ].filter(
        (n) =>
          n.row >= 0 && n.row <= 8 && n.col >= 0 && n.col <= 8 &&
          run.state.walls.has(cellKey(n)),
      );

    const spots = [];
    for (let row = 0; row <= 8; row += 1) {
      for (let col = 0; col <= 8; col += 1) {
        const cell = { row, col };
        if (run.state.walls.has(cellKey(cell))) continue;
        if (wallsAround(cell).length >= wantedAdjacentWalls) spots.push(cell);
      }
    }
    spots.sort(
      (a, b) =>
        Math.abs(a.row - run.state.player.row) + Math.abs(a.col - run.state.player.col) -
        (Math.abs(b.row - run.state.player.row) + Math.abs(b.col - run.state.player.col)),
    );
    for (const spot of spots.slice(0, 6)) {
      if (run.state.status !== "playing") break;
      if (!walkToCell(run, spot)) continue;
      if (run.state.breakTargets.length >= wantedAdjacentWalls) {
        return { seed, combo, run };
      }
    }
  }
  return null;
}

const fixtures = COMBOS.map((combo, index) =>
  setupPickaxeRun(combo, 7_100_000 + index * 1_000),
).filter(Boolean);

// ---------------------------------------------------------------------------
// A / B — any internal wall, including ones the old certifier refused
// ---------------------------------------------------------------------------
{
  const runsChecked = [];
  let brokeAnUncertifiedWall = 0;
  let everyAdjacentWallWasATarget = true;

  for (const combo of COMBOS) {
    for (let i = 0; i < 150 && runsChecked.filter((r) => r.combo === `${combo.difficulty}/r${combo.routeNumber}`).length < 6; i += 1) {
      const fixture = setupPickaxeRun(combo, 7_200_000 + i, { limit: 1 });
      if (!fixture) continue;
      const { run } = fixture;
      const g = run.state;
      const certified = certifiedSetOf(g);

      // A — every wall physically next to the Explorer is offered as a target.
      const wallsNextToExplorer = [
        { row: g.player.row - 1, col: g.player.col },
        { row: g.player.row + 1, col: g.player.col },
        { row: g.player.row, col: g.player.col - 1 },
        { row: g.player.row, col: g.player.col + 1 },
      ].filter(
        (n) =>
          n.row >= 0 && n.row <= 8 && n.col >= 0 && n.col <= 8 &&
          g.walls.has(cellKey(n)),
      );
      const offered = new Set(g.breakTargets.map((t) => cellKey(t.cell)));
      const allOffered = wallsNextToExplorer.every((w) => offered.has(cellKey(w)));
      if (!allOffered) everyAdjacentWallWasATarget = false;

      // B — pick one the OLD certifier refused, and break it.
      const uncertified = g.breakTargets.find(
        (t) => !certified.has(cellKey(t.cell)),
      );
      const chosen = uncertified ?? g.breakTargets[0];
      const before = g.walls.size;
      run.break(chosen.cell);
      const after = run.state;
      const opened = after.brokenWall === cellKey(chosen.cell);
      if (opened && uncertified) brokeAnUncertifiedWall += 1;

      runsChecked.push({
        combo: `${combo.difficulty}/r${combo.routeNumber}`,
        seed: fixture.seed,
        wallsNextToExplorer: wallsNextToExplorer.map(cellKey),
        offeredAsTargets: [...offered],
        allAdjacentWallsOffered: allOffered,
        oldCertifiedSetSize: certified.size,
        chosen: cellKey(chosen.cell),
        chosenWasCertifiedBefore: certified.has(cellKey(chosen.cell)),
        opened,
        wallsBefore: before,
        wallsAfter: after.walls.size,
      });
    }
  }

  record(
    "A",
    "ANY_INTERNAL_WALL",
    runsChecked.length > 0 &&
      everyAdjacentWallWasATarget &&
      runsChecked.every((r) => r.opened && r.wallsAfter === r.wallsBefore - 1),
    {
      runs: runsChecked.length,
      everyAdjacentWallOffered: everyAdjacentWallWasATarget,
      sample: runsChecked.slice(0, 3),
    },
  );
  record(
    "B",
    "NO_CERTIFIED_RESTRICTION",
    brokeAnUncertifiedWall > 0,
    {
      wallsBrokenThatTheOldCertifierRefused: brokeAnUncertifiedWall,
      runsWhereAnUncertifiedWallWasAdjacent: runsChecked.filter(
        (r) => !r.chosenWasCertifiedBefore,
      ).length,
      note:
        "the retired certifier is consulted here only to name walls it would have refused; it has no authority over the runtime",
    },
  );
}

// ---------------------------------------------------------------------------
// C / J / K / L / M / N — one use, the turn, the topology, the reset, the state
// ---------------------------------------------------------------------------
{
  const breaks = [];
  let anyDefenderMovedOnBreakTurn = false;

  for (const fixture of fixtures) {
    const { run } = fixture;
    const before = run.state;
    const target = before.breakTargets[0];
    if (!target) continue;
    const wall = target.cell;
    const snapshot = {
      player: cellKey(before.player),
      guardian: cellKey(before.guardian),
      sentinel: cellKey(before.sentinel),
      turns: before.turns,
      walls: before.walls.size,
      mapWalls: before.mazeMap.walls.size,
    };

    run.break(wall);
    const after = run.state;

    // C — no second wall, anywhere, ever.
    const anotherWall = [...after.walls][0];
    const beforeSecond = {
      walls: after.walls.size,
      turns: after.turns,
      broken: after.brokenWall,
    };
    run.break(toCell(anotherWall));
    const secondAttempt = {
      wall: anotherWall,
      targetsOffered: run.state.breakTargets.length,
      wallsUnchanged: run.state.walls.size === beforeSecond.walls,
      turnsUnchanged: run.state.turns === beforeSecond.turns,
      brokenUnchanged: run.state.brokenWall === beforeSecond.broken,
    };

    const afterSecond = run.state;
    run.restart();
    const afterRestart = run.state;

    const entry = {
      seed: fixture.seed,
      combo: `${fixture.combo.difficulty}/r${fixture.combo.routeNumber}`,
      wall: cellKey(wall),
      direction: target.direction,
      snapshot,
      pickaxeSpent: afterSecond.pickaxeSpent === true,
      pickaxeAvailable: afterSecond.pickaxeAvailable,
      brokenWall: after.brokenWall,
      secondAttempt,
      explorerStayed: cellKey(after.player) === snapshot.player,
      turnCost: after.turns - snapshot.turns,
      wallOpenedInState: !after.walls.has(cellKey(wall)),
      wallCountDropped: after.walls.size === snapshot.walls - 1,
      mapDefinitionUntouched: after.mazeMap.walls.size === snapshot.mapWalls,
      defendersAnswered:
        cellKey(after.guardian) !== snapshot.guardian ||
        cellKey(after.sentinel) !== snapshot.sentinel,
      afterRestart: {
        brokenWall: afterRestart.brokenWall,
        noOpenWall: afterRestart.walls.size === afterRestart.mazeMap.walls.size,
        pickaxeAvailable: afterRestart.pickaxeAvailable,
        rewardSpent: afterRestart.rewardSpent,
        breakTargets: afterRestart.breakTargets.length,
      },
      // N — the whole Pickaxe state is readable without touching the UI.
      solverState: {
        rewardSelected: after.rewardSelected,
        rewardSpent: after.rewardSpent,
        pickaxeAvailable: after.pickaxeAvailable,
        pickaxeSpent: after.pickaxeSpent,
        brokenWall: after.brokenWall,
        wallIdentityIsACell: /^\d,\d$/.test(String(after.brokenWall)),
      },
    };
    if (entry.defendersAnswered) anyDefenderMovedOnBreakTurn = true;
    breaks.push(entry);
  }

  record(
    "C",
    "ONE_USE",
    breaks.length > 0 &&
      breaks.every(
        (b) =>
          b.pickaxeSpent &&
          !b.pickaxeAvailable &&
          b.brokenWall === b.wall &&
          b.secondAttempt.wallsUnchanged &&
          b.secondAttempt.turnsUnchanged &&
          b.secondAttempt.brokenUnchanged &&
          b.secondAttempt.targetsOffered === 0,
      ),
    {
      runs: breaks.map((b) => ({
        seed: b.seed,
        wall: b.wall,
        secondAttempt: b.secondAttempt,
      })),
      note: "the second attempt targets an arbitrary standing wall, not a marked one",
    },
  );

  record(
    "J",
    "TURN_COST",
    breaks.length > 0 &&
      breaks.every(
        (b) => b.explorerStayed && b.turnCost === 1 && b.wallOpenedInState && b.wallCountDropped,
      ) &&
      anyDefenderMovedOnBreakTurn,
    {
      runs: breaks.map((b) => ({
        seed: b.seed,
        explorerStayed: b.explorerStayed,
        turnCost: b.turnCost,
        defendersAnswered: b.defendersAnswered,
      })),
      defenderPhaseObservedOnBreakTurn: anyDefenderMovedOnBreakTurn,
    },
  );

  const definitionChecks = fixtures.map((fixture) => {
    const fresh = RT.mount({ seed: fixture.seed, ...fixture.combo });
    return {
      seed: fixture.seed,
      freshWalls: fresh.state.mazeMap.walls.size,
      freshWallSet: [...fresh.state.mazeMap.walls].sort().join("|"),
    };
  });

  record(
    "M",
    "RESET",
    breaks.length > 0 &&
      breaks.every(
        (b) =>
          b.afterRestart.brokenWall === null &&
          b.afterRestart.noOpenWall &&
          b.afterRestart.pickaxeAvailable === false &&
          b.afterRestart.rewardSpent === false &&
          b.afterRestart.breakTargets === 0 &&
          b.mapDefinitionUntouched,
      ),
    {
      runs: breaks.map((b) => ({ seed: b.seed, ...b.afterRestart })),
      mapDefinitionUntouched: definitionChecks,
      note: "a restart draws a NEW map, so the check is that nothing is open and the definition was never written to",
    },
  );

  record(
    "N",
    "SOLVER_STATE_EXPLICIT",
    breaks.length > 0 &&
      breaks.every(
        (b) =>
          b.solverState.rewardSelected === "pickaxe" &&
          b.solverState.rewardSpent === true &&
          b.solverState.pickaxeAvailable === false &&
          b.solverState.pickaxeSpent === true &&
          b.solverState.wallIdentityIsACell,
      ),
    {
      runs: breaks.map((b) => ({ seed: b.seed, ...b.solverState })),
      note:
        "reward selected, pickaxe available/spent, broken wall and its cell identity are all readable from the hook, with no UI involved (§21)",
    },
  );
}

// ---------------------------------------------------------------------------
// D / E / F / G — what is physically not a target
// ---------------------------------------------------------------------------
{
  const refusals = [];
  for (const fixture of fixtures.length ? fixtures : []) {
    const run = RT.mount({ seed: fixture.seed, ...fixture.combo });
    const chest = run.state.chestPosition;
    if (!chest || !walkToCell(run, chest)) continue;
    if (!run.state.rewardChoicePending) continue;
    run.choose("pickaxe");
    if (run.state.status !== "playing") continue;

    const g = run.state;
    const attempt = (label, cell) => {
      const before = {
        walls: g.walls.size,
        turns: run.state.turns,
        broken: run.state.brokenWall,
        pickaxe: run.state.pickaxeAvailable,
      };
      run.break(cell);
      const after = run.state;
      return {
        label,
        cell: cellKey(cell),
        refused:
          after.walls.size === before.walls &&
          after.turns === before.turns &&
          after.brokenWall === before.broken &&
          after.pickaxeAvailable === before.pickaxe,
      };
    };

    // D — a real wall, but far away.
    const remote = [...g.walls]
      .map(toCell)
      .find((w) => !adjacent(w, g.player));
    // E — outside the grid entirely: the board frame is not part of the maze.
    const offBoard = [
      { row: -1, col: g.player.col },
      { row: 9, col: g.player.col },
      { row: g.player.row, col: -1 },
      { row: g.player.row, col: 9 },
    ];
    // F/G — the portal, the chest, a trap, a light, and the entities. All of
    // these live on WALKABLE cells, so none can be a wall; attempting them must
    // do nothing whether or not the Explorer happens to be beside them.
    const entities = [
      ["portal", g.mazeMap.exitPosition],
      ["chest", g.chestPosition],
      ["trap", g.mazeMap.traps[0]],
      ["light", g.mazeMap.collectibleStars[0]],
      ["hunter", g.guardian],
      ["sentinel", g.sentinel],
      ["explorer", g.player],
    ].filter(([, cell]) => cell);

    const results = [];
    if (remote) results.push({ ...attempt("remote-wall", remote), group: "D" });
    for (const cell of offBoard) results.push({ ...attempt("off-board", cell), group: "E" });
    for (const [label, cell] of entities) {
      results.push({
        ...attempt(label, cell),
        group: label === "portal" ? "F" : "G",
        isAWall: g.walls.has(cellKey(cell)),
      });
    }
    refusals.push({
      seed: fixture.seed,
      combo: `${fixture.combo.difficulty}/r${fixture.combo.routeNumber}`,
      results,
    });
  }

  const groupPasses = (group) =>
    refusals.length > 0 &&
    refusals.every((r) =>
      r.results.filter((x) => x.group === group).every((x) => x.refused),
    );
  const entityWallCollisions = refusals.flatMap((r) =>
    r.results.filter((x) => x.group === "G" && x.isAWall),
  );

  record("D", "NO_REMOTE_BREAK", groupPasses("D"), {
    runs: refusals.length,
    sample: refusals[0]?.results.filter((x) => x.group === "D"),
  });
  record("E", "NO_FRAME_BREAK", groupPasses("E"), {
    runs: refusals.length,
    note: "the board frame and everything outside the 9x9 grid are not maze walls",
    sample: refusals[0]?.results.filter((x) => x.group === "E"),
  });
  record("F", "NO_PORTAL_BREAK", groupPasses("F"), {
    runs: refusals.length,
    sample: refusals[0]?.results.filter((x) => x.group === "F"),
  });
  record(
    "G",
    "NO_ENTITY_BREAK",
    groupPasses("G") && entityWallCollisions.length === 0,
    {
      runs: refusals.length,
      entitiesThatTurnedOutToBeWalls: entityWallCollisions.length,
      note:
        "chest, trap, light and the three pieces all occupy walkable cells, so none of them is ever in `walls`",
      sample: refusals[0]?.results.filter((x) => x.group === "G"),
    },
  );
}

// ---------------------------------------------------------------------------
// H — the action is explicit; bumping a wall never spends the Pickaxe
// ---------------------------------------------------------------------------
{
  const bumps = [];
  for (const combo of COMBOS) {
    const fixture = setupPickaxeRun(combo, 7_500_000, { limit: 40 });
    if (!fixture) continue;
    const { run } = fixture;
    const g = run.state;
    const target = g.breakTargets[0];
    if (!target) continue;
    const before = {
      walls: g.walls.size,
      pickaxe: g.pickaxeAvailable,
      broken: g.brokenWall,
      blockedMoves: g.blockedMoves,
      turns: g.turns,
    };
    // Walk straight into it, repeatedly.
    const delta = {
      row: target.cell.row - g.player.row,
      col: target.cell.col - g.player.col,
    };
    run.move(delta);
    run.move(delta);
    const after = run.state;
    bumps.push({
      seed: fixture.seed,
      combo: `${combo.difficulty}/r${combo.routeNumber}`,
      wall: cellKey(target.cell),
      pickaxeKept: after.pickaxeAvailable === before.pickaxe,
      wallStillStanding: after.walls.size === before.walls,
      nothingBroken: after.brokenWall === before.broken,
      countedAsBlocked: after.blockedMoves > before.blockedMoves,
      noTurnSpent: after.turns === before.turns,
      message: after.message,
    });
  }
  record(
    "H",
    "EXPLICIT_ACTION",
    bumps.length > 0 &&
      bumps.every(
        (b) =>
          b.pickaxeKept &&
          b.wallStillStanding &&
          b.nothingBroken &&
          b.countedAsBlocked &&
          b.noTurnSpent,
      ),
    { runs: bumps },
  );
}

// ---------------------------------------------------------------------------
// I — two or more adjacent walls resolve unambiguously
// ---------------------------------------------------------------------------
{
  const choices = [];
  for (const combo of COMBOS) {
    const fixture = setupPickaxeRun(combo, 7_600_000, { wantedAdjacentWalls: 2 });
    if (!fixture) continue;
    const { run } = fixture;
    const targets = run.state.breakTargets;
    const directions = targets.map((t) => t.direction);
    // Each target must sit exactly where its direction says it does.
    const player = run.state.player;
    const directionsAreTruthful = targets.every((t) => {
      const expected = {
        up: { row: player.row - 1, col: player.col },
        down: { row: player.row + 1, col: player.col },
        left: { row: player.row, col: player.col - 1 },
        right: { row: player.row, col: player.col + 1 },
      }[t.direction];
      return sameCell(expected, t.cell);
    });
    // Choosing the SECOND one must open the second one.
    const chosen = targets[1];
    run.break(chosen.cell);
    const after = run.state;
    choices.push({
      seed: fixture.seed,
      combo: `${combo.difficulty}/r${combo.routeNumber}`,
      adjacentWalls: targets.length,
      directions,
      directionsAreUnique: new Set(directions).size === directions.length,
      directionsAreTruthful,
      chosen: { direction: chosen.direction, cell: cellKey(chosen.cell) },
      openedExactlyTheChosenOne:
        after.brokenWall === cellKey(chosen.cell) &&
        !after.walls.has(cellKey(chosen.cell)) &&
        targets
          .filter((t) => !sameCell(t.cell, chosen.cell))
          .every((t) => after.walls.has(cellKey(t.cell))),
    });
  }
  record(
    "I",
    "MULTIPLE_ADJACENT",
    choices.length > 0 &&
      choices.every(
        (c) =>
          c.adjacentWalls >= 2 &&
          c.directionsAreUnique &&
          c.directionsAreTruthful &&
          c.openedExactlyTheChosenOne,
      ),
    {
      runs: choices,
      note:
        "targets are named by direction and walked in a fixed order, so nothing depends on invisible array order (§17)",
    },
  );
}

// ---------------------------------------------------------------------------
// K / L — the opening is real, for everyone, in that same turn
// ---------------------------------------------------------------------------
{
  const witnesses = [];
  let sameTurnWitness = null;
  let laterWitness = null;
  let explorerCrossed = 0;
  let runsSearched = 0;

  outer: for (const combo of COMBOS) {
    for (let i = 0; i < 120; i += 1) {
      const fixture = setupPickaxeRun(combo, 7_700_000 + i, { limit: 1 });
      if (!fixture) continue;
      runsSearched += 1;
      const { run } = fixture;
      const target = run.state.breakTargets[0];
      if (!target) continue;
      const wall = target.cell;

      // Pace beside the wall until the Hunter is next to it too: the Hunter is
      // Manhattan-greedy toward the Explorer, so a wall between them is exactly
      // the detour it wants gone.
      const pacing = walkableNeighbours(wall, run.state.walls);
      for (let turn = 0; turn < 14; turn += 1) {
        const g = run.state;
        if (g.status !== "playing") break;
        if (adjacent(g.guardian, wall)) break;
        const step = pacing.find(
          (cell) => !sameCell(cell, g.player) && adjacent(cell, g.player),
        );
        if (!step) break;
        run.stepTo(step);
      }
      const beforeBreak = run.state;
      if (beforeBreak.status !== "playing") continue;
      if (!beforeBreak.breakTargets.some((t) => sameCell(t.cell, wall))) continue;

      run.break(wall);
      const afterBreak = run.state;
      const key = cellKey(wall);
      const entry = {
        seed: fixture.seed,
        combo: `${combo.difficulty}/r${combo.routeNumber}`,
        wall: key,
        hunterWasAdjacent: adjacent(beforeBreak.guardian, wall),
        hunterOnOpeningSameTurn: cellKey(afterBreak.guardian) === key,
        sentinelOnOpeningSameTurn: cellKey(afterBreak.sentinel) === key,
      };

      if (afterBreak.status === "playing" && !afterBreak.walls.has(key)) {
        if (adjacent(afterBreak.player, wall)) {
          run.stepTo(wall);
          if (sameCell(run.state.player, wall)) {
            entry.explorerCrossed = true;
            explorerCrossed += 1;
          }
        }
        for (let turn = 0; turn < 6 && run.state.status === "playing"; turn += 1) {
          if (cellKey(run.state.guardian) === key) entry.hunterOnOpeningLater = true;
          if (cellKey(run.state.sentinel) === key) entry.sentinelOnOpeningLater = true;
          const options = walkableNeighbours(run.state.player, run.state.walls);
          if (!options.length) break;
          run.stepTo(options[turn % options.length]);
        }
      }

      witnesses.push(entry);
      if (!sameTurnWitness && (entry.hunterOnOpeningSameTurn || entry.sentinelOnOpeningSameTurn)) {
        sameTurnWitness = entry;
      }
      if (!laterWitness && (entry.hunterOnOpeningLater || entry.sentinelOnOpeningLater)) {
        laterWitness = entry;
      }
      if (sameTurnWitness && laterWitness && explorerCrossed >= 2) break outer;
    }
  }

  record("K", "SAME_TURN_TOPOLOGY", sameTurnWitness !== null, {
    runsSearched,
    witness: sameTurnWitness,
    proof:
      "the closed and opened boards differ in exactly the broken cell, so a defender standing on it at the end of the break turn is a move the closed board could not produce",
  });
  record(
    "L",
    "ALL_ENTITIES_USE_OPENING",
    explorerCrossed > 0 && (sameTurnWitness !== null || laterWitness !== null),
    {
      explorerCrossings: explorerCrossed,
      defenderOccupations: witnesses.filter(
        (w) =>
          w.hunterOnOpeningSameTurn || w.sentinelOnOpeningSameTurn ||
          w.hunterOnOpeningLater || w.sentinelOnOpeningLater,
      ).length,
      runsObserved: witnesses.length,
      note: "a broken wall leaves the ONE wall set every walkability question goes through; there is no player-only hole",
    },
  );
}

// ---------------------------------------------------------------------------
// §28 — a bad choice is still a legal choice
// §29 — and the opening may genuinely favour a defender
// ---------------------------------------------------------------------------
{
  const cases = [];
  let helpfulBroken = 0;
  let uselessBroken = 0;
  let hunterFavouringBroken = 0;

  for (const combo of COMBOS) {
    for (let i = 0; i < 120 && cases.filter((c) => c.combo === `${combo.difficulty}/r${combo.routeNumber}`).length < 2; i += 1) {
      const fixture = setupPickaxeRun(combo, 7_900_000 + i, {
        wantedAdjacentWalls: 2,
        limit: 1,
      });
      if (!fixture) continue;
      const g = fixture.run.state;
      const map = g.mazeMap;

      // Score each adjacent wall the way the RETIRED certifier would have, only
      // to label them — the runtime is never asked.
      const judged = g.breakTargets.map((t) => {
        const opened = new Set(g.walls);
        opened.delete(cellKey(t.cell));
        const before = API.findPathLength(g.player, map.exitPosition, g.walls);
        const after = API.findPathLength(g.player, map.exitPosition, opened);
        const hunterBefore = API.findPathLength(g.guardian, g.player, g.walls);
        const hunterAfter = API.findPathLength(g.guardian, g.player, opened);
        return {
          direction: t.direction,
          cell: cellKey(t.cell),
          explorerMovesSaved: before !== null && after !== null ? before - after : 0,
          hunterMovesSaved:
            hunterBefore !== null && hunterAfter !== null ? hunterBefore - hunterAfter : 0,
        };
      });
      if (judged.length < 2) continue;

      const helpful = judged.reduce((a, b) =>
        b.explorerMovesSaved > a.explorerMovesSaved ? b : a,
      );
      const useless = judged.reduce((a, b) =>
        b.explorerMovesSaved < a.explorerMovesSaved ? b : a,
      );
      if (helpful.cell === useless.cell) continue;

      // Break the WORSE one on purpose, on a fresh copy of the same route.
      const badRun = setupPickaxeRun(combo, fixture.seed, {
        wantedAdjacentWalls: 2,
        limit: 1,
      });
      if (!badRun) continue;
      const badTarget = badRun.run.state.breakTargets.find(
        (t) => cellKey(t.cell) === useless.cell,
      );
      if (!badTarget) continue;
      const beforeBad = badRun.run.state.walls.size;
      badRun.run.break(badTarget.cell);
      const afterBad = badRun.run.state;

      const entry = {
        combo: `${combo.difficulty}/r${combo.routeNumber}`,
        seed: fixture.seed,
        adjacentWalls: judged,
        helpfulOption: helpful,
        poorOption: useless,
        brokeThePoorOption: afterBad.brokenWall === useless.cell,
        runtimeRefused: afterBad.walls.size === beforeBad,
        explorerMovesSavedByTheChoice: useless.explorerMovesSaved,
        hunterMovesSavedByTheChoice: useless.hunterMovesSaved,
      };
      if (helpful.explorerMovesSaved > 0) helpfulBroken += 1;
      if (useless.explorerMovesSaved <= 0) uselessBroken += 1;
      if (useless.hunterMovesSaved > 0 || helpful.hunterMovesSaved > 0) {
        hunterFavouringBroken += 1;
      }
      cases.push(entry);
    }
  }

  record(
    "BAD_CHOICE",
    "BAD_STRATEGIC_CHOICE_IS_STILL_LEGAL",
    cases.length > 0 &&
      cases.every((c) => c.brokeThePoorOption && !c.runtimeRefused) &&
      uselessBroken > 0,
    {
      fixtures: cases.length,
      poorOptionsThatSavedTheExplorerNothing: uselessBroken,
      fixturesWhereABetterOptionExisted: helpfulBroken,
      BAD_STRATEGIC_CHOICE_IS_STILL_LEGAL:
        cases.length > 0 && cases.every((c) => c.brokeThePoorOption),
      sample: cases.slice(0, 2),
      note:
        "both walls were legal; the runtime has no rewardEligibility(wall) and never refuses a choice for being weak (§8/§28)",
    },
  );

  record(
    "DEFENDER_BENEFIT",
    "OPENING_MAY_FAVOUR_A_DEFENDER",
    hunterFavouringBroken > 0,
    {
      fixturesWhereAnOpeningShortenedTheHunterPath: hunterFavouringBroken,
      note:
        "§29 — no invisible protection for the Explorer: an opening that helps the Hunter is allowed to be made and is not silently blocked",
    },
  );
}

const allPass = tests.every((t) => t.pass);
fs.writeFileSync(
  path.join(OUT, "pickaxe-controlled-tests.json"),
  JSON.stringify(
    {
      mission: "ROTA-CHEST-REWARDS-01",
      suite: "PICKAXE_FREE_WALL_CHOICE",
      designRevision:
        "post-playtest: PICKAXE_TARGET moved from CERTIFIED_BREAKABLE_WALL to ANY_INTERNAL_MAZE_WALL",
      driver:
        "tools/validation/route-runtime-harness.mjs drives the real useEscapeMaze hook",
      contract: [
        "one use, and any internal maze wall the Explorer is standing next to",
        "the retired certifier does not restrict the runtime: walls it refused are legal targets",
        "no eligibility check — a weak or even self-harming choice is allowed",
        "not remote, not the frame, not the portal, not an entity",
        "walking into a wall never spends the Pickaxe",
        "two adjacent walls are two named, distinguishable choices",
        "breaking costs a turn and the Explorer does not move",
        "the wall is open BEFORE the defenders answer, in that same turn",
        "a broken wall is walkable by the Explorer, the Hunter and the Sentinel",
        "restart closes it; the map definition was never written to",
        "the whole Pickaxe state is readable without the UI",
      ],
      tests,
      allPass,
    },
    null,
    2,
  ),
);
console.log(`\n${allPass ? "PICKAXE_CONTRACT_OK" : "PICKAXE_CONTRACT_FAILED"}`);
if (!allPass) process.exitCode = 1;
