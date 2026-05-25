"use client";

import { useCallback, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleUserRound,
  DoorOpen,
  Gauge,
  Play,
  Shield,
  Sparkles,
} from "lucide-react";
import { GameActions } from "@/components/GameActions";
import { GameLayout } from "@/components/GameLayout";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { getPredatorNextPosition, manhattanDistance } from "@/engine/difficulty";
import { calculateEscapeMazeScore } from "@/engine/scoring";
import { gentleShakeAnimate } from "@/lib/feedback-motion";
import {
  playGentleErrorTone,
  playSuccessChime,
} from "@/lib/game-sounds";
import type {
  DifficultyLevel,
  GameComponentProps,
  GridPosition,
} from "@/types/game";

const ROWS = 7;
const COLS = 7;
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

const DIFFICULTY_LABELS: Record<DifficultyLevel, string> = {
  easy: "Mais aberto",
  medium: "Equilibrado",
  hard: "Mais caminhos",
};

const DIFFICULTY_TITLE: Record<DifficultyLevel, string> = {
  easy: "Fácil",
  medium: "Médio",
  hard: "Difícil",
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

interface MazeMap {
  grid: number[][];
  walls: Set<string>;
  playerStart: GridPosition;
  guardianStart: GridPosition;
  exitPosition: GridPosition;
  collectibleStars: GridPosition[];
}

type GameStatus = "setup" | "playing" | "won" | "lost";

function posKey(pos: GridPosition): string {
  return `${pos.row},${pos.col}`;
}

function positionsEqual(a: GridPosition, b: GridPosition): boolean {
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
    const map = {
      grid,
      walls,
      playerStart: PLAYER_START,
      guardianStart,
      exitPosition,
      collectibleStars,
    };

    if (isValidMap(map, difficulty)) return map;
  }

  const walls = gridToWalls(FALLBACK_GRID);
  const exitPosition = EXIT_CANDIDATES[0];
  const guardianStart = { row: 0, col: 3 };
  walls.delete(posKey(PLAYER_START));
  walls.delete(posKey(exitPosition));
  walls.delete(posKey(guardianStart));

  return {
    grid: FALLBACK_GRID,
    walls,
    playerStart: PLAYER_START,
    guardianStart,
    exitPosition,
    collectibleStars: chooseStars(
      walls,
      PLAYER_START,
      guardianStart,
      exitPosition,
      difficulty,
    ),
  };
}

/**
 * Turn-based maze escape: reach the exit before the guardian catches you.
 */
