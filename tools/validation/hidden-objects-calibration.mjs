/**
 * GAME03-CALIBRATION-02A — the calibration report: where Difficulty V3's numbers
 * come from and what they accept, for both rooms.
 *
 *   1. The reference. Every round Difficulty V2 could draw, in both rooms, on
 *      the art it was playtested on (the calibration base, 3b122cf), measured
 *      with the search-load ruler (hidden-objects-difficulty.ts). From it: the
 *      ruler's anchors, the glance threshold and the round floors — recomputed
 *      here and compared with the product's constants (they must be equal).
 *   2. The round space. For each room and difficulty, every round the
 *      structural rules allow (count, list style, station spread) — the
 *      candidates — with its profile: how many the difficulty's rule accepts,
 *      how many it rejects and why, and the distribution (min, max, mean,
 *      quartiles, histogram) of the mean search load, the look-alike pressure
 *      and the places the list sends the Explorador to.
 *   3. The clues. Per room and level, the bank's size, and which variants a
 *      stream of seeds actually tells.
 *
 * Read-only unless --out is given (then calibration-report.json and .md there).
 *
 * Usage: node tools/validation/hidden-objects-calibration.mjs [--out DIR]
 * Exit: 0 every invariant held · 1 an invariant failed · 3 usage error.
 */
import fs from "node:fs";
import path from "node:path";
import { CALIBRATION_BASE, DIFFICULTIES, deriveReference, openBase, percentile } from "./hidden-objects-calibration-lib.mjs";
import { createModuleGraph, openSourceTree } from "./route-module-loader.mjs";

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_USAGE = 3;
const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const OUT = outIndex === -1 ? null : args[outIndex + 1];
if ((outIndex !== -1 && !OUT) || args.some((arg, i) => arg !== "--out" && i !== outIndex + 1)) {
  console.error("usage: node tools/validation/hidden-objects-calibration.mjs [--out DIR]");
  process.exit(EXIT_USAGE);
}

const tree = openSourceTree();
const graph = createModuleGraph({ tree, mocks: {}, globals: {} });
const CONTRACT = graph.require("src/games/hidden-objects/hidden-objects-scene.ts");
const DIFFICULTY = graph.require("src/games/hidden-objects/hidden-objects-difficulty.ts");
const ROUNDS = graph.require("src/games/hidden-objects/hidden-objects-rounds.ts");
const CLUES = graph.require("src/games/hidden-objects/hidden-objects-clues.ts");
const REGISTRY = graph.require("src/games/hidden-objects/hidden-objects-scenes.ts");

const round3 = (x) => Number(x.toFixed(3));
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const problems = [];

