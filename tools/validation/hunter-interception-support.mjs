/**
 * ROTA2-ADAPTIVE-HUNTER-04 — how the packed solvers ask the PRODUCTION interception policy.
 *
 * The policy lives in one place: `planHunterInterception` (src/games/escape-maze/route-hunter-intercept.ts), the
 * module the hook runs. Both packed solvers (`dynamic-solver-packed-successors.mjs`, `rota2-dynamic-solver.mjs`) call
 * it through this adapter, which only translates a packed state into the production input and the answer back into
 * cell ids — it decides nothing. There is no second copy of the policy anywhere in tooling.
 *
 *   last direction   the packed state's component `d`: 0 = no successful step yet, 1..4 = the ACTIONS order
 *                    (UP, DOWN, LEFT, RIGHT) + 1 — so the step a solver takes with action `a` leaves `d = a + 1`.
 *   walls            the variant's own walls (`meta.wallSet`: the topology the defenders answer on);
 *   blocked          the armed traps and the Sentinel's cell, as `runDefenderPhase` builds them (a read-only view,
 *                    no allocation per call).
 *
 * The answer is the helper's: null (the pursuit decides — the solver keeps its reference support) or every move the
 * production hook may pick among, in the helper's order. Production draws one of them through the Rota's random seam
 * (`chooseInterceptionMove`); a solver enumerates them all.
 */

/** Packed direction code → production direction name. Index 0 is "no step yet". */
export const DIRECTION_CODES = Object.freeze([null, "up", "down", "left", "right"]);
/** How many values the packed component takes. */
export const DIRECTION_RADIX = DIRECTION_CODES.length;
/** The code a successful step with ACTIONS[actionIndex] leaves behind. */
export const directionCodeOfAction = (actionIndex) => actionIndex + 1;
/** Production direction name → packed code (0 for null). */
export const directionCodeOf = (name) => (name === null || name === undefined ? 0 : DIRECTION_CODES.indexOf(name));

/** A read-only `Set`-like view over (armed traps, Sentinel cell): what `planHunterInterception` reads as `blocked`. */
function blockedView(meta) {
  const view = {
    traps: 0,
    sentinel: -1,
    has(key) {
      const id = meta.keyToId.get(key);
      if (id === undefined) return false;
      return id === view.sentinel || (meta.trapBitByCell[id] & view.traps) !== 0;
    },
  };
  return view;
}

/**
 * The production interception moves as cell ids, or null when the hook would use the pursuit instead.
 * `meta` is the packed context of the topology the defenders answer on (after the step).
 */
export function interceptionMoves(meta, hunter, player, previousCode, actionIndex, traps, sentinel) {
  const intercept = meta.intercept;
  if (!intercept) return null;
  const blocked = meta.hunterBlocked ?? (meta.hunterBlocked = blockedView(meta));
  blocked.traps = traps;
  blocked.sentinel = sentinel;
  const plan = intercept.planHunterInterception({
    routeNumber: meta.routeNumber,
    difficulty: meta.difficulty,
    previousDirection: DIRECTION_CODES[previousCode],
    direction: DIRECTION_CODES[directionCodeOfAction(actionIndex)],
    hunter: meta.cells[hunter],
    explorer: meta.cells[player],
    exitPosition: meta.cells[meta.exitId],
    walls: meta.wallSet,
    blocked,
  });
  if (plan === null) return null;
  return plan.moves.map((cell) => cell.row * 9 + cell.col);
}

/**
 * Can the Hunter of this context read the direction at all? Only on a Route that adapts — the production policy's own
 * answer (`hunterAdaptsOnRoute`): on any other Route `planHunterInterception` returns null before it looks at a
 * direction, and nothing else in a solver reads `d`.
 */
export function directionObservable(meta) {
  return Boolean(meta.intercept) && meta.intercept.hunterAdaptsOnRoute(meta.routeNumber);
}

/**
 * The exploration's direction quotient. Where the direction is not observable (Route 1), two states that differ only
 * in `d` have the same successors (each successor's `d` is its action's, whatever `d` was) and the same win/loss flags:
 * they are bisimilar, and identifying them is exact — the explored graph is then the pre-mission graph, state for
 * state. `option`: "auto" (default) applies it exactly when the direction is not observable; false never applies it
 * (the full graph, for measuring what the component costs); true demands it, and refuses where `d` is observable.
 */
export function useDirectionQuotient(meta, option = "auto") {
  const observable = directionObservable(meta);
  if (option === true && observable) {
    throw new Error("direction quotient refused: this Route's Hunter reads the direction, so states differing in it are not equivalent");
  }
  return option === "auto" ? !observable : option === true;
}
