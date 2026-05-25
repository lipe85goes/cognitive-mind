"use client";

import { useEffect, useState } from "react";
import { GameHowToPlay } from "@/components/GameHowToPlay";
import { GAME_INTROS } from "@/data/game-intros";
import { ColorSequenceGame } from "@/games/color-sequence/ColorSequenceGame";
import { EscapeMazeGame } from "@/games/escape-maze/EscapeMazeGame";
import { NumberTrailGame } from "@/games/number-trail/NumberTrailGame";
import { SeedGardenGame } from "@/games/seed-garden/SeedGardenGame";
import { SecurityPanelGame } from "@/games/security-panel/SecurityPanelGame";
import type { GameComponentProps, GameId } from "@/types/game";

interface GameScreenProps extends GameComponentProps {
  gameId: GameId;
  sessionKey: number;
}

/** Renders intro then the active game; remounts when sessionKey changes. */
export function GameScreen({
  gameId,
  sessionKey,
  onComplete,
  onExit,
}: GameScreenProps) {
  const [showIntro, setShowIntro] = useState(true);
  const intro = GAME_INTROS[gameId];

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset intro each new session
    setShowIntro(true);
  }, [sessionKey]);

  if (showIntro) {
    return (
      <GameHowToPlay
        activityTitle={intro.title}
        steps={intro.steps}
        onStart={() => setShowIntro(false)}
        onBackToMap={onExit}
      />
    );
  }

  const sharedGameProps = {
    onComplete,
    onExit,
  };

  switch (gameId) {
    case "color-sequence":
      return <ColorSequenceGame key={sessionKey} {...sharedGameProps} />;
    case "escape-maze":
      return <EscapeMazeGame key={sessionKey} {...sharedGameProps} />;
    case "security-panel":
      return <SecurityPanelGame key={sessionKey} {...sharedGameProps} />;
    case "number-trail":
      return <NumberTrailGame key={sessionKey} {...sharedGameProps} />;
    case "seed-garden":
      return <SeedGardenGame key={sessionKey} {...sharedGameProps} />;
    default:
      return null;
  }
}
