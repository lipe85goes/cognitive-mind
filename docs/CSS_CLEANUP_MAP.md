# MindFlow CSS Cleanup Map

This document records the current `src/app/globals.css` structure after CLEAN-07.
It is a safety map, not a redesign plan.

Visual-system rule: new feature CSS should not be added to `src/app/globals.css`.
Use `docs/MINDFLOW_VISUAL_SYSTEM.md` before creating or moving visual styles.

## CLEAN-07 Baseline

- `globals.css` line count before CLEAN-07 comments: 13,565 lines.
- CLEAN-07 intentionally changed comments/documentation only.
- No selectors, declarations, game logic, assets, registry entries, hooks or runtime components were changed.

## CLEAN-08 Surgical Removal

- `globals.css` line count before CLEAN-08: 13,639 lines.
- `globals.css` line count after CLEAN-08: 12,635 lines.
- CLEAN-08 removed only selectors with zero active references outside `src/app/globals.css`.
- No Home 3D, Rota Babylon canvas, Circuito `.mfg-master-*`, result modal, game hooks, assets or registry entries were changed.

Exact searches used before removal:

```bash
rg "\bmfg-modular\b" src --glob "!src/app/globals.css"
rg "\bmfg-board-pad-hitbox\b" src --glob "!src/app/globals.css"
rg "\bmfg-circuit-trail\b" src --glob "!src/app/globals.css"
rg "\bmfg-pad-sprite\b" src --glob "!src/app/globals.css"
rg "\bmfg-sprite\b" src --glob "!src/app/globals.css"
rg "\brsg-cell\b" src --glob "!src/app/globals.css"
rg "\brsg-token\b" src --glob "!src/app/globals.css"
rg "\bmfg-modular-stage\b" src --glob "!src/app/globals.css"
rg "\bmfg-circuit-trails\b" src --glob "!src/app/globals.css"
rg "\bmfg-sprite-core\b" src --glob "!src/app/globals.css"
rg "\bmfg-board-hitboxes\b" src --glob "!src/app/globals.css"
rg "\bmfg-board-shell\b" src --glob "!src/app/globals.css"
rg "\bmfg-pad-art\b" src --glob "!src/app/globals.css"
rg "\bmfg-pad-sprite-aura\b" src --glob "!src/app/globals.css"
rg "\bmfg-pad-sprite-touch\b" src --glob "!src/app/globals.css"
rg "\bmfg-pad-feedback\b" src --glob "!src/app/globals.css"
rg "\brsg-wall-block\b" src --glob "!src/app/globals.css"
rg "\brsg-token-player\b|\brsg-token-guardian\b|\brsg-token-exit\b|\brsg-token-star\b" src --glob "!src/app/globals.css"
rg "\brsg-star-pulse\b" src --glob "!src/app/globals.css"
```

Removed groups:

- Old Rota 2D grid/token leftovers: `.rsg-board`, `.rsg-cell*`, `.rsg-wall-block`, `.rsg-token*`, `rsg-star-pulse`.
- Old Memory Circuit prototype hitbox/sprite/trail leftovers: `.mfg-board-pad-hitbox*`, `.mfg-modular-stage*`, `.mfg-circuit-trail*`, `.mfg-circuit-trails`, `.mfg-pad-sprite*`, `.mfg-sprite-core`, `.mfg-board-hitboxes`, `.mfg-board-shell`, `.mfg-pad-art`, `.mfg-pad-feedback`.

Preserved by risk:

- `.rsg-board-col`, `.rsg-board-panel`, `.rsg-board-legend`, `.rsg-canvas` because they are active in `RouteStrategyGame.tsx`.
- `.mfg-frame-hero`, `.mfg-illustrated-stage`, `.mfg-memory-*`, `.mfg-support-*`, `.mfg-master-*` because they are active in the current Circuito de Memoria components.

## MINDFLOW-UNIFIED-VISUAL-01 Base Canvas Change

The app base canvas (`body::before` / `body::after` in `globals.css`) was repainted
from the old light cream tabletop to the dark atelier wash used by every active
runtime surface (Home, Rota, Circuito, intro, transition, result modal).

