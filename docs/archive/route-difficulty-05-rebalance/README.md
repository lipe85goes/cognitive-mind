# ROTA-DIFFICULTY-05-REBALANCE

## Outcome

The existing generation knobs produced a technically safe rebalance candidate.
Hard is materially stronger on all three Routes through several structural
axes, while Easy and Medium are deterministic no-ops relative to the immutable
baseline. Human playtest is still the authority for perceived difficulty and
fairness.

Status: `REBALANCE_CANDIDATE_READY_FOR_HUMAN_PLAYTEST`

## Checkpoint and baseline

- Branch: `v06-portal-requires-lights`
- HEAD before: `741db11c2a556c2774c09efb22aa8bc6f9dc6182`
- Worktree before: clean; branch ahead 17
- Push: prohibited and not performed
- Immutable baseline: `docs/archive/route-difficulty-04-baseline/difficulty-baseline.json`
- Baseline SHA-256: `25F028D5D1A044C1C10ED4FE5E06552CB26C644812BA9C7D43CDA7D46AE3DB42`
- Comparable sample: 1,080 geometry maps, 270 UI attempts and 864 policy runs

## Design intent

The change increases Hard through route commitment and structural pressure, not
through a new enemy, timer, hidden penalty or reward dependency. Easy remains
the accessible entry mode, Medium remains the unchanged intermediate mode, and
Hard becomes visibly denser and more demanding without admitting an impossible
map. Hunter, Sentinel, traps, Chest, Pickaxe and Second Chance policies are not
retuned.

## Selected parameters

| Parameter | BEFORE | AFTER | Scope |
| --- | ---: | ---: | --- |
| Hard wall limit | 23..28 | 25..30 | Hard, all Routes |
| Hard base objectives | 5 | 6 | Adds one objective to Hard R1/R2; R3 was already capped at 6 |
| Hard minimum decision ratio | 0.50 | 0.46 | Allows more committed but still bounded routes |
| Hard maximum forced streak | 5 | 6 | Allows modestly longer forced runs; the quality gate remains active |
| Hard R3 objective separation | 3 | 4 | Hard R3 only; Easy/Medium remain at 3 |
| Traps | unchanged | unchanged | All modes |
| Hunter policy | unchanged | unchanged | All modes |
| Sentinel policy | unchanged | unchanged | All modes |
| Chest/rewards | unchanged | unchanged | All modes |

The constraints were changed together because wall density alone would add
quantity without guaranteeing useful pressure. The objective count and R3-only
separation increase exposure, while the bounded decision/forced thresholds let
the generator accept strategically committed layouts without accepting
uncontrolled corridors.

## Route x Difficulty matrix

Values are means over 120 deterministic geometry seeds per combination.
`walls / objective moves / longest forced streak`:

| Route | Difficulty | BEFORE | AFTER | Result |
| ---: | --- | --- | --- | --- |
| 1 | easy | 14.7583 / 19.7583 / 1.1417 | identical | accessible no-op |
| 1 | medium | 18.9250 / 23.1167 / 1.7083 | identical | intermediate no-op |
| 1 | hard | 21.2750 / 24.3000 / 2.2917 | 22.6250 / 25.9333 / 2.6917 | materially harder |
| 2 | easy | 17.5250 / 26.4333 / 1.6250 | identical | accessible no-op |
| 2 | medium | 21.3750 / 27.5000 / 2.3250 | identical | intermediate no-op |
| 2 | hard | 24.0750 / 28.7083 / 2.7083 | 25.6000 / 30.7667 / 3.1167 | materially harder |
| 3 | easy | 18.5417 / 26.4167 / 2.0250 | identical | accessible no-op |
| 3 | medium | 22.2083 / 28.8833 / 2.2333 | identical | intermediate no-op |
| 3 | hard | 25.6333 / 31.2500 / 3.0917 | 27.1500 / 34.6833 / 3.6167 | materially harder |

The existing R2/R3 Easy objective means are a near tie (26.4333 vs 26.4167,
only -0.0166 moves). The report classifies adjacent values within 0.25 moves as
sample noise, as required by the mission's “no gross inversion” rule; walls
must still grow strictly. Medium is monotonic. Hard R2 -> R3 objective
separation grows from 2.5417 to 3.9166 moves.

## Hard structural evidence

| Route | Walls | Objective moves | Junctions | Corridor ratio | Articulation | Forced streak |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | +1.3500 | +1.6333 | -2.3750 | +0.0192 | +1.0166 | +0.4000 |
| 2 | +1.5250 | +2.0584 | -2.5583 | +0.0196 | +0.6750 | +0.4084 |
| 3 | +1.5167 | +3.4333 | -1.9833 | +0.0162 | +0.2334 | +0.5250 |

Every Route gains walls, objective burden, fewer junctions, more corridor and
longer forced runs. R1/R2 also gain substantial articulation; R3 gains a smaller
amount, so its material-hardness gate is supported by three other structural
axes rather than by that metric alone.

## Hunter and Sentinel

There is no Hunter configuration or policy delta. Geometry changes the
encounters, so automated policy signals move in both directions: for the direct
objective policy, Hunter threat share changes R1 0.3508 -> 0.4032, R2 0.2632 ->
0.2339 and R3 0.2365 -> 0.3102. This is diagnostic evidence, not a human
difficulty estimate, and it is why the mission does not claim a uniformly more
aggressive Hunter.

There is no Sentinel delta. A separate runtime equivalence regression covered
690 states with zero divergence and kept the territorial Sentinel role distinct
from the Hunter role. The dynamic suite covered 16,024 Sentinel decisions and
classified all stationary decisions; unexplained stalls remained zero.

## Chest and Pickaxe effect

