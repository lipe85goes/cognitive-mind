/**
 * ROUTE-JOURNEY-TERMINAL-01 — browser probe: the journey ends after Route 3, in
 * the real app (production build).
 *
 *   Home → Rota (intro) → Route 1 → result → Route 2 → result → Route 3
 *   → Route 3 lost → result ("Tentar Rota 3 novamente") → Route 3 again
 *   → … until Route 3 is won → "Jornada concluída" → its one action → Home
 *   → the Rota again from Home: a new journey on Route 1, intro shown.
 *
 * Route 1 and 2 are lost on purpose (it is quick, and either end leads on);
 * the first Route 3 is lost on purpose too, so the retry is always exercised.
 * After that each Route 3 is played to win; a win that has not come after
 * `WIN_ATTEMPT_MOVES` turns into a loss, which is just one more retry.
 *
 * An observer in the page sees every mutation batch: every Route number the
 * game or the result screen ever names, every time the Rota's shell is
 * attached, and what was saved when each result arrived. Read-only: the init
 * script observes, nothing in the app is instrumented. Writes nothing unless
 * `--out DIR` is given.
 *
 * Usage:
 *   next build && next start -p 3100
 *   node tools/validation/route-journey-terminal-browser-probe.mjs
 *        [--base URL] [--mode easy|medium|hard] [--attempts N] [--viewport WxH] [--out DIR]
 *
 * Exit: 0 held · 1 failed · 3 usage / setup error.
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
const MODE = arg("--mode", "easy");
const ATTEMPTS = Number(arg("--attempts", "10"));
const MODE_TITLE = { easy: "Aberto", medium: "Equilibrado", hard: "Desafiador" };
if (!(MODE in MODE_TITLE) || !Number.isSafeInteger(ATTEMPTS) || ATTEMPTS < 2) {
  console.error("usage: --mode easy|medium|hard · --attempts N (≥ 2)");
  process.exit(EXIT_USAGE);
}
const [VIEW_W, VIEW_H] = arg("--viewport", "800x500").split("x").map(Number);
const STORAGE_KEY = "cognitive-mind-recent-results";
const FINAL_ROUTE = 3;
const log = (...a) => console.log("[terminal]", ...a);

// --- in-page observer (observes, changes nothing) ------------------------------------------

function installObserver() {
  const probe = { batches: 0, phases: [], routesNamed: [], rotaMounts: 0, resultArrivals: [] };
  window.__terminalProbe = probe;
  const elementsIn = (node, selector) =>
    node.nodeType !== 1 ? [] : [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)];
  const noteRoutes = (text, where) => {
    for (const match of String(text ?? "").matchAll(/\bRota (\d+)\b/g)) {
      const route = Number(match[1]);
      if (!probe.routesNamed.some((seen) => seen.route === route && seen.where === where)) {
        probe.routesNamed.push({ route, where, batch: probe.batches });
      }
    }
  };
  let phase;
  new MutationObserver((records) => {
    probe.batches += 1;
    let resultAdded = false;
    for (const record of records) {
      if (record.type !== "childList") continue;
      for (const node of record.addedNodes) {
        probe.rotaMounts += elementsIn(node, ".rsg-shell").length;
        if (elementsIn(node, ".prm-card").length) resultAdded = true;
      }
    }
    const entry = document.querySelector("[data-entry-phase]");
    const nextPhase = entry ? entry.getAttribute("data-entry-phase") : null;
    if (nextPhase !== phase) probe.phases.push((phase = nextPhase));
    // Small elements only: the Rota's own Route line and status card, and the result card.
    noteRoutes(document.querySelector(".rsg-route-context")?.textContent, "game");
    for (const card of document.querySelectorAll(".rsg-current-objective")) noteRoutes(card.textContent, "game");
    noteRoutes(document.querySelector(".prm-card")?.textContent, "result");
    if (resultAdded) {
      let saved = null;
      try {
        saved = JSON.parse(window.localStorage.getItem("cognitive-mind-recent-results") ?? "[]")[0] ?? null;
      } catch {
        saved = null;
      }
      probe.resultArrivals.push({
        gameInDocument: Boolean(document.querySelector(".rsg-shell")),
        savedRoute: saved?.details?.routeNumber ?? null,
        savedWon: saved?.details?.won ?? null,
        savedJourneyCompleted: saved?.details?.journeyCompleted ?? null,
        savedContinuation: saved?.continuation ?? null,
      });
    }
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-entry-phase"] });
}

// --- driving the app ----------------------------------------------------------------------

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--use-gl=angle", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
});
const context = await browser.newContext({ viewport: { width: VIEW_W, height: VIEW_H }, deviceScaleFactor: 1 });
await context.addInitScript(installObserver);
const page = await context.newPage();
const session = { step: "start", pageErrors: [] };
page.on("pageerror", (error) => session.pageErrors.push({ text: String(error).slice(0, 240), step: session.step }));

const observed = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__terminalProbe)));
const storedResults = () => page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "[]"), STORAGE_KEY);

async function entryOutcome({ from = 0, timeout = 120000 } = {}) {
  const handle = await page.waitForFunction(
    ({ from }) => {
      const phases = window.__terminalProbe.phases.slice(from);
      if (phases.includes("error")) return "error";
      const entered = phases.includes("revealing") || phases.includes("complete");
      return entered && !document.querySelector("[data-entry-phase]") ? "complete" : null;
    },
    { from },
    { timeout, polling: 100 },
  );
  return handle.jsonValue();
}
/**
 * An entry to its end. Under software WebGL the board can outlast the entry's 12 s
 * preparing watchdog; the product then offers "Tentar novamente", which remounts the
 * same session (same game, same continuation). That is pressed, up to four times, and
 * counted — the arrival is still checked like any other.
 */
