import type { CSSProperties } from "react";
import { Check, Eye, RotateCcw, Sparkles, type LucideIcon } from "lucide-react";
import {
  formatMemorySignalCount,
  MEMORY_PAD_LAYOUTS,
  normalizeMemorySignalText,
} from "@/games/color-sequence/memoryCircuitLayout";
import { MemoryCircuitWorldMark } from "@/games/color-sequence/MemoryCircuitWorldMark";
import type { StatusVariant } from "@/games/color-sequence/useColorSequenceGame";

interface MemoryCircuitHudProps {
  level: number;
  sequenceLength: number;
  stateLabel: string;
  statusMessage: string;
  statusVariant: StatusVariant;
}

/** Ícone calmo por variante — erro usa "outra tentativa", nunca alarme. */
const STATE_ICONS: Record<StatusVariant, LucideIcon> = {
  neutral: Sparkles,
  info: Eye,
  success: Check,
  error: RotateCcw,
};

/**
 * HUD do Circuito (CIRCUIT-PRESENTATION-FINAL-01): três placas do mundo.
 * 1. Lockup do mundo — emblema próprio + nome + assinatura.
 * 2. Placa de estado — a instrução atual é a informação principal.
 * 3. Marcador de etapa — progresso essencial, sem métricas repetidas.
 */
export function MemoryCircuitHud({
  level,
  sequenceLength,
  stateLabel,
  statusMessage,
  statusVariant,
}: MemoryCircuitHudProps) {
  const calmStatusMessage = normalizeMemorySignalText(statusMessage);
  const StateIcon = STATE_ICONS[statusVariant];

  return (
    <section className="mfg-memory-hud" aria-label="Circuito de Memória">
      <div className="mfg-memory-title wms-plate">
        <MemoryCircuitWorldMark className="mfg-memory-mark" />
        <div className="mfg-memory-lockup">
          <h1>Circuito de Memória</h1>
          <p>Memória em quatro sinais</p>
        </div>
      </div>

      <div
        className={`mfg-memory-state mfg-status-${statusVariant} wms-plate`}
        role="status"
        aria-live="polite"
      >
        <span className="mfg-memory-state-icon" aria-hidden>
          <StateIcon className="h-5 w-5" />
        </span>
        <div className="mfg-memory-state-copy">
          <strong>{stateLabel}</strong>
          <span>{calmStatusMessage}</span>
        </div>
      </div>

      <div
        className="mfg-memory-path wms-plate"
        aria-label={`Etapa ${level} do circuito`}
      >
        <strong>Etapa {level}</strong>
        <div className="mfg-memory-path-dots" aria-hidden>
          {MEMORY_PAD_LAYOUTS.map((pad) => (
            <i key={pad.id} style={{ "--pad": pad.swatch } as CSSProperties} />
          ))}
        </div>
        <small>
          {sequenceLength > 0
            ? formatMemorySignalCount(sequenceLength)
            : "Ao seu ritmo"}
        </small>
      </div>
    </section>
  );
}
