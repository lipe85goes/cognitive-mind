import type {
  RouteGenerationRequest,
  RouteGenerationResult,
} from "@/games/escape-maze/route-generation-job";
import type { RouteGenerationIntent } from "@/games/escape-maze/route-session";

/**
 * ROUTE-C7C — the two messages between the Rota and its generation Worker.
 *
 * The C7B seam already speaks in structured-clone-safe values: a command (the
 * C7A request in a lifecycle envelope) goes out, a response (the C7A result,
 * or a failure as a message — never an Error) comes back. The transport adds
 * only a protocol tag around each, so a message that is not one of ours —
 * from a stale build, a foreign script, a corrupted clone — is recognised as
 * malformed instead of being read as a board:
 *
 *   main → Worker  { protocol, command }   one per Worker, then nothing else;
 *   Worker → main  { protocol, response }  one, answering that command.
 *
 * There is no cancel message. A Worker running `generateMaze` cannot read one
 * until the generation is over, so cancelling is `worker.terminate()` — real,
 * immediate — on the main side (route-generation-worker-executor.ts).
 *
 * No transport id either: each Worker runs exactly one command and is
 * terminated afterwards, so a reply's identity is the Worker it came from. The
 * request id it echoes is the C7B lifecycle id, checked again here (a reply to
 * another request is malformed) and once more by `startRouteGeneration`.
 *
 * It also holds the C7B seam's three message types — `RouteGenerationCommand`,
 * `RouteGenerationResponse`, `RouteGenerationExecutor` — moved here unchanged
 * from route-generation-client.ts (which re-exports them), so that the client
 * can import the Worker executor while the executor and the Worker entry read
 * these types without importing the client back: no import cycle, not even of
 * types.
 *
 * Main-safe: types, one constant and a shape check. Imports nothing at run time.
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

export const ROUTE_GENERATION_WORKER_PROTOCOL = "rota-generation/1";

/** The one message a generation Worker receives. */
export interface RouteGenerationWorkerJob {
  readonly protocol: typeof ROUTE_GENERATION_WORKER_PROTOCOL;
  readonly command: RouteGenerationCommand;
}

/** The one message a generation Worker sends back. */
export interface RouteGenerationWorkerReply {
  readonly protocol: typeof ROUTE_GENERATION_WORKER_PROTOCOL;
  readonly response: RouteGenerationResponse;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * The response in `data` if it is a well-formed reply to request `requestId`,
 * or null. Checks the shape the main thread reads — a ready map whose walls
 * arrived as a `Set`, a stream that is null or two numbers, a failure that is
 * a message — and nothing about the board's content: whether the stream is the
 * request's is `acceptRouteGenerationResult`'s question.
 */
export function readRouteGenerationWorkerReply(
  data: unknown,
  requestId: number,
): RouteGenerationResponse | null {
  if (!isRecord(data) || data.protocol !== ROUTE_GENERATION_WORKER_PROTOCOL) {
    return null;
  }
  const response = data.response;
  if (!isRecord(response) || response.requestId !== requestId) return null;
  if (response.status === "failed") {
    return typeof response.message === "string"
      ? { requestId, status: "failed", message: response.message }
      : null;
  }
  if (response.status !== "ready" || !isRecord(response.result)) return null;
  const { map, random } = response.result;
  if (!isRecord(map) || !(map.walls instanceof Set) || !Array.isArray(map.grid)) {
    return null;
  }
  if (
    random !== null &&
    !(
      isRecord(random) &&
      typeof random.armedSeed === "number" &&
      typeof random.state === "number"
    )
  ) {
    return null;
  }
  return response as RouteGenerationResponse;
}