/** min, max, mean, quartiles and a 0.05-wide histogram of a list of numbers. */
function distribution(values) {
  if (values.length === 0) return { n: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const histogram = {};
  for (const v of sorted) {
    const bin = (Math.floor(v / 0.05) * 0.05).toFixed(2);
    histogram[bin] = (histogram[bin] ?? 0) + 1;
  }
  return {
    n: sorted.length,
    min: round3(sorted[0]),
    p25: round3(percentile(sorted, 0.25)),
    mean: round3(mean(sorted)),
    p75: round3(percentile(sorted, 0.75)),
    max: round3(sorted.at(-1)),
    histogram,
  };
}

/** Why a candidate round is rejected (every reason that applies). */
function rejections(rule, profile) {
  const why = [];
  for (const tier of ["A", "B", "C"]) {
    const [lo, hi] = rule.tiers[tier];
    if (profile.tiers[tier] < lo || profile.tiers[tier] > hi) why.push("tiers");
  }
  if (profile.popOuts > rule.maxPopOuts) why.push("glance finds");
  if (profile.search < rule.minSearch) why.push("below the floor");
  if (profile.search >= rule.maxSearch) why.push("at or above the next floor");
  if (profile.decoys < rule.minDecoys) why.push("look-alike pressure");
  return [...new Set(why)];
}

// --- 1. the reference ------------------------------------------------------------------------------

const started = Date.now();
const base = openBase();
const reference = await deriveReference(base, DIFFICULTY);
const product = {
  ruler: { edge: DIFFICULTY.SEARCH_RULER.edge, clutter: DIFFICULTY.SEARCH_RULER.clutter, side: DIFFICULTY.SEARCH_RULER.side },
  popOut: DIFFICULTY.POP_OUT_BELOW,
  floors: { ...CONTRACT.ROUND_FLOORS },
  decoyFloors: { ...CONTRACT.DECOY_FLOORS },
};
const derived = { ruler: reference.ruler, popOut: reference.popOut, floors: reference.floors, decoyFloors: reference.decoyFloors };
if (JSON.stringify(product) !== JSON.stringify(derived)) problems.push(`the product's constants ${JSON.stringify(product)} are not the derived ${JSON.stringify(derived)}`);
const v2 = Object.fromEntries(
  DIFFICULTIES.map((d) => [
    d,
    {
      perRoom: Object.fromEntries(reference.v2[d].map((room) => [room.room, { rounds: room.rounds.length, search: distribution(room.rounds.map((r) => r.search)), decoys: distribution(room.rounds.map((r) => r.decoys)) }])),
      pooled: { search: distribution(reference.v2[d].flatMap((room) => room.rounds.map((r) => r.search))), decoys: distribution(reference.v2[d].flatMap((room) => room.rounds.map((r) => r.decoys))) },
    },
  ]),
);

// --- 2. the round space ------------------------------------------------------------------------------

const rooms = {};
for (const scene of REGISTRY.SCENES) {
  const loads = Object.fromEntries(scene.pool.map((t) => [t.id, round3(DIFFICULTY.loadOf(scene, t.id))]));
  const parts = Object.fromEntries(scene.pool.map((t) => [t.id, Object.fromEntries(Object.entries(DIFFICULTY.searchParts(scene, t)).map(([k, v]) => [k, round3(v)]))]));
  const byDifficulty = {};
  for (const d of DIFFICULTIES) {
    const rule = CONTRACT.DIFFICULTY_PRESETS[d].round;
    const candidates = ROUNDS.candidateRounds(scene, d);
    const accepted = [];
    const rejected = {};
    for (const ids of candidates) {
      const profile = DIFFICULTY.roundProfile(scene, d, ids);
      const why = rejections(rule, profile);
      if (why.length === 0) accepted.push(profile);
      for (const reason of why) rejected[reason] = (rejected[reason] ?? 0) + 1;
    }
    const valid = ROUNDS.validRounds(scene, d);
    if (valid.length !== accepted.length) problems.push(`${scene.id}/${d}: the product accepts ${valid.length} rounds, the report ${accepted.length}`);
    if (accepted.length === 0) problems.push(`${scene.id}/${d}: no round meets the rule`);
    const all = candidates.map((ids) => DIFFICULTY.roundProfile(scene, d, ids));
    // how often a replay asks for each object: its share of the valid rounds (every one equally likely)
    const share = new Map();
    for (const ids of valid) for (const id of ids) share.set(id, (share.get(id) ?? 0) + 1 / valid.length);
    const shares = [...share].sort((a, b) => a[1] - b[1]);
    byDifficulty[d] = {
      rule: { ...rule, maxSearch: Number.isFinite(rule.maxSearch) ? rule.maxSearch : null },
      candidates: candidates.length,
      accepted: accepted.length,
      rejectedRounds: candidates.length - accepted.length,
      rejectedBy: rejected,
      objectsReached: new Set(valid.flat()).size,
      candidateSearch: distribution(all.map((p) => p.search)),
      search: distribution(accepted.map((p) => p.search)),
      decoys: distribution(accepted.map((p) => p.decoys)),
      places: distribution(accepted.map((p) => p.places)),
      popOuts: distribution(accepted.map((p) => p.popOuts)),
      semantic: accepted[0]?.semantic ?? null,
      totalLoad: distribution(accepted.map((p) => p.count * (p.search + p.semantic / 3))),
      exposure: {
        leastAsked: shares.length ? [shares[0][0], round3(shares[0][1])] : null,
        mostAsked: shares.length ? [shares.at(-1)[0], round3(shares.at(-1)[1])] : null,
        sceneryHere: scene.pool.filter((t) => !share.has(t.id)).map((t) => t.id),
      },
    };
  }
  // clues: which variants a stream of seeds tells, per level
  const clueUse = {};
  for (const d of ["medium", "hard"]) {
    const seen = {};
    for (let i = 0; i < 4000; i += 1) {
      const seed = Math.imul(i + 1, 2654435761) >>> 0;
      const ids = ROUNDS.selectRoundTargets(scene, d, seed);
      const clues = CLUES.selectRoundClues(scene, d, seed, ids);
      for (const id of ids) for (const index of [clues[id].list, clues[id].reclue]) if (index !== null) (seen[id] ??= new Set()).add(index);
    }
    const preset = CONTRACT.DIFFICULTY_PRESETS[d];
    const levels = [preset.listClue, preset.reclue].filter(Boolean);
    const possible = Object.fromEntries(scene.pool.map((t) => [t.id, levels.flatMap((level) => CLUES.variantsAt(t, level))]));
    const missing = Object.keys(seen).filter((id) => possible[id].some((index) => !seen[id].has(index)));
    if (missing.length) problems.push(`${scene.id}/${d}: variants never told for ${missing.join(", ")}`);
    clueUse[d] = { objectsTold: Object.keys(seen).length, everyVariantTold: missing.length === 0 };
  }
  const levelCounts = Object.fromEntries(["direct", "associative", "indirect"].map((level) => [level, scene.pool.reduce((n, t) => n + t.clues.filter((c) => c.level === level).length, 0)]));
  rooms[scene.id] = {
    name: scene.name,
    pool: scene.pool.length,
    tiers: Object.fromEntries(["A", "B", "C"].map((tier) => [tier, scene.pool.filter((t) => t.tier === tier).length])),
    lookAlikes: scene.lookAlikes.length,
    loads,
    parts,
    difficulties: byDifficulty,
    clues: { total: scene.pool.reduce((n, t) => n + t.clues.length, 0), byLevel: levelCounts, use: clueUse },
  };
}

// the progression, room by room and pooled: every Médio round above every Fácil one, every Difícil above every Médio
for (const [id, room] of Object.entries(rooms)) {
  const e = room.difficulties.easy.search;
  const m = room.difficulties.medium.search;
  const h = room.difficulties.hard.search;
  if (!(m.min >= e.max && h.min >= m.max)) problems.push(`${id}: the bands overlap (Fácil ${e.min}–${e.max}, Médio ${m.min}–${m.max}, Difícil ${h.min}–${h.max})`);
  const decoys = DIFFICULTIES.map((d) => room.difficulties[d].decoys.mean);
  if (!(decoys[2] > decoys[0])) problems.push(`${id}: Difícil's look-alike pressure is not above Fácil's (${decoys.join(" / ")})`);
}

const report = {
  mission: "GAME03-CALIBRATION-02A",
  generatedBy: "node tools/validation/hidden-objects-calibration.mjs",
  base: CALIBRATION_BASE,
  reference: { ...derived, matchesTheProduct: JSON.stringify(product) === JSON.stringify(derived), v2 },
  rooms,
  problems,
  verdict: problems.length ? "CALIBRATION_REPORT_FAILED" : "CALIBRATION_REPORT_OK",
  seconds: Number(((Date.now() - started) / 1000).toFixed(1)),
};

// --- the human-readable report --------------------------------------------------------------------------

function markdown() {
  const name = { easy: "Fácil", medium: "Médio", hard: "Difícil" };
  const reason = {
    tiers: "tiers fora dos limites",
    "glance finds": "achados de relance demais",
    "below the floor": "abaixo do piso",
    "at or above the next floor": "no piso seguinte ou acima",
    "look-alike pressure": "poucas sósias",
  };
  const pct = (pair) => (pair ? `${pair[0]} ${(pair[1] * 100).toFixed(1)}%` : "—");
  const L = [];
  L.push("# Game 03 · Difficulty V3 — relatório de calibração");
  L.push("");
  L.push("Gerado por `node tools/validation/hidden-objects-calibration.mjs --out docs/archive/game03-calibration-02a`.");
  L.push(`Base de referência: \`${CALIBRATION_BASE.slice(0, 7)}\` (Difficulty V2, arte v1 das duas salas). Veredito: **${report.verdict}**.`);
  L.push("");
  L.push("## 1. A régua e os pisos, derivados da base");
  L.push("");
  L.push(`- Borda: ${derived.ruler.edge.blends} (piso de justiça) → 1, ${derived.ruler.edge.pops} (P90 da arte v1) → 0.`);
  L.push(`- Desordem ao redor: ${derived.ruler.clutter.calm} (P10) → 0, ${derived.ruler.clutter.busy} (P90) → 1.`);
  L.push(`- Tamanho (√área, su): ${derived.ruler.side.large} (P90) → 0, ${derived.ruler.side.small} (P10) → 1.`);
  L.push(`- Achado de relance: carga < ${derived.popOut} (meio caminho entre a média dos A e a dos B da arte v1).`);
  L.push(`- Pisos de busca (Difícil V2, ${v2.hard.pooled.search.n} rodadas das duas salas): Fácil ${derived.floors.easy} (P25) · Médio ${derived.floors.medium} (média) · Difícil ${derived.floors.hard} (máximo).`);
  L.push(`- Pisos de sósias por objeto: Fácil ${derived.decoyFloors.easy} · Médio ${derived.decoyFloors.medium} · Difícil ${derived.decoyFloors.hard}.`);
  L.push(`- Constantes do produto iguais às derivadas: **${report.reference.matchesTheProduct ? "sim" : "NÃO"}**.`);
  L.push("");
  L.push("| V2 (base) | Fácil | Médio | Difícil |");
  L.push("| --- | --- | --- | --- |");
  for (const [key, label] of [["min", "mín."], ["mean", "média"], ["max", "máx."]]) L.push(`| busca ${label} | ${DIFFICULTIES.map((d) => v2[d].pooled.search[key]).join(" | ")} |`);
  L.push(`| sósias/objeto (média) | ${DIFFICULTIES.map((d) => v2[d].pooled.decoys.mean).join(" | ")} |`);
  for (const room of Object.values(rooms)) {
    L.push("");
    L.push(`## ${room.name}`);
    L.push("");
    L.push(`Pool ${room.pool} (A${room.tiers.A} B${room.tiers.B} C${room.tiers.C}) · ${room.lookAlikes} sósias · ${room.clues.total} pistas (diretas ${room.clues.byLevel.direct}, associativas ${room.clues.byLevel.associative}, indiretas ${room.clues.byLevel.indirect}).`);
    L.push("");
    L.push("| | Candidatas | Aceitas | Rejeitadas | Objetos alcançados | Busca min · média · max | Sósias/objeto (média) | Lugares (média) | Relance (média) |");
    L.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const d of DIFFICULTIES) {
      const r = room.difficulties[d];
      L.push(`| ${name[d]} | ${r.candidates} | ${r.accepted} | ${r.rejectedRounds} | ${r.objectsReached} | ${r.search.min} · ${r.search.mean} · ${r.search.max} | ${r.decoys.mean} | ${r.places.mean} | ${r.popOuts.mean} |`);
    }
    L.push("");
    for (const d of DIFFICULTIES) {
      const r = room.difficulties[d];
      L.push(
        `- ${name[d]}: rejeitadas por ${Object.entries(r.rejectedBy).map(([why, n]) => `${reason[why] ?? why} ${n}`).join(", ") || "—"} (uma rodada pode falhar em mais de um critério). ` +
          `Busca das candidatas: ${r.candidateSearch.min}–${r.candidateSearch.max} (média ${r.candidateSearch.mean}). Histograma das aceitas: ${Object.entries(r.search.histogram).map(([bin, n]) => `${bin}: ${n}`).join(", ")}. ` +
          `Objeto mais pedido: ${pct(r.exposure.mostAsked)} das rodadas; menos pedido: ${pct(r.exposure.leastAsked)}; só cenário aqui: ${r.exposure.sceneryHere.join(", ") || "nenhum"}.`,
      );
    }
    L.push("");
    L.push(`Carga de busca por objeto: ${Object.entries(room.loads).map(([o, v]) => `${o} ${v}`).join(" · ")}.`);
  }
  L.push("");
  L.push(problems.length ? `Problemas: ${problems.join("; ")}` : "Nenhum invariante falhou.");
  return `${L.join("\n")}\n`;
}

for (const [id, room] of Object.entries(rooms)) {
  for (const d of DIFFICULTIES) {
    const r = room.difficulties[d];
    console.log(`${id.padEnd(22)} ${d.padEnd(6)} candidates ${String(r.candidates).padStart(6)} · accepted ${String(r.accepted).padStart(5)} · search ${r.search.min}..${r.search.max} (mean ${r.search.mean}) · decoys ${r.decoys.mean}`);
  }
}
console.log(`reference: floors ${JSON.stringify(derived.floors)} · decoys ${JSON.stringify(derived.decoyFloors)} · pop-out ${derived.popOut} · matches the product: ${report.reference.matchesTheProduct}`);
if (OUT) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "calibration-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT, "calibration-report.md"), markdown());
  console.log(`written: ${path.join(OUT, "calibration-report.json")}, ${path.join(OUT, "calibration-report.md")}`);
}
for (const problem of problems) console.log(`PROBLEM  ${problem}`);
console.log(`${report.verdict} (${report.seconds} s)`);
process.exit(problems.length ? EXIT_FAILED : EXIT_OK);
