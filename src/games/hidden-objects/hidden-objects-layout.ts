import type { Rect } from "@/games/hidden-objects/hidden-objects-camera";
import type {
  HiddenObjectDefinition,
  Placement,
  PlacementSprite,
  SceneDefinition,
  SceneLookAlike,
  SceneRegion,
  SceneSlot,
  SlotId,
  TargetMeasure,
} from "@/games/hidden-objects/hidden-objects-scene";
import { LOOKALIKE_CLEARANCE_SU } from "@/games/hidden-objects/hidden-objects-scene";

/**
 * Game 03 — where the room's movable things sit in one exploration
 * (GAME03-REPLAYABILITY-05).
 *
 * The room is authored; what moves inside it is authored too. Every pool
 * object, look-alike and prop (a pot, a jar, a box) carries the slots it may
 * sit on (`placements`, the first one its home), and a slot is a known-good
 * place in the room — a point on a shelf, a sill, a table, a hook, the inside
 * of a drawer (`SceneSlot`). A layout picks one placement for every thing:
 * a pure function of (room, seed), never of a clock, Math.random, the camera,
 * the hints or anything that happens during the exploration.
 *
 * How a layout is composed (composeLayout), for every room alike:
 *   1. the seed orders the things that move, and each thing's placements;
 *   2. in that order, each thing takes the first placement that does not
 *      clash with what is already placed (a depth-first search that backs up
 *      when a thing has nowhere left to go);
 *   3. the search is bounded (LAYOUT_STEPS); if it ever ran out, the room's
 *      home layout — every thing on its first placement, the room as it was
 *      painted before — is used instead.
 * Two placements clash when they are the same slot, or their boxes come
 * closer than the room's rules allow: any two things never touch
 * (OCCUPANCY_GAP_SU), and a look-alike keeps LOOKALIKE_CLEARANCE_SU from every
 * pool object, as the contract has always asked.
 *
 * A layout's `signature` is its placements, one character per thing that can
 * move: what tests, reports and the "no immediate repeat" rule compare.
 *
 * `placedScene` turns (room, layout) into the room as this exploration plays
 * it: the same SceneDefinition with every object and look-alike where its
 * placement puts it, its tier there, the hint words of its slot and what the
 * art kit's audit measured for it there — so hit testing, hints and the round
 * model (hidden-objects-difficulty.ts) read the actual placement, unchanged.
 *
 * Nothing here names a room, a slot or a thing.
 */

/** What a movable thing is to the round: a pool object, a look-alike, or a prop no round ever asks for. */
export type ThingRole = "target" | "lookalike" | "prop";

export interface LayoutThing {
  id: string;
  role: ThingRole;
  /** Its box at home (its first placement), in su. */
  home: Rect;
  placements: readonly Placement[];
  /** Pool objects and look-alikes: the shape at home (a prop's is its box). */
  region: SceneRegion;
  /** Pool objects: the room piece it is kept behind. */
  gate?: string;
}

/** Things never come closer than this (su), box to box, unless one stands clearly in front of the other. */
export const OCCUPANCY_GAP_SU = 4;
/** How far apart (su) the bottoms of two boxes must be for one thing to stand in front of the other. */
export const LAYER_DEPTH_SU = 40;
/** The most placement tries one composition's search may take before it settles for the home layout. */
export const LAYOUT_STEPS = 20000;


/** A thing on one of its slots: "thing@slot". */
export const placementKey = (thing: string, slot: SlotId) => `${thing}@${slot}`;

const regionBox = (region: SceneRegion): Rect =>
  region.kind === "rect"
    ? { x: region.x, y: region.y, w: region.w, h: region.h }
    : { x: region.cx - region.r, y: region.cy - region.r, w: 2 * region.r, h: 2 * region.r };

const rectRegion = (box: Rect): SceneRegion => ({ kind: "rect", ...box });

