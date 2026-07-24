import type { GameId } from "@/types/game";

export type WorldEntryPhase =
  | "idle"
  | "covering"
  | "preparing"
  | "ready"
  | "revealing"
  | "complete"
  | "error";

export interface WorldEntryState {
  phase: WorldEntryPhase;
  gameId: GameId | null;
  attempt: number;
  error: Error | null;
}

export type WorldEntryAction =
  | { type: "START"; gameId: GameId }
  | { type: "COVERED" }
  | { type: "READY" }
  | { type: "REVEAL" }
  | { type: "COMPLETE" }
  | { type: "FAIL"; error: Error }
  | { type: "RETRY" }
  | { type: "RESET" };

export const INITIAL_WORLD_ENTRY_STATE: WorldEntryState = {
  phase: "idle",
  gameId: null,
  attempt: 0,
  error: null,
};

/**
 * Entry transitions are intentionally strict. Unexpected or stale events are
 * ignored so a late asset callback cannot reveal or replace another world.
 */
export function worldEntryReducer(
  state: WorldEntryState,
  action: WorldEntryAction,
): WorldEntryState {
  switch (action.type) {
    case "START":
      if (state.phase !== "idle" && state.phase !== "complete") return state;
      return {
        phase: "covering",
        gameId: action.gameId,
        attempt: state.attempt + 1,
        error: null,
      };
    case "COVERED":
      return state.phase === "covering"
        ? { ...state, phase: "preparing" }
        : state;
    case "READY":
      return state.phase === "preparing"
        ? { ...state, phase: "ready", error: null }
        : state;
    case "REVEAL":
      return state.phase === "ready"
        ? { ...state, phase: "revealing" }
        : state;
    case "COMPLETE":
      return state.phase === "revealing"
        ? { ...state, phase: "complete" }
        : state;
    case "FAIL":
      if (
        state.phase !== "covering" &&
        state.phase !== "preparing" &&
        state.phase !== "ready"
      ) {
        return state;
      }
      return { ...state, phase: "error", error: action.error };
    case "RETRY":
      return state.phase === "error"
        ? {
            ...state,
            phase: "preparing",
            attempt: state.attempt + 1,
            error: null,
          }
        : state;
    case "RESET":
      return INITIAL_WORLD_ENTRY_STATE;
    default:
      return state;
  }
}
