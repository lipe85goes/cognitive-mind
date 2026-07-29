import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../..");
const ASSET_DIR = path.join(
  ROOT,
  "public",
  "assets",
  "memory-circuit",
  "v2",
);
/**
 * CIRCUIT-PRESENTATION-FINAL-01-FIX: Home, transition and intro now read the
 * V2 kit directly, so there is no separate derived folder to keep in sync.
 * The old derivation step was removed — a second copy of the artifact is
 * exactly how Home and game drifted apart in the first place.
 */
const BACKGROUND = path.join(
  ROOT,
  "public",
  "illustrations",
  "memory-circuit",
  "memory-room-bg.webp",
);
const OUTPUT_DIR = path.join(
  ROOT,
  "docs",
  "archive",
  "circuit-visual-01",
);

const BOARD = path.join(ASSET_DIR, "memory-board.webp");
const OVERLAYS = {
  flame: path.join(ASSET_DIR, "overlay-flame.webp"),
  wave: path.join(ASSET_DIR, "overlay-wave.webp"),
  leaf: path.join(ASSET_DIR, "overlay-leaf.webp"),
  sun: path.join(ASSET_DIR, "overlay-sun.webp"),
  core: path.join(ASSET_DIR, "overlay-core.webp"),
  complete: path.join(ASSET_DIR, "overlay-complete.webp"),
};

const PAD_CROPS = {
  flame: { left: 430, top: 105, width: 420, height: 360 },
  wave: { left: 735, top: 325, width: 420, height: 360 },
  leaf: { left: 125, top: 325, width: 420, height: 360 },
  sun: { left: 430, top: 565, width: 420, height: 360 },
};

const TITLES = {
  flame: "Flame / warm coral",
  wave: "Wave / deep blue",
  leaf: "Leaf / emerald green",
  sun: "Sun / calm amber",
};

function titleSvg(title, subtitle, width, height = 96) {
  const safeTitle = title.replaceAll("&", "&amp;");
  const safeSubtitle = subtitle.replaceAll("&", "&amp;");
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" rx="24" fill="#102523"/>
      <rect x="1.5" y="1.5" width="${width - 3}" height="${height - 3}"
        rx="22" fill="none" stroke="#a9793e" stroke-width="3"/>
      <text x="34" y="42" fill="#fff0c8" font-family="Georgia, serif"
        font-size="28" font-weight="700">${safeTitle}</text>
      <text x="34" y="72" fill="#a8c6bf" font-family="Arial, sans-serif"
        font-size="17">${safeSubtitle}</text>
    </svg>
  `);
}

function panelLabel(label, width) {
  const safeLabel = label.replaceAll("&", "&amp;");
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="54">
      <rect width="100%" height="54" rx="14" fill="#0a1c1a" fill-opacity=".96"/>
      <rect x="1" y="1" width="${width - 2}" height="52"
        rx="13" fill="none" stroke="#bd8a48" stroke-width="2"/>
      <text x="${width / 2}" y="35" text-anchor="middle" fill="#fff0c8"
        font-family="Arial, sans-serif" font-size="20" font-weight="700">${safeLabel}</text>
    </svg>
  `);
}

async function boardState(keys = []) {
  return sharp(BOARD)
    .composite(keys.map((key) => ({ input: OVERLAYS[key] })))
    .webp({ quality: 90 })
    .toBuffer();
}

async function reviewCanvas(title, subtitle, panels, options = {}) {
  const width = options.width ?? 1600;
  const height = options.height ?? 1000;
  const composites = [
    { input: titleSvg(title, subtitle, width - 96), left: 48, top: 40 },
  ];

  for (const panel of panels) {
    composites.push({
      input: panel.image,
      left: panel.left,
      top: panel.top,
    });
    if (panel.label) {
      composites.push({
        input: panelLabel(panel.label, panel.width),
        left: panel.left,
        top: panel.top + panel.height + 12,
      });
    }
  }

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: 8, g: 22, b: 20, alpha: 1 },
    },
  })
    .composite(composites)
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toBuffer();
}

async function cropPad(state, pad, width = 330, height = 282) {
  return sharp(state)
    .extract(PAD_CROPS[pad])
    .resize(width, height, { fit: "cover" })
    .png()
    .toBuffer();
}

async function generateBoardReview() {
  const board = await sharp(BOARD)
    .resize(1180, 944, { fit: "contain" })
    .png()
    .toBuffer();
  const output = await reviewCanvas(
    "Board material review",
    "Blue-green stone, aged bronze, physical rim, carved paths and inset pad wells.",
    [{ image: board, left: 210, top: 80, width: 1180, height: 944 }],
    { height: 1120 },
  );
  await fs.writeFile(path.join(OUTPUT_DIR, "board-material-review.png"), output);
}

async function generatePadReview(active) {
  const idle = await boardState();
  const panels = [];
  const pads = ["flame", "wave", "leaf", "sun"];

  for (let index = 0; index < pads.length; index += 1) {
    const pad = pads[index];
    const state = active ? await boardState([pad]) : idle;
    const image = await cropPad(state, pad);
    panels.push({
      image,
      left: 100 + (index % 2) * 750,
      top: 170 + Math.floor(index / 2) * 390,
      width: 650,
      height: 282,
      label: TITLES[pad],
    });
  }

  const output = await reviewCanvas(
    active ? "Pads active review" : "Pads idle review",
    active
      ? "Active energy keeps each symbol readable without replacing the enamel color."
      : "Four distinct symbols and silhouettes remain understandable without color alone.",
    panels,
  );
  await fs.writeFile(
    path.join(
      OUTPUT_DIR,
      active ? "pads-active-review.png" : "pads-idle-review.png",
    ),
    output,
  );
}

