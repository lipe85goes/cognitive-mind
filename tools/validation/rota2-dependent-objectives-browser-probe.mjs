/**
 * ROTA2-DEPENDENT-OBJECTIVES-02 — browser probe: the dependent objective in the real app (production build), played
 * from the screen.
 *
 * Every scenario enters the Rota from Home (intro → setup → "Iniciar rota") and plays from what the page publishes:
 * the board's canvas attributes (cells, trap links, opened walls, `data-portal-active`) and the objective panel the
 * player reads (`ul[aria-label="Objetivos da rota"]`, its text and its accessibility tree). Route 2 is reached the
 * way a player reaches it: Route 1 ends (lost on purpose, straight at the Hunter) and the result's action opens the
 * next Route. Nothing in the app is instrumented; the init script only observes.
 *
 *   route1          Route 1: no objective list; every light wakes the portal (published), the portal wins.
 *   lightsFirst     Route 2: every light, the portal stays asleep, the panel says the passage is missing; the
 *                   portal visited early does not win; the linked trap opens the passage and wakes the portal; win.
 *   passageFirst    Route 2: the trap first (passage "Aberta", portal "Aguardando"), then the lights; the final
 *                   light wakes the portal; win.
 *   pickaxe         Route 2: Chest → Picareta → the marked wall broken → passage "Aberta" → lights → win.
 *   secondChance    Route 2: Chest → Segunda Chance → the trap → lights → win (the Pickaxe is never needed).
 *   early           Route 2: the portal first — no win, the calm missing-objective sentence.
 *   continuation    Route 1 (no list) → Route 2 (list, passage "Fechada") → Route 3 (list, fresh).
 *   restart         Route 2: the passage opened, then "Começar outra rota": "Fechada" again, 0 lights.
 *   mobile          360×640 touch: the panel fits (no horizontal scroll), the D-pad opens the passage.
 *   reduced         prefers-reduced-motion: the same semantics.
 *
 * A Route lost before its scenario finishes is simply the next attempt (counted). Under software WebGL the entry
 * watchdog can expire: "Tentar novamente" is pressed (the product's own retry) and counted.
 *
 * Usage:
 *   next build && next start -p 3100
 *   node tools/validation/rota2-dependent-objectives-browser-probe.mjs [--base URL] [--scenario a,b] [--attempts N]
 *        [--out DIR] [--viewport 480x360] [--mobile-viewport 360x640]
 *
 * Writes nothing unless `--out DIR` (witness screenshots and the run's JSON). Exit: 0 held · 1 failed · 3 usage.
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
const OUT = arg("--out", null);
const ATTEMPTS = Number(arg("--attempts", "6"));
const SCENARIOS = arg("--scenario", "route1,lightsFirst,passageFirst,pickaxe,secondChance,early,continuation,restart,mobile,reduced").split(",");
const size = (text) => {
  const [width, height] = text.split("x").map(Number);
  return { width, height };
};
// The product's entry watchdog under headless SwiftShader: see rota2-dynamic-traps-browser-probe.mjs (480×360).
const DESKTOP = size(arg("--viewport", "480x360"));
const MOBILE = size(arg("--mobile-viewport", "360x640"));
const log = (...a) => console.log("[objectives]", ...a);
let stage = "start";
const at = (name) => {
  stage = name;
};
if (OUT) fs.mkdirSync(OUT, { recursive: true });

const MESSAGES = {
  bothMissing: "Faltam luzes e a passagem marcada.",
  passageMissing: "As luzes estão prontas. Falta abrir a passagem marcada.",
  lightsMissing: "A passagem está aberta. Ainda faltam luzes.",
  lightsDone: "Todas as luzes coletadas. Falta abrir a passagem marcada.",
};

function installObserver() {
  const probe = { phases: [] };
  window.__objProbe = probe;
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
async function settleEntry(s, from, label) {
  const { page } = s;
  let retries = 0;
  for (;;) {
    const outcome = await page
      .waitForFunction(
        ({ from }) => {
          const phases = window.__objProbe.phases.slice(from);
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
    from = await page.evaluate(() => window.__objProbe.phases.length);
    await page.getByRole("button", { name: "Tentar novamente" }).click();
  }
  report.entryRetries.push({ entry: label, retries });
}
async function enterRota(s, label) {
  const { page } = s;
  at(`${label}:enter`);
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.locator(".hj-stage").waitFor({ timeout: 180000 });
  await page.waitForTimeout(1500);
  const pip = page.locator('.hj-gallery-pip[aria-label="Selecionar Rota Estratégica"]');
  if (await pip.count()) await pip.click({ force: true });
  await page.waitForTimeout(700);
  const from = await page.evaluate(() => window.__objProbe.phases.length);
  await page.locator('.hj-world-object[aria-current="true"] .hj-world-enter').click({ force: true });
  await settleEntry(s, from, label);
  await page.locator(".wentry-intro-layer .pgi-cta").waitFor({ state: "visible", timeout: 60000 });
  await page.locator(".wentry-intro-layer .pgi-cta").click();
  await page.locator(".rsg-shell").waitFor({ state: "visible", timeout: 60000 });
  await page.locator('.route-babylon-wrap[data-visual-state="ready"]').waitFor({ timeout: 120000 });
}
const startRoute = async ({ page }) => {
  at("start-route");
  await page.locator('button[aria-label="Iniciar rota com a dificuldade selecionada"]').click();
  await page.waitForFunction(() => document.querySelector("canvas.route-babylon-board")?.getAttribute("data-status") === "playing", null, { timeout: 60000 });
  await page.waitForTimeout(400);
};
const routeOf = (s) =>
  s.page.evaluate(() => Number(/Rota (\d+)/.exec(document.querySelector(".rsg-current-objective strong")?.textContent ?? "")?.[1]) || null);

async function readBoard({ page }) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas.route-babylon-board");
    const list = (name) => (canvas?.getAttribute(name) ?? "").split(" ").filter(Boolean);
    const objectives = document.querySelector('ul[aria-label="Objetivos da rota"]');
    const rows = objectives
      ? [...objectives.querySelectorAll("li")].map((li) => ({ name: li.querySelector("b")?.textContent ?? "", state: li.querySelector("i")?.textContent ?? "", done: li.classList.contains("is-done") }))
      : null;
    if (!canvas) return { result: Boolean(document.querySelector(".prm-card")), objectives: rows };
    let sentinel = null;
    const fiberKey = Object.keys(canvas).find((k) => k.startsWith("__reactFiber$"));
    for (let fiber = fiberKey ? canvas[fiberKey] : null; fiber; fiber = fiber.return) {
      const cell = fiber.memoizedProps?.sentinel;
      if (cell && typeof cell.row === "number") {
        sentinel = `${cell.row},${cell.col}`;
        break;
      }
    }
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
      links: list("data-trap-link-cells").map((pair) => {
        const [trap, wall] = pair.split(">");
        return { trap, wall };
      }),
      opened: list("data-trap-opened-wall-cells"),
      portalActive: canvas.getAttribute("data-portal-active"),
      message: document.querySelector(".rsg-objective-message")?.textContent ?? "",
      title: document.querySelector(".rsg-current-objective strong")?.textContent ?? "",
      hudPortal: document.querySelector(".rsg-hud-portal-active, .rsg-hud-portal-locked")?.textContent ?? "",
      objectives: rows,
      rewardPending: Boolean(document.querySelector(".rsg-reward-btn")),
      result: Boolean(document.querySelector(".prm-card")),
    };
  });
}
const row = (board, name) => board.objectives?.find((r) => r.name === name) ?? null;
async function witness(s, name) {
  if (!OUT) return;
  await s.page.screenshot({ path: path.join(OUT, `${name}.png`) });
}
async function press(s, direction) {
  if (s.touch) await s.page.locator(`button[aria-label="${DPAD[direction]}"]`).tap();
  else await s.page.keyboard.press(ARROWS[direction]);
  await s.page.waitForTimeout(260);
}
async function stepToward(s, board, target, avoid = []) {
  const walls = new Set(board.walls);
  const uncollected = board.lights.filter((l) => !board.collected.includes(l));
  const blockedBase = new Set([...walls, ...avoid, board.exit, ...uncollected, ...board.traps.filter((t) => !board.triggered.includes(t)), ...(board.chest && !board.chestOpened ? [board.chest] : [])]);
  blockedBase.delete(target);
  const careful = new Set([...blockedBase, board.guardian, ...board.danger, ...(board.sentinel ? [board.sentinel] : [])]);
  careful.delete(board.player);
  careful.delete(target);
  const plain = new Set([...walls, ...avoid, board.exit, ...(board.chest && !board.chestOpened ? [board.chest] : []), board.guardian, ...(board.sentinel ? [board.sentinel] : [])]);
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
    if (board.player === target) return true;
    if (board.rewardPending) return false;
    if (!(await stepToward(s, board, target, avoid))) return false;
  }
  return false;
}
async function walkBeside(s, cell, avoid = []) {
  const board = await readBoard(s);
  // Never the closed Chest as a waypoint: arriving there pauses the turn on the reward choice.
  const around = neighbours(cell, new Set(board.walls))
    .filter((c) => !avoid.includes(c) && !(board.chest === c && !board.chestOpened))
    .sort((a, b) => manhattan(a, board.player) - manhattan(b, board.player));
  for (const spot of around) {
    if (await walkTo(s, spot, [cell, ...avoid])) return true;
    const now = await readBoard(s);
    if (!now || now.status !== "playing") return false;
  }
  return false;
}
/** Step onto `cell` from beside it. */
async function stepOnto(s, cell, avoid = []) {
  if (!(await walkBeside(s, cell, avoid))) return null;
  const board = await readBoard(s);
  await press(s, directionOf(board.player, cell));
  return readBoard(s);
}
async function collectLights(s, avoid = [], { keepLast = false } = {}) {
  for (let guard = 0; guard < 10; guard += 1) {
    let board = await readBoard(s);
    if (board.status !== "playing") return false;
    // A walk that ended on the Chest anyway: take the Second Chance and go on (the Pickaxe is never needed here).
    if (board.rewardPending) {
      await s.page.locator('.rsg-reward-btn[aria-label^="Escolher Segunda Chance"]').click();
      await s.page.waitForTimeout(300);
      board = await readBoard(s);
      if (board.status !== "playing") return false;
    }
    const left = board.lights.filter((l) => !board.collected.includes(l)).sort((a, b) => manhattan(a, board.player) - manhattan(b, board.player));
    if (left.length === 0 || (keepLast && left.length === 1)) return true;
    const after = await stepOnto(s, left[0], avoid);
    if (!after || after.status !== "playing") return false;
  }
  return false;
}
async function resultCard(s) {
  at("result-card");
  await s.page.locator(".prm-card").waitFor({ timeout: 30000 });
  return s.page.evaluate(() => {
    const card = document.querySelector(".prm-card");
    return { won: card ? !card.classList.contains("is-attempt") : null, title: document.querySelector(".prm-title")?.textContent?.trim() ?? null };
  });
}
/** The result's action: the next Route (or this one again), through the product's entry. */
async function takeResultAction(s, label) {
  const from = await s.page.evaluate(() => window.__objProbe.phases.length);
  at(`${label}:result-action`);
  await s.page.locator(".prm-cta").click();
  await settleEntry(s, from, label);
  await s.page.locator(".rsg-shell").waitFor({ state: "visible", timeout: 60000 });
  await s.page.locator('.route-babylon-wrap[data-visual-state="ready"]').waitFor({ timeout: 120000 });
}
/** Lose the Route on purpose (straight at the Hunter), read the card, and take its action. */
async function loseAndContinue(s, label) {
  at(`${label}:lose`);
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
  const card = await resultCard(s);
  await takeResultAction(s, label);
  return card;
}
async function restartFromDetails(s) {
  at("restart-from-details");
  await s.page.locator(".rsg-details-trigger").click();
  await s.page.locator('button[aria-label="Começar outra rota"]').click();
  await s.page.waitForFunction(() => document.querySelector("canvas.route-babylon-board")?.getAttribute("data-status") === "playing", null, { timeout: 60000 });
  await s.page.locator(".rsg-details-close").click();
  await s.page.waitForTimeout(500);
}
/** A Route 2 session: Home → Route 1 lost → Route 2 started. */
async function openRoute2(s, label) {
  await enterRota(s, label);
  await startRoute(s);
  await loseAndContinue(s, `${label}:r1`);
  const route = await routeOf(s);
  await startRoute(s);
  return route;
}
/** Retry a Route 2 plan on fresh boards ("Começar outra rota" while playing, the result's action otherwise). */
async function onRoute2(label, sessionOptions, plan) {
  const s = await newSession(sessionOptions);
  const attempts = [];
  try {
    let route = await openRoute2(s, label);
    if (route !== 2) return { held: false, error: `expected Route 2, reached ${route}` };
    for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
      const board = await readBoard(s);
      const link = board.links[0];
      const out = await plan(s, link, (name) => {
        at(`${label}:${name}`);
        attempts[attempt - 1] = name;
      });
      if (out) return { attempt, attempts, route, ...out };
      const now = await readBoard(s);
      if (now.status === "playing") await restartFromDetails(s);
      else {
        // A Route 2 lost leads to Route 3 — the same plan holds there (same objectives); report which.
        await resultCard(s);
        await takeResultAction(s, `${label}:retry`);
        route = (await routeOf(s)) ?? route;
        await startRoute(s);
      }
    }
    return { held: false, attempts, error: "no attempt finished the plan" };
  } finally {
    await s.context.close();
  }
}
/** Walk onto the portal and win; the card says so. */
async function finish(s, avoid = []) {
  const board = await readBoard(s);
  const after = await stepOnto(s, board.exit, avoid);
  if (!after) return null;
  if (after.status === "playing") return null;
  return resultCard(s);
}
const listText = (s) => s.page.locator('ul[aria-label="Objetivos da rota"]').innerText().catch(() => null);
const ariaTree = (s) => s.page.locator('ul[aria-label="Objetivos da rota"]').ariaSnapshot().catch(() => null);

