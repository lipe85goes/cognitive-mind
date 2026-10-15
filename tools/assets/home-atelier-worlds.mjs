/**
 * HOME-WORLD-VISUAL-UNIFICATION-01 — the four Home maquettes painted with the atelier kit.
 *
 * Each world is the same pedestal, camera and light (home-atelier-kit.mjs) with
 * its own subject. What every world keeps, the way the Estúdio's maquette does:
 *   - an inlay of its own material, inside the shared gold ring and its own band;
 *   - something rising at the back (the Estúdio's window and bookcase) so the
 *     world has a silhouette and not just a floor;
 *   - one principal object on the pedestal, shaded along the key light;
 *   - small details that catch the accent when the world is in focus;
 *   - light: the warm key shaft and one accent glow on the focal element;
 *   - something in front, over the pedestal's rim, so the maquette has depth.
 *
 * Each world says what it is in its own language and never borrows the
 * Estúdio's subject (no window, bookcase, rug or desk).
 */
import {
  PLINTH,
  basePass,
  contactShadowPass,
  cylinder,
  floor,
  floorMatrix,
  glow,
  n,
  occlusion,
  post,
  prism,
  rect,
  rng,
  shadow,
  tuft,
  wrap,
} from "./home-atelier-kit.mjs";

const { cx, cy } = PLINTH;

/** The atelier's gold line — the same inner ring on every pedestal (the Estúdio's). */
const GOLD_RING = "#d9a85a";

// --- shared organic and crafted pieces ------------------------------------------------------------

/** One leaf: base at (x, y), pointing at `angle` degrees (0 = up). */
function leaf(x, y, len, width, angle, fill = "url(#leaf)", { vein = true, stroke = "#1f3a1c" } = {}) {
  const t = (angle * Math.PI) / 180;
  const tx = x + Math.sin(t) * len;
  const ty = y - Math.cos(t) * len;
  const mx = x + Math.sin(t) * len * 0.5;
  const my = y - Math.cos(t) * len * 0.5;
  const ox = Math.cos(t) * width;
  const oy = Math.sin(t) * width;
  return `<path d="M${n(x)} ${n(y)} Q${n(mx - ox)} ${n(my - oy)} ${n(tx)} ${n(ty)} Q${n(mx + ox)} ${n(my + oy)} ${n(x)} ${n(y)} Z" fill="${fill}" stroke="${stroke}" stroke-width=".9" stroke-opacity=".55"/>${
    vein ? `<path d="M${n(x)} ${n(y)} L${n(x + Math.sin(t) * len * 0.82)} ${n(y - Math.cos(t) * len * 0.82)}" stroke="#d8eab0" stroke-width=".8" opacity=".35"/>` : ""
  }`;
}

/** A small flower: petals around a heart. */
function flower(x, y, r, { petals = 6, fill = "#f6d27a", edge = "#b9822a", heart = "#8a4e1c", turn = 0 } = {}) {
  let out = "";
  for (let i = 0; i < petals; i += 1) {
    const a = turn + (360 / petals) * i;
    out += `<ellipse cx="${n(x)}" cy="${n(y - r * 0.55)}" rx="${n(r * 0.42)}" ry="${n(r * 0.62)}" fill="${fill}" stroke="${edge}" stroke-width=".8" transform="rotate(${n(a)} ${n(x)} ${n(y)})"/>`;
  }
  return `${out}<circle cx="${n(x)}" cy="${n(y)}" r="${n(r * 0.36)}" fill="${heart}"/><circle cx="${n(x - r * 0.1)}" cy="${n(y - r * 0.12)}" r="${n(r * 0.14)}" fill="#ffe7a8" opacity=".7"/>`;
}

/** A vine winding up a straight pole from (x0, y0) to (x1, y1), with leaves. */
function vineUp(x0, y0, x1, y1, seed, { turns = 3.2, amp = 10, leaves = 9, scale = 1, blossoms = [] } = {}) {
  const rnd = rng(seed);
  const steps = 40;
  let d = "";
  const at = (t) => {
    const x = x0 + (x1 - x0) * t + Math.sin(t * Math.PI * 2 * turns) * amp * (1 - t * 0.4);
    const y = y0 + (y1 - y0) * t;
    return [x, y];
  };
  for (let i = 0; i <= steps; i += 1) {
    const [x, y] = at(i / steps);
    d += `${i ? "L" : "M"}${n(x)} ${n(y)} `;
  }
  let out = `<path d="${d}" stroke="#3b5f2c" stroke-width="${n(2.6 * scale)}" fill="none" stroke-linecap="round"/>`;
  for (let i = 0; i < leaves; i += 1) {
    const t = 0.06 + (0.9 * i) / leaves + rnd() * 0.03;
    const [x, y] = at(t);
    const side = i % 2 ? 1 : -1;
    out += leaf(x, y, (15 + rnd() * 8) * scale, (6 + rnd() * 2) * scale, side * (48 + rnd() * 26), i % 3 ? "url(#leaf)" : "url(#leafLight)");
  }
  for (const t of blossoms) {
    const [x, y] = at(t);
    out += flower(x + 4, y, 6.5 * scale, { petals: 5, fill: "#fbf1dc", edge: "#c9b083", heart: "#e2a73a" });
  }
  return out;
}

/** A rounded shrub: overlapping leaf masses, darker below, catching the key light on the upper left. */
function shrub(x, y, w, h, seed, { flowers = 0, flowerFill = "#fbf1dc", spikes = 0 } = {}) {
  const rnd = rng(seed);
  let out = shadow(x, y + 2, w * 0.62, h * 0.12, 0.8);
  const blobs = [];
  for (let i = 0; i < 9; i += 1) {
    const bx = x + (rnd() - 0.5) * w * 0.8;
    const by = y - h * 0.25 - rnd() * h * 0.55;
    blobs.push([bx, by, (0.22 + rnd() * 0.16) * w]);
  }
  blobs.sort((a, b) => a[1] - b[1]);
  for (const [bx, by, r] of blobs) out += `<circle cx="${n(bx)}" cy="${n(by)}" r="${n(r)}" fill="url(#leafDeep)"/>`;
  for (const [bx, by, r] of blobs) out += `<circle cx="${n(bx - r * 0.18)}" cy="${n(by - r * 0.2)}" r="${n(r * 0.78)}" fill="url(#leafDark)"/>`;
  for (const [bx, by, r] of blobs.slice(0, 5)) out += `<circle cx="${n(bx - r * 0.34)}" cy="${n(by - r * 0.38)}" r="${n(r * 0.42)}" fill="url(#leaf)" opacity=".85"/>`;
  for (let i = 0; i < 34; i += 1) {
    const [bx, by, r] = blobs[Math.floor(rnd() * blobs.length)];
    const a = rnd() * Math.PI * 2;
    const lx = bx + Math.cos(a) * r * 0.75;
    const ly = by + Math.sin(a) * r * 0.75;
    const lit = lx < x && ly < y - h * 0.4;
    out += leaf(lx, ly, 9 + rnd() * 5, 3.6, rnd() * 360, lit ? "url(#leafLight)" : rnd() < 0.5 ? "url(#leaf)" : "url(#leafDark)", { vein: false, stroke: "#173018" });
  }
  out += `<path d="M${n(x - w * 0.46)} ${n(y)} Q${n(x)} ${n(y + h * 0.08)} ${n(x + w * 0.46)} ${n(y)}" fill="#112815" opacity=".6"/>`;
  for (let i = 0; i < spikes; i += 1) {
    const sx = x + (rnd() - 0.5) * w * 0.7;
    const top = y - h * (0.85 + rnd() * 0.4);
    out += `<path d="M${n(sx)} ${n(y - h * 0.3)} L${n(sx + (rnd() - 0.5) * 6)} ${n(top)}" stroke="#4f6a3a" stroke-width="1.6"/>`;
    for (let k = 0; k < 6; k += 1) out += `<ellipse cx="${n(sx + (k % 2 ? 2 : -2))}" cy="${n(top + k * 5)}" rx="3.2" ry="4" fill="url(#lavender)"/>`;
  }
  for (let i = 0; i < flowers; i += 1) {
    const [bx, by, r] = blobs[Math.floor(rnd() * blobs.length)];
    out += flower(bx + (rnd() - 0.5) * r, by - r * 0.3 + (rnd() - 0.5) * r * 0.6, 4.5, { petals: 5, fill: flowerFill, edge: "#c9b083", heart: "#e2a73a", turn: rnd() * 60 });
  }
  return out;
}

/** Weathered stone, in a few tones so a wall of blocks never reads as one moulded piece. */
const STONE_TONES = [
  { top: "#8f8775", light: "#7d7564", side: "#4d473b" },
  { top: "#857e6e", light: "#736c5d", side: "#463f35" },
  { top: "#99917d", light: "#867e6b", side: "#544c3f" },
  { top: "#7d7868", light: "#6c6759", side: "#403b32" },
];

/** A rounded pebble at (x, y). */
const pebble = (x, y, rx, ry, fill = "url(#stoneGrey)") =>
  `<ellipse cx="${n(x)}" cy="${n(y + ry * 0.35)}" rx="${n(rx * 1.02)}" ry="${n(ry * 0.8)}" fill="#0b0704" opacity=".28"/><ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(rx)}" ry="${n(ry)}" fill="${fill}" stroke="#2c302c" stroke-width=".8" stroke-opacity=".5"/><ellipse cx="${n(x - rx * 0.3)}" cy="${n(y - ry * 0.35)}" rx="${n(rx * 0.35)}" ry="${n(ry * 0.25)}" fill="#ffffff" opacity=".18"/>`;

// --- Jardim de Sementes ----------------------------------------------------------------------------

/**
 * Cultivation, in the game's own terms: the sowing bench of six terracotta
 * pots ("tabuleiro com seis vasos") with seeds to count in them, a sprout and
 * the flowering plant the cycle ends in — a bean teepee climbing at the back,
 * a low hedge, a glass cloche keeping a seedling, the watering can and the
 * seed sack in front.
 */
