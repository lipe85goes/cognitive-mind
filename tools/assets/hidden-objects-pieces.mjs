/**
 * Game 03 — the room pieces' art (GAME03-INTERACTIONS-04), shared by both
 * rooms' art scripts and by the art kit's composer.
 *
 * A piece (a drawer front, a door, a curtain, a lid, a basket) is painted in
 * SVG in room coordinates where it sits at rest, lit by the room's own light
 * pass (the script composes it the way it composes the plate), and shipped as
 * one transparent picture the size of its `rect`. In the game the view gives it
 * a CSS transform per state (hidden-objects-interactions.ts, poseTransform);
 * here the same pose is the same matrix, so the audits and the boards see the
 * piece exactly where the game puts it.
 *
 * Nothing here knows a room.
 */
import sharp from "sharp";

const r6 = (v) => Number(v.toFixed(6));

/** The pose as the matrix taking the piece's own coordinates (su from its rect's corner) into the room — the game's poseMatrix. */
export function pieceMatrix(piece, pose = {}) {
  const angle = ((pose.rotate ?? 0) * Math.PI) / 180;
  const sx = pose.scaleX ?? 1;
  const sy = pose.scaleY ?? 1;
  const a = Math.cos(angle) * sx;
  const b = Math.sin(angle) * sx;
  const c = -Math.sin(angle) * sy;
  const d = Math.cos(angle) * sy;
  const { x: ox, y: oy } = piece.origin;
  return [a, b, c, d, piece.rect.x + ox + (pose.x ?? 0) - (a * ox + c * oy), piece.rect.y + oy + (pose.y ?? 0) - (b * ox + d * oy)];
}

/** The state a record names for a piece (`states`: "rest", "open", or { id: stateId }). */
export function stateOf(piece, states) {
  if (states === "open") return piece.states.find((s) => s.open) ?? piece.states[0];
  const id = states && typeof states === "object" ? (states[piece.id] ?? piece.initial) : piece.initial;
  return piece.states.find((s) => s.id === id) ?? piece.states[0];
}

/** SVG paint of a piece (`svg`, authored in room coordinates at rest) in a pose. */
export function posedSvg(piece, svg, pose = {}) {
  const [a, b, c, d, e, f] = pieceMatrix(piece, pose).map(r6);
  return `<g transform="matrix(${a} ${b} ${c} ${d} ${e} ${f}) translate(${-piece.rect.x} ${-piece.rect.y})">${svg}</g>`;
}

/** Every piece of a room, painted in the state `states` names: what the audit adds over the plate. */
export function piecesSvg(room, art, states = "rest") {
  return (room.interactables ?? []).map((piece) => posedSvg(piece, art[piece.id](), stateOf(piece, states).pose)).join("");
}

/**
 * Each piece's shipped picture: its paint alone on a transparent room, lit by
 * `light(albedoPng)` (the script's own plate pipeline — light, bloom, grain),
 * cut to its rect.
 */
export async function renderPieces({ room, art, defs, light }) {
  const out = {};
  for (const piece of room.interactables ?? []) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${room.width}" height="${room.height}" viewBox="0 0 ${room.width} ${room.height}"><defs>${defs}</defs>${art[piece.id]()}</svg>`;
    const albedo = await sharp(Buffer.from(svg), { density: 72, limitInputPixels: false }).png().toBuffer();
    const lit = await light(albedo);
    out[piece.id] = await sharp(lit).extract({ left: piece.rect.x, top: piece.rect.y, width: piece.rect.w, height: piece.rect.h }).png().toBuffer();
  }
  return out;
}

/**
 * A room picture (PNG, room size) with every piece's shipped picture laid over it
 * in the state `states` names — the CSS pose, shade included (brightness is a
 * plain multiply of the colour, as CSS does it).
 */
