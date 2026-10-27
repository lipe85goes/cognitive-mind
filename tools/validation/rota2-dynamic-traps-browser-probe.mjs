/**
 * ROTA2-DYNAMIC-TRAPS-01 — browser probe: the dynamic trap in the real app
 * (production build), played from the screen.
 *
 * Every scenario enters the Rota from Home (intro → setup → "Iniciar rota")
 * and plays from what the board publishes on its canvas — the cells, the trap
 * links (`data-trap-link-cells`), the walls traps opened
 * (`data-trap-opened-wall-cells`), the projected cell centres — with the
 * Sentinel's cell read from the board component's own props (read-only).
 * Nothing in the app is instrumented; the init script only observes.
 *
 *   main          keyboard, desktop: the dormant pair is published and visible
 *                 (lavender rune on the trap and on its wall, measured on the
 *                 pixels against a plain trap), the Explorer walks to the trap,
 *                 steps on it, the wall opens (published, gone from the walls,
 *                 its pixels change), the Explorer walks through the opened
 *                 cell, the defenders' next turns are watched, and "Começar
 *                 outra rota" brings a board with nothing opened.
 *   pickaxe       the Chest's Picareta opens the linked wall first; the trap
 *                 then arms and opens nothing else.
 *   mobile        390×844 touch: the same activation through the D-pad taps.
 *   reduced       prefers-reduced-motion: the same semantics; the wall is open
 *                 in the first frame after the step and no pulse fades out.
 *   continuation  the trap opens on Route 1, Route 1 is lost on purpose, the
 *                 result's action opens Route 2: nothing of Route 1's maze.
 *
 * A Route lost before its trap is reached is simply the next attempt (the
 * result's action, or "Começar outra rota"); attempts are counted. Under
 * software WebGL the entry watchdog can expire: "Tentar novamente" is pressed
 * (the product's own retry) and counted, as the other probes do.
 *
 * Usage:
 *   next build && next start -p 3100
 *   PLAYWRIGHT_DIR=<node_modules with playwright> node tools/validation/rota2-dynamic-traps-browser-probe.mjs
 *        [--base URL] [--scenario main,pickaxe,mobile,reduced,continuation] [--attempts N] [--out DIR]
 *        [--viewport 480x360] [--mobile-viewport 360x640]
 *
 * Writes nothing unless `--out DIR` (witness screenshots and the run's JSON).
 * Exit: 0 held · 1 failed · 3 usage / setup error.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

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
const OUT = arg("--out", null);
const ATTEMPTS = Number(arg("--attempts", "6"));
const SCENARIOS = arg("--scenario", "main,pickaxe,mobile,reduced,continuation").split(",");
// Under headless SwiftShader the Rota board's first frame costs time in proportion to the canvas, and the entry
// watchdog (28 s) is the product's: at 1280×800 or 800×500 neither the v1 base nor this mission enters in the
// validation container (measured, identical on both), at 480×360 both do. Real GPUs are not concerned.
const size = (text) => {
  const [width, height] = text.split("x").map(Number);
  return { width, height };
};
const DESKTOP = size(arg("--viewport", "480x360"));
const MOBILE = size(arg("--mobile-viewport", "360x640"));
const log = (...a) => console.log("[rota2]", ...a);
/** Where the running scenario is, reported with any error (a timeout names a selector, not a step). */
let stage = "start";
const at = (name) => {
  stage = name;
};
if (OUT) fs.mkdirSync(OUT, { recursive: true });

