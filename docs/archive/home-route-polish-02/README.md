# HOME-ROUTE-POLISH-02 — evidence

Base: `af8b732` (HOME-WORLD-VISUAL-UNIFICATION-01, final). Branch:
`feat/home-route-polish-02`. A micro-polish of the Rota Estratégica's Home
maquette: its two pieces, and the Home's Explorador marker. Home presentation
only — no file under `src/` changed; no Rota gameplay asset (`public/models/route/`)
changed.

## The issue

In the approved atelier maquette, the Rota's pieces still looked like the
earlier art: the **Explorador** was a flat, saturated plastic pawn (a sphere on
a cone), drawn in the `detail` pass — so it was never lit by the key light, it
breathed between 72 % and 100 % opacity with the idle world (the tiles showed
through it) and took the accent halo on focus, like a sticker. The
**Guardião** was a dark rounded blob with one amber dot, and it stood on
`(5, 6)` — a cell inside the low wall block `(4–5, 6)`, so it read as sunk into
the wall. The Home's **Explorador marker** (bottom-left) was the old teal
capsule with a cartoon face and a white outline.

## What changed

- `tools/assets/home-atelier-worlds.mjs` — `explorerMiniature`,
  `guardianMiniature`, `explorerRing` and `MINIATURE_DEFS`: the game's own
  pieces (`tools/blender/create_route_player_glb.py`,
  `create_route_guardian_glb.py`) as painted miniatures at the atelier's scale.
  - **Explorador**: walnut turned base with an inlaid cyan ring; blue
    traveller's coat shaded along the key light, wide-brimmed felt hat, teal
    scarf, belt, satchel on a strap, pack, walking staff. Stays on the route's
    first tile `(1, 5)`.
  - **Guardião**: iron base with an amber ring; tall peaked hood with a dark
    face void, amber eyes and an amber trim, mantle, folded sleeves, flared
    umber cloak with folds and an amber hem; a faint warm edge on the side that
    faces the nearest light. Taller than the Explorador, as in the game. Moved
    one tile to `(6, 6)` — the free near corner beside the light `(6, 5)` — off
    the wall.
  - Both are **matter now (the lit `main` pass)**, painted in depth order with
    the walls: grounded by a contact shadow and an occlusion ring under the
    base, never semi-transparent. What lights up with the world's focus stays in
    `detail`/`energy`: the Explorador's cyan ring (the game's PlayerCyanGlow)
    and a small warm glow in the Guardião's hood.
  - Small on purpose: Explorador ×1.12 and Guardião ×1.06 of the drawing's
    units — both well inside one tile.
