"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { useReducedMotion } from "motion/react";
import { Brain, ChevronLeft, ChevronRight, Play } from "lucide-react";
import type { WorldKey } from "@/data/worlds";
import type { Activity, GameId } from "@/types/game";

export interface World3DEntry {
  activity: Activity;
  gameId: GameId;
  world: WorldKey;
  name: string;
  skill: string;
  purpose: string;
}

/** WebGL is client-only: load the scene after mount with a calm fallback. */
const WorldSelectorScene = dynamic(
  () =>
    import("@/components/three/WorldSelectorScene").then(
      (mod) => mod.WorldSelectorScene,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="lab3d-scene-loading">Preparando o mundo 3D…</div>
    ),
  },
);

interface GameHome3DProps {
  worlds: World3DEntry[];
  onEnter: (activity: Activity) => void;
}

/**
 * 3D game-menu home (prototype): a real WebGL world selector with an HTML
 * overlay for title, the selected world's details and the Entrar action.
 */
export function GameHome3D({ worlds, onEnter }: GameHome3DProps) {
  const reducedMotion = Boolean(useReducedMotion());
  const [selectedIndex, setSelectedIndex] = useState(0);
  const count = worlds.length;
  const clampedIndex = Math.min(selectedIndex, Math.max(count - 1, 0));
  const selected = worlds[clampedIndex];

  const select = useCallback(
    (index: number) =>
      setSelectedIndex(Math.min(Math.max(index, 0), Math.max(count - 1, 0))),
    [count],
  );

  const handleControlsKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      select(clampedIndex - 1);
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      select(clampedIndex + 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      select(0);
    } else if (event.key === "End") {
      event.preventDefault();
      select(count - 1);
    }
  };

  if (!selected) return null;

  return (
    <div className="lab3d-root">
      <div className="lab3d-scene">
        <WorldSelectorScene
          worlds={worlds.map((entry) => entry.world)}
          selectedIndex={clampedIndex}
          reducedMotion={reducedMotion}
          onSelect={select}
        />
      </div>

      <div className="lab3d-overlay">
        <header className="lab3d-topbar">
          <span className="lab3d-brand">
            <span className="lab3d-brandmark" aria-hidden>
              <Brain className="h-6 w-6" strokeWidth={2.2} />
            </span>
            <span className="lab3d-brand-text">
              <strong>MindFlow</strong>
              <em>Protótipo 3D · seleção de mundos</em>
            </span>
          </span>
        </header>

        <div className="lab3d-bottom">
          <h1 className="lab3d-headline">Escolha seu mundo de treino</h1>

          <section className="lab3d-panel" aria-live="polite">
            <p className="lab3d-eyebrow">
              Estação {clampedIndex + 1} de {count}
            </p>
            <h2 className="lab3d-world-name">{selected.name}</h2>
            <p className="lab3d-world-desc">{selected.purpose}</p>
            <p className="lab3d-world-skill">{selected.skill}</p>
          </section>

          <div className="lab3d-actions">
            <div
              className="lab3d-controls"
              role="tablist"
              aria-label="Mundos de treino"
              onKeyDown={handleControlsKeyDown}
            >
              <button
                type="button"
                className="lab3d-arrow"
                aria-label="Mundo anterior"
                disabled={clampedIndex === 0}
                onClick={() => select(clampedIndex - 1)}
              >
                <ChevronLeft strokeWidth={2.6} aria-hidden />
              </button>
              <div className="lab3d-dots">
                {worlds.map((entry, index) => (
                  <button
                    key={entry.gameId}
                    type="button"
                    role="tab"
                    aria-selected={index === clampedIndex}
                    aria-label={entry.name}
                    tabIndex={index === clampedIndex ? 0 : -1}
                    className={`lab3d-dot ${index === clampedIndex ? "is-active" : ""}`}
                    onClick={() => select(index)}
                  />
                ))}
              </div>
              <button
                type="button"
                className="lab3d-arrow"
                aria-label="Próximo mundo"
                disabled={clampedIndex === count - 1}
                onClick={() => select(clampedIndex + 1)}
              >
                <ChevronRight strokeWidth={2.6} aria-hidden />
              </button>
            </div>

            <button
              type="button"
              className="lab3d-enter"
              aria-label={`Entrar em ${selected.name}`}
              onClick={() => onEnter(selected.activity)}
            >
              <Play className="h-6 w-6 fill-current" aria-hidden />
              Entrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
