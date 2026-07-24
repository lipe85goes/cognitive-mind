"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { GameHowToPlay } from "@/components/GameHowToPlay";
import { GAME_INTROS } from "@/data/game-intros";
import { GAME_COMPONENTS } from "@/games";
import type { GameComponentProps, GameId } from "@/types/game";

interface GameScreenProps extends GameComponentProps {
  gameId: GameId;
  sessionKey: number;
  skipIntro?: boolean;
}

/** Renders intro then the active game; remounts when sessionKey changes. */
export function GameScreen({
  gameId,
  sessionKey,
  onComplete,
  onExit,
  initialRouteNumber,
  onEntryReady,
  onEntryError,
  skipIntro = false,
}: GameScreenProps) {
  const [showIntro, setShowIntro] = useState(!skipIntro);
  const [introReady, setIntroReady] = useState(skipIntro);
  const [gameReady, setGameReady] = useState(false);
  const readyReportedRef = useRef(false);
  const gameLayerRef = useRef<HTMLDivElement>(null);
  const intro = GAME_INTROS[gameId];
  const ActiveGame = GAME_COMPONENTS[gameId];
  const hasExplicitGameReadiness =
    gameId === "escape-maze" || gameId === "color-sequence";

  useEffect(() => {
    if (hasExplicitGameReadiness) return;

    let firstFrame = 0;
    let settledFrame = 0;
    firstFrame = window.requestAnimationFrame(() => {
      settledFrame = window.requestAnimationFrame(() => setGameReady(true));
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(settledFrame);
    };
  }, [hasExplicitGameReadiness]);

  useEffect(() => {
    if (!introReady || !gameReady || readyReportedRef.current) return;
    readyReportedRef.current = true;
    onEntryReady?.();
  }, [gameReady, introReady, onEntryReady]);

  useLayoutEffect(() => {
    if (showIntro || skipIntro) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    gameLayerRef.current?.focus({ preventScroll: true });
  }, [showIntro, skipIntro]);

  return (
    <div className="wentry-screen">
      <div
        ref={gameLayerRef}
        className="wentry-game-layer"
        aria-hidden={showIntro}
        inert={showIntro ? true : undefined}
        tabIndex={-1}
        data-world-entry-focus={skipIntro ? "true" : undefined}
      >
        <ActiveGame
          key={sessionKey}
          onComplete={onComplete}
          onExit={onExit}
          initialRouteNumber={initialRouteNumber}
          onEntryReady={() => setGameReady(true)}
          onEntryError={onEntryError}
        />
      </div>

      {!skipIntro && (
        <div
          className="wentry-intro-layer"
          aria-hidden={!showIntro}
          inert={!showIntro ? true : undefined}
        >
          <GameHowToPlay
            gameId={gameId}
            intro={intro}
            onStart={() => {
              if (document.activeElement instanceof HTMLElement) {
                document.activeElement.blur();
              }
              window.scrollTo({ top: 0, left: 0, behavior: "auto" });
              setShowIntro(false);
            }}
            onBackToMap={onExit}
            onReady={() => setIntroReady(true)}
            onError={onEntryError}
          />
        </div>
      )}
    </div>
  );
}
