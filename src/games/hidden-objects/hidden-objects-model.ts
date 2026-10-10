import type { DifficultyLevel, GameResult } from "@/types/game";
import type { Point, Rect } from "@/games/hidden-objects/hidden-objects-camera";
import { selectRoundTargets } from "@/games/hidden-objects/hidden-objects-rounds";
import {
  DIFFICULTY_PRESETS,
  type HiddenObjectDefinition,
  type HintRung,
  type ListStyle,
  type SceneDefinition,
  type SceneRegion,
  type StationId,
  type TargetId,
} from "@/games/hidden-objects/hidden-objects-scene";

/**
 * Game 03's rules: hit testing, the session (setup → playing → completed),
 * the hint ladder and the result. Pure: no React, no DOM, no clock, no ambient
 * randomness — a round's list comes from the seed the "start" action carries.
 *
 * GAME03-MULTISCENE-03: the rules belong to no room. A session carries the room
 * it explores (`state.scene`); everything that reads a room's targets, stations
 * or size takes the scene first.
 */

export const HIDDEN_OBJECTS_TITLE = "Estúdio das Descobertas";
export const HIDDEN_OBJECTS_SUBTITLE = "Explore e encontre";

/** Each room's pool by id, built once per room. */
const byId = new WeakMap<SceneDefinition, Map<TargetId, HiddenObjectDefinition>>();

export function targetById(scene: SceneDefinition, id: TargetId): HiddenObjectDefinition {
  let index = byId.get(scene);
  if (!index) byId.set(scene, (index = new Map(scene.pool.map((target) => [target.id, target]))));
  const target = index.get(id);
  if (!target) throw new Error(`Unknown target ${id} in ${scene.id}`);
  return target;
}

// --- geometry --------------------------------------------------------------------------------------

export function regionBounds(region: SceneRegion): Rect {
  return region.kind === "rect"
    ? { x: region.x, y: region.y, w: region.w, h: region.h }
    : { x: region.cx - region.r, y: region.cy - region.r, w: 2 * region.r, h: 2 * region.r };
}

export function regionCenter(region: SceneRegion): Point {
  return region.kind === "rect"
    ? { x: region.x + region.w / 2, y: region.y + region.h / 2 }
    : { x: region.cx, y: region.cy };
}

/** Half the region's diagonal: the radius of a circle that holds all of it. */
export function regionRadius(region: SceneRegion): number {
  return region.kind === "rect" ? Math.hypot(region.w, region.h) / 2 : region.r;
}

/** Distance (su) from a scene point to the region's edge; 0 inside. */
export function distanceToRegion(point: Point, region: SceneRegion): number {
  if (region.kind === "circle") {
    return Math.max(0, Math.hypot(point.x - region.cx, point.y - region.cy) - region.r);
  }
  const dx = Math.max(region.x - point.x, 0, point.x - (region.x + region.w));
  const dy = Math.max(region.y - point.y, 0, point.y - (region.y + region.h));
  return Math.hypot(dx, dy);
}

/** Touch and pen get the larger reach; the mouse is precise. */
export function tolerancePxFor(difficulty: DifficultyLevel, pointerType: string): number {
  const { touch, mouse } = DIFFICULTY_PRESETS[difficulty].tolerancePx;
  return pointerType === "mouse" ? mouse : touch;
}

/**
 * Which of `candidates` a tap at `point` (su) selects, if any. A tap inside a
 * shape selects it; otherwise the nearest shape within `tolerancePx` (screen
 * px, converted with the current `scale` in px/su). Only the listed targets
 * are candidates: the rest of the pool is decoration in this session.
 */
export function hitTest(
  scene: SceneDefinition,
  point: Point,
  candidates: readonly TargetId[],
  scale: number,
  tolerancePx: number,
): TargetId | null {
  const reach = tolerancePx / Math.max(scale, 1e-6);
  let best: { id: TargetId; distance: number; centre: number } | null = null;
  for (const id of candidates) {
    const region = targetById(scene, id).region;
    const distance = distanceToRegion(point, region);
    if (distance > reach) continue;
    const centre = Math.hypot(point.x - regionCenter(region).x, point.y - regionCenter(region).y);
    if (!best || distance < best.distance || (distance === best.distance && centre < best.centre)) {
      best = { id, distance, centre };
    }
  }
  return best?.id ?? null;
}

