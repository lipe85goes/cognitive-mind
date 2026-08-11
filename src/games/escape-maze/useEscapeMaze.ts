"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getPredatorNextPosition, manhattanDistance } from "@/engine/difficulty";
import { calculateEscapeMazeScore } from "@/engine/scoring";
import { playGentleErrorTone, playSuccessChime } from "@/lib/game-sounds";
import type {
  DifficultyLevel,
  GameResult,
  GridPosition,
} from "@/types/game";

/**
 * Rota Estratégica (escape-maze) game logic, extracted verbatim from the
 * original `EscapeMazeGame` so maze generation, templates, wall randomization,
 * player/guardian movement, difficulty behaviour, win/loss, scoring, blocked
 * moves, errors, stars, restart, arrow-key support and the `onComplete`
 * contract are all preserved exactly. The premium presentation is a pure view
 * over this state.
 */

// ROTA-9X9-FOUNDATION-01: the board is 9x9. Every anchor below is derived
// from these two numbers instead of being written as a literal cell, so the
// start, exits and guardian seats can never silently desync from the grid
// again — this is the part that made 7x9 dangerous before.
export const ROWS = 9;
export const COLS = 9;
const MAX_GENERATION_ATTEMPTS = 500;
/**
 * Recovery sweep budget. The randomised phase already covers the p99 of the
 * measured attempt distribution by a wide margin; this exists only for the tail
 * that the random template/exit draw happens to miss, and it walks every
 * template x exit slot deterministically instead of drawing again.
 */
const RECOVERY_ROUNDS = 3;
const RECOVERY_RETRIES_PER_SLOT = 12;

/** Bottom-left corner: the Explorer always starts at the near edge. */
const PLAYER_START: GridPosition = { row: ROWS - 1, col: 0 };
const START_OPENING: GridPosition = { row: ROWS - 1, col: 1 };
const START_BRANCH: GridPosition = { row: ROWS - 2, col: 0 };
const START_SAFE_CELLS: GridPosition[] = [
  PLAYER_START,
  START_OPENING,
  START_BRANCH,
  { row: ROWS - 2, col: 1 },
];
/** Far corner, opposite the start: the portal is always a full crossing. */
const ROUTE_STAGE_EXIT_CANDIDATES: Record<RouteStage, GridPosition[]> = {
  1: [
    { row: 2, col: COLS - 1 },
    { row: 2, col: COLS - 2 },
  ],
  2: [
    { row: 1, col: COLS - 1 },
    { row: 0, col: COLS - 2 },
    { row: 0, col: COLS - 1 },
  ],
  3: [
    { row: 0, col: COLS - 1 },
    { row: 0, col: COLS - 2 },
  ],
};
/** Guardian seats live in the far half, never next to the Explorer. */
const GUARDIAN_CANDIDATES: GridPosition[] = [
  { row: 0, col: Math.floor((COLS - 1) / 2) },
  { row: 1, col: COLS - 3 },
  { row: 2, col: COLS - 1 },
  { row: 0, col: COLS - 1 },
  { row: 3, col: COLS - 2 },
];
const ROUTE_STAGE_GUARDIAN_CANDIDATES: Record<RouteStage, GridPosition[]> = {
  1: [
    { row: 0, col: 3 },
    { row: 1, col: 5 },
    { row: 2, col: 6 },
  ],
  2: [
    { row: 2, col: 3 },
    { row: 1, col: 4 },
    { row: 2, col: 5 },
    { row: 0, col: 3 },
  ],
  3: [
    { row: 1, col: 4 },
    { row: 2, col: 3 },
    { row: 0, col: 3 },
    { row: 1, col: 5 },
  ],
};

/**
 * Route templates, one family per stage. 1 = wall, 0 = walkable.
 *
 * ROTA-MAPS-DIFFICULTY-01: the previous set was four hand-drawn layouts shared
 * between stages, and they were tree-shaped — 46% of generated maps ended up
 * with a single choke point between the start and the portal, which is the
 * "corredor unico" the Explorer could not plan around. These nine were selected
 * by structural search (tools/validation/route-lab.mjs measures the same things
 * the generator now enforces) under one brief per stage, and every one of them
 * is proven to keep at least two vertex-disjoint routes to every published exit
 * candidate.
 *
 * The families read as a progression, by measurement rather than by adjective:
 *
 *   stage | paredes | ciclos | junções | becos | maior corredor
 *     1   | 17-19   |   22   |  39-40  |   1   |      1-2
 *     2   | 21-22   |   17   |  31-32  |  3-4  |      2-3
 *     3   | 25-28   |   13   |  25-26  |  3-4  |      3-5
 *
 * Fewer loops and longer corridors as the route advances: more of the board is
 * a commitment, less of it is a free reroute. No layout is a mirror or a
 * two-wall variant of another — each pair differs by at least 16 cells.
 */
const STAGE_ONE_TEMPLATES: number[][][] = [
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0, 1, 0, 1, 0],
    [1, 0, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 1, 1, 0],
    [0, 0, 0, 1, 1, 0, 0, 0, 0],
    [0, 1, 0, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 1, 0, 0, 0, 0, 0],
  ],
  [
    [1, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 1, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1, 0],
    [0, 1, 0, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 1, 1, 0, 1, 1, 0],
    [1, 0, 0, 0, 0, 0, 1, 0, 0],
    [0, 0, 1, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 1, 1],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
  [
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 1, 1, 0, 0, 1, 0, 0],
    [0, 0, 1, 1, 0, 0, 1, 0, 0],
    [0, 1, 0, 0, 0, 0, 1, 1, 0],
    [0, 0, 0, 0, 1, 1, 1, 0, 0],
    [0, 1, 1, 0, 0, 0, 1, 0, 0],
    [0, 0, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 1, 0],
  ],
];

