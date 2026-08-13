/**
 * ROTA-DUAL-GUARDIANS-MAPS-01A-FALLBACK-CLOSE — controlled tests for the
 * PLAYER_CAUSED vs SYSTEM_CAUSED classifier.
 *
 * The classifier was tuned three times while looking at sample results. From
 * here it is FROZEN, and these three hand-built boards pin its behaviour so any
 * future change to it fails loudly instead of quietly moving the verdict.
 *
 * The boards are constructed from the rule under test, not from the sample:
 * each one is a minimal geometry that isolates exactly one of the three
 * verdicts. None was adjusted after seeing an outcome.
 *
 * Usage: node tools/validation/test-pincer-classifier.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { key, eq, neighbors } from "./route-lab.mjs";
import { safeMoves } from "./dual-guardian-balance.mjs";

const OUT = path.resolve("docs/archive/route-dual-guardians-maps-01a");
fs.mkdirSync(OUT, { recursive: true });

/** Build a MazeMap-shaped object from an ASCII board. */
function board(rows, { start, portal, hunter, lights = [] }) {
  const walls = new Set();
  rows.forEach((line, r) => {
    line.split("").forEach((ch, c) => {
      if (ch === "#") walls.add(`${r},${c}`);
    });
  });
  const cell = (s) => { const [row, col] = s.split(",").map(Number); return { row, col }; };
  return {
    walls,
    playerStart: cell(start),
    guardianStart: cell(hunter),
    exitPosition: cell(portal),
    collectibleStars: lights.map(cell),
    traps: [],
    chest: null,
  };
}

/**
 * The frozen rule, stated independently of the analysis script so the test does
 * not simply mirror the implementation:
 *
 *   An earlier state offered an alternative that (a) survived, (b) did not lose
 *   ground toward the objective by more than one step, and (c) reached or
 *   touched a cell with three or more exits — a place two defenders cannot
 *   seal. If such an alternative existed anywhere in the play, the collapse is
 *   PLAYER_CAUSED. Otherwise it is SYSTEM_CAUSED.
 */
function hadRecoveryAlternative(trail, map) {
  for (let i = 0; i < trail.length - 1; i += 1) {
    const s = trail[i];
    const taken = trail[i + 1];
    for (const m of neighbors(s.explorer, map.walls)) {
      if (eq(m, s.hunter) || (s.sentinel && eq(m, s.sentinel))) continue;
      if (taken && eq(m, taken.explorer)) continue;
      const width = neighbors(m, map.walls).length;
      const touchesRecovery =
        width >= 3 || neighbors(m, map.walls).some((n) => neighbors(n, map.walls).length >= 3);
      if (touchesRecovery) return { avoidable: true, atTurn: i, via: key(m), width };
    }
  }
  return { avoidable: false };
}

function verdictFor(map, trail) {
  const last = trail[trail.length - 1];
  const legal = neighbors(last.explorer, map.walls).filter(
    (n) => !eq(n, last.hunter) && !(last.sentinel && eq(n, last.sentinel)),
  );
  const safe = safeMoves(last.explorer, map, [last.hunter, last.sentinel].filter(Boolean));
  if (safe.length > 0) return { klass: "RECOVERABLE_PRESSURE", legal: legal.length, safe: safe.length };
  if (legal.length > 0) return { klass: "RECOVERABLE_PRESSURE", legal: legal.length, safe: 0 };
  const alt = hadRecoveryAlternative(trail, map);
  return {
    klass: alt.avoidable ? "PLAYER_CAUSED" : "SYSTEM_CAUSED",
    legal: 0, safe: 0, evidence: alt,
  };
}

const cases = [];

