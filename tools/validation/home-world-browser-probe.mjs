/**
 * HOME-WORLD-VISUAL-UNIFICATION-01 — browser probe: the Home's worlds in the production build.
 *
 * Drives the real Home the way a person would and reads only the DOM:
 *
 *   desktop   1440×900: five worlds, each one maquette of the seven kit passes; every world selected by its pip
 *             (aria-current, plaque, "Entrar em …"); the chosen plaque lands on the SAME line for every world;
 *             the arrows cycle; a neighbour's plaque selects that neighbour; hovering never selects
 *   keyboard  Tab reaches the stage; ← → move the selection; Tab onto a world draws a visible focus ring and
 *             selects it; Enter on the stage enters the chosen world
 *   launch    each world entered from its plaque: the threshold (the kit worlds with their maquette, the Estúdio
 *             with its room picture), then the world's own intro, with no page error
 *   phone     390×844 and 360×740: no sideways page scroll; each world, chosen by its pip, comes fully into view
 *             with its plaque; "Entrar", the pips and the arrows are at least 44 px
 *   short     1280×720 and 1366×768: the plaques never meet the gallery controls; the chosen plaque is on screen
 *   reduced   prefers-reduced-motion: no animation on any maquette pass
 *
 * And throughout: no request for a retired Home asset (the old kits, world-glow.webp).
 *
 * Read-only: nothing is instrumented; it writes nothing unless --out / --json are given.
 *
 * Usage:
 *   next build && next start -p 3100
 *   node tools/validation/home-world-browser-probe.mjs [--base URL] [--scenario a,b] [--out DIR] [--json FILE]
 *
 * Playwright: `import("playwright")`, or PLAYWRIGHT_DIR (the other probes' convention).
 * Exit: 0 every scenario held · 1 a check failed · 3 usage / setup error.
 */
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const EXIT_OK = 0;
const EXIT_FAILED = 1;
const EXIT_USAGE = 3;

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const BASE = arg("--base", "http://localhost:3100");
const OUT = arg("--out", null);
const JSON_OUT = arg("--json", null);
const ALL = ["desktop", "keyboard", "launch", "phone", "short", "reduced"];
const SCENARIOS = (arg("--scenario", ALL.join(",")) ?? "").split(",").filter(Boolean);
if (SCENARIOS.some((name) => !ALL.includes(name))) {
  console.error(`unknown scenario; choose from ${ALL.join(", ")}`);
  process.exit(EXIT_USAGE);
}

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

/** The worlds in the Home's order, with the kit pass vocabulary every maquette must carry. */
const WORLDS = [
  { id: "route", name: "Rota Estratégica", kit: true },
  { id: "circuit", name: "Circuito de Memória", kit: true },
  { id: "commands", name: "Central de Comandos", kit: true },
  { id: "discovery", name: "Estúdio das Descobertas", kit: false },
  { id: "garden", name: "Jardim de Sementes", kit: true },
];
const PASSES = ["contact-shadow", "base", "back", "main", "detail", "energy", "front"];
const RETIRED = /dioramas\/(route-world|circuit-world|panel|garden|trail)\/|world-glow\.webp/;

const checks = [];
const record = (scenario, name, pass, facts = {}) => {
  checks.push({ scenario, name, pass: Boolean(pass), facts });
  console.log(`${pass ? "PASS" : "FAIL"}  [${scenario}] ${name}${Object.keys(facts).length ? `  ${JSON.stringify(facts).slice(0, 400)}` : ""}`);
};

const executablePath = process.env.CHROMIUM_PATH || undefined;
let browser;
try {
  browser = await chromium.launch(executablePath ? { executablePath } : {});
} catch (error) {
  console.error(`could not launch Chromium: ${error.message}`);
  process.exit(EXIT_USAGE);
}

async function open({ width, height, mobile = false, reducedMotion = "no-preference" }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, reducedMotion });
  const page = await context.newPage();
  const errors = [];
  const requests = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("request", (r) => requests.push(r.url()));
  const response = await page.goto(`${BASE}/`, { waitUntil: "load" }).catch(() => null);
  if (!response || !response.ok()) {
    console.error(`the Home did not load at ${BASE}`);
    process.exit(EXIT_USAGE);
  }
  await page.waitForSelector(".hj-world-object .wd-shell");
  await page.waitForTimeout(400);
  return { context, page, errors, requests };
}

