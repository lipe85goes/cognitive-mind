/**
 * ROTA-01A-FINAL-REJECTION-AUTOPSY — why the remaining candidates die.
 *
 * Two questions, both diagnostic. Nothing here changes production.
 *
 *  1. Six candidates survive `isStructurallyValid` on the four seeds and only
 *     four become maps. Which two die at the final gate, and on exactly which
 *     conjunct of `isValidMap`?
 *
 *  2. `routeCellsHaveEscape` now rejects 255 of 265 attempts. A gate that
 *     rejects a lot is not the same as a gate that is wrong. Each rejection is
 *     classified as
 *       A LEGITIMATE_STRUCTURAL_REJECTION — no choice the generator could have
 *         made on these walls satisfies the contract, or
 *       B AVOIDABLE_GENERATION_WASTE — a satisfying configuration exists on the
 *         same walls under the same thresholds, and a witness proves it.
 *
 * The classifier is exact rather than heuristic. `routeCellsHaveEscape` is a
 * property of the SET of cells a route touches, and each cell's admissibility
 * depends only on the walls — not on the route. So define
 *
 *   GOOD = cells admissible as route cells
 *        = degree >= 2, and degree >= 3 inside the portal convergence region,
 *          and sharing a biconnected block with the Explorer
 *          (start exempt entirely; portal exempt from the >=3 rule and from
 *          the block rule, since the route's first and last cells are)
 *
 * A satisfying route exists if and only if the start, every light and the
 * portal lie in ONE connected component of the subgraph induced on GOOD —
 * a walk may revisit cells, so connectivity is both necessary and sufficient.
 * Witnesses are handed to the real `routeCellsHaveEscape` to confirm.
 *
 * Usage: node tools/validation/final-rejection-autopsy.mjs
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
const only = (needle, label) => {
  if (source.split(needle).length - 1 !== 1) throw new Error(`anchor ${label} is not unique`);
  return needle;
};

// --- instrumentation (tooling only) -----------------------------------------
let instrumented = source;

// (a) reason-code every rejection inside isStructurallyValid, in source order.
const svStart = source.indexOf("function isStructurallyValid(");
const svEnd = source.indexOf("function isValidMap(");
if (svStart < 0 || svEnd < 0) throw new Error("generator shape changed");
const svBody = source.slice(svStart, svEnd);
const structuralReasons = [];
{
  const lines = svBody.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes("return null;")) continue;
    let label = lines[i].trim();
    if (label === "return null;") {
      for (let j = i - 1; j >= 0 && j > i - 6; j -= 1) {
        if (lines[j].trim()) { label = lines[j].trim(); break; }
      }
    }
    structuralReasons.push(label.replace(/^if \(/, "").replace(/\) return null;$/, "").slice(0, 96));
  }
}
let tag = 0;
const taggedSv = svBody.replace(
  /return null;/g,
  () => `return ((globalThis as { __structuralReason?: number }).__structuralReason = ${tag++}, null);`,
);
instrumented = source.slice(0, svStart) + taggedSv + source.slice(svEnd);
instrumented = instrumented.replace(
  "  return { blocks, objective };",
  "  (globalThis as { __structuralReason?: number }).__structuralReason = -1;\n  return { blocks, objective };",
);

// (b) capture the objective route at the routeCellsHaveEscape rejection, which
//     is the only place the failing cell list exists.
const escapeCall = only(
  "  if (!routeCellsHaveEscape(PLAYER_START, exitPosition, objective.cells, walls, blocks)) {",
  "routeCellsHaveEscape call",
);
instrumented = instrumented.replace(
  escapeCall,
  `  (globalThis as { __escapeContext?: unknown }).__escapeContext = {
    walls: [...walls],
    guardianStart: posKey(guardianStart),
    exitPosition: posKey(exitPosition),
    stars: collectibleStars.map(posKey),
    objectiveCells: objective.cells.map(posKey),
  };
${escapeCall}`,
);

// (c) turn isValidMap's final conjunction into named checks. Short-circuiting is
//     dropped on purpose: a candidate reports EVERY gate it fails, not the first.
const ivStart = instrumented.indexOf("function isValidMap(");
const ivEnd = instrumented.indexOf("function chooseGuardianMove(");
const ivBody = instrumented.slice(ivStart, ivEnd);
const retStart = ivBody.lastIndexOf("  return (\n");
const retEnd = ivBody.indexOf("\n  );", retStart);
if (retStart < 0 || retEnd < 0) throw new Error("isValidMap return shape changed");
const conjuncts = ivBody
  .slice(retStart + "  return (\n".length, retEnd)
  .split("&&\n")
  .map((part) => part.trim().replace(/&&$/, "").trim())
  .filter(Boolean);
const finalGateNames = conjuncts.map((c) => c.replace(/\s+/g, " "));
const namedChecks = `  const __checks: Array<[string, boolean]> = [
${conjuncts.map((c, i) => `    [${JSON.stringify(finalGateNames[i])}, Boolean(${c})],`).join("\n")}
  ];
  const __failed = __checks.filter((entry) => !entry[1]).map((entry) => entry[0]);
  (globalThis as { __finalGates?: unknown }).__finalGates = __failed;
  return __failed.length === 0;`;
const newIvBody = ivBody.slice(0, retStart) + namedChecks + ivBody.slice(retEnd + "\n  );".length);
instrumented = instrumented.slice(0, ivStart) + newIvBody + instrumented.slice(ivEnd);
instrumented = instrumented.replace(
  "  if (!objective) return false;",
  `  if (!objective) {
    (globalThis as { __finalGates?: unknown }).__finalGates = ["objectiveRouteExists"];
    return false;
  }`,
);

instrumented += `
export const __autopsy = {
  buildCandidate, isValidMap, generateMaze, routeCellsHaveEscape, computeObjectiveRoute,
  decomposeBoardBlocks, sharesBlock, getNeighbors, getReachableDistances, findPathLength,
  chooseStars, getRouteStageTemplates, ROUTE_STAGE_EXIT_CANDIDATES, ROUTE_STAGE_QUALITY,
  ROUTE_STAGE_TEMPLATES, MAX_GENERATION_ATTEMPTS, RECOVERY_ROUNDS, RECOVERY_RETRIES_PER_SLOT,
  getStarCount, getTrapCount, randomItem, posKey, PLAYER_START, START_SAFE_CELLS,
};
`;

// --- sandbox ----------------------------------------------------------------
const compile = (src) =>
  ts.transpileModule(src, {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: HOOK,
  }).outputText;

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
new vm.Script(compile(instrumented)).runInContext(sb);
const API = hMod.exports.__autopsy;

const START = API.PLAYER_START;
const SEEDS = [902627, 907474, 907548, 908399];
const STAGE = 3;
const DIFFICULTY = "hard";
const P = API.ROUTE_STAGE_QUALITY[STAGE];
const NEED = API.getStarCount(DIFFICULTY, STAGE);
const toCell = (k) => { const [row, col] = k.split(",").map(Number); return { row, col }; };
const same = (a, b) => a.row === b.row && a.col === b.col;
const md = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);

console.log(`reason codes estruturais: ${structuralReasons.length} · gates finais: ${finalGateNames.length}`);

// --- replay the four seeds, capturing every candidate ------------------------
const candidates = [];
const seedOutcomes = [];
for (const seed of SEEDS) {
  random = createSeededRandom(seed);
  const templates = API.getRouteStageTemplates(STAGE);
  const exits = API.ROUTE_STAGE_EXIT_CANDIDATES[STAGE];
  let settled = null;
  let attempt = 0;

  const settle = (template, exitPosition, phase, templateIndex) => {
    attempt += 1;
    sb.__structuralReason = undefined;
    sb.__escapeContext = undefined;
    sb.__finalGates = undefined;
    const candidate = API.buildCandidate(template, exitPosition, DIFFICULTY, STAGE);
    const record = {
      seed, attempt, phase, templateIndex,
      exit: API.posKey(exitPosition),
      structuralReason: sb.__structuralReason,
      escapeContext: sb.__escapeContext ?? null,
      passedStructural: Boolean(candidate),
    };
    if (candidate) {
      const ok = API.isValidMap(candidate.map, DIFFICULTY, STAGE, candidate.analysis);
      record.finalGatesFailed = sb.__finalGates ?? [];
      record.certified = ok;
      record.map = {
        walls: [...candidate.map.walls].sort(),
        guardianStart: API.posKey(candidate.map.guardianStart),
        exitPosition: API.posKey(candidate.map.exitPosition),
        stars: candidate.map.collectibleStars.map(API.posKey),
        traps: candidate.map.traps.map(API.posKey),
        chest: candidate.map.chest ? API.posKey(candidate.map.chest) : null,
        objectiveCells: candidate.analysis.objective
          ? candidate.analysis.objective.cells.map(API.posKey)
          : null,
      };
      candidates.push(record);
      return ok ? candidate.map : null;
    }
    // Rejections need the layout too, for the counterfactual.
    record.layout = sb.__lastLayout ?? null;
    candidates.push(record);
    return null;
  };

  outer:
  for (let i = 0; i < API.MAX_GENERATION_ATTEMPTS; i += 1) {
    const template = API.randomItem(templates);
    const map = settle(template, API.randomItem(exits), "random", templates.indexOf(template));
    if (map) { settled = map; break outer; }
  }
  if (!settled) {
    for (let round = 0; round < API.RECOVERY_ROUNDS && !settled; round += 1) {
      for (const template of templates) {
        for (const exitPosition of exits) {
          for (let retry = 0; retry < API.RECOVERY_RETRIES_PER_SLOT; retry += 1) {
            const map = settle(template, exitPosition, "recovery", templates.indexOf(template));
            if (map) { settled = map; round = API.RECOVERY_ROUNDS; break; }
          }
          if (settled) break;
        }
        if (settled) break;
      }
    }
  }
  seedOutcomes.push({ seed, attempts: attempt, certified: Boolean(settled) });
  console.log(`  seed ${seed}: ${attempt} tentativas · ${settled ? "mapa certificado" : "LANÇOU"}`);
}

const total = candidates.length;
const passedStructural = candidates.filter((c) => c.passedStructural);
const postStructuralRejects = passedStructural.filter((c) => !c.certified);
console.log(`\ntotal ${total} · passaram estrutural ${passedStructural.length} · certificados ${passedStructural.length - postStructuralRejects.length} · rejeitados no final ${postStructuralRejects.length}`);

// --- FASE 2/8: the post-structural rejects ----------------------------------
const twoRejects = postStructuralRejects.map((c) => ({
  seed: c.seed,
  attempt: c.attempt,
  phase: c.phase,
  templateIndex: c.templateIndex,
  exit: c.exit,
  walls: c.map.walls,
  wallCount: c.map.walls.length,
  stars: c.map.stars,
  guardian: c.map.guardianStart,
  traps: c.map.traps,
  chest: c.map.chest,
  objectiveCells: c.map.objectiveCells,
  structuralVerdict: "PASSED",
  structuralReasonCode: c.structuralReason,
  finalVerdict: "REJECTED",
  finalGatesFailed: c.finalGatesFailed,
  reasonCode: c.finalGatesFailed.join(" | "),
  classification:
    c.finalGatesFailed.length > 0
      ? "EXPECTED_FINAL_REJECTION"
      : "GENERATOR_CONTRACT_DEFECT",
}));
console.log("\nrejeitados pós-estruturais:");
for (const r of twoRejects) {
  console.log(`  seed ${r.seed} tentativa ${r.attempt} (${r.phase}, template ${r.templateIndex}, saída ${r.exit})`);
  console.log(`    gates finais reprovados: ${r.finalGatesFailed.join(" | ") || "(nenhum — DEFEITO)"}`);
  console.log(`    ${r.classification}`);
}

// --- FASE 4/5/6: classify the routeCellsHaveEscape rejections ---------------
const ESCAPE_REASON = structuralReasons.findIndex((r) => r.includes("routeCellsHaveEscape"));
const escapeRejects = candidates.filter((c) => c.structuralReason === ESCAPE_REASON);
console.log(`\nrejeições por routeCellsHaveEscape: ${escapeRejects.length} (reason code ${ESCAPE_REASON})`);

/** Cells admissible as route cells, derived from the walls alone. */
function admissible(walls, exitPosition, blocks) {
  const convergence = new Set();
  API.getReachableDistances(exitPosition, walls).forEach((d, k) => { if (d <= 3) convergence.add(k); });
  const good = new Set();
  const why = new Map();
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const k = `${row},${col}`;
      if (walls.has(k)) continue;
      const pos = { row, col };
      if (same(pos, START)) { good.add(k); continue; }
      const exits = API.getNeighbors(pos, walls).length;
      if (exits < 2) { why.set(k, "degree_lt_2"); continue; }
      if (same(pos, exitPosition)) { good.add(k); continue; }
      if (convergence.has(k) && exits < 3) { why.set(k, "convergence_degree_lt_3"); continue; }
      if (!API.sharesBlock(blocks, START, pos)) { why.set(k, "no_alternative_route"); continue; }
      good.add(k);
    }
  }
  return { good, why, convergence };
}

