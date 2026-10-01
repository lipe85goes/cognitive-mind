/**
 * ROTA-PROJECTED-CENTERS-01 — end-to-end probe: does `data-cell-centers`
 * describe the camera the board is CURRENTLY drawn with?
 *
 * The board canvas publishes the screen projection of every logical cell. It is
 * written by `updateBoard`, `resize` and `resetView`. This probe drives the real
 * app through the five interactions that change (or used to incidentally
 * refresh) the canvas framing and, after each one, compares what the canvas
 * published against the truth.
 *
 * Truth, and why it is trustworthy: once at least a few frames have rendered
 * with the camera unchanged, the matrix the scene last drew with IS the current
 * camera. Dispatching a `resize` event with no size change makes the controller
 * re-project with exactly that matrix (`engine.resize()` is a no-op and
 * `fitCamera()` re-applies the values already in place). That write is the
 * truth; the probe then puts the attribute back to what it was, so nothing it
 * measured is "fixed" by the act of measuring. The product never reads its own
 * attribute back, so restoring it changes nothing the Explorer can see.
 *
 * Read-only by construction:
 *  - the product is not instrumented. `canvas.dataset` is observed through a
 *    pass-through proxy installed by an init script; every value is stored
 *    exactly as written. The stack of each write says which controller method
 *    wrote it — `updateBoard`, `resize`, `resetView` are property keys, so the
 *    names survive a production build.
 *  - it writes nothing unless `--out DIR` is given (screenshots + report).
 *
 * Pixels: `--entry launcher` (dev server) arms the product's diagnostic seed,
 * so every run draws the same map; the board's own WebGL buffer is then
 * compared byte for byte with `--baseline`. Under the home journey the map is
 * random and only the projection checks are meaningful.
 *
 * Usage:
 *   node tools/validation/route-projection-browser-probe.mjs [--base URL]
 *        [--out DIR] [--baseline DIR] [--viewport WxH]
 *        [--entry home|launcher] [--scenario BASE-1]
 *
 *   --baseline DIR  compare this run's board buffer, step by step, with a
 *                   previous run's `--out` directory (pixel-identical check).
 *
 * Exit: 0 every step's published centres match the current camera (and, with
 *       --baseline, every board buffer is pixel-identical); 1 otherwise.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

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
    throw new Error(
      "playwright not found. Install it, or set PLAYWRIGHT_DIR to a node_modules directory that has it.",
    );
  }
})();

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const BASE = arg("--base", "http://localhost:3100");
const OUT = arg("--out", null);
const BASELINE = arg("--baseline", null);
const ENTRY = arg("--entry", "home");
const LAUNCHER_SCENARIO = arg("--scenario", "BASE-1");
/**
 * Starting viewport. Every step resizes relative to it and stays at or above
 * 900px wide, where the canvas takes the grid row's height — the layout in
 * which Detalhes and the objective message change the canvas size. It is short
 * on purpose: under software WebGL a full-HD canvas renders slowly enough to
 * trip the 28 s world-entry watchdog.
 */
const [VIEW_W, VIEW_H] = arg("--viewport", "1024x640").split("x").map(Number);
const VIEW = { w: VIEW_W, h: VIEW_H };
/** A published centre further than this from the truth is stale. */
const TOLERANCE_PX = 0.01;
const log = (...a) => console.log("[projection]", ...a);

if (OUT) fs.mkdirSync(OUT, { recursive: true });

