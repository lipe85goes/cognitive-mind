"use client";

import { useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";
import { Group, MathUtils, type Texture } from "three";
import { WORLD_3D_PALETTE } from "@/components/three/world-palette";
import { MemoryWorld3D } from "@/components/three/worlds/MemoryWorld3D";
import { RouteWorld3D } from "@/components/three/worlds/RouteWorld3D";
import { CommandWorld3D } from "@/components/three/worlds/CommandWorld3D";
import { LogicWorld3D } from "@/components/three/worlds/LogicWorld3D";
import { GardenWorld3D } from "@/components/three/worlds/GardenWorld3D";
import type { WorldKey } from "@/data/worlds";

const SPACING = 2.42;

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
  stageTexture: Texture | null;
}

/**
 * One world seated on the tabletop-stage asset via a small neutral foot. It
 * carousels toward / away from the centre as the selection changes and lifts
 * slightly when selected.
 */
export function WorldStage3D({
  world,
  index,
  selectedIndex,
  reducedMotion,
  onSelect,
  stageTexture,
}: WorldStage3DProps) {
  const outerRef = useRef<Group>(null);
  const innerRef = useRef<Group>(null);

  useFrame((state, delta) => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const offset = index - selectedIndex;
    const isSelected = offset === 0;
    const dist = Math.abs(offset);
    const lambda = 5;

    const targetX = offset * SPACING;
    const targetZ = isSelected ? 0.45 : -0.75 - dist * 0.22;
    const targetY = isSelected ? 0.08 : -0.08;
    const targetScale = isSelected ? 1.15 : 0.69;
    const targetRotY = isSelected ? 0 : -offset * 0.28;

    outer.position.x = MathUtils.damp(outer.position.x, targetX, lambda, delta);
    outer.position.y = MathUtils.damp(outer.position.y, targetY, lambda, delta);
    outer.position.z = MathUtils.damp(outer.position.z, targetZ, lambda, delta);
    const scale = MathUtils.damp(outer.scale.x, targetScale, lambda, delta);
    outer.scale.setScalar(scale);
    outer.rotation.y = MathUtils.damp(outer.rotation.y, targetRotY, lambda, delta);

    // Gentle idle motion only for the focused world (skipped under reduced motion).
    if (isSelected && !reducedMotion) {
      const t = state.clock.elapsedTime;
      inner.position.y = Math.sin(t * 1.3) * 0.045;
      inner.rotation.y = Math.sin(t * 0.45) * 0.14;
    } else {
      inner.position.y = MathUtils.damp(inner.position.y, 0, lambda, delta);
      inner.rotation.y = MathUtils.damp(inner.rotation.y, 0, lambda, delta);
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
      {/* The pedestal IS the real tabletop-stage asset, billboarded so it always
          presents the carved board squarely. It is a child of this group, so it
          carousels and scales with the world (the selected world's base reads
          larger; neighbours get smaller, coherent versions). No procedural base,
          ring, disc or halo competes with it. */}
      {stageTexture && (
        <Billboard position={[0, -0.17, -0.12]}>
          <mesh>
            <planeGeometry args={[2.7, 2.7]} />
            <meshBasicMaterial
              map={stageTexture}
              transparent
              toneMapped={false}
              depthWrite={false}
            />
          </mesh>
        </Billboard>
      )}

      {/* The world model */}
      <group ref={innerRef} position={[0, 0.1, 0]} scale={1.04}>
        <WorldContent world={world} />
      </group>
    </group>
  );
}
