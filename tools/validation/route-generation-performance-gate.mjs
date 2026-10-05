/**
 * ROUTE-PERF-WORKER-DECISION-01 — how long does Route generation take, today,
 * outside any browser? (Measurement 1 + 2 of the C7 decision.)
 *
 * Read-only. The Rota's generation closure (whichever module declares
 * `generateMaze`, and what it reaches at run time) is bundled by
 * `route-module-loader.mjs#emitModuleBundle` and evaluated in Node's MAIN
 * realm — no `vm` sandbox, no global proxy — so the timed code is production's
 * own text, transpiled, calling the real `Math`. Two copies of it:
 *
 *   TIMING       unmodified. Each sample arms the product's own diagnostic seed
 *                (`armRouteRandomSeed`, the launcher's seam) and times exactly
 *                one `generateMaze(difficulty, route)` call. Nothing else runs
 *                inside the timed region.
 *   ATTRIBUTION  the same text plus three counters planted by anchored edits
 *                (attempt started, recovery entered, recovery candidate) and a
 *                `Math` whose `random` counts draws over the same PRNG. Every
 *                sample is replayed on the same seed and must give the SAME map
 *                as TIMING did (digest equality), which proves the probes are
 *                behaviour-neutral and the PRNG identical; then attempts,
 *                recovery and draws are paired with TIMING's wall clock.
 *
 * Plan (fixed before measuring, docs/route-worker-decision.md §1.2): 9
 * combinations (Routes 1/2/3 × easy/medium/hard); an explicit warm-up per
 * combination, discarded; then `--reps` repetitions × `--samples` per
 * combination, combination order rotated per repetition, seeds disjoint from
 * the warm-up and from each other. A small cross-check times the same seeds
 * through the validators' `vm` graph (`loadRouteModules`), to say how far the
 * sandbox the historical numbers came from is from native.
 *
 * Wall-clock figures are RUN METADATA: they differ on every run by
 * construction and are never compared against evidence. The run FAILS only on
 * contract breaks: a generation throws, or a probe changes a map.
 *
 * Usage:
 *   node tools/validation/route-generation-performance-gate.mjs
 *        [--samples 500] [--reps 3] [--warmup 50] [--out FILE.json]
 * Writes nothing unless `--out` is given. Exit: 0 held · 1 failed · 3 usage.
 */
import fs from "node:fs";
import os from "node:os";
import vm from "node:vm";
import { createHash } from "node:crypto";
import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";
import { ROUTE_RANDOM_SEAM, anchoredEdits, emitModuleBundle, loadRouteModules, openSourceTree } from "./route-module-loader.mjs";
import { createSeededRandom } from "./route-lab.mjs";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const SAMPLES = Number(flag("--samples", "500"));
const REPS = Number(flag("--reps", "3"));
const WARMUP = Number(flag("--warmup", "50"));
const OUT = flag("--out", null);
if (![SAMPLES, REPS, WARMUP].every((n) => Number.isSafeInteger(n) && n >= 0) || SAMPLES < 1 || REPS < 1) {
  console.error("usage: --samples N (≥1) · --reps N (≥1) · --warmup N (≥0) · --out FILE");
  process.exit(EXIT_USAGE);
}

const ROUTES = [1, 2, 3];
const MODES = ["easy", "medium", "hard"];
const COMBOS = ROUTES.flatMap((route) => MODES.map((mode) => ({ route, mode, id: `R${route}-${mode}` })));
const seedOf = (rep, comboIndex, i) => 1_000_000 * (rep + 1) + comboIndex * 10_000 + i;
const warmupSeedOf = (comboIndex, i) => 900_000 + comboIndex * 1_000 + i;

// --- the two bundles ----------------------------------------------------------------------------

const tree = openSourceTree();
const generationModule = tree.declaring("generateMaze");
const load = (source, ...params) => vm.runInThisContext(source, { filename: "route-generation-bundle.js" })(...params);

