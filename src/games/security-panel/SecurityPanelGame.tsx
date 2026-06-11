"use client";

import { useCallback, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Check, LayoutGrid, Play } from "lucide-react";
import {
  gentleShakeAnimate,
  positivePulseAnimate,
} from "@/lib/feedback-motion";
import {
  playGentleErrorTone,
  playSuccessChime,
} from "@/lib/game-sounds";
import { GameActions } from "@/components/GameActions";
import { GameLayout } from "@/components/GameLayout";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBanner } from "@/components/ui/StatusBanner";
import {
  calculateSecurityPanelScore,
  SECURITY_PANEL_MAX_ERRORS,
} from "@/engine/scoring";
import type { GameComponentProps } from "@/types/game";

type PanelTargetId =
  | "button-blue"
  | "button-green"
  | "wire-yellow"
  | "wire-red"
  | "confirm";

type Phase = "idle" | "playing" | "round-complete";

type TapFeedback = "correct" | "wrong" | null;

const TAP_RESET_MS = 700;

const PANEL_TARGETS: Record<
  PanelTargetId,
  {
    label: string;
    instructionPart: string;
    kind: "button" | "wire" | "confirm";
    surface: string;
    accent: string;
  }
> = {
  "button-blue": {
    label: "Botão azul",
    instructionPart: "no botão azul",
    kind: "button",
    surface:
      "bg-sky-100 border-sky-600 text-sky-950 shadow-[0_5px_0_0_#0284c7]",
    accent: "bg-sky-500",
  },
  "button-green": {
    label: "Botão verde",
    instructionPart: "no botão verde",
    kind: "button",
    surface:
      "bg-emerald-100 border-emerald-600 text-emerald-950 shadow-[0_5px_0_0_#059669]",
    accent: "bg-emerald-500",
  },
  "wire-yellow": {
    label: "Fio amarelo",
    instructionPart: "no fio amarelo",
    kind: "wire",
    surface:
      "bg-amber-50 border-amber-500 text-amber-950 shadow-[0_5px_0_0_#d97706]",
    accent: "bg-amber-400",
  },
  "wire-red": {
    label: "Fio vermelho",
    instructionPart: "no fio vermelho",
    kind: "wire",
    surface:
      "bg-rose-50 border-rose-500 text-rose-950 shadow-[0_5px_0_0_#e11d48]",
    accent: "bg-rose-500",
  },
  confirm: {
    label: "Confirmar",
    instructionPart: "em Confirmar",
    kind: "confirm",
    surface:
      "bg-teal-700 border-teal-900 text-white shadow-[0_5px_0_0_#115e59]",
    accent: "bg-teal-600",
  },
};

const SEQUENCE_POOL: PanelTargetId[] = [
  "button-blue",
  "button-green",
  "wire-yellow",
  "wire-red",
];

const FORBIDDEN_RULES: {
  minLevel: number;
  forbiddenId: PanelTargetId;
  ruleText: string;
}[] = [
  {
    minLevel: 3,
    forbiddenId: "wire-red",
    ruleText: "Não toque no vermelho.",
  },
  {
    minLevel: 5,
    forbiddenId: "button-green",
    ruleText: "Não toque no verde.",
  },
];

