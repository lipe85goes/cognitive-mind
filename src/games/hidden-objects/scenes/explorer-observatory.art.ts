import type { PlacementArt, SceneAtlas } from "@/games/hidden-objects/hidden-objects-scene";

/**
 * Observatório do Explorador — the pictures of the things that move, and their audit (GAME03-REPLAYABILITY-05).
 *
 * Written by tools/assets/create_observatory_scene.mjs: never edit by hand.
 */
export const OBSERVATORY_ATLAS: SceneAtlas = { src: "/assets/hidden-objects/explorer-observatory/v4/atlas.webp", width: 1, height: 1 };

export const OBSERVATORY_PLACEMENT_ART: Readonly<Record<string, PlacementArt>> = {};
