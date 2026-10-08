/**
 * GAME03-SKELETON-01 / GAME03-EXPERIENCE-02 — browser probe for the Estúdio das Descobertas.
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
 *   desktop        1440×900, mouse: Home slot → entry → intro → setup → Fácil → pan → wheel/±
 *                  zoom → Mesa → free tap → find → drag over a target → Fácil's whole ladder
 *                  (station, pool, "Mostrar onde está") → find all → result (one, the new
 *                  presentation) → play again → Médio: silhouettes, a ladder that never points
 *                  (station, wide pool, direction) → finds → restart → exit → Home
 *   hard           1440×900, mouse: Difícil — the list is the clues; station → context → the
 *                  top, never a halo or a glide to the object; a find says the name (list, tag,
 *                  live region); pan, zoom, stations; the objectives fold; all eight → result
 *   mobile         390×844, touch (CDP touch events), Difícil: entry → drag → pinch → tray (two
 *                  rows, readable clues) → hint → tap → fold/unfold → find all → result; never a
 *                  horizontal page overflow
 *   small          360×640, touch: setup reachable, scene area kept, one find, no overflow
 *   reduced-motion 1440×900 with prefers-reduced-motion: station cuts instantly, halos, the
 *                  found ring and tag on/off without fades, no parallax
 *   legacy         a stored `number-trail` result: Home loads, nothing breaks, nothing opens the
 *                  retired game, nothing converts the old result; after a reload (read once the Home
 *                  has hydrated) the newest playable result is selected
 *   landscape      844×390, touch, Médio: entry → drag → pinch → hint → finds → the phone turned
 *                  upright mid-round (the round holds) → back → find all → result; no page overflow
 *   rounds         nine planted seeds (three per difficulty), each a new entry from the Home: the list on
 *                  screen is exactly the one its seed draws, spread over the three stations, all different
 *   reload-race    the Home/reload anomaly, reproduced and explained: the server HTML selects the default
 *                  world; a read at networkidle + 400 ms (the base probe's) under CPU throttling lands
 *                  before hydration and sees that default; the hydrated Home always selects the newest
 *                  playable result
 *   bundle         the build directory: Game 03 code only in its own lazy set; Babylon, the
 *                  Rota and the Circuito sets free of it; sizes
 *
 * Rounds (GAME03-EXPERIENCE-02's target pool): every scenario plants its own seeds in the platform's
 * random source (`crypto.getRandomValues`, the game's only randomness, drawn on "Explorar"), reads the
 * round the shell reports (`data-round-seed`, the list's `data-target`s) and holds it to the list that
 * seed draws (hidden-objects-rounds.ts, read from source). Nothing in the product is a test hook.
 *
 * Playtest measurements (metrics.playtest — diagnostics of THIS automated run, never a
 * score, nothing reaches the product): how many listed objects are fully on screen before
 * any pan, the zoom each needs on the phone to reach 44 px, the hint presses the run used,
 * and the technical time from "Explorar" to the closing card.
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
import { createModuleGraph } from "./route-module-loader.mjs";

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
const ALL = ["desktop", "hard", "mobile", "landscape", "small", "reduced-motion", "legacy", "rounds", "reload-race", "bundle"];
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

// --- rounds: the selection itself, from source; the seeds each scenario plants ---------------------------

const ROUNDS = createModuleGraph({ mocks: {}, globals: {} }).require("src/games/hidden-objects/hidden-objects-rounds.ts");
/** The list a difficulty and seed draw, in the order shown. */
const drawn = (difficulty, seed) => ROUNDS.selectRoundTargets(difficulty, seed);
/** Each scenario's seeds, one per "Explorar", in order. */
const SEEDS = {
  desktop: [101, 202, 303], // Fácil · Médio after "Praticar outra vez" · Fácil again, a new entry from the Home
  hard: [404],
  mobile: [505],
  landscape: [606],
  small: [707],
  "reduced-motion": [808],
  legacy: [909],
  rounds: [1001, 1002, 1003, 2001, 2002, 2003, 3001, 3002, 3003],
};
const ROUND_PLAN = ["easy", "easy", "easy", "medium", "medium", "medium", "hard", "hard", "hard"];
// the plan itself must ask for what it claims: a new entry's Fácil differs from the first one
if (JSON.stringify([...drawn("easy", SEEDS.desktop[0])].sort()) === JSON.stringify([...drawn("easy", SEEDS.desktop[2])].sort())) {
  console.error("seed plan: the desktop's two Fácil seeds draw the same list — pick another");
  process.exit(EXIT_USAGE);
}

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
  // homeCommits: the world the Home selects as each React commit lands (only while the Home is on screen)
  window.__probe = { commits: 0, longTasks: [], transformWrites: 0, homeCommits: [] };
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
      const selected = document.querySelector(".hj-world-selected .hj-world-copy strong")?.textContent;
      if (selected !== undefined && window.__probe.homeCommits.length < 50) window.__probe.homeCommits.push({ commit: window.__probe.commits, selected });
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

/**
 * The platform's random source, made deterministic for one context: each 32-bit draw takes the next
 * planted seed (then a fixed generator). Every draw is recorded, so a stray consumer would show as a
 * seed the round does not report.
 */
function plantSeeds(seeds) {
  const queue = [...seeds];
  let state = 0x2545f491;
  const draws = [];
  const native = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = (array) => {
    if (!(array instanceof Uint32Array)) return native(array);
    for (let i = 0; i < array.length; i += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      array[i] = queue.length ? queue.shift() >>> 0 : state;
      draws.push(array[i]);
    }
    return array;
  };
  Object.defineProperty(window, "__probeDraws", { configurable: true, get: () => draws.slice() });
}

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--use-gl=angle", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
});

async function openSession({ width, height, touch = false, reducedMotion = "no-preference", seeds = [], storage = null }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    hasTouch: touch,
    isMobile: touch,
    reducedMotion,
    // `storage`: results already on the device before the first load (no script writes them)
    ...(storage ? { storageState: { cookies: [], origins: [{ origin: BASE, localStorage: [{ name: STORAGE_KEY, value: JSON.stringify(storage) }] }] } } : {}),
  });
  await context.addInitScript(installObservers);
  await context.addInitScript(plantSeeds, seeds);
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

/** Intro → setup → a level → "Explorar". Returns the round the shell reports. */
async function startExploring(session, level = "Fácil") {
  const { page } = session;
  await press(session, page.locator(".pgi-cta"));
  await page.waitForSelector(".hos-setup", { state: "visible" });
  await press(session, page.locator(".hos-difficulty-option", { hasText: level }));
  await press(session, page.getByRole("button", { name: "Explorar", exact: true }));
  await page.waitForFunction(() => document.querySelector(".hos-shell")?.dataset.status === "playing");
  await settle(page);
  return roundOnScreen(page);
}

/** The round on screen: the seed the shell reports and the list, in the order shown. */
async function roundOnScreen(page) {
  const round = await page.evaluate(() => ({
    seed: document.querySelector(".hos-shell")?.dataset.roundSeed ?? null,
    ids: [...document.querySelectorAll(".hos-item")].map((item) => item.dataset.target ?? null),
    draws: window.__probeDraws?.length ?? null,
  }));
  return { seed: round.seed === null ? null : Number(round.seed), ids: round.ids, draws: round.draws };
}

/** Whether a round is the one its planted seed draws for `difficulty`. */
const isDrawn = (round, difficulty, seed) => round.seed === seed && same(round.ids, drawn(difficulty, seed));

/**
 * The page has hydrated and settled: React has committed at least once (the DevTools-hook stand-in counts
 * every commit, in production too) and then not again for `quietMs`. It does not wait for any particular
 * answer — whatever the hydrated page shows is what gets read.
 */
