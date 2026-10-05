/**
 * ROUTE-BOARD-CHUNK-ERROR-01 — browser probe: when the Rota's board chunk
 * cannot be fetched, the entry takes its own onEntryError -> retry path instead
 * of the page's ("This page couldn’t load"), and the retry fetches it again.
 *
 * `RouteStrategyGame` loads `RouteBabylonBoard` as a chunk of its own, after it
 * mounts; Babylon itself is only fetched once the board mounts. This probe runs
 * the real production build from the Home and controls exactly one request: the
 * chunk that holds RouteBabylonBoard, found in the build by content (its
 * `route-babylon-wrap` class is rendered by that component only).
 *
 *   normal               nothing blocked: the board loads, the entry reports
 *                        ready once, the board reaches `ready`, no console error.
 *   failure-retry        the board chunk fails: the entry error panel appears
 *                        (onEntryError got the ChunkLoadError), the page does
 *                        not fall over; then the chunk is let through, "Tentar
 *                        novamente" fetches it again and the Rota opens.
 *   leave-fails          the chunk is held, the watchdog opens the error panel,
 *   leave-arrives        the Explorador goes back to the worlds, and only then
 *                        does the chunk fail / arrive: nothing may react to it.
 *   retry-while-pending  held, watchdog, "Tentar novamente" while the first load
 *                        is still in flight; then it arrives: one board, ready.
 *
 * What counts as "onEntryError received the error": the page's onEntryError is
 * the world-entry controller's `fail`, which logs `[MindFlow] World entry
 * preparation failed.` with the error it received. The probe reads that error
 * object from the console call (name and message) and requires a
 * `ChunkLoadError` naming the board chunk. The watchdog fails an entry without
 * going through onEntryError, so it leaves no such log: that is how the `leave`
 * and `retry-while-pending` scenarios tell it apart.
 *
 * Read-only by construction: the product is not instrumented. An init script
 * only observes the DOM (entry phase, board visual state, board canvases, the
 * page's error screen); network control is Playwright routing of one URL. It
 * writes nothing unless `--out DIR` is given (report + screenshots).
 *
 * Usage:
 *   next build && next start -p 3100
 *   node tools/validation/route-board-chunk-browser-probe.mjs [--base URL]
 *        [--build DIR] [--out DIR] [--scenario NAME[,NAME...]] [--viewport WxH]
 *
 *   --build DIR  the `.next` directory of the build the server is serving
 *                (default `.next`); the probe checks that the server really
 *                serves that file before trusting it.
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
const SCENARIOS = ["normal", "failure-retry", "leave-fails", "leave-arrives", "retry-while-pending"];
const ONLY = arg("--scenario", SCENARIOS.join(",")).split(",");
if (ONLY.some((name) => !SCENARIOS.includes(name))) {
  console.error(`unknown scenario; expected some of ${SCENARIOS.join(", ")}`);
  process.exit(EXIT_USAGE);
}
/**
 * Small on purpose: under software WebGL the board's first load (Babylon, GLBs,
 * shaders) competes with the render loop for one CPU, and a large canvas pushes
 * it toward the 28 s entry watchdog — which would fail an entry for a reason
 * that is not under test.
 */
const [VIEW_W, VIEW_H] = arg("--viewport", "800x500").split("x").map(Number);
const VIEW = { width: VIEW_W, height: VIEW_H };
const WATCHDOG_MS = 28_000;
const LOADING_MARKUP = '<div class="rsg-canvas-loading">Preparando o tabuleiro Babylon…</div>';
const ENTRY_FAILED_LOG = "[MindFlow] World entry preparation failed.";
const log = (...a) => console.log("[board-chunk]", ...a);

// --- the build's chunks -------------------------------------------------------------