/** Runs in the page before any app script. Observes; changes no behaviour. */
function installProbe() {
  const probe = { writes: [], suspended: false };
  window.__projectionProbe = probe;

  const names = (stack) =>
    String(stack)
      .split("\n")
      .slice(1)
      .map((line) => {
        const m = line.trim().match(/^at (?:async )?([^\s(]+)/);
        return m ? m[1].replace(/^Object\./, "") : "<anonymous>";
      });

  const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "dataset");
  const proxies = new WeakMap();
  Object.defineProperty(HTMLElement.prototype, "dataset", {
    configurable: true,
    enumerable: original.enumerable,
    get() {
      const real = original.get.call(this);
      if (!this.classList || !this.classList.contains("route-babylon-board")) return real;
      let proxy = proxies.get(real);
      if (!proxy) {
        proxy = new Proxy(real, {
          set(target, key, value) {
            if (key === "cellCenters" && !probe.suspended) {
              // The controller's public methods are property keys, so their
              // names survive production minification; inner helpers do not.
              // A write reached through none of them is the mount or the
              // entry-readiness path.
              const limit = Error.stackTraceLimit;
              Error.stackTraceLimit = 64;
              const frames = names(new Error().stack);
              Error.stackTraceLimit = limit;
              const caller =
                frames.find((n) => n === "updateBoard" || n === "resize" || n === "resetView") ??
                "mount-or-ready";
              probe.writes.push({
                caller,
                viaUpdateBoard: caller === "updateBoard",
              });
            }
            target[key] = value;
            return true;
          },
        });
        proxies.set(real, proxy);
      }
      return proxy;
    },
  });
}

/**
 * `--entry launcher` goes through `/lab/route-launcher` (dev server only): it
 * arms the product's own diagnostic seed, so the board is the same map on
 * every run. That is what before/after pixel comparison needs — the home
 * journey draws its map from an unseeded stream.
 */
async function enterViaLauncher(page) {
  await page.goto(`${BASE}/lab/route-launcher`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.getByRole("button", { name: new RegExp(`^${LAUNCHER_SCENARIO} ·`) }).click({ timeout: 180000 });
  await page.locator(".rsg-shell").waitFor({ state: "visible", timeout: 180000 });
  await page.locator('.route-babylon-wrap[data-visual-state="ready"]').waitFor({ timeout: 180000 });
  await page.waitForTimeout(1500);
}

async function enterRoute(page) {
  if (ENTRY === "launcher") return enterViaLauncher(page);
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.locator(".hj-stage").waitFor({ timeout: 180000 });
  await page.waitForTimeout(1800);
  await page.locator('.hj-gallery-pip[aria-label="Selecionar Rota Estratégica"]').click({ force: true });
  await page.mouse.move(14, 14);
  await page.waitForTimeout(700);
  await page.locator('.hj-world-object[aria-current="true"] .hj-world-enter').click({ force: true });
  // Under software WebGL the first entry can outlast the 28 s watchdog (most of
  // it is loading and compiling Babylon). The retry reuses what already loaded.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const phase = await page
      .waitForFunction(
        () => {
          const p = document.querySelector("[data-entry-phase]")?.getAttribute("data-entry-phase");
          if (p === "error") return "error";
          return !p || p === "complete" ? "done" : null;
        },
        null,
        { timeout: 180000, polling: 500 },
      )
      .then((h) => h.jsonValue());
    if (phase !== "error") break;
    log(`entry watchdog fired (attempt ${attempt + 1}); retrying`);
    await page.getByRole("button", { name: "Tentar novamente" }).click();
  }
  await page.locator(".pgi-cta").waitFor({ state: "visible", timeout: 180000 });
  await page.locator("[data-entry-phase]").waitFor({ state: "detached", timeout: 120000 }).catch(() => {});
  await page.waitForTimeout(300);
  await page.locator(".pgi-cta").click();
  await page.locator(".rsg-shell").waitFor({ state: "visible", timeout: 180000 });
  await page.locator('.route-babylon-wrap[data-visual-state="ready"]').waitFor({ timeout: 180000 });
  await page.waitForTimeout(1500);
}

