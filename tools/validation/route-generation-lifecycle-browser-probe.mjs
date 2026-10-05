/**
 * ROUTE-C7B — browser probe: the Rota's board generation, asynchronous, in the real production build.
 *
 * Boards are asked for and arrive on a later task (route-generation-client.ts, local executor). This probe drives the
 * product from the Home and watches, through a MutationObserver installed before any page script runs, every state
 * the Explorador can see: the entry phase, the Rota's generation screen (`data-route-generation`), the objective
 * message, whether Start and the moves are disabled, the board's visual state — each stamped with the number of
 * animation frames the page had run so far (a frame between "pending" and the board is a paint opportunity).
 *
 *   entry            Home → Rota: the first board pending (no board, the calm message), then the Rota.
 *   start            setup → "Iniciar rota": pending (Start disabled, the message), then playing.
 *   restart          playing → Detalhes → "Começar outra rota": pending (moves disabled), then playing again.
 *   double-restart   two Restarts in one task: one pending, one new board, playing, turn 0.
 *   rapid-mode       Aberto → Equilibrado → Desafiador in one task: setup on Desafiador only.
 *   exit-pending     a Restart and "Voltar à jornada" in one task: back to the worlds, nothing reacts later.
 *   error-retry      the generation forced to fail — since ROUTE-C7C the next generation Worker fails to construct
 *                    (as under a CSP block); on a C7B tree, Math.random throws inside the local executor's one task.
 *                    The probe's own doing, the product has no test hook: the calm error and its retry; retry:
 *                    playing.
 *
 * Read-only: nothing in the product is instrumented. Writes nothing unless `--out DIR` (report + screenshots).
 *
 * Usage:
 *   next build && next start -p 3100
 *   node tools/validation/route-generation-lifecycle-browser-probe.mjs [--base URL] [--out DIR] [--viewport WxH]
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
const BASE = arg("--base", "http://localhost:3100");
const OUT = arg("--out", null);
const [VIEW_W, VIEW_H] = arg("--viewport", "800x500").split("x").map(Number);
const PENDING = "Preparando a rota…";
const FAILED = "Não foi possível preparar esta rota.";
const log = (...a) => console.log("[generation-lifecycle]", ...a);
if (OUT) fs.mkdirSync(OUT, { recursive: true });

function installObserver() {
  const probe = { frames: 0, events: [], last: "" };
  window.__c7b = probe;
  const tick = () => {
    probe.frames += 1;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  const scan = () => {
    const entry = document.querySelector("[data-entry-phase]")?.getAttribute("data-entry-phase") ?? null;
    const shell = document.querySelector(".rsg-shell");
    const generation = shell?.getAttribute("data-route-generation") ?? (shell ? "board-view" : null);
    const message = document.querySelector(".rsg-objective-message")?.textContent ?? null;
    const start = document.querySelector('button[aria-label="Iniciar rota com a dificuldade selecionada"]');
    const move = document.querySelector('button[aria-label="Mover Cima"]');
    const pressed = document.querySelector(".rsg-difficulty-btn[aria-pressed='true'] strong")?.textContent ?? null;
    const board = document.querySelector(".route-babylon-wrap")?.getAttribute("data-visual-state") ?? null;
    const retry = Boolean(document.querySelector('button[aria-label="Tentar preparar a rota novamente"]'));
    const turns = [...document.querySelectorAll(".rsg-stat")].find((el) => el.textContent.includes("Turnos"))?.querySelector("strong")?.textContent ?? null;
    const state = {
      entry,
      generation,
      message,
      startDisabled: start ? start.disabled : null,
      moveDisabled: move ? move.disabled : null,
      pressed,
      board,
      retry,
      turns,
    };
    const key = JSON.stringify(state);
    if (key !== probe.last) {
      probe.last = key;
      probe.events.push({ at: Math.round(performance.now()), frame: probe.frames, ...state });
    }
  };
  new MutationObserver(scan).observe(document, { subtree: true, childList: true, characterData: true, attributes: true });
}

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--use-gl=angle", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
});

async function open(name) {
  const context = await browser.newContext({ viewport: { width: VIEW_W, height: VIEW_H }, deviceScaleFactor: 1 });
  await context.addInitScript(installObserver);
  const page = await context.newPage();
  const session = { name, page, context, console: [], pageErrors: [] };
  page.on("console", (m) => session.console.push({ type: m.type(), text: m.text().slice(0, 240) }));
  page.on("pageerror", (e) => session.pageErrors.push(String(e).slice(0, 240)));
  return session;
}
const events = (page) => page.evaluate(() => window.__c7b.events.slice());
const mark = (page) => page.evaluate(() => window.__c7b.events.length);
const since = async (page, from) => (await events(page)).slice(from);

async function enterRoute(session) {
  const { page } = session;
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.locator(".hj-stage").waitFor({ timeout: 180000 });
  await page.waitForTimeout(1800);
  await page.locator('.hj-gallery-pip[aria-label="Selecionar Rota Estratégica"]').click({ force: true });
  await page.mouse.move(14, 14);
  await page.waitForTimeout(700);
  await page.locator('.hj-world-object[aria-current="true"] .hj-world-enter').click({ force: true });
  await page.locator(".pgi-cta").waitFor({ state: "visible", timeout: 90000 });
  await page.waitForTimeout(300);
  await page.locator(".pgi-cta").click();
  await page.locator('.route-babylon-wrap[data-visual-state="ready"]').waitFor({ timeout: 90000 });
  await page.waitForFunction(() => !document.querySelector("[data-entry-phase]"), null, { timeout: 90000 });
  await page.waitForTimeout(500);
}
const startRoute = async (page) => {
  await page.locator('button[aria-label="Iniciar rota com a dificuldade selecionada"]').click();
  await page.waitForFunction(() => document.querySelector('button[aria-label="Mover Cima"]'), null, { timeout: 30000 });
  await page.waitForTimeout(400);
};
const settled = (page) =>
  page.waitForFunction(() => {
    const e = window.__c7b.events.at(-1);
    return e && e.generation === "board-view" && e.message !== "Preparando a rota…";
  }, null, { timeout: 30000 });
/** Click every button matching `selectors`, in order, within ONE task of the page. */
const clickInOneTask = (page, selectors) =>
  page.evaluate((list) => {
    for (const selector of list) document.querySelector(selector)?.click();
  }, selectors);