const chunkDir = path.join(BUILD, "static", "chunks");
if (!fs.existsSync(chunkDir)) {
  console.error(`no build at ${BUILD} (expected ${chunkDir})`);
  process.exit(EXIT_USAGE);
}
const chunkFiles = fs.readdirSync(chunkDir).filter((file) => file.endsWith(".js"));
const chunkText = new Map(chunkFiles.map((file) => [file, fs.readFileSync(path.join(chunkDir, file), "utf8")]));
const containing = (marker) => chunkFiles.filter((file) => chunkText.get(file).includes(marker));
const boardChunks = containing("route-babylon-wrap");
if (boardChunks.length !== 1) {
  console.error(`expected exactly one chunk holding RouteBabylonBoard, found ${JSON.stringify(boardChunks)}`);
  process.exit(EXIT_USAGE);
}
const BOARD_CHUNK = boardChunks[0];
/** Babylon core and the scene module: fetched only once the board has mounted. */
const BABYLON_CHUNKS = containing("ArcRotateCamera").filter((file) => file !== BOARD_CHUNK);
if (BABYLON_CHUNKS.length === 0) {
  console.error("no Babylon chunk found in the build");
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
  const served = await fetch(`${BASE}/_next/static/chunks/${BOARD_CHUNK}`).then(
    (response) => (response.ok ? response.text() : null),
    () => null,
  );
  if (served !== chunkText.get(BOARD_CHUNK)) {
    console.error(`${BASE} does not serve ${BUILD}'s ${BOARD_CHUNK}: start the server on this build`);
    process.exit(EXIT_USAGE);
  }
}
log(`board chunk ${BOARD_CHUNK} · Babylon chunks ${BABYLON_CHUNKS.join(", ")}`);

// --- in-page observer (observes, changes nothing) -----------------------------------------

function installObserver() {
  const probe = { phases: [], boardStates: [], timeline: [], boardCanvases: 0, pageCouldNotLoad: false };
  window.__boardChunkProbe = probe;
  const canvases = new WeakSet();
  let phase;
  let boardState;
  const scan = () => {
    const entry = document.querySelector("[data-entry-phase]");
    const nextPhase = entry ? entry.getAttribute("data-entry-phase") : null;
    const at = Math.round(performance.now());
    if (nextPhase !== phase) {
      probe.phases.push((phase = nextPhase));
      probe.timeline.push({ at, phase });
    }
    const wrap = document.querySelector(".route-babylon-wrap");
    const nextBoardState = wrap ? wrap.getAttribute("data-visual-state") : null;
    if (nextBoardState !== boardState) {
      probe.boardStates.push((boardState = nextBoardState));
      probe.timeline.push({ at, board: boardState });
    }
    for (const canvas of document.querySelectorAll("canvas.route-babylon-board")) {
      if (!canvases.has(canvas)) {
        canvases.add(canvas);
        probe.boardCanvases += 1;
      }
    }
    if (!probe.pageCouldNotLoad && /This page couldn.t load/.test(document.body?.textContent ?? "")) {
      probe.pageCouldNotLoad = true;
    }
  };
  new MutationObserver(scan).observe(document, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: ["data-entry-phase", "data-visual-state"],
  });
}

// --- one isolated browser context per scenario ---------------------------------------------

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--use-gl=angle", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
});

async function openSession(name) {
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 1 });
  await context.addInitScript(installObserver);
  const page = await context.newPage();
  const session = {
    name,
    page,
    context,
    step: "start",
    requests: [],
    console: [],
    pageErrors: [],
    pendingConsole: [],
    gate: { mode: "pass", held: [] },
  };
  page.on("request", (request) => {
    const chunk = chunkOf(request.url());
    if (chunk === BOARD_CHUNK || BABYLON_CHUNKS.includes(chunk)) {
      session.requests.push({ chunk, kind: chunk === BOARD_CHUNK ? "board" : "babylon", step: session.step });
    }
  });
  page.on("console", (message) => {
    const entry = {
      type: message.type(),
      text: message.text().slice(0, 240),
      url: message.location()?.url ?? "",
      step: session.step,
    };
    session.console.push(entry);
    if (message.text().startsWith(ENTRY_FAILED_LOG)) {
      const arg = message.args()[1];
      session.pendingConsole.push(
        (arg
          ? arg.evaluate((error) => ({ name: error?.name ?? null, message: String(error?.message ?? error) }))
          : Promise.resolve(null)
        ).then(
          (error) => {
            entry.error = error;
          },
          () => {
            entry.error = null;
          },
        ),
      );
    }
  });
  page.on("pageerror", (error) => session.pageErrors.push({ text: String(error).slice(0, 240), step: session.step }));
  // The only routed URL: the board chunk. `pass` lets it through, `fail` aborts it,
  // `hold` keeps it waiting until `release`.
  await page.route(
    (url) => chunkOf(url.href) === BOARD_CHUNK,
    async (route) => {
      const { gate } = session;
      if (gate.mode === "fail") return route.abort("failed");
      if (gate.mode === "hold") {
        const outcome = await new Promise((resolve) => gate.held.push(resolve));
        return outcome === "fail" ? route.abort("failed") : route.continue();
      }
      return route.continue();
    },
  );
  return session;
}

