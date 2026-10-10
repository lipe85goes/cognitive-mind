/**
 * GAME03-MULTISCENE-03 — browser probe for Game 03's rooms.
 *
 * Drives the PRODUCTION build (`next build && next start`) the way a person
 * would, and reads only what the page shows (DOM, the world element's
 * transform, localStorage, network). Nothing in the product is instrumented:
 * React commits are counted through a stand-in for the React DevTools hook (as
 * hidden-objects-browser-probe.mjs does), and every round's seed is planted in
 * the platform's random source, `crypto.getRandomValues` — the list on screen
 * is then held to the list that (room, difficulty, seed) draws, read from source.
 *
 * The Estúdio's own long-standing scenarios (Home/reload hydration, legacy
 * results, the Estúdio at every difficulty, phones) stay in
 * hidden-objects-browser-probe.mjs; this layer covers the rooms.
 *
 * Scenarios (all by default; pick with --scenario a,b):
 *   ms-desktop        1440×900, mouse: Game 03 from the Home → setup offers both rooms (the Estúdio
 *                     chosen) → a seeded Estúdio round → "Trocar de cena" (nothing saved) → the
 *                     Observatório (its art fetched only now) → Fácil/Médio/Difícil in its setup → a seeded
 *                     round: pan, wheel/± zoom, the three stations, the hint ladder, a find, all finds, the
 *                     closing card → result (room and round recorded) → "Praticar outra vez" (the same
 *                     room, a new round) → "Trocar de cena" → the Estúdio again; no React commit per pointermove
 *   ms-mobile         390×844, touch, the Observatório on Difícil: drag, pinch, the tray (rows, fold), hints,
 *                     found feedback, all finds, result; never a horizontal page overflow
 *   ms-landscape      844×390, touch, the Observatório on Médio: the setup's "Explorar" in reach, stations,
 *                     drag + pinch, the phone turned upright and back mid-round (the round holds), result
 *   ms-reduced-motion 1440×900, prefers-reduced-motion, the Observatório: stations cut, halos and the found
 *                     ring without fades, no parallax on any of its four drifting layers
 *   ms-isolation      the same seed on both rooms, each a new entry from the Home: each list is its own
 *                     room's draw; re-entry leaks nothing of the previous room's round
 *   ms-payload        what each step fetches: the Home, Game 03's entry and setup, the Estúdio's round, the
 *                     Observatório chosen later; sizes from the build and public/ (the same files served)
 *
 * Usage:
 *   node tools/validation/hidden-objects-multiscene-probe.mjs [--base http://localhost:3100]
 *        [--build .next] [--scenario NAME[,NAME…]] [--out DIR] [--json FILE]
 *
 * Playwright: `import("playwright")`, or set PLAYWRIGHT_DIR to a node_modules directory that has it.
 * Exit: 0 every scenario held · 1 a check failed · 3 usage / setup error.
 */
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { pathToFileURL } from "node:url";
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
const ALL = ["ms-desktop", "ms-mobile", "ms-landscape", "ms-reduced-motion", "ms-isolation", "ms-payload"];
const SCENARIOS = (arg("--scenario", ALL.join(",")) ?? "").split(",").filter(Boolean);
if (SCENARIOS.some((name) => !ALL.includes(name))) {
  console.error(`unknown scenario; choose from ${ALL.join(", ")}`);
  process.exit(EXIT_USAGE);
}

const { chromium } = await (async () => {
  try {
    return await import("playwright");
  } catch {
    const dirs = [process.env.PLAYWRIGHT_DIR, "/opt/node22/lib/node_modules"].filter(Boolean);
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

// --- the rooms the game uses (read from source, never restated here) -------------------------------

const SOURCE = createModuleGraph({ mocks: {}, globals: {} });
const REGISTRY = SOURCE.require("src/games/hidden-objects/hidden-objects-scenes.ts");
const ROUNDS = SOURCE.require("src/games/hidden-objects/hidden-objects-rounds.ts");
const ROOM = Object.fromEntries(REGISTRY.SCENES.map((scene) => [scene.id, scene]));
const STUDIO = "explorer-studio";
const OBSERVATORY = "explorer-observatory";
const STORAGE_KEY = /const STORAGE_KEY = "([^"]+)"/.exec(fs.readFileSync("src/engine/storage.ts", "utf8"))[1];
const drawn = (roomId, difficulty, seed) => ROUNDS.selectRoundTargets(ROOM[roomId], difficulty, seed);
const target = (roomId, id) => ROOM[roomId].pool.find((t) => t.id === id);
const centreOf = (region) => (region.kind === "rect" ? { x: region.x + region.w / 2, y: region.y + region.h / 2 } : { x: region.cx, y: region.cy });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sorted = (list) => [...list].sort();
/** Each scenario's seeds, one per "Explorar", in order. */
const SEEDS = {
  "ms-desktop": [7001, 7002, 7003, 7004],
  "ms-mobile": [7101],
  "ms-landscape": [7201],
  "ms-reduced-motion": [7301],
  "ms-isolation": [7401, 7401],
  "ms-payload": [7501, 7502],
};

// --- results ----------------------------------------------------------------------------------------

const results = [];
const metrics = { rounds: {}, payload: {}, performance: {} };
let current = "setup";
function check(id, pass, detail = {}) {
  results.push({ scenario: current, id, pass: Boolean(pass), detail });
  console.log(`${pass ? "PASS" : "FAIL"}  [${current}] ${id}`);
  if (!pass || process.env.PROBE_VERBOSE) for (const [key, value] of Object.entries(detail)) console.log(`        ${key}: ${JSON.stringify(value)}`);
  return pass;
}

const BUILD_ID = fs.existsSync(path.join(BUILD, "BUILD_ID")) ? fs.readFileSync(path.join(BUILD, "BUILD_ID"), "utf8").trim() : null;
{
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
  window.__probe = { commits: 0 };
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
}

/** The platform's random source, deterministic for one page: each 32-bit draw takes the next planted seed. */
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

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--use-gl=angle", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });

async function openSession({ width, height, touch = false, reducedMotion = "no-preference", seeds = [] }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, reducedMotion });
  await context.addInitScript(installObservers);
  await context.addInitScript(plantSeeds, seeds);
  const page = await context.newPage();
  const session = { context, page, errors: [], requests: [], touch, cdp: null };
  page.on("pageerror", (error) => session.errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") session.errors.push(`console: ${message.text()}`);
  });
  page.on("request", (request) => session.requests.push(new URL(request.url()).pathname));
  if (touch) session.cdp = await context.newCDPSession(page);
  return session;
}

