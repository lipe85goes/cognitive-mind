"use client";

import type { CSSProperties } from "react";
import type { GameId } from "@/types/game";
import { getWorldVisual } from "@/components/worlds/worldVisuals";
import { WorldDioramaLayer } from "./WorldDioramaLayer";
import {
  getWorldDioramaConfig,
  hasWorldDiorama,
  type WorldDioramaState,
} from "./worldDioramaLayout";
import "./world-diorama.css";

interface WorldDioramaProps {
  gameId: GameId;
  state?: WorldDioramaState;
  variant?: "home" | "transition";
  sizes?: string;
  className?: string;
}

export function WorldDiorama({
  gameId,
  state = "idle",
  variant = "home",
  sizes = "(max-width: 899px) 88vw, 36rem",
  className,
}: WorldDioramaProps) {
  if (!hasWorldDiorama(gameId)) {
    return null;
  }

  const config = getWorldDioramaConfig(gameId);
  const visual = getWorldVisual(gameId);
  const style = {
    "--wd-accent": visual.accent,
    "--wd-accent-soft": visual.accentSoft,
    "--wd-accent-deep": visual.accentDeep,
  } as CSSProperties;

  return (
    <span
      className={["wd-shell", className ?? ""].join(" ")}
      data-world={config.kind}
      data-state={state}
      data-variant={variant}
      style={style}
      aria-hidden="true"
    >
      <span className="wd-stage">
        <span className="wd-depth-plane" />
        {config.layers.map((layer) => (
          <WorldDioramaLayer
            key={layer.id}
            layer={layer}
            sizes={sizes}
          />
        ))}
      </span>
    </span>
  );
}
