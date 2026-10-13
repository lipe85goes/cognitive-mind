import type { Point, Rect } from "@/games/hidden-objects/hidden-objects-camera";
import type {
  InteractableId,
  InteractablePose,
  InteractableState,
  SceneDefinition,
  SceneInteractable,
} from "@/games/hidden-objects/hidden-objects-scene";

/**
 * Game 03 — the room's movable pieces (GAME03-INTERACTIONS-04).
 *
 * A room may have a few pieces the Explorador can open or move — a drawer, a
 * door, a curtain, a lid, a thing pushed aside. Each is scene data
 * (`SceneInteractable`): a small finite-state machine with authored poses, an
 * authored hit area per state and the line a screen reader hears. This module
 * is the whole of their logic, for every room alike: nothing here names a
 * room, a piece or an object. Pure — no React, no DOM, no clock.
 *
 * Where the pieces are is part of an exploration (`InteractionState`, held by
 * the session in hidden-objects-model.ts): it starts as the room is authored
 * and only a tap on a piece, or its button, changes it.
 */

/** Where every piece of a room is right now: piece id → state id. */
export type InteractionState = Readonly<Record<InteractableId, string>>;

const pieceIndex = new WeakMap<SceneDefinition, Map<InteractableId, SceneInteractable>>();

export function interactableById(scene: SceneDefinition, id: InteractableId): SceneInteractable {
  let index = pieceIndex.get(scene);
  if (!index) pieceIndex.set(scene, (index = new Map(scene.interactables.map((piece) => [piece.id, piece]))));
  const piece = index.get(id);
  if (!piece) throw new Error(`Unknown interactable ${id} in ${scene.id}`);
  return piece;
}

/** Every piece as the room is authored: what each exploration (and each "Recomeçar") starts with. */
export function initialInteractions(scene: SceneDefinition): InteractionState {
  return Object.fromEntries(scene.interactables.map((piece) => [piece.id, piece.initial]));
}

/** The state a piece is in (its authored start when the record does not name it). */
export function pieceState(scene: SceneDefinition, interactions: InteractionState, id: InteractableId): InteractableState {
  const piece = interactableById(scene, id);
  const current = interactions[id] ?? piece.initial;
  return piece.states.find((state) => state.id === current) ?? piece.states[0];
}

/** The state a tap or its button moves a piece to: the next one, the last back to the first. */
export function nextPieceState(piece: SceneInteractable, current: string): string {
  const index = piece.states.findIndex((state) => state.id === current);
  return piece.states[(index + 1) % piece.states.length].id;
}

/** Whether what a piece keeps is in view: no piece at all, or the piece in a state that exposes it. */
export function gateIsOpen(scene: SceneDefinition, interactions: InteractionState, gate: InteractableId | undefined): boolean {
  return !gate || pieceState(scene, interactions, gate).open;
}

/**
 * A pose as the 2D matrix [a, b, c, d, e, f] taking the piece's own coordinates
 * (su from its rect's corner) into the room — exactly what the view's CSS
 * transform does: translate(origin + shift) · rotate · scale · translate(−origin).
 */
export function poseMatrix(piece: Pick<SceneInteractable, "rect" | "origin">, pose: InteractablePose): readonly number[] {
  const angle = ((pose.rotate ?? 0) * Math.PI) / 180;
  const sx = pose.scaleX ?? 1;
  const sy = pose.scaleY ?? 1;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const a = cos * sx;
  const b = sin * sx;
  const c = -sin * sy;
  const d = cos * sy;
  const ox = piece.origin.x;
  const oy = piece.origin.y;
  return [a, b, c, d, piece.rect.x + ox + (pose.x ?? 0) - (a * ox + c * oy), piece.rect.y + oy + (pose.y ?? 0) - (b * ox + d * oy)];
}

/** The room rectangle a piece's art covers in a pose (the bounds of its transformed picture). */
export function poseBounds(piece: Pick<SceneInteractable, "rect" | "origin">, pose: InteractablePose): Rect {
  const [a, b, c, d, e, f] = poseMatrix(piece, pose);
  const { w, h } = piece.rect;
  const corners = [
    [0, 0],
    [w, 0],
    [0, h],
    [w, h],
  ].map(([x, y]) => ({ x: a * x + c * y + e, y: b * x + d * y + f }));
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** The CSS a pose becomes (the view writes it once per state change, never per frame). */
export function poseTransform(pose: InteractablePose): string {
  return `translate(${pose.x ?? 0}px, ${pose.y ?? 0}px) rotate(${pose.rotate ?? 0}deg) scale(${pose.scaleX ?? 1}, ${pose.scaleY ?? 1})`;
}

/** Distance (su) from a point to a rectangle's edge; 0 inside. */
function distanceToRect(point: Point, rect: Rect): number {
  const dx = Math.max(rect.x - point.x, 0, point.x - (rect.x + rect.w));
  const dy = Math.max(rect.y - point.y, 0, point.y - (rect.y + rect.h));
  return Math.hypot(dx, dy);
}

/**
 * Which piece a tap at `point` (su) reaches, if any: inside a piece's hit area
 * for its current state, or the nearest within `tolerancePx` (the reach a
 * target gets). The session tries pieces only after the listed objects in view.
 */
export function interactableAt(
  scene: SceneDefinition,
  interactions: InteractionState,
  point: Point,
  scale: number,
  tolerancePx: number,
): InteractableId | null {
  const reach = tolerancePx / Math.max(scale, 1e-6);
  let best: { id: InteractableId; distance: number } | null = null;
  for (const piece of scene.interactables) {
    const distance = distanceToRect(point, pieceState(scene, interactions, piece.id).hit);
    if (distance > reach) continue;
    if (!best || distance < best.distance) best = { id: piece.id, distance };
  }
  return best?.id ?? null;
}
