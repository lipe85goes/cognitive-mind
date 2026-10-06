/**
 * GAME03-SKELETON-01 — Estúdio das Descobertas, prototype art kit (v0).
 *
 * The skeleton's scene is painted here, in SVG, and exported with `sharp`
 * (already a devDependency). It is an honest prototype plate, not final art:
 * the conceptual mockup (docs/archive/hidden-objects/explorer-studio/
 * reference/) sets the mood, light and composition; this file draws a clean
 * room with no UI, no text and exactly one of each target.
 *
 * Single source of truth: the targets are painted exactly where
 * `src/games/hidden-objects/hidden-objects-scene.ts` puts their `region`, and
 * the front layer only paints inside that module's `opaque` rects — the
 * module is transpiled and read below, so the art cannot drift from the data
 * the game hit-tests against.
 *
 * Writes:
 *   public/assets/hidden-objects/explorer-studio/v0/{back,plate,front,hero}.webp
 *   public/assets/hidden-objects/explorer-studio/v0/thumbs/<id>.webp
 *   public/illustrations/home/dioramas/discovery/discovery-<pass>.webp
 *   docs/archive/hidden-objects/explorer-studio/review/*.webp (review boards)
 *
 * Usage: node tools/assets/create_hidden_objects_scene.mjs
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import ts from "typescript";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SCENE_MODULE = path.join(ROOT, "src/games/hidden-objects/hidden-objects-scene.ts");
const OUT = path.join(ROOT, "public/assets/hidden-objects/explorer-studio/v0");
const DIORAMA_OUT = path.join(ROOT, "public/illustrations/home/dioramas/discovery");
const REVIEW = path.join(ROOT, "docs/archive/hidden-objects/explorer-studio/review");

// --- the scene data the game reads -------------------------------------------------------------

function loadScene() {
  const js = ts.transpileModule(fs.readFileSync(SCENE_MODULE, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(js, { module: mod, exports: mod.exports, require: () => ({}) });
  return mod.exports;
}

const SCENE = loadScene();
const W = SCENE.SCENE_WIDTH;
const H = SCENE.SCENE_HEIGHT;
const TARGETS = Object.fromEntries(SCENE.HIDDEN_OBJECTS.map((t) => [t.id, t]));
const LAYER = Object.fromEntries(SCENE.SCENE_LAYERS.map((l) => [l.id, l]));

/** The box a target is painted into: its rect, or the square around its circle. */
function boxOf(region) {
  return region.kind === "rect"
    ? { x: region.x, y: region.y, w: region.w, h: region.h }
    : { x: region.cx - region.r, y: region.cy - region.r, w: 2 * region.r, h: 2 * region.r };
}

const n = (v) => Number(v.toFixed(1));

/** Draw `body` (authored in a nominal w×h box) scaled uniformly and centred into `box`. */
function fit(body, nominal, box) {
  const s = Math.min(box.w / nominal.w, box.h / nominal.h);
  const dx = box.x + (box.w - nominal.w * s) / 2;
  const dy = box.y + (box.h - nominal.h * s) / 2;
  return `<g transform="translate(${n(dx)} ${n(dy)}) scale(${n(s * 1000) / 1000})">${body}</g>`;
}

// --- shared paint ----------------------------------------------------------------------------------

const DEFS = `
  <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#9a6438"/><stop offset=".55" stop-color="#6f4325"/><stop offset="1" stop-color="#4a2a16"/>
  </linearGradient>
  <linearGradient id="woodV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#8d5a32"/><stop offset="1" stop-color="#4f2e18"/>
  </linearGradient>
  <linearGradient id="woodH" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#a06a3c"/><stop offset=".5" stop-color="#7a4a28"/><stop offset="1" stop-color="#4c2c17"/>
  </linearGradient>
  <linearGradient id="woodDark" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#5e3a20"/><stop offset="1" stop-color="#2e1a0d"/>
  </linearGradient>
  <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f6dc8e"/><stop offset=".45" stop-color="#c89a45"/><stop offset="1" stop-color="#7a5521"/>
  </linearGradient>
  <linearGradient id="brassV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f3d488"/><stop offset=".5" stop-color="#c08f3f"/><stop offset="1" stop-color="#6e4b1c"/>
  </linearGradient>
  <linearGradient id="iron" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#5b5752"/><stop offset="1" stop-color="#26231f"/>
  </linearGradient>
  <linearGradient id="silver" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#eeeae0"/><stop offset=".5" stop-color="#b9b4a8"/><stop offset="1" stop-color="#7d786e"/>
  </linearGradient>
  <radialGradient id="glassLens" cx=".38" cy=".34" r=".75">
    <stop offset="0" stop-color="#d8f0ff"/><stop offset=".35" stop-color="#7fb2cf"/><stop offset="1" stop-color="#21435a"/>
  </radialGradient>
  <radialGradient id="glassDark" cx=".35" cy=".3" r=".8">
    <stop offset="0" stop-color="#9fc3d8"/><stop offset=".4" stop-color="#3b5f78"/><stop offset="1" stop-color="#0f1d27"/>
  </radialGradient>
  <linearGradient id="parchment" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f6e7c4"/><stop offset=".6" stop-color="#e9d3a2"/><stop offset="1" stop-color="#cfb27a"/>
  </linearGradient>
  <linearGradient id="page" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#efe2c4"/><stop offset=".85" stop-color="#fbf3df"/><stop offset="1" stop-color="#d9c79e"/>
  </linearGradient>
  <linearGradient id="pageR" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#d9c79e"/><stop offset=".15" stop-color="#fbf3df"/><stop offset="1" stop-color="#ecdcba"/>
  </linearGradient>
  <linearGradient id="ivory" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#fbf4e3"/><stop offset=".6" stop-color="#e2d5b6"/><stop offset="1" stop-color="#a99a78"/>
  </linearGradient>
  <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#7fa65a"/><stop offset="1" stop-color="#2f5a2c"/>
  </linearGradient>
  <linearGradient id="leafDark" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#5f8a46"/><stop offset="1" stop-color="#1f3d22"/>
  </linearGradient>
  <linearGradient id="terracotta" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#d9844f"/><stop offset=".6" stop-color="#b0582e"/><stop offset="1" stop-color="#7a3a1d"/>
  </linearGradient>
  <linearGradient id="leather" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#4f7a5c"/><stop offset=".5" stop-color="#2f523d"/><stop offset="1" stop-color="#173024"/>
  </linearGradient>
  <linearGradient id="velvet" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#1d3a36"/><stop offset=".3" stop-color="#2f5a52"/><stop offset=".55" stop-color="#1c3934"/><stop offset=".8" stop-color="#346457"/><stop offset="1" stop-color="#173029"/>
  </linearGradient>
  <radialGradient id="contact" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#0b0704" stop-opacity=".55"/><stop offset="1" stop-color="#0b0704" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="lanternGlow" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#ffd27a" stop-opacity=".7"/><stop offset=".4" stop-color="#ffb04a" stop-opacity=".28"/><stop offset="1" stop-color="#ff9d2e" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="flame" cx=".5" cy=".6" r=".6">
    <stop offset="0" stop-color="#fffbe6"/><stop offset=".45" stop-color="#ffd76a"/><stop offset="1" stop-color="#ff8f1f" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f3d38f"/><stop offset="1" stop-color="#c99a55"/>
  </linearGradient>
  <linearGradient id="glassBulb" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#ffffff" stop-opacity=".55"/><stop offset=".35" stop-color="#dff1ff" stop-opacity=".18"/><stop offset="1" stop-color="#bfe0f2" stop-opacity=".38"/>
  </linearGradient>
  <linearGradient id="binoBody" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#4a433c"/><stop offset=".45" stop-color="#2c2723"/><stop offset="1" stop-color="#171411"/>
  </linearGradient>
  <linearGradient id="kilim" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#8a3a2c"/><stop offset="1" stop-color="#5e2219"/>
  </linearGradient>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="34"/></filter>
`;

const shadow = (cx, cy, rx, ry, o = 1) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#contact)" opacity="${o}"/>`;

// --- the ten targets (each authored in its own nominal box) ---------------------------------------

