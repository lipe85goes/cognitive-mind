import {
  clearRouteRandomSeed,
  getRouteRandomCheckpoint,
  restoreRouteRandomCheckpoint,
  type RouteRandomCheckpoint,
} from "@/engine/route-random";
import {
  generateMaze,
  type MazeMap,
} from "@/games/escape-maze/route-generation";
import type { DifficultyLevel } from "@/types/game";

/**
 * ROUTE-C7A — one Rota map generation, described as data.
 *
 * ROUTE-PERF-WORKER-DECISION-01 decided generation should leave the main
 * thread (C7_GO). What stands in the way is not the map — `MazeMap` is small
 * and structured-clones, Sets included — but the stream: generation and the
 * Hunter draw from ONE `routeRandom()` stream, and in a seeded diagnostic
 * session the Hunter's first draw is the one generation left next. A Worker is
 * another realm with its own copy of `route-random`, so that position has to
 * travel with the map.
 *
 * This module is the contract that makes it travel, and nothing more:
 *
 *   createRouteGenerationRequest  (requesting realm) what to generate, and the
 *                                 realm's seeded stream if a seed is armed;
 *   runRouteGenerationSync        (generating realm) make this realm's stream
 *                                 the request's, generate, report where the
 *                                 stream ended;
 *   acceptRouteGenerationResult   (requesting realm) continue the stream from
 *                                 that report, hand back the map.
 *
 * Run in one realm, the three are exactly `generateMaze(difficulty,
 * routeNumber)`: the same single call, the same draws, and the stream left
 * where generation left it. Run across realms, the requesting realm's next
 * draw is still the one generation left — that is the whole point.
 *
 * What it is NOT, in C7A: a Worker, a Promise, a message port, a lifecycle. It
 * is synchronous, imports no React, UI, Babylon, sounds or storage, and the
 * product does not call it yet — `useEscapeMaze` still calls `generateMaze`
 * directly. C7B owns the async lifecycle (pending generation, stale results,
 * Strict Mode); C7C moves `runRouteGenerationSync` into a real Worker. A
 * request id belongs to that lifecycle's envelope, not to the request.
 *
 * Normal play has no seed, so it has no stream to carry: both checkpoints are
 * null, the generating realm draws from its own `Math.random()`, and the
 * requesting realm's `Math.random()` is never touched — distribution-equal
 * across realms, not value-equal, exactly as normal play has always been.
 */

/** Everything a realm needs to generate a map. Structured-clone-safe. */
export interface RouteGenerationRequest {
  readonly difficulty: DifficultyLevel;
  /** Passed to `generateMaze` as given; the hook normalises it first. */
  readonly routeNumber: number;
  /**
   * The requesting realm's seeded stream, or null in normal play. Only its
   * armed seed decides the map — `generateMaze` restarts the stream there — but
   * it travels whole, so the generating realm becomes an exact copy of the
   * requesting one through the same primitive the result comes back with,
   * rather than through a second way of arming a seed.
   */
  readonly random: RouteRandomCheckpoint | null;
}

/** A generated map, and where generation left the seeded stream. Structured-clone-safe. */
export interface RouteGenerationResult {
  readonly map: MazeMap;
  /** The generating realm's stream after `generateMaze`, or null in normal play. */
  readonly random: RouteRandomCheckpoint | null;
}

/**
 * The request for `generateMaze(difficulty, routeNumber)` in this realm, as it
 * stands now. Draws nothing.
 */
export function createRouteGenerationRequest(
  difficulty: DifficultyLevel,
  routeNumber: number,
): RouteGenerationRequest {
  return { difficulty, routeNumber, random: getRouteRandomCheckpoint() };
}

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

/**
 * Adopt `result` in the realm that made `request`: continue the seeded stream
 * from where generation left it, and return the map. In normal play it touches
 * nothing.
 *
 * A result that does not answer its request — a seeded request answered
 * without a checkpoint, a checkpoint of another seed, a checkpoint for a
 * normal-play request — is rejected: continuing on the wrong stream would make
 * the Hunter's next draw silently different.
 */
export function acceptRouteGenerationResult(
  request: RouteGenerationRequest,
  result: RouteGenerationResult,
): MazeMap {
  if (request.random === null) {
    if (result.random !== null) {
      throw new Error(
        "acceptRouteGenerationResult: a normal-play request was answered with a stream",
      );
    }
    return result.map;
  }
  if (!result.random || result.random.armedSeed !== request.random.armedSeed) {
    throw new Error(
      "acceptRouteGenerationResult: a seeded request was answered without its stream",
    );
  }
  restoreRouteRandomCheckpoint(result.random);
  return result.map;
}