const timing = load(emitModuleBundle({ tree, entry: generationModule }));
const timingSeam = timing.require(ROUTE_RANDOM_SEAM);

const PROBES = [
  ["for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {", "for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) { __probe.attempt();"],
  ["  // --- recovery sweep: same gates, deterministic order, bounded -------------", "  __probe.recovery();"],
  ["for (let retry = 0; retry < RECOVERY_RETRIES_PER_SLOT; retry++) {", "for (let retry = 0; retry < RECOVERY_RETRIES_PER_SLOT; retry++) { __probe.recoveryCandidate();"],
];
const probe = {
  reset() {
    this.attempts = 0;
    this.recoveryAt = null;
    this.recoveryCandidates = 0;
    this.draws = 0;
  },
  attempt() {
    this.attempts += 1;
  },
  recovery() {
    this.recoveryAt = performance.now();
  },
  recoveryCandidate() {
    this.recoveryCandidates += 1;
  },
};
let countedRandom = createSeededRandom(1);
const countingMath = Object.create(Math);
countingMath.random = () => {
  probe.draws += 1;
  return countedRandom();
};
const attribution = load(
  emitModuleBundle({ tree, entry: generationModule, transforms: anchoredEdits(tree, PROBES), params: ["Math", "__probe"] }),
  countingMath,
  probe,
);
const stageOf = (route) => {
  const config = timing.require(tree.declaring("getRouteStage"));
  return config.getRouteStage(route);
};

const digest = (map) =>
  createHash("sha256")
    .update(JSON.stringify(map, (_, value) => (value instanceof Set ? [...value].sort() : value)))
    .digest("hex")
    .slice(0, 16);

// --- statistics ---------------------------------------------------------------------------------

const quantile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
const round = (n, d = 2) => (n === null || n === undefined ? null : Number(n.toFixed(d)));
function describe(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const over = (ms) => sorted.filter((v) => v > ms).length;
  return {
    n,
    min: round(sorted[0]),
    p50: round(quantile(sorted, 50)),
    p75: round(quantile(sorted, 75)),
    p90: round(quantile(sorted, 90)),
    p95: round(quantile(sorted, 95)),
    p99: round(quantile(sorted, 99)),
    max: round(sorted[n - 1]),
    mean: round(sorted.reduce((s, v) => s + v, 0) / n),
    over16: over(16),
    over32: over(32),
    over50: over(50),
    over100: over(100),
    over200: over(200),
    over500: over(500),
  };
}
function countStats(values) {
  const sorted = [...values].sort((a, b) => a - b);
  return {
    mean: round(sorted.reduce((s, v) => s + v, 0) / sorted.length),
    p50: quantile(sorted, 50),
    p95: quantile(sorted, 95),
    max: sorted[sorted.length - 1],
  };
}
function ranks(values) {
  const order = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(values.length);
  for (let i = 0; i < order.length; ) {
    let j = i;
    while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j += 1;
    for (let k = i; k <= j; k += 1) r[order[k][1]] = (i + j) / 2;
    i = j + 1;
  }
  return r;
}
function spearman(a, b) {
  const ra = ranks(a);
  const rb = ranks(b);
  const n = a.length;
  const ma = ra.reduce((s, v) => s + v, 0) / n;
  const mb = rb.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i += 1) {
    num += (ra[i] - ma) * (rb[i] - mb);
    da += (ra[i] - ma) ** 2;
    db += (rb[i] - mb) ** 2;
  }
  return da && db ? round(num / Math.sqrt(da * db), 3) : null;
}

// --- running ------------------------------------------------------------------------------------

