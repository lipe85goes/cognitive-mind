# World 3D models (future GLB/GLTF)

The `/lab/3d-home` prototype currently renders each cognitive world with
**procedural Three.js primitives** (see `src/components/three/worlds/*`). No
model files are required to run it.

When real art is ready, drop GLB models here:

```
public/models/worlds/
  memory.glb    # Circuito de Memória
  route.glb     # Rota Estratégica
  command.glb   # Central de Comandos
  logic.glb     # Trilha Lógica
  garden.glb    # Jardim de Sementes
```

## How to swap a procedural world for a GLB

Each world is rendered through `WorldContent` in
`src/components/three/WorldStage3D.tsx`. To use a real model, replace that
world's case with a loaded scene, e.g.:

```tsx
import { useGLTF } from "@react-three/drei";

function MemoryGLB() {
  const { scene } = useGLTF("/models/worlds/memory.glb");
  return <primitive object={scene} />;
}

// useGLTF.preload("/models/worlds/memory.glb");
```

Keep models small (target < ~1–2 MB each, draco-compressed if possible),
centered on the origin, and roughly 1.4 units wide so they sit on the
existing pedestal without extra tuning. The pedestal, selection halo,
carousel motion, lighting and shadows are provided by `WorldStage3D` /
`WorldSelectorScene`, so a model only needs to be the world's contents.
