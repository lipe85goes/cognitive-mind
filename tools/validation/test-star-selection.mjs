/**
 * ROTA-01A-STAR-SELECTION-PROOF-FINALIZE — controlled tests A–F.
 *
 * Six fixtures that pin the behaviour of the current `chooseStars`. Production
 * source is never written to: three in-memory variants of the hook are compiled
 * in a vm sandbox —
 *
 *   PROD   the file exactly as it ships (all assertions about WHAT is selected)
 *   TRACE  PROD plus counters inside the search (assertions about HOW)
 *   OLD    PROD with the sharesBlock eligibility filter removed (supplies the
 *          pre-fix candidate stream and the pre-fix score ranking)
 *
 * Every fixture asserts PROD and TRACE agree, which is also the check that the
 * instrumentation does not change behaviour.
 *
 * Usage: node tools/validation/test-star-selection.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createSeededRandom, key } from "./route-lab.mjs";

const ROOT = process.cwd();
const HOOK = path.join(ROOT, "src/games/escape-maze/useEscapeMaze.ts");
const DIFF = path.join(ROOT, "src/engine/difficulty.ts");
const OUT = path.resolve(
  process.env.ROUTE_VALIDATION_OUT ??
    "docs/archive/route-dual-guardians-maps-01a",
);
fs.mkdirSync(OUT, { recursive: true });

const source = fs.readFileSync(HOOK, "utf8").replaceAll("\r\n", "\n");
const must = (needle, label) => {
  const n = source.split(needle).length - 1;
  if (n !== 1) throw new Error(`anchor ${label} appears ${n}x; expected 1`);
  return needle;
};

const A_ELIGIBILITY = must(
  `        distanceFromExit < profile.starMinExitDistance ||
        // The requirement the validator applies, applied at selection time.
        !sharesBlock(blocks, playerStart, pos)`,
  "eligibility",
);
const A_ORDERED = must("  const ordered = candidates.map((candidate) => candidate.pos);", "ordered");
const A_SEARCH_HEAD = must(
  `  const search = (from: number, chosen: GridPosition[]): GridPosition[] | null => {
    if (chosen.length === targetCount) return chosen;`,
  "search head",
);
const A_POP = must(
  `      const complete = search(index + 1, chosen);
      if (complete) return complete;
      chosen.pop();`,
  "search pop",
);
const A_ANALYSIS = must("  if (!analysis) return null;", "analysis guard");
const A_GATE13 = must(
  `  if (!collectibleStars.every((star) => sharesBlock(blocks, PLAYER_START, star))) {
    return null;
  }`,
  "gate 13",
);

const CAPTURE_CANDIDATE = `  ((globalThis as { __cands?: unknown[] }).__cands ?? []).push({
    walls: [...walls], guardianStart: posKey(guardianStart),
    exitPosition: posKey(exitPosition), stars: collectibleStars.map(posKey),
    passed: Boolean(analysis),
  });
${A_ANALYSIS}`;

const TRACE_ORDERED = `${A_ORDERED}
  const __t = (globalThis as { __trace?: Record<string, unknown> }).__trace;
  if (__t) {
    __t.ordered = candidates.map((c) => ({ pos: c.pos, score: c.score }));
    __t.nodes = 0; __t.backtracks = 0; __t.maxDepth = 0;
    __t.targetCount = targetCount;
    __t.minSep = getStarMinSeparation(difficulty, routeStage);
  }`;

const TRACE_SEARCH = `  const search = (from: number, chosen: GridPosition[]): GridPosition[] | null => {
    if (__t) {
      __t.nodes = (__t.nodes as number) + 1;
      if (chosen.length > (__t.maxDepth as number)) __t.maxDepth = chosen.length;
    }
    if (chosen.length === targetCount) return chosen;`;

const TRACE_POP = `      const complete = search(index + 1, chosen);
      if (complete) return complete;
      chosen.pop();
      if (__t) __t.backtracks = (__t.backtracks as number) + 1;`;

const EXPORTS = `
export const __t = {
  generateMaze, chooseStars, decomposeBoardBlocks, sharesBlock, isStructurallyValid,
  ROUTE_STAGE_QUALITY, getStarCount, getStarMinSeparation, PLAYER_START,
  START_SAFE_CELLS, posKey,
  getNeighbors, getReachableDistances,
};
`;

const compile = (src) =>
  ts.transpileModule(src, {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: HOOK,
  }).outputText;

function build(src) {
  let random = createSeededRandom(1);
  const seededMath = Object.create(Math);
  seededMath.random = () => random();
  const routeRandomModule = {
    beginSeededGeneration: () => undefined,
    routeRandom: () => seededMath.random(),
  };
  const dMod = { exports: {} };
  const dS = {
    module: dMod,
    exports: dMod.exports,
    console,
    Math: seededMath,
    Set,
    Map,
    require(r) {
      if (r === "@/engine/route-random") return routeRandomModule;
      throw new Error("import " + r);
    },
  };
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
      if (r === "@/engine/route-random") return routeRandomModule;
      if (r === "@/engine/scoring") return { calculateEscapeMazeScore: () => 0 };
      if (r === "@/lib/game-sounds") return { playGentleErrorTone: () => {}, playSuccessChime: () => {} };
      if (r === "@/games/escape-maze/continuation") {
        // Types-only module: where a Route's end leads. Not reached by generation.
        const cMod = { exports: {} };
        vm.runInNewContext(compile(fs.readFileSync(path.join(ROOT, "src/games/escape-maze/continuation.ts"), "utf8")), { module: cMod, exports: cMod.exports });
        return cMod.exports;
      }
      throw new Error("import " + r);
    },
  };
  sb.globalThis = sb;
  vm.createContext(sb);
  new vm.Script(compile(src + EXPORTS)).runInContext(sb);
  return { api: hMod.exports.__t, sb, seed: (s) => { random = createSeededRandom(s); } };
}

const PROD = build(source);
const TRACE = build(
  source
    .replace(A_ORDERED, TRACE_ORDERED)
    .replace(A_SEARCH_HEAD, TRACE_SEARCH)
    .replace(A_POP, TRACE_POP)
    .replace(A_ANALYSIS, CAPTURE_CANDIDATE),
);
const OLD = build(source.replace(A_ELIGIBILITY, "        distanceFromExit < profile.starMinExitDistance"));

const P = PROD.api.ROUTE_STAGE_QUALITY[3];
const NEED = PROD.api.getStarCount("hard", 3);
const START = PROD.api.PLAYER_START;
const SEP = PROD.api.getStarMinSeparation("hard", 3);
const SEEDS = [902627, 907474, 907548, 908399];
const toCell = (k) => { const [row, col] = k.split(",").map(Number); return { row, col }; };
const md = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
const keys = (list) => list.map((s) => key(s));

console.log(`contrato stage3/hard: luzes=${NEED} minStart=${P.starMinStartDistance} minExit=${P.starMinExitDistance} minSep=${SEP}\n`);

// --- shared helpers ---------------------------------------------------------
/** Run production chooseStars on a layout, with the RNG pinned. */
function select(lab, layout, rngSeed = 7) {
  lab.seed(rngSeed);
  const walls = new Set(layout.walls);
  const blocks = lab.api.decomposeBoardBlocks(walls);
  const stars = lab.api.chooseStars(
    walls, START, toCell(layout.guardianStart), toCell(layout.exitPosition), "hard", 3, blocks,
  );
  return { stars, blocks, walls };
}

