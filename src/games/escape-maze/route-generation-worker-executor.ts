import {
  ROUTE_GENERATION_WORKER_PROTOCOL,
  readRouteGenerationWorkerReply,
  type RouteGenerationExecutor,
  type RouteGenerationResponse,
  type RouteGenerationWorkerJob,
} from "@/games/escape-maze/route-generation-worker-protocol";

/**
 * ROUTE-C7C — the Rota's executor: one generation, in a Web Worker.
 *
 * C7B's seam is `(command, deliver) => cancel`. This is that seam with the
 * computation moved off the main thread: the command is posted to a dedicated
 * Worker (route-generation.worker.ts), the Worker runs C7A's run on it, and its
 * one reply becomes the one response `deliver` gets. The lifecycle above —
 * latest wins, the token, accept-after-check, pending/error/retry — does not
 * know the difference.
 *
 * ONE WORKER PER COMMAND. Created when the command is executed, terminated as
 * soon as it answers, fails or is cancelled. Generation is asked for only on
 * mount, Start, Restart and a mode change, and a Worker's start-up is small
 * next to a generation, so a pool or a long-lived Worker would buy nothing and
 * cost a protocol:
 *
 *   - cancelling is real at any moment: `terminate()` stops a generation in
 *     the middle of `generateMaze`, so a superseded board never delays the
 *     next one (a long-lived Worker would finish the stale one first — a
 *     message cannot interrupt a synchronous function);
 *   - a reply's identity is the Worker it came from: two hook instances whose
 *     request ids both start at 1 never share a Worker, so no transport id is
 *     needed, and the C7B request id is still checked on the way in;
 *   - nothing outlives its command: no Worker is left behind by an unmount, a
 *     Strict Mode cleanup or a superseded request.
 *
 * Every way a Worker can fail ends in the C7B failure response, never in a
 * silent fallback to the main thread (that would hide a deploy or CSP problem
 * behind the very blocking this module exists to remove): the constructor
 * throwing (no Worker support, a blocked script), the script failing to load
 * or throwing (`error`), a reply that cannot be deserialized (`messageerror`)
 * or is not a reply to this command, and — the one failure no event reports —
 * a Worker that never answers, after `ROUTE_GENERATION_WORKER_TIMEOUT_MS`.
 * Like every executor, it never delivers synchronously and never after cancel.
 *
 * Nothing runs at import: the Worker is constructed only when a command is
 * executed — in the hook's effect, in the browser, never during SSR. The
 * `new Worker(new URL("./route-generation.worker.ts", import.meta.url))` form
 * is what lets the bundler give the Worker its own chunk; generation is in
 * that chunk, not in the main thread's.
 */

/** How long a Worker may stay silent before its generation counts as failed. */
export const ROUTE_GENERATION_WORKER_TIMEOUT_MS = 30_000;

export const runRouteGenerationInWorker: RouteGenerationExecutor = (
  command,
  deliver,
) => {
  let worker: Worker | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let open = true;

  const stop = () => {
    open = false;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (worker !== null) {
      worker.onmessage = null;
      worker.onerror = null;
      worker.onmessageerror = null;
      worker.terminate();
      worker = null;
    }
  };
  const settle = (response: RouteGenerationResponse) => {
    if (!open) return;
    stop();
    deliver(response);
  };
  const fail = (message: string) =>
    settle({ requestId: command.requestId, status: "failed", message });
  /** A failure found while executing: reported on the next macrotask, cancellable like any answer. */
  const failLater = (message: string) => {
    if (worker !== null) {
      worker.terminate();
      worker = null;
    }
    timer = setTimeout(() => fail(message), 0);
  };
  const reason = (error: unknown) =>
    error instanceof Error ? error.message : String(error);

  try {
    worker = new Worker(
      new URL("./route-generation.worker.ts", import.meta.url),
      { type: "module", name: "rota-generation" },
    );
  } catch (error) {
    failLater(`route generation worker could not start: ${reason(error)}`);
    return stop;
  }
  worker.onmessage = (event: MessageEvent<unknown>) => {
    const response = readRouteGenerationWorkerReply(
      event.data,
      command.requestId,
    );
    if (response === null) fail("route generation worker: malformed reply");
    else settle(response);
  };
  worker.onerror = (event: ErrorEvent) => {
    event.preventDefault();
    fail(`route generation worker failed: ${event.message || "script error"}`);
  };
  worker.onmessageerror = () =>
    fail("route generation worker: the reply could not be read");

  const job: RouteGenerationWorkerJob = {
    protocol: ROUTE_GENERATION_WORKER_PROTOCOL,
    command,
  };
  try {
    worker.postMessage(job);
  } catch (error) {
    failLater(`route generation worker: the command could not be sent: ${reason(error)}`);
    return stop;
  }
  timer = setTimeout(
    () => fail("route generation worker: no reply"),
    ROUTE_GENERATION_WORKER_TIMEOUT_MS,
  );
  return stop;
};
