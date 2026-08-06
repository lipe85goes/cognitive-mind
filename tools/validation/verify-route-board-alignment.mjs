/**
 * ROTA-BOARD-9X9-SYNC-01 — prove the 81 logical cells land on the 81 physical
 * tiles, from the real runtime.
 *
 * Method, and why it needs no instrumentation in the product:
 *
 *  - the board canvas already publishes `data-cell-centers`, the projection of
 *    every logical cell centre, plus `data-wall-cells`, `data-player-cell` and
 *    friends. That is the LOGICAL side, straight from the running game.
 *  - the tiles all lie in one plane, so the map from board coordinates to screen
 *    pixels is a homography. Four correspondences determine it; we fit it over
 *    all 81 with least squares. That lets us project any point on the board
 *    plane — including the four corners of the physical body, which the game
 *    never publishes — and check the frame is inside the canvas.
 *  - the PHYSICAL side comes from the GLB itself, measured by
 *    inspect-route-board-glb.mjs, and is compared against the same homography.
 *
 * Outputs a JSON report and an annotated PNG per viewport.
 *
 * Usage: node tools/validation/verify-route-board-alignment.mjs [--base URL] [--out DIR]
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import sharp from "sharp";

/**
 * Playwright is a review-time dependency, not a product one, so it is not in
 * package.json. Resolve it from the project if it happens to be installed,
 * otherwise from PLAYWRIGHT_DIR (a node_modules directory that has it).
 */
const { chromium } = await (async () => {
  try {
    return await import("playwright");
  } catch {
    const dir = process.env.PLAYWRIGHT_DIR;
    if (dir) {
      for (const entry of ["index.mjs", "index.js"]) {
        const file = path.join(dir, "playwright", entry);
        if (fs.existsSync(file)) return await import(pathToFileURL(file).href);
      }
    }
    throw new Error(
      "playwright not found. Install it, or set PLAYWRIGHT_DIR to a node_modules directory that has it.",
    );
  }
})();

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
};
const BASE = arg("--base", "http://localhost:3100");
const OUT = path.resolve(arg("--out", "docs/archive/route-board-9x9-sync-01"));
const log = (...a) => console.log("[align]", ...a);

fs.mkdirSync(OUT, { recursive: true });

// --- physical truth, straight from the asset ---------------------------------
const glb = JSON.parse(
  execFileSync("node", ["tools/validation/inspect-route-board-glb.mjs"], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
  }),
);
const COLS = glb.tiles.columns;
const ROWS = glb.tiles.rows;
const CELL = glb.tiles.cellPitch[0];
const BODY_HALF = glb.boardBase[0] / 2;
log(`GLB: ${glb.tiles.count} tiles, ${COLS}x${ROWS}, pitch ${CELL}, body ${glb.boardBase[0]}`);

/** Least-squares homography from board-plane (x,z) to screen (px,py). */
function fitHomography(pairs) {
  const A = [];
  const b = [];
  for (const [x, z, px, py] of pairs) {
    A.push([x, z, 1, 0, 0, 0, -px * x, -px * z]);
    b.push(px);
    A.push([0, 0, 0, x, z, 1, -py * x, -py * z]);
    b.push(py);
  }
  // Normal equations: (AtA) h = At b, solved by Gaussian elimination.
  const n = 8;
  const M = Array.from({ length: n }, () => new Array(n + 1).fill(0));
  for (let i = 0; i < A.length; i += 1) {
    for (let r = 0; r < n; r += 1) {
      for (let c = 0; c < n; c += 1) M[r][c] += A[i][r] * A[i][c];
      M[r][n] += A[i][r] * b[i];
    }
  }
  for (let c = 0; c < n; c += 1) {
    let piv = c;
    for (let r = c + 1; r < n; r += 1) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    const d = M[c][c];
    for (let k = c; k <= n; k += 1) M[c][k] /= d;
    for (let r = 0; r < n; r += 1) {
      if (r === c) continue;
      const f = M[r][c];
      for (let k = c; k <= n; k += 1) M[r][k] -= f * M[c][k];
    }
  }
  const h = M.map((row) => row[n]);
  return (x, z) => {
    const w = h[6] * x + h[7] * z + 1;
    return [(h[0] * x + h[1] * z + h[2]) / w, (h[3] * x + h[4] * z + h[5]) / w];
  };
}

