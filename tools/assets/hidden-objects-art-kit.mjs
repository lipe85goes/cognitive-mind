/**
 * Game 03 — what every room's art script shares (GAME03-MULTISCENE-03).
 *
 * The Estúdio's script (create_hidden_objects_scene.mjs) grew these one by one
 * and keeps its own copies, so its kit v1 stays byte for byte what it shipped.
 * A new room's script takes them from here instead: reading a room's data from
 * source, the seeded painterly grain, the sRGB luminance, the measured fairness
 * audit (visible share, F4 contrast, silhouette edge — the Estúdio's method,
 * unchanged) and the review boards. Nothing here knows a room.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import sharp from "sharp";
import ts from "typescript";

/** A scene module (type-only imports) evaluated on its own. */
function loadModule(file) {
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(js, { module: mod, exports: mod.exports, require: () => ({}) });
  return mod.exports;
}

/** A room's data under its own names, with the contract's (safe margins, clearance) beside it. */
export function loadRoom(root, sceneFile) {
  return {
    ...loadModule(path.join(root, "src/games/hidden-objects/hidden-objects-scene.ts")),
    ...loadModule(path.join(root, sceneFile)),
  };
}

/** The box a region is painted into: its rect, or the square around its circle. */
export function boxOf(region) {
  return region.kind === "rect"
    ? { x: region.x, y: region.y, w: region.w, h: region.h }
    : { x: region.cx - region.r, y: region.cy - region.r, w: 2 * region.r, h: 2 * region.r };
}

export const n = (v) => Number(v.toFixed(1));

/** Draw `body` (authored in a nominal w×h box) scaled uniformly and centred into `box`. */
export function fit(body, nominal, box) {
  const s = Math.min(box.w / nominal.w, box.h / nominal.h);
  const dx = box.x + (box.w - nominal.w * s) / 2;
  const dy = box.y + (box.h - nominal.h * s) / 2;
  return `<g transform="translate(${n(dx)} ${n(dy)}) scale(${n(s * 1000) / 1000})">${body}</g>`;
}

/** mulberry32: a seeded 32-bit generator (the same room on every run). */
export function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** An SVG string, rasterised at 1 px per user unit (or `scale` of it). */
export const render = (svg, scale = 1) => sharp(Buffer.from(svg), { density: 72 * scale, limitInputPixels: false });

export const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

/** Fine painterly grain (neutral grey around 128), seeded, at half size then scaled up. */
export async function grainLayer(width, height, { sigma = 6, seed = 0x5eed_9a17 } = {}) {
  const w = Math.round(width / 2);
  const h = Math.round(height / 2);
  const random = seeded(seed);
  const noise = Buffer.alloc(w * h * 3);
  for (let i = 0; i < noise.length; i += 2) {
    // Box–Muller: two independent gaussian samples per pair of uniforms
    const radius = Math.sqrt(-2 * Math.log(1 - random()));
    const angle = 2 * Math.PI * random();
    noise[i] = Math.max(0, Math.min(255, Math.round(128 + sigma * radius * Math.cos(angle))));
    if (i + 1 < noise.length) noise[i + 1] = Math.max(0, Math.min(255, Math.round(128 + sigma * radius * Math.sin(angle))));
  }
  return sharp(noise, { raw: { width: w, height: h, channels: 3 } }).resize(width, height).grayscale().toColourspace("srgb").png().toBuffer();
}