const ART = {
  ampulheta: {
    nominal: { w: 116, h: 222 },
    body: `
      <path d="M24 28 C24 74 52 94 55 111 C52 128 24 150 24 194 L92 194 C92 150 64 128 61 111 C64 94 92 74 92 28 Z" fill="url(#glassBulb)" stroke="#f4fbff" stroke-opacity=".7" stroke-width="2.5"/>
      <path d="M33 70 C41 90 52 102 56 110 L60 110 C64 102 75 90 83 70 Q58 78 33 70 Z" fill="url(#sand)"/>
      <rect x="57" y="110" width="2.4" height="52" fill="#e3b86a"/>
      <path d="M27 194 C31 170 46 157 58 155 C70 157 85 170 89 194 Z" fill="url(#sand)"/>
      <path d="M31 38 C31 66 44 84 50 96" stroke="#ffffff" stroke-opacity=".75" stroke-width="4" fill="none" stroke-linecap="round"/>
      <path d="M31 186 C33 166 40 156 47 150" stroke="#ffffff" stroke-opacity=".55" stroke-width="3" fill="none" stroke-linecap="round"/>
      <rect x="2" y="12" width="112" height="16" rx="5" fill="url(#wood)" stroke="#3a2010" stroke-width="2"/>
      <rect x="2" y="194" width="112" height="16" rx="5" fill="url(#wood)" stroke="#3a2010" stroke-width="2"/>
      <ellipse cx="58" cy="12" rx="55" ry="7" fill="#b07a46"/>
      <ellipse cx="58" cy="214" rx="54" ry="6" fill="#3d220f"/>
      <g fill="url(#woodH)" stroke="#3a2010" stroke-width="1.5">
        <rect x="8" y="26" width="10" height="170" rx="5"/><rect x="98" y="26" width="10" height="170" rx="5"/>
      </g>
      <g fill="#c58b52">
        <ellipse cx="13" cy="60" rx="7" ry="5"/><ellipse cx="13" cy="111" rx="7" ry="6"/><ellipse cx="13" cy="162" rx="7" ry="5"/>
        <ellipse cx="103" cy="60" rx="7" ry="5"/><ellipse cx="103" cy="111" rx="7" ry="6"/><ellipse cx="103" cy="162" rx="7" ry="5"/>
      </g>`,
  },
  binoculo: {
    nominal: { w: 152, h: 78 },
    body: `
      <path d="M14 20 C14 8 20 4 30 4 H42 C52 4 58 8 58 20 L64 56 H8 Z" fill="url(#binoBody)" stroke="#120f0c" stroke-width="2"/>
      <path d="M94 20 C94 8 100 4 110 4 H122 C132 4 138 8 138 20 L144 56 H88 Z" fill="url(#binoBody)" stroke="#120f0c" stroke-width="2"/>
      <path d="M20 10 C24 7 30 7 32 10 L22 52 H14 Z" fill="#7a7166" opacity=".55"/>
      <path d="M100 10 C104 7 110 7 112 10 L102 52 H94 Z" fill="#7a7166" opacity=".45"/>
      <g stroke="#120f0c" stroke-width="1.2" opacity=".55"><path d="M12 30 H60 M10 40 H62 M92 30 H140 M90 40 H142"/></g>
      <rect x="54" y="12" width="44" height="18" rx="8" fill="url(#iron)" stroke="#120f0c" stroke-width="1.5"/>
      <circle cx="76" cy="21" r="9" fill="#2a2622" stroke="#b8ad98" stroke-width="2"/>
      <g stroke="#cfc4ae" stroke-width="1.4"><path d="M71 15 V27 M76 13 V29 M81 15 V27"/></g>
      <ellipse cx="36" cy="5" rx="16" ry="5" fill="#0f0c0a" stroke="#6a6258" stroke-width="2"/>
      <ellipse cx="116" cy="5" rx="16" ry="5" fill="#0f0c0a" stroke="#6a6258" stroke-width="2"/>
      <ellipse cx="36" cy="58" rx="31" ry="19" fill="#1c1916" stroke="url(#brass)" stroke-width="4"/>
      <ellipse cx="116" cy="58" rx="31" ry="19" fill="#1c1916" stroke="url(#brass)" stroke-width="4"/>
      <ellipse cx="36" cy="58" rx="22" ry="13" fill="url(#glassLens)"/>
      <ellipse cx="116" cy="58" rx="22" ry="13" fill="url(#glassLens)"/>
      <ellipse cx="29" cy="53" rx="8" ry="4" fill="#ffffff" opacity=".8"/>
      <ellipse cx="109" cy="53" rx="8" ry="4" fill="#ffffff" opacity=".7"/>
      <path d="M8 40 C-4 60 2 76 20 78" stroke="#6b3b22" stroke-width="4" fill="none"/>`,
  },
  chave: {
    nominal: { w: 132, h: 56 },
    body: `
      <g fill="none" stroke="#3a2715" stroke-width="12"><circle cx="27" cy="28" r="19"/></g>
      <g fill="none" stroke="url(#brass)" stroke-width="8"><circle cx="27" cy="28" r="19"/></g>
      <path d="M27 14 L33 24 L27 34 L21 24 Z" fill="#9c7438"/>
      <rect x="44" y="21" width="10" height="14" rx="2" fill="#8a6430" stroke="#3a2715" stroke-width="1.5"/>
      <rect x="52" y="24" width="72" height="8" rx="3" fill="url(#brassV)" stroke="#3a2715" stroke-width="1.5"/>
      <path d="M100 31 V50 H108 V43 H114 V50 H122 V31 Z" fill="url(#brassV)" stroke="#3a2715" stroke-width="1.5"/>
      <circle cx="124" cy="28" r="5" fill="#a87c3e" stroke="#3a2715" stroke-width="1.5"/>`,
  },
  lupa: {
    // lens centre at (90, 90); the handle runs down-right out of the target box
    nominal: { w: 180, h: 180 },
    body: `
      <circle cx="90" cy="90" r="64" fill="url(#glassLens)" opacity=".42"/>
      <g clip-path="url(#lupaClip)">
        <path d="M30 70 C60 50 90 96 150 64" stroke="#7b5a33" stroke-width="7" fill="none" opacity=".55"/>
        <path d="M40 124 C70 108 104 140 150 116" stroke="#4f7d8a" stroke-width="6" fill="none" stroke-dasharray="14 10" opacity=".55"/>
        <circle cx="104" cy="96" r="9" fill="#a0442c" opacity=".55"/>
      </g>
      <path d="M50 50 A58 58 0 0 1 108 34" stroke="#ffffff" stroke-width="7" fill="none" opacity=".75" stroke-linecap="round"/>
      <circle cx="90" cy="90" r="70" fill="none" stroke="#4a3013" stroke-width="18"/>
      <circle cx="90" cy="90" r="70" fill="none" stroke="url(#brass)" stroke-width="13"/>
      <circle cx="90" cy="90" r="62" fill="none" stroke="#7a5521" stroke-width="2"/>`,
    clip: `<clipPath id="lupaClip"><circle cx="90" cy="90" r="62"/></clipPath>`,
    handle: `
      <path d="M138 138 L152 152" stroke="#4a3013" stroke-width="24" stroke-linecap="round"/>
      <path d="M138 138 L152 152" stroke="url(#brass)" stroke-width="18" stroke-linecap="round"/>
      <path d="M154 154 L232 232" stroke="#2b170b" stroke-width="28" stroke-linecap="round"/>
      <path d="M154 154 L232 232" stroke="url(#woodH)" stroke-width="22" stroke-linecap="round"/>
      <path d="M160 152 L224 216" stroke="#c48a55" stroke-width="4" stroke-linecap="round" opacity=".6"/>`,
  },
  bussola: {
    nominal: { w: 132, h: 132 },
    body: `
      <circle cx="66" cy="10" r="9" fill="none" stroke="url(#brass)" stroke-width="5"/>
      <rect x="60" y="13" width="12" height="9" rx="2" fill="url(#brassV)"/>
      <circle cx="66" cy="70" r="58" fill="#5a3d16"/>
      <circle cx="66" cy="68" r="58" fill="url(#brass)"/>
      <circle cx="66" cy="68" r="49" fill="#7a5521"/>
      <circle cx="66" cy="68" r="45" fill="#f4ead2"/>
      <g stroke="#6b4a24" stroke-width="2.5" stroke-linecap="round">
        <path d="M66 26 V36 M66 100 V110 M24 68 H34 M98 68 H108"/>
      </g>
      <g stroke="#9b7a4c" stroke-width="1.5" stroke-linecap="round">
        <path d="M36 38 L41 43 M96 38 L91 43 M36 98 L41 93 M96 98 L91 93"/>
      </g>
      <path d="M66 32 L74 68 L58 68 Z" fill="#c2402e"/>
      <path d="M66 104 L74 68 L58 68 Z" fill="#2d3e50"/>
      <circle cx="66" cy="68" r="5" fill="url(#brass)" stroke="#5a3d16" stroke-width="1.5"/>
      <path d="M34 50 A38 38 0 0 1 60 30" stroke="#ffffff" stroke-width="4" fill="none" opacity=".7" stroke-linecap="round"/>`,
  },
  relogio: {
    nominal: { w: 96, h: 96 },
    body: `
      <circle cx="48" cy="8" r="8" fill="none" stroke="url(#brass)" stroke-width="4"/>
      <rect x="42" y="12" width="12" height="9" rx="2" fill="url(#brassV)" stroke="#6e4b1c" stroke-width="1"/>
      <circle cx="48" cy="58" r="38" fill="#6e4b1c"/>
      <circle cx="48" cy="56" r="38" fill="url(#brass)"/>
      <circle cx="48" cy="56" r="30" fill="#fbf6e8" stroke="#b08a4a" stroke-width="2"/>
      <g stroke="#3d2b17" stroke-width="3" stroke-linecap="round"><path d="M48 30 V36 M48 76 V82 M22 56 H28 M68 56 H74"/></g>
      <g stroke="#7a6446" stroke-width="1.5" stroke-linecap="round">
        <path d="M61 33.5 L59 37 M70.5 43 L67 45 M70.5 69 L67 67 M61 78.5 L59 75 M35 78.5 L37 75 M25.5 69 L29 67 M25.5 43 L29 45 M35 33.5 L37 37"/>
      </g>
      <path d="M48 56 L36 44" stroke="#1f1710" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M48 56 L60 34" stroke="#1f1710" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="48" cy="56" r="3" fill="#1f1710"/>
      <path d="M26 42 A26 26 0 0 1 42 28" stroke="#ffffff" stroke-width="3" fill="none" opacity=".85" stroke-linecap="round"/>`,
  },
  barco: {
    nominal: { w: 290, h: 215 },
    body: `
      <rect x="54" y="198" width="182" height="14" rx="3" fill="url(#woodV)" stroke="#2b170b" stroke-width="2"/>
      <path d="M92 198 V170 H106 V198 Z M184 198 V170 H198 V198 Z" fill="#5a3418" stroke="#2b170b" stroke-width="2"/>
      <path d="M12 136 L54 132 L250 140 L282 128 L268 150 C240 182 170 190 140 190 C96 190 50 182 30 160 Z" fill="#5a3418" stroke="#2b170b" stroke-width="2.5"/>
      <path d="M12 136 L54 132 L54 122 L16 124 Z" fill="#6f4224" stroke="#2b170b" stroke-width="2"/>
      <path d="M26 152 C70 168 200 170 262 150" stroke="#d6a654" stroke-width="5" fill="none"/>
      <path d="M36 166 C80 180 190 182 246 164" stroke="#2b170b" stroke-width="3" fill="none" opacity=".6"/>
      <g fill="#e9d29a"><circle cx="90" cy="158" r="3"/><circle cx="120" cy="161" r="3"/><circle cx="150" cy="162" r="3"/><circle cx="180" cy="161" r="3"/><circle cx="210" cy="158" r="3"/></g>
      <path d="M250 140 L288 118" stroke="#4a2a12" stroke-width="4" stroke-linecap="round"/>
      <g stroke="#4a2a12" stroke-width="5" stroke-linecap="round"><path d="M112 136 V16"/><path d="M192 138 V34"/><path d="M50 132 V60"/></g>
      <g stroke="#7a6a52" stroke-width="1.2" fill="none" opacity=".9">
        <path d="M112 18 L20 128 M112 18 L192 36 M192 36 L286 120 M112 18 L250 138 M50 62 L16 124"/>
      </g>
      <path d="M78 26 Q112 18 146 26 Q150 40 146 56 Q112 50 78 56 Q74 40 78 26 Z" fill="#f2e6c7" stroke="#a89470" stroke-width="1.5"/>
      <path d="M70 62 Q112 54 154 62 Q160 82 154 104 Q112 96 70 104 Q64 82 70 62 Z" fill="#efe1bd" stroke="#a89470" stroke-width="1.5"/>
      <path d="M160 44 Q192 38 224 44 Q228 58 224 74 Q192 68 160 74 Q156 58 160 44 Z" fill="#f2e6c7" stroke="#a89470" stroke-width="1.5"/>
      <path d="M154 80 Q192 72 230 80 Q236 98 230 118 Q192 110 154 118 Q148 98 154 80 Z" fill="#efe1bd" stroke="#a89470" stroke-width="1.5"/>
      <path d="M198 40 L270 122 L200 124 Z" fill="#f5ecd4" stroke="#a89470" stroke-width="1.5"/>
      <path d="M50 64 L24 120 L50 120 Z" fill="#efe1bd" stroke="#a89470" stroke-width="1.5"/>
      <path d="M84 30 Q112 24 140 30" stroke="#d9c9a2" stroke-width="2" fill="none"/>
      <path d="M76 70 Q112 62 148 70" stroke="#d9c9a2" stroke-width="2" fill="none"/>
      <path d="M112 16 L136 21 L112 26 Z" fill="#b8402f"/><path d="M192 34 L212 38 L192 42 Z" fill="#b8402f"/>`,
  },
  lanterna: {
    nominal: { w: 126, h: 212 },
    body: `
      <path d="M30 40 C30 2 96 2 96 40" stroke="#5a3d16" stroke-width="7" fill="none"/>
      <path d="M30 40 C30 2 96 2 96 40" stroke="url(#brass)" stroke-width="4.5" fill="none"/>
      <path d="M26 52 L63 22 L100 52 Z" fill="url(#brass)" stroke="#5a3d16" stroke-width="2"/>
      <rect x="22" y="50" width="82" height="10" rx="4" fill="url(#brassV)" stroke="#5a3d16" stroke-width="1.5"/>
      <path d="M32 60 C12 92 12 132 32 164 L94 164 C114 132 114 92 94 60 Z" fill="#fff3c9" opacity=".92"/>
      <path d="M32 60 C12 92 12 132 32 164 L94 164 C114 132 114 92 94 60 Z" fill="url(#flame)" opacity=".9"/>
      <path d="M63 96 C72 110 72 126 63 134 C54 126 54 110 63 96 Z" fill="#fff7d6"/>
      <path d="M63 104 C68 114 68 124 63 130 C58 124 58 114 63 104 Z" fill="#ffb53d"/>
      <g stroke="#7a5521" stroke-width="3"><path d="M38 62 C26 96 26 128 38 162 M88 62 C100 96 100 128 88 162 M63 60 V164"/></g>
      <path d="M36 70 C28 94 28 116 34 136" stroke="#ffffff" stroke-width="4" fill="none" opacity=".6" stroke-linecap="round"/>
      <rect x="18" y="162" width="90" height="12" rx="5" fill="url(#brassV)" stroke="#5a3d16" stroke-width="1.5"/>
      <path d="M24 174 H102 L96 204 H30 Z" fill="url(#brass)" stroke="#5a3d16" stroke-width="2"/>
      <ellipse cx="63" cy="206" rx="36" ry="6" fill="#4a3013"/>`,
  },
  camera: {
    nominal: { w: 166, h: 118 },
    body: `
      <rect x="22" y="14" width="44" height="22" rx="4" fill="url(#silver)" stroke="#4a463f" stroke-width="2"/>
      <rect x="100" y="20" width="22" height="14" rx="3" fill="url(#silver)" stroke="#4a463f" stroke-width="2"/>
      <circle cx="136" cy="27" r="7" fill="url(#silver)" stroke="#4a463f" stroke-width="2"/>
      <rect x="6" y="32" width="154" height="80" rx="9" fill="#24201d" stroke="#0f0d0b" stroke-width="2.5"/>
      <rect x="6" y="32" width="154" height="20" rx="6" fill="url(#silver)" stroke="#4a463f" stroke-width="2"/>
      <g stroke="#3a3530" stroke-width="1" opacity=".6"><path d="M14 64 H52 M14 74 H52 M14 84 H52 M14 94 H52 M114 64 H152 M114 74 H152 M114 84 H152 M114 94 H152"/></g>
      <rect x="16" y="40" width="22" height="10" rx="2" fill="url(#glassDark)"/>
      <circle cx="83" cy="76" r="36" fill="#141210" stroke="url(#silver)" stroke-width="6"/>
      <circle cx="83" cy="76" r="25" fill="#2c2925" stroke="#8a857a" stroke-width="2"/>
      <circle cx="83" cy="76" r="18" fill="url(#glassDark)"/>
      <circle cx="77" cy="70" r="5" fill="#ffffff" opacity=".75"/>
      <circle cx="90" cy="83" r="2.5" fill="#ffffff" opacity=".4"/>
      <rect x="0" y="40" width="7" height="14" rx="2" fill="url(#silver)"/><rect x="159" y="40" width="7" height="14" rx="2" fill="url(#silver)"/>`,
  },
  estatueta: {
    nominal: { w: 84, h: 122 },
    body: `
      <rect x="14" y="100" width="56" height="20" rx="3" fill="url(#ivory)" stroke="#8a7a58" stroke-width="1.5"/>
      <rect x="10" y="96" width="64" height="7" rx="2" fill="#efe5cd" stroke="#8a7a58" stroke-width="1.2"/>
      <path d="M32 38 C26 52 22 74 20 96 L64 96 C62 74 58 52 52 38 C48 34 36 34 32 38 Z" fill="url(#ivory)" stroke="#8a7a58" stroke-width="1.5"/>
      <path d="M33 44 C29 60 28 78 29 94 M42 42 C41 60 41 78 42 94 M51 44 C54 60 56 78 56 94" stroke="#b3a27c" stroke-width="1.6" fill="none"/>
      <path d="M52 42 C60 36 64 26 62 14" stroke="url(#ivory)" stroke-width="7" fill="none" stroke-linecap="round"/>
      <circle cx="62" cy="11" r="5" fill="#f7efdc" stroke="#8a7a58" stroke-width="1.2"/>
      <path d="M32 42 C26 50 26 58 30 64" stroke="url(#ivory)" stroke-width="7" fill="none" stroke-linecap="round"/>
      <circle cx="42" cy="26" r="11" fill="url(#ivory)" stroke="#8a7a58" stroke-width="1.5"/>
      <path d="M33 22 C36 14 48 14 51 22" stroke="#c9b892" stroke-width="3" fill="none"/>`,
  },
};

