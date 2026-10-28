/**
 * ROTA2-ADAPTIVE-HUNTER-04 — browser probe: the adaptive Hunter in the real app (production build), played from the
 * screen.
 *
 * Every scenario enters the Rota from Home (gallery → Rota → intro → setup → "Iniciar rota") and plays from what the
 * page publishes: the board's canvas attributes (pieces, walls, traps armed, trap links, opened walls), the Sentinel's
 * cell (the board's props), and the message the player reads (`role="status"`). Routes 2 and 3 are reached the way a
 * player reaches them: the previous Route ends (lost on purpose, straight at the Hunter) and the result's action opens
 * the next. Nothing in the app is instrumented.
 *
 * Every step is judged: the probe remembers the last successful direction itself and asks the mission's CONTRACT
 * (rota2-adaptive-hunter-lib.mjs `contractInterception`, production geometry) what the Hunter may do; the Hunter's new
 * cell must be one of the contract's interception moves when it intercepts — with "O Caçador tenta cortar seu
 * caminho." unless the step's own event outranks it — and otherwise in the pursuit's support (the reference model),
 * without that message. Never a move of more than one cell, never onto a wall, an armed trap, the portal or the
 * Sentinel.
 *
 *   home            Home → Rota entry: gallery, intro, setup, Route 1 playing.
 *   route1          Route 1: repeated directions (some that WOULD intercept on Route 2) — the old Hunter, no message.
 *   route2Repeat    Route 2: two steps the same way → the Hunter intercepts.
 *   route2Change    Route 2: one step, then another direction, every time → never adapts.
 *   route3Easy      Route 3, Aberto: a distant prediction → the pursuit decides.
 *   route3Medium    Route 3, Equilibrado: a one-cell prediction.
 *   route3Hard      Route 3, Desafiador: a two-cell prediction.
 *   wallProjection  a repeat into a wall (the prediction is a wall) → no illegal move, no interception.
 *   dynamicWall     the linked trap opens its wall; interceptions afterwards plan on the opened maze.
 *   armedTrap       an interception with a trap armed on the board; the Hunter never on it.
 *   secondChance    the Chest's Second Chance absorbs a capture as before.
 *   restart         "Começar outra rota" forgets the direction: its first step never intercepts.
 *   continuation    Route 1 → 2 → 3: each Route's first step never intercepts.
 *   mobile          360×640 touch D-pad: an interception; no horizontal scroll; the message on screen.
 *   keyboard        arrow keys only: an interception, announced in the `role="status"` region.
 *   reduced         prefers-reduced-motion: an interception, same semantics.
 *
 * On screen. Every summary counts the steps after which the status line was inside the viewport
 * (`statusLineOnScreen`). At 480×360 the product scrolls the page to the board and the controls when a Route starts,
 * and the status line (the objective panel, above the board) is then out of view — on ec3e564 exactly as here (run
 * `--scenario route1` against both builds). So the on-screen requirement is `mobile`'s, where the layout keeps the
 * panel in view; `keyboard` and `reduced` require the message in the live `role="status"` region, as every other
 * message of the Route is, and record whether it was on screen.
 *
 * Usage:
 *   next build && next start -p 3100
 *   node tools/validation/rota2-adaptive-hunter-browser-probe.mjs [--base URL] [--scenario a,b] [--attempts N]
 *        [--out DIR] [--viewport 480x360] [--mobile-viewport 360x640]
 *
 * Writes nothing unless `--out DIR` (witness screenshots and the run's JSON). Exit: 0 held · 1 failed · 3 usage.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { hunterSupport as referenceHunterSupport } from "./dynamic-solver.mjs";
import { INTERCEPT_MESSAGE, contractInterception } from "./rota2-adaptive-hunter-lib.mjs";

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
const ATTEMPTS = Number(arg("--attempts", "5"));
const ALL = "home,route1,route2Repeat,route2Change,route3Easy,route3Medium,route3Hard,wallProjection,dynamicWall,armedTrap,secondChance,restart,continuation,mobile,keyboard,reduced";
const SCENARIOS = arg("--scenario", ALL).split(",");
const size = (text) => {
  const [width, height] = text.split("x").map(Number);
  return { width, height };
};
// The product's entry watchdog under headless SwiftShader: see rota2-dynamic-traps-browser-probe.mjs (480×360).
const DESKTOP = size(arg("--viewport", "480x360"));
const MOBILE = size(arg("--mobile-viewport", "360x640"));
const log = (...a) => console.log("[adaptive]", ...a);
let stage = "start";
const at = (name) => {
  stage = name;
};
if (OUT) fs.mkdirSync(OUT, { recursive: true });

function installObserver() {
  const probe = { phases: [] };
  window.__ahProbe = probe;
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
const cellOf = (text) => {
  const [row, col] = parse(text);
  return { row, col };
};
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
const DELTA = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
const DIRECTIONS = Object.keys(DELTA);
const ARROWS = { up: "ArrowUp", down: "ArrowDown", left: "ArrowLeft", right: "ArrowRight" };
const DPAD = { up: "Mover Cima", down: "Mover Baixo", left: "Mover Esquerda", right: "Mover Direita" };
const offset = (cell, direction, k = 1) => {
  const [r, c] = parse(cell);
  return key(r + DELTA[direction][0] * k, c + DELTA[direction][1] * k);
};
const onBoard = (cell) => {
  const [r, c] = parse(cell);
  return r >= 0 && r <= 8 && c >= 0 && c <= 8;
};
const directionOf = (from, to) => DIRECTIONS.find((d) => offset(from, d) === to) ?? null;
const MODE_BUTTON = { easy: "Modo Aberto", medium: "Modo Equilibrado", hard: "Modo Desafiador" };

// --- the run -------------------------------------------------------------------------------------
const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--use-gl=angle", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
});
const report = { base: BASE, scenarios: {}, pageErrors: [], entryRetries: [], steps: { judged: 0, interceptions: 0, violations: 0 }, violations: [] };

async function newSession({ viewport = DESKTOP, touch = false, reducedMotion = "no-preference" } = {}) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, reducedMotion });
  await context.addInitScript(installObserver);
  const page = await context.newPage();
  page.on("pageerror", (error) => report.pageErrors.push(String(error).slice(0, 240)));
  return { context, page, touch, keyboardOnly: false, memory: null, difficulty: "easy", route: 1 };
}
async function settleEntry(s, from, label) {
  const { page } = s;
  let retries = 0;
  for (;;) {
    const outcome = await page
      .waitForFunction(
        ({ from }) => {
          const phases = window.__ahProbe.phases.slice(from);
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
    from = await page.evaluate(() => window.__ahProbe.phases.length);
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
  const from = await page.evaluate(() => window.__ahProbe.phases.length);
  await page.locator('.hj-world-object[aria-current="true"] .hj-world-enter').click({ force: true });
  await settleEntry(s, from, label);
  await page.locator(".wentry-intro-layer .pgi-cta").waitFor({ state: "visible", timeout: 60000 });
  await page.locator(".wentry-intro-layer .pgi-cta").click();
  await page.locator(".rsg-shell").waitFor({ state: "visible", timeout: 60000 });
  await page.locator('.route-babylon-wrap[data-visual-state="ready"]').waitFor({ timeout: 120000 });
}
async function chooseMode(s, difficulty) {
  at(`mode:${difficulty}`);
  await s.page.locator(`button[aria-label^="${MODE_BUTTON[difficulty]}"]`).click();
  await s.page.waitForFunction((label) => document.querySelector(`button[aria-label^="${label}"]`)?.getAttribute("aria-pressed") === "true", MODE_BUTTON[difficulty], { timeout: 60000 });
  await s.page.locator('.route-babylon-wrap[data-visual-state="ready"]').waitFor({ timeout: 120000 });
  s.difficulty = difficulty;
}
const startRoute = async (s) => {
  at("start-route");
  // The setup screen names the Route ("Rota N"); once it starts, the line shows the objective instead.
  s.route = (await routeOf(s)) ?? s.route;
  await s.page.locator('button[aria-label="Iniciar rota com a dificuldade selecionada"]').click();
  await s.page.waitForFunction(() => document.querySelector("canvas.route-babylon-board")?.getAttribute("data-status") === "playing", null, { timeout: 60000 });
  await s.page.waitForTimeout(400);
  s.memory = null;
};
const routeOf = (s) =>
  s.page.evaluate(() => Number(/Rota (\d+)/.exec(document.querySelector(".rsg-current-objective strong")?.textContent ?? "")?.[1]) || null);

async function readBoard({ page }) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas.route-babylon-board");
    const list = (name) => (canvas?.getAttribute(name) ?? "").split(" ").filter(Boolean);
    if (!canvas) return { result: Boolean(document.querySelector(".prm-card")) };
    // The Sentinel's cell is not a canvas attribute: read it from the board's props. The fiber a DOM node points to can
    // be the alternate one, a render behind; the props whose Explorer and Hunter match the committed attributes are the
    // current ones.
    let sentinel = null;
    const cellText = (cell) => (cell && typeof cell.row === "number" ? `${cell.row},${cell.col}` : null);
    const fiberKey = Object.keys(canvas).find((k) => k.startsWith("__reactFiber$"));
    for (let fiber = fiberKey ? canvas[fiberKey] : null; fiber && !sentinel; fiber = fiber.return) {
      for (const candidate of [fiber, fiber.alternate]) {
        const props = candidate?.memoizedProps;
        if (!props?.sentinel || typeof props.sentinel.row !== "number") continue;
        if (cellText(props.player) === canvas.getAttribute("data-player-cell") && cellText(props.guardian) === canvas.getAttribute("data-guardian-cell")) {
          sentinel = cellText(props.sentinel);
          break;
        }
      }
    }
    const status = document.querySelector('.rsg-objective-message[role="status"]');
    const box = status?.getBoundingClientRect();
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
      links: list("data-trap-link-cells").map((pair) => {
        const [trap, wall] = pair.split(">");
        return { trap, wall };
      }),
      opened: list("data-trap-opened-wall-cells"),
      message: status?.textContent ?? "",
      statusRole: status?.getAttribute("role") ?? null,
      messageOnScreen: box ? box.bottom > 0 && box.top < window.innerHeight && box.right > 0 && box.left < window.innerWidth : false,
      rewardPending: Boolean(document.querySelector(".rsg-reward-btn")),
      result: Boolean(document.querySelector(".prm-card")),
    };
  });
}
async function witness(s, name) {
  if (!OUT) return;
  await s.page.screenshot({ path: path.join(OUT, `${name}.png`) });
}
async function press(s, direction) {
  if (s.touch) await s.page.locator(`button[aria-label="${DPAD[direction]}"]`).tap();
  else await s.page.keyboard.press(ARROWS[direction]);
  await s.page.waitForTimeout(260);
}

/**
 * One step, judged. The probe's memory `s.memory` is the last successful direction of this session. Returns the
 * verdict: { stepped, contract, intercepted (message), hunterOk, violation, ... }.
 */