// --- the session ------------------------------------------------------------------------------------

export type SessionStatus = "setup" | "playing" | "completed";

/** 0 = no hint yet; n = the n-th rung of the difficulty's ladder (at most three). */
export type HintStage = 0 | 1 | 2 | 3;

export type SessionEvent =
  | { kind: "found"; targetId: TargetId }
  | { kind: "already"; targetId: TargetId }
  | { kind: "miss"; point: Point }
  | { kind: "hint"; targetId: TargetId; stage: HintStage };

export interface SessionState {
  /** The room this session explores: chosen in setup, fixed from "Explorar" on. */
  scene: SceneDefinition;
  status: SessionStatus;
  difficulty: DifficultyLevel;
  /**
   * The round's list, in the order it is shown: drawn once, when the
   * exploration starts (empty in setup), and kept until the session ends —
   * no render, camera move, hint or restart ever draws it again.
   */
  targets: readonly TargetId[];
  /** The seed the list was drawn with: the same difficulty and seed always give the same list. */
  roundSeed: number | null;
  foundIds: readonly TargetId[];
  /** The object the hint ladder is climbing for, and how far it has climbed. */
  hintTarget: TargetId | null;
  hintStage: HintStage;
  /** Numbers each hint request, so a repeated "Mostrar onde está" lights the halo again. */
  hintSeq: number;
  /** The list item the Explorador picked (the next hint is for it). */
  focusedTarget: TargetId | null;
  /** What just happened, numbered so the view can react to repeats. */
  lastEvent: SessionEvent | null;
  eventSeq: number;
  /** Bumped by every start/restart: the view resets camera and transient feedback on it. */
  round: number;
}

export type SessionAction =
  /** Setup only: explore another room (nothing of the previous one is kept but the difficulty). */
  | { type: "select-scene"; scene: SceneDefinition }
  | { type: "select-difficulty"; difficulty: DifficultyLevel }
  /** `seed`: drawn by the game when "Explorar" is pressed; it picks the round's list. */
  | { type: "start"; seed: number }
  /** A tap the gesture recogniser accepted: scene point (su), px per su, pointer kind. */
  | { type: "tap"; point: Point; scale: number; pointerType: string }
  | { type: "focus-target"; targetId: TargetId }
  | { type: "hint" }
  | { type: "restart" }
  /** "Trocar de cena": leave this exploration (nothing is recorded) and choose again, in setup. */
  | { type: "change-scene" };

export function createSession(scene: SceneDefinition, difficulty: DifficultyLevel = "easy"): SessionState {
  return {
    scene,
    status: "setup",
    difficulty,
    targets: [],
    roundSeed: null,
    foundIds: [],
    hintTarget: null,
    hintStage: 0,
    hintSeq: 0,
    focusedTarget: null,
    lastEvent: null,
    eventSeq: 0,
    round: 0,
  };
}

/** A round from the top. The list is not touched: start draws it, restart keeps it. */
const freshRound = (state: SessionState): SessionState => ({
  ...state,
  status: "playing",
  foundIds: [],
  hintTarget: null,
  hintStage: 0,
  focusedTarget: null,
  lastEvent: null,
  round: state.round + 1,
});

/**
 * Setup again, in `scene`: no list, nothing found, no hint — only the difficulty
 * stays. The counters keep counting, so the view still tells every later round
 * and every later event apart.
 */
const setupIn = (state: SessionState, scene: SceneDefinition): SessionState => ({
  ...createSession(scene, state.difficulty),
  round: state.round,
  eventSeq: state.eventSeq,
  hintSeq: state.hintSeq,
});

const emit = (state: SessionState, event: SessionEvent): SessionState => ({
  ...state,
  lastEvent: event,
  eventSeq: state.eventSeq + 1,
});

