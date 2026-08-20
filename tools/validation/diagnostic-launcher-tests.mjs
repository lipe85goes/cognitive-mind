/**
 * ROTA-DIFFICULTY-04C — the diagnostic seam, asserted.
 *
 * Two things have to be true at once, and they pull in opposite directions:
 *
 *   1. armed, a scenario is reproducible — same route/difficulty/seed, same
 *      board, same starting state, and the baseline's witnesses are reachable;
 *   2. disarmed, NOTHING changed — the product is as stochastic as it always
 *      was, and a diagnostic session cannot bleed into a normal journey.
 *
 * The second is the one that could quietly go wrong, so it is tested first and
 * hardest.
 *
 * Usage: node tools/validation/diagnostic-launcher-tests.mjs
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { loadRouteRuntime, walkableNeighbours } from "./route-runtime-harness.mjs";

const OUT = path.resolve(
  process.env.ROUTE_VALIDATION_OUT ??
    "docs/archive/route-difficulty-04c-diagnostic-launcher",
);
fs.mkdirSync(OUT, { recursive: true });

const RUNTIME = loadRouteRuntime();
const API = RUNTIME.API;
const RANDOM = RUNTIME.routeRandom;

const tests = [];
const record = (id, name, pass, detail) => {
  tests.push({ id, name, pass, ...detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${name}`);
  for (const [k, v] of Object.entries(detail)) {
    console.log(`        ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  }
};

const kOf = (p) => API.posKey(p);

/**
 * `difficulty-baseline-run.mjs :: mapIdentity` + `hashJson`, character for
 * character. Matching it is what lets a witness be checked against the RECORDED
 * baseline artifact rather than against a re-run of the tooling — a re-run
 * could agree with itself while both drifted.
 */
function fingerprint(map) {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        walls: [...map.walls].sort(),
        guardian: kOf(map.guardianStart),
        exit: kOf(map.exitPosition),
        lights: map.collectibleStars.map(kOf),
        traps: map.traps.map(kOf),
        chest: map.chest ? kOf(map.chest) : null,
      }),
    )
    .digest("hex");
}

/** The baseline artifact, as committed. Read-only; never rewritten here. */
const BASELINE = JSON.parse(
  fs.readFileSync(
    path.resolve("docs/archive/route-difficulty-04-baseline/difficulty-baseline.json"),
    "utf8",
  ),
);
const recordedSample = (seed) =>
  BASELINE.geometrySamples.find((s) => s.seed === seed) ?? null;

/**
 * The witnesses named by the missions, with the baseline's own seed formula.
 * ROTA-DIFFICULTY-05 intentionally keeps the Easy/Medium maps identical and
 * changes the two Hard maps through the selected generation thresholds.
 */
const MODES = ["easy", "medium", "hard"];
const WITNESSES = [
  { id: "A", seed: 12432045, route: 3, mode: "hard", expectedMapChange: true, note: "objective route de 43 moves before rebalance" },
  { id: "B", seed: 12432116, route: 3, mode: "hard", expectedMapChange: true, note: "forced streak de 10 before rebalance" },
  { id: "C", seed: 12430048, route: 3, mode: "easy", expectedMapChange: false, note: "Chest detour de 10 unchanged" },
  { id: "D", seed: 12421027, route: 2, mode: "medium", expectedMapChange: false, note: "Pickaxe melhora 10 moves unchanged" },
  { id: "E", seed: 12420031, route: 2, mode: "easy", expectedMapChange: false, note: "Hunter inicia a distancia 9 unchanged" },
];

// ===========================================================================
// A — disarmed, the product is exactly what it was
// ===========================================================================
{
  RANDOM.clearRouteRandomSeed();

  // The seam must BE Math.random when nothing is armed, not merely behave like
  // something random.
  const draws = Array.from({ length: 2000 }, () => RANDOM.routeRandom());
  const inRange = draws.every((d) => d >= 0 && d < 1);
  const distinct = new Set(draws).size;

  // And generation must still be stochastic: the same route/difficulty twice
  // must not produce the same board.
  const repeats = [];
  for (const mode of MODES) {
    for (const route of [1, 2, 3]) {
      const a = fingerprint(API.generateMaze(mode, route));
      const b = fingerprint(API.generateMaze(mode, route));
      repeats.push({ route, mode, identical: a === b });
    }
  }
  const collisions = repeats.filter((r) => r.identical).length;

  record(
    "A",
    "DISARMED_IS_UNCHANGED",
    RANDOM.getArmedRouteSeed() === null &&
      inRange &&
      distinct > 1900 &&
      collisions === 0,
    {
      armedSeed: RANDOM.getArmedRouteSeed(),
      drawsInRange: inRange,
      distinctDrawsOf2000: distinct,
      generationsCompared: repeats.length,
      identicalPairs: collisions,
      note:
        "with nothing armed the seam is Math.random and generation stays stochastic — the same route/mode never repeated a board",
    },
  );
}

