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
import {
  SCENE_HEIGHT,
  SCENE_LAYERS,
  SCENE_WIDTH,
  type TargetId,
} from "@/games/hidden-objects/hidden-objects-scene";

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/** Feedback the scene paints in room coordinates (it zooms and pans with the room). */
export interface SceneFeedback {
  found: readonly TargetId[];
  /** The newest find gets one soft "breath"; repeats are told apart by `seq`. */
  latestFound: { id: TargetId; seq: number } | null;
  /** A target tapped again: its seal pulses once. */
  again: { id: TargetId; seq: number } | null;
  /** A free tap: a small ripple where it landed. */
  ripple: { x: number; y: number; seq: number } | null;
  /** Hint 2 pool of light, or the "Mostrar onde está" halo. */
  halo: (HintHalo & { kind: "hint" | "reveal"; seq: number }) | null;
}

interface HiddenObjectsSceneProps {
  controllerRef: MutableRefObject<HiddenObjectsSceneController | null>;
  viewportRef: MutableRefObject<HTMLDivElement | null>;
  feedback: SceneFeedback;
  view: CameraView | null;
  interactive: boolean;
  instructionsId: string;
  onTap: (tap: SceneTap) => void;
  onSettle: (view: CameraView) => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

const ESSENTIAL_LAYERS = SCENE_LAYERS.map((layer) => layer.id);

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
    this.callbacks.onError?.(new Error(`Failed to load essential Estúdio asset: ${src}`));
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
 * The room: a focusable viewport (the only gesture surface) over a 3200×1600
 * world element holding the back / plate / front layers and the feedback
 * layer. The camera never goes through React: the controller writes the
 * world's transform itself.
 */
export function HiddenObjectsScene({
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
}: HiddenObjectsSceneProps) {
  const worldRef = useRef<HTMLDivElement>(null);
  const layerRefs = useRef<Partial<Record<string, HTMLImageElement | null>>>({});
  const callbacks = useRef({ onTap, onSettle });
  const [readiness] = useState(() => new SceneReadiness(ESSENTIAL_LAYERS));

  useEffect(() => {
    callbacks.current = { onTap, onSettle };
    readiness.setCallbacks({ onReady, onError });
  }, [onTap, onSettle, onReady, onError, readiness]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const world = worldRef.current;
    if (!viewport || !world) return;
    const motion = window.matchMedia(REDUCED_MOTION_QUERY);
    const controller = new HiddenObjectsSceneController({
      viewport,
      world,
      parallax: SCENE_LAYERS.filter((layer) => layer.parallax !== 1).flatMap((layer) => {
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
  }, [controllerRef, readiness, viewportRef]);

  const handleLoaded = (id: string, src: string, image: HTMLImageElement) => {
    image
      .decode()
      .then(() => readiness.layerDecoded(id))
      .catch(() => readiness.layerFailed(src));
  };

  return (
    <div className="hos-stage" data-interactive={interactive ? "true" : "false"}>
      <div
        ref={viewportRef}
        className="hos-viewport"
        tabIndex={interactive ? 0 : -1}
        role="application"
        aria-roledescription="cena explorável"
        aria-label="Cena do Estúdio das Descobertas"
        aria-describedby={instructionsId}
      >
        <div ref={worldRef} className="hos-world" style={{ width: SCENE_WIDTH, height: SCENE_HEIGHT }}>
          {SCENE_LAYERS.map((layer) => (
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
              style={{ left: layer.rect.x, top: layer.rect.y, width: layer.rect.w, height: layer.rect.h }}
              onLoad={(event) => handleLoaded(layer.id, layer.src, event.currentTarget)}
              onError={() => readiness.layerFailed(layer.src)}
            />
          ))}
          <SceneFeedbackLayer feedback={feedback} />
        </div>
      </div>
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
function SceneFeedbackLayer({ feedback }: { feedback: SceneFeedback }) {
  return (
    <div className="hos-fx" aria-hidden="true">
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
        const bounds = regionBounds(targetById(id).region);
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
            <span
              key={again ? `seal-${feedback.again?.seq}` : "seal"}
              className="hos-found-seal"
              data-again={again ? "true" : undefined}
            >
              <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
                <path d="M5 12.5 10 17.5 19 7" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
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
