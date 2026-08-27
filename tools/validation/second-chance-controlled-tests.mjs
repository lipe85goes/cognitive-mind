/**
 * ROTA-CHEST-REWARDS-01 — the Second Chance contract, asserted (§35 P–T).
 *
 * Both directions of a capture are provoked on purpose, because they are two
 * different situations and the resolution has to hold for each:
 *
 *   the Explorer walks into a defender  -> the Explorer's step is undone
 *   a defender walks into the Explorer  -> both defenders return to their cells
 *
 * Usage: node tools/validation/second-chance-controlled-tests.mjs [--check|--update]
 */
import {
  loadRouteRuntime,
  cellKey,
  sameCell,
  pathBetween,
  walkableNeighbours,
} from "./route-runtime-harness.mjs";
import { openEvidence } from "./evidence.mjs";

const EVIDENCE = openEvidence(
  process.env.ROUTE_VALIDATION_OUT ?? "docs/archive/route-chest-rewards-01",
);

const RT = loadRouteRuntime();
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

function walkToCell(run, target) {
  for (let step = 0; step < 60; step += 1) {
    const g = run.state;
    if (sameCell(g.player, target)) return true;
    if (g.status !== "playing" || g.rewardChoicePending) return false;
    const route = pathBetween(g.player, target, g.walls);
    if (!route || route.length < 2) return false;
    run.stepTo(route[1]);
  }
  return false;
}

/** A live route in which the Explorer holds an unspent Second Chance. */
function armedRun(combo, seed) {
  const run = RT.mount({ seed, ...combo });
  const chest = run.state.chestPosition;
  if (!chest) return null;
  if (!walkToCell(run, chest)) return null;
  if (!run.state.rewardChoicePending) return null;
  run.choose("second-chance");
  if (run.state.status !== "playing" || !run.state.secondChanceAvailable) return null;
  return run;
}

const overlapReports = [];

/**
 * What the resolution is answerable for.
 *
 * The Explorer must not end up sharing a cell with a defender — that is the
 * capture being genuinely averted rather than merely not scored. And the
 * activation must not INTRODUCE an overlap: every piece returns to the cell it
 * held when the turn began, so whatever was true then is still true.
 *
 * Hunter-and-Sentinel co-occupancy is forbidden by the shared defender-phase
 * contract. A Second Chance may restore only the two distinct cells held at the
 * beginning of the turn.
 */
function checkOverlap(game, before, label, extra = {}) {
  const cells = {
    player: cellKey(game.player),
    guardian: cellKey(game.guardian),
    sentinel: cellKey(game.sentinel),
  };
  const explorerClear =
    cells.player !== cells.guardian && cells.player !== cells.sentinel;
  const onWall = Object.values(cells).some((c) => game.walls.has(c));
  const inBoard = [game.player, game.guardian, game.sentinel].every(
    (p) => p.row >= 0 && p.row <= 8 && p.col >= 0 && p.col <= 8,
  );
  const defendersSharedBefore = before.guardian === before.sentinel;
  const defendersShareAfter = cells.guardian === cells.sentinel;
  const introducedAnOverlap = defendersShareAfter && !defendersSharedBefore;
  const report = {
    label,
    before,
    after: cells,
    explorerClear,
    onWall,
    inBoard,
    defendersSharedBefore,
    defendersShareAfter,
    introducedAnOverlap,
    ...extra,
  };
  overlapReports.push(report);
  return explorerClear && !onWall && inBoard && !defendersShareAfter;
}

/**
 * Walk the Explorer at the Hunter and step onto its cell. The Explorer moves
 * first each turn, so the Hunter is exactly where the previous turn left it.
 */
function provokeExplorerCapture(run) {
  for (let turn = 0; turn < 40; turn += 1) {
    const g = run.state;
    if (g.status !== "playing" || g.rewardChoicePending) return null;
    const target = adjacent(g.player, g.guardian)
      ? g.guardian
      : adjacent(g.player, g.sentinel)
        ? g.sentinel
        : null;
    if (target) {
      const before = {
        player: cellKey(g.player),
        guardian: cellKey(g.guardian),
        sentinel: cellKey(g.sentinel),
        turns: g.turns,
        spent: g.rewardSpent,
        into: cellKey(target),
        victim: sameCell(target, g.guardian) ? "hunter" : "sentinel",
      };
      run.stepTo(target);
      return { before, after: run.state, kind: "explorer-walked-in" };
    }
    const route = pathBetween(g.player, g.guardian, g.walls);
    if (!route || route.length < 2) return null;
    run.stepTo(route[1]);
  }
  return null;
}

/**
 * Pace beside the Hunter without entering it. The Hunter is Manhattan-greedy, so
 * it closes the gap and eventually steps onto the Explorer itself.
 */