// --- scenarios -----------------------------------------------------------------------------------
async function scenarioRoute1() {
  // A Route 1 still on (the careful walk found no way this time) is restarted in place — "Começar outra rota" keeps
  // Route 1; a Route 1 lost hands the journey to Route 2, so the next attempt is a new session from Home.
  let s = null;
  const attempts = [];
  try {
    for (let attempt = 1; attempt <= ATTEMPTS * 2; attempt += 1) {
      const reached = (name) => {
        at(`route1:${name}`);
        attempts[attempt - 1] = name;
      };
      if (!s) {
        s = await newSession();
        await enterRota(s, "route1");
        if ((await routeOf(s)) !== 1) return { held: false, error: "the Rota did not open on Route 1" };
        await startRoute(s);
      }
      const start = await readBoard(s);
      const link = start.links[0];
      const outcome = await (async () => {
        reached("lights");
        if (!(await collectLights(s, link ? [link.trap] : [], { keepLast: true }))) return null;
        reached("last-light");
        const beforeLast = await readBoard(s);
        const last = beforeLast.lights.find((l) => !beforeLast.collected.includes(l));
        const afterLast = await stepOnto(s, last, link ? [link.trap] : []);
        if (!afterLast || afterLast.status !== "playing") return null;
        reached("finish");
        await witness(s, "route1-portal-awake");
        const card = await finish(s);
        if (!card) return null;
        return { start, beforeLast, afterLast, card };
      })();
      if (outcome) {
        const { beforeLast, afterLast, card } = outcome;
        const out = {
          attempt,
          attempts,
          route: 1,
          noObjectiveList: start.objectives === null && afterLast.objectives === null,
          linkedWallStillStanding: link ? afterLast.walls.includes(link.wall) : null,
          portalAsleepBeforeLastLight: beforeLast.portalActive === "false",
          portalAwakeAfterLastLight: afterLast.portalActive === "true",
          message: afterLast.message,
          hudPortal: afterLast.hudPortal,
          card,
        };
        return { ...out, held: out.noObjectiveList && out.linkedWallStillStanding && out.portalAsleepBeforeLastLight && out.portalAwakeAfterLastLight && out.message === "Portal ativado! Vá até a saída." && card.won };
      }
      const now = await readBoard(s);
      if (now.status === "playing" && !now.result) await restartFromDetails(s);
      else {
        await s.context.close();
        s = null;
      }
    }
    return { held: false, attempts, error: "Route 1 not won within the attempts" };
  } finally {
    await s?.context.close();
  }
}

