"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import type { GameId } from "@/types/game";
import {
  INITIAL_WORLD_ENTRY_STATE,
  worldEntryReducer,
} from "@/components/world-entry/worldEntryTypes";

/**
 * Watchdog for the "preparing" phase. Readiness normally arrives from asset
 * decode + paint; if it never does (stalled request, suspended decode), the
 * Explorador must not stay on "Preparando..." forever — after this window we
 * fail over to the existing retry/back error panel. While the tab is hidden
 * the browser suspends rAF/paint, so the timer re-arms instead of firing.
 */
const PREPARING_WATCHDOG_MS = 12_000;

export function useWorldEntryController() {
  const [state, dispatch] = useReducer(
    worldEntryReducer,
    INITIAL_WORLD_ENTRY_STATE,
  );
  const lockedRef = useRef(false);

  useEffect(() => {
    if (state.phase === "ready") {
      dispatch({ type: "REVEAL" });
    }
  }, [state.phase]);

  useEffect(() => {
    if (state.phase !== "preparing") return;

    let timerId: number;
    const arm = () => {
      timerId = window.setTimeout(() => {
        if (document.visibilityState === "hidden") {
          arm();
          return;
        }
        dispatch({
          type: "FAIL",
          error: new Error(
            "World entry readiness was not reported within the watchdog window.",
          ),
        });
      }, PREPARING_WATCHDOG_MS);
    };
    arm();

    return () => window.clearTimeout(timerId);
  }, [state.phase, state.attempt]);

  const start = useCallback((gameId: GameId) => {
    if (lockedRef.current) return false;
    lockedRef.current = true;
    dispatch({ type: "START", gameId });
    return true;
  }, []);

  const covered = useCallback(() => {
    dispatch({ type: "COVERED" });
  }, []);

  const markReady = useCallback(() => {
    dispatch({ type: "READY" });
  }, []);

  const fail = useCallback((error: unknown) => {
    const entryError =
      error instanceof Error
        ? error
        : new Error("Unknown error while preparing a MindFlow world.");
    console.error("[MindFlow] World entry preparation failed.", entryError);
    dispatch({ type: "FAIL", error: entryError });
  }, []);

  const retry = useCallback(() => {
    dispatch({ type: "RETRY" });
  }, []);

  const complete = useCallback(() => {
    lockedRef.current = false;
    dispatch({ type: "COMPLETE" });
  }, []);

  const reset = useCallback(() => {
    lockedRef.current = false;
    dispatch({ type: "RESET" });
  }, []);

  return {
    state,
    isActive: !["idle", "complete"].includes(state.phase),
    start,
    covered,
    markReady,
    fail,
    retry,
    complete,
    reset,
  };
}
