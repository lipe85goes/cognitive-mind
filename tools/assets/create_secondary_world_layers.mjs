/**
 * Encode the secondary-world diorama passes into runtime WebP layers.
 *
 * Source: docs/archive/home-worlds-final-01/raw/<world>/*.png (Blender)
 * Output: public/illustrations/home/dioramas/<world>/*.webp
 *
 * Also writes a review sheet per world plus a lineup, so the Home gallery can
 * be judged as a family before it is wired into the runtime.
 */
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const RAW = path.join(ROOT, "docs", "archive", "home-worlds-final-01", "raw");
const RUNTIME = path.join(ROOT, "public", "illustrations", "home", "dioramas");
const REVIEW = path.join(ROOT, "docs", "archive", "home-worlds-final-01");

const WIDTH = 1040;
const HEIGHT = 780;

const WORLDS = {
  panel: { title: "Central de Comandos", quality: 82 },
  trail: { title: "Trilha Logica", quality: 82 },
  garden: { title: "Jardim de Sementes", quality: 82 },
};

function plate(title, subtitle, width, height = 88) {
  return Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" rx="20" fill="#102523"/>
    <rect x="1.5" y="1.5" width="${width - 3}" height="${height - 3}" rx="18" fill="none" stroke="#a9793e" stroke-width="3"/>
    <text x="28" y="38" fill="#fff0c8" font-family="Georgia, serif" font-size="25" font-weight="700">${title}</text>
    <text x="28" y="66" fill="#a8c6bf" font-family="Arial" font-size="15">${subtitle}</text>
  </svg>`);
}

function label(text, width, height = 44) {
  return Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="100%" height="100%" rx="12" fill="#0a1c1a" fill-opacity=".96"/>
    <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="11" fill="none" stroke="#bd8a48" stroke-width="2"/>
    <text x="${width / 2}" y="${height / 2 + 6}" text-anchor="middle" fill="#fff0c8" font-family="Arial" font-size="16" font-weight="700">${text}</text>
  </svg>`);
}

const canvas = (w, h) =>
  sharp({ create: { width: w, height: h, channels: 4, background: { r: 8, g: 22, b: 20, alpha: 1 } } });

async function encodeWorld(world, config) {
  const rawDir = path.join(RAW, world);
  const outDir = path.join(RUNTIME, world);
  await mkdir(outDir, { recursive: true });

  const files = (await readdir(rawDir)).filter((f) => f.endsWith(".png")).sort();
  const layers = [];
  for (const file of files) {
    const name = file.replace(/\.png$/, "");
    const out = path.join(outDir, `${name}.webp`);
    const quality = name.includes("contact-shadow") ? 68 : config.quality;
    await sharp(path.join(rawDir, file))
      .resize(WIDTH, HEIGHT, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .webp({ quality, alphaQuality: 94, effort: 6 })
      .toFile(out);
    const { size } = await stat(out);
    layers.push({ name, size });
  }
  return layers;
}

async function compositeWorld(world) {
  const rawDir = path.join(RAW, world);
  const files = (await readdir(rawDir)).filter((f) => f.endsWith(".png"));
  // Stack in the runtime paint order, not alphabetical.
  const order = ["contact-shadow", "base", "back", "main", "detail", "energy", "front"];
  const ordered = order
    .map((suffix) => files.find((f) => f === `${world}-${suffix}.png`))
    .filter(Boolean)
    .map((f) => ({ input: path.join(rawDir, f) }));

  const bg = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
    <defs>
      <radialGradient id="s" cx="50%" cy="46%" r="76%">
        <stop offset="0" stop-color="#3d2a1a"/>
        <stop offset="0.5" stop-color="#1d1610"/>
        <stop offset="1" stop-color="#080604"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#s)"/>
  </svg>`);

  return sharp(bg).composite(ordered).png({ compressionLevel: 9 }).toBuffer();
}

async function main() {
  const results = {};
  const composites = {};

  for (const [world, config] of Object.entries(WORLDS)) {
    results[world] = await encodeWorld(world, config);
    composites[world] = await compositeWorld(world);

    const layerTiles = [];
    const files = results[world];
    const cols = 4;
    const tileW = 300;
    const tileH = 232;
    for (let i = 0; i < files.length; i += 1) {
      const raw = path.join(RAW, world, `${files[i].name}.png`);
      const thumb = await sharp(raw).resize(tileW, tileH - 38, { fit: "contain" }).png().toBuffer();
      layerTiles.push(
        { input: thumb, left: 24 + (i % cols) * (tileW + 14), top: 130 + Math.floor(i / cols) * (tileH + 14) },
        {
          input: label(files[i].name.replace(`${world}-`, ""), tileW, 34),
          left: 24 + (i % cols) * (tileW + 14),
          top: 130 + Math.floor(i / cols) * (tileH + 14) + tileH - 34,
        },
      );
    }

    const sheetH = 130 + Math.ceil(files.length / cols) * (tileH + 14) + 24;
    const sheet = await canvas(cols * (tileW + 14) + 34, sheetH)
      .composite([
        { input: plate(`${config.title} — passes`, "Camadas independentes, mesma camera e mesma luz.", cols * (tileW + 14) - 14), left: 24, top: 24 },
        ...layerTiles,
      ])
      .png({ compressionLevel: 9 })
      .toFile(path.join(REVIEW, `world-${world}-layers.png`));
    void sheet;
  }

  // Lineup: the three secondary worlds side by side.
  const lineup = [];
  const w = 500;
  const h = 375;
  let i = 0;
  for (const [world, config] of Object.entries(WORLDS)) {
    const img = await sharp(composites[world]).resize(w, h).png().toBuffer();
    lineup.push(
      { input: img, left: 24 + i * (w + 16), top: 130 },
      { input: label(config.title, w), left: 24 + i * (w + 16), top: 130 + h + 10 },
    );
    i += 1;
  }
  await canvas(24 * 2 + 3 * w + 32, 130 + h + 80)
    .composite([
      { input: plate("Mundos secundarios — maquetes 2.5D", "Mesma familia de material, camera e luz dos mundos-heroi.", 3 * w + 32 - 14), left: 24, top: 24 },
      ...lineup,
    ])
    .png({ compressionLevel: 9 })
    .toFile(path.join(REVIEW, "secondary-worlds-lineup.png"));

  for (const [world, layers] of Object.entries(results)) {
    const total = layers.reduce((sum, l) => sum + l.size, 0);
    console.log(`${world}: ${(total / 1024).toFixed(1)} KB`);
    for (const l of layers) console.log(`  ${l.name}.webp ${(l.size / 1024).toFixed(1)} KB`);
  }

  await writeFile(
    path.join(REVIEW, "asset-weights.json"),
    JSON.stringify(results, null, 2),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
