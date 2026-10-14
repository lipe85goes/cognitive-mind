/**
 * GAME03-FINAL-POLISH-LOCK-06 — the lock candidate's smoke matrix, on a production
 * build, played the way a person plays it (Playwright; the same helpers as
 * hidden-objects-replayability-probe.mjs). It adds what no earlier probe held as
 * a whole: both rooms × every difficulty, full rounds through the shared result
 * screen — whose title must fit the room played (it read "Estúdio explorado"
 * over the Observatório's summary) — the Difícil rounds with an object kept
 * behind a piece and the list's objects off their painted spot, a keyboard-only
 * find, and the narrow phone.
 *
 * Scenarios (all by default; pick with --scenario a,b):
 *   lock-studio        Estúdio, desktop: Fácil full round (hint ladder to "Mostrar onde está") → result →
 *                      "Praticar outra vez" (same room, new round) → Médio representative (two finds, a hint
 *                      that never names) → "Recomeçar" keeps the round → Difícil full round with a kept object
 *                      (open its piece, find it) and listed objects off their painted spot → result
 *   lock-observatory   Observatório, desktop: Fácil representative → "Trocar de cena" → Médio full round → result
 *                      → Difícil full round, kept object and off-spot objects → result
 *   lock-phone         320×568 Observatório Difícil (Explorar in reach, list readable, every station label whole with the
 *                      list open or folded, a piece tapped open, a find, no overflow) · 390×844 Estúdio Médio (finds) turned to 844×390 mid-round (the round holds,
 *                      the search goes on) · 390×844 Fácil to the result screen
 *   lock-keyboard      reduced motion, keyboard only: room, difficulty and Explorar from the keys; a piece opened
 *                      with Enter (aria-expanded); the hint ladder to "Mostrar onde está" and Enter on the reticle
 *                      finds the object; focus is visible on every stop; no picture of the room is ever tabbable
 *
 * Every round on screen is checked against what the source composes for its seed (list, layout signature, every
 * picture's slot and rectangle). Visual witnesses (WebP) go to --out.
 *
 * Usage:
 *   node tools/validation/hidden-objects-final-lock-probe.mjs [--base http://localhost:3100]
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
const ALL = ["lock-studio", "lock-observatory", "lock-phone", "lock-keyboard"];
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
const SUMMARY = { [STUDIO]: "Você encontrou todos os objetos do Estúdio.", [OBSERVATORY]: "Você encontrou todos os objetos do Observatório." };
const RESULT_TITLE = "Exploração concluída";
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const boundsOf = (region) => (region.kind === "rect" ? { x: region.x, y: region.y, w: region.w, h: region.h } : { x: region.cx - region.r, y: region.cy - region.r, w: 2 * region.r, h: 2 * region.r });
const centreOf = (region) => {
  const b = boundsOf(region);
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
};
function composed(roomId, difficulty, seed) {
  const draw = ROUNDS.selectRound(ROOM[roomId], difficulty, seed);
  const room = LAYOUT.placedScene(ROOM[roomId], draw.layout);
  const sprites = LAYOUT.layoutSprites(ROOM[roomId], draw.layout).map((s) => ({ thing: s.thing, slot: s.slot, x: s.sprite.x, y: s.sprite.y, w: s.sprite.w, h: s.sprite.h }));
  return { ...draw, room, sprites };
}
const placedTarget = (c, id) => c.room.pool.find((t) => t.id === id);
const homeTarget = (roomId, id) => ROOM[roomId].pool.find((t) => t.id === id);
/** Listed objects that stand off their painted spot in this composition. */
const offHome = (roomId, c) => c.targets.filter((id) => Math.hypot(centreOf(placedTarget(c, id).region).x - centreOf(homeTarget(roomId, id).region).x, centreOf(placedTarget(c, id).region).y - centreOf(homeTarget(roomId, id).region).y) >= 120);
const keptListed = (roomId, c) => c.targets.filter((id) => homeTarget(roomId, id).gate);
/** The first seed (from `from` up) whose composition in (room, difficulty) satisfies `predicate(c)`. */
function seedWhere(roomId, difficulty, predicate, from = 7001) {
  for (let seed = from; seed < 200_000; seed += 1) if (predicate(composed(roomId, difficulty, seed))) return seed;
  throw new Error(`no seed in ${roomId}/${difficulty}`);
}
/** A Difícil round with an object kept behind a piece, itself off its first spot, and two more listed objects off theirs. */
const hardSeed = (roomId) =>
  seedWhere(roomId, "hard", (c) => {
    const kept = keptListed(roomId, c);
    return kept.length > 0 && kept.some((id) => (c.layout.picks[id] ?? 0) !== 0) && offHome(roomId, c).length >= 3;
  });