function gardenPasses() {
  const etching = (() => {
    const rnd = rng(23);
    let out = `<ellipse cx="${cx}" cy="${cy + 6}" rx="230" ry="80" fill="url(#soil)" opacity=".85"/>`;
    // furrows across the bed, in floor perspective
    for (let i = -3; i <= 3; i += 1) {
      const [x0, y0] = floor(-230, i * 30);
      const [x1, y1] = floor(230, i * 30);
      out += `<path d="M${x0} ${y0} L${x1} ${y1}" stroke="#2a1a0f" stroke-width="2" opacity=".35"/>`;
    }
    // moss tufts and small stones on the bed's edge
    for (let i = 0; i < 46; i += 1) {
      const a = rnd() * Math.PI * 2;
      const r = 250 + rnd() * 80;
      const [x, y] = floor(Math.cos(a) * r, Math.sin(a) * r);
      out += rnd() < 0.7
        ? `<ellipse cx="${x}" cy="${y}" rx="${n(5 + rnd() * 7)}" ry="${n(2.4 + rnd() * 2.4)}" fill="${rnd() < 0.5 ? "#5f7c3c" : "#4e6934"}" opacity=".55"/>`
        : `<ellipse cx="${x}" cy="${y}" rx="${n(3 + rnd() * 4)}" ry="${n(2 + rnd() * 2)}" fill="#a49b86" opacity=".85"/>`;
    }
    return out;
  })();

  const base = basePass({ inlay: "#3c4a26", ring: GOLD_RING, band: "#4f7a36", etching });

  // back: the bean teepee (left) and the cloche on its stump (right)
  const teepee = (() => {
    const [bx, by] = floor(-215, -160);
    const apex = [bx + 6, by - 300];
    const feet = [[bx - 52, by + 10], [bx + 54, by + 6], [bx + 4, by - 16]];
    let out = shadow(bx, by + 8, 78, 16, 0.8);
    out += `<path d="M${feet[2][0]} ${feet[2][1]} L${apex[0]} ${apex[1]}" stroke="#7a5a33" stroke-width="5" stroke-linecap="round"/>`;
    out += vineUp(feet[2][0], feet[2][1], apex[0], apex[1] + 24, 5, { turns: 2.4, amp: 7, leaves: 8, scale: 0.9 });
    for (const [i, [fx, fy]] of feet.slice(0, 2).entries()) {
      out += `<path d="M${n(fx)} ${n(fy)} L${n(apex[0])} ${n(apex[1])}" stroke="url(#woodLight)" stroke-width="6" stroke-linecap="round"/>`;
      out += `<path d="M${n(fx + 2)} ${n(fy)} L${n(apex[0] + 1)} ${n(apex[1] + 2)}" stroke="#f0d2a0" stroke-width="1.4" opacity=".35"/>`;
      out += vineUp(fx, fy, apex[0] + (i ? 4 : -4), apex[1] + 30, 11 + i * 7, { turns: 3.4, amp: 9, leaves: 11, blossoms: i ? [0.42, 0.7] : [0.3, 0.62, 0.84] });
    }
    // the twine binding the poles, and a few seed pods hanging
    out += `<path d="M${n(apex[0] - 10)} ${n(apex[1] + 16)} L${n(apex[0] + 11)} ${n(apex[1] + 12)} M${n(apex[0] - 9)} ${n(apex[1] + 21)} L${n(apex[0] + 10)} ${n(apex[1] + 18)}" stroke="#d8bb86" stroke-width="2.4"/>`;
    for (const [dx, dy] of [[-22, 92], [26, 140], [-30, 196]]) {
      out += `<path d="M${n(apex[0] + dx)} ${n(apex[1] + dy)} q4 22 -2 34" stroke="#6f9a3e" stroke-width="4" fill="none" stroke-linecap="round"/>`;
    }
    return out;
  })();

  const cloche = (() => {
    const [sx, sy] = floor(215, -150);
    let out = shadow(sx, sy + 6, 70, 15, 0.85);
    // a tree-stump stand
    out += cylinder(215, -150, 46, { h0: 0, h1: 70, fill: "#c79a68", side: "url(#woodH)", stroke: "#3a2212", strokeWidth: 1.6 });
    const [tx, ty] = floor(215, -150, 70);
    out += `<ellipse cx="${tx}" cy="${ty}" rx="34" ry="13" fill="none" stroke="#9a6c3e" stroke-width="1.4" opacity=".7"/><ellipse cx="${tx}" cy="${ty}" rx="20" ry="7.5" fill="none" stroke="#9a6c3e" stroke-width="1.2" opacity=".6"/>`;
    // a small clay pot with a seedling, under the glass
    out += `<path d="M${tx - 20} ${ty - 30} H${tx + 20} L${tx + 15} ${ty} H${tx - 15} Z" fill="url(#terracotta)" stroke="#4a2410" stroke-width="1.1"/>`;
    out += `<rect x="${tx - 23}" y="${ty - 36}" width="46" height="8" rx="3" fill="#bb6a3d" stroke="#4a2410" stroke-width="1"/>`;
    out += `<ellipse cx="${tx}" cy="${ty - 35}" rx="18" ry="4" fill="#3a2414"/>`;
    out += `<path d="M${tx} ${ty - 36} C${tx - 2} ${ty - 56} ${tx + 3} ${ty - 66} ${tx + 1} ${ty - 78}" stroke="#4f7a36" stroke-width="2.6" fill="none"/>`;
    out += leaf(tx + 1, ty - 60, 22, 8, -62, "url(#leafLight)") + leaf(tx + 1, ty - 66, 24, 8, 58, "url(#leaf)") + leaf(tx + 1, ty - 78, 18, 6, 6, "url(#leafLight)");
    // the bell jar
    const gx = tx;
    const gy = ty;
    out += `<path d="M${gx - 52} ${gy + 2} V${gy - 92} C${gx - 52} ${gy - 160} ${gx + 52} ${gy - 160} ${gx + 52} ${gy - 92} V${gy + 2} Z" fill="url(#glass)" stroke="#d9efe9" stroke-width="1.6" stroke-opacity=".7"/>`;
    out += `<ellipse cx="${gx}" cy="${gy + 2}" rx="52" ry="12" fill="none" stroke="#d9efe9" stroke-width="1.8" stroke-opacity=".6"/>`;
    out += `<path d="M${gx - 38} ${gy - 100} C${gx - 36} ${gy - 136} ${gx - 12} ${gy - 146} ${gx + 6} ${gy - 148}" stroke="#ffffff" stroke-width="4" fill="none" opacity=".45" stroke-linecap="round"/>`;
    out += `<circle cx="${gx}" cy="${gy - 160}" r="9" fill="url(#brass)" stroke="#6e4b1c" stroke-width="1.2"/>`;
    return out;
  })();

  // main: the sowing bench — six terracotta pots in a row, the game's board
  const SEEDS = [3, 1, 0, 0, 4, 2];
  const bench = (() => {
    const angle = -6;
    const at = (u, v, h) => floor(u, v, h, { angle });
    let out = shadow(...at(0, 50, 0), 262, 44, 0.9);
    // a low cedar bench on two trestles
    for (const u of [-180, 180]) out += prism(rect(u, 40, 34, 84), { top: 20, angle, fill: "#6e4428", side: "url(#woodH)", sideLight: "url(#woodLight)", stroke: "#2b170b", strokeWidth: 1.4 });
    out += prism(rect(0, 40, 480, 100), { bottom: 20, top: 34, angle, fill: "#9a6a40", side: "url(#woodH)", sideLight: "url(#woodLight)", stroke: "#2b170b", strokeWidth: 1.8 });
    for (const v of [6, 40, 74]) {
      const [x0, y0] = at(-236, v, 34.5);
      const [x1, y1] = at(236, v, 34.5);
      out += `<path d="M${x0} ${y0} L${x1} ${y1}" stroke="#5e3a20" stroke-width="1.2" opacity=".55"/>`;
    }
    const pots = [];
    for (let i = 0; i < 6; i += 1) {
      const u = -200 + i * 80;
      const [x, y] = at(u, 40, 34);
      const r = 30;
      const h = 34;
      out += shadow(x + 3, y + 2, r * 1.05, 7, 0.9);
      out += `<path d="M${n(x - r)} ${n(y - h)} L${n(x - r * 0.74)} ${n(y)} A${n(r * 0.74)} ${n(r * 0.26)} 0 0 0 ${n(x + r * 0.74)} ${n(y)} L${n(x + r)} ${n(y - h)} Z" fill="url(#terracotta)" stroke="#4a2410" stroke-width="1.3"/>`;
      out += `<path d="M${n(x - r * 0.72)} ${n(y - h + 4)} L${n(x - r * 0.56)} ${n(y - 3)}" stroke="#f1b083" stroke-width="2.4" opacity=".35" stroke-linecap="round"/>`;
      out += `<ellipse cx="${n(x)}" cy="${n(y - h)}" rx="${n(r + 3)}" ry="${n(r * 0.36)}" fill="#bb6a3d" stroke="#4a2410" stroke-width="1.3"/>`;
      out += `<ellipse cx="${n(x)}" cy="${n(y - h + 1)}" rx="${n(r - 3)}" ry="${n(r * 0.27)}" fill="url(#soil)"/>`;
      pots.push([x, y - h + 1]);
    }
    // the cycle, read left to right: seeds, a sprout in the third pot, the flowering plant in the fourth
    const [sx, sy] = pots[2];
    out += `<path d="M${sx} ${sy} C${sx - 2} ${sy - 16} ${sx + 3} ${sy - 28} ${sx} ${sy - 42}" stroke="#5f8a3a" stroke-width="3.2" fill="none" stroke-linecap="round"/>`;
    out += leaf(sx, sy - 32, 24, 10, -70, "url(#leafLight)") + leaf(sx, sy - 36, 26, 10, 66, "url(#leaf)") + leaf(sx, sy - 42, 15, 6, 4, "url(#leafLight)");
    const [fx, fy] = pots[3];
    out += `<path d="M${fx} ${fy} C${fx - 4} ${fy - 40} ${fx + 6} ${fy - 72} ${fx + 2} ${fy - 108}" stroke="#4f7a36" stroke-width="4.4" fill="none" stroke-linecap="round"/>`;
    out += `<path d="M${fx + 1} ${fy - 66} C${fx + 18} ${fy - 78} ${fx + 28} ${fy - 82} ${fx + 34} ${fy - 96}" stroke="#4f7a36" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    const rnd = rng(41);
    for (let i = 0; i < 9; i += 1) {
      const h = 12 + i * 9.5;
      const side = i % 2 ? 1 : -1;
      out += leaf(fx + side * 2, fy - h, 24 + rnd() * 10, 9.5, side * (56 + rnd() * 20), i % 3 ? "url(#leaf)" : "url(#leafDark)");
    }
    return { svg: out, pots };
  })();

  // detail: the seeds to count, the dew and the bloom — what lights up with the world's focus
  const detail = (() => {
    let out = "";
    const spots = [[0, 0], [-11, -2], [11, -1], [-5, 3], [6, 3]];
    for (const [i, [px, py]] of bench.pots.entries()) {
      for (let k = 0; k < SEEDS[i]; k += 1) {
        const [dx, dy] = spots[k];
        out += `<ellipse cx="${n(px + dx)}" cy="${n(py + dy - 1)}" rx="4.4" ry="3" fill="#e8c27a" stroke="#7a5521" stroke-width=".8"/><ellipse cx="${n(px + dx - 1)}" cy="${n(py + dy - 2)}" rx="1.6" ry="1" fill="#fff4d0" opacity=".85"/>`;
      }
    }
    const [sx, sy] = bench.pots[2];
    out += `<circle cx="${sx - 17}" cy="${sy - 38}" r="2.6" fill="#dff6ff" opacity=".85"/><circle cx="${sx + 21}" cy="${sy - 44}" r="2.2" fill="#dff6ff" opacity=".8"/>`;
    const [fx, fy] = bench.pots[3];
    out += flower(fx + 2, fy - 112, 17, { petals: 8, fill: "#f6d27a", edge: "#c08a2c", heart: "#7a4a1c", turn: 10 });
    out += flower(fx + 36, fy - 100, 11, { petals: 7, fill: "#f3c58a", edge: "#b9822a", heart: "#7a4a1c", turn: 20 });
    out += `<ellipse cx="${fx - 22}" cy="${fy - 80}" rx="6" ry="8" fill="#9cc565" stroke="#4f7a36" stroke-width="1"/>`;
    return out;
  })();

  const energy = (() => {
    const [m3x, m3y0] = bench.pots[3];
    const m3y = m3y0 + 4;
    const rnd = rng(7);
    let motes = "";
    for (let i = 0; i < 9; i += 1) motes += `<circle cx="${n(m3x - 80 + rnd() * 200)}" cy="${n(m3y - 200 + rnd() * 120)}" r="${n(1.6 + rnd() * 1.8)}" fill="#fff3c4" opacity="${n(0.4 + rnd() * 0.4)}"/>`;
    return `${glow(m3x + 6, m3y - 104, 92, "glowGreen")}${glow(m3x + 4, m3y - 106, 44, "glowWarm", 0.8)}${motes}`;
  })();

  // front: the seed pouch (left) and the watering can (right), over the rim
  const front = (() => {
    let out = "";
    // the seed sack, tied at the neck, a few seeds spilled beside it
    const px = cx - 270;
    const py = cy + 130;
    out += shadow(px + 10, py + 4, 56, 11, 0.9);
    out += `<g transform="rotate(-7 ${px} ${py})">`;
    out += `<path d="M${px - 38} ${py} C${px - 50} ${py - 26} ${px - 38} ${py - 50} ${px - 14} ${py - 58} L${px + 14} ${py - 58} C${px + 38} ${py - 50} ${px + 50} ${py - 26} ${px + 38} ${py} Q${px} ${py + 9} ${px - 38} ${py} Z" fill="url(#burlap)" stroke="#5e4424" stroke-width="1.6"/>`;
    out += `<path d="M${px - 30} ${py - 18} C${px - 12} ${py - 12} ${px + 14} ${py - 13} ${px + 32} ${py - 20} M${px - 34} ${py - 34} C${px - 14} ${py - 28} ${px + 14} ${py - 29} ${px + 36} ${py - 36}" stroke="#7a5f35" stroke-width="1" fill="none" opacity=".5"/>`;
    out += `<path d="M${px - 14} ${py - 58} C${px - 32} ${py - 64} ${px - 28} ${py - 80} ${px - 12} ${py - 78} C${px - 4} ${py - 88} ${px + 8} ${py - 88} ${px + 13} ${py - 78} C${px + 30} ${py - 82} ${px + 32} ${py - 64} ${px + 14} ${py - 58} Z" fill="#c9aa74" stroke="#5e4424" stroke-width="1.4"/>`;
    out += `<ellipse cx="${px}" cy="${py - 77}" rx="13" ry="4" fill="#4a3120"/>`;
    for (const [dx, dy] of [[-6, -78], [0, -79], [6, -77], [-2, -76]]) out += `<ellipse cx="${px + dx}" cy="${py + dy}" rx="2.6" ry="1.8" fill="#e8c27a"/>`;
    out += `<ellipse cx="${px}" cy="${py - 58}" rx="17" ry="5" fill="none" stroke="#e2c58e" stroke-width="3.2"/><path d="M${px + 12} ${py - 56} q10 8 4 18" stroke="#e2c58e" stroke-width="2.4" fill="none"/>`;
    out += `<path d="M${px - 26} ${py - 44} C${px - 30} ${py - 26} ${px - 26} ${py - 10} ${px - 20} ${py - 4}" stroke="#f3dcae" stroke-width="3" fill="none" opacity=".35"/>`;
    out += `</g>`;
    for (const [dx, dy] of [[48, 0], [60, 6], [42, 9], [70, -3], [54, 13]]) out += `<ellipse cx="${px + dx}" cy="${py + dy}" rx="4" ry="2.8" fill="#e0b870" stroke="#7a5521" stroke-width=".7"/>`;
    // watering can (patinated copper)
    const wx = cx + 246;
    const wy = cy + 136;
    out += shadow(wx, wy + 4, 76, 14, 0.9);
    out += `<path d="M${wx - 46} ${wy} V${wy - 70} C${wx - 46} ${wy - 82} ${wx + 46} ${wy - 82} ${wx + 46} ${wy - 70} V${wy} C${wx + 46} ${wy + 10} ${wx - 46} ${wy + 10} ${wx - 46} ${wy} Z" fill="url(#patina)" stroke="#1d3f37" stroke-width="1.8"/>`;
    out += `<ellipse cx="${wx}" cy="${wy - 72}" rx="46" ry="10" fill="#6fb09e" stroke="#1d3f37" stroke-width="1.6"/><ellipse cx="${wx - 8}" cy="${wy - 74}" rx="22" ry="5" fill="#173a33"/>`;
    out += `<path d="M${wx - 44} ${wy - 40} L${wx - 102} ${wy - 92}" stroke="url(#patina)" stroke-width="11" stroke-linecap="round"/><path d="M${wx - 44} ${wy - 40} L${wx - 102} ${wy - 92}" stroke="#1d3f37" stroke-width="1.4" opacity=".5"/>`;
    out += `<ellipse cx="${wx - 108}" cy="${wy - 98}" rx="12" ry="8" fill="#5b9c8a" stroke="#1d3f37" stroke-width="1.4" transform="rotate(-42 ${wx - 108} ${wy - 98})"/>`;
    out += `<path d="M${wx - 6} ${wy - 80} C${wx + 2} ${wy - 122} ${wx + 52} ${wy - 116} ${wx + 46} ${wy - 64}" stroke="url(#brass)" stroke-width="7" fill="none" stroke-linecap="round"/>`;
    out += `<path d="M${wx - 30} ${wy - 62} V${wy - 6}" stroke="#d6f0e6" stroke-width="4" opacity=".28" stroke-linecap="round"/>`;
    out += `<rect x="${wx - 46}" y="${wy - 24}" width="92" height="6" fill="#1d3f37" opacity=".35"/>`;
    // a few grass blades by the rim
    out += tuft(cx - 150, cy + 150, 0.8, 3) + tuft(cx + 120, cy + 156, 0.65, 9);
    return out;
  })();

  // the hedge along the back: mass behind the bed, lavender and small white flowers in it
  const hedge = [
    [-128, -270, 118, 74, 3, { spikes: 4 }],
    [-34, -292, 130, 84, 8, { flowers: 3 }],
    [62, -292, 122, 78, 19, { spikes: 2 }],
    [140, -262, 104, 66, 13, { flowers: 2 }],
  ]
    .map(([u, v, w, h, seed, opts]) => shrub(...floor(u, v), w, h, seed, opts))
    .join("");

  return {
    "contact-shadow": contactShadowPass(),
    base,
    back: wrap(`${hedge}${teepee}${cloche}`),
    main: wrap(bench.svg),
    detail: wrap(detail),
    energy: wrap(energy),
    front: wrap(front),
  };
}

// --- Central de Comandos ---------------------------------------------------------------------------

/** A point on a quad (front-left, front-right, back-right, back-left): s across, t from front to back. */
function onQuad(c, s, t) {
  const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  return lerp(lerp(c[0], c[1], s), lerp(c[3], c[2], s), t).map(n);
}

/** The shield seal (the Central's emblem shape), centred at (x, y), `s` wide. */
function shieldPath(x, y, s) {
  const h = s * 1.15;
  return `M${n(x)} ${n(y - h / 2)} L${n(x + s / 2)} ${n(y - h / 2 + h * 0.18)} V${n(y + h * 0.02)} C${n(x + s / 2)} ${n(y + h * 0.3)} ${n(x + s * 0.2)} ${n(y + h * 0.44)} ${n(x)} ${n(y + h / 2)} C${n(x - s * 0.2)} ${n(y + h * 0.44)} ${n(x - s / 2)} ${n(y + h * 0.3)} ${n(x - s / 2)} ${n(y + h * 0.02)} V${n(y - h / 2 + h * 0.18)} Z`;
}

/**
 * A control station built like furniture: a walnut console with a leather
 * panel, the great seal at its heart and two levers either side — the game's
 * "reative os selos, um comando de cada vez" — with the switchboard cabinet of
 * dials and seal sockets behind it and a brass reading lamp. Analog, crafted,
 * no screens: a hub of the atelier, not a dashboard.
 */
function commandsPasses() {
  const angle = -8;
  const etching = (() => {
    let out = "";
    for (const r of [120, 190, 250]) {
      out += `<ellipse cx="${cx}" cy="${cy + 8}" rx="${r}" ry="${n(r * 0.403)}" fill="none" stroke="#c9a25a" stroke-width="1.4" opacity=".28"/>`;
    }
    for (let i = 0; i < 24; i += 1) {
      const a = (i / 24) * Math.PI * 2;
      const [x0, y0] = floor(Math.cos(a) * 262, Math.sin(a) * 262 + 20);
      const [x1, y1] = floor(Math.cos(a) * (i % 2 ? 276 : 290), Math.sin(a) * (i % 2 ? 276 : 290) + 20);
      out += `<path d="M${x0} ${y0} L${x1} ${y1}" stroke="#d9b56a" stroke-width="${i % 2 ? 1.4 : 2.4}" opacity=".5"/>`;
    }
    return out;
  })();
  const base = basePass({ inlay: "#22342b", ring: GOLD_RING, band: "#2f5d52", etching });

  // back: the switchboard cabinet (left of centre) and the reading lamp (right)
  const cabinet = (() => {
    const at = (u, v, h) => floor(u, v, h, { angle });
    const foot = rect(-140, -236, 300, 64);
    let out = shadow(...at(-140, -200, 0), 190, 24, 0.85);
    out += prism(foot, { top: 236, angle, fill: "#6b4428", side: "url(#woodH)", sideLight: "url(#woodLight)", stroke: "#2b170b", strokeWidth: 2 });
    // crown moulding
    out += prism(rect(-140, -236, 320, 76), { bottom: 236, top: 250, angle, fill: "#8a5a34", side: "url(#woodV)", stroke: "#2b170b", strokeWidth: 1.6 });
    const face = [at(-290, -204, 0), at(10, -204, 0), at(10, -204, 236), at(-290, -204, 236)];
    // recessed panel
    const p = (s, t) => onQuad(face, s, t);
    out += `<polygon points="${[p(0.05, 0.06), p(0.95, 0.06), p(0.95, 0.94), p(0.05, 0.94)].join(" ")}" fill="url(#woodDark)" stroke="#20120a" stroke-width="1.4"/>`;
    // three gauges across the top
    for (const s of [0.22, 0.5, 0.78]) {
      const [gx, gy] = p(s, 0.74);
      out += `<circle cx="${gx}" cy="${gy}" r="27" fill="url(#brass)" stroke="#5e4119" stroke-width="1.4"/><circle cx="${gx}" cy="${gy}" r="21" fill="#efe3c6" stroke="#8a6a3c" stroke-width="1"/>`;
      for (let k = 0; k < 9; k += 1) {
        const a = (-120 + k * 30) * (Math.PI / 180);
        out += `<path d="M${n(gx + Math.sin(a) * 15)} ${n(gy - Math.cos(a) * 15)} L${n(gx + Math.sin(a) * 19)} ${n(gy - Math.cos(a) * 19)}" stroke="#5a4428" stroke-width="1.2"/>`;
      }
      const needle = (s === 0.5 ? 18 : s < 0.5 ? -40 : 52) * (Math.PI / 180);
      out += `<path d="M${gx} ${gy} L${n(gx + Math.sin(needle) * 16)} ${n(gy - Math.cos(needle) * 16)}" stroke="#7a2e1c" stroke-width="2" stroke-linecap="round"/><circle cx="${gx}" cy="${gy}" r="2.6" fill="#3a2a18"/>`;
      out += `<ellipse cx="${n(gx - 7)}" cy="${n(gy - 9)}" rx="8" ry="4" fill="#ffffff" opacity=".35"/>`;
    }
    // seal sockets: three medallions, two lit — the sequence the game asks for
    for (const [i, s] of [0.26, 0.5, 0.74].entries()) {
      const [sx, sy] = p(s, 0.4);
      out += `<circle cx="${sx}" cy="${sy}" r="19" fill="url(#bronzeAged)" stroke="#3a2a12" stroke-width="1.2"/><circle cx="${sx}" cy="${sy}" r="13" fill="${i < 2 ? "url(#tealCrystal)" : "#22302c"}" stroke="#1a2a26" stroke-width="1"/>`;
      out += `<path d="${shieldPath(sx, sy, 10)}" fill="none" stroke="${i < 2 ? "#e9fffb" : "#6b7d75"}" stroke-width="1.4" opacity=".9"/>`;
    }
    // pigeonholes with rolled charts
    for (const [k, s] of [0.12, 0.88].entries()) {
      const [hx, hy] = p(s, 0.36);
      out += `<rect x="${hx - 16}" y="${hy - 26}" width="32" height="52" rx="3" fill="#1a0f08" stroke="#5e3a20" stroke-width="1.2"/>`;
      for (let r = 0; r < 2; r += 1) out += `<rect x="${hx - 11 + r * 11}" y="${hy - 6 - r * 6}" width="9" height="30" rx="4" fill="${(k + r) % 2 ? "url(#parchment)" : "#dbc89a"}" stroke="#8a6a3c" stroke-width=".8"/>`;
    }
    // brass pipes rising from the crown
    const [t1x, t1y] = at(-260, -236, 250);
    const [t2x, t2y] = at(-30, -236, 250);
    out += `<path d="M${t1x + 14} ${t1y} V${t1y - 46} H${t1x + 54} V${t1y - 8}" stroke="url(#brassH)" stroke-width="8" fill="none" stroke-linejoin="round"/>`;
    out += post(t2x - 20, t2y - 30, t2y, 9, "url(#brassH)", { stroke: "#6e4b1c", strokeWidth: 0.8 });
    out += `<circle cx="${t2x - 20}" cy="${t2y - 34}" r="9" fill="url(#brass)" stroke="#6e4b1c" stroke-width="1.2"/>`;
    const [cmx, cmy] = at(-140, -236, 250);
    out += `<circle cx="${cmx}" cy="${cmy - 26}" r="24" fill="url(#bronzeAged)" stroke="#3a2a12" stroke-width="1.6"/><path d="${shieldPath(cmx, cmy - 26, 22)}" fill="#2d4a42" stroke="#d9b56a" stroke-width="1.6"/>`;
    return out;
  })();

  const lamp = (() => {
    const [lx, ly] = floor(236, -186);
    let out = shadow(lx, ly + 4, 46, 11, 0.85);
    out += `<ellipse cx="${lx}" cy="${ly}" rx="34" ry="11" fill="url(#brass)" stroke="#6e4b1c" stroke-width="1.4"/><ellipse cx="${lx}" cy="${ly - 4}" rx="26" ry="8" fill="#e9c97e"/>`;
    out += post(lx, ly - 236, ly - 4, 7, "url(#brassH)", { stroke: "#6e4b1c", strokeWidth: 0.8 });
    out += `<path d="M${lx} ${ly - 226} C${lx - 6} ${ly - 262} ${lx - 46} ${ly - 270} ${lx - 70} ${ly - 252}" stroke="url(#brassH)" stroke-width="6" fill="none"/>`;
    // the green-glass shade, lit from inside
    const sx = lx - 82;
    const sy = ly - 236;
    out += `<path d="M${sx - 46} ${sy + 26} C${sx - 42} ${sy - 4} ${sx - 22} ${sy - 18} ${sx} ${sy - 18} C${sx + 22} ${sy - 18} ${sx + 42} ${sy - 4} ${sx + 46} ${sy + 26} Z" fill="url(#leather)" stroke="#123026" stroke-width="1.6"/>`;
    out += `<path d="M${sx - 30} ${sy + 4} C${sx - 20} ${sy - 8} ${sx - 6} ${sy - 12} ${sx + 8} ${sy - 12}" stroke="#bfe3d0" stroke-width="2.6" fill="none" opacity=".45"/>`;
    out += `<ellipse cx="${sx}" cy="${sy + 26}" rx="46" ry="8" fill="#fff1c4" stroke="#b78a3a" stroke-width="1.4"/>`;
    return { svg: out, bulb: [sx, sy + 28] };
  })();

  // main: the console
  const console_ = (() => {
    const at = (u, v, h) => floor(u, v, h, { angle });
    let out = shadow(...at(0, 60, 0), 236, 50, 0.95);
    out += prism(rect(0, 40, 384, 150), { top: 76, angle, fill: "#6b4428", side: "url(#woodH)", sideLight: "url(#woodLight)", stroke: "#2b170b", strokeWidth: 2 });
    // drawer fronts on the console's face
    for (const u of [-120, 0, 120]) {
      const q = [at(u - 54, 115, 14), at(u + 54, 115, 14), at(u + 54, 115, 60), at(u - 54, 115, 60)];
      out += `<polygon points="${q.join(" ")}" fill="none" stroke="#2b170b" stroke-width="1.6" opacity=".7"/>`;
      const [kx, ky] = onQuad(q, 0.5, 0.5);
      out += `<ellipse cx="${kx}" cy="${ky}" rx="9" ry="4" fill="url(#brass)" stroke="#6e4b1c" stroke-width="1"/>`;
    }
    // the slanted panel: the wedge's left side, then the leather face in a brass frame
    out += `<polygon points="${[at(-192, 115, 76), at(-192, -35, 76), at(-192, -35, 124)].join(" ")}" fill="url(#woodLight)" stroke="#2b170b" stroke-width="1.6"/>`;
    const panel = [at(-192, 115, 76), at(192, 115, 76), at(192, -35, 124), at(-192, -35, 124)];
    out += `<polygon points="${panel.join(" ")}" fill="url(#bronzeAged)" stroke="#2b170b" stroke-width="1.8"/>`;
    const inner = [onQuad(panel, 0.03, 0.08), onQuad(panel, 0.97, 0.08), onQuad(panel, 0.97, 0.92), onQuad(panel, 0.03, 0.92)];
    out += `<polygon points="${inner.join(" ")}" fill="url(#leatherDark)" stroke="#1a120b" stroke-width="1.2"/>`;
    const p = (s, t) => onQuad(panel, s, t);
    // the great seal
    const [gx, gy] = p(0.5, 0.52);
    out += `<ellipse cx="${gx}" cy="${n(gy + 4)}" rx="52" ry="38" fill="#0b0704" opacity=".35"/>`;
    out += `<ellipse cx="${gx}" cy="${gy}" rx="50" ry="36" fill="url(#brass)" stroke="#5e4119" stroke-width="1.8"/>`;
    out += `<ellipse cx="${gx}" cy="${n(gy - 2)}" rx="38" ry="27" fill="url(#tealPool)" stroke="#0d4c4a" stroke-width="1.4"/>`;
    // levers either side, and round knobs
    for (const [k, s] of [0.17, 0.83].entries()) {
      const [sx, sy] = p(s, 0.5);
      out += `<rect x="${sx - 7}" y="${sy - 26}" width="14" height="52" rx="7" fill="#120c07" stroke="#5e4119" stroke-width="1.2"/>`;
      const tilt = k ? 16 : -22;
      out += `<path d="M${sx} ${sy + (k ? 8 : -10)} l${tilt} -46" stroke="url(#brassH)" stroke-width="6" stroke-linecap="round"/>`;
      out += `<ellipse cx="${sx + tilt}" cy="${sy + (k ? 8 : -10) - 50}" rx="10" ry="9" fill="#efe3c6" stroke="#8a6a3c" stroke-width="1.2"/>`;
      const [kx, ky] = p(k ? 0.68 : 0.32, 0.3);
      out += `<ellipse cx="${kx}" cy="${ky}" rx="12" ry="8" fill="url(#iron)" stroke="#120c07" stroke-width="1"/><ellipse cx="${kx - 2}" cy="${ky - 2}" rx="5" ry="3" fill="#8a857b" opacity=".6"/>`;
    }
    return { svg: out, panel, seal: [gx, gy] };
  })();

  const detail = (() => {
    const p = (s, t) => onQuad(console_.panel, s, t);
    const [gx, gy] = console_.seal;
    let out = `<path d="${shieldPath(gx, gy - 2, 30)}" fill="#e9fffb" fill-opacity=".18" stroke="#e9fffb" stroke-width="2.4" stroke-linejoin="round"/>`;
    out += `<path d="M${gx - 8} ${gy - 2} l6 7 l11 -13" stroke="#e9fffb" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    // the indicator row: done, done, now, waiting, waiting
    const lamps = ["#f2c65a", "#f2c65a", "#63ddca", "#3a4a44", "#3a4a44"];
    for (const [i, color] of lamps.entries()) {
      const [lx, ly] = p(0.3 + i * 0.1, 0.16);
      out += `<ellipse cx="${lx}" cy="${ly}" rx="7" ry="5" fill="${color}" stroke="#120c07" stroke-width="1"/>`;
      if (i < 3) out += `<ellipse cx="${lx - 2}" cy="${ly - 1.5}" rx="2.4" ry="1.4" fill="#ffffff" opacity=".7"/>`;
    }
    return out;
  })();

  const energy = (() => {
    const [gx, gy] = console_.seal;
    const [bx, by] = lamp.bulb;
    return `${glow(gx, gy, 110, "glowTeal")}${glow(bx, by + 20, 120, "glowWarm", 0.9)}
      <g filter="url(#softSmall)"><path d="M${bx - 40} ${by} L${bx + 40} ${by} L${bx + 120} ${by + 170} L${bx - 90} ${by + 170} Z" fill="#ffe2a8" opacity=".2"/></g>`;
  })();

  const front = (() => {
    let out = "";
    // a tray of seal tokens (left)
    const tx = cx - 262;
    const ty = cy + 122;
    out += shadow(tx, ty + 6, 64, 12, 0.9);
    out += prism(rect(0, 0, 112, 60), { top: 18, angle: 10, fill: "#4a2c16", side: "url(#woodH)", sideLight: "url(#woodLight)", stroke: "#2b170b", strokeWidth: 1.4, cx: tx, cy: ty });
    for (const [du, dv] of [[-30, -6], [0, 4], [28, -8], [-10, -16]]) {
      const [x, y] = floor(du, dv, 20, { angle: 10, cx: tx, cy: ty });
      out += `<ellipse cx="${x}" cy="${y}" rx="13" ry="6" fill="url(#brass)" stroke="#6e4b1c" stroke-width="1"/><path d="${shieldPath(x, y - 0.5, 6)}" fill="none" stroke="#6e4b1c" stroke-width="1"/>`;
    }
    // two logbooks and a key (right)
    const bx = cx + 236;
    const by = cy + 138;
    out += shadow(bx, by + 2, 74, 13, 0.9);
    out += prism(rect(0, 0, 120, 74), { top: 14, angle: -14, fill: "#2f4a3a", side: "#1c2e24", sideLight: "#3d5c4a", stroke: "#10201a", strokeWidth: 1.2, cx: bx, cy: by });
    out += prism(rect(4, -4, 108, 66), { bottom: 14, top: 26, angle: -4, fill: "#6e2a22", side: "#4a1a14", sideLight: "#86382d", stroke: "#2a0e0a", strokeWidth: 1.2, cx: bx, cy: by });
    const [kx, ky] = floor(10, -6, 27, { angle: -4, cx: bx, cy: by });
    out += `<ellipse cx="${kx - 22}" cy="${ky}" rx="10" ry="5" fill="none" stroke="url(#brass)" stroke-width="3.4"/><path d="M${kx - 12} ${ky} H${kx + 24} M${kx + 16} ${ky} v5 M${kx + 22} ${ky} v4" stroke="url(#brass)" stroke-width="3.4" stroke-linecap="round"/>`;
    return out;
  })();

  return {
    "contact-shadow": contactShadowPass(),
    base,
    back: wrap(`${cabinet}${lamp.svg}`),
    main: wrap(console_.svg),
    detail: wrap(detail),
    energy: wrap(energy),
    front: wrap(front),
  };
}

// --- Circuito de Memória ---------------------------------------------------------------------------

/** The four signals, in the game's places: flame up, wave right, sun down, leaf left. */
const PADS = [
  { id: "flame", dx: 0, dy: -1, fill: "#e0684a", deep: "#8e3420", light: "#ffc2a6" },
  { id: "wave", dx: 1, dy: 0, fill: "#3a86c8", deep: "#1c4f80", light: "#bfe0ff" },
  { id: "sun", dx: 0, dy: 1, fill: "#e2a930", deep: "#8a5f0c", light: "#fff0b8" },
  { id: "leaf", dx: -1, dy: 0, fill: "#4c9e5a", deep: "#245c30", light: "#cdeec6" },
];

function padGlyph(id, x, y, s, color) {
  switch (id) {
    case "flame":
      return `<path d="M${n(x)} ${n(y - s)} C${n(x + s * 0.7)} ${n(y - s * 0.3)} ${n(x + s * 0.6)} ${n(y + s * 0.6)} ${n(x)} ${n(y + s * 0.7)} C${n(x - s * 0.6)} ${n(y + s * 0.6)} ${n(x - s * 0.7)} ${n(y - s * 0.1)} ${n(x - s * 0.15)} ${n(y - s * 0.45)} C${n(x - s * 0.1)} ${n(y - s * 0.05)} ${n(x + s * 0.12)} ${n(y)} ${n(x)} ${n(y - s)} Z" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/>`;
    case "wave":
      return [-0.35, 0.2].map((k) => `<path d="M${n(x - s)} ${n(y + s * k)} q${n(s / 2)} ${n(-s * 0.4)} ${n(s)} 0 t${n(s)} 0" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>`).join("");
    case "sun": {
      let rays = "";
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        rays += `<path d="M${n(x + Math.cos(a) * s * 0.55)} ${n(y + Math.sin(a) * s * 0.42)} L${n(x + Math.cos(a) * s * 0.9)} ${n(y + Math.sin(a) * s * 0.68)}" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`;
      }
      return `${rays}<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(s * 0.34)}" ry="${n(s * 0.27)}" fill="none" stroke="${color}" stroke-width="2.2"/>`;
    }
    default:
      return `<path d="M${n(x - s * 0.8)} ${n(y + s * 0.5)} C${n(x - s * 0.7)} ${n(y - s * 0.5)} ${n(x + s * 0.2)} ${n(y - s * 0.7)} ${n(x + s * 0.85)} ${n(y - s * 0.55)} C${n(x + s * 0.8)} ${n(y + s * 0.2)} ${n(x)} ${n(y + s * 0.6)} ${n(x - s * 0.8)} ${n(y + s * 0.5)} Z M${n(x - s * 0.6)} ${n(y + s * 0.35)} L${n(x + s * 0.5)} ${n(y - s * 0.35)}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round"/>`;
  }
}