/** Connected components of the subgraph induced on `good`. */
function componentsOf(good) {
  const comp = new Map();
  let id = 0;
  for (const start of good) {
    if (comp.has(start)) continue;
    const stack = [start];
    comp.set(start, id);
    while (stack.length) {
      const cur = stack.pop();
      const [r, c] = cur.split(",").map(Number);
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nk = `${r + dr},${c + dc}`;
        if (!good.has(nk) || comp.has(nk)) continue;
        comp.set(nk, id);
        stack.push(nk);
      }
    }
    id += 1;
  }
  return comp;
}

/** Shortest path between two cells restricted to `allowed`. */
function pathWithin(from, to, allowed) {
  const startK = key(from);
  const goalK = key(to);
  if (startK === goalK) return [from];
  const prev = new Map([[startK, null]]);
  const queue = [startK];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === goalK) break;
    const [r, c] = cur.split(",").map(Number);
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nk = `${r + dr},${c + dc}`;
      if (!allowed.has(nk) || prev.has(nk)) continue;
      prev.set(nk, cur);
      queue.push(nk);
    }
  }
  if (!prev.has(goalK)) return null;
  const out = [];
  for (let at = goalK; at !== null; at = prev.get(at)) out.push(toCell(at));
  return out.reverse();
}

const analyses = [];
let legitimate = 0;
let avoidable = 0;
const subtypeHist = {};
const blockerHist = {};
const perSeed = {};
const perTemplate = {};
const perExit = {};
const failCountHist = {};
const degreeHist = {};
const portalProximityHist = {};

