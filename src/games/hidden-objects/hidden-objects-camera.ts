import type { SceneDefinition, SceneStation, StationId } from "@/games/hidden-objects/hidden-objects-scene";

/**
 * Camera math for Game 03: pure functions, no DOM, no React.
 *
 * A room is a `width`×`height` su world seen through a viewport (the scene
 * area, in CSS px). The camera is the su point at the centre of the viewport
 * plus a zoom relative to "cover" — the smallest scale at which the room still
 * fills the whole viewport. Zoom 1 is cover, so the camera can never show
 * anything outside the room.
 *
 * GAME03-MULTISCENE-03: the room is an argument — every function that needs its
 * size or its stations takes the scene first — so one camera serves every room.
 */

/** What the camera needs to know about a room. */
export type SceneFrame = Pick<SceneDefinition, "width" | "height" | "stations" | "initialStation">;

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Camera {
  /** Scene point (su) at the centre of the viewport. */
  x: number;
  y: number;
  /** Scale relative to cover: 1 = the scene just covers the viewport. */
  zoom: number;
}

/** Cover: the whole height (or width) of the room always fills the viewport. */
export const MIN_ZOOM = 1;
/** Where every session starts. */
export const DEFAULT_ZOOM = 1;
/** The plate is drawn at 1 px/su: past ~1.25 px/su it only gets softer. */
export const MAX_SCALE_PX_PER_SU = 1.25;
/** …but every screen may zoom at least 2× cover and never more than 4×. */
export const MAX_ZOOM_FLOOR = 2;
export const MAX_ZOOM_CEILING = 4;
/** + / − buttons and keys. */
export const ZOOM_STEP = 1.25;
/** Mouse wheel: factor 2^(−deltaY / divisor) per event, clamped. */
export const WHEEL_ZOOM_DIVISOR = 500;
/** Trackpad pinch arrives as ctrl + wheel with small deltas. */
export const PINCH_WHEEL_ZOOM_DIVISOR = 100;
export const WHEEL_STEP_MIN = 0.8;
export const WHEEL_STEP_MAX = 1.25;
/** Arrow keys pan by this share of the viewport (Shift: the larger one). */
export const KEY_PAN_FRACTION = 0.12;
export const KEY_PAN_FRACTION_FAST = 0.3;
/** Station, recentre and hint glides (cut instantly under reduced motion). */
export const CAMERA_GLIDE_MS = 450;
/** "Mostrar onde está" frames the object at this share of the viewport's short side. */
export const REVEAL_FILL = 0.25;
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** px per su at zoom 1. Never 0, so an unmeasured viewport cannot divide by zero. */
export function coverScale(scene: SceneFrame, viewport: Size): number {
  return Math.max(viewport.width / scene.width, viewport.height / scene.height, 1e-6);
}

export function maxZoom(scene: SceneFrame, viewport: Size): number {
  return clamp(MAX_SCALE_PX_PER_SU / coverScale(scene, viewport), MAX_ZOOM_FLOOR, MAX_ZOOM_CEILING);
}

/** px per su for this camera. */
export function scaleOf(scene: SceneFrame, camera: Camera, viewport: Size): number {
  return coverScale(scene, viewport) * camera.zoom;
}

/** Zoom inside [MIN_ZOOM, maxZoom], centre such that the viewport stays inside the room. */
export function clampCamera(scene: SceneFrame, camera: Camera, viewport: Size): Camera {
  const zoom = clamp(camera.zoom, MIN_ZOOM, maxZoom(scene, viewport));
  const scale = coverScale(scene, viewport) * zoom;
  const halfW = Math.min(viewport.width / (2 * scale), scene.width / 2);
  const halfH = Math.min(viewport.height / (2 * scale), scene.height / 2);
  return {
    x: clamp(camera.x, halfW, scene.width - halfW),
    y: clamp(camera.y, halfH, scene.height - halfH),
    zoom,
  };
}

/** The world element's CSS transform: `translate(tx, ty) scale(scale)` with origin 0 0. */
export function worldTransform(scene: SceneFrame, camera: Camera, viewport: Size) {
  const scale = scaleOf(scene, camera, viewport);
  return {
    tx: viewport.width / 2 - camera.x * scale,
    ty: viewport.height / 2 - camera.y * scale,
    scale,
  };
}

