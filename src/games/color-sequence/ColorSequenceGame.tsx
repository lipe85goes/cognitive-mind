"use client";

import { useCallback, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Play } from "lucide-react";
import { SoundToggle } from "@/components/SoundToggle";
import {
  gentleShakeAnimate,
  positivePulseAnimate,
} from "@/lib/feedback-motion";
import {
  playColorTone,
  playGentleErrorTone,
  playSuccessChime,
} from "@/lib/game-sounds";
import { GameActions } from "@/components/GameActions";
import { GameLayout } from "@/components/GameLayout";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBanner } from "@/components/ui/StatusBanner";
import {
  calculateColorSequenceScore,
  COLOR_SEQUENCE_MAX_ERRORS,
} from "@/engine/scoring";
import type { GameComponentProps } from "@/types/game";

/** Four palette slots — indices are stored in the sequence. */
const COLORS = [
  {
    id: 0,
    name: "Vermelho",
    base: "bg-gradient-to-br from-rose-400 to-rose-600 border-rose-800 shadow-[0_6px_0_0_#9f1239,inset_0_4px_12px_rgba(255,255,255,0.35)]",
    active:
      "z-10 scale-[1.14] border-rose-900 bg-gradient-to-br from-rose-200 to-rose-400 brightness-125 shadow-[0_0_0_10px_#fff,0_0_56px_rgba(244,63,94,1),inset_0_6px_16px_rgba(255,255,255,0.5)] ring-[10px] ring-rose-500",
    glow: "rgba(244,63,94,0.85)",
  },
  {
    id: 1,
    name: "Azul",
    base: "bg-gradient-to-br from-sky-400 to-sky-600 border-sky-800 shadow-[0_6px_0_0_#0369a1,inset_0_4px_12px_rgba(255,255,255,0.35)]",
    active:
      "z-10 scale-[1.14] border-sky-900 bg-gradient-to-br from-sky-200 to-sky-400 brightness-125 shadow-[0_0_0_10px_#fff,0_0_56px_rgba(14,165,233,1),inset_0_6px_16px_rgba(255,255,255,0.5)] ring-[10px] ring-sky-500",
    glow: "rgba(14,165,233,0.85)",
  },
  {
    id: 2,
    name: "Verde",
    base: "bg-gradient-to-br from-emerald-400 to-emerald-600 border-emerald-800 shadow-[0_6px_0_0_#047857,inset_0_4px_12px_rgba(255,255,255,0.35)]",
    active:
      "z-10 scale-[1.14] border-emerald-900 bg-gradient-to-br from-emerald-200 to-emerald-400 brightness-125 shadow-[0_0_0_10px_#fff,0_0_56px_rgba(16,185,129,1),inset_0_6px_16px_rgba(255,255,255,0.5)] ring-[10px] ring-emerald-500",
    glow: "rgba(16,185,129,0.85)",
  },
  {
    id: 3,
    name: "Amarelo",
    base: "bg-gradient-to-br from-amber-300 to-amber-500 border-amber-700 shadow-[0_6px_0_0_#b45309,inset_0_4px_12px_rgba(255,255,255,0.4)]",
    active:
      "z-10 scale-[1.14] border-amber-800 bg-gradient-to-br from-amber-100 to-amber-300 brightness-125 shadow-[0_0_0_10px_#fff,0_0_56px_rgba(245,158,11,1),inset_0_6px_16px_rgba(255,255,255,0.5)] ring-[10px] ring-amber-500",
    glow: "rgba(245,158,11,0.9)",
  },
] as const;

type Phase = "idle" | "showing" | "input" | "round-complete";

const SHOW_MS = 850;
const GAP_MS = 400;
const TAP_FLASH_MS = 280;

function randomColorId(): number {
  return Math.floor(Math.random() * 4);
}

type TapFeedback = "correct" | "wrong" | null;

/**
 * Memory-style color sequence game.
 * Shows a growing pattern; the player repeats it tap by tap.
 */