const entryRetries = [];
async function enterThrough(from, label) {
  let retries = 0;
  for (;;) {
    const outcome = await entryOutcome({ from });
    if (outcome === "complete" || retries >= 4) {
      entryRetries.push({ entry: label, retries });
      return outcome;
    }
    retries += 1;
    from = (await observed()).phases.length;
    await page.getByRole("button", { name: "Tentar novamente" }).click();
  }
}
const boardReady = () => page.locator('.route-babylon-wrap[data-visual-state="ready"]').waitFor({ timeout: 120000 });

async function onScreen() {
  return page.evaluate((titles) => {
    const route = Number(/^Rota (\d+):/.exec(document.querySelector(".rsg-route-context")?.textContent ?? "")?.[1]) || null;
    const modeStat = [...document.querySelectorAll(".rsg-secondary-stats .rsg-stat")].find(
      (stat) => stat.querySelector("em")?.textContent === "Modo",
    );
    const title = modeStat?.querySelector("strong")?.textContent ?? null;
    return {
      route,
      mode: Object.keys(titles).find((key) => titles[key] === title) ?? null,
      status: document.querySelector("canvas.route-babylon-board")?.getAttribute("data-status") ?? null,
      introShown: Boolean(document.querySelector(".wentry-intro-layer .pgi-cta")),
    };
  }, MODE_TITLE);
}

// --- playing a Route from what the board publishes -----------------------------------------

const key = (row, col) => `${row},${col}`;
const parse = (cell) => cell.split(",").map(Number);
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
    const [row, col] = parse(current);
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const r = row + dr;
      const c = col + dc;
      const next = key(r, c);
      if (r < 0 || r > 8 || c < 0 || c > 8 || blocked.has(next) || previous.has(next)) continue;
      previous.set(next, current);
      queue.push(next);
    }
  }
  return null;
}
const ARROWS = { "-1,0": "ArrowUp", "1,0": "ArrowDown", "0,-1": "ArrowLeft", "0,1": "ArrowRight" };
const WIN_ATTEMPT_MOVES = 120;

/**
 * To win: lights, then the portal, around the Hunter, its reach and the Sentinel —
 * the policy `route-runtime-harness#playToEnd` plays. To lose: straight at the Hunter.
 * Ends at the result card. The board publishes every cell but the Sentinel's; that one
 * is read from the board component's own props, through the canvas's React fiber
 * (read-only, nothing is changed).
 */
