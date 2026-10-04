import type { SentinelState } from "@/games/escape-maze/route-defenders";
import type { ChestReward } from "@/games/escape-maze/route-invariants";
import type {
  RouteSessionStart,
  RouteStateAction,
} from "@/games/escape-maze/route-state";
import type { GridPosition } from "@/types/game";

/**
 * ROUTE-C6 — what just happened in the Rota, as a typed value.
 *
 * route-state.ts (ROUTE-C5) says HOW the session's state changes: "count this
 * turn", "move the defenders here". This module says WHAT happened in the
 * game: the Explorer stepped, a trap armed, the Hunter caught the Explorer,
 * the Second Chance absorbed a capture, the Route ended. Each event names its
 * meaning — a reason, a cause, an outcome — and carries only what describes it
 * unambiguously and what the state needs from it. A message the state shows
 * travels with the event that shows it, but it is still chosen by the hook:
 * this module holds no copy.
 *
 * `routeStateActionsForEvent` translates an event that has ALREADY happened
 * into the C5 transitions that record it, in order. It never decides whether
 * the event happened, and it never reads the state: whatever the transition
 * needs is in the event. Some events record nothing of their own — a light
 * collected, the portal activated, a trap armed are already written, atomically,
 * by the step that caused them — and translate to no transition at all, so
 * applying one never renders.
 *
 * What it is NOT:
 *
 *  - The turn. Which events happen, in what order, with what values — and the
 *    sounds, `onComplete`, map generation and the input guard around them — is
 *    decided by `useEscapeMaze`, which applies each event through one seam.
 *  - A bus. Events are synchronous and ephemeral: nothing subscribes to them,
 *    nothing stores, queues, replays or reports them, and no component knows
 *    this module. They are the seam later feedback sequences and Gameplay 2.0
 *    will read from.
 *
 * Pure: no React, no RNG, no map generation, no sound, no clock, no browser,
 * no storage. It imports types only — the transitions and the session start
 * from route-state, and the domain's own types — and reaches nothing at run
 * time.
 */

/** Why the Explorer's step did not happen: off the board, or into a wall. */
export type ExplorerBlockReason = "boundary" | "wall";

/** Who caught the Explorer: its own step onto a defender, the Hunter, or the Sentinel. */
export type ExplorerCaptureBy = "explorer-step" | "hunter" | "sentinel";

/** The capture the Second Chance absorbed: the Explorer's own step, the Hunter's, or the Sentinel's. */
export type SecondChanceCause = "explorer" | "hunter" | "sentinel";

export type RouteOutcome = "won" | "lost";

/**
 * Everything that happens in a Route session, as the hook reports it. A closed
 * union: every member is one occurrence, discriminated by `type`. `turn` is the
 * turn the occurrence belongs to — a Chest's pause and the reward that resumes
 * it share one.
 */