async function judgedStep(s, direction, before = null) {
  before ??= await readBoard(s);
  await press(s, direction);
  const after = await readBoard(s);
  const stepped = after.player === offset(before.player, direction);
  const verdict = { direction, previous: s.memory, stepped, route: s.route, difficulty: s.difficulty, message: after.message, status: after.status, result: Boolean(after.result) };
  if (!stepped) return { ...verdict, before, after };
  report.steps.judged += 1;
  const walls = new Set(after.walls ?? before.walls);
  const armedAfter = new Set(after.triggered ?? before.triggered);
  const input = {
    route: s.route, difficulty: s.difficulty, previous: s.memory, direction,
    hunter: cellOf(before.guardian), explorer: cellOf(after.player ?? offset(before.player, direction)), exit: cellOf(before.exit),
    walls, blocked: new Set([...armedAfter, ...(before.sentinel ? [before.sentinel] : [])]),
  };
  const plan = before.sentinel ? contractInterception(input) : null;
  s.memory = direction;
  // A Second Chance rolls the defenders back: the Hunter's chosen cell is not on the board to judge.
  const playing = after.status === "playing" && !after.result && !after.rewardPending && !/^Segunda Chance/.test(after.message ?? "");
  const pursuit = referenceHunterSupport(input.hunter, input.explorer, input.exit, walls, s.difficulty, armedAfter, before.sentinel ? cellOf(before.sentinel) : null).map((c) => key(c.row, c.col));
  const hunterAfter = after.guardian;
  const lightOrTrap = (after.collected?.length ?? 0) > before.collected.length || armedAfter.size > before.triggered.length;
  const outranked = lightOrTrap || after.player === before.exit;
  const intercepted = after.message === INTERCEPT_MESSAGE;
  const illegalCell = hunterAfter && (walls.has(hunterAfter) || armedAfter.has(hunterAfter) || hunterAfter === before.exit || (after.sentinel && hunterAfter === after.sentinel));
  let violation = null;
  if (playing) {
    if (manhattan(before.guardian, hunterAfter) > 1) violation = "hunter moved more than one cell";
    else if (illegalCell) violation = "hunter on an illegal cell";
    else if (plan) {
      if (!plan.moves.some((m) => key(m.row, m.col) === hunterAfter)) violation = "hunter not on an interception move";
      else if (!outranked && !intercepted) violation = "interception without its message";
    } else {
      if (!pursuit.includes(hunterAfter) && hunterAfter !== before.guardian) violation = "hunter outside the pursuit's support";
      if (intercepted) violation = "interception message without an interception";
    }
  }
  if (plan && playing) report.steps.interceptions += 1;
  if (violation) {
    report.steps.violations += 1;
    report.violations.push({
      stage, violation, route: s.route, difficulty: s.difficulty, previous: verdict.previous, direction,
      player: [before.player, after.player], hunter: [before.guardian, hunterAfter], sentinel: [before.sentinel, after.sentinel],
      plan: plan ? plan.moves.map((m) => key(m.row, m.col)) : null, pursuit, message: after.message,
      armed: [...armedAfter], walls: [...walls].sort().join(" "), exit: before.exit,
    });
  }
  return {
    ...verdict, before, after, input, plan, playing, intercepted, outranked, violation,
    horizon: plan?.horizon ?? null,
    planMoves: plan ? plan.moves.map((m) => key(m.row, m.col)) : null,
    hunter: [before.guardian, hunterAfter],
    wouldInterceptOnRoute2: s.route === 1 && before.sentinel ? contractInterception({ ...input, route: 2 }) !== null : null,
    easyLeftToPursuit: s.difficulty === "easy" && !plan && before.sentinel ? contractInterception({ ...input, difficulty: "medium" }) !== null : null,
    predictionIntoWall: s.memory === direction && verdict.previous === direction && (!onBoard(offset(after.player, direction)) || walls.has(offset(after.player, direction))),
  };
}

