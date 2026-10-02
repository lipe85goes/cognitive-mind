/**
 * ROUTE-JOURNEY-OWNERSHIP-01 — browser probe: who moves the journey to the
 * next Route, in the real app.
 *
 *   product  production build, from the Home: Rota (intro, Route 1) → a mode →
 *            Route 1 played to its end → the result → "Explorar próxima rota" /
 *            "Explorar outra rota" → Route 2 (a restart on the way keeps it
 *            Route 2) → played to its end → the result → Route 3.
 *   lab      `next dev`, /lab/route-launcher: a seeded Route N launched, played
 *            to its end with the game still on screen, then the lab's own
 *            "Próxima rota" → a new session on Route N + 1, same mode.
 *
 * The one thing measured is where Route N + 1 comes from. In the product the
 * result is the only way forward: the observer below sees every mutation
 * BATCH, not snapshots, so a control inserted and removed between two frames
 * is still caught. It records whether an in-game "next route" control was ever
 * attached, whether the board ever showed a finished status, whether the game
 * and the result were ever on the page together, and — at the batch the result
 * arrives — whether the game left in that same batch and the result had
 * already been saved (that is `onComplete` having run).
 *
 * In the lab the game stays mounted after its end, so there an in-game control
 * WOULD be reachable; the lab must instead move on through the result's
 * continuation. Against d258077 the lab scenario fails on exactly that (the
 * Rota's own button attaches and advances the Route inside the session, under
 * a banner that still names the old one), and the product scenario reports the
 * button's code shipped in the Rota's chunk but never attached.
 *
 * Read-only: nothing in the app is instrumented; the init script only
 * observes. Writes nothing unless `--out DIR` is given.
 *
 * Usage:
 *   next build && next start -p 3100     (product)
 *   next dev -p 3000                     (lab)
 *   node tools/validation/route-journey-ownership-browser-probe.mjs
 *        [--scenario product,lab] [--base URL] [--lab-base URL] [--build DIR]
 *        [--mode easy|medium|hard] [--play win|lose] [--lab-seed N] [--lab-route N]
 *        [--viewport WxH] [--out DIR]
 *
 * Exit: 0 every scenario held · 1 a scenario failed · 3 usage / setup error.
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
const SCENARIOS = ["product", "lab"];
const ONLY = arg("--scenario", SCENARIOS.join(",")).split(",");
const BASE = arg("--base", "http://localhost:3100");
const LAB_BASE = arg("--lab-base", "http://localhost:3000");
const BUILD = arg("--build", ".next");
const OUT = arg("--out", null);
const MODE = arg("--mode", "medium");
const PLAY = arg("--play", "win");
const LAB_SEED = Number(arg("--lab-seed", "12421027"));
const LAB_ROUTE = Number(arg("--lab-route", "2"));
const MODE_TITLE = { easy: "Aberto", medium: "Equilibrado", hard: "Desafiador" };
if (
  ONLY.some((name) => !SCENARIOS.includes(name)) ||
  !(MODE in MODE_TITLE) ||
  !["win", "lose"].includes(PLAY) ||
  !Number.isSafeInteger(LAB_SEED) ||
  !Number.isSafeInteger(LAB_ROUTE) ||
  LAB_ROUTE < 1
) {
  console.error(`usage: --scenario ${SCENARIOS.join(",")} · --mode easy|medium|hard · --play win|lose · --lab-seed N · --lab-route N`);
  process.exit(EXIT_USAGE);
}
const [VIEW_W, VIEW_H] = arg("--viewport", "800x500").split("x").map(Number);
const STORAGE_KEY = "cognitive-mind-recent-results";
/** The Rota's own post-Route button, as d258077 rendered it. No other element carries this class. */
const IN_GAME_CONTROL_CLASS = "rsg-next-route-btn";
const log = (...a) => console.log("[ownership]", ...a);

// --- the production build's chunks: is the in-game control shipped at all? ---------------

function shippedInGameControl() {
  const chunkDir = path.join(BUILD, "static", "chunks");
  if (!fs.existsSync(chunkDir)) {
    console.error(`no build at ${BUILD} (expected ${chunkDir})`);
    process.exit(EXIT_USAGE);
  }
  const files = fs.readdirSync(chunkDir).filter((file) => file.endsWith(".js"));
  const text = new Map(files.map((file) => [file, fs.readFileSync(path.join(chunkDir, file), "utf8")]));
  const rota = files.filter((file) => text.get(file).includes("rsg-shell"));
  if (rota.length === 0) {
    console.error(`no chunk in ${BUILD} carries the Rota ("rsg-shell")`);
    process.exit(EXIT_USAGE);
  }
  return { rotaChunks: rota, withInGameControl: files.filter((file) => text.get(file).includes(IN_GAME_CONTROL_CLASS)) };
}