/**
 * The memory dial: the game's own artefact — a round mineral-stone board with
 * four pads around a teal crystal core and bronze traces between them — raised
 * on a bronze cradle so the four signals face the Explorador. Behind it, an
 * armillary of bronze rings carries the four signal lamps; memory tokens in the
 * pads' colours rest in front. Energy is contained: the core glows, nothing
 * flashes.
 */
function circuitPasses() {
  const etching = (() => {
    let out = "";
    for (const r of [140, 210, 270]) out += `<ellipse cx="${cx}" cy="${cy + 10}" rx="${r}" ry="${n(r * 0.403)}" fill="none" stroke="#c9a25a" stroke-width="1.4" opacity=".3"/>`;
    for (const [k, pad] of PADS.entries()) {
      const a = Math.PI / 4 + (k * Math.PI) / 2;
      const [x0, y0] = floor(Math.cos(a) * 150, Math.sin(a) * 150 + 25);
      const [x1, y1] = floor(Math.cos(a) * 280, Math.sin(a) * 280 + 25);
      out += `<path d="M${x0} ${y0} L${x1} ${y1}" stroke="#c9a25a" stroke-width="2" opacity=".4"/><circle cx="${x1}" cy="${y1}" r="5" fill="${pad.fill}" opacity=".55"/>`;
    }
    return out;
  })();
  const base = basePass({ inlay: "#3c4741", ring: GOLD_RING, band: "#6b4a1e", etching });

  // the dial's geometry on screen
  const D = { x: cx, y: cy - 126, r: 168, tilt: 0.64, depth: 26 };
  const padAt = (pad, reach = 0.58) => [n(D.x + pad.dx * D.r * reach), n(D.y + pad.dy * D.r * reach * D.tilt)];

  const back = (() => {
    let out = "";
    // the armillary: a stem, an upright ring and a tilted ring, four lamps on the upright one
    const ax = cx;
    const ay = cy - 210;
    out += shadow(cx, cy - 84, 90, 16, 0.6);
    out += post(cx, ay + 150, cy - 84, 10, "url(#brassH)", { stroke: "#5e4119", strokeWidth: 0.8 });
    out += `<ellipse cx="${ax}" cy="${ay}" rx="190" ry="190" fill="none" stroke="#3a2a12" stroke-width="13" opacity=".55"/>`;
    out += `<ellipse cx="${ax}" cy="${ay}" rx="190" ry="190" fill="none" stroke="url(#bronzeAged)" stroke-width="9"/>`;
    out += `<ellipse cx="${ax}" cy="${ay}" rx="190" ry="190" fill="none" stroke="#f3d68a" stroke-width="1.4" opacity=".55" stroke-dasharray="0 6 200 2000"/>`;
    out += `<ellipse cx="${ax}" cy="${ay}" rx="214" ry="64" fill="none" stroke="url(#brass)" stroke-width="5" opacity=".9"/>`;
    for (const [k, pad] of PADS.entries()) {
      const a = (k * Math.PI) / 2 - Math.PI / 2;
      const lx = n(ax + Math.cos(a) * 190);
      const ly = n(ay + Math.sin(a) * 190);
      out += `<circle cx="${lx}" cy="${ly}" r="17" fill="url(#brass)" stroke="#5e4119" stroke-width="1.4"/><circle cx="${lx}" cy="${ly}" r="11" fill="${pad.fill}" stroke="${pad.deep}" stroke-width="1.2"/><circle cx="${lx - 3}" cy="${ly - 3}" r="3.6" fill="${pad.light}" opacity=".8"/>`;
    }
    // crystal clusters at the back left and right, for weight
    const cluster = (x, y, s) => {
      let c = shadow(x, y + 2, 40 * s, 9 * s, 0.8);
      for (const [dx, h, w, lean] of [[-16, 56, 15, -14], [6, 78, 18, 4], [24, 48, 13, 18], [-2, 36, 12, -30]]) {
        const bx = x + dx * s;
        const top = [bx + Math.sin((lean * Math.PI) / 180) * h * s, y - h * s];
        c += `<path d="M${n(bx - w * s * 0.5)} ${n(y)} L${n(top[0] - w * s * 0.28)} ${n(top[1] + 10 * s)} L${n(top[0])} ${n(top[1])} L${n(top[0] + w * s * 0.28)} ${n(top[1] + 10 * s)} L${n(bx + w * s * 0.5)} ${n(y)} Z" fill="url(#tealCrystal)" stroke="#0f5f56" stroke-width="1.1"/>`;
        c += `<path d="M${n(bx - w * s * 0.1)} ${n(y - 4)} L${n(top[0] - 1)} ${n(top[1] + 6)}" stroke="#e9fffb" stroke-width="1.4" opacity=".5"/>`;
      }
      return `${c}<ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(34 * s)}" ry="${n(9 * s)}" fill="url(#stoneGrey)" stroke="#2c302c" stroke-width=".8"/>`;
    };
    out += cluster(...floor(-250, -120), 1.1) + cluster(...floor(262, -90), 0.85);
    return out;
  })();

  const main = (() => {
    let out = shadow(cx, cy + 26, 210, 44, 0.95);
    // the cradle: a stone block and two bronze arms holding the dial at its sides
    out += prism(rect(0, 18, 196, 96), { top: 30, fill: "url(#stoneGrey)", side: "url(#stoneGreySide)", sideLight: "url(#stoneGrey)", stroke: "#2c302c", strokeWidth: 1.6 });
    out += prism(rect(0, 18, 150, 70), { bottom: 30, top: 38, fill: "url(#bronzeAged)", side: "#4a3818", stroke: "#3a2a12", strokeWidth: 1.2 });
    for (const side of [-1, 1]) {
      const [bx, by] = floor(side * 70, 18, 38);
      out += `<path d="M${bx} ${by} C${bx + side * 26} ${by - 40} ${D.x + side * (D.r + 26)} ${D.y + 40} ${D.x + side * (D.r + 12)} ${D.y + 2}" stroke="url(#bronzeAged)" stroke-width="14" fill="none" stroke-linecap="round"/>`;
      out += `<circle cx="${D.x + side * (D.r + 10)}" cy="${D.y}" r="13" fill="url(#brass)" stroke="#5e4119" stroke-width="1.6"/>`;
    }
    // the dial: stone disc with its edge, the bronze rim, the traces
    out += `<ellipse cx="${D.x}" cy="${D.y + D.depth}" rx="${D.r}" ry="${n(D.r * D.tilt)}" fill="url(#mineralSide)" stroke="#3a3326" stroke-width="2"/>`;
    out += `<rect x="${D.x - D.r}" y="${D.y}" width="${D.r * 2}" height="${D.depth}" fill="url(#mineralSide)"/>`;
    out += `<path d="M${D.x - D.r} ${D.y + D.depth * 0.45} A${D.r} ${n(D.r * D.tilt)} 0 0 0 ${D.x + D.r} ${D.y + D.depth * 0.45}" fill="none" stroke="url(#bronzeAged)" stroke-width="5"/>`;
    out += `<ellipse cx="${D.x}" cy="${D.y}" rx="${D.r}" ry="${n(D.r * D.tilt)}" fill="url(#mineral)" stroke="url(#bronzeAged)" stroke-width="8"/>`;
    out += `<ellipse cx="${D.x}" cy="${D.y}" rx="${D.r - 18}" ry="${n((D.r - 18) * D.tilt)}" fill="none" stroke="#9c7536" stroke-width="2" opacity=".7"/>`;
    for (const pad of PADS) {
      const [px, py] = padAt(pad, 0.6);
      out += `<path d="M${D.x} ${D.y} L${px} ${py}" stroke="#9c7536" stroke-width="4" opacity=".75"/>`;
    }
    for (let i = 0; i < 4; i += 1) {
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      const r = D.r * 0.7;
      out += `<circle cx="${n(D.x + Math.cos(a) * r)}" cy="${n(D.y + Math.sin(a) * r * D.tilt)}" r="4.5" fill="url(#brass)" stroke="#5e4119" stroke-width="1"/>`;
    }
    // the four pads: domed, in bronze bezels
    for (const pad of PADS) {
      const [px, py] = padAt(pad, 0.6);
      out += `<ellipse cx="${px}" cy="${n(py + 5)}" rx="44" ry="${n(44 * D.tilt)}" fill="#0b0704" opacity=".3"/>`;
      out += `<ellipse cx="${px}" cy="${py}" rx="44" ry="${n(44 * D.tilt)}" fill="url(#brass)" stroke="#5e4119" stroke-width="1.4"/>`;
      out += `<ellipse cx="${px}" cy="${n(py - 2)}" rx="35" ry="${n(35 * D.tilt)}" fill="${pad.fill}" stroke="${pad.deep}" stroke-width="1.6"/>`;
      out += `<ellipse cx="${px}" cy="${n(py + 4)}" rx="33" ry="${n(18 * D.tilt)}" fill="${pad.deep}" opacity=".28"/>`;
      out += `<ellipse cx="${n(px - 10)}" cy="${n(py - 11)}" rx="13" ry="5.5" fill="#ffffff" opacity=".3"/>`;
    }
    // the core's crown
    out += `<ellipse cx="${D.x}" cy="${D.y + 6}" rx="30" ry="${n(30 * D.tilt)}" fill="url(#brass)" stroke="#5e4119" stroke-width="1.6"/>`;
    return out;
  })();

  const detail = (() => {
    let out = "";
    for (const pad of PADS) {
      const [px, py] = padAt(pad, 0.6);
      out += padGlyph(pad.id, px, py - 2, 16, pad.light);
    }
    // the crystal core
    const x = D.x;
    const y = D.y + 2;
    out += `<path d="M${x - 16} ${y} L${x - 13} ${y - 34} L${x} ${y - 52} L${x + 13} ${y - 34} L${x + 16} ${y} L${x} ${y + 8} Z" fill="url(#tealCrystal)" stroke="#0f5f56" stroke-width="1.4"/>`;
    out += `<path d="M${x} ${y - 52} L${x} ${y + 8} M${x - 13} ${y - 34} L${x} ${y - 26} L${x + 13} ${y - 34}" stroke="#0f5f56" stroke-width="1" opacity=".6" fill="none"/>`;
    out += `<path d="M${x - 9} ${y - 6} L${x - 8} ${y - 32}" stroke="#ffffff" stroke-width="2.4" opacity=".55" stroke-linecap="round"/>`;
    return out;
  })();

  const energy = (() => {
    let out = glow(D.x, D.y - 20, 120, "glowTeal");
    for (const pad of PADS) {
      const [px, py] = padAt(pad, 0.6);
      out += `<circle cx="${px}" cy="${py}" r="46" fill="${pad.fill}" opacity=".14" filter="url(#blur16)"/>`;
    }
    out += glow(cx, cy - 210, 60, "glowWarm", 0.35);
    return out;
  })();

  const front = (() => {
    let out = "";
    // memory tokens in the pads' colours, laid in a curve (left)
    const tokens = [[-300, 128], [-262, 146], [-220, 154], [-178, 150]];
    for (const [k, [dx, dy]] of tokens.entries()) {
      const pad = PADS[k];
      const x = cx + dx;
      const y = cy + dy;
      out += shadow(x, y + 5, 24, 6, 0.8);
      out += `<ellipse cx="${x}" cy="${y + 5}" rx="20" ry="8.5" fill="url(#mineralSide)"/><ellipse cx="${x}" cy="${y}" rx="20" ry="8.5" fill="url(#mineral)" stroke="#4f4737" stroke-width="1"/>`;
      out += `<ellipse cx="${x}" cy="${y}" rx="9" ry="3.8" fill="${pad.fill}" stroke="${pad.deep}" stroke-width=".8"/><ellipse cx="${x - 6}" cy="${y - 3}" rx="6" ry="2" fill="#ffffff" opacity=".3"/>`;
    }
    // a brass bell on a small stand (right): the circuit's sound
    const bx = cx + 252;
    const by = cy + 142;
    out += shadow(bx, by + 2, 52, 11, 0.9);
    out += `<ellipse cx="${bx}" cy="${by}" rx="40" ry="11" fill="url(#woodLight)" stroke="#3a2212" stroke-width="1.4"/><rect x="${bx - 40}" y="${by - 6}" width="80" height="6" fill="url(#woodH)"/><ellipse cx="${bx}" cy="${by - 6}" rx="40" ry="11" fill="#9a6a40" stroke="#3a2212" stroke-width="1.4"/>`;
    out += `<path d="M${bx - 30} ${by - 10} C${bx - 30} ${by - 30} ${bx - 22} ${by - 62} ${bx} ${by - 64} C${bx + 22} ${by - 62} ${bx + 30} ${by - 30} ${bx + 30} ${by - 10} Z" fill="url(#brass)" stroke="#5e4119" stroke-width="1.6"/>`;
    out += `<ellipse cx="${bx}" cy="${by - 10}" rx="30" ry="7" fill="#c39443" stroke="#5e4119" stroke-width="1.2"/><circle cx="${bx}" cy="${by - 70}" r="7" fill="url(#brass)" stroke="#5e4119" stroke-width="1.2"/>`;
    out += `<path d="M${bx - 16} ${by - 46} C${bx - 12} ${by - 56} ${bx - 6} ${by - 58} ${bx} ${by - 58}" stroke="#fff3c4" stroke-width="2.4" fill="none" opacity=".55"/>`;
    return out;
  })();

  return {
    "contact-shadow": contactShadowPass(),
    base,
    back: wrap(back),
    main: wrap(main),
    detail: wrap(detail),
    energy: wrap(energy),
    front: wrap(front),
  };
}

