import type { World3DPalette } from "@/components/three/world-palette";

/** Circuito de Memória: a small console with four glowing memory pads. */
export function MemoryWorld3D({ palette }: { palette: World3DPalette }) {
  const pads: [number, number][] = [
    [-0.26, -0.18],
    [0.26, -0.18],
    [-0.26, 0.18],
    [0.26, 0.18],
  ];

  return (
    <group>
      {/* Console body */}
      <mesh castShadow position={[0, 0.13, 0]}>
        <boxGeometry args={[0.98, 0.26, 0.78]} />
        <meshStandardMaterial color={palette.deep} roughness={0.55} metalness={0.15} />
      </mesh>
      {/* Console rim */}
      <mesh castShadow position={[0, 0.27, 0]}>
        <boxGeometry args={[1.04, 0.05, 0.84]} />
        <meshStandardMaterial color={palette.base} roughness={0.5} />
      </mesh>
      {/* Glowing pads */}
      {pads.map(([x, z], index) => (
        <mesh key={index} castShadow position={[x, 0.32, z]}>
          <cylinderGeometry args={[0.15, 0.16, 0.06, 28]} />
          <meshStandardMaterial
            color={palette.accents[index % palette.accents.length]}
            emissive={palette.accents[index % palette.accents.length]}
            emissiveIntensity={0.9}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}
