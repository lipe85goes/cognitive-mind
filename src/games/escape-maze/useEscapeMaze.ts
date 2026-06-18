"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
const MAX_GENERATION_ATTEMPTS = 40;

const PLAYER_START: GridPosition = { row: 6, col: 0 };
const EXIT_CANDIDATES: GridPosition[] = [
  { row: 0, col: 6 },
  { row: 1, col: 6 },
  { row: 0, col: 5 },
];
const GUARDIAN_CANDIDATES: GridPosition[] = [
  { row: 0, col: 3 },
  { row: 1, col: 5 },
  { row: 2, col: 6 },
  { row: 0, col: 6 },
];

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

const FALLBACK_GRID = MAZE_TEMPLATES[0];

const ARROW_DELTAS: Record<string, GridPosition> = {
  ArrowUp: { row: -1, col: 0 },
  ArrowDown: { row: 1, col: 0 },
  ArrowLeft: { row: 0, col: -1 },
  ArrowRight: { row: 0, col: 1 },
};

const WALL_LIMITS: Record<DifficultyLevel, { min: number; max: number }> = {
  easy: { min: 8, max: 11 },
  medium: { min: 11, max: 14 },
  hard: { min: 14, max: 17 },
};

const STAR_COUNT: Record<DifficultyLevel, number> = {
  easy: 3,
  medium: 3,
  hard: 2,
};

/** A small, calm number of trap tiles per difficulty (Gameplay 2.0). */
const TRAP_COUNT: Record<DifficultyLevel, number> = {
  easy: 2,
  medium: 3,
  hard: 3,
};

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

function protectedKeys(
  playerStart: GridPosition,
  guardianStart: GridPosition,
  exitPosition: GridPosition,
): Set<string> {
  return new Set([
    posKey(playerStart),
    posKey(guardianStart),
    posKey(exitPosition),
  ]);
}

function chooseGuardianStart(
  walls: Set<string>,
  exitPosition: GridPosition,
): GridPosition {
  const candidates = GUARDIAN_CANDIDATES.filter(
    (pos) =>
      !walls.has(posKey(pos)) &&
      !positionsEqual(pos, PLAYER_START) &&
      !positionsEqual(pos, exitPosition) &&
      manhattanDistance(pos, PLAYER_START) >= 6,
  );

  return candidates.length > 0 ? randomItem(candidates) : { row: 0, col: 3 };
}

function randomizeWalls(
  baseGrid: number[][],
  difficulty: DifficultyLevel,
  playerStart: GridPosition,
  guardianStart: GridPosition,
  exitPosition: GridPosition,
): number[][] {
  const grid = cloneGrid(baseGrid);
  const limits = WALL_LIMITS[difficulty];
  const protectedCells = protectedKeys(playerStart, guardianStart, exitPosition);

  for (let attempt = 0; attempt < 18; attempt++) {
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
): GridPosition[] {
  const blocked = protectedKeys(playerStart, guardianStart, exitPosition);
  const candidates: GridPosition[] = [];

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const pos = { row, col };
      const key = posKey(pos);
      const pathToStar = findPathLength(playerStart, pos, walls);
      if (!walls.has(key) && !blocked.has(key) && pathToStar !== null) {
        candidates.push(pos);
      }
    }
  }

  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  const chosen: GridPosition[] = [];

  for (const candidate of shuffled) {
    if (
      chosen.every((star) => manhattanDistance(star, candidate) >= 2) &&
      manhattanDistance(candidate, playerStart) >= 2
    ) {
      chosen.push(candidate);
    }

    if (chosen.length >= STAR_COUNT[difficulty]) break;
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
): { traps: GridPosition[]; shield: GridPosition | null } {
  const blocked = new Set<string>([
    posKey(playerStart),
    posKey(guardianStart),
    posKey(exitPosition),
    ...stars.map(posKey),
  ]);

  const free: GridPosition[] = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const pos = { row, col };
      const key = posKey(pos);
      if (walls.has(key) || blocked.has(key)) continue;
      // Never place a hazard right next to the start, so turn 1 is always safe.
      if (manhattanDistance(pos, playerStart) < 2) continue;
      free.push(pos);
    }
  }

  const shuffled = [...free].sort(() => Math.random() - 0.5);

  const traps: GridPosition[] = [];
  for (const cell of shuffled) {
    if (traps.length >= TRAP_COUNT[difficulty]) break;
    // Keep traps from clumping together so the board stays readable.
    if (traps.every((trap) => manhattanDistance(trap, cell) >= 2)) {
      traps.push(cell);
    }
  }

  const trapKeys = new Set(traps.map(posKey));
  const shield =
    shuffled.find(
      (cell) =>
        !trapKeys.has(posKey(cell)) &&
        findPathLength(playerStart, cell, walls) !== null,
    ) ?? null;

  return { traps, shield };
}

