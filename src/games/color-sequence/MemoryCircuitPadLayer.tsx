import type { CSSProperties } from "react";
import { MEMORY_PAD_LAYOUTS } from "@/games/color-sequence/memoryCircuitLayout";
import { getMemoryPadFeedbackClass } from "@/games/color-sequence/memoryCircuitVisualState";
import type { TapFeedback } from "@/games/color-sequence/useColorSequenceGame";

interface MemoryCircuitPadLayerProps {
  activeColor: number | null;
  lastTapped: number | null;
  tapFeedback: TapFeedback;
  canTap: boolean;
  onPadPress: (id: number) => void;
}

export function MemoryCircuitPadLayer({
  activeColor,
  lastTapped,
  tapFeedback,
  canTap,
  onPadPress,
}: MemoryCircuitPadLayerProps) {
  return (
    <div className="mfg-board-hitboxes" aria-label="Pads do Circuito de Memória">
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
            aria-label={`Ativar ${pad.name}, símbolo ${pad.symbol}`}
            style={
              {
                "--pad": pad.swatch,
                "--x": pad.x,
                "--y": pad.y,
              } as CSSProperties
            }
            className={`mfg-board-pad-hitbox ${feedbackClass}`.trim()}
          >
            <span className="sr-only">{pad.name}</span>
          </button>
        );
      })}
    </div>
  );
}