// --- in-page observer (observes, changes nothing) --------------------------------------------
function installObserver() {
  const probe = { phases: [] };
  window.__rota2Probe = probe;
  let phase;
  new MutationObserver(() => {
    const entry = document.querySelector("[data-entry-phase]");
    const next = entry ? entry.getAttribute("data-entry-phase") : null;
    if (next !== phase) probe.phases.push((phase = next));
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-entry-phase"] });
}

// --- geometry ------------------------------------------------------------------------------------
const key = (row, col) => `${row},${col}`;
const parse = (cell) => cell.split(",").map(Number);
const manhattan = (a, b) => {
  const [ar, ac] = parse(a);
  const [br, bc] = parse(b);
  return Math.abs(ar - br) + Math.abs(ac - bc);
};
const neighbours = (cell, walls) => {
  const [row, col] = parse(cell);
  return [[-1, 0], [1, 0], [0, -1], [0, 1]]
    .map(([dr, dc]) => [row + dr, col + dc])
    .filter(([r, c]) => r >= 0 && r <= 8 && c >= 0 && c <= 8 && !walls.has(key(r, c)))
    .map(([r, c]) => key(r, c));
};
function shortestPath(from, to, blocked) {
  const previous = new Map([[from, null]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i += 1) {
    const current = queue[i];
    if (current === to) {
      const cells = [];
      for (let cursor = current; cursor; cursor = previous.get(cursor)) cells.unshift(cursor);
      return cells;
    }
    for (const next of neighbours(current, blocked)) {
      if (previous.has(next)) continue;
      previous.set(next, current);
      queue.push(next);
    }
  }
  return null;
}
const DIRECTION = { "-1,0": "up", "1,0": "down", "0,-1": "left", "0,1": "right" };
const ARROWS = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };
const DPAD = { up: "Mover Cima", down: "Mover Baixo", left: "Mover Esquerda", right: "Mover Direita" };
const BREAK_LABEL = { up: "acima", down: "abaixo", left: "à esquerda", right: "à direita" };
const directionOf = (from, to) => {
  const [fr, fc] = parse(from);
  const [tr, tc] = parse(to);
  return DIRECTION[`${tr - fr},${tc - fc}`];
};

// --- pixels --------------------------------------------------------------------------------------
/** Lavender pixels (hue 235–295°, some saturation, not dark) in a PNG buffer — the shared rune's colour family. */
async function lavenderShare(png) {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  let hits = 0;
  const pixels = info.width * info.height;
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i] / 255;
    const g = data[i + 1] / 255;
    const b = data[i + 2] / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    if (max < 0.22 || delta / (max || 1) < 0.18) continue;
    let hue;
    if (max === r) hue = 60 * (((g - b) / delta) % 6);
    else if (max === g) hue = 60 * ((b - r) / delta + 2);
    else hue = 60 * ((r - g) / delta + 4);
    if (hue < 0) hue += 360;
    if (hue >= 235 && hue <= 295) hits += 1;
  }
  return hits / pixels;
}
async function meanDifference(a, b) {
  const [ra, rb] = await Promise.all([a, b].map((png) => sharp(png).raw().toBuffer({ resolveWithObject: true })));
  if (ra.data.length !== rb.data.length) return null;
  let sum = 0;
  for (let i = 0; i < ra.data.length; i += 1) sum += Math.abs(ra.data[i] - rb.data[i]);
  return sum / ra.data.length;
}

// --- the run -------------------------------------------------------------------------------------
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--use-gl=angle", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
});
const report = { base: BASE, scenarios: {}, pageErrors: [], entryRetries: [] };

async function newSession({ viewport = DESKTOP, touch = false, reducedMotion = "no-preference" } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, reducedMotion });
  await context.addInitScript(installObserver);
  const page = await context.newPage();
  page.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 240)));
  return { context, page, touch };
}