const scenarioLightsFirst = () =>
  onRoute2("lightsFirst", {}, async (s, link, reached) => {
    reached("lights");
    if (!(await collectLights(s, [link.trap]))) return null;
    const lightsDone = await readBoard(s);
    const listAfterLights = await listText(s);
    const aria = await ariaTree(s);
    await witness(s, "lightsFirst-lights-done");
    reached("early-portal");
    const early = await stepOnto(s, lightsDone.exit, [link.trap]);
    if (!early || early.status !== "playing") return null;
    reached("trap");
    const opened = await stepOnto(s, link.trap);
    if (!opened || opened.status !== "playing" || !opened.triggered.includes(link.trap)) return null;
    await witness(s, "lightsFirst-portal-awake");
    reached("finish");
    const card = await finish(s);
    if (!card) return null;
    const out = {
      afterLights: { portalActive: lightsDone.portalActive, passage: row(lightsDone, "Passagem marcada"), lights: row(lightsDone, "Luzes"), portal: row(lightsDone, "Portal"), message: lightsDone.message, title: lightsDone.title },
      listText: listAfterLights,
      ariaSnapshot: aria,
      early: { status: early.status, message: early.message },
      afterTrap: { portalActive: opened.portalActive, passage: row(opened, "Passagem marcada"), portal: row(opened, "Portal"), message: opened.message },
      card,
    };
    return {
      ...out,
      held:
        lightsDone.portalActive === "false" && out.afterLights.passage?.state.startsWith("Fechada") && out.afterLights.lights?.done && out.afterLights.portal?.state === "Aguardando" &&
        early.message === MESSAGES.passageMissing &&
        opened.portalActive === "true" && out.afterTrap.passage?.done && out.afterTrap.portal?.state === "Ativado" &&
        /Objetivos da rota/.test(aria ?? "") && /Passagem marcada/.test(aria ?? "") && /Fechada/.test(aria ?? "") &&
        card.won,
    };
  });

