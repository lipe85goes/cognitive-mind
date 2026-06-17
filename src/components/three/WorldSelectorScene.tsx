"use client";

import { useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { MathUtils, SRGBColorSpace, TextureLoader, type Texture } from "three";
import { WorldStage3D } from "@/components/three/WorldStage3D";
import { WORLD_3D_PALETTE } from "@/components/three/world-palette";
import type { WorldKey } from "@/data/worlds";

interface WorldSelectorSceneProps {
  worlds: WorldKey[];
  selectedIndex: number;
  reducedMotion: boolean;
  onSelect: (index: number) => void;
}

/**
 * Drives camera framing (adaptive to portrait/landscape) plus a gentle,
 * reduced-motion-gated pointer parallax. Reads camera/pointer from the frame
 * state so nothing is mutated from render scope.
 */
function CameraRig({ reducedMotion }: { reducedMotion: boolean }) {
  useFrame((state, delta) => {
    const { camera, pointer, size } = state;
    const portrait = size.width / size.height < 0.85;

    const baseX = portrait ? 0 : 0.24;
    const baseY = portrait ? 2.4 : 2.05;
    const baseZ = portrait ? 6.3 : 5.7;
    const targetFov = portrait ? 42 : 37;
    const lookX = portrait ? 0 : 0.42;
    const lookY = portrait ? 0.4 : 0.45;

    // Only a faint pointer drift: the world is composited over a static HTML
    // tabletop asset, so large camera movement would visibly slide the world
    // off the board. Kept tiny (and gated by reduced motion).
    const targetX = reducedMotion ? baseX : baseX + pointer.x * 0.08;
    const targetY = reducedMotion ? baseY : baseY + pointer.y * 0.05;

    camera.position.x = MathUtils.damp(camera.position.x, targetX, 3, delta);
    camera.position.y = MathUtils.damp(camera.position.y, targetY, 3, delta);
    camera.position.z = MathUtils.damp(camera.position.z, baseZ, 3, delta);

    if ("fov" in camera) {
      const next = MathUtils.damp(camera.fov, targetFov, 3, delta);
      if (Math.abs(next - camera.fov) > 0.01) {
        camera.fov = next;
        camera.updateProjectionMatrix();
      }
    }
    camera.lookAt(lookX, lookY, 0);
  });

  return null;
}

function TabletopWorlds({
  worlds,
  selectedIndex,
  reducedMotion,
  onSelect,
}: WorldSelectorSceneProps) {
  const { size } = useThree();
  const portrait = size.width / size.height < 0.85;
  const stageX = portrait ? 0 : 0.82;
  // Portrait: lift the worlds a little higher and shrink them slightly so the
  // selected world reads centred with room to breathe above the dock.
  const stageY = portrait ? 0.15 : 0.04;
  const stageScale = portrait ? 0.85 : 1.12;
  // The tabletop-stage asset is now the incorporated base of EACH world (see
  // WorldStage3D); it is no longer a separate floating board. Loaded once via a
  // plain TextureLoader (no Suspense, so the canvas never re-mounts) and shared
  // across the pedestals.
  const [stageTexture, setStageTexture] = useState<Texture | null>(null);
  useEffect(() => {
    let active = true;
    new TextureLoader().load(
      "/illustrations/home/tabletop-stage.webp",
      (texture) => {
        texture.colorSpace = SRGBColorSpace;
        if (active) setStageTexture(texture);
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return (
    <group position={[stageX, stageY, 0.05]} scale={stageScale}>
      {/* ===== No procedural tabletop / no floating board =====
          The real tabletop-stage asset is the per-world pedestal base (in
          WorldStage3D), so the big round base, brass rim, gold ring, grooves,
          inlay studs and the separate centred board are all gone. A soft
          contact shadow still grounds the pieces. */}
      <ContactShadows
        position={[0, -0.2, 0.1]}
        opacity={0.4}
        scale={6.5}
        blur={3}
        far={4}
        color="#160c04"
      />
      {/* warm pool of light on the centred (selected) world; lives inside the
          stage group so it always follows the selection on every viewport */}
      <pointLight
        position={[0, 1.55, 0.95]}
        intensity={0.85}
        distance={3.8}
        decay={2}
        color="#ffd9a0"
      />

      {worlds.map((world, index) => (
        <WorldStage3D
          key={world}
          world={world}
          index={index}
          selectedIndex={selectedIndex}
          reducedMotion={reducedMotion}
          onSelect={onSelect}
          stageTexture={stageTexture}
        />
      ))}
    </group>
  );
}

/**
 * The real-3D world selector: a warm, cozy game table lit cinematically, with
 * five world pedestals carouselling under a perspective camera. Client-only.
 */
export function WorldSelectorScene({
  worlds,
  selectedIndex,
  reducedMotion,
  onSelect,
}: WorldSelectorSceneProps) {
  const accent =
    WORLD_3D_PALETTE[worlds[selectedIndex] ?? "memory"]?.glow ?? "#ffd98a";

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 2.05, 5.35], fov: 38 }}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: true }}
    >
      {/* Transparent canvas: the cozy library/workshop atmosphere is an HTML
          layer behind this, so the worlds composite over a warm room. Fog
          (matched to that room's dark warmth) still fades the far worlds. */}
      <fog attach="fog" args={["#1a1009", 9, 19]} />

      {/* Image-based lighting from procedural light panels (network-free) so
          metal/ceramic/glass materials gain real reflections. Baked once. */}
      <Environment frames={1} resolution={256}>
        <Lightformer
          intensity={2.2}
          color="#fff0d4"
          position={[0, 4, 3]}
          scale={[8, 6, 1]}
        />
        <Lightformer
          intensity={0.8}
          color="#9fb8ff"
          position={[-5, 2, -3]}
          scale={[5, 5, 1]}
        />
        <Lightformer
          form="ring"
          intensity={0.7}
          color={accent}
          position={[2.5, 1.5, 2]}
          scale={[3, 3, 1]}
        />
      </Environment>

      {/* Lighting: warm key (shadowed) + cool fill + soft hemisphere */}
      <hemisphereLight args={["#fff3d7", "#2d1a0f", 0.4]} />
      <ambientLight intensity={0.16} />
      <directionalLight
        castShadow
        position={[5, 8, 5]}
        intensity={2.3}
        color="#fff0d4"
        shadow-mapSize={[1024, 1024]}
        shadow-radius={5}
        shadow-bias={-0.0003}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={1}
        shadow-camera-far={28}
      />
      <directionalLight position={[-5, 3.5, -2]} intensity={0.45} color="#9fb8ff" />
      {/* Cool back rim to separate the figurines from the dark room. */}
      <directionalLight position={[0, 4, -6]} intensity={0.9} color="#dce8ff" />
      {/* Warm spotlight pooling on the centred world */}
      <spotLight
        position={[0, 6.5, 3.2]}
        angle={0.55}
        penumbra={0.9}
        intensity={1.95}
        color="#ffdfae"
        distance={16}
      />
      {/* Selected-world coloured accent glow, offset toward the tabletop stage. */}
      <pointLight position={[1.0, 0.9, 1.15]} intensity={1.22} distance={6.2} color={accent} />

      {/* No opaque floor and no 3D room here: the real cozy-library photo
          (home-background-desktop.webp, behind this transparent canvas) already
          provides the shelves, window, lanterns and the wooden table surface.
          The worlds composite straight onto that photo, so we avoid a flat brown
          plane and a duplicate 3D window fighting the painted one. A single warm
          fill from the right echoes the photo's lantern/window glow. */}
      <pointLight position={[4.4, 2.3, -1.2]} intensity={0.7} distance={11} decay={2} color="#ffca80" />

      <TabletopWorlds
        worlds={worlds}
        selectedIndex={selectedIndex}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      />

      <CameraRig reducedMotion={reducedMotion} />
    </Canvas>
  );
}
