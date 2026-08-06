# ROTA-9X9-VALIDATION-01

Validation closeout for the 9x9 Route Strategy foundation. This mission did not change AI, scoring, movement, collisions, rewards, or cognitive rules.

## Scope

- Validate production map generation across Routes 1, 2, and 3.
- Complete real gameplay sessions and observe Guardian pressure.
- Confirm portal locked, collection, portal ready, completion, reward, and local save states.
- Review desktop, tablet, and 390 px composition.
- Evaluate the four structural templates and future trap capacity.

## Structural corrections retained

Two generator defects were proven and corrected in `useEscapeMaze.ts` before this closeout:

1. Route 1 no longer receives the second core template, whose base wall count could never fit the Route 1 wall ceiling and therefore exhausted generation before falling back.
2. Entity and safe-start cells are now cleared in both the wall grid and the wall set. Previously, only the set was cleared, which could desynchronize `grid` and `walls`.

No other gameplay rule was changed.

## Offline generation validation

The production generator was transpiled in memory and exercised with deterministic seeds. The durable command is:

```powershell
node tools\validation\validate-route-9x9.mjs --seeds 200 --template-seeds 20 --write-report docs/archive/route-9x9-validation-01/route-9x9-validation.json --quiet
```

The full execution occurred before the required CJS-to-ESM rename; the algorithm and report stayed unchanged.

| Measure | Result |
| --- | ---: |
| Generated maps | 2,160 |
| Forced-template runs | 360 |
| Rejected candidates before a valid map | 2,261 |
| Fallback maps | 0 |
| Validation errors | 0 |
| Invalid coordinates | 0 |
| Unsolvable objectives | 0 |
| Unique structural templates | 4 |

### Equilibrado progression

| Route | Objective moves mean | Range | Direct portal mean | Reachable cells mean | Junctions mean |
| --- | ---: | ---: | ---: | ---: | ---: |
| Route 1 | 20.04 | 14–26 | 13.81 | 61.54 | 31.13 |
| Route 2 | 30.86 | 17–52 | 15.62 | 58.42 | 24.40 |
| Route 3 | 38.56 | 23–54 | 15.79 | 57.04 | 24.21 |

The objective path progresses clearly from approximately 20 to 31 to 39 moves. The direct portal distance changes little between Routes 2 and 3; Route 3's extra strategic depth currently comes mainly from visiting more separated lights.

## Real gameplay sessions

All three routes were completed through the production UI. Timing excludes reviewer pauses and measures only the automated movement segment where available.

| Route | Mode | Baseline | Actual | Deviation | Active time | Guardian minimum | Pressure turns | Result |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| 1 | Aberto | 21 | 23 | +2 | ~25 s | 2 | 1 | Completed |
| 2 | Aberto | 21 | 23 | +2 | 12.3 s | 2 | 2 | Completed |
| 3 | Aberto | 25 | 25 | 0 | 14.2 s | 3 | 0 | Completed |

- Route 1 collected its lights on turns 5, 7, and 13.
- Route 2 collected its lights on turns 3, 9, 16, and 20.
- Route 3 collected its lights on turns 7, 10, 13, 19, and 22.
- Route 3 collected and consumed the shield once.
- D-pad and keyboard movement passed. `ArrowRight` moved the Explorer from `2,6` to `2,7` in the final live check.
- The result modal appeared for all three routes, and returning Home showed `Treino salvo neste aparelho`.

### Portal state flow

The shared lock behavior was tested by reaching a portal with only one of three lights:

- status remained `playing`;
- HUD remained `Bloqueado`;
- message was `O portal ainda precisa das luzes da rota.`;
- the route did not complete.

Routes 1, 2, and 3 then proved the available/completion path after all required lights were collected.

## Responsive review

| Viewport | Horizontal overflow | Page scroll | Board result |
| --- | --- | ---: | --- |
| 1440×900 | No | 75 px | Readable and dominant; a short vertical scroll remains. |
| 820×1180 | No | 0 | Full board and D-pad visible. |
| 390×844 | No | 0 | Full board visible; D-pad targets measure at least 47.25 px. |

At 390 px, projected board cells are necessarily compact. The complete map remains legible as an overview, while the D-pad is the clearest accessible primary control.

## Template variety

- Route 1 uses one dedicated open template.
- Route 2 uses all three core templates.
- Route 3 uses the two denser core templates.
- Forced coverage exercised every template in every assigned route/mode combination.
- Route 2 Equilibrado distribution: 64 / 63 / 73.
- Route 3 Equilibrado distribution: 99 / 101.

The four layouts are structurally distinct. The random wall pass adds further variation without losing reachability. Route 3 Desafiador reached a maximum decision gap of 32 in edge seeds; it remained solvable but deserves a later fairness review instead of a rule change in this mission.

## Future trap capacity

The 9x9 foundation leaves 51–66 reachable cells on average depending on route and mode, with sufficient branches for future trap spacing. Current maps already reserve distinct cells for obstacles and shields without blocking the objective solver. A future trap pass should:

- keep start-safe and critical objective cells protected;
- cap consecutive forced detours;
- re-run the state solver with the final trap behavior;
- pay special attention to Route 3 Desafiador edge seeds.

No new trap behavior was implemented here.

## Known limitations

1. Changing the mode while Route 2 or Route 3 is selected currently returns progression to Route 1. Because the mission forbids flow changes beyond the two proven generator corrections, live Route 2 and Route 3 sessions used the inherited Aberto mode; Equilibrado is covered offline.
2. The in-app automation client's high-level board click did not reproduce Babylon's raw pointer sequence, so direct cell tapping was not re-proven by this client. D-pad and keyboard passed.
3. At 1440×900, 75 px of vertical page scroll remains.
4. The development overlay recorded repeated Babylon effect compilation diagnostics with `LIGHTCOUNT 11 / MAXLIGHTCOUNT 12`. The scene remained visible and playable, but lighting should be consolidated in a separate visual-runtime mission.

## Evidence

- `route-9x9-validation.json`: complete 2,160-map report.
- `route-live-validation.json`: real session and responsive measurements.
- `route-1-map.png`, `route-2-map.png`, `route-3-map.png`: live route evidence.
- `route-9x9-template-comparison.png`: all four source templates.
- `route-9x9-reachability.png`: reachable-space comparison.
- `route-9x9-guardian-distance.png`: initial Guardian distance comparison.
- `route-9x9-before-after.png`: 7x7 to 9x9 structural comparison.
- `route-9x9-desktop.png`, `route-9x9-tablet.png`, `route-9x9-mobile.png`: responsive captures.

## Technical checks

- `node --check tools/validation/validate-route-9x9.mjs`: passed.
- Post-conversion smoke: 27 maps, 49 rejected candidates, 0 fallback, 0 errors.
- `npm run lint`: passed.
- `npx.cmd tsc --noEmit`: passed.
- `npm run build`: passed with Next.js 16.2.6 Turbopack.
- The repository has no automated `test` script; the durable validator and live browser sessions provide mission-specific coverage.