export function ColorSequenceGame({ onComplete, onExit }: GameComponentProps) {
  const [sequence, setSequence] = useState<number[]>([]);
  const [level, setLevel] = useState(1);
  const [errors, setErrors] = useState(0);
  const [phase, setPhase] = useState<Phase>("idle");
  const [activeColor, setActiveColor] = useState<number | null>(null);
  const [showStep, setShowStep] = useState(0);
  const [inputIndex, setInputIndex] = useState(0);
  const [roundMessage, setRoundMessage] = useState<TapFeedback>(null);
  const [lastTapped, setLastTapped] = useState<number | null>(null);
  const [tapFeedback, setTapFeedback] = useState<TapFeedback>(null);
  const [inputLocked, setInputLocked] = useState(true);
  const [shakeToken, setShakeToken] = useState(0);

  const playTokenRef = useRef(0);
  const reducedMotion = useReducedMotion();

  const score = calculateColorSequenceScore({
    level,
    sequenceLength: sequence.length,
    errors,
  });

  const finishGame = useCallback(
    (stats: { level: number; sequenceLength: number; errors: number }) => {
      onComplete({
        activityId: "color-sequence",
        activityTitle: "Circuito de Memória",
        gameId: "color-sequence",
        score: calculateColorSequenceScore(stats),
        summary:
          stats.level > 1
            ? `Circuito ativado! Você chegou à etapa ${stats.level}.`
            : "Boa tentativa! Observe o circuito com calma e tente novamente.",
        details: {
          level: stats.level,
          sequenceLength: stats.sequenceLength,
          errors: stats.errors,
          maxErrors: COLOR_SEQUENCE_MAX_ERRORS,
        },
      });
    },
    [onComplete],
  );

  /** Play the current sequence with highlight animation. */
  const playSequence = useCallback(async (seq: number[]) => {
    const token = ++playTokenRef.current;
    setInputLocked(true);
    setPhase("showing");
    setRoundMessage(null);
    setTapFeedback(null);
    setLastTapped(null);
    setShowStep(0);

    for (let i = 0; i < seq.length; i++) {
      if (playTokenRef.current !== token) return;

      setShowStep(i + 1);
      setActiveColor(seq[i]);
      playColorTone(seq[i]);
      await delay(SHOW_MS);
      if (playTokenRef.current !== token) return;

      setActiveColor(null);
      await delay(GAP_MS);
      if (playTokenRef.current !== token) return;
    }

    setShowStep(0);
    setPhase("input");
    setInputIndex(0);
    setInputLocked(false);
  }, []);

  const startRound = useCallback(
    (nextSequence: number[]) => {
      setSequence(nextSequence);
      void playSequence(nextSequence);
    },
    [playSequence],
  );

  const restartSession = useCallback(() => {
    playTokenRef.current += 1;
    setLevel(1);
    setErrors(0);
    setInputIndex(0);
    setRoundMessage(null);
    setTapFeedback(null);
    setLastTapped(null);
    setActiveColor(null);
    setShowStep(0);
    const first = [randomColorId()];
    startRound(first);
  }, [startRound]);

  const beginGame = useCallback(() => {
    const first = [randomColorId()];
    setLevel(1);
    setErrors(0);
    setInputIndex(0);
    setRoundMessage(null);
    setTapFeedback(null);
    setLastTapped(null);
    startRound(first);
  }, [startRound]);

  const handleMistake = useCallback(
    (currentErrors: number, currentSequence: number[]) => {
      setShakeToken((t) => t + 1);
      playGentleErrorTone();
      setRoundMessage("wrong");
      setTapFeedback("wrong");
      const nextErrors = currentErrors + 1;
      setErrors(nextErrors);

      window.setTimeout(() => {
        setRoundMessage(null);
        setTapFeedback(null);
        setLastTapped(null);

        if (nextErrors >= COLOR_SEQUENCE_MAX_ERRORS) {
          finishGame({
            level,
            sequenceLength: currentSequence.length,
            errors: nextErrors,
          });
          return;
        }

        setInputIndex(0);
        void playSequence(currentSequence);
      }, 750);
    },
    [finishGame, level, playSequence],
  );

  const handleColorPress = (colorId: number) => {
    if (inputLocked || phase !== "input") return;

    setInputLocked(true);
    setLastTapped(colorId);
    setActiveColor(colorId);

    const expected = sequence[inputIndex];
    if (colorId !== expected) {
      window.setTimeout(() => setActiveColor(null), TAP_FLASH_MS);
      handleMistake(errors, sequence);
      return;
    }

    setTapFeedback("correct");
    playColorTone(colorId);
    window.setTimeout(() => {
      setActiveColor(null);
      setTapFeedback(null);
      setLastTapped(null);
    }, TAP_FLASH_MS);

    const nextIndex = inputIndex + 1;
    if (nextIndex < sequence.length) {
      setInputIndex(nextIndex);
      setInputLocked(false);
      return;
    }

    setPhase("round-complete");
    setRoundMessage("correct");
    playSuccessChime();
    const nextLevel = level + 1;
    const extended = [...sequence, randomColorId()];

    window.setTimeout(() => {
      setRoundMessage(null);
      setLevel(nextLevel);
      setInputIndex(0);
      startRound(extended);
    }, 700);
  };

  const statusMessage = (() => {
    if (phase === "idle") return "Toque em Iniciar para ativar o circuito.";
    if (phase === "showing") {
      return showStep > 0
        ? `Observe o circuito (${showStep} de ${sequence.length})`
        : "Observe o circuito";
    }
    if (tapFeedback === "wrong" || roundMessage === "wrong") {
      return "Tente novamente com calma.";
    }
    if (phase === "round-complete" || roundMessage === "correct") {
      return "Circuito ativado!";
    }
    if (tapFeedback === "correct") {
      return inputIndex % 2 === 0 ? "Comando correto!" : "Boa memória!";
    }
    if (phase === "input") {
      return sequence.length > 0
        ? `Agora repita — ${sequence.length} sinais`
        : "Agora é sua vez";
    }
    return "";
  })();

  const statusVariant = (():
    | "neutral"
    | "info"
    | "success"
    | "error" => {
    if (phase === "showing") return "info";
    if (roundMessage === "wrong" || tapFeedback === "wrong") return "error";
    if (
      roundMessage === "correct" ||
      tapFeedback === "correct" ||
      phase === "round-complete"
    ) {
      return "success";
    }
    if (phase === "input") return "info";
    return "neutral";
  })();

  const canTap = phase === "input" && !inputLocked;

  return (
    <GameLayout
      title="Circuito de Memória"
      description="Observe os sinais coloridos e reative o circuito na mesma ordem."
      world="memory"
      wide
      onBack={onExit}
      footer={
        <p className="text-center">
          As cores ficam bloqueadas enquanto o circuito aparece.{" "}
          {COLOR_SEQUENCE_MAX_ERRORS} erros encerram a atividade.
        </p>
      }
    >
      <div className="miniworld-grid memory-world-grid">
        <aside className="miniworld-side" aria-label="Orientação do circuito">
          <section className="miniworld-guide-card">
            <p className="miniworld-label">Como ativar</p>
            <h3>Acenda a memória</h3>
            <ol className="miniworld-steps">
              <li>Observe os sinais luminosos.</li>
              <li>Repita a sequência de cores.</li>
              <li>Avance com calma a cada circuito.</li>
            </ol>
          </section>
          <section className="miniworld-focus-card memory-focus-card">
            <p>Sinais do circuito</p>
            <strong>{sequence.length > 0 ? sequence.length : "—"}</strong>
            <span>Uma luz por vez, no seu ritmo.</span>
          </section>
        </aside>

        <section className="miniworld-play-area" aria-label="Tabuleiro do circuito">
          <StatusBanner
            variant={statusVariant}
            label="Sinal do circuito"
            className="mb-4"
          >
            {statusMessage}
          </StatusBanner>

          {phase === "idle" && (
            <section className="miniworld-action-card miniworld-quick-start">
              <SoundToggle />
              <p>Observe as luzes primeiro. Depois repita com calma.</p>
              <button
                type="button"
                onClick={beginGame}
                aria-label="Iniciar atividade Circuito de Memória"
                className="btn-primary flex w-full items-center justify-center gap-2"
              >
                <Play className="h-6 w-6 fill-current" aria-hidden />
                Ativar circuito
              </button>
            </section>
          )}

          <motion.div
            className={`board-surface memory-board memory-console relative mx-auto w-full max-w-md min-w-0 overflow-hidden rounded-3xl border-rose-300 p-4 sm:p-6 ${
              canTap ? "" : "pointer-events-none"
            }`}
            role="group"
            aria-label="Circuito de memória com quatro cores"
            aria-busy={phase === "showing"}
            initial={false}
            animate={
              reducedMotion || shakeToken === 0 ? undefined : gentleShakeAnimate
            }
            key={shakeToken > 0 ? `shake-${shakeToken}` : "panel"}
          >
            <div className="relative z-[1] grid grid-cols-2 gap-3 sm:gap-5">
              {COLORS.map((color) => {
                const isActive = activeColor === color.id;
                const isShowing = phase === "showing";
                const isHighlighted = isActive && (isShowing || phase === "input");
                const isWrongTap =
                  tapFeedback === "wrong" && lastTapped === color.id;
                const isCorrectTap =
                  tapFeedback === "correct" && lastTapped === color.id;
                const dimOthers =
                  isShowing && activeColor !== null && !isActive;

                const colorLabel = isShowing
                  ? isHighlighted
                    ? `Cor ${color.name} acesa`
                    : `Cor ${color.name}`
                  : `Cor ${color.name}`;

                return (
                  <motion.button
                    key={color.id}
                    type="button"
                    aria-label={colorLabel}
                    aria-pressed={isHighlighted}
                    disabled={!canTap}
                    tabIndex={canTap ? 0 : -1}
                    onClick={() => handleColorPress(color.id)}
                    animate={
                      reducedMotion
                        ? undefined
                        : isWrongTap
                          ? gentleShakeAnimate
                          : isCorrectTap
                            ? positivePulseAnimate
                            : isHighlighted && isShowing
                              ? { scale: [1, 1.12, 1.08] }
                              : undefined
                    }
                    transition={
                      isHighlighted && isShowing
                        ? { duration: 0.35, ease: "easeOut" }
                        : undefined
                    }
                    whileTap={
                      canTap && !reducedMotion ? { scale: 0.96 } : undefined
                    }
                    className={`memory-pad relative aspect-square min-h-[min(44vw,168px)] max-h-[210px] w-full rounded-full border-4 transition-[transform,box-shadow,opacity] duration-200 sm:min-h-[156px] ${
                      isHighlighted ? color.active : color.base
                    } ${
                      isWrongTap
                        ? "!border-red-700 !from-red-100 !to-red-200 !ring-[8px] !ring-red-500 ring-offset-4 ring-offset-white"
                        : isCorrectTap
                          ? "!border-emerald-700 !ring-[8px] !ring-emerald-400 ring-offset-4 ring-offset-white"
                          : ""
                    } ${dimOthers ? "opacity-25 saturate-[0.65] scale-[0.92]" : ""} ${
                      !canTap && !isShowing ? "opacity-50" : ""
                    }`}
                  >
                    <span
                      className="pointer-events-none absolute inset-[14%] rounded-full bg-white/30"
                      aria-hidden
                    />
                    {isHighlighted && isShowing && !reducedMotion && (
                      <span
                        className="pointer-events-none absolute inset-0 rounded-full opacity-60"
                        style={{
                          boxShadow: `0 0 32px 8px ${color.glow}`,
                        }}
                        aria-hidden
                      />
                    )}
                    <span className="sr-only">{color.name}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        </section>

        <aside className="miniworld-side" aria-label="Ações e progresso">
          <section
            className={`miniworld-action-card ${
              phase === "idle" ? "miniworld-idle-side-action" : ""
            }`}
          >
            <SoundToggle />
            <p>Escute os tons e observe as luzes antes de repetir.</p>
            {phase === "idle" ? (
              <button
                type="button"
                onClick={beginGame}
                aria-label="Iniciar atividade Circuito de Memória"
                className="btn-primary flex w-full items-center justify-center gap-2"
              >
                <Play className="h-6 w-6 fill-current" aria-hidden />
                Ativar circuito
              </button>
            ) : (
              <GameActions
                onRestart={restartSession}
                onEndSession={() =>
                  finishGame({ level, sequenceLength: sequence.length, errors })
                }
                disabled={phase === "showing"}
              />
            )}
          </section>
          <div className="miniworld-stats-grid">
            <StatCard label="Etapa" value={level} accent="success" />
            <StatCard label="Circuito" value={sequence.length > 0 ? `${sequence.length} sinais` : "—"} />
            <StatCard
              label="Erros"
              value={`${errors}/${COLOR_SEQUENCE_MAX_ERRORS}`}
              accent={errors > 0 ? "danger" : "default"}
            />
            <StatCard label="Pontuação" value={score} accent="score" />
          </div>
        </aside>
      </div>
    </GameLayout>
  );
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}
