/**
 * ROTA2-DYNAMIC-TRAPS-01 — the trap-link contract, written from the mission's
 * text and not from production's predicate, so the validators can hold the
 * generator to it independently (rota2-dynamic-traps-tests.mjs T21,
 * rota2-dynamic-traps-census.mjs "invalid mutations").
 *
 * A linked wall: one link per map, from one of the map's traps, kind
 * "open-wall"; the wall stands on the certified board inside the 9x9 grid; it
 * touches two or three open cells, none of them a trap and none inside the
 * portal's convergence region (distance <= 3 on the certified walls); the
 * trap is 2–4 cells away (Manhattan); opening it keeps one connected field,
 * makes no dead end, leaves the Sentinel's region as it was, and saves at
 * least two steps between two of the cells it joins.
 *
 * `API` is the Rota surface of a loaded tree (route-module-loader): the graph
 * primitives and `computePortalDefenceZone`. Writes nothing.
 */
const keyToCell = (key) => {
  const [row, col] = key.split(",").map(Number);
  return { row, col };
};
const cellKey = (p) => `${p.row},${p.col}`;
const manhattan = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function independentLinkOffences(API, map) {
  const links = map.trapLinks;
  if (!Array.isArray(links) || links.length !== 1) return ["not exactly one link"];
  const why = [];
  const [link] = links;
  if (link.mutation?.kind !== "open-wall") why.push("mutation is not open-wall");
  const wall = keyToCell(link.mutation.wall);
  const trapKeys = new Set(map.traps.map(cellKey));
  if (!trapKeys.has(link.trap)) why.push("trap is not a trap");
  if (!map.walls.has(link.mutation.wall)) why.push("wall is not standing");
  if (!(wall.row >= 0 && wall.row < 9 && wall.col >= 0 && wall.col < 9)) why.push("wall outside the board");
  if (map.grid[wall.row]?.[wall.col] !== 1) why.push("wall is not a grid wall");
  const d = manhattan(keyToCell(link.trap), wall);
  if (d < 2 || d > 4) why.push(`trap distance ${d}`);
  const around = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    .map(([dr, dc]) => ({ row: wall.row + dr, col: wall.col + dc }))
    .filter((c) => c.row >= 0 && c.row < 9 && c.col >= 0 && c.col < 9 && !map.walls.has(cellKey(c)));
  if (around.length < 2 || around.length > 3) why.push(`${around.length} open cells around the wall`);
  if (around.some((c) => trapKeys.has(cellKey(c)))) why.push("a trap at the passage");
  // Portal region (distance <= 3 from the portal on the certified walls) untouched.
  const fromExit = API.getReachableDistances(map.exitPosition, map.walls);
  if (around.some((c) => (fromExit.get(cellKey(c)) ?? -1) <= 3)) why.push("touches the portal region");
  // Opening it keeps one connected field, adds no dead end, leaves the Sentinel's region as it was.
  const opened = new Set(map.walls);
  opened.delete(link.mutation.wall);
  const reach = API.getReachableDistances(map.playerStart, opened);
  if (reach.size !== 81 - opened.size) why.push("opening leaves a pocket");
  for (const key of reach.keys()) {
    const before = API.getNeighbors(keyToCell(key), map.walls).length;
    const after = API.getNeighbors(keyToCell(key), opened).length;
    if (after < 2 && (before >= 2 || key === link.mutation.wall)) why.push(`dead end at ${key}`);
  }
  const zoneBefore = API.computePortalDefenceZone(map.playerStart, map.exitPosition, map.walls).zone.map(cellKey).sort();
  const zoneAfter = API.computePortalDefenceZone(map.playerStart, map.exitPosition, opened).zone.map(cellKey).sort();
  if (!sameJson(zoneBefore, zoneAfter)) why.push("portal zone changed");
  // Worth noticing: the opening saves at least two steps between two of the cells it joins.
  let shortcut = 0;
  for (let i = 0; i < around.length; i += 1) {
    for (let j = i + 1; j < around.length; j += 1) {
      const longWay = API.findPathLength(around[i], around[j], map.walls);
      shortcut = Math.max(shortcut, (longWay ?? 0) - manhattan(around[i], around[j]));
    }
  }
  if (shortcut < 2) why.push(`shortcut ${shortcut}`);
  return why;
}

/** The link's shape, trap distance and shortcut, for reporting. Null without a link. */
export function linkProfile(API, map) {
  const link = (map.trapLinks ?? [])[0];
  if (!link) return null;
  const wall = keyToCell(link.mutation.wall);
  const around = [[-1, 0], [1, 0], [0, -1], [0, 1]]
    .map(([dr, dc]) => ({ row: wall.row + dr, col: wall.col + dc }))
    .filter((c) => c.row >= 0 && c.row < 9 && c.col >= 0 && c.col < 9 && !map.walls.has(cellKey(c)));
  let shortcut = 0;
  for (let i = 0; i < around.length; i += 1) {
    for (let j = i + 1; j < around.length; j += 1) {
      const longWay = API.findPathLength(around[i], around[j], map.walls);
      shortcut = Math.max(shortcut, (longWay ?? 0) - manhattan(around[i], around[j]));
    }
  }
  const shape = around.length === 3 ? "junction" : around.length === 2 && (around[0].row === around[1].row || around[0].col === around[1].col) ? "door" : around.length === 2 ? "corner" : `open-${around.length}`;
  return { trap: link.trap, wall: link.mutation.wall, shape, trapDistance: manhattan(keyToCell(link.trap), wall), shortcut, trapIndex: map.traps.map(cellKey).indexOf(link.trap) };
}
