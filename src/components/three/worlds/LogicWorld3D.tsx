import type { World3DPalette } from "@/components/three/world-palette";

/** Trilha Lógica: numbered stepping tiles joined by a glowing path, with crystals. */
export function LogicWorld3D({ palette }: { palette: World3DPalette }) {
  const tiles: [number, number][] = [
    [-0.34, 0.22],
    [-0.02, 0.0],
    [0.32, -0.22],
  ];

  return (
    <group>
      {/* Base slab */}
      <mesh receiveShadow position={[0, 0.05, 0]}>
        <boxGeometry args={[1.0, 0.1, 0.82]} />
        <meshStandardMaterial color={palette.deep} roughness={0.7} />
      </mesh>
      {/* Glowing path line connecting the tiles */}
      <mesh position={[-0.02, 0.11, 0]} rotation={[0, -0.62, 0]}>
        <boxGeometry args={[0.95, 0.02, 0.06]} />
        <meshStandardMaterial color={palette.glow} emissive={palette.glow} emissiveIntensity={0.9} />
      </mesh>
      {/* Numbered stepping tiles */}
      {tiles.map(([x, z], index) => (
        <mesh key={index} castShadow position={[x, 0.16, z]}>
          <boxGeometry args={[0.24, 0.12, 0.24]} />
          <meshStandardMaterial
            color={palette.base}
            emissive={palette.glow}
            emissiveIntensity={0.25}
            roughness={0.4}
          />
        </mesh>
      ))}
      {/* Crystals */}
      {[
        [-0.4, -0.26],
        [0.42, 0.28],
      ].map(([x, z], index) => (
        <mesh key={index} castShadow position={[x, 0.2, z]} rotation={[0, 0.4, 0]}>
          <octahedronGeometry args={[0.12, 0]} />
          <meshStandardMaterial
            color={palette.accents[index % palette.accents.length]}
            emissive={palette.accents[index % palette.accents.length]}
            emissiveIntensity={0.8}
            roughness={0.1}
            metalness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}
