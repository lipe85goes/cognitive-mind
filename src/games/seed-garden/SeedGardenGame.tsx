"use client";

import { useCallback, useMemo, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Flower2, Sprout } from "lucide-react";
import { GameActions } from "@/components/GameActions";
import { GameLayout } from "@/components/GameLayout";
import { StatCard } from "@/components/ui/StatCard";
import { calculateSeedGardenScore } from "@/engine/scoring";
import { gentleShake } from "@/lib/feedback-motion";
import type { GameComponentProps, GameResult } from "@/types/game";

const TARGET_SEED_COUNT = 3;
const TARGET_VASES = 3;

interface SeedGardenPuzzle {
  initialSeeds: number[];
  maxMoves: number;
  targetSeedCount: number;
  targetVases: number;
  objective: string;
}

const PUZZLES: SeedGardenPuzzle[] = [
  {
    initialSeeds: [1, 2, 3, 2, 3, 0],
    maxMoves: 8,
    targetSeedCount: TARGET_SEED_COUNT,
    targetVases: TARGET_VASES,
    objective: "Deixe 3 vasos com exatamente 3 sementes.",
  },
  {
    initialSeeds: [0, 1, 2, 3, 2, 3],
    maxMoves: 8,
    targetSeedCount: TARGET_SEED_COUNT,
    targetVases: TARGET_VASES,
    objective: "Deixe 3 vasos com exatamente 3 sementes.",
  },
  {
    initialSeeds: [2, 3, 1, 2, 3, 0],
    maxMoves: 8,
    targetSeedCount: TARGET_SEED_COUNT,
    targetVases: TARGET_VASES,
    objective: "Deixe 3 vasos com exatamente 3 sementes.",
  },
  {
    initialSeeds: [3, 0, 1, 2, 3, 2],
    maxMoves: 8,
    targetSeedCount: TARGET_SEED_COUNT,
    targetVases: TARGET_VASES,
    objective: "Deixe 3 vasos com exatamente 3 sementes.",
  },
  {
    initialSeeds: [3, 2, 3, 0, 1, 2],
    maxMoves: 8,
    targetSeedCount: TARGET_SEED_COUNT,
    targetVases: TARGET_VASES,
    objective: "Deixe 3 vasos com exatamente 3 sementes.",
  },
  {
    initialSeeds: [3, 1, 2, 0, 3, 2],
    maxMoves: 8,
    targetSeedCount: TARGET_SEED_COUNT,
    targetVases: TARGET_VASES,
    objective: "Deixe 3 vasos com exatamente 3 sementes.",
  },
  {
    initialSeeds: [2, 3, 0, 2, 3, 1],
    maxMoves: 8,
    targetSeedCount: TARGET_SEED_COUNT,
    targetVases: TARGET_VASES,
    objective: "Deixe 3 vasos com exatamente 3 sementes.",
  },
];

type GameStatus = "idle" | "playing" | "success" | "failed";

function pickPuzzle(): SeedGardenPuzzle {
  const puzzle = PUZZLES[Math.floor(Math.random() * PUZZLES.length)];
  return {
    ...puzzle,
    initialSeeds: [...puzzle.initialSeeds],
  };
}

function getDistributionTargets(vases: number[], index: number): number[] {
  const seeds = vases[index] ?? 0;
  return Array.from(
    { length: seeds },
    (_, step) => (index + step + 1) % vases.length,
  );
}

function distributeSeeds(vases: number[], index: number): number[] {
  const next = [...vases];
  next[index] = 0;

  getDistributionTargets(vases, index).forEach((targetIndex) => {
    next[targetIndex] += 1;
  });

  return next;
}

function targetCount(vases: number[], puzzle: SeedGardenPuzzle): number {
  return vases.filter((count) => count === puzzle.targetSeedCount).length;
}

function isTargetComplete(vases: number[], puzzle: SeedGardenPuzzle): boolean {
  return targetCount(vases, puzzle) >= puzzle.targetVases;
}

function createResult({
  targetCompleted,
  movesUsed,
  movesRemaining,
}: {
  targetCompleted: boolean;
  movesUsed: number;
  movesRemaining: number;
}): Omit<GameResult, "id" | "playedAt"> {
  const score = calculateSeedGardenScore({ targetCompleted, movesRemaining });

  return {
    activityId: "seed-garden",
    activityTitle: "Jardim de Sementes",
    gameId: "seed-garden",
    score,
    summary: targetCompleted
      ? `Você equilibrou o jardim em ${movesUsed} ${
          movesUsed === 1 ? "movimento" : "movimentos"
        }.`
      : "Boa tentativa. Tente outra estratégia.",
    details: {
      movesUsed,
      movesRemaining,
      targetCompleted,
      roundsCompleted: targetCompleted ? 1 : 0,
    },
  };
}

