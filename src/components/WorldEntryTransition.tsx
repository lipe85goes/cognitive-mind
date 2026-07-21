"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, type CSSProperties } from "react";
import { motion, useReducedMotion } from "motion/react";
import { getWorldVisual } from "@/components/worlds/worldVisuals";
import { WorldDiorama } from "@/components/worlds/diorama/WorldDiorama";
import { hasWorldDiorama } from "@/components/worlds/diorama/worldDioramaLayout";
import type { GameId } from "@/types/game";
import "@/styles/world-transition.css";

interface WorldEntryTransitionProps {
  gameId: GameId;
  onCovered?: () => void;
  onDone: () => void;
}

const ENTER_DURATION_S = 0.98;
const COVER_DELAY_MS = 230;

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
  onCovered,
  onDone,
}: WorldEntryTransitionProps) {
  const visual = getWorldVisual(gameId);
  const usesDiorama = hasWorldDiorama(gameId);
  /** Dioramas keep their full silhouette; only flat baked art is masked. */
  const worldModeClass = usesDiorama
    ? "wtx-world-diorama"
    : `wtx-world-${visual.artMode}`;
  const WorldIcon = visual.symbol;
  const reducedMotion = useReducedMotion();
  const coveredRef = useRef(false);
  const doneRef = useRef(false);

  const cover = useCallback(() => {
    if (coveredRef.current) return;
    coveredRef.current = true;
    onCovered?.();
  }, [onCovered]);

  const finish = useCallback(() => {
    if (doneRef.current) return;
    cover();
    doneRef.current = true;
    onDone();
  }, [cover, onDone]);

  useEffect(() => {
    const coverId = window.setTimeout(
      cover,
      reducedMotion ? 0 : COVER_DELAY_MS,
    );
    const finishId = window.setTimeout(
      finish,
      reducedMotion ? 100 : (ENTER_DURATION_S + 0.12) * 1000,
    );

    return () => {
      window.clearTimeout(coverId);
      window.clearTimeout(finishId);
    };
  }, [cover, finish, reducedMotion]);

  const style = {
    "--wtx-accent": visual.accent,
    "--wtx-accent-soft": visual.accentSoft,
    "--wtx-accent-deep": visual.accentDeep,
    "--wtx-atmosphere": `url(${visual.atmosphere})`,
  } as CSSProperties;

  return (
    <motion.div
      className="wtx-shell"
      data-world={visual.world}
      data-motion={visual.motion}
      style={style}
      role="status"
      aria-live="polite"
      initial={reducedMotion ? false : { opacity: 0 }}
      animate={reducedMotion ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : {
              duration: ENTER_DURATION_S,
              times: [0, 0.23, 0.7, 1],
              ease: "easeInOut",
            }
      }
      onAnimationComplete={finish}
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
          {usesDiorama ? (
            <WorldDiorama
              gameId={gameId}
              state="entering"
              variant="transition"
              sizes="(max-width: 640px) 92vw, 56rem"
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
        <div className="wtx-plaque">
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
    </motion.div>
  );
}
