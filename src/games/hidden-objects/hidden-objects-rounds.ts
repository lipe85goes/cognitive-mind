import type { DifficultyLevel } from "@/types/game";
import { meetsRule, roundProfile } from "@/games/hidden-objects/hidden-objects-difficulty";
import { composeLayout, derivedSeed, homeLayout, placedScene, type RoomLayout } from "@/games/hidden-objects/hidden-objects-layout";
import {
  DIFFICULTY_PRESETS,
  type DifficultyPreset,
  type HiddenObjectDefinition,
  type SceneDefinition,
  type TargetId,
} from "@/games/hidden-objects/hidden-objects-scene";

/**
 * Game 03 — which objects a round asks for (GAME03-EXPERIENCE-02, made
 * per-room by GAME03-MULTISCENE-03, measured by GAME03-CALIBRATION-02A).
 *
 * A room is authored: every object of its pool is painted where the scene
 * says, in every round. A round only chooses which of them the list names, and
 * that choice is a pure function of (room, difficulty, seed): the same three
 * always give the same list, in the same order — and a seed means nothing
 * outside its room, since each room draws from its own pool and stations.
 * Nothing here reads a clock or Math.random — the seed comes from the game,
 * once, when "Explorar" is pressed.
 *
 * A round is valid when it
 *   - lists the difficulty's number of objects, each once, and only objects its
 *     list style can show (a clue list: objects with a clue of its levels);
 *   - spreads over the room's stations as evenly as its size allows (each holds
 *     ⌊count/stations⌋ or ⌈count/stations⌉ of them), so every round crosses the
 *     whole room;
 *   - meets the difficulty's round rule (DIFFICULTY_PRESETS[d].round): the tiers
 *     it may hold, at most so many objects found at a glance, and the floors of
 *     its measured search load and look-alike pressure
 *     (hidden-objects-difficulty.ts).
 * Every valid round is equally likely, and the order the list shows is drawn
 * too, so the first line never says where to start.
 */

/** What rounds are drawn from: a room (its stations, its pool, its look-alikes); the difficulty contract is global. */
export type RoundSource = SceneDefinition;

/** Every k-element subset of `items`, each in the items' order. */
function combinations<T>(items: readonly T[], k: number): T[][] {
  if (k === 0) return [[]];
  return items.flatMap((item, index) => combinations(items.slice(index + 1), k - 1).map((rest) => [item, ...rest]));
}

/** The fewest and the most objects one station may hold in a round of `count`. */
export function stationSpread(count: number, stations: number): { min: number; max: number } {
  return { min: Math.floor(count / stations), max: Math.ceil(count / stations) };
}

/**
 * Whether the difficulty's list can present this object: its list style may
 * show it, and a clue list has a clue of each level it tells (the list's, and
 * a reclue's) in the object's bank.
 */
export function listableIn(target: HiddenObjectDefinition, preset: DifficultyPreset): boolean {
  if (target.listedAs && !target.listedAs.includes(preset.listStyle)) return false;
  const tells = [preset.listClue, preset.reclue].filter((level) => level !== null);
  return tells.every((level) => target.clues.some((clue) => clue.level === level));
}

/** Every round the structural rules allow (count, list style, station spread), before the round rule reads it. */
export function candidateRounds(source: RoundSource, difficulty: DifficultyLevel): TargetId[][] {
  const preset = DIFFICULTY_PRESETS[difficulty];
  const eligible = source.pool.filter((target) => listableIn(target, preset) && preset.round.tiers[target.tier][1] > 0);
  const spread = stationSpread(preset.count, source.stations.length);
  const perStation = source.stations.map((station) => {
    const here = eligible.filter((target) => target.station === station.id);
    const subsets: HiddenObjectDefinition[][] = [];
    for (let k = spread.min; k <= spread.max; k += 1) subsets.push(...combinations(here, k));
    return subsets;
  });
  let rounds: HiddenObjectDefinition[][] = [[]];
  for (const [index, subsets] of perStation.entries()) {
    // what the stations still to come can add, at most
    const roomLeft = (source.stations.length - index - 1) * spread.max;
    rounds = rounds.flatMap((round) =>
      subsets.filter((subset) => round.length + subset.length <= preset.count && round.length + subset.length + roomLeft >= preset.count).map((subset) => [...round, ...subset]),
    );
  }
  const order = new Map(source.pool.map((target, index) => [target.id, index]));
  return rounds
    .filter((round) => round.length === preset.count)
    .map((round) => round.map((target) => target.id).sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)));
}

