/** Resumable suspect-seed and 180-map pre-chest campaigns. */
import fs from "node:fs";
import path from "node:path";
import {
  OUT,
  REPORT,
  MODES,
  ROUTES,
  campaignIdentity,
  assertEquivalenceGate,
  writeJsonAtomic,
  analyzeCase,
} from "./dynamic-solvability-campaign-lib.mjs";

function argumentValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? Number(process.argv[index + 1]) : fallback;
}

const RESUME = process.argv.includes("--resume");
const MAX_CASES = argumentValue("--max-cases", Number.POSITIVE_INFINITY);
const requested = process.argv.includes("--all")
  ? ["suspects", "sample"]
  : process.argv.includes("--sample")
    ? ["sample"]
    : ["suspects"];
const equivalenceGate = assertEquivalenceGate();

function limitsFor(campaign) {
  const defaultStates = campaign === "suspects" ? 1_000_000 : 300_000;
  return {
    maxStates: argumentValue("--max-states", defaultStates),
    maxTransitions: argumentValue("--max-transitions", 12_000_000),
    maxFrontier: argumentValue("--max-frontier", 400_000),
    maxMemoryBytes: argumentValue("--max-memory-bytes", 512 * 1024 * 1024),
    maxElapsedMs: argumentValue("--max-elapsed-ms", 60_000),
  };
}

function suspectCases() {
  const source = JSON.parse(fs.readFileSync(
    path.resolve("docs/archive/route-traps-strategy-01/trap-runtime-gameplay.json"),
    "utf8",
  )).potentialLocks;
  const priority = { hard: 0, medium: 1, easy: 2 };
  return source
    .map((archived) => ({
      seed: archived.seed,
      route: archived.route,
      mode: archived.mode,
      archived,
      includeTrapVariant: true,
    }))
    .sort((left, right) =>
      priority[left.mode] - priority[right.mode] || left.route - right.route || left.seed - right.seed);
}

function sampleCases() {
  const cases = [];
  for (const route of ROUTES) {
    for (let modeIndex = 0; modeIndex < MODES.length; modeIndex += 1) {
      const mode = MODES[modeIndex];
      for (let sampleIndex = 0; sampleIndex < 20; sampleIndex += 1) {
        cases.push({
          seed: 8_500_000 + route * 1000 + modeIndex * 100 + sampleIndex,
          route,
          mode,
          sampleIndex,
          includeTrapVariant: false,
        });
      }
    }
  }
  return cases;
}

function caseFileName(item) {
  return `${item.mode}-r${item.route}-seed-${item.seed}.json`;
}

function verdictCounts(results) {
  const counts = {};
  for (const result of results) counts[result.classification] = (counts[result.classification] ?? 0) + 1;
  return counts;
}

function auxiliaryCounts(results) {
  const counts = {};
  for (const result of results) {
    for (const classification of result.auxiliaryClassifications) {
      counts[classification] = (counts[classification] ?? 0) + 1;
    }
  }
  return counts;
}

function summarizeCombinations(results) {
  const combinations = [];
  for (const route of ROUTES) {
    for (const mode of MODES) {
      const cases = results.filter((result) => result.route === route && result.mode === mode);
      combinations.push({
        route,
        mode,
        cases: cases.length,
        verdictCounts: verdictCounts(cases),
        completed: cases.filter((result) => !result.truncated).length,
        inconclusive: cases.filter((result) => result.truncated).length,
        states: cases.reduce((sum, result) => sum + result.states, 0),
        transitions: cases.reduce((sum, result) => sum + result.transitions, 0),
        elapsedMs: cases.reduce((sum, result) => sum + result.elapsedMs, 0),
      });
    }
  }
  return combinations;
}

function humanReviewCandidates(results) {
  return results
    .filter((result) =>
      result.classification !== "GUARANTEED_SOLVABLE_PRE_CHEST" ||
      result.reachableNonWinning > 0 ||
      result.witnessMetrics?.backtrackingOrRevisits ||
      result.witnessMetrics?.trapActivations)
    .map((result) => ({
      seed: result.seed,
      route: result.route,
      mode: result.mode,
      classification: result.classification,
      shortestWin: result.shortestExistentialWin,
      guaranteedFirstAction: result.guaranteedPolicy?.initialAction ?? null,
      reachableNonWinning: result.reachableNonWinning,
      witnessMetrics: result.witnessMetrics,
      auxiliaryClassifications: result.auxiliaryClassifications,
    }))
    .sort((left, right) =>
      Number(left.classification === "GUARANTEED_SOLVABLE_PRE_CHEST") -
        Number(right.classification === "GUARANTEED_SOLVABLE_PRE_CHEST") ||
      right.reachableNonWinning - left.reachableNonWinning);
}

