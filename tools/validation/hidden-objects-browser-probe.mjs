/**
 * GAME03-SKELETON-01 — browser probe for the Estúdio das Descobertas.
 *
 * Drives the PRODUCTION build (`next build && next start`) the way a person
 * would — the Home, the world entry, the intro, the setup, the scene, the
 * result — and reads only what the page shows (DOM, the world element's
 * transform, localStorage, network). Nothing in the product is instrumented:
 * React commits are counted through a stand-in for the React DevTools hook the
 * page sees before React loads, the same hook React offers to the DevTools
 * extension in production.
 *
 * Scenarios (all by default; pick with --scenario a,b):
 *   desktop        1440×900, mouse: Home slot → entry → intro → setup → pan → wheel/±
 *                  zoom → Mesa → free tap → find → drag over a target → hints 1/2/3 →
 *                  find all → result (one) → play again → restart → exit → Home
 *   mobile         390×844, touch (CDP touch events): entry → drag → pinch → tap → tray →
 *                  hint → find all → result; never a horizontal page overflow
 *   small          360×640, touch: setup reachable, scene area kept, one find, no overflow
 *   reduced-motion 1440×900 with prefers-reduced-motion: station cuts instantly, halos still
 *   legacy         a stored `number-trail` result: Home loads, nothing breaks, nothing opens the
 *                  retired game, nothing converts the old result
 *   bundle         the build directory: Game 03 code only in its own lazy set; Babylon, the
 *                  Rota and the Circuito sets free of it; sizes
 *
 * Usage:
 *   node tools/validation/hidden-objects-browser-probe.mjs [--base http://localhost:3100]
 *        [--build .next] [--scenario NAME[,NAME…]] [--out DIR] [--json FILE]
 *
 *   --out DIR   save the visual witnesses (WebP) there
 *   --json FILE write the measured run (verdicts and numbers) as JSON
 *
 * Playwright: `import("playwright")`, or set PLAYWRIGHT_DIR to a node_modules
 * directory that has it (the same convention as the other probes).
 *
 * Exit: 0 every scenario held · 1 a check failed · 3 usage / setup error.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import zlib from "node:zlib";
import { pathToFileURL } from "node:url";
import ts from "typescript";

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_USAGE = 3;

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const BASE = arg("--base", "http://localhost:3100");
const BUILD = arg("--build", ".next");
const OUT = arg("--out", null);
const JSON_OUT = arg("--json", null);
const ALL = ["desktop", "mobile", "small", "reduced-motion", "legacy", "bundle"];
const SCENARIOS = (arg("--scenario", ALL.join(",")) ?? "").split(",").filter(Boolean);
if (SCENARIOS.some((name) => !ALL.includes(name))) {
  console.error(`unknown scenario; choose from ${ALL.join(", ")}`);
  process.exit(EXIT_USAGE);
}

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

// --- the scene data the game uses (read from source, never restated here) -------------------------

const SCENE = (() => {
  const js = ts.transpileModule(fs.readFileSync("src/games/hidden-objects/hidden-objects-scene.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(js, { module: mod, exports: mod.exports, require: () => ({}) });
  return mod.exports;
})();
const TARGET = Object.fromEntries(SCENE.HIDDEN_OBJECTS.map((t) => [t.id, t]));
const STATION = Object.fromEntries(SCENE.SCENE_STATIONS.map((s) => [s.id, s]));
const centreOf = (region) =>
  region.kind === "rect" ? { x: region.x + region.w / 2, y: region.y + region.h / 2 } : { x: region.cx, y: region.cy };
const STORAGE_KEY = /const STORAGE_KEY = "([^"]+)"/.exec(fs.readFileSync("src/engine/storage.ts", "utf8"))[1];

// --- results ----------------------------------------------------------------------------------------

const results = [];
const metrics = {};
let current = "setup";
function check(id, pass, detail = {}) {
  results.push({ scenario: current, id, pass: Boolean(pass), detail });
  console.log(`${pass ? "PASS" : "FAIL"}  [${current}] ${id}`);
  if (!pass || process.env.PROBE_VERBOSE) {
    for (const [key, value] of Object.entries(detail)) console.log(`        ${key}: ${JSON.stringify(value)}`);
  }
  return pass;
}

// --- the build the server serves ----------------------------------------------------------------------

const BUILD_ID = fs.existsSync(path.join(BUILD, "BUILD_ID")) ? fs.readFileSync(path.join(BUILD, "BUILD_ID"), "utf8").trim() : null;
if (SCENARIOS.some((name) => name !== "bundle")) {
  let html = "";
  try {
    html = await (await fetch(`${BASE}/`)).text();
  } catch (error) {
    console.error(`no server at ${BASE}: run \`npx next build && npx next start -p 3100\` first (${error.message})`);
    process.exit(EXIT_USAGE);
  }
  if (!BUILD_ID || !html.includes(BUILD_ID)) {
    console.error(`the server at ${BASE} does not serve the build in ${BUILD} (BUILD_ID ${BUILD_ID ?? "missing"})`);
    process.exit(EXIT_USAGE);
  }
}

// --- in-page observers (observe, change nothing) -------------------------------------------------------

/** A stand-in for the React DevTools hook: React reports each commit to it, in production too. */
function installObservers() {
  window.__probe = { commits: 0, longTasks: [], transformWrites: 0 };
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    isDisabled: false,
    renderers: new Map(),
    inject(renderer) {
      const id = this.renderers.size + 1;
      this.renderers.set(id, renderer);
      return id;
    },
    checkDCE() {},
    onScheduleFiberRoot() {},
    onCommitFiberRoot() {
      window.__probe.commits += 1;
    },
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    setStrictMode() {},
  };
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__probe.longTasks.push({ start: entry.startTime, duration: entry.duration });
    }).observe({ type: "longtask", buffered: true });
  } catch {
    // longtask unsupported: reported as such
  }
}

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--use-gl=angle", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
});