const failures = [];
function timeOne(combo, seed) {
  timingSeam.armRouteRandomSeed(seed);
  let map = null;
  let threw = false;
  const t0 = performance.now();
  try {
    map = timing.exports.generateMaze(combo.mode, combo.route);
  } catch {
    threw = true;
  }
  const ms = performance.now() - t0;
  return { ms, threw, map };
}
function attributeOne(combo, seed) {
  probe.reset();
  countedRandom = createSeededRandom(seed);
  let map = null;
  let threw = false;
  const t0 = performance.now();
  try {
    map = attribution.exports.generateMaze(combo.mode, combo.route);
  } catch {
    threw = true;
  }
  const t1 = performance.now();
  return {
    map,
    threw,
    attempts: probe.attempts,
    recovery: probe.recoveryAt !== null,
    recoveryCandidates: probe.recoveryCandidates,
    draws: probe.draws,
    randomPhaseMs: (probe.recoveryAt ?? t1) - t0,
    recoveryMs: probe.recoveryAt === null ? 0 : t1 - probe.recoveryAt,
  };
}

console.log(`[gen-perf] node ${process.version} · ${os.cpus()[0]?.model ?? "?"} × ${os.cpus().length} · ${Math.round(os.totalmem() / 2 ** 30)} GiB`);
console.log(`[gen-perf] generation closure: ${tree.closure(generationModule).length} modules, native realm, unmodified text`);
console.log(`[gen-perf] warm-up ${WARMUP}/combination (discarded) · ${REPS} reps × ${SAMPLES}/combination`);

const warmupStart = performance.now();
COMBOS.forEach((combo, c) => {
  for (let i = 0; i < WARMUP; i += 1) {
    timeOne(combo, warmupSeedOf(c, i));
    attributeOne(combo, warmupSeedOf(c, i));
  }
});
console.log(`[gen-perf] warm-up done in ${(performance.now() - warmupStart).toFixed(0)} ms`);

const samples = [];
for (let rep = 0; rep < REPS; rep += 1) {
  const repStart = performance.now();
  for (let k = 0; k < COMBOS.length; k += 1) {
    const c = (k + rep * 4) % COMBOS.length;
    const combo = COMBOS[c];
    for (let i = 0; i < SAMPLES; i += 1) {
      const seed = seedOf(rep, c, i);
      const t = timeOne(combo, seed);
      samples.push({ rep, combo: combo.id, route: combo.route, mode: combo.mode, seed, ms: t.ms, threw: t.threw, digest: t.map ? digest(t.map) : null });
    }
  }
  console.log(`[gen-perf] rep ${rep + 1}/${REPS} timed in ${((performance.now() - repStart) / 1000).toFixed(1)} s`);
}
timingSeam.clearRouteRandomSeed();

// Attribution: the same seeds, replayed through the probed copy.
const attributionStart = performance.now();
let mismatches = 0;
for (const sample of samples) {
  const combo = COMBOS.find((entry) => entry.id === sample.combo);
  const a = attributeOne(combo, sample.seed);
  const same = a.threw === sample.threw && (a.map ? digest(a.map) : null) === sample.digest;
  if (!same) {
    mismatches += 1;
    if (mismatches <= 5) failures.push(`probe changed the map: ${sample.combo} seed ${sample.seed}`);
  }
  Object.assign(sample, {
    attempts: a.attempts,
    recovery: a.recovery,
    recoveryCandidates: a.recoveryCandidates,
    draws: a.draws,
    randomPhaseMs: a.randomPhaseMs,
    recoveryMs: a.recoveryMs,
  });
}
console.log(`[gen-perf] attribution replay done in ${((performance.now() - attributionStart) / 1000).toFixed(1)} s · map mismatches ${mismatches}`);
const throws = samples.filter((s) => s.threw).length;
if (throws) failures.push(`${throws} generation(s) threw`);

// Cross-check: the validators' vm sandbox on the same seeds (Route 3 hard, first rep).
const sandbox = loadRouteModules({ surface: ["generateMaze"] });
const crossSeeds = samples.filter((s) => s.combo === "R3-hard" && s.rep === 0).slice(0, 200);
for (const s of crossSeeds.slice(0, 20)) {
  sandbox.setSeed(s.seed);
  sandbox.api.generateMaze("hard", 3);
}
const crossVm = [];
const crossNative = [];
for (const s of crossSeeds) {
  sandbox.setSeed(s.seed);
  let t0 = performance.now();
  const viaVm = sandbox.api.generateMaze("hard", 3);
  crossVm.push(performance.now() - t0);
  const native = timeOne({ route: 3, mode: "hard" }, s.seed);
  crossNative.push(native.ms);
  if (digest(viaVm) !== s.digest) failures.push(`vm sandbox and native bundle disagree on R3-hard seed ${s.seed}`);
}
timingSeam.clearRouteRandomSeed();