async function enterRoute(page, settle) {
  await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.locator(".hj-stage").waitFor({ timeout: 120000 });
  await page.waitForTimeout(1800);
  await page.locator('.hj-gallery-pip[aria-label="Selecionar Rota Estratégica"]').click({ force: true });
  await page.mouse.move(14, 14);
  await page.waitForTimeout(700);
  await page.locator('.hj-world-object[aria-current="true"] .hj-world-enter').click({ force: true });
  await page.locator(".pgi-cta").waitFor({ state: "visible", timeout: 120000 });
  await page.locator("[data-entry-phase]").waitFor({ state: "detached", timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(300);
  await page.locator(".pgi-cta").click();
  await page.locator(".rsg-shell").waitFor({ state: "visible", timeout: 120000 });
  await page.waitForTimeout(settle);
}

const browser = await chromium.launch({
  args: ["--use-angle=d3d11", "--use-gl=angle", "--ignore-gpu-blocklist", "--enable-gpu"],
});
const errors = [];
const http4xx = [];
const results = {};

for (const [w, h, name, extra, settle] of [
  [1440, 900, "desktop", {}, 9500],
  [820, 1180, "tablet", {}, 9500],
  [390, 844, "mobile", { deviceScaleFactor: 2, isMobile: true, hasTouch: true }, 12000],
]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...extra });
  const page = await ctx.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`${name}: ${m.text().slice(0, 200)}`);
  });
  page.on("pageerror", (e) => errors.push(`${name} pageerror: ${String(e).slice(0, 200)}`));
  page.on("response", (r) => {
    if (r.status() >= 400) http4xx.push(`${name}: ${r.status()} ${r.url().slice(-70)}`);
  });

  await enterRoute(page, settle);
  const start = page.locator('button[aria-label*="Iniciar rota"]').first();
  if (await start.count()) {
    await start.click({ force: true });
    await page.waitForTimeout(3500);
  }

  const data = await page.evaluate(() => {
    const c = document.querySelector("canvas.route-babylon-board");
    const r = c.getBoundingClientRect();
    const parse = (s) => (s || "").split(" ").filter(Boolean);
    return {
      canvas: { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.left), y: Math.round(r.top) },
      centers: JSON.parse(c.dataset.cellCenters || "{}"),
      walls: parse(c.dataset.wallCells),
      lights: parse(c.dataset.lightCells),
      traps: parse(c.dataset.trapCells),
      player: c.dataset.playerCell,
      guardian: c.dataset.guardianCell,
      exit: c.dataset.exitCell,
      shield: c.dataset.shieldCell,
      scrollY: document.documentElement.scrollHeight - document.documentElement.clientHeight,
      overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });

  const shot = await page.locator("canvas.route-babylon-board").screenshot();
  await page.screenshot({ path: path.join(OUT, `board-${name === "desktop" ? "playing-desktop" : name}.png`) });

  // --- logical centres -> homography -> physical geometry --------------------
  const pairs = [];
  const cells = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const p = data.centers[`${row},${col}`];
      if (!p) continue;
      const x = (col - (COLS - 1) / 2) * CELL;
      const z = ((ROWS - 1) / 2 - row) * CELL;
      pairs.push([x, z, p.x, p.y]);
      cells.push({ row, col, x, z, px: p.x, py: p.y });
    }
  }
  const H = fitHomography(pairs);

  // Residual: how far each published centre is from the fitted board plane.
  // A large residual would mean the published centres are not on the tile plane.
  let worstResidual = 0;
  for (const c of cells) {
    const [px, py] = H(c.x, c.z);
    worstResidual = Math.max(worstResidual, Math.hypot(px - c.px, py - c.py));
  }

  // Physical tile centres from the GLB, projected through the same homography,
  // compared with the logical centres the game published.
  let worstCellError = 0;
  let worstCell = null;
  for (const c of cells) {
    const tileX = glb.tiles.xCentres[c.col];
    const tileZ = glb.tiles.zCentres[ROWS - 1 - c.row];
    const [px, py] = H(tileX, tileZ);
    const d = Math.hypot(px - c.px, py - c.py);
    if (d > worstCellError) {
      worstCellError = d;
      worstCell = `${c.row},${c.col}`;
    }
  }

  // The physical body's four corners, and whether they are inside the canvas.
  const corners = [
    [-BODY_HALF, -BODY_HALF],
    [BODY_HALF, -BODY_HALF],
    [BODY_HALF, BODY_HALF],
    [-BODY_HALF, BODY_HALF],
  ].map(([x, z]) => H(x, z));
  const inside = corners.every(
    ([px, py]) => px >= 0 && py >= 0 && px <= data.canvas.w && py <= data.canvas.h,
  );
  const bodyLeft = Math.min(...corners.map((c) => c[0]));
  const bodyRight = Math.max(...corners.map((c) => c[0]));
  const bodyTop = Math.min(...corners.map((c) => c[1]));
  const bodyBottom = Math.max(...corners.map((c) => c[1]));

  const gridLeft = Math.min(...cells.map((c) => c.px));
  const gridRight = Math.max(...cells.map((c) => c.px));

  results[name] = {
    canvas: `${data.canvas.w}x${data.canvas.h}`,
    cellsPublished: cells.length,
    worstPlaneResidualPx: +worstResidual.toFixed(3),
    worstLogicalVsPhysicalPx: +worstCellError.toFixed(3),
    worstCell,
    bodyBoxPx: [Math.round(bodyLeft), Math.round(bodyTop), Math.round(bodyRight), Math.round(bodyBottom)],
    bodyWidthPx: Math.round(bodyRight - bodyLeft),
    bodyFillsCanvasPct: +(((bodyRight - bodyLeft) / data.canvas.w) * 100).toFixed(1),
    gridSpanPx: Math.round(gridRight - gridLeft),
    cellPitchPx: Math.round((gridRight - gridLeft) / (COLS - 1)),
    marginsPx: {
      left: Math.round(bodyLeft),
      right: Math.round(data.canvas.w - bodyRight),
      top: Math.round(bodyTop),
      bottom: Math.round(data.canvas.h - bodyBottom),
    },
    bodyInsideCanvas: inside,
    scrollY: data.scrollY,
    overflowX: data.overflowX,
  };
  log(name, JSON.stringify(results[name]));

  // --- annotated overlay -----------------------------------------------------
  const dot = (x, y, r, fill, label) =>
    `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${fill}" fill-opacity="0.9"/>` +
    (label
      ? `<text x="${x.toFixed(1)}" y="${(y - r - 2).toFixed(1)}" font-family="Arial" font-size="9" fill="#fff2c8" text-anchor="middle">${label}</text>`
      : "");
  const marks = cells
    .map((c) => {
      const key = `${c.row},${c.col}`;
      const edge = c.row === 0 || c.col === 0 || c.row === ROWS - 1 || c.col === COLS - 1;
      const isWall = data.walls.includes(key);
      const isLight = data.lights.includes(key);
      const colour = isLight ? "#ffd23f" : isWall ? "#ff8a5c" : edge ? "#4be0d0" : "#8fb7ff";
      const label = key === data.player ? "P" : key === data.guardian ? "G" : key === data.exit ? "X" : key === data.shield ? "S" : "";
      return dot(c.px, c.py, edge ? 4 : 3, colour, label);
    })
    .join("");
  const poly = corners.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${data.canvas.w}" height="${data.canvas.h}">
    <polygon points="${poly}" fill="none" stroke="#ff5cae" stroke-width="2.5" stroke-dasharray="8 5"/>
    ${marks}
    <rect x="8" y="8" width="330" height="66" rx="8" fill="#07110f" fill-opacity="0.86" stroke="#b98a45"/>
    <text x="20" y="30" font-family="Arial" font-size="14" font-weight="700" fill="#fff2c8">${COLS}x${ROWS} — ${cells.length} centros lógicos</text>
    <text x="20" y="48" font-family="Arial" font-size="12" fill="#9fd8cf">erro máx. lógico vs físico: ${worstCellError.toFixed(2)} px</text>
    <text x="20" y="64" font-family="Arial" font-size="12" fill="#ff9ecd">— — moldura física ${glb.boardBase[0]} un · ${results[name].bodyFillsCanvasPct}% do canvas</text>
  </svg>`;
  await sharp(shot)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toFile(path.join(OUT, name === "desktop" ? "board-81-centers.png" : `board-81-centers-${name}.png`));

  await ctx.close();
}

await browser.close();

const report = {
  mission: "ROTA-BOARD-9X9-SYNC-01",
  generatedAt: new Date().toISOString(),
  glb: {
    file: glb.file,
    bytes: glb.bytes,
    tiles: glb.tiles.count,
    grid: `${COLS}x${ROWS}`,
    cellPitch: CELL,
    tileFootprint: glb.tiles.tileFootprint,
    tileTopY: glb.tiles.tileTopY,
    insetBed: glb.insetBed,
    frameRails: glb.frameRailsOuter,
    boardBase: glb.boardBase,
    footprint: glb.footprint.size,
    separators: glb.separators,
  },
  viewports: results,
  consoleErrors: errors,
  http4xx,
};
fs.writeFileSync(path.join(OUT, "board-alignment.json"), JSON.stringify(report, null, 2));

const fails = [];
for (const [name, r] of Object.entries(results)) {
  if (r.cellsPublished !== ROWS * COLS) fails.push(`${name}: ${r.cellsPublished} centres, expected ${ROWS * COLS}`);
  if (r.worstLogicalVsPhysicalPx > 1) fails.push(`${name}: logical vs physical ${r.worstLogicalVsPhysicalPx}px`);
  if (!r.bodyInsideCanvas) fails.push(`${name}: board body is cut by the canvas`);
  if (r.scrollY !== 0) fails.push(`${name}: page scrolls ${r.scrollY}px`);
  if (r.overflowX !== 0) fails.push(`${name}: horizontal overflow ${r.overflowX}px`);
}
if (errors.length) fails.push(`${errors.length} console error(s)`);
if (http4xx.length) fails.push(`${http4xx.length} response(s) >= 400`);

log("console errors:", errors.length, "| http>=400:", http4xx.length);
if (fails.length) {
  console.error("\nALIGNMENT FAILURES:\n" + fails.map((f) => ` - ${f}`).join("\n"));
  process.exit(1);
}
log("BOARD_ALIGNMENT_OK");