/** Wait until `count` more animation frames have run. */
const frames = (page, count) =>
  page.evaluate(
    (n) =>
      new Promise((resolve) => {
        let left = n;
        const step = () => (--left <= 0 ? resolve() : requestAnimationFrame(step));
        requestAnimationFrame(step);
      }),
    count,
  );

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--use-gl=angle", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
});
const ctx = await browser.newContext({ viewport: { width: VIEW.w, height: VIEW.h }, deviceScaleFactor: 1 });
await ctx.addInitScript(installProbe);
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 200));
});
page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 200)}`));

await enterRoute(page);

const canvas = page.locator("canvas.route-babylon-board");
const steps = [];

async function measure(id, action) {
  const writesBefore = await page.evaluate(() => window.__projectionProbe.writes.length);
  await action();
  // Let ResizeObserver, React commits and several frames settle. Nothing in the
  // product rewrites the centres on its own, so what is published now is what
  // stays published until the next updateBoard/resize/resetView.
  await page.waitForTimeout(900);
  await frames(page, 4);

  const shot = await canvas.screenshot();
  // The board's own pixels, read from the WebGL drawing buffer in the frame
  // right after Babylon drew it (a rAF queued now runs after the render loop's
  // already-queued one). The element screenshot above also contains the
  // animated room behind the transparent canvas, so it is evidence for a
  // human, not a comparison basis.
  const board = Buffer.from(
    (
      await page.evaluate(
        () =>
          new Promise((resolve) =>
            requestAnimationFrame(() =>
              resolve(document.querySelector("canvas.route-babylon-board").toDataURL("image/png")),
            ),
          ),
      )
    ).split(",")[1],
    "base64",
  );
  const sample = await page.evaluate((from) => {
    const c = document.querySelector("canvas.route-babylon-board");
    const probe = window.__projectionProbe;
    const published = c.getAttribute("data-cell-centers");
    // Truth: re-project with the matrix the last frames drew with.
    probe.suspended = true;
    window.dispatchEvent(new Event("resize"));
    const truth = c.getAttribute("data-cell-centers");
    c.setAttribute("data-cell-centers", published);
    probe.suspended = false;
    const r = c.getBoundingClientRect();
    return {
      published,
      truth,
      writes: probe.writes.slice(from),
      canvas: `${Math.round(r.width)}x${Math.round(r.height)}`,
      player: c.dataset.playerCell,
      status: c.dataset.status,
    };
  }, writesBefore);

  const published = JSON.parse(sample.published || "{}");
  const truth = JSON.parse(sample.truth || "{}");
  let maxErrorPx = 0;
  let worstCell = null;
  for (const [key, t] of Object.entries(truth)) {
    const p = published[key];
    const d =
      p && Number.isFinite(p.x) && Number.isFinite(p.y)
        ? Math.hypot(p.x - t.x, p.y - t.y)
        : Infinity;
    if (d > maxErrorPx) {
      maxErrorPx = d;
      worstCell = key;
    }
  }
  const round = (v) => (v && Number.isFinite(v.x) ? { x: +v.x.toFixed(3), y: +v.y.toFixed(3) } : v ?? null);
  const step = {
    id,
    canvas: sample.canvas,
    status: sample.status,
    player: sample.player,
    writes: sample.writes.length,
    writers: sample.writes.map((w) => w.caller),
    updateBoardCalls: sample.writes.filter((w) => w.viaUpdateBoard).length,
    cellsPublished: Object.keys(published).length,
    maxErrorPx: Number.isFinite(maxErrorPx) ? +maxErrorPx.toFixed(4) : "non-finite",
    worstCell,
    centre44: { published: round(published["4,4"]), current: round(truth["4,4"]) },
    corner00: { published: round(published["0,0"]), current: round(truth["0,0"]) },
    fresh: Object.keys(truth).length === 81 && maxErrorPx <= TOLERANCE_PX,
  };

  const raw = await sharp(board).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (OUT) {
    fs.writeFileSync(path.join(OUT, `${id}.png`), shot);
    fs.writeFileSync(path.join(OUT, `${id}.board.png`), board);
  }
  if (BASELINE) {
    const file = path.join(BASELINE, `${id}.board.png`);
    if (!fs.existsSync(file)) {
      step.pixels = { compared: false, reason: "no baseline board buffer" };
    } else {
      const base = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      if (base.info.width !== raw.info.width || base.info.height !== raw.info.height) {
        step.pixels = { compared: true, identical: false, reason: "size differs" };
      } else {
        let differing = 0;
        let maxDelta = 0;
        for (let i = 0; i < raw.data.length; i += 4) {
          let delta = 0;
          for (let k = 0; k < 4; k += 1) delta = Math.max(delta, Math.abs(raw.data[i + k] - base.data[i + k]));
          if (delta) differing += 1;
          maxDelta = Math.max(maxDelta, delta);
        }
        step.pixels = { compared: true, identical: differing === 0, differingPixels: differing, maxChannelDelta: maxDelta };
      }
    }
  }
  steps.push(step);
  log(id, JSON.stringify(step));
  return step;
}

// 1 — the viewport changes, then the route starts.
await measure("1-start-after-resize", async () => {
  await page.setViewportSize({ width: VIEW.w - 64, height: VIEW.h - 40 });
  await page.waitForTimeout(900);
  await page.locator('button[aria-label="Iniciar rota com a dificuldade selecionada"]').click();
});

// 2 — a blocked step (the Explorer starts on the bottom row: "down" is off-board).
await measure("2-blocked-move", async () => {
  await page.locator('button[aria-label="Mover Baixo"]').click();
});

// 3 — Detalhes opens, then closes.
await measure("3a-details-open", async () => {
  await page.locator(".rsg-details-trigger").click();
});
await measure("3b-details-close", async () => {
  await page.locator('button[aria-label="Fechar detalhes da rota"]').click();
});

// 4 — the camera is zoomed by the wheel, then Centralizar resets it.
await measure("4-reset-view", async () => {
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 3; i += 1) {
    await page.mouse.wheel(0, 240);
    await page.waitForTimeout(120);
  }
  await frames(page, 4);
  await page.locator('button[aria-label="Centralizar a visão do tabuleiro"]').click();
});

// 5 — a real viewport resize, down and back up.
await measure("5a-viewport-resize", async () => {
  await page.setViewportSize({ width: VIEW.w - 104, height: VIEW.h - 60 });
});
await measure("5b-viewport-restore", async () => {
  await page.setViewportSize({ width: VIEW.w, height: VIEW.h });
});

// Interaction: tap a legal move target at its PUBLISHED centre; scene.pick must
// land on that tile and the Explorer must move there.
const tap = await page.evaluate(() => {
  const c = document.querySelector("canvas.route-babylon-board");
  const target = (c.dataset.moveTargets || "").split(" ").filter(Boolean)[0];
  const centre = JSON.parse(c.getAttribute("data-cell-centers"))[target];
  const r = c.getBoundingClientRect();
  return { target, x: r.left + centre.x, y: r.top + centre.y, from: c.dataset.playerCell };
});
await page.mouse.click(tap.x, tap.y);
await page.waitForTimeout(900);
const playerAfterTap = await page.evaluate(() => document.querySelector("canvas.route-babylon-board").dataset.playerCell);
const tapResult = { target: tap.target, from: tap.from, to: playerAfterTap, moved: playerAfterTap === tap.target };
log("tap", JSON.stringify(tapResult));

await browser.close();

const report = {
  mission: "ROTA-PROJECTED-CENTERS-01",
  entry: ENTRY === "launcher" ? `launcher ${LAUNCHER_SCENARIO}` : "home",
  tolerancePx: TOLERANCE_PX,
  steps,
  tap: tapResult,
  consoleErrors: errors,
};
if (OUT) fs.writeFileSync(path.join(OUT, "projection-probe.json"), JSON.stringify(report, null, 2));

const fails = [];
for (const s of steps) {
  if (!s.fresh) fails.push(`${s.id}: published centres are ${s.maxErrorPx}px from the current camera (worst ${s.worstCell})`);
  if (s.pixels && s.pixels.compared && !s.pixels.identical) fails.push(`${s.id}: board pixels differ from baseline`);
}
if (!tapResult.moved) fails.push(`tap at published centre of ${tapResult.target} did not move the Explorer`);
if (errors.length) fails.push(`${errors.length} console error(s): ${errors.slice(0, 3).join(" | ")}`);
if (fails.length) {
  console.error("\nPROJECTION FAILURES:\n" + fails.map((f) => ` - ${f}`).join("\n"));
  process.exit(1);
}
log("PROJECTED_CENTRES_FRESH");