/**
 * The repeat-seeking Explorer: when stepping the remembered direction again is safe and the contract says the Hunter
 * would intercept it, it does; otherwise it takes a safe step that leaves another step the same way possible.
 */
function chooseStep(board, s, { prefer = null, avoid = [] } = {}) {
  const walls = new Set(board.walls);
  const blockedCells = new Set([board.guardian, ...(board.sentinel ? [board.sentinel] : []), ...(board.chest && !board.chestOpened ? [board.chest] : []), ...avoid]);
  const danger = new Set(board.danger);
  const legal = DIRECTIONS.filter((d) => {
    const next = offset(board.player, d);
    return onBoard(next) && !walls.has(next) && !blockedCells.has(next) && next !== board.exit;
  });
  if (!legal.length) return null;
  const safe = legal.filter((d) => !danger.has(offset(board.player, d)));
  const pool = safe.length ? safe : legal;
  if (prefer && pool.includes(prefer)) return prefer;
  const keepsGoing = pool.filter((d) => {
    const after = offset(board.player, d);
    const again = offset(after, d);
    return onBoard(again) && !walls.has(again);
  });
  const choices = keepsGoing.length ? keepsGoing : pool;
  return choices[Math.floor(Math.random() * choices.length)];
}
/** Would stepping `direction` now be an interception (by the contract)? */
function wouldIntercept(board, s, direction) {
  if (!board.sentinel || s.memory !== direction) return null;
  const next = offset(board.player, direction);
  if (!onBoard(next) || board.walls.includes(next)) return null;
  const walls = new Set(board.walls);
  const armed = new Set(board.triggered);
  const link = board.links.find((l) => l.trap === next);
  if (board.traps.includes(next) && !armed.has(next)) {
    armed.add(next);
    if (link) walls.delete(link.wall);
  }
  return contractInterception({
    route: s.route, difficulty: s.difficulty, previous: s.memory, direction,
    hunter: cellOf(board.guardian), explorer: cellOf(next), exit: cellOf(board.exit), walls, blocked: new Set([...armed, board.sentinel]),
  });
}