const STAGE_TWO_TEMPLATES: number[][][] = [
  [
    [0, 1, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 1, 0, 0, 1, 0, 0],
    [1, 0, 1, 0, 0, 0, 1, 1, 0],
    [0, 1, 1, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 1, 1, 0, 0, 0],
    [0, 1, 0, 0, 1, 0, 0, 0, 1],
    [0, 0, 0, 0, 1, 0, 1, 0, 0],
    [0, 0, 1, 0, 0, 0, 0, 0, 0],
  ],
  [
    [0, 0, 1, 0, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 0, 0],
    [1, 0, 0, 1, 0, 0, 1, 1, 0],
    [1, 1, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 1, 0, 0],
    [1, 0, 0, 1, 1, 0, 1, 1, 0],
    [0, 0, 1, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 1, 0, 0, 0, 1, 1],
  ],
  [
    [1, 1, 0, 1, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 1, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 0, 1, 0, 1, 1],
    [0, 0, 0, 0, 1, 0, 0, 0, 0],
    [0, 0, 1, 0, 1, 1, 0, 0, 0],
    [1, 0, 1, 0, 0, 1, 1, 0, 0],
    [0, 0, 1, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
  ],
];

const STAGE_THREE_TEMPLATES: number[][][] = [
  [
    [0, 1, 0, 1, 0, 1, 1, 0, 0],
    [0, 1, 0, 0, 0, 1, 0, 0, 0],
    [0, 1, 1, 1, 0, 0, 0, 1, 0],
    [0, 0, 0, 0, 0, 1, 1, 1, 0],
    [0, 0, 1, 1, 0, 0, 1, 0, 0],
    [0, 0, 0, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0, 1, 0],
    [0, 0, 1, 0, 0, 0, 1, 0, 0],
    [0, 0, 1, 1, 0, 1, 1, 0, 0],
  ],
  [
    [1, 1, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 0, 0, 0],
    [0, 0, 0, 1, 1, 1, 1, 1, 0],
    [0, 1, 1, 0, 0, 0, 1, 0, 0],
    [0, 0, 0, 1, 0, 0, 0, 0, 1],
    [0, 0, 1, 1, 1, 1, 1, 0, 0],
    [0, 0, 1, 0, 1, 1, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0, 0, 0, 1, 1],
  ],
  [
    [1, 0, 0, 1, 0, 0, 0, 0, 0],
    [1, 0, 0, 0, 0, 0, 1, 1, 0],
    [0, 0, 1, 0, 1, 1, 1, 0, 0],
    [1, 0, 1, 0, 0, 1, 0, 0, 0],
    [1, 0, 0, 0, 0, 1, 0, 1, 0],
    [0, 0, 0, 1, 0, 0, 0, 0, 1],
    [0, 0, 0, 1, 1, 1, 1, 0, 0],
    [0, 0, 1, 1, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 0, 1, 0],
  ],
];

const MAZE_TEMPLATES: number[][][] = [
  ...STAGE_ONE_TEMPLATES,
  ...STAGE_TWO_TEMPLATES,
  ...STAGE_THREE_TEMPLATES,
];

const ROUTE_STAGE_TEMPLATES: Record<RouteStage, number[][][]> = {
  1: STAGE_ONE_TEMPLATES,
  2: STAGE_TWO_TEMPLATES,
  3: STAGE_THREE_TEMPLATES,
};

const ARROW_DELTAS: Record<string, GridPosition> = {
  ArrowUp: { row: -1, col: 0 },
  ArrowDown: { row: 1, col: 0 },
  ArrowLeft: { row: 0, col: -1 },
  ArrowRight: { row: 0, col: 1 },
};

/**
 * Janela mínima entre duas ações de movimento aceitas (ms). "Pensar em paz"
 * exige que um único gesto do Explorador conte como UMA ação: isto absorve
 * despachos duplicados do mesmo gesto (eventos enfileirados, cliques
 * fantasmas, toque+teclado no mesmo instante) sem travar o jogo — a janela é
 * curta demais para ser percebida num jogo por turnos.
 */
const MOVE_INPUT_GUARD_MS = 150;

type RouteStage = 1 | 2 | 3;

export interface RouteProgression {
  routeNumber: number;
  stage: RouteStage;
  label: string;
  description: string;
}

const ROUTE_STAGE_COPY: Record<
  RouteStage,
  Pick<RouteProgression, "label" | "description">
> = {
  1: {
    label: "Explora\u00e7\u00e3o inicial",
    description: "Um mapa mais aberto para observar a rota.",
  },
  2: {
    label: "Novas escolhas",
    description: "Mais caminhos pedem uma decis\u00e3o por vez.",
  },
  3: {
    label: "Portal distante",
    description: "A rota pede planejamento com calma.",
  },
};

// Scaled for 9x9: the 7x7 ranges kept the same wall COUNT on a board with
// 65% more cells, which read as an empty field with nothing to plan around.
const WALL_LIMITS: Record<DifficultyLevel, { min: number; max: number }> = {
  easy: { min: 13, max: 18 },
  medium: { min: 18, max: 23 },
  hard: { min: 23, max: 28 },
};

/**
 * ROTA-MAPS-DIFFICULTY-01: this was easy 4 / medium 4 / hard 3, so the hardest
 * mode had the SHORTEST objective — the baseline measured Rota 1 at 21 / 21 / 19
 * moves, a progression running backwards. Lights are the journey: more of them
 * means a longer route and, more importantly, a harder ordering decision.
 * Capped at 6 so the optimal-order search stays cheap inside generation.
 */
const BASE_STAR_COUNT: Record<DifficultyLevel, number> = {
  easy: 3,
  medium: 4,
  hard: 5,
};

/** A small, calm number of trap tiles per difficulty (Gameplay 2.0). */
const BASE_TRAP_COUNT: Record<DifficultyLevel, number> = {
  easy: 3,
  medium: 4,
  hard: 5,
};

/**
 * What each mode has to feel like, as numbers the generator must satisfy.
 *
 * ROTA-MAPS-DIFFICULTY-01: difficulty used to be wall count and little else,
 * which is why the baseline measured Aberto R1 at a 3% defender threat (the
 * guardian was scenery) and forced runs of up to 19 steps on Desafiador (the
 * map played itself). These are play properties, not decoration:
 *
 *  - `minDecisionRatio`: share of steps on the objective route where the
 *    Explorer has more than one way on. Below this the route is a rail.
 *  - `maxForcedStreak`: longest run with no choice at all.
 *  - `maxIdleDeadEnds`: dead ends holding nothing and touching nothing.
 *  - `guardianStartDistance`: near enough to matter, far enough to be fair.
 *    Aberto keeps the widest margin; it is still a real presence because the
 *    map no longer lets the Explorer walk a straight line away from it.
 */
interface DifficultyPlayBrief {
  minDecisionRatio: number;
  maxForcedStreak: number;
  maxIdleDeadEnds: number;
  guardianStartDistance: { min: number; max: number };
}

const DIFFICULTY_PLAY_BRIEF: Record<DifficultyLevel, DifficultyPlayBrief> = {
  easy: {
    minDecisionRatio: 0.62,
    maxForcedStreak: 3,
    maxIdleDeadEnds: 0,
    guardianStartDistance: { min: 8, max: 13 },
  },
  medium: {
    minDecisionRatio: 0.55,
    maxForcedStreak: 4,
    maxIdleDeadEnds: 1,
    guardianStartDistance: { min: 7, max: 12 },
  },
  hard: {
    minDecisionRatio: 0.5,
    maxForcedStreak: 5,
    maxIdleDeadEnds: 2,
    guardianStartDistance: { min: 6, max: 11 },
  },
};

interface RouteStageQuality {
  minReachableCells: number;
  minJunctions: number;
  maxStartZoneWalls: number;
  guardianMinStartDistance: number;
  starMinStartDistance: number;
  starMinExitDistance: number;
  starMinSeparation: number;
  trapMinStartDistance: number;
  trapMinSeparation: number;
  shieldMinStartDistance: number;
  shieldTargetDistance: number;
  wallRandomizationAttempts: number;
}

const ROUTE_STAGE_QUALITY: Record<RouteStage, RouteStageQuality> = {
  1: {
    minReachableCells: 53,
    minJunctions: 10,
    maxStartZoneWalls: 0,
    guardianMinStartDistance: 9,
    starMinStartDistance: 3,
    starMinExitDistance: 2,
    starMinSeparation: 2,
    trapMinStartDistance: 4,
    trapMinSeparation: 3,
    shieldMinStartDistance: 3,
    shieldTargetDistance: 4,
    wallRandomizationAttempts: 8,
  },
  2: {
    minReachableCells: 50,
    minJunctions: 9,
    maxStartZoneWalls: 0,
    guardianMinStartDistance: 8,
    starMinStartDistance: 3,
    starMinExitDistance: 2,
    starMinSeparation: 2,
    trapMinStartDistance: 3,
    trapMinSeparation: 2,
    shieldMinStartDistance: 4,
    shieldTargetDistance: 5,
    wallRandomizationAttempts: 14,
  },
  3: {
    minReachableCells: 45,
    minJunctions: 8,
    maxStartZoneWalls: 0,
    guardianMinStartDistance: 8,
    starMinStartDistance: 4,
    starMinExitDistance: 2,
    starMinSeparation: 3,
    trapMinStartDistance: 4,
    trapMinSeparation: 2,
    shieldMinStartDistance: 4,
    shieldTargetDistance: 6,
    wallRandomizationAttempts: 26,
  },
};

function getRouteStage(routeNumber: number): RouteStage {
  return (((Math.max(1, routeNumber) - 1) % 3) + 1) as RouteStage;
}

function getRouteProgression(routeNumber: number): RouteProgression {
  const stage = getRouteStage(routeNumber);
  return {
    routeNumber,
    stage,
    ...ROUTE_STAGE_COPY[stage],
  };
}

function getWallLimits(
  difficulty: DifficultyLevel,
  stage: RouteStage,
): { min: number; max: number } {
  const base = WALL_LIMITS[difficulty];
  if (stage === 1) {
    return {
      min: Math.max(10, base.min - 3),
      max: Math.max(14, base.max - 3),
    };
  }
  if (stage === 3) {
    return {
      min: base.min + 1,
      max: base.max + 1,
    };
  }
  return base;
}

function getStarCount(difficulty: DifficultyLevel, stage: RouteStage): number {
  // Mode sets the base; the third route of each mode adds one more light, so
  // both axes progress without either dominating.
  if (stage === 3) return Math.min(6, BASE_STAR_COUNT[difficulty] + 1);
  return BASE_STAR_COUNT[difficulty];
}

function getTrapCount(difficulty: DifficultyLevel, stage: RouteStage): number {
  if (stage === 1) return Math.max(2, BASE_TRAP_COUNT[difficulty] - 1);
  if (stage === 3) return Math.min(6, BASE_TRAP_COUNT[difficulty] + 1);
  return BASE_TRAP_COUNT[difficulty];
}

function getMinimumPathLength(stage: RouteStage): number {
  return stage === 1 ? 7 : stage === 2 ? 8 : 10;
}

function getRouteStageTemplates(stage: RouteStage): number[][][] {
  return ROUTE_STAGE_TEMPLATES[stage] ?? MAZE_TEMPLATES;
}

function keyToPosition(key: string): GridPosition {
  const [row, col] = key.split(",").map(Number);
  return { row, col };
}

export interface MazeMap {
  grid: number[][];
  walls: Set<string>;
  playerStart: GridPosition;
  guardianStart: GridPosition;
  exitPosition: GridPosition;
  collectibleStars: GridPosition[];
  /** Walkable hazard tiles (Gameplay 2.0). Never affect path/guardian/walls. */
  traps: GridPosition[];
  /** Single walkable shield power-up tile, or null. Purely additive overlay. */
  shield: GridPosition | null;
}

export type GameStatus = "setup" | "playing" | "won" | "lost";

export function posKey(pos: GridPosition): string {
  return `${pos.row},${pos.col}`;
}

export function positionsEqual(a: GridPosition, b: GridPosition): boolean {
  return a.row === b.row && a.col === b.col;
}

function cloneGrid(grid: number[][]): number[][] {
  return grid.map((row) => [...row]);
}

function randomItem<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function gridToWalls(grid: number[][]): Set<string> {
  const walls = new Set<string>();
  grid.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (cell === 1) walls.add(`${r},${c}`);
    });
  });
  return walls;
}

function getNeighbors(
  pos: GridPosition,
  walls: Set<string>,
  rows = ROWS,
  cols = COLS,
): GridPosition[] {
  return [
    { row: pos.row - 1, col: pos.col },
    { row: pos.row + 1, col: pos.col },
    { row: pos.row, col: pos.col - 1 },
    { row: pos.row, col: pos.col + 1 },
  ].filter(
    (next) =>
      next.row >= 0 &&
      next.row < rows &&
      next.col >= 0 &&
      next.col < cols &&
      !walls.has(posKey(next)),
  );
}

function findPathLength(
  start: GridPosition,
  target: GridPosition,
  walls: Set<string>,
  blocked?: Set<string>,
): number | null {
  const queue: { pos: GridPosition; distance: number }[] = [
    { pos: start, distance: 0 },
  ];
  const visited = new Set([posKey(start)]);
  if (blocked) for (const cellKey of blocked) visited.add(cellKey);

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;

    if (positionsEqual(current.pos, target)) {
      return current.distance;
    }

    getNeighbors(current.pos, walls).forEach((next) => {
      const key = posKey(next);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ pos: next, distance: current.distance + 1 });
      }
    });
  }

  return null;
}

function countWalls(grid: number[][]): number {
  return grid.flat().filter((cell) => cell === 1).length;
}

function getReachableDistances(
  start: GridPosition,
  walls: Set<string>,
): Map<string, number> {
  const distances = new Map<string, number>([[posKey(start), 0]]);
  const queue: GridPosition[] = [start];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    const currentDistance = distances.get(posKey(current)) ?? 0;

    getNeighbors(current, walls).forEach((next) => {
      const key = posKey(next);
      if (!distances.has(key)) {
        distances.set(key, currentDistance + 1);
        queue.push(next);
      }
    });
  }

  return distances;
}

function countReachableJunctions(
  distances: Map<string, number>,
  walls: Set<string>,
): number {
  let junctions = 0;
  distances.forEach((_, key) => {
    const pos = keyToPosition(key);
    if (getNeighbors(pos, walls).length >= 3) junctions += 1;
  });
  return junctions;
}

function countStartZoneWalls(walls: Set<string>): number {
  return START_SAFE_CELLS.filter((cell) => walls.has(posKey(cell))).length;
}

function protectedKeys(
  playerStart: GridPosition,
  guardianStart: GridPosition,
  exitPosition: GridPosition,
): Set<string> {
  return new Set([
    posKey(playerStart),
    posKey(guardianStart),
    posKey(exitPosition),
    ...START_SAFE_CELLS.map(posKey),
  ]);
}

function chooseGuardianStart(
  walls: Set<string>,
  exitPosition: GridPosition,
  routeStage: RouteStage,
  difficulty: DifficultyLevel,
): GridPosition {
  const profile = ROUTE_STAGE_QUALITY[routeStage];
  // The defender now starts inside a band per mode, not merely "far enough".
  // An unbounded maximum is what let it start irrelevant on Aberto.
  const band = DIFFICULTY_PLAY_BRIEF[difficulty].guardianStartDistance;
  const minDistance = Math.max(band.min, profile.guardianMinStartDistance - 1);
  const candidates = [
    ...ROUTE_STAGE_GUARDIAN_CANDIDATES[routeStage],
    ...GUARDIAN_CANDIDATES,
  ].filter(
    (pos) =>
      !walls.has(posKey(pos)) &&
      !positionsEqual(pos, PLAYER_START) &&
      !positionsEqual(pos, exitPosition) &&
      manhattanDistance(pos, PLAYER_START) >= minDistance &&
      manhattanDistance(pos, PLAYER_START) <= band.max,
  );

  if (candidates.length > 0) return randomItem(candidates);

  const fallback = GUARDIAN_CANDIDATES.find(
    (pos) =>
      !walls.has(posKey(pos)) &&
      !positionsEqual(pos, PLAYER_START) &&
      !positionsEqual(pos, exitPosition) &&
      manhattanDistance(pos, PLAYER_START) >= band.min,
  );
  return fallback ?? { row: 0, col: 3 };
}