async function enterRota(s, label) {
  const { page } = s;
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.locator(".hj-stage").waitFor({ timeout: 180000 });
  await page.waitForTimeout(1500);
  const pip = page.locator('.hj-gallery-pip[aria-label="Selecionar Rota Estratégica"]');
  if (await pip.count()) await pip.click({ force: true });
  await page.waitForTimeout(700);
  const from = await page.evaluate(() => window.__rota2Probe.phases.length);
  await page.locator('.hj-world-object[aria-current="true"] .hj-world-enter').click({ force: true });
  await settleEntry(s, from, label);
  await page.locator(".wentry-intro-layer .pgi-cta").waitFor({ state: "visible", timeout: 60000 });
  await page.locator(".wentry-intro-layer .pgi-cta").click();
  await page.locator(".rsg-shell").waitFor({ state: "visible", timeout: 60000 });
  await page.locator('.route-babylon-wrap[data-visual-state="ready"]').waitFor({ timeout: 120000 });
}
async function settleEntry(s, from, label) {
  const { page } = s;
  let retries = 0;
  for (;;) {
    const outcome = await page
      .waitForFunction(
        ({ from }) => {
          const phases = window.__rota2Probe.phases.slice(from);
          if (phases.includes("error")) return "error";
          const entered = phases.includes("revealing") || phases.includes("complete");
          return entered && !document.querySelector("[data-entry-phase]") ? "complete" : null;
        },
        { from },
        { timeout: 120000, polling: 100 },
      )
      .then((h) => h.jsonValue());
    if (outcome === "complete" || retries >= 4) break;
    retries += 1;
    from = await page.evaluate(() => window.__rota2Probe.phases.length);
    await page.getByRole("button", { name: "Tentar novamente" }).click();
  }
  report.entryRetries.push({ entry: label, retries });
}
const startRoute = async ({ page }, difficulty = null) => {
  at("start-route");
  if (difficulty) await page.locator(`button[aria-label^="Modo ${difficulty}:"]`).click();
  await page.locator('button[aria-label="Iniciar rota com a dificuldade selecionada"]').click();
  await page.waitForFunction(() => document.querySelector("canvas.route-babylon-board")?.getAttribute("data-status") === "playing", null, { timeout: 60000 });
  await page.waitForTimeout(400);
};

async function readBoard({ page }) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas.route-babylon-board");
    if (!canvas) return null;
    const list = (name) => (canvas.getAttribute(name) ?? "").split(" ").filter(Boolean);
    const links = list("data-trap-link-cells").map((pair) => {
      const [trap, wall] = pair.split(">");
      return { trap, wall };
    });
    let sentinel = null;
    const fiberKey = Object.keys(canvas).find((k) => k.startsWith("__reactFiber$"));
    for (let fiber = fiberKey ? canvas[fiberKey] : null; fiber; fiber = fiber.return) {
      const cell = fiber.memoizedProps?.sentinel;
      if (cell && typeof cell.row === "number") {
        sentinel = `${cell.row},${cell.col}`;
        break;
      }
    }
    const rect = canvas.getBoundingClientRect();
    return {
      status: canvas.getAttribute("data-status"),
      player: canvas.getAttribute("data-player-cell"),
      guardian: canvas.getAttribute("data-guardian-cell"),
      sentinel,
      exit: canvas.getAttribute("data-exit-cell"),
      walls: list("data-wall-cells"),
      traps: list("data-trap-cells"),
      triggered: list("data-triggered-trap-cells"),
      lights: list("data-light-cells"),
      collected: list("data-collected-light-cells"),
      chest: canvas.getAttribute("data-chest-cell") || null,
      chestOpened: canvas.getAttribute("data-chest-opened") === "true",
      danger: list("data-danger-cells"),
      breakTargets: list("data-break-target-cells"),
      brokenWall: canvas.getAttribute("data-broken-wall-cell") || null,
      links,
      opened: list("data-trap-opened-wall-cells"),
      centers: JSON.parse(canvas.dataset.cellCenters || "{}"),
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      message: document.querySelector(".rsg-objective-message")?.textContent ?? "",
      rewardPending: Boolean(document.querySelector(".rsg-reward-btn")),
      result: Boolean(document.querySelector(".prm-card")),
    };
  });
}

/** The board canvas itself (Playwright captures the whole element, scrolled or not). */
const canvasShot = ({ page }) => page.locator("canvas.route-babylon-board").screenshot({ animations: "allow" });
/** A crop of the canvas around a cell's projected centre (canvas CSS px; device scale 1). */
async function cellShot(s, board, cell, size = 64, liftY = 0) {
  const c = board.centers[cell];
  if (!c) return null;
  const shot = await canvasShot(s);
  const { width, height } = await sharp(shot).metadata();
  const left = Math.round(Math.min(Math.max(0, c.x - size / 2), width - size));
  const top = Math.round(Math.min(Math.max(0, c.y - size / 2 - liftY), height - size));
  return sharp(shot).extract({ left, top, width: size, height: size }).png().toBuffer();
}
async function witness(s, name) {
  if (!OUT) return;
  fs.writeFileSync(path.join(OUT, `${name}.png`), await canvasShot(s));
}