/** Every thing of the room that has placements, in a fixed order: pool, look-alikes, props (each in data order). */
export function layoutThings(scene: SceneDefinition): readonly LayoutThing[] {
  let things = thingsIndex.get(scene);
  if (things) return things;
  things = [
    ...scene.pool.flatMap((target): LayoutThing[] =>
      target.placements?.length
        ? [{ id: target.id, role: "target", home: regionBox(target.region), placements: target.placements, region: target.region, gate: target.gate }]
        : [],
    ),
    ...scene.lookAlikes.flatMap((lookAlike): LayoutThing[] =>
      lookAlike.placements?.length
        ? [{ id: lookAlike.id, role: "lookalike", home: regionBox(lookAlike.region), placements: lookAlike.placements, region: lookAlike.region }]
        : [],
    ),
    ...(scene.props ?? []).map((prop): LayoutThing => ({ id: prop.id, role: "prop", home: prop.box, placements: prop.placements, region: rectRegion(prop.box) })),
  ];
  thingsIndex.set(scene, things);
  return things;
}
const thingsIndex = new WeakMap<SceneDefinition, readonly LayoutThing[]>();

const slotIndex = new WeakMap<SceneDefinition, Map<SlotId, SceneSlot>>();

export function slotById(scene: SceneDefinition, id: SlotId): SceneSlot {
  let index = slotIndex.get(scene);
  if (!index) slotIndex.set(scene, (index = new Map((scene.slots ?? []).map((slot) => [slot.id, slot]))));
  const slot = index.get(id);
  if (!slot) throw new Error(`Unknown slot ${id} in ${scene.id}`);
  return slot;
}

/** A box of `size` put on `slot`: the point `align` names meets the slot's anchor. */
export function boxOnSlot(size: { w: number; h: number }, slot: SceneSlot): Rect {
  const x = slot.at.x - size.w / 2;
  const y = slot.align === "bottom" ? slot.at.y - size.h : slot.align === "top" ? slot.at.y : slot.at.y - size.h / 2;
  return { x, y, w: size.w, h: size.h };
}

/** A thing's box on one of its placements. */
export function placedBox(scene: SceneDefinition, thing: LayoutThing, placement: Placement): Rect {
  return boxOnSlot(thing.home, slotById(scene, placement.slot));
}

/** A shape moved by (dx, dy). */
export function shiftRegion(region: SceneRegion, dx: number, dy: number): SceneRegion {
  return region.kind === "rect"
    ? { kind: "rect", x: region.x + dx, y: region.y + dy, w: region.w, h: region.h }
    : { kind: "circle", cx: region.cx + dx, cy: region.cy + dy, r: region.r };
}

/** A thing's shape on one of its placements (its home shape, moved with its box). */
export function placedRegion(scene: SceneDefinition, thing: LayoutThing, placement: Placement): SceneRegion {
  const box = placedBox(scene, thing, placement);
  return shiftRegion(thing.region, box.x - thing.home.x, box.y - thing.home.y);
}

/** The gap between two shapes (su): 0 when they touch or overlap. */
export function regionGap(a: SceneRegion, b: SceneRegion): number {
  if (a.kind === "circle" && b.kind === "circle") return Math.max(0, Math.hypot(a.cx - b.cx, a.cy - b.cy) - a.r - b.r);
  if (a.kind === "circle" || b.kind === "circle") {
    const circle = (a.kind === "circle" ? a : b) as Extract<SceneRegion, { kind: "circle" }>;
    const rect = (a.kind === "rect" ? a : b) as Extract<SceneRegion, { kind: "rect" }>;
    const dx = Math.max(rect.x - circle.cx, 0, circle.cx - (rect.x + rect.w));
    const dy = Math.max(rect.y - circle.cy, 0, circle.cy - (rect.y + rect.h));
    return Math.max(0, Math.hypot(dx, dy) - circle.r);
  }
  const dx = Math.max(a.x - (b.x + b.w), 0, b.x - (a.x + a.w));
  const dy = Math.max(a.y - (b.y + b.h), 0, b.y - (a.y + a.h));
  return Math.hypot(dx, dy);
}

