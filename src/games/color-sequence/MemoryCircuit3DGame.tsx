"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import {
  ArrowLeft,
  Play,
  RotateCcw,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import { isSoundEnabled, setSoundEnabled } from "@/lib/game-sounds";
import { useColorSequenceGame } from "@/games/color-sequence/useColorSequenceGame";
import type { GameComponentProps } from "@/types/game";

/** WebGL is client-only: load the console after mount with a calm fallback. */
const MemoryConsoleScene = dynamic(
  () =>
    import("@/components/three/memory/MemoryConsoleScene").then(
      (mod) => mod.MemoryConsoleScene,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="mfg-scene-loading">Preparando o console 3D…</div>
    ),
  },
);

const PADS_UI = [
  { id: 0, name: "Vermelho", swatch: "#ef4444" },
  { id: 1, name: "Azul", swatch: "#38bdf8" },
  { id: 2, name: "Verde", swatch: "#34d399" },
  { id: 3, name: "Amarelo", swatch: "#fbbf24" },
] as const;

/** Small premium sound toggle (dark glass), reusing the shared sound state. */
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

/**
 * Circuito de Memória as a premium 3D console game. The game logic, scoring,
 * max-errors and completion contract live in `useColorSequenceGame` (extracted
 * verbatim from the original). The 3D scene and the accessible color controls
 * are both views over that state, so completion/reward/localStorage are
 * preserved exactly (this component only calls `onComplete`).
 */
export function MemoryCircuit3DGame({ onComplete, onExit }: GameComponentProps) {
  const reducedMotion = Boolean(useReducedMotion());
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

  return (
    <div className="mfg-shell">
      {/* Cozy dark library/workshop atmosphere behind the transparent Canvas. */}
      <div className="mfg-atmosphere" aria-hidden />
      <span className="mfg-vignette" aria-hidden />

      <div className="mfg-frame">
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

        <div className="mfg-plaque" aria-hidden>
          <span className="mfg-plaque-text">Circuito de Memória</span>
        </div>

        <p
          className={`mfg-status mfg-status-${statusVariant}`}
          role="status"
          aria-live="polite"
        >
          {statusMessage}
        </p>

        <div className="mfg-stage" aria-busy={phase === "showing"}>
          <MemoryConsoleScene
            litPad={activeColor}
            feedbackPad={lastTapped}
            feedbackType={tapFeedback}
            canTap={canTap}
            reducedMotion={reducedMotion}
            onPadPress={handleColorPress}
          />
          {phase === "idle" && (
            <div className="mfg-stage-overlay">
              <p className="mfg-stage-hint">
                Observe as luzes do circuito e repita a sequência.
              </p>
              <button
                type="button"
                onClick={beginGame}
                aria-label="Ativar circuito"
                className="mfg-cta"
              >
                <Play className="h-6 w-6 fill-current" aria-hidden />
                Ativar circuito
              </button>
            </div>
          )}
        </div>

        {/* Accessible color controls — keyboard / screen-reader friendly, and a
            high-contrast mirror of the sequence (they light up in step). */}
        <div className="mfg-pads" role="group" aria-label="Cores do circuito">
          {PADS_UI.map((pad) => {
            const isLit = activeColor === pad.id;
            const fb = lastTapped === pad.id ? tapFeedback : null;
            return (
              <button
                key={pad.id}
                type="button"
                onClick={() => handleColorPress(pad.id)}
                disabled={!canTap}
                aria-pressed={isLit}
                aria-label={`Cor ${pad.name}`}
                style={{ "--pad": pad.swatch } as React.CSSProperties}
                className={`mfg-pad-btn ${isLit ? "is-lit" : ""} ${
                  fb === "wrong" ? "is-wrong" : fb === "correct" ? "is-correct" : ""
                }`}
              >
                <span className="mfg-pad-dot" aria-hidden />
                <span className="mfg-pad-name">{pad.name}</span>
              </button>
            );
          })}
        </div>

        {phase !== "idle" && (
          <div className="mfg-actions">
            <button
              type="button"
              onClick={restartSession}
              disabled={phase === "showing"}
              aria-label="Reiniciar"
              className="mfg-btn"
            >
              <RotateCcw className="h-5 w-5" aria-hidden />
              Reiniciar
            </button>
            <button
              type="button"
              onClick={endSession}
              disabled={phase === "showing"}
              aria-label="Encerrar sessão"
              className="mfg-btn mfg-btn-ghost"
            >
              <Square className="h-4 w-4" aria-hidden />
              Encerrar sessão
            </button>
          </div>
        )}

        <div className="mfg-stats" aria-label="Progresso do circuito">
          <span className="mfg-stat">
            <em>Etapa</em>
            <strong>{level}</strong>
          </span>
          <span className="mfg-stat">
            <em>Circuito</em>
            <strong>{sequence.length > 0 ? `${sequence.length} sinais` : "—"}</strong>
          </span>
          <span className={`mfg-stat ${errors > 0 ? "is-danger" : ""}`}>
            <em>Erros</em>
            <strong>
              {errors}/{maxErrors}
            </strong>
          </span>
          <span className="mfg-stat mfg-stat-score">
            <em>Pontuação</em>
            <strong>{score}</strong>
          </span>
        </div>

        <p className="mfg-footnote">
          As cores ficam bloqueadas enquanto o circuito aparece. {maxErrors} erros
          encerram a atividade.
        </p>
      </div>
    </div>
  );
}
