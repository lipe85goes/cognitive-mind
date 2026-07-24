"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
} from "react";
import { ArrowLeft, BookOpen, Play } from "lucide-react";
import { getWorldVisual } from "@/components/worlds/worldVisuals";
import { WorldMasterScene } from "@/components/worlds/master-scene/WorldMasterScene";
import { hasWorldMasterScene } from "@/components/worlds/master-scene/worldMasterSceneConfig";
import type { GameIntroContent } from "@/data/game-intros";
import type { GameId } from "@/types/game";
import "@/styles/world-intro.css";

interface GameHowToPlayProps {
  intro: GameIntroContent;
  gameId: GameId;
  onStart: () => void;
  onBackToMap: () => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Premium "station briefing" before a mini-world begins. Shared across all
 * games — it only restyles the presentation (dark cozy shell, wooden plaque,
 * brass panels, green CTA). All copy/props/callbacks are unchanged, so every
 * game's intro benefits and no game logic is touched.
 */
export function GameHowToPlay({
  intro,
  gameId,
  onStart,
  onBackToMap,
  onReady,
  onError,
}: GameHowToPlayProps) {
  const visual = getWorldVisual(gameId);
  const IntroIcon = visual.symbol;
  const style = {
    "--wintro-accent": visual.accent,
    "--wintro-accent-soft": visual.accentSoft,
    "--wintro-accent-deep": visual.accentDeep,
    "--wintro-atmosphere": `url(${visual.atmosphere})`,
    "--wms-accent": visual.accent,
    "--wms-accent-soft": visual.accentSoft,
    "--wms-accent-deep": visual.accentDeep,
  } as CSSProperties;
  const readyReportedRef = useRef(false);
  const paintFrameRef = useRef<number | null>(null);
  const settledFrameRef = useRef<number | null>(null);
  const startLabel =
    gameId === "escape-maze"
      ? "Escolher rota"
      : gameId === "color-sequence"
        ? "Preparar circuito"
        : "Começar";

  const reportReadyAfterPaint = useCallback(() => {
    if (readyReportedRef.current) return;
    paintFrameRef.current = window.requestAnimationFrame(() => {
      settledFrameRef.current = window.requestAnimationFrame(() => {
        if (readyReportedRef.current) return;
        readyReportedRef.current = true;
        onReady?.();
      });
    });
  }, [onReady]);

  useEffect(
    () => () => {
      if (paintFrameRef.current !== null) {
        window.cancelAnimationFrame(paintFrameRef.current);
      }
      if (settledFrameRef.current !== null) {
        window.cancelAnimationFrame(settledFrameRef.current);
      }
    },
    [],
  );

  return (
    <div
      className={`pgi-shell pgi-${intro.world} wintro-shell`}
      data-world={visual.world}
      data-art-mode={hasWorldMasterScene(gameId) ? "master-scene" : visual.artMode}
      data-master-scene={hasWorldMasterScene(gameId) ? "true" : undefined}
      style={style}
    >
      {/* Cozy dark library/workshop atmosphere, matching the Home + game. */}
      <div className="pgi-atmosphere" aria-hidden />
      <span className="pgi-vignette" aria-hidden />

      <div className="pgi-frame">
        <header className="pgi-topbar">
          <button
            type="button"
            onClick={onBackToMap}
            aria-label="Voltar à jornada cognitiva"
            className="pgi-back wms-button-secondary"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
            Voltar à jornada
          </button>
          <span className="pgi-kicker">
            <BookOpen className="h-5 w-5" aria-hidden />
            Como jogar
          </span>
        </header>

        <div className="pgi-plaque wms-plate">
          <h1 id="intro-title" className="pgi-plaque-text">
            {intro.title}
          </h1>
        </div>

        <div className="pgi-grid">
          <section
            className="pgi-preview"
            aria-label={`Boas-vindas a ${intro.title}`}
          >
            <div className="pgi-preview-media wintro-preview-media" aria-hidden="true">
              {hasWorldMasterScene(gameId) ? (
                <WorldMasterScene
                  gameId={gameId}
                  context="intro"
                  state="focused"
                  sizes="(max-width: 767px) calc(100vw - 2rem), 40vw"
                  priority
                  onReady={reportReadyAfterPaint}
                  onError={onError}
                />
              ) : (
                <Image
                  src={visual.introArt}
                  alt=""
                  fill
                  sizes="(max-width: 767px) calc(100vw - 2rem), 40vw"
                  className="pgi-preview-image"
                  priority
                  onLoad={reportReadyAfterPaint}
                  onError={() =>
                    onError?.(
                      new Error(
                        `Failed to load intro artwork for ${gameId}: ${visual.introArt}`,
                      ),
                    )
                  }
                />
              )}
              <span className="wintro-art-glow" />
            </div>
            <div className="pgi-skill">
              <p>Você vai praticar</p>
              <strong>{intro.skill}</strong>
            </div>
          </section>

          <section className="pgi-briefing" aria-labelledby="intro-title">
            <p className="pgi-original">
              <IntroIcon className="h-5 w-5" aria-hidden />
              {intro.originalName}
            </p>
            <p className="pgi-desc">{intro.description}</p>

            <ol
              className="pgi-steps"
              aria-label={`Passos para jogar ${intro.title}`}
            >
              {intro.steps.map((step, index) => (
                <li key={step}>
                  <span aria-hidden>{index + 1}</span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>

            <p className="pgi-reassurance">{intro.reassurance}</p>

            <div className="pgi-actions">
              <button
                type="button"
                onClick={onStart}
                aria-label={`${startLabel}: ${intro.title}`}
                className="pgi-cta wms-button-primary"
                data-world-entry-focus="true"
              >
                <Play className="h-6 w-6 fill-current" aria-hidden />
                {startLabel}
              </button>
              <button
                type="button"
                onClick={onBackToMap}
                aria-label="Voltar à jornada cognitiva"
                className="pgi-btn wms-button-secondary"
              >
                <ArrowLeft className="h-6 w-6" aria-hidden />
                Voltar à jornada
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