// --- in-page observer (observes, changes nothing) ------------------------------------------

function installObserver() {
  const probe = {
    batches: 0,
    phases: [],
    inGameControlAttached: [],
    finishedOnBoard: [],
    gameAndResultTogether: 0,
    resultArrivals: [],
  };
  window.__ownershipProbe = probe;
  const LABELS = new Set(["Explorar próxima rota", "Começar uma nova rota"]);
  const elementsIn = (node, selector) =>
    node.nodeType !== 1 ? [] : [...(node.matches(selector) ? [node] : []), ...node.querySelectorAll(selector)];
  /** A button that moves to another Route from INSIDE the game: never one of the result card's. */
  const isInGameControl = (button) =>
    !button.closest(".prm-card") &&
    (button.classList.contains("rsg-next-route-btn") ||
      LABELS.has(button.textContent.trim()) ||
      LABELS.has(button.getAttribute("aria-label") ?? ""));
  const noteFinished = (value, where) => {
    if (value === "won" || value === "lost") probe.finishedOnBoard.push({ batch: probe.batches, where, value });
  };
  let phase;
  new MutationObserver((records) => {
    probe.batches += 1;
    let resultAdded = false;
    let gameRemoved = false;
    for (const record of records) {
      if (record.type === "childList") {
        for (const node of record.addedNodes) {
          for (const button of elementsIn(node, "button")) {
            if (isInGameControl(button)) {
              probe.inGameControlAttached.push({ batch: probe.batches, text: button.textContent.trim() });
            }
          }
          for (const canvas of elementsIn(node, "canvas.route-babylon-board")) noteFinished(canvas.getAttribute("data-status"), "canvas");
          for (const panel of elementsIn(node, ".rsg-board-panel.is-won, .rsg-board-panel.is-lost")) noteFinished(panel.classList.contains("is-won") ? "won" : "lost", "panel");
          if (elementsIn(node, ".prm-card").length) resultAdded = true;
        }
        for (const node of record.removedNodes) if (elementsIn(node, ".rsg-shell").length) gameRemoved = true;
      } else if (record.type === "attributes") {
        const target = record.target;
        if (record.attributeName === "data-status" && target.matches("canvas.route-babylon-board")) {
          noteFinished(record.oldValue, "canvas");
          noteFinished(target.getAttribute("data-status"), "canvas");
        }
        if (record.attributeName === "class" && target.matches(".rsg-board-panel")) {
          if (target.classList.contains("is-won")) noteFinished("won", "panel");
          if (target.classList.contains("is-lost")) noteFinished("lost", "panel");
        }
      }
    }
    const entry = document.querySelector("[data-entry-phase]");
    const nextPhase = entry ? entry.getAttribute("data-entry-phase") : null;
    if (nextPhase !== phase) probe.phases.push((phase = nextPhase));
    const gameInDocument = Boolean(document.querySelector(".rsg-shell"));
    if (gameInDocument && document.querySelector(".prm-card")) probe.gameAndResultTogether += 1;
    if (resultAdded) {
      let saved = [];
      try {
        saved = JSON.parse(window.localStorage.getItem("cognitive-mind-recent-results") ?? "[]");
      } catch {
        saved = null;
      }
      probe.resultArrivals.push({
        gameRemovedInTheSameBatch: gameRemoved,
        gameInDocument,
        resultsSaved: Array.isArray(saved) ? saved.length : null,
        savedRoute: saved?.[0]?.details?.routeNumber ?? null,
        savedContinuation: saved?.[0]?.continuation ?? null,
      });
    }
  }).observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeOldValue: true,
    attributeFilter: ["data-entry-phase", "data-status", "class"],
  });
}

// --- driving the app ----------------------------------------------------------------------

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--use-gl=angle", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
});

async function openSession(name) {
  const context = await browser.newContext({ viewport: { width: VIEW_W, height: VIEW_H }, deviceScaleFactor: 1 });
  await context.addInitScript(installObserver);
  const page = await context.newPage();
  const session = { name, page, context, step: "start", pageErrors: [], console: [] };
  page.on("console", (message) => {
    if (message.type() === "error") session.console.push({ text: message.text().slice(0, 240), step: session.step });
  });
  page.on("pageerror", (error) => session.pageErrors.push({ text: String(error).slice(0, 240), step: session.step }));
  return session;
}