// --- results ----------------------------------------------------------------------------------------------

const results = [];
const metrics = {};
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
  const native = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = (array) => {
    if (!(array instanceof Uint32Array)) return native(array);
    for (let i = 0; i < array.length; i += 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      array[i] = queue.length ? queue.shift() >>> 0 : state;
    }
    return array;
  };
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
/** The round as the page shows it: room, seed, layout signature, list, every movable picture (and whether any is tabbable). */
async function roundOnScreen(page) {
  return page.evaluate(() => {
    const shell = document.querySelector(".hos-shell");
    return {
      scene: shell?.dataset.scene ?? null,
      status: shell?.dataset.status ?? null,
      seed: shell?.dataset.roundSeed === undefined ? null : Number(shell.dataset.roundSeed),
      signature: shell?.dataset.layout ?? null,
      ids: [...document.querySelectorAll(".hos-item")].map((item) => item.dataset.target ?? null),
      listText: [...document.querySelectorAll(".hos-item")].map((item) => item.textContent ?? ""),
      listNames: [...document.querySelectorAll(".hos-item")].map((item) => item.getAttribute("aria-label") ?? ""),
      things: [...document.querySelectorAll(".hos-thing")]
        .map((e) => ({ thing: e.dataset.thing, slot: e.dataset.slot, x: parseFloat(e.style.left), y: parseFloat(e.style.top), w: parseFloat(e.style.width), h: parseFloat(e.style.height), tabbable: e.tabIndex >= 0 || e.getAttribute("role") !== null }))
        .sort((a, b) => (a.thing < b.thing ? -1 : 1)),
      thingsHidden: document.querySelector(".hos-things")?.getAttribute("aria-hidden") ?? null,
    };
  });
}
const progress = (page) =>
  page.evaluate(() => {
    const bar = document.querySelector(".hos-progress");
    return bar ? { found: Number(bar.getAttribute("aria-valuenow")), total: Number(bar.getAttribute("aria-valuemax")) } : null;
  });
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const isFound = (page, id) => page.evaluate((t) => document.querySelector(`.hos-item[data-target="${t}"]`)?.dataset.found === "true", id);
const hintText = (page) => page.evaluate(() => document.querySelector(".hos-hint-banner")?.textContent ?? "");
/** The page's round is the source's composition for its seed, and no picture of the room takes focus. */
function holdsComposition(name, shown, roomId, difficulty, seed) {
  const c = composed(roomId, difficulty, seed);
  const pictures = [...c.sprites].sort((a, b) => (a.thing < b.thing ? -1 : 1));
  return check(
    name,
    shown.scene === roomId && shown.seed === seed && same(shown.ids, c.targets) && shown.signature === c.layout.signature && same(shown.things.map(({ thing, slot, x, y, w, h }) => ({ thing, slot, x, y, w, h })), pictures) && shown.thingsHidden === "true" && shown.things.every((t) => !t.tabbable),
    { seed, signature: shown.signature, expected: c.layout.signature, list: shown.ids, expectedList: c.targets },
  );
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
  const intro = await page.evaluate(() => document.querySelector(".pgi-shell, .wentry-intro-layer")?.textContent ?? "");
  await press(session, page.locator(".pgi-cta"));
  await page.waitForSelector(".hos-setup", { state: "visible" });
  return { intro };
}
const explorarReady = (page) =>
  page.waitForFunction(() => {
    const button = [...document.querySelectorAll(".hos-setup .hos-primary")][0];
    return button && !button.disabled && /Explorar/.test(button.textContent);
  }, null, { timeout: 30000 });
