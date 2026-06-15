"use client";

import { useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { Group, MathUtils, MeshStandardMaterial } from "three";
import { WORLD_3D_PALETTE } from "@/components/three/world-palette";
import { MemoryWorld3D } from "@/components/three/worlds/MemoryWorld3D";
import { RouteWorld3D } from "@/components/three/worlds/RouteWorld3D";
import { CommandWorld3D } from "@/components/three/worlds/CommandWorld3D";
import { LogicWorld3D } from "@/components/three/worlds/LogicWorld3D";
import { GardenWorld3D } from "@/components/three/worlds/GardenWorld3D";
import type { WorldKey } from "@/data/worlds";

const SPACING = 2.35;

/**
 * The interchangeable model for a world. Today these are procedural primitives;
 * to use a real model later, replace the matching case with a <primitive
 * object={useGLTF('/models/worlds/<world>.glb').scene} /> (see README).
 */
function WorldContent({ world }: { world: WorldKey }) {
  const palette = WORLD_3D_PALETTE[world];
  switch (world) {
    case "memory":
      return <MemoryWorld3D palette={palette} />;
    case "route":
      return <RouteWorld3D palette={palette} />;
    case "commands":
      return <CommandWorld3D palette={palette} />;
    case "logic":
      return <LogicWorld3D palette={palette} />;
    case "garden":
      return <GardenWorld3D palette={palette} />;
  }
}

interface WorldStage3DProps {
  world: WorldKey;
  index: number;
  selectedIndex: number;
  reducedMotion: boolean;
  onSelect: (index: number) => void;
}

/**
 * One world placed on a glowing pedestal. It carousels toward / away from the
 * centre as the selection changes and lifts + glows when selected.
 */
export function WorldStage3D({
  world,
  index,
  selectedIndex,
  reducedMotion,
  onSelect,
}: WorldStage3DProps) {
  const outerRef = useRef<Group>(null);
  const innerRef = useRef<Group>(null);
  const haloRef = useRef<MeshStandardMaterial>(null);
  const palette = WORLD_3D_PALETTE[world];

  useFrame((state, delta) => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const offset = index - selectedIndex;
    const isSelected = offset === 0;
    const dist = Math.abs(offset);

    const targetX = offset * SPACING;
    const targetZ = isSelected ? 0.5 : -0.55 - dist * 0.15;
    const targetY = isSelected ? 0.16 : 0;
    const targetScale = isSelected ? 1.12 : 0.82;
    const targetRotY = isSelected ? 0 : -offset * 0.22;
    const lambda = 5;

    outer.position.x = MathUtils.damp(outer.position.x, targetX, lambda, delta);
    outer.position.y = MathUtils.damp(outer.position.y, targetY, lambda, delta);
    outer.position.z = MathUtils.damp(outer.position.z, targetZ, lambda, delta);
    const scale = MathUtils.damp(outer.scale.x, targetScale, lambda, delta);
    outer.scale.setScalar(scale);
    outer.rotation.y = MathUtils.damp(outer.rotation.y, targetRotY, lambda, delta);

    // Gentle idle motion only for the focused world (skipped under reduced motion).
    if (isSelected && !reducedMotion) {
      const t = state.clock.elapsedTime;
      inner.position.y = Math.sin(t * 1.4) * 0.04;
      inner.rotation.y = Math.sin(t * 0.5) * 0.12;
    } else {
      inner.position.y = MathUtils.damp(inner.position.y, 0, lambda, delta);
      inner.rotation.y = MathUtils.damp(inner.rotation.y, 0, lambda, delta);
    }

    if (haloRef.current) {
      haloRef.current.emissiveIntensity = MathUtils.damp(
        haloRef.current.emissiveIntensity,
        isSelected ? 1.8 : 0.12,
        lambda,
        delta,
      );
    }
  });

  const handleSelect = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    onSelect(index);
  };

  return (
    <group
      ref={outerRef}
      onClick={handleSelect}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "auto";
      }}
    >
      {/* Selection halo on the table */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.41, 0]}>
        <torusGeometry args={[1.0, 0.05, 16, 48]} />
        <meshStandardMaterial
          ref={haloRef}
          color={palette.glow}
          emissive={palette.glow}
          emissiveIntensity={0.12}
          toneMapped={false}
        />
      </mesh>

      {/* Pedestal */}
      <RoundedBox
        args={[1.7, 0.4, 1.35]}
        radius={0.1}
        smoothness={4}
        position={[0, -0.2, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={palette.base} roughness={0.6} metalness={0.1} />
      </RoundedBox>
      {/* Pedestal inset top */}
      <mesh position={[0, 0.005, 0]} receiveShadow>
        <boxGeometry args={[1.5, 0.04, 1.15]} />
        <meshStandardMaterial color={palette.deep} roughness={0.7} />
      </mesh>

      {/* The world model */}
      <group ref={innerRef} position={[0, 0.02, 0]}>
        <WorldContent world={world} />
      </group>
    </group>
  );
}
