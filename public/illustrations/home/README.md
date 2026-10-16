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
| `world-panel.webp` | Quiet world sprite for Central de Comandos. | <= 60 KB |
| `world-trail.webp` | Retired with the Trilha (GAME03-SKELETON-01); no longer on disk. | — |
| `world-garden.webp` | Quiet world sprite for Jardim de Sementes. | <= 60 KB |
| `explorer-marker.webp` | Small non-mascot Explorer marker in the Home stage. Since HOME-ROUTE-POLISH-02 it is the Rota board's Explorador miniature (`explorerMiniature` in `tools/assets/home-atelier-worlds.mjs`), painted by `create_home_world_set.mjs` in the same 360×430 frame. | <= 40 KB |

WORLD-COHESION-01 promotes the existing premium Route and Memory renders into
the shared Home → transition → intro visual contract:

| Asset | Runtime role | Current size |
| --- | --- | --- |
| `world-route-hero.webp` | Optimized Route art shared by Home, entry threshold, and intro. | ~104 KB |
| `world-circuit-hero.webp` | Optimized Memory art shared by Home, entry threshold, and intro. | ~77 KB |

MINDFLOW-CLEANUP-03C removed the lighter `world-route.webp` and
`world-circuit.webp`. They had been kept as HOME-PIVOT-01 fallback history, but
nothing read them: `worldVisuals.ts` points both hero worlds at the `-hero`
variants. `create_home_world_set.mjs` no longer emits them.

Recreate the cohesive primary variants and review sheet with
`node tools/assets/create_world_cohesion_assets.mjs`. Its sources are
`public/illustrations/worlds/route-diorama.webp` and `memory-diorama.webp`,
which is why those two stay on disk despite having no runtime consumer.

WORLD-DIORAMA-2_5D-01 adds the first modular hero-world layer kits for Route
and Memory. These layers replace the single flat hero image in the production
Home and entry transition, while keeping the flat `world-route-hero.webp` and
`world-circuit-hero.webp` files as fallback/source history.

WORLD-DIORAMA-2_5D-02 replaces the V01 mask/crop-derived layers for Route and
Memory with independent transparent render passes generated from Blender
scenes and real scene objects. The production Home still uses the same
HTML/CSS/Next Image layer architecture; no Three, R3F, Babylon, canvas or
continuous render loop is used in runtime Home.

HOME-HERO-WORLDS-3D-01 replaced the V02 kits with environmental island
maquettes in new folders, and MINDFLOW-CLEANUP-03C removed the V02 kits
(`dioramas/route/`, `dioramas/circuit/`) together with their generators. The
master scene never followed them across: `worldMasterSceneConfig.ts` derives
`essentialAssets` from `WORLD_DIORAMA_CONFIGS`, which resolves to the folders
below.

## HOME-WORLD-VISUAL-UNIFICATION-01 — the atelier kit (active runtime)

Every Home world maquette is now one construction: the Estúdio das
Descobertas' Home maquette (the quality reference) restated as a kit — one
1040×780 canvas, one turned-wood pedestal in the same place, one floor camera,
one warm key light laid onto the matter, one pass vocabulary and one encoding.
Only the subject changes per world. See `docs/MINDFLOW_VISUAL_SYSTEM.md` §4.

Passes, back to front (the runtime paints them in this order —
`worldDioramaLayout.ts` → `DIORAMA_PASSES`):
`contact-shadow`, `base`, `back`, `main`, `detail`, `energy`, `front`.

Active runtime diorama layers:

| Folder | Role |
| --- | --- |
| `atelier/route/` | Rota Estratégica: slate board in a walnut frame (walls, lights, chest, Explorador, Guardião, a planned route), ruin, signpost and the teal portal. The Explorador and the Guardião are painted miniatures on turned bases, in the lit `main` pass; the Explorador's cyan ring and the Guardião's eye glow are in `detail` / `energy` (HOME-ROUTE-POLISH-02). |
| `atelier/circuit/` | Circuito de Memória: the memory dial (four pads around the crystal core) on a bronze cradle, the armillary with the four signal lamps. |
| `atelier/commands/` | Central de Comandos: walnut console with the great seal and two levers, the switchboard cabinet (dials, seal sockets), reading lamp. |
| `atelier/garden/` | Jardim de Sementes: the six-pot sowing bench (seeds, sprout, flower), bean teepee, hedge, cloche, watering can, seed sack. |
| `atelier/shared/atelier-contact-shadow.webp` | The one contact shadow every kit world shares. |
| `dioramas/discovery/` | Estúdio das Descobertas: the reference, painted by its own art kit (`node tools/assets/create_hidden_objects_scene.mjs --home`) — Game 03's, not rewritten by the atelier script. |

The soft passes (`contact-shadow`, `energy`) ship at half resolution
(520×390); every pass is stretched over the same 4:3 box, so nothing moves.

Regenerate the four kit worlds, their review sheets and the lineup with:

```bash
node tools/assets/create_home_atelier_dioramas.mjs              # writes runtime + docs/archive/home-world-visual-unification-01/kit/
node tools/assets/create_home_atelier_dioramas.mjs --preview=DIR # composites only, nothing else written
node tools/validation/home-atelier-kit-tests.mjs --deep          # the kit contract, and that the kit paints what ships
```

Budgets (encoded): ≤ 130 KB per kit world and ≤ 40 KB per pass; all five
maquettes together ≤ 600 KB on disk (today ~439 KB); the Home fetches
optimizer-sized variants of these.

To add a world: give it an entry in `tools/assets/home-atelier-worlds.mjs`
(passes from the kit's primitives), a kit entry in `worldDioramaLayout.ts`, and
— if its entry should keep the maquette — a master scene in
`worldMasterSceneConfig.ts`. No CSS per world: colour comes from
`worldVisuals.ts`.

Retired by this mission (no reader left): `dioramas/route-world/`,
`dioramas/circuit-world/`, `dioramas/panel/`, `dioramas/garden/`,
`world-glow.webp` (the aura is CSS in the world's own accent now) and the Node
encoders `create_hero_world_layers.mjs` / `create_secondary_world_layers.mjs`.
The Blender scripts under `tools/blender/` and their raw renders in
`docs/archive/` stay as history; they no longer feed the Home.

### History (superseded)

The sections above this one describe earlier kits and are kept as history.
HOME-HERO-WORLDS-3D-01's island kits lived in `dioramas/route-world/` and
`dioramas/circuit-world/`; HOME-WORLDS-FINAL-01's secondary kits in
`dioramas/panel/`, `dioramas/garden/` (and `dioramas/trail/`, retired with the
Trilha). They were regenerated with the Blender scripts plus
`create_hero_world_layers.mjs` / `create_secondary_world_layers.mjs`.

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
