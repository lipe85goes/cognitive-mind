/**
 * GAME03-EXPERIENCE-02 — round fairness report for the Estúdio das Descobertas; per room since
 * GAME03-MULTISCENE-03 (--scene: explorer-studio, the default, or explorer-observatory).
 *
 * Runs the game's own round selection (`selectRoundTargets`, hidden-objects-rounds.ts, loaded from
 * source) the way the product does — one 32-bit seed per "Explorar" — over a fixed, reproducible stream
 * of seeds, and reports what the lists really asked for:
 *
 *   - per object: how often it is listed and how often it is the first line, measured, next to the exact
 *     probability that "every valid round equally likely" gives (enumerated), and its exposure against
 *     its tier's mean;
 *   - tiers: the mix of every drawn round, and the tier of each line of the list;
 *   - stations: how the rounds spread over the room's stations, each station's share of the listed
 *     objects, and which station the first line points to;
 *   - perceptual load: what the measured art audit (visible share, edge contrast, look-alikes) says each
 *     difficulty's lists ask of the eye.
 *
 * The seeds are a Weyl sequence through the murmur3 finalizer (uniform 32-bit values, like
 * `crypto.getRandomValues`), so the same command always prints the same report. Read-only: nothing is
 * written except the report itself (--out).
 *
 * Usage:
 *   node tools/validation/hidden-objects-round-fairness.mjs [--scene ID] [--samples N] [--out DIR]
 *
 *   --scene ID   the room (default explorer-studio)
 *   --samples N  seeds per difficulty (default 1000000)
 *   --out DIR    write fairness-report.json and fairness-report.md there
 *
 * Exit: 0 every invariant held · 1 an invariant failed · 3 usage error.
 */
import fs from "node:fs";
import path from "node:path";
import { createModuleGraph } from "./route-module-loader.mjs";

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_USAGE = 3;

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const SAMPLES = Number(arg("--samples", "1000000"));
const SCENE_ID = arg("--scene", "explorer-studio");
const OUT = arg("--out", null);
if (!Number.isInteger(SAMPLES) || SAMPLES < 1000) {
  console.error("usage: node tools/validation/hidden-objects-round-fairness.mjs [--samples N≥1000] [--out DIR]");
  process.exit(EXIT_USAGE);
}

const graph = createModuleGraph({ mocks: {}, globals: {} });
const CONTRACT = graph.require("src/games/hidden-objects/hidden-objects-scene.ts");
const ROOM = graph.require("src/games/hidden-objects/hidden-objects-scenes.ts").sceneById(SCENE_ID);
if (!ROOM) {
  console.error(`no room ${SCENE_ID} in the registry`);
  process.exit(EXIT_USAGE);
}
const ROUNDS = graph.require("src/games/hidden-objects/hidden-objects-rounds.ts");
const ASSET_BASE = ROOM.layers.find((layer) => layer.id === "plate").src.replace(/\/plate\.webp$/, "");
const KIT = ASSET_BASE.split("/").pop();
const AUDIT = JSON.parse(fs.readFileSync(`docs/archive/hidden-objects/${SCENE_ID}/review/${KIT}/fairness.json`, "utf8"));
const MEASURED = Object.fromEntries(AUDIT.targets.map((row) => [row.id, row]));

const DIFFICULTIES = ["easy", "medium", "hard"];
const TIERS = ["A", "B", "C"];
const STATIONS = ROOM.stations.map((s) => s.id);
const STATION_LABELS = ROOM.stations.map((s) => s.label);
const POOL = ROOM.pool;
const BY_ID = Object.fromEntries(POOL.map((t) => [t.id, t]));

/** Uniform 32-bit seeds, reproducible: a Weyl sequence through the murmur3 finalizer. */
function seedStream(start) {
  let state = start >>> 0;
  return () => {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b);
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35);
    return (z ^ (z >>> 16)) >>> 0;
  };
}

const round3 = (x) => Number(x.toFixed(3));
const round4 = (x) => Number(x.toFixed(4));
const pct = (x) => `${(100 * x).toFixed(1)}%`;
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const zOf = (observed, p, n) => (p <= 0 || p >= 1 ? (observed === p ? 0 : Infinity) : (observed - p) / Math.sqrt((p * (1 - p)) / n));
const stationPattern = (ids) => STATIONS.map((s) => ids.filter((id) => BY_ID[id].station === s).length).join("-");
const tierMix = (ids) => TIERS.map((tier) => `${tier}${ids.filter((id) => BY_ID[id].tier === tier).length}`).join(" ");