/**
 * Whether two things on two different slots may not be in the same layout:
 *   - a look-alike and a pool object closer than the contract's clearance
 *     (shape to shape, as it has always been measured);
 *   - any other two whose boxes come closer than the occupancy gap — unless
 *     one stands clearly in front of the other (the bottoms of their boxes at
 *     least LAYER_DEPTH_SU apart: a pot on the sill behind the hourglass on the
 *     side table) and the one behind is no pool object: nothing in the room
 *     ever stands in front of an object a round may ask for.
 */
export function tooClose(roleA: ThingRole, a: SceneRegion, roleB: ThingRole, b: SceneRegion): boolean {
  const decoyPair = (roleA === "target" && roleB === "lookalike") || (roleA === "lookalike" && roleB === "target");
  if (decoyPair) return regionGap(a, b) < LOOKALIKE_CLEARANCE_SU - 1e-9;
  const boxA = regionBox(a);
  const boxB = regionBox(b);
  if (regionGap(rectRegion(boxA), rectRegion(boxB)) >= OCCUPANCY_GAP_SU - 1e-9) return false;
  const depth = boxA.y + boxA.h - (boxB.y + boxB.h);
  if (Math.abs(depth) < LAYER_DEPTH_SU) return true;
  const behind = depth < 0 ? roleA : roleB;
  return behind === "target";
}

/** Every placement of the room, numbered, with the placements each one clashes with. */
interface ConflictTable {
  keys: string[];
  /** Placement number → [thing number, placement index]. */
  owner: [number, number][];
  /** Thing number → its placements' numbers. */
  numbers: number[][];
  clash: Uint8Array;
  count: number;
}

const conflictIndex = new WeakMap<SceneDefinition, ConflictTable>();

function conflictTable(scene: SceneDefinition): ConflictTable {
  const cached = conflictIndex.get(scene);
  if (cached) return cached;
  const things = layoutThings(scene);
  const keys: string[] = [];
  const owner: [number, number][] = [];
  const numbers: number[][] = [];
  const shapes: SceneRegion[] = [];
  const slots: SlotId[] = [];
  for (const [t, thing] of things.entries()) {
    numbers.push([]);
    for (const [p, placement] of thing.placements.entries()) {
      numbers[t].push(keys.length);
      keys.push(placementKey(thing.id, placement.slot));
      owner.push([t, p]);
      shapes.push(placedRegion(scene, thing, placement));
      slots.push(placement.slot);
    }
  }
  const count = keys.length;
  const clash = new Uint8Array(count * count);
  for (let i = 0; i < count; i += 1) {
    for (let j = i + 1; j < count; j += 1) {
      const [ti] = owner[i];
      const [tj] = owner[j];
      if (ti === tj) continue;
      if (slots[i] === slots[j] || tooClose(things[ti].role, shapes[i], things[tj].role, shapes[j])) clash[i * count + j] = clash[j * count + i] = 1;
    }
  }
  const table = { keys, owner, numbers, clash, count };
  conflictIndex.set(scene, table);
  return table;
}

/** Whether two placements ("thing@slot") may be in the same layout. */
export function placementsClash(scene: SceneDefinition, a: string, b: string): boolean {
  const table = conflictTable(scene);
  const i = table.keys.indexOf(a);
  const j = table.keys.indexOf(b);
  if (i < 0 || j < 0) throw new Error(`Unknown placement ${i < 0 ? a : b} in ${scene.id}`);
  return table.clash[i * table.count + j] === 1;
}

/** One exploration's room: each movable thing's placement (an index into its `placements`), and their signature. */
export interface RoomLayout {
  readonly picks: Readonly<Record<string, number>>;
  readonly signature: string;
}

