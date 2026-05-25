"use client";

import { useCallback, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, Hash, Play } from "lucide-react";
import { GameActions } from "@/components/GameActions";
import { GameLayout } from "@/components/GameLayout";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBanner } from "@/components/ui/StatusBanner";
import {
  calculateNumberTrailScore,
  NUMBER_TRAIL_MAX_ERRORS,
} from "@/engine/scoring";
import {
  gentleShakeAnimate,
  positivePulseAnimate,
} from "@/lib/feedback-motion";
import {
  playGentleErrorTone,
  playSuccessChime,
} from "@/lib/game-sounds";
import type { GameComponentProps } from "@/types/game";

type Phase = "idle" | "playing" | "round-complete";
type TapFeedback = "correct" | "wrong" | null;

interface TrailTile {
  value: number;
  position: number;
}

const LEVEL_NUMBER_COUNTS = [5, 6, 8, 10, 12] as const;
const FEEDBACK_RESET_MS = 650;
const ROUND_RESET_MS = 950;

function numberCountForLevel(level: number): number {
  return LEVEL_NUMBER_COUNTS[Math.min(level - 1, LEVEL_NUMBER_COUNTS.length - 1)];
}

function shuffledValues(count: number): number[] {
  const values = Array.from({ length: count }, (_, index) => index + 1);

  for (let i = values.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [values[i], values[j]] = [values[j], values[i]];
  }

  return values;
}

function shuffleNumbers(count: number): TrailTile[] {
  const values = shuffledValues(count);
  return values.map((value, position) => ({ value, position }));
}

/**
 * Visual scanning and sequencing game: tap scattered numbers in the shown order.
 */