async function press(s, direction) {
  if (s.touch) await s.page.locator(`button[aria-label="${DPAD[direction]}"]`).tap();
  else await s.page.keyboard.press(ARROWS[direction]);
  await s.page.waitForTimeout(260);
}

/** One careful step toward `target`: around the defenders' reach, never onto what must be avoided. */
async function stepToward(s, board, target, avoid = []) {
  const walls = new Set(board.walls);
  const blockedBase = new Set([...walls, ...avoid, board.exit, ...(board.chest && !board.chestOpened ? [board.chest] : [])]);
  blockedBase.delete(target);
  const careful = new Set([...blockedBase, board.guardian, ...board.danger, ...(board.sentinel ? [board.sentinel] : [])]);
  careful.delete(board.player);
  careful.delete(target);
  const plain = new Set([...blockedBase, board.guardian, ...(board.sentinel ? [board.sentinel] : [])]);
  plain.delete(target);
  const route = shortestPath(board.player, target, careful) ?? shortestPath(board.player, target, plain);
  if (!route || route.length < 2) return false;
  await press(s, directionOf(board.player, route[1]));
  return true;
}
async function walkTo(s, target, avoid = [], budget = 60) {
  for (let i = 0; i < budget; i += 1) {
    const board = await readBoard(s);
    if (!board || board.status !== "playing") return false;
    // Arriving counts even when the step paused the turn (the Chest's reward).
    if (board.player === target) return true;
    if (board.rewardPending) return false;
    if (!(await stepToward(s, board, target, avoid))) return false;
  }
  return false;
}
async function walkBeside(s, cell, avoid = []) {
  const board = await readBoard(s);
  const around = neighbours(cell, new Set(board.walls)).filter((c) => !avoid.includes(c)).sort((a, b) => manhattan(a, board.player) - manhattan(b, board.player));
  for (const spot of around) {
    if (await walkTo(s, spot, [cell, ...avoid])) return true;
    const now = await readBoard(s);
    if (!now || now.status !== "playing") return false;
  }
  return false;
}

/** Leave a lost or finished Route for a fresh board: the result's action, or "Começar outra rota". */
async function nextBoard(s) {
  const { page } = s;
  const board = await readBoard(s);
  if (board?.result || (board && board.status !== "playing")) {
    at("result-card");
    await page.locator(".prm-card").waitFor({ timeout: 30000 });
    const from = await page.evaluate(() => window.__rota2Probe.phases.length);
    at("result-action");
    await page.locator(".prm-cta").click();
    at("next-route-entry");
    await settleEntry(s, from, "next-route");
    await page.locator(".rsg-shell").waitFor({ state: "visible", timeout: 60000 });
    await page.locator('.route-babylon-wrap[data-visual-state="ready"]').waitFor({ timeout: 120000 });
    return startRoute(s);
  }
  at("restart-from-details");
  await page.locator(".rsg-details-trigger").click();
  await page.locator('button[aria-label="Começar outra rota"]').click();
  await page.waitForFunction(() => document.querySelector("canvas.route-babylon-board")?.getAttribute("data-status") === "playing", null, { timeout: 60000 });
  await page.locator(".rsg-details-close").click();
  await page.waitForTimeout(500);
}

/** Walk beside the linked trap and step on it; retries on a new board when a Route is lost first. */
async function activate(s, label) {
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const before = await readBoard(s);
    const link = before.links[0];
    if (!link) return { attempt, error: "no trap link published" };
    if (await walkBeside(s, link.trap)) {
      const atDoor = await readBoard(s);
      const wallBefore = await cellShot(s, atDoor, link.wall, 64, 10);
      await witness(s, `${label}-before-step`);
      await press(s, directionOf(atDoor.player, link.trap));
      const after = await readBoard(s);
      if (after.player === link.trap && after.triggered.includes(link.trap)) {
        return { attempt, link, dormant: before, atDoor, after, wallBefore };
      }
    }
    await nextBoard(s);
  }
  return { attempt: ATTEMPTS, error: "trap not reached" };
}