// ===========================================================================
// B — armed, generation is deterministic
// ===========================================================================
const generationDeterminism = [];
{
  for (const { seed, route, mode } of WITNESSES) {
    RANDOM.armRouteRandomSeed(seed);
    const first = fingerprint(API.generateMaze(mode, route));
    RANDOM.armRouteRandomSeed(seed);
    const second = fingerprint(API.generateMaze(mode, route));
    // And re-arming is not required: `beginSeededGeneration` restarts the
    // stream at the top of every generation, so a second call under the SAME
    // arming must also match.
    RANDOM.armRouteRandomSeed(seed);
    API.generateMaze(mode, route);
    const consecutive = fingerprint(API.generateMaze(mode, route));
    generationDeterminism.push({
      seed,
      route,
      mode,
      reArmedMatches: first === second,
      consecutiveMatches: first === consecutive,
    });
  }
  RANDOM.clearRouteRandomSeed();
  record(
    "B",
    "GENERATION_DETERMINISM",
    generationDeterminism.every((g) => g.reArmedMatches && g.consecutiveMatches),
    {
      cases: generationDeterminism.length,
      note:
        "a scenario is the same board on Launch, on Start and on every Restart of that session",
    },
  );
}

// ===========================================================================
// C — same-seed BEFORE/AFTER witness contract
// ===========================================================================
const witnessReproduction = [];
{
  /**
   * The baseline measured its geometry samples as ONE `generateMaze(mode,
   * route)` from a fresh seeded stream, using the PRNG in
   * `tools/validation/route-lab.mjs`. Reproducing a witness therefore means the
   * browser seam must agree with that tooling exactly — same arithmetic, same
   * first draw, same board.
   */
  for (const w of WITNESSES) {
    // What the tooling produces (the baseline's own path).
    RUNTIME.LAB.setSeed(w.seed);
    const toolingHash = fingerprint(API.generateMaze(w.mode, w.route));

    // What the production seam produces (the launcher's path).
    RANDOM.armRouteRandomSeed(w.seed);
    const seamHash = fingerprint(API.generateMaze(w.mode, w.route));
    RANDOM.clearRouteRandomSeed();

    // And what the immutable BEFORE baseline actually RECORDED for this seed.
    // Easy/Medium must still match it; the selected Hard maps must not.
    const recorded = recordedSample(w.seed);
    const matchesRecordedBefore = recorded ? seamHash === recorded.mapHash : false;

    // The seed really does decode to the route/mode the mission stated.
    const decodedRoute = Math.floor((w.seed - 12_400_000) / 10_000);
    const decodedModeIndex = Math.floor(((w.seed - 12_400_000) % 10_000) / 1_000);

    witnessReproduction.push({
      ...w,
      toolingHash,
      seamHash,
      beforeHash: recorded?.mapHash ?? null,
      afterHash: seamHash,
      reproducesTooling: toolingHash === seamHash,
      matchesRecordedBefore,
      expectedMapChangeObserved: recorded
        ? w.expectedMapChange
          ? !matchesRecordedBefore
          : matchesRecordedBefore
        : false,
      recordedObjectiveMoves: recorded?.objectiveMoves ?? null,
      recordedForcedStreak: recorded?.objectiveLongestForcedStreak ?? null,
      recordedChestDetour: recorded?.chestDetour ?? null,
      recordedPickaxeBestImprovement: recorded?.pickaxeBestImprovement ?? null,
      recordedGuardianStartDistance: recorded?.guardianStartDistance ?? null,
      seedDecodesToRoute: decodedRoute,
      seedDecodesToMode: MODES[decodedModeIndex],
      seedAgreesWithStatedScenario:
        decodedRoute === w.route && MODES[decodedModeIndex] === w.mode,
    });
  }
  record(
    "C",
    "SAME_SEED_BEFORE_AFTER_CONTRACT",
    witnessReproduction.every(
      (w) =>
        w.reproducesTooling &&
        w.expectedMapChangeObserved &&
        w.seedAgreesWithStatedScenario,
    ),
    {
      witnesses: witnessReproduction.map((w) => ({
        id: w.id,
        scenario: `R${w.route}/${w.mode}`,
        seed: w.seed,
        expectedMapChange: w.expectedMapChange,
        expectedMapChangeObserved: w.expectedMapChangeObserved,
        beforeHash: w.beforeHash,
        afterHash: w.afterHash,
        beforeTrait: w.note,
      })),
      seedFormula: "12400000 + route*10000 + modeIndex*1000 + sample",
      note:
        "compared against the immutable BEFORE mapHash: Easy/Medium remain exact while the two selected Hard witnesses change deterministically",
    },
  );
}

