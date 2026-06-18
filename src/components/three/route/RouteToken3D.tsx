"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, MathUtils } from "three";

interface RouteToken3DProps {
  kind: "player" | "guardian";
  /** Target board coordinates (computed from the grid by the scene). */
  x: number;
  z: number;
  baseY: number;
  reducedMotion: boolean;
}

/**
 * A board pawn. The player is a glowing cyan explorer; the guardian is a hooded
 * amber sentinel — clearly distinct silhouettes. The token snaps to its start
 * cell on mount and then smoothly slides toward its (state-driven) target cell
 * whenever the hook moves it. No game logic lives here.
 */
export function RouteToken3D({
  kind,
  x,
  z,
  baseY,
  reducedMotion,
}: RouteToken3DProps) {
  const ref = useRef<Group>(null);
  const initialised = useRef(false);

  useFrame((state, delta) => {
    const group = ref.current;
    if (!group) return;
    if (!initialised.current) {
      group.position.set(x, baseY, z);
      initialised.current = true;
    } else {
      group.position.x = MathUtils.damp(group.position.x, x, 11, delta);
      group.position.z = MathUtils.damp(group.position.z, z, 11, delta);
    }
    if (kind === "guardian" && !reducedMotion) {
      group.rotation.y = Math.sin(state.clock.elapsedTime * 0.8) * 0.14;
    }
  });

  const accent = kind === "player" ? "#22d3ee" : "#f59e0b";
  const accentHi = kind === "player" ? "#a5f3fc" : "#fde68a";

  return (
    <group ref={ref}>
      <mesh castShadow position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.2, 0.23, 0.1, 28]} />
        <meshStandardMaterial color="#1c130b" roughness={0.5} metalness={0.3} />
      </mesh>

      {kind === "player" ? (
        <>
          <mesh castShadow position={[0, 0.26, 0]}>
            <cylinderGeometry args={[0.1, 0.17, 0.32, 24]} />
            <meshStandardMaterial
              color={accent}
              emissive={accent}
              emissiveIntensity={0.5}
              roughness={0.3}
              metalness={0.2}
              toneMapped={false}
            />
          </mesh>
          <mesh castShadow position={[0, 0.5, 0]}>
            <sphereGeometry args={[0.14, 24, 18]} />
            <meshStandardMaterial
              color={accentHi}
              emissive={accent}
              emissiveIntensity={1.4}
              roughness={0.2}
              toneMapped={false}
            />
          </mesh>
        </>
      ) : (
        <>
          <mesh castShadow position={[0, 0.34, 0]}>
            <coneGeometry args={[0.22, 0.5, 24]} />
            <meshStandardMaterial
              color="#3a2a12"
              emissive={accent}
              emissiveIntensity={0.18}
              roughness={0.6}
              metalness={0.15}
            />
          </mesh>
          <mesh position={[0, 0.4, 0.16]}>
            <sphereGeometry args={[0.05, 16, 12]} />
            <meshStandardMaterial
              color={accentHi}
              emissive={accent}
              emissiveIntensity={2}
              toneMapped={false}
            />
          </mesh>
        </>
      )}

      <pointLight
        position={[0, 0.5, 0]}
        intensity={0.7}
        distance={1.6}
        decay={2}
        color={accent}
      />
    </group>
  );
}
