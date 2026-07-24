"use client";

import Image from "next/image";
import { useEffect, useRef, type CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import { getWorldVisual } from "@/components/worlds/worldVisuals";
import { WorldMasterScene } from "@/components/worlds/master-scene/WorldMasterScene";
import { hasWorldMasterScene } from "@/components/worlds/master-scene/worldMasterSceneConfig";
import type { WorldEntryPhase } from "@/components/world-entry/worldEntryTypes";
import type { GameId } from "@/types/game";
import "@/styles/world-transition.css";
import "@/styles/world-entry.css";

interface WorldEntryTransitionProps {
  gameId: GameId;
  phase: WorldEntryPhase;
  onCovered: () => void;
  onDone: () => void;
  onRetry: () => void;
  onBack: () => void;
}

const COVER_DURATION_S = 0.3;
const REVEAL_DURATION_S = 0.46;

/**
 * The "stepping into this world" threshold shown briefly over the
 * dashboard → game cut, tinted in the world's own accent.
 *
 * The Home remains mounted while the threshold covers it. Only after the
 * overlay is opaque does onCovered mount the intro behind it, preventing a
 * page-color flash. Reduced-motion users get the same safe cut without the
 * animated travel.
 */
export function WorldEntryTransition({
  gameId,
  phase,
  onCovered,
  onDone,
  onRetry,
  onBack,
}: WorldEntryTransitionProps) {
  const visual = getWorldVisual(gameId);
  const usesMasterScene = hasWorldMasterScene(gameId);
  /** Dioramas keep their full silhouette; only flat baked art is masked. */
  const worldModeClass = usesMasterScene
    ? "wtx-world-diorama"
    : `wtx-world-${visual.artMode}`;
  const WorldIcon = visual.symbol;
  const reducedMotion = useReducedMotion();
  const retryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!reducedMotion) return;
    if (phase === "covering") onCovered();
    if (phase === "revealing") onDone();
  }, [onCovered, onDone, phase, reducedMotion]);

  useEffect(() => {
    if (phase === "error") {
      retryRef.current?.focus();
    }
  }, [phase]);

  const style = {
    "--wtx-accent": visual.accent,
    "--wtx-accent-soft": visual.accentSoft,
    "--wtx-accent-deep": visual.accentDeep,
    "--wtx-atmosphere": `url(${visual.atmosphere})`,
    "--wms-accent": visual.accent,
    "--wms-accent-soft": visual.accentSoft,
    "--wms-accent-deep": visual.accentDeep,
  } as CSSProperties;

  return (
    <motion.div
      className="wtx-shell wentry-shell"
      data-world={visual.world}
      data-motion={visual.motion}
      data-entry-phase={phase}
      style={style}
      aria-busy={phase === "preparing"}
      initial={reducedMotion || phase !== "covering" ? false : { opacity: 0 }}
      animate={{ opacity: phase === "revealing" ? 0 : 1 }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : {
              duration:
                phase === "covering"
                  ? COVER_DURATION_S
                  : phase === "revealing"
                    ? REVEAL_DURATION_S
                    : 0,
              ease: "easeInOut",
            }
      }
      onAnimationComplete={() => {
        if (reducedMotion) return;
        if (phase === "covering") onCovered();
        if (phase === "revealing") onDone();
      }}
    >
      <span className="wtx-atmosphere" aria-hidden="true" />
      <motion.div
        className={`wtx-world ${worldModeClass}`}
        initial={reducedMotion ? false : { scale: 0.94, y: 10 }}
        animate={reducedMotion ? undefined : { scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="wtx-aura" aria-hidden="true" />
        <span className="wtx-media" aria-hidden="true">
          {hasWorldMasterScene(gameId) ? (
            <WorldMasterScene
              gameId={gameId}
              context="transition"
              state="entering"
              sizes="(max-width: 640px) 92vw, 56rem"
              priority
            />
          ) : (
            <Image
              src={visual.transitionArt}
              alt=""
              fill
              sizes="(max-width: 640px) 92vw, 56rem"
              className="wtx-image"
              priority
            />
          )}
          <span className="wtx-motion-mark" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
        </span>
        <div className="wtx-plaque wms-plate">
          <span className="wtx-emblem" aria-hidden="true">
            <WorldIcon size={28} strokeWidth={2} />
          </span>
          <span>
            <small>{visual.entryEyebrow}</small>
            <strong>{visual.visualName}</strong>
            <span>{visual.entryCopy}</span>
          </span>
        </div>
      </motion.div>

      {phase === "preparing" && (
        <p className="wentry-status" role="status" aria-live="polite">
          Preparando {visual.visualName}...
        </p>
      )}

      {phase === "error" && (
        <div className="wentry-error">
          <section
            className="wentry-error-panel"
            role="alert"
            aria-labelledby="wentry-error-title"
          >
            <h2 id="wentry-error-title">Este mundo precisa de mais um instante</h2>
            <p>
              Não foi possível preparar tudo com segurança. Você pode tentar
              novamente ou voltar aos mundos.
            </p>
            <div className="wentry-error-actions">
              <button
                ref={retryRef}
                type="button"
                className="wms-button-primary"
                onClick={onRetry}
              >
                Tentar novamente
              </button>
              <button
                type="button"
                className="wms-button-secondary"
                onClick={onBack}
              >
                Voltar aos mundos
              </button>
            </div>
          </section>
        </div>
      )}
    </motion.div>
  );
}
