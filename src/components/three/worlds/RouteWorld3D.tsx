import { RoundedBox } from "@react-three/drei";
import type { World3DPalette } from "@/components/three/world-palette";

/** Rota Estratégica: a board with a checker surface, glowing path, pawn, guardian and exit flag. */
export function RouteWorld3D({ palette }: { palette: World3DPalette }) {
  const pathStones: [number, number][] = [
    [-0.34, 0.28],
    [-0.14, 0.1],
    [0.08, -0.08],
    [0.3, -0.28],
  ];
  // 3x3 checker tiles
  const tiles: { x: number; z: number; dark: boolean }[] = [];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      tiles.push({ x: (i - 1) * 0.3, z: (j - 1) * 0.26, dark: (i + j) % 2 === 0 });
    }
  }

  return (
    <group>
      {/* Board */}
      <RoundedBox args={[1.02, 0.1, 0.88]} radius={0.05} smoothness={4} position={[0, 0.05, 0]} receiveShadow castShadow>
        <meshStandardMaterial color={palette.deep} roughness={0.7} />
      </RoundedBox>
      {/* Checker tiles */}
      {tiles.map((tile, index) => (
        <mesh key={index} position={[tile.x, 0.11, tile.z]} receiveShadow>
          <boxGeometry args={[0.26, 0.02, 0.22]} />
          <meshStandardMaterial color={tile.dark ? palette.deep : palette.base} roughness={0.6} />
        </mesh>
      ))}
      {/* Glowing route stones */}
      {pathStones.map(([x, z], index) => (
        <mesh key={index} position={[x, 0.14, z]}>
          <cylinderGeometry args={[0.07, 0.07, 0.04, 16]} />
          <meshStandardMaterial color={palette.glow} emissive={palette.glow} emissiveIntensity={0.9} toneMapped={false} />
        </mesh>
      ))}
      {/* Player pawn */}
      <group position={[-0.36, 0.11, 0.32]}>
        <mesh castShadow position={[0, 0.07, 0]}>
          <cylinderGeometry args={[0.1, 0.13, 0.07, 22]} />
          <meshStandardMaterial color={palette.accents[0]} roughness={0.35} />
        </mesh>
        <mesh castShadow position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.05, 0.09, 0.16, 22]} />
          <meshStandardMaterial color={palette.accents[0]} roughness={0.35} />
        </mesh>
        <mesh castShadow position={[0, 0.31, 0]}>
          <sphereGeometry args={[0.1, 22, 22]} />
          <meshStandardMaterial color={palette.accents[0]} roughness={0.3} />
        </mesh>
      </group>
      {/* Guardian: a small angular sentinel */}
      <group position={[0.32, 0.11, -0.3]}>
        <mesh castShadow position={[0, 0.13, 0]}>
          <coneGeometry args={[0.16, 0.3, 6]} />
          <meshStandardMaterial color={palette.accents[1]} roughness={0.45} metalness={0.2} />
        </mesh>
        <mesh position={[0, 0.34, 0]}>
          <sphereGeometry args={[0.07, 16, 16]} />
          <meshStandardMaterial color={palette.accents[1]} emissive={palette.accents[1]} emissiveIntensity={0.6} toneMapped={false} />
        </mesh>
      </group>
      {/* Exit flag */}
      <group position={[0.38, 0.11, 0.34]}>
        <mesh castShadow position={[0, 0.22, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.44, 10]} />
          <meshStandardMaterial color="#e8e2d0" />
        </mesh>
        <mesh position={[0.1, 0.36, 0]}>
          <boxGeometry args={[0.18, 0.11, 0.01]} />
          <meshStandardMaterial color={palette.accents[2]} emissive={palette.accents[2]} emissiveIntensity={0.6} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