const scenarioPassageFirst = () =>
  onRoute2("passageFirst", {}, async (s, link, reached) => {
    reached("trap");
    const opened = await stepOnto(s, link.trap);
    if (!opened || opened.status !== "playing" || !opened.triggered.includes(link.trap)) return null;
    await witness(s, "passageFirst-passage-open");
    reached("lights");
    if (!(await collectLights(s, [], { keepLast: true }))) return null;
    const beforeLast = await readBoard(s);
    const last = beforeLast.lights.find((l) => !beforeLast.collected.includes(l));
    const afterLast = await stepOnto(s, last);
    if (!afterLast || afterLast.status !== "playing") return null;
    reached("finish");
    const card = await finish(s);
    if (!card) return null;
    const out = {
      afterTrap: { portalActive: opened.portalActive, passage: row(opened, "Passagem marcada"), portal: row(opened, "Portal"), message: opened.message },
      beforeLastLight: { portalActive: beforeLast.portalActive },
      afterLastLight: { portalActive: afterLast.portalActive, message: afterLast.message, portal: row(afterLast, "Portal") },
      card,
    };
    return {
      ...out,
      held: opened.portalActive === "false" && out.afterTrap.passage?.done && out.afterTrap.portal?.state === "Aguardando" && beforeLast.portalActive === "false" && afterLast.portalActive === "true" && afterLast.message === "Portal ativado! Vá até a saída." && card.won,
    };
  });