function stepCountForLevel(level: number): number {
  return Math.min(2 + level - 1, 4);
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function buildInstruction(sequence: PanelTargetId[]): string {
  if (sequence.length === 0) return "";

  if (sequence.length === 1) {
    const only = sequence[0];
    if (only === "confirm") return "Toque em Confirmar.";
    return `Toque ${PANEL_TARGETS[only].instructionPart}.`;
  }

  const last = sequence[sequence.length - 1];
  const middle = sequence.slice(0, -1);
  let text = `Toque ${PANEL_TARGETS[middle[0]].instructionPart}`;

  for (let i = 1; i < middle.length; i++) {
    text += `, depois ${PANEL_TARGETS[middle[i]].instructionPart}`;
  }

  if (last === "confirm") {
    text += ", e finalize em Confirmar.";
  } else {
    text += `, e por último ${PANEL_TARGETS[last].instructionPart}.`;
  }

  return text;
}

function getActiveForbiddenRule(level: number) {
  const applicable = FORBIDDEN_RULES.filter((r) => level >= r.minLevel);
  return applicable.length > 0 ? applicable[applicable.length - 1] : null;
}

function generateSequence(level: number): PanelTargetId[] {
  const count = stepCountForLevel(level);
  const forbidden = getActiveForbiddenRule(level);
  const pool = forbidden
    ? SEQUENCE_POOL.filter((id) => id !== forbidden.forbiddenId)
    : [...SEQUENCE_POOL];

  const steps: PanelTargetId[] = [];
  for (let i = 0; i < count - 1; i++) {
    steps.push(pickRandom(pool));
  }
  steps.push("confirm");
  return steps;
}

/**
 * Calm instruction-following activity: tap panel items in the given order.
 */
export function SecurityPanelGame({ onComplete, onExit }: GameComponentProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [level, setLevel] = useState(1);
  const [errors, setErrors] = useState(0);
  const [panelsCompleted, setPanelsCompleted] = useState(0);
  const [sequence, setSequence] = useState<PanelTargetId[]>([]);
  const [inputIndex, setInputIndex] = useState(0);
  const [tapFeedback, setTapFeedback] = useState<TapFeedback>(null);
  const [lastTapped, setLastTapped] = useState<PanelTargetId | null>(null);
  const [inputLocked, setInputLocked] = useState(false);
  const [roundMessage, setRoundMessage] = useState<string | null>(null);
  const [shakeToken, setShakeToken] = useState(0);

  const reducedMotion = useReducedMotion();

  const forbiddenRule = useMemo(
    () => getActiveForbiddenRule(level),
    [level],
  );

  const instructionText = useMemo(() => buildInstruction(sequence), [sequence]);

  const score = calculateSecurityPanelScore({
    level,
    panelsCompleted,
    errors,
  });

  const currentStepDisplay =
    sequence.length > 0 ? Math.min(inputIndex + 1, sequence.length) : 0;

  const finishGame = useCallback(
    (stats: {
      level: number;
      panelsCompleted: number;
      errors: number;
      currentStep: number;
    }) => {
      onComplete({
        activityId: "security-panel",
        activityTitle: "Central de Comandos",
        gameId: "security-panel",
        score: calculateSecurityPanelScore(stats),
        summary:
          stats.panelsCompleted > 0
            ? `Central ativada! Você concluiu ${stats.panelsCompleted} ${stats.panelsCompleted === 1 ? "sequência" : "sequências"}.`
            : "Boa tentativa! Releia o comando com calma e tente novamente.",
        details: {
          level: stats.level,
          currentStep: stats.currentStep,
          errors: stats.errors,
          panelsCompleted: stats.panelsCompleted,
          maxErrors: SECURITY_PANEL_MAX_ERRORS,
        },
      });
    },
    [onComplete],
  );

  const startPanel = useCallback((panelLevel: number) => {
    const nextSequence = generateSequence(panelLevel);
    setSequence(nextSequence);
    setInputIndex(0);
    setTapFeedback(null);
    setLastTapped(null);
    setRoundMessage(null);
    setInputLocked(false);
    setPhase("playing");
  }, []);

  const beginGame = useCallback(() => {
    setLevel(1);
    setErrors(0);
    setPanelsCompleted(0);
    startPanel(1);
  }, [startPanel]);

  const restartSession = useCallback(() => {
    setLevel(1);
    setErrors(0);
    setPanelsCompleted(0);
    startPanel(1);
  }, [startPanel]);

  const handleMistake = useCallback(
    (
      currentErrors: number,
      stats: { level: number; panelsCompleted: number; currentStep: number },
    ) => {
      setShakeToken((t) => t + 1);
      playGentleErrorTone();
      setTapFeedback("wrong");
      setRoundMessage("Tente novamente com calma.");
      const nextErrors = currentErrors + 1;
      setErrors(nextErrors);

      window.setTimeout(() => {
        setTapFeedback(null);
        setLastTapped(null);
        setRoundMessage(null);

        if (nextErrors >= SECURITY_PANEL_MAX_ERRORS) {
          finishGame({
            level: stats.level,
            panelsCompleted: stats.panelsCompleted,
            errors: nextErrors,
            currentStep: stats.currentStep,
          });
          return;
        }

        setInputIndex(0);
        setInputLocked(false);
      }, TAP_RESET_MS);
    },
    [finishGame],
  );

  const handleTargetPress = (targetId: PanelTargetId) => {
    if (phase !== "playing" || inputLocked) return;

    setInputLocked(true);
    setLastTapped(targetId);

    if (forbiddenRule && targetId === forbiddenRule.forbiddenId) {
      handleMistake(errors, {
        level,
        panelsCompleted,
        currentStep: currentStepDisplay,
      });
      return;
    }

    const expected = sequence[inputIndex];
    if (targetId !== expected) {
      handleMistake(errors, {
        level,
        panelsCompleted,
        currentStep: currentStepDisplay,
      });
      return;
    }

    setTapFeedback("correct");
    setRoundMessage("Muito bem, comando correto");

    window.setTimeout(() => {
      setTapFeedback(null);
      setLastTapped(null);
      setRoundMessage(null);

      const nextIndex = inputIndex + 1;
      if (nextIndex < sequence.length) {
        setInputIndex(nextIndex);
        setInputLocked(false);
        return;
      }

      const nextPanels = panelsCompleted + 1;
      const nextLevel = level + 1;
      setPanelsCompleted(nextPanels);
      setPhase("round-complete");
      setRoundMessage("Central ativada");
      playSuccessChime();

      window.setTimeout(() => {
        setRoundMessage(null);
        setLevel(nextLevel);
        startPanel(nextLevel);
      }, 900);
    }, TAP_RESET_MS);
  };

  const statusMessage = (() => {
    if (phase === "idle") return "Toque em Iniciar para ver a primeira instrução.";
    if (roundMessage) return roundMessage;
    if (tapFeedback === "wrong") return "Tente novamente com calma.";
    if (tapFeedback === "correct") return "Muito bem, comando correto";
    if (phase === "round-complete") return "Sequência concluída";
    if (roundMessage === "Central ativada") return "Central ativada";
    return "Siga o comando acima, passo a passo.";
  })();

  const statusVariant = (():
    | "neutral"
    | "info"
    | "success"
    | "error" => {
    if (tapFeedback === "wrong" || roundMessage?.startsWith("Tente")) {
      return "error";
    }
    if (
      tapFeedback === "correct" ||
      phase === "round-complete" ||
      roundMessage === "Central ativada" ||
      roundMessage === "Muito bem, comando correto"
    ) {
      return "success";
    }
    if (phase === "playing") return "info";
    return "neutral";
  })();

  const canTap = phase === "playing" && !inputLocked;

  const renderTarget = (targetId: PanelTargetId) => {
    const target = PANEL_TARGETS[targetId];
    const isWire = target.kind === "wire";
    const isConfirm = target.kind === "confirm";
    const isWrong = tapFeedback === "wrong" && lastTapped === targetId;
    const isCorrect = tapFeedback === "correct" && lastTapped === targetId;
    const isNext =
      phase === "playing" &&
      sequence[inputIndex] === targetId &&
      !inputLocked &&
      tapFeedback === null;

    return (
      <motion.button
        key={targetId}
        type="button"
        disabled={!canTap}
        aria-label={target.label}
        onClick={() => handleTargetPress(targetId)}
        animate={
          reducedMotion
            ? undefined
            : isWrong
              ? gentleShakeAnimate
              : isCorrect
                ? positivePulseAnimate
                : undefined
        }
        whileTap={canTap && !reducedMotion ? { scale: 0.96, y: 2 } : undefined}
        whileHover={canTap && !reducedMotion ? { y: -2 } : undefined}
        className={`relative flex min-h-[4.75rem] w-full flex-col items-center justify-center gap-2 rounded-2xl border-4 px-3 py-4 text-lg font-bold transition-[transform,box-shadow] duration-200 focus-visible:outline-offset-4 disabled:opacity-55 sm:min-h-[5.25rem] sm:text-xl ${
          target.surface
        } ${isWrong ? "!border-red-700 !bg-red-50 !shadow-[0_3px_0_0_#dc2626] ring-4 ring-red-300" : ""} ${
          isCorrect
            ? "!border-emerald-700 !bg-emerald-100 ring-4 ring-emerald-400"
            : ""
        } ${
          isNext && isConfirm
            ? "!ring-4 !ring-amber-300 !ring-offset-2"
            : isNext
              ? "!ring-2 !ring-teal-400 !ring-offset-2"
              : ""
        }`}
      >
        {isWire && (
          <span
            className={`block h-2.5 w-full max-w-[85%] rounded-full border-2 border-current ${target.accent}`}
            aria-hidden
          />
        )}
        {!isWire && !isConfirm && (
          <span
            className={`h-10 w-10 rounded-full border-2 border-current ${target.accent}`}
            aria-hidden
          />
        )}
        {isConfirm && (
          <Check className="h-8 w-8 shrink-0" strokeWidth={2.5} aria-hidden />
        )}
        <span>{target.label}</span>
      </motion.button>
    );
  };

  return (
    <GameLayout
      title="Central de Comandos"
      description="Opere botões e fios táteis seguindo a sequência indicada."
      world="commands"
      wide
      onBack={onExit}
      footer={
        <p className="text-center">
          A partir da etapa 3, aparecem regras de não tocar em itens indicados.{" "}
          {SECURITY_PANEL_MAX_ERRORS} erros encerram a atividade.
        </p>
      }
    >
      <div className="miniworld-grid command-world-grid">
        <aside className="miniworld-side" aria-label="Instrução do comando">
          <section className="miniworld-guide-card command-guide-card">
            <p className="miniworld-label">Missão</p>
            <h3>Ative a central</h3>
            <ol className="miniworld-steps">
              <li>Observe a instrução exibida.</li>
              <li>Acione botões e fios na ordem.</li>
              <li>Confirme para completar o circuito.</li>
            </ol>
          </section>
          {phase !== "idle" && instructionText && (
            <section className="miniworld-command-card" aria-live="polite">
              <p className="miniworld-label">Comando atual</p>
              <p className="miniworld-command-text">{instructionText}</p>
              {forbiddenRule && <p className="miniworld-rule">{forbiddenRule.ruleText}</p>}
            </section>
          )}
        </aside>

        <section className="miniworld-play-area" aria-label="Mesa de comandos">
          <motion.div
            key={statusMessage}
            initial={reducedMotion ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
          >
            <StatusBanner
              variant={statusVariant}
              label="Sinal da central"
              className="mb-4"
            >
              {statusMessage}
            </StatusBanner>
          </motion.div>

          {phase === "idle" && (
            <section className="miniworld-action-card miniworld-quick-start">
              <p>Comece para receber um comando simples de cada vez.</p>
              <button
                type="button"
                onClick={beginGame}
                aria-label="Iniciar atividade Central de Comandos"
                className="btn-primary flex w-full items-center justify-center gap-2"
              >
                <Play className="h-6 w-6 fill-current" aria-hidden />
                Ativar central
              </button>
            </section>
          )}

          {phase === "playing" && sequence.length > 0 && (
            <div
              className="command-progress-lights"
              role="progressbar"
              aria-valuenow={inputIndex + 1}
              aria-valuemin={1}
              aria-valuemax={sequence.length}
              aria-label={`Progresso do painel: passo ${currentStepDisplay} de ${sequence.length}`}
            >
              {sequence.map((stepId, index) => {
                const done = index < inputIndex;
                const current = index === inputIndex;
                return (
                  <span
                    key={`${stepId}-${index}`}
                    className={done ? "is-lit" : current ? "is-current" : ""}
                    aria-hidden
                  />
                );
              })}
            </div>
          )}

          <motion.div
            className={`board-surface command-board command-console mx-auto w-full min-w-0 space-y-3 rounded-3xl p-4 sm:p-5 ${
              phase === "round-complete"
                ? "border-emerald-500 ring-4 ring-emerald-200"
                : "border-slate-400"
            } ${canTap ? "" : phase === "playing" ? "opacity-95" : ""}`}
            role="group"
            aria-label="Central de comandos com botões e fios"
            initial={false}
            animate={
              reducedMotion || shakeToken === 0 ? undefined : gentleShakeAnimate
            }
            key={shakeToken > 0 ? `panel-shake-${shakeToken}` : "panel"}
          >
            <div className="mb-2 flex items-center justify-center gap-2 border-b border-teal-100 pb-3">
              <LayoutGrid className="h-6 w-6 text-teal-700" aria-hidden />
              <p className="text-lg font-bold text-slate-800">Painel de ativação</p>
            </div>
            <p className="text-muted -mt-1 mb-1 text-center text-sm font-medium">Botões</p>
            <div className="grid grid-cols-2 gap-3">
              {renderTarget("button-blue")}
              {renderTarget("button-green")}
            </div>
            <p className="text-muted pt-1 text-center text-sm font-medium">Fios</p>
            <div className="grid grid-cols-2 gap-3">
              {renderTarget("wire-yellow")}
              {renderTarget("wire-red")}
            </div>
            <p className="text-muted pt-1 text-center text-sm font-medium">Finalizar</p>
            {renderTarget("confirm")}
          </motion.div>
        </section>

        <aside className="miniworld-side" aria-label="Ações e progresso">
          <section
            className={`miniworld-action-card ${
              phase === "idle" ? "miniworld-idle-side-action" : ""
            }`}
          >
            <p>Leia o comando e confirme somente quando estiver pronto.</p>
            {phase === "idle" ? (
              <button
                type="button"
                onClick={beginGame}
                aria-label="Iniciar atividade Central de Comandos"
                className="btn-primary flex w-full items-center justify-center gap-2"
              >
                <Play className="h-6 w-6 fill-current" aria-hidden />
                Ativar central
              </button>
            ) : (
              <GameActions
                onRestart={restartSession}
                onEndSession={() =>
                  finishGame({
                    level,
                    panelsCompleted,
                    errors,
                    currentStep: currentStepDisplay,
                  })
                }
                disabled={inputLocked && phase === "playing"}
              />
            )}
          </section>
          <div className="miniworld-stats-grid">
            <StatCard label="Etapa" value={level} accent="success" />
            <StatCard label="Passo" value={sequence.length > 0 ? `${currentStepDisplay}/${sequence.length}` : "—"} />
            <StatCard label="Erros" value={`${errors}/${SECURITY_PANEL_MAX_ERRORS}`} accent={errors > 0 ? "danger" : "default"} />
            <StatCard label="Pontuação" value={score} accent="score" />
          </div>
          <section className="miniworld-focus-card command-focus-card">
            <p>Centrais ativadas</p>
            <strong>{panelsCompleted}</strong>
            <span>Cada sequência acende o painel.</span>
          </section>
        </aside>
      </div>
    </GameLayout>
  );
}
