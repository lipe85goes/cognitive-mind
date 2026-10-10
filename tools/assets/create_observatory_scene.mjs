/**
 * Observatório do Explorador — the room's art kit (v1, GAME03-MULTISCENE-03).
 *
 * Painted here in SVG and finished with `sharp` (already a devDependency), the
 * way the Estúdio's kit is, with more passes: an albedo plate; a light pass
 * multiplied over it — the cool dusk coming through the opened dome and the
 * round window, the warm pool of the hanging lamp over the bench, a candle, a
 * small green lamp in the archive and a pierced brass lantern throwing stars on
 * the wall; a bloom pass screened on top (the lamps, the sky's glow, a moonbeam
 * across the telescope, dust in the lamplight); and a seeded painterly grain.
 * Five depth planes: the sky (behind, drifting), the room, and three
 * foreground layers (the dome's nearest rib above, a curtain and trunks on the
 * left, a lantern and a fern on the right).
 *
 * Single source of truth: every target is painted exactly where
 * `src/games/hidden-objects/scenes/explorer-observatory.ts` puts its `region`,
 * every look-alike exactly in its own, and the foreground layers only paint
 * inside that module's `opaque` rects — the module is read below.
 *
 * Writes:
 *   public/assets/hidden-objects/explorer-observatory/v1/{back,plate,front-top,front,front-right,hero}.webp
 *   public/assets/hidden-objects/explorer-observatory/v1/thumbs/<id>.webp
 *   docs/archive/hidden-objects/explorer-observatory/review/v1/*.webp (review boards)
 *   with --audit: docs/archive/hidden-objects/explorer-observatory/review/v1/fairness.json
 *
 * Usage: node tools/assets/create_observatory_scene.mjs [--audit] [--preview=DIR]
 *   --preview=DIR  renders the composed room and the review boards into DIR only (nothing else written)
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  auditRoom,
  boxOf,
  debugOverlaySvg,
  fit,
  grainLayer,
  kb,
  loadRoom,
  n,
  render,
  seeded,
  writeReviewBoards,
} from "./hidden-objects-art-kit.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2);
const AUDIT = args.includes("--audit");
const PREVIEW = args.find((arg) => arg.startsWith("--preview="))?.slice("--preview=".length) ?? null;

// --- the room the game reads ---------------------------------------------------------------------

const DATA = loadRoom(ROOT, "src/games/hidden-objects/scenes/explorer-observatory.ts");
const ROOM = DATA.EXPLORER_OBSERVATORY;
const W = ROOM.width;
const H = ROOM.height;
const TARGETS = Object.fromEntries(ROOM.pool.map((t) => [t.id, t]));
const LOOKS = Object.fromEntries(ROOM.lookAlikes.map((l) => [l.id, l]));
const LAYER = Object.fromEntries(ROOM.layers.map((l) => [l.id, l]));
const OUT = path.join(ROOT, "public", DATA.SCENE_ASSET_BASE);
const REVIEW = path.join(ROOT, "docs/archive/hidden-objects/explorer-observatory/review", path.basename(DATA.SCENE_ASSET_BASE));
const box = (id) => boxOf((TARGETS[id] ?? LOOKS[id]).region);

// --- the architecture's lines (su) -----------------------------------------------------------------

const RING_Y = 250; // the dome's ring beam: dome above, the drum's wall below
const WAINSCOT_Y = 880; // wood panelling from here to the floor
const FLOOR_Y = 1180; // where the wall meets the floor
const SLIT = { x0: 600, x1: 860, bottom: 560 }; // the dome's opened shutter
const OCULUS = { cx: 1800, cy: 460, r: 236, ring: 32 }; // the round window over the bench
const POSTS = [1240, 2384]; // timber posts between the stations
const PLATFORM = { x0: 660, x1: 1210, top: 1124, front: 1172, step: 1232 }; // the telescope's dais
const DESK = { x0: 1290, x1: 2300, top: 932, edge: 960, apron: 990, apronBottom: 1050, floor: 1250 };
const CABINET = { x0: 2680, x1: 3090, top: 904, bottom: 1180 }; // the map drawers
const CURIO = { x0: 3110, x1: 3362, top: 300, bottom: 1180 }; // the glass cabinet
const MICRO_TABLE = { x0: 2408, x1: 2662, top: 900 };

// --- shared paint ----------------------------------------------------------------------------------

const DEFS = `
  <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#9a6438"/><stop offset=".55" stop-color="#6c4124"/><stop offset="1" stop-color="#432714"/>
  </linearGradient>
  <linearGradient id="woodV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#8a5a33"/><stop offset="1" stop-color="#4a2b16"/>
  </linearGradient>
  <linearGradient id="woodH" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#9d673b"/><stop offset=".5" stop-color="#734526"/><stop offset="1" stop-color="#482a15"/>
  </linearGradient>
  <linearGradient id="woodDark" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#4c2e1a"/><stop offset="1" stop-color="#26160b"/>
  </linearGradient>
  <linearGradient id="woodLight" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#c79563"/><stop offset="1" stop-color="#8d5d34"/>
  </linearGradient>
  <linearGradient id="walnut" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#5a3620"/><stop offset=".5" stop-color="#6e4428"/><stop offset="1" stop-color="#3d2413"/>
  </linearGradient>
  <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f6dc92"/><stop offset=".45" stop-color="#c79a46"/><stop offset="1" stop-color="#7a5521"/>
  </linearGradient>
  <linearGradient id="brassV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f3d68a"/><stop offset=".5" stop-color="#bf8f3f"/><stop offset="1" stop-color="#6e4b1c"/>
  </linearGradient>
  <linearGradient id="brassH" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#7e5a24"/><stop offset=".35" stop-color="#e9c97c"/><stop offset=".6" stop-color="#c39443"/><stop offset="1" stop-color="#6e4b1c"/>
  </linearGradient>
  <radialGradient id="brassBall" cx=".35" cy=".3" r=".75">
    <stop offset="0" stop-color="#fff0c0"/><stop offset=".35" stop-color="#e2b660"/><stop offset="1" stop-color="#6e4b1c"/>
  </radialGradient>
  <linearGradient id="steel" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#3a3f48"/><stop offset=".45" stop-color="#a7adb6"/><stop offset=".6" stop-color="#6c727c"/><stop offset="1" stop-color="#2a2e35"/>
  </linearGradient>
  <linearGradient id="iron" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#5b5752"/><stop offset="1" stop-color="#24211e"/>
  </linearGradient>
  <linearGradient id="enamel" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fbf3df"/><stop offset=".45" stop-color="#e7d8b6"/><stop offset="1" stop-color="#9b8a68"/>
  </linearGradient>
  <linearGradient id="parchment" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f6e7c3"/><stop offset=".6" stop-color="#e6cf9c"/><stop offset="1" stop-color="#c8a971"/>
  </linearGradient>
  <linearGradient id="page" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fbf2dc"/><stop offset="1" stop-color="#e2cfa4"/>
  </linearGradient>
  <linearGradient id="plaster" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2b3352"/><stop offset=".55" stop-color="#334063"/><stop offset="1" stop-color="#3c4a6c"/>
  </linearGradient>
  <linearGradient id="domePlank" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#22160f"/><stop offset="1" stop-color="#3f2817"/>
  </linearGradient>
  <linearGradient id="velvet" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#0d2a2f"/><stop offset=".4" stop-color="#1f4a50"/><stop offset=".7" stop-color="#143a40"/><stop offset="1" stop-color="#0b2226"/>
  </linearGradient>
  <linearGradient id="glassPane" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#cfe6f0" stop-opacity=".5"/><stop offset=".5" stop-color="#88a9b8" stop-opacity=".14"/><stop offset="1" stop-color="#e8f4fa" stop-opacity=".34"/>
  </linearGradient>
  <radialGradient id="glassJar" cx=".35" cy=".3" r=".8">
    <stop offset="0" stop-color="#e9f5f2" stop-opacity=".85"/><stop offset=".5" stop-color="#8fb6ad" stop-opacity=".5"/><stop offset="1" stop-color="#3f6a62" stop-opacity=".75"/>
  </radialGradient>
  <radialGradient id="lens" cx=".38" cy=".34" r=".75">
    <stop offset="0" stop-color="#e2f4ff"/><stop offset=".4" stop-color="#7fb2cf"/><stop offset="1" stop-color="#1d3d54"/>
  </radialGradient>
  <radialGradient id="flame" cx=".5" cy=".7" r=".6">
    <stop offset="0" stop-color="#fffbe8"/><stop offset=".35" stop-color="#ffe08a"/><stop offset=".75" stop-color="#ff9a3c"/><stop offset="1" stop-color="#ff7a20" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="ambGlass" cx=".5" cy=".35" r=".7">
    <stop offset="0" stop-color="#fff3c8"/><stop offset=".45" stop-color="#f6b65a"/><stop offset="1" stop-color="#9c5a1c"/>
  </radialGradient>
  <radialGradient id="greenGlass" cx=".5" cy=".35" r=".75">
    <stop offset="0" stop-color="#b8f0c8"/><stop offset=".5" stop-color="#2f8a5c"/><stop offset="1" stop-color="#103d28"/>
  </radialGradient>
  <linearGradient id="rugField" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#173a4a"/><stop offset="1" stop-color="#0f2833"/>
  </linearGradient>
  <linearGradient id="fur" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f0a85a"/><stop offset=".6" stop-color="#c97a34"/><stop offset="1" stop-color="#8a4f1f"/>
  </linearGradient>
  <linearGradient id="owlFeather" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#b98653"/><stop offset=".6" stop-color="#8a5a32"/><stop offset="1" stop-color="#5c3a1f"/>
  </linearGradient>
  <linearGradient id="mouseFur" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#b9b2ab"/><stop offset="1" stop-color="#7d756e"/>
  </linearGradient>
  <linearGradient id="violinVarnish" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f0a252"/><stop offset=".5" stop-color="#b9611f"/><stop offset="1" stop-color="#6e3210"/>
  </linearGradient>
  <linearGradient id="slipper" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f0b850"/><stop offset="1" stop-color="#b9792a"/>
  </linearGradient>
  <linearGradient id="appleRed" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ff8a66"/><stop offset=".45" stop-color="#e2392f"/><stop offset="1" stop-color="#9a1e18"/>
  </linearGradient>
  <linearGradient id="porcelain" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#b8b4a8"/><stop offset=".35" stop-color="#fdfaf2"/><stop offset=".7" stop-color="#e6e0d0"/><stop offset="1" stop-color="#9c978a"/>
  </linearGradient>
  <radialGradient id="contact" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#000" stop-opacity=".55"/><stop offset="1" stop-color="#000" stop-opacity="0"/>
  </radialGradient>
  <filter id="soft2" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2"/></filter>
  <filter id="soft6" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="soft14" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="14"/></filter>
`;

/** A soft contact shadow under something resting on a surface. */
const shadow = (cx, cy, rx, ry, opacity = 0.8) =>
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="url(#contact)" opacity="${opacity}"/>`;

/** A blurred dark band where two surfaces meet (ambient occlusion). */
const occlusion = (x, y, w, h, opacity = 0.5) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#000" opacity="${opacity}" filter="url(#soft6)"/>`;

const BOOK_COLORS = ["#7a3024", "#2d4a68", "#4a6a3a", "#86582b", "#5a3b5c", "#9c7230", "#2f5d58", "#683040", "#3c3833", "#94482a", "#bba57c", "#365169", "#6d5a3a", "#4f2d24", "#21324f", "#8b6b3d"];

function book(x, y, w, h, color, { band = "#d4ad62", tilt = 0, pivot = "bottom" } = {}) {
  const px = x + w / 2;
  const py = pivot === "bottom" ? y + h : y;
  const t = tilt ? ` transform="rotate(${tilt} ${n(px)} ${n(py)})"` : "";
  return `<g${t}>
    <rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="2" fill="${color}"/>
    <rect x="${n(x)}" y="${n(y)}" width="${n(w * 0.28)}" height="${n(h)}" fill="#fff" opacity=".08"/>
    <rect x="${n(x + w * 0.78)}" y="${n(y)}" width="${n(w * 0.22)}" height="${n(h)}" fill="#000" opacity=".22"/>
    <rect x="${n(x + 2)}" y="${n(y + h * 0.14)}" width="${n(w - 4)}" height="3" fill="${band}" opacity=".9"/>
    <rect x="${n(x + 2)}" y="${n(y + h * 0.8)}" width="${n(w - 4)}" height="3" fill="${band}" opacity=".9"/>
  </g>`;
}

/** Standing books from x0 along a shelf whose top surface is at `floor`. */
function bookRun(x0, floor, count, seed, { minH = 70, maxH = 120, minW = 14, maxW = 26, gap = 1.5, lean = null } = {}) {
  const rnd = seeded(seed);
  let x = x0;
  let svg = "";
  for (let i = 0; i < count; i += 1) {
    const w = minW + rnd() * (maxW - minW);
    const h = minH + rnd() * (maxH - minH);
    svg += book(x, floor - h, w, h, BOOK_COLORS[Math.floor(rnd() * BOOK_COLORS.length)]);
    x += w + gap;
  }
  if (lean) svg += book(x + 2, floor - lean.h, lean.w, lean.h, lean.color, { tilt: lean.tilt });
  return { svg, end: x };
}

/** Books lying flat, bottom one at `floor`: [width, height, colour, x offset]. */
function bookStack(x, floor, specs) {
  let y = floor;
  return specs
    .map(([w, h, color, dx = 0]) => {
      y -= h;
      return `<rect x="${x + dx}" y="${y}" width="${w}" height="${h}" rx="2" fill="${color}"/>
        <rect x="${x + dx}" y="${y}" width="${w}" height="3" fill="#fff" opacity=".14"/>
        <rect x="${x + dx + 4}" y="${y + h / 2 - 1}" width="${w - 8}" height="2" fill="#e7cf98" opacity=".7"/>`;
    })
    .join("");
}

/** A small five-pointed star path centred at (cx, cy). */
function starPath(cx, cy, r, inner = 0.45) {
  const pts = [];
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * inner;
    pts.push(`${n(cx + Math.cos(a) * rr)} ${n(cy + Math.sin(a) * rr)}`);
  }
  return `M${pts.join(" L")} Z`;
}

// --- the eighteen targets (each authored in its own nominal box) --------------------------------------

/**
 * Each object as SVG in a nominal box; `targetSvg` fits it into its region.
 * `view` (optional): the nominal box the thumbnail shows when the object
 * reaches past its region (a kite's tail, a bow).
 */
