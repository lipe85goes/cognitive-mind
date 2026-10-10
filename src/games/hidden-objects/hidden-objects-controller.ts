import {
  CAMERA_GLIDE_MS,
  KEY_PAN_FRACTION,
  KEY_PAN_FRACTION_FAST,
  MIN_ZOOM,
  ZOOM_STEP,
  circleVisible,
  clampCamera,
  easeInOut,
  frameCircle,
  initialCamera,
  interpolateCamera,
  maxZoom,
  nearestStation,
  panBy,
  parallaxOffset,
  pinchCamera,
  recenterCamera,
  resizeCamera,
  revealCamera,
  scaleOf,
  stationCamera,
  viewportToScene,
  wheelZoomFactor,
  worldTransform,
  zoomAt,
  type Camera,
  type PinchFrame,
  type Point,
  type Rect,
  type SceneFrame,
  type Size,
} from "@/games/hidden-objects/hidden-objects-camera";
import {
  IDLE_GESTURE,
  pointerCancel,
  pointerDown,
  pointerMove,
  pointerUp,
  type GestureEffect,
  type GestureStep,
  type PointerSample,
} from "@/games/hidden-objects/hidden-objects-gesture";
import type { StationId } from "@/games/hidden-objects/hidden-objects-scene";

/**
 * Binds the scene's DOM to the camera — without React.
 *
 * Every pointer, wheel and key event on the viewport goes through the gesture
 * recogniser and the camera math; the camera lives in this object and reaches
 * the screen only as a CSS transform written inside requestAnimationFrame (at
 * most one write per frame, no frame loop while nothing moves). React hears
 * from it only at discrete moments: a tap (`onTap`) and a settled view
 * (`onSettle`, deduplicated) — never once per pointermove.
 */

export interface SceneTap {
  /** Scene point (su) under the pointer when it went down (or the reticle). */
  point: Point;
  pointerType: string;
  /** px per su at the time of the tap (converts the tolerance). */
  scale: number;
}

export interface CameraView {
  station: StationId;
  canZoomIn: boolean;
  canZoomOut: boolean;
}

export interface ControllerHost {
  requestAnimationFrame(callback: (time: number) => void): number;
  cancelAnimationFrame(id: number): void;
  setTimeout(callback: () => void, ms: number): number;
  clearTimeout(id: number): void;
  now(): number;
}

interface ResizeObserverLike {
  observe(target: Element): void;
  disconnect(): void;
}

export interface SceneControllerOptions {
  /** The room the camera moves through (its size and stations). */
  scene: SceneFrame;
  viewport: HTMLElement;
  world: HTMLElement;
  parallax: readonly { element: HTMLElement; factor: number }[];
  isReducedMotion: () => boolean;
  onTap: (tap: SceneTap) => void;
  onSettle: (view: CameraView) => void;
  host?: ControllerHost;
  createResizeObserver?: (callback: () => void) => ResizeObserverLike | null;
}

/** Wheel events come in bursts: the view counts as settled this long after the last one. */
export const WHEEL_SETTLE_MS = 160;

const browserHost = (): ControllerHost => ({
  requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
  cancelAnimationFrame: (id) => window.cancelAnimationFrame(id),
  setTimeout: (callback, ms) => window.setTimeout(callback, ms),
  clearTimeout: (id) => window.clearTimeout(id),
  now: () => performance.now(),
});

const browserResizeObserver = (callback: () => void): ResizeObserverLike | null =>
  typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => callback());

export class HiddenObjectsSceneController {
  private readonly options: SceneControllerOptions;
  private readonly scene: SceneFrame;
  private readonly host: ControllerHost;
  private size: Size = { width: 0, height: 0 };
  private origin = { left: 0, top: 0 };
  private camera: Camera = { x: 0, y: 0, zoom: MIN_ZOOM };
  private gesture = IDLE_GESTURE;
  private pinchStart: { camera: Camera; frame: PinchFrame } | null = null;
  private glide: { from: Camera; to: Camera; start: number } | null = null;
  private frame = 0;
  private wheelTimer = 0;
  private moving = false;
  private lastView = "";
  private readonly captured = new Set<number>();
  private observer: ResizeObserverLike | null = null;
  private destroyed = false;

