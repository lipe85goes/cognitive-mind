import { RoundedBox } from "@react-three/drei";
import type { World3DPalette } from "@/components/three/world-palette";

/** Circuito de Memória: premium console with pads, cables and a glowing tower. */
export function MemoryWorld3D({ palette }: { palette: World3DPalette }) {
  const pads: { x: number; z: number; color: string }[] = [
    { x: -0.35, z: -0.18, color: "#ef4444" },
    { x: 0.35, z: -0.18, color: "#38bdf8" },
    { x: -0.35, z: 0.22, color: "#34d399" },
    { x: 0.35, z: 0.22, color: "#fbbf24" },
  ];

  const cableRuns: { x: number; z: number; rotation: number; length: number }[] = [
    { x: -0.34, z: 0.02, rotation: 0.1, length: 0.42 },
    { x: 0.34, z: 0.02, rotation: -0.1, length: 0.42 },
    { x: 0, z: -0.28, rotation: Math.PI / 2, length: 0.58 },
  ];

  return (
    <group>
      <RoundedBox
        args={[1.26, 0.14, 1.0]}
        radius={0.09}
        smoothness={5}
        position={[0, 0.03, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#5a3b2a" roughness={0.76} metalness={0.08} />
      </RoundedBox>
      <RoundedBox
        args={[1.06, 0.18, 0.8]}
        radius={0.09}
        smoothness={5}
        position={[0, 0.18, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={palette.deep} roughness={0.42} metalness={0.22} />
      </RoundedBox>
      <RoundedBox
        args={[0.92, 0.045, 0.64]}
        radius={0.06}
        smoothness={4}
        position={[0, 0.3, 0.02]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#2f2857" roughness={0.5} metalness={0.18} />
      </RoundedBox>

      {cableRuns.map((cable, index) => (
        <mesh
          key={index}
          castShadow
          position={[cable.x, 0.34, cable.z]}
          rotation={[0, cable.rotation, 0]}
        >
          <boxGeometry args={[cable.length, 0.025, 0.035]} />
          <meshStandardMaterial
            color="#b7e7ff"
            emissive={palette.glow}
            emissiveIntensity={0.4}
            toneMapped={false}
          />
        </mesh>
      ))}

      {pads.map((pad) => (
        <group key={`${pad.x}-${pad.z}`} position={[pad.x, 0.36, pad.z]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.18, 0.2, 0.08, 32]} />
            <meshStandardMaterial color="#191428" roughness={0.38} metalness={0.2} />
          </mesh>
          <mesh position={[0, 0.055, 0]}>
            <sphereGeometry args={[0.145, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial
              color={pad.color}
              emissive={pad.color}
              emissiveIntensity={1.65}
              roughness={0.18}
              toneMapped={false}
            />
          </mesh>
          <pointLight position={[0, 0.12, 0]} intensity={0.16} distance={0.85} color={pad.color} />
        </group>
      ))}

      <group position={[0, 0.36, 0.03]}>
        <mesh castShadow position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.08, 0.12, 0.16, 24]} />
          <meshStandardMaterial color="#d7bb7c" roughness={0.28} metalness={0.72} />
        </mesh>
        <mesh castShadow position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.035, 0.045, 0.28, 20]} />
          <meshStandardMaterial color="#f7e6bd" roughness={0.28} metalness={0.5} />
        </mesh>
        <mesh position={[0, 0.46, 0]}>
          <sphereGeometry args={[0.15, 32, 32]} />
          <meshStandardMaterial
            color={palette.glow}
            emissive={palette.glow}
            emissiveIntensity={2.1}
            roughness={0.08}
            toneMapped={false}
          />
        </mesh>
        <pointLight position={[0, 0.5, 0]} intensity={0.55} distance={1.65} color={palette.glow} />
      </group>

      {[-0.54, 0.54].map((x) => (
        <mesh key={x} castShadow position={[x, 0.34, -0.44]}>
          <cylinderGeometry args={[0.04, 0.04, 0.12, 16]} />
          <meshStandardMaterial color="#d2a75e" roughness={0.34} metalness={0.68} />
        </mesh>
      ))}

      {[
        [-0.56, -0.39],
        [0.56, -0.39],
        [-0.56, 0.39],
        [0.56, 0.39],
      ].map(([x, z], index) => (
        <mesh key={`rivet-${index}`} castShadow position={[x, 0.34, z]}>
          <cylinderGeometry args={[0.035, 0.035, 0.025, 16]} />
          <meshStandardMaterial color="#f6cf7a" roughness={0.28} metalness={0.82} />
        </mesh>
      ))}

      {[-0.24, 0, 0.24].map((x) => (
        <RoundedBox
          key={`slot-${x}`}
          args={[0.16, 0.022, 0.055]}
          radius={0.012}
          smoothness={2}
          position={[x, 0.345, -0.43]}
          castShadow
        >
          <meshStandardMaterial
            color="#0f172a"
            emissive={palette.glow}
            emissiveIntensity={0.24}
            roughness={0.35}
            toneMapped={false}
          />
        </RoundedBox>
      ))}

      {[-0.48, 0.48].map((x, index) => (
        <mesh
          key={`side-cable-${index}`}
          position={[x, 0.26, 0.06]}
          rotation={[Math.PI / 2, 0, index === 0 ? 0.35 : -0.35]}
        >
          <torusGeometry args={[0.19, 0.018, 8, 28, Math.PI]} />
          <meshStandardMaterial
            color={palette.accents[index + 1]}
            emissive={palette.accents[index + 1]}
            emissiveIntensity={0.42}
            roughness={0.32}
            metalness={0.22}
          />
        </mesh>
      ))}

      <group position={[0, 0.37, 0.43]} rotation={[0, 0, 0]}>
        <RoundedBox args={[0.28, 0.035, 0.14]} radius={0.018} smoothness={3} castShadow>
          <meshStandardMaterial color="#ead7a8" roughness={0.72} />
        </RoundedBox>
        {[palette.accents[0], palette.accents[1], palette.accents[2]].map((color, index) => (
          <mesh key={`card-dot-${index}`} position={[-0.08 + index * 0.08, 0.028, 0]}>
            <cylinderGeometry args={[0.018, 0.018, 0.012, 12]} />
            <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.35} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
