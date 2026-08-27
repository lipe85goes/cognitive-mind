/**
 * ROTA-DIFFICULTY-04A — Route × Difficulty identity, asserted.
 *
 * ROTA-DIFFICULTY-04-BASELINE measured 120 of 270 UI attempts silently resetting
 * the Route, all of them R2/R3 x medium/hard. This suite proves the fix and,
 * separately, explains the second finding from that baseline — that 0 of 270 UI
 * maps had the same fingerprint as a direct `generateMaze` call — WITHOUT
 * treating the two as the same problem.
 *
 * Everything drives the real `useEscapeMaze` through the shared harness. The
 * "UI selection" is expressed the way a player expresses it: mount the session,
 * tap a mode, tap Start.
 *
 * Usage: node tools/validation/route-difficulty-identity-tests.mjs [--check|--update]
 */
import crypto from "node:crypto";
import { loadRouteRuntime } from "./route-runtime-harness.mjs";
import { openEvidence } from "./evidence.mjs";

const EVIDENCE = openEvidence(
  process.env.ROUTE_VALIDATION_OUT ??
    "docs/archive/route-difficulty-04a-ui-identity-fix",
);

const RUNTIME = loadRouteRuntime();
const API = RUNTIME.API;
const LAB = RUNTIME.LAB;

const ROUTES = [1, 2, 3];
const MODES = ["easy", "medium", "hard"];
/** The baseline's own seed formula, so the same cases are replayed. */
const UI_BASE = 13_300_000;
const seedFor = (route, mode, sample) =>
  UI_BASE + route * 10_000 + MODES.indexOf(mode) * 1_000 + sample;
const SAMPLES = 30;

const tests = [];
const record = (id, name, pass, detail) => {
  tests.push({ id, name, pass, ...detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${name}`);
  for (const [k, v] of Object.entries(detail)) {
    console.log(`        ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  }
};

/** A stable identity for a generated board. */
function mapFingerprint(map) {
  const kOf = (p) => API.posKey(p);
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        walls: [...map.walls].sort(),
        guardianStart: kOf(map.guardianStart),
        exitPosition: kOf(map.exitPosition),
        stars: map.collectibleStars.map(kOf).sort(),
        traps: map.traps.map(kOf).sort(),
        chest: map.chest ? kOf(map.chest) : null,
      }),
    )
    .digest("hex");
}

/**
 * Replay the UI's exact generation sequence directly, for a GIVEN route/mode.
 *
 * The hook draws a board on mount and, for a non-default mode, another on
 * selection, before the player presses Start. Reproducing that sequence from the
 * same seed reproduces the player's map exactly — which makes this a complete
 * identity oracle: it pins the route argument, the mode argument and every
 * generated detail at once.
 *
 * It is used in BOTH directions. Matching on the requested combination proves
 * the UI asked for it; failing to match on every other combination proves the
 * test could have detected the bug.
 */
function replaySequence(seed, mode, route) {
  LAB.setSeed(seed);
  API.generateMaze("easy", route); // the hook's initial state on mount
  if (mode !== "easy") API.generateMaze(mode, route); // changeDifficulty
  return mapFingerprint(API.generateMaze(mode, route)); // startGame
}

/**
 * What the map ITSELF says it is, independent of any label the UI shows.
 *
 * Corroborating only, and deliberately not load-bearing: the exit candidates of
 * stages 2 and 3 overlap and their light/trap counts collide, so geometry alone
 * cannot separate S2/medium from S3/easy, nor S2/hard from S3/medium. Test E
 * measures that ambiguity instead of pretending it away, and the identity proof
 * rests on `replaySequence`.
 */
function geometricRoute(map) {
  const kOf = (p) => API.posKey(p);
  const portal = kOf(map.exitPosition);
  const matches = [];
  for (const stage of ROUTES) {
    const candidates = API.ROUTE_STAGE_EXIT_CANDIDATES[stage].map(kOf);
    if (candidates.includes(portal)) matches.push(stage);
  }
  return { portal, stages: matches };
}

function geometricMode(map, stage) {
  const wallCount = map.grid.flat().filter((c) => c === 1).length;
  const lights = map.collectibleStars.length;
  const traps = map.traps.length;
  const modes = MODES.filter(
    (mode) =>
      lights === API.getStarCount(mode, stage) &&
      traps === API.getTrapCount(mode, stage),
  );
  return { wallCount, lights, traps, modes };
}

