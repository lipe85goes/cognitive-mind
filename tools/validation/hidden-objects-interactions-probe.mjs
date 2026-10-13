/**
 * GAME03-INTERACTIONS-04 — browser probe for the rooms' movable pieces.
 *
 * Drives the PRODUCTION build (`next build && next start`) the way a person
 * would, and reads only what the page shows (DOM, the world element's
 * transform, computed styles, localStorage). Nothing in the product is
 * instrumented: every round's seed is planted in the platform's random source
 * (`crypto.getRandomValues`) and what the page shows is held to what the source
 * draws (rounds, clues, the rooms' pieces and what they keep). React commits are
 * counted through the DevTools hook React itself calls (a counter, nothing else).
 *
 * Scenarios (all by default; pick with --scenario a,b — each runs alone, from
 * the Home, in a fresh browser context):
 *   int-desktop-studio      1440×900, mouse: a Fácil round that lists an object kept in a piece; pan and
 *                           zoom; the piece shut, the object unfindable; a tap opens it, the object is found;
 *                           "Recomeçar" keeps the round and its clues and shuts the piece
 *   int-desktop-observatory 1440×900, mouse: the door, the drawer and the curtain; Médio's hints on a kept
 *                           object (words, no light, nothing opened); Difícil's (context, no light, nothing
 *                           framed or opened); a Difícil round played to the end and its result
 *   int-mobile-portrait     390×844, touch: a tap opens a piece and the camera stays; drag and pinch never
 *                           move a piece; the kept object found; the tray; no horizontal overflow
 *   int-mobile-landscape    844×390, touch: a piece opened, the phone turned upright and back mid-round —
 *                           the piece and the round hold; the search goes on
 *   int-reduced-motion      prefers-reduced-motion: every piece changes state at once (no transition), same states
 *   int-keyboard            Tab reaches each piece's button (a visible chip, an outline in the room); Enter and
 *                           Space step it; aria-expanded and the live region follow
 *   int-easy-help           Fácil's last rung rings the shut piece and says what to open; nothing opens by itself
 *   int-round-isolation     the same room, difficulty and seed in two fresh visits draw the same round, and
 *                           both start with every piece shut; a new exploration starts shut too
 *
 * Usage:
 *   node tools/validation/hidden-objects-interactions-probe.mjs [--base http://localhost:3100]
 *        [--build .next] [--scenario NAME[,NAME…]] [--out DIR] [--json FILE]
 *
 * Playwright: `import("playwright")`, or set PLAYWRIGHT_DIR to a node_modules directory that has it.
 * Exit: 0 every scenario held · 1 a check failed · 3 usage / setup error.
 */
import fs from "node:fs";
import path from "node:path";
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
const ALL = ["int-desktop-studio", "int-desktop-observatory", "int-mobile-portrait", "int-mobile-landscape", "int-reduced-motion", "int-keyboard", "int-easy-help", "int-round-isolation"];
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

// --- what the source says a round lists and tells (never restated here) ----------------------------------

const SOURCE = createModuleGraph({ mocks: {}, globals: {} });
const REGISTRY = SOURCE.require("src/games/hidden-objects/hidden-objects-scenes.ts");
const ROUNDS = SOURCE.require("src/games/hidden-objects/hidden-objects-rounds.ts");
const CONTRACT = SOURCE.require("src/games/hidden-objects/hidden-objects-scene.ts");
const ROOM = Object.fromEntries(REGISTRY.SCENES.map((scene) => [scene.id, scene]));
const STUDIO = "explorer-studio";
const OBSERVATORY = "explorer-observatory";
const LEVEL = { easy: "Fácil", medium: "Médio", hard: "Difícil" };
const STORAGE_KEY = /const STORAGE_KEY = "([^"]+)"/.exec(fs.readFileSync("src/engine/storage.ts", "utf8"))[1];
const target = (roomId, id) => ROOM[roomId].pool.find((t) => t.id === id);
const drawn = (roomId, difficulty, seed) => ROUNDS.selectRoundTargets(ROOM[roomId], difficulty, seed);
const centreOf = (region) => (region.kind === "rect" ? { x: region.x + region.w / 2, y: region.y + region.h / 2 } : { x: region.cx, y: region.cy });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fold = (text) => (text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Whether `text` says the name of any of `ids` (label or accessible label). */
const namesAny = (roomId, ids, text) => ids.filter((id) => [target(roomId, id).label, target(roomId, id).accessibleLabel].some((name) => fold(text).includes(fold(name))));

if (!same(CONTRACT.DIFFICULTY_ORDER, ["easy", "medium", "hard"])) {
  console.error("the difficulty order is not Fácil, Médio, Difícil");
  process.exit(EXIT_USAGE);
}

// --- results ----------------------------------------------------------------------------------------------

const results = [];
const metrics = { rounds: {} };
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

// --- in-page: the platform's random source, deterministic for one page -------------------------------------

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

/** React's own DevTools hook, reduced to a counter of commits (React calls it in production builds too). */
function countCommits() {
  let commits = 0;
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers: new Map(),
    inject: () => 1,
    checkDCE: () => {},
    onScheduleFiberRoot: () => {},
    onCommitFiberRoot: () => {
      commits += 1;
    },
    onCommitFiberUnmount: () => {},
    onPostCommitFiberRoot: () => {},
  };
  Object.defineProperty(window, "__probeCommits", { configurable: true, get: () => commits });
}

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--use-gl=angle", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });

