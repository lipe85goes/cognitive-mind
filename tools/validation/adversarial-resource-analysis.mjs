/** Exact lower-bound analysis for the seven 02A STATE_LIMIT cases. */
import fs from "node:fs";
import path from "node:path";

import { ACTIONS, API, buildContext, setSeed } from "./dynamic-solver.mjs";
import { packedSuccessorSet } from "./dynamic-solver-packed-successors.mjs";
import {
  initialPackedState,
  packState,
  unpackNumericState,
} from "./dynamic-solver-packed.mjs";

const OUT = path.resolve(
  process.env.ROUTE_VALIDATION_OUT ?? "docs/archive/route-adversarial-solvability-03",
);
const SOURCE = path.resolve(
  "docs/archive/route-dynamic-solvability-02a/hash-1/suspect-seeds-analysis.json",
);
const report = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
const limited = report.cases.filter((item) => item.resourceLimit === "STATE_LIMIT");

function parseState(value) {
  const [e, h, s, target, commit, lights, traps] = value.split("|");
  return {
    e,
    h,
    s,
    t: Number(target),
    c: Number(commit),
    lights: Number(lights),
    traps: Number(traps),
  };
}

function validateWitness(item) {
  setSeed(item.seed);
  const map = API.generateMaze(item.mode, item.route);
  const ctx = buildContext(map, item.mode);
  let state = initialPackedState(ctx);
  const steps = [];
  let valid = true;
  let failure = null;
  for (let index = 0; index < item.shortestExistentialWitness.length; index += 1) {
    const step = item.shortestExistentialWitness[index];
    const actionIndex = ACTIONS.findIndex((action) => action.name === step.action);
    const successors = packedSuccessorSet(ctx, state, actionIndex);
    if (!successors) {
      valid = false;
      failure = `step ${index + 1}: action ${step.action} is illegal`;
      break;
    }
    if (step.state === "WIN") {
      if (!successors.hasWin) {
        valid = false;
        failure = `step ${index + 1}: WIN is not in the successor set`;
      }
      steps.push({ index: index + 1, action: step.action, target: "WIN", matched: successors.hasWin });
      break;
    }
    const canonical = parseState(step.state);
    const targetKey = packState(ctx, canonical);
    const matched = successors.states.includes(targetKey);
    steps.push({ index: index + 1, action: step.action, target: step.state, matched });
    if (!matched) {
      valid = false;
      failure = `step ${index + 1}: target is outside the exact successor set`;
      break;
    }
    state = unpackNumericState(ctx, targetKey);
  }
  return { valid, failure, steps };
}

function growthBand(frontierRatio) {
  if (frontierRatio < 0.01) return "SMALL_OPEN_FRONTIER_HIGH_COMPLETION_PRIORITY";
  if (frontierRatio < 0.06) return "MODERATE_OPEN_FRONTIER";
  return "LARGE_OPEN_FRONTIER";
}

const cases = limited.map((item) => {
  const witness = validateWitness(item);
  const frontierRatio = item.frontier / item.statesExplored;
  return {
    seed: item.seed,
    route: item.route,
    mode: item.mode,
    officialVerdict: item.verdict,
    officialVerdictPreserved: item.verdict === "INCONCLUSIVE_RESOURCE_LIMIT",
    states: item.statesExplored,
    processedStates: item.processedStates,
    transitions: item.transitions,
    effectiveBranching: item.transitions / item.processedStates,
    frontier: item.frontier,
    frontierRatio,
    peakFrontier: item.peakFrontier,
    growthBand: growthBand(frontierRatio),
    estimatedTotalStates: null,
    estimateReason:
      "An open BFS frontier is a strict lower bound, not a statistically valid estimator of the remaining finite graph.",
    exactLowerBounds: {
      possibleWin: witness.valid,
      witnessLength: item.shortestExistentialWin,
      witnessValidatedAgainstExactSuccessors: witness.valid,
      guaranteedAttractorMembershipInPartialGraph: item.initialGuaranteed,
      guaranteedReclassificationAllowed: false,
      guaranteedReason:
        "The official truncated verdict remains unchanged until a standalone closed policy certificate or complete graph is validated.",
    },
    attractorsInObservedGraph: {
      existential: item.existentialAttractorStates,
      guaranteed: item.guaranteedAttractorStates,
    },
    checkpointResume: {
      useful: true,
      requiredState: [
        "packed node arrays and key-to-id index",
        "processed BFS head and frontier",
        "action and successor buffers",
        "shortest-witness parent arrays",
        "solver version and map/state-contract fingerprints",
      ],
      warning:
        "A JSON-only frontier is insufficient; deterministic node IDs and typed-array buffers must resume together.",
    },
    witnessValidation: witness,
  };
});

const output = {
  mission: "ROTA-ADVERSARIAL-SOLVABILITY-03",
  source: path.relative(process.cwd(), SOURCE),
  casesExpected: 7,
  casesAnalyzed: cases.length,
  officialStateLimitVerdictsPreserved: cases.every((item) => item.officialVerdictPreserved),
  exactPossibleWitnessesValidated: cases.filter(
    (item) => item.exactLowerBounds.witnessValidatedAgainstExactSuccessors,
  ).length,
  guaranteedPartialAttractorCandidates: cases
    .filter((item) => item.exactLowerBounds.guaranteedAttractorMembershipInPartialGraph)
    .map((item) => item.seed),
  fullGraphPriority: cases
    .filter((item) => item.frontierRatio < 0.01)
    .map((item) => item.seed),
  cases,
};
output.gateMet =
  output.casesAnalyzed === output.casesExpected &&
  output.officialStateLimitVerdictsPreserved &&
  output.exactPossibleWitnessesValidated === output.casesExpected;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "resource-limit-analysis.json"), JSON.stringify(output, null, 2));
console.log(JSON.stringify({
  cases: output.casesAnalyzed,
  possibleWitnesses: output.exactPossibleWitnessesValidated,
  guaranteedCandidates: output.guaranteedPartialAttractorCandidates,
  fullGraphPriority: output.fullGraphPriority,
}, null, 2));
console.log(output.gateMet ? "RESOURCE_LIMIT_LOWER_BOUNDS_OK" : "RESOURCE_LIMIT_LOWER_BOUNDS_FAILED");
if (!output.gateMet) process.exitCode = 1;