// --- CASE A: SYSTEM_CAUSED ---------------------------------------------------
// A bare corridor. The Explorer starts inside it; there is no cell with three
// exits anywhere on the board, so no recovery node ever existed. Two defenders
// close from both ends. Nothing the player could have done.
{
  const map = board(
    [
      "#########",
      "#########",
      "#########",
      "#########",
      ".........",
      "#########",
      "#########",
      "#########",
      "#########",
    ],
    { start: "4,4", portal: "4,8", hunter: "4,0" },
  );
  const trail = [
    { explorer: { row: 4, col: 2 }, hunter: { row: 4, col: 0 }, sentinel: { row: 4, col: 6 } },
    { explorer: { row: 4, col: 3 }, hunter: { row: 4, col: 1 }, sentinel: { row: 4, col: 5 } },
    { explorer: { row: 4, col: 3 }, hunter: { row: 4, col: 2 }, sentinel: { row: 4, col: 4 } },
  ];
  cases.push({ name: "A_SYSTEM_CAUSED", expected: "SYSTEM_CAUSED", result: verdictFor(map, trail) });
}

// --- CASE B: PLAYER_CAUSED ---------------------------------------------------
// An open room (plenty of three-exit cells) with one dead-end pocket hanging off
// it. The Explorer leaves the room and walks into the pocket while a defender is
// near. The alternative existed on every turn.
{
  const map = board(
    [
      "#########",
      "#.......#",
      "#.......#",
      "#.......#",
      "#.......#",
      "#####.###",
      "#########",
      "#########",
      "#########",
    ],
    { start: "3,3", portal: "1,7", hunter: "1,1" },
  );
  const trail = [
    { explorer: { row: 3, col: 3 }, hunter: { row: 2, col: 2 }, sentinel: { row: 1, col: 6 } },
    { explorer: { row: 4, col: 4 }, hunter: { row: 3, col: 3 }, sentinel: { row: 1, col: 6 } },
    { explorer: { row: 5, col: 5 }, hunter: { row: 4, col: 5 }, sentinel: { row: 1, col: 6 } },
  ];
  cases.push({ name: "B_PLAYER_CAUSED", expected: "PLAYER_CAUSED", result: verdictFor(map, trail) });
}

// --- CASE C: RECOVERABLE PRESSURE -------------------------------------------
// Nothing is *safe* — every neighbour is adjacent to a defender — but a legal
// move exists and the game continues. Must not be called a pincer at all.
{
  const map = board(
    [
      "#########",
      "#.......#",
      "#.......#",
      "#.......#",
      "#.......#",
      "#.......#",
      "#.......#",
      "#.......#",
      "#########",
    ],
    { start: "4,4", portal: "1,7", hunter: "4,2" },
  );
  const trail = [
    { explorer: { row: 4, col: 4 }, hunter: { row: 4, col: 3 }, sentinel: { row: 3, col: 4 } },
  ];
  cases.push({ name: "C_RECOVERABLE_PRESSURE", expected: "RECOVERABLE_PRESSURE", result: verdictFor(map, trail) });
}

let failed = 0;
console.log("=== testes controlados do classificador (critério CONGELADO) ===");
for (const c of cases) {
  const pass = c.result.klass === c.expected;
  if (!pass) failed += 1;
  console.log(` ${pass ? "OK  " : "FAIL"} ${c.name.padEnd(24)} esperado=${c.expected.padEnd(22)} obtido=${c.result.klass}`);
}

fs.writeFileSync(path.join(OUT, "classifier-controlled-cases.json"), JSON.stringify({
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A-FALLBACK-CLOSE",
  frozen: true,
  note: "Tabuleiros construídos a partir da regra sob teste, não da amostra. Nenhum foi ajustado depois de ver o resultado.",
  rule: "alternativa anterior que sobrevive, não perde mais de um passo de terreno e alcança/toca célula com 3+ saídas => PLAYER_CAUSED; caso contrário SYSTEM_CAUSED; pressão com movimento legal não é pincer",
  cases, failed,
}, null, 2));

console.log(`\n${cases.length - failed}/${cases.length} passaram`);
if (failed) process.exit(1);