const pip = (page, world) => page.locator(`.hj-gallery-pip[aria-label="Selecionar ${world.name}"]`);
const selectedName = (page) => page.locator(".hj-world-object.hj-world-selected .hj-world-copy strong").innerText();
const rectOf = (page, selector) => page.locator(selector).first().evaluate((el) => {
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
});
const meet = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
/** Wait until every running CSS transition (the gallery's slide and scale) has finished; infinite animations aside. */
const settle = async (page) => {
  await page.waitForTimeout(60);
  await page.evaluate(() => Promise.all(document.getAnimations().filter((a) => a instanceof CSSTransition).map((a) => a.finished.catch(() => null))));
  await page.waitForTimeout(60);
};

async function shot(page, name) {
  if (!OUT) return;
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

// --- desktop -------------------------------------------------------------------------------------------
if (SCENARIOS.includes("desktop")) {
  const { context, page, errors, requests } = await open({ width: 1440, height: 900 });
  const structure = await page.evaluate(() =>
    [...document.querySelectorAll(".hj-world-object")].map((el) => ({
      name: el.querySelector(".hj-world-copy strong")?.textContent,
      layers: [...el.querySelectorAll(".wd-layer")].map((l) => l.getAttribute("data-layer")),
    })),
  );
  record("desktop", "FIVE_WORLDS_ONE_CONSTRUCTION", structure.length === 5 && structure.every((w) => JSON.stringify(w.layers) === JSON.stringify(PASSES)), {
    worlds: structure.map((w) => `${w.name}:${w.layers.length}`),
  });

  const lines = {};
  const selections = [];
  for (const world of WORLDS) {
    await pip(page, world).click();
    await settle(page);
    const current = await page.locator('.hj-world-object[aria-current="true"] .hj-world-copy strong').innerText();
    const enter = await page.getByRole("button", { name: `Entrar em ${world.name}` }).count();
    const plaque = await rectOf(page, ".hj-world-object.hj-world-selected .hj-world-plaque");
    const art = await rectOf(page, ".hj-world-object.hj-world-selected .hj-world-diorama");
    const loaded = await page.locator(".hj-world-object.hj-world-selected .wd-layer-image").evaluateAll((imgs) => imgs.every((i) => i.complete && i.naturalWidth > 0));
    lines[world.id] = { plaqueTop: Math.round(plaque.top), artBottom: Math.round(art.bottom), artWidth: Math.round(art.width) };
    selections.push({ world: world.id, ok: current === world.name && enter >= 1 && loaded });
    await shot(page, `desktop-${world.id}`);
  }
  record("desktop", "EVERY_WORLD_SELECTED_BY_ITS_PIP", selections.every((s) => s.ok), { selections });
  const tops = Object.values(lines).map((l) => l.plaqueTop);
  const widths = Object.values(lines).map((l) => l.artWidth);
  record("desktop", "ONE_LINE_FOR_EVERY_WORLD", Math.max(...tops) - Math.min(...tops) <= 1 && Math.max(...widths) - Math.min(...widths) <= 1, { lines });

  // arrows cycle through all five and back
  await pip(page, WORLDS[0]).click();
  await settle(page);
  const seen = [];
  for (let i = 0; i < 5; i += 1) {
    await page.getByRole("button", { name: "Ver próximo mundo" }).click();
    await settle(page);
    seen.push(await selectedName(page));
  }
  record("desktop", "ARROWS_CYCLE", seen.at(-1) === WORLDS[0].name && new Set(seen).size === 5, { seen });

  // a neighbour's plaque selects it; hovering does not
  await pip(page, WORLDS[0]).click();
  await settle(page);
  const neighbour = page.locator(".hj-world-object.hj-world-offset-pos-1 .hj-world-plaque");
  const neighbourName = await neighbour.locator("strong").innerText();
  const box = await neighbour.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  const afterHover = await selectedName(page);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await settle(page);
  const afterClick = await selectedName(page);
  record("desktop", "A_NEIGHBOURS_PLAQUE_SELECTS_IT", afterHover === WORLDS[0].name && afterClick === neighbourName, { afterHover, afterClick, neighbourName });

  const retired = requests.filter((u) => RETIRED.test(u));
  record("desktop", "NO_RETIRED_ART_REQUESTED", retired.length === 0, { retired });
  record("desktop", "NO_PAGE_ERROR", errors.length === 0, { errors });
  await context.close();
}

// --- keyboard ------------------------------------------------------------------------------------------
if (SCENARIOS.includes("keyboard")) {
  const { context, page, errors } = await open({ width: 1440, height: 900 });
  await page.locator(".hj-stage").focus();
  const stageFocused = await page.evaluate(() => document.activeElement?.classList.contains("hj-stage"));
  const start = await selectedName(page);
  await page.keyboard.press("ArrowRight");
  await settle(page);
  const right = await selectedName(page);
  await page.keyboard.press("ArrowLeft");
  await settle(page);
  const back = await selectedName(page);
  record("keyboard", "ARROW_KEYS_MOVE_THE_SELECTION", stageFocused && right !== start && back === start, { start, right, back });

  // Tab onto the worlds: each focused world draws a ring and becomes the chosen one
  const rings = [];
  for (let i = 0; i < 12 && rings.length < 3; i += 1) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(250);
    const focus = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el?.classList.contains("hj-world-select")) return null;
      const style = getComputedStyle(el);
      return { label: el.getAttribute("aria-label"), outline: `${style.outlineStyle} ${style.outlineWidth}`, visible: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2 };
    });
    if (focus) {
      await settle(page);
      focus.selected = await selectedName(page);
      rings.push(focus);
    }
  }
  record("keyboard", "FOCUS_RING_AND_SELECTION", rings.length > 0 && rings.every((r) => r.visible && r.label?.endsWith(r.selected)), { rings });
  await shot(page, "keyboard-focus");

  // Enter on the stage enters the chosen world
  await page.locator(".hj-stage").focus();
  const chosen = await selectedName(page);
  await page.keyboard.press("Enter");
  const title = await page.waitForSelector("#intro-title", { timeout: 30000 }).then((el) => el.innerText()).catch(() => null);
  record("keyboard", "ENTER_ENTERS_THE_CHOSEN_WORLD", title === chosen, { chosen, title });
  record("keyboard", "NO_PAGE_ERROR", errors.length === 0, { errors });
  await context.close();
}

