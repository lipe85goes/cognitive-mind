/**
 * GAME03-REPLAYABILITY-05 — browser probe for the rooms' seeded layouts.
 *
 * Drives the PRODUCTION build (`next build && next start`) the way a person
 * would, and reads only what the page shows (DOM, the world element's
 * transform, computed styles, pixels). Nothing in the product is instrumented:
 * every exploration's seed is planted in the platform's random source
 * (`crypto.getRandomValues`) and what the page paints is held to what the
 * source composes for that seed (hidden-objects-rounds.ts, selectRound;
 * hidden-objects-layout.ts, layoutSprites / placedScene). React commits are
 * counted through the DevTools hook React itself calls (a counter, nothing else).
 *
 * Scenarios (all by default; pick with --scenario a,b — each runs alone, from
 * the Home, in a fresh browser context):
 *   rep-desktop-studio      1440×900, mouse: a seeded round; every picture where the seed puts it; pan and
 *                           zoom move none; an object found where it stands (and not where it was painted
 *                           before); "Recomeçar" keeps the room; a new exploration composes another one
 *   rep-desktop-observatory 1440×900, mouse: a Difícil round with look-alikes, an object and a prop off home;
 *                           an object kept behind a piece found there once the piece is open; the tap area
 *                           follows the object
 *   rep-mobile-portrait     390×844, touch: the room composed; drag and pinch; a piece opened; Fácil's hints
 *                           ring the object where it stands; touched and found; no horizontal overflow
 *   rep-mobile-landscape    844×390, touch: the phone turned upright and back mid-round — every picture
 *                           stays on its slot; the search goes on
 *   rep-reduced-motion      prefers-reduced-motion: the same seed paints the same room
 *   rep-replay              a fresh visit with the same seed paints the same room, pixel for pixel; another
 *                           seed a materially different one
 *   rep-sequence            several explorations in one visit: never the room just played (a planted repeat
 *                           is drawn again), each one composed as its seed says
 *
 * Usage:
 *   node tools/validation/hidden-objects-replayability-probe.mjs [--base http://localhost:3100]
 *        [--build .next] [--scenario NAME[,NAME…]] [--out DIR] [--json FILE]
 *
 * Playwright: `import("playwright")`, or set PLAYWRIGHT_DIR to a node_modules directory that has it.
 * Exit: 0 every scenario held · 1 a check failed · 3 usage / setup error.
 */
import { createHash } from "node:crypto";
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
const ALL = ["rep-desktop-studio", "rep-desktop-observatory", "rep-mobile-portrait", "rep-mobile-landscape", "rep-reduced-motion", "rep-replay", "rep-sequence"];
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

// --- what the source composes for a seed (never restated here) -------------------------------------------

