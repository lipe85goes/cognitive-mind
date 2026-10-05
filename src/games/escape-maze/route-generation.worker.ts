import { runRouteGenerationSync } from "@/games/escape-maze/route-generation-runner";
import {
  ROUTE_GENERATION_WORKER_PROTOCOL,
  type RouteGenerationResponse,
  type RouteGenerationWorkerJob,
  type RouteGenerationWorkerReply,
} from "@/games/escape-maze/route-generation-worker-protocol";

/**
 * ROUTE-C7C — the Rota's generation Worker: the one production realm that runs
 * `runRouteGenerationSync`, and so `generateMaze` and its certification.
 *
 * It receives one command, runs C7A's run on it — this realm takes on the
 * request's seeded stream, or clears any (normal play then draws from THIS
 * realm's `Math.random`), generates, and reports where the stream ended — and
 * posts one reply. The map crosses back by structured clone, its walls still a
 * `Set`. Nothing else happens here: no UI, React, Babylon, sound, storage or
 * session state; its graph is the runner, generation's own dependencies and
 * the protocol.
 *
 * A generation that throws is answered with a failure, as C7B's local executor
 * answered it. A message this realm cannot read (a `messageerror`, or data
 * that is not a job) is thrown out of the handler on purpose: an uncaught
 * error in a Worker reaches the main thread as the Worker's `error` event,
 * which the executor turns into that same failure. There is no path that ends
 * without a reply or an error. The main thread terminates the Worker after it
 * answers, and to cancel it — this file never closes itself.
 */

self.addEventListener("message", (event: MessageEvent<RouteGenerationWorkerJob>) => {
  const job = event.data;
  if (job?.protocol !== ROUTE_GENERATION_WORKER_PROTOCOL || !job.command) {
    throw new Error("route generation worker: not a generation job");
  }
  const { command } = job;
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
  const reply: RouteGenerationWorkerReply = {
    protocol: ROUTE_GENERATION_WORKER_PROTOCOL,
    response,
  };
  self.postMessage(reply);
});

self.addEventListener("messageerror", () => {
  throw new Error("route generation worker: the generation job could not be read");
});
