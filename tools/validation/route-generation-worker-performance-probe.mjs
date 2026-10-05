/**
 * ROUTE-C7C — performance probe: while the Rota's first board is generated, does the main thread stay responsive?
 *
 * ROUTE-PERF-WORKER-DECISION-01 measured generation in Chromium at p95 ~119 ms (1×), ~561 ms (4×), ~845 ms (6× CPU
 * throttle) — on the main thread, that is a Long Task. C7C moved it to a Worker. This probe measures the window where
 * that matters and nothing else competes for it: the session's FIRST board, from the moment the Rota shows "pending"
 * to the moment the board is accepted — before the Babylon board mounts (it mounts on the accepted board), so no
 * canvas renders inside the window.
 *
 * Per sample, in the production build, from the Home: select the Rota, throttle the CPU (CDP, which in Chromium also
 * slows the page's dedicated Workers), enter, and record until the board is accepted:
 *
 *   window          pending → board accepted (`data-route-generation` leaves "pending");
 *   worker          Worker constructed, job posted, reply received (C7C; the page's `Worker` is wrapped by the
 *                   probe's init script — timestamps only, the product's code and messages untouched);
 *   longTasks       PerformanceObserver "longtask" entries overlapping the window (and the Worker's compute span);
 *   frames          requestAnimationFrame callbacks inside the window and the largest gap between them —
 *                   informational: under headless software WebGL (SwiftShader) frame production is GPU-bound and
 *                   often yields no frame inside a ~100–300 ms window on either build;
 *   heartbeat       a 10 ms timer inside the window and inside the Worker's compute span: how many times the main
 *                   thread ran it, and its worst lateness (event-loop responsiveness — the gate's signal);
 *   main CPU        a CDP CPU profile of the main thread: samples in the chunk that holds generation (located by its
 *                   unique error literal) — inside each long task too, which is how a long task is attributed.
 *
 * The first sample of each rate loads the Home in a fresh browser context (cold: nothing cached, no chunk evaluated,
 * first Worker). The others go back to the Home from the Rota's intro and enter again, in the same page (warm: the
 * Rota's and the board's chunks already evaluated, the Worker's chunks cached). Babylon's chunk is imported in parallel
 * when the Rota mounts, so in the cold sample its evaluation can land in the window: attribution says whose a long
 * task is.
 *
 * Read-only: nothing in the product is instrumented. Wall-clock output is RUN METADATA, never evidence; `--out FILE`
 * writes a JSON report, nothing is written otherwise.
 *
 * Usage:
 *   next build && next start -p 3100
 *   node tools/validation/route-generation-worker-performance-probe.mjs [--base URL] [--rates 1,4,6] [--samples 20]
 *        [--label NAME] [--out FILE] [--gate]
 *
 *   --gate   exit 1 unless, in the warm samples of every rate: no main-thread sample is in generation's chunk, no long
 *            task overlaps generation's chunk, the main thread keeps running (heartbeat) while the Worker computes,
 *            and every board arrived from the Worker with its walls a Set.
 *
 * Exit: 0 done (gate held, with --gate) · 1 gate failed · 3 usage / setup error.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

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
const RATES = arg("--rates", "1,4,6").split(",").map(Number);
const SAMPLES = Number(arg("--samples", "20"));
const LABEL = arg("--label", BASE);
const OUT = arg("--out", null);
const GATE = process.argv.includes("--gate");
const GENERATION_LITERAL = "Route map generation failed all gates";
const LONG_TASK_MS = 50;
const log = (...a) => console.log("[gen-worker-perf]", ...a);

function installProbe() {
  const probe = { marks: [], longTasks: [], frames: [], beats: [] };
  window.__c7c = probe;
  const mark = (what, extra) => probe.marks.push({ at: performance.now(), what, ...extra });
  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) probe.longTasks.push({ start: e.startTime, duration: e.duration });
    }).observe({ type: "longtask", buffered: true });
  } catch {}
  const frame = (t) => {
    probe.frames.push(t);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  let expected = performance.now() + 10;
  const beat = () => {
    const now = performance.now();
    probe.beats.push({ at: now, late: now - expected });
    expected = now + 10;
    setTimeout(beat, 10);
  };
  setTimeout(beat, 10);
  const RealWorker = window.Worker;
  if (RealWorker) {
    window.Worker = class extends RealWorker {
      constructor(url, options) {
        super(url, options);
        mark("worker:new", { name: options?.name ?? null });
        this.addEventListener("message", (e) => mark("worker:message", { wallsSet: e.data?.response?.result?.map?.walls instanceof Set }));
        this.addEventListener("error", () => mark("worker:error"));
      }
      postMessage(data, options) {
        mark("worker:post");
        return super.postMessage(data, options);
      }
      terminate() {
        mark("worker:terminate");
        return super.terminate();
      }
    };
  }
  let last = null;
  let waiting = null;
  /** Resolves once a pending first board has been accepted (event-driven: no polling on a throttled page). */
  probe.accepted = () =>
    new Promise((resolve) => {
      waiting = resolve;
      scan();
    });
  const scan = () => {
    const shell = document.querySelector(".rsg-shell");
    const state = shell?.getAttribute("data-route-generation") ?? (shell ? "board-view" : null);
    if (state !== last) {
      last = state;
      mark("generation", { state });
    }
    if (waiting) {
      const pending = probe.marks.findIndex((x) => x.what === "generation" && x.state === "pending");
      if (pending >= 0 && probe.marks.slice(pending).some((x) => x.what === "generation" && x.state !== "pending")) {
        const resolve = waiting;
        waiting = null;
        resolve();
      }
    }
  };
  new MutationObserver(scan).observe(document, { subtree: true, childList: true, attributes: true });
}

