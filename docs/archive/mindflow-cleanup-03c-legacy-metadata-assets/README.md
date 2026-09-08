# MINDFLOW-CLEANUP-03C — legacy metadata and assets

Removed the world metadata that nothing read, the asset chains that only that
metadata kept alive, and the superseded diorama generators. Everything the
product actually renders was reconfirmed against `HEAD` rather than trusted from
the earlier audit.

## What the graph said, at this HEAD

Two findings reversed the naive reading and are the reason this mission removed
less than the original audit proposed.

**Diorama layers are built from a template string, not imported.**
`worldDioramaLayout.ts` composes `/illustrations/home/dioramas/${kind}` for the
three secondary worlds and `/illustrations/home/dioramas/${kind}-world` for the
two hero worlds. A basename search finds no reference to any layer file, which
would have made all 64 of them look orphaned. The live sets are
`route-world/` (8 passes), `circuit-world/` (7 — `characters` is skipped because
the artefact is the subject), and `garden/`, `panel/`, `trail/` (7 each). The
**legacy** sets were `dioramas/route/` and `dioramas/circuit/`, replaced by
HOME-HERO-WORLDS-3D-01.

**`shield.glb` is not runtime-reachable, but it is a source asset.**
`routeBabylonScene.ts` loads exactly seven GLBs — board, wall, player, guardian,
portal, light, trap — and the file carries an explicit note that `shield.glb` is
no longer among them. But `tools/blender/create_hero_world_dioramas.py:417`
stages it into the Route hero maquette, which is the Home art the product
renders today. Deleting the model would leave current art unregenerable, so it
stays. `SHIELD_RUNTIME_REACHABLE = NO`, `SHIELD_TEST_REQUIRED = NO`,
`SHIELD_GENERATOR_REQUIRED = YES`.

The same distinction spared `route-diorama.webp` and `memory-diorama.webp`:
`tools/assets/create_world_cohesion_assets.mjs` turns them into
`world-route-hero.webp` and `world-circuit-hero.webp`, which `worldVisuals.ts`
does render.

## Dead metadata

| symbol | assignments | readers |
| --- | --- | --- |
| `WorldMeta.image` | 5 | 0 — propagated into `GameIntroContent.image`, and `GameHowToPlay` never reads it |
| `WorldMeta.dioramaImage` | 5 | 0 |
| `WORLD_DIORAMA_IMAGES` | 1 | only the dead `dioramaImage` |
| `GameIntroContent.image` | 1 | 0 |
| `Activity.skill` + `CognitiveSkill` | 11 | 0 |

`Activity.skill` needed care because the UI does show a skill line — from
`WorldMeta.skill`, via `skillForWorld()`. Every `.skill` read in the codebase
(`GameLayout`, `GameHowToPlay`, `WorldObject`, `RewardResultModal`,
`GameHome3D`, `page.tsx`, `lab/3d-home`) resolves to that field, not to the
`Activity` one. `Activity` is never serialised, so no stored shape changes.

## Removed

27 public files (1041.9 KB) and 4 generators.

| group | files | bytes |
| --- | --- | --- |
| `dioramas/route/` | 12 | 198.2 KB |
| `dioramas/circuit/` | 8 | 156.9 KB |
| `station-*.webp` | 5 | 628.4 KB |
| `world-route.webp`, `world-circuit.webp` | 2 | 58.4 KB |

Generators: `create_world_diorama_layers.mjs`,
`create_world_diorama_final_layers.mjs`, `create_route_home_diorama.py`,
`create_memory_circuit_home_diorama.py` — the whole V02 chain that produced the
two removed layer kits.

The station masters survive as PNGs in `docs/archive/home-station-masters/`, so
the removed `.webp` derivatives are regenerable.

## Kept, and why

| item | reason |
| --- | --- |
| `shield.glb`, `create_route_shield_glb.py` | input to the active hero-diorama generator |
| `route-diorama.webp`, `memory-diorama.webp` | source of the live `-hero` assets |
| `command-diorama.webp`, `logic-diorama.webp`, `garden-diorama.webp` | design masters with no code consumer; deleting source material is a different decision from deleting a dead reference |
| `create_home_world_set.mjs` | still emits the three live secondary sprites; only the two dead entries were dropped |

## Negative proof

The scanner that produced this verdict is self-tested first, against eight
fixtures covering string literals, `url()`, import paths, JS comments, Python
docstrings and Markdown prose. The earlier run of this mission reported a
reference that did not exist, because a Python **docstring** is quoted text and
was read as a live string literal; the fixture for that exact case now guards it.

```
SCANNER_VALIDATED  (8/8 fixtures)
CURRENT_NON_HISTORICAL_REFERENCES_AFTER = 0
PRODUCTION_BUILD_REFERENCES_AFTER = 0   (363 production artifacts)
DEV_CACHE_HITS = 35                     (2238 artifacts under .next/dev)
```

The 35 dev-cache hits are stale Turbopack chunks from `next dev` runs that
predate the removal. `.next/dev` is not deployment output and was deliberately
**not** deleted: clearing it would have manufactured a clean number instead of
measuring one.

Every remaining non-historical mention is prose — this mission's own removal
notes in `README.md`, `ARCHITECTURE.md`, `MINDFLOW_WORLD_MASTER_SCENES.md`, and
a corrected comment in `create_secondary_world_dioramas.py`.

## Regressions

| check | result |
| --- | --- |
| lint | exit 0 |
| `tsc --noEmit` | exit 0 |
| `next build` | exit 0, compiled in 75s |
| CORE battery | 15/15 PASS, `VALIDATION_CHECK_IS_READ_ONLY`, `CORE_BATTERY_PASSED` |
| DEEP `final-acceptance` | 1080/1080, 270/270, recovery 9/9, 5 artifacts MATCHES |
| Babylon light budget | 3 lights (key/fill/rim), `maxLights = 3` |
| single renderer ownership | pass |
| lab boundary | `SERVER_SIDE_LAB_BOUNDARY`, `LAB_3D_HOME_R3F_OWNER_RETAINED` pass |
| Memory Circuit v2 | 7 assets intact |
| EOL policy | 0 files outside LF; `create_home_world_set.mjs` CRLF = 0 |
| `git diff --check` | exit 0 |

Evidence artifacts were neither rewritten nor touched: 0 created, 0 deleted,
0 changed, 0 mtime churn, and the worktree was identical before and after the
checks. No `git restore` anywhere in the procedure.

## Follow-ups recorded, not actioned

- **CSS.** `.world-card-*` and `.world-diorama-card` are dead — 129 selector
  occurrences in `globals.css` (11266 lines), with the block duplicated at two
  places. No `.tsx` references them. Out of scope by §12.
- `public/illustrations/worlds/*-diorama.webp` are design masters living in the
  deployment directory. Three of the five have no consumer at all. Whether they
  belong under `docs/archive` instead is a decision, not a cleanup.