export function pendingTargets(state: SessionState): TargetId[] {
  return state.targets.filter((id) => !state.foundIds.includes(id));
}

/** Who the Pista button is for right now. */
export function hintSubject(state: SessionState): TargetId | null {
  const pending = pendingTargets(state);
  if (state.focusedTarget && pending.includes(state.focusedTarget)) return state.focusedTarget;
  if (state.hintTarget && pending.includes(state.hintTarget)) return state.hintTarget;
  return pending[0] ?? null;
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case "select-scene":
      return state.status !== "setup" || action.scene === state.scene ? state : setupIn(state, action.scene);

    case "select-difficulty":
      return state.status === "setup" ? { ...state, difficulty: action.difficulty } : state;

    case "start": {
      if (state.status !== "setup") return state;
      const roundSeed = action.seed >>> 0;
      return freshRound({ ...state, targets: selectRoundTargets(state.scene, state.difficulty, roundSeed), roundSeed });
    }

    // Back to setup in the same room and difficulty: the round is dropped, a new "Explorar" draws a new one.
    case "change-scene":
      return state.status === "setup" ? state : setupIn(state, state.scene);

    // "Recomeçar": the same list from the top. A new list is a new exploration (a new entry).
    case "restart":
      return state.status === "setup" ? state : freshRound(state);

    case "tap": {
      if (state.status !== "playing") return state;
      const listed = state.targets;
      const hit = hitTest(state.scene, action.point, listed, action.scale, tolerancePxFor(state.difficulty, action.pointerType));
      // A free tap costs nothing: no counter, no penalty, nothing recorded.
      if (hit === null) return emit(state, { kind: "miss", point: action.point });
      if (state.foundIds.includes(hit)) return emit(state, { kind: "already", targetId: hit });
      const foundIds = [...state.foundIds, hit];
      const clearsHint = state.hintTarget === hit;
      return emit(
        {
          ...state,
          foundIds,
          status: foundIds.length === listed.length ? "completed" : "playing",
          hintTarget: clearsHint ? null : state.hintTarget,
          hintStage: clearsHint ? 0 : state.hintStage,
          focusedTarget: state.focusedTarget === hit ? null : state.focusedTarget,
        },
        { kind: "found", targetId: hit },
      );
    }

    case "focus-target": {
      if (state.status !== "playing" || !pendingTargets(state).includes(action.targetId)) return state;
      return { ...state, focusedTarget: action.targetId };
    }

    case "hint": {
      if (state.status !== "playing") return state;
      const subject = hintSubject(state);
      if (!subject) return state;
      // The ladder is per object: a new object starts at the first rung, and
      // pressing at the top repeats the top rung — it never climbs past it.
      const top = hintLadderFor(state.difficulty).length;
      const stage: HintStage =
        subject === state.hintTarget ? (Math.min(top, state.hintStage + 1) as HintStage) : 1;
      return emit(
        { ...state, hintTarget: subject, hintStage: stage, hintSeq: state.hintSeq + 1 },
        { kind: "hint", targetId: subject, stage },
      );
    }

    default:
      return state;
  }
}

// --- hints --------------------------------------------------------------------------------------------

/** Deterministic angle for an object (no RNG): the hint halo is off-centre, always the same way. */
function hintAngle(id: TargetId): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 3600;
  return (hash / 3600) * 2 * Math.PI;
}

export interface HintHalo {
  cx: number;
  cy: number;
  r: number;
}

/** Share of the pool's radius its centre sits away from the object (it is inside, never centred). */
export const HINT_OFFSET_SHARE = 0.4;
/** The reveal halo hugs the object with this much room. */
export const REVEAL_HALO_PADDING = 28;

export function hintLadderFor(difficulty: DifficultyLevel): readonly HintRung[] {
  return DIFFICULTY_PRESETS[difficulty].hintLadder;
}

/** The rung a stage of the ladder stands for; null for stage 0 (and past the top). */
export function hintRung(difficulty: DifficultyLevel, stage: HintStage): HintRung | null {
  return stage > 0 ? (hintLadderFor(difficulty)[stage - 1] ?? null) : null;
}

