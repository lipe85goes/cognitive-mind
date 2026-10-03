/**
 * ROTA-DUAL-GUARDIANS-MAPS-01A-FINAL-ACCEPTANCE
 *
 *  Fase 1  structural final — 3 routes x 3 modes x 120 maps, seeded per map,
 *          every certified map re-checked against the published contracts.
 *  Fase 2  continuous final — 9 combinations x 30 maps on master-seeded streams
 *          with no reseed between maps, the regime the runtime actually uses.
 *  Fase 5  deterministic recovery — proof that when the random phase is
 *          exhausted the recovery sweep enters, runs the SAME gates and returns
 *          a certified map, with no bypass and no uncertified fallback.
 *  Fase 6  observational timing on the node harness (see the report for why the
 *          browser number is not re-measured).
 *
 * Nothing here modifies production. The recovery proof shortens the random
 * phase in an in-memory copy only; the shipped cap is untouched.
 *
 * Usage: node tools/validation/final-acceptance.mjs [--check|--update]
 */
import { loadInstrumented, routeModuleDeclaring, routeSource } from "./instrumented-generator.mjs";
import { openEvidence } from "./evidence.mjs";

/**
 * MINDFLOW-VALIDATION-HYGIENE-04 — where this gate's baseline lives.
 *
 * The parent directory is the ROTA-DUAL-GUARDIANS-MAPS-01A record as written at
 * that mission's close. Its per-map fingerprints (templatesUsed, exitsUsed,
 * attempts, randomAttempts) are deterministic outputs of the generator AS IT WAS
 * THEN, and generation has legitimately moved since — the RNG seam in 04C and
 * the difficulty rebalance in 05 both changed which template a given seed picks.
 * The mission verdicts still hold (1080/1080, 270/270, zero throws, zero audit
 * failures); only the distributions moved.
 *
 * Rewriting that archive to today's numbers would falsify a closed mission's
 * record, so the live baseline this gate checks against lives beside it instead.
 * `docs/archive/route-dual-guardians-maps-01a/README-current.md` records the
 * supersession and the measured drift.
 */
const EVIDENCE = openEvidence(
  process.env.ROUTE_VALIDATION_OUT ??
    "docs/archive/route-dual-guardians-maps-01a/current",
);
const ROUTES = [1, 2, 3];
const MODES = ["easy", "medium", "hard"];

const LAB = loadInstrumented();
const API = LAB.API;
const md = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
const kOf = (p) => API.posKey(p);
const inBounds = (p) => p.row >= 0 && p.col >= 0 && p.row < API.ROWS && p.col < API.COLS;

/**
 * Re-check a certified map against the published contracts, independently of
 * the gates that produced it. A map that passes generation but fails here is a
 * contradiction worth surfacing.
 */
