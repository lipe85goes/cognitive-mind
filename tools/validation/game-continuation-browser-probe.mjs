/**
 * GAME-CONTINUATION-CONTRACT-01 — browser probe: the journey in the production
 * build, from the Home.
 *
 *   journey  Home (no game code loaded) → Rota (intro, Route 1, default mode) →
 *            a mode picked on the setup screen → the Route played to its end →
 *            the result saved with its continuation → "Explorar próxima rota" /
 *            "Explorar outra rota" → Route 2 on the same mode, intro skipped →
 *            back to the worlds → Rota again: Route 1, default mode, intro →
 *            back → Circuito: its own intro, its own game.
 *   retry    the same journey up to the result; then the continuation's entry
 *            is held (its `board.glb` never answers) until the watchdog opens
 *            the error panel, "Tentar novamente" is pressed while it is still
 *            held, and only then is it let through: the retry must land on the
 *            same Route 2, same mode, intro skipped, with one result saved.
 *
 * Throughout, the Rota's own "next route" button must never be attached to the
 * page, nor the board ever report a finished status: in the product the shell
 * takes the game off the screen in the same update that saves the result. That
 * button and `continueJourney` were removed (ROUTE-JOURNEY-OWNERSHIP-01); the
 * check stays as a guard against a way forward inside the game coming back.
 *
 * The Route is played from what the board publishes on its canvas
 * (`data-player-cell`, `data-wall-cells`, `data-danger-cells`, …) with the arrow
 * keys, as a player would; a win is tried, a loss is just as good — both go to
 * Route N + 1.
 *
 * Read-only by construction: the product is not instrumented. An init script
 * only observes the DOM; network control is Playwright routing of the board
 * GLB in `retry`. It writes nothing unless `--out DIR` is given.
 *
 * Usage:
 *   next build && next start -p 3100
 *   node tools/validation/game-continuation-browser-probe.mjs [--base URL]
 *        [--build DIR] [--out DIR] [--scenario NAME[,NAME...]] [--mode easy|medium|hard]
 *        [--play win|lose] [--viewport WxH]
 *
 *   --play lose  walks Route 1 into the Hunter, for the "Explorar outra rota" path.
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
    console.error(
      "playwright not found. Install it, or set PLAYWRIGHT_DIR to a node_modules directory that has it.",
    );
    process.exit(EXIT_USAGE);
  }
})();

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const BASE = arg("--base", "http://localhost:3100");
const BUILD = arg("--build", ".next");
const OUT = arg("--out", null);
const SCENARIOS = ["journey", "retry"];
const ONLY = arg("--scenario", SCENARIOS.join(",")).split(",");
const MODE = arg("--mode", "hard");
const MODE_TITLE = { easy: "Aberto", medium: "Equilibrado", hard: "Desafiador" };
const PLAY = arg("--play", "win");
if (ONLY.some((name) => !SCENARIOS.includes(name)) || !(MODE in MODE_TITLE) || !["win", "lose"].includes(PLAY)) {
  console.error(`usage: --scenario ${SCENARIOS.join(",")} · --mode easy|medium|hard · --play win|lose`);
  process.exit(EXIT_USAGE);
}
/** Small on purpose: under software WebGL a large canvas pushes the Rota's first load toward its watchdog. */
const [VIEW_W, VIEW_H] = arg("--viewport", "800x500").split("x").map(Number);
const WATCHDOG_MS = 28_000;
const STORAGE_KEY = "cognitive-mind-recent-results";
const log = (...a) => console.log("[continuation]", ...a);

// --- the build's chunks ---------------------------------------------------------------