function randomizeWalls(
  baseGrid: number[][],
  difficulty: DifficultyLevel,
  routeStage: RouteStage,
  playerStart: GridPosition,
  guardianStart: GridPosition,
  exitPosition: GridPosition,
): number[][] {
  const grid = cloneGrid(baseGrid);
  const guaranteedOpenCells = [
    ...START_SAFE_CELLS,
    playerStart,
    guardianStart,
    exitPosition,
  ];
  guaranteedOpenCells.forEach((cell) => {
    grid[cell.row][cell.col] = 0;
  });
  const limits = getWallLimits(difficulty, routeStage);
  const profile = ROUTE_STAGE_QUALITY[routeStage];
  const protectedCells = protectedKeys(playerStart, guardianStart, exitPosition);

  // ROTA-MAPS-DIFFICULTY-01: every toggle is now checked before it is kept.
  // Blind scattering was undoing the template's designed structure — the loops
  // that guarantee an alternative route, and the absence of idle dead ends —
  // which is exactly what the new quality gates then rejected.
  const wouldKeepStructure = (candidate: number[][]): boolean => {
    const candidateWalls = gridToWalls(candidate);
    if (candidateWalls.has(posKey(playerStart))) return false;
    const reachable = getReachableDistances(playerStart, candidateWalls);
    const openCells = ROWS * COLS - candidateWalls.size;
    // One connected field: no pockets the Explorer can see but never enter.
    if (reachable.size !== openCells) return false;
    if (!reachable.has(posKey(exitPosition))) return false;
    if (!reachable.has(posKey(guardianStart))) return false;
    // No new dead ends beyond what the stage tolerates, and never a corridor
    // start: the Explorer must always have a real first choice.
    if (getNeighbors(playerStart, candidateWalls).length < 2) return false;
    if (getNeighbors(guardianStart, candidateWalls).length < 2) return false;
    return sharesBlock(decomposeBoardBlocks(candidateWalls), playerStart, exitPosition);
  };

  for (let attempt = 0; attempt < profile.wallRandomizationAttempts; attempt++) {
    const row = Math.floor(Math.random() * ROWS);
    const col = Math.floor(Math.random() * COLS);
    const key = `${row},${col}`;
    if (protectedCells.has(key)) continue;

    const wallCount = countWalls(grid);
    const previous = grid[row][col];
    if (previous === 1 && wallCount > limits.min) {
      grid[row][col] = 0;
    } else if (previous === 0 && wallCount < limits.max) {
      grid[row][col] = 1;
    } else {
      continue;
    }
    if (!wouldKeepStructure(grid)) grid[row][col] = previous;
  }

  return grid;
}

/**
 * Choose the lights, valid by construction.
 *
 * ROTA-01A-STAR-SELECTION-FIX: this used to score every eligible cell, take
 * greedily from the top respecting separation, and hand the result to a
 * validator that then rejected it. Measured on the four failing route3-hard
 * seeds: 2.330 of 2.864 candidates (81,4%) died on the "every light shares a
 * biconnected block with the Explorer" gate — and an exhaustive solver proved a
 * valid set of six existed in 2.330 of 2.330 of them. The layouts were fine;
 * the selection was not. The score rewards distance from the start, which is
 * exactly what correlates with sitting behind a choke point.
 *
 * Two changes, neither of which touches a threshold:
 *
 *  1. reachability-by-block is now part of ELIGIBILITY, not just of validation.
 *     A cell the Explorer cannot reach by two independent routes is never a
 *     candidate in the first place.
 *  2. greedy is not a proof of existence. With separation >= 3 and six lights,
 *     taking the best-scoring cell first can strand the set even when a valid
 *     one exists. Selection is now a bounded backtracking search that walks
 *     candidates in score order — so the preferred cell is still tried first,
 *     and the old preference is preserved whenever it does not block a complete
 *     set.
 *
 * If no complete set exists the function returns fewer than the required count,
 * and `isStructurallyValid` rejects the candidate explicitly. It never invents a
 * position, never drops the count, never violates separation.
 *
 * `blocks` is the decomposition of THIS candidate's walls, computed once in
 * `buildCandidate`. The gate in `isStructurallyValid` stays as the final
 * defence — this makes it a formality rather than a filter.
 */
function chooseStars(
  walls: Set<string>,
  playerStart: GridPosition,
  guardianStart: GridPosition,
  exitPosition: GridPosition,
  difficulty: DifficultyLevel,
  routeStage: RouteStage,
  blocks: BoardBlocks,
): GridPosition[] {
  const profile = ROUTE_STAGE_QUALITY[routeStage];
  const blocked = protectedKeys(playerStart, guardianStart, exitPosition);
  const distances = getReachableDistances(playerStart, walls);
  const targetCount = getStarCount(difficulty, routeStage);
  const candidates: Array<{ pos: GridPosition; score: number }> = [];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const pos = { row, col };
      const key = posKey(pos);
      const distanceFromStart = distances.get(key);
      const distanceFromExit = findPathLength(pos, exitPosition, walls);
      if (
        walls.has(key) ||
        blocked.has(key) ||
        distanceFromStart === undefined ||
        distanceFromExit === null ||
        distanceFromStart < profile.starMinStartDistance ||
        distanceFromExit < profile.starMinExitDistance ||
        // The requirement the validator applies, applied at selection time.
        !sharesBlock(blocks, playerStart, pos)
      ) {
        continue;
      }

      const degree = getNeighbors(pos, walls).length;
      const guardianDistance = manhattanDistance(pos, guardianStart);
      const stageScore =
        routeStage === 1
          ? 36 - Math.abs(distanceFromStart - 5) * 5 + degree * 3
          : routeStage === 2
            ? distanceFromStart * 1.4 + distanceFromExit + degree * 4
            : distanceFromStart * 1.8 + distanceFromExit * 1.2 + degree * 3;

      candidates.push({
        pos,
        score: stageScore + guardianDistance * 0.4 + Math.random() * 0.25,
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);

  // Bounded backtracking in score order: the preferred cell is tried first, and
  // the search only backs off when that choice would make a complete set
  // impossible. Board is 9x9 and targetCount <= 6, so this stays cheap.
  const ordered = candidates.map((candidate) => candidate.pos);
  const separated = (chosen: GridPosition[], next: GridPosition) =>
    chosen.every(
      (star) => manhattanDistance(star, next) >= profile.starMinSeparation,
    );

  const search = (from: number, chosen: GridPosition[]): GridPosition[] | null => {
    if (chosen.length === targetCount) return chosen;
    for (let index = from; index < ordered.length; index += 1) {
      if (chosen.length + (ordered.length - index) < targetCount) return null;
      const next = ordered[index];
      if (!separated(chosen, next)) continue;
      chosen.push(next);
      const complete = search(index + 1, chosen);
      if (complete) return complete;
      chosen.pop();
    }
    return null;
  };

  const complete = search(0, []);
  if (complete) return complete;

  // No complete set exists on this layout: return what greedy can manage, which
  // is short of the required count, and let the validator reject the candidate.
  const chosen: GridPosition[] = [];
  for (const candidate of candidates) {
    if (separated(chosen, candidate.pos)) chosen.push(candidate.pos);
    if (chosen.length >= targetCount) return chosen;
  }

  // Deliberately short. The previous version topped this list up to targetCount
  // by appending candidates that ignore starMinSeparation — controlled test B
  // caught it returning six lights with eight separation violations. Nothing
  // downstream re-checks separation (gate 13 only checks reachability), so those
  // maps shipped with clustered lights. Returning fewer is the honest answer:
  // isStructurallyValid rejects on the count and the generator tries again.
  return chosen;
}

/**
 * Place a few trap tiles and one shield on free walkable cells. Because these
 * sit only on walkable tiles, they never change path validity, wall counts or
 * the guardian AI — they are purely additive overlays on the finished maze.
 */
function chooseTrapsAndShield(
  walls: Set<string>,
  playerStart: GridPosition,
  guardianStart: GridPosition,
  exitPosition: GridPosition,
  stars: GridPosition[],
  difficulty: DifficultyLevel,
  routeStage: RouteStage,
): { traps: GridPosition[]; shield: GridPosition | null } {
  const profile = ROUTE_STAGE_QUALITY[routeStage];
  const distances = getReachableDistances(playerStart, walls);
  const blocked = new Set<string>([
    posKey(playerStart),
    posKey(guardianStart),
    posKey(exitPosition),
    ...START_SAFE_CELLS.map(posKey),
    ...stars.map(posKey),
  ]);

  const shieldCandidates: Array<{ pos: GridPosition; score: number }> = [];
  distances.forEach((distance, key) => {
    const pos = keyToPosition(key);
    if (blocked.has(key) || walls.has(key)) return;
    if (distance < profile.shieldMinStartDistance) return;

    const exitDistance = findPathLength(pos, exitPosition, walls) ?? 0;
    shieldCandidates.push({
      pos,
      score:
        30 - Math.abs(distance - profile.shieldTargetDistance) * 4 +
        exitDistance * 0.6 +
        getNeighbors(pos, walls).length,
    });
  });
  shieldCandidates.sort((a, b) => b.score - a.score);
  const shield = shieldCandidates[0]?.pos ?? null;
  if (shield) blocked.add(posKey(shield));

  // ROTA-MAPS-DIFFICULTY-01: traps are placed for the mechanic they will carry,
  // not for spacing. The score is the defender's detour if that cell became
  // impassable, plus a junction bonus — and a cell that would isolate the
  // defender scores zero and is never chosen. Distance from the start is now
  // only a floor, not the ranking.
  const baseGuardianPath =
    findPathLength(guardianStart, playerStart, walls) ?? null;
  const trapCandidates: Array<{ pos: GridPosition; score: number }> = [];
  distances.forEach((distance, key) => {
    const pos = keyToPosition(key);
    if (blocked.has(key) || walls.has(key)) return;
    if (distance < profile.trapMinStartDistance) return;
    if (stars.some((star) => manhattanDistance(star, pos) < 2)) return;

    const future = scoreTrapForFuture(
      pos,
      walls,
      guardianStart,
      playerStart,
      baseGuardianPath,
    );
    if (future <= 0) return; // would seal the defender off, or change nothing
    trapCandidates.push({ pos, score: future + Math.random() * 0.25 });
  });
  trapCandidates.sort((a, b) => b.score - a.score);

  /**
   * ROTA-DUAL-GUARDIANS-MAPS-01A-BALANCE: the set that SPAWNS has to be safe for
   * every combination the Explorer could plausibly light up.
   *
   * The previous analysis found 68 trap pairs that, active together, would leave
   * the defender with no route or the portal region with no door. Handling that
   * at runtime would mean an invisible rule — "this one you may light, that one
   * you may not" — which no player can learn. So the incompatibility is resolved
   * here instead: a candidate only joins the set if it stays safe alongside
   * every trap already chosen.
   *
   * Both defenders are considered. The Sentinel is not in the runtime yet, but
   * its region is a property of the map, so the check is available today: at
   * least one access to the portal zone must survive.
   */
  const portalZoneKeys = new Set<string>();
  getReachableDistances(exitPosition, walls).forEach((distance, cellKey) => {
    if (distance <= 2) portalZoneKeys.add(cellKey);
  });
  const portalAccessCells: GridPosition[] = [];
  portalZoneKeys.forEach((cellKey) => {
    getNeighbors(keyToPosition(cellKey), walls).forEach((next) => {
      const nextKey = posKey(next);
      if (!portalZoneKeys.has(nextKey) && !portalAccessCells.some((a) => positionsEqual(a, next))) {
        portalAccessCells.push(next);
      }
    });
  });

  const combinationIsSafe = (cells: GridPosition[]): boolean => {
    const blocked = new Set(cells.map(posKey));
    // The defender must keep a way to the Explorer...
    if (findPathCells(guardianStart, playerStart, walls, blocked) === null) return false;
    // ...and the portal region must keep at least one usable door.
    if (portalAccessCells.length === 0) return true;
    return portalAccessCells.some(
      (access) => findPathCells(exitPosition, access, walls, blocked) !== null,
    );
  };

  const traps: GridPosition[] = [];
  const accepts = (candidate: GridPosition): boolean => {
    if (!combinationIsSafe([...traps, candidate])) return false;
    // Every pair, not just the full set: the Explorer decides the order.
    return traps.every((trap) => combinationIsSafe([trap, candidate]));
  };

  const target = getTrapCount(difficulty, routeStage);
  for (const candidate of trapCandidates) {
    if (traps.length >= target) break;
    if (
      traps.some(
        (trap) => manhattanDistance(trap, candidate.pos) < profile.trapMinSeparation,
      )
    ) {
      continue;
    }
    if (accepts(candidate.pos)) traps.push(candidate.pos);
  }

  // Second pass ignores spacing but never safety: a sparser set is acceptable,
  // an unsafe one is not.
  for (const candidate of trapCandidates) {
    if (traps.length >= target) break;
    if (traps.some((trap) => positionsEqual(trap, candidate.pos))) continue;
    if (accepts(candidate.pos)) traps.push(candidate.pos);
  }

  return { traps, shield };
}

/**
 * Does a second, independent way through exist?
 *
 * ROTA-MAPS-DIFFICULTY-01: a separating cell must lie on EVERY route, so it
 * must lie on the shortest one. Blocking each cell of the shortest path in turn
 * and re-searching therefore proves vertex connectivity >= 2 exactly, at a cost
 * of one BFS per path cell. In the baseline sweep 46% of maps failed this — the
 * Explorer met a corridor with a single choke point and had nothing to plan.
 */
function findPathCells(
  start: GridPosition,
  target: GridPosition,
  walls: Set<string>,
  blocked?: Set<string>,
): GridPosition[] | null {
  const previous = new Map<string, string | null>([[posKey(start), null]]);
  const queue: GridPosition[] = [start];

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    if (positionsEqual(current, target)) {
      const cells: GridPosition[] = [];
      let cursor: string | null = posKey(current);
      while (cursor) {
        cells.unshift(keyToPosition(cursor));
        cursor = previous.get(cursor) ?? null;
      }
      return cells;
    }
    for (const next of getNeighbors(current, walls)) {
      const key = posKey(next);
      if (previous.has(key) || blocked?.has(key)) continue;
      previous.set(key, posKey(current));
      queue.push(next);
    }
  }
  return null;
}