// --- Rota Estratégica ------------------------------------------------------------------------------

/**
 * The strategy board, as the game has it: a slate board in a walnut frame with
 * walls, the lights the portal asks for, a chest, the Explorador and the
 * Guardião — and a few tiles of a route being planned toward stepping stones
 * and the teal portal at the back. A signpost and a cairn mark the way.
 */
function routePasses() {
  const B = { u: -60, v: 30, size: 330, cells: 7, angle: 40, h: 26 };
  const bc = floor(B.u, B.v);
  const onBoard = (i, j, h = B.h) => {
    const cell = B.size / B.cells;
    const x = -B.size / 2 + cell * (i + 0.5);
    const y = -B.size / 2 + cell * (j + 0.5);
    return floor(x, y, h, { angle: B.angle, cx: bc[0], cy: bc[1] });
  };
  const cell = B.size / B.cells;

  const etching = (() => {
    let out = "";
    // a compass rose and contour lines: the way, not a map
    const [rx, ry] = floor(150, 40);
    for (const r of [60, 110]) out += `<ellipse cx="${rx}" cy="${ry}" rx="${r}" ry="${n(r * 0.403)}" fill="none" stroke="#9fd8cc" stroke-width="1.2" opacity=".18"/>`;
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const len = i % 2 ? 70 : 130;
      const [x1, y1] = floor(150 + Math.cos(a) * len, 40 + Math.sin(a) * len);
      out += `<path d="M${rx} ${ry} L${x1} ${y1}" stroke="#c9a25a" stroke-width="${i % 2 ? 1 : 1.8}" opacity=".35"/>`;
    }
    const rnd = rng(17);
    for (let k = 0; k < 5; k += 1) {
      let d = "";
      const r0 = 220 + k * 22;
      for (let s = 0; s <= 40; s += 1) {
        const a = Math.PI * (0.95 + (s / 40) * 0.9);
        const wob = Math.sin(s * 0.6 + k) * 8 + (rnd() - 0.5) * 3;
        const [x, y] = floor(Math.cos(a) * (r0 + wob), Math.sin(a) * (r0 + wob));
        d += `${s ? "L" : "M"}${x} ${y} `;
      }
      out += `<path d="${d}" stroke="#9fd8cc" stroke-width="1.1" fill="none" opacity=".14"/>`;
    }
    return out;
  })();
  const base = basePass({ inlay: "#1f3a37", ring: GOLD_RING, band: "#1d5c57", etching });

  const portal = (() => {
    const [px, py] = floor(222, -168);
    const w = 64;
    const top = py - 238;
    let out = shadow(px, py + 6, 92, 18, 0.9);
    out += prism(rect(222, -168, 170, 48), { top: 14, fill: "url(#stoneGrey)", side: "url(#stoneGreySide)", sideLight: "url(#stoneGrey)", stroke: "#2c302c", strokeWidth: 1.4 });
    const [sx, sy] = floor(222, -168, 14);
    // the opening's membrane, then the stone arch around it
    out += `<path d="M${sx - w} ${sy} V${top + 70} A${w} ${w} 0 0 1 ${sx + w} ${top + 70} V${sy} Z" fill="url(#tealPool)"/>`;
    out += `<path d="M${sx - w - 26} ${sy} V${top + 70} A${w + 26} ${w + 26} 0 0 1 ${sx + w + 26} ${top + 70} V${sy} H${sx + w} V${top + 70} A${w} ${w} 0 0 0 ${sx - w} ${top + 70} V${sy} Z" fill="url(#stoneGrey)" stroke="#2c302c" stroke-width="1.8"/>`;
    // the arch's voussoirs
    for (let i = 1; i < 8; i += 1) {
      const a = Math.PI + (i / 8) * Math.PI;
      out += `<path d="M${n(sx + Math.cos(a) * w)} ${n(top + 70 + Math.sin(a) * w)} L${n(sx + Math.cos(a) * (w + 26))} ${n(top + 70 + Math.sin(a) * (w + 26))}" stroke="#2c302c" stroke-width="1.4" opacity=".7"/>`;
    }
    for (const y of [sy - 40, sy - 90, sy - 140]) out += `<path d="M${sx - w - 26} ${y} H${sx - w} M${sx + w} ${y} H${sx + w + 26}" stroke="#2c302c" stroke-width="1.4" opacity=".7"/>`;
    // keystone with a teal gem
    out += `<path d="M${sx - 14} ${top - 18} H${sx + 14} L${sx + 10} ${top + 10} H${sx - 10} Z" fill="url(#stone)" stroke="#2c302c" stroke-width="1.4"/><circle cx="${sx}" cy="${top - 3}" r="6" fill="url(#tealCrystal)" stroke="#0f5f56" stroke-width="1"/>`;
    out += `<path d="M${sx - w - 20} ${sy - 10} V${top + 70}" stroke="#ffffff" stroke-width="3" opacity=".14"/>`;
    return { svg: out, centre: [sx, top + 90], base: [sx, sy] };
  })();

  const signpost = (() => {
    const [x, y] = floor(-262, -132);
    let out = shadow(x, y + 4, 52, 12, 0.85);
    // a cairn beside it: the way-marker of the explorer
    for (const [dx, dy, rx, ry] of [[40, -2, 20, 9], [42, -14, 15, 7], [40, -24, 11, 6], [41, -32, 7, 4]]) out += pebble(x + dx, y + dy, rx, ry);
    out += post(x, y - 244, y + 2, 13, "url(#woodH)", { stroke: "#3a2212", strokeWidth: 1.2, radius: 3 });
    out += post(x - 3, y - 240, y - 2, 2.4, "#d8b080", { radius: 1 }).replace("/>", ' opacity=".35"/>');
    const planks = [
      { y: y - 214, dir: 1, len: 92 },
      { y: y - 180, dir: -1, len: 80 },
      { y: y - 146, dir: 1, len: 70 },
    ];
    for (const p of planks) {
      const x0 = x - (p.dir > 0 ? 8 : -8);
      const x1 = x0 + p.dir * p.len;
      out += `<path d="M${x0} ${p.y - 12} H${x1} L${x1 + p.dir * 14} ${p.y} L${x1} ${p.y + 12} H${x0} Z" fill="url(#woodLight)" stroke="#3a2212" stroke-width="1.6" stroke-linejoin="round"/>`;
      out += `<path d="M${x0 + p.dir * 10} ${p.y - 3} H${x1 - p.dir * 6}" stroke="#3a2212" stroke-width="1" opacity=".35"/>`;
    }
    // a small lantern hanging from the top
    out += `<path d="M${x} ${y - 236} h-34 v14" stroke="url(#iron)" stroke-width="3" fill="none"/>`;
    out += `<rect x="${x - 46}" y="${y - 222}" width="24" height="30" rx="4" fill="#ffe7a8" stroke="url(#iron)" stroke-width="2.6"/><path d="M${x - 48} ${y - 222} h28 l-4 -6 h-20 Z" fill="#2b2622"/>`;
    return { svg: out, lantern: [x - 34, y - 207] };
  })();

  // a low ruin at the back: the Rota's old walls, broken, with moss on their courses
  const ruin = (() => {
    const v = -268;
    const stoneRnd = rng(53);
    let out = shadow(...floor(-50, v + 14), 180, 22, 0.8);
    const courses = [
      { h0: 0, h1: 30, spans: [[-190, -118], [-116, -40], [-38, 30], [32, 88]] },
      { h0: 30, h1: 58, spans: [[-186, -128], [-126, -62], [-60, 0], [2, 46]] },
      { h0: 58, h1: 86, spans: [[-180, -108], [-106, -58]] },
      { h0: 86, h1: 110, spans: [[-170, -126]] },
    ];
    for (const course of courses) {
      for (const [u0, u1] of course.spans) {
        const tone = STONE_TONES[Math.floor(stoneRnd() * STONE_TONES.length)];
        out += prism(rect((u0 + u1) / 2, v, u1 - u0 - 3, 36), { bottom: course.h0, top: course.h1 - 1.5, fill: tone.top, side: tone.side, sideLight: tone.light, stroke: "#2f2a22", strokeWidth: 1.2 });
      }
    }
    // moss on the broken top and a strand of ivy down the face
    for (const [u, h, r] of [[-150, 110, 14], [-128, 86, 11], [-84, 86, 12], [-30, 58, 10], [24, 58, 9], [64, 30, 10]]) {
      const [x, y] = floor(u, v, h);
      out += `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${n(r * 0.45)}" fill="url(#leafDark)"/><ellipse cx="${x - 3}" cy="${y - 1}" rx="${n(r * 0.6)}" ry="${n(r * 0.25)}" fill="url(#leaf)"/>`;
    }
    const [ix, iy] = floor(-96, v + 18, 84);
    out += vineUp(ix, iy + 70, ix + 6, iy, 31, { turns: 1.2, amp: 6, leaves: 6, scale: 0.8 });
    return out;
  })();

  const board = (() => {
    let out = shadow(...floor(B.u + 10, B.v + 20), 250, 80, 0.95);
    const frame = 22;
    out += prism(rect(0, 0, B.size + frame * 2, B.size + frame * 2), { top: B.h - 4, angle: B.angle, fill: "url(#wood)", side: "url(#woodH)", sideLight: "url(#woodLight)", stroke: "#2b170b", strokeWidth: 2, cx: bc[0], cy: bc[1] });
    // tiles, in floor units, laid on the board's plane
    let tiles = "";
    const rnd = rng(29);
    for (let i = 0; i < B.cells; i += 1) {
      for (let j = 0; j < B.cells; j += 1) {
        const tone = ["#5d7874", "#536d69", "#647f7a", "#4c6562"][Math.floor(rnd() * 4)];
        tiles += `<rect x="${n(-B.size / 2 + i * cell + 2)}" y="${n(-B.size / 2 + j * cell + 2)}" width="${n(cell - 4)}" height="${n(cell - 4)}" rx="3" fill="${tone}"/>`;
        tiles += `<rect x="${n(-B.size / 2 + i * cell + 2)}" y="${n(-B.size / 2 + j * cell + 2)}" width="${n(cell - 4)}" height="5" rx="2" fill="#9ab6b0" opacity=".28"/>`;
      }
    }
    // the planned route: a few tiles lit, toward the board's edge nearest the portal
    for (const [i, j] of [[1, 5], [2, 5], [3, 5], [3, 4], [4, 4], [5, 4], [5, 3], [6, 3]]) {
      tiles += `<rect x="${n(-B.size / 2 + i * cell + 6)}" y="${n(-B.size / 2 + j * cell + 6)}" width="${n(cell - 12)}" height="${n(cell - 12)}" rx="4" fill="#7fe0cf" opacity=".26" stroke="#bff3e9" stroke-width="1.6" stroke-opacity=".45"/>`;
    }
    out += `<g transform="${floorMatrix({ angle: B.angle, h: B.h - 4, cx: bc[0], cy: bc[1] })}"><rect x="${-B.size / 2 - 3}" y="${-B.size / 2 - 3}" width="${B.size + 6}" height="${B.size + 6}" fill="#24302e"/>${tiles}</g>`;
    // brass corner caps
    for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const [x, y] = floor((u * (B.size + frame * 2)) / 2, (v * (B.size + frame * 2)) / 2, B.h - 3, { angle: B.angle, cx: bc[0], cy: bc[1] });
      out += `<ellipse cx="${x}" cy="${y}" rx="8" ry="4.5" fill="url(#brass)" stroke="#5e4119" stroke-width="1"/>`;
    }
    // walls: stone blocks on their tiles
    const wall = (i, j, w = 1, d = 1, h = 26) => {
      const x = -B.size / 2 + cell * (i + w / 2);
      const y = -B.size / 2 + cell * (j + d / 2);
      const tone = STONE_TONES[(i + j) % STONE_TONES.length];
      return prism(rect(x, y, cell * w - 8, cell * d - 8), { bottom: B.h - 4, top: B.h - 4 + h, angle: B.angle, fill: tone.top, side: tone.side, sideLight: tone.light, stroke: "#2f2a22", strokeWidth: 1.2, cx: bc[0], cy: bc[1] });
    };
    out += wall(2, 1, 2, 1) + wall(5, 1, 1, 2) + wall(1, 3, 1, 1) + wall(4, 6, 2, 1, 20);
    // the chest
    const [chx, chy] = onBoard(0, 1, B.h - 4);
    out += prism(rect(0, 0, 30, 22), { top: 18, angle: B.angle, fill: "#8a5a34", side: "url(#woodH)", sideLight: "url(#woodLight)", stroke: "#2b170b", strokeWidth: 1.2, cx: chx, cy: chy + 0 });
    out += `<rect x="${chx - 3}" y="${chy - 22}" width="6" height="8" rx="1" fill="url(#brass)"/>`;
    // the Guardião: a dark rounded stone sentinel with a quiet amber eye
    const [gx, gy] = onBoard(5, 6, B.h - 4);
    out += shadow(gx, gy, 18, 7, 0.9);
    out += `<path d="M${gx - 15} ${gy} C${gx - 17} ${gy - 30} ${gx - 12} ${gy - 46} ${gx} ${gy - 48} C${gx + 12} ${gy - 46} ${gx + 17} ${gy - 30} ${gx + 15} ${gy} Z" fill="url(#iron)" stroke="#16130f" stroke-width="1.4"/>`;
    out += `<ellipse cx="${gx}" cy="${gy}" rx="15" ry="5" fill="#2b2622"/><ellipse cx="${gx + 2}" cy="${gy - 32}" rx="5" ry="3" fill="#f2c65a"/>`;
    // stepping stones from the board's edge to the portal
    const stones = [[118, -64], [150, -100], [178, -134]];
    for (const [u, v] of stones) {
      const [sx, sy] = floor(u, v);
      out += shadow(sx, sy + 3, 24, 7, 0.7);
      out += prism(rect(0, 0, 36, 30), { top: 7, angle: 20, fill: "url(#stoneGrey)", side: "url(#stoneGreySide)", stroke: "#2c302c", strokeWidth: 1, cx: sx, cy: sy });
    }
    return out;
  })();

  const lights = [[1, 2], [4, 2], [6, 5]];
  const detail = (() => {
    let out = "";
    // the lights the portal asks for: amber orbs in brass cups
    for (const [i, j] of lights) {
      const [x, y] = onBoard(i, j, B.h - 4);
      out += `<ellipse cx="${x}" cy="${y}" rx="12" ry="5.5" fill="url(#brass)" stroke="#5e4119" stroke-width="1"/>`;
      out += `<circle cx="${x}" cy="${y - 11}" r="9" fill="url(#amberOrb)" stroke="#9c6510" stroke-width="1"/><circle cx="${x - 3}" cy="${y - 14}" r="2.6" fill="#ffffff" opacity=".8"/>`;
    }
    // the Explorador on the route's first tile
    const [ex, ey] = onBoard(1, 5, B.h - 4);
    out += shadow(ex, ey, 16, 6, 0.9);
    out += `<path d="M${ex - 12} ${ey} C${ex - 12} ${ey - 10} ${ex - 7} ${ey - 26} ${ex - 5} ${ey - 30} H${ex + 5} C${ex + 7} ${ey - 26} ${ex + 12} ${ey - 10} ${ex + 12} ${ey} Z" fill="#3a86c8" stroke="#1c4f80" stroke-width="1.4"/>`;
    out += `<circle cx="${ex}" cy="${ey - 38}" r="10" fill="#4f9ad8" stroke="#1c4f80" stroke-width="1.4"/><circle cx="${ex - 3}" cy="${ey - 41}" r="3.2" fill="#d6ecff" opacity=".8"/>`;
    out += `<ellipse cx="${ex}" cy="${ey}" rx="12" ry="4.5" fill="#245b8e"/>`;
    // the portal's swirl
    const [px, py] = portal.centre;
    out += `<path d="M${px} ${py} m-34 0 a34 40 0 1 1 34 40" stroke="#e9fffb" stroke-width="2.4" fill="none" opacity=".55" stroke-linecap="round"/><path d="M${px} ${py} m-18 0 a18 22 0 1 0 18 -22" stroke="#e9fffb" stroke-width="2" fill="none" opacity=".45" stroke-linecap="round"/>`;
    return out;
  })();

  const energy = (() => {
    const [px, py] = portal.centre;
    let out = glow(px, py + 10, 140, "glowTeal");
    for (const [i, j] of lights) {
      const [x, y] = onBoard(i, j, B.h - 4);
      out += glow(x, y - 11, 34, "glowWarm", 0.95);
    }
    const [lx, ly] = signpost.lantern;
    out += glow(lx, ly, 56, "glowWarm", 0.8);
    return out;
  })();

  const front = (() => {
    let out = "";
    // a rolled map and an open compass (left)
    const mx = cx - 252;
    const my = cy + 134;
    out += shadow(mx + 10, my + 4, 80, 12, 0.9);
    out += `<g transform="rotate(-12 ${mx} ${my})"><rect x="${mx - 64}" y="${my - 14}" width="128" height="26" rx="13" fill="url(#parchment)" stroke="#8a6a3c" stroke-width="1.4"/><ellipse cx="${mx + 64}" cy="${my - 1}" rx="7" ry="13" fill="#e3cb96" stroke="#8a6a3c" stroke-width="1.2"/><ellipse cx="${mx + 64}" cy="${my - 1}" rx="3" ry="6" fill="#b49460"/><rect x="${mx - 12}" y="${my - 15}" width="10" height="28" fill="#7a2e1c" opacity=".85"/></g>`;
    const [cxp, cyp] = [mx + 92, my + 8];
    out += shadow(cxp, cyp + 3, 30, 7, 0.9);
    out += `<ellipse cx="${cxp}" cy="${cyp}" rx="26" ry="11" fill="url(#brass)" stroke="#5e4119" stroke-width="1.4"/><ellipse cx="${cxp}" cy="${cyp - 2}" rx="20" ry="8" fill="#efe3c6" stroke="#8a6a3c" stroke-width="1"/><path d="M${cxp - 12} ${cyp + 1} L${cxp + 12} ${cyp - 5}" stroke="#7a2e1c" stroke-width="2.4" stroke-linecap="round"/>`;
    // two flat stones and a fern at the right
    const sx = cx + 246;
    const sy = cy + 140;
    out += pebble(sx, sy, 30, 11) + pebble(sx + 44, sy - 6, 20, 8, "url(#stone)");
    out += tuft(sx - 40, sy + 4, 0.8, 21);
    return out;
  })();

  return {
    "contact-shadow": contactShadowPass(),
    base,
    back: wrap(`${ruin}${signpost.svg}${portal.svg}`),
    main: wrap(board),
    detail: wrap(detail),
    energy: wrap(energy),
    front: wrap(front),
  };
}

/** The four worlds the kit paints, under their runtime folder names. */
export const ATELIER_WORLDS = {
  route: { title: "Rota Estratégica", passes: routePasses },
  circuit: { title: "Circuito de Memória", passes: circuitPasses },
  commands: { title: "Central de Comandos", passes: commandsPasses },
  garden: { title: "Jardim de Sementes", passes: gardenPasses },
};

void occlusion;