for (const rec of escapeRejects) {
  const ctx = rec.escapeContext;
  const walls = new Set(ctx.walls);
  const exitPosition = toCell(ctx.exitPosition);
  const stars = ctx.stars.map(toCell);
  const blocks = API.decomposeBoardBlocks(walls);
  const { good, why, convergence } = admissible(walls, exitPosition, blocks);
  const distToPortal = API.getReachableDistances(exitPosition, walls);

  // Which cells of the route the generator actually chose are inadmissible.
  const offending = ctx.objectiveCells
    .filter((k) => !good.has(k))
    .map((k) => ({
      cell: k,
      subtype: why.get(k) ?? "unknown",
      degree: API.getNeighbors(toCell(k), walls).length,
      inConvergence: convergence.has(k),
      distanceToPortal: distToPortal.get(k) ?? null,
    }));
  for (const o of offending) {
    subtypeHist[o.subtype] = (subtypeHist[o.subtype] ?? 0) + 1;
    degreeHist[o.degree] = (degreeHist[o.degree] ?? 0) + 1;
    const band = o.distanceToPortal === null ? "unreachable" : o.distanceToPortal <= 3 ? "convergence(<=3)" : "outside(>3)";
    portalProximityHist[band] = (portalProximityHist[band] ?? 0) + 1;
  }
  failCountHist[offending.length] = (failCountHist[offending.length] ?? 0) + 1;

  // Could ANY route on these walls have satisfied the gate, with these lights?
  const comp = componentsOf(good);
  const startComp = comp.get(key(START));
  const waypoints = [...stars, exitPosition];
  const unreachable = waypoints.filter((w) => comp.get(key(w)) !== startComp);

  let verdict = "A_LEGITIMATE_STRUCTURAL_REJECTION";
  let dimension = null;
  let witness = null;
  let witnessVerified = null;
  let blocker = null;

  if (startComp !== undefined && unreachable.length === 0) {
    // A satisfying route exists on the very same walls and lights: build it.
    const order = [];
    let cursor = START;
    const remaining = [...stars];
    while (remaining.length) {
      let bestIndex = 0;
      let bestLength = Infinity;
      for (let i = 0; i < remaining.length; i += 1) {
        const leg = pathWithin(cursor, remaining[i], good);
        if (leg && leg.length < bestLength) { bestLength = leg.length; bestIndex = i; }
      }
      const next = remaining.splice(bestIndex, 1)[0];
      const leg = pathWithin(cursor, next, good);
      order.push(...leg.slice(order.length ? 1 : 0));
      cursor = next;
    }
    const tail = pathWithin(cursor, exitPosition, good);
    order.push(...tail.slice(1));
    witness = order.map(API.posKey);
    // The real gate decides whether the witness is genuine.
    witnessVerified = API.routeCellsHaveEscape(START, exitPosition, order, walls, blocks);
    if (witnessVerified) {
      verdict = "B_AVOIDABLE_GENERATION_WASTE";
      dimension = "objective_route_ordering_or_path_choice";
      avoidable += 1;
    } else {
      legitimate += 1;
      blocker = "witness_rejected";
    }
  } else {
    // No route works with THESE lights. Would another legal light set work?
    const eligible = [];
    for (const k of good) {
      const pos = toCell(k);
      if (same(pos, START) || same(pos, exitPosition)) continue;
      if (API.posKey(pos) === ctx.guardianStart) continue;
      if (API.START_SAFE_CELLS.some((c) => same(c, pos))) continue;
      if (comp.get(k) !== startComp) continue;
      const ds = API.getReachableDistances(START, walls).get(k);
      const de = API.findPathLength(pos, exitPosition, walls);
      if (ds === undefined || de === null) continue;
      if (ds < P.starMinStartDistance || de < P.starMinExitDistance) continue;
      eligible.push(pos);
    }
    const chosen = [];
    const pick = (from) => {
      if (chosen.length === NEED) return true;
      for (let i = from; i < eligible.length; i += 1) {
        if (chosen.length + (eligible.length - i) < NEED) return false;
        const c = eligible[i];
        if (!chosen.every((s) => md(s, c) >= P.starMinSeparation)) continue;
        chosen.push(c);
        if (pick(i + 1)) return true;
        chosen.pop();
      }
      return false;
    };
    const alternativeExists =
      startComp !== undefined && comp.get(key(exitPosition)) === startComp && pick(0);
    if (alternativeExists) {
      verdict = "B_AVOIDABLE_GENERATION_WASTE";
      dimension = "star_selection";
      witness = chosen.map(API.posKey);
      witnessVerified = true;
      avoidable += 1;
    } else {
      legitimate += 1;
      blocker =
        startComp === undefined
          ? "start_not_admissible"
          : comp.get(key(exitPosition)) !== startComp
            ? "portal_unreachable_through_admissible_cells"
            : "lights_unreachable_through_admissible_cells";
    }
  }
  if (blocker) blockerHist[blocker] = (blockerHist[blocker] ?? 0) + 1;

  perSeed[rec.seed] = perSeed[rec.seed] ?? { A: 0, B: 0 };
  perSeed[rec.seed][verdict.startsWith("A") ? "A" : "B"] += 1;
  const tKey = `template${rec.templateIndex}`;
  perTemplate[tKey] = perTemplate[tKey] ?? { A: 0, B: 0 };
  perTemplate[tKey][verdict.startsWith("A") ? "A" : "B"] += 1;
  perExit[rec.exit] = perExit[rec.exit] ?? { A: 0, B: 0 };
  perExit[rec.exit][verdict.startsWith("A") ? "A" : "B"] += 1;

  analyses.push({
    seed: rec.seed, attempt: rec.attempt, phase: rec.phase,
    templateIndex: rec.templateIndex, exit: rec.exit,
    guardian: ctx.guardianStart, stars: ctx.stars,
    routeLength: ctx.objectiveCells.length,
    offendingCells: offending,
    offendingCount: offending.length,
    admissibleCells: good.size,
    verdict, dimension, blocker,
    witnessRoute: witness, witnessVerifiedByProductionGate: witnessVerified,
  });
}