function auditMap(map, difficulty, stage) {
  const P = API.ROUTE_STAGE_QUALITY[stage];
  const problems = [];
  const walls = map.walls;
  const stars = map.collectibleStars;
  const distances = API.getReachableDistances(map.playerStart, walls);
  const blocks = API.decomposeBoardBlocks(walls);

  const all = [map.playerStart, map.guardianStart, map.exitPosition, ...stars, ...map.traps];
  if (map.chest) all.push(map.chest);
  for (const p of all) {
    if (!inBounds(p)) problems.push(`invalid coords ${kOf(p)}`);
    if (walls.has(kOf(p))) problems.push(`entity on wall ${kOf(p)}`);
  }

  // portal contracts
  if (!distances.has(kOf(map.exitPosition))) problems.push("portal unreachable");
  if (!API.sharesBlock(blocks, map.playerStart, map.exitPosition)) problems.push("portal without alternative route");
  if (API.getNeighbors(map.guardianStart, walls).length < 2) problems.push("guardian sealed");
  if (md(map.playerStart, map.guardianStart) < P.guardianMinStartDistance) problems.push("guardian too close");

  // star contracts
  if (stars.length !== API.getStarCount(difficulty, stage)) problems.push(`star count ${stars.length}`);
  if (new Set(stars.map(kOf)).size !== stars.length) problems.push("duplicate star");
  for (const s of stars) {
    if ((distances.get(kOf(s)) ?? -1) < P.starMinStartDistance) problems.push(`star near start ${kOf(s)}`);
    if (!API.sharesBlock(blocks, map.playerStart, s)) problems.push(`star without alternative route ${kOf(s)}`);
    if (API.findPathLength(s, map.exitPosition, walls) === null) problems.push(`star cannot reach portal ${kOf(s)}`);
  }
  for (let i = 0; i < stars.length; i += 1) {
    for (let j = i + 1; j < stars.length; j += 1) {
      if (md(stars[i], stars[j]) < P.starMinSeparation) problems.push(`star separation ${kOf(stars[i])}~${kOf(stars[j])}`);
    }
  }

  // trap safety
  if (map.traps.length !== API.getTrapCount(difficulty, stage)) problems.push(`trap count ${map.traps.length}`);
  for (const t of map.traps) {
    if ((distances.get(kOf(t)) ?? -1) < P.trapMinStartDistance) problems.push(`trap near start ${kOf(t)}`);
    if (stars.some((s) => md(s, t) < 2)) problems.push(`trap on a light ${kOf(t)}`);
  }
  if (map.chest && (distances.get(kOf(map.chest)) ?? -1) < P.chestMinStartDistance) {
    problems.push("chest too close to start");
  }

  // Escape width, judged on the route production actually resolves. Using the
  // raw cheapest route here would re-create the pre-fix selection and flag maps
  // that are correct: the whole point of resolveObjectiveRoute is that when the
  // cheapest route is inadmissible, an admissible one of the same minimal cost
  // is chosen instead.
  const objective = API.resolveObjectiveRoute(map.playerStart, stars, map.exitPosition, walls, blocks);
  if (!objective) problems.push("no objective route");
  else if (!API.routeCellsHaveEscape(map.playerStart, map.exitPosition, objective.cells, walls, blocks)) {
    problems.push("objective route fails escape width");
  }
  if (!API.escapeGeometryIsPossible(map.playerStart, map.exitPosition, walls, blocks)) {
    problems.push("escape geometry impossible on a certified map");
  }
  return problems;
}

const report = { mission: "ROTA-DUAL-GUARDIANS-MAPS-01A-FINAL-ACCEPTANCE" };

// ===========================================================================
// FASE 1 — structural final, 1080 maps, seeded per map
// ===========================================================================
console.log("FASE 1 — estrutural final (3 rotas x 3 modos x 120 = 1080, seeded por mapa)");
const structural = { combinations: [], totals: { generated: 0, certified: 0, threw: 0, auditFailures: 0 } };
const auditSamples = [];
for (const stage of ROUTES) {
  for (const difficulty of MODES) {
    const templateUse = {};
    const exitUse = {};
    let certified = 0;
    let threw = 0;
    let audits = 0;
    const attemptsSeen = [];
    for (let i = 0; i < 120; i += 1) {
      const seed = stage * 10_000_000 + MODES.indexOf(difficulty) * 1_000_000 + i + 1;
      LAB.setSeed(seed);
      const run = LAB.replayGeneration({ difficulty, stage, capture: false });
      structural.totals.generated += 1;
      if (run.threw || !run.map) { threw += 1; continue; }
      certified += 1;
      attemptsSeen.push(run.totalAttempts);
      const winner = run.attempts[run.attempts.length - 1];
      templateUse[winner.templateIndex] = (templateUse[winner.templateIndex] ?? 0) + 1;
      exitUse[winner.exit] = (exitUse[winner.exit] ?? 0) + 1;
      const problems = auditMap(run.map, difficulty, stage);
      if (problems.length) {
        audits += 1;
        if (auditSamples.length < 10) auditSamples.push({ stage, difficulty, seed, problems });
      }
    }
    structural.totals.certified += certified;
    structural.totals.threw += threw;
    structural.totals.auditFailures += audits;
    const sorted = [...attemptsSeen].sort((a, b) => a - b);
    const q = (p) => sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
    structural.combinations.push({
      route: stage, mode: difficulty, maps: 120, certified, threw,
      uncertified: 0, auditFailures: audits,
      templatesUsed: templateUse, exitsUsed: exitUse,
      attempts: { p50: q(50), p90: q(90), max: sorted[sorted.length - 1] },
    });
    console.log(`  rota${stage}/${difficulty}: ${certified}/120 certificados · throws ${threw} · auditoria ${audits} falhas · templates ${JSON.stringify(templateUse)}`);
  }
}
console.log(`  TOTAL: ${structural.totals.certified}/1080 · throws ${structural.totals.threw} · falhas de auditoria ${structural.totals.auditFailures}`);
if (auditSamples.length) console.log(`  amostra: ${JSON.stringify(auditSamples.slice(0, 3))}`);
EVIDENCE.write("structural-1080-final.json", {
  ...report, regime: "seeded per map (deterministic regression)",
  ...structural, auditSamples,
  auditedContracts: [
    "coordinates in bounds", "no entity on a wall", "portal reachable",
    "portal has an alternative route", "guardian not sealed", "guardian start distance",
    "light count", "no duplicate light", "light start distance",
    "light has an alternative route", "light reaches the portal", "light separation",
    "trap count", "trap start distance", "trap not on a light", "chest distance",
    "objective route exists", "objective route satisfies escape width",
  ],
});

