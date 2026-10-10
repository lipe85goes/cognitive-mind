import type { DifficultyLevel } from "@/types/game";
import {
  DIFFICULTY_PRESETS,
  type ClueLevel,
  type HiddenObjectDefinition,
  type RoundRule,
  type SceneDefinition,
  type SceneRegion,
  type TargetId,
  type TargetTier,
} from "@/games/hidden-objects/hidden-objects-scene";

/**
 * Game 03 — how hard a round is to search (GAME03-CALIBRATION-02A).
 *
 * A coarse, measured ruler, not a model of anyone's eyes: it exists so that no
 * draw can hand Difícil a round of obvious objects or Fácil a round solved at a
 * glance. Each object gets a search load in [0, 1] from six things the room
 * says about it — five measured on the shipped art or its geometry, one
 * authored:
 *
 *   tier    — the author's findability class (A in plain sight · B partly
 *             covered · C tucked into its surroundings), weighted twice: it is
 *             the only part that knows whether the identifying part is exposed;
 *   cover   — how much of it the room hides (audit `visible`), up to the C
 *             floor of fair occlusion;
 *   blend   — how little its outline stands out from what is behind it (audit
 *             `edge`), down to the fairness floor;
 *   decoys  — painted look-alikes that compete with it;
 *   clutter — how busy the room around it is (audit `clutter`);
 *   size    — how small it is on the room's plate.
 *
 * The weights are a prior (tier 2, every other part 1), not a fit: there is no
 * timing data from people yet. The anchors of each part come from the art kits
 * Difficulty V2 was playtested on (see SEARCH_RULER), so the ruler does not move
 * when the art does. A round's profile is the mean load of its objects plus the
 * counts the round rules read; the round's size never raises it.
 */

/** Where each measured part of the load starts (0) and saturates (1). */
export const SEARCH_RULER = {
  tier: { A: 0, B: 0.5, C: 1 } as Readonly<Record<TargetTier, number>>,
  /** Share of the object the plate shows: all of it → 0; the C floor of fair occlusion (Discovery §9) → 1. */
  visible: { open: 1, hidden: 0.4 },
  /** Edge ratio: the 90th percentile of the V2 kits → 0 (it pops); the fairness floor → 1 (it blends). */
  edge: { pops: 2.96, blends: 1.3 },
  /** Busy share of the ring around it: the V2 kits' 10th percentile → 0; their 90th → 1. */
  clutter: { calm: 0.096, busy: 0.196 },
  /** √area of its region (su): the V2 kits' 90th percentile → 0; their 10th → 1. */
  side: { large: 188, small: 80 },
  /** Look-alikes that saturate the part: as many as a B object may have. */
  decoys: 2,
  weights: { tier: 2, cover: 1, blend: 1, decoys: 1, clutter: 1, size: 1 },
} as const;

/**
 * Under this load an object is found at a static glance: halfway between the
 * mean load of the V2 kits' A objects and that of their B objects.
 */
export const POP_OUT_BELOW = 0.325;

