import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { DEFS as ATELIER_DEFS } from "./home-atelier-kit.mjs";
import { MINIATURE_DEFS, explorerMiniature, explorerRing } from "./home-atelier-worlds.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "..", "..");
const publicHomeDir = join(repoRoot, "public", "illustrations", "home");
const archiveDir = join(repoRoot, "docs", "archive", "home-world-masters");

const WORLD_SIZE = { width: 720, height: 560 };
const MARKER_SIZE = { width: 360, height: 430 };

function svgFrame(width, height, body, defs = "") {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="softShadow" x="-30%" y="-30%" width="160%" height="170%">
      <feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#1b221b" flood-opacity="0.34"/>
    </filter>
    <filter id="contactShadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#14201c" flood-opacity="0.34"/>
    </filter>
    <filter id="glowGold" x="-60%" y="-60%" width="220%" height="220%">
      <feGaussianBlur stdDeviation="7" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    <linearGradient id="woodSide" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#8a5630"/>
      <stop offset="46%" stop-color="#5b351f"/>
      <stop offset="100%" stop-color="#2d1a12"/>
    </linearGradient>
    <linearGradient id="woodTop" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#c18a55"/>
      <stop offset="48%" stop-color="#956239"/>
      <stop offset="100%" stop-color="#623820"/>
    </linearGradient>
    <linearGradient id="brass" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff0a9"/>
      <stop offset="30%" stop-color="#d6a64c"/>
      <stop offset="100%" stop-color="#76501f"/>
    </linearGradient>
    <radialGradient id="stageLight" cx="50%" cy="30%" r="65%">
      <stop offset="0%" stop-color="#fff6cc" stop-opacity="0.6"/>
      <stop offset="44%" stop-color="#9bd1a6" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="#264137" stop-opacity="0"/>
    </radialGradient>
    ${defs}
  </defs>
  ${body}
</svg>`;
}

function baseDiorama(inner) {
  const rivets = [176, 238, 300, 362, 424, 486, 548]
    .map(
      (cx, index) =>
        `<circle cx="${cx}" cy="${index % 2 ? 423 : 417}" r="5" fill="#f4cf72" opacity="0.68"/>
         <circle cx="${cx}" cy="${index % 2 ? 423 : 417}" r="2.1" fill="#74491f" opacity="0.44"/>`,
    )
    .join("");

  return `
  <ellipse cx="360" cy="492" rx="250" ry="42" fill="#101814" opacity="0.28"/>
  <g filter="url(#softShadow)">
    <path d="M112 378 C128 318 193 269 289 249 C389 229 508 244 580 293 C635 331 634 389 582 427 C512 480 384 502 264 483 C164 467 98 425 112 378Z" fill="url(#woodSide)"/>
    <path d="M116 352 C134 294 203 249 302 231 C403 213 516 229 582 277 C635 315 629 369 574 404 C501 451 376 467 263 449 C168 433 103 395 116 352Z" fill="url(#woodTop)"/>
    <g opacity="0.28" stroke="#f2c783" stroke-width="3" stroke-linecap="round" fill="none">
      <path d="M153 373 C231 395 331 404 445 383"/>
      <path d="M167 333 C248 302 386 284 539 319"/>
      <path d="M209 429 C315 449 444 440 535 398"/>
    </g>
    <g opacity="0.26" stroke="#462818" stroke-width="3" stroke-linecap="round" fill="none">
      <path d="M133 364 C215 331 393 314 578 350"/>
      <path d="M188 413 C297 429 430 423 555 379"/>
    </g>
    <g>${rivets}</g>
    <path d="M137 348 C153 302 214 268 307 253 C398 239 500 253 558 290 C599 316 592 353 547 378 C482 416 376 427 276 412 C190 399 123 380 137 348Z" fill="#d8b374" opacity="0.12"/>
    <ellipse cx="360" cy="333" rx="230" ry="103" fill="url(#stageLight)"/>
    ${inner}
  </g>`;
}

function commandsWorld() {
  const body = baseDiorama(`
    <g filter="url(#contactShadow)">
      <path d="M195 385 L210 241 Q210 216 239 211 L497 214 Q521 218 529 242 L541 385 Z" fill="#355f5b" stroke="url(#brass)" stroke-width="8"/>
      <path d="M234 239 L488 241 L500 363 L218 361 Z" fill="#1e3937" opacity="0.78"/>
      <rect x="272" y="245" width="166" height="82" rx="15" fill="#1b746f" stroke="#afe6d0" stroke-width="5"/>
      <path d="M294 287 L332 306 L409 264" stroke="#b9ffe3" stroke-width="11" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <g>
        <circle cx="270" cy="356" r="16" fill="#ec6952"/>
        <circle cx="315" cy="356" r="16" fill="#f5c85a"/>
        <circle cx="360" cy="356" r="16" fill="#74c66c"/>
        <rect x="410" y="341" width="18" height="55" rx="9" fill="#f1a04e"/>
        <rect x="451" y="323" width="18" height="73" rx="9" fill="#f1d07a"/>
        <circle cx="419" cy="336" r="16" fill="#493422"/>
        <circle cx="460" cy="319" r="16" fill="#493422"/>
      </g>
      <path d="M236 230 C221 205 222 177 246 161" stroke="#6ec8c2" stroke-width="11" fill="none" stroke-linecap="round"/>
      <path d="M486 230 C508 202 500 176 472 162" stroke="#f0c65b" stroke-width="11" fill="none" stroke-linecap="round"/>
      <circle cx="246" cy="161" r="17" fill="#65d0c7"/>
      <circle cx="472" cy="162" r="17" fill="#f2c45b"/>
    </g>
  `);

  return svgFrame(WORLD_SIZE.width, WORLD_SIZE.height, body);
}

function gardenWorld() {
  const pot = (cx, cy, scale = 1) => `
    <g transform="translate(${cx} ${cy}) scale(${scale})" filter="url(#contactShadow)">
      <ellipse cx="0" cy="36" rx="51" ry="16" fill="#311d12" opacity="0.35"/>
      <path d="M-49 -8 Q0 -27 49 -8 L35 55 Q0 75 -35 55Z" fill="#bd7443" stroke="#f0bf7e" stroke-width="6"/>
      <ellipse cx="0" cy="-8" rx="51" ry="20" fill="#d08b52" stroke="#f1c681" stroke-width="5"/>
      <ellipse cx="0" cy="-8" rx="36" ry="12" fill="#4a2b1b"/>
      <path d="M0 -21 C-8 -55 -31 -63 -38 -85" stroke="#75bd67" stroke-width="10" fill="none" stroke-linecap="round"/>
      <path d="M0 -21 C10 -57 34 -61 41 -83" stroke="#75bd67" stroke-width="10" fill="none" stroke-linecap="round"/>
      <ellipse cx="-40" cy="-84" rx="21" ry="13" fill="#9ad372" transform="rotate(23 -40 -84)"/>
      <ellipse cx="42" cy="-83" rx="21" ry="13" fill="#9ad372" transform="rotate(-24 42 -83)"/>
    </g>`;
  const body = baseDiorama(`
    ${pot(270, 334, 0.82)}
    ${pot(403, 313, 1)}
    ${pot(508, 352, 0.72)}
    <g filter="url(#contactShadow)">
      <path d="M209 260 Q251 215 303 243" stroke="#8f7551" stroke-width="10" fill="none"/>
      <circle cx="227" cy="246" r="13" fill="#8f7551"/>
      <ellipse cx="284" cy="243" rx="43" ry="24" fill="#6da7a7" stroke="#d8e4d0" stroke-width="6"/>
      <path d="M315 238 Q368 221 390 242" stroke="#6da7a7" stroke-width="13" fill="none" stroke-linecap="round"/>
      <circle cx="390" cy="242" r="10" fill="#6da7a7"/>
    </g>
    <g filter="url(#glowGold)">
      <circle cx="222" cy="388" r="7" fill="#d9b27a"/>
      <circle cx="242" cy="399" r="7" fill="#d9b27a"/>
      <circle cx="512" cy="270" r="7" fill="#d9b27a"/>
      <circle cx="531" cy="276" r="7" fill="#d9b27a"/>
    </g>
  `);

  return svgFrame(WORLD_SIZE.width, WORLD_SIZE.height, body);
}

// HOME-ROUTE-POLISH-02: the Home's Explorador marker is the Rota board's own
// Explorador miniature (tools/assets/home-atelier-worlds.mjs), painted with the
// atelier kit's materials — one piece, not a second, flatter drawing of it. Same
// 360×430 frame, so the marker's box, place and size in the Home do not move.
const MARKER_GROUND = { x: 180, y: 360, scale: 5.2 };

function explorerMarker() {
  const { x, y, scale } = MARKER_GROUND;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${MARKER_SIZE.width}" height="${MARKER_SIZE.height}" viewBox="0 0 ${MARKER_SIZE.width} ${MARKER_SIZE.height}" xmlns="http://www.w3.org/2000/svg">
  <defs>${ATELIER_DEFS}${MINIATURE_DEFS}</defs>
  ${explorerMiniature(x, y, scale)}${explorerRing(x, y, scale)}
</svg>`;
}


