"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";
import { GamifiedDashboard } from "@/components/GamifiedDashboard";
import { GameScreen } from "@/components/GameScreen";
import { RewardResultModal } from "@/components/RewardResultModal";
import { WorldEntryTransition } from "@/components/WorldEntryTransition";
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
  const [selectedDashboardGameId, setSelectedDashboardGameId] =
    useState<GameId | null>(null);
  const [dashboardNotice, setDashboardNotice] = useState<string | null>(null);
  /** World whose entry threshold is currently playing (null = none). */
  const [enteringGameId, setEnteringGameId] = useState<GameId | null>(null);
  /** Bumped to remount game components on each new session. */
  const [gameSession, setGameSession] = useState(0);

  const reducedMotion = useReducedMotion();

  const refreshResults = useCallback(() => {
    const nextResults = getRecentResults();
    setRecentResults(nextResults);
    return nextResults;
  }, []);

  useEffect(() => {
    // Load from localStorage only after mount so SSR and hydration match.
    const storedResults = getRecentResults();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only storage read
    setRecentResults(storedResults);
    if (storedResults[0]?.gameId) {
      setSelectedDashboardGameId(storedResults[0].gameId);
    }
  }, []);

  useEffect(() => {
    // Each view is a new "screen": start it at the top so users never land
    // mid-page when opening a game or returning to the dashboard.
    window.scrollTo(0, 0);
  }, [view, activeGameId, gameSession]);

  const openActivity = (activity: Activity) => {
    if (activity.status !== "available" || !activity.gameId) return;
    setDashboardNotice(null);
    setSelectedDashboardGameId(activity.gameId);
    setActiveGameId(activity.gameId);
    setGameSession((n) => n + 1);
    setView("game");
    if (!reducedMotion) setEnteringGameId(activity.gameId);
  };

  const handleGameComplete = (
    partial: Omit<GameResult, "id" | "playedAt">,
  ) => {
    const saved = saveGameResult(partial);
    setLastResult(saved);
    setSelectedDashboardGameId(saved.gameId);
    refreshResults();
    setView("result");
  };

  const returnHome = () => {
    if (lastResult?.gameId) {
      setSelectedDashboardGameId(lastResult.gameId);
      setDashboardNotice("Treino salvo neste aparelho");
    } else if (activeGameId) {
      setSelectedDashboardGameId(activeGameId);
      setDashboardNotice(null);
    }

    setActiveGameId(null);
    setView("home");
  };

  const playAgain = () => {
    if (lastResult?.gameId) {
      setDashboardNotice(null);
      setSelectedDashboardGameId(lastResult.gameId);
      setActiveGameId(lastResult.gameId);
      setGameSession((n) => n + 1);
      setView("game");
      if (!reducedMotion) setEnteringGameId(lastResult.gameId);
    }
  };

  let content: ReactNode;
  if (view === "game" && activeGameId) {
    content = (
      <main className="flex min-h-full min-w-0 flex-1 flex-col overflow-x-hidden">
        <GameScreen
          gameId={activeGameId}
          sessionKey={gameSession}
          onComplete={handleGameComplete}
          onExit={returnHome}
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
      <main className="w-full min-w-0 flex-1 overflow-x-hidden">
        <GamifiedDashboard
          activities={ACTIVITIES}
          recentResults={recentResults}
          selectedGameId={selectedDashboardGameId}
          statusMessage={dashboardNotice}
          onSelectedGameIdChange={setSelectedDashboardGameId}
          onSelectActivity={openActivity}
        />
      </main>
    );
  }

  return (
    <>
      {content}
      {enteringGameId && (
        <WorldEntryTransition
          key={`${enteringGameId}-${gameSession}`}
          gameId={enteringGameId}
          onDone={() => setEnteringGameId(null)}
        />
      )}
    </>
  );
}