const setGate = (session, mode) => {
  session.gate.mode = mode;
};
/** Let every held request go one way; later ones follow the same rule. */
const release = (session, outcome) => {
  session.gate.mode = outcome === "fail" ? "fail" : "pass";
  for (const resolve of session.gate.held.splice(0)) resolve(outcome);
};

const observed = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__boardChunkProbe)));

async function enterRouteFromHome(session) {
  const { page } = session;
  session.step = "home";
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.locator(".hj-stage").waitFor({ timeout: 180000 });
  await page.waitForTimeout(1800);
  await page.locator('.hj-gallery-pip[aria-label="Selecionar Rota Estratégica"]').click({ force: true });
  await page.mouse.move(14, 14);
  await page.waitForTimeout(700);
  session.step = "enter";
  session.enteredAt = Date.now();
  await page.locator('.hj-world-object[aria-current="true"] .hj-world-enter').click({ force: true });
}

/** Resolves with the first phase among `wanted` the entry reaches after `from` observed phases. */
async function waitForPhase(session, wanted, { from = 0, timeout = 120000 } = {}) {
  const handle = await session.page.waitForFunction(
    ({ wanted, from }) => {
      const probe = window.__boardChunkProbe;
      const hit = probe.phases.slice(from).find((phase) => wanted.includes(phase));
      if (hit !== undefined) return { phase: hit };
      if (probe.pageCouldNotLoad) return { phase: "page-could-not-load" };
      return null;
    },
    { wanted, from },
    { timeout, polling: 100 },
  );
  return (await handle.jsonValue()).phase;
}

/** The entry has finished (overlay gone) or failed. */
async function waitForEntryOutcome(session, { from = 0, timeout = 120000 } = {}) {
  const handle = await session.page.waitForFunction(
    ({ from }) => {
      const probe = window.__boardChunkProbe;
      const phases = probe.phases.slice(from);
      if (probe.pageCouldNotLoad) return "page-could-not-load";
      if (phases.includes("error")) return "error";
      const entered = phases.includes("revealing") || phases.includes("complete");
      return entered && !document.querySelector("[data-entry-phase]") ? "complete" : null;
    },
    { from },
    { timeout, polling: 100 },
  );
  return handle.jsonValue();
}

async function startRouteAndWaitForBoard(session) {
  const { page } = session;
  session.step = "start-route";
  await page.locator(".pgi-cta").waitFor({ state: "visible", timeout: 60000 });
  await page.waitForTimeout(300);
  await page.locator(".pgi-cta").click();
  await page.locator(".rsg-shell").waitFor({ state: "visible", timeout: 60000 });
  await page.locator('.route-babylon-wrap[data-visual-state="ready"]').waitFor({ timeout: 60000 });
  await page.waitForTimeout(800);
}

const count = (list, value) => list.filter((item) => item === value).length;
const entryFailures = (session) => session.console.filter((entry) => entry.text.startsWith(ENTRY_FAILED_LOG));
/**
 * Console errors nobody planned for. A request this probe aborted makes the
 * browser log "Failed to load resource" for that chunk — the cause, not a symptom.
 */
const unexpectedConsoleErrors = (session, { allowEntryFailures = 0 } = {}) => {
  let entryFailuresLeft = allowEntryFailures;
  return session.console.filter((entry) => {
    if (entry.type !== "error") return false;
    if (chunkOf(entry.url) === BOARD_CHUNK && entry.text.startsWith("Failed to load resource")) return false;
    if (entry.text.startsWith(ENTRY_FAILED_LOG) && entryFailuresLeft > 0) {
      entryFailuresLeft -= 1;
      return false;
    }
    return true;
  });
};
const boardRequests = (session, steps) =>
  session.requests.filter((request) => request.kind === "board" && (!steps || steps.includes(request.step))).length;
const babylonRequests = (session, steps) =>
  session.requests.filter((request) => request.kind === "babylon" && (!steps || steps.includes(request.step))).length;
const readsAsChunkFailure = (error) =>
  error?.name === "ChunkLoadError" && typeof error.message === "string" && error.message.includes(BOARD_CHUNK);
