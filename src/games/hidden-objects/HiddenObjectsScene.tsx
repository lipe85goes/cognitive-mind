"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type CSSProperties, type MutableRefObject } from "react";
import { Crosshair, LocateFixed, Minus, Plus } from "lucide-react";
import { ZOOM_STEP } from "@/games/hidden-objects/hidden-objects-camera";
import {
  HiddenObjectsSceneController,
  type CameraView,
  type SceneTap,
} from "@/games/hidden-objects/hidden-objects-controller";
import {
  regionBounds,
  targetById,
  type HintHalo,
} from "@/games/hidden-objects/hidden-objects-model";
import type { SceneDefinition, TargetId } from "@/games/hidden-objects/hidden-objects-scene";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Feedback the scene paints in room coordinates (it zooms and pans with the room). */
export interface SceneFeedback {
  found: readonly TargetId[];
  /**
   * The newest find gets one soft "breath", a ring that closes around it and its
   * name on a small tag for a moment (in Difícil, the first time the name is
   * shown); repeats are told apart by `seq`.
   */
  latestFound: { id: TargetId; seq: number; label: string } | null;
  /** A target tapped again: its seal pulses once. */
  again: { id: TargetId; seq: number } | null;
  /** A free tap: a small ripple where it landed. */
  ripple: { x: number; y: number; seq: number } | null;
  /** Hint 2 pool of light, or the "Mostrar onde está" halo. */
  halo: (HintHalo & { kind: "hint" | "reveal"; seq: number }) | null;
}

/** How the room's essential art is doing: painted, still on its way, or unable to load. */
export type SceneLoadState = "loading" | "ready" | "failed";

interface HiddenObjectsSceneProps {
  /** The room on screen (a new room is a new mount: its own controller and readiness). */
  scene: SceneDefinition;
  controllerRef: MutableRefObject<HiddenObjectsSceneController | null>;
  viewportRef: MutableRefObject<HTMLDivElement | null>;
  feedback: SceneFeedback;
  view: CameraView | null;
  interactive: boolean;
  instructionsId: string;
  onTap: (tap: SceneTap) => void;
  onSettle: (view: CameraView) => void;
  /** The shell's entry callbacks (GameComponentProps): the room reports to them exactly as it always did. */
  onReady?: () => void;
  onError?: (error: Error) => void;
  /** The same two moments, for the game's own setup card (a room chosen after the entry has no transition to cover it). */
  onLoad?: (state: SceneLoadState) => void;
}

interface ReadinessCallbacks {
  onReady?: () => void;
  onError?: (error: Error) => void;
}

/**
 * When the scene may report ready: every essential layer loaded AND decoded,
 * the controller attached (the viewport is laid out and the camera written),
 * then two animation frames — one paint opportunity — before `onReady`. A layer
 * that fails reports `onError` once instead, so the watchdog never has to wait.
 */
export class SceneReadiness {
  private readonly decoded = new Set<string>();
  private readonly frames: number[] = [];
  private callbacks: ReadinessCallbacks = {};
  private attached = false;
  private done = false;

  constructor(
    private readonly essentials: readonly string[],
    private readonly raf: (callback: () => void) => number = (callback) => window.requestAnimationFrame(callback),
    private readonly cancelRaf: (id: number) => void = (id) => window.cancelAnimationFrame(id),
  ) {}

  /** The shell's latest callbacks (they may change identity between renders). */
  setCallbacks(callbacks: ReadinessCallbacks): void {
    this.callbacks = callbacks;
  }

  layerDecoded(id: string): void {
    this.decoded.add(id);
    this.check();
  }

  layerFailed(src: string): void {
    if (this.done) return;
    this.done = true;
    this.callbacks.onError?.(new Error(`Failed to load essential scene asset: ${src}`));
  }

  attach(): void {
    this.attached = true;
    this.check();
  }

  detach(): void {
    this.attached = false;
    for (const id of this.frames.splice(0)) this.cancelRaf(id);
  }

  private check(): void {
    if (this.done || !this.attached) return;
    if (!this.essentials.every((id) => this.decoded.has(id))) return;
    if (this.frames.length > 0) return;
    this.frames.push(
      this.raf(() => {
        this.frames.push(
          this.raf(() => {
            if (this.done || !this.attached) return;
            this.done = true;
            this.callbacks.onReady?.();
          }),
        );
      }),
    );
  }
}

/**
 * The room: a focusable viewport (the only gesture surface) over a world
 * element the size of the room (in su) holding its layers, back to front, and
 * the feedback layer. The camera never goes through React: the controller
 * writes the world's transform itself.
 */
