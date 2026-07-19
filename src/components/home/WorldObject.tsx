"use client";

import type { CSSProperties } from "react";
import {
  Hash,
  Map,
  Play,
  SlidersHorizontal,
  Sparkles,
  Sprout,
} from "lucide-react";
import type { Activity, GameId } from "@/types/game";
import type { WorldKey } from "@/data/worlds";
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
  selected: boolean;
  onPreview: () => void;
  onEnter: () => void;
}

const WORLD_ICONS = {
  route: Map,
  memory: Sparkles,
  commands: SlidersHorizontal,
  logic: Hash,
  garden: Sprout,
} as const;

export function WorldObject({
  entry,
  layout,
  selected,
  onPreview,
  onEnter,
}: WorldObjectProps) {
  const Icon = WORLD_ICONS[layout.kind];
  const style = {
    "--hj-x": `${layout.desktop.x}%`,
    "--hj-y": `${layout.desktop.y}%`,
    "--hj-size": `${layout.desktop.sizeRem}rem`,
    "--hj-mobile-order": layout.mobileOrder,
  } as CSSProperties;

  return (
    <button
      type="button"
      className={[
        "hj-world-object",
        `hj-world-${layout.kind}`,
        `hj-world-${layout.tier}`,
        selected ? "hj-world-selected" : "",
      ].join(" ")}
      style={style}
      aria-label={`Entrar em ${layout.title}`}
      aria-current={selected ? "true" : undefined}
      onClick={onEnter}
      onFocus={onPreview}
      onPointerEnter={onPreview}
    >
      <span className="hj-world-shadow" aria-hidden="true" />
      <span className="hj-world-aura" aria-hidden="true" />
      <span className="hj-world-diorama" aria-hidden="true">
        <span className="hj-world-dish">
          <span className="hj-world-rim" />
          <span className="hj-world-scene">
            <span className="hj-world-icon">
              <Icon size={34} strokeWidth={2.4} />
            </span>
            <span className="hj-world-prop hj-world-prop-a" />
            <span className="hj-world-prop hj-world-prop-b" />
            <span className="hj-world-prop hj-world-prop-c" />
            <span className="hj-world-line hj-world-line-a" />
            <span className="hj-world-line hj-world-line-b" />
          </span>
        </span>
      </span>
      <span className="hj-world-plaque">
        <span className="hj-world-number">{layout.navOrder}</span>
        <span className="hj-world-copy">
          <strong>{layout.title}</strong>
          <span>{layout.description}</span>
        </span>
        <span className="hj-world-enter">
          <Play size={16} fill="currentColor" aria-hidden="true" />
          Entrar
        </span>
      </span>
      <span className="hj-world-sr-detail">{entry.skill}</span>
    </button>
  );
}
