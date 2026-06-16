"use client";

import { useMemo } from "react";
import { BufferAttribute, BufferGeometry } from "three";

/**
 * The cozy library/workshop the tabletop sits in — built as REAL 3D geometry
 * (not a CSS backdrop) so it parallaxes with the camera and casts warm light:
 * a glowing garden window, hanging lantern motes, a warm room wash and dust in
 * the air. Everything lives far behind the stage (negative z, off to the sides)
 * so it never clips the carousel. Emissive/points keep fog off so the lights
 * read as bright sources in the dark room.
 */
export function RoomEnvironment({ accent }: { accent: string }) {
  const lanterns: { pos: [number, number, number]; r: number; color: string }[] =
    [
      { pos: [-4.3, 3.3, -2.4], r: 0.13, color: "#ffcf85" },
      { pos: [3.1, 3.7, -3.2], r: 0.1, color: "#ffe0a0" },
      { pos: [-1.4, 4.2, -4], r: 0.11, color: "#ffcf7e" },
      { pos: [4.9, 1.5, -0.6], r: 0.16, color: "#ffd98a" },
      { pos: [-5.2, 1.1, -1.4], r: 0.12, color: "#ffcf85" },
    ];

  const moteGeometry = useMemo(() => {
    // Deterministic pseudo-random (pure) so the dust layout is stable across
    // renders — Math.random() can't be called during render.
    const rand = (n: number) => {
      const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    };
    const count = 70;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      positions[i * 3] = (rand(i) - 0.5) * 18;
      positions[i * 3 + 1] = 0.3 + rand(i + 0.37) * 5;
      positions[i * 3 + 2] = -1 - rand(i + 0.91) * 7.5;
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(positions, 3));
    return geometry;
  }, []);

  return (
    <group>
      {/* Glowing round garden window, back-right (the reference's hero window). */}
      <group position={[4.7, 2.8, -4.3]}>
        <mesh>
          <circleGeometry args={[1.55, 56]} />
          <meshBasicMaterial color="#33543a" fog={false} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.02]}>
          <circleGeometry args={[1.18, 56]} />
          <meshBasicMaterial color="#5c8a62" fog={false} toneMapped={false} />
        </mesh>
        <mesh position={[0, 0, 0.04]}>
          <ringGeometry args={[1.5, 1.82, 56]} />
          <meshStandardMaterial color="#5a3d22" roughness={0.6} metalness={0.3} />
        </mesh>
        {/* window mullions */}
        <mesh position={[0, 0, 0.05]}>
          <boxGeometry args={[0.07, 3, 0.07]} />
          <meshStandardMaterial color="#3a2614" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0, 0.05]}>
          <boxGeometry args={[3, 0.07, 0.07]} />
          <meshStandardMaterial color="#3a2614" roughness={0.7} />
        </mesh>
        <pointLight position={[0, 0, 1.5]} intensity={0.4} distance={8} color="#9fd6a6" />
      </group>

      {/* Hanging lantern motes — bright emissive orbs reading as warm bokeh. */}
      {lanterns.map((lantern, index) => (
        <mesh key={index} position={lantern.pos}>
          <sphereGeometry args={[lantern.r, 18, 18]} />
          <meshBasicMaterial color={lantern.color} fog={false} toneMapped={false} />
        </mesh>
      ))}

      {/* One warm wash from the near lantern, pooling on the right of the room. */}
      <pointLight position={[4.6, 1.8, -0.4]} intensity={1.15} distance={9} decay={2} color="#ffca76" />
      {/* A faint accent-coloured bounce from deep in the room. */}
      <pointLight position={[-4, 2.4, -3.5]} intensity={0.5} distance={8} decay={2} color={accent} />

      {/* Dust drifting in the warm air. */}
      <points geometry={moteGeometry}>
        <pointsMaterial
          color="#ffd9a0"
          size={0.07}
          sizeAttenuation
          transparent
          opacity={0.5}
          depthWrite={false}
          fog={false}
          toneMapped={false}
        />
      </points>
    </group>
  );
}
