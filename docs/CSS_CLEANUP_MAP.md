# MindFlow CSS Cleanup Map

This document records the current `src/app/globals.css` structure after CLEAN-07.
It is a safety map, not a redesign plan.

## CLEAN-07 Baseline

- `globals.css` line count before CLEAN-07 comments: 13,565 lines.
- CLEAN-07 intentionally changed comments/documentation only.
- No selectors, declarations, game logic, assets, registry entries, hooks or runtime components were changed.

## Active Blocks To Preserve

### Global Base / Tokens

Keep the root theme variables, safe-area variables, world palettes, reset rules and shared accessibility tokens. These are reused across the Home, game shells, legacy games and result flow.

### Shared Game UI

Preserve shared game layout/button/status classes while `security-panel`, `number-trail` and `seed-garden` still use the older shared UI components.

Risk of removing now: breaking the three older active games before they are rebuilt.

### Active 3D Home

The production Home uses `.lab3d-*` styles for the game-menu HUD, tabletop selector, world navigation and entry transition integration.

Preserve:

- `.lab3d-main`
- `.lab3d-root`
- `.lab3d-scene`
- `.lab3d-hud-*`
- `.lab3d-world-*`
- related responsive/mobile rules

### `/lab/3d-home`

The lab prototype is intentionally kept for comparison and experiments. It is not the production Home route, but should not be deleted while it remains documented.

### Rota Estrategica

The current Rota runtime uses `.rsg-*` classes for the premium shell, HUD, Babylon canvas frame, controls, status, legend and responsive layout.

Preserve until a dedicated Rota cleanup:

- `.rsg-shell`
- `.rsg-frame`
- `.rsg-topbar`
- `.rsg-board-panel`
- `.rsg-canvas`
- `.rsg-control-col`
- `.rsg-panel`
- `.rsg-dpad`
- `.rsg-stat`
- `.rsg-legend`

Risk of removing now: canvas layout, D-pad controls, status messages or mobile route layout may regress.

### Result Modal

The reward/result flow uses `.prm-*` classes through `RewardResultModal`.

Preserve:

- `.prm-shell`
- `.prm-card`
- `.prm-*` stats/actions/responsive rules

### Circuito de Memoria Active Stage

The current Circuito de Memoria visual runtime uses `.mfg-master-*`.

Preserve:

- `.mfg-master-stage`
- `.mfg-master-board`
- `.mfg-master-board-art`
- `.mfg-master-overlay`
- `.mfg-master-hitboxes`
- `.mfg-master-hitbox`
- related mobile rules

## Legacy Blocks Still Present

These blocks are intentionally retained until a selector-level audit proves they are unused or no longer affect active cascade behavior.

### Older 2D Home / World Shelf

Includes early dashboard, world shelf and game-piece styles. Some may now be unused after the 3D Home transition, but the block is large and mixed with shared world visual metadata.

Future cleanup requirement:

- Confirm each selector has zero references in `src/`.
- Confirm no selector is used by archived/lab routes.
- Remove in small batches, not as one large deletion.

### Memory Circuit Prototype History

Older `.mfg-*` blocks from E8D/E8F/E8I/E8J/E8K/E8L remain below the Rota section. The active path is `.mfg-master-*`, but older classes should only be removed after checking the current Circuit components and cascade order.

Future cleanup requirement:

- Audit `MemoryCircuitStage.tsx`, `MemoryCircuitPadLayer.tsx`, `MemoryCircuitHud.tsx` and `MemoryCircuitAccessibleControls.tsx`.
- Verify which `.mfg-*` selectors are still rendered.
- Remove old prototype blocks one phase at a time.

### Legacy Active Games

Security Panel, Number Trail and Seed Garden still depend on older shared surface/button/status CSS. Preserve until those games are rebuilt.

## Future CSS-CLEAN Candidates

1. Remove old 2D Home selectors after confirming production Home no longer imports/renders those classes.
2. Remove Memory Circuit prototype selectors that predate `.mfg-master-*`.
3. Split `globals.css` into scoped CSS modules or route-level CSS once the visual system stabilizes.
4. Re-audit shared game UI after rebuilding the three older games.
5. Replace broad cascade locks with smaller route-scoped selectors where possible.

## Areas That Need Investigation Before Removal

- Any selector with prefixes `game-`, `world-`, `activity-`, `mfg-`, `rsg-`, `prm-`, `seed-`, `number-` or `security-`.
- Any style used by shared components kept for older games.
- Any media query near active blocks, because removing only the desktop selector while keeping mobile overrides can create misleading dead code.

## Cleanup Rules

- Do not remove CSS because it "looks old".
- Confirm usage with `rg` against `src/` first.
- Prefer small removals with build validation after each group.
- Preserve hooks and rules: `useEscapeMaze.ts` and `useColorSequenceGame.ts` are outside CSS cleanup scope.
- Preserve assets and registry entries during CSS-only missions.
