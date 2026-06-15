import type { World3DPalette } from "@/components/three/world-palette";

/** Jardim de Sementes: a soil tray with potted sprouts and a watering can. */
export function GardenWorld3D({ palette }: { palette: World3DPalette }) {
  const pots: number[] = [-0.32, 0, 0.32];

  return (
    <group>
      {/* Soil tray */}
      <mesh receiveShadow castShadow position={[0, 0.07, 0]}>
        <boxGeometry args={[1.0, 0.14, 0.6]} />
        <meshStandardMaterial color="#6b4a2f" roughness={0.85} />
      </mesh>
      {/* Pots with sprouts */}
      {pots.map((x, index) => (
        <group key={index} position={[x, 0.14, -0.02]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.14, 0.11, 0.2, 22]} />
            <meshStandardMaterial color="#c47b4a" roughness={0.75} />
          </mesh>
          {/* Stem */}
          <mesh position={[0, 0.22, 0]}>
            <cylinderGeometry args={[0.015, 0.02, 0.22, 10]} />
            <meshStandardMaterial color={palette.deep} />
          </mesh>
          {/* Leaves */}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * 0.06, 0.26, 0]} rotation={[0, 0, side * 0.7]}>
              <sphereGeometry args={[0.06, 14, 14]} />
              <meshStandardMaterial
                color={palette.accents[index % palette.accents.length]}
                emissive={palette.accents[index % palette.accents.length]}
                emissiveIntensity={0.25}
                roughness={0.6}
              />
            </mesh>
          ))}
        </group>
      ))}
      {/* Watering can */}
      <group position={[0.46, 0.18, 0.24]} rotation={[0, -0.5, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.12, 0.13, 0.2, 20]} />
          <meshStandardMaterial color={palette.base} roughness={0.35} metalness={0.55} />
        </mesh>
        {/* Spout */}
        <mesh position={[0.16, 0.04, 0]} rotation={[0, 0, -0.7]}>
          <cylinderGeometry args={[0.022, 0.035, 0.24, 12]} />
          <meshStandardMaterial color={palette.base} roughness={0.35} metalness={0.55} />
        </mesh>
        {/* Handle */}
        <mesh position={[0, 0.14, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.09, 0.018, 10, 20, Math.PI]} />
          <meshStandardMaterial color={palette.base} roughness={0.35} metalness={0.55} />
        </mesh>
      </group>
    </group>
  );
}
