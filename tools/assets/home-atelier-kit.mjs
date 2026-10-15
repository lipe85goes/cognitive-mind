/**
 * HOME-WORLD-VISUAL-UNIFICATION-01 — the Home atelier kit.
 *
 * The shared presentation contract every Home world maquette is built on. The
 * Estúdio das Descobertas' Home maquette (GAME03-SKELETON-01, painted in SVG by
 * tools/assets/create_hidden_objects_scene.mjs --home) is the quality reference
 * the project owner chose; this module restates its technology and its
 * measurements so the other worlds are built the same way instead of beside it:
 *
 *   - one canvas: 1040×780, transparent, the maquette centred with real margin;
 *   - one pedestal: the Estúdio's turned-wood drum — same ellipse, same height,
 *     same rim and the same two inlay rings. Only the inlay's materials change
 *     per world (the Estúdio's is its red rug);
 *   - one camera: a floor plane seen from ~24° (the pedestal's ry/rx), so a
 *     board, a planter or a console all foreshorten alike (`floor`);
 *   - one light: a warm key from the upper left, every object shaded light→dark
 *     along it, plus one accent glow on the world's focal element;
 *   - one pass vocabulary, the Estúdio's: contact-shadow, base, back, main,
 *     detail, energy, front — the runtime paints them in that order
 *     (src/components/worlds/diorama/worldDioramaLayout.ts);
 *   - one encoding: WebP q82 (contact shadow q68), alpha q94, effort 6.
 *
 * The materials are the Estúdio's own gradients (its DEFS), restated here with
 * the few the other worlds need (slate, mineral stone, soil, patina, crystal).
 * Nothing in this file is runtime code; it is read only by the asset scripts.
 */

export const CANVAS = Object.freeze({ width: 1040, height: 780 });

/** The pedestal every world stands on — the Estúdio's numbers, verbatim. */
export const PLINTH = Object.freeze({ cx: 520, cy: 470, rx: 372, ry: 150, height: 40 });

/** The camera: the pedestal's own foreshortening, and how much a vertical height shrinks under it. */
export const CAMERA = Object.freeze({ k: PLINTH.ry / PLINTH.rx, rise: Math.cos(Math.asin(PLINTH.ry / PLINTH.rx)) });

/** The passes, back to front, with the order the runtime stacks them in. */
export const PASSES = Object.freeze(["contact-shadow", "base", "back", "main", "detail", "energy", "front"]);

/**
 * The passes that carry matter, and so receive the key light: it is laid onto
 * them where they are opaque (never into the air between objects). The detail
 * pass keeps its own colours (it lights up with focus), the energy pass is
 * light already.
 */
export const LIT_PASSES = Object.freeze(["base", "back", "main", "front"]);

/** The key light's strength on the maquette. */
export const KEY_LIGHT = 0.2;

/**
 * Passes made only of soft light and shadow carry no detail a full-size bitmap
 * would keep, so they ship at half resolution; the runtime stretches every
 * pass over the same 4:3 box, so nothing moves.
 */
export const RESOLUTION = Object.freeze({ "contact-shadow": 0.5, energy: 0.5 });

/**
 * The contact shadow is the same on every pedestal, so the kit ships it once
 * and every kit world points at it.
 */
export const SHARED_CONTACT_SHADOW = "shared/atelier-contact-shadow.webp";

/** Encoding shared by every pass (the Estúdio's). */
export const ENCODING = Object.freeze({
  default: { quality: 82, alphaQuality: 94, effort: 6 },
  "contact-shadow": { quality: 68, alphaQuality: 94, effort: 6 },
});

/**
 * Budgets (bytes, as encoded). The Estúdio's own kit is ~99 KB; the Home's
 * visual-system budget is ≤ 600 KB for the whole runtime Home.
 */
export const BUDGET = Object.freeze({ world: 130 * 1024, pass: 40 * 1024 });

export const n = (v) => Number(v.toFixed(1));

