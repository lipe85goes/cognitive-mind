"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronRight, Flower2, Sprout, Target } from "lucide-react";
import { GameActions } from "@/components/GameActions";
import { GameLayout } from "@/components/GameLayout";
import { StatusBanner } from "@/components/ui/StatusBanner";
import { calculateSeedGardenScore } from "@/engine/scoring";
import { gentleShakeAnimate } from "@/lib/feedback-motion";
import type { GameComponentProps, GameResult } from "@/types/game";

const TARGET_SEED_COUNT = 3;
const TARGET_VASES = 3;

/** Pause so the player sees the garden bloom before the result screen. */
const BLOOM_CELEBRATION_MS = 1200;

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
            aria-hidden="true"
          />
        ) : (
          <span key={index} className="h-3 w-3" aria-hidden="true" />
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
    "Toque em um vaso com sementes para ver a prévia.",
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
  const displayScore = calculateSeedGardenScore({
    targetCompleted: status === "success",
    movesRemaining,
  });

  const bloomTimerRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (bloomTimerRef.current !== null) {
        window.clearTimeout(bloomTimerRef.current);
      }
    },
    [],
  );

  const finishGame = useCallback(
    (targetCompleted: boolean, nextMovesUsed = movesUsed) => {
      const nextMovesRemaining = Math.max(0, puzzle.maxMoves - nextMovesUsed);
      setStatus(targetCompleted ? "success" : "failed");
      setMessage(
        targetCompleted
          ? "Jardim equilibrado! As flores se abriram."
          : "Boa tentativa. Tente outra estratégia.",
      );
      const result = createResult({
        targetCompleted,
        movesUsed: nextMovesUsed,
        movesRemaining: nextMovesRemaining,
      });

      if (targetCompleted) {
        // Hold the blooming garden on screen briefly before the result.
        bloomTimerRef.current = window.setTimeout(
          () => onComplete(result),
          BLOOM_CELEBRATION_MS,
        );
        return;
      }

      onComplete(result);
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
    setMessage(
      "Toque em um vaso com sementes para ver a prévia. Trocar de vaso não gasta movimentos.",
    );
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
      `Prévia: ${vases[index]} ${
        vases[index] === 1 ? "semente vai" : "sementes vão"
      } para os vasos seguintes. Distribua quando quiser.`,
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

    setReceivingIndices([...new Set(targets)]);
    window.setTimeout(
      () => setReceivingIndices([]),
      targetCompleted ? BLOOM_CELEBRATION_MS : 650,
    );
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

  const messageVariant =
    status === "success"
      ? "success"
      : status === "failed" || invalidIndex !== null
        ? "error"
        : status === "playing"
          ? "info"
          : "neutral";

  const renderMovesCard = (className: string) => (
    <section className={`seed-moves-card ${className}`}>
      <p>Movimentos restantes</p>
      <strong>{movesRemaining}</strong>
      <div className="seed-move-track" aria-hidden="true">
        {Array.from({ length: puzzle.maxMoves }, (_, index) => (
          <span
            className={index < movesRemaining ? "is-available" : "is-used"}
            key={index}
          />
        ))}
      </div>
      <p className="seed-encouragement">Ver a prévia não gasta movimentos.</p>
    </section>
  );

  const renderActionCard = (className: string) => (
    <section className={`seed-action-card ${className}`}>
      {status === "idle" ? (
        <p>O jardim está preparado. Comece quando estiver confortável.</p>
      ) : (
        <p>
          {selectedIndex === null
            ? "Toque em um vaso para ver a prévia. Trocar de vaso não gasta movimentos."
            : `Prévia pronta: ${selectedSeeds} ${
                selectedSeeds === 1 ? "semente" : "sementes"
              } para os vasos seguintes.`}
        </p>
      )}
      {status === "idle" ? (
        <button
          type="button"
          onClick={startGame}
          aria-label="Iniciar atividade Jardim de Sementes"
          className="btn-primary flex w-full items-center justify-center gap-2 text-lg"
        >
          <Sprout className="h-6 w-6" aria-hidden="true" />
          Iniciar desafio
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={handleDistribute}
            disabled={!canDistribute}
            aria-label="Distribuir sementes do vaso selecionado"
            className="btn-primary flex w-full items-center justify-center gap-2 text-lg disabled:opacity-50"
          >
            <Sprout className="h-6 w-6" aria-hidden="true" />
            {canDistribute
              ? `Distribuir ${selectedSeeds} ${
                  selectedSeeds === 1 ? "semente" : "sementes"
                }`
              : "Distribuir sementes"}
          </button>
          <GameActions
            onRestart={restartGame}
            onEndSession={handleEndSession}
            restartLabel="Novo jardim"
            endLabel="Encerrar sessão"
            disabled={status !== "playing"}
          />
        </>
      )}
    </section>
  );

  return (
    <GameLayout
      title="Jardim de Sementes"
      description="Planeje, conte e distribua com calma. Cada escolha faz o jardim florescer."
      world="garden"
      wide
      onBack={onExit}
      footer="Sem cronômetro: escolha, observe a prévia e distribua no seu ritmo."
    >
      <div className="seed-world-grid">
        <aside className="seed-side seed-side-left" aria-label="Objetivo e movimentos">
          <section className="seed-objective-card" aria-labelledby="seed-target-heading">
            <div className="seed-card-label">
              <Target size={21} aria-hidden="true" />
              <span>Objetivo</span>
            </div>
            <h3 id="seed-target-heading">
              Deixe <strong>{puzzle.targetVases} vasos</strong> com exatamente{" "}
              <strong>{puzzle.targetSeedCount} sementes</strong> cada um.
            </h3>
            <div className="seed-goal-picture" aria-hidden="true">
              {Array.from({ length: puzzle.targetVases }, (_, index) => (
                <span key={index} className="seed-goal-pot">
                  <Flower2 />
                  <strong>{puzzle.targetSeedCount}</strong>
                </span>
              ))}
            </div>
            <p className="seed-goal-caption">
              Assim o jardim floresce.
            </p>
          </section>

          {renderMovesCard("seed-moves-desktop")}
        </aside>

        <section className="seed-play-area" aria-label="Tabuleiro do jardim">
          {renderActionCard("seed-action-mobile")}
          {status === "idle" && (
            <section className="seed-how-card" aria-label="Como funciona a distribuição">
              <p className="seed-how-title">Como funciona</p>
              <div className="seed-how-row" aria-hidden="true">
                <span className="seed-how-pot is-source">2</span>
                <ChevronRight strokeWidth={2.6} />
                <span className="seed-how-pot is-receive">+1</span>
                <span className="seed-how-pot is-receive">+1</span>
              </div>
              <p className="seed-how-caption">
                O vaso escolhido se esvazia: cada semente vai para o vaso
                seguinte, uma a uma.
              </p>
            </section>
          )}
          <div
            className={`seed-orbit-board ${status === "success" ? "is-blooming" : ""}`}
            role="group"
            aria-label="Tabuleiro com seis vasos"
          >
            <span className="seed-orbit-trace" aria-hidden="true" />
            <span className="seed-board-leaf seed-board-leaf-one" aria-hidden="true" />
            <span className="seed-board-leaf seed-board-leaf-two" aria-hidden="true" />
            <div className="seed-board-emblem" aria-hidden="true">
              <Sprout />
            </div>

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
                  animate={
                    invalidIndex === index && !reducedMotion
                      ? gentleShakeAnimate
                      : isReceiving && !reducedMotion
                        ? { scale: [1, 1.04, 1] }
                        : undefined
                  }
                  transition={{ duration: 0.35 }}
                  className={`garden-pot seed-orbit-pot seed-orbit-pot-${index + 1} tactile-tile relative flex flex-col items-center rounded-full border-2 px-3 py-4 text-center focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)] disabled:cursor-default ${
                    isSelected
                      ? "garden-pot-selected border-emerald-700 bg-emerald-100 text-emerald-950"
                      : isComplete
                        ? "garden-pot-bloom border-emerald-400 bg-emerald-50 text-emerald-950"
                        : "border-amber-300 bg-gradient-to-b from-amber-50 to-white text-slate-900"
                  } ${isPreviewed ? "garden-pot-previewed" : ""}`}
                >
                  {isPreviewed && (
                    <span className="garden-receive" aria-hidden="true">
                      +1
                    </span>
                  )}
                  {isComplete && (
                    <Flower2
                      className="absolute left-2 top-2 h-6 w-6 text-emerald-700"
                      aria-hidden="true"
                    />
                  )}
                  <span className="sr-only">Vaso {index + 1}</span>
                  <span className="seed-pot-count mt-1 block text-5xl font-bold tabular-nums">
                    {seedCount}
                  </span>
                  <SeedDots count={seedCount} />
                </motion.button>
              );
            })}
          </div>

          <motion.div
            key={message}
            initial={reducedMotion ? false : { opacity: 0, y: 8 }}
            animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
          >
            <StatusBanner
              variant={messageVariant}
              label="Sinal do jardim"
              className="seed-bottom-helper"
            >
              {message}
            </StatusBanner>
          </motion.div>
        </section>

        <aside className="seed-side seed-side-right" aria-label="Ações e progresso">
          {renderActionCard("seed-action-desktop")}
          {renderMovesCard("seed-moves-mobile")}

          <section className="seed-stats-card" aria-label="Progresso do jardim">
            <div>
              <span>Vasos prontos</span>
              <strong>{completedVases}/{puzzle.targetVases}</strong>
            </div>
            <div>
              <span>Movimentos</span>
              <strong>{movesUsed}</strong>
            </div>
            <div>
              <span>Pontuação</span>
              <strong>{displayScore}</strong>
            </div>
          </section>

          <section className="seed-garden-progress">
            <p>Seu jardim</p>
            <div aria-hidden="true">
              {Array.from({ length: puzzle.targetVases }, (_, index) => (
                <span className={index < completedVases ? "is-blooming" : ""} key={index}>
                  <Flower2 />
                </span>
              ))}
            </div>
            <strong>{completedVases} de {puzzle.targetVases} vasos completos</strong>
          </section>

        </aside>
      </div>
    </GameLayout>
  );
}