const ART = {
  coruja: {
    nominal: { w: 100, h: 136 },
    body: `
      <path d="M22 132 C16 104 14 70 24 46 C32 26 44 18 50 18 C56 18 68 26 76 46 C86 70 84 104 78 132 Z" fill="url(#owlFeather)" stroke="#e9c48c" stroke-width="3"/>
      <path d="M30 118 C26 96 28 74 38 62 L62 62 C72 74 74 96 70 118 C62 126 38 126 30 118 Z" fill="#e7c896"/>
      ${[0, 1, 2, 3].map((r) => [0, 1, 2].map((c) => `<path d="M${38 + c * 10} ${74 + r * 11} l4 5 l4 -5" stroke="#8a5a32" stroke-width="1.8" fill="none"/>`).join("")).join("")}
      <path d="M22 70 C10 86 12 110 22 128 C26 108 28 88 30 74 Z" fill="#7a4c27"/>
      <path d="M78 70 C90 86 88 110 78 128 C74 108 72 88 70 74 Z" fill="#7a4c27"/>
      <path d="M26 30 L20 6 L38 22 Z" fill="#a8743f" stroke="#e9c48c" stroke-width="2"/>
      <path d="M74 30 L80 6 L62 22 Z" fill="#a8743f" stroke="#e9c48c" stroke-width="2"/>
      <path d="M50 22 C34 22 22 34 22 48 C22 62 36 66 50 60 C64 66 78 62 78 48 C78 34 66 22 50 22 Z" fill="#f2dcb0" stroke="#9a6a3a" stroke-width="1.5"/>
      <circle cx="37" cy="44" r="11" fill="#2a1a0c"/><circle cx="63" cy="44" r="11" fill="#2a1a0c"/>
      <circle cx="37" cy="44" r="8.5" fill="#f2a823"/><circle cx="63" cy="44" r="8.5" fill="#f2a823"/>
      <circle cx="37" cy="44" r="4.6" fill="#120a04"/><circle cx="63" cy="44" r="4.6" fill="#120a04"/>
      <circle cx="35" cy="41.5" r="2" fill="#fff"/><circle cx="61" cy="41.5" r="2" fill="#fff"/>
      <path d="M46 52 L50 62 L54 52 Z" fill="#d79b3c" stroke="#7a4c1a" stroke-width="1"/>
      <path d="M36 130 l-4 6 M42 130 l0 6 M58 130 l0 6 M64 130 l4 6" stroke="#d8a64a" stroke-width="3" stroke-linecap="round"/>`,
  },
  pipa: {
    nominal: { w: 124, h: 220 },
    view: { x: -10, y: -10, w: 150, h: 300 },
    body: `
      <path d="M62 6 L60 0" stroke="#2a1a0c" stroke-width="2"/>
      <circle cx="62" cy="4" r="3" fill="#8a8580"/>
      <path d="M62 6 L118 70 L62 176 L6 70 Z" fill="#f2c94a"/>
      <path d="M62 6 L118 70 L62 70 Z" fill="#e2483a"/>
      <path d="M62 70 L62 176 L6 70 Z" fill="#2f78b5"/>
      <path d="M62 6 L6 70 L62 70 Z" fill="#f6e3a0"/>
      <path d="M62 70 L118 70 L62 176 Z" fill="#3aa36b"/>
      <path d="M62 6 L62 176 M6 70 L118 70" stroke="#6e4a26" stroke-width="3"/>
      <path d="M62 6 L118 70 L62 176 L6 70 Z" fill="none" stroke="#fff3d0" stroke-width="3.5"/>
      <circle cx="62" cy="70" r="7" fill="#f6e3a0" stroke="#6e4a26" stroke-width="2"/>
      <path d="M62 176 C70 196 52 210 64 232 C74 252 54 266 62 286" stroke="#efe2c4" stroke-width="2.2" fill="none"/>
      ${[[64, 196, "#e2483a"], [58, 222, "#2f78b5"], [66, 250, "#f2c94a"], [60, 276, "#3aa36b"]].map(([x, y, c]) => `<path d="M${x - 9} ${y - 5} L${x} ${y} L${x - 9} ${y + 5} Z M${x + 9} ${y - 5} L${x} ${y} L${x + 9} ${y + 5} Z" fill="${c}"/>`).join("")}`,
  },
  luneta: {
    nominal: { w: 176, h: 50 },
    body: `
      <g transform="rotate(-4 88 25)">
        <rect x="2" y="9" width="70" height="32" rx="5" fill="#5c3a22"/>
        ${[8, 18, 28, 38, 48, 58].map((x) => `<rect x="${x}" y="9" width="4" height="32" fill="#3e2615" opacity=".5"/>`).join("")}
        <rect x="0" y="7" width="8" height="36" rx="2" fill="url(#brassV)"/>
        <circle cx="4" cy="25" r="13" fill="url(#lens)" opacity=".85"/>
        <rect x="68" y="11" width="10" height="28" rx="2" fill="url(#brassV)"/>
        <rect x="78" y="13" width="46" height="24" rx="3" fill="url(#brassV)"/>
        <rect x="120" y="12" width="7" height="26" rx="2" fill="#7a5521"/>
        <rect x="127" y="15" width="34" height="20" rx="3" fill="url(#brassV)"/>
        <rect x="158" y="13" width="8" height="24" rx="2" fill="#6e4b1c"/>
        <rect x="166" y="17" width="10" height="16" rx="3" fill="#2a1a0c"/>
        <rect x="80" y="15" width="40" height="4" fill="#fff6d2" opacity=".55"/>
        <rect x="129" y="17" width="30" height="3" fill="#fff6d2" opacity=".55"/>
      </g>`,
  },
  pantufas: {
    nominal: { w: 132, h: 58 },
    body: `
      ${shadow(66, 52, 64, 8, 0.7)}
      <g>
        <path d="M2 44 C2 30 14 24 30 24 L50 22 C60 22 64 30 64 38 C64 48 58 54 46 54 L14 54 C6 54 2 50 2 44 Z" fill="url(#slipper)" stroke="#fbe6b4" stroke-width="2.5"/>
        <path d="M2 46 C2 52 8 56 16 56 L46 56 C56 56 62 52 63 46" stroke="#6e4214" stroke-width="3" fill="none"/>
        <ellipse cx="46" cy="32" rx="14" ry="8" fill="#3a2410"/>
        <ellipse cx="46" cy="32" rx="16" ry="9.5" fill="none" stroke="#fbf1dc" stroke-width="4"/>
        <circle cx="16" cy="30" r="7" fill="#fbf1dc"/>
        <path d="M8 40 C14 34 24 32 32 32" stroke="#fff3cc" stroke-width="3" opacity=".6" fill="none"/>
      </g>
      <g>
        <path d="M68 46 C68 32 80 26 96 26 L116 24 C126 24 130 32 130 40 C130 50 124 56 112 56 L80 56 C72 56 68 52 68 46 Z" fill="url(#slipper)" stroke="#fbe6b4" stroke-width="2.5"/>
        <path d="M68 48 C68 54 74 58 82 58 L112 58 C122 58 128 54 129 48" stroke="#6e4214" stroke-width="3" fill="none"/>
        <ellipse cx="112" cy="34" rx="14" ry="8" fill="#3a2410"/>
        <ellipse cx="112" cy="34" rx="16" ry="9.5" fill="none" stroke="#fbf1dc" stroke-width="4"/>
        <circle cx="82" cy="32" r="7" fill="#fbf1dc"/>
        <path d="M74 42 C80 36 90 34 98 34" stroke="#fff3cc" stroke-width="3" opacity=".6" fill="none"/>
      </g>`,
  },
  oculos: {
    nominal: { w: 96, h: 40 },
    body: `
      <path d="M8 14 L2 6 M88 14 L94 6" stroke="#caa24f" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="26" cy="22" r="16" fill="url(#lens)" opacity=".55" stroke="#e2bb63" stroke-width="3.6"/>
      <circle cx="70" cy="22" r="16" fill="url(#lens)" opacity=".55" stroke="#e2bb63" stroke-width="3.6"/>
      <path d="M42 20 C46 14 50 14 54 20" stroke="#e2bb63" stroke-width="3.2" fill="none"/>
      <path d="M18 14 C22 11 26 11 30 13" stroke="#fff" stroke-width="2" opacity=".8" fill="none"/>
      <path d="M62 14 C66 11 70 11 74 13" stroke="#fff" stroke-width="2" opacity=".8" fill="none"/>
      <path d="M10 22 L4 34 M86 22 L92 34" stroke="#b8913f" stroke-width="2.2" stroke-linecap="round"/>`,
  },
  ratinho: {
    nominal: { w: 100, h: 54 },
    body: `
      <path d="M58 46 C74 46 86 40 94 30 C98 24 96 18 92 16" stroke="#d8a8a0" stroke-width="3" fill="none" stroke-linecap="round"/>
      <ellipse cx="42" cy="34" rx="30" ry="18" fill="url(#mouseFur)" stroke="#4e4842" stroke-width="1.6"/>
      <path d="M16 36 C12 26 16 16 26 14" fill="url(#mouseFur)"/>
      <ellipse cx="18" cy="30" rx="16" ry="13" fill="url(#mouseFur)" stroke="#4e4842" stroke-width="1.6"/>
      <circle cx="22" cy="14" r="9" fill="#a79f97" stroke="#4e4842" stroke-width="1.5"/>
      <circle cx="22" cy="14" r="5.5" fill="#e9b4ae"/>
      <circle cx="34" cy="18" r="8" fill="#a79f97" stroke="#4e4842" stroke-width="1.5"/>
      <circle cx="34" cy="18" r="4.5" fill="#e9b4ae"/>
      <circle cx="10" cy="29" r="3.2" fill="#120c08"/><circle cx="9" cy="28" r="1.1" fill="#fff"/>
      <circle cx="3" cy="35" r="2.6" fill="#d98a86"/>
      <path d="M5 36 L-6 32 M5 37 L-6 38 M6 38 L-4 43" stroke="#efe8e0" stroke-width="1" opacity=".9"/>
      <path d="M30 44 C40 48 54 48 64 44" stroke="#e8e2da" stroke-width="2" fill="none" opacity=".6"/>`,
  },
  "sistema-solar": {
    nominal: { w: 216, h: 214 },
    body: `
      ${shadow(108, 206, 86, 10, 0.8)}
      <path d="M44 214 L172 214 L160 194 L56 194 Z" fill="url(#walnut)" stroke="#2a170b" stroke-width="2"/>
      <ellipse cx="108" cy="194" rx="52" ry="7" fill="#8a5a33"/>
      <rect x="102" y="96" width="12" height="98" fill="url(#brassH)"/>
      <ellipse cx="108" cy="98" rx="96" ry="26" fill="none" stroke="#d8b25e" stroke-width="2.5" opacity=".9"/>
      <ellipse cx="108" cy="98" rx="66" ry="17" fill="none" stroke="#d8b25e" stroke-width="2" opacity=".9"/>
      <ellipse cx="108" cy="98" rx="38" ry="10" fill="none" stroke="#d8b25e" stroke-width="2" opacity=".9"/>
      <path d="M108 98 L22 114 M108 98 L184 82 M108 98 L150 112 M108 98 L80 80" stroke="url(#brassH)" stroke-width="3"/>
      <circle cx="108" cy="92" r="26" fill="url(#brassBall)"/>
      <circle cx="108" cy="92" r="26" fill="#ffcf5a" opacity=".55"/>
      <circle cx="100" cy="84" r="7" fill="#fff8d8" opacity=".85"/>
      <path d="M22 114 L22 100 M184 82 L184 66 M150 112 L150 98 M80 80 L80 64" stroke="url(#brassH)" stroke-width="3"/>
      <circle cx="22" cy="96" r="13" fill="#d76a3a" stroke="#6a2a10" stroke-width="1.5"/>
      <circle cx="18" cy="92" r="4" fill="#fff" opacity=".5"/>
      <circle cx="184" cy="60" r="17" fill="#d8a96a" stroke="#6e4a20" stroke-width="1.5"/>
      <path d="M168 56 C176 54 192 54 200 56 M168 63 C176 61 192 61 200 63" stroke="#8a5a2a" stroke-width="2" fill="none"/>
      <circle cx="150" cy="94" r="12" fill="#3a7fc4" stroke="#163e66" stroke-width="1.5"/>
      <path d="M144 90 C148 88 152 90 154 94 C150 96 146 96 144 90 Z" fill="#5ab06a"/>
      <circle cx="146" cy="90" r="3" fill="#fff" opacity=".55"/>
      <circle cx="166" cy="86" r="4" fill="#d9d4c8"/>
      <ellipse cx="80" cy="58" rx="24" ry="6" fill="none" stroke="#e8d29a" stroke-width="3"/>
      <circle cx="80" cy="58" r="12" fill="#e6c47c" stroke="#7a5a26" stroke-width="1.5"/>
      <path d="M58 58 C66 62 94 62 102 58" stroke="#e8d29a" stroke-width="3" fill="none"/>`,
  },
  vela: {
    nominal: { w: 64, h: 150 },
    body: `
      ${shadow(32, 146, 30, 5)}
      <ellipse cx="32" cy="140" rx="30" ry="9" fill="url(#brass)" stroke="#5e3f14" stroke-width="1.5"/>
      <ellipse cx="32" cy="137" rx="24" ry="6" fill="#e6c375"/>
      <path d="M56 136 C66 134 66 120 56 120" stroke="url(#brass)" stroke-width="5" fill="none"/>
      <rect x="24" y="116" width="16" height="22" fill="url(#brassH)"/>
      <ellipse cx="32" cy="116" rx="13" ry="4" fill="url(#brass)"/>
      <rect x="22" y="46" width="20" height="72" rx="2" fill="#f4ead2"/>
      <rect x="22" y="46" width="7" height="72" fill="#fff" opacity=".45"/>
      <rect x="36" y="46" width="6" height="72" fill="#b9a988" opacity=".55"/>
      <path d="M22 50 C22 60 18 64 20 72 C22 64 25 58 26 50 Z M40 48 C42 58 44 62 42 70 C40 62 38 56 38 48 Z" fill="#fbf4e2"/>
      <ellipse cx="32" cy="46" rx="10" ry="3" fill="#e9dcbc"/>
      <path d="M32 46 L32 38" stroke="#2a1a0c" stroke-width="2"/>
      <path d="M32 4 C40 18 42 28 38 36 C36 40 28 40 26 36 C22 28 24 18 32 4 Z" fill="url(#flame)"/>
      <path d="M32 18 C35 26 35 32 33 36 C31 37 30 34 30 30 C30 26 31 22 32 18 Z" fill="#fffef4"/>`,
  },
  compasso: {
    nominal: { w: 76, h: 112 },
    body: `
      <g transform="rotate(10 38 56)">
        <rect x="32" y="0" width="12" height="18" rx="3" fill="url(#brassH)"/>
        ${[3, 7, 11, 15].map((y) => `<rect x="32" y="${y}" width="12" height="1.5" fill="#6e4b1c"/>`).join("")}
        <circle cx="38" cy="24" r="9" fill="url(#brass)" stroke="#5e3f14" stroke-width="1.5"/>
        <path d="M34 28 L14 106 L19 108 L38 32 Z" fill="url(#steel)" stroke="#20242a" stroke-width="1.2"/>
        <path d="M42 28 L62 98 L57 100 L38 32 Z" fill="url(#steel)" stroke="#20242a" stroke-width="1.2"/>
        <path d="M14 106 L12 112 L18 108 Z" fill="#1a1d22"/>
        <rect x="55" y="94" width="9" height="12" rx="1.5" fill="url(#brassV)" transform="rotate(-16 59 100)"/>
        <path d="M58 104 L61 112" stroke="#3a3530" stroke-width="3"/>
        <circle cx="38" cy="24" r="3" fill="#fff4cf"/>
      </g>`,
  },
  bule: {
    nominal: { w: 124, h: 92 },
    body: `
      ${shadow(62, 88, 46, 6)}
      <path d="M100 46 C118 40 122 24 114 18 C110 26 104 34 94 38" stroke="url(#porcelain)" stroke-width="7" fill="none" stroke-linecap="round"/>
      <path d="M14 40 C2 42 0 64 16 70" stroke="url(#porcelain)" stroke-width="8" fill="none"/>
      <path d="M22 30 C22 22 40 18 62 18 C84 18 100 22 100 30 L104 70 C104 84 86 90 62 90 C38 90 20 84 20 70 Z" fill="url(#porcelain)" stroke="#6a665c" stroke-width="1.8"/>
      <path d="M22 50 C40 56 84 56 102 50 L102 58 C84 64 40 64 22 58 Z" fill="#2b5c9a" opacity=".85"/>
      ${[34, 50, 66, 82].map((x) => `<circle cx="${x}" cy="54" r="3" fill="#f4f0e6"/>`).join("")}
      <ellipse cx="62" cy="22" rx="34" ry="7" fill="#efeadd" stroke="#6a665c" stroke-width="1.5"/>
      <ellipse cx="62" cy="14" rx="9" ry="6" fill="#efeadd" stroke="#6a665c" stroke-width="1.5"/>
      <path d="M30 34 C30 60 32 74 36 82" stroke="#fff" stroke-width="5" opacity=".6" fill="none"/>`,
  },
  sino: {
    nominal: { w: 70, h: 84 },
    body: `
      ${shadow(35, 82, 30, 4)}
      <rect x="29" y="0" width="12" height="26" rx="5" fill="url(#walnut)"/>
      <circle cx="35" cy="4" r="6" fill="#6e4428"/>
      <rect x="27" y="24" width="16" height="6" rx="2" fill="url(#brass)"/>
      <path d="M35 28 C20 28 16 42 14 56 C12 66 8 72 4 76 L66 76 C62 72 58 66 56 56 C54 42 50 28 35 28 Z" fill="url(#brass)" stroke="#fbe3a0" stroke-width="2.2"/>
      <ellipse cx="35" cy="76" rx="31" ry="5" fill="#7a5521"/>
      <path d="M22 40 C20 52 18 62 14 70" stroke="#fff3c8" stroke-width="4" opacity=".7" fill="none"/>
      <circle cx="35" cy="80" r="4" fill="#6e4b1c"/>`,
  },
  maca: {
    nominal: { w: 64, h: 62 },
    body: `
      ${shadow(32, 60, 24, 4)}
      <path d="M32 18 C24 10 8 12 6 30 C4 46 16 60 26 60 C29 60 30 58 32 58 C34 58 35 60 38 60 C48 60 60 46 58 30 C56 12 40 10 32 18 Z" fill="url(#appleRed)" stroke="#ffb09a" stroke-width="2"/>
      <path d="M32 18 C33 12 34 8 36 4" stroke="#4a2c12" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M36 8 C44 0 54 2 56 8 C48 12 40 12 36 8 Z" fill="#4c9a3a" stroke="#285a1c" stroke-width="1"/>
      <ellipse cx="18" cy="28" rx="6" ry="9" fill="#fff" opacity=".45" transform="rotate(-20 18 28)"/>`,
  },
  violino: {
    nominal: { w: 90, h: 260 },
    body: `
      <path d="M40 6 C33 10 33 18 40 20 C47 22 47 30 40 32" stroke="#c0702c" stroke-width="8" fill="none"/>
      <rect x="34" y="18" width="12" height="70" rx="3" fill="#c0702c"/>
      <rect x="37" y="18" width="6" height="70" rx="2" fill="#2a1a10"/>
      <path d="M30 26 L36 26 M44 30 L50 30 M30 34 L36 34 M44 38 L50 38" stroke="#1a0f08" stroke-width="3" stroke-linecap="round"/>
      <path d="M40 86 C18 86 10 100 12 118 C14 132 22 136 22 146 C22 152 14 158 12 176 C10 206 26 226 40 226 C54 226 70 206 68 176 C66 158 58 152 58 146 C58 136 66 132 68 118 C70 100 62 86 40 86 Z" fill="url(#violinVarnish)" stroke="#f6b468" stroke-width="2.5"/>
      <path d="M40 92 C24 92 18 104 20 118 C22 130 28 136 28 146 C28 154 20 160 18 176 C16 200 28 218 40 218 C52 218 64 200 62 176 C60 160 52 154 52 146 C52 136 58 130 60 118 C62 104 56 92 40 92 Z" fill="none" stroke="#f6c07a" stroke-width="1.5" opacity=".7"/>
      <path d="M28 142 C24 152 30 162 26 172 M52 142 C56 152 50 162 54 172" stroke="#1a0b03" stroke-width="2.5" fill="none"/>
      <rect x="34" y="176" width="12" height="6" fill="#e9d8b0"/>
      <path d="M37 20 L37 208 M39 20 L39 208 M41 20 L41 208 M43 20 L43 208" stroke="#efe6d2" stroke-width=".8" opacity=".9"/>
      <path d="M32 200 L48 200 L46 214 L34 214 Z" fill="#1a0f08"/>
      <path d="M22 110 C20 124 24 132 28 138" stroke="#ffd8a0" stroke-width="5" opacity=".45" fill="none"/>`,
  },
  gramofone: {
    nominal: { w: 220, h: 290 },
    body: `
      ${shadow(126, 286, 92, 8, 0.8)}
      <rect x="40" y="214" width="170" height="72" rx="6" fill="url(#wood)" stroke="#c99060" stroke-width="2.5"/>
      <rect x="48" y="222" width="154" height="56" rx="4" fill="none" stroke="#a87545" stroke-width="2"/>
      <rect x="40" y="206" width="170" height="12" rx="3" fill="#7a4a28"/>
      <ellipse cx="124" cy="204" rx="74" ry="10" fill="#141210"/>
      <ellipse cx="124" cy="202" rx="70" ry="8" fill="#26221e"/>
      <ellipse cx="124" cy="202" rx="16" ry="3" fill="#c94a3a"/>
      <path d="M212 236 L226 236 L226 252" stroke="url(#brassH)" stroke-width="5" fill="none"/>
      <rect x="220" y="248" width="10" height="16" rx="2" fill="#2a1a0c"/>
      <path d="M186 206 L186 168 C186 150 172 140 156 132" stroke="url(#brassH)" stroke-width="12" fill="none" stroke-linecap="round"/>
      <path d="M186 206 L150 198" stroke="#a37a3a" stroke-width="5"/>
      <path d="M156 132 C130 116 112 98 100 78" stroke="url(#brassH)" stroke-width="20" fill="none" stroke-linecap="round"/>
      <path d="M108 92 C90 70 70 56 38 52 C14 50 0 60 2 74 C4 86 22 92 40 92 C60 92 80 96 96 108 Z" fill="url(#brass)" stroke="#5e3f14" stroke-width="2"/>
      <path d="M104 84 C80 40 30 10 6 14 C-8 18 -4 52 14 70 C34 90 70 96 100 104 Z" fill="url(#brass)" stroke="#fbe3a0" stroke-width="3"/>
      <path d="M100 98 C78 52 34 22 10 26" stroke="#fff3c8" stroke-width="5" opacity=".55" fill="none"/>
      <path d="M100 100 C70 70 40 50 12 46 M100 100 C64 84 36 76 6 66 M98 92 C74 46 44 24 22 18" stroke="#8a6326" stroke-width="2" fill="none" opacity=".8"/>
      <ellipse cx="34" cy="48" rx="26" ry="34" fill="#3a2410" opacity=".55" transform="rotate(-30 34 48)"/>`,
  },
  microscopio: {
    nominal: { w: 110, h: 186 },
    body: `
      ${shadow(56, 182, 50, 6, 0.8)}
      <path d="M14 182 C14 168 30 160 56 160 C82 160 98 168 98 182 Z" fill="url(#iron)" stroke="#141210" stroke-width="2"/>
      <path d="M22 178 C24 168 40 164 56 164" stroke="#8a8680" stroke-width="2" fill="none" opacity=".6"/>
      <rect x="72" y="96" width="14" height="66" rx="3" fill="url(#brassH)"/>
      <path d="M86 104 C96 108 98 120 92 128" stroke="url(#brassH)" stroke-width="10" fill="none" stroke-linecap="round"/>
      <rect x="24" y="118" width="60" height="9" rx="2" fill="url(#iron)"/>
      <rect x="34" y="114" width="14" height="5" fill="#d8d0c4"/>
      <circle cx="40" cy="146" r="11" fill="url(#lens)" stroke="url(#brass)" stroke-width="4"/>
      <path d="M58 22 L72 30 L52 112 L36 104 Z" fill="url(#brassH)" stroke="#5e3f14" stroke-width="1.8"/>
      <path d="M38 102 L54 110 L50 120 L34 112 Z" fill="#3a3530"/>
      <rect x="52" y="4" width="22" height="22" rx="3" fill="url(#brassH)" transform="rotate(16 63 15)"/>
      <rect x="54" y="0" width="18" height="6" rx="2" fill="#2a1a0c" transform="rotate(16 63 3)"/>
      <circle cx="80" cy="66" r="9" fill="url(#brass)" stroke="#5e3f14" stroke-width="1.5"/>
      <circle cx="80" cy="66" r="3" fill="#fff3c8"/>
      <path d="M60 30 L46 96" stroke="#fff3c8" stroke-width="4" opacity=".55"/>`,
  },
  gato: {
    nominal: { w: 150, h: 78 },
    body: `
      ${shadow(78, 74, 70, 7, 0.75)}
      <path d="M10 70 C4 52 18 30 48 24 C80 18 118 22 136 40 C148 52 146 70 132 74 L18 76 C14 76 11 73 10 70 Z" fill="url(#fur)" stroke="#ffd29a" stroke-width="2.5"/>
      ${[40, 58, 76, 94, 110].map((x) => `<path d="M${x} 24 C${x + 4} 34 ${x + 2} 46 ${x - 2} 56" stroke="#9a5a22" stroke-width="5" fill="none" opacity=".8"/>`).join("")}
      <path d="M118 62 C138 70 144 56 132 48 C124 44 114 50 106 58" fill="#d58b40" stroke="#5a3010" stroke-width="1.6"/>
      <path d="M8 66 C2 50 10 38 26 36 C42 34 52 44 50 58 C48 70 34 76 20 74 C14 72 10 70 8 66 Z" fill="url(#fur)" stroke="#ffd29a" stroke-width="2.5"/>
      <path d="M12 42 L10 22 L24 36 Z M34 36 L42 18 L46 38 Z" fill="#d58b40" stroke="#5a3010" stroke-width="1.6"/>
      <path d="M14 38 L13 28 L20 35 Z M37 36 L42 25 L43 36 Z" fill="#f0b8a8"/>
      <path d="M18 54 C21 56 24 56 26 54 M32 54 C35 56 38 56 40 54" stroke="#3a1a08" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M27 60 L30 62 L33 60 Z" fill="#c96a5a"/>
      <path d="M30 63 L4 60 M30 64 L6 66 M30 63 L56 60 M30 64 L54 66" stroke="#fff5e6" stroke-width=".9" opacity=".85"/>
      <path d="M40 30 C70 24 100 26 124 36" stroke="#ffd29a" stroke-width="4" opacity=".55" fill="none"/>`,
  },
  balanca: {
    nominal: { w: 104, h: 92 },
    body: `
      ${shadow(52, 90, 34, 4)}
      <path d="M30 90 L74 90 L66 80 L38 80 Z" fill="url(#walnut)" stroke="#2a170b" stroke-width="1.5"/>
      <rect x="49" y="12" width="6" height="70" fill="url(#brassH)"/>
      <circle cx="52" cy="10" r="6" fill="url(#brass)" stroke="#5e3f14" stroke-width="1.2"/>
      <path d="M52 8 L52 2" stroke="#7a5521" stroke-width="3"/>
      <path d="M6 22 L98 22" stroke="url(#brassH)" stroke-width="5" stroke-linecap="round"/>
      <path d="M52 22 L52 30" stroke="#5e3f14" stroke-width="2"/>
      <path d="M10 22 L2 58 M10 22 L18 58 M94 22 L86 58 M94 22 L102 58" stroke="#b8913f" stroke-width="1.6"/>
      <path d="M0 58 C2 68 18 68 20 58 Z" fill="url(#brass)" stroke="#5e3f14" stroke-width="1.5"/>
      <path d="M84 58 C86 68 102 68 104 58 Z" fill="url(#brass)" stroke="#5e3f14" stroke-width="1.5"/>
      <path d="M50 30 L54 30 L52 40 Z" fill="#5e3f14"/>`,
  },
  leque: {
    nominal: { w: 120, h: 50 },
    body: `
      <path d="M60 48 L2 18 C20 4 40 0 60 0 C80 0 100 4 118 18 Z" fill="#c8323a" stroke="#5a0e14" stroke-width="2"/>
      ${[-58, -40, -22, -6, 10, 26, 44].map((a) => `<path d="M60 48 L${n(60 + Math.sin((a * Math.PI) / 180) * 64)} ${n(48 - Math.cos((a * Math.PI) / 180) * 50)}" stroke="#f2c766" stroke-width="2"/>`).join("")}
      <path d="M8 20 C26 8 44 4 60 4 C76 4 94 8 112 20" stroke="#f2c766" stroke-width="3" fill="none"/>
      <path d="M24 22 C36 16 48 14 60 14 C72 14 84 16 96 22" stroke="#f6dc92" stroke-width="2" fill="none" opacity=".8"/>
      <circle cx="40" cy="20" r="4" fill="#f6dc92"/><circle cx="80" cy="20" r="4" fill="#f6dc92"/><circle cx="60" cy="16" r="5" fill="#f6dc92"/>
      <circle cx="60" cy="46" r="4" fill="url(#brass)"/>`,
  },
};

