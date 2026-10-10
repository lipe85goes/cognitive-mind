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
 * same 5/6/8, round rules and floors, list styles, clue levels, hint ladders and
 * tolerances in every room), the safe margins under the zoom buttons and the
 * look-alike clearance.
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

/**
 * How far a clue sits from the object it describes (GAME03-CALIBRATION-02A):
 *   direct      — names what the object is or does: the object is easy to infer;
 *   associative — goes through its function, behaviour, material or a thing it
 *                 belongs with: one association before the object is known;
 *   indirect    — a situation or a consequence: one or two associations before
 *                 the Explorador knows what to look for (never trivia).
 * No level ever says the object's name, a look-alike's name or a colour.
 */
export type ClueLevel = "direct" | "associative" | "indirect";

export interface ClueVariant {
  level: ClueLevel;
  /** One sentence, capitalised, ending in a full stop. */
  text: string;
}

/**
 * What the art kit's audit measured for an object, in the room as it ships
 * (docs/archive/hidden-objects/<room>/review/<kit>/fairness.json — the round
 * model reads these, and the calibration suite holds them to that file):
 *   visible — share of its own pixels the finished plate shows;
 *   edge    — median luminance ratio across its visible silhouette's edge;
 *   clutter — share of busy pixels (strong edges) in the ring of room around it.
 */
export interface TargetMeasure {
  visible: number;
  edge: number;
  clutter: number;
}

