# Home 3D — visual asset slots

The production Home uses `src/components/three/GameHome3D.tsx` with a transparent WebGL world selector (`WorldSelectorScene` / `WorldStage3D`) over an atmospheric background layer. These are the drop-in asset slots. **Every slot has a robust fallback**, so the app builds and looks correct even with no `.webp` present — drop a final asset in with the exact name to upgrade that layer.

| Slot | Used for | Current fallback |
| --- | --- | --- |
| `home-background-desktop.webp` | Desktop room backdrop behind the Canvas | `home-ambience.svg` + CSS gradients |
| `home-background-mobile.webp` | Portrait room backdrop | `home-ambience.svg` + CSS gradients |
| `home-ambience.svg` | Authored fallback ambience (shipped) | — (this folder) |
| `wood-plaque.webp` | Optional plaque texture | CSS wood gradient + `/illustrations/ui/wood-grain.svg` |
| `tabletop-stage.webp` / `wood-normal-map.webp` | Optional PBR wood for the 3D board | procedural materials in `WorldSelectorScene` |
| `ambient-glow.webp` / `stage-glow.webp` | Optional stage glow sprite | CSS radial glow + 3D point lights |
| `round-stage.glb` | Optional sculpted round table | procedural board in `WorldSelectorScene` |
| `hud-icons.svg` | Optional HUD icon set | `lucide-react` icons (already used) |

Layering (back ? front): warm dark base + CSS gradient fallback ? `home-background-*.webp` (or `home-ambience.svg`) on `.lab3d-atmosphere::after` ? transparent Canvas with the 3D worlds ? HTML UI overlay.

Do not bake fake worlds, buttons, or text into any background asset — the real UI and real 3D always render on top. A missing `.webp` layer is simply empty and reveals the fallback beneath it; nothing breaks.