export type RouteDomainEvent =
  /**
   * Route `routeNumber` opened a new session on a freshly generated board:
   * start or restart ("playing"), or a change of mode (back to "setup").
   */
  | ({ type: "ROUTE_STARTED"; routeNumber: number } & RouteSessionStart)
  /** The Explorer tried to step into `cell` and could not. No turn passes. */
  | {
      type: "EXPLORER_STEP_BLOCKED";
      reason: ExplorerBlockReason;
      cell: GridPosition;
      message: string;
    }
  /**
   * The Explorer stepped onto `to`, and turn `turn` is counted. `collectedStars`
   * are its lights after the step and `armedTrap` the trap the step armed —
   * written together with the step, as one transition.
   */
  | {
      type: "EXPLORER_STEP_COMMITTED";
      turn: number;
      to: GridPosition;
      collectedStars: string[];
      armedTrap: string | null;
    }
  /** The step collected this light. Recorded by the step itself. */
  | { type: "LIGHT_COLLECTED"; turn: number; light: string }
  /** That light was the last one: the portal is open. Recorded by the step itself. */
  | { type: "PORTAL_ACTIVATED"; turn: number }
  /** The step armed this trap; the defenders respect it from this very turn. Recorded by the step itself. */
  | { type: "TRAP_ARMED"; turn: number; trap: string }
  /** The Explorer reached the Chest: it opens and the turn pauses until a reward is chosen. */
  | { type: "CHEST_OPENED"; turn: number; message: string }
  /** The Explorer chose its reward. Not a turn: the paused turn resumes. */
  | { type: "REWARD_SELECTED"; turn: number; reward: ChestReward }
  /** The Pickaxe opened `wall` and is spent with it; opening it is turn `turn`. */
  | { type: "WALL_OPENED"; turn: number; wall: string }
  /**
   * The held Second Chance absorbed a capture at `at`, and is spent. Nobody
   * moves: an Explorer's step into a defender does not happen (its turn is
   * still counted), a defender's step is dropped together with the other's.
   */
  | {
      type: "SECOND_CHANCE_USED";
      cause: SecondChanceCause;
      turn: number;
      at: GridPosition;
      message: string;
    }
  /** The defenders answered and caught nobody: they end the turn here. */
  | {
      type: "DEFENDERS_SETTLED";
      turn: number;
      guardian: GridPosition;
      sentinel: SentinelState;
      message: string;
    }
  /** The Explorer was caught at `at`: the pieces stand here, and it is the session's `errors`-th error. */
  | {
      type: "EXPLORER_CAPTURED";
      by: ExplorerCaptureBy;
      turn: number;
      at: GridPosition;
      guardian: GridPosition;
      sentinel: SentinelState;
      errors: number;
    }
  /** The Route is over. `journeyCompleted`: it was the journey's last Route, won. */
  | {
      type: "ROUTE_ENDED";
      outcome: RouteOutcome;
      turn: number;
      journeyCompleted: boolean;
      message: string;
    };

/**
 * The C5 transitions that record an event, in the order they apply. Pure and
 * total: the same event always gives the same transitions, and an event that
 * is already recorded by the one before it gives none.
 */
export function routeStateActionsForEvent(
  event: RouteDomainEvent,
): RouteStateAction[] {
  switch (event.type) {
    case "ROUTE_STARTED":
      return [
        {
          type: "START_ROUTE",
          difficulty: event.difficulty,
          mazeMap: event.mazeMap,
          sentinel: event.sentinel,
          status: event.status,
          message: event.message,
        },
      ];
    case "EXPLORER_STEP_BLOCKED":
      return [{ type: "BLOCK_STEP", message: event.message }];
    case "EXPLORER_STEP_COMMITTED":
      return [
        { type: "COUNT_TURN", turns: event.turn },
        {
          type: "MOVE_EXPLORER",
          player: event.to,
          collectedStars: event.collectedStars,
          armedTrap: event.armedTrap,
        },
      ];
    case "LIGHT_COLLECTED":
    case "PORTAL_ACTIVATED":
    case "TRAP_ARMED":
      return [];
    case "CHEST_OPENED":
      return [{ type: "OPEN_CHEST", message: event.message }];
    case "REWARD_SELECTED":
      return [{ type: "SELECT_REWARD", reward: event.reward }];
    case "WALL_OPENED":
      return [
        { type: "OPEN_WALL", wall: event.wall },
        { type: "COUNT_TURN", turns: event.turn },
      ];
    case "SECOND_CHANCE_USED":
      // The Explorer's own step never happened, so nothing else counted its
      // turn; a defender's capture came after a step or a wall that did.
      return event.cause === "explorer"
        ? [
            { type: "SPEND_SECOND_CHANCE", message: event.message },
            { type: "COUNT_TURN", turns: event.turn },
          ]
        : [{ type: "SPEND_SECOND_CHANCE", message: event.message }];
    case "DEFENDERS_SETTLED":
      return [
        {
          type: "SETTLE_DEFENDERS",
          guardian: event.guardian,
          sentinel: event.sentinel,
          message: event.message,
        },
      ];
    case "EXPLORER_CAPTURED":
      return [
        {
          type: "COMMIT_CAPTURE",
          guardian: event.guardian,
          sentinel: event.sentinel,
          errors: event.errors,
        },
      ];
    case "ROUTE_ENDED":
      return [{ type: "END_ROUTE", status: event.outcome, message: event.message }];
  }
}