async function witness(page, name, settleMs = 0) {
  if (!OUT) return;
  if (settleMs) await page.waitForTimeout(settleMs);
  fs.mkdirSync(OUT, { recursive: true });
  const png = await page.screenshot();
  const sharp = (await import("sharp")).default;
  await sharp(png).webp({ quality: 74 }).toFile(path.join(OUT, `${name}.webp`));
}

// --- reading the game ------------------------------------------------------------------------------------

async function camera(page) {
  return page.evaluate(() => {
    const world = document.querySelector(".hos-world");
    const viewport = document.querySelector(".hos-viewport");
    if (!world || !viewport) return null;
    const m = /translate3d\(([-\d.e]+)px,\s*([-\d.e]+)px,\s*0(?:px)?\)\s*scale\(([-\d.e]+)\)/.exec(world.style.transform);
    const rect = viewport.getBoundingClientRect();
    return m ? { tx: +m[1], ty: +m[2], s: +m[3], left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null;
  });
}
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
async function settle(page) {
  await frames(page, 2);
  await page.waitForFunction(() => document.querySelector(".hos-world")?.dataset.moving !== "true", null, { timeout: 5000, polling: "raf" });
  await frames(page, 2);
}
const shell = (page) =>
  page.evaluate(() => {
    const element = document.querySelector(".hos-shell");
    return element ? { status: element.dataset.status, scene: element.dataset.scene, seed: element.dataset.roundSeed === undefined ? null : Number(element.dataset.roundSeed) } : null;
  });
async function roundOnScreen(page) {
  const round = await page.evaluate(() => ({
    scene: document.querySelector(".hos-shell")?.dataset.scene ?? null,
    seed: document.querySelector(".hos-shell")?.dataset.roundSeed ?? null,
    ids: [...document.querySelectorAll(".hos-item")].map((item) => item.dataset.target ?? null),
    draws: window.__probeDraws?.length ?? null,
  }));
  return { ...round, seed: round.seed === null ? null : Number(round.seed) };
}
const isDrawn = (round, roomId, difficulty, seed) => round.scene === roomId && round.seed === seed && same(round.ids, drawn(roomId, difficulty, seed));
const progress = (page) =>
  page.evaluate(() => {
    const bar = document.querySelector(".hos-progress");
    return bar ? { found: Number(bar.getAttribute("aria-valuenow")), total: Number(bar.getAttribute("aria-valuemax")) } : null;
  });
const storedResults = (page) => page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "[]"), STORAGE_KEY);
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
async function comfortable(page, cam, point) {
  const zoom = await page.evaluate(() => document.querySelector(".hos-zoom")?.getBoundingClientRect().toJSON());
  const margin = 40;
  const inside = point.x > cam.left + margin && point.x < cam.left + cam.width - margin && point.y > cam.top + margin && point.y < cam.top + cam.height - margin;
  const underZoom = zoom && point.x > zoom.left - 24 && point.x < zoom.right + 24 && point.y > zoom.top - 24 && point.y < zoom.bottom + 24;
  return inside && !underZoom;
}

// --- input -------------------------------------------------------------------------------------------------

async function drag(session, from, to, steps = 12) {
  const { page } = session;
  if (!session.touch) {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let i = 1; i <= steps; i += 1) await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    await page.mouse.up();
    return;
  }
  const point = (p) => [{ x: Math.round(p.x), y: Math.round(p.y), id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await session.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: point(from) });
  for (let i = 1; i <= steps; i += 1) {
    await session.cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: point({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }) });
  }
  await session.cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
}
async function pinch(session, centre, startGap, endGap, steps = 10) {
  const pair = (gap) => [
    { x: Math.round(centre.x - gap / 2), y: Math.round(centre.y), id: 1, radiusX: 4, radiusY: 4, force: 1 },
    { x: Math.round(centre.x + gap / 2), y: Math.round(centre.y), id: 2, radiusX: 4, radiusY: 4, force: 1 },
  ];
  await session.cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: pair(startGap) });
  for (let i = 1; i <= steps; i += 1) await session.cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: pair(startGap + ((endGap - startGap) * i) / steps) });
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

// --- the flow ----------------------------------------------------------------------------------------------