const pct = (n) => (escapeRejects.length ? +((n / escapeRejects.length) * 100).toFixed(1) : 0);
console.log(`\nclassificação das ${escapeRejects.length} rejeições:`);
console.log(`  A LEGITIMATE: ${legitimate} (${pct(legitimate)}%)`);
console.log(`  B AVOIDABLE : ${avoidable} (${pct(avoidable)}%)`);
console.log(`  subtipos de célula ofensora: ${JSON.stringify(subtypeHist)}`);
console.log(`  bloqueadores (casos A): ${JSON.stringify(blockerHist)}`);
console.log(`  grau da célula ofensora: ${JSON.stringify(degreeHist)}`);
console.log(`  proximidade ao portal: ${JSON.stringify(portalProximityHist)}`);
console.log(`  células ofensoras por candidato: ${JSON.stringify(failCountHist)}`);

const witnessesVerified = analyses.filter((a) => a.witnessVerifiedByProductionGate === true).length;
const witnessesFailed = analyses.filter(
  (a) => a.witnessRoute && a.witnessVerifiedByProductionGate === false,
).length;
console.log(`  testemunhas confirmadas pelo gate real: ${witnessesVerified} · reprovadas: ${witnessesFailed}`);

const verdict =
  escapeRejects.length === 0
    ? "NO_DATA"
    : avoidable === 0
      ? "GATE_REJECTIONS_ARE_STRUCTURAL"
      : avoidable / escapeRejects.length > 0.5
        ? "GENERATION_WASTE_DOMINANT"
        : "MIXED";

