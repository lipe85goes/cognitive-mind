/**
 * HOME-WORLD-VISUAL-UNIFICATION-01 — paint the Home world maquettes with the atelier kit.
 *
 * The Estúdio das Descobertas' Home maquette is the reference (it is painted by
 * its own art script, tools/assets/create_hidden_objects_scene.mjs --home, and
 * is not rewritten here). This script paints the other four worlds with the
 * same technology — SVG passes on the shared pedestal, camera and light of
 * tools/assets/home-atelier-kit.mjs — and encodes them the same way.
 *
 * Writes:
 *   public/illustrations/home/atelier/<world>/<world>-<pass>.webp   (route, circuit, commands, garden)
 *   public/illustrations/home/atelier/shared/atelier-contact-shadow.webp (the one contact shadow they share)
 *   docs/archive/home-world-visual-unification-01/kit/<world>-passes.webp, <world>.webp, lineup.webp
 *
 * Usage:
 *   node tools/assets/create_home_atelier_dioramas.mjs [--world=route,garden] [--preview=DIR]
 *     --preview=DIR  only the composites (and the lineup) into DIR; nothing else is written
 *
 * Exit 1 when a world or a pass goes over the kit's budget.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { BUDGET, CANVAS, ENCODING, KEY_LIGHT, LIT_PASSES, PASSES, RESOLUTION, SHARED_CONTACT_SHADOW, contactShadowPass, keyShaft, wrap } from "./home-atelier-kit.mjs";
import { ATELIER_WORLDS } from "./home-atelier-worlds.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RUNTIME = path.join(ROOT, "public/illustrations/home/atelier");
const REVIEW = path.join(ROOT, "docs/archive/home-world-visual-unification-01/kit");
/** The reference maquette, as shipped (read only, for the lineup). */
const ESTUDIO = path.join(ROOT, "public/illustrations/home/dioramas/discovery");

const args = process.argv.slice(2);
const PREVIEW = args.find((a) => a.startsWith("--preview="))?.slice("--preview=".length) ?? null;
const ONLY = args.find((a) => a.startsWith("--world="))?.slice("--world=".length).split(",") ?? null;

const render = (svg, scale = 1) => sharp(Buffer.from(svg), { density: 72 * scale, limitInputPixels: false });
/** A pass at full canvas size, whatever resolution it ships at (for compositing). */
const full = (png) => sharp(png).resize(CANVAS.width, CANVAS.height).png().toBuffer();
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

