"use client";

import { useCallback, useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Droplets,
  Lightbulb,
  Music,
  Play,
  Power,
  Zap,
} from "lucide-react";
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

/**
 * The central operates the station's real systems. Target ids are kept
 * stable (storage/scoring untouched); only the presented identity changed.
 */
const PANEL_TARGETS: Record<
  PanelTargetId,
  {
    label: string;
    instructionPart: string;
    kind: "system" | "confirm";
    icon: typeof Music;
    lamp: "som" | "agua" | "luz" | "energia" | "ativar";
    surface: string;
  }
> = {
  "button-blue": {
    label: "Som",
    instructionPart: "em Som",
    kind: "system",
    icon: Music,
    lamp: "som",
    surface:
      "bg-sky-100 border-sky-600 text-sky-950 shadow-[0_5px_0_0_#0284c7]",
  },
  "button-green": {
    label: "Água",
    instructionPart: "na Água",
    kind: "system",
    icon: Droplets,
    lamp: "agua",
    surface:
      "bg-emerald-100 border-emerald-600 text-emerald-950 shadow-[0_5px_0_0_#059669]",
  },
  "wire-yellow": {
    label: "Luz",
    instructionPart: "na Luz",
    kind: "system",
    icon: Lightbulb,
    lamp: "luz",
    surface:
      "bg-amber-50 border-amber-500 text-amber-950 shadow-[0_5px_0_0_#d97706]",
  },
  "wire-red": {
    label: "Energia",
    instructionPart: "na Energia",
    kind: "system",
    icon: Zap,
    lamp: "energia",
    surface:
      "bg-rose-50 border-rose-500 text-rose-950 shadow-[0_5px_0_0_#e11d48]",
  },
  confirm: {
    label: "Ativar",
    instructionPart: "em Ativar",
    kind: "confirm",
    icon: Power,
    lamp: "ativar",
    surface:
      "bg-teal-700 border-teal-900 text-white shadow-[0_5px_0_0_#115e59]",
  },
};