function SeedDots({ count }: { count: number }) {
  return (
    <div className="mt-2 grid min-h-[2.5rem] grid-cols-4 gap-1.5 px-1">
      {Array.from({ length: Math.max(count, 1) }, (_, index) =>
        index < count ? (
          <span
            key={index}
            className="seed-dot h-3 w-3 rounded-full border border-amber-700 bg-amber-400 shadow-[0_1px_0_0_#92400e]"
            aria-hidden
          />
        ) : (
          <span key={index} className="h-3 w-3" aria-hidden />
        ),
      )}
    </div>
  );
}

export function SeedGardenGame({ onComplete, onExit }: GameComponentProps) {
  const reducedMotion = useReducedMotion();
  const [puzzle, setPuzzle] = useState<SeedGardenPuzzle>(() => pickPuzzle());
  const [vases, setVases] = useState<number[]>(() => puzzle.initialSeeds);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [movesUsed, setMovesUsed] = useState(0);
  const [status, setStatus] = useState<GameStatus>("idle");
  const [message, setMessage] = useState(
    "Escolha um vaso para distribuir as sementes.",
  );
  const [invalidIndex, setInvalidIndex] = useState<number | null>(null);
  const [receivingIndices, setReceivingIndices] = useState<number[]>([]);

  const movesRemaining = Math.max(0, puzzle.maxMoves - movesUsed);
  const selectedSeeds = selectedIndex === null ? 0 : vases[selectedIndex];
  const previewTargets = useMemo(
    () =>
      selectedIndex === null
        ? []
        : getDistributionTargets(vases, selectedIndex),
    [selectedIndex, vases],
  );
  const completedVases = targetCount(vases, puzzle);
  const canDistribute =
    status === "playing" && selectedIndex !== null && selectedSeeds > 0;

  const finishGame = useCallback(
    (targetCompleted: boolean, nextMovesUsed = movesUsed) => {
      const nextMovesRemaining = Math.max(0, puzzle.maxMoves - nextMovesUsed);
      setStatus(targetCompleted ? "success" : "failed");
      setMessage(
        targetCompleted
          ? "Jardim equilibrado!"
          : "Boa tentativa. Tente outra estratégia.",
      );
      onComplete(
        createResult({
          targetCompleted,
          movesUsed: nextMovesUsed,
          movesRemaining: nextMovesRemaining,
        }),
      );
    },
    [movesUsed, onComplete, puzzle.maxMoves],
  );

  const startGame = useCallback(() => {
    const nextPuzzle = pickPuzzle();
    setPuzzle(nextPuzzle);
    setVases(nextPuzzle.initialSeeds);
    setSelectedIndex(null);
    setMovesUsed(0);
    setStatus("playing");
    setMessage("Escolha um vaso para distribuir as sementes.");
    setInvalidIndex(null);
    setReceivingIndices([]);
  }, []);

  const restartGame = useCallback(() => {
    startGame();
  }, [startGame]);

  const handleSelectVase = (index: number) => {
    if (status !== "playing") return;

    if (vases[index] < 1) {
      setInvalidIndex(index);
      setMessage("Escolha um vaso com sementes.");
      window.setTimeout(() => setInvalidIndex(null), 420);
      return;
    }

    if (selectedIndex === index) {
      return;
    }

    setSelectedIndex(index);
    setMessage(
      `Esta escolha distribui ${vases[index]} ${
        vases[index] === 1 ? "semente" : "sementes"
      }.`,
    );
  };

  const handleDistribute = () => {
    if (!canDistribute || selectedIndex === null) {
      setMessage("Escolha um vaso com sementes.");
      return;
    }

    const nextVases = distributeSeeds(vases, selectedIndex);
    const nextMovesUsed = movesUsed + 1;
    const targets = getDistributionTargets(vases, selectedIndex);
    const targetCompleted = isTargetComplete(nextVases, puzzle);
    const movesExhausted = nextMovesUsed >= puzzle.maxMoves;

    if (!targetCompleted && !movesExhausted) {
      setReceivingIndices([...new Set(targets)]);
      window.setTimeout(() => setReceivingIndices([]), 650);
    }
    setVases(nextVases);
    setMovesUsed(nextMovesUsed);
    setSelectedIndex(null);

    if (targetCompleted) {
      setMessage("Flores ativadas!");
      finishGame(true, nextMovesUsed);
      return;
    }

    if (movesExhausted) {
      finishGame(false, nextMovesUsed);
      return;
    }

    setMessage("Observe o jardim e escolha a próxima rota.");
  };

  const handleEndSession = () => {
    finishGame(false, movesUsed);
  };

  return (
    <GameLayout
      title="Jardim de Sementes"
      description="Distribua sementes entre vasos e complete o objetivo com calma."
      world="garden"
      onBack={onExit}
      footer="Sem cronômetro: escolha, observe a prévia e distribua no seu ritmo."
    >
      <div className="space-y-4">
        <section
          className="board-surface garden-board garden-task-card rounded-3xl border-emerald-300 p-4"
          aria-labelledby="seed-target-heading"
        >
          <div className="flex items-start gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-emerald-300 bg-white text-emerald-700 shadow-[0_3px_0_0_#86efac]"
              aria-hidden
            >
              <Flower2 className="h-7 w-7" strokeWidth={2.25} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="section-label">Objetivo</p>
              <h3
                id="seed-target-heading"
                className="text-xl font-bold leading-snug text-slate-900"
              >
                {puzzle.objective}
              </h3>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <StatCard
              label="Flores prontas"
              value={`${completedVases}/${puzzle.targetVases}`}
              accent="success"
            />
            <StatCard
              label="Movimentos restantes"
              value={movesRemaining}
              accent={movesRemaining <= 2 ? "danger" : "score"}
            />
          </div>
        </section>

        <motion.p
          key={message}
          className={`rounded-2xl border-2 px-4 py-3 text-center text-lg font-bold ${
            status === "success"
              ? "border-emerald-300 bg-emerald-50 text-emerald-900"
              : status === "failed"
                ? "border-amber-300 bg-amber-50 text-amber-900"
                : "border-sky-200 bg-sky-50 text-sky-900"
          }`}
          role="status"
          initial={reducedMotion ? false : { opacity: 0, y: 8 }}
          animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
        >
          {message}
        </motion.p>

        <div
          className="board-surface garden-board garden-plot grid grid-cols-2 gap-3 rounded-3xl border-amber-200 p-3 min-[420px]:grid-cols-3"
          role="group"
          aria-label="Tabuleiro com vasos de sementes"
        >
          {vases.map((seedCount, index) => {
            const isSelected = selectedIndex === index;
            const isPreviewed = previewTargets.includes(index);
            const isReceiving = receivingIndices.includes(index);
            const isComplete = seedCount === TARGET_SEED_COUNT;
            const disabled = status !== "playing";

            return (
              <motion.button
                key={index}
                type="button"
                onClick={() => handleSelectVase(index)}
                disabled={disabled}
                aria-label={`Vaso ${index + 1} com ${seedCount} ${
                  seedCount === 1 ? "semente" : "sementes"
                }`}
                aria-pressed={isSelected}
                variants={gentleShake}
                animate={
                  invalidIndex === index
                    ? "shake"
                    : isReceiving && !reducedMotion
                      ? { scale: [1, 1.04, 1] }
                      : undefined
                }
                transition={{ duration: 0.35 }}
                className={`garden-pot tactile-tile relative min-h-[8.5rem] rounded-[1.55rem_1.55rem_2rem_2rem] border-2 px-3 py-4 text-center focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)] disabled:cursor-default ${
                  isSelected
                    ? "garden-pot-selected border-emerald-700 bg-emerald-100 text-emerald-950 shadow-[0_6px_0_0_#047857,0_0_18px_rgb(16_185_129/0.28)]"
                    : isComplete
                      ? "garden-pot-bloom border-emerald-400 bg-emerald-50 text-emerald-950"
                      : "border-amber-300 bg-gradient-to-b from-amber-50 to-white text-slate-900"
                } ${isPreviewed ? "ring-4 ring-sky-300/70" : ""}`}
              >
                {isPreviewed && (
                  <span className="absolute right-2 top-2 rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-800">
                    recebe
                  </span>
                )}
                {isComplete && (
                  <Flower2
                    className="absolute left-2 top-2 h-5 w-5 text-emerald-700"
                    aria-hidden
                  />
                )}
                <span className="block text-sm font-bold uppercase tracking-wide text-slate-600">
                  Vaso {index + 1}
                </span>
                <span className="mt-1 block text-5xl font-bold tabular-nums">
                  {seedCount}
                </span>
                <SeedDots count={seedCount} />
              </motion.button>
            );
          })}
        </div>

        <AnimatePresence mode="popLayout">
          {status === "playing" && selectedIndex !== null && (
            <motion.div
              className="garden-preview rounded-2xl border-2 border-emerald-200 bg-white p-4 shadow-[0_4px_0_0_#bbf7d0]"
              initial={reducedMotion ? false : { opacity: 0, y: 12 }}
              animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -8 }}
            >
              <p className="text-center text-lg font-semibold text-slate-700">
                Esta escolha distribui{" "}
                <strong className="text-emerald-800">{selectedSeeds}</strong>{" "}
                {selectedSeeds === 1 ? "semente" : "sementes"}.
              </p>
              <button
                type="button"
                onClick={handleDistribute}
                disabled={!canDistribute}
                aria-label="Distribuir sementes do vaso selecionado"
                className="btn-primary mt-3 flex w-full items-center justify-center gap-2 text-lg disabled:opacity-50"
              >
                <Sprout className="h-6 w-6" aria-hidden />
                Distribuir sementes
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {status === "idle" ? (
          <button
            type="button"
            onClick={startGame}
            aria-label="Iniciar atividade Jardim de Sementes"
            className="btn-primary flex w-full items-center justify-center gap-2 text-lg"
          >
            <Sprout className="h-6 w-6" aria-hidden />
            Iniciar desafio
          </button>
        ) : (
          <GameActions
            onRestart={restartGame}
            onEndSession={handleEndSession}
            restartLabel="Novo jardim"
            endLabel="Encerrar sessão"
            disabled={status !== "playing"}
          />
        )}
      </div>
    </GameLayout>
  );
}
