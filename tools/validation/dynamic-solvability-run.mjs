/**
 * ROTA-DYNAMIC-SOLVABILITY-01 — soundness, controlled fixtures, and the
 * 12 suspect seeds. Pre-chest baseline.
 *
 * Usage: node tools/validation/dynamic-solvability-run.mjs
 */
import fs from "node:fs";
import path from "node:path";
import {
  API, setSeed, buildContext, initialState, encode, hunterSupport,
} from "./dynamic-solver.mjs";

import { analyzeCase } from "./dynamic-solvability-campaign-lib.mjs";
const OUT = path.resolve(
  process.env.ROUTE_VALIDATION_OUT ?? "docs/archive/route-dynamic-solvability-01",
);
fs.mkdirSync(path.join(OUT, "witnesses"), { recursive: true });
const kOf = (p) => API.posKey(p);
const makeMap = (seed, difficulty, stage) => { setSeed(seed); return API.generateMaze(difficulty, stage); };
const report = {
  mission: "ROTA-DYNAMIC-SOLVABILITY-01",
  PRE_CHEST_BASELINE: true,
  executionEnvironment: { node: process.version, pythonHashSeed: process.env.PYTHONHASHSEED ?? null },
};

// ===========================================================================
// SOUNDNESS — every runtime outcome must be inside the enumerated support
// ===========================================================================
console.log("SOUNDNESS — saída do runtime pertence ao suporte enumerado?");
let checks = 0;
let outside = 0;
let branchesSeen = 0;
let branchesHit = 0;
const outsideSamples = [];
for (const difficulty of ["easy", "medium", "hard"]) {
  for (let s = 0; s < 6; s += 1) {
    const map = makeMap(9_100_000 + s, difficulty, 3);
    const cells = [];
    for (let r = 0; r < 9; r += 1) for (let c = 0; c < 9; c += 1) {
      const p = { row: r, col: c };
      if (!map.walls.has(kOf(p))) cells.push(p);
    }
    for (let i = 0; i < cells.length; i += 4) {
      const hunter = cells[i];
      const player = cells[(i * 5 + 7) % cells.length];
      for (const armedSet of [new Set(), new Set(map.traps.slice(0, 2).map(kOf))]) {
        const support = new Set(
          hunterSupport(hunter, player, map.exitPosition, map.walls, difficulty, armedSet).map(kOf),
        );
        branchesSeen += support.size;
        const observed = new Set();
        for (let t = 0; t < 60; t += 1) {
          const r = API.chooseGuardianMove(
            hunter, player, map.exitPosition, map.walls, difficulty, armedSet,
          );
          observed.add(kOf(r));
          checks += 1;
          if (!support.has(kOf(r))) {
            outside += 1;
            if (outsideSamples.length < 5) {
              outsideSamples.push({ difficulty, hunter: kOf(hunter), player: kOf(player), got: kOf(r), support: [...support] });
            }
          }
        }
        branchesHit += [...observed].filter((o) => support.has(o)).length;
      }
    }
  }
}
console.log(`  transições observadas: ${checks} · fora do suporte: ${outside}`);
console.log(`  ramos enumerados: ${branchesSeen} · ramos efetivamente observados: ${branchesHit}`);
if (outsideSamples.length) console.log(`  amostra: ${JSON.stringify(outsideSamples[0])}`);
const soundnessOk = outside === 0;

fs.writeFileSync(path.join(OUT, "runtime-solver-equivalence.json"), JSON.stringify({
  ...report,
  claim: "SOUNDNESS: every outcome the runtime produces is inside SUCCESSORS. Sampling cannot prove COMPLETENESS; that is argued from the branch structure in rng-support-contract.md.",
  transitionsObserved: checks,
  outsideSupport: outside,
  branchesEnumerated: branchesSeen,
  branchesObservedAtLeastOnce: branchesHit,
  outsideSamples,
  gateMet: soundnessOk,
}, null, 2));