/** A target's art placed on the plate (or, with `into`, anywhere else). */
function targetSvg(id, into = box(id)) {
  return fit(ART[id].body, ART[id].nominal, into);
}

/** A pool object in its place — or nothing, when the audit renders the room without it. */
const t = (omit, id) => (omit === id ? "" : targetSvg(id));

// --- the look-alikes (same shape or material, another kind of thing) ------------------------------------

const LOOK_ART = {
  "rolo-de-mapas": {
    nominal: { w: 168, h: 34 },
    body: `
      <rect x="8" y="6" width="152" height="24" rx="12" fill="url(#parchment)" stroke="#8a6a3c" stroke-width="1.5"/>
      <ellipse cx="160" cy="18" rx="7" ry="12" fill="#efe0bc" stroke="#8a6a3c" stroke-width="1.2"/>
      <path d="M160 10 C156 14 156 22 160 26" stroke="#b08f5a" stroke-width="1" fill="none"/>
      <rect x="70" y="5" width="8" height="26" fill="#9e2a2a"/>
      <path d="M74 30 L66 34 M74 30 L82 34" stroke="#9e2a2a" stroke-width="2.5"/>
      <rect x="12" y="9" width="140" height="4" fill="#fff" opacity=".35"/>`,
  },
  argolas: {
    nominal: { w: 56, h: 30 },
    body: `<ellipse cx="16" cy="18" rx="13" ry="9" fill="none" stroke="#d4ae5c" stroke-width="4"/><ellipse cx="40" cy="14" rx="12" ry="8" fill="none" stroke="#c39a46" stroke-width="4"/>`,
  },
  escova: {
    nominal: { w: 78, h: 32 },
    body: `
      <path d="M4 16 C4 6 14 2 40 2 C66 2 76 6 76 16 L74 20 L6 20 Z" fill="url(#walnut)" stroke="#2a170b" stroke-width="1.5"/>
      <rect x="8" y="20" width="64" height="10" fill="#8a8178"/>
      ${[12, 20, 28, 36, 44, 52, 60, 68].map((x) => `<path d="M${x} 20 L${x} 30" stroke="#5e5850" stroke-width="2"/>`).join("")}`,
  },
  "esfera-armilar": {
    nominal: { w: 112, h: 118 },
    body: `
      ${shadow(56, 116, 30, 4)}
      <path d="M40 116 L72 116 L66 104 L46 104 Z" fill="url(#walnut)"/>
      <rect x="53" y="88" width="6" height="18" fill="url(#brassH)"/>
      <circle cx="56" cy="48" r="40" fill="none" stroke="url(#brass)" stroke-width="5"/>
      <ellipse cx="56" cy="48" rx="40" ry="12" fill="none" stroke="#d8b25e" stroke-width="4"/>
      <ellipse cx="56" cy="48" rx="12" ry="40" fill="none" stroke="#c39443" stroke-width="4"/>
      <ellipse cx="56" cy="48" rx="40" ry="14" fill="none" stroke="#b8913f" stroke-width="3" transform="rotate(-28 56 48)"/>
      <path d="M56 4 L56 92" stroke="#7a5521" stroke-width="2"/>`,
  },
  pinca: {
    nominal: { w: 84, h: 24 },
    body: `<path d="M2 12 L80 4 L82 8 L8 14 L82 18 L80 22 Z" fill="url(#steel)" stroke="#20242a" stroke-width="1"/><circle cx="6" cy="12" r="4" fill="#6c727c"/>`,
  },
  regador: {
    nominal: { w: 76, h: 64 },
    body: `
      ${shadow(36, 62, 24, 3)}
      <path d="M14 22 L54 22 L52 62 L16 62 Z" fill="#7e8a7c" stroke="#3a423a" stroke-width="1.6"/>
      <path d="M52 50 L74 24" stroke="#7e8a7c" stroke-width="6" stroke-linecap="round"/>
      <ellipse cx="74" cy="22" rx="5" ry="7" fill="#9aa698" transform="rotate(40 74 22)"/>
      <path d="M18 22 C18 4 50 4 50 22" stroke="#5e6a5c" stroke-width="5" fill="none"/>
      <rect x="16" y="26" width="8" height="34" fill="#fff" opacity=".2"/>`,
  },
  funil: {
    nominal: { w: 56, h: 60 },
    body: `
      ${shadow(28, 58, 22, 3)}
      <path d="M4 34 L52 34 L34 50 L22 50 Z" fill="url(#brass)" stroke="#5e3f14" stroke-width="1.5"/>
      <rect x="23" y="48" width="10" height="10" fill="url(#brassH)"/>
      <ellipse cx="28" cy="34" rx="24" ry="5" fill="#5e3f14"/>
      <path d="M28 4 L28 30" stroke="#6e4b1c" stroke-width="2" opacity=".0"/>`,
  },
  novelo: {
    nominal: { w: 64, h: 56 },
    body: `
      <circle cx="32" cy="30" r="24" fill="#b5332e" stroke="#5a1210" stroke-width="1.5"/>
      ${[-40, -10, 20, 50].map((a) => `<ellipse cx="32" cy="30" rx="23" ry="9" fill="none" stroke="#e05a4c" stroke-width="2" transform="rotate(${a} 32 30)"/>`).join("")}
      <path d="M50 46 C58 52 62 50 64 54" stroke="#b5332e" stroke-width="2" fill="none"/>`,
  },
  luminaria: {
    nominal: { w: 60, h: 140 },
    body: `
      ${shadow(30, 138, 22, 4)}
      <ellipse cx="30" cy="134" rx="22" ry="6" fill="url(#brass)" stroke="#5e3f14" stroke-width="1.2"/>
      <path d="M30 132 L18 76 L40 40" stroke="url(#brassH)" stroke-width="5" fill="none" stroke-linejoin="round"/>
      <circle cx="18" cy="76" r="4" fill="#e6c375"/>
      <path d="M8 40 C8 18 52 18 52 40 Z" fill="url(#greenGlass)" stroke="#0e2a1c" stroke-width="1.6"/>
      <ellipse cx="30" cy="40" rx="22" ry="4" fill="#fff6c8"/>`,
  },
  almofada: {
    nominal: { w: 120, h: 60 },
    body: `
      ${shadow(60, 56, 56, 5)}
      <path d="M8 14 C30 4 90 4 112 14 C118 30 118 40 112 50 C90 58 30 58 8 50 C2 40 2 30 8 14 Z" fill="#c4682e" stroke="#5a2a10" stroke-width="2"/>
      <path d="M20 20 C40 30 80 30 100 20 M20 44 C40 36 80 36 100 44" stroke="#e8a060" stroke-width="2" fill="none"/>
      ${[10, 18, 26, 34, 42, 50].map((y) => `<path d="M8 ${y} L0 ${y + 2} M112 ${y} L120 ${y + 2}" stroke="#e2b86a" stroke-width="2"/>`).join("")}`,
  },
  mobile: {
    nominal: { w: 92, h: 124 },
    body: `
      <path d="M46 0 L46 20 M8 24 L84 18" stroke="#c9b48a" stroke-width="2"/>
      <path d="M12 24 L12 70 M80 18 L80 56 M46 22 L46 96" stroke="#e8dcc2" stroke-width="1.2"/>
      <path d="${starPath(12, 82, 12)}" fill="#f2d16a" stroke="#8a6a26" stroke-width="1"/>
      <path d="${starPath(80, 68, 12)}" fill="#f6e3a0" stroke="#8a6a26" stroke-width="1"/>
      <path d="M38 98 C30 106 34 120 46 122 C38 118 36 106 44 100 Z" fill="#e8d6a0" stroke="#8a6a26" stroke-width="1"/>`,
  },
  concha: {
    nominal: { w: 80, h: 54 },
    body: `
      <path d="M40 52 L4 26 C14 6 28 2 40 2 C52 2 66 6 76 26 Z" fill="#f2d9c2" stroke="#8a6248" stroke-width="1.8"/>
      ${[-50, -30, -10, 10, 30, 50].map((a) => `<path d="M40 52 L${n(40 + Math.sin((a * Math.PI) / 180) * 44)} ${n(52 - Math.cos((a * Math.PI) / 180) * 48)}" stroke="#c49a80" stroke-width="2"/>`).join("")}
      <path d="M32 52 L48 52 L44 46 L36 46 Z" fill="#d8b49a"/>`,
  },
};

