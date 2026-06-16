"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { useReducedMotion } from "motion/react";
import {
  Brain,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Compass,
  Flame,
  Play,
  Settings,
  Sparkles,
  Star,
} from "lucide-react";
import type { WorldKey } from "@/data/worlds";
import { formatPlayedAt } from "@/engine/storage";
import type { Activity, GameId, GameResult } from "@/types/game";

export interface World3DEntry {
  activity: Activity;
  gameId: GameId;
  world: WorldKey;
  name: string;
  skill: string;
  purpose: string;
}

interface GameHome3DProps {
  worlds: World3DEntry[];
  recentResults?: GameResult[];
  selectedGameId?: GameId | null;
  statusMessage?: string | null;
  onSelectedGameIdChange?: (gameId: GameId) => void;
  onEnter: (activity: Activity) => void;
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
      <div className="lab3d-scene-loading">Preparando o mundo 3D...</div>
    ),
  },
);

function countFocusDays(results: GameResult[]) {
  return new Set(
    results.map((result) => new Date(result.playedAt).toDateString()),
  ).size;
}

function getSuggestedWorld(
  worlds: World3DEntry[],
  recentResults: GameResult[],
): World3DEntry | undefined {
  const first = worlds[0];
  const lastGameId = recentResults[0]?.gameId;
  if (!first || !lastGameId) return first;

  const lastWorld = worlds.find((world) => world.gameId === lastGameId);
  const playedIds = new Set(recentResults.map((result) => result.gameId));
  const freshDifferentSkill = worlds.find(
    (world) =>
      world.gameId !== lastGameId &&
      world.skill !== lastWorld?.skill &&
      !playedIds.has(world.gameId),
  );
  if (freshDifferentSkill) return freshDifferentSkill;

  const differentSkill = worlds.find(
    (world) => world.gameId !== lastGameId && world.skill !== lastWorld?.skill,
  );
  if (differentSkill) return differentSkill;

  const lastIndex = worlds.findIndex((world) => world.gameId === lastGameId);
  return worlds[(lastIndex + 1) % worlds.length] ?? first;
}

/**
 * Production 3D game-menu home: real WebGL world selector with an accessible
 * HTML HUD for navigation, continue journey and the Entrar action.
 */