Chest, Pickaxe and Second Chance behavior is unchanged. Mean Hard Chest detour
changes by +0.1833 / +0.0666 / -0.7500 moves on R1/R2/R3 because the maps are
different. Mean best Pickaxe improvement changes by -0.0167 / -0.4833 / +0.5500
moves. No reward becomes mandatory: all base maps pass solvability before a
wall is opened, and the Pickaxe contract remains explicit and one-use.

Controlled regressions passed Chest open/pause/reset, Pickaxe arbitrary eligible
wall/one-use/same-turn shared topology, and Second Chance Hunter/Sentinel
capture, occupancy and deterministic resolution.

## Same-seed BEFORE / AFTER

| Seed | Scenario | BEFORE hash | AFTER hash | Main observation |
| ---: | --- | --- | --- | --- |
| 12420031 | R2 easy | `e6099b10eaf1c09416c93daed62af44fa892e8ebda335edb0194a7fc954da5d3` | same | all measured values intentionally unchanged |
| 12430048 | R3 easy | `b38bdf8592700e6c0e2e2d4332d81b4adeeca35bbe8cdb25950466a3fb29decd` | same | Chest detour remains 10 |
| 12421027 | R2 medium | `02fd43714f291287bed482a2a1c4c920e0f2b50939cfeea7c5db4dbd82022285` | same | best Pickaxe improvement remains 10 |
| 12432116 | R3 hard | `0c73d3d8c394a1d5ca80bf8eff653cc62e4653268b18bebbbbd658324b31df1e` | `561a1d25e59ccb7cd6dec603b14c7bbe6639da2347f0c81a025511b789d6a33c` | walls 25 -> 27; old forced-streak outlier 10 -> 2 |
| 12432045 | R3 hard | `a13c78a9f3379a02f3431c276d7001115a14ab0c6f33f6e01320622d11ad5042` | `145a55682fd34a90d23248258c14723e545df4a518923eb8263b64cf7d635073` | walls 26 -> 27; old route outlier 43 -> 34 moves |

The launcher asserts these contracts against the immutable BEFORE hashes and
against the current production seam. Re-arming, consecutive generation and a
12-turn runtime trace remain deterministic, while an unarmed normal journey
remains stochastic.

## Automated policy comparison

All Easy and Medium policy outcomes are exact no-ops. On 24 Hard seeds per
Route and policy, outcomes change because the deterministic maps change. Direct
objective wins move 10 -> 9 (R1), 3 -> 3 (R2), and 2 -> 3 (R3); threat-aware
wins move 3 -> 2, 0 -> 1, and 0 -> 0. The mixed direction is intentionally not
used as a balance target. There were zero invalid policy runs and zero map
identity mismatches.

## Solvability and regressions

- Rebalance campaign: 1,080 geometry maps, 270 UI attempts and 864 policy runs;
  every gate green.
- Independent generation regression: 2,340 maps, 25,489 rejected candidates,
  0 fallbacks, 0 generation throws and 0 errors.
- Dynamic solvability: 2,340/2,340 initial states valid and topologically
  solvable; 48,956 internal-wall openings and 0 connectivity regressions.
- Runtime transitions: 72 runs, 3,798 observed states, 0 invalid playing states,
  0 topological softlocks, 36 Pickaxe uses, 36 rejected second uses, 36 Second
  Chance selections and 9/9 clean restarts.
- Occupancy: 0 defender overlaps across generated/runtime coverage; allowed and
  forbidden co-occupancy fixtures observed as expected.
- Star selection: 6/6 controlled fixtures, 4/4 historical seeds and a 540-map
  sweep with 0 throws, count violations or separation violations.
- Route x Difficulty identity: 9/9 combinations, 270/270 UI attempts preserved,
  10/10 transitions and 54/54 UI sequence replays.
- Difficulty persistence: 6/6 progression remounts, 9/9 restarts, 3/3 mid-route
  changes and no cross-journey leakage.
- Diagnostic launcher: 7/7 contracts green.
- Babylon scene: exactly three light instances (Directional, Hemispheric,
  Point); untouched by this mission.
- Lint, TypeScript, production build and `git diff --check`: green.

## Delta classification

### Difficulty parameter delta

`useEscapeMaze.ts`: four existing Hard values changed (wall bounds, base
objective count, decision ratio, forced streak).

### Generation delta

`useEscapeMaze.ts`: one local effective-separation helper applies the existing
R3 separation rule at +1 only for Hard. Selection and both validation gates use
that same source of truth.

### Hunter delta

None.

### Sentinel delta

None.

### Other production delta

The developer launcher adds two representative Hard presets and updates the two
same-seed Hard descriptions. No product navigation or player-facing gameplay
flow changed.

### Test/tooling delta

The comparable campaign, focused contracts, explicit effective-parameter
reporting and BEFORE/AFTER hash assertions are new. Existing standalone
validators now accept an output-directory override so this mission cannot
overwrite protected evidence. Two legacy VM harnesses were taught the approved
`route-random` import seam; no gameplay logic is duplicated.

### Evidence/doc delta

This README, the machine-readable BEFORE/AFTER campaign, isolated regression
artifacts and the seven-game human playtest package are new.

## Advanced hard mechanic candidate

Not opened. Existing knobs were sufficient for a material multi-axis candidate;
no advanced mechanic is justified before human playtest.

## Route termination follow-up

`ROUTE_JOURNEY_TERMINATION_DECISION_REQUIRED` remains open. This mission does
not decide whether the journey is infinite or where it ends.

## Remaining risk

Automated evidence proves determinism, progression, structural pressure and
safety, not human perception. Two deliberately selected Hard witnesses remove
old extreme forced/length outliers while the aggregate Hard population becomes
harder; the seven-game package must establish whether the resulting pressure is
perceptible, fair and strategically legible.
