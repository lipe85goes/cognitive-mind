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
  /** Within the Pickaxe's reach right now — control information, not a hint. */
  isBreakTarget?: boolean;
  /** The target the player is pointing at, so it is clear which one opens. */
  isBreakAim?: boolean;
  /** The tile a wall used to stand on: a little rubble left behind. */
  isBroken?: boolean;
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
  isBreakTarget = false,
  isBreakAim = false,
  isBroken = false,
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

      {/*
        ROTA-CHEST-REWARDS-01 §14/§32 (revisão pós-playtest): every wall is drawn
        identically. The fissures that used to mark a certified subset are gone —
        a permanent mark would answer the question the Pickaxe exists to ask.
      */}
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

      {/*
        §16: contextual reach, in the Pickaxe's own bronze. Present only while the
        tool is held and the Explorer is standing next to this wall; brighter on
        the one being pointed at. VALID target, never GOOD target.
      */}
      {isWall && isBreakTarget && (
        <mesh position={[0, isBreakAim ? 0.09 : 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[cell * 0.44, cell * 0.54, 32]} />
          <meshStandardMaterial
            color={isBreakAim ? "#ffcf7a" : "#c9903f"}
            emissive={isBreakAim ? "#a8641a" : "#5a3a12"}
            emissiveIntensity={isBreakAim ? 1.1 : 0.55}
            transparent
            opacity={isBreakAim ? 0.78 : 0.5}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      )}

      {isWall && isBreakAim && (
        <mesh position={[0, 0.5, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[cell * 0.4, cell * 0.5, 32]} />
          <meshStandardMaterial
            color="#ffcf7a"
            emissive="#a8641a"
            emissiveIntensity={1.1}
            transparent
            opacity={0.78}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      )}

      {isBroken && !isWall && (
        <group>
          {[
            [-0.26, 0.09, 0.22],
            [0.24, 0.07, -0.18],
            [0.06, 0.05, 0.3],
          ].map(([dx, size, dz], index) => (
            <mesh
              key={`chip-${index}`}
              position={[dx * cell, 0.1 + size * 0.28, dz * cell]}
              rotation={[0, 0.5 + index * 0.9, 0]}
              castShadow
            >
              <boxGeometry args={[size, size * 0.55, size * 0.82]} />
              <meshStandardMaterial color="#4b3826" roughness={0.9} metalness={0.08} />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}
