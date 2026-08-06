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

/**
 * A Rota inicializa uma engine 3D e carrega GLBs antes do primeiro frame; em
 * produção, medido com cache desligado, ela leva de 9,5 s (tablet) a 14,8 s
 * (mobile 390 com DPR 2) do CTA até a cena revelada. Com 12 s globais, o
 * watchdog disparava DURANTE um carregamento legítimo e mandava o Explorador
 * para o painel de erro. A janela é ampliada só para este mundo — os demais
 * seguem em 12 s, porque só pintam imagens.
 */
const WORLD_WATCHDOG_MS: Partial<Record<GameId, number>> = {
  "escape-maze": 28_000,
};

function watchdogWindowFor(gameId: GameId | null) {
  return (gameId && WORLD_WATCHDOG_MS[gameId]) || PREPARING_WATCHDOG_MS;
}

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
      }, watchdogWindowFor(state.gameId));
    };
    arm();

    return () => window.clearTimeout(timerId);
  }, [state.phase, state.attempt, state.gameId]);

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