function finalEvidence(campaign, identity, config, results) {
  const common = {
    ...REPORT,
    generatedAt: new Date().toISOString(),
    campaign: identity,
    config,
    equivalenceGate,
    casesExpected: campaign === "suspects" ? 12 : 180,
    casesCompleted: results.length,
    completeCampaign: results.length === (campaign === "suspects" ? 12 : 180),
    verdictCounts: verdictCounts(results),
    auxiliaryClassificationCounts: auxiliaryCounts(results),
  };
  if (campaign === "suspects") {
    writeJsonAtomic(path.join(OUT, "suspect-seeds-analysis.json"), {
      ...common,
      source: "docs/archive/route-traps-strategy-01/trap-runtime-gameplay.json potentialLocks",
      cases: results,
    });
    writeJsonAtomic(path.join(OUT, "oscillation-scc-analysis.json"), {
      ...common,
      cases: results.map((result) => ({
        seed: result.seed,
        route: result.route,
        mode: result.mode,
        initialClassification: result.classification,
        suspicious: result.suspicious,
        scc: result.scc,
        auxiliaryClassifications: result.auxiliaryClassifications,
      })),
    });
    writeJsonAtomic(path.join(OUT, "trap-necessity-analysis.json"), {
      ...common,
      classificationCounts: results.reduce((counts, result) => {
        const classification = result.trapAnalysis?.classification ?? "NOT_RUN";
        counts[classification] = (counts[classification] ?? 0) + 1;
        return counts;
      }, {}),
      cases: results.map((result) => ({
        seed: result.seed,
        route: result.route,
        mode: result.mode,
        trapAnalysis: result.trapAnalysis,
      })),
    });
    writeJsonAtomic(path.join(OUT, "dead-region-analysis.json"), {
      ...common,
      cases: results.map((result) => ({
        seed: result.seed,
        route: result.route,
        mode: result.mode,
        reachableNonWinning: result.reachableNonWinning,
        scc: result.scc,
        suspiciousDeadRegion: result.suspicious?.deadRegion ?? null,
      })),
    });
  } else {
    writeJsonAtomic(path.join(OUT, "dynamic-solvability-sample.json"), {
      ...common,
      sampleContract: {
        mapsPerCombination: 20,
        combinations: 9,
        total: 180,
        seedFormula: "8500000 + route*1000 + modeIndex*100 + sampleIndex",
        reusedFrom: "ROTA-SENTINEL automated gameplay 180-map seed matrix",
      },
      combinations: summarizeCombinations(results),
      cases: results,
    });
  }
  writeJsonAtomic(path.join(OUT, "human-review-candidates.json"), {
    ...common,
    thresholdsFinalized: false,
    candidates: humanReviewCandidates(results),
  });
}

async function runCampaign(campaign) {
  const limits = limitsFor(campaign);
  const cases = campaign === "suspects" ? suspectCases() : sampleCases();
  const config = {
    campaign,
    limits,
    ordering: campaign === "suspects" ? "hard, medium, easy" : "route, mode, sampleIndex",
    cases: cases.map(({ seed, route, mode }) => ({ seed, route, mode })),
  };
  const identity = campaignIdentity(campaign, config);
  const work = path.join(OUT, "work", identity.id);
  const caseDirectory = path.join(work, "cases");
  fs.mkdirSync(caseDirectory, { recursive: true });
  const manifestPath = path.join(work, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    writeJsonAtomic(manifestPath, {
      ...REPORT,
      identity,
      config,
      equivalenceGate,
      createdAt: new Date().toISOString(),
    });
  }

  console.log(`${campaign.toUpperCase()} ${identity.id}`);
  const results = [];
  let executed = 0;
  for (const item of cases) {
    const target = path.join(caseDirectory, caseFileName(item));
    if (fs.existsSync(target)) {
      if (!RESUME) throw new Error(`Case already exists; rerun with --resume: ${target}`);
      const cached = JSON.parse(fs.readFileSync(target, "utf8"));
      if (cached.campaignId !== identity.id) throw new Error(`Cache identity mismatch: ${target}`);
      results.push(cached.result);
      console.log(`  RESUME seed ${item.seed} r${item.route}/${item.mode}: ${cached.result.classification}`);
      continue;
    }
    if (executed >= MAX_CASES) break;
    const result = analyzeCase({ ...item, limits });
    writeJsonAtomic(target, {
      ...REPORT,
      campaignId: identity.id,
      solverRuntimeContractHash: identity.solverRuntimeContractHash,
      configHash: identity.configHash,
      completedAt: new Date().toISOString(),
      result,
    });
    results.push(result);
    executed += 1;
    console.log(
      `  RUN seed ${item.seed} r${item.route}/${item.mode}: ${result.classification} | ` +
      `${result.states} states | ${result.transitions} transitions | ${result.elapsedMs.toFixed(1)}ms`,
    );
  }

  const complete = results.length === cases.length;
  console.log(`  ${results.length}/${cases.length} cases available | ${JSON.stringify(verdictCounts(results))}`);
  if (complete) finalEvidence(campaign, identity, config, results);
  else console.log("  Partial run persisted in work/; final evidence not replaced.");
  return { campaign, identity, complete, results: results.length };
}

const summaries = [];
for (const campaign of requested) summaries.push(await runCampaign(campaign));
console.log(JSON.stringify(summaries, null, 2));