const observed = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__ownershipProbe)));
const storedResults = (page) => page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "[]"), STORAGE_KEY);

async function entryOutcome(session, { from = 0, timeout = 120000 } = {}) {
  const handle = await session.page.waitForFunction(
    ({ from }) => {
      const phases = window.__ownershipProbe.phases.slice(from);
      if (phases.includes("error")) return "error";
      const entered = phases.includes("revealing") || phases.includes("complete");
      return entered && !document.querySelector("[data-entry-phase]") ? "complete" : null;
    },
    { from },
    { timeout, polling: 100 },
  );
  return handle.jsonValue();
}

const boardReady = (session) =>
  session.page.locator('.route-babylon-wrap[data-visual-state="ready"]').waitFor({ timeout: 120000 });

/** The Route and mode the game itself shows, whatever its screen. */
async function onScreen(session) {
  return session.page.evaluate((titles) => {
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

/**
 * To win: lights, then the portal, around the Hunter's reach. To lose: straight
 * at the Hunter. A win that has not come after `WIN_ATTEMPT_MOVES` turns into a
 * loss, so every Route ends; both ends lead to Route N + 1. `ended` says when
 * the Route is over from the outside: the result card (product) or the board's
 * own finished status (lab, where the game stays).
 */
const WIN_ATTEMPT_MOVES = 60;
async function playRoute(session, ended, budget = 160) {
  const { page } = session;
  let moves = 0;
  for (let guard = 0; guard < budget; guard += 1) {
    if (await ended()) return { moves, reached: "end" };
    const giveUp = PLAY === "lose" || moves >= WIN_ATTEMPT_MOVES;
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
      const around = new Set([...board.walls, board.guardian, ...board.danger]);
      for (const goal of goals) {
        const avoid = new Set(around);
        avoid.delete(goal);
        const route = shortestPath(board.player, goal, avoid) ?? shortestPath(board.player, goal, walls);
        if (route && (!best || route.length < best.length)) best = route;
      }
    }
    if (!best || best.length < 2) return { moves, reached: "stuck" };
    const [pr, pc] = parse(board.player);
    const [nr, nc] = parse(best[1]);
    await page.keyboard.press(ARROWS[`${nr - pr},${nc - pc}`]);
    moves += 1;
    // Above the hook's 150 ms gesture guard: every press is one step.
    await page.waitForTimeout(260);
  }
  return { moves, reached: "budget" };
}

const start = (page) => page.locator('button[aria-label="Iniciar rota com a dificuldade selecionada"]').click();

// --- product -------------------------------------------------------------------------------

async function product(session) {
  const { page } = session;
  const shipped = shippedInGameControl();
  session.step = "home";
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.locator(".hj-stage").waitFor({ timeout: 180000 });
  await page.waitForTimeout(1800);
  await page.locator('.hj-gallery-pip[aria-label="Selecionar Rota Estratégica"]').click({ force: true });
  await page.mouse.move(14, 14);
  await page.waitForTimeout(700);
  session.step = "enter";
  let from = (await observed(page)).phases.length;
  await page.locator('.hj-world-object[aria-current="true"] .hj-world-enter').click({ force: true });
  const entered = await entryOutcome(session, { from });
  const introAtEntry = (await onScreen(session)).introShown;
  await page.locator(".wentry-intro-layer .pgi-cta").waitFor({ state: "visible", timeout: 60000 });
  await page.waitForTimeout(300);
  await page.locator(".wentry-intro-layer .pgi-cta").click();
  await page.locator(".rsg-shell").waitFor({ state: "visible", timeout: 60000 });
  await boardReady(session);
  const fresh = await onScreen(session);
  await page.locator(`.rsg-difficulty-btn[aria-label^="Modo ${MODE_TITLE[MODE]}"]`).click();

  const hops = [];
  for (let hop = 1; hop <= 2; hop += 1) {
    session.step = `route ${hop}`;
    const setup = await onScreen(session);
    await start(page);
    let restart = null;
    if (hop === 2) {
      // "Começar outra rota" (restartGame), the in-game retry: a new board, the same Route.
      await page.locator(".rsg-details-trigger").click();
      await page.locator('button[aria-label="Começar outra rota"]').click();
      await page.waitForTimeout(400);
      restart = await onScreen(session);
      await page.locator(".rsg-details-close").click();
      await page.waitForTimeout(300);
    }
    const played = await playRoute(session, async () => (await page.locator(".prm-card").count()) > 0);
    await page.locator(".prm-card").waitFor({ timeout: 30000 });
    await page.waitForTimeout(400);
    const card = await page.evaluate(() => ({
      title: document.querySelector("#reward-title")?.textContent ?? null,
      cta: document.querySelector(".prm-cta")?.textContent?.trim() ?? null,
    }));
    const [saved] = await storedResults(page);
    session.step = `continue ${hop}`;
    from = (await observed(page)).phases.length;
    await page.locator(".prm-cta").click();
    const continued = await entryOutcome(session, { from });
    await page.locator(".rsg-shell").waitFor({ state: "visible", timeout: 60000 });
    await boardReady(session);
    const next = await onScreen(session);
    hops.push({
      setup: { route: setup.route, mode: setup.mode },
      restart: restart && { route: restart.route, mode: restart.mode, status: restart.status },
      played: played.reached,
      outcome: saved?.details?.won === true ? "won" : "lost",
      cta: card.cta,
      savedContinuation: saved?.continuation ?? null,
      next: { entered: continued, route: next.route, mode: next.mode, status: next.status, introShown: next.introShown },
    });
  }
  const end = await observed(page);
  const actual = {
    entered,
    fresh: { route: fresh.route, mode: fresh.mode, introAtEntry },
    hops,
    resultArrivals: end.resultArrivals.map(({ savedContinuation, ...arrival }) => ({
      ...arrival,
      savedContinuationRoute: savedContinuation?.routeNumber ?? null,
    })),
    inGameControlShipped: shipped.withInGameControl,
    inGameControlAttached: end.inGameControlAttached,
    finishedOnBoard: end.finishedOnBoard,
    gameAndResultTogether: end.gameAndResultTogether,
    pageErrors: session.pageErrors,
  };
  const cta = (outcome) => (outcome === "won" ? "Explorar próxima rota" : "Explorar outra rota");
  const expected = {
    entered: "complete",
    fresh: { route: 1, mode: "easy", introAtEntry: true },
    hops: hops.map((hop, i) => ({
      setup: { route: i + 1, mode: MODE },
      restart: i === 1 ? { route: 2, mode: MODE, status: "playing" } : null,
      played: "end",
      outcome: hop.outcome,
      cta: cta(hop.outcome),
      savedContinuation: { kind: "escape-maze-route", routeNumber: i + 2, difficulty: MODE },
      next: { entered: "complete", route: i + 2, mode: MODE, status: "setup", introShown: false },
    })),
    resultArrivals: [1, 2].map((n) => ({
      gameRemovedInTheSameBatch: true,
      gameInDocument: false,
      resultsSaved: n,
      savedRoute: n,
      savedContinuationRoute: n + 1,
    })),
    inGameControlShipped: [],
    inGameControlAttached: [],
    finishedOnBoard: [],
    gameAndResultTogether: 0,
    pageErrors: [],
  };
  const deadPath = {
    inGameControlShippedIn: shipped.withInGameControl,
    inGameControlEverAttached: end.inGameControlAttached.length,
    finishedStatusEverRendered: end.finishedOnBoard.length,
  };
  return { actual, expected, deadPath, outcomes: hops.map((hop) => hop.outcome) };
}

// --- lab -----------------------------------------------------------------------------------

async function lab(session) {
  const { page } = session;
  session.step = "launcher";
  await page.goto(`${LAB_BASE}/lab/route-launcher`, { waitUntil: "domcontentloaded", timeout: 300000 });
  await page.getByRole("button", { name: "Launch" }).waitFor({ timeout: 300000 });
  await page.getByLabel("Route").fill(String(LAB_ROUTE));
  await page.getByLabel("Difficulty").selectOption(MODE);
  await page.getByLabel("Seed").fill(String(LAB_SEED));
  await page.getByRole("button", { name: "Launch" }).click();
  await page.locator(".rsg-shell").waitFor({ state: "visible", timeout: 300000 });
  await boardReady(session);
  const banner = () =>
    page.evaluate(() => Number(/Route\s*(\d+)/.exec(document.querySelector("header")?.textContent ?? "")?.[1]) || null);
  const launched = { banner: await banner(), ...(await onScreen(session)) };

  session.step = "play";
  await start(page);
  const played = await playRoute(session, () =>
    page.evaluate(() => ["won", "lost"].includes(document.querySelector("canvas.route-babylon-board")?.getAttribute("data-status"))),
  );
  await page.waitForTimeout(800);
  const atEnd = { banner: await banner(), ...(await onScreen(session)) };
  const labResult = await page.evaluate(() => /Fim:\s*(vitória|derrota)/.exec(document.body.textContent)?.[1] ?? null);
  const labNext = page.getByRole("button", { name: /^Próxima rota/ });
  const inGame = page.locator(`.${IN_GAME_CONTROL_CLASS}`);
  const controls = { lab: await labNext.count(), inGame: await inGame.count() };

  let next = null;
  let internalAdvance = null;
  if (controls.lab) {
    session.step = "lab next";
    await labNext.click();
    await page.locator('button[aria-label="Iniciar rota com a dificuldade selecionada"]').waitFor({ timeout: 120000 });
    await boardReady(session);
    next = { banner: await banner(), ...(await onScreen(session)) };
  } else if (controls.inGame) {
    // d258077: the Rota's own button. It moves the Route inside the session,
    // without a result and without the launcher knowing.
    session.step = "in-game next";
    await inGame.first().click();
    await page.waitForTimeout(1200);
    internalAdvance = { banner: await banner(), ...(await onScreen(session)) };
  }
  const end = await observed(page);
  const actual = {
    launched: { banner: launched.banner, route: launched.route, mode: launched.mode, status: launched.status },
    played: played.reached,
    labResult,
    atEnd: { banner: atEnd.banner, route: atEnd.route, status: atEnd.status },
    controls,
    next: next && { banner: next.banner, route: next.route, mode: next.mode, status: next.status },
    internalAdvance: internalAdvance && { banner: internalAdvance.banner, route: internalAdvance.route, status: internalAdvance.status },
    inGameControlAttached: end.inGameControlAttached.length,
    pageErrors: session.pageErrors,
  };
  const expected = {
    launched: { banner: LAB_ROUTE, route: LAB_ROUTE, mode: MODE, status: "setup" },
    played: "end",
    labResult: atEnd.status === "won" ? "vitória" : "derrota",
    atEnd: { banner: LAB_ROUTE, route: LAB_ROUTE, status: atEnd.status === "won" ? "won" : "lost" },
    controls: { lab: 1, inGame: 0 },
    next: { banner: LAB_ROUTE + 1, route: LAB_ROUTE + 1, mode: MODE, status: "setup" },
    internalAdvance: null,
    inGameControlAttached: 0,
    pageErrors: [],
  };
  return { actual, expected, outcomes: [atEnd.status] };
}

// --- run -----------------------------------------------------------------------------------

if (OUT) fs.mkdirSync(OUT, { recursive: true });
const canonical = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v,
  );
const RUNNERS = { product, lab };
const results = [];
for (const name of ONLY) {
  const session = await openSession(name);
  let result;
  try {
    result = await RUNNERS[name](session);
    result.pass = canonical(result.actual) === canonical(result.expected);
  } catch (error) {
    if (OUT) await session.page.screenshot({ path: path.join(OUT, `${name}-exception.png`) }).catch(() => {});
    result = {
      pass: false,
      exception: String(error?.message ?? error).split("\n")[0],
      step: session.step,
      observed: await observed(session.page).catch(() => null),
      pageErrors: session.pageErrors,
    };
  }
  await session.context.close();
  results.push({ scenario: name, mode: MODE, play: PLAY, ...result });
  log(`${result.pass ? "PASS" : "FAIL"}  ${name} (${MODE}, play ${PLAY}${result.outcomes ? `, ended ${result.outcomes.join("/")}` : ""})`);
  if (result.deadPath) console.log(`        dead path: ${JSON.stringify(result.deadPath)}`);
  console.log(`        ${JSON.stringify(result.actual ?? result)}`);
  if (!result.pass && result.expected) console.log(`        expected: ${JSON.stringify(result.expected)}`);
}
await browser.close();

if (OUT) {
  fs.writeFileSync(
    path.join(OUT, "journey-ownership-probe.json"),
    JSON.stringify({ mission: "ROUTE-JOURNEY-OWNERSHIP-01", base: BASE, labBase: LAB_BASE, results }, null, 2),
  );
}
const failing = results.filter((result) => !result.pass).map((result) => result.scenario);
console.log(`\n${results.length - failing.length}/${results.length} passed · failing: ${failing.join(", ") || "none"}`);
console.log(failing.length ? "ROUTE_JOURNEY_OWNERSHIP_PROBE_FAILED" : "ROUTE_JOURNEY_OWNERSHIP_PROBE_OK");
process.exitCode = failing.length ? EXIT_FAILED : EXIT_OK;
