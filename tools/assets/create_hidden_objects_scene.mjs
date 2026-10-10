/**
 * Estúdio das Descobertas — the scene's art kit (v2, GAME03-CALIBRATION-02A; v1 was GAME03-EXPERIENCE-02's).
 *
 * The room is painted here, in SVG, and finished with `sharp` (already a
 * devDependency): an albedo plate, a light pass multiplied over it (the window's
 * golden hour, shade under shelves and furniture, a cooler far corner), a bloom
 * pass screened on top, and a painterly grain. It is still authored art by
 * script — honest prototype art, a step towards the conceptual mockup
 * (docs/archive/hidden-objects/explorer-studio/reference/), not the final art.
 *
 * Single source of truth: every target is painted exactly where
 * `src/games/hidden-objects/scenes/explorer-studio.ts` puts its `region` (the
 * room's data since GAME03-MULTISCENE-03; the shared contract — safe margins —
 * stays in hidden-objects-scene.ts), every
 * look-alike exactly in its region, and the foreground layers only paint inside
 * that module's `opaque` rects — the module is transpiled and read below, so the
 * art cannot drift from the data the game hit-tests against.
 *
 * GAME03-CALIBRATION-02A (kit v2): the same room, harder to search where the
 * round model asked for it — five more objects tucked into what was already
 * there (a snail on the wainscot under the sill, a spinning top on the rug's
 * edge, scissors under the map's edge, a pine cone on the wall shelf, a
 * harmonica on the book pile at the foot of the bookcase) and eleven more
 * look-alikes, each of the same shape or material as an object and of another
 * kind. Nothing else moved. The audit adds `clutter`, measured on the shipped
 * layers (hidden-objects-art-kit.mjs, measureClutter). The intro art stays kit
 * v1's hero (the platform's world visuals name it; it is the room's picture).
 *
 * Writes:
 *   public/assets/hidden-objects/explorer-studio/v2/{back,plate,front,front-right}.webp
 *   public/assets/hidden-objects/explorer-studio/v2/thumbs/<id>.webp
 *   docs/archive/hidden-objects/explorer-studio/review/v2/*.webp (review boards)
 *   with --audit: docs/archive/hidden-objects/explorer-studio/review/v2/fairness.json
 *   with --home:  public/illustrations/home/dioramas/discovery/discovery-<pass>.webp
 *                 (the Home maquette — the mission's quality reference, so it is
 *                 only rewritten when asked)
 *
 * Usage: node tools/assets/create_hidden_objects_scene.mjs [--audit] [--home] [--preview=DIR]
 *   --preview=DIR  renders the composed room and the review boards into DIR only (nothing else written)
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import ts from "typescript";
import { composeShipped, measureClutter } from "./hidden-objects-art-kit.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const CONTRACT_MODULE = path.join(ROOT, "src/games/hidden-objects/hidden-objects-scene.ts");
const SCENE_MODULE = path.join(ROOT, "src/games/hidden-objects/scenes/explorer-studio.ts");
const DIORAMA_OUT = path.join(ROOT, "public/illustrations/home/dioramas/discovery");

const args = process.argv.slice(2);
const AUDIT = args.includes("--audit");
const HOME = args.includes("--home");
const PREVIEW = args.find((arg) => arg.startsWith("--preview="))?.slice("--preview=".length) ?? null;

// --- the scene data the game reads -------------------------------------------------------------

function loadModule(file) {
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const mod = { exports: {} };
  vm.runInNewContext(js, { module: mod, exports: mod.exports, require: () => ({}) });
  return mod.exports;
}

/** The Estúdio's data under its names, with the contract's (the safe margins) beside it. */
function loadScene() {
  return { ...loadModule(CONTRACT_MODULE), ...loadModule(SCENE_MODULE) };
}

const SCENE = loadScene();
const W = SCENE.SCENE_WIDTH;
const H = SCENE.SCENE_HEIGHT;
const TARGETS = Object.fromEntries(SCENE.HIDDEN_OBJECTS.map((t) => [t.id, t]));
const LOOKS = Object.fromEntries(SCENE.SCENE_LOOKALIKES.map((l) => [l.id, l]));
const LAYER = Object.fromEntries(SCENE.SCENE_LAYERS.map((l) => [l.id, l]));
const OUT = path.join(ROOT, "public", SCENE.SCENE_ASSET_BASE);
/** Each kit's review boards sit beside the earlier kits', never over them (v0's are the skeleton's record). */
const REVIEW = path.join(ROOT, "docs/archive/hidden-objects/explorer-studio/review", path.basename(SCENE.SCENE_ASSET_BASE));

/** The box a region is painted into: its rect, or the square around its circle. */
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

/** A seeded generator: the same room on every run. */
function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// --- shared paint ----------------------------------------------------------------------------------

const DEFS = `
  <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#a66d3e"/><stop offset=".55" stop-color="#77492a"/><stop offset="1" stop-color="#4c2b17"/>
  </linearGradient>
  <linearGradient id="woodV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#94603a"/><stop offset="1" stop-color="#53301a"/>
  </linearGradient>
  <linearGradient id="woodH" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#a87242"/><stop offset=".5" stop-color="#7d4c2a"/><stop offset="1" stop-color="#4f2e18"/>
  </linearGradient>
  <linearGradient id="woodDark" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#5e3a20"/><stop offset="1" stop-color="#2e1a0d"/>
  </linearGradient>
  <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f3d68a"/><stop offset=".45" stop-color="#c39443"/><stop offset="1" stop-color="#7a5521"/>
  </linearGradient>
  <linearGradient id="brassV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#efd086"/><stop offset=".5" stop-color="#bb8b3d"/><stop offset="1" stop-color="#6e4b1c"/>
  </linearGradient>
  <linearGradient id="brassDim" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#cfae6a"/><stop offset=".5" stop-color="#9c7536"/><stop offset="1" stop-color="#5e4119"/>
  </linearGradient>
  <linearGradient id="iron" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#5b5752"/><stop offset="1" stop-color="#26231f"/>
  </linearGradient>
  <linearGradient id="silver" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#e6e1d6"/><stop offset=".5" stop-color="#aaa497"/><stop offset="1" stop-color="#6f6a60"/>
  </linearGradient>
  <linearGradient id="bronzeAged" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ad8d50"/><stop offset=".5" stop-color="#7e6130"/><stop offset="1" stop-color="#4a3818"/>
  </linearGradient>
  <linearGradient id="umbrellaCloth" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#2b5c55"/><stop offset=".42" stop-color="#418277"/><stop offset="1" stop-color="#1d423d"/>
  </linearGradient>
  <linearGradient id="leatherDark" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#4a3a2c"/><stop offset=".5" stop-color="#2d231a"/><stop offset="1" stop-color="#17110c"/>
  </linearGradient>
  <radialGradient id="glassLens" cx=".38" cy=".34" r=".75">
    <stop offset="0" stop-color="#d8f0ff"/><stop offset=".35" stop-color="#7fb2cf"/><stop offset="1" stop-color="#21435a"/>
  </radialGradient>
  <radialGradient id="glassDark" cx=".35" cy=".3" r=".8">
    <stop offset="0" stop-color="#8fb1c4"/><stop offset=".4" stop-color="#36566c"/><stop offset="1" stop-color="#0f1d27"/>
  </radialGradient>
  <linearGradient id="parchment" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f3e3bd"/><stop offset=".6" stop-color="#e3cb96"/><stop offset="1" stop-color="#c7a96f"/>
  </linearGradient>
  <linearGradient id="page" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#e8d9b8"/><stop offset=".85" stop-color="#f6ecd3"/><stop offset="1" stop-color="#d2bf95"/>
  </linearGradient>
  <linearGradient id="pageR" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#d2bf95"/><stop offset=".15" stop-color="#f6ecd3"/><stop offset="1" stop-color="#e5d4b0"/>
  </linearGradient>
  <linearGradient id="ivory" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#f3ead6"/><stop offset=".6" stop-color="#d9caa8"/><stop offset="1" stop-color="#a0906e"/>
  </linearGradient>
  <linearGradient id="porcelain" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#f5f0e4"/><stop offset=".55" stop-color="#ddd3bd"/><stop offset="1" stop-color="#9d927c"/>
  </linearGradient>
  <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#7ea35a"/><stop offset="1" stop-color="#2f5a2c"/>
  </linearGradient>
  <linearGradient id="leafDark" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#557f40"/><stop offset="1" stop-color="#1b3a1f"/>
  </linearGradient>
  <linearGradient id="leafDeep" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#3b5f30"/><stop offset="1" stop-color="#112815"/>
  </linearGradient>
  <linearGradient id="terracotta" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#d4824f"/><stop offset=".6" stop-color="#a9552e"/><stop offset="1" stop-color="#73361b"/>
  </linearGradient>
  <linearGradient id="leather" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#557f60"/><stop offset=".5" stop-color="#30523d"/><stop offset="1" stop-color="#162d22"/>
  </linearGradient>
  <linearGradient id="velvet" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#1b3633"/><stop offset=".3" stop-color="#2e5850"/><stop offset=".55" stop-color="#1b3833"/><stop offset=".8" stop-color="#346356"/><stop offset="1" stop-color="#152c26"/>
  </linearGradient>
  <linearGradient id="spineShade" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#ffffff" stop-opacity=".22"/><stop offset=".35" stop-color="#ffffff" stop-opacity=".04"/><stop offset=".7" stop-color="#000000" stop-opacity=".08"/><stop offset="1" stop-color="#000000" stop-opacity=".34"/>
  </linearGradient>
  <linearGradient id="shelfShade" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#000000" stop-opacity=".55"/><stop offset=".45" stop-color="#000000" stop-opacity=".12"/><stop offset="1" stop-color="#000000" stop-opacity="0"/>
  </linearGradient>
  <radialGradient id="contact" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#0b0704" stop-opacity=".62"/><stop offset="1" stop-color="#0b0704" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="flameSmall" cx=".5" cy=".6" r=".6">
    <stop offset="0" stop-color="#fff6d6"/><stop offset=".45" stop-color="#ffc964"/><stop offset="1" stop-color="#ff8f1f" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#eccb86"/><stop offset="1" stop-color="#c2924f"/>
  </linearGradient>
  <linearGradient id="glassBulb" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#ffffff" stop-opacity=".42"/><stop offset=".35" stop-color="#dff1ff" stop-opacity=".12"/><stop offset="1" stop-color="#bfe0f2" stop-opacity=".3"/>
  </linearGradient>
  <linearGradient id="binoBody" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#4a433c"/><stop offset=".45" stop-color="#2c2723"/><stop offset="1" stop-color="#171411"/>
  </linearGradient>
  <linearGradient id="inkGlass" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#3a4448"/><stop offset=".4" stop-color="#1c2326"/><stop offset="1" stop-color="#0c1012"/>
  </linearGradient>
  <radialGradient id="snailShell" cx=".4" cy=".35" r=".7">
    <stop offset="0" stop-color="#b98652"/><stop offset=".55" stop-color="#7c4f2b"/><stop offset="1" stop-color="#4a2c16"/>
  </radialGradient>
  <linearGradient id="nickelDim" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#b9b6ad"/><stop offset=".5" stop-color="#8a867c"/><stop offset="1" stop-color="#57544d"/>
  </linearGradient>
  <linearGradient id="pineCone" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#9b6a3c"/><stop offset=".6" stop-color="#6b4325"/><stop offset="1" stop-color="#3f2513"/>
  </linearGradient>
  <linearGradient id="kilim" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#8a3a2c"/><stop offset="1" stop-color="#5e2219"/>
  </linearGradient>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="34"/></filter>
  <filter id="blur3" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>
  <filter id="blur8" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="8"/></filter>
  <filter id="blur16" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter>
  <filter id="grainH" x="0" y="0" width="1" height="1">
    <feTurbulence type="fractalNoise" baseFrequency="0.0032 0.12" numOctaves="3" seed="11" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.46  0 0 0 0 0.32  0 0 0 -2.2 1.4" result="streak"/>
    <feComposite in="streak" in2="SourceAlpha" operator="in" result="s"/>
    <feBlend in="s" in2="SourceGraphic" mode="multiply"/>
  </filter>
  <filter id="grainV" x="0" y="0" width="1" height="1">
    <feTurbulence type="fractalNoise" baseFrequency="0.12 0.004" numOctaves="3" seed="17" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.62  0 0 0 0 0.46  0 0 0 0 0.32  0 0 0 -2.2 1.4" result="streak"/>
    <feComposite in="streak" in2="SourceAlpha" operator="in" result="s"/>
    <feBlend in="s" in2="SourceGraphic" mode="multiply"/>
  </filter>
  <filter id="plaster" x="0" y="0" width="1" height="1">
    <feTurbulence type="fractalNoise" baseFrequency="0.009" numOctaves="4" seed="3" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.9 -0.3" result="m"/>
    <feComposite in="m" in2="SourceAlpha" operator="in" result="mm"/>
    <feBlend in="mm" in2="SourceGraphic" mode="soft-light"/>
  </filter>
  <filter id="weave" x="0" y="0" width="1" height="1">
    <feTurbulence type="fractalNoise" baseFrequency="0.28 0.22" numOctaves="2" seed="5" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.4  0 0 0 0 0.32  0 0 0 0 0.26  0 0 0 -1.3 0.95" result="w"/>
    <feComposite in="w" in2="SourceAlpha" operator="in" result="ww"/>
    <feBlend in="ww" in2="SourceGraphic" mode="multiply"/>
  </filter>
`;

const shadow = (cx, cy, rx, ry, o = 1) =>
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="url(#contact)" opacity="${o}"/>`;

/** Ambient occlusion: a blurred dark band where two surfaces meet. */
const occlusion = (x, y, w, h, o = 0.5) =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="#0b0704" opacity="${o}" filter="url(#blur8)"/>`;

// --- the ten targets (each authored in its own nominal box) ---------------------------------------

/**
 * Outlines are a darker shade of each object's own material, never near-black
 * ink: the objects belong to the room's light instead of sitting on it.
 */