  constructor(options: SceneControllerOptions) {
    this.options = options;
    this.scene = options.scene;
    this.host = options.host ?? browserHost();
  }

  attach(): void {
    const { viewport } = this.options;
    viewport.addEventListener("pointerdown", this.handlePointerDown);
    viewport.addEventListener("pointermove", this.handlePointerMove);
    viewport.addEventListener("pointerup", this.handlePointerUp);
    viewport.addEventListener("pointercancel", this.handlePointerCancel);
    viewport.addEventListener("lostpointercapture", this.handlePointerCancel);
    viewport.addEventListener("wheel", this.handleWheel, { passive: false });
    viewport.addEventListener("keydown", this.handleKeyDown);
    this.measure();
    this.camera = initialCamera(this.scene, this.size);
    this.observer = (this.options.createResizeObserver ?? browserResizeObserver)(this.handleResize);
    this.observer?.observe(viewport);
    this.render();
    this.notifySettle();
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    const { viewport } = this.options;
    viewport.removeEventListener("pointerdown", this.handlePointerDown);
    viewport.removeEventListener("pointermove", this.handlePointerMove);
    viewport.removeEventListener("pointerup", this.handlePointerUp);
    viewport.removeEventListener("pointercancel", this.handlePointerCancel);
    viewport.removeEventListener("lostpointercapture", this.handlePointerCancel);
    viewport.removeEventListener("wheel", this.handleWheel);
    viewport.removeEventListener("keydown", this.handleKeyDown);
    if (this.frame) this.host.cancelAnimationFrame(this.frame);
    if (this.wheelTimer) this.host.clearTimeout(this.wheelTimer);
    this.frame = 0;
    this.wheelTimer = 0;
    this.glide = null;
    this.observer?.disconnect();
    this.observer = null;
    for (const id of this.captured) {
      try {
        viewport.releasePointerCapture(id);
      } catch {
        // already released
      }
    }
    this.captured.clear();
  }

  // --- commands (HUD buttons) ------------------------------------------------------------------------

  getCamera(): Camera {
    return this.camera;
  }

  getViewportSize(): Size {
    return this.size;
  }

  /** A new round: back to the table, no glide. */
  reset(): void {
    this.glide = null;
    this.gesture = IDLE_GESTURE;
    this.pinchStart = null;
    this.moving = false;
    this.camera = initialCamera(this.scene, this.size);
    this.requestRender();
    this.notifySettle();
  }

  zoomBy(factor: number): void {
    this.stopGlide();
    this.camera = zoomAt(this.scene, this.camera, factor, { x: this.size.width / 2, y: this.size.height / 2 }, this.size);
    this.requestRender();
    this.notifySettle();
  }

  goToStation(id: StationId): void {
    this.glideTo(stationCamera(this.scene, id, this.size));
  }

  recenter(): void {
    this.glideTo(recenterCamera(this.scene, this.camera, this.size));
  }

  /** Hint 2: bring the halo on screen only if it is not already. */
  showCircle(center: Point, radius: number): void {
    if (circleVisible(this.scene, center, radius, this.camera, this.size)) return;
    this.glideTo(frameCircle(this.scene, center, radius, this.camera, this.size));
  }

  /** "Mostrar onde está". */
  reveal(bounds: Rect): void {
    this.glideTo(revealCamera(this.scene, bounds, this.size));
  }

  /** The keyboard reticle: a tap at the centre of the view. */
  tapAtCenter(): void {
    this.stopGlide();
    this.emitTap({ x: this.size.width / 2, y: this.size.height / 2 }, "keyboard");
  }