export interface HiddenObjectDefinition {
  id: TargetId;
  /** The word on the list: a concrete noun, never a colour. Clue lists show it only once found. */
  label: string;
  /** What assistive technology announces. */
  accessibleLabel: string;
  /**
   * The clue bank: several authored ways of telling the object without naming
   * it, at least one per level. A round picks one per object from its seed
   * (hidden-objects-clues.ts); the difficulty decides which level its list
   * reads and which its "reclue" hint re-tells it at.
   */
  clues: readonly ClueVariant[];
  tier: TargetTier;
  station: StationId;
  /** The tappable shape: the visible part of the object, in su. */
  region: SceneRegion;
  /** The audit's measurements of this object in the shipped art (the round model's inputs). */
  measured: TargetMeasure;
  /** Fácil's second hint, "Procure …": the spot itself. */
  hintRegion: string;
  /** Médio's last hint, "Olhe …": a direction inside the station, never the spot. */
  hintDirection: string;
  /** Difícil's last hint, "Está …": what the object is near, never where exactly. */
  hintContext: string;
  /** The list styles that may present it (absent: every style). */
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

/** How the list shows a pending object: picture + name, or one of its clues (the name only once found). */
export type ListStyle = "picture" | "clue";

/**
 * One press of Pista, in the order a difficulty climbs them:
 *   station   — names the station and takes the camera there (every difficulty);
 *   area      — a soft pool of light holding the object off-centre + the spot in words (Fácil);
 *   reclue    — the same object told again, at an easier level of its clue bank (Médio);
 *   direction — a direction inside the station, in words only (Médio);
 *   context   — what the object is near, in words only (Difícil);
 *   reveal    — "Mostrar onde está": frames the object under a halo (Fácil only).
 */
export type HintRung = "station" | "area" | "reclue" | "direction" | "context" | "reveal";

/**
 * Which objects a round of a difficulty may ask for (GAME03-CALIBRATION-02A):
 * the tiers it may hold, and the floor the round's measured search profile
 * (hidden-objects-difficulty.ts) must reach. A round that misses any of them is
 * never drawn, whatever the seed.
 */
export interface RoundRule {
  /** Fewest and most objects of each tier. */
  tiers: Readonly<Record<TargetTier, readonly [number, number]>>;
  /** Most objects found at a static glance (search load under POP_OUT_BELOW). */
  maxPopOuts: number;
  /** The floor of the round's mean search load. */
  minSearch: number;
  /** The floor of the round's look-alike pressure (painted look-alikes per listed object). */
  minDecoys: number;
}

export interface DifficultyPreset {
  label: string;
  /** How many objects a round lists. */
  count: number;
  /** What a round may ask for (which objects is drawn per round: hidden-objects-rounds.ts). */
  round: RoundRule;
  listStyle: ListStyle;
  /** A clue list: the level of each object's clue bank it reads (null for a picture list). */
  listClue: ClueLevel | null;
  /** What each press of Pista adds, per object; the ladder stops at its last rung. */
  hintLadder: readonly HintRung[];
  /** The level a "reclue" rung re-tells the object at (null when the ladder has none). */
  reclue: ClueLevel | null;
  /** Radius of the area pool of light, in su (unused by a ladder without one). */
  hintRadius: number;
  /** Extra reach around a target's shape, in screen px, per pointer kind. */
  tolerancePx: { touch: number; mouse: number };
}

/**
 * The round floors (GAME03-CALIBRATION-02A), measured on the search-load ruler
 * of hidden-objects-difficulty.ts and derived from what Difficulty V2's Difícil
 * asked for — every V2 Difícil round of both rooms, on the art kits it was
 * playtested on (tools/validation/hidden-objects-calibration.mjs recomputes
 * them from that tree; the calibration suite holds these numbers to it):
 *   easy   — its lower quartile: a new Fácil already searches like an old Difícil;
 *   medium — its mean: a new Médio never asks less than an average old Difícil;
 *   hard   — its maximum: every new Difícil is beyond anything the old one asked.
 * ROUND_FLOORS reads the round's mean search load; DECOY_FLOORS its look-alike
 * pressure (painted look-alikes per listed object), the same three statistics.
 */
export const ROUND_FLOORS: Readonly<Record<DifficultyLevel, number>> = { easy: 0.533, medium: 0.552, hard: 0.612 };
export const DECOY_FLOORS: Readonly<Record<DifficultyLevel, number>> = { easy: 0.75, medium: 0.794, hard: 1.25 };

/**
 * GAME03-CALIBRATION-02A — Difficulty V3. Every difficulty is a real search;
 * what climbs is how much the Explorador must work out before searching and how
 * little the hints give back:
 *   Fácil   5 · searches like the old Difícil · picture + name · station → spot + pool → "Mostrar onde está";
 *   Médio   6 · above the old Difícil, no glance finds · an associative clue (the name only once found) ·
 *           station → the same object told directly → direction;
 *   Difícil 8 · beyond the old Difícil, no A, at least four C · an indirect clue · station → context.
 * Médio and Difícil never point at the object or light the room; Difícil never
 * names it before it is found. The tolerances are the skeleton's: difficulty never
 * comes from smaller targets. One contract for every room — a room brings its own
 * pool, measured, never its own difficulty.
 */
export const DIFFICULTY_PRESETS: Readonly<Record<DifficultyLevel, DifficultyPreset>> = {
  easy: {
    label: "Fácil",
    count: 5,
    round: { tiers: { A: [0, 1], B: [0, 5], C: [1, 5] }, maxPopOuts: 1, minSearch: ROUND_FLOORS.easy, minDecoys: DECOY_FLOORS.easy },
    listStyle: "picture",
    listClue: null,
    hintLadder: ["station", "area", "reveal"],
    reclue: null,
    hintRadius: 240,
    tolerancePx: { touch: 16, mouse: 8 },
  },
  medium: {
    label: "Médio",
    count: 6,
    round: { tiers: { A: [0, 1], B: [0, 6], C: [2, 6] }, maxPopOuts: 0, minSearch: ROUND_FLOORS.medium, minDecoys: DECOY_FLOORS.medium },
    listStyle: "clue",
    listClue: "associative",
    hintLadder: ["station", "reclue", "direction"],
    reclue: "direct",
    hintRadius: 0,
    tolerancePx: { touch: 12, mouse: 6 },
  },
  hard: {
    label: "Difícil",
    count: 8,
    round: { tiers: { A: [0, 0], B: [0, 4], C: [4, 8] }, maxPopOuts: 0, minSearch: ROUND_FLOORS.hard, minDecoys: DECOY_FLOORS.hard },
    listStyle: "clue",
    listClue: "indirect",
    hintLadder: ["station", "context"],
    reclue: null,
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