async function openSession({ width, height, touch = false, reducedMotion = "no-preference", init = null }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    hasTouch: touch,
    isMobile: touch,
    reducedMotion,
  });
  await context.addInitScript(installObservers);
  if (init) await context.addInitScript(init.fn, init.arg);
  const page = await context.newPage();
  const session = { context, page, errors: [], requests: [], touch, cdp: null };
  page.on("pageerror", (error) => session.errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") session.errors.push(`console: ${message.text()}`);
  });
  page.on("request", (request) => session.requests.push(request.url()));
  if (touch) session.cdp = await context.newCDPSession(page);
  return session;
}

/** A screenshot for the record (only with --out). `settleMs` lets a fade finish first. */
async function witness(page, name, settleMs = 0) {
  if (!OUT) return;
  if (settleMs) await page.waitForTimeout(settleMs);
  fs.mkdirSync(OUT, { recursive: true });
  const png = await page.screenshot();
  const sharp = (await import("sharp")).default;
  await sharp(png).webp({ quality: 74 }).toFile(path.join(OUT, `${name}.webp`));
}

// --- reading the game -----------------------------------------------------------------------------------

async function camera(page) {
  return page.evaluate(() => {
    const world = document.querySelector(".hos-world");
    const viewport = document.querySelector(".hos-viewport");
    if (!world || !viewport) return null;
    const m = /translate3d\(([-\d.e]+)px,\s*([-\d.e]+)px,\s*0(?:px)?\)\s*scale\(([-\d.e]+)\)/.exec(world.style.transform);
    const rect = viewport.getBoundingClientRect();
    return m
      ? { tx: +m[1], ty: +m[2], s: +m[3], left: rect.left, top: rect.top, width: rect.width, height: rect.height, moving: world.dataset.moving === "true" }
      : null;
  });
}

/** The scene point at the centre of the viewport. */
const viewCentre = (cam) => ({ x: (cam.width / 2 - cam.tx) / cam.s, y: (cam.height / 2 - cam.ty) / cam.s });
const toScreen = (cam, p) => ({ x: cam.left + cam.tx + p.x * cam.s, y: cam.top + cam.ty + p.y * cam.s });

const frames = (page, count = 2) =>
  page.evaluate(
    (n) =>
      new Promise((resolve) => {
        const step = (left) => (left === 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
        step(n);
      }),
    count,
  );

/**
 * Wait until the camera rests. A glide starts writing on the next frame, so
 * first let frames pass, then wait out `data-moving`, then one more paint.
 * (A tap during a glide is swallowed by design: it only stops the camera.)
 */
async function settle(page) {
  await frames(page, 2);
  await page.waitForFunction(() => document.querySelector(".hos-world")?.dataset.moving !== "true", null, { timeout: 5000, polling: "raf" });
  await frames(page, 2);
}

async function progress(page) {
  return page.evaluate(() => {
    const bar = document.querySelector(".hos-progress");
    return bar ? { found: Number(bar.getAttribute("aria-valuenow")), total: Number(bar.getAttribute("aria-valuemax")) } : null;
  });
}

async function status(page) {
  return page.evaluate(() => document.querySelector(".hos-shell")?.dataset.status ?? null);
}

async function storedResults(page) {
  return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "[]"), STORAGE_KEY);
}

async function overflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/** Inside the viewport, clear of its edges and of the zoom buttons in the corner. */
async function comfortable(page, cam, point) {
  const zoom = await page.evaluate(() => document.querySelector(".hos-zoom")?.getBoundingClientRect().toJSON());
  const margin = 40;
  const inside =
    point.x > cam.left + margin && point.x < cam.left + cam.width - margin && point.y > cam.top + margin && point.y < cam.top + cam.height - margin;
  const underZoom = zoom && point.x > zoom.left - 24 && point.x < zoom.right + 24 && point.y > zoom.top - 24 && point.y < zoom.bottom + 24;
  return inside && !underZoom;
}

// --- input ----------------------------------------------------------------------------------------------

async function drag(session, from, to, steps = 12) {
  const { page } = session;
  if (!session.touch) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i += 1) {
      await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    }
    await page.mouse.up();
    return;
  }
  const point = (p) => [{ x: Math.round(p.x), y: Math.round(p.y), id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await session.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(from) });
  for (let i = 1; i <= steps; i += 1) {
    const p = { x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps };
    await session.cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point(p) });
  }
  await session.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function pinch(session, centre, startGap, endGap, steps = 10) {
  const pair = (gap) => [
    { x: Math.round(centre.x - gap / 2), y: Math.round(centre.y), id: 1, radiusX: 4, radiusY: 4, force: 1 },
    { x: Math.round(centre.x + gap / 2), y: Math.round(centre.y), id: 2, radiusX: 4, radiusY: 4, force: 1 },
  ];
  await session.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pair(startGap) });
  for (let i = 1; i <= steps; i += 1) {
    await session.cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pair(startGap + ((endGap - startGap) * i) / steps) });
  }
  await session.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}

async function tapAt(session, point) {
  if (session.touch) await session.page.touchscreen.tap(Math.round(point.x), Math.round(point.y));
  else await session.page.mouse.click(Math.round(point.x), Math.round(point.y));
}

async function press(session, locator) {
  if (session.touch) await locator.tap();
  else await locator.click();
}

