# Home — runtime visual assets

The production Home now uses `src/components/home/HomeStage.tsx` and `src/styles/home.css`.
It is a lightweight 2.5D HTML/CSS stage called "O Ateliê dos Mundos".
See `docs/MINDFLOW_VISUAL_SYSTEM.md` for the official visual direction.

Runtime contract:

- Production `/` must not use Three, R3F, Canvas, `requestAnimationFrame`, or a continuous render loop.
- Home CSS is isolated in `src/styles/home.css` and all selectors use the `.hj-*` prefix.
- Text, buttons, labels, focus states and navigation stay in React/HTML, never baked into an image.
- HOME-PIVOT-01 uses these lightweight transparent WebP sprites inside a lateral 2.5D gallery: one large focused world, neighboring worlds partially visible, CSS physical plane, and mobile scroll-snap.
- The physical table/plane, contact shadows and plaques are CSS/runtime composition, not baked into the sprites.

Active HOME-PIVOT-01 runtime sprites:

| Asset | Runtime role | Size target |
| --- | --- | --- |
| `world-route.webp` | Hero world sprite for Rota Estrategica. | <= 140 KB |
| `world-circuit.webp` | Hero world sprite for Circuito de Memoria. | <= 120 KB |
| `world-panel.webp` | Quiet world sprite for Central de Comandos. | <= 60 KB |
| `world-trail.webp` | Quiet world sprite for Trilha Numerica. | <= 60 KB |
| `world-garden.webp` | Quiet world sprite for Jardim de Sementes. | <= 60 KB |
| `explorer-marker.webp` | Small non-mascot Explorer marker in the Home stage. | <= 40 KB |
| `world-glow.webp` | Shared soft glow sprite used by the Home stage CSS. | <= 60 KB |

WORLD-COHESION-01 promotes the existing premium Route and Memory renders into
the shared Home → transition → intro visual contract:

| Asset | Runtime role | Current size |
| --- | --- | --- |
| `world-route-hero.webp` | Optimized Route art shared by Home, entry threshold, and intro. | ~104 KB |
| `world-circuit-hero.webp` | Optimized Memory art shared by Home, entry threshold, and intro. | ~77 KB |

The lighter `world-route.webp` and `world-circuit.webp` remain available as
fallback/source history for HOME-PIVOT-01, but are no longer the primary art.
Recreate the cohesive primary variants and review sheet with
`node tools/assets/create_world_cohesion_assets.mjs`.

WORLD-DIORAMA-2_5D-01 adds the first modular hero-world layer kits for Route
and Memory. These layers replace the single flat hero image in the production
Home and entry transition, while keeping the flat `world-route-hero.webp` and
`world-circuit-hero.webp` files as fallback/source history.

WORLD-DIORAMA-2_5D-02 replaces the V01 mask/crop-derived layers for Route and
Memory with independent transparent render passes generated from Blender
scenes and real scene objects. The production Home still uses the same
HTML/CSS/Next Image layer architecture; no Three, R3F, Babylon, canvas or
continuous render loop is used in runtime Home.

Active runtime diorama layers:

| Folder | Role |
| --- | --- |
| `dioramas/route/` | Route independent layers: contact shadow, base, back environment, board, walls, gameplay props, portal, guardian, explorer, lights, front environment and energy. |
| `dioramas/circuit/` | Memory independent layers: contact shadow, base, back environment, board, pads, core, energy and front environment. |

Regenerate the V02 layered runtime assets and review sheets with:

```powershell
& "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" --background --python tools\blender\create_route_home_diorama.py
& "C:\Program Files\Blender Foundation\Blender 5.1\blender.exe" --background --python tools\blender\create_memory_circuit_home_diorama.py
node tools/assets/create_world_diorama_final_layers.mjs
```

Review-only V02 material lives in `docs/archive/world-diorama-2_5d-02/` and
must not be referenced by runtime code. V01 review material remains archived in
`docs/archive/world-diorama-2_5d-01/` for comparison only.

MINDFLOW-UNIFIED-VISUAL-01 re-framed both diorama cameras so the **whole
maquette fits inside the render frame with margin** (Route `ortho_scale` 8.25 →
12.8, Circuit 7.15 → 9.6). Before this, the maquettes were cropped by the frame
and the Home hid the cut behind an ellipse mask, which made each world read as
a flat sticker. The mask is now reserved for the flat fallback art only —
layered dioramas always render their real silhouette.

Runtime totals after the re-frame: Route layers ~232 KB, Circuit layers ~172 KB.

Unreferenced V01 prop layers (`route-back-props`, `route-front-foliage`,
`circuit-back-props`, `circuit-front-props`) were moved out of `public/` to
`docs/archive/world-diorama-2_5d-01/legacy-prop-layers/`.

Review/master material:

- `docs/archive/home-world-masters/home-world-review.png` is review-only and must not be referenced by runtime code.
- `docs/archive/world-cohesion-01/world-cohesion-review.png` is the primary-world cohesion review sheet and must not be referenced by runtime code.
- `docs/archive/home-world-masters/README.md` documents the non-runtime review material.
- Recreate the current runtime sprite set with `node tools/assets/create_home_world_set.mjs`.

Existing assets in this folder may still be used by the old lab/legacy 3D Home or future art passes:

| Asset | Status |
| --- | --- |
| `home-ambience.svg` | Legacy/lab fallback ambience. |
| `home-background-desktop.webp` | Legacy/lab background slot. |
| `stage-glow-clean.webp` | Optional future glow sprite. |
| `tabletop-stage.webp` | Optional future tabletop sprite. |
| `tabletop-texture.webp` | Optional future texture reference. |
| `wood-plaque.webp` | Optional future plaque texture. |

Future Home runtime assets should stay lightweight:

- Route hero sprite: <= 140 KB.
- Memory hero sprite: <= 120 KB.
- Secondary world sprites: <= 60 KB each.
- Explorer sprite: <= 40 KB.
- Total target: <= 600 KB.

Do not place PNG masters in `public/`. Keep masters in `docs/archive/home/` or regenerate them from scripts.
