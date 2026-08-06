/**
 * Measure the physical geometry of a Route board GLB.
 *
 * ROTA-BOARD-9X9-SYNC-01: the board's playable field, its frame and its cell
 * pitch have to be readable as numbers, not inferred from a screenshot. This
 * walks the glTF node tree, transforms every mesh's POSITION bounds by its world
 * matrix, and reports:
 *
 *   - the overall footprint (what the camera has to frame);
 *   - the tile field: how many tiles, at which centres, with what pitch;
 *   - the grid separators, which reveal how many physical divisions exist;
 *   - the frame rails, so an undersized frame cannot hide behind a big base.
 *
 * With `--assert` it also enforces the contract that this mission existed to
 * repair: the board's physical grid must match ROWS/COLS in useEscapeMaze.ts,
 * every tile centre must sit exactly where `cellToPosition` puts that cell, and
 * the frame must enclose the whole field. The 7x7-board-under-a-9x9-game bug
 * cannot come back silently.
 *
 * Usage:
 *   node tools/validation/inspect-route-board-glb.mjs [path-to.glb]
 *   node tools/validation/inspect-route-board-glb.mjs --assert
 */
import fs from "node:fs";
import path from "node:path";

const argv = process.argv.slice(2);
const assertMode = argv.includes("--assert");
const file = argv.find((a) => !a.startsWith("--")) ?? "public/models/route/board.glb";
const buf = fs.readFileSync(path.resolve(file));

if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error("not a GLB");
const jsonLength = buf.readUInt32LE(12);
const gltf = JSON.parse(buf.subarray(20, 20 + jsonLength).toString("utf8"));

/** Column-major 4x4 multiply, matching glTF's matrix convention. */
function mul(a, b) {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c += 1) {
    for (let r = 0; r < 4; r += 1) {
      let s = 0;
      for (let k = 0; k < 4; k += 1) s += a[k * 4 + r] * b[c * 4 + k];
      out[c * 4 + r] = s;
    }
  }
  return out;
}

