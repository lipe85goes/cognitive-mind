# ROTA-VISUAL-STATE-06 — Legacy path audit

## Reproduction

The diagnostic launcher was opened on a cold local origin with Route 3, Hard,
seed `12432045`.

| Time after Launch | State | Visible result before the fix |
| ---: | --- | --- |
| 0.62 s | Canvas mounted; Babylon modules still preparing | Empty world surface |
| 8.10 s | Essential GLBs pending; initial `renderBoard()` complete | Cream/washed procedural board |
| 10.55 s | Board/wall/prop imports settling | Mixed interim asset state |
| 10.86 s | `controller.ready`; final frame complete | Approved wood/green/gold board |

The trigger is the first Babylon mount while essential assets are `pending`.
Route number, cyclic stage, difficulty and seed do not enter the Babylon visual
state. Journey continuation reuses the already-loaded controller, which explains
why the next Route showed only the approved configuration.

## Root cause and contract

`routeBabylonScene.ts` intentionally renders procedural emergency assets before
starting its asynchronous imports. `RouteBabylonBoard.tsx` awaited
`controller.ready` for the entry callback but exposed the canvas immediately.
The source comment already defined the ready frame as the first frame that may
be revealed; the React owner did not enforce that boundary.

After the fix, the canvas retains its dimensions and render loop with
`visibility: hidden` until `controller.ready` resolves. A stable loading surface
is visible during that interval. If an asset fails, its existing procedural
fallback still participates in the final ready frame and is then revealed.

A second cold-origin run observed the contract directly:

| Time after Launch | `data-visual-state` | Canvas | Loader | Reset |
| ---: | --- | --- | --- | --- |
| 0.50 s | `loading` | hidden | present | absent |
| 11.74 s | `ready` | visible | absent | present |

No procedural frame was exposed in the corrected run.

## Audit conclusions

- Active renderer: Babylon `RouteBabylonBoard` / `routeBabylonScene`.
- Retained legacy renderer: React Three Fiber `RouteBoardScene`, unreachable
  behind the current constant production branch; cleanup is deferred.
- Lighting: one Directional, one Hemispheric and one Point light; total 3.
- Materials: controller-local procedural materials, imported GLB materials tuned
  on import, controller-local Sentinel/portal caches disposed with the scene.
- Lifecycle: ResizeObserver, window/canvas listeners, render loop, materials,
  scene and engine all have explicit teardown; no leak was demonstrated.
- Classification: `LEGACY_VISUAL_PATH_ACTIVE` — the procedural emergency path
  was active while assets were pending, not only after a load failure.

Machine-readable checks are written to `visual-state-contract.json` by:

```text
node tools/validation/route-visual-state-tests.mjs
```
