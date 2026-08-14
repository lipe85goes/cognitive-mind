/** Compare two isolated exact 12-seed resource-bound runs. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) {
    throw new Error(`Missing required argument: ${name}`);
  }
  return process.argv[index + 1];
}

const leftPath = path.resolve(argument("--left"));
const rightPath = path.resolve(argument("--right"));
const outPath = path.resolve(argument("--out"));
const left = JSON.parse(fs.readFileSync(leftPath, "utf8"));
const right = JSON.parse(fs.readFileSync(rightPath, "utf8"));

const EXPECTED_BUDGET = 1_000_000;
const EXPECTED_CASES = [
  [8801008, 1, "easy"],
  [8801012, 1, "easy"],
  [8801014, 1, "easy"],
  [8801107, 1, "medium"],
  [8801108, 1, "medium"],
  [8801109, 1, "medium"],
  [8801110, 1, "medium"],
  [8801204, 1, "hard"],
  [8801207, 1, "hard"],
  [8801212, 1, "hard"],
  [8801214, 1, "hard"],
  [8802000, 2, "easy"],
];
const caseIdentity = (item) => `${item.seed}|${item.route}|${item.mode}`;
const expectedIdentities = EXPECTED_CASES.map(([seed, route, mode]) =>
  caseIdentity({ seed, route, mode }));
const stableCase = (item) => ({
  seed: item.seed,
  route: item.route,
  mode: item.mode,
  verdict: item.verdict,
  initialExistential: item.initialExistential,
  initialGuaranteed: item.initialGuaranteed,
  statesExplored: item.statesExplored,
  processedStates: item.processedStates,
  transitions: item.transitions,
  truncated: item.truncated,
  resourceLimit: item.resourceLimit,
  frontier: item.frontier,
  peakFrontier: item.peakFrontier,
  reachableWinning: item.reachableWinning,
  reachableNonWinning: item.reachableNonWinning,
  existentialAttractorStates: item.existentialAttractorStates,
  guaranteedAttractorStates: item.guaranteedAttractorStates,
  shortestExistentialWin: item.shortestExistentialWin,
  shortestExistentialWitness: item.shortestExistentialWitness,
});
const canonical = (value) => JSON.stringify(value);
const fingerprint = (value) =>
  crypto.createHash("sha256").update(canonical(value)).digest("hex");
const bySeed = (report) =>
  new Map(report.cases.map((item) => [item.seed, item]));

const leftCases = bySeed(left);
const rightCases = bySeed(right);
const seeds = [...new Set([...leftCases.keys(), ...rightCases.keys()])].sort((a, b) => a - b);
const rows = [];
for (const seed of seeds) {
  const leftCase = leftCases.get(seed);
  const rightCase = rightCases.get(seed);
  const leftLogical = leftCase ? stableCase(leftCase) : null;
  const rightLogical = rightCase ? stableCase(rightCase) : null;
  rows.push({
    seed,
    route: leftCase?.route ?? rightCase?.route ?? null,
    mode: leftCase?.mode ?? rightCase?.mode ?? null,
    verdict: leftCase?.verdict ?? rightCase?.verdict ?? null,
    leftElapsedMs: leftCase?.elapsedMs ?? null,
    rightElapsedMs: rightCase?.elapsedMs ?? null,
    states: leftCase?.statesExplored ?? rightCase?.statesExplored ?? null,
    transitions: leftCase?.transitions ?? rightCase?.transitions ?? null,
    resourceLimit: leftCase?.resourceLimit ?? rightCase?.resourceLimit ?? null,
    leftFingerprint: fingerprint(leftLogical),
    rightFingerprint: fingerprint(rightLogical),
    equivalent: canonical(leftLogical) === canonical(rightLogical),
  });
}

const profile = (report) => ({
  cases: report.cases.length,
  totalRuntimeMs: report.totalRuntimeMs,
  states: report.cases.reduce((sum, item) => sum + item.statesExplored, 0),
  processedStates: report.cases.reduce((sum, item) => sum + item.processedStates, 0),
  transitions: report.cases.reduce((sum, item) => sum + item.transitions, 0),
  existentialAttractorStates: report.cases.reduce(
    (sum, item) => sum + item.existentialAttractorStates, 0,
  ),
  guaranteedAttractorStates: report.cases.reduce(
    (sum, item) => sum + item.guaranteedAttractorStates, 0,
  ),
  peakFrontier: Math.max(...report.cases.map((item) => item.peakFrontier)),
  estimatedPeakMemoryBytes: Math.max(
    ...report.cases.map((item) => item.memory.estimatedTotalBytes),
  ),
  graphMs: report.cases.reduce((sum, item) => sum + item.graphElapsedMs, 0),
  predecessorMs: report.cases.reduce(
    (sum, item) => sum + item.solveProfile.predecessorBuildMs, 0,
  ),
  existentialMs: report.cases.reduce(
    (sum, item) => sum + item.solveProfile.existentialMs, 0,
  ),
  guaranteedMs: report.cases.reduce(
    (sum, item) => sum + item.solveProfile.guaranteedMs, 0,
  ),
});

const mismatches = rows.filter((item) => !item.equivalent);
const timeoutCases = rows.filter((item) => item.resourceLimit === "TIME_LIMIT");
const expectedCasesMatched = [left, right].every((report) =>
  canonical(report.cases.map(caseIdentity).sort()) === canonical([...expectedIdentities].sort()));
const exactBudget = left.budget === EXPECTED_BUDGET && right.budget === EXPECTED_BUDGET;
const exactRunner = left.runner === "PACKED_EXACT" && right.runner === "PACKED_EXACT";
const environmentsDistinct =
  Boolean(left.executionEnvironment?.pythonHashSeed) &&
  Boolean(right.executionEnvironment?.pythonHashSeed) &&
  left.executionEnvironment.pythonHashSeed !== right.executionEnvironment.pythonHashSeed;
const supportedResourceLimits = rows.every((item) =>
  item.resourceLimit === null || item.resourceLimit === "STATE_LIMIT");
const complete =
  left.casesCompleted === 12 &&
  right.casesCompleted === 12 &&
  left.cases.length === 12 &&
  right.cases.length === 12 &&
  rows.length === 12 &&
  expectedCasesMatched;
const output = {
  mission: "ROTA-DYNAMIC-SOLVABILITY-02A-RESOURCE-BOUND-CLOSEOUT",
  expectedBudget: EXPECTED_BUDGET,
  left: {
    path: path.relative(process.cwd(), leftPath),
    executionEnvironment: left.executionEnvironment,
    ...profile(left),
  },
  right: {
    path: path.relative(process.cwd(), rightPath),
    executionEnvironment: right.executionEnvironment,
    ...profile(right),
  },
  casesExpected: 12,
  complete,
  expectedCasesMatched,
  exactBudget,
  exactRunner,
  environmentsDistinct,
  supportedResourceLimits,
  semanticMismatches: mismatches.length,
  timeoutCount: timeoutCases.length,
  resourceLimitedCases: rows.filter((item) => item.resourceLimit !== null).length,
  rows,
  gateMet:
    complete && exactBudget && exactRunner && environmentsDistinct &&
    supportedResourceLimits && mismatches.length === 0 && timeoutCases.length === 0,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
console.log(output.gateMet
  ? "RESOURCE_BOUND_CLOSEOUT_COMPARISON_OK"
  : "RESOURCE_BOUND_CLOSEOUT_COMPARISON_FAILED");
if (!output.gateMet) process.exitCode = 1;
