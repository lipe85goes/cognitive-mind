/**
 * ROTA-DIFFICULTY-05-REBALANCE
 *
 * Compares the immutable Difficulty 04 baseline with the current production
 * generator and runtime. Automated policies remain comparative diagnostics;
 * none of their win rates is treated as a human target.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runDifficultyBaseline } from "./difficulty-baseline-run.mjs";

const BASELINE_PATH = path.resolve(
  "docs/archive/route-difficulty-04-baseline/difficulty-baseline.json",
);
const DEFAULT_OUT = "docs/archive/route-difficulty-05-rebalance";
const ROUTES = [1, 2, 3];
const MODES = ["easy", "medium", "hard"];
const WITNESSES = [
  { seed: 12420031, route: 2, mode: "easy", expectedMapChange: false },
  { seed: 12430048, route: 3, mode: "easy", expectedMapChange: false },
  { seed: 12421027, route: 2, mode: "medium", expectedMapChange: false },
  { seed: 12432116, route: 3, mode: "hard", expectedMapChange: true },
  { seed: 12432045, route: 3, mode: "hard", expectedMapChange: true },
];
const GEOMETRY_FIELDS = [
  "wallCount",
  "walkableCells",
  "lightCount",
  "trapCount",
  "objectiveMoves",
  "objectiveDecisionRatio",
  "objectiveLongestForcedStreak",
  "junctions",
  "deadEnds",
  "corridorRatio",
  "cycleRank",
  "articulationPoints",
  "objectiveArticulationPoints",
  "guardianStartDistance",
  "portalDistance",
  "portalZoneCells",
  "portalAccesses",
  "chestDistance",
  "chestDetour",
  "pickaxeBeneficialWalls",
  "pickaxeBestImprovement",
  "chestAdjacentPickaxeImprovement",
];
const POLICY_FIELDS = [
  "winRate",
  "timeoutRate",
  "hunterThreatShare",
  "sentinelThreatShare",
  "sentinelPortalBlockShare",
  "sentinelZoneShare",
  "sentinelCommittedShare",
  "effectiveHunterBranching",
  "potentialHunterCaptureShare",
  "potentialSentinelCaptureShare",
  "chestOpenRate",
  "rewardSpentRate",
  "secondChanceActivations",
  "wallsBroken",
];

const round = (value, digits = 4) =>
  Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
const sha256File = (file) =>
  crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const matrixRow = (report, route, mode) =>
  report.routeDifficultyMatrix.find(
    (row) => row.route === route && row.mode === mode,
  );
const policyRow = (report, route, mode, policy) =>
  report.runtimePolicyMatrix.find(
    (row) =>
      row.route === route && row.mode === mode && row.policy === policy,
  );
const geometrySample = (report, seed) =>
  report.geometrySamples.find((sample) => sample.seed === seed) ?? null;
const meanMetric = (report, route, mode, field) =>
  matrixRow(report, route, mode)?.metrics[field]?.mean ?? null;

function comparison(before, after) {
  if (!Number.isFinite(before) || !Number.isFinite(after)) {
    return { before: before ?? null, after: after ?? null, delta: null, percent: null };
  }
  return {
    before: round(before),
    after: round(after),
    delta: round(after - before),
    percent: before === 0 ? null : round(((after - before) / before) * 100, 2),
  };
}

function geometryComparison(before, after) {
  return ROUTES.flatMap((route) =>
    MODES.map((mode) => {
      const previous = matrixRow(before, route, mode);
      const current = matrixRow(after, route, mode);
      return {
        route,
        mode,
        mapsBefore: previous?.maps ?? 0,
        mapsAfter: current?.maps ?? 0,
        metrics: Object.fromEntries(
          GEOMETRY_FIELDS.map((field) => [
            field,
            comparison(
              previous?.metrics[field]?.mean,
              current?.metrics[field]?.mean,
            ),
          ]),
        ),
        pickaxeBeneficialMapRate: comparison(
          previous?.pickaxeBeneficialMapRate,
          current?.pickaxeBeneficialMapRate,
        ),
        chestAdjacentPickaxeBeneficialRate: comparison(
          previous?.chestAdjacentPickaxeBeneficialRate,
          current?.chestAdjacentPickaxeBeneficialRate,
        ),
      };
    }),
  );
}

function policyComparison(before, after) {
  return after.runtimePolicyMatrix.map((current) => {
    const previous = policyRow(
      before,
      current.route,
      current.mode,
      current.policy,
    );
    return {
      route: current.route,
      mode: current.mode,
      policy: current.policy,
      runsBefore: previous?.runs ?? 0,
      runsAfter: current.runs,
      outcomesBefore: previous?.outcomes ?? null,
      outcomesAfter: current.outcomes,
      metrics: Object.fromEntries(
        POLICY_FIELDS.map((field) => [
          field,
          comparison(previous?.[field], current[field]),
        ]),
      ),
      turns: comparison(previous?.turns?.mean, current.turns?.mean),
      winningTurns: comparison(
        previous?.winningTurns?.mean,
        current.winningTurns?.mean,
      ),
    };
  });
}

function witnessComparison(before, after) {
  return WITNESSES.map((witness) => {
    const previous = geometrySample(before, witness.seed);
    const current = geometrySample(after, witness.seed);
    return {
      ...witness,
      presentBefore: Boolean(previous),
      presentAfter: Boolean(current),
      beforeHash: previous?.mapHash ?? null,
      afterHash: current?.mapHash ?? null,
      hashChanged:
        Boolean(previous && current) && previous.mapHash !== current.mapHash,
      expectedHashChangeObserved:
        Boolean(previous && current) &&
        (previous.mapHash !== current.mapHash) === witness.expectedMapChange,
      metrics: Object.fromEntries(
        GEOMETRY_FIELDS.map((field) => [
          field,
          comparison(previous?.[field], current?.[field]),
        ]),
      ),
      beforePickaxeBestWall: previous?.pickaxeBestWall ?? null,
      afterPickaxeBestWall: current?.pickaxeBestWall ?? null,
    };
  });
}

function hardEvidence(matrix) {
  return ROUTES.map((route) => {
    const row = matrix.find(
      (candidate) => candidate.route === route && candidate.mode === "hard",
    );
    const structuralAxes = {
      fewerJunctions: row.metrics.junctions.delta <= -1,
      moreCorridor: row.metrics.corridorRatio.delta >= 0.015,
      moreArticulation: row.metrics.articulationPoints.delta >= 0.5,
      longerForcedRuns:
        row.metrics.objectiveLongestForcedStreak.delta >= 0.2,
    };
    const structuralAxesMet = Object.values(structuralAxes).filter(Boolean).length;
    return {
      route,
      wallIncrease: row.metrics.wallCount.delta,
      objectiveMoveIncrease: row.metrics.objectiveMoves.delta,
      structuralAxes,
      structuralAxesMet,
      materiallyHarder:
        row.metrics.wallCount.delta >= 1 &&
        row.metrics.objectiveMoves.delta >= 1 &&
        structuralAxesMet >= 2,
    };
  });
}

function progressionGates(after, matrix) {
  // The mission explicitly rejects gross Route inversions, not sample-noise
  // monotonicity. A quarter move across 120 seeds is the declared near-tie
  // tolerance; wall progression remains strict and Hard remains materially
  // separated by the independent hard gate.
  const routeObjectiveNearTieTolerance = 0.25;
  const difficulty = ROUTES.map((route) => {
    const values = Object.fromEntries(
      MODES.map((mode) => [
        mode,
        {
          walls: meanMetric(after, route, mode, "wallCount"),
          objectiveMoves: meanMetric(after, route, mode, "objectiveMoves"),
          decisionRatio: meanMetric(
            after,
            route,
            mode,
            "objectiveDecisionRatio",
          ),
        },
      ]),
    );
    return {
      route,
      values,
      coherent:
        values.easy.walls < values.medium.walls &&
        values.medium.walls < values.hard.walls &&
        values.easy.objectiveMoves < values.medium.objectiveMoves &&
        values.medium.objectiveMoves < values.hard.objectiveMoves &&
        values.easy.decisionRatio >= values.medium.decisionRatio &&
        values.medium.decisionRatio >= values.hard.decisionRatio,
    };
  });
  const routes = MODES.map((mode) => {
    const values = Object.fromEntries(
      ROUTES.map((route) => [
        `route${route}`,
        {
          walls: meanMetric(after, route, mode, "wallCount"),
          objectiveMoves: meanMetric(after, route, mode, "objectiveMoves"),
        },
      ]),
    );
    return {
      mode,
      values,
      objectiveMoveDeltas: {
        route1To2: round(values.route2.objectiveMoves - values.route1.objectiveMoves),
        route2To3: round(values.route3.objectiveMoves - values.route2.objectiveMoves),
      },
      objectiveNearTieTolerance: routeObjectiveNearTieTolerance,
      coherent:
        values.route1.walls < values.route2.walls &&
        values.route2.walls < values.route3.walls &&
        values.route1.objectiveMoves <=
          values.route2.objectiveMoves + routeObjectiveNearTieTolerance &&
        values.route2.objectiveMoves <=
          values.route3.objectiveMoves + routeObjectiveNearTieTolerance,
    };
  });
  const easy = matrix
    .filter((row) => row.mode === "easy")
    .map((row) => ({
      route: row.route,
      decisionRatioDelta: row.metrics.objectiveDecisionRatio.delta,
      forcedStreakDelta: row.metrics.objectiveLongestForcedStreak.delta,
      accessible:
        row.metrics.objectiveDecisionRatio.delta >= -0.03 &&
        row.metrics.objectiveLongestForcedStreak.delta <= 1,
    }));
  return { difficulty, routes, easy };
}

export function buildRebalanceReport(after, before) {
  const matrix = geometryComparison(before, after);
  const policies = policyComparison(before, after);
  const witnesses = witnessComparison(before, after);
  const hard = hardEvidence(matrix);
  const progression = progressionGates(after, matrix);
  const integrity = {
    generationFailures: after.integrity.generationFailures.length,
    invalidUiStates: after.integrity.invalidUiStates,
    invalidPolicyRuns: after.integrity.invalidPolicyRuns,
    policyMapMismatches: after.integrity.policyMapMismatches,
  };
  const gates = {
    afterBaselineGate: after.gateMet,
    sampleComparable:
      before.sample.geometrySeedsPerCombination ===
        after.sample.geometrySeedsPerCombination &&
      before.sample.policySeedsPerCombination ===
        after.sample.policySeedsPerCombination,
    hardMateriallyIncreased: hard.every((row) => row.materiallyHarder),
    easyAccessible: progression.easy.every((row) => row.accessible),
    difficultyCoherent: progression.difficulty.every((row) => row.coherent),
    routeCoherent: progression.routes.every((row) => row.coherent),
    witnessHashContract: witnesses.every(
      (witness) =>
        witness.presentBefore &&
        witness.presentAfter &&
        witness.expectedHashChangeObserved,
    ),
    runtimeIntegrity: Object.values(integrity).every((value) => value === 0),
  };
  return {
    mission: "ROTA-DIFFICULTY-05-REBALANCE",
    semantics: {
      automatedPolicies:
        "Comparative regression instruments only; never a human win-rate estimate.",
      hardGate:
        "Every Route must gain walls, objective burden and at least two independent structural-pressure signals.",
      humanStatus:
        "A green report produces a candidate for human playtest, not a final balance verdict.",
      routeCoherence:
        "Walls must increase strictly. Adjacent objective means may be a near tie within 0.25 moves across 120 seeds; larger inversions fail.",
    },
    baseline: {
      path: path.relative(process.cwd(), BASELINE_PATH).replaceAll("\\", "/"),
      sha256: sha256File(BASELINE_PATH),
      fingerprint: before.determinismFingerprint,
      sample: before.sample,
    },
    after: {
      fingerprint: after.determinismFingerprint,
      sample: after.sample,
      progression: after.progression,
    },
    selectedChanges: {
      hardWallLimits: { before: { min: 23, max: 28 }, after: { min: 25, max: 30 } },
      hardBaseObjectives: { before: 5, after: 6 },
      hardMinDecisionRatio: { before: 0.5, after: 0.46 },
      hardMaxForcedStreak: { before: 5, after: 6 },
      route3ObjectiveSeparation: {
        easy: { before: 3, after: 3 },
        medium: { before: 3, after: 3 },
        hard: { before: 3, after: 4 },
      },
      traps: "unchanged",
      hunterPolicy: "unchanged",
      sentinelPolicy: "unchanged",
      chestAndRewards: "unchanged",
    },
    routeDifficultyMatrix: matrix,
    hardEvidence: hard,
    progression,
    witnesses,
    policyComparison: policies,
    integrity,
    gates,
    gateMet: Object.values(gates).every(Boolean),
  };
}

export function runDifficultyRebalance(options = {}) {
  const before = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  const after = runDifficultyBaseline(options);
  return { after, comparison: buildRebalanceReport(after, before) };
}

function optionNumber(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? Number(process.argv[index + 1]) : fallback;
}

function main() {
  const out = path.resolve(process.env.ROUTE_VALIDATION_OUT ?? DEFAULT_OUT);
  const reuseAfter = process.argv.includes("--reuse-after");
  const result = reuseAfter
    ? (() => {
        const before = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
        const after = JSON.parse(
          fs.readFileSync(path.join(out, "difficulty-after.json"), "utf8"),
        );
        return { after, comparison: buildRebalanceReport(after, before) };
      })()
    : runDifficultyRebalance({
        geometrySeeds: optionNumber("--geometry-seeds", 120),
        uiSeeds: optionNumber("--ui-seeds", 30),
        policySeeds: optionNumber("--policy-seeds", 24),
        maxTurns: optionNumber("--max-turns", 160),
        quiet: process.argv.includes("--quiet"),
      });
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(
    path.join(out, "difficulty-after.json"),
    `${JSON.stringify(result.after, null, 2)}\n`,
  );
  fs.writeFileSync(
    path.join(out, "difficulty-rebalance.json"),
    `${JSON.stringify(result.comparison, null, 2)}\n`,
  );
  console.log(
    JSON.stringify(
      {
        sample: result.after.sample,
        hardEvidence: result.comparison.hardEvidence,
        gates: result.comparison.gates,
        gateMet: result.comparison.gateMet,
        fingerprint: result.after.determinismFingerprint,
      },
      null,
      2,
    ),
  );
  console.log(
    result.comparison.gateMet
      ? "DIFFICULTY_REBALANCE_CANDIDATE_OK"
      : "DIFFICULTY_REBALANCE_CANDIDATE_FAILED",
  );
  if (!result.comparison.gateMet) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) main();
