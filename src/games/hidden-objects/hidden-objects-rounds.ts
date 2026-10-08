import type { DifficultyLevel } from "@/types/game";
import {
  DIFFICULTY_PRESETS,
  HIDDEN_OBJECTS,
  SCENE_STATIONS,
  type DifficultyPreset,
  type HiddenObjectDefinition,
  type StationId,
  type TargetId,
  type TargetTier,
} from "@/games/hidden-objects/hidden-objects-scene";

/**
 * Estúdio das Descobertas — which objects a round asks for (GAME03-EXPERIENCE-02).
 *
 * The room is authored: every object of the pool is painted where the scene
 * says, in every round. A round only chooses which of them the list names, and
 * that choice is a pure function of (difficulty, seed): the same pair always
 * gives the same list, in the same order. Nothing here reads a clock or
 * Math.random — the seed comes from the game, once, when "Explorar" is pressed.
 *
 * A round is valid when it
 *   - holds exactly the difficulty's mix of tiers (DIFFICULTY_PRESETS[d].tiers);
 *   - lists each object once, and only objects its list style can show;
 *   - spreads over the stations as evenly as its size allows (each holds
 *     ⌊count/3⌋ or ⌈count/3⌉ of them), so every round crosses the whole room.
 * Every valid round is equally likely, and the order the list shows is drawn
 * too, so the first line never says where to start.
 */

/** What rounds are drawn from: a scene's stations, its pool and its difficulties (one scene exists today). */
export interface RoundSource {
  stations: readonly { id: StationId }[];
  pool: readonly HiddenObjectDefinition[];
  presets: Readonly<Record<DifficultyLevel, DifficultyPreset>>;
}

export const EXPLORER_STUDIO_ROUNDS: RoundSource = {
  stations: SCENE_STATIONS,
  pool: HIDDEN_OBJECTS,
  presets: DIFFICULTY_PRESETS,
};

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

/** The rounds depend only on constant data: enumerated once per source and difficulty. */
const enumerated = new WeakMap<RoundSource, Map<DifficultyLevel, readonly (readonly TargetId[])[]>>();

/** Every valid round of a difficulty, each as its ids in pool order. */
export function validRounds(
  difficulty: DifficultyLevel,
  source: RoundSource = EXPLORER_STUDIO_ROUNDS,
): readonly (readonly TargetId[])[] {
  let bySource = enumerated.get(source);
  if (!bySource) enumerated.set(source, (bySource = new Map()));
  let rounds = bySource.get(difficulty);
  if (!rounds) bySource.set(difficulty, (rounds = enumerateRounds(difficulty, source)));
  return rounds;
}

function enumerateRounds(difficulty: DifficultyLevel, source: RoundSource): TargetId[][] {
  const preset = source.presets[difficulty];
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

/** The round for (difficulty, seed): one valid round, every one equally likely, in a drawn order. */
export function selectRoundTargets(
  difficulty: DifficultyLevel,
  seed: number,
  source: RoundSource = EXPLORER_STUDIO_ROUNDS,
): TargetId[] {
  const rounds = validRounds(difficulty, source);
  if (rounds.length === 0) throw new Error(`No valid round for ${difficulty}`);
  const random = seededRandom(seed);
  const list = [...rounds[Math.floor(random() * rounds.length)]];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}
