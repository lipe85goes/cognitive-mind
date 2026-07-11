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
 * Premium post-game "journey result" screen: the cozy dark MindFlow atmosphere
 * wrapping a wood/brass result card. Pure presentation restyle — all result
 * data, copy, details, actions and a11y are unchanged.
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
  const isRouteResult = result.gameId === "escape-maze";
  const routeWon = isRouteResult && result.details.won === true;
  const routeNumber =
    isRouteResult && typeof result.details.routeNumber === "number"
      ? result.details.routeNumber
      : undefined;
  const nextRouteNumber =
    isRouteResult && typeof result.details.nextRouteNumber === "number"
      ? result.details.nextRouteNumber
      : undefined;
  const nextRouteStage =
    isRouteResult && typeof result.details.nextRouteStage === "string"
      ? result.details.nextRouteStage
      : undefined;
  const displayCopy = isRouteResult
    ? {
        title: routeWon ? "Caminho aberto" : "Rota registrada",
        subtitle: routeWon
          ? "Voc\u00ea orientou o Explorador e abriu espa\u00e7o para a pr\u00f3xima rota."
          : "A pr\u00e1tica ficou salva. Outra rota pode ser observada com calma.",
        progressLine:
          routeNumber && nextRouteNumber
            ? `Rota ${routeNumber} salva. Rota ${nextRouteNumber}: ${nextRouteStage ?? "novo caminho"}.`
            : copy.progressLine,
        encouragement: "Continue apenas quando fizer sentido para voc\u00ea.",
      }
    : copy;
  const primaryActionLabel = isRouteResult
    ? routeWon
      ? "Explorar pr\u00f3xima rota"
      : "Explorar outra rota"
    : "Praticar outra vez";
  const primaryActionAria = isRouteResult
    ? primaryActionLabel
    : "Praticar este desafio outra vez";
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
    <div className="prm-shell">
      <div className="prm-atmosphere" aria-hidden />
      <span className="prm-vignette" aria-hidden />

      <motion.div
        ref={containerRef}
        tabIndex={-1}
        className={`prm-card ${success ? "is-success" : "is-attempt"}`}
        role="dialog"
        aria-labelledby="reward-title"
        aria-describedby="reward-summary"
        initial={reducedMotion ? false : "hidden"}
        animate="visible"
        variants={fadeSlideUp}
      >
        <div className="prm-emblem" aria-hidden>
          <WorldIcon className="h-8 w-8" strokeWidth={2.2} />
        </div>
        <p className="prm-world">{world.name}</p>
        <h2 id="reward-title" className="prm-title">
          {displayCopy.title}
        </h2>
        <p className="prm-subtitle">{displayCopy.subtitle}</p>

        <section className="prm-practice" aria-label="Habilidade praticada">
          <p className="prm-practice-label">
            <CircleCheck className="h-5 w-5" aria-hidden />
            Habilidade praticada
          </p>
          <strong>{world.skill}</strong>
          <p id="reward-summary">{result.summary}</p>
        </section>

        <div className="prm-record">
          <section className="prm-record-card">
            <p>Registro da jornada</p>
            <strong>{displayCopy.progressLine}</strong>
          </section>
          <section className="prm-score-card">
            <p>Registro da prática</p>
            <strong>{result.score}</strong>
          </section>
        </div>

        <p className="prm-encouragement">{displayCopy.encouragement}</p>

        {detailEntries.length > 0 && (
          <dl className="prm-details">
            {detailEntries.map(([key, value]) => (
              <div key={key} className="prm-detail">
                <dt>{formatDetailKeyPt(key)}</dt>
                <dd>{formatDetailValuePt(value)}</dd>
              </div>
            ))}
          </dl>
        )}

        <div className="prm-actions">
          <motion.button
            type="button"
            onClick={onPlayAgain}
            aria-label={primaryActionAria}
            whileHover={reducedMotion ? undefined : { y: -2 }}
            whileTap={reducedMotion ? undefined : { y: 1, scale: 0.98 }}
            className="prm-cta"
          >
            <RotateCcw className="h-6 w-6" aria-hidden />
            {primaryActionLabel}
          </motion.button>
          <motion.button
            type="button"
            onClick={onDashboard}
            aria-label="Continuar na jornada cognitiva"
            whileHover={reducedMotion ? undefined : { y: -1 }}
            whileTap={reducedMotion ? undefined : { scale: 0.99 }}
            className="prm-btn"
          >
            <ArrowLeft className="h-6 w-6" aria-hidden />
            Continuar jornada
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
