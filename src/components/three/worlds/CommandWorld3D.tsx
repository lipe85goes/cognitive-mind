import type { World3DPalette } from "@/components/three/world-palette";

/** Central de Comandos: a control console with a glowing panel, levers and buttons. */
export function CommandWorld3D({ palette }: { palette: World3DPalette }) {
  return (
    <group>
      {/* Console body, slightly tilted back */}
      <group rotation={[-0.18, 0, 0]} position={[0, 0.22, 0]}>
        <mesh castShadow>
          <boxGeometry args={[1.0, 0.42, 0.62]} />
          <meshStandardMaterial color={palette.deep} roughness={0.5} metalness={0.2} />
        </mesh>
        {/* Glowing screen */}
        <mesh position={[0, 0.06, 0.32]}>
          <boxGeometry args={[0.62, 0.26, 0.02]} />
          <meshStandardMaterial
            color={palette.glow}
            emissive={palette.glow}
            emissiveIntensity={1.1}
            roughness={0.2}
          />
        </mesh>
        {/* Buttons row */}
        {palette.accents.map((accent, index) => (
          <mesh key={index} position={[-0.26 + index * 0.26, 0.22, 0.05]}>
            <cylinderGeometry args={[0.06, 0.06, 0.06, 18]} />
            <meshStandardMaterial color={accent} emissive={accent} emissiveIntensity={0.8} />
          </mesh>
        ))}
      </group>
      {/* Levers */}
      {[-0.22, 0.22].map((x, index) => (
        <group key={index} position={[x, 0.44, -0.18]} rotation={[0.4, 0, index === 0 ? 0.2 : -0.2]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.02, 0.02, 0.34, 12]} />
            <meshStandardMaterial color="#cdd6e0" roughness={0.3} metalness={0.6} />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <sphereGeometry args={[0.06, 18, 18]} />
            <meshStandardMaterial color={palette.accents[index]} roughness={0.3} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