const ART = {
  ampulheta: {
    nominal: { w: 116, h: 222 },
    body: `
      <path d="M24 28 C24 74 52 94 55 111 C52 128 24 150 24 194 L92 194 C92 150 64 128 61 111 C64 94 92 74 92 28 Z" fill="url(#glassBulb)" stroke="#e8f2f2" stroke-opacity=".5" stroke-width="2"/>
      <path d="M33 70 C41 90 52 102 56 110 L60 110 C64 102 75 90 83 70 Q58 78 33 70 Z" fill="url(#sand)"/>
      <rect x="57" y="110" width="2.2" height="52" fill="#d9ad62"/>
      <path d="M27 194 C31 170 46 157 58 155 C70 157 85 170 89 194 Z" fill="url(#sand)"/>
      <path d="M31 38 C31 66 44 84 50 96" stroke="#ffffff" stroke-opacity=".5" stroke-width="3.5" fill="none" stroke-linecap="round"/>
      <path d="M31 186 C33 166 40 156 47 150" stroke="#ffffff" stroke-opacity=".35" stroke-width="2.5" fill="none" stroke-linecap="round"/>
      <rect x="2" y="12" width="112" height="16" rx="5" fill="url(#wood)" stroke="#4a2a14" stroke-width="1.6"/>
      <rect x="2" y="194" width="112" height="16" rx="5" fill="url(#wood)" stroke="#4a2a14" stroke-width="1.6"/>
      <ellipse cx="58" cy="12" rx="55" ry="7" fill="#b07a46"/>
      <ellipse cx="58" cy="214" rx="54" ry="6" fill="#3d220f"/>
      <g fill="url(#woodH)" stroke="#4a2a14" stroke-width="1.2">
        <rect x="8" y="26" width="10" height="170" rx="5"/><rect x="98" y="26" width="10" height="170" rx="5"/>
      </g>
      <g fill="#bf8650">
        <ellipse cx="13" cy="60" rx="7" ry="5"/><ellipse cx="13" cy="111" rx="7" ry="6"/><ellipse cx="13" cy="162" rx="7" ry="5"/>
        <ellipse cx="103" cy="60" rx="7" ry="5"/><ellipse cx="103" cy="111" rx="7" ry="6"/><ellipse cx="103" cy="162" rx="7" ry="5"/>
      </g>`,
  },
  binoculo: {
    nominal: { w: 152, h: 78 },
    body: `
      <path d="M14 20 C14 8 20 4 30 4 H42 C52 4 58 8 58 20 L64 56 H8 Z" fill="url(#binoBody)" stroke="#1a1612" stroke-width="1.6"/>
      <path d="M94 20 C94 8 100 4 110 4 H122 C132 4 138 8 138 20 L144 56 H88 Z" fill="url(#binoBody)" stroke="#1a1612" stroke-width="1.6"/>
      <path d="M20 10 C24 7 30 7 32 10 L22 52 H14 Z" fill="#7a7166" opacity=".45"/>
      <path d="M100 10 C104 7 110 7 112 10 L102 52 H94 Z" fill="#7a7166" opacity=".35"/>
      <g stroke="#120f0c" stroke-width="1.1" opacity=".5"><path d="M12 30 H60 M10 40 H62 M92 30 H140 M90 40 H142"/></g>
      <rect x="54" y="12" width="44" height="18" rx="8" fill="url(#iron)" stroke="#1a1612" stroke-width="1.3"/>
      <circle cx="76" cy="21" r="9" fill="#2a2622" stroke="#a89d88" stroke-width="1.8"/>
      <g stroke="#bfb49e" stroke-width="1.3"><path d="M71 15 V27 M76 13 V29 M81 15 V27"/></g>
      <ellipse cx="36" cy="5" rx="16" ry="5" fill="#0f0c0a" stroke="#5f584f" stroke-width="1.8"/>
      <ellipse cx="116" cy="5" rx="16" ry="5" fill="#0f0c0a" stroke="#5f584f" stroke-width="1.8"/>
      <ellipse cx="36" cy="58" rx="31" ry="19" fill="#1c1916" stroke="url(#brassDim)" stroke-width="3.5"/>
      <ellipse cx="116" cy="58" rx="31" ry="19" fill="#1c1916" stroke="url(#brassDim)" stroke-width="3.5"/>
      <ellipse cx="36" cy="58" rx="22" ry="13" fill="url(#glassDark)"/>
      <ellipse cx="116" cy="58" rx="22" ry="13" fill="url(#glassDark)"/>
      <ellipse cx="29" cy="53" rx="7" ry="3.4" fill="#ffffff" opacity=".55"/>
      <ellipse cx="109" cy="53" rx="7" ry="3.4" fill="#ffffff" opacity=".45"/>
      <path d="M8 40 C-4 60 2 76 20 78" stroke="#5e341d" stroke-width="3.5" fill="none"/>`,
  },
  chave: {
    nominal: { w: 132, h: 56 },
    body: `
      <g fill="none" stroke="#4a3216" stroke-width="11"><circle cx="27" cy="28" r="19"/></g>
      <g fill="none" stroke="url(#brassDim)" stroke-width="7.5"><circle cx="27" cy="28" r="19"/></g>
      <path d="M27 14 L33 24 L27 34 L21 24 Z" fill="#8f6a33"/>
      <rect x="44" y="21" width="10" height="14" rx="2" fill="#86602e" stroke="#4a3216" stroke-width="1.3"/>
      <rect x="52" y="24" width="72" height="8" rx="3" fill="url(#brassDim)" stroke="#4a3216" stroke-width="1.3"/>
      <path d="M100 31 V50 H108 V43 H114 V50 H122 V31 Z" fill="url(#brassDim)" stroke="#4a3216" stroke-width="1.3"/>
      <circle cx="124" cy="28" r="5" fill="#a07638" stroke="#4a3216" stroke-width="1.3"/>
      <path d="M14 18 A15 15 0 0 1 30 10" stroke="#f3dc9c" stroke-width="2" fill="none" opacity=".55"/>`,
  },
  lupa: {
    // lens centre at (90, 90); the handle runs down-right out of the target box
    nominal: { w: 180, h: 180 },
    body: `
      <circle cx="90" cy="90" r="64" fill="url(#glassLens)" opacity=".34"/>
      <g clip-path="url(#lupaClip)">
        <path d="M30 70 C60 50 90 96 150 64" stroke="#7b5a33" stroke-width="7" fill="none" opacity=".5"/>
        <path d="M40 124 C70 108 104 140 150 116" stroke="#4f7d8a" stroke-width="6" fill="none" stroke-dasharray="14 10" opacity=".5"/>
        <circle cx="104" cy="96" r="9" fill="#a0442c" opacity=".5"/>
      </g>
      <path d="M50 50 A58 58 0 0 1 108 34" stroke="#ffffff" stroke-width="6" fill="none" opacity=".6" stroke-linecap="round"/>
      <circle cx="90" cy="90" r="70" fill="none" stroke="#4a3013" stroke-width="17"/>
      <circle cx="90" cy="90" r="70" fill="none" stroke="url(#brass)" stroke-width="12"/>
      <circle cx="90" cy="90" r="62" fill="none" stroke="#7a5521" stroke-width="2"/>`,
    clip: `<clipPath id="lupaClip"><circle cx="90" cy="90" r="62"/></clipPath>`,
    handle: `
      <path d="M138 138 L152 152" stroke="#4a3013" stroke-width="24" stroke-linecap="round"/>
      <path d="M138 138 L152 152" stroke="url(#brass)" stroke-width="18" stroke-linecap="round"/>
      <path d="M154 154 L232 232" stroke="#2b170b" stroke-width="28" stroke-linecap="round"/>
      <path d="M154 154 L232 232" stroke="url(#woodH)" stroke-width="22" stroke-linecap="round"/>
      <path d="M160 152 L224 216" stroke="#c48a55" stroke-width="4" stroke-linecap="round" opacity=".55"/>`,
  },
  bussola: {
    nominal: { w: 132, h: 132 },
    body: `
      <circle cx="66" cy="10" r="9" fill="none" stroke="url(#brassDim)" stroke-width="5"/>
      <rect x="60" y="13" width="12" height="9" rx="2" fill="url(#brassV)"/>
      <circle cx="66" cy="70" r="58" fill="#5a3d16"/>
      <circle cx="66" cy="68" r="58" fill="url(#brassDim)"/>
      <circle cx="66" cy="68" r="49" fill="#6f4c1e"/>
      <circle cx="66" cy="68" r="45" fill="#e8dcc0"/>
      <g stroke="#6b4a24" stroke-width="2.4" stroke-linecap="round">
        <path d="M66 26 V36 M66 100 V110 M24 68 H34 M98 68 H108"/>
      </g>
      <g stroke="#9b7a4c" stroke-width="1.4" stroke-linecap="round">
        <path d="M36 38 L41 43 M96 38 L91 43 M36 98 L41 93 M96 98 L91 93"/>
      </g>
      <path d="M66 32 L74 68 L58 68 Z" fill="#b5402e"/>
      <path d="M66 104 L74 68 L58 68 Z" fill="#2d3e50"/>
      <circle cx="66" cy="68" r="5" fill="url(#brass)" stroke="#5a3d16" stroke-width="1.4"/>
      <path d="M34 50 A38 38 0 0 1 60 30" stroke="#ffffff" stroke-width="3.5" fill="none" opacity=".5" stroke-linecap="round"/>`,
  },
  relogio: {
    nominal: { w: 96, h: 96 },
    body: `
      <circle cx="48" cy="8" r="8" fill="none" stroke="url(#brassDim)" stroke-width="4"/>
      <rect x="42" y="12" width="12" height="9" rx="2" fill="url(#brassV)" stroke="#6e4b1c" stroke-width="1"/>
      <circle cx="48" cy="58" r="38" fill="#6e4b1c"/>
      <circle cx="48" cy="56" r="38" fill="url(#brassDim)"/>
      <circle cx="48" cy="56" r="30" fill="#ddcdaa" stroke="#a5834a" stroke-width="2"/>
      <path d="M30 70 A24 24 0 0 0 66 70" stroke="#000000" stroke-width="5" fill="none" opacity=".06"/>
      <g stroke="#3d2b17" stroke-width="2.8" stroke-linecap="round"><path d="M48 30 V36 M48 76 V82 M22 56 H28 M68 56 H74"/></g>
      <g stroke="#7a6446" stroke-width="1.4" stroke-linecap="round">
        <path d="M61 33.5 L59 37 M70.5 43 L67 45 M70.5 69 L67 67 M61 78.5 L59 75 M35 78.5 L37 75 M25.5 69 L29 67 M25.5 43 L29 45 M35 33.5 L37 37"/>
      </g>
      <path d="M48 56 L36 44" stroke="#1f1710" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M48 56 L60 34" stroke="#1f1710" stroke-width="2.3" stroke-linecap="round"/>
      <circle cx="48" cy="56" r="3" fill="#1f1710"/>
      <path d="M26 42 A26 26 0 0 1 42 28" stroke="#ffffff" stroke-width="2.6" fill="none" opacity=".6" stroke-linecap="round"/>`,
  },
  barco: {
    nominal: { w: 290, h: 215 },
    body: `
      <rect x="54" y="198" width="182" height="14" rx="3" fill="url(#woodV)" stroke="#3a2010" stroke-width="1.6"/>
      <path d="M92 198 V170 H106 V198 Z M184 198 V170 H198 V198 Z" fill="#5a3418" stroke="#3a2010" stroke-width="1.6"/>
      <path d="M12 136 L54 132 L250 140 L282 128 L268 150 C240 182 170 190 140 190 C96 190 50 182 30 160 Z" fill="#5a3418" stroke="#3a2010" stroke-width="2"/>
      <path d="M12 136 L54 132 L54 122 L16 124 Z" fill="#6f4224" stroke="#3a2010" stroke-width="1.6"/>
      <path d="M26 152 C70 168 200 170 262 150" stroke="#cf9f50" stroke-width="5" fill="none"/>
      <path d="M36 166 C80 180 190 182 246 164" stroke="#2b170b" stroke-width="3" fill="none" opacity=".5"/>
      <g fill="#e2cb94"><circle cx="90" cy="158" r="3"/><circle cx="120" cy="161" r="3"/><circle cx="150" cy="162" r="3"/><circle cx="180" cy="161" r="3"/><circle cx="210" cy="158" r="3"/></g>
      <path d="M250 140 L288 118" stroke="#4a2a12" stroke-width="4" stroke-linecap="round"/>
      <g stroke="#4a2a12" stroke-width="5" stroke-linecap="round"><path d="M112 136 V16"/><path d="M192 138 V34"/><path d="M50 132 V60"/></g>
      <g stroke="#7a6a52" stroke-width="1.2" fill="none" opacity=".85">
        <path d="M112 18 L20 128 M112 18 L192 36 M192 36 L286 120 M112 18 L250 138 M50 62 L16 124"/>
      </g>
      <path d="M78 26 Q112 18 146 26 Q150 40 146 56 Q112 50 78 56 Q74 40 78 26 Z" fill="#ecdfbf" stroke="#a89470" stroke-width="1.4"/>
      <path d="M70 62 Q112 54 154 62 Q160 82 154 104 Q112 96 70 104 Q64 82 70 62 Z" fill="#e8d9b4" stroke="#a89470" stroke-width="1.4"/>
      <path d="M160 44 Q192 38 224 44 Q228 58 224 74 Q192 68 160 74 Q156 58 160 44 Z" fill="#ecdfbf" stroke="#a89470" stroke-width="1.4"/>
      <path d="M154 80 Q192 72 230 80 Q236 98 230 118 Q192 110 154 118 Q148 98 154 80 Z" fill="#e8d9b4" stroke="#a89470" stroke-width="1.4"/>
      <path d="M198 40 L270 122 L200 124 Z" fill="#efe4c9" stroke="#a89470" stroke-width="1.4"/>
      <path d="M50 64 L24 120 L50 120 Z" fill="#e8d9b4" stroke="#a89470" stroke-width="1.4"/>
      <path d="M84 30 Q112 24 140 30" stroke="#d2c29b" stroke-width="2" fill="none"/>
      <path d="M76 70 Q112 62 148 70" stroke="#d2c29b" stroke-width="2" fill="none"/>
      <path d="M112 16 L136 21 L112 26 Z" fill="#a83c2c"/><path d="M192 34 L212 38 L192 42 Z" fill="#a83c2c"/>`,
  },
  lanterna: {
    // GAME03-EXPERIENCE-02: a low flame behind brass bars, not the brightest thing in the room
    nominal: { w: 126, h: 212 },
    body: `
      <path d="M30 40 C30 2 96 2 96 40" stroke="#4a3213" stroke-width="7" fill="none"/>
      <path d="M30 40 C30 2 96 2 96 40" stroke="url(#brassDim)" stroke-width="4.5" fill="none"/>
      <path d="M26 52 L63 22 L100 52 Z" fill="url(#brassDim)" stroke="#4a3213" stroke-width="1.8"/>
      <rect x="22" y="50" width="82" height="10" rx="4" fill="url(#brassV)" stroke="#4a3213" stroke-width="1.4"/>
      <path d="M32 60 C12 92 12 132 32 164 L94 164 C114 132 114 92 94 60 Z" fill="#6f5a3a" opacity=".55"/>
      <path d="M32 60 C12 92 12 132 32 164 L94 164 C114 132 114 92 94 60 Z" fill="url(#flameSmall)" opacity=".75"/>
      <path d="M63 104 C70 114 70 126 63 132 C56 126 56 114 63 104 Z" fill="#fff1c8"/>
      <path d="M63 110 C67 117 67 124 63 129 C59 124 59 117 63 110 Z" fill="#ffad3a"/>
      <g stroke="#6b4a1d" stroke-width="3"><path d="M38 62 C26 96 26 128 38 162 M88 62 C100 96 100 128 88 162 M63 60 V164"/></g>
      <path d="M36 70 C28 94 28 116 34 136" stroke="#ffffff" stroke-width="3.2" fill="none" opacity=".4" stroke-linecap="round"/>
      <rect x="18" y="162" width="90" height="12" rx="5" fill="url(#brassV)" stroke="#4a3213" stroke-width="1.4"/>
      <path d="M24 174 H102 L96 204 H30 Z" fill="url(#brassDim)" stroke="#4a3213" stroke-width="1.8"/>
      <ellipse cx="63" cy="206" rx="36" ry="6" fill="#3d2810"/>`,
  },
  camera: {
    // GAME03-EXPERIENCE-02: black leather and dark brass — it sits in the shelf's shade
    nominal: { w: 166, h: 118 },
    body: `
      <rect x="22" y="14" width="44" height="22" rx="4" fill="#2b231a" stroke="#0f0d0b" stroke-width="1.6"/>
      <rect x="100" y="20" width="22" height="14" rx="3" fill="url(#brassDim)" stroke="#3a2a12" stroke-width="1.6"/>
      <circle cx="136" cy="27" r="7" fill="url(#brassDim)" stroke="#3a2a12" stroke-width="1.6"/>
      <rect x="6" y="32" width="154" height="80" rx="9" fill="url(#leatherDark)" stroke="#0f0d0b" stroke-width="2"/>
      <rect x="6" y="32" width="154" height="20" rx="6" fill="#30271d" stroke="#0f0d0b" stroke-width="1.6"/>
      <path d="M10 52 H156" stroke="url(#brassDim)" stroke-width="1.6" opacity=".8"/>
      <g stroke="#0f0c09" stroke-width="1" opacity=".5"><path d="M14 64 H52 M14 74 H52 M14 84 H52 M14 94 H52 M114 64 H152 M114 74 H152 M114 84 H152 M114 94 H152"/></g>
      <rect x="16" y="40" width="22" height="10" rx="2" fill="url(#glassDark)"/>
      <circle cx="83" cy="76" r="36" fill="#141210" stroke="url(#brassDim)" stroke-width="5"/>
      <circle cx="83" cy="76" r="25" fill="#2a2724" stroke="#6f6a5f" stroke-width="2"/>
      <circle cx="83" cy="76" r="18" fill="url(#glassDark)"/>
      <circle cx="77" cy="70" r="4.5" fill="#ffffff" opacity=".55"/>
      <circle cx="90" cy="83" r="2.2" fill="#ffffff" opacity=".3"/>
      <rect x="0" y="40" width="7" height="14" rx="2" fill="url(#brassDim)"/><rect x="159" y="40" width="7" height="14" rx="2" fill="url(#brassDim)"/>`,
  },
  estatueta: {
    nominal: { w: 84, h: 122 },
    body: `
      <rect x="14" y="100" width="56" height="20" rx="3" fill="url(#ivory)" stroke="#8a7a58" stroke-width="1.3"/>
      <rect x="10" y="96" width="64" height="7" rx="2" fill="#e8ddc3" stroke="#8a7a58" stroke-width="1.1"/>
      <path d="M32 38 C26 52 22 74 20 96 L64 96 C62 74 58 52 52 38 C48 34 36 34 32 38 Z" fill="url(#ivory)" stroke="#8a7a58" stroke-width="1.3"/>
      <path d="M33 44 C29 60 28 78 29 94 M42 42 C41 60 41 78 42 94 M51 44 C54 60 56 78 56 94" stroke="#ad9c77" stroke-width="1.5" fill="none"/>
      <path d="M52 42 C60 36 64 26 62 14" stroke="url(#ivory)" stroke-width="7" fill="none" stroke-linecap="round"/>
      <circle cx="62" cy="11" r="5" fill="#efe5cf" stroke="#8a7a58" stroke-width="1.1"/>
      <path d="M32 42 C26 50 26 58 30 64" stroke="url(#ivory)" stroke-width="7" fill="none" stroke-linecap="round"/>
      <circle cx="42" cy="26" r="11" fill="url(#ivory)" stroke="#8a7a58" stroke-width="1.3"/>
      <path d="M33 22 C36 14 48 14 51 22" stroke="#c2b089" stroke-width="3" fill="none"/>`,
  },
};

/** The target's art placed on the plate (or, with `box`, anywhere else). */
function targetSvg(id, box = boxOf(TARGETS[id].region)) {
  const art = ART[id];
  return fit(art.body, art.nominal, box);
}

/** A pool object in its place — or nothing, when the audit renders the room without it. */
const paint = (id, omit) => (omit === id ? "" : targetSvg(id));

/** The magnifier's handle reaches past its lens circle: it is painted in the lens's frame. */
function lupaHandleSvg(box) {
  const art = ART.lupa;
  return fit(art.handle, art.nominal, box);
}

// --- the look-alikes (same shape or material, another kind of thing) ---------------------------------

const LOOK_ART = {
  "vaso-torneado": {
    nominal: { w: 40, h: 108 },
    body: `
      <path d="M8 8 H32 C32 22 24 30 22 44 C30 54 36 70 34 92 C33 100 28 106 20 106 C12 106 7 100 6 92 C4 70 10 54 18 44 C16 30 8 22 8 8 Z" fill="url(#woodH)" stroke="#4a2a14" stroke-width="1.4" filter="url(#grainV)"/>
      <ellipse cx="20" cy="8" rx="12" ry="3.4" fill="#3a2010"/>
      <path d="M17 8 C14 -8 6 -14 2 -16 M22 8 C24 -6 30 -10 36 -12 M20 8 V-14" stroke="#a88a5a" stroke-width="1.6" fill="none"/>
      <g fill="#c9a86a"><circle cx="2" cy="-16" r="3"/><circle cx="36" cy="-12" r="3"/><circle cx="20" cy="-15" r="3"/></g>
      <path d="M12 60 C12 76 13 88 16 98" stroke="#d29a62" stroke-width="2" fill="none" opacity=".5"/>`,
  },
  tinteiros: {
    nominal: { w: 58, h: 50 },
    body: `
      <path d="M2 48 V22 C2 16 6 14 10 14 H20 C24 14 28 16 28 22 V48 Z" fill="url(#inkGlass)" stroke="#0b0d0e" stroke-width="1.4"/>
      <rect x="9" y="6" width="12" height="9" rx="2" fill="#2a2018" stroke="#0b0d0e" stroke-width="1"/>
      <path d="M32 48 V26 C32 20 36 18 40 18 H50 C54 18 56 20 56 26 V48 Z" fill="url(#inkGlass)" stroke="#0b0d0e" stroke-width="1.4"/>
      <rect x="39" y="10" width="12" height="9" rx="2" fill="#2a2018" stroke="#0b0d0e" stroke-width="1"/>
      <path d="M6 24 V44 M36 28 V44" stroke="#ffffff" stroke-width="2" opacity=".28"/>`,
  },
  "alca-do-bau": {
    nominal: { w: 48, h: 24 },
    body: `
      <path d="M6 22 C6 4 42 4 42 22" fill="none" stroke="#4a3216" stroke-width="7"/>
      <path d="M6 22 C6 4 42 4 42 22" fill="none" stroke="url(#brassDim)" stroke-width="4"/>
      <rect x="0" y="18" width="12" height="6" rx="2" fill="url(#brassDim)"/><rect x="36" y="18" width="12" height="6" rx="2" fill="url(#brassDim)"/>`,
  },
  fivela: {
    nominal: { w: 28, h: 28 },
    body: `<rect x="3" y="3" width="22" height="22" rx="3" fill="none" stroke="#4a3216" stroke-width="6"/><rect x="3" y="3" width="22" height="22" rx="3" fill="none" stroke="url(#brassDim)" stroke-width="3.5"/><path d="M14 3 V25" stroke="url(#brassDim)" stroke-width="2.5"/>`,
  },
  carimbo: {
    nominal: { w: 46, h: 84 },
    body: `
      <path d="M17 4 C10 4 8 12 10 20 C12 30 14 40 15 52 H31 C32 40 34 30 36 20 C38 12 36 4 29 4 Z" fill="url(#woodH)" stroke="#3a2010" stroke-width="1.4"/>
      <rect x="11" y="52" width="24" height="10" rx="2" fill="url(#brassDim)" stroke="#4a3216" stroke-width="1.2"/>
      <path d="M8 62 H38 L42 78 C42 82 4 82 4 78 Z" fill="url(#brass)" stroke="#4a3216" stroke-width="1.4"/>
      <ellipse cx="23" cy="80" rx="19" ry="4" fill="#5e4119"/>
      <path d="M14 10 C12 18 14 30 17 44" stroke="#d29a62" stroke-width="2" fill="none" opacity=".5"/>`,
  },
  "lata-redonda": {
    nominal: { w: 44, h: 44 },
    body: `<circle cx="22" cy="24" r="21" fill="#5a3d16"/><circle cx="22" cy="22" r="21" fill="url(#brassDim)"/><circle cx="22" cy="22" r="15" fill="none" stroke="#7a5521" stroke-width="1.6"/><path d="M10 14 A14 14 0 0 1 22 8" stroke="#f3dc9c" stroke-width="2.4" fill="none" opacity=".6"/><circle cx="22" cy="22" r="5" fill="none" stroke="#8d6a30" stroke-width="1.4"/>`,
  },
  moedas: {
    nominal: { w: 32, h: 28 },
    body: `
      <ellipse cx="16" cy="22" rx="14" ry="5" fill="#5a3d16"/><ellipse cx="16" cy="20" rx="14" ry="5" fill="url(#brassDim)"/>
      <ellipse cx="16" cy="17" rx="14" ry="5" fill="#6b4a1e"/><ellipse cx="16" cy="15" rx="14" ry="5" fill="url(#brass)"/>
      <ellipse cx="16" cy="15" rx="9" ry="3" fill="none" stroke="#7a5521" stroke-width="1"/>
      <ellipse cx="10" cy="7" rx="7" ry="6" fill="url(#brassDim)" stroke="#5a3d16" stroke-width="1"/>`,
  },
  chaleira: {
    nominal: { w: 72, h: 70 },
    body: `
      <path d="M20 20 C26 6 46 6 52 20" fill="none" stroke="#4a3216" stroke-width="6"/>
      <path d="M20 20 C26 6 46 6 52 20" fill="none" stroke="url(#brassDim)" stroke-width="3.4"/>
      <path d="M12 64 C2 50 8 26 36 24 C64 26 70 50 60 64 Z" fill="url(#brassDim)" stroke="#4a3216" stroke-width="1.6"/>
      <path d="M58 40 C68 36 70 30 72 24 L66 22 C64 30 60 34 56 36 Z" fill="url(#brassDim)" stroke="#4a3216" stroke-width="1.2"/>
      <ellipse cx="36" cy="25" rx="16" ry="4" fill="#6e4b1c"/><circle cx="36" cy="19" r="4" fill="url(#brass)"/>
      <path d="M18 40 C16 48 18 56 22 60" stroke="#f3dc9c" stroke-width="2.5" fill="none" opacity=".5"/>
      <ellipse cx="36" cy="64" rx="26" ry="5" fill="#3d2810"/>`,
  },
  "caixinha-de-musica": {
    nominal: { w: 110, h: 54 },
    body: `
      <rect x="4" y="12" width="98" height="40" rx="5" fill="url(#leatherDark)" stroke="#0f0c09" stroke-width="1.6"/>
      <rect x="4" y="12" width="98" height="10" rx="4" fill="#3a2a1c"/>
      <path d="M12 30 H94" stroke="url(#brassDim)" stroke-width="2"/>
      <circle cx="96" cy="34" r="6" fill="url(#brassDim)" stroke="#3a2a12" stroke-width="1.2"/>
      <path d="M100 34 H108 V22" stroke="url(#brassDim)" stroke-width="3" fill="none" stroke-linecap="round"/>
      <rect x="40" y="36" width="22" height="9" rx="2" fill="url(#brassDim)"/>`,
  },
  "vaso-de-porcelana": {
    nominal: { w: 40, h: 88 },
    body: `
      <path d="M12 4 H28 V12 C28 18 38 26 38 46 C38 70 30 84 20 84 C10 84 2 70 2 46 C2 26 12 18 12 12 Z" fill="url(#porcelain)" stroke="#8a7f68" stroke-width="1.2"/>
      <ellipse cx="20" cy="4" rx="8" ry="2.4" fill="#6f6553"/>
      <path d="M8 40 C8 58 10 70 15 78" stroke="#ffffff" stroke-width="2.6" fill="none" opacity=".45"/>
      <path d="M6 50 H34" stroke="#7a8aa0" stroke-width="1.6" opacity=".55"/>`,
  },
  "rolo-de-papel": {
    nominal: { w: 26, h: 118 },
    body: `
      <rect x="3" y="6" width="20" height="110" rx="6" fill="url(#ivory)" stroke="#8a7a58" stroke-width="1.2"/>
      <ellipse cx="13" cy="7" rx="10" ry="4" fill="#e2d7bb" stroke="#8a7a58" stroke-width="1.1"/>
      <ellipse cx="13" cy="7" rx="4" ry="1.6" fill="#8a7a58"/>
      <rect x="3" y="58" width="20" height="6" fill="#8f3c2c" opacity=".8"/>`,
  },
};

