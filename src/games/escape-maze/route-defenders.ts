import { getPredatorNextPosition, manhattanDistance } from "@/engine/difficulty";
import { randomItem, routeRandom } from "@/engine/route-random";
import { COLS, ROWS } from "@/games/escape-maze/route-config";
import type { MazeMap } from "@/games/escape-maze/route-generation";
import {
  findPathLength,
  getNeighbors,
  getReachableDistances,
  keyToPosition,
  posKey,
  positionsEqual,
} from "@/games/escape-maze/route-geometry";
import type { DifficultyLevel, GridPosition } from "@/types/game";

/**
 * ROUTE-C3 — how the Rota's two defenders decide.
 *
 * The Sentinel's region (`computePortalDefenceZone`), its starting post
 * (`createSentinelState`) and its contract-c3 move (`decideSentinelMove`), and
 * the Hunter's trap-aware move (`chooseGuardianMove`). Moved out of
 * `useEscapeMaze.ts` verbatim — no body, constant, tie-break, order of
 * operations, random draw or comment changed; only `export` was added where
 * the hook now imports what it used to declare.
 *
 * Pure policy: each function reads a position and a board and returns a
 * decision. Committing it, rolling it back for a Second Chance, ending the
 * Route, messages and stats are the turn's business, and the turn stays in the
 * hook (`runDefenderPhase`). The Hunter draws from the Rota's one stream
 * (`@/engine/route-random`) exactly as it did from the hook, so generation and
 * the Hunter still see the same numbers in the same order. It reads the
 * board's size, the graph primitives, the difficulty helpers and types —
 * never React, the hook, the UI, Babylon or sounds — and `MazeMap` only as a
 * type, so it does not depend on generation at run time.
 */

/* ------------------------------------------------------ portal sentinel ---
 *
 * ROTA-DUAL-GUARDIANS-MAPS-01B: the second defender, ported from the approved
 * lab model (`tools/validation/dual-guardian-lab.mjs`, contract c3).
 *
 * The Hunter asks "how do I reach the Explorer?". The Sentinel asks "which way
 * into the final region should I hold?". It is territorial: it lives around the
 * portal, picks the door the Explorer is threatening, commits to it for three
 * turns, and gives up any chase that would pull it off its region. It never
 * stands on the portal itself — plugging the goal cell is the degenerate
 * defence this design exists to avoid.
 *
 * The commitment is what makes a feint possible: the Explorer threatens one
 * door, the Sentinel commits, the Explorer switches, and the Sentinel cannot
 * answer immediately.
 *
 * Behaviour is the lab's, decision for decision. Equivalence is asserted rather
 * than assumed — see `tools/validation/sentinel-runtime-equivalence.mjs`.
 */
const PORTAL_ZONE_RADIUS = 2;
/** How far outside the zone the Sentinel will step before turning back. */
const SENTINEL_LEASH = 2;
/** Past this distance the Explorer threatens no door and the Sentinel goes home. */
const SENTINEL_THREAT_HORIZON = 6;
/** Contract c3: a door is held for three turns before it can be re-aimed. */
export const SENTINEL_COMMIT_TURNS = 3;

export interface PortalDefenceZone {
  /** Cells within `PORTAL_ZONE_RADIUS` of the portal — the Sentinel's region. */
  zone: GridPosition[];
  zoneKeys: Set<string>;
  /** Doors: cells outside the zone that touch it and are reachable on their own. */
  accesses: GridPosition[];
}

/**
 * The zone follows the topology, not a rectangle. A door only counts when the
 * Explorer can arrive through it WITHOUT first passing another door, otherwise
 * two doors are really one approach and there is nothing to choose between.
 */
export function computePortalDefenceZone(
  playerStart: GridPosition,
  exitPosition: GridPosition,
  walls: Set<string>,
): PortalDefenceZone {
  const fromPortal = getReachableDistances(exitPosition, walls);
  const zone: GridPosition[] = [];
  fromPortal.forEach((distance, cellKey) => {
    if (distance <= PORTAL_ZONE_RADIUS) zone.push(keyToPosition(cellKey));
  });
  const zoneKeys = new Set(zone.map(posKey));

  const accessKeys = new Set<string>();
  for (const cell of zone) {
    for (const next of getNeighbors(cell, walls)) {
      if (!zoneKeys.has(posKey(next))) accessKeys.add(posKey(next));
    }
  }
  const accesses = [...accessKeys].map(keyToPosition);

  const fromStart = getReachableDistances(playerStart, walls);
  const useful = accesses.filter((access) => {
    if (!fromStart.has(posKey(access))) return false;
    const others = new Set(
      accesses.filter((other) => !positionsEqual(other, access)).map(posKey),
    );
    return findPathLength(playerStart, access, walls, others) !== null;
  });

  return { zone, zoneKeys, accesses: useful };
}

export interface SentinelState {
  position: GridPosition;
  /** The door currently being held, or null when falling back to the portal. */
  target: GridPosition | null;
  commitLeft: number;
}

/**
 * On duty from the first turn, and never on the portal. The zone is listed in
 * breadth-first order from the portal, so this is the nearest usable cell — a
 * property of the geometry, not a magic coordinate.
 */
export function createSentinelState(
  map: MazeMap,
  zone: PortalDefenceZone,
): SentinelState {
  const start = zone.zone.find(
    (cell) =>
      !positionsEqual(cell, map.exitPosition) &&
      !positionsEqual(cell, map.playerStart) &&
      !positionsEqual(cell, map.guardianStart),
  );
  if (!start) {
    // The portal is certified to have at least two ways out, so its zone always
    // holds another cell. Reaching this means the map broke its own contract,
    // and inventing a position would hide that.
    throw new Error(
      "Portal defence zone has no cell available for the Sentinel: the map " +
        "violates the portal contract certified by ROTA-DUAL-GUARDIANS-MAPS-01A.",
    );
  }
  return { position: start, target: null, commitLeft: 0 };
}

