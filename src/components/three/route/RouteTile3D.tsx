"use client";

import { RoundedBox } from "@react-three/drei";
import type { ThreeEvent } from "@react-three/fiber";

interface RouteTile3DProps {
  x: number;
  z: number;
  cell: number;
  isWall: boolean;
  /** Adjacent walkable tile the player can step to (visual hint + click). */
  isMove: boolean;
  /** Within the guardian's immediate reach — a calm danger preview. */
  isDanger?: boolean;
  /** Provided only for move-target tiles; calls the existing tryMovePlayer. */
  onSelect?: () => void;
}

/**
 * One board cell: a dark stone floor tile, plus a raised brass-stone block for
 * walls and a green glow inlay for available moves. Movement rules are never
 * computed here — `onSelect` (only present on adjacent walkable tiles) just
 * forwards to the hook's move function.
 */
export function RouteTile3D({
  x,
  z,
  cell,
  isWall,
  isMove,
  isDanger = false,
  onSelect,
}: RouteTile3DProps) {
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect?.();
  };

  return (
    <group position={[x, 0, z]}>
      <mesh
        position={[0, 0.05, 0]}
        receiveShadow
        onClick={onSelect ? handleClick : undefined}
        onPointerOver={
          onSelect
            ? (event) => {
                event.stopPropagation();
                document.body.style.cursor = "pointer";
              }
            : undefined
        }
        onPointerOut={
          onSelect
            ? () => {
                document.body.style.cursor = "auto";
              }
            : undefined
        }
      >
        <boxGeometry args={[cell * 0.94, 0.1, cell * 0.94]} />
        <meshStandardMaterial
          color={isMove ? "#2f3a26" : "#2a1d12"}
          roughness={0.85}
          metalness={0.05}
        />
      </mesh>

      {isMove && (
        <mesh position={[0, 0.105, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[cell * 0.62, cell * 0.62]} />
          <meshStandardMaterial
            color="#5fce8b"
            emissive="#34d399"
            emissiveIntensity={1.1}
            transparent
            opacity={0.5}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      )}

      {isDanger && !isWall && (
        <mesh position={[0, 0.108, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[cell * 0.34, cell * 0.43, 30]} />
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#f59e0b"
            emissiveIntensity={0.9}
            transparent
            opacity={0.5}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      )}

      {isWall && (
        <RoundedBox
          args={[cell * 0.82, 0.5, cell * 0.82]}
          radius={0.05}
          smoothness={3}
          position={[0, 0.3, 0]}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial color="#5a4423" roughness={0.7} metalness={0.18} />
        </RoundedBox>
      )}
    </group>
  );
}
