"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
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

function SignalDots({ lit }: { lit: number }) {
  return (
    <span className="world-card-signals" aria-hidden>
      {Array.from({ length: MAX_SIGNALS }, (_, index) => (
        <span key={index} className={index < lit ? "is-lit" : ""} />
      ))}
    </span>
  );
}

/**
 * Cognitive World Shelf: five tactile mini-world entries. The card surface
 * selects/focuses a world; the explicit "Entrar" button starts the game.
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

  const stepSelection = (delta: number) => {
    moveFocusTo(selectedIndex + delta);
  };

  return (
    <div className="world-shelf-region game-world-shelf">
      <button
        type="button"
        className="shelf-arrow"
        aria-label="Estação anterior"
        disabled={selectedIndex === 0}
        onClick={() => stepSelection(-1)}
      >
        <ChevronLeft strokeWidth={2.8} aria-hidden />
      </button>

      <div
        role="tablist"
        aria-label="Mundos de treino"
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
            <motion.article
              key={activity.id}
              className={`world-diorama-card world-tone-${meta.world} ${
                isSelected ? "is-selected" : ""
              }`}
              initial={reducedMotion ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-30px" }}
              transition={{ duration: 0.32, delay: index * 0.035 }}
            >
              <span className="world-piece-shadow" aria-hidden />
              <span className="world-object-aura" aria-hidden />
              <span className="world-piece-backplate" aria-hidden />
              <button
                ref={(el) => {
                  tabRefs.current[index] = el;
                }}
                type="button"
                role="tab"
                id={`world-tab-${activity.id}`}
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => selectIndex(index)}
                className="world-stage-tab"
              >
                <span className="world-art-shell" aria-hidden>
                  <span className="world-card-media">
                    <Image
                      src={meta.image}
                      alt=""
                      fill
                      sizes="(max-width: 767px) 82vw, (max-width: 1279px) 28vw, 17vw"
                      className="world-card-image"
                    />
                    <span className="world-card-inner-frame" />
                    <span className="world-card-glow" />
                    <span className="world-number-medal">{index + 1}</span>
                    {best === 0 && <span className="world-new-ribbon">Novo</span>}
                  </span>
                </span>
                <span className="world-card-body world-pedestal-deck">
                  <span className="world-title-plaque">
                    <span className="world-card-title">{meta.name}</span>
                  </span>
                  <span className="world-card-copy">
                    {meta.purpose}
                  </span>
                  <span className="world-card-meta-row">
                    {best > 0 ? (
                      <span className="world-card-progress">
                        <SignalDots lit={best} />
                        <span className="sr-only">
                          Melhor resultado: {best} de {MAX_SIGNALS} sinais.
                        </span>
                      </span>
                    ) : (
                      <span className="world-card-skill">{meta.skill}</span>
                    )}
                  </span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => onSelect(activity)}
                aria-label={`Entrar em ${meta.name}`}
                className="world-enter-button"
              >
                <Play className="h-5 w-5 fill-current" aria-hidden />
                Entrar
              </button>
              <span className="world-piece-foot" aria-hidden />
            </motion.article>
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
        <ChevronRight strokeWidth={2.8} aria-hidden />
      </button>

      {selected?.gameId && (
        <p className="world-shelf-status" aria-live="polite">
          Mundo selecionado: {getWorldMeta(selected.gameId).name}. Use Entrar
          para iniciar.
        </p>
      )}
    </div>
  );
}