fs.writeFileSync(path.join(OUT, "route-cells-have-escape-255-analysis.json"), JSON.stringify({
  mission: "ROTA-01A-FINAL-REJECTION-AUTOPSY",
  gate: "routeCellsHaveEscape",
  classifier: {
    method: "exact set-membership + connectivity on the admissible subgraph",
    admissibleRule:
      "degree>=2; degree>=3 inside portal convergence (BFS<=3 from portal); shares a " +
      "biconnected block with the Explorer. Start exempt; portal exempt from the >=3 " +
      "and block rules.",
    equivalence:
      "A satisfying route exists iff start, every light and the portal share one " +
      "connected component of the admissible subgraph — a walk may revisit cells, so " +
      "connectivity is necessary and sufficient. Every B witness is confirmed by " +
      "calling the production routeCellsHaveEscape on the witness route.",
  },
  total: escapeRejects.length,
  legitimate, avoidable,
  percentLegitimate: pct(legitimate), percentAvoidable: pct(avoidable),
  witnessesVerified, witnessesFailed,
  offendingSubtypeHistogram: subtypeHist,
  legitimateBlockerHistogram: blockerHist,
  offendingDegreeHistogram: degreeHist,
  portalProximityHistogram: portalProximityHist,
  offendingCellsPerCandidateHistogram: failCountHist,
  perSeed, perTemplate, perExit,
  cases: analyses,
}, null, 2));