function lookSvg(id) {
  const art = LOOK_ART[id];
  return fit(art.body, art.nominal, box(id));
}

// --- the dusk sky (back layer) -----------------------------------------------------------------------

function backSvg() {
  const { x: X, y: Y, w, h } = LAYER.back.rect;
  const rnd = seeded(0x0b5e7);
  let stars = "";
  for (let i = 0; i < 260; i += 1) {
    const sx = rnd() * w;
    const sy = rnd() * h * 0.78;
    const r = 0.6 + rnd() ** 3 * 2.6;
    const o = (0.35 + rnd() * 0.65) * (1 - sy / (h * 0.9));
    stars += `<circle cx="${n(sx)}" cy="${n(sy)}" r="${n(r)}" fill="#fff8ec" opacity="${n(o * 100) / 100}"/>`;
  }
  // a few bright ones with a soft cross
  const bright = [[300, 120], [420, 260], [180, 330], [1500, 300], [1340, 180], [980, 110], [1660, 160]];
  stars += bright
    .map(([sx, sy]) => `<g opacity=".95"><circle cx="${sx}" cy="${sy}" r="3.2" fill="#fffef6"/><path d="M${sx - 12} ${sy} L${sx + 12} ${sy} M${sx} ${sy - 12} L${sx} ${sy + 12}" stroke="#fff8e0" stroke-width="1.2" opacity=".7"/></g>`)
    .join("");
  // the moon the telescope looks at (through the dome) and the evening star (through the round window)
  const moon = { x: 720 - X, y: 170 - Y };
  const venus = { x: 1918 - X, y: 360 - Y };
  // hills and a village on the horizon, seen through the round window
  const horizon = 600;
  let lights = "";
  for (let i = 0; i < 22; i += 1) lights += `<circle cx="${n(1560 - X + rnd() * 520)}" cy="${n(horizon + 34 + rnd() * 36)}" r="${n(1.4 + rnd() * 1.6)}" fill="#ffd08a" opacity="${n(0.6 + rnd() * 0.4)}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#070b24"/><stop offset=".3" stop-color="#141c48"/><stop offset=".52" stop-color="#2c2f68"/>
      <stop offset=".64" stop-color="#5b4a82"/><stop offset=".72" stop-color="#9c5f7e"/><stop offset=".79" stop-color="#e08a66"/>
      <stop offset=".86" stop-color="#f6b878"/><stop offset="1" stop-color="#f9d49a"/>
    </linearGradient>
    <radialGradient id="moonGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff6dc" stop-opacity=".55"/><stop offset="1" stop-color="#fff6dc" stop-opacity="0"/></radialGradient>
    <radialGradient id="sunset" cx=".5" cy="1" r=".7"><stop offset="0" stop-color="#ffcf8c" stop-opacity=".7"/><stop offset="1" stop-color="#ffcf8c" stop-opacity="0"/></radialGradient>
    <filter id="haze" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="22"/></filter>
    <filter id="soft1" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="1.2"/></filter>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#sky)"/>
  <ellipse cx="${1800 - X}" cy="${horizon + 30}" rx="900" ry="260" fill="url(#sunset)"/>
  <path d="M0 ${h * 0.12} C${w * 0.3} ${h * 0.02} ${w * 0.6} ${h * 0.22} ${w} ${h * 0.08} L${w} ${h * 0.3} C${w * 0.6} ${h * 0.4} ${w * 0.3} ${h * 0.2} 0 ${h * 0.32} Z" fill="#8f86c8" opacity=".09" filter="url(#haze)"/>
  <g filter="url(#soft1)">${stars}</g>
  <circle cx="${moon.x}" cy="${moon.y}" r="120" fill="url(#moonGlow)"/>
  <circle cx="${moon.x}" cy="${moon.y}" r="44" fill="#fdf3d6"/>
  <circle cx="${moon.x + 18}" cy="${moon.y - 10}" r="40" fill="#141c48"/>
  <circle cx="${moon.x - 14}" cy="${moon.y + 12}" r="5" fill="#e8dcbc" opacity=".6"/>
  <circle cx="${venus.x}" cy="${venus.y}" r="34" fill="url(#moonGlow)"/>
  <circle cx="${venus.x}" cy="${venus.y}" r="4.5" fill="#fffef0"/>
  <path d="M${1440 - X} ${horizon + 20} C${1540 - X} ${horizon - 40} ${1600 - X} ${horizon - 30} ${1680 - X} ${horizon + 10} C${1760 - X} ${horizon - 50} ${1860 - X} ${horizon - 70} ${1960 - X} ${horizon} C${2040 - X} ${horizon - 30} ${2120 - X} ${horizon - 20} ${2240 - X} ${horizon + 10} L${2240 - X} ${h} L${1440 - X} ${h} Z" fill="#3a2f4f"/>
  <path d="M${1440 - X} ${horizon + 50} C${1600 - X} ${horizon + 20} ${1760 - X} ${horizon + 40} ${1900 - X} ${horizon + 26} C${2040 - X} ${horizon + 14} ${2160 - X} ${horizon + 36} ${2240 - X} ${horizon + 30} L${2240 - X} ${h} L${1440 - X} ${h} Z" fill="#241e36"/>
  ${lights}
  <path d="M0 ${horizon + 20} C200 ${horizon - 10} 500 ${horizon + 10} 900 ${horizon - 6} L900 ${h} L0 ${h} Z" fill="#2c2440"/>
</svg>`;
}

// --- the room (plate) ----------------------------------------------------------------------------------

/** The plate's openings onto the sky: the dome's shutter and the round window. */
function openingsPath() {
  const { x0, x1, bottom } = SLIT;
  const slit = `M${x0} 0 L${x1} 0 L${x1} ${bottom - 30} Q${x1} ${bottom} ${x1 - 30} ${bottom} L${x0 + 30} ${bottom} Q${x0} ${bottom} ${x0} ${bottom - 30} Z`;
  const { cx, cy, r } = OCULUS;
  const window = `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
  return `${slit} ${window}`;
}

function wallAndDome() {
  const rnd = seeded(0x51a7);
  // constellation stencils on the drum's plaster: gold dots and thin lines
  const constellations = [
    [[2470, 380], [2530, 330], [2600, 360], [2650, 300], [2720, 340]],
    [[1110, 640], [1150, 600], [1200, 630], [1170, 690]],
    [[2180, 300], [2240, 340], [2300, 290]],
    [[3200, 140 + 300], [3240, 180 + 300]],
    [[460, 520], [510, 480], [560, 520]],
    [[2540, 680], [2600, 640], [2640, 700], [2700, 660]],
  ];
  const stencil = constellations
    .map((pts) => `<path d="M${pts.map(([x, y]) => `${x} ${y}`).join(" L")}" stroke="#c9a65e" stroke-width="1.6" fill="none" opacity=".35"/>${pts.map(([x, y]) => `<path d="${starPath(x, y, 7)}" fill="#e2c27a" opacity=".55"/>`).join("")}`)
    .join("");
  let scatter = "";
  for (let i = 0; i < 70; i += 1) {
    const x = 240 + rnd() * 3120;
    const y = RING_Y + 40 + rnd() * (WAINSCOT_Y - RING_Y - 80);
    if (x > SLIT.x0 - 20 && x < SLIT.x1 + 20 && y < SLIT.bottom + 20) continue;
    if (Math.hypot(x - OCULUS.cx, y - OCULUS.cy) < OCULUS.r + OCULUS.ring + 20) continue;
    scatter += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(1.2 + rnd() * 1.6)}" fill="#e2c27a" opacity="${n(0.2 + rnd() * 0.3)}"/>`;
  }
  // the dome above the ring beam: planks and ribs converging on a point far above the room
  const apex = { x: 1700, y: -2600 };
  let ribs = "";
  for (let x = -400; x <= 4000; x += 180) {
    const toApex = (y) => x + ((apex.x - x) * (RING_Y - y)) / (RING_Y - apex.y);
    ribs += `<path d="M${n(x)} ${RING_Y} L${n(toApex(0))} 0" stroke="#5a3a22" stroke-width="16"/><path d="M${n(x) + 6} ${RING_Y} L${n(toApex(0)) + 6} 0" stroke="#7a5232" stroke-width="3" opacity=".6"/>`;
  }
  let purlins = "";
  for (const y of [60, 130, 195]) purlins += `<rect x="0" y="${y}" width="${W}" height="7" fill="#1a110a" opacity=".55"/>`;
  return `
  <g>
    <path d="M0 0 H${W} V${FLOOR_Y} H0 Z ${openingsPath()}" fill-rule="evenodd" fill="url(#plaster)"/>
    <g clip-path="url(#notOpenings)">
      <rect x="0" y="0" width="${W}" height="${RING_Y}" fill="url(#domePlank)"/>
      ${ribs}${purlins}
      <rect x="0" y="${RING_Y - 10}" width="${W}" height="34" fill="url(#woodV)"/>
      <rect x="0" y="${RING_Y + 20}" width="${W}" height="6" fill="#1a0f08" opacity=".6"/>
      <rect x="0" y="${RING_Y - 10}" width="${W}" height="4" fill="#c09060" opacity=".5"/>
    </g>
    ${stencil}${scatter}
  </g>`;
}

/** The opened shutter: the slot's thick edges, its rails and the two leaves pushed aside. */
function slitFrame() {
  const { x0, x1, bottom } = SLIT;
  return `
  <path d="M${x0 - 26} 0 L${x0} 0 L${x0} ${bottom - 30} Q${x0} ${bottom} ${x0 + 30} ${bottom} L${x1 - 30} ${bottom} Q${x1} ${bottom} ${x1} ${bottom - 30} L${x1} 0 L${x1 + 26} 0 L${x1 + 26} ${bottom - 20} Q${x1 + 26} ${bottom + 26} ${x1 - 26} ${bottom + 26} L${x0 + 26} ${bottom + 26} Q${x0 - 26} ${bottom + 26} ${x0 - 26} ${bottom - 20} Z" fill="url(#woodDark)"/>
  <path d="M${x0 - 4} 0 V${bottom - 26}" stroke="url(#brassV)" stroke-width="5"/>
  <path d="M${x1 + 4} 0 V${bottom - 26}" stroke="url(#brassV)" stroke-width="5"/>
  <rect x="${x0 - 110}" y="0" width="84" height="${bottom - 40}" fill="url(#walnut)" stroke="#1a0f08" stroke-width="3"/>
  <rect x="${x1 + 26}" y="0" width="84" height="${bottom - 40}" fill="url(#walnut)" stroke="#1a0f08" stroke-width="3"/>
  ${[80, 200, 320, 440].map((y) => `<rect x="${x0 - 106}" y="${y}" width="76" height="8" fill="url(#iron)"/><rect x="${x1 + 30}" y="${y}" width="76" height="8" fill="url(#iron)"/>`).join("")}
  <circle cx="${x0 - 68}" cy="${bottom - 70}" r="9" fill="url(#brass)"/>
  <circle cx="${x1 + 68}" cy="${bottom - 70}" r="9" fill="url(#brass)"/>
  <path d="M${x1 + 68} ${bottom - 62} C${x1 + 70} ${bottom + 40} ${x1 + 40} ${bottom + 120} ${x1 + 46} ${bottom + 220}" stroke="#7a6a52" stroke-width="3" fill="none"/>
  <circle cx="${x1 + 46}" cy="${bottom + 226}" r="7" fill="url(#brass)"/>`;
}

function oculusFrame() {
  const { cx, cy, r, ring } = OCULUS;
  let ticks = "";
  for (let i = 0; i < 72; i += 1) {
    const a = (i * Math.PI) / 36;
    const r1 = r + 6;
    const r2 = r + (i % 6 === 0 ? 22 : 13);
    ticks += `<path d="M${n(cx + Math.cos(a) * r1)} ${n(cy + Math.sin(a) * r1)} L${n(cx + Math.cos(a) * r2)} ${n(cy + Math.sin(a) * r2)}" stroke="#6e4b1c" stroke-width="${i % 6 === 0 ? 3 : 1.5}"/>`;
  }
  let mullions = "";
  for (let i = 0; i < 8; i += 1) {
    const a = (i * Math.PI) / 4 + Math.PI / 8;
    mullions += `<path d="M${n(cx + Math.cos(a) * 70)} ${n(cy + Math.sin(a) * 70)} L${n(cx + Math.cos(a) * r)} ${n(cy + Math.sin(a) * r)}" stroke="#1b1410" stroke-width="7"/>`;
  }
  return `
  <circle cx="${cx}" cy="${cy}" r="${r + ring + 12}" fill="#000" opacity=".35" filter="url(#soft14)"/>
  <path d="M${cx - r - ring} ${cy} A${r + ring} ${r + ring} 0 1 0 ${cx + r + ring} ${cy} A${r + ring} ${r + ring} 0 1 0 ${cx - r - ring} ${cy} Z M${cx - r} ${cy} A${r} ${r} 0 1 1 ${cx + r} ${cy} A${r} ${r} 0 1 1 ${cx - r} ${cy} Z" fill-rule="evenodd" fill="url(#brass)"/>
  <circle cx="${cx}" cy="${cy}" r="${r + 4}" fill="none" stroke="#5e3f14" stroke-width="5"/>
  <circle cx="${cx}" cy="${cy}" r="${r + ring}" fill="none" stroke="#5e3f14" stroke-width="3"/>
  ${ticks}
  ${mullions}
  <circle cx="${cx}" cy="${cy}" r="70" fill="none" stroke="#1b1410" stroke-width="7"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#glassPane)" opacity=".5"/>
  <path d="M${cx - r + 40} ${cy - 80} C${cx - r + 70} ${cy - 170} ${cx - 90} ${cy - r + 30} ${cx - 10} ${cy - r + 20}" stroke="#ffffff" stroke-width="6" opacity=".12" fill="none"/>`;
}

function posts() {
  return POSTS.map(
    (x) => `
    ${occlusion(x - 30, RING_Y, 80, FLOOR_Y - RING_Y, 0.45)}
    <rect x="${x - 20}" y="${RING_Y}" width="40" height="${FLOOR_Y - RING_Y}" fill="url(#woodH)"/>
    <rect x="${x - 20}" y="${RING_Y}" width="8" height="${FLOOR_Y - RING_Y}" fill="#c09060" opacity=".25"/>
    <rect x="${x - 28}" y="${RING_Y + 20}" width="56" height="26" fill="url(#woodV)"/>
    <rect x="${x - 26}" y="${WAINSCOT_Y - 14}" width="52" height="20" fill="url(#woodV)"/>`,
  ).join("");
}

function wainscot() {
  let panels = "";
  const spans = [[0, POSTS[0] - 20], [POSTS[0] + 20, POSTS[1] - 20], [POSTS[1] + 20, W]];
  for (const [a, b] of spans) {
    const count = Math.max(1, Math.round((b - a) / 200));
    const step = (b - a) / count;
    for (let i = 0; i < count; i += 1) {
      const x = a + i * step + 16;
      panels += `<rect x="${n(x)}" y="${WAINSCOT_Y + 30}" width="${n(step - 32)}" height="${FLOOR_Y - WAINSCOT_Y - 70}" rx="4" fill="#3d2414" stroke="#2a170b" stroke-width="3"/>
        <rect x="${n(x + 6)}" y="${WAINSCOT_Y + 36}" width="${n(step - 44)}" height="6" fill="#7a5232" opacity=".45"/>`;
    }
  }
  return `
  <rect x="0" y="${WAINSCOT_Y}" width="${W}" height="${FLOOR_Y - WAINSCOT_Y}" fill="url(#walnut)"/>
  <rect x="0" y="${WAINSCOT_Y - 12}" width="${W}" height="20" fill="url(#woodV)"/>
  <rect x="0" y="${WAINSCOT_Y - 12}" width="${W}" height="4" fill="#d1a26c" opacity=".5"/>
  ${panels}
  <rect x="0" y="${FLOOR_Y - 26}" width="${W}" height="26" fill="#2c190c"/>
  <rect x="0" y="${FLOOR_Y - 26}" width="${W}" height="3" fill="#8a5a33" opacity=".6"/>`;
}

