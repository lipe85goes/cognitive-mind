/**
 * ROTA-CHEST-REWARDS-01 — FASE 1: can the nine templates carry breakable walls?
 *
 * ## Read this before reading the numbers
 *
 * When this campaign first ran, its answer was a GATE: the Pickaxe was not
 * implemented until it passed, and afterwards the certified set decided which
 * walls the player was allowed to open.
 *
 * After the manual playtest the product changed. The Pickaxe now opens ANY
 * internal maze wall the Explorer is standing next to, and choosing which is the
 * whole difficulty. So this campaign no longer restricts anything at runtime:
 *
 *   BREAKABLE_WALL_FEASIBILITY_GATE     = SUPERSEDED_AS_RUNTIME_RESTRICTION
 *   BREAKABLE_WALL_FEASIBILITY_EVIDENCE = PRESERVED
 *
 * It is kept, and kept runnable, because the question it answered is still the
 * one that justified building the mechanic: does opening a wall change these
 * boards at all, or would the Pickaxe have been decoration? The answer was yes,
 * over 324 maps, and that remains true.
 *
 * The rule itself moved out of production into
 * `breakable-wall-certifier.mjs` when it stopped being a runtime authority. To
 * prove that move changed nothing, this file compares its own results against
 * the figures the original campaign published and reports the comparison.
 *
 * Templates are pinned with `forcedTemplateIndex`, exactly the way
 * `validate-route-9x9.mjs` pins them.
 *
 * Usage:
 *   node tools/validation/breakable-wall-feasibility.mjs [--seeds N]
 */
import fs from "node:fs";
import path from "node:path";
import { loadInstrumented } from "./instrumented-generator.mjs";
import {
  auditBreakableWalls,
  chooseBreakableWalls,
  BREAKABLE_WALL_COUNT,
  BREAKABLE_WALL_MAX,
  BREAKABLE_MIN_DEGREE,
  BREAKABLE_MIN_SEPARATION,
} from "./breakable-wall-certifier.mjs";

/**
 * What the campaign published on 2026-08-13, while the certifier still lived in
 * production and still decided runtime permission. Re-running must reproduce
 * these exactly, or the move was not faithful.
 */
const ORIGINAL_CAMPAIGN = {
  seedsPerSlot: 12,
  mapsMeasured: 324,
  mapsWithZeroCertifiedWalls: 0,
  certifiedPerMap: { min: 2, max: 21, mean: 11.448 },
  determinismViolations: 0,
  rejectionReasons: {
    NO_TOPOLOGICAL_EFFECT: 2059,
    WOULD_ADD_DEAD_END: 755,
    WOULD_ADD_ISLAND: 57,
  },
};

const OUT = path.resolve("docs/archive/route-chest-rewards-01");
fs.mkdirSync(OUT, { recursive: true });

const argSeeds = Number(
  (process.argv.find((a) => a.startsWith("--seeds=")) ?? "").split("=")[1] ??
    (process.argv.includes("--seeds")
      ? process.argv[process.argv.indexOf("--seeds") + 1]
      : ""),
);
const SEEDS_PER_SLOT = Number.isFinite(argSeeds) && argSeeds > 0 ? argSeeds : 12;
const BASE_SEED = 4_400_000;
const DIFFICULTIES = ["easy", "medium", "hard"];
const STAGES = [1, 2, 3];
const TEMPLATES_PER_STAGE = 3;

const LAB = loadInstrumented({ bare: true });
const API = LAB.API;
const kOf = (p) => API.posKey(p);

function stats(values) {
  if (!values.length) return { n: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    n: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    mean: Number((sum / sorted.length).toFixed(3)),
    p50: sorted[Math.floor(sorted.length * 0.5)],
  };
}

console.log(
  `FASE 1 — breakable wall feasibility · ${STAGES.length * TEMPLATES_PER_STAGE} templates ` +
    `x ${DIFFICULTIES.length} modes x ${SEEDS_PER_SLOT} seeds`,
);

const slots = [];
const rejectionTally = {};
const allCertifiedCounts = [];
let mapsMeasured = 0;
let mapsWithZero = 0;
let generationFailures = 0;
const started = Date.now();