export interface SearchParts {
  tier: number;
  cover: number;
  blend: number;
  decoys: number;
  clutter: number;
  size: number;
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function regionSide(region: SceneRegion): number {
  return region.kind === "rect" ? Math.sqrt(region.w * region.h) : 2 * region.r;
}

/** Look-alikes the room paints for this object. */
export function decoysOf(scene: Pick<SceneDefinition, "lookAlikes">, id: TargetId): number {
  return scene.lookAlikes.filter((lookAlike) => lookAlike.resembles === id).length;
}

/** The six parts of an object's search load, each in [0, 1]. */
export function searchParts(scene: Pick<SceneDefinition, "lookAlikes">, target: HiddenObjectDefinition): SearchParts {
  const r = SEARCH_RULER;
  const { visible, edge, clutter } = target.measured;
  return {
    tier: r.tier[target.tier],
    cover: clamp01((r.visible.open - visible) / (r.visible.open - r.visible.hidden)),
    blend: clamp01((r.edge.pops - edge) / (r.edge.pops - r.edge.blends)),
    decoys: clamp01(decoysOf(scene, target.id) / r.decoys),
    clutter: clamp01((clutter - r.clutter.calm) / (r.clutter.busy - r.clutter.calm)),
    size: clamp01((r.side.large - regionSide(target.region)) / (r.side.large - r.side.small)),
  };
}

/** An object's search load in [0, 1]: the weighted mean of its parts. */
export function searchLoad(scene: Pick<SceneDefinition, "lookAlikes">, target: HiddenObjectDefinition): number {
  const parts = searchParts(scene, target);
  const w = SEARCH_RULER.weights;
  const total = w.tier + w.cover + w.blend + w.decoys + w.clutter + w.size;
  return (
    (w.tier * parts.tier + w.cover * parts.cover + w.blend * parts.blend + w.decoys * parts.decoys + w.clutter * parts.clutter + w.size * parts.size) /
    total
  );
}

/** How many associations a clue level asks for before the Explorador knows what to look for (a picture: none). */
export const CLUE_STEPS: Readonly<Record<ClueLevel, number>> = { direct: 1, associative: 2, indirect: 3 };

/** The three heights a room is read at: a round that asks for all of them makes the Explorador look up and down too. */
export const HEIGHT_BANDS: readonly number[] = [600, 1000];

export interface RoundProfile {
  count: number;
  /** Mean search load of the listed objects. */
  search: number;
  /** Objects found at a static glance (load under POP_OUT_BELOW). */
  popOuts: number;
  tiers: Record<TargetTier, number>;
  /** Painted look-alikes per listed object. */
  decoys: number;
  /** Distinct (station × height band) places the list sends the Explorador to. */
  places: number;
  /** Associations the list asks for per object before searching (0 for a picture list). */
  semantic: number;
}

const byIdIndex = new WeakMap<SceneDefinition, Map<TargetId, HiddenObjectDefinition>>();
const loadIndex = new WeakMap<SceneDefinition, Map<TargetId, number>>();

function targetOf(scene: SceneDefinition, id: TargetId): HiddenObjectDefinition {
  let index = byIdIndex.get(scene);
  if (!index) byIdIndex.set(scene, (index = new Map(scene.pool.map((target) => [target.id, target]))));
  const target = index.get(id);
  if (!target) throw new Error(`Unknown target ${id} in ${scene.id}`);
  return target;
}

/** An object's load in this room (computed once per room: the data is constant). */
export function loadOf(scene: SceneDefinition, id: TargetId): number {
  let index = loadIndex.get(scene);
  if (!index) loadIndex.set(scene, (index = new Map(scene.pool.map((target) => [target.id, searchLoad(scene, target)]))));
  const load = index.get(id);
  if (load === undefined) throw new Error(`Unknown target ${id} in ${scene.id}`);
  return load;
}

function heightBand(region: SceneRegion): number {
  const y = region.kind === "rect" ? region.y + region.h / 2 : region.cy;
  return HEIGHT_BANDS.filter((edge) => y >= edge).length;
}

/** What a round asks of the Explorador, as the round rules and the calibration report read it. */
export function roundProfile(scene: SceneDefinition, difficulty: DifficultyLevel, ids: readonly TargetId[]): RoundProfile {
  const targets = ids.map((id) => targetOf(scene, id));
  const loads = ids.map((id) => loadOf(scene, id));
  const tiers: Record<TargetTier, number> = { A: 0, B: 0, C: 0 };
  for (const target of targets) tiers[target.tier] += 1;
  const level = DIFFICULTY_PRESETS[difficulty].listClue;
  return {
    count: ids.length,
    search: loads.reduce((sum, load) => sum + load, 0) / Math.max(1, ids.length),
    popOuts: loads.filter((load) => load < POP_OUT_BELOW).length,
    tiers,
    decoys: ids.reduce((sum, id) => sum + decoysOf(scene, id), 0) / Math.max(1, ids.length),
    places: new Set(targets.map((target) => `${target.station}:${heightBand(target.region)}`)).size,
    semantic: level ? CLUE_STEPS[level] : 0,
  };
}

/** Whether a round's profile meets a difficulty's rule. Nothing in it grows with the number of objects. */
export function meetsRule(rule: RoundRule, profile: RoundProfile): boolean {
  const tiersFit = (Object.keys(rule.tiers) as TargetTier[]).every(
    (tier) => profile.tiers[tier] >= rule.tiers[tier][0] && profile.tiers[tier] <= rule.tiers[tier][1],
  );
  return (
    tiersFit &&
    profile.popOuts <= rule.maxPopOuts &&
    profile.search >= rule.minSearch &&
    profile.search < rule.maxSearch &&
    profile.decoys >= rule.minDecoys
  );
}