const scenarioPickaxe = () =>
  onRoute2("pickaxe", {}, async (s, link, reached) => {
    const board = await readBoard(s);
    reached("chest");
    if (!board.chest || !(await walkTo(s, board.chest, [link.trap]))) return null;
    const atChest = await readBoard(s);
    if (!atChest.rewardPending) return null;
    await s.page.locator('.rsg-reward-btn[aria-label^="Escolher Picareta"]').click();
    await s.page.waitForTimeout(300);
    reached("beside-wall");
    if (!(await walkBeside(s, link.wall, [link.trap]))) return null;
    const atWall = await readBoard(s);
    if (!atWall.breakTargets.includes(link.wall)) return null;
    await s.page.locator(`button[aria-label^="Quebrar a parede ${BREAK_LABEL[directionOf(atWall.player, link.wall)]}."]`).click();
    await s.page.waitForTimeout(300);
    const broken = await readBoard(s);
    if (broken.status !== "playing" || broken.brokenWall !== link.wall) return null;
    await witness(s, "pickaxe-passage-open");
    reached("lights");
    if (!(await collectLights(s, [link.trap]))) return null;
    const lights = await readBoard(s);
    reached("finish");
    const card = await finish(s, [link.trap]);
    if (!card) return null;
    const out = { afterBreak: { passage: row(broken, "Passagem marcada"), portalActive: broken.portalActive, message: broken.message, trapStillDormant: !broken.triggered.includes(link.trap) }, afterLights: { portalActive: lights.portalActive }, card };
    return { ...out, held: out.afterBreak.passage?.done && out.afterBreak.trapStillDormant && /passagem marcada está aberta/.test(out.afterBreak.message) && lights.portalActive === "true" && card.won };
  });

