import { RoundedBox } from "@react-three/drei";
import type { World3DPalette } from "@/components/three/world-palette";

/** Rota Estratégica: miniature adventure board with route stones and guardian. */
export function RouteWorld3D({ palette }: { palette: World3DPalette }) {
  const stones: { x: number; z: number; y?: number; color?: string }[] = [
    { x: -0.52, z: 0.3 },
    { x: -0.26, z: 0.15 },
    { x: 0.02, z: 0.0 },
    { x: 0.25, z: -0.18 },
    { x: 0.52, z: -0.34 },
  ];
  const lights: [number, number][] = [
    [-0.22, -0.28],
    [0.1, 0.28],
    [0.42, 0.06],
  ];

  return (
    <group>
      <RoundedBox
        args={[1.28, 0.15, 1.02]}
        radius={0.16}
        smoothness={6}
        position={[0, 0.04, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color={palette.deep} roughness={0.9} />
      </RoundedBox>

      <mesh position={[-0.02, 0.125, 0.02]} receiveShadow>
        <cylinderGeometry args={[0.58, 0.62, 0.045, 48]} />
        <meshStandardMaterial color="#557c43" roughness={0.86} />
      </mesh>

      <mesh position={[0.16, 0.15, 0.08]} rotation={[0, -0.55, 0]} receiveShadow>
        <boxGeometry args={[0.28, 0.035, 1.05]} />
        <meshStandardMaterial
          color="#1b6a82"
          emissive="#0ea5e9"
          emissiveIntensity={0.16}
          roughness={0.35}
          metalness={0.05}
        />
      </mesh>

      <group position={[0.04, 0.25, -0.06]} rotation={[0, -0.55, 0]}>
        <RoundedBox args={[0.44, 0.055, 0.2]} radius={0.025} smoothness={3} castShadow>
          <meshStandardMaterial color="#8b5a31" roughness={0.72} />
        </RoundedBox>
        {[-0.15, 0, 0.15].map((x) => (
          <mesh key={x} castShadow position={[x, 0.04, 0]}>
            <boxGeometry args={[0.035, 0.05, 0.24]} />
            <meshStandardMaterial color="#b57b42" roughness={0.65} />
          </mesh>
        ))}
      </group>

      {stones.map((stone, index) => (
        <group key={index} position={[stone.x, 0.17 + (stone.y ?? 0), stone.z]}>
          <mesh castShadow receiveShadow rotation={[0, index * 0.22, 0]}>
            <cylinderGeometry args={[0.13, 0.15, 0.055, 10]} />
            <meshStandardMaterial color="#c0ad8c" roughness={0.82} />
          </mesh>
          {index === 2 && (
            <mesh position={[0, 0.045, 0]}>
              <sphereGeometry args={[0.08, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial
                color="#facc15"
                emissive="#facc15"
                emissiveIntensity={1.4}
                toneMapped={false}
              />
            </mesh>
          )}
        </group>
      ))}

      <group position={[-0.56, 0.2, 0.38]}>
        <mesh castShadow position={[0, 0.07, 0]}>
          <cylinderGeometry args={[0.1, 0.13, 0.08, 24]} />
          <meshStandardMaterial color="#2878c5" roughness={0.35} />
        </mesh>
        <mesh castShadow position={[0, 0.2, 0]}>
          <cylinderGeometry args={[0.055, 0.09, 0.18, 24]} />
          <meshStandardMaterial color="#2b8fe7" roughness={0.32} />
        </mesh>
        <mesh castShadow position={[0, 0.36, 0]}>
          <sphereGeometry args={[0.1, 24, 24]} />
          <meshStandardMaterial color="#44a6ff" roughness={0.28} />
        </mesh>
      </group>

      <group position={[0.14, 0.19, 0.24]}>
        <mesh castShadow position={[0, 0.08, 0]}>
          <cylinderGeometry args={[0.11, 0.13, 0.16, 18]} />
          <meshStandardMaterial color="#6ba855" roughness={0.55} />
        </mesh>
        <mesh castShadow position={[0, 0.25, 0]}>
          <sphereGeometry args={[0.13, 24, 18]} />
          <meshStandardMaterial color="#89c86a" roughness={0.48} />
        </mesh>
        {[-0.04, 0.04].map((x) => (
          <mesh key={x} position={[x, 0.28, 0.11]}>
            <sphereGeometry args={[0.025, 12, 12]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
        ))}
      </group>

      <group position={[0.58, 0.18, -0.42]}>
        <RoundedBox args={[0.26, 0.34, 0.08]} radius={0.03} smoothness={3} castShadow>
          <meshStandardMaterial
            color="#6ee7b7"
            emissive="#22c55e"
            emissiveIntensity={0.55}
            roughness={0.36}
            toneMapped={false}
          />
        </RoundedBox>
        <mesh position={[0, 0.24, -0.055]}>
          <torusGeometry args={[0.16, 0.025, 10, 24]} />
          <meshStandardMaterial color="#8a6b45" roughness={0.58} />
        </mesh>
        <pointLight position={[0, 0.2, -0.04]} intensity={0.4} distance={1.2} color="#6ee7b7" />
      </group>

      {lights.map(([x, z], index) => (
        <group key={index} position={[x, 0.2, z]}>
          <mesh>
            <sphereGeometry args={[0.055, 18, 18]} />
            <meshStandardMaterial
              color="#fde047"
              emissive="#fde047"
              emissiveIntensity={1.7}
              toneMapped={false}
            />
          </mesh>
          <pointLight position={[0, 0.07, 0]} intensity={0.22} distance={0.85} color="#fde047" />
        </group>
      ))}

      <group position={[0.46, 0.18, 0.28]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.11, 0.12, 0.04, 24]} />
          <meshStandardMaterial color="#a14b3f" roughness={0.52} />
        </mesh>
        <mesh position={[0, 0.04, 0]}>
          <torusGeometry args={[0.08, 0.012, 8, 20]} />
          <meshStandardMaterial color="#f97316" emissive="#ef4444" emissiveIntensity={0.5} />
        </mesh>
      </group>
    </group>
  );
}