// --- launch --------------------------------------------------------------------------------------------
if (SCENARIOS.includes("launch")) {
  for (const world of WORLDS) {
    const { context, page, errors } = await open({ width: 1440, height: 900 });
    await pip(page, world).click();
    await settle(page);
    await page.locator(".hj-world-object.hj-world-selected .hj-world-enter").click();
    const threshold = await page.waitForSelector(".wtx-shell", { timeout: 10000 }).then(() => true).catch(() => false);
    const art = await page.evaluate(() => ({
      maquette: Boolean(document.querySelector(".wtx-shell .wms-scene .wd-shell")),
      picture: Boolean(document.querySelector(".wtx-shell .wtx-image")),
    }));
    if (threshold) await shot(page, `launch-${world.id}-threshold`);
    const title = await page.waitForSelector("#intro-title", { timeout: 30000 }).then((el) => el.innerText()).catch(() => null);
    await page.waitForFunction(() => !document.querySelector(".wtx-shell"), null, { timeout: 30000 }).catch(() => {});
    const introArt = await page.evaluate(() => ({
      maquette: Boolean(document.querySelector(".wintro-preview-media .wms-scene .wd-shell")),
      picture: Boolean(document.querySelector(".pgi-preview-image")),
    }));
    await shot(page, `launch-${world.id}-intro`);
    const expected = world.kit ? art.maquette && introArt.maquette : art.picture && introArt.picture;
    record("launch", `ENTERS_${world.id.toUpperCase()}`, threshold && title === world.name && expected && errors.length === 0, { threshold, title, threshold_art: art, intro_art: introArt, errors });
    await context.close();
  }
}

