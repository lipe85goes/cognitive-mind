"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
} from "react";
import { GameHowToPlay } from "@/components/GameHowToPlay";
import { GAME_INTROS } from "@/data/game-intros";
import { GAME_REGISTRY } from "@/games";
import type { GameComponentProps, GameId } from "@/types/game";

interface GameScreenProps extends GameComponentProps {
  gameId: GameId;
  sessionKey: number;
  skipIntro?: boolean;
}

/**
 * Renders intro then the active game; remounts when sessionKey changes.
 *
 * The game's code is not part of the shell: the registry loader fetches it when
 * this screen mounts, and the game layer stays empty until it arrives. Game
 * readiness counts only from the game's own mount, so a slow chunk keeps the
 * entry "preparing" (under its watchdog) instead of revealing an empty world,
 * and a chunk that fails to load takes the same onEntryError -> retry path as
 * any other entry failure.
 */
export function GameScreen({
  gameId,
  sessionKey,
  onComplete,
  onExit,
  initialRouteNumber,
  initialDifficulty,
  onEntryReady,
  onEntryError,
  skipIntro = false,
}: GameScreenProps) {
  const [showIntro, setShowIntro] = useState(!skipIntro);
  const [introReady, setIntroReady] = useState(skipIntro);
  const [gameReady, setGameReady] = useState(false);
  const [loadedGame, setLoadedGame] = useState<{
    component: ComponentType<GameComponentProps>;
  } | null>(null);
  const readyReportedRef = useRef(false);
  const onEntryErrorRef = useRef(onEntryError);
  const gameLayerRef = useRef<HTMLDivElement>(null);
  const intro = GAME_INTROS[gameId];
  const { load: loadGame, readiness } = GAME_REGISTRY[gameId];
  const hasExplicitGameReadiness = readiness === "explicit";
  const ActiveGame = loadedGame?.component ?? null;
  const isGameMounted = ActiveGame !== null;

  useEffect(() => {
    onEntryErrorRef.current = onEntryError;
  }, [onEntryError]);

  // One load per session: a new callback identity must not fetch again, so a
  // failure goes to whichever onEntryError the parent holds when it lands.
  useEffect(() => {
    let cancelled = false;
    loadGame().then(
      (component) => {
        if (!cancelled) setLoadedGame({ component });
      },
      (error: unknown) => {
        if (cancelled) return;
        onEntryErrorRef.current?.(
          error instanceof Error
            ? error
            : new Error("Unknown error while loading the game's code."),
        );
      },
    );

    return () => {
      cancelled = true;
    };
  }, [loadGame]);

  useEffect(() => {
    if (!isGameMounted || hasExplicitGameReadiness) return;

    let firstFrame = 0;
    let settledFrame = 0;
    firstFrame = window.requestAnimationFrame(() => {
      settledFrame = window.requestAnimationFrame(() => setGameReady(true));
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(settledFrame);
    };
  }, [hasExplicitGameReadiness, isGameMounted]);

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
        {ActiveGame && (
          <ActiveGame
            key={sessionKey}
            onComplete={onComplete}
            onExit={onExit}
            initialRouteNumber={initialRouteNumber}
            initialDifficulty={initialDifficulty}
            onEntryReady={() => setGameReady(true)}
            onEntryError={onEntryError}
          />
        )}
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