// GAME03-CALIBRATION-02A (kit v2): eleven more, each the same shape or material as an object and another kind of thing.
Object.assign(LOOK_ART, {
  // hanging from the curtain rod by a chain, right of the arch: a wire basket — open, no door, no perch
  "cesta-de-arame": {
    nominal: { w: 52, h: 74 },
    body: `
      <path d="M26 0 V18" stroke="#3a2a14" stroke-width="2" stroke-dasharray="3 2"/>
      <path d="M6 44 C6 22 46 22 46 44" fill="none" stroke="url(#bronzeAged)" stroke-width="2.6"/>
      <g stroke="url(#bronzeAged)" stroke-width="1.6" fill="none"><path d="M26 20 C18 26 12 34 10 44 M26 20 V44 M26 20 C34 26 40 34 42 44"/></g>
      <path d="M6 44 C6 60 14 70 26 70 C38 70 46 60 46 44 Z" fill="#2a3b1e" stroke="url(#bronzeAged)" stroke-width="2"/>
      <g fill="url(#leaf)"><ellipse cx="16" cy="46" rx="9" ry="5" transform="rotate(-20 16 46)"/><ellipse cx="34" cy="44" rx="9" ry="5" transform="rotate(24 34 44)"/><ellipse cx="26" cy="40" rx="7" ry="4"/></g>
      <path d="M8 52 H44 M12 62 H40" stroke="url(#bronzeAged)" stroke-width="1.4" opacity=".9"/>`,
  },
  // carved into the wainscot panel left of the snail: a wooden spiral rosette
  "roseta-entalhada": {
    nominal: { w: 48, h: 48 },
    body: `
      <circle cx="24" cy="24" r="22" fill="#5c3a20" stroke="#2b170b" stroke-width="1.6"/>
      <circle cx="24" cy="24" r="17" fill="none" stroke="#a87242" stroke-width="1.4" opacity=".7"/>
      <path d="M24 24 a3 3 0 0 1 3 3 a6 6 0 0 1 -6 6 a9 9 0 0 1 -9 -9 a12 12 0 0 1 12 -12 a14 14 0 0 1 14 14" stroke="#2b170b" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M10 16 A16 16 0 0 1 22 8" stroke="#d29a62" stroke-width="2" fill="none" opacity=".5" stroke-linecap="round"/>`,
  },
  // dropped on the rug by the spinning top: an ivory pawn — round head, no stripes, it does not spin
  "peao-de-xadrez": {
    nominal: { w: 40, h: 64 },
    body: `
      <ellipse cx="20" cy="60" rx="17" ry="4" fill="#3a2a1c" opacity=".45"/>
      <path d="M5 58 C5 50 10 48 14 46 C14 36 16 28 17 24 H23 C24 28 26 36 26 46 C30 48 35 50 35 58 Z" fill="url(#ivory)" stroke="#8a7a58" stroke-width="1.4"/>
      <rect x="12" y="20" width="16" height="6" rx="2" fill="#e8ddc3" stroke="#8a7a58" stroke-width="1.1"/>
      <circle cx="20" cy="12" r="9" fill="url(#ivory)" stroke="#8a7a58" stroke-width="1.4"/>
      <path d="M15 8 A6 6 0 0 1 21 5" stroke="#ffffff" stroke-width="1.8" fill="none" opacity=".6"/>`,
  },
  // on top of the book pile left of the table: a brass medal on its ribbon, no hands
  medalha: {
    nominal: { w: 48, h: 42 },
    body: `
      <path d="M8 2 L20 2 L28 18 L22 22 Z" fill="#2d4a68" stroke="#1a2a3a" stroke-width="1"/>
      <path d="M40 2 L28 2 L20 18 L26 22 Z" fill="#7a3024" stroke="#3a140e" stroke-width="1"/>
      <circle cx="24" cy="28" r="13" fill="#5a3d16"/><circle cx="24" cy="27" r="13" fill="url(#brass)"/>
      <circle cx="24" cy="27" r="8.5" fill="none" stroke="#7a5521" stroke-width="1.4"/>
      <path d="M24 21 L25.8 25 L30 25.4 L26.8 28 L27.8 32 L24 29.8 L20.2 32 L21.2 28 L18 25.4 L22.2 25 Z" fill="#8d6a30"/>`,
  },
  // on the wall shelf, where a jar stood: a porcelain sugar bowl with its lid and two small handles
  acucareiro: {
    nominal: { w: 48, h: 52 },
    body: `
      <path d="M8 22 C8 44 16 50 24 50 C32 50 40 44 40 22 Z" fill="url(#porcelain)" stroke="#8a7f68" stroke-width="1.4"/>
      <path d="M8 26 C0 26 0 36 8 36 M40 26 C48 26 48 36 40 36" stroke="#d8d0c0" stroke-width="3.2" fill="none"/>
      <ellipse cx="24" cy="21" rx="17" ry="4" fill="#ece5d6" stroke="#8a7f68" stroke-width="1.2"/>
      <path d="M12 21 C12 12 36 12 36 21" fill="#f2ebdc" stroke="#8a7f68" stroke-width="1.2"/>
      <circle cx="24" cy="10" r="3.4" fill="#ece5d6" stroke="#8a7f68" stroke-width="1.1"/>
      <path d="M12 32 H36" stroke="#7a8aa0" stroke-width="1.6" opacity=".5"/>
      <path d="M13 26 C13 36 16 42 20 46" stroke="#ffffff" stroke-width="2" fill="none" opacity=".45"/>`,
  },
  // dropped on the rug in front of the table: a plain brass lid — no needle, no ring
  "tampa-de-pote": {
    nominal: { w: 56, h: 40 },
    body: `
      <ellipse cx="28" cy="24" rx="26" ry="13" fill="#4a3216"/>
      <ellipse cx="28" cy="20" rx="26" ry="13" fill="url(#brassDim)" stroke="#4a3216" stroke-width="1.4"/>
      <ellipse cx="28" cy="20" rx="17" ry="8" fill="none" stroke="#7a5521" stroke-width="1.4"/>
      <path d="M8 16 A20 10 0 0 1 26 9" stroke="#f3dc9c" stroke-width="2.4" fill="none" opacity=".55" stroke-linecap="round"/>`,
  },
  // on the map below the magnifier: navigation dividers — two thin legs on a hinge, no rings
  "compasso-de-pontas": {
    nominal: { w: 48, h: 34 },
    body: `
      <path d="M8 6 L44 22 L42 25 L7 10 Z" fill="url(#silver)" stroke="#4d4b47" stroke-width="1"/>
      <path d="M8 6 L40 31 L37 33 L6 10 Z" fill="url(#silver)" stroke="#4d4b47" stroke-width="1"/>
      <circle cx="8" cy="8" r="5" fill="url(#brassDim)" stroke="#3a2a12" stroke-width="1.1"/>`,
  },
  // on the books at the shelf's right end: a carved wooden pineapple — a crown of leaves, no loose scales
  "abacaxi-de-madeira": {
    nominal: { w: 36, h: 56 },
    body: `
      <path d="M18 22 L10 2 L16 12 L18 0 L20 12 L26 2 Z" fill="#4f6a32" stroke="#2c3a1c" stroke-width="1"/>
      <ellipse cx="18" cy="38" rx="14" ry="17" fill="url(#woodH)" stroke="#3a2010" stroke-width="1.4"/>
      <path d="M7 30 L29 46 M7 40 L23 54 M11 24 L29 36 M29 30 L7 46 M29 40 L13 54 M25 24 L7 36" stroke="#3a2010" stroke-width="1.1" opacity=".7"/>`,
  },
  // on the second crate at the foot of the bookcase: a matchbox, its drawer half out — no holes
  "caixa-de-fosforos": {
    nominal: { w: 60, h: 40 },
    body: `
      <path d="M4 14 L48 8 L58 14 L14 20 Z" fill="#c9b48a" stroke="#6e5a3a" stroke-width="1.2"/>
      <path d="M14 20 L58 14 L58 34 L14 40 Z" fill="#7e4a30" stroke="#4a2414" stroke-width="1.3"/>
      <path d="M4 14 L14 20 L14 40 L4 34 Z" fill="#6b4a2a" stroke="#3a2010" stroke-width="1.1"/>
      <rect x="24" y="22" width="22" height="10" fill="#e8d9b4" transform="skewY(-7.8)" opacity=".85"/>
      <path d="M2 30 L-6 31 L-6 38 L4 37" fill="#d8c69e" stroke="#6e5a3a" stroke-width="1"/>`,
  },
  // on the rolled maps at the bookcase's foot: a leather spectacle case, shut — no reed holes
  "estojo-de-oculos": {
    nominal: { w: 70, h: 36 },
    body: `
      <rect x="2" y="6" width="66" height="26" rx="12" fill="url(#leatherDark)" stroke="#0f0c09" stroke-width="1.4"/>
      <path d="M6 19 H64" stroke="url(#brassDim)" stroke-width="1.6" opacity=".9"/>
      <path d="M10 10 C24 8 46 8 60 10" stroke="#8a7a62" stroke-width="1.6" fill="none" opacity=".5"/>
      <circle cx="35" cy="19" r="2.6" fill="url(#brassDim)"/>`,
  },
});

function lookSvg(id) {
  const art = LOOK_ART[id];
  if (!art) throw new Error(`no art for look-alike ${id}`);
  return fit(art.body, art.nominal, boxOf(LOOKS[id].region));
}

// --- the window view (back layer) ----------------------------------------------------------------

function backSvg() {
  const r = LAYER.back.rect;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r.w}" height="${r.h}" viewBox="${r.x} ${r.y} ${r.w} ${r.h}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6f97b6"/><stop offset=".38" stop-color="#cdb59c"/><stop offset=".66" stop-color="#f3c88e"/><stop offset="1" stop-color="#ffd59a"/>
    </linearGradient>
    <radialGradient id="sun" cx=".2" cy=".47" r=".62">
      <stop offset="0" stop-color="#fff6d8" stop-opacity="1"/><stop offset=".12" stop-color="#ffe7b0" stop-opacity=".8"/><stop offset=".4" stop-color="#ffcf88" stop-opacity=".32"/><stop offset="1" stop-color="#ffcf88" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="lake" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ecc996"/><stop offset=".22" stop-color="#9fb4b8"/><stop offset="1" stop-color="#4f7488"/>
    </linearGradient>
    <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffe2b0" stop-opacity="0"/><stop offset="1" stop-color="#ffe2b0" stop-opacity=".55"/>
    </linearGradient>
    <filter id="far"><feGaussianBlur stdDeviation="2.2"/></filter>
    <filter id="mid"><feGaussianBlur stdDeviation="1.1"/></filter>
    <filter id="cloud" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="9"/></filter>
  </defs>
  <rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="url(#sky)"/>
  <g filter="url(#cloud)" opacity=".75">
    <ellipse cx="520" cy="300" rx="190" ry="26" fill="#f6e2c8"/><ellipse cx="820" cy="380" rx="160" ry="20" fill="#f3d6b4"/><ellipse cx="330" cy="420" rx="120" ry="16" fill="#fbe7c6"/>
  </g>
  <rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="url(#sun)"/>
  <g filter="url(#far)" opacity=".85">
    <path d="M160 640 L240 560 L300 590 L380 470 L450 540 L520 500 L600 420 L690 520 L760 470 L840 560 L920 500 L1000 570 L1080 530 L1080 700 L160 700 Z" fill="#a7a4bd"/>
    <path d="M380 470 L410 500 L392 498 Z M600 420 L630 452 L610 450 Z M760 470 L780 492 L766 490 Z" fill="#f4ecdc" opacity=".85"/>
  </g>
  <rect x="160" y="560" width="920" height="160" fill="url(#haze)"/>
  <g filter="url(#mid)">
    <path d="M160 690 L260 620 L340 650 L430 600 L520 640 L600 590 L700 650 L800 610 L900 660 L1000 620 L1080 660 L1080 730 L160 730 Z" fill="#878ca4"/>
    <path d="M160 728 L300 690 L420 712 L560 680 L700 716 L860 690 L1080 712 L1080 760 L160 760 Z" fill="#6c7d70"/>
  </g>
  <rect x="160" y="752" width="920" height="300" fill="url(#lake)"/>
  <rect x="200" y="752" width="300" height="300" fill="#fff0cc" opacity=".22" filter="url(#cloud)"/>
  <g stroke="#fff3d6" stroke-linecap="round" opacity=".65">
    <path d="M230 800 H330 M260 830 H400 M220 870 H360 M420 830 H520 M600 790 H660 M700 860 H800 M360 900 H430 M540 930 H640 M820 820 H880" stroke-width="4"/>
  </g>
  <g>
    <path d="M640 760 L1080 742 L1080 790 L640 792 Z" fill="#57685a"/>
    <g fill="#e6cda2" stroke="#6e5a40" stroke-width="1.6">
      <rect x="700" y="706" width="34" height="40"/><rect x="742" y="712" width="40" height="34"/><rect x="842" y="700" width="30" height="46"/>
      <rect x="880" y="714" width="44" height="32"/><rect x="934" y="704" width="34" height="42"/><rect x="976" y="716" width="40" height="30"/>
    </g>
    <g fill="#ac573a"><path d="M696 708 L717 688 L738 708 Z M738 714 L762 694 L786 714 Z M838 702 L857 682 L876 702 Z M876 716 L902 696 L928 716 Z M930 706 L951 686 L972 706 Z M972 718 L996 698 L1020 718 Z"/></g>
    <g fill="#ffd27a" opacity=".85"><rect x="710" y="720" width="7" height="9"/><rect x="756" y="724" width="7" height="8"/><rect x="852" y="716" width="6" height="9"/><rect x="894" y="726" width="7" height="8"/><rect x="946" y="718" width="6" height="9"/><rect x="990" y="728" width="7" height="8"/></g>
    <rect x="796" y="630" width="30" height="116" fill="#ecdcbc" stroke="#6e5a40" stroke-width="1.6"/>
    <path d="M792 632 L811 584 L830 632 Z" fill="#9a4c33"/>
    <rect x="804" y="652" width="14" height="18" rx="7" fill="#5c4632"/>
    <g fill="#e6cda2" opacity=".5"><rect x="702" y="772" width="30" height="10"/><rect x="842" y="772" width="28" height="12"/><rect x="934" y="774" width="32" height="10"/></g>
  </g>
  <path d="M160 1000 C260 960 340 990 420 970 C520 948 600 990 700 975 C800 960 900 990 1080 965 L1080 1090 L160 1090 Z" fill="#3c553a"/>
  <g fill="#2c4630">
    <ellipse cx="230" cy="985" rx="60" ry="40"/><ellipse cx="330" cy="1000" rx="70" ry="44"/><ellipse cx="980" cy="980" rx="80" ry="46"/><ellipse cx="1060" cy="1000" rx="60" ry="40"/>
  </g>
  <rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="#ffcf8f" opacity=".07"/>
</svg>`;
}

// --- the room (plate) ---------------------------------------------------------------------------

const WINDOW = { cx: 620, archY: 520, rOuter: 320, rInner: 294, left: 300, right: 940, innerLeft: 326, innerRight: 914, bottom: 1000 };
const FLOOR_Y = 1190;

function windowHolePath() {
  const { archY, rInner, innerLeft, innerRight, bottom } = WINDOW;
  return `M${innerLeft} ${bottom} V${archY} A${rInner} ${rInner} 0 0 1 ${innerRight} ${archY} V${bottom} Z`;
}

const BOOK_COLORS = ["#7a3024", "#2d4a68", "#4a6a3a", "#86582b", "#5a3b5c", "#9c7230", "#2f5d58", "#683040", "#3c3833", "#94482a", "#bba57c", "#365169", "#6d5a3a", "#4f2d24"];

function book(x, y, w, h, color, { band = "#cfa95f", tilt = 0, pivot = "bottom" } = {}) {
  const px = x + w / 2;
  const py = pivot === "bottom" ? y + h : y;
  const t = tilt ? ` transform="rotate(${tilt} ${n(px)} ${n(py)})"` : "";
  const b1 = Math.max(3, h * 0.035);
  return `<g${t}><rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="2" fill="${color}" stroke="#20130a" stroke-width="1.1" stroke-opacity=".8"/>
    <rect x="${n(x)}" y="${n(y + h * 0.12)}" width="${n(w)}" height="${n(b1)}" fill="${band}" opacity=".78"/>
    <rect x="${n(x)}" y="${n(y + h * 0.16 + b1)}" width="${n(w)}" height="${n(b1 * 0.6)}" fill="${band}" opacity=".5"/>
    <rect x="${n(x)}" y="${n(y + h * 0.82)}" width="${n(w)}" height="${n(b1)}" fill="${band}" opacity=".62"/>
    <rect x="${n(x + w * 0.3)}" y="${n(y + h * 0.36)}" width="${n(w * 0.4)}" height="${n(h * 0.22)}" rx="1" fill="#000000" opacity=".16"/>
    <rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="2" fill="url(#spineShade)"/></g>`;
}

/** A run of standing books from x0 along a shelf whose top surface is at `floor`. */
function bookRun(x0, floor, count, seed, { minH = 120, maxH = 190, minW = 18, maxW = 34, gap = 1.5, colors = BOOK_COLORS } = {}) {
  let x = x0;
  let out = "";
  const rnd = rng(seed);
  for (let i = 0; i < count; i += 1) {
    const w = Math.round(minW + rnd() * (maxW - minW));
    const h = Math.round(minH + rnd() * (maxH - minH));
    out += book(x, floor - h, w, h, colors[Math.floor(rnd() * colors.length)]);
    x += w + gap;
  }
  return { svg: out, end: x };
}

function bookStack(x, floor, specs) {
  let y = floor;
  let out = "";
  for (const [w, h, color, dx = 0] of specs) {
    y -= h;
    out += `<rect x="${n(x + dx)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" rx="3" fill="${color}" stroke="#20130a" stroke-width="1.1" stroke-opacity=".8"/>
      <rect x="${n(x + dx + 4)}" y="${n(y + 3)}" width="${n(w - 8)}" height="${n(Math.max(2, h * 0.25))}" fill="#efdfba" opacity=".5"/>
      <rect x="${n(x + dx)}" y="${n(y + h - 3)}" width="${n(w)}" height="3" fill="#000" opacity=".25"/>`;
  }
  return out;
}

function plant(cx, baseY, scale = 1, { pot = "url(#terracotta)", leaves = "url(#leaf)" } = {}) {
  const s = scale;
  const leaf = (angle, len, wid) =>
    `<path transform="rotate(${angle} ${n(cx)} ${n(baseY - 50 * s)})" d="M${n(cx)} ${n(baseY - 50 * s)} C${n(cx - wid * s)} ${n(baseY - 50 * s - len * 0.5 * s)} ${n(cx - wid * 0.4 * s)} ${n(baseY - 50 * s - len * s)} ${n(cx)} ${n(baseY - 50 * s - len * s)} C${n(cx + wid * 0.4 * s)} ${n(baseY - 50 * s - len * s)} ${n(cx + wid * s)} ${n(baseY - 50 * s - len * 0.5 * s)} ${n(cx)} ${n(baseY - 50 * s)} Z" fill="${leaves}" stroke="#1f3a1c" stroke-width="1" stroke-opacity=".7"/>`;
  return `${shadow(cx, baseY, 40 * s, 8 * s, 0.8)}
    ${leaf(-62, 70, 18)}${leaf(-30, 86, 20)}${leaf(0, 96, 22)}${leaf(28, 84, 20)}${leaf(58, 70, 18)}${leaf(-10, 60, 14)}${leaf(14, 64, 15)}
    <path d="M${n(cx - 30 * s)} ${n(baseY - 50 * s)} H${n(cx + 30 * s)} L${n(cx + 24 * s)} ${n(baseY)} H${n(cx - 24 * s)} Z" fill="${pot}" stroke="#4a2410" stroke-width="1.2"/>
    <rect x="${n(cx - 33 * s)}" y="${n(baseY - 56 * s)}" width="${n(66 * s)}" height="${n(10 * s)}" rx="3" fill="#bb6a3d" stroke="#4a2410" stroke-width="1"/>`;
}

function trailingPlant(cx, baseY, scale = 1, { pot = true } = {}) {
  const s = scale;
  let vines = "";
  const strands = [[-26, 120], [-8, 160], [12, 140], [30, 100]];
  for (const [dx, len] of strands) {
    vines += `<path d="M${n(cx + dx * s)} ${n(baseY - 40 * s)} C${n(cx + dx * 1.6 * s)} ${n(baseY + len * 0.3 * s)} ${n(cx + dx * 0.6 * s)} ${n(baseY + len * 0.7 * s)} ${n(cx + dx * 1.2 * s)} ${n(baseY + len * s)}" stroke="#355c2e" stroke-width="${n(3 * s)}" fill="none"/>`;
    for (let i = 0; i < 6; i += 1) {
      const t = i / 6;
      const y = baseY - 40 * s + (len + 40) * t * s;
      const x = cx + dx * (1 + 0.6 * Math.sin(t * 3)) * s;
      vines += `<ellipse cx="${n(x + (i % 2 ? 9 : -9) * s)}" cy="${n(y)}" rx="${n(10 * s)}" ry="${n(6 * s)}" fill="${i % 3 ? "url(#leaf)" : "url(#leafDark)"}" transform="rotate(${i % 2 ? 30 : -30} ${n(x)} ${n(y)})"/>`;
    }
  }
  const potSvg = pot
    ? `<path d="M${n(cx - 34 * s)} ${n(baseY - 46 * s)} H${n(cx + 34 * s)} L${n(cx + 28 * s)} ${n(baseY)} H${n(cx - 28 * s)} Z" fill="url(#terracotta)" stroke="#4a2410" stroke-width="1.2"/>
       <ellipse cx="${n(cx)}" cy="${n(baseY - 46 * s)}" rx="${n(34 * s)}" ry="${n(7 * s)}" fill="#3a2414"/>`
    : "";
  return `${vines}${potSvg}
    <g fill="url(#leaf)"><ellipse cx="${n(cx - 14 * s)}" cy="${n(baseY - 54 * s)}" rx="${n(16 * s)}" ry="${n(9 * s)}"/><ellipse cx="${n(cx + 12 * s)}" cy="${n(baseY - 58 * s)}" rx="${n(15 * s)}" ry="${n(9 * s)}"/><ellipse cx="${n(cx)}" cy="${n(baseY - 66 * s)}" rx="${n(13 * s)}" ry="${n(8 * s)}"/></g>`;
}

