import type { CSSProperties } from "react";
import { RotateCcw, Square } from "lucide-react";
import {
  formatMemorySignalCount,
  MEMORY_PAD_LAYOUTS,
} from "@/games/color-sequence/memoryCircuitLayout";
import { getMemoryPadFeedbackClass } from "@/games/color-sequence/memoryCircuitVisualState";
import type {
  MemoryPhase,
  TapFeedback,
} from "@/games/color-sequence/useColorSequenceGame";

interface MemoryCircuitAccessibleControlsProps {
  phase: MemoryPhase;
  activeColor: number | null;
  lastTapped: number | null;
  tapFeedback: TapFeedback;
  canTap: boolean;
  level: number;
  sequenceLength: number;
  errors: number;
  maxErrors: number;
  score: number;
  onPadPress: (id: number) => void;
  onRestart: () => void;
  onEnd: () => void;
}

export function MemoryCircuitAccessibleControls({
  phase,
  activeColor,
  lastTapped,
  tapFeedback,
  canTap,
  level,
  sequenceLength,
  errors,
  maxErrors,
  score,
  onPadPress,
  onRestart,
  onEnd,
}: MemoryCircuitAccessibleControlsProps) {
  return (
    <section
      className="mfg-support-dock"
      data-phase={phase}
      aria-label="Apoio do circuito"
    >
      <div className="mfg-pads" role="group" aria-label="Cores do circuito">
        {MEMORY_PAD_LAYOUTS.map((pad) => {
          const isLit = activeColor === pad.id;
          const feedback = lastTapped === pad.id ? tapFeedback : null;
          const feedbackClass = getMemoryPadFeedbackClass(isLit, feedback);

          return (
            <button
              key={pad.id}
              type="button"
              onClick={() => onPadPress(pad.id)}
              disabled={!canTap}
              aria-pressed={isLit}
              aria-label={`Cor ${pad.name}, símbolo ${pad.symbol}`}
              style={{ "--pad": pad.swatch } as CSSProperties}
              className={`mfg-pad-btn ${feedbackClass}`.trim()}
            >
              <span className="mfg-pad-dot" aria-hidden />
              <span className="mfg-pad-name">{pad.name}</span>
              <span className="mfg-pad-symbol">{pad.symbol}</span>
            </button>
          );
        })}
      </div>

      {phase !== "idle" && (
        <div className="mfg-actions">
          <button
            type="button"
            onClick={onRestart}
            disabled={phase === "showing"}
            aria-label="Começar outro circuito"
            className="mfg-btn mfg-btn-secondary wms-button-secondary"
          >
            <RotateCcw className="h-5 w-5" aria-hidden />
            Começar outro circuito
          </button>
          <button
            type="button"
            onClick={onEnd}
            disabled={phase === "showing"}
            aria-label="Finalizar por agora"
            className="mfg-btn mfg-btn-ghost wms-button-secondary"
          >
            <Square className="h-4 w-4" aria-hidden />
            Finalizar por agora
          </button>
        </div>
      )}

      <div className="mfg-stats" aria-label="Registro do circuito">
        <span className="mfg-stat">
          <em>Etapa</em>
          <strong>{level}</strong>
        </span>
        <span className="mfg-stat">
          <em>Circuito</em>
          <strong>
            {sequenceLength > 0
              ? formatMemorySignalCount(sequenceLength)
              : "—"}
          </strong>
        </span>
        <span className={`mfg-stat ${errors > 0 ? "is-danger" : ""}`}>
          <em>Tentativas</em>
          <strong>
            {errors}/{maxErrors}
          </strong>
        </span>
        <span className="mfg-stat mfg-stat-score">
          <em>Registro</em>
          <strong>{score}</strong>
        </span>
      </div>

      <p className="mfg-footnote">
        Enquanto o circuito aparece, observe com calma. Depois de algumas
        tentativas, a sessão é registrada.
      </p>
    </section>
  );
}