async function hydrated(page, quietMs = 800) {
  await page.waitForFunction(() => (window.__probe?.commits ?? 0) >= 1, null, { timeout: 60000, polling: 50 });
  let last = -1;
  let since = Date.now();
  for (;;) {
    const now = await page.evaluate(() => window.__probe.commits);
    if (now !== last) {
      last = now;
      since = Date.now();
    } else if (Date.now() - since >= quietMs) {
      return last;
    }
    await page.waitForTimeout(50);
  }
}

/** What the Home selects right now, how many commits React has made, and what the device has stored. */
async function homeSnapshot(page) {
  return page.evaluate((key) => ({
    selected: document.querySelector(".hj-world-selected .hj-world-copy strong")?.textContent ?? null,
    commits: window.__probe?.commits ?? null,
    stored: JSON.parse(window.localStorage.getItem(key) ?? "[]").map((r) => r.gameId),
    commitLog: window.__probe?.homeCommits?.slice(0, 6) ?? [],
  }), STORAGE_KEY);
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sorted = (list) => [...list].sort();
const norm = (text) => (text ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** How many of a list's objects each station holds. */
const spreadOf = (ids) => Object.fromEntries(SCENE.SCENE_STATIONS.map((s) => [s.id, ids.filter((id) => TARGET[id].station === s.id).length]));
/** Every station holds ⌊k/3⌋ or ⌈k/3⌉ of the list: the round crosses the whole room. */
const evenlySpread = (ids) =>
  Object.values(spreadOf(ids)).every((n) => n >= Math.floor(ids.length / SCENE.SCENE_STATIONS.length) && n <= Math.ceil(ids.length / SCENE.SCENE_STATIONS.length));

/** The sideways drag with room to move: towards the middle of the room (at a station by a wall the camera rests against it). */
const towardsTheMiddle = (cam) => (viewCentre(cam).x < SCENE.SCENE_WIDTH / 2 ? -1 : 1);

/**
 * The tab hidden and shown again, the way a person does it: another tab comes to the front, then this one.
 * Where the headless browser keeps both tabs "visible", the page is told so itself (visibilityState and the
 * event), which is what a hidden tab would see.
 */
async function hideAndShow(session) {
  const { page, context } = session;
  await page.evaluate(() => {
    window.__probe.visibility = [];
    document.addEventListener("visibilitychange", () => window.__probe.visibility.push(document.visibilityState));
  });
  const other = await context.newPage();
  await other.bringToFront();
  await page.waitForTimeout(200);
  await other.close();
  await page.bringToFront();
  await page.waitForTimeout(200);
  let seen = await page.evaluate(() => window.__probe.visibility.slice());
  let method = "another tab in front";
  if (!seen.includes("hidden")) {
    method = "visibilityState and visibilitychange on the page";
    await page.evaluate(async () => {
      const set = (hidden) => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => (hidden ? "hidden" : "visible") });
        Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
        document.dispatchEvent(new Event("visibilitychange"));
      };
      set(true);
      await new Promise((resolve) => setTimeout(resolve, 300));
      set(false);
      delete document.visibilityState;
      delete document.hidden;
    });
    seen = await page.evaluate(() => window.__probe.visibility.slice());
  }
  return { method, seen };
}

/** What the hint UI shows right now (banner, light, button, camera). */
async function hintState(page) {
  return page.evaluate(() => ({
    banner: document.querySelector(".hos-hint-banner")?.textContent ?? "",
    halo: document.querySelector(".hos-halo")?.className ?? null,
    button: document.querySelector(".hos-hint-button span")?.childNodes[0]?.textContent ?? "",
    hinted: document.querySelector('.hos-station[data-hinted="true"]')?.textContent ?? null,
  }));
}

/** The list as the Explorador reads it: the item's line, its accessible name, whether it shows art. */
async function listEntries(page) {
  return page.evaluate(() =>
    [...document.querySelectorAll(".hos-item")].map((item) => ({
      text: item.querySelector(".hos-item-label")?.childNodes[0]?.textContent ?? "",
      aria: item.getAttribute("aria-label"),
      art: item.querySelector(".hos-item-art")?.dataset.style ?? null,
      found: item.dataset.found === "true",
    })),
  );
}

/** Playtest diagnostics: how many of `ids` are fully on screen right now (no pan yet). */
async function onScreenCount(page, ids) {
  const cam = await camera(page);
  const inside = ids.filter((id) => {
    const r = TARGET[id].region;
    const box = r.kind === "rect" ? r : { x: r.cx - r.r, y: r.cy - r.r, w: 2 * r.r, h: 2 * r.r };
    const a = toScreen(cam, { x: box.x, y: box.y });
    const z = toScreen(cam, { x: box.x + box.w, y: box.y + box.h });
    return a.x >= cam.left && a.y >= cam.top && z.x <= cam.left + cam.width && z.y <= cam.top + cam.height;
  });
  return { visibleWithoutPan: inside.length, of: ids.length, ids: inside };
}

/** The result screen as shown (score caption, listed details). */
async function resultScreen(page) {
  return page.evaluate(() => ({
    world: document.querySelector(".prm-world")?.textContent,
    title: document.querySelector(".prm-title")?.textContent,
    summary: document.querySelector("#reward-summary")?.textContent,
    scoreLabel: document.querySelector(".prm-score-card p")?.textContent,
    score: document.querySelector(".prm-score-card strong")?.textContent,
    details: Object.fromEntries([...document.querySelectorAll(".prm-detail")].map((d) => [d.querySelector("dt")?.textContent, d.querySelector("dd")?.textContent])),
  }));
}

metrics.playtest = { hintPresses: {}, technicalMsToClosingCard: {}, visibleWithoutPan: {} };
/** The round each scenario saw on screen (seed, list in order, draws so far). */
metrics.roundsOnScreen = {};

// --- scenario: desktop ---------------------------------------------------------------------------------