const results = [];
const record = (name, pass, detail) => {
  results.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} ${name}`, JSON.stringify(detail).slice(0, 900));
};
const pendingFrames = (list) => {
  const first = list.findIndex((e) => e.message === PENDING);
  const done = list.findIndex((e, i) => i > first && e.message !== PENDING && e.generation === "board-view");
  return first < 0 ? null : { pendingAt: list[first].at, readyAt: done < 0 ? null : list[done].at, framesBetween: done < 0 ? null : list[done].frame - list[first].frame };
};
const consoleErrors = (s, allow = () => false) => s.console.filter((c) => c.type === "error" && !allow(c.text));

const session = await open("journey");
try {
  // entry
  {
    await enterRoute(session);
    const list = await events(session.page);
    const firstPending = list.find((e) => e.generation === "pending");
    const boardAppeared = list.findIndex((e) => e.board !== null);
    const pendingIndex = list.findIndex((e) => e.generation === "pending");
    record("entry", Boolean(firstPending) && pendingIndex < boardAppeared && firstPending.board === null && firstPending.message === PENDING && session.pageErrors.length === 0, {
      firstPending,
      pendingBeforeBoard: pendingIndex >= 0 && pendingIndex < boardAppeared,
      finalSetup: list.at(-1),
    });
    if (OUT) await session.page.screenshot({ path: path.join(OUT, "entry-ready.png") });
  }
  // start
  {
    const from = await mark(session.page);
    await startRoute(session.page);
    await settled(session.page);
    const list = await since(session.page, from);
    const pending = list.filter((e) => e.message === PENDING);
    record("start", pending.length > 0 && pending.every((e) => e.startDisabled === true || e.startDisabled === null) && list.at(-1).moveDisabled === false, {
      pendingStates: pending.length,
      startDisabledWhilePending: pending.map((e) => e.startDisabled),
      timing: pendingFrames(list),
      final: list.at(-1),
    });
  }
  // restart
  {
    await session.page.locator('button[aria-label="Mover Cima"]').click();
    await session.page.waitForTimeout(400);
    await session.page.locator(".rsg-details-trigger").click();
    const from = await mark(session.page);
    await session.page.locator('button[aria-label="Começar outra rota"]').click();
    await settled(session.page);
    await session.page.locator(".rsg-details-close").click();
    await session.page.waitForTimeout(300);
    const list = await since(session.page, from);
    const pending = list.filter((e) => e.message === PENDING);
    record("restart", pending.length > 0 && (await events(session.page)).at(-1).moveDisabled === false, {
      pendingStates: pending.length,
      timing: pendingFrames(list),
      final: (await events(session.page)).at(-1),
    });
  }
  // double restart, one task
  {
    await session.page.locator(".rsg-details-trigger").click();
    const from = await mark(session.page);
    await session.page.evaluate(() => {
      const b = document.querySelector('button[aria-label="Começar outra rota"]');
      b.click();
      b.click();
    });
    await settled(session.page);
    await session.page.locator(".rsg-details-close").click();
    await session.page.waitForTimeout(300);
    const list = await since(session.page, from);
    const pendingRuns = list.reduce((n, e, i) => n + (e.message === PENDING && list[i - 1]?.message !== PENDING ? 1 : 0), 0);
    const final = (await events(session.page)).at(-1);
    record("double-restart", pendingRuns === 1 && final.moveDisabled === false && session.pageErrors.length === 0, { pendingRuns, final });
  }
  // error, then retry
  {
    await session.page.locator(".rsg-details-trigger").click();
    const from = await mark(session.page);
    await session.page.evaluate(() => {
      // ROUTE-C7C: the Rota generates in a Web Worker. Make the NEXT Worker fail to construct, as a CSP block would —
      // the executor reports it as the generation's failure; the constructor is put back at once.
      const RealWorker = window.Worker;
      if (RealWorker) {
        window.Worker = function () {
          window.Worker = RealWorker;
          throw new DOMException("generation forced to fail by the probe", "SecurityError");
        };
      }
      // C7B (a tree whose executor is local): poison Math.random inside ONE task only: the local executor's (recognised
      // by its own code — the response it builds names `requestId`, which survives minification), so generation throws
      // there and nothing else on the page ever sees it.
      const realSetTimeout = window.setTimeout;
      window.setTimeout = function (fn, ms, ...rest) {
        if (!ms && typeof fn === "function" && String(fn).includes("requestId")) {
          window.setTimeout = realSetTimeout;
          return realSetTimeout(() => {
            const realRandom = Math.random;
            Math.random = () => {
              throw new Error("generation forced to fail by the probe");
            };
            try {
              fn(...rest);
            } finally {
              Math.random = realRandom;
            }
          }, ms);
        }
        return realSetTimeout(fn, ms, ...rest);
      };
      document.querySelector('button[aria-label="Começar outra rota"]').click();
    });
    await session.page
      .waitForFunction(() => Boolean(document.querySelector('button[aria-label="Tentar preparar a rota novamente"]')), null, { timeout: 30000 })
      .catch(async (error) => {
        throw new Error(`${error.message} · last: ${JSON.stringify((await events(session.page)).slice(-3))} · pageErrors: ${JSON.stringify(session.pageErrors.slice(-3))} · console: ${JSON.stringify(session.console.slice(-3))}`);
      });
    const failed = (await events(session.page)).at(-1);
    if (OUT) await session.page.screenshot({ path: path.join(OUT, "error.png") });
    await session.page.locator('button[aria-label="Tentar preparar a rota novamente"]').click();
    await settled(session.page);
    await session.page.locator(".rsg-details-close").click();
    await session.page.waitForTimeout(300);
    const list = await since(session.page, from);
    const final = (await events(session.page)).at(-1);
    // Only the probe's own throw may surface (a frame that drew while Math.random was poisoned).
    const foreign = session.pageErrors.filter((e) => !e.includes("generation forced to fail by the probe"));
    record("error-retry", list.some((e) => e.message === FAILED && e.retry) && failed.moveDisabled !== false && final.moveDisabled === false && !final.retry && foreign.length === 0, {
      failed,
      final,
      probeErrorsSurfaced: session.pageErrors.length - foreign.length,
      foreignPageErrors: foreign,
    });
  }
  // exit while pending
  {
    await session.page.locator(".rsg-details-trigger").click();
    const errorsBefore = session.pageErrors.length;
    await clickInOneTask(session.page, ['button[aria-label="Começar outra rota"]', 'button[aria-label="Voltar à jornada cognitiva"]']);
    await session.page.waitForFunction(() => !document.querySelector(".rsg-shell"), null, { timeout: 30000 });
    await session.page.waitForTimeout(1500);
    record("exit-pending", session.pageErrors.length === errorsBefore &&!(await session.page.evaluate(() => Boolean(document.querySelector(".rsg-shell")))), {
      pageErrors: session.pageErrors.slice(errorsBefore),
    });
  }
} catch (error) {
  record("journey", false, { error: String(error?.stack ?? error).slice(0, 600) });
}

// rapid mode change: a fresh entry (setup), once the first session's WebGL is gone
await session.context.close();
const modes = await open("modes");
try {
  await enterRoute(modes);
  const from = await mark(modes.page);
  await clickInOneTask(modes.page, [
    'button[aria-label^="Modo Aberto"]',
    'button[aria-label^="Modo Equilibrado"]',
    'button[aria-label^="Modo Desafiador"]',
  ]);
  await settled(modes.page);
  const list = await since(modes.page, from);
  const final = list.at(-1);
  const pendingRuns = list.reduce((n, e, i) => n + (e.message === PENDING && list[i - 1]?.message !== PENDING ? 1 : 0), 0);
  record("rapid-mode", final.pressed === "Desafiador" && pendingRuns === 1 && list.every((e) => e.pressed === null || e.pressed === "Desafiador" || e.pressed === list[0].pressed), {
    pressedSeen: [...new Set(list.map((e) => e.pressed))],
    pendingRuns,
    final,
  });
  // Start is disabled while a mode is pending, and moves are absent
  const pendingStart = list.filter((e) => e.message === PENDING).map((e) => e.startDisabled);
  record("setup-pending-start-disabled", pendingStart.length > 0 && pendingStart.every((d) => d === true), { pendingStart });
} catch (error) {
  record("rapid-mode", false, { error: String(error?.stack ?? error).slice(0, 600) });
}

const probeOwn = (text) => text.includes("generation forced to fail by the probe");
const allConsole = [...consoleErrors(session, probeOwn), ...consoleErrors(modes, probeOwn)];
record("no-console-errors", allConsole.length === 0, { errors: allConsole.slice(0, 5) });

await browser.close();
if (OUT) fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.pass);
log(`${results.length - failed.length}/${results.length} held${failed.length ? ` · failing: ${failed.map((r) => r.name).join(", ")}` : ""}`);
process.exit(failed.length ? EXIT_FAILED : EXIT_OK);
