import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const homeDir = join(repoRoot, "public", "illustrations", "home");
const dioramaDir = join(homeDir, "dioramas");
const routeDir = join(dioramaDir, "route");
const circuitDir = join(dioramaDir, "circuit");
const reviewDir = join(repoRoot, "docs", "archive", "world-diorama-2_5d-01");
const WIDTH = 1040;
const HEIGHT = 780;

function svgMask(shapes) {
  return Buffer.from(`
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="black"/>
  <g fill="white">${shapes}</g>
</svg>`);
}

function svgAlpha(shapes) {
  return Buffer.from(`
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  ${shapes}
</svg>`);
}

async function layerFromSource(source, output, shapes, options = {}) {
  const image = sharp(source).resize(WIDTH, HEIGHT, { fit: "cover" }).ensureAlpha();
  await image
    .modulate({
      brightness: options.brightness ?? 1,
      saturation: options.saturation ?? 1,
    })
    .composite([{ input: svgMask(shapes), blend: "dest-in" }])
    .webp({ quality: options.quality ?? 82, alphaQuality: 92, effort: 6 })
    .toFile(output);
}

async function layerFromPrepared(prepared, output, shapes, options = {}) {
  await sharp(prepared)
    .ensureAlpha()
    .modulate({
      brightness: options.brightness ?? 1,
      saturation: options.saturation ?? 1,
    })
    .composite([{ input: svgMask(shapes), blend: "dest-in" }])
    .webp({ quality: options.quality ?? 84, alphaQuality: 94, effort: 6 })
    .toFile(output);
}

async function svgLayer(output, shapes, quality = 80) {
  await sharp(svgAlpha(shapes))
    .webp({ quality, alphaQuality: 94, effort: 6 })
    .toFile(output);
}

async function buildCircuitBoardCanvas() {
  const board = await sharp(join(repoRoot, "public", "assets", "memory-circuit", "memory-board-master.png"))
    .resize({ width: 940, height: 752, fit: "contain" })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: board, left: 50, top: 18 }])
    .png()
    .toBuffer();
}

async function buildCircuitOverlayCanvas(file) {
  const overlay = await sharp(join(repoRoot, "public", "assets", "memory-circuit", file))
    .resize({ width: 940, height: 752, fit: "contain" })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: overlay, left: 50, top: 18 }])
    .png()
    .toBuffer();
}

async function createRouteLayers() {
  const source = join(homeDir, "world-route-hero.webp");
  await mkdir(routeDir, { recursive: true });

  await svgLayer(
    join(routeDir, "route-contact-shadow.webp"),
    `<ellipse cx="520" cy="640" rx="390" ry="82" fill="rgba(0,0,0,0.48)"/>
     <ellipse cx="520" cy="610" rx="315" ry="54" fill="rgba(38,24,12,0.36)"/>`,
    78,
  );

  await layerFromSource(
    source,
    join(routeDir, "route-base.webp"),
    `<ellipse cx="518" cy="515" rx="430" ry="225"/>
     <ellipse cx="508" cy="585" rx="360" ry="120"/>`,
    { brightness: 0.96, saturation: 0.96, quality: 72 },
  );
  await layerFromSource(
    source,
    join(routeDir, "route-board.webp"),
    `<ellipse cx="520" cy="450" rx="415" ry="285"/>`,
    { quality: 74 },
  );
  await layerFromSource(
    source,
    join(routeDir, "route-back-props.webp"),
    `<ellipse cx="250" cy="210" rx="190" ry="155"/>
     <ellipse cx="770" cy="210" rx="170" ry="150"/>
     <ellipse cx="520" cy="215" rx="260" ry="130"/>`,
    { brightness: 1.02, saturation: 1.04, quality: 74 },
  );
  await layerFromSource(
    source,
    join(routeDir, "route-portal.webp"),
    `<ellipse cx="774" cy="300" rx="135" ry="130"/>
     <ellipse cx="820" cy="210" rx="100" ry="115"/>`,
    { brightness: 1.05, saturation: 1.08, quality: 76 },
  );
  await layerFromSource(
    source,
    join(routeDir, "route-guardian.webp"),
    `<ellipse cx="500" cy="286" rx="108" ry="130"/>`,
    { quality: 76 },
  );
  await layerFromSource(
    source,
    join(routeDir, "route-explorer.webp"),
    `<ellipse cx="245" cy="560" rx="115" ry="130"/>`,
    { brightness: 1.06, saturation: 1.1, quality: 76 },
  );
  await layerFromSource(
    source,
    join(routeDir, "route-lights.webp"),
    `<circle cx="455" cy="360" r="74"/>
     <circle cx="665" cy="430" r="72"/>
     <circle cx="395" cy="525" r="74"/>
     <circle cx="640" cy="585" r="72"/>`,
    { brightness: 1.14, saturation: 1.12, quality: 74 },
  );
  await layerFromSource(
    source,
    join(routeDir, "route-gameplay-props.webp"),
    `<ellipse cx="375" cy="430" rx="120" ry="118"/>
     <ellipse cx="620" cy="360" rx="120" ry="115"/>
     <ellipse cx="660" cy="510" rx="130" ry="110"/>`,
    { quality: 74 },
  );
  await layerFromSource(
    source,
    join(routeDir, "route-front-foliage.webp"),
    `<ellipse cx="210" cy="650" rx="210" ry="100"/>
     <ellipse cx="790" cy="650" rx="235" ry="105"/>
     <ellipse cx="520" cy="710" rx="420" ry="82"/>`,
    { brightness: 0.98, saturation: 1.08, quality: 72 },
  );
}

