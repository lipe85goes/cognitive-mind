/**
 * HOME-WORLD-VISUAL-UNIFICATION-01 — the Home atelier kit, checked from source and from the shipped pixels.
 *
 * Every Home world maquette is one construction: the Estúdio das Descobertas'
 * (the quality reference) — one canvas, one pedestal, one camera, one light, one
 * pass vocabulary — with its own subject. This battery holds that contract:
 *
 *   K01 ONE_CANVAS_ONE_VOCABULARY  every world's diorama config: 1040×780 and the same passes, in DIORAMA_PASSES order
 *   K02 ART_ON_DISK                every layer's file exists, is a 4:3 WebP, and shared files are shared (one contact shadow)
 *   K03 ONE_PEDESTAL               the base pass of every world, measured on its pixels, has the Estúdio's footprint
 *   K04 ONE_SIZE                   every world is shown at one Home size (HOME_WORLD_LAYOUT)
 *   K05 BUDGET                     each kit world and the whole Home maquette set within budget (encoded bytes)
 *   K06 NO_ORPHANS                 every file the kit ships is read by the runtime; nothing reads a retired folder
 *   K07 ONE_MAQUETTE_INTO_ENTRY    every kit world has a master scene whose essential assets are its Home layers
 *   K08 ONE_HOME_RENDER_PATH       the Home draws every world with WorldDiorama (no per-world renderer, no crop)
 *   K09 THE_KIT_PAINTS_THE_ART     (--deep) the kit script, run in memory, paints what ships (pixel tolerance)
 *   K10 NOTHING_BUT_PRESENTATION   since the mission's base, no file under the games, engine, data, types, app or lib moved
 *
 * Writes nothing. Usage:
 *   node tools/validation/home-atelier-kit-tests.mjs [--deep] [--counterfactuals]
 *     --counterfactuals  also reads the mission's base (720b404, git show) and requires
 *                        the source checks K01, K04, K07 and K08 to FAIL there: two
 *                        canvases and two pass vocabularies, three sizes, entry
 *                        maquettes for two worlds only, two renderers in the Home
 *
 * Exit: 0 every check held · 1 a check failed · 3 usage error.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import sharp from "sharp";
import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";
import { createModuleGraph, openSourceTree, treeBeforeRota2 } from "./route-module-loader.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
/** The mission's base: the latest v06-portal-requires-lights when HOME-WORLD-VISUAL-UNIFICATION-01 began. */
const BASE = "720b404eb7ef77cace9ea91685f97c27d302354d";
const REFERENCE = "hidden-objects";
const ATELIER = "public/illustrations/home/atelier";
const RETIRED = ["dioramas/route-world", "dioramas/circuit-world", "dioramas/panel/", "dioramas/garden/", "world-glow.webp"];
const PRESENTATION_ONLY = ["src/games/", "src/engine/", "src/data/", "src/types/", "src/app/", "src/lib/"];

const args = process.argv.slice(2);
const known = ["--deep", "--counterfactuals"];
if (args.some((a) => !known.includes(a))) {
  console.error(`usage: node tools/validation/home-atelier-kit-tests.mjs [--deep] [--counterfactuals]`);
  process.exit(EXIT_USAGE);
}
const DEEP = args.includes("--deep");
const COUNTERFACTUALS = args.includes("--counterfactuals");

const results = [];
async function check(id, name, fn) {
  try {
    const { pass, ...facts } = await fn();
    results.push({ id, name, pass, facts });
  } catch (error) {
    results.push({ id, name, pass: false, facts: { error: String(error?.stack ?? error).split("\n").slice(0, 3).join(" | ") } });
  }
}

const kit = await import(pathToFileURL(path.join(ROOT, "tools/assets/home-atelier-kit.mjs")).href);

/** The Home's presentation tables, as a tree has them. */
function tablesOf(tree) {
  const graph = createModuleGraph({ tree, mocks: {}, globals: {} });
  const dioramas = graph.require("src/components/worlds/diorama/worldDioramaLayout.ts");
  const CONFIGS = dioramas.WORLD_DIORAMA_CONFIGS;
  const GAMES = Object.keys(CONFIGS);
  return {
    tree,
    dioramas,
    layout: graph.require("src/components/home/homeLayout.ts"),
    master: graph.require("src/components/worlds/master-scene/worldMasterSceneConfig.ts"),
    CONFIGS,
    GAMES,
    KIT_GAMES: GAMES.filter((id) => id !== REFERENCE),
  };
}

