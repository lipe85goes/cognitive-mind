# MindFlow Production Diagnostic Boundary 02

## Checkpoint

- Branch: `v06-portal-requires-lights`
- Starting HEAD: `b32278bef53554c0ff5ddf6df251088220171bd6`
- Starting branch state: ahead 19, clean worktree
- Scope: production/development boundary only

## Boundary Before

Both `/lab/route-launcher` and `/lab/3d-home` were App Router pages emitted by the
production build. Hiding links from the normal Home did not prevent direct URL
access. Both pages could start real gameplay, and their completion callbacks used
`saveGameResult`, writing diagnostic sessions to the same recent-results storage as
normal product sessions.

The route launcher was also the only UI that armed the seeded Route RNG. It already
cleared that seed when exiting or unmounting. The 3D Home lab remained the current
owner of the retained R3F stack through `GameHome3D` and `WorldSelectorScene`.

## Root Cause

There was no server-side environment boundary around the `/lab/*` route segment and
no explicit distinction between materializing a completed result and persisting it.
Diagnostic pages therefore inherited normal route reachability and normal history
persistence by default.

## Design Selected

`src/app/lab/layout.tsx` is a server component that permits the lab segment only
when `NODE_ENV === "development"`. In every other environment it terminates with
Next.js `notFound()` before diagnostic children can render or hydrate.

`createTransientGameResult` now materializes diagnostic results without storage.
Normal product completion continues through `saveGameResult`, which delegates to
the same materialization helper and then performs the unchanged storage update.

## Why This Design

- Missing navigation links and CSS hiding are not access controls.
- A client-side environment gate would still deliver and hydrate diagnostic UI.
- Middleware or authentication would add unnecessary infrastructure for local tools.
- Conditional source-file removal or Next.js internal manifest manipulation would be
  brittle and build-specific.
- A server parent layout is the smallest stable App Router boundary shared by both
  labs. Explicit transient results isolate storage at the write boundary instead of
  saving and deleting afterward.

## Route Contract

| Environment | Route emitted by build | `/` | `/lab/route-launcher` | `/lab/3d-home` | Diagnostic content in lab response |
| --- | --- | ---: | ---: | ---: | --- |
| Development | Source routes available | 200 | 200 | 200 | Yes, explicitly requested |
| Production | Yes | 200 | 404 | 404 | No |

The App Router still emits both lab routes in production artifacts. The supported
HTTP surface is closed: production requests return the not-found boundary, and the
denied responses do not reference or deliver the diagnostic page content inspected
by the validation harness.

## Storage Contract

| Flow | Result materialized | Recent-results writes |
| --- | --- | ---: |
| Normal product result | Yes | 1 |
| Diagnostic result | Yes | 0 |

The runtime contract test executes the storage module with a controlled
`localStorage`. It confirms that a normal result remains in
`cognitive-mind-recent-results` and that a transient diagnostic result performs no
write.

## Seeded RNG Containment

- `routeRandom()` retains its normal `Math.random()` fallback.
- The route launcher remains the only UI caller of `armRouteRandomSeed`.
- The launcher still clears the seed on explicit exit and component unmount.
- No new RNG singleton or probability change was introduced.
- Existing deterministic and no-bleed witnesses passed.

## R3F Ownership

The retained development ownership chain remains:

`/lab/3d-home` -> `GameHome3D` -> `WorldSelectorScene` -> R3F/Drei.

No R3F renderer, dependency, legacy diorama, or visual metadata was removed in this
mission.

## Validation Summary

- Production boundary source/runtime contract: passed
- Development HTTP access: Home 200, both labs 200
- Production HTTP denial: Home 200, both labs 404, diagnostic content absent
- Diagnostic launcher determinism and no-bleed suite: passed
- Route x Difficulty identity suite: passed
- Difficulty remount persistence suite: passed
- Route visual-state readiness suite: passed
- TypeScript (`tsc --noEmit`): passed
- ESLint: passed
- Next.js production build: passed

The in-app browser controller timed out while navigating the local development
server, although the server completed those requests with HTTP 200. Interactive
browser gestures are therefore not claimed as manually verified; route reachability
is covered by the HTTP harness, and gameplay/RNG contracts are covered by the
existing focused validation suites.

## Evidence

- `boundary-source.json`: source, storage runtime, RNG, R3F, and manifest contracts
- `boundary-development.json`: development HTTP contract
- `boundary-production.json`: production HTTP contract
- `regressions/diagnostic-launcher`: deterministic launcher and no-bleed evidence
- `regressions/route-difficulty`: Route x Difficulty identity evidence
- `regressions/difficulty-persistence`: remount persistence evidence

## Remaining Risks

The lab route entries and their build artifacts still exist because they are regular
App Router file routes. Production HTTP access is denied server-side, but complete
artifact omission would require a broader route/build restructuring. That work was
not selected because it would rely on source mutation or framework internals for a
smaller practical security gain than the stable server boundary.

R3F cleanup, legacy renderer removal, dead assets, old CSS, and historical validator
cleanup remain separate missions.