const problems = [];
const report = {
  mission: "GAME03-EXPERIENCE-02 (per room since GAME03-MULTISCENE-03)",
  scene: SCENE_ID,
  generatedBy: "node tools/validation/hidden-objects-round-fairness.mjs",
  samplesPerDifficulty: SAMPLES,
  seeds: "Weyl sequence (step 0x9e3779b9) through the murmur3 finalizer; start 0x5eed0000 + difficulty index",
  kit: { base: ASSET_BASE, plateSha256: AUDIT.plateSha256, auditRule: AUDIT.rule },
  pool: {
    size: POOL.length,
    tiers: Object.fromEntries(TIERS.map((tier) => [tier, POOL.filter((t) => t.tier === tier).length])),
    stations: Object.fromEntries(STATIONS.map((s) => [s, POOL.filter((t) => t.station === s).length])),
    grid: Object.fromEntries(STATIONS.map((s) => [s, Object.fromEntries(TIERS.map((tier) => [tier, POOL.filter((t) => t.station === s && t.tier === tier).map((t) => t.id)]))])),
  },
  difficulties: {},
};

const started = Date.now();
for (const [index, difficulty] of DIFFICULTIES.entries()) {
  const preset = CONTRACT.DIFFICULTY_PRESETS[difficulty];
  const k = preset.count;
  const listable = POOL.filter((t) => ROUNDS.listableIn(t, preset));
  // what a round of this difficulty can ask for: its list style shows it and its tier is drawn
  const drawable = listable.filter((t) => preset.tiers[t.tier] > 0);
  const valid = ROUNDS.validRounds(ROOM, difficulty);
  const roundIndex = new Map(valid.map((round, i) => [[...round].sort().join(), i]));
  const spread = ROUNDS.stationSpread(k, STATIONS.length);

  // exact: every valid round equally likely
  const exact = Object.fromEntries(POOL.map((t) => [t.id, 0]));
  const exactPatterns = {};
  for (const round of valid) {
    for (const id of round) exact[id] += 1 / valid.length;
    const pattern = stationPattern(round);
    exactPatterns[pattern] = (exactPatterns[pattern] ?? 0) + 1 / valid.length;
  }

  // measured: the real selection, one seed per exploration
  const next = seedStream(0x5eed0000 + index);
  const listed = Object.fromEntries(POOL.map((t) => [t.id, 0]));
  const firstLine = Object.fromEntries(POOL.map((t) => [t.id, 0]));
  const roundHits = new Array(valid.length).fill(0);
  const patterns = {};
  const mixes = {};
  const tierAtLine = Array.from({ length: k }, () => Object.fromEntries(TIERS.map((tier) => [tier, 0])));
  const stationAtLine = Array.from({ length: k }, () => Object.fromEntries(STATIONS.map((s) => [s, 0])));
  const belowEighty = {};
  let invalid = 0;
  const loads = { visible: 0, edge: 0, lookAlikes: 0 };
  for (let n = 0; n < SAMPLES; n += 1) {
    const list = ROUNDS.selectRoundTargets(ROOM, difficulty, next());
    const key = [...list].sort().join();
    if (list.length !== k || new Set(list).size !== k || !roundIndex.has(key)) {
      invalid += 1;
      continue;
    }
    roundHits[roundIndex.get(key)] += 1;
    for (const [line, id] of list.entries()) {
      listed[id] += 1;
      tierAtLine[line][BY_ID[id].tier] += 1;
      stationAtLine[line][BY_ID[id].station] += 1;
    }
    firstLine[list[0]] += 1;
    const pattern = stationPattern(list);
    patterns[pattern] = (patterns[pattern] ?? 0) + 1;
    const mix = tierMix(list);
    mixes[mix] = (mixes[mix] ?? 0) + 1;
    const below = list.filter((id) => MEASURED[id].visible < 0.8).length;
    belowEighty[below] = (belowEighty[below] ?? 0) + 1;
    loads.visible += mean(list.map((id) => MEASURED[id].visible));
    loads.edge += mean(list.map((id) => MEASURED[id].edge));
    loads.lookAlikes += mean(list.map((id) => MEASURED[id].lookAlikes.length));
  }
  const drawn = SAMPLES - invalid;

  // per object
  const objects = POOL.map((t) => {
    const canList = drawable.includes(t);
    const tierMean = preset.tiers[t.tier] / drawable.filter((o) => o.tier === t.tier).length;
    const frequency = listed[t.id] / drawn;
    return {
      id: t.id,
      tier: t.tier,
      station: t.station,
      drawable: canList,
      whyNot: canList ? null : !preset.tiers[t.tier] ? `the difficulty draws no tier ${t.tier}` : `the ${preset.listStyle} list cannot show it`,
      exact: round4(exact[t.id]),
      measured: round4(frequency),
      z: Number(zOf(frequency, exact[t.id], drawn).toFixed(2)),
      firstLine: round4(firstLine[t.id] / drawn),
      firstLineExact: round4(exact[t.id] / k),
      exposureOverTierMean: canList && preset.tiers[t.tier] ? round3(exact[t.id] / tierMean) : null,
    };
  });

  // tiers and stations, line by line
  const tierShareExpected = Object.fromEntries(TIERS.map((tier) => [tier, preset.tiers[tier] / k]));
  const tierByLine = tierAtLine.map((counts) => Object.fromEntries(TIERS.map((tier) => [tier, round4(counts[tier] / drawn)])));
  const stationExpected = Object.fromEntries(STATIONS.map((s) => [s, round4(valid.reduce((sum, round) => sum + round.filter((id) => BY_ID[id].station === s).length, 0) / valid.length / k)]));
  const stationByLine = stationAtLine.map((counts) => Object.fromEntries(STATIONS.map((s) => [s, round4(counts[s] / drawn)])));
  const stationShare = Object.fromEntries(STATIONS.map((s) => [s, round4(stationAtLine.reduce((sum, counts) => sum + counts[s], 0) / (drawn * k))]));

  // invariants
  const expectedPerRound = drawn / valid.length;
  const chiSquare = roundHits.reduce((sum, hits) => sum + (hits - expectedPerRound) ** 2 / expectedPerRound, 0);
  const chiZ = (chiSquare - (valid.length - 1)) / Math.sqrt(2 * (valid.length - 1));
  const reached = roundHits.filter((hits) => hits > 0).length;
  const patternsSeen = Object.keys(patterns);
  const allowedPattern = (pattern) => pattern.split("-").map(Number).every((n) => n >= spread.min && n <= spread.max);
  if (invalid) problems.push(`${difficulty}: ${invalid} drawn lists were not valid rounds`);
  if (reached !== valid.length) problems.push(`${difficulty}: ${reached}/${valid.length} valid rounds reached`);
  if (Math.abs(chiZ) > 4) problems.push(`${difficulty}: round frequencies off uniform (z = ${chiZ.toFixed(2)})`);
  for (const o of objects) {
    if (Math.abs(o.z) > 5) problems.push(`${difficulty}: ${o.id} drawn ${pct(o.measured)} against exact ${pct(o.exact)} (z = ${o.z})`);
    if (o.drawable && (o.exact === 0 || o.measured === 0)) problems.push(`${difficulty}: ${o.id} can be asked for but never is`);
    if (!o.drawable && o.measured > 0) problems.push(`${difficulty}: ${o.id} is listed although ${o.whyNot}`);
    if (o.exposureOverTierMean !== null && (o.exposureOverTierMean < 0.5 || o.exposureOverTierMean > 2)) problems.push(`${difficulty}: ${o.id} exposure ${o.exposureOverTierMean}× its tier's mean`);
  }
  if (Object.keys(mixes).length !== 1 || Object.keys(mixes)[0] !== tierMix(valid[0])) problems.push(`${difficulty}: tier mixes ${JSON.stringify(mixes)}`);
  if (!patternsSeen.every(allowedPattern)) problems.push(`${difficulty}: a station pattern outside ⌊k/3⌋..⌈k/3⌉: ${patternsSeen.join(", ")}`);
  for (const [line, shares] of tierByLine.entries()) {
    for (const tier of TIERS) {
      const z = zOf(shares[tier], tierShareExpected[tier], drawn);
      if (Math.abs(z) > 5) problems.push(`${difficulty}: line ${line + 1} is tier ${tier} ${pct(shares[tier])} of the time (expected ${pct(tierShareExpected[tier])})`);
    }
  }
  for (const [line, shares] of stationByLine.entries()) {
    for (const s of STATIONS) {
      const z = zOf(shares[s], stationExpected[s], drawn);
      if (Math.abs(z) > 5) problems.push(`${difficulty}: line ${line + 1} points to ${s} ${pct(shares[s])} of the time (expected ${pct(stationExpected[s])})`);
    }
  }

  // perceptual load (measured art audit), exact over every valid round
  const exactLoad = {
    visible: mean(valid.map((round) => mean(round.map((id) => MEASURED[id].visible)))),
    edge: mean(valid.map((round) => mean(round.map((id) => MEASURED[id].edge)))),
    lookAlikes: mean(valid.map((round) => mean(round.map((id) => MEASURED[id].lookAlikes.length)))),
    belowEightyVisible: mean(valid.map((round) => round.filter((id) => MEASURED[id].visible < 0.8).length)),
    belowEightyVisibleMax: Math.max(...valid.map((round) => round.filter((id) => MEASURED[id].visible < 0.8).length)),
  };

  report.difficulties[difficulty] = {
    preset: { count: k, tiers: preset.tiers, listStyle: preset.listStyle, hintLadder: preset.hintLadder ?? null },
    drawablePool: drawable.length,
    stationSpread: spread,
    validRounds: valid.length,
    drawn,
    invalid,
    reached,
    chiSquareZ: Number(chiZ.toFixed(2)),
    maxObjectZ: Math.max(...objects.map((o) => Math.abs(o.z))),
    objects,
    tiers: {
      mixPerRound: Object.fromEntries(Object.entries(mixes).map(([mix, hits]) => [mix, round4(hits / drawn)])),
      expectedShare: Object.fromEntries(Object.entries(tierShareExpected).map(([tier, share]) => [tier, round4(share)])),
      byLine: tierByLine,
    },
    stations: {
      patterns: Object.fromEntries(
        Object.keys({ ...exactPatterns, ...patterns })
          .sort()
          .map((pattern) => [pattern, { exact: round4(exactPatterns[pattern] ?? 0), measured: round4((patterns[pattern] ?? 0) / drawn) }]),
      ),
      shareOfListed: stationShare,
      shareOfListedExact: stationExpected,
      firstLine: stationByLine[0],
    },
    perceptualLoad: {
      exact: Object.fromEntries(Object.entries(exactLoad).map(([key, value]) => [key, round3(value)])),
      measured: { visible: round3(loads.visible / drawn), edge: round3(loads.edge / drawn), lookAlikes: round3(loads.lookAlikes / drawn) },
      objectsBelow80PercentVisiblePerRound: Object.fromEntries(Object.entries(belowEighty).sort().map(([count, hits]) => [count, round4(hits / drawn)])),
    },
  };
}
report.seconds = Number(((Date.now() - started) / 1000).toFixed(1));