function provokeDefenderCapture(run) {
  for (let turn = 0; turn < 40; turn += 1) {
    const g = run.state;
    if (g.status !== "playing" || g.rewardChoicePending) return null;
    const before = {
      player: cellKey(g.player),
      guardian: cellKey(g.guardian),
      sentinel: cellKey(g.sentinel),
      turns: g.turns,
      spent: g.rewardSpent,
    };
    const options = walkableNeighbours(g.player, g.walls).filter(
      (cell) => !sameCell(cell, g.guardian) && !sameCell(cell, g.sentinel),
    );
    if (!options.length) return null;
    // Stay near the Hunter without touching it: keep it interested.
    options.sort(
      (a, b) =>
        Math.abs(a.row - g.guardian.row) +
        Math.abs(a.col - g.guardian.col) -
        (Math.abs(b.row - g.guardian.row) + Math.abs(b.col - g.guardian.col)),
    );
    run.stepTo(options[0]);
    const after = run.state;
    const captured =
      after.rewardSpent !== before.spent || after.status === "lost";
    if (captured) return { before, after, kind: "defender-walked-in" };
  }
  return null;
}

// ---------------------------------------------------------------------------
// P / Q / S — the first capture is survived, from both directions
// ---------------------------------------------------------------------------
const saves = [];
{
  for (const [index, combo] of COMBOS.entries()) {
    for (let i = 0; i < 120 && saves.filter((s) => s.combo === `${combo.difficulty}/r${combo.routeNumber}`).length < 6; i += 1) {
      const seed = 8_100_000 + index * 1_000 + i;
      for (const provoke of [provokeExplorerCapture, provokeDefenderCapture]) {
        const run = armedRun(combo, seed);
        if (!run) continue;
        const event = provoke(run);
        if (!event) continue;
        const { before, after, kind } = event;
        if (after.rewardSpent === before.spent) continue; // no capture happened
        saves.push({
          seed,
          combo: `${combo.difficulty}/r${combo.routeNumber}`,
          kind,
          victim: before.victim ?? "hunter-or-sentinel",
          before,
          after: {
            player: cellKey(after.player),
            guardian: cellKey(after.guardian),
            sentinel: cellKey(after.sentinel),
            turns: after.turns,
            status: after.status,
            rewardSpent: after.rewardSpent,
            secondChanceAvailable: after.secondChanceAvailable,
            secondChanceSpent: after.secondChanceSpent,
            message: after.message,
          },
          survived: after.status === "playing",
          chargeConsumed: after.rewardSpent === true,
          turnCounted: after.turns === before.turns + 1,
          // The undo, stated as the contract states it.
          explorerStayedPut:
            kind === "explorer-walked-in"
              ? cellKey(after.player) === before.player
              : true,
          defendersReturned:
            kind === "defender-walked-in"
              ? cellKey(after.guardian) === before.guardian &&
                cellKey(after.sentinel) === before.sentinel
              : cellKey(after.guardian) === before.guardian &&
                cellKey(after.sentinel) === before.sentinel,
          noOverlap: checkOverlap(after, before, `${kind}@${seed}`),
        });
      }
    }
  }

  const byExplorer = saves.filter((s) => s.kind === "explorer-walked-in");
  const byDefender = saves.filter((s) => s.kind === "defender-walked-in");
  const hunterVictims = saves.filter((s) => s.victim === "hunter" || s.kind === "defender-walked-in");
  const sentinelVictims = saves.filter((s) => s.victim === "sentinel");

  record(
    "P",
    "HUNTER_CAPTURE",
    hunterVictims.length > 0 &&
      hunterVictims.every(
        (s) => s.survived && s.chargeConsumed && s.turnCounted && s.defendersReturned,
      ),
    {
      captures: hunterVictims.length,
      byExplorerWalkingIn: byExplorer.length,
      byDefenderWalkingIn: byDefender.length,
      sample: hunterVictims.slice(0, 3),
    },
  );

  record(
    "Q",
    "SENTINEL_CAPTURE",
    sentinelVictims.length > 0 &&
      sentinelVictims.every(
        (s) => s.survived && s.chargeConsumed && s.turnCounted && s.explorerStayedPut,
      ),
    { captures: sentinelVictims.length, sample: sentinelVictims.slice(0, 3) },
  );

  record(
    "S",
    "NO_OVERLAP",
    saves.length > 0 && saves.every((s) => s.noOverlap),
    {
      activationsChecked: saves.length,
      explorerSharedACellWithADefender: overlapReports.filter((r) => !r.explorerClear)
        .length,
      landedOnAWall: overlapReports.filter((r) => r.onWall).length,
      landedOffBoard: overlapReports.filter((r) => !r.inBoard).length,
      overlapsIntroducedByTheResolution: overlapReports.filter(
        (r) => r.introducedAnOverlap,
      ).length,
      defenderCoOccupancyCarriedInFromBeforeTheTurn: overlapReports.filter(
        (r) => r.defendersSharedBefore,
      ).length,
      violations: overlapReports.filter(
        (r) => !r.explorerClear || r.onWall || !r.inBoard || r.defendersShareAfter,
      ),
      proof:
        "every piece returns to its distinct start-of-turn cell; defender co-occupancy is forbidden",
    },
  );
}