/** A seeded generator (the Estúdio's): the same maquette on every run. */
export function rng(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// --- the camera ----------------------------------------------------------------------------------

/**
 * A point on the pedestal's floor, in floor units (1 unit = 1 px across the
 * pedestal's width), turned by `angle` degrees around the pedestal's centre,
 * lifted `h` units off the inlay. Returns screen [x, y].
 */
export function floor(u, v, h = 0, { angle = 0, cx = PLINTH.cx, cy = PLINTH.cy } = {}) {
  const t = (angle * Math.PI) / 180;
  const x = u * Math.cos(t) - v * Math.sin(t);
  const y = u * Math.sin(t) + v * Math.cos(t);
  return [n(cx + x), n(cy + y * CAMERA.k - h * CAMERA.rise)];
}

/** The SVG matrix that lays a group drawn flat in floor units onto the pedestal (`floor`, at height h). */
export function floorMatrix({ angle = 0, h = 0, cx = PLINTH.cx, cy = PLINTH.cy } = {}) {
  const t = (angle * Math.PI) / 180;
  const k = CAMERA.k;
  const f = (v) => Number(v.toFixed(5));
  return `matrix(${f(Math.cos(t))} ${f(k * Math.sin(t))} ${f(-Math.sin(t))} ${f(k * Math.cos(t))} ${n(cx)} ${n(cy - h * CAMERA.rise)})`;
}

const pts = (list) => list.map(([x, y]) => `${n(x)},${n(y)}`).join(" ");

/**
 * A raised block on the floor: its footprint (a convex floor polygon) drawn as
 * a top face at height `top`, with the faces that look at the viewer drawn
 * from `bottom` to `top`. A face turned toward the key light (left) takes
 * `sideLight`, the others `side`.
 */
export function prism(footprint, { bottom = 0, top = 20, angle = 0, fill, side, sideLight, stroke = "none", strokeWidth = 1.2, cx, cy, topExtra = "" } = {}) {
  const at = (u, v, h) => floor(u, v, h, { angle, cx, cy });
  const ring = footprint.map(([u, v]) => ({ lo: at(u, v, bottom), hi: at(u, v, top) }));
  const centre = ring.reduce((c, r) => [c[0] + r.lo[0] / ring.length, c[1] + r.lo[1] / ring.length], [0, 0]);
  let faces = "";
  for (let i = 0; i < ring.length; i += 1) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    const dx = b.lo[0] - a.lo[0];
    const dy = b.lo[1] - a.lo[1];
    // the edge's outward normal, on screen: the face is seen when it points down (toward the viewer)
    let nx = dy;
    let ny = -dx;
    const mid = [(a.lo[0] + b.lo[0]) / 2 - centre[0], (a.lo[1] + b.lo[1]) / 2 - centre[1]];
    if (nx * mid[0] + ny * mid[1] < 0) {
      nx = -nx;
      ny = -ny;
    }
    if (ny <= 0.01) continue;
    const facesLight = nx < -0.2 * Math.abs(ny);
    faces += `<polygon points="${pts([a.lo, b.lo, b.hi, a.hi])}" fill="${facesLight ? sideLight ?? side : side}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;
  }
  const topFace = `<polygon points="${pts(ring.map((r) => r.hi))}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>`;
  return `<g>${faces}${topFace}${topExtra}</g>`;
}

/** A floor rectangle (centre u, v; size w × d) as a footprint for `prism`. */
export const rect = (u, v, w, d) => [
  [u - w / 2, v - d / 2],
  [u + w / 2, v - d / 2],
  [u + w / 2, v + d / 2],
  [u - w / 2, v + d / 2],
];

/** An upright cylinder on the floor: side band and top ellipse (radius r floor units, from h0 to h1). */
export function cylinder(u, v, r, { h0 = 0, h1 = 20, fill, side, stroke = "none", strokeWidth = 1.2, angle = 0, cx, cy } = {}) {
  const [x, yTop] = floor(u, v, h1, { angle, cx, cy });
  const [, yBot] = floor(u, v, h0, { angle, cx, cy });
  const ry = r * CAMERA.k;
  return `<path d="M${n(x - r)} ${n(yTop)} V${n(yBot)} A${n(r)} ${n(ry)} 0 0 0 ${n(x + r)} ${n(yBot)} V${n(yTop)} Z" fill="${side}" stroke="${stroke}" stroke-width="${strokeWidth}"/>
    <ellipse cx="${n(x)}" cy="${n(yTop)}" rx="${n(r)}" ry="${n(ry)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
}

// --- shared paint ----------------------------------------------------------------------------------

/**
 * The Estúdio's materials (create_hidden_objects_scene.mjs DEFS), restated, and
 * the few the other worlds add. Every gradient runs light (top-left, the key)
 * to dark (bottom-right).
 */
export const DEFS = `
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
  <linearGradient id="woodLight" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#c99063"/><stop offset=".6" stop-color="#a06a40"/><stop offset="1" stop-color="#6e4224"/>
  </linearGradient>
  <linearGradient id="brass" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f3d68a"/><stop offset=".45" stop-color="#c39443"/><stop offset="1" stop-color="#7a5521"/>
  </linearGradient>
  <linearGradient id="brassV" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#efd086"/><stop offset=".5" stop-color="#bb8b3d"/><stop offset="1" stop-color="#6e4b1c"/>
  </linearGradient>
  <linearGradient id="brassH" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#efd086"/><stop offset=".45" stop-color="#bb8b3d"/><stop offset="1" stop-color="#6e4b1c"/>
  </linearGradient>
  <linearGradient id="brassDim" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#cfae6a"/><stop offset=".5" stop-color="#9c7536"/><stop offset="1" stop-color="#5e4119"/>
  </linearGradient>
  <linearGradient id="bronzeAged" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#ad8d50"/><stop offset=".5" stop-color="#7e6130"/><stop offset="1" stop-color="#4a3818"/>
  </linearGradient>
  <linearGradient id="iron" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#5b5752"/><stop offset="1" stop-color="#26231f"/>
  </linearGradient>
  <linearGradient id="leather" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#557f60"/><stop offset=".5" stop-color="#30523d"/><stop offset="1" stop-color="#162d22"/>
  </linearGradient>
  <linearGradient id="leatherDark" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#4a3a2c"/><stop offset=".5" stop-color="#2d231a"/><stop offset="1" stop-color="#17110c"/>
  </linearGradient>
  <linearGradient id="parchment" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#f3e3bd"/><stop offset=".6" stop-color="#e3cb96"/><stop offset="1" stop-color="#c7a96f"/>
  </linearGradient>
  <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#7ea35a"/><stop offset="1" stop-color="#2f5a2c"/>
  </linearGradient>
  <linearGradient id="leafLight" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#a9c972"/><stop offset="1" stop-color="#4f7a36"/>
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
  <linearGradient id="slate" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#6f8a86"/><stop offset=".55" stop-color="#4b6461"/><stop offset="1" stop-color="#2c3d3b"/>
  </linearGradient>
  <linearGradient id="slateSide" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#3d5250"/><stop offset="1" stop-color="#1e2b2a"/>
  </linearGradient>
  <linearGradient id="stone" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#e4dcc6"/><stop offset=".55" stop-color="#bdb299"/><stop offset="1" stop-color="#857a62"/>
  </linearGradient>
  <linearGradient id="stoneSide" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#a69b82"/><stop offset="1" stop-color="#5f5644"/>
  </linearGradient>
  <linearGradient id="stoneGrey" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#9aa39b"/><stop offset=".55" stop-color="#727c75"/><stop offset="1" stop-color="#454d48"/>
  </linearGradient>
  <linearGradient id="stoneGreySide" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#5f6862"/><stop offset="1" stop-color="#323833"/>
  </linearGradient>
  <linearGradient id="patina" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#8fc7b5"/><stop offset=".5" stop-color="#4f9483"/><stop offset="1" stop-color="#255449"/>
  </linearGradient>
  <linearGradient id="copper" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#e8a67a"/><stop offset=".5" stop-color="#b56a3e"/><stop offset="1" stop-color="#6d3a1c"/>
  </linearGradient>
  <linearGradient id="soil" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#6b4a30"/><stop offset=".6" stop-color="#4a3120"/><stop offset="1" stop-color="#2c1c11"/>
  </linearGradient>
  <linearGradient id="burlap" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#d9bb86"/><stop offset=".6" stop-color="#b08e58"/><stop offset="1" stop-color="#7a5f35"/>
  </linearGradient>
  <linearGradient id="glass" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#ffffff" stop-opacity=".46"/><stop offset=".3" stop-color="#e7f6f2" stop-opacity=".14"/><stop offset=".8" stop-color="#cfeee6" stop-opacity=".1"/><stop offset="1" stop-color="#bfe0d8" stop-opacity=".34"/>
  </linearGradient>
  <radialGradient id="contact" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#0b0704" stop-opacity=".62"/><stop offset="1" stop-color="#0b0704" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="tealCrystal" cx=".35" cy=".3" r=".8">
    <stop offset="0" stop-color="#e9fffb"/><stop offset=".35" stop-color="#7fe6d6"/><stop offset=".75" stop-color="#2aa797"/><stop offset="1" stop-color="#0f5f56"/>
  </radialGradient>
  <radialGradient id="tealPool" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#c8fff6" stop-opacity=".95"/><stop offset=".45" stop-color="#63ddca" stop-opacity=".7"/><stop offset="1" stop-color="#0d4c4a" stop-opacity=".9"/>
  </radialGradient>
  <radialGradient id="amberOrb" cx=".38" cy=".34" r=".7">
    <stop offset="0" stop-color="#fffbe6"/><stop offset=".35" stop-color="#ffd978"/><stop offset=".8" stop-color="#e6a21f"/><stop offset="1" stop-color="#9c6510"/>
  </radialGradient>
  <radialGradient id="glowWarm" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#ffd27a" stop-opacity=".7"/><stop offset=".4" stop-color="#ffb04a" stop-opacity=".28"/><stop offset="1" stop-color="#ff9d2e" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="glowTeal" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#9ff3e4" stop-opacity=".72"/><stop offset=".42" stop-color="#4fd0bd" stop-opacity=".26"/><stop offset="1" stop-color="#2bb3a0" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="glowGreen" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#e6f7a6" stop-opacity=".66"/><stop offset=".45" stop-color="#a8d36a" stop-opacity=".22"/><stop offset="1" stop-color="#7fb446" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="spineShade" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#ffffff" stop-opacity=".22"/><stop offset=".35" stop-color="#ffffff" stop-opacity=".04"/><stop offset=".7" stop-color="#000000" stop-opacity=".08"/><stop offset="1" stop-color="#000000" stop-opacity=".34"/>
  </linearGradient>
  <filter id="blur3" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3"/></filter>
  <filter id="blur8" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="8"/></filter>
  <filter id="blur16" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter>
  <filter id="softSmall" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="14"/></filter>
  <filter id="keyWash" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="38"/></filter>
  <linearGradient id="wallStone" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#b3aa94"/><stop offset=".55" stop-color="#8f8671"/><stop offset="1" stop-color="#635b4a"/>
  </linearGradient>
  <linearGradient id="wallStoneSide" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#6f6754"/><stop offset="1" stop-color="#3f392e"/>
  </linearGradient>
  <linearGradient id="mineral" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#d3cab3"/><stop offset=".5" stop-color="#ada38a"/><stop offset="1" stop-color="#776d57"/>
  </linearGradient>
  <linearGradient id="mineralSide" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#8d836b"/><stop offset="1" stop-color="#4f4737"/>
  </linearGradient>
  <linearGradient id="lavender" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#b9a9e0"/><stop offset="1" stop-color="#6f5fa0"/>
  </linearGradient>
`;

/** The Estúdio's contact shadow under one object. */
export const shadow = (cx, cy, rx, ry, o = 1) =>
  `<ellipse cx="${n(cx)}" cy="${n(cy)}" rx="${n(rx)}" ry="${n(ry)}" fill="url(#contact)" opacity="${o}"/>`;

/** Ambient occlusion where two surfaces meet (the Estúdio's). */
export const occlusion = (x, y, w, h, o = 0.5) =>
  `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="#0b0704" opacity="${o}" filter="url(#blur8)"/>`;

/** One pass as a standalone SVG on the shared canvas. */
export const wrap = (body, extraDefs = "") =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS.width}" height="${CANVAS.height}" viewBox="0 0 ${CANVAS.width} ${CANVAS.height}"><defs>${DEFS}${extraDefs}</defs>${body}</svg>`;

// --- the pedestal ---------------------------------------------------------------------------------

/** The contact shadow pass — identical for every world (the Estúdio's). */
export function contactShadowPass() {
  const { cx, cy, rx, ry } = PLINTH;
  return wrap(`<ellipse cx="${cx}" cy="${cy + 74}" rx="${rx + 30}" ry="${ry + 26}" fill="url(#contact)"/>`);
}

/**
 * The base pass: the Estúdio's turned-wood drum and rim, verbatim, then the
 * world's inlay — a field (`inlay`), the metal ring (`ring`) and the outer
 * world ring (`band`), at the Estúdio's offsets — and whatever the world etches
 * into its inlay (`etching`, drawn in floor coordinates, clipped to the field).
 */
export function basePass({ inlay, ring, band, bandWidth = 10, etching = "", extraDefs = "" }) {
  const { cx, cy, rx, ry, height } = PLINTH;
  const clip = `<clipPath id="inlayClip"><ellipse cx="${cx}" cy="${cy}" rx="${rx - 26}" ry="${ry - 12}"/></clipPath>`;
  return wrap(
    `
      <ellipse cx="${cx}" cy="${cy + height}" rx="${rx}" ry="${ry}" fill="#5a3418" stroke="#2b170b" stroke-width="3"/>
      <path d="M${cx - rx} ${cy} V${cy + height} A${rx} ${ry} 0 0 0 ${cx + rx} ${cy + height} V${cy} Z" fill="url(#woodH)" stroke="#2b170b" stroke-width="3"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#b0784a" stroke="#6b3b1f" stroke-width="6"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${rx - 26}" ry="${ry - 12}" fill="${inlay}"/>
      <g clip-path="url(#inlayClip)">${etching}</g>
      <ellipse cx="${cx}" cy="${cy}" rx="${rx - 50}" ry="${ry - 24}" fill="none" stroke="${ring}" stroke-width="4"/>
      <ellipse cx="${cx}" cy="${cy}" rx="${rx - 70}" ry="${ry - 34}" fill="none" stroke="${band}" stroke-width="${bandWidth}"/>`,
    `${clip}${extraDefs}`,
  );
}

/**
 * The shared key light: the atelier's warm light falling from the upper left
 * across the pedestal (the Estúdio's window light). A world without a window
 * has no edge for it to come through, so here it is a broad, soft wash from
 * beyond the canvas — light on the maquette, never a shape of its own.
 */
export function keyShaft({ opacity = 0.12, color = "#ffe2a8" } = {}) {
  const { cx, cy } = PLINTH;
  return `<g filter="url(#keyWash)"><path d="M${cx - 470} ${cy - 360} L${cx - 150} ${cy - 360} L${cx + 300} ${cy + 70} L${cx - 230} ${cy + 70} Z" fill="${color}" opacity="${opacity}"/></g>`;
}

/**
 * An upright member (a post, a stem, a pipe) as a filled rect. A gradient on a
 * perfectly vertical stroke has an empty bounding box and paints nothing, so
 * straight uprights are always drawn this way.
 */
export const post = (x, yTop, yBottom, width, fill, { stroke = "none", strokeWidth = 1, radius } = {}) =>
  `<rect x="${n(x - width / 2)}" y="${n(Math.min(yTop, yBottom))}" width="${n(width)}" height="${n(Math.abs(yBottom - yTop))}" rx="${n(radius ?? width / 2)}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;

/** A glow halo (the Estúdio's lantern glow), in one of the kit's glow paints. */
export const glow = (x, y, r, paint = "glowWarm", opacity = 1) =>
  `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="url(#${paint})" opacity="${opacity}"/>`;

/** A small fern-like tuft of leaves standing at (x, y). */
export function tuft(x, y, scale = 1, seed = 1, { fill = "url(#leaf)", dark = "url(#leafDark)" } = {}) {
  const rnd = rng(seed);
  let out = "";
  const blades = 7;
  for (let i = 0; i < blades; i += 1) {
    const a = -70 + (140 * i) / (blades - 1) + (rnd() - 0.5) * 12;
    const len = (28 + rnd() * 22) * scale;
    const w = (6 + rnd() * 3) * scale;
    const rad = (a * Math.PI) / 180;
    const tx = x + Math.sin(rad) * len;
    const ty = y - Math.cos(rad) * len;
    out += `<path d="M${n(x - w * 0.4)} ${n(y)} Q${n(x + Math.sin(rad) * len * 0.5 - w)} ${n(y - Math.cos(rad) * len * 0.6)} ${n(tx)} ${n(ty)} Q${n(x + Math.sin(rad) * len * 0.5 + w)} ${n(y - Math.cos(rad) * len * 0.5)} ${n(x + w * 0.4)} ${n(y)} Z" fill="${i % 2 ? dark : fill}" stroke="#1f3a1c" stroke-width=".8" stroke-opacity=".6"/>`;
  }
  return out;
}
