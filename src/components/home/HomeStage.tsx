"use client";

import type { KeyboardEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Activity, GameId, GameResult } from "@/types/game";
import { HomeGreeting } from "./HomeGreeting";
import { getWorldVisual } from "@/components/worlds/worldVisuals";
import { HOME_WORLD_LAYOUT, getHomeWorldLayout } from "./homeLayout";
import { WorldObject, type HomeWorldEntry } from "./WorldObject";

interface HomeStageProps {
  worlds: HomeWorldEntry[];
  recentResults: GameResult[];
  selectedGameId: GameId | null;
  statusMessage?: string | null;
  isEntering?: boolean;
  onSelectedGameIdChange: (gameId: GameId) => void;
  onEnter: (activity: Activity) => void;
}

function sortWorlds(a: HomeWorldEntry, b: HomeWorldEntry) {
  return HOME_WORLD_LAYOUT[a.gameId].navOrder - HOME_WORLD_LAYOUT[b.gameId].navOrder;
}

function getCircularOffset(index: number, activeIndex: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  let offset = index - activeIndex;
  const half = Math.floor(total / 2);

  if (offset > half) {
    offset -= total;
  }

  if (offset < -half) {
    offset += total;
  }

  return offset;
}

export function HomeStage({
  worlds,
  recentResults,
  selectedGameId,
  statusMessage,
  isEntering = false,
  onSelectedGameIdChange,
  onEnter,
}: HomeStageProps) {
  const orderedWorlds = useMemo(
    () => worlds.filter((world) => HOME_WORLD_LAYOUT[world.gameId]).sort(sortWorlds),
    [worlds],
  );

  const recentResult = recentResults[0];
  const initialGameId =
    selectedGameId ??
    recentResult?.gameId ??
    orderedWorlds.find((world) => world.gameId === "escape-maze")?.gameId ??
    orderedWorlds[0]?.gameId ??
    null;

  const [internalSelectedGameId, setInternalSelectedGameId] =
    useState<GameId | null>(initialGameId);
  const worldRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const activeGameId = selectedGameId ?? internalSelectedGameId ?? initialGameId;
  const activeWorld =
    orderedWorlds.find((world) => world.gameId === activeGameId) ?? orderedWorlds[0];
  const activeIndex = Math.max(
    0,
    orderedWorlds.findIndex((world) => world.gameId === activeWorld?.gameId),
  );

  const selectWorld = (gameId: GameId) => {
    if (isEntering) return;
    setInternalSelectedGameId(gameId);
    onSelectedGameIdChange(gameId);
  };

  const selectWorldAt = (index: number) => {
    const total = orderedWorlds.length;

    if (total === 0) {
      return;
    }

    const nextIndex = (index + total) % total;
    selectWorld(orderedWorlds[nextIndex].gameId);
  };

  const enterWorld = (entry: HomeWorldEntry) => {
    if (isEntering) return;
    selectWorld(entry.gameId);
    onEnter(entry.activity);
  };

  useEffect(() => {
    if (!activeWorld) {
      return;
    }

    const activeNode = worldRefs.current[activeWorld.gameId];

    if (!activeNode || !window.matchMedia("(max-width: 899px)").matches) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    activeNode.scrollIntoView({
      behavior: prefersReducedMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [activeWorld]);

  const handleStageKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (isEntering) return;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectWorldAt(activeIndex - 1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      selectWorldAt(activeIndex + 1);
      return;
    }

    if (event.key === "Enter" && event.target === event.currentTarget && activeWorld) {
      event.preventDefault();
      enterWorld(activeWorld);
    }
  };

  return (
    <section
      className="hj-stage"
      aria-labelledby="hj-home-title"
      tabIndex={0}
      onKeyDown={handleStageKeyDown}
      aria-busy={isEntering}
      inert={isEntering ? true : undefined}
      data-entering={isEntering ? "true" : undefined}
    >
      <div className="hj-atmosphere" aria-hidden="true">
        <span className="hj-haze hj-haze-a" />
        <span className="hj-light hj-light-a" />
        <span className="hj-light hj-light-b" />
      </div>

      <HomeGreeting statusMessage={statusMessage} />

      <div className="hj-explorer" aria-hidden="true">
        <Image
          className="hj-explorer-sprite"
          src="/illustrations/home/explorer-marker.webp"
          alt=""
          width={360}
          height={430}
          sizes="(max-width: 899px) 4.5rem, 6rem"
          priority
          draggable={false}
        />
      </div>

      <div className="hj-world-field" aria-label="Galeria de mundos">
        {orderedWorlds.map((entry, index) => {
          const layout = getHomeWorldLayout(entry.gameId);
          const offset = getCircularOffset(index, activeIndex, orderedWorlds.length);
          return (
            <WorldObject
              key={entry.gameId}
              entry={entry}
              layout={layout}
              offset={offset}
              selected={entry.gameId === activeWorld?.gameId}
              disabled={isEntering}
              setNode={(node) => {
                worldRefs.current[entry.gameId] = node;
              }}
              onSelect={() => selectWorld(entry.gameId)}
              onEnter={() => enterWorld(entry)}
            />
          );
        })}
      </div>

      <nav className="hj-gallery-controls" aria-label="Navegar pelos mundos">
        <button
          type="button"
          className="hj-gallery-arrow"
          onClick={() => selectWorldAt(activeIndex - 1)}
          aria-label="Ver mundo anterior"
          disabled={isEntering}
        >
          <ChevronLeft size={25} aria-hidden="true" />
        </button>
        <div className="hj-gallery-pips" aria-label="Mundos">
          {orderedWorlds.map((entry) => {
            const visual = getWorldVisual(entry.gameId);
            const selected = entry.gameId === activeWorld?.gameId;
            return (
              <button
                key={entry.gameId}
                type="button"
                className={
                  selected ? "hj-gallery-pip hj-gallery-pip-active" : "hj-gallery-pip"
                }
                onClick={() => selectWorld(entry.gameId)}
                aria-label={`Selecionar ${visual.visualName}`}
                aria-current={selected ? "true" : undefined}
                disabled={isEntering}
              />
            );
          })}
        </div>
        <button
          type="button"
          className="hj-gallery-arrow"
          onClick={() => selectWorldAt(activeIndex + 1)}
          aria-label="Ver próximo mundo"
          disabled={isEntering}
        >
          <ChevronRight size={25} aria-hidden="true" />
        </button>
      </nav>
    </section>
  );
}
