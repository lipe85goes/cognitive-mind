import type { GameStatus } from "@/games/escape-maze/route-invariants";
import {
  createRouteState,
  routeStateReducer,
  type RouteRuntimeState,
  type RouteSessionStart,
  type RouteStateAction,
} from "@/games/escape-maze/route-state";
import type { DifficultyLevel } from "@/types/game";

/**
 * ROUTE-C7B — the hook's whole state: the match, and where the generation of
 * its next board stands.
 *
 * Until C7B a board was generated inside the transition that needed it — the
 * reducer's initialiser and `startNewMaze` called `generateMaze` and had the
 * map on the next line. A generation is now asked for and answered later
 * (route-generation-client.ts), so "which board comes next, and has it
 * arrived?" became state of its own. It lives HERE, beside the match and in
 * the same value, because the two change together: a board that arrives IS a
 * new Route session, and accepting one is one transition that installs the
 * session and settles the generation at once. There is no second copy of the
 * map — a board is either the session's (`route.mazeMap`) or not here at all.
 *
 *   route       the C5 match (`RouteRuntimeState`), or null before this
 *               mount's first board has been accepted. Never a placeholder:
 *               "no board yet" is null, and nothing derives from it.
 *   generation  "ready" (the match is the latest board asked for), "pending"
 *               (a board is being generated: the match, if any, is frozen) or
 *               "error" (that generation failed: the match, if any, is frozen
 *               and nothing of the failed one was applied). Pending and error
 *               carry the `target` — what was asked for, under which request.
 *   requests    how many generations this state has asked for: the next
 *               request id. Monotonic for the life of the hook instance.
 *
 * What it is NOT: the async part. Scheduling, cancelling, running the job and
 * accepting its RNG are effects, and the hook runs them; this reducer only
 * records that a generation was asked for, failed, or (through C5's
 * `START_ROUTE`) arrived. Pure: no React, RNG, generation, timers, sounds or
 * storage. The match's own transitions are still `routeStateReducer`'s, and
 * while a generation is pending or failed the match does not move.
 */

/** Why a board is being generated. */
export type RouteGenerationIntent =
  /** The session's first board, asked for by the mount itself. */
  | "mount"
  /** "Iniciar rota" from setup. */
  | "start"
  /** "Começar outra rota" while playing. */
  | "restart"
  /** A mode chosen in setup. */
  | "difficulty";

/** One generation asked for: under which request, why, and the session it opens. */
export interface RouteGenerationTarget {
  readonly requestId: number;
  readonly intent: RouteGenerationIntent;
  readonly difficulty: DifficultyLevel;
  /** The status the new session opens in. */
  readonly status: Extract<GameStatus, "setup" | "playing">;
}

export type RouteGenerationState =
  | { readonly phase: "ready" }
  | { readonly phase: "pending"; readonly target: RouteGenerationTarget }
  | { readonly phase: "error"; readonly target: RouteGenerationTarget };

export interface RouteSessionState {
  readonly route: RouteRuntimeState | null;
  readonly generation: RouteGenerationState;
  readonly requests: number;
}

export type RouteSessionAction =
  /** A new board is asked for. Supersedes whatever was pending or failed. */
  | {
      type: "GENERATION_REQUESTED";
      intent: RouteGenerationIntent;
      difficulty: DifficultyLevel;
      status: Extract<GameStatus, "setup" | "playing">;
    }
  /** The failed generation is asked for again, under a new request. */
  | { type: "GENERATION_RETRIED" }
  /** Request `requestId` failed. Ignored unless it is the one pending. */
  | { type: "GENERATION_FAILED"; requestId: number }
  /**
   * The mount's first board, accepted: the session's starting value. Not a
   * transition of the match and not a domain event — before C7B it was the
   * reducer's initialiser (`createRouteState`), and it still is exactly that.
   */
  | ({ type: "INITIAL_ROUTE" } & RouteSessionStart)
  /** The match's own transitions (C5). `START_ROUTE` is an accepted board. */
  | RouteStateAction;

const READY: RouteGenerationState = { phase: "ready" };

/**
 * A mount's state: no board yet, and its first one asked for — request 1, for
 * the mode and the setup screen the session opens on.
 */
export function createRouteSessionState(
  initialDifficulty: DifficultyLevel,
): RouteSessionState {
  return {
    route: null,
    requests: 1,
    generation: {
      phase: "pending",
      target: {
        requestId: 1,
        intent: "mount",
        difficulty: initialDifficulty,
        status: "setup",
      },
    },
  };
}

export function routeSessionReducer(
  state: RouteSessionState,
  action: RouteSessionAction,
): RouteSessionState {
  switch (action.type) {
    case "GENERATION_REQUESTED": {
      const requestId = state.requests + 1;
      return {
        ...state,
        requests: requestId,
        generation: {
          phase: "pending",
          target: {
            requestId,
            intent: action.intent,
            difficulty: action.difficulty,
            status: action.status,
          },
        },
      };
    }
    case "GENERATION_RETRIED": {
      if (state.generation.phase !== "error") return state;
      const requestId = state.requests + 1;
      return {
        ...state,
        requests: requestId,
        generation: {
          phase: "pending",
          target: { ...state.generation.target, requestId },
        },
      };
    }
    case "GENERATION_FAILED":
      if (
        state.generation.phase !== "pending" ||
        state.generation.target.requestId !== action.requestId
      ) {
        return state;
      }
      return {
        ...state,
        generation: { phase: "error", target: state.generation.target },
      };
    case "INITIAL_ROUTE":
      return {
        ...state,
        route: createRouteState({
          difficulty: action.difficulty,
          mazeMap: action.mazeMap,
          sentinel: action.sentinel,
          status: action.status,
          message: action.message,
        }),
        generation: READY,
      };
    case "START_ROUTE":
      // An accepted board: the new session and the settled generation, in one
      // transition — C5's START_ROUTE. (Only a mode chosen before the mount's
      // first board arrived can find no match to replace.)
      return {
        ...state,
        route:
          state.route === null
            ? createRouteState(action)
            : routeStateReducer(state.route, action),
        generation: READY,
      };
    default:
      // While a board is pending or failed, the match does not move.
      if (state.route === null || state.generation.phase !== "ready") {
        return state;
      }
      return { ...state, route: routeStateReducer(state.route, action) };
  }
}
