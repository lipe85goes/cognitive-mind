# MINDFLOW-HOME-VISUAL-05 — the Route maquette was still showing a 7×7 board

The previous mission found that `route-structure.png` did not match what the
committed generator produces: the generated board was larger, by 29 044 opaque
pixels and none lost. It was left unshipped because its cause was unknown.

The cause is not the generator, and the drift is not cosmetic. The archived pass
depicts a board the game deliberately fixed.

## Timeline

| commit | date | what |
| --- | --- | --- |
| `c2ec413` | 2026-08-01 | `create_hero_world_dioramas.py` written; Route passes first rendered |
| `5004477` | 2026-08-06 | `route-structure.png` re-rendered — the version committed until now |
| `894b677` | 2026-08-06, **after** | `board.glb` replaced by ROTA-BOARD-9X9-SYNC-01 |

The generator's `structure` code path has not changed since `c2ec413`, which is
*before* the artifact was rendered. The file was edited once afterwards, by
MINDFLOW-HOME-VISUAL-04, and only in the `props` and `energy` layers.

## STRUCTURE_DRIFT_ROOT_CAUSE

`public/models/route/board.glb`, replaced at `894b677`.

`build_route` imports it at a fixed scale:

```python
import_glb("structure", "board", "Route_Board", (-1.75, 0.12, 1.05), 0.33, rotation_y=-26)
```

Nothing about that line changed. The model underneath it did. From that
mission's own measurements (`docs/archive/route-board-9x9-sync-01/README.md`):

| | 7×7 (before) | 9×9 (after) |
| --- | --- | --- |
| tiles | 49 | **81** |
| tile centres X/Z | −3 … +3 | **−4 … +4** |
| playable field | 7.00 | **9.00** |
| total footprint | 9.123 | **11.123** |
| weight | 1 817 KB | **2 181 KB** |

A footprint 22 % larger, imported at an unchanged scale, renders 22 % larger.

### Proven, not inferred

Checking `board.glb` out at `5004477` and re-rendering with the **current,
unmodified** generator reproduces the committed pass exactly:

```
committed : docs/archive/home-hero-worlds-3d-01/raw/route/route-structure.png
differing : 0.000%   maxDelta 0
opaque appeared 0   opaque disappeared 0
IDENTICAL
```

One variable, swapped, accounts for the whole difference.

- `COMMITTED_PNG_MATCHES_HISTORICAL_GENERATOR` = **YES** — with the board of its day
- `CURRENT_GENERATOR_CHANGED_AFTER_ARTIFACT` = **NO**, for anything reaching `structure`

## Source of truth: the current generator and asset

Not because a generator is presumed right. Because the archived pass shows a
**known defect**, in ROTA-BOARD-9X9-SYNC-01's own words:

> O grid lógico 9x9 ocupa 9,00 unidades. O campo de tiles ocupava 7,00. […]
> **32 das 81 células não tinham tile embaixo**: o anel externo caía no fosso e no
> trilho da moldura. O Explorador nasce em (8,0), fora do campo — ele
> literalmente começava a rota em cima da moldura.

`board-7x7-before.png` shows exactly that: the Explorer standing on the frame
rail, the Guardian outside the tile field, the trap half on the moulding.
`board-9x9-after.png` has every piece on a tile.

The Home was reproducing the bug the game had already fixed — the same class of
problem as the Shield the previous mission removed, and found the same way.

## Determinism

Rendered twice in a row, all eight passes compared pixel by pixel:

```
route-base        0.0000%   PIXELS IDENTICAL
route-characters  0.0000%   PIXELS IDENTICAL
route-energy      0.0000%   PIXELS IDENTICAL
route-front       0.0000%   PIXELS IDENTICAL
route-props       0.0000%   PIXELS IDENTICAL
route-shadow      0.0000%   PIXELS IDENTICAL
route-structure   0.0000%   PIXELS IDENTICAL
route-terrain     0.0000%   PIXELS IDENTICAL
```

`ROUTE_STRUCTURE_RENDER_DETERMINISTIC = YES`.

With one operational caveat worth writing down: `route-base.png` and
`route-shadow.png` came back with **different SHA-256 but identical pixels** —
the PNG container is not byte-reproducible even when the image is. So a blanket
"re-render everything" will always show a spurious diff on those two files, and
passes that did not need to change are restored from `HEAD` instead of being
re-committed.

## Only `structure` changed

Working tree against `HEAD`, per pass:

```
pass            diff %  maxDelta  appeared   gone
shadow           0.000         0         0      0
base             0.000         0         0      0
terrain          0.000         0         0      0
structure        8.816       255     29044      0
props            0.000         0         0      0
characters       0.000         0         0      0
energy           0.000         0         0      0
front            0.000         0         0      0
```

`props` and `energy` identical to `HEAD` means the Chest from
MINDFLOW-HOME-VISUAL-04 is preserved bit for bit.

## Deltas

**`GENERATOR DELTA = 0`.** No generator file was touched. The generator was
already correct; only the artifact was behind.

| | |
| --- | --- |
| raw PNG | `route-structure.png` |
| runtime WebP | `route-structure.webp`, 23.1 → 27.2 KB; `route-world` total 89.0 → 93.0 KB |
| review sheets | `route-world-composite.png`, `route-world-layers.png`, `hero-asset-weights.json` (route only) |
| other worlds | Circuit, Garden, Panel, Trail — **0 files changed** |

Silhouette guard still passes: margins t177 b224 l155 r296. The larger board
comes closer to the top edge and keeps a real transparent margin.

## Regressions

| check | result |
| --- | --- |
| lint / `tsc --noEmit` / `next build` | 0 / 0 / 0, compiled in 31.2s |
| CORE battery | 15/15, `VALIDATION_CHECK_IS_READ_ONLY`, `CORE_BATTERY_PASSED` |
| DEEP `final-acceptance` | 1080/1080, 270/270, recovery 9/9 |
| Shield | `shield.glb` and its generator still absent |
| Babylon | 7 gameplay GLBs present, 3 lights, one renderer owner |
| Memory Circuit | v2 assets 7/7, `circuit-world` 7/7 |
| world layers | route-world 8, circuit-world 7, garden/panel/trail 7 each — none missing |
| EOL | 0 files outside the LF policy |
| `git diff --check` | exit 0 |

## Follow-up

The Home maquette imports gameplay GLBs at fixed scales, so any future change to
a model's footprint silently changes the Home and nothing notices until someone
re-renders. A cheap guard would be a check that the committed passes still match
what the generator produces — the same comparison used here, run as a validator.
Recorded, not built.
