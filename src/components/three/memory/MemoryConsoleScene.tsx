"use client";

import { Canvas } from "@react-three/fiber";
import {
  ContactShadows,
  Environment,
  Lightformer,
  RoundedBox,
} from "@react-three/drei";
import { MemoryPad3D } from "@/components/three/memory/MemoryPad3D";
import type { TapFeedback } from "@/games/color-sequence/useColorSequenceGame";

interface MemoryConsoleSceneProps {
  /** Pad id currently lit (sequence playback or held), or null. */
  litPad: number | null;
  /** Pad id that received the last tap feedback, or null. */
  feedbackPad: number | null;
  feedbackType: TapFeedback;
  canTap: boolean;
  reducedMotion: boolean;
  onPadPress: (id: number) => void;
}

/** Four console pads (2×2), colors + positions matched to the old grid order:
 *  red back-left, blue back-right, green front-left, yellow front-right. */
const PADS: { id: number; color: string; position: [number, number, number] }[] =
  [
    { id: 0, color: "#ef4444", position: [-0.92, 0.18, -0.84] },
    { id: 1, color: "#38bdf8", position: [0.92, 0.18, -0.84] },
    { id: 2, color: "#34d399", position: [-0.92, 0.18, 0.84] },
    { id: 3, color: "#fbbf24", position: [0.92, 0.18, 0.84] },
  ];

/**
 * The real 3D memory console: a brass-trimmed dark deck of four glowing pads on
 * a wooden tabletop, lit cinematically. Transparent canvas so it composites
 * over the cozy room shell behind it. Pure view over the game state.
 */
export function MemoryConsoleScene({
  litPad,
  feedbackPad,
  feedbackType,
  canTap,
  reducedMotion,
  onPadPress,
}: MemoryConsoleSceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [0, 3.5, 4.7], fov: 40 }}
      gl={{ antialias: true, powerPreference: "high-performance", alpha: true }}
    >
      <fog attach="fog" args={["#1a1009", 8, 18]} />

      {/* Network-free image-based lighting so the brass + glossy pads reflect. */}
      <Environment frames={1} resolution={256}>
        <Lightformer
          intensity={2.1}
          color="#fff0d4"
          position={[0, 4, 3]}
          scale={[8, 6, 1]}
        />
        <Lightformer
          intensity={0.7}
          color="#9fb8ff"
          position={[-5, 2, -3]}
          scale={[5, 5, 1]}
        />
      </Environment>

      <hemisphereLight args={["#fff3d7", "#2d1a0f", 0.45]} />
      <ambientLight intensity={0.2} />
      <directionalLight
        castShadow
        position={[3.5, 7, 4]}
        intensity={2.1}
        color="#fff0d4"
        shadow-mapSize={[1024, 1024]}
        shadow-radius={5}
        shadow-bias={-0.0004}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-camera-near={1}
        shadow-camera-far={22}
      />
      <directionalLight position={[-4, 3, -3]} intensity={0.4} color="#9fb8ff" />
      {/* Warm overhead spotlight pooling on the console. */}
      <spotLight
        position={[0, 7, 2.5]}
        angle={0.6}
        penumbra={0.9}
        intensity={1.8}
        color="#ffdfae"
        distance={16}
      />

      {/* ===== Wooden tabletop ===== */}
      <RoundedBox
        args={[5, 0.34, 3.9]}
        radius={0.16}
        smoothness={4}
        position={[0, -0.55, 0]}
        receiveShadow
        castShadow
      >
        <meshStandardMaterial color="#3c2213" roughness={0.82} metalness={0.05} />
      </RoundedBox>

      {/* ===== Console housing ===== */}
      <RoundedBox
        args={[3.05, 0.42, 2.85]}
        radius={0.12}
        smoothness={5}
        position={[0, -0.22, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#5a3b2a" roughness={0.7} metalness={0.12} />
      </RoundedBox>
      {/* Dark inset deck the pads sit on */}
      <RoundedBox
        args={[2.7, 0.16, 2.5]}
        radius={0.08}
        smoothness={5}
        position={[0, 0.02, 0]}
        receiveShadow
      >
        <meshStandardMaterial color="#241a2e" roughness={0.5} metalness={0.22} />
      </RoundedBox>
      {/* Brass keyline framing the deck */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.11, 0]}>
        <torusGeometry args={[1.55, 0.028, 18, 90]} />
        <meshStandardMaterial
          color="#d9ad58"
          roughness={0.3}
          metalness={0.92}
          envMapIntensity={1.5}
        />
      </mesh>

      {/* Brass corner studs */}
      {[
        [-1.32, -1.22],
        [1.32, -1.22],
        [-1.32, 1.22],
        [1.32, 1.22],
      ].map(([x, z], index) => (
        <mesh key={`stud-${index}`} position={[x, 0.11, z]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.05, 18]} />
          <meshStandardMaterial color="#e3b85f" roughness={0.3} metalness={0.9} />
        </mesh>
      ))}

      {PADS.map((pad) => (
        <MemoryPad3D
          key={pad.id}
          id={pad.id}
          color={pad.color}
          position={pad.position}
          lit={litPad === pad.id}
          feedback={feedbackPad === pad.id ? feedbackType : null}
          canTap={canTap}
          reducedMotion={reducedMotion}
          onPress={onPadPress}
        />
      ))}

      <ContactShadows
        position={[0, -0.36, 0]}
        opacity={0.55}
        scale={7}
        blur={2.6}
        far={5}
        color="#120a03"
      />
    </Canvas>
  );
}
