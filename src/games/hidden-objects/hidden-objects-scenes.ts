import type { SceneDefinition } from "@/games/hidden-objects/hidden-objects-scene";
import { EXPLORER_OBSERVATORY } from "@/games/hidden-objects/scenes/explorer-observatory";
import { EXPLORER_STUDIO } from "@/games/hidden-objects/scenes/explorer-studio";

/**
 * Game 03's rooms, in the order the selector shows them (GAME03-MULTISCENE-03).
 *
 * A room is data — its pool, stations, regions, copy and the paths of its art —
 * so the registry costs the game's chunk a few kilobytes per room and nothing
 * else: a room's pictures are fetched only when that room is on screen (the
 * selector shows each room's light preview, never its plate). No room is
 * locked, earned or ordered by progress: any of them can be explored first.
 */
export const SCENES: readonly SceneDefinition[] = [EXPLORER_STUDIO, EXPLORER_OBSERVATORY];

/** Where a first visit starts. */
export const DEFAULT_SCENE: SceneDefinition = SCENES[0];

export function sceneById(id: string): SceneDefinition | undefined {
  return SCENES.find((scene) => scene.id === id);
}

/**
 * The room this visit last explored, in memory only (nothing is saved): "Praticar
 * outra vez" and a later entry open the setup on it, and the Explorador can
 * always choose another. A room that failed to load is forgotten, so the next
 * entry opens on one that works.
 */
let lastExplored: SceneDefinition = DEFAULT_SCENE;

export function rememberedScene(): SceneDefinition {
  return lastExplored;
}

export function rememberScene(scene: SceneDefinition): void {
  if (SCENES.includes(scene)) lastExplored = scene;
}

export function forgetScene(scene: SceneDefinition): void {
  if (lastExplored === scene) lastExplored = DEFAULT_SCENE;
}
