/**
 * Rota 2.0 — the Rota's entry time, base against candidate, under the same browser and the same idle CPU.
 *
 * Two production servers (`next start`) of two builds — the base and the candidate — are entered alternately
 * (base, candidate, base, candidate, …), each from a fresh context: Home → the Rota's world → intro → board ready
 * (`.route-babylon-wrap[data-visual-state="ready"]`). Reports each run's milliseconds, the product's own entry
 * retries ("Tentar novamente"), and the medians. Nothing in the app is instrumented.
 *
 * Usage:
 *   node tools/validation/rota2-entry-timing-probe.mjs --base http://localhost:3101 --candidate http://localhost:3100
 *        [--runs 3] [--viewport 480x360] [--json FILE]
 * Exit: 0 measured · 3 usage / setup error.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

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
    process.exit(3);
  }
})();
const arg = (name, fallback = null) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const URLS = { base: arg("--base"), candidate: arg("--candidate") };
if (!URLS.base || !URLS.candidate) {
  console.error("usage: --base URL --candidate URL [--runs N] [--viewport WxH] [--json FILE]");
  process.exit(3);
}
const RUNS = Number(arg("--runs", "3"));
const [width, height] = arg("--viewport", "480x360").split("x").map(Number);
const JSON_OUT = arg("--json");

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--use-gl=angle", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
async function enter(url) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    const probe = { phases: [] };
    window.__entryProbe = probe;
    let phase;
    new MutationObserver(() => {
      const entry = document.querySelector("[data-entry-phase]");
      const next = entry ? entry.getAttribute("data-entry-phase") : null;
      if (next !== phase) probe.phases.push((phase = next));
    }).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-entry-phase"] });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.locator(".hj-stage").waitFor({ timeout: 180000 });
    await page.waitForTimeout(1500);
    const pip = page.locator('.hj-gallery-pip[aria-label="Selecionar Rota Estratégica"]');
    if (await pip.count()) await pip.click({ force: true });
    await page.waitForTimeout(700);
    const started = Date.now();
    await page.locator('.hj-world-object[aria-current="true"] .hj-world-enter').click({ force: true });
    let retries = 0;
    let from = 0;
    for (;;) {
      const outcome = await page
        .waitForFunction(
          ({ from }) => {
            const phases = window.__entryProbe.phases.slice(from);
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
      from = await page.evaluate(() => window.__entryProbe.phases.length);
      await page.getByRole("button", { name: "Tentar novamente" }).click();
    }
    const entryMs = Date.now() - started;
    await page.locator(".wentry-intro-layer .pgi-cta").click();
    const boardStarted = Date.now();
    await page.locator('.route-babylon-wrap[data-visual-state="ready"]').waitFor({ timeout: 120000 });
    return { entryMs, boardReadyAfterIntroMs: Date.now() - boardStarted, retries, errors };
  } catch (error) {
    return { error: String(error?.message ?? error).split("\n")[0], errors };
  } finally {
    await context.close();
  }
}
const rows = [];
for (let run = 0; run < RUNS; run += 1) {
  for (const side of ["base", "candidate"]) {
    const row = { run, side, ...(await enter(URLS[side])) };
    rows.push(row);
    console.log(JSON.stringify(row));
  }
}
await browser.close();
const median = (values) => {
  const v = values.filter((x) => typeof x === "number").sort((a, b) => a - b);
  return v.length ? v[Math.floor((v.length - 1) / 2)] : null;
};
const summary = Object.fromEntries(
  ["base", "candidate"].map((side) => {
    const mine = rows.filter((r) => r.side === side);
    return [side, { runs: mine.length, failed: mine.filter((r) => r.error).length, retries: mine.reduce((n, r) => n + (r.retries ?? 0), 0), medianEntryMs: median(mine.map((r) => r.entryMs)), medianBoardReadyAfterIntroMs: median(mine.map((r) => r.boardReadyAfterIntroMs)) }];
  }),
);
console.log(JSON.stringify(summary, null, 2));
if (JSON_OUT) fs.writeFileSync(JSON_OUT, `${JSON.stringify({ viewport: `${width}x${height}`, rows, summary }, null, 2)}\n`);