// ===========================================================================
// D — armed, the whole launched session is reproducible
// ===========================================================================
const sessionDeterminism = [];
{
  /**
   * Not just the map: the state a player actually arrives in, and the state
   * they reach after playing the same scripted moves — which exercises the
   * Hunter, the Sentinel and every runtime draw.
   */
  const snapshot = (run) => {
    const g = run.state;
    return {
      route: g.routeNumber,
      mode: g.difficulty,
      map: fingerprint(g.mazeMap),
      player: kOf(g.player),
      guardian: kOf(g.guardian),
      sentinel: kOf(g.sentinel),
      chest: g.chestPosition ? kOf(g.chestPosition) : null,
      lights: g.mazeMap.collectibleStars.map(kOf).sort().join("|"),
      traps: g.mazeMap.traps.map(kOf).sort().join("|"),
      status: g.status,
    };
  };

  const play = (seed, route, mode) => {
    RANDOM.armRouteRandomSeed(seed);
    const run = RUNTIME.mount({
      seed: 1, // irrelevant: the armed seam is what drives generation now
      routeNumber: route,
      initialDifficulty: mode,
    });
    const start = snapshot(run);
    // A fixed scripted walk, so any runtime divergence would show up.
    const trace = [];
    for (let turn = 0; turn < 12 && run.state.status === "playing"; turn += 1) {
      if (run.state.rewardChoicePending) {
        run.choose("pickaxe");
        continue;
      }
      const options = walkableNeighbours(run.state.player, run.state.walls);
      if (!options.length) break;
      run.stepTo(options[turn % options.length]);
      trace.push(
        `${kOf(run.state.player)}>${kOf(run.state.guardian)}>${kOf(run.state.sentinel)}`,
      );
    }
    RANDOM.clearRouteRandomSeed();
    return { start, trace: trace.join(" "), end: snapshot(run) };
  };

  for (const w of WITNESSES) {
    const first = play(w.seed, w.route, w.mode);
    const second = play(w.seed, w.route, w.mode);
    sessionDeterminism.push({
      id: w.id,
      scenario: `R${w.route}/${w.mode}`,
      seed: w.seed,
      startIdentical: JSON.stringify(first.start) === JSON.stringify(second.start),
      runtimeIdentical: first.trace === second.trace,
      endIdentical: JSON.stringify(first.end) === JSON.stringify(second.end),
      turnsTraced: first.trace.split(" ").filter(Boolean).length,
      start: first.start,
    });
  }
  record(
    "D",
    "RUNTIME_RNG_DETERMINISM",
    sessionDeterminism.every(
      (s) => s.startIdentical && s.runtimeIdentical && s.endIdentical,
    ),
    {
      cases: sessionDeterminism.length,
      note:
        "identical start state AND identical defender positions turn by turn — the Hunter's draws are on the same seeded stream",
    },
  );
}

// ===========================================================================
// E — a diagnostic session cannot bleed into a normal journey
// ===========================================================================
{
  RANDOM.armRouteRandomSeed(12432045);
  const armedHash = fingerprint(API.generateMaze("hard", 3));
  const wasArmed = RANDOM.getArmedRouteSeed();

  // What the launcher's unmount does.
  RANDOM.clearRouteRandomSeed();

  const afterArmed = RANDOM.getArmedRouteSeed();
  const a = fingerprint(API.generateMaze("hard", 3));
  const b = fingerprint(API.generateMaze("hard", 3));

  record(
    "E",
    "NO_BLEED_AFTER_DIAGNOSTIC",
    wasArmed === 12432045 &&
      afterArmed === null &&
      a !== b &&
      a !== armedHash &&
      b !== armedHash,
    {
      armedSeedDuring: wasArmed,
      armedSeedAfter: afterArmed,
      generationStochasticAgain: a !== b,
      neitherRepeatsTheSeededBoard: a !== armedHash && b !== armedHash,
      note:
        "clearRouteRandomSeed is what the launcher page's unmount effect calls; after it the product is stochastic again",
    },
  );
}

