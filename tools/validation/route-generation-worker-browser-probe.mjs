/**
 * ROUTE-C7C — browser probe: the Rota's boards come from a real Web Worker, in the real production build.
 *
 * Read-only towards the product: the page's `Worker` constructor is wrapped by the probe's init script to timestamp
 * construction, posting, replies and terminations and to look at what arrives (the product's code and messages pass
 * through untouched); forced failures are the probe's own doing (a Worker constructor that throws once, a Worker
 * script that fails to load). Writes nothing unless `--out DIR`.
 *
 *   thread        a Chromium trace of the first board (Home → Rota) and of a Restart: the generation chunk (located by
 *                 its unique error literal) has CPU samples on the Worker's thread and NONE on the page's main thread;
 *                 the Worker's start-up (construct → its first sample) and compute span, cold (empty cache) and warm.
 *   entry         the first board: pending, ONE Worker named "rota-generation" (Turbopack's Worker bootstrap, a
 *                 dedicated Worker target),
 *                 the job carries the request (normal play: no stream), the reply's walls arrive as a `Set`, the
 *                 Worker is terminated on reply, then the board.
 *   start/restart one new Worker each, playing again; a double Restart in one task asks once.
 *   rapid-mode    three modes in one task: one Worker, setup on the last mode.
 *   rapid-restart Restarts faster than a generation: every superseded Worker terminated before replying, one board.
 *   exit-pending  a Restart and leaving in one task: its Worker terminated, nothing alive, no error.
 *   failure       the Worker constructor throws (as under a CSP block) → the calm error + Retry; Retry → a new Worker,
 *                 playing. The Worker's script fails to load → the same; Retry → playing.
 *   leak          60 Restarts, then: Workers alive 0, constructed = terminated, the JS heap back near where it was.
 *   seeded        (`--launcher-base`, a dev server: the launcher is development-only) the launcher's sessions — Launch,
 *                 Start, Restart, a mode, Relançar, another scenario — every request carries its session's seeded
 *                 checkpoint and every reply equals what the real runner computes in Node for that request (map and
 *                 checkpoint), across real structured clone.
 *
 * Usage:
 *   next build && next start -p 3100                      (and, for `seeded`, `next dev -p 3101`)
 *   node tools/validation/route-generation-worker-browser-probe.mjs [--base URL] [--launcher-base URL] [--out DIR]
 *
 * Exit: 0 every scenario held · 1 a scenario failed · 3 usage / setup error.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  ROUTE_GENERATION_RUNNER,
  createModuleGraph,
  openSourceTree,
} from "./route-module-loader.mjs";

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_USAGE = 3;

const { chromium } = await (async () => {
  try {
    return await import("playwright");
  } catch {
    const dir = process.env.PLAYWRIGHT_DIR;
    if (dir) {
      for (const entry of ["index.mjs", "index.js"]) {
        const file = path.join(dir, "playwright", entry);
        if (fs.existsSync(file)) return await import(pathToFileURL(file).href);
      }
    }
    console.error("playwright not found. Install it, or set PLAYWRIGHT_DIR to a node_modules directory that has it.");
    process.exit(EXIT_USAGE);
  }
})();

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const BASE = arg("--base", "http://localhost:3100");
const LAUNCHER_BASE = arg("--launcher-base", null);
const OUT = arg("--out", null);
const GENERATION_LITERAL = "Route map generation failed all gates";
const log = (...a) => console.log("[gen-worker-browser]", ...a);
if (OUT) fs.mkdirSync(OUT, { recursive: true });

// =================================================================================================
// the page side
// =================================================================================================

function installProbe() {
  const probe = { workers: [], events: [], last: "", blockNext: 0 };
  window.__c7c = probe;
  const mark = (what, extra) => probe.events.push({ at: performance.now(), what, ...extra });
  const plainMap = (map) => (map ? { ...map, walls: map.walls instanceof Set ? [...map.walls] : map.walls } : null);
  const RealWorker = window.Worker;
  if (RealWorker) {
    window.Worker = class extends RealWorker {
      constructor(url, options) {
        if (probe.blockNext > 0) {
          probe.blockNext -= 1;
          mark("worker:blocked");
          throw new DOMException("Worker construction blocked by the probe", "SecurityError");
        }
        super(url, options);
        const record = { id: probe.workers.length, name: options?.name ?? null, type: options?.type ?? null, url: String(url), createdAt: performance.now(), jobs: [], replies: [], terminatedAt: null, errors: 0 };
        probe.workers.push(record);
        performance.mark(`c7c:worker-new:${record.id}`);
        mark("worker:new", { id: record.id });
        this.addEventListener("message", (e) => {
          const response = e.data?.response;
          record.replies.push({
            at: performance.now(),
            protocol: e.data?.protocol ?? null,
            requestId: response?.requestId ?? null,
            status: response?.status ?? null,
            wallsSet: response?.result?.map?.walls instanceof Set,
            map: plainMap(response?.result?.map),
            random: response?.result?.random ?? null,
            message: response?.message ?? null,
          });
          mark("worker:message", { id: record.id });
        });
        this.addEventListener("error", () => {
          record.errors += 1;
          mark("worker:error", { id: record.id });
        });
      }
      postMessage(data, options) {
        probe.workers.at(-1)?.jobs.push({ at: performance.now(), data: JSON.parse(JSON.stringify(data)) });
        return super.postMessage(data, options);
      }
      terminate() {
        const record = probe.workers.find((w) => w.terminatedAt === null && w.instance === this) ?? null;
        if (record) record.terminatedAt = performance.now();
        return super.terminate();
      }
    };
    // keep instance identity for terminate bookkeeping
    const Wrapped = window.Worker;
    window.Worker = new Proxy(Wrapped, {
      construct(target, argList) {
        const instance = Reflect.construct(target, argList);
        probe.workers.at(-1).instance = instance;
        return instance;
      },
    });
  }
  const scan = () => {
    const shell = document.querySelector(".rsg-shell");
    const state = {
      entry: document.querySelector("[data-entry-phase]")?.getAttribute("data-entry-phase") ?? null,
      generation: shell?.getAttribute("data-route-generation") ?? (shell ? "board-view" : null),
      message: document.querySelector(".rsg-objective-message")?.textContent ?? null,
      pressed: document.querySelector(".rsg-difficulty-btn[aria-pressed='true'] strong")?.textContent ?? null,
      board: document.querySelector(".route-babylon-wrap")?.getAttribute("data-visual-state") ?? null,
      retry: Boolean(document.querySelector('button[aria-label="Tentar preparar a rota novamente"]')),
      moveEnabled: document.querySelector('button[aria-label="Mover Cima"]') ? !document.querySelector('button[aria-label="Mover Cima"]').disabled : null,
    };
    const key = JSON.stringify(state);
    if (key !== probe.last) {
      probe.last = key;
      mark("state", state);
    }
  };
  new MutationObserver(scan).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
}

// =================================================================================================
// harness
// =================================================================================================

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--use-gl=angle", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
});
const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass: Boolean(pass), detail });
  log(`${pass ? "PASS" : "FAIL"} ${name}`, JSON.stringify(detail).slice(0, 1200));
};

async function open(name) {
  const context = await browser.newContext({ viewport: { width: 800, height: 500 }, deviceScaleFactor: 1 });
  await context.addInitScript(installProbe);
  const page = await context.newPage();
  const session = { name, context, page, console: [], pageErrors: [], targets: [] };
  page.on("console", (m) => session.console.push({ type: m.type(), text: m.text().slice(0, 240) }));
  page.on("pageerror", (e) => session.pageErrors.push(String(e).slice(0, 240)));
  page.on("worker", (w) => {
    const target = { url: w.url(), closed: false };
    session.targets.push(target);
    w.on("close", () => (target.closed = true));
  });
  return session;
}
const probeState = (page) => page.evaluate(() => ({ workers: window.__c7c.workers.map((w) => Object.fromEntries(Object.entries(w).filter(([k]) => k !== "instance"))), events: window.__c7c.events.length }));
const workersSince = async (page, from) => (await probeState(page)).workers.slice(from);
const workerCount = async (page) => (await probeState(page)).workers.length;
const lastState = (page) => page.evaluate(() => window.__c7c.events.filter((e) => e.what === "state").at(-1));
const settled = (page) =>
  page.waitForFunction(() => {
    const e = window.__c7c.events.filter((x) => x.what === "state").at(-1);
    return e && e.generation === "board-view" && e.message !== "Preparando a rota…";
  }, null, { timeout: 60000 });
const clickInOneTask = (page, selectors) =>
  page.evaluate((list) => {
    for (const selector of list) document.querySelector(selector)?.click();
  }, selectors);
const alive = (workers) => workers.filter((w) => w.terminatedAt === null).length;

async function selectRoute(page, base = BASE) {
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.locator(".hj-stage").waitFor({ timeout: 180000 });
  await page.waitForTimeout(1500);
  await page.locator('.hj-gallery-pip[aria-label="Selecionar Rota Estratégica"]').click({ force: true });
  await page.mouse.move(14, 14);
  await page.waitForTimeout(600);
}
async function enterSelected(page) {
  await page.locator('.hj-world-object[aria-current="true"] .hj-world-enter').click({ force: true });
  await page.locator(".pgi-cta").waitFor({ state: "visible", timeout: 120000 });
  await page.waitForTimeout(300);
  await page.locator(".pgi-cta").click();
  await page.locator('.route-babylon-wrap[data-visual-state="ready"]').waitFor({ timeout: 180000 });
  await page.waitForFunction(() => !document.querySelector("[data-entry-phase]"), null, { timeout: 120000 });
  await page.waitForTimeout(400);
}
const startRoute = async (page) => {
  await page.locator('button[aria-label="Iniciar rota com a dificuldade selecionada"]').click();
  await settled(page);
  await page.waitForTimeout(300);
};
const openDetails = (page) => page.locator(".rsg-details-trigger").click();
const closeDetails = async (page) => {
  await page.locator(".rsg-details-close").click();
  await page.waitForTimeout(200);
};

// =================================================================================================
// thread attribution — a Chromium trace
// =================================================================================================

const TRACE_CATEGORIES = ["devtools.timeline", "disabled-by-default-devtools.timeline", "disabled-by-default-v8.cpu_profiler", "blink.user_timing", "v8.execute", "__metadata"];
const chunkLiteral = new Map();
async function isGenerationChunk(request, url) {
  if (!url || !/\/_next\/static\/chunks\/.+\.js/.test(url)) return false;
  const key = url.split("#")[0];
  if (!chunkLiteral.has(key)) chunkLiteral.set(key, (await (await request.get(key)).text().catch(() => "")).includes(GENERATION_LITERAL));
  return chunkLiteral.get(key);
}

/** CPU samples per thread from a trace: { thread name → { total, generation, firstGenerationTs, lastGenerationTs } }, and user-timing marks. */
async function analyseTrace(buffer, request) {
  const trace = JSON.parse(buffer.toString("utf8"));
  const events = trace.traceEvents ?? trace;
  const threadName = new Map();
  for (const e of events) if (e.ph === "M" && e.name === "thread_name") threadName.set(`${e.pid}:${e.tid}`, e.args?.name ?? "?");
  const profiles = new Map(); // id → { thread, startTime, nodes: Map, ts }
  for (const e of events) {
    if (e.name === "Profile" && e.args?.data?.startTime !== undefined) profiles.set(`${e.pid}:${e.id}`, { thread: `${e.pid}:${e.tid}`, ts: e.args.data.startTime, nodes: new Map() });
  }
  const perThread = {};
  for (const e of events) {
    if (e.name !== "ProfileChunk") continue;
    const p = profiles.get(`${e.pid}:${e.id}`);
    if (!p) continue;
    const cpu = e.args?.data?.cpuProfile ?? {};
    for (const node of cpu.nodes ?? []) p.nodes.set(node.id, node.callFrame?.url ?? "");
    const deltas = e.args?.data?.timeDeltas ?? [];
    const name = threadName.get(p.thread) ?? p.thread;
    const row = (perThread[name] ??= { total: 0, generation: 0, firstGenerationTs: null, lastGenerationTs: null });
    for (let i = 0; i < (cpu.samples ?? []).length; i += 1) {
      p.ts += deltas[i] ?? 0;
      row.total += 1;
      if (await isGenerationChunk(request, p.nodes.get(cpu.samples[i]))) {
        row.generation += 1;
        row.firstGenerationTs ??= p.ts;
        row.lastGenerationTs = p.ts;
      }
    }
  }
  const marks = events.filter((e) => typeof e.name === "string" && e.name.startsWith("c7c:")).map((e) => ({ name: e.name, ts: e.ts }));
  return { perThread, marks };
}

