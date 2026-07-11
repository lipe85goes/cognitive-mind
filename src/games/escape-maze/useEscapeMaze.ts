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

export const ROWS = 7;
export const COLS = 7;
const MAX_GENERATION_ATTEMPTS = 80;

const PLAYER_START: GridPosition = { row: 6, col: 0 };
const START_OPENING: GridPosition = { row: 6, col: 1 };
const START_BRANCH: GridPosition = { row: 5, col: 0 };
const START_SAFE_CELLS: GridPosition[] = [
  PLAYER_START,
  START_OPENING,
  START_BRANCH,
  { row: 5, col: 1 },
];
const EXIT_CANDIDATES: GridPosition[] = [
  { row: 0, col: 6 },
  { row: 1, col: 6 },
  { row: 0, col: 5 },
];
const ROUTE_STAGE_EXIT_CANDIDATES: Record<RouteStage, GridPosition[]> = {
  1: [
    { row: 2, col: 6 },
    { row: 2, col: 5 },
  ],
  2: [
    { row: 1, col: 6 },
    { row: 0, col: 5 },
    { row: 0, col: 6 },
  ],
  3: [
    { row: 0, col: 6 },
    { row: 0, col: 5 },
  ],
};
const GUARDIAN_CANDIDATES: GridPosition[] = [
  { row: 0, col: 3 },
  { row: 1, col: 5 },
  { row: 2, col: 6 },
  { row: 0, col: 6 },
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

/** 1 = wall, 0 = walkable. Templates are intentionally roomy and validated. */
const MAZE_TEMPLATES: number[][][] = [
  [
    [0, 0, 0, 1, 0, 0, 0],
    [0, 1, 0, 1, 0, 1, 0],
    [0, 1, 0, 0, 0, 1, 0],
    [0, 0, 0, 1, 0, 0, 0],
    [1, 1, 0, 0, 0, 1, 0],
    [0, 0, 0, 1, 0, 0, 0],
    [0, 1, 0, 0, 0, 1, 0],
  ],
  [
    [0, 0, 0, 0, 1, 0, 0],
    [0, 1, 1, 0, 1, 0, 1],
    [0, 0, 0, 0, 0, 0, 0],
    [1, 0, 1, 1, 0, 1, 0],
    [0, 0, 0, 1, 0, 0, 0],
    [0, 1, 0, 0, 0, 1, 0],
    [0, 0, 0, 1, 0, 0, 0],
  ],
  [
    [0, 0, 1, 0, 0, 0, 0],
    [1, 0, 1, 0, 1, 1, 0],
    [0, 0, 0, 0, 0, 0, 0],
    [0, 1, 1, 1, 0, 1, 0],
    [0, 0, 0, 0, 0, 1, 0],
    [0, 1, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 1, 0],
  ],
];

const STAGE_ONE_TEMPLATES: number[][][] = [
  [
    [0, 0, 0, 0, 0, 0, 0],
    [0, 1, 0, 0, 1, 0, 0],
    [0, 0, 0, 1, 0, 0, 0],
    [0, 0, 1, 0, 0, 1, 0],
    [0, 0, 0, 0, 0, 1, 0],
    [0, 0, 1, 0, 0, 0, 0],
    [0, 0, 0, 0, 1, 0, 0],
  ],
  MAZE_TEMPLATES[1],
];

const ROUTE_STAGE_TEMPLATES: Record<RouteStage, number[][][]> = {
  1: STAGE_ONE_TEMPLATES,
  2: [MAZE_TEMPLATES[0], MAZE_TEMPLATES[1], MAZE_TEMPLATES[2]],
  3: [MAZE_TEMPLATES[1], MAZE_TEMPLATES[2]],
};

const FALLBACK_GRID = MAZE_TEMPLATES[0];

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

const WALL_LIMITS: Record<DifficultyLevel, { min: number; max: number }> = {
  easy: { min: 8, max: 11 },
  medium: { min: 11, max: 14 },
  hard: { min: 14, max: 17 },
};

const BASE_STAR_COUNT: Record<DifficultyLevel, number> = {
  easy: 3,
  medium: 3,
  hard: 2,
};

/** A small, calm number of trap tiles per difficulty (Gameplay 2.0). */
const BASE_TRAP_COUNT: Record<DifficultyLevel, number> = {
  easy: 2,
  medium: 3,
  hard: 3,
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
    minReachableCells: 34,
    minJunctions: 7,
    maxStartZoneWalls: 0,
    guardianMinStartDistance: 7,
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
    minReachableCells: 31,
    minJunctions: 6,
    maxStartZoneWalls: 0,
    guardianMinStartDistance: 6,
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
    minReachableCells: 28,
    minJunctions: 5,
    maxStartZoneWalls: 0,
    guardianMinStartDistance: 6,
    starMinStartDistance: 4,
    starMinExitDistance: 2,
    starMinSeparation: 3,
    trapMinStartDistance: 4,
    trapMinSeparation: 2,
    shieldMinStartDistance: 4,
    shieldTargetDistance: 6,
    wallRandomizationAttempts: 18,
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
      min: Math.max(6, base.min - 2),
      max: Math.max(8, base.max - 2),
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
  if (stage === 1) return Math.max(2, BASE_STAR_COUNT[difficulty] - 1);
  if (stage === 3) return Math.min(3, BASE_STAR_COUNT[difficulty] + 1);
  return BASE_STAR_COUNT[difficulty];
}

function getTrapCount(difficulty: DifficultyLevel, stage: RouteStage): number {
  if (stage === 1) return Math.max(1, BASE_TRAP_COUNT[difficulty] - 1);
  if (stage === 3) return Math.min(4, BASE_TRAP_COUNT[difficulty] + 1);
  return BASE_TRAP_COUNT[difficulty];
}

function getMinimumPathLength(stage: RouteStage): number {
  return stage === 1 ? 7 : stage === 2 ? 8 : 10;
}

function getRouteStageTemplates(stage: RouteStage): number[][][] {
  return ROUTE_STAGE_TEMPLATES[stage] ?? MAZE_TEMPLATES;
}

function getFallbackGrid(stage: RouteStage): number[][] {
  return getRouteStageTemplates(stage)[0] ?? FALLBACK_GRID;
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
): number | null {
  const queue: { pos: GridPosition; distance: number }[] = [
    { pos: start, distance: 0 },
  ];
  const visited = new Set([posKey(start)]);

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
): GridPosition {
  const profile = ROUTE_STAGE_QUALITY[routeStage];
  const candidates = [
    ...ROUTE_STAGE_GUARDIAN_CANDIDATES[routeStage],
    ...GUARDIAN_CANDIDATES,
  ].filter(
    (pos) =>
      !walls.has(posKey(pos)) &&
      !positionsEqual(pos, PLAYER_START) &&
      !positionsEqual(pos, exitPosition) &&
      manhattanDistance(pos, PLAYER_START) >= profile.guardianMinStartDistance,
  );

  if (candidates.length > 0) return randomItem(candidates);

  const fallback = GUARDIAN_CANDIDATES.find(
    (pos) =>
      !walls.has(posKey(pos)) &&
      !positionsEqual(pos, PLAYER_START) &&
      !positionsEqual(pos, exitPosition) &&
      manhattanDistance(pos, PLAYER_START) >= 6,
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
  START_SAFE_CELLS.forEach((cell) => {
    grid[cell.row][cell.col] = 0;
  });
  const limits = getWallLimits(difficulty, routeStage);
  const profile = ROUTE_STAGE_QUALITY[routeStage];
  const protectedCells = protectedKeys(playerStart, guardianStart, exitPosition);

  for (let attempt = 0; attempt < profile.wallRandomizationAttempts; attempt++) {
    const row = Math.floor(Math.random() * ROWS);
    const col = Math.floor(Math.random() * COLS);
    const key = `${row},${col}`;
    if (protectedCells.has(key)) continue;

    const wallCount = countWalls(grid);
    if (grid[row][col] === 1 && wallCount > limits.min) {
      grid[row][col] = 0;
    } else if (grid[row][col] === 0 && wallCount < limits.max) {
      grid[row][col] = 1;
    }
  }

  return grid;
}

function chooseStars(
  walls: Set<string>,
  playerStart: GridPosition,
  guardianStart: GridPosition,
  exitPosition: GridPosition,
  difficulty: DifficultyLevel,
  routeStage: RouteStage,
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
        distanceFromExit < profile.starMinExitDistance
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

  const chosen: GridPosition[] = [];
  for (const candidate of candidates) {
    if (
      chosen.every(
        (star) => manhattanDistance(star, candidate.pos) >= profile.starMinSeparation,
      )
    ) {
      chosen.push(candidate.pos);
    }

    if (chosen.length >= targetCount) return chosen;
  }

  for (const candidate of candidates) {
    if (!chosen.some((star) => positionsEqual(star, candidate.pos))) {
      chosen.push(candidate.pos);
    }
    if (chosen.length >= targetCount) break;
  }

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

  const trapCandidates: Array<{ pos: GridPosition; score: number }> = [];
  distances.forEach((distance, key) => {
    const pos = keyToPosition(key);
    if (blocked.has(key) || walls.has(key)) return;
    if (distance < profile.trapMinStartDistance) return;
    if (stars.some((star) => manhattanDistance(star, pos) < 2)) return;

    const exitDistance = findPathLength(pos, exitPosition, walls) ?? 0;
    trapCandidates.push({
      pos,
      score:
        distance * (routeStage === 3 ? 1.5 : 1.1) +
        exitDistance * 0.8 +
        getNeighbors(pos, walls).length * 2 +
        Math.random() * 0.25,
    });
  });
  trapCandidates.sort((a, b) => b.score - a.score);

  const traps: GridPosition[] = [];
  for (const candidate of trapCandidates) {
    if (
      traps.every(
        (trap) => manhattanDistance(trap, candidate.pos) >= profile.trapMinSeparation,
      )
    ) {
      traps.push(candidate.pos);
    }

    if (traps.length >= getTrapCount(difficulty, routeStage)) return { traps, shield };
  }

  for (const candidate of trapCandidates) {
    if (!traps.some((trap) => positionsEqual(trap, candidate.pos))) {
      traps.push(candidate.pos);
    }
    if (traps.length >= getTrapCount(difficulty, routeStage)) break;
  }

  return { traps, shield };
}

function isValidMap(
  map: MazeMap,
  difficulty: DifficultyLevel,
  routeStage: RouteStage,
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

  return (
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

function chooseGuardianMove(
  guardian: GridPosition,
  player: GridPosition,
  exitPosition: GridPosition,
  walls: Set<string>,
  difficulty: DifficultyLevel,
): GridPosition {
  const preferred = getPredatorNextPosition(
    guardian,
    player,
    walls,
    ROWS,
    COLS,
    difficulty,
  );

  if (!positionsEqual(preferred, exitPosition)) {
    return preferred;
  }

  const alternatives = getNeighbors(guardian, walls).filter(
    (next) => !positionsEqual(next, exitPosition),
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

export function generateMaze(
  difficulty: DifficultyLevel,
  routeNumber = 1,
): MazeMap {
  const routeStage = getRouteStage(routeNumber);
  const exitCandidates = ROUTE_STAGE_EXIT_CANDIDATES[routeStage];

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const template = randomItem(getRouteStageTemplates(routeStage));
    const exitPosition = randomItem(exitCandidates);
    const preliminaryWalls = gridToWalls(template);
    const guardianStart = chooseGuardianStart(
      preliminaryWalls,
      exitPosition,
      routeStage,
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

    const collectibleStars = chooseStars(
      walls,
      PLAYER_START,
      guardianStart,
      exitPosition,
      difficulty,
      routeStage,
    );
    const { traps, shield } = chooseTrapsAndShield(
      walls,
      PLAYER_START,
      guardianStart,
      exitPosition,
      collectibleStars,
      difficulty,
      routeStage,
    );
    const map = {
      grid,
      walls,
      playerStart: PLAYER_START,
      guardianStart,
      exitPosition,
      collectibleStars,
      traps,
      shield,
    };

    if (isValidMap(map, difficulty, routeStage)) return map;
  }

  const fallbackGrid = cloneGrid(getFallbackGrid(routeStage));
  fallbackGrid[START_OPENING.row][START_OPENING.col] = 0;
  const walls = gridToWalls(fallbackGrid);
  const exitPosition = ROUTE_STAGE_EXIT_CANDIDATES[routeStage][0] ?? EXIT_CANDIDATES[0];
  const guardianStart = chooseGuardianStart(walls, exitPosition, routeStage);
  walls.delete(posKey(PLAYER_START));
  walls.delete(posKey(exitPosition));
  walls.delete(posKey(guardianStart));

  const collectibleStars = chooseStars(
    walls,
    PLAYER_START,
    guardianStart,
    exitPosition,
    difficulty,
    routeStage,
  );
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
    grid: fallbackGrid,
    walls,
    playerStart: PLAYER_START,
    guardianStart,
    exitPosition,
    collectibleStars,
    traps,
    shield,
  };
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

    // --- Gameplay 2.0 overlays (walkable, never alter maze rules) ---
    // A trap only matters when we aren't already losing to the guardian.
    const isUntriggeredTrap =
      !stepOnGuardian &&
      mazeMap.traps.some((trap) => positionsEqual(trap, next)) &&
      !triggeredTrapSet.has(nextKey);
    const shieldAbsorbs = isUntriggeredTrap && shieldActive;
    const trapHurts = isUntriggeredTrap && !shieldAbsorbs;
    const collectShield =
      mazeMap.shield !== null &&
      positionsEqual(next, mazeMap.shield) &&
      !shieldCollected;

    // Errors = the existing guardian-step error, plus an unshielded trap.
    const errorsAfterStep =
      errors + (stepOnGuardian ? 1 : 0) + (trapHurts ? 1 : 0);

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
      shieldUsed: shieldUsed || shieldAbsorbs,
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
    if (shieldAbsorbs) {
      setShieldUsed(true);
    }
    if (trapHurts) {
      setErrors(errorsAfterStep);
      setBlockedShake((n) => n + 1);
      playGentleErrorTone();
    }

    if (stepOnGuardian) {
      setErrors(errorsAfterStep);
      endGame(false, finalStats(nextTurn, errorsAfterStep));
      return;
    }

    if (positionsEqual(next, mazeMap.exitPosition) && nextPortalActive) {
      endGame(true, finalStats(nextTurn, errorsAfterStep));
      return;
    }

    const nextGuardian = chooseGuardianMove(
      guardian,
      next,
      mazeMap.exitPosition,
      mazeMap.walls,
      difficulty,
    );
    setGuardian(nextGuardian);

    if (positionsEqual(nextGuardian, next)) {
      const caughtErrors = errorsAfterStep + 1;
      setErrors(caughtErrors);
      endGame(false, finalStats(nextTurn, caughtErrors));
      return;
    }

    const guardianClose = manhattanDistance(nextGuardian, next) <= 2;
    const exitClose = manhattanDistance(next, mazeMap.exitPosition) <= 2;

    setMessage(
      shieldAbsorbs
        ? "Escudo protegeu você."
        : trapHurts
          ? "Este caminho tem um obstáculo. Observe o próximo passo."
          : collectShield
            ? "Escudo coletado."
            : collectedStar
              ? nextPortalActive
                ? "Portal ativado! Vá até a saída."
                : "Luz-chave coletada."
              : positionsEqual(next, mazeMap.exitPosition)
                ? "O portal ainda precisa das luzes da rota."
              : guardianClose
                ? "O guardião está próximo. Pense no próximo caminho."
                : exitClose
                  ? portalActive
                    ? "A saída está próxima."
                    : "O portal ainda precisa de todas as luzes."
                  : "Boa jogada. O guardião se moveu.",
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
