"use client";

import { useCallback, useEffect, useState } from "react";
import { GamifiedDashboard } from "@/components/GamifiedDashboard";
import { GameScreen } from "@/components/GameScreen";
import { RewardResultModal } from "@/components/RewardResultModal";
import { ACTIVITIES } from "@/data/activities";
import { getRecentResults, saveGameResult } from "@/engine/storage";
import type {
  Activity,
  DashboardView,
  GameId,
  GameResult,
} from "@/types/game";

/**
 * Main dashboard: activity grid, game routing, and recent results.
 * Game logic stays inside each game component under src/games/.
 */
export default function HomePage() {
  const [view, setView] = useState<DashboardView>("home");
  const [activeGameId, setActiveGameId] = useState<GameId | null>(null);
  const [lastResult, setLastResult] = useState<GameResult | null>(null);
  const [recentResults, setRecentResults] = useState<GameResult[]>([]);
  /** Bumped to remount game components on each new session. */
  const [gameSession, setGameSession] = useState(0);

  const refreshResults = useCallback(() => {
    setRecentResults(getRecentResults());
  }, []);

  useEffect(() => {
    // Load from localStorage only after mount so SSR and hydration match.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only storage read
    setRecentResults(getRecentResults());
  }, []);

  const openActivity = (activity: Activity) => {
    if (activity.status !== "available" || !activity.gameId) return;
    setActiveGameId(activity.gameId);
    setGameSession((n) => n + 1);
    setView("game");
  };

  const handleGameComplete = (
    partial: Omit<GameResult, "id" | "playedAt">,
  ) => {
    const saved = saveGameResult(partial);
    setLastResult(saved);
    refreshResults();
    setView("result");
  };

  const returnHome = () => {
    setActiveGameId(null);
    setView("home");
  };

  const playAgain = () => {
    if (lastResult?.gameId) {
      setActiveGameId(lastResult.gameId);
      setGameSession((n) => n + 1);
      setView("game");
    }
  };

  if (view === "game" && activeGameId) {
    return (
      <main className="flex min-h-full min-w-0 flex-1 flex-col overflow-x-hidden">
        <GameScreen
          gameId={activeGameId}
          sessionKey={gameSession}
          onComplete={handleGameComplete}
          onExit={returnHome}
        />
      </main>
    );
  }

  if (view === "result" && lastResult) {
    return (
      <main className="flex min-h-full min-w-0 flex-1 items-center justify-center overflow-x-hidden px-4 py-8 sm:py-10">
        <RewardResultModal
          result={lastResult}
          onPlayAgain={playAgain}
          onDashboard={returnHome}
        />
      </main>
    );
  }

  return (
    <main className="mx-auto w-full min-w-0 max-w-4xl flex-1 overflow-x-hidden px-4 py-5 pb-12 sm:px-6 sm:py-6">
      <GamifiedDashboard
        activities={ACTIVITIES}
        recentResults={recentResults}
        onSelectActivity={openActivity}
      />
    </main>
  );
}