/** Display order of the four station systems on the lamp strip. */
const SYSTEM_IDS: PanelTargetId[] = [
  "wire-yellow",
  "button-blue",
  "button-green",
  "wire-red",
];

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
    ruleText: "A Energia está em manutenção. Não toque na Energia.",
  },
  {
    minLevel: 5,
    forbiddenId: "button-green",
    ruleText: "A Água está em pausa hoje. Não toque na Água.",
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
    if (only === "confirm") return "Toque em Ativar.";
    return `Toque ${PANEL_TARGETS[only].instructionPart}.`;
  }

  const last = sequence[sequence.length - 1];
  const middle = sequence.slice(0, -1);
  let text = `Toque ${PANEL_TARGETS[middle[0]].instructionPart}`;

  for (let i = 1; i < middle.length; i++) {
    text += `, depois ${PANEL_TARGETS[middle[i]].instructionPart}`;
  }

  if (last === "confirm") {
    text += ", e finalize em Ativar.";
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

  /** Steps already completed this round (all of them once the round closes). */
  const completedSteps =
    phase === "round-complete" ? sequence.length : inputIndex;
  const activatedSystems = useMemo(
    () =>
      new Set<PanelTargetId>(
        sequence.slice(0, completedSteps).filter((id) => id !== "confirm"),
      ),
    [sequence, completedSteps],
  );

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
    if (phase === "idle")
      return "Toque em Ativar central para receber o primeiro comando.";
    if (roundMessage) return roundMessage;
    if (tapFeedback === "wrong") return "Tente novamente com calma.";
    if (tapFeedback === "correct") return "Muito bem, comando correto";
    if (phase === "round-complete") return "Sequência concluída";
    if (roundMessage === "Central ativada") return "Central ativada";
    return "Siga os passos e acenda os sistemas da estação.";
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
    const TargetIcon = target.icon;
    const isWrong = tapFeedback === "wrong" && lastTapped === targetId;
    const isCorrect = tapFeedback === "correct" && lastTapped === targetId;
    const isForbidden =
      phase !== "idle" && forbiddenRule?.forbiddenId === targetId;

    return (
      <motion.button
        key={targetId}
        type="button"
        disabled={!canTap}
        aria-label={
          isForbidden ? `${target.label}, em manutenção, não toque` : target.label
        }
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
        className={`command-key relative flex min-h-[4.9rem] w-full flex-col items-center justify-center gap-1.5 rounded-2xl border-4 px-3 py-3.5 text-lg font-bold transition-[transform,box-shadow] duration-200 focus-visible:outline-offset-4 disabled:opacity-55 sm:min-h-[5.5rem] sm:text-xl ${
          target.surface
        } ${isForbidden ? "command-key-forbidden" : ""} ${
          isWrong ? "is-wrong !border-red-700 !bg-red-50" : ""
        } ${isCorrect ? "is-correct !border-emerald-700 !bg-emerald-100" : ""}`}
      >
        {isForbidden && (
          <span className="command-no-touch" aria-hidden>
            Não tocar
          </span>
        )}
        <TargetIcon
          className="h-9 w-9 shrink-0"
          strokeWidth={2.2}
          aria-hidden
        />
        <span>{target.label}</span>
      </motion.button>
    );
  };

  return (
    <GameLayout
      title="Central de Comandos"
      description="Acenda os sistemas da estação seguindo um comando de cada vez."
      world="commands"
      wide
      onBack={onExit}
      footer={
        <p className="text-center">
          A partir da etapa 3, alguns sistemas entram em manutenção: não toque
          neles. {SECURITY_PANEL_MAX_ERRORS} erros encerram a atividade.
        </p>
      }
    >
      <div className="miniworld-grid command-world-grid">
        <aside className="miniworld-side" aria-label="Instrução do comando">
          <section className="miniworld-guide-card command-guide-card">
            <p className="miniworld-label">Missão</p>
            <h3>Acenda a estação</h3>
            <ol className="miniworld-steps">
              <li>Veja quais sistemas o comando pede.</li>
              <li>Toque nos sistemas na ordem indicada.</li>
              <li>Finalize em Ativar para acender a central.</li>
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

          {phase !== "idle" && sequence.length > 0 && (
            <div
              className="command-step-chips"
              role="progressbar"
              aria-valuenow={Math.min(completedSteps + 1, sequence.length)}
              aria-valuemin={1}
              aria-valuemax={sequence.length}
              aria-label={`Passos do comando: passo ${currentStepDisplay} de ${sequence.length}`}
            >
              {sequence.map((stepId, index) => {
                const target = PANEL_TARGETS[stepId];
                const StepIcon = target.icon;
                const state =
                  index < completedSteps
                    ? "is-done"
                    : index === completedSteps
                      ? "is-current"
                      : "";
                return (
                  <span
                    key={`${stepId}-${index}`}
                    className={`command-step-chip ${state}`}
                    aria-hidden
                  >
                    <StepIcon strokeWidth={2.4} aria-hidden />
                    <span>{target.label}</span>
                  </span>
                );
              })}
            </div>
          )}

          <motion.div
            className={`board-surface command-board command-console mx-auto w-full min-w-0 space-y-3 rounded-3xl p-4 sm:p-5 ${
              phase === "round-complete"
                ? "is-activated border-emerald-500"
                : "border-slate-400"
            } ${canTap ? "" : phase === "playing" ? "opacity-95" : ""}`}
            role="group"
            aria-label="Central de comandos com os sistemas da estação"
            initial={false}
            animate={
              reducedMotion || shakeToken === 0 ? undefined : gentleShakeAnimate
            }
            key={shakeToken > 0 ? `panel-shake-${shakeToken}` : "panel"}
          >
            <ul className="command-lamps" aria-hidden="true">
              {SYSTEM_IDS.map((systemId) => {
                const system = PANEL_TARGETS[systemId];
                const SystemIcon = system.icon;
                const isOn =
                  activatedSystems.has(systemId) || phase === "round-complete";
                return (
                  <li
                    key={systemId}
                    className={`command-lamp command-lamp-${system.lamp} ${
                      isOn ? "is-on" : ""
                    }`}
                  >
                    <SystemIcon strokeWidth={2.3} aria-hidden />
                    <span>{system.label}</span>
                  </li>
                );
              })}
            </ul>
            <p className="text-muted mb-1 pt-1 text-center text-sm font-semibold">
              Sistemas da estação
            </p>
            <div className="grid grid-cols-2 gap-3">
              {renderTarget("wire-yellow")}
              {renderTarget("button-blue")}
              {renderTarget("button-green")}
              {renderTarget("wire-red")}
            </div>
            <p className="text-muted pt-1 text-center text-sm font-semibold">
              Quando o comando terminar
            </p>
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