/**
 * Biconnected decomposition of the walkable board, computed once per candidate.
 *
 * ROTA-DUAL-GUARDIANS-MAPS-01A-GRAPH-PERF-CLOSE — the contract this replaces,
 * stated exactly:
 *
 *   hasAlternativeRoute(s, t) = s and t are connected, AND removing any single
 *   interior cell of one shortest s->t path still leaves them connected.
 *
 * A cell that separates s from t must lie on EVERY s->t path, and therefore on
 * the shortest one — so the old loop was testing precisely "no cut vertex
 * separates s from t". In a connected graph that is equivalent to "s and t lie
 * in a common biconnected component": the block-cut tree path between two
 * vertices of the same block contains no cut vertex.
 *
 * The old form cost one graph search per interior cell, and
 * `routeCellsHaveEscape` ran it once per route cell — O(route x path) searches,
 * hundreds per candidate, which measured 5.3 s at p90 on Rota 3 Desafiador.
 * One Tarjan pass is O(V+E) and answers every pair in constant time.
 *
 * Adjacency and the degenerate cases are preserved deliberately: s === t is
 * vacuously true in the old code (empty interior), and adjacent cells share the
 * block formed by their own edge.
 */
interface BoardBlocks {
  /** Block ids each walkable cell belongs to. Cut vertices belong to several. */
  blocksOf: Map<string, number[]>;
  /** Connected-component id per cell, so disconnection is still detectable. */
  componentOf: Map<string, number>;
}

function decomposeBoardBlocks(walls: Set<string>): BoardBlocks {
  const blocksOf = new Map<string, number[]>();
  const componentOf = new Map<string, number>();
  const discovery = new Map<string, number>();
  const low = new Map<string, number>();
  let timer = 0;
  let blockId = 0;
  let componentId = 0;

  const addBlock = (cellKey: string, id: number) => {
    const list = blocksOf.get(cellKey);
    if (!list) blocksOf.set(cellKey, [id]);
    else if (!list.includes(id)) list.push(id);
  };

  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const root = { row, col };
      const rootKey = posKey(root);
      if (walls.has(rootKey) || discovery.has(rootKey)) continue;

      const component = componentId;
      componentId += 1;
      // Iterative DFS with an explicit edge stack (Tarjan's block algorithm).
      const edgeStack: Array<[string, string]> = [];
      const frame: Array<{
        cell: GridPosition;
        parent: string | null;
        neighbours: GridPosition[];
        index: number;
      }> = [{ cell: root, parent: null, neighbours: getNeighbors(root, walls), index: 0 }];
      discovery.set(rootKey, timer);
      low.set(rootKey, timer);
      componentOf.set(rootKey, component);
      timer += 1;

      while (frame.length > 0) {
        const top = frame[frame.length - 1];
        const topKey = posKey(top.cell);

        if (top.index < top.neighbours.length) {
          const next = top.neighbours[top.index];
          top.index += 1;
          const nextKey = posKey(next);
          if (nextKey === top.parent) continue;

          if (!discovery.has(nextKey)) {
            edgeStack.push([topKey, nextKey]);
            discovery.set(nextKey, timer);
            low.set(nextKey, timer);
            componentOf.set(nextKey, component);
            timer += 1;
            frame.push({
              cell: next,
              parent: topKey,
              neighbours: getNeighbors(next, walls),
              index: 0,
            });
          } else if ((discovery.get(nextKey) ?? 0) < (discovery.get(topKey) ?? 0)) {
            // Back edge.
            edgeStack.push([topKey, nextKey]);
            low.set(topKey, Math.min(low.get(topKey) ?? 0, discovery.get(nextKey) ?? 0));
          }
          continue;
        }

        frame.pop();
        const parentKey = top.parent;
        if (parentKey === null) continue;

        low.set(parentKey, Math.min(low.get(parentKey) ?? 0, low.get(topKey) ?? 0));

        // Parent is an articulation point for this child: pop one block.
        if ((low.get(topKey) ?? 0) >= (discovery.get(parentKey) ?? 0)) {
          const id = blockId;
          blockId += 1;
          for (;;) {
            const edge = edgeStack.pop();
            if (!edge) break;
            addBlock(edge[0], id);
            addBlock(edge[1], id);
            if (edge[0] === parentKey && edge[1] === topKey) break;
          }
        }
      }
    }
  }

  return { blocksOf, componentOf };
}

/** Same verdict as the old BFS rule, in constant time. */
function sharesBlock(
  blocks: BoardBlocks,
  start: GridPosition,
  target: GridPosition,
): boolean {
  const a = posKey(start);
  const b = posKey(target);
  if (a === b) return blocks.componentOf.has(a); // vacuously true, if it exists
  const componentA = blocks.componentOf.get(a);
  const componentB = blocks.componentOf.get(b);
  if (componentA === undefined || componentB === undefined) return false;
  if (componentA !== componentB) return false; // not connected at all
  const listA = blocks.blocksOf.get(a);
  const listB = blocks.blocksOf.get(b);
  if (!listA || !listB) return false;
  return listA.some((id) => listB.includes(id));
}

/**
 * The route the Explorer actually has to walk: every light, in the cheapest
 * order, then the portal. The old metrics measured start -> portal, which is
 * not the task and understates the journey.
 */
interface ObjectiveRoute {
  moves: number;
  cells: GridPosition[];
}

/**
 * Every cell that is not admissible, treated as a wall for pathfinding only.
 * Degrees, blocks and the gates themselves keep measuring the real walls.
 */
function restrictToAdmissible(
  walls: Set<string>,
  admissible: Set<string>,
): Set<string> {
  const restricted = new Set(walls);
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cellKey = `${row},${col}`;
      if (!admissible.has(cellKey)) restricted.add(cellKey);
    }
  }
  return restricted;
}

function computeObjectiveRoute(
  playerStart: GridPosition,
  stars: GridPosition[],
  exitPosition: GridPosition,
  walls: Set<string>,
  admissible?: Set<string>,
): ObjectiveRoute | null {
  // With an admissible set the search is confined to it, and nothing else about
  // the route changes: same node list, same permutation search, same cost, same
  // deterministic tie-break. It simply cannot pick a cell the escape-width
  // contract forbids.
  const graph = admissible ? restrictToAdmissible(walls, admissible) : walls;
  const nodes = [playerStart, ...stars, exitPosition];
  const size = nodes.length;
  const cost: number[][] = [];
  for (let i = 0; i < size; i += 1) {
    const distances = getReachableDistances(nodes[i], graph);
    cost.push(nodes.map((node) => distances.get(posKey(node)) ?? Number.POSITIVE_INFINITY));
  }

  const exitIndex = size - 1;
  const lightIndexes = stars.map((_, index) => index + 1);
  let bestOrder: number[] | null = null;
  let bestTotal = Number.POSITIVE_INFINITY;

  const walk = (remaining: number[], order: number[], total: number) => {
    if (total >= bestTotal) return;
    if (remaining.length === 0) {
      const last = order.length ? order[order.length - 1] : 0;
      const full = total + cost[last][exitIndex];
      if (full < bestTotal) {
        bestTotal = full;
        bestOrder = [...order];
      }
      return;
    }
    const from = order.length ? order[order.length - 1] : 0;
    for (let i = 0; i < remaining.length; i += 1) {
      const next = remaining[i];
      walk(
        [...remaining.slice(0, i), ...remaining.slice(i + 1)],
        [...order, next],
        total + cost[from][next],
      );
    }
  };
  walk(lightIndexes, [], 0);

  if (!bestOrder || !Number.isFinite(bestTotal)) return null;

  const cells: GridPosition[] = [];
  let cursor = 0;
  for (const index of [...bestOrder, exitIndex]) {
    const segment = findPathCells(nodes[cursor], nodes[index], graph);
    if (!segment) return null;
    cells.push(...(cells.length ? segment.slice(1) : segment));
    cursor = index;
  }
  return { moves: bestTotal, cells };
}