async function createCircuitLayers() {
  const source = join(homeDir, "world-circuit-hero.webp");
  const boardCanvas = await buildCircuitBoardCanvas();
  const coreCanvas = await buildCircuitOverlayCanvas("overlay-core-pulse.png");
  const flame = await buildCircuitOverlayCanvas("overlay-flame-active.png");
  const wave = await buildCircuitOverlayCanvas("overlay-wave-active.png");
  const leaf = await buildCircuitOverlayCanvas("overlay-leaf-active.png");
  const sun = await buildCircuitOverlayCanvas("overlay-sun-active.png");

  await mkdir(circuitDir, { recursive: true });

  await svgLayer(
    join(circuitDir, "circuit-contact-shadow.webp"),
    `<ellipse cx="520" cy="636" rx="375" ry="78" fill="rgba(0,0,0,0.42)"/>
     <ellipse cx="520" cy="594" rx="300" ry="50" fill="rgba(66,40,16,0.34)"/>`,
    78,
  );
  await layerFromSource(
    source,
    join(circuitDir, "circuit-back-props.webp"),
    `<ellipse cx="220" cy="220" rx="190" ry="160"/>
     <ellipse cx="820" cy="218" rx="210" ry="170"/>`,
    { brightness: 1.02, saturation: 0.98, quality: 80 },
  );
  await layerFromSource(
    source,
    join(circuitDir, "circuit-front-props.webp"),
    `<ellipse cx="170" cy="660" rx="210" ry="100"/>
     <ellipse cx="860" cy="660" rx="225" ry="110"/>`,
    { brightness: 0.95, saturation: 1.02, quality: 78 },
  );
  await layerFromPrepared(
    boardCanvas,
    join(circuitDir, "circuit-base.webp"),
    `<ellipse cx="520" cy="440" rx="400" ry="300"/>`,
    { brightness: 0.92, saturation: 0.92, quality: 78 },
  );
  await layerFromPrepared(
    boardCanvas,
    join(circuitDir, "circuit-board.webp"),
    `<ellipse cx="520" cy="420" rx="385" ry="300"/>`,
    { quality: 86 },
  );
  await layerFromPrepared(
    boardCanvas,
    join(circuitDir, "circuit-pads.webp"),
    `<circle cx="520" cy="190" r="125"/>
     <circle cx="735" cy="420" r="125"/>
     <circle cx="304" cy="420" r="125"/>
     <circle cx="520" cy="642" r="125"/>`,
    { brightness: 1.03, saturation: 1.06, quality: 86 },
  );
  await sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: flame, left: 0, top: 0, blend: "over", opacity: 0.42 },
      { input: wave, left: 0, top: 0, blend: "over", opacity: 0.42 },
      { input: leaf, left: 0, top: 0, blend: "over", opacity: 0.42 },
      { input: sun, left: 0, top: 0, blend: "over", opacity: 0.42 },
    ])
    .webp({ quality: 84, alphaQuality: 94, effort: 6 })
    .toFile(join(circuitDir, "circuit-energy.webp"));
  await layerFromPrepared(
    coreCanvas,
    join(circuitDir, "circuit-core.webp"),
    `<circle cx="520" cy="420" r="150"/>`,
    { brightness: 1.04, saturation: 1.06, quality: 86 },
  );
}

async function compositeReview(world, dir, files, output) {
  const composites = files.map((file) => ({
    input: join(dir, file),
    left: 0,
    top: 0,
  }));

  const label = Buffer.from(`
<svg width="${WIDTH}" height="${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect x="18" y="18" width="440" height="64" rx="18" fill="rgba(8,12,11,0.78)" stroke="#d6aa52"/>
  <text x="42" y="58" fill="#fff4d6" font-family="Georgia,serif" font-size="30" font-weight="700">${world} composite</text>
</svg>`);

  await sharp({
    create: {
      width: WIDTH,
      height: HEIGHT,
      channels: 4,
      background: { r: 9, g: 14, b: 12, alpha: 1 },
    },
  })
    .composite([...composites, { input: label, left: 0, top: 0 }])
    .png({ compressionLevel: 9 })
    .toFile(output);
}