// --- scenarios -----------------------------------------------------------------------------------
async function scenarioMain() {
  const s = await newSession();
  const out = {};
  await enterRota(s, "main");
  await startRoute(s);
  const dormant = await readBoard(s);
  const link = dormant.links[0];
  out.published = {
    links: dormant.links.length,
    wallStanding: dormant.walls.includes(link.wall),
    trapDormant: !dormant.triggered.includes(link.trap),
    nothingOpened: dormant.opened.length === 0,
  };
  // The telegraph, on the pixels: lavender on the linked trap and on its wall, more than on a plain trap.
  const plainTrap = dormant.traps.find((t) => t !== link.trap);
  const shots = {
    trap: await cellShot(s, dormant, link.trap, 40),
    wallTop: await cellShot(s, dormant, link.wall, 40, 14),
    plainTrap: plainTrap ? await cellShot(s, dormant, plainTrap, 40) : null,
  };
  out.telegraph = {
    linkedTrapLavender: +(await lavenderShare(shots.trap)).toFixed(4),
    linkedWallLavender: +(await lavenderShare(shots.wallTop)).toFixed(4),
    plainTrapLavender: shots.plainTrap ? +(await lavenderShare(shots.plainTrap)).toFixed(4) : null,
  };
  await witness(s, "main-dormant");
  const act = await activate(s, "main");
  if (act.error) return { ...out, ...act, held: false };
  const after = act.after;
  const wallAfter = await cellShot(s, after, act.link.wall, 64, 10);
  out.activation = {
    attempt: act.attempt,
    trap: act.link.trap,
    wall: act.link.wall,
    published: after.opened.includes(act.link.wall),
    goneFromWalls: !after.walls.includes(act.link.wall),
    otherWallsUnchanged: JSON.stringify(after.walls.slice().sort()) === JSON.stringify(act.atDoor.walls.filter((w) => w !== act.link.wall).sort()),
    message: after.message,
    wallPixelsChanged: +(await meanDifference(act.wallBefore, wallAfter)).toFixed(2),
  };
  await witness(s, "main-opened");
  // Through the opened cell, then a few turns of the defenders on the new maze.
  const guardianTrail = [after.guardian];
  const sentinelTrail = [after.sentinel];
  const walked = await walkTo(s, act.link.wall, [], 30);
  let board = await readBoard(s);
  guardianTrail.push(board.guardian);
  sentinelTrail.push(board.sentinel);
  for (let i = 0; i < 6 && board.status === "playing" && !board.rewardPending; i += 1) {
    const away = neighbours(board.player, new Set(board.walls)).find((c) => c !== board.guardian && c !== board.sentinel && !board.danger.includes(c));
    if (!away) break;
    await press(s, directionOf(board.player, away));
    board = await readBoard(s);
    guardianTrail.push(board.guardian);
    sentinelTrail.push(board.sentinel);
  }
  out.passage = {
    explorerWalkedThrough: walked,
    hunterTrail: guardianTrail,
    sentinelTrail,
    defenderOnTheOpenedCell: guardianTrail.includes(act.link.wall) || sentinelTrail.includes(act.link.wall),
    wallStillOpen: !board.walls.includes(act.link.wall) || board.status !== "playing",
  };
  // "Começar outra rota": a new board, nothing opened, its own link standing.
  if (board.status === "playing") {
    await nextBoard(s);
    const fresh = await readBoard(s);
    out.restart = { nothingOpened: fresh.opened.length === 0, newLinkStanding: fresh.links[0] ? fresh.walls.includes(fresh.links[0].wall) : false, dormant: fresh.triggered.length === 0 };
    await witness(s, "main-restarted");
  }
  await s.context.close();
  const held =
    Object.values(out.published).every(Boolean) &&
    out.telegraph.linkedTrapLavender > (out.telegraph.plainTrapLavender ?? 0) &&
    out.telegraph.linkedWallLavender > 0 &&
    out.activation.published && out.activation.goneFromWalls && out.activation.otherWallsUnchanged &&
    /mesma runa se abriu|passagem marcada se abriu/.test(out.activation.message) && out.activation.wallPixelsChanged > 2 &&
    out.passage.wallStillOpen && (!out.restart || Object.values(out.restart).every(Boolean));
  return { ...out, held };
}

