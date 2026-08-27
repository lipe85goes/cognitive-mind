/**
 * Focused deterministic contracts for ROTA-DIFFICULTY-04-BASELINE.
 *
 * Usage: node tools/validation/difficulty-baseline-tests.mjs [--check|--update]
 */
import { runDifficultyBaseline } from "./difficulty-baseline-run.mjs";
import { openEvidence } from "./evidence.mjs";

const failures = [];
const assert = (condition, code, detail = null) => {
  if (!condition) failures.push({ code, detail });
};
const options = {
  geometrySeeds: 1,
  uiSeeds: 1,
  policySeeds: 1,
  maxTurns: 12,
  quiet: true,
};

const first = runDifficultyBaseline(options);
const second = runDifficultyBaseline(options);
assert(first.gateMet, "FIRST_RUN_GATE", first.integrity);
assert(second.gateMet, "SECOND_RUN_GATE", second.integrity);
assert(
  first.determinismFingerprint === second.determinismFingerprint,
  "FINGERPRINT_MISMATCH",
  {
    first: first.determinismFingerprint,
    second: second.determinismFingerprint,
  },
);
assert(first.routeDifficultyMatrix.length === 9, "MATRIX_NOT_3X3");
assert(first.geometrySamples.length === 9, "GEOMETRY_SAMPLE_COUNT");
assert(first.uiVsValidationGeneration.uiSamples.length === 9, "UI_SAMPLE_COUNT");
assert(first.uiVsValidationGeneration.determinismChecks === 9, "UI_DETERMINISM_CHECKS");
assert(first.uiVsValidationGeneration.deterministicSamples === 9, "UI_NONDETERMINISTIC");
/**
 * Still zero, and still NOT a defect.
 *
 * ROTA-DIFFICULTY-04A investigated this separately from the route reset and
 * classified it EXPECTED_RNG_SEQUENCE_DIFFERENCE: the hook generates a board on
 * mount, and another on mode selection, before the player presses Start, so its
 * map is drawn further along the same RNG stream than a single direct
 * `generateMaze` call. Replaying that exact sequence directly reproduces the UI
 * map byte for byte (54/54) — see `route-difficulty-identity-tests.mjs` test F.
 */
assert(
  first.uiVsValidationGeneration.directIdentityMatches === 0,
  "DIRECT_AND_UI_UNEXPECTEDLY_IDENTICAL",
);
/**
 * ROTA-DIFFICULTY-04A: these two assertions used to pin the DEFECT — four
 * combinations (R2/R3 x medium/hard) whose Route was silently reset to 1 by
 * `changeDifficulty`. That was the right thing for a baseline to record; it is
 * the wrong thing to keep asserting once the cause is fixed. They now pin the
 * contract instead: selecting a mode never changes the Route.
 */
assert(first.uiVsValidationGeneration.routeResetCount === 0, "ROUTE_RESET_COUNT", {
  observed: first.uiVsValidationGeneration.routeResetCount,
  baselineBeforeFix: 4,
});
assert(
  first.uiVsValidationGeneration.routeResetRequestedCombinations.length === 0,
  "ROUTE_RESET_COMBINATIONS",
  first.uiVsValidationGeneration.routeResetRequestedCombinations,
);
assert(
  first.uiVsValidationGeneration.requestedCombinationPreserved ===
    first.uiVsValidationGeneration.uiSamples.length,
  "REQUESTED_COMBINATION_NOT_PRESERVED",
  {
    preserved: first.uiVsValidationGeneration.requestedCombinationPreserved,
    samples: first.uiVsValidationGeneration.uiSamples.length,
  },
);
assert(first.policyRuns.length === 36, "POLICY_RUN_COUNT");
assert(first.integrity.generationFailures.length === 0, "GENERATION_FAILURE");
assert(first.integrity.invalidUiStates === 0, "INVALID_UI_STATE");
assert(first.integrity.invalidPolicyRuns === 0, "INVALID_POLICY_STATE");
assert(first.integrity.policyMapMismatches === 0, "POLICY_MAP_MISMATCH");
assert(
  first.legacySimulatorAudit.classification === "PARTIALLY_STALE",
  "LEGACY_CLASSIFICATION",
);
assert(
  first.legacySimulatorAudit.provenanceMismatch.includes("do not exactly match"),
  "LEGACY_PROVENANCE_MISMATCH_NOT_RECORDED",
);
assert(
  first.parameterTable.filter((row) => row.parameter === "Hunter policy").length === 3,
  "HUNTER_PARAMETER_ROWS",
);
assert(
  first.parameterTable.filter(
    (row) => row.parameter === "route x difficulty generation",
  ).length === 9,
  "ROUTE_DIFFICULTY_PARAMETER_ROWS",
);

const report = {
  mission: "ROTA-DIFFICULTY-04-BASELINE",
  suite: "difficulty-baseline-focused",
  options,
  fingerprints: {
    first: first.determinismFingerprint,
    second: second.determinismFingerprint,
    equal: first.determinismFingerprint === second.determinismFingerprint,
  },
  matrixRows: first.routeDifficultyMatrix.length,
  ui: {
    samples: first.uiVsValidationGeneration.uiSamples.length,
    deterministic: first.uiVsValidationGeneration.deterministicSamples,
    directIdentityMatches: first.uiVsValidationGeneration.directIdentityMatches,
    routeResetCount: first.uiVsValidationGeneration.routeResetCount,
  },
  policyRuns: first.policyRuns.length,
  failures,
  gateMet: failures.length === 0,
};
const EVIDENCE = openEvidence(
  process.env.ROUTE_VALIDATION_OUT ??
    "docs/archive/route-difficulty-04-baseline",
);
EVIDENCE.write("difficulty-baseline-tests.json", report);
console.log(JSON.stringify(report, null, 2));
console.log(report.gateMet ? "DIFFICULTY_BASELINE_TESTS_OK" : "DIFFICULTY_BASELINE_TESTS_FAILED");
process.exitCode = EVIDENCE.finish({ ok: report.gateMet });
