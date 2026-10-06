import type { World3DPalette } from "@/components/three/world-palette";

/** Estúdio das Descobertas: a small explorer's desk — globe, books, lantern and a magnifier. */
export function DiscoveryWorld3D({ palette }: { palette: World3DPalette }) {
  const books: { x: number; z: number; height: number; color: string }[] = [
    { x: -0.42, z: -0.12, height: 0.2, color: "#7d2f24" },
    { x: -0.36, z: -0.12, height: 0.24, color: "#2d4b6b" },
    { x: -0.3, z: -0.12, height: 0.18, color: "#4a6b3a" },
  ];

  return (
    <group>
      <mesh position={[0, 0.06, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.68, 0.75, 0.13, 56]} />
        <meshStandardMaterial color={palette.deep} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.135, 0]} receiveShadow>
        <cylinderGeometry args={[0.6, 0.62, 0.03, 56]} />
        <meshStandardMaterial color="#6b2421" roughness={0.95} />
      </mesh>

      {/* the round table and its map */}
      <mesh castShadow position={[0, 0.27, 0.05]}>
        <cylinderGeometry args={[0.05, 0.08, 0.24, 20]} />
        <meshStandardMaterial color={palette.base} roughness={0.7} />
      </mesh>
      <mesh castShadow receiveShadow position={[0, 0.4, 0.05]}>
        <cylinderGeometry args={[0.34, 0.34, 0.03, 40]} />
        <meshStandardMaterial color={palette.base} roughness={0.6} />
      </mesh>
      <mesh position={[0.04, 0.418, 0.06]} rotation={[-Math.PI / 2, 0, 0.12]}>
        <planeGeometry args={[0.36, 0.24]} />
        <meshStandardMaterial color="#ecd9ab" roughness={0.9} />
      </mesh>

      {/* the magnifier on the map */}
      <group position={[0.1, 0.43, 0.08]} rotation={[-Math.PI / 2, 0, 0.7]}>
        <mesh>
          <torusGeometry args={[0.055, 0.011, 10, 28]} />
          <meshStandardMaterial color={palette.accents[2]} metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0.095, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.014, 0.08, 10]} />
          <meshStandardMaterial color="#6b3a1f" roughness={0.6} />
        </mesh>
      </group>

      {/* the globe on its stand */}
      <group position={[0.42, 0.15, -0.18]}>
        <mesh castShadow position={[0, 0.16, 0]}>
          <cylinderGeometry args={[0.012, 0.03, 0.3, 10]} />
          <meshStandardMaterial color="#4a2a16" roughness={0.7} />
        </mesh>
        <mesh castShadow position={[0, 0.38, 0]}>
          <sphereGeometry args={[0.13, 28, 20]} />
          <meshStandardMaterial color={palette.accents[1]} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.38, 0]} rotation={[0, 0, 0.4]}>
          <torusGeometry args={[0.15, 0.008, 8, 36]} />
          <meshStandardMaterial color={palette.accents[2]} metalness={0.7} roughness={0.3} />
        </mesh>
      </group>

      {/* books and the glowing lantern */}
      {books.map((book, index) => (
        <mesh key={index} castShadow position={[book.x, 0.15 + book.height / 2, book.z]}>
          <boxGeometry args={[0.05, book.height, 0.16]} />
          <meshStandardMaterial color={book.color} roughness={0.8} />
        </mesh>
      ))}
      <group position={[-0.38, 0.15, 0.3]}>
        <mesh castShadow position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.05, 0.06, 0.06, 16]} />
          <meshStandardMaterial color={palette.accents[2]} metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.13, 0]}>
          <cylinderGeometry args={[0.045, 0.045, 0.1, 16]} />
          <meshStandardMaterial color={palette.glow} emissive={palette.glow} emissiveIntensity={0.9} transparent opacity={0.85} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <coneGeometry args={[0.055, 0.05, 16]} />
          <meshStandardMaterial color={palette.accents[2]} metalness={0.6} roughness={0.35} />
        </mesh>
      </group>
    </group>
  );
}
