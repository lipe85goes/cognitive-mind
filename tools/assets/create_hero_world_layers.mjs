/**
 * Encode the hero-world diorama passes into runtime WebP layers.
 *
 * Source: docs/archive/home-hero-worlds-3d-01/raw/<world>/*.png (Blender)
 * Output: public/illustrations/home/dioramas/<world>-world/*.webp
 *
 * New folders (`route-world`, `circuit-world`) instead of overwriting the old
 * kits, so fresh URLs guarantee the image optimizer cannot serve a stale
 * variant.
 *
 * MINDFLOW-CLEANUP-03C: this note used to add that "the previous route layers
 * still feed the game-facing master scene". That stopped being true when
 * HOME-HERO-WORLDS-3D-01 pointed the master scene at these layers —
 * `worldMasterSceneConfig.ts` derives `essentialAssets` from
 * `WORLD_DIORAMA_CONFIGS`, which for both heroes resolves to `<world>-world`.
 * The old `dioramas/route` and `dioramas/circuit` kits have been removed.
 *
 * Also asserts the silhouette guard that this mission exists to fix: every
 * pass must keep a real transparent margin on all four sides, so no world ends
 * on the last pixel row again.
 */
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RAW = path.join(ROOT, "docs", "archive", "home-hero-worlds-3d-01", "raw");
const RUNTIME = path.join(ROOT, "public", "illustrations", "home", "dioramas");
const REVIEW = path.join(ROOT, "docs", "archive", "home-hero-worlds-3d-01");

const WIDTH = 1120;
const HEIGHT = 840;
const MIN_MARGIN_PX = 4;

const WORLDS = {
  route: { title: "Rota Estrategica", quality: 82 },
  circuit: { title: "Circuito de Memoria", quality: 82 },
};

const ORDER = [
  "shadow",
  "base",
  "terrain",
  "structure",
  "props",
  "characters",
  "energy",
  "front",
];

function plate(title, subtitle, width, height = 88) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<rect width="100%" height="100%" rx="20" fill="#102523"/>` +
      `<rect x="1.5" y="1.5" width="${width - 3}" height="${height - 3}" rx="18" fill="none" stroke="#a9793e" stroke-width="3"/>` +
      `<text x="28" y="38" fill="#fff0c8" font-family="Georgia, serif" font-size="25" font-weight="700">${title}</text>` +
      `<text x="28" y="66" fill="#a8c6bf" font-family="Arial" font-size="15">${subtitle}</text></svg>`,
  );
}

function label(text, width, height = 40) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<rect width="100%" height="100%" rx="11" fill="#0a1c1a" fill-opacity=".96"/>` +
      `<rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="10" fill="none" stroke="#bd8a48" stroke-width="2"/>` +
      `<text x="${width / 2}" y="${height / 2 + 6}" text-anchor="middle" fill="#fff0c8" font-family="Arial" font-size="15" font-weight="700">${text}</text></svg>`,
  );
}

const canvas = (w, h) =>
  sharp({ create: { width: w, height: h, channels: 4, background: { r: 8, g: 22, b: 20, alpha: 1 } } });

/** Alpha bounding box, so the crop guard is measured and not assumed. */
async function alphaBox(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let top = info.height;
  let bottom = -1;
  let left = info.width;
  let right = -1;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      if (data[(y * info.width + x) * info.channels + 3] > 8) {
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  return {
    top,
    bottom,
    left,
    right,
    margins: {
      top,
      bottom: info.height - 1 - bottom,
      left,
      right: info.width - 1 - right,
    },
    empty: bottom < 0,
  };
}

async function encodeWorld(world, config) {
  const rawDir = path.join(RAW, world);
  const outDir = path.join(RUNTIME, `${world}-world`);
  await mkdir(outDir, { recursive: true });

  const files = (await readdir(rawDir)).filter((f) => f.endsWith(".png"));
  const layers = [];
  const warnings = [];

  for (const suffix of ORDER) {
    const file = `${world}-${suffix}.png`;
    if (!files.includes(file)) continue;
    const source = path.join(rawDir, file);
    const out = path.join(outDir, `${world}-${suffix}.webp`);
    const quality = suffix === "shadow" ? 68 : config.quality;

    await sharp(source)
      .ensureAlpha()
      .webp({ quality, alphaQuality: 94, effort: 6 })
      .toFile(out);

    const { size } = await stat(out);
    const box = await alphaBox(source);
    if (!box.empty) {
      for (const [side, value] of Object.entries(box.margins)) {
        if (value < MIN_MARGIN_PX) {
          warnings.push(`${file}: ${side} margin ${value}px (< ${MIN_MARGIN_PX})`);
        }
      }
    }
    layers.push({ layer: `${world}-${suffix}`, size, margins: box.margins });
  }

  return { layers, warnings };
}

async function composite(world) {
  const rawDir = path.join(RAW, world);
  const files = (await readdir(rawDir)).filter((f) => f.endsWith(".png"));
  const ordered = ORDER.map((s) => `${world}-${s}.png`)
    .filter((f) => files.includes(f))
    .map((f) => ({ input: path.join(rawDir, f) }));

  const backdrop = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">` +
      `<defs><radialGradient id="s" cx="50%" cy="46%" r="76%">` +
      `<stop offset="0" stop-color="#3d2a1a"/><stop offset="0.5" stop-color="#1d1610"/>` +
      `<stop offset="1" stop-color="#080604"/></radialGradient></defs>` +
      `<rect width="100%" height="100%" fill="url(#s)"/></svg>`,
  );

  return sharp(backdrop).composite(ordered).png({ compressionLevel: 9 }).toBuffer();
}