fs.writeFileSync(path.join(OUT, "route-cells-have-escape-verdict.json"), JSON.stringify({
  mission: "ROTA-01A-FINAL-REJECTION-AUTOPSY",
  gate: "routeCellsHaveEscape",
  totalRejections: escapeRejects.length,
  A_LEGITIMATE_STRUCTURAL_REJECTION: { count: legitimate, percent: pct(legitimate) },
  B_AVOIDABLE_GENERATION_WASTE: { count: avoidable, percent: pct(avoidable) },
  witnessesVerifiedByProductionGate: witnessesVerified,
  verdict,
  note: "Diagnostic only. The gate was not modified and no threshold was touched.",
}, null, 2));

fs.writeFileSync(path.join(OUT, "post-structural-two-rejections.json"), JSON.stringify({
  mission: "ROTA-01A-FINAL-REJECTION-AUTOPSY",
  count: twoRejects.length,
  finalGateNames,
  rejections: twoRejects,
}, null, 2));

fs.writeFileSync(path.join(OUT, "final-rejection-autopsy.json"), JSON.stringify({
  mission: "ROTA-01A-FINAL-REJECTION-AUTOPSY",
  seeds: seedOutcomes,
  totals: {
    attempts: total,
    passedStructural: passedStructural.length,
    certified: passedStructural.length - postStructuralRejects.length,
    postStructuralRejects: postStructuralRejects.length,
    routeCellsHaveEscapeRejects: escapeRejects.length,
  },
  structuralReasonCodes: structuralReasons,
  structuralReasonHistogram: candidates.reduce((acc, c) => {
    const label = c.structuralReason === -1 || c.structuralReason === undefined
      ? "PASSED_STRUCTURAL"
      : `[${c.structuralReason}] ${structuralReasons[c.structuralReason] ?? "?"}`;
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {}),
  finalGateNames,
  postStructuralRejections: twoRejects,
  routeCellsHaveEscape: { total: escapeRejects.length, legitimate, avoidable, verdict },
}, null, 2));
console.log(`\nVEREDITO routeCellsHaveEscape: ${verdict}`);
console.log("evidências escritas.");
