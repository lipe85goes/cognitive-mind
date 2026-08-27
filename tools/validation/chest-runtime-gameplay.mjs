/**
 * ROTA-CHEST-REWARDS-01 — §36-§40 regressions and §47 automated gameplay.
 *
 * Two jobs in one sweep, because they need the same runs:
 *
 *  1. REGRESSION — with nothing broken, the board must behave exactly as it did
 *     before the Chest existed. Traps still arm on arrival and still block only
 *     the defenders; the Sentinel still holds a door for three turns, still
 *     never stands on the portal, still keeps its leash; the Hunter still plays
 *     the same policy; the portal still refuses to open without every light.
 *
 *  2. GAMEPLAY — all nine combinations (3 routes x 3 modes), played through
 *     Chest opening, both reward choices, a wall break, a defender using the
 *     opening, traps and breaks coexisting, victory, defeat and reset. The bar
 *     is correctness and no crash, never a win rate.
 *
 * Usage: node tools/validation/chest-runtime-gameplay.mjs [--check|--update]
 */
import {
  loadRouteRuntime,
  sameCell,
  pathBetween,
  walkableNeighbours,
} from "./route-runtime-harness.mjs";
import { auditBreakableWalls } from "./breakable-wall-certifier.mjs";
import { openEvidence } from "./evidence.mjs";

const EVIDENCE = openEvidence(
  process.env.ROUTE_VALIDATION_OUT ?? "docs/archive/route-chest-rewards-01",
);

const RT = loadRouteRuntime();
const API = RT.API;
const kOf = (p) => API.posKey(p);
const toCell = (key) => {
  const [row, col] = key.split(",").map(Number);
  return { row, col };
};
/** Rotates which wall each scenario breaks, so the sweep never fixates. */
let wallRotation = 0;

/**
 * What the RETIRED certifier would have approved on this board. Recorded only so
 * the sweep can show it exercised walls outside that set (§31); it has no
 * authority over anything.
 */
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
      .map((c) => kOf(c.position)),
  );
}

const COMBOS = [];
for (const routeNumber of [1, 2, 3]) {
  for (const difficulty of ["easy", "medium", "hard"]) {
    COMBOS.push({ routeNumber, difficulty });
  }
}