// ===========================================================================
// A — the 9-combination matrix
// ===========================================================================
const matrix = [];
{
  let allPass = true;
  for (const route of ROUTES) {
    for (const mode of MODES) {
      const seed = seedFor(route, mode, 0);
      const run = RUNTIME.mount({ seed, difficulty: mode, routeNumber: route });
      const g = run.state;
      const stage = ((route - 1) % 3) + 1;
      const geoRoute = geometricRoute(g.mazeMap);
      const geoMode = geometricMode(g.mazeMap, stage);

      const row = {
        requested: { route, mode },
        seed,
        // What the UI shows the player.
        uiRouteNumber: g.routeNumber,
        uiRouteLabel: g.routeProgression.label,
        uiDifficulty: g.difficulty,
        // What the runtime actually holds.
        runtimeStage: g.routeProgression.stage,
        status: g.status,
        // What the generated board itself proves.
        generatedPortal: geoRoute.portal,
        generatedRouteStages: geoRoute.stages,
        generatedWallCount: geoMode.wallCount,
        generatedLights: geoMode.lights,
        generatedTraps: geoMode.traps,
        generatedModes: geoMode.modes,
        fingerprint: mapFingerprint(g.mazeMap),
      };
      row.uiRoutePreserved = row.uiRouteNumber === route;
      row.uiDifficultyPreserved = row.uiDifficulty === mode;
      row.generationRouteAgrees = geoRoute.stages.includes(stage);
      row.generationModeAgrees = geoMode.modes.includes(mode);

      // The decisive test, both ways round.
      row.matchesRequestedCombination = replaySequence(seed, mode, route) === row.fingerprint;
      row.matchesAnyOtherCombination = [];
      for (const otherRoute of ROUTES) {
        for (const otherMode of MODES) {
          if (otherRoute === route && otherMode === mode) continue;
          if (replaySequence(seed, otherMode, otherRoute) === row.fingerprint) {
            row.matchesAnyOtherCombination.push(`R${otherRoute}/${otherMode}`);
          }
        }
      }

      row.identityHolds =
        row.uiRoutePreserved &&
        row.uiDifficultyPreserved &&
        row.generationRouteAgrees &&
        row.generationModeAgrees &&
        row.matchesRequestedCombination &&
        row.matchesAnyOtherCombination.length === 0 &&
        row.status === "playing";
      if (!row.identityHolds) allPass = false;
      matrix.push(row);
    }
  }
  record("A", "ROUTE_DIFFICULTY_MATRIX_9x9", allPass && matrix.length === 9, {
    combinations: matrix.length,
    identityHolds: matrix.filter((r) => r.identityHolds).length,
    exactMatchOnRequestedCombination: matrix.filter((r) => r.matchesRequestedCombination)
      .length,
    falseMatchesOnAnyOtherCombination: matrix.reduce(
      (n, r) => n + r.matchesAnyOtherCombination.length,
      0,
    ),
    note:
      "the load-bearing check is the exact map identity: replaying the UI's generation sequence for the REQUESTED route/mode reproduces the player's board, and replaying it for any of the other eight does not",
  });
}

// ===========================================================================
// B — the 120 previously-failing cases, replayed seed for seed
// ===========================================================================
const resetReplay = [];
{
  let resets = 0;
  let preserved = 0;
  for (const route of ROUTES) {
    for (const mode of MODES) {
      for (let sample = 0; sample < SAMPLES; sample += 1) {
        const seed = seedFor(route, mode, sample);
        const run = RUNTIME.mount({ seed, difficulty: mode, routeNumber: route });
        const g = run.state;
        const ok = g.routeNumber === route && g.difficulty === mode;
        if (ok) preserved += 1;
        else resets += 1;
      }
    }
  }
  const previouslyAffected = ["route2/medium", "route2/hard", "route3/medium", "route3/hard"];
  resetReplay.push({ attempts: ROUTES.length * MODES.length * SAMPLES, preserved, resets });
  record(
    "B",
    "PREVIOUS_120_RESET_CASES",
    resets === 0 && preserved === 270,
    {
      attempts: 270,
      baselineRouteResetCount: 120,
      baselineRequestedCombinationPreserved: 150,
      nowPreserved: preserved,
      nowReset: resets,
      previouslyAffectedCombinations: previouslyAffected,
      seedFormula: "13300000 + route*10000 + modeIndex*1000 + sample",
    },
  );
}

