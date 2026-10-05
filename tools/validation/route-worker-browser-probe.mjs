/**
 * ROUTE-PERF-WORKER-DECISION-01 — what Route generation costs the main thread
 * in a real browser, and what moving it to a Worker could buy (Measurements
 * 3–5, 7, 9 and the transport prototype of the C7 decision).
 *
 * Read-only. Nothing in `src/` is touched and nothing here is imported by the
 * product. Two phases, same Chromium, CDP `Emulation.setCPUThrottlingRate` at
 * every rate of `--rates` ("CPU-throttled browser approximation" — not a
 * claim about any particular phone):
 *
 *   --phase intrinsic   generation ALONE. The generation closure is bundled by
 *                       `route-module-loader.mjs#emitModuleBundle` (the real
 *                       modules, transpiled, nothing else) into a blank page on
 *                       a synthetic origin. Each generation runs in its own
 *                       task with the product's seed seam armed; Long Tasks are
 *                       observed. Then, on the same page: MazeMap transport
 *                       (structuredClone, a disposable Blob Worker echoing it,
 *                       the main-thread cost of receiving it, Set fidelity),
 *                       generation inside that throwaway Worker, and heap
 *                       (CDP GC + Runtime.getHeapUsage) across many generations
 *                       and per retained map. No server needed.
 *
 *   --phase product     the production app (`next build && next start -p 3100`)
 *                       at a mobile viewport. Per rate: cold entries in fresh
 *                       contexts (reported apart), then a warm loop — mode
 *                       change ×2, Start, two ordinary Explorer steps (the
 *                       negative control: no generation), Restart ×2, back to
 *                       Home, warm entry — then Route continuations (a Route
 *                       lost on purpose, "next Route"), then an attribution pass
 *                       under the CDP CPU profiler: `generateMaze`'s inclusive
 *                       time is found by locating, in the shipped chunk, the
 *                       function holding its unique error literal; the rest is
 *                       split by the chunk each sample's leaf frame belongs to
 *                       (Babylon, the Route scene, React/framework, other app
 *                       code, GC, native "(program)"). Every timed action
 *                       records: input timestamp, Event Timing (processing,
 *                       duration to next paint), first and second rAF after the
 *                       input, the first frame at which the promised DOM state
 *                       is present, and every Long Task in the window.
 *
 * Everything is RUN METADATA (wall clock, this machine, software WebGL).
 * Exit 1 only when the probe could not measure what it set out to (an action
 * never became ready, generation could not be located, a Set did not survive
 * the clone).
 *
 * Usage:
 *   node tools/validation/route-worker-browser-probe.mjs --phase intrinsic
 *        [--rates 1,4,6] [--samples 100] [--reps 3] [--warmup 20] [--out FILE.json]
 *   next build && next start -p 3100
 *   node tools/validation/route-worker-browser-probe.mjs --phase product
 *        [--base http://localhost:3100] [--rates 1,4,6] [--loops 30] [--continuations 20]
 *        [--cold 3] [--profile-loops 6] [--restarts-memory 120] [--viewport 390x844] [--out FILE.json]
 *
 * Playwright: the global install, or PLAYWRIGHT_DIR=<node_modules that has it>.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import * as acorn from "acorn";
import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";
import { ROUTE_RANDOM_SEAM, emitModuleBundle, openSourceTree } from "./route-module-loader.mjs";

const { chromium } = await (async () => {
  try {
    return await import("playwright");
  } catch {
    const dirs = [process.env.PLAYWRIGHT_DIR, path.join(path.dirname(process.execPath), "..", "lib", "node_modules")].filter(Boolean);
    for (const dir of dirs) {
      for (const entry of ["index.mjs", "index.js"]) {
        const file = path.join(dir, "playwright", entry);
        if (fs.existsSync(file)) return await import(pathToFileURL(file).href);
      }
    }
    console.error("playwright not found. Install it, or set PLAYWRIGHT_DIR to a node_modules directory that has it.");
    process.exit(EXIT_USAGE);
  }
})();

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};
const PHASE = flag("--phase", null);
const RATES = flag("--rates", "1,4,6").split(",").map(Number);
const OUT = flag("--out", null);
const BASE = flag("--base", "http://localhost:3100");
const [VIEW_W, VIEW_H] = flag("--viewport", "390x844").split("x").map(Number);
const int = (name, fallback) => Number(flag(name, String(fallback)));
if (!["intrinsic", "product"].includes(PHASE) || RATES.some((r) => !(r >= 1))) {
  console.error("usage: --phase intrinsic|product [--rates 1,4,6] … (see the header)");
  process.exit(EXIT_USAGE);
}
const log = (...a) => console.log(`[worker-probe:${PHASE}]`, ...a);
const failures = [];

const LAUNCH_ARGS = ["--use-angle=swiftshader", "--use-gl=angle", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"];
const browser = await chromium.launch({ args: LAUNCH_ARGS });
const machine = {
  node: process.version,
  browser: `Chromium ${browser.version()} (Playwright, headless, SwiftShader WebGL)`,
  cpu: os.cpus()[0]?.model ?? null,
  cores: os.cpus().length,
  memGiB: Math.round(os.totalmem() / 2 ** 30),
  platform: `${os.platform()} ${os.release()}`,
};
log(machine.browser, "·", machine.cpu, "×", machine.cores);

// --- statistics ---------------------------------------------------------------------------------

const quantile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))];
const round = (n, d = 1) => (n === null || n === undefined || Number.isNaN(n) ? null : Number(n.toFixed(d)));
function describe(values) {
  const sorted = values.filter((v) => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  const n = sorted.length;
  if (!n) return { n: 0 };
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
async function throttle(page, rate) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  return cdp;
}

// =================================================================================================
// INTRINSIC — generation alone, transport, memory
// =================================================================================================

async function intrinsicPhase() {
  const SAMPLES = int("--samples", 100);
  const REPS = int("--reps", 3);
  const WARMUP = int("--warmup", 20);
  const tree = openSourceTree();
  const generationModule = tree.declaring("generateMaze");
  const bundle = emitModuleBundle({ tree, entry: generationModule });
  const ORIGIN = "http://route-worker-probe.test";
  const html = `<!doctype html><meta charset="utf-8"><title>route generation probe</title><body>
<script>
window.__bundle = ${bundle}();
window.__seam = window.__bundle.require(${JSON.stringify(ROUTE_RANDOM_SEAM)});
window.__longtasks = [];
new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__longtasks.push({ start: e.startTime, duration: e.duration }); })
  .observe({ type: "longtask", buffered: true });
window.__workerSource = ${JSON.stringify(
    `self.__bundle = ${bundle}();\n` +
      `self.__seam = self.__bundle.require(${JSON.stringify(ROUTE_RANDOM_SEAM)});\n` +
      `self.onmessage = (event) => {\n` +
      `  const m = event.data;\n` +
      `  if (m.kind === "echo") { self.postMessage({ kind: "echo", payload: m.payload }); return; }\n` +
      `  if (m.kind === "generate") {\n` +
      `    self.__seam.armRouteRandomSeed(m.seed);\n` +
      `    const t0 = performance.now();\n` +
      `    const map = self.__bundle.exports.generateMaze(m.mode, m.route);\n` +
      `    const ms = performance.now() - t0;\n` +
      `    self.__seam.clearRouteRandomSeed();\n` +
      `    self.postMessage({ kind: "generated", ms, map });\n` +
      `  }\n` +
      `};\n`,
  )};
</script></body>`;
  const context = await browser.newContext({ viewport: { width: VIEW_W, height: VIEW_H }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  await page.route(`${ORIGIN}/**`, (route) => route.fulfill({ status: 200, contentType: "text/html", body: html }));
  await page.goto(`${ORIGIN}/`);
  const cdp = await context.newCDPSession(page);
  await cdp.send("HeapProfiler.enable");
  const heap = async () => {
    await cdp.send("HeapProfiler.collectGarbage");
    await cdp.send("HeapProfiler.collectGarbage");
    return (await cdp.send("Runtime.getHeapUsage")).usedSize;
  };

  const COMBOS = [1, 2, 3].flatMap((route) => ["easy", "medium", "hard"].map((mode) => ({ route, mode, id: `R${route}-${mode}` })));
  const runBatch = (combos, count, seedBase) =>
    page.evaluate(
      async ({ combos, count, seedBase }) => {
        const out = [];
        const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));
        window.__longtasks.length = 0;
        for (let c = 0; c < combos.length; c += 1) {
          const combo = combos[c];
          for (let i = 0; i < count; i += 1) {
            await nextTask();
            const seed = seedBase + combo.index * 10000 + i;
            window.__seam.armRouteRandomSeed(seed);
            let threw = false;
            const t0 = performance.now();
            try {
              window.__bundle.exports.generateMaze(combo.mode, combo.route);
            } catch {
              threw = true;
            }
            const t1 = performance.now();
            out.push({ combo: combo.id, seed, start: t0, ms: t1 - t0, threw });
          }
        }
        window.__seam.clearRouteRandomSeed();
        await new Promise((resolve) => setTimeout(resolve, 50));
        const longtasks = window.__longtasks.slice();
        return { out, longtasks };
      },
      { combos, count, seedBase },
    );

  const result = { plan: { samplesPerCombinationPerRep: SAMPLES, reps: REPS, warmupPerCombination: WARMUP, rates: RATES }, rates: [] };
  const indexed = COMBOS.map((combo, index) => ({ ...combo, index }));
  for (const rate of RATES) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    log(`rate ${rate}×: warm-up ${WARMUP}/combination (discarded)`);
    await runBatch(indexed, WARMUP, 90_000_000);
    const rows = [];
    let longTaskHits = 0;
    for (let rep = 0; rep < REPS; rep += 1) {
      const order = indexed.map((_, k) => indexed[(k + rep * 4) % indexed.length]);
      const t = Date.now();
      const { out, longtasks } = await runBatch(order, SAMPLES, (rep + 1) * 1_000_000);
      for (const row of out) {
        row.rep = rep;
        // A Long Task entry covering this generation's own task (entry times are coarsened to whole ms).
        row.longTask = longtasks.some((lt) => lt.start <= row.start + 2 && lt.start + lt.duration >= row.start + row.ms - 2);
        if (row.longTask) longTaskHits += 1;
        rows.push(row);
      }
      log(`rate ${rate}× rep ${rep + 1}/${REPS}: ${out.length} generations in ${((Date.now() - t) / 1000).toFixed(1)} s`);
    }
    const throws = rows.filter((r) => r.threw).length;
    if (throws) failures.push(`${throws} browser generations threw at ${rate}×`);
    const over50 = rows.filter((r) => r.ms > 50).length;
    const perRep = Array.from({ length: REPS }, (_, rep) => {
      const d = describe(rows.filter((r) => r.rep === rep).map((r) => r.ms));
      return { rep: rep + 1, p50: d.p50, p95: d.p95, p99: d.p99, max: d.max, over50Share: round((100 * d.over50) / d.n, 1) };
    });
    const rateResult = {
      rate,
      pooled: describe(rows.map((r) => r.ms)),
      over50Share: round((100 * over50) / rows.length, 1),
      longTaskObserved: `${longTaskHits}/${rows.length}`,
      longTaskVsOver50: `${longTaskHits} long-task entries vs ${over50} generations > 50 ms`,
      perRep,
      combos: COMBOS.map((combo) => {
        const mine = rows.filter((r) => r.combo === combo.id);
        const d = describe(mine.map((r) => r.ms));
        return {
          combo: combo.id,
          ...d,
          over50Share: round((100 * d.over50) / d.n, 1),
          perRepP95: Array.from({ length: REPS }, (_, rep) => describe(mine.filter((r) => r.rep === rep).map((r) => r.ms)).p95),
        };
      }),
      throws,
    };

    // Transport: a MazeMap-like payload (real maps) through structuredClone and a throwaway Worker.
    rateResult.transport = await page.evaluate(async () => {
      const maps = [];
      for (let i = 0; i < 60; i += 1) {
        window.__seam.armRouteRandomSeed(7_000_000 + i);
        maps.push(window.__bundle.exports.generateMaze(["easy", "medium", "hard"][i % 3], (i % 3) + 1));
      }
      window.__seam.clearRouteRandomSeed();
      const json = (map) => JSON.stringify(map, (_, v) => (v instanceof Set ? [...v] : v));
      const sizes = maps.map((m) => json(m).length);
      const cloneMs = [];
      let setsSurvive = true;
      for (const map of maps) {
        const t0 = performance.now();
        const copy = structuredClone(map);
        cloneMs.push(performance.now() - t0);
        setsSurvive &&= copy.walls instanceof Set && copy.walls.size === map.walls.size && [...map.walls].every((k) => copy.walls.has(k)) && json(copy) === json(map);
      }
      const worker = new Worker(URL.createObjectURL(new Blob([window.__workerSource], { type: "text/javascript" })));
      const ask = (message) =>
        new Promise((resolve) => {
          worker.onmessage = (event) => {
            const received = performance.now();
            const data = event.data;
            const decoded = performance.now();
            resolve({ data, received, decodeMs: decoded - received });
          };
          worker.postMessage(message);
        });
      const roundtrip = [];
      const decode = [];
      let workerSetsSurvive = true;
      for (let i = 0; i < 3; i += 1) await ask({ kind: "echo", payload: maps[i] });
      for (const map of maps) {
        const t0 = performance.now();
        const { data, received, decodeMs } = await ask({ kind: "echo", payload: map });
        roundtrip.push(received - t0 + decodeMs);
        decode.push(decodeMs);
        workerSetsSurvive &&= data.payload.walls instanceof Set && json(data.payload) === json(map);
      }
      // Generation inside the throwaway Worker: does the main-thread throttle reach it? (informational)
      const inWorker = [];
      for (let i = 0; i < 30; i += 1) {
        const { data } = await ask({ kind: "generate", seed: 8_000_000 + i, mode: "easy", route: 3 });
        inWorker.push(data.ms);
      }
      const inMain = [];
      for (let i = 0; i < 30; i += 1) {
        window.__seam.armRouteRandomSeed(8_000_000 + i);
        const t0 = performance.now();
        window.__bundle.exports.generateMaze("easy", 3);
        inMain.push(performance.now() - t0);
      }
      window.__seam.clearRouteRandomSeed();
      worker.terminate();
      return { sizes, cloneMs, setsSurvive, roundtrip, decode, workerSetsSurvive, inWorker, inMain, wallsPerMap: maps.map((m) => m.walls.size) };
    });
    const t = rateResult.transport;
    if (!t.setsSurvive || !t.workerSetsSurvive) failures.push(`Set did not survive structured clone at ${rate}×`);
    rateResult.transport = {
      payloadJsonBytes: describe(t.sizes),
      wallsPerMap: describe(t.wallsPerMap),
      structuredCloneMs: describe(t.cloneMs),
      workerEchoRoundtripMs: describe(t.roundtrip),
      mainThreadReceiveDecodeMs: describe(t.decode),
      setSurvivesStructuredClone: t.setsSurvive,
      setSurvivesPostMessage: t.workerSetsSurvive,
      generationInWorkerMs_R3easy: describe(t.inWorker),
      generationInMainMs_R3easy_sameSeeds: describe(t.inMain),
    };
    result.rates.push(rateResult);
    const p = rateResult.pooled;
    log(`rate ${rate}×: p50 ${p.p50} p95 ${p.p95} p99 ${p.p99} max ${p.max} · >50 ms ${rateResult.over50Share}% · long tasks ${rateResult.longTaskObserved} · clone p95 ${rateResult.transport.structuredCloneMs.p95} ms · echo p95 ${rateResult.transport.workerEchoRoundtripMs.p95} ms · in-worker p50 ${rateResult.transport.generationInWorkerMs_R3easy.p50} vs main ${rateResult.transport.generationInMainMs_R3easy_sameSeeds.p50}`);
  }

  // Memory (unthrottled): growth across many generations, and the heap a retained map costs.
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const before = await heap();
  await page.evaluate(() => {
    for (let i = 0; i < 600; i += 1) window.__bundle.exports.generateMaze(["easy", "medium", "hard"][i % 3], (i % 3) + 1);
  });
  const after = await heap();
  await page.evaluate(() => {
    window.__kept = [];
    for (let i = 0; i < 200; i += 1) window.__kept.push(window.__bundle.exports.generateMaze(["easy", "medium", "hard"][i % 3], (i % 3) + 1));
  });
  const retained = await heap();
  await page.evaluate(() => {
    window.__kept = null;
  });
  result.memory = {
    heapBeforeBytes: before,
    heapAfter600GenerationsBytes: after,
    growthAfter600GenerationsBytes: after - before,
    retainedPerMapBytes: Math.round((retained - after) / 200),
    method: "CDP HeapProfiler.collectGarbage ×2 then Runtime.getHeapUsage; 600 generations discarded, then 200 retained",
  };
  log(`memory: growth after 600 generations ${result.memory.growthAfter600GenerationsBytes} B · retained per map ~${result.memory.retainedPerMapBytes} B`);
  await context.close();
  return result;
}

// =================================================================================================
// PRODUCT — production build, real actions
// =================================================================================================

/** In-page instrumentation: observes, changes nothing in the app. */
function installPerfObserver() {
  const perf = { longtasks: [], events: [], actions: [], pending: null };
  window.__perf = perf;
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) perf.longtasks.push({ start: e.startTime, duration: e.duration });
    }).observe({ type: "longtask", buffered: true });
    perf.longTaskSupported = true;
  } catch {
    perf.longTaskSupported = false;
  }
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        perf.events.push({ name: e.name, start: e.startTime, processingStart: e.processingStart, processingEnd: e.processingEnd, duration: e.duration });
      }
    }).observe({ type: "event", durationThreshold: 16, buffered: true });
    perf.eventTimingSupported = true;
  } catch {
    perf.eventTimingSupported = false;
  }
  const canvas = () => document.querySelector("canvas.route-babylon-board");
  const signature = () => {
    const c = canvas();
    if (!c) return null;
    return ["data-wall-cells", "data-light-cells", "data-trap-cells", "data-exit-cell", "data-chest-cell"].map((a) => c.getAttribute(a)).join("|");
  };
  const boardReady = () => Boolean(document.querySelector('.route-babylon-wrap[data-visual-state="ready"]'));
  perf.signature = signature;
  const conditions = {
    start: () => canvas()?.getAttribute("data-status") === "playing",
    restart: (baseline) => signature() !== null && signature() !== baseline.signature,
    mode: (baseline) =>
      document.querySelector(`.rsg-difficulty-btn[aria-label^="Modo ${baseline.title}"]`)?.getAttribute("aria-pressed") === "true" &&
      signature() !== baseline.signature,
    move: (baseline) => canvas() !== null && canvas().getAttribute("data-player-cell") !== baseline.player,
    entry: (_, state) => {
      if (document.querySelector("[data-entry-phase]")) state.sawEntry = true;
      return state.sawEntry && !document.querySelector("[data-entry-phase]") && boardReady();
    },
    continuation: (_, state) => {
      if (document.querySelector("[data-entry-phase]")) state.sawEntry = true;
      return state.sawEntry && !document.querySelector("[data-entry-phase]") && boardReady() && !document.querySelector(".prm-card");
    },
  };
  const onInput = (event) => {
    const spec = perf.pending;
    if (!spec || event.type !== spec.input) return;
    perf.pending = null;
    const record = { label: spec.label, condition: spec.condition, ts: event.timeStamp, dispatched: performance.now(), raf1: null, raf2: null, ready: null, timedOut: false };
    perf.actions.push(record);
    requestAnimationFrame(() => {
      record.raf1 = performance.now();
      requestAnimationFrame(() => {
        record.raf2 = performance.now();
      });
    });
    const state = {};
    const check = () => {
      if (record.ready !== null) return;
      if (conditions[spec.condition](spec.baseline ?? {}, state)) {
        record.ready = performance.now();
        return;
      }
      if (performance.now() - record.ts > 90000) {
        record.timedOut = true;
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  };
  window.addEventListener("click", onInput, true);
  window.addEventListener("keydown", onInput, true);
}

const MODE_TITLE = { easy: "Aberto", medium: "Equilibrado", hard: "Desafiador" };

async function productPhase() {
  const LOOPS = int("--loops", 30);
  const CONTINUATIONS = int("--continuations", 20);
  const COLD = int("--cold", 3);
  const PROFILE_LOOPS = int("--profile-loops", 6);
  const RESTARTS_MEMORY = int("--restarts-memory", 120);

  // The shipped chunk that holds generation, and the function in it that holds its unique literal.
  const LITERAL = "failed all gates";
  const scriptCache = new Map();
  async function scriptText(url) {
    if (!scriptCache.has(url)) {
      const response = await fetch(url);
      scriptCache.set(url, response.ok ? await response.text() : "");
    }
    return scriptCache.get(url);
  }
  function locateGeneration(url, text) {
    const at = text.indexOf(LITERAL);
    if (at < 0) return null;
    const ast = acorn.parse(text, { ecmaVersion: "latest", sourceType: "script", allowReturnOutsideFunction: true, allowHashBang: true });
    let best = null;
    (function walk(node) {
      if (!node || typeof node.type !== "string") return;
      if (node.start > at || node.end < at) return;
      if (/Function/.test(node.type) && (!best || node.end - node.start < best.end - best.start)) best = node;
      for (const key of Object.keys(node)) {
        const value = node[key];
        if (Array.isArray(value)) value.forEach(walk);
        else if (value && typeof value.type === "string") walk(value);
      }
    })(ast);
    if (!best) return null;
    const lineStarts = [0];
    for (let i = 0; i < text.length; i += 1) if (text.charCodeAt(i) === 10) lineStarts.push(i + 1);
    return { url, start: best.start, bodyStart: best.body.start, end: best.end, name: best.id?.name ?? null, lineStarts };
  }
  const categoryOf = (text) => {
    if (text.includes(LITERAL)) return "route-logic-chunk";
    if (text.includes("route-static-board-root")) return "route-scene";
    if (/babylonjs|BABYLON\.|Babylon\.js/.test(text)) return "babylon";
    if (/__reactFiber\$|Minified React error/.test(text)) return "react-framework";
    return "other-app";
  };
  let generation = null;
  const categories = new Map();
  async function learnScripts(page) {
    const urls = await page.evaluate(() =>
      performance.getEntriesByType("resource").map((e) => e.name).filter((name) => /\.js(\?|$)/.test(name)),
    );
    for (const url of urls) {
      if (categories.has(url)) continue;
      const text = await scriptText(url);
      categories.set(url, categoryOf(text));
      if (!generation && text.includes(LITERAL)) generation = locateGeneration(url, text);
    }
  }
  function attribute(profile) {
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    const parent = new Map();
    for (const n of profile.nodes) for (const child of n.children ?? []) parent.set(child, n.id);
    const isGeneration = (node) => {
      if (!generation || node.callFrame.url !== generation.url) return false;
      const { lineNumber, columnNumber } = node.callFrame;
      const offset = (generation.lineStarts[lineNumber] ?? -1e9) + columnNumber;
      return offset >= generation.start && offset <= generation.bodyStart;
    };
    const genMemo = new Map();
    const underGeneration = (id) => {
      if (genMemo.has(id)) return genMemo.get(id);
      const node = byId.get(id);
      const value = isGeneration(node) || (parent.has(id) ? underGeneration(parent.get(id)) : false);
      genMemo.set(id, value);
      return value;
    };
    const totals = { generateMaze: 0, babylon: 0, "route-scene": 0, "react-framework": 0, "route-logic-chunk": 0, "other-app": 0, native: 0, gc: 0, program: 0, idle: 0, other: 0 };
    let generationFound = false;
    const otherFrames = new Map();
    profile.samples.forEach((id, i) => {
      const dt = (profile.timeDeltas[i + 1] ?? 0) / 1000;
      const node = byId.get(id);
      const name = node.callFrame.functionName;
      if (name === "(idle)") totals.idle += dt;
      else if (name === "(garbage collector)") totals.gc += dt;
      else if (name === "(program)" || name === "(root)") totals.program += dt;
      else if (underGeneration(id)) {
        totals.generateMaze += dt;
        generationFound = true;
      } else {
        const category = categories.get(node.callFrame.url);
        if (category) totals[category] += dt;
        else {
          // No script URL: a native function — here almost entirely WebGL calls (see topOther).
          if (node.callFrame.url) totals.other += dt;
          else totals.native += dt;
          const label = `${name || "(anonymous)"} ${node.callFrame.url ? node.callFrame.url.replace(/^.*\//, "") : "[native]"}`;
          otherFrames.set(label, (otherFrames.get(label) ?? 0) + dt);
        }
      }
    });
    const busy = Object.entries(totals).filter(([k]) => k !== "idle").reduce((s, [, v]) => s + v, 0);
    return { ...Object.fromEntries(Object.entries(totals).map(([k, v]) => [k, round(v)])), busy: round(busy), generationShare: busy ? round((100 * totals.generateMaze) / busy) : null, generationFound,
      topOther: [...otherFrames].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, ms]) => [label, round(ms)]) };
  }

  const newPage = async (rate) => {
    const context = await browser.newContext({ viewport: { width: VIEW_W, height: VIEW_H }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await context.addInitScript(installPerfObserver);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error).slice(0, 200)));
    const cdp = await throttle(page, rate);
    return { context, page, cdp, errors };
  };

  /** Arms the in-page recorder, performs the input, waits for readiness, returns the measured record. */
  async function measure(page, label, condition, input, baseline = {}) {
    await page.evaluate(({ label, condition, kind, baseline }) => {
      window.__perf.pending = { label, condition, input: kind, baseline };
      window.__perf.longtasks.length = 0;
      window.__perf.events.length = 0;
    }, { label, condition, kind: input.kind, baseline });
    await input.run();
    const handle = await page.waitForFunction(
      () => {
        const a = window.__perf.actions[window.__perf.actions.length - 1];
        return a && a.raf2 !== null && (a.ready !== null || a.timedOut) ? true : null;
      },
      null,
      { timeout: 120000, polling: 100 },
    );
    await handle.dispose();
    await page.waitForTimeout(120);
    return page.evaluate(() => {
      const a = window.__perf.actions.pop();
      const end = (a.ready ?? a.raf2) + 50;
      const longtasks = window.__perf.longtasks.filter((lt) => lt.start + lt.duration >= a.ts - 1 && lt.start <= end);
      const eventEntry = window.__perf.events.find((e) => (e.name === "click" || e.name === "keydown") && Math.abs(e.start - a.ts) < 2) ?? null;
      return {
        label: a.label,
        timedOut: a.timedOut,
        nextFrameMs: a.raf1 - a.ts,
        secondFrameMs: a.raf2 - a.ts,
        readyMs: a.ready === null ? null : a.ready - a.ts,
        inputDelayMs: eventEntry ? eventEntry.processingStart - eventEntry.start : null,
        processingMs: eventEntry ? eventEntry.processingEnd - eventEntry.processingStart : null,
        eventDurationMs: eventEntry ? eventEntry.duration : null,
        longTaskCount: longtasks.length,
        longTaskMaxMs: longtasks.reduce((m, lt) => Math.max(m, lt.duration), 0),
        longTaskSumMs: longtasks.reduce((s, lt) => s + lt.duration, 0),
        longTaskFirstMs: longtasks.find((lt) => lt.start <= a.ts + 5 && lt.start + lt.duration >= a.ts)?.duration ?? 0,
      };
    });
  }

  const sig = (page) => page.evaluate(() => window.__perf.signature());
  const status = (page) => page.evaluate(() => document.querySelector("canvas.route-babylon-board")?.getAttribute("data-status") ?? null);
  const currentMode = (page) =>
    page.evaluate((titles) => {
      const pressed = document.querySelector('.rsg-difficulty-btn[aria-pressed="true"] strong')?.textContent ?? null;
      return Object.keys(titles).find((k) => titles[k] === pressed) ?? null;
    }, MODE_TITLE);

  async function goHome(page) {
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 240000 });
    await page.locator(".hj-stage").waitFor({ timeout: 240000 });
    await page.waitForTimeout(1800);
  }
  async function selectRota(page) {
    await page.locator('.hj-gallery-pip[aria-label="Selecionar Rota Estratégica"]').click({ force: true });
    await page.mouse.move(14, 14);
    await page.waitForTimeout(700);
  }
  /** Home → Rota entry; returns the measured record (watchdog retries counted, not timed). */
  async function enter(page, label, retries) {
    await selectRota(page);
    const record = await measure(page, label, "entry", {
      kind: "click",
      run: () => page.locator('.hj-world-object[aria-current="true"] .hj-world-enter').click({ force: true }),
    });
    if (record.timedOut || (await page.locator('[data-entry-phase="error"]').count())) {
      retries.push(label);
      record.watchdog = true;
      for (let i = 0; i < 4 && (await page.locator('[data-entry-phase="error"]').count()); i += 1) {
        await page.getByRole("button", { name: "Tentar novamente" }).click();
        await page.waitForFunction(() => !document.querySelector("[data-entry-phase]"), null, { timeout: 120000 }).catch(() => {});
      }
    }
    await page.locator(".wentry-intro-layer .pgi-cta").waitFor({ state: "visible", timeout: 120000 });
    await page.waitForTimeout(300);
    await page.locator(".wentry-intro-layer .pgi-cta").click();
    await page.locator('.rsg-setup button[aria-label="Iniciar rota com a dificuldade selecionada"]').waitFor({ state: "visible", timeout: 60000 });
    await page.locator('.route-babylon-wrap[data-visual-state="ready"]').waitFor({ timeout: 120000 });
    await page.waitForTimeout(400);
    return record;
  }
  async function changeMode(page, label) {
    const now = await currentMode(page);
    const next = { easy: "medium", medium: "hard", hard: "easy" }[now ?? "easy"];
    const baseline = { title: MODE_TITLE[next], signature: await sig(page) };
    const record = await measure(page, label, "mode", {
      kind: "click",
      run: () => page.locator(`.rsg-difficulty-btn[aria-label^="Modo ${MODE_TITLE[next]}"]`).click(),
    }, baseline);
    record.mode = next;
    await page.waitForTimeout(350);
    return record;
  }
  async function startRoute(page, label) {
    const record = await measure(page, label, "start", {
      kind: "click",
      run: () => page.locator('button[aria-label="Iniciar rota com a dificuldade selecionada"]').click(),
    });
    await page.waitForTimeout(350);
    return record;
  }
  /** One ordinary Explorer step onto a safe neighbour: no generation happens. */
  async function step(page, label, towardHunter = false) {
    const board = await page.evaluate(() => {
      const c = document.querySelector("canvas.route-babylon-board");
      if (!c) return null;
      const list = (n) => (c.getAttribute(n) ?? "").split(" ").filter(Boolean);
      return {
        status: c.getAttribute("data-status"),
        player: c.getAttribute("data-player-cell"),
        guardian: c.getAttribute("data-guardian-cell"),
        targets: list("data-move-targets"),
        danger: list("data-danger-cells"),
        walls: list("data-wall-cells"),
        chest: c.getAttribute("data-chest-cell"),
        traps: list("data-trap-cells"),
      };
    });
    if (!board || board.status !== "playing") return null;
    const [pr, pc] = board.player.split(",").map(Number);
    let target;
    if (towardHunter) {
      target = shortestNext(board.player, board.guardian, new Set(board.walls));
    } else {
      const unsafe = new Set([...board.danger, board.guardian, board.chest, ...board.traps]);
      const options = board.targets.filter((cell) => !unsafe.has(cell));
      target = options[0] ?? null;
    }
    if (!target) return null;
    const [tr, tc] = target.split(",").map(Number);
    const key = { "-1,0": "ArrowUp", "1,0": "ArrowDown", "0,-1": "ArrowLeft", "0,1": "ArrowRight" }[`${tr - pr},${tc - pc}`];
    if (!key) return null;
    const record = label
      ? await measure(page, label, "move", { kind: "keydown", run: () => page.keyboard.press(key) }, { player: board.player })
      : (await page.keyboard.press(key), null);
    await page.waitForTimeout(320);
    return record ?? true;
  }
  function shortestNext(from, to, walls) {
    const previous = new Map([[from, null]]);
    const queue = [from];
    for (let i = 0; i < queue.length; i += 1) {
      const current = queue[i];
      if (current === to) {
        let cursor = current;
        while (previous.get(cursor) !== from && previous.get(cursor) !== null) cursor = previous.get(cursor);
        return cursor === from ? null : cursor;
      }
      const [r, c] = current.split(",").map(Number);
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const next = `${r + dr},${c + dc}`;
        if (r + dr < 0 || r + dr > 8 || c + dc < 0 || c + dc > 8 || walls.has(next) || previous.has(next)) continue;
        previous.set(next, current);
        queue.push(next);
      }
    }
    return null;
  }
  async function openDetails(page) {
    if ((await page.locator(".rsg-details-trigger").getAttribute("aria-expanded")) !== "true") await page.locator(".rsg-details-trigger").click();
    await page.locator('button[aria-label="Começar outra rota"]').waitFor({ state: "visible", timeout: 30000 });
  }
  async function closeDetails(page) {
    if ((await page.locator(".rsg-details-trigger").getAttribute("aria-expanded")) === "true") await page.locator('button[aria-label="Fechar detalhes da rota"]').click();
    await page.waitForTimeout(250);
  }
  async function restart(page, label) {
    await openDetails(page);
    const record = await measure(page, label, "restart", {
      kind: "click",
      run: () => page.locator('button[aria-label="Começar outra rota"]').click(),
    }, { signature: await sig(page) });
    await page.waitForTimeout(350);
    return record;
  }
  async function exitHome(page) {
    await closeDetails(page);
    await page.locator(".rsg-back").click();
    await page.locator(".hj-stage").waitFor({ timeout: 60000 });
    await page.waitForTimeout(1500);
  }
  /** Lose the Route (walk into the Hunter), then take the result's primary action. */
  async function continuation(page, label) {
    await closeDetails(page);
    if ((await status(page)) === "setup") await page.locator('button[aria-label="Iniciar rota com a dificuldade selecionada"]').click();
    await page.waitForTimeout(400);
    for (let guard = 0; guard < 200 && !(await page.locator(".prm-card").count()); guard += 1) {
      const reward = page.locator('.rsg-reward-btn[aria-label^="Escolher Picareta"]');
      if (await reward.count()) {
        await reward.click();
        await page.waitForTimeout(250);
        continue;
      }
      // Toward the Hunter; when that way is shut (the Sentinel, a pause), any safe step keeps the turn going.
      const moved = (await step(page, null, true)) ?? (await step(page, null, false));
      if (!moved) await page.waitForTimeout(250);
    }
    await page.locator(".prm-card").waitFor({ timeout: 60000 });
    await page.waitForTimeout(500);
    const record = await measure(page, label, "continuation", { kind: "click", run: () => page.locator(".prm-cta").click() });
    await page.locator('.route-babylon-wrap[data-visual-state="ready"]').waitFor({ timeout: 120000 });
    await page.locator('button[aria-label="Iniciar rota com a dificuldade selecionada"]').waitFor({ state: "visible", timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(400);
    return record;
  }

  async function profiled(cdp, fn) {
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
    await cdp.send("Profiler.start");
    let record;
    try {
      record = await fn();
    } catch (error) {
      await cdp.send("Profiler.stop").catch(() => {});
      throw error;
    }
    const { profile } = await cdp.send("Profiler.stop");
    return { record, attribution: attribute(profile) };
  }

  /** One loop body; an error is recorded (never silently dropped) and the session is brought back Home. */
  async function guarded(page, errors, where, fn) {
    try {
      await fn();
    } catch (error) {
      errors.push(`${where}: ${String(error?.message ?? error).split("\n")[0].slice(0, 200)}`);
      log(`  ! ${where}: ${errors[errors.length - 1]}`);
      await goHome(page).catch(() => {});
    }
  }
  const ensureSetup = async (page, retries) => {
    if (await page.locator('.rsg-setup button[aria-label="Iniciar rota com a dificuldade selecionada"]').count()) return;
    if (!(await page.locator(".hj-stage").count())) await goHome(page);
    await enter(page, "entry-recover", retries);
  };

  const result = { plan: { loops: LOOPS, continuations: CONTINUATIONS, cold: COLD, profileLoops: PROFILE_LOOPS, viewport: `${VIEW_W}x${VIEW_H}`, deviceScaleFactor: 1, isMobile: true, base: BASE }, rates: [] };
  for (const rate of RATES) {
    const actions = [];
    const retries = [];
    const cold = [];
    log(`rate ${rate}×: ${COLD} cold entries (fresh contexts)`);
    let session = null;
    for (let i = 0; i < COLD; i += 1) {
      if (session) await session.context.close();
      session = await newPage(rate);
      await goHome(session.page);
      const record = await enter(session.page, "entry-cold", retries);
      cold.push(record);
      log(`  cold ${i + 1}: ready ${round(record.readyMs)} ms · long tasks ${record.longTaskCount} (max ${round(record.longTaskMaxMs)}, sum ${round(record.longTaskSumMs)})`);
    }
    const { page, cdp } = session;
    await learnScripts(page);
    if (!generation) failures.push("generateMaze could not be located in the shipped chunks");

    const loopErrors = [];
    log(`rate ${rate}×: ${LOOPS} warm loops`);
    for (let loop = 0; loop < LOOPS; loop += 1) await guarded(page, loopErrors, `loop ${loop + 1}`, async () => {
      await ensureSetup(page, retries);
      actions.push(await changeMode(page, "mode"));
      actions.push(await changeMode(page, "mode"));
      actions.push(await startRoute(page, "start"));
      for (let s = 0; s < 2; s += 1) {
        const r = await step(page, "move");
        if (r && r !== true) actions.push(r);
      }
      if ((await status(page)) === "playing") {
        actions.push(await restart(page, "restart"));
        actions.push(await restart(page, "restart"));
      }
      if (await page.locator(".prm-card").count()) {
        await page.locator(".prm-actions button").last().click();
        await page.waitForTimeout(1500);
      } else {
        await exitHome(page);
      }
      if (!(await page.locator(".hj-stage").count())) await goHome(page);
      actions.push(await enter(page, "entry-warm", retries));
      if ((loop + 1) % 5 === 0) log(`  loop ${loop + 1}/${LOOPS} (${new Date().toISOString().slice(11, 19)})`);
    });
    log(`rate ${rate}×: ${CONTINUATIONS} continuations`);
    for (let i = 0; i < CONTINUATIONS; i += 1) await guarded(page, loopErrors, `continuation ${i + 1}`, async () => {
      await ensureSetup(page, retries);
      actions.push(await continuation(page, "continuation"));
    });

    log(`rate ${rate}×: attribution (${PROFILE_LOOPS} profiled loops)`);
    const attributions = [];
    for (let loop = 0; loop < PROFILE_LOOPS; loop += 1) await guarded(page, loopErrors, `profiled loop ${loop + 1}`, async () => {
      await exitHome(page).catch(() => {});
      if (!(await page.locator(".hj-stage").count())) await goHome(page);
      attributions.push(await profiled(cdp, () => enter(page, "entry-warm", retries)));
      attributions.push(await profiled(cdp, () => changeMode(page, "mode")));
      attributions.push(await profiled(cdp, () => startRoute(page, "start")));
      const s = await profiled(cdp, () => step(page, "move"));
      if (s.record && s.record !== true) attributions.push(s);
      if ((await status(page)) === "playing") attributions.push(await profiled(cdp, () => restart(page, "restart")));
      if (loop < 3) attributions.push(await profiled(cdp, () => continuation(page, "continuation")));
    });

    let memory = null;
    if (rate === RATES[0] && RESTARTS_MEMORY > 0) {
      await exitHome(page).catch(() => {});
      if (!(await page.locator(".hj-stage").count())) await goHome(page);
      await enter(page, "entry-memory", retries);
      await page.locator('button[aria-label="Iniciar rota com a dificuldade selecionada"]').click();
      await page.waitForTimeout(500);
      await cdp.send("HeapProfiler.enable");
      const heap = async () => {
        await cdp.send("HeapProfiler.collectGarbage");
        await cdp.send("HeapProfiler.collectGarbage");
        return (await cdp.send("Runtime.getHeapUsage")).usedSize;
      };
      const h0 = await heap();
      await openDetails(page);
      for (let i = 0; i < RESTARTS_MEMORY; i += 1) {
        await page.locator('button[aria-label="Começar outra rota"]').click();
        await page.waitForTimeout(60);
      }
      await page.waitForTimeout(1000);
      const h1 = await heap();
      memory = { restarts: RESTARTS_MEMORY, heapBeforeBytes: h0, heapAfterBytes: h1, growthBytes: h1 - h0 };
      log(`  memory: ${RESTARTS_MEMORY} restarts → heap growth ${h1 - h0} B`);
    }

    const timed = actions.filter(Boolean);
    const stuck = timed.filter((a) => a.timedOut);
    if (stuck.length) failures.push(`${stuck.length} actions never reached their ready state at ${rate}×`);
    const labels = ["mode", "start", "restart", "move", "entry-warm", "continuation"];
    const summary = Object.fromEntries(
      labels.map((label) => {
        const rows = timed.filter((a) => a.label === label && !a.timedOut && !a.watchdog);
        return [
          label,
          {
            n: rows.length,
            nextFrameMs: describe(rows.map((a) => a.nextFrameMs)),
            secondFrameMs: describe(rows.map((a) => a.secondFrameMs)),
            readyMs: describe(rows.map((a) => a.readyMs)),
            eventDurationMs: describe(rows.map((a) => a.eventDurationMs)),
            processingMs: describe(rows.map((a) => a.processingMs)),
            longTaskMaxMs: describe(rows.map((a) => a.longTaskMaxMs)),
            longTaskSumMs: describe(rows.map((a) => a.longTaskSumMs)),
            withLongTask: `${rows.filter((a) => a.longTaskCount > 0).length}/${rows.length}`,
          },
        ];
      }),
    );
    const attributionSummary = Object.fromEntries(
      labels.map((label) => {
        const rows = attributions.filter((a) => a.record && a.record !== true && a.record.label === label).map((a) => a.attribution);
        const mean = (k) => round(rows.reduce((s, r) => s + (r[k] ?? 0), 0) / (rows.length || 1));
        return [
          label,
          {
            n: rows.length,
            generationLocated: rows.every((r) => r.generationFound) || label === "move" ? true : rows.filter((r) => r.generationFound).length,
            meanMs: Object.fromEntries(["busy", "generateMaze", "babylon", "route-scene", "react-framework", "route-logic-chunk", "other-app", "native", "gc", "program", "other"].map((k) => [k, mean(k)])),
            generationShareMean: mean("generationShare"),
            generationShareP50: describe(rows.map((r) => r.generationShare)).p50,
            topUncategorizedMeanMs: (() => {
              const merged = new Map();
              for (const r of rows) for (const [label, ms] of r.topOther) merged.set(label, (merged.get(label) ?? 0) + ms);
              return [...merged].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, ms]) => [label, round(ms / (rows.length || 1))]);
            })(),
          },
        ];
      }),
    );
    if (loopErrors.length > Math.max(2, LOOPS / 10)) failures.push(`${loopErrors.length} loop errors at ${rate}×`);
    result.rates.push({ rate, loopErrors, cold: { records: cold, readyMs: describe(cold.map((c) => c.readyMs)), longTaskSumMs: describe(cold.map((c) => c.longTaskSumMs)), longTaskMaxMs: describe(cold.map((c) => c.longTaskMaxMs)) }, summary, attribution: attributionSummary, watchdogRetries: retries, memory, pageErrors: session.errors.slice(0, 10) });
    for (const label of labels) {
      const s = summary[label];
      const a = attributionSummary[label];
      log(`  ${label.padEnd(12)} n ${s.n} · next frame p50 ${s.nextFrameMs.p50} p95 ${s.nextFrameMs.p95} max ${s.nextFrameMs.max} · ready p95 ${s.readyMs.p95} · LT max p95 ${s.longTaskMaxMs.p95} · with LT ${s.withLongTask} · busy ${a.meanMs.busy} gen ${a.meanMs.generateMaze} (${a.generationShareMean}%) babylon ${round((a.meanMs.babylon ?? 0) + (a.meanMs["route-scene"] ?? 0))} webgl/native ${a.meanMs.native} react ${a.meanMs["react-framework"]}`);
    }
    await session.context.close();
  }
  result.generationLocation = generation ? { url: generation.url.replace(BASE, ""), functionStart: generation.start, functionEnd: generation.end } : null;
  return result;
}

// =================================================================================================

let report;
try {
  const phaseResult = PHASE === "intrinsic" ? await intrinsicPhase() : await productPhase();
  report = {
    mission: "ROUTE-PERF-WORKER-DECISION-01",
    kind: "RUN METADATA — wall clock on this machine, software WebGL, CPU-throttled browser approximation; never compared as evidence",
    phase: PHASE,
    machine,
    ...phaseResult,
    failures,
  };
} catch (error) {
  failures.push(String(error?.stack ?? error).slice(0, 2000));
  report = { phase: PHASE, machine, failures };
} finally {
  await browser.close();
}
if (OUT) {
  fs.writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
  log(`report written to ${OUT}`);
}
if (failures.length) {
  log(`FAILED:\n  ${failures.join("\n  ")}`);
  process.exit(EXIT_VALIDATION_FAILED);
}
log("held");
process.exit(EXIT_OK);
