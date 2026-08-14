# ROTA-DYNAMIC-SOLVABILITY-02

Final status: `DYNAMIC_SOLVABILITY_VERIFIED`

## Diagnosis

The generated map already had a strong static contract: all lights, the Chest
and the portal are reachable; the objective route has escape geometry; route
cells share the required graph blocks; and route-quality gates reject maps with
insufficient choices, junctions or safe starts.

Runtime had one asymmetric occupancy defect. The Sentinel settled after the
Hunter and refused a conflicting destination, but the Hunter did not treat the
Sentinel's current cell as occupied. This produced the previously measured
Hunter/Sentinel co-occupancy. The fix passes that one cell in the existing
`blockedForDefenders` set. No movement policy, RNG, speed or difficulty value
changed.

## Static solvability contract

A generated base map is valid only when:

- every logical entity is inside the 9x9 board and outside a wall;
- player, Hunter, Sentinel spawn, portal, lights, traps and Chest obey their
  generation-time uniqueness rules;
- all unfinished objectives are reachable from the Explorer on the base graph;
- the objective route, alternative-route and escape-width gates succeed;
- portal defence has useful access and cannot permanently seal the portal;
- the Pickaxe is not considered by generation and cannot rescue an invalid map.

The official campaign validated 2,880 maps: 2,340 primary seeded maps plus 540
template/fidelity cases. It observed 0 fallbacks, 0 generation throws and 0
errors.

## Dynamic solvability contract

`inspectDynamicMazeState` is the pure source of truth for runtime validity and
topological solvability. It derives the effective graph from the base walls and
the single optional `brokenWall`; React and Babylon are not inputs.

A playing state is valid only when:

- all mobile entities are in bounds and on effective walkable cells;
- Explorer, Hunter and Sentinel are pairwise distinct;
- neither defender occupies the portal or an armed trap;
- collected lights and armed traps belong to the generated map;
- Chest, reward, spent charge and broken wall form a coherent state machine;
- every unfinished light, an unopened Chest and the portal remain reachable.

Terminal loss may contain Explorer/defender co-occupancy because that cell is
the capture evidence. Mobile defenders are threats, not permanent walls, so
`topologicallySolvable` intentionally does not claim an adversarial win.
Pre-Chest adversarial analysis remains in the exact solver, whose reference and
packed successors were updated to the same occupancy contract.

## Occupancy contract

| Pair or cell | Playing-state contract |
| --- | --- |
| Explorer / Hunter | Forbidden; contact is capture |
| Explorer / Sentinel | Forbidden; contact is capture |
| Hunter / Sentinel | Forbidden; Hunter excludes current Sentinel, Sentinel settles after Hunter |
| Explorer / unopened Chest | Transition immediately opens Chest and pauses |
| Explorer / opened Chest | Allowed |
| Hunter or Sentinel / Chest | Allowed; Chest is walkable |
| Explorer / inactive portal | Allowed |
| Explorer / active portal | Transition immediately wins |
| Hunter or Sentinel / portal | Forbidden |
| Any mobile entity / standing wall | Forbidden |
| Any mobile entity / Pickaxe-opened wall cell | Allowed |
| Defender / armed trap | Forbidden |
| Explorer / armed trap | Allowed |

## Sentinel stall

The apparent stall was reproduced with complete logical state. Across 16,517
Sentinel turns, 15,639 policy decisions stayed put:

- 1,133 were already at the committed access target;
- 14,154 were valid home-guard states adjacent to the portal;
- 352 had no legal neighbour with a strictly better target distance;
- 10 additional stays were occupancy settlement after the Sentinel selected the
  Hunter's already-settled destination;
- 0 stationary decisions had an unexplained strictly improving legal move.

The longest trace stayed for 120 turns at `1,8` with `target=null` and
`commitLeft=0`, while the Explorer stayed far away at `8,0`. This is the
approved territorial home guard, not pathfinding, timing or render failure.
The occupancy defect could visually hide one defender and is fixed. No visual
workaround, teleport or reset was added.

## Pickaxe solvability

The suite opened all 47,768 internal walls across the 2,340 primary maps.
Every opening:

- removed exactly one standing wall;
- preserved or increased the reachable-cell set;
- kept every unfinished objective reachable;
- was observed by Explorer, Hunter, Sentinel and portal-zone computation through
  the same effective wall set;
- preserved one-use semantics.

The real-hook campaign recorded 36 Pickaxe selections, 36 wall breaks and 36
immediately rejected second-use attempts.

## Runtime transition evidence

The real `useEscapeMaze` hook was driven for 72 seeded runs and 3,349 observed
states. Coverage includes initial state, movement, defender response, Chest
pause, both reward choices, wall break, continued play, Second Chance, win,
loss and restart.

Results:

- 0 invalid playing states;
- 0 topological softlocks;
- 72 Chest pauses;
- 36 Pickaxe and 36 Second Chance selections;
- 25 wins and 18 losses;
- 9/9 clean restarts;
- 0 defender co-occupancies;
- 614 Hunter entries into the Sentinel cell prevented by the new contract.

## Exact solver regression

Reference and packed implementations remained equivalent:

- encoding: 36,009 states, 0 round-trip issues, merges or splits;
- successors: 6,480 pairs, 0 mismatches;
- attractors: 5,267 states, 0 existential or guaranteed mismatches.

The full 12-suspect reference-runner regression was attempted twice with the
unchanged 250,000-state budget and reached 10- and 20-minute process limits.
Its soundness phase completed 32,880 observed runtime transitions with 0 outside
the enumerated support; three suspect witnesses completed before the longer
limit. The remaining classifications stay resource-bound, as in the versioned
pre-Chest baseline. No budget, TTL or correctness gate was reduced to manufacture
a result.

## Difficulty / rebalance follow-up

No balance value changed. The legacy scripted-player closeout remains useful as
a signal, not a human difficulty measurement:

- route 2 / hard: 0 wins, 19 timeouts in 20 runs;
- route 3 / easy: 1 win, 15 timeouts in 20 runs;
- route 3 / hard: 3 wins, 16 timeouts in 20 runs.

A later balance mission should measure human completion rate, turns to all
lights, defender influence, stationary home-guard duration and outcomes by
route/difficulty. Relevant systems are `src/engine/difficulty.ts`,
`chooseGuardianMove`, `decideSentinelMove`, route stage tuning and the
gameplay analytics fields. Solver correctness must remain independent from any
future tuning.

## Evidence and commands

- `dynamic-solvability-02-tests.json`: state, occupancy, Pickaxe and real-hook campaign.
- `route-generation-2880.json`: official generation campaign.
- `regressions/`: Chest, Second Chance, Sentinel and exact solver reports.

Commands:

```text
node tools/validation/dynamic-solvability-02.mjs
node tools/validation/validate-route-9x9.mjs --seeds 260 --template-seeds 20 --quiet
node tools/validation/dynamic-solver-equivalence-run.mjs
node tools/validation/chest-runtime-gameplay.mjs
node tools/validation/second-chance-controlled-tests.mjs
node tools/validation/sentinel-runtime-closeout.mjs
node tools/validation/sentinel-runtime-equivalence.mjs
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd run build
git diff --check
```