/** Walk until `want(step)` returns true for a judged step, or the budget ends; every step is recorded. */
async function hunt(s, want, { budget = 60, repeatSeeking = true, neverRepeat = false, avoid = [] } = {}) {
  const steps = [];
  for (let i = 0; i < budget; i += 1) {
    const board = await readBoard(s);
    if (!board || board.status !== "playing" || board.result) break;
    if (board.rewardPending) {
      await s.page.locator('.rsg-reward-btn[aria-label^="Escolher Segunda Chance"]').click();
      await s.page.waitForTimeout(300);
      continue;
    }
    let direction = null;
    if (repeatSeeking && s.memory && !neverRepeat) {
      const plan = wouldIntercept(board, s, s.memory);
      const next = offset(board.player, s.memory);
      if (plan && !board.danger.includes(next) && next !== board.guardian && next !== board.sentinel) direction = s.memory;
    }
    if (!direction) {
      const pick = chooseStep(board, s, { avoid });
      if (!pick) break;
      direction = pick;
      if (neverRepeat && direction === s.memory) {
        const other = DIRECTIONS.filter((d) => d !== s.memory).map((d) => chooseStep(board, s, { prefer: d, avoid })).find((d) => d && d !== s.memory);
        if (!other) break;
        direction = other;
      }
    }
    const step = await judgedStep(s, direction, board);
    steps.push(step);
    if (step.stepped && want(step)) return { found: step, steps };
  }
  return { found: null, steps };
}
const summarize = (steps) => ({
  steps: steps.filter((x) => x.stepped).length,
  repeats: steps.filter((x) => x.stepped && x.previous === x.direction).length,
  interceptions: steps.filter((x) => x.plan && x.playing).length,
  messages: steps.filter((x) => x.intercepted).length,
  statusLineOnScreen: steps.filter((x) => x.stepped && x.after?.messageOnScreen).length,
  violations: steps.filter((x) => x.violation).map((x) => ({ violation: x.violation, hunter: x.hunter, plan: x.planMoves })),
});
const stepView = (x) => x && { route: x.route, difficulty: x.difficulty, previous: x.previous, direction: x.direction, horizon: x.horizon, hunter: x.hunter, planMoves: x.planMoves, message: x.message, violation: x.violation };