/** Station, then a drag if the object is not comfortably on screen: the way a person would get there. */
async function bringIntoView(session, id) {
  const { page } = session;
  const target = TARGET[id];
  await press(session, page.locator(".hos-station", { hasText: STATION[target.station].label }));
  await settle(page);
  let cam = await camera(page);
  let point = toScreen(cam, centreOf(target.region));
  if (!(await comfortable(page, cam, point))) {
    const centre = { x: cam.left + cam.width / 2, y: cam.top + cam.height / 2 };
    await drag(session, centre, { x: centre.x + (centre.x - point.x), y: centre.y + (centre.y - point.y) });
    await settle(page);
    cam = await camera(page);
    point = toScreen(cam, centreOf(target.region));
  }
  return { cam, point, comfortable: await comfortable(page, cam, point) };
}

async function findTarget(session, id) {
  const before = await progress(session.page);
  const { point, comfortable: ok } = await bringIntoView(session, id);
  await tapAt(session, point);
  await session.page.waitForFunction((n) => Number(document.querySelector(".hos-progress")?.getAttribute("aria-valuenow")) > n, before.found, { timeout: 4000 }).catch(() => {});
  const after = await progress(session.page);
  return { id, comfortable: ok, before: before.found, after: after.found };
}

// --- the flow -------------------------------------------------------------------------------------------

/** Home → select the Estúdio's world → Entrar → (transition) → intro on screen. Returns timing. */
async function enterStudio(session, { onSelected } = {}) {
  const { page } = session;
  await press(session, page.locator(".hj-gallery-pips").getByRole("button", { name: "Selecionar Estúdio das Descobertas" }));
  await page.waitForFunction(() => document.querySelector(".hj-world-selected .hj-world-copy strong")?.textContent === "Estúdio das Descobertas");
  if (onSelected) await onSelected();
  const started = Date.now();
  await press(session, page.locator(".hj-world-enter"));
  await page.waitForSelector(".wtx-shell", { timeout: 5000 });
  const transitionWorld = await page.locator(".wtx-plaque strong").textContent();
  await page.waitForFunction(
    () => {
      const shell = document.querySelector(".wtx-shell");
      return !shell || shell.dataset.entryPhase === "revealing" || shell.dataset.entryPhase === "error";
    },
    null,
    { timeout: 20000, polling: 50 },
  );
  const readyAfterMs = Date.now() - started;
  const phase = await page.evaluate(() => document.querySelector(".wtx-shell")?.dataset.entryPhase ?? "gone");
  await page.waitForFunction(() => !document.querySelector(".wtx-shell"), null, { timeout: 8000 });
  await page.waitForSelector(".pgi-cta", { state: "visible" });
  return { transitionWorld, readyAfterMs, phase };
}

async function startExploring(session, level = "Fácil") {
  const { page } = session;
  await press(session, page.locator(".pgi-cta"));
  await page.waitForSelector(".hos-setup", { state: "visible" });
  await press(session, page.locator(".hos-difficulty-option", { hasText: level }));
  await press(session, page.getByRole("button", { name: "Explorar", exact: true }));
  await page.waitForFunction(() => document.querySelector(".hos-shell")?.dataset.status === "playing");
  await settle(page);
}

async function listedIds(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll(".hos-item")].map((item) => item.getAttribute("aria-label")),
  );
}

const easyIds = SCENE.DIFFICULTY_PRESETS.easy.targets;

// --- scenario: desktop ---------------------------------------------------------------------------------

