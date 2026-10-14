/**
 * Game 03 — the art of a room whose things move (GAME03-REPLAYABILITY-05),
 * shared by both rooms' art scripts. Nothing here knows a room.
 *
 * A room's plate is painted in SVG, back to front, as a list of paint chunks
 * with one marker per slot (`{ slot: id }`) where a thing on that slot is
 * painted in the room's order: under what the room paints in front of that
 * spot (the strap over the key, the open book over the compass's rim), over
 * what is behind it. The shipped plate paints every marker empty: the room
 * without anything that moves. Each placement — a thing on one of its slots —
 * becomes one picture:
 *
 *   occupant  the thing's own paint (its shadow and what hangs from it, then
 *             the object), put on the slot (`art(thing, box, placement)`);
 *   cover     the alpha of everything the room paints after the slot's marker;
 *   picture   alpha = occupant alpha × (1 − cover); colour solved so that the
 *             picture composited over the shipped plate gives exactly the
 *             room as it would be lit with the thing painted there (the room's
 *             own light, bloom and grain, through the plate's sharp pipeline,
 *             on the crop with and without the thing) — exact under a
 *             see-through cover (the glass of a cabinet) and on a soft edge.
 *
 * Every picture goes into one atlas per room; the art module the game reads
 * (scenes/<room>.art.ts) says where each is and what the audit measured for
 * each pool object on each of its slots:
 *   visible  the share of its own pixels the room shows there (the plate with
 *            and without it, on the albedo: the same rule as every audit since
 *            the skeleton);
 *   edge     the median luminance ratio across its visible silhouette's edge,
 *            on the composed room (lossless, with the pieces at rest — or its
 *            own piece open — and the foreground layers);
 *   ring/busy/near  clutter as counts on the shipped layers: busy pixels of the
 *            ring 16–120 su around its box with nothing else that moves, and
 *            what each other placement's picture adds to that ring when it is
 *            in the layout — so the clutter of any layout is exact arithmetic.
 */
import fs from "node:fs";
import sharp from "sharp";
import { CLUTTER_EDGE, CLUTTER_RING, boxOf, luminance } from "./hidden-objects-art-kit.mjs";
import { overlayPieces } from "./hidden-objects-pieces.mjs";

const clampInt = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** A room's things (pool, look-alikes, props), each with its home box and placements — the engine's layoutThings, in plain JS. */
export function roomThings(room) {
  return [
    ...room.pool.filter((t) => t.placements?.length).map((t) => ({ id: t.id, role: "target", home: boxOf(t.region), region: t.region, placements: t.placements, gate: t.gate })),
    ...room.lookAlikes.filter((l) => l.placements?.length).map((l) => ({ id: l.id, role: "lookalike", home: boxOf(l.region), region: l.region, placements: l.placements })),
    ...(room.props ?? []).map((p) => ({ id: p.id, role: "prop", home: p.box, region: { kind: "rect", ...p.box }, placements: p.placements })),
  ];
}

export const slotOf = (room, id) => {
  const slot = room.slots.find((s) => s.id === id);
  if (!slot) throw new Error(`unknown slot ${id}`);
  return slot;
};

/** The engine's boxOnSlot. */
export function boxOnSlot(size, slot) {
  const x = slot.at.x - size.w / 2;
  const y = slot.align === "bottom" ? slot.at.y - size.h : slot.align === "top" ? slot.at.y : slot.at.y - size.h / 2;
  return { x, y, w: size.w, h: size.h };
}

export const placementKey = (thing, slot) => `${thing}@${slot}`;

/** Every placement of a room: { key, thing, placement, slot, box }. */
export function roomPlacements(room) {
  return roomThings(room).flatMap((thing) =>
    thing.placements.map((placement) => {
      const slot = slotOf(room, placement.slot);
      return { key: placementKey(thing.id, placement.slot), thing, placement, slot, box: boxOnSlot(thing.home, slot) };
    }),
  );
}

/** The home placement of each thing (its first). */
export const homePlacements = (room) => roomThings(room).map((thing) => placementKey(thing.id, thing.placements[0].slot));

/** The chunks of a plate as SVG text: markers become `fill(slot)` (empty by default). */
export function chunkText(chunks, fill = () => "") {
  return chunks.map((chunk) => (typeof chunk === "string" ? chunk : fill(chunk.slot))).join("\n");
}

/** The chunks after a slot's marker (for its cover), every marker empty. */
export function chunksAfter(chunks, slot) {
  const index = chunks.findIndex((chunk) => typeof chunk !== "string" && chunk.slot === slot);
  if (index < 0) throw new Error(`no marker for slot ${slot}`);
  return chunks.slice(index + 1);
}
export function chunksBefore(chunks, slot) {
  const index = chunks.findIndex((chunk) => typeof chunk !== "string" && chunk.slot === slot);
  if (index < 0) throw new Error(`no marker for slot ${slot}`);
  return chunks.slice(0, index);
}