for (const stage of STAGES) {
  for (let templateIndex = 0; templateIndex < TEMPLATES_PER_STAGE; templateIndex += 1) {
    for (const difficulty of DIFFICULTIES) {
      const certifiedCounts = [];
      const scores = [];
      const degrees = [];
      const examples = [];
      const effectHits = {
        objectiveMovesSaved: 0,
        portalAccessesGained: 0,
        escapeCellsGained: 0,
        alternativeRouteCellsGained: 0,
      };
      let hunterAlsoGains = 0;
      let sentinelZoneChanges = 0;

      for (let s = 0; s < SEEDS_PER_SLOT; s += 1) {
        const seed = BASE_SEED + stage * 10_000 + templateIndex * 1_000 + s;
        LAB.setSeed(seed);
        const replay = LAB.replayGeneration({
          difficulty,
          stage,
          forcedTemplateIndex: templateIndex,
          capture: false,
        });
        if (!replay.map) {
          generationFailures += 1;
          continue;
        }
        const map = replay.map;
        const audited = auditBreakableWalls(
          API,
          map.walls,
          map.playerStart,
          map.guardianStart,
          map.exitPosition,
          map.collectibleStars,
          map.traps,
          map.chest,
        );
        const certified = audited.filter((c) => c.certified);
        mapsMeasured += 1;
        certifiedCounts.push(certified.length);
        allCertifiedCounts.push(certified.length);
        if (certified.length === 0) mapsWithZero += 1;

        for (const candidate of audited) {
          if (candidate.certified) continue;
          rejectionTally[candidate.rejection] =
            (rejectionTally[candidate.rejection] ?? 0) + 1;
        }
        for (const candidate of certified) {
          scores.push(candidate.score);
          degrees.push(candidate.effect.degree);
          for (const field of Object.keys(effectHits)) {
            if (candidate.effect[field] >= 1) effectHits[field] += 1;
          }
          if (candidate.effect.hunterMovesSaved >= 1) hunterAlsoGains += 1;
          if (candidate.effect.portalZoneCellsGained !== 0) sentinelZoneChanges += 1;
        }

        // What the generator would actually mark, on this same map.
        const marked = chooseBreakableWalls(
          API,
          map.walls,
          map.playerStart,
          map.guardianStart,
          map.exitPosition,
          map.collectibleStars,
          map.traps,
          map.chest,
          stage,
        );
        // Determinism: the same map must always yield the same marks, and the
        // marks must be a subset of the certified set.
        const again = chooseBreakableWalls(
          API,
          map.walls,
          map.playerStart,
          map.guardianStart,
          map.exitPosition,
          map.collectibleStars,
          map.traps,
          map.chest,
          stage,
        );
        const stable =
          marked.map(kOf).join("|") === again.map(kOf).join("|") &&
          marked.every((m) => certified.some((c) => kOf(c.position) === kOf(m)));

        if (examples.length < 2 && certified.length) {
          const best = certified.reduce((a, b) => (b.score > a.score ? b : a));
          examples.push({
            seed,
            walls: map.walls.size,
            certified: certified.length,
            marked: marked.map(kOf),
            markedStable: stable,
            best: { cell: kOf(best.position), score: best.score, effect: best.effect },
          });
        }
        if (!stable) {
          examples.push({ seed, DETERMINISM_VIOLATION: true, marked: marked.map(kOf) });
        }
      }

      const minCertified = certifiedCounts.length ? Math.min(...certifiedCounts) : 0;
      const slot = {
        stage,
        templateIndex,
        difficulty,
        mapsMeasured: certifiedCounts.length,
        certifiedPerMap: stats(certifiedCounts),
        minCertifiedOnAnyMap: minCertified,
        passesMinimumOne: certifiedCounts.length > 0 && minCertified >= 1,
        reachesTargetTwo:
          certifiedCounts.length > 0 && Math.min(...certifiedCounts) >= 2,
        candidateScore: stats(scores),
        candidateDegree: stats(degrees),
        certifyingEffects: effectHits,
        certifiedThatAlsoShortenTheHunter: hunterAlsoGains,
        certifiedThatResizeTheSentinelZone: sentinelZoneChanges,
        examples,
      };
      slots.push(slot);
      console.log(
        `  stage ${stage} · template ${templateIndex} · ${difficulty.padEnd(6)} ` +
          `· maps ${String(slot.mapsMeasured).padStart(2)} ` +
          `· certified/map min ${minCertified} mean ${slot.certifiedPerMap.mean ?? "-"} ` +
          `· ${slot.passesMinimumOne ? "OK" : "FAIL"}`,
      );
    }
  }
}

