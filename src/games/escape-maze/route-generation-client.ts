import {
  acceptRouteGenerationResult,
  createRouteGenerationRequest,
  runRouteGenerationSync,
  type RouteGenerationRequest,
  type RouteGenerationResult,
} from "@/games/escape-maze/route-generation-job";
import type { MazeMap } from "@/games/escape-maze/route-generation";
import type { RouteGenerationIntent } from "@/games/escape-maze/route-session";
import type { DifficultyLevel } from "@/types/game";

/**
 * ROUTE-C7B — the seam a generation crosses, asynchronously.
 *
 * C7A described one generation as data (route-generation-job.ts: request →
 * run → accept). This module is how the hook ASKS for one and hears back
 * later, without knowing where it runs:
 *
 *   RouteGenerationCommand   the C7A request in a lifecycle envelope: the
 *                            request id and why it was asked for. The id is
 *                            the lifecycle's, never the domain's — the request
 *                            itself still has none.
 *   RouteGenerationResponse  the answer, echoing the id: the C7A result, or a
 *                            failure. Structured-clone-safe (a message, not an
 *                            Error), as a Worker's answer has to be.
 *   RouteGenerationExecutor  runs a command somewhere and delivers ONE
 *                            response, later; hands back a cancel. The one
 *                            thing C7C replaces.
 *   runRouteGenerationLocally  the executor of C7B: this realm, on the next
 *                            macrotask (`setTimeout(…, 0)`), so the request
 *                            is genuinely asynchronous — the commit that shows
 *                            "pending" happens, and the browser may paint it,
 *                            before the board is computed. The computation
 *                            itself is still synchronous on the main thread:
 *                            C7B moves WHEN it runs, not WHERE; the main
 *                            thread is still blocked while it runs. That is
 *                            C7C's (a Worker executor).
 *   startRouteGeneration     one generation, from command to accepted map,
 *                            with the latest-wins rule built in: it returns a
 *                            `withdraw`, and once withdrawn nothing of that
 *                            generation reaches the caller or the RNG.
 *
 * The executor is callback-shaped, not a Promise: a Worker answers with a
 * message event, and delivering in the very task the answer arrives in leaves
 * no microtask in which a withdrawn generation could still be "in flight".
 *
 * Cancellation is honest. A local command that has not started is cancelled
 * for real (its timer is cleared: it never runs, it never touches the RNG). A
 * command that has started cannot be interrupted — a synchronous generation
 * runs to its end, and C7C's Worker will be no different — so its response is
 * ignored instead: `startRouteGeneration` checks that it was not withdrawn and
 * that the response answers ITS request BEFORE `acceptRouteGenerationResult`
 * continues the seeded stream. A stale result never restores its checkpoint.
 *
 * Imports the C7A job, types and nothing else: no React, no UI, no Worker.
 */

export interface RouteGenerationCommand {
  readonly requestId: number;
  readonly intent: RouteGenerationIntent;
  readonly request: RouteGenerationRequest;
}

export type RouteGenerationResponse =
  | {
      readonly requestId: number;
      readonly status: "ready";
      readonly result: RouteGenerationResult;
    }
  | {
      readonly requestId: number;
      readonly status: "failed";
      readonly message: string;
    };

/**
 * Run `command` and call `deliver` exactly once with its response — never
 * synchronously, never after the returned cancel was called before the
 * command started. Returns that cancel.
 */
export type RouteGenerationExecutor = (
  command: RouteGenerationCommand,
  deliver: (response: RouteGenerationResponse) => void,
) => () => void;

/** C7B's executor: this realm, one macrotask later. Main thread, still blocking while it runs. */
export const runRouteGenerationLocally: RouteGenerationExecutor = (
  command,
  deliver,
) => {
  const timer = setTimeout(() => {
    let response: RouteGenerationResponse;
    try {
      response = {
        requestId: command.requestId,
        status: "ready",
        result: runRouteGenerationSync(command.request),
      };
    } catch (error) {
      response = {
        requestId: command.requestId,
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
      };
    }
    deliver(response);
  }, 0);
  return () => clearTimeout(timer);
};

/** The executor the Rota uses. C7C points this at the Worker. */
export const routeGenerationExecutor: RouteGenerationExecutor =
  runRouteGenerationLocally;

/** What a generation is asked for: the lifecycle's id and intent, the domain's mode and Route. */
export interface RouteGenerationOrder {
  readonly requestId: number;
  readonly intent: RouteGenerationIntent;
  readonly difficulty: DifficultyLevel;
  readonly routeNumber: number;
}

export interface RouteGenerationHandlers {
  /** The board, already accepted: the seeded stream continues from where it left. */
  onReady(map: MazeMap): void;
  onFailed(error: Error): void;
}

/**
 * One generation: build the C7A request now (the seeded stream as it stands),
 * hand it to `executor`, and — only if the response arrives before `withdraw`
 * and answers this request — accept it and report the map. Anything else is
 * dropped without a trace: no handler, no RNG.
 *
 * Each call is its own token. Withdrawing one never affects another, and a
 * response can only ever reach the handlers of the call that issued it, so a
 * remounted hook (whose request ids start over) cannot receive an answer meant
 * for the instance before it.
 */
export function startRouteGeneration(
  executor: RouteGenerationExecutor,
  order: RouteGenerationOrder,
  handlers: RouteGenerationHandlers,
): () => void {
  const request = createRouteGenerationRequest(
    order.difficulty,
    order.routeNumber,
  );
  let open = true;
  const cancel = executor(
    { requestId: order.requestId, intent: order.intent, request },
    (response) => {
      if (!open || response.requestId !== order.requestId) return;
      open = false;
      if (response.status === "failed") {
        handlers.onFailed(new Error(response.message));
        return;
      }
      let map: MazeMap;
      try {
        map = acceptRouteGenerationResult(request, response.result);
      } catch (error) {
        handlers.onFailed(
          error instanceof Error ? error : new Error(String(error)),
        );
        return;
      }
      handlers.onReady(map);
    },
  );
  return () => {
    if (!open) return;
    open = false;
    cancel();
  };
}