const SOURCE = createModuleGraph({ mocks: {}, globals: {} });
const REGISTRY = SOURCE.require("src/games/hidden-objects/hidden-objects-scenes.ts");
const ROUNDS = SOURCE.require("src/games/hidden-objects/hidden-objects-rounds.ts");
const LAYOUT = SOURCE.require("src/games/hidden-objects/hidden-objects-layout.ts");
const ROOM = Object.fromEntries(REGISTRY.SCENES.map((scene) => [scene.id, scene]));
const STUDIO = "explorer-studio";
const OBSERVATORY = "explorer-observatory";
const LEVEL = { easy: "Fácil", medium: "Médio", hard: "Difícil" };
const boundsOf = (region) => (region.kind === "rect" ? { x: region.x, y: region.y, w: region.w, h: region.h } : { x: region.cx - region.r, y: region.cy - region.r, w: 2 * region.r, h: 2 * region.r });
const centreOf = (region) => {
  const b = boundsOf(region);
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** What the source says a seed gives: the list, the layout, the room placed by it and the pictures it paints. */
function composed(roomId, difficulty, seed) {
  const draw = ROUNDS.selectRound(ROOM[roomId], difficulty, seed);
  const room = LAYOUT.placedScene(ROOM[roomId], draw.layout);
  const sprites = LAYOUT.layoutSprites(ROOM[roomId], draw.layout).map((s) => ({ thing: s.thing, slot: s.slot, x: s.sprite.x, y: s.sprite.y, w: s.sprite.w, h: s.sprite.h }));
  return { ...draw, room, sprites };
}
const homeOf = (roomId, id) => [...ROOM[roomId].pool, ...ROOM[roomId].lookAlikes].find((t) => t.id === id);
const placedTarget = (c, id) => c.room.pool.find((t) => t.id === id);
const offHome = (roomId, c, id, min = 120) => {
  const now = centreOf(placedTarget(c, id).region);
  const was = centreOf(homeOf(roomId, id).region);
  return Math.hypot(now.x - was.x, now.y - was.y) >= min;
};
/** The first seed (from 9001 up) whose composition in (room, difficulty) satisfies `predicate(c)`. */
function seedWhere(roomId, difficulty, predicate) {
  for (let seed = 9001; seed < 200_000; seed += 1) if (predicate(composed(roomId, difficulty, seed))) return seed;
  throw new Error(`no seed in ${roomId}/${difficulty}`);
}
const thingsMoved = (roomId, a, b) => {
  const things = LAYOUT.layoutThings(ROOM[roomId]);
  return things.filter((t) => (a.layout.picks[t.id] ?? 0) !== (b.layout.picks[t.id] ?? 0)).length / things.length;
};

// --- results ----------------------------------------------------------------------------------------------

const results = [];
const metrics = { commits: {}, layouts: {} };
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
  const session = { context, page, errors: [], touch, cdp: null, bytes: { atlas: 0, plate: 0 } };
  page.on("pageerror", (error) => session.errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") session.errors.push(`console: ${message.text()}`);
  });
  page.on("response", async (response) => {
    const url = response.url();
    if (/\/v\d+\/atlas\.webp/.test(url)) session.bytes.atlas += Number(response.headers()["content-length"] ?? 0);
    if (/\/v\d+\/plate\.webp/.test(url)) session.bytes.plate += Number(response.headers()["content-length"] ?? 0);
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
/**
 * The room as the page paints it: the shell's round, the layout it names, and
 * every moving thing's picture — its slot, its room rectangle (what the page
 * says) and where it lands on screen, in room units through the camera (what
 * the page does).
 */
async function layoutOnScreen(page) {
  const cam = await camera(page);
  const raw = await page.evaluate(() => {
    const shell = document.querySelector(".hos-shell");
    const atlas = document.querySelector(".hos-atlas");
    return {
      scene: shell?.dataset.scene ?? null,
      seed: shell?.dataset.roundSeed === undefined ? null : Number(shell.dataset.roundSeed),
      signature: shell?.dataset.layout ?? null,
      ids: [...document.querySelectorAll(".hos-item")].map((item) => item.dataset.target ?? null),
      atlas: atlas ? { src: atlas.getAttribute("src") ?? "", complete: atlas.complete, natural: atlas.naturalWidth } : null,
      things: [...document.querySelectorAll(".hos-thing")]
        .map((e) => {
          const r = e.getBoundingClientRect();
          const style = getComputedStyle(e);
          return {
            thing: e.dataset.thing,
            slot: e.dataset.slot,
            x: parseFloat(e.style.left),
            y: parseFloat(e.style.top),
            w: parseFloat(e.style.width),
            h: parseFloat(e.style.height),
            screen: { left: r.left, top: r.top, width: r.width, height: r.height },
            image: style.backgroundImage,
            tabbable: e.tabIndex >= 0 || e.getAttribute("role") !== null,
          };
        })
        .sort((a, b) => (a.thing < b.thing ? -1 : 1)),
      hidden: document.querySelector(".hos-things")?.getAttribute("aria-hidden") ?? null,
    };
  });
  // where each picture lands, back in room units
  const landed = raw.things.map((t) => ({ thing: t.thing, x: (t.screen.left - cam.left - cam.tx) / cam.s, y: (t.screen.top - cam.top - cam.ty) / cam.s }));
  return { ...raw, cam, landed };
}
const authored = (things) => things.map(({ thing, slot, x, y, w, h }) => ({ thing, slot, x, y, w, h }));
/** Every picture lands where its room rectangle says, through the camera (within a pixel). */
const landsWhereItSays = (shown) => shown.things.every((t, i) => Math.abs(shown.landed[i].x - t.x) * shown.cam.s < 1.5 && Math.abs(shown.landed[i].y - t.y) * shown.cam.s < 1.5);
const progress = (page) =>
  page.evaluate(() => {
    const bar = document.querySelector(".hos-progress");
    return bar ? { found: Number(bar.getAttribute("aria-valuenow")), total: Number(bar.getAttribute("aria-valuemax")) } : null;
  });
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const commits = (page) => page.evaluate(() => window.__probeCommits ?? null);
const lineFound = (page, id) => page.evaluate((t) => document.querySelector(`.hos-item[data-target="${t}"]`)?.dataset.found === "true", id);
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
/** A screenshot of the room alone (the viewport), hashed: the composition as pixels. */
async function roomPixels(page) {
  const box = await page.evaluate(() => document.querySelector(".hos-viewport")?.getBoundingClientRect().toJSON());
  const png = await page.screenshot({ clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
  return { png, sha: createHash("sha256").update(png).digest("hex") };
}
/**
 * GAME03-FINAL-POLISH-LOCK-06 (restated): two screenshots compared as decoded
 * pixels, not as hashes. The GPU rasterises the Observatory's parallax sky
 * (back.webp, behind the dome and the round window) with a few levels of noise
 * from one fresh page to the next — measured up to 6 of 255, only there — so a
 * byte hash of a correct replay failed about one run in three. A different
 * composition differs by far more: a moved thing is tens of levels on thousands
 * of pixels.
 */
const RASTER_NOISE = 8;
async function pixelDiff(a, b) {
  const sharp = (await import("sharp")).default;
  const [x, y] = await Promise.all([a.png, b.png].map((png) => sharp(png).removeAlpha().raw().toBuffer({ resolveWithObject: true })));
  if (x.info.width !== y.info.width || x.info.height !== y.info.height) return { maxDelta: 255, changedShare: 1 };
  let maxDelta = 0;
  let changed = 0;
  for (let i = 0; i < x.data.length; i += 3) {
    const d = Math.max(Math.abs(x.data[i] - y.data[i]), Math.abs(x.data[i + 1] - y.data[i + 1]), Math.abs(x.data[i + 2] - y.data[i + 2]));
    if (d > maxDelta) maxDelta = d;
    if (d > 3 * RASTER_NOISE) changed += 1;
  }
  return { maxDelta, changedShare: Number((changed / (x.data.length / 3)).toFixed(4)) };
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
/** In the setup: pick a room (and wait until its art — plate, pieces and atlas — has painted: "Explorar" enabled again). */
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
/** "Explorar" on a difficulty: the round on screen, and what the fresh layout cost React. */
async function explore(session, difficulty) {
  const { page } = session;
  await press(session, page.locator(".hos-difficulty-option", { hasText: LEVEL[difficulty] }));
  const c0 = await commits(page);
  await press(session, page.getByRole("button", { name: "Explorar", exact: true }));
  await page.waitForFunction(() => document.querySelector(".hos-shell")?.dataset.status === "playing");
  await settle(page);
  const shown = await layoutOnScreen(page);
  return { ...shown, commits: (await commits(page)) - c0 };
}
async function backToSetup(session) {
  await press(session, session.page.getByRole("button", { name: "Trocar de cena" }));
  await session.page.waitForSelector(".hos-setup", { state: "visible" });
}
async function hideList(session) {
  const open = await session.page.evaluate(() => !document.querySelector(".hos-list")?.hidden);
  if (open && (await session.page.locator(".hos-tray-toggle").isVisible())) await press(session, session.page.locator(".hos-tray-toggle"));
}
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
/** A tap on a room point (brought on screen first): whether the count went up. */
async function tapRoom(session, roomId, stationId, spot) {
  const { page } = session;
  const before = await progress(page);
  const point = await bringSpot(session, roomId, stationId, spot);
  await tapAt(session, point);
  await page.waitForFunction((n) => Number(document.querySelector(".hos-progress")?.getAttribute("aria-valuenow")) > n, before.found, { timeout: 2500 }).catch(() => {});
  return (await progress(page)).found > before.found;
}
/** Open a piece where it is now (a tap on its current tap area). */
async function openPiece(session, roomId, pieceId) {
  const { page } = session;
  const piece = ROOM[roomId].interactables.find((p) => p.id === pieceId);
  const state = await page.evaluate((id) => document.querySelector(`.hos-piece[data-piece="${id}"]`)?.dataset.state, pieceId);
  const { hit } = piece.states.find((s) => s.id === state);
  const point = await bringSpot(session, roomId, piece.station, { x: hit.x + hit.w / 2, y: hit.y + hit.h / 2 });
  await tapAt(session, point);
  await page.waitForFunction((id) => document.querySelector(`.hos-piece[data-piece="${id}"]`)?.dataset.open === "true", pieceId, { timeout: 4000 }).catch(() => {});
  await settle(page);
  return page.evaluate((id) => document.querySelector(`.hos-piece[data-piece="${id}"]`)?.dataset.open === "true", pieceId);
}

/** The page's room is the source's composition for its seed: list, layout, every picture's slot and rectangle, and where it lands. */
function holdsComposition(name, shown, roomId, difficulty, seed) {
  const c = composed(roomId, difficulty, seed);
  const atlasOk = shown.atlas?.complete && shown.atlas.natural > 0 && shown.things.length > 0 && shown.things.every((t) => t.image.includes(ROOM[roomId].atlas.src.split("/").pop()));
  return check(
    name,
    shown.scene === roomId && shown.seed === seed && same(shown.ids, c.targets) && shown.signature === c.layout.signature && same(authored(shown.things), [...c.sprites].sort((a, b) => (a.thing < b.thing ? -1 : 1))) && landsWhereItSays(shown) && atlasOk && shown.hidden === "true" && shown.things.every((t) => !t.tabbable),
    { seed, signature: shown.signature, expected: c.layout.signature, pictures: shown.things.length, expectedPictures: c.sprites.length, atlas: shown.atlas, lands: landsWhereItSays(shown) },
  );
}

// --- scenario: desktop, the Estúdio ------------------------------------------------------------------------------

async function desktopStudio() {
  current = "rep-desktop-studio";
  // a Médio round listing an object (no piece) well away from where it was painted before
  const seed = seedWhere(STUDIO, "medium", (c) => c.targets.some((id) => !homeOf(STUDIO, id).gate && offHome(STUDIO, c, id, 200)));
  const next = seed + 101;
  const session = await openSession({ width: 1440, height: 900, seeds: [seed, next] });
  const { page } = session;
  await enterGame03(session);
  await chooseRoom(session, STUDIO);
  const first = await explore(session, "medium");
  metrics.commits.freshLayoutStudio = first.commits;
  holdsComposition("THE_ROOM_IS_THE_SEEDS_COMPOSITION", first, STUDIO, "medium", seed);
  metrics.layouts.studio = { seed, signature: first.signature, pictures: first.things.length };
  await witness(page, "studio-medium", 300);
  // pan and zoom: every picture travels with the room and keeps its slot
  const cam0 = first.cam;
  const centre = { x: cam0.left + cam0.width / 2, y: cam0.top + cam0.height / 2 };
  const c0 = await commits(page);
  await drag(session, centre, { x: centre.x - 300, y: centre.y + 60 }, 24);
  await settle(page);
  metrics.commits.dragStudio = (await commits(page)) - c0;
  await page.mouse.move(centre.x, centre.y);
  await page.mouse.wheel(0, -420);
  await settle(page);
  const moved = await layoutOnScreen(page);
  check("PAN_AND_ZOOM_MOVE_NO_THING", moved.signature === first.signature && same(authored(moved.things), authored(first.things)) && landsWhereItSays(moved) && moved.cam.s !== cam0.s, { signature: moved.signature, scale: [cam0.s, moved.cam.s] });
  check("A_DRAG_IS_NOT_A_RENDER_LOOP", metrics.commits.dragStudio <= 3, { dragCommits: metrics.commits.dragStudio, pointerMoves: 24 });
  check("A_FRESH_LAYOUT_IS_ONE_BOUNDED_SETUP", first.commits >= 1 && first.commits <= 12, { commits: first.commits });
  // the object off home: not where it was painted before, found where it stands
  const c = composed(STUDIO, "medium", seed);
  const id = c.targets.find((t) => !homeOf(STUDIO, t).gate && offHome(STUDIO, c, t, 200));
  const was = homeOf(STUDIO, id);
  const now = placedTarget(c, id);
  const atOld = await tapRoom(session, STUDIO, was.station, centreOf(was.region));
  const atNew = await tapRoom(session, STUDIO, now.station, centreOf(now.region));
  check("FOUND_WHERE_IT_STANDS_NOT_WHERE_IT_WAS", !atOld && atNew && (await lineFound(page, id)), { id, was: centreOf(was.region), now: centreOf(now.region), atOld, atNew });
  await witness(page, "studio-found-at-placement", 300);
  // "Recomeçar": the same room, nothing found
  await press(session, page.getByRole("button", { name: "Recomeçar a exploração" }));
  await settle(page);
  const again = await layoutOnScreen(page);
  check("RECOMECAR_KEEPS_THE_ROOM", again.signature === first.signature && same(authored(again.things), authored(first.things)) && !(await lineFound(page, id)), { signature: again.signature });
  // a new exploration: another composition, as its seed says
  await backToSetup(session);
  const second = await explore(session, "medium");
  holdsComposition("A_NEW_EXPLORATION_IS_ITS_SEEDS_COMPOSITION", second, STUDIO, "medium", next);
  const share = thingsMoved(STUDIO, composed(STUDIO, "medium", seed), composed(STUDIO, "medium", next));
  metrics.layouts.studioMovedShare = Number(share.toFixed(3));
  check("A_NEW_EXPLORATION_REARRANGES_THE_ROOM", second.signature !== first.signature && share >= 0.3, { first: first.signature, second: second.signature, moved: share });
  await witness(page, "studio-medium-next", 300);
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: desktop, the Observatório ---------------------------------------------------------------------

async function desktopObservatory() {
  current = "rep-desktop-observatory";
  const room = ROOM[OBSERVATORY];
  const props = (room.props ?? []).map((p) => p.id);
  // Difícil, listing an object kept behind a piece on its second spot, with look-alikes, a prop and an object off home
  const seed = seedWhere(OBSERVATORY, "hard", (c) => {
    const kept = c.targets.find((id) => homeOf(OBSERVATORY, id).gate && (c.layout.picks[id] ?? 0) !== 0);
    const looks = room.lookAlikes.filter((l) => (c.layout.picks[l.id] ?? 0) !== 0).length;
    return kept && looks >= 6 && props.some((p) => (c.layout.picks[p] ?? 0) !== 0) && c.targets.some((id) => !homeOf(OBSERVATORY, id).gate && offHome(OBSERVATORY, c, id, 150));
  });
  const session = await openSession({ width: 1440, height: 900, seeds: [seed] });
  const { page } = session;
  await enterGame03(session);
  await chooseRoom(session, OBSERVATORY);
  const shown = await explore(session, "hard");
  metrics.commits.freshLayoutObservatory = shown.commits;
  holdsComposition("THE_ROOM_IS_THE_SEEDS_COMPOSITION", shown, OBSERVATORY, "hard", seed);
  const c = composed(OBSERVATORY, "hard", seed);
  const lookMoved = room.lookAlikes.filter((l) => (c.layout.picks[l.id] ?? 0) !== 0).map((l) => l.id);
  const propMoved = props.filter((p) => (c.layout.picks[p] ?? 0) !== 0);
  const paintedAway = (id) => {
    const t = shown.things.find((x) => x.thing === id);
    const home = boundsOf(([...room.lookAlikes, ...room.pool].find((x) => x.id === id) ?? { region: { kind: "rect", ...room.props.find((p) => p.id === id).box } }).region);
    return t && Math.hypot(t.x - home.x, t.y - home.y) > 20;
  };
  check("LOOK_ALIKES_AND_PROPS_ARE_PAINTED_OFF_HOME", lookMoved.length >= 6 && propMoved.length >= 1 && [...lookMoved, ...propMoved].filter(paintedAway).length >= lookMoved.length * 0.5, { lookMoved, propMoved });
  metrics.layouts.observatory = { seed, signature: shown.signature, pictures: shown.things.length, lookAlikesOffHome: lookMoved.length };
  await witness(page, "observatory-hard", 300);
  // an object off home: the tap area follows it
  const id = c.targets.find((t) => !homeOf(OBSERVATORY, t).gate && offHome(OBSERVATORY, c, t, 150));
  const atOld = await tapRoom(session, OBSERVATORY, homeOf(OBSERVATORY, id).station, centreOf(homeOf(OBSERVATORY, id).region));
  const atNew = await tapRoom(session, OBSERVATORY, homeOf(OBSERVATORY, id).station, centreOf(placedTarget(c, id).region));
  check("THE_TAP_AREA_FOLLOWS_THE_OBJECT", !atOld && atNew, { id, atOld, atNew });
  // the kept object, on its second spot: shut, not there; opened, found where it stands
  const kept = c.targets.find((t) => homeOf(OBSERVATORY, t).gate && (c.layout.picks[t] ?? 0) !== 0);
  const keptNow = placedTarget(c, kept);
  const shut = await tapRoom(session, OBSERVATORY, keptNow.station, centreOf(keptNow.region));
  // a tap on the shut piece opens it (that is how the Explorador opens it): shut again if so
  const openNow = await page.evaluate((g) => document.querySelector(`.hos-piece[data-piece="${g}"]`)?.dataset.open === "true", keptNow.gate);
  await witness(page, "observatory-kept-closed", 300);
  const opened = openNow || (await openPiece(session, OBSERVATORY, keptNow.gate));
  await witness(page, "observatory-kept-open", 500);
  const found = await tapRoom(session, OBSERVATORY, keptNow.station, centreOf(keptNow.region));
  check("A_KEPT_OBJECT_IS_FOUND_WHERE_IT_STANDS_ONCE_OPEN", !shut && opened && found, { kept, slot: c.sprites.find((s) => s.thing === kept)?.slot, shut, opened, found });
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: mobile portrait --------------------------------------------------------------------------------

async function mobilePortrait() {
  current = "rep-mobile-portrait";
  const seed = seedWhere(OBSERVATORY, "easy", (c) => c.targets.some((id) => !homeOf(OBSERVATORY, id).gate && offHome(OBSERVATORY, c, id, 150)));
  const session = await openSession({ width: 390, height: 844, touch: true, seeds: [seed] });
  const { page } = session;
  await enterGame03(session);
  await chooseRoom(session, OBSERVATORY);
  const shown = await explore(session, "easy");
  holdsComposition("THE_ROOM_IS_THE_SEEDS_COMPOSITION", shown, OBSERVATORY, "easy", seed);
  await witness(page, "mobile-portrait", 300);
  const c = composed(OBSERVATORY, "easy", seed);
  // drag and pinch: the room moves, nothing in it does
  const cam = shown.cam;
  const centre = { x: cam.left + cam.width / 2, y: cam.top + cam.height / 2 };
  await drag(session, centre, { x: centre.x + 120, y: centre.y - 30 });
  await settle(page);
  await pinch(session, centre, 60, 180);
  await settle(page);
  const after = await layoutOnScreen(page);
  check("DRAG_AND_PINCH_MOVE_NO_THING", after.signature === shown.signature && same(authored(after.things), authored(shown.things)) && landsWhereItSays(after), {});
  // a piece opened by touch
  const piece = ROOM[OBSERVATORY].interactables[0];
  check("A_PIECE_OPENS_BY_TOUCH", await openPiece(session, OBSERVATORY, piece.id), { piece: piece.id });
  // Fácil's hints: the last rung rings the object where it stands
  const id = c.targets.find((t) => !homeOf(OBSERVATORY, t).gate && offHome(OBSERVATORY, c, t, 150));
  await hideList(session);
  await press(session, page.locator(".hos-list-toggle, .hos-tray-toggle").first());
  await press(session, page.locator(`.hos-item[data-target="${id}"]`));
  for (let i = 0; i < 3; i += 1) {
    await press(session, page.locator(".hos-hint-button"));
    await settle(page);
  }
  const halo = await page.evaluate(() => {
    const h = document.querySelector(".hos-halo");
    return h ? { x: parseFloat(h.style.getPropertyValue("--hos-halo-x")), y: parseFloat(h.style.getPropertyValue("--hos-halo-y")) } : null;
  });
  const at = centreOf(placedTarget(c, id).region);
  check("THE_HINT_RINGS_WHERE_IT_STANDS", halo && Math.hypot(halo.x - at.x, halo.y - at.y) < 2, { id, halo, at });
  await witness(page, "mobile-portrait-hint", 300);
  const found = await tapRoom(session, OBSERVATORY, homeOf(OBSERVATORY, id).station, at);
  check("TOUCHED_AND_FOUND_WHERE_IT_STANDS", found, { id });
  check("NO_HORIZONTAL_OVERFLOW", (await overflow(page)) <= 0, { overflow: await overflow(page) });
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: mobile landscape --------------------------------------------------------------------------------

async function mobileLandscape() {
  current = "rep-mobile-landscape";
  const seed = seedWhere(STUDIO, "medium", (c) => c.targets.some((id) => !homeOf(STUDIO, id).gate && offHome(STUDIO, c, id, 150)));
  const session = await openSession({ width: 844, height: 390, touch: true, seeds: [seed] });
  const { page } = session;
  await enterGame03(session);
  await chooseRoom(session, STUDIO);
  const shown = await explore(session, "medium");
  holdsComposition("THE_ROOM_IS_THE_SEEDS_COMPOSITION", shown, STUDIO, "medium", seed);
  await witness(page, "mobile-landscape", 300);
  // turned upright and back, mid-round
  await page.setViewportSize({ width: 390, height: 844 });
  await settle(page);
  const upright = await layoutOnScreen(page);
  await witness(page, "mobile-landscape-turned", 300);
  await page.setViewportSize({ width: 844, height: 390 });
  await settle(page);
  const back = await layoutOnScreen(page);
  check("TURNING_THE_PHONE_MOVES_NO_THING", [upright, back].every((s) => s.signature === shown.signature && same(authored(s.things), authored(shown.things)) && landsWhereItSays(s)), {});
  const c = composed(STUDIO, "medium", seed);
  const id = c.targets.find((t) => !homeOf(STUDIO, t).gate && offHome(STUDIO, c, t, 150));
  check("THE_SEARCH_GOES_ON", await tapRoom(session, STUDIO, homeOf(STUDIO, id).station, centreOf(placedTarget(c, id).region)), { id });
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: reduced motion ------------------------------------------------------------------------------------

async function reducedMotion() {
  current = "rep-reduced-motion";
  for (const roomId of [STUDIO, OBSERVATORY]) {
    const seed = 0x5eed + roomId.length;
    const session = await openSession({ width: 1440, height: 900, reducedMotion: "reduce", seeds: [seed] });
    await enterGame03(session);
    await chooseRoom(session, roomId);
    const shown = await explore(session, "medium");
    holdsComposition(`SAME_ROOM_WITH_REDUCED_MOTION_${roomId === STUDIO ? "STUDIO" : "OBSERVATORY"}`, shown, roomId, "medium", seed);
    await witness(session.page, `reduced-motion-${roomId}`, 100);
    check(`NO_PAGE_ERRORS_${roomId === STUDIO ? "STUDIO" : "OBSERVATORY"}`, session.errors.length === 0, { errors: session.errors });
    await session.context.close();
  }
}

// --- scenario: replay --------------------------------------------------------------------------------------------

async function replay() {
  current = "rep-replay";
  const seed = 0x0dd5eed;
  const other = seedWhere(OBSERVATORY, "medium", (c) => thingsMoved(OBSERVATORY, c, composed(OBSERVATORY, "medium", seed)) >= 0.35);
  const visit = async (s) => {
    // still pictures to compare: no transition in flight (reduced motion), the pointer off the room, every fade done
    const session = await openSession({ width: 1440, height: 900, seeds: [s], reducedMotion: "reduce" });
    await enterGame03(session);
    await chooseRoom(session, OBSERVATORY);
    const shown = await explore(session, "medium");
    // the same framing in every visit: the room's own opening view
    await session.page.mouse.move(2, 2);
    await session.page.waitForTimeout(1500);
    await settle(session.page);
    const pixels = await roomPixels(session.page);
    return { session, shown, pixels };
  };
  const one = await visit(seed);
  const two = await visit(seed);
  const three = await visit(other);
  const again = await pixelDiff(one.pixels, two.pixels);
  check(
    "THE_SAME_SEED_PAINTS_THE_SAME_ROOM",
    one.shown.signature === two.shown.signature && same(authored(one.shown.things), authored(two.shown.things)) && again.maxDelta <= RASTER_NOISE,
    { signature: one.shown.signature, pixels: [one.pixels.sha.slice(0, 12), two.pixels.sha.slice(0, 12)], ...again },
  );
  const share = thingsMoved(OBSERVATORY, composed(OBSERVATORY, "medium", seed), composed(OBSERVATORY, "medium", other));
  const apart = await pixelDiff(one.pixels, three.pixels);
  check("ANOTHER_SEED_PAINTS_ANOTHER_ROOM", three.shown.signature !== one.shown.signature && apart.maxDelta > 3 * RASTER_NOISE && apart.changedShare >= 0.005 && share >= 0.3, { other, moved: share, ...apart });
  if (OUT) {
    fs.mkdirSync(OUT, { recursive: true });
    const sharp = (await import("sharp")).default;
    await sharp(one.pixels.png).webp({ quality: 74 }).toFile(path.join(OUT, "replay-seed-a.webp"));
    await sharp(three.pixels.png).webp({ quality: 74 }).toFile(path.join(OUT, "replay-seed-b.webp"));
  }
  check("NO_PAGE_ERRORS", [one, two, three].every((v) => v.session.errors.length === 0), { errors: [one, two, three].flatMap((v) => v.session.errors) });
  metrics.bytes = one.session.bytes;
  for (const v of [one, two, three]) await v.session.context.close();
}

// --- scenario: a sequence of explorations ------------------------------------------------------------------------

async function sequence() {
  current = "rep-sequence";
  // the second planted seed is the first again: the room just played would come back — another seed is drawn
  const seeds = [0x51a7, 0x51a7, 0x6b1d, 0x7c2e, 0x8d3f, 0x9e40];
  const session = await openSession({ width: 1440, height: 900, seeds });
  const { page } = session;
  await enterGame03(session);
  await chooseRoom(session, STUDIO);
  const plays = [];
  for (let i = 0; i < 6; i += 1) {
    if (i) await backToSetup(session);
    const shown = await explore(session, "easy");
    plays.push({ seed: shown.seed, signature: shown.signature, ok: holdsComposition(`EXPLORATION_${i + 1}_IS_ITS_SEEDS_COMPOSITION`, shown, STUDIO, "easy", shown.seed) });
  }
  const repeats = plays.filter((p, i) => i && p.signature === plays[i - 1].signature).length;
  const draws = await page.evaluate(() => window.__probeDraws);
  check("NEVER_THE_ROOM_JUST_PLAYED", repeats === 0 && plays[1].seed !== seeds[1], { plays: plays.map((p) => [p.seed, p.signature]), draws: draws.length });
  check("EVERY_EXPLORATION_A_DIFFERENT_ROOM", new Set(plays.map((p) => p.signature)).size === plays.length, {});
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- run ---------------------------------------------------------------------------------------------------------

const runners = {
  "rep-desktop-studio": desktopStudio,
  "rep-desktop-observatory": desktopObservatory,
  "rep-mobile-portrait": mobilePortrait,
  "rep-mobile-landscape": mobileLandscape,
  "rep-reduced-motion": reducedMotion,
  "rep-replay": replay,
  "rep-sequence": sequence,
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
console.log(failed.length ? "HIDDEN_OBJECTS_REPLAYABILITY_PROBE_FAILED" : "HIDDEN_OBJECTS_REPLAYABILITY_PROBE_OK");
process.exit(failed.length ? EXIT_FAILED : EXIT_OK);