Why: every active screen is dark, so the light base showed through as a white
flash on first paint, view swaps and overscroll.

Paired changes:

- `viewport.themeColor` and `manifest.ts` colors moved to `#0b120f`.
- `.game-console` gained its own warm parchment sheet so the three legacy games
  (Security Panel, Number Trail, Seed Garden) stay readable on the dark base.
  Remove that sheet only when GAME-BRIDGE-01 rebuilds those games.

Do not revert the base to a light wash while the active screens are dark.

## CLEANUP-HOME-CSS-LEGACY Card Removal

- `globals.css` line count before: 12,745 lines. After: 12,075 lines (670 deleted, 0 added).
- Removed every rule whose selectors require `.world-diorama-card` or a `.world-card-*` class
  (`-body`, `-copy`, `-glow`, `-image`, `-inner-frame`, `-media`, `-meta-row`, `-skill`, `-title`):
  87 rules across four duplicated generations of the old card shelf, plus one `@media (min-width: 1280px)` left empty.
- No rule mixed a dead selector with a live one, so no surviving rule was edited.

Exact search used before removal (0 matches):

```bash
git grep -nwE "world-diorama-card|world-card-(body|copy|glow|image|inner-frame|media|meta-row|skill|title)" -- src ':!src/app/globals.css'
```

Preserved on purpose:

- `.world-tone-*` and all `--world-card-*` definitions, still read by the `.world-piece-*` / `.world-rendered-*` blocks.
- `.world-piece-*`, `.world-rendered-*`, `.world-art-shell` and the other `world-*` shelf selectors; only
  descendants gated by `.world-diorama-card` were removed.

## CLEANUP-HOME-CSS-LEGACY-02 World Shelf Families

- `globals.css` line count before: 12,075 lines. After: 11,017 lines (1,061 deleted, 3 added).
- Audited: `world-piece-*` (16 classes), `world-rendered-*` (3), `world-tone-*` (5), `world-art-shell`,
  `world-pedestal-deck`, `world-mini-*` (4) and the `--world-card-*` custom properties.
- All 30 classes have 0 consumers in `src/`: static `className`, template literals, dynamic prefixes and
  string concatenation were checked. The last consumer, `` `world-entry world-tone-${meta.world}` `` in
  `WorldEntryTransition.tsx`, was removed in `bdbd26c`.
- `--world-card-*` was defined only on `.world-tone-*`, so it never reached a rendered element, and every
  rule reading it was already dead.
- Removed 106 rules whose every selector requires one of those classes (including descendant rules such as
  `.world-mini-scene .garden-pot` and `.world-game-piece.is-selected .world-piece-plaque`), both `.world-tone-*`
  generations (the `--entry-*` set and the `--world-card-*` set), and 2 `@media` blocks left empty.
- Pruned dead selectors from 5 shared selector lists without touching their declarations:
  `.world-piece-shadow` / `-backplate` / `-foot` (twice, beside `.world-object-aura`), `.world-piece-enter` and
  `.world-piece-enter::after` (beside `.game-play-cta` / `.game-note-card button`), `.world-piece-title`
  (beside `.game-world-plaque h2`).
- Removed or shortened 4 comments that only described removed rules.
- Every surviving rule body is byte-identical to its previous version. Computed styles (every element plus
  `::before` / `::after`) and full-page screenshots of Home, each selected world, the 5 world intros and the
  5 game screens, at desktop and mobile widths, are identical before and after on production builds. The
  `/lab/*` routes return 404 in production, so they were covered by the consumer search only.

Exact search used before removal (0 matches):

```bash
git grep -nE "(^|[^A-Za-z0-9_-])(world-piece-|world-rendered-|world-tone-|world-art-shell|world-pedestal|world-mini)" -- src ':!src/app/globals.css'
git grep -n -- "--world-card-" -- src ':!src/app/globals.css'
```

