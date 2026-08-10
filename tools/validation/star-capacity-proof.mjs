/**
 * ROTA-01A-STAR-CAPACITY-PROOF — does a valid 6-star set exist at all?
 *
 * Gate 13 rejects 81.4% of candidates on the four failing seeds. That says the
 * stars chosen were invalid; it does NOT say a valid choice existed. This
 * settles it by exhaustive search per rejected candidate:
 *
 *   A  STAR_SELECTION_FAILURE          — a valid set of 6 exists, chooseStars
 *                                        picked a different one and lost.
 *   B  STRUCTURAL_STAR_CAPACITY_FAILURE — no set of 6 satisfies the contract on
 *                                        that wall layout.
 *
 * Feasibility is set-wise, not cell-wise: every star must satisfy the current
 * chooseStars filters AND share a biconnected block with the Explorer AND be at
 * least `starMinSeparation` from every other star. Individually eligible cells
 * are not enough — the separation constraint couples them.
 *
 * Tooling only: production is not modified.
 *
 * Usage: node tools/validation/star-capacity-proof.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createSeededRandom, key, bfs, pathLength } from "./route-lab.mjs";

const ROOT = process.cwd();
const HOOK = path.join(ROOT, "src/games/escape-maze/useEscapeMaze.ts");
const DIFF = path.join(ROOT, "src/engine/difficulty.ts");
const OUT = path.resolve("docs/archive/route-dual-guardians-maps-01a");
fs.mkdirSync(OUT, { recursive: true });

const source = fs.readFileSync(HOOK, "utf8");

// Capture the full candidate state at the gate-13 rejection.
const svStart = source.indexOf("function isStructurallyValid(");
const svEnd = source.indexOf("function isValidMap(");
let instrumented =
  source.slice(0, svStart) +
  source.slice(svStart, svEnd).replace(
    "  if (!collectibleStars.every((star) => sharesBlock(blocks, PLAYER_START, star))) {\n    return null;\n  }",
    `  if (!collectibleStars.every((star) => sharesBlock(blocks, PLAYER_START, star))) {
    (globalThis as { __gate13?: unknown[] }).__gate13?.push({
      walls: [...walls],
      guardianStart: posKey(guardianStart),
      exitPosition: posKey(exitPosition),
      stars: collectibleStars.map(posKey),
      blocksOf: [...blocks.blocksOf.entries()],
      componentOf: [...blocks.componentOf.entries()],
    });
    return null;
  }`,
  ) +
  source.slice(svEnd);

instrumented += `
export const __cap = {
  generateMaze, ROUTE_STAGE_QUALITY, getStarCount, PLAYER_START,
  START_SAFE_CELLS, posKey,
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
const dS = { module: dMod, exports: dMod.exports, console, Math: seededMath, Set, Map, require() { throw new Error("x"); } };
dS.globalThis = dS;
vm.createContext(dS);
new vm.Script(compile(fs.readFileSync(DIFF, "utf8"), DIFF)).runInContext(dS);

const hMod = { exports: {} };
const sandbox = {
  module: hMod, exports: hMod.exports, console, Math: seededMath, Date, Set, Map,
  setTimeout, clearTimeout, performance,
  require(r) {
    if (r === "react") return { useCallback: (c) => c, useEffect: () => {}, useMemo: (f) => f(), useRef: (v) => ({ current: v }), useState: (v) => [typeof v === "function" ? v() : v, () => {}] };
    if (r === "@/engine/difficulty") return dMod.exports;
    if (r === "@/engine/scoring") return { calculateEscapeMazeScore: () => 0 };
    if (r === "@/lib/game-sounds") return { playGentleErrorTone: () => {}, playSuccessChime: () => {} };
    throw new Error("import " + r);
  },
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
new vm.Script(compile(instrumented, HOOK)).runInContext(sandbox);
const API = hMod.exports.__cap;

const P = API.ROUTE_STAGE_QUALITY[3];
const REQUIRED = API.getStarCount("hard", 3);
const START = API.PLAYER_START;
const SAFE = API.START_SAFE_CELLS.map((c) => key(c));
const md = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
const toCell = (k) => { const [row, col] = k.split(",").map(Number); return { row, col }; };

console.log(`contrato stage 3: luzes=${REQUIRED} minStart=${P.starMinStartDistance} minExit=${P.starMinExitDistance} minSeparation=${P.starMinSeparation}`);

/** Largest set of pairwise-separated eligible cells, capped at `need`. */
function maxFeasible(eligible, need, minSep) {
  let best = 0;
  let witness = null;
  const n = eligible.length;
  const pick = (start, chosen) => {
    if (chosen.length > best) { best = chosen.length; witness = [...chosen]; }
    if (best >= need) return true;
    for (let i = start; i < n; i += 1) {
      if (chosen.length + (n - i) <= best) return false; // prune
      const c = eligible[i];
      if (chosen.every((s) => md(s, c) >= minSep)) {
        chosen.push(c);
        if (pick(i + 1, chosen)) return true;
        chosen.pop();
      }
    }
    return false;
  };
  pick(0, []);
  return { max: best, witness };
}

