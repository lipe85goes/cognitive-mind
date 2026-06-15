import { RoundedBox } from "@react-three/drei";
import type { World3DPalette } from "@/components/three/world-palette";

/** Jardim de Sementes: an organic soil tray with potted sprouts, a flower and a watering can. */
export function GardenWorld3D({ palette }: { palette: World3DPalette }) {
  const pots: number[] = [-0.32, 0, 0.32];

  return (
    <group>
      {/* Soil tray with a raised rim */}
      <RoundedBox args={[1.0, 0.16, 0.62]} radius={0.06} smoothness={4} position={[0, 0.08, 0]} receiveShadow castShadow>
        <meshStandardMaterial color="#7a5436" roughness={0.85} />
      </RoundedBox>
      <mesh position={[0, 0.17, 0]} receiveShadow>
        <boxGeometry args={[0.86, 0.04, 0.48]} />
        <meshStandardMaterial color="#3f2a18" roughness={0.95} />
      </mesh>

      {/* Pots with sprouts */}
      {pots.map((x, index) => (
        <group key={index} position={[x, 0.16, -0.02]}>
          <mesh castShadow position={[0, 0.1, 0]}>
            <cylinderGeometry args={[0.14, 0.1, 0.2, 24]} />
            <meshStandardMaterial color="#c47b4a" roughness={0.7} />
          </mesh>
          {/* Soil top */}
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.03, 24]} />
            <meshStandardMaterial color="#3f2a18" roughness={0.95} />
          </mesh>
          {/* Stem */}
          <mesh position={[0, 0.32, 0]}>
            <cylinderGeometry args={[0.016, 0.022, 0.22, 10]} />
            <meshStandardMaterial color={palette.deep} roughness={0.6} />
          </mesh>
          {/* Leaves */}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.07, 0.38, 0]} rotation={[0, 0, side * 0.8]} scale={[1, 1.5, 1]}>
              <sphereGeometry args={[0.055, 16, 16]} />
              <meshStandardMaterial
                color={palette.accents[index % palette.accents.length]}
                emissive={palette.accents[index % palette.accents.length]}
                emissiveIntensity={0.2}
                roughness={0.55}
              />
            </mesh>
          ))}
          {/* A small bloom on the centre pot */}
          {index === 1 && (
            <mesh position={[0, 0.5, 0]}>
              <sphereGeometry args={[0.06, 18, 18]} />
              <meshStandardMaterial color={palette.glow} emissive={palette.glow} emissiveIntensity={1.1} toneMapped={false} />
            </mesh>
          )}
        </group>
      ))}

      {/* Watering can */}
      <group position={[0.48, 0.2, 0.22]} rotation={[0, -0.5, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.12, 0.13, 0.2, 22]} />
          <meshStandardMaterial color={palette.base} roughness={0.3} metalness={0.6} />
        </mesh>
        <mesh position={[0.17, 0.05, 0]} rotation={[0, 0, -0.7]}>
          <cylinderGeometry args={[0.022, 0.04, 0.26, 12]} />
          <meshStandardMaterial color={palette.base} roughness={0.3} metalness={0.6} />
        </mesh>
        <mesh position={[0, 0.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.09, 0.018, 10, 22, Math.PI]} />
          <meshStandardMaterial color={palette.base} roughness={0.3} metalness={0.6} />
        </mesh>
      </group>
    </group>
  );
}
