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
    if (reducedMotion || !triggered) {
      mesh.scale.setScalar(1);
      return;
    }
    // Armed traps breathe slowly. Dormant ones are still.
    const pulse = 1 + Math.sin(state.clock.elapsedTime * 1.6 + seed) * 0.05;
    mesh.scale.setScalar(pulse);
  });

  // ROTA-TRAPS-STRATEGY-01: a rune cut into the floor, not a pin standing on
  // it. `triggered` now means ARMED, so the semantics are the other way round
  // from before: dormant is dark oxide, armed lights up and stays lit.
  const face = triggered ? "#c8323f" : "#4a2229";
  const core = triggered ? "#ff8a92" : "#5d2b33";
  const glow = triggered ? 1.4 : 0.06;

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, baseY + 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[0.24, 6]} />
        <meshStandardMaterial
          color={face}
          emissive={face}
          emissiveIntensity={triggered ? 0.55 : 0.04}
          roughness={0.68}
          metalness={0.12}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={ref} position={[0, baseY + 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.13, 0.17, 24]} />
        <meshStandardMaterial
          color={core}
          emissive={core}
          emissiveIntensity={glow}
          roughness={0.4}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[0, baseY + 0.022, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.06, 16]} />
        <meshStandardMaterial
          color={core}
          emissive={core}
          emissiveIntensity={glow}
          roughness={0.4}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