// ===========================================================================
// C — transitions
// ===========================================================================
const transitions = [];
{
  const snapshot = (g) => ({
    route: g.routeNumber,
    mode: g.difficulty,
    status: g.status,
    stage: g.routeProgression.stage,
  });

  const transition = (label, route, steps) => {
    const seed = seedFor(route, "easy", 7);
    // Mount plainly at easy so the transition itself is what is measured.
    const run = RUNTIME.mount({ seed, difficulty: "easy", routeNumber: route });
    const before = snapshot(run.state);
    const trace = [];
    for (const step of steps) {
      step.apply(run);
      trace.push({ action: step.label, ...snapshot(run.state) });
    }
    const after = snapshot(run.state);
    const entry = {
      label,
      seed,
      before,
      trace,
      after,
      expectedRoute: steps.at(-1).expectedRoute ?? route,
      expectedMode: steps.at(-1).expectedMode ?? before.mode,
    };
    entry.routeCorrect = after.route === entry.expectedRoute;
    entry.modeCorrect = after.mode === entry.expectedMode;
    entry.pass = entry.routeCorrect && entry.modeCorrect;
    transitions.push(entry);
    return entry;
  };

  const pick = (mode) => ({
    label: `changeDifficulty(${mode})`,
    apply: (run) => run.act((g) => g.changeDifficulty(mode)),
    expectedMode: mode,
  });
  const start = {
    label: "startGame()",
    apply: (run) => run.act((g) => g.startGame()),
  };
  const restart = {
    label: "restartGame()",
    apply: (run) => run.act((g) => g.restartGame()),
  };

  // The six mode changes the mission names, on every route.
  for (const route of ROUTES) {
    transition(`R${route} easy -> medium`, route, [
      pick("medium"),
      { ...start, expectedMode: "medium" },
    ]);
    transition(`R${route} medium -> hard`, route, [
      pick("medium"),
      pick("hard"),
      { ...start, expectedMode: "hard" },
    ]);
  }
  // hard -> easy, the other direction.
  transition("R2 hard -> easy", 2, [
    pick("hard"),
    pick("easy"),
    { ...start, expectedMode: "easy" },
  ]);
  // restart preserves both.
  transition("R3 hard, restart", 3, [
    pick("hard"),
    { ...start, expectedMode: "hard" },
    { ...restart, expectedMode: "hard" },
  ]);
  // next route advances route, preserves mode.
  transition("R2 hard, continueJourney", 2, [
    pick("hard"),
    { ...start, expectedMode: "hard" },
    {
      label: "continueJourney()",
      apply: (run) => run.act((g) => g.continueJourney()),
      expectedRoute: 3,
      expectedMode: "hard",
    },
  ]);
  // changing mode AFTER advancing must keep the advanced route.
  transition("R2 -> R3 then change mode", 2, [
    pick("medium"),
    { ...start, expectedMode: "medium" },
    {
      label: "continueJourney()",
      apply: (run) => run.act((g) => g.continueJourney()),
      expectedRoute: 3,
      expectedMode: "medium",
    },
    { ...pick("hard"), expectedRoute: 3 },
  ]);

  record("C", "TRANSITIONS", transitions.every((t) => t.pass), {
    transitions: transitions.length,
    passed: transitions.filter((t) => t.pass).length,
    failed: transitions.filter((t) => !t.pass).map((t) => t.label),
  });
}

// ===========================================================================
// D — remount, and the explicit return to Route 1
// ===========================================================================
const lifecycle = [];
{
  // A remount is a NEW session: the product mounts a fresh hook with whatever
  // `initialRouteNumber` page.tsx hands it. Two paths exist and they differ on
  // purpose, so both are measured rather than assumed.
  for (const route of ROUTES) {
    for (const mode of MODES) {
      const seed = seedFor(route, mode, 11);
      // playAgain: page.tsx remounts with details.nextRouteNumber.
      const remounted = RUNTIME.mount({ seed, difficulty: mode, routeNumber: route });
      // openActivity: page.tsx clears initialRouteNumber -> the hook defaults to 1.
      const fresh = RUNTIME.mount({ seed, difficulty: mode, routeNumber: 1 });
      lifecycle.push({
        requested: { route, mode },
        remountKeepsRoute: remounted.state.routeNumber === route,
        remountKeepsMode: remounted.state.difficulty === mode,
        explicitCampaignResetLandsOnRouteOne: fresh.state.routeNumber === 1,
        explicitCampaignResetKeepsMode: fresh.state.difficulty === mode,
      });
    }
  }
  record(
    "D",
    "REMOUNT_AND_EXPLICIT_ROUTE_RESET",
    lifecycle.every(
      (l) =>
        l.remountKeepsRoute &&
        l.remountKeepsMode &&
        l.explicitCampaignResetLandsOnRouteOne &&
        l.explicitCampaignResetKeepsMode,
    ),
    {
      cases: lifecycle.length,
      note:
        "returning to Route 1 is still reachable and still explicit: it is what entering the world from Home does, by mounting a session with no initialRouteNumber",
    },
  );
}