/**
 * Walk the objective route and count what the Explorer is actually asked to do.
 * A step is "forced" when the only way on is a single cell — the map is moving
 * the piece, not the player. The baseline had forced runs of up to 19 steps.
 */
function measureRouteFlow(route: ObjectiveRoute, walls: Set<string>) {
  let decisions = 0;
  let longestForcedStreak = 0;
  let streak = 0;

  for (let index = 0; index < route.cells.length - 1; index += 1) {
    const current = route.cells[index];
    const previous = index > 0 ? route.cells[index - 1] : null;
    const options = getNeighbors(current, walls).filter(
      (next) => !previous || !positionsEqual(next, previous),
    );
    if (options.length >= 2) {
      decisions += 1;
      streak = 0;
    } else {
      streak += 1;
      longestForcedStreak = Math.max(longestForcedStreak, streak);
    }
  }

  const steps = Math.max(1, route.cells.length - 1);
  return { decisions, longestForcedStreak, decisionRatio: decisions / steps };
}

/**
 * Dead ends are allowed when they hold something or sit on the route — risk,
 * reward, a detour worth taking. An "idle" dead end holds nothing and is far
 * from anywhere the Explorer goes: it is only board that looks like a mistake.
 */
function countIdleDeadEnds(
  walls: Set<string>,
  playerStart: GridPosition,
  routeCells: GridPosition[],
  payload: GridPosition[],
): number {
  const routeKeys = new Set(routeCells.map(posKey));
  const payloadKeys = new Set(payload.map(posKey));
  const distances = getReachableDistances(playerStart, walls);
  let idle = 0;

  distances.forEach((_, key) => {
    const pos = keyToPosition(key);
    if (positionsEqual(pos, playerStart)) return;
    if (getNeighbors(pos, walls).length > 1) return;
    if (payloadKeys.has(key) || routeKeys.has(key)) return;
    const touchesRoute = getNeighbors(pos, walls).some((next) =>
      routeKeys.has(posKey(next)),
    );
    if (!touchesRoute) idle += 1;
  });

  return idle;
}

/**
 * How much a cell would matter once the red trap becomes active.
 *
 * The future rule: the Explorer keeps crossing a lit trap, the defender cannot.
 * So a trap is only worth placing where blocking it would genuinely lengthen the
 * defender's route AND leave it another way round. A trap that changes nothing
 * is decoration; a trap that seals the defender off ends the chase. 79% of the
 * baseline maps had at least one trap worth nothing.
 */
function scoreTrapForFuture(
  cell: GridPosition,
  walls: Set<string>,
  guardianStart: GridPosition,
  playerStart: GridPosition,
  baseGuardianPath: number | null,
): number {
  if (baseGuardianPath === null) return 0;
  const blocked = new Set([posKey(cell)]);
  const detoured = findPathCells(guardianStart, playerStart, walls, blocked);
  if (!detoured) return 0; // would isolate the defender — never acceptable

  const detour = detoured.length - 1 - baseGuardianPath;
  const degree = getNeighbors(cell, walls).length;
  const reach = getReachableDistances(guardianStart, walls).size;
  const reachWithTrap = (() => {
    const distances = new Map<string, number>([[posKey(guardianStart), 0]]);
    const queue: GridPosition[] = [guardianStart];
    for (let index = 0; index < queue.length; index += 1) {
      const current = queue[index];
      for (const next of getNeighbors(current, walls)) {
        const key = posKey(next);
        if (distances.has(key) || blocked.has(key)) continue;
        distances.set(key, 0);
        queue.push(next);
      }
    }
    return distances.size;
  })();

  return (
    detour * 14 +
    (degree >= 3 ? 22 : degree === 2 ? 8 : 0) +
    Math.min(20, (reach - reachWithTrap) * 2)
  );
}

/**
 * Escape horizon: can the Explorer always keep moving from here?
 *
 * ROTA-DUAL-GUARDIANS-MAPS-01A-CLOSE: three maps produced a genuine checkmate —
 * one legal move, no survival horizon, and no earlier decision that avoided it.
 * The shape was always the same: the objective route ran through a cell that is
 * a cul-de-sac, so two defenders converging had nothing to be dodged around.
 *
 * The gate is structural and general, not a per-seed exception. Every cell the
 * Explorer is expected to walk must lie on a cycle — reachable from the start by
 * a route that does not need that cell's single neighbour. Where that holds, a
 * checkmate needs the Explorer to have walked into it, which is legitimate
 * consequence. Corners of the board still exist; they just stop being on the
 * route the game asks the Explorer to take.
 */
function routeCellsHaveEscape(
  playerStart: GridPosition,
  exitPosition: GridPosition,
  routeCells: GridPosition[],
  walls: Set<string>,
  blocks: BoardBlocks,
): boolean {
  // ROTA-DUAL-GUARDIANS-MAPS-01A-FINAL: the topological rule below proves the
  // MAP always has a way round. It says nothing about a STATE, because
  // defenders occupy cells and occupation is not a wall. Reachable-state
  // analysis over the dual model showed the signature plainly: 26 of 27
  // collapses happened on a cell with two or fewer ways out — one defender per
  // exit and the Explorer is sealed with no wall involved.
  //
  // So the cheap, general gate is about ESCAPE WIDTH, not about seeds. A cell
  // with three ways out cannot be closed by two defenders. That width is only
  // required where the two of them actually converge — the portal region and
  // its doors, which is where the Sentinel lives and the Hunter arrives. The
  // rest of the board keeps its corridors and its corners.
  const convergence = new Set<string>();
  getReachableDistances(exitPosition, walls).forEach((distance, cellKey) => {
    if (distance <= 3) convergence.add(cellKey);
  });

  for (const cell of routeCells) {
    if (positionsEqual(cell, playerStart)) continue;
    const exits = getNeighbors(cell, walls).length;
    // A cell with a single way in and out is where a dual pincer becomes a
    // checkmate rather than a scare — anywhere on the board.
    if (exits < 2) return false;
    // Inside the convergence region the Explorer needs a third way out.
    if (convergence.has(posKey(cell)) && !positionsEqual(cell, exitPosition) && exits < 3) {
      return false;
    }
  }
  // The mid-route cells must also stay reachable when any single one of them is
  // blocked: that is what guarantees a way round rather than a way back only.
  return routeCells
    .slice(1, -1)
    .every((cell) => sharesBlock(blocks, playerStart, cell));
}

/**
 * The cells a route is allowed to touch, stated once instead of discovered by
 * trial.
 *
 * ROTA-01A-ESCAPE-ROUTE-GENERATION: `routeCellsHaveEscape` judges a route, but
 * every condition it applies depends only on the WALLS — degree, the portal
 * convergence region, the biconnected block. So admissibility is a property of
 * the board, and the set below is the exact set of cells that can appear in a
 * route the gate would accept, with the same two exemptions the gate makes:
 * the Explorer's own cell, and the portal.
 *
 * That gives two things the generator lacked. Route selection can be confined
 * to this set instead of producing a route and hoping. And a candidate whose
 * portal is not reachable through it can be dropped before any expensive work,
 * because a route that satisfies the gate provably cannot exist.
 *
 * The radius below intentionally mirrors the one inside `routeCellsHaveEscape`,
 * which is deliberately left untouched. The two are kept in step by the
 * equivalence test in `tools/validation/escape-generation-close.mjs`, which
 * compares this derivation against the real gate over tens of thousands of
 * candidates and fails on the first divergence.
 */
const PORTAL_CONVERGENCE_RADIUS = 3;

function admissibleRouteCells(
  playerStart: GridPosition,
  exitPosition: GridPosition,
  walls: Set<string>,
  blocks: BoardBlocks,
): Set<string> {
  const convergence = new Set<string>();
  getReachableDistances(exitPosition, walls).forEach((distance, cellKey) => {
    if (distance <= PORTAL_CONVERGENCE_RADIUS) convergence.add(cellKey);
  });

  const startKey = posKey(playerStart);
  const exitKey = posKey(exitPosition);
  const admissible = new Set<string>([startKey]);

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const pos = { row, col };
      const cellKey = posKey(pos);
      if (cellKey === startKey || walls.has(cellKey)) continue;
      const exits = getNeighbors(pos, walls).length;
      if (exits < 2) continue;
      if (cellKey === exitKey) {
        admissible.add(cellKey);
        continue;
      }
      if (convergence.has(cellKey) && exits < 3) continue;
      if (!sharesBlock(blocks, playerStart, pos)) continue;
      admissible.add(cellKey);
    }
  }
  return admissible;
}

/**
 * Can ANY route on this board satisfy the escape-width contract?
 *
 * A route runs from the Explorer to the portal and every cell after the first
 * must be admissible, so the portal has to be reachable through admissible
 * cells. When it is not, no choice of lights and no ordering can rescue the
 * candidate — the measured answer was 192 out of 192.
 *
 * Necessary, not sufficient: this says a route MIGHT exist, never that the map
 * is good. Every gate still runs afterwards. Being necessary is what makes it
 * safe to reject early — it can only discard candidates the final validator
 * would have discarded anyway.
 */
function escapeGeometryIsPossible(
  playerStart: GridPosition,
  exitPosition: GridPosition,
  walls: Set<string>,
  blocks: BoardBlocks,
): boolean {
  const admissible = admissibleRouteCells(playerStart, exitPosition, walls, blocks);
  const exitKey = posKey(exitPosition);
  if (!admissible.has(exitKey)) return false;

  const seen = new Set<string>([posKey(playerStart)]);
  const queue: GridPosition[] = [playerStart];
  while (queue.length > 0) {
    const current = queue.shift() as GridPosition;
    if (posKey(current) === exitKey) return true;
    for (const next of getNeighbors(current, walls)) {
      const nextKey = posKey(next);
      if (seen.has(nextKey) || !admissible.has(nextKey)) continue;
      seen.add(nextKey);
      queue.push(next);
    }
  }
  return false;
}