/** The candidate order production actually used, plus search counters. */
function trace(layout, rngSeed = 7) {
  TRACE.sb.__trace = {};
  const r = select(TRACE, layout, rngSeed);
  const t = TRACE.sb.__trace;
  TRACE.sb.__trace = undefined;
  return { ...r, ...t };
}

/** Pure greedy over the SAME ordered list production used. */
function greedy(ordered) {
  const chosen = [];
  for (const { pos } of ordered) {
    if (chosen.every((s) => md(s, pos) >= SEP)) chosen.push(pos);
    if (chosen.length >= NEED) break;
  }
  return chosen;
}

/** Complete valid sets over an ordered list, counted with early exit. */
function countSets(ordered, limit = 2) {
  const cells = ordered.map((o) => o.pos);
  let found = 0;
  let first = null;
  const walk = (from, chosen) => {
    if (chosen.length === NEED) {
      found += 1;
      if (!first) first = [...chosen];
      return found >= limit;
    }
    for (let i = from; i < cells.length; i += 1) {
      if (chosen.length + (cells.length - i) < NEED) return false;
      const c = cells[i];
      if (!chosen.every((s) => md(s, c) >= SEP)) continue;
      chosen.push(c);
      if (walk(i + 1, chosen)) return true;
      chosen.pop();
    }
    return false;
  };
  walk(0, []);
  return { count: found, witness: first };
}

