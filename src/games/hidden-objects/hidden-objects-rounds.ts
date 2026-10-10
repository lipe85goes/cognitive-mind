import type { DifficultyLevel } from "@/types/game";
import { meetsRule, roundProfile } from "@/games/hidden-objects/hidden-objects-difficulty";
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
 *     list style can show;
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

/** Whether the difficulty's list style can present this object. */
export function listableIn(target: HiddenObjectDefinition, preset: DifficultyPreset): boolean {
  return !target.listedAs || target.listedAs.includes(preset.listStyle);
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

/** The round for (room, difficulty, seed): one valid round, every one equally likely, in a drawn order. */
export function selectRoundTargets(scene: RoundSource, difficulty: DifficultyLevel, seed: number): TargetId[] {
  const rounds = validRounds(scene, difficulty);
  if (rounds.length === 0) throw new Error(`No valid round for ${difficulty}`);
  const random = seededRandom(seed);
  const list = [...rounds[Math.floor(random() * rounds.length)]];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
