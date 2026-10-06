import type { DifficultyLevel, GameResult } from "@/types/game";
import type { Point, Rect } from "@/games/hidden-objects/hidden-objects-camera";
import {
  DIFFICULTY_PRESETS,
  HIDDEN_OBJECTS,
  SCENE_HEIGHT,
  SCENE_STATIONS,
  SCENE_WIDTH,
  type HiddenObjectDefinition,
  type SceneRegion,
  type StationId,
  type TargetId,
} from "@/games/hidden-objects/hidden-objects-scene";

/**
 * The Estúdio's rules: hit testing, the session (setup → playing → completed),
 * the hint ladder and the result. Pure: no React, no DOM, no clock, no RNG.
 */

export const HIDDEN_OBJECTS_TITLE = "Estúdio das Descobertas";
export const HIDDEN_OBJECTS_SUBTITLE = "Explore e encontre";

const BY_ID = new Map(HIDDEN_OBJECTS.map((target) => [target.id, target]));

export function targetById(id: TargetId): HiddenObjectDefinition {
  const target = BY_ID.get(id);
  if (!target) throw new Error(`Unknown target ${id}`);
  return target;
}

/** The fixed list for a difficulty, in the order it is shown. */
export function targetsFor(difficulty: DifficultyLevel): readonly TargetId[] {
  return DIFFICULTY_PRESETS[difficulty].targets;
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
  point: Point,
  candidates: readonly TargetId[],
  scale: number,
  tolerancePx: number,
): TargetId | null {
  const reach = tolerancePx / Math.max(scale, 1e-6);
  let best: { id: TargetId; distance: number; centre: number } | null = null;
  for (const id of candidates) {
    const region = targetById(id).region;
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

/** 0 = no hint yet; 1 = zone; 2 = sub-region; 3 = "Mostrar onde está". */
export type HintStage = 0 | 1 | 2 | 3;

export type SessionEvent =
  | { kind: "found"; targetId: TargetId }
  | { kind: "already"; targetId: TargetId }
  | { kind: "miss"; point: Point }
  | { kind: "hint"; targetId: TargetId; stage: HintStage };

export interface SessionState {
  status: SessionStatus;
  difficulty: DifficultyLevel;
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
  | { type: "select-difficulty"; difficulty: DifficultyLevel }
  | { type: "start" }
  /** A tap the gesture recogniser accepted: scene point (su), px per su, pointer kind. */
  | { type: "tap"; point: Point; scale: number; pointerType: string }
  | { type: "focus-target"; targetId: TargetId }
  | { type: "hint" }
  | { type: "restart" };

export function createSession(difficulty: DifficultyLevel = "easy"): SessionState {
  return {
    status: "setup",
    difficulty,
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

const emit = (state: SessionState, event: SessionEvent): SessionState => ({
  ...state,
  lastEvent: event,
  eventSeq: state.eventSeq + 1,
});

export function pendingTargets(state: SessionState): TargetId[] {
  return targetsFor(state.difficulty).filter((id) => !state.foundIds.includes(id));
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
    case "select-difficulty":
      return state.status === "setup" ? { ...state, difficulty: action.difficulty } : state;

    case "start":
      return state.status === "setup" ? freshRound(state) : state;

    case "restart":
      return state.status === "setup" ? state : freshRound(state);

    case "tap": {
      if (state.status !== "playing") return state;
      const listed = targetsFor(state.difficulty);
      const hit = hitTest(action.point, listed, action.scale, tolerancePxFor(state.difficulty, action.pointerType));
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
      // The ladder is per object: a new object starts at the first rung.
      const stage: HintStage =
        subject === state.hintTarget ? (Math.min(3, state.hintStage + 1) as HintStage) : 1;
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

/** Share of the halo radius the centre may sit away from the object (it is inside, never centred). */
export const HINT_OFFSET_SHARE = 0.4;
/** The reveal halo hugs the object with this much room. */
export const REVEAL_HALO_PADDING = 28;

/**
 * Stage 2: a soft pool of light that holds the whole object, centred off it.
 * Stage 3: a halo exactly on the object. Other stages have no halo.
 */
export function hintHalo(id: TargetId, difficulty: DifficultyLevel, stage: HintStage): HintHalo | null {
  const { region } = targetById(id);
  const centre = regionCenter(region);
  const objectRadius = regionRadius(region);
  if (stage === 3) return { cx: centre.x, cy: centre.y, r: objectRadius + REVEAL_HALO_PADDING };
  if (stage !== 2) return null;
  const r = Math.max(DIFFICULTY_PRESETS[difficulty].hintRadius, 1.8 * objectRadius);
  // Room for the object inside the halo, wherever the offset points.
  const offset = Math.min(HINT_OFFSET_SHARE * r, r - objectRadius);
  const angle = hintAngle(id);
  const clampTo = (value: number, max: number) => Math.min(max - r * 0.25, Math.max(r * 0.25, value));
  return {
    cx: clampTo(centre.x + Math.cos(angle) * offset, SCENE_WIDTH),
    cy: clampTo(centre.y + Math.sin(angle) * offset, SCENE_HEIGHT),
    r,
  };
}

export function stationLabel(id: StationId): string {
  return SCENE_STATIONS.find((station) => station.id === id)?.label ?? id;
}

export function hintMessage(id: TargetId, stage: HintStage): string {
  const target = targetById(id);
  const station = SCENE_STATIONS.find((candidate) => candidate.id === target.station);
  if (stage === 1) return `Pista: procure ${station?.hintPhrase ?? "pela sala"}.`;
  if (stage === 2) return `Pista: procure ${target.hintRegion}.`;
  if (stage === 3) return `Aqui está: ${target.label}.`;
  return "";
}

/** What the Pista button offers next for its subject. */
export function hintButtonLabel(state: SessionState): string {
  const subject = hintSubject(state);
  if (!subject) return "Pista";
  const stage = subject === state.hintTarget ? state.hintStage : 0;
  if (stage === 0) return "Pista";
  if (stage === 1) return "Mais uma pista";
  if (stage === 2) return "Mostrar onde está";
  return "Mostrar de novo";
}

// --- copy and result ------------------------------------------------------------------------------------

export function progressLabel(state: SessionState): string {
  return `${state.foundIds.length} de ${targetsFor(state.difficulty).length}`;
}

/** The short live-region line for what just happened (a free tap announces nothing). */
export function announcementFor(state: SessionState): string {
  const event = state.lastEvent;
  if (!event) return "";
  if (event.kind === "found") {
    const done = state.status === "completed";
    return done
      ? `Encontrou: ${targetById(event.targetId).label}. Estúdio explorado!`
      : `Encontrou: ${targetById(event.targetId).label}. ${progressLabel(state)}.`;
  }
  if (event.kind === "already") return `Você já encontrou: ${targetById(event.targetId).label}.`;
  if (event.kind === "hint") return hintMessage(event.targetId, event.stage);
  return "";
}

/**
 * The session's result: only a finished exploration produces one. `score` is
 * neutral — how many objects were found (5, 6 or 8) — never reduced by hints,
 * "Mostrar onde está" or free taps, none of which is recorded.
 */
export function buildHiddenObjectsResult(state: SessionState): Omit<GameResult, "id" | "playedAt"> {
  const total = targetsFor(state.difficulty).length;
  return {
    activityId: "hidden-objects",
    activityTitle: HIDDEN_OBJECTS_TITLE,
    gameId: "hidden-objects",
    score: state.foundIds.length,
    summary: "Você encontrou todos os objetos do Estúdio.",
    details: {
      difficulty: state.difficulty,
      foundObjects: state.foundIds.length,
      totalObjects: total,
      completed: state.status === "completed",
    },
  };
}
