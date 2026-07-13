import Image from "next/image";
import { Play } from "lucide-react";
import { MEMORY_CIRCUIT_BOARD_IMAGE } from "@/games/color-sequence/memoryCircuitLayout";
import { MemoryCircuitPadLayer } from "@/games/color-sequence/MemoryCircuitPadLayer";
import type {
  MemoryPhase,
  TapFeedback,
} from "@/games/color-sequence/useColorSequenceGame";

interface MemoryCircuitStageProps {
  phase: MemoryPhase;
  activeColor: number | null;
  lastTapped: number | null;
  tapFeedback: TapFeedback;
  canTap: boolean;
  onPadPress: (id: number) => void;
  onBegin: () => void;
}

export function MemoryCircuitStage({
  phase,
  activeColor,
  lastTapped,
  tapFeedback,
  canTap,
  onPadPress,
  onBegin,
}: MemoryCircuitStageProps) {
  return (
    <div className="mfg-stage mfg-illustrated-stage" aria-busy={phase === "showing"}>
      <Image
        src={MEMORY_CIRCUIT_BOARD_IMAGE}
        alt="Tabuleiro ilustrado do Circuito de Memória com quatro símbolos: chama, onda, folha e sol."
        className="mfg-board-image"
        fill
        priority
        sizes="(max-width: 900px) 100vw, 108rem"
        draggable={false}
      />

      <MemoryCircuitPadLayer
        activeColor={activeColor}
        lastTapped={lastTapped}
        tapFeedback={tapFeedback}
        canTap={canTap}
        onPadPress={onPadPress}
      />

      {phase === "idle" && (
        <div className="mfg-stage-overlay">
          <p className="mfg-stage-hint">
            Observe as luzes do circuito e repita a sequência.
          </p>
          <button
            type="button"
            onClick={onBegin}
            aria-label="Ativar circuito"
            className="mfg-cta"
          >
            <Play className="h-6 w-6 fill-current" aria-hidden />
            Ativar circuito
          </button>
        </div>
      )}
    </div>
  );
}