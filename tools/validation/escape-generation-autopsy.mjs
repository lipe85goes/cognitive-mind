/**
 * ROTA-01A-ESCAPE-ROUTE-GENERATION-CLOSE — measurement BEFORE any fix.
 *
 * Fase 1: reproduce the six generation throws the repaired 9x9 validator found
 *         and say what each one actually died of, attempt by attempt.
 * Fase 7: measure whether the stage-3 portal candidates can satisfy the escape
 *         width contract at all, from board geometry alone.
 *
 * Usage: node tools/validation/escape-generation-autopsy.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { loadInstrumented } from "./instrumented-generator.mjs";

const OUT = path.resolve("docs/archive/route-dual-guardians-maps-01a");
fs.mkdirSync(OUT, { recursive: true });
const CHECKPOINT = path.join(OUT, "validator-9x9-checkpoint.json");

const { API, setSeed, replayGeneration, structuralReasons } = loadInstrumented();
const throwsFromValidator = JSON.parse(fs.readFileSync(CHECKPOINT, "utf8")).generationThrows;
console.log(`throws registrados pelo validador: ${throwsFromValidator.length}`);

const FAMILY = (label) => {
  if (label.includes("routeCellsHaveEscape")) return "routeCellsHaveEscape";
  if (label.includes("collectibleStars") || label.includes("starsSeparated") || label.includes("starsReachable")) return "star selection";
  if (label.includes("hasStrategicIdentity")) return "identity";
  if (label.startsWith("FINAL:")) return "final gates";
  if (label === "CERTIFIED") return "certified";
  return "outras";
};

const cases = [];
for (const t of throwsFromValidator) {
  setSeed(t.seed);
  const run = replayGeneration({
    difficulty: t.difficulty,
    stage: t.stage,
    forcedTemplateIndex: t.forcedTemplateIndex ?? undefined,
    capture: false,
  });
  const families = {};
  for (const [label, count] of Object.entries(run.histogram)) {
    const f = FAMILY(label);
    families[f] = (families[f] ?? 0) + count;
  }
  const templates = {};
  const exits = {};
  for (const a of run.attempts) {
    templates[a.templateIndex] = (templates[a.templateIndex] ?? 0) + 1;
    exits[a.exit] = (exits[a.exit] ?? 0) + 1;
  }
  const entry = {
    route: t.stage,
    mode: t.difficulty,
    seed: t.seed,
    rngState: `createSeededRandom(${t.seed})`,
    forcedTemplateIndex: t.forcedTemplateIndex ?? null,
    templatesTried: templates,
    exitsTried: exits,
    randomAttempts: run.randomAttempts,
    recoveryAttempts: run.recoveryAttempts,
    totalAttempts: run.totalAttempts,
    reproduced: run.threw,
    rejectionHistogram: run.histogram,
    familyBreakdown: families,
    dominantFamily: Object.entries(families).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
  };
  cases.push(entry);
  console.log(
    `  rota ${t.stage}/${t.difficulty} seed ${t.seed}: ${run.threw ? "LANÇOU (reproduzido)" : "NÃO reproduziu"} · ` +
      `${run.randomAttempts} random + ${run.recoveryAttempts} recovery = ${run.totalAttempts}`,
  );
  console.log(`    famílias: ${JSON.stringify(families)}`);
}

const reproduced = cases.filter((c) => c.reproduced).length;
const totals = {};
for (const c of cases) {
  for (const [f, n] of Object.entries(c.familyBreakdown)) totals[f] = (totals[f] ?? 0) + n;
}
const grand = Object.values(totals).reduce((a, b) => a + b, 0);
console.log(`\nreproduzidos: ${reproduced}/${cases.length}`);
console.log(`famílias agregadas (${grand} tentativas): ${JSON.stringify(totals)}`);
for (const [f, n] of Object.entries(totals).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${f}: ${n} (${((n / grand) * 100).toFixed(1)}%)`);
}

// --- FASE 7: portal escape geometry, from the board alone -------------------
const ROWS = API.ROWS;
const COLS = API.COLS;
const START = API.PLAYER_START;
const geometricDegree = (pos) => {
  let n = 0;
  if (pos.row > 0) n += 1;
  if (pos.row < ROWS - 1) n += 1;
  if (pos.col > 0) n += 1;
  if (pos.col < COLS - 1) n += 1;
  return n;
};
const portalReport = [];
for (const stage of [1, 2, 3]) {
  for (const exit of API.ROUTE_STAGE_EXIT_CANDIDATES[stage]) {
    const openBoard = new Set();
    const approaches = [];
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const pos = { row: exit.row + dr, col: exit.col + dc };
      if (pos.row < 0 || pos.col < 0 || pos.row >= ROWS || pos.col >= COLS) continue;
      approaches.push({
        cell: API.posKey(pos),
        maxGeometricDegree: geometricDegree(pos),
        canEverReachDegree3: geometricDegree(pos) >= 3,
      });
    }
    // Cells within BFS<=3 of the portal on a wall-free board: the widest the
    // convergence region can ever be, and therefore the most forgiving case.
    const convergence = API.getReachableDistances(exit, openBoard);
    let inRegion = 0;
    let impossible = 0;
    const impossibleCells = [];
    convergence.forEach((distance, cellKey) => {
      if (distance > 3) return;
      inRegion += 1;
      const [row, col] = cellKey.split(",").map(Number);
      if (cellKey === API.posKey(exit)) return; // portal is exempt from the >=3 rule
      if (geometricDegree({ row, col }) < 3) {
        impossible += 1;
        impossibleCells.push(cellKey);
      }
    });
    const entry = {
      stage,
      portal: API.posKey(exit),
      portalGeometricDegree: geometricDegree(exit),
      portalIsCorner: geometricDegree(exit) === 2,
      inevitableApproachCells: approaches,
      approachesThatCanReachDegree3: approaches.filter((a) => a.canEverReachDegree3).length,
      convergenceCellsOnOpenBoard: inRegion,
      convergenceCellsWhereDegree3IsImpossible: impossible,
      permanentlyInadmissibleCells: impossibleCells,
      classification:
        approaches.every((a) => !a.canEverReachDegree3)
          ? "PORTAL_ESCAPE_GEOMETRY_IMPOSSIBLE"
          : "PORTAL_ESCAPE_GEOMETRY_POSSIBLE_BUT_CONSTRAINED",
    };
    portalReport.push(entry);
  }
}
console.log("\ngeometria dos portais (tabuleiro sem paredes — o caso mais generoso):");
for (const p of portalReport) {
  console.log(
    `  rota ${p.stage} portal ${p.portal}: grau geométrico ${p.portalGeometricDegree}` +
      `${p.portalIsCorner ? " (CANTO)" : ""} · aproximações ${p.inevitableApproachCells.length}` +
      ` · convergência ${p.convergenceCellsOnOpenBoard} células, ${p.convergenceCellsWhereDegree3IsImpossible} onde grau>=3 é impossível`,
  );
  if (p.permanentlyInadmissibleCells.length) {
    console.log(`    permanentemente inadmissíveis: ${p.permanentlyInadmissibleCells.join(" ")}`);
  }
}

fs.writeFileSync(path.join(OUT, "generation-six-throws-before.json"), JSON.stringify({
  mission: "ROTA-01A-ESCAPE-ROUTE-GENERATION-CLOSE",
  phase: "before",
  source: "validator-9x9-checkpoint.json generationThrows",
  structuralReasonCodes: structuralReasons,
  reproduced: `${reproduced}/${cases.length}`,
  aggregateFamilies: totals,
  aggregateAttempts: grand,
  cases,
}, null, 2));

fs.writeFileSync(path.join(OUT, "portal-escape-geometry.json"), JSON.stringify({
  mission: "ROTA-01A-ESCAPE-ROUTE-GENERATION-CLOSE",
  playerStart: API.posKey(START),
  note:
    "Measured on a wall-free board, so these are upper bounds: any wall can only " +
    "reduce a cell's degree. A cell whose geometric degree is below 3 can never " +
    "satisfy the convergence rule, no matter how the walls fall.",
  portals: portalReport,
}, null, 2));
console.log("\nwrote generation-six-throws-before.json, portal-escape-geometry.json");
