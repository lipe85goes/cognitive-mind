/**
 * ROTA-01A-GENERATION-FAILURE-ROOT-CAUSE — reason-code autopsy.
 *
 * Loads the generator with a DIAGNOSTIC injection (tooling only — production
 * source is untouched): every `return null` inside `isStructurallyValid` is
 * tagged with the check that produced it, in source order, so a rejected
 * candidate can say WHY instead of just "no".
 *
 * Then it replays the four deterministic failures and reports, per phase:
 * rejection histogram, guardian spawn actually chosen, and how many distinct
 * states the recovery sweep really explores.
 *
 * Usage: node tools/validation/autopsy-generation.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createSeededRandom } from "./route-lab.mjs";

const ROOT = process.cwd();
const HOOK = path.join(ROOT, "src/games/escape-maze/useEscapeMaze.ts");
const DIFF = path.join(ROOT, "src/engine/difficulty.ts");
const OUT = path.resolve("docs/archive/route-dual-guardians-maps-01a");
fs.mkdirSync(OUT, { recursive: true });

const source = fs.readFileSync(HOOK, "utf8");

// --- locate isStructurallyValid and tag each rejection in source order -------
const svStart = source.indexOf("function isStructurallyValid(");
const svEnd = source.indexOf("function isValidMap(");
if (svStart < 0 || svEnd < 0) throw new Error("generator shape changed");
const svBody = source.slice(svStart, svEnd);

// Name each `return null` by the nearest preceding condition text.
const lines = svBody.split("\n");
const reasons = [];
for (let i = 0; i < lines.length; i += 1) {
  if (!lines[i].includes("return null;")) continue;
  let label = lines[i].trim();
  if (label === "return null;") {
    for (let j = i - 1; j >= 0 && j > i - 6; j -= 1) {
      if (lines[j].trim()) { label = lines[j].trim(); break; }
    }
  }
  reasons.push(label.replace(/^if \(/, "").replace(/\) return null;$/, "").slice(0, 90));
}

let tagged = svBody;
let n = 0;
tagged = tagged.replace(/return null;/g, () => {
  const id = n;
  n += 1;
  return `return ((globalThis as { __reason?: unknown }).__reason = ${id}, null);`;
});

let instrumented = source.slice(0, svStart) + tagged + source.slice(svEnd);
// Tag acceptance too.
instrumented = instrumented.replace(
  "  return { blocks, objective };",
  "  (globalThis as { __reason?: unknown }).__reason = -1;\n  return { blocks, objective };",
);
// Observe the guardian spawn actually returned.
instrumented = instrumented.replace(
  "  return fallback ?? { row: 0, col: 3 };",
  `  const __g = fallback ?? { row: 0, col: 3 };
  (globalThis as { __guardianTrace?: unknown[] }).__guardianTrace?.push({
    candidates: candidates.length,
    usedFallback: true,
    fallbackFound: Boolean(fallback),
    chosen: posKey(__g),
    onWall: walls.has(posKey(__g)),
  });
  return __g;`,
);
instrumented = instrumented.replace(
  "  if (candidates.length > 0) return randomItem(candidates);",
  `  if (candidates.length > 0) {
    const __c = randomItem(candidates);
    (globalThis as { __guardianTrace?: unknown[] }).__guardianTrace?.push({
      candidates: candidates.length, usedFallback: false, chosen: posKey(__c),
      onWall: walls.has(posKey(__c)),
    });
    return __c;
  }`,
);
// Count attempts by phase.
instrumented = instrumented.replace(
  "  if (!analysis) return null;",
  `  ((globalThis as { __hist?: unknown[] }).__hist ?? []).push({
    reason: (globalThis as { __reason?: number }).__reason,
    phase: (globalThis as { __phase?: string }).__phase,
  });
  if (!analysis) return null;`,
);
instrumented = instrumented.replace(
  "  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {",
  `  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    (globalThis as { __phase?: string }).__phase = "random";`,
);
instrumented = instrumented.replace(
  "  for (let round = 0; round < RECOVERY_ROUNDS; round++) {",
  `  for (let round = 0; round < RECOVERY_ROUNDS; round++) {
    (globalThis as { __phase?: string }).__phase = "recovery";`,
);
instrumented += `
export const __autopsy = {
  generateMaze, ROUTE_STAGE_GUARDIAN_CANDIDATES, GUARDIAN_CANDIDATES,
  ROUTE_STAGE_EXIT_CANDIDATES, DIFFICULTY_PLAY_BRIEF, ROUTE_STAGE_QUALITY,
  MAX_GENERATION_ATTEMPTS, RECOVERY_ROUNDS, RECOVERY_RETRIES_PER_SLOT,
  getRouteStageTemplates, posKey,
};
`;

const compile = (src, file) =>
  ts.transpileModule(src, {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: file,
  }).outputText;

let random = createSeededRandom(1);
const seededMath = Object.create(Math);
seededMath.random = () => random();

const dMod = { exports: {} };
const dSandbox = { module: dMod, exports: dMod.exports, console, Math: seededMath, Set, Map, require() { throw new Error("x"); } };
dSandbox.globalThis = dSandbox;
vm.createContext(dSandbox);
new vm.Script(compile(fs.readFileSync(DIFF, "utf8"), DIFF)).runInContext(dSandbox);

const hMod = { exports: {} };
const sandbox = {
  module: hMod, exports: hMod.exports, console, Math: seededMath, Date, Set, Map,
  setTimeout, clearTimeout, performance,
  require(r) {
    if (r === "react") return { useCallback: (c) => c, useEffect: () => {}, useMemo: (f) => f(), useRef: (v) => ({ current: v }), useState: (v) => [typeof v === "function" ? v() : v, () => {}] };
    if (r === "@/engine/difficulty") return dMod.exports;
    if (r === "@/engine/scoring") return { calculateEscapeMazeScore: () => 0 };
    if (r === "@/lib/game-sounds") return { playGentleErrorTone: () => {}, playSuccessChime: () => {} };
    throw new Error("unexpected import " + r);
  },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
new vm.Script(compile(instrumented, HOOK)).runInContext(sandbox);
const API = hMod.exports.__autopsy;

console.log(`reason codes descobertos: ${reasons.length}`);
reasons.forEach((r, i) => console.log(`  ${String(i).padStart(2)} ${r}`));
console.log();

const SEEDS = [902627, 907474, 907548, 908399];
const report = { mission: "ROTA-01A-GENERATION-FAILURE-ROOT-CAUSE", reasons, cases: [] };

for (const seed of SEEDS) {
  random = createSeededRandom(seed);
  sandbox.__guardianTrace = [];
  sandbox.__hist = [];
  let threw = false;
  try {
    API.generateMaze("hard", 3);
  } catch {
    threw = true;
  }
  const trace = sandbox.__guardianTrace ?? [];
  const fallbackUses = trace.filter((t) => t.usedFallback).length;
  const zeroCandidates = trace.filter((t) => t.candidates === 0).length;
  const onWall = trace.filter((t) => t.onWall).length;
  const chosenHist = {};
  for (const t of trace) chosenHist[t.chosen] = (chosenHist[t.chosen] ?? 0) + 1;

  const hist = {};
  const phaseHistogram = { random: {}, recovery: {} };
  for (const h of sandbox.__hist ?? []) {
    const label = h.reason === -1 ? "PASSOU_ESTRUTURAL" : `[${h.reason}] ${reasons[h.reason] ?? "?"}`;
    hist[label] = (hist[label] ?? 0) + 1;
    const ph = phaseHistogram[h.phase] ?? (phaseHistogram[h.phase] = {});
    ph[label] = (ph[label] ?? 0) + 1;
  }
  const entry = {
    seed, threw, attemptsObserved: (sandbox.__hist ?? []).length,
    histogram: hist, phaseHistogram, lastReasonIndex: sandbox.__reason,
    lastReason: sandbox.__reason >= 0 ? reasons[sandbox.__reason] : "ACEITO",
    guardianCalls: trace.length,
    guardianZeroCandidates: zeroCandidates,
    guardianFallbackUses: fallbackUses,
    guardianChosenOnWall: onWall,
    guardianChosenHistogram: chosenHist,
    distinctGuardianStarts: Object.keys(chosenHist).length,
  };
  report.cases.push(entry);
  console.log(`seed ${seed}: ${threw ? "LANÇOU" : "ok"} | guardião: ${trace.length} chamadas, ${zeroCandidates} com zero candidatos, ${fallbackUses} usaram fallback, ${onWall} sobre parede`);
  console.log(`  spawns distintos: ${Object.keys(chosenHist).length} -> ${JSON.stringify(chosenHist)}`);
  const top = Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log(`  tentativas observadas: ${(sandbox.__hist ?? []).length}`);
  for (const [k, v] of top) console.log(`    ${String(v).padStart(4)}  ${k.slice(0, 78)}`);
}

fs.writeFileSync(path.join(OUT, "generation-four-seeds-autopsy.json"), JSON.stringify(report, null, 2));
console.log("\nwrote generation-four-seeds-autopsy.json");
