"use client";

import { useMemo, useState } from "react";
import { Play, Sparkles } from "lucide-react";
import { formatPlayedAt } from "@/engine/storage";
import type { Activity, GameId, GameResult } from "@/types/game";
import { HomeGreeting } from "./HomeGreeting";
import {
  HOME_WORLD_LAYOUT,
  getHomeWorldLayout,
  type HomeWorldLayout,
} from "./homeLayout";
import { WorldObject, type HomeWorldEntry } from "./WorldObject";

interface HomeStageProps {
  worlds: HomeWorldEntry[];
  recentResults: GameResult[];
  selectedGameId: GameId | null;
  statusMessage?: string | null;
  onSelectedGameIdChange: (gameId: GameId) => void;
  onEnter: (activity: Activity) => void;
}

function sortWorlds(a: HomeWorldEntry, b: HomeWorldEntry) {
  return HOME_WORLD_LAYOUT[a.gameId].navOrder - HOME_WORLD_LAYOUT[b.gameId].navOrder;
}

export function HomeStage({
  worlds,
  recentResults,
  selectedGameId,
  statusMessage,
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

  const activeGameId = selectedGameId ?? internalSelectedGameId ?? initialGameId;
  const activeWorld =
    orderedWorlds.find((world) => world.gameId === activeGameId) ?? orderedWorlds[0];
  const activeLayout: HomeWorldLayout | null = activeWorld
    ? getHomeWorldLayout(activeWorld.gameId)
    : null;

  const lastWorld = recentResult
    ? orderedWorlds.find((world) => world.gameId === recentResult.gameId)
    : undefined;

  const selectWorld = (gameId: GameId) => {
    setInternalSelectedGameId(gameId);
    onSelectedGameIdChange(gameId);
  };

  const enterWorld = (entry: HomeWorldEntry) => {
    selectWorld(entry.gameId);
    onEnter(entry.activity);
  };

  return (
    <section className="hj-stage" aria-labelledby="hj-home-title">
      <div className="hj-atmosphere" aria-hidden="true">
        <span className="hj-haze hj-haze-a" />
        <span className="hj-haze hj-haze-b" />
        <span className="hj-plane hj-plane-back" />
        <span className="hj-plane hj-plane-front" />
        <span className="hj-light hj-light-a" />
        <span className="hj-light hj-light-b" />
      </div>

      <HomeGreeting recentResult={recentResult} statusMessage={statusMessage} />

      <div className="hj-explorer" aria-hidden="true">
        <span className="hj-explorer-glow" />
        <span className="hj-explorer-body" />
        <span className="hj-explorer-head" />
        <span className="hj-explorer-shadow" />
      </div>

        <div className="hj-world-field" aria-label="Mundos disponíveis">
        {orderedWorlds.map((entry) => {
          const layout = getHomeWorldLayout(entry.gameId);
          return (
            <WorldObject
              key={entry.gameId}
              entry={entry}
              layout={layout}
              selected={entry.gameId === activeWorld?.gameId}
              onPreview={() => selectWorld(entry.gameId)}
              onEnter={() => enterWorld(entry)}
            />
          );
        })}
      </div>

      {activeWorld && activeLayout ? (
        <aside
          className={`hj-world-panel hj-world-panel-${activeLayout.kind}`}
          aria-live="polite"
        >
          <p className="hj-panel-kicker">
            <Sparkles size={15} aria-hidden="true" />
            Mundo em foco
          </p>
          <h2>{activeLayout.title}</h2>
          <p>{activeLayout.description}</p>
          {lastWorld ? (
            <p className="hj-panel-memory">
              Último treino: {lastWorld.name} em {formatPlayedAt(recentResult.playedAt)}
            </p>
          ) : null}
          <button
            type="button"
            className="hj-panel-enter"
            onClick={() => enterWorld(activeWorld)}
            aria-label={`Entrar em ${activeLayout.title}`}
          >
            <Play size={18} fill="currentColor" aria-hidden="true" />
            Entrar
          </button>
        </aside>
      ) : null}
    </section>
  );
}
