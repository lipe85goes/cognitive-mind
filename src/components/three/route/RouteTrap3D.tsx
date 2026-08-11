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

  // ROTA-TRAPS-VISUAL-REFINE-01: engraving only. The filled hexagon read as a
  // badge laid on the tile and the bright core read as a collectible, so both
  // are gone. Wine when asleep, burnt red when sealed — never pink, never near
  // white. `triggered` means ARMED.
  const face = triggered ? "#7e1620" : "#3a1a1f";
  const core = triggered ? "#a51e2a" : "#4a2229";
  const glow = triggered ? 0.85 : 0.02;

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, baseY + 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.195, 0.225, 6]} />
        <meshStandardMaterial
          color={face}
          emissive={face}
          emissiveIntensity={triggered ? 0.5 : 0.02}
          roughness={0.72}
          metalness={0.1}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={ref} position={[0, baseY + 0.016, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.075, 0.095, 18]} />
        <meshStandardMaterial
          color={core}
          emissive={core}
          emissiveIntensity={glow}
          roughness={0.5}
          toneMapped={false}
        />
      </mesh>

      {[0, 1, 2].map((spoke) => {
        const angle = (spoke * 2 * Math.PI) / 3 + Math.PI / 6;
        return (
          <mesh
            key={spoke}
            position={[Math.cos(angle) * 0.145, baseY + 0.013, Math.sin(angle) * 0.145]}
            rotation={[-Math.PI / 2, 0, -angle]}
          >
            <planeGeometry args={[0.09, 0.028]} />
            <meshStandardMaterial
              color={core}
              emissive={core}
              emissiveIntensity={glow}
              roughness={0.6}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
