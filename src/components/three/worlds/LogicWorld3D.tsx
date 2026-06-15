import { RoundedBox } from "@react-three/drei";
import type { World3DPalette } from "@/components/three/world-palette";

/** Trilha Lógica: magical puzzle-path stage with glowing stones and crystals. */
export function LogicWorld3D({ palette }: { palette: World3DPalette }) {
  const stones: { x: number; z: number; h: number; label: string }[] = [
    { x: -0.42, z: 0.28, h: 0.12, label: "1" },
    { x: -0.12, z: 0.02, h: 0.2, label: "2" },
    { x: 0.2, z: -0.17, h: 0.28, label: "3" },
    { x: 0.5, z: -0.36, h: 0.17, label: "4" },
  ];
  const crystals: [number, number, number][] = [
    [-0.55, -0.25, 0.16],
    [0.48, 0.28, 0.2],
    [0.08, 0.39, 0.12],
  ];

  return (
    <group>
      <RoundedBox
        args={[1.28, 0.13, 0.98]}
        radius={0.13}
        smoothness={5}
        position={[0, 0.04, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#51416e" roughness={0.72} metalness={0.08} />
      </RoundedBox>
      <RoundedBox
        args={[1.08, 0.055, 0.78]}
        radius={0.08}
        smoothness={4}
        position={[0, 0.14, 0]}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial color="#2e2751" roughness={0.58} metalness={0.12} />
      </RoundedBox>

      {[
        { x: -0.27, z: 0.15, rot: -0.72, len: 0.48 },
        { x: 0.06, z: -0.08, rot: -0.58, len: 0.42 },
        { x: 0.35, z: -0.27, rot: -0.58, len: 0.36 },
      ].map((line, index) => (
        <mesh key={index} position={[line.x, 0.2, line.z]} rotation={[0, line.rot, 0]}>
          <boxGeometry args={[line.len, 0.025, 0.045]} />
          <meshStandardMaterial
            color={palette.glow}
            emissive={palette.glow}
            emissiveIntensity={1.25}
            toneMapped={false}
          />
        </mesh>
      ))}

      {stones.map((stone, index) => (
        <group key={stone.label} position={[stone.x, 0.16 + stone.h / 2, stone.z]}>
          <RoundedBox args={[0.28, stone.h, 0.28]} radius={0.06} smoothness={4} castShadow receiveShadow>
            <meshStandardMaterial
              color={index % 2 ? "#9d8fde" : palette.base}
              roughness={0.36}
              metalness={0.16}
            />
          </RoundedBox>
          <mesh position={[0, stone.h / 2 + 0.018, 0]}>
            <cylinderGeometry args={[0.105, 0.105, 0.025, 24]} />
            <meshStandardMaterial
              color={palette.glow}
              emissive={palette.glow}
              emissiveIntensity={0.65 + index * 0.22}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, stone.h / 2 + 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.045, 0.065, 18]} />
            <meshStandardMaterial color="#fff7c2" emissive="#fff7c2" emissiveIntensity={0.35} toneMapped={false} />
          </mesh>
        </group>
      ))}

      {crystals.map(([x, z, size], index) => (
        <group key={index} position={[x, 0.17 + size, z]} rotation={[0, index * 0.6, 0]}>
          <mesh castShadow>
            <octahedronGeometry args={[size, 0]} />
            <meshStandardMaterial
              color={palette.accents[index % palette.accents.length]}
              emissive={palette.accents[index % palette.accents.length]}
              emissiveIntensity={1.0}
              roughness={0.08}
              metalness={0.35}
              toneMapped={false}
            />
          </mesh>
          <pointLight
            position={[0, 0.05, 0]}
            intensity={0.18}
            distance={0.9}
            color={palette.accents[index % palette.accents.length]}
          />
        </group>
      ))}

      <group position={[-0.54, 0.18, 0.43]}>
        <RoundedBox args={[0.26, 0.055, 0.2]} radius={0.03} smoothness={3} castShadow>
          <meshStandardMaterial color="#f3e6c7" roughness={0.62} />
        </RoundedBox>
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[0.16, 0.012, 0.012]} />
          <meshStandardMaterial color={palette.glow} emissive={palette.glow} emissiveIntensity={0.7} />
        </mesh>
        <mesh position={[0, 0.05, 0]} rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.16, 0.012, 0.012]} />
          <meshStandardMaterial color={palette.glow} emissive={palette.glow} emissiveIntensity={0.7} />
        </mesh>
      </group>

      <mesh position={[0.0, 0.25, 0.0]}>
        <torusGeometry args={[0.36, 0.012, 8, 48]} />
        <meshStandardMaterial
          color={palette.accents[0]}
          emissive={palette.accents[0]}
          emissiveIntensity={0.6}
          transparent
          opacity={0.75}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