export async function overlayPieces(roomPng, room, images, states = "rest") {
  const pieces = room.interactables ?? [];
  if (pieces.length === 0) return roomPng;
  const parts = [];
  for (const piece of pieces) {
    const { pose } = stateOf(piece, states);
    let image = sharp(images[piece.id]).ensureAlpha();
    if (pose.shade !== undefined) image = image.linear([pose.shade, pose.shade, pose.shade, 1], [0, 0, 0, 0]);
    const png = (await image.png().toBuffer()).toString("base64");
    const [a, b, c, d, e, f] = pieceMatrix(piece, pose).map(r6);
    parts.push(`<image width="${piece.rect.w}" height="${piece.rect.h}" preserveAspectRatio="none" transform="matrix(${a} ${b} ${c} ${d} ${e} ${f})" xlink:href="data:image/png;base64,${png}"/>`);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${room.width}" height="${room.height}" viewBox="0 0 ${room.width} ${room.height}">${parts.join("")}</svg>`;
  const overlay = await sharp(Buffer.from(svg), { density: 72, limitInputPixels: false }).png().toBuffer();
  return sharp(roomPng).composite([{ input: overlay, left: 0, top: 0 }]).png().toBuffer();
}

/**
 * How much of an object the room shows with the pieces in `states`: the share
 * of its own pixels that change when it is painted (the audit's `visible`, on
 * the albedo, with the pieces' paint laid over the plate). An object kept
 * behind a shut piece reads 0; one a piece never covers reads its plate value.
 */
export async function visibleWithPieces({ width, height, plate, alone, pieces, target }) {
  const region = target.region;
  const b = region.kind === "rect" ? region : { x: region.cx - region.r, y: region.cy - region.r, w: 2 * region.r, h: 2 * region.r };
  // only the object's neighbourhood is rendered (the same window for every picture compared)
  const x0 = Math.max(0, Math.floor(b.x - 40));
  const y0 = Math.max(0, Math.floor(b.y - 40));
  const w = Math.min(width, Math.ceil(b.x + b.w + 40)) - x0;
  const h = Math.min(height, Math.ceil(b.y + b.h + 40)) - y0;
  const crop = (svg) =>
    svg.replace(/^<svg([^>]*?)\swidth="[^"]*"\s+height="[^"]*"\s+viewBox="[^"]*"/, `<svg$1 width="${w}" height="${h}" viewBox="${x0} ${y0} ${w} ${h}"`);
  const render = (svg) => sharp(Buffer.from(crop(svg)), { density: 72, limitInputPixels: false }).ensureAlpha().raw().toBuffer();
  const close = (svg) => svg.replace(/<\/svg>\s*$/, `${pieces}</svg>`);
  const withRaw = await render(close(plate({})));
  const withoutRaw = await render(close(plate({ omit: target.id })));
  const aloneRaw = await render(alone(target));
  for (const raw of [withRaw, withoutRaw, aloneRaw]) if (raw.length !== w * h * 4) throw new Error(`visibleWithPieces: the crop of ${target.id} did not apply`);
  let own = 0;
  let seen = 0;
  for (let i = 0; i < w * h * 4; i += 4) {
    if (aloneRaw[i + 3] <= 128) continue;
    own += 1;
    if (Math.abs(withRaw[i] - withoutRaw[i]) + Math.abs(withRaw[i + 1] - withoutRaw[i + 1]) + Math.abs(withRaw[i + 2] - withoutRaw[i + 2]) > 24) seen += 1;
  }
  return Number((seen / Math.max(1, own)).toFixed(3));
}

/** The review overlay for the pieces: each state's hit area (rest solid, open dashed) and what it keeps. */
export function piecesOverlaySvg(room) {
  const rect = (r, color, dash = "") => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" fill="none" stroke="${color}" stroke-width="4" ${dash}/>`;
  return (room.interactables ?? [])
    .map((piece) =>
      piece.states.map((state) => rect(state.hit, state.open ? "#5ad1ff" : "#ff9f1c", state.open ? `stroke-dasharray="10 6"` : "")).join(""),
    )
    .join("");
}
