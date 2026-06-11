"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, CircleCheck, RotateCcw } from "lucide-react";
import { getWorldMeta } from "@/data/worlds";
import { getRewardCopy, isSuccessfulResult } from "@/engine/rewards";
import { celebrateSuccess } from "@/lib/confetti";
import { fadeSlideUp } from "@/lib/feedback-motion";
import {
  formatDetailKeyPt,
  formatDetailValuePt,
} from "@/lib/detail-labels";
import type { GameResult } from "@/types/game";

interface RewardResultModalProps {
  result: GameResult;
  onPlayAgain: () => void;
  onDashboard: () => void;
}

/**
 * Friendly post-game reward screen with circuit progress, encouragement, and actions.
 */
export function RewardResultModal({
  result,
  onPlayAgain,
  onDashboard,
}: RewardResultModalProps) {
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const success = isSuccessfulResult(result);
  const copy = getRewardCopy(result);
  const world = getWorldMeta(result.gameId);
  const WorldIcon = world.icon;

  const detailEntries = Object.entries(result.details).filter(
    ([, value]) => typeof value !== "object",
  );

  useEffect(() => {
    // Move focus to the result so screen readers announce it after the game.
    containerRef.current?.focus();
    if (success) {
      celebrateSuccess();
    }
  }, [success]);

  return (
    <motion.div
      ref={containerRef}
      tabIndex={-1}
      className="mx-auto w-full min-w-0 max-w-xl outline-none"
      role="dialog"
      aria-labelledby="reward-title"
      aria-describedby="reward-summary"
      initial={reducedMotion ? false : "hidden"}
      animate="visible"
      variants={fadeSlideUp}
    >
      <div className={`reward-surface reward-world-${result.gameId} ${success ? "is-success" : "is-attempt"}`}>
        <div className="reward-hero">
          <div className="reward-emblem" aria-hidden>
            <WorldIcon className="h-8 w-8" strokeWidth={2.2} />
          </div>
          <p className="reward-world-label">{world.name}</p>
          <h2
            id="reward-title"
            className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl"
          >
            {copy.title}
          </h2>
          <p className="reward-subtitle">{copy.subtitle}</p>
        </div>

        <div className="reward-body">
          <section className="reward-practice" aria-label="Habilidade praticada">
            <p className="reward-section-label">
              <CircleCheck className="h-5 w-5" aria-hidden />
              Habilidade praticada
            </p>
            <strong>{world.skill}</strong>
            <p id="reward-summary">{result.summary}</p>
          </section>

          <div className="reward-record-grid">
            <section className="reward-register">
              <p>Registro da jornada</p>
              <strong>{copy.progressLine}</strong>
            </section>
            <section className="reward-score">
              <p>Pontuação</p>
              <strong>{result.score}</strong>
            </section>
          </div>

          <p className="reward-encouragement">
            {copy.encouragement}
          </p>

          {detailEntries.length > 0 && (
            <dl className="reward-details">
              {detailEntries.map(([key, value]) => (
                <div key={key} className="surface-stat min-w-0 text-left">
                  <dt className="text-sm font-bold text-slate-600">
                    {formatDetailKeyPt(key)}
                  </dt>
                  <dd className="mt-1 text-lg font-bold text-slate-900">
                    {formatDetailValuePt(value)}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <div className="mt-8 flex min-w-0 flex-col gap-3 sm:flex-row">
            <motion.button
              type="button"
              onClick={onPlayAgain}
              aria-label="Tentar este desafio novamente"
              whileHover={reducedMotion ? undefined : { y: -2 }}
              whileTap={reducedMotion ? undefined : { y: 1, scale: 0.98 }}
              className="btn-primary flex min-h-[3.25rem] flex-1 items-center justify-center gap-2 text-lg"
            >
              <RotateCcw className="h-6 w-6" aria-hidden />
              Tentar novamente
            </motion.button>
            <motion.button
              type="button"
              onClick={onDashboard}
              aria-label="Continuar na jornada cognitiva"
              whileHover={reducedMotion ? undefined : { y: -1 }}
              whileTap={reducedMotion ? undefined : { scale: 0.99 }}
              className="btn-secondary flex min-h-[3.25rem] flex-1 items-center justify-center gap-2 text-lg"
            >
              <ArrowLeft className="h-6 w-6" aria-hidden />
              Continuar jornada
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