async function desktop() {
  current = "desktop";
  const session = await openSession({ width: 1440, height: 900 });
  const { page } = session;
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

  // 1–2 Home and the slot
  const pips = await page.locator(".hj-gallery-pip").evaluateAll((nodes) => nodes.map((n) => n.getAttribute("aria-label")));
  check("01_HOME_LOADS", pips.length === 5, { pips });
  check("02_STUDIO_IN_THE_TRAILS_SLOT", pips[3] === "Selecionar Estúdio das Descobertas" && !pips.some((p) => /Trilha/.test(p)), { order: pips });
  await witness(page, "01-home");

  // 3–6 entry, transition, intro, readiness
  const entry = await enterStudio(session, { onSelected: () => witness(page, "02-home-slot-selected", 700) });
  metrics.entryToReadyMs = entry.readyAfterMs;
  check("03_04_OPENS_THROUGH_THE_TRANSITION", entry.transitionWorld === "Estúdio das Descobertas", entry);
  const intro = await page.evaluate(() => ({
    title: document.querySelector(".pgi-plaque-text")?.textContent,
    steps: document.querySelectorAll(".pgi-steps li").length,
  }));
  check("05_INTRO", intro.title === "Estúdio das Descobertas" && intro.steps === 3, intro);
  check("06_READY_REPORTED_NOT_TIMED_OUT", entry.phase === "revealing" || entry.phase === "gone", { phase: entry.phase, readyAfterMs: entry.readyAfterMs });
  await witness(page, "03-intro");

  // 7–9 setup
  await press(session, page.locator(".pgi-cta"));
  await page.waitForSelector(".hos-setup", { state: "visible" });
  const setup = await page.evaluate(() => ({
    title: document.querySelector(".hos-setup h2")?.textContent,
    levels: [...document.querySelectorAll(".hos-difficulty-option strong")].map((n) => n.textContent),
    status: document.querySelector(".hos-shell")?.dataset.status,
  }));
  check("07_SETUP", setup.title === "Estúdio das Descobertas" && setup.levels.join("|") === "Fácil|Médio|Difícil" && setup.status === "setup", setup);
  await witness(page, "04-setup");
  await press(session, page.locator(".hos-difficulty-option", { hasText: "Fácil" }));
  check("08_CHOOSE_EASY", await page.locator('.hos-difficulty-option input[value="easy"]').isChecked());
  await press(session, page.getByRole("button", { name: "Explorar", exact: true }));
  await page.waitForFunction(() => document.querySelector(".hos-shell")?.dataset.status === "playing");
  await settle(page);
  const list = await listedIds(page);
  check("09_EXPLORE_STARTS_PLAYING", (await status(page)) === "playing" && list.length === 5 && (await progress(page)).found === 0, { list });
  await witness(page, "05-playing-desktop");

  // 10 pan (and the React side of it)
  let cam = await camera(page);
  const centre = { x: cam.left + cam.width / 2, y: cam.top + cam.height / 2 };
  const before = viewCentre(cam);
  const commitsBefore = await page.evaluate(() => window.__probe.commits);
  const writes = await page.evaluate(() => {
    window.__probe.transformWrites = 0;
    const world = document.querySelector(".hos-world");
    window.__probe.mo?.disconnect();
    window.__probe.mo = new MutationObserver((records) => {
      window.__probe.transformWrites += records.length;
    });
    window.__probe.mo.observe(world, { attributes: true, attributeFilter: ["style"] });
    window.__probe.dragStart = performance.now();
    return 0;
  });
  void writes;
  const moves = 24;
  await drag(session, centre, { x: centre.x - 240, y: centre.y + 10 }, moves);
  await settle(page);
  const drag10 = await page.evaluate(() => ({
    commits: window.__probe.commits,
    transformWrites: window.__probe.transformWrites,
    longTasks: window.__probe.longTasks.filter((t) => t.start >= window.__probe.dragStart),
  }));
  cam = await camera(page);
  const after = viewCentre(cam);
  metrics.desktopDrag = { pointerMoves: moves, reactCommitsDuringDrag: drag10.commits - commitsBefore, styleMutations: drag10.transformWrites, longTasks: drag10.longTasks };
  check("10_PAN_MOVES_THE_CAMERA", after.x - before.x > 300 && Math.abs(after.y - before.y) < 40, { before, after });
  check("10_PAN_RENDERS_NO_REACT_PER_POINTERMOVE", drag10.commits - commitsBefore === 0, metrics.desktopDrag);
  // the commit counter really counts: a list click is a state change
  const probeCommits = await page.evaluate(() => window.__probe.commits);
  await press(session, page.locator(".hos-item").first());
  await page.waitForTimeout(80);
  check("10_COMMIT_COUNTER_IS_LIVE", (await page.evaluate(() => window.__probe.commits)) > probeCommits);

  // 11 zoom: focal wheel, then the buttons
  cam = await camera(page);
  const focal = { x: cam.left + cam.width * 0.3, y: cam.top + cam.height * 0.4 };
  const sceneUnder = { x: (focal.x - cam.left - cam.tx) / cam.s, y: (focal.y - cam.top - cam.ty) / cam.s };
  await page.mouse.move(focal.x, focal.y);
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(300);
  await settle(page);
  const zoomed = await camera(page);
  const stillUnder = toScreen(zoomed, sceneUnder);
  check("11_WHEEL_ZOOMS_AT_THE_CURSOR", zoomed.s > cam.s * 1.2 && Math.hypot(stillUnder.x - focal.x, stillUnder.y - focal.y) < 2, {
    scale: [cam.s, zoomed.s],
    drift: Math.hypot(stillUnder.x - focal.x, stillUnder.y - focal.y),
  });
  await press(session, page.getByRole("button", { name: "Aproximar" }));
  await settle(page);
  const plus = await camera(page);
  await press(session, page.getByRole("button", { name: "Afastar" }));
  await settle(page);
  const minus = await camera(page);
  check("11_ZOOM_BUTTONS", plus.s > zoomed.s && minus.s < plus.s, { scales: [zoomed.s, plus.s, minus.s] });
  await witness(page, "06-mesa-zoom");

  // 12 Mesa
  await press(session, page.locator(".hos-station", { hasText: "Mesa" }));
  await settle(page);
  cam = await camera(page);
  const mesa = viewCentre(cam);
  const mesaPressed = await page.locator(".hos-station", { hasText: "Mesa" }).getAttribute("aria-pressed");
  check("12_MESA_STATION", Math.abs(mesa.x - STATION.mesa.center.x) < 2 && mesaPressed === "true", { centre: mesa, cover: cam.s });

  // 13 free tap: nothing found, nothing counted, a ripple, no announcement
  const wall = toScreen(cam, { x: 1330, y: 250 });
  await tapAt(session, wall);
  await page.waitForTimeout(120);
  const free = await page.evaluate(() => ({
    ripple: Boolean(document.querySelector(".hos-ripple")),
    live: document.querySelector('.hos-sr-only[aria-live]')?.textContent ?? "",
  }));
  check("13_FREE_TAP_IS_FREE", (await progress(page)).found === 0 && free.ripple && free.live === "", free);

  // 14 select a target
  const first = await findTarget(session, "lupa");
  const seal = await page.locator('.hos-found[data-target="lupa"] .hos-found-seal').count();
  const listed = await page.locator(".hos-item", { hasText: "Lupa" }).getAttribute("data-found");
  const announced = await page.evaluate(() => document.querySelector('.hos-sr-only[aria-live]')?.textContent ?? "");
  check("14_TAP_FINDS_THE_TARGET", first.after === 1 && seal === 1 && listed === "true" && /Encontrou: Lupa/.test(announced), { ...first, announced });

  // 15 a drag that starts on a target finds nothing
  const compass = await bringIntoView(session, "bussola");
  const camBefore = await camera(page);
  await drag(session, compass.point, { x: compass.point.x + 120, y: compass.point.y - 30 });
  await settle(page);
  const camAfter = await camera(page);
  check("15_DRAG_FROM_A_TARGET_DOES_NOT_SELECT", (await progress(page)).found === 1 && Math.abs(camAfter.tx - camBefore.tx) > 60, {
    found: (await progress(page)).found,
    moved: camAfter.tx - camBefore.tx,
  });

  // 16–18 hints for the next pending object (the Ampulheta, by list order: the Lupa is found)
  const subject = await page.evaluate(() => document.querySelector(".hos-hint-button small")?.textContent);
  await press(session, page.locator(".hos-hint-button"));
  await settle(page);
  const hint1 = await page.evaluate(() => ({
    banner: document.querySelector(".hos-hint-banner")?.textContent ?? "",
    hinted: document.querySelector('.hos-station[data-hinted="true"]')?.textContent ?? null,
    halo: Boolean(document.querySelector(".hos-halo")),
  }));
  const subjectTarget = SCENE.HIDDEN_OBJECTS.find((t) => t.label === subject);
  check("16_HINT_1_NAMES_THE_ZONE", /^Pista: procure/.test(hint1.banner) && hint1.hinted === STATION[subjectTarget?.station]?.label && !hint1.halo, { subject, ...hint1 });
  await press(session, page.locator(".hos-hint-button"));
  await settle(page);
  const hint2 = await page.evaluate(() => ({
    banner: document.querySelector(".hos-hint-banner")?.textContent ?? "",
    halo: document.querySelector(".hos-halo")?.className ?? null,
    button: document.querySelector(".hos-hint-button span")?.childNodes[0]?.textContent ?? "",
  }));
  check("17_HINT_2_LIGHTS_A_REGION", /hos-halo-hint/.test(hint2.halo ?? "") && hint2.button === "Mostrar onde está", hint2);
  await witness(page, "07-hint", 900);
  await press(session, page.locator(".hos-hint-button"));
  await settle(page);
  cam = await camera(page);
  const revealCentre = viewCentre(cam);
  const subjectCentre = centreOf(subjectTarget.region);
  const hint3 = await page.evaluate(() => ({
    banner: document.querySelector(".hos-hint-banner")?.textContent ?? "",
    halo: document.querySelector(".hos-halo")?.className ?? null,
  }));
  check("18_SHOW_WHERE_FRAMES_IT", /hos-halo-reveal/.test(hint3.halo ?? "") && /^Aqui está:/.test(hint3.banner) && Math.hypot(revealCentre.x - subjectCentre.x, revealCentre.y - subjectCentre.y) < 260, {
    ...hint3,
    viewCentre: revealCentre,
    object: subjectCentre,
  });
  await witness(page, "08-show-where");
  await tapAt(session, toScreen(cam, subjectCentre));
  await page.waitForTimeout(150);
  check("18_REVEALED_OBJECT_IS_TAPPED_BY_THE_EXPLORADOR", (await progress(page)).found === 2);

  // 19 everything else
  const rest = [];
  for (const id of easyIds) {
    const found = await page.locator(`.hos-found[data-target="${id}"]`).count();
    if (!found) rest.push(await findTarget(session, id));
  }
  check("19_FIND_ALL", (await progress(page)).found === 5 && (await status(page)) === "completed", { rest });

  // 20 the closing card and exactly one result
  await page.waitForSelector(".hos-overlay-complete", { state: "visible", timeout: 4000 });
  await witness(page, "09-completion", 600);
  const resultsBefore = (await storedResults(page)).length;
  await page.evaluate(() => {
    const button = [...document.querySelectorAll(".hos-overlay-complete button")].find((b) => b.textContent === "Concluir exploração");
    button.click();
    button.click();
  });
  await page.waitForSelector(".prm-card", { timeout: 6000 });
  const modal = await page.evaluate(() => ({
    world: document.querySelector(".prm-world")?.textContent,
    title: document.querySelector(".prm-title")?.textContent,
    summary: document.querySelector("#reward-summary")?.textContent,
    details: Object.fromEntries([...document.querySelectorAll(".prm-detail")].map((d) => [d.querySelector("dt")?.textContent, d.querySelector("dd")?.textContent])),
  }));
  const stored = await storedResults(page);
  const saved = stored[0];
  check("20_RESULT_SCREEN", modal.world === "Estúdio das Descobertas" && modal.title === "Estúdio explorado" && modal.summary === "Você encontrou todos os objetos do Estúdio.", modal);
  check("20_ONE_RESULT_PER_SESSION", stored.length === resultsBefore + 1, { before: resultsBefore, after: stored.length });
  check(
    "20_RESULT_CONTRACT",
    saved?.gameId === "hidden-objects" &&
      saved.activityId === "hidden-objects" &&
      saved.activityTitle === "Estúdio das Descobertas" &&
      saved.score === 5 &&
      JSON.stringify(saved.details) === JSON.stringify({ difficulty: "easy", foundObjects: 5, totalObjects: 5, completed: true }) &&
      saved.continuation === undefined,
    { saved },
  );
  metrics.resultDetailsShown = modal.details;
  await witness(page, "10-result");

  // 21 play again: a fresh session through the shell (intro, setup, nothing found)
  await press(session, page.getByRole("button", { name: "Praticar este desafio outra vez" }));
  await page.waitForFunction(() => !document.querySelector(".wtx-shell"), null, { timeout: 20000 });
  await page.waitForSelector(".pgi-cta", { state: "visible" });
  await press(session, page.locator(".pgi-cta"));
  await page.waitForSelector(".hos-setup", { state: "visible" });
  check("21_PLAY_AGAIN_IS_FRESH", (await status(page)) === "setup" && (await progress(page)).found === 0);

  // 22 restart: same difficulty, nothing found, the camera back at the table
  await press(session, page.locator(".hos-difficulty-option", { hasText: "Médio" }));
  await press(session, page.getByRole("button", { name: "Explorar", exact: true }));
  await page.waitForFunction(() => document.querySelector(".hos-shell")?.dataset.status === "playing");
  await settle(page);
  await findTarget(session, SCENE.DIFFICULTY_PRESETS.medium.targets[0]);
  await press(session, page.locator(".hos-station", { hasText: "Estante" }));
  await settle(page);
  await press(session, page.getByRole("button", { name: "Recomeçar a exploração" }));
  await settle(page);
  cam = await camera(page);
  const restarted = { status: await status(page), progress: await progress(page), centre: viewCentre(cam), list: (await listedIds(page)).length };
  check("22_RESTART", restarted.status === "playing" && restarted.progress.found === 0 && restarted.progress.total === 6 && Math.abs(restarted.centre.x - STATION.mesa.center.x) < 2, restarted);

  // 23–24 exit: no result, back to the Home
  const resultsAtExit = (await storedResults(page)).length;
  await press(session, page.getByRole("button", { name: "Voltar à jornada" }));
  await page.waitForSelector(".hj-stage", { timeout: 6000 });
  await page.waitForTimeout(400);
  check("23_EXIT_SAVES_NOTHING", (await storedResults(page)).length === resultsAtExit && !(await page.locator(".hos-shell").count()));
  check("24_BACK_HOME", (await page.locator(".hj-gallery-pip").count()) === 5);
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  check("NO_RETIRED_GAME_REQUESTED", !session.requests.some((url) => /number-trail|NumberTrail|world-trail|dioramas\/trail/.test(url)), {
    offending: session.requests.filter((url) => /number-trail|NumberTrail|world-trail|dioramas\/trail/.test(url)),
  });
  await session.context.close();
}