async function resultCard(s) {
  at("result-card");
  await s.page.locator(".prm-card").waitFor({ timeout: 30000 });
  return s.page.evaluate(() => {
    const card = document.querySelector(".prm-card");
    return { won: card ? !card.classList.contains("is-attempt") : null, title: document.querySelector(".prm-title")?.textContent?.trim() ?? null };
  });
}
async function takeResultAction(s, label) {
  const from = await s.page.evaluate(() => window.__ahProbe.phases.length);
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
  s.memory = null;
}
/** A session on Route `route` in mode `difficulty`: Home → (mode) → Routes before it lost on purpose → started. */
async function openRoute(s, label, route, difficulty = "easy") {
  await enterRota(s, label);
  if (difficulty !== "easy") await chooseMode(s, difficulty);
  s.difficulty = difficulty;
  await startRoute(s);
  for (let r = 1; r < route; r += 1) {
    await loseAndContinue(s, `${label}:r${r}`);
    await startRoute(s);
  }
  return s.route;
}
/**
 * Run `plan(s)` on Route `route` (mode `difficulty`) until it returns a verdict: a Route still on is restarted in place,
 * a Route that ended continues through its result (Route 2 lost → Route 3, which the plan accepts when `anyAdaptive`).
 */
async function onRoute(label, { route, difficulty = "easy", session = {}, anyAdaptive = false, keyboardOnly = false }, plan) {
  const s = await newSession(session);
  s.keyboardOnly = keyboardOnly;
  const tries = [];
  try {
    let reached = await openRoute(s, label, route, difficulty);
    for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
      const okRoute = reached === route || (anyAdaptive && reached >= 2);
      if (!okRoute) return { held: false, error: `expected Route ${route}, reached ${reached}`, tries };
      at(`${label}:attempt-${attempt}`);
      const out = await plan(s);
      tries.push({ attempt, route: reached, held: Boolean(out?.held), steps: out?.summary?.steps ?? null });
      if (out) return { attempt, tries, route: reached, difficulty, ...out };
      const now = await readBoard(s);
      if (now.status === "playing" && !now.result) await restartFromDetails(s);
      else {
        await resultCard(s);
        await takeResultAction(s, `${label}:retry`);
        await startRoute(s);
        reached = s.route;
      }
    }
    return { held: false, tries, error: "no attempt observed the situation" };
  } finally {
    await s.context.close();
  }
}

