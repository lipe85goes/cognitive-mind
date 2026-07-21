# WORLD-DIORAMA-2_5D-02 review

Review-only material for the independent-render Home diorama pass.

The V01 layers were technically useful, but they were mask/crop-derived from flattened hero images. V02 replaces the active Route and Circuit hero layers with transparent render passes generated from Blender scenes and real scene objects.

Runtime WebP assets live in:

- `public/illustrations/home/dioramas/route/`
- `public/illustrations/home/dioramas/circuit/`

Raw transparent PNG render passes live here only for review:

- `docs/archive/world-diorama-2_5d-02/raw/route/`
- `docs/archive/world-diorama-2_5d-02/raw/circuit/`

## Generation

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" --background --python tools\blender\create_route_home_diorama.py
& "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" --background --python tools\blender\create_memory_circuit_home_diorama.py
node tools/assets/create_world_diorama_final_layers.mjs
```

## Shared render contract

- Canvas: 1040x780.
- Camera: orthographic 2.5D, warm front-left key, warm rim and subtle teal fill.
- Runtime: HTML/CSS/Next Image only; no canvas, no RAF, no Three/R3F/Babylon in Home.
- Motion states remain CSS transform/opacity and are disabled under reduced motion.

## Runtime layer sizes

### route

Total: 198.2 KB

| Layer | Size |
| --- | ---: |
| `route-contact-shadow.webp` | 80.7 KB |
| `route-base.webp` | 13.6 KB |
| `route-back-environment.webp` | 5.6 KB |
| `route-board.webp` | 45.2 KB |
| `route-walls.webp` | 17.8 KB |
| `route-gameplay-props.webp` | 5.7 KB |
| `route-portal.webp` | 4.2 KB |
| `route-guardian.webp` | 4.5 KB |
| `route-explorer.webp` | 4.4 KB |
| `route-lights.webp` | 6.0 KB |
| `route-front-environment.webp` | 4.2 KB |
| `route-energy.webp` | 6.2 KB |

### circuit

Total: 156.9 KB

| Layer | Size |
| --- | ---: |
| `circuit-contact-shadow.webp` | 90.8 KB |
| `circuit-base.webp` | 17.0 KB |
| `circuit-back-environment.webp` | 6.8 KB |
| `circuit-board.webp` | 9.1 KB |
| `circuit-pads.webp` | 13.8 KB |
| `circuit-core.webp` | 3.7 KB |
| `circuit-energy.webp` | 9.7 KB |
| `circuit-front-environment.webp` | 6.1 KB |

## Review sheets

- `route-layer-grid.png`
- `route-final-composite.png`
- `route-depth-test.png`
- `circuit-layer-grid.png`
- `circuit-final-composite.png`
- `circuit-depth-test.png`
- `route-circuit-side-by-side.png`

## Human review notes

- Check that small depth offsets do not reveal holes around characters, portal, pads, core or front environment.
- Check whether Route and Circuit now read as objects from the same MindFlow universe.
- If final art direction needs more fidelity, replace Blender primitives/GLBs with final authored assets without changing the DOM layer contract.