async function traced(session, label, action) {
  const { page } = session;
  await browser.startTracing(page, { categories: TRACE_CATEGORIES });
  const from = await workerCount(page);
  await action();
  const buffer = await browser.stopTracing();
  const { perThread, marks } = await analyseTrace(buffer, page.request);
  const workers = await workersSince(page, from);
  const main = Object.entries(perThread).filter(([name]) => /CrRendererMain/.test(name));
  const workerThreads = Object.entries(perThread).filter(([name]) => /Worker/i.test(name));
  const mainGeneration = main.reduce((n, [, r]) => n + r.generation, 0);
  const workerGeneration = workerThreads.reduce((n, [, r]) => n + r.generation, 0);
  const first = workers[0];
  const newMark = first ? marks.find((m) => m.name === `c7c:worker-new:${first.id}`) : null;
  const genThread = workerThreads.find(([, r]) => r.generation > 0)?.[1] ?? null;
  return {
    label,
    mainThreadGenerationSamples: mainGeneration,
    workerThreadGenerationSamples: workerGeneration,
    threads: Object.fromEntries(Object.entries(perThread).filter(([, r]) => r.total > 0).map(([n, r]) => [n, { samples: r.total, generation: r.generation }])),
    workerConstructToFirstGenerationSampleMs: newMark && genThread ? Math.round((genThread.firstGenerationTs - newMark.ts) / 100) / 10 : null,
    workerGenerationSpanMs: genThread ? Math.round((genThread.lastGenerationTs - genThread.firstGenerationTs) / 100) / 10 : null,
    constructToReplyMs: first?.replies[0] ? Math.round(first.replies[0].at - first.createdAt) : null,
  };
}

