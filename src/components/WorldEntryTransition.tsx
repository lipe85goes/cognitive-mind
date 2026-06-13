"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { getWorldMeta } from "@/data/worlds";
import type { GameId } from "@/types/game";

interface WorldEntryTransitionProps {
  gameId: GameId;
  onDone: () => void;
}

const ENTER_DURATION_S = 0.85;

/**
 * The "stepping into this world" threshold shown briefly over the
 * dashboard → game cut, tinted in the world's own accent.
 *
 * Purely visual and self-dismissing: the game mounts underneath regardless,
 * so this overlay can never block play. It calls onDone when its fade-out
 * finishes, with a guaranteed timeout fallback, and a tap skips it early.
 * The parent only mounts it when motion is allowed.
 */
export function WorldEntryTransition({
  gameId,
  onDone,
}: WorldEntryTransitionProps) {
  const meta = getWorldMeta(gameId);
  const WorldIcon = meta.icon;
  const reducedMotion = useReducedMotion();
  const doneRef = useRef(false);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  useEffect(() => {
    // Safety net: never let the overlay get stuck if the animation's
    // completion callback fails to fire for any reason.
    const id = window.setTimeout(finish, (ENTER_DURATION_S + 0.4) * 1000);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  return (
    <motion.div
      className={`world-entry world-tone-${meta.world}`}
      aria-hidden="true"
      onClick={finish}
      initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
      animate={reducedMotion ? { opacity: 1 } : { opacity: [0, 1, 1, 0] }}
      transition={
        reducedMotion
          ? { duration: 0 }
          : {
              duration: ENTER_DURATION_S,
              times: [0, 0.18, 0.72, 1],
              ease: "easeInOut",
            }
      }
      onAnimationComplete={finish}
    >
      <motion.div
        className="world-entry-card"
        initial={reducedMotion ? false : { scale: 0.94, y: 10 }}
        animate={reducedMotion ? undefined : { scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="world-entry-media">
          <Image
            src={meta.image}
            alt=""
            fill
            sizes="220px"
            className="world-entry-image"
          />
          <span className="world-entry-emblem">
            <WorldIcon className="h-7 w-7" strokeWidth={2.2} aria-hidden />
          </span>
        </span>
        <p className="world-entry-eyebrow">Entrando na estação</p>
        <p className="world-entry-name">{meta.name}</p>
      </motion.div>
    </motion.div>
  );
}
