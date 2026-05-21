"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, Play } from "lucide-react";
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
    surface: "bg-sky-100 border-sky-600 text-sky-950",
    accent: "bg-sky-500",
  },
  "button-green": {
    label: "Botão verde",
    instructionPart: "no botão verde",
    kind: "button",
    surface: "bg-emerald-100 border-emerald-600 text-emerald-950",
    accent: "bg-emerald-500",
  },
  "wire-yellow": {
    label: "Fio amarelo",
    instructionPart: "no fio amarelo",
    kind: "wire",
    surface: "bg-amber-50 border-amber-500 text-amber-950",
    accent: "bg-amber-400",
  },
  "wire-red": {
    label: "Fio vermelho",
    instructionPart: "no fio vermelho",
    kind: "wire",
    surface: "bg-rose-50 border-rose-500 text-rose-950",
    accent: "bg-rose-500",
  },
  confirm: {
    label: "Confirmar",
    instructionPart: "em Confirmar",
    kind: "confirm",
    surface: "bg-teal-700 border-teal-900 text-white",
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
        activityTitle: "Painel de Segurança",
        gameId: "security-panel",
        score: calculateSecurityPanelScore(stats),
        summary:
          stats.panelsCompleted > 0
            ? `Você concluiu ${stats.panelsCompleted} ${stats.panelsCompleted === 1 ? "painel" : "painéis"} no nível ${stats.level}.`
            : "Continue praticando — seguir instruções fortalece a atenção.",
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
      setTapFeedback("wrong");
      setRoundMessage("Tente novamente. Observe a instrução.");
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
    setRoundMessage("Correto");

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
      setRoundMessage("Painel concluído");

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
    if (tapFeedback === "wrong") return "Tente novamente. Observe a instrução.";
    if (tapFeedback === "correct") return "Correto";
    if (phase === "round-complete") return "Painel concluído";
    return "Siga a instrução acima, passo a passo.";
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
      roundMessage === "Painel concluído" ||
      roundMessage === "Correto"
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

    return (
      <button
        key={targetId}
        type="button"
        disabled={!canTap}
        aria-label={target.label}
        onClick={() => handleTargetPress(targetId)}
        className={`relative flex min-h-[4.5rem] w-full flex-col items-center justify-center gap-2 rounded-2xl border-4 px-3 py-4 text-lg font-bold transition-colors duration-200 focus-visible:outline-offset-4 disabled:opacity-55 sm:min-h-[5rem] sm:text-xl ${
          target.surface
        } ${isWrong ? "!border-red-700 !bg-red-50 ring-4 ring-red-300" : ""} ${
          isCorrect ? "!border-emerald-700 ring-4 ring-emerald-300" : ""
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
      </button>
    );
  };

  return (
    <GameLayout
      title="Painel de Segurança"
      description="Leia a instrução com calma e toque cada item na ordem indicada. Três erros encerram a sessão."
      onBack={onExit}
      footer={
        <p className="text-center">
          A partir do nível 3, aparecem regras de não tocar em itens indicados.{" "}
          {SECURITY_PANEL_MAX_ERRORS} erros encerram a atividade.
        </p>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Nível" value={level} accent="success" />
        <StatCard
          label="Etapa"
          value={
            sequence.length > 0
              ? `${currentStepDisplay}/${sequence.length}`
              : "—"
          }
        />
        <StatCard
          label="Erros"
          value={`${errors}/${SECURITY_PANEL_MAX_ERRORS}`}
          accent={errors > 0 ? "danger" : "default"}
        />
        <StatCard label="Pontuação" value={score} accent="score" />
      </div>

      <div className="mb-4">
        <StatCard label="Painéis concluídos" value={panelsCompleted} />
      </div>

      {phase !== "idle" && instructionText && (
        <div
          className="surface-panel mb-4 px-4 py-5 text-center"
          aria-live="polite"
        >
          <p className="text-muted mb-2 text-sm font-semibold uppercase tracking-wide">
            Instrução
          </p>
          <p className="text-xl font-bold leading-snug text-slate-900 sm:text-2xl">
            {instructionText}
          </p>
          {forbiddenRule && (
            <p className="mt-3 text-lg font-semibold text-amber-900">
              {forbiddenRule.ruleText}
            </p>
          )}
        </div>
      )}

      <StatusBanner variant={statusVariant} className="mb-5">
        {statusMessage}
      </StatusBanner>

      <div
        className={`surface-panel mx-auto w-full min-w-0 space-y-3 p-4 sm:p-5 ${
          canTap ? "" : phase === "playing" ? "opacity-95" : ""
        }`}
        role="group"
        aria-label="Painel de segurança com botões e fios"
      >
        <p className="text-muted text-center text-sm font-medium">
          Botões
        </p>
        <div className="grid grid-cols-2 gap-3">
          {renderTarget("button-blue")}
          {renderTarget("button-green")}
        </div>

        <p className="text-muted pt-1 text-center text-sm font-medium">
          Fios
        </p>
        <div className="grid grid-cols-2 gap-3">
          {renderTarget("wire-yellow")}
          {renderTarget("wire-red")}
        </div>

        <p className="text-muted pt-1 text-center text-sm font-medium">
          Finalizar
        </p>
        {renderTarget("confirm")}
      </div>

      {phase === "idle" ? (
        <button
          type="button"
          onClick={beginGame}
          aria-label="Iniciar atividade Painel de Segurança"
          className="btn-primary mt-6 flex w-full items-center justify-center gap-2"
        >
          <Play className="h-6 w-6 fill-current" aria-hidden />
          Iniciar atividade
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
    </GameLayout>
  );
}
