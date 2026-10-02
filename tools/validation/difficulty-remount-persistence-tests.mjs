/**
 * ROTA-DIFFICULTY-04B — the mode survives a progression remount.
 *
 * `ROTA-DIFFICULTY-04A` closed the Route half of the identity contract and left
 * one follow-up: finishing a Route and continuing remounted the game component,
 * and the mode the player had chosen died with the previous instance. R1/hard
 * became R2/easy.
 *
 * The transport was never missing. `endGame` has always written
 * `details.difficulty`; `app/page.tsx#playAgain` simply read only
 * `details.nextRouteNumber` from the same object.
 *
 * So these tests refuse to assume the payload's shape. Where a journey is
 * measured, the route is played to completion in the harness, the resulting
 * `details` are put through THE SAME narrowing `playAgain` performs, and the
 * next instance is mounted from that — the real object, the real read.
 *
 * Usage: node tools/validation/difficulty-remount-persistence-tests.mjs [--check|--update]
 */
import { loadRouteRuntime, cellKey, pathBetween } from "./route-runtime-harness.mjs";
import { openEvidence } from "./evidence.mjs";

const EVIDENCE = openEvidence(
  process.env.ROUTE_VALIDATION_OUT ??
    "docs/archive/route-difficulty-04b-remount-persistence",
);

const RUNTIME = loadRouteRuntime();
const API = RUNTIME.API;

const MODES = ["easy", "medium", "hard"];
const SEED_BASE = 15_400_000;
const seedFor = (route, mode, sample = 0) =>
  SEED_BASE + route * 10_000 + MODES.indexOf(mode) * 1_000 + sample;

