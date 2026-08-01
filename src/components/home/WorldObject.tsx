"use client";

import type { CSSProperties } from "react";
import { Play } from "lucide-react";
import type { Activity, GameId } from "@/types/game";
import type { WorldKey } from "@/data/worlds";
import { getWorldVisual } from "@/components/worlds/worldVisuals";
import { WorldEmblem } from "@/components/worlds/WorldEmblem";
import { WorldDiorama } from "@/components/worlds/diorama/WorldDiorama";
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
  /**
   * Todos os mundos são maquetes transparentes em camadas e mantêm a
   * silhueta real: nenhum recebe máscara de elipse ou moldura.
   */
  const artModeClass = "hj-world-art-diorama";
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
        /* HOME-WORLDS-FINAL-01: a seleção muda só por intenção explícita —
           clique, toque, teclado ou os controles da galeria. `pointerenter`
           foi removido: como a composição se desloca ao selecionar, o
           ponteiro parado caía sobre o vizinho e trocava o mundo sozinho.
           O foco de teclado continua selecionando, porque aí a intenção é
           do Explorador. Hover agora só eleva e acende a peça (CSS). */
        onFocus={onSelect}
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
                /* Wide enough that the optimizer never serves a soft, detail-
                   free variant — the stone, bronze and trellis must survive. */
                sizes={
                  selected
                    ? "(max-width: 899px) 92vw, 48rem"
                    : "(max-width: 899px) 74vw, 30rem"
                }
              />
            ) : (
              /* Os mundos secundários também são maquetes em camadas: mesma
                 câmera, mesma luz e sombra de contato própria. */
              <WorldDiorama
                gameId={entry.gameId}
                state={selected ? "focused" : "idle"}
                sizes={
                  selected
                    ? "(max-width: 899px) 92vw, 44rem"
                    : "(max-width: 899px) 74vw, 28rem"
                }
              />
            )}
          </span>
        </span>
      </button>

      <div className="hj-world-plaque">
        <WorldEmblem gameId={entry.gameId} className="hj-world-emblem" />
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