export function NumberTrailGame({ onComplete, onExit }: GameComponentProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [level, setLevel] = useState(1);
  const [targetOrder, setTargetOrder] = useState<number[]>([]);
  const [targetIndex, setTargetIndex] = useState(0);
  const [errors, setErrors] = useState(0);
  const [roundsCompleted, setRoundsCompleted] = useState(0);
  const [correctNumbers, setCorrectNumbers] = useState(0);
  const [tiles, setTiles] = useState<TrailTile[]>([]);
  const [completedNumbers, setCompletedNumbers] = useState<number[]>([]);
  const [tapFeedback, setTapFeedback] = useState<TapFeedback>(null);
  const [lastTapped, setLastTapped] = useState<number | null>(null);
  const [inputLocked, setInputLocked] = useState(false);
  const [shakeToken, setShakeToken] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  const reducedMotion = useReducedMotion();
  const targetNumber = targetOrder[targetIndex] ?? 1;

  const score = calculateNumberTrailScore({
    correctNumbers,
    roundsCompleted,
    errors,
  });

  const completedSet = useMemo(
    () => new Set(completedNumbers),
    [completedNumbers],
  );

  const finishGame = useCallback(
    (stats: {
      level: number;
      currentNumber: number;
      errors: number;
      roundsCompleted: number;
      correctNumbers: number;
    }) => {
      onComplete({
        activityId: "number-trail",
        activityTitle: "Trilha Lógica",
        gameId: "number-trail",
        score: calculateNumberTrailScore(stats),
        summary:
          stats.roundsCompleted > 0
            ? `Você construiu ${stats.roundsCompleted} ${
                stats.roundsCompleted === 1 ? "rodada" : "rodadas"
              } na Trilha Lógica.`
            : "Boa tentativa! Siga a próxima indicação com calma.",
        details: {
          level: stats.level,
          currentNumber: stats.currentNumber,
          errors: stats.errors,
          roundsCompleted: stats.roundsCompleted,
          correctNumbers: stats.correctNumbers,
          maxErrors: NUMBER_TRAIL_MAX_ERRORS,
        },
      });
    },
    [onComplete],
  );

  const startRound = useCallback((nextLevel: number) => {
    const nextNumberCount = numberCountForLevel(nextLevel);
    setLevel(nextLevel);
    setTargetOrder(shuffledValues(nextNumberCount));
    setTargetIndex(0);
    setTiles(shuffleNumbers(nextNumberCount));
    setCompletedNumbers([]);
    setTapFeedback(null);
    setLastTapped(null);
    setMessage(null);
    setInputLocked(false);
    setPhase("playing");
  }, []);

  const beginGame = useCallback(() => {
    setErrors(0);
    setRoundsCompleted(0);
    setCorrectNumbers(0);
    startRound(1);
  }, [startRound]);

  const restartSession = useCallback(() => {
    setErrors(0);
    setRoundsCompleted(0);
    setCorrectNumbers(0);
    startRound(1);
  }, [startRound]);

  const handleMistake = useCallback(
    (tappedNumber: number) => {
      const nextErrors = errors + 1;
      setErrors(nextErrors);
      setLastTapped(tappedNumber);
      setTapFeedback("wrong");
      setMessage("Tente novamente com calma.");
      setShakeToken((t) => t + 1);
      setInputLocked(true);
      playGentleErrorTone();

      window.setTimeout(() => {
        setTapFeedback(null);
        setLastTapped(null);

        if (nextErrors >= NUMBER_TRAIL_MAX_ERRORS) {
          finishGame({
            level,
            currentNumber: targetNumber,
            errors: nextErrors,
            roundsCompleted,
            correctNumbers,
          });
          return;
        }

        setMessage(null);
        setInputLocked(false);
      }, FEEDBACK_RESET_MS);
    },
    [correctNumbers, errors, finishGame, level, roundsCompleted, targetNumber],
  );

  const handleNumberPress = (value: number) => {
    if (phase !== "playing" || inputLocked || completedSet.has(value)) return;

    if (value !== targetNumber) {
      handleMistake(value);
      return;
    }

    const nextCompleted = [...completedNumbers, value];
    const nextCorrectNumbers = correctNumbers + 1;
    setCompletedNumbers(nextCompleted);
    setCorrectNumbers(nextCorrectNumbers);
    setLastTapped(value);
    setTapFeedback("correct");
      setMessage("Caminho correto");
    setInputLocked(true);

    const nextTargetIndex = targetIndex + 1;
    const roundFinished = nextTargetIndex >= targetOrder.length;
    if (roundFinished) {
      const nextRoundsCompleted = roundsCompleted + 1;
      const nextLevel = Math.min(level + 1, LEVEL_NUMBER_COUNTS.length);
      setRoundsCompleted(nextRoundsCompleted);
      setPhase("round-complete");
      setMessage("Rota concluída");
      playSuccessChime();

      window.setTimeout(() => {
        startRound(nextLevel);
      }, ROUND_RESET_MS);
      return;
    }

    window.setTimeout(() => {
      setTargetIndex(nextTargetIndex);
      setTapFeedback(null);
      setLastTapped(null);
      setMessage(null);
      setInputLocked(false);
    }, FEEDBACK_RESET_MS);
  };

  const statusMessage = (() => {
    if (phase === "idle") return "Toque em Iniciar para começar.";
    if (message) return message;
    if (phase === "round-complete") return "Rota concluída";
    return `Siga o próximo número: ${targetNumber}`;
  })();

  const statusVariant = ((): "neutral" | "info" | "success" | "error" => {
    if (tapFeedback === "wrong") return "error";
    if (tapFeedback === "correct" || phase === "round-complete") {
      return "success";
    }
    if (phase === "playing") return "info";
    return "neutral";
  })();

  return (
    <GameLayout
      title="Trilha Lógica"
      description="Construa uma rota tocando os números na ordem indicada."
      world="logic"
      onBack={onExit}
      footer={
        <p className="text-center">
          Procure com calma: não há cronômetro. {NUMBER_TRAIL_MAX_ERRORS} erros
          encerram a atividade.
        </p>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Etapa" value={level} accent="success" />
        <StatCard
          label="Número atual"
          value={phase === "idle" ? "—" : targetNumber}
        />
        <StatCard
          label="Erros"
          value={`${errors}/${NUMBER_TRAIL_MAX_ERRORS}`}
          accent={errors > 0 ? "danger" : "default"}
        />
        <StatCard label="Pontuação" value={score} accent="score" />
      </div>

      <div className="mb-4">
        <StatCard label="Rodadas concluídas" value={roundsCompleted} />
      </div>

      <motion.div
        key={statusMessage}
        initial={reducedMotion ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
      >
        <StatusBanner variant={statusVariant} className="mb-5">
          {statusMessage}
        </StatusBanner>
      </motion.div>

      {phase !== "idle" && (
        <div
          className="surface-panel mb-4 flex items-center justify-center gap-3 border-teal-200 bg-teal-50 px-4 py-5 text-center"
          aria-live="polite"
        >
          <Hash className="h-7 w-7 shrink-0 text-teal-700" aria-hidden />
          <p className="text-2xl font-bold text-slate-900">
            Próximo número{" "}
            <span className="tabular-nums text-teal-700">{targetNumber}</span>
          </p>
        </div>
      )}

      <motion.div
        className={`board-surface logic-board mx-auto w-full min-w-0 rounded-3xl p-3 sm:p-4 ${
          phase === "round-complete"
            ? "border-emerald-500 ring-4 ring-emerald-200"
            : ""
        }`}
        role="group"
        aria-label="Grade da Trilha Lógica"
        initial={false}
        animate={
          reducedMotion || shakeToken === 0 ? undefined : gentleShakeAnimate
        }
        key={
          shakeToken > 0 ? `number-trail-shake-${shakeToken}` : "number-trail"
        }
      >
        {phase === "idle" ? (
          <div className="flex min-h-[16rem] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white/70 px-5 py-8 text-center">
            <Hash className="mb-3 h-12 w-12 text-teal-700" aria-hidden />
            <p className="text-xl font-bold text-slate-900">
              Pronto para seguir a rota?
            </p>
            <p className="text-muted mt-2">
              A ordem muda a cada rodada. Leia o número indicado e procure com calma.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {tiles.map((tile) => {
              const done = completedSet.has(tile.value);
              const isWrong =
                tapFeedback === "wrong" && lastTapped === tile.value;
              const isCorrect =
                tapFeedback === "correct" && lastTapped === tile.value;

              return (
                <motion.button
                  key={`${tile.value}-${tile.position}`}
                  type="button"
                  disabled={phase !== "playing" || inputLocked || done}
                  aria-label={`Tocar número ${tile.value}`}
                  aria-pressed={done}
                  onClick={() => handleNumberPress(tile.value)}
                  animate={
                    reducedMotion
                      ? undefined
                      : isWrong
                        ? gentleShakeAnimate
                        : isCorrect
                          ? positivePulseAnimate
                          : undefined
                  }
                  whileHover={
                    phase === "playing" &&
                    !inputLocked &&
                    !done &&
                    !reducedMotion
                      ? { y: -3 }
                      : undefined
                  }
                  whileTap={
                    phase === "playing" &&
                    !inputLocked &&
                    !done &&
                    !reducedMotion
                      ? { scale: 0.96, y: 2 }
                      : undefined
                  }
                  className={`relative flex aspect-square min-h-20 w-full items-center justify-center rounded-2xl border-4 text-3xl font-bold tabular-nums transition-[background,border-color,box-shadow,transform,opacity] duration-200 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)] sm:min-h-24 sm:text-4xl ${
                    done
                      ? "border-emerald-600 bg-emerald-100 text-emerald-900 shadow-[0_4px_0_0_#059669]"
                      : "tactile-tile border-sky-700 bg-[#fffefa] text-slate-950 shadow-[0_7px_0_0_#0369a1,0_10px_22px_rgb(14_165_233/0.16)]"
                  } ${
                    isWrong
                      ? "!border-red-700 !bg-red-50 !text-red-900 !shadow-[0_3px_0_0_#dc2626] ring-4 ring-red-300"
                      : ""
                  } ${
                    isCorrect
                      ? "!border-emerald-700 !bg-emerald-100 ring-4 ring-emerald-400"
                      : ""
                  } disabled:cursor-default disabled:opacity-85`}
                >
                  {done && (
                    <Check
                      className="absolute right-2 top-2 h-5 w-5 text-emerald-700"
                      strokeWidth={3}
                      aria-hidden
                    />
                  )}
                  {tile.value}
                </motion.button>
              );
            })}
          </div>
        )}
      </motion.div>

      {phase === "idle" ? (
        <button
          type="button"
          onClick={beginGame}
          aria-label="Iniciar atividade Trilha Lógica"
          className="btn-primary mt-6 flex w-full items-center justify-center gap-2"
        >
          <Play className="h-6 w-6 fill-current" aria-hidden />
          Iniciar trilha
        </button>
      ) : (
        <GameActions
          onRestart={restartSession}
          onEndSession={() =>
            finishGame({
              level,
              currentNumber: targetNumber,
              errors,
              roundsCompleted,
              correctNumbers,
            })
          }
          disabled={inputLocked && phase === "playing"}
        />
      )}
    </GameLayout>
  );
}