function frame(x, y, w, h, inner) {
  return `${frameShadow(x, y, w, h)}${frameBody(x, y, w, h, inner)}`;
}

/** What a frame casts on the wall (scenery even when the frame is in the pool). */
function frameShadow(x, y, w, h) {
  return `${shadow(x + w / 2 + 12, y + h + 8, w * 0.5, 10, 0.55)}
    <rect x="${x - 6}" y="${y + 8}" width="${w + 12}" height="${h + 8}" fill="#0a0603" opacity=".35" filter="url(#blur8)"/>`;
}

function frameBody(x, y, w, h, inner) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="url(#brass)" stroke="#5a3d16" stroke-width="1.6"/>
    <rect x="${x + 5}" y="${y + 5}" width="${w - 10}" height="${h - 10}" fill="none" stroke="#f3dc9c" stroke-width="1.6" opacity=".55"/>
    <rect x="${x + 14}" y="${y + 14}" width="${w - 28}" height="${h - 28}" fill="#3a2a18"/>
    <svg x="${x + 18}" y="${y + 18}" width="${w - 36}" height="${h - 36}" viewBox="0 0 100 ${n((100 * (h - 36)) / (w - 36))}" preserveAspectRatio="none">${inner}</svg>
    <rect x="${x + 14}" y="${y + 14}" width="${w - 28}" height="${h - 28}" fill="none" stroke="#1a1008" stroke-width="3" opacity=".5"/>`;
}

const PAINTING_LAKE = `
  <rect width="100" height="200" fill="#e3c38f"/>
  <rect width="100" height="42" fill="#aebec2"/>
  <ellipse cx="78" cy="20" rx="14" ry="10" fill="#fff0c4" opacity=".55"/>
  <path d="M0 46 L18 30 L30 38 L46 22 L62 36 L78 26 L100 40 L100 56 L0 56 Z" fill="#7a839c"/>
  <path d="M0 52 L22 40 L40 48 L58 38 L80 48 L100 44 L100 58 L0 58 Z" fill="#69737d" opacity=".8"/>
  <rect y="54" width="100" height="22" fill="#6a93a3"/>
  <path d="M8 62 H30 M44 66 H70 M76 60 H94" stroke="#e8e0c8" stroke-width="1" opacity=".7"/>
  <path d="M0 74 C30 66 60 80 100 70 L100 100 L0 100 Z" fill="#4c6740"/>
  <circle cx="78" cy="18" r="6" fill="#fff0c4" opacity=".9"/>`;

const PAINTING_MAP = `
  <rect width="100" height="200" fill="#e6d2a3"/>
  <path d="M8 30 C20 16 40 20 46 32 C54 46 36 58 22 54 C12 50 4 42 8 30 Z" fill="#c4a76d" stroke="#7a5a33" stroke-width="1"/>
  <path d="M56 50 C68 36 90 40 94 56 C98 72 84 84 70 80 C58 76 50 64 56 50 Z" fill="#c4a76d" stroke="#7a5a33" stroke-width="1"/>
  <path d="M30 70 C44 66 52 80 46 88 C40 94 28 90 26 82" fill="#c4a76d" stroke="#7a5a33" stroke-width="1"/>
  <path d="M46 34 C56 40 54 48 60 52" stroke="#9c4a2b" stroke-width="1.2" stroke-dasharray="3 2" fill="none"/>
  <path d="M0 12 H100 M0 88 H100 M14 0 V100 M86 0 V100" stroke="#a88b5c" stroke-width=".6" opacity=".6"/>
  <g transform="translate(84 18)"><circle r="7" fill="none" stroke="#7a5a33" stroke-width=".8"/><path d="M0 -9 L2 0 L0 9 L-2 0 Z" fill="#7a5a33"/></g>`;

const PAINTING_BUTTERFLY = `
  <rect width="100" height="200" fill="#e9dcc0"/>
  <g transform="translate(50 62)">
    <path d="M0 -4 C-14 -34 -44 -36 -42 -12 C-40 6 -16 6 0 2 Z" fill="#c8743a" stroke="#5a3418" stroke-width="1.2"/>
    <path d="M0 -4 C14 -34 44 -36 42 -12 C40 6 16 6 0 2 Z" fill="#c8743a" stroke="#5a3418" stroke-width="1.2"/>
    <path d="M0 2 C-12 8 -32 18 -24 32 C-16 42 -4 22 0 8 Z" fill="#2f6a62" stroke="#5a3418" stroke-width="1.2"/>
    <path d="M0 2 C12 8 32 18 24 32 C16 42 4 22 0 8 Z" fill="#2f6a62" stroke="#5a3418" stroke-width="1.2"/>
    <g fill="#f3e3bd" opacity=".8"><circle cx="-26" cy="-16" r="4"/><circle cx="26" cy="-16" r="4"/></g>
    <rect x="-2" y="-10" width="4" height="34" rx="2" fill="#3a2010"/>
  </g>`;

const PAINTING_LEAF = `
  <rect width="100" height="200" fill="#ebdfc2"/>
  <path d="M50 92 C50 70 50 40 52 12" stroke="#5b6b3a" stroke-width="2" fill="none"/>
  <path d="M52 20 C30 24 22 44 50 50 C78 44 72 24 52 20 Z" fill="#7a965a" opacity=".85"/>
  <path d="M50 52 C28 56 22 76 50 82 C76 76 70 56 50 52 Z" fill="#6c894e" opacity=".85"/>
  <path d="M50 26 V46 M50 58 V78" stroke="#4d5e32" stroke-width=".8" opacity=".8"/>`;

// GAME03-CALIBRATION-02A: the framed pressed leaf on the wall (scenery since the skeleton, now named): a leaf, no wings.
LOOK_ART["folha-emoldurada"] = {
  nominal: { w: 116, h: 140 },
  body: `<g transform="translate(-1950 -590)">${frameBody(1950, 590, 116, 140, PAINTING_LEAF)}</g>`,
};

function wall() {
  return `
    <g filter="url(#plaster)">
      <path fill-rule="evenodd" d="M0 0 H${W} V1190 H0 Z ${windowHolePath()}" fill="#27413c"/>
      <path fill-rule="evenodd" d="M0 0 H${W} V1190 H0 Z ${windowHolePath()}" fill="url(#wallLight)"/>
    </g>
    <g opacity=".18" stroke="#0f201d" stroke-width="2">${Array.from({ length: 16 }, (_, i) => `<path d="M${200 + i * 190} 140 V860"/>`).join("")}</g>
    <g filter="url(#grainH)">
      <rect x="0" y="860" width="${W}" height="26" fill="url(#woodV)"/>
      <rect x="0" y="886" width="${W}" height="290" fill="#3b2415"/>
    </g>
    <rect x="0" y="858" width="${W}" height="4" fill="#d09a64" opacity=".35"/>
    <g fill="none" stroke="#150b05" stroke-width="3" opacity=".55">${Array.from({ length: 14 }, (_, i) => `<rect x="${20 + i * 230}" y="912" width="200" height="236" rx="4"/>`).join("")}</g>
    <g fill="none" stroke="#8a5d3a" stroke-width="2" opacity=".3">${Array.from({ length: 14 }, (_, i) => `<path d="M${24 + i * 230} 1140 V916 H${216 + i * 230}"/>`).join("")}</g>
    ${occlusion(0, 884, W, 16, 0.35)}
    <g filter="url(#grainH)">
      <rect x="0" y="0" width="${W}" height="118" fill="#22140a"/>
      <g fill="url(#woodDark)">${Array.from({ length: 9 }, (_, i) => `<rect x="${i * 400 - 20}" y="0" width="70" height="132"/>`).join("")}</g>
      <rect x="0" y="104" width="${W}" height="34" fill="url(#woodV)"/>
    </g>
    <rect x="0" y="136" width="${W}" height="3" fill="#d09a64" opacity=".25"/>
    ${occlusion(0, 136, W, 22, 0.45)}`;
}

function windowSvg() {
  const { cx, archY, rOuter, rInner, left, right, innerLeft, innerRight, bottom } = WINDOW;
  const frameD = `M${left} ${bottom + 6} V${archY} A${rOuter} ${rOuter} 0 0 1 ${right} ${archY} V${bottom + 6} H${innerRight} V${archY} A${rInner} ${rInner} 0 0 0 ${innerLeft} ${archY} V${bottom + 6} Z`;
  const pane = (d, o = 0.07) => `<path d="${d}" fill="#ffffff" opacity="${o}"/>`;
  return `
    <path d="M${left - 18} ${bottom + 10} V${archY} A${rOuter + 18} ${rOuter + 18} 0 0 1 ${right + 18} ${archY} V${bottom + 10}" fill="none" stroke="#0a0603" stroke-width="22" opacity=".25" filter="url(#blur8)"/>
    <path d="${frameD}" fill="url(#woodH)" stroke="#3a2010" stroke-width="2.4" filter="url(#grainV)"/>
    <path d="M${innerLeft} ${archY} A${rInner} ${rInner} 0 0 1 ${innerRight} ${archY}" fill="none" stroke="#d29a62" stroke-width="5" opacity=".55"/>
    <path d="M${left + 6} ${bottom} V${archY} A${rOuter - 6} ${rOuter - 6} 0 0 1 ${cx} ${archY - rOuter + 6}" fill="none" stroke="#f0c088" stroke-width="3" opacity=".35"/>
    <rect x="${cx - 9}" y="${archY - rInner}" width="18" height="${bottom - archY + rInner}" fill="url(#woodH)" stroke="#3a2010" stroke-width="1.6"/>
    <rect x="${innerLeft}" y="${archY - 8}" width="${innerRight - innerLeft}" height="16" fill="url(#woodV)" stroke="#3a2010" stroke-width="1.6"/>
    <rect x="${innerLeft}" y="752" width="${innerRight - innerLeft}" height="14" fill="url(#woodV)" stroke="#3a2010" stroke-width="1.6"/>
    <path d="M${cx} ${archY} L${n(cx - rInner * 0.7071)} ${n(archY - rInner * 0.7071)} M${cx} ${archY} L${n(cx + rInner * 0.7071)} ${n(archY - rInner * 0.7071)}" stroke="#5a3418" stroke-width="11"/>
    ${pane(`M${innerLeft + 20} ${archY + 30} L${innerLeft + 90} ${archY + 30} L${innerLeft + 30} ${archY + 220} L${innerLeft + 10} ${archY + 220} Z`)}
    ${pane(`M${cx + 30} 790 L${cx + 110} 790 L${cx + 50} 990 L${cx + 20} 990 Z`)}
    ${pane(`M${innerLeft + 40} 300 L${innerLeft + 70} 290 L${innerLeft + 30} 380 Z`, 0.05)}
    <g filter="url(#grainH)">
      <rect x="${left - 22}" y="${bottom}" width="${right - left + 44}" height="18" rx="3" fill="#a9734a" stroke="#3a2010" stroke-width="1.6"/>
      <rect x="${left - 22}" y="${bottom + 18}" width="${right - left + 44}" height="30" fill="url(#woodV)" stroke="#3a2010" stroke-width="1.6"/>
    </g>
    <rect x="${left - 22}" y="${bottom}" width="${right - left + 44}" height="3" fill="#f3c98f" opacity=".5"/>
    ${occlusion(left - 22, bottom + 44, right - left + 44, 16, 0.5)}
    <path d="M${left + 10} ${bottom + 48} h40 l-20 26 Z M${right - 50} ${bottom + 48} h40 l-20 26 Z" fill="#4a2a16"/>`;
}

function curtain() {
  return `
    <rect x="20" y="150" width="1000" height="14" rx="7" fill="url(#brassV)"/>
    <circle cx="20" cy="157" r="16" fill="url(#brass)"/><circle cx="1020" cy="157" r="16" fill="url(#brass)"/>
    <g filter="url(#weave)">
      <path d="M30 164 C70 400 40 700 70 760 C40 860 20 1050 30 1190 L260 1190 C250 1060 240 880 210 770 C250 690 300 420 330 164 Z" fill="url(#velvet)"/>
    </g>
    <path d="M30 164 C70 400 40 700 70 760 C40 860 20 1050 30 1190 L260 1190 C250 1060 240 880 210 770 C250 690 300 420 330 164 Z" fill="none" stroke="#0d1c19" stroke-width="1.6"/>
    <path d="M90 180 C110 420 90 650 110 760 M150 180 C170 400 160 640 160 770 M220 190 C240 420 230 650 200 770" stroke="#0d1c19" stroke-width="7" opacity=".4" fill="none" filter="url(#blur3)"/>
    <path d="M120 180 C140 420 124 650 136 760 M188 190 C204 420 198 650 182 770" stroke="#6fa392" stroke-width="5" opacity=".22" fill="none" filter="url(#blur3)"/>
    <path d="M80 790 C80 920 70 1060 76 1180 M140 790 C150 940 150 1060 150 1180 M200 790 C210 920 214 1060 220 1180" stroke="#0d1c19" stroke-width="7" opacity=".38" fill="none" filter="url(#blur3)"/>
    <path d="M44 750 C110 790 190 790 228 752 L232 772 C190 812 110 812 46 772 Z" fill="url(#brassV)" stroke="#5a3d16" stroke-width="1.4"/>`;
}

function armchair() {
  return `
    ${shadow(220, 1390, 240, 40)}
    <g filter="url(#weave)">
      <path d="M40 900 C40 830 120 820 200 822 C290 824 370 836 370 900 L372 1080 L42 1080 Z" fill="url(#leather)"/>
      <path d="M20 1000 C20 960 60 950 90 960 L100 1260 L30 1260 Z" fill="url(#leather)"/>
      <path d="M330 960 C360 950 400 960 400 1000 L392 1260 L322 1260 Z" fill="url(#leather)"/>
      <path d="M86 1060 C150 1040 270 1040 330 1060 L334 1150 L84 1150 Z" fill="#2b4b38"/>
      <path d="M60 1150 H366 L360 1290 H66 Z" fill="url(#leather)"/>
    </g>
    <g fill="none" stroke="#0e1f17" stroke-width="2"><path d="M40 900 C40 830 120 820 200 822 C290 824 370 836 370 900 L372 1080 L42 1080 Z M20 1000 C20 960 60 950 90 960 L100 1260 L30 1260 Z M330 960 C360 950 400 960 400 1000 L392 1260 L322 1260 Z M60 1150 H366 L360 1290 H66 Z"/></g>
    <path d="M70 880 C130 850 280 852 340 884" stroke="#8fbf9b" stroke-width="5" fill="none" opacity=".45"/>
    <path d="M28 1000 C30 975 52 966 80 968" stroke="#8fbf9b" stroke-width="4" fill="none" opacity=".45"/>
    <g fill="#0e1f17" opacity=".55"><circle cx="110" cy="920" r="4"/><circle cx="170" cy="910" r="4"/><circle cx="230" cy="910" r="4"/><circle cx="290" cy="920" r="4"/><circle cx="140" cy="980" r="4"/><circle cx="200" cy="972" r="4"/><circle cx="260" cy="980" r="4"/></g>
    ${occlusion(84, 1146, 280, 12, 0.5)}
    <path d="M70 1290 L80 1360 H100 L104 1290 M324 1290 L330 1360 H350 L356 1290" fill="#2b170b"/>
    ${blanket()}`;
}

/** A kilim throw over the armchair's back and arm: bands, lozenges, fringe. */
function blanket() {
  const outline = "M150 818 C210 812 300 818 352 846 C368 900 372 960 376 1010 C360 1030 340 1040 318 1046 C300 990 280 930 236 900 C200 878 160 870 128 868 C126 850 134 828 150 818 Z";
  let bands = "";
  for (let i = 0; i < 6; i += 1) {
    const t = i / 6;
    bands += `<path d="M${n(150 + t * 10)} ${n(838 + t * 30)} C${n(210 + t * 30)} ${n(836 + t * 40)} ${n(300 + t * 20)} ${n(842 + t * 60)} ${n(352 + t * 8)} ${n(866 + t * 150)}" stroke="${i % 2 ? "#cf9f55" : "#2f5d58"}" stroke-width="${i % 2 ? 6 : 10}" fill="none" opacity=".9"/>`;
  }
  let lozenges = "";
  for (let i = 0; i < 4; i += 1) {
    const x = 196 + i * 40;
    const y = 852 + i * 22;
    lozenges += `<path d="M${x} ${y - 12} L${x + 10} ${y} L${x} ${y + 12} L${x - 10} ${y} Z" fill="#ecdcb5" opacity=".8"/>`;
  }
  let fringe = "";
  for (let i = 0; i < 9; i += 1) {
    const x = 324 + i * 6;
    const y = 1044 - i * 4;
    fringe += `<path d="M${x} ${y} l-3 16" stroke="#e0cfa4" stroke-width="2.5" stroke-linecap="round"/>`;
  }
  return `<clipPath id="blanketClip"><path d="${outline}"/></clipPath>
    <g filter="url(#weave)"><path d="${outline}" fill="url(#kilim)"/><g clip-path="url(#blanketClip)">${bands}${lozenges}</g></g>
    <path d="${outline}" fill="none" stroke="#3a140e" stroke-width="2"/>
    <path d="M236 900 C280 930 300 990 318 1046" stroke="#2b0d08" stroke-width="5" fill="none" opacity=".45" filter="url(#blur3)"/>
    ${fringe}`;
}

function sideTable() {
  return `
    ${shadow(800, 1430, 130, 18)}
    <path d="M790 1190 C786 1260 796 1330 788 1400 L812 1400 C804 1330 814 1260 810 1190 Z" fill="url(#woodH)" filter="url(#grainV)"/>
    <ellipse cx="800" cy="1250" rx="16" ry="8" fill="#8a5a32"/>
    <path d="M790 1396 L730 1430 M810 1396 L870 1430 M800 1398 L800 1438" stroke="#4a2a16" stroke-width="10" stroke-linecap="round"/>
    <ellipse cx="800" cy="1192" rx="118" ry="28" fill="#4a2a16"/>
    <ellipse cx="800" cy="1184" rx="118" ry="28" fill="url(#wood)" stroke="#3a2010" stroke-width="1.6" filter="url(#grainH)"/>
    <ellipse cx="780" cy="1178" rx="70" ry="12" fill="#ffffff" opacity=".07"/>`;
}