function floorAndRug() {
  // boards running into the room, converging on a point behind the bench; seams across them
  let planks = `<rect x="0" y="${FLOOR_Y}" width="${W}" height="${H - FLOOR_Y}" fill="#563820"/>`;
  const rnd = seeded(0xf10a);
  const vanish = { x: 1800, y: 420 };
  const atFloor = (x) => vanish.x + (x - vanish.x) * ((FLOOR_Y - vanish.y) / (H - vanish.y));
  const tones = ["#5b3a22", "#4f321c", "#62412a", "#4a2e19", "#57381f"];
  for (let i = -26; i < 26; i += 1) {
    const b0 = vanish.x + i * 140;
    const b1 = vanish.x + (i + 1) * 140;
    planks += `<path d="M${n(atFloor(b0))} ${FLOOR_Y} L${n(atFloor(b1))} ${FLOOR_Y} L${b1} ${H} L${b0} ${H} Z" fill="${tones[Math.floor(rnd() * tones.length)]}"/>`;
    planks += `<path d="M${n(atFloor(b0))} ${FLOOR_Y} L${b0} ${H}" stroke="#1e1209" stroke-width="2.5" opacity=".75"/>`;
    for (let k = 0; k < 2; k += 1) {
      const v = 0.15 + rnd() * 0.8;
      const y = FLOOR_Y + v * (H - FLOOR_Y);
      const xa = atFloor(b0) + (b0 - atFloor(b0)) * v;
      const xb = atFloor(b1) + (b1 - atFloor(b1)) * v;
      planks += `<path d="M${n(xa)} ${n(y)} L${n(xb)} ${n(y)}" stroke="#1e1209" stroke-width="2" opacity=".6"/>`;
    }
  }
  const rug = { cx: 1860, cy: 1446, rx: 1020, ry: 150 };
  let rose = "";
  for (let i = 0; i < 16; i += 1) {
    const a = (i * Math.PI) / 8;
    const len = i % 2 === 0 ? 1 : 0.55;
    const tip = { x: rug.cx + Math.cos(a) * 520 * len, y: rug.cy + Math.sin(a) * 76 * len };
    const l = { x: rug.cx + Math.cos(a + 0.18) * 60, y: rug.cy + Math.sin(a + 0.18) * 9 };
    const r = { x: rug.cx + Math.cos(a - 0.18) * 60, y: rug.cy + Math.sin(a - 0.18) * 9 };
    rose += `<path d="M${n(l.x)} ${n(l.y)} L${n(tip.x)} ${n(tip.y)} L${n(r.x)} ${n(r.y)} Z" fill="${i % 2 === 0 ? "#d6ac5c" : "#8f6a34"}" opacity=".9"/>`;
  }
  return `
  ${planks}
  <rect x="0" y="${FLOOR_Y}" width="${W}" height="40" fill="#000" opacity=".35" filter="url(#soft6)"/>
  <ellipse cx="${rug.cx}" cy="${rug.cy + 10}" rx="${rug.rx + 20}" ry="${rug.ry + 14}" fill="#000" opacity=".35" filter="url(#soft6)"/>
  <ellipse cx="${rug.cx}" cy="${rug.cy}" rx="${rug.rx}" ry="${rug.ry}" fill="#6a2430"/>
  <ellipse cx="${rug.cx}" cy="${rug.cy}" rx="${rug.rx - 30}" ry="${rug.ry - 8}" fill="none" stroke="#d6ac5c" stroke-width="5"/>
  <ellipse cx="${rug.cx}" cy="${rug.cy}" rx="${rug.rx - 52}" ry="${rug.ry - 14}" fill="url(#rugField)"/>
  <ellipse cx="${rug.cx}" cy="${rug.cy}" rx="${rug.rx - 140}" ry="${rug.ry - 34}" fill="none" stroke="#c49a52" stroke-width="2" stroke-dasharray="14 10" opacity=".8"/>
  ${rose}
  <ellipse cx="${rug.cx}" cy="${rug.cy}" rx="56" ry="9" fill="#d6ac5c"/>
  ${Array.from({ length: 24 }, (_, i) => {
    const a = (i * Math.PI) / 12;
    return `<path d="${starPath(rug.cx + Math.cos(a) * (rug.rx - 90), rug.cy + Math.sin(a) * (rug.ry - 24), 9)}" fill="#e2c27a" opacity=".8"/>`;
  }).join("")}`;
}

// --- Cúpula ----------------------------------------------------------------------------------------------

function bookcase() {
  const x0 = 190;
  const x1 = 580;
  const top = 466;
  const shelves = [600, 740, 880, 1020];
  let books = "";
  shelves.forEach((y, i) => {
    books += bookRun(x0 + 18, y, 13, 101 + i * 17, { minH: 80, maxH: 124, minW: 16, maxW: 28 }).svg;
  });
  books += bookRun(x0 + 18, 1150, 6, 211, { minH: 90, maxH: 116 }).svg;
  return `
  ${occlusion(x0 - 10, top, x1 - x0 + 20, FLOOR_Y - top, 0.5)}
  <rect x="${x0}" y="${top}" width="${x1 - x0}" height="${FLOOR_Y - top}" fill="#24150b" stroke="#120a05" stroke-width="3"/>
  ${shelves.map((y) => `<rect x="${x0}" y="${y}" width="${x1 - x0}" height="14" fill="url(#woodV)"/>${occlusion(x0, y + 10, x1 - x0, 16, 0.45)}`).join("")}
  ${books}
  <rect x="${x0 - 16}" y="${top - 14}" width="${x1 - x0 + 32}" height="26" fill="url(#woodV)" stroke="#1a0f08" stroke-width="2"/>
  <rect x="${x0 - 16}" y="${top - 14}" width="${x1 - x0 + 32}" height="4" fill="#d8a874" opacity=".5"/>
  <rect x="${x0}" y="${top}" width="18" height="${FLOOR_Y - top}" fill="url(#woodH)"/>
  <rect x="${x1 - 18}" y="${top}" width="18" height="${FLOOR_Y - top}" fill="url(#woodH)"/>`;
}

function ladder() {
  // the ladder hangs from the brass rail on the bookcase's crown, its feet out on the floor
  const railY = 470;
  const foot = 1250;
  const rail = (x0, x1) => `<path d="M${x0} ${foot} L${x1} ${railY}" stroke="url(#woodLight)" stroke-width="16" stroke-linecap="round"/><path d="M${x0 + 4} ${foot} L${x1 + 4} ${railY}" stroke="#e8c08a" stroke-width="3" opacity=".4"/>`;
  let rungs = "";
  for (let y = 1180; y >= 540; y -= 92) {
    const t = (foot - y) / (foot - railY);
    const a = 214 + t * 96;
    const b = 340 + t * 82;
    rungs += `<rect x="${n(a)}" y="${y - 5}" width="${n(b - a)}" height="10" rx="3" fill="url(#woodV)"/>`;
  }
  return `
  <rect x="176" y="${railY - 6}" width="420" height="10" rx="4" fill="url(#brassH)"/>
  <circle cx="186" cy="${railY - 1}" r="9" fill="url(#brass)"/><circle cx="586" cy="${railY - 1}" r="9" fill="url(#brass)"/>
  ${shadow(280, foot + 4, 90, 8, 0.7)}
  ${rail(214, 310)}${rail(340, 422)}
  ${rungs}
  <path d="M310 ${railY} C310 ${railY - 14} 322 ${railY - 16} 326 ${railY - 4} M422 ${railY} C422 ${railY - 14} 434 ${railY - 16} 438 ${railY - 4}" stroke="url(#brassV)" stroke-width="6" fill="none"/>
  <circle cx="214" cy="${foot - 6}" r="9" fill="#2a1a0c"/><circle cx="340" cy="${foot - 6}" r="9" fill="#2a1a0c"/>`;
}

/** A framed map of the moon on the archive's wall (scenery). */
function moonChart() {
  const x = 2446;
  const y = 430;
  return `
  ${occlusion(x - 4, y + 6, 140, 170, 0.45)}
  <rect x="${x}" y="${y}" width="130" height="160" fill="url(#brass)" stroke="#4a3414" stroke-width="2"/>
  <rect x="${x + 10}" y="${y + 10}" width="110" height="140" fill="#1a2240"/>
  <circle cx="${x + 65}" cy="${y + 72}" r="40" fill="#d8d0b8"/>
  <circle cx="${x + 52}" cy="${y + 60}" r="8" fill="#b4ab94"/><circle cx="${x + 78}" cy="${y + 84}" r="11" fill="#b4ab94"/><circle cx="${x + 70}" cy="${y + 56}" r="5" fill="#b4ab94"/>
  <path d="M${x + 20} ${y + 132} L${x + 110} ${y + 132}" stroke="#c9a65e" stroke-width="2"/>`;
}

function sideTable(omit) {
  const cx = 432;
  const top = 996;
  return `
  ${shadow(cx, FLOOR_Y + 10, 120, 14, 0.8)}
  <path d="M${cx - 70} ${FLOOR_Y + 6} L${cx - 10} ${top + 20} M${cx + 70} ${FLOOR_Y + 6} L${cx + 10} ${top + 20} M${cx} ${FLOOR_Y + 12} L${cx} ${top + 20}" stroke="url(#woodV)" stroke-width="12"/>
  <ellipse cx="${cx}" cy="${1072}" rx="92" ry="12" fill="url(#woodH)"/>
  ${lookSvg("rolo-de-mapas")}
  <ellipse cx="${cx}" cy="${top + 10}" rx="130" ry="18" fill="#3e2414"/>
  <ellipse cx="${cx}" cy="${top}" rx="130" ry="18" fill="url(#wood)" stroke="#2a170b" stroke-width="2"/>
  <ellipse cx="${cx - 30}" cy="${top - 4}" rx="70" ry="8" fill="#c79563" opacity=".35"/>
  ${t(omit, "luneta")}
  <g transform="rotate(-8 352 960)">
    <rect x="318" y="902" width="62" height="92" rx="3" fill="#2d3d5e" stroke="#141c30" stroke-width="2"/>
    <rect x="322" y="906" width="54" height="84" fill="none" stroke="#c9a65e" stroke-width="2"/>
    <path d="${starPath(349, 940, 12)}" fill="#e2c27a"/>
    <rect x="374" y="904" width="8" height="88" fill="#ece0c2"/>
  </g>`;
}

function platform() {
  const { x0, x1, top, front, step } = PLATFORM;
  return `
  ${shadow((x0 + x1) / 2, step + 6, (x1 - x0) / 2 + 30, 16, 0.85)}
  <path d="M${x0 - 30} ${front + 4} L${x1 + 30} ${front + 4} L${x1 + 30} ${step} L${x0 - 30} ${step} Z" fill="url(#woodV)" stroke="#2a170b" stroke-width="2"/>
  <rect x="${x0 - 30}" y="${front + 4}" width="${x1 - x0 + 60}" height="5" fill="#c79563" opacity=".5"/>
  <path d="M${x0} ${top} L${x1} ${top} L${x1} ${front} L${x0} ${front} Z" fill="url(#wood)" stroke="#2a170b" stroke-width="2"/>
  <rect x="${x0}" y="${top}" width="${x1 - x0}" height="5" fill="#d8a874" opacity=".55"/>
  ${[x0 + 40, (x0 + x1) / 2, x1 - 40].map((x) => `<rect x="${n(x - 3)}" y="${top + 8}" width="6" height="${front - top - 12}" fill="#2a170b" opacity=".35"/>`).join("")}`;
}

function telescope() {
  // the tube runs from the eyepiece end E (low, right) to the objective O (high, left), into the shutter
  const E = { x: 992, y: 884 };
  const O = { x: 708, y: 268 };
  const dx = O.x - E.x;
  const dy = O.y - E.y;
  const len = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const tube = `
    <g transform="translate(${E.x} ${E.y}) rotate(${n(angle)})">
      <rect x="0" y="-38" width="${n(len)}" height="76" rx="8" fill="url(#enamel)" stroke="#5a4a32" stroke-width="2.5"/>
      <rect x="0" y="-38" width="${n(len)}" height="16" fill="#fffaf0" opacity=".55"/>
      <rect x="0" y="24" width="${n(len)}" height="14" fill="#5a4a32" opacity=".35"/>
      ${[0.08, 0.36, 0.62, 0.86].map((f) => `<rect x="${n(len * f)}" y="-41" width="16" height="82" rx="3" fill="url(#brassV)" stroke="#5e3f14" stroke-width="1.5"/>`).join("")}
      <rect x="${n(len - 70)}" y="-46" width="84" height="92" rx="6" fill="url(#brassV)" stroke="#5e3f14" stroke-width="2"/>
      <rect x="${n(len + 10)}" y="-40" width="10" height="80" rx="3" fill="#2a1a0c"/>
      <rect x="${n(len * 0.4)}" y="-74" width="${n(len * 0.36)}" height="20" rx="6" fill="url(#enamel)" stroke="#5a4a32" stroke-width="1.5"/>
      <rect x="${n(len * 0.44)}" y="-58" width="10" height="20" fill="url(#brassV)"/><rect x="${n(len * 0.68)}" y="-58" width="10" height="20" fill="url(#brassV)"/>
      <rect x="-26" y="-20" width="30" height="40" rx="4" fill="url(#brassV)" stroke="#5e3f14" stroke-width="1.5"/>
      <rect x="-48" y="-12" width="26" height="24" rx="3" fill="#2a1a0c"/>
      <rect x="-52" y="-9" width="6" height="18" rx="2" fill="url(#brass)"/>
    </g>`;
  const pier = { x: 870, w: 56, top: 760 };
  return `
  ${occlusion(pier.x - 20, pier.top, pier.w + 40, PLATFORM.top - pier.top, 0.35)}
  <path d="M${pier.x - 30} ${PLATFORM.top} L${pier.x + pier.w + 30} ${PLATFORM.top} L${pier.x + pier.w} ${pier.top + 40} L${pier.x} ${pier.top + 40} Z" fill="url(#iron)" stroke="#141210" stroke-width="2"/>
  <rect x="${pier.x - 6}" y="${pier.top}" width="${pier.w + 12}" height="46" rx="6" fill="url(#iron)"/>
  <path d="M${pier.x + pier.w / 2} ${pier.top + 10} L${808} ${640}" stroke="url(#iron)" stroke-width="40" stroke-linecap="round"/>
  <path d="M${818} ${650} L${940} ${742}" stroke="#2a2724" stroke-width="12" stroke-linecap="round"/>
  <circle cx="944" cy="746" r="26" fill="url(#iron)" stroke="#141210" stroke-width="2"/>
  <circle cx="938" cy="740" r="8" fill="#8a8680" opacity=".6"/>
  <circle cx="${pier.x + pier.w / 2}" cy="${pier.top + 20}" r="16" fill="url(#brass)" stroke="#5e3f14" stroke-width="2"/>
  ${tube}
  <path d="M790 610 L830 650 L860 620 L820 580 Z" fill="url(#brass)" stroke="#5e3f14" stroke-width="2"/>`;
}

function eyepieceBox(omit) {
  return `
  ${shadow(950, PLATFORM.top + 2, 70, 6, 0.8)}
  <rect x="880" y="1094" width="140" height="32" rx="3" fill="url(#walnut)" stroke="#2a170b" stroke-width="2"/>
  <rect x="884" y="1098" width="132" height="5" fill="#b07a48" opacity=".6"/>
  <rect x="940" y="1108" width="20" height="8" rx="2" fill="url(#brass)"/>
  ${t(omit, "oculos")}
  <path d="M872 1092 L922 1086 L926 1128 L876 1130 Z" fill="url(#page)" stroke="#8a6a3c" stroke-width="1.5"/>
  <path d="M880 1100 L918 1096 M881 1108 L919 1104 M882 1116 L920 1112" stroke="#8a7a5a" stroke-width="1.2"/>
  ${lookSvg("argolas")}`;
}

function chairAndBlanket(omit) {
  // the observing chair on the dais; its plaid blanket has slipped down onto the slippers
  return `
  ${shadow(1136, PLATFORM.top + 2, 70, 6, 0.8)}
  <path d="M1086 ${PLATFORM.top} L1092 1004 M1184 ${PLATFORM.top} L1178 1004" stroke="url(#woodV)" stroke-width="10"/>
  <path d="M1092 1004 L1100 900 M1178 1004 L1172 900" stroke="url(#woodV)" stroke-width="10"/>
  <rect x="1094" y="900" width="82" height="14" rx="4" fill="url(#woodH)"/>
  <rect x="1098" y="934" width="74" height="10" rx="3" fill="url(#woodH)"/>
  <path d="M1078 1000 L1192 1000 L1188 1014 L1082 1014 Z" fill="url(#wood)" stroke="#2a170b" stroke-width="2"/>
  ${t(omit, "pantufas")}
  <path d="M1120 1008 C1110 1060 1130 1100 1112 1150 C1104 1190 1124 1226 1102 1268 L1170 1300 C1190 1250 1178 1200 1188 1150 C1196 1100 1180 1050 1186 1008 Z" fill="#7a2a2a" stroke="#3e1010" stroke-width="2"/>
  ${[1040, 1090, 1140, 1190, 1240].map((y) => `<path d="M1112 ${y} C1140 ${y + 6} 1166 ${y + 4} 1190 ${y - 2}" stroke="#d6ac5c" stroke-width="3" fill="none" opacity=".8"/>`).join("")}
  ${[1124, 1146, 1168].map((x) => `<path d="M${x} 1010 C${x - 6} 1100 ${x + 4} 1200 ${x - 10} 1290" stroke="#2c4a3a" stroke-width="4" fill="none" opacity=".7"/>`).join("")}
  <path d="M1102 1268 L1098 1282 M1116 1274 L1112 1288 M1130 1280 L1128 1294 M1146 1288 L1144 1300 M1160 1294 L1160 1306" stroke="#d6ac5c" stroke-width="2.5"/>`;
}