export function HiddenObjectsScene({
  scene,
  controllerRef,
  viewportRef,
  feedback,
  view,
  interactive,
  instructionsId,
  onTap,
  onSettle,
  onReady,
  onError,
  onLoad,
}: HiddenObjectsSceneProps) {
  const worldRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<Partial<Record<string, HTMLImageElement | null>>>({});
  const callbacks = useRef({ onTap, onSettle });
  // A room's layers are fixed for the life of this mount (the game remounts the scene for another room).
  const [readiness] = useState(() => new SceneReadiness(scene.layers.map((layer) => layer.id)));
  const [room] = useState(() => scene);

  useEffect(() => {
    callbacks.current = { onTap, onSettle };
    readiness.setCallbacks({
      onReady: () => {
        onReady?.();
        onLoad?.("ready");
      },
      onError: (error) => {
        onError?.(error);
        onLoad?.("failed");
      },
    });
  }, [onTap, onSettle, onReady, onError, onLoad, readiness]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const world = worldRef.current;
    if (!viewport || !world) return;
    const motion = window.matchMedia(REDUCED_MOTION_QUERY);
    const controller = new HiddenObjectsSceneController({
      scene: room,
      viewport,
      world,
      parallax: room.layers.filter((layer) => layer.parallax !== 1).flatMap((layer) => {
        const element = layerRefs.current[layer.id];
        return element ? [{ element, factor: layer.parallax }] : [];
      }),
      isReducedMotion: () => motion.matches,
      onTap: (tap) => callbacks.current.onTap(tap),
      onSettle: (next) => callbacks.current.onSettle(next),
    });
    controller.attach();
    controllerRef.current = controller;
    readiness.attach();

    return () => {
      readiness.detach();
      controller.destroy();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [controllerRef, readiness, room, viewportRef]);

  const handleLoaded = (id: string, src: string, image: HTMLImageElement) => {
    image
      .decode()
      .then(() => readiness.layerDecoded(id))
      .catch(() => readiness.layerFailed(src));
  };

  return (
    <div
      className="hos-stage"
      data-interactive={interactive ? "true" : "false"}
      data-scene={room.id}
      style={{ background: room.backdrop }}
    >
      <div
        ref={viewportRef}
        className="hos-viewport"
        tabIndex={interactive ? 0 : -1}
        role="application"
        aria-roledescription="cena explorável"
        aria-label={room.copy.viewportLabel}
        aria-describedby={instructionsId}
      >
        <div ref={worldRef} className="hos-world" style={{ width: room.width, height: room.height }}>
          {room.layers.map((layer, depth) => (
            <Image
              key={layer.id}
              ref={(element) => {
                layerRefs.current[layer.id] = element;
              }}
              src={layer.src}
              alt=""
              width={layer.rect.w}
              height={layer.rect.h}
              unoptimized
              loading="eager"
              fetchPriority={layer.id === "plate" ? "high" : "auto"}
              draggable={false}
              className={`hos-layer hos-layer-${layer.id}`}
              style={{ left: layer.rect.x, top: layer.rect.y, width: layer.rect.w, height: layer.rect.h, zIndex: depth }}
              onLoad={(event) => handleLoaded(layer.id, layer.src, event.currentTarget)}
              onError={() => readiness.layerFailed(layer.src)}
            />
          ))}
          <SceneFeedbackLayer scene={room} feedback={feedback} />
        </div>
      </div>
      {/* A lens vignette fixed to the view, not the room: depth without touching the room's coordinates. */}
      <span className="hos-vignette" aria-hidden="true" />
      <span className="hos-reticle" aria-hidden="true">
        <Crosshair size={34} strokeWidth={1.6} />
      </span>
      <div className="hos-zoom" role="group" aria-label="Câmera">
        <button
          type="button"
          className="hos-round-button"
          onClick={() => controllerRef.current?.zoomBy(ZOOM_STEP)}
          disabled={!interactive || view?.canZoomIn === false}
          aria-label="Aproximar"
        >
          <Plus size={22} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="hos-round-button"
          onClick={() => controllerRef.current?.zoomBy(1 / ZOOM_STEP)}
          disabled={!interactive || view?.canZoomOut === false}
          aria-label="Afastar"
        >
          <Minus size={22} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="hos-round-button"
          onClick={() => controllerRef.current?.recenter()}
          disabled={!interactive}
          aria-label="Recentrar"
        >
          <LocateFixed size={21} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/** Everything here is pointer-events: none — the viewport hit-tests geometry, not DOM. */
function SceneFeedbackLayer({ scene, feedback }: { scene: SceneDefinition; feedback: SceneFeedback }) {
  return (
    // above every layer of the room, whatever its depth
    <div className="hos-fx" aria-hidden="true" style={{ zIndex: scene.layers.length }}>
      {feedback.halo && (
        <span
          key={`halo-${feedback.halo.seq}`}
          className={`hos-halo hos-halo-${feedback.halo.kind}`}
          style={
            {
              "--hos-halo-x": `${feedback.halo.cx}px`,
              "--hos-halo-y": `${feedback.halo.cy}px`,
              "--hos-halo-r": `${feedback.halo.r}px`,
            } as CSSProperties
          }
        />
      )}
      {feedback.found.map((id) => {
        const bounds = regionBounds(targetById(scene, id).region);
        const fresh = feedback.latestFound?.id === id;
        const again = feedback.again?.id === id;
        return (
          <span
            key={id}
            className="hos-found"
            data-target={id}
            data-fresh={fresh ? "true" : undefined}
            style={{ left: bounds.x, top: bounds.y, width: bounds.w, height: bounds.h }}
          >
            <span key={fresh ? `glow-${feedback.latestFound?.seq}` : "glow"} className="hos-found-glow" />
            {fresh && <span key={`ring-${feedback.latestFound?.seq}`} className="hos-found-ring" />}
            <span
              key={again ? `seal-${feedback.again?.seq}` : "seal"}
              className="hos-found-seal"
              data-again={again ? "true" : undefined}
            >
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                <path d="M5 12.5 10 17.5 19 7" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            {fresh && (
              <span key={`tag-${feedback.latestFound?.seq}`} className="hos-found-tag">
                {feedback.latestFound?.label}
              </span>
            )}
          </span>
        );
      })}
      {feedback.ripple && (
        <span
          key={`ripple-${feedback.ripple.seq}`}
          className="hos-ripple"
          style={{ left: feedback.ripple.x, top: feedback.ripple.y }}
        />
      )}
    </div>
  );
}