Still dead but left for a later batch (0 consumers, outside this audit's scope): `.world-object-aura`,
`.world-number-medal`, `.world-title-plaque`, `.world-enter-button`, `.world-stage-tab`, `.world-new-ribbon`,
`.world-game-piece`, `.world-entry*`, `.game-play-cta`, `.game-note-card`, `.game-brand-lockup`, `.game-hero-copy`.
They still hold 15 `var(--world-card-*)` reads and the `.world-entry*` `var(--entry-*)` reads; neither set
has a definition now, and neither was ever reachable before.

## CLEANUP-HOME-CSS-LEGACY-03 World/Game Leftovers

- `globals.css` line count before: 11,017 lines. After: 10,251 lines (766 deleted, 0 added).
- Audited the 12 families left over by LEGACY-02: `.world-object-aura`, `.world-number-medal`, `.world-title-plaque`,
  `.world-enter-button`, `.world-stage-tab`, `.world-new-ribbon`, `.world-game-piece`, `.world-entry*`
  (`-card`, `-media`, `-image`, `-emblem`, `-eyebrow`, `-name`), `.game-play-cta`, `.game-note-card`,
  `.game-brand-lockup`, `.game-hero-copy`.
- All of them have 0 consumers in `src/`, `tools/` and `public/`, labs and games included: static `className`,
  template literals (`world-${…}`, `game-${…}`, `${…}-suffix`), string concatenation, `classList`,
  `querySelector`/`closest`/`className =` and other CSS files were checked. At runtime, no element carries any
  of these classes on Home, the 5 selected worlds, the 5 intros, the 5 games (desktop and mobile, production
  build) or on `/lab/3d-home` and `/lab/route-launcher` (dev server).
- Last consumers were removed in `4e889e8` (`world-object-aura`, `-number-medal`, `-title-plaque`,
  `-enter-button`, `-stage-tab`, `-new-ribbon`), `9e4c5e4` (`world-game-piece`, `game-play-cta`,
  `game-note-card`, `game-brand-lockup`, `game-hero-copy`) and `bdbd26c` (`world-entry*`).
- Not the same thing, still live: `.wentry-*` in `src/styles/world-entry.css` (imported by
  `WorldEntryTransition.tsx`) and the `data-world-entry-focus` / `data-world-entry-return` attributes.
- Removed 84 rules whose every selector requires one of those classes (pseudo-elements, `:focus-visible`,
  `:hover`, `:nth-child()`, `.is-selected` and descendant selectors included), 1 `@media (max-width: 767px)`
  left empty, and 2 comments that only described removed rules. No selector used `:not()`, `:is()` or
  `:where()` with these classes.
- Pruned `.game-brand-lockup strong` and `.game-hero-copy h1` from the one shared selector list; its
  declarations and the remaining `.game-world-plaque h2` selector are unchanged.
- The removed rules used no `@keyframes` and defined no custom properties. The 23 orphaned
  `var(--world-card-*)` / `var(--entry-*)` reads are gone with them; neither prefix is read anywhere now.
- Every surviving rule, at-rule and comment is byte-identical and in the same order. The compiled CSS chunk
  went from 201,976 to 187,350 bytes; the other 4 chunks are byte-identical. Computed styles (every element
  plus `::before` / `::after`) and full-page screenshots of Home, each selected world, the 5 intros and the
  5 games, at desktop and mobile widths, are identical before and after on production builds. Computed
  styles on the 2 lab routes are identical in dev.

Exact searches used before removal:

```bash
# 0 matches
git grep -nE "world-object-aura|world-number-medal|world-title-plaque|world-enter-button|world-stage-tab|world-new-ribbon|world-game-piece|game-play-cta|game-note-card|game-brand-lockup|game-hero-copy" -- . ':!src/app/globals.css' ':!docs'
# 10 matches, none a class: import paths (components/world-entry/, styles/world-entry.css)
# and data-world-entry-focus / data-world-entry-return attributes
git grep -n "world-entry" -- src ':!src/app/globals.css'
```

Preserved on purpose:

- `.game-world-plaque h2` in the pruned list: outside this audit's scope.
- `public/illustrations/ui/button-gloss.svg`: its only reference was the removed `.game-play-cta::after`
  rule, but CSS-only missions keep assets.

Still 0 static consumers but not audited here (candidates for a later batch): `.game-world-plaque`,
`.game-world-shelf`, `.shelf-track`, `.shelf-arrow`, `.game-world-stage`, `.game-bottom-hud`, `.game-hud-chip`,
`.game-profile-chip`, `.game-settings-button`, `.game-topbar`, `.game-brandmark`, `.game-mission-notes`,
`.game-opening-stage`, `.game-progress-plaque`, `.memory-orb`, `.memory-console`.

## CLEANUP-HOME-CSS-LEGACY-04 Game Menu Stage/HUD Batch

- `globals.css` line count before: 10,251 lines. After: 9,402 lines (849 deleted, 0 added).
- Audited 9 families from the LEGACY-03 candidate list: `.game-world-plaque`, `.game-world-shelf`, `.shelf-track`,
  `.game-world-stage`, `.game-bottom-hud`, `.game-hud-chip`, `.game-topbar`, `.memory-orb`, `.memory-console`,
  plus their element classes `.game-hud-chip-icon` and `.game-topbar-status`.
- All of them have 0 consumers in `src/`, `tools/` and `public/` (the other stylesheets included), and have had none
  since at least `9bf72fe`, the oldest commit in the current history. Static `className`, template literals,
  string concatenation, `join()`, `classList`, `querySelector`/`closest`/`className =` and suffix constructors were
  checked. The only dynamic constructor with a matching prefix, `` `game-world-${world}` `` in `GameLayout.tsx`,
  takes a `WorldKey` (`memory | route | commands | logic | garden`), so it can only produce `.game-world-memory`
  and its siblings. At runtime, no element carries any of these classes on Home, the 5 selected worlds, the
  5 intros or the 5 games (desktop and mobile, production build), nor on `/lab/3d-home` and `/lab/route-launcher`
  (dev server).
- Removed 108 rules whose every selector requires one of those classes (52 top level, 56 inside `@media`;
  pseudo-elements, `h2`/`p`/`strong`/`em`/`svg` descendants and `.game-world-shelf .shelf-arrow` included), and
  8 `@media` blocks left empty. No selector used `:not()`, `:is()`, `:where()` or `:has()` with these classes.
- Pruned `.game-hud-chip` from 6 shared selector lists (beside `.game-profile-chip` / `.game-settings-button`, one
  also with `.game-brandmark`) and `.game-hud-chip-icon` from 2 (beside `.game-profile-chip > span:first-child`
  and `.game-progress-icon` / `.game-growth-orb`). Their declarations and remaining selectors are unchanged.
- The removed rules used no `@keyframes` and defined no custom properties. No comment was touched: the 3 comments
  that sat above removed rules still head surviving rules.
- Every surviving rule, at-rule and comment is byte-identical and in the same order. The compiled CSS chunk went
  from 187,350 to 173,207 bytes; the other 4 chunks are byte-identical. Computed styles (every element plus
  `::before` / `::after`) and full-page screenshots of Home, each selected world, the 5 intros and the 5 games,
  at desktop and mobile widths, are identical before and after on production builds, except where two runs of the
  same build already differ: Rota's Babylon canvas pixels (its computed styles are identical), Jardim de Sementes'
  randomized board, and an occasional one-element `.pgi-frame` difference on the desktop intros. Computed styles
  on the 2 lab routes are identical in dev.

Assets:

- Removed `public/illustrations/ui/button-gloss.svg` (0 references in `src/`, `tools/`, `public/` and the build
  output, no dynamic `/illustrations/ui/` path, never requested at runtime). Its only reference was the
  `.game-play-cta::after` rule removed in LEGACY-03. This mission explicitly included the asset.
- The removed rules held 5 `url()` reads. `wood-grain.svg` (4 of them) stays live: `.lab3d-world-sign`
  (`GameHome3D.tsx`, `/lab/3d-home`) still requests it, and `--mf-wood-grain` still points at it.
- `gold-flourish.svg` lost its only reference (`.game-world-plaque h2::before/::after`) and now has 0 references.
  It was never requested at runtime. Kept: outside this mission's asset scope, candidate for a later batch.

Exact searches used before removal:

```bash
# 0 matches
git grep -nE "game-world-plaque|game-world-shelf|shelf-track|game-world-stage|game-bottom-hud|game-hud-chip|game-topbar|memory-orb|memory-console" -- src tools public ':!src/app/globals.css'
git grep -nE -- '\}-?(plaque|shelf|track|stage|hud|chip|topbar|orb|console)\b' -- src tools public
git grep -n "button-gloss" -- src tools public
# 1 match, typed WorldKey only: GameLayout.tsx `game-world-${world}`
git grep -nE '(game-|memory-|shelf-|game-world-|game-hud-)\$\{' -- src tools public
```

Still 0 static consumers but not audited here: `.shelf-arrow`, `.game-profile-chip`, `.game-settings-button`,
`.game-brandmark`, `.game-mission-notes`, `.game-menu-home`, `.game-opening-stage`, `.game-opening-bg`,
`.game-progress-plaque`, `.game-progress-icon`, `.game-growth-orb`, `.game-hud-progress`, `.memory-pad*`, and the
`gold-flourish.svg` asset.

## Active Blocks To Preserve

### Global Base / Tokens

Keep the root theme variables, safe-area variables, world palettes, reset rules and shared accessibility tokens. These are reused across the Home, game shells, legacy games and result flow.

### Shared Game UI

Preserve shared game layout/button/status classes while `security-panel` and `seed-garden` still use the older shared UI components.

Risk of removing now: breaking the two older active games before they are rebuilt.

GAME03-SKELETON-01 retired `number-trail`: the rules only the Trilha used — `.logic-*`, `.game-world-logic` and `.reward-world-number-trail` in `src/app/globals.css` — have no consumer now. They were left in place (that mission was not a CSS cleanup) and can go in a cleanup pass with the usual reference search. The Estúdio das Descobertas (`hidden-objects`) does not use `globals.css` game classes: its styles are `.hos-*` in `src/games/hidden-objects/hidden-objects.css`.

### Active 2.5D Home

The production Home uses `src/styles/home.css` for the 2.5D "O Atelie dos Mundos" stage.
All new production Home selectors are prefixed with `.hj-*` and are intentionally outside `src/app/globals.css`.

MINDFLOW-UNIFIED-VISUAL-01 consolidated this file: it previously held a full
light-stage design plus a dark WORLD-COHESION-01 override block that won the
cascade. It is now a single dark design, and the dead light rules plus the
unused `.hj-plane-*` / `.hj-haze-b` noise layers were removed together with
their spans in `HomeStage.tsx`.

Preserve:

- `.hj-main`
- `.hj-stage`
- `.hj-greeting-*`
- `.hj-world-*`
- `.hj-panel-*`
- related responsive/mobile rules in `src/styles/home.css`

Do not add new Home CSS to `globals.css`.

### Old 3D Home / `/lab/3d-home`

The old 3D Home implementation remains on disk and may still be used by `/lab/3d-home` or future visual comparison work.
Treat `.lab3d-*` as lab/legacy CSS until HOME-02 or a dedicated teardown mission confirms it is safe to remove.

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

Some older `.mfg-*` wrapper and shell blocks from E8D/E8F/E8I/E8J/E8K/E8L remain below the Rota section. CLEAN-08 removed the dead hitbox/sprite/trail selectors, but wrapper classes still used by the active Circuit should stay.

Future cleanup requirement:

- Audit `MemoryCircuitStage.tsx`, `MemoryCircuitPadLayer.tsx`, `MemoryCircuitHud.tsx` and `MemoryCircuitAccessibleControls.tsx`.
- Verify which `.mfg-*` selectors are still rendered.
- Remove old prototype blocks one phase at a time.

### Legacy Active Games

Security Panel, Number Trail and Seed Garden still depend on older shared surface/button/status CSS. Preserve until those games are rebuilt.

## Future CSS-CLEAN Candidates

1. Remove old 2D Home selectors after confirming production Home no longer imports/renders those classes.
2. Continue removing Memory Circuit prototype wrappers only after confirming they are no longer rendered by the current components.
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