/** The target's art placed on the plate (or, with `box`, anywhere else). */
function targetSvg(id, box = boxOf(TARGETS[id].region)) {
  const art = ART[id];
  return fit(art.body, art.nominal, box);
}

/** The magnifier's handle reaches past its lens circle: it is painted in the lens's frame. */
function lupaHandleSvg(box) {
  const art = ART.lupa;
  return fit(art.handle, art.nominal, box);
}

// --- the window view (back layer) ----------------------------------------------------------------

function backSvg() {
  const r = LAYER.back.rect;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r.w}" height="${r.h}" viewBox="${r.x} ${r.y} ${r.w} ${r.h}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7fa8c4"/><stop offset=".42" stop-color="#d9c3a8"/><stop offset=".7" stop-color="#f6cf98"/><stop offset="1" stop-color="#ffd9a0"/>
    </linearGradient>
    <radialGradient id="sun" cx=".18" cy=".46" r=".6">
      <stop offset="0" stop-color="#fff4d1" stop-opacity=".95"/><stop offset=".3" stop-color="#ffd690" stop-opacity=".45"/><stop offset="1" stop-color="#ffd690" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e9c99c"/><stop offset=".25" stop-color="#9cb7c0"/><stop offset="1" stop-color="#5d8296"/>
    </linearGradient>
  </defs>
  <rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="url(#sky)"/>
  <rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="url(#sun)"/>
  <g opacity=".9">
    <path d="M160 640 L240 560 L300 590 L380 470 L450 540 L520 500 L600 420 L690 520 L760 470 L840 560 L920 500 L1000 570 L1080 530 L1080 700 L160 700 Z" fill="#a9a6bf"/>
    <path d="M380 470 L410 500 L392 498 Z M600 420 L630 452 L610 450 Z" fill="#f2ead8" opacity=".85"/>
  </g>
  <path d="M160 690 L260 620 L340 650 L430 600 L520 640 L600 590 L700 650 L800 610 L900 660 L1000 620 L1080 660 L1080 730 L160 730 Z" fill="#8a8fa8"/>
  <path d="M160 728 L300 690 L420 712 L560 680 L700 716 L860 690 L1080 712 L1080 760 L160 760 Z" fill="#6f7f72"/>
  <rect x="160" y="752" width="920" height="300" fill="url(#lake)"/>
  <g stroke="#fff3d6" stroke-linecap="round" opacity=".7">
    <path d="M260 800 H330 M420 830 H520 M600 790 H660 M700 860 H800 M360 900 H430 M540 930 H640 M820 820 H880" stroke-width="4"/>
  </g>
  <g>
    <path d="M640 760 L1080 742 L1080 790 L640 792 Z" fill="#59695a"/>
    <g fill="#e8cfa3" stroke="#6e5a40" stroke-width="2">
      <rect x="700" y="706" width="34" height="40"/><rect x="742" y="712" width="40" height="34"/><rect x="842" y="700" width="30" height="46"/>
      <rect x="880" y="714" width="44" height="32"/><rect x="934" y="704" width="34" height="42"/><rect x="976" y="716" width="40" height="30"/>
    </g>
    <g fill="#b45a3a"><path d="M696 708 L717 688 L738 708 Z M738 714 L762 694 L786 714 Z M838 702 L857 682 L876 702 Z M876 716 L902 696 L928 716 Z M930 706 L951 686 L972 706 Z M972 718 L996 698 L1020 718 Z"/></g>
    <rect x="796" y="630" width="30" height="116" fill="#efe0c0" stroke="#6e5a40" stroke-width="2"/>
    <path d="M792 632 L811 584 L830 632 Z" fill="#9e4f35"/>
    <rect x="804" y="652" width="14" height="18" rx="7" fill="#5c4632"/>
    <g fill="#e8cfa3" opacity=".55"><rect x="702" y="772" width="30" height="10"/><rect x="842" y="772" width="28" height="12"/><rect x="934" y="774" width="32" height="10"/></g>
  </g>
  <path d="M160 1000 C260 960 340 990 420 970 C520 948 600 990 700 975 C800 960 900 990 1080 965 L1080 1090 L160 1090 Z" fill="#40593d"/>
  <g fill="#2f4a33">
    <ellipse cx="230" cy="985" rx="60" ry="40"/><ellipse cx="330" cy="1000" rx="70" ry="44"/><ellipse cx="980" cy="980" rx="80" ry="46"/><ellipse cx="1060" cy="1000" rx="60" ry="40"/>
  </g>
