import {
  clearRouteRandomSeed,
  getRouteRandomCheckpoint,
  restoreRouteRandomCheckpoint,
} from "@/engine/route-random";
import { generateMaze } from "@/games/escape-maze/route-generation";
import type {
  RouteGenerationExecutor,
  RouteGenerationResponse,
} from "@/games/escape-maze/route-generation-client";
import type {
  RouteGenerationRequest,
  RouteGenerationResult,
} from "@/games/escape-maze/route-generation-job";

/**
 * ROUTE-C7C — the generating realm's half of a Rota map generation.
 *
 * C7A wrote one generation as request → run → accept in one module
 * (route-generation-job.ts). The request and the accept belong to the realm
 * that asks — since C7C the main thread — and the run belongs to the realm
 * that generates — since C7C a Web Worker. Kept together, the main thread
 * imported `generateMaze` (and all of its certification) only because the run
 * sat next to the accept. So the run lives here, and this is the only module
 * that reaches `generateMaze` for the product:
 *
 *   runRouteGenerationSync     C7A's run, moved verbatim: take on the
 *                              request's stream (or none), make the one
 *                              `generateMaze` call, report where the stream
 *                              ended. The Worker entry
 *                              (route-generation.worker.ts) is its one
 *                              production caller.
 *   runRouteGenerationLocally  C7B's local executor, moved verbatim from the
 *                              generation client: this realm, one macrotask
 *                              later, still blocking while it runs. NOT the
 *                              product's binding — the product's is the Worker
 *                              (route-generation-worker-executor.ts). Kept for
 *                              the tooling: same-realm runs, counterfactuals,
 *                              the C7B baseline.
 *
 * Nothing on the main thread imports this module: the generation client, the
 * session and the hook know only the job's contract and an executor.
 */

/**
 * Generate in THIS realm: take on the request's stream (or none), make the one
 * `generateMaze` call, and report the stream it left. Synchronous; throws what
 * `generateMaze` throws.
 *
 * Taking on the stream is what keeps a long-lived generating realm honest: a
 * seeded request cannot inherit a stale position, and a normal-play request
 * cannot inherit an earlier session's seed. In the requesting realm itself it
 * changes nothing — the stream it restores is the one already there.
 */
export function runRouteGenerationSync(
  request: RouteGenerationRequest,
): RouteGenerationResult {
  if (request.random === null) clearRouteRandomSeed();
  else restoreRouteRandomCheckpoint(request.random);
  const map = generateMaze(request.difficulty, request.routeNumber);
  return { map, random: getRouteRandomCheckpoint() };
}

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