async function chooseRoom(session, roomId) {
  const { page } = session;
  if ((await page.evaluate(() => document.querySelector(".hos-shell")?.dataset.scene)) !== roomId) {
    await press(session, page.locator(".hos-scene-option", { hasText: ROOM[roomId].name }));
    await page.waitForFunction((id) => document.querySelector(".hos-shell")?.dataset.scene === id, roomId);
  }
  await explorarReady(page);
}
async function explore(session, difficulty) {
  const { page } = session;
  await press(session, page.locator(".hos-difficulty-option", { hasText: LEVEL[difficulty] }));
  await press(session, page.getByRole("button", { name: "Explorar", exact: true }));
  await page.waitForFunction(() => document.querySelector(".hos-shell")?.dataset.status === "playing");
  await settle(page);
  return roundOnScreen(page);
}
async function hideList(session) {
  const open = await session.page.evaluate(() => !document.querySelector(".hos-list")?.hidden);
  if (open && (await session.page.locator(".hos-tray-toggle").isVisible())) await press(session, session.page.locator(".hos-tray-toggle"));
}
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
/** A room point brought comfortably on screen (its station, then a drag): its screen position. */
async function bringSpot(session, roomId, stationId, spot) {
  const { page } = session;
  await hideList(session);
  const station = ROOM[roomId].stations.find((s) => s.id === stationId);
  await press(session, page.locator(".hos-station", { hasText: station.label }).first());
  await settle(page);
  let cam = await camera(page);
  let point = toScreen(cam, spot);
  for (let attempt = 0; attempt < 3 && !(await comfortable(page, cam, point)); attempt += 1) {
    const centre = { x: cam.left + cam.width / 2, y: cam.top + cam.height / 2 };
    await drag(session, centre, { x: centre.x + (centre.x - point.x), y: centre.y + (centre.y - point.y) });
    await settle(page);
    cam = await camera(page);
    point = toScreen(cam, spot);
  }
  return point;
}
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
/** Find one listed object where this round's layout puts it (opening its piece first if it is kept): whether the count went up. */
async function find(session, roomId, c, id) {
  const { page } = session;
  const target = placedTarget(c, id);
  if (target.gate && !(await page.evaluate((g) => document.querySelector(`.hos-piece[data-piece="${g}"]`)?.dataset.open === "true", target.gate))) await openPiece(session, roomId, target.gate);
  const before = await progress(page);
  const point = await bringSpot(session, roomId, target.station, centreOf(target.region));
  await tapAt(session, point);
  await page.waitForFunction((n) => Number(document.querySelector(".hos-progress")?.getAttribute("aria-valuenow")) > n, before.found, { timeout: 2500 }).catch(() => {});
  return (await progress(page)).found > before.found;
}
/** Every object still on the list, then the closing card, "Concluir exploração" and the shared result screen. */
async function finishRound(session, roomId, c) {
  const { page } = session;
  const missed = [];
  for (const id of c.targets) if (!(await isFound(page, id)) && !(await find(session, roomId, c, id))) missed.push(id);
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
const resultFits = (roomId, finished) =>
  finished.missed.length === 0 && finished.modal.world === "Estúdio das Descobertas" && finished.modal.title === RESULT_TITLE && finished.modal.summary === SUMMARY[roomId] && !(roomId === OBSERVATORY && /Estúdio/.test(`${finished.modal.title} ${finished.modal.summary}`));
/** "Praticar outra vez": the platform's entry again (its transition and "Como jogar"), then the setup. */
async function practiceAgain(session) {
  const { page } = session;
  await press(session, page.getByRole("button", { name: "Praticar este desafio outra vez" }));
  await page.waitForFunction(() => !document.querySelector(".wtx-shell"), null, { timeout: 30000 });
  await page.waitForSelector(".pgi-cta", { state: "visible" });
  await press(session, page.locator(".pgi-cta"));
  await page.waitForSelector(".hos-setup", { state: "visible", timeout: 15000 });
}
/** Hints asked `times` times for the focused subject: the banner each time. */
async function askHints(session, times) {
  const lines = [];
  for (let i = 0; i < times; i += 1) {
    await press(session, session.page.locator(".hos-hint-button"));
    await settle(session.page);
    lines.push(await hintText(session.page));
  }
  return lines;
}
const subjectId = (page) => page.evaluate(() => document.querySelector('.hos-item[data-focused="true"]')?.dataset.target ?? [...document.querySelectorAll(".hos-item")].find((i) => i.dataset.found !== "true")?.dataset.target ?? null);

// --- scenario: the Estúdio, desktop ---------------------------------------------------------------------------

async function lockStudio() {
  current = "lock-studio";
  const easy = seedWhere(STUDIO, "easy", (c) => offHome(STUDIO, c).length >= 1);
  const medium = seedWhere(STUDIO, "medium", (c) => offHome(STUDIO, c).length >= 2, 9101);
  const hard = hardSeed(STUDIO);
  const session = await openSession({ width: 1440, height: 900, seeds: [easy, medium, hard] });
  const { page } = session;
  const { intro } = await enterGame03(session);
  check("THE_INTRO_NAMES_NO_SINGLE_ROOM", /salas do explorador/.test(intro) && /Escolha a sala e a dificuldade/.test(intro) && !/entre no estúdio/i.test(intro), { intro: intro.slice(0, 240) });
  await chooseRoom(session, STUDIO);
  await witness(page, "studio-setup");

  // Fácil, full: the hint ladder to "Mostrar onde está", every object, the result
  let shown = await explore(session, "easy");
  let c = composed(STUDIO, "easy", easy);
  holdsComposition("EASY_ROUND_IS_ITS_SEED", shown, STUDIO, "easy", easy);
  const easyHints = await askHints(session, 3);
  check("EASY_HINT_LADDER_GOES_TO_SHOW_WHERE", easyHints.length === 3 && easyHints.every(Boolean) && (await page.locator(".hos-halo").count()) > 0, { easyHints });
  await witness(page, "studio-easy-hint", 300);
  let finished = await finishRound(session, STUDIO, c);
  check("EASY_FULL_ROUND_TO_THE_RESULT", resultFits(STUDIO, finished) && finished.card === "Estúdio explorado", finished);
  await witness(page, "studio-easy-result", 600);

  // "Praticar outra vez": the same room, a new round — Médio, representative
  await practiceAgain(session);
  check("PRACTICE_AGAIN_KEEPS_THE_ROOM", (await page.evaluate(() => document.querySelector(".hos-shell")?.dataset.scene)) === STUDIO);
  await explorarReady(page);
  shown = await explore(session, "medium");
  c = composed(STUDIO, "medium", medium);
  holdsComposition("MEDIUM_ROUND_IS_ITS_SEED", shown, STUDIO, "medium", medium);
  check("MEDIUM_LIST_NAMES_NOTHING", c.targets.every((id, i) => !shown.listText[i].includes(homeTarget(STUDIO, id).label)), { list: shown.listText });
  const subject = await subjectId(page);
  const mediumHints = await askHints(session, 3);
  check("MEDIUM_HINTS_NEVER_NAME_OR_REVEAL", mediumHints.every((line) => !line.includes(homeTarget(STUDIO, subject).label)) && (await page.locator('.hos-halo-reveal').count()) === 0, { subject, mediumHints });
  const two = [];
  for (const id of offHome(STUDIO, c).slice(0, 2)) two.push(await find(session, STUDIO, c, id));
  check("MEDIUM_FINDS_OFF_THEIR_PAINTED_SPOT", two.length === 2 && two.every(Boolean), { found: offHome(STUDIO, c).slice(0, 2) });
  await witness(page, "studio-medium-found", 300);
  // "Recomeçar" keeps the round and its layout, and starts the count again
  await press(session, page.getByRole("button", { name: "Recomeçar a exploração" }));
  await settle(page);
  const again = await roundOnScreen(page);
  check("RESTART_KEEPS_ROUND_AND_LAYOUT", again.signature === shown.signature && same(again.ids, shown.ids) && (await progress(page)).found === 0, { before: shown.signature, after: again.signature });

  // Difícil, full: a kept object behind its piece, objects off their painted spot
  await press(session, page.getByRole("button", { name: "Trocar de cena" }));
  await page.waitForSelector(".hos-setup", { state: "visible" });
  await explorarReady(page);
  shown = await explore(session, "hard");
  c = composed(STUDIO, "hard", hard);
  holdsComposition("HARD_ROUND_IS_ITS_SEED", shown, STUDIO, "hard", hard);
  check("HARD_LIST_NAMES_NOTHING_BEFORE_A_FIND", c.targets.every((id, i) => !shown.listText[i].includes(homeTarget(STUDIO, id).label) && !shown.listNames[i].includes(homeTarget(STUDIO, id).label)), { list: shown.listText });
  const kept = keptListed(STUDIO, c);
  const keptId = kept.find((id) => (c.layout.picks[id] ?? 0) !== 0);
  const shutTap = await (async () => {
    const before = await progress(page);
    const target = placedTarget(c, keptId);
    const point = await bringSpot(session, STUDIO, target.station, centreOf(target.region));
    await tapAt(session, point);
    await settle(page);
    return { counted: (await progress(page)).found > before.found, open: await page.evaluate((g) => document.querySelector(`.hos-piece[data-piece="${g}"]`)?.dataset.open === "true", target.gate) };
  })();
  check("HARD_KEPT_OBJECT_NOT_FOUND_THROUGH_ITS_SHUT_PIECE", !shutTap.counted && shutTap.open, { keptId, slot: c.layout.picks[keptId], shutTap });
  await witness(page, "studio-hard-kept-open", 300);
  const hardHints = await askHints(session, 3);
  check("HARD_HINTS_NEVER_REVEAL", (await page.locator('.hos-halo-reveal').count()) === 0 && hardHints.length > 0, { hardHints });
  finished = await finishRound(session, STUDIO, c);
  check("HARD_FULL_ROUND_TO_THE_RESULT", resultFits(STUDIO, finished), { ...finished, offHome: offHome(STUDIO, c), kept });
  await witness(page, "studio-hard-result", 600);
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  metrics.studioSeeds = { easy, medium, hard };
  await session.context.close();
}

// --- scenario: the Observatório, desktop --------------------------------------------------------------------------

async function lockObservatory() {
  current = "lock-observatory";
  const easy = seedWhere(OBSERVATORY, "easy", (c) => offHome(OBSERVATORY, c).length >= 1, 7301);
  const medium = seedWhere(OBSERVATORY, "medium", (c) => offHome(OBSERVATORY, c).length >= 2, 7401);
  const hard = hardSeed(OBSERVATORY);
  const session = await openSession({ width: 1440, height: 900, seeds: [easy, medium, hard] });
  const { page } = session;
  await enterGame03(session);
  await chooseRoom(session, OBSERVATORY);
  let shown = await explore(session, "easy");
  let c = composed(OBSERVATORY, "easy", easy);
  holdsComposition("EASY_ROUND_IS_ITS_SEED", shown, OBSERVATORY, "easy", easy);
  const id = offHome(OBSERVATORY, c)[0];
  check("EASY_FINDS_OFF_ITS_PAINTED_SPOT", await find(session, OBSERVATORY, c, id), { id });
  await witness(page, "observatory-easy-found", 300);
  // "Trocar de cena" mid-round: the setup, nothing saved; then Médio, full
  await press(session, page.getByRole("button", { name: "Trocar de cena" }));
  await page.waitForSelector(".hos-setup", { state: "visible" });
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("cognitive-mind-recent-results") ?? "[]").length);
  check("CHANGE_SCENE_RETURNS_TO_SETUP_SAVING_NOTHING", stored === 0, { stored });
  await chooseRoom(session, OBSERVATORY);
  shown = await explore(session, "medium");
  c = composed(OBSERVATORY, "medium", medium);
  holdsComposition("MEDIUM_ROUND_IS_ITS_SEED", shown, OBSERVATORY, "medium", medium);
  let finished = await finishRound(session, OBSERVATORY, c);
  check("MEDIUM_FULL_ROUND_RESULT_FITS_THE_ROOM", resultFits(OBSERVATORY, finished) && finished.card === "Observatório explorado", finished);
  await witness(page, "observatory-medium-result", 600);
  await practiceAgain(session);
  await explorarReady(page);
  shown = await explore(session, "hard");
  c = composed(OBSERVATORY, "hard", hard);
  holdsComposition("HARD_ROUND_IS_ITS_SEED", shown, OBSERVATORY, "hard", hard);
  check("HARD_LIST_NAMES_NOTHING_BEFORE_A_FIND", c.targets.every((t, i) => !shown.listText[i].includes(homeTarget(OBSERVATORY, t).label)), { list: shown.listText });
  const kept = keptListed(OBSERVATORY, c);
  check("HARD_ROUND_KEEPS_AN_OBJECT_OFF_ITS_FIRST_SPOT", kept.some((k) => (c.layout.picks[k] ?? 0) !== 0) && offHome(OBSERVATORY, c).length >= 3, { kept, offHome: offHome(OBSERVATORY, c) });
  await witness(page, "observatory-hard", 300);
  finished = await finishRound(session, OBSERVATORY, c);
  check("HARD_FULL_ROUND_RESULT_FITS_THE_ROOM", resultFits(OBSERVATORY, finished), finished);
  await witness(page, "observatory-hard-result", 600);
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  metrics.observatorySeeds = { easy, medium, hard };
  await session.context.close();
}