async function openSession({ width, height, touch = false, reducedMotion = "no-preference", seeds = [] }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, reducedMotion });
  await context.addInitScript(plantSeeds, seeds);
  await context.addInitScript(countCommits);
  const page = await context.newPage();
  const session = { context, page, errors: [], touch, cdp: null };
  page.on("pageerror", (error) => session.errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") session.errors.push(`console: ${message.text()}`);
  });
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

// --- reading the game ----------------------------------------------------------------------------------------

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
const sameCamera = (a, b) => a && b && Math.abs(a.tx - b.tx) < 0.5 && Math.abs(a.ty - b.ty) < 0.5 && Math.abs(a.s - b.s) < 1e-4;
const toScreen = (cam, p) => ({ x: cam.left + cam.tx + p.x * cam.s, y: cam.top + cam.ty + p.y * cam.s });
/** Whether the camera holds the object's box, large, in the middle of the view: what framing it would look like. */
function framesObject(cam, roomId, id) {
  const r = target(roomId, id).region;
  const box = r.kind === "rect" ? r : { x: r.cx - r.r, y: r.cy - r.r, w: 2 * r.r, h: 2 * r.r };
  const a = toScreen(cam, { x: box.x, y: box.y });
  const centre = { x: a.x + (box.w * cam.s) / 2, y: a.y + (box.h * cam.s) / 2 };
  const middle = Math.abs(centre.x - (cam.left + cam.width / 2)) < cam.width * 0.08 && Math.abs(centre.y - (cam.top + cam.height / 2)) < cam.height * 0.08;
  return middle && box.w * cam.s > cam.width * 0.18;
}
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
async function roundOnScreen(page) {
  const round = await page.evaluate(() => ({
    scene: document.querySelector(".hos-shell")?.dataset.scene ?? null,
    seed: document.querySelector(".hos-shell")?.dataset.roundSeed ?? null,
    ids: [...document.querySelectorAll(".hos-item")].map((item) => item.dataset.target ?? null),
  }));
  return { ...round, seed: round.seed === null ? null : Number(round.seed) };
}
/** The list as the page shows it: each line's text, its accessible name, whether it shows a picture. */
const listOnScreen = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll(".hos-item")].map((item) => {
      const label = item.querySelector(".hos-item-label");
      const answered = label?.querySelector(".hos-item-answered")?.textContent ?? null;
      const whole = label?.textContent ?? "";
      return {
        id: item.dataset.target,
        found: item.dataset.found === "true",
        text: answered === null ? whole : whole.slice(0, whole.length - answered.length),
        answered,
        aria: item.getAttribute("aria-label"),
        picture: Boolean(item.querySelector(".hos-item-art img")),
        // the whole clue shows inside its line or card: nothing clipped either way
        fits: label ? label.scrollWidth <= label.clientWidth + 1 && label.scrollHeight <= label.clientHeight + 1 : false,
        right: item.getBoundingClientRect().right,
      };
    }),
  );
const ui = (page) =>
  page.evaluate(() => ({
    banner: document.querySelector(".hos-hint-banner")?.textContent ?? null,
    button: document.querySelector(".hos-hint-button")?.textContent ?? null,
    halo: document.querySelector(".hos-halo") ? [...document.querySelector(".hos-halo").classList].find((c) => /^hos-halo-(hint|reveal)$/.test(c)) ?? "halo" : null,
    live: document.querySelector('[aria-live="polite"]')?.textContent ?? "",
  }));
const progress = (page) =>
  page.evaluate(() => {
    const bar = document.querySelector(".hos-progress");
    return bar ? { found: Number(bar.getAttribute("aria-valuenow")), total: Number(bar.getAttribute("aria-valuemax")) } : null;
  });