/** A small, well-mixed 32-bit generator (mulberry32) — the same one the rounds use. */
function mulberry(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a over a string. */
function hashText(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** A seed of its own for one purpose of a round's seed (layout, round draw…), well mixed (the murmur3 finalizer). */
export function derivedSeed(seed: number, purpose: string): number {
  let z = ((seed >>> 0) ^ hashText(purpose)) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
  return (z ^ (z >>> 16)) >>> 0;
}

const DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

function layoutOf(things: readonly LayoutThing[], picks: readonly number[]): RoomLayout {
  const record: Record<string, number> = {};
  let signature = "";
  for (const [t, thing] of things.entries()) {
    record[thing.id] = picks[t];
    if (thing.placements.length > 1) signature += DIGITS[picks[t]] ?? "?";
  }
  return { picks: record, signature };
}

const homeIndex = new WeakMap<SceneDefinition, RoomLayout>();

/** Every thing on its first placement: the room as it was painted before layouts existed (the setup's room, and the composer's fallback). */
export function homeLayout(scene: SceneDefinition): RoomLayout {
  let layout = homeIndex.get(scene);
  if (!layout) {
    const things = layoutThings(scene);
    homeIndex.set(scene, (layout = layoutOf(things, things.map(() => 0))));
  }
  return layout;
}

/** A layout from its signature (one character per thing that can move), or null if it names no placement of this room. */
export function layoutFromSignature(scene: SceneDefinition, signature: string): RoomLayout | null {
  const things = layoutThings(scene);
  const picks: number[] = [];
  let at = 0;
  for (const thing of things) {
    if (thing.placements.length <= 1) {
      picks.push(0);
      continue;
    }
    const pick = DIGITS.indexOf(signature[at] ?? "");
    if (pick < 0 || pick >= thing.placements.length) return null;
    picks.push(pick);
    at += 1;
  }
  return at === signature.length ? layoutOf(things, picks) : null;
}

export interface LayoutComposition {
  layout: RoomLayout;
  /** Placement tries the search took. */
  steps: number;
  /** True when the search ran out and the home layout was used. */
  fallback: boolean;
}

/** In place: a seeded Fisher–Yates. */
function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * How a room's movable things depend on each other, worked out once per room:
 * each thing's placements that clash with nothing that never moves (its
 * domain), and the groups of things whose placements can clash with one
 * another (components) — a shelf, a sill, a table — which are composed
 * independently.
 */
interface LayoutPlan {
  /** Thing numbers that move, by component. */
  components: number[][];
  /** Thing number → how many placements of other things its placements clash with: the most constraining go first. */
  weight: number[];
  /** Thing number → the indices of its placements that are possible at all. */
  domains: number[][];
  /** The placement numbers of the things that never move. */
  fixed: number[];
}

const planIndex = new WeakMap<SceneDefinition, LayoutPlan>();

function layoutPlan(scene: SceneDefinition): LayoutPlan {
  const cached = planIndex.get(scene);
  if (cached) return cached;
  const things = layoutThings(scene);
  const table = conflictTable(scene);
  const fixed: number[] = [];
  const movable: number[] = [];
  for (const [t, thing] of things.entries()) {
    if (thing.placements.length > 1) movable.push(t);
    else fixed.push(table.numbers[t][0]);
  }
  const clashesFixed = (number: number) => fixed.some((other) => table.clash[number * table.count + other] === 1);
  const domains = things.map((thing, t) =>
    thing.placements.length > 1 ? [...thing.placements.keys()].filter((p) => !clashesFixed(table.numbers[t][p])) : [0],
  );
  const linked = (a: number, b: number) =>
    domains[a].some((p) => domains[b].some((q) => table.clash[table.numbers[a][p] * table.count + table.numbers[b][q]] === 1));
  const components: number[][] = [];
  const seen = new Set<number>();
  for (const start of movable) {
    if (seen.has(start)) continue;
    const component: number[] = [];
    const queue = [start];
    seen.add(start);
    while (queue.length) {
      const t = queue.shift() as number;
      component.push(t);
      for (const other of movable) if (!seen.has(other) && linked(t, other)) (seen.add(other), queue.push(other));
    }
    components.push(component.sort((a, b) => a - b));
  }
  const weight = things.map((_, t) => {
    let clashes = 0;
    for (const p of domains[t])
      for (const [other] of things.entries())
        if (other !== t) for (const q of domains[other]) clashes += table.clash[table.numbers[t][p] * table.count + table.numbers[other][q]];
    return clashes / Math.max(1, domains[t].length);
  });
  const plan = { components, weight, domains, fixed };
  planIndex.set(scene, plan);
  return plan;
}

/**
 * The layout of (room, seed). For each group of things that can clash (in
 * room order), the seed orders its things and each thing's placements; a
 * depth-first search gives each thing the first placement that clashes with
 * nothing placed so far and still leaves every thing after it somewhere to go
 * (forward checking), backing up when it cannot. The whole composition takes
 * at most LAYOUT_STEPS tries; past that, the home layout. Things with a
 * single placement are where it says from the start. Same room and seed, same
 * layout.
 *
 * The things that constrain the most go first (a large magnifier on a crowded
 * table leaves fewer places to the rest than a coin does), each choosing its
 * placement uniformly; the rest fit around them — so a thing's placements are
 * taken about equally often, not only the ones that block nothing. The seed
 * still orders things of equal weight, and every choice.
 */
export function composeLayout(scene: SceneDefinition, seed: number): LayoutComposition {
  const things = layoutThings(scene);
  const table = conflictTable(scene);
  const plan = layoutPlan(scene);
  const random = mulberry(seed);
  const picks = things.map(() => 0);
  const placed: number[] = [...plan.fixed];
  const clashesPlaced = (number: number) => {
    const row = number * table.count;
    for (const other of placed) if (table.clash[row + other] === 1) return true;
    return false;
  };
  let steps = 0;
  for (const component of plan.components) {
    const order = shuffle([...component], random);
    const preference = order.map((t) => shuffle([...plan.domains[t]], random));
    const base = placed.length;
    const next = order.map(() => 0);
    // after placing the thing at `depth`, every thing still to come must keep one free placement
    const leavesRoom = (depth: number) => {
      for (let later = depth + 1; later < order.length; later += 1) {
        const t = order[later];
        if (!plan.domains[t].some((p) => !clashesPlaced(table.numbers[t][p]))) return false;
      }
      return true;
    };
    let depth = 0;
    while (depth < order.length) {
      if (steps >= LAYOUT_STEPS) return { layout: homeLayout(scene), steps, fallback: true };
      const t = order[depth];
      let chosen = -1;
      while (next[depth] < preference[depth].length) {
        const p = preference[depth][next[depth]];
        next[depth] += 1;
        steps += 1;
        const number = table.numbers[t][p];
        if (clashesPlaced(number)) continue;
        placed.push(number);
        if (leavesRoom(depth)) {
          chosen = p;
          break;
        }
        placed.pop();
      }
      if (chosen >= 0) {
        picks[t] = chosen;
        depth += 1;
        continue;
      }
      // nowhere left for this thing: back up one, and let the one before try its next placement
      next[depth] = 0;
      depth -= 1;
      if (depth < 0) return { layout: homeLayout(scene), steps, fallback: true };
      placed.pop();
    }
    if (placed.length !== base + order.length) throw new Error("layout composition lost track of a placement");
  }
  return { layout: layoutOf(things, picks), steps, fallback: false };
}

/** The placement a layout gives a thing (its home when the layout does not name it). */
export function placementOf(thing: LayoutThing, layout: RoomLayout): Placement {
  return thing.placements[layout.picks[thing.id] ?? 0] ?? thing.placements[0];
}

/** Every placement key ("thing@slot") a layout uses. */
export function occupiedKeys(scene: SceneDefinition, layout: RoomLayout): ReadonlySet<string> {
  return new Set(layoutThings(scene).map((thing) => placementKey(thing.id, placementOf(thing, layout).slot)));
}

/** What the audit measured for a pool object on a slot, with the room around it as this layout fills it. */
export function measureIn(scene: SceneDefinition, key: string, occupied: ReadonlySet<string>): TargetMeasure | null {
  const measured = scene.placementArt?.[key]?.measured;
  if (!measured) return null;
  let busy = measured.busy;
  for (const [other, delta] of Object.entries(measured.near)) if (occupied.has(other)) busy += delta;
  return { visible: measured.visible, edge: measured.edge, clutter: Number((busy / Math.max(1, measured.ring)).toFixed(3)) };
}

const placedIndex = new WeakMap<RoomLayout, WeakMap<SceneDefinition, SceneDefinition>>();

/**
 * The room as one exploration plays it: every pool object and look-alike
 * where the layout puts it — its shape, its tier there, its slot's hint words
 * and the audit's measurements of it there (clutter with this layout's
 * neighbours). Everything else is the room itself. Built once per layout.
 */
export function placedScene(scene: SceneDefinition, layout: RoomLayout): SceneDefinition {
  let byScene = placedIndex.get(layout);
  if (!byScene) placedIndex.set(layout, (byScene = new WeakMap()));
  const cached = byScene.get(scene);
  if (cached) return cached;
  const things = new Map(layoutThings(scene).map((thing) => [thing.id, thing]));
  const occupied = occupiedKeys(scene, layout);
  const placeTarget = (target: HiddenObjectDefinition): HiddenObjectDefinition => {
    const thing = things.get(target.id);
    if (!thing) return target;
    const placement = placementOf(thing, layout);
    const slot = slotById(scene, placement.slot);
    const measured = measureIn(scene, placementKey(target.id, placement.slot), occupied);
    return {
      ...target,
      region: placedRegion(scene, thing, placement),
      tier: placement.tier ?? target.tier,
      measured: measured ?? target.measured,
      hintRegion: slot.hints?.region ?? target.hintRegion,
      hintDirection: slot.hints?.direction ?? target.hintDirection,
      hintContext: slot.hints?.context ?? target.hintContext,
    };
  };
  const placeLookAlike = (lookAlike: SceneLookAlike): SceneLookAlike => {
    const thing = things.get(lookAlike.id);
    return thing ? { ...lookAlike, region: placedRegion(scene, thing, placementOf(thing, layout)) } : lookAlike;
  };
  const placed: SceneDefinition = { ...scene, pool: scene.pool.map(placeTarget), lookAlikes: scene.lookAlikes.map(placeLookAlike) };
  byScene.set(scene, placed);
  return placed;
}

/** One picture the view paints for a layout: a thing on its slot. */
export interface LayoutSprite {
  key: string;
  thing: string;
  role: ThingRole;
  slot: SlotId;
  box: Rect;
  sprite: PlacementSprite;
}

/**
 * The pictures a layout paints, back to front: things lower in the room (the
 * bottom of their box nearer the floor) over things higher up — the order the
 * art kit composes them in for its audit.
 */
export function layoutSprites(scene: SceneDefinition, layout: RoomLayout): LayoutSprite[] {
  const sprites: LayoutSprite[] = [];
  for (const thing of layoutThings(scene)) {
    const placement = placementOf(thing, layout);
    const key = placementKey(thing.id, placement.slot);
    const sprite = scene.placementArt?.[key]?.sprite;
    // a thing painted into the plate (it never moves) has no picture of its own
    if (!sprite) continue;
    sprites.push({ key, thing: thing.id, role: thing.role, slot: placement.slot, box: placedBox(scene, thing, placement), sprite });
  }
  return sprites.sort((a, b) => a.box.y + a.box.h - (b.box.y + b.box.h) || a.box.x - b.box.x || (a.key < b.key ? -1 : 1));
}

/** How many of the room's movable things sit elsewhere in `b` than in `a`, and how many could. */
export function layoutDifference(scene: SceneDefinition, a: RoomLayout, b: RoomLayout): { moved: number; movable: number } {
  const movable = layoutThings(scene).filter((thing) => thing.placements.length > 1);
  return { moved: movable.filter((thing) => (a.picks[thing.id] ?? 0) !== (b.picks[thing.id] ?? 0)).length, movable: movable.length };
}