/** The part of the room on screen, in su. */
export function visibleRect(scene: SceneFrame, camera: Camera, viewport: Size): Rect {
  const scale = scaleOf(scene, camera, viewport);
  const w = viewport.width / scale;
  const h = viewport.height / scale;
  return { x: camera.x - w / 2, y: camera.y - h / 2, w, h };
}

/** A pointer's client coordinates, relative to the viewport's top-left corner. */
export function clientToViewport(clientX: number, clientY: number, rect: { left: number; top: number }): Point {
  return { x: clientX - rect.left, y: clientY - rect.top };
}

/** Viewport px → scene su (the inverse of the camera transform). */
export function viewportToScene(scene: SceneFrame, point: Point, camera: Camera, viewport: Size): Point {
  const scale = scaleOf(scene, camera, viewport);
  return {
    x: camera.x + (point.x - viewport.width / 2) / scale,
    y: camera.y + (point.y - viewport.height / 2) / scale,
  };
}

/** Scene su → viewport px. */
export function sceneToViewport(scene: SceneFrame, point: Point, camera: Camera, viewport: Size): Point {
  const scale = scaleOf(scene, camera, viewport);
  return {
    x: (point.x - camera.x) * scale + viewport.width / 2,
    y: (point.y - camera.y) * scale + viewport.height / 2,
  };
}

/** Drag: the room follows the pointer 1:1 (dx, dy in screen px). */
export function panBy(scene: SceneFrame, camera: Camera, dx: number, dy: number, viewport: Size): Camera {
  const scale = scaleOf(scene, camera, viewport);
  return clampCamera(scene, { x: camera.x - dx / scale, y: camera.y - dy / scale, zoom: camera.zoom }, viewport);
}

/**
 * Focal zoom: the scene point under `focal` (viewport px) stays under it, unless
 * the room's edge would come into view — then the clamp wins.
 */
export function zoomAt(scene: SceneFrame, camera: Camera, factor: number, focal: Point, viewport: Size): Camera {
  const anchor = viewportToScene(scene, focal, camera, viewport);
  const zoom = clamp(camera.zoom * factor, MIN_ZOOM, maxZoom(scene, viewport));
  const scale = coverScale(scene, viewport) * zoom;
  return clampCamera(
    scene,
    {
      x: anchor.x - (focal.x - viewport.width / 2) / scale,
      y: anchor.y - (focal.y - viewport.height / 2) / scale,
      zoom,
    },
    viewport,
  );
}

export interface PinchFrame {
  centroid: Point;
  distance: number;
}

/**
 * Two fingers: zoom by the ratio of their distances, anchored at the scene point
 * that was under their centroid when the pinch began, which then follows the
 * centroid (pinch and pan in one gesture).
 */
export function pinchCamera(scene: SceneFrame, startCamera: Camera, start: PinchFrame, current: PinchFrame, viewport: Size): Camera {
  const anchor = viewportToScene(scene, start.centroid, startCamera, viewport);
  const ratio = start.distance > 0 ? current.distance / start.distance : 1;
  const zoom = clamp(startCamera.zoom * ratio, MIN_ZOOM, maxZoom(scene, viewport));
  const scale = coverScale(scene, viewport) * zoom;
  return clampCamera(
    scene,
    {
      x: anchor.x - (current.centroid.x - viewport.width / 2) / scale,
      y: anchor.y - (current.centroid.y - viewport.height / 2) / scale,
      zoom,
    },
    viewport,
  );
}

export function stationById(scene: SceneFrame, id: StationId): SceneStation {
  const station = scene.stations.find((candidate) => candidate.id === id);
  if (!station) throw new Error(`Unknown station ${id}`);
  return station;
}

/** A station shortcut: its centre at cover zoom (clamped to the room). */
export function stationCamera(scene: SceneFrame, id: StationId, viewport: Size): Camera {
  const { center } = stationById(scene, id);
  return clampCamera(scene, { x: center.x, y: center.y, zoom: DEFAULT_ZOOM }, viewport);
}

/** Where every exploration of the room opens. */
export function initialCamera(scene: SceneFrame, viewport: Size): Camera {
  return stationCamera(scene, scene.initialStation, viewport);
}