/**
 * The objective route the gates will judge.
 *
 * `computeObjectiveRoute` minimises moves and knows nothing about escape width,
 * so on 63 of 255 measured rejections it picked a route through a two-exit cell
 * beside the portal while an admissible route existed on the same walls, the
 * same lights and the same portal. The map was fine; the route was not.
 *
 * Cheapest route first, exactly as before — so every candidate that already
 * passes keeps the identical route and no accepted map changes. Only when that
 * route is inadmissible is the same search repeated inside the admissible
 * subgraph: same cost function, same tie-break, still the shortest route, now
 * chosen from routes the contract permits.
 *
 * If no admissible route exists the original is returned unchanged and the gate
 * rejects it, as it always did. Nothing is relaxed to make a map pass.
 */
function resolveObjectiveRoute(
  playerStart: GridPosition,
  stars: GridPosition[],
  exitPosition: GridPosition,
  walls: Set<string>,
  blocks: BoardBlocks,
): ObjectiveRoute | null {
  const cheapest = computeObjectiveRoute(playerStart, stars, exitPosition, walls);
  if (!cheapest) return null;
  if (routeCellsHaveEscape(playerStart, exitPosition, cheapest.cells, walls, blocks)) {
    return cheapest;
  }
  const admissible = admissibleRouteCells(playerStart, exitPosition, walls, blocks);
  return (
    computeObjectiveRoute(playerStart, stars, exitPosition, walls, admissible) ?? cheapest
  );
}

/**
 * Does this map offer any strategic identity at all?
 *
 * ROTA-DUAL-GUARDIANS-MAPS-01A-FINAL: one map (R1/medium/5659) had two portal
 * doors, no contextual trade-off and no breakable wall — nothing to decide. It
 * was solvable and structurally clean, and still not worth playing. Cheap
 * topological proxies for the families, checked before the expensive work:
 *
 *   - three or more doors into the portal region (family C), or
 *   - a genuinely different second route to the portal (family A), or
 *   - a connecting corridor between regions (family B).
 *
 * Family D is deliberately absent: a breakable wall is optional and must never
 * be fabricated to rescue a map.
 */
function hasStrategicIdentity(
  playerStart: GridPosition,
  exitPosition: GridPosition,
  walls: Set<string>,
): boolean {
  const zoneKeys = new Set<string>();
  getReachableDistances(exitPosition, walls).forEach((distance, cellKey) => {
    if (distance <= 2) zoneKeys.add(cellKey);
  });
  const accesses = new Set<string>();
  zoneKeys.forEach((cellKey) => {
    getNeighbors(keyToPosition(cellKey), walls).forEach((next) => {
      if (!zoneKeys.has(posKey(next))) accesses.add(posKey(next));
    });
  });
  if (accesses.size >= 3) return true; // family C

  const direct = findPathCells(playerStart, exitPosition, walls);
  if (direct) {
    const avoid = new Set(direct.slice(1, -1).map(posKey));
    const second = findPathCells(playerStart, exitPosition, walls, avoid);
    // Family A: a second route that is genuinely a different journey, not a
    // one-cell wobble around the same corridor.
    if (second && second.length - direct.length >= 3) return true;
  }

  // Family B: a corridor of degree-2 cells joining regions.
  let corridor = 0;
  let longest = 0;
  const distances = getReachableDistances(playerStart, walls);
  distances.forEach((_, cellKey) => {
    const degree = getNeighbors(keyToPosition(cellKey), walls).length;
    if (degree === 2) {
      corridor += 1;
      longest = Math.max(longest, corridor);
    } else {
      corridor = 0;
    }
  });
  return longest >= 3;
}

/**
 * Structural pre-check: everything `isValidMap` decides that does not depend on
 * traps or the shield.
 *
 * ROTA-DUAL-GUARDIANS-MAPS-01A-RUNTIME-PERF: trap selection is by far the most
 * expensive step in building a candidate. `scoreTrapForFuture` runs two graph
 * searches for EVERY reachable cell, and `combinationIsSafe` adds more per
 * accepted trap — roughly a hundred searches per candidate. On Rota 3
 * Desafiador the generator rejects ~90 candidates before it accepts one, so
 * nearly all of that work was spent on maps that were already doomed on
 * geometry. Measured in production: p90 7.0 s, max 15.1 s.
 *
 * This runs first, on the cheap half of the candidate. It is a strict subset of
 * the full check — the trap, shield and idle-dead-end rules still run in
 * `isValidMap` afterwards — so a map accepted here is not accepted by a weaker
 * standard, it has simply not been fully judged yet. No gate is removed and no
 * threshold moves.
 */
/**
 * Everything a single candidate's geometry yields, computed once.
 *
 * ROTA-DUAL-GUARDIANS-MAPS-01A-PERF-FINAL-02: `isStructurallyValid` and
 * `isValidMap` were each building the block decomposition and solving the
 * objective route for the SAME walls — two of the two most expensive
 * operations, done twice per structurally valid candidate. This carries them
 * forward instead.
 *
 * It belongs to one attempt and nothing else: it is created inside
 * `buildCandidate`, handed straight to `isValidMap`, and dropped. There is no
 * global cache and therefore nothing that can go stale — if the walls change,
 * a new context is built from scratch.
 */
interface CandidateAnalysis {
  blocks: BoardBlocks;
  objective: ObjectiveRoute;
}

function isStructurallyValid(
  walls: Set<string>,
  grid: number[][],
  guardianStart: GridPosition,
  exitPosition: GridPosition,
  collectibleStars: GridPosition[],
  difficulty: DifficultyLevel,
  routeStage: RouteStage,
  precomputedBlocks?: BoardBlocks,
): CandidateAnalysis | null {
  const profile = ROUTE_STAGE_QUALITY[routeStage];
  const brief = DIFFICULTY_PLAY_BRIEF[difficulty];
  const distances = getReachableDistances(PLAYER_START, walls);
  const pathLength = distances.get(posKey(exitPosition)) ?? null;
  if (pathLength === null || pathLength < getMinimumPathLength(routeStage)) return null;
  if (manhattanDistance(PLAYER_START, guardianStart) < profile.guardianMinStartDistance) return null;
  if (getNeighbors(PLAYER_START, walls).length < 2) return null;
  if (getNeighbors(guardianStart, walls).length < 2) return null;

  const limits = getWallLimits(difficulty, routeStage);
  const wallCount = countWalls(grid);
  if (wallCount < limits.min || wallCount > limits.max) return null;
  if (distances.size < profile.minReachableCells) return null;
  if (countStartZoneWalls(walls) > profile.maxStartZoneWalls) return null;
  if (countReachableJunctions(distances, walls) < profile.minJunctions) return null;

  if (collectibleStars.length !== getStarCount(difficulty, routeStage)) return null;
  const starsReachable = collectibleStars.every(
    (star) =>
      distances.has(posKey(star)) &&
      findPathLength(star, exitPosition, walls) !== null,
  );
  if (!starsReachable) return null;
  const starsSeparated = collectibleStars.every((star, index) =>
    collectibleStars.every(
      (other, otherIndex) =>
        index === otherIndex ||
        manhattanDistance(star, other) >= profile.starMinSeparation,
    ),
  );
  if (!starsSeparated) return null;

  if (!hasStrategicIdentity(PLAYER_START, exitPosition, walls)) return null;
  // One decomposition answers the portal, every light and every route cell.
  const blocks = precomputedBlocks ?? decomposeBoardBlocks(walls);
  if (!sharesBlock(blocks, PLAYER_START, exitPosition)) return null;
  if (!collectibleStars.every((star) => sharesBlock(blocks, PLAYER_START, star))) {
    return null;
  }

  const objective = resolveObjectiveRoute(
    PLAYER_START,
    collectibleStars,
    exitPosition,
    walls,
    blocks,
  );
  if (!objective) return null;
  if (!routeCellsHaveEscape(PLAYER_START, exitPosition, objective.cells, walls, blocks)) {
    return null;
  }
  const flow = measureRouteFlow(objective, walls);
  if (flow.decisionRatio < brief.minDecisionRatio) return null;
  if (flow.longestForcedStreak > brief.maxForcedStreak) return null;
  return { blocks, objective };
}