async function layerReview(world, dir, files, output) {
  const tileWidth = 330;
  const tileHeight = 248;
  const reviewWidth = tileWidth * 3 + 64;
  const reviewHeight = Math.ceil(files.length / 3) * tileHeight + 116;
  const composites = [];

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const column = index % 3;
    const row = Math.floor(index / 3);
    const left = 24 + column * tileWidth;
    const top = 82 + row * tileHeight;
    const asset = await sharp(join(dir, file))
      .resize({ width: 292, height: 178, fit: "contain" })
      .png()
      .toBuffer();
    const tile = Buffer.from(`
<svg width="${tileWidth - 18}" height="${tileHeight - 18}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" rx="22" fill="#121915" stroke="#8d6b32"/>
  <text x="18" y="32" fill="#fff4d6" font-family="Arial,sans-serif" font-size="16" font-weight="800">${file}</text>
</svg>`);
    composites.push({ input: tile, left, top });
    composites.push({ input: asset, left: left + 10, top: top + 46 });
  }

  const header = Buffer.from(`
<svg width="${reviewWidth}" height="${reviewHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#090e0c"/>
  <text x="24" y="48" fill="#fff4d6" font-family="Georgia,serif" font-size="30" font-weight="700">${world} layers</text>
</svg>`);

  await sharp(header).composite(composites).png({ compressionLevel: 9 }).toFile(output);
}

async function writeReviews() {
  await mkdir(reviewDir, { recursive: true });
  const routeFiles = [
    "route-contact-shadow.webp",
    "route-base.webp",
    "route-back-props.webp",
    "route-board.webp",
    "route-gameplay-props.webp",
    "route-portal.webp",
    "route-lights.webp",
    "route-guardian.webp",
    "route-explorer.webp",
    "route-front-foliage.webp",
  ];
  const circuitFiles = [
    "circuit-contact-shadow.webp",
    "circuit-back-props.webp",
    "circuit-base.webp",
    "circuit-board.webp",
    "circuit-pads.webp",
    "circuit-energy.webp",
    "circuit-core.webp",
    "circuit-front-props.webp",
  ];

  await compositeReview("Route", routeDir, routeFiles, join(reviewDir, "route-composite-review.png"));
  await layerReview("Route", routeDir, routeFiles, join(reviewDir, "route-layers-review.png"));
  await compositeReview("Circuit", circuitDir, circuitFiles, join(reviewDir, "circuit-composite-review.png"));
  await layerReview("Circuit", circuitDir, circuitFiles, join(reviewDir, "circuit-layers-review.png"));

  await writeFile(
    join(reviewDir, "README.md"),
    `# WORLD-DIORAMA-2_5D-01 review\n\nReview-only sheets for the Home hero-world modular diorama pass.\n\nRuntime assets live in:\n\n- \`public/illustrations/home/dioramas/route/\`\n- \`public/illustrations/home/dioramas/circuit/\`\n\nThe flat hero renders \`world-route-hero.webp\` and \`world-circuit-hero.webp\` remain as documented fallback/source history. The active Home and entry transition use DOM-layered diorama components for Route and Circuit.\n\nRegenerate assets and sheets with:\n\n\`\`\`powershell\nnode tools/assets/create_world_diorama_layers.mjs\n\`\`\`\n\nEach world uses one shared 1040x780 coordinate system so layers align pixel-for-pixel in Home and transition.\n`,
    "utf8",
  );
}

async function reportSizes() {
  const all = [
    ...["route-contact-shadow.webp", "route-base.webp", "route-back-props.webp", "route-board.webp", "route-gameplay-props.webp", "route-portal.webp", "route-lights.webp", "route-guardian.webp", "route-explorer.webp", "route-front-foliage.webp"].map((file) => join(routeDir, file)),
    ...["circuit-contact-shadow.webp", "circuit-back-props.webp", "circuit-base.webp", "circuit-board.webp", "circuit-pads.webp", "circuit-energy.webp", "circuit-core.webp", "circuit-front-props.webp"].map((file) => join(circuitDir, file)),
    ...["route-layers-review.png", "route-composite-review.png", "circuit-layers-review.png", "circuit-composite-review.png"].map((file) => join(reviewDir, file)),
  ];

  for (const file of all) {
    const size = (await stat(file)).size;
    console.log(`${file.replace(repoRoot + "\\", "")} ${size} bytes`);
  }
}

await createRouteLayers();
await createCircuitLayers();
await writeReviews();
await reportSizes();