// =================================================================================================
// scenarios — production, from the Home
// =================================================================================================

const journey = await open("journey");
const { page } = journey;
try {
  // entry (traced, cold)
  await selectRoute(page);
  const entryTrace = await traced(journey, "entry (cold)", () => enterSelected(page));
  {
    const workers = (await probeState(page)).workers;
    const w = workers[0];
    const job = w?.jobs[0]?.data;
    const reply = w?.replies[0];
    const states = await page.evaluate(() => window.__c7c.events.filter((e) => e.what === "state"));
    const pendingIndex = states.findIndex((s) => s.generation === "pending");
    const boardIndex = states.findIndex((s) => s.board !== null);
    const target = journey.targets[0];
    // `type` is informational: the source asks for a module Worker (what lets the bundler give it a chunk), and
    // Turbopack's Worker loader then constructs its own classic bootstrap script, which loads the Worker's chunks.
    record("entry", workers.length === 1 && w.name === "rota-generation" && /turbopack-worker-/.test(w.url) && Boolean(target) && target.closed &&
      job?.protocol === "rota-generation/1" && job.command?.intent === "mount" && job.command?.request?.random === null &&
      reply?.status === "ready" && reply.wallsSet === true && w.terminatedAt !== null && w.terminatedAt >= reply.at &&
      pendingIndex >= 0 && pendingIndex < boardIndex && states[pendingIndex].board === null, {
      workers: workers.length, name: w?.name, type: w?.type, workerTarget: target?.url?.split("/").pop()?.slice(0, 60), targetClosed: target?.closed,
      job: job && { protocol: job.protocol, intent: job.command?.intent, request: job.command?.request }, reply: reply && { status: reply.status, wallsSet: reply.wallsSet, requestId: reply.requestId },
      terminatedAfterReply: w ? w.terminatedAt !== null && w.terminatedAt >= reply?.at : null, pendingBeforeBoard: pendingIndex >= 0 && pendingIndex < boardIndex,
    });
    record("thread-entry", entryTrace.mainThreadGenerationSamples === 0 && entryTrace.workerThreadGenerationSamples > 0, entryTrace);
  }
  // start
  {
    const from = await workerCount(page);
    await startRoute(page);
    const ws = await workersSince(page, from);
    const s = await lastState(page);
    record("start", ws.length === 1 && alive(ws) === 0 && ws[0].replies[0]?.wallsSet && s.moveEnabled === true, { workers: ws.length, alive: alive(ws), final: s });
  }
  // restart (traced, warm)
  {
    await page.locator('button[aria-label="Mover Cima"]').click();
    await page.waitForTimeout(300);
    await openDetails(page);
    const from = await workerCount(page);
    const trace = await traced(journey, "restart (warm)", async () => {
      await page.locator('button[aria-label="Começar outra rota"]').click();
      await settled(page);
    });
    await closeDetails(page);
    const ws = await workersSince(page, from);
    record("restart", ws.length === 1 && alive(ws) === 0 && (await lastState(page)).moveEnabled === true, { workers: ws.length, alive: alive(ws) });
    record("thread-restart", trace.mainThreadGenerationSamples === 0 && trace.workerThreadGenerationSamples > 0, trace);
  }
  // double restart in one task
  {
    await openDetails(page);
    const from = await workerCount(page);
    await page.evaluate(() => {
      const b = document.querySelector('button[aria-label="Começar outra rota"]');
      b.click();
      b.click();
    });
    await settled(page);
    await closeDetails(page);
    const ws = await workersSince(page, from);
    record("double-restart", ws.length === 1 && alive(ws) === 0 && journey.pageErrors.length === 0, { workers: ws.length, alive: alive(ws) });
  }
  // rapid restarts: faster than a generation — every superseded Worker terminated, never replying
  {
    await openDetails(page);
    const from = await workerCount(page);
    await page.evaluate(async () => {
      const b = document.querySelector('button[aria-label="Começar outra rota"]');
      for (let i = 0; i < 5; i += 1) {
        b.click();
        await new Promise((r) => setTimeout(r, 4));
      }
    });
    await settled(page);
    await page.waitForTimeout(300);
    await closeDetails(page);
    const ws = await workersSince(page, from);
    const superseded = ws.slice(0, -1);
    record("rapid-restart", ws.length >= 2 && superseded.every((w) => w.terminatedAt !== null && w.replies.length === 0) && ws.at(-1).replies.length === 1 && alive(ws) === 0, {
      workers: ws.length, supersededReplied: superseded.filter((w) => w.replies.length).length, supersededTerminated: superseded.filter((w) => w.terminatedAt !== null).length, alive: alive(ws),
    });
  }
  // failure: the Worker constructor throws (as under a CSP block) → calm error → Retry on a new Worker
  {
    await openDetails(page);
    await page.evaluate(() => (window.__c7c.blockNext = 1));
    const from = await workerCount(page);
    await page.locator('button[aria-label="Começar outra rota"]').click();
    await page.locator('button[aria-label="Tentar preparar a rota novamente"]').waitFor({ timeout: 30000 });
    const failed = await lastState(page);
    await page.locator('button[aria-label="Tentar preparar a rota novamente"]').click();
    await settled(page);
    await closeDetails(page);
    const ws = await workersSince(page, from);
    const final = await lastState(page);
    record("failure-constructor", failed.retry && failed.moveEnabled !== true && ws.length === 1 && ws[0].replies[0]?.status === "ready" && final.moveEnabled === true && !final.retry, { failed, workersAfterRetry: ws.length, final });
  }
  // failure: the Worker's script fails to load → calm error → Retry
  {
    await openDetails(page);
    // the Worker's own script (Turbopack's Worker bootstrap) fails to load: the browser reports it on the Worker's `error`
    await page.route(/turbopack-worker-/, (route) => route.abort("failed"));
    const from = await workerCount(page);
    await page.locator('button[aria-label="Começar outra rota"]').click();
    await page.locator('button[aria-label="Tentar preparar a rota novamente"]').waitFor({ timeout: 60000 });
    const failed = await lastState(page);
    const failedWorkers = await workersSince(page, from);
    await page.unroute(/turbopack-worker-/);
    await page.locator('button[aria-label="Tentar preparar a rota novamente"]').click();
    await settled(page);
    await closeDetails(page);
    const final = await lastState(page);
    const ws = await workersSince(page, from);
    record("failure-script", failed.retry && failedWorkers.length === 1 && failedWorkers[0].errors > 0 && failedWorkers[0].terminatedAt !== null && final.moveEnabled === true && ws.at(-1).replies[0]?.status === "ready", {
      failed, failedWorker: failedWorkers[0] && { errors: failedWorkers[0].errors, terminated: failedWorkers[0].terminatedAt !== null }, final,
    });
  }
  // leak: 60 Restarts, alternating settled and superseded
  {
    const cdp = await journey.context.newCDPSession(page);
    await cdp.send("HeapProfiler.enable");
    await cdp.send("HeapProfiler.collectGarbage");
    const heapBefore = (await cdp.send("Runtime.getHeapUsage")).usedSize;
    await openDetails(page);
    const from = await workerCount(page);
    for (let i = 0; i < 60; i += 1) {
      await page.evaluate(() => document.querySelector('button[aria-label="Começar outra rota"]').click());
      if (i % 2) await settled(page);
      else await page.waitForTimeout(5);
    }
    await settled(page);
    await page.waitForTimeout(800);
    await closeDetails(page);
    await cdp.send("HeapProfiler.collectGarbage");
    await page.waitForTimeout(300);
    await cdp.send("HeapProfiler.collectGarbage");
    const heapAfter = (await cdp.send("Runtime.getHeapUsage")).usedSize;
    const ws = await workersSince(page, from);
    const openTargets = journey.targets.filter((t) => !t.closed).length;
    record("leak", alive(ws) === 0 && openTargets === 0 && page.workers().length === 0 && heapAfter < heapBefore * 1.5 + 8e6, {
      restarts: 60, constructed: ws.length, terminated: ws.filter((w) => w.terminatedAt !== null).length, openWorkerTargets: openTargets,
      heapBeforeMB: Math.round(heapBefore / 1e5) / 10, heapAfterMB: Math.round(heapAfter / 1e5) / 10,
    });
  }
  // exit while pending
  {
    await openDetails(page);
    const errorsBefore = journey.pageErrors.length;
    const from = await workerCount(page);
    await clickInOneTask(page, ['button[aria-label="Começar outra rota"]', 'button[aria-label="Voltar à jornada cognitiva"]']);
    await page.waitForFunction(() => !document.querySelector(".rsg-shell"), null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    const ws = await workersSince(page, from);
    record("exit-pending", journey.pageErrors.length === errorsBefore && ws.length <= 1 && alive(ws) === 0 && ws.every((w) => w.replies.length === 0 || w.terminatedAt !== null) && page.workers().length === 0, {
      workers: ws.length, alive: alive(ws), pageErrors: journey.pageErrors.slice(errorsBefore),
    });
  }
} catch (error) {
  record("journey", false, { error: String(error?.stack ?? error).slice(0, 800) });
}
await journey.context.close();

// rapid modes, on a fresh entry
const modes = await open("modes");
try {
  await selectRoute(modes.page);
  await enterSelected(modes.page);
  const from = await workerCount(modes.page);
  await clickInOneTask(modes.page, ['button[aria-label^="Modo Aberto"]', 'button[aria-label^="Modo Equilibrado"]', 'button[aria-label^="Modo Desafiador"]']);
  await settled(modes.page);
  const ws = await workersSince(modes.page, from);
  const final = await lastState(modes.page);
  record("rapid-mode", final.pressed === "Desafiador" && ws.length === 1 && alive(ws) === 0 && ws[0].jobs[0]?.data?.command?.request?.difficulty === "hard", {
    workers: ws.length, askedFor: ws.map((w) => w.jobs[0]?.data?.command?.request?.difficulty), final,
  });
  // warm trace of an entry: navigate again in the same context (cache warm), trace the first board
  await selectRoute(modes.page);
  const warm = await traced(modes, "entry (warm)", () => enterSelected(modes.page));
  record("thread-entry-warm", warm.mainThreadGenerationSamples === 0 && warm.workerThreadGenerationSamples > 0, warm);
} catch (error) {
  record("rapid-mode", false, { error: String(error?.stack ?? error).slice(0, 600) });
}
await modes.context.close();

const allowed = (text) => /Worker construction blocked by the probe|net::ERR_FAILED|Failed to load resource/.test(text);
const consoleErrors = [...journey.console, ...modes.console].filter((c) => c.type === "error" && !allowed(c.text));
record("no-console-errors", consoleErrors.length === 0 && [...journey.pageErrors, ...modes.pageErrors].length === 0, { errors: consoleErrors.slice(0, 5), pageErrors: [...journey.pageErrors, ...modes.pageErrors].slice(0, 5) });

// =================================================================================================
// seeded — the dev server's launcher
// =================================================================================================

if (LAUNCHER_BASE) {
  const tree = openSourceTree();
  const sha = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
  const expected = (request) => {
    const graph = createModuleGraph({ tree, globals: { console, Set, Map, Math: Object.create(Math) } });
    const result = graph.require(ROUTE_GENERATION_RUNNER).runRouteGenerationSync(request);
    return { map: sha({ ...result.map, walls: [...result.map.walls] }), random: result.random };
  };
  const seeded = await open("launcher");
  const lp = seeded.page;
  try {
    const rows = [];
    const check = async (label, from) => {
      const ws = await workersSince(lp, from);
      for (const w of ws) {
        const request = w.jobs[0]?.data?.command?.request;
        const reply = w.replies[0];
        if (!request || !reply) continue;
        const want = expected(request);
        rows.push({
          label,
          seed: request.random?.armedSeed ?? null,
          difficulty: request.difficulty,
          route: request.routeNumber,
          wallsSet: reply.wallsSet,
          sameMap: sha(reply.map) === want.map,
          sameStream: JSON.stringify(reply.random) === JSON.stringify(want.random),
        });
      }
    };
    const launch = async (id) => {
      await lp.getByRole("button", { name: new RegExp(`^${id} ·`) }).click({ timeout: 180000 });
      await lp.locator(".rsg-shell").waitFor({ state: "visible", timeout: 180000 });
      await lp.locator('.route-babylon-wrap[data-visual-state="ready"]').waitFor({ timeout: 180000 });
      await lp.waitForTimeout(500);
    };
    await lp.goto(`${LAUNCHER_BASE}/lab/route-launcher`, { waitUntil: "domcontentloaded", timeout: 180000 });
    let from = await workerCount(lp);
    await launch("BASE-1");
    await check("launch BASE-1", from);
    from = await workerCount(lp);
    await lp.locator('button[aria-label^="Modo Desafiador"]').click();
    await settled(lp);
    await check("mode hard", from);
    from = await workerCount(lp);
    await startRoute(lp);
    await check("start", from);
    from = await workerCount(lp);
    await openDetails(lp);
    await lp.locator('button[aria-label="Começar outra rota"]').click();
    await settled(lp);
    await closeDetails(lp);
    await check("restart", from);
    from = await workerCount(lp);
    await lp.getByRole("button", { name: "Relançar" }).click();
    await lp.locator('.route-babylon-wrap[data-visual-state="ready"]').waitFor({ timeout: 180000 });
    await lp.waitForTimeout(500);
    await check("relaunch", from);
    from = await workerCount(lp);
    await lp.getByRole("button", { name: "Sair do diagnóstico" }).click();
    await lp.waitForTimeout(500);
    await launch("HARD-2");
    await check("launch HARD-2", from);
    const seeds = { "launch BASE-1": 12420031, "mode hard": 12420031, start: 12420031, restart: 12420031, relaunch: 12420031, "launch HARD-2": 12422073 };
    record("seeded-launcher", rows.length >= 6 && rows.every((r) => r.seed === seeds[r.label] && r.wallsSet && r.sameMap && r.sameStream), { rows });
  } catch (error) {
    record("seeded-launcher", false, { error: String(error?.stack ?? error).slice(0, 800) });
  }
  await seeded.context.close();
} else {
  log("seeded: skipped (no --launcher-base; the launcher is development-only)");
}

await browser.close();
if (OUT) fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.pass);
log(`${results.length - failed.length}/${results.length} held${failed.length ? ` · failing: ${failed.map((r) => r.name).join(", ")}` : ""}`);
process.exit(failed.length ? EXIT_FAILED : EXIT_OK);