function trunk() {
  return `
    ${shadow(560, 1474, 186, 22)}
    <g filter="url(#grainH)">
      <path d="M420 1290 H700 V1462 H420 Z" fill="url(#woodDark)"/>
      <path d="M418 1290 C418 1246 702 1246 702 1290 Z" fill="#553520"/>
    </g>
    <path d="M420 1290 H700 V1462 H420 Z M418 1290 C418 1246 702 1246 702 1290 Z" fill="none" stroke="#1c0f07" stroke-width="2.4"/>
    <path d="M430 1272 C470 1256 650 1256 690 1272" stroke="#7a5233" stroke-width="5" fill="none" opacity=".6"/>
    <g fill="url(#brassDim)" stroke="#4a3216" stroke-width="1.2">
      <rect x="418" y="1290" width="284" height="14"/><rect x="418" y="1440" width="284" height="14"/>
      <rect x="418" y="1290" width="18" height="172"/><rect x="684" y="1290" width="18" height="172"/>
    </g>
    <g fill="#e6c27a" opacity=".55"><circle cx="427" cy="1310" r="2.6"/><circle cx="427" cy="1340" r="2.6"/><circle cx="427" cy="1370" r="2.6"/><circle cx="427" cy="1400" r="2.6"/><circle cx="693" cy="1310" r="2.6"/><circle cx="693" cy="1340" r="2.6"/><circle cx="693" cy="1370" r="2.6"/><circle cx="693" cy="1400" r="2.6"/></g>
    <rect x="540" y="1318" width="40" height="46" rx="5" fill="url(#brassDim)" stroke="#4a3216" stroke-width="1.6"/>
    <circle cx="560" cy="1336" r="5" fill="#2a1a0c"/><path d="M558 1339 L556 1352 H564 L562 1339 Z" fill="#2a1a0c"/>`;
}

/**
 * The trunk's two leather straps, painted after the key: the key lies on the lid
 * tucked under the left strap (tier C — bow and bit stay in view).
 */
function trunkStraps() {
  return [500, 620]
    .map(
      (x) => `<path d="M${x - 9} 1254 C${x - 11} 1300 ${x - 9} 1400 ${x - 8} 1458 L${x + 8} 1458 C${x + 9} 1400 ${x + 11} 1300 ${x + 9} 1254 Z" fill="#6f3e25" stroke="#3a1c0e" stroke-width="1.6"/>
      <path d="M${x} 1260 V1452" stroke="#b9824f" stroke-width="2" stroke-dasharray="6 7" opacity=".5"/>`,
    )
    .join("");
}

/** A folded letter with a wax seal on the lid: paper and red, nothing like a key. */
function trunkLetter() {
  return `<g transform="rotate(-6 650 1296)">${shadow(650, 1300, 34, 5, 0.6)}
    <path d="M618 1282 H684 V1306 H618 Z" fill="url(#parchment)" stroke="#8a6a3c" stroke-width="1.2"/>
    <path d="M618 1282 L651 1298 L684 1282" fill="none" stroke="#8a6a3c" stroke-width="1.2"/>
    <circle cx="651" cy="1298" r="5" fill="#8f2c22"/></g>`;
}

function sillItems() {
  const y = WINDOW.bottom;
  return `
    ${plant(352, y, 0.78)}
    <g>${shadow(745, y + 2, 30, 6)}<ellipse cx="732" cy="${y - 10}" rx="17" ry="11" fill="#968e82"/><ellipse cx="756" cy="${y - 7}" rx="13" ry="9" fill="#b2a99b"/><ellipse cx="742" cy="${y - 20}" rx="10" ry="8" fill="#7f776c"/></g>
    <g>${shadow(806, y + 2, 26, 5)}<path d="M782 ${y} C782 ${y - 22} 830 ${y - 22} 830 ${y} Z" fill="url(#brassDim)" stroke="#4a3216" stroke-width="1.2"/><ellipse cx="806" cy="${y - 11}" rx="24" ry="4" fill="#6e4b1c"/></g>
    <g>${shadow(872, y + 2, 18, 5)}<path d="M862 ${y} V${y - 46} C862 ${y - 60} 884 ${y - 60} 884 ${y - 46} V${y} Z" fill="#76a39b" opacity=".85" stroke="#2f4a46" stroke-width="1.6"/><rect x="867" y="${y - 70}" width="12" height="14" fill="#8a5a32"/></g>
    ${shadow(653, y + 2, 34, 6)}
    ${lookSvg("tinteiros")}
    ${shadow(932, y + 2, 22, 5)}
    ${lookSvg("vaso-torneado")}`;
}

/** A small pot that hides the right end of the binoculars (tier B: partly occluded). */
function sillPotOverBinoculars() {
  const b = boxOf(TARGETS.binoculo.region);
  return plant(b.x + b.w - 4, WINDOW.bottom, 0.66, { leaves: "url(#leafDark)" });
}

function wallFrames(omit = null) {
  return `
    ${frame(1196, 330, 280, 236, PAINTING_LAKE)}
    ${frame(1560, 300, 330, 230, PAINTING_MAP)}
    ${frameShadow(1950, 590, 116, 140)}${lookSvg("folha-emoldurada")}
    ${frameShadow(1932, 318, 104, 124)}${paint("borboleta", omit)}
    <rect x="1180" y="700" width="300" height="16" rx="3" fill="url(#woodV)" stroke="#2b170b" stroke-width="1.6" filter="url(#grainH)"/>
    ${occlusion(1180, 714, 300, 14, 0.5)}
    <path d="M1200 716 l16 22 h4 v-22 Z M1440 716 l16 22 h4 v-22 Z" fill="#4a2a16"/>
    <g>
      ${shadow(1218, 698, 26, 4, 0.7)}${lookSvg("acucareiro")}
      ${shadow(1306, 698, 30, 4, 0.8)}${paint("pinha", omit)}
      <path d="M1344 700 V668 C1344 658 1366 658 1366 668 V700 Z" fill="#b1cbc1" opacity=".8" stroke="#5f7a74" stroke-width="1.6"/><rect x="1348" y="654" width="14" height="9" fill="#8a5a32"/>
      ${bookStack(1370, 700, [[106, 16, "#7a3024"], [96, 14, "#2d4a68", 6], [88, 13, "#9c7230", 3]])}
      ${shadow(1408, 656, 18, 3, 0.7)}${lookSvg("abacaxi-de-madeira")}
    </g>`;
}

function globe(omit = null) {
  return `
    ${shadow(2200, 1420, 116, 18)}
    ${paint("globo", omit)}`;
}

function table() {
  return `
    ${shadow(1600, 1452, 360, 34)}
    <path d="M1560 1240 C1552 1300 1566 1360 1548 1410 L1652 1410 C1634 1360 1648 1300 1640 1240 Z" fill="url(#woodH)" stroke="#2b170b" stroke-width="1.6" filter="url(#grainV)"/>
    <ellipse cx="1600" cy="1320" rx="40" ry="12" fill="#8a5a32"/>
    <path d="M1556 1404 C1500 1414 1460 1428 1440 1446 L1470 1452 C1500 1436 1540 1428 1570 1424 Z M1644 1404 C1700 1414 1740 1428 1760 1446 L1730 1452 C1700 1436 1660 1428 1630 1424 Z" fill="#4a2a16" stroke="#2b170b" stroke-width="1.6"/>
    <path d="M1090 1080 C1090 1180 2110 1180 2110 1080 L2110 1118 C2110 1220 1090 1220 1090 1118 Z" fill="#4a2a16" stroke="#2b170b" stroke-width="1.6" filter="url(#grainH)"/>
    <ellipse cx="1600" cy="1080" rx="510" ry="150" fill="url(#wood)" stroke="#2b170b" stroke-width="2.4" filter="url(#grainH)"/>
    <ellipse cx="1520" cy="1040" rx="380" ry="90" fill="#ffffff" opacity=".045"/>
    <path d="M1110 1080 C1150 1150 1400 1200 1700 1196" stroke="#d29a62" stroke-width="3" fill="none" opacity=".32"/>`;
}

function tableItems(omit = null) {
  const map = `
    <g>
      <path d="M1486 990 L1984 972 L2006 1170 L1500 1196 Z" fill="#1a0e06" opacity=".3" transform="translate(6 8)" filter="url(#blur3)"/>
      <path d="M1486 990 L1984 972 L2006 1170 L1500 1196 Z" fill="url(#parchment)" stroke="#9c7a48" stroke-width="1.6"/>
      <path d="M1540 1020 C1580 1000 1640 1006 1660 1030 C1680 1056 1640 1076 1600 1070 C1560 1064 1520 1048 1540 1020 Z" fill="#d3b97f" stroke="#8a6a3c" stroke-width="1.4"/>
      <path d="M1860 1060 C1900 1030 1960 1046 1966 1086 C1970 1120 1930 1140 1896 1128 C1866 1118 1846 1086 1860 1060 Z" fill="#d3b97f" stroke="#8a6a3c" stroke-width="1.4"/>
      <path d="M1650 1110 C1680 1100 1720 1120 1712 1144 C1704 1166 1660 1160 1650 1140 Z" fill="#d3b97f" stroke="#8a6a3c" stroke-width="1.4"/>
      <path d="M1640 1050 C1700 1080 1800 1060 1870 1080" stroke="#a0442c" stroke-width="2.2" stroke-dasharray="8 6" fill="none"/>
      <path d="M1500 1010 L1990 994 M1504 1060 L1994 1044 M1506 1110 L1998 1094 M1508 1160 L2002 1144 M1600 990 L1612 1190 M1740 984 L1752 1184 M1880 978 L1892 1178" stroke="#a88b5c" stroke-width="1" opacity=".42"/>
    </g>`;
  // The open book lies over the compass's upper-left rim (tier B) and the watch's
  // bow (tier C): both keep their dial and needle/hands in view.
  const openBook = `
    <g transform="translate(0 -20)">
      <path d="M1186 1030 L1520 1030 L1530 1170 L1192 1176 Z" fill="#1a0e06" opacity=".32" transform="translate(6 10)" filter="url(#blur3)"/>
      <path d="M1180 1150 C1240 1132 1300 1136 1356 1152 C1412 1136 1470 1132 1530 1150 L1526 1166 C1470 1150 1412 1154 1356 1168 C1300 1154 1240 1150 1184 1166 Z" fill="#652a1e" stroke="#3a140e" stroke-width="1.3"/>
      <path d="M1186 1022 C1240 1000 1300 1004 1352 1018 L1356 1150 C1304 1134 1240 1132 1190 1154 Z" fill="url(#page)" stroke="#8a6a3c" stroke-width="1.5"/>
      <path d="M1352 1018 C1404 1002 1466 1002 1522 1024 L1526 1154 C1470 1134 1406 1134 1356 1150 Z" fill="url(#pageR)" stroke="#8a6a3c" stroke-width="1.5"/>
      <path d="M1340 1022 C1346 1060 1348 1110 1352 1148 L1362 1148 C1358 1110 1358 1060 1356 1022 Z" fill="#000" opacity=".1"/>
      <g stroke="#8a7a62" stroke-width="1.2" opacity=".42">
        <path d="M1206 1040 C1250 1026 1300 1028 1336 1036 M1206 1054 C1250 1040 1300 1042 1336 1050 M1206 1068 C1250 1054 1300 1056 1336 1064 M1206 1082 C1250 1068 1300 1070 1336 1078 M1206 1096 C1250 1082 1300 1084 1336 1092 M1206 1110 C1250 1096 1300 1098 1336 1106"/>
        <path d="M1372 1036 C1410 1026 1460 1026 1504 1040 M1372 1050 C1410 1040 1460 1040 1504 1054 M1372 1064 C1410 1054 1460 1054 1504 1068"/>
      </g>
      <path d="M1400 1086 C1424 1072 1462 1078 1484 1098 C1462 1116 1424 1118 1400 1106 Z" fill="#7a965a" opacity=".42"/>
      <path d="M1442 1080 V1116" stroke="#5b6b3a" stroke-width="1.4" opacity=".6"/>
    </g>`;
  const watchChain = (() => {
    const c = TARGETS.relogio.region;
    let links = "";
    // From under the book, past the watch's left side, sagging along the table.
    for (let i = 0; i < 11; i += 1) {
      const x = c.cx - 34 - i * 12;
      const y = c.cy - 34 + i * 4 + Math.sin(i / 3) * 6;
      links += `<ellipse cx="${n(x)}" cy="${n(y)}" rx="6" ry="4" fill="none" stroke="url(#brassDim)" stroke-width="2.4" transform="rotate(${i % 2 ? 20 : -20} ${n(x)} ${n(y)})"/>`;
    }
    return links;
  })();
  const relogio = boxOf(TARGETS.relogio.region);
  // A note slid under the open book covers the watch case's lower right (tier C — the dial stays in view).
  const note = `<g transform="rotate(8 ${relogio.x + relogio.w} ${relogio.y + relogio.h})">
      ${shadow(relogio.x + relogio.w - 6, relogio.y + relogio.h - 6, 30, 5, 0.6)}
      <path d="M${relogio.x + relogio.w * 0.66} ${relogio.y + relogio.h * 0.72} L${relogio.x + relogio.w + 22} ${relogio.y + relogio.h * 0.66} L${relogio.x + relogio.w + 26} ${relogio.y + relogio.h + 6} L${relogio.x + relogio.w * 0.62} ${relogio.y + relogio.h + 10} Z" fill="url(#page)" stroke="#8a6a3c" stroke-width="1.2"/>
      <path d="M${relogio.x + relogio.w * 0.72} ${relogio.y + relogio.h * 0.84} H${relogio.x + relogio.w + 14} M${relogio.x + relogio.w * 0.72} ${relogio.y + relogio.h * 0.94} H${relogio.x + relogio.w + 10}" stroke="#8a7a62" stroke-width="1.2" opacity=".5"/>
    </g>`;
  return `
    ${bookStack(1150, 1046, [[150, 22, "#2d4a68"], [140, 20, "#7a3024", 6], [128, 18, "#4a6a3a", 10]])}
    ${shadow(1430, 1002, 54, 10)}
    ${paint("xicara", omit)}
    ${shadow(1560, 996, 46, 6, 0.6)}
    ${paint("tesoura", omit)}
    ${map}
    ${shadow(1540, 1180, 62, 10, 0.8)}
    ${paint("bussola", omit)}
    ${watchChain}
    ${shadow(1330, 1206, 44, 8, 0.8)}
    ${paint("relogio", omit)}
    ${openBook}
    ${note}
    ${shadow(1426, 1206, 18, 4, 0.7)}
    ${lookSvg("moedas")}
    ${shadow(1664, 1176, 22, 4, 0.5)}
    ${lookSvg("compasso-de-pontas")}
    ${shadow(1200, 984, 24, 4, 0.7)}
    ${lookSvg("medalha")}
    ${shadow(1660, 1224, 22, 5, 0.7)}
    ${lookSvg("lata-redonda")}
    <g>${shadow(1950, 1216, 74, 11)}
      <rect x="1890" y="1150" width="120" height="58" rx="6" fill="url(#woodDark)" stroke="#1c0f07" stroke-width="1.6" filter="url(#grainH)"/>
      <path d="M1886 1150 L1900 1132 H2004 L2014 1150 Z" fill="#6b4024" stroke="#1c0f07" stroke-width="1.6"/>
      <rect x="1940" y="1168" width="18" height="14" rx="2" fill="url(#brassDim)"/></g>
    ${shadow(2020, 1068, 36, 8)}
    ${paint("pena", omit)}
    ${shadow(1923, 1086, 24, 5, 0.7)}
    ${lookSvg("carimbo")}
    <g>${shadow(1215, 1004, 60, 8)}
      <rect x="1160" y="986" width="110" height="14" rx="7" fill="url(#parchment)" stroke="#8a6a3c" stroke-width="1.3" transform="rotate(-4 1215 993)"/>
      <rect x="1204" y="984" width="9" height="18" fill="#94482a" transform="rotate(-4 1215 993)"/></g>`;
}

function lupaOnMap() {
  const box = boxOf(TARGETS.lupa.region);
  return `${shadow(box.x + box.w * 0.62, box.y + box.h * 0.7, box.w * 0.6, box.h * 0.2, 0.9)}
    ${lupaHandleSvg(box)}
    ${fit(`${ART.lupa.clip}${ART.lupa.body}`, ART.lupa.nominal, box)}`;
}

const SHELVES = { s1: 370, s2: 600, s3: 830, s4: 1060, s5: 1240 };
const CASE = { left: 2260, right: 3080 };

function bookcase() {
  const { left, right } = CASE;
  const shelves = [SHELVES.s1, SHELVES.s2, SHELVES.s3, SHELVES.s4];
  let svg = `
    ${shadow(2670, 1296, 500, 34)}
    <rect x="${left}" y="150" width="${right - left}" height="1120" fill="#26150b"/>
    <rect x="${left + 34}" y="160" width="${right - left - 68}" height="1090" fill="#38210f" filter="url(#grainV)"/>
    <g opacity=".3" stroke="#160b05" stroke-width="3">${Array.from({ length: 9 }, (_, i) => `<path d="M${left + 34 + 84 * (i + 1)} 160 V1250"/>`).join("")}</g>`;
  // the back of each compartment is darker under the shelf above it
  for (const top of [160, ...shelves.map((y) => y + 24)]) {
    svg += `<rect x="${left + 34}" y="${top}" width="${right - left - 68}" height="70" fill="url(#shelfShade)"/>`;
  }
  for (const y of shelves) {
    svg += `<g filter="url(#grainH)"><rect x="${left + 30}" y="${y}" width="${right - left - 60}" height="24" fill="url(#woodV)"/></g>
      <rect x="${left + 30}" y="${y}" width="${right - left - 60}" height="3" fill="#e0a970" opacity=".4"/>
      <rect x="${left + 30}" y="${y + 24}" width="${right - left - 60}" height="16" fill="#140a04" opacity=".5"/>`;
  }
  svg += `
    <g filter="url(#grainV)">
      <rect x="${left}" y="150" width="36" height="1120" fill="url(#woodH)"/>
      <rect x="${right - 36}" y="150" width="36" height="1120" fill="url(#woodH)"/>
    </g>
    <rect x="${left}" y="150" width="36" height="1120" fill="none" stroke="#1c0f07" stroke-width="1.6"/>
    <rect x="${right - 36}" y="150" width="36" height="1120" fill="none" stroke="#1c0f07" stroke-width="1.6"/>
    <g filter="url(#grainH)">
      <rect x="${left - 20}" y="124" width="${right - left + 40}" height="36" rx="4" fill="url(#woodV)"/>
      <rect x="${left - 10}" y="1240" width="${right - left + 20}" height="40" fill="url(#woodDark)"/>
    </g>
    <rect x="${left - 20}" y="124" width="${right - left + 40}" height="36" rx="4" fill="none" stroke="#1c0f07" stroke-width="1.6"/>`;
  return svg;
}

