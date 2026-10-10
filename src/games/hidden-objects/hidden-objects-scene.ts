import type { DifficultyLevel } from "@/types/game";

/**
 * Game 03 — what a scene is (GAME03-MULTISCENE-03).
 *
 * The Estúdio das Descobertas is one game with several rooms. Every room is a
 * `SceneDefinition` — plain data in its own module under `scenes/` — and the
 * same engine (camera, gestures, hit testing, session, hints, feedback, result)
 * plays any of them: nothing in the engine names a room, a station or a target.
 *
 * Everything is in scene units (su): a room's plate is `width`×`height` su,
 * drawn at 1 px per su, origin top-left. Nothing in a scene module runs: the
 * game, its tests and the art scripts (tools/assets/, which paint every target
 * exactly where its `region` says) all read the same values.
 *
 * What is NOT per room: the difficulty contract (DIFFICULTY_PRESETS below — the
 * same 5/6/8, tier mixes, list styles, hint ladders and tolerances in every
 * room), the safe margins under the zoom buttons and the look-alike clearance.
 */

/**
 * No target may sit in these margins: the zoom buttons live in a corner of the
 * scene, and the margins guarantee nothing is ever stuck under them.
 */
export const SAFE_MARGIN_X = 256;
export const SAFE_MARGIN_Y = 160;

/** A station's id, unique within its room (the Estúdio: janela, mesa, estante). */
export type StationId = string;
/** A pool object's id, unique within its room. */
export type TargetId = string;

export interface SceneStation {
  id: StationId;
  label: string;
  /** Where the camera centres when the Explorador asks for this station. */
  center: { x: number; y: number };
  /** The stretch of the scene the station names (hints, "você está em"). */
  span: { x0: number; x1: number };
  /** Hint 1 copy: "Procure …". */
  hintPhrase: string;
}

/**
 * Findability, not score: A is in plain sight, B is partly covered or sits
 * among one look-alike, C is tucked into its surroundings among up to two —
 * always with its identifying part in view (Discovery §9, F1/F8).
 */
export type TargetTier = "A" | "B" | "C";

export type SceneRegion =
  | { kind: "rect"; x: number; y: number; w: number; h: number }
  | { kind: "circle"; cx: number; cy: number; r: number };

export interface HiddenObjectDefinition {
  id: TargetId;
  /** The word on the list: a concrete noun, never a colour. Difícil shows it only once found. */
  label: string;
  /** What assistive technology announces. */
  accessibleLabel: string;
  /**
   * Difícil's list: what the object is for, never its name — the Explorador
   * works out the idea, then looks for the thing. One object in the room fits it.
   */
  clue: string;
  tier: TargetTier;
  station: StationId;
  /** The tappable shape: the visible part of the object, in su. */
  region: SceneRegion;
  /** Fácil's second hint, "Procure …": the spot itself. */
  hintRegion: string;
  /** Médio's last hint, "Olhe …": a direction inside the station, never the spot. */
  hintDirection: string;
  /** Difícil's last hint, "Está …": what the object is near, never where exactly. */
  hintContext: string;
  /**
   * The list styles that may present it (absent: all three). A framed picture's
   * outline is a plain rectangle, so Médio's silhouette list never shows it.
   */
  listedAs?: readonly ListStyle[];
}


/**
 * A look-alike: an ordinary thing of the room painted near a target because it
 * shares its shape or material — never its kind, never its use, so no clue fits
 * it and a careful look tells them apart. It is decoration: a tap on it is a
 * free tap like any other. The art script paints each exactly in its region.
 */
export interface SceneLookAlike {
  id: string;
  /** What it is: a concrete noun that is not any target's. */
  label: string;
  /** The target it can be mistaken for at a glance. */
  resembles: TargetId;
  /** What a careful look sees that the target does not have (or the other way round). */
  tellApart: string;
  region: SceneRegion;
}

/**
 * Look-alikes per target, by tier: A ≤ 1, B ≤ 2, C ≤ 3. Each sits in its
 * target's station and at least LOOKALIKE_CLEARANCE_SU from every target's
 * shape, so the tolerance of a tap never turns it into a find.
 */
export const LOOKALIKE_CLEARANCE_SU = 32;

/** How the list shows a pending object: picture + name → silhouette + name → what it is for. */
export type ListStyle = "picture" | "silhouette" | "clue";

/**
 * One press of Pista, in the order a difficulty climbs them:
 *   station   — names the station and takes the camera there (every difficulty);
 *   area      — a soft pool of light holding the object off-centre + the spot in words (Fácil);
 *   wide-area — a wider pool, no words for the spot (Médio);
 *   direction — a direction inside the station, in words only (Médio);
 *   context   — what the object is near, in words only (Difícil);
 *   reveal    — "Mostrar onde está": frames the object under a halo (Fácil only).
 */
export type HintRung = "station" | "area" | "wide-area" | "direction" | "context" | "reveal";