/** Home → select Game 03's world → Entrar → intro → "Começar" → the setup on screen. */
async function enterGame03(session) {
  const { page } = session;
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => (window.__probe?.commits ?? 0) >= 1, null, { timeout: 60000 });
  const homeWorlds = await page.evaluate(() => [...document.querySelectorAll(".hj-gallery-pips button")].map((b) => b.getAttribute("aria-label")));
  await press(session, page.locator(".hj-gallery-pips").getByRole("button", { name: "Selecionar Estúdio das Descobertas" }));
  await page.waitForFunction(() => document.querySelector(".hj-world-selected .hj-world-copy strong")?.textContent === "Estúdio das Descobertas");
  await press(session, page.locator(".hj-world-enter"));
  await page.waitForSelector(".wtx-shell", { timeout: 5000 });
  await page.waitForFunction(() => !document.querySelector(".wtx-shell"), null, { timeout: 30000 });
  await page.waitForSelector(".pgi-cta", { state: "visible" });
  await press(session, page.locator(".pgi-cta"));
  await page.waitForSelector(".hos-setup", { state: "visible" });
  return { homeWorlds };
}

const sceneOptions = (page) =>
  page.evaluate(() => [...document.querySelectorAll('input[name="hos-scene"]')].map((input) => ({ id: input.value, checked: input.checked, name: input.closest("label")?.querySelector("strong")?.textContent ?? null })));

/** In the setup: pick a room (and wait until its art has painted: "Explorar" enabled again). */
async function chooseRoom(session, roomId) {
  const { page } = session;
  await press(session, page.locator(".hos-scene-option", { hasText: ROOM[roomId].name }));
  await page.waitForFunction((id) => document.querySelector(".hos-shell")?.dataset.scene === id, roomId);
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll(".hos-setup .hos-primary")][0];
    return button && !button.disabled && /Explorar/.test(button.textContent);
  }, null, { timeout: 30000 });
}

async function explore(session, level) {
  const { page } = session;
  await press(session, page.locator(".hos-difficulty-option", { hasText: level }));
  await press(session, page.getByRole("button", { name: "Explorar", exact: true }));
  await page.waitForFunction(() => document.querySelector(".hos-shell")?.dataset.status === "playing");
  await settle(page);
  return roundOnScreen(page);
}

/** Station, then a drag if the object is not comfortably on screen: the way a person would get there. */
async function bringIntoView(session, roomId, id) {
  const { page } = session;
  const t = target(roomId, id);
  const station = ROOM[roomId].stations.find((s) => s.id === t.station);
  await press(session, page.locator(".hos-station", { hasText: station.label }));
  await settle(page);
  let cam = await camera(page);
  let point = toScreen(cam, centreOf(t.region));
  if (!(await comfortable(page, cam, point))) {
    const centre = { x: cam.left + cam.width / 2, y: cam.top + cam.height / 2 };
    await drag(session, centre, { x: centre.x + (centre.x - point.x), y: centre.y + (centre.y - point.y) });
    await settle(page);
    cam = await camera(page);
    point = toScreen(cam, centreOf(t.region));
  }
  return { point, comfortable: await comfortable(page, cam, point) };
}
async function find(session, roomId, id) {
  const before = await progress(session.page);
  const { point } = await bringIntoView(session, roomId, id);
  await tapAt(session, point);
  await session.page.waitForFunction((n) => Number(document.querySelector(".hos-progress")?.getAttribute("aria-valuenow")) > n, before.found, { timeout: 4000 }).catch(() => {});
  return (await progress(session.page)).found > before.found;
}
/** Find everything still listed; the closing card; "Concluir exploração"; the result screen. */
async function finishRound(session, roomId) {
  const { page } = session;
  const round = await roundOnScreen(page);
  const missed = [];
  for (const id of round.ids) {
    const found = await page.evaluate((t) => document.querySelector(`.hos-item[data-target="${t}"]`)?.dataset.found === "true", id);
    if (!found && !(await find(session, roomId, id))) missed.push(id);
  }
  await page.waitForSelector(".hos-overlay-complete", { timeout: 6000 });
  const card = await page.locator("#hos-complete-title").textContent();
  await press(session, page.locator(".hos-overlay-complete .hos-primary"));
  await page.waitForSelector(".prm-card", { timeout: 6000 });
  const modal = await page.evaluate(() => ({
    world: document.querySelector(".prm-world")?.textContent ?? null,
    title: document.querySelector(".prm-title")?.textContent ?? null,
    summary: document.querySelector("#reward-summary")?.textContent ?? null,
  }));
  return { missed, card, modal };
}

// --- scenario: desktop ----------------------------------------------------------------------------------------