async function playRoute(policy, budget = 160) {
  let moves = 0;
  for (let guard = 0; guard < budget; guard += 1) {
    if (await page.locator(".prm-card").count()) return { moves, reached: "end" };
    const giveUp = policy === "lose" || moves >= WIN_ATTEMPT_MOVES;
    const reward = page.locator(`.rsg-reward-btn[aria-label^="Escolher ${giveUp ? "Picareta" : "Segunda Chance"}"]`);
    if (await reward.count()) {
      await reward.click();
      await page.waitForTimeout(250);
      continue;
    }
    const board = await page.evaluate(() => {
      const canvas = document.querySelector("canvas.route-babylon-board");
      if (!canvas) return null;
      const list = (name) => (canvas.getAttribute(name) ?? "").split(" ").filter(Boolean);
      return {
        status: canvas.getAttribute("data-status"),
        player: canvas.getAttribute("data-player-cell"),
        exit: canvas.getAttribute("data-exit-cell"),
        walls: list("data-wall-cells"),
        lights: list("data-light-cells"),
        collected: list("data-collected-light-cells"),
        guardian: canvas.getAttribute("data-guardian-cell"),
        danger: list("data-danger-cells"),
        sentinel: (() => {
          const fiberKey = Object.keys(canvas).find((k) => k.startsWith("__reactFiber$"));
          for (let fiber = fiberKey ? canvas[fiberKey] : null; fiber; fiber = fiber.return) {
            const cell = fiber.memoizedProps?.sentinel;
            if (cell && typeof cell.row === "number") return `${cell.row},${cell.col}`;
          }
          return null;
        })(),
      };
    });
    if (!board || board.status !== "playing") {
      await page.waitForTimeout(250);
      continue;
    }
    const walls = new Set(board.walls);
    let best = null;
    if (giveUp) {
      best = shortestPath(board.player, board.guardian, walls);
    } else {
      const remaining = board.lights.filter((cell) => !board.collected.includes(cell));
      const goals = remaining.length ? remaining : [board.exit];
      const around = new Set([...board.walls, board.guardian, ...board.danger, ...(board.sentinel ? [board.sentinel] : [])]);
      around.delete(board.player);
      for (const goal of goals) {
        around.delete(goal);
        const route = shortestPath(board.player, goal, around) ?? shortestPath(board.player, goal, walls);
        if (route && (!best || route.length < best.length)) best = route;
      }
    }
    if (!best || best.length < 2) return { moves, reached: "stuck" };
    const [pr, pc] = parse(board.player);
    const [nr, nc] = parse(best[1]);
    await page.keyboard.press(ARROWS[`${nr - pr},${nc - pc}`]);
    moves += 1;
    await page.waitForTimeout(260);
  }
  return { moves, reached: "budget" };
}

const start = () => page.locator('button[aria-label="Iniciar rota com a dificuldade selecionada"]').click();
const resultCard = () =>
  page.evaluate(() => ({
    title: document.querySelector("#reward-title")?.textContent ?? null,
    buttons: [...document.querySelectorAll(".prm-actions button")].map((button) => button.textContent.trim()),
  }));

/** Plays the Route on screen to its result, then reads the card and what was saved. */
async function playToResult(policy) {
  await start();
  const played = await playRoute(policy);
  await page.locator(".prm-card").waitFor({ timeout: 30000 });
  await page.waitForTimeout(400);
  const card = await resultCard();
  const [saved] = await storedResults();
  return { played: played.reached, card, saved };
}

/** The card's first action, then the entry it starts, then the Rota on screen. */
async function takePrimaryAndArrive(label) {
  const from = (await observed()).phases.length;
  await page.locator(".prm-cta").click();
  const entered = await enterThrough(from, label);
  await page.locator(".rsg-shell").waitFor({ state: "visible", timeout: 60000 });
  await boardReady();
  return { entered, ...(await onScreen()) };
}