const chunkDir = path.join(BUILD, "static", "chunks");
if (!fs.existsSync(chunkDir)) {
  console.error(`no build at ${BUILD} (expected ${chunkDir})`);
  process.exit(EXIT_USAGE);
}
const chunkText = new Map(
  fs
    .readdirSync(chunkDir)
    .filter((file) => file.endsWith(".js"))
    .map((file) => [file, fs.readFileSync(path.join(chunkDir, file), "utf8")]),
);
/** Text only game code carries: the continuation reader, the Rota, its board, Babylon, the Circuito. */
const GAME_MARKERS = {
  routeContinuation: "escape-maze-route",
  rota: "rsg-shell",
  board: "route-babylon-wrap",
  babylon: "ArcRotateCamera",
  circuito: "mfg-shell",
};
const chunksWith = (marker) => [...chunkText].filter(([, text]) => text.includes(marker)).map(([file]) => file);
for (const [name, marker] of Object.entries(GAME_MARKERS)) {
  if (chunksWith(marker).length > 0) continue;
  // A build from before the continuation contract has no continuation reader to find.
  if (name === "routeContinuation") {
    log(`no chunk in ${BUILD} carries "${marker}": a build without the typed continuation`);
    continue;
  }
  console.error(`no chunk in ${BUILD} carries the ${name} marker "${marker}"`);
  process.exit(EXIT_USAGE);
}
const chunkOf = (url) => {
  try {
    const { pathname } = new URL(url);
    return pathname.includes("/_next/static/chunks/") ? path.posix.basename(pathname) : null;
  } catch {
    return null;
  }
};
{
  const [sample] = chunksWith(GAME_MARKERS.rota);
  const served = await fetch(`${BASE}/_next/static/chunks/${sample}`).then(
    (response) => (response.ok ? response.text() : null),
    () => null,
  );
  if (served !== chunkText.get(sample)) {
    console.error(`${BASE} does not serve ${BUILD}'s ${sample}: start the server on this build`);
    process.exit(EXIT_USAGE);
  }
}

// --- in-page observer (observes, changes nothing) ----------------------------------------

function installObserver() {
  const probe = { phases: [], boardStatuses: [], nextRouteButtonAttached: 0, results: 0 };
  window.__continuationProbe = probe;
  let phase;
  const buttons = new WeakSet();
  const scan = () => {
    const entry = document.querySelector("[data-entry-phase]");
    const nextPhase = entry ? entry.getAttribute("data-entry-phase") : null;
    if (nextPhase !== phase) probe.phases.push((phase = nextPhase));
    const status = document.querySelector("canvas.route-babylon-board")?.getAttribute("data-status");
    if (status && probe.boardStatuses.at(-1) !== status) probe.boardStatuses.push(status);
    for (const button of document.querySelectorAll(".rsg-next-route-btn")) {
      if (!buttons.has(button)) {
        buttons.add(button);
        probe.nextRouteButtonAttached += 1;
      }
    }
  };
  new MutationObserver(scan).observe(document, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["data-entry-phase", "data-status", "class"],
  });
}

// --- driving the app ---------------------------------------------------------------------------

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--use-gl=angle", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
});

async function openSession(name) {
  const context = await browser.newContext({ viewport: { width: VIEW_W, height: VIEW_H }, deviceScaleFactor: 1 });
  await context.addInitScript(installObserver);
  const page = await context.newPage();
  const session = { name, page, context, step: "start", chunks: [], console: [], pageErrors: [], glb: { hold: false, held: [] } };
  page.on("request", (request) => {
    const chunk = chunkOf(request.url());
    if (chunk) session.chunks.push({ chunk, step: session.step });
  });
  page.on("console", (message) => {
    if (message.type() === "error") session.console.push({ text: message.text().slice(0, 240), step: session.step });
  });
  page.on("pageerror", (error) => session.pageErrors.push({ text: String(error).slice(0, 240), step: session.step }));
  await page.route(
    (url) => url.pathname.endsWith("/models/route/board.glb"),
    async (route) => {
      if (!session.glb.hold) return route.continue();
      await new Promise((resolve) => session.glb.held.push(resolve));
      return route.continue();
    },
  );
  return session;
}

const observed = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__continuationProbe)));
const storedResults = (page) =>
  page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "[]"), STORAGE_KEY);

async function home(session) {
  session.step = "home";
  await session.page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 180000 });
  await session.page.locator(".hj-stage").waitFor({ timeout: 180000 });
  await session.page.waitForTimeout(1800);
}

/** The entry has finished (overlay gone) or failed, counting only phases after `from`. */
async function entryOutcome(session, { from = 0, timeout = 120000 } = {}) {
  const handle = await session.page.waitForFunction(
    ({ from }) => {
      const phases = window.__continuationProbe.phases.slice(from);
      if (phases.includes("error")) return "error";
      const entered = phases.includes("revealing") || phases.includes("complete");
      return entered && !document.querySelector("[data-entry-phase]") ? "complete" : null;
    },
    { from },
    { timeout, polling: 100 },
  );
  return handle.jsonValue();
}