/** The rounds depend only on constant data: enumerated once per room and difficulty. */
const enumerated = new WeakMap<RoundSource, Map<DifficultyLevel, readonly (readonly TargetId[])[]>>();

/** Every valid round of a difficulty in this room, each as its ids in pool order. */
export function validRounds(scene: RoundSource, difficulty: DifficultyLevel): readonly (readonly TargetId[])[] {
  let byScene = enumerated.get(scene);
  if (!byScene) enumerated.set(scene, (byScene = new Map()));
  let rounds = byScene.get(difficulty);
  if (!rounds) {
    const rule = DIFFICULTY_PRESETS[difficulty].round;
    rounds = candidateRounds(scene, difficulty).filter((round) => meetsRule(rule, roundProfile(scene, difficulty, round)));
    byScene.set(difficulty, rounds);
  }
  return rounds;
}

/** A small, well-mixed 32-bit generator (mulberry32): the same seed always gives the same draws. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** In place: a seeded Fisher–Yates, so the first line of the list never says where to start. */
function shuffled<T>(list: T[], random: () => number): T[] {
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

// --- a round and its room together (GAME03-REPLAYABILITY-05) ------------------------------------------

/**
 * A round is its list AND the layout of the room it is played in: what a
 * round asks depends on where each object sits (its tier there, how much of it
 * shows, what is around it), so the two are drawn together from the seed:
 *   1. the seed composes a layout (hidden-objects-layout.ts) — the same for
 *      every difficulty, and knowing nothing of what will be asked;
 *   2. in that room, a list is drawn among the rounds the difficulty's rule
 *      accepts, every one equally likely: candidates (the structural rules:
 *      count, list style, station spread, tiers the difficulty may hold) are
 *      drawn uniformly and the first one the rule accepts is the round —
 *      uniform over the accepted ones, at most ROUND_DRAWS draws;
 *   3. a layout in which no draw is accepted gives way to the next layout of
 *      the same seed, at most LAYOUT_ATTEMPTS of them; after the last, the
 *      room's home layout, whose rounds are enumerated (the suites hold that
 *      every difficulty has rounds there).
 * Every step reads only the seed: the same room, difficulty and seed give the
 * same layout, the same list and the same order, every time.
 */
export const LAYOUT_ATTEMPTS = 6;
export const ROUND_DRAWS = 4000;

export interface RoundDraw {
  targets: TargetId[];
  layout: RoomLayout;
  /** Which of the seed's layouts it is (0 = the first); LAYOUT_ATTEMPTS for the home layout. */
  attempt: number;
  /** Candidates drawn in the accepted layout before one was accepted (enumerated home: 0). */
  draws: number;
  /** True when every attempt failed and the home layout was used. */
  fallback: boolean;
}

/** The binomial coefficient (small numbers only). */
function choose(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let value = 1;
  for (let i = 1; i <= k; i += 1) value = (value * (n - k + i)) / i;
  return Math.round(value);
}

/** k distinct items of `items`, uniformly (a partial Fisher–Yates on a copy). */
function sample<T>(items: readonly T[], k: number, random: () => number): T[] {
  const pool = [...items];
  for (let i = 0; i < k; i += 1) {
    const j = i + Math.floor(random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, k);
}

/** What a room's candidates are drawn from: per station, the objects a difficulty may list; the station sizes a round may take, with their weights. */
interface CandidateSpace {
  perStation: HiddenObjectDefinition[][];
  patterns: { sizes: number[]; weight: number }[];
  total: number;
  order: Map<TargetId, number>;
}

const spaces = new WeakMap<RoundSource, Map<DifficultyLevel, CandidateSpace>>();

function candidateSpace(scene: RoundSource, difficulty: DifficultyLevel): CandidateSpace {
  let byScene = spaces.get(scene);
  if (!byScene) spaces.set(scene, (byScene = new Map()));
  let space = byScene.get(difficulty);
  if (space) return space;
  const preset = DIFFICULTY_PRESETS[difficulty];
  const eligible = scene.pool.filter((target) => listableIn(target, preset) && preset.round.tiers[target.tier][1] > 0);
  const perStation = scene.stations.map((station) => eligible.filter((target) => target.station === station.id));
  const spread = stationSpread(preset.count, scene.stations.length);
  const patterns: { sizes: number[]; weight: number }[] = [];
  const grow = (sizes: number[]) => {
    if (sizes.length === perStation.length) {
      if (sizes.reduce((sum, k) => sum + k, 0) !== preset.count) return;
      const weight = sizes.reduce((product, k, s) => product * choose(perStation[s].length, k), 1);
      if (weight > 0) patterns.push({ sizes, weight });
      return;
    }
    for (let k = spread.min; k <= spread.max; k += 1) grow([...sizes, k]);
  };
  grow([]);
  space = { perStation, patterns, total: patterns.reduce((sum, p) => sum + p.weight, 0), order: new Map(scene.pool.map((target, index) => [target.id, index])) };
  byScene.set(difficulty, space);
  return space;
}

/** One candidate round of a room, uniformly among every candidate the structural rules allow (in pool order); null when there is none. */
export function drawCandidate(scene: RoundSource, difficulty: DifficultyLevel, random: () => number): TargetId[] | null {
  const space = candidateSpace(scene, difficulty);
  if (space.total === 0) return null;
  let pick = random() * space.total;
  let pattern = space.patterns[space.patterns.length - 1];
  for (const candidate of space.patterns) {
    if (pick < candidate.weight) {
      pattern = candidate;
      break;
    }
    pick -= candidate.weight;
  }
  const ids = pattern.sizes.flatMap((k, s) => sample(space.perStation[s], k, random).map((target) => target.id));
  return ids.sort((a, b) => (space.order.get(a) ?? 0) - (space.order.get(b) ?? 0));
}

/** The first of at most `limit` uniform candidates the difficulty's rule accepts (uniform over the accepted rounds), with the draws it took. */
export function drawValidRound(scene: RoundSource, difficulty: DifficultyLevel, random: () => number, limit = ROUND_DRAWS): { ids: TargetId[]; draws: number } | null {
  const rule = DIFFICULTY_PRESETS[difficulty].round;
  for (let draws = 1; draws <= limit; draws += 1) {
    const ids = drawCandidate(scene, difficulty, random);
    if (!ids) return null;
    if (meetsRule(rule, roundProfile(scene, difficulty, ids))) return { ids, draws };
  }
  return null;
}

/** The round of (room, difficulty, seed): its layout and its list, in a drawn order (see above). */
export function selectRound(scene: RoundSource, difficulty: DifficultyLevel, seed: number): RoundDraw {
  for (let attempt = 0; attempt < LAYOUT_ATTEMPTS; attempt += 1) {
    const { layout } = composeLayout(scene, derivedSeed(seed, `layout:${attempt}`));
    const random = seededRandom(derivedSeed(seed, `round:${attempt}`));
    const found = drawValidRound(placedScene(scene, layout), difficulty, random);
    if (found) return { targets: shuffled(found.ids, random), layout, attempt, draws: found.draws, fallback: false };
  }
  const layout = homeLayout(scene);
  const rounds = validRounds(placedScene(scene, layout), difficulty);
  if (rounds.length === 0) throw new Error(`No valid round for ${difficulty}`);
  const random = seededRandom(derivedSeed(seed, "round:home"));
  return { targets: shuffled([...rounds[Math.floor(random() * rounds.length)]], random), layout, attempt: LAYOUT_ATTEMPTS, draws: 0, fallback: true };
}

/** The round's list for (room, difficulty, seed) — its layout is selectRound's. */
export function selectRoundTargets(scene: RoundSource, difficulty: DifficultyLevel, seed: number): TargetId[] {
  return selectRound(scene, difficulty, seed).targets;
}

/**
 * GAME03-REPLAYABILITY-05 — the seed of a new exploration, drawn at the moment
 * it starts ("Explorar"), with one memory of this visit: the layout the room
 * was last explored in. While a drawn seed would put the room back exactly as
 * it was, another is drawn — at most REPEAT_DRAWS seeds, then the last one is
 * kept. The seed that is kept is the whole of the round: nothing of this
 * memory reaches the layout it composes.
 */
export const REPEAT_DRAWS = 8;

export function explorationSeed(
  scene: RoundSource,
  difficulty: DifficultyLevel,
  previousSignature: string | null,
  drawSeed: () => number,
): { seed: number; signature: string; draws: number } {
  let seed = drawSeed() >>> 0;
  let signature = selectRound(scene, difficulty, seed).layout.signature;
  let draws = 1;
  while (previousSignature !== null && signature === previousSignature && draws < REPEAT_DRAWS) {
    seed = drawSeed() >>> 0;
    signature = selectRound(scene, difficulty, seed).layout.signature;
    draws += 1;
  }
  return { seed, signature, draws };
}
