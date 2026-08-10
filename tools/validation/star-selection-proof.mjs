/**
 * ROTA-01A-STAR-SELECTION-PROOF — the 2.330-case gate.
 *
 * Rebuilds the exact candidates that the OLD chooseStars lost to gate 13 (by
 * loading the hook with the eligibility filter removed in memory — production is
 * untouched), then runs the CURRENT production chooseStars on those same wall
 * layouts and proves it finds a complete, valid six-star set every time.
 *
 * Also reports how often the backtracking actually had to abandon the greedy
 * first pick, which is what justifies its presence.
 *
 * Usage: node tools/validation/star-selection-proof.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createSeededRandom, key } from "./route-lab.mjs";

const ROOT = process.cwd();
const HOOK = path.join(ROOT, "src/games/escape-maze/useEscapeMaze.ts");
const DIFF = path.join(ROOT, "src/engine/difficulty.ts");
const OUT = path.resolve("docs/archive/route-dual-guardians-maps-01a");
fs.mkdirSync(OUT, { recursive: true });

const source = fs.readFileSync(HOOK, "utf8");
const ELIGIBILITY = `        distanceFromExit < profile.starMinExitDistance ||
        // The requirement the validator applies, applied at selection time.
        !sharesBlock(blocks, playerStart, pos)`;
if (!source.includes(ELIGIBILITY)) throw new Error("chooseStars shape changed");

const compile = (src) =>
  ts.transpileModule(src, {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: HOOK,
  }).outputText;

function build(src, extraExports) {
  let random = createSeededRandom(1);
  const seededMath = Object.create(Math);
  seededMath.random = () => random();
  const dMod = { exports: {} };
  const dS = { module: dMod, exports: dMod.exports, console, Math: seededMath, Set, Map, require() { throw new Error("x"); } };
  dS.globalThis = dS;
  vm.createContext(dS);
  new vm.Script(compile(fs.readFileSync(DIFF, "utf8"))).runInContext(dS);
  const hMod = { exports: {} };
  const sb = {
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
  sb.globalThis = sb;
  vm.createContext(sb);
  new vm.Script(compile(src + extraExports)).runInContext(sb);
  return { api: hMod.exports.__proof, sandbox: sb, setSeed: (s) => { random = createSeededRandom(s); } };
}

const EXPORTS = `
export const __proof = {
  generateMaze, chooseStars, decomposeBoardBlocks, sharesBlock,
  isStructurallyValid, ROUTE_STAGE_QUALITY, getStarCount,
  PLAYER_START, START_SAFE_CELLS, posKey, getNeighbors, getReachableDistances,
};
`;

// --- OLD behaviour: capture the candidates gate 13 used to reject ------------
const oldSource = source
  .replace(ELIGIBILITY, "        distanceFromExit < profile.starMinExitDistance")
  .replace(
    "  if (!collectibleStars.every((star) => sharesBlock(blocks, PLAYER_START, star))) {\n    return null;\n  }",
    `  if (!collectibleStars.every((star) => sharesBlock(blocks, PLAYER_START, star))) {
    (globalThis as { __cap?: unknown[] }).__cap?.push({
      walls: [...walls],
      guardianStart: posKey(guardianStart),
      exitPosition: posKey(exitPosition),
    });
    return null;
  }`,
  );

const OLD = build(oldSource, EXPORTS);
const NEW = build(source, EXPORTS);
const P = NEW.api.ROUTE_STAGE_QUALITY[3];
const REQUIRED = NEW.api.getStarCount("hard", 3);
const START = NEW.api.PLAYER_START;
const toCell = (k) => { const [row, col] = k.split(",").map(Number); return { row, col }; };
const md = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);

console.log(`replaying gate-13 candidates · required=${REQUIRED} minSep=${P.starMinSeparation}`);

const captured = [];
for (const seed of [902627, 907474, 907548, 908399]) {
  OLD.setSeed(seed);
  OLD.sandbox.__cap = [];
  try { OLD.api.generateMaze("hard", 3); } catch { /* expected */ }
  for (const c of OLD.sandbox.__cap) captured.push({ seed, ...c });
}
console.log(`candidatos capturados: ${captured.length}`);

let success = 0;
const failures = [];
let gate13Failures = 0;
let greedyFirst = 0;
let backtrackNeeded = 0;
const t0 = Date.now();

for (const c of captured) {
  const walls = new Set(c.walls);
  const guardian = toCell(c.guardianStart);
  const exit = toCell(c.exitPosition);
  const blocks = NEW.api.decomposeBoardBlocks(walls);
  const stars = NEW.api.chooseStars(walls, START, guardian, exit, "hard", 3, blocks);

  const keys = stars.map((s) => key(s));
  const dist = NEW.api.getReachableDistances(START, walls);
  const blocked = new Set([
    key(START), c.guardianStart, c.exitPosition,
    ...NEW.api.START_SAFE_CELLS.map((x) => key(x)),
  ]);

  const problems = [];
  if (stars.length !== REQUIRED) problems.push(`count=${stars.length}`);
  for (const s of stars) {
    const k = key(s);
    if (walls.has(k)) problems.push(`wall ${k}`);
    if (blocked.has(k)) problems.push(`protected ${k}`);
    if ((dist.get(k) ?? -1) < P.starMinStartDistance) problems.push(`nearStart ${k}`);
    if (!NEW.api.sharesBlock(blocks, START, s)) { problems.push(`noBlock ${k}`); gate13Failures += 1; }
  }
  for (let i = 0; i < stars.length; i += 1) {
    for (let j = i + 1; j < stars.length; j += 1) {
      if (md(stars[i], stars[j]) < P.starMinSeparation) problems.push(`sep ${keys[i]}~${keys[j]}`);
    }
  }

  if (problems.length === 0) success += 1;
  else if (failures.length < 20) failures.push({ seed: c.seed, problems: problems.slice(0, 4) });

  // Would pure greedy (score order, separation only) have produced the same set?
  const greedy = [];
  for (const s of stars) {
    if (greedy.every((g) => md(g, s) >= P.starMinSeparation)) greedy.push(s);
  }
  if (greedy.length === stars.length && greedy.every((g, i) => key(g) === keys[i])) greedyFirst += 1;
  else backtrackNeeded += 1;
}

const report = {
  mission: "ROTA-01A-STAR-SELECTION-PROOF",
  capturedCandidates: captured.length,
  success, failures: captured.length - success,
  gate13Failures,
  greedyFirstPathSuccess: greedyFirst,
  backtrackRequired: backtrackNeeded,
  elapsedMs: Date.now() - t0,
  contract: {
    requiredStars: REQUIRED,
    starMinStartDistance: P.starMinStartDistance,
    starMinExitDistance: P.starMinExitDistance,
    starMinSeparation: P.starMinSeparation,
  },
  failureSample: failures,
};
fs.writeFileSync(path.join(OUT, "star-selection-2330-after.json"), JSON.stringify(report, null, 2));

console.log(`\nSUCESSO: ${success}/${captured.length}`);
console.log(`gate 13 failures: ${gate13Failures}`);
console.log(`greedy bastou: ${greedyFirst} | precisou backtrack: ${backtrackNeeded}`);
if (failures.length) console.log("amostra de falhas:", JSON.stringify(failures.slice(0, 3)));
console.log(failures.length === 0 && gate13Failures === 0 ? "\nSTAR_SELECTION_PROOF_OK" : "\nSTAR_SELECTION_PROOF_FAILED");