const checks = [];
const record = (id, name, pass, detail) => {
  checks.push({ id, name, pass, ...detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${name}`);
};

/**
 * Walk to a cell without ever stepping onto a defender.
 *
 * A route computed from the walls alone will happily path straight through the
 * Hunter, which is a capture, not a walk — and it silently turned three trap
 * observations into "the trap failed to arm" on the first version of this file.
 * Defenders are treated as blocked here; if that leaves no route this turn, the
 * walk gives up rather than pretending.
 */
function walkToCell(run, target, budget = 60) {
  for (let step = 0; step < budget; step += 1) {
    const g = run.state;
    if (sameCell(g.player, target)) return true;
    if (g.status !== "playing" || g.rewardChoicePending) return false;
    const blocked = new Set([...g.walls, kOf(g.guardian), kOf(g.sentinel)]);
    blocked.delete(kOf(target));
    const route = pathBetween(g.player, target, blocked);
    if (!route || route.length < 2) return false;
    if (sameCell(route[1], g.guardian) || sameCell(route[1], g.sentinel)) return false;
    run.stepTo(route[1]);
  }
  return false;
}

/** Every light in the cheapest order, then the portal. The route's own task. */
function playObjective(run, { onTurn } = {}) {
  for (let guard = 0; guard < 140; guard += 1) {
    const g = run.state;
    if (g.status !== "playing") return g.status;
    if (g.rewardChoicePending) return "pending";
    onTurn?.(g);
    const remaining = g.mazeMap.collectibleStars.filter(
      (star) => !g.collectedSet.has(kOf(star)),
    );
    const goal = remaining.length ? remaining : [g.mazeMap.exitPosition];
    let best = null;
    for (const target of goal) {
      const route = pathBetween(g.player, target, g.walls);
      if (route && (!best || route.length < best.length)) best = route;
    }
    if (!best || best.length < 2) return "stuck";
    run.stepTo(best[1]);
  }
  return "budget";
}

// ===========================================================================
// 1. REGRESSION — nothing broken means nothing changed
// ===========================================================================

// --- §37/§38: with no wall broken, both defender policies are bit-identical --
{
  let hunterDiffs = 0;
  let sentinelDiffs = 0;
  let compared = 0;
  let sentinelOnPortal = 0;
  let commitOverruns = 0;
  let leashBreaks = 0;

  for (const { routeNumber, difficulty } of COMBOS) {
    for (let i = 0; i < 4; i += 1) {
      const seed = 9_100_000 + routeNumber * 1_000 + i;
      RT.LAB.setSeed(seed);
      const map = API.generateMaze(difficulty, routeNumber);
      const zone = API.computePortalDefenceZone(
        map.playerStart,
        map.exitPosition,
        map.walls,
      );
      let sentinel = API.createSentinelState(map, zone);
      let hunter = { ...map.guardianStart };
      let player = { ...map.playerStart };
      const toPortal = API.getReachableDistances(map.exitPosition, map.walls);

      for (let turn = 0; turn < 18; turn += 1) {
        const options = API.getNeighbors(player, map.walls);
        if (!options.length) break;
        options.sort(
          (a, b) => (toPortal.get(kOf(a)) ?? 99) - (toPortal.get(kOf(b)) ?? 99),
        );
        player = options[0];

        // Passing the map's own wall set (what "nothing broken" means) must
        // reproduce the 01B/traps behaviour exactly.
        const turnSeed = 9_300_000 + turn;
        RT.LAB.setSeed(turnSeed);
        const a = API.chooseGuardianMove(
          hunter, player, map.exitPosition, map.walls, difficulty,
        );
        RT.LAB.setSeed(turnSeed);
        const b = API.chooseGuardianMove(
          hunter, player, map.exitPosition, map.walls, difficulty, new Set(),
        );
        if (kOf(a) !== kOf(b)) hunterDiffs += 1;
        hunter = a;

        const sa = API.decideSentinelMove(
          sentinel, player, map.exitPosition, map.walls, zone,
        );
        const sb = API.decideSentinelMove(
          sentinel, player, map.exitPosition, map.walls, zone, 3, new Set(),
        );
        if (
          kOf(sa.position) !== kOf(sb.position) ||
          sa.commitLeft !== sb.commitLeft ||
          (sa.target ? kOf(sa.target) : null) !== (sb.target ? kOf(sb.target) : null)
        ) {
          sentinelDiffs += 1;
        }
        sentinel = sa;
        compared += 1;

        if (kOf(sentinel.position) === kOf(map.exitPosition)) sentinelOnPortal += 1;
        if (sentinel.commitLeft > 3) commitOverruns += 1;
        const home = API.findPathLength(sentinel.position, map.exitPosition, map.walls);
        if (home !== null && home > 4) leashBreaks += 1;
      }
    }
  }

  record(
    "REG-SENTINEL",
    "SENTINEL_C3_UNCHANGED",
    sentinelDiffs === 0 && sentinelOnPortal === 0 && commitOverruns === 0 && leashBreaks === 0,
    {
      statesCompared: compared,
      divergences: sentinelDiffs,
      portalOccupancy: sentinelOnPortal,
      commitTurnsMax: 3,
      commitOverruns,
      leashBreaks,
    },
  );
  record("REG-HUNTER", "HUNTER_POLICY_UNCHANGED", hunterDiffs === 0, {
    statesCompared: compared,
    divergences: hunterDiffs,
  });
}

// --- §36: traps still arm on arrival and still block only the defenders -----
{
  let trapsArmed = 0;
  let explorerBlockedByArmedTrap = 0;
  let hunterEnteredArmed = 0;
  let sentinelEnteredArmed = 0;
  let explorerCrossedArmed = 0;
  let trapPenalties = 0;
  let armedAfterReset = 0;
  let multipleArmed = 0;

  for (const { routeNumber, difficulty } of COMBOS) {
    for (let i = 0; i < 3; i += 1) {
      const run = RT.mount({ seed: 9_500_000 + routeNumber * 100 + i, difficulty, routeNumber });
      const traps = run.state.mazeMap.traps;
      for (const trap of traps) {
        const g = run.state;
        if (g.status !== "playing" || g.rewardChoicePending) break;
        const errorsBefore = g.errors;
        // A defender parked on the trap makes this an ambush, not a trap test.
        if (sameCell(g.guardian, trap) || sameCell(g.sentinel, trap)) continue;
        if (!walkToCell(run, trap, 30)) continue;
        const after = run.state;
        if (!sameCell(after.player, trap) || after.status !== "playing") continue;
        trapsArmed += 1;
        if (!after.triggeredTrapSet.has(kOf(trap))) explorerBlockedByArmedTrap += 1;
        if (after.errors !== errorsBefore) trapPenalties += 1;
        if (kOf(after.guardian) === kOf(trap)) hunterEnteredArmed += 1;
        if (kOf(after.sentinel) === kOf(trap)) sentinelEnteredArmed += 1;
        // The Explorer keeps crossing its own armed trap.
        const back = walkableNeighbours(trap, after.walls)[0];
        if (back && after.status === "playing") {
          run.stepTo(back);
          if (run.state.status === "playing") {
            run.stepTo(trap);
            if (sameCell(run.state.player, trap)) explorerCrossedArmed += 1;
          }
        }
      }
      const armed = run.state.triggeredTrapSet.size;
      if (armed >= 2) multipleArmed += 1;
      run.restart();
      if (run.state.triggeredTrapSet.size !== 0) armedAfterReset += 1;
    }
  }

  record(
    "REG-TRAPS",
    "TRAPS_UNCHANGED",
    trapsArmed > 0 &&
      explorerBlockedByArmedTrap === 0 &&
      hunterEnteredArmed === 0 &&
      sentinelEnteredArmed === 0 &&
      explorerCrossedArmed > 0 &&
      trapPenalties === 0 &&
      armedAfterReset === 0,
    {
      trapsArmedOnArrival: trapsArmed,
      trapsThatFailedToArm: explorerBlockedByArmedTrap,
      explorerRecrossedArmedTrap: explorerCrossedArmed,
      hunterOnArmedTrap: hunterEnteredArmed,
      sentinelOnArmedTrap: sentinelEnteredArmed,
      penaltiesToExplorer: trapPenalties,
      runsWithSeveralArmed: multipleArmed,
      armedAfterReset,
    },
  );
}

// --- §39/§40: the portal and the lights are untouched by any of this --------
{
  let portalRefusals = 0;
  let earlyWins = 0;
  let lightsChangedByBreak = 0;
  let lightsCollectedByBreak = 0;
  let portalOpenedWithoutLights = 0;

  for (const { routeNumber, difficulty } of COMBOS) {
    const run = RT.mount({ seed: 9_700_000 + routeNumber * 100, difficulty, routeNumber });
    const g0 = run.state;
    const lightsAtStart = g0.totalLights;

    // Walk onto the portal with lights still missing: it must refuse.
    if (walkToCell(run, g0.mazeMap.exitPosition, 40)) {
      const g = run.state;
      if (sameCell(g.player, g.mazeMap.exitPosition)) {
        if (!g.portalActive) {
          portalRefusals += 1;
          if (g.status === "won") earlyWins += 1;
        }
        if (g.portalActive && g.collectedCount < g.totalLights) {
          portalOpenedWithoutLights += 1;
        }
      }
    }

    // Now take the Chest, break a wall, and check the lights did not move.
    const chestRun = RT.mount({
      seed: 9_700_000 + routeNumber * 100,
      difficulty,
      routeNumber,
    });
    const chest = chestRun.state.chestPosition;
    if (chest && walkToCell(chestRun, chest, 40) && chestRun.state.rewardChoicePending) {
      chestRun.choose("pickaxe");
      // Any wall will do — free choice means the first one the Explorer can
      // reach is as valid a target as any other.
      const wall = [...chestRun.state.walls]
        .map(toCell)
        .find((w) =>
          walkableNeighbours(w, chestRun.state.walls).some((c) =>
            pathBetween(chestRun.state.player, c, chestRun.state.walls),
          ),
        );
      const approach =
        wall && walkableNeighbours(wall, chestRun.state.walls)
          .find((c) => pathBetween(chestRun.state.player, c, chestRun.state.walls));
      if (approach && walkToCell(chestRun, approach, 40)) {
        if (chestRun.state.breakTargets.some((t) => sameCell(t.cell, wall))) {
          // Snapshot immediately before the break. Taken before the WALK, the
          // delta would also contain every light picked up on the way there.
          const lightsBefore = chestRun.state.collectedCount;
          const totalBefore = chestRun.state.totalLights;
          chestRun.break(wall);
          const after = chestRun.state;
          if (after.totalLights !== totalBefore) lightsChangedByBreak += 1;
          if (after.collectedCount !== lightsBefore) lightsCollectedByBreak += 1;
          if (after.portalActive && after.collectedCount < after.totalLights) {
            portalOpenedWithoutLights += 1;
          }
        }
      }
    }
    if (lightsAtStart !== g0.mazeMap.collectibleStars.length) lightsChangedByBreak += 1;
  }

  record(
    "REG-PORTAL",
    "PORTAL_AND_LIGHTS_UNCHANGED",
    portalRefusals > 0 &&
      earlyWins === 0 &&
      lightsChangedByBreak === 0 &&
      lightsCollectedByBreak === 0 &&
      portalOpenedWithoutLights === 0,
    {
      portalRefusedWithoutLights: portalRefusals,
      winsBeforeTheObjective: earlyWins,
      lightRequirementChangedByABreak: lightsChangedByBreak,
      lightCollectedByABreak: lightsCollectedByBreak,
      portalReadyWithoutEveryLight: portalOpenedWithoutLights,
    },
  );
}

// ===========================================================================
// 2. GAMEPLAY — the nine combinations, played
// ===========================================================================
const scenarios = [];
let crashes = 0;

for (const combo of COMBOS) {
  const label = `r${combo.routeNumber}/${combo.difficulty}`;
  for (const reward of ["pickaxe", "second-chance"]) {
    let played = null;
    for (let i = 0; i < 40 && !played; i += 1) {
      const seed = 9_900_000 + combo.routeNumber * 10_000 + i;
      try {
        const run = RT.mount({ seed, ...combo });
        const chest = run.state.chestPosition;
        if (!chest || !walkToCell(run, chest, 40)) continue;
        if (!run.state.rewardChoicePending) continue;
        run.choose(reward);
        if (run.state.status !== "playing") continue;

        const events = {
          chestOpened: run.state.chestOpened,
          reward: run.state.rewardSelected,
          wallBroken: false,
          defenderUsedOpening: false,
          trapsArmedBeforeBreak: 0,
          trapsArmedAfterBreak: 0,
          secondChanceFired: false,
        };

        if (reward === "pickaxe") {
          // Arm a trap first, so traps and a break coexist in one route.
          const trap = run.state.mazeMap.traps.find((t) =>
            pathBetween(run.state.player, t, run.state.walls),
          );
          if (trap && walkToCell(run, trap, 30)) {
            events.trapsArmedBeforeBreak = run.state.triggeredTrapSet.size;
          }
          /**
           * §31: the sweep must NOT keep testing the walls the retired certifier
           * liked. Each scenario walks to a different wall by rotating an index
           * through the map's whole wall list, and the report records whether
           * the wall it happened to break was in the old certified set — so
           * "we only ever exercised the approved subset" is falsifiable.
           */
          const allWalls = [...run.state.walls].sort().map(toCell);
          const reachable = allWalls.filter((w) =>
            walkableNeighbours(w, run.state.walls).some((c) =>
              pathBetween(run.state.player, c, run.state.walls),
            ),
          );
          /**
           * Prefer a wall with two sides.
           *
           * A degree-1 wall opens into a pocket: there is no far side to stand
           * on, so "a defender walked through the opening" is not merely
           * unlikely there, it is impossible. A third of the breaks were landing
           * on those, diluting the measurement with cases that could never
           * register. This is a PHYSICAL property of the opening, not the
           * retired certifier's significance rule — the rotation still walks the
           * whole list, and `wallWasInOldCertifiedSet` is still recorded, so the
           * sweep keeps exercising walls the old design would have refused.
           */
          const twoSided = reachable.filter(
            (w) => walkableNeighbours(w, run.state.walls).length >= 2,
          );
          const pool = twoSided.length ? twoSided : reachable;
          const wall = pool[wallRotation % Math.max(1, pool.length)];
          wallRotation += 3;
          const approach =
            wall &&
            walkableNeighbours(wall, run.state.walls).find((c) =>
              pathBetween(run.state.player, c, run.state.walls),
            );
          if (approach && walkToCell(run, approach, 40)) {
            if (run.state.breakTargets.some((t) => sameCell(t.cell, wall))) {
              const certified = certifiedSetOf(run.state);
              run.break(wall);
              events.wallBroken = run.state.brokenWall === kOf(wall);
              events.wall = kOf(wall);
              events.wallWasInOldCertifiedSet = certified.has(kOf(wall));
              events.oldCertifiedSetSize = certified.size;
              events.trapsArmedAfterBreak = run.state.triggeredTrapSet.size;
              /**
               * Cross the opening, then stay BEYOND it and never on it.
               *
               * The Hunter is Manhattan-greedy toward the Explorer, so standing
               * on the far side of a fresh hole is what puts the hole on its
               * shortest path. The earlier version of this probe paced between
               * the far side and the opening itself, which meant the Explorer
               * was sitting on the very cell a defender had to step into — the
               * measurement blocked the thing it was measuring.
               */
              if (sameCell(run.state.player, approach)) run.stepTo(wall);
              const beyond = walkableNeighbours(wall, run.state.walls).filter(
                (c) => !sameCell(c, approach),
              );
              const post = beyond[0] ?? null;
              if (post && !sameCell(run.state.player, post)) run.stepTo(post);
              // A partner cell to pace with, so the Explorer keeps taking turns
              // without ever standing on the opening.
              const partner =
                post &&
                walkableNeighbours(post, run.state.walls).find(
                  (c) => !sameCell(c, wall),
                );
              for (let t = 0; t < 24 && run.state.status === "playing"; t += 1) {
                if (
                  kOf(run.state.guardian) === kOf(wall) ||
                  kOf(run.state.sentinel) === kOf(wall)
                ) {
                  events.defenderUsedOpening = true;
                  break;
                }
                if (!post || !partner) break;
                const here = run.state.player;
                const step = sameCell(here, post) ? partner : post;
                if (Math.abs(step.row - here.row) + Math.abs(step.col - here.col) !== 1) break;
                run.stepTo(step);
              }
            }
          }
        }

        const outcome = playObjective(run);
        const final = run.state;
        events.secondChanceFired = final.rewardSpent && reward === "second-chance";
        // And a reset at the end, always.
        run.restart();
        const afterReset = run.state;

        played = {
          combo: label,
          seed,
          reward,
          outcome,
          status: final.status,
          turns: final.turns,
          lights: `${final.collectedCount}/${final.totalLights}`,
          events,
          completion: run.completions.at(-1)
            ? {
                won: run.completions.at(-1).details.won,
                chestOpened: run.completions.at(-1).details.chestOpened,
                rewardChosen: run.completions.at(-1).details.rewardChosen,
                rewardSpent: run.completions.at(-1).details.rewardSpent,
                wallBroken: run.completions.at(-1).details.wallBroken,
              }
            : null,
          resetClean:
            afterReset.chestOpened === false &&
            afterReset.rewardSelected === null &&
            afterReset.rewardSpent === false &&
            afterReset.brokenWall === null &&
            afterReset.walls.size === afterReset.mazeMap.walls.size,
        };
      } catch (error) {
        crashes += 1;
        played = { combo: label, seed, reward, crash: String(error) };
      }
    }
    if (played) scenarios.push(played);
  }
}

const wins = scenarios.filter((s) => s.status === "won").length;
const losses = scenarios.filter((s) => s.status === "lost").length;
const brokeAWall = scenarios.filter((s) => s.events?.wallBroken).length;
const defenderUsedOpening = scenarios.filter((s) => s.events?.defenderUsedOpening).length;
const trapsWithBreak = scenarios.filter(
  (s) => s.events?.wallBroken && s.events.trapsArmedAfterBreak > 0,
).length;
const secondChanceFired = scenarios.filter((s) => s.events?.secondChanceFired).length;
const brokenOutsideOldSet = scenarios.filter(
  (s) => s.events?.wallBroken && s.events.wallWasInOldCertifiedSet === false,
).length;
const brokenInsideOldSet = scenarios.filter(
  (s) => s.events?.wallBroken && s.events.wallWasInOldCertifiedSet === true,
).length;

record(
  "PLAY-COMBOS",
  "NINE_COMBINATIONS_NO_CRASH",
  crashes === 0 && scenarios.length === COMBOS.length * 2 && scenarios.every((s) => s.resetClean),
  {
    scenariosPlayed: scenarios.length,
    expected: COMBOS.length * 2,
    crashes,
    victories: wins,
    defeats: losses,
    resetsClean: scenarios.filter((s) => s.resetClean).length,
  },
);
record(
  "PLAY-COVERAGE",
  "SCENARIOS_COVERED",
  brokeAWall > 0 &&
    trapsWithBreak > 0 &&
    wins > 0 &&
    losses > 0 &&
    // §31: the sweep must not have exercised only the walls the old certifier
    // approved of, or it would be testing the retired design.
    brokenOutsideOldSet > 0,
  {
    wallBreaks: brokeAWall,
    wallsBrokenOutsideTheOldCertifiedSet: brokenOutsideOldSet,
    wallsBrokenInsideTheOldCertifiedSet: brokenInsideOldSet,
    defenderUsedTheOpening: defenderUsedOpening,
    trapsAndBreakInTheSameRoute: trapsWithBreak,
    secondChanceActivations: secondChanceFired,
    victories: wins,
    defeats: losses,
    /**
     * ROTA-DIFFICULTY-04A: `defenderUsedTheOpening` is REPORTED here, not gated.
     *
     * Measured rate: 6 hits in 81 scripted breaks (~7%), and a third of breaks
     * land on degree-1 walls where the event cannot occur at all. Across the 7
     * breaks a sweep performs, the expected count is well under one — this gate
     * was passing on luck, and a gate that passes on luck teaches people to
     * re-run until green.
     *
     * The property itself is not unproven: `pickaxe-controlled-tests.mjs` test L
     * exists for it and searches deliberately (161 runs, 5 defender occupations,
     * plus test K's same-turn witness). That is the instrument; this is a sweep.
     */
    defenderTraversalGatedBy: "pickaxe-controlled-tests.json :: K and L",
  },
);

const allPass = checks.every((c) => c.pass);
EVIDENCE.write("chest-runtime-gameplay.json", {
  mission: "ROTA-CHEST-REWARDS-01",
  suite: "REGRESSION_AND_GAMEPLAY",
  note:
    "correctness only — win and loss counts are coverage, never a balance verdict (§47)",
  checks,
  scenarios,
  allPass,
});
console.log(`\n${allPass ? "RUNTIME_GAMEPLAY_OK" : "RUNTIME_GAMEPLAY_FAILED"}`);
process.exitCode = EVIDENCE.finish({ ok: allPass });