// MINDFLOW-CLEANUP-03C: the two hero worlds no longer take their sprite from
// here. Rota and Circuito are rendered from the layered dioramas, and their
// transition/intro art comes from create_world_cohesion_assets.mjs as
// world-route-hero.webp / world-circuit-hero.webp. The flat world-route.webp and
// world-circuit.webp had no consumer left, so this stops emitting them; the
// three secondary worlds below are still live in worldVisuals.ts.
// HOME-WORLD-VISUAL-UNIFICATION-01: world-glow.webp is gone (the Home's glow is
// CSS in the world's own accent now) and so is world-trail.webp, which the
// GAME03-SKELETON-01 retirement of the Trilha left listed here — a run would
// have put the retired world's art back in public/.
const assets = [
  { name: "world-panel.webp", title: "Painel", svg: commandsWorld(), width: WORLD_SIZE.width, height: WORLD_SIZE.height },
  { name: "world-garden.webp", title: "Jardim", svg: gardenWorld(), width: WORLD_SIZE.width, height: WORLD_SIZE.height },
  { name: "explorer-marker.webp", title: "Explorador", svg: explorerMarker(), width: MARKER_SIZE.width, height: MARKER_SIZE.height },
];

async function renderAsset(asset) {
  const output = join(publicHomeDir, asset.name);
  await sharp(Buffer.from(asset.svg))
    .webp({ quality: 88, alphaQuality: 92, effort: 6 })
    .toFile(output);
  return output;
}

