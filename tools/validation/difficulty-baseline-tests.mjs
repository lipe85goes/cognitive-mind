/**
 * Focused deterministic contracts for ROTA-DIFFICULTY-04-BASELINE.
 */
import fs from "node:fs";
import path from "node:path";

import { runDifficultyBaseline } from "./difficulty-baseline-run.mjs";

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
assert(
  first.uiVsValidationGeneration.directIdentityMatches === 0,
  "DIRECT_AND_UI_UNEXPECTEDLY_IDENTICAL",
);
assert(first.uiVsValidationGeneration.routeResetCount === 4, "ROUTE_RESET_COUNT");
assert(
  JSON.stringify(
    first.uiVsValidationGeneration.routeResetRequestedCombinations.sort(),
  ) ===
    JSON.stringify(
      [
        "route2/hard",
        "route2/medium",
        "route3/hard",
        "route3/medium",
      ].sort(),
    ),
  "ROUTE_RESET_COMBINATIONS",
  first.uiVsValidationGeneration.routeResetRequestedCombinations,
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
const out = path.resolve(
  process.env.ROUTE_VALIDATION_OUT ??
    "docs/archive/route-difficulty-04-baseline",
);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(
  path.join(out, "difficulty-baseline-tests.json"),
  JSON.stringify(report, null, 2),
);
console.log(JSON.stringify(report, null, 2));
console.log(report.gateMet ? "DIFFICULTY_BASELINE_TESTS_OK" : "DIFFICULTY_BASELINE_TESTS_FAILED");
if (!report.gateMet) process.exitCode = 1;
