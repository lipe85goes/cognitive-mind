"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { WorldDiorama } from "@/components/worlds/diorama/WorldDiorama";
import {
  CIRCUIT_MASTER_ASSETS,
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
        {config.renderer === "route-diorama" ? (
          <WorldDiorama
            gameId={gameId}
            state={state}
            variant={context === "transition" ? "transition" : "home"}
            sizes={sizes}
            className="wms-route-diorama"
          />
        ) : (
          <span className="wms-circuit-stack" aria-hidden="true">
            <Image
              src={CIRCUIT_MASTER_ASSETS.board}
              alt=""
              fill
              sizes={sizes}
              className="wms-circuit-board"
              priority={priority}
              draggable={false}
            />
            {CIRCUIT_MASTER_ASSETS.pads.map((src, index) => (
              <Image
                key={src}
                src={src}
                alt=""
                fill
                sizes={sizes}
                className="wms-circuit-overlay wms-circuit-pad"
                data-pad={index}
                priority={priority && context === "transition"}
                draggable={false}
              />
            ))}
            <Image
              src={CIRCUIT_MASTER_ASSETS.core}
              alt=""
              fill
              sizes={sizes}
              className="wms-circuit-overlay wms-circuit-core"
              priority={priority}
              draggable={false}
            />
          </span>
        )}
      </span>
    </span>
  );
}