- `tools/assets/create_home_world_set.mjs` — `explorerMarker()` now paints that
  same Explorador miniature (and its lit ring) in the marker's unchanged
  360×430 frame. Same file, same box, place, size, opacity and CSS: the marker
  keeps its meaning (the Explorador's quiet presence in the atelier) and is
  still hidden on phones.
- Regenerated from source: `atelier/route/route-main.webp`, `route-detail.webp`,
  `route-energy.webp`, `explorer-marker.webp`, and the review sheets the two
  scripts write (`home-world-visual-unification-01/kit/route*.webp`,
  `kit/lineup.webp`, `home-world-masters/home-world-review.png`).

Not changed: the pedestal, portal, ruin, signpost, board, walls, lights, chest,
front props, the Rota's `base`/`back`/`front` passes, the shared contact shadow,
the kit (`home-atelier-kit.mjs`), every runtime file under `src/`, and every file
of the other four worlds (byte-identical).

## Files

| File | What |
| --- | --- |
| `rota-before.webp`, `rota-after.webp` | the Rota maquette composited from its seven passes on the Home's backdrop (1040×780) |
| `figures-closeup.webp` | old vs new Explorador and Guardião, from source at ×4 (the old Guardião inside the wall block) |
| `figures-home-scale.webp` | both pieces at the real Home sizes — desktop (736 px maquette) ×3 and phone 390 (343 px) ×6, nearest-neighbour |
| `figures-desktop-pixels.webp` | the board in the real Home screenshot (production build, 1440×900, DPR 1) ×3 |
| `marker-before-after.webp`, `marker-desktop-pixels.webp` | the Explorador marker: the sprite, and the real Home pixels ×4 |
| `home/desktop-route-before.webp`, `home/desktop-route-after.webp` | the desktop Home (1440×900) with the Rota selected |
| `home/phone-390-route.webp`, `home/phone-390-rota-maquette.webp` | the phone Home (390×844, DPR 3) with the Rota selected — the page, and the maquette at device pixels |
| `home/desktop-every-world-after.webp` | the desktop Home with each of the five worlds selected |
| `lineup-before.webp`, `lineup-after.webp` | the kit lineup: Rota, Circuito, Central, Estúdio (the reference), Jardim |
| `isolation-pixels.json` | for each world selected, where the before/after desktop screenshots differ |
| `perf/home-payload-{before,after}.json` | what the browser fetched to show the Home, cold cache, both builds |
| `probe/home-world-browser-probe.json` | the Home probe on the final production build |

Screenshots are taken on `next start` with an empty image-optimizer cache
(`.next/cache/images` survives `next build` and serves the previous build's
variants for the same URL — a first "after" capture showed the old pieces for
that reason and was discarded). The breathing animations are parked at their
full state so before and after compare like for like.

## Isolation (other worlds)

- Files: of everything under `public/illustrations/home/atelier/` and
  `dioramas/`, only `route-main`, `route-detail` and `route-energy` differ from
  `af8b732`; the other four worlds and the shared shadow regenerate
  byte-identically (`git diff af8b732` lists no other world file).
- Pixels (`isolation-pixels.json`): with each world selected, the only changed
  regions of the desktop Home are the Rota maquette wherever it stands (centre;
  left neighbour of the Circuito; the edges with Central or Estúdio selected;
  right neighbour of the Jardim) and the marker at the bottom-left. No pixel of
  another world's maquette moved.

## Payload (production build, cold cache)

| | before (`af8b732`) | after |
| --- | --- | --- |
| Rota on disk (6 own passes) | 82.4 KB | 82.7 KB |
| `explorer-marker.webp` on disk | 11,792 B | 11,944 B |
| All five maquettes on disk (K05) | 438.9 KB | 439.3 KB |
| Desktop 1440×900 — images | 35 requests · 479,092 B | 35 requests · 479,196 B |
| Desktop — the Rota's 6 own variants fetched (w=750) | 57,852 B | 58,142 B |
| Desktop — marker variant (w=96) | 2,619 B | 2,433 B |
| Phone 390×844 (DPR 3) — images | 34 requests · 627,471 B | 34 requests · 627,089 B |
| Phone — the Rota's 6 own variants fetched (w=1080) | 79,338 B | 79,532 B |
| JS / CSS fetched | 9 · 207,868 B / 7 · 47,271 B | identical |

No JavaScript, CSS or component changed; no request added or removed.

## Validation (final tree)

| Check | Result |
| --- | --- |
| `home-atelier-kit-tests.mjs --deep --counterfactuals` | 11/11 — K01–K10 hold (K09: the source paints what ships, no drift; K05: Rota 82.7 KB, all maquettes 439.3 KB); the source checks still fail on `720b404` |
| Regeneration | both generators rebuild every runtime file of the other worlds and the shared shadow byte-identically; `world-panel.webp`, `world-garden.webp` too |
| `home-world-browser-probe.mjs` (production build) | 28/28 (`probe/home-world-browser-probe.json`) — selection by pip, arrows, keys and neighbour plaque, one plaque line, focus ring, Enter, every world entered (Rota: maquette into threshold and intro), phones 390/360 without sideways scroll and with 44 px targets, short desktops, reduced motion |
| `npx eslint` (repo) | 0 errors; 5 warnings, all in files this mission does not touch (`hidden-objects-skeleton-tests.mjs` ×4, `create_hidden_objects_scene.mjs` ×1 — both unchanged since `af8b732`) |
| `npx tsc --noEmit` | clean |
| `npx next build` | ok (`/`, `/lab/3d-home`, `/lab/route-launcher`, manifest) |
| `gameplay-platform-lock-v1.mjs` · `--counterfactuals` | 18/18 · `LOCK_GATE_COUNTERFACTUALS_HOLD` |
| Rota structure: `route-module-loader-tests` · `route-validation-coupling-gate` (and `--rev=5d541b2`) · `route-board-loader-tests` · `game-continuation-contract-tests` · `route-journey-ownership-tests` · `route-journey-terminal-tests` · `route-visual-state-tests` | 23/23 · 6/6 (0/5 at `5d541b2`, as required) · 7/7 · 21/21 · 7/7 · 13/13 · contract OK |
| CORE (`validation-hygiene-tests.mjs`) | `CORE_BATTERY_PASSED`, evidence matches |
| DEEP (`final-acceptance.mjs`) | structural 1080/1080 · continuous 270/270 · recovery OK · evidence matches |
| Game 03 suites | skeleton 38, experience 45, multiscene 20, calibration 28, interactions 28, replayability 36, final-lock 9 — all green |
| Game 03 `--counterfactuals` | all HOLD — skeleton (base + 18 mutants), experience 33, multiscene 19, calibration 17, final-lock 14 caught |
| `hidden-objects-browser-probe.mjs` (through the Home) | 104/104 |
| Home → Rota, the whole journey (`game-continuation-browser-probe --scenario journey`) | with the CPU idle: **PASS on this build and on the base build** (`af8b732`, built from a worktree) — Home without game code, Rota intro, Route 1 played to its result, continuation to Route 2 (intro skipped), back, Rota fresh again, Circuito. While the Game 03 counterfactuals were running on the same 4 cores, both builds failed identically at the Rota's 28 s entry watchdog (`covering → preparing → error`, no page error) — the lock document's D18 (SwiftShader + a busy CPU), not this change |

No file under `src/`, `public/models/` or `public/assets/` changed since
`af8b732` (`git diff --name-only af8b732 -- src public/models public/assets` is
empty): route generation, map rules, player and guardian runtime, traps,
scoring, progression and the Worker are untouched, and so are the Rota's
gameplay GLBs.

## Known limitations

- At phone size (the maquette is ~343 px wide) the pieces are ~17 px (Explorador)
  and ~21 px (Guardião) tall:
  they read as a hatted blue figure on a cyan-ringed base and a hooded figure
  with amber eyes, not in detail — by design, they stay small.
- The Home's image optimizer serves the Rota passes as q75 WebP; next to the
  blue coat, the pack's shadow side keeps a faint violet cast from chroma
  subsampling (a lighter bedroll that turned into a lavender speck was removed
  for that reason).
- `home-world-masters/home-world-review.png` is not byte-reproducible across
  machines (its title and labels are rendered with the system's fonts); it was
  regenerated here to show the new marker.
- The chest on the board was left as it is (a prop, not a piece; out of this
  mission's scope).