// --- scenario: mobile ------------------------------------------------------------------------------------

async function mobile() {
  current = "mobile";
  const session = await openSession({ width: 390, height: 844, touch: true });
  const { page } = session;
  const overflows = [];
  const noteOverflow = async (step) => overflows.push({ step, px: await overflow(page) });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await noteOverflow("home");
  const entry = await enterStudio(session);
  metrics.mobileEntryToReadyMs = entry.readyAfterMs;
  await startExploring(session, "Fácil");
  await noteOverflow("playing");
  check("25_OPENS_ON_A_PHONE", (await status(page)) === "playing", entry);
  await witness(page, "11-mobile-playing");

  // 26 one-finger drag: the camera moves, nothing is found
  let cam = await camera(page);
  const centre = { x: cam.left + cam.width / 2, y: cam.top + cam.height / 2 };
  const before = viewCentre(cam);
  const commits = await page.evaluate(() => window.__probe.commits);
  await drag(session, centre, { x: centre.x + 150, y: centre.y + 20 }, 16);
  await settle(page);
  cam = await camera(page);
  const afterDrag = viewCentre(cam);
  const dragCommits = (await page.evaluate(() => window.__probe.commits)) - commits;
  metrics.mobileDrag = { touchMoves: 16, reactCommitsDuringDrag: dragCommits };
  check("26_TOUCH_DRAG_PANS", before.x - afterDrag.x > 200 && (await progress(page)).found === 0, { before, afterDrag, dragCommits });

  // 27 two-finger pinch: zoom in around the fingers, nothing is found
  const scaleBefore = cam.s;
  await pinch(session, centre, 80, 220);
  await settle(page);
  cam = await camera(page);
  check("27_PINCH_ZOOMS", cam.s > scaleBefore * 1.6 && (await progress(page)).found === 0, { scale: [scaleBefore, cam.s] });
  await witness(page, "12-mobile-pinch");
  await press(session, page.getByRole("button", { name: "Recentrar" }));
  await settle(page);

  // 28 a tap on a target
  const tapped = await findTarget(session, "lupa");
  check("28_TOUCH_TAP_FINDS", tapped.after === 1, tapped);

  // 29 the tray: below the scene, chips in a row, nothing essential behind hover
  const tray = await page.evaluate(() => {
    const panel = document.querySelector(".hos-panel").getBoundingClientRect();
    const scene = document.querySelector(".hos-viewport").getBoundingClientRect();
    const items = [...document.querySelectorAll(".hos-item")].map((n) => n.getBoundingClientRect());
    return {
      panelTop: panel.top,
      sceneBottom: scene.bottom,
      sceneHeightShare: scene.height / window.innerHeight,
      oneRow: new Set(items.map((r) => Math.round(r.top))).size === 1,
      minTarget: Math.min(...[...document.querySelectorAll(".hos-panel button, .hos-zoom button, .hos-topbar button")].map((b) => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height))),
    };
  });
  metrics.mobileTray = tray;
  check("29_TRAY", tray.panelTop >= tray.sceneBottom - 1 && tray.oneRow && tray.sceneHeightShare > 0.55 && tray.minTarget >= 44, tray);

  // 30 hint
  await press(session, page.locator(".hos-hint-button"));
  await settle(page);
  const banner = await page.evaluate(() => document.querySelector(".hos-hint-banner")?.textContent ?? "");
  check("30_HINT_ON_A_PHONE", /^Pista: procure/.test(banner), { banner });
  await witness(page, "13-mobile-hint", 300);

  // 31 completion
  for (const id of easyIds) {
    if (!(await page.locator(`.hos-found[data-target="${id}"]`).count())) await findTarget(session, id);
  }
  await noteOverflow("found all");
  await page.waitForSelector(".hos-overlay-complete", { state: "visible", timeout: 4000 });
  await witness(page, "14-mobile-completion", 600);
  await press(session, page.getByRole("button", { name: "Concluir exploração" }));
  await page.waitForSelector(".prm-card", { timeout: 6000 });
  const saved = (await storedResults(page))[0];
  check("31_COMPLETES_ON_A_PHONE", saved?.gameId === "hidden-objects" && saved.score === 5, { saved });
  await noteOverflow("result");
  check("32_NO_HORIZONTAL_PAGE_OVERFLOW", overflows.every((o) => o.px <= 0), { overflows });
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: a small phone -----------------------------------------------------------------------------