// --- scenario: phones ------------------------------------------------------------------------------------------------

async function lockPhone() {
  current = "lock-phone";
  // 320×568: the narrowest phone class — Observatório Difícil (its darkest room)
  const hard = hardSeed(OBSERVATORY);
  let session = await openSession({ width: 320, height: 568, touch: true, seeds: [hard] });
  let { page } = session;
  await enterGame03(session);
  await chooseRoom(session, OBSERVATORY);
  const reach = await page.evaluate(() => {
    const button = document.querySelector(".hos-setup .hos-primary");
    button?.scrollIntoView({ block: "nearest" });
    const r = button?.getBoundingClientRect();
    return r ? { top: r.top, bottom: r.bottom, width: r.width, viewport: innerHeight } : null;
  });
  check("NARROW_EXPLORAR_IN_REACH", reach && reach.bottom <= reach.viewport && reach.width >= 120 && (await overflow(page)) <= 0, { reach });
  await witness(page, "phone-320-setup");
  let shown = await explore(session, "hard");
  let c = composed(OBSERVATORY, "hard", hard);
  holdsComposition("NARROW_ROUND_IS_ITS_SEED", shown, OBSERVATORY, "hard", hard);
  const stationFit = async () => page.evaluate(() => [...document.querySelectorAll(".hos-station")].map((b) => ({ label: b.textContent, width: b.clientWidth, needs: b.scrollWidth })));
  const fitOpen = await stationFit();
  await press(session, page.locator(".hos-tray-toggle"));
  await settle(page);
  const fitClosed = await stationFit();
  await press(session, page.locator(".hos-tray-toggle"));
  await settle(page);
  check("NARROW_STATION_LABELS_FIT", [...fitOpen, ...fitClosed].every((f) => f.needs <= f.width + 1 && f.width >= 44), { fitOpen, fitClosed });
  const lines = await page.evaluate(() =>
    [...document.querySelectorAll(".hos-item-label")].map((e) => ({ clipped: e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1, text: e.textContent })),
  );
  check("NARROW_CLUES_FULLY_READABLE", lines.length === c.targets.length && lines.every((l) => !l.clipped), { lines });
  await witness(page, "phone-320-hard-list");
  const kept = keptListed(OBSERVATORY, c)[0];
  const gate = placedTarget(c, kept).gate;
  check("NARROW_PIECE_TAPS_OPEN", await openPiece(session, OBSERVATORY, gate), { gate });
  check("NARROW_KEPT_OBJECT_FOUND", await find(session, OBSERVATORY, c, kept), { kept });
  await witness(page, "phone-320-found", 300);
  check("NARROW_NO_HORIZONTAL_OVERFLOW", (await overflow(page)) <= 0);
  check("NARROW_NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();

  // 390×844, Estúdio Médio, then turned sideways mid-round
  const medium = seedWhere(STUDIO, "medium", (x) => offHome(STUDIO, x).length >= 2, 9301);
  const easy = seedWhere(STUDIO, "easy", (x) => offHome(STUDIO, x).length >= 1, 9401);
  session = await openSession({ width: 390, height: 844, touch: true, seeds: [medium, easy] });
  page = session.page;
  await enterGame03(session);
  await chooseRoom(session, STUDIO);
  shown = await explore(session, "medium");
  c = composed(STUDIO, "medium", medium);
  holdsComposition("PORTRAIT_ROUND_IS_ITS_SEED", shown, STUDIO, "medium", medium);
  const [first, second] = offHome(STUDIO, c);
  check("PORTRAIT_FIND", await find(session, STUDIO, c, first), { first });
  await witness(page, "phone-390-portrait", 300);
  await page.setViewportSize({ width: 844, height: 390 });
  await settle(page);
  await page.waitForTimeout(300);
  const turned = await roundOnScreen(page);
  check("ROTATION_KEEPS_ROUND_LAYOUT_AND_FINDS", turned.signature === shown.signature && same(turned.ids, shown.ids) && (await isFound(page, first)), { before: shown.signature, after: turned.signature });
  check("LANDSCAPE_FIND", await find(session, STUDIO, c, second), { second });
  check("LANDSCAPE_NO_HORIZONTAL_OVERFLOW", (await overflow(page)) <= 0);
  await witness(page, "phone-landscape", 300);
  await page.setViewportSize({ width: 390, height: 844 });
  await settle(page);
  // a Fácil round to the result screen on the phone
  await press(session, page.getByRole("button", { name: "Trocar de cena" }));
  await page.waitForSelector(".hos-setup", { state: "visible" });
  await explorarReady(page);
  shown = await explore(session, "easy");
  c = composed(STUDIO, "easy", easy);
  holdsComposition("PORTRAIT_EASY_ROUND_IS_ITS_SEED", shown, STUDIO, "easy", easy);
  const finished = await finishRound(session, STUDIO, c);
  const resultReach = await page.evaluate(() => {
    const button = [...document.querySelectorAll("button")].find((b) => b.getAttribute("aria-label") === "Praticar este desafio outra vez");
    button?.scrollIntoView({ block: "nearest" });
    const r = button?.getBoundingClientRect();
    return r ? { bottom: r.bottom, viewport: innerHeight, width: r.width } : null;
  });
  check("PHONE_RESULT_FLOW", resultFits(STUDIO, finished) && resultReach && resultReach.bottom <= resultReach.viewport && (await overflow(page)) <= 0, { finished, resultReach });
  await witness(page, "phone-390-result", 600);
  check("PHONE_NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- scenario: keyboard only, reduced motion ---------------------------------------------------------------------

/** What has focus, and whether it shows (an outline or a box shadow on it or on its option label). */
const focusInfo = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { tag: null, visible: false };
    const shows = (node) => {
      if (!node) return false;
      const s = getComputedStyle(node);
      return (s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0) || (s.boxShadow && s.boxShadow !== "none");
    };
    return { tag: el.tagName, cls: el.className, name: el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 40), visible: shows(el) || shows(el.closest("label")) };
  });
