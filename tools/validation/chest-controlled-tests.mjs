/**
 * ROTA-CHEST-REWARDS-01 — the Chest contract, asserted (§33 A–H).
 *
 * Every test drives the real `useEscapeMaze` through the headless harness, so
 * what passes here is the code that ships, including the turn order that makes
 * the reward choice safe.
 *
 * Usage: node tools/validation/chest-controlled-tests.mjs [--check|--update]
 */
import { loadRouteRuntime, cellKey, sameCell } from "./route-runtime-harness.mjs";
import { openEvidence } from "./evidence.mjs";

const EVIDENCE = openEvidence(
  process.env.ROUTE_VALIDATION_OUTPUT_DIR ??
    "docs/archive/route-chest-rewards-01",
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

/**
 * A run in which the Explorer actually reaches the Chest alive. Search is over
 * seeds only; nothing about the map is arranged.
 */
function findChestRun(combo, baseSeed, limit = 60) {
  for (let i = 0; i < limit; i += 1) {
    const seed = baseSeed + i;
    const run = RT.mount({ seed, ...combo });
    const chest = run.state.chestPosition;
    if (!chest) continue;
    const before = {
      guardian: cellKey(run.state.guardian),
      sentinel: cellKey(run.state.sentinel),
      turns: run.state.turns,
    };
    // Snapshot the defenders on the step BEFORE the Chest, so the pause can be
    // measured against the position they actually held.
    let atChest = false;
    let priorDefenders = before;
    for (let step = 0; step < 64; step += 1) {
      const game = run.state;
      if (sameCell(game.player, chest)) {
        atChest = true;
        break;
      }
      if (game.status !== "playing" || game.rewardChoicePending) break;
      priorDefenders = {
        guardian: cellKey(game.guardian),
        sentinel: cellKey(game.sentinel),
        turns: game.turns,
      };
      const next = require_step(game, chest);
      if (!next) break;
      run.stepTo(next);
    }
    if (atChest && run.state.status === "playing") {
      return { seed, combo, run, priorDefenders };
    }
  }
  return null;
}

function require_step(game, target) {
  const path = pathFrom(game.player, target, game.walls);
  return path && path.length >= 2 ? path[1] : null;
}

function pathFrom(from, to, walls) {
  const previous = new Map([[cellKey(from), null]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i += 1) {
    const current = queue[i];
    if (sameCell(current, to)) {
      const cells = [];
      let cursor = cellKey(current);
      while (cursor) {
        const [row, col] = cursor.split(",").map(Number);
        cells.unshift({ row, col });
        cursor = previous.get(cursor);
      }
      return cells;
    }
    for (const delta of [
      { row: -1, col: 0 },
      { row: 1, col: 0 },
      { row: 0, col: -1 },
      { row: 0, col: 1 },
    ]) {
      const next = { row: current.row + delta.row, col: current.col + delta.col };
      if (next.row < 0 || next.row > 8 || next.col < 0 || next.col > 8) continue;
      const key = cellKey(next);
      if (walls.has(key) || previous.has(key)) continue;
      previous.set(key, cellKey(current));
      queue.push(next);
    }
  }
  return null;
}

const fixtures = COMBOS.map((combo, index) =>
  findChestRun(combo, 6_100_000 + index * 1_000),
).filter(Boolean);

if (fixtures.length !== COMBOS.length) {
  record("FIXTURES", "CHEST_REACHABLE", false, {
    wanted: COMBOS.length,
    found: fixtures.length,
  });
}

// ---------------------------------------------------------------------------
// A — CHEST_CLOSED
// ---------------------------------------------------------------------------
{
  const closed = COMBOS.map((combo, index) => {
    const run = RT.mount({ seed: 6_200_000 + index, ...combo });
    const g = run.state;
    return {
      combo: `${combo.difficulty}/r${combo.routeNumber}`,
      chest: g.chestPosition ? cellKey(g.chestPosition) : null,
      chestOpened: g.chestOpened,
      rewardSelected: g.rewardSelected,
      pickaxeAvailable: g.pickaxeAvailable,
      secondChanceAvailable: g.secondChanceAvailable,
      rewardChoicePending: g.rewardChoicePending,
    };
  });
  const pass = closed.every(
    (c) =>
      c.chest !== null &&
      c.chestOpened === false &&
      c.rewardSelected === null &&
      !c.pickaxeAvailable &&
      !c.secondChanceAvailable &&
      !c.rewardChoicePending,
  );
  record("A", "CHEST_CLOSED", pass, { runs: closed });
}

// ---------------------------------------------------------------------------
// B / C — CHEST_OPEN and CHOICE_PAUSE
// ---------------------------------------------------------------------------
{
  const opened = [];
  const paused = [];
  let anyDefenderMovedAfterChoice = false;

  for (const fixture of fixtures) {
    const { run, priorDefenders, combo, seed } = fixture;
    const atChest = run.state;
    opened.push({
      seed,
      combo: `${combo.difficulty}/r${combo.routeNumber}`,
      playerOnChest: sameCell(atChest.player, atChest.chestPosition),
      chestOpened: atChest.chestOpened,
      rewardChoicePending: atChest.rewardChoicePending,
      rewardSelected: atChest.rewardSelected,
    });

    // §12.5: while the UI waits, nothing may move. Compared against the
    // positions the defenders held on the step BEFORE the Chest, because the
    // Chest turn's defender phase has not run yet.
    const duringPause = {
      guardian: cellKey(atChest.guardian),
      sentinel: cellKey(atChest.sentinel),
      turns: atChest.turns,
    };
    const turnBeforeChoice = atChest.turns;
    run.choose("pickaxe");
    const afterChoice = run.state;
    paused.push({
      seed,
      defendersBeforeChest: priorDefenders,
      defendersDuringPause: duringPause,
      defendersStill:
        duringPause.guardian === priorDefenders.guardian &&
        duringPause.sentinel === priorDefenders.sentinel,
      turnsDuringPause: turnBeforeChoice,
      turnsAfterChoice: afterChoice.turns,
      // §12.6: the choice is not a turn of its own.
      choiceIsNotATurn: afterChoice.turns === turnBeforeChoice,
      defendersAfterChoice: {
        guardian: cellKey(afterChoice.guardian),
        sentinel: cellKey(afterChoice.sentinel),
      },
    });
    if (
      cellKey(afterChoice.guardian) !== duringPause.guardian ||
      cellKey(afterChoice.sentinel) !== duringPause.sentinel
    ) {
      anyDefenderMovedAfterChoice = true;
    }
  }

  record("B", "CHEST_OPEN", opened.every((o) => o.playerOnChest && o.chestOpened && o.rewardChoicePending), {
    runs: opened,
  });
  record(
    "C",
    "CHOICE_PAUSE",
    paused.length > 0 &&
      paused.every((p) => p.defendersStill && p.choiceIsNotATurn) &&
      // The phase must actually run afterwards, or "nobody moved" would be
      // trivially true because nobody ever moves.
      anyDefenderMovedAfterChoice,
    { runs: paused, defenderPhaseObservedAfterChoice: anyDefenderMovedAfterChoice },
  );
}

// ---------------------------------------------------------------------------
// D / E / F — the two rewards exclude each other
// ---------------------------------------------------------------------------
{
  const picks = [];
  for (const reward of ["pickaxe", "second-chance"]) {
    for (const [index, combo] of COMBOS.entries()) {
      const fixture = findChestRun(combo, 6_300_000 + index * 1_000);
      if (!fixture) continue;
      fixture.run.choose(reward);
      const g = fixture.run.state;
      picks.push({
        reward,
        combo: `${combo.difficulty}/r${combo.routeNumber}`,
        seed: fixture.seed,
        rewardSelected: g.rewardSelected,
        pickaxeAvailable: g.pickaxeAvailable,
        secondChanceAvailable: g.secondChanceAvailable,
        bothHeld: g.pickaxeAvailable && g.secondChanceAvailable,
      });
    }
  }
  const pickaxePicks = picks.filter((p) => p.reward === "pickaxe");
  const secondPicks = picks.filter((p) => p.reward === "second-chance");
  record(
    "D",
    "PICKAXE_SELECTED",
    pickaxePicks.length > 0 &&
      pickaxePicks.every(
        (p) =>
          p.rewardSelected === "pickaxe" &&
          p.pickaxeAvailable &&
          !p.secondChanceAvailable,
      ),
    { runs: pickaxePicks },
  );
  record(
    "E",
    "SECOND_CHANCE_SELECTED",
    secondPicks.length > 0 &&
      secondPicks.every(
        (p) =>
          p.rewardSelected === "second-chance" &&
          p.secondChanceAvailable &&
          !p.pickaxeAvailable,
      ),
    { runs: secondPicks },
  );
  record("F", "NO_DOUBLE_REWARD", picks.length > 0 && picks.every((p) => !p.bothHeld), {
    runsChecked: picks.length,
    note:
      "structural: `rewardSelected` is a single slot, so holding one is holding not-the-other",
  });
}

// ---------------------------------------------------------------------------
// G — CHEST_ALREADY_OPEN: leaving and coming back changes nothing
// ---------------------------------------------------------------------------
{
  const revisits = [];
  for (const [index, combo] of COMBOS.entries()) {
    const fixture = findChestRun(combo, 6_400_000 + index * 1_000);
    if (!fixture) continue;
    const { run } = fixture;
    run.choose("second-chance");
    if (run.state.status !== "playing") continue;
    const chest = run.state.chestPosition;
    const before = {
      reward: run.state.rewardSelected,
      spent: run.state.rewardSpent,
    };
    // Step off the Chest and back onto it.
    const away = pathFrom(run.state.player, chest, run.state.walls);
    const neighbour = [
      { row: chest.row - 1, col: chest.col },
      { row: chest.row + 1, col: chest.col },
      { row: chest.row, col: chest.col - 1 },
      { row: chest.row, col: chest.col + 1 },
    ].find(
      (n) =>
        n.row >= 0 &&
        n.row <= 8 &&
        n.col >= 0 &&
        n.col <= 8 &&
        !run.state.walls.has(cellKey(n)),
    );
    if (!away || !neighbour) continue;
    run.stepTo(neighbour);
    if (run.state.status !== "playing") continue;
    run.stepTo(chest);
    const after = run.state;
    revisits.push({
      seed: fixture.seed,
      combo: `${combo.difficulty}/r${combo.routeNumber}`,
      backOnChest: sameCell(after.player, chest),
      rewardChoicePending: after.rewardChoicePending,
      chestOpened: after.chestOpened,
      rewardUnchanged:
        after.rewardSelected === before.reward && after.rewardSpent === before.spent,
    });
  }
  record(
    "G",
    "CHEST_ALREADY_OPEN",
    revisits.length > 0 &&
      revisits.every(
        (r) =>
          r.backOnChest &&
          !r.rewardChoicePending &&
          r.chestOpened &&
          r.rewardUnchanged,
      ),
    { runs: revisits },
  );
}

// ---------------------------------------------------------------------------
// H — RESET: restart and the next route both start from a closed Chest
// ---------------------------------------------------------------------------
{
  const resets = [];
  for (const [index, combo] of COMBOS.entries()) {
    const fixture = findChestRun(combo, 6_500_000 + index * 1_000);
    if (!fixture) continue;
    const { run } = fixture;
    run.choose("pickaxe");
    const held = {
      chestOpened: run.state.chestOpened,
      reward: run.state.rewardSelected,
    };
    run.restart();
    const afterRestart = run.state;
    run.continueJourney();
    const afterNextRoute = run.state;
    resets.push({
      seed: fixture.seed,
      combo: `${combo.difficulty}/r${combo.routeNumber}`,
      held,
      afterRestart: {
        chestOpened: afterRestart.chestOpened,
        rewardSelected: afterRestart.rewardSelected,
        rewardSpent: afterRestart.rewardSpent,
        brokenWall: afterRestart.brokenWall,
        turns: afterRestart.turns,
      },
      afterNextRoute: {
        chestOpened: afterNextRoute.chestOpened,
        rewardSelected: afterNextRoute.rewardSelected,
        rewardSpent: afterNextRoute.rewardSpent,
        brokenWall: afterNextRoute.brokenWall,
      },
    });
  }
  const clean = (s) =>
    s.chestOpened === false &&
    s.rewardSelected === null &&
    s.rewardSpent === false &&
    s.brokenWall === null;
  record(
    "H",
    "RESET",
    resets.length > 0 &&
      resets.every((r) => clean(r.afterRestart) && clean(r.afterNextRoute)),
    { runs: resets },
  );
}

const allPass = tests.every((t) => t.pass);
EVIDENCE.write("chest-controlled-tests.json", {
  mission: "ROTA-CHEST-REWARDS-01",
  suite: "CHEST",
  driver:
    "tools/validation/route-runtime-harness.mjs drives the real useEscapeMaze hook",
  contract: [
    "the Chest is closed until the Explorer enters its cell",
    "entering opens it and PAUSES the turn: no defender acts while the choice is open",
    "choosing is not a turn of its own; the same turn resumes with Hunter then Sentinel",
    "exactly one reward is ever held; choosing one removes the other for that route",
    "an opened Chest never opens again",
    "restart and the next route restore the closed Chest and drop the reward",
  ],
  tests,
  allPass,
});
console.log(`\n${allPass ? "CHEST_CONTRACT_OK" : "CHEST_CONTRACT_FAILED"}`);
process.exitCode = EVIDENCE.finish({ ok: allPass });