export interface DifficultyPreset {
  label: string;
  /** How many objects a round lists. */
  count: number;
  /**
   * The round's findability mix: exactly this many of each tier (they add up to
   * `count`). Which A, B and C objects is drawn per round (hidden-objects-rounds.ts).
   */
  tiers: Readonly<Record<TargetTier, number>>;
  listStyle: ListStyle;
  /** What each press of Pista adds, per object; the ladder stops at its last rung. */
  hintLadder: readonly HintRung[];
  /** Radius of the area pool of light, in su (unused by a ladder without one). */
  hintRadius: number;
  /** Extra reach around a target's shape, in screen px, per pointer kind. */
  tolerancePx: { touch: number; mouse: number };
}

/**
 * GAME03-EXPERIENCE-02. Each difficulty changes what the Explorador is TOLD,
 * not only how much there is to find:
 *   Fácil   5 · 3A+2B · picture + name · station → spot + pool → "Mostrar onde está";
 *   Médio   6 · 1A+3B+2C · silhouette + name · station → wide pool → direction;
 *   Difícil 8 · 1A+3B+4C · what it is for (the name only once found) · station → context.
 * Médio and Difícil never point at the object; Difícil never lights anything.
 * The tolerances are the skeleton's: difficulty never comes from smaller targets.
 * The objects themselves are drawn per round from the pool (hidden-objects-rounds.ts):
 * the mix of tiers is fixed, which A, B and C is not.
 * GAME03-MULTISCENE-03: one contract for every room — a room brings its own
 * pool, never its own difficulty.
 */
export const DIFFICULTY_PRESETS: Readonly<Record<DifficultyLevel, DifficultyPreset>> = {
  easy: {
    label: "Fácil",
    count: 5,
    tiers: { A: 3, B: 2, C: 0 },
    listStyle: "picture",
    hintLadder: ["station", "area", "reveal"],
    hintRadius: 240,
    tolerancePx: { touch: 16, mouse: 8 },
  },
  medium: {
    label: "Médio",
    count: 6,
    tiers: { A: 1, B: 3, C: 2 },
    listStyle: "silhouette",
    hintLadder: ["station", "wide-area", "direction"],
    hintRadius: 400,
    tolerancePx: { touch: 12, mouse: 6 },
  },
  hard: {
    label: "Difícil",
    count: 8,
    tiers: { A: 1, B: 3, C: 4 },
    listStyle: "clue",
    hintLadder: ["station", "context"],
    hintRadius: 0,
    tolerancePx: { touch: 10, mouse: 5 },
  },
};

export const DIFFICULTY_ORDER: readonly DifficultyLevel[] = ["easy", "medium", "hard"];

export interface SceneLayer {
  /** Unique within its room; the plate is always "plate". */
  id: string;
  src: string;
  rect: { x: number; y: number; w: number; h: number };
  /**
   * How far the layer travels relative to the plate when the camera pans:
   * < 1 drifts behind (the view through a window), > 1 slides in front.
   */
  parallax: number;
  /** Where the layer has paint, in su: front paint must never cover a target. */
  opaque: readonly { x: number; y: number; w: number; h: number }[];
}

/** The words a room says about itself (the engine's sentences are the same everywhere). */
export interface SceneCopy {
  /** The scene selector's one line under the name. */
  tagline: string;
  /** The viewport's accessible name. */
  viewportLabel: string;
  /** The closing card's title and the last find's announcement: "Estúdio explorado". */
  completeTitle: string;
  /** The result's summary line. */
  summary: string;
}

/**
 * One room of the game. A new room is a new module under `scenes/` exporting one
 * of these, plus its entry in the registry (hidden-objects-scenes.ts) — never a
 * change to the engine.
 */
export interface SceneDefinition {
  /** Stable id: results record it as `details.sceneId`, and it seeds nothing on its own. */
  id: string;
  /** The room's name, as the selector and the HUD say it. */
  name: string;
  copy: SceneCopy;
  /** A light picture of the room for the selector (never the full-resolution plate). */
  preview: string;
  width: number;
  height: number;
  /** Left to right; the keyboard's 1, 2, 3… follow this order. */
  stations: readonly SceneStation[];
  /** Where every exploration opens. */
  initialStation: StationId;
  /**
   * Every object a round may ask for, each painted exactly once and always in
   * the room — a round lists a handful (DIFFICULTY_PRESETS), the rest stay
   * scenery and distractors, never marked as candidates.
   */
  pool: readonly HiddenObjectDefinition[];
  lookAlikes: readonly SceneLookAlike[];
  /** Back to front; every layer is essential (the room is ready once all have painted). */
  layers: readonly SceneLayer[];
  /** The list's picture of a pool object. */
  thumbnail: (id: TargetId) => string;
  /** The stage's colour while the room's art arrives. */
  backdrop: string;
}