// --- phone ---------------------------------------------------------------------------------------------
if (SCENARIOS.includes("phone")) {
  for (const vp of [{ width: 390, height: 844 }, { width: 360, height: 740 }]) {
    const { context, page, errors } = await open({ ...vp, mobile: true });
    const tag = `${vp.width}x${vp.height}`;
    const overflow = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
    record("phone", `NO_SIDEWAYS_SCROLL_${tag}`, overflow <= 0, { overflow });
    const views = [];
    for (const world of WORLDS) {
      await pip(page, world).click();
      await page.waitForTimeout(900);
      const r = await page.evaluate(() => {
        const sel = document.querySelector(".hj-world-object.hj-world-selected");
        const art = sel.querySelector(".hj-world-diorama").getBoundingClientRect();
        const plaque = sel.querySelector(".hj-world-plaque").getBoundingClientRect();
        const enter = sel.querySelector(".hj-world-enter").getBoundingClientRect();
        return { artLeft: art.left, artRight: art.right, plaqueLeft: plaque.left, plaqueRight: plaque.right, enterH: enter.height, enterW: enter.width, vw: window.innerWidth };
      });
      const ok = r.artLeft >= -1 && r.artRight <= r.vw + 1 && r.plaqueLeft >= 0 && r.plaqueRight <= r.vw && r.enterH >= 44;
      views.push({ world: world.id, ok, enter: `${Math.round(r.enterW)}×${Math.round(r.enterH)}` });
      if (world.id === "route" || world.id === "garden") await shot(page, `phone-${tag}-${world.id}`);
    }
    record("phone", `EVERY_WORLD_IN_VIEW_${tag}`, views.every((v) => v.ok), { views });
    const targets = await page.evaluate(() => [...document.querySelectorAll(".hj-gallery-pip, .hj-gallery-arrow")].map((b) => {
      const r = b.getBoundingClientRect();
      return Math.round(Math.min(r.width, r.height));
    }));
    record("phone", `TAP_TARGETS_44_${tag}`, targets.every((t) => t >= 44), { targets });
    record("phone", `NO_PAGE_ERROR_${tag}`, errors.length === 0, { errors });
    await context.close();
  }
}

// --- short ---------------------------------------------------------------------------------------------
if (SCENARIOS.includes("short")) {
  for (const vp of [{ width: 1280, height: 720 }, { width: 1366, height: 768 }]) {
    const { context, page } = await open(vp);
    const tag = `${vp.width}x${vp.height}`;
    const problems = [];
    for (const world of WORLDS) {
      await pip(page, world).click();
      await settle(page);
      const controls = await rectOf(page, ".hj-gallery-controls");
      const plaques = await page.locator(".hj-world-object .hj-world-plaque").evaluateAll((els) =>
        els
          .filter((el) => parseFloat(getComputedStyle(el).opacity) > 0.05)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return { name: el.querySelector("strong")?.textContent, left: r.left, top: r.top, right: r.right, bottom: r.bottom };
          }),
      );
      for (const p of plaques) if (meet(p, controls)) problems.push(`${world.id}: ${p.name} meets the controls`);
      const chosen = await rectOf(page, ".hj-world-object.hj-world-selected .hj-world-plaque");
      if (chosen.bottom > vp.height) problems.push(`${world.id}: chosen plaque below the fold (${Math.round(chosen.bottom)})`);
    }
    await pip(page, WORLDS[0]).click();
    await settle(page);
    await shot(page, `short-${tag}`);
    record("short", `PLAQUES_CLEAR_OF_CONTROLS_${tag}`, problems.length === 0, { problems });
    await context.close();
  }
}

// --- reduced -------------------------------------------------------------------------------------------
if (SCENARIOS.includes("reduced")) {
  const { context, page, errors } = await open({ width: 1440, height: 900, reducedMotion: "reduce" });
  const animated = await page.evaluate(() => [...document.querySelectorAll(".wd-layer")].filter((el) => getComputedStyle(el).animationName !== "none").length);
  record("reduced", "NO_MAQUETTE_ANIMATION", animated === 0, { animated });
  record("reduced", "NO_PAGE_ERROR", errors.length === 0, { errors });
  await context.close();
}

await browser.close();
const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} checks held${failed.length ? ` · failing: ${failed.map((c) => `[${c.scenario}] ${c.name}`).join(", ")}` : ""}`);
console.log(failed.length ? "HOME_WORLD_PROBE_FAILED" : "HOME_WORLD_PROBE_HOLDS");
if (JSON_OUT) {
  fs.mkdirSync(path.dirname(JSON_OUT), { recursive: true });
  fs.writeFileSync(JSON_OUT, `${JSON.stringify({ base: BASE, scenarios: SCENARIOS, checks }, null, 2)}\n`);
}
process.exit(failed.length ? EXIT_FAILED : EXIT_OK);