async function scenarioPickaxe() {
  const s = await newSession();
  await enterRota(s, "pickaxe");
  // The longest plan of the probe (Chest → Picareta → the linked wall → the trap) in "Aberto", where the Hunter
  // sometimes takes a random branch: the Pickaxe-first contract is the same in every mode (T11 covers all three).
  await startRoute(s, "Aberto");
  const attempts = [];
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const board = await readBoard(s);
    const link = board.links[0];
    const reached = (name) => {
      at(`pickaxe:${name}`);
      attempts[attempt - 1] = name;
    };
    reached("board");
    if (board.chest && (await walkTo(s, board.chest, [link.trap]))) {
      reached("chest");
      const atChest = await readBoard(s);
      if (atChest.rewardPending) {
        await s.page.locator('.rsg-reward-btn[aria-label^="Escolher Picareta"]').click();
        await s.page.waitForTimeout(300);
        reached("pickaxe-chosen");
        if (await walkBeside(s, link.wall, [link.trap])) {
          reached("beside-wall");
          const atWall = await readBoard(s);
          if (atWall.breakTargets.includes(link.wall)) {
            const direction = directionOf(atWall.player, link.wall);
            await s.page.locator(`button[aria-label^="Quebrar a parede ${BREAK_LABEL[direction]}."]`).click();
            await s.page.waitForTimeout(300);
            const broken = await readBoard(s);
            if (broken.status === "playing" && broken.brokenWall === link.wall) {
              reached("wall-broken");
              await witness(s, "pickaxe-wall-broken");
              if (await walkBeside(s, link.trap)) {
                reached("beside-trap");
                const before = await readBoard(s);
                await press(s, directionOf(before.player, link.trap));
                const after = await readBoard(s);
                if (after.player === link.trap && after.triggered.includes(link.trap)) {
                  reached("trap-armed");
                  await witness(s, "pickaxe-then-trap");
                  const out = {
                    attempt,
                    attempts,
                    link,
                    brokenWall: after.brokenWall,
                    trapOpenedWalls: after.opened,
                    wallsUnchangedByTheStep: JSON.stringify(after.walls.slice().sort()) === JSON.stringify(before.walls.slice().sort()),
                    message: after.message,
                  };
                  await s.context.close();
                  return {
                    ...out,
                    held: out.brokenWall === link.wall && out.trapOpenedWalls.length === 0 && out.wallsUnchangedByTheStep && /já estava aberta/.test(out.message),
                  };
                }
              }
            }
          }
        }
      }
    }
    await nextBoard(s);
  }
  await s.context.close();
  return { held: false, attempts, error: "no Pickaxe-before-trap run within the attempts" };
}

async function scenarioActivationOnly(label, sessionOptions) {
  const s = await newSession(sessionOptions);
  await enterRota(s, label);
  await startRoute(s);
  const act = await activate(s, label);
  if (act.error) {
    await s.context.close();
    return { ...act, held: false };
  }
  const immediately = await cellShot(s, act.after, act.link.wall, 64, 10);
  const lavenderNow = await lavenderShare(immediately);
  await s.page.waitForTimeout(1500);
  const settled = await readBoard(s);
  const later = await cellShot(s, settled, act.link.wall, 64, 10);
  const lavenderLater = await lavenderShare(later);
  await witness(s, `${label}-opened`);
  const out = {
    attempt: act.attempt,
    link: act.link,
    published: act.after.opened.includes(act.link.wall),
    goneFromWalls: !act.after.walls.includes(act.link.wall),
    message: act.after.message,
    lavenderRightAfter: +lavenderNow.toFixed(4),
    lavenderAfter1500ms: +lavenderLater.toFixed(4),
    wallPixelsChanged: +(await meanDifference(act.wallBefore, immediately)).toFixed(2),
  };
  await s.context.close();
  return { ...out, held: out.published && out.goneFromWalls && /mesma runa se abriu|passagem marcada se abriu/.test(out.message) && out.wallPixelsChanged > 2 };
}

