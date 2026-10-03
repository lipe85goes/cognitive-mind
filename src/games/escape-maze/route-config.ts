import type { DifficultyLevel, GridPosition } from "@/types/game";

/**
 * ROUTE-C1 — the Rota's static configuration: the 9x9 grid, the generation
 * budget, the start and its safe cells, the exit and guardian seats, the
 * templates of each stage, the stage copy, and the difficulty tuning (walls,
 * lights, traps, play brief, stage quality), plus the pure helpers that only
 * read those tables.
 *
 * Moved out of `useEscapeMaze.ts` verbatim: no value, order or comment
 * changed. This module is data. It imports types only — no React, no sounds,
 * no RNG, no Babylon — and it never walks a grid, draws a random number or
 * touches state. Generation and certification read it from
 * `route-generation.ts`, the board's primitives (its size) from
 * `route-geometry.ts`, and the turn loop from the hook (ROUTE-C2).
 * It exports only what those modules consume; the tables behind those helpers
 * stay private here (validators reach them through route-module-loader's
 * surface).
 */

// ROTA-9X9-FOUNDATION-01: the board is 9x9. Every anchor below is derived
// from these two numbers instead of being written as a literal cell, so the
// start, exits and guardian seats can never silently desync from the grid
// again — this is the part that made 7x9 dangerous before.
export const ROWS = 9;
export const COLS = 9;
export const MAX_GENERATION_ATTEMPTS = 500;
/**
 * Recovery sweep budget. The randomised phase already covers the p99 of the
 * measured attempt distribution by a wide margin; this exists only for the tail
 * that the random template/exit draw happens to miss, and it walks every
 * template x exit slot deterministically instead of drawing again.
 */
export const RECOVERY_ROUNDS = 3;
export const RECOVERY_RETRIES_PER_SLOT = 12;

/** Bottom-left corner: the Explorer always starts at the near edge. */
export const PLAYER_START: GridPosition = { row: ROWS - 1, col: 0 };
const START_OPENING: GridPosition = { row: ROWS - 1, col: 1 };
const START_BRANCH: GridPosition = { row: ROWS - 2, col: 0 };
export const START_SAFE_CELLS: GridPosition[] = [
  PLAYER_START,
  START_OPENING,
  START_BRANCH,
  { row: ROWS - 2, col: 1 },
];
/** Far corner, opposite the start: the portal is always a full crossing. */
export const ROUTE_STAGE_EXIT_CANDIDATES: Record<RouteStage, GridPosition[]> = {
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
export const GUARDIAN_CANDIDATES: GridPosition[] = [
  { row: 0, col: Math.floor((COLS - 1) / 2) },
  { row: 1, col: COLS - 3 },
  { row: 2, col: COLS - 1 },
  { row: 0, col: COLS - 1 },
  { row: 3, col: COLS - 2 },
];
export const ROUTE_STAGE_GUARDIAN_CANDIDATES: Record<RouteStage, GridPosition[]> = {
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

export type RouteStage = 1 | 2 | 3;

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
  hard: { min: 25, max: 30 },
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
  hard: 6,
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

export const DIFFICULTY_PLAY_BRIEF: Record<DifficultyLevel, DifficultyPlayBrief> = {
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
    minDecisionRatio: 0.46,
    maxForcedStreak: 6,
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
  /**
   * ROTA-CHEST-REWARDS-01: the Chest inherits the old shield's structural slot
   * unchanged — same minimum distance, same target distance, same scoring, same
   * validation gate. Only the meaning of the tile changed, so map acceptance
   * rates are exactly what the pre-chest baseline measured.
   */
  chestMinStartDistance: number;
  chestTargetDistance: number;
  wallRandomizationAttempts: number;
}

export const ROUTE_STAGE_QUALITY: Record<RouteStage, RouteStageQuality> = {
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
    chestMinStartDistance: 3,
    chestTargetDistance: 4,
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
    chestMinStartDistance: 4,
    chestTargetDistance: 5,
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
    chestMinStartDistance: 4,
    chestTargetDistance: 6,
    wallRandomizationAttempts: 26,
  },
};

export function getRouteStage(routeNumber: number): RouteStage {
  return (((Math.max(1, routeNumber) - 1) % 3) + 1) as RouteStage;
}

export function getRouteProgression(routeNumber: number): RouteProgression {
  const stage = getRouteStage(routeNumber);
  return {
    routeNumber,
    stage,
    ...ROUTE_STAGE_COPY[stage],
  };
}

export function getWallLimits(
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

export function getStarCount(difficulty: DifficultyLevel, stage: RouteStage): number {
  // Mode sets the base; the third route of each mode adds one more light, so
  // both axes progress without either dominating.
  if (stage === 3) return Math.min(6, BASE_STAR_COUNT[difficulty] + 1);
  return BASE_STAR_COUNT[difficulty];
}

export function getStarMinSeparation(
  difficulty: DifficultyLevel,
  stage: RouteStage,
): number {
  const base = ROUTE_STAGE_QUALITY[stage].starMinSeparation;
  return difficulty === "hard" && stage === 3 ? base + 1 : base;
}

export function getTrapCount(difficulty: DifficultyLevel, stage: RouteStage): number {
  if (stage === 1) return Math.max(2, BASE_TRAP_COUNT[difficulty] - 1);
  if (stage === 3) return Math.min(6, BASE_TRAP_COUNT[difficulty] + 1);
  return BASE_TRAP_COUNT[difficulty];
}

export function getMinimumPathLength(stage: RouteStage): number {
  return stage === 1 ? 7 : stage === 2 ? 8 : 10;
}

export function getRouteStageTemplates(stage: RouteStage): number[][][] {
  return ROUTE_STAGE_TEMPLATES[stage] ?? MAZE_TEMPLATES;
}
