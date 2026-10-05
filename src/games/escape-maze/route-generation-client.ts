import {
  acceptRouteGenerationResult,
  createRouteGenerationRequest,
} from "@/games/escape-maze/route-generation-job";
import { runRouteGenerationInWorker } from "@/games/escape-maze/route-generation-worker-executor";
import type {
  RouteGenerationCommand,
  RouteGenerationExecutor,
  RouteGenerationResponse,
} from "@/games/escape-maze/route-generation-worker-protocol";
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
 * ROUTE-C7C — the seam is unchanged; what it is bound to changed. The local
 * executor described above moved, with the run it calls, to
 * route-generation-runner.ts (the tooling's); `routeGenerationExecutor` is the
 * Worker executor. Cancelling a started command is now real too — the Worker
 * is terminated mid-generation — and the token above still guards whatever
 * answer could be in flight. This module no longer reaches `generateMaze`: it
 * imports the job's main-thread half (request, accept) and the Worker
 * executor, which imports only the transport protocol.
 *
 * Imports the C7A job, the Worker executor, types and nothing else: no React,
 * no UI, no generation.
 */

// ROUTE-C7C: the seam's three message types moved, unchanged, to the generation
// protocol (route-generation-worker-protocol.ts), which the Worker executor and
// the Worker entry read them from without importing this module back; they are
// re-exported here, where the seam always offered them.
export type {
  RouteGenerationCommand,
  RouteGenerationExecutor,
  RouteGenerationResponse,
};

/**
 * The executor the Rota uses. ROUTE-C7C: a dedicated Web Worker per command
 * (route-generation-worker-executor.ts) — the generation and its
 * certification run off the main thread, and cancelling terminates the
 * Worker. C7B's local executor, `runRouteGenerationLocally`, moved with the
 * run to route-generation-runner.ts: tooling only, never this binding.
 */
export const routeGenerationExecutor: RouteGenerationExecutor =
  runRouteGenerationInWorker;

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