async function scenarioContinuation() {
  const s = await newSession();
  await enterRota(s, "continuation");
  // The setup and the result name the Route ("Rota N: …", "Rota N registrada"); play shows the lights instead.
  const routeOf = () =>
    s.page.evaluate(() => Number(/Rota (\d+)/.exec(document.querySelector(".rsg-current-objective strong")?.textContent ?? "")?.[1]) || null);
  const routeWithOpening = await routeOf();
  await startRoute(s);
  const act = await activate(s, "continuation");
  if (act.error) {
    await s.context.close();
    return { ...act, routeWithOpening, held: false };
  }
  // Lose on purpose: straight at the Hunter.
  at("continuation:lose");
  for (let i = 0; i < 80; i += 1) {
    const board = await readBoard(s);
    if (!board || board.status !== "playing" || board.result) break;
    if (board.rewardPending) {
      await s.page.locator('.rsg-reward-btn[aria-label^="Escolher Picareta"]').click();
      continue;
    }
    const route = shortestPath(board.player, board.guardian, new Set(board.walls));
    if (!route || route.length < 2) break;
    await press(s, directionOf(board.player, route[1]));
  }
  // A finished Route hands the screen to the result card (the board is gone): the card says how it ended.
  at("continuation:result-card");
  await s.page.locator(".prm-card").waitFor({ timeout: 30000 });
  const resultCard = await s.page.evaluate(() => {
    const card = document.querySelector(".prm-card");
    return { attempt: card?.classList.contains("is-attempt") ?? false, title: document.querySelector(".prm-title")?.textContent?.trim() ?? null };
  });
  const action = (await s.page.locator(".prm-cta").textContent())?.trim() ?? null;
  const from = await s.page.evaluate(() => window.__rota2Probe.phases.length);
  at("continuation:result-action");
  await s.page.locator(".prm-cta").click();
  at("continuation:next-route-entry");
  await settleEntry(s, from, "continuation-next-route");
  await s.page.locator(".rsg-shell").waitFor({ state: "visible", timeout: 60000 });
  await s.page.locator('.route-babylon-wrap[data-visual-state="ready"]').waitFor({ timeout: 120000 });
  const nextRoute = await routeOf();
  await startRoute(s);
  const next = await readBoard(s);
  const out = {
    routeWithOpening,
    resultCard,
    action,
    nextRoute,
    nextNothingOpened: next.opened.length === 0,
    nextLinkStanding: next.links[0] ? next.walls.includes(next.links[0].wall) : false,
    nextTrapsDormant: next.triggered.length === 0,
    nextLinkDiffers: !next.links[0] || next.links[0].trap !== act.link.trap || next.links[0].wall !== act.link.wall,
  };
  await witness(s, "continuation-next-route");
  await s.context.close();
  return {
    ...out,
    held: resultCard.attempt && out.nextRoute === (routeWithOpening ?? 0) + 1 && out.nextNothingOpened && out.nextLinkStanding && out.nextTrapsDormant,
  };
}

const runners = {
  main: scenarioMain,
  pickaxe: scenarioPickaxe,
  mobile: () => scenarioActivationOnly("mobile", { viewport: MOBILE, touch: true }),
  reduced: () => scenarioActivationOnly("reduced", { reducedMotion: "reduce" }),
  continuation: scenarioContinuation,
};
for (const name of SCENARIOS) {
  const started = Date.now();
  stage = "start";
  try {
    report.scenarios[name] = await runners[name]();
  } catch (error) {
    report.scenarios[name] = { held: false, stage, error: String(error?.message ?? error).split("\n")[0] };
  }
  report.scenarios[name].seconds = Math.round((Date.now() - started) / 1000);
  log(`${report.scenarios[name].held ? "HELD  " : "FAILED"} ${name}`, JSON.stringify(report.scenarios[name]).slice(0, 900));
}
await browser.close();
const held = SCENARIOS.every((name) => report.scenarios[name]?.held) && report.pageErrors.length === 0;
log(`page errors: ${report.pageErrors.length}${report.pageErrors.length ? ` — ${report.pageErrors[0]}` : ""}`);
log(`entry retries: ${JSON.stringify(report.entryRetries)}`);
if (OUT) fs.writeFileSync(path.join(OUT, "rota2-browser-probe.json"), `${JSON.stringify(report, null, 2)}\n`);
log(held ? "ROTA2_DYNAMIC_TRAPS_BROWSER_HELD" : "ROTA2_DYNAMIC_TRAPS_BROWSER_FAILED");
process.exit(held ? EXIT_OK : EXIT_FAILED);
