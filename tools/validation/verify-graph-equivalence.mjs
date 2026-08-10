/**
 * ROTA-DUAL-GUARDIANS-MAPS-01A-GRAPH-PERF-CLOSE — equivalence proof.
 *
 * The old rule is re-implemented here from its specification, independently of
 * the production code, and used as the ORACLE:
 *
 *   hasAlternativeRoute(s, t) = s and t are connected, AND removing any single
 *   interior cell of one shortest s->t path still leaves them connected.
 *
 * The new rule under test is the biconnected decomposition: s and t share a
 * block. The two must agree on every pair, on every candidate — valid or
 * rejected — or the optimisation is a behaviour change wearing a performance
 * costume.
 *
 * Controlled cases first (including the trap the mission warned about: a global
 * articulation point that does NOT separate the endpoints we care about), then
 * volume.
 *
 * Usage: node tools/validation/verify-graph-equivalence.mjs [--candidates 12000]
 */
import fs from "node:fs";
import path from "node:path";
import { createSeededRandom, key, eq, neighbors } from "./route-lab.mjs";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const CANDIDATES = Number(arg("--candidates", 12000));
const OUT = path.resolve("docs/archive/route-dual-guardians-maps-01a");
fs.mkdirSync(OUT, { recursive: true });

const ROWS = 9;
const COLS = 9;
const cell = (r, c) => ({ row: r, col: c });

// ----------------------------------------------------------------- ORACLE ---
function pathCells(start, target, walls, blocked) {
  const prev = new Map([[key(start), null]]);
  const queue = [start];
  for (let i = 0; i < queue.length; i += 1) {
    const cur = queue[i];
    if (eq(cur, target)) {
      const out = [];
      let k = key(cur);
      while (k) { const [r, c] = k.split(",").map(Number); out.unshift(cell(r, c)); k = prev.get(k); }
      return out;
    }
    for (const n of neighbors(cur, walls)) {
      const k = key(n);
      if (prev.has(k) || blocked?.has(k)) continue;
      prev.set(k, key(cur));
      queue.push(n);
    }
  }
  return null;
}
/** The frozen old contract, verbatim. */
function oracleHasAlternativeRoute(start, target, walls) {
  const p = pathCells(start, target, walls);
  if (!p) return false;
  return p.slice(1, -1).every((c) => pathCells(start, target, walls, new Set([key(c)])) !== null);
}

// -------------------------------------------------------------------- NEW ---
function decomposeBoardBlocks(walls) {
  const blocksOf = new Map();
  const componentOf = new Map();
  const discovery = new Map();
  const low = new Map();
  let timer = 0, blockId = 0, componentId = 0;
  const addBlock = (k, id) => {
    const l = blocksOf.get(k);
    if (!l) blocksOf.set(k, [id]);
    else if (!l.includes(id)) l.push(id);
  };
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const root = cell(row, col);
      const rootKey = key(root);
      if (walls.has(rootKey) || discovery.has(rootKey)) continue;
      const component = componentId; componentId += 1;
      const edgeStack = [];
      const frame = [{ cell: root, parent: null, neighbours: neighbors(root, walls), index: 0 }];
      discovery.set(rootKey, timer); low.set(rootKey, timer); componentOf.set(rootKey, component); timer += 1;
      while (frame.length > 0) {
        const top = frame[frame.length - 1];
        const topKey = key(top.cell);
        if (top.index < top.neighbours.length) {
          const next = top.neighbours[top.index];
          top.index += 1;
          const nextKey = key(next);
          if (nextKey === top.parent) continue;
          if (!discovery.has(nextKey)) {
            edgeStack.push([topKey, nextKey]);
            discovery.set(nextKey, timer); low.set(nextKey, timer); componentOf.set(nextKey, component); timer += 1;
            frame.push({ cell: next, parent: topKey, neighbours: neighbors(next, walls), index: 0 });
          } else if ((discovery.get(nextKey) ?? 0) < (discovery.get(topKey) ?? 0)) {
            edgeStack.push([topKey, nextKey]);
            low.set(topKey, Math.min(low.get(topKey) ?? 0, discovery.get(nextKey) ?? 0));
          }
          continue;
        }
        frame.pop();
        const parentKey = top.parent;
        if (parentKey === null) continue;
        low.set(parentKey, Math.min(low.get(parentKey) ?? 0, low.get(topKey) ?? 0));
        if ((low.get(topKey) ?? 0) >= (discovery.get(parentKey) ?? 0)) {
          const id = blockId; blockId += 1;
          for (;;) {
            const e = edgeStack.pop();
            if (!e) break;
            addBlock(e[0], id); addBlock(e[1], id);
            if (e[0] === parentKey && e[1] === topKey) break;
          }
        }
      }
    }
  }
  return { blocksOf, componentOf };
}
function sharesBlock(blocks, start, target) {
  const a = key(start), b = key(target);
  if (a === b) return blocks.componentOf.has(a);
  const ca = blocks.componentOf.get(a), cb = blocks.componentOf.get(b);
  if (ca === undefined || cb === undefined || ca !== cb) return false;
  const la = blocks.blocksOf.get(a), lb = blocks.blocksOf.get(b);
  if (!la || !lb) return false;
  return la.some((id) => lb.includes(id));
}