function bookcaseItems(omit = null) {
  const { s1, s2, s3, s4, s5 } = SHELVES;
  const est = boxOf(TARGETS.estatueta.region);
  const cam = boxOf(TARGETS.camera.region);
  const lan = boxOf(TARGETS.lanterna.region);
  const runA = bookRun(2300, s1, 8, 11, { minH: 130, maxH: 190 });
  const runB = bookRun(est.x + est.w + 12, s1, 4, 23, { minH: 120, maxH: 170 });
  const runB2 = bookRun(2884, s1, 3, 29, { minH: 120, maxH: 160 });
  const runC = bookRun(2440, s2, 9, 37, { minH: 140, maxH: 200 });
  const runD = bookRun(2670, s3, 7, 51, { minH: 150, maxH: 200 });
  const runE = bookRun(2300, s4, 7, 67, { minH: 140, maxH: 200 });
  const runF = bookRun(lan.x + lan.w + 16, s4, 4, 79, { minH: 150, maxH: 195 });
  return `
    ${runA.svg}
    ${shadow(2553, s1 - 2, 18, 4, 0.8)}
    ${lookSvg("rolo-de-papel")}
    ${shadow(est.x + est.w / 2, s1 - 2, est.w * 0.6, 6, 0.8)}
    ${paint("estatueta", omit)}
    ${book(est.x - 12, s1 - 132, 28, 132, "#5a3b5c", { tilt: 16 })}
    ${runB.svg}
    ${shadow(2854, s1 - 2, 22, 4, 0.8)}
    ${lookSvg("vaso-de-porcelana")}
    ${runB2.svg}
    ${trailingPlant(2994, s1, 0.8)}
    ${bookStack(2292, s2, [[132, 22, "#7a3024"], [124, 20, "#365169", 4], [118, 18, "#9c7230", 8], [110, 18, "#4a6a3a", 6]])}
    ${shadow(2355, 522, 56, 6, 0.8)}
    ${lookSvg("caixinha-de-musica")}
    ${runC.svg}
    ${bookRun(cam.x - 2, s2, 6, 43, { minH: 150, maxH: 178, minW: 24, maxW: 32, gap: 1, colors: ["#c9b48a", "#d8c69e", "#bfa678", "#d1bd92"] }).svg}
    ${occlusion(cam.x, s2 - 24, cam.w, 22, 0.4)}
    ${shadow(cam.x + cam.w / 2, s2 - 2, cam.w * 0.55, 7, 0.9)}
    ${paint("camera", omit)}
    ${book(cam.x + cam.w - 18, s2 - 168, 30, 168, "#2f5d58", { tilt: -16 })}
    <g>${shadow(2930, s2 - 2, 30, 6)}<path d="M2906 ${s2} V${s2 - 66} C2906 ${s2 - 80} 2954 ${s2 - 80} 2954 ${s2 - 66} V${s2} Z" fill="#b9cec7" opacity=".78" stroke="#5f7a74" stroke-width="1.6"/><rect x="2912" y="${s2 - 90}" width="36" height="14" rx="3" fill="#8a5a32"/>
      <g fill="#a0442c" opacity=".65"><circle cx="2920" cy="${s2 - 26}" r="7"/><circle cx="2936" cy="${s2 - 18}" r="7"/><circle cx="2930" cy="${s2 - 38}" r="6"/></g></g>
    ${bookRun(2970, s2, 3, 91, { minH: 140, maxH: 180 }).svg}
    ${shadow(2505, s3 - 2, 150, 9, 0.9)}
    ${paint("barco", omit)}
    ${runD.svg}
    ${book(runD.end + 6, s3 - 160, 32, 160, "#5a3b5c", { tilt: 16 })}
    <g>${shadow(2985, s3 - 2, 72, 8)}<rect x="2930" y="${s3 - 74}" width="112" height="72" rx="5" fill="url(#woodDark)" stroke="#1c0f07" stroke-width="1.6" filter="url(#grainH)"/><rect x="2926" y="${s3 - 82}" width="120" height="12" rx="3" fill="#6b4024" stroke="#1c0f07" stroke-width="1.3"/><circle cx="2986" cy="${s3 - 38}" r="6" fill="url(#brassDim)"/></g>
    ${runE.svg}
    <g>${shadow(2575, s4 - 2, 72, 8)}<rect x="2512" y="${s4 - 96}" width="126" height="94" rx="5" fill="url(#wood)" stroke="#1c0f07" stroke-width="1.6" filter="url(#grainH)"/>
      <path d="M2512 ${s4 - 70} H2638" stroke="#2b170b" stroke-width="1.6"/><rect x="2566" y="${s4 - 64}" width="18" height="16" rx="2" fill="url(#brassDim)"/></g>
    ${shadow(2702, s4 - 2, 36, 6)}
    ${lookSvg("chaleira")}
    ${shadow(lan.x + lan.w / 2, s4 - 2, lan.w * 0.5, 7, 0.9)}
    ${paint("lanterna", omit)}
    ${bookStack(lan.x - 6, s4, [[96, 22, "#2d4a68"], [88, 20, "#7a3024", 4], [80, 18, "#6d5a3a", 10]])}
    ${runF.svg}
    <g>${shadow(2420, s5 - 2, 124, 9)}
      <path d="M2306 ${s5} L2318 ${s5 - 120} H2436 L2448 ${s5} Z" fill="#a17c4a" stroke="#4a3013" stroke-width="1.6" filter="url(#grainH)"/>
      <g stroke="#6e5230" stroke-width="3" opacity=".7"><path d="M2312 ${s5 - 30} H2442 M2314 ${s5 - 60} H2440 M2316 ${s5 - 90} H2438"/></g>
      <path d="M2456 ${s5} L2466 ${s5 - 96} H2560 L2570 ${s5} Z" fill="#b18c56" stroke="#4a3013" stroke-width="1.6" filter="url(#grainH)"/>
      <g stroke="#6e5230" stroke-width="3" opacity=".7"><path d="M2462 ${s5 - 30} H2566 M2464 ${s5 - 60} H2564"/></g></g>
    ${bookStack(2590, s5, [[170, 24, "#2f5d58"], [160, 22, "#86582b", 6], [150, 22, "#5a3b5c", 10], [140, 20, "#7a3024", 14]])}
    ${shadow(2656, 1150, 52, 5, 0.8)}
    ${paint("gaita", omit)}
    <g transform="rotate(-9 2620 1140)">${bookStack(2552, 1152, [[92, 17, "#6d5a3a"]])}</g>
    ${shadow(2506, 1142, 30, 4, 0.8)}
    ${lookSvg("caixa-de-fosforos")}
    <g>${shadow(2920, s5 - 2, 124, 9)}
      ${[0, 1, 2].map((i) => `<rect x="${2806 + i * 6}" y="${s5 - 44 - i * 30}" width="${226 - i * 12}" height="26" rx="13" fill="url(#parchment)" stroke="#8a6a3c" stroke-width="1.3"/><ellipse cx="${3030 - i * 6}" cy="${s5 - 31 - i * 30}" rx="8" ry="13" fill="#d3b97f" stroke="#8a6a3c" stroke-width="1.3"/>`).join("")}
      ${shadow(2856, 1132, 34, 4, 0.7)}${lookSvg("estojo-de-oculos")}</g>
    ${trailingPlant(2330, 134, 0.95)}`;
}

function floorAndRug() {
  let boards = "";
  for (let i = 0; i < 9; i += 1) {
    const y = 1190 + Math.round(Math.pow(i, 1.35) * 22);
    boards += `<path d="M0 ${y} H${W}" stroke="#2b170b" stroke-width="${n(2 + i * 0.3)}" opacity=".5"/>`;
  }
  for (let i = 0; i < 30; i += 1) {
    const x = (i * 157) % W;
    const y = 1190 + ((i * 53) % 380);
    boards += `<path d="M${x} ${y} v26" stroke="#2b170b" stroke-width="2" opacity=".38"/>`;
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
    rugMotifs += lozenge(u, 0.115, 0.018, 0.05, `fill="#cf9f55" opacity=".78"`);
  }
  for (const cu of [0.16, 0.84]) {
    rugMotifs += lozenge(cu, 0.62, 0.07, 0.24, `fill="#21384f" opacity=".85"`);
    rugMotifs += lozenge(cu, 0.62, 0.035, 0.12, `fill="#cf9f55" opacity=".78"`);
  }
  let fringe = "";
  for (let i = 0; i <= 60; i += 1) {
    const [x, y] = rug({ u: i / 60, v: 0 }).split(" ").map(Number);
    fringe += `<path d="M${x} ${y} l${n(-2 + (i % 3))} -12" stroke="#d9c79c" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>`;
  }
  return `
    <g filter="url(#grainH)">
      <rect x="0" y="1180" width="${W}" height="${H - 1180}" fill="url(#woodV)"/>
    </g>
    <rect x="0" y="1180" width="${W}" height="${H - 1180}" fill="#3a2010" opacity=".3"/>
    ${boards}
    <rect x="0" y="1168" width="${W}" height="22" fill="#2b170b"/>
    <rect x="0" y="1166" width="${W}" height="3" fill="#c78d58" opacity=".35"/>
    ${occlusion(0, 1186, W, 18, 0.5)}
    <g filter="url(#weave)">
      ${poly([{ u: 0, v: 0 }, { u: 1, v: 0 }, { u: 1, v: 1 }, { u: 0, v: 1 }], `fill="#662220"`)}
      ${poly([{ u: 0.03, v: 0.06 }, { u: 0.97, v: 0.06 }, { u: 0.97, v: 1 }, { u: 0.03, v: 1 }], `fill="none" stroke="#21384f" stroke-width="22"`)}
      ${poly([{ u: 0.015, v: 0.03 }, { u: 0.985, v: 0.03 }, { u: 0.985, v: 1 }, { u: 0.015, v: 1 }], `fill="none" stroke="#cf9f55" stroke-width="5"`)}
      ${poly([{ u: 0.05, v: 0.09 }, { u: 0.95, v: 0.09 }, { u: 0.95, v: 1 }, { u: 0.05, v: 1 }], `fill="none" stroke="#cf9f55" stroke-width="2" stroke-dasharray="10 8" opacity=".6"`)}
      ${rugMotifs}
      ${lozenge(0.5, 0.64, 0.24, 0.42, `fill="#21384f"`)}
      ${lozenge(0.5, 0.64, 0.19, 0.33, `fill="#843529"`)}
      ${lozenge(0.5, 0.64, 0.1, 0.18, `fill="#cf9f55" opacity=".88"`)}
      ${lozenge(0.5, 0.64, 0.045, 0.08, `fill="#21384f"`)}
      <path d="M${rug({ u: 0, v: 0.2 })} H${rug({ u: 1, v: 0.2 }).split(" ")[0]}" stroke="#cf9f55" stroke-width="2" stroke-dasharray="10 12" opacity=".45"/>
    </g>
    ${fringe}`;
}

/** Wall decor between the frames and the bookcase: an explorer's hat and satchel on a peg rail (both in the pool). */
function pegRail(omit = null) {
  return `
    <rect x="2070" y="430" width="170" height="20" rx="4" fill="url(#woodDark)" stroke="#1c0f07" stroke-width="1.6"/>
    ${[2100, 2160, 2215].map((x) => `<rect x="${x - 5}" y="440" width="10" height="26" rx="4" fill="#4a2a16"/>`).join("")}
    <ellipse cx="2134" cy="490" rx="62" ry="12" fill="#000" opacity=".16" filter="url(#blur8)"/>
    ${paint("chapeu", omit)}
    <path d="M2216 456 C2196 520 2196 560 2204 600" stroke="#5a3418" stroke-width="5" fill="none"/>
    <path d="M2216 456 C2236 520 2236 560 2228 600" stroke="#5a3418" stroke-width="5" fill="none"/>
    <path d="M2176 612 H2268 L2262 716 C2236 728 2206 728 2182 716 Z" fill="#000" opacity=".17" filter="url(#blur8)"/>
    ${paint("bolsa", omit)}`;
}

/** Floor clutter that makes the room feel lived in (no target shares a category with it). */
function floorDecor() {
  return `
    <g>${shadow(2372, 1432, 86, 13)}
      ${[0, 1, 2].map((i) => {
        const x = 2328 + i * 36;
        const top = 1238 - (i % 2) * 18;
        return `<g transform="rotate(${-10 + i * 10} ${x + 12} 1330)"><rect x="${x}" y="${top}" width="26" height="${1336 - top}" rx="6" fill="url(#parchment)" stroke="#8a6a3c" stroke-width="1.3"/><ellipse cx="${x + 13}" cy="${top + 2}" rx="13" ry="6" fill="#e3cb96" stroke="#8a6a3c" stroke-width="1.3"/><rect x="${x}" y="${top + 34}" width="26" height="7" fill="#94482a"/></g>`;
      }).join("")}
      <path d="M2306 1330 H2440 L2426 1424 H2320 Z" fill="#b18c56" stroke="#4a3013" stroke-width="1.6" filter="url(#grainH)"/>
      <g stroke="#6e5230" stroke-width="3" opacity=".7"><path d="M2310 1360 H2436 M2314 1390 H2432"/></g>
    </g>
    <g>
      <path d="M1090 118 V250" stroke="#3a2414" stroke-width="3"/>
      <path d="M1040 250 H1140 L1126 300 H1054 Z" fill="#a17c4a" stroke="#4a3013" stroke-width="1.6"/>
      ${trailingPlant(1090, 262, 0.75, { pot: false })}
      ${ivyDrape()}
    </g>`;
}