// --- scenarios -----------------------------------------------------------------------------------
async function scenarioHome() {
  const s = await newSession();
  try {
    await enterRota(s, "home");
    const setup = await s.page.evaluate(() => ({
      shell: Boolean(document.querySelector(".rsg-shell")),
      startButton: Boolean(document.querySelector('button[aria-label="Iniciar rota com a dificuldade selecionada"]')),
      modes: [...document.querySelectorAll('button[aria-label^="Modo "]')].map((b) => b.getAttribute("aria-label")),
    }));
    await startRoute(s);
    const board = await readBoard(s);
    await witness(s, "home-route1-playing");
    return { setup, route: s.route, status: board.status, held: setup.shell && setup.startButton && setup.modes.length === 3 && s.route === 1 && board.status === "playing" };
  } finally {
    await s.context.close();
  }
}

const scenarioRoute1 = () =>
  onRoute("route1", { route: 1, difficulty: "medium" }, async (s) => {
    const { steps } = await hunt(s, () => false, { budget: 40 });
    const sum = summarize(steps);
    const tempting = steps.filter((x) => x.wouldInterceptOnRoute2 && x.playing);
    if (sum.repeats < 3 || tempting.length === 0) return null;
    await witness(s, "route1-old-hunter");
    return { summary: sum, repeatsThatWouldInterceptOnRoute2: tempting.length, held: sum.violations.length === 0 && sum.messages === 0 && sum.interceptions === 0 };
  });

const scenarioRoute2Repeat = () =>
  onRoute("route2Repeat", { route: 2, difficulty: "medium" }, async (s) => {
    const { found, steps } = await hunt(s, (x) => Boolean(x.plan) && x.playing);
    if (!found) return null;
    await witness(s, "route2-interception");
    const sum = summarize(steps);
    return { summary: sum, interception: stepView(found), held: sum.violations.length === 0 && found.previous === found.direction && found.planMoves.includes(found.hunter[1]) && (found.intercepted || found.outranked) };
  });

const scenarioRoute2Change = () =>
  onRoute("route2Change", { route: 2, difficulty: "medium" }, async (s) => {
    const { steps } = await hunt(s, () => false, { budget: 30, neverRepeat: true, repeatSeeking: false });
    const sum = summarize(steps);
    const changes = steps.filter((x) => x.stepped && x.previous && x.previous !== x.direction && x.playing);
    if (changes.length < 10) return null;
    return { summary: sum, directionChanges: changes.length, held: sum.violations.length === 0 && sum.messages === 0 && sum.interceptions === 0 && sum.repeats === 0 };
  });

const scenarioRoute3Easy = () =>
  onRoute("route3Easy", { route: 3, difficulty: "easy" }, async (s) => {
    const { found, steps } = await hunt(s, (x) => x.easyLeftToPursuit && x.playing, { budget: 80 });
    if (!found) return null;
    const sum = summarize(steps);
    return { summary: sum, distantPrediction: stepView(found), held: sum.violations.length === 0 && !found.plan && !found.intercepted };
  });

const byHorizon = (label, difficulty, horizon) => () =>
  onRoute(label, { route: 3, difficulty }, async (s) => {
    const { found, steps } = await hunt(s, (x) => x.plan?.horizon === horizon && x.playing, { budget: 80 });
    if (!found) return null;
    await witness(s, `${label}-interception`);
    const sum = summarize(steps);
    return { summary: sum, interception: stepView(found), held: sum.violations.length === 0 && found.planMoves.includes(found.hunter[1]) && (found.intercepted || found.outranked) };
  });

const scenarioWallProjection = () =>
  onRoute("wallProjection", { route: 2, difficulty: "medium", anyAdaptive: true }, async (s) => {
    const { found, steps } = await hunt(s, (x) => x.previous === x.direction && x.predictionIntoWall && x.playing, { budget: 80 });
    if (!found) return null;
    const sum = summarize(steps);
    return { summary: sum, repeatIntoAWall: stepView(found), held: sum.violations.length === 0 && !found.plan && !found.intercepted };
  });

