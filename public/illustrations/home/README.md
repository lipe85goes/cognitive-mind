# Home — runtime visual assets

The production Home now uses `src/components/home/HomeStage.tsx` and `src/styles/home.css`.
It is a lightweight 2.5D HTML/CSS stage called "O Ateliê dos Mundos".

Runtime contract:

- Production `/` must not use Three, R3F, Canvas, `requestAnimationFrame`, or a continuous render loop.
- Home CSS is isolated in `src/styles/home.css` and all selectors use the `.hj-*` prefix.
- Text, buttons, labels, focus states and navigation stay in React/HTML, never baked into an image.
- The current HOME-01 pass uses CSS/lucide placeholders first; final rendered sprites can be added in HOME-ART-01.

Existing assets in this folder may still be used by the old lab/legacy 3D Home or future art passes:

| Asset | Status |
| --- | --- |
| `home-ambience.svg` | Legacy/lab fallback ambience. |
| `home-background-desktop.webp` | Legacy/lab background slot. |
| `stage-glow-clean.webp` | Optional future glow sprite. |
| `tabletop-stage.webp` | Optional future tabletop sprite. |
| `tabletop-texture.webp` | Optional future texture reference. |
| `wood-plaque.webp` | Optional future plaque texture. |

Future HOME-ART-01 assets should stay lightweight:

- Route hero sprite: <= 140 KB.
- Memory hero sprite: <= 120 KB.
- Secondary world sprites: <= 60 KB each.
- Explorer sprite: <= 40 KB.
- Total target: <= 600 KB.

Do not place PNG masters in `public/`. Keep masters in `docs/archive/home/` or regenerate them from scripts.
