/**
 * ROTA2-SENTINEL-SOLVER-FIDELITY-03 — the distance the Sentinel measures to its target, as the hook measures it.
 *
 * Production (`decideSentinelMove`, src/games/escape-maze/route-defenders.ts) releases its commitment and scores
 * every move with one map:
 *
 *     toTarget = getReachableDistances(target, graph)      // graph = the turn's walls ∪ the armed traps
 *
 * and `getReachableDistances` (route-geometry.ts) SEEDS its start cell at 0 whether or not that cell is in `graph`,
 * then expands through `getNeighbors(current, graph)`. So when the target is itself an armed trap — a door the
 * Explorer has just stepped on, or one armed earlier — the map is not empty: the trap's legal neighbours sit at 1 and
 * the walkable maze is reached through them. The hook keeps the door (the Sentinel can still "reach" it) and walks
 * toward it.
 *
 * The packed solvers keep one all-pairs table per armed-trap mask (`trapVariant`), whose BFS SKIPS a blocked start
 * row and never enters a blocked cell. For a walkable target the table is the hook's map (the graph is undirected, so
 * `distances[from][target]` is `toTarget.get(from)`). For a blocked target the table says UNREACHABLE for every
 * `from` — which made the reference release a commitment the hook keeps, and score every move 99. This helper returns
 * the hook's number in both cases:
 *
 *   target walkable (neither a wall nor an armed trap)   distances[from][target]                       (as before)
 *   from === target                                     0                                             (the seed)
 *   target blocked                                      1 + min over n in N(target) of distances[from][n],
 *                                                       UNREACHABLE when no n reaches `from`
 *
 * where N(target) is `getNeighbors(target, graph)`: the target's in-bounds neighbours that are neither walls
 * (`baseNeighbours` already leaves walls out) nor armed traps.
 *
 * Equivalence with the hook's BFS. From a blocked target t, `getReachableDistances` assigns 1 to every n in N(t) and
 * then runs a plain BFS on the walkable graph G' (cells outside `graph`): t is already in the map so it is never
 * re-entered, and no other blocked cell is ever entered. That is a multi-source BFS on G' seeded with N(t) at level 1,
 * and a multi-source BFS distance is the minimum over its sources: toTarget(x) = 1 + min_n d_G'(n, x). G' is
 * undirected, so d_G'(n, x) = distances[x][n] — the table row of `x`, which is what is read here. A blocked `from`
 * (never the Sentinel or one of its moves on a reachable state, but answered all the same) is never entered by the
 * hook's BFS either; its table row is all UNREACHABLE, so the helper answers UNREACHABLE, the hook's `undefined`.
 * Checked exhaustively — every cell as target, every cell as `from`, every armed-trap mask — against the production
 * function in rota2-sentinel-solver-fidelity-tests.mjs (S09).
 *
 * Pure and allocation-free: at most four table reads per call, no per-variant state, nothing cached.
 */
const CELL_COUNT = 81;
export const SENTINEL_UNREACHABLE = 255;

/**
 * `toTarget.get(from)` of the hook's `getReachableDistances(target, graph)`, or SENTINEL_UNREACHABLE where the hook
 * has no entry. `meta` is the packed context of the topology the defenders answer on, `variant` its table for
 * `traps` (`trapVariant(meta, traps)`), `from` and `target` cell ids.
 */
export function sentinelTargetDistance(meta, variant, traps, from, target) {
  if (meta.walls[target] === 0 && (meta.trapBitByCell[target] & traps) === 0) {
    return variant.distances[from * CELL_COUNT + target];
  }
  if (from === target) return 0;
  const row = from * CELL_COUNT;
  let best = SENTINEL_UNREACHABLE;
  for (const next of meta.baseNeighbours[target]) {
    if (meta.trapBitByCell[next] & traps) continue;
    const distance = variant.distances[row + next];
    if (distance < best) best = distance;
  }
  return best === SENTINEL_UNREACHABLE ? SENTINEL_UNREACHABLE : best + 1;
}
