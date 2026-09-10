# MINDFLOW-HOME-VISUAL-04 — the Route Home maquette stopped advertising a Shield

The game replaced the Shield pickup with the Chest in ROTA-CHEST-REWARDS-01.
The Home's Route maquette kept staging `shield.glb` anyway, so the front page
was showing players an object the game no longer has — and that single live
owner was why MINDFLOW-CLEANUP-03C could not remove the model.

## Ownership map, at this HEAD

| layer | what stages the reward slot |
| --- | --- |
| gameplay renderer | `routeBabylonScene.ts` loads seven GLBs — board, wall, player, guardian, portal, light, trap. Not the shield. |
| Home maquette | `create_hero_world_dioramas.py` → `import_glb("props", "shield", …)` at `(1.25, 0.22, 1.45)` |
| encode | `create_hero_world_layers.mjs` → `public/illustrations/home/dioramas/route-world/*.webp` |
| consumed by | `worldDioramaLayout.ts` → `WORLD_DIORAMA_CONFIGS` → `worldMasterSceneConfig.ts` `essentialAssets` |

## Decision: A — the Shield becomes the Chest

Not chosen by default. The three options were weighed against the composition:

- **B, remove without replacement** would have left the front-right corner empty
  and dropped the reward beat entirely, in a maquette that already stages board,
  walls, lanterns, trap, portal, Guardian and Explorer. The reward is the one
  thing the current design is *about*.
- **C, promote an existing element** had no candidate — nothing else in the scene
  represents a reward.
- **A** is what the game itself did: `useEscapeMaze` records that the Chest
  inherited the shield's exact placement slot. Making the maquette agree is the
  smallest change that makes it true.

The Chest has **no GLB** — `routeBabylonScene.ts` builds it from boxes. So it is
built from boxes here too, in the generator's own primitive vocabulary and in the
renderer's own palette: stone body, bronze plinth, one teal ember. No new asset,
no new material, no new mechanic.

### What the visual iteration cost, and what it settled

The first build put bronze bands around the sides and sank the ember into the
lid. At 3× zoom it read as one more ruin block with a sticker on it. The second
run wrapped straps over body and lid together; sized to be in scale, they
overshot the lid and read as two upright posts, then as dark grooves — damage,
not strapping.

The straps were dropped. This maquette is displayed at roughly a third of the
render size, and detail thin enough to be in scale disappears or degrades there.
What survives the downscale is the silhouette and the ember, so the object is an
overhanging stone lid on a bronze plinth with a lock plate, and the ember was
enlarged from 0.055 to 0.10 — measured against the scene's lantern pools at 0.19
— after it vanished entirely on the Home card.

`reward-slot-before.png` / `reward-slot-after.png` are the 3× crops.
`home-card-before-after.png` is the honest one: both versions at 420 px, near the
size the Home actually shows.

**Stated plainly:** the blue badge was loud and the Chest is quiet. At card size
it reads as a small prop rather than a focal point. That is a deliberate stop —
making the reward a focal point again means raising its glow above the scene's
existing energy language, which is a design decision for the owner, not a
cleanup.

## Only two passes changed

Every layer renders in isolation, so an edit to `props` and `energy` cannot
reach the other six. That was verified rather than assumed, by rendering the
**unmodified HEAD generator** and diffing against the committed passes:

```
pass          diff %   new opaque px
shadow         0.000               0
base           0.000               0
terrain        0.000               0
structure      8.816          29 044     <-- pre-existing, see below
props          0.000               0
characters     0.000               0
energy         0.000               0
front          0.000               0
```

The renderer is deterministic: seven of eight passes reproduce exactly. So the
`props` and `energy` differences in the shipped render are entirely this
mission's, and the `structure` difference is **not**.

### A pre-existing drift, found and deliberately not shipped

`route-structure.png` as committed does not match what the committed generator
produces: the current generator renders the board noticeably larger
(`structure-drift-archived.png` vs `structure-drift-current.png`, 29 044 pixels
gained, **0 lost** — purely additive). The archived pass predates some change to
the board staging.

Shipping it would have been an unrequested change to the Home's composition, so
the six passes this mission did not intend to change were restored from `HEAD`
and only `props` and `energy` were kept. The runtime WebPs follow: exactly two
changed.

Recorded as a follow-up, not fixed here.

## Shield reachability after

| question | answer |
| --- | --- |
| `SHIELD_RUNTIME_REACHABLE_AFTER` | **NO** — no executable reference in `src/` |
| `SHIELD_GENERATOR_REACHABLE_AFTER` | **NO** — the only remaining hit is the comment explaining the replacement |
| `SHIELD_TOOLING_REACHABLE_AFTER` | **NO** — see the homonym note |
| `SHIELD_ACTIVE_DOC_REACHABLE_AFTER` | **NO** — the three active docs now describe the removal |

With no owner left, `public/models/route/shield.glb` (87.8 KB) and its generator
`tools/blender/create_route_shield_glb.py` were removed. Their previews stay in
`docs/archive/route-previews/` as history.

**Homonyms, deliberately untouched.** `create_secondary_world_dioramas.py` builds
`Panel_Shield`, `Panel_ShieldInner` and `Panel_ShieldGlow` from cones — the
**Panel world's** emblem, nothing to do with the Route model. And the lucide
`Shield` / `ShieldPlus` glyphs name the Hunter and the Sentinel in the HUD.

## Validator, strengthened rather than deleted

`chest-static-render-audit.mjs` recorded the model's presence on disk as a
*detail* with a note explaining why it stayed. That note is now false, and the
observation can be an assertion: `modelOnDisk`, `modelGeneratorOnDisk` and
`heroDioramaStagesIt` joined `shieldTraces`, so `SHIELD_FULLY_REMOVED` proves
ten things instead of seven. Nothing was kept alive to satisfy a test, and no
assertion was dropped.

```
CURRENT_NON_HISTORICAL_REFERENCES_AFTER = 0
PRODUCTION_BUILD_REFERENCES_AFTER = 0        (363 production artifacts)
DEV_CACHE_HITS = 2                           (stale .next/dev, not deleted)
```

The scanner self-tests against five fixtures first, and separates a third
category the previous cleanup did not need: a live string that asserts a file is
**gone**. `chest-static-render-audit.mjs` holds the only such reference.

## Regressions

| check | result |
| --- | --- |
| lint / `tsc --noEmit` / `next build` | 0 / 0 / 0, compiled in 27.2s |
| CORE battery | 15/15, `VALIDATION_CHECK_IS_READ_ONLY`, `CORE_BATTERY_PASSED` |
| DEEP `final-acceptance` | 1080/1080, 270/270, recovery 9/9 |
| Babylon | 7 gameplay GLBs present, 3 lights, one renderer owner |
| Memory Circuit | v2 assets 7/7, `circuit-world` 7/7, **0 circuit files changed** |
| lab boundary | preserved |
| EOL | 0 files outside the LF policy |
| `git diff --check` | exit 0 |

`public/`: 84 → 83 files, 7.22 → 7.14 MB. That is 87.8 KB — the model's own
size, and nothing more. The two re-encoded WebPs net out at roughly zero.

## Follow-ups

1. **`route-structure` drift.** The committed generator and the archived pass
   disagree about board scale. Someone should decide which is correct and
   re-render deliberately.
2. The `.world-card-*` / `.world-diorama-card` CSS from the previous cleanup is
   still dead. Untouched here.