/** "Você está em …": the station whose span holds the centre of the view. */
export function nearestStation(scene: SceneFrame, camera: Camera): StationId {
  const inside = scene.stations.find((station) => camera.x >= station.span.x0 && camera.x < station.span.x1);
  return (inside ?? scene.stations[scene.stations.length - 1]).id;
}

/** Recentre: cover zoom, centred on the station nearest to where the Explorador is. */
export function recenterCamera(scene: SceneFrame, camera: Camera, viewport: Size): Camera {
  return stationCamera(scene, nearestStation(scene, camera), viewport);
}

/** Whether a scene circle is entirely on screen. */
export function circleVisible(scene: SceneFrame, center: Point, radius: number, camera: Camera, viewport: Size): boolean {
  const view = visibleRect(scene, camera, viewport);
  return (
    center.x - radius >= view.x &&
    center.x + radius <= view.x + view.w &&
    center.y - radius >= view.y &&
    center.y + radius <= view.y + view.h
  );
}

/**
 * Bring a scene circle on screen: keep the current zoom when the circle fits
 * (zooming out only as far as needed), centre on it, clamp to the room.
 */
export function frameCircle(scene: SceneFrame, center: Point, radius: number, camera: Camera, viewport: Size, margin = 1.15): Camera {
  const cover = coverScale(scene, viewport);
  const fitScale = Math.min(viewport.width, viewport.height) / (2 * radius * margin);
  const zoom = Math.min(camera.zoom, fitScale / cover);
  return clampCamera(scene, { x: center.x, y: center.y, zoom }, viewport);
}

/** "Mostrar onde está": the object's longer side fills REVEAL_FILL of the viewport's short side. */
export function revealCamera(scene: SceneFrame, bounds: Rect, viewport: Size): Camera {
  const cover = coverScale(scene, viewport);
  const targetScale = (REVEAL_FILL * Math.min(viewport.width, viewport.height)) / Math.max(bounds.w, bounds.h);
  return clampCamera(
    scene,
    { x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2, zoom: targetScale / cover },
    viewport,
  );
}

/** Ease in and out (glides). */
export function easeInOut(t: number): number {
  const u = clamp(t, 0, 1);
  return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
}

/** Linear blend of two cameras: the glide's frame at progress `t` (already eased). */
export function interpolateCamera(from: Camera, to: Camera, t: number): Camera {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    zoom: from.zoom + (to.zoom - from.zoom) * t,
  };
}

/**
 * A parallax layer's offset from the plate, in su: it drifts by (factor − 1) of
 * the camera's travel from the room's centre. 0 under reduced motion.
 */
export function parallaxOffset(scene: SceneFrame, camera: Camera, factor: number, reducedMotion: boolean): Point {
  if (reducedMotion || factor === 1) return { x: 0, y: 0 };
  return {
    x: (1 - factor) * (camera.x - scene.width / 2),
    y: (1 - factor) * (camera.y - scene.height / 2),
  };
}

/** The largest offset a parallax layer can reach, over every camera the clamp allows. */
export function maxParallaxOffset(scene: SceneFrame, factor: number): Point {
  return {
    x: Math.abs(1 - factor) * (scene.width / 2),
    y: Math.abs(1 - factor) * (scene.height / 2),
  };
}

/** WheelEvent → zoom factor. deltaMode 1 = lines (×16 px), 2 = pages (× viewport height). */
export function wheelZoomFactor(deltaY: number, deltaMode: number, ctrlKey: boolean, viewportHeight: number): number {
  const pixels = deltaMode === 1 ? deltaY * 16 : deltaMode === 2 ? deltaY * viewportHeight : deltaY;
  const divisor = ctrlKey ? PINCH_WHEEL_ZOOM_DIVISOR : WHEEL_ZOOM_DIVISOR;
  return clamp(Math.pow(2, -pixels / divisor), WHEEL_STEP_MIN, WHEEL_STEP_MAX);
}

/** Keep the same scene point centred and the same zoom relative to cover across a resize. */
export function resizeCamera(scene: SceneFrame, camera: Camera, next: Size): Camera {
  return clampCamera(scene, camera, next);
}
