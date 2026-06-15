import { RoundedBox } from "@react-three/drei";
import type { World3DPalette } from "@/components/three/world-palette";

/** Jardim de Sementes: cozy garden board with pots, soil, sprouts and tools. */
export function GardenWorld3D({ palette }: { palette: World3DPalette }) {
  const pots: { x: number; z: number; scale: number }[] = [
    { x: -0.38, z: 0.16, scale: 0.78 },
    { x: 0.02, z: -0.06, scale: 1.05 },
    { x: 0.42, z: 0.18, scale: 0.72 },
  ];
  const pebbles: [number, number, number][] = [
    [-0.22, 0.38, 0.025],
    [0.28, 0.38, 0.02],
    [-0.5, -0.05, 0.018],
    [0.5, -0.08, 0.022],
    [0.15, -0.42, 0.018],
  ];

  return (
    <group>
      <mesh position={[0, 0.06, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.68, 0.75, 0.13, 56]} />
        <meshStandardMaterial color="#5f3d24" roughness={0.88} />
      </mesh>
      <mesh position={[0, 0.16, 0]} receiveShadow>
        <cylinderGeometry args={[0.58, 0.6, 0.045, 56]} />
        <meshStandardMaterial color="#2d1c10" roughness={0.98} />
      </mesh>

      {pebbles.map(([x, z, size], index) => (
        <mesh key={`pebble-${index}`} castShadow position={[x, 0.205, z]} scale={[1.35, 0.58, 1]}>
          <sphereGeometry args={[size, 10, 8]} />
          <meshStandardMaterial color={index % 2 ? "#9b7b55" : "#d2b48a"} roughness={0.88} />
        </mesh>
      ))}

      {pots.map((pot, index) => (
        <group key={index} position={[pot.x, 0.19, pot.z]} scale={pot.scale}>
          <mesh castShadow position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.16, 0.12, 0.22, 28]} />
            <meshStandardMaterial color="#c7753d" roughness={0.68} />
          </mesh>
          <mesh castShadow position={[0, 0.21, 0]}>
            <torusGeometry args={[0.15, 0.025, 10, 28]} />
            <meshStandardMaterial color="#e09a5a" roughness={0.58} />
          </mesh>
          <mesh position={[0, 0.23, 0]}>
            <cylinderGeometry args={[0.13, 0.13, 0.026, 24]} />
            <meshStandardMaterial color="#2b1a0e" roughness={1} />
          </mesh>
          {[-0.05, 0.04].map((x, leafIndex) => (
            <group key={leafIndex} position={[x, 0.34 + leafIndex * 0.03, 0]}>
              <mesh>
                <cylinderGeometry args={[0.012, 0.018, 0.2, 8]} />
                <meshStandardMaterial color={palette.deep} roughness={0.65} />
              </mesh>
              {[-1, 1].map((side) => (
                <mesh
                  key={side}
                  position={[side * 0.055, 0.08, 0]}
                  rotation={[0, 0, side * 0.8]}
                  scale={[0.85, 1.45, 0.75]}
                >
                  <sphereGeometry args={[0.047, 16, 12]} />
                  <meshStandardMaterial
                    color={palette.accents[(index + leafIndex) % palette.accents.length]}
                    emissive={palette.accents[(index + leafIndex) % palette.accents.length]}
                    emissiveIntensity={0.18}
                    roughness={0.54}
                  />
                </mesh>
              ))}
            </group>
          ))}
          {index === 1 && (
            <mesh position={[0.06, 0.52, 0]}>
              <sphereGeometry args={[0.065, 18, 18]} />
              <meshStandardMaterial
                color="#f9a8d4"
                emissive="#f9a8d4"
                emissiveIntensity={0.65}
                toneMapped={false}
              />
            </mesh>
          )}
        </group>
      ))}

      <group position={[0.52, 0.23, -0.26]} rotation={[0, -0.55, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.12, 0.14, 0.22, 24]} />
          <meshStandardMaterial color="#8fb8ad" roughness={0.36} metalness={0.48} />
        </mesh>
        <mesh position={[0.18, 0.02, 0]} rotation={[0, 0, -0.75]}>
          <cylinderGeometry args={[0.018, 0.04, 0.3, 12]} />
          <meshStandardMaterial color="#8fb8ad" roughness={0.36} metalness={0.48} />
        </mesh>
        <mesh position={[-0.12, 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.1, 0.018, 10, 24, Math.PI]} />
          <meshStandardMaterial color="#8fb8ad" roughness={0.36} metalness={0.48} />
        </mesh>
      </group>

      <group position={[-0.54, 0.22, -0.3]} rotation={[0, 0.28, 0]}>
        <RoundedBox args={[0.24, 0.22, 0.12]} radius={0.035} smoothness={3} castShadow>
          <meshStandardMaterial color="#a77d4d" roughness={0.82} />
        </RoundedBox>
        {[[-0.05, 0.08], [0.0, 0.06], [0.05, 0.1]].map(([x, y], index) => (
          <mesh key={index} position={[x, y, 0.075]}>
            <sphereGeometry args={[0.026, 12, 8]} />
            <meshStandardMaterial color="#8b5e34" roughness={0.75} />
          </mesh>
        ))}
      </group>

      <group position={[0.0, 0.19, 0.42]}>
        <mesh castShadow rotation={[0, 0, -0.75]}>
          <cylinderGeometry args={[0.026, 0.034, 0.36, 12]} />
          <meshStandardMaterial color="#8a5a2e" roughness={0.62} />
        </mesh>
        <mesh castShadow position={[0.15, -0.08, 0]} rotation={[0, 0, -0.75]}>
          <boxGeometry args={[0.22, 0.07, 0.035]} />
          <meshStandardMaterial color="#c7d2d6" roughness={0.38} metalness={0.55} />
        </mesh>
      </group>

      <group position={[-0.58, 0.2, 0.38]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.08, 0.09, 0.1, 18]} />
          <meshStandardMaterial color="#745232" roughness={0.55} />
        </mesh>
        <mesh position={[0, 0.1, 0]}>
          <sphereGeometry args={[0.065, 16, 16]} />
          <meshStandardMaterial
            color="#fde68a"
            emissive="#fbbf24"
            emissiveIntensity={1.45}
            toneMapped={false}
          />
        </mesh>
        <pointLight position={[0, 0.18, 0]} intensity={0.32} distance={0.9} color="#fbbf24" />
      </group>

      <group position={[-0.48, 0.24, 0.0]} rotation={[0, 0.18, 0]}>
        {[-0.12, 0, 0.12].map((x) => (
          <mesh key={`fence-post-${x}`} castShadow position={[x, 0.09, 0]}>
            <boxGeometry args={[0.035, 0.24, 0.035]} />
            <meshStandardMaterial color="#8b5a31" roughness={0.72} />
          </mesh>
        ))}
        <mesh castShadow position={[0, 0.14, 0]}>
          <boxGeometry args={[0.34, 0.035, 0.035]} />
          <meshStandardMaterial color="#a06a3f" roughness={0.68} />
        </mesh>
      </group>

      <group position={[0.33, 0.22, -0.38]}>
        {[0, 1, 2].map((index) => (
          <mesh key={`seed-${index}`} position={[-0.045 + index * 0.045, 0.015 * index, 0]}>
            <sphereGeometry args={[0.025, 10, 8]} />
            <meshStandardMaterial color="#9a6a35" roughness={0.72} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
