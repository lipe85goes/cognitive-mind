"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";

interface RouteChest3DProps {
  x: number;
  z: number;
  baseY: number;
  /** Once opened the lid stands back, the ember dies and the stone goes grey. */
  opened: boolean;
  reducedMotion: boolean;
}

/**
 * The reward chest — the same relic the Babylon board draws, in the fallback
 * renderer (ROTA-CHEST-REWARDS-01 §32).
 *
 * Stone body, two bronze bands, one restrained teal ember in the lock. It never
 * outshines the portal: the ember is the only lit surface and it breathes rather
 * than pulses. Once used it stays on the board in plain spent grey, because a
 * chest that disappeared would leave the player unsure it was ever taken.
 */
export function RouteChest3D({
  x,
  z,
  baseY,
  opened,
  reducedMotion,
}: RouteChest3DProps) {
  const emberRef = useRef<Mesh>(null);

  useFrame((state) => {
    const ember = emberRef.current;
    if (!ember) return;
    if (opened || reducedMotion) {
      ember.scale.setScalar(1);
      return;
    }
    const breath = 1 + Math.sin(state.clock.elapsedTime * 1.1) * 0.06;
    ember.scale.setScalar(breath);
  });

  const stone = opened ? "#4a463c" : "#3d3a30";
  const bronze = opened ? "#5b5346" : "#a9762f";

  return (
    <group position={[x, baseY, z]} rotation={[0, 0.24, 0]}>
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[0.32, 0.03, 0.26]} />
        <meshStandardMaterial color={bronze} roughness={0.42} metalness={0.7} />
      </mesh>

      <mesh position={[0, 0.1, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.27, 0.13, 0.2]} />
        <meshStandardMaterial color={stone} roughness={0.78} metalness={0.12} />
      </mesh>

      {[-0.085, 0.085].map((offset) => (
        <mesh key={offset} position={[offset, 0.1, 0]} castShadow>
          <boxGeometry args={[0.026, 0.14, 0.212]} />
          <meshStandardMaterial color={bronze} roughness={0.4} metalness={0.72} />
        </mesh>
      ))}

      <mesh
        position={opened ? [0, 0.19, -0.1] : [0, 0.185, 0]}
        rotation={opened ? [-1.15, 0, 0] : [0, 0, 0]}
        castShadow
      >
        <boxGeometry args={[0.285, 0.06, 0.215]} />
        <meshStandardMaterial color={stone} roughness={0.78} metalness={0.12} />
      </mesh>

      <mesh position={[0, 0.135, 0.108]}>
        <boxGeometry args={[0.058, 0.07, 0.03]} />
        <meshStandardMaterial
          color={opened ? "#57503f" : "#63b6ad"}
          emissive={opened ? "#000000" : "#236f68"}
          emissiveIntensity={opened ? 0 : 0.9}
          roughness={0.5}
          metalness={0.3}
        />
      </mesh>

      {!opened && (
        <mesh ref={emberRef} position={[0, 0.235, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.075, 0.008, 10, 28]} />
          <meshStandardMaterial
            color="#63b6ad"
            emissive="#236f68"
            emissiveIntensity={1.1}
            transparent
            opacity={0.75}
            toneMapped={false}
            depthWrite={false}
          />
        </mesh>
      )}
    </group>
  );
}