async function run() {
  session.step = "home";
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.locator(".hj-stage").waitFor({ timeout: 180000 });
  await page.waitForTimeout(1800);
  const enterRota = async (label) => {
    await page.locator('.hj-gallery-pip[aria-label="Selecionar Rota Estratégica"]').click({ force: true });
    await page.mouse.move(14, 14);
    await page.waitForTimeout(700);
    const from = (await observed()).phases.length;
    await page.locator('.hj-world-object[aria-current="true"] .hj-world-enter').click({ force: true });
    const entered = await enterThrough(from, label);
    await page.locator(".wentry-intro-layer .pgi-cta").waitFor({ state: "visible", timeout: 60000 });
    const introShown = (await onScreen()).introShown;
    await page.waitForTimeout(300);
    await page.locator(".wentry-intro-layer .pgi-cta").click();
    await page.locator(".rsg-shell").waitFor({ state: "visible", timeout: 60000 });
    await boardReady();
    return { entered, introShown, ...(await onScreen()) };
  };

  session.step = "enter";
  const first = await enterRota("first entry");
  await page.locator(`.rsg-difficulty-btn[aria-label^="Modo ${MODE_TITLE[MODE]}"]`).click();
  await page.waitForTimeout(300);

  // Route 1 and Route 2, lost: either end leads on.
  const hops = [];
  for (const route of [1, 2]) {
    session.step = `route ${route}`;
    const setup = await onScreen();
    const end = await playToResult("lose");
    const next = await takePrimaryAndArrive(`after Route ${route}`);
    hops.push({ setup: { route: setup.route, mode: setup.mode }, ...end, next });
  }

  // Route 3 until it is won: the first one lost on purpose, then played to win.
  const attempts = [];
  let terminal = null;
  for (let attempt = 0; attempt < ATTEMPTS && !terminal; attempt += 1) {
    session.step = `route 3, attempt ${attempt + 1}`;
    const setup = await onScreen();
    const end = await playToResult(attempt === 0 ? "lose" : "win");
    const won = end.saved?.details?.won === true;
    if (!won) {
      const next = await takePrimaryAndArrive(`after Route 3, attempt ${attempt + 1}`);
      attempts.push({ setup: { route: setup.route, mode: setup.mode }, outcome: "lost", ...end, next });
      continue;
    }
    attempts.push({ setup: { route: setup.route, mode: setup.mode }, outcome: "won", ...end });
    session.step = "journey complete";
    const before = await observed();
    await page.locator(".prm-cta").click();
    await page.locator(".hj-stage").waitFor({ timeout: 60000 });
    await page.waitForTimeout(2500);
    const after = await observed();
    terminal = {
      home: Boolean(await page.locator(".hj-stage").count()),
      rotaOnScreen: Boolean(await page.locator(".rsg-shell").count()),
      entryStarted: Boolean(await page.locator("[data-entry-phase]").count()),
      rotaMountedAfterTheAction: after.rotaMounts - before.rotaMounts,
      storedNewest: (await storedResults())[0] ?? null,
    };
  }

  // The Rota again, from Home: a new journey.
  let again = null;
  if (terminal) {
    session.step = "enter again";
    again = await enterRota("entry after the journey");
  }
  const end = await observed();
  return { first, hops, attempts, terminal, again, end };
}

