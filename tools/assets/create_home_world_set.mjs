import { mkdir, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

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

function routeWorld() {
  const stones = [
    [201, 353, 42, 27],
    [260, 330, 45, 28],
    [322, 315, 44, 29],
    [385, 304, 46, 30],
    [451, 289, 44, 28],
    [506, 257, 47, 30],
  ]
    .map(([cx, cy, rx, ry], index) => `
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${index % 2 ? "#d9ceb0" : "#bfb7a0"}" stroke="#7d6642" stroke-width="5"/>
      <path d="M${cx - rx * 0.42} ${cy - 2} Q${cx} ${cy - 12} ${cx + rx * 0.42} ${cy - 4}" stroke="#f5ebca" stroke-width="3" opacity="0.34" fill="none"/>
    `)
    .join("");

  const body = baseDiorama(`
    <path d="M139 374 C198 287 314 246 440 257 C515 263 569 237 600 198" fill="none" stroke="#e7c378" stroke-width="11" stroke-linecap="round" opacity="0.42"/>
    <path d="M151 378 C215 318 302 293 390 298 C467 302 531 273 580 220" fill="none" stroke="#48795f" stroke-width="42" stroke-linecap="round" opacity="0.42"/>
    ${stones}
    <g filter="url(#contactShadow)">
      <path d="M500 226 L500 164 Q500 136 531 128 Q562 136 562 164 L562 226 Z" fill="#4fcf75"/>
      <path d="M477 229 Q531 191 585 229 L585 263 Q531 296 477 263Z" fill="#556057" stroke="url(#brass)" stroke-width="8"/>
      <ellipse cx="531" cy="223" rx="37" ry="44" fill="#29d66b" opacity="0.82"/>
      <ellipse cx="531" cy="223" rx="23" ry="31" fill="#b9ffcd" opacity="0.32"/>
    </g>
    <g filter="url(#glowGold)">
      <circle cx="276" cy="296" r="15" fill="#ffdb58"/>
      <circle cx="420" cy="276" r="14" fill="#ffdc60"/>
      <circle cx="486" cy="339" r="13" fill="#ffdc60"/>
      <circle cx="276" cy="296" r="25" fill="#ffdf67" opacity="0.18"/>
      <circle cx="420" cy="276" r="23" fill="#ffdf67" opacity="0.18"/>
      <circle cx="486" cy="339" r="22" fill="#ffdf67" opacity="0.18"/>
    </g>
    <g filter="url(#contactShadow)">
      <ellipse cx="223" cy="385" rx="34" ry="14" fill="#0b4f69" opacity="0.38"/>
      <path d="M222 312 C205 328 201 366 210 387 C218 405 239 405 247 387 C256 366 251 329 235 312 Z" fill="#29b7d4"/>
      <circle cx="228" cy="293" r="23" fill="#68e5ef"/>
      <path d="M210 289 C216 272 237 267 248 279" stroke="#dfffff" stroke-width="6" fill="none" opacity="0.5"/>
    </g>
    <g filter="url(#contactShadow)">
      <ellipse cx="369" cy="286" rx="33" ry="13" fill="#4a2318" opacity="0.38"/>
      <path d="M341 251 Q369 202 397 251 L388 308 Q369 323 350 308Z" fill="#2b231b"/>
      <path d="M354 254 Q369 238 384 254 L383 299 Q369 310 355 299Z" fill="#17120e"/>
      <circle cx="361" cy="262" r="6" fill="#ffb72e"/>
      <circle cx="377" cy="262" r="6" fill="#ffb72e"/>
      <path d="M349 309 Q369 322 389 309" stroke="#f2a432" stroke-width="6" opacity="0.88"/>
    </g>
    <g>
      <path d="M308 389 L332 337 L355 389 Z" fill="#b94b4b" stroke="#ffc7a2" stroke-width="5"/>
      <path d="M458 372 L478 331 L501 374 Z" fill="#b94b4b" stroke="#ffc7a2" stroke-width="5"/>
    </g>
    <path d="M175 319 Q265 241 371 251 Q491 261 554 203" stroke="#f8e6a8" stroke-width="4" stroke-dasharray="12 12" opacity="0.35" fill="none"/>
  `);

  return svgFrame(WORLD_SIZE.width, WORLD_SIZE.height, body);
}

function circuitWorld() {
  const pad = (cx, cy, colorA, colorB, symbol) => `
    <g filter="url(#contactShadow)">
      <ellipse cx="${cx}" cy="${cy + 34}" rx="62" ry="21" fill="#1b1715" opacity="0.34"/>
      <ellipse cx="${cx}" cy="${cy}" rx="72" ry="45" fill="url(#brass)" opacity="0.95"/>
      <ellipse cx="${cx}" cy="${cy - 2}" rx="61" ry="36" fill="${colorB}"/>
      <ellipse cx="${cx}" cy="${cy - 6}" rx="46" ry="27" fill="${colorA}" opacity="0.88"/>
      ${symbol}
    </g>`;

  const body = baseDiorama(`
    <ellipse cx="358" cy="310" rx="184" ry="107" fill="#34363c" stroke="url(#brass)" stroke-width="8"/>
    <ellipse cx="358" cy="310" rx="151" ry="83" fill="none" stroke="#f3d37b" stroke-width="5" opacity="0.42"/>
    <ellipse cx="358" cy="310" rx="102" ry="54" fill="none" stroke="#52c4c6" stroke-width="4" opacity="0.28"/>
    <path d="M244 291 C294 257 424 257 476 291" stroke="#54c8d1" stroke-width="6" opacity="0.55" fill="none"/>
    <path d="M253 344 C306 381 413 381 470 342" stroke="#f4c848" stroke-width="6" opacity="0.55" fill="none"/>
    ${pad(257, 294, "#ff6858", "#a9342c", '<path d="M252 282 C279 300 274 326 249 332 C263 315 235 306 252 282Z" fill="#ffd8a9" opacity="0.9"/>')}
    ${pad(461, 294, "#38b9ff", "#1263a3", '<path d="M434 288 C458 273 480 278 494 296 C475 289 456 304 438 302Z" fill="#d9f5ff" opacity="0.9"/>')}
    ${pad(296, 375, "#55cc75", "#28713d", '<path d="M279 376 C307 344 331 355 327 387 C304 380 296 384 279 376Z" fill="#dcffd7" opacity="0.9"/>')}
    ${pad(426, 374, "#f5ce43", "#bd8025", '<circle cx="426" cy="370" r="16" fill="#fff6bd"/><g stroke="#fff6bd" stroke-width="5"><path d="M426 342v13"/><path d="M426 386v13"/><path d="M399 370h13"/><path d="M440 370h13"/></g>')}
    <g filter="url(#glowGold)">
      <path d="M343 299 L374 299 L390 331 L374 363 L343 363 L327 331Z" fill="#fef1c4" opacity="0.93"/>
      <path d="M356 286 L383 330 L356 374 L329 330Z" fill="#f5d46c" opacity="0.48"/>
      <circle cx="360" cy="331" r="54" fill="#fff0b6" opacity="0.11"/>
    </g>
  `);

  return svgFrame(WORLD_SIZE.width, WORLD_SIZE.height, body);
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

function logicWorld() {
  const tile = (cx, cy, fill, mark) => `
    <g filter="url(#contactShadow)">
      <rect x="${cx - 38}" y="${cy - 27}" width="76" height="54" rx="15" fill="${fill}" stroke="url(#brass)" stroke-width="5"/>
      ${mark}
    </g>`;
  const body = baseDiorama(`
    <path d="M214 374 C260 303 325 337 360 282 C398 222 476 270 507 211" fill="none" stroke="#60d5dd" stroke-width="15" stroke-linecap="round" opacity="0.45"/>
    <path d="M214 374 C260 303 325 337 360 282 C398 222 476 270 507 211" fill="none" stroke="#fff4b4" stroke-width="5" stroke-linecap="round" opacity="0.72"/>
    ${tile(211, 374, "#8b72c2", '<circle cx="211" cy="374" r="10" fill="#f6e9ff"/>')}
    ${tile(300, 326, "#a88bd5", '<path d="M285 326h30" stroke="#f6e9ff" stroke-width="8" stroke-linecap="round"/>')}
    ${tile(366, 280, "#c1a4dd", '<path d="M366 264v32M350 280h32" stroke="#f6e9ff" stroke-width="7" stroke-linecap="round"/>')}
    ${tile(445, 260, "#8c79c5", '<path d="M428 269 L445 247 L462 269Z" fill="#f6e9ff"/>')}
    ${tile(507, 211, "#6d5ca1", '<path d="M491 211 Q507 193 523 211 Q507 229 491 211Z" fill="#f6e9ff"/>')}
    <path d="M500 158 L500 212" stroke="#8d6f37" stroke-width="8"/>
    <path d="M505 161 L565 182 L505 204Z" fill="#f5c84f" stroke="#9e6728" stroke-width="5"/>
    <g filter="url(#glowGold)">
      <path d="M246 236 L270 183 L292 236 Z" fill="#9964d4" opacity="0.78"/>
      <path d="M478 352 L502 303 L525 352 Z" fill="#56c9db" opacity="0.78"/>
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

function explorerMarker() {
  return svgFrame(
    MARKER_SIZE.width,
    MARKER_SIZE.height,
    `
  <ellipse cx="180" cy="375" rx="102" ry="26" fill="#14312d" opacity="0.24"/>
  <g filter="url(#softShadow)">
    <path d="M121 176 Q180 92 239 176 L244 292 Q180 352 116 292Z" fill="#188a81" stroke="#e9fbde" stroke-width="10"/>
    <path d="M139 179 Q180 122 221 179 L225 274 Q180 320 135 274Z" fill="#2fb6aa"/>
    <ellipse cx="180" cy="146" rx="42" ry="33" fill="#f7dc9b"/>
    <path d="M142 145 Q180 97 218 145 Q189 128 142 145Z" fill="#0e675f"/>
    <circle cx="165" cy="151" r="5" fill="#173941"/>
    <circle cx="195" cy="151" r="5" fill="#173941"/>
    <path d="M166 169 Q180 179 196 169" stroke="#173941" stroke-width="5" stroke-linecap="round" fill="none"/>
    <path d="M122 246 Q180 287 238 246" stroke="#fff4bd" stroke-width="9" opacity="0.65"/>
    <circle cx="180" cy="252" r="20" fill="url(#brass)"/>
  </g>`,
  );
}

function worldGlow() {
  return svgFrame(
    640,
    360,
    `
  <radialGradient id="softWorldGlow" cx="50%" cy="50%" r="50%">
    <stop offset="0%" stop-color="#f4d980" stop-opacity="0.62"/>
    <stop offset="38%" stop-color="#77d9c9" stop-opacity="0.26"/>
    <stop offset="100%" stop-color="#77d9c9" stop-opacity="0"/>
  </radialGradient>
  <ellipse cx="320" cy="180" rx="300" ry="150" fill="url(#softWorldGlow)"/>`,
  );
}

const assets = [
  { name: "world-route.webp", title: "Rota", svg: routeWorld(), width: WORLD_SIZE.width, height: WORLD_SIZE.height },
  { name: "world-circuit.webp", title: "Circuito", svg: circuitWorld(), width: WORLD_SIZE.width, height: WORLD_SIZE.height },
  { name: "world-panel.webp", title: "Painel", svg: commandsWorld(), width: WORLD_SIZE.width, height: WORLD_SIZE.height },
  { name: "world-trail.webp", title: "Trilha", svg: logicWorld(), width: WORLD_SIZE.width, height: WORLD_SIZE.height },
  { name: "world-garden.webp", title: "Jardim", svg: gardenWorld(), width: WORLD_SIZE.width, height: WORLD_SIZE.height },
  { name: "explorer-marker.webp", title: "Explorador", svg: explorerMarker(), width: MARKER_SIZE.width, height: MARKER_SIZE.height },
  { name: "world-glow.webp", title: "Glow", svg: worldGlow(), width: 640, height: 360 },
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