// the difficulties ask more of the eye as they climb (the experience suite's E33, restated on the samples)
const load = (d) => report.difficulties[d].perceptualLoad.exact;
if (!(load("easy").visible > load("medium").visible && load("medium").visible > load("hard").visible)) problems.push("perceptual load: visible share does not fall as the difficulty climbs");
if (!(load("hard").lookAlikes > load("easy").lookAlikes)) problems.push("perceptual load: Difícil does not stand among more look-alikes than Fácil");
report.problems = problems;
report.verdict = problems.length ? "ROUND_FAIRNESS_FAILED" : "ROUND_FAIRNESS_OK";

// --- the human-readable report ----------------------------------------------------------------------

function markdown() {
  const name = { easy: "Fácil", medium: "Médio", hard: "Difícil" };
  const lines = [];
  lines.push(`# Estúdio das Descobertas · ${ROOM.name} — relatório de justiça das rodadas`);
  lines.push("");
  lines.push("Gerado por `node tools/validation/hidden-objects-round-fairness.mjs --out docs/archive/game03-experience-02`.");
  lines.push(`Cada dificuldade: ${SAMPLES.toLocaleString("pt-BR")} explorações simuladas com a seleção real do jogo`);
  lines.push("(`selectRoundTargets`), uma semente de 32 bits por exploração (sequência fixa, reproduzível).");
  lines.push("\"Exato\" é a probabilidade enumerada (toda rodada válida igualmente provável); \"medido\" é o que as");
  lines.push(`sementes de fato sortearam. Kit de arte \`${KIT}\`, plate \`${AUDIT.plateSha256.slice(0, 12)}…\`. Veredito: **${report.verdict}**.`);
  lines.push("");
  lines.push(`Pool: ${POOL.length} objetos · tiers ${TIERS.map((tier) => `${tier}${report.pool.tiers[tier]}`).join(" ")} · ${ROOM.stations.map((s) => `${s.label} ${report.pool.stations[s.id]}`).join(", ")}.`);
  lines.push("");
  lines.push("| Dificuldade | Lista | Objetos | Mistura de tiers | Pool sorteável | Rodadas válidas | Alcançadas | χ² (z) | maior \\|z\\| por objeto |");
  lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const d of DIFFICULTIES) {
    const r = report.difficulties[d];
    lines.push(`| ${name[d]} | ${r.preset.listStyle} | ${r.preset.count} | ${TIERS.map((tier) => `${tier}${r.preset.tiers[tier]}`).join(" ")} | ${r.drawablePool} | ${r.validRounds} | ${r.reached} | ${r.chiSquareZ} | ${r.maxObjectZ} |`);
  }
  for (const d of DIFFICULTIES) {
    const r = report.difficulties[d];
    lines.push("");
    lines.push(`## ${name[d]}`);
    lines.push("");
    lines.push("Frequência por objeto (quantas rodadas o listam; primeira linha; exposição ÷ média do tier):");
    lines.push("");
    lines.push("| Objeto | Tier | Estação | Exato | Medido | z | 1ª linha | Exposição ÷ média do tier |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const o of r.objects) {
      const why = o.whyNot?.startsWith("the difficulty") ? "tier fora da dificuldade" : "a lista não o mostra";
      lines.push(`| ${o.id} | ${o.tier} | ${o.station} | ${o.drawable ? pct(o.exact) : `nunca (${why})`} | ${pct(o.measured)} | ${o.drawable ? o.z : "—"} | ${pct(o.firstLine)} | ${o.exposureOverTierMean ?? "—"} |`);
    }
    lines.push("");
    lines.push(`Tiers por rodada: ${Object.entries(r.tiers.mixPerRound).map(([mix, share]) => `${mix} em ${pct(share)}`).join("; ")}.`);
    lines.push(`Tier da 1ª linha: ${TIERS.map((tier) => `${tier} ${pct(r.tiers.byLine[0][tier])} (esperado ${pct(r.tiers.expectedShare[tier])})`).join(" · ")}.`);
    lines.push("");
    lines.push(`Estações (${STATION_LABELS.join("-")} por rodada; parte dos objetos listados; 1ª linha):`);
    lines.push("");
    lines.push("| Padrão J-M-E | Exato | Medido |");
    lines.push("| --- | --- | --- |");
    for (const [pattern, shares] of Object.entries(r.stations.patterns)) lines.push(`| ${pattern} | ${pct(shares.exact)} | ${pct(shares.measured)} |`);
    lines.push("");
    lines.push(`Parte dos listados: ${STATIONS.map((s) => `${s} ${pct(r.stations.shareOfListed[s])}`).join(" · ")} · 1ª linha: ${STATIONS.map((s) => `${s} ${pct(r.stations.firstLine[s])}`).join(" · ")}.`);
    const l = r.perceptualLoad.exact;
    lines.push("");
    lines.push(`Carga perceptiva (auditoria medida, média exata das rodadas): visível ${pct(l.visible)} · borda ${l.edge}:1 · sósias por objeto ${l.lookAlikes} · objetos abaixo de 80% visíveis por rodada ${l.belowEightyVisible} (máx. ${l.belowEightyVisibleMax}).`);
  }
  lines.push("");
  lines.push(problems.length ? `Problemas: ${problems.join("; ")}` : "Nenhum invariante falhou.");
  return `${lines.join("\n")}\n`;
}

for (const d of DIFFICULTIES) {
  const r = report.difficulties[d];
  console.log(`${d.padEnd(6)} valid ${r.validRounds} · reached ${r.reached} · χ² z ${r.chiSquareZ} · max object |z| ${r.maxObjectZ} · visible ${pct(r.perceptualLoad.exact.visible)} · look-alikes ${r.perceptualLoad.exact.lookAlikes}`);
}
if (OUT) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "fairness-report.json"), `${JSON.stringify(report, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT, "fairness-report.md"), markdown());
  console.log(`written: ${path.join(OUT, "fairness-report.json")}, ${path.join(OUT, "fairness-report.md")}`);
}
for (const problem of problems) console.log(`PROBLEM  ${problem}`);
console.log(`${report.verdict} (${report.seconds} s)`);
process.exit(problems.length ? EXIT_FAILED : EXIT_OK);