function isValidMap(
  map: MazeMap,
  difficulty: DifficultyLevel,
  routeStage: RouteStage,
  analysis?: CandidateAnalysis,
): boolean {
  const profile = ROUTE_STAGE_QUALITY[routeStage];
  const distances = getReachableDistances(map.playerStart, map.walls);
  const pathLength = distances.get(posKey(map.exitPosition)) ?? null;
  const guardianDistance = manhattanDistance(map.playerStart, map.guardianStart);
  const wallCount = countWalls(map.grid);
  const limits = getWallLimits(difficulty, routeStage);
  const firstChoices = getNeighbors(map.playerStart, map.walls).length;
  const junctions = countReachableJunctions(distances, map.walls);
  const expectedLights = getStarCount(difficulty, routeStage);
  const expectedTraps = getTrapCount(difficulty, routeStage);
  const starsReachable = map.collectibleStars.every(
    (star) => distances.has(posKey(star)) && findPathLength(star, map.exitPosition, map.walls) !== null,
  );
  const starsSeparated = map.collectibleStars.every((star, index) =>
    map.collectibleStars.every(
      (other, otherIndex) =>
        index === otherIndex ||
        manhattanDistance(star, other) >= profile.starMinSeparation,
    ),
  );
  const trapsValid = map.traps.every((trap) => {
    const distance = distances.get(posKey(trap));
    return (
      distance !== undefined &&
      distance >= profile.trapMinStartDistance &&
      !map.collectibleStars.some((star) => manhattanDistance(star, trap) < 2)
    );
  });
  const shieldDistance = map.shield ? distances.get(posKey(map.shield)) : undefined;
  const shieldUseful =
    shieldDistance !== undefined && shieldDistance >= profile.shieldMinStartDistance;

  // --- play quality, not just solvability -----------------------------------
  const brief = DIFFICULTY_PLAY_BRIEF[difficulty];
  // Decomposed first because the route resolution needs it: without that, a map
  // certified through `analysis` could be re-judged here against a different,
  // inadmissible route and fail its own acceptance.
  const blocks = analysis?.blocks ?? decomposeBoardBlocks(map.walls);
  const objective =
    analysis?.objective ??
    resolveObjectiveRoute(
      map.playerStart,
      map.collectibleStars,
      map.exitPosition,
      map.walls,
      blocks,
    );
  if (!objective) return false;
  const flow = measureRouteFlow(objective, map.walls);
  const idleDeadEnds = countIdleDeadEnds(
    map.walls,
    map.playerStart,
    objective.cells,
    [...map.collectibleStars, ...map.traps, ...(map.shield ? [map.shield] : [])],
  );
  const alternativeRoute = sharesBlock(blocks, map.playerStart, map.exitPosition);
  const lightsHaveAlternatives = map.collectibleStars.every((star) =>
    sharesBlock(blocks, map.playerStart, star),
  );

  const routeHasEscape = routeCellsHaveEscape(
    map.playerStart,
    map.exitPosition,
    objective.cells,
    map.walls,
    blocks,
  );

  const strategicIdentity = hasStrategicIdentity(
    map.playerStart,
    map.exitPosition,
    map.walls,
  );

  return (
    alternativeRoute &&
    lightsHaveAlternatives &&
    routeHasEscape &&
    strategicIdentity &&
    flow.decisionRatio >= brief.minDecisionRatio &&
    flow.longestForcedStreak <= brief.maxForcedStreak &&
    idleDeadEnds <= brief.maxIdleDeadEnds &&
    pathLength !== null &&
    pathLength >= getMinimumPathLength(routeStage) &&
    guardianDistance >= profile.guardianMinStartDistance &&
    firstChoices >= 2 &&
    wallCount >= limits.min &&
    wallCount <= limits.max &&
    distances.size >= profile.minReachableCells &&
    junctions >= profile.minJunctions &&
    countStartZoneWalls(map.walls) <= profile.maxStartZoneWalls &&
    map.collectibleStars.length === expectedLights &&
    starsReachable &&
    starsSeparated &&
    map.traps.length === expectedTraps &&
    trapsValid &&
    shieldUseful &&
    getNeighbors(map.guardianStart, map.walls).length >= 2
  );
}

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
const SENTINEL_COMMIT_TURNS = 3;

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
function chooseGuardianMove(
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

  if (difficulty === "easy" && Math.random() < 0.45) {
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

/**
 * Build one candidate map from an explicit template/exit choice.
 *
 * Split out of `generateMaze` so both the randomised phase and the deterministic
 * recovery sweep run through EXACTLY the same construction and the same gates.
 * There is no second, weaker path.
 */
function buildCandidate(
  template: number[][],
  exitPosition: GridPosition,
  difficulty: DifficultyLevel,
  routeStage: RouteStage,
): { map: MazeMap; analysis: CandidateAnalysis } | null {
  const preliminaryWalls = gridToWalls(template);
  const guardianStart = chooseGuardianStart(
    preliminaryWalls,
    exitPosition,
    routeStage,
    difficulty,
  );
  const grid = randomizeWalls(
    template,
    difficulty,
    routeStage,
    PLAYER_START,
    guardianStart,
    exitPosition,
  );
  const walls = gridToWalls(grid);
  walls.delete(posKey(PLAYER_START));
  walls.delete(posKey(guardianStart));
  walls.delete(posKey(exitPosition));

  // The decomposition depends only on walls, so it exists before the lights and
  // can be shared with the selection that needs it.
  const blocks = decomposeBoardBlocks(walls);

  // Nothing chosen after this point can rescue a board whose portal cannot be
  // reached through admissible cells, and 192 of 192 measured escape-width
  // rejections were exactly that. Refusing here skips light selection, the
  // permutation search over the route and trap placement for a candidate that
  // was already lost. The condition is necessary for the final gate, so this
  // can only discard maps the validator would have discarded.
  if (!escapeGeometryIsPossible(PLAYER_START, exitPosition, walls, blocks)) {
    return null;
  }

  const collectibleStars = chooseStars(
    walls,
    PLAYER_START,
    guardianStart,
    exitPosition,
    difficulty,
    routeStage,
    blocks,
  );

  // Cheap half first. Trap selection is the expensive half and only runs for
  // candidates that already satisfy the geometry.
  const analysis = isStructurallyValid(
    walls,
    grid,
    guardianStart,
    exitPosition,
    collectibleStars,
    difficulty,
    routeStage,
    blocks,
  );
  if (!analysis) return null;

  const { traps, shield } = chooseTrapsAndShield(
    walls,
    PLAYER_START,
    guardianStart,
    exitPosition,
    collectibleStars,
    difficulty,
    routeStage,
  );
  return {
    map: {
      grid,
      walls,
      playerStart: PLAYER_START,
      guardianStart,
      exitPosition,
      collectibleStars,
      traps,
      shield,
    },
    analysis,
  };
}

/**
 * ROTA-DUAL-GUARDIANS-MAPS-01A-FALLBACK-CLOSE: the generator never returns an
 * uncertified map.
 *
 * It used to end with "attempts exhausted -> build one anyway and return it
 * unvalidated". In a 1080-map sweep that fired once, on route 3 / Desafiador —
 * the tightest combination — and that single map reached the Explorer without
 * having passed identity, escape width, trade-offs, trap safety or portal-zone
 * checks. One in a thousand is still a map the product promised and did not
 * deliver.
 *
 * Two phases now, and BOTH end at the same `isValidMap`:
 *
 *   1. randomised search, as before;
 *   2. a bounded deterministic sweep over every template x every exit candidate.
 *      Wall randomisation is stepped down to zero across the sweep, so the last
 *      rounds present the bare template — the layout that was selected by
 *      structural search precisely because it satisfies these gates.
 *
 * If both phases somehow fail, the function throws. A thrown error is a loud,
 * fixable bug; a silently uncertified map is a broken promise the player meets
 * in the middle of a route.
 */
export function generateMaze(
  difficulty: DifficultyLevel,
  routeNumber = 1,
): MazeMap {
  const routeStage = getRouteStage(routeNumber);
  const exitCandidates = ROUTE_STAGE_EXIT_CANDIDATES[routeStage];
  const templates = getRouteStageTemplates(routeStage);

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const template = randomItem(templates);
    const candidate = buildCandidate(
      template,
      randomItem(exitCandidates),
      difficulty,
      routeStage,
    );
    if (
      candidate &&
      isValidMap(candidate.map, difficulty, routeStage, candidate.analysis)
    ) {
      return candidate.map;
    }
  }

  // --- recovery sweep: same gates, deterministic order, bounded -------------
  for (let round = 0; round < RECOVERY_ROUNDS; round++) {
    for (const template of templates) {
      for (const exitPosition of exitCandidates) {
        for (let retry = 0; retry < RECOVERY_RETRIES_PER_SLOT; retry++) {
          const candidate = buildCandidate(
            template,
            exitPosition,
            difficulty,
            routeStage,
          );
          if (
            candidate &&
            isValidMap(candidate.map, difficulty, routeStage, candidate.analysis)
          ) {
            return candidate.map;
          }
        }
      }
    }
  }


  throw new Error(
    `Route map generation failed all gates for stage ${routeStage} (${difficulty}). ` +
      "This is a generator bug, not a runtime condition: no uncertified map is ever returned.",
  );
}

type CompleteFn = (result: Omit<GameResult, "id" | "playedAt">) => void;

/** Turn-based maze escape: reach the exit before the guardian catches you. */
export function useEscapeMaze(onComplete: CompleteFn, initialRouteNumber = 1) {
  const normalizedInitialRouteNumber = Math.max(
    1,
    Math.floor(initialRouteNumber),
  );
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("easy");
  const [routeNumber, setRouteNumber] = useState(normalizedInitialRouteNumber);
  const [mazeMap, setMazeMap] = useState<MazeMap>(() =>
    generateMaze("easy", normalizedInitialRouteNumber),
  );
  const [player, setPlayer] = useState<GridPosition>(mazeMap.playerStart);
  const [guardian, setGuardian] = useState<GridPosition>(mazeMap.guardianStart);
  // The Sentinel's region depends only on the map, so it is derived, not stored.
  const portalDefenceZone = useMemo(
    () =>
      computePortalDefenceZone(
        mazeMap.playerStart,
        mazeMap.exitPosition,
        mazeMap.walls,
      ),
    [mazeMap],
  );
  const [sentinel, setSentinel] = useState<SentinelState>(() =>
    createSentinelState(mazeMap, portalDefenceZone),
  );
  const [collectedStars, setCollectedStars] = useState<string[]>([]);
  const [turns, setTurns] = useState(0);
  const [blockedMoves, setBlockedMoves] = useState(0);
  const [errors, setErrors] = useState(0);
  const [status, setStatus] = useState<GameStatus>("setup");
  const [message, setMessage] = useState("Escolha a dificuldade e inicie.");
  const [blockedShake, setBlockedShake] = useState(0);
  const [moveTick, setMoveTick] = useState(0);
  // Gameplay 2.0 state — lives here in the brain, not in the Canvas.
  const [triggeredTraps, setTriggeredTraps] = useState<string[]>([]);
  const [shieldCollected, setShieldCollected] = useState(false);
  const [shieldUsed, setShieldUsed] = useState(false);

  // Carimbo do último input de movimento processado (teclado, D-pad ou toque).
  // Ref (não estado): nunca re-renderiza e se solta sozinho com o tempo.
  const lastMoveInputAtRef = useRef(0);

  const collectedSet = useMemo(() => new Set(collectedStars), [collectedStars]);
  const triggeredTrapSet = useMemo(
    () => new Set(triggeredTraps),
    [triggeredTraps],
  );
  const shieldActive = shieldCollected && !shieldUsed;
  const totalLights = mazeMap.collectibleStars.length;
  const collectedCount = collectedStars.length;
  const portalActive = totalLights === 0 || collectedCount >= totalLights;
  const routeProgression = useMemo(
    () => getRouteProgression(routeNumber),
    [routeNumber],
  );

  const score = calculateEscapeMazeScore({
    won: status === "won",
    turns,
    blockedMoves,
    errors,
    starsCollected: collectedStars.length,
    difficulty,
  });

  const startNewMaze = useCallback(
    (
      nextDifficulty: DifficultyLevel,
      nextStatus: GameStatus,
      nextRouteNumber = routeNumber,
    ) => {
      const nextMap = generateMaze(nextDifficulty, nextRouteNumber);
      setMazeMap(nextMap);
      setPlayer(nextMap.playerStart);
      setGuardian(nextMap.guardianStart);
      // Rebuilt from the new map, so no commitment survives a restart or a
      // route change. Recomputed here rather than read from the memo, which
      // still holds the previous map on this render.
      setSentinel(
        createSentinelState(
          nextMap,
          computePortalDefenceZone(
            nextMap.playerStart,
            nextMap.exitPosition,
            nextMap.walls,
          ),
        ),
      );
      setCollectedStars([]);
      setTurns(0);
      setBlockedMoves(0);
      setErrors(0);
      setBlockedShake(0);
      setMoveTick(0);
      setTriggeredTraps([]);
      setShieldCollected(false);
      setShieldUsed(false);
      setStatus(nextStatus);
      setMessage(
        nextStatus === "playing"
          ? `${getRouteProgression(nextRouteNumber).label}: observe a rota e colete as luzes.`
          : "Escolha o modo e inicie no seu ritmo.",
      );
    },
    [routeNumber],
  );
  const endGame = useCallback(
    (
      won: boolean,
      finalStats: {
        turns: number;
        blockedMoves: number;
        errors: number;
        difficulty: DifficultyLevel;
        routeNumber: number;
        routeStageLabel: string;
        starsCollected: number;
        totalStars: number;
        trapsTriggered: number;
        shieldCollected: boolean;
        shieldUsed: boolean;
      },
    ) => {
      setStatus(won ? "won" : "lost");
      const nextRouteNumber = finalStats.routeNumber + 1;
      const nextRouteProgression = getRouteProgression(nextRouteNumber);

      if (won) {
        playSuccessChime();
        setMessage("O caminho foi aberto. A pr\u00f3xima rota fica dispon\u00edvel quando quiser.");
      } else {
        playGentleErrorTone();
        setMessage("Rota registrada. Voc\u00ea pode observar outro caminho com calma.");
      }
      onComplete({
        activityId: "escape-maze",
        activityTitle: "Rota Estratégica",
        gameId: "escape-maze",
        score: calculateEscapeMazeScore({
          won,
          turns: finalStats.turns,
          blockedMoves: finalStats.blockedMoves,
          errors: finalStats.errors,
          starsCollected: finalStats.starsCollected,
          difficulty: finalStats.difficulty,
        }),
        summary: won
          ? `Voc\u00ea abriu o caminho da Rota ${finalStats.routeNumber} em ${finalStats.turns} turnos e coletou ${finalStats.starsCollected} ${
              finalStats.starsCollected === 1 ? "luz" : "luzes"
            }. A Rota ${nextRouteNumber} espera por voc\u00ea no seu ritmo.`
          : `A Rota ${finalStats.routeNumber} foi registrada. A Rota ${nextRouteNumber} pode ser explorada com calma quando voc\u00ea quiser.`,
        details: {
          turns: finalStats.turns,
          won,
          starsCollected: finalStats.starsCollected,
          totalStars: finalStats.totalStars,
          blockedMoves: finalStats.blockedMoves,
          errors: finalStats.errors,
          difficulty: finalStats.difficulty,
          routeNumber: finalStats.routeNumber,
          routeStage: finalStats.routeStageLabel,
          nextRouteNumber,
          nextRouteStage: nextRouteProgression.label,
          // Additive optional fields (Gameplay 2.0); old results simply omit them.
          trapsTriggered: finalStats.trapsTriggered,
          shieldCollected: finalStats.shieldCollected,
          shieldUsed: finalStats.shieldUsed,
        },
      });
    },
    [onComplete],
  );

  const startGame = () => {
    startNewMaze(difficulty, "playing");
  };

  const restartGame = () => {
    startNewMaze(difficulty, "playing");
  };

  const continueJourney = () => {
    const nextRouteNumber = routeNumber + 1;
    setRouteNumber(nextRouteNumber);
    startNewMaze(difficulty, "playing", nextRouteNumber);
  };

  const changeDifficulty = (nextDifficulty: DifficultyLevel) => {
    setDifficulty(nextDifficulty);
    setRouteNumber(1);
    startNewMaze(nextDifficulty, "setup", 1);
  };
  const tryMovePlayer = (delta: GridPosition) => {
    if (status !== "playing") return;

    // Um gesto = uma ação: ignora um segundo disparo do MESMO gesto chegando
    // logo atrás do primeiro (qualquer origem de input). Nunca trava: a janela
    // expira sozinha em MOVE_INPUT_GUARD_MS.
    const now = Date.now();
    if (now - lastMoveInputAtRef.current < MOVE_INPUT_GUARD_MS) return;
    lastMoveInputAtRef.current = now;

    const next: GridPosition = {
      row: player.row + delta.row,
      col: player.col + delta.col,
    };

    if (
      next.row < 0 ||
      next.row >= ROWS ||
      next.col < 0 ||
      next.col >= COLS ||
      mazeMap.walls.has(posKey(next))
    ) {
      setBlockedMoves((n) => n + 1);
      setBlockedShake((n) => n + 1);
      playGentleErrorTone();
      setMessage("Caminho bloqueado. Escolha outra direção.");
      return;
    }

    const nextTurn = turns + 1;
    const nextKey = posKey(next);
    const stepOnGuardian = positionsEqual(next, guardian);
    const stepOnSentinel = positionsEqual(next, sentinel.position);

    // --- Gameplay 2.0 overlays (walkable, never alter maze rules) ---
    // A trap only matters when we aren't already losing to the guardian.
    const isUntriggeredTrap =
      !stepOnGuardian &&
      mazeMap.traps.some((trap) => positionsEqual(trap, next)) &&
      !triggeredTrapSet.has(nextKey);
    // ROTA-TRAPS-STRATEGY-01-CLOSEOUT: arming a trap is not a mistake.
    // The trap stopped being a punishment and became the Explorer's own
    // instrument, so stepping on it costs nothing: no error, no shake, no error
    // tone, and no shield spent. The shield keeps its current contract and is
    // simply no longer consumed here — it is redesigned in ROTA-CHEST-REWARDS-01,
    // not invented a new job in this mission.
    const collectShield =
      mazeMap.shield !== null &&
      positionsEqual(next, mazeMap.shield) &&
      !shieldCollected;

    // Errors come from the guardian step only. Traps no longer contribute.
    const errorsAfterStep = errors + (stepOnGuardian ? 1 : 0);

    const collectedStar =
      mazeMap.collectibleStars.some((star) => positionsEqual(star, next)) &&
      !collectedSet.has(nextKey);
    const nextCollectedStars = collectedStar
      ? [...collectedStars, nextKey]
      : collectedStars;
    const nextTotalLights = mazeMap.collectibleStars.length;
    const nextPortalActive =
      nextTotalLights === 0 || nextCollectedStars.length >= nextTotalLights;

    // Post-step snapshots for the completion result (state updates are async).
    const finalStats = (finalTurns: number, finalErrors: number) => ({
      turns: finalTurns,
      blockedMoves,
      errors: finalErrors,
      difficulty,
      routeNumber,
      routeStageLabel: routeProgression.label,
      starsCollected: nextCollectedStars.length,
      totalStars: mazeMap.collectibleStars.length,
      trapsTriggered: triggeredTraps.length + (isUntriggeredTrap ? 1 : 0),
      shieldCollected: shieldCollected || collectShield,
      shieldUsed,
    });

    setTurns(nextTurn);
    setPlayer(next);
    setCollectedStars(nextCollectedStars);
    setMoveTick((t) => t + 1);
    if (isUntriggeredTrap) {
      setTriggeredTraps((prev) => [...prev, nextKey]);
    }
    if (collectShield) {
      setShieldCollected(true);
    }
    if (stepOnGuardian || stepOnSentinel) {
      setErrors(errorsAfterStep);
      endGame(false, finalStats(nextTurn, errorsAfterStep));
      return;
    }

    if (positionsEqual(next, mazeMap.exitPosition) && nextPortalActive) {
      endGame(true, finalStats(nextTurn, errorsAfterStep));
      return;
    }

    // ROTA-TRAPS-STRATEGY-01: the trap arms on the turn the Explorer steps on
    // it, so the defenders must already respect it in THIS turn's answer. The
    // set is built locally rather than read back from state, because the state
    // update above is asynchronous and would arrive one turn late.
    const armedTraps = isUntriggeredTrap
      ? new Set<string>([...triggeredTrapSet, nextKey])
      : triggeredTrapSet;

    const nextGuardian = chooseGuardianMove(
      guardian,
      next,
      mazeMap.exitPosition,
      mazeMap.walls,
      difficulty,
      armedTraps,
    );
    setGuardian(nextGuardian);

    if (positionsEqual(nextGuardian, next)) {
      const caughtErrors = errorsAfterStep + 1;
      setErrors(caughtErrors);
      endGame(false, finalStats(nextTurn, caughtErrors));
      return;
    }

    // The Sentinel moves last, on the state the Hunter has already produced, so
    // the two never resolve a shared destination by render order.
    const nextSentinel = decideSentinelMove(
      sentinel,
      next,
      mazeMap.exitPosition,
      mazeMap.walls,
      portalDefenceZone,
      SENTINEL_COMMIT_TURNS,
      armedTraps,
    );
    const sentinelBlocked =
      positionsEqual(nextSentinel.position, nextGuardian) &&
      !positionsEqual(nextSentinel.position, sentinel.position);
    const settledSentinel: SentinelState = sentinelBlocked
      ? { ...nextSentinel, position: sentinel.position }
      : nextSentinel;
    setSentinel(settledSentinel);

    if (positionsEqual(settledSentinel.position, next)) {
      const caughtErrors = errorsAfterStep + 1;
      setErrors(caughtErrors);
      endGame(false, finalStats(nextTurn, caughtErrors));
      return;
    }

    const guardianClose = manhattanDistance(nextGuardian, next) <= 2;
    const exitClose = manhattanDistance(next, mazeMap.exitPosition) <= 2;

    setMessage(
      isUntriggeredTrap
        ? "Armadilha ativada. Os defensores precisam contornar."
        : collectShield
            ? "Escudo coletado."
            : collectedStar
              ? nextPortalActive
                ? "Portal ativado! Vá até a saída."
                : "Luz-chave coletada."
              : positionsEqual(next, mazeMap.exitPosition)
                ? "O portal ainda precisa das luzes da rota."
              : guardianClose
                ? "O Caçador está próximo. Pense no próximo caminho."
                : exitClose
                  ? portalActive
                    ? "A saída está próxima."
                    : "O portal ainda precisa de todas as luzes."
                  : "Boa jogada. O Caçador se moveu.",
    );
  };

  // Optional keyboard support: arrow keys mirror the on-screen move buttons.
  // No dependency array so the handler always sees the latest game state.
  useEffect(() => {
    if (status !== "playing") return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const delta = ARROW_DELTAS[event.key];
      if (!delta) return;
      event.preventDefault();
      // Tecla segurada dispara auto-repetição do sistema (~30 eventos/s).
      // No MindFlow, um gesto = um passo: repetições automáticas são
      // ignoradas; para andar de novo, solte e pressione de novo.
      if (event.repeat) return;
      tryMovePlayer(delta);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return {
    difficulty,
    routeNumber,
    routeProgression,
    mazeMap,
    player,
    guardian,
    sentinel: sentinel.position,
    sentinelTarget: sentinel.target,
    portalDefenceZone,
    collectedSet,
    collectedCount,
    totalLights,
    portalActive,
    turns,
    blockedMoves,
    errors,
    status,
    message,
    score,
    blockedShake,
    moveTick,
    // Gameplay 2.0 — read-only views for the HUD and the 3D board.
    triggeredTrapSet,
    trapsTriggered: triggeredTraps.length,
    shieldCollected,
    shieldUsed,
    shieldActive,
    startGame,
    restartGame,
    continueJourney,
    changeDifficulty,
    tryMovePlayer,
  };
}