const scenarioDynamicWall = () =>
  onRoute("dynamicWall", { route: 2, difficulty: "medium", anyAdaptive: true }, async (s) => {
    const start = await readBoard(s);
    const link = start.links[0];
    if (!link) return null;
    // To the linked trap (its wall opens), then repeated directions near the opened passage.
    for (let i = 0; i < 40; i += 1) {
      const board = await readBoard(s);
      if (board.status !== "playing" || board.triggered.includes(link.trap)) break;
      const blocked = new Set([...board.walls, board.guardian, ...(board.sentinel ? [board.sentinel] : []), ...board.danger, ...(board.chest && !board.chestOpened ? [board.chest] : [])]);
      blocked.delete(link.trap);
      const route = shortestPath(board.player, link.trap, blocked) ?? shortestPath(board.player, link.trap, new Set(board.walls));
      if (!route || route.length < 2) return null;
      await judgedStep(s, directionOf(board.player, route[1]), board);
    }
    const opened = await readBoard(s);
    if (opened.status !== "playing" || !opened.opened.includes(link.wall)) return null;
    const { found, steps } = await hunt(s, (x) => Boolean(x.plan) && x.playing, { budget: 60 });
    if (!found) return null;
    const staleWalls = new Set([...found.input.walls, link.wall]);
    const stale = contractInterception({ ...found.input, walls: staleWalls });
    const sensitive = JSON.stringify(stale) !== JSON.stringify(found.plan);
    const sum = summarize(steps);
    return { summary: sum, openedWall: link.wall, interception: stepView(found), planDiffersOnTheStaleMaze: sensitive, held: sum.violations.length === 0 && found.planMoves.includes(found.hunter[1]) && !found.input.walls.has(link.wall) };
  });

const scenarioArmedTrap = () =>
  onRoute("armedTrap", { route: 2, difficulty: "medium", anyAdaptive: true }, async (s) => {
    const start = await readBoard(s);
    const trap = start.traps.find((t) => !start.triggered.includes(t));
    if (!trap) return null;
    for (let i = 0; i < 40; i += 1) {
      const board = await readBoard(s);
      if (board.status !== "playing" || board.triggered.length) break;
      const blocked = new Set([...board.walls, board.guardian, ...(board.sentinel ? [board.sentinel] : []), ...board.danger, ...(board.chest && !board.chestOpened ? [board.chest] : [])]);
      blocked.delete(trap);
      const route = shortestPath(board.player, trap, blocked) ?? shortestPath(board.player, trap, new Set(board.walls));
      if (!route || route.length < 2) return null;
      await judgedStep(s, directionOf(board.player, route[1]), board);
    }
    const { found, steps } = await hunt(s, (x) => Boolean(x.plan) && x.playing && x.after.triggered.length > 0, { budget: 60 });
    if (!found) return null;
    const sum = summarize(steps);
    const onTrap = steps.filter((x) => x.after?.triggered?.includes(x.after.guardian)).length;
    return { summary: sum, armedTraps: found.after.triggered, interception: stepView(found), hunterOnAnArmedTrap: onTrap, held: sum.violations.length === 0 && onTrap === 0 };
  });

const scenarioSecondChance = () =>
  onRoute("secondChance", { route: 2, difficulty: "medium", anyAdaptive: true }, async (s) => {
    const board = await readBoard(s);
    if (!board.chest) return null;
    for (let i = 0; i < 50; i += 1) {
      const b = await readBoard(s);
      if (b.status !== "playing" || b.rewardPending) break;
      const blocked = new Set([...b.walls, b.guardian, ...(b.sentinel ? [b.sentinel] : []), ...b.danger]);
      blocked.delete(b.chest);
      const route = shortestPath(b.player, b.chest, blocked) ?? shortestPath(b.player, b.chest, new Set([...b.walls, b.guardian]));
      if (!route || route.length < 2) return null;
      await judgedStep(s, directionOf(b.player, route[1]), b);
    }
    const atChest = await readBoard(s);
    if (!atChest.rewardPending) return null;
    await s.page.locator('.rsg-reward-btn[aria-label^="Escolher Segunda Chance"]').click();
    await s.page.waitForTimeout(300);
    // Into the defenders' reach until the Second Chance absorbs a capture.
    for (let i = 0; i < 30; i += 1) {
      const b = await readBoard(s);
      if (b.status !== "playing") return null;
      const route = shortestPath(b.player, b.guardian, new Set(b.walls));
      if (!route || route.length < 2) return null;
      const step = await judgedStep(s, directionOf(b.player, route[1]), b);
      if (/^Segunda Chance/.test(step.after.message ?? "")) {
        await witness(s, "second-chance-used");
        return { message: step.after.message, statusAfter: step.after.status, stepped: step.stepped, held: step.after.status === "playing" && !step.after.result };
      }
    }
    return null;
  });