const pct = (list, q) => {
  if (!list.length) return null;
  const s = [...list].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor(q * s.length))] * 10) / 10;
};
const stats = (list) => (list.length ? { n: list.length, p50: pct(list, 0.5), p95: pct(list, 0.95), max: Math.round(Math.max(...list) * 10) / 10 } : { n: 0 });

const chunkHasGeneration = new Map();
async function generationChunk(request, url) {
  if (!url || !/\/_next\/static\/chunks\/.+\.js/.test(url)) return false;
  const key = url.split("#")[0];
  if (!chunkHasGeneration.has(key)) {
    const text = await (await request.get(key)).text().catch(() => "");
    chunkHasGeneration.set(key, text.includes(GENERATION_LITERAL));
  }
  return chunkHasGeneration.get(key);
}

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--use-gl=angle", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
});

async function sample(page, cdp, rate, index) {
  {
    if (index === 0) {
      await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 180000 });
    } else {
      // warm: back to the Home from the Rota's intro (no reload), then in again
      await page.locator(".pgi-back").waitFor({ timeout: 60000 });
      await page.evaluate(() => document.querySelector(".pgi-back").click());
      await page.locator(".rsg-shell").waitFor({ state: "detached", timeout: 60000 });
    }
    await page.locator(".hj-stage").waitFor({ timeout: 180000 });
    await page.waitForTimeout(index === 0 ? 1500 : 900);
    await page.evaluate(() => {
      const p = window.__c7c;
      p.marks.length = 0;
      p.longTasks.length = 0;
      p.frames.length = 0;
      p.beats.length = 0;
    });
    await page.locator('.hj-gallery-pip[aria-label="Selecionar Rota Estratégica"]').click({ force: true });
    await page.mouse.move(14, 14);
    await page.waitForTimeout(600);
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 1000 });
    await page.locator('.hj-world-object[aria-current="true"] .hj-world-enter').click({ force: true });
    // throttle and profile from the moment the Home hands over to the game (it covers, ~1 s before the Rota mounts),
    // not during the Home's own transition
    await page.waitForFunction(() => document.querySelector("[data-entry-phase]"), null, { timeout: 120000, polling: 10 });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    await cdp.send("Profiler.start");
    const profileStartedAt = await page.evaluate(() => performance.now());
    await page.evaluate(() => window.__c7c.accepted());
    await page.waitForTimeout(100);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    const { profile } = await cdp.send("Profiler.stop");
    const data = await page.evaluate(() => window.__c7c);
    // the window
    const pendingAt = data.marks.find((x) => x.what === "generation" && x.state === "pending").at;
    const acceptedAt = data.marks.find((x) => x.what === "generation" && x.at > pendingAt && x.state !== "pending").at;
    const workerNew = data.marks.find((x) => x.what === "worker:new" && x.at >= pendingAt - 50);
    const workerPost = data.marks.find((x) => x.what === "worker:post" && x.at >= pendingAt - 50);
    const workerMessage = data.marks.find((x) => x.what === "worker:message" && x.at >= pendingAt - 50);
    const inWindow = (start, end) => start < acceptedAt && end > pendingAt;
    const longTasks = data.longTasks.filter((t) => inWindow(t.start, t.start + t.duration) && t.duration > LONG_TASK_MS);
    const frames = data.frames.filter((t) => t >= pendingAt && t <= acceptedAt);
    const gaps = frames.slice(1).map((t, i) => t - frames[i]);
    const edgeGap = frames.length ? Math.max(frames[0] - pendingAt, acceptedAt - frames.at(-1)) : acceptedAt - pendingAt;
    const beats = data.beats.filter((b) => b.at >= pendingAt && b.at <= acceptedAt);
    const computeSpan = workerPost && workerMessage ? [workerPost.at, workerMessage.at] : null;
    const framesDuringCompute = computeSpan ? data.frames.filter((t) => t >= computeSpan[0] && t <= computeSpan[1]).length : null;
    const computeBeats = computeSpan ? data.beats.filter((b) => b.at >= computeSpan[0] && b.at <= computeSpan[1]) : null;
    // main CPU: profile timestamps (µs) mapped onto performance.now() at the profile's start
    const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
    const genNode = new Map();
    for (const n of profile.nodes) genNode.set(n.id, await generationChunk(page.request, n.callFrame.url));
    let t = 0;
    const samples = [];
    for (let i = 0; i < profile.samples.length; i += 1) {
      t += profile.timeDeltas[i];
      const frame = nodes.get(profile.samples[i])?.callFrame;
      samples.push({ at: profileStartedAt + t / 1000, gen: genNode.get(profile.samples[i]), url: frame?.url ?? "", fn: frame?.functionName ?? "" });
    }
    const interval = profile.samples.length ? (profile.endTime - profile.startTime) / 1000 / profile.samples.length : 0;
    const windowSamples = samples.filter((s) => s.at >= pendingAt - 5 && s.at <= acceptedAt + 5);
    const mainGenerationMs = Math.round(samples.filter((s) => s.gen).length * interval * 10) / 10;
    const attributed = longTasks.map((task) => {
      const inside = samples.filter((s) => s.at >= task.start - 2 && s.at <= task.start + task.duration + 2);
      const byChunk = {};
      for (const s of inside) {
        const key = s.gen ? "GENERATION" : s.url ? s.url.split("/").pop().split("#")[0] : s.fn || "(native)";
        byChunk[key] = (byChunk[key] ?? 0) + 1;
      }
      const top = Object.entries(byChunk).sort((a, b) => b[1] - a[1]).slice(0, 3);
      return { duration: Math.round(task.duration), generationSamples: byChunk.GENERATION ?? 0, top };
    });
    return {
      rate,
      index,
      cold: index === 0,
      windowMs: Math.round(acceptedAt - pendingAt),
      worker: workerNew
        ? {
            name: workerNew.name,
            constructToReplyMs: workerMessage ? Math.round(workerMessage.at - workerNew.at) : null,
            postToReplyMs: workerMessage && workerPost ? Math.round(workerMessage.at - workerPost.at) : null,
            wallsSet: workerMessage?.wallsSet ?? null,
          }
        : null,
      longTasks: longTasks.length,
      maxLongTaskMs: longTasks.length ? Math.round(Math.max(...longTasks.map((x) => x.duration))) : 0,
      generationLongTasks: attributed.filter((a) => a.generationSamples > 0).length,
      attributed,
      frames: frames.length,
      framesDuringCompute,
      maxFrameGapMs: Math.round(Math.max(edgeGap, ...gaps, 0)),
      heartbeats: beats.length,
      maxHeartbeatLatenessMs: beats.length ? Math.round(Math.max(...beats.map((b) => b.late))) : null,
      heartbeatsDuringCompute: computeBeats ? computeBeats.length : null,
      maxHeartbeatLatenessDuringComputeMs: computeBeats?.length ? Math.round(Math.max(...computeBeats.map((b) => b.late))) : null,
      mainGenerationMs,
      windowMainSamples: windowSamples.length,
    };
  }
}