const perTemplate = [];
for (const stage of STAGES) {
  for (let templateIndex = 0; templateIndex < TEMPLATES_PER_STAGE; templateIndex += 1) {
    const mine = slots.filter(
      (s) => s.stage === stage && s.templateIndex === templateIndex,
    );
    const worst = Math.min(...mine.map((s) => s.minCertifiedOnAnyMap));
    perTemplate.push({
      stage,
      templateIndex,
      templateId: `stage${stage}-template${templateIndex}`,
      mapsMeasured: mine.reduce((a, s) => a + s.mapsMeasured, 0),
      worstCaseCertifiedOnAnyMap: worst,
      passesMinimumOne: mine.every((s) => s.passesMinimumOne),
      reachesTargetTwoAlways: mine.every((s) => s.reachesTargetTwo),
    });
  }
}

const failing = perTemplate.filter((t) => !t.passesMinimumOne);
const allPass = failing.length === 0 && mapsWithZero === 0 && generationFailures === 0;
const determinismViolations = slots.reduce(
  (acc, s) => acc + s.examples.filter((e) => e.DETERMINISM_VIOLATION).length,
  0,
);

/**
 * Fidelity of the move out of production. Only meaningful at the campaign's
 * original size, so a smaller --seeds run reports "not comparable" instead of a
 * false mismatch.
 */
const comparable = SEEDS_PER_SLOT === ORIGINAL_CAMPAIGN.seedsPerSlot;
const measured = stats(allCertifiedCounts);
const reproduction = comparable
  ? {
      comparable: true,
      mapsMeasured:
        mapsMeasured === ORIGINAL_CAMPAIGN.mapsMeasured,
      mapsWithZeroCertifiedWalls:
        mapsWithZero === ORIGINAL_CAMPAIGN.mapsWithZeroCertifiedWalls,
      certifiedPerMapMin: measured.min === ORIGINAL_CAMPAIGN.certifiedPerMap.min,
      certifiedPerMapMax: measured.max === ORIGINAL_CAMPAIGN.certifiedPerMap.max,
      certifiedPerMapMean: measured.mean === ORIGINAL_CAMPAIGN.certifiedPerMap.mean,
      determinismViolations:
        determinismViolations === ORIGINAL_CAMPAIGN.determinismViolations,
      rejectionReasons: Object.entries(ORIGINAL_CAMPAIGN.rejectionReasons).every(
        ([reason, count]) => rejectionTally[reason] === count,
      ),
    }
  : { comparable: false, reason: `--seeds ${SEEDS_PER_SLOT} != campanha original 12` };
const reproducedExactly =
  comparable && Object.entries(reproduction).every(([k, v]) => k === "comparable" || v === true);