// --- report -------------------------------------------------------------------------------------

const by = (filter) => samples.filter(filter);
const combos = COMBOS.map((combo) => {
  const rows = by((s) => s.combo === combo.id);
  const recovery = rows.filter((s) => s.recovery);
  return {
    combo: combo.id,
    route: combo.route,
    stage: stageOf(combo.route),
    mode: combo.mode,
    timeMs: describe(rows.map((s) => s.ms)),
    throws: rows.filter((s) => s.threw).length,
    attempts: countStats(rows.map((s) => s.attempts)),
    draws: countStats(rows.map((s) => s.draws)),
    recoveryIncidence: `${recovery.length}/${rows.length}`,
    recoveryMsP50: recovery.length ? describe(recovery.map((s) => s.ms)).p50 : null,
    perRepP95: Array.from({ length: REPS }, (_, rep) => describe(rows.filter((s) => s.rep === rep).map((s) => s.ms)).p95),
    spearmanMsAttempts: spearman(rows.map((s) => s.ms), rows.map((s) => s.attempts)),
    spearmanMsDraws: spearman(rows.map((s) => s.ms), rows.map((s) => s.draws)),
  };
});
const total = {
  timeMs: describe(samples.map((s) => s.ms)),
  throws,
  attempts: countStats(samples.map((s) => s.attempts)),
  draws: countStats(samples.map((s) => s.draws)),
  recoveryIncidence: `${samples.filter((s) => s.recovery).length}/${samples.length}`,
  perRep: Array.from({ length: REPS }, (_, rep) => {
    const d = describe(by((s) => s.rep === rep).map((s) => s.ms));
    return { rep: rep + 1, p50: d.p50, p95: d.p95, p99: d.p99, max: d.max };
  }),
  spearmanMsAttempts: spearman(samples.map((s) => s.ms), samples.map((s) => s.attempts)),
  spearmanMsDraws: spearman(samples.map((s) => s.ms), samples.map((s) => s.draws)),
};

// Outliers: the slowest 1 % of each combination against the rest of it.
const outliers = { definition: "slowest 1% of each combination (per-combination p99 and above)", rows: [] };
for (const combo of COMBOS) {
  const rows = by((s) => s.combo === combo.id).sort((a, b) => a.ms - b.ms);
  const cut = Math.floor(rows.length * 0.99);
  const tail = rows.slice(cut);
  const body = rows.slice(0, cut);
  outliers.rows.push({
    combo: combo.id,
    tailN: tail.length,
    tailMs: round(tail.reduce((s, r) => s + r.ms, 0) / tail.length),
    tailAttemptsMean: round(tail.reduce((s, r) => s + r.attempts, 0) / tail.length),
    restAttemptsMean: round(body.reduce((s, r) => s + r.attempts, 0) / body.length),
    tailDrawsMean: round(tail.reduce((s, r) => s + r.draws, 0) / tail.length),
    restDrawsMean: round(body.reduce((s, r) => s + r.draws, 0) / body.length),
    tailRecovery: tail.filter((r) => r.recovery).length,
  });
}
const perAttemptMs = round(samples.reduce((s, r) => s + r.ms, 0) / samples.reduce((s, r) => s + r.attempts + r.recoveryCandidates, 0), 3);
const aggregate = (key) =>
  [...new Set(samples.map((s) => s[key]))].map((value) => {
    const rows = by((s) => s[key] === value);
    const d = describe(rows.map((s) => s.ms));
    return { [key]: value, n: rows.length, p50: d.p50, p95: d.p95, p99: d.p99, max: d.max, attemptsMean: countStats(rows.map((s) => s.attempts)).mean };
  });

