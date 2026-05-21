import { getGameComponent } from "@/games/index";
import type { GameComponentProps, GameId } from "@/types/game";

interface GameScreenProps extends GameComponentProps {
  gameId: GameId;
  sessionKey: number;
}

/** Renders the active game with a stable component reference per game id. */
export function GameScreen({
  gameId,
  sessionKey,
  onComplete,
  onExit,
}: GameScreenProps) {
  const GameComponent = getGameComponent(gameId);
  if (!GameComponent) return null;

  return (
    <GameComponent key={sessionKey} onComplete={onComplete} onExit={onExit} />
  );
}
