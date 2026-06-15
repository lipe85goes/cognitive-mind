"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Lightformer,
  RoundedBox,
} from "@react-three/drei";
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

    const baseX = portrait ? 0 : 0.28;
    const baseY = portrait ? 2.4 : 2.2;
    const baseZ = portrait ? 6.3 : 5.85;
    const targetFov = portrait ? 42 : 36;
    const lookX = portrait ? 0 : 0.55;
    const lookY = portrait ? 0.4 : 0.58;

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
  const stageX = portrait ? 0 : 1.08;
  const stageY = portrait ? -0.1 : -0.22;
  const stageScale = portrait ? 0.98 : 1.05;

  return (
    <group position={[stageX, stageY, 0.05]} scale={stageScale}>
      {/* Carved wooden table tray (raised rim + lighter inlay) */}
      <RoundedBox
        args={[11.5, 0.5, 6.6]}
        radius={0.16}
        smoothness={5}
        position={[0, -0.66, -0.1]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#6b4327" roughness={0.78} metalness={0.06} />
      </RoundedBox>
      <RoundedBox
        args={[10.7, 0.16, 5.8]}
        radius={0.1}
        smoothness={4}
        position={[0, -0.4, -0.1]}
        receiveShadow
      >
        <meshStandardMaterial color="#835636" roughness={0.85} />
      </RoundedBox>
      {[-4.4, -3.2, -2, -0.8, 0.4, 1.6, 2.8, 4].map((x) => (
        <mesh key={x} position={[x, -0.305, -0.08]} castShadow receiveShadow>
          <boxGeometry args={[0.018, 0.03, 5.25]} />
          <meshStandardMaterial color="#9b6742" roughness={0.84} />
        </mesh>
      ))}
      {[-4.9, -2.5, 0, 2.5, 4.9].map((x) => (
        <mesh key={x} position={[x, -0.29, 2.55]} castShadow receiveShadow>
          <cylinderGeometry args={[0.08, 0.08, 0.12, 18]} />
          <meshStandardMaterial color="#b8874f" roughness={0.46} metalness={0.32} />
        </mesh>
      ))}
      <ContactShadows
        position={[0, -0.34, 0.1]}
        opacity={0.62}
        scale={10}
        blur={2.6}
        far={4.8}
        color="#1a0e06"
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

      {/* Ground that fades into the dark room */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.46, 0]}>
        <planeGeometry args={[46, 30]} />
        <meshStandardMaterial color="#51321e" roughness={0.94} metalness={0.04} />
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
