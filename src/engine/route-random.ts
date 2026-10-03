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
 * The tooling's PRNG, character for character.
 *
 * `tools/validation/route-lab.mjs :: createSeededRandom` is what every baseline
 * seed was measured with, so reproducing a witness in the browser requires the
 * same arithmetic — not merely "a" seeded generator.
 */
function createSeededDraw(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
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
