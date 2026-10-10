/**
 * GAME03-CALIBRATION-02A — browser probe for Difficulty V3 in both rooms.
 *
 * Drives the PRODUCTION build (`next build && next start`) the way a person
 * would, and reads only what the page shows (DOM, the world element's
 * transform, localStorage). Nothing in the product is instrumented: every
 * round's seed is planted in the platform's random source,
 * `crypto.getRandomValues`, and the list and the clues on screen are then held
 * to what (room, difficulty, seed) draws, read from source — the rounds
 * (hidden-objects-rounds.ts) and the clues (hidden-objects-clues.ts).
 *
 * Scenarios (all by default; pick with --scenario a,b — each runs alone, from
 * the Home, in a fresh browser context):
 *   cal-desktop        1440×900, mouse, each room in turn: Fácil (pictures and names; the ladder ends
 *                      in "Aqui está" with the reveal halo), Médio (associative clues, no picture, no
 *                      name; station → the reclue in plainer words → direction, never a light, the
 *                      camera never framed on the object), Difícil (indirect clues; station → context;
 *                      no light, no framing, no name until the find), Difícil played to the end
 *   cal-mobile         390×844, touch: the Observatório on Difícil and the Estúdio on Médio — every
 *                      clue shows whole in its card of the tray's strip (which scrolls sideways inside
 *                      the phone), folding the tray keeps them, drag and pinch,
 *                      hints, finds; never a horizontal page overflow
 *   cal-landscape      844×390, touch, the Estúdio on Difícil: "Explorar" in reach, the clue lines,
 *                      the phone turned upright and back mid-round (the clues hold), a find
 *   cal-reduced-motion 1440×900, prefers-reduced-motion, the Observatório on Médio: stations cut, the
 *                      reclue and the direction light nothing, the clues hold
 *   cal-replay         the same seed in two fresh visits tells the same clues; a third visit with
 *                      another seed tells a shared object another way; "Recomeçar" keeps the clues
 *
 * Usage:
 *   node tools/validation/hidden-objects-calibration-probe.mjs [--base http://localhost:3100]
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
const ALL = ["cal-desktop", "cal-mobile", "cal-landscape", "cal-reduced-motion", "cal-replay"];
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
const CLUES = SOURCE.require("src/games/hidden-objects/hidden-objects-clues.ts");
const CONTRACT = SOURCE.require("src/games/hidden-objects/hidden-objects-scene.ts");
const ROOM = Object.fromEntries(REGISTRY.SCENES.map((scene) => [scene.id, scene]));
const STUDIO = "explorer-studio";
const OBSERVATORY = "explorer-observatory";
const LEVEL = { easy: "Fácil", medium: "Médio", hard: "Difícil" };
const STORAGE_KEY = /const STORAGE_KEY = "([^"]+)"/.exec(fs.readFileSync("src/engine/storage.ts", "utf8"))[1];
const target = (roomId, id) => ROOM[roomId].pool.find((t) => t.id === id);
const drawn = (roomId, difficulty, seed) => ROUNDS.selectRoundTargets(ROOM[roomId], difficulty, seed);
/** What a round of (room, difficulty, seed) tells: each object's list line and its reclue (null where none). */
function told(roomId, difficulty, seed) {
  const ids = drawn(roomId, difficulty, seed);
  const choice = CLUES.selectRoundClues(ROOM[roomId], difficulty, seed, ids);
  const text = (id, index) => CLUES.clueAt(target(roomId, id), index)?.text ?? null;
  return { ids, list: ids.map((id) => text(id, choice[id].list)), reclue: Object.fromEntries(ids.map((id) => [id, text(id, choice[id].reclue)])) };
}
const levelOf = (roomId, id, text) => target(roomId, id).clues.find((c) => c.text === text)?.level ?? null;
const centreOf = (region) => (region.kind === "rect" ? { x: region.x + region.w / 2, y: region.y + region.h / 2 } : { x: region.cx, y: region.cy });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fold = (text) => (text ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
/** Whether `text` says the name of any of `ids` (label or accessible label). */
const namesAny = (roomId, ids, text) => ids.filter((id) => [target(roomId, id).label, target(roomId, id).accessibleLabel].some((name) => fold(text).includes(fold(name))));

/** Each scenario's seeds, one per "Explorar", in order (a fresh visit plants its own). */
const SEEDS = {
  "cal-desktop": { [STUDIO]: [8001, 8002, 8003], [OBSERVATORY]: [8011, 8012, 8013] },
  "cal-mobile": { [OBSERVATORY]: [8101], [STUDIO]: [8102] },
  "cal-landscape": { [STUDIO]: [8201] },
  "cal-reduced-motion": { [OBSERVATORY]: [8301] },
};
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

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--use-gl=angle", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });

async function openSession({ width, height, touch = false, reducedMotion = "no-preference", seeds = [] }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, reducedMotion });
  await context.addInitScript(plantSeeds, seeds);
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
/** The list's own box: on a phone a strip of cards that scrolls sideways inside it. */
const listBox = (page) => page.evaluate(() => document.querySelector(".hos-list")?.getBoundingClientRect().toJSON() ?? null);
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
async function find(session, roomId, id) {
  const before = await progress(session.page);
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

// --- what each difficulty must show and say ------------------------------------------------------------------

/** The list of a fresh round: the drawn objects; Fácil by picture and name, Médio/Difícil by the seed's clues. */
function checkList(tag, roomId, difficulty, seed, round, lines) {
  const want = told(roomId, difficulty, seed);
  const level = CONTRACT.DIFFICULTY_PRESETS[difficulty].listClue;
  check(`${tag}_ROUND_IS_THE_SEEDS`, round.scene === roomId && round.seed === seed && same(round.ids, want.ids), { round, drawn: want.ids });
  if (difficulty === "easy") {
    check(`${tag}_LIST_BY_PICTURE_AND_NAME`, lines.every((line) => line.picture && line.text === target(roomId, line.id).label), { lines: lines.map((l) => l.text) });
    return;
  }
  const levels = lines.map((line) => levelOf(roomId, line.id, line.text));
  check(`${tag}_LIST_TELLS_THE_SEEDS_${level.toUpperCase()}_CLUES`, same(lines.map((l) => l.text), want.list) && levels.every((l) => l === level), { shown: lines.map((l) => l.text), want: want.list, levels });
  const named = lines.flatMap((line) => namesAny(roomId, round.ids, `${line.text} ${line.aria}`));
  check(`${tag}_NO_PICTURE_NO_NAME_BEFORE_THE_FIND`, lines.every((line) => !line.picture) && named.length === 0, { named, pictures: lines.filter((l) => l.picture).map((l) => l.id) });
}

/** Fácil's ladder on one line: station → area (a pool of light, not on the object) → "Aqui está" with the reveal halo. */
async function checkEasyLadder(tag, session, roomId, id) {
  const t = target(roomId, id);
  const station = ROOM[roomId].stations.find((s) => s.id === t.station);
  await focusLine(session, id);
  const one = await hint(session);
  const two = await hint(session);
  const three = await hint(session);
  check(`${tag}_FACIL_LADDER_ENDS_IN_THE_REVEAL`,
    one.banner === `Pista: procure ${station.hintPhrase}.` && !one.halo &&
      two.banner === `Pista: procure ${t.hintRegion}.` && two.halo === "hos-halo-hint" &&
      three.banner === `Aqui está: ${t.label}.` && three.halo === "hos-halo-reveal",
    { banners: [one.banner, two.banner, three.banner], halos: [one.halo, two.halo, three.halo] });
}

/** Médio's ladder: station → the reclue (the seed's direct variant) → direction; never a light, never framed. */
async function checkMediumLadder(tag, session, roomId, seed, id) {
  const t = target(roomId, id);
  const station = ROOM[roomId].stations.find((s) => s.id === t.station);
  const reclue = told(roomId, "medium", seed).reclue[id];
  await focusLine(session, id);
  const presses = [];
  for (let k = 0; k < 4; k += 1) presses.push(await hint(session));
  const [one, two, three, four] = presses;
  check(`${tag}_MEDIO_LADDER_STATION_RECLUE_DIRECTION`,
    one.banner === `Pista: procure ${station.hintPhrase}.` &&
      two.banner === `Pista: em outras palavras — ${reclue}` && levelOf(roomId, id, reclue) === "direct" &&
      three.banner === `Pista: olhe ${t.hintDirection}.` && four.banner === three.banner,
    { banners: presses.map((p) => p.banner), reclue });
  check(`${tag}_MEDIO_NEVER_LIGHTS_NOR_FRAMES`,
    presses.every((p) => !p.halo && !/Mostrar/.test(p.button ?? "") && !/Aqui está/.test(p.banner ?? "") && !framesObject(p.camera, roomId, id)) &&
      sameCamera(two.camera, one.camera) && sameCamera(three.camera, one.camera),
    { halos: presses.map((p) => p.halo), buttons: presses.map((p) => p.button) });
  check(`${tag}_MEDIO_HINTS_NEVER_NAME_IT`, presses.every((p) => namesAny(roomId, [id], `${p.banner} ${p.button} ${p.live}`).length === 0), { banners: presses.map((p) => p.banner) });
}

/** Difícil's ladder: station → context, then nothing more; no light, no framing, no name — until the find. */
async function checkHardLadder(tag, session, roomId, round) {
  const id = round.ids[0];
  const t = target(roomId, id);
  const station = ROOM[roomId].stations.find((s) => s.id === t.station);
  await focusLine(session, id);
  const presses = [];
  for (let k = 0; k < 3; k += 1) presses.push(await hint(session));
  const [one, two, three] = presses;
  check(`${tag}_DIFICIL_LADDER_STATION_CONTEXT`, one.banner === `Pista: procure ${station.hintPhrase}.` && two.banner === `Pista: está ${t.hintContext}.` && three.banner === two.banner, { banners: presses.map((p) => p.banner) });
  check(`${tag}_DIFICIL_NEVER_LIGHTS_NOR_FRAMES`,
    presses.every((p) => !p.halo && !/Mostrar/.test(p.button ?? "") && !framesObject(p.camera, roomId, id)) && sameCamera(two.camera, one.camera) && sameCamera(three.camera, one.camera),
    { halos: presses.map((p) => p.halo) });
  const pending = round.ids;
  const said = presses.flatMap((p) => namesAny(roomId, pending, `${p.banner} ${p.button} ${p.live}`));
  check(`${tag}_DIFICIL_NAMES_NOTHING_BEFORE_THE_FIND`, said.length === 0, { said });
  const found = await find(session, roomId, id);
  await showList(session);
  const line = (await listOnScreen(session.page)).find((l) => l.id === id);
  const live = (await ui(session.page)).live;
  check(`${tag}_THE_FIND_SAYS_THE_NAME`, found && line.found && line.text === t.label && line.answered === told(roomId, "hard", round.seed).list[0] && live.includes(t.label), { line, live });
}

// --- scenario: desktop ------------------------------------------------------------------------------------------

async function desktopRoom(roomId, tag) {
  const seeds = SEEDS["cal-desktop"][roomId];
  const session = await openSession({ width: 1440, height: 900, seeds });
  const { page } = session;
  await enterGame03(session);
  await chooseRoom(session, roomId);

  const easy = await explore(session, "easy");
  checkList(`${tag}_EASY`, roomId, "easy", seeds[0], easy, await listOnScreen(page));
  await checkEasyLadder(tag, session, roomId, easy.ids[0]);
  await witness(page, `cal-desktop-${roomId}-easy`, 300);
  metrics.rounds[`desktop ${roomId} easy`] = easy;
  await backToSetup(session);

  await chooseRoom(session, roomId);
  const medium = await explore(session, "medium");
  checkList(`${tag}_MEDIUM`, roomId, "medium", seeds[1], medium, await listOnScreen(page));
  await witness(page, `cal-desktop-${roomId}-medium`, 300);
  await checkMediumLadder(tag, session, roomId, seeds[1], medium.ids[0]);
  await witness(page, `cal-desktop-${roomId}-medium-reclue`);
  metrics.rounds[`desktop ${roomId} medium`] = medium;
  await backToSetup(session);

  await chooseRoom(session, roomId);
  const hard = await explore(session, "hard");
  checkList(`${tag}_HARD`, roomId, "hard", seeds[2], hard, await listOnScreen(page));
  await witness(page, `cal-desktop-${roomId}-hard`, 300);
  await checkHardLadder(tag, session, roomId, hard);
  metrics.rounds[`desktop ${roomId} hard`] = hard;
  const finished = await finishRound(session, roomId);
  const saved = (await storedResults(page))[0];
  check(`${tag}_DIFICIL_PLAYED_TO_THE_END`, finished.missed.length === 0 && saved?.details.sceneId === roomId && saved.details.roundSeed === seeds[2] && saved.score === 8 && saved.details.difficulty === "hard", { finished, saved: saved?.details });
  await witness(page, `cal-desktop-${roomId}-result`, 300);
  check(`${tag}_NO_PAGE_ERRORS`, session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}
async function desktop() {
  current = "cal-desktop";
  await desktopRoom(STUDIO, "STUDIO");
  await desktopRoom(OBSERVATORY, "OBSERVATORY");
}

// --- scenario: phone, portrait --------------------------------------------------------------------------------

async function mobile() {
  current = "cal-mobile";
  {
    const seeds = SEEDS["cal-mobile"][OBSERVATORY];
    const session = await openSession({ width: 390, height: 844, touch: true, seeds });
    const { page } = session;
    await enterGame03(session);
    await chooseRoom(session, OBSERVATORY);
    const round = await explore(session, "hard");
    await showList(session);
    const lines = await listOnScreen(page);
    checkList("OBSERVATORY_HARD", OBSERVATORY, "hard", seeds[0], round, lines);
    const strip = await listBox(page);
    check("OBSERVATORY_CLUE_LINES_FIT_THE_PHONE", lines.every((l) => l.fits) && strip && strip.left >= 0 && strip.right <= 390 && (await overflow(page)) <= 0, { strip, lines: lines.map((l) => ({ id: l.id, fits: l.fits })) });
    await witness(page, "cal-mobile-observatory-hard-list");
    await press(session, page.locator(".hos-tray-toggle"));
    await press(session, page.locator(".hos-tray-toggle"));
    check("OBSERVATORY_FOLDING_THE_TRAY_KEEPS_THE_CLUES", same((await listOnScreen(page)).map((l) => l.text), lines.map((l) => l.text)));
    await hideList(session);
    let cam = await camera(page);
    const centre = { x: cam.left + cam.width / 2, y: cam.top + cam.height / 2 };
    await drag(session, centre, { x: centre.x - 120, y: centre.y + 20 }, 16);
    await settle(page);
    await pinch(session, centre, 60, 200);
    await settle(page);
    const moved = await camera(page);
    check("OBSERVATORY_DRAG_AND_PINCH", Math.abs(moved.tx - cam.tx) > 40 && moved.s > cam.s, { before: cam, after: moved });
    await checkHardLadder("OBSERVATORY", session, OBSERVATORY, round);
    await showList(session);
    check("OBSERVATORY_CLUES_HOLD_AFTER_TOUCH", same((await listOnScreen(page)).filter((l) => !l.found).map((l) => l.text), lines.filter((l) => l.id !== round.ids[0]).map((l) => l.text)));
    await witness(page, "cal-mobile-observatory-hard-found");
    check("OBSERVATORY_NO_HORIZONTAL_OVERFLOW", (await overflow(page)) <= 0, { overflow: await overflow(page) });
    check("OBSERVATORY_NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
    await session.context.close();
  }
  {
    const seeds = SEEDS["cal-mobile"][STUDIO];
    const session = await openSession({ width: 390, height: 844, touch: true, seeds });
    const { page } = session;
    await enterGame03(session);
    await chooseRoom(session, STUDIO);
    const round = await explore(session, "medium");
    await showList(session);
    const lines = await listOnScreen(page);
    checkList("STUDIO_MEDIUM", STUDIO, "medium", seeds[0], round, lines);
    const strip = await listBox(page);
    check("STUDIO_CLUE_LINES_FIT_THE_PHONE", lines.every((l) => l.fits) && strip && strip.left >= 0 && strip.right <= 390, { strip, lines: lines.map((l) => ({ id: l.id, fits: l.fits })) });
    await checkMediumLadder("STUDIO", session, STUDIO, seeds[0], round.ids[0]);
    const banner = await page.evaluate(() => document.querySelector(".hos-hint-banner")?.getBoundingClientRect().toJSON());
    check("STUDIO_RECLUE_BANNER_FITS_THE_PHONE", banner && banner.left >= 0 && banner.right <= 390, { banner });
    await witness(page, "cal-mobile-studio-medium-reclue");
    const found = await find(session, STUDIO, round.ids[1]);
    check("STUDIO_TOUCH_FIND", found);
    check("STUDIO_NO_HORIZONTAL_OVERFLOW", (await overflow(page)) <= 0, { overflow: await overflow(page) });
    check("STUDIO_NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
    await session.context.close();
  }
}

// --- scenario: phone, landscape ---------------------------------------------------------------------------------

async function landscape() {
  current = "cal-landscape";
  const seeds = SEEDS["cal-landscape"][STUDIO];
  const session = await openSession({ width: 844, height: 390, touch: true, seeds });
  const { page } = session;
  await enterGame03(session);
  await chooseRoom(session, STUDIO);
  await press(session, page.locator(".hos-difficulty-option", { hasText: LEVEL.hard }));
  const exploreBox = await page.getByRole("button", { name: "Explorar", exact: true }).boundingBox();
  check("EXPLORAR_IN_REACH", exploreBox && exploreBox.y + exploreBox.height <= 390, { exploreBox });
  const round = await explore(session, "hard");
  await showList(session);
  const lines = await listOnScreen(page);
  checkList("STUDIO_HARD", STUDIO, "hard", seeds[0], round, lines);
  const strip = await listBox(page);
  check("CLUE_LINES_FIT", lines.every((l) => l.fits) && strip && strip.left >= 0 && strip.right <= 844, { strip, lines: lines.map((l) => ({ id: l.id, fits: l.fits })) });
  await witness(page, "cal-landscape-studio-hard");
  // the phone turned upright mid-round, then back: the round and its clues hold
  await page.setViewportSize({ width: 390, height: 844 });
  await settle(page);
  await showList(session);
  const upright = await listOnScreen(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await settle(page);
  await showList(session);
  const back = await listOnScreen(page);
  const after = await roundOnScreen(page);
  check("ROTATION_KEEPS_THE_ROUND_AND_ITS_CLUES", same(after.ids, round.ids) && same(upright.map((l) => l.text), lines.map((l) => l.text)) && same(back.map((l) => l.text), lines.map((l) => l.text)), { upright: upright.map((l) => l.text) });
  const found = await find(session, STUDIO, round.ids[2]);
  check("TOUCH_FIND", found);
  check("NO_HORIZONTAL_OVERFLOW", (await overflow(page)) <= 0, { overflow: await overflow(page) });
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: reduced motion -----------------------------------------------------------------------------------

async function reducedMotion() {
  current = "cal-reduced-motion";
  const seeds = SEEDS["cal-reduced-motion"][OBSERVATORY];
  const session = await openSession({ width: 1440, height: 900, reducedMotion: "reduce", seeds });
  const { page } = session;
  await enterGame03(session);
  await chooseRoom(session, OBSERVATORY);
  const round = await explore(session, "medium");
  const lines = await listOnScreen(page);
  checkList("OBSERVATORY_MEDIUM", OBSERVATORY, "medium", seeds[0], round, lines);
  // a station cuts: the camera is there on the next frames, nothing glides
  const t = target(OBSERVATORY, round.ids[0]);
  const station = ROOM[OBSERVATORY].stations.find((s) => s.id === t.station);
  const other = ROOM[OBSERVATORY].stations.find((s) => s.id !== t.station);
  await press(session, page.locator(".hos-station", { hasText: other.label }));
  await frames(page, 2);
  const cut = await page.evaluate(() => document.querySelector(".hos-world")?.dataset.moving !== "true");
  check("STATIONS_CUT", cut);
  await checkMediumLadder("OBSERVATORY", session, OBSERVATORY, seeds[0], round.ids[0]);
  void station;
  check("CLUES_HOLD", same((await listOnScreen(page)).map((l) => l.text), lines.map((l) => l.text)));
  await witness(page, "cal-reduced-motion-observatory-medium");
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: replay ------------------------------------------------------------------------------------------

/** Two seeds whose Difícil rounds in the Estúdio share an object the two rounds tell differently. */
function seedsTellingAnObjectTwoWays() {
  const first = 8401;
  const a = told(STUDIO, "hard", first);
  for (let seed = 8402; seed < 9400; seed += 1) {
    const b = told(STUDIO, "hard", seed);
    const shared = a.ids.find((id) => b.ids.includes(id) && a.list[a.ids.indexOf(id)] !== b.list[b.ids.indexOf(id)]);
    if (shared) return { seeds: [first, seed], object: shared };
  }
  return null;
}
async function visit(seed, difficulty) {
  const session = await openSession({ width: 1280, height: 800, seeds: [seed] });
  await enterGame03(session);
  await chooseRoom(session, STUDIO);
  const round = await explore(session, difficulty);
  return { session, round, lines: await listOnScreen(session.page) };
}
async function replay() {
  current = "cal-replay";
  const pair = seedsTellingAnObjectTwoWays();
  if (!check("A_PAIR_OF_SEEDS_EXISTS", Boolean(pair), { pair })) return;
  const one = await visit(pair.seeds[0], "hard");
  const two = await visit(pair.seeds[0], "hard");
  check("SAME_SEED_SAME_CLUES_ON_A_FRESH_VISIT", same(one.round.ids, two.round.ids) && same(one.lines.map((l) => l.text), two.lines.map((l) => l.text)) && same(one.lines.map((l) => l.text), told(STUDIO, "hard", pair.seeds[0]).list), {
    first: one.lines.map((l) => l.text),
    second: two.lines.map((l) => l.text),
  });
  await one.session.context.close();
  await two.session.context.close();
  const three = await visit(pair.seeds[1], "hard");
  const before = one.lines.find((l) => l.id === pair.object)?.text;
  const now = three.lines.find((l) => l.id === pair.object)?.text;
  check("ANOTHER_SEED_TELLS_AN_OBJECT_ANOTHER_WAY", before && now && before !== now && levelOf(STUDIO, pair.object, now) === "indirect", { object: pair.object, before, now });
  await three.session.context.close();
  // Recomeçar: the same lines and the same reclue, nothing drawn again
  const seed = 8501;
  const medium = await visit(seed, "medium");
  const { session } = medium;
  const draws = await session.page.evaluate(() => window.__probeDraws.length);
  await focusLine(session, medium.round.ids[1]);
  await hint(session);
  const reclue = (await hint(session)).banner;
  await find(session, STUDIO, medium.round.ids[0]);
  await press(session, session.page.getByRole("button", { name: "Recomeçar a exploração" }));
  await settle(session.page);
  await showList(session);
  const again = await listOnScreen(session.page);
  await focusLine(session, medium.round.ids[1]);
  await hint(session);
  const reclueAgain = (await hint(session)).banner;
  check("RECOMECAR_KEEPS_THE_CLUES", same(again.map((l) => l.text), medium.lines.map((l) => l.text)) && again.every((l) => !l.found) && reclue === reclueAgain && (await session.page.evaluate(() => window.__probeDraws.length)) === draws, {
    before: medium.lines.map((l) => l.text),
    after: again.map((l) => l.text),
    reclue,
    reclueAgain,
  });
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- run ---------------------------------------------------------------------------------------------------------

const runners = { "cal-desktop": desktop, "cal-mobile": mobile, "cal-landscape": landscape, "cal-reduced-motion": reducedMotion, "cal-replay": replay };
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
console.log(failed.length ? "HIDDEN_OBJECTS_CALIBRATION_PROBE_FAILED" : "HIDDEN_OBJECTS_CALIBRATION_PROBE_OK");
process.exit(failed.length ? EXIT_FAILED : EXIT_OK);