function mouseHole(omit) {
  // the mouse comes out of its hole: its back half is still inside, in the dark
  const hole = (x0, x1) => `M${x0} ${FLOOR_Y} L${x0} 1150 C${x0} 1124 ${x1} 1124 ${x1} 1150 L${x1} ${FLOOR_Y} Z`;
  return `
  <path d="${hole(604, 668)}" fill="#0e0805"/>
  ${t(omit, "ratinho")}
  <path d="M616 ${FLOOR_Y} L616 1140 C626 1128 660 1126 668 1150 L668 ${FLOOR_Y} Z" fill="#0e0805"/>
  <path d="M600 ${FLOOR_Y} L600 1150 C600 1120 672 1120 672 1150 L672 ${FLOOR_Y}" stroke="#6a4428" stroke-width="4" fill="none"/>`;
}

function cupulaFloor() {
  return `
  ${lookSvg("escova")}
  ${shadow(842, 1312, 80, 8, 0.7)}
  ${bookStack(790, 1310, [[110, 22, "#2d4a68"], [96, 18, "#7a3024", 6], [84, 16, "#bba57c", 10]])}
  ${shadow(520, 1372, 110, 12, 0.8)}
  <rect x="420" y="1300" width="200" height="66" rx="8" fill="#3c4a5a" stroke="#141c24" stroke-width="3"/>
  <rect x="420" y="1300" width="200" height="12" rx="6" fill="#56687a"/>
  ${[440, 590].map((x) => `<rect x="${x}" y="1300" width="12" height="66" fill="url(#brassV)"/>`).join("")}
  <rect x="505" y="1320" width="30" height="16" rx="3" fill="url(#brass)"/>`;
}

function arquivoMaps() {
  // a basket of rolled maps by the drawers
  let rolls = "";
  [[2620, 1020, -8], [2638, 1000, 4], [2656, 1030, 12], [2600, 1040, -16]].forEach(([x, y, tilt]) => {
    rolls += `<g transform="rotate(${tilt} ${x} 1200)"><rect x="${x - 9}" y="${y}" width="18" height="190" rx="9" fill="url(#parchment)" stroke="#8a6a3c" stroke-width="1.2"/><ellipse cx="${x}" cy="${y}" rx="9" ry="4" fill="#efe0bc" stroke="#8a6a3c" stroke-width="1"/></g>`;
  });
  return `${shadow(2630, 1262, 60, 8, 0.8)}${rolls}<path d="M2582 1150 L2678 1150 L2668 1258 L2592 1258 Z" fill="#7a5a32" stroke="#3a2614" stroke-width="2"/>${[1170, 1196, 1222, 1248].map((y) => `<path d="M2586 ${y} L2674 ${y}" stroke="#4e3a20" stroke-width="2"/>`).join("")}`;
}

// --- Bancada ---------------------------------------------------------------------------------------------

function shelf(x0, x1, y) {
  return `
  ${occlusion(x0, y + 10, x1 - x0, 24, 0.55)}
  <rect x="${x0}" y="${y}" width="${x1 - x0}" height="16" fill="url(#woodV)" stroke="#2a170b" stroke-width="1.5"/>
  <rect x="${x0}" y="${y}" width="${x1 - x0}" height="3" fill="#d8a874" opacity=".55"/>
  <path d="M${x0 + 20} ${y + 16} L${x0 + 20} ${y + 56} L${x0 + 56} ${y + 16} Z M${x1 - 20} ${y + 16} L${x1 - 20} ${y + 56} L${x1 - 56} ${y + 16} Z" fill="url(#iron)"/>`;
}

function leftShelf(omit) {
  const y = 640;
  return `
  ${shelf(1278, 1530, y)}
  ${lookSvg("funil")}
  ${book(1360, y - 92, 22, 92, "#2d4a68")}
  ${t(omit, "sino")}
  ${book(1440, y - 104, 22, 104, "#7a3024", { tilt: -14 })}
  ${bookRun(1470, y, 3, 31, { minH: 80, maxH: 110 }).svg}`;
}

function rightShelf() {
  const y = 640;
  return `
  ${shelf(2070, 2366, y)}
  ${bookRun(2084, y, 3, 77, { minH: 74, maxH: 108 }).svg}
  ${lookSvg("esfera-armilar")}
  ${lookSvg("regador")}
  <path d="M2316 572 C2300 540 2306 520 2318 510 M2316 572 C2330 546 2346 540 2356 532" stroke="#4c8a4a" stroke-width="4" fill="none"/>`;
}

function pendantLamp() {
  return `
  <path d="M1800 0 L1800 640" stroke="#2a2420" stroke-width="5"/>
  ${Array.from({ length: 30 }, (_, i) => `<ellipse cx="1800" cy="${20 + i * 21}" rx="3.5" ry="8" fill="none" stroke="#6a5a42" stroke-width="2"/>`).join("")}
  <path d="M1772 640 L1828 640 L1834 656 L1766 656 Z" fill="url(#brass)" stroke="#5e3f14" stroke-width="1.5"/>
  <path d="M1766 656 C1740 668 1720 690 1712 716 L1888 716 C1880 690 1860 668 1834 656 Z" fill="url(#ambGlass)" stroke="#5e3f14" stroke-width="2"/>
  <path d="M1712 716 L1888 716 L1882 726 L1718 726 Z" fill="url(#brassH)"/>
  ${[1730, 1760, 1790, 1820, 1850, 1880].map((x) => `<path d="M${x} 726 L${x - 2} 742 L${x + 2} 742 Z" fill="#e8b74c"/>`).join("")}
  <ellipse cx="1800" cy="722" rx="40" ry="6" fill="#fff4cc"/>`;
}

function wallCharts() {
  // star charts pinned around the window (paper, pins, a corner curling)
  const chart = (x, y, w, h, tilt, seed) => {
    const rnd = seeded(seed);
    let dots = "";
    for (let i = 0; i < 12; i += 1) dots += `<circle cx="${n(x + 10 + rnd() * (w - 20))}" cy="${n(y + 10 + rnd() * (h - 20))}" r="${n(1.5 + rnd() * 2)}" fill="#3a2a18"/>`;
    return `<g transform="rotate(${tilt} ${x + w / 2} ${y + h / 2})">
      <rect x="${x + 6}" y="${y + 8}" width="${w}" height="${h}" fill="#000" opacity=".35" filter="url(#soft6)"/>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#parchment)"/>
      <circle cx="${x + w / 2}" cy="${y + h / 2}" r="${Math.min(w, h) * 0.36}" fill="none" stroke="#8a6a3c" stroke-width="1.5"/>
      ${dots}
      <circle cx="${x + 8}" cy="${y + 8}" r="4" fill="#9e2a2a"/><circle cx="${x + w - 8}" cy="${y + 8}" r="4" fill="#9e2a2a"/>
    </g>`;
  };
  return `${chart(1290, 300, 150, 110, -4, 11)}${chart(2110, 330, 130, 100, 5, 23)}${chart(1300, 440, 110, 86, 3, 37)}`;
}

function drawingBoard(omit) {
  const x0 = 1388;
  const x1 = 1716;
  const yTop = 770;
  const yBot = 930;
  let constellation = "";
  const rnd = seeded(0xc0a5);
  const pts = Array.from({ length: 9 }, () => [x0 + 30 + rnd() * (x1 - x0 - 60), yTop + 24 + rnd() * (yBot - yTop - 48)]);
  constellation += `<path d="M${pts.slice(0, 5).map(([x, y]) => `${n(x)} ${n(y)}`).join(" L")}" stroke="#7a5a32" stroke-width="1.5" fill="none" opacity=".8"/>`;
  constellation += pts.map(([x, y]) => `<circle cx="${n(x)}" cy="${n(y)}" r="3" fill="#3a2a18"/>`).join("");
  return `
  <path d="M${x0 + 30} ${yBot} L${x0 + 60} ${yTop + 30} M${x1 - 30} ${yBot} L${x1 - 60} ${yTop + 30}" stroke="url(#woodV)" stroke-width="10"/>
  ${occlusion(x0, yTop + 6, x1 - x0, yBot - yTop, 0.4)}
  <rect x="${x0}" y="${yTop}" width="${x1 - x0}" height="${yBot - yTop}" rx="4" fill="url(#woodLight)" stroke="#5a3a1f" stroke-width="2"/>
  <rect x="${x0 + 16}" y="${yTop + 12}" width="${x1 - x0 - 32}" height="${yBot - yTop - 22}" fill="url(#parchment)"/>
  <circle cx="${(x0 + x1) / 2 - 40}" cy="${(yTop + yBot) / 2}" r="62" fill="none" stroke="#8a6a3c" stroke-width="1.5" stroke-dasharray="6 4"/>
  ${constellation}
  ${[x0 + 24, x1 - 24].map((x) => `<circle cx="${x}" cy="${yTop + 18}" r="5" fill="#9e2a2a"/>`).join("")}
  <rect x="${x0 - 4}" y="${yBot - 8}" width="${x1 - x0 + 8}" height="12" rx="2" fill="url(#woodV)"/>
  ${t(omit, "compasso")}
  <rect x="1540" y="884" width="140" height="12" fill="url(#brassH)" stroke="#5e3f14" stroke-width="1" transform="rotate(-6 1610 890)"/>
  ${[1550, 1564, 1578, 1592, 1606, 1620, 1634, 1648, 1662].map((x) => `<path d="M${x} 884 L${x} 890" stroke="#5e3f14" stroke-width="1" transform="rotate(-6 1610 890)"/>`).join("")}`;
}

function deskTop() {
  const { x0, x1, top, edge, apron, apronBottom, floor } = DESK;
  return `
  ${shadow((x0 + x1) / 2, floor + 6, (x1 - x0) / 2 + 40, 18, 0.9)}
  ${occlusion(x0, apronBottom, x1 - x0, floor - apronBottom, 0.6)}
  ${[x0 + 40, x1 - 40].map((x) => `<path d="M${x - 14} ${apronBottom} L${x + 14} ${apronBottom} L${x + 9} ${floor} L${x - 9} ${floor} Z" fill="url(#woodH)" stroke="#2a170b" stroke-width="1.5"/><ellipse cx="${x}" cy="${apronBottom + 40}" rx="16" ry="6" fill="#8a5a33"/>`).join("")}
  <rect x="${x0}" y="${apron}" width="${x1 - x0}" height="${apronBottom - apron}" fill="url(#walnut)" stroke="#2a170b" stroke-width="2"/>
  ${[0, 1, 2, 3].map((i) => {
    const w = (x1 - x0 - 60) / 4;
    const x = x0 + 30 + i * w;
    return `<rect x="${n(x + 8)}" y="${apron + 10}" width="${n(w - 16)}" height="${apronBottom - apron - 20}" rx="3" fill="#4a2c18" stroke="#2a170b" stroke-width="2"/><rect x="${n(x + w / 2 - 14)}" y="${apron + 24}" width="28" height="8" rx="3" fill="url(#brass)"/>`;
  }).join("")}
  <rect x="${x0 - 14}" y="${top}" width="${x1 - x0 + 28}" height="${edge - top}" fill="url(#woodLight)"/>
  <rect x="${x0 - 14}" y="${edge}" width="${x1 - x0 + 28}" height="${apron - edge}" fill="url(#woodH)" stroke="#2a170b" stroke-width="2"/>
  <rect x="${x0 - 14}" y="${edge}" width="${x1 - x0 + 28}" height="4" fill="#ecc690" opacity=".55"/>`;
}

function deskItems(omit) {
  return `
  ${t(omit, "vela")}
  ${lookSvg("pinca")}
  <path d="M1716 948 L1830 940 L1836 956 L1720 962 Z" fill="url(#page)" opacity=".95"/>
  <path d="M1726 950 L1820 944" stroke="#8a6a3c" stroke-width="1"/>
  ${t(omit, "maca")}
  <g>
    ${shadow(1750, 962, 28, 4)}
    <path d="M1726 964 L1774 964 L1770 926 L1730 926 Z" fill="#20283a" stroke="#0e121c" stroke-width="1.5"/>
    <rect x="1739" y="916" width="24" height="11" rx="2" fill="#141a28"/>
    <path d="M1732 928 L1736 962" stroke="#9aa6c0" stroke-width="2" opacity=".6"/>
    <path d="M1754 918 L1778 862" stroke="#f4ead2" stroke-width="3"/>
  </g>
  <rect x="1828" y="946" width="166" height="12" rx="4" fill="url(#brassH)" stroke="#5e3f14" stroke-width="1.2"/>
  ${t(omit, "bule")}
  ${bookStack(1832, 958, [[52, 18, "#683040"], [46, 16, "#2d4a68", 3], [42, 22, "#4a6a3a", 5]])}
  <g>
    <path d="M1988 930 L2026 930 L2022 952 L1992 952 Z" fill="url(#porcelain)" stroke="#6a665c" stroke-width="1.2"/>
    <path d="M2026 936 C2036 936 2036 948 2024 948" stroke="#e6e0d0" stroke-width="3" fill="none"/>
    <path d="M1990 944 L2024 944" stroke="#2b5c9a" stroke-width="3"/>
  </g>
  ${t(omit, "sistema-solar")}
  ${bookStack(2236, 958, [[60, 16, "#21324f"], [54, 14, "#9c7230", 4]])}`;
}

function windsorChair() {
  const seat = 1110;
  return `
  ${shadow(1736, 1300, 120, 12, 0.8)}
  <path d="M1650 ${seat + 10} L1636 1300 M1820 ${seat + 10} L1834 1300 M1676 ${seat + 10} L1680 1290 M1796 ${seat + 10} L1792 1290" stroke="url(#woodV)" stroke-width="12" stroke-linecap="round"/>
  <path d="M1660 1220 L1810 1220" stroke="#5a3a1f" stroke-width="7"/>
  <path d="M1640 ${seat} C1640 ${seat - 14} 1830 ${seat - 14} 1830 ${seat} L1824 ${seat + 18} C1760 ${seat + 26} 1710 ${seat + 26} 1646 ${seat + 18} Z" fill="url(#wood)" stroke="#2a170b" stroke-width="2"/>
  ${[1666, 1694, 1722, 1750, 1778, 1806].map((x) => `<path d="M${x} ${seat - 6} L${x + (x - 1736) * 0.12} 1000" stroke="url(#woodLight)" stroke-width="7"/>`).join("")}
  <path d="M1640 1006 C1680 980 1792 980 1832 1006 L1828 1020 C1790 996 1682 996 1644 1020 Z" fill="url(#woodLight)" stroke="#5a3a1f" stroke-width="2"/>`;
}

function underDesk() {
  return `
  <path d="M1530 1188 L1664 1188 L1654 1252 L1540 1252 Z" fill="#8a6a3c" stroke="#3e2a14" stroke-width="2"/>
  ${[1196, 1212, 1228, 1244].map((y) => `<path d="M1534 ${y} L1660 ${y}" stroke="#5e4424" stroke-width="2"/>`).join("")}
  ${lookSvg("novelo")}`;
}

// --- Arquivo ---------------------------------------------------------------------------------------------

function microTable(omit) {
  const { x0, x1, top } = MICRO_TABLE;
  return `
  ${shadow((x0 + x1) / 2, FLOOR_Y + 30, (x1 - x0) / 2 + 20, 12, 0.8)}
  ${[x0 + 20, x1 - 20].map((x) => `<rect x="${x - 7}" y="${top + 20}" width="14" height="${FLOOR_Y + 30 - top - 20}" fill="url(#woodH)"/>`).join("")}
  <rect x="${x0 + 14}" y="1110" width="${x1 - x0 - 28}" height="10" fill="url(#woodV)"/>
  ${bookStack(x0 + 30, 1110, [[110, 20, "#2f5d58"], [100, 18, "#94482a", 6]])}
  <rect x="${x0}" y="${top}" width="${x1 - x0}" height="18" rx="3" fill="url(#woodLight)" stroke="#2a170b" stroke-width="1.5"/>
  <rect x="${x0 + 6}" y="${top + 18}" width="${x1 - x0 - 12}" height="22" fill="url(#walnut)"/>
  ${lookSvg("luminaria")}
  ${t(omit, "microscopio")}
  <rect x="2506" y="862" width="62" height="40" rx="2" fill="#7a5a36" stroke="#3a2614" stroke-width="1.5"/>
  <rect x="2512" y="838" width="50" height="26" rx="2" fill="#9a7448" stroke="#3a2614" stroke-width="1.5"/>
  <rect x="2530" y="848" width="14" height="5" fill="#f0e2c0"/><rect x="2526" y="876" width="22" height="5" fill="#f0e2c0"/>
  <rect x="2604" y="884" width="44" height="14" rx="2" fill="#dfe8ec" opacity=".8"/>
  <rect x="2610" y="878" width="32" height="8" rx="1" fill="#c4d4da" opacity=".8"/>`;
}