/**
 * One Sentinel decision. Pure: it reads state and returns the next state, so
 * the same inputs always produce the same move and nothing strategic lives in
 * the render layer.
 */
export function decideSentinelMove(
  state: SentinelState,
  playerPosition: GridPosition,
  exitPosition: GridPosition,
  walls: Set<string>,
  zone: PortalDefenceZone,
  commitTurns: number = SENTINEL_COMMIT_TURNS,
  /** Cells the defenders may not enter — armed traps. Empty in 01B. */
  blockedForDefenders: Set<string> = EMPTY_BLOCKED,
): SentinelState {
  // ROTA-TRAPS-STRATEGY-01: an armed trap is a wall for this defender and for
  // nobody else. Folding it into the graph extends the c3 algorithm instead of
  // forking a second, trap-aware copy of it. With no trap armed the set is
  // empty and the graph IS `walls`, so every 01B decision is unchanged.
  const graph =
    blockedForDefenders.size === 0
      ? walls
      : new Set<string>([...walls, ...blockedForDefenders]);
  const fromPlayer = getReachableDistances(playerPosition, walls);
  const home = exitPosition;

  // Which door is the Explorer actually threatening?
  let target: GridPosition = home;
  let bestThreat = Number.POSITIVE_INFINITY;
  for (const access of zone.accesses) {
    const distance = fromPlayer.get(posKey(access)) ?? Number.POSITIVE_INFINITY;
    if (distance < bestThreat) {
      bestThreat = distance;
      target = access;
    }
  }

  // Commitment. A defender that re-aims every turn is tracking, not patrolling.
  let heldTarget = state.target;
  let commitLeft = state.commitLeft;
  if (commitLeft > 0 && heldTarget) {
    target = heldTarget;
    commitLeft -= 1;
  } else {
    heldTarget = target;
    commitLeft = commitTurns;
  }

  // Leash: a chase that pulls the Sentinel off its region is abandoned, and it
  // does not become a second Hunter — it walks back to the portal.
  const distanceHome = findPathLength(state.position, home, graph) ?? 0;
  const outside = !zone.zoneKeys.has(posKey(state.position));
  if (
    bestThreat > SENTINEL_THREAT_HORIZON ||
    (outside && distanceHome > PORTAL_ZONE_RADIUS + SENTINEL_LEASH)
  ) {
    target = home;
    heldTarget = null;
    commitLeft = 0;
  }

  let toTarget = getReachableDistances(target, graph);
  // A trap can cut the Sentinel off from the door it was holding. Holding a
  // door it can no longer reach is not patrolling, it is freezing: the
  // commitment is released and it falls back to the portal, free to pick
  // another access next turn. It never tries to walk through the trap.
  if (
    blockedForDefenders.size > 0 &&
    heldTarget &&
    toTarget.get(posKey(state.position)) === undefined
  ) {
    target = home;
    heldTarget = null;
    commitLeft = 0;
    toTarget = getReachableDistances(target, graph);
  }

  const options = getNeighbors(state.position, graph).filter((next) => {
    if (positionsEqual(next, home)) return false;
    const distance = findPathLength(next, home, graph);
    return distance !== null && distance <= PORTAL_ZONE_RADIUS + SENTINEL_LEASH;
  });
  if (options.length === 0) {
    return { position: state.position, target: heldTarget, commitLeft };
  }

  let best = state.position;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const next of options) {
    const score = toTarget.get(posKey(next)) ?? 99;
    if (score < bestScore) {
      bestScore = score;
      best = next;
    }
  }
  const stayScore = toTarget.get(posKey(state.position)) ?? 99;
  return {
    position: bestScore < stayScore ? best : state.position,
    target: heldTarget,
    commitLeft,
  };
}

const EMPTY_BLOCKED: Set<string> = new Set();

/**
 * ROTA-TRAPS-STRATEGY-01: the Hunter keeps its policy — Manhattan-greedy, same
 * scoring, same tie-break. The only thing an armed trap changes is which cells
 * are a LEGAL destination. When the trap removes the move it wanted, it
 * reconsiders among the remaining legal ones with the same rule it always used.
 */
export function chooseGuardianMove(
  guardian: GridPosition,
  player: GridPosition,
  exitPosition: GridPosition,
  walls: Set<string>,
  difficulty: DifficultyLevel,
  blockedForDefenders: Set<string> = EMPTY_BLOCKED,
): GridPosition {
  const preferred = getPredatorNextPosition(
    guardian,
    player,
    walls,
    ROWS,
    COLS,
    difficulty,
  );

  const isIllegal = (cell: GridPosition) =>
    positionsEqual(cell, exitPosition) || blockedForDefenders.has(posKey(cell));

  if (!isIllegal(preferred)) {
    return preferred;
  }

  const alternatives = getNeighbors(guardian, walls).filter(
    (next) => !isIllegal(next),
  );
  if (alternatives.length === 0) return guardian;

  if (difficulty === "easy" && routeRandom() < 0.45) {
    return randomItem(alternatives);
  }

  const bestDistance = Math.min(
    ...alternatives.map((next) => manhattanDistance(next, player)),
  );
  const best = alternatives.filter(
    (next) => manhattanDistance(next, player) === bestDistance,
  );
  return randomItem(best);
}