// ------------------------------------------------------- controlled cases ---
const wallsFrom = (rows) => {
  const w = new Set();
  rows.forEach((line, r) => line.split("").forEach((ch, c) => { if (ch === "#") w.add(`${r},${c}`); }));
  return w;
};
const controlled = [
  { name: "corredor simples", rows: ["#########","#########","#########","#########",".........","#########","#########","#########","#########"], pairs: [[cell(4,0), cell(4,8)], [cell(4,3), cell(4,4)]] },
  { name: "ciclo", rows: ["#########","#.....###","#.###.###","#.###.###","#.....###","#########","#########","#########","#########"], pairs: [[cell(1,1), cell(4,5)], [cell(1,1), cell(1,5)]] },
  { name: "dois ciclos ligados", rows: ["#########","#...#...#","#.#.#.#.#","#...#...#","#..###..#","#.......#","#########","#########","#########"], pairs: [[cell(1,1), cell(1,7)], [cell(2,1), cell(2,7)]] },
  { name: "ramo morto irrelevante", rows: ["#########","#.....###","#.###.###","#.###.###","#.....###","#..#####","#..######","#########","#########"], pairs: [[cell(1,1), cell(4,5)], [cell(1,1), cell(6,2)]] },
  { name: "articulacao global que NAO separa os endpoints", rows: ["#########","#.....###","#.###.###","#.###.###","#.....###","###.#####","###.#####","###.#####","#########"], pairs: [[cell(1,1), cell(4,5)], [cell(1,1), cell(7,3)]] },
  { name: "articulacao que separa de verdade", rows: ["#########","#...#...#","#...#...#","#...#...#","#...#...#","#########","#########","#########","#########"], pairs: [[cell(1,1), cell(1,7)]] },
  { name: "grade aberta (multiplas rotas)", rows: ["#########","#.......#","#.......#","#.......#","#.......#","#.......#","#.......#","#.......#","#########"], pairs: [[cell(1,1), cell(7,7)], [cell(1,1), cell(1,2)]] },
];

const controlledResults = [];
let controlledFail = 0;
for (const c of controlled) {
  const walls = wallsFrom(c.rows);
  const blocks = decomposeBoardBlocks(walls);
  for (const [a, b] of c.pairs) {
    const oldV = oracleHasAlternativeRoute(a, b, walls);
    const newV = sharesBlock(blocks, a, b);
    const ok = oldV === newV;
    if (!ok) controlledFail += 1;
    controlledResults.push({ case: c.name, pair: `${key(a)}->${key(b)}`, old: oldV, new: newV, agree: ok });
  }
}
console.log("=== casos controlados ===");
for (const r of controlledResults) {
  console.log(` ${r.agree ? "OK  " : "FAIL"} ${r.case.padEnd(44)} ${r.pair.padEnd(12)} old=${String(r.old).padEnd(5)} new=${r.new}`);
}

// ------------------------------------------------------------ volume test ---
console.log(`\n=== equivalência em volume: ${CANDIDATES} candidatos ===`);
const rand = createSeededRandom(20260807);
const START = cell(8, 0);
const EXITS = [cell(0, 8), cell(1, 8), cell(0, 7), cell(2, 8)];
let compared = 0;
let divergences = [];
const t0 = Date.now();

for (let i = 0; i < CANDIDATES; i += 1) {
  // Candidate wall sets across the full budget the generator can produce,
  // deliberately including layouts that would be rejected.
  const target = 10 + Math.floor(rand() * 26);
  const walls = new Set();
  let guard = 0;
  while (walls.size < target && guard < 400) {
    guard += 1;
    const r = Math.floor(rand() * ROWS);
    const c = Math.floor(rand() * COLS);
    const k = `${r},${c}`;
    if (k === key(START)) continue;
    walls.add(k);
  }
  const blocks = decomposeBoardBlocks(walls);
  // Every published endpoint plus a spread of random interior cells.
  const targets = [...EXITS];
  for (let t = 0; t < 6; t += 1) {
    targets.push(cell(Math.floor(rand() * ROWS), Math.floor(rand() * COLS)));
  }
  for (const t of targets) {
    if (walls.has(key(t))) continue;
    const oldV = oracleHasAlternativeRoute(START, t, walls);
    const newV = sharesBlock(blocks, START, t);
    compared += 1;
    if (oldV !== newV && divergences.length < 40) {
      divergences.push({ candidate: i, target: key(t), old: oldV, new: newV, walls: [...walls].sort().join(" ") });
    } else if (oldV !== newV) {
      divergences.push({ candidate: i, target: key(t), old: oldV, new: newV });
    }
  }
}
const elapsed = Date.now() - t0;
console.log(` candidatos ${CANDIDATES} · pares comparados ${compared} · divergências ${divergences.length} · ${(elapsed / 1000).toFixed(1)}s`);

fs.writeFileSync(path.join(OUT, "graph-equivalence-controlled.json"), JSON.stringify({
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A-GRAPH-PERF-CLOSE",
  contract: "hasAlternativeRoute(s,t) = conectados E remover qualquer célula interior de um caminho mínimo mantém a conexão; equivale a 's e t partilham um componente biconexo'",
  cases: controlledResults, failed: controlledFail,
}, null, 2));
fs.writeFileSync(path.join(OUT, "graph-equivalence-10k.json"), JSON.stringify({
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A-GRAPH-PERF-CLOSE",
  candidates: CANDIDATES, pairsCompared: compared,
  divergences: divergences.length, sample: divergences.slice(0, 20),
  elapsedMs: elapsed,
}, null, 2));

console.log(`\ncontrolados: ${controlledResults.length - controlledFail}/${controlledResults.length}`);
if (controlledFail || divergences.length) {
  console.error("DIVERGÊNCIAS ENCONTRADAS — não substituir");
  process.exit(1);
}
console.log("EQUIVALENCE_OK");