const report = { label: LABEL, base: BASE, rates: RATES, samplesPerRate: SAMPLES, at: new Date().toISOString(), runs: [] };
for (const rate of RATES) {
  const context = await browser.newContext({ viewport: { width: 800, height: 500 }, deviceScaleFactor: 1 });
  await context.addInitScript(installProbe);
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  for (let i = 0; i < SAMPLES; i += 1) {
    try {
      const s = await sample(page, cdp, rate, i);
      report.runs.push(s);
      log(`${LABEL} ${rate}× #${i}${s.cold ? " (cold)" : ""}: window ${s.windowMs} ms · worker ${s.worker ? `${s.worker.constructToReplyMs} ms` : "none"} · long tasks ${s.longTasks} (max ${s.maxLongTaskMs}, generation ${s.generationLongTasks}) · heartbeat ${s.heartbeats} (worst late ${s.maxHeartbeatLatenessMs} ms${s.heartbeatsDuringCompute != null ? `; ${s.heartbeatsDuringCompute} while the Worker computed, worst ${s.maxHeartbeatLatenessDuringComputeMs} ms` : ""}) · frames ${s.frames} · main generation CPU ${s.mainGenerationMs} ms`);
    } catch (error) {
      report.runs.push({ rate, index: i, error: String(error?.message ?? error).slice(0, 300) });
      log(`${rate}× #${i}: ERROR ${String(error?.message ?? error).slice(0, 200)}`);
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 }).catch(() => {});
      await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 180000 }).catch(() => {});
    }
  }
  await context.close();
}
await browser.close();