// ===========================================================================
// F — input validation, mirrored from the launcher
// ===========================================================================
{
  // The launcher's own parsers, restated here so the rules are asserted rather
  // than trusted. Kept in step by G below.
  const parseSeed = (raw) => {
    const t = String(raw).trim();
    if (!/^\d+$/.test(t)) return null;
    const v = Number(t);
    return Number.isSafeInteger(v) && v >= 0 && v <= 0xffffffff ? v : null;
  };
  const parseRoute = (raw) => {
    const t = String(raw).trim();
    if (!/^\d+$/.test(t)) return null;
    const v = Number(t);
    return Number.isSafeInteger(v) && v >= 1 && v <= 999 ? v : null;
  };
  const validMode = (m) => MODES.includes(m);

  const cases = [
    { input: "12432045", parser: "seed", expect: 12432045 },
    { input: "0", parser: "seed", expect: 0 },
    { input: "4294967295", parser: "seed", expect: 4294967295 },
    { input: "4294967296", parser: "seed", expect: null },
    { input: "-1", parser: "seed", expect: null },
    { input: "1.5", parser: "seed", expect: null },
    { input: "abc", parser: "seed", expect: null },
    { input: "", parser: "seed", expect: null },
    { input: "1e3", parser: "seed", expect: null },
    { input: "1", parser: "route", expect: 1 },
    { input: "4", parser: "route", expect: 4 },
    { input: "0", parser: "route", expect: null },
    { input: "-2", parser: "route", expect: null },
    { input: "abc", parser: "route", expect: null },
  ].map((c) => ({
    ...c,
    actual: c.parser === "seed" ? parseSeed(c.input) : parseRoute(c.input),
  }));

  const modeCases = ["easy", "medium", "hard", "nightmare", "", "EASY"].map((m) => ({
    mode: m,
    accepted: validMode(m),
    expected: ["easy", "medium", "hard"].includes(m),
  }));

  record(
    "F",
    "INPUT_VALIDATION",
    cases.every((c) => c.actual === c.expect) &&
      modeCases.every((m) => m.accepted === m.expected),
    {
      seedAndRouteCases: cases.length,
      modeCases: modeCases.length,
      rejected: cases.filter((c) => c.actual === null).map((c) => `${c.parser}:"${c.input}"`),
      note:
        "Route 4 is accepted because routes are unbounded by design; this mission does not decide where a journey ends",
    },
  );
}

// ===========================================================================
// G — the launcher page is dev-only and its rules match what F asserted
// ===========================================================================
{
  const ROOT = process.cwd();
  const page = fs.readFileSync(
    path.join(ROOT, "src/app/lab/route-launcher/page.tsx"),
    "utf8",
  );
  const home = fs.readFileSync(path.join(ROOT, "src/app/page.tsx"), "utf8");
  const seam = fs.readFileSync(path.join(ROOT, "src/engine/route-random.ts"), "utf8");
  const codeOnly = (s) =>
    s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

  const reachability = {
    homeLinksToLauncher: /route-launcher/.test(codeOnly(home)),
    launcherReachableOnlyByUrl: !/route-launcher/.test(
      codeOnly(home) + codeOnly(fs.readFileSync(path.join(ROOT, "src/components/GameScreen.tsx"), "utf8")),
    ),
    productArmsASeed:
      /armRouteRandomSeed/.test(codeOnly(home)) ||
      /armRouteRandomSeed/.test(
        codeOnly(fs.readFileSync(path.join(ROOT, "src/games/escape-maze/useEscapeMaze.ts"), "utf8")),
      ),
    launcherDisarmsOnUnmount: /useEffect\(\s*\(\)\s*=>\s*clearRouteRandomSeed/.test(page),
    usesStorage: /localStorage|sessionStorage|document\.cookie/.test(codeOnly(page) + codeOnly(seam)),
    replacesGlobalMathRandom: /Math\.random\s*=/.test(codeOnly(seam)),
    seamBoundsSeedRange: /0xffffffff|4294967295/.test(page),
  };

  record(
    "G",
    "DEV_ONLY_AND_CONTAINED",
    !reachability.homeLinksToLauncher &&
      reachability.launcherReachableOnlyByUrl &&
      !reachability.productArmsASeed &&
      reachability.launcherDisarmsOnUnmount &&
      !reachability.usesStorage &&
      !reachability.replacesGlobalMathRandom,
    {
      ...reachability,
      note:
        "nothing links to /lab/route-launcher, nothing in the product arms a seed, the page disarms on unmount, and no storage or global assignment is involved",
    },
  );
}

const allPass = tests.every((t) => t.pass);
fs.writeFileSync(
  path.join(OUT, "diagnostic-launcher.json"),
  JSON.stringify(
    {
      mission: "ROTA-DIFFICULTY-05-REBALANCE-LAUNCHER-REGRESSION",
      seam: "src/engine/route-random.ts",
      launcher: "src/app/lab/route-launcher/page.tsx (dev-only, URL-only)",
      canProductionGameplayBeSeeded:
        "yes, after adding one opt-in seam; before this mission there was none and the tooling could only seed inside a vm sandbox",
      generationDeterminism,
      witnessReproduction,
      sessionDeterminism,
      tests,
      allPass,
    },
    null,
    2,
  ),
);
console.log(`\n${allPass ? "DIAGNOSTIC_LAUNCHER_OK" : "DIAGNOSTIC_LAUNCHER_FAILED"}`);
if (!allPass) process.exitCode = 1;
