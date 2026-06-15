"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { MathUtils } from "three";
import { WorldStage3D } from "@/components/three/WorldStage3D";
import type { WorldKey } from "@/data/worlds";

interface WorldSelectorSceneProps {
  worlds: WorldKey[];
  selectedIndex: number;
  reducedMotion: boolean;
  onSelect: (index: number) => void;
}

/** Matches the Canvas camera position below; the rig drifts gently around it. */
const CAMERA_BASE: [number, number, number] = [0, 2.7, 6.7];

/** Subtle pointer parallax on the camera; disabled under reduced motion. */
function CameraRig({ reducedMotion }: { reducedMotion: boolean }) {
  useFrame((state, delta) => {
    const { camera, pointer } = state;
    const [bx, by, bz] = CAMERA_BASE;
    const targetX = reducedMotion ? bx : bx + pointer.x * 0.6;
    const targetY = reducedMotion ? by : by + pointer.y * 0.3;
    camera.position.x = MathUtils.damp(camera.position.x, targetX, 3, delta);
    camera.position.y = MathUtils.damp(camera.position.y, targetY, 3, delta);
    camera.position.z = bz;
    camera.lookAt(0, 0.25, 0);
  });

  return null;
}

/**
 * The real-3D world selector: a lit tabletop carrying five world pedestals
 * under a perspective camera with soft shadows. Rendered client-only.
 */
export function WorldSelectorScene({
  worlds,
  selectedIndex,
  reducedMotion,
  onSelect,
}: WorldSelectorSceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 2.7, 6.7], fov: 42 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#e7ddca"]} />
      <fog attach="fog" args={["#e7ddca", 10, 20]} />

      {/* Lighting: warm key + cool fill + soft ambient/hemisphere */}
      <hemisphereLight args={["#fff4e0", "#6b5640", 0.55]} />
      <ambientLight intensity={0.32} />
      <directionalLight
        castShadow
        position={[4.5, 7.5, 4.5]}
        intensity={1.55}
        color="#fff0d6"
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-camera-near={1}
        shadow-camera-far={28}
      />
      <directionalLight position={[-5, 3.5, -3]} intensity={0.4} color="#bcd3ff" />

      {/* Warm wooden tabletop that receives the shadows */}
      <mesh
        receiveShadow
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.42, 0]}
      >
        <planeGeometry args={[44, 26]} />
        <meshStandardMaterial color="#7a5232" roughness={0.92} metalness={0.04} />
      </mesh>
      {/* Soft warm pool under the centre of the table */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.405, 1]}>
        <circleGeometry args={[6.5, 48]} />
        <meshStandardMaterial color="#8a6038" roughness={0.95} />
      </mesh>

      {worlds.map((world, index) => (
        <WorldStage3D
          key={world}
          world={world}
          index={index}
          selectedIndex={selectedIndex}
          reducedMotion={reducedMotion}
          onSelect={onSelect}
        />
      ))}

      <CameraRig reducedMotion={reducedMotion} />
    </Canvas>
  );
}
