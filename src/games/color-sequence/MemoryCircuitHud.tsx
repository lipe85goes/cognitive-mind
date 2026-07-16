import type { CSSProperties } from "react";
import {
  formatMemorySignalCount,
  MEMORY_PAD_LAYOUTS,
  normalizeMemorySignalText,
} from "@/games/color-sequence/memoryCircuitLayout";
import type { StatusVariant } from "@/games/color-sequence/useColorSequenceGame";

interface MemoryCircuitHudProps {
  level: number;
  sequenceLength: number;
  stateLabel: string;
  statusMessage: string;
  statusVariant: StatusVariant;
}

export function MemoryCircuitHud({
  level,
  sequenceLength,
  stateLabel,
  statusMessage,
  statusVariant,
}: MemoryCircuitHudProps) {
  const calmStatusMessage = normalizeMemorySignalText(statusMessage);

  return (
    <section className="mfg-memory-hud" aria-label="Circuito de Memória">
      <div className="mfg-memory-title">
        <span className="mfg-memory-glyph" aria-hidden>
          ✦
        </span>
        <div>
          <h1>Circuito de Memória</h1>
          <p>Pensar em paz</p>
        </div>
      </div>

      <div
        className={`mfg-memory-state mfg-status-${statusVariant}`}
        role="status"
        aria-live="polite"
      >
        <strong>{stateLabel}</strong>
        <span>{calmStatusMessage}</span>
      </div>

      <div className="mfg-memory-path" aria-label="Percurso do circuito">
        <span>Seu percurso</span>
        <strong>Etapa {level}</strong>
        <div className="mfg-memory-path-dots" aria-hidden>
          {MEMORY_PAD_LAYOUTS.map((pad) => (
            <i
              key={pad.id}
              style={{ "--pad": pad.swatch } as CSSProperties}
            />
          ))}
        </div>
        <small>
          {sequenceLength > 0
            ? formatMemorySignalCount(sequenceLength)
            : "Pronto para ativar"}
        </small>
      </div>
    </section>
  );
}