</svg>`;
}

// --- the room (plate) ---------------------------------------------------------------------------

const WINDOW = { cx: 620, archY: 520, rOuter: 320, rInner: 294, left: 300, right: 940, innerLeft: 326, innerRight: 914, bottom: 1000 };

function windowHolePath() {
  const { archY, rInner, innerLeft, innerRight, bottom } = WINDOW;
  return `M${innerLeft} ${bottom} V${archY} A${rInner} ${rInner} 0 0 1 ${innerRight} ${archY} V${bottom} Z`;
}

function book(x, y, w, h, color, { band = "#d9b56a", tilt = 0 } = {}) {
  const t = tilt ? ` transform="rotate(${tilt} ${x + w / 2} ${y + h})"` : "";
  return `<g${t}><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${color}" stroke="#1d120a" stroke-width="1.5"/>
    <rect x="${x}" y="${y + h * 0.14}" width="${w}" height="${Math.max(3, h * 0.04)}" fill="${band}" opacity=".85"/>
    <rect x="${x}" y="${y + h * 0.8}" width="${w}" height="${Math.max(3, h * 0.035)}" fill="${band}" opacity=".7"/>
    <rect x="${x + 2}" y="${y + 2}" width="${Math.max(2, w * 0.22)}" height="${h - 4}" fill="#ffffff" opacity=".12"/></g>`;
}

const BOOK_COLORS = ["#7d2f24", "#2d4b6b", "#4a6b3a", "#8a5a2b", "#5b3b5e", "#a3772f", "#2f5f5a", "#6b2f3a", "#3e3a35", "#9c4a2b", "#c9b48a", "#36536b"];

/** A run of standing books from x0 along a shelf whose top surface is at `floor`. */
function bookRun(x0, floor, count, seed, { minH = 120, maxH = 190, minW = 18, maxW = 34, gap = 2 } = {}) {
  let x = x0;
  let out = "";
  let s = seed;
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = 0; i < count; i += 1) {
    const w = Math.round(minW + rnd() * (maxW - minW));
    const h = Math.round(minH + rnd() * (maxH - minH));
    out += book(x, floor - h, w, h, BOOK_COLORS[Math.floor(rnd() * BOOK_COLORS.length)]);
    x += w + gap;
  }
  return { svg: out, end: x };
}

function bookStack(x, floor, specs) {
  let y = floor;
  let out = "";
  for (const [w, h, color, dx = 0] of specs) {
    y -= h;
    out += `<rect x="${x + dx}" y="${y}" width="${w}" height="${h}" rx="3" fill="${color}" stroke="#1d120a" stroke-width="1.5"/>
      <rect x="${x + dx + 4}" y="${y + 3}" width="${w - 8}" height="${Math.max(2, h * 0.25)}" fill="#f1e2bf" opacity=".55"/>`;
  }
  return out;
}

function plant(cx, baseY, scale = 1, { pot = "url(#terracotta)", leaves = "url(#leaf)" } = {}) {
  const s = scale;
  const leaf = (angle, len, wid) =>
    `<path transform="rotate(${angle} ${cx} ${baseY - 50 * s})" d="M${cx} ${baseY - 50 * s} C${cx - wid * s} ${baseY - 50 * s - len * 0.5 * s} ${cx - wid * 0.4 * s} ${baseY - 50 * s - len * s} ${cx} ${baseY - 50 * s - len * s} C${cx + wid * 0.4 * s} ${baseY - 50 * s - len * s} ${cx + wid * s} ${baseY - 50 * s - len * 0.5 * s} ${cx} ${baseY - 50 * s} Z" fill="${leaves}" stroke="#1f3a1c" stroke-width="1.2"/>`;
  return `${shadow(cx, baseY, 40 * s, 8 * s, 0.8)}
    ${leaf(-62, 70, 18)}${leaf(-30, 86, 20)}${leaf(0, 96, 22)}${leaf(28, 84, 20)}${leaf(58, 70, 18)}${leaf(-10, 60, 14)}${leaf(14, 64, 15)}
    <path d="M${cx - 30 * s} ${baseY - 50 * s} H${cx + 30 * s} L${cx + 24 * s} ${baseY} H${cx - 24 * s} Z" fill="${pot}" stroke="#4a2410" stroke-width="1.5"/>
    <rect x="${cx - 33 * s}" y="${baseY - 56 * s}" width="${66 * s}" height="${10 * s}" rx="3" fill="#c46f40" stroke="#4a2410" stroke-width="1.2"/>`;
}

function trailingPlant(cx, baseY, scale = 1) {
  const s = scale;
  let vines = "";
  const strands = [[-26, 120], [-8, 160], [12, 140], [30, 100]];
  for (const [dx, len] of strands) {
    vines += `<path d="M${cx + dx * s} ${baseY - 40 * s} C${cx + dx * 1.6 * s} ${baseY + len * 0.3 * s} ${cx + dx * 0.6 * s} ${baseY + len * 0.7 * s} ${cx + dx * 1.2 * s} ${baseY + len * s}" stroke="#355c2e" stroke-width="${3 * s}" fill="none"/>`;
    for (let i = 0; i < 6; i += 1) {
      const t = i / 6;
      const y = baseY - 40 * s + (len + 40) * t * s;
      const x = cx + dx * (1 + 0.6 * Math.sin(t * 3)) * s;
      vines += `<ellipse cx="${n(x + (i % 2 ? 9 : -9) * s)}" cy="${n(y)}" rx="${10 * s}" ry="${6 * s}" fill="url(#leaf)" transform="rotate(${i % 2 ? 30 : -30} ${n(x)} ${n(y)})"/>`;
    }
  }
  return `${vines}
    <path d="M${cx - 34 * s} ${baseY - 46 * s} H${cx + 34 * s} L${cx + 28 * s} ${baseY} H${cx - 28 * s} Z" fill="url(#terracotta)" stroke="#4a2410" stroke-width="1.5"/>
    <ellipse cx="${cx}" cy="${baseY - 46 * s}" rx="${34 * s}" ry="${7 * s}" fill="#3a2414"/>
    <g fill="url(#leaf)"><ellipse cx="${cx - 14 * s}" cy="${baseY - 54 * s}" rx="${16 * s}" ry="${9 * s}"/><ellipse cx="${cx + 12 * s}" cy="${baseY - 58 * s}" rx="${15 * s}" ry="${9 * s}"/><ellipse cx="${cx}" cy="${baseY - 66 * s}" rx="${13 * s}" ry="${8 * s}"/></g>`;
}

function frame(x, y, w, h, inner) {
  return `${shadow(x + w / 2 + 10, y + h + 6, w * 0.5, 10, 0.5)}
    <rect x="${x - 4}" y="${y + 6}" width="${w + 8}" height="${h + 8}" fill="#120a05" opacity=".35"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#brass)" stroke="#5a3d16" stroke-width="2"/>
    <rect x="${x + 14}" y="${y + 14}" width="${w - 28}" height="${h - 28}" fill="#3a2a18"/>
    <svg x="${x + 18}" y="${y + 18}" width="${w - 36}" height="${h - 36}" viewBox="0 0 100 ${n((100 * (h - 36)) / (w - 36))}" preserveAspectRatio="none">${inner}</svg>`;
}

const PAINTING_LAKE = `
  <rect width="100" height="100" fill="#e9c896"/>
  <rect width="100" height="40" fill="#b7c6c9"/>
  <path d="M0 46 L18 30 L30 38 L46 22 L62 36 L78 26 L100 40 L100 56 L0 56 Z" fill="#7d86a0"/>
  <rect y="54" width="100" height="22" fill="#6f98a8"/>
  <path d="M0 74 C30 66 60 80 100 70 L100 100 L0 100 Z" fill="#4f6a43"/>
  <circle cx="78" cy="18" r="7" fill="#fff0c4" opacity=".9"/>`;

const PAINTING_MAP = `
  <rect width="100" height="100" fill="#ecd9ab"/>
  <path d="M8 30 C20 16 40 20 46 32 C54 46 36 58 22 54 C12 50 4 42 8 30 Z" fill="#c9ad74" stroke="#7a5a33" stroke-width="1"/>
  <path d="M56 50 C68 36 90 40 94 56 C98 72 84 84 70 80 C58 76 50 64 56 50 Z" fill="#c9ad74" stroke="#7a5a33" stroke-width="1"/>
  <path d="M30 70 C44 66 52 80 46 88 C40 94 28 90 26 82" fill="#c9ad74" stroke="#7a5a33" stroke-width="1"/>
  <path d="M46 34 C56 40 54 48 60 52" stroke="#9c4a2b" stroke-width="1.2" stroke-dasharray="3 2" fill="none"/>
  <path d="M0 12 H100 M0 88 H100 M14 0 V100 M86 0 V100" stroke="#a88b5c" stroke-width=".6" opacity=".6"/>`;

const PAINTING_LEAF = `
  <rect width="100" height="100" fill="#efe3c6"/>
  <path d="M50 92 C50 70 50 40 52 12" stroke="#5b6b3a" stroke-width="2" fill="none"/>
  <path d="M52 20 C30 24 22 44 50 50 C78 44 72 24 52 20 Z" fill="#7d9a5a" opacity=".85"/>
  <path d="M50 52 C28 56 22 76 50 82 C76 76 70 56 50 52 Z" fill="#6f8c4f" opacity=".85"/>`;

function windowSvg() {
  const { cx, archY, rOuter, rInner, left, right, innerLeft, innerRight, bottom } = WINDOW;
  const frame = `M${left} ${bottom + 6} V${archY} A${rOuter} ${rOuter} 0 0 1 ${right} ${archY} V${bottom + 6} H${innerRight} V${archY} A${rInner} ${rInner} 0 0 0 ${innerLeft} ${archY} V${bottom + 6} Z`;
  const pane = (d) => `<path d="${d}" fill="#ffffff" opacity=".07"/>`;
  return `
    <path d="${frame}" fill="url(#woodH)" stroke="#2b170b" stroke-width="3"/>
    <path d="M${innerLeft} ${archY} A${rInner} ${rInner} 0 0 1 ${innerRight} ${archY}" fill="none" stroke="#c18a55" stroke-width="5" opacity=".6"/>
    <rect x="${cx - 9}" y="${archY - rInner}" width="18" height="${bottom - archY + rInner}" fill="url(#woodH)" stroke="#2b170b" stroke-width="2"/>
    <rect x="${innerLeft}" y="${archY - 8}" width="${innerRight - innerLeft}" height="16" fill="url(#woodV)" stroke="#2b170b" stroke-width="2"/>
    <rect x="${innerLeft}" y="752" width="${innerRight - innerLeft}" height="14" fill="url(#woodV)" stroke="#2b170b" stroke-width="2"/>
    <path d="M${cx} ${archY} L${n(cx - rInner * 0.7071)} ${n(archY - rInner * 0.7071)} M${cx} ${archY} L${n(cx + rInner * 0.7071)} ${n(archY - rInner * 0.7071)}" stroke="#5a3418" stroke-width="12"/>
    ${pane(`M${innerLeft + 20} ${archY + 30} L${innerLeft + 90} ${archY + 30} L${innerLeft + 30} ${archY + 220} L${innerLeft + 10} ${archY + 220} Z`)}
    ${pane(`M${cx + 30} 790 L${cx + 110} 790 L${cx + 50} 990 L${cx + 20} 990 Z`)}
    <rect x="${left - 22}" y="${bottom}" width="${right - left + 44}" height="18" rx="3" fill="#b0784a" stroke="#2b170b" stroke-width="2"/>
    <rect x="${left - 22}" y="${bottom + 18}" width="${right - left + 44}" height="30" fill="url(#woodV)" stroke="#2b170b" stroke-width="2"/>
    <path d="M${left + 10} ${bottom + 48} h40 l-20 26 Z M${right - 50} ${bottom + 48} h40 l-20 26 Z" fill="#4a2a16"/>`;
}

function curtain() {
  return `
    <rect x="20" y="150" width="1000" height="14" rx="7" fill="url(#brassV)"/>
    <circle cx="20" cy="157" r="16" fill="url(#brass)"/><circle cx="1020" cy="157" r="16" fill="url(#brass)"/>
    <path d="M30 164 C70 400 40 700 70 760 C40 860 20 1050 30 1190 L260 1190 C250 1060 240 880 210 770 C250 690 300 420 330 164 Z" fill="url(#velvet)" stroke="#0f201d" stroke-width="2"/>
    <path d="M90 180 C110 420 90 650 110 760 M150 180 C170 400 160 640 160 770 M220 190 C240 420 230 650 200 770" stroke="#0f201d" stroke-width="5" opacity=".45" fill="none"/>
    <path d="M80 790 C80 920 70 1060 76 1180 M140 790 C150 940 150 1060 150 1180 M200 790 C210 920 214 1060 220 1180" stroke="#0f201d" stroke-width="6" opacity=".4" fill="none"/>
    <path d="M44 750 C110 790 190 790 228 752 L232 772 C190 812 110 812 46 772 Z" fill="url(#brassV)" stroke="#5a3d16" stroke-width="1.5"/>`;
}

function armchair() {
  return `
    ${shadow(220, 1390, 230, 36)}
    <path d="M40 900 C40 830 120 820 200 822 C290 824 370 836 370 900 L372 1080 L42 1080 Z" fill="url(#leather)" stroke="#0e1f17" stroke-width="3"/>
    <path d="M70 880 C130 850 280 852 340 884" stroke="#6f9a7a" stroke-width="5" fill="none" opacity=".5"/>
    <g fill="#0e1f17" opacity=".55"><circle cx="110" cy="920" r="4"/><circle cx="170" cy="910" r="4"/><circle cx="230" cy="910" r="4"/><circle cx="290" cy="920" r="4"/><circle cx="140" cy="980" r="4"/><circle cx="200" cy="972" r="4"/><circle cx="260" cy="980" r="4"/></g>
    <path d="M20 1000 C20 960 60 950 90 960 L100 1260 L30 1260 Z" fill="url(#leather)" stroke="#0e1f17" stroke-width="3"/>
    <path d="M330 960 C360 950 400 960 400 1000 L392 1260 L322 1260 Z" fill="url(#leather)" stroke="#0e1f17" stroke-width="3"/>
    <path d="M86 1060 C150 1040 270 1040 330 1060 L334 1150 L84 1150 Z" fill="#2c4c39" stroke="#0e1f17" stroke-width="3"/>
    <path d="M60 1150 H366 L360 1290 H66 Z" fill="url(#leather)" stroke="#0e1f17" stroke-width="3"/>
    <path d="M70 1290 L80 1360 H100 L104 1290 M324 1290 L330 1360 H350 L356 1290" fill="#2b170b"/>
    ${blanket()}`;
}

/** A kilim throw over the armchair's back and arm: bands, lozenges, fringe. */
function blanket() {
  const outline = "M150 818 C210 812 300 818 352 846 C368 900 372 960 376 1010 C360 1030 340 1040 318 1046 C300 990 280 930 236 900 C200 878 160 870 128 868 C126 850 134 828 150 818 Z";
  let bands = "";
  for (let i = 0; i < 6; i += 1) {
    const t = i / 6;
    bands += `<path d="M${150 + t * 10} ${838 + t * 30} C${210 + t * 30} ${836 + t * 40} ${300 + t * 20} ${842 + t * 60} ${352 + t * 8} ${866 + t * 150}" stroke="${i % 2 ? "#d9a85a" : "#2f5f5a"}" stroke-width="${i % 2 ? 6 : 10}" fill="none" opacity=".9"/>`;
  }
  let lozenges = "";
  for (let i = 0; i < 4; i += 1) {
    const x = 196 + i * 40;
    const y = 852 + i * 22;
    lozenges += `<path d="M${x} ${y - 12} L${x + 10} ${y} L${x} ${y + 12} L${x - 10} ${y} Z" fill="#f1e2bf" opacity=".85"/>`;
  }
  let fringe = "";
  for (let i = 0; i < 9; i += 1) {
    const x = 324 + i * 6;
    const y = 1044 - i * 4;
    fringe += `<path d="M${x} ${y} l-3 16" stroke="#e8d6ac" stroke-width="2.5" stroke-linecap="round"/>`;
  }
  return `<clipPath id="blanketClip"><path d="${outline}"/></clipPath>
    <path d="${outline}" fill="url(#kilim)" stroke="#3a140e" stroke-width="2.5"/>
    <g clip-path="url(#blanketClip)">${bands}${lozenges}</g>
    <path d="M236 900 C280 930 300 990 318 1046" stroke="#2b0d08" stroke-width="3" fill="none" opacity=".5"/>
    ${fringe}`;
}

function sideTable() {
  return `
    ${shadow(800, 1428, 120, 16)}
    <path d="M790 1190 C786 1260 796 1330 788 1400 L812 1400 C804 1330 814 1260 810 1190 Z" fill="url(#woodH)"/>
    <ellipse cx="800" cy="1250" rx="16" ry="8" fill="#8a5a32"/>
    <path d="M790 1396 L730 1430 M810 1396 L870 1430 M800 1398 L800 1438" stroke="#4a2a16" stroke-width="10" stroke-linecap="round"/>
    <ellipse cx="800" cy="1192" rx="118" ry="28" fill="#4a2a16"/>
    <ellipse cx="800" cy="1184" rx="118" ry="28" fill="url(#wood)" stroke="#2b170b" stroke-width="2"/>
    <ellipse cx="780" cy="1178" rx="70" ry="12" fill="#ffffff" opacity=".08"/>`;
}