// ===========================================================================
// E — the map the player receives is the one the UI promised
// ===========================================================================
{
  const kOf = (p) => API.posKey(p);
  const mismatches = matrix.filter((r) => !r.generationRouteAgrees || !r.generationModeAgrees);

  /**
   * How far geometry alone can go, stated honestly.
   *
   * Stage 2 and stage 3 share exit candidates and their light/trap counts
   * collide, so two (stage, mode) pairs are indistinguishable from the board:
   * S2/medium vs S3/easy, and S2/hard vs S3/medium. That is why the matrix does
   * not rest on this check.
   */
  const profiles = [];
  for (const stage of ROUTES) {
    for (const mode of MODES) {
      profiles.push({
        stage,
        mode,
        portals: API.ROUTE_STAGE_EXIT_CANDIDATES[stage].map(kOf),
        lights: API.getStarCount(mode, stage),
        traps: API.getTrapCount(mode, stage),
      });
    }
  }
  const ambiguousPairs = [];
  for (let i = 0; i < profiles.length; i += 1) {
    for (let j = i + 1; j < profiles.length; j += 1) {
      const a = profiles[i];
      const b = profiles[j];
      if (a.stage === b.stage) continue;
      const overlap = b.portals.some((p) => a.portals.includes(p));
      if (overlap && a.lights === b.lights && a.traps === b.traps) {
        ambiguousPairs.push(`S${a.stage}/${a.mode} == S${b.stage}/${b.mode}`);
      }
    }
  }

  record(
    "E",
    "GENERATION_RECEIVES_THE_SELECTED_COMBINATION",
    mismatches.length === 0 &&
      matrix.every((r) => r.matchesRequestedCombination) &&
      matrix.every((r) => r.matchesAnyOtherCombination.length === 0),
    {
      geometricMismatches: mismatches.length,
      exactIdentityMatches: matrix.filter((r) => r.matchesRequestedCombination).length,
      falseMatches: matrix.reduce((n, r) => n + r.matchesAnyOtherCombination.length, 0),
      geometryAloneIsAmbiguousFor: ambiguousPairs,
      whyThatIsFine:
        "identity is established by exact map equality against the requested combination, which is unambiguous; the geometric read is only a corroborating cross-check",
      exitCandidatesPerStage: Object.fromEntries(
        ROUTES.map((s) => [s, API.ROUTE_STAGE_EXIT_CANDIDATES[s].map(kOf)]),
      ),
      lightCountsPerMode: Object.fromEntries(
        ROUTES.map((s) => [s, Object.fromEntries(MODES.map((m) => [m, API.getStarCount(m, s)]))]),
      ),
    },
  );
}

