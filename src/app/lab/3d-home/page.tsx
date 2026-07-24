"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { GameHome3D, type World3DEntry } from "@/components/three/GameHome3D";
import { GameScreen } from "@/components/GameScreen";
import { RewardResultModal } from "@/components/RewardResultModal";
import { WorldEntryTransition } from "@/components/WorldEntryTransition";
import { useWorldEntryController } from "@/components/world-entry/useWorldEntryController";
import { ACTIVITIES } from "@/data/activities";
import { getWorldMeta } from "@/data/worlds";
import { PLAYABLE_STAGE_IDS } from "@/engine/stage-progress";
import { saveGameResult } from "@/engine/storage";
import type { Activity, GameId, GameResult } from "@/types/game";

type View = "home" | "game" | "result";

/**
 * Isolated 3D-home lab route. It reuses the real game flow (GameScreen, reward
 * modal, storage, WorldEntryTransition) so "Entrar" plays the actual games,
 * while production "/" can evolve independently.
 */
export default function Lab3DHomePage() {
  const [view, setView] = useState<View>("home");
  const [activeGameId, setActiveGameId] = useState<GameId | null>(null);
  const [lastResult, setLastResult] = useState<GameResult | null>(null);
  const [gameSession, setGameSession] = useState(0);
  const {
    state: entryState,
    isActive: isEntryActive,
    start: startWorldEntry,
    covered: markWorldCovered,
    markReady: markWorldReady,
    fail: failWorldEntry,
    retry: retryWorldEntry,
    complete: completeWorldEntry,
    reset: resetWorldEntry,
  } = useWorldEntryController();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view, activeGameId, gameSession]);

  const worlds = useMemo<World3DEntry[]>(
    () =>
      PLAYABLE_STAGE_IDS.map((id) => {
        const activity = ACTIVITIES.find(
          (item) => item.gameId === id && item.status === "available",
        );
        if (!activity?.gameId) return null;
        const meta = getWorldMeta(activity.gameId);
        return {
          activity,
          gameId: activity.gameId,
          world: meta.world,
          name: meta.name,
          skill: meta.skill,
          purpose: meta.purpose,
        };
      }).filter((entry): entry is World3DEntry => Boolean(entry)),
    [],
  );

  const openActivity = (activity: Activity) => {
    if (activity.status !== "available" || !activity.gameId) return;
    if (!startWorldEntry(activity.gameId)) return;
    setActiveGameId(activity.gameId);
    setGameSession((n) => n + 1);
  };

  const handleGameComplete = (partial: Omit<GameResult, "id" | "playedAt">) => {
    const saved = saveGameResult(partial);
    setLastResult(saved);
    setView("result");
  };

  const returnHome = () => {
    setActiveGameId(null);
    setView("home");
    resetWorldEntry();
  };

  const playAgain = () => {
    if (!lastResult?.gameId) return;
    if (!startWorldEntry(lastResult.gameId)) return;
    setActiveGameId(lastResult.gameId);
    setGameSession((n) => n + 1);
  };

  let content: ReactNode;
  if (view === "game" && activeGameId) {
    content = (
      <main className="flex min-h-full min-w-0 flex-1 flex-col overflow-x-hidden">
        <GameScreen
          key={`${activeGameId}-${gameSession}`}
          gameId={activeGameId}
          sessionKey={gameSession}
          onComplete={handleGameComplete}
          onExit={returnHome}
          onEntryReady={markWorldReady}
          onEntryError={failWorldEntry}
        />
      </main>
    );
  } else if (view === "result" && lastResult) {
    content = (
      <main className="flex min-h-full min-w-0 flex-1 items-center justify-center overflow-x-hidden px-4 py-8 sm:py-10">
        <RewardResultModal
          result={lastResult}
          onPlayAgain={playAgain}
          onDashboard={returnHome}
        />
      </main>
    );
  } else {
    content = (
      <main className="lab3d-main">
        <GameHome3D worlds={worlds} onEnter={openActivity} />
      </main>
    );
  }

  return (
    <>
      {content}
      {isEntryActive && entryState.gameId && (
        <WorldEntryTransition
          gameId={entryState.gameId}
          phase={entryState.phase}
          onCovered={() => {
            setView("game");
            markWorldCovered();
          }}
          onDone={completeWorldEntry}
          onRetry={() => {
            setGameSession((session) => session + 1);
            retryWorldEntry();
          }}
          onBack={returnHome}
        />
      )}
    </>
  );
}
