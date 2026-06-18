"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";

interface RouteTrap3DProps {
  x: number;
  z: number;
  baseY: number;
  /** Once stepped on, the trap is spent: dimmer and no pulse. */
  triggered: boolean;
  /** Deterministic phase offset (from the trap index, never Math.random). */
  seed: number;
  reducedMotion: boolean;
}

/**
 * A red warning marker on a walkable hazard tile: a glowing triangular caution
 * pyramid over a soft red floor glow, gently pulsing while armed. Purely
 * visual — the trap rule lives in `useEscapeMaze`.
 */
export function RouteTrap3D({
  x,
  z,
  baseY,
  triggered,
  seed,
  reducedMotion,
}: RouteTrap3DProps) {
  const ref = useRef<Mesh>(null);

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    if (reducedMotion || triggered) {
      mesh.scale.setScalar(1);
      return;
    }
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 3 + seed) * 0.09;
    mesh.scale.setScalar(pulse);
  });

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, baseY + 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.2, 28]} />
        <meshStandardMaterial
          color="#ef4444"
          emissive="#ef4444"
          emissiveIntensity={triggered ? 0.12 : 0.75}
          transparent
          opacity={triggered ? 0.16 : 0.42}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={ref} position={[0, baseY + 0.2, 0]} castShadow>
        <coneGeometry args={[0.16, 0.3, 3]} />
        <meshStandardMaterial
          color={triggered ? "#7f1d1d" : "#fca5a5"}
          emissive={triggered ? "#3f0d0d" : "#ef4444"}
          emissiveIntensity={triggered ? 0.25 : 1.5}
          roughness={0.32}
          metalness={0.1}
          toneMapped={false}
        />
      </mesh>

      {!triggered && (
        <pointLight
          position={[0, baseY + 0.38, 0]}
          intensity={0.5}
          distance={1.3}
          decay={2}
          color="#ef4444"
        />
      )}
    </group>
  );
}
