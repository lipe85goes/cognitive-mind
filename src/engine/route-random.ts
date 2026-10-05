/**
 * The Rota's single source of randomness, and the seam a diagnostic session
 * uses to make a scenario reproducible.
 *
 * ROTA-DIFFICULTY-04C. Before this file, `Math.random()` was called directly in
 * two modules — `engine/difficulty.ts` (the Hunter's policy) and
 * `games/escape-maze/useEscapeMaze.ts` (generation) — and there was no way to
 * replay a board in the real game. The validation tooling could only seed by
 * running the compiled hook inside a `vm` sandbox with the `Math` global
 * swapped, which is not something a browser can do.
 *
 * What this is NOT:
 *
 *  - it does not replace the global `Math.random`, for the Rota or anything else;
 *  - it is not on by default, and nothing in the product arms it;
 *  - it changes no probability. Every call site draws exactly one number in
 *    exactly the same order it always did.
 *
 * With nothing armed, `routeRandom()` is `Math.random()` — a single extra
 * function call, and the same stochastic gameplay the product has always had.
 */

/** Live only while a diagnostic session is running. Null in normal play. */
let seededDraw: (() => number) | null = null;
let armedSeed: number | null = null;
/**
 * Where the seeded stream stands: the PRNG's whole state. Meaningful only while
 * `seededDraw` is set; reset to 0 whenever the stream is.
 *
 * ROUTE-C7A: it used to be a `let` inside `createSeededDraw`'s closure, where
 * nothing could read it, so "where did generation leave the stream?" had no
 * answer outside that closure. Lifting it here changes no arithmetic: the same
 * statements run on the same number, in the same order.
 *
 * It is NOT kept as a uint32. The tooling's PRNG never wraps its counter
 * (`state += 0x6d2b79f5` on a plain number, truncated only inside the mix), so
 * after enough draws (~4.9M from any seed) the counter passes 2^53 and the
 * double's rounding becomes part of the sequence. Wrapping it — here or in a
 * checkpoint — would be a different generator from that point on.
 */
let seededState = 0;

/**
 * The tooling's PRNG, character for character.
 *
 * `tools/validation/route-lab.mjs :: createSeededRandom` is what every baseline
 * seed was measured with, so reproducing a witness in the browser requires the
 * same arithmetic — not merely "a" seeded generator.
 *
 * ROUTE-C7A: the closure's `state` is now the module's `seededState`, so a
 * checkpoint can read it and a restore can set it; the draw is otherwise the
 * same function, statement for statement.
 */
function createSeededDraw(state: number): () => number {
  seededState = state;
  return () => {
    seededState += 0x6d2b79f5;
    let value = seededState;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** Every random draw the Rota makes, in production and in diagnostics alike. */
export function routeRandom(): number {
  return seededDraw ? seededDraw() : Math.random();
}

/**
 * One uniform pick from `items`: exactly one `routeRandom()` draw.
 *
 * ROUTE-C2: moved here verbatim from `useEscapeMaze.ts`, because both halves
 * of the Rota pick with it — map generation (`route-generation.ts`: template,
 * exit, Guardian seat) and the Hunter's tie-breaks in the hook — and they draw
 * from this one stream in that order. Living beside the stream keeps neither
 * half depending on the other just to share it.
 */
export function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(routeRandom() * items.length)];
}

/**
 * Arm a diagnostic session. Developer tooling only — nothing in the product
 * calls this, and `/lab/route-launcher` is its single caller.
 */
export function armRouteRandomSeed(seed: number): void {
  armedSeed = seed >>> 0;
  seededDraw = createSeededDraw(armedSeed);
}

/**
 * Disarm. Called when the diagnostic page unmounts, so a seeded session can
 * never bleed into a normal journey started afterwards.
 */
export function clearRouteRandomSeed(): void {
  armedSeed = null;
  seededDraw = null;
  seededState = 0;
}

/** The armed seed, or null in normal play. Read by the launcher and by tests. */
export function getArmedRouteSeed(): number | null {
  return armedSeed;
}

/**
 * Restart the seeded stream at the top of a map generation.
 *
 * A no-op unless a seed is armed, which is what keeps normal play untouched.
 *
 * When armed it makes a generation reproducible *as a generation*, which is the
 * property a playtester actually needs: the map is the same on Launch, on
 * "Iniciar rota", and on every Restart of that session. It is also what makes a
 * baseline witness reachable at all — those seeds were measured as a single
 * `generateMaze(difficulty, route)` call from a fresh stream, and the hook
 * reaches its playable board only on its second generation.
 *
 * Draws AFTER a generation — the Hunter's, above all — continue along the same
 * stream, so a seeded session's runtime decisions are reproducible too, up to
 * the next generation.
 */
export function beginSeededGeneration(): void {
  if (armedSeed === null) return;
  seededDraw = createSeededDraw(armedSeed);
}

/**
 * ROUTE-C7A — the seeded stream as data: enough to continue it EXACTLY, in
 * this realm or another (a Worker, a fresh module graph), and nothing else.
 *
 *   armedSeed  the diagnostic session's seed, uint32 — what every later
 *              `beginSeededGeneration()` restarts the stream at;
 *   state      the PRNG's position, verbatim (see `seededState`): the next
 *              draw is a pure function of it.
 *
 * Two numbers, no function, no bigint: structured-clone-safe and JSON-safe as
 * long as `state` stays finite, which it does for any stream that could
 * actually be drawn. There is no checkpoint of normal play — `Math.random()`
 * has no state this module owns, and none is invented for it.
 */
export interface RouteRandomCheckpoint {
  readonly armedSeed: number;
  readonly state: number;
}

/**
 * Where the seeded stream stands, or null in normal play (nothing armed).
 *
 * A snapshot: a fresh object every call, which the stream never reads back, so
 * mutating it changes nothing here. Reading it draws nothing.
 */
export function getRouteRandomCheckpoint(): RouteRandomCheckpoint | null {
  if (armedSeed === null) return null;
  return { armedSeed, state: seededState };
}

/**
 * Continue a seeded stream from `checkpoint`: the next `routeRandom()` is the
 * draw the realm that took the checkpoint would have made next.
 *
 * It restores the armed seed too, so the next `beginSeededGeneration()` still
 * restarts at that seed — a restore moves the stream, never what a generation
 * starts from. Its callers are the generation job (route-generation-job.ts,
 * the future Worker handoff) and validation tooling; it can only replicate a
 * stream some realm already armed, never create one in normal play.
 *
 * A malformed checkpoint is rejected before anything changes: a half-restored
 * stream, or one running on NaN, would be a silent different sequence.
 */
export function restoreRouteRandomCheckpoint(
  checkpoint: RouteRandomCheckpoint,
): void {
  const seed = checkpoint?.armedSeed;
  const state = checkpoint?.state;
  if (
    typeof seed !== "number" ||
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 0xffffffff ||
    typeof state !== "number" ||
    !Number.isInteger(state) ||
    state < seed
  ) {
    throw new TypeError(
      "restoreRouteRandomCheckpoint: not a seeded stream checkpoint",
    );
  }
  armedSeed = seed;
  seededDraw = createSeededDraw(state);
}
