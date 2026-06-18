"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh } from "three";

interface RouteCollectible3DProps {
  x: number;
  z: number;
  baseY: number;
  /** Deterministic phase offset (from the star index, never Math.random). */
  seed: number;
  reducedMotion: boolean;
}

/** A glowing golden light hovering over its tile; only rendered while uncollected. */
export function RouteCollectible3D({
  x,
  z,
  baseY,
  seed,
  reducedMotion,
}: RouteCollectible3DProps) {
  const ref = useRef<Mesh>(null);

  useFrame((state) => {
    const mesh = ref.current;
    if (!mesh) return;
    if (reducedMotion) {
      mesh.position.y = baseY + 0.24;
      return;
    }
    const t = state.clock.elapsedTime + seed;
    mesh.position.y = baseY + 0.24 + Math.sin(t * 1.6) * 0.06;
    mesh.rotation.y = t * 0.9;
  });

  return (
    <group position={[x, 0, z]}>
      <mesh ref={ref} position={[0, baseY + 0.24, 0]} castShadow>
        <octahedronGeometry args={[0.13, 0]} />
        <meshStandardMaterial
          color="#fde68a"
          emissive="#f59e0b"
          emissiveIntensity={1.6}
          roughness={0.2}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
