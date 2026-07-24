"use client";

import { useEffect, useMemo, useRef } from "react";
import { LocateFixed } from "lucide-react";
import {
  COLS,
  posKey,
  ROWS,
  type GameStatus,
  type MazeMap,
} from "@/games/escape-maze/useEscapeMaze";
import type { GridPosition } from "@/types/game";
import type {
  RouteBabylonController,
  RouteBabylonState,
} from "@/games/escape-maze/routeBabylonScene";

interface RouteBabylonBoardProps {
  mazeMap: MazeMap;
  player: GridPosition;
  guardian: GridPosition;
  collectedSet: Set<string>;
  moveTargets: Set<string>;
  triggeredTrapSet: Set<string>;
  dangerTiles: Set<string>;
  shieldCollected: boolean;
  reducedMotion: boolean;
  status: GameStatus;
  onMove: (delta: GridPosition) => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export function RouteBabylonBoard({
  mazeMap,
  player,
  guardian,
  collectedSet,
  moveTargets,
  triggeredTrapSet,
  dangerTiles,
  shieldCollected,
  reducedMotion,
  status,
  onMove,
  onReady,
  onError,
}: RouteBabylonBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<RouteBabylonController | null>(null);
  const onMoveRef = useRef(onMove);
  const onReadyRef = useRef(onReady);
  const onErrorRef = useRef(onError);

  const state = useMemo<RouteBabylonState>(
    () => ({
      rows: ROWS,
      cols: COLS,
      walls: Array.from(mazeMap.walls),
      exitPosition: mazeMap.exitPosition,
      lights: mazeMap.collectibleStars,
      collectedKeys: Array.from(collectedSet),
      player,
      guardian,
      moveTargets: Array.from(moveTargets),
      traps: mazeMap.traps,
      triggeredTrapKeys: Array.from(triggeredTrapSet),
      shield: mazeMap.shield,
      shieldCollected,
      dangerTiles: Array.from(dangerTiles),
      reducedMotion,
      status,
    }),
    [
      mazeMap,
      player,
      guardian,
      collectedSet,
      moveTargets,
      triggeredTrapSet,
      dangerTiles,
      shieldCollected,
      reducedMotion,
      status,
    ],
  );

  const stateRef = useRef(state);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    onReadyRef.current = onReady;
    onErrorRef.current = onError;
  }, [onError, onReady]);

  useEffect(() => {
    stateRef.current = state;
    controllerRef.current?.updateBoard(state);
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    async function mountBabylon() {
      try {
        const canvas = canvasRef.current;
        if (!canvas || controllerRef.current) return;

        const [Babylon, , sceneModule] = await Promise.all([
          import("@babylonjs/core"),
          import("@babylonjs/loaders/glTF"),
          import("@/games/escape-maze/routeBabylonScene"),
        ]);
        if (cancelled || !canvasRef.current) return;

        const controller = sceneModule.createRouteBabylonController(
          Babylon,
          canvas,
          stateRef.current,
          {
            onMove: (delta) => onMoveRef.current(delta),
          },
        );
        controllerRef.current = controller;

        resizeObserver = new ResizeObserver(() => controller.resize());
        resizeObserver.observe(canvas);
        window.addEventListener("resize", controller.resize);
        controller.resize();

        await controller.ready;
        if (!cancelled) onReadyRef.current?.();
      } catch (error) {
        if (cancelled) return;
        const entryError =
          error instanceof Error
            ? error
            : new Error("Unknown error while preparing the Route scene.");
        console.error("[MindFlow] Route Babylon entry failed.", entryError);
        onErrorRef.current?.(entryError);
      }
    }

    void mountBabylon();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      const controller = controllerRef.current;
      if (controller) {
        window.removeEventListener("resize", controller.resize);
        controller.dispose();
      }
      controllerRef.current = null;
    };
  }, []);

  return (
    <div className="route-babylon-wrap">
      <canvas
        ref={canvasRef}
        className="route-babylon-board"
        data-player-cell={posKey(player)}
        data-guardian-cell={posKey(guardian)}
        data-exit-cell={posKey(mazeMap.exitPosition)}
        data-wall-cells={state.walls.join(" ")}
        data-move-targets={state.moveTargets.join(" ")}
        data-status={status}
        aria-hidden="true"
      />
      <button
        type="button"
        className="route-babylon-reset"
        onClick={() => controllerRef.current?.resetView()}
        aria-label="Centralizar a visão do tabuleiro"
      >
        <LocateFixed className="h-4 w-4" aria-hidden />
        Centralizar
      </button>
    </div>
  );
}
