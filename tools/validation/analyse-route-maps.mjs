/**
 * ROTA-MAPS-DIFFICULTY-01 — map quality report.
 *
 * Deterministic sweep over every route x difficulty, with a fixed seed ladder,
 * producing the metrics that decide whether a map is good to PLAY — not merely
 * solvable. Extremes are reported alongside medians on purpose: a good median
 * hides the map that plays itself.
 *
 * Usage:
 *   node tools/validation/analyse-route-maps.mjs [--seeds 120] [--out FILE] [--label baseline]
 */
import fs from "node:fs";
import { loadLab, measure, stats, DIFFICULTIES, ROUTES, DIFFICULTY_LABEL } from "./route-lab.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const SEEDS = Number(arg("--seeds", 120));
const OUT = arg("--out", null);
const LABEL = arg("--label", "report");

const lab = loadLab();
const rows = [];
const started = Date.now();

for (const routeNumber of ROUTES) {
  for (const difficulty of DIFFICULTIES) {
    for (let s = 0; s < SEEDS; s += 1) {
      rows.push(measure(lab, difficulty, routeNumber, 1_000 + s * 7 + routeNumber * 131 + DIFFICULTIES.indexOf(difficulty) * 977));
    }
  }
}

const NUMERIC = [
  "objectiveMoves", "movesToAllLights", "portalShortest", "wallCount", "lights",
  "reachableCells", "junctions", "deadEnds", "idleDeadEnds", "longestCorridor",
  "disjointRoutes", "decisions", "decisionRatio", "longestForcedStreak",
  "guardianStartDistance", "attempts", "trapMeanScore", "trapUseless", "shieldDistance",
];

function summarise(subset) {
  const out = {};
  for (const field of NUMERIC) out[field] = stats(subset.map((r) => r[field]));
  out.captureRate = stats(subset.map((r) => r.pressure?.captureRate));
  out.avgMinDistance = stats(subset.map((r) => r.pressure?.avgMinDistance));
  out.threatTurns = stats(subset.map((r) => r.pressure?.avgThreatTurns));
  out.fallbacks = subset.filter((r) => r.fallback).length;
  out.trapIsolatingPairs = subset.reduce((a, r) => a + r.trapIsolatingPairs, 0);
  out.trapAllIsolate = subset.filter((r) => r.trapAllIsolate).length;
  out.uniqueWallLayouts = new Set(subset.map((r) => r.wallSignature)).size;
  out.uniqueTemplates = new Set(subset.map((r) => r.templateIndex)).size;
  out.samples = subset.length;
  return out;
}

const byCombo = {};
for (const routeNumber of ROUTES) {
  for (const difficulty of DIFFICULTIES) {
    byCombo[`route${routeNumber}-${difficulty}`] = summarise(
      rows.filter((r) => r.routeNumber === routeNumber && r.difficulty === difficulty),
    );
  }
}
const byDifficulty = {};
for (const difficulty of DIFFICULTIES) {
  byDifficulty[difficulty] = summarise(rows.filter((r) => r.difficulty === difficulty));
}

// Worst offenders — the maps a median would hide.
const worst = {
  longestForcedStreak: [...rows].sort((a, b) => b.longestForcedStreak - a.longestForcedStreak).slice(0, 8)
    .map((r) => ({ route: r.routeNumber, difficulty: r.difficulty, seed: r.seed, streak: r.longestForcedStreak, moves: r.objectiveMoves })),
  idleDeadEnds: [...rows].sort((a, b) => b.idleDeadEnds - a.idleDeadEnds).slice(0, 8)
    .map((r) => ({ route: r.routeNumber, difficulty: r.difficulty, seed: r.seed, idle: r.idleDeadEnds, total: r.deadEnds })),
  singleCorridor: rows.filter((r) => r.disjointRoutes <= 1)
    .map((r) => ({ route: r.routeNumber, difficulty: r.difficulty, seed: r.seed, routes: r.disjointRoutes })),
  fewDecisions: [...rows].sort((a, b) => a.decisionRatio - b.decisionRatio).slice(0, 8)
    .map((r) => ({ route: r.routeNumber, difficulty: r.difficulty, seed: r.seed, ratio: r.decisionRatio, decisions: r.decisions })),
  uselessTraps: rows.filter((r) => r.trapUseless > 0).length,
};

const report = {
  mission: "ROTA-MAPS-DIFFICULTY-01",
  label: LABEL,
  generatedAt: new Date().toISOString(),
  seedsPerCombination: SEEDS,
  totalMaps: rows.length,
  elapsedMs: Date.now() - started,
  byDifficulty,
  byCombo,
  worst,
};

if (OUT) {
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`written ${OUT}`);
}

const f = (s, k = "median") => (s ? String(s[k]) : "-");
console.log(`\n${LABEL} — ${rows.length} mapas (${SEEDS} seeds x 9 combinações)\n`);
console.log(
  "combo".padEnd(20) + "obj".padStart(6) + "dec%".padStart(7) + "forc".padStart(6) +
  "rotas".padStart(7) + "becos".padStart(7) + "ocio".padStart(6) + "corr".padStart(6) +
  "junc".padStart(6) + "capt%".padStart(7) + "trap".padStart(6) + "wall".padStart(6),
);
for (const routeNumber of ROUTES) {
  for (const difficulty of DIFFICULTIES) {
    const c = byCombo[`route${routeNumber}-${difficulty}`];
    console.log(
      `R${routeNumber} ${DIFFICULTY_LABEL[difficulty]}`.padEnd(20) +
      f(c.objectiveMoves).padStart(6) +
      String(Math.round((c.decisionRatio?.median ?? 0) * 100)).padStart(7) +
      f(c.longestForcedStreak).padStart(6) +
      f(c.disjointRoutes).padStart(7) +
      f(c.deadEnds).padStart(7) +
      f(c.idleDeadEnds).padStart(6) +
      f(c.longestCorridor).padStart(6) +
      f(c.junctions).padStart(6) +
      String(Math.round((c.captureRate?.mean ?? 0) * 100)).padStart(7) +
      f(c.trapMeanScore).padStart(6) +
      f(c.wallCount).padStart(6),
    );
  }
}
console.log("\nobj=movimentos objetivos · dec%=passos com escolha · forc=maior sequência sem escolha");
console.log("rotas=caminhos disjuntos start→portal · ocio=becos sem função · corr=maior corredor");
console.log("capt%=captura do guardião contra jogador ótimo · trap=valor médio futuro da armadilha\n");
console.log("templates únicos por combo:", ROUTES.map((r) => DIFFICULTIES.map((d) => byCombo[`route${r}-${d}`].uniqueTemplates).join("/")).join("  |  "));
console.log("layouts de parede únicos:", ROUTES.map((r) => DIFFICULTIES.map((d) => byCombo[`route${r}-${d}`].uniqueWallLayouts).join("/")).join("  |  "));
console.log("corredor único (rotas<=1):", worst.singleCorridor.length, "| mapas com armadilha inútil:", worst.uselessTraps, "| fallbacks:", rows.filter((r) => r.fallback).length);
console.log("pior sequência forçada:", worst.longestForcedStreak.slice(0, 3).map((w) => `R${w.route}/${w.difficulty}=${w.streak}`).join(" "));
console.log("mais becos ociosos:", worst.idleDeadEnds.slice(0, 3).map((w) => `R${w.route}/${w.difficulty}=${w.idle}`).join(" "));
