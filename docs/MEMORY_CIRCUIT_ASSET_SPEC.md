# Memory Circuit Asset Spec

This document defines the separated asset structure for the modular rebuild of Circuito de Memoria.

The active game logic must remain in `src/games/color-sequence/useColorSequenceGame.ts`. Do not change sequence generation, playback timing, attempt limit, scoring, progression, reward flow, or localStorage behavior while integrating these assets.

## Product Direction

Circuito de Memoria should become a calm playable memory stage, not a full mockup image placed inside the page. The final implementation should be modular: background, board, pads, core, symbols, hitboxes, HUD, and accessibility controls should be independently replaceable.

The current full-board image is temporary and should only remain as a bridge until the separated assets below are ready.

## Official Asset List

| Asset path | Function | Format | Priority | Integration note |
| --- | --- | --- | --- | --- |
| `public/illustrations/memory-circuit/memory-room-bg.webp` | Atmospheric background behind the board: books, candle, plants, soft room lighting. | WebP image | High | Should render as the stage background layer. Must not contain interactive pads or stateful UI. |
| `public/assets/memory-circuit/memory-board-floating.png` | Main floating circular board/altar surface, without active pad effects baked into gameplay state. | PNG image with transparency | High | Should sit above the room background and below pads/core/path overlays. |
| `public/assets/memory-circuit/core-crystal.png` | Central crystal/core visual. | PNG image with transparency | High | Can receive glow/active overlays from React/CSS without changing game logic. |
| `public/assets/memory-circuit/pad-flame.png` | Red/flame memory pad visual. | PNG image with transparency | High | Button/hitbox must remain separate and accessible. Visual state should be controlled by props from the game hook. |
| `public/assets/memory-circuit/pad-wave.png` | Blue/wave memory pad visual. | PNG image with transparency | High | Same integration contract as other pads. |
| `public/assets/memory-circuit/pad-leaf.png` | Green/leaf memory pad visual. | PNG image with transparency | High | Same integration contract as other pads. |
| `public/assets/memory-circuit/pad-sun.png` | Yellow/sun memory pad visual. | PNG image with transparency | High | Same integration contract as other pads. |
| `public/icons/memory-circuit/symbol-flame.svg` | Flame symbol overlay/icon for labels, fallback UI, or pad detail. | SVG | Medium | Should be decorative unless used inside an accessible button label. |
| `public/icons/memory-circuit/symbol-wave.svg` | Wave symbol overlay/icon for labels, fallback UI, or pad detail. | SVG | Medium | Should be decorative unless used inside an accessible button label. |
| `public/icons/memory-circuit/symbol-leaf.svg` | Leaf symbol overlay/icon for labels, fallback UI, or pad detail. | SVG | Medium | Should be decorative unless used inside an accessible button label. |
| `public/icons/memory-circuit/symbol-sun.svg` | Sun symbol overlay/icon for labels, fallback UI, or pad detail. | SVG | Medium | Should be decorative unless used inside an accessible button label. |

## Integration Rules

1. Do not alter `useColorSequenceGame.ts` for visual asset integration.
2. Keep gameplay state as the single source of truth: `activeColor`, `lastTapped`, `tapFeedback`, `phase`, `canTap`, `level`, `sequence`, `errors`, and `score` should continue to drive the visual layer.
3. Keep accessible controls and real buttons. Visual images must not replace keyboard-accessible hitboxes.
4. Keep hitbox positions in a layout/config file, not hardcoded across multiple components.
5. Pad visuals should support at least four visual states: idle, active/playback, correct tap, and gentle retry feedback.
6. Avoid baking text, HUD, score, attempt count, or progress into image files. Those belong in React so they remain readable, localizable, and accessible.
7. Avoid creating low-quality placeholders. If final artwork is not available, keep using the current temporary full-board image until proper assets exist.
8. The final game should remain calm, readable, and aligned with "Pensar em paz".

## Current Temporary Bridge

The current active visual bridge is:

`public/illustrations/memory-circuit/memory-circuit-board-v1.png`

This file is useful for visual direction validation, but it should not become the final architecture because it combines background, board, pads, core, lighting, and composition into one image. The modular rebuild should progressively replace it with the official separated assets above.

## Suggested Future Implementation Order

1. Add `memory-room-bg.webp` as the background layer.
2. Add `memory-board-floating.png` as the board layer.
3. Add the four pad PNGs with existing hitboxes from `MemoryCircuitPadLayer`.
4. Add `core-crystal.png` and connect it to existing phase/feedback state.
5. Add optional path/light overlays using CSS or SVG, driven by existing game state.
6. Keep accessible controls in `MemoryCircuitAccessibleControls` throughout the migration.
