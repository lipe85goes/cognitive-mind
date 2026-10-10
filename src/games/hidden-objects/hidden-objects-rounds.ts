import type { DifficultyLevel } from "@/types/game";
import {
  DIFFICULTY_PRESETS,
  type DifficultyPreset,
  type HiddenObjectDefinition,
  type SceneDefinition,
  type TargetId,
  type TargetTier,
} from "@/games/hidden-objects/hidden-objects-scene";

/**
 * Game 03 — which objects a round asks for (GAME03-EXPERIENCE-02, made
 * per-room by GAME03-MULTISCENE-03).
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
 *   - holds exactly the difficulty's mix of tiers (DIFFICULTY_PRESETS[d].tiers);
 *   - lists each object once, and only objects its list style can show;
 *   - spreads over the room's stations as evenly as its size allows (each holds
 *     ⌊count/stations⌋ or ⌈count/stations⌉ of them), so every round crosses the
 *     whole room.
 * Every valid round is equally likely, and the order the list shows is drawn
 * too, so the first line never says where to start.
 */

/** What rounds are drawn from: a room's stations and its pool (the difficulty contract is global). */
export type RoundSource = Pick<SceneDefinition, "stations" | "pool">;

const TIERS: readonly TargetTier[] = ["A", "B", "C"];

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

/** The rounds depend only on constant data: enumerated once per room and difficulty. */
const enumerated = new WeakMap<RoundSource, Map<DifficultyLevel, readonly (readonly TargetId[])[]>>();

/** Every valid round of a difficulty in this room, each as its ids in pool order. */
export function validRounds(scene: RoundSource, difficulty: DifficultyLevel): readonly (readonly TargetId[])[] {
  let byScene = enumerated.get(scene);
  if (!byScene) enumerated.set(scene, (byScene = new Map()));
  let rounds = byScene.get(difficulty);
  if (!rounds) byScene.set(difficulty, (rounds = enumerateRounds(scene, difficulty)));
  return rounds;
}

function enumerateRounds(source: RoundSource, difficulty: DifficultyLevel): TargetId[][] {
  const preset = DIFFICULTY_PRESETS[difficulty];
  const eligible = source.pool.filter((target) => listableIn(target, preset));
  const spread = stationSpread(preset.count, source.stations.length);
  let rounds: HiddenObjectDefinition[][] = [[]];
  for (const tier of TIERS) {
    const picks = combinations(eligible.filter((target) => target.tier === tier), preset.tiers[tier]);
    rounds = rounds.flatMap((round) => picks.map((pick) => [...round, ...pick]));
  }
  const order = new Map(source.pool.map((target, index) => [target.id, index]));
  return rounds
    .filter((round) =>
      source.stations.every((station) => {
        const held = round.filter((target) => target.station === station.id).length;
        return held >= spread.min && held <= spread.max;
      }),
    )
    .map((round) => round.map((target) => target.id).sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0)));
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