/** An SVG document of the room (W×H user units), cropped to `crop` (integer su) when given. */
export function roomSvg({ width, height, defs, body, crop = null }) {
  const view = crop ? `width="${crop.w}" height="${crop.h}" viewBox="${crop.x} ${crop.y} ${crop.w} ${crop.h}"` : `width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ${view}><defs>${defs}</defs>${body}</svg>`;
}

/** Straight RGBA of an SVG (1 px per user unit). */
export async function rasterize(svg, expect = null) {
  const { data, info } = await sharp(Buffer.from(svg), { density: 72, limitInputPixels: false }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (expect && (info.width !== expect.w || info.height !== expect.h)) throw new Error(`rasterize: ${info.width}x${info.height}, expected ${expect.w}x${expect.h}`);
  return data;
}

/** A thing's paint mirrored left to right about its box's centre. */
export function mirrored(svg, box) {
  const cx = box.x + box.w / 2;
  return `<g transform="translate(${2 * cx} 0) scale(-1 1)">${svg}</g>`;
}

/** Raw RGB crop of a full-size raw buffer (channels per pixel). */
export function cropRaw(raw, width, channels, crop, height = null) {
  const out = Buffer.alloc(crop.w * crop.h * channels);
  for (let y = 0; y < crop.h; y += 1) {
    const sy = crop.y + y;
    if (height !== null && (sy < 0 || sy >= height)) continue;
    for (let x = 0; x < crop.w; x += 1) {
      const sx = crop.x + x;
      if (sx < 0 || sx >= width) continue;
      raw.copy(out, (y * crop.w + x) * channels, (sy * width + sx) * channels, (sy * width + sx + 1) * channels);
    }
  }
  return out;
}

/**
 * The room's light, as the plate's pipeline applies it (`light`, `glow`,
 * `grain`: PNG buffers of the full room) — kept raw so a crop can be lit
 * exactly like the plate around it.
 */
export async function lightRaw({ width, height, light, glow, grain }) {
  const raw = async (png) => sharp(png).removeAlpha().raw().toBuffer();
  return { width, height, light: await raw(light), glow: await raw(glow), grain: await raw(grain) };
}

/** Opaque RGB of a crop lit by the room's light: multiply, screen, soft light — the plate's own sharp pipeline, on these pixels. */
export async function litCrop(rgb, crop, lighting) {
  const { width, height } = lighting;
  const part = (raw) => sharp(cropRaw(raw, width, 3, crop, height), { raw: { width: crop.w, height: crop.h, channels: 3 } }).png().toBuffer();
  return sharp(rgb, { raw: { width: crop.w, height: crop.h, channels: 3 } })
    .composite([
      { input: await part(lighting.light), blend: "multiply" },
      { input: await part(lighting.glow), blend: "screen" },
      { input: await part(lighting.grain), blend: "soft-light" },
    ])
    .removeAlpha()
    .raw()
    .toBuffer();
}

/** Straight RGBA flattened on black, as the plate's pipeline lights it: RGB. */
function onBlack(rgba) {
  const out = Buffer.alloc((rgba.length / 4) * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    const a = rgba[i + 3] / 255;
    out[j] = Math.round(rgba[i] * a);
    out[j + 1] = Math.round(rgba[i + 1] * a);
    out[j + 2] = Math.round(rgba[i + 2] * a);
  }
  return out;
}

/** `top` over `bottom` (straight RGBA buffers of the same size), into a new buffer. */
export function over(top, bottom) {
  const out = Buffer.alloc(bottom.length);
  for (let i = 0; i < bottom.length; i += 4) {
    const ta = top[i + 3] / 255;
    const ba = bottom[i + 3] / 255;
    const oa = ta + ba * (1 - ta);
    if (oa <= 0) continue;
    for (let c = 0; c < 3; c += 1) out[i + c] = Math.round((top[i + c] * ta + bottom[i + c] * ba * (1 - ta)) / oa);
    out[i + 3] = Math.round(oa * 255);
  }
  return out;
}

/**
 * Renders every placement's picture.
 *   room    the room's data (pool, lookAlikes, props, slots, width, height)
 *   chunks  the plate's paint list, with a marker per slot
 *   defs    the SVG defs every paint needs
 *   art     (thing, box, placement, slot) => { under, object, margin } — the
 *           thing's own paint on that box (under: shadows and what hangs from it)
 *   lighting  lightRaw(...) of the room
 * Returns Map key → { x, y, w, h, rgba (lit, straight), own (object alpha>128 mask), seen (own & visible mask), crop }.
 */
export async function renderPlacements({ room, chunks, defs, art, lighting, fixed = () => "", log = () => {} }) {
  const W = room.width;
  const H = room.height;
  const placements = roomPlacements(room);
  const cropFor = (box, margin) => {
    const x = clampInt(Math.floor(box.x - margin), 0, W);
    const y = clampInt(Math.floor(box.y - margin), 0, H);
    return { x, y, w: clampInt(Math.ceil(box.x + box.w + margin), 0, W) - x, h: clampInt(Math.ceil(box.y + box.h + margin), 0, H) - y };
  };
  const union = (crops) =>
    crops.reduce((u, c) => {
      const x0 = Math.min(u.x, c.x);
      const y0 = Math.min(u.y, c.y);
      return { x: x0, y: y0, w: Math.max(u.x + u.w, c.x + c.w) - x0, h: Math.max(u.y + u.h, c.y + c.h) - y0 };
    });
  /** Whether a buffer's paint touches the crop's border (other than the room's own border). */
  const touches = (buffer, crop) => {
    for (let x = 0; x < crop.w; x += 1)
      for (const y of [0, crop.h - 1]) if (buffer[(y * crop.w + x) * 4 + 3] > 8 && !(crop.y === 0 && y === 0) && !(crop.y + crop.h === H && y === crop.h - 1)) return true;
    for (let y = 0; y < crop.h; y += 1)
      for (const x of [0, crop.w - 1]) if (buffer[(y * crop.w + x) * 4 + 3] > 8 && !(crop.x === 0 && x === 0) && !(crop.x + crop.w === W && x === crop.w - 1)) return true;
    return false;
  };
  const bySlot = new Map();
  for (const p of placements) {
    const paint = art(p.thing, p.box, p.placement, p.slot);
    if (!bySlot.has(p.slot.id)) bySlot.set(p.slot.id, []);
    bySlot.get(p.slot.id).push({ ...p, paint, margin: paint.margin ?? 40 });
  }
  const out = new Map();
  let done = 0;
  for (const [slotId, list] of bySlot) {
    // one crop for the slot, wide enough for every occupant's paint (widened until nothing touches its border)
    let rendered = null;
    for (let attempt = 0; attempt < 5 && !rendered; attempt += 1) {
      const crop = union(list.map((p) => cropFor(p.box, p.margin)));
      const doc = (body) => roomSvg({ width: W, height: H, defs, body, crop });
      const occupants = [];
      let widened = false;
      for (const p of list) {
        const under = await rasterize(doc(p.paint.under ?? ""), crop);
        const object = await rasterize(doc(p.paint.object), crop);
        const occupant = over(object, under);
        if (touches(occupant, crop)) {
          p.margin *= 2;
          widened = true;
          break;
        }
        occupants.push({ p, object, occupant });
      }
      if (widened) continue;
      rendered = {
        crop,
        occupants,
        before: await rasterize(doc(chunkText(chunksBefore(chunks, slotId), fixed)), crop),
        after: await rasterize(doc(chunkText(chunksAfter(chunks, slotId), fixed)), crop),
      };
    }
    if (!rendered) throw new Error(`${slotId}: an occupant's paint is wider than any margin tried`);
    const { crop, before, after } = rendered;
    // the room's own pixels here, lit as the plate is: without any thing on the slot
    const litWithout = await litCrop(onBlack(over(after, before)), crop, lighting);
    for (const { p, object, occupant } of rendered.occupants) {
      const n = crop.w * crop.h;
      const rgb = Buffer.alloc(n * 3);
      for (let i = 0; i < n; i += 1) for (let c = 0; c < 3; c += 1) rgb[i * 3 + c] = occupant[i * 4 + c];
      const lit = await litCrop(rgb, crop, lighting);
      // …and with this thing on it
      const litWith = await litCrop(onBlack(over(after, over(occupant, before))), crop, lighting);
      const rgba = Buffer.alloc(n * 4);
      const own = new Uint8Array(n);
      const seen = new Uint8Array(n);
      let x0 = crop.w;
      let y0 = crop.h;
      let x1 = -1;
      let y1 = -1;
      let ownCount = 0;
      let seenCount = 0;
      for (let i = 0; i < n; i += 1) {
        const a = occupant[i * 4 + 3] / 255;
        const c = after[i * 4 + 3] / 255;
        const alpha = Math.round(a * (1 - c) * 255);
        // the colour that, at this alpha over the room without the thing, gives the room with it
        const k = alpha / 255;
        for (let ch = 0; ch < 3; ch += 1) {
          const j = i * 3 + ch;
          rgba[i * 4 + ch] = k >= 0.04 ? clampInt(Math.round((litWith[j] - (1 - k) * litWithout[j]) / k), 0, 255) : lit[j];
        }
        rgba[i * 4 + 3] = alpha;
        if (alpha >= 10) {
          const x = i % crop.w;
          const y = Math.floor(i / crop.w);
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        }
        // the audit's rule on the albedo: the pixel changes when the thing is painted (with − without, under the cover)
        if (object[i * 4 + 3] > 128) {
          own[i] = 1;
          ownCount += 1;
          let diff = 0;
          for (let k = 0; k < 3; k += 1) diff += Math.abs((1 - c) * a * (occupant[i * 4 + k] - before[i * 4 + k] * (before[i * 4 + 3] / 255)));
          if (diff > 24) {
            seen[i] = 1;
            seenCount += 1;
          }
        }
      }
      if (x1 < 0) throw new Error(`${p.key}: nothing of it shows`);
      out.set(p.key, {
        key: p.key,
        thing: p.thing,
        placement: p.placement,
        slot: p.slot,
        box: p.box,
        crop,
        rgba,
        own,
        seen,
        visible: Number((seenCount / Math.max(1, ownCount)).toFixed(3)),
        bounds: { x: crop.x + x0, y: crop.y + y0, w: x1 - x0 + 1, h: y1 - y0 + 1 },
      });
      done += 1;
    }
    log(`  ${done}/${placements.length} placements`);
  }
  return out;
}

/** A picture cut to its bounds (straight RGBA). */
export function trimmed(picture) {
  const { crop, bounds, rgba } = picture;
  const out = Buffer.alloc(bounds.w * bounds.h * 4);
  for (let y = 0; y < bounds.h; y += 1) rgba.copy(out, y * bounds.w * 4, ((bounds.y - crop.y + y) * crop.w + (bounds.x - crop.x)) * 4, ((bounds.y - crop.y + y) * crop.w + (bounds.x - crop.x) + bounds.w) * 4);
  // the faintest edge of a soft shadow (alpha under 10/255) costs bytes and shows nothing
  for (let i = 3; i < out.length; i += 4) if (out[i] < 10) out[i - 3] = out[i - 2] = out[i - 1] = out[i] = 0;
  return out;
}

/** Shelf packing (tallest first), `gap` transparent pixels between pictures. */
export function packAtlas(pictures, { width = 1024, gap = 2, skip = new Set() } = {}) {
  const items = [...pictures.values()].filter((p) => !skip.has(p.key)).map((p) => ({ key: p.key, w: p.bounds.w, h: p.bounds.h })).sort((a, b) => b.h - a.h || b.w - a.w || (a.key < b.key ? -1 : 1));
  const rects = new Map();
  let x = gap;
  let y = gap;
  let row = 0;
  for (const item of items) {
    if (item.w + 2 * gap > width) throw new Error(`${item.key} is wider than the atlas`);
    if (x + item.w + gap > width) {
      x = gap;
      y += row + gap;
      row = 0;
    }
    rects.set(item.key, { sx: x, sy: y, w: item.w, h: item.h });
    x += item.w + gap;
    row = Math.max(row, item.h);
  }
  return { width, height: y + row + gap, rects };
}

/** The atlas picture (PNG) from the pictures and their rects. */
export async function atlasPng(pictures, packed) {
  const inputs = [...pictures.values()].filter((p) => packed.rects.has(p.key)).map((p) => {
    const r = packed.rects.get(p.key);
    return { input: trimmed(p), raw: { width: r.w, height: r.h, channels: 4 }, left: r.sx, top: r.sy };
  });
  return sharp({ create: { width: packed.width, height: packed.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(inputs)
    .png()
    .toBuffer();
}

/** Where a shipped atlas's picture of a placement is painted in the room: { x, y, w, h, rgba } read from the atlas. */
export function spriteFromAtlas(atlasRaw, atlasWidth, rect, at) {
  const rgba = Buffer.alloc(rect.w * rect.h * 4);
  for (let y = 0; y < rect.h; y += 1) atlasRaw.copy(rgba, y * rect.w * 4, ((rect.sy + y) * atlasWidth + rect.sx) * 4, ((rect.sy + y) * atlasWidth + rect.sx + rect.w) * 4);
  return { x: at.x, y: at.y, w: rect.w, h: rect.h, rgba };
}

/** A room-size RGBA buffer with `sprites` ({x, y, w, h, rgba}) composited over it, in order (in place). */
export function paintSprites(room, base, sprites) {
  const W = room.width;
  for (const s of sprites) {
    for (let y = 0; y < s.h; y += 1) {
      const ry = s.y + y;
      if (ry < 0 || ry >= room.height) continue;
      for (let x = 0; x < s.w; x += 1) {
        const rx = s.x + x;
        if (rx < 0 || rx >= W) continue;
        const si = (y * s.w + x) * 4;
        const ta = s.rgba[si + 3] / 255;
        if (ta <= 0) continue;
        const bi = (ry * W + rx) * 4;
        const ba = base[bi + 3] / 255;
        const oa = ta + ba * (1 - ta);
        for (let c = 0; c < 3; c += 1) base[bi + c] = Math.round((s.rgba[si + c] * ta + base[bi + c] * ba * (1 - ta)) / oa);
        base[bi + 3] = Math.round(oa * 255);
      }
    }
  }
  return base;
}

/** The order the game paints a layout's pictures in: the bottom of each thing's box, then its left, then its key (hidden-objects-layout.ts, layoutSprites). */
export const paintOrder = (a, b) => a.box.y + a.box.h - (b.box.y + b.box.h) || a.box.x - b.box.x || (a.key < b.key ? -1 : 1);

/**
 * The room in layers, raw RGBA at room size: `under` (the back layer and the
 * plate) and `overlay` (the pieces in `states` and the foreground layers, on
 * transparency) — the things go between the two, as in the game.
 */
export async function roomLayers(room, readImage, states = "rest") {
  const W = room.width;
  const H = room.height;
  const plateIndex = room.layers.findIndex((layer) => layer.id === "plate");
  const below = room.layers.slice(0, plateIndex + 1);
  const above = room.layers.slice(plateIndex + 1);
  const inputs = async (layers) => Promise.all(layers.map(async (layer) => ({ input: await readImage(layer.src), left: layer.rect.x, top: layer.rect.y })));
  const under = await sharp({ create: { width: W, height: H, channels: 4, background: "#000000" } }).composite(await inputs(below)).png().toBuffer();
  const empty = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  const images = Object.fromEntries(await Promise.all((room.interactables ?? []).map(async (piece) => [piece.id, await readImage(piece.src)])));
  let overlay = await overlayPieces(empty, room, images, states);
  if (above.length) overlay = await sharp(overlay).composite(await inputs(above)).png().toBuffer();
  return {
    under: await sharp(under).ensureAlpha().raw().toBuffer(),
    overlay: await sharp(overlay).ensureAlpha().raw().toBuffer(),
  };
}

/** `under` with the sprites painted, then `overlay` on top: the room as the game shows it (a new buffer). */
export function composeLayers(room, layers, sprites) {
  const base = Buffer.from(layers.under);
  paintSprites(room, base, sprites);
  const W = room.width;
  const o = layers.overlay;
  for (let i = 0; i < base.length; i += 4) {
    const ta = o[i + 3] / 255;
    if (ta <= 0) continue;
    for (let c = 0; c < 3; c += 1) base[i + c] = Math.round(o[i + c] * ta + base[i + c] * (1 - ta));
    base[i + 3] = 255;
  }
  void W;
  return base;
}

/** The ring of room CLUTTER_RING.inner–.outer su around a box, as an integer rectangle region of the room. */
export function ringOf(room, box) {
  const x0 = Math.max(1, Math.floor(box.x - CLUTTER_RING.outer));
  const x1 = Math.min(room.width - 1, Math.ceil(box.x + box.w + CLUTTER_RING.outer));
  const y0 = Math.max(1, Math.floor(box.y - CLUTTER_RING.outer));
  const y1 = Math.min(room.height - 1, Math.ceil(box.y + box.h + CLUTTER_RING.outer));
  return { x0, x1, y0, y1, box };
}

/** Busy pixels (Sobel > CLUTTER_EDGE) and ring pixels of `ring` on a room-size RGBA buffer — measureClutter's count. */
export function ringCounts(composed, width, ring) {
  const lum = (x, y) => {
    const i = (y * width + x) * 4;
    return 0.2126 * composed[i] + 0.7152 * composed[i + 1] + 0.0722 * composed[i + 2];
  };
  const b = ring.box;
  let total = 0;
  let busy = 0;
  for (let y = ring.y0; y < ring.y1; y += 1) {
    for (let x = ring.x0; x < ring.x1; x += 1) {
      if (x >= b.x - CLUTTER_RING.inner && x < b.x + b.w + CLUTTER_RING.inner && y >= b.y - CLUTTER_RING.inner && y < b.y + b.h + CLUTTER_RING.inner) continue;
      const gx = -lum(x - 1, y - 1) - 2 * lum(x - 1, y) - lum(x - 1, y + 1) + lum(x + 1, y - 1) + 2 * lum(x + 1, y) + lum(x + 1, y + 1);
      const gy = -lum(x - 1, y - 1) - 2 * lum(x, y - 1) - lum(x + 1, y - 1) + lum(x - 1, y + 1) + 2 * lum(x, y + 1) + lum(x + 1, y + 1);
      total += 1;
      if (Math.hypot(gx, gy) > CLUTTER_EDGE) busy += 1;
    }
  }
  return { ring: total, busy };
}

/** The edge rule (the median luminance ratio across the visible silhouette's edge), on a composed room-size RGBA buffer. */
export function edgeOf(composed, width, picture) {
  const { crop, own, seen } = picture;
  const lumAt = (x, y) => {
    const i = ((crop.y + y) * width + crop.x + x) * 4;
    return luminance(composed[i], composed[i + 1], composed[i + 2]);
  };
  const ratios = [];
  for (let y = 3; y < crop.h - 3; y += 1) {
    for (let x = 3; x < crop.w - 3; x += 1) {
      if (!seen[y * crop.w + x]) continue;
      let outside = 0;
      let sum = 0;
      for (let dy = -3; dy <= 3; dy += 1) {
        for (let dx = -3; dx <= 3; dx += 1) {
          if (dx * dx + dy * dy > 9 || own[(y + dy) * crop.w + x + dx]) continue;
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
  return Number((ratios[Math.floor(ratios.length / 2)] ?? 1).toFixed(2));
}

/** The TypeScript module the game reads: the atlas, and per placement its picture and (pool objects) its audit. */
export function artModule({ atlasName, artName, atlas, entries, header }) {
  const lines = [];
  lines.push(`import type { PlacementArt, SceneAtlas } from "@/games/hidden-objects/hidden-objects-scene";`);
  lines.push("");
  lines.push("/**");
  for (const line of header) lines.push(` * ${line}`.trimEnd());
  lines.push(" */");
  lines.push(`export const ${atlasName}: SceneAtlas = { src: "${atlas.src}", width: ${atlas.width}, height: ${atlas.height} };`);
  lines.push("");
  lines.push(`export const ${artName}: Readonly<Record<string, PlacementArt>> = {`);
  for (const [key, entry] of entries) {
    const s = entry.sprite;
    const sprite = s ? `sprite: { sx: ${s.sx}, sy: ${s.sy}, w: ${s.w}, h: ${s.h}, x: ${s.x}, y: ${s.y} }` : "baked: true";
    if (!entry.measured) {
      lines.push(`  "${key}": { ${sprite} },`);
      continue;
    }
    const m = entry.measured;
    const near = Object.entries(m.near)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `"${k}": ${v}`)
      .join(", ");
    lines.push(`  "${key}": {`);
    lines.push(`    ${sprite},`);
    lines.push(`    measured: { visible: ${m.visible}, edge: ${m.edge}, ring: ${m.ring}, busy: ${m.busy}, near: { ${near} } },`);
    lines.push("  },");
  }
  lines.push("};");
  return `${lines.join("\n")}\n`;
}

/** Writes a file only if its bytes changed (keeps timestamps quiet). */
export function writeIfChanged(file, content) {
  if (fs.existsSync(file) && Buffer.compare(fs.readFileSync(file), Buffer.from(content)) === 0) return false;
  fs.writeFileSync(file, content);
  return true;
}

/** A crop (integer rect of the room) of a room-size RGBA buffer. */
export const cropOf = (room, buffer, crop) => cropRaw(buffer, room.width, 4, crop, room.height);

/**
 * The room as the game shows it, in one crop: the layers' `under`, then the
 * sprites in order ({ x, y, w, h, rgba } in room coordinates), then `overlay`.
 */
export function composeCrop(room, layers, sprites, crop) {
  const base = cropOf(room, layers.under, crop);
  for (const s of sprites) {
    const x0 = Math.max(s.x, crop.x);
    const y0 = Math.max(s.y, crop.y);
    const x1 = Math.min(s.x + s.w, crop.x + crop.w);
    const y1 = Math.min(s.y + s.h, crop.y + crop.h);
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const si = ((y - s.y) * s.w + (x - s.x)) * 4;
        const ta = s.rgba[si + 3] / 255;
        if (ta <= 0) continue;
        const bi = ((y - crop.y) * crop.w + (x - crop.x)) * 4;
        const ba = base[bi + 3] / 255;
        const oa = ta + ba * (1 - ta);
        for (let c = 0; c < 3; c += 1) base[bi + c] = Math.round((s.rgba[si + c] * ta + base[bi + c] * ba * (1 - ta)) / oa);
        base[bi + 3] = Math.round(oa * 255);
      }
    }
  }
  const o = cropOf(room, layers.overlay, crop);
  for (let i = 0; i < base.length; i += 4) {
    const ta = o[i + 3] / 255;
    if (ta <= 0) continue;
    for (let c = 0; c < 3; c += 1) base[i + c] = Math.round(o[i + c] * ta + base[i + c] * (1 - ta));
    base[i + 3] = 255;
  }
  return base;
}

/** ringCounts on a crop buffer whose origin is (crop.x, crop.y): the ring must lie inside the crop, one pixel in. */
export function ringCountsIn(buffer, crop, ring) {
  const lum = (x, y) => {
    const i = ((y - crop.y) * crop.w + (x - crop.x)) * 4;
    return 0.2126 * buffer[i] + 0.7152 * buffer[i + 1] + 0.0722 * buffer[i + 2];
  };
  const b = ring.box;
  let total = 0;
  let busy = 0;
  for (let y = ring.y0; y < ring.y1; y += 1) {
    for (let x = ring.x0; x < ring.x1; x += 1) {
      if (x >= b.x - CLUTTER_RING.inner && x < b.x + b.w + CLUTTER_RING.inner && y >= b.y - CLUTTER_RING.inner && y < b.y + b.h + CLUTTER_RING.inner) continue;
      const gx = -lum(x - 1, y - 1) - 2 * lum(x - 1, y) - lum(x - 1, y + 1) + lum(x + 1, y - 1) + 2 * lum(x + 1, y) + lum(x + 1, y + 1);
      const gy = -lum(x - 1, y - 1) - 2 * lum(x, y - 1) - lum(x + 1, y - 1) + lum(x - 1, y + 1) + 2 * lum(x, y + 1) + lum(x + 1, y + 1);
      total += 1;
      if (Math.hypot(gx, gy) > CLUTTER_EDGE) busy += 1;
    }
  }
  return { ring: total, busy };
}

/** The crop a ring is counted in: the ring's rectangle and the one pixel Sobel reads around it. */
export const ringCrop = (ring) => ({ x: ring.x0 - 1, y: ring.y0 - 1, w: ring.x1 - ring.x0 + 2, h: ring.y1 - ring.y0 + 2 });

/** edgeOf on a crop buffer equal to the picture's crop. */
export function edgeIn(buffer, picture) {
  const { crop, own, seen } = picture;
  const lumAt = (x, y) => {
    const i = (y * crop.w + x) * 4;
    return luminance(buffer[i], buffer[i + 1], buffer[i + 2]);
  };
  const ratios = [];
  for (let y = 3; y < crop.h - 3; y += 1) {
    for (let x = 3; x < crop.w - 3; x += 1) {
      if (!seen[y * crop.w + x]) continue;
      let outside = 0;
      let sum = 0;
      for (let dy = -3; dy <= 3; dy += 1) {
        for (let dx = -3; dx <= 3; dx += 1) {
          if (dx * dx + dy * dy > 9 || own[(y + dy) * crop.w + x + dx]) continue;
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
  return Number((ratios[Math.floor(ratios.length / 2)] ?? 1).toFixed(2));
}

/** A picture as a sprite in room coordinates (its trimmed bounds). */
export const spriteOf = (picture) => ({ x: picture.bounds.x, y: picture.bounds.y, w: picture.bounds.w, h: picture.bounds.h, rgba: trimmed(picture) });

/** The room's pieces alone in `states` (no foreground), raw RGBA at room size: what may cover a thing. */
export async function piecesOverlay(room, readImage, states) {
  const empty = await sharp({ create: { width: room.width, height: room.height, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  const images = Object.fromEntries(await Promise.all((room.interactables ?? []).map(async (piece) => [piece.id, await readImage(piece.src)])));
  return sharp(await overlayPieces(empty, room, images, states)).ensureAlpha().raw().toBuffer();
}

/** The pieces' states with every piece open (its first state that exposes what it keeps). */
export const allOpen = (room) => Object.fromEntries((room.interactables ?? []).map((piece) => [piece.id, (piece.states.find((s) => s.open) ?? piece.states[0]).id]));
/** One piece open, the rest as authored. */
export const oneOpen = (room, gate) =>
  Object.fromEntries((room.interactables ?? []).map((piece) => [piece.id, piece.id === gate ? (piece.states.find((s) => s.open) ?? piece.states[0]).id : piece.initial]));

/**
 * The audit of every pool object on every slot it may take (see the header).
 *   pictures      renderPlacements' result (lossless, with own/seen masks)
 *   readLossless  src → PNG buffer of the in-memory layers (the plate, back, foreground, pieces as rendered)
 *   readShipped   src → the shipped file's bytes (WebP), atlas included
 *   rects         the atlas's rect per placement key
 *   clash         (keyA, keyB) → whether two placements may not share a layout (the engine's rule)
 * Returns Map key → { visible, visibleAtRest, visibleOpen, contrast, edge, ring, busy, near }.
 */
export async function auditPlacements({ room, pictures, readLossless, readShipped, atlasSrc, rects, clash, baked = new Set(), log = () => {} }) {
  const W = room.width;
  const things = roomThings(room);
  const targets = new Set(things.filter((t) => t.role === "target").map((t) => t.id));
  const gateOf = Object.fromEntries(things.map((t) => [t.id, t.gate ?? null]));
  const stateKeys = ["rest", ...new Set(things.map((t) => t.gate).filter(Boolean))];
  const statesFor = (key) => (key === "rest" ? "rest" : oneOpen(room, key));
  const lossless = {};
  const shipped = {};
  for (const key of stateKeys) {
    lossless[key] = await roomLayers(room, readLossless, statesFor(key));
    shipped[key] = await roomLayers(room, readShipped, statesFor(key));
  }
  const piecesRest = await piecesOverlay(room, readLossless, "rest");
  const piecesOpen = await piecesOverlay(room, readLossless, allOpen(room));
  const { data: atlasRaw, info } = await sharp(await readShipped(atlasSrc)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  // a thing baked into the plate is already in every composition: it is never painted again
  const shippedSprite = (picture) => (baked.has(picture.key) ? null : spriteFromAtlas(atlasRaw, info.width, rects.get(picture.key), picture.bounds));
  const all = [...pictures.values()];
  const out = new Map();
  let done = 0;
  for (const p of all) {
    if (!targets.has(p.thing.id)) continue;
    const state = gateOf[p.thing.id] ?? "rest";
    // visible with the pieces as authored / all open (covered: a piece's paint over a pixel it shows)
    const visibleWith = (pieces) => {
      let own = 0;
      let seen = 0;
      for (let y = 0; y < p.crop.h; y += 1)
        for (let x = 0; x < p.crop.w; x += 1) {
          const i = y * p.crop.w + x;
          if (!p.own[i]) continue;
          own += 1;
          if (!p.seen[i]) continue;
          if (pieces[((p.crop.y + y) * W + p.crop.x + x) * 4 + 3] > 128) continue;
          seen += 1;
        }
      return Number((seen / Math.max(1, own)).toFixed(3));
    };
    // edge and contrast: lossless, the room as the game shows it with this thing alone among the things that move
    const composed = composeCrop(room, lossless[state], baked.has(p.key) ? [] : [spriteOf(p)], p.crop);
    const edge = edgeIn(composed, p);
    let lumIn = 0;
    let nIn = 0;
    let lumRing = 0;
    let nRing = 0;
    const b = p.box;
    for (let y = 0; y < p.crop.h; y += 1)
      for (let x = 0; x < p.crop.w; x += 1) {
        const i = y * p.crop.w + x;
        const rx = p.crop.x + x;
        const ry = p.crop.y + y;
        const l = luminance(composed[i * 4], composed[i * 4 + 1], composed[i * 4 + 2]);
        if (p.seen[i]) {
          lumIn += l;
          nIn += 1;
        } else if (!p.own[i] && p.rgba[i * 4 + 3] < 26 && rx >= b.x - 24 && rx < b.x + b.w + 24 && ry >= b.y - 24 && ry < b.y + b.h + 24) {
          lumRing += l;
          nRing += 1;
        }
      }
    const li = nIn ? lumIn / nIn : 0;
    const lr = nRing ? lumRing / nRing : 0;
    const contrast = Number(((Math.max(li, lr) + 0.05) / (Math.min(li, lr) + 0.05)).toFixed(2));
    // clutter: on the shipped layers, its ring with it alone, then what each other placement's picture adds
    const ring = ringOf(room, b);
    const crop = ringCrop(ring);
    const mine = shippedSprite(p);
    const alone = ringCountsIn(composeCrop(room, shipped[state], mine ? [mine] : [], crop), crop, ring);
    const near = {};
    for (const q of all) {
      if (q.thing.id === p.thing.id || baked.has(q.key)) continue;
      const qb = q.bounds;
      if (qb.x >= crop.x + crop.w || qb.x + qb.w <= crop.x || qb.y >= crop.y + crop.h || qb.y + qb.h <= crop.y) continue;
      if (clash(p.key, q.key)) continue;
      const pair = [
        { box: p.box, key: p.key, sprite: mine },
        { box: q.box, key: q.key, sprite: shippedSprite(q) },
      ].sort(paintOrder);
      const counts = ringCountsIn(composeCrop(room, shipped[state], pair.map((e) => e.sprite).filter(Boolean), crop), crop, ring);
      const delta = counts.busy - alone.busy;
      if (delta !== 0) near[q.key] = delta;
    }
    out.set(p.key, {
      visible: p.visible,
      visibleAtRest: visibleWith(piecesRest),
      visibleOpen: visibleWith(piecesOpen),
      contrast,
      edge,
      ring: alone.ring,
      busy: alone.busy,
      near,
    });
    done += 1;
    if (done % 10 === 0) log(`  audited ${done} placements`);
  }
  return out;
}

/**
 * The room as the game shows a layout (key per thing → placement key), from
 * shipped files: { png, raw } at room size, pieces in `states`.
 */
export async function composeLayout(room, readImage, atlasSrc, rects, layoutKeys, states = "rest") {
  const layers = await roomLayers(room, readImage, states);
  const { data: atlasRaw, info } = await sharp(await readImage(atlasSrc)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const placements = roomPlacements(room).filter((p) => layoutKeys.includes(p.key) && rects.has(p.key)).sort(paintOrder);
  const sprites = placements.map((p) => {
    const r = rects.get(p.key);
    return spriteFromAtlas(atlasRaw, info.width, r, { x: r.x, y: r.y });
  });
  const raw = composeLayers(room, layers, sprites);
  return { raw, png: await sharp(raw, { raw: { width: room.width, height: room.height, channels: 4 } }).png().toBuffer() };
}
