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

/**
 * Caminho ativo (RESET-CIRCUIT-MAX): esta camada contém APENAS os hitboxes
 * reais, posicionados sobre os pads que já fazem parte do board mestre. Toda a
 * arte (pads, trilhas, núcleo, estados acesos) vive no PNG mestre + overlays.
 */
export function MemoryCircuitPadLayer({
  activeColor,
  lastTapped,
  tapFeedback,
  canTap,
  onPadPress,
}: MemoryCircuitPadLayerProps) {
  return (
    <div className="mfg-master-hitboxes" aria-label="Pads do Circuito de Memória">
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
            data-pad={pad.element}
            style={
              {
                "--pad": pad.swatch,
                "--x": pad.x,
                "--y": pad.y,
                "--pad-size": pad.size,
              } as CSSProperties
            }
            className={`mfg-master-hitbox ${feedbackClass}`.trim()}
          >
            <span className="sr-only">{pad.name}</span>
          </button>
        );
      })}
    </div>
  );
}