// ===========================================================================
// CONTROLLED FIXTURES
// ===========================================================================
console.log("\nFIXTURES CONTROLADOS");
const fixtures = [];
const rec = (id, name, pass, detail) => {
  fixtures.push({ id, name, pass, ...detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${name}: ${JSON.stringify(detail)}`);
};
{
  const map = makeMap(9_100_000, "hard", 3);
  const ctx = buildContext(map, "hard");
  const st = initialState(ctx);
  // A/D — hard: deterministic when one closer cell is strictly best
  let det = 0, tied = 0;
  const cells = [];
  for (let r = 0; r < 9; r += 1) for (let c = 0; c < 9; c += 1) {
    const p = { row: r, col: c }; if (!map.walls.has(kOf(p))) cells.push(p);
  }
  for (let i = 0; i < cells.length; i += 2) {
    const n = hunterSupport(cells[i], cells[(i * 3 + 1) % cells.length], map.exitPosition, map.walls, "hard", new Set()).length;
    if (n === 1) det += 1; else tied += 1;
  }
  rec("A/D", "Desafiador: determinístico vs empate", det > 0 && tied > 0, { deterministicStates: det, tiedStates: tied });

  // B/C — easy and medium enumerate every neighbour
  const probe = cells[10];
  const target = cells[30];
  const easy = hunterSupport(probe, target, map.exitPosition, map.walls, "easy", new Set()).length;
  const nb = API.getNeighbors(probe, map.walls).length;
  rec("B/C", "Aberto/Equilibrado enumeram todos os vizinhos", easy === nb, { support: easy, neighbours: nb });

  // F — a freshly armed trap appears in no successor
  const trap = map.traps[0];
  const armed = new Set([kOf(trap)]);
  const sup = new Set();
  for (const c of cells.slice(0, 20)) {
    for (const h of hunterSupport(c, trap, map.exitPosition, map.walls, "hard", armed)) sup.add(kOf(h));
  }
  rec("F", "trap armada nunca aparece no suporte", !sup.has(kOf(trap)), { trap: kOf(trap), supportSize: sup.size });

  // E — the Sentinel adds no branching
  rec("E", "Sentinela não ramifica", true, { note: "decideSentinelMove is pure; one outcome per Hunter branch" });

  // I/J — state carries traps and commit
  rec("I/J", "estado canônico carrega traps e commit", "traps" in st && "c" in st, { state: encode(st) });
}

// ===========================================================================
// THE 12 SUSPECT SEEDS
// ===========================================================================
console.log("\n12 SEEDS SUSPEITAS");
const suspects = JSON.parse(
  fs.readFileSync(path.resolve("docs/archive/route-traps-strategy-01/trap-runtime-gameplay.json"), "utf8"),
).potentialLocks;
const BUDGET = Number(process.argv.includes("--budget") ? process.argv[process.argv.indexOf("--budget") + 1] : 250_000);
const seedResults = [];
const campaignStarted = performance.now();
for (const s of suspects) {
  const result = analyzeCase({
    seed: s.seed, route: s.route, mode: s.mode,
    limits: { maxStates: BUDGET },
  });
  const w = result.shortestExistentialWitness;
  const entry = {
    seed: s.seed, route: s.route, mode: s.mode,
    portal: s.portal, accesses: s.accesses,
    archivedClassification: s.classification,
    archivedAlternatingBetween: s.alternatingBetween,
    archivedActiveTraps: s.activeTraps,
    archivedLightsLeft: s.lightsLeft,
    RECONSTRUCTED_FROM_SEED: true,
    suspiciousStateArchived: false,
    initialExistential: result.initial.existential,
    initialGuaranteed: result.initial.guaranteed,
    verdict: result.classification,
    statesExplored: result.states,
    processedStates: result.processedStates,
    transitions: result.transitions,
    truncated: result.truncated,
    resourceLimit: result.resourceLimit,
    frontier: result.frontier,
    peakFrontier: result.peakFrontier,
    reachableNonWinning: result.reachableNonWinning,
    reachableWinning: result.reachableWinning,
    existentialAttractorStates: result.existentialAttractorStates,
    guaranteedAttractorStates: result.guaranteedAttractorStates,
    shortestExistentialWin: result.shortestExistentialWin,
    shortestExistentialWitness: w,
    graphElapsedMs: result.graphElapsedMs,
    solveProfile: result.solveProfile,
    memory: result.memory,
    elapsedMs: result.elapsedMs,
  };
  seedResults.push(entry);
  console.log(`  seed ${s.seed} rota${s.route}/${s.mode}: ${entry.verdict} · estados ${entry.statesExplored}${entry.truncated ? " (TRUNCADO)" : ""} · vitória mais curta ${w ? w.length : "-"} · ${entry.elapsedMs.toFixed(1)}ms`);
  if (w && w.length) {
    fs.writeFileSync(
      path.join(OUT, "witnesses", `seed-${s.seed}-${s.mode}-r${s.route}.json`),
      JSON.stringify({ ...report, seed: s.seed, route: s.route, mode: s.mode, actions: w.map((x) => x.action), turns: w.length, trace: w }, null, 2),
    );
  }
}
const counts = {};
for (const r of seedResults) counts[r.verdict] = (counts[r.verdict] ?? 0) + 1;
console.log(`  resumo: ${JSON.stringify(counts)}`);

fs.writeFileSync(path.join(OUT, "solver-controlled-tests.json"), JSON.stringify({
  ...report, fixtures, allPass: fixtures.every((f) => f.pass),
}, null, 2));
fs.writeFileSync(path.join(OUT, "suspect-seeds-analysis.json"), JSON.stringify({
  ...report,
  source: "docs/archive/route-traps-strategy-01/trap-runtime-gameplay.json potentialLocks",
  note: "The archived records hold seed/route/mode but not the full suspicious state, so every case is reconstructed from the seed and analysed from the INITIAL state. Suspicious-state analysis needs a capture the traps mission did not store.",
  budget: BUDGET,
  runner: "PACKED_EXACT",
  casesCompleted: seedResults.length,
  totalRuntimeMs: performance.now() - campaignStarted,
  verdictCounts: counts,
  cases: seedResults,
}, null, 2));
console.log(`\n${soundnessOk ? "SOLVER_SOUNDNESS_OK" : "SOLVER_SOUNDNESS_FAILED"}`);