/** Relative luminance of an sRGB pixel. */
export function luminance(r, g, b) {
  const lin = (c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * The fairness audit (Discovery §9 F1/F4), measured on the art itself — the
 * Estúdio's method:
 *   visible  — share of the target's own pixels the finished plate still shows
 *              (the plate rendered with and without it: what changed is what is seen);
 *   contrast — F4 as written: mean luminance of what is seen against a 24 su ring
 *              around it, on the composed room (light pass included);
 *   edge     — the median luminance ratio across the visible silhouette's edge
 *              (each edge pixel against the background within 3 su outside it).
 *
 * `room`: { width, height, pool, lookAlikes }; `plate({ omit })` the albedo SVG;
 * `alone(target)` an SVG of the target alone in its place; `composed` the
 * composed room's raw RGBA.
 */
export async function auditRoom({ room, plate, alone, composed }) {
  const W = room.width;
  const H = room.height;
  const rows = [];
  const withRaw = await render(plate({})).ensureAlpha().raw().toBuffer();
  for (const target of room.pool) {
    const b = boxOf(target.region);
    const pad = 40;
    const area = { left: Math.max(0, b.x - pad), top: Math.max(0, b.y - pad) };
    area.width = Math.min(W - area.left, b.w + 2 * pad);
    area.height = Math.min(H - area.top, b.h + 2 * pad);
    const withoutRaw = await render(plate({ omit: target.id })).ensureAlpha().raw().toBuffer();
    const aloneRaw = await render(alone(target)).ensureAlpha().raw().toBuffer();
    const at = (x, y) => (y * W + x) * 4;
    const changedAt = (i) =>
      Math.abs(withRaw[i] - withoutRaw[i]) + Math.abs(withRaw[i + 1] - withoutRaw[i + 1]) + Math.abs(withRaw[i + 2] - withoutRaw[i + 2]) > 24;
    const lumAt = (x, y) => {
      const i = at(x, y);
      return luminance(composed[i], composed[i + 1], composed[i + 2]);
    };
    const isMine = (x, y) => aloneRaw[at(x, y) + 3] > 128;
    const isSeen = (x, y) => isMine(x, y) && changedAt(at(x, y));
    let own = 0;
    let seen = 0;
    let lumIn = 0;
    let lumRing = 0;
    let ring = 0;
    for (let y = area.top; y < area.top + area.height; y += 1) {
      for (let x = area.left; x < area.left + area.width; x += 1) {
        const i = at(x, y);
        const changed = changedAt(i);
        const l = lumAt(x, y);
        if (isMine(x, y)) {
          own += 1;
          if (changed) {
            seen += 1;
            lumIn += l;
          }
        } else if (x >= b.x - 24 && x < b.x + b.w + 24 && y >= b.y - 24 && y < b.y + b.h + 24 && !changed) {
          ring += 1;
          lumRing += l;
        }
      }
    }
    const ratios = [];
    for (let y = area.top + 3; y < area.top + area.height - 3; y += 1) {
      for (let x = area.left + 3; x < area.left + area.width - 3; x += 1) {
        if (!isSeen(x, y)) continue;
        let outside = 0;
        let sum = 0;
        for (let dy = -3; dy <= 3; dy += 1) {
          for (let dx = -3; dx <= 3; dx += 1) {
            if (dx * dx + dy * dy > 9 || isMine(x + dx, y + dy)) continue;
            outside += 1;
            sum += lumAt(x + dx, y + dy);
          }
        }
        if (!outside) continue;
        const a = lumAt(x, y);
        const bg = sum / outside;
        ratios.push((Math.max(a, bg) + 0.05) / (Math.min(a, bg) + 0.05));
      }
    }
    ratios.sort((p, q) => p - q);
    const li = seen ? lumIn / seen : 0;
    const lr = ring ? lumRing / ring : 0;
    rows.push({
      id: target.id,
      tier: target.tier,
      visible: Number((seen / Math.max(1, own)).toFixed(3)),
      contrast: Number(((Math.max(li, lr) + 0.05) / (Math.min(li, lr) + 0.05)).toFixed(2)),
      edge: Number((ratios[Math.floor(ratios.length / 2)] ?? 1).toFixed(2)),
      lookAlikes: room.lookAlikes.filter((l) => l.resembles === target.id).map((l) => l.id),
    });
  }
  return rows;
}

/** The review overlay: station borders, the safe area, foreground paint, look-alikes (dashed) and targets by tier. */
export function debugOverlaySvg(room, margins) {
  const shape = (r, color, width, dash = "") =>
    r.kind === "rect"
      ? `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="${color}" stroke-width="${width}" ${dash}/>`
      : `<circle cx="${r.cx}" cy="${r.cy}" r="${r.r}" fill="none" stroke="${color}" stroke-width="${width}" ${dash}/>`;
  const targets = room.pool.map((t) => shape(t.region, { A: "#38f2c0", B: "#ffd23f", C: "#ff6b6b" }[t.tier], 5)).join("");
  const looks = room.lookAlikes.map((l) => shape(l.region, "#c48bff", 3, `stroke-dasharray="8 6"`)).join("");
  const safe = `<rect x="${margins.x}" y="${margins.y}" width="${room.width - 2 * margins.x}" height="${room.height - 2 * margins.y}" fill="none" stroke="#ffffff" stroke-width="3" stroke-dasharray="20 14" opacity=".8"/>`;
  const zones = room.stations.slice(0, -1).map((s) => `<path d="M${s.span.x1} 0 V${room.height}" stroke="#ffffff" stroke-width="2" opacity=".5"/>`).join("");
  const plateIndex = room.layers.findIndex((l) => l.id === "plate");
  const front = room.layers
    .slice(plateIndex + 1)
    .flatMap((l) => l.opaque)
    .map((o) => `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" fill="#ff00ff" opacity=".18"/>`)
    .join("");
  return `${zones}${safe}${front}${looks}${targets}`;
}

/** The archive's review boards for a composed room (never runtime). */
export async function writeReviewBoards({ room, composedPng, regionsPng, reviewDir, boardWidth = 1800 }) {
  const W = room.width;
  const H = room.height;
  const boardHeight = Math.round((boardWidth * H) / W);
  await sharp(composedPng).resize(boardWidth, boardHeight).webp({ quality: 86 }).toFile(path.join(reviewDir, "scene.webp"));
  await sharp(regionsPng).resize(boardWidth, boardHeight).webp({ quality: 86 }).toFile(path.join(reviewDir, "regions.webp"));
  await sharp(composedPng).resize(boardWidth, boardHeight).grayscale().webp({ quality: 86 }).toFile(path.join(reviewDir, "scene-grayscale.webp"));
  // each pool object at the desktop's maximum zoom (1.25 px/su): what "aproximar" shows (F7)
  const tiles = [];
  const columns = 6;
  const rows = Math.ceil(room.pool.length / columns);
  for (const [i, target] of room.pool.entries()) {
    const b = boxOf(target.region);
    const side = 340;
    const left = Math.round(Math.min(W - side, Math.max(0, b.x + b.w / 2 - side / 2)));
    const top = Math.round(Math.min(H - side, Math.max(0, b.y + b.h / 2 - side / 2)));
    const tile = await sharp(composedPng).extract({ left, top, width: side, height: side }).resize(425, 425).png().toBuffer();
    tiles.push({ input: tile, left: (i % columns) * 430, top: Math.floor(i / columns) * 430 });
  }
  await sharp({ create: { width: columns * 430 - 5, height: rows * 430 - 5, channels: 3, background: "#111111" } })
    .composite(tiles)
    .webp({ quality: 84 })
    .toFile(path.join(reviewDir, "targets-zoom.webp"));
}