const storedResults = (page) => page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "[]"), STORAGE_KEY);
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
async function comfortable(page, cam, point) {
  const zoom = await page.evaluate(() => document.querySelector(".hos-zoom")?.getBoundingClientRect().toJSON());
  const panel = await page.evaluate(() => {
    const element = document.querySelector(".hos-panel");
    const list = document.querySelector(".hos-list");
    return element && list && !list.hidden ? element.getBoundingClientRect().toJSON() : null;
  });
  const margin = 40;
  const inside = point.x > cam.left + margin && point.x < cam.left + cam.width - margin && point.y > cam.top + margin && point.y < cam.top + cam.height - margin;
  const under = (box) => box && point.x > box.left - 24 && point.x < box.right + 24 && point.y > box.top - 24 && point.y < box.bottom + 24;
  return inside && !under(zoom) && !under(panel);
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
  await press(session, page.locator(".hj-gallery-pips").getByRole("button", { name: "Selecionar Estúdio das Descobertas" }));
  await page.waitForFunction(() => document.querySelector(".hj-world-selected .hj-world-copy strong")?.textContent === "Estúdio das Descobertas");
  await press(session, page.locator(".hj-world-enter"));
  await page.waitForSelector(".wtx-shell", { timeout: 5000 });
  await page.waitForFunction(() => !document.querySelector(".wtx-shell"), null, { timeout: 30000 });
  await page.waitForSelector(".pgi-cta", { state: "visible" });
  await press(session, page.locator(".pgi-cta"));
  await page.waitForSelector(".hos-setup", { state: "visible" });
}
/** In the setup: pick a room (and wait until its art has painted: "Explorar" enabled again). */
async function chooseRoom(session, roomId) {
  const { page } = session;
  if ((await page.evaluate(() => document.querySelector(".hos-shell")?.dataset.scene)) !== roomId) {
    await press(session, page.locator(".hos-scene-option", { hasText: ROOM[roomId].name }));
    await page.waitForFunction((id) => document.querySelector(".hos-shell")?.dataset.scene === id, roomId);
  }
  await page.waitForFunction(() => {
    const button = [...document.querySelectorAll(".hos-setup .hos-primary")][0];
    return button && !button.disabled && /Explorar/.test(button.textContent);
  }, null, { timeout: 30000 });
}
async function explore(session, difficulty) {
  const { page } = session;
  await press(session, page.locator(".hos-difficulty-option", { hasText: LEVEL[difficulty] }));
  await press(session, page.getByRole("button", { name: "Explorar", exact: true }));
  await page.waitForFunction(() => document.querySelector(".hos-shell")?.dataset.status === "playing");
  await settle(page);
  return roundOnScreen(page);
}
/** "Trocar de cena": back to the setup, nothing saved. */
async function backToSetup(session) {
  await press(session, session.page.getByRole("button", { name: "Trocar de cena" }));
  await session.page.waitForSelector(".hos-setup", { state: "visible" });
}
async function showList(session) {
  const open = await session.page.evaluate(() => !document.querySelector(".hos-list")?.hidden);
  if (!open) await press(session, session.page.locator(".hos-tray-toggle"));
}
async function hideList(session) {
  const open = await session.page.evaluate(() => !document.querySelector(".hos-list")?.hidden);
  if (open && (await session.page.locator(".hos-tray-toggle").isVisible())) await press(session, session.page.locator(".hos-tray-toggle"));
}
async function focusLine(session, id) {
  await showList(session);
  await press(session, session.page.locator(`.hos-item[data-target="${id}"]`));
}
async function hint(session) {
  await press(session, session.page.locator(".hos-hint-button"));
  await settle(session.page);
  return { ...(await ui(session.page)), camera: await camera(session.page) };
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
  for (let attempt = 0; attempt < 2 && !(await comfortable(page, cam, point)); attempt += 1) {
    const centre = { x: cam.left + cam.width / 2, y: cam.top + cam.height / 2 };
    await drag(session, centre, { x: centre.x + (centre.x - point.x), y: centre.y + (centre.y - point.y) });
    await settle(page);
    cam = await camera(page);
    point = toScreen(cam, centreOf(t.region));
  }
  return point;
}
/**
 * GAME03-INTERACTIONS-04 (restated find): an object kept behind a room piece is
 * found the way the Explorador finds it — its piece opened first, with a tap
 * where the piece is (its station, then a drag if it is not comfortably on screen).
 */
async function openPieceFor(session, pieces, gate, stationLabel) {
  const { page } = session;
  if (!gate) return;
  const shown = await page.evaluate((id) => document.querySelector(`.hos-piece[data-piece="${id}"]`)?.dataset ?? null, gate);
  if (!shown || shown.open === "true") return;
  const piece = pieces.find((p) => p.id === gate);
  const { hit } = piece.states.find((s) => s.id === shown.state);
  const spot = { x: hit.x + hit.w / 2, y: hit.y + hit.h / 2 };
  await press(session, page.locator(".hos-station", { hasText: stationLabel }).first());
  await settle(page);
  let cam = await camera(page);
  let point = toScreen(cam, spot);
  if (!(await comfortable(page, cam, point))) {
    const centre = { x: cam.left + cam.width / 2, y: cam.top + cam.height / 2 };
    await drag(session, centre, { x: centre.x + (centre.x - point.x), y: centre.y + (centre.y - point.y) });
    await settle(page);
    cam = await camera(page);
    point = toScreen(cam, spot);
  }
  await tapAt(session, point);
  await page.waitForFunction((id) => document.querySelector(`.hos-piece[data-piece="${id}"]`)?.dataset.open === "true", gate, { timeout: 4000 }).catch(() => {});
  await settle(page);
}

async function find(session, roomId, id) {
  const before = await progress(session.page);
  {
    const t = target(roomId, id);
    await openPieceFor(session, ROOM[roomId].interactables ?? [], t.gate, ROOM[roomId].stations.find((s) => s.id === t.station).label);
  }
  await hideList(session);
  const point = await bringIntoView(session, roomId, id);
  await tapAt(session, point);
  await session.page.waitForFunction((n) => Number(document.querySelector(".hos-progress")?.getAttribute("aria-valuenow")) > n, before.found, { timeout: 4000 }).catch(() => {});
  return (await progress(session.page)).found > before.found;
}
async function finishRound(session, roomId) {
  const { page } = session;
  const round = await roundOnScreen(page);
  const missed = [];
  for (const id of round.ids) {
    const found = await page.evaluate((t) => document.querySelector(`.hos-item[data-target="${t}"]`)?.dataset.found === "true", id);
    if (!found && !(await find(session, roomId, id))) missed.push(id);
  }
  await page.waitForSelector(".hos-overlay-complete", { timeout: 6000 });
  await press(session, page.locator(".hos-overlay-complete .hos-primary"));
  await page.waitForSelector(".prm-card", { timeout: 6000 });
  return { missed };
}