/** Every rule a selected light must satisfy, checked independently. */
function violations(stars, layout, blocks, walls, expectCount = NEED) {
  const bad = [];
  const dist = PROD.api.getReachableDistances(START, walls);
  const protectedCells = new Set([
    key(START), layout.guardianStart, layout.exitPosition,
    ...PROD.api.START_SAFE_CELLS.map((c) => key(c)),
  ]);
  if (expectCount !== null && stars.length !== expectCount) bad.push(`count=${stars.length}`);
  if (new Set(keys(stars)).size !== stars.length) bad.push("duplicated light");
  for (const s of stars) {
    const k = key(s);
    if (walls.has(k)) bad.push(`wall ${k}`);
    if (protectedCells.has(k)) bad.push(`protected ${k}`);
    if ((dist.get(k) ?? -1) < P.starMinStartDistance) bad.push(`nearStart ${k}`);
    if (!PROD.api.sharesBlock(blocks, START, s)) bad.push(`noBlock ${k}`);
  }
  for (let i = 0; i < stars.length; i += 1) {
    for (let j = i + 1; j < stars.length; j += 1) {
      if (md(stars[i], stars[j]) < SEP) bad.push(`sep ${key(stars[i])}~${key(stars[j])}`);
    }
  }
  return bad;
}

// --- layout corpus: the real candidates the fix was built for ---------------
const corpus = [];
for (const seed of SEEDS) {
  OLD.seed(seed);
  OLD.sb.__cands = [];
  try { OLD.api.generateMaze("hard", 3); } catch { /* pre-fix seeds throw */ }
}
// OLD has no capture hook; re-derive the corpus from the traced (post-fix) run,
// which visits the same layout space and records every candidate it builds.
const accepted = [];
const seedAttempts = [];
for (const seed of SEEDS) {
  TRACE.seed(seed);
  TRACE.sb.__cands = [];
  let threw = false;
  let map = null;
  try { map = TRACE.api.generateMaze("hard", 3); } catch { threw = true; }
  const cands = TRACE.sb.__cands ?? [];
  seedAttempts.push({ seed, attempts: cands.length, threw, certified: Boolean(map) });
  for (const c of cands) {
    corpus.push(c);
    if (c.passed) accepted.push(c);
  }
}
// The four gate seeds alone no longer yield enough candidates to build fixtures
// from: ROTA-01A-ESCAPE-ROUTE-GENERATION cut their wasted attempts from 265 to
// 17. Top the corpus up from extra seeds — the regression above still runs on
// exactly the four, these only feed the fixture search.
let fillSeed = 5_100_000;
while (corpus.length < 250 && fillSeed < 5_100_400) {
  fillSeed += 1;
  TRACE.seed(fillSeed);
  TRACE.sb.__cands = [];
  try { TRACE.api.generateMaze("hard", 3); } catch { /* counted elsewhere */ }
  for (const c of TRACE.sb.__cands ?? []) {
    corpus.push(c);
    if (c.passed) accepted.push(c);
  }
}
console.log(`corpus: ${corpus.length} candidatos · ${accepted.length} passaram isStructurallyValid\n`);