async function renderReviewSheet() {
  const tileWidth = 420;
  const tileHeight = 330;
  const margin = 48;
  const reviewWidth = tileWidth * 2 + margin * 3;
  const reviewHeight = tileHeight * 4 + margin * 2;
  const background = `
<svg width="${reviewWidth}" height="${reviewHeight}" viewBox="0 0 ${reviewWidth} ${reviewHeight}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#171f1d"/>
      <stop offset="1" stop-color="#2b1e16"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#bg)"/>
  <text x="48" y="58" fill="#fff3cc" font-family="Georgia, serif" font-size="34" font-weight="700">MindFlow Home World Sprite Review</text>
</svg>`;

  const composites = [];
  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index];
    const column = index % 2;
    const row = Math.floor(index / 2);
    const left = margin + column * (tileWidth + margin);
    const top = 88 + row * tileHeight;
    const png = await sharp(Buffer.from(asset.svg))
      .resize({
        width: asset.name === "explorer-marker.webp" ? 170 : 330,
        height: asset.name === "explorer-marker.webp" ? 225 : 260,
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    const label = Buffer.from(`
<svg width="${tileWidth}" height="${tileHeight}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${tileWidth}" height="${tileHeight}" rx="32" fill="#fff4d8" fill-opacity="0.08" stroke="#d8aa54" stroke-opacity="0.46"/>
  <text x="26" y="48" fill="#fff5d9" font-family="Arial, sans-serif" font-size="22" font-weight="800">${asset.title}</text>
</svg>`);
    composites.push({ input: label, left, top });
    composites.push({
      input: png,
      left: left + Math.round((tileWidth - (asset.name === "explorer-marker.webp" ? 170 : 330)) / 2),
      top: top + 60,
    });
  }

  const output = join(archiveDir, "home-world-review.png");
  await sharp(Buffer.from(background)).composite(composites).png().toFile(output);
  return output;
}

async function sizeOf(file) {
  const fileStat = await stat(file);
  return fileStat.size;
}

async function main() {
  await mkdir(publicHomeDir, { recursive: true });
  await mkdir(archiveDir, { recursive: true });

  const outputs = [];
  for (const asset of assets) {
    const output = await renderAsset(asset);
    outputs.push({ file: output, size: await sizeOf(output) });
  }

  const review = await renderReviewSheet();
  outputs.push({ file: review, size: await sizeOf(review) });

  await writeFile(
    join(archiveDir, "README.md"),
    `# Home World Masters\n\nThis folder stores non-runtime review material for HOME-ART-02.\n\n- Runtime assets live in \`public/illustrations/home/*.webp\`.\n- \`home-world-review.png\` is a review sheet only and must not be referenced by the app.\n- Recreate the current runtime sprite set with \`node tools/assets/create_home_world_set.mjs\`.\n- Keep source/master/review files outside \`public/\` unless they are intentionally used at runtime.\n`,
    "utf8",
  );

  for (const output of outputs) {
    console.log(`${output.file.replace(repoRoot + "\\", "")} ${output.size} bytes`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