const scenarioSecondChance = () =>
  onRoute2("secondChance", {}, async (s, link, reached) => {
    const board = await readBoard(s);
    reached("chest");
    if (!board.chest || !(await walkTo(s, board.chest, [link.trap]))) return null;
    const atChest = await readBoard(s);
    if (!atChest.rewardPending) return null;
    await s.page.locator('.rsg-reward-btn[aria-label^="Escolher Segunda Chance"]').click();
    await s.page.waitForTimeout(300);
    reached("trap");
    const opened = await stepOnto(s, link.trap);
    if (!opened || opened.status !== "playing" || !opened.triggered.includes(link.trap)) return null;
    reached("lights");
    if (!(await collectLights(s))) return null;
    reached("finish");
    const card = await finish(s);
    if (!card) return null;
    return { passageAfterTrap: row(opened, "Passagem marcada"), noPickaxeWall: opened.brokenWall === null, card, held: Boolean(row(opened, "Passagem marcada")?.done) && opened.brokenWall === null && card.won };
  });

const scenarioEarly = () =>
  onRoute2("early", {}, async (s, link, reached) => {
    const board = await readBoard(s);
    reached("portal");
    const early = await stepOnto(s, board.exit, [link.trap]);
    if (!early || early.status !== "playing") return null;
    await witness(s, "early-portal");
    return { status: early.status, message: early.message, portalActive: early.portalActive, noResult: !early.result, held: early.status === "playing" && early.message === MESSAGES.bothMissing && early.portalActive === "false" && !early.result };
  });

async function scenarioContinuation() {
  const s = await newSession();
  try {
    await enterRota(s, "continuation");
    const r1 = await routeOf(s);
    await startRoute(s);
    const r1Board = await readBoard(s);
    const card1 = await loseAndContinue(s, "continuation:r1");
    const r2 = await routeOf(s);
    await startRoute(s);
    const r2Start = await readBoard(s);
    const card2 = await loseAndContinue(s, "continuation:r2");
    const r3 = await routeOf(s);
    await startRoute(s);
    const r3Start = await readBoard(s);
    await witness(s, "continuation-route3");
    const out = {
      routes: [r1, r2, r3],
      cards: [card1, card2],
      route1List: r1Board.objectives,
      route2List: r2Start.objectives,
      route3List: r3Start.objectives,
    };
    const fresh = (b) => row(b, "Passagem marcada")?.state.startsWith("Fechada") && row(b, "Portal")?.state === "Aguardando" && b.portalActive === "false";
    return {
      ...out,
      held: sameRoutes(out.routes) && r1Board.objectives === null && fresh(r2Start) && fresh(r3Start),
    };
  } finally {
    await s.context.close();
  }
}
const sameRoutes = (routes) => JSON.stringify(routes) === JSON.stringify([1, 2, 3]);

