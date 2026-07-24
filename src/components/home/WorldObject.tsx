"use client";

import type { CSSProperties } from "react";
import Image from "next/image";
import { Play } from "lucide-react";
import type { Activity, GameId } from "@/types/game";
import type { WorldKey } from "@/data/worlds";
import { getWorldVisual } from "@/components/worlds/worldVisuals";
import { WorldMasterScene } from "@/components/worlds/master-scene/WorldMasterScene";
import { hasWorldMasterScene } from "@/components/worlds/master-scene/worldMasterSceneConfig";
import type { HomeWorldLayout } from "./homeLayout";

export interface HomeWorldEntry {
  activity: Activity;
  gameId: GameId;
  world: WorldKey;
  name: string;
  skill: string;
  purpose: string;
}

interface WorldObjectProps {
  entry: HomeWorldEntry;
  layout: HomeWorldLayout;
  offset: number;
  selected: boolean;
  disabled?: boolean;
  setNode: (node: HTMLDivElement | null) => void;
  onSelect: () => void;
  onEnter: () => void;
}

function getOffsetClass(offset: number) {
  if (offset < 0) {
    return `hj-world-offset-neg-${Math.abs(offset)}`;
  }

  return `hj-world-offset-pos-${offset}`;
}

export function WorldObject({
  entry,
  layout,
  offset,
  selected,
  disabled = false,
  setNode,
  onSelect,
  onEnter,
}: WorldObjectProps) {
  const visual = getWorldVisual(entry.gameId);
  const usesMasterScene = hasWorldMasterScene(entry.gameId);
  /**
   * Layered dioramas are complete transparent maquettes and must keep their
   * real silhouette; only the flat baked-background heroes still need the
   * cover + ellipse-mask treatment from `.hj-world-art-rendered`.
   */
  const artModeClass = usesMasterScene
    ? "hj-world-art-diorama"
    : `hj-world-art-${visual.artMode}`;
  const style = {
    "--hj-size": `${layout.desktop.sizeRem}rem`,
    "--hj-mobile-order": layout.mobileOrder,
    "--hj-world-accent": visual.accent,
    "--hj-world-glow": visual.accentSoft,
    "--hj-world-plaque": visual.accentDeep,
    "--wms-accent": visual.accent,
    "--wms-accent-soft": visual.accentSoft,
    "--wms-accent-deep": visual.accentDeep,
  } as CSSProperties;

  const selectOrEnter = () => {
    if (selected) {
      onEnter();
      return;
    }

    onSelect();
  };

  return (
    <div
      ref={setNode}
      className={[
        "hj-world-object",
        `hj-world-${layout.kind}`,
        `hj-world-${layout.tier}`,
        artModeClass,
        getOffsetClass(offset),
        selected ? "hj-world-selected" : "",
      ].join(" ")}
      style={style}
      aria-current={selected ? "true" : undefined}
    >
      <button
        type="button"
        className="hj-world-select"
        aria-label={
          selected
            ? `Entrar em ${visual.visualName}`
            : `Selecionar ${visual.visualName}`
        }
        disabled={disabled}
        onClick={selectOrEnter}
        onFocus={onSelect}
        onPointerEnter={onSelect}
      >
        <span className="hj-world-shadow" aria-hidden="true" />
        <span className="hj-world-aura" aria-hidden="true" />
        <span className="hj-world-diorama" aria-hidden="true">
          <span className="hj-world-art">
            {hasWorldMasterScene(entry.gameId) ? (
              <WorldMasterScene
                gameId={entry.gameId}
                context="home"
                state={selected ? "focused" : "idle"}
                sizes={
                  selected
                    ? "(max-width: 899px) 82vw, 34rem"
                    : "(max-width: 899px) 66vw, 20rem"
                }
              />
            ) : (
              <Image
                className="hj-world-sprite"
                src={visual.homeArt}
                alt=""
                width={visual.artMode === "rendered" ? 1040 : 720}
                height={visual.artMode === "rendered" ? 780 : 560}
                sizes={
                  selected
                    ? "(max-width: 899px) 82vw, 34rem"
                    : "(max-width: 899px) 66vw, 20rem"
                }
                priority={layout.tier === "hero"}
                draggable={false}
              />
            )}
          </span>
        </span>
      </button>

      <div className="hj-world-plaque wms-plate">
        <span className="hj-world-copy">
          <strong>{visual.visualName}</strong>
          <span>{visual.homeDescription}</span>
        </span>
        {selected ? (
          <button
            type="button"
            className="hj-world-enter wms-button-primary"
            onClick={onEnter}
            aria-label={`Entrar em ${visual.visualName}`}
            disabled={disabled}
            data-world-entry-return="true"
          >
            <Play size={17} fill="currentColor" aria-hidden="true" />
            Entrar
          </button>
        ) : null}
      </div>

      <span className="hj-world-sr-detail">{entry.skill}</span>
    </div>
  );
}