const report = {
  mission: "ROTA-CHEST-REWARDS-01",
  phase: "FASE_1_BREAKABLE_WALL_FEASIBILITY",
  preChestBaselineCommit: "eb26368",
  /**
   * The chronology, stated so it cannot be misread later (§6, §32).
   */
  history: {
    originalRole:
      "GATE — a Picareta so foi implementada depois desta campanha passar, e o conjunto certificado decidia quais paredes o jogador podia abrir",
    designRevision:
      "playtest manual: a Picareta passou a abrir QUALQUER parede interna adjacente, e escolher qual virou a dificuldade",
    currentRole:
      "evidencia historica — mede se abrir uma parede muda estes tabuleiros, que e o motivo pelo qual a mecanica existe",
    BREAKABLE_WALL_FEASIBILITY_GATE: "SUPERSEDED_AS_RUNTIME_RESTRICTION",
    BREAKABLE_WALL_FEASIBILITY_EVIDENCE: "PRESERVED",
    CERTIFIED_WALL_RUNTIME_RESTRICTION: false,
    ruleSourceThen:
      "src/games/escape-maze/useEscapeMaze.ts :: auditBreakableWalls / certifyBreakableWall",
    ruleSourceNow: "tools/validation/breakable-wall-certifier.mjs (offline only)",
    reproducesOriginalCampaign: reproduction,
    reproducedExactly,
  },
  ruleSource: "tools/validation/breakable-wall-certifier.mjs",
  contract: {
    mustBeAnExistingWallCell: true,
    excludedByAssertion: ["portal", "spawn", "startZone", "light", "trap", "chest"],
    minimumWalkableNeighbours: BREAKABLE_MIN_DEGREE,
    mustKeepOneConnectedField: true,
    significanceIsAnyOf: [
      "objectiveMovesSaved >= 1 (atalho na rota objetivo completa)",
      "portalAccessesGained >= 1 (nova porta na regiao do portal)",
      "escapeCellsGained >= 1 (celula da rota ganha uma terceira saida)",
      "alternativeRouteCellsGained >= 1 (celula existente ganha rota independente)",
    ],
    measuredButNeverACertifyingReason: [
      "hunterMovesSaved (o trade-off da Picareta)",
      "portalZoneCellsGained (o territorio do Sentinela muda de forma)",
      "cyclesGained (consequencia exata de degree - 1)",
    ],
    markedPerStage: BREAKABLE_WALL_COUNT,
    hardMaximum: BREAKABLE_WALL_MAX,
    minimumSeparation: BREAKABLE_MIN_SEPARATION,
    randomnessInSelection: "none",
    goldenSeedHardcoding: "none",
  },
  sampling: {
    seedsPerSlot: SEEDS_PER_SLOT,
    baseSeed: BASE_SEED,
    stages: STAGES,
    templatesPerStage: TEMPLATES_PER_STAGE,
    difficulties: DIFFICULTIES,
    mapsMeasured,
    generationFailures,
    elapsedMs: Date.now() - started,
  },
  results: {
    mapsWithZeroCertifiedWalls: mapsWithZero,
    certifiedPerMap: measured,
    determinismViolations,
    rejectionReasons: rejectionTally,
    perTemplate,
    perSlot: slots,
  },
  verdict: allPass
    ? "BREAKABLE_WALL_FEASIBILITY_PASSED"
    : "ROTA-CHEST-REWARDS-01_BLOCKED_ON_BREAKABLE_WALL_FEASIBILITY",
  BREAKABLE_WALL_HAS_TOPOLOGICAL_EFFECT: allPass,
  failingTemplates: failing,
};

fs.writeFileSync(
  path.join(OUT, "breakable-wall-feasibility.json"),
  JSON.stringify(report, null, 2),
);

console.log("");
console.log(`maps measured ................ ${mapsMeasured}`);
console.log(`maps with zero certified ..... ${mapsWithZero}`);
console.log(`generation failures .......... ${generationFailures}`);
console.log(`determinism violations ....... ${determinismViolations}`);
console.log(
  `certified per map ............ min ${report.results.certifiedPerMap.min} · ` +
    `mean ${report.results.certifiedPerMap.mean} · max ${report.results.certifiedPerMap.max}`,
);
console.log(
  `templates reaching target 2 .. ${perTemplate.filter((t) => t.reachesTargetTwoAlways).length}/9`,
);
console.log("rejection reasons:");
for (const [reason, count] of Object.entries(rejectionTally).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(count).padStart(5)}  ${reason}`);
}
console.log("");
console.log(
  `reproduz a campanha original ... ${
    comparable ? (reproducedExactly ? "SIM (identica)" : "NAO — divergiu") : "n/a"
  }`,
);
console.log("papel atual .................. evidencia historica, nao restricao de runtime");
console.log("");
console.log(report.verdict);
if (comparable && !reproducedExactly) {
  console.log("DIVERGENCE:", JSON.stringify(reproduction, null, 2));
  process.exitCode = 1;
}
if (!allPass) {
  console.log("failing templates:", JSON.stringify(failing, null, 2));
  process.exitCode = 1;
}