async function desktop() {
  current = "desktop";
  const session = await openSession({ width: 1440, height: 900, seeds: SEEDS.desktop });
  const { page } = session;
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await hydrated(page);

  // 1–2 Home and the slot
  const pips = await page.locator(".hj-gallery-pip").evaluateAll((nodes) => nodes.map((n) => n.getAttribute("aria-label")));
  check("01_HOME_LOADS", pips.length === 5, { pips });
  check("02_STUDIO_IN_THE_TRAILS_SLOT", pips[3] === "Selecionar Estúdio das Descobertas" && !pips.some((p) => /Trilha/.test(p)), { order: pips });
  await witness(page, "e00-home");

  // 3–6 entry, transition, intro, readiness
  const entry = await enterStudio(session, { onSelected: () => witness(page, "e01-home-selected", 700) });
  metrics.entryToReadyMs = entry.readyAfterMs;
  check("03_04_OPENS_THROUGH_THE_TRANSITION", entry.transitionWorld === "Estúdio das Descobertas", entry);
  const intro = await page.evaluate(() => ({
    title: document.querySelector(".pgi-plaque-text")?.textContent,
    steps: document.querySelectorAll(".pgi-steps li").length,
  }));
  check("05_INTRO", intro.title === "Estúdio das Descobertas" && intro.steps === 3, intro);
  check("06_READY_REPORTED_NOT_TIMED_OUT", entry.phase === "revealing" || entry.phase === "gone", { phase: entry.phase, readyAfterMs: entry.readyAfterMs });
  await witness(page, "e01b-intro");

  // 7–9 setup
  await press(session, page.locator(".pgi-cta"));
  await page.waitForSelector(".hos-setup", { state: "visible" });
  const setup = await page.evaluate(() => ({
    title: document.querySelector(".hos-setup h2")?.textContent,
    levels: [...document.querySelectorAll(".hos-difficulty-option strong")].map((n) => n.textContent),
    status: document.querySelector(".hos-shell")?.dataset.status,
  }));
  check("07_SETUP", setup.title === "Estúdio das Descobertas" && setup.levels.join("|") === "Fácil|Médio|Difícil" && setup.status === "setup", setup);
  await witness(page, "e01c-setup");
  await press(session, page.locator(".hos-difficulty-option", { hasText: "Fácil" }));
  check("08_CHOOSE_EASY", await page.locator('.hos-difficulty-option input[value="easy"]').isChecked());
  const drawsBeforeExplorar = await page.evaluate(() => window.__probeDraws.length);
  await press(session, page.getByRole("button", { name: "Explorar", exact: true }));
  await page.waitForFunction(() => document.querySelector(".hos-shell")?.dataset.status === "playing");
  await settle(page);
  const easy = await roundOnScreen(page);
  const easyIds = easy.ids;
  check("09_EXPLORE_STARTS_PLAYING", (await status(page)) === "playing" && easyIds.length === 5 && (await progress(page)).found === 0, { list: easyIds });
  // GAME03-EXPERIENCE-02 rounds: "Explorar" draws once, and the list on screen is exactly what that seed draws
  check(
    "X05_EXPLORAR_DRAWS_THE_ROUND_ONCE",
    drawsBeforeExplorar === 0 && easy.draws === 1 && isDrawn(easy, "easy", SEEDS.desktop[0]) && evenlySpread(easyIds),
    { drawsBeforeExplorar, round: easy, drawn: drawn("easy", SEEDS.desktop[0]), spread: spreadOf(easyIds) },
  );
  metrics.roundsOnScreen["desktop easy"] = easy;
  metrics.playtest.visibleWithoutPan["desktop easy"] = await onScreenCount(page, easyIds);
  const easyEntries = await listEntries(page);
  check("X00_FACIL_LIST_IS_PICTURE_AND_NAME", same(easyEntries.map((e) => e.text), easyIds.map((id) => TARGET[id].label)) && easyEntries.every((e) => e.art === "picture"), { easyEntries });
  const easyStarted = Date.now();
  await witness(page, "e02-easy-playing");

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
  await witness(page, "e09-zoom-table");

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

  // 14 select a target (the round's first line)
  const [firstId, secondId] = easyIds;
  const first = await findTarget(session, firstId);
  const seal = await page.locator(`.hos-found[data-target="${firstId}"] .hos-found-seal`).count();
  const listed = await page.locator(`.hos-item[data-target="${firstId}"]`).getAttribute("data-found");
  const announced = await page.evaluate(() => document.querySelector('.hos-sr-only[aria-live]')?.textContent ?? "");
  check("14_TAP_FINDS_THE_TARGET", first.after === 1 && seal === 1 && listed === "true" && announced.includes(`Encontrou: ${TARGET[firstId].label}`), { ...first, announced });

  // 15 a drag that starts on a target finds nothing (sideways, towards the room's middle: there is always room)
  const onTarget = await bringIntoView(session, secondId);
  const camBefore = await camera(page);
  await drag(session, onTarget.point, { x: onTarget.point.x + 120 * towardsTheMiddle(camBefore), y: onTarget.point.y - 30 });
  await settle(page);
  const camAfter = await camera(page);
  check("15_DRAG_FROM_A_TARGET_DOES_NOT_SELECT", (await progress(page)).found === 1 && Math.abs(camAfter.tx - camBefore.tx) > 60, {
    target: secondId,
    found: (await progress(page)).found,
    moved: camAfter.tx - camBefore.tx,
  });

  // 16–18 hints for the next pending object (by list order: the first line is found)
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
  await press(session, page.locator(".hos-hint-button"));
  await settle(page);
  metrics.playtest.hintPresses["desktop easy"] = 3;
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
  await witness(page, "e10-hint-easy-final", 600);
  await tapAt(session, toScreen(cam, subjectCentre));
  await page.waitForTimeout(150);
  check("18_REVEALED_OBJECT_IS_TAPPED_BY_THE_EXPLORADOR", (await progress(page)).found === 2);

  // X30 the round holds through everything a session does: the pan, zooms, stations and hints above, then a
  // resize, reduced motion switched on and off, the tab hidden and shown, the list folded and unfolded —
  // the same list in the same order, the same seed, still one draw, nothing found lost
  const heldBefore = await progress(page);
  await page.setViewportSize({ width: 1180, height: 820 });
  await settle(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await settle(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await frames(page, 4);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await frames(page, 4);
  const visibility = await hideAndShow(session);
  await press(session, page.locator(".hos-tray-toggle"));
  await settle(page);
  await press(session, page.locator(".hos-tray-toggle"));
  await settle(page);
  const held = await roundOnScreen(page);
  const heldAfter = await progress(page);
  check(
    "X30_THE_ROUND_HOLDS_THROUGH_THE_SESSION",
    same(held, easy) && heldAfter.found === heldBefore.found && heldAfter.total === 5 && visibility.seen.includes("hidden"),
    { before: easy, after: held, progress: [heldBefore, heldAfter], visibility },
  );

  // 19 everything else
  const rest = [];
  for (const id of easyIds) {
    const found = await page.locator(`.hos-found[data-target="${id}"]`).count();
    if (!found) rest.push(await findTarget(session, id));
  }
  check("19_FIND_ALL", (await progress(page)).found === 5 && (await status(page)) === "completed", { rest });

  // 20 the closing card and exactly one result
  await page.waitForSelector(".hos-overlay-complete", { state: "visible", timeout: 4000 });
  metrics.playtest.technicalMsToClosingCard["desktop easy"] = Date.now() - easyStarted;
  await witness(page, "e11-completion", 600);
  const resultsBefore = (await storedResults(page)).length;
  await page.evaluate(() => {
    const button = [...document.querySelectorAll(".hos-overlay-complete button")].find((b) => b.textContent === "Concluir exploração");
    button.click();
    button.click();
  });
  await page.waitForSelector(".prm-card", { timeout: 6000 });
  const modal = await resultScreen(page);
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
      JSON.stringify(saved.details) ===
        JSON.stringify({ difficulty: "easy", foundObjects: 5, totalObjects: 5, completed: true, sceneId: "explorer-studio", roundSeed: SEEDS.desktop[0] }) &&
      saved.continuation === undefined,
    { saved },
  );
  // GAME03-EXPERIENCE-02: the score says what it counts, the mode is named as the game names it, nothing technical
  check("X04_RESULT_PRESENTATION", modal.scoreLabel === "Objetos encontrados" && modal.score === "5" && same(modal.details, { Modo: "Fácil" }), modal);
  metrics.resultDetailsShown = modal.details;
  await witness(page, "e12-result", 500);

  // 21 play again: a fresh session through the shell (intro, setup, nothing found)
  await press(session, page.getByRole("button", { name: "Praticar este desafio outra vez" }));
  await page.waitForFunction(() => !document.querySelector(".wtx-shell"), null, { timeout: 20000 });
  await page.waitForSelector(".pgi-cta", { state: "visible" });
  await press(session, page.locator(".pgi-cta"));
  await page.waitForSelector(".hos-setup", { state: "visible" });
  check("21_PLAY_AGAIN_IS_FRESH", (await status(page)) === "setup" && (await progress(page)).found === 0);

  // X01–X03 Médio: silhouettes + names, and a ladder that never points at the object
  await press(session, page.locator(".hos-difficulty-option", { hasText: "Médio" }));
  await press(session, page.getByRole("button", { name: "Explorar", exact: true }));
  await page.waitForFunction(() => document.querySelector(".hos-shell")?.dataset.status === "playing");
  await settle(page);
  const medium = await roundOnScreen(page);
  const mediumIds = medium.ids;
  check("X06_PLAYING_AGAIN_DRAWS_A_NEW_ROUND", isDrawn(medium, "medium", SEEDS.desktop[1]) && medium.draws === 2 && evenlySpread(mediumIds), {
    round: medium,
    drawn: drawn("medium", SEEDS.desktop[1]),
    spread: spreadOf(mediumIds),
  });
  metrics.roundsOnScreen["desktop medium"] = medium;
  metrics.playtest.visibleWithoutPan["desktop medium"] = await onScreenCount(page, mediumIds);
  const mediumEntries = await listEntries(page);
  check(
    "X01_MEDIO_LIST_IS_SILHOUETTE_AND_NAME",
    same(mediumEntries.map((e) => e.text), mediumIds.map((id) => TARGET[id].label)) && mediumEntries.every((e) => e.art === "silhouette"),
    { mediumEntries },
  );
  await witness(page, "e03-medium-playing");
  const mediumSubject = TARGET[mediumIds[0]];
  const mediumLadder = [];
  let poolCamera = null;
  for (let i = 0; i < 4; i += 1) {
    await press(session, page.locator(".hos-hint-button"));
    await settle(page);
    mediumLadder.push({ ...(await hintState(page)), centre: viewCentre(await camera(page)) });
    if (i === 1) {
      poolCamera = await camera(page);
      await witness(page, "e04-medium-hint-pool", 700);
    }
  }
  metrics.playtest.hintPresses["desktop medium"] = 4;
  const neverPoints = mediumLadder.every((s) => !/hos-halo-reveal/.test(s.halo ?? "") && !/Aqui está/.test(s.banner) && !/Mostrar/.test(s.button));
  check(
    "X02_MEDIO_HINTS_NEVER_POINT",
    /^Pista: procure/.test(mediumLadder[0].banner) && mediumLadder[0].hinted === STATION[mediumSubject.station].label &&
      /hos-halo-hint/.test(mediumLadder[1].halo ?? "") &&
      mediumLadder[2].halo === null && mediumLadder[2].banner === `Pista: olhe ${mediumSubject.hintDirection}.` &&
      mediumLadder[3].button === "Rever pista" && neverPoints,
    { mediumLadder },
  );
  const directionCamera = await camera(page);
  check("X03_MEDIO_DIRECTION_LEAVES_THE_CAMERA", Math.abs(directionCamera.tx - poolCamera.tx) < 0.5 && Math.abs(directionCamera.s - poolCamera.s) < 1e-6, {
    afterPool: viewCentre(poolCamera),
    afterDirection: viewCentre(directionCamera),
  });

  // 22 restart: same difficulty, nothing found, the camera back at the table
  await findTarget(session, mediumIds[0]);
  await findTarget(session, mediumIds[1]);
  await press(session, page.locator(".hos-station", { hasText: "Estante" }));
  await settle(page);
  await press(session, page.getByRole("button", { name: "Recomeçar a exploração" }));
  await settle(page);
  cam = await camera(page);
  const restarted = { status: await status(page), progress: await progress(page), centre: viewCentre(cam), round: await roundOnScreen(page) };
  check("22_RESTART", restarted.status === "playing" && restarted.progress.found === 0 && restarted.progress.total === 6 && Math.abs(restarted.centre.x - STATION.mesa.center.x) < 2, restarted);
  // "Recomeçar" starts the same list again from the top: no new draw
  check("X07_RECOMECAR_KEEPS_THE_ROUND", same(restarted.round, medium), { before: medium, after: restarted.round });

  // 23–24 exit: no result, back to the Home
  const resultsAtExit = (await storedResults(page)).length;
  await press(session, page.getByRole("button", { name: "Voltar à jornada" }));
  await page.waitForSelector(".hj-stage", { timeout: 6000 });
  await page.waitForTimeout(400);
  check("23_EXIT_SAVES_NOTHING", (await storedResults(page)).length === resultsAtExit && !(await page.locator(".hos-shell").count()));
  check("24_BACK_HOME", (await page.locator(".hj-gallery-pip").count()) === 5);

  // X31 a new entry from the Home is a new exploration: a new seed, a new list (and leaving it saves nothing)
  await enterStudio(session);
  const again = await startExploring(session, "Fácil");
  check(
    "X31_A_NEW_ENTRY_DRAWS_A_NEW_ROUND",
    isDrawn(again, "easy", SEEDS.desktop[2]) && again.draws === 3 && !same(sorted(again.ids), sorted(easyIds)) && evenlySpread(again.ids),
    { first: easy, again, drawn: drawn("easy", SEEDS.desktop[2]) },
  );
  metrics.roundsOnScreen["desktop easy, new entry"] = again;
  await witness(page, "e02b-easy-new-entry");
  const resultsAtSecondExit = (await storedResults(page)).length;
  await press(session, page.getByRole("button", { name: "Voltar à jornada" }));
  await page.waitForSelector(".hj-stage", { timeout: 6000 });
  await page.waitForTimeout(400);
  check("X31_LEAVING_SAVES_NOTHING", (await storedResults(page)).length === resultsAtSecondExit && (await page.locator(".hj-gallery-pip").count()) === 5);
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  check("NO_RETIRED_GAME_REQUESTED", !session.requests.some((url) => /number-trail|NumberTrail|world-trail|dioramas\/trail/.test(url)), {
    offending: session.requests.filter((url) => /number-trail|NumberTrail|world-trail|dioramas\/trail/.test(url)),
  });
  await session.context.close();
}

// --- scenario: mobile ------------------------------------------------------------------------------------

async function mobile() {
  current = "mobile";
  const session = await openSession({ width: 390, height: 844, touch: true, seeds: SEEDS.mobile });
  const { page } = session;
  const overflows = [];
  const noteOverflow = async (step) => overflows.push({ step, px: await overflow(page) });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await hydrated(page);
  await noteOverflow("home");
  const entry = await enterStudio(session);
  metrics.mobileEntryToReadyMs = entry.readyAfterMs;
  const round = await startExploring(session, "Difícil");
  const hardIds = round.ids;
  const hardStarted = Date.now();
  await noteOverflow("playing");
  check("25_OPENS_ON_A_PHONE", (await status(page)) === "playing", entry);
  check("X17_THE_PHONE_ROUND_IS_ITS_SEED", isDrawn(round, "hard", SEEDS.mobile[0]) && round.draws === 1 && hardIds.length === 8 && evenlySpread(hardIds), {
    round,
    drawn: drawn("hard", SEEDS.mobile[0]),
    spread: spreadOf(hardIds),
  });
  metrics.roundsOnScreen["phone hard"] = round;
  metrics.playtest.visibleWithoutPan["phone hard"] = await onScreenCount(page, hardIds);
  await witness(page, "e13-mobile-hard");

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
  await witness(page, "e14-mobile-pinch");
  await press(session, page.getByRole("button", { name: "Recentrar" }));
  await settle(page);

  // 29 the tray: below the scene, two rows (the clues, then count · Pista · stations), readable, nothing behind hover
  const tray = await page.evaluate(() => {
    const panel = document.querySelector(".hos-panel").getBoundingClientRect();
    const scene = document.querySelector(".hos-viewport").getBoundingClientRect();
    const items = [...document.querySelectorAll(".hos-item")];
    const labels = items.map((n) => n.querySelector(".hos-item-label"));
    return {
      panelTop: panel.top,
      sceneBottom: scene.bottom,
      sceneHeightShare: scene.height / window.innerHeight,
      chipsInOneRow: new Set(items.map((n) => Math.round(n.getBoundingClientRect().top))).size === 1,
      clueFontPx: Math.min(...labels.map((l) => parseFloat(getComputedStyle(l).fontSize))),
      cluesFit: labels.every((l) => l.scrollWidth <= l.clientWidth + 1 && l.scrollHeight <= l.clientHeight + 1),
      minTarget: Math.min(...[...document.querySelectorAll(".hos-panel button, .hos-zoom button, .hos-topbar button")].map((b) => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height))),
    };
  });
  metrics.mobileTray = tray;
  check("29_TRAY", tray.panelTop >= tray.sceneBottom - 1 && tray.chipsInOneRow && tray.sceneHeightShare > 0.7 && tray.minTarget >= 44, tray);
  check("X20_CLUES_READABLE_ON_A_PHONE", tray.clueFontPx >= 13 && tray.cluesFit, { clueFontPx: tray.clueFontPx, cluesFit: tray.cluesFit });

  // 30 hint (Difícil: the station, in words; never a halo)
  await press(session, page.locator(".hos-hint-button"));
  await settle(page);
  const hint = await hintState(page);
  check("30_HINT_ON_A_PHONE", /^Pista: procure/.test(hint.banner) && hint.halo === null, hint);
  await witness(page, "e15-mobile-hint", 300);

  // 28 a tap on a target (the one the hint was for: the first line)
  const tapped = await findTarget(session, hardIds[0]);
  check("28_TOUCH_TAP_FINDS", tapped.after === 1, tapped);

  // X21 the tray folds to one row and unfolds; the room grows while it is folded
  const openHeight = (await camera(page)).height;
  await press(session, page.locator(".hos-tray-toggle"));
  await settle(page);
  const folded = { height: (await camera(page)).height, tray: await page.evaluate(() => document.querySelector(".hos-shell")?.dataset.tray), overflow: await overflow(page) };
  await witness(page, "e16-mobile-tray-folded", 300);
  await press(session, page.locator(".hos-tray-toggle"));
  await settle(page);
  const unfolded = await page.evaluate(() => document.querySelector(".hos-shell")?.dataset.tray);
  metrics.mobileFold = { openHeight, foldedHeight: folded.height, share: folded.height / 844 };
  check("X21_TRAY_FOLDS_AND_THE_ROOM_GROWS", folded.tray === "closed" && folded.height > openHeight + 40 && unfolded === "open" && folded.overflow <= 0, { openHeight, folded, unfolded });

  // 31 completion: all eight of Difícil
  for (const id of hardIds) {
    if (!(await page.locator(`.hos-found[data-target="${id}"]`).count())) await findTarget(session, id);
  }
  await noteOverflow("found all");
  await page.waitForSelector(".hos-overlay-complete", { state: "visible", timeout: 4000 });
  metrics.playtest.technicalMsToClosingCard["phone hard"] = Date.now() - hardStarted;
  await press(session, page.getByRole("button", { name: "Concluir exploração" }));
  await page.waitForSelector(".prm-card", { timeout: 6000 });
  const saved = (await storedResults(page))[0];
  check("31_COMPLETES_ON_A_PHONE", saved?.gameId === "hidden-objects" && saved.score === 8 && saved.details.difficulty === "hard" && saved.details.roundSeed === SEEDS.mobile[0], { saved });
  await noteOverflow("result");
  check("32_NO_HORIZONTAL_PAGE_OVERFLOW", overflows.every((o) => o.px <= 0), { overflows });
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: a small phone -----------------------------------------------------------------------------

async function small() {
  current = "small";
  const session = await openSession({ width: 360, height: 640, touch: true, seeds: SEEDS.small });
  const { page } = session;
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await hydrated(page);
  await enterStudio(session);
  await press(session, page.locator(".pgi-cta"));
  await page.waitForSelector(".hos-setup", { state: "visible" });
  const explore = await page.getByRole("button", { name: "Explorar", exact: true }).boundingBox();
  check("SMALL_SETUP_REACHABLE", explore && explore.y + explore.height <= 640, { explore });
  await press(session, page.getByRole("button", { name: "Explorar", exact: true }));
  await page.waitForFunction(() => document.querySelector(".hos-shell")?.dataset.status === "playing");
  await settle(page);
  const round = await roundOnScreen(page);
  const layout = await page.evaluate(() => ({
    sceneShare: document.querySelector(".hos-viewport").getBoundingClientRect().height / window.innerHeight,
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  // nothing chosen in the setup: Fácil, and the round its seed draws
  check("SMALL_ROUND_IS_ITS_SEED", isDrawn(round, "easy", SEEDS.small[0]) && round.draws === 1, { round, drawn: drawn("easy", SEEDS.small[0]) });
  metrics.roundsOnScreen["small phone easy"] = round;
  const found = await findTarget(session, round.ids[0]);
  await witness(page, "e18-small-phone");
  check("SMALL_SCENE_KEEPS_ITS_SPACE", layout.sceneShare > 0.45 && layout.overflow <= 0, layout);
  check("SMALL_FIND", found.after === 1, found);
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: reduced motion -----------------------------------------------------------------------------

async function reducedMotion() {
  current = "reduced-motion";
  const session = await openSession({ width: 1440, height: 900, reducedMotion: "reduce", seeds: SEEDS["reduced-motion"] });
  const { page } = session;
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await hydrated(page);
  await enterStudio(session);
  const round = await startExploring(session, "Fácil");
  check("RM_ROUND_IS_ITS_SEED", isDrawn(round, "easy", SEEDS["reduced-motion"][0]) && round.draws === 1, { round, drawn: drawn("easy", SEEDS["reduced-motion"][0]) });
  metrics.roundsOnScreen["reduced motion easy"] = round;
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
  const parallax = await page.evaluate(() =>
    [...document.querySelectorAll(".hos-layer-back, .hos-layer-front, .hos-layer-front-right")].map((layer) => layer.style.transform),
  );
  check("RM_NO_PARALLAX", parallax.length === 3 && parallax.every((t) => /translate3d\(0px, 0px, 0px\)/.test(t ?? "")), { parallax });
  // GAME03-EXPERIENCE-02: the found ring and the name tag switch on and off, no fades, no scaling
  await findTarget(session, round.ids[0]);
  const feedback = await page.evaluate(() => {
    const read = (selector) => {
      const element = document.querySelector(selector);
      return element ? { animation: getComputedStyle(element).animationName, timing: getComputedStyle(element).animationTimingFunction } : null;
    };
    return { ring: read(".hos-found-ring"), tag: read(".hos-found-tag"), glow: read('.hos-found[data-fresh="true"] .hos-found-glow') };
  });
  check(
    "RM_FOUND_FEEDBACK_WITHOUT_MOTION",
    /steps/.test(feedback.ring?.timing ?? "") && /steps/.test(feedback.tag?.timing ?? "") && (feedback.glow?.animation ?? "none") === "none",
    feedback,
  );
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: Difícil on the desktop ----------------------------------------------------------------------

async function hard() {
  current = "hard";
  const session = await openSession({ width: 1440, height: 900, seeds: SEEDS.hard });
  const { page } = session;
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await hydrated(page);
  await enterStudio(session);
  const round = await startExploring(session, "Difícil");
  const hardIds = round.ids;
  const started = Date.now();
  check("X16_DIFICIL_ROUND_IS_ITS_SEED", isDrawn(round, "hard", SEEDS.hard[0]) && round.draws === 1 && hardIds.length === 8 && evenlySpread(hardIds), {
    round,
    drawn: drawn("hard", SEEDS.hard[0]),
    spread: spreadOf(hardIds),
  });
  metrics.roundsOnScreen["desktop hard"] = round;
  metrics.playtest.visibleWithoutPan["desktop hard"] = await onScreenCount(page, hardIds);

  // X10 the list is what each object is for; no image, no name of anything still hidden
  const entries = await listEntries(page);
  const names = hardIds.map((id) => TARGET[id].label);
  check(
    "X10_DIFICIL_LIST_IS_THE_CLUES",
    same(entries.map((e) => e.text), hardIds.map((id) => TARGET[id].clue)) && entries.every((e) => e.art === null) &&
      !entries.some((e) => names.some((name) => norm(`${e.text} ${e.aria}`).includes(norm(name)))),
    { entries },
  );
  await witness(page, "e05-hard-playing");

  // X11 every object's ladder: the station, then what it is near, then the same again — never a light, never a glide to it
  const ladders = {};
  const problems = [];
  for (const [index, id] of hardIds.entries()) {
    const target = TARGET[id];
    await press(session, page.locator(".hos-item").nth(index));
    const steps = [];
    let previous = null;
    for (let i = 0; i < 3; i += 1) {
      await press(session, page.locator(".hos-hint-button"));
      await settle(page);
      await page.waitForTimeout(120);
      const state = await hintState(page);
      const cam = await camera(page);
      steps.push(state.banner);
      if (state.halo) problems.push(`${id}: halo after press ${i + 1}`);
      if (/Aqui está|Mostrar/.test(`${state.banner} ${state.button}`)) problems.push(`${id}: "${state.button}" / "${state.banner}"`);
      if (norm(state.banner).includes(norm(target.label))) problems.push(`${id}: the banner names it`);
      if (i === 0 && Math.abs(viewCentre(cam).x - Math.min(Math.max(STATION[target.station].center.x, cam.width / (2 * cam.s)), SCENE.SCENE_WIDTH - cam.width / (2 * cam.s))) > 2) problems.push(`${id}: press 1 is not the station`);
      if (i > 0 && previous && (Math.abs(cam.tx - previous.tx) > 0.5 || Math.abs(cam.s - previous.s) > 1e-6)) problems.push(`${id}: press ${i + 1} moved the camera`);
      if (i === 1 && state.banner !== `Pista: está ${target.hintContext}.`) problems.push(`${id}: context "${state.banner}"`);
      if (i === 2 && state.button !== "Rever pista") problems.push(`${id}: top button "${state.button}"`);
      previous = cam;
    }
    ladders[id] = steps;
    if (index === 6) await witness(page, "e06-hard-hint-max", 300);
  }
  metrics.playtest.hintPresses["desktop hard"] = hardIds.length * 3;
  check("X11_DIFICIL_HINTS_NEVER_REVEAL", problems.length === 0, { problems: problems.slice(0, 8), ladders });

  // X12 a find says the name: in the list (with the clue it answered), on a tag in the room, to the live region
  const first = hardIds[0];
  await findTarget(session, first);
  const revealed = await page.evaluate((label) => {
    const item = [...document.querySelectorAll(".hos-item")].find((n) => n.dataset.found === "true");
    return {
      line: item?.querySelector(".hos-item-label")?.childNodes[0]?.textContent ?? null,
      answered: item?.querySelector(".hos-item-answered")?.textContent ?? null,
      tag: document.querySelector(".hos-found-tag")?.textContent ?? null,
      live: document.querySelector('.hos-sr-only[aria-live]')?.textContent ?? "",
      label,
    };
  }, TARGET[first].label);
  check(
    "X12_A_FIND_SAYS_THE_NAME",
    revealed.line === TARGET[first].label && revealed.answered === TARGET[first].clue && revealed.tag === TARGET[first].label && revealed.live.includes(TARGET[first].label),
    revealed,
  );
  await witness(page, "e07-hard-semantic-found", 150);

  // X13 the camera still answers in Difícil: pan, wheel, stations. The pan goes towards the room's middle: after
  // a find the camera may rest against a wall (the earlier probe always dragged right, which cannot move a camera
  // resting against the Janela's wall — its one failure on the recovered build)
  let cam = await camera(page);
  const centre = { x: cam.left + cam.width / 2, y: cam.top + cam.height / 2 };
  const before = viewCentre(cam);
  await drag(session, centre, { x: centre.x + 200 * towardsTheMiddle(cam), y: centre.y });
  await settle(page);
  cam = await camera(page);
  const pannedPx = Math.abs(before.x - viewCentre(cam).x) * cam.s;
  const panned = pannedPx > 150;
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.wheel(0, -240);
  await page.waitForTimeout(300);
  await settle(page);
  const zoomedIn = (await camera(page)).s > cam.s * 1.15;
  await press(session, page.locator(".hos-station", { hasText: "Estante" }));
  await settle(page);
  const atShelf = Math.abs(viewCentre(await camera(page)).x - Math.min(STATION.estante.center.x, SCENE.SCENE_WIDTH - (await camera(page)).width / (2 * (await camera(page)).s))) < 2;
  check("X13_PAN_ZOOM_STATIONS_IN_DIFICIL", panned && zoomedIn && atShelf, { panned, pannedPx, zoomedIn, atShelf });

  // X14 the objectives fold away on the desktop too (a rail), and come back
  const openWidth = (await camera(page)).width;
  await press(session, page.locator(".hos-tray-toggle"));
  await settle(page);
  const railWidth = (await camera(page)).width;
  await witness(page, "e17-desktop-rail", 300);
  await press(session, page.locator(".hos-tray-toggle"));
  await settle(page);
  check("X14_THE_LIST_FOLDS_TO_A_RAIL", railWidth > openWidth + 120 && (await camera(page)).width === openWidth, { openWidth, railWidth });

  // X15 all eight, one result, the result screen in Difícil's words
  for (const id of hardIds) {
    if (!(await page.locator(`.hos-found[data-target="${id}"]`).count())) await findTarget(session, id);
  }
  await page.waitForSelector(".hos-overlay-complete", { state: "visible", timeout: 4000 });
  metrics.playtest.technicalMsToClosingCard["desktop hard"] = Date.now() - started;
  await press(session, page.getByRole("button", { name: "Concluir exploração" }));
  await page.waitForSelector(".prm-card", { timeout: 6000 });
  const modal = await resultScreen(page);
  const saved = (await storedResults(page))[0];
  check(
    "X15_DIFICIL_RESULT",
    saved?.score === 8 && saved.details.difficulty === "hard" && saved.details.sceneId === "explorer-studio" && saved.details.roundSeed === SEEDS.hard[0] &&
      modal.scoreLabel === "Objetos encontrados" && modal.score === "8" && same(modal.details, { Modo: "Difícil" }),
    { saved, modal },
  );
  await witness(page, "e08-hard-result", 500);
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
  // the old result is on the device before the first load (the context's storage; no script writes it)
  const session = await openSession({ width: 1440, height: 900, seeds: SEEDS.legacy, storage: [LEGACY_RESULT] });
  const { page } = session;
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  // read the Home once it has hydrated (see reload-race: before that, the page is the server's default)
  const commitsAtFirstRead = await hydrated(page);
  const home = await page.evaluate(() => ({
    selected: document.querySelector(".hj-world-selected .hj-world-copy strong")?.textContent ?? null,
    worlds: [...document.querySelectorAll(".hj-world-copy strong")].map((n) => n.textContent),
    stage: Boolean(document.querySelector(".hj-stage")),
  }));
  home.commitsAtRead = commitsAtFirstRead;
  check("33_LEGACY_RESULT_IS_READ_SAFELY", home.stage && home.worlds.length === 5 && !home.worlds.includes("Trilha Lógica"), home);
  check("34_NO_CRASH", session.errors.length === 0, { errors: session.errors });
  check("35_NOT_SHOWN_AS_THE_STUDIO", home.selected !== "Estúdio das Descobertas" && (await page.locator(".hos-shell").count()) === 0, home);
  await witness(page, "e19-legacy-home");

  // A full Estúdio session next to it: the old entry stays exactly as it was.
  await enterStudio(session);
  const round = await startExploring(session, "Fácil");
  check("LEGACY_ROUND_IS_ITS_SEED", isDrawn(round, "easy", SEEDS.legacy[0]) && round.draws === 1, { round, drawn: drawn("easy", SEEDS.legacy[0]) });
  for (const id of round.ids) await findTarget(session, id);
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
  // The Home is static: the server's HTML selects the default world, and the stored history selects the newest
  // playable result in a mount effect, after hydration. So the read waits for the page to hydrate and settle —
  // for React's commits, never for the answer it expects — and whatever the hydrated Home shows is what counts.
  const commitsAtRead = await hydrated(page);
  const reloaded = await homeSnapshot(page);
  check("35_RELOAD_FOLLOWS_THE_NEWEST_PLAYABLE_RESULT", reloaded.selected === "Estúdio das Descobertas" && commitsAtRead >= 1 && same(reloaded.stored, ["hidden-objects", "number-trail"]), {
    ...reloaded,
    commitsAtRead,
  });
  check("NO_RETIRED_GAME_REQUESTED", !session.requests.some((url) => /number-trail|NumberTrail/.test(url)));
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: a phone held sideways ------------------------------------------------------------------------

async function landscape() {
  current = "landscape";
  const session = await openSession({ width: 844, height: 390, touch: true, seeds: SEEDS.landscape });
  const { page } = session;
  const overflows = [];
  const noteOverflow = async (step) => overflows.push({ step, px: await overflow(page) });
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await hydrated(page);
  await noteOverflow("home");
  await enterStudio(session);
  const round = await startExploring(session, "Médio");
  const started = Date.now();
  await noteOverflow("playing");
  check("L01_OPENS_SIDEWAYS_WITH_ITS_ROUND", (await status(page)) === "playing" && isDrawn(round, "medium", SEEDS.landscape[0]) && round.draws === 1 && evenlySpread(round.ids), {
    round,
    drawn: drawn("medium", SEEDS.landscape[0]),
  });
  metrics.roundsOnScreen["phone landscape medium"] = round;

  // L02 the list beside the room (its own scrolling column), the room keeps most of the width, touch-sized controls
  const layout = await page.evaluate(() => {
    const scene = document.querySelector(".hos-viewport").getBoundingClientRect();
    const panel = document.querySelector(".hos-panel").getBoundingClientRect();
    const first = document.querySelector(".hos-item")?.getBoundingClientRect();
    return {
      panelBesideScene: panel.left >= scene.right - 1,
      sceneWidthShare: Number((scene.width / window.innerWidth).toFixed(3)),
      sceneHeightShare: Number((scene.height / window.innerHeight).toFixed(3)),
      items: document.querySelectorAll(".hos-item").length,
      firstItemVisible: Boolean(first) && first.top >= panel.top - 1 && first.bottom <= panel.bottom + 1,
      minTarget: Math.min(
        ...[...document.querySelectorAll(".hos-panel button, .hos-zoom button, .hos-topbar button")].map((b) => Math.min(b.getBoundingClientRect().width, b.getBoundingClientRect().height)),
      ),
    };
  });
  metrics.landscapeLayout = layout;
  check("L02_LANDSCAPE_LAYOUT", layout.panelBesideScene && layout.sceneWidthShare > 0.6 && layout.items === 6 && layout.firstItemVisible && layout.minTarget >= 44, layout);
  metrics.playtest.visibleWithoutPan["phone landscape medium"] = await onScreenCount(page, round.ids);
  await witness(page, "e20-landscape-medium");

  // L03 two fingers zoom, then one finger pans, nothing is found by either. Sideways the whole room nearly fits
  // the width at the opening zoom (the camera can move only (room − view) / 2 either way), so a person zooms first
  let cam = await camera(page);
  const centre = { x: cam.left + cam.width / 2, y: cam.top + cam.height / 2 };
  const scaleBefore = cam.s;
  const roomToPanPx = ((SCENE.SCENE_WIDTH - cam.width / cam.s) / 2) * cam.s;
  await pinch(session, centre, 70, 200);
  await settle(page);
  cam = await camera(page);
  const pinchedScale = cam.s;
  const before = viewCentre(cam);
  await drag(session, centre, { x: centre.x + 120 * towardsTheMiddle(cam), y: centre.y }, 14);
  await settle(page);
  cam = await camera(page);
  const movedPx = Math.abs(viewCentre(cam).x - before.x) * cam.s;
  check("L03_PINCH_AND_DRAG_SIDEWAYS", pinchedScale > scaleBefore * 1.5 && movedPx > 80 && (await progress(page)).found === 0, {
    scale: [scaleBefore, pinchedScale],
    movedPx,
    roomToPanAtOpeningZoomPx: Number(roomToPanPx.toFixed(1)),
  });
  await press(session, page.getByRole("button", { name: "Recentrar" }));
  await settle(page);

  // L04 a hint (Médio: first the station, in words) and two finds
  await press(session, page.locator(".hos-hint-button"));
  await settle(page);
  const hint = await hintState(page);
  check("L04_HINT_SIDEWAYS", /^Pista: procure/.test(hint.banner) && hint.hinted === STATION[TARGET[round.ids[0]].station].label, hint);
  const finds = [await findTarget(session, round.ids[0]), await findTarget(session, round.ids[1])];
  check("L05_FINDS_SIDEWAYS", finds[1].after === 2, { finds });
  await witness(page, "e21-landscape-found", 300);

  // L06 the phone turned upright mid-round, then back: the same round, nothing lost, nothing drawn again
  await page.setViewportSize({ width: 390, height: 844 });
  await settle(page);
  const upright = { round: await roundOnScreen(page), progress: await progress(page), overflow: await overflow(page) };
  await witness(page, "e22-landscape-turned-upright", 300);
  await page.setViewportSize({ width: 844, height: 390 });
  await settle(page);
  const back = { round: await roundOnScreen(page), progress: await progress(page), overflow: await overflow(page) };
  check(
    "L06_TURNING_THE_PHONE_KEEPS_THE_ROUND",
    same(upright.round, round) && same(back.round, round) && upright.progress.found === 2 && back.progress.found === 2 && upright.overflow <= 0 && back.overflow <= 0,
    { round, upright, back },
  );

  // L07 the rest, and one result that records its round
  for (const id of round.ids) {
    if (!(await page.locator(`.hos-found[data-target="${id}"]`).count())) await findTarget(session, id);
  }
  await noteOverflow("found all");
  await page.waitForSelector(".hos-overlay-complete", { state: "visible", timeout: 4000 });
  metrics.playtest.technicalMsToClosingCard["phone landscape medium"] = Date.now() - started;
  await witness(page, "e23-landscape-complete", 600);
  await press(session, page.getByRole("button", { name: "Concluir exploração" }));
  await page.waitForSelector(".prm-card", { timeout: 6000 });
  const saved = (await storedResults(page))[0];
  check("L07_COMPLETES_SIDEWAYS", saved?.gameId === "hidden-objects" && saved.score === 6 && saved.details.difficulty === "medium" && saved.details.roundSeed === SEEDS.landscape[0], { saved });
  await noteOverflow("result");
  check("L08_NO_HORIZONTAL_PAGE_OVERFLOW", overflows.every((o) => o.px <= 0), { overflows });
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: rounds — nine entries, nine planted seeds ------------------------------------------------------

async function rounds() {
  current = "rounds";
  const session = await openSession({ width: 1440, height: 900, seeds: SEEDS.rounds });
  const { page } = session;
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await hydrated(page);
  const LEVEL = { easy: "Fácil", medium: "Médio", hard: "Difícil" };
  const STYLE = { easy: "picture", medium: "silhouette", hard: null };
  const seen = [];
  const problems = [];
  let scenery = null;
  for (const [index, difficulty] of ROUND_PLAN.entries()) {
    const seed = SEEDS.rounds[index];
    await enterStudio(session);
    const round = await startExploring(session, LEVEL[difficulty]);
    const entries = await listEntries(page);
    const total = (await progress(page)).total;
    seen.push({ difficulty, seed: round.seed, ids: round.ids, draws: round.draws, spread: spreadOf(round.ids) });
    if (!isDrawn(round, difficulty, seed)) problems.push(`${difficulty} ${seed}: on screen ${round.ids.join(",")} (seed ${round.seed}), drawn ${drawn(difficulty, seed).join(",")}`);
    if (round.draws !== index + 1) problems.push(`${difficulty} ${seed}: ${round.draws} draws after ${index + 1} entries`);
    if (!evenlySpread(round.ids)) problems.push(`${difficulty} ${seed}: spread ${JSON.stringify(spreadOf(round.ids))}`);
    if (new Set(round.ids).size !== round.ids.length) problems.push(`${difficulty} ${seed}: an object listed twice`);
    if (total !== SCENE.DIFFICULTY_PRESETS[difficulty].count || round.ids.length !== total) problems.push(`${difficulty} ${seed}: ${round.ids.length} listed, ${total} counted`);
    if (!entries.every((e) => e.art === STYLE[difficulty])) problems.push(`${difficulty} ${seed}: list style ${entries.map((e) => e.art).join(",")}`);
    if (index === 0) {
      // an object of the pool this round does not ask for is part of the room: a tap on it finds nothing, says nothing
      const unlisted = SCENE.HIDDEN_OBJECTS.find((t) => t.tier === "A" && !round.ids.includes(t.id));
      const { point } = await bringIntoView(session, unlisted.id);
      await tapAt(session, point);
      await page.waitForTimeout(250);
      scenery = {
        id: unlisted.id,
        found: (await progress(page)).found,
        marks: await page.locator(".hos-found").count(),
        live: await page.evaluate(() => document.querySelector('.hos-sr-only[aria-live]')?.textContent ?? ""),
      };
      await witness(page, `e24-round-${difficulty}-${seed}`);
    }
    if (index === 3 || index === 6) await witness(page, `e24-round-${difficulty}-${seed}`);
    await press(session, page.getByRole("button", { name: "Voltar à jornada" }));
    await page.waitForSelector(".hj-stage", { timeout: 6000 });
  }
  metrics.rounds = seen;
  check("R01_EVERY_ENTRY_SHOWS_THE_ROUND_ITS_SEED_DRAWS", problems.length === 0 && seen.length === 9, { problems, seen });
  const distinct = Object.fromEntries(["easy", "medium", "hard"].map((d) => [d, new Set(seen.filter((s) => s.difficulty === d).map((s) => sorted(s.ids).join())).size]));
  check("R02_NEW_ENTRIES_ASK_FOR_OTHER_LISTS", Object.values(distinct).every((n) => n === 3), { distinctListsPerDifficulty: distinct });
  check("R03_UNLISTED_POOL_OBJECTS_ARE_SCENERY", scenery && scenery.found === 0 && scenery.marks === 0 && !/Encontrou/.test(scenery.live), scenery ?? {});
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: the Home/reload race, reproduced and explained ------------------------------------------------

/** A finished Estúdio result as the game writes it: the newest playable result on the device. */
const STUDIO_RESULT = {
  id: "hidden-objects-1759900000000",
  activityId: "hidden-objects",
  activityTitle: "Estúdio das Descobertas",
  gameId: "hidden-objects",
  score: 5,
  playedAt: "2026-10-07T18:00:00.000Z",
  summary: "Você encontrou todos os objetos do Estúdio.",
  details: { difficulty: "easy", foundObjects: 5, totalObjects: 5, completed: true, sceneId: "explorer-studio", roundSeed: 101 },
};

async function reloadRace() {
  current = "reload-race";
  // RR1 the Home is prerendered once: the HTML the server sends selects the default world, whatever a device holds
  const html = await (await fetch(`${BASE}/`)).text();
  const serverSelected = /hj-world-selected[^>]*>[\s\S]*?<strong[^>]*>([^<]+)<\/strong>/.exec(html)?.[1] ?? null;
  check("RR1_THE_SERVER_HTML_SELECTS_THE_DEFAULT_WORLD", serverSelected === "Rota Estratégica", { serverSelected });

  // The device holds [Estúdio, Trilha] before the load. Each load is read twice: as the base probe read it
  // (networkidle, then 400 ms) and once hydrated (React has committed, then stayed quiet). The CPU is slowed
  // step by step (CDP) until the base read lands before React's first commit.
  const session = await openSession({ width: 1440, height: 900, storage: [STUDIO_RESULT, LEGACY_RESULT] });
  const { page } = session;
  const cdp = await session.context.newCDPSession(page);
  const runs = [];
  for (const rate of [1, 20, 50, 100, 200]) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    if (runs.length === 0) await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    else await page.reload({ waitUntil: "networkidle" });
    await page.waitForTimeout(400);
    const baseRead = await homeSnapshot(page);
    const commitsAtRead = await hydrated(page);
    const hydratedRead = await homeSnapshot(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    runs.push({ cpuSlowdown: rate, baseRead, hydratedRead: { ...hydratedRead, commitsAtRead } });
    if (rate > 1 && baseRead.commits === 0) break;
  }
  metrics.reloadRace = { serverSelected, runs };
  const raced = runs.find((run) => run.cpuSlowdown > 1 && run.baseRead.commits === 0);
  // RR2 the anomaly: the base read saw the server's default while the device held the Estúdio — before hydration
  check(
    "RR2_THE_BASE_READ_CAN_LAND_BEFORE_HYDRATION",
    Boolean(raced) && raced.baseRead.selected === "Rota Estratégica" && same(raced.baseRead.stored, ["hidden-objects", "number-trail"]),
    { raced: raced ?? null, slowdowns: runs.map((run) => run.cpuSlowdown) },
  );
  // RR3 the product: hydration keeps the server's default (commit 1), the stored history then selects the newest
  // playable result (a later commit) — at every speed, the hydrated Home shows the Estúdio
  const ordered = (log) => log[0]?.selected === "Rota Estratégica" && log.some((entry) => entry.commit > 1 && entry.selected === "Estúdio das Descobertas");
  check(
    "RR3_THE_HYDRATED_HOME_SELECTS_THE_NEWEST_PLAYABLE_RESULT",
    runs.every((run) => run.hydratedRead.selected === "Estúdio das Descobertas" && run.hydratedRead.commitsAtRead >= 1 && ordered(run.hydratedRead.commitLog)),
    { runs: runs.map((run) => ({ cpuSlowdown: run.cpuSlowdown, hydrated: run.hydratedRead.selected, commitLog: run.hydratedRead.commitLog })) },
  );
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

/** Playtest diagnostics from the scene data: the zoom each object needs on the reference phone to reach 44 px. */
function phoneZoomNeeds() {
  const phone = { width: 390, height: 662 };
  const cover = Math.max(phone.width / SCENE.SCENE_WIDTH, phone.height / SCENE.SCENE_HEIGHT);
  return Object.fromEntries(
    SCENE.HIDDEN_OBJECTS.map((t) => {
      const r = t.region;
      const side = r.kind === "rect" ? Math.min(r.w, r.h) : 2 * r.r;
      return [t.id, { tier: t.tier, atCoverPx: Math.round(side * cover), zoomFor44px: Number(Math.max(1, 44 / (side * cover)).toFixed(2)) }];
    }),
  );
}

const runners = {
  desktop,
  hard,
  mobile,
  landscape,
  small,
  "reduced-motion": reducedMotion,
  legacy,
  rounds,
  "reload-race": reloadRace,
  bundle: () => {
    bundle();
    metrics.playtest.phoneZoomFor44px = phoneZoomNeeds();
  },
};
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
