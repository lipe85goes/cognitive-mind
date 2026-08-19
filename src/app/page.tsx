"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { GameScreen } from "@/components/GameScreen";
import { HomeStage } from "@/components/home/HomeStage";
import type { HomeWorldEntry } from "@/components/home/WorldObject";
import { RewardResultModal } from "@/components/RewardResultModal";
import { WorldEntryTransition } from "@/components/WorldEntryTransition";
import { useWorldEntryController } from "@/components/world-entry/useWorldEntryController";
import { ACTIVITIES } from "@/data/activities";
import { getWorldMeta } from "@/data/worlds";
import { PLAYABLE_STAGE_IDS } from "@/engine/stage-progress";
import { getRecentResults, saveGameResult } from "@/engine/storage";
import type {
  Activity,
  DashboardView,
  DifficultyLevel,
  GameId,
  GameResult,
} from "@/types/game";

const DIFFICULTY_LEVELS: readonly DifficultyLevel[] = ["easy", "medium", "hard"];

/**
 * `GameResult.details` is a loose record, so the mode a finished route reports
 * has to be narrowed before it can be handed back to a new session. Anything
 * unrecognised yields undefined, which is exactly the fresh-entry default.
 */
function readDifficulty(value: unknown): DifficultyLevel | undefined {
  return typeof value === "string" &&
    (DIFFICULTY_LEVELS as readonly string[]).includes(value)
    ? (value as DifficultyLevel)
    : undefined;
}

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
  /** Bumped to remount game components on each new session. */
  const [gameSession, setGameSession] = useState(0);
  const [initialRouteNumber, setInitialRouteNumber] = useState<number | undefined>();
  /**
   * Set only while a journey continues, and cleared on a fresh entry. It is the
   * mode's carrier BETWEEN instances; during play the game component owns it.
   */
  const [initialDifficulty, setInitialDifficulty] = useState<
    DifficultyLevel | undefined
  >();
  const [skipGameIntro, setSkipGameIntro] = useState(false);
  const {
    state: entryState,
    isActive: isEntryActive,
    start: startWorldEntry,
    covered: markWorldCovered,
    markReady: markWorldReady,
    fail: failWorldEntry,
    retry: retryEntry,
    complete: completeWorldEntry,
    reset: resetWorldEntry,
  } = useWorldEntryController();

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
    if (activity.status !== "available" || !activity.gameId) {
      return;
    }
    if (!startWorldEntry(activity.gameId)) return;

    setDashboardNotice(null);
    setSelectedDashboardGameId(activity.gameId);
    setActiveGameId(activity.gameId);
    setInitialRouteNumber(undefined);
    // A new entry from Home is a new journey: it must not inherit the mode of
    // whatever was played before it.
    setInitialDifficulty(undefined);
    setSkipGameIntro(false);
    setGameSession((n) => n + 1);
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
    resetWorldEntry();
  };

  const playAgain = () => {
    if (lastResult?.gameId) {
      if (!startWorldEntry(lastResult.gameId)) return;

      setDashboardNotice(null);
      const isRouteJourney = lastResult.gameId === "escape-maze";
      const nextRouteNumber =
        isRouteJourney && typeof lastResult.details.nextRouteNumber === "number"
          ? lastResult.details.nextRouteNumber
          : undefined;
      /**
       * ROTA-DIFFICULTY-04B: the finished route already reports the mode it was
       * played on — `endGame` has always written `details.difficulty`. Carrying
       * it here is the missing half of the continuation that already carries the
       * Route, and it is read from the same place, under the same guard.
       *
       * Tied to `nextRouteNumber` on purpose: the mode travels only when a
       * journey travels, so it can never leak into an unrelated session.
       */
      const nextDifficulty = nextRouteNumber
        ? readDifficulty(lastResult.details.difficulty)
        : undefined;

      setSelectedDashboardGameId(lastResult.gameId);
      setActiveGameId(lastResult.gameId);
      setInitialRouteNumber(nextRouteNumber);
      setInitialDifficulty(nextDifficulty);
      setSkipGameIntro(Boolean(nextRouteNumber));
      setGameSession((n) => n + 1);
    }
  };

  const revealEnteredWorld = useCallback(() => {
    setView("game");
    markWorldCovered();
  }, [markWorldCovered]);

  const finishWorldEntry = useCallback(() => {
    completeWorldEntry();
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>('[data-world-entry-focus="true"]')
        ?.focus();
    });
  }, [completeWorldEntry]);

  const retryWorldEntry = useCallback(() => {
    setGameSession((session) => session + 1);
    retryEntry();
  }, [retryEntry]);

  const cancelWorldEntry = useCallback(() => {
    setActiveGameId(null);
    setView("home");
    resetWorldEntry();
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>('[data-world-entry-return="true"]')
          ?.focus();
      });
    });
  }, [resetWorldEntry]);

  let content: ReactNode;
  if (view === "game" && activeGameId) {
    content = (
      <main className="flex min-h-full min-w-0 flex-1 flex-col overflow-x-hidden">
        <GameScreen
          key={`${activeGameId}-${gameSession}`}
          gameId={activeGameId}
          sessionKey={gameSession}
          initialRouteNumber={initialRouteNumber}
          initialDifficulty={initialDifficulty}
          skipIntro={skipGameIntro}
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
      <main className="hj-main">
        <HomeStage
          worlds={worlds}
          recentResults={recentResults}
          selectedGameId={selectedDashboardGameId}
          statusMessage={dashboardNotice}
          isEntering={isEntryActive}
          onSelectedGameIdChange={setSelectedDashboardGameId}
          onEnter={openActivity}
        />
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
          onCovered={revealEnteredWorld}
          onDone={finishWorldEntry}
          onRetry={retryWorldEntry}
          onBack={cancelWorldEntry}
        />
      )}
    </>
  );
}