export function EscapeMazeGame({ onComplete, onExit }: GameComponentProps) {
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("medium");
  const [mazeMap, setMazeMap] = useState<MazeMap>(() => generateMaze("medium"));
  const [player, setPlayer] = useState<GridPosition>(mazeMap.playerStart);
  const [guardian, setGuardian] = useState<GridPosition>(
    mazeMap.guardianStart,
  );
  const [collectedStars, setCollectedStars] = useState<string[]>([]);
  const [turns, setTurns] = useState(0);
  const [blockedMoves, setBlockedMoves] = useState(0);
  const [errors, setErrors] = useState(0);
  const [status, setStatus] = useState<GameStatus>("setup");
  const [message, setMessage] = useState("Escolha a dificuldade e inicie.");
  const [blockedShake, setBlockedShake] = useState(0);
  const [moveTick, setMoveTick] = useState(0);

  const reducedMotion = useReducedMotion();
  const collectedSet = useMemo(() => new Set(collectedStars), [collectedStars]);

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
      setStatus(nextStatus);
      setMessage(
        nextStatus === "playing"
          ? "Chegue até a saída. Colete luzes se quiser ampliar a rota."
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
      },
    ) => {
      setStatus(won ? "won" : "lost");
      if (won) {
        playSuccessChime();
        setMessage("Você chegou ao destino!");
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
          ? `Você chegou ao destino em ${finalStats.turns} turnos e coletou ${finalStats.starsCollected} ${
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

  const handleDifficultyChange = (nextDifficulty: DifficultyLevel) => {
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
    const nextErrors = positionsEqual(next, guardian) ? errors + 1 : errors;
    const starKey = posKey(next);
    const collectedStar =
      mazeMap.collectibleStars.some((star) => positionsEqual(star, next)) &&
      !collectedSet.has(starKey);
    const nextCollectedStars = collectedStar
      ? [...collectedStars, starKey]
      : collectedStars;

    setTurns(nextTurn);
    setPlayer(next);
    setCollectedStars(nextCollectedStars);
    setMoveTick((t) => t + 1);

    if (positionsEqual(next, guardian)) {
      setErrors(nextErrors);
      endGame(false, {
        turns: nextTurn,
        blockedMoves,
        errors: nextErrors,
        difficulty,
        starsCollected: nextCollectedStars.length,
        totalStars: mazeMap.collectibleStars.length,
      });
      return;
    }

    if (positionsEqual(next, mazeMap.exitPosition)) {
      endGame(true, {
        turns: nextTurn,
        blockedMoves,
        errors,
        difficulty,
        starsCollected: nextCollectedStars.length,
        totalStars: mazeMap.collectibleStars.length,
      });
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
      const caughtErrors = errors + 1;
      setErrors(caughtErrors);
      endGame(false, {
        turns: nextTurn,
        blockedMoves,
        errors: caughtErrors,
        difficulty,
        starsCollected: nextCollectedStars.length,
        totalStars: mazeMap.collectibleStars.length,
      });
      return;
    }

    setMessage(
      collectedStar
        ? "Luz coletada!"
        : "Boa jogada. Escolha o próximo passo com calma.",
    );
  };

  const renderCell = (row: number, col: number) => {
    const pos = { row, col };
    const key = posKey(pos);
    const isWall = mazeMap.walls.has(key);
    const isPlayer = positionsEqual(pos, player);
    const isGuardian = positionsEqual(pos, guardian);
    const isExit = positionsEqual(pos, mazeMap.exitPosition);
    const isStar =
      mazeMap.collectibleStars.some((star) => positionsEqual(star, pos)) &&
      !collectedSet.has(key);

    let cellClass =
      "route-cell relative flex aspect-square min-w-0 items-center justify-center rounded-md border transition-colors duration-150 sm:rounded-lg ";

    if (isWall) {
      cellClass +=
        "route-wall border-slate-600 bg-gradient-to-br from-slate-500 to-slate-700 shadow-[inset_0_2px_4px_rgba(0,0,0,0.22)]";
    } else if (isPlayer) {
      cellClass +=
        "border-sky-700 bg-gradient-to-br from-sky-100 to-sky-300 ring-2 ring-inset ring-sky-500 shadow-[0_0_14px_rgba(14,165,233,0.5)]";
    } else if (isGuardian) {
      cellClass +=
        "border-orange-700 bg-gradient-to-br from-orange-100 to-amber-300 ring-2 ring-inset ring-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.35)]";
    } else if (isExit) {
      cellClass +=
        "border-emerald-700 bg-gradient-to-br from-emerald-100 to-emerald-300 ring-2 ring-inset ring-emerald-500 shadow-[0_0_18px_rgba(16,185,129,0.6)]";
    } else {
      cellClass += "route-floor border-slate-300 bg-white";
    }

    return (
      <div
        key={`${row}-${col}`}
        className={cellClass}
        aria-label={
          isWall
            ? "Parede"
            : isPlayer
              ? "Você"
              : isGuardian
                ? "Guardião"
                : isExit
                  ? "Saída"
                  : isStar
                    ? "Luz"
                    : "Caminho livre"
        }
      >
        {isWall && (
          <span
            className="block h-[72%] w-[72%] rounded-sm border border-slate-700 bg-slate-700/80 sm:h-[75%] sm:w-[75%]"
            aria-hidden
          />
        )}
        {isStar && !isPlayer && !isGuardian && (
          <motion.div
            initial={reducedMotion ? false : { scale: 0.85, opacity: 0.7 }}
            animate={
              reducedMotion ? undefined : { scale: [1, 1.08, 1], opacity: 1 }
            }
            transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 0.6 }}
          >
            <Sparkles
              className="h-5 w-5 text-amber-600 drop-shadow-sm sm:h-6 sm:w-6 md:h-7 md:w-7"
              strokeWidth={2.25}
              aria-hidden
            />
          </motion.div>
        )}
        {isPlayer && (
          <motion.div
            key={moveTick}
            initial={reducedMotion ? false : { scale: 0.75, opacity: 0.75 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 20 }}
          >
            <CircleUserRound
              className="h-6 w-6 text-sky-900 drop-shadow-sm sm:h-7 sm:w-7 md:h-8 md:w-8"
              strokeWidth={2.75}
              aria-hidden
            />
          </motion.div>
        )}
        {!isPlayer && isGuardian && (
          <Shield
            className="h-6 w-6 text-orange-900 drop-shadow-sm sm:h-7 sm:w-7 md:h-8 md:w-8"
            strokeWidth={2.75}
            aria-hidden
          />
        )}
        {!isPlayer && !isGuardian && isExit && (
          <DoorOpen
            className="h-5 w-5 text-emerald-800 sm:h-7 sm:w-7 md:h-8 md:w-8"
            strokeWidth={2.5}
            aria-hidden
          />
        )}
      </div>
    );
  };

  const messageVariant = ((): "neutral" | "info" | "success" | "error" => {
    if (status === "won" || message === "Luz coletada!") return "success";
    if (status === "lost") return "error";
    if (status === "playing") return "info";
    return "neutral";
  })();

  return (
    <GameLayout
      title="Rota Estratégica"
      description="Escolha caminhos com calma, colete luzes e evite o guardião."
      world="route"
      onBack={onExit}
    >
      <div className="min-w-0 w-full max-w-full">
        {status === "setup" && (
          <div className="surface-panel mb-5 space-y-4 p-4 sm:p-5">
            <div className="flex items-center gap-2 text-lg font-bold text-slate-800">
              <Gauge className="h-6 w-6 text-teal-700" aria-hidden />
              Escolha a dificuldade
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {(["easy", "medium", "hard"] as DifficultyLevel[]).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => handleDifficultyChange(level)}
                  aria-label={`Dificuldade ${DIFFICULTY_TITLE[level]}: ${DIFFICULTY_LABELS[level]}`}
                  aria-pressed={difficulty === level}
                  className={`flex min-h-[4.25rem] flex-col items-center justify-center rounded-xl border-2 px-3 py-3 transition ${
                    difficulty === level
                      ? "border-teal-600 bg-teal-50 text-teal-900"
                      : "border-slate-300 bg-white text-slate-800 hover:border-teal-400"
                  }`}
                >
                  <span className="text-lg font-bold">
                    {DIFFICULTY_TITLE[level]}
                  </span>
                  <span className="mt-0.5 text-center text-sm font-semibold text-slate-600">
                    {DIFFICULTY_LABELS[level]}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={startGame}
              aria-label="Iniciar labirinto com a dificuldade selecionada"
              className="btn-primary flex w-full items-center justify-center gap-2"
            >
              <Play className="h-6 w-6 fill-current" aria-hidden />
              Iniciar rota
            </button>
          </div>
        )}

        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Turnos" value={turns} />
          <StatCard
            label="Luzes"
            value={`${collectedStars.length}/${mazeMap.collectibleStars.length}`}
            accent="success"
          />
          <StatCard
            label="Bloqueios"
            value={blockedMoves}
            accent={blockedMoves > 0 ? "danger" : "default"}
          />
          <StatCard label="Pontuação" value={score} accent="score" />
        </div>

        <StatusBanner variant={messageVariant} className="mb-4">
          {message}
        </StatusBanner>

        <motion.div
          className={`board-surface route-board route-tabletop relative mx-auto w-full min-w-0 max-w-[min(100%,calc(100vw-2rem),380px)] overflow-hidden rounded-2xl bg-gradient-to-b from-sky-50 via-[#fffdf8] to-teal-50/70 p-2 sm:max-w-[min(100%,410px)] sm:p-4 ${
            status === "won"
              ? "border-emerald-500 ring-4 ring-emerald-200"
              : status === "lost"
                ? "border-amber-400 ring-4 ring-amber-100"
                : "border-slate-400"
          }`}
          initial={false}
          animate={
            reducedMotion || blockedShake === 0 ? undefined : gentleShakeAnimate
          }
          key={blockedShake > 0 ? `board-${blockedShake}` : "board"}
        >
          <div
            className="grid w-full min-w-0 gap-1 sm:gap-2"
            style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
            role="img"
            aria-label="Rota estratégica: azul é você, laranja é o guardião, verde é a saída, amarelo são luzes, cinza é parede"
          >
            {Array.from({ length: ROWS }, (_, row) =>
              Array.from({ length: COLS }, (_, col) => renderCell(row, col)),
            )}
          </div>
        </motion.div>

        <ul
          className="mx-auto mt-4 grid w-full max-w-[min(100%,360px)] min-w-0 grid-cols-2 justify-items-center gap-x-2 gap-y-2 px-1 text-sm font-bold text-slate-800 sm:max-w-none sm:flex sm:flex-wrap sm:justify-center sm:gap-x-4 sm:gap-y-2.5 sm:text-[1.0625rem]"
          aria-label="Legenda do labirinto"
        >
          <li className="flex items-center gap-1.5 sm:gap-2">
            <CircleUserRound
              className="h-5 w-5 shrink-0 text-sky-800 sm:h-6 sm:w-6"
              aria-hidden
            />
            Você
          </li>
          <li className="flex items-center gap-1.5 sm:gap-2">
            <Shield
              className="h-5 w-5 shrink-0 text-orange-800 sm:h-6 sm:w-6"
              aria-hidden
            />
            Guardião
          </li>
          <li className="flex items-center gap-1.5 sm:gap-2">
            <DoorOpen
              className="h-5 w-5 shrink-0 text-emerald-800 sm:h-6 sm:w-6"
              aria-hidden
            />
            Saída
          </li>
          <li className="flex items-center gap-1.5 sm:gap-2">
            <Sparkles
              className="h-5 w-5 shrink-0 text-amber-600 sm:h-6 sm:w-6"
              aria-hidden
            />
            Luz
          </li>
        </ul>

        {status === "playing" && (
          <motion.div
            className="surface-panel route-controls mx-auto mt-5 w-full min-w-0 max-w-[min(100%,calc(100vw-2rem))] p-3 sm:max-w-[min(340px,100%)] sm:p-4"
            role="group"
            aria-label="Controles de movimento"
            initial={false}
            animate={
              reducedMotion || blockedShake === 0 ? undefined : gentleShakeAnimate
            }
            key={blockedShake > 0 ? `controls-${blockedShake}` : "controls"}
          >
            <p className="mb-3 flex items-center justify-center gap-2 text-center text-base font-bold text-slate-800">
              <Sparkles className="h-5 w-5 text-amber-500" aria-hidden />
              Toque para mover
            </p>
            <div className="mx-auto grid w-full min-w-0 max-w-full grid-cols-3 gap-2 sm:gap-3">
              <div />
              <MoveButton
                direction="up"
                label="Cima"
                reducedMotion={reducedMotion}
                onClick={() => tryMovePlayer({ row: -1, col: 0 })}
              />
              <div />
              <MoveButton
                direction="left"
                label="Esquerda"
                reducedMotion={reducedMotion}
                onClick={() => tryMovePlayer({ row: 0, col: -1 })}
              />
              <MoveButton
                direction="down"
                label="Baixo"
                reducedMotion={reducedMotion}
                onClick={() => tryMovePlayer({ row: 1, col: 0 })}
              />
              <MoveButton
                direction="right"
                label="Direita"
                reducedMotion={reducedMotion}
                onClick={() => tryMovePlayer({ row: 0, col: 1 })}
              />
            </div>
          </motion.div>
        )}

        {status !== "setup" && (
          <GameActions
            onRestart={restartGame}
            disabled={status === "won" || status === "lost"}
            subtle
          />
        )}
      </div>
    </GameLayout>
  );
}

function MoveButton({
  direction,
  label,
  onClick,
  reducedMotion,
}: {
  direction: "up" | "down" | "left" | "right";
  label: string;
  onClick: () => void;
  reducedMotion: boolean | null;
}) {
  const Icon = {
    up: ChevronUp,
    down: ChevronDown,
    left: ChevronLeft,
    right: ChevronRight,
  }[direction];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={reducedMotion ? undefined : { scale: 0.94, y: 2 }}
      whileHover={reducedMotion ? undefined : { y: -2 }}
      className="route-move-button flex aspect-square w-full min-w-0 max-w-full flex-col items-center justify-center rounded-xl border-[3px] border-teal-700 bg-gradient-to-b from-white to-teal-50 shadow-[0_5px_0_0_#0f766e] min-h-[3.25rem] max-h-[4.5rem] sm:min-h-[4.75rem] sm:max-h-[5.5rem] md:max-h-none md:min-h-[5.5rem]"
      aria-label={`Mover ${label}`}
    >
      <Icon
        className="h-8 w-8 shrink-0 text-teal-800 sm:h-10 sm:w-10 md:h-11 md:w-11"
        strokeWidth={2.5}
        aria-hidden
      />
    </motion.button>
  );
}