/** GAME03-EXPERIENCE-02: one long strand of the hanging plant, over the birdcage's right shoulder. */
function ivyDrape() {
  const leaves = [
    [1046, 318, -30, 1],
    [1043, 352, 30, 0],
    [1040, 386, -30, 1],
    [1034, 420, 30, 1],
    [1027, 452, -30, 0],
    [1031, 462, 30, 1],
    [1022, 480, 30, 1],
    [1014, 490, -30, 0],
    [1021, 506, -30, 1],
    [1029, 516, 30, 1],
    [1025, 528, 30, 0],
    [1016, 544, -30, 1],
    [1026, 558, 30, 0],
  ];
  return `<path d="M1052 296 C1042 350 1046 396 1032 440 C1022 470 1018 500 1024 532 C1028 546 1024 556 1022 566" stroke="#355c2e" stroke-width="2.4" fill="none"/>
    ${leaves.map(([x, y, angle, light]) => `<ellipse cx="${x + (angle > 0 ? 7 : -7)}" cy="${y}" rx="8" ry="5" fill="${light ? "url(#leaf)" : "url(#leafDark)"}" transform="rotate(${angle} ${x} ${y})"/>`).join("")}`;
}

// --- the rest of the pool (GAME03-EXPERIENCE-02) -------------------------------------------------
//
// Six things the room already showed — the same paint, now each with its
// region in hidden-objects-scene.ts (the hat and the satchel lightened, with
// the window's rim light: in their dark felt and leather the fairness audit
// measured them under the edge floor) — and two new ones by the window.
// The promoted ones were authored in room coordinates: `anchored` re-anchors
// them on the origin of the region they were drawn for, so (like every
// target) the art follows its region. `view` frames a thumbnail that needs
// more than the region (steam, a stand, a quill's tip).

const anchored = (origin, nominal, svg, view = null) => ({
  nominal,
  ...(view ? { view } : {}),
  body: `<g transform="translate(${-origin.x} ${-origin.y})">${svg}</g>`,
});

Object.assign(ART, {
  xicara: anchored(
    { x: 1380, y: 950 },
    { w: 100, h: 60 },
    `<ellipse cx="1430" cy="996" rx="48" ry="12" fill="#ece3d1" stroke="#8a7a62" stroke-width="1.6"/>
      <path d="M1400 960 C1400 1000 1460 1000 1460 960 Z" fill="#f2e9d8" stroke="#8a7a62" stroke-width="1.6"/>
      <ellipse cx="1430" cy="960" rx="30" ry="8" fill="#5e321b"/>
      <path d="M1460 968 C1478 968 1478 988 1458 986" stroke="#f2e9d8" stroke-width="5" fill="none"/>
      <path d="M1420 950 C1410 930 1430 920 1420 900 M1438 948 C1430 930 1448 922 1440 904" stroke="#ffffff" stroke-width="3" opacity=".3" fill="none" stroke-linecap="round"/>`,
    { x: -2, y: -54, w: 104, h: 116 },
  ),
  pena: anchored(
    { x: 1994, y: 896 },
    { w: 82, h: 170 },
    `<path d="M2000 1064 C1994 1030 2000 1010 2010 1004 H2032 C2042 1010 2048 1030 2042 1064 Z" fill="#1f3848" opacity=".88" stroke="#0f1d27" stroke-width="1.6"/>
      <rect x="2010" y="994" width="22" height="12" rx="2" fill="url(#brassDim)"/>
      <path d="M2026 996 C2040 940 2070 900 2100 880 C2086 920 2060 960 2030 1000 Z" fill="#ece3cf" stroke="#a89470" stroke-width="1.3"/>
      <path d="M2030 1000 C2050 960 2076 920 2098 884" stroke="#a89470" stroke-width="1.3" fill="none"/>`,
    { x: -4, y: -20, w: 112, h: 192 },
  ),
  borboleta: anchored({ x: 1932, y: 318 }, { w: 104, h: 124 }, frameBody(1932, 318, 104, 124, PAINTING_BUTTERFLY)),
  chapeu: anchored(
    { x: 2066, y: 428 },
    { w: 124, h: 66 },
    `<ellipse cx="2128" cy="478" rx="62" ry="14" fill="#8c653c" stroke="#b8905e" stroke-width="1.4"/>
      <path d="M2070 474 C2090 466 2166 466 2186 474" stroke="#e0b67a" stroke-width="2.2" fill="none" opacity=".7" stroke-linecap="round"/>
      <path d="M2088 476 C2090 440 2100 430 2128 430 C2156 430 2166 440 2168 476 Z" fill="#9c7446" stroke="#b8905e" stroke-width="1.4"/>
      <path d="M2096 470 C2096 448 2104 438 2122 436" stroke="#e6c08a" stroke-width="2.4" fill="none" opacity=".55" stroke-linecap="round"/>
      <path d="M2090 466 C2110 472 2146 472 2166 466 L2166 476 C2146 482 2110 482 2090 476 Z" fill="#4a2c18"/>
      <path d="M2092 468 C2112 473 2144 473 2164 468" stroke="#b8865a" stroke-width="1.2" fill="none" opacity=".6"/>`,
  ),
  bolsa: anchored(
    { x: 2168, y: 594 },
    { w: 96, h: 120 },
    `<path d="M2170 596 H2262 L2256 700 C2230 712 2200 712 2176 700 Z" fill="#a06c3a" stroke="#c6925c" stroke-width="1.4" filter="url(#grainH)"/>
      <path d="M2178 652 L2180 694 M2254 652 L2252 694" stroke="#d29a62" stroke-width="1.2" stroke-dasharray="4 4" opacity=".55"/>
      <path d="M2168 596 H2264 L2258 640 C2230 654 2202 654 2174 640 Z" fill="#b57e48" stroke="#c6925c" stroke-width="1.4"/>
      <path d="M2174 600 H2258" stroke="#e6b47c" stroke-width="2" opacity=".6"/>
      <path d="M2178 636 C2204 648 2228 648 2252 636" stroke="#7a4a24" stroke-width="1.2" stroke-dasharray="4 4" opacity=".6" fill="none"/>
      <rect x="2208" y="632" width="16" height="14" rx="2" fill="url(#brassDim)"/>`,
  ),
  globo: anchored(
    { x: 2104, y: 894 },
    { w: 192, h: 192 },
    `<path d="M2200 1100 V1390 M2200 1390 L2130 1418 M2200 1390 L2270 1418 M2200 1390 L2200 1426" stroke="#4a2a16" stroke-width="12" stroke-linecap="round"/>
      <ellipse cx="2200" cy="1102" rx="40" ry="10" fill="url(#brassV)"/>
      <circle cx="2200" cy="990" r="96" fill="#2c6480"/>
      <circle cx="2200" cy="990" r="96" fill="url(#glassLens)" opacity=".3"/>
      <path d="M2140 930 C2160 910 2196 914 2204 936 C2212 956 2190 972 2170 968 C2152 964 2132 952 2140 930 Z M2214 990 C2236 970 2268 980 2272 1004 C2276 1028 2250 1046 2230 1036 C2214 1028 2204 1006 2214 990 Z M2140 1010 C2156 1004 2170 1020 2166 1036 C2160 1052 2140 1050 2134 1036 C2130 1026 2132 1014 2140 1010 Z" fill="#d3b678" stroke="#7a5a33" stroke-width="1.3"/>
      <path d="M2112 960 A96 96 0 0 1 2180 896" stroke="#ffffff" stroke-opacity=".28" stroke-width="5" fill="none" stroke-linecap="round"/>
      <circle cx="2200" cy="990" r="96" fill="none" stroke="#0b1a24" stroke-width="2" opacity=".6"/>
      <path d="M2112 1060 A110 110 0 0 0 2290 920" stroke="url(#brass)" stroke-width="9" fill="none"/>
      <path d="M2122 910 A110 110 0 0 1 2292 940" stroke="url(#brass)" stroke-width="9" fill="none" opacity=".9"/>`,
    { x: -16, y: -14, w: 224, h: 238 },
  ),
  // New: furled, its crook catching the window light, left leaning in the corner by the sill.
  "guarda-chuva": {
    nominal: { w: 64, h: 258 },
    body: `
      <g transform="rotate(5 33 254)">
        <path d="M33 60 V26 C33 8 12 6 10 20 C9 28 15 31 18 26" stroke="#3a210e" stroke-width="10" fill="none" stroke-linecap="round"/>
        <path d="M33 60 V26 C33 8 12 6 10 20 C9 28 15 31 18 26" stroke="url(#woodH)" stroke-width="6.5" fill="none" stroke-linecap="round"/>
        <path d="M31 54 V28 C31 15 21 12 15 17" stroke="#f0c088" stroke-width="1.8" fill="none" opacity=".6" stroke-linecap="round"/>
        <rect x="27" y="56" width="12" height="9" rx="2" fill="url(#brassDim)" stroke="#4a3216" stroke-width="1.1"/>
        <path d="M25 64 C18 98 20 150 30 232 L36 232 C46 150 48 98 41 64 Z" fill="url(#umbrellaCloth)" stroke="#16312d" stroke-width="1.5"/>
        <path d="M29 70 C25 112 27 168 32 228 M37 70 C40 112 39 168 34 228" stroke="#10241f" stroke-width="1.3" fill="none" opacity=".6"/>
        <path d="M27 76 C23 112 25 160 30 214" stroke="#ffffff" stroke-width="2.4" fill="none" opacity=".2" stroke-linecap="round"/>
        <path d="M23 122 C29 117 39 117 45 122 L44 131 C38 126 30 126 24 131 Z" fill="#1b3a35" stroke="#0e221e" stroke-width="1"/>
        <circle cx="34" cy="125" r="2.6" fill="url(#brassDim)"/>
        <path d="M30 230 H36 L34.5 250 H31.5 Z" fill="url(#brassDim)" stroke="#4a3216" stroke-width="1"/>
        <ellipse cx="33" cy="252" rx="3.2" ry="2" fill="#3d2810"/>
      </g>`,
  },
  // New: an old brass birdcage on a wall bracket, half under the hanging plant's ivy (tier C).
  gaiola: {
    nominal: { w: 76, h: 142 },
    body: `
      <rect x="70" y="0" width="6" height="13" rx="1.5" fill="#2a221a"/>
      <path d="M72 5 H48 C42 5 38 7 38 12" stroke="#2a221a" stroke-width="3.6" fill="none" stroke-linecap="round"/>
      <circle cx="38" cy="16" r="5" fill="none" stroke="url(#bronzeAged)" stroke-width="2.4"/>
      <path d="M8 58 C8 24 68 24 68 58" fill="none" stroke="url(#bronzeAged)" stroke-width="3.2"/>
      <g stroke="url(#bronzeAged)" stroke-width="1.8" fill="none">
        <path d="M38 24 C26 28 16 40 14 58 M38 24 C32 30 28 42 26 58 M38 24 V58 M38 24 C44 30 48 42 50 58 M38 24 C50 28 60 40 62 58"/>
      </g>
      <circle cx="38" cy="22" r="3.6" fill="url(#bronzeAged)" stroke="#3a2a10" stroke-width="1"/>
      <g stroke="url(#bronzeAged)" stroke-width="1.9"><path d="M10 58 V122 M18 58 V122 M26 58 V122 M34 58 V122 M42 58 V122 M50 58 V122 M58 58 V122 M66 58 V122"/></g>
      <ellipse cx="38" cy="58" rx="30" ry="4" fill="none" stroke="url(#bronzeAged)" stroke-width="3"/>
      <ellipse cx="38" cy="92" rx="29" ry="3.4" fill="none" stroke="url(#bronzeAged)" stroke-width="1.6" opacity=".9"/>
      <path d="M16 100 H60" stroke="#6b4a24" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M30 66 C26 78 30 84 38 84 C46 84 50 78 46 66" fill="none" stroke="#8d6a30" stroke-width="1.4"/>
      <path d="M4 122 H72 L68 136 H8 Z" fill="url(#bronzeAged)" stroke="#4a3216" stroke-width="1.4"/>
      <ellipse cx="38" cy="122" rx="34" ry="4.4" fill="#5a4119"/>
      <path d="M10 128 H66" stroke="#d9b877" stroke-width="1.4" opacity=".3"/>
      <ellipse cx="38" cy="138" rx="28" ry="3" fill="#3d2810"/>`,
  },
});

// --- GAME03-CALIBRATION-02A: five objects tucked into what the room already had (kit v2) -------------

Object.assign(ART, {
  // On the wainscot under the sill, crawling right: a brown shell on brown wood (tier C), a sill tendril over its back.
  caracol: {
    nominal: { w: 88, h: 60 },
    body: `
      <path d="M4 56 C4 50 12 47 24 47 H60 C68 47 72 43 74 35 L77 22 C78 16 86 16 86 22 L84 36 C82 48 76 56 66 56 Z" fill="#8c7c64" stroke="#4f4434" stroke-width="1.4"/>
      <path d="M78 22 L73 7 M84 22 L86 7" stroke="#8a7a62" stroke-width="2.6" stroke-linecap="round"/>
      <circle cx="73" cy="6" r="2.8" fill="#2f261c"/><circle cx="86" cy="6" r="2.8" fill="#2f261c"/>
      <path d="M8 53 C18 50 40 50 62 51" stroke="#d8c8a8" stroke-width="1.6" fill="none" opacity=".35"/>
      <circle cx="38" cy="28" r="24" fill="url(#snailShell)" stroke="#40250f" stroke-width="1.8"/>
      <path d="M38 28 a4 4 0 0 1 4 4 a8 8 0 0 1 -8 8 a12 12 0 0 1 -12 -12 a16 16 0 0 1 16 -16 a20 20 0 0 1 20 20" stroke="#3a220f" stroke-width="2.2" fill="none" stroke-linecap="round"/>
      <path d="M20 17 A20 20 0 0 1 38 6" stroke="#e6c08a" stroke-width="2.4" fill="none" opacity=".5" stroke-linecap="round"/>`,
  },
  // On the rug's first row of gold lozenges, at its edge: red and gold bands like the rug's own (tier C).
  piao: {
    nominal: { w: 82, h: 74 },
    body: `
      <g transform="rotate(-12 41 40)">
        <rect x="37" y="2" width="8" height="16" rx="3" fill="url(#woodH)" stroke="#3a2010" stroke-width="1.2"/>
        <path d="M12 26 C12 18 70 18 70 26 C70 34 58 44 48 56 L43 68 H39 L34 56 C24 44 12 34 12 26 Z" fill="#8c2e22" stroke="#e2bf86" stroke-width="2.2"/>
        <path d="M13 29 C26 36 56 36 69 29 L66 34 C54 40 28 40 16 34 Z" fill="#cf9f55"/>
        <path d="M22 41 C32 46 50 46 60 41 L56 46 C48 50 34 50 26 46 Z" fill="#cf9f55"/>
        <path d="M33 54 C38 56 44 56 49 54 L47 58 C43 59 39 59 35 58 Z" fill="#21384f"/>
        <ellipse cx="41" cy="23" rx="28" ry="6" fill="#a8432f" stroke="#e2bf86" stroke-width="1.6"/>
        <path d="M39 68 L41 74 L43 68 Z" fill="#9aa0a6" stroke="#3a3a3a" stroke-width="1"/>
        <path d="M20 27 C24 34 30 40 36 46" stroke="#ffffff" stroke-width="2" opacity=".28" fill="none" stroke-linecap="round"/>
      </g>`,
  },
  // Behind the open book, under the map's edge: steel blades on the table, the rings under the page's corner (tier C).
  tesoura: {
    nominal: { w: 92, h: 60 },
    body: `
      <ellipse cx="15" cy="17" rx="12" ry="10" fill="none" stroke="#2c2a27" stroke-width="5.5"/>
      <ellipse cx="17" cy="45" rx="12" ry="10" fill="none" stroke="#2c2a27" stroke-width="5.5"/>
      <path d="M25 22 C32 25 38 28 44 30 L90 31 L46 35 C38 33 31 30 25 27 Z" fill="url(#silver)" stroke="#4d4b47" stroke-width="1.2"/>
      <path d="M27 40 C34 38 40 35 46 33 L90 31 L44 37 C38 40 32 43 27 45 Z" fill="url(#silver)" stroke="#4d4b47" stroke-width="1.2"/>
      <circle cx="44" cy="32.5" r="3.2" fill="url(#brassDim)" stroke="#3a2a12" stroke-width="1"/>
      <path d="M50 31.5 L86 31" stroke="#ffffff" stroke-width="1.2" opacity=".55"/>`,
  },
  // On the wall shelf between a sugar bowl and the books, scales in the shelf's own browns (tier B).
  pinha: {
    nominal: { w: 60, h: 84 },
    body: `
      <path d="M30 83 C13 76 6 58 8 40 C10 22 19 8 30 3 C41 8 50 22 52 40 C54 58 47 76 30 83 Z" fill="url(#pineCone)" stroke="#c48a55" stroke-width="2"/>
      <path d="M12.0 14 Q17.0 21 22.0 14" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M25.0 14 Q30.0 21 35.0 14" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M38.0 14 Q43.0 21 48.0 14" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M8.5 22 Q13.5 29 18.5 22" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M19.5 22 Q24.5 29 29.5 22" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M30.5 22 Q35.5 29 40.5 22" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M41.5 22 Q46.5 29 51.5 22" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M7.0 31 Q12.0 38 17.0 31" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M16.0 31 Q21.0 38 26.0 31" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M25.0 31 Q30.0 38 35.0 31" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M34.0 31 Q39.0 38 44.0 31" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M43.0 31 Q48.0 38 53.0 31" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M9.0 40 Q14.0 47 19.0 40" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M17.0 40 Q22.0 47 27.0 40" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M25.0 40 Q30.0 47 35.0 40" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M33.0 40 Q38.0 47 43.0 40" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M41.0 40 Q46.0 47 51.0 40" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M9.0 49 Q14.0 56 19.0 49" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M17.0 49 Q22.0 56 27.0 49" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M25.0 49 Q30.0 56 35.0 49" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M33.0 49 Q38.0 56 43.0 49" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M41.0 49 Q46.0 56 51.0 49" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M9.0 58 Q14.0 65 19.0 58" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M17.0 58 Q22.0 65 27.0 58" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M25.0 58 Q30.0 65 35.0 58" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M33.0 58 Q38.0 65 43.0 58" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M41.0 58 Q46.0 65 51.0 58" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M11.5 67 Q16.5 74 21.5 67" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M20.5 67 Q25.5 74 30.5 67" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M29.5 67 Q34.5 74 39.5 67" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M38.5 67 Q43.5 74 48.5 67" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M14.0 75 Q19.0 82 24.0 75" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M25.0 75 Q30.0 82 35.0 75" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/><path d="M36.0 75 Q41.0 82 46.0 75" stroke="#2f1a0c" stroke-width="1.6" fill="#7e5230"/>
      <path d="M14 30 C12 44 14 58 22 70" stroke="#d6a46a" stroke-width="2.2" fill="none" opacity=".35" stroke-linecap="round"/>
      <path d="M28 3 L30 -2 L32 3" stroke="#5a3a1c" stroke-width="2" fill="none"/>`,
  },
  // On the book pile at the foot of the bookcase, its left end under a book laid across it (tier C).
  gaita: {
    nominal: { w: 100, h: 56 },
    body: `
      <path d="M4 22 L84 8 L98 14 L18 28 Z" fill="#aeaba2" stroke="#4a4842" stroke-width="1.2"/>
      <path d="M18 28 L98 14 L98 40 L18 54 Z" fill="url(#nickelDim)" stroke="#3d3b36" stroke-width="1.4"/>
      <path d="M4 22 L18 28 L18 54 L4 48 Z" fill="#6f6c64" stroke="#3d3b36" stroke-width="1.2"/>
      <path d="M18 36 L98 22 L98 30 L18 44 Z" fill="#6e4328" stroke="#2f1a0c" stroke-width="1"/>
      <g fill="#1d1510">${Array.from({ length: 10 }, (_, i) => {
        const x = 23 + i * 7.6;
        const y = 37.6 - i * 1.33;
        return `<rect x="${n(x)}" y="${n(y)}" width="4.2" height="4.4" rx="0.8"/>`;
      }).join("")}</g>
      <path d="M22 31 L94 18 M22 48 L94 35" stroke="#ffffff" stroke-width="1.2" opacity=".3"/>
      <rect x="92" y="22" width="7" height="10" rx="2" fill="url(#nickelDim)" stroke="#3d3b36" stroke-width="1"/>`,
  },
});

/** A tendril from the sill's pot over the snail's back (the sill's plants hang over the wainscot). */
function sillTendril() {
  const c = boxOf(TARGETS.caracol.region);
  const x0 = c.x + 14;
  return `<path d="M${x0 - 6} 1046 C${x0 - 2} 1060 ${x0 + 6} 1068 ${x0 + 4} 1084" stroke="#355c2e" stroke-width="2.6" fill="none"/>
    <ellipse cx="${x0 - 8}" cy="1058" rx="13" ry="7" fill="url(#leafDark)" transform="rotate(-28 ${x0 - 8} 1058)"/>
    <ellipse cx="${x0 + 10}" cy="1068" rx="14" ry="7" fill="url(#leaf)" transform="rotate(30 ${x0 + 10} 1068)"/>
    <ellipse cx="${x0 + 1}" cy="1082" rx="12" ry="6.5" fill="url(#leafDark)" transform="rotate(-36 ${x0 + 1} 1082)"/>`;
}

/** The birdcage's soft shadow on the wall (the light comes from the window, on its left), then the cage. */
function birdcage(omit) {
  return `<rect x="974" y="512" width="72" height="84" rx="22" fill="#0a0603" opacity=".24" filter="url(#blur8)"/>
    ${paint("gaiola", omit)}`;
}

/** The umbrella's shade on the wainscot and its contact on the floor, then the umbrella. */
function cornerUmbrella(omit) {
  return `<path d="M1024 944 L1054 944 L1052 1184 L1038 1184 Z" fill="#0a0603" opacity=".28" filter="url(#blur8)"/>
    ${shadow(1022, 1186, 26, 6, 0.85)}
    ${paint("guarda-chuva", omit)}`;
}

function plateSvg({ debug = false, omit = null } = {}) {
  const ampBox = boxOf(TARGETS.ampulheta.region);
  const t = (id, svg) => (omit === id ? "" : svg);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>${DEFS}
    <linearGradient id="wallLight" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#d9a35c" stop-opacity=".4"/><stop offset=".3" stop-color="#b98a4e" stop-opacity=".2"/><stop offset=".6" stop-color="#2c4a46" stop-opacity="0"/><stop offset="1" stop-color="#0d1a18" stop-opacity=".2"/>
    </linearGradient>
  </defs>
  ${wall()}
  ${windowSvg()}
  ${curtain()}
  <path d="M926 164 V222" stroke="#3a2a14" stroke-width="2" stroke-dasharray="3 2"/>
  ${lookSvg("cesta-de-arame")}
  ${birdcage(omit)}
  ${wallFrames(omit)}
  ${floorAndRug()}
  ${pegRail(omit)}
  ${bookcase()}
  ${bookcaseItems(omit)}
  ${globe(omit)}
  ${sillItems()}
  ${cornerUmbrella(omit)}
  ${t("binoculo", targetSvg("binoculo"))}
  ${sillPotOverBinoculars()}
  ${lookSvg("roseta-entalhada")}
  ${t("caracol", targetSvg("caracol"))}
  ${sillTendril()}
  ${shadow(740, 1398, 30, 5, 0.8)}
  ${t("piao", targetSvg("piao"))}
  ${shadow(846, 1424, 18, 4, 0.7)}
  ${lookSvg("peao-de-xadrez")}
  ${trunk()}
  ${t("chave", targetSvg("chave"))}
  ${trunkStraps()}
  ${lookSvg("alca-do-bau")}
  ${lookSvg("fivela")}
  ${trunkLetter()}
  ${floorDecor()}
  ${armchair()}
  ${sideTable()}
  ${bookStack(830, 1172, [[66, 14, "#2f5d58"], [58, 12, "#94482a", 4]])}
  ${shadow(ampBox.x + ampBox.w / 2, ampBox.y + ampBox.h - 2, ampBox.w * 0.58, 8, 0.9)}
  ${t("ampulheta", targetSvg("ampulheta"))}
  ${table()}
  ${shadow(1208, 1326, 30, 6, 0.6)}
  ${lookSvg("tampa-de-pote")}
  ${tableItems(omit)}
  ${t("lupa", lupaOnMap())}
  ${debug ? debugOverlay() : ""}
</svg>`;
}

// --- light: what the window's golden hour does to the room ---------------------------------------------

/**
 * The light pass, multiplied over the plate: white keeps the albedo, warm
 * cream lights it, cool grey-blue shades it. Painted at half size (it is soft
 * everywhere) and scaled up. Shade never drops a target below its tier's
 * contrast — the --audit table checks that on the composed room.
 */
/** The window's light thrown on the floor, mullions and all: the low sun is outside on the left. */
const SUN_PATCH = {
  // window opening (bottom 1000, inner 326–914) → floor, sheared right and towards the viewer
  top: { y: 1236, x0: 690, x1: 1270 },
  bottom: { y: 1600, x0: 1010, x1: 1930 },
};

function lightSvg() {
  const { top, bottom } = SUN_PATCH;
  const at = (u, v) => ({
    x: top.x0 + (top.x1 - top.x0) * u + (bottom.x0 + (bottom.x1 - bottom.x0) * u - (top.x0 + (top.x1 - top.x0) * u)) * v,
    y: top.y + (bottom.y - top.y) * v,
  });
  const line = (a, b) => `M${n(a.x)} ${n(a.y)} L${n(b.x)} ${n(b.y)}`;
  // the mullion and the two transoms of the window, as shadows inside the patch
  const mullions = [line(at(0.5, 0), at(0.5, 1)), line(at(0, 0.38), at(1, 0.38)), line(at(0, 0.78), at(1, 0.78))].join(" ");
  const patch = `M${n(at(0, 0).x)} ${n(at(0, 0).y)} L${n(at(1, 0).x)} ${n(at(1, 0).y)} L${n(at(1, 1).x)} ${n(at(1, 1).y)} L${n(at(0, 1).x)} ${n(at(0, 1).y)} Z`;
  const lan = boxOf(TARGETS.lanterna.region);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W / 2}" height="${H / 2}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="ambient" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#d9c8b1"/><stop offset=".22" stop-color="#d7c6b0"/><stop offset=".5" stop-color="#beb3a9"/><stop offset=".78" stop-color="#a39e9f"/><stop offset="1" stop-color="#8a8794"/>
    </linearGradient>
    <linearGradient id="ceiling" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#5f6072"/><stop offset=".55" stop-color="#7a7a8a" stop-opacity=".6"/><stop offset="1" stop-color="#7a7a8a" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="floorFall" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#7d7a8a" stop-opacity="0"/><stop offset="1" stop-color="#7d7a8a" stop-opacity=".85"/>
    </linearGradient>
    <radialGradient id="pool" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#fff2d6"/><stop offset=".6" stop-color="#ffecc8" stop-opacity=".6"/><stop offset="1" stop-color="#ffecc8" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="corner" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#5a5b6c"/><stop offset="1" stop-color="#5a5b6c" stop-opacity="0"/>
    </radialGradient>
    <filter id="lsoft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="46"/></filter>
    <filter id="lsoft2" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="16"/></filter>
    <filter id="lsoft3" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="7"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#ambient)"/>
  <rect width="${W}" height="520" fill="url(#ceiling)"/>
  <rect y="1250" width="${W}" height="350" fill="url(#floorFall)"/>
  <ellipse cx="${W + 80}" cy="${H + 60}" rx="760" ry="520" fill="url(#corner)" opacity=".7"/>
  <ellipse cx="${W + 40}" cy="-40" rx="700" ry="460" fill="url(#corner)" opacity=".6"/>
  <ellipse cx="-60" cy="-60" rx="520" ry="380" fill="url(#corner)" opacity=".45"/>
  <g filter="url(#lsoft)">
    <path d="M250 200 L1010 200 L1180 1170 L330 1170 Z" fill="#fff3dc" opacity=".92"/>
    <ellipse cx="1560" cy="1070" rx="590" ry="210" fill="#fff0d6" opacity=".8"/>
    <ellipse cx="2580" cy="720" rx="420" ry="520" fill="#e4d8ca" opacity=".5"/>
  </g>
  <g filter="url(#lsoft3)">
    <path d="${patch}" fill="#fff6e2"/>
    <path d="${mullions}" stroke="#a49a92" stroke-width="22" fill="none"/>
  </g>
  <g filter="url(#lsoft2)" fill="#6c6d80" opacity=".72">
    <ellipse cx="1600" cy="1252" rx="440" ry="62"/>
    <ellipse cx="560" cy="1474" rx="200" ry="32"/>
    <ellipse cx="220" cy="1366" rx="240" ry="52"/>
    <ellipse cx="2200" cy="1424" rx="150" ry="24"/>
    <rect x="${CASE.left + 34}" y="${SHELVES.s1 + 24}" width="${CASE.right - CASE.left - 68}" height="44"/>
    <rect x="${CASE.left + 34}" y="${SHELVES.s2 + 24}" width="${CASE.right - CASE.left - 68}" height="44"/>
    <rect x="${CASE.left + 34}" y="${SHELVES.s3 + 24}" width="${CASE.right - CASE.left - 68}" height="44"/>
    <rect x="${CASE.left + 34}" y="${SHELVES.s4 + 24}" width="${CASE.right - CASE.left - 68}" height="44"/>
    <rect x="${CASE.left + 34}" y="160" width="${CASE.right - CASE.left - 68}" height="56"/>
    <rect x="${CASE.left - 20}" y="1250" width="${CASE.right - CASE.left + 40}" height="60"/>
  </g>
  <ellipse cx="${lan.x + 63}" cy="${lan.y + 118}" rx="150" ry="130" fill="url(#pool)" opacity=".38"/>
</svg>`;
}

/** Bloom, screened over the lit plate: the window's glow, sunbeams in the air, the patch's warmth, a small lantern glow. */
function glowSvg() {
  const lan = boxOf(TARGETS.lanterna.region);
  const { top, bottom } = SUN_PATCH;
  const beam = (x0, x1, x2, x3, o) => `<path d="M${x0} 420 L${x1} 420 L${x3} 1600 L${x2} 1600 Z" fill="#ffd394" opacity="${o}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W / 2}" height="${H / 2}" viewBox="0 0 ${W} ${H}">
  <defs>
    <radialGradient id="g" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#ffcf8a" stop-opacity=".46"/><stop offset=".5" stop-color="#ff9f50" stop-opacity=".14"/><stop offset="1" stop-color="#ff9f50" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="beamFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".55" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
    <mask id="beamMask"><rect width="${W}" height="${H}" fill="url(#beamFade)"/></mask>
    <filter id="gsoft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="46"/></filter>
    <filter id="gbeam" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="26"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="#000"/>
  <g filter="url(#gsoft)">
    <path d="${windowHolePath()}" fill="#ffb867" opacity=".34"/>
    <path d="M${top.x0} ${top.y} L${top.x1} ${top.y} L${bottom.x1} ${bottom.y} L${bottom.x0} ${bottom.y} Z" fill="#ffb867" opacity=".2"/>
  </g>
  <g filter="url(#gbeam)" mask="url(#beamMask)">
    ${beam(420, 560, 920, 1180, 0.13)}
    ${beam(640, 760, 1290, 1520, 0.11)}
    ${beam(800, 880, 1640, 1790, 0.08)}
  </g>
  <circle cx="${lan.x + 63}" cy="${lan.y + 118}" r="90" fill="url(#g)" opacity=".38"/>
</svg>`;
}

// --- the foreground layers ---------------------------------------------------------------------

function ivyStrand(x0, len, seed, { sway = 20, leafScale = 1 } = {}) {
  const rnd = rng(seed);
  let out = `<path d="M${x0} 0 C${x0 + sway} ${n(len * 0.3)} ${x0 - sway / 2} ${n(len * 0.7)} ${x0 + sway * 0.6} ${len}" stroke="#2c4c26" stroke-width="4" fill="none"/>`;
  for (let k = 0; k < 7; k += 1) {
    const y = 20 + (len - 20) * (k / 6);
    const x = x0 + (k % 2 ? 14 : -10) + (rnd() - 0.5) * 6;
    out += `<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(18 * leafScale)}" ry="${n(11 * leafScale)}" fill="${k % 3 ? "url(#leafDark)" : "url(#leafDeep)"}" transform="rotate(${k % 2 ? 35 : -35} ${x0} ${n(y)})"/>`;
  }
  return out;
}

function frontSvg() {
  const r = LAYER.front.rect;
  const leaf = (x, y, len, wid, angle, fill = "url(#leafDeep)") =>
    `<path transform="rotate(${angle} ${x} ${y})" d="M${x} ${y} C${x - wid} ${y - len * 0.45} ${x - wid * 0.3} ${y - len} ${x} ${y - len} C${x + wid * 0.3} ${y - len} ${x + wid} ${y - len * 0.45} ${x} ${y} Z" fill="${fill}" stroke="#0c1d0f" stroke-width="1.6"/>
     <path transform="rotate(${angle} ${x} ${y})" d="M${x} ${y} V${y - len * 0.92}" stroke="#93b67a" stroke-width="2" opacity=".45"/>`;
  let ivy = "";
  for (let i = 0; i < 5; i += 1) ivy += ivyStrand(30 + i * 52, 150 + ((i * 67) % 150), 40 + i);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r.w}" height="${r.h}" viewBox="${r.x} ${r.y} ${r.w} ${r.h}">
  <defs>${DEFS}</defs>
  <g opacity=".98">${ivy}</g>
  <g>
    ${leaf(120, 1600, 330, 90, -28)}${leaf(150, 1600, 400, 100, -6, "url(#leafDark)")}${leaf(190, 1600, 300, 80, 22)}
    ${leaf(60, 1600, 280, 80, -50, "url(#leafDark)")}${leaf(230, 1600, 230, 70, 46, "url(#leafDark)")}
    <path d="M40 1520 H300 L280 ${H} H60 Z" fill="url(#terracotta)" stroke="#3a1c0e" stroke-width="2.4"/>
    <rect x="30" y="1506" width="280" height="22" rx="6" fill="#b4643a" stroke="#3a1c0e" stroke-width="1.6"/>
  </g>
</svg>`;
}

/** The right edge's foreground: vines from the beam and a stack of old books on the floor. */
function frontRightSvg() {
  const r = LAYER["front-right"].rect;
  let vines = "";
  for (let i = 0; i < 4; i += 1) vines += ivyStrand(3040 + i * 44, 180 + ((i * 53) % 190), 70 + i, { sway: 16 });
  let garland = `<path d="M${r.x} 40 C${r.x + 120} 120 ${r.x + 280} 70 ${r.x + 380} 110 C${r.x + 440} 130 ${r.x + 480} 90 ${W} 120" stroke="#2c4c26" stroke-width="5" fill="none"/>`;
  const rnd = rng(91);
  for (let k = 0; k < 16; k += 1) {
    const t = k / 15;
    const x = r.x + t * r.w;
    const y = 40 + Math.sin(t * Math.PI * 2.2) * 30 + 50 * t + (rnd() - 0.5) * 16;
    garland += `<ellipse cx="${n(x)}" cy="${n(Math.min(y, 140))}" rx="20" ry="11" fill="${k % 3 ? "url(#leafDark)" : "url(#leafDeep)"}" transform="rotate(${k % 2 ? 30 : -30} ${n(x)} ${n(Math.min(y, 140))})"/>`;
  }
  const books = bookStack(3030, H, [[200, 44, "#3c2a20"], [184, 40, "#2a3a48", 8], [176, 38, "#4a2420", 2], [160, 34, "#2f4a3a", 14]]);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${r.w}" height="${r.h}" viewBox="${r.x} ${r.y} ${r.w} ${r.h}">
  <defs>${DEFS}</defs>
  ${garland}
  ${vines}
  <g>${books}</g>
</svg>`;
}

// --- review overlay -----------------------------------------------------------------------------

function debugOverlay() {
  const shape = (r, color, width, dash = "") =>
    r.kind === "rect"
      ? `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="${color}" stroke-width="${width}" ${dash}/>`
      : `<circle cx="${r.cx}" cy="${r.cy}" r="${r.r}" fill="none" stroke="${color}" stroke-width="${width}" ${dash}/>`;
  const targets = SCENE.HIDDEN_OBJECTS.map((t) => shape(t.region, { A: "#38f2c0", B: "#ffd23f", C: "#ff6b6b" }[t.tier], 5)).join("");
  const looks = SCENE.SCENE_LOOKALIKES.map((l) => shape(l.region, "#c48bff", 3, `stroke-dasharray="8 6"`)).join("");
  const margins = `<rect x="${SCENE.SAFE_MARGIN_X}" y="${SCENE.SAFE_MARGIN_Y}" width="${W - 2 * SCENE.SAFE_MARGIN_X}" height="${H - 2 * SCENE.SAFE_MARGIN_Y}" fill="none" stroke="#ffffff" stroke-width="3" stroke-dasharray="20 14" opacity=".8"/>`;
  const zones = SCENE.SCENE_STATIONS.map((s) => `<path d="M${s.span.x1} 0 V${H}" stroke="#ffffff" stroke-width="2" opacity=".5"/>`).join("");
  const front = SCENE.SCENE_LAYERS.filter((l) => l.id.startsWith("front"))
    .flatMap((l) => l.opaque)
    .map((o) => `<rect x="${o.x}" y="${o.y}" width="${o.w}" height="${o.h}" fill="#ff00ff" opacity=".18"/>`)
    .join("");
  return `${zones}${margins}${front}${looks}${targets}`;
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
  } else if (art.view) {
    // the object with what reaches past its region (steam, a stand, a quill's tip)
    const { x, y, w, h } = art.view;
    body = fit(`<g transform="translate(${-x} ${-y})">${art.body}</g>`, { w, h }, box);
  } else {
    body = fit(art.body, art.nominal, box);
  }
  // A faint cream rim so a dark object still reads on the HUD's dark glass.
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><defs>${DEFS}
    <filter id="rim" x="-10%" y="-10%" width="120%" height="120%"><feMorphology in="SourceAlpha" operator="dilate" radius="2.5" result="d"/><feGaussianBlur in="d" stdDeviation="2" result="b"/><feFlood flood-color="#fff2d6" flood-opacity=".55"/><feComposite in2="b" operator="in" result="rim"/><feMerge><feMergeNode in="rim"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  </defs><g filter="url(#rim)">${body}</g></svg>`;
}