const summary = {};
for (const rate of RATES) {
  const runs = report.runs.filter((r) => r.rate === rate && !r.error);
  const warm = runs.filter((r) => !r.cold);
  const cold = runs.find((r) => r.cold) ?? null;
  summary[rate] = {
    samples: runs.length,
    errors: report.runs.filter((r) => r.rate === rate && r.error).length,
    cold: cold && { windowMs: cold.windowMs, worker: cold.worker, longTasks: cold.longTasks, maxLongTaskMs: cold.maxLongTaskMs, mainGenerationMs: cold.mainGenerationMs },
    warm: {
      windowMs: stats(warm.map((r) => r.windowMs)),
      workerConstructToReplyMs: stats(warm.filter((r) => r.worker?.constructToReplyMs != null).map((r) => r.worker.constructToReplyMs)),
      samplesWithLongTask: warm.filter((r) => r.longTasks > 0).length,
      longTaskMs: stats(warm.flatMap((r) => r.attributed.map((a) => a.duration))),
      generationAttributedLongTasks: warm.reduce((n, r) => n + r.generationLongTasks, 0),
      mainGenerationMs: stats(warm.map((r) => r.mainGenerationMs)),
      maxFrameGapMs: stats(warm.map((r) => r.maxFrameGapMs)),
      framesDuringWorkerCompute: stats(warm.filter((r) => r.framesDuringCompute != null).map((r) => r.framesDuringCompute)),
      maxHeartbeatLatenessMs: stats(warm.filter((r) => r.maxHeartbeatLatenessMs != null).map((r) => r.maxHeartbeatLatenessMs)),
      heartbeatsDuringWorkerCompute: stats(warm.filter((r) => r.heartbeatsDuringCompute != null).map((r) => r.heartbeatsDuringCompute)),
      maxHeartbeatLatenessDuringWorkerComputeMs: stats(warm.filter((r) => r.maxHeartbeatLatenessDuringComputeMs != null).map((r) => r.maxHeartbeatLatenessDuringComputeMs)),
      wallsArrivedAsSet: warm.filter((r) => r.worker).every((r) => r.worker.wallsSet === true),
      longTaskOwners: [...new Set(warm.flatMap((r) => r.attributed.flatMap((a) => a.top.map(([k]) => k))))].slice(0, 8),
    },
  };
}
report.summary = summary;
log("summary", JSON.stringify(summary, null, 2));
if (OUT) fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

if (GATE) {
  const failures = [];
  for (const rate of RATES) {
    const warm = report.runs.filter((r) => r.rate === rate && !r.cold && !r.error);
    if (warm.length < Math.max(1, SAMPLES - 1)) failures.push(`${rate}×: ${warm.length} warm samples`);
    if (warm.some((r) => r.mainGenerationMs > 0)) failures.push(`${rate}×: generation ran on the main thread`);
    if (warm.some((r) => r.generationLongTasks > 0)) failures.push(`${rate}×: a long task is generation's`);
    if (warm.some((r) => !r.worker || r.worker.wallsSet !== true)) failures.push(`${rate}×: a board did not come from the Worker as a Set`);
    if (warm.some((r) => r.worker?.postToReplyMs > 30 && !(r.heartbeatsDuringCompute > 0))) failures.push(`${rate}×: the main thread did not run while the Worker computed`);
  }
  log(failures.length ? `GATE FAILED: ${failures.join("; ")}` : "gate held");
  process.exit(failures.length ? EXIT_FAILED : EXIT_OK);
}
process.exit(EXIT_OK);
