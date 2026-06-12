"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, Flag, Hash, Play } from "lucide-react";
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

  /** The lit trail: a line drawn through the stones already tapped, in order. */
  const boardRef = useRef<HTMLDivElement>(null);
  const stoneRefs = useRef(new Map<number, HTMLButtonElement>());
  const [trailPoints, setTrailPoints] = useState<{ x: number; y: number }[]>(
    [],
  );

  useEffect(() => {
    const recomputeTrail = () => {
      const board = boardRef.current;
      if (!board || completedNumbers.length === 0) {
        setTrailPoints([]);
        return;
      }
      const boardRect = board.getBoundingClientRect();
      const points = completedNumbers
        .map((value) => stoneRefs.current.get(value))
        .filter((el): el is HTMLButtonElement => Boolean(el))
        .map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            x: rect.left - boardRect.left + rect.width / 2,
            y: rect.top - boardRect.top + rect.height / 2,
          };
        });
      setTrailPoints(points);
    };

    recomputeTrail();
    window.addEventListener("resize", recomputeTrail);
    return () => window.removeEventListener("resize", recomputeTrail);
  }, [completedNumbers]);

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
            ? `Você iluminou ${stats.roundsCompleted} ${
                stats.roundsCompleted === 1 ? "trilha completa" : "trilhas completas"
              } na Trilha Lógica.`
            : "Boa tentativa! Procure a próxima pedra com calma.",
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
    setMessage("Pedra acesa!");
    setInputLocked(true);

    const nextTargetIndex = targetIndex + 1;
    const roundFinished = nextTargetIndex >= targetOrder.length;
    if (roundFinished) {
      const nextRoundsCompleted = roundsCompleted + 1;
      const nextLevel = Math.min(level + 1, LEVEL_NUMBER_COUNTS.length);
      setRoundsCompleted(nextRoundsCompleted);
      setPhase("round-complete");
      setMessage("Trilha iluminada!");
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
    if (phase === "round-complete") return "Trilha iluminada!";
    return `Procure a pedra ${targetNumber}`;
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
      description="Acenda as pedras numeradas, em ordem, e ilumine a trilha."
      world="logic"
      wide
      onBack={onExit}
      footer={
        <p className="text-center">
          Procure com calma: não há cronômetro. {NUMBER_TRAIL_MAX_ERRORS} erros
          encerram a atividade.
        </p>
      }
    >
      <div className="miniworld-grid logic-world-grid">
        <aside className="miniworld-side" aria-label="Orientação da trilha">
          <section className="miniworld-guide-card logic-guide-card">
            <p className="miniworld-label">Objetivo</p>
            <h3>Ilumine a trilha</h3>
            <ol className="miniworld-steps">
              <li>Veja o número da próxima pedra.</li>
              <li>Encontre a pedra na trilha.</li>
              <li>Acenda o caminho no seu ritmo.</li>
            </ol>
          </section>
          <section className="logic-target-card" aria-live="polite">
            <p>Procure a pedra</p>
            <strong>{phase === "idle" ? "—" : targetNumber}</strong>
            <span>A ordem muda a cada trilha.</span>
          </section>
        </aside>

        <section className="miniworld-play-area" aria-label="Tabuleiro da trilha">
          <motion.div
            key={statusMessage}
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <StatusBanner
              variant={statusVariant}
              label="Sinal da trilha"
              className="mb-4"
            >
              {statusMessage}
            </StatusBanner>
          </motion.div>

          {phase === "idle" && (
            <section className="miniworld-action-card miniworld-quick-start">
              <p>Comece e procure somente a pedra mostrada a cada vez.</p>
              <button
                type="button"
                onClick={beginGame}
                aria-label="Iniciar atividade Trilha Lógica"
                className="btn-primary flex w-full items-center justify-center gap-2"
              >
                <Play className="h-6 w-6 fill-current" aria-hidden />
                Iniciar trilha
              </button>
            </section>
          )}

          <motion.div
            className={`board-surface logic-board logic-path-board mx-auto w-full min-w-0 rounded-3xl p-3 sm:p-5 ${
              phase === "round-complete" ? "is-trail-complete" : ""
            }`}
            role="group"
            aria-label="Trilha de pedras numeradas"
            initial={false}
            animate={
              reducedMotion || shakeToken === 0 ? undefined : gentleShakeAnimate
            }
            key={
              shakeToken > 0 ? `number-trail-shake-${shakeToken}` : "number-trail"
            }
          >
            {phase === "idle" ? (
              <div className="logic-empty-board">
                <Hash className="mb-3 h-12 w-12 text-indigo-700" aria-hidden />
                <p className="text-xl font-bold text-slate-900">Pronto para iluminar a trilha?</p>
                <p className="text-muted mt-2">
                  A ordem muda a cada rodada. Veja o número indicado e procure a pedra com calma.
                </p>
              </div>
            ) : (
              <div ref={boardRef} className="logic-tile-grid">
                {trailPoints.length > 1 && (
                  <svg className="logic-trail-svg" aria-hidden="true">
                    <polyline
                      points={trailPoints
                        .map((point) => `${point.x},${point.y}`)
                        .join(" ")}
                    />
                  </svg>
                )}
                {tiles.map((tile) => {
                  const done = completedSet.has(tile.value);
                  const isWrong = tapFeedback === "wrong" && lastTapped === tile.value;
                  const isCorrect = tapFeedback === "correct" && lastTapped === tile.value;
                  const isTrailEnd =
                    phase === "round-complete" &&
                    completedNumbers[completedNumbers.length - 1] === tile.value;

                  return (
                    <motion.button
                      key={`${tile.value}-${tile.position}`}
                      ref={(el) => {
                        if (el) {
                          stoneRefs.current.set(tile.value, el);
                        } else {
                          stoneRefs.current.delete(tile.value);
                        }
                      }}
                      type="button"
                      disabled={phase !== "playing" || inputLocked || done}
                      aria-label={`Pedra ${tile.value}`}
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
                      whileHover={phase === "playing" && !inputLocked && !done && !reducedMotion ? { y: -3 } : undefined}
                      whileTap={phase === "playing" && !inputLocked && !done && !reducedMotion ? { scale: 0.96, y: 2 } : undefined}
                      className={`logic-tile relative flex aspect-square min-h-20 w-full items-center justify-center rounded-full border-4 text-3xl font-bold tabular-nums transition-[background,border-color,box-shadow,transform,opacity] duration-200 focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)] sm:min-h-24 sm:text-4xl ${
                        done
                          ? "is-complete border-amber-500 bg-gradient-to-b from-amber-100 to-amber-200 text-amber-900"
                          : "tactile-tile border-indigo-600 bg-[#fffefa] text-slate-950"
                      } ${isTrailEnd ? "is-trail-end" : ""} ${
                        isWrong ? "is-wrong !border-red-700 !bg-red-50 !text-red-900" : ""
                      } ${
                        isCorrect ? "is-correct !border-amber-600 !bg-amber-100" : ""
                      } disabled:cursor-default disabled:opacity-95`}
                    >
                      {done && !isTrailEnd && (
                        <Check
                          className="absolute right-1.5 top-1.5 h-5 w-5 text-amber-700"
                          strokeWidth={3}
                          aria-hidden
                        />
                      )}
                      {isTrailEnd && (
                        <Flag
                          className="absolute -top-2 left-1/2 h-6 w-6 -translate-x-1/2 text-amber-700"
                          strokeWidth={2.6}
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
        </section>

        <aside className="miniworld-side" aria-label="Ações e progresso">
          <section
            className={`miniworld-action-card ${
              phase === "idle" ? "miniworld-idle-side-action" : ""
            }`}
          >
            <p>Não há relógio. Procure a pedra indicada com calma.</p>
            {phase === "idle" ? (
              <button
                type="button"
                onClick={beginGame}
                aria-label="Iniciar atividade Trilha Lógica"
                className="btn-primary flex w-full items-center justify-center gap-2"
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
          </section>
          <div className="miniworld-stats-grid">
            <StatCard label="Etapa" value={level} accent="success" />
            <StatCard label="Próxima pedra" value={phase === "idle" ? "—" : targetNumber} />
            <StatCard label="Erros" value={`${errors}/${NUMBER_TRAIL_MAX_ERRORS}`} accent={errors > 0 ? "danger" : "default"} />
            <StatCard label="Pontuação" value={score} accent="score" />
          </div>
          <section className="miniworld-focus-card logic-focus-card">
            <p>Trilhas iluminadas</p>
            <strong>{roundsCompleted}</strong>
            <span>Cada trilha completa acende a próxima.</span>
          </section>
        </aside>
      </div>
    </GameLayout>
  );
}
