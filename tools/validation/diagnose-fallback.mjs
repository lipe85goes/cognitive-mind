/**
 * ROTA-DUAL-GUARDIANS-MAPS-01A-FALLBACK-CLOSE — find and explain the fallback.
 *
 * One map in 1080 exhausted MAX_GENERATION_ATTEMPTS and took the uncertified
 * path. This locates it deterministically and reports the attempt distribution
 * that produced it, so the recovery budget comes from measurement.
 */
import fs from "node:fs";
import path from "node:path";
import { loadLab, stats, DIFFICULTIES, ROUTES } from "./route-lab.mjs";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const SEEDS = Number(arg("--seeds", 120));
const OUT = path.resolve("docs/archive/route-dual-guardians-maps-01a");
fs.mkdirSync(OUT, { recursive: true });

const lab = loadLab();
const rows = [];
const fallbacks = [];

console.log(`sweeping ${SEEDS} seeds x 9 combinations (same seed ladder as the structural sample)...`);
for (const routeNumber of ROUTES) {
  for (const difficulty of DIFFICULTIES) {
    for (let s = 0; s < SEEDS; s += 1) {
      // Identical ladder to analyse-route-maps.mjs so the case is reproducible.
      const seed = 1_000 + s * 7 + routeNumber * 131 + DIFFICULTIES.indexOf(difficulty) * 977;
      const t = Date.now();
      const { map, generation } = lab.generate(difficulty, routeNumber, seed);
      const row = {
        routeNumber, difficulty, seed,
        attempts: generation.attempts, fallback: generation.fallback,
        templateIndex: generation.templateIndex, ms: Date.now() - t,
        lights: map.collectibleStars.length, traps: map.traps.length,
      };
      rows.push(row);
      if (generation.fallback) {
        fallbacks.push(row);
        console.log(`  FALLBACK: route${routeNumber}/${difficulty}/seed ${seed}`);
      }
    }
  }
}

const byCombo = {};
for (const rn of ROUTES) {
  for (const d of DIFFICULTIES) {
    const sub = rows.filter((r) => r.routeNumber === rn && r.difficulty === d);
    const a = sub.map((r) => r.attempts).sort((x, y) => x - y);
    const q = (p) => a[Math.min(a.length - 1, Math.floor(p * a.length))];
    byCombo[`route${rn}-${d}`] = {
      samples: sub.length,
      attempts: { p50: q(0.5), p90: q(0.9), p95: q(0.95), p99: q(0.99), max: a[a.length - 1] },
      ms: stats(sub.map((r) => r.ms)),
      fallbacks: sub.filter((r) => r.fallback).length,
    };
  }
}

const all = rows.map((r) => r.attempts).sort((x, y) => x - y);
const q = (p) => all[Math.min(all.length - 1, Math.floor(p * all.length))];

const report = {
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A-FALLBACK-CLOSE",
  generatedAt: new Date().toISOString(),
  maxGenerationAttempts: lab.api.MAX_GENERATION_ATTEMPTS,
  maps: rows.length,
  fallbacks: fallbacks.length,
  fallbackCases: fallbacks,
  attemptsOverall: { p50: q(0.5), p90: q(0.9), p95: q(0.95), p99: q(0.99), max: all[all.length - 1] },
  msOverall: stats(rows.map((r) => r.ms)),
  byCombo,
};
fs.writeFileSync(path.join(OUT, "generation-attempt-distribution.json"), JSON.stringify(report, null, 2));

console.log("\n=== tentativas ===");
console.log("global p50", report.attemptsOverall.p50, "p90", report.attemptsOverall.p90,
  "p95", report.attemptsOverall.p95, "p99", report.attemptsOverall.p99, "max", report.attemptsOverall.max);
for (const [k, v] of Object.entries(byCombo)) {
  console.log(` ${k.padEnd(18)} p50 ${String(v.attempts.p50).padStart(3)} p90 ${String(v.attempts.p90).padStart(3)} p95 ${String(v.attempts.p95).padStart(3)} p99 ${String(v.attempts.p99).padStart(3)} max ${String(v.attempts.max).padStart(3)} | fallbacks ${v.fallbacks}`);
}
console.log("\nfallbacks:", fallbacks.length, JSON.stringify(fallbacks.map((f) => `route${f.routeNumber}/${f.difficulty}/${f.seed}`)));
console.log("wrote generation-attempt-distribution.json");