// ===========================================================================
// FASE 2 — continuous final, master-seeded streams
// ===========================================================================
console.log("\nFASE 2 — contínuo final (9 combinações x 30 = 270, sem reseed entre mapas)");
const MASTER_SEED = 20260808;
const continuous = { masterSeed: MASTER_SEED, streams: [], totals: { generated: 0, certified: 0, threw: 0, recoveryActivations: 0 } };
for (const stage of ROUTES) {
  for (const difficulty of MODES) {
    LAB.setSeed(MASTER_SEED);
    const entries = [];
    let certified = 0;
    let threw = 0;
    let recovery = 0;
    for (let index = 0; index < 30; index += 1) {
      const run = LAB.replayGeneration({ difficulty, stage, capture: false });
      const usedRecovery = run.recoveryAttempts > 0;
      if (usedRecovery) recovery += 1;
      if (run.threw || !run.map) threw += 1;
      else certified += 1;
      entries.push({
        index, attempts: run.totalAttempts, randomAttempts: run.randomAttempts,
        recoveryAttempts: run.recoveryAttempts, recoveryActivated: usedRecovery,
        threw: run.threw, certified: !run.threw,
      });
    }
    continuous.totals.generated += 30;
    continuous.totals.certified += certified;
    continuous.totals.threw += threw;
    continuous.totals.recoveryActivations += recovery;
    continuous.streams.push({ route: stage, mode: difficulty, masterSeed: MASTER_SEED, maps: 30, certified, threw, recoveryActivations: recovery, entries });
    console.log(`  rota${stage}/${difficulty}: ${certified}/30 · throws ${threw} · recovery ${recovery}x`);
  }
}
console.log(`  TOTAL: ${continuous.totals.certified}/270 · throws ${continuous.totals.threw} · recovery ${continuous.totals.recoveryActivations}x`);
EVIDENCE.write("continuous-270-final.json", {
  ...report, regime: "one PRNG per stream, no reseed between maps", ...continuous,
});

// ===========================================================================
// FASE 5 — deterministic recovery
// ===========================================================================
console.log("\nFASE 5 — recovery determinística");
// Shorten ONLY the random phase, in memory. The recovery sweep, every gate and
// the throw are untouched, so whatever comes back came through the real gates.
const SHORT_RANDOM = "const MAX_GENERATION_ATTEMPTS = 1;";
// The anchor must come from the harness's own view of production, not from a
// second read of the file: the two can differ in line endings, and a `replace`
// that matches nothing would leave the production cap in place while this phase
// reported on it as though it had been shortened. ROUTE-C0: the edit goes to
// whichever Rota module declares the cap, so moving it does not move this proof.
const capFile = routeModuleDeclaring("MAX_GENERATION_ATTEMPTS");
const capLine = routeSource(capFile)
  .split("\n").find((l) => l.startsWith("const MAX_GENERATION_ATTEMPTS"));