/** The passes stacked in the runtime's paint order, on a transparent canvas. */
async function stack(layers) {
  const inputs = await Promise.all(layers.map(full));
  return sharp({ create: { width: CANVAS.width, height: CANVAS.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(inputs.map((input) => ({ input })))
    .png()
    .toBuffer();
}

/** A composite on the Home's own backdrop colour, so the review reads as the Home does. */
async function onBackdrop(png, width = CANVAS.width, height = CANVAS.height) {
  return sharp({ create: { width, height, channels: 4, background: "#1a1410" } })
    .composite([{ input: await sharp(png).resize(width, height).png().toBuffer() }])
    .png()
    .toBuffer();
}

async function passSheet(world, pngs) {
  const tileW = 346;
  const tileH = Math.round((tileW * CANVAS.height) / CANVAS.width);
  const tiles = [];
  for (const [i, pass] of PASSES.entries()) {
    const tile = await sharp(await full(pngs[pass])).resize(tileW, tileH).png().toBuffer();
    const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tileW}" height="22"><text x="6" y="16" font-family="sans-serif" font-size="14" fill="#f1e6cf">${world}-${pass}</text></svg>`);
    tiles.push({ input: tile, left: (i % 4) * (tileW + 4), top: Math.floor(i / 4) * (tileH + 26) });
    tiles.push({ input: label, left: (i % 4) * (tileW + 4), top: Math.floor(i / 4) * (tileH + 26) + tileH });
  }
  return sharp({ create: { width: 4 * (tileW + 4) - 4, height: 2 * (tileH + 26), channels: 4, background: "#2d3330" } }).composite(tiles).webp({ quality: 84 }).toBuffer();
}

async function lineup(composites) {
  const w = 520;
  const h = 390;
  const tiles = [];
  for (const [i, png] of composites.entries()) tiles.push({ input: await sharp(png).resize(w, h).png().toBuffer(), left: (i % 3) * w, top: Math.floor(i / 3) * h });
  const rows = Math.ceil(composites.length / 3);
  return sharp({ create: { width: 3 * w, height: rows * h, channels: 4, background: "#1a1410" } }).composite(tiles).webp({ quality: 84 }).toBuffer();
}

async function main() {
  const worlds = Object.entries(ATELIER_WORLDS).filter(([id]) => !ONLY || ONLY.includes(id));
  const outDir = PREVIEW ? path.resolve(PREVIEW) : REVIEW;
  fs.mkdirSync(outDir, { recursive: true });
  const composites = [];
  let over = false;

  for (const [id, world] of worlds) {
    const svgs = world.passes();
    const missing = PASSES.filter((pass) => !svgs[pass]);
    if (missing.length) throw new Error(`${id}: missing passes ${missing.join(", ")}`);
    const pngs = {};
    for (const pass of PASSES) pngs[pass] = await render(svgs[pass], RESOLUTION[pass] ?? 1).png().toBuffer();
    // one light for every world: the key wash laid onto the matter of each solid pass (alpha untouched)
    const key = await render(wrap(keyShaft({ opacity: world.keyLight ?? KEY_LIGHT }))).png().toBuffer();
    for (const pass of LIT_PASSES) pngs[pass] = await sharp(pngs[pass]).composite([{ input: key, blend: "atop" }]).png().toBuffer();
    const composite = await stack(PASSES.map((pass) => pngs[pass]));
    composites.push(await onBackdrop(composite));

    if (PREVIEW) {
      await sharp(await onBackdrop(composite)).toFile(path.join(outDir, `${id}.png`));
      console.log(`${id}: preview`);
      continue;
    }

    const dir = path.join(RUNTIME, id);
    fs.mkdirSync(dir, { recursive: true });
    let total = 0;
    const sizes = [];
    for (const pass of PASSES) {
      if (pass === "contact-shadow") continue; // shared by every kit world (below)
      const file = path.join(dir, `${id}-${pass}.webp`);
      await sharp(pngs[pass]).webp(ENCODING[pass] ?? ENCODING.default).toFile(file);
      const { size } = fs.statSync(file);
      total += size;
      sizes.push(`${pass} ${kb(size)}`);
      if (size > BUDGET.pass) {
        over = true;
        console.error(`  ${id}-${pass} is over the pass budget (${kb(size)} > ${kb(BUDGET.pass)})`);
      }
    }
    if (total > BUDGET.world) {
      over = true;
      console.error(`  ${id} is over the world budget (${kb(total)} > ${kb(BUDGET.world)})`);
    }
    console.log(`${id}: ${kb(total)} · ${sizes.join(" · ")}`);
    fs.writeFileSync(path.join(REVIEW, `${id}-passes.webp`), await passSheet(id, pngs));
    await sharp(await onBackdrop(composite)).webp({ quality: 86 }).toFile(path.join(REVIEW, `${id}.webp`));
  }

  // the contact shadow every kit world shares, written once
  if (!PREVIEW) {
    const file = path.join(RUNTIME, SHARED_CONTACT_SHADOW);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await render(contactShadowPass(), RESOLUTION["contact-shadow"]).webp(ENCODING["contact-shadow"]).toFile(file);
    console.log(`shared contact shadow: ${kb(fs.statSync(file).size)}`);
  }

  // the family, with the reference in it: Rota, Circuito, Central, Estúdio, Jardim (the Home's order)
  if (!ONLY) {
    const estudio = await stack(PASSES.map((pass) => fs.readFileSync(path.join(ESTUDIO, `discovery-${pass}.webp`))));
    const byId = Object.fromEntries(worlds.map(([id], i) => [id, composites[i]]));
    const order = [byId.route, byId.circuit, byId.commands, await onBackdrop(estudio), byId.garden].filter(Boolean);
    const sheet = await lineup(order);
    fs.writeFileSync(path.join(outDir, "lineup.webp"), sheet);
    console.log(`lineup: ${path.relative(ROOT, path.join(outDir, "lineup.webp"))}`);
  }
  if (over) process.exit(1);
}

await main();
