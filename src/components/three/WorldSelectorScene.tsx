"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Lightformer } from "@react-three/drei";
import { MathUtils } from "three";
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

    const targetX = reducedMotion ? baseX : baseX + pointer.x * 0.32;
    const targetY = reducedMotion ? baseY : baseY + pointer.y * 0.16;

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
  const stageY = portrait ? -0.1 : 0.04;
  const stageScale = portrait ? 0.98 : 1.12;

  return (
    <group position={[stageX, stageY, 0.05]} scale={stageScale}>
      {/* Round carved wooden tabletop: the worlds sit on one premium board.
          A wide cylinder scaled in X/Z reads as a circular board in
          perspective while staying wide enough for the carousel and shallow
          enough (in Z) to clear the camera. The surface stays at the same
          Y as before, so the per-world glow disc/halo are untouched (no
          z-fighting). */}
      <mesh position={[0, -0.66, 0]} scale={[5.95, 1, 3.35]} castShadow receiveShadow>
        <cylinderGeometry args={[1, 1.06, 0.5, 72]} />
        <meshStandardMaterial color="#6b4327" roughness={0.8} metalness={0.06} />
      </mesh>
      {/* lighter inlay surface */}
      <mesh position={[0, -0.4, 0]} scale={[5.5, 1, 3.0]} receiveShadow>
        <cylinderGeometry args={[1, 1.02, 0.16, 72]} />
        <meshStandardMaterial color="#875839" roughness={0.82} />
      </mesh>
      {/* brass band around the board edge */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.35, 0]}
        scale={[5.74, 3.16, 1]}
      >
        <torusGeometry args={[1, 0.013, 18, 120]} />
        <meshStandardMaterial
          color="#cfa14e"
          roughness={0.32}
          metalness={0.9}
          envMapIntensity={1.5}
        />
      </mesh>
      {/* concentric carved grooves on the surface (flush, decorative) */}
      {[0.55, 0.8].map((k) => (
        <mesh
          key={k}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.314, 0]}
          scale={[5.5 * k, 3.0 * k, 1]}
        >
          <torusGeometry args={[1, 0.0045, 8, 120]} />
          <meshStandardMaterial color="#5e3a23" roughness={0.85} />
        </mesh>
      ))}
      <ContactShadows
        position={[0, -0.33, 0.1]}
        opacity={0.6}
        scale={13}
        blur={2.8}
        far={5}
        color="#160b04"
      />

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
      gl={{ antialias: true, powerPreference: "high-performance" }}
    >
      {/* Cozy warm room: deep background + fog so edges fall into shadow */}
      <color attach="background" args={["#24160e"]} />
      <fog attach="fog" args={["#24160e", 8.5, 18]} />

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

      {/* Ground that fades into the dark room (kept deep so the round board
          reads as the lit focus rather than a flat brown wall) */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.46, 0]}>
        <planeGeometry args={[46, 30]} />
        <meshStandardMaterial color="#341d0f" roughness={0.96} metalness={0.03} />
      </mesh>

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
