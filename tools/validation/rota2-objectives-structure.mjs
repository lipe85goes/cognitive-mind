/**
 * ROTA2-DEPENDENT-OBJECTIVES-02 — structural completability of a Route's objectives, written apart from production.
 *
 * Structural = the Explorer alone on the board: no Hunter, no Sentinel (they are threats, not walls; their side is
 * the exact solver's, rota2-dynamic-solver.mjs). The question is whether the objective graph can be completed at
 * all, and how:
 *
 *   trap path     the linked trap is reachable on the CERTIFIED walls (the marked passage still standing — so opening
 *                 the passage never needs the passage open), and arming it opens the wall;
 *   lights        every light is reachable on the certified walls (lights → passage) and on the walls with the
 *                 passage open (passage → lights);
 *   portal        the exit is reachable once both prerequisites hold, from the trap and from every light;
 *   Pickaxe path  the Chest is reachable, a walkable cell beside the marked wall is reachable after it, and breaking
 *                 the wall from there opens it (the Pickaxe's own rule: any internal wall next to the Explorer);
 *   Second Chance the trap path never touches the Chest's reward, so a Route whose Explorer took the Second Chance
 *                 (or no reward at all) completes the passage objective exactly when the trap path exists.
 *
 * A dependency is circular when the passage can be opened only through itself: its trap reachable only with the
 * wall already open. Every check reads the map's own fields (walls as `"r,c"` cell keys, the 9x9 grid).
 */

const SIZE = 9;
const key = (p) => `${p.row},${p.col}`;
const cell = (k) => {
  const [row, col] = k.split(",").map(Number);
  return { row, col };
};
const neighbours = (p) =>
  [
    { row: p.row - 1, col: p.col },
    { row: p.row + 1, col: p.col },
    { row: p.row, col: p.col - 1 },
    { row: p.row, col: p.col + 1 },
  ].filter((n) => n.row >= 0 && n.row < SIZE && n.col >= 0 && n.col < SIZE);

/** Every cell reachable from `from` on `walls` (a Set of cell keys). */
export function reachableFrom(from, walls) {
  const seen = new Set([key(from)]);
  const queue = [from];
  for (let i = 0; i < queue.length; i += 1) {
    for (const next of neighbours(queue[i])) {
      const k = key(next);
      if (seen.has(k) || walls.has(k)) continue;
      seen.add(k);
      queue.push(next);
    }
  }
  return seen;
}

/** The objective structure of one map under one plan (`requirePassage`: Routes 2 and 3). */
export function objectiveStructure(map, { requirePassage }) {
  const link = (map.trapLinks ?? [])[0] ?? null;
  const wall = link?.mutation.wall ?? null;
  const closed = map.walls;
  const open = new Set(closed);
  if (wall) open.delete(wall);
  const fromStartClosed = reachableFrom(map.playerStart, closed);
  const lights = map.collectibleStars.map(key);
  const exit = key(map.exitPosition);

  const lightsReachableClosed = lights.every((l) => fromStartClosed.has(l));
  const exitReachableClosed = fromStartClosed.has(exit);
  if (!requirePassage) {
    return {
      requirePassage: false,
      lightsReachable: lightsReachableClosed,
      portalReachableAfterPrerequisites: exitReachableClosed && lights.every((l) => reachableFrom(cell(l), closed).has(exit)),
      completable: lightsReachableClosed && exitReachableClosed,
      circular: false,
    };
  }
  const passageIsAWall = wall !== null && closed.has(wall);
  const trap = link?.trap ?? null;
  const trapReachableClosed = trap !== null && fromStartClosed.has(trap);
  // The trap is reachable only once the passage is open: opening the passage would need it open.
  const circular = trap !== null && !trapReachableClosed && reachableFrom(map.playerStart, open).has(trap);
  const fromTrapOpen = trap ? reachableFrom(cell(trap), open) : new Set();
  const lightsReachableOpen = lights.every((l) => fromTrapOpen.has(l));
  const exitFromTrapOpen = fromTrapOpen.has(exit);
  const exitFromEveryLightOpen = lights.every((l) => reachableFrom(cell(l), open).has(exit));

  // lights → passage: every light on the certified walls, then the trap (still on them), then the exit.
  const lightsFirst = lightsReachableClosed && trapReachableClosed && exitFromTrapOpen;
  // passage → lights: the trap on the certified walls, then every light and the exit on the opened walls.
  const passageFirst = trapReachableClosed && lightsReachableOpen && exitFromEveryLightOpen;
  const trapPath = passageIsAWall && (lightsFirst || passageFirst);

  // The Pickaxe: the Chest, then a cell beside the marked wall, on the certified walls; break; lights and exit.
  const chest = map.chest ? key(map.chest) : null;
  const chestReachable = chest !== null && fromStartClosed.has(chest);
  const besideWall = wall ? neighbours(cell(wall)).map(key).filter((k) => !closed.has(k)) : [];
  const fromChestClosed = chestReachable ? reachableFrom(map.chest, closed) : new Set();
  const besideReachable = besideWall.filter((k) => fromChestClosed.has(k));
  const pickaxePath =
    passageIsAWall &&
    chestReachable &&
    besideReachable.length > 0 &&
    lights.every((l) => reachableFrom(cell(besideReachable[0]), open).has(l)) &&
    reachableFrom(cell(besideReachable[0]), open).has(exit);

  return {
    requirePassage: true,
    link: link ? { trap, wall } : null,
    passageIsAWall,
    trapReachable: trapReachableClosed,
    lightsReachable: lightsReachableClosed || lightsReachableOpen,
    lightsReachableBeforePassage: lightsReachableClosed,
    lightsReachableAfterPassage: lightsReachableOpen,
    portalReachableAfterPrerequisites: exitFromTrapOpen && exitFromEveryLightOpen,
    orders: { lightsFirst, passageFirst },
    trapPath,
    pickaxePath,
    // The Second Chance (or no reward) completes the passage exactly by the trap path: it never needs the Pickaxe.
    secondChancePath: trapPath,
    circular,
    completable: trapPath || pickaxePath,
  };
}