const T = tablesOf(openSourceTree({ root: ROOT }));
const { CONFIGS, GAMES, KIT_GAMES } = T;
const file = (src) => path.join(ROOT, "public", src);
const kb = (n) => `${(n / 1024).toFixed(1)} KB`;

/** The opaque footprint of an image's alpha (alpha > 24), in canvas pixels. */
async function footprint(src) {
  const { data, info } = await sharp(file(src)).ensureAlpha().resize(kit.CANVAS.width, kit.CANVAS.height).raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width;
  let y0 = info.height;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * 4 + 3] > 24) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return { x0, y0, x1, y1 };
}

/** K01: one canvas and one pass vocabulary for every world. */
function oneCanvas({ dioramas, CONFIGS, GAMES }) {
  if (!dioramas.DIORAMA_PASSES) return { pass: false, reason: "no shared pass vocabulary (DIORAMA_PASSES)", canvases: [...new Set(GAMES.map((id) => `${CONFIGS[id].width}×${CONFIGS[id].height}`))] };
  const passes = dioramas.DIORAMA_PASSES.map((p) => p.id);
  const wrong = GAMES.filter((id) => {
    const c = CONFIGS[id];
    return c.width !== kit.CANVAS.width || c.height !== kit.CANVAS.height || JSON.stringify(c.layers.map((l) => l.id)) !== JSON.stringify(passes) ||
      c.layers.some((l, i) => l.depth !== dioramas.DIORAMA_PASSES[i].depth || l.className !== dioramas.DIORAMA_PASSES[i].className);
  });
  return { pass: wrong.length === 0 && JSON.stringify(passes) === JSON.stringify(kit.PASSES), passes, worlds: GAMES.length, wrong };
}
await check("K01", "ONE_CANVAS_ONE_VOCABULARY", () => oneCanvas(T));

await check("K02", "ART_ON_DISK", async () => {
  const problems = [];
  for (const id of GAMES) {
    for (const layer of CONFIGS[id].layers) {
      if (!fs.existsSync(file(layer.src))) {
        problems.push(`${id}/${layer.id}: missing ${layer.src}`);
        continue;
      }
      const meta = await sharp(file(layer.src)).metadata();
      if (meta.format !== "webp" || !meta.hasAlpha || Math.abs(meta.width * 3 - meta.height * 4) > 4) problems.push(`${id}/${layer.id}: ${meta.format} ${meta.width}×${meta.height}`);
    }
  }
  const shadows = new Set(KIT_GAMES.map((id) => CONFIGS[id].layers.find((l) => l.id === "contact-shadow").src));
  return { pass: problems.length === 0 && shadows.size === 1, problems, sharedContactShadow: [...shadows] };
});

await check("K03", "ONE_PEDESTAL", async () => {
  const reference = await footprint(CONFIGS[REFERENCE].layers.find((l) => l.id === "base").src);
  const off = {};
  for (const id of KIT_GAMES) {
    const f = await footprint(CONFIGS[id].layers.find((l) => l.id === "base").src);
    const d = Math.max(...["x0", "y0", "x1", "y1"].map((k) => Math.abs(f[k] - reference[k])));
    if (d > 3) off[id] = { ...f, maxDelta: d };
  }
  const { cx, cy, rx, ry, height } = kit.PLINTH;
  const expected = { x0: cx - rx, y0: cy - ry, x1: cx + rx, y1: cy + height + ry };
  const fromKit = Math.max(...["x0", "y0", "x1", "y1"].map((k) => Math.abs(reference[k] - expected[k])));
  return { pass: Object.keys(off).length === 0 && fromKit <= 4, estudio: reference, kitPlinth: expected, off };
});

/** K04: one Home size. */
function oneSize({ layout }) {
  const sizes = Object.fromEntries(Object.entries(layout.HOME_WORLD_LAYOUT).map(([id, l]) => [id, l.desktop.sizeRem]));
  const distinct = new Set(Object.values(sizes));
  return { pass: distinct.size === 1 && distinct.has(layout.HOME_DIORAMA_SIZE_REM), sizes };
}
await check("K04", "ONE_SIZE", () => oneSize(T));