async function enterFromHome(session, worldName) {
  const { page } = session;
  await page.locator(`.hj-gallery-pip[aria-label="Selecionar ${worldName}"]`).click({ force: true });
  await page.mouse.move(14, 14);
  await page.waitForTimeout(700);
  session.step = `enter ${worldName}`;
  const from = (await observed(page)).phases.length;
  await page.locator('.hj-world-object[aria-current="true"] .hj-world-enter').click({ force: true });
  return entryOutcome(session, { from });
}

/** What the screen says right after an entry, before anything is pressed. */
async function arrival(session) {
  const { page } = session;
  return page.evaluate((titles) => {
    const pressed = [...document.querySelectorAll(".rsg-difficulty-btn")].find(
      (button) => button.getAttribute("aria-pressed") === "true",
    );
    const mode = pressed ? Object.keys(titles).find((key) => pressed.textContent.includes(titles[key])) ?? null : null;
    return {
      introShown: Boolean(document.querySelector(".wentry-intro-layer .pgi-cta")),
      introLayer: Boolean(document.querySelector(".wentry-intro-layer")),
      focusTarget: Boolean(document.querySelector('[data-world-entry-focus="true"]')),
      // "Rota 2: Rota em construção" on the setup screen: the Route the session opened on.
      route: Number(/^Rota (\d+):/.exec(document.querySelector(".rsg-current-objective strong")?.textContent ?? "")?.[1]) || null,
      mode,
    };
  }, MODE_TITLE);
}

async function startFromIntro(session, shell) {
  const { page } = session;
  await page.locator(".wentry-intro-layer .pgi-cta").waitFor({ state: "visible", timeout: 60000 });
  await page.waitForTimeout(300);
  await page.locator(".wentry-intro-layer .pgi-cta").click();
  await page.locator(shell).waitFor({ state: "visible", timeout: 60000 });
}

const boardReady = (session) =>
  session.page.locator('.route-babylon-wrap[data-visual-state="ready"]').waitFor({ timeout: 90000 });

// --- playing a Route from what the board publishes -----------------------------------------------

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
 * To win: lights, then the portal, around the Hunter's reach when there is a way
 * around. To lose: straight at the Hunter. Until the result screen. A win that
 * has not come after `WIN_ATTEMPT_MOVES` (the detour can circle) turns into a
 * loss, so every Route ends: either end leads to Route N + 1.
 */