const SEEDS = [902627, 907474, 907548, 908399];
let A = 0, B = 0;
const capacityHist = {};
const perSeed = [];

for (const seed of SEEDS) {
  random = createSeededRandom(seed);
  sandbox.__gate13 = [];
  try { API.generateMaze("hard", 3); } catch { /* expected */ }
  const cases = sandbox.__gate13 ?? [];
  let a = 0, b = 0;
  const localHist = {};

  for (const c of cases) {
    const walls = new Set(c.walls);
    const exit = toCell(c.exitPosition);
    const blocksOf = new Map(c.blocksOf);
    const componentOf = new Map(c.componentOf);
    const shares = (t) => {
      const a1 = key(START), b1 = key(t);
      if (a1 === b1) return componentOf.has(a1);
      const ca = componentOf.get(a1), cb = componentOf.get(b1);
      if (ca === undefined || cb === undefined || ca !== cb) return false;
      const la = blocksOf.get(a1), lb = blocksOf.get(b1);
      return Boolean(la && lb && la.some((id) => lb.includes(id)));
    };
    const blocked = new Set([key(START), c.guardianStart, c.exitPosition, ...SAFE]);
    const dist = bfs(START, walls);

    const eligible = [];
    for (let row = 0; row < 9; row += 1) {
      for (let col = 0; col < 9; col += 1) {
        const pos = { row, col };
        const k = key(pos);
        if (walls.has(k) || blocked.has(k)) continue;
        const ds = dist.get(k);
        const de = pathLength(pos, exit, walls);
        if (ds === undefined || de === null) continue;
        if (ds < P.starMinStartDistance || de < P.starMinExitDistance) continue;
        if (!shares(pos)) continue;
        eligible.push(pos);
      }
    }

    const { max } = maxFeasible(eligible, REQUIRED, P.starMinSeparation);
    localHist[max] = (localHist[max] ?? 0) + 1;
    capacityHist[max] = (capacityHist[max] ?? 0) + 1;
    if (max >= REQUIRED) { a += 1; A += 1; } else { b += 1; B += 1; }
  }
  perSeed.push({ seed, gate13Cases: cases.length, A: a, B: b });
  console.log(`seed ${seed}: ${cases.length} rejeições gate 13 -> A=${a} B=${b} | capacidade: ${JSON.stringify(localHist)}`);
}

const total = A + B;
const verdict =
  B / total > 0.8 ? "STRUCTURAL_STAR_CAPACITY_FAILURE_DOMINANT"
  : A / total > 0.8 ? "STAR_SELECTION_FAILURE_DOMINANT"
  : "MIXED_STAR_FAILURE";

fs.writeFileSync(path.join(OUT, "star-capacity-verdict.json"), JSON.stringify({
  mission: "ROTA-01A-STAR-CAPACITY-PROOF",
  contract: {
    requiredStars: REQUIRED,
    starMinStartDistance: P.starMinStartDistance,
    starMinExitDistance: P.starMinExitDistance,
    starMinSeparation: P.starMinSeparation,
    note: "viabilidade é do CONJUNTO: separação mínima acopla as escolhas",
  },
  totalGate13: total, A, B,
  percentA: +((A / total) * 100).toFixed(1),
  percentB: +((B / total) * 100).toFixed(1),
  maxFeasibleHistogram: capacityHist,
  perSeed, verdict,
}, null, 2));

console.log(`\ntotal gate 13: ${total} | A=${A} (${((A / total) * 100).toFixed(1)}%) | B=${B} (${((B / total) * 100).toFixed(1)}%)`);
console.log(`capacidade máxima viável: ${JSON.stringify(capacityHist)}`);
console.log(`\nVEREDITO: ${verdict}`);