/**
 * The watchdog fails the entry by dispatching, not through onEntryError: it
 * leaves no `fail` log. So "the watchdog opened the panel" reads as: error
 * phase, no onEntryError call, and at least the watchdog window since entering.
 */
const watchdogOpenedPanel = (session, outcome) =>
  outcome === "error" && entryFailures(session).length === 0 && Date.now() - session.enteredAt >= WATCHDOG_MS;

const canvasMarkup = (page) =>
  page.evaluate(() => document.querySelector(".rsg-canvas")?.innerHTML ?? null);

async function screenshot(session, id) {
  if (OUT) await session.page.screenshot({ path: path.join(OUT, `${session.name}-${id}.png`) });
}

// --- scenarios ------------------------------------------------------------------------------

async function normal(session) {
  await enterRouteFromHome(session);
  const outcome = await waitForEntryOutcome(session);
  const atEntry = await observed(session.page);
  if (outcome === "complete") await startRouteAndWaitForBoard(session);
  await screenshot(session, "board");
  const end = await observed(session.page);
  const actual = {
    outcome,
    readyTransitions: count(atEntry.phases, "ready"),
    errorTransitions: count(atEntry.phases, "error"),
    boardStates: end.boardStates,
    boardCanvases: end.boardCanvases,
    boardChunkRequests: boardRequests(session),
    babylonRequested: babylonRequests(session) > 0,
    entryFailures: entryFailures(session).length,
    consoleErrors: unexpectedConsoleErrors(session),
    pageErrors: session.pageErrors,
    pageCouldNotLoad: end.pageCouldNotLoad,
  };
  const expected = {
    outcome: "complete",
    readyTransitions: 1,
    errorTransitions: 0,
    boardStates: [null, "loading", "ready"],
    boardCanvases: 1,
    boardChunkRequests: 1,
    babylonRequested: true,
    entryFailures: 0,
    consoleErrors: [],
    pageErrors: [],
    pageCouldNotLoad: false,
  };
  return { actual, expected, timeline: end.timeline };
}

async function failureRetry(session) {
  setGate(session, "fail");
  await enterRouteFromHome(session);
  const outcome = await waitForEntryOutcome(session, { timeout: 90000 });
  const errorAfterMs = Date.now() - session.enteredAt;
  await Promise.all(session.pendingConsole.splice(0));
  await session.page.waitForTimeout(1500);
  await screenshot(session, "failure");
  const atFailure = await observed(session.page);
  const panel = session.page.locator('.wentry-error-panel[role="alert"]');
  const retryButton = session.page.getByRole("button", { name: "Tentar novamente" });
  const failure = {
    outcome,
    beforeWatchdog: errorAfterMs < WATCHDOG_MS,
    entryFailures: entryFailures(session).map((entry) => entry.error),
    receivedChunkError: entryFailures(session).length === 1 && readsAsChunkFailure(entryFailures(session)[0].error),
    retryPanel: (await panel.count()) === 1 && (await panel.textContent())?.includes("Este mundo precisa de mais um instante"),
    retryButtonVisible: await retryButton.isVisible(),
    pageCouldNotLoad: atFailure.pageCouldNotLoad,
    boardChunkRequested: boardRequests(session) >= 1,
    babylonRequests: babylonRequests(session),
    boardCanvases: atFailure.boardCanvases,
    canvasMarkup: await canvasMarkup(session.page),
    pageErrors: session.pageErrors.length,
  };
  const failureExpected = {
    outcome: "error",
    beforeWatchdog: true,
    entryFailures: failure.entryFailures.length === 1 ? failure.entryFailures : ["<one ChunkLoadError>"],
    receivedChunkError: true,
    retryPanel: true,
    retryButtonVisible: true,
    pageCouldNotLoad: false,
    boardChunkRequested: true,
    babylonRequests: 0,
    boardCanvases: 0,
    canvasMarkup: LOADING_MARKUP,
    pageErrors: 0,
  };

  const requestsDuringFailure = boardRequests(session);
  let retry = { attempted: false };
  if (failure.retryButtonVisible) {
    release(session, "pass");
    const from = atFailure.phases.length;
    session.step = "retry";
    await retryButton.click();
    const retryOutcome = await waitForEntryOutcome(session, { from, timeout: 120000 });
    const afterRetry = (await observed(session.page)).phases.slice(from);
    if (retryOutcome === "complete") await startRouteAndWaitForBoard(session);
    await Promise.all(session.pendingConsole.splice(0));
    await screenshot(session, "recovered");
    const end = await observed(session.page);
    retry = {
      attempted: true,
      outcome: retryOutcome,
      boardChunkRequestedAgain: boardRequests(session, ["retry", "start-route"]) >= 1,
      readyTransitions: count(afterRetry, "ready"),
      errorTransitions: count(afterRetry, "error"),
      boardReady: end.boardStates.at(-1) === "ready",
      boardCanvases: end.boardCanvases,
      babylonRequested: babylonRequests(session) > 0,
      newEntryFailures: entryFailures(session).length - 1,
      consoleErrors: unexpectedConsoleErrors(session, { allowEntryFailures: 1 }),
      pageErrors: session.pageErrors.length,
      pageCouldNotLoad: end.pageCouldNotLoad,
    };
  }
  const retryExpected = {
    attempted: true,
    outcome: "complete",
    boardChunkRequestedAgain: true,
    readyTransitions: 1,
    errorTransitions: 0,
    boardReady: true,
    boardCanvases: 1,
    babylonRequested: true,
    newEntryFailures: 0,
    consoleErrors: [],
    pageErrors: 0,
    pageCouldNotLoad: false,
  };
  return {
    actual: { failure, retry },
    expected: { failure: failureExpected, retry: retryExpected },
    boardChunkRequests: { duringFailure: requestsDuringFailure, total: boardRequests(session) },
    timeline: (await observed(session.page)).timeline,
  };
}

