import { RoundedBox } from "@react-three/drei";
import type { World3DPalette } from "@/components/three/world-palette";

/** Central de Comandos: a tactile control console with a glowing screen, levers, buttons and a signal line. */
export function CommandWorld3D({ palette }: { palette: World3DPalette }) {
  return (
    <group>
      {/* Console body, tilted back */}
      <group rotation={[-0.2, 0, 0]} position={[0, 0.24, 0]}>
        <RoundedBox args={[1.0, 0.44, 0.6]} radius={0.08} smoothness={5} castShadow>
          <meshStandardMaterial color={palette.deep} roughness={0.45} metalness={0.3} />
        </RoundedBox>
        {/* Glowing screen */}
        <RoundedBox args={[0.66, 0.28, 0.03]} radius={0.03} smoothness={3} position={[0, 0.07, 0.31]}>
          <meshStandardMaterial color={palette.glow} emissive={palette.glow} emissiveIntensity={1.3} roughness={0.15} toneMapped={false} />
        </RoundedBox>
        {/* Signal line across the front */}
        <mesh position={[0, -0.12, 0.31]}>
          <boxGeometry args={[0.7, 0.03, 0.02]} />
          <meshStandardMaterial color={palette.accents[1]} emissive={palette.accents[1]} emissiveIntensity={1} toneMapped={false} />
        </mesh>
        {/* Buttons */}
        {palette.accents.map((accent, index) => (
          <mesh key={index} castShadow position={[-0.26 + index * 0.26, 0.24, 0.06]}>
            <cylinderGeometry args={[0.06, 0.06, 0.07, 20]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.85} toneMapped={false} />
          </mesh>
        ))}
      </group>
      {/* Levers */}
      {[-0.24, 0.24].map((x, index) => (
        <group key={index} position={[x, 0.46, -0.16]} rotation={[0.45, 0, index === 0 ? 0.25 : -0.25]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.022, 0.022, 0.36, 12]} />
            <meshStandardMaterial color="#d2dae4" roughness={0.3} metalness={0.7} />
          </mesh>
          <mesh castShadow position={[0, 0.21, 0]}>
            <sphereGeometry args={[0.07, 18, 18]} />
            <meshStandardMaterial color={palette.accents[index]} emissive={palette.accents[index]} emissiveIntensity={0.5} roughness={0.3} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* Antenna with a blinking tip */}
      <group position={[0.4, 0.4, -0.2]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.012, 0.012, 0.4, 8]} />
          <meshStandardMaterial color="#d2dae4" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.24, 0]}>
          <sphereGeometry args={[0.04, 14, 14]} />
          <meshStandardMaterial color={palette.glow} emissive={palette.glow} emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
      </group>
    </group>
  );
}
