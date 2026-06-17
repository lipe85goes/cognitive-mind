"use client";

import { useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Group, MathUtils, MeshStandardMaterial, PointLight } from "three";
import type { TapFeedback } from "@/games/color-sequence/useColorSequenceGame";

interface MemoryPad3DProps {
  id: number;
  color: string;
  position: [number, number, number];
  /** Lit during sequence playback or while held. */
  lit: boolean;
  /** Per-pad feedback after a tap. */
  feedback: TapFeedback;
  canTap: boolean;
  reducedMotion: boolean;
  onPress: (id: number) => void;
}

/**
 * One physical console pad: a brass-rimmed socket holding a glossy colored
 * button. The button glows (emissive) when lit during playback or pressed, and
 * is animated entirely from the game state (no per-pad state of its own).
 */
export function MemoryPad3D({
  id,
  color,
  position,
  lit,
  feedback,
  canTap,
  reducedMotion,
  onPress,
}: MemoryPad3DProps) {
  const buttonRef = useRef<Group>(null);
  const matRef = useRef<MeshStandardMaterial>(null);
  const domeRef = useRef<MeshStandardMaterial>(null);
  const lightRef = useRef<PointLight>(null);

  useFrame((state, delta) => {
    const button = buttonRef.current;
    const mat = matRef.current;
    const dome = domeRef.current;
    if (!button || !mat || !dome) return;

    const correct = feedback === "correct";
    const wrong = feedback === "wrong";
    // Inactive pads stay clearly readable (0.85); lit/correct blaze; wrong dims.
    const targetEmissive = lit ? 3.1 : correct ? 2.4 : wrong ? 0.3 : 0.85;
    const next = MathUtils.damp(mat.emissiveIntensity, targetEmissive, 14, delta);
    mat.emissiveIntensity = next;
    dome.emissiveIntensity = next;

    // Lit/correct buttons press up slightly; everything eases back home.
    const targetY = lit ? 0.14 : correct ? 0.1 : 0.05;
    button.position.y = MathUtils.damp(button.position.y, targetY, 14, delta);

    // A short calm shake on a wrong tap (skipped under reduced motion).
    const shake =
      wrong && !reducedMotion
        ? Math.sin(state.clock.elapsedTime * 42) * 0.03
        : 0;
    button.position.x = shake;

    if (lightRef.current) {
      lightRef.current.intensity = MathUtils.damp(
        lightRef.current.intensity,
        lit ? 2.1 : correct ? 1.4 : 0,
        14,
        delta,
      );
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (!canTap) return;
    onPress(id);
  };

  return (
    <group position={position}>
      {/* Brass rim around the socket */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <torusGeometry args={[0.62, 0.05, 16, 48]} />
        <meshStandardMaterial
          color="#caa14d"
          roughness={0.32}
          metalness={0.92}
          envMapIntensity={1.4}
        />
      </mesh>
      {/* Dark socket */}
      <mesh position={[0, -0.04, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.6, 0.66, 0.14, 44]} />
        <meshStandardMaterial color="#1c130b" roughness={0.55} metalness={0.4} />
      </mesh>

      {/* The glossy colored button (animated) */}
      <group
        ref={buttonRef}
        position={[0, 0.05, 0]}
        onClick={handleClick}
        onPointerOver={(event) => {
          event.stopPropagation();
          if (canTap) document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          document.body.style.cursor = "auto";
        }}
      >
        <mesh castShadow>
          <cylinderGeometry args={[0.54, 0.58, 0.16, 44]} />
          <meshStandardMaterial
            ref={matRef}
            color={color}
            emissive={color}
            emissiveIntensity={0.85}
            roughness={0.28}
            metalness={0.12}
            toneMapped={false}
          />
        </mesh>
        {/* Convex glossy cap so the pad reads physical, not a flat circle */}
        <mesh position={[0, 0.08, 0]} castShadow>
          <sphereGeometry args={[0.52, 40, 22, 0, Math.PI * 2, 0, Math.PI / 2.05]} />
          <meshStandardMaterial
            ref={domeRef}
            color={color}
            emissive={color}
            emissiveIntensity={0.85}
            roughness={0.16}
            metalness={0.08}
            toneMapped={false}
          />
        </mesh>
      </group>

      <pointLight
        ref={lightRef}
        position={[0, 0.5, 0]}
        intensity={0}
        distance={2.4}
        decay={2}
        color={color}
      />
    </group>
  );
}