// --- the pieces, as the source says them and the page shows them ---------------------------------------------

const piecesOf = (roomId) => ROOM[roomId].interactables;
const piece = (roomId, id) => piecesOf(roomId).find((p) => p.id === id);
const gatedOf = (roomId) => ROOM[roomId].pool.filter((t) => t.gate);
const hitCentre = (hit) => ({ x: hit.x + hit.w / 2, y: hit.y + hit.h / 2 });
/** The first seed (from 9001 up) whose round in (room, difficulty) satisfies `predicate(ids)`. */
function seedWhere(roomId, difficulty, predicate) {
  for (let seed = 9001; seed < 400000; seed += 1) if (predicate(drawn(roomId, difficulty, seed))) return seed;
  return null;
}
const pieceOnScreen = (page, id) =>
  page.evaluate((pieceId) => {
    const image = document.querySelector(`.hos-piece[data-piece="${pieceId}"]`);
    const button = document.querySelector(`.hos-piece-key[data-piece="${pieceId}"]`);
    if (!image) return null;
    const style = getComputedStyle(image);
    return {
      state: image.dataset.state,
      open: image.dataset.open === "true",
      transform: image.style.transform,
      computed: style.transform,
      transition: style.transitionDuration,
      expanded: button?.getAttribute("aria-expanded") ?? null,
      label: button?.getAttribute("aria-label") ?? null,
    };
  }, id);
const piecesOnScreen = async (page, roomId) => Object.fromEntries(await Promise.all(piecesOf(roomId).map(async (p) => [p.id, await pieceOnScreen(page, p.id)])));
const allShut = async (page, roomId) => Object.entries(await piecesOnScreen(page, roomId)).every(([id, v]) => v && v.state === piece(roomId, id).initial && !v.open && v.expanded === "false");
const commits = (page) => page.evaluate(() => window.__probeCommits ?? null);

/** A room point brought comfortably on screen (its station, then a drag): its screen position. */
async function bringSpot(session, roomId, stationId, spot) {
  const { page } = session;
  await hideList(session);
  const station = ROOM[roomId].stations.find((s) => s.id === stationId);
  await press(session, page.locator(".hos-station", { hasText: station.label }).first());
  await settle(page);
  let cam = await camera(page);
  let point = toScreen(cam, spot);
  for (let attempt = 0; attempt < 2 && !(await comfortable(page, cam, point)); attempt += 1) {
    const centre = { x: cam.left + cam.width / 2, y: cam.top + cam.height / 2 };
    await drag(session, centre, { x: centre.x + (centre.x - point.x), y: centre.y + (centre.y - point.y) });
    await settle(page);
    cam = await camera(page);
    point = toScreen(cam, spot);
  }
  return point;
}
/** A tap on a piece where it is now; what it became, and whether the camera moved under the tap. */
async function tapPiece(session, roomId, id) {
  const { page } = session;
  const before = await pieceOnScreen(page, id);
  const p = piece(roomId, id);
  const point = await bringSpot(session, roomId, p.station, hitCentre(p.states.find((s) => s.id === before.state).hit));
  const cam = await camera(page);
  const c0 = await commits(page);
  await tapAt(session, point);
  await page.waitForFunction(([pieceId, state]) => document.querySelector(`.hos-piece[data-piece="${pieceId}"]`)?.dataset.state !== state, [id, before.state], { timeout: 4000 }).catch(() => {});
  await settle(page);
  return { before, after: await pieceOnScreen(page, id), cameraStill: sameCamera(cam, await camera(page)), commits: (await commits(page)) - c0 };
}
/** A tap on an object's centre (whatever is in front of it): whether the count went up. */
async function tapObject(session, roomId, id) {
  const { page } = session;
  const before = await progress(page);
  const t = target(roomId, id);
  const point = await bringSpot(session, roomId, t.station, centreOf(t.region));
  await tapAt(session, point);
  await page.waitForFunction((n) => Number(document.querySelector(".hos-progress")?.getAttribute("aria-valuenow")) > n, before.found, { timeout: 2500 }).catch(() => {});
  return (await progress(page)).found > before.found;
}
const lineFound = (page, id) => page.evaluate((t) => document.querySelector(`.hos-item[data-target="${t}"]`)?.dataset.found === "true", id);

// --- scenario: desktop, the Estúdio ------------------------------------------------------------------------------