/** Held until the watchdog opens the error panel, then the Explorador goes back to the worlds. */
async function leave(session, lateOutcome) {
  setGate(session, "hold");
  await enterRouteFromHome(session);
  await waitForPhase(session, ["preparing", "error"]);
  await session.page.locator(".rsg-canvas").waitFor({ state: "attached", timeout: 60000 });
  // ROUTE-C7C: the first board comes from a Web Worker, so its pending screen (which also draws in `.rsg-canvas`) lasts
  // a Worker start-up longer than C7B's local generation did. The board's own loading text exists only once that board
  // has arrived: read the canvas then, not at the first frame it is attached.
  await session.page.waitForFunction(() => !document.querySelector('[data-route-generation="pending"]'), null, { timeout: 60000 });
  const loadingMarkup = await canvasMarkup(session.page);
  const outcome = await waitForEntryOutcome(session, { timeout: WATCHDOG_MS + 60000 });
  await Promise.all(session.pendingConsole.splice(0));
  const watchdogFired = watchdogOpenedPanel(session, outcome);
  session.step = "back";
  await session.page.getByRole("button", { name: "Voltar aos mundos" }).click();
  await session.page.locator(".hj-stage").waitFor({ state: "visible", timeout: 60000 });
  await session.page.waitForTimeout(600);
  const atHome = await observed(session.page);
  session.step = `late-${lateOutcome}`;
  const heldWhenLeaving = session.gate.held.length;
  release(session, lateOutcome);
  await session.page.waitForTimeout(4000);
  await Promise.all(session.pendingConsole.splice(0));
  await screenshot(session, "home-after-late-chunk");
  const end = await observed(session.page);
  const actual = {
    loadingMarkup,
    outcome,
    watchdogFired,
    heldWhenLeaving: heldWhenLeaving >= 1,
    phasesAfterLeaving: end.phases.slice(atHome.phases.length),
    entryVisibleAfterLeaving: end.phases.at(-1) !== null,
    entryFailures: entryFailures(session).length,
    babylonRequests: babylonRequests(session),
    boardCanvases: end.boardCanvases,
    consoleErrors: unexpectedConsoleErrors(session),
    pageErrors: session.pageErrors,
    pageCouldNotLoad: end.pageCouldNotLoad,
  };
  const expected = {
    loadingMarkup: LOADING_MARKUP,
    outcome: "error",
    watchdogFired: true,
    heldWhenLeaving: true,
    phasesAfterLeaving: [],
    entryVisibleAfterLeaving: false,
    entryFailures: 0,
    babylonRequests: 0,
    boardCanvases: 0,
    consoleErrors: [],
    pageErrors: [],
    pageCouldNotLoad: false,
  };
  return { actual, expected, boardChunkRequests: boardRequests(session), timeline: end.timeline };
}