/** Whether a difficulty can ever point at the object itself ("Mostrar onde está"). */
export function revealsExactly(difficulty: DifficultyLevel): boolean {
  return hintLadderFor(difficulty).includes("reveal");
}

/**
 * The light a rung lays over the room, if any:
 *   area / wide-area — a soft pool that holds the whole object, centred off it;
 *   reveal           — a halo exactly on the object;
 *   every other rung — none (Difícil never lights anything).
 */
export function hintHalo(scene: SceneDefinition, id: TargetId, difficulty: DifficultyLevel, stage: HintStage): HintHalo | null {
  const rung = hintRung(difficulty, stage);
  const { region } = targetById(scene, id);
  const centre = regionCenter(region);
  const objectRadius = regionRadius(region);
  if (rung === "reveal") return { cx: centre.x, cy: centre.y, r: objectRadius + REVEAL_HALO_PADDING };
  if (rung !== "area" && rung !== "wide-area") return null;
  const r = Math.max(DIFFICULTY_PRESETS[difficulty].hintRadius, 1.8 * objectRadius);
  // Room for the object inside the pool, wherever the offset points.
  const offset = Math.min(HINT_OFFSET_SHARE * r, r - objectRadius);
  const angle = hintAngle(id);
  const clampTo = (value: number, max: number) => Math.min(max - r * 0.25, Math.max(r * 0.25, value));
  return {
    cx: clampTo(centre.x + Math.cos(angle) * offset, scene.width),
    cy: clampTo(centre.y + Math.sin(angle) * offset, scene.height),
    r,
  };
}

/** What a rung asks of the camera — only ever because the Explorador pressed Pista. */
export type HintCameraMove =
  | { kind: "station"; station: StationId }
  | { kind: "circle"; center: Point; radius: number }
  | { kind: "frame"; bounds: Rect };

/**
 * station → glide to the station; area / wide-area → bring the pool on screen
 * if it is not; reveal → frame the object. Direction and context leave the
 * camera where the Explorador put it.
 */
export function hintCameraMove(scene: SceneDefinition, id: TargetId, difficulty: DifficultyLevel, stage: HintStage): HintCameraMove | null {
  const rung = hintRung(difficulty, stage);
  const target = targetById(scene, id);
  if (rung === "station") return { kind: "station", station: target.station };
  if (rung === "reveal") return { kind: "frame", bounds: regionBounds(target.region) };
  const halo = hintHalo(scene, id, difficulty, stage);
  return halo ? { kind: "circle", center: { x: halo.cx, y: halo.cy }, radius: halo.r } : null;
}

export function stationLabel(scene: SceneDefinition, id: StationId): string {
  return scene.stations.find((station) => station.id === id)?.label ?? id;
}

/** The hint line for a rung. Only "Mostrar onde está" names the object: Difícil never does. */
export function hintMessage(scene: SceneDefinition, id: TargetId, difficulty: DifficultyLevel, stage: HintStage): string {
  const target = targetById(scene, id);
  const station = scene.stations.find((candidate) => candidate.id === target.station);
  switch (hintRung(difficulty, stage)) {
    case "station":
      return `Pista: procure ${station?.hintPhrase ?? "pela sala"}.`;
    case "area":
      return `Pista: procure ${target.hintRegion}.`;
    case "wide-area":
      return "Pista: o brilho marca a região — procure por ali.";
    case "direction":
      return `Pista: olhe ${target.hintDirection}.`;
    case "context":
      return `Pista: está ${target.hintContext}.`;
    case "reveal":
      return `Aqui está: ${target.label}.`;
    default:
      return "";
  }
}

/** What the Pista button offers next for its subject. */
export function hintButtonLabel(state: SessionState): string {
  const subject = hintSubject(state);
  if (!subject) return "Pista";
  const ladder = hintLadderFor(state.difficulty);
  const stage = subject === state.hintTarget ? state.hintStage : 0;
  if (stage === 0) return "Pista";
  if (stage < ladder.length) return ladder[stage] === "reveal" ? "Mostrar onde está" : "Outra pista";
  return ladder[stage - 1] === "reveal" ? "Mostrar de novo" : "Rever pista";
}

