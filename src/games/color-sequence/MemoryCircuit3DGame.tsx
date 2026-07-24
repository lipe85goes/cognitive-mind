"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Volume2, VolumeX } from "lucide-react";
import { MemoryCircuitAccessibleControls } from "@/games/color-sequence/MemoryCircuitAccessibleControls";
import { MemoryCircuitHud } from "@/games/color-sequence/MemoryCircuitHud";
import { MemoryCircuitStage } from "@/games/color-sequence/MemoryCircuitStage";
import { getMemoryCircuitStateLabel } from "@/games/color-sequence/memoryCircuitVisualState";
import { isSoundEnabled, setSoundEnabled } from "@/lib/game-sounds";
import { useColorSequenceGame } from "@/games/color-sequence/useColorSequenceGame";
import { getWorldMasterSceneStyle } from "@/components/worlds/master-scene/worldMasterSceneConfig";
import type { GameComponentProps } from "@/types/game";
import "@/components/worlds/master-scene/world-master-scene.css";

function PremiumSoundToggle() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only preference
    setOn(isSoundEnabled());
  }, []);
  return (
    <button
      type="button"
      onClick={() => {
        const next = !on;
        setOn(next);
        setSoundEnabled(next);
      }}
      aria-label={on ? "Desligar sons suaves" : "Ligar sons suaves"}
      aria-pressed={on}
      className="mfg-sound"
    >
      {on ? (
        <Volume2 className="h-5 w-5" aria-hidden />
      ) : (
        <VolumeX className="h-5 w-5" aria-hidden />
      )}
      <span>Som: {on ? "ligado" : "desligado"}</span>
    </button>
  );
}

export function MemoryCircuit3DGame({
  onComplete,
  onExit,
  onEntryReady,
  onEntryError,
}: GameComponentProps) {
  const game = useColorSequenceGame(onComplete);
  const {
    sequence,
    level,
    errors,
    phase,
    activeColor,
    lastTapped,
    tapFeedback,
    score,
    canTap,
    maxErrors,
    statusMessage,
    statusVariant,
    beginGame,
    restartSession,
    handleColorPress,
    endSession,
  } = game;

  const stateLabel = getMemoryCircuitStateLabel(phase);

  return (
    <div
      className="mfg-shell wms-world-shell"
      data-world-scene="circuit"
      style={getWorldMasterSceneStyle("color-sequence", "game-shell")}
    >
      <div className="mfg-atmosphere" aria-hidden />
      <span className="mfg-vignette" aria-hidden />

      <div className="mfg-frame mfg-frame-hero">
        <header className="mfg-topbar">
          <button
            type="button"
            onClick={onExit}
            aria-label="Voltar à jornada cognitiva"
            className="mfg-back"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
            Voltar à jornada
          </button>
          <PremiumSoundToggle />
        </header>

        <MemoryCircuitHud
          level={level}
          sequenceLength={sequence.length}
          stateLabel={stateLabel}
          statusMessage={statusMessage}
          statusVariant={statusVariant}
        />

        <MemoryCircuitStage
          phase={phase}
          activeColor={activeColor}
          lastTapped={lastTapped}
          tapFeedback={tapFeedback}
          canTap={canTap}
          onPadPress={handleColorPress}
          onBegin={beginGame}
          onReady={onEntryReady}
          onError={onEntryError}
        />

        <MemoryCircuitAccessibleControls
          phase={phase}
          activeColor={activeColor}
          lastTapped={lastTapped}
          tapFeedback={tapFeedback}
          canTap={canTap}
          level={level}
          sequenceLength={sequence.length}
          errors={errors}
          maxErrors={maxErrors}
          score={score}
          onPadPress={handleColorPress}
          onRestart={restartSession}
          onEnd={endSession}
        />
      </div>
    </div>
  );
}