function trunk() {
  return `
    ${shadow(560, 1470, 170, 20)}
    <path d="M420 1290 H700 V1462 H420 Z" fill="url(#woodDark)" stroke="#1c0f07" stroke-width="3"/>
    <path d="M418 1290 C418 1246 702 1246 702 1290 Z" fill="#5a3820" stroke="#1c0f07" stroke-width="3"/>
    <path d="M430 1272 C470 1256 650 1256 690 1272" stroke="#7a5233" stroke-width="5" fill="none" opacity=".7"/>
    <g fill="url(#brassV)" stroke="#5a3d16" stroke-width="1.5">
      <rect x="418" y="1290" width="284" height="14"/><rect x="418" y="1440" width="284" height="14"/>
      <rect x="418" y="1290" width="18" height="172"/><rect x="684" y="1290" width="18" height="172"/>
    </g>
    <rect x="540" y="1318" width="40" height="46" rx="5" fill="url(#brass)" stroke="#5a3d16" stroke-width="2"/>
    <circle cx="560" cy="1336" r="5" fill="#2a1a0c"/><path d="M558 1339 L556 1352 H564 L562 1339 Z" fill="#2a1a0c"/>`;
}

/**
 * The trunk's two leather straps, painted after the key: the key lies on the lid
 * tucked under the left strap (tier C — bow and bit stay in view).
 */
function trunkStraps() {
  return [500, 620]
    .map(
      (x) => `<path d="M${x - 9} 1254 C${x - 11} 1300 ${x - 9} 1400 ${x - 8} 1458 L${x + 8} 1458 C${x + 9} 1400 ${x + 11} 1300 ${x + 9} 1254 Z" fill="#7a4428" stroke="#3a1c0e" stroke-width="2"/>
      <path d="M${x} 1260 V1452" stroke="#c48a55" stroke-width="2" stroke-dasharray="6 7" opacity=".55"/>
      <rect x="${x - 12}" y="1392" width="24" height="18" rx="3" fill="none" stroke="url(#brass)" stroke-width="4"/>`,
    )
    .join("");
}

function sillItems() {
  const y = WINDOW.bottom;
  return `
    ${plant(352, y, 0.78)}
    <g>${shadow(700, y + 2, 34, 6)}<ellipse cx="690" cy="${y - 10}" rx="18" ry="11" fill="#9c9488"/><ellipse cx="716" cy="${y - 7}" rx="14" ry="9" fill="#b9b0a2"/><ellipse cx="702" cy="${y - 20}" rx="11" ry="8" fill="#837b70"/></g>
    <g>${shadow(880, y + 2, 20, 5)}<path d="M868 ${y} V${y - 46} C868 ${y - 60} 892 ${y - 60} 892 ${y - 46} V${y} Z" fill="#7fa6a0" opacity=".85" stroke="#2f4a46" stroke-width="2"/><rect x="874" y="${y - 70}" width="12" height="14" fill="#8a5a32"/></g>`;
}

/** A small pot that hides the right end of the binoculars (tier B: partly occluded). */
function sillPotOverBinoculars() {
  const b = boxOf(TARGETS.binoculo.region);
  return plant(b.x + b.w + 14, WINDOW.bottom, 0.62, { leaves: "url(#leafDark)" });
}

function wallFrames() {
  return `
    ${frame(1196, 330, 280, 236, PAINTING_LAKE)}
    ${frame(1560, 300, 330, 230, PAINTING_MAP)}
    ${frame(1950, 590, 116, 140, PAINTING_LEAF)}
    <rect x="1180" y="700" width="300" height="16" rx="3" fill="url(#woodV)" stroke="#2b170b" stroke-width="2"/>
    <path d="M1200 716 l16 22 h4 v-22 Z M1440 716 l16 22 h4 v-22 Z" fill="#4a2a16"/>
    <g>
      <path d="M1210 700 V650 C1210 636 1244 636 1244 650 V700 Z" fill="#d9e7e1" opacity=".75" stroke="#5f7a74" stroke-width="2"/><rect x="1214" y="632" width="26" height="10" fill="#8a5a32"/>
      <path d="M1262 700 V666 C1262 656 1290 656 1290 666 V700 Z" fill="#b9d3c9" opacity=".8" stroke="#5f7a74" stroke-width="2"/><rect x="1266" y="652" width="20" height="9" fill="#8a5a32"/>
      ${bookStack(1320, 700, [[110, 16, "#7d2f24"], [100, 14, "#2d4b6b", 6], [92, 13, "#a3772f", 3]])}
    </g>`;
}

function globe() {
  return `
    ${shadow(2200, 1418, 110, 16)}
    <path d="M2200 1100 V1390 M2200 1390 L2130 1418 M2200 1390 L2270 1418 M2200 1390 L2200 1426" stroke="#4a2a16" stroke-width="12" stroke-linecap="round"/>
    <ellipse cx="2200" cy="1102" rx="40" ry="10" fill="url(#brassV)"/>
    <circle cx="2200" cy="990" r="96" fill="#2f6a86"/>
    <circle cx="2200" cy="990" r="96" fill="url(#glassLens)" opacity=".35"/>
    <path d="M2140 930 C2160 910 2196 914 2204 936 C2212 956 2190 972 2170 968 C2152 964 2132 952 2140 930 Z M2214 990 C2236 970 2268 980 2272 1004 C2276 1028 2250 1046 2230 1036 C2214 1028 2204 1006 2214 990 Z M2140 1010 C2156 1004 2170 1020 2166 1036 C2160 1052 2140 1050 2134 1036 C2130 1026 2132 1014 2140 1010 Z" fill="#d8bb7c" stroke="#7a5a33" stroke-width="1.5"/>
    <path d="M2104 990 A96 96 0 0 0 2296 990" stroke="#ffffff" stroke-opacity=".12" stroke-width="2" fill="none"/>
    <path d="M2112 1060 A110 110 0 0 0 2290 920" stroke="url(#brass)" stroke-width="9" fill="none"/>
    <path d="M2122 910 A110 110 0 0 1 2292 940" stroke="url(#brass)" stroke-width="9" fill="none" opacity=".9"/>`;
}

function table() {
  return `
    ${shadow(1600, 1450, 330, 30)}
    <path d="M1560 1240 C1552 1300 1566 1360 1548 1410 L1652 1410 C1634 1360 1648 1300 1640 1240 Z" fill="url(#woodH)" stroke="#2b170b" stroke-width="2"/>
    <ellipse cx="1600" cy="1320" rx="40" ry="12" fill="#8a5a32"/>
    <path d="M1556 1404 C1500 1414 1460 1428 1440 1446 L1470 1452 C1500 1436 1540 1428 1570 1424 Z M1644 1404 C1700 1414 1740 1428 1760 1446 L1730 1452 C1700 1436 1660 1428 1630 1424 Z" fill="#4a2a16" stroke="#2b170b" stroke-width="2"/>
    <path d="M1090 1080 C1090 1180 2110 1180 2110 1080 L2110 1118 C2110 1220 1090 1220 1090 1118 Z" fill="#4a2a16" stroke="#2b170b" stroke-width="2"/>
    <ellipse cx="1600" cy="1080" rx="510" ry="150" fill="url(#wood)" stroke="#2b170b" stroke-width="3"/>
    <ellipse cx="1520" cy="1040" rx="380" ry="90" fill="#ffffff" opacity=".05"/>
    <path d="M1110 1080 C1150 1150 1400 1200 1700 1196" stroke="#c18a55" stroke-width="3" fill="none" opacity=".35"/>`;
}

function tableItems() {
  const map = `
    <g>
      <path d="M1486 990 L1984 972 L2006 1170 L1500 1196 Z" fill="#1a0e06" opacity=".25" transform="translate(6 8)"/>
      <path d="M1486 990 L1984 972 L2006 1170 L1500 1196 Z" fill="url(#parchment)" stroke="#9c7a48" stroke-width="2"/>
      <path d="M1540 1020 C1580 1000 1640 1006 1660 1030 C1680 1056 1640 1076 1600 1070 C1560 1064 1520 1048 1540 1020 Z" fill="#d8bf86" stroke="#8a6a3c" stroke-width="1.6"/>
      <path d="M1860 1060 C1900 1030 1960 1046 1966 1086 C1970 1120 1930 1140 1896 1128 C1866 1118 1846 1086 1860 1060 Z" fill="#d8bf86" stroke="#8a6a3c" stroke-width="1.6"/>
      <path d="M1650 1110 C1680 1100 1720 1120 1712 1144 C1704 1166 1660 1160 1650 1140 Z" fill="#d8bf86" stroke="#8a6a3c" stroke-width="1.6"/>
      <path d="M1640 1050 C1700 1080 1800 1060 1870 1080" stroke="#a0442c" stroke-width="2.4" stroke-dasharray="8 6" fill="none"/>
      <path d="M1500 1010 L1990 994 M1504 1060 L1994 1044 M1506 1110 L1998 1094 M1508 1160 L2002 1144 M1600 990 L1612 1190 M1740 984 L1752 1184 M1880 978 L1892 1178" stroke="#a88b5c" stroke-width="1" opacity=".45"/>
    </g>`;
  // The open book lies over the compass's upper-left rim (tier B) and the watch's
  // bow (tier C): both keep their dial and needle/hands in view.
  const openBook = `
    <g transform="translate(0 -20)">
      <path d="M1186 1030 L1520 1030 L1530 1170 L1192 1176 Z" fill="#1a0e06" opacity=".28" transform="translate(6 10)"/>
      <path d="M1180 1150 C1240 1132 1300 1136 1356 1152 C1412 1136 1470 1132 1530 1150 L1526 1166 C1470 1150 1412 1154 1356 1168 C1300 1154 1240 1150 1184 1166 Z" fill="#6b2a1e" stroke="#3a140e" stroke-width="1.5"/>
      <path d="M1186 1022 C1240 1000 1300 1004 1352 1018 L1356 1150 C1304 1134 1240 1132 1190 1154 Z" fill="url(#page)" stroke="#8a6a3c" stroke-width="1.8"/>
      <path d="M1352 1018 C1404 1002 1466 1002 1522 1024 L1526 1154 C1470 1134 1406 1134 1356 1150 Z" fill="url(#pageR)" stroke="#8a6a3c" stroke-width="1.8"/>
      <g stroke="#8a7a62" stroke-width="1.3" opacity=".42">
        <path d="M1206 1040 C1250 1026 1300 1028 1336 1036 M1206 1054 C1250 1040 1300 1042 1336 1050 M1206 1068 C1250 1054 1300 1056 1336 1064 M1206 1082 C1250 1068 1300 1070 1336 1078 M1206 1096 C1250 1082 1300 1084 1336 1092 M1206 1110 C1250 1096 1300 1098 1336 1106"/>
        <path d="M1372 1036 C1410 1026 1460 1026 1504 1040 M1372 1050 C1410 1040 1460 1040 1504 1054 M1372 1064 C1410 1054 1460 1054 1504 1068"/>
      </g>
      <path d="M1400 1086 C1424 1072 1462 1078 1484 1098 C1462 1116 1424 1118 1400 1106 Z" fill="#7d9a5a" opacity=".45"/>
      <path d="M1442 1080 V1116" stroke="#5b6b3a" stroke-width="1.5" opacity=".6"/>
    </g>`;
  const watchChain = (() => {
    const c = TARGETS.relogio.region;
    let links = "";
    // From under the book, past the watch's left side, sagging along the table.
    for (let i = 0; i < 11; i += 1) {
      const x = c.cx - 34 - i * 12;
      const y = c.cy - 34 + i * 4 + Math.sin(i / 3) * 6;
      links += `<ellipse cx="${n(x)}" cy="${n(y)}" rx="6" ry="4" fill="none" stroke="url(#brass)" stroke-width="2.6" transform="rotate(${i % 2 ? 20 : -20} ${n(x)} ${n(y)})"/>`;
    }
    return links;
  })();
  return `
    ${bookStack(1150, 1046, [[150, 22, "#2d4b6b"], [140, 20, "#7d2f24", 6], [128, 18, "#4a6b3a", 10]])}
    <g>${shadow(1430, 1000, 52, 10)}<ellipse cx="1430" cy="996" rx="48" ry="12" fill="#f3ead9" stroke="#8a7a62" stroke-width="2"/>
      <path d="M1400 960 C1400 1000 1460 1000 1460 960 Z" fill="#f7efdf" stroke="#8a7a62" stroke-width="2"/>
      <ellipse cx="1430" cy="960" rx="30" ry="8" fill="#6b3a1f"/>
      <path d="M1460 968 C1478 968 1478 988 1458 986" stroke="#f7efdf" stroke-width="5" fill="none"/>
      <path d="M1420 950 C1410 930 1430 920 1420 900 M1438 948 C1430 930 1448 922 1440 904" stroke="#ffffff" stroke-width="3" opacity=".35" fill="none" stroke-linecap="round"/></g>
    ${map}
    ${targetSvg("bussola")}
    ${watchChain}
    ${targetSvg("relogio")}
    ${openBook}
    <g>${shadow(1950, 1214, 70, 10)}
      <rect x="1890" y="1150" width="120" height="58" rx="6" fill="url(#woodDark)" stroke="#1c0f07" stroke-width="2"/>
      <path d="M1886 1150 L1900 1132 H2004 L2014 1150 Z" fill="#6b4024" stroke="#1c0f07" stroke-width="2"/>
      <rect x="1940" y="1168" width="18" height="14" rx="2" fill="url(#brass)"/></g>
    <g>${shadow(2020, 1066, 34, 8)}
      <path d="M2000 1064 C1994 1030 2000 1010 2010 1004 H2032 C2042 1010 2048 1030 2042 1064 Z" fill="#203a4a" opacity=".85" stroke="#0f1d27" stroke-width="2"/>
      <rect x="2010" y="994" width="22" height="12" rx="2" fill="url(#brass)"/>
      <path d="M2026 996 C2040 940 2070 900 2100 880 C2086 920 2060 960 2030 1000 Z" fill="#f2ead8" stroke="#a89470" stroke-width="1.5"/>
      <path d="M2030 1000 C2050 960 2076 920 2098 884" stroke="#a89470" stroke-width="1.5" fill="none"/></g>
    <g>${shadow(1205, 1170, 60, 8)}
      <rect x="1150" y="1150" width="120" height="16" rx="8" fill="url(#parchment)" stroke="#8a6a3c" stroke-width="1.5"/>
      <ellipse cx="1150" cy="1158" rx="6" ry="8" fill="#d8bf86" stroke="#8a6a3c" stroke-width="1.5"/>
      <rect x="1196" y="1148" width="10" height="20" fill="#9c4a2b"/></g>`;
}