function isValidMap(map: MazeMap, difficulty: DifficultyLevel): boolean {
  const pathLength = findPathLength(
    map.playerStart,
    map.exitPosition,
    map.walls,
  );
  const guardianDistance = manhattanDistance(map.playerStart, map.guardianStart);
  const wallCount = countWalls(map.grid);
  const limits = WALL_LIMITS[difficulty];

  return (
    pathLength !== null &&
    pathLength >= 8 &&
    guardianDistance >= 6 &&
    wallCount >= limits.min &&
    wallCount <= limits.max &&
    map.collectibleStars.length >= Math.min(2, STAR_COUNT[difficulty])
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

export function generateMaze(difficulty: DifficultyLevel): MazeMap {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const template = randomItem(MAZE_TEMPLATES);
    const exitPosition = randomItem(EXIT_CANDIDATES);
    const preliminaryWalls = gridToWalls(template);
    const guardianStart = chooseGuardianStart(preliminaryWalls, exitPosition);
    const grid = randomizeWalls(
      template,
      difficulty,
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
    );
    const { traps, shield } = chooseTrapsAndShield(
      walls,
      PLAYER_START,
      guardianStart,
      exitPosition,
      collectibleStars,
      difficulty,
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

    if (isValidMap(map, difficulty)) return map;
  }

  const walls = gridToWalls(FALLBACK_GRID);
  const exitPosition = EXIT_CANDIDATES[0];
  const guardianStart = { row: 0, col: 3 };
  walls.delete(posKey(PLAYER_START));
  walls.delete(posKey(exitPosition));
  walls.delete(posKey(guardianStart));

  const collectibleStars = chooseStars(
    walls,
    PLAYER_START,
    guardianStart,
    exitPosition,
    difficulty,
  );
  const { traps, shield } = chooseTrapsAndShield(
    walls,
    PLAYER_START,
    guardianStart,
    exitPosition,
    collectibleStars,
    difficulty,
  );

  return {
    grid: FALLBACK_GRID,
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
export function useEscapeMaze(onComplete: CompleteFn) {
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("easy");
  const [mazeMap, setMazeMap] = useState<MazeMap>(() => generateMaze("easy"));
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

  const collectedSet = useMemo(() => new Set(collectedStars), [collectedStars]);
  const triggeredTrapSet = useMemo(
    () => new Set(triggeredTraps),
    [triggeredTraps],
  );
  const shieldActive = shieldCollected && !shieldUsed;

  const score = calculateEscapeMazeScore({
    won: status === "won",
    turns,
    blockedMoves,
    errors,
    starsCollected: collectedStars.length,
    difficulty,
  });

  const startNewMaze = useCallback(
    (nextDifficulty: DifficultyLevel, nextStatus: GameStatus) => {
      const nextMap = generateMaze(nextDifficulty);
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
          ? "Chegue até a saída. Pegue o escudo, colete luzes e evite as armadilhas."
          : "Escolha a dificuldade e inicie.",
      );
    },
    [],
  );

  const endGame = useCallback(
    (
      won: boolean,
      finalStats: {
        turns: number;
        blockedMoves: number;
        errors: number;
        difficulty: DifficultyLevel;
        starsCollected: number;
        totalStars: number;
        trapsTriggered: number;
        shieldCollected: boolean;
        shieldUsed: boolean;
      },
    ) => {
      setStatus(won ? "won" : "lost");
      if (won) {
        playSuccessChime();
        setMessage("Rota concluída! Você chegou à saída.");
      } else {
        playGentleErrorTone();
        setMessage("Boa tentativa! Tente outra rota com calma.");
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
          ? `Você chegou à saída em ${finalStats.turns} turnos e coletou ${finalStats.starsCollected} ${
              finalStats.starsCollected === 1 ? "luz" : "luzes"
            }.`
          : "Boa tentativa! Tente outra rota com calma.",
        details: {
          turns: finalStats.turns,
          won,
          starsCollected: finalStats.starsCollected,
          totalStars: finalStats.totalStars,
          blockedMoves: finalStats.blockedMoves,
          errors: finalStats.errors,
          difficulty: finalStats.difficulty,
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

  const changeDifficulty = (nextDifficulty: DifficultyLevel) => {
    setDifficulty(nextDifficulty);
    startNewMaze(nextDifficulty, "setup");
  };

  const tryMovePlayer = (delta: GridPosition) => {
    if (status !== "playing") return;

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

    // Post-step snapshots for the completion result (state updates are async).
    const finalStats = (finalTurns: number, finalErrors: number) => ({
      turns: finalTurns,
      blockedMoves,
      errors: finalErrors,
      difficulty,
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

    if (positionsEqual(next, mazeMap.exitPosition)) {
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
          ? "Armadilha ativada. Planeje o próximo passo."
          : collectShield
            ? "Escudo coletado."
            : collectedStar
              ? "Você coletou uma luz."
              : guardianClose
                ? "Cuidado: o guardião está perto."
                : exitClose
                  ? "A saída está próxima."
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
      tryMovePlayer(delta);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  return {
    difficulty,
    mazeMap,
    player,
    guardian,
    collectedSet,
    collectedCount: collectedStars.length,
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
    changeDifficulty,
    tryMovePlayer,
  };
}