async function generateCoreReview() {
  const states = [
    { label: "Idle core", keys: [] },
    { label: "Observing / ready", keys: ["core"] },
    { label: "Circuit complete", keys: ["complete"] },
  ];
  const panels = [];

  for (let index = 0; index < states.length; index += 1) {
    const state = states[index];
    const image = await sharp(await boardState(state.keys))
      .extract({ left: 400, top: 240, width: 480, height: 540 })
      .resize(400, 450)
      .png()
      .toBuffer();
    panels.push({
      image,
      left: 100 + index * 500,
      top: 190,
      width: 400,
      height: 450,
      label: state.label,
    });
  }

  const output = await reviewCanvas(
    "Core states review",
    "The central crystal is the calm focal point, never a white flash.",
    panels,
    { height: 760 },
  );
  await fs.writeFile(path.join(OUTPUT_DIR, "core-states-review.png"), output);
}

async function generateTrailReview() {
  const states = [
    { label: "Flame path", key: "flame" },
    { label: "Wave path", key: "wave" },
    { label: "Leaf path", key: "leaf" },
    { label: "Sun path", key: "sun" },
  ];
  const panels = [];

  for (let index = 0; index < states.length; index += 1) {
    const state = states[index];
    const image = await sharp(await boardState([state.key]))
      .resize(640, 512)
      .png()
      .toBuffer();
    panels.push({
      image,
      left: 80 + (index % 2) * 760,
      top: 145 + Math.floor(index / 2) * 390,
      width: 640,
      height: 512,
      label: state.label,
    });
  }

  const output = await reviewCanvas(
    "Trail states review",
    "Each trail links the core to one pad with restrained color and warm energy.",
    panels,
    { height: 1180 },
  );
  await fs.writeFile(path.join(OUTPUT_DIR, "trail-states-review.png"), output);
}

async function fullCircuitState(filename, title, keys) {
  const stageWidth = 1280;
  const stageHeight = 720;
  const board = await sharp(await boardState(keys))
    .resize(700, 560, { fit: "contain" })
    .png()
    .toBuffer();
  const background = await sharp(BACKGROUND)
    .resize(stageWidth, stageHeight, { fit: "cover" })
    .modulate({ brightness: 0.62, saturation: 0.78 })
    .blur(1)
    .png()
    .toBuffer();
  const statePlate = titleSvg(
    title,
    "Circuito de Memoria - Pensar em paz",
    700,
    86,
  );

  const output = await sharp(background)
    .composite([
      {
        input: Buffer.from(`
          <svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720">
            <defs>
              <radialGradient id="v">
                <stop offset="0" stop-color="#061513" stop-opacity="0"/>
                <stop offset="1" stop-color="#061513" stop-opacity=".55"/>
              </radialGradient>
            </defs>
            <rect width="1280" height="720" fill="url(#v)"/>
          </svg>
        `),
      },
      { input: statePlate, left: 290, top: 22 },
      { input: board, left: 290, top: 120 },
    ])
    .png({ compressionLevel: 9, palette: true, quality: 90 })
    .toBuffer();
  await fs.writeFile(path.join(OUTPUT_DIR, filename), output);
}

/**
 * CIRCUIT-PRESENTATION-FINAL-01-FIX: the gate sheet is built from REAL runtime
 * screenshots, never from script-composed assets. A composite could always look
 * right while the browser rendered something else — which is exactly the trap
 * that let Home and game drift apart unnoticed.
 */
const RUNTIME_DIR = path.join(
  ROOT,
  "docs",
  "archive",
  "circuit-presentation-final-01",
);

const RUNTIME_PANELS = [
  ["runtime-home-circuit.png", "Home (runtime real)"],
  ["runtime-intro-circuit.png", "Introducao (runtime real)"],
  ["runtime-game-circuit.png", "Jogo ativo (runtime real)"],
];

async function generateHomeComparison() {
  const panels = [];
  for (let index = 0; index < RUNTIME_PANELS.length; index += 1) {
    const [file, label] = RUNTIME_PANELS[index];
    const source = path.join(RUNTIME_DIR, file);
    try {
      await fs.access(source);
    } catch {
      console.warn(
        `Skipping home-vs-game sheet: missing runtime capture ${file}. ` +
          "Run the runtime capture flow first.",
      );
      return;
    }
    panels.push({
      image: await sharp(source).resize(470, 376, { fit: "cover" }).png().toBuffer(),
      left: 60 + index * 500,
      top: 200,
      width: 470,
      height: 376,
      label,
    });
  }

  const output = await reviewCanvas(
    "Home vs game circuit",
    "Mesmo artefato V2 em toda a entrada: capturas reais do runtime, nao composicoes.",
    panels,
    { width: 1600, height: 700 },
  );
  await fs.writeFile(path.join(OUTPUT_DIR, "home-vs-game-circuit.png"), output);
}

async function main() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await generateBoardReview();
  await generatePadReview(false);
  await generatePadReview(true);
  await generateCoreReview();
  await generateTrailReview();
  await fullCircuitState(
    "full-circuit-idle.png",
    "Circuito em repouso",
    [],
  );
  await fullCircuitState(
    "full-circuit-observe.png",
    "Observe o circuito",
    ["core", "wave"],
  );
  await fullCircuitState(
    "full-circuit-player-turn.png",
    "Sua vez de repetir",
    ["core"],
  );
  await fullCircuitState(
    "full-circuit-complete.png",
    "Circuito ativado",
    ["complete"],
  );
  await generateHomeComparison();
  console.log(`Circuit Visual 01 review sheets written to ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