function lupaOnMap() {
  const box = boxOf(TARGETS.lupa.region);
  return `${shadow(box.x + box.w * 0.62, box.y + box.h * 0.66, box.w * 0.55, box.h * 0.18, 0.9)}
    ${lupaHandleSvg(box)}
    ${fit(`${ART.lupa.clip}${ART.lupa.body}`, ART.lupa.nominal, box)}`;
}

function bookcase() {
  const left = 2260;
  const right = 3080;
  const shelves = [370, 600, 830, 1060];
  let svg = `
    ${shadow(2670, 1290, 470, 30)}
    <rect x="${left}" y="150" width="${right - left}" height="1120" fill="#2a170c"/>
    <rect x="${left + 34}" y="160" width="${right - left - 68}" height="1090" fill="#3b2314"/>
    <g opacity=".35" stroke="#1c0f07" stroke-width="3">${Array.from({ length: 9 }, (_, i) => `<path d="M${left + 34 + 84 * (i + 1)} 160 V1250"/>`).join("")}</g>`;
  for (const y of shelves) {
    svg += `<rect x="${left + 30}" y="${y}" width="${right - left - 60}" height="24" fill="url(#woodV)" stroke="#1c0f07" stroke-width="2"/>
      <rect x="${left + 30}" y="${y + 24}" width="${right - left - 60}" height="16" fill="#1c0f07" opacity=".45"/>`;
  }
  svg += `
    <rect x="${left}" y="150" width="36" height="1120" fill="url(#woodH)" stroke="#1c0f07" stroke-width="2"/>
    <rect x="${right - 36}" y="150" width="36" height="1120" fill="url(#woodH)" stroke="#1c0f07" stroke-width="2"/>
    <rect x="${left - 20}" y="124" width="${right - left + 40}" height="36" rx="4" fill="url(#woodV)" stroke="#1c0f07" stroke-width="2"/>
    <rect x="${left - 10}" y="1240" width="${right - left + 20}" height="40" fill="url(#woodDark)" stroke="#1c0f07" stroke-width="2"/>`;
  return svg;
}

function bookcaseItems() {
  const s1 = 370;
  const s2 = 600;
  const s3 = 830;
  const s4 = 1060;
  const s5 = 1240;
  const est = boxOf(TARGETS.estatueta.region);
  const cam = boxOf(TARGETS.camera.region);
  const lan = boxOf(TARGETS.lanterna.region);
  const runA = bookRun(2300, s1, 12, 11, { minH: 130, maxH: 190 });
  const runB = bookRun(est.x + est.w + 14, s1, 6, 23, { minH: 120, maxH: 170 });
  const runC = bookRun(2440, s2, 9, 37, { minH: 140, maxH: 200 });
  const runD = bookRun(2670, s3, 7, 51, { minH: 150, maxH: 200 });
  const runE = bookRun(2300, s4, 8, 67, { minH: 140, maxH: 200 });
  const runF = bookRun(lan.x + lan.w + 16, s4, 4, 79, { minH: 150, maxH: 195 });
  return `
    ${runA.svg}
    ${book(2560, s1 - 150, 30, 150, "#c9b48a", { tilt: 14 })}
    ${shadow(est.x + est.w / 2, s1 - 2, est.w * 0.6, 6, 0.8)}
    ${targetSvg("estatueta")}
    ${runB.svg}
    ${trailingPlant(2990, s1, 0.8)}
    ${bookStack(2292, s2, [[132, 22, "#7d2f24"], [124, 20, "#36536b", 4], [118, 18, "#a3772f", 8], [110, 18, "#4a6b3a", 6]])}
    ${runC.svg}
    ${bookStack(cam.x - 10, s2, [[cam.w + 24, 0.01, "#000"]])}
    ${shadow(cam.x + cam.w / 2, s2 - 2, cam.w * 0.55, 7, 0.9)}
    ${targetSvg("camera")}
    <g>${shadow(2930, s2 - 2, 30, 6)}<path d="M2906 ${s2} V${s2 - 66} C2906 ${s2 - 80} 2954 ${s2 - 80} 2954 ${s2 - 66} V${s2} Z" fill="#c2d6cf" opacity=".8" stroke="#5f7a74" stroke-width="2"/><rect x="2912" y="${s2 - 90}" width="36" height="14" rx="3" fill="#8a5a32"/>
      <g fill="#a0442c" opacity=".7"><circle cx="2920" cy="${s2 - 26}" r="7"/><circle cx="2936" cy="${s2 - 18}" r="7"/><circle cx="2930" cy="${s2 - 38}" r="6"/></g></g>
    ${bookRun(2970, s2, 3, 91, { minH: 140, maxH: 180 }).svg}
    ${shadow(2505, s3 - 2, 150, 9, 0.9)}
    ${targetSvg("barco")}
    ${runD.svg}
    ${book(runD.end + 6, s3 - 160, 32, 160, "#5b3b5e", { tilt: 16 })}
    <g>${shadow(2985, s3 - 2, 70, 7)}<rect x="2930" y="${s3 - 74}" width="112" height="72" rx="5" fill="url(#woodDark)" stroke="#1c0f07" stroke-width="2"/><rect x="2926" y="${s3 - 82}" width="120" height="12" rx="3" fill="#6b4024" stroke="#1c0f07" stroke-width="1.5"/><circle cx="2986" cy="${s3 - 38}" r="6" fill="url(#brass)"/></g>
    ${runE.svg}
    <g>${shadow(2575, s4 - 2, 70, 7)}<rect x="2512" y="${s4 - 96}" width="126" height="94" rx="5" fill="url(#wood)" stroke="#1c0f07" stroke-width="2"/>
      <path d="M2512 ${s4 - 70} H2638" stroke="#2b170b" stroke-width="2"/><rect x="2566" y="${s4 - 64}" width="18" height="16" rx="2" fill="url(#brass)"/></g>
    <g>${shadow(2712, s4 - 2, 50, 6)}
      <path d="M2662 ${s4} V${s4 - 70} C2662 ${s4 - 84} 2706 ${s4 - 84} 2706 ${s4 - 70} V${s4} Z" fill="#b9d3c9" opacity=".75" stroke="#5f7a74" stroke-width="2"/><rect x="2668" y="${s4 - 96}" width="32" height="14" rx="3" fill="#8a5a32"/>
      <path d="M2718 ${s4} V${s4 - 50} C2718 ${s4 - 60} 2752 ${s4 - 60} 2752 ${s4 - 50} V${s4} Z" fill="#e1c48e" opacity=".8" stroke="#8a6a3c" stroke-width="2"/></g>
    <circle cx="${lan.x + lan.w / 2}" cy="${lan.y + lan.h * 0.52}" r="230" fill="url(#lanternGlow)"/>
    ${shadow(lan.x + lan.w / 2, s4 - 2, lan.w * 0.5, 7, 0.9)}
    ${targetSvg("lanterna")}
    ${runF.svg}
    <g>${shadow(2420, s5 - 2, 120, 8)}
      <path d="M2306 ${s5} L2318 ${s5 - 120} H2436 L2448 ${s5} Z" fill="#a8824e" stroke="#4a3013" stroke-width="2"/>
      <g stroke="#6e5230" stroke-width="3" opacity=".7"><path d="M2312 ${s5 - 30} H2442 M2314 ${s5 - 60} H2440 M2316 ${s5 - 90} H2438"/></g>
      <path d="M2456 ${s5} L2466 ${s5 - 96} H2560 L2570 ${s5} Z" fill="#b8925a" stroke="#4a3013" stroke-width="2"/>
      <g stroke="#6e5230" stroke-width="3" opacity=".7"><path d="M2462 ${s5 - 30} H2566 M2464 ${s5 - 60} H2564"/></g></g>
    ${bookStack(2590, s5, [[170, 24, "#2f5f5a"], [160, 22, "#8a5a2b", 6], [150, 22, "#5b3b5e", 10], [140, 20, "#7d2f24", 14]])}
    <g>${shadow(2920, s5 - 2, 120, 8)}
      ${[0, 1, 2].map((i) => `<rect x="${2806 + i * 6}" y="${s5 - 44 - i * 30}" width="${226 - i * 12}" height="26" rx="13" fill="url(#parchment)" stroke="#8a6a3c" stroke-width="1.5"/><ellipse cx="${3030 - i * 6}" cy="${s5 - 31 - i * 30}" rx="8" ry="13" fill="#d8bf86" stroke="#8a6a3c" stroke-width="1.5"/>`).join("")}</g>
    ${trailingPlant(2330, 134, 0.95)}`;
}

function floorAndRug() {
  let boards = "";
  for (let i = 0; i < 9; i += 1) {
    const y = 1190 + Math.round(Math.pow(i, 1.35) * 22);
    boards += `<path d="M0 ${y} H${W}" stroke="#2b170b" stroke-width="${2 + i * 0.3}" opacity=".55"/>`;
  }
  for (let i = 0; i < 26; i += 1) {
    const x = (i * 157) % W;
    const y = 1190 + ((i * 53) % 380);
    boards += `<path d="M${x} ${y} v26" stroke="#2b170b" stroke-width="2" opacity=".4"/>`;
  }
  // The rug, flat in (u, v) and mapped onto its floor trapezoid.
  const rug = ({ u, v }) => {
    const y = 1300 + v * (H - 1300);
    const left = 760 - v * 160;
    const right = 2380 + v * 140;
    return `${n(left + u * (right - left))} ${n(y)}`;
  };
  const poly = (pts, attrs) => `<path d="M${pts.map((p) => rug(p)).join(" L")} Z" ${attrs}/>`;
  const lozenge = (cu, cv, ru, rv, attrs) =>
    poly([{ u: cu, v: cv - rv }, { u: cu + ru, v: cv }, { u: cu, v: cv + rv }, { u: cu - ru, v: cv }], attrs);
  let rugMotifs = "";
  for (let i = 0; i < 16; i += 1) {
    const u = 0.06 + i * 0.0587;
    rugMotifs += lozenge(u, 0.115, 0.018, 0.05, `fill="#d9a85a" opacity=".8"`);
  }
  for (const cu of [0.16, 0.84]) {
    rugMotifs += lozenge(cu, 0.62, 0.07, 0.24, `fill="#21384f" opacity=".85"`);
    rugMotifs += lozenge(cu, 0.62, 0.035, 0.12, `fill="#d9a85a" opacity=".8"`);
  }
  return `
    <rect x="0" y="1180" width="${W}" height="${H - 1180}" fill="url(#woodV)"/>
    <rect x="0" y="1180" width="${W}" height="${H - 1180}" fill="#3a2010" opacity=".35"/>
    ${boards}
    <rect x="0" y="1168" width="${W}" height="22" fill="#2b170b"/>
    <g>
      ${poly([{ u: 0, v: 0 }, { u: 1, v: 0 }, { u: 1, v: 1 }, { u: 0, v: 1 }], `fill="#6b2421"`)}
      ${poly([{ u: 0.03, v: 0.06 }, { u: 0.97, v: 0.06 }, { u: 0.97, v: 1 }, { u: 0.03, v: 1 }], `fill="none" stroke="#21384f" stroke-width="22"`)}
      ${poly([{ u: 0.015, v: 0.03 }, { u: 0.985, v: 0.03 }, { u: 0.985, v: 1 }, { u: 0.015, v: 1 }], `fill="none" stroke="#d9a85a" stroke-width="5"`)}
      ${rugMotifs}
      ${lozenge(0.5, 0.64, 0.24, 0.42, `fill="#21384f"`)}
      ${lozenge(0.5, 0.64, 0.19, 0.33, `fill="#8a3a2c"`)}
      ${lozenge(0.5, 0.64, 0.1, 0.18, `fill="#d9a85a" opacity=".9"`)}
      ${lozenge(0.5, 0.64, 0.045, 0.08, `fill="#21384f"`)}
      <path d="M${rug({ u: 0, v: 0.2 })} H${rug({ u: 1, v: 0.2 }).split(" ")[0]}" stroke="#d9a85a" stroke-width="2" stroke-dasharray="10 12" opacity=".5"/>
    </g>`;
}