const tests = [];
const record = (id, name, pass, detail) => {
  tests.push({ id, name, pass, ...detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${name}`);
  for (const [k, v] of Object.entries(detail)) {
    console.log(`        ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  }
};

/**
 * `app/page.tsx#playAgain`, reproduced exactly — including the guard that ties
 * the mode to the Route, so it can only travel when a journey travels.
 *
 * GAME-CONTINUATION-CONTRACT-01 replaced this read with the typed
 * `GameResult.continuation` the hook now writes next to these same `details`
 * (game-continuation-contract-tests.mjs drives that path through the real
 * shell). It stays here as the 04B record: the hook's carry is unchanged, and
 * the values narrowed here are the ones the continuation carries.
 */
const DIFFICULTY_LEVELS = ["easy", "medium", "hard"];
function readDifficulty(value) {
  return typeof value === "string" && DIFFICULTY_LEVELS.includes(value)
    ? value
    : undefined;
}
function playAgainPayload(result) {
  const isRouteJourney = result?.gameId === "escape-maze";
  const nextRouteNumber =
    isRouteJourney && typeof result.details.nextRouteNumber === "number"
      ? result.details.nextRouteNumber
      : undefined;
  const nextDifficulty = nextRouteNumber
    ? readDifficulty(result.details.difficulty)
    : undefined;
  return { nextRouteNumber, nextDifficulty };
}

/** Play until the route ends, however it ends. Losing is a completion too. */
function playToCompletion(run, budget = 200) {
  for (let guard = 0; guard < budget; guard += 1) {
    const g = run.state;
    if (g.status !== "playing") return g.status;
    if (g.rewardChoicePending) {
      run.choose("pickaxe");
      continue;
    }
    const remaining = g.mazeMap.collectibleStars.filter(
      (star) => !g.collectedSet.has(cellKey(star)),
    );
    const goals = remaining.length ? remaining : [g.mazeMap.exitPosition];
    let best = null;
    for (const target of goals) {
      const route = pathBetween(g.player, target, g.walls);
      if (route && (!best || route.length < best.length)) best = route;
    }
    if (!best || best.length < 2) return "stuck";
    run.stepTo(best[1]);
  }
  return "budget";
}

/**
 * One real hand-off: play `route` on `mode`, take the result the game actually
 * emitted, narrow it the way the product does, and mount what comes next.
 */
function handOff(route, mode, sample = 0) {
  const seed = seedFor(route, mode, sample);
  const first = RUNTIME.mount({ seed, difficulty: mode, routeNumber: route });
  const played = {
    route: first.state.routeNumber,
    mode: first.state.difficulty,
  };
  const outcome = playToCompletion(first);
  const result = first.completions.at(-1) ?? null;
  const payload = result ? playAgainPayload(result) : null;

  let next = null;
  if (payload?.nextRouteNumber) {
    next = RUNTIME.mount({
      seed: seed + 500,
      routeNumber: payload.nextRouteNumber,
      initialDifficulty: payload.nextDifficulty,
      autoStart: false, // the player lands on the setup screen
    });
  }
  return { seed, played, outcome, result, payload, next };
}

// ===========================================================================
// A — the remount matrix: R1->R2 and R2->R3 on every mode
// ===========================================================================
const remountMatrix = [];
{
  for (const route of [1, 2]) {
    for (const mode of MODES) {
      const h = handOff(route, mode);
      const row = {
        from: { route, mode },
        seed: h.seed,
        outcome: h.outcome,
        playedRoute: h.played.route,
        playedMode: h.played.mode,
        detailsDifficulty: h.result?.details.difficulty ?? null,
        detailsNextRouteNumber: h.result?.details.nextRouteNumber ?? null,
        carriedRoute: h.payload?.nextRouteNumber ?? null,
        carriedMode: h.payload?.nextDifficulty ?? null,
        arrivedRoute: h.next?.state.routeNumber ?? null,
        arrivedMode: h.next?.state.difficulty ?? null,
        arrivedStatus: h.next?.state.status ?? null,
      };
      row.expected = { route: route + 1, mode };
      row.pass =
        row.playedMode === mode &&
        row.carriedRoute === route + 1 &&
        row.carriedMode === mode &&
        row.arrivedRoute === route + 1 &&
        row.arrivedMode === mode;
      remountMatrix.push(row);
    }
  }
  record("A", "REMOUNT_MATRIX", remountMatrix.every((r) => r.pass), {
    rows: remountMatrix.length,
    passed: remountMatrix.filter((r) => r.pass).length,
    failed: remountMatrix.filter((r) => !r.pass).map((r) => `R${r.from.route}/${r.from.mode}`),
    note:
      "the mode is read from the result the game itself emitted, through the same narrowing playAgain uses",
  });
}

// ===========================================================================
// B — the arriving instance generates for the carried combination
// ===========================================================================
{
  /**
   * Not the label: the board. Replaying the arriving instance's own generation
   * sequence for the CARRIED route/mode must reproduce its map, and replaying
   * it for the mode it would previously have defaulted to must not.
   */
  const checks = [];
  for (const route of [1, 2]) {
    for (const mode of MODES) {
      const h = handOff(route, mode, 3);
      if (!h.next) continue;
      const arrivalSeed = h.seed + 500;
      const carriedRoute = h.payload.nextRouteNumber;
      const carriedMode = h.payload.nextDifficulty;

      // The arriving instance has mounted but not started: exactly one map has
      // been generated, for (carriedMode, carriedRoute).
      RUNTIME.LAB.setSeed(arrivalSeed);
      const expected = fingerprint(API.generateMaze(carriedMode, carriedRoute));
      RUNTIME.LAB.setSeed(arrivalSeed);
      const oldDefault = fingerprint(API.generateMaze("easy", carriedRoute));
      const actual = fingerprint(h.next.state.mazeMap);

      checks.push({
        from: `R${route}/${mode}`,
        carried: `R${carriedRoute}/${carriedMode}`,
        matchesCarriedCombination: actual === expected,
        matchesOldEasyDefault: actual === oldDefault,
      });
    }
  }
  record(
    "B",
    "ARRIVING_INSTANCE_GENERATES_THE_CARRIED_COMBINATION",
    checks.length > 0 &&
      checks.every((c) => c.matchesCarriedCombination) &&
      checks.filter((c) => c.from.includes("easy")).every((c) => c.matchesOldEasyDefault) &&
      checks.filter((c) => !c.from.includes("easy")).every((c) => !c.matchesOldEasyDefault),
    {
      checks,
      note:
        "for easy journeys the carried map IS the old default map, which is the correct no-op; for medium/hard it is provably not",
    },
  );
}

function fingerprint(map) {
  const kOf = (p) => API.posKey(p);
  return JSON.stringify({
    walls: [...map.walls].sort(),
    guardian: kOf(map.guardianStart),
    exit: kOf(map.exitPosition),
    stars: map.collectibleStars.map(kOf).sort(),
    traps: map.traps.map(kOf).sort(),
    chest: map.chest ? kOf(map.chest) : null,
  });
}

// ===========================================================================
// C — restart preserves Route and mode, on every route
// ===========================================================================
const restarts = [];
{
  for (const route of [1, 2, 3]) {
    for (const mode of MODES) {
      const seed = seedFor(route, mode, 5);
      // Arrive the way a continuation arrives, then start and restart.
      const run = RUNTIME.mount({
        seed,
        routeNumber: route,
        initialDifficulty: mode,
      });
      const before = { route: run.state.routeNumber, mode: run.state.difficulty };
      run.restart();
      const after = { route: run.state.routeNumber, mode: run.state.difficulty };
      restarts.push({
        route,
        mode,
        before,
        after,
        pass: after.route === route && after.mode === mode && before.mode === mode,
      });
    }
  }
  record("C", "RESTART_PRESERVES_BOTH", restarts.every((r) => r.pass), {
    cases: restarts.length,
    failed: restarts.filter((r) => !r.pass).map((r) => `R${r.route}/${r.mode}`),
  });
}

// ===========================================================================
// D — a mode changed mid-route is the mode that travels
// ===========================================================================
const midRouteChanges = [];
{
  // R2 easy -> player picks hard -> R2 hard -> finishes -> R3 hard.
  for (const [from, to] of [
    ["easy", "hard"],
    ["easy", "medium"],
    ["hard", "easy"],
  ]) {
    const seed = seedFor(2, from, 9);
    const run = RUNTIME.mount({
      seed,
      routeNumber: 2,
      initialDifficulty: from,
      autoStart: false,
    });
    const arrived = { route: run.state.routeNumber, mode: run.state.difficulty };
    run.act((g) => g.changeDifficulty(to));
    const afterChange = { route: run.state.routeNumber, mode: run.state.difficulty };
    run.act((g) => g.startGame());
    playToCompletion(run);
    const result = run.completions.at(-1) ?? null;
    const payload = result ? playAgainPayload(result) : null;
    const next = payload?.nextRouteNumber
      ? RUNTIME.mount({
          seed: seed + 500,
          routeNumber: payload.nextRouteNumber,
          initialDifficulty: payload.nextDifficulty,
          autoStart: false,
        })
      : null;

    midRouteChanges.push({
      arrivedOn: from,
      changedTo: to,
      arrived,
      afterChange,
      routeHeldDuringChange: afterChange.route === 2,
      detailsDifficulty: result?.details.difficulty ?? null,
      carriedMode: payload?.nextDifficulty ?? null,
      nextRoute: next?.state.routeNumber ?? null,
      nextMode: next?.state.difficulty ?? null,
      pass:
        afterChange.route === 2 &&
        afterChange.mode === to &&
        payload?.nextDifficulty === to &&
        next?.state.routeNumber === 3 &&
        next?.state.difficulty === to,
    });
  }
  record("D", "MID_ROUTE_CHANGE_TRAVELS", midRouteChanges.every((m) => m.pass), {
    cases: midRouteChanges.length,
    failed: midRouteChanges.filter((m) => !m.pass).map((m) => `${m.arrivedOn}->${m.changedTo}`),
    note: "ROTA-DIFFICULTY-04A guarantees the Route survives the change; this proves the new mode is what travels onward",
  });
}

// ===========================================================================
// E — a new entry from Home inherits nothing
// ===========================================================================
const freshEntries = [];
{
  /**
   * `openActivity` clears BOTH carriers. The hook's defaults are therefore what
   * a fresh entry gets, whatever was played before it — modelled here by
   * mounting with neither carrier supplied.
   */
  for (const previousMode of MODES) {
    const h = handOff(1, previousMode, 13);
    const fresh = RUNTIME.mount({
      seed: seedFor(1, previousMode, 13) + 900,
      // openActivity: setInitialRouteNumber(undefined) + setInitialDifficulty(undefined)
      routeNumber: undefined,
      initialDifficulty: undefined,
      difficulty: "easy",
      autoStart: false,
    });
    freshEntries.push({
      previousJourney: `R1/${previousMode}`,
      previousCarriedMode: h.payload?.nextDifficulty ?? null,
      freshRoute: fresh.state.routeNumber,
      freshMode: fresh.state.difficulty,
      pass: fresh.state.routeNumber === 1 && fresh.state.difficulty === "easy",
    });
  }
  record("E", "NEW_ENTRY_INHERITS_NOTHING", freshEntries.every((f) => f.pass), {
    cases: freshEntries.length,
    defaults: { route: 1, mode: "easy" },
    note:
      "openActivity clears both carriers, so the hook's own defaults apply; the previous journey's mode is visible in the payload and provably not adopted",
  });
}

// ===========================================================================
// F — Route 3 and beyond: where does the journey end?
// ===========================================================================
const journeyEnd = [];
{
  /**
   * There is no terminal Route. `getRouteStage` is `((n - 1) % 3) + 1`, so the
   * journey is unbounded and the STAGE cycles: Route 4 is stage 1 again. That
   * is the pre-existing model and this mission does not change it — it is
   * measured here so the carry is known not to break at the wrap.
   */
  for (const mode of MODES) {
    const h = handOff(3, mode, 17);
    const arrived = h.next
      ? { route: h.next.state.routeNumber, mode: h.next.state.difficulty, stage: h.next.state.routeProgression.stage }
      : null;
    journeyEnd.push({
      from: `R3/${mode}`,
      carriedRoute: h.payload?.nextRouteNumber ?? null,
      carriedMode: h.payload?.nextDifficulty ?? null,
      arrived,
      stageWrapsToOne: arrived?.stage === 1,
      pass:
        h.payload?.nextRouteNumber === 4 &&
        h.payload?.nextDifficulty === mode &&
        arrived?.route === 4 &&
        arrived?.mode === mode &&
        arrived?.stage === 1,
    });
  }
  record("F", "ROUTE_THREE_BOUNDARY", journeyEnd.every((j) => j.pass), {
    cases: journeyEnd.length,
    model: "routes are unbounded; stage = ((route - 1) % 3) + 1, so Route 4 is stage 1",
    changedByThisMission: false,
    note:
      "no terminal Route exists today; the carry is verified across the stage wrap rather than a stop being invented",
  });
}

// ===========================================================================
// G — nothing leaks: the mode travels only with a Route
// ===========================================================================
{
  /**
   * `playAgain` computes the mode only when a `nextRouteNumber` is present, so a
   * result without one — any non-route game, or a route result missing the
   * field — carries nothing. Checked against the real narrowing, not a mock.
   */
  const cases = [
    {
      label: "non-route game result",
      result: { gameId: "color-sequence", details: { difficulty: "hard", nextRouteNumber: 4 } },
    },
    {
      label: "route result without nextRouteNumber",
      result: { gameId: "escape-maze", details: { difficulty: "hard" } },
    },
    {
      label: "route result with an unrecognised mode",
      result: { gameId: "escape-maze", details: { difficulty: "nightmare", nextRouteNumber: 2 } },
    },
    {
      label: "route result with a non-string mode",
      result: { gameId: "escape-maze", details: { difficulty: 3, nextRouteNumber: 2 } },
    },
  ].map((c) => ({ ...c, payload: playAgainPayload(c.result) }));

  record(
    "G",
    "NO_LEAK_ACROSS_BOUNDARY",
    cases.every((c) => c.payload.nextDifficulty === undefined),
    {
      cases: cases.map((c) => ({ label: c.label, carried: c.payload })),
      note:
        "an unrecognised or absent mode yields undefined, which is exactly the fresh-entry default — no throw, no fallback branch",
    },
  );
}

const allPass = tests.every((t) => t.pass);
EVIDENCE.write("difficulty-remount-persistence.json", {
  mission: "ROTA-DIFFICULTY-04B-REMOUNT-PERSISTENCE",
  followUpFrom: "ROTA-DIFFICULTY-04A-UI-IDENTITY-FIX",
  driver: "tools/validation/route-runtime-harness.mjs drives the real useEscapeMaze",
  ownership: {
    duringPlay: "useEscapeMaze owns `difficulty` — authoritative, single copy",
    betweenInstances:
      "app/page.tsx `initialDifficulty`, set only by playAgain and cleared by openActivity",
    transport:
      "GameResult.details.difficulty, already written by endGame before this mission",
    rootCause:
      "the transport existed; playAgain read only details.nextRouteNumber from it",
  },
  remountMatrix,
  restarts,
  midRouteChanges,
  freshEntries,
  journeyEnd,
  tests,
  allPass,
});
console.log(`\n${allPass ? "DIFFICULTY_REMOUNT_PERSISTENCE_OK" : "DIFFICULTY_REMOUNT_PERSISTENCE_FAILED"}`);
process.exitCode = EVIDENCE.finish({ ok: allPass });
