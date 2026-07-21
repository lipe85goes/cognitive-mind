"use client";

import { useEffect, useState } from "react";
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
  skipIntro = false,
}: GameScreenProps) {
  const [showIntro, setShowIntro] = useState(!skipIntro);
  const intro = GAME_INTROS[gameId];

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset intro each new session
    setShowIntro(!skipIntro);
  }, [sessionKey, skipIntro]);

  if (showIntro) {
    return (
      <GameHowToPlay
        gameId={gameId}
        intro={intro}
        onStart={() => setShowIntro(false)}
        onBackToMap={onExit}
      />
    );
  }

  const ActiveGame = GAME_COMPONENTS[gameId];
  if (!ActiveGame) return null;

  return (
    <ActiveGame
      key={sessionKey}
      onComplete={onComplete}
      onExit={onExit}
      initialRouteNumber={initialRouteNumber}
    />
  );
}
