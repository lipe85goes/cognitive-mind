/** Focused deterministic gates for ROTA-DIFFICULTY-05-REBALANCE. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { runDifficultyBaseline } from "./difficulty-baseline-run.mjs";
import { loadInstrumented } from "./instrumented-generator.mjs";
import { openEvidence } from "./evidence.mjs";

const EVIDENCE = openEvidence(
  process.env.ROUTE_VALIDATION_OUT ??
    "docs/archive/route-difficulty-05-rebalance/regressions/rebalance-focused",
);
const BASELINE = JSON.parse(
  fs.readFileSync(
    path.resolve(
      "docs/archive/route-difficulty-04-baseline/difficulty-baseline.json",
    ),
    "utf8",
  ),
);
const WITNESSES = [
  { seed: 12420031, route: 2, mode: "easy", shouldChange: false },
  { seed: 12430048, route: 3, mode: "easy", shouldChange: false },
  { seed: 12421027, route: 2, mode: "medium", shouldChange: false },
  { seed: 12432116, route: 3, mode: "hard", shouldChange: true },
  { seed: 12432045, route: 3, mode: "hard", shouldChange: true },
];
const failures = [];

function assert(condition, code, detail = null) {
  if (!condition) failures.push({ code, detail });
}

const keyOf = (position) => `${position.row},${position.col}`;
const mapHash = (map) =>
  crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        walls: [...map.walls].sort(),
        guardian: keyOf(map.guardianStart),
        exit: keyOf(map.exitPosition),
        lights: map.collectibleStars.map(keyOf),
        traps: map.traps.map(keyOf),
        chest: map.chest ? keyOf(map.chest) : null,
      }),
    )
    .digest("hex");

const first = runDifficultyBaseline({
  geometrySeeds: 1,
  uiSeeds: 1,
  policySeeds: 1,
  maxTurns: 16,
  quiet: true,
});
const second = runDifficultyBaseline({
  geometrySeeds: 1,
  uiSeeds: 1,
  policySeeds: 1,
  maxTurns: 16,
  quiet: true,
});

assert(first.gateMet && second.gateMet, "FOCUSED_BASELINE_GATE");
assert(
  first.determinismFingerprint === second.determinismFingerprint,
  "FOCUSED_FINGERPRINT_MISMATCH",
  {
    first: first.determinismFingerprint,
    second: second.determinismFingerprint,
  },
);
assert(first.integrity.generationFailures.length === 0, "GENERATION_FAILURE");
assert(first.integrity.invalidUiStates === 0, "INVALID_UI_STATE");
assert(first.integrity.invalidPolicyRuns === 0, "INVALID_POLICY_STATE");
assert(first.integrity.policyMapMismatches === 0, "POLICY_MAP_MISMATCH");

const lab = loadInstrumented({ bare: true });
const { API } = lab;
assert(
  API.WALL_LIMITS.hard.min === 25 && API.WALL_LIMITS.hard.max === 30,
  "HARD_WALL_LIMITS",
  API.WALL_LIMITS.hard,
);
assert(API.BASE_STAR_COUNT.hard === 6, "HARD_BASE_OBJECTIVES");
assert(
  API.DIFFICULTY_PLAY_BRIEF.hard.minDecisionRatio === 0.46,
  "HARD_DECISION_RATIO",
);
assert(
  API.DIFFICULTY_PLAY_BRIEF.hard.maxForcedStreak === 6,
  "HARD_FORCED_STREAK",
);
assert(
  API.ROUTE_STAGE_QUALITY[3].starMinSeparation === 3 &&
    API.getStarMinSeparation("easy", 3) === 3 &&
    API.getStarMinSeparation("medium", 3) === 3 &&
    API.getStarMinSeparation("hard", 3) === 4,
  "ROUTE3_OBJECTIVE_SEPARATION",
);
assert(
  JSON.stringify(API.WALL_LIMITS.easy) === JSON.stringify({ min: 13, max: 18 }) &&
    JSON.stringify(API.WALL_LIMITS.medium) ===
      JSON.stringify({ min: 18, max: 23 }),
  "EASY_MEDIUM_WALL_LIMITS_CHANGED",
);
assert(
  API.BASE_STAR_COUNT.easy === 3 && API.BASE_STAR_COUNT.medium === 4,
  "EASY_MEDIUM_OBJECTIVES_CHANGED",
);

const witnesses = WITNESSES.map((witness) => {
  const recorded = BASELINE.geometrySamples.find(
    (sample) => sample.seed === witness.seed,
  );
  lab.setSeed(witness.seed);
  const firstMap = API.generateMaze(witness.mode, witness.route);
  lab.setSeed(witness.seed);
  const repeatedMap = API.generateMaze(witness.mode, witness.route);
  const afterHash = mapHash(firstMap);
  const repeatedHash = mapHash(repeatedMap);
  const hashChanged = recorded?.mapHash !== afterHash;
  const valid = API.isValidMap(firstMap, witness.mode, witness.route);
  assert(Boolean(recorded), "WITNESS_MISSING_BEFORE", witness);
  assert(afterHash === repeatedHash, "WITNESS_NONDETERMINISTIC", witness);
  assert(
    hashChanged === witness.shouldChange,
    "WITNESS_CHANGE_CONTRACT",
    { ...witness, beforeHash: recorded?.mapHash, afterHash },
  );
  assert(valid, "WITNESS_INVALID_AFTER", witness);
  return {
    ...witness,
    beforeHash: recorded?.mapHash ?? null,
    afterHash,
    repeatedHash,
    deterministic: afterHash === repeatedHash,
    hashChanged,
    valid,
  };
});

const report = {
  mission: "ROTA-DIFFICULTY-05-REBALANCE",
  suite: "difficulty-rebalance-focused",
  fingerprints: {
    first: first.determinismFingerprint,
    second: second.determinismFingerprint,
    equal: first.determinismFingerprint === second.determinismFingerprint,
  },
  parameters: {
    wallLimits: API.WALL_LIMITS,
    baseObjectives: API.BASE_STAR_COUNT,
    hardPlayBrief: API.DIFFICULTY_PLAY_BRIEF.hard,
    route3ObjectiveSeparation: Object.fromEntries(
      ["easy", "medium", "hard"].map((mode) => [
        mode,
        API.getStarMinSeparation(mode, 3),
      ]),
    ),
  },
  witnesses,
  failures,
  gateMet: failures.length === 0,
};

EVIDENCE.write("difficulty-rebalance-tests.json", report);
console.log(JSON.stringify(report, null, 2));
console.log(
  report.gateMet
    ? "DIFFICULTY_REBALANCE_TESTS_OK"
    : "DIFFICULTY_REBALANCE_TESTS_FAILED",
);
process.exitCode = EVIDENCE.finish({ ok: report.gateMet });