const report = {
  mission: "ROUTE-PERF-WORKER-DECISION-01",
  kind: "RUN METADATA — wall-clock timing, differs on every run; never compared as evidence",
  machine: { node: process.version, cpu: os.cpus()[0]?.model ?? null, cores: os.cpus().length, memGiB: Math.round(os.totalmem() / 2 ** 30), platform: `${os.platform()} ${os.release()}` },
  plan: { warmupPerCombination: WARMUP, reps: REPS, samplesPerCombinationPerRep: SAMPLES, realm: "node main realm, generation closure bundled, unmodified text, real Math, product seed seam" },
  combos,
  total,
  correlation: {
    byMode: aggregate("mode"),
    byRoute: aggregate("route"),
    outliers,
    meanMsPerCandidate: perAttemptMs,
    note: "Spearman rank correlation of wall clock with attempts and with draws; draws counted on the same PRNG, digest-checked against the timed run",
  },
  vmSandboxCrossCheck: {
    combo: "R3-hard",
    n: crossSeeds.length,
    native: describe(crossNative),
    vmSandbox: describe(crossVm),
  },
  failures,
};

const fmt = (d) => `min ${d.min} p50 ${d.p50} p75 ${d.p75} p90 ${d.p90} p95 ${d.p95} p99 ${d.p99} max ${d.max} mean ${d.mean}`;
const tally = (d) => `>16 ${d.over16} >32 ${d.over32} >50 ${d.over50} >100 ${d.over100} >200 ${d.over200} >500 ${d.over500}`;
console.log("\n[gen-perf] combination  ms                                                          tail counts");
for (const c of combos) {
  console.log(
    `  ${c.combo.padEnd(10)} ${fmt(c.timeMs)} | ${tally(c.timeMs)} | throws ${c.throws} | attempts p50 ${c.attempts.p50} p95 ${c.attempts.p95} max ${c.attempts.max} | draws p50 ${c.draws.p50} max ${c.draws.max} | recovery ${c.recoveryIncidence} | p95/rep ${c.perRepP95.join("/")} | ρ(ms,att) ${c.spearmanMsAttempts}`,
  );
}
console.log(`  ${"TOTAL".padEnd(10)} ${fmt(total.timeMs)} | ${tally(total.timeMs)} | throws ${throws} | recovery ${total.recoveryIncidence} | ρ(ms,att) ${total.spearmanMsAttempts} ρ(ms,draws) ${total.spearmanMsDraws}`);
for (const r of total.perRep) console.log(`  rep ${r.rep}: p50 ${r.p50} p95 ${r.p95} p99 ${r.p99} max ${r.max}`);
console.log(`  mean ms per candidate built: ${perAttemptMs}`);
for (const o of outliers.rows) {
  console.log(`  tail ${o.combo.padEnd(10)} n ${o.tailN} ms ${o.tailMs} attempts ${o.tailAttemptsMean} vs ${o.restAttemptsMean} · draws ${o.tailDrawsMean} vs ${o.restDrawsMean} · recovery ${o.tailRecovery}`);
}
console.log(`  vm sandbox vs native (R3-hard, ${crossSeeds.length} same seeds): native p50 ${report.vmSandboxCrossCheck.native.p50} p95 ${report.vmSandboxCrossCheck.native.p95} · vm p50 ${report.vmSandboxCrossCheck.vmSandbox.p50} p95 ${report.vmSandboxCrossCheck.vmSandbox.p95}`);

if (OUT) {
  fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`[gen-perf] report written to ${OUT}`);
}
if (failures.length) {
  console.log(`\n[gen-perf] FAILED:\n  ${failures.join("\n  ")}`);
  process.exit(EXIT_VALIDATION_FAILED);
}
console.log("\n[gen-perf] held: no throw, probes behaviour-neutral, sandbox and native agree");
process.exit(EXIT_OK);
