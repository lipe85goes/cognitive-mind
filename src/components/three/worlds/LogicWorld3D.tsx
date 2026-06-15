import { RoundedBox } from "@react-three/drei";
import type { World3DPalette } from "@/components/three/world-palette";

/** Trilha Lógica: ascending stepping blocks joined by a glowing path, with crystals. */
export function LogicWorld3D({ palette }: { palette: World3DPalette }) {
  // Three ascending steps along a diagonal.
  const steps: { x: number; z: number; h: number }[] = [
    { x: -0.34, z: 0.24, h: 0.14 },
    { x: -0.02, z: 0.0, h: 0.24 },
    { x: 0.32, z: -0.24, h: 0.36 },
  ];

  return (
    <group>
      {/* Base slab */}
      <RoundedBox args={[1.02, 0.1, 0.84]} radius={0.05} smoothness={4} position={[0, 0.05, 0]} receiveShadow castShadow>
        <meshStandardMaterial color={palette.deep} roughness={0.7} />
      </RoundedBox>
      {/* Glowing path line connecting the steps */}
      <mesh position={[-0.02, 0.11, 0]} rotation={[0, -0.62, 0]}>
        <boxGeometry args={[0.95, 0.02, 0.05]} />
        <meshStandardMaterial color={palette.glow} emissive={palette.glow} emissiveIntensity={1} toneMapped={false} />
      </mesh>
      {/* Ascending numbered stepping blocks (glowing tops) */}
      {steps.map((step, index) => (
        <group key={index} position={[step.x, 0.1 + step.h / 2, step.z]}>
          <RoundedBox args={[0.26, step.h, 0.26]} radius={0.04} smoothness={4} castShadow receiveShadow>
            <meshStandardMaterial color={palette.base} roughness={0.4} metalness={0.1} />
          </RoundedBox>
          <mesh position={[0, step.h / 2 + 0.012, 0]}>
            <boxGeometry args={[0.2, 0.02, 0.2]} />
            <meshStandardMaterial
              color={palette.glow}
              emissive={palette.glow}
              emissiveIntensity={0.6 + index * 0.25}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}
      {/* Crystals */}
      {[
        [-0.42, -0.26, 0.16],
        [0.44, 0.3, 0.2],
      ].map(([x, z, s], index) => (
        <mesh key={index} castShadow position={[x, 0.1 + s, z]} rotation={[0, 0.4, 0]}>
          <octahedronGeometry args={[s, 0]} />
          <meshStandardMaterial
            color={palette.accents[index % palette.accents.length]}
            emissive={palette.accents[index % palette.accents.length]}
            emissiveIntensity={0.9}
            roughness={0.1}
            metalness={0.3}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}
