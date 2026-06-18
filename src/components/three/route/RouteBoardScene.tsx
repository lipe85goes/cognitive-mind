"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Lightformer,
  RoundedBox,
} from "@react-three/drei";
import { Mesh } from "three";
import {
  COLS,
  posKey,
  positionsEqual,
  ROWS,
} from "@/games/escape-maze/useEscapeMaze";
import { RouteTile3D } from "@/components/three/route/RouteTile3D";
import { RouteToken3D } from "@/components/three/route/RouteToken3D";
import { RouteCollectible3D } from "@/components/three/route/RouteCollectible3D";
import type { GridPosition } from "@/types/game";

const CELL = 0.6;
const HALF = (ROWS - 1) / 2;
const BOARD = ROWS * CELL;
const TILE_TOP = 0.1;

/** Map a grid cell to board XZ: col 0 left → col 6 right; row 0 back → row 6 front. */
function toXZ(row: number, col: number): [number, number] {
  return [(col - HALF) * CELL, (row - HALF) * CELL];
}

interface RouteBoardSceneProps {
  walls: Set<string>;
  exitPosition: GridPosition;
  stars: GridPosition[];
  collectedSet: Set<string>;
  player: GridPosition;
  guardian: GridPosition;
  /** Adjacent walkable cells, as "row,col" keys (purely visual + click). */
  moveTargets: Set<string>;
  reducedMotion: boolean;
  /** The hook's tryMovePlayer — the single source of movement. */
  onMove: (delta: GridPosition) => void;
}

function CameraRig() {
  useFrame(({ camera }) => {
    camera.lookAt(0, -0.2, 0.1);
  });
  return null;
}

function Portal({
  x,
  z,
  reducedMotion,
}: {
  x: number;
  z: number;
  reducedMotion: boolean;
}) {
  const ringRef = useRef<Mesh>(null);
  useFrame((state) => {
    if (ringRef.current && !reducedMotion) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 0.5;
    }
  });
  return (
    <group position={[x, TILE_TOP, z]}>
      <mesh ref={ringRef} position={[0, 0.34, 0]} castShadow>
        <torusGeometry args={[0.22, 0.05, 16, 40]} />
        <meshStandardMaterial
          color="#86efac"
          emissive="#22c55e"
          emissiveIntensity={1.8}
          roughness={0.25}
          metalness={0.1}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.34, -0.01]}>
        <circleGeometry args={[0.2, 28]} />
        <meshStandardMaterial
          color="#bbf7d0"
          emissive="#22c55e"
          emissiveIntensity={0.9}
          transparent
          opacity={0.5}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>
      <pointLight
        position={[0, 0.4, 0.1]}
        intensity={1.1}
        distance={2.2}
        decay={2}
        color="#22c55e"
      />
    </group>
  );
}

/**
 * The real 3D Rota Estratégica board: a brass-framed wooden tabletop holding a
 * 7×7 stone grid with the explorer, guardian, exit portal and golden lights,
 * lit cinematically. A pure view over `useEscapeMaze` — every position comes
 * from the hook state and tile clicks call the hook's move function.
 */
export function RouteBoardScene({
  walls,
  exitPosition,
  stars,
  collectedSet,
  player,
  guardian,
  moveTargets,
  reducedMotion,
  onMove,
}: RouteBoardSceneProps) {
  const [px, pz] = toXZ(player.row, player.col);
  const [gx, gz] = toXZ(guardian.row, guardian.col);
  const [ex, ez] = toXZ(exitPosition.row, exitPosition.col);

  const visibleStars = stars.filter(
    (star) =>
      !collectedSet.has(posKey(star)) &&
      !positionsEqual(star, player) &&
      !positionsEqual(star, guardian),
  );

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 5.4, 5.0], fov: 44 }}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: true }}
    >
      <fog attach="fog" args={["#1a1009", 11, 24]} />

      <Environment frames={1} resolution={256}>
        <Lightformer
          intensity={2}
          color="#fff0d4"
          position={[0, 6, 5]}
          scale={[10, 7, 1]}
        />
        <Lightformer
          intensity={0.6}
          color="#9fb8ff"
          position={[-6, 3, -4]}
          scale={[6, 6, 1]}
        />
      </Environment>

      <hemisphereLight args={["#fff3d7", "#2d1a0f", 0.5]} />
      <ambientLight intensity={0.24} />
      <directionalLight
        castShadow
        position={[4, 9, 5]}
        intensity={1.9}
        color="#fff0d4"
        shadow-mapSize={[1024, 1024]}
        shadow-radius={4}
        shadow-bias={-0.0004}
        shadow-camera-left={-5}
        shadow-camera-right={5}
        shadow-camera-top={5}
        shadow-camera-bottom={-5}
        shadow-camera-near={1}
        shadow-camera-far={24}
      />
      <directionalLight position={[-4, 3, -4]} intensity={0.32} color="#9fb8ff" />
      <spotLight
        position={[0, 10, 3]}
        angle={0.6}
        penumbra={0.9}
        intensity={1.3}
        color="#ffdfae"
        distance={22}
      />

      {/* Wooden tabletop base */}
      <RoundedBox
        args={[BOARD + 0.8, 0.4, BOARD + 0.8]}
        radius={0.14}
        smoothness={4}
        position={[0, -0.28, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#3a2616" roughness={0.82} metalness={0.06} />
      </RoundedBox>
      {/* Brass frame plate the tiles sit on */}
      <RoundedBox
        args={[BOARD + 0.34, 0.1, BOARD + 0.34]}
        radius={0.06}
        smoothness={4}
        position={[0, -0.02, 0]}
        receiveShadow
      >
        <meshStandardMaterial
          color="#caa14d"
          roughness={0.34}
          metalness={0.85}
          envMapIntensity={1.4}
        />
      </RoundedBox>

      {Array.from({ length: ROWS }, (_, row) =>
        Array.from({ length: COLS }, (_, col) => {
          const key = posKey({ row, col });
          const isMove = moveTargets.has(key);
          const [x, z] = toXZ(row, col);
          return (
            <RouteTile3D
              key={key}
              x={x}
              z={z}
              cell={CELL}
              isWall={walls.has(key)}
              isMove={isMove}
              onSelect={
                isMove
                  ? () =>
                      onMove({
                        row: row - player.row,
                        col: col - player.col,
                      })
                  : undefined
              }
            />
          );
        }),
      )}

      <Portal x={ex} z={ez} reducedMotion={reducedMotion} />

      {visibleStars.map((star, index) => {
        const [sx, sz] = toXZ(star.row, star.col);
        return (
          <RouteCollectible3D
            key={posKey(star)}
            x={sx}
            z={sz}
            baseY={TILE_TOP}
            seed={index * 1.7}
            reducedMotion={reducedMotion}
          />
        );
      })}

      <RouteToken3D
        kind="player"
        x={px}
        z={pz}
        baseY={TILE_TOP}
        reducedMotion={reducedMotion}
      />
      <RouteToken3D
        kind="guardian"
        x={gx}
        z={gz}
        baseY={TILE_TOP}
        reducedMotion={reducedMotion}
      />

      <ContactShadows
        position={[0, 0.02, 0]}
        opacity={0.5}
        scale={BOARD + 1}
        blur={2.6}
        far={3}
        color="#0c0703"
      />

      <CameraRig />
    </Canvas>
  );
}
