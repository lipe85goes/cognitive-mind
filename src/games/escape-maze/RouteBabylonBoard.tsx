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
  /** The board as it stands: `mazeMap.walls` minus the wall the Pickaxe opened. */
  walls: Set<string>;
  player: GridPosition;
  guardian: GridPosition;
  sentinel: GridPosition;
  sentinelCommitted: boolean;
  collectedSet: Set<string>;
  moveTargets: Set<string>;
  triggeredTrapSet: Set<string>;
  dangerTiles: Set<string>;
  chestOpened: boolean;
  /** Adjacent walls the Pickaxe could open right now — contextual, never a hint. */
  breakTargets: string[];
  /** The one the player is pointing at, so the board can show which will open. */
  aimedWall: string | null;
  brokenWall: string | null;
  reducedMotion: boolean;
  status: GameStatus;
  onMove: (delta: GridPosition) => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
}

export function RouteBabylonBoard({
  mazeMap,
  walls,
  player,
  guardian,
  sentinel,
  sentinelCommitted,
  collectedSet,
  moveTargets,
  triggeredTrapSet,
  dangerTiles,
  chestOpened,
  breakTargets,
  aimedWall,
  brokenWall,
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
      walls: Array.from(walls),
      exitPosition: mazeMap.exitPosition,
      lights: mazeMap.collectibleStars,
      collectedKeys: Array.from(collectedSet),
      player,
      guardian,
      sentinel,
      sentinelCommitted,
      moveTargets: Array.from(moveTargets),
      traps: mazeMap.traps,
      triggeredTrapKeys: Array.from(triggeredTrapSet),
      chest: mazeMap.chest,
      chestOpened,
      // Contextual only: these exist while the Pickaxe is in hand and the
      // Explorer is standing next to a wall, and they vanish the moment it is
      // spent. No wall carries a permanent mark (§14).
      breakTargetKeys: breakTargets,
      aimedWallKey: aimedWall,
      brokenWallKey: brokenWall,
      dangerTiles: Array.from(dangerTiles),
      reducedMotion,
      status,
    }),
    [
      mazeMap,
      walls,
      player,
      guardian,
      sentinel,
      sentinelCommitted,
      collectedSet,
      moveTargets,
      triggeredTrapSet,
      dangerTiles,
      chestOpened,
      breakTargets,
      aimedWall,
      brokenWall,
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
        data-light-cells={mazeMap.collectibleStars.map(posKey).join(" ")}
        data-collected-light-cells={state.collectedKeys.join(" ")}
        data-trap-cells={mazeMap.traps.map(posKey).join(" ")}
        data-triggered-trap-cells={state.triggeredTrapKeys.join(" ")}
        data-chest-cell={mazeMap.chest ? posKey(mazeMap.chest) : ""}
        data-chest-opened={chestOpened ? "true" : "false"}
        data-break-target-cells={state.breakTargetKeys.join(" ")}
        data-aimed-wall-cell={aimedWall ?? ""}
        data-broken-wall-cell={brokenWall ?? ""}
        data-danger-cells={state.dangerTiles.join(" ")}
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
