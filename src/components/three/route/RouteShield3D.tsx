"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";

interface RouteShield3DProps {
  x: number;
  z: number;
  baseY: number;
  reducedMotion: boolean;
}

/**
 * A blue glowing shield power-up hovering over its tile. A distinct blue
 * icosahedron (vs the golden octahedron lights) so the two pickups never read
 * the same. Only rendered while uncollected; collection lives in the hook.
 */
export function RouteShield3D({
  x,
  z,
  baseY,
  reducedMotion,
}: RouteShield3DProps) {
  const ref = useRef<Mesh>(null);

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    if (reducedMotion) {
      mesh.position.y = baseY + 0.27;
      return;
    }
    const t = state.clock.elapsedTime;
    mesh.position.y = baseY + 0.27 + Math.sin(t * 1.4) * 0.05;
    mesh.rotation.y = t * 0.7;
  });

  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, baseY + 0.055, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.2, 28]} />
        <meshStandardMaterial
          color="#38bdf8"
          emissive="#38bdf8"
          emissiveIntensity={0.7}
          transparent
          opacity={0.42}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      <mesh ref={ref} position={[0, baseY + 0.27, 0]} castShadow>
        <icosahedronGeometry args={[0.16, 0]} />
        <meshStandardMaterial
          color="#bae6fd"
          emissive="#38bdf8"
          emissiveIntensity={1.5}
          roughness={0.2}
          metalness={0.3}
          toneMapped={false}
        />
      </mesh>

      <pointLight
        position={[0, baseY + 0.42, 0]}
        intensity={0.8}
        distance={1.7}
        decay={2}
        color="#38bdf8"
      />
    </group>
  );
}
