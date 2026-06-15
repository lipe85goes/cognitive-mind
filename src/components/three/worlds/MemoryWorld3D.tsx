import { RoundedBox } from "@react-three/drei";
import type { World3DPalette } from "@/components/three/world-palette";

/** Circuito de Memória: a rounded console with four glowing pads and a memory orb. */
export function MemoryWorld3D({ palette }: { palette: World3DPalette }) {
  const pads: [number, number][] = [
    [-0.27, -0.2],
    [0.27, -0.2],
    [-0.27, 0.2],
    [0.27, 0.2],
  ];

  return (
    <group>
      {/* Console base */}
      <RoundedBox args={[1.0, 0.2, 0.8]} radius={0.08} smoothness={5} position={[0, 0.1, 0]} castShadow>
        <meshStandardMaterial color={palette.deep} roughness={0.5} metalness={0.2} />
      </RoundedBox>
      {/* Raised face plate */}
      <RoundedBox args={[0.92, 0.06, 0.72]} radius={0.05} smoothness={4} position={[0, 0.22, 0]} castShadow>
        <meshStandardMaterial color={palette.base} roughness={0.45} />
      </RoundedBox>

      {/* Four glowing domed pads */}
      {pads.map(([x, z], index) => {
        const accent = palette.accents[index % palette.accents.length];
        return (
          <mesh key={index} castShadow position={[x, 0.27, z]}>
            <sphereGeometry args={[0.15, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial
              color={accent}
              emissive={accent}
              emissiveIntensity={1.1}
              roughness={0.25}
              toneMapped={false}
            />
          </mesh>
        );
      })}

      {/* Central memory tower + orb */}
      <mesh castShadow position={[0, 0.34, 0]}>
        <cylinderGeometry args={[0.05, 0.07, 0.2, 16]} />
        <meshStandardMaterial color="#e7e0f5" roughness={0.4} metalness={0.4} />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.12, 24, 24]} />
        <meshStandardMaterial
          color={palette.glow}
          emissive={palette.glow}
          emissiveIntensity={1.4}
          roughness={0.15}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
