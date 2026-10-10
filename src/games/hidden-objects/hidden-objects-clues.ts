import type { DifficultyLevel } from "@/types/game";
import {
  DIFFICULTY_PRESETS,
  type ClueLevel,
  type ClueVariant,
  type HiddenObjectDefinition,
  type SceneDefinition,
  type TargetId,
} from "@/games/hidden-objects/hidden-objects-scene";

/**
 * Game 03 — which of an object's clues a round tells (GAME03-CALIBRATION-02A).
 *
 * Every object carries a clue bank (several authored variants per level). A
 * round picks, for each object it lists, one variant of the level its list
 * reads and one of the level its "reclue" hint re-tells it at — a pure function
 * of (room, difficulty, round seed, object): the same three always tell the
 * same object the same way, whatever else happens in the session, and the pick
 * for one object never depends on which other objects the round lists or in
 * what order. A new exploration (a new seed) may tell it another way. Nothing
 * here reads a clock or Math.random: the seed is the round's, drawn once when
 * "Explorar" is pressed.
 */

/** Which variants a round tells for one object: indices into its clue bank (null where the difficulty tells none). */
export interface ClueChoice {
  list: number | null;
  reclue: number | null;
}

export type RoundClues = Readonly<Record<TargetId, ClueChoice>>;

/** The indices of an object's variants at `level`, in bank order. */
export function variantsAt(target: HiddenObjectDefinition, level: ClueLevel): number[] {
  return target.clues.flatMap((clue, index) => (clue.level === level ? [index] : []));
}

/** FNV-1a over a string: a stable 32-bit name for an object and a purpose. */
function hashText(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

/** A well-mixed 32-bit draw in [0, 1) from the round seed and a name (the murmur3 finalizer). */
function drawFor(seed: number, name: string): number {
  let z = (seed ^ hashText(name)) >>> 0;
  z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
  z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
  return ((z ^ (z >>> 16)) >>> 0) / 4294967296;
}

function pick(target: HiddenObjectDefinition, level: ClueLevel | null, seed: number, purpose: string): number | null {
  if (!level) return null;
  const options = variantsAt(target, level);
  if (options.length === 0) throw new Error(`${target.id} has no ${level} clue`);
  return options[Math.floor(drawFor(seed, `${target.id}:${purpose}:${level}`) * options.length)];
}

/** The clues a round of (room, difficulty, seed) tells for each of its objects. */
export function selectRoundClues(
  scene: Pick<SceneDefinition, "pool">,
  difficulty: DifficultyLevel,
  seed: number,
  targets: readonly TargetId[],
): RoundClues {
  const preset = DIFFICULTY_PRESETS[difficulty];
  const choices: Record<TargetId, ClueChoice> = {};
  for (const id of targets) {
    const target = scene.pool.find((candidate) => candidate.id === id);
    if (!target) throw new Error(`Unknown target ${id}`);
    choices[id] = { list: pick(target, preset.listClue, seed >>> 0, "list"), reclue: pick(target, preset.reclue, seed >>> 0, "reclue") };
  }
  return choices;
}

/** The variant a choice points at, or null. */
export function clueAt(target: HiddenObjectDefinition, index: number | null): ClueVariant | null {
  return index === null ? null : (target.clues[index] ?? null);
}