// ---------------------------------------------------------------------------
// R — the second capture ends the route normally
// ---------------------------------------------------------------------------
{
  const seconds = [];
  for (const [index, combo] of COMBOS.entries()) {
    for (let i = 0; i < 90 && seconds.length < index + 1; i += 1) {
      const seed = 8_400_000 + index * 1_000 + i;
      const run = armedRun(combo, seed);
      if (!run) continue;
      const first = provokeExplorerCapture(run);
      if (!first || run.state.rewardSpent !== true) continue;
      if (run.state.status !== "playing") continue;

      const beforeSecond = {
        turns: run.state.turns,
        completions: run.completions.length,
      };
      const second = provokeExplorerCapture(run);
      if (!second) continue;
      seconds.push({
        seed,
        combo: `${combo.difficulty}/r${combo.routeNumber}`,
        firstSurvived: true,
        secondStatus: run.state.status,
        defeated: run.state.status === "lost",
        completionsBefore: beforeSecond.completions,
        completionsAfter: run.completions.length,
        wonFlag: run.completions.at(-1)?.details?.won,
        chestOpenedInResult: run.completions.at(-1)?.details?.chestOpened,
        rewardInResult: run.completions.at(-1)?.details?.rewardChosen,
      });
    }
  }
  record(
    "R",
    "SECOND_CAPTURE",
    seconds.length > 0 &&
      seconds.every(
        (s) =>
          s.defeated &&
          s.completionsAfter === s.completionsBefore + 1 &&
          s.wonFlag === false,
      ),
    { runs: seconds },
  );
}

// ---------------------------------------------------------------------------
// T — the same state and the same capture always resolve the same way
// ---------------------------------------------------------------------------
{
  const replays = [];
  for (const [index, combo] of COMBOS.entries()) {
    for (let i = 0; i < 90 && replays.length < index + 1; i += 1) {
      const seed = 8_700_000 + index * 1_000 + i;
      const play = () => {
        const run = armedRun(combo, seed);
        if (!run) return null;
        const event = provokeExplorerCapture(run);
        if (!event || run.state.rewardSpent !== true) return null;
        const g = run.state;
        return {
          player: cellKey(g.player),
          guardian: cellKey(g.guardian),
          sentinel: cellKey(g.sentinel),
          turns: g.turns,
          status: g.status,
          rewardSpent: g.rewardSpent,
          message: g.message,
          walls: [...g.walls].sort().join("|"),
        };
      };
      const a = play();
      const b = play();
      if (!a || !b) continue;
      replays.push({
        seed,
        combo: `${combo.difficulty}/r${combo.routeNumber}`,
        identical: JSON.stringify(a) === JSON.stringify(b),
        resolution: a,
      });
    }
  }
  record("T", "DETERMINISTIC_RESOLUTION", replays.length > 0 && replays.every((r) => r.identical), {
    replays,
  });
}

const allPass = tests.every((t) => t.pass);
EVIDENCE.write("second-chance-controlled-tests.json", {
  mission: "ROTA-CHEST-REWARDS-01",
  suite: "SECOND_CHANCE",
  driver:
    "tools/validation/route-runtime-harness.mjs drives the real useEscapeMaze hook",
  resolution:
    "the move that produced the overlap is undone; when a defender was the one that moved in, BOTH defenders return to the cells they held at the start of the turn, and the turn ends there",
  contract: [
    "one charge",
    "works against the Hunter and against the Sentinel",
    "the first valid capture consumes the charge and does not end the route",
    "the second capture defeats normally",
    "the turn is still counted; the Explorer never gains a second action",
    "no two pieces ever share a cell after an activation",
    "same state, same capture, same resolution",
  ],
  occupancyContract: {
    id: "DEFENDER_CO_OCCUPANCY_FORBIDDEN",
    detail:
      "Hunter destinations exclude the Sentinel's current cell; Sentinel settlement excludes the Hunter's destination.",
    measuredBy:
      "ROTA-DYNAMIC-SOLVABILITY-02 broad campaign and this Second Chance regression",
  },
  tests,
  allPass,
});
console.log(`\n${allPass ? "SECOND_CHANCE_CONTRACT_OK" : "SECOND_CHANCE_CONTRACT_FAILED"}`);
process.exitCode = EVIDENCE.finish({ ok: allPass });