function mapCabinet(omit) {
  const { x0, x1, top, bottom } = CABINET;
  const rows = 4;
  const cols = 3;
  const rowH = (bottom - 40 - (top + 24)) / rows;
  const colW = (x1 - x0 - 30) / cols;
  let drawers = "";
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (r === 0 && c === 1) continue; // the open one
      const x = x0 + 15 + c * colW;
      const y = top + 24 + r * rowH;
      drawers += `<rect x="${n(x + 4)}" y="${n(y + 4)}" width="${n(colW - 8)}" height="${n(rowH - 8)}" rx="3" fill="#5a3620" stroke="#2a170b" stroke-width="2"/>
        <rect x="${n(x + colW / 2 - 18)}" y="${n(y + rowH / 2 - 4)}" width="36" height="9" rx="3" fill="url(#brass)"/>
        <rect x="${n(x + colW / 2 - 14)}" y="${n(y + 10)}" width="28" height="12" fill="#efe2c2" stroke="#8a6a3c" stroke-width="1"/>`;
    }
  }
  // the half-open drawer (row 0, middle): its inside, the fan in it, then its front pulled forward
  const ox = x0 + 15 + colW;
  const oy = top + 24;
  return `
  ${shadow((x0 + x1) / 2, bottom + 8, (x1 - x0) / 2 + 30, 14, 0.85)}
  <rect x="${x0}" y="${top}" width="${x1 - x0}" height="${bottom - top}" fill="url(#walnut)" stroke="#2a170b" stroke-width="2.5"/>
  <rect x="${x0 - 10}" y="${top}" width="${x1 - x0 + 20}" height="22" fill="url(#woodLight)" stroke="#2a170b" stroke-width="2"/>
  <rect x="${x0 - 10}" y="${top}" width="${x1 - x0 + 20}" height="4" fill="#f0c890" opacity=".5"/>
  ${drawers}
  <rect x="${x0 + 10}" y="${bottom - 30}" width="${x1 - x0 - 20}" height="30" fill="#2a170b"/>
  <rect x="${n(ox + 2)}" y="${oy + 2}" width="${n(colW - 4)}" height="${n(rowH - 4)}" fill="#120a05"/>
  <path d="M${n(ox - 6)} ${oy + 6} L${n(ox + colW + 6)} ${oy + 6} L${n(ox + colW + 14)} ${oy + 66} L${n(ox - 14)} ${oy + 66} Z" fill="#6a4428" stroke="#2a170b" stroke-width="2"/>
  <path d="M${n(ox - 2)} ${oy + 10} L${n(ox + colW + 2)} ${oy + 10} L${n(ox + colW + 8)} ${oy + 60} L${n(ox - 8)} ${oy + 60} Z" fill="#e9dcbc"/>
  ${t(omit, "leque")}
  <rect x="${n(ox - 18)}" y="${oy + 36}" width="${n(colW + 36)}" height="${n(rowH)}" rx="3" fill="#6e4428" stroke="#2a170b" stroke-width="2.5"/>
  <rect x="${n(ox - 14)}" y="${oy + 38}" width="${n(colW + 28)}" height="4" fill="#d8a874" opacity=".5"/>
  <rect x="${n(ox + colW / 2 - 20)}" y="${n(oy + 36 + rowH / 2 - 5)}" width="40" height="10" rx="3" fill="url(#brass)"/>
  ${t(omit, "gramofone")}
  ${t(omit, "gato")}
  ${bookStack(2918, top, [[56, 10, "#3c3833"], [52, 8, "#2d4a68", 2], [58, 12, "#6d5a3a", -2], [50, 9, "#bba57c", 3]])}`;
}

function violinNail(omit) {
  return `
  <path d="M3006 352 C3020 400 3040 470 3070 600" stroke="#000" stroke-width="10" opacity=".25" filter="url(#soft6)"/>
  <path d="M3064 352 L3096 616" stroke="#e8dcc0" stroke-width="2.5"/>
  <path d="M3062 348 L3068 348 L3098 616 L3092 618 Z" fill="#9a5a2a"/>
  <circle cx="3064" cy="350" r="3.5" fill="#8a8580"/>
  ${t(omit, "violino")}
  <circle cx="3004" cy="352" r="4" fill="#8a8580"/>`;
}

function curioCabinet(omit) {
  const { x0, x1, top, bottom } = CURIO;
  const shelves = [470, 600, 700, 836, 980];
  const jar = (x, y, w, h, tint) =>
    `<g><rect x="${x}" y="${y - h}" width="${w}" height="${h}" rx="${w * 0.2}" fill="url(#glassJar)" stroke="#4a6a62" stroke-width="1.5"/>
      <rect x="${x + 2}" y="${y - h - 8}" width="${w - 4}" height="10" rx="2" fill="#7a5a36"/>
      <rect x="${x + 4}" y="${y - h * 0.6}" width="${w - 8}" height="${h * 0.55}" rx="${w * 0.15}" fill="${tint}" opacity=".55"/>
      <rect x="${x + 4}" y="${y - h + 6}" width="5" height="${h - 14}" fill="#fff" opacity=".5"/></g>`;
  return `
  ${shadow((x0 + x1) / 2, bottom + 6, (x1 - x0) / 2 + 20, 12, 0.85)}
  <rect x="${x0}" y="${top}" width="${x1 - x0}" height="${bottom - top}" fill="#1a0f08" stroke="#2a170b" stroke-width="3"/>
  <rect x="${x0 + 14}" y="${top + 14}" width="${x1 - x0 - 28}" height="${bottom - top - 160}" fill="#2a3338"/>
  <path d="M${x0 - 6} ${top - 16} L${x1 + 6} ${top - 16} L${x1 + 16} ${top + 10} L${x0 - 16} ${top + 10} Z" fill="url(#woodV)" stroke="#2a170b" stroke-width="2"/>
  <rect x="${x0}" y="${top + 10}" width="14" height="${bottom - top - 10}" fill="url(#woodH)"/>
  <rect x="${x1 - 14}" y="${top + 10}" width="14" height="${bottom - top - 10}" fill="url(#woodH)"/>
  ${shelves.map((y) => `${occlusion(x0 + 14, y + 6, x1 - x0 - 28, 18, 0.5)}<rect x="${x0 + 14}" y="${y}" width="${x1 - x0 - 28}" height="10" fill="url(#woodV)"/>`).join("")}
  <rect x="${x0 + 14}" y="${bottom - 146}" width="${x1 - x0 - 28}" height="132" fill="url(#walnut)" stroke="#2a170b" stroke-width="2"/>
  <rect x="${(x0 + x1) / 2 - 16}" y="${bottom - 86}" width="32" height="10" rx="3" fill="url(#brass)"/>
  ${jar(3138, 470, 34, 58, "#c9a35a")}${jar(3190, 470, 40, 74, "#7aa36a")}${jar(3250, 470, 30, 50, "#b5584a")}${jar(3292, 470, 40, 66, "#5a7ab5")}
  ${bookRun(3134, 600, 7, 13, { minH: 70, maxH: 104, minW: 12, maxW: 22 }).svg}
  <ellipse cx="3290" cy="590" rx="30" ry="10" fill="#8a7a6a"/><path d="M3266 588 L3280 556 L3298 566 L3312 588 Z" fill="#6a8aa0" stroke="#3a4a5a" stroke-width="1.5"/>
  ${t(omit, "balanca")}
  ${jar(3126, 700, 30, 52, "#d8c890")}
  ${jar(3222, 700, 30, 56, "#a0c0b0")}${jar(3288, 700, 36, 76, "#c9a35a")}
  ${lookSvg("concha")}
  <path d="M3270 836 L3286 790 L3306 812 L3322 780 L3336 836 Z" fill="#9a8ab0" stroke="#5a4a6a" stroke-width="1.5"/>
  <circle cx="3140" cy="826" r="12" fill="#d6c8a8" stroke="#8a7a5a" stroke-width="1.2"/>
  ${bookStack(3132, 980, [[96, 16, "#683040"], [88, 14, "#21324f", 4]])}
  <ellipse cx="3290" cy="960" rx="36" ry="20" fill="#3a6a8a" stroke="#1a3a4a" stroke-width="2"/>
  <path d="M3256 960 C3270 950 3310 950 3324 960" stroke="#d6ac5c" stroke-width="2" fill="none"/>
  <rect x="${x0 + 14}" y="${top + 14}" width="${x1 - x0 - 28}" height="${bottom - top - 160}" fill="url(#glassPane)" opacity=".35"/>
  <path d="M${x0 - 2} ${top + 20} L${x0 - 54} ${top + 50} L${x0 - 54} ${bottom - 190} L${x0 - 2} ${bottom - 150} Z" fill="url(#glassPane)" stroke="url(#woodH)" stroke-width="8"/>
  <circle cx="${x0 - 46}" cy="${(top + bottom) / 2 - 40}" r="5" fill="url(#brass)"/>`;
}

function mobileFromCeiling() {
  const l = box("mobile");
  return `<path d="M${l.x + l.w / 2} ${RING_Y + 24} L${l.x + l.w / 2} ${l.y + 2}" stroke="#c9b48a" stroke-width="1.5"/>${lookSvg("mobile")}`;
}

function arquivoFloor() {
  return `
  ${lookSvg("almofada")}
  ${shadow(2560, 1330, 120, 12, 0.7)}
  <rect x="2450" y="1250" width="220" height="70" rx="6" fill="#4a3020" stroke="#2a170b" stroke-width="2"/>
  <rect x="2450" y="1240" width="220" height="16" rx="4" fill="#6a4428"/>
  ${[2480, 2640].map((x) => `<rect x="${x}" y="1260" width="14" height="56" fill="url(#brassV)"/>`).join("")}
  <rect x="2540" y="1272" width="40" height="18" rx="3" fill="url(#brass)"/>`;
}

function globeStand() {
  // a celestial globe by the cabinet: scenery (no globe is in this room's pool)
  return `
  ${shadow(3050, 1300, 70, 10, 0.8)}
  <path d="M3010 1300 L3050 1210 L3090 1300" stroke="url(#woodV)" stroke-width="10" fill="none"/>
  <circle cx="3050" cy="1150" r="62" fill="#1f3550" stroke="#0e1a28" stroke-width="2"/>
  ${Array.from({ length: 14 }, (_, i) => `<circle cx="${3010 + ((i * 37) % 80)}" cy="${1110 + ((i * 53) % 80)}" r="2" fill="#f6e3a0"/>`).join("")}
  <path d="M2990 1150 C3010 1130 3090 1130 3110 1150" stroke="#d6ac5c" stroke-width="2" fill="none"/>
  <circle cx="3050" cy="1150" r="70" fill="none" stroke="url(#brass)" stroke-width="7"/>`;
}

function wallClock() {
  // a brass clock on the archive's wall (scenery): ten to seven, the hour the dome opens
  const cx = 2790;
  const cy = 440;
  const hand = (deg, length, width, color) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return `<path d="M${cx} ${cy} L${n(cx + Math.cos(a) * length)} ${n(cy + Math.sin(a) * length)}" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  };
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i * 30 * Math.PI) / 180;
    const inner = i % 3 === 0 ? 31 : 35;
    return `<path d="M${n(cx + Math.sin(a) * inner)} ${n(cy - Math.cos(a) * inner)} L${n(cx + Math.sin(a) * 40)} ${n(cy - Math.cos(a) * 40)}" stroke="#4a3414" stroke-width="${i % 3 === 0 ? 3 : 2}"/>`;
  }).join("");
  return `
  <circle cx="${cx + 5}" cy="${cy + 9}" r="56" fill="#000" opacity=".38" filter="url(#soft6)"/>
  <path d="M${cx} ${cy - 54} L${cx} ${cy - 74}" stroke="#4a3414" stroke-width="2"/><circle cx="${cx}" cy="${cy - 76}" r="4" fill="url(#brassBall)"/>
  <circle cx="${cx}" cy="${cy}" r="54" fill="url(#brass)" stroke="#4a3414" stroke-width="2"/>
  <circle cx="${cx}" cy="${cy}" r="45" fill="url(#parchment)" stroke="#8a6a32" stroke-width="2"/>
  ${ticks}
  ${hand(205, 22, 5, "#2a1a0c")}
  ${hand(300, 34, 3, "#2a1a0c")}
  <circle cx="${cx}" cy="${cy}" r="4" fill="url(#brassBall)"/>`;
}

function readingStool() {
  // a low stool by the cabinet with the big star atlases on it (scenery)
  const x = 3110;
  const seat = 1376;
  const w = 150;
  const foot = seat + 78;
  return `
  ${shadow(x + w / 2, foot + 2, 96, 12, 0.85)}
  <path d="M${x + 34} ${seat + 12} L${x + 40} ${foot - 14} M${x + w - 34} ${seat + 12} L${x + w - 40} ${foot - 14}" stroke="url(#woodDark)" stroke-width="10" stroke-linecap="round"/>
  <path d="M${x + 14} ${seat + 12} L${x + 6} ${foot} M${x + w - 14} ${seat + 12} L${x + w - 6} ${foot}" stroke="url(#woodV)" stroke-width="12" stroke-linecap="round"/>
  <path d="M${x + 12} ${seat + 42} L${x + w - 12} ${seat + 42}" stroke="url(#woodH)" stroke-width="7"/>
  <rect x="${x}" y="${seat}" width="${w}" height="18" rx="6" fill="url(#wood)" stroke="#2a170b" stroke-width="2"/>
  ${bookStack(x + 12, seat, [
    [128, 20, "#21324f"],
    [116, 17, "#7a3024", 8],
    [100, 15, "#4a6a3a", 4],
  ])}
  <path d="${starPath(x + 66, seat - 44, 5)}" fill="#e7cf98"/>`;
}

// --- the composed plate ----------------------------------------------------------------------------------

function plateSvg({ omit = null, debug = false } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${DEFS}
    <clipPath id="notOpenings"><path d="M0 0 H${W} V${H} H0 Z ${openingsPath()}" clip-rule="evenodd"/></clipPath>
  </defs>
  ${wallAndDome()}
  ${slitFrame()}
  ${oculusFrame()}
  ${wainscot()}
  ${posts()}
  ${floorAndRug()}
  ${bookcase()}
  ${ladder()}
  ${t(omit, "coruja")}
  ${t(omit, "pipa")}
  ${sideTable(omit)}
  ${mouseHole(omit)}
  ${platform()}
  ${telescope()}
  ${eyepieceBox(omit)}
  ${chairAndBlanket(omit)}
  ${cupulaFloor()}
  ${wallCharts()}
  ${leftShelf(omit)}
  ${rightShelf()}
  ${pendantLamp()}
  ${drawingBoard(omit)}
  ${deskTop()}
  ${deskItems(omit)}
  ${underDesk()}
  ${windsorChair()}
  ${moonChart()}
  ${wallClock()}
  ${microTable(omit)}
  ${mobileFromCeiling()}
  ${violinNail(omit)}
  ${arquivoMaps()}
  ${mapCabinet(omit)}
  ${curioCabinet(omit)}
  ${globeStand()}
  ${arquivoFloor()}
  ${readingStool()}
  ${debug ? debugOverlaySvg(ROOM, { x: DATA.SAFE_MARGIN_X, y: DATA.SAFE_MARGIN_Y }) : ""}
</svg>`;
}

// --- light: dusk outside, lamps inside ---------------------------------------------------------------------

/**
 * The light pass, multiplied over the plate: white keeps the albedo, warm cream
 * lights it, cool blue-grey shades it. Painted at half size (it is soft
 * everywhere) and scaled up. The --audit table checks that no target falls
 * under its tier's floors on the composed room.
 */
function lightSvg() {
  const pool = (cx, cy, rx, ry, color, opacity) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${color}" opacity="${opacity}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W / 2}" height="${H / 2}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="ambient" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#a7aec6"/><stop offset=".3" stop-color="#b9b8c4"/><stop offset=".5" stop-color="#c9bfb4"/><stop offset=".72" stop-color="#b3abaf"/><stop offset="1" stop-color="#9a98ae"/>
    </linearGradient>
    <linearGradient id="ceiling" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4c4f68"/><stop offset=".6" stop-color="#6c6e86" stop-opacity=".5"/><stop offset="1" stop-color="#6c6e86" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="floorFall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6a6c84" stop-opacity="0"/><stop offset="1" stop-color="#6a6c84" stop-opacity=".9"/>
    </linearGradient>
    <linearGradient id="moonbeam" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e6ecff"/><stop offset="1" stop-color="#e6ecff" stop-opacity="0"/>
    </linearGradient>
    <filter id="lsoft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="50"/></filter>
    <filter id="lsoft2" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="18"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#ambient)"/>
  <rect width="${W}" height="520" fill="url(#ceiling)"/>
  <rect y="1250" width="${W}" height="350" fill="url(#floorFall)"/>
  <g filter="url(#lsoft)">
    ${pool(1800, 930, 720, 360, "#fff3dc", 0.95)}
    ${pool(1800, 1300, 520, 140, "#ffeccc", 0.6)}
    ${pool(1330, 820, 230, 230, "#fff0d0", 0.85)}
    ${pool(2470, 820, 300, 280, "#f2f4d8", 0.75)}
    ${pool(3220, 560, 340, 420, "#fde6c4", 0.75)}
    ${pool(1800, 460, 360, 320, "#f4e2e0", 0.55)}
    ${pool(720, 760, 420, 520, "#e2e8f8", 0.8)}
    ${pool(380, 520, 220, 260, "#e4e8f4", 0.55)}
    ${pool(2900, 760, 340, 300, "#f6e4cc", 0.55)}
  </g>
  <g filter="url(#lsoft2)">
    <path d="M${SLIT.x0} ${SLIT.bottom} L${SLIT.x1} ${SLIT.bottom} L1180 ${PLATFORM.step} L520 ${PLATFORM.step} Z" fill="url(#moonbeam)" opacity=".55"/>
  </g>
  <g filter="url(#lsoft2)" fill="#5c5e78" opacity=".7">
    <rect x="${DESK.x0}" y="${DESK.apronBottom}" width="${DESK.x1 - DESK.x0}" height="${DESK.floor - DESK.apronBottom}"/>
    <rect x="${CABINET.x0}" y="${CABINET.bottom - 10}" width="${CABINET.x1 - CABINET.x0}" height="60"/>
    <rect x="1278" y="660" width="252" height="40"/>
    <rect x="2070" y="660" width="296" height="40"/>
    <ellipse cx="1736" cy="1300" rx="140" ry="20"/>
  </g>