const scenarioRestart = () =>
  onRoute("restart", { route: 2, difficulty: "medium", anyAdaptive: true }, async (s) => {
    const { steps } = await hunt(s, (x) => x.stepped && x.previous !== null, { budget: 10 });
    const before = steps.filter((x) => x.stepped).at(-1);
    if (!before) return null;
    const remembered = s.memory;
    await restartFromDetails(s);
    const board = await readBoard(s);
    const direction = chooseStep(board, s, { prefer: remembered });
    if (!direction) return null;
    const first = await judgedStep(s, direction, board);
    if (!first.stepped) return null;
    return { rememberedBeforeRestart: remembered, firstStepAfterRestart: stepView(first), held: first.previous === null && !first.plan && !first.intercepted && !first.violation };
  });

async function scenarioContinuation() {
  const s = await newSession();
  try {
    await enterRota(s, "continuation");
    await startRoute(s);
    const firsts = [];
    for (let r = 1; r <= 3; r += 1) {
      const board = await readBoard(s);
      const direction = chooseStep(board, s);
      const first = direction ? await judgedStep(s, direction, board) : null;
      firsts.push({ route: s.route, step: stepView(first), noAdaptation: Boolean(first?.stepped) && first.previous === null && !first.plan && !first.intercepted && !first.violation });
      if (r < 3) {
        await loseAndContinue(s, `continuation:r${r}`);
        await startRoute(s);
      }
    }
    return { firsts, held: JSON.stringify(firsts.map((f) => f.route)) === "[1,2,3]" && firsts.every((f) => f.noAdaptation) };
  } finally {
    await s.context.close();
  }
}

const anInterception = (label, { onScreen = false, ...options }) =>
  onRoute(label, { route: 2, difficulty: "medium", anyAdaptive: true, ...options }, async (s) => {
    const { found, steps } = await hunt(s, (x) => Boolean(x.plan) && x.playing && x.intercepted);
    if (!found) return null;
    await witness(s, `${label}-interception`);
    const sum = summarize(steps);
    const layout = await s.page.evaluate(() => ({ horizontalScroll: document.documentElement.scrollWidth > window.innerWidth }));
    return {
      summary: sum, interception: stepView(found), message: found.after.message, messageOnScreen: found.after.messageOnScreen, onScreenRequired: onScreen, statusRole: found.after.statusRole, layout,
      held: sum.violations.length === 0 && found.after.statusRole === "status" && found.after.message === INTERCEPT_MESSAGE && (!onScreen || found.after.messageOnScreen) && !layout.horizontalScroll,
    };
  });

const runners = {
  home: scenarioHome,
  route1: scenarioRoute1,
  route2Repeat: scenarioRoute2Repeat,
  route2Change: scenarioRoute2Change,
  route3Easy: scenarioRoute3Easy,
  route3Medium: byHorizon("route3Medium", "medium", 1),
  route3Hard: byHorizon("route3Hard", "hard", 2),
  wallProjection: scenarioWallProjection,
  dynamicWall: scenarioDynamicWall,
  armedTrap: scenarioArmedTrap,
  secondChance: scenarioSecondChance,
  restart: scenarioRestart,
  continuation: scenarioContinuation,
  mobile: () => anInterception("mobile", { onScreen: true, session: { viewport: MOBILE, touch: true } }),
  keyboard: () => anInterception("keyboard", { keyboardOnly: true }),
  reduced: () => anInterception("reduced", { session: { reducedMotion: "reduce" } }),
};
for (const name of SCENARIOS) {
  if (!runners[name]) {
    console.error(`unknown scenario ${name}`);
    process.exit(EXIT_USAGE);
  }
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
const held = SCENARIOS.every((name) => report.scenarios[name]?.held) && report.pageErrors.length === 0 && report.steps.violations === 0;
log(`steps judged: ${report.steps.judged} · interceptions: ${report.steps.interceptions} · violations: ${report.steps.violations}`);
log(`page errors: ${report.pageErrors.length}${report.pageErrors.length ? ` — ${report.pageErrors[0]}` : ""}`);
log(`entry retries: ${JSON.stringify(report.entryRetries)}`);
if (report.violations.length) log(`violations: ${JSON.stringify(report.violations).slice(0, 3000)}`);
if (OUT) fs.writeFileSync(path.join(OUT, "browser-probe.json"), `${JSON.stringify(report, null, 2)}\n`);
log(held ? "ROTA2_ADAPTIVE_HUNTER_BROWSER_HELD" : "ROTA2_ADAPTIVE_HUNTER_BROWSER_FAILED");
process.exit(held ? EXIT_OK : EXIT_FAILED);