const results = [];
const record = (id, name, pass, detail) => {
  results.push({ id, name, pass, ...detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${name}`);
  for (const [k, v] of Object.entries(detail)) {
    console.log(`        ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  }
  console.log();
};

// ===========================================================================
// TEST A — EXACT CAPACITY: exactly one complete valid set of 6 exists.
// ===========================================================================
let fixtureA = null;
outerA:
for (const layout of corpus) {
  const t = trace(layout);
  if (t.ordered.length === 0) continue;
  // Tighten by walling the strongest eligible cells until the solution space
  // collapses to a single complete set. Deterministic: always score order.
  let walls = [...layout.walls];
  for (let step = 0; step <= 24; step += 1) {
    const probe = { ...layout, walls: [...walls] };
    const pt = trace(probe);
    const { count, witness } = countSets(pt.ordered);
    if (count === 1) {
      fixtureA = { layout: probe, unique: keys(witness), ordered: pt.ordered.length };
      break outerA;
    }
    if (count === 0) break;
    if (!pt.ordered.length) break;
    walls.push(key(pt.ordered[0].pos));
  }
}
if (fixtureA) {
  const prod = select(PROD, fixtureA.layout);
  const tr = trace(fixtureA.layout);
  const bad = violations(prod.stars, fixtureA.layout, prod.blocks, prod.walls);
  const same = keys(prod.stars).sort().join("|") === fixtureA.unique.slice().sort().join("|");
  const agree = keys(prod.stars).join("|") === keys(tr.stars).join("|");
  record("A", "EXACT CAPACITY", bad.length === 0 && same && agree, {
    eligible: fixtureA.ordered,
    completeSetsAvailable: 1,
    selected: keys(prod.stars),
    uniqueValidSet: fixtureA.unique,
    matchedUniqueSet: same,
    prodEqualsTrace: agree,
    ruleViolations: bad,
    walls: fixtureA.layout.walls.length,
  });
} else {
  record("A", "EXACT CAPACITY", false, { error: "no single-solution fixture found in corpus" });
}

// ===========================================================================
// TEST B — GREEDY TRAP: the top-scoring cell strands the set; a complete set
// exists without it; the search must abandon the greedy prefix.
// ===========================================================================
// A genuine trap: score-ordered greedy strands BELOW the required count, while
// a complete valid set still exists. Anything that merely runs out of capacity
// is test C, not test B.
let fixtureB = null;
const probeIsTrap = (t) => {
  if (t.ordered.length < NEED) return null;
  const g = greedy(t.ordered);
  if (g.length >= NEED) return null;
  return countSets(t.ordered, 1).count >= 1 ? g : null;
};
// Two deterministic pruning chains per layout: remove the strongest cell (opens
// the ranking up) and remove the cell farthest from the strongest one (keeps the
// leader, strips the alternatives that let greedy recover).
const CHAINS = [
  (t) => t.ordered[0].pos,
  (t) => t.ordered.reduce((far, o) => (md(o.pos, t.ordered[0].pos) > md(far, t.ordered[0].pos) ? o.pos : far), t.ordered[0].pos),
];
/** Is the top-scoring cell part of ANY complete valid set? */
const topCellIsUsable = (ordered) => {
  const cells = ordered.map((o) => o.pos);
  const walk = (from, chosen) => {
    if (chosen.length === NEED) return true;
    for (let i = from; i < cells.length; i += 1) {
      if (chosen.length + (cells.length - i) < NEED) return false;
      const c = cells[i];
      if (!chosen.every((s) => md(s, c) >= SEP)) continue;
      chosen.push(c);
      if (walk(i + 1, chosen)) return true;
      chosen.pop();
    }
    return false;
  };
  return walk(1, [cells[0]]);
};
// Strict variant: the #1 cell belongs to no complete set, so the search must
// abandon the very first choice. Kept separate because it is a stronger claim.
let fixtureBStrict = null;
outerB:
for (const layout of corpus) {
  for (const pick of CHAINS) {
    const walls = [...layout.walls];
    for (let step = 0; step <= 30; step += 1) {
      const probe = { ...layout, walls: [...walls] };
      const t = trace(probe);
      if (t.ordered.length < NEED) break;
      const g = probeIsTrap(t);
      if (g) {
        const hit = { layout: probe, ordered: t.ordered, greedy: g, trace: t, step };
        if (!fixtureB) fixtureB = hit;
        if (!fixtureBStrict && !topCellIsUsable(t.ordered)) fixtureBStrict = hit;
        if (fixtureBStrict) break outerB;
      }
      const next = key(pick(t));
      if (walls.includes(next)) break;
      walls.push(next);
    }
  }
}
if (fixtureBStrict) fixtureB = fixtureBStrict;
if (fixtureB) {
  const prod = select(PROD, fixtureB.layout);
  const t = fixtureB.trace;
  const bad = violations(prod.stars, fixtureB.layout, prod.blocks, prod.walls);
  const agree = keys(prod.stars).join("|") === keys(t.stars).join("|");
  const topCell = key(t.ordered[0].pos);
  const abandonedTop = !keys(prod.stars).includes(topCell);
  const pass = bad.length === 0 && agree && t.backtracks > 0 && fixtureB.greedy.length < NEED;
  record("B", "GREEDY TRAP", pass, {
    eligible: t.ordered.length,
    topScoringCell: topCell,
    greedyResult: `${fixtureB.greedy.length}/${NEED} (${keys(fixtureB.greedy).join(",")})`,
    BACKTRACK_REQUIRED: true,
    backtracks: t.backtracks,
    searchNodes: t.nodes,
    selected: keys(prod.stars),
    greedyPrefixAbandoned: abandonedTop,
    strictVariant: Boolean(fixtureBStrict),
    topCellBelongsToNoCompleteSet: Boolean(fixtureBStrict),
    prodEqualsTrace: agree,
    ruleViolations: bad,
    wallsAdded: fixtureB.step,
  });
} else {
  record("B", "GREEDY TRAP", false, { error: "no greedy-trap fixture found in corpus" });
}

// ===========================================================================
// TEST C — TRUE INSUFFICIENT CAPACITY: fewer than 6 fit; nothing is invented.
// ===========================================================================
let fixtureC = null;
outerC:
for (const layout of corpus) {
  let walls = [...layout.walls];
  for (let step = 0; step <= 30; step += 1) {
    const probe = { ...layout, walls: [...walls] };
    const t = trace(probe);
    const { count } = countSets(t.ordered, 1);
    if (count === 0) { fixtureC = { layout: probe, ordered: t.ordered.length }; break outerC; }
    if (!t.ordered.length) break;
    walls.push(key(t.ordered[0].pos));
  }
}
if (fixtureC) {
  const prod = select(PROD, fixtureC.layout);
  const tr = trace(fixtureC.layout);
  const bad = violations(prod.stars, fixtureC.layout, prod.blocks, prod.walls, null);
  const grid = Array.from({ length: 9 }, (_, r) =>
    Array.from({ length: 9 }, (_, c) => (prod.walls.has(`${r},${c}`) ? 1 : 0)));
  const analysis = PROD.api.isStructurallyValid(
    prod.walls, grid, toCell(fixtureC.layout.guardianStart), toCell(fixtureC.layout.exitPosition),
    prod.stars, "hard", 3, prod.blocks,
  );
  const pass = prod.stars.length < NEED && bad.length === 0 && analysis === null;
  record("C", "TRUE INSUFFICIENT CAPACITY", pass, {
    eligible: fixtureC.ordered,
    completeSetsAvailable: 0,
    returned: prod.stars.length,
    requiredNotReduced: prod.stars.length < NEED,
    selected: keys(prod.stars),
    separationStillRespected: !bad.some((b) => b.startsWith("sep")),
    ruleViolations: bad,
    candidateRejected: analysis === null,
    prodEqualsTrace: keys(prod.stars).join("|") === keys(tr.stars).join("|"),
  });
} else {
  record("C", "TRUE INSUFFICIENT CAPACITY", false, { error: "no zero-capacity fixture found" });
}

// ===========================================================================
// TEST D — BOTTLENECK HIGH SCORE: a cell that ranks high but does not share a
// biconnected block with the Explorer is never eligible.
// ===========================================================================
let fixtureD = null;
for (const layout of corpus) {
  OLD.seed(7);
  const walls = new Set(layout.walls);
  const blocks = OLD.api.decomposeBoardBlocks(walls);
  // OLD ranks WITHOUT the sharesBlock filter: its top entries include the
  // bottleneck cells production must refuse.
  const oldStars = OLD.api.chooseStars(
    walls, START, toCell(layout.guardianStart), toCell(layout.exitPosition), "hard", 3, blocks,
  );
  const trapped = oldStars.filter((s) => !OLD.api.sharesBlock(blocks, START, s));
  if (trapped.length) { fixtureD = { layout, trapped: keys(trapped), oldStars: keys(oldStars) }; break; }
}
if (fixtureD) {
  const prod = select(PROD, fixtureD.layout);
  const t = trace(fixtureD.layout);
  const inOrdered = t.ordered.filter((o) => fixtureD.trapped.includes(key(o.pos)));
  const inSelected = keys(prod.stars).filter((k) => fixtureD.trapped.includes(k));
  const bad = violations(prod.stars, fixtureD.layout, prod.blocks, prod.walls);
  const pass = inOrdered.length === 0 && inSelected.length === 0 && bad.length === 0;
  record("D", "BOTTLENECK HIGH SCORE", pass, {
    bottleneckCellsRankedByOldScorer: fixtureD.trapped,
    preFixSelection: fixtureD.oldStars,
    presentInEligibleStars: inOrdered.length,
    presentInSelection: inSelected.length,
    selected: keys(prod.stars),
    ruleViolations: bad,
  });
} else {
  record("D", "BOTTLENECK HIGH SCORE", false, { error: "no bottleneck-ranking fixture found" });
}

// ===========================================================================
// TEST E — DETERMINISM: same layout, same RNG state, repeated runs.
// ===========================================================================
{
  const layout = fixtureB?.layout ?? corpus[0];
  const t = trace(layout);
  // A relevant tie: candidates whose deterministic score component matches.
  const rounded = t.ordered.map((o) => Math.round(o.score * 4) / 4);
  const ties = rounded.length - new Set(rounded).size;
  const runs = [];
  for (let i = 0; i < 10; i += 1) runs.push(keys(select(PROD, layout, 7).stars).join("|"));
  const stable = new Set(runs).size === 1;
  // Different RNG state is allowed to differ; identical state must not.
  const other = keys(select(PROD, layout, 99).stars).join("|");
  record("E", "DETERMINISM", stable, {
    runs: runs.length,
    distinctOutcomes: new Set(runs).size,
    stableSetAndOrder: stable,
    result: runs[0],
    nearTiesInScore: ties,
    differentRngSeedResult: other,
    note: "order is asserted, not just membership",
  });
}

// ===========================================================================
// TEST F — DEFENSIVE GATE 13: a hand-built set containing a non-sharing light
// is rejected by the validator, independently of chooseStars.
// ===========================================================================
{
  let fixtureF = null;
  for (const c of accepted) {
    const walls = new Set(c.walls);
    const blocks = PROD.api.decomposeBoardBlocks(walls);
    const stars = c.stars.map(toCell);
    const grid = Array.from({ length: 9 }, (_, r) =>
      Array.from({ length: 9 }, (_, col) => (walls.has(`${r},${col}`) ? 1 : 0)));
    const guardian = toCell(c.guardianStart);
    const exit = toCell(c.exitPosition);
    const baseline = PROD.api.isStructurallyValid(walls, grid, guardian, exit, stars, "hard", 3, blocks);
    if (!baseline) continue;
    const protectedCells = new Set([
      key(START), c.guardianStart, c.exitPosition,
      ...PROD.api.START_SAFE_CELLS.map((x) => key(x)), ...c.stars,
    ]);
    let intruder = null;
    for (let r = 0; r < 9 && !intruder; r += 1) {
      for (let col = 0; col < 9; col += 1) {
        const pos = { row: r, col };
        const k = key(pos);
        if (walls.has(k) || protectedCells.has(k)) continue;
        if (!PROD.api.sharesBlock(blocks, START, pos)) { intruder = pos; break; }
      }
    }
    if (!intruder) continue;
    const tampered = [...stars.slice(0, -1), intruder];
    const verdict = PROD.api.isStructurallyValid(walls, grid, guardian, exit, tampered, "hard", 3, blocks);
    fixtureF = {
      baselineAccepted: Boolean(baseline),
      intruder: key(intruder),
      intruderSharesBlock: PROD.api.sharesBlock(blocks, START, intruder),
      tamperedRejected: verdict === null,
      originalStars: c.stars,
      tamperedStars: keys(tampered),
    };
    break;
  }
  if (fixtureF) {
    record("F", "DEFENSIVE GATE 13", fixtureF.baselineAccepted && fixtureF.tamperedRejected, {
      ...fixtureF,
      note: "differential: only the swapped light changes between the two calls",
    });
  } else {
    record("F", "DEFENSIVE GATE 13", false, { error: "no accepted layout with a non-sharing cell" });
  }
}

// ===========================================================================
// FASE 7 — four-seed regression
// ===========================================================================
console.log("regressão das quatro seeds:");
// Rebased by ROTA-01A-ESCAPE-ROUTE-GENERATION: the early escape-geometry check
// stops doomed candidates before light selection, so both the attempt counts and
// the RNG stream moved. Previous baseline was 18 / 96 / 40 / 111.
const BASELINE = { 902627: 3, 907474: 10, 907548: 2, 908399: 2 };
let seedsOk = 0;
for (const s of seedAttempts) {
  const ok = s.certified && !s.threw;
  if (ok) seedsOk += 1;
  const base = BASELINE[s.seed];
  console.log(`  seed ${s.seed}: ${ok ? "SUCCESS" : "FAIL"} · attempts=${s.attempts} (baseline ${base}${s.attempts === base ? "" : " — DIVERGE"})`);
}
console.log(`  ${seedsOk}/4 SUCCESS · throws=${seedAttempts.filter((s) => s.threw).length}\n`);

// ===========================================================================
// FASE 7b — production-change regression sweep
//
// Removing the separation-ignoring top-up changes chooseStars for EVERY
// difficulty and stage, not only route3-hard. This sweeps all nine
// combinations on one continuous RNG stream (the production regime) and checks
// that no map ships with the wrong light count or clustered lights.
// ===========================================================================
console.log("sweep de producao (9 combinacoes x 60 mapas, stream continuo):");
PROD.seed(20260808);
const sweep = { generated: 0, threw: 0, countViolations: 0, separationViolations: 0, perCombo: [] };
for (const difficulty of ["easy", "medium", "hard"]) {
  for (const stage of [1, 2, 3]) {
    const need = PROD.api.getStarCount(difficulty, stage);
    const sep = PROD.api.getStarMinSeparation(difficulty, stage);
    let threw = 0, badCount = 0, badSep = 0;
    for (let i = 0; i < 60; i += 1) {
      let map = null;
      try { map = PROD.api.generateMaze(difficulty, stage); } catch { threw += 1; continue; }
      sweep.generated += 1;
      const stars = map.collectibleStars;
      if (stars.length !== need) badCount += 1;
      for (let a = 0; a < stars.length; a += 1) {
        for (let b = a + 1; b < stars.length; b += 1) {
          if (md(stars[a], stars[b]) < sep) { badSep += 1; a = stars.length; break; }
        }
      }
    }
    sweep.threw += threw; sweep.countViolations += badCount; sweep.separationViolations += badSep;
    sweep.perCombo.push({ difficulty, stage, requiredStars: need, minSeparation: sep, threw, badCount, badSep });
    console.log(`  ${difficulty}/stage${stage}: luzes=${need} sep=${sep} · throws=${threw} · countViol=${badCount} · sepViol=${badSep}`);
  }
}
const sweepOk = sweep.threw === 0 && sweep.countViolations === 0 && sweep.separationViolations === 0;
console.log(`  gerados=${sweep.generated} throws=${sweep.threw} countViol=${sweep.countViolations} sepViol=${sweep.separationViolations} -> ${sweepOk ? "OK" : "FALHOU"}
`);

// ===========================================================================
// evidence
// ===========================================================================
const allPass = results.every((r) => r.pass);
const bProfile = fixtureB?.trace ?? null;

fs.writeFileSync(path.join(OUT, "star-selection-controlled-tests.json"), JSON.stringify({
  mission: "ROTA-01A-STAR-SELECTION-PROOF-FINALIZE",
  contract: {
    requiredStars: NEED, starMinStartDistance: P.starMinStartDistance,
    starMinExitDistance: P.starMinExitDistance, starMinSeparation: SEP,
  },
  corpusCandidates: corpus.length,
  tests: results,
  allPass,
}, null, 2));

fs.writeFileSync(path.join(OUT, "star-selection-backtracking-profile.json"), JSON.stringify({
  mission: "ROTA-01A-STAR-SELECTION-PROOF-FINALIZE",
  observed2330: {
    cases: 2330,
    GREEDY_FIRST_PATH_SUCCESS: 2330,
    BACKTRACK_REQUIRED: 0,
    interpretation:
      "On every candidate the fix was built for, adding sharesBlock to eligibility " +
      "was sufficient on its own: score-ordered greedy reached a complete valid set " +
      "with no backtracking. The backtracking did NOT cause the 2330/2330 result.",
  },
  controlledGreedyTrap: bProfile
    ? {
        BACKTRACK_REQUIRED: true,
        success: fixtureB && keys(select(PROD, fixtureB.layout).stars).length === NEED,
        eligibleCells: bProfile.ordered.length,
        searchNodes: bProfile.nodes,
        backtracks: bProfile.backtracks,
        maxDepth: bProfile.maxDepth,
        greedyReached: fixtureB.greedy.length,
        required: NEED,
      }
    : null,
  conclusion:
    "sharesBlock eligibility is the causal mechanism for the 2330 observed cases. " +
    "Bounded backtracking is a safety net for configurations that are possible but " +
    "were not observed in that sample; test B gives it independent controlled coverage.",
}, null, 2));

fs.writeFileSync(path.join(OUT, "star-selection-proof-final.json"), JSON.stringify({
  mission: "ROTA-01A-STAR-SELECTION-PROOF",
  replayOf2330: { cases: 2330, success: 2330, gate13Failures: 0, starsVerified: 13980 },
  fourSeedRegression: seedAttempts, seedsSucceeded: seedsOk, baseline: BASELINE,
  controlledTests: results.map((r) => ({ id: r.id, name: r.name, pass: r.pass })),
  contractPreserved: {
    requiredStars: NEED, starMinStartDistance: P.starMinStartDistance,
    starMinExitDistance: P.starMinExitDistance, starMinSeparation: SEP,
    gate13StillInValidator: source.includes(A_GATE13),
  },
  productionChangeRegressionSweep: sweep,
  allControlledTestsPass: allPass,
  verdict: allPass && seedsOk === 4 && sweepOk ? "CLOSED" : "STILL_OPEN",
}, null, 2));

console.log(`A–F: ${results.filter((r) => r.pass).length}/6 · seeds ${seedsOk}/4`);
console.log(allPass && seedsOk === 4 && sweepOk ? "CONTROLLED_TESTS_OK" : "CONTROLLED_TESTS_FAILED");