  // --- rendering -------------------------------------------------------------------------------------

  private requestRender(): void {
    if (this.destroyed || this.frame) return;
    this.frame = this.host.requestAnimationFrame(this.handleFrame);
  }

  private readonly handleFrame = (): void => {
    this.frame = 0;
    if (this.destroyed) return;
    if (this.glide) {
      const progress = (this.host.now() - this.glide.start) / CAMERA_GLIDE_MS;
      this.camera = interpolateCamera(this.glide.from, this.glide.to, easeInOut(progress));
      if (progress >= 1) {
        this.camera = this.glide.to;
        this.glide = null;
        this.moving = false;
        this.notifySettle();
      } else {
        this.requestRender();
      }
    }
    this.render();
  };

  /** The only place the camera reaches the DOM. */
  private render(): void {
    const { world, parallax, isReducedMotion } = this.options;
    const { tx, ty, scale } = worldTransform(this.scene, this.camera, this.size);
    world.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`;
    world.style.setProperty("--hos-scale", String(scale));
    if (this.moving) world.dataset.moving = "true";
    else delete world.dataset.moving;
    const reduced = isReducedMotion();
    for (const layer of parallax) {
      const offset = parallaxOffset(this.scene, this.camera, layer.factor, reduced);
      layer.element.style.transform = `translate3d(${offset.x}px, ${offset.y}px, 0)`;
    }
  }

  private notifySettle(): void {
    if (this.destroyed) return;
    const view: CameraView = {
      station: nearestStation(this.scene, this.camera),
      canZoomIn: this.camera.zoom < maxZoom(this.scene, this.size) - 1e-3,
      canZoomOut: this.camera.zoom > MIN_ZOOM + 1e-3,
    };
    const key = `${view.station}|${view.canZoomIn}|${view.canZoomOut}`;
    if (key === this.lastView) return;
    this.lastView = key;
    this.options.onSettle(view);
  }

  private glideTo(target: Camera): void {
    const to = clampCamera(this.scene, target, this.size);
    if (this.options.isReducedMotion()) {
      this.glide = null;
      this.camera = to;
      this.moving = false;
      this.requestRender();
      this.notifySettle();
      return;
    }
    this.glide = { from: this.camera, to, start: this.host.now() };
    this.moving = true;
    this.requestRender();
  }

  private stopGlide(): boolean {
    if (!this.glide) return false;
    this.glide = null;
    this.moving = false;
    return true;
  }

  // --- input -----------------------------------------------------------------------------------------

  private measure(): void {
    const rect = this.options.viewport.getBoundingClientRect();
    this.origin = { left: rect.left, top: rect.top };
    this.size = { width: rect.width, height: rect.height };
  }

  private readonly handleResize = (): void => {
    if (this.destroyed) return;
    const before = this.size;
    this.measure();
    if (before.width === this.size.width && before.height === this.size.height) return;
    this.camera = resizeCamera(this.scene, this.camera, this.size);
    if (this.glide) this.glide = { ...this.glide, to: clampCamera(this.scene, this.glide.to, this.size) };
    this.requestRender();
    this.notifySettle();
  };

  private sample(event: PointerEvent): PointerSample {
    return {
      id: event.pointerId,
      x: event.clientX - this.origin.left,
      y: event.clientY - this.origin.top,
      t: this.host.now(),
      pointerType: event.pointerType,
      button: event.button,
    };
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (this.gesture.phase === "idle") {
      // A fresh gesture: the viewport may have moved since the last one (scroll, resize).
      const rect = this.options.viewport.getBoundingClientRect();
      this.origin = { left: rect.left, top: rect.top };
    }
    const step = pointerDown(this.gesture, this.sample(event), this.glide !== null);
    if (step.state === this.gesture) return;
    // The press that catches a gliding camera stops it (and can never be a tap).
    this.stopGlide();
    if (step.capture !== undefined) {
      try {
        this.options.viewport.setPointerCapture(step.capture);
        this.captured.add(step.capture);
      } catch {
        // capture is an optimisation: without it, moves outside still end in pointerup/cancel
      }
    }
    this.apply(step);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.gesture.phase === "idle") return;
    this.apply(pointerMove(this.gesture, this.sample(event)));
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    this.release(event.pointerId);
    this.apply(pointerUp(this.gesture, this.sample(event)));
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    this.release(event.pointerId);
    this.apply(pointerCancel(this.gesture, { id: event.pointerId }));
  };

  private release(id: number): void {
    if (!this.captured.delete(id)) return;
    try {
      this.options.viewport.releasePointerCapture(id);
    } catch {
      // already released by the browser
    }
  }

  private apply(step: GestureStep): void {
    this.gesture = step.state;
    for (const effect of step.effects) this.applyEffect(effect);
  }

  private applyEffect(effect: GestureEffect): void {
    switch (effect.kind) {
      case "pan":
        this.camera = panBy(this.scene, this.camera, effect.dx, effect.dy, this.size);
        this.moving = true;
        this.requestRender();
        return;
      case "pinch-start":
        this.pinchStart = { camera: this.camera, frame: { centroid: effect.centroid, distance: effect.distance } };
        this.moving = true;
        return;
      case "pinch":
        if (!this.pinchStart) return;
        this.camera = pinchCamera(this.scene, this.pinchStart.camera, this.pinchStart.frame, effect, this.size);
        this.requestRender();
        return;
      case "pinch-end":
        this.pinchStart = null;
        return;
      case "tap":
        this.emitTap({ x: effect.x, y: effect.y }, effect.pointerType);
        return;
      case "end":
        this.pinchStart = null;
        this.moving = false;
        this.requestRender();
        this.notifySettle();
        return;
    }
  }

  private emitTap(point: Point, pointerType: string): void {
    this.options.onTap({
      point: viewportToScene(this.scene, point, this.camera, this.size),
      pointerType,
      scale: scaleOf(this.scene, this.camera, this.size),
    });
  }

  private readonly handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.stopGlide();
    const factor = wheelZoomFactor(event.deltaY, event.deltaMode, event.ctrlKey, this.size.height);
    const rect = this.options.viewport.getBoundingClientRect();
    this.origin = { left: rect.left, top: rect.top };
    const focal = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    this.camera = zoomAt(this.scene, this.camera, factor, focal, this.size);
    this.moving = true;
    this.requestRender();
    if (this.wheelTimer) this.host.clearTimeout(this.wheelTimer);
    this.wheelTimer = this.host.setTimeout(() => {
      this.wheelTimer = 0;
      this.moving = false;
      this.requestRender();
      this.notifySettle();
    }, WHEEL_SETTLE_MS);
  };

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const fraction = event.shiftKey ? KEY_PAN_FRACTION_FAST : KEY_PAN_FRACTION;
    const panKeys: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    // 1, 2, 3…: the room's stations, left to right
    const station = /^[1-9]$/.test(event.key) ? this.scene.stations[Number(event.key) - 1] : undefined;
    if (event.key in panKeys) {
      const [dx, dy] = panKeys[event.key];
      this.stopGlide();
      // Look further right = the room moves left under the view.
      this.camera = panBy(this.scene, this.camera, -dx * fraction * this.size.width, -dy * fraction * this.size.height, this.size);
      this.requestRender();
      this.notifySettle();
    } else if (event.key === "+" || event.key === "=") {
      this.zoomBy(ZOOM_STEP);
    } else if (event.key === "-" || event.key === "_") {
      this.zoomBy(1 / ZOOM_STEP);
    } else if (station) {
      this.goToStation(station.id);
    } else if (event.key === "0") {
      this.recenter();
    } else if (event.key === "Enter" || event.key === " ") {
      this.tapAtCenter();
    } else {
      return;
    }
    event.preventDefault();
  };
}
