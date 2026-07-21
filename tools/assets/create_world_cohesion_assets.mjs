import { mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const homeDir = join(repoRoot, "public", "illustrations", "home");
const worldsDir = join(repoRoot, "public", "illustrations", "worlds");
const reviewDir = join(repoRoot, "docs", "archive", "world-cohesion-01");

const runtimeAssets = [
  {
    source: join(worldsDir, "route-diorama.webp"),
    output: join(homeDir, "world-route-hero.webp"),
  },
  {
    source: join(worldsDir, "memory-diorama.webp"),
    output: join(homeDir, "world-circuit-hero.webp"),
  },
];

await mkdir(homeDir, { recursive: true });
await mkdir(reviewDir, { recursive: true });

for (const asset of runtimeAssets) {
  await sharp(asset.source)
    .resize({ width: 1040, height: 780, fit: "cover" })
    .webp({ quality: 78, effort: 6, smartSubsample: true })
    .toFile(asset.output);
}

const route = await sharp(runtimeAssets[0].output)
  .resize({ width: 820, height: 615, fit: "cover" })
  .toBuffer();
const memory = await sharp(runtimeAssets[1].output)
  .resize({ width: 820, height: 615, fit: "cover" })
  .toBuffer();

const labels = Buffer.from(`
  <svg width="1800" height="1040" xmlns="http://www.w3.org/2000/svg">
    <style>
      .title { fill: #fff4d6; font: 700 42px Georgia, serif; }
      .label { fill: #fff8e6; font: 700 30px Arial, sans-serif; }
      .copy { fill: #c8d9d2; font: 500 21px Arial, sans-serif; }
    </style>
    <rect width="1800" height="1040" fill="#0c1412"/>
    <text x="60" y="66" class="title">WORLD-COHESION-01 — Primary worlds</text>
    <rect x="48" y="104" width="844" height="730" rx="32" fill="#15211d" stroke="#4ec7b5" stroke-width="3"/>
    <rect x="908" y="104" width="844" height="730" rx="32" fill="#211b13" stroke="#d6aa52" stroke-width="3"/>
    <text x="72" y="884" class="label">Rota Estrategica</text>
    <text x="72" y="924" class="copy">Portal teal, tabuleiro fisico e leitura de caminho.</text>
    <text x="932" y="884" class="label">Circuito de Memoria</text>
    <text x="932" y="924" class="copy">Nucleo luminoso e quatro pads conectados.</text>
    <text x="60" y="1000" class="copy">Review-only sheet. Runtime assets stay in public/illustrations/home.</text>
  </svg>
`);

await sharp({
  create: { width: 1800, height: 1040, channels: 4, background: "#0c1412" },
})
  .composite([
    { input: labels, left: 0, top: 0 },
    { input: route, left: 60, top: 116 },
    { input: memory, left: 920, top: 116 },
  ])
  .png({ compressionLevel: 9 })
  .toFile(join(reviewDir, "world-cohesion-review.png"));

for (const asset of runtimeAssets) {
  const info = await stat(asset.output);
  console.log(`${asset.output}: ${info.size} bytes`);
}