</svg>`;
}

/** Bloom, screened over the lit plate: lamps, the candle, the sky's glow, the moonbeam and dust in the lamplight. */
function glowSvg() {
  const rnd = seeded(0xd057);
  let motes = "";
  for (let i = 0; i < 80; i += 1) {
    const x = 1560 + rnd() * 480;
    const y = 740 + rnd() * 240;
    motes += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(1 + rnd() * 2)}" fill="#ffe2a8" opacity="${n(0.3 + rnd() * 0.5)}"/>`;
  }
  for (let i = 0; i < 40; i += 1) {
    const x = 620 + rnd() * 400;
    const y = 560 + rnd() * 500;
    motes += `<circle cx="${n(x)}" cy="${n(y)}" r="${n(1 + rnd() * 1.6)}" fill="#dfe8ff" opacity="${n(0.25 + rnd() * 0.4)}"/>`;
  }
  const glow = (cx, cy, r, color, opacity) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${opacity}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W / 2}" height="${H / 2}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="gsoft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="40"/></filter>
    <filter id="gmid" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
    <filter id="gfine" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2"/></filter>
    <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bcd0ff" stop-opacity=".5"/><stop offset="1" stop-color="#bcd0ff" stop-opacity="0"/></linearGradient>
    <linearGradient id="cone" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffcf80" stop-opacity=".42"/><stop offset="1" stop-color="#ffcf80" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#000"/>
  <g filter="url(#gsoft)">
    ${glow(1800, 720, 210, "#ffb45a", 0.55)}
    ${glow(1328, 800, 120, "#ffb050", 0.6)}
    ${glow(2450, 790, 120, "#9ef0b0", 0.35)}
    ${glow(OCULUS.cx, OCULUS.cy + 120, 260, "#ff9a6a", 0.22)}
    ${glow(730, 300, 220, "#9ab4ff", 0.22)}
  </g>
  <g filter="url(#gmid)">
    <path d="M1712 726 L1888 726 L2060 1000 L1540 1000 Z" fill="url(#cone)"/>
    <path d="M${SLIT.x0 + 20} ${SLIT.bottom} L${SLIT.x1 - 20} ${SLIT.bottom} L1100 1180 L560 1180 Z" fill="url(#beam)" opacity=".6"/>
    ${glow(1328, 804, 30, "#fff2c0", 0.8)}
    ${glow(1800, 722, 46, "#fff2c0", 0.7)}
  </g>
  <g filter="url(#gfine)">${motes}</g>
</svg>`;
}

// --- the foreground layers ---------------------------------------------------------------------------------

function frontTopSvg() {
  const { w, h } = LAYER["front-top"].rect;
  let ornaments = "";
  for (const x of [380, 1180, 2320, 2980]) {
    ornaments += `<path d="M${x} 70 L${x} ${110}" stroke="#2a2420" stroke-width="2"/><path d="${starPath(x, 126, 18)}" fill="url(#brass)" stroke="#5e3f14" stroke-width="1.5"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>${DEFS}</defs>
  <path d="M0 0 H${w} V58 C${w * 0.75} 84 ${w * 0.25} 84 0 58 Z" fill="url(#woodDark)"/>
  <path d="M0 50 C${w * 0.25} 76 ${w * 0.75} 76 ${w} 50" stroke="#7a5232" stroke-width="5" fill="none" opacity=".7"/>
  ${[300, 900, 1500, 2100, 2700, 3300].map((x) => `<rect x="${x - 10}" y="44" width="20" height="30" rx="3" fill="url(#iron)"/>`).join("")}
  ${ornaments}
</svg>`;
}

function frontLeftSvg() {
  const { w, h } = LAYER.front.rect;
  let folds = "";
  for (const x of [26, 64, 104, 140]) folds += `<path d="M${x} 0 C${x + 10} 400 ${x - 12} 900 ${x + 6} ${h}" stroke="#08191c" stroke-width="10" fill="none" opacity=".55"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>${DEFS}</defs>
  <path d="M0 0 L176 0 C168 300 150 520 166 700 C178 820 150 900 120 960 C150 1060 170 1300 176 ${h} L0 ${h} Z" fill="url(#velvet)"/>
  ${folds}
  <path d="M176 0 C168 300 150 520 166 700 C178 820 150 900 120 960 C150 1060 170 1300 176 ${h}" stroke="#d6ac5c" stroke-width="5" fill="none" opacity=".75"/>
  <path d="M0 940 C60 920 120 930 170 960" stroke="url(#brassH)" stroke-width="12" fill="none"/>
  <circle cx="150" cy="972" r="14" fill="url(#brass)"/>
  <path d="M142 984 L136 1050 L164 1050 L158 984 Z" fill="#d6ac5c"/>
  ${[138, 144, 150, 156, 162].map((x) => `<path d="M${x} 1050 L${x} 1072" stroke="#c49a52" stroke-width="2"/>`).join("")}
  ${shadow(190, 1590, 190, 18, 0.9)}
  <rect x="0" y="1470" width="372" height="130" rx="10" fill="#4a2c18" stroke="#1a0f08" stroke-width="4"/>
  ${[40, 180, 320].map((x) => `<rect x="${x}" y="1470" width="18" height="130" fill="url(#brassV)"/>`).join("")}
  <rect x="0" y="1470" width="372" height="10" fill="#8a5a33" opacity=".6"/>
  <rect x="20" y="1404" width="300" height="72" rx="8" fill="#5c3a22" stroke="#1a0f08" stroke-width="4"/>
  <rect x="20" y="1404" width="300" height="8" fill="#a07048" opacity=".55"/>
  <rect x="150" y="1430" width="40" height="24" rx="4" fill="url(#brass)"/>
  <rect x="200" y="1404" width="16" height="72" fill="#2a170b" opacity=".6"/>
</svg>`;
}

function frontRightSvg() {
  const { x: X, w, h } = LAYER["front-right"].rect;
  const lx = 3440 - X;
  let holes = "";
  for (let i = 0; i < 18; i += 1) {
    const yy = 300 + (i % 6) * 22;
    const xx = lx - 40 + Math.floor(i / 6) * 40;
    holes += `<path d="${starPath(xx, yy, 6)}" fill="#fff0b8"/>`;
  }
  let fern = "";
  const fx = 3500 - X;
  for (let i = 0; i < 9; i += 1) {
    const a = -150 + i * 18;
    const rad = (a * Math.PI) / 180;
    const len = 260 + (i % 3) * 60;
    const ex = fx + Math.cos(rad) * len;
    const ey = 1380 + Math.sin(rad) * len;
    fern += `<path d="M${fx} 1380 Q${n((fx + ex) / 2)} ${n(Math.min(1380, ey) - 60)} ${n(ex)} ${n(ey)}" stroke="#2c5a2a" stroke-width="10" fill="none" stroke-linecap="round"/>`;
    for (let k = 1; k < 8; k += 1) {
      const px = fx + ((ex - fx) * k) / 8;
      const py = 1380 + ((ey - 1380) * k) / 8 - Math.sin((k / 8) * Math.PI) * 50;
      fern += `<ellipse cx="${n(px)}" cy="${n(py)}" rx="22" ry="8" fill="#3f7a38" transform="rotate(${a + 60} ${n(px)} ${n(py)})"/><ellipse cx="${n(px)}" cy="${n(py)}" rx="22" ry="8" fill="#336a2e" transform="rotate(${a - 60} ${n(px)} ${n(py)})"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>${DEFS}</defs>
  <path d="M${lx} 0 L${lx} 220" stroke="#2a2420" stroke-width="4"/>
  ${Array.from({ length: 10 }, (_, i) => `<ellipse cx="${lx}" cy="${12 + i * 21}" rx="3.5" ry="8" fill="none" stroke="#6a5a42" stroke-width="2"/>`).join("")}
  <path d="M${lx - 24} 220 L${lx + 24} 220 L${lx + 30} 240 L${lx - 30} 240 Z" fill="url(#brass)"/>
  <path d="M${lx - 60} 240 L${lx + 60} 240 L${lx + 66} 420 C${lx + 40} 450 ${lx - 40} 450 ${lx - 66} 420 Z" fill="url(#brass)" stroke="#5e3f14" stroke-width="3"/>
  ${holes}
  <path d="M${lx - 66} 420 C${lx - 40} 450 ${lx + 40} 450 ${lx + 66} 420 L${lx + 40} 460 L${lx - 40} 460 Z" fill="url(#brassV)"/>
  <circle cx="${lx}" cy="464" r="8" fill="url(#brass)"/>
  ${fern}
  <path d="M${fx - 90} 1440 L${fx + 90} 1440 L${fx + 72} 1600 L${fx - 72} 1600 Z" fill="#9a4a2a" stroke="#4a1e0e" stroke-width="3"/>
  <rect x="${fx - 98}" y="1430" width="196" height="22" rx="6" fill="#b25a34" stroke="#4a1e0e" stroke-width="3"/>
</svg>`;
}

// --- thumbnails -----------------------------------------------------------------------------------------

function thumbSvg(id) {
  const size = 160;
  const pad = 14;
  const art = ART[id];
  const into = { x: pad, y: pad, w: size - 2 * pad, h: size - 2 * pad };
  const body = art.view
    ? fit(`<g transform="translate(${-art.view.x} ${-art.view.y})">${art.body}</g>`, { w: art.view.w, h: art.view.h }, into)
    : fit(art.body, art.nominal, into);
  // a faint cream rim so a dark object still reads on the HUD's dark glass
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs>${DEFS}
    <filter id="rim" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="2.5" result="d"/><feGaussianBlur in="d" stdDeviation="2" result="b"/><feFlood flood-color="#fff2d6" flood-opacity=".55"/><feComposite in2="b" operator="in" result="rim"/><feMerge><feMergeNode in="rim"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs><g filter="url(#rim)">${body}</g></svg>`;
}

// --- run --------------------------------------------------------------------------------------------------

/** The plate as it ships: albedo × light (multiply), + bloom (screen), + grain (soft light), the openings kept clear. */
async function composePlate(albedoPng) {
  const { data: rgba, info } = await sharp(albedoPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = Buffer.alloc(info.width * info.height);
  for (let i = 0; i < alpha.length; i += 1) alpha[i] = rgba[i * 4 + 3];
  const light = await render(lightSvg()).resize(W, H).removeAlpha().png().toBuffer();
  const glow = await render(glowSvg()).resize(W, H).removeAlpha().png().toBuffer();
  const grain = await grainLayer(W, H, { seed: 0x0b5e_7a11 });
  const rgb = await sharp(albedoPng)
    .flatten({ background: "#000000" })
    .composite([
      { input: light, blend: "multiply" },
      { input: glow, blend: "screen" },
      { input: grain, blend: "soft-light" },
    ])
    .removeAlpha()
    .raw()
    .toBuffer();
  return sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
    .joinChannel(alpha, { raw: { width: W, height: H, channels: 1 } })
    .png()
    .toBuffer();
}

/** A foreground layer: a touch darker and softer than the room (nearer the eye, out of the light). */
async function composeFront(svg, { brightness = 0.72, blur = 1.2 } = {}) {
  const png = await render(svg).png().toBuffer();
  return sharp(png).modulate({ brightness, saturation: 0.9 }).blur(blur).png().toBuffer();
}

async function main() {
  const preview = PREVIEW ? path.resolve(PREVIEW) : null;
  const reviewDir = preview ?? REVIEW;
  if (!preview) fs.mkdirSync(path.join(OUT, "thumbs"), { recursive: true });
  fs.mkdirSync(reviewDir, { recursive: true });
  const report = [];
  const write = async (pipeline, file, options) => {
    await pipeline.webp(options).toFile(file);
    report.push([path.relative(ROOT, file), fs.statSync(file).size]);
  };

  const back = await render(backSvg()).png().toBuffer();
  const albedo = await render(plateSvg()).png().toBuffer();
  const plate = await composePlate(albedo);
  // the lantern on the right glows: it keeps more of its brightness than the other foreground paint
  const frontTop = await composeFront(frontTopSvg(), { brightness: 0.62, blur: 1.4 });
  const front = await composeFront(frontLeftSvg());
  const frontRight = await composeFront(frontRightSvg(), { brightness: 0.85, blur: 1 });

  // the composed room as the Explorador sees it at rest (parallax offsets 0), layers back to front
  const at = (id) => LAYER[id].rect;
  const composedPng = await sharp({ create: { width: W, height: H, channels: 4, background: "#000000" } })
    .composite([
      { input: back, left: at("back").x, top: at("back").y },
      { input: plate, left: 0, top: 0 },
      { input: frontTop, left: at("front-top").x, top: at("front-top").y },
      { input: front, left: at("front").x, top: at("front").y },
      { input: frontRight, left: at("front-right").x, top: at("front-right").y },
    ])
    .png()
    .toBuffer();

  if (!preview) {
    await write(sharp(back), path.join(OUT, "back.webp"), { quality: 82, effort: 6 });
    await write(sharp(plate), path.join(OUT, "plate.webp"), { quality: 80, alphaQuality: 90, effort: 6, smartSubsample: true });
    await write(sharp(frontTop), path.join(OUT, "front-top.webp"), { quality: 80, alphaQuality: 90, effort: 6 });
    await write(sharp(front), path.join(OUT, "front.webp"), { quality: 80, alphaQuality: 90, effort: 6 });
    await write(sharp(frontRight), path.join(OUT, "front-right.webp"), { quality: 80, alphaQuality: 90, effort: 6 });
    // the selector's preview (and the room's intro art): a 4:3 view of the telescope, the bench and the window
    await write(sharp(composedPng).extract({ left: 420, top: 150, width: 1880, height: 1410 }).resize(960, 720), path.join(OUT, "hero.webp"), {
      quality: 76,
      effort: 6,
    });
    for (const id of Object.keys(ART)) {
      await write(render(thumbSvg(id)), path.join(OUT, "thumbs", `${id}.webp`), { quality: 82, alphaQuality: 90, effort: 6 });
    }
  }

  const regionsPng = await sharp({ create: { width: W, height: H, channels: 4, background: "#000000" } })
    .composite([{ input: back, left: at("back").x, top: at("back").y }, { input: await render(plateSvg({ debug: true })).png().toBuffer(), left: 0, top: 0 }])
    .png()
    .toBuffer();
  await writeReviewBoards({ room: ROOM, composedPng, regionsPng, reviewDir });
  if (preview) await sharp(composedPng).toFile(path.join(reviewDir, "scene-full.png"));

  if (AUDIT) {
    const { data } = await sharp(composedPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const rows = await auditRoom({
      room: ROOM,
      plate: ({ omit }) => plateSvg({ omit }),
      alone: (target) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs>${targetSvg(target.id)}</svg>`,
      composed: data,
    });
    for (const row of rows) console.log(`${row.id.padEnd(14)} ${row.tier}  visible ${(row.visible * 100).toFixed(0).padStart(3)}%  contrast ${row.contrast.toFixed(2).padStart(5)}:1  edge ${row.edge.toFixed(2).padStart(5)}:1  look-alikes ${row.lookAlikes.join(", ") || "—"}`);
    const platePath = path.join(OUT, "plate.webp");
    const plateSha256 = !preview && fs.existsSync(platePath) ? createHash("sha256").update(fs.readFileSync(platePath)).digest("hex") : null;
    fs.writeFileSync(
      path.join(reviewDir, "fairness.json"),
      `${JSON.stringify(
        {
          kit: DATA.SCENE_ASSET_BASE,
          plateSha256,
          rule: {
            visible: "share of the target's own pixels the finished plate shows (plate rendered with and without the target)",
            contrast: "F4 as written: mean-luminance ratio, visible target vs a 24 su ring, on the composed room",
            edge: "median luminance ratio across the visible silhouette's edge (each edge pixel vs the background within 3 su)",
          },
          targets: rows,
        },
        null,
        2,
      )}\n`,
    );
  }

  let total = 0;
  for (const [file, size] of report) {
    total += size;
    console.log(`${kb(size).padStart(9)}  ${file}`);
  }
  if (report.length) console.log(`${kb(total).padStart(9)}  total (${report.length} files)`);
}

await main();