export function GameHome3D({
  worlds,
  recentResults = [],
  selectedGameId,
  statusMessage,
  onSelectedGameIdChange,
  onEnter,
}: GameHome3DProps) {
  const reducedMotion = Boolean(useReducedMotion());
  const controlledIndex = selectedGameId
    ? worlds.findIndex((world) => world.gameId === selectedGameId)
    : -1;
  const initialIndex = Math.max(
    worlds.findIndex((world) => world.gameId === selectedGameId),
    0,
  );
  const [internalSelectedIndex, setInternalSelectedIndex] =
    useState(initialIndex);
  const count = worlds.length;
  const selectedIndex =
    controlledIndex >= 0 ? controlledIndex : internalSelectedIndex;
  const clampedIndex = Math.min(selectedIndex, Math.max(count - 1, 0));
  const selected = worlds[clampedIndex];
  const lastResult = recentResults[0];
  const continueWorld =
    (lastResult
      ? worlds.find((world) => world.gameId === lastResult.gameId)
      : undefined) ?? worlds[0];
  const suggestedWorld = useMemo(
    () => getSuggestedWorld(worlds, recentResults),
    [worlds, recentResults],
  );
  const focusDays = countFocusDays(recentResults);
  const completedCount = recentResults.filter((result) =>
    Boolean(result.details?.completed ?? result.details?.won ?? result.score > 0),
  ).length;

  const select = useCallback(
    (index: number) => {
      const next = Math.min(Math.max(index, 0), Math.max(count - 1, 0));
      setInternalSelectedIndex(next);
      const nextGameId = worlds[next]?.gameId;
      if (nextGameId) {
        onSelectedGameIdChange?.(nextGameId);
      }
    },
    [count, onSelectedGameIdChange, worlds],
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

  const selectSuggestedWorld = () => {
    if (!suggestedWorld) return;
    const next = worlds.findIndex(
      (world) => world.gameId === suggestedWorld.gameId,
    );
    select(Math.max(next, 0));
  };

  if (!selected) return null;

  return (
    <div className="lab3d-root">
      {/* Cozy library/workshop atmosphere behind the transparent Canvas. Pure
          CSS gradients + an SVG ambience layer (with a webp upgrade slot), so
          the 3D worlds composite over a warm room instead of a flat fill. */}
      <div className="lab3d-atmosphere" aria-hidden />

      <div className="lab3d-scene">
        <WorldSelectorScene
          worlds={worlds.map((entry) => entry.world)}
          selectedIndex={clampedIndex}
          reducedMotion={reducedMotion}
          onSelect={select}
        />
      </div>

      <div className="lab3d-overlay">
        <span className="lab3d-vignette" aria-hidden />

        {/* Ornate carved sign crowning the stage (desktop top-centre; hidden on
            mobile, where the compact caption inside the dock is used instead). */}
        <div className="lab3d-plaque" aria-hidden>
          <span className="lab3d-plaque-medallion" aria-hidden>
            <Compass className="h-6 w-6" strokeWidth={2} aria-hidden />
          </span>
          <span className="lab3d-plaque-text">Escolha seu mundo de treino</span>
        </div>

        <header className="lab3d-topbar">
          <span className="lab3d-brand">
            <span className="lab3d-brandmark" aria-hidden>
              <Brain className="h-6 w-6" strokeWidth={2.2} />
            </span>
            <span className="lab3d-brand-text">
              <strong>MindFlow</strong>
              <em>Jornada cognitiva com calma</em>
            </span>
          </span>

          <span className="lab3d-hud-tokens" aria-label="Resumo da jornada">
            <span className="lab3d-hud-token">
              <Star className="h-5 w-5" aria-hidden />
              <strong>{completedCount}</strong>
              <em>Conquistas</em>
            </span>
            <span className="lab3d-hud-token">
              <Flame className="h-5 w-5" aria-hidden />
              <strong>{focusDays}</strong>
              <em>Dias de foco</em>
            </span>
            <span className="lab3d-profile-token">
              <span>N</span>
              <em>Explore com calma</em>
            </span>
            <button
              type="button"
              className="lab3d-settings"
              aria-label="Configurações"
            >
              <Settings className="h-5 w-5" aria-hidden />
            </button>
          </span>
        </header>

        <section className="lab3d-hero-copy" aria-labelledby="home-3d-title">
          <p className="lab3d-kicker">
            <Sparkles className="h-5 w-5" aria-hidden />
            Mundo de treino 3D
          </p>
          <h1 id="home-3d-title" className="lab3d-headline">
            Sua mente é seu maior superpoder.
          </h1>
          <p className="lab3d-subtitle">
            Treine com calma. Avance no seu ritmo.
          </p>
          <button
            type="button"
            className="lab3d-continue"
            onClick={() => continueWorld && onEnter(continueWorld.activity)}
            disabled={!continueWorld}
          >
            <Play className="h-7 w-7 fill-current" aria-hidden />
            {lastResult ? "Continuar jornada" : "Começar jornada"}
          </button>
          <p className="lab3d-continue-hint">
            {lastResult && continueWorld
              ? `Último treino: ${continueWorld.name} · ${formatPlayedAt(lastResult.playedAt)}`
              : "Comece pela estação Circuito de Memória."}
          </p>
          {statusMessage && (
            <p className="lab3d-save-notice" role="status" aria-live="polite">
              {statusMessage}. Jornada atualizada.
            </p>
          )}
        </section>

        <div className="lab3d-bottom">
          <div className="lab3d-world-sign" aria-hidden>
            Escolha seu mundo de treino
          </div>
          <div className="lab3d-dock">
          <section className="lab3d-panel" aria-live="polite">
            <p className="lab3d-eyebrow">
              Estação {clampedIndex + 1} de {count}
            </p>
            <h2 className="lab3d-world-name">{selected.name}</h2>
            <p className="lab3d-world-desc">{selected.purpose}</p>
            <p className="lab3d-world-skill">{selected.skill}</p>
            {suggestedWorld && (
              <button
                type="button"
                className="lab3d-suggestion"
                onClick={selectSuggestedWorld}
              >
                <CalendarDays className="h-4 w-4" aria-hidden />
                Sugestão: {suggestedWorld.name}
              </button>
            )}
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
                    className={`lab3d-dot ${
                      index === clampedIndex ? "is-active" : ""
                    }`}
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
    </div>
  );
}
