"use client";

import { useEffect } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ArrowLeft, CircleCheck, RotateCcw, Sparkles } from "lucide-react";
import {
  calculateStars,
  getRewardCopy,
  isSuccessfulResult,
} from "@/engine/rewards";
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

function ActivationDisplay({ count }: { count: number }) {
  return (
    <div
      className="flex items-center justify-center gap-2 py-1"
      role="img"
      aria-label={`${count} de 3 sinais de ativação`}
    >
      {Array.from({ length: 3 }, (_, i) => (
        <span
          key={i}
          className={`h-4 w-10 rounded-full border-2 sm:h-5 ${
            i < count
              ? "border-teal-700 bg-teal-400 shadow-[0_0_12px_rgb(45_212_191/0.55)]"
              : "border-slate-300 bg-slate-100"
          }`}
          aria-hidden
        />
      ))}
    </div>
  );
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
  const stars = calculateStars(result.score);
  const success = isSuccessfulResult(result);
  const copy = getRewardCopy(result, stars);

  const detailEntries = Object.entries(result.details).filter(
    ([, value]) => typeof value !== "object",
  );

  useEffect(() => {
    if (success) {
      celebrateSuccess();
    }
  }, [success]);

  return (
    <motion.div
      className="mx-auto w-full min-w-0 max-w-lg"
      role="dialog"
      aria-labelledby="reward-title"
      aria-describedby="reward-summary"
      initial={reducedMotion ? false : "hidden"}
      animate="visible"
      variants={fadeSlideUp}
    >
      <div className="table-surface overflow-hidden border-teal-500">
        <div
          className={`px-5 py-6 text-center sm:px-8 sm:py-8 ${
            success
              ? "bg-gradient-to-b from-teal-50 to-white"
              : "bg-gradient-to-b from-amber-50/80 to-white"
          }`}
        >
          <div
            className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border-2 shadow-[0_4px_0_0_rgb(15_23_42/0.08)] ${
              success
                ? "border-teal-300 bg-teal-100 text-teal-800"
                : "border-amber-300 bg-amber-100 text-amber-800"
            }`}
            aria-hidden
          >
            {success ? (
              <CircleCheck className="h-7 w-7" strokeWidth={2.25} />
            ) : (
              <Sparkles className="h-7 w-7" strokeWidth={2.25} />
            )}
          </div>

          <p
            className={`text-sm font-bold uppercase tracking-wide ${
              success ? "text-teal-800" : "text-amber-800"
            }`}
          >
            {success ? "Jornada cognitiva" : "Rota em prática"}
          </p>
          <h2
            id="reward-title"
            className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl"
          >
            {copy.title}
          </h2>
          <p className="mt-2 text-lg font-semibold text-slate-700">
            {copy.subtitle}
          </p>
        </div>

        <div className="border-t-2 border-[#e2dfd1] px-5 py-6 sm:px-8">
          <h3 className="text-center text-xl font-bold text-slate-900">
            {result.activityTitle}
          </h3>
          <p id="reward-summary" className="text-muted mt-2 text-center text-lg">
            {result.summary}
          </p>

          <div className="board-surface mt-5 rounded-2xl px-4 py-4 text-center">
            <ActivationDisplay count={stars} />
            <p className="mt-2 text-lg font-bold text-teal-900">
              {copy.progressLine}
            </p>
          </div>

          <div className="tactile-tile mt-4 rounded-2xl border-2 border-teal-300 bg-teal-50 p-5 text-center">
            <p className="text-sm font-bold uppercase tracking-wide text-teal-800">
              Pontuação
            </p>
            <p className="mt-1 text-5xl font-bold tabular-nums text-teal-700">
              {result.score}
            </p>
          </div>

          <p className="mt-4 text-center text-base leading-relaxed text-slate-600">
            {copy.encouragement}
          </p>

          {detailEntries.length > 0 && (
            <dl className="mt-5 grid grid-cols-2 gap-3">
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
              aria-label="Voltar à jornada cognitiva"
              whileHover={reducedMotion ? undefined : { y: -1 }}
              whileTap={reducedMotion ? undefined : { scale: 0.99 }}
              className="btn-secondary flex min-h-[3.25rem] flex-1 items-center justify-center gap-2 text-lg"
            >
              <ArrowLeft className="h-6 w-6" aria-hidden />
              Voltar à jornada
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