async function desktop() {
  current = "ms-desktop";
  const seeds = SEEDS[current];
  const session = await openSession({ width: 1440, height: 900, seeds });
  const { page } = session;
  const { homeWorlds } = await enterGame03(session);
  const options = await sceneOptions(page);
  check("D01_SETUP_OFFERS_BOTH_ROOMS_THE_STUDIO_CHOSEN", same(options.map((o) => o.id), [STUDIO, OBSERVATORY]) && options[0].checked && !options[1].checked && options.every((o) => o.name === ROOM[o.id].name), { options });
  check(
    "D02_ONE_GAME03_ENTRY_ON_THE_HOME",
    homeWorlds.length === 5 && homeWorlds.filter((name) => /Estúdio das Descobertas/.test(name)).length === 1 && !homeWorlds.some((name) => /Observat/.test(name)),
    { homeWorlds },
  );
  await witness(page, "ms-desktop-setup");
  const observatoryArt = (requests) => requests.filter((url) => url.startsWith("/assets/hidden-objects/explorer-observatory/") && !url.endsWith("/hero.webp"));
  check("D03_SETUP_FETCHES_ONLY_THE_OTHER_ROOMS_PREVIEW", observatoryArt(session.requests).length === 0 && session.requests.includes(ROOM[OBSERVATORY].preview), {
    observatoryRequests: session.requests.filter((url) => url.includes("explorer-observatory")),
  });

  // a seeded Estúdio round, then "Trocar de cena": nothing saved, back to the setup
  const studioRound = await explore(session, "Fácil");
  check("D04_STUDIO_ROUND_IS_ITS_SEED", isDrawn(studioRound, STUDIO, "easy", seeds[0]) && studioRound.draws === 1, { round: studioRound, drawn: drawn(STUDIO, "easy", seeds[0]) });
  metrics.rounds["desktop studio easy"] = studioRound;
  const foundStudio = await find(session, STUDIO, studioRound.ids[0]);
  check("D05_STUDIO_FIND", foundStudio);
  check("D06_NO_OBSERVATORY_ART_WHILE_PLAYING_THE_STUDIO", observatoryArt(session.requests).length === 0, { requests: observatoryArt(session.requests) });
  const storedBefore = (await storedResults(page)).length;
  await press(session, page.getByRole("button", { name: "Trocar de cena" }));
  await page.waitForSelector(".hos-setup", { state: "visible" });
  const back = await shell(page);
  check("D07_TROCAR_DE_CENA_RETURNS_TO_SETUP_SAVING_NOTHING", back.status === "setup" && back.seed === null && (await storedResults(page)).length === storedBefore && (await page.locator(".prm-card").count()) === 0, { back });

  // the Observatório: its art arrives now; its setup offers the three difficulties
  await chooseRoom(session, OBSERVATORY);
  check("D08_THE_OBSERVATORYS_ART_IS_FETCHED_WHEN_CHOSEN", ROOM[OBSERVATORY].layers.every((l) => session.requests.includes(l.src)), { layers: ROOM[OBSERVATORY].layers.map((l) => l.src) });
  const levels = await page.evaluate(() => [...document.querySelectorAll(".hos-difficulty-option")].map((o) => o.textContent.replace(/\s+/g, " ").trim()));
  check("D09_EASY_MEDIUM_HARD_UNCHANGED", levels.length === 3 && /^Fácil 5 objetos/.test(levels[0]) && /^Médio 6 objetos/.test(levels[1]) && /^Difícil 8 objetos/.test(levels[2]), { levels });
  const stationLabels = await page.evaluate(() => [...document.querySelectorAll(".hos-station")].map((b) => b.textContent));
  check("D10_THE_OBSERVATORYS_STATIONS", same(stationLabels, ROOM[OBSERVATORY].stations.map((s) => s.label)), { stationLabels });
  await witness(page, "ms-desktop-setup-observatory", 300);
  const round = await explore(session, "Fácil");
  check("D11_OBSERVATORY_ROUND_IS_ITS_SEED", isDrawn(round, OBSERVATORY, "easy", seeds[1]) && round.draws === 2, { round, drawn: drawn(OBSERVATORY, "easy", seeds[1]) });
  metrics.rounds["desktop observatory easy"] = round;
  const title = await page.locator(".hos-title span").textContent();
  check("D12_THE_HUD_NAMES_THE_ROOM", title === "Observatório do Explorador · Fácil", { title });
  await witness(page, "ms-desktop-observatory", 400);

  // pan: the room follows the mouse, without a React commit per pointermove
  let cam = await camera(page);
  const centre = { x: cam.left + cam.width / 2, y: cam.top + cam.height / 2 };
  const commitsBefore = await page.evaluate(() => window.__probe.commits);
  await drag(session, centre, { x: centre.x + 260, y: centre.y + 60 }, 24);
  const commitsDuring = (await page.evaluate(() => window.__probe.commits)) - commitsBefore;
  await settle(page);
  const panned = await camera(page);
  metrics.performance.desktopDragCommits = commitsDuring;
  check("D13_PAN_MOVES_THE_ROOM", Math.abs(panned.tx - cam.tx) > 100, { before: cam.tx, after: panned.tx });
  check("D14_NO_REACT_COMMIT_PER_POINTERMOVE", commitsDuring <= 2, { commitsDuring, pointermoves: 24 });
  // zoom: the wheel and +
  cam = await camera(page);
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.wheel(0, -400);
  await page.waitForTimeout(300);
  await settle(page);
  const wheeled = await camera(page);
  await press(session, page.getByRole("button", { name: "Aproximar" }));
  await settle(page);
  const plussed = await camera(page);
  check("D15_ZOOM_WHEEL_AND_PLUS", wheeled.s > cam.s && plussed.s > wheeled.s, { scales: [cam.s, wheeled.s, plussed.s] });
  // the three stations take the camera to their centre
  const stationProblems = [];
  for (const station of ROOM[OBSERVATORY].stations) {
    await press(session, page.locator(".hos-station", { hasText: station.label }));
    await settle(page);
    const c = await camera(page);
    const halfW = c.width / (2 * c.s);
    const expected = Math.min(Math.max(station.center.x, halfW), ROOM[OBSERVATORY].width - halfW);
    if (Math.abs(viewCentre(c).x - expected) > 2) stationProblems.push(`${station.id}: centre ${viewCentre(c).x.toFixed(0)} ≠ ${expected.toFixed(0)}`);
    const pressed = await page.evaluate((label) => [...document.querySelectorAll(".hos-station")].find((b) => b.textContent === label)?.getAttribute("aria-pressed"), station.label);
    if (pressed !== "true" && Math.abs(station.center.x - expected) < 1) stationProblems.push(`${station.id}: not marked current`);
  }
  check("D16_STATIONS_CUPULA_BANCADA_ARQUIVO", stationProblems.length === 0, { stationProblems });
  // the hint ladder (Fácil): station → spot + pool → "Mostrar onde está"
  const subject = round.ids[0];
  await press(session, page.locator(`.hos-item[data-target="${subject}"]`));
  const banners = [];
  for (let i = 0; i < 3; i += 1) {
    await press(session, page.locator(".hos-hint-button"));
    await settle(page);
    banners.push(await page.locator(".hos-hint-banner").textContent());
  }
  const station = ROOM[OBSERVATORY].stations.find((s) => s.id === target(OBSERVATORY, subject).station);
  check(
    "D17_HINT_LADDER_IN_THE_OBSERVATORY",
    banners[0] === `Pista: procure ${station.hintPhrase}.` && banners[1] === `Pista: procure ${target(OBSERVATORY, subject).hintRegion}.` && banners[2] === `Aqui está: ${target(OBSERVATORY, subject).label}.`,
    { banners },
  );
  const found = await find(session, OBSERVATORY, subject);
  const tag = await page.locator(".hos-found-tag").textContent().catch(() => null);
  check("D18_A_FIND_SAYS_ITS_NAME", found && tag === target(OBSERVATORY, subject).label, { tag });
  await witness(page, "ms-desktop-found", 200);
  // everything else, the closing card, the result
  const finished = await finishRound(session, OBSERVATORY);
  const saved = (await storedResults(page))[0];
  check("D19_COMPLETION_AND_CLOSING_CARD", finished.missed.length === 0 && finished.card === "Observatório explorado", finished);
  check(
    "D20_RESULT_RECORDS_ROOM_AND_ROUND",
    saved?.gameId === "hidden-objects" && saved.score === 5 && same(saved.details, { difficulty: "easy", foundObjects: 5, totalObjects: 5, completed: true, sceneId: OBSERVATORY, roundSeed: seeds[1] }) && saved.continuation === undefined,
    { saved },
  );
  check("D21_RESULT_SCREEN_THROUGH_THE_SHARED_MODAL", finished.modal.world === "Estúdio das Descobertas" && finished.modal.summary === "Você encontrou todos os objetos do Observatório.", finished.modal);
  await witness(page, "ms-desktop-result", 400);
  // "Praticar outra vez": the same room, a new round
  await press(session, page.getByRole("button", { name: "Praticar este desafio outra vez" }));
  await page.waitForFunction(() => !document.querySelector(".wtx-shell"), null, { timeout: 30000 });
  await page.waitForSelector(".pgi-cta", { state: "visible" });
  await press(session, page.locator(".pgi-cta"));
  await page.waitForSelector(".hos-setup", { state: "visible" });
  const again = await sceneOptions(page);
  check("D22_PRACTICE_AGAIN_KEEPS_THE_ROOM", again.find((o) => o.checked)?.id === OBSERVATORY && (await shell(page)).scene === OBSERVATORY, { again });
  const second = await explore(session, "Fácil");
  check("D23_PRACTICE_AGAIN_DRAWS_A_NEW_ROUND", isDrawn(second, OBSERVATORY, "easy", seeds[2]) && !same(sorted(second.ids), sorted(round.ids)), { second, first: round.ids });
  // "Trocar de cena" → the Estúdio, a new exploration there
  await press(session, page.getByRole("button", { name: "Trocar de cena" }));
  await page.waitForSelector(".hos-setup", { state: "visible" });
  await chooseRoom(session, STUDIO);
  const studioAgain = await explore(session, "Fácil");
  check("D24_CHANGE_ROOM_IS_A_NEW_EXPLORATION_THERE", isDrawn(studioAgain, STUDIO, "easy", seeds[3]) && (await progress(page)).found === 0, { studioAgain });
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: mobile portrait ------------------------------------------------------------------------------

async function mobile() {
  current = "ms-mobile";
  const seeds = SEEDS[current];
  const session = await openSession({ width: 390, height: 844, touch: true, seeds });
  const { page } = session;
  await enterGame03(session);
  check("P01_SETUP_FITS_WITHOUT_PAGE_OVERFLOW", (await overflow(page)) <= 0, { overflow: await overflow(page) });
  await chooseRoom(session, OBSERVATORY);
  const exploreBox = await page.getByRole("button", { name: "Explorar", exact: true }).boundingBox();
  check("P02_EXPLORAR_IN_REACH", exploreBox && exploreBox.y + exploreBox.height <= 844, { exploreBox });
  await witness(page, "ms-mobile-setup");
  const round = await explore(session, "Difícil");
  check("P03_ROUND_IS_ITS_SEED", isDrawn(round, OBSERVATORY, "hard", seeds[0]), { round, drawn: drawn(OBSERVATORY, "hard", seeds[0]) });
  metrics.rounds["mobile observatory hard"] = round;
  let cam = await camera(page);
  const centre = { x: cam.left + cam.width / 2, y: cam.top + cam.height / 2 };
  const commitsBefore = await page.evaluate(() => window.__probe.commits);
  await drag(session, centre, { x: centre.x - 120, y: centre.y + 20 }, 16);
  metrics.performance.mobileDragCommits = (await page.evaluate(() => window.__probe.commits)) - commitsBefore;
  await settle(page);
  const dragged = await camera(page);
  check("P04_TOUCH_DRAG_PANS", Math.abs(dragged.tx - cam.tx) > 60, { before: cam.tx, after: dragged.tx });
  cam = dragged;
  await pinch(session, centre, 60, 220);
  await settle(page);
  const pinched = await camera(page);
  check("P05_PINCH_ZOOMS", pinched.s > cam.s * 1.3, { before: cam.s, after: pinched.s });
  const tray = await page.evaluate(() => ({
    items: document.querySelectorAll(".hos-item").length,
    clues: [...document.querySelectorAll(".hos-item .hos-item-label")].map((l) => l.textContent),
    listShown: !document.querySelector(".hos-list")?.hidden,
  }));
  check("P06_TRAY_LISTS_THE_CLUES", tray.items === 8 && tray.listShown && tray.clues.every((c, i) => c === target(OBSERVATORY, round.ids[i]).clue), tray);
  await press(session, page.locator(".hos-tray-toggle"));
  const folded = await page.evaluate(() => ({ hidden: document.querySelector(".hos-list")?.hidden, tray: document.querySelector(".hos-shell")?.dataset.tray }));
  await press(session, page.locator(".hos-tray-toggle"));
  check("P07_TRAY_FOLDS_AND_UNFOLDS", folded.hidden === true && folded.tray === "closed" && (await page.evaluate(() => document.querySelector(".hos-shell")?.dataset.tray)) === "open", folded);
  await press(session, page.locator(`.hos-item[data-target="${round.ids[0]}"]`));
  await press(session, page.locator(".hos-hint-button"));
  await settle(page);
  await press(session, page.locator(".hos-hint-button"));
  await settle(page);
  const banner = await page.locator(".hos-hint-banner").textContent();
  check("P08_HARD_HINTS_STOP_AT_CONTEXT", banner === `Pista: está ${target(OBSERVATORY, round.ids[0]).hintContext}.` && (await page.locator(".hos-halo").count()) === 0, { banner });
  await witness(page, "ms-mobile-hint");
  const found = await find(session, OBSERVATORY, round.ids[0]);
  const feedback = await page.evaluate(() => ({ tag: document.querySelector(".hos-found-tag")?.textContent ?? null, seal: Boolean(document.querySelector(".hos-found-seal")) }));
  check("P09_FOUND_FEEDBACK", found && feedback.tag === target(OBSERVATORY, round.ids[0]).label && feedback.seal, feedback);
  const finished = await finishRound(session, OBSERVATORY);
  const saved = (await storedResults(page))[0];
  check("P10_COMPLETION_AND_RESULT", finished.missed.length === 0 && saved?.details.sceneId === OBSERVATORY && saved.details.roundSeed === seeds[0] && saved.score === 8, { finished, saved: saved?.details });
  check("P11_NO_HORIZONTAL_OVERFLOW", (await overflow(page)) <= 0, { overflow: await overflow(page) });
  await witness(page, "ms-mobile-result", 300);
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: mobile landscape -----------------------------------------------------------------------------

async function landscape() {
  current = "ms-landscape";
  const seeds = SEEDS[current];
  const session = await openSession({ width: 844, height: 390, touch: true, seeds });
  const { page } = session;
  await enterGame03(session);
  await chooseRoom(session, OBSERVATORY);
  const exploreBox = await page.getByRole("button", { name: "Explorar", exact: true }).boundingBox();
  check("L01_EXPLORAR_IN_REACH_WITHOUT_SCROLLING", exploreBox && exploreBox.y >= 0 && exploreBox.y + exploreBox.height <= 390, { exploreBox });
  await witness(page, "ms-landscape-setup");
  const round = await explore(session, "Médio");
  check("L02_ROUND_IS_ITS_SEED", isDrawn(round, OBSERVATORY, "medium", seeds[0]), { round, drawn: drawn(OBSERVATORY, "medium", seeds[0]) });
  metrics.rounds["landscape observatory medium"] = round;
  const visited = [];
  for (const station of ROOM[OBSERVATORY].stations) {
    await press(session, page.locator(".hos-station", { hasText: station.label }));
    await settle(page);
    visited.push(Math.round(viewCentre(await camera(page)).x));
  }
  check("L03_REGION_NAVIGATION", visited[0] < visited[1] && visited[1] < visited[2], { visited });
  let cam = await camera(page);
  const centre = { x: cam.left + cam.width / 2, y: cam.top + cam.height / 2 };
  await pinch(session, centre, 50, 170);
  await settle(page);
  const pinched = await camera(page);
  await drag(session, centre, { x: centre.x + 100, y: centre.y });
  await settle(page);
  const dragged = await camera(page);
  check("L04_PINCH_AND_DRAG", pinched.s > cam.s && Math.abs(dragged.tx - pinched.tx) > 40, { scales: [cam.s, pinched.s], tx: [pinched.tx, dragged.tx] });
  await find(session, OBSERVATORY, round.ids[0]);
  const mid = { round: await roundOnScreen(page), progress: await progress(page) };
  // the phone turned upright mid-round, and back
  await page.setViewportSize({ width: 390, height: 844 });
  await settle(page);
  const upright = { round: await roundOnScreen(page), progress: await progress(page) };
  await page.setViewportSize({ width: 844, height: 390 });
  await settle(page);
  const backAgain = { round: await roundOnScreen(page), progress: await progress(page) };
  check(
    "L05_ROTATION_KEEPS_THE_ROUND",
    [upright, backAgain].every((s) => same(s.round, mid.round) && s.progress.found === mid.progress.found) && mid.progress.found === 1,
    { mid, upright, backAgain },
  );
  const finished = await finishRound(session, OBSERVATORY);
  const saved = (await storedResults(page))[0];
  check("L06_RESULT", finished.missed.length === 0 && saved?.details.sceneId === OBSERVATORY && saved.details.roundSeed === seeds[0], { saved: saved?.details });
  check("L07_NO_HORIZONTAL_OVERFLOW", (await overflow(page)) <= 0);
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: reduced motion ---------------------------------------------------------------------------------

async function reducedMotion() {
  current = "ms-reduced-motion";
  const seeds = SEEDS[current];
  const session = await openSession({ width: 1440, height: 900, reducedMotion: "reduce", seeds });
  const { page } = session;
  await enterGame03(session);
  await chooseRoom(session, OBSERVATORY);
  const round = await explore(session, "Fácil");
  check("R01_ROUND_IS_ITS_SEED", isDrawn(round, OBSERVATORY, "easy", seeds[0]), { round });
  await page.evaluate(() => {
    window.__probe.movingMarks = 0;
    const world = document.querySelector(".hos-world");
    new MutationObserver(() => {
      if (world.dataset.moving === "true") window.__probe.movingMarks += 1;
    }).observe(world, { attributes: true, attributeFilter: ["data-moving"] });
  });
  const arquivo = ROOM[OBSERVATORY].stations.at(-1);
  await press(session, page.locator(".hos-station", { hasText: arquivo.label }));
  await frames(page, 2);
  const cut = await camera(page);
  const halfW = cut.width / (2 * cut.s);
  const expectedX = Math.min(Math.max(arquivo.center.x, halfW), ROOM[OBSERVATORY].width - halfW);
  const movingMarks = await page.evaluate(() => window.__probe.movingMarks);
  check("R02_STATION_CUTS_INSTANTLY", Math.abs(viewCentre(cut).x - expectedX) < 1 && movingMarks === 0, { centre: viewCentre(cut), expectedX, movingMarks });
  await press(session, page.locator(`.hos-item[data-target="${round.ids[0]}"]`));
  await press(session, page.locator(".hos-hint-button"));
  await press(session, page.locator(".hos-hint-button"));
  await page.waitForTimeout(100);
  const halo = await page.evaluate(() => {
    const element = document.querySelector(".hos-halo");
    return element ? { animation: getComputedStyle(element).animationName, timing: getComputedStyle(element).animationTimingFunction } : null;
  });
  check("R03_HALO_WITHOUT_FADES", halo?.animation === "hos-halo-life-still" && /steps/.test(halo.timing), { halo });
  const drifting = ROOM[OBSERVATORY].layers.filter((l) => l.parallax !== 1).map((l) => l.id);
  const parallax = await page.evaluate((ids) => ids.map((id) => document.querySelector(`.hos-layer-${id}`)?.style.transform ?? null), drifting);
  check("R04_NO_PARALLAX_ON_ANY_DRIFTING_LAYER", parallax.length === 4 && parallax.every((t) => /translate3d\(0px, 0px, 0px\)/.test(t ?? "")), { drifting, parallax });
  await find(session, OBSERVATORY, round.ids[0]);
  const feedback = await page.evaluate(() => {
    const read = (selector) => {
      const element = document.querySelector(selector);
      return element ? { animation: getComputedStyle(element).animationName, timing: getComputedStyle(element).animationTimingFunction } : null;
    };
    return { ring: read(".hos-found-ring"), tag: read(".hos-found-tag"), glow: read('.hos-found[data-fresh="true"] .hos-found-glow') };
  });
  check("R05_FOUND_FEEDBACK_WITHOUT_MOTION", /steps/.test(feedback.ring?.timing ?? "") && /steps/.test(feedback.tag?.timing ?? "") && (feedback.glow?.animation ?? "none") === "none", feedback);
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: round isolation ----------------------------------------------------------------------------------

async function isolation() {
  current = "ms-isolation";
  const seeds = SEEDS[current];
  const session = await openSession({ width: 1440, height: 900, seeds });
  const { page } = session;
  await enterGame03(session);
  const studio = await explore(session, "Médio");
  await find(session, STUDIO, studio.ids[0]);
  check("I01_THE_SEED_IN_THE_STUDIO", isDrawn(studio, STUDIO, "medium", seeds[0]), { studio, drawn: drawn(STUDIO, "medium", seeds[0]) });
  // leave without a result, and come back from the Home: a new entry
  await press(session, page.getByRole("button", { name: "Voltar à jornada" }));
  await page.waitForSelector(".hj-world-enter", { timeout: 15000 });
  await press(session, page.locator(".hj-world-enter"));
  await page.waitForFunction(() => !document.querySelector(".wtx-shell"), null, { timeout: 30000 });
  await page.waitForSelector(".pgi-cta", { state: "visible" });
  await press(session, page.locator(".pgi-cta"));
  await page.waitForSelector(".hos-setup", { state: "visible" });
  const fresh = { shell: await shell(page), items: await page.locator(".hos-item").count(), found: (await progress(page)).found };
  check("I02_REENTRY_LEAKS_NOTHING", fresh.shell.status === "setup" && fresh.shell.seed === null && fresh.items === 0 && fresh.found === 0, fresh);
  await chooseRoom(session, OBSERVATORY);
  const observatory = await explore(session, "Médio");
  check("I03_THE_SAME_SEED_IN_THE_OBSERVATORY", isDrawn(observatory, OBSERVATORY, "medium", seeds[1]) && seeds[0] === seeds[1], { observatory, drawn: drawn(OBSERVATORY, "medium", seeds[1]) });
  check("I04_NO_OBJECT_OF_THE_OTHER_ROOM", !observatory.ids.some((id) => ROOM[STUDIO].pool.some((t) => t.id === id)) && (await progress(page)).found === 0, { observatory: observatory.ids, studio: studio.ids });
  check("I05_NOTHING_SAVED", (await storedResults(page)).length === 0);
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: payload ----------------------------------------------------------------------------------------------

/** The bytes of a served path, read from the build or public/ (the files the server sends). */
function servedBytes(url) {
  const clean = url.split("?")[0];
  const file = clean.startsWith("/_next/") ? path.join(BUILD, clean.replace(/^\/_next\//, "")) : path.join("public", clean);
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) return null;
  const buffer = fs.readFileSync(file);
  return { raw: buffer.length, gzip: /\.(js|css)$/.test(clean) ? zlib.gzipSync(buffer, { level: 9 }).length : buffer.length };
}
function tally(urls) {
  const groups = { js: [], css: [], art: [] };
  for (const url of [...new Set(urls)]) {
    if (/\.js$/.test(url)) groups.js.push(url);
    else if (/\.css$/.test(url)) groups.css.push(url);
    else if (/\.(webp|png|jpe?g|svg)$/.test(url)) groups.art.push(url);
  }
  const sum = (list) => list.reduce((acc, url) => {
    const bytes = servedBytes(url);
    return bytes ? { files: acc.files + 1, raw: acc.raw + bytes.raw, gzip: acc.gzip + bytes.gzip } : acc;
  }, { files: 0, raw: 0, gzip: 0 });
  return { js: sum(groups.js), css: sum(groups.css), art: sum(groups.art), artFiles: groups.art };
}

async function payload() {
  current = "ms-payload";
  const seeds = SEEDS[current];
  const session = await openSession({ width: 1440, height: 900, seeds });
  const { page } = session;
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  const home = [...session.requests];
  await page.waitForFunction(() => (window.__probe?.commits ?? 0) >= 1, null, { timeout: 60000 });
  await press(session, page.locator(".hj-gallery-pips").getByRole("button", { name: "Selecionar Estúdio das Descobertas" }));
  await page.waitForTimeout(400);
  const homeAll = [...session.requests];
  await press(session, page.locator(".hj-world-enter"));
  await page.waitForFunction(() => !document.querySelector(".wtx-shell"), null, { timeout: 30000 });
  await page.waitForSelector(".pgi-cta", { state: "visible" });
  await press(session, page.locator(".pgi-cta"));
  await page.waitForSelector(".hos-setup", { state: "visible" });
  await page.waitForLoadState("networkidle");
  const setup = session.requests.slice(homeAll.length);
  const hasRooms = (await page.locator('input[name="hos-scene"]').count()) > 0;
  await explore(session, "Fácil");
  await page.waitForLoadState("networkidle");
  const studioRound = session.requests.slice(homeAll.length);
  let observatory = [];
  if (hasRooms) {
    const before = session.requests.length;
    await press(session, page.getByRole("button", { name: "Trocar de cena" }));
    await page.waitForSelector(".hos-setup", { state: "visible" });
    await chooseRoom(session, OBSERVATORY);
    await explore(session, "Fácil");
    await page.waitForLoadState("networkidle");
    observatory = session.requests.slice(before);
  }
  metrics.payload = {
    homeInitial: tally(home),
    homeIncludingGame03Selection: tally(homeAll),
    game03EntryAndSetup: tally(setup),
    studioRoundSinceEntry: tally(studioRound),
    observatoryChosenLater: tally(observatory),
  };
  const homeGame03 = homeAll.filter((url) => url.startsWith("/assets/hidden-objects/"));
  check("Y01_THE_HOME_FETCHES_NO_GAME03_ROOM_ART", homeGame03.length === 0, { homeGame03 });
  const setupArt = metrics.payload.game03EntryAndSetup.artFiles;
  const studioPrefix = "/assets/hidden-objects/explorer-studio/";
  const obsPrefix = "/assets/hidden-objects/explorer-observatory/";
  check(
    "Y02_SETUP_FETCHES_ONE_ROOM_AND_THE_OTHERS_PREVIEW",
    !hasRooms || (setupArt.some((url) => url.startsWith(studioPrefix)) && setupArt.filter((url) => url.startsWith(obsPrefix)).every((url) => url === ROOM[OBSERVATORY].preview)),
    { setupArt },
  );
  check(
    "Y03_THE_OBSERVATORYS_PAYLOAD_ARRIVES_WITH_IT",
    !hasRooms || ROOM[OBSERVATORY].layers.every((l) => observatory.includes(l.src)),
    { observatory: metrics.payload.observatoryChosenLater },
  );
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- run ---------------------------------------------------------------------------------------------------------

const runners = {
  "ms-desktop": desktop,
  "ms-mobile": mobile,
  "ms-landscape": landscape,
  "ms-reduced-motion": reducedMotion,
  "ms-isolation": isolation,
  "ms-payload": payload,
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
console.log(failed.length ? "HIDDEN_OBJECTS_MULTISCENE_PROBE_FAILED" : "HIDDEN_OBJECTS_MULTISCENE_PROBE_OK");
process.exit(failed.length ? EXIT_FAILED : EXIT_OK);