const routeEntry = (routeNumber) => ({ kind: "escape-maze-route", routeNumber, difficulty: MODE });
let result;
try {
  const r = await run();
  const lastLost = r.attempts.filter((a) => a.outcome === "lost");
  const won = r.attempts.find((a) => a.outcome === "won") ?? null;
  const actual = {
    first: { entered: r.first.entered, introShown: r.first.introShown, route: r.first.route, mode: r.first.mode },
    hops: r.hops.map((hop) => ({
      setup: hop.setup,
      played: hop.played,
      title: hop.card.title,
      buttons: hop.card.buttons,
      savedContinuation: hop.saved?.continuation ?? null,
      next: { entered: hop.next.entered, route: hop.next.route, mode: hop.next.mode, status: hop.next.status, introShown: hop.next.introShown },
    })),
    route3Lost: lastLost.map((a) => ({
      setup: a.setup,
      played: a.played,
      title: a.card.title,
      buttons: a.card.buttons,
      savedContinuation: a.saved?.continuation ?? null,
      savedJourneyCompleted: a.saved?.details?.journeyCompleted ?? null,
      next: { entered: a.next.entered, route: a.next.route, mode: a.next.mode, status: a.next.status, introShown: a.next.introShown },
    })),
    route3Won: won && {
      setup: won.setup,
      title: won.card.title,
      buttons: won.card.buttons,
      saved: {
        route: won.saved?.details?.routeNumber ?? null,
        journeyCompleted: won.saved?.details?.journeyCompleted ?? null,
        hasContinuation: won.saved ? "continuation" in won.saved : null,
        nextRouteFields: won.saved ? Object.keys(won.saved.details).filter((k) => /^nextRoute/.test(k)) : null,
      },
    },
    terminal: r.terminal && {
      home: r.terminal.home,
      rotaOnScreen: r.terminal.rotaOnScreen,
      entryStarted: r.terminal.entryStarted,
      rotaMountedAfterTheAction: r.terminal.rotaMountedAfterTheAction,
      storedNewestJourneyCompleted: r.terminal.storedNewest?.details?.journeyCompleted ?? null,
      storedNewestHasContinuation: r.terminal.storedNewest ? "continuation" in r.terminal.storedNewest : null,
    },
    again: r.again && { entered: r.again.entered, introShown: r.again.introShown, route: r.again.route, mode: r.again.mode, status: r.again.status },
    routesNamed: [...new Set(r.end.routesNamed.map((seen) => seen.route))].sort((a, b) => a - b),
    resultsWithTheGameStillOnScreen: r.end.resultArrivals.filter((arrival) => arrival.gameInDocument).length,
    pageErrors: session.pageErrors,
  };
  const expected = {
    first: { entered: "complete", introShown: true, route: 1, mode: "easy" },
    hops: [1, 2].map((route) => ({
      setup: { route, mode: MODE },
      played: "end",
      title: "Rota registrada",
      buttons: ["Explorar outra rota", "Continuar jornada"],
      savedContinuation: routeEntry(route + 1),
      next: { entered: "complete", route: route + 1, mode: MODE, status: "setup", introShown: false },
    })),
    route3Lost: lastLost.map(() => ({
      setup: { route: FINAL_ROUTE, mode: MODE },
      played: "end",
      title: "Rota registrada",
      buttons: ["Tentar Rota 3 novamente", "Continuar jornada"],
      savedContinuation: routeEntry(FINAL_ROUTE),
      savedJourneyCompleted: null,
      next: { entered: "complete", route: FINAL_ROUTE, mode: MODE, status: "setup", introShown: false },
    })),
    route3Won: {
      setup: { route: FINAL_ROUTE, mode: MODE },
      title: "Jornada concluída",
      buttons: ["Voltar aos mundos"],
      saved: { route: FINAL_ROUTE, journeyCompleted: true, hasContinuation: false, nextRouteFields: [] },
    },
    terminal: {
      home: true,
      rotaOnScreen: false,
      entryStarted: false,
      rotaMountedAfterTheAction: 0,
      storedNewestJourneyCompleted: true,
      storedNewestHasContinuation: false,
    },
    again: { entered: "complete", introShown: true, route: 1, mode: "easy", status: "setup" },
    routesNamed: [1, 2, 3],
    resultsWithTheGameStillOnScreen: 0,
    pageErrors: [],
  };
  const canonical = (value) =>
    JSON.stringify(value, (_, v) =>
      v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v,
    );
  result = {
    pass: canonical(actual) === canonical(expected) && lastLost.length >= 1,
    actual,
    expected,
    route3Attempts: r.attempts.length,
    entryRetries,
  };
} catch (error) {
  if (OUT) await page.screenshot({ path: path.join(OUT, "terminal-exception.png") }).catch(() => {});
  result = {
    pass: false,
    exception: String(error?.message ?? error).split("\n")[0],
    step: session.step,
    observed: await observed().catch(() => null),
    pageErrors: session.pageErrors,
  };
}
await context.close();
await browser.close();

log(`${result.pass ? "PASS" : "FAIL"}  product (${MODE}${result.route3Attempts ? `, Route 3 attempts ${result.route3Attempts}` : ""})`);
console.log(`        entry watchdog retries: ${JSON.stringify(entryRetries.filter((e) => e.retries > 0))}`);
console.log(`        ${JSON.stringify(result.actual ?? result)}`);
if (!result.pass && result.expected) console.log(`        expected: ${JSON.stringify(result.expected)}`);
if (OUT) {
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(
    path.join(OUT, `journey-terminal-probe-${MODE}.json`),
    JSON.stringify({ mission: "ROUTE-JOURNEY-TERMINAL-01", base: BASE, mode: MODE, ...result }, null, 2),
  );
}
console.log(result.pass ? "ROUTE_JOURNEY_TERMINAL_PROBE_OK" : "ROUTE_JOURNEY_TERMINAL_PROBE_FAILED");
process.exitCode = result.pass ? EXIT_OK : EXIT_FAILED;
