import Image from "next/image";
import { useCallback, useEffect, useRef } from "react";
import { Play } from "lucide-react";
import {
  MEMORY_CIRCUIT_ASSETS,
  MEMORY_PAD_LAYOUTS,
} from "@/games/color-sequence/memoryCircuitLayout";
import { MemoryCircuitPadLayer } from "@/games/color-sequence/MemoryCircuitPadLayer";
import { getMemoryPadOverlayState } from "@/games/color-sequence/memoryCircuitVisualState";
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
  onReady?: () => void;
  onError?: (error: Error) => void;
}

const MEMORY_STAGE_ASSET_COUNT = 7;

/**
 * Palco ativo (RESET-CIRCUIT-MAX): board MESTRE 2.5D único + overlays
 * transparentes do mesmo enquadramento, acesos por estado. Nada de pads
 * físicos separados — a arte é coerente por construção e os hitboxes reais
 * ficam por cima. A lógica do jogo permanece 100% no hook congelado.
 */
export function MemoryCircuitStage({
  phase,
  activeColor,
  lastTapped,
  tapFeedback,
  canTap,
  onPadPress,
  onBegin,
  onReady,
  onError,
}: MemoryCircuitStageProps) {
  const loadedAssetsRef = useRef(new Set<string>());
  const readyReportedRef = useRef(false);
  const firstPaintFrameRef = useRef<number | null>(null);
  const settledPaintFrameRef = useRef<number | null>(null);
  const corePulseClass =
    phase === "round-complete"
      ? "is-on"
      : phase === "showing"
        ? "is-soft"
        : "";

  const markAssetLoaded = useCallback(
    (asset: string) => {
      if (readyReportedRef.current) return;
      loadedAssetsRef.current.add(asset);
      if (loadedAssetsRef.current.size !== MEMORY_STAGE_ASSET_COUNT) return;

      firstPaintFrameRef.current = window.requestAnimationFrame(() => {
        settledPaintFrameRef.current = window.requestAnimationFrame(() => {
          if (readyReportedRef.current) return;
          readyReportedRef.current = true;
          onReady?.();
        });
      });
    },
    [onReady],
  );

  const reportAssetError = useCallback(
    (asset: string) => {
      onError?.(
        new Error(`Failed to load essential Memory Circuit asset: ${asset}`),
      );
    },
    [onError],
  );

  useEffect(
    () => () => {
      if (firstPaintFrameRef.current !== null) {
        window.cancelAnimationFrame(firstPaintFrameRef.current);
      }
      if (settledPaintFrameRef.current !== null) {
        window.cancelAnimationFrame(settledPaintFrameRef.current);
      }
    },
    [],
  );

  return (
    <div
      className="mfg-stage mfg-illustrated-stage mfg-master-stage"
      aria-busy={phase === "showing"}
      data-phase={phase}
    >
      <Image
        src={MEMORY_CIRCUIT_ASSETS.background}
        alt=""
        className="mfg-memory-bg"
        fill
        priority
        sizes="100vw"
        draggable={false}
        onLoad={() => markAssetLoaded(MEMORY_CIRCUIT_ASSETS.background)}
        onError={() => reportAssetError(MEMORY_CIRCUIT_ASSETS.background)}
      />
      <div className="mfg-memory-stage-shade" aria-hidden />

      <div className="mfg-master-board" data-phase={phase}>
        <span className="mfg-master-board-shadow" aria-hidden />

        <Image
          src={MEMORY_CIRCUIT_ASSETS.board}
          alt=""
          className="mfg-master-board-art"
          fill
          priority
          sizes="(max-width: 900px) 96vw, 44rem"
          draggable={false}
          onLoad={() => markAssetLoaded(MEMORY_CIRCUIT_ASSETS.board)}
          onError={() => reportAssetError(MEMORY_CIRCUIT_ASSETS.board)}
        />

        {MEMORY_PAD_LAYOUTS.map((pad) => {
          const state = getMemoryPadOverlayState(
            pad.id,
            activeColor,
            lastTapped,
            tapFeedback,
          );
          return (
            <Image
              key={pad.id}
              src={pad.overlay}
              alt=""
              aria-hidden
              className={`mfg-master-overlay ${
                state === "on" ? "is-on" : state === "wrong" ? "is-wrong" : ""
              }`.trim()}
              fill
              priority
              sizes="(max-width: 900px) 96vw, 44rem"
              draggable={false}
              onLoad={() => markAssetLoaded(pad.overlay)}
              onError={() => reportAssetError(pad.overlay)}
            />
          );
        })}

        <Image
          src={MEMORY_CIRCUIT_ASSETS.corePulse}
          alt=""
          aria-hidden
          className={`mfg-master-overlay mfg-master-core ${corePulseClass}`.trim()}
          fill
          priority
          sizes="(max-width: 900px) 96vw, 44rem"
          draggable={false}
          onLoad={() => markAssetLoaded(MEMORY_CIRCUIT_ASSETS.corePulse)}
          onError={() => reportAssetError(MEMORY_CIRCUIT_ASSETS.corePulse)}
        />

        <MemoryCircuitPadLayer
          activeColor={activeColor}
          lastTapped={lastTapped}
          tapFeedback={tapFeedback}
          canTap={canTap}
          onPadPress={onPadPress}
        />
      </div>

      {phase === "idle" && (
        <div className="mfg-stage-overlay">
          <p className="mfg-stage-hint">
            Observe as luzes do circuito e repita a sequência.
          </p>
          <button
            type="button"
            onClick={onBegin}
            aria-label="Ativar circuito"
            className="mfg-cta wms-button-primary"
          >
            <Play className="h-6 w-6 fill-current" aria-hidden />
            Ativar circuito
          </button>
        </div>
      )}
    </div>
  );
}