function trs(node) {
  if (node.matrix) return node.matrix.slice();
  const [tx, ty, tz] = node.translation ?? [0, 0, 0];
  const [qx, qy, qz, qw] = node.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = node.scale ?? [1, 1, 1];
  const x2 = qx + qx;
  const y2 = qy + qy;
  const z2 = qz + qz;
  const xx = qx * x2;
  const xy = qx * y2;
  const xz = qx * z2;
  const yy = qy * y2;
  const yz = qy * z2;
  const zz = qz * z2;
  const wx = qw * x2;
  const wy = qw * y2;
  const wz = qw * z2;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

function apply(m, [x, y, z]) {
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

const parts = [];
function walk(index, parent) {
  const node = gltf.nodes[index];
  const world = mul(parent, trs(node));
  if (node.mesh !== undefined) {
    const mesh = gltf.meshes[node.mesh];
    let lo = [Infinity, Infinity, Infinity];
    let hi = [-Infinity, -Infinity, -Infinity];
    for (const prim of mesh.primitives) {
      const acc = gltf.accessors[prim.attributes.POSITION];
      if (!acc?.min || !acc?.max) continue;
      for (let i = 0; i < 8; i += 1) {
        const corner = [
          i & 1 ? acc.max[0] : acc.min[0],
          i & 2 ? acc.max[1] : acc.min[1],
          i & 4 ? acc.max[2] : acc.min[2],
        ];
        const p = apply(world, corner);
        for (let k = 0; k < 3; k += 1) {
          lo[k] = Math.min(lo[k], p[k]);
          hi[k] = Math.max(hi[k], p[k]);
        }
      }
    }
    if (Number.isFinite(lo[0])) {
      parts.push({ name: node.name ?? mesh.name ?? `node${index}`, lo, hi });
    }
  }
  for (const child of node.children ?? []) walk(child, world);
}

const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
for (const scene of gltf.scenes ?? []) for (const n of scene.nodes) walk(n, identity);

const r = (v) => Math.round(v * 1000) / 1000;
const bounds = (list) => {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (const p of list) {
    for (let k = 0; k < 3; k += 1) {
      lo[k] = Math.min(lo[k], p.lo[k]);
      hi[k] = Math.max(hi[k], p.hi[k]);
    }
  }
  return { lo: lo.map(r), hi: hi.map(r), size: hi.map((v, k) => r(v - lo[k])) };
};

// glTF is Y-up: X is board width, Z is board depth, Y is height.
const tiles = parts.filter((p) => /^Tile_\d+_\d+$/.test(p.name));
const centres = tiles
  .map((p) => ({
    name: p.name,
    x: r((p.lo[0] + p.hi[0]) / 2),
    z: r((p.lo[2] + p.hi[2]) / 2),
    w: r(p.hi[0] - p.lo[0]),
    d: r(p.hi[2] - p.lo[2]),
    top: r(p.hi[1]),
  }))
  .sort((a, b) => a.z - b.z || a.x - b.x);

const uniq = (nums) => [...new Set(nums.map((n) => r(n)))].sort((a, b) => a - b);
const xs = uniq(centres.map((c) => c.x));
const zs = uniq(centres.map((c) => c.z));
const pitch = xs.length > 1 ? uniq(xs.slice(1).map((v, i) => r(v - xs[i]))) : [];

const seps = parts.filter((p) => /^Grid_Separator/.test(p.name));
const frame = parts.filter((p) => /^Frame_Rail/.test(p.name));
const bed = parts.filter((p) => /Inset_Bed/.test(p.name));
const base = parts.filter((p) => /^Board_Base$/.test(p.name));

const report = {
  file,
  bytes: buf.length,
  meshNodes: parts.length,
  footprint: bounds(parts),
  tiles: {
    count: tiles.length,
    columns: xs.length,
    rows: zs.length,
    cellPitch: pitch,
    tileFootprint: uniq(centres.map((c) => c.w)),
    tileTopY: uniq(centres.map((c) => c.top)),
    xCentres: xs,
    zCentres: zs,
    fieldSpanX: xs.length ? r(xs[xs.length - 1] - xs[0]) : 0,
    fieldSpanZ: zs.length ? r(zs[zs.length - 1] - zs[0]) : 0,
    fieldOuterX: tiles.length ? r(Math.max(...tiles.map((t) => t.hi[0]))) : 0,
  },
  separators: {
    count: seps.length,
    xLines: uniq(seps.filter((s) => /_X_/.test(s.name)).map((s) => (s.lo[0] + s.hi[0]) / 2)),
    zLines: uniq(seps.filter((s) => /_Z_/.test(s.name)).map((s) => (s.lo[2] + s.hi[2]) / 2)),
  },
  frameRailsOuter: frame.length ? bounds(frame).size : null,
  insetBed: bed.length ? bounds(bed).size : null,
  boardBase: base.length ? bounds(base).size : null,
};

if (!assertMode) {
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

// --- contract: the physical board must match the grid the game plays on ------
const hookSource = fs.readFileSync(
  path.resolve("src/games/escape-maze/useEscapeMaze.ts"),
  "utf8",
);
const readConst = (name) => {
  const m = hookSource.match(new RegExp(`export const ${name}\\s*=\\s*(\\d+)`));
  if (!m) throw new Error(`could not read ${name} from useEscapeMaze.ts`);
  return Number(m[1]);
};
const ROWS = readConst("ROWS");
const COLS = readConst("COLS");
const CELL = 1; // routeBabylonScene.ts

const failures = [];
const check = (label, ok, detail) => {
  if (!ok) failures.push(`${label}: ${detail}`);
  console.log(`${ok ? "OK  " : "FAIL"} ${label}${ok ? "" : ` — ${detail}`}`);
};

check("tile count", tiles.length === ROWS * COLS, `${tiles.length} tiles, expected ${ROWS * COLS}`);
check("physical columns", xs.length === COLS, `${xs.length}, expected ${COLS}`);
check("physical rows", zs.length === ROWS, `${zs.length}, expected ${ROWS}`);
check("cell pitch", pitch.length === 1 && pitch[0] === CELL, `pitch ${JSON.stringify(pitch)}, expected [${CELL}]`);
check(
  "interior separators",
  report.separators.xLines.length === COLS - 1 && report.separators.zLines.length === ROWS - 1,
  `${report.separators.xLines.length}x/${report.separators.zLines.length}z, expected ${COLS - 1}/${ROWS - 1}`,
);
check("tile top Y", report.tiles.tileTopY.length === 1, `varies: ${JSON.stringify(report.tiles.tileTopY)}`);

// Every tile centre must equal cellToPosition(row, col) for its cell.
let worstCentre = 0;
for (let col = 0; col < COLS; col += 1) {
  const expected = (col - (COLS - 1) / 2) * CELL;
  worstCentre = Math.max(worstCentre, Math.abs((xs[col] ?? NaN) - expected));
}
for (let row = 0; row < ROWS; row += 1) {
  // cellToPosition maps row 0 to +z, so the sorted ascending list is reversed.
  const expected = ((ROWS - 1) / 2 - row) * CELL;
  worstCentre = Math.max(worstCentre, Math.abs((zs[ROWS - 1 - row] ?? NaN) - expected));
}
check("tile centres match cellToPosition", worstCentre <= 1e-6, `worst offset ${worstCentre}`);

// The frame has to enclose the field, not sit inside it.
const fieldHalf = (Math.max(ROWS, COLS) * CELL) / 2;
const railHalf = report.frameRailsOuter ? report.frameRailsOuter[0] / 2 : 0;
const bedHalf = report.insetBed ? report.insetBed[0] / 2 : 0;
check("slate bed covers the field", bedHalf > fieldHalf, `bed half ${bedHalf} <= field half ${fieldHalf}`);
check("frame encloses the field", railHalf > fieldHalf + 0.4, `rail half ${railHalf}, field half ${fieldHalf}`);

console.log(
  `\ngrid ${COLS}x${ROWS} · cell ${CELL} · field ${(COLS * CELL).toFixed(2)} · ` +
    `bed ${(bedHalf * 2).toFixed(2)} · frame ${(railHalf * 2).toFixed(2)} · ` +
    `footprint ${report.footprint.size[0]} · worst centre offset ${worstCentre}`,
);

if (failures.length) {
  console.error(`\n${failures.length} contract failure(s).`);
  process.exit(1);
}
console.log("BOARD_CONTRACT_OK");