const DIORAMA = { w: 1040, h: 780 };

/** The Home maquette's passes (GAME03-SKELETON-01's v0 drawing; rewritten only with --home). */
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
      <circle cx="${cx + 150}" cy="${cy - 40}" r="120" fill="url(#g)"/>
      <g filter="url(#softSmall)"><path d="M${cx - 280} ${cy - 200} L${cx - 20} ${cy - 200} L${cx + 160} ${cy + 80} L${cx - 160} ${cy + 80} Z" fill="#ffe2a8" opacity=".26"/></g>`, `<filter id="softSmall" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter><radialGradient id="g" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#ffd27a" stop-opacity=".7"/><stop offset=".4" stop-color="#ffb04a" stop-opacity=".28"/><stop offset="1" stop-color="#ff9d2e" stop-opacity="0"/></radialGradient>`),
    front: wrap(`
      <g transform="translate(${cx + 110} ${cy - 66}) scale(0.5)">${ART.lanterna.body}</g>
      ${plant(cx - 300, cy + 96, 0.9)}
      ${bookStack(cx + 200, cy + 112, [[90, 16, "#7d2f24"], [80, 14, "#2d4b6b", 5]])}`),
  };
}

// --- run ------------------------------------------------------------------------------------------

const render = (svg) => sharp(Buffer.from(svg), { density: 72, limitInputPixels: false });
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

/** mulberry32: a long-period 32-bit generator for the grain (the room's `rng` repeats too soon for millions of samples). */
function grainRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fine painterly grain (neutral grey around 128), soft-lit over the plate.
 * Seeded (GAME03-EXPERIENCE-02): sharp's own noise is drawn afresh on every
 * run, so the kit came out with new bytes each time; now the same script gives
 * the same plate.
 */
async function grainLayer(width, height, sigma = 6) {
  const w = Math.round(width / 2);
  const h = Math.round(height / 2);
  const random = grainRandom(0x5eed_9a17);
  const noise = Buffer.alloc(w * h * 3);
  for (let i = 0; i < noise.length; i += 2) {
    // Box–Muller: two independent gaussian samples per pair of uniforms
    const radius = Math.sqrt(-2 * Math.log(1 - random()));
    const angle = 2 * Math.PI * random();
    noise[i] = Math.max(0, Math.min(255, Math.round(128 + sigma * radius * Math.cos(angle))));
    if (i + 1 < noise.length) noise[i + 1] = Math.max(0, Math.min(255, Math.round(128 + sigma * radius * Math.sin(angle))));
  }
  return sharp(noise, { raw: { width: w, height: h, channels: 3 } })
    .resize(width, height)
    .grayscale()
    .toColourspace("srgb")
    .png()
    .toBuffer();
}

/**
 * The plate as it ships: albedo × light (multiply), + bloom (screen), + grain
 * (soft light). The albedo's alpha (the window opening) is kept as painted.
 */
async function composePlate(albedoPng) {
  const { data: rgba, info } = await sharp(albedoPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const alpha = Buffer.alloc(info.width * info.height);
  for (let i = 0; i < alpha.length; i += 1) alpha[i] = rgba[i * 4 + 3];
  const light = await render(lightSvg()).resize(W, H).removeAlpha().png().toBuffer();
  const glow = await render(glowSvg()).resize(W, H).removeAlpha().png().toBuffer();
  const grain = await grainLayer(W, H);
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

/** The foreground: a touch darker and softer than the room (it is nearer the eye, out of the light). */
async function composeFront(svg) {
  const png = await render(svg).png().toBuffer();
  return sharp(png).modulate({ brightness: 0.78, saturation: 0.92 }).blur(1.1).png().toBuffer();
}

/** Relative luminance of an sRGB pixel. */
function luminance(r, g, b) {
  const lin = (c) => {
    const v = c / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/**
 * Fairness audit (Discovery §9 F1/F4, measured on the art itself):
 *   visible  — share of the target's own pixels the finished plate still shows
 *              (rendered with and without it: what changed is what is seen);
 *   contrast — F4 as written: mean luminance of what is seen against a 24 su
 *              ring around it, on the composed room (light pass included). It
 *              under-reads objects with both darker and lighter parts than
 *              their surroundings (a dark binocular with bright lenses);
 *   edge     — what actually separates a shape from its ground: the median
 *              luminance ratio across the visible silhouette's edge (each edge
 *              pixel against the background pixels within 3 su outside it).
 */
async function audit(composedRgba) {
  const rows = [];
  const withRaw = await render(plateSvg()).ensureAlpha().raw().toBuffer();
  for (const target of SCENE.HIDDEN_OBJECTS) {
    const b = boxOf(target.region);
    const pad = 40;
    const area = { left: Math.max(0, b.x - pad), top: Math.max(0, b.y - pad) };
    area.width = Math.min(W - area.left, b.w + 2 * pad);
    area.height = Math.min(H - area.top, b.h + 2 * pad);
    const withoutRaw = await render(plateSvg({ omit: target.id })).ensureAlpha().raw().toBuffer();
    const aloneSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${DEFS}</defs>${
      target.id === "lupa" ? fit(`${ART.lupa.clip}${ART.lupa.body}`, ART.lupa.nominal, b) : targetSvg(target.id)
    }</svg>`;
    const aloneRaw = await render(aloneSvg).ensureAlpha().raw().toBuffer();
    let own = 0;
    let seen = 0;
    let lumIn = 0;
    let lumRing = 0;
    let ring = 0;
    for (let y = area.top; y < area.top + area.height; y += 1) {
      for (let x = area.left; x < area.left + area.width; x += 1) {
        const i = (y * W + x) * 4;
        const mine = aloneRaw[i + 3] > 128;
        const changed =
          Math.abs(withRaw[i] - withoutRaw[i]) + Math.abs(withRaw[i + 1] - withoutRaw[i + 1]) + Math.abs(withRaw[i + 2] - withoutRaw[i + 2]) > 24;
        const l = luminance(composedRgba[i], composedRgba[i + 1], composedRgba[i + 2]);
        if (mine) {
          own += 1;
          if (changed) {
            seen += 1;
            lumIn += l;
          }
        } else {
          const inRing = x >= b.x - 24 && x < b.x + b.w + 24 && y >= b.y - 24 && y < b.y + b.h + 24;
          if (inRing && !changed) {
            ring += 1;
            lumRing += l;
          }
        }
      }
    }
    const li = seen ? lumIn / seen : 0;
    const lr = ring ? lumRing / ring : 0;
    // the silhouette's edge: visible target pixels with background within 2 su
    const isMine = (x, y) => aloneRaw[(y * W + x) * 4 + 3] > 128;
    const isSeen = (x, y) => {
      const i = (y * W + x) * 4;
      return isMine(x, y) && Math.abs(withRaw[i] - withoutRaw[i]) + Math.abs(withRaw[i + 1] - withoutRaw[i + 1]) + Math.abs(withRaw[i + 2] - withoutRaw[i + 2]) > 24;
    };
    const lumAt = (x, y) => {
      const i = (y * W + x) * 4;
      return luminance(composedRgba[i], composedRgba[i + 1], composedRgba[i + 2]);
    };
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
        const b2 = sum / outside;
        ratios.push((Math.max(a, b2) + 0.05) / (Math.min(a, b2) + 0.05));
      }
    }
    ratios.sort((p, q) => p - q);
    rows.push({
      id: target.id,
      tier: target.tier,
      visible: Number((seen / Math.max(1, own)).toFixed(3)),
      contrast: Number(((Math.max(li, lr) + 0.05) / (Math.min(li, lr) + 0.05)).toFixed(2)),
      edge: Number((ratios[Math.floor(ratios.length / 2)] ?? 1).toFixed(2)),
      lookAlikes: SCENE.SCENE_LOOKALIKES.filter((l) => l.resembles === target.id).map((l) => l.id),
    });
  }
  return rows;
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
  const front = await composeFront(frontSvg());
  const frontRight = await composeFront(frontRightSvg());

  // The composed room, as the Explorador sees it at rest (parallax offsets 0).
  const composedPng = await sharp({ create: { width: W, height: H, channels: 4, background: "#000000" } })
    .composite([
      { input: back, left: LAYER.back.rect.x, top: LAYER.back.rect.y },
      { input: plate, left: 0, top: 0 },
      { input: front, left: LAYER.front.rect.x, top: LAYER.front.rect.y },
      { input: frontRight, left: LAYER["front-right"].rect.x, top: LAYER["front-right"].rect.y },
    ])
    .png()
    .toBuffer();

  if (!preview) {
    await write(sharp(back), path.join(OUT, "back.webp"), { quality: 80, effort: 6 });
    await write(sharp(plate), path.join(OUT, "plate.webp"), { quality: 80, alphaQuality: 90, effort: 6, smartSubsample: true });
    await write(sharp(front), path.join(OUT, "front.webp"), { quality: 80, alphaQuality: 90, effort: 6 });
    await write(sharp(frontRight), path.join(OUT, "front-right.webp"), { quality: 80, alphaQuality: 90, effort: 6 });
    // Kit v2 writes no hero: the intro and the selector keep kit v1's (the platform's world visuals name it).
    for (const id of Object.keys(ART)) {
      await write(render(thumbSvg(id)), path.join(OUT, "thumbs", `${id}.webp`), { quality: 82, alphaQuality: 90, effort: 6 });
    }
  }

  if (HOME && !preview) {
    fs.mkdirSync(DIORAMA_OUT, { recursive: true });
    for (const [pass, svg] of Object.entries(dioramaPasses())) {
      await write(render(svg), path.join(DIORAMA_OUT, `discovery-${pass}.webp`), { quality: pass === "contact-shadow" ? 68 : 82, alphaQuality: 94, effort: 6 });
    }
  }

  // Review boards (archive only, never runtime).
  await sharp(composedPng).resize(1600, 800).webp({ quality: 86 }).toFile(path.join(reviewDir, "scene.webp"));
  const debugAlbedo = await render(plateSvg({ debug: true })).png().toBuffer();
  const regions = await sharp({ create: { width: W, height: H, channels: 4, background: "#000000" } })
    .composite([{ input: back, left: LAYER.back.rect.x, top: LAYER.back.rect.y }, { input: debugAlbedo, left: 0, top: 0 }])
    .png()
    .toBuffer();
  await sharp(regions).resize(1600, 800).webp({ quality: 86 }).toFile(path.join(reviewDir, "regions.webp"));
  await sharp(composedPng).resize(1600, 800).grayscale().webp({ quality: 86 }).toFile(path.join(reviewDir, "scene-grayscale.webp"));
  // Each pool object at the desktop's maximum zoom (1.25 px/su): what "aproximar" shows (F7).
  const tiles = [];
  const columns = 6;
  const rows = Math.ceil(SCENE.HIDDEN_OBJECTS.length / columns);
  for (const [i, target] of SCENE.HIDDEN_OBJECTS.entries()) {
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
  if (preview) await sharp(composedPng).toFile(path.join(reviewDir, "scene-full.png"));

  if (AUDIT) {
    const { data } = await sharp(composedPng).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const rows = await audit(data);
    // GAME03-CALIBRATION-02A: how busy the room is around each object, on the layers as they ship
    if (!preview) {
      const shipped = await composeShipped(
        { width: W, height: H, layers: SCENE.SCENE_LAYERS },
        (publicPath) => fs.readFileSync(path.join(ROOT, publicPath)),
      );
      for (const row of rows) row.clutter = measureClutter(shipped, W, H, TARGETS[row.id].region);
    }
    for (const row of rows) console.log(`${row.id.padEnd(12)} ${row.tier}  visible ${(row.visible * 100).toFixed(0).padStart(3)}%  contrast ${row.contrast.toFixed(2).padStart(5)}:1  edge ${row.edge.toFixed(2).padStart(5)}:1  clutter ${row.clutter ?? "—"}  look-alikes ${row.lookAlikes.join(", ") || "—"}`);
    const file = path.join(reviewDir, "fairness.json");
    // the shipped plate the numbers describe: a later art change without --audit is a stale record
    const platePath = path.join(OUT, "plate.webp");
    const plateSha256 = !preview && fs.existsSync(platePath) ? createHash("sha256").update(fs.readFileSync(platePath)).digest("hex") : null;
    fs.writeFileSync(
      file,
      `${JSON.stringify(
        {
          kit: SCENE.SCENE_ASSET_BASE,
          plateSha256,
          rule: {
            visible: "share of the target's own pixels the finished plate shows (plate rendered with and without the target)",
            contrast: "F4 as written: mean-luminance ratio, visible target vs a 24 su ring, on the composed room",
            edge: "median luminance ratio across the visible silhouette's edge (each edge pixel vs the background within 3 su)",
            clutter: "share of busy pixels (Sobel luminance gradient > 40) in the ring 16–120 su around the object's box, on the shipped layers composed at rest",
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