function wall() {
  return `
    <path fill-rule="evenodd" d="M0 0 H${W} V1190 H0 Z ${windowHolePath()}" fill="#28433f"/>
    <path fill-rule="evenodd" d="M0 0 H${W} V1190 H0 Z ${windowHolePath()}" fill="url(#wallLight)"/>
    <g opacity=".22" stroke="#122522" stroke-width="2">${Array.from({ length: 16 }, (_, i) => `<path d="M${200 + i * 190} 140 V860"/>`).join("")}</g>
    <rect x="0" y="860" width="${W}" height="26" fill="url(#woodV)" stroke="#1c0f07" stroke-width="2"/>
    <rect x="0" y="886" width="${W}" height="290" fill="#3d2616"/>
    <g fill="none" stroke="#1c0f07" stroke-width="3" opacity=".6">${Array.from({ length: 14 }, (_, i) => `<rect x="${20 + i * 230}" y="912" width="200" height="236" rx="4"/>`).join("")}</g>
    <g fill="none" stroke="#7a5233" stroke-width="2" opacity=".35">${Array.from({ length: 14 }, (_, i) => `<rect x="${24 + i * 230}" y="916" width="192" height="228" rx="4"/>`).join("")}</g>
    <rect x="0" y="0" width="${W}" height="118" fill="#24150b"/>
    <g fill="url(#woodDark)" stroke="#120a05" stroke-width="2">${Array.from({ length: 9 }, (_, i) => `<rect x="${i * 400 - 20}" y="0" width="70" height="132"/>`).join("")}</g>
    <rect x="0" y="104" width="${W}" height="34" fill="url(#woodV)" stroke="#120a05" stroke-width="2"/>`;
}

/** Window light on the wall and floor: blurred, painted before the furniture so no object is washed out. */
function lightShafts() {
  return `
    <g filter="url(#soft)">
      <path d="M340 540 L900 540 L1360 1188 L560 1188 Z" fill="#ffe0a3" opacity=".16"/>
      <path d="M560 1210 L1220 1210 L1500 1560 L700 1560 Z" fill="#ffd98f" opacity=".22"/>
      <path d="M420 300 L640 300 L1100 1188 L860 1188 Z" fill="#fff0c8" opacity=".1"/>
    </g>`;
}

function lightOverlays() {
  return `
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#warm)"/>
    <rect x="0" y="0" width="${W}" height="${H}" fill="url(#vignette)"/>`;
}

/** Wall decor between the frames and the bookcase: an explorer's hat and satchel on a peg rail. */
function pegRail() {
  return `
    <rect x="2070" y="430" width="170" height="20" rx="4" fill="url(#woodV)" stroke="#1c0f07" stroke-width="2"/>
    ${[2100, 2160, 2215].map((x) => `<rect x="${x - 5}" y="440" width="10" height="26" rx="4" fill="#4a2a16"/>`).join("")}
    <g>
      <ellipse cx="2128" cy="478" rx="62" ry="14" fill="#6b4a2a" stroke="#2b170b" stroke-width="2"/>
      <path d="M2088 476 C2090 440 2100 430 2128 430 C2156 430 2166 440 2168 476 Z" fill="#7e5a34" stroke="#2b170b" stroke-width="2"/>
      <path d="M2090 466 C2110 472 2146 472 2166 466 L2166 476 C2146 482 2110 482 2090 476 Z" fill="#3a2414"/>
    </g>
    <g>
      <path d="M2216 456 C2196 520 2196 560 2204 600" stroke="#5a3418" stroke-width="5" fill="none"/>
      <path d="M2216 456 C2236 520 2236 560 2228 600" stroke="#5a3418" stroke-width="5" fill="none"/>
      <path d="M2170 596 H2262 L2256 700 C2230 712 2200 712 2176 700 Z" fill="#8a5a32" stroke="#2b170b" stroke-width="2"/>
      <path d="M2168 596 H2264 L2258 640 C2230 654 2202 654 2174 640 Z" fill="#a06a3c" stroke="#2b170b" stroke-width="2"/>
      <rect x="2208" y="632" width="16" height="14" rx="2" fill="url(#brass)"/>
    </g>`;
}

/** Floor clutter that makes the room feel lived in (no target shares a category with it). */
function floorDecor() {
  return `
    <g>${shadow(2372, 1428, 80, 12)}
      ${[0, 1, 2].map((i) => {
        const x = 2328 + i * 36;
        const top = 1238 - (i % 2) * 18;
        return `<g transform="rotate(${-10 + i * 10} ${x + 12} 1330)"><rect x="${x}" y="${top}" width="26" height="${1336 - top}" rx="6" fill="url(#parchment)" stroke="#8a6a3c" stroke-width="1.5"/><ellipse cx="${x + 13}" cy="${top + 2}" rx="13" ry="6" fill="#e9d3a2" stroke="#8a6a3c" stroke-width="1.5"/><path d="M${x + 13} ${top + 2} m-6 0 a6 3 0 1 0 12 0 a3 1.6 0 1 0 -6 0" fill="none" stroke="#8a6a3c" stroke-width="1.2"/><rect x="${x}" y="${top + 34}" width="26" height="7" fill="#9c4a2b"/></g>`;
      }).join("")}
      <path d="M2306 1330 H2440 L2426 1424 H2320 Z" fill="#b8925a" stroke="#4a3013" stroke-width="2"/>
      <g stroke="#6e5230" stroke-width="3" opacity=".7"><path d="M2310 1360 H2436 M2314 1390 H2432"/></g>
    </g>
    <g>
      <path d="M1090 118 V250" stroke="#3a2414" stroke-width="3"/>
      <path d="M1040 250 H1140 L1126 300 H1054 Z" fill="#a8824e" stroke="#4a3013" stroke-width="2"/>
      ${trailingPlant(1090, 262, 0.75).replace(/<path d="M[^"]*" fill="url\(#terracotta\)"[^>]*>/, "")}
    </g>`;
}

function plateSvg({ debug = false } = {}) {
  const ampBox = boxOf(TARGETS.ampulheta.region);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${DEFS}
    <linearGradient id="wallLight" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#d9a35c" stop-opacity=".42"/><stop offset=".3" stop-color="#b98a4e" stop-opacity=".24"/><stop offset=".6" stop-color="#2c4a46" stop-opacity="0"/><stop offset="1" stop-color="#0d1a18" stop-opacity=".25"/>
    </linearGradient>
    <linearGradient id="shaft" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffe2a8" stop-opacity=".55"/><stop offset="1" stop-color="#ffd18a" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="warm" cx=".22" cy=".42" r=".8">
      <stop offset="0" stop-color="#ffcf8a" stop-opacity=".16"/><stop offset=".5" stop-color="#ffb066" stop-opacity=".06"/><stop offset="1" stop-color="#000000" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vignette" cx=".45" cy=".5" r=".75">
      <stop offset=".62" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#080503" stop-opacity=".42"/>
    </radialGradient>
  </defs>
  ${wall()}
  ${windowSvg()}
  ${curtain()}
  ${wallFrames()}
  ${floorAndRug()}
  ${lightShafts()}
  ${pegRail()}
  ${bookcase()}
  ${bookcaseItems()}
  ${globe()}
  ${sillItems()}
  ${targetSvg("binoculo")}
  ${sillPotOverBinoculars()}
  ${trunk()}
  ${targetSvg("chave")}
  ${trunkStraps()}
  ${floorDecor()}
  ${armchair()}
  ${sideTable()}
  ${bookStack(830, 1172, [[66, 14, "#2f5f5a"], [58, 12, "#9c4a2b", 4]])}
  ${shadow(ampBox.x + ampBox.w / 2, ampBox.y + ampBox.h - 2, ampBox.w * 0.55, 7, 0.9)}
  ${targetSvg("ampulheta")}
  ${table()}
  ${tableItems()}
  ${lupaOnMap()}
  ${lightOverlays()}
  ${debug ? debugOverlay() : ""}
</svg>`;
}

// --- front layer --------------------------------------------------------------------------------

function frontSvg() {
  const r = LAYER.front.rect;
  const leaf = (x, y, len, wid, angle, fill = "url(#leafDark)") =>
    `<path transform="rotate(${angle} ${x} ${y})" d="M${x} ${y} C${x - wid} ${y - len * 0.45} ${x - wid * 0.3} ${y - len} ${x} ${y - len} C${x + wid * 0.3} ${y - len} ${x + wid} ${y - len * 0.45} ${x} ${y} Z" fill="${fill}" stroke="#0f2412" stroke-width="2"/>
     <path transform="rotate(${angle} ${x} ${y})" d="M${x} ${y} V${y - len * 0.92}" stroke="#a7c98a" stroke-width="2" opacity=".6"/>`;
  let ivy = "";
  for (let i = 0; i < 5; i += 1) {
    const x0 = 30 + i * 52;
    const len = 150 + ((i * 67) % 150);
    ivy += `<path d="M${x0} 0 C${x0 + 20} ${len * 0.3} ${x0 - 10} ${len * 0.7} ${x0 + 12} ${len}" stroke="#2f5228" stroke-width="4" fill="none"/>`;
    for (let k = 0; k < 6; k += 1) {
      const y = 20 + (len - 20) * (k / 5);
      ivy += `<ellipse cx="${x0 + (k % 2 ? 14 : -10)}" cy="${n(y)}" rx="18" ry="11" fill="url(#leafDark)" transform="rotate(${k % 2 ? 35 : -35} ${x0} ${n(y)})"/>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r.w}" height="${r.h}" viewBox="${r.x} ${r.y} ${r.w} ${r.h}">
  <defs>${DEFS}</defs>
  <g opacity=".98">${ivy}</g>
  <g>
    ${leaf(120, 1600, 330, 90, -28)}${leaf(150, 1600, 400, 100, -6)}${leaf(190, 1600, 300, 80, 22)}
    ${leaf(60, 1600, 280, 80, -50, "url(#leaf)")}${leaf(230, 1600, 230, 70, 46, "url(#leaf)")}
    <path d="M40 1520 H300 L280 ${H} H60 Z" fill="url(#terracotta)" stroke="#3a1c0e" stroke-width="3"/>
    <rect x="30" y="1506" width="280" height="22" rx="6" fill="#c46f40" stroke="#3a1c0e" stroke-width="2"/>
  </g>