async function layerSheet(world, config, layers) {
  const cols = 4;
  const tileW = 300;
  const tileH = 240;
  const items = [];
  for (let i = 0; i < layers.length; i += 1) {
    const suffix = layers[i].layer.replace(`${world}-`, "");
    const thumb = await sharp(path.join(RAW, world, `${layers[i].layer}.png`))
      .resize(tileW, tileH - 40, { fit: "contain" })
      .png()
      .toBuffer();
    const x = 24 + (i % cols) * (tileW + 14);
    const y = 130 + Math.floor(i / cols) * (tileH + 14);
    items.push({ input: thumb, left: x, top: y }, { input: label(suffix, tileW), left: x, top: y + tileH - 40 });
  }
  const height = 130 + Math.ceil(layers.length / cols) * (tileH + 14) + 24;
  await canvas(cols * (tileW + 14) + 34, height)
    .composite([
      { input: plate(`${config.title} — camadas`, "Passes independentes: mesma camera, mesma luz, alpha real.", cols * (tileW + 14) - 14), left: 24, top: 24 },
      ...items,
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(REVIEW, `${world}-world-layers.png`));
}

async function main() {
  await mkdir(REVIEW, { recursive: true });

  // MINDFLOW-HOME-VISUAL-04: encode one world instead of both, with
  //   node tools/assets/create_hero_world_layers.mjs --world route
  // Re-encoding a world whose passes did not change would rewrite its runtime
  // WebPs and its review sheet for nothing, and turn "the other world is
  // untouched" into a claim instead of a fact.
  const flagIndex = process.argv.indexOf("--world");
  const requested = flagIndex >= 0 ? process.argv[flagIndex + 1] : null;
  if (requested !== null && !(requested in WORLDS)) {
    console.error(`unknown world ${requested}; expected one of ${Object.keys(WORLDS).join(", ")}`);
    process.exit(2);
  }
  const selected = Object.entries(WORLDS).filter(([world]) => requested === null || world === requested);

  // The weights report covers both worlds, so a partial run must merge into the
  // existing file rather than drop the world it did not touch.
  let report = {};
  if (requested !== null) {
    try {
      report = JSON.parse(await readFile(path.join(REVIEW, "hero-asset-weights.json"), "utf8"));
    } catch {
      report = {};
    }
  }
  const allWarnings = [];

  for (const [world, config] of selected) {
    const { layers, warnings } = await encodeWorld(world, config);
    report[world] = layers;
    allWarnings.push(...warnings);
    await layerSheet(world, config, layers);

    const flat = await composite(world);
    await sharp(flat).toFile(path.join(REVIEW, `${world}-world-composite.png`));

    const total = layers.reduce((sum, l) => sum + l.size, 0);
    console.log(`${world}: ${(total / 1024).toFixed(1)} KB in ${layers.length} layers`);
    for (const l of layers) {
      console.log(
        `  ${l.layer}.webp ${(l.size / 1024).toFixed(1)} KB  margins ` +
          `t${l.margins.top} b${l.margins.bottom} l${l.margins.left} r${l.margins.right}`,
      );
    }
  }

  await writeFile(path.join(REVIEW, "hero-asset-weights.json"), JSON.stringify(report, null, 2));

  if (allWarnings.length) {
    console.log("\nSILHOUETTE WARNINGS (asset touches the frame edge):");
    for (const w of allWarnings) console.log(`  ${w}`);
    process.exitCode = 1;
  } else {
    console.log("\nSilhouette guard OK: every pass keeps a transparent margin.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
