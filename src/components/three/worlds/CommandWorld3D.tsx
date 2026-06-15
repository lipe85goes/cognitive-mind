import { RoundedBox } from "@react-three/drei";
import type { World3DPalette } from "@/components/three/world-palette";

/** Central de Comandos: retro brass console with screen, levers, wires and lights. */
export function CommandWorld3D({ palette }: { palette: World3DPalette }) {
  const buttons = [
    { x: -0.35, z: 0.18, color: "#ef4444" },
    { x: -0.15, z: 0.18, color: "#fbbf24" },
    { x: 0.05, z: 0.18, color: "#38bdf8" },
    { x: 0.25, z: 0.18, color: "#34d399" },
    { x: -0.25, z: 0.35, color: "#fde68a" },
    { x: 0.18, z: 0.35, color: "#fb7185" },
  ];

  return (
    <group>
      <RoundedBox
        args={[1.28, 0.14, 0.95]}
        radius={0.1}
        smoothness={5}
        position={[0, 0.03, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#4a3724" roughness={0.75} metalness={0.12} />
      </RoundedBox>

      <group rotation={[-0.18, 0, 0]} position={[0, 0.3, -0.08]}>
        <RoundedBox args={[1.08, 0.5, 0.58]} radius={0.09} smoothness={5} castShadow receiveShadow>
          <meshStandardMaterial color="#5d4a35" roughness={0.38} metalness={0.48} />
        </RoundedBox>
        <RoundedBox args={[0.63, 0.31, 0.04]} radius={0.035} smoothness={4} position={[0, 0.08, 0.31]} castShadow>
          <meshStandardMaterial color="#102d25" roughness={0.22} metalness={0.18} />
        </RoundedBox>
        <RoundedBox args={[0.54, 0.22, 0.045]} radius={0.025} smoothness={3} position={[0, 0.08, 0.34]}>
          <meshStandardMaterial
            color={palette.glow}
            emissive={palette.glow}
            emissiveIntensity={1.45}
            roughness={0.1}
            toneMapped={false}
          />
        </RoundedBox>
        <pointLight position={[0, 0.1, 0.45]} intensity={0.55} distance={1.4} color={palette.glow} />

        {[-0.22, 0, 0.22].map((x, index) => (
          <mesh key={index} position={[x, 0.09, 0.365]}>
            <boxGeometry args={[0.15, 0.012, 0.01]} />
            <meshStandardMaterial
              color="#bbf7d0"
              emissive="#34d399"
              emissiveIntensity={0.7}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      <group position={[0, 0.25, 0.3]}>
        <RoundedBox args={[1.08, 0.16, 0.42]} radius={0.06} smoothness={4} castShadow receiveShadow>
          <meshStandardMaterial color={palette.deep} roughness={0.48} metalness={0.34} />
        </RoundedBox>
        {buttons.map((button) => (
          <mesh key={`${button.x}-${button.z}`} castShadow position={[button.x, 0.12, button.z - 0.3]}>
            <cylinderGeometry args={[0.055, 0.065, 0.055, 20]} />
            <meshStandardMaterial
              color={button.color}
              emissive={button.color}
              emissiveIntensity={0.85}
              roughness={0.22}
              toneMapped={false}
            />
          </mesh>
        ))}
      </group>

      {[-0.34, 0.34].map((x, index) => (
        <group key={x} position={[x, 0.54, -0.12]} rotation={[0.5, 0, index === 0 ? 0.25 : -0.25]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.023, 0.023, 0.42, 14]} />
            <meshStandardMaterial color="#d8c28a" roughness={0.26} metalness={0.86} />
          </mesh>
          <mesh castShadow position={[0, 0.24, 0]}>
            <sphereGeometry args={[0.075, 20, 20]} />
            <meshStandardMaterial
              color={palette.accents[index]}
              emissive={palette.accents[index]}
              emissiveIntensity={0.52}
              roughness={0.22}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {[-0.5, -0.38, 0.42, 0.53].map((x, index) => (
        <group key={x} position={[x, 0.48, -0.36]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.018, 0.018, 0.36 + index * 0.03, 10]} />
            <meshStandardMaterial color="#c6a15a" roughness={0.32} metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.22 + index * 0.015, 0]}>
            <sphereGeometry args={[0.043, 16, 16]} />
            <meshStandardMaterial
              color={index % 2 === 0 ? "#fbbf24" : "#fb7185"}
              emissive={index % 2 === 0 ? "#fbbf24" : "#fb7185"}
              emissiveIntensity={1.0}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {[-0.45, -0.22, 0.22, 0.45].map((x, index) => (
        <mesh key={x} position={[x, 0.2, -0.47]} rotation={[0, 0, index % 2 ? -0.25 : 0.25]}>
          <torusGeometry args={[0.12, 0.018, 8, 24, Math.PI]} />
          <meshStandardMaterial color={palette.accents[index % palette.accents.length]} roughness={0.38} metalness={0.4} />
        </mesh>
      ))}

      <group position={[0.49, 0.17, 0.42]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.09, 0.1, 0.1, 20]} />
          <meshStandardMaterial color="#89633c" roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <sphereGeometry args={[0.075, 18, 18]} />
          <meshStandardMaterial
            color="#fde68a"
            emissive="#fbbf24"
            emissiveIntensity={1.45}
            toneMapped={false}
          />
        </mesh>
        <pointLight position={[0, 0.16, 0]} intensity={0.28} distance={0.9} color="#fbbf24" />
      </group>
    </group>
  );
}