// ===========================================================================
// F — UI vs direct generation: explain the 0/270, do not "fix" it
// ===========================================================================
const fingerprintStudy = [];
{
  /**
   * The baseline compared the UI's final map against a single direct
   * `generateMaze(mode, route)` call from a fresh seed. Those are not the same
   * point in the RNG stream: before the player ever sees a board, the UI has
   * already generated one or two others.
   *
   *   easy        : mount(easy, route)  ->  Start(easy, route)          2 calls
   *   medium/hard : mount(easy, route)  ->  changeDifficulty(mode,route)
   *                                     ->  Start(mode, route)          3 calls
   *
   * So the hypothesis is: replaying that exact call sequence directly, from the
   * same seed, must reproduce the UI's map byte for byte. If it does, the
   * divergence is a property of WHERE in the stream the map is drawn, not of
   * what the UI asked for.
   */
  let reproduced = 0;
  let directEqualsUi = 0;
  let checked = 0;

  for (const route of ROUTES) {
    for (const mode of MODES) {
      for (let sample = 0; sample < 6; sample += 1) {
        const seed = seedFor(route, mode, sample);

        const run = RUNTIME.mount({ seed, difficulty: mode, routeNumber: route });
        const uiHash = mapFingerprint(run.state.mazeMap);

        // One direct call, exactly what the baseline compared against.
        LAB.setSeed(seed);
        const directHash = mapFingerprint(API.generateMaze(mode, route));

        // The UI's own call sequence, replayed directly.
        const sequencedHash = replaySequence(seed, mode, route);

        checked += 1;
        if (sequencedHash === uiHash) reproduced += 1;
        if (directHash === uiHash) directEqualsUi += 1;

        if (fingerprintStudy.length < 9) {
          fingerprintStudy.push({
            seed,
            route,
            mode,
            callsBeforeThePlayersMap: mode === "easy" ? 1 : 2,
            uiHash,
            singleDirectCallHash: directHash,
            replayedSequenceHash: sequencedHash,
            replayedSequenceReproducesUi: sequencedHash === uiHash,
            singleDirectCallEqualsUi: directHash === uiHash,
          });
        }
      }
    }
  }

  const classification =
    reproduced === checked && directEqualsUi === 0
      ? "EXPECTED_RNG_SEQUENCE_DIFFERENCE"
      : reproduced === checked
        ? "EXPECTED_RNG_SEQUENCE_DIFFERENCE"
        : "OTHER";

  record("F", "UI_VS_DIRECT_GENERATION", reproduced === checked, {
    samplesChecked: checked,
    replayedSequenceReproducesUi: reproduced,
    singleDirectCallEqualsUi: directEqualsUi,
    classification,
    conclusion:
      "the UI asks for the right combination; it simply draws its map further along the same RNG stream, because the hook generates a board on mount and another on mode selection before the player presses Start",
    notADefectBecause:
      "identity is only required when route, mode, seed AND initial RNG position are equivalent; here the last one is not, by design of the setup screen",
  });
}

// ===========================================================================
// G — the fix did not change generation, only the argument passed to it
// ===========================================================================
{
  /**
   * `changeDifficulty` still performs exactly one generation, with the same
   * arguments except the route. Proof: with routeNumber already 1, the fixed
   * function and the old one are indistinguishable — same call, same RNG draw,
   * same map.
   */
  const equalOnRouteOne = [];
  for (const mode of MODES) {
    for (let sample = 0; sample < 8; sample += 1) {
      const seed = seedFor(1, mode, sample);
      const run = RUNTIME.mount({ seed, difficulty: mode, routeNumber: 1 });
      const uiHash = mapFingerprint(run.state.mazeMap);
      // The OLD behaviour on Route 1 is the same sequence, because the old code
      // forced route 1 and the session already was route 1.
      const oldSequenceHash = replaySequence(seed, mode, 1);
      equalOnRouteOne.push({ seed, mode, identical: oldSequenceHash === uiHash });
    }
  }
  record(
    "G",
    "ROUTE_ONE_BEHAVIOUR_UNCHANGED",
    equalOnRouteOne.every((e) => e.identical),
    {
      casesChecked: equalOnRouteOne.length,
      identical: equalOnRouteOne.filter((e) => e.identical).length,
      note:
        "on Route 1 the old and new changeDifficulty are the same call, so every Route 1 map is bit-identical to the baseline",
    },
  );
}

const allPass = tests.every((t) => t.pass);
EVIDENCE.write("route-difficulty-identity.json", {
  mission: "ROTA-DIFFICULTY-04A-UI-IDENTITY-FIX",
  baseline: "ROTA-DIFFICULTY-04-BASELINE",
  driver: "tools/validation/route-runtime-harness.mjs drives the real useEscapeMaze",
  rootCause: {
    symbol: "changeDifficulty",
    wasDoing: "setRouteNumber(1) + startNewMaze(mode, 'setup', 1)",
    nowDoing: "startNewMaze(mode, 'setup', routeNumber)",
    introducedIn: "0d7e7fa feat(route-strategy): add playable route progression",
    becameWrongIn:
      "3bde618 feat(route-strategy): add route completion continuity loop — added initialRouteNumber and updated the state initialiser without revisiting changeDifficulty",
    classification: "LATENT_REGRESSION_FROM_INCOMPLETE_FOLLOW_UP",
    notLegacyDeadCode: true,
    notAnIntentionalCurrentRule: true,
    notAWorkaround: true,
  },
  matrix,
  transitions,
  lifecycle,
  resetReplay,
  fingerprintStudy,
  tests,
  allPass,
});
console.log(`\n${allPass ? "ROUTE_DIFFICULTY_IDENTITY_OK" : "ROUTE_DIFFICULTY_IDENTITY_FAILED"}`);
process.exitCode = EVIDENCE.finish({ ok: allPass });
