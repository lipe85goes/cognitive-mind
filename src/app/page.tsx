"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { GameScreen } from "@/components/GameScreen";
import { HomeStage } from "@/components/home/HomeStage";
import type { HomeWorldEntry } from "@/components/home/WorldObject";
import { RewardResultModal } from "@/components/RewardResultModal";
import { WorldEntryTransition } from "@/components/WorldEntryTransition";
import { ACTIVITIES } from "@/data/activities";
import { getWorldMeta } from "@/data/worlds";
import { PLAYABLE_STAGE_IDS } from "@/engine/stage-progress";
import { getRecentResults, saveGameResult } from "@/engine/storage";
import type {
  Activity,
  DashboardView,
  GameId,
  GameResult,
} from "@/types/game";

/**
 * Production home: 2.5D world atelier, game routing, and recent results.
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
  const [initialRouteNumber, setInitialRouteNumber] = useState<number | undefined>();
  const [skipGameIntro, setSkipGameIntro] = useState(false);

  const worlds = useMemo<HomeWorldEntry[]>(
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
      }).filter((entry): entry is HomeWorldEntry => Boolean(entry)),
    [],
  );

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
    if (
      enteringGameId ||
      activity.status !== "available" ||
      !activity.gameId
    ) {
      return;
    }
    setDashboardNotice(null);
    setSelectedDashboardGameId(activity.gameId);
    setActiveGameId(activity.gameId);
    setInitialRouteNumber(undefined);
    setSkipGameIntro(false);
    setGameSession((n) => n + 1);
    setEnteringGameId(activity.gameId);
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
      const nextRouteNumber =
        lastResult.gameId === "escape-maze" &&
        typeof lastResult.details.nextRouteNumber === "number"
          ? lastResult.details.nextRouteNumber
          : undefined;

      setSelectedDashboardGameId(lastResult.gameId);
      setActiveGameId(lastResult.gameId);
      setInitialRouteNumber(nextRouteNumber);
      setSkipGameIntro(Boolean(nextRouteNumber));
      setGameSession((n) => n + 1);
      setEnteringGameId(lastResult.gameId);
    }
  };

  const revealEnteredWorld = useCallback(() => {
    setView("game");
  }, []);

  const finishWorldEntry = useCallback(() => {
    setEnteringGameId(null);
  }, []);

  let content: ReactNode;
  if (view === "game" && activeGameId) {
    content = (
      <main className="flex min-h-full min-w-0 flex-1 flex-col overflow-x-hidden">
        <GameScreen
          gameId={activeGameId}
          sessionKey={gameSession}
          initialRouteNumber={initialRouteNumber}
          skipIntro={skipGameIntro}
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
      <main className="hj-main">
        <HomeStage
          worlds={worlds}
          recentResults={recentResults}
          selectedGameId={selectedDashboardGameId}
          statusMessage={dashboardNotice}
          isEntering={Boolean(enteringGameId)}
          onSelectedGameIdChange={setSelectedDashboardGameId}
          onEnter={openActivity}
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
          onCovered={revealEnteredWorld}
          onDone={finishWorldEntry}
        />
      )}
    </>
  );
}