async function tabUntil(page, predicate, max = 40, value = null) {
  for (let i = 0; i < max; i += 1) {
    await page.keyboard.press("Tab");
    const info = await focusInfo(page);
    if (await page.evaluate(predicate, value)) return info;
  }
  return null;
}

async function lockKeyboard() {
  current = "lock-keyboard";
  const easy = seedWhere(OBSERVATORY, "easy", (c) => offHome(OBSERVATORY, c).length >= 1 && c.targets.some((id) => !homeTarget(OBSERVATORY, id).gate), 7501);
  const session = await openSession({ width: 1280, height: 800, reducedMotion: "reduce", seeds: [easy] });
  const { page } = session;
  await enterGame03(session);
  await explorarReady(page);
  const stops = [];
  // the room: Tab to the room radios, the arrow keys choose the Observatório
  const roomStop = await tabUntil(page, () => document.activeElement?.getAttribute("name") === "hos-scene");
  stops.push(roomStop);
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction((id) => document.querySelector(".hos-shell")?.dataset.scene === id, OBSERVATORY);
  await explorarReady(page);
  // the difficulty: Fácil
  const levelStop = await tabUntil(page, () => document.activeElement?.getAttribute("name") === "hos-difficulty");
  stops.push(levelStop);
  for (let i = 0; i < 3 && (await page.evaluate(() => document.querySelector('input[name="hos-difficulty"]:checked')?.value)) !== "easy"; i += 1) await page.keyboard.press("ArrowLeft");
  const exploreStop = await tabUntil(page, () => /Explorar/.test(document.activeElement?.textContent ?? ""));
  stops.push(exploreStop);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector(".hos-shell")?.dataset.status === "playing");
  await settle(page);
  const shown = await roundOnScreen(page);
  holdsComposition("KEYBOARD_ROUND_IS_ITS_SEED", shown, OBSERVATORY, "easy", easy);
  check("KEYS_CHOOSE_ROOM_DIFFICULTY_AND_START", Boolean(roomStop && levelStop && exploreStop), { stops });
  const c = composed(OBSERVATORY, "easy", easy);
  // a piece from its keyboard button: Enter steps it, aria-expanded follows
  const pieceStop = await tabUntil(page, () => document.activeElement?.classList.contains("hos-piece-key"));
  stops.push(pieceStop);
  const before = await page.evaluate(() => document.activeElement?.getAttribute("aria-expanded"));
  await page.keyboard.press("Enter");
  await settle(page);
  const after = await page.evaluate(() => document.activeElement?.getAttribute("aria-expanded"));
  check("ENTER_OPENS_A_PIECE_ARIA_EXPANDED_FOLLOWS", before === "false" && after === "true", { before, after });
  // the list, then the hint ladder to "Mostrar onde está", then Enter on the reticle finds it
  const id = c.targets.find((t) => !homeTarget(OBSERVATORY, t).gate && offHome(OBSERVATORY, c).includes(t)) ?? c.targets.find((t) => !homeTarget(OBSERVATORY, t).gate);
  const itemStop = await tabUntil(page, (t) => document.activeElement?.dataset?.target === t, 60, id);
  const listStop = itemStop ?? (await (async () => {
    await page.locator(`.hos-item[data-target="${id}"]`).focus();
    return focusInfo(page);
  })());
  stops.push(listStop);
  await page.keyboard.press("Enter");
  const hintStop = await tabUntil(page, () => document.activeElement?.classList.contains("hos-hint-button"));
  stops.push(hintStop);
  for (let i = 0; i < 3; i += 1) {
    await page.keyboard.press("Enter");
    await settle(page);
  }
  await page.waitForTimeout(200);
  await page.locator(".hos-viewport").focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction((t) => document.querySelector(`.hos-item[data-target="${t}"]`)?.dataset.found === "true", id, { timeout: 2500 }).catch(() => {});
  check("KEYBOARD_ONLY_FIND", await isFound(page, id), { id, hint: await hintText(page) });
  const live = await page.evaluate(() => [...document.querySelectorAll('[aria-live="polite"]')].map((e) => e.textContent).join(" | "));
  check("THE_FIND_IS_ANNOUNCED", live.includes(homeTarget(OBSERVATORY, id).label), { live });
  check("FOCUS_IS_VISIBLE_ON_EVERY_STOP", stops.every((s) => s && s.visible), { stops });
  const tabbablePictures = await page.evaluate(() => [...document.querySelectorAll(".hos-thing, .hos-layer, .hos-piece, .hos-piece-hotspot, .hos-halo")].filter((e) => e.tabIndex >= 0).length);
  check("NO_PICTURE_OF_THE_ROOM_IS_TABBABLE", tabbablePictures === 0, { tabbablePictures });
  await witness(page, "keyboard-find", 200);
  check("NO_PAGE_ERRORS", session.errors.length === 0, { errors: session.errors });
  await session.context.close();
}

// --- run ---------------------------------------------------------------------------------------------------

const RUN = { "lock-studio": lockStudio, "lock-observatory": lockObservatory, "lock-phone": lockPhone, "lock-keyboard": lockKeyboard };
for (const name of SCENARIOS) {
  try {
    await RUN[name]();
  } catch (error) {
    current = name;
    check("SCENARIO_RAN_TO_THE_END", false, { error: String(error?.stack ?? error).slice(0, 800) });
  }
}
await browser.close();
const failed = results.filter((r) => !r.pass);
if (JSON_OUT) fs.writeFileSync(JSON_OUT, `${JSON.stringify({ base: BASE, buildId: BUILD_ID, scenarios: SCENARIOS, results, metrics }, null, 2)}\n`);
console.log(`\n${results.length - failed.length}/${results.length} checks held · failing: ${failed.map((r) => `${r.scenario}:${r.id}`).join(", ") || "none"}`);
console.log(failed.length ? "HIDDEN_OBJECTS_FINAL_LOCK_PROBE_FAILED" : "HIDDEN_OBJECTS_FINAL_LOCK_PROBE_OK");
process.exit(failed.length ? EXIT_FAILED : EXIT_OK);