if (!capLine) throw new Error("MAX_GENERATION_ATTEMPTS declaration not found");
const RECOVERY = loadInstrumented({
  transforms: {
    [capFile]: (src) => {
      const shortened = src.replace(capLine, SHORT_RANDOM);
      if (shortened === src) {
        throw new Error("recovery transform: MAX_GENERATION_ATTEMPTS cap was not replaced");
      }
      return shortened;
    },
  },
});
const recoveryCases = [];
for (const stage of ROUTES) {
  for (const difficulty of MODES) {
    // A single random attempt sometimes succeeds outright, which proves nothing
    // about recovery. Walk seeds until the random phase actually fails, so every
    // combination exercises the sweep.
    let run = null;
    let usedSeed = null;
    for (let probe = 0; probe < 40; probe += 1) {
      const seed = 31_000 + stage * 100 + MODES.indexOf(difficulty) * 10 + probe;
      RECOVERY.setSeed(seed);
      const candidate = RECOVERY.replayGeneration({ difficulty, stage, capture: false });
      usedSeed = seed;
      run = candidate;
      if (candidate.recoveryAttempts > 0) break;
    }
    const certified = Boolean(run.map) && !run.threw;
    const problems = certified ? auditMap(run.map, difficulty, stage) : ["threw"];
    recoveryCases.push({
      seed: usedSeed,
      route: stage, mode: difficulty,
      productionRandomCap: capLine.trim(),
      harnessRandomCap: SHORT_RANDOM,
      randomAttempts: run.randomAttempts,
      recoveryAttempts: run.recoveryAttempts,
      recoveryEntered: run.recoveryAttempts > 0,
      certified, auditProblems: problems,
      certifiedByRecovery: certified && run.recoveryAttempts > 0,
    });
  }
}
const recoveryEntered = recoveryCases.filter((c) => c.recoveryEntered).length;
const recoveryCertified = recoveryCases.filter((c) => c.certifiedByRecovery).length;
const recoveryClean = recoveryCases.every((c) => c.certified && c.auditProblems.length === 0);
console.log(`  recovery acionada em ${recoveryEntered}/9 combinações · mapa certificado pela recovery em ${recoveryCertified}/9`);
console.log(`  todos passam a mesma auditoria de contratos: ${recoveryClean ? "sim" : "NÃO"}`);
for (const c of recoveryCases) {
  console.log(`    rota${c.route}/${c.mode}: random ${c.randomAttempts} · recovery ${c.recoveryAttempts} · ${c.certified ? "certificado" : "LANÇOU"}`);
}
EVIDENCE.write("deterministic-recovery-final.json", {
  ...report,
  method: "random phase capped at 1 attempt in an in-memory copy; recovery sweep, gates and throw untouched; production cap unchanged",
  productionCap: capLine.trim(),
  recoveryEntered: `${recoveryEntered}/9`,
  certifiedByRecovery: `${recoveryCertified}/9`,
  allPassContractAudit: recoveryClean,
  noUncertifiedFallbackPath: true,
  cases: recoveryCases,
});

