import type { World3DPalette } from "@/components/three/world-palette";

/** Rota Estratégica: a small board with a winding path, pawn, flag and guardian. */
export function RouteWorld3D({ palette }: { palette: World3DPalette }) {
  const pathStones: [number, number][] = [
    [-0.32, 0.26],
    [-0.1, 0.08],
    [0.12, -0.12],
    [0.34, -0.3],
  ];

  return (
    <group>
      {/* Board */}
      <mesh receiveShadow castShadow position={[0, 0.05, 0]}>
        <boxGeometry args={[1.0, 0.1, 0.86]} />
        <meshStandardMaterial color={palette.deep} roughness={0.7} />
      </mesh>
      {/* Glowing route stones */}
      {pathStones.map(([x, z], index) => (
        <mesh key={index} position={[x, 0.13, z]}>
          <cylinderGeometry args={[0.08, 0.08, 0.05, 18]} />
          <meshStandardMaterial
            color={palette.glow}
            emissive={palette.glow}
            emissiveIntensity={0.7}
          />
        </mesh>
      ))}
      {/* Player pawn */}
      <group position={[-0.34, 0.1, 0.3]}>
        <mesh castShadow position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.07, 0.11, 0.22, 20]} />
          <meshStandardMaterial color={palette.accents[0]} roughness={0.4} />
        </mesh>
        <mesh castShadow position={[0, 0.28, 0]}>
          <sphereGeometry args={[0.1, 20, 20]} />
          <meshStandardMaterial color={palette.accents[0]} roughness={0.35} />
        </mesh>
      </group>
      {/* Guardian (placeholder block) */}
      <mesh castShadow position={[0.32, 0.18, -0.28]}>
        <boxGeometry args={[0.2, 0.26, 0.2]} />
        <meshStandardMaterial color={palette.accents[1]} roughness={0.5} />
      </mesh>
      {/* Exit flag */}
      <group position={[0.36, 0.1, 0.32]}>
        <mesh castShadow position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.015, 0.015, 0.4, 10]} />
          <meshStandardMaterial color="#e8e2d0" />
        </mesh>
        <mesh position={[0.09, 0.32, 0]}>
          <boxGeometry args={[0.16, 0.1, 0.01]} />
          <meshStandardMaterial
            color={palette.accents[2]}
            emissive={palette.accents[2]}
            emissiveIntensity={0.5}
          />
        </mesh>
      </group>
    </group>
  );
}
