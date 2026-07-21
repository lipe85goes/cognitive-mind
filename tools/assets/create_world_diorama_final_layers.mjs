import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const runtimeRoot = join(repoRoot, "public", "illustrations", "home", "dioramas");
const reviewRoot = join(repoRoot, "docs", "archive", "world-diorama-2_5d-02");
const rawRoot = join(reviewRoot, "raw");

const WIDTH = 1040;
const HEIGHT = 780;

const WORLDS = {
  route: {
    title: "Rota Estrategica",
    layers: [
      "route-contact-shadow",
      "route-base",
      "route-back-environment",
      "route-board",
      "route-walls",
      "route-gameplay-props",
      "route-portal",
      "route-guardian",
      "route-explorer",
      "route-lights",
      "route-front-environment",
      "route-energy",
    ],
    quality: 82,
  },
  circuit: {
    title: "Circuito de Memoria",
    layers: [
      "circuit-contact-shadow",
      "circuit-base",
      "circuit-back-environment",
      "circuit-board",
      "circuit-pads",
      "circuit-core",
      "circuit-energy",
      "circuit-front-environment",
    ],
    quality: 84,
  },
};

function checkerSvg(width, height) {
  return Buffer.from(`
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <pattern id="checker" width="32" height="32" patternUnits="userSpaceOnUse">
      <rect width="16" height="16" fill="#1f1a16"/>
      <rect x="16" y="16" width="16" height="16" fill="#1f1a16"/>
      <rect x="16" width="16" height="16" fill="#2a231d"/>
      <rect y="16" width="16" height="16" fill="#2a231d"/>
    </pattern>
    <radialGradient id="glow" cx="50%" cy="42%" r="74%">
      <stop offset="0" stop-color="#5fd7c8" stop-opacity="0.18"/>
      <stop offset="0.56" stop-color="#f0b54c" stop-opacity="0.08"/>
      <stop offset="1" stop-color="#070504" stop-opacity="0.9"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#checker)"/>
  <rect width="100%" height="100%" fill="url(#glow)"/>
</svg>`);
}

function labelSvg(width, height, text, subtext = "") {
  const safeText = text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  const safeSubtext = subtext.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
  return Buffer.from(`
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${width}" height="${height}" rx="18" fill="rgba(10,7,5,0.72)" stroke="rgba(232,183,85,0.48)" stroke-width="2"/>
  <text x="24" y="38" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#f8ead0">${safeText}</text>
  ${
    safeSubtext
      ? `<text x="24" y="66" font-family="Arial, sans-serif" font-size="15" font-weight="600" fill="#d7c19b">${safeSubtext}</text>`
      : ""
  }
</svg>`);
}

function backgroundSvg(title) {
  return Buffer.from(`
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="stage" cx="50%" cy="44%" r="78%">
      <stop offset="0" stop-color="#49311d"/>
      <stop offset="0.44" stop-color="#241711"/>
      <stop offset="1" stop-color="#080504"/>
    </radialGradient>
    <linearGradient id="top" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="#173631" stop-opacity="0.32"/>
      <stop offset="1" stop-color="#d49b45" stop-opacity="0.16"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#stage)"/>
  <rect width="100%" height="100%" fill="url(#top)"/>
  <text x="32" y="54" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="#f8ead0">${title}</text>
</svg>`);
}

async function assertRawLayer(world, layer) {
  const path = join(rawRoot, world, `${layer}.png`);
  await stat(path);
  return path;
}

async function convertWorld(worldKey, world) {
  const runtimeDir = join(runtimeRoot, worldKey);
  await mkdir(runtimeDir, { recursive: true });

  const outputs = [];
  for (const layer of world.layers) {
    const rawPath = await assertRawLayer(worldKey, layer);
    const outputPath = join(runtimeDir, `${layer}.webp`);
    const quality = layer.includes("contact-shadow") ? 70 : world.quality;

    await sharp(rawPath)
      .resize(WIDTH, HEIGHT, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .webp({ quality, alphaQuality: 94, effort: 6 })
      .toFile(outputPath);

    const { size } = await stat(outputPath);
    outputs.push({ layer, path: outputPath, size });
  }

  return outputs;
}

async function createComposite(worldKey, world, outputName, depth = false) {
  const composites = [];
  const layers = world.layers;
  for (let index = 0; index < layers.length; index += 1) {
    const layer = layers[index];
    const input = join(rawRoot, worldKey, `${layer}.png`);
    const offset = depth ? index - Math.floor(layers.length / 2) : 0;
    composites.push({
      input,
      left: depth ? 34 + offset * 5 : 0,
      top: depth ? 26 - offset * 4 : 0,
    });
  }

  const label = labelSvg(
    390,
    78,
    depth ? `${world.title} depth test` : `${world.title} final composite`,
    depth ? "Small layer offsets reveal holes/fringes." : "Stacked from independent render passes.",
  );

  await sharp(backgroundSvg(world.title))
    .composite([...composites, { input: label, left: 24, top: HEIGHT - 104 }])
    .png({ compressionLevel: 9 })
    .toFile(join(reviewRoot, outputName));
}

async function createLayerGrid(worldKey, world, outputName) {
  const columns = 4;
  const tileW = 300;
  const tileH = 248;
  const gap = 16;
  const labelH = 42;
  const rows = Math.ceil(world.layers.length / columns);
  const width = columns * tileW + (columns + 1) * gap;
  const height = rows * tileH + (rows + 1) * gap;

  const composites = [];
  for (let index = 0; index < world.layers.length; index += 1) {
    const layer = world.layers[index];
    const x = gap + (index % columns) * (tileW + gap);
    const y = gap + Math.floor(index / columns) * (tileH + gap);
    const layerThumb = await sharp(checkerSvg(tileW, tileH))
      .composite([
        {
          input: await sharp(join(rawRoot, worldKey, `${layer}.png`))
            .resize(tileW, tileH - labelH, { fit: "contain" })
            .png()
            .toBuffer(),
          left: 0,
          top: 0,
        },
        {
          input: labelSvg(tileW, labelH, layer),
          left: 0,
          top: tileH - labelH,
        },
      ])
      .png()
      .toBuffer();

    composites.push({ input: layerThumb, left: x, top: y });
  }

  await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 12, g: 9, b: 7, alpha: 1 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9 })
    .toFile(join(reviewRoot, outputName));
}

