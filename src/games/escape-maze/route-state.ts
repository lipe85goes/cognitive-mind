import type { SentinelState } from "@/games/escape-maze/route-defenders";
import type { MazeMap } from "@/games/escape-maze/route-generation";
import type {
  ChestReward,
  GameStatus,
} from "@/games/escape-maze/route-invariants";
import type { DifficultyLevel, GridPosition } from "@/types/game";

/**
 * ROUTE-C5 — the Rota's mutable session state, in one place, and the one pure
 * function that changes it.
 *
 * Until C5 `useEscapeMaze` held eighteen independent `useState` cells, so a new
 * Route was eighteen writes that only became one state because React happened
 * to batch them. `RouteRuntimeState` is that state as a single value, and
 * `routeStateReducer` applies each transition the hook already made, field for
 * field — nothing it writes, nothing it increments and no message changed.
 *
 * What it is NOT:
 *
 *  - The turn. Which transition applies, in what order, with what values — the
 *    Explorer's step, the Chest pause, the defenders' answer, Second Chance,
 *    the Pickaxe, the end of a Route — is still decided by the hook, which
 *    dispatches one of these actions where it used to call a setter. A reducer
 *    case never inspects the board to choose what to do.
 *  - Domain events. The actions are transitions of this state ("count this
 *    turn", "move the defenders here"), not a record of what happened in the
 *    game; that contract is ROUTE-C6.
 *  - Derived views. The walls as they stand, the portal zone, the sets, the
 *    Chest flags, the Pickaxe targets, the score and `dynamicSolvability` are
 *    computed from this state by the hook, so there is never a second copy of
 *    something these fields already say.
 *
 * Pure: state and action in, a new state out. No React, no RNG, no map
 * generation, no sound, no clock, no storage — it does not even run the
 * defenders' policy: a new Route arrives with its board already generated and
 * the Sentinel already on its post. It imports types only.
 */

/** Every logical, mutable field of one Route session. `routeNumber` is not one: it is the session's identity. */
export interface RouteRuntimeState {
  /** The mode the board was generated for. */
  difficulty: DifficultyLevel;
  /** The certified board. Never written to: a broken wall lives in `brokenWall`. */
  mazeMap: MazeMap;
  player: GridPosition;
  /** The Hunter. */
  guardian: GridPosition;
  sentinel: SentinelState;
  /** Light keys, in the order they were collected. */
  collectedStars: string[];
  /** Armed trap keys, in the order they were armed. */
  triggeredTraps: string[];
  turns: number;
  blockedMoves: number;
  errors: number;
  status: GameStatus;
  message: string;
  /** Presentation tick: one more per blocked step. */
  blockedShake: number;
  /** Presentation tick: one more per counted turn. */
  moveTick: number;
  // ROTA-CHEST-REWARDS-01: four fields, and everything else about the Chest is
  // derived from them.
  chestOpened: boolean;
  rewardSelected: ChestReward | null;
  rewardSpent: boolean;
  /** The one wall the Pickaxe opened this Route, or null. */
  brokenWall: string | null;
}

/** What a new Route session starts from. Everything else starts at its zero. */
export interface RouteSessionStart {
  difficulty: DifficultyLevel;
  mazeMap: MazeMap;
  /** The Sentinel on its post on this board. */
  sentinel: SentinelState;
  status: GameStatus;
  message: string;
}

/**
 * A new Route session, as one coherent state: the board, the three pieces on
 * their starts, every counter at zero, nothing collected or armed, the Chest
 * closed and nothing chosen, spent or broken. The arrays are new, so no list
 * of a previous Route can leak into this one.
 */
export function createRouteState(start: RouteSessionStart): RouteRuntimeState {
  return {
    difficulty: start.difficulty,
    mazeMap: start.mazeMap,
    player: start.mazeMap.playerStart,
    guardian: start.mazeMap.guardianStart,
    sentinel: start.sentinel,
    collectedStars: [],
    triggeredTraps: [],
    turns: 0,
    blockedMoves: 0,
    errors: 0,
    status: start.status,
    message: start.message,
    blockedShake: 0,
    moveTick: 0,
    chestOpened: false,
    rewardSelected: null,
    rewardSpent: false,
    brokenWall: null,
  };
}

/**
 * The transitions the hook applies. Each names the fields it writes; every
 * other field is kept as it is, by identity.
 */
export type RouteStateAction =
  /** A new Route session (start, restart, mode change): `createRouteState`. */
  | ({ type: "START_ROUTE" } & RouteSessionStart)
  /** A step into a wall or off the board: one more blocked move and shake. */
  | { type: "BLOCK_STEP"; message: string }
  /** A turn is counted: `turns` becomes the given number, `moveTick` one more. */
  | { type: "COUNT_TURN"; turns: number }
  /** The Explorer stands on `player` with these lights; `armedTrap`, when set, joins the armed traps. */
  | {
      type: "MOVE_EXPLORER";
      player: GridPosition;
      collectedStars: string[];
      armedTrap: string | null;
    }
  /** The Chest is open, and the turn waits for a reward. */
  | { type: "OPEN_CHEST"; message: string }
  | { type: "SELECT_REWARD"; reward: ChestReward }
  /** The held Second Chance is spent. */
  | { type: "SPEND_SECOND_CHANCE"; message: string }
  /** The Pickaxe opened `wall`, and is spent with it. */
  | { type: "OPEN_WALL"; wall: string }
  /** The defenders end the turn on these cells, nobody caught. */
  | {
      type: "SETTLE_DEFENDERS";
      guardian: GridPosition;
      sentinel: SentinelState;
      message: string;
    }
  /** The Explorer was caught: the pieces stand here, and the capture is one more error. */
  | {
      type: "COMMIT_CAPTURE";
      guardian: GridPosition;
      sentinel: SentinelState;
      errors: number;
    }
  /** The Route is over. */
  | { type: "END_ROUTE"; status: "won" | "lost"; message: string };

export function routeStateReducer(
  state: RouteRuntimeState,
  action: RouteStateAction,
): RouteRuntimeState {
  switch (action.type) {
    case "START_ROUTE":
      return createRouteState(action);
    case "BLOCK_STEP":
      return {
        ...state,
        blockedMoves: state.blockedMoves + 1,
        blockedShake: state.blockedShake + 1,
        message: action.message,
      };
    case "COUNT_TURN":
      return { ...state, turns: action.turns, moveTick: state.moveTick + 1 };
    case "MOVE_EXPLORER":
      return {
        ...state,
        player: action.player,
        collectedStars: action.collectedStars,
        triggeredTraps:
          action.armedTrap === null
            ? state.triggeredTraps
            : [...state.triggeredTraps, action.armedTrap],
      };
    case "OPEN_CHEST":
      return { ...state, chestOpened: true, message: action.message };
    case "SELECT_REWARD":
      return { ...state, rewardSelected: action.reward };
    case "SPEND_SECOND_CHANCE":
      return { ...state, rewardSpent: true, message: action.message };
    case "OPEN_WALL":
      return { ...state, brokenWall: action.wall, rewardSpent: true };
    case "SETTLE_DEFENDERS":
      return {
        ...state,
        guardian: action.guardian,
        sentinel: action.sentinel,
        message: action.message,
      };
    case "COMMIT_CAPTURE":
      return {
        ...state,
        guardian: action.guardian,
        sentinel: action.sentinel,
        errors: action.errors,
      };
    case "END_ROUTE":
      return { ...state, status: action.status, message: action.message };
  }
}