</svg>`;
}

// --- review overlay -----------------------------------------------------------------------------

function debugOverlay() {
  const shapes = SCENE.HIDDEN_OBJECTS.map((t) => {
    const color = { A: "#38f2c0", B: "#ffd23f", C: "#ff6b6b" }[t.tier];
    const r = t.region;
    return r.kind === "rect"
      ? `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="${color}" stroke-width="5"/>`
      : `<circle cx="${r.cx}" cy="${r.cy}" r="${r.r}" fill="none" stroke="${color}" stroke-width="5"/>`;
  }).join("");
  const margins = `<rect x="${SCENE.SAFE_MARGIN_X}" y="${SCENE.SAFE_MARGIN_Y}" width="${W - 2 * SCENE.SAFE_MARGIN_X}" height="${H - 2 * SCENE.SAFE_MARGIN_Y}" fill="none" stroke="#ffffff" stroke-width="3" stroke-dasharray="20 14" opacity=".8"/>`;
  const zones = SCENE.SCENE_STATIONS.map((s) => `<path d="M${s.span.x1} 0 V${H}" stroke="#ffffff" stroke-width="2" opacity=".5"/>`).join("");
  const front = LAYER.front.opaque.map((o) => `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" fill="#ff00ff" opacity=".18"/>`).join("");
  return `${zones}${margins}${front}${shapes}`;
}

// --- thumbnails, hero art and the Home maquette ---------------------------------------------------------------

function thumbSvg(id) {
  const size = 160;
  const pad = 14;
  const art = ART[id];
  const box = { x: pad, y: pad, w: size - 2 * pad, h: size - 2 * pad };
  let body;
  if (id === "lupa") {
    // the whole magnifier (lens and handle) inside the thumbnail
    const nominal = { w: 250, h: 250 };
    const scale = Math.min(box.w / nominal.w, box.h / nominal.h);
    body = `<g transform="translate(${pad} ${pad}) scale(${n(scale * 1000) / 1000})">${art.handle}${art.clip}${art.body}</g>`;
  } else {
    body = fit(art.body, art.nominal, box);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs>${DEFS}</defs>${body}</svg>`;
}

const DIORAMA = { w: 1040, h: 780 };

function dioramaPasses() {
  const cx = 520;
  const cy = 470;
  const rx = 372;
  const ry = 150;
  const wrap = (body, extraDefs = "") =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="${DIORAMA.w}" height="${DIORAMA.h}" viewBox="0 0 ${DIORAMA.w} ${DIORAMA.h}"><defs>${DEFS}${extraDefs}</defs>${body}</svg>`;
  const s = 0.42;
  return {
    "contact-shadow": wrap(`<ellipse cx="${cx}" cy="${cy + 74}" rx="${rx + 30}" ry="${ry + 26}" fill="url(#contact)"/>`),
    base: wrap(`
      <ellipse cx="${cx}" cy="${cy + 40}" rx="${rx}" ry="${ry}" fill="#5a3418" stroke="#2b170b" stroke-width="3"/>
      <path d="M${cx - rx} ${cy} V${cy + 40} A${rx} ${ry} 0 0 0 ${cx + rx} ${cy + 40} V${cy} Z" fill="url(#woodH)" stroke="#2b170b" stroke-width="3"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#b0784a" stroke="#6b3b1f" stroke-width="6"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${rx - 26}" ry="${ry - 12}" fill="#6b2421"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${rx - 50}" ry="${ry - 24}" fill="none" stroke="#d9a85a" stroke-width="4"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${rx - 70}" ry="${ry - 34}" fill="none" stroke="#21384f" stroke-width="10"/>`),
    back: wrap(`
      <g transform="translate(${cx - 250} ${cy - 360}) scale(${s})">
        <path d="M0 0 H1190 V820 H0 Z" fill="none"/>
      </g>
      <path d="M${cx - 300} ${cy - 30} V${cy - 250} A150 150 0 0 1 ${cx - 0} ${cy - 250} V${cy - 30} Z" fill="url(#woodH)" stroke="#2b170b" stroke-width="3"/>
      <path d="M${cx - 280} ${cy - 34} V${cy - 250} A130 130 0 0 1 ${cx - 20} ${cy - 250} V${cy - 34} Z" fill="#f6cf98"/>
      <path d="M${cx - 280} ${cy - 120} L${cx - 220} ${cy - 170} L${cx - 170} ${cy - 140} L${cx - 110} ${cy - 190} L${cx - 20} ${cy - 130} V${cy - 34} H${cx - 280} Z" fill="#8a8fa8"/>
      <rect x="${cx - 280}" y="${cy - 96}" width="260" height="62" fill="#6f98a8"/>
      <path d="M${cx - 150} ${cy - 380} V${cy - 34}" stroke="#5a3418" stroke-width="10"/>
      <rect x="${cx - 280}" y="${cy - 254}" width="260" height="9" fill="#5a3418"/>
      <rect x="${cx + 60}" y="${cy - 300}" width="230" height="290" fill="#3b2314" stroke="#2b170b" stroke-width="3"/>
      <rect x="${cx + 60}" y="${cy - 300}" width="230" height="290" fill="none" stroke="url(#woodH)" stroke-width="14"/>
      ${[cy - 210, cy - 120].map((y) => `<rect x="${cx + 66}" y="${y}" width="218" height="10" fill="url(#woodV)"/>`).join("")}
      ${bookRun(cx + 76, cy - 210, 8, 5, { minH: 50, maxH: 74, minW: 10, maxW: 18 }).svg}
      ${bookRun(cx + 76, cy - 120, 7, 9, { minH: 46, maxH: 70, minW: 10, maxW: 20 }).svg}
      ${bookRun(cx + 76, cy - 18, 8, 13, { minH: 50, maxH: 80, minW: 10, maxW: 18 }).svg}`),
    main: wrap(`
      ${shadow(cx - 10, cy + 70, 170, 26)}
      <path d="M${cx - 18} ${cy + 20} V${cy + 76} H${cx + 2} V${cy + 20} Z" fill="url(#woodH)"/>
      <ellipse cx="${cx - 8}" cy="${cy + 26}" rx="190" ry="54" fill="#4a2a16"/>
      <ellipse cx="${cx - 8}" cy="${cy + 14}" rx="190" ry="54" fill="url(#wood)" stroke="#2b170b" stroke-width="3"/>
      <path d="M${cx - 30} ${cy - 18} L${cx + 120} ${cy - 22} L${cx + 128} ${cy + 40} L${cx - 22} ${cy + 46} Z" fill="url(#parchment)" stroke="#9c7a48" stroke-width="2"/>
      <path d="M${cx - 160} ${cy + 4} C${cx - 130} ${cy - 10} ${cx - 90} ${cy - 10} ${cx - 64} ${cy} L${cx - 62} ${cy + 40} C${cx - 90} ${cy + 30} ${cx - 130} ${cy + 30} ${cx - 158} ${cy + 44} Z" fill="url(#page)" stroke="#8a6a3c" stroke-width="1.5"/>
      <path d="M${cx - 64} ${cy} C${cx - 38} ${cy - 10} ${cx - 4} ${cy - 10} ${cx + 22} ${cy + 2}" stroke="#8a6a3c" stroke-width="1.5" fill="none"/>
      ${shadow(cx + 230, cy + 60, 60, 12)}
      <path d="M${cx + 230} ${cy - 20} V${cy + 56}" stroke="#4a2a16" stroke-width="8"/>
      <circle cx="${cx + 230}" cy="${cy - 70}" r="54" fill="#2f6a86"/>
      <path d="M${cx + 200} ${cy - 100} C${cx + 214} ${cy - 112} ${cx + 236} ${cy - 108} ${cx + 240} ${cy - 92} C${cx + 244} ${cy - 76} ${cx + 226} ${cy - 66} ${cx + 210} ${cy - 72} Z" fill="#d8bb7c"/>
      <path d="M${cx + 172} ${cy - 30} A62 62 0 0 0 ${cx + 290} ${cy - 110}" stroke="url(#brass)" stroke-width="6" fill="none"/>`),
    detail: wrap(`
      <g transform="translate(${cx + 30} ${cy - 40}) scale(0.34)">${ART.lupa.handle}${ART.lupa.clip.replace("lupaClip", "lupaClipD")}${ART.lupa.body.replace("lupaClip", "lupaClipD")}</g>
      <g transform="translate(${cx - 120} ${cy - 46}) scale(0.32)">${ART.bussola.body}</g>
      <g transform="translate(${cx - 230} ${cy - 120}) scale(0.62)">${ART.ampulheta.body}</g>`),
    energy: wrap(`
      <circle cx="${cx + 150}" cy="${cy - 40}" r="120" fill="url(#lanternGlow)"/>
      <g filter="url(#softSmall)"><path d="M${cx - 280} ${cy - 200} L${cx - 20} ${cy - 200} L${cx + 160} ${cy + 80} L${cx - 160} ${cy + 80} Z" fill="#ffe2a8" opacity=".26"/></g>`, `<filter id="softSmall" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>`),
    front: wrap(`
      <g transform="translate(${cx + 110} ${cy - 66}) scale(0.5)">${ART.lanterna.body}</g>
      ${plant(cx - 300, cy + 96, 0.9)}
      ${bookStack(cx + 200, cy + 112, [[90, 16, "#7d2f24"], [80, 14, "#2d4b6b", 5]])}`),
  };
}

// --- run ------------------------------------------------------------------------------------------

const render = (svg) => sharp(Buffer.from(svg), { density: 72, limitInputPixels: false });
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

async function main() {
  fs.mkdirSync(path.join(OUT, "thumbs"), { recursive: true });
  fs.mkdirSync(DIORAMA_OUT, { recursive: true });
  fs.mkdirSync(REVIEW, { recursive: true });
  const report = [];
  const write = async (pipeline, file, options) => {
    await pipeline.webp(options).toFile(file);
    report.push([path.relative(ROOT, file), fs.statSync(file).size]);
  };

  const back = await render(backSvg()).png().toBuffer();
  const plate = await render(plateSvg()).png().toBuffer();
  const front = await render(frontSvg()).png().toBuffer();

  await write(sharp(back), path.join(OUT, "back.webp"), { quality: 78, effort: 6 });
  await write(sharp(plate), path.join(OUT, "plate.webp"), { quality: 80, alphaQuality: 90, effort: 6, smartSubsample: true });
  await write(sharp(front), path.join(OUT, "front.webp"), { quality: 80, alphaQuality: 90, effort: 6 });

  // The composed room, as the Explorador sees it at rest (parallax offsets 0).
  const composed = await sharp({ create: { width: W, height: H, channels: 4, background: "#000000" } })
    .composite([
      { input: back, left: LAYER.back.rect.x, top: LAYER.back.rect.y },
      { input: plate, left: 0, top: 0 },
      { input: front, left: LAYER.front.rect.x, top: LAYER.front.rect.y },
    ])
    .png()
    .toBuffer();

  // Intro / transition art: a 4:3 view of the window and the table.
  await write(
    sharp(composed).extract({ left: 380, top: 100, width: 2000, height: 1500 }).resize(960, 720),
    path.join(OUT, "hero.webp"),
    { quality: 74, effort: 6 },
  );

  for (const id of Object.keys(ART)) {
    await write(render(thumbSvg(id)), path.join(OUT, "thumbs", `${id}.webp`), { quality: 82, alphaQuality: 90, effort: 6 });
  }

  for (const [pass, svg] of Object.entries(dioramaPasses())) {
    await write(render(svg), path.join(DIORAMA_OUT, `discovery-${pass}.webp`), { quality: pass === "contact-shadow" ? 68 : 82, alphaQuality: 94, effort: 6 });
  }

  // Review boards (archive only, never runtime).
  await sharp(composed).resize(1600, 800).webp({ quality: 86 }).toFile(path.join(REVIEW, "scene.webp"));
  const debugPlate = await render(plateSvg({ debug: true })).png().toBuffer();
  const regions = await sharp({ create: { width: W, height: H, channels: 4, background: "#000000" } })
    .composite([{ input: back, left: LAYER.back.rect.x, top: LAYER.back.rect.y }, { input: debugPlate, left: 0, top: 0 }])
    .png()
    .toBuffer();
  await sharp(regions).resize(1600, 800).webp({ quality: 86 }).toFile(path.join(REVIEW, "regions.webp"));
  await sharp(composed).resize(1600, 800).grayscale().webp({ quality: 86 }).toFile(path.join(REVIEW, "scene-grayscale.webp"));

  let total = 0;
  for (const [file, size] of report) {
    total += size;
    console.log(`${kb(size).padStart(9)}  ${file}`);
  }
  console.log(`${kb(total).padStart(9)}  total (${report.length} files)`);
}

await main();
