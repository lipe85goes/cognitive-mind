"use client";

import { useEffect, useRef } from "react";
import { WorldDiorama } from "@/components/worlds/diorama/WorldDiorama";
import {
  getWorldMasterSceneConfig,
  getWorldMasterSceneStyle,
  type MasterSceneGameId,
  type WorldMasterSceneContext,
  type WorldMasterSceneState,
} from "./worldMasterSceneConfig";
import "./world-master-scene.css";

interface WorldMasterSceneProps {
  gameId: MasterSceneGameId;
  context: WorldMasterSceneContext;
  state?: WorldMasterSceneState;
  sizes?: string;
  className?: string;
  decorative?: boolean;
  priority?: boolean;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export function WorldMasterScene({
  gameId,
  context,
  state = "idle",
  sizes = "(max-width: 899px) 92vw, 48rem",
  className,
  decorative = true,
  priority = false,
  onReady,
  onError,
}: WorldMasterSceneProps) {
  const config = getWorldMasterSceneConfig(gameId);
  const readyReportedRef = useRef(false);

  useEffect(() => {
    if (!onReady || readyReportedRef.current) {
      return;
    }

    let cancelled = false;
    let firstFrame = 0;
    let settledFrame = 0;

    const loadAsset = (src: string) =>
      new Promise<void>((resolve, reject) => {
        const image = new window.Image();
        image.onload = async () => {
          try {
            await image.decode?.();
            resolve();
          } catch {
            resolve();
          }
        };
        image.onerror = () =>
          reject(new Error(`Failed to load master-scene asset: ${src}`));
        image.src = src;
      });

    Promise.all(config.essentialAssets.map(loadAsset))
      .then(() => {
        if (cancelled) return;
        firstFrame = window.requestAnimationFrame(() => {
          settledFrame = window.requestAnimationFrame(() => {
            if (cancelled || readyReportedRef.current) return;
            readyReportedRef.current = true;
            onReady();
          });
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        onError?.(
          error instanceof Error
            ? error
            : new Error(`Failed to prepare ${config.world} master scene.`),
        );
      });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(firstFrame);
      window.cancelAnimationFrame(settledFrame);
    };
  }, [config, onError, onReady]);

  return (
    <span
      className={["wms-scene", className ?? ""].join(" ")}
      data-world={config.world}
      data-context={context}
      data-state={state}
      data-focal={config.focalElement}
      style={getWorldMasterSceneStyle(gameId, context)}
      aria-hidden={decorative ? true : undefined}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : config.accessibleLabel}
    >
      <span className="wms-scene-ground" aria-hidden="true" />
      <span className="wms-scene-crop">
        {/* HOME-HERO-WORLDS-3D-01: um renderer só. Home, transição,
            introdução e preparação leem a mesma maquete em camadas do
            mundo — o board do Circuito continua sendo o artefato oficial,
            agora assentado na sua ilha. */}
        <WorldDiorama
          gameId={gameId}
          state={state}
          variant={context === "transition" ? "transition" : "home"}
          sizes={sizes}
          className="wms-world-diorama"
          eager={priority || state !== "idle"}
        />
      </span>
    </span>
  );
}