async function retryWhilePending(session) {
  setGate(session, "hold");
  await enterRouteFromHome(session);
  const outcome = await waitForEntryOutcome(session, { timeout: WATCHDOG_MS + 60000 });
  await Promise.all(session.pendingConsole.splice(0));
  const watchdogFired = watchdogOpenedPanel(session, outcome);
  const from = (await observed(session.page)).phases.length;
  session.step = "retry";
  await session.page.getByRole("button", { name: "Tentar novamente" }).click();
  await session.page.waitForTimeout(1000);
  // The first session is gone, the second is waiting on the same chunk: now it arrives.
  session.step = "arrives";
  release(session, "pass");
  const retryOutcome = await waitForEntryOutcome(session, { from, timeout: 120000 });
  const afterRetry = (await observed(session.page)).phases.slice(from);
  if (retryOutcome === "complete") await startRouteAndWaitForBoard(session);
  await Promise.all(session.pendingConsole.splice(0));
  await screenshot(session, "board");
  const end = await observed(session.page);
  const actual = {
    outcome,
    watchdogFired,
    retryOutcome,
    readyTransitions: count(afterRetry, "ready"),
    errorTransitions: count(afterRetry, "error"),
    boardReady: end.boardStates.at(-1) === "ready",
    boardCanvases: end.boardCanvases,
    babylonRequested: babylonRequests(session) > 0,
    entryFailures: entryFailures(session).length,
    consoleErrors: unexpectedConsoleErrors(session),
    pageErrors: session.pageErrors,
    pageCouldNotLoad: end.pageCouldNotLoad,
  };
  const expected = {
    outcome: "error",
    watchdogFired: true,
    retryOutcome: "complete",
    readyTransitions: 1,
    errorTransitions: 0,
    boardReady: true,
    boardCanvases: 1,
    babylonRequested: true,
    entryFailures: 0,
    consoleErrors: [],
    pageErrors: [],
    pageCouldNotLoad: false,
  };
  return { actual, expected, boardChunkRequests: boardRequests(session), timeline: end.timeline };
}

const RUNNERS = {
  normal,
  "failure-retry": failureRetry,
  "leave-fails": (session) => leave(session, "fail"),
  "leave-arrives": (session) => leave(session, "pass"),
  "retry-while-pending": retryWhilePending,
};

// --- run ---------------------------------------------------------------------------------------

if (OUT) fs.mkdirSync(OUT, { recursive: true });
const canonical = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v,
  );
const results = [];
for (const name of ONLY) {
  const session = await openSession(name);
  let result;
  try {
    result = await RUNNERS[name](session);
    result.pass = canonical(result.actual) === canonical(result.expected);
  } catch (error) {
    await screenshot(session, "exception").catch(() => {});
    const probe = await observed(session.page).catch(() => null);
    result = {
      pass: false,
      exception: String(error?.message ?? error).split("\n")[0],
      observed: probe,
      boardChunkRequests: boardRequests(session),
      consoleErrors: unexpectedConsoleErrors(session),
      pageErrors: session.pageErrors,
    };
  }
  await session.context.close();
  results.push({ scenario: name, ...result });
  console.log(`${result.pass ? "PASS" : "FAIL"}  ${name}`);
  console.log(`        ${JSON.stringify(result.actual ?? result)}`);
  if (!result.pass && result.expected) console.log(`        expected: ${JSON.stringify(result.expected)}`);
}
await browser.close();

const report = {
  mission: "ROUTE-BOARD-CHUNK-ERROR-01",
  base: BASE,
  boardChunk: BOARD_CHUNK,
  babylonChunks: BABYLON_CHUNKS,
  results,
};
if (OUT) fs.writeFileSync(path.join(OUT, "board-chunk-probe.json"), JSON.stringify(report, null, 2));
const failing = results.filter((result) => !result.pass).map((result) => result.scenario);
console.log(`\n${results.length - failing.length}/${results.length} passed · failing: ${failing.join(", ") || "none"}`);
console.log(failing.length ? "ROUTE_BOARD_CHUNK_PROBE_FAILED" : "ROUTE_BOARD_CHUNK_PROBE_OK");
process.exitCode = failing.length ? EXIT_FAILED : EXIT_OK;