// --- the list ------------------------------------------------------------------------------------------

export interface ListEntry {
  id: TargetId;
  found: boolean;
  /** The line the list shows: the name, or — Difícil, not found yet — what the object is for. */
  text: string;
  /** Difícil, once found: the clue it answered, kept under the name. */
  answered: string | null;
  /** The thumbnail's treatment; null = no image (Difícil before the find). */
  art: "picture" | "silhouette" | null;
  /** What the item's button says to assistive technology (never the name of an unfound Difícil object). */
  accessibleText: string;
}

export function listStyleFor(difficulty: DifficultyLevel): ListStyle {
  return DIFFICULTY_PRESETS[difficulty].listStyle;
}

/** How the list shows one object right now. */
export function listEntryFor(state: Pick<SessionState, "scene" | "difficulty" | "foundIds">, id: TargetId): ListEntry {
  const target = targetById(state.scene, id);
  const found = state.foundIds.includes(id);
  const style = listStyleFor(state.difficulty);
  if (found) {
    return {
      id,
      found,
      text: target.label,
      answered: style === "clue" ? target.clue : null,
      art: "picture",
      accessibleText: `${target.accessibleLabel}: encontrado`,
    };
  }
  if (style === "clue") {
    return { id, found, text: target.clue, answered: null, art: null, accessibleText: `${target.clue} Procurar.` };
  }
  return { id, found, text: target.label, answered: null, art: style, accessibleText: `${target.accessibleLabel}: procurar` };
}

/** How the Pista button refers to its subject: as the list does (Difícil: by its clue). */
export function subjectText(state: Pick<SessionState, "scene" | "difficulty" | "foundIds">, id: TargetId): string {
  return listEntryFor(state, id).text;
}

// --- copy and result ------------------------------------------------------------------------------------

export function progressLabel(state: SessionState): string {
  return `${state.foundIds.length} de ${state.targets.length}`;
}

/**
 * The short live-region line for what just happened (a free tap announces
 * nothing). A find names the object — in Difícil that is when the name is
 * first said, with the clue it answered.
 */
export function announcementFor(state: SessionState): string {
  const event = state.lastEvent;
  if (!event) return "";
  if (event.kind === "found") {
    const target = targetById(state.scene, event.targetId);
    const answered = listStyleFor(state.difficulty) === "clue" ? ` ${target.clue}` : "";
    const done = state.status === "completed";
    return done
      ? `Encontrou: ${target.label}.${answered} ${state.scene.copy.completeTitle}!`
      : `Encontrou: ${target.label}.${answered} ${progressLabel(state)}.`;
  }
  if (event.kind === "already") return `Você já encontrou: ${targetById(state.scene, event.targetId).label}.`;
  if (event.kind === "hint") return hintMessage(state.scene, event.targetId, state.difficulty, event.stage);
  return "";
}

/**
 * The session's result: only a finished exploration produces one. `score` is
 * neutral — how many objects were found (5, 6 or 8) — never reduced by hints,
 * "Mostrar onde está" or free taps, none of which is recorded. `sceneId` says
 * which room was explored (results saved before it existed are all the Estúdio
 * do Explorador) and `roundSeed` which list it asked for (with the room and the
 * difficulty, it draws that same list again). The summary is the room's own line.
 */
export function buildHiddenObjectsResult(state: SessionState): Omit<GameResult, "id" | "playedAt"> {
  const total = state.targets.length;
  return {
    activityId: "hidden-objects",
    activityTitle: HIDDEN_OBJECTS_TITLE,
    gameId: "hidden-objects",
    score: state.foundIds.length,
    summary: state.scene.copy.summary,
    details: {
      difficulty: state.difficulty,
      foundObjects: state.foundIds.length,
      totalObjects: total,
      completed: state.status === "completed",
      sceneId: state.scene.id,
      roundSeed: state.roundSeed ?? 0,
    },
  };
}