const WIN_ATTEMPT_MOVES = 60;
async function playRoute(session, budget = 160) {
  const { page } = session;
  session.step = "play";
  let moves = 0;
  for (let guard = 0; guard < budget; guard += 1) {
    if (await page.locator(".prm-card").count()) return { moves, reached: "result" };
    const reward = page.locator(
      `.rsg-reward-btn[aria-label^="Escolher ${PLAY === "lose" || moves >= WIN_ATTEMPT_MOVES ? "Picareta" : "Segunda Chance"}"]`,
    );
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
    if (PLAY === "lose" || moves >= WIN_ATTEMPT_MOVES) {
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

/** Home → Rota → pick the mode → play Route 1 to its result. */
async function routeOneToResult(session) {
  const { page } = session;
  await home(session);
  const homeChunks = session.chunks.map((entry) => entry.chunk);
  const gameCodeAtHome = Object.fromEntries(
    Object.entries(GAME_MARKERS).map(([name, marker]) => [
      name,
      homeChunks.filter((chunk) => chunkText.get(chunk)?.includes(marker)),
    ]),
  );
  const entered = await enterFromHome(session, "Rota Estratégica");
  const first = await arrival(session);
  await startFromIntro(session, ".rsg-shell");
  await boardReady(session);
  const setup = await arrival(session);
  session.step = "setup";
  await page.locator(`.rsg-difficulty-btn[aria-label^="Modo ${MODE_TITLE[MODE]}"]`).click();
  const picked = await arrival(session);
  await page.locator('button[aria-label="Iniciar rota com a dificuldade selecionada"]').click();
  const played = await playRoute(session);
  await page.locator(".prm-card").waitFor({ timeout: 30000 });
  session.step = "result";
  const result = await page.evaluate(() => ({
    title: document.querySelector("#reward-title")?.textContent ?? null,
    cta: document.querySelector(".prm-cta")?.textContent?.trim() ?? null,
    progress: document.querySelector(".prm-record-card strong")?.textContent ?? null,
  }));
  const [saved] = await storedResults(page);
  return {
    gameCodeAtHome,
    entered,
    firstEntry: { introShown: first.introShown },
    setup: { route: setup.route, mode: setup.mode },
    picked: picked.mode,
    played,
    result,
    saved: saved ? { gameId: saved.gameId, won: saved.details?.won, continuation: saved.continuation ?? null, nextRouteNumber: saved.details?.nextRouteNumber } : null,
  };
}

const expectedResultCopy = (won) =>
  won
    ? { title: "Caminho aberto", cta: "Explorar próxima rota" }
    : { title: "Rota registrada", cta: "Explorar outra rota" };

async function journey(session) {
  const { page } = session;
  const first = await routeOneToResult(session);
  const won = first.saved?.won === true;

  // "Explorar próxima rota" / "Explorar outra rota"
  session.step = "continue";
  const from = (await observed(page)).phases.length;
  await page.locator(".prm-cta").click();
  const continued = await entryOutcome(session, { from });
  await page.locator(".rsg-shell").waitFor({ state: "visible", timeout: 60000 });
  await boardReady(session);
  const next = await arrival(session);

  // Back to the worlds, and into the Rota again from Home.
  session.step = "back";
  await page.locator(".rsg-back").click();
  await page.locator(".hj-stage").waitFor({ state: "visible", timeout: 60000 });
  await page.waitForTimeout(800);
  const again = await enterFromHome(session, "Rota Estratégica");
  const againIntro = (await arrival(session)).introShown;
  await startFromIntro(session, ".rsg-shell");
  await boardReady(session);
  const fresh = await arrival(session);

  // Back, and into the Circuito.
  session.step = "circuito";
  await page.locator(".rsg-back").click();
  await page.locator(".hj-stage").waitFor({ state: "visible", timeout: 60000 });
  await page.waitForTimeout(800);
  const circuitEntered = await enterFromHome(session, "Circuito de Memória");
  const circuitIntro = (await arrival(session)).introShown;
  await startFromIntro(session, ".mfg-shell");
  await page.waitForTimeout(1200);
  await screenshot(session, "circuito");

  const end = await observed(page);
  const actual = {
    gameCodeAtHome: first.gameCodeAtHome,
    firstEntry: { entered: first.entered, introShown: first.firstEntry.introShown, ...first.setup },
    picked: first.picked,
    played: first.played.reached,
    resultCopy: { title: first.result.title, cta: first.result.cta },
    savedContinuation: first.saved?.continuation ?? null,
    savedNextRouteNumber: first.saved?.nextRouteNumber ?? null,
    continuation: { entered: continued, ...next },
    freshAgain: { entered: again, introShown: againIntro, route: fresh.route, mode: fresh.mode },
    circuito: { entered: circuitEntered, introShown: circuitIntro },
    nextRouteButtonAttached: end.nextRouteButtonAttached,
    finishedStatusOnBoard: end.boardStatuses.filter((status) => status === "won" || status === "lost"),
    pageErrors: session.pageErrors,
    consoleErrors: session.console,
  };
  const expected = {
    gameCodeAtHome: Object.fromEntries(Object.keys(GAME_MARKERS).map((name) => [name, []])),
    firstEntry: { entered: "complete", introShown: true, route: 1, mode: "easy" },
    picked: MODE,
    played: "result",
    resultCopy: expectedResultCopy(won),
    savedContinuation: { kind: "escape-maze-route", routeNumber: 2, difficulty: MODE },
    savedNextRouteNumber: 2,
    continuation: { entered: "complete", introShown: false, introLayer: false, focusTarget: true, route: 2, mode: MODE },
    freshAgain: { entered: "complete", introShown: true, route: 1, mode: "easy" },
    circuito: { entered: "complete", introShown: true },
    nextRouteButtonAttached: 0,
    finishedStatusOnBoard: [],
    pageErrors: [],
    consoleErrors: [],
  };
  return { actual, expected, outcome: won ? "won" : "lost", moves: first.played.moves };
}

async function retry(session) {
  const { page } = session;
  const first = await routeOneToResult(session);
  // The continuation's entry is held: its board.glb never answers until released.
  session.glb.hold = true;
  session.step = "continue-held";
  const enteredAt = Date.now();
  let from = (await observed(page)).phases.length;
  await page.locator(".prm-cta").click();
  const outcome = await entryOutcome(session, { from, timeout: WATCHDOG_MS + 60000 });
  const panelAfterMs = Date.now() - enteredAt;
  const heldAtPanel = session.glb.held.length;
  session.step = "retry";
  from = (await observed(page)).phases.length;
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await page.waitForTimeout(1000);
  session.glb.hold = false;
  for (const resolve of session.glb.held.splice(0)) resolve();
  const retried = await entryOutcome(session, { from });
  await page.locator(".rsg-shell").waitFor({ state: "visible", timeout: 60000 });
  await boardReady(session);
  const landed = await arrival(session);
  await screenshot(session, "retried");
  const saved = await storedResults(page);
  const end = await observed(page);
  const actual = {
    played: first.played.reached,
    savedContinuation: first.saved?.continuation ?? null,
    heldEntry: { outcome, byWatchdog: panelAfterMs >= WATCHDOG_MS, boardGlbHeld: heldAtPanel >= 1 },
    retried: { entered: retried, ...landed },
    resultsSaved: saved.length,
    nextRouteButtonAttached: end.nextRouteButtonAttached,
    pageErrors: session.pageErrors,
  };
  const expected = {
    played: "result",
    savedContinuation: { kind: "escape-maze-route", routeNumber: 2, difficulty: MODE },
    heldEntry: { outcome: "error", byWatchdog: true, boardGlbHeld: true },
    retried: { entered: "complete", introShown: false, introLayer: false, focusTarget: true, route: 2, mode: MODE },
    resultsSaved: 1,
    nextRouteButtonAttached: 0,
    pageErrors: [],
  };
  return { actual, expected, outcome: first.saved?.won ? "won" : "lost" };
}

async function screenshot(session, id) {
  if (OUT) await session.page.screenshot({ path: path.join(OUT, `${session.name}-${id}.png`) });
}

// --- run ----------------------------------------------------------------------------------------

if (OUT) fs.mkdirSync(OUT, { recursive: true });
const canonical = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v,
  );
const RUNNERS = { journey, retry };
const results = [];
for (const name of ONLY) {
  const session = await openSession(name);
  let result;
  try {
    result = await RUNNERS[name](session);
    result.pass = canonical(result.actual) === canonical(result.expected);
  } catch (error) {
    await screenshot(session, "exception").catch(() => {});
    result = {
      pass: false,
      exception: String(error?.message ?? error).split("\n")[0],
      step: session.step,
      observed: await observed(session.page).catch(() => null),
      pageErrors: session.pageErrors,
      consoleErrors: session.console,
    };
  }
  await session.context.close();
  results.push({ scenario: name, mode: MODE, play: PLAY, ...result });
  log(`${result.pass ? "PASS" : "FAIL"}  ${name} (${MODE}${result.outcome ? `, Route 1 ${result.outcome}` : ""})`);
  console.log(`        ${JSON.stringify(result.actual ?? result)}`);
  if (!result.pass && result.expected) console.log(`        expected: ${JSON.stringify(result.expected)}`);
}
await browser.close();

if (OUT) {
  fs.writeFileSync(
    path.join(OUT, "continuation-probe.json"),
    JSON.stringify({ mission: "GAME-CONTINUATION-CONTRACT-01", base: BASE, results }, null, 2),
  );
}
const failing = results.filter((result) => !result.pass).map((result) => result.scenario);
console.log(`\n${results.length - failing.length}/${results.length} passed · failing: ${failing.join(", ") || "none"}`);
console.log(failing.length ? "GAME_CONTINUATION_PROBE_FAILED" : "GAME_CONTINUATION_PROBE_OK");
process.exitCode = failing.length ? EXIT_FAILED : EXIT_OK;