async function createSideBySide() {
  const route = await sharp(join(reviewRoot, "route-final-composite.png"))
    .resize(780, 585, { fit: "contain" })
    .png()
    .toBuffer();
  const circuit = await sharp(join(reviewRoot, "circuit-final-composite.png"))
    .resize(780, 585, { fit: "contain" })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: 1640,
      height: 720,
      channels: 4,
      background: { r: 10, g: 7, b: 5, alpha: 1 },
    },
  })
    .composite([
      { input: labelSvg(760, 70, "Route / Circuit cohesion", "Same canvas, camera family, warm light and MindFlow materials."), left: 40, top: 28 },
      { input: route, left: 40, top: 112 },
      { input: circuit, left: 820, top: 112 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(join(reviewRoot, "route-circuit-side-by-side.png"));
}

function formatBytes(size) {
  const kb = size / 1024;
  return `${kb.toFixed(1)} KB`;
}

async function writeReadme(results) {
  const lines = [
    "# WORLD-DIORAMA-2_5D-02 review",
    "",
    "Review-only material for the independent-render Home diorama pass.",
    "",
    "The V01 layers were technically useful, but they were mask/crop-derived from flattened hero images. V02 replaces the active Route and Circuit hero layers with transparent render passes generated from Blender scenes and real scene objects.",
    "",
    "Runtime WebP assets live in:",
    "",
    "- `public/illustrations/home/dioramas/route/`",
    "- `public/illustrations/home/dioramas/circuit/`",
    "",
    "Raw transparent PNG render passes live here only for review:",
    "",
    "- `docs/archive/world-diorama-2_5d-02/raw/route/`",
    "- `docs/archive/world-diorama-2_5d-02/raw/circuit/`",
    "",
    "## Generation",
    "",
    "```powershell",
    "& \"C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe\" --background --python tools\\blender\\create_route_home_diorama.py",
    "& \"C:\\Program Files\\Blender Foundation\\Blender 5.1\\blender.exe\" --background --python tools\\blender\\create_memory_circuit_home_diorama.py",
    "node tools/assets/create_world_diorama_final_layers.mjs",
    "```",
    "",
    "## Shared render contract",
    "",
    "- Canvas: 1040x780.",
    "- Camera: orthographic 2.5D, warm front-left key, warm rim and subtle teal fill.",
    "- Runtime: HTML/CSS/Next Image only; no canvas, no RAF, no Three/R3F/Babylon in Home.",
    "- Motion states remain CSS transform/opacity and are disabled under reduced motion.",
    "",
    "## Runtime layer sizes",
    "",
  ];

  for (const [worldKey, outputs] of Object.entries(results)) {
    const total = outputs.reduce((sum, item) => sum + item.size, 0);
    lines.push(`### ${worldKey}`);
    lines.push("");
    lines.push(`Total: ${formatBytes(total)}`);
    lines.push("");
    lines.push("| Layer | Size |");
    lines.push("| --- | ---: |");
    for (const item of outputs) {
      lines.push(`| \`${item.layer}.webp\` | ${formatBytes(item.size)} |`);
    }
    lines.push("");
  }

  lines.push("## Review sheets");
  lines.push("");
  lines.push("- `route-layer-grid.png`");
  lines.push("- `route-final-composite.png`");
  lines.push("- `route-depth-test.png`");
  lines.push("- `circuit-layer-grid.png`");
  lines.push("- `circuit-final-composite.png`");
  lines.push("- `circuit-depth-test.png`");
  lines.push("- `route-circuit-side-by-side.png`");
  lines.push("");
  lines.push("## Human review notes");
  lines.push("");
  lines.push("- Check that small depth offsets do not reveal holes around characters, portal, pads, core or front environment.");
  lines.push("- Check whether Route and Circuit now read as objects from the same MindFlow universe.");
  lines.push("- If final art direction needs more fidelity, replace Blender primitives/GLBs with final authored assets without changing the DOM layer contract.");
  lines.push("");

  await writeFile(join(reviewRoot, "README.md"), `${lines.join("\n")}\n`);
}

async function main() {
  await mkdir(reviewRoot, { recursive: true });

  const results = {};
  for (const [worldKey, world] of Object.entries(WORLDS)) {
    results[worldKey] = await convertWorld(worldKey, world);
    await createLayerGrid(worldKey, world, `${worldKey}-layer-grid.png`);
    await createComposite(worldKey, world, `${worldKey}-final-composite.png`, false);
    await createComposite(worldKey, world, `${worldKey}-depth-test.png`, true);
  }

  await createSideBySide();
  await writeReadme(results);

  for (const [worldKey, outputs] of Object.entries(results)) {
    const total = outputs.reduce((sum, item) => sum + item.size, 0);
    console.log(`${worldKey}: ${formatBytes(total)}`);
    for (const item of outputs) {
      console.log(`  ${item.layer}.webp ${formatBytes(item.size)}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
