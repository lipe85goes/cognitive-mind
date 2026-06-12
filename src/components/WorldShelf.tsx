"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { GAME_INTROS } from "@/data/game-intros";
import { getWorldMeta } from "@/data/worlds";
import {
  getBestActivationSignalsForGame,
  PLAYABLE_STAGE_IDS,
} from "@/engine/stage-progress";
import type { Activity, GameId, GameResult } from "@/types/game";

const MAX_SIGNALS = 3;

interface WorldShelfProps {
  activities: Activity[];
  recentResults: GameResult[];
  selectedGameId?: GameId | null;
  onSelectedGameIdChange?: (gameId: GameId) => void;
  onSelect: (activity: Activity) => void;
}

function SignalDots({ lit, className }: { lit: number; className: string }) {
  return (
    <span className={className} aria-hidden>
      {Array.from({ length: MAX_SIGNALS }, (_, index) => (
        <span key={index} className={index < lit ? "is-lit" : ""} />
      ))}
    </span>
  );
}

/**
 * Cognitive World Shelf: a tactile row of world tiles (WAI-ARIA tabs) plus a
 * featured detail panel for the selected world. Browsing never starts a game —
 * only the explicit "Iniciar desafio" button does.
 */
export function WorldShelf({
  activities,
  recentResults,
  selectedGameId,
  onSelectedGameIdChange,
  onSelect,
}: WorldShelfProps) {
  const reducedMotion = useReducedMotion();
  const [internalSelectedIndex, setInternalSelectedIndex] = useState(0);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const byId = Object.fromEntries(
    activities.map((activity) => [activity.id, activity]),
  );
  const worlds = PLAYABLE_STAGE_IDS.map((id) => byId[id]).filter(Boolean);
  const controlledIndex = selectedGameId
    ? worlds.findIndex((activity) => activity.gameId === selectedGameId)
    : -1;
  const selectedIndex =
    controlledIndex >= 0
      ? controlledIndex
      : Math.min(internalSelectedIndex, Math.max(worlds.length - 1, 0));
  const selected = worlds[selectedIndex];

  const selectIndex = (index: number) => {
    const next = Math.min(Math.max(index, 0), worlds.length - 1);
    const nextGameId = worlds[next]?.gameId;

    setInternalSelectedIndex(next);
    if (nextGameId) {
      onSelectedGameIdChange?.(nextGameId);
    }
  };

  const stepSelection = (delta: number) => {
    selectIndex(selectedIndex + delta);
  };

  /** Roving tabindex: arrows move both selection and focus inside the shelf. */
  const moveFocusTo = (index: number) => {
    const next = Math.min(Math.max(index, 0), worlds.length - 1);
    selectIndex(next);
    tabRefs.current[next]?.focus();
  };

  const handleTablistKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      moveFocusTo(selectedIndex + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      moveFocusTo(selectedIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      moveFocusTo(0);
    } else if (event.key === "End") {
      event.preventDefault();
      moveFocusTo(worlds.length - 1);
    }
  };

  const selectedMeta = selected
    ? getWorldMeta(selected.gameId ?? selected.id)
    : null;
  const selectedIntro = selected?.gameId ? GAME_INTROS[selected.gameId] : null;
  const selectedBest =
    selected?.gameId !== undefined
      ? getBestActivationSignalsForGame(recentResults, selected.gameId)
      : 0;

  return (
    <div className="world-shelf-region min-w-0">
      <div className="world-shelf">
        <button
          type="button"
          className="shelf-arrow"
          aria-label="Estação anterior"
          disabled={selectedIndex === 0}
          onClick={() => stepSelection(-1)}
        >
          <ChevronLeft strokeWidth={2.6} aria-hidden />
        </button>

        <div
          role="tablist"
          aria-label="Estações cognitivas"
          className="shelf-track"
          onKeyDown={handleTablistKeyDown}
        >
          {worlds.map((activity, index) => {
            const meta = getWorldMeta(activity.gameId ?? activity.id);
            const best = activity.gameId
              ? getBestActivationSignalsForGame(recentResults, activity.gameId)
              : 0;
            const isSelected = index === selectedIndex;

            return (
              <button
                key={activity.id}
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                type="button"
                role="tab"
                id={`world-tab-${activity.id}`}
                aria-selected={isSelected}
                aria-controls="world-detail"
                tabIndex={isSelected ? 0 : -1}
                onClick={() => selectIndex(index)}
                className={`shelf-tile world-tone-${meta.world} ${
                  isSelected ? "is-selected" : ""
                }`}
              >
                <span className="shelf-tile-media" aria-hidden="true">
                  <Image
                    src={meta.image}
                    alt=""
                    fill
                    sizes="(max-width: 767px) 30vw, 11vw"
                    className="shelf-tile-image"
                  />
                </span>
                <span className="shelf-tile-number">Estação {index + 1}</span>
                <span className="shelf-tile-name">{meta.name}</span>
                {best > 0 ? (
                  <>
                    <SignalDots lit={best} className="shelf-tile-signals" />
                    <span className="sr-only">
                      Visitada. Melhor resultado: {best} de {MAX_SIGNALS}{" "}
                      sinais.
                    </span>
                  </>
                ) : (
                  <span className="shelf-tile-new">Nova</span>
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="shelf-arrow"
          aria-label="Próxima estação"
          disabled={selectedIndex === worlds.length - 1}
          onClick={() => stepSelection(1)}
        >
          <ChevronRight strokeWidth={2.6} aria-hidden />
        </button>
      </div>

      {selected && selectedMeta && (
        <div
          role="tabpanel"
          id="world-detail"
          aria-labelledby={`world-tab-${selected.id}`}
          aria-live="polite"
          className={`featured-world world-tone-${selectedMeta.world}`}
        >
          <motion.div
            key={selected.id}
            className="featured-grid"
            initial={reducedMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: "easeOut" }}
          >
            <div className="featured-media" aria-hidden="true">
              <Image
                src={selectedMeta.image}
                alt=""
                fill
                sizes="(max-width: 767px) calc(100vw - 2rem), 38vw"
                className="featured-image"
              />
              <span className="featured-badge">
                Estação {selectedIndex + 1}
              </span>
            </div>

            <div className="featured-body">
              <p className="featured-status">
                {selectedBest > 0 ? "Estação visitada" : "Nova estação"}
              </p>
              <h3 className="featured-title">{selectedMeta.name}</h3>
              <p className="featured-description">
                {selectedIntro?.description ?? selectedMeta.purpose}
              </p>

              <div className="featured-skill">
                <p>O que treina</p>
                <strong>{selectedMeta.skill}</strong>
              </div>

              {selectedBest > 0 && (
                <p className="featured-progress">
                  <SignalDots
                    lit={selectedBest}
                    className="featured-progress-dots"
                  />
                  Melhor resultado: {selectedBest} de {MAX_SIGNALS} sinais
                </p>
              )}

              <div className="featured-cta">
                <button
                  type="button"
                  onClick={() => onSelect(selected)}
                  aria-label={`Iniciar desafio: ${selectedMeta.name}`}
                  className="btn-primary featured-start flex w-full items-center justify-center gap-2 text-lg"
                >
                  <Play className="h-6 w-6 fill-current" aria-hidden />
                  Iniciar desafio
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