// ===========================================================================
// FASE 6 — observational timing, final state
// ===========================================================================
console.log("\nFASE 6 — tempo observacional final (route3-hard, 120 gerações, sem instrumentação)");
const BARE = loadInstrumented({ bare: true });
BARE.setSeed(777001);
const samples = [];
let timingThrows = 0;
for (let i = 0; i < 120; i += 1) {
  const t0 = performance.now();
  try { BARE.API.generateMaze("hard", 3); } catch { timingThrows += 1; }
  samples.push(performance.now() - t0);
}
samples.sort((a, b) => a - b);
const q = (p) => +samples[Math.min(samples.length - 1, Math.floor((p / 100) * samples.length))].toFixed(1);
const over = (ms) => samples.filter((t) => t > ms).length;
const timing = {
  p50: q(50), p75: q(75), p90: q(90), p95: q(95), p99: q(99),
  max: +samples[samples.length - 1].toFixed(1),
  over500ms: over(500), over1s: over(1000), over1_5s: over(1500),
  over2s: over(2000), over3s: over(3000), threw: timingThrows,
};
console.log(`  p50=${timing.p50} p75=${timing.p75} p90=${timing.p90} p95=${timing.p95} p99=${timing.p99} max=${timing.max}`);
console.log(`  >500ms ${timing.over500ms} · >1s ${timing.over1s} · >1,5s ${timing.over1_5s} · >2s ${timing.over2s} · >3s ${timing.over3s}`);
// FASE 6 is a measurement, not a gate: `route3HardFinal` is wall-clock timing on
// this machine and differs on every run by construction. Declaring it RUN
// METADATA keeps a normal --check from failing on noise, and keeps --update from
// rewriting the archived numbers when nothing was actually decided differently.
EVIDENCE.write("generation-performance-final.json", {
  ...report,
  browserMeasurement: "BROWSER_PERFORMANCE_NOT_REMEASURED",
  browserMeasurementReason:
    "Playwright is not installed in this environment, and the in-app browser pane does not composite: " +
    "document.hidden is true and requestAnimationFrame delivered 0 frames in 600 ms, so the world-readiness " +
    "gate never releases and the board is never reached. No browser figure is invented.",
  harness: "node vm sandbox, diagnostics off",
  route3HardFinal: timing,
  comparableNodeBaselineBefore: { p50: 797.1, p90: 2281.9, max: 4630.9 },
  comparableNodeBaselineAfter: { p50: 132.8, p90: 369.1, max: 919.3 },
  publishedBrowserBaseline: {
    p50: 365, p90: 1834, p95: 2051, max: 3178,
    caveat: "measured in a browser production build in an earlier session; not comparable to node figures",
  },
}, { metadata: ["route3HardFinal"] });

// ===========================================================================
console.log("\nresumo:");
const structuralOk = structural.totals.certified === 1080 && structural.totals.threw === 0 && structural.totals.auditFailures === 0;
const continuousOk = continuous.totals.certified === 270 && continuous.totals.threw === 0;
console.log(`  estrutural 1080: ${structuralOk ? "OK" : "FALHOU"} (${structural.totals.certified}/1080, throws ${structural.totals.threw}, auditoria ${structural.totals.auditFailures})`);
console.log(`  contínuo 270:    ${continuousOk ? "OK" : "FALHOU"} (${continuous.totals.certified}/270, throws ${continuous.totals.threw})`);
const recoveryOk = recoveryClean && recoveryCertified > 0;
console.log(`  recovery:        ${recoveryOk ? "OK" : "FALHOU"}`);
EVIDENCE.write("known-star-dependent-waste.json", {
  ...report,
  label: "KNOWN_STAR_DEPENDENT_GENERATION_WASTE",
  count: 25,
  source: "route-cells-have-escape-255-analysis.json, dimension=star_selection",
  description:
    "On these wall layouts a valid configuration exists, but only with a DIFFERENT set of lights. " +
    "Route selection alone cannot reach it.",
  whyNotBlocking: [
    "the current candidate is correctly REJECTED — no invalid map is accepted",
    "no known generation throw is attributed to them",
    "continuous route 3 passed 360/360 and 270/270 with them present",
    "repairing them means reopening star selection, which is not required for correctness",
  ],
  futureOpportunity:
    "Either include admissibility in chooseStars eligibility, or extend the early check to also " +
    "require the chosen lights to sit in the admissible component — the second discards them earlier " +
    "without rescuing them.",
  status: "NON_BLOCKING_EFFICIENCY_OPPORTUNITY",
});

// Every phase now reaches the exit code. Before this mission FASE 5 could report
// FALHOU while the process still exited 0, so a broken recovery proof looked
// like a passing run to anything that only read the status.
process.exitCode = EVIDENCE.finish({ ok: structuralOk && continuousOk && recoveryOk });