async function desktopStudio() {
  current = "int-desktop-studio";
  const kept = gatedOf(STUDIO)[0];
  const seed = seedWhere(STUDIO, "easy", (ids) => ids.includes(kept.id));
  const session = await openSession({ width: 1440, height: 900, seeds: [seed] });
  const { page } = session;
  await enterGame03(session);
  await chooseRoom(session, STUDIO);
  const round = await explore(session, "easy");
  check("ROUND_LISTS_A_KEPT_OBJECT", round.seed === seed && same(round.ids, drawn(STUDIO, "easy", seed)) && round.ids.includes(kept.id), { round, kept: kept.id });
  check("EVERY_PIECE_STARTS_SHUT", await allShut(page, STUDIO), { pieces: await piecesOnScreen(page, STUDIO) });
  await witness(page, "studio-default", 300);
  // one step of a piece, there and back: what an interaction costs React (and proof the counter counts)
  const other = piecesOf(STUDIO).find((p) => p.id !== kept.gate);
  const there = await tapPiece(session, STUDIO, other.id);
  const back = await tapPiece(session, STUDIO, other.id);
  metrics.interactionCommits = [there.commits, back.commits];
  check("ANOTHER_PIECE_STEPS_THERE_AND_BACK", there.after.open && !back.after.open && there.cameraStill && back.cameraStill, { there: there.after.state, back: back.after.state, commits: metrics.interactionCommits });
  // the camera as always: a drag pans, the wheel zooms; nothing opens
  const cam0 = await camera(page);
  const centre = { x: cam0.left + cam0.width / 2, y: cam0.top + cam0.height / 2 };
  const c0 = await commits(page);
  await drag(session, centre, { x: centre.x - 260, y: centre.y + 40 }, 24);
  await settle(page);
  const dragCommits = (await commits(page)) - c0;
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.wheel(0, -360);
  await settle(page);
  metrics.studioDragCommits = dragCommits;
  check("PAN_AND_ZOOM_MOVE_NO_PIECE", !sameCamera(cam0, await camera(page)) && (await allShut(page, STUDIO)), { dragCommits });
  // the counter is alive (a piece's step committed) and a whole drag commits at most a few times (settles, never per move)
  check("A_DRAG_IS_NOT_A_RENDER_LOOP", dragCommits <= 3 && there.commits >= 1, { dragCommits, pointerMoves: 24, interactionCommits: metrics.interactionCommits });
  // shut: the object is not there to be found
  const throughTheDrawer = await tapObject(session, STUDIO, kept.id);
  const afterTap = await pieceOnScreen(page, kept.gate);
  check("SHUT_PIECE_KEEPS_THE_OBJECT", !throughTheDrawer && !(await lineFound(page, kept.id)), { kept: kept.id, piece: afterTap });
  // that very tap reached the piece (the object's spot is the piece's): it is open now, or open it
  const opened = afterTap.open ? { after: afterTap, cameraStill: true, commits: null } : await tapPiece(session, STUDIO, kept.gate);
  check("A_TAP_OPENS_THE_PIECE", opened.after.open && opened.after.expanded === "true" && opened.cameraStill, opened);
  await witness(page, "studio-open", 700);
  const found = await tapObject(session, STUDIO, kept.id);
  check("OPEN_PIECE_EXPOSES_THE_OBJECT", found && (await lineFound(page, kept.id)), { kept: kept.id });
  await witness(page, "studio-revealed", 400);
  // Recomeçar: the same round, told the same way; the piece shut again
  await showList(session);
  const lines = await listOnScreen(page);
  await press(session, page.getByRole("button", { name: "Recomeçar a exploração" }));
  await settle(page);
  await showList(session);
  const again = await listOnScreen(page);
  const after = await roundOnScreen(page);
  check("RECOMECAR_KEEPS_THE_ROUND_AND_SHUTS_THE_PIECES", same(after, round) && same(again.map((l) => l.text), lines.map((l) => l.text)) && again.every((l) => !l.found) && (await allShut(page, STUDIO)), { before: round, after, pieces: await piecesOnScreen(page, STUDIO) });
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: desktop, the Observatório ---------------------------------------------------------------------

async function desktopObservatory() {
  current = "int-desktop-observatory";
  const kept = gatedOf(OBSERVATORY);
  const mediumSeed = seedWhere(OBSERVATORY, "medium", (ids) => ids.includes(kept[0].id));
  const hardSeed = seedWhere(OBSERVATORY, "hard", (ids) => ids.includes(kept[1].id) || ids.includes(kept[2].id));
  const session = await openSession({ width: 1440, height: 900, seeds: [mediumSeed, hardSeed] });
  const { page } = session;
  await enterGame03(session);
  await chooseRoom(session, OBSERVATORY);
  const medium = await explore(session, "medium");
  await witness(page, "observatory-default", 300);
  // every kind the room has: each opens with a tap and shuts with another
  const kinds = {};
  for (const p of piecesOf(OBSERVATORY)) {
    const open = await tapPiece(session, OBSERVATORY, p.id);
    kinds[p.kind] = { opens: open.after.open, cameraStill: open.cameraStill };
    if (p.id === piecesOf(OBSERVATORY).at(-1).id) await witness(page, "observatory-open", 700);
  }
  check("EVERY_KIND_OPENS", Object.values(kinds).every((k) => k.opens && k.cameraStill) && Object.keys(kinds).length === piecesOf(OBSERVATORY).length, { kinds });
  for (const p of piecesOf(OBSERVATORY)) await tapPiece(session, OBSERVATORY, p.id);
  check("EVERY_KIND_SHUTS_AGAIN", await allShut(page, OBSERVATORY), { pieces: await piecesOnScreen(page, OBSERVATORY) });
  // Médio: the hints on a kept object are words — no light, nothing opened, never framed
  const subject = medium.ids.includes(kept[0].id) ? kept[0] : null;
  await focusLine(session, subject.id);
  const ladder = [];
  for (let press_ = 0; press_ < 3; press_ += 1) ladder.push(await hint(session));
  check("MEDIO_HINTS_WORDS_ONLY", ladder.every((h) => !h.halo && !/Aqui está/.test(h.banner ?? "")) && (await allShut(page, OBSERVATORY)) && !framesObject(ladder[2].camera, OBSERVATORY, subject.id), { banners: ladder.map((h) => h.banner) });
  await witness(page, "observatory-medium-hint", 300);
  // the kept object, found the Explorador's way
  await tapPiece(session, OBSERVATORY, subject.gate);
  check("THE_KEPT_OBJECT_IS_FOUND_ONCE_OPEN", await tapObject(session, OBSERVATORY, subject.id), { subject: subject.id });
  await witness(page, "observatory-revealed", 400);
  // Difícil: context only, nothing lit, framed or opened; then the whole round, and its result
  await backToSetup(session);
  const hard = await explore(session, "hard");
  const hardKept = kept.find((t) => hard.ids.includes(t.id));
  await focusLine(session, hardKept.id);
  const hardLadder = [await hint(session), await hint(session), await hint(session)];
  // the piece's own name (its station is every difficulty's first rung: the room's place, not the piece)
  const stationWords = new Set(ROOM[OBSERVATORY].stations.flatMap((s) => fold(`${s.label} ${s.hintPhrase}`).split(/[^a-z]+/)));
  const pieceWords = fold(piece(OBSERVATORY, hardKept.gate).label).split(/[^a-z]+/).filter((w) => w.length >= 4 && !stationWords.has(w));
  const namesPiece = (text) => pieceWords.some((w) => fold(text).includes(w));
  const hardFacts = {
    noLight: hardLadder.every((h) => !h.halo),
    neverNamesThePiece: hardLadder.every((h) => !namesPiece(h.banner ?? "")),
    neverNamesTheObject: hardLadder.every((h) => namesAny(OBSERVATORY, [hardKept.id], h.banner ?? "").length === 0),
    nothingOpened: await allShut(page, OBSERVATORY),
    neverFramed: !framesObject(hardLadder[2].camera, OBSERVATORY, hardKept.id),
  };
  check("DIFICIL_NEVER_POINTS_AT_THE_PIECE", Object.values(hardFacts).every(Boolean), { ...hardFacts, banners: hardLadder.map((h) => h.banner), kept: hardKept.id });
  await witness(page, "observatory-hard-hint", 300);
  const { missed } = await finishRound(session, OBSERVATORY);
  const stored = (await storedResults(page))[0];
  check("DIFICIL_PLAYED_TO_THE_END", missed.length === 0 && stored?.details?.completed === true && stored.details.sceneId === OBSERVATORY && stored.details.roundSeed === hardSeed && stored.score === 8, { missed, stored: stored?.details });
  await witness(page, "observatory-result", 600);
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: phone, portrait ---------------------------------------------------------------------------------

async function mobilePortrait() {
  current = "int-mobile-portrait";
  const kept = gatedOf(STUDIO)[2];
  const seed = seedWhere(STUDIO, "medium", (ids) => ids.includes(kept.id));
  const session = await openSession({ width: 390, height: 844, touch: true, seeds: [seed] });
  const { page } = session;
  await enterGame03(session);
  await chooseRoom(session, STUDIO);
  const round = await explore(session, "medium");
  const tap = await tapPiece(session, STUDIO, kept.gate);
  check("A_TOUCH_TAP_OPENS_AND_THE_CAMERA_STAYS", tap.after.open && tap.cameraStill, tap);
  await witness(page, "mobile-portrait-open", 700);
  await tapPiece(session, STUDIO, kept.gate);
  // drag and pinch over the shut piece: the camera moves, the piece never
  const p = piece(STUDIO, kept.gate);
  const spot = await bringSpot(session, STUDIO, p.station, hitCentre(p.states[0].hit));
  const cam0 = await camera(page);
  await drag(session, spot, { x: spot.x - 120, y: spot.y - 60 });
  await settle(page);
  const cam1 = await camera(page);
  await pinch(session, { x: cam1.left + cam1.width / 2, y: cam1.top + cam1.height / 2 }, 60, 200);
  await settle(page);
  const cam2 = await camera(page);
  check("DRAG_AND_PINCH_NEVER_MOVE_A_PIECE", !sameCamera(cam0, cam1) && cam2.s > cam1.s && (await allShut(page, STUDIO)), { scale: [cam0.s, cam1.s, cam2.s] });
  check("THE_KEPT_OBJECT_IS_FOUND", await find(session, STUDIO, kept.id), { kept: kept.id, round: round.ids });
  await witness(page, "mobile-portrait-revealed", 400);
  await showList(session);
  const listShown = await page.evaluate(() => !document.querySelector(".hos-list")?.hidden);
  await hideList(session);
  const folded = await page.evaluate(() => document.querySelector(".hos-list")?.hidden === true);
  check("THE_TRAY_FOLDS_AND_THE_PIECES_HOLD", listShown && folded && (await pieceOnScreen(page, kept.gate)).open, {});
  check("NO_HORIZONTAL_OVERFLOW", (await overflow(page)) <= 0, { overflow: await overflow(page) });
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: phone, landscape --------------------------------------------------------------------------------

async function mobileLandscape() {
  current = "int-mobile-landscape";
  const kept = gatedOf(OBSERVATORY)[2];
  const seed = seedWhere(OBSERVATORY, "hard", (ids) => ids.includes(kept.id));
  const session = await openSession({ width: 844, height: 390, touch: true, seeds: [seed] });
  const { page } = session;
  await enterGame03(session);
  await chooseRoom(session, OBSERVATORY);
  const round = await explore(session, "hard");
  const tap = await tapPiece(session, OBSERVATORY, kept.gate);
  check("A_PIECE_OPENS_IN_LANDSCAPE", tap.after.open && tap.cameraStill, tap);
  await witness(page, "mobile-landscape-open", 700);
  const before = await piecesOnScreen(page, OBSERVATORY);
  await page.setViewportSize({ width: 390, height: 844 });
  await settle(page);
  const upright = { round: await roundOnScreen(page), pieces: await piecesOnScreen(page, OBSERVATORY) };
  await page.setViewportSize({ width: 844, height: 390 });
  await settle(page);
  const back = { round: await roundOnScreen(page), pieces: await piecesOnScreen(page, OBSERVATORY) };
  const states = (pieces) => Object.fromEntries(Object.entries(pieces).map(([id, v]) => [id, v.state]));
  check("TURNING_THE_PHONE_KEEPS_PIECES_AND_ROUND", same(upright.round, round) && same(back.round, round) && same(states(upright.pieces), states(before)) && same(states(back.pieces), states(before)), { before: states(before), upright: states(upright.pieces), back: states(back.pieces) });
  check("THE_SEARCH_GOES_ON", await tapObject(session, OBSERVATORY, kept.id), { kept: kept.id });
  await witness(page, "mobile-landscape-revealed", 400);
  check("NO_HORIZONTAL_OVERFLOW", (await overflow(page)) <= 0, { overflow: await overflow(page) });
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: reduced motion ------------------------------------------------------------------------------------

async function reducedMotion() {
  current = "int-reduced-motion";
  const seed = 9301;
  const session = await openSession({ width: 1440, height: 900, reducedMotion: "reduce", seeds: [seed, seed + 1] });
  const { page } = session;
  await enterGame03(session);
  const rows = {};
  for (const roomId of [STUDIO, OBSERVATORY]) {
    await chooseRoom(session, roomId);
    await explore(session, "medium");
    for (const p of piecesOf(roomId)) {
      const pose = p.states.find((s) => s.open);
      const tap = await tapPiece(session, roomId, p.id);
      // at once: right after the tap the computed transform is already the open pose's (no transition to wait for)
      rows[`${roomId}/${p.id}`] = { kind: p.kind, transition: tap.after.transition, state: tap.after.state, open: tap.after.open, expanded: tap.after.expanded, wanted: pose.id };
    }
    await witness(page, `reduced-motion-${roomId}`, 100);
    await backToSetup(session);
  }
  check("EVERY_PIECE_CHANGES_STATE_AT_ONCE", Object.values(rows).every((r) => /^0s(, 0s)*$/.test(r.transition) && r.state === r.wanted && r.open && r.expanded === "true"), { rows });
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: keyboard -------------------------------------------------------------------------------------------

async function keyboard() {
  current = "int-keyboard";
  const session = await openSession({ width: 1440, height: 900, seeds: [9401] });
  const { page } = session;
  await enterGame03(session);
  await chooseRoom(session, STUDIO);
  await explore(session, "hard");
  const reached = {};
  // from the room's viewport, Tab walks to the pieces' buttons
  await page.locator(".hos-viewport").focus();
  for (let i = 0; i < 12 && Object.keys(reached).length < piecesOf(STUDIO).length; i += 1) {
    await page.keyboard.press("Tab");
    await settle(page);
    const focused = await page.evaluate(() => {
      const element = document.activeElement;
      if (!element?.classList.contains("hos-piece-key")) return null;
      const box = element.getBoundingClientRect();
      return { id: element.dataset.piece, visible: box.width > 40 && box.height > 40, ring: document.querySelector(".hos-piece-focus")?.dataset.piece ?? null };
    });
    if (focused) reached[focused.id] = focused;
  }
  check("TAB_REACHES_EVERY_PIECE", piecesOf(STUDIO).every((p) => reached[p.id]?.visible && reached[p.id]?.ring === p.id), { reached });
  await witness(page, "keyboard-focus", 200);
  const p = piecesOf(STUDIO)[0];
  await page.locator(`.hos-piece-key[data-piece="${p.id}"]`).focus();
  await page.keyboard.press("Enter");
  await settle(page);
  const afterEnter = await pieceOnScreen(page, p.id);
  const liveEnter = (await ui(page)).live;
  await page.keyboard.press("Space");
  await settle(page);
  const afterSpace = await pieceOnScreen(page, p.id);
  check("ENTER_AND_SPACE_STEP_THE_PIECE", afterEnter.open && afterEnter.expanded === "true" && liveEnter === p.states.find((s) => s.open).announce && !afterSpace.open && afterSpace.expanded === "false", { afterEnter, liveEnter, afterSpace });
  check("THE_BUTTON_IS_NAMED", afterSpace.label === p.accessibleLabel, { label: afterSpace.label });
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: Fácil's help on a kept object ----------------------------------------------------------------------

async function easyHelp() {
  current = "int-easy-help";
  const kept = gatedOf(OBSERVATORY)[1];
  const seed = seedWhere(OBSERVATORY, "easy", (ids) => ids.includes(kept.id));
  const session = await openSession({ width: 1440, height: 900, seeds: [seed] });
  const { page } = session;
  await enterGame03(session);
  await chooseRoom(session, OBSERVATORY);
  await explore(session, "easy");
  await focusLine(session, kept.id);
  await hint(session);
  await hint(session);
  const last = await hint(session);
  const p = piece(OBSERVATORY, kept.gate);
  const ring = await page.evaluate(() => {
    const halo = document.querySelector(".hos-halo-reveal");
    return halo ? { x: parseFloat(halo.style.getPropertyValue("--hos-halo-x")), y: parseFloat(halo.style.getPropertyValue("--hos-halo-y")) } : null;
  });
  const c = hitCentre(p.states.find((s) => s.id === p.initial).hit);
  check("THE_LAST_RUNG_RINGS_THE_SHUT_PIECE", ring && Math.hypot(ring.x - c.x, ring.y - c.y) < 1 && (last.banner ?? "").includes(p.hintAction), { ring, piece: c, banner: last.banner });
  check("NOTHING_OPENS_BY_ITSELF", (await allShut(page, OBSERVATORY)) && !(await lineFound(page, kept.id)), {});
  await witness(page, "easy-help-piece", 400);
  await tapPiece(session, OBSERVATORY, kept.gate);
  check("OPENED_BY_THE_EXPLORADOR_THEN_FOUND", await tapObject(session, OBSERVATORY, kept.id), {});
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: round isolation ----------------------------------------------------------------------------------

async function roundIsolation() {
  current = "int-round-isolation";
  const seed = seedWhere(STUDIO, "hard", (ids) => gatedOf(STUDIO).some((t) => ids.includes(t.id)));
  const visit = async (seeds) => {
    const session = await openSession({ width: 1440, height: 900, seeds });
    await enterGame03(session);
    await chooseRoom(session, STUDIO);
    const round = await explore(session, "hard");
    await showList(session);
    return { session, round, lines: (await listOnScreen(session.page)).map((l) => l.text), shut: await allShut(session.page, STUDIO) };
  };
  const one = await visit([seed, seed + 7]);
  const two = await visit([seed]);
  check("SAME_SEED_SAME_ROUND", same(one.round, two.round) && same(one.lines, two.lines) && same(one.round.ids, drawn(STUDIO, "hard", seed)), { one: one.round, two: two.round });
  check("EVERY_VISIT_STARTS_SHUT", one.shut && two.shut, {});
  // a piece opened, then a new exploration (Trocar de cena → Explorar): a new round, every piece shut
  await tapPiece(one.session, STUDIO, piecesOf(STUDIO)[1].id);
  await backToSetup(one.session);
  const next = await explore(one.session, "hard");
  check("A_NEW_EXPLORATION_STARTS_SHUT", next.seed === seed + 7 && (await allShut(one.session.page, STUDIO)), { next });
  check("NO_PAGE_ERRORS", one.session.errors.length === 0 && two.session.errors.length === 0, { errors: [...one.session.errors, ...two.session.errors] });
  await one.session.context.close();
  await two.session.context.close();
}

// --- run ---------------------------------------------------------------------------------------------------------

const runners = {
  "int-desktop-studio": desktopStudio,
  "int-desktop-observatory": desktopObservatory,
  "int-mobile-portrait": mobilePortrait,
  "int-mobile-landscape": mobileLandscape,
  "int-reduced-motion": reducedMotion,
  "int-keyboard": keyboard,
  "int-easy-help": easyHelp,
  "int-round-isolation": roundIsolation,
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
if (JSON_OUT) fs.writeFileSync(JSON_OUT, `${JSON.stringify({ base: BASE, buildId: BUILD_ID, scenarios: SCENARIOS, results, metrics }, null, 2)}\n`);
console.log(`\n${results.length - failed.length}/${results.length} checks held · failing: ${failed.map((r) => `${r.scenario}:${r.id}`).join(", ") || "none"}`);
console.log(failed.length ? "HIDDEN_OBJECTS_INTERACTIONS_PROBE_FAILED" : "HIDDEN_OBJECTS_INTERACTIONS_PROBE_OK");
process.exit(failed.length ? EXIT_FAILED : EXIT_OK);