async function small() {
  current = "small";
  const session = await openSession({ width: 360, height: 640, touch: true });
  const { page } = session;
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await enterStudio(session);
  await press(session, page.locator(".pgi-cta"));
  await page.waitForSelector(".hos-setup", { state: "visible" });
  const explore = await page.getByRole("button", { name: "Explorar", exact: true }).boundingBox();
  check("SMALL_SETUP_REACHABLE", explore && explore.y + explore.height <= 640, { explore });
  await press(session, page.getByRole("button", { name: "Explorar", exact: true }));
  await page.waitForFunction(() => document.querySelector(".hos-shell")?.dataset.status === "playing");
  await settle(page);
  const layout = await page.evaluate(() => ({
    sceneShare: document.querySelector(".hos-viewport").getBoundingClientRect().height / window.innerHeight,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  const found = await findTarget(session, "barco");
  await witness(page, "15-small-phone");
  check("SMALL_SCENE_KEEPS_ITS_SPACE", layout.sceneShare > 0.45 && layout.overflow <= 0, layout);
  check("SMALL_FIND", found.after === 1, found);
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: reduced motion -----------------------------------------------------------------------------

async function reducedMotion() {
  current = "reduced-motion";
  const session = await openSession({ width: 1440, height: 900, reducedMotion: "reduce" });
  const { page } = session;
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await enterStudio(session);
  await startExploring(session, "Fácil");
  await page.evaluate(() => {
    window.__probe.movingMarks = 0;
    const world = document.querySelector(".hos-world");
    new MutationObserver(() => {
      if (world.dataset.moving === "true") window.__probe.movingMarks += 1;
    }).observe(world, { attributes: true, attributeFilter: ["data-moving"] });
  });
  await press(session, page.locator(".hos-station", { hasText: "Estante" }));
  await frames(page, 2);
  const cut = await camera(page);
  const halfW = cut.width / (2 * cut.s);
  const expectedX = Math.min(Math.max(STATION.estante.center.x, halfW), SCENE.SCENE_WIDTH - halfW);
  const movingMarks = await page.evaluate(() => window.__probe.movingMarks);
  check("RM_STATION_CUTS_INSTANTLY", Math.abs(viewCentre(cut).x - expectedX) < 1 && movingMarks === 0, {
    centre: viewCentre(cut),
    expectedX,
    movingMarks,
  });
  await press(session, page.locator(".hos-hint-button"));
  await press(session, page.locator(".hos-hint-button"));
  await page.waitForTimeout(100);
  const halo = await page.evaluate(() => {
    const element = document.querySelector(".hos-halo");
    return element ? { animation: getComputedStyle(element).animationName, timing: getComputedStyle(element).animationTimingFunction } : null;
  });
  check("RM_HALO_WITHOUT_FADES", halo?.animation === "hos-halo-life-still" && /steps/.test(halo.timing), { halo });
  const parallax = await page.evaluate(() => document.querySelector(".hos-layer-back")?.style.transform);
  check("RM_NO_PARALLAX", /translate3d\(0px, 0px, 0px\)/.test(parallax ?? ""), { parallax });
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: an old Trilha result on the device ----------------------------------------------------------

/** An old Trilha result exactly as NumberTrailGame wrote it before its retirement (f9254429). */
const LEGACY_RESULT = {
  id: "number-trail-1759600000000",
  activityId: "number-trail",
  activityTitle: "Trilha Lógica",
  gameId: "number-trail",
  score: 340,
  playedAt: "2026-10-04T18:00:00.000Z",
  summary: "Você iluminou 2 trilhas completas na Trilha Lógica.",
  details: { level: 3, currentNumber: 12, errors: 0, roundsCompleted: 2, correctNumbers: 12, maxErrors: 3 },
};

async function legacy() {
  current = "legacy";
  const session = await openSession({
    width: 1440,
    height: 900,
    init: {
      fn: ([key, entry]) => {
        if (window.sessionStorage.getItem("probe-seeded")) return;
        window.sessionStorage.setItem("probe-seeded", "1");
        window.localStorage.setItem(key, JSON.stringify([entry]));
      },
      arg: [STORAGE_KEY, LEGACY_RESULT],
    },
  });
  const { page } = session;
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const home = await page.evaluate(() => ({
    selected: document.querySelector(".hj-world-selected .hj-world-copy strong")?.textContent ?? null,
    worlds: [...document.querySelectorAll(".hj-world-copy strong")].map((n) => n.textContent),
    stage: Boolean(document.querySelector(".hj-stage")),
  }));
  check("33_LEGACY_RESULT_IS_READ_SAFELY", home.stage && home.worlds.length === 5 && !home.worlds.includes("Trilha Lógica"), home);
  check("34_NO_CRASH", session.errors.length === 0, { errors: session.errors });
  check("35_NOT_SHOWN_AS_THE_STUDIO", home.selected !== "Estúdio das Descobertas" && (await page.locator(".hos-shell").count()) === 0, home);
  await witness(page, "16-legacy-home");

  // A full Estúdio session next to it: the old entry stays exactly as it was.
  await enterStudio(session);
  await startExploring(session, "Fácil");
  for (const id of easyIds) await findTarget(session, id);
  await page.waitForSelector(".hos-overlay-complete", { state: "visible", timeout: 4000 });
  await press(session, page.getByRole("button", { name: "Concluir exploração" }));
  await page.waitForSelector(".prm-card", { timeout: 6000 });
  const stored = await storedResults(page);
  check("35_OLD_RESULT_KEPT_NOT_CONVERTED", stored.length === 2 && stored[0].gameId === "hidden-objects" && JSON.stringify(stored[1]) === JSON.stringify(LEGACY_RESULT), {
    stored: stored.map((r) => ({ gameId: r.gameId, score: r.score })),
  });
  await press(session, page.getByRole("button", { name: "Continuar na jornada cognitiva" }));
  await page.waitForSelector(".hj-stage", { timeout: 6000 });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const reloaded = await page.evaluate(() => document.querySelector(".hj-world-selected .hj-world-copy strong")?.textContent ?? null);
  check("35_RELOAD_FOLLOWS_THE_NEWEST_PLAYABLE_RESULT", reloaded === "Estúdio das Descobertas", { selected: reloaded });
  check("NO_RETIRED_GAME_REQUESTED", !session.requests.some((url) => /number-trail|NumberTrail/.test(url)));
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: bundle ----------------------------------------------------------------------------------------

function bundle() {
  current = "bundle";
  const read = (rel) => {
    const file = path.join(BUILD, rel.replace(/^\/?_next\//, ""));
    return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  };
  const html = fs.readFileSync(path.join(BUILD, "server/app/index.html"), "utf8");
  const homeJs = [...new Set([...html.matchAll(/src="\/_next\/(static\/chunks\/[^"]+\.js)"/g)].map((m) => m[1]))];
  const homeCss = [...new Set([...html.matchAll(/href="\/_next\/(static\/chunks\/[^"]+\.css)"/g)].map((m) => m[1]))];
  const lazySets = (list) =>
    list.flatMap((f) => [...read(f).matchAll(/Promise\.all\(\[([^\]]*)\]\.map\(/g)].map((m) => [...m[1].matchAll(/"(static\/chunks\/[^"]+\.(?:js|css))"/g)].map((x) => x[1])));
  const reach = (needle) => {
    const seen = new Set(homeJs);
    const queue = [homeJs];
    while (queue.length) {
      for (const set of lazySets(queue.shift())) {
        if (set.some((f) => read(f).includes(needle))) return set;
        const fresh = set.filter((f) => !seen.has(f));
        fresh.forEach((f) => seen.add(f));
        if (fresh.length) queue.push(fresh);
      }
    }
    return [];
  };
  const size = (list) => ({
    files: list.length,
    raw: list.reduce((n, f) => n + Buffer.byteLength(read(f)), 0),
    gzip: list.reduce((n, f) => n + zlib.gzipSync(read(f), { level: 9 }).length, 0),
  });
  const js = (list) => list.filter((f) => f.endsWith(".js"));
  const css = (list) => list.filter((f) => f.endsWith(".css"));
  const NEEDLES = {
    studio: "Continuar olhando",
    route: "observe a rota e colete as luzes",
    circuit: "Desligar sons suaves",
    babylon: "Babylon.js v",
  };
  const sets = Object.fromEntries(Object.entries(NEEDLES).map(([name, needle]) => [name, reach(needle)]));
  const holds = (list, needle) => list.some((f) => read(f).includes(needle));
  metrics.bundle = {
    homeInitial: { js: size(homeJs), css: size(homeCss) },
    studio: { js: size(js(sets.studio)), css: size(css(sets.studio)), files: sets.studio },
    route: { js: size(js(sets.route)), css: size(css(sets.route)) },
    circuit: { js: size(js(sets.circuit)), css: size(css(sets.circuit)) },
    babylon: { js: size(js(sets.babylon)) },
  };
  check("BUNDLE_HOME_HAS_NO_STUDIO_CODE", !holds(homeJs, NEEDLES.studio) && !holds(homeJs, "hos-shell"), metrics.bundle.homeInitial);
  check("BUNDLE_STUDIO_IS_ITS_OWN_LAZY_SET", sets.studio.length > 0 && !homeJs.some((f) => sets.studio.includes(f)), { files: sets.studio });
  check(
    "BUNDLE_STUDIO_SET_HAS_NO_BABYLON_ROUTE_OR_CIRCUIT",
    !holds(sets.studio, NEEDLES.babylon) && !holds(sets.studio, NEEDLES.route) && !holds(sets.studio, NEEDLES.circuit) && !holds(sets.studio, "@babylonjs"),
  );
  check("BUNDLE_ROUTE_CIRCUIT_BABYLON_FREE_OF_THE_STUDIO", ![sets.route, sets.circuit, sets.babylon].some((set) => holds(set, NEEDLES.studio)));
  check("BUNDLE_BABYLON_STILL_LAZY", !holds(homeJs, NEEDLES.babylon) && sets.babylon.length > 0);
  check("BUNDLE_NO_RETIRED_GAME_CHUNK", ![...homeJs, ...lazySets(homeJs).flat()].some((f) => /Procure com calma: não há cronômetro/.test(read(f))));
}

// --- run --------------------------------------------------------------------------------------------------------

const runners = { desktop, mobile, small, "reduced-motion": reducedMotion, legacy, bundle };
for (const name of SCENARIOS) {
  try {
    await runners[name]();
  } catch (error) {
    current = name;
    check("SCENARIO_RAN_TO_THE_END", false, { error: String(error?.stack ?? error).split("\n").slice(0, 6).join(" | ") });
  }
}
await browser.close();

const failed = results.filter((r) => !r.pass);
console.log("\nmetrics:");
console.log(JSON.stringify(metrics, null, 1));
if (JSON_OUT) fs.writeFileSync(JSON_OUT, `${JSON.stringify({ base: BASE, buildId: BUILD_ID, scenarios: SCENARIOS, results, metrics }, null, 2)}\n`);
console.log(`\n${results.length - failed.length}/${results.length} checks held · failing: ${failed.map((r) => `${r.scenario}:${r.id}`).join(", ") || "none"}`);
console.log(failed.length ? "HIDDEN_OBJECTS_BROWSER_PROBE_FAILED" : "HIDDEN_OBJECTS_BROWSER_PROBE_OK");
process.exit(failed.length ? EXIT_FAILED : EXIT_OK);