await check("K05", "BUDGET", () => {
  const bytes = (src) => fs.statSync(file(src)).size;
  const perWorld = {};
  const counted = new Set();
  let total = 0;
  for (const id of GAMES) {
    perWorld[id] = 0;
    for (const layer of CONFIGS[id].layers) {
      const b = bytes(layer.src);
      if (!(layer.id === "contact-shadow" && KIT_GAMES.includes(id))) perWorld[id] += b;
      if (!counted.has(layer.src)) {
        counted.add(layer.src);
        total += b;
      }
    }
  }
  const over = KIT_GAMES.filter((id) => perWorld[id] > kit.BUDGET.world);
  return { pass: over.length === 0 && total <= 600 * 1024, perWorld: Object.fromEntries(Object.entries(perWorld).map(([k, v]) => [k, kb(v)])), allMaquettes: kb(total), over };
});

await check("K06", "NO_ORPHANS", () => {
  const referenced = new Set(GAMES.flatMap((id) => CONFIGS[id].layers.map((l) => `public${l.src}`)));
  const shipped = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(rel);
      else shipped.push(rel);
    }
  };
  walk(ATELIER);
  const orphans = shipped.filter((f) => !referenced.has(f));
  const sources = ["src/components", "src/styles", "src/app"].flatMap((dir) => {
    const out = [];
    const rec = (d) => {
      for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
        const rel = `${d}/${e.name}`;
        if (e.isDirectory()) rec(rel);
        else if (/\.(tsx?|css)$/.test(e.name)) out.push(rel);
      }
    };
    rec(dir);
    return out;
  });
  const retiredReads = sources.filter((f) => RETIRED.some((r) => fs.readFileSync(path.join(ROOT, f), "utf8").includes(`illustrations/home/${r}`)));
  const retiredOnDisk = RETIRED.filter((r) => fs.existsSync(path.join(ROOT, "public/illustrations/home", r)));
  return { pass: orphans.length === 0 && retiredReads.length === 0 && retiredOnDisk.length === 0, shipped: shipped.length, orphans, retiredReads, retiredOnDisk };
});

/** K07: every kit world enters through its own Home maquette. */
function oneMaquetteIntoEntry({ master, CONFIGS, KIT_GAMES }) {
  const problems = [];
  for (const id of KIT_GAMES) {
    if (!master.hasWorldMasterScene(id)) {
      problems.push(`${id}: no master scene`);
      continue;
    }
    const scene = master.getWorldMasterSceneConfig(id);
    const layers = CONFIGS[id].layers.map((l) => l.src);
    if (JSON.stringify(scene.essentialAssets) !== JSON.stringify(layers)) problems.push(`${id}: essential assets are not its Home layers`);
    if (scene.crops.home) problems.push(`${id}: a Home crop`);
  }
  return { pass: problems.length === 0, kitWorlds: KIT_GAMES, problems, estudioEntry: master.hasWorldMasterScene(REFERENCE) ? "master scene" : "its own room picture (Game 03's world visuals)" };
}
await check("K07", "ONE_MAQUETTE_INTO_ENTRY", () => oneMaquetteIntoEntry(T));

/** K08: one renderer in the Home, no per-world branch or selector. */
function oneRenderPath({ tree }) {
  const source = tree.read("src/components/home/WorldObject.tsx");
  const code = source.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  const drawsDiorama = /<WorldDiorama\b/.test(code);
  const otherRenderer = /WorldMasterScene|hasWorldMasterScene|<Image\b/.test(code);
  const perWorld = /gameId\s*===|"escape-maze"|"color-sequence"|"security-panel"|"seed-garden"|"hidden-objects"/.test(code);
  const css = tree.read("src/components/worlds/diorama/world-diorama.css");
  const worldSelectors = (css.match(/\[data-world="[a-z-]+"\]/g) ?? []).length;
  return { pass: drawsDiorama && !otherRenderer && !perWorld && worldSelectors === 0, drawsDiorama, otherRenderer, perWorld, worldSelectorsInDioramaCss: worldSelectors };
}
await check("K08", "ONE_HOME_RENDER_PATH", () => oneRenderPath(T));