/** Route 2: open the passage, then "Começar outra rota" — the new board's passage is closed, nothing collected. */
const scenarioRestart = () =>
  onRoute2("restart", {}, async (s, link, reached) => {
    reached("trap");
    const opened = await stepOnto(s, link.trap);
    if (!opened || opened.status !== "playing" || !opened.triggered.includes(link.trap)) return null;
    const openedRow = row(opened, "Passagem marcada");
    await restartFromDetails(s);
    const fresh = await readBoard(s);
    const out = { openedBefore: Boolean(openedRow?.done), after: row(fresh, "Passagem marcada"), lights: row(fresh, "Luzes"), portalActive: fresh.portalActive, nothingOpened: fresh.opened.length === 0 };
    return { ...out, held: out.openedBefore && out.after?.state.startsWith("Fechada") && /^0\//.test(out.lights?.state ?? "") && out.portalActive === "false" && out.nothingOpened };
  });

async function scenarioMobile() {
  return onRoute2("mobile", { viewport: MOBILE, touch: true }, async (s, link, reached) => {
    reached("panel");
    const layout = await s.page.evaluate(() => {
      const list = document.querySelector('ul[aria-label="Objetivos da rota"]');
      const r = list?.getBoundingClientRect();
      return {
        horizontalScroll: document.documentElement.scrollWidth > window.innerWidth,
        listInViewport: r ? r.left >= 0 && r.right <= window.innerWidth : false,
        listHeight: r ? Math.round(r.height) : null,
      };
    });
    reached("trap");
    const opened = await stepOnto(s, link.trap);
    if (!opened || opened.status !== "playing" || !opened.triggered.includes(link.trap)) return null;
    await witness(s, "mobile-passage-open");
    return { layout, passage: row(opened, "Passagem marcada"), held: !layout.horizontalScroll && layout.listInViewport && Boolean(row(opened, "Passagem marcada")?.done) && opened.portalActive === "false" };
  });
}

async function scenarioReduced() {
  return onRoute2("reduced", { reducedMotion: "reduce" }, async (s, link, reached) => {
    reached("trap");
    const opened = await stepOnto(s, link.trap);
    if (!opened || opened.status !== "playing" || !opened.triggered.includes(link.trap)) return null;
    await s.page.waitForTimeout(1200);
    const later = await readBoard(s);
    return { passage: row(opened, "Passagem marcada"), stable: JSON.stringify(row(later, "Passagem marcada")) === JSON.stringify(row(opened, "Passagem marcada")), message: opened.message, held: Boolean(row(opened, "Passagem marcada")?.done) && opened.portalActive === "false" && /passagem marcada se abriu/.test(opened.message) };
  });
}

const runners = {
  route1: scenarioRoute1,
  lightsFirst: scenarioLightsFirst,
  passageFirst: scenarioPassageFirst,
  pickaxe: scenarioPickaxe,
  secondChance: scenarioSecondChance,
  early: scenarioEarly,
  continuation: scenarioContinuation,
  restart: scenarioRestart,
  mobile: scenarioMobile,
  reduced: scenarioReduced,
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
if (OUT) fs.writeFileSync(path.join(OUT, "browser-probe.json"), `${JSON.stringify(report, null, 2)}\n`);
log(held ? "ROTA2_OBJECTIVES_BROWSER_HELD" : "ROTA2_OBJECTIVES_BROWSER_FAILED");
process.exit(held ? EXIT_OK : EXIT_FAILED);