if (DEEP) {
  await check("K09", "THE_KIT_PAINTS_THE_ART", async () => {
    const { ATELIER_WORLDS } = await import(pathToFileURL(path.join(ROOT, "tools/assets/home-atelier-worlds.mjs")).href);
    const render = (svg, scale = 1) => sharp(Buffer.from(svg), { density: 72 * scale, limitInputPixels: false });
    const key = (opacity) => render(kit.wrap(kit.keyShaft({ opacity }))).png().toBuffer();
    const drift = {};
    for (const [world, def] of Object.entries(ATELIER_WORLDS)) {
      const svgs = def.passes();
      const k = await key(def.keyLight ?? kit.KEY_LIGHT);
      for (const pass of kit.PASSES.filter((p) => p !== "contact-shadow")) {
        let png = await render(svgs[pass], kit.RESOLUTION[pass] ?? 1).png().toBuffer();
        if (kit.LIT_PASSES.includes(pass)) png = await sharp(png).composite([{ input: k, blend: "atop" }]).png().toBuffer();
        const shipped = path.join(ROOT, ATELIER, world, `${world}-${pass}.webp`);
        const a = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
        const b = await sharp(shipped).ensureAlpha().resize(a.info.width, a.info.height).raw().toBuffer();
        // what shows is colour × alpha: compare premultiplied channels (the colour under a clear pixel is the encoder's)
        let sum = 0;
        for (let i = 0; i < b.length; i += 4) {
          const aa = a.data[i + 3];
          const ba = b[i + 3];
          for (let c = 0; c < 3; c += 1) sum += Math.abs((a.data[i + c] * aa) / 255 - (b[i + c] * ba) / 255);
          sum += Math.abs(aa - ba);
        }
        const mean = sum / b.length;
        if (mean > 1.5) drift[`${world}-${pass}`] = Number(mean.toFixed(2));
      }
    }
    return { pass: Object.keys(drift).length === 0, drift, tolerance: "mean premultiplied |Δ| ≤ 1.5 per channel (WebP is lossy)" };
  });
}

await check("K10", "NOTHING_BUT_PRESENTATION", () => {
  const changed = execFileSync("git", ["diff", "--name-only", BASE, "--", "src"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "--", "src"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);
  // ROTA2-DYNAMIC-TRAPS-01: the approved Rota 2.0 mission changes the Rota's own files on purpose. They are read with
  // exactly its pinned delta reversed (treeBeforeRota2); a file that then reads as at the base did not move otherwise.
  const live = treeBeforeRota2(openSourceTree({ root: ROOT }));
  const atBase = openSourceTree({ root: ROOT, rev: BASE });
  // ROTA2-DEPENDENT-OBJECTIVES-02 adds one Rota module: absent from the reversed view AND from the base, it is exactly
  // an approved mission's addition.
  const approvedAddition = (f) => live.beforeRota2 && !live.exists(f) && !atBase.exists(f);
  const movedOutsideRota2 = (f) => !approvedAddition(f) && (!live.beforeRota2 || !live.exists(f) || !atBase.exists(f) || live.read(f) !== atBase.read(f));
  const touched = [...changed, ...untracked].filter((f) => PRESENTATION_ONLY.some((dir) => f.startsWith(dir))).filter(movedOutsideRota2);
  return { pass: touched.length === 0, base: BASE.slice(0, 7), changedInSrc: [...changed, ...untracked], touchedOutsidePresentation: touched };
});

if (COUNTERFACTUALS) {
  const B = tablesOf(openSourceTree({ root: ROOT, rev: BASE }));
  const atBase = { K01: oneCanvas(B), K04: oneSize(B), K07: oneMaquetteIntoEntry(B), K08: oneRenderPath(B) };
  const held = Object.entries(atBase).filter(([, r]) => r.pass).map(([id]) => id);
  results.push({
    id: "CF",
    name: "THE_SOURCE_CHECKS_FAIL_ON_THE_BASE",
    pass: held.length === 0,
    facts: { base: BASE.slice(0, 7), heldOnBase: held, ...Object.fromEntries(Object.entries(atBase).map(([id, r]) => [id, JSON.stringify(r).slice(0, 220)])) },
  });
}

for (const r of results) {
  console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.id} — ${r.name}`);
  for (const [k, v] of Object.entries(r.facts)) console.log(`        ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
}
const failed = results.filter((r) => !r.pass).map((r) => r.id);
console.log(`\n${results.length - failed.length}/${results.length} passed${failed.length ? ` · failing: ${failed.join(", ")}` : ""}`);
console.log(failed.length ? "HOME_ATELIER_KIT_FAILED" : "HOME_ATELIER_KIT_HOLDS");
process.exit(failed.length ? EXIT_VALIDATION_FAILED : EXIT_OK);
