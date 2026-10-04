# Validation tooling — how to run it

Every validator here answers a question about the repository. Asking a question
does not change the answer, so **a normal run writes nothing**. If what a
validator computes differs from the recorded evidence, it says so and fails; it
never quietly replaces the record.

## The two modes

```bash
node tools/validation/<validator>.mjs
```

`--check` is the default and needs no flag. The validator computes its verdict,
compares it against the evidence in `docs/archive/…`, prints a field-level diff
if they disagree, and writes nothing at all — not even a directory.

```bash
node tools/validation/<validator>.mjs --update
```

Rewrites the evidence, and reports exactly which artifacts changed. Use it when
you have read the diff and the new verdict is the correct one. An `--update`
that decides nothing new writes nothing (`nothing to rewrite`), so it is safe to
run and will not churn the worktree.

Validators that never wrote evidence take no flags — nothing to opt into.

## Exit codes

| code | meaning |
| ---- | ------- |
| 0 | checks passed and evidence matches |
| 1 | the validation itself failed — a contract is broken |
| 2 | evidence divergence in `--check` — the verdict moved |
| 3 | usage error |

Exit 1 and exit 2 mean different things. Exit 1 is "the code is wrong". Exit 2
is "the code changed and the record has not caught up" — read the diff before
deciding which.

## Command sets

**CORE** — the set a normal working session runs. All of it, plus the proof that
running it changed nothing, is one command (about 10 minutes):

```bash
node tools/validation/validation-hygiene-tests.mjs
```

Add `--fast` to skip the four slowest validators (about 1 minute). It proves
immutability exactly the same way, but it does not compare or write evidence: a
subset is a different verdict, not a weaker baseline. Use it while iterating; use
the full run before committing.

**DEEP** — generation acceptance over 1080 seeded maps and 270 continuous
streams, plus the deterministic-recovery proof (about 4 minutes):

```bash
node tools/validation/final-acceptance.mjs
```

**ROUTE PROJECTION** — `data-cell-centers` must describe the camera the board
is drawn with now. Neither writes evidence nor takes `--check`/`--update`:

```bash
node tools/validation/route-projection-tests.mjs           # real Babylon, no browser, ~3 s
node tools/validation/route-projection-browser-probe.mjs   # Playwright, needs a running app
```

The first runs the real controller on `@babylonjs/core` with a `NullEngine` and
also proves it would catch the regression (a counterfactual build without the
fix must fail). The second drives the app through start-after-resize, a blocked
step, Detalhes, Centralizar and a viewport resize; with `--entry launcher`
against `next dev` it also compares the board's pixels with a `--baseline` run.

**ROUTE BOARD CHUNK** — the Rota's board chunk failing must take the entry's
onEntryError → retry path, not the page's error screen. Neither writes evidence:

```bash
node tools/validation/route-board-loader-tests.mjs           # real RouteStrategyGame, no browser, <1 s
node tools/validation/route-board-chunk-browser-probe.mjs    # Playwright, needs `next build && next start -p 3100`
```

The first runs the real component under a virtual chunk gate; `--rev=c34b274`
(the `next/dynamic` board) must fail it. The second blocks, holds and releases
the board's chunk in the production build: normal entry, failure + retry,
leaving while it loads, retry while it is still in flight.

**GAME CONTINUATION** — "play again" resumes through `GameResult.continuation`,
a typed value only the owning game opens; page.tsx and GameScreen carry it
unread. Writes nothing:

```bash
node tools/validation/game-continuation-contract-tests.mjs   # real page.tsx → GameScreen → Rota → useEscapeMaze, ~12 s
```

It plays real Routes with the real hook and feeds each result through the real
shell, stage by stage: Route N → N + 1 on every mode, won and lost, intro
skipped only when continuing, fresh entries from Home, every other world
untouched, entry retries, storage round trip, results saved before the
contract, malformed continuations, and the import graph. `--rev=415cead` (the
`details`-based protocol) must fail every `[contract]` check and hold every
`[preserved]` one. Route-to-Route hops are held for Routes 1 and 2; where Route
3 leads is its `[terminal]` check (C5).

**JOURNEY OWNERSHIP** — the result's continuation is the only way to the next
Route; nothing inside a session moves it. Neither writes evidence:

```bash
node tools/validation/route-journey-ownership-tests.mjs           # real hook, Rota and launcher, no browser, ~30 s
node tools/validation/route-journey-ownership-browser-probe.mjs   # Playwright: product on `next start -p 3100`, lab on `next dev -p 3000`
```

The first calls every function the hook hands the game, in every state, and
checks the Route never moves; renders the real Rota won and lost; reads the
product's sources for a second producer of the next Route; drives the real
launcher through "Próxima rota"; and holds Route N → N + 1 (won and lost),
fresh entry on Route 1 and retries on the same Route. `--rev=d258077`
(`continueJourney` still there) must fail every `[ownership]` check and hold
every `[preserved]` one. The probe watches every DOM mutation batch from Home →
Route 1 → result → Route 2 → result → Route 3, and through the lab.

**JOURNEY END** — Rota Estratégica v1 has three Routes: Route 1 and 2 lead to
N + 1 won or lost, Route 3 lost leads to Route 3 again, Route 3 won completes
the journey (no continuation, `journeyCompleted`). No Route 4 in the product.
Neither writes evidence:

```bash
node tools/validation/route-journey-terminal-tests.mjs           # real hook, reader, result screen, storage, launcher, ~40 s
node tools/validation/route-journey-terminal-browser-probe.mjs   # Playwright, needs `next build && next start -p 3100`
```

The first plays every Route on every mode to both ends, reads every
continuation the Rota could be handed (Route 4, 999, 0, NaN, …), presses every
button of the real result screen, round-trips storage with legacy Route 4
results, drives the launcher's form and "Próxima/Repetir rota", and reads the
shell for any knowledge of the end. `--rev=7b740e4` (Route 3 → Route 4) must
fail every `[terminal]` check and hold every `[preserved]` one. The probe goes
Home → Route 1 → Route 2 → Route 3 lost → "Tentar Rota 3 novamente" → Route 3 …
won → "Jornada concluída" → "Voltar aos mundos" → Home → the Rota again (Route
1). `--mode easy|medium|hard`. Under software WebGL the board can outlast the
entry's 12 s watchdog; the probe then presses the product's "Tentar novamente"
(same session) and reports how often.

**EVIDENCE UPDATE** — after a deliberate change, once you have read the diffs:

```bash
node tools/validation/<validator>.mjs --update
```

## Verdict data vs run metadata

Evidence separates *what the validator concluded* from *when and how the run
happened*. Timestamps, wall-clock timings and machine details are declared as
run metadata: they are excluded from the comparison and carried over unchanged
when the verdict has not moved. Everything else is verdict data, and a
difference there is a real signal that fails the check.

## Line endings

The repository is checked out with `core.autocrlf=true` and has no
`.gitattributes`, so a file git wrote is CRLF while a file a tool wrote is LF.
Two consequences the tooling handles explicitly:

- Writes reproduce the existing file's line endings, so an unchanged verdict can
  never show up as a diff.
- `route-module-loader.mjs` normalises every source it reads, overrides and
  transform output included — one place (`normalizeSource`).
  `instrumented-generator.mjs` re-exports it with `productionSource()` (the
  hook's text) and `routeSource(file)` (any module). **Any caller that builds a
  textual anchor must take the source from there**, never from its own
  `readFileSync` — an anchor with the wrong line endings matches nothing, and a
  `replace` that matches nothing turns a counterfactual harness into a silent
  no-op.

## The Rota's module graph (ROUTE-C0)

Rota validators do not read or compile `useEscapeMaze.ts` themselves. They load
the Rota through `route-module-loader.mjs`, which treats it as what it will
become — a small graph of modules — and is read-only:

- **source tree** (`openSourceTree`): the working tree, or every file at
  `rev` (`git show <rev>:<path>`), plus `sourceOverrides` that replace or add
  single modules in memory. `resolve` handles `./`, `../` and `@/` (tsconfig
  `paths`); `closure(entry)` is the run-time import graph; `locate(anchor)` is
  the one module holding a textual anchor; `declaring(name)` is the one Rota
  module declaring a top-level binding.
- **module graph** (`createModuleGraph`): transpiles TS/TSX, evaluates each
  module once in one shared realm (one instance per file, whoever imports it,
  by alias or relative path; cycles behave as in Node), and answers anything
  that is not a repository module only from explicit `mocks` — otherwise it
  fails naming the importer and the specifier. `transforms` are per module
  (`{ file: fn }`) or graph-wide (`fn(source, file)`); `anchoredEdits(tree,
  [[anchor, replacement]])` applies each edit where its anchor lives.
- **Rota profile** (`loadRouteModules`): seeded `Math.random`, inert (or a
  caller's) React, silenced `game-sounds`, `scoring` stubbed to 0 as every Rota
  harness always had it; difficulty, route-random and continuation are real and
  come from the same tree as the hook. `surface: [names]` finds each private
  binding in whichever Rota module declares it — or in the RNG seam
  (`src/engine/route-random.ts`), which declares `randomItem` since ROUTE-C2.

`instrumented-generator.mjs` builds on it (diagnostics placed by the parser in
the module that declares `isStructurallyValid` / `isValidMap`), and
`route-runtime-harness.mjs` takes `rev`, `sourceOverrides` and `transforms`.
`--rev` therefore means one coherent revision: there is no "old hook over
today's engine" unless an override says so explicitly. Aim a counterfactual at
a declaration, not a file:

```js
const capFile = routeModuleDeclaring("MAX_GENERATION_ATTEMPTS");
loadInstrumented({ transforms: { [capFile]: (src) => src.replace(capLine, SHORT) } });
```

**ROUTE MODULE LOADER** — neither writes anything:

```bash
node tools/validation/route-module-loader-tests.mjs        # ~12 s
node tools/validation/route-validation-coupling-gate.mjs   # <1 s; --rev=5d541b2 must fail every [decoupling] check
```

The first tests resolution, transpilation, identity (`route-random` evaluated
once although several modules of the graph import it — `difficulty.ts`,
`route-generation.ts` and, since ROUTE-C3, `route-defenders.ts`; the hook no
longer does), mocks, worktree vs
`--rev`, overrides, single-module transforms, errors, cycles and line endings,
then splits `useEscapeMaze.ts` in memory (grid/config into `route-config.ts`, a
generation helper into `route-pick.ts`) and requires the instrumented
generator, the runtime harness and a declaration-aimed counterfactual to give
the same maps and the same games; the loader the validators had at 5d541b2 must
fail on that split. Since ROUTE-C1 production is split for real, so the
synthetic split is cut from the last one-file hook (`rev: 4027baa` plus the
split as `sourceOverrides`) and X6 requires the real split to generate, explain
and play exactly what the one-file Rota and its synthetic split do. The gate scans every validator for couplings to the Rota's
file layout (hook path, other Rota module paths, hand-written resolvers,
private TypeScript compilation, the old `hookSource` seam). Each remaining one
is declared in its `ALLOWED` table with a reason:

| reason | validators | why they still name Rota files |
| --- | --- | --- |
| STRUCTURAL_ASSERTION | game-continuation-contract, route-journey-ownership, route-journey-terminal, route-config-extraction, route-generation-extraction, route-defenders-extraction, route-invariants-extraction, route-state-reducer, route-domain-events, diagnostic-launcher, production-diagnostic-boundary, cross-eol | the check is about where code lives (I1/O3/T11, C1's, C2's, C3's, C4's, C5's and C6's static gates, the seed seam's own code, CRLF of the hook's text); their Rota runs through the graph |
| UI_STAGE | route-board-loader | compiles the Rota component under a chunk gate with stage stubs |
| REPORT_LABEL | breakable-wall-feasibility, dynamic-solvability-finalize | a path inside report text |
| LEGACY_LEDGER | chest-acceptance | ROTA-CHEST-REWARDS-01 ledger; rewrites its archive when run |
| LEGACY_BROKEN | route-lab (`loadLab`), autopsy-generation, final-rejection-autopsy, star-capacity-proof, star-selection-proof, render-route-9x9-evidence | already failed to load at 5d541b2 and write archived evidence when run; kept as their missions' record |

A new validator that names the hook or resolves a Rota import by hand fails the
gate until it uses the loader or is declared with a reason; a declaration whose
coupling is gone must leave the table. `route-config.ts` counts as a Rota module
file for the gate (ROUTE-C1), and so do `route-generation.ts` and
`route-geometry.ts` (ROUTE-C2), `route-defenders.ts` (ROUTE-C3),
`route-invariants.ts` (ROUTE-C4), `route-state.ts` (ROUTE-C5) and `route-events.ts` (ROUTE-C6).
`route-module-loader-tests` no longer names the hook since ROUTE-C3 (L10 reads
`route-random`'s importers off the graph), so its `hook-path` declaration left
the table.

`dynamic-solvability-campaign-lib`'s campaign identity used to hash the hook
and `difficulty.ts` by name (a PROVENANCE declaration). Once generation left
the hook that hash stopped covering the code that makes every case's map, so a
`--resume` cache could have outlived a change to it. Since ROUTE-C2 it hashes
the solver's files plus the hook's run-time closure from the graph
(`openSourceTree().closure()`), names no Rota file, and has left the table. The
identities recorded in `docs/archive/route-dynamic-solvability-01` were already
stale before C2 (any edit to the hook changed them); only cache keys move.

**ROUTE CONFIG (ROUTE-C1)** — the grid and static configuration live in
`src/games/escape-maze/route-config.ts`; the hook imports them. Writes nothing:

```bash
node tools/validation/route-config-extraction-tests.mjs              # ~45 s
node tools/validation/route-config-extraction-tests.mjs --rev=4027baa  # must fail every [structure] check, hold the rest
```

`[structure]` is the static gate: the moved set is declared in route-config.ts
and nowhere else, the hook declares none of it and imports exactly what
route-config exports, route-config imports types only, and no template row or
stage copy is left in the hook. `[config]` pins every value literally (grid,
budget, start, exits, guardian seats, template hashes, stage mapping and copy,
wall limits, light/trap/separation counts, minimum path, quality, play brief).
`[equivalence]` loads the working tree and the one-file Rota (4027baa) through
the loader and compares every moved binding, the helpers over their domain, 360
generated maps field by field (Sentinel setup and RNG draws included) and 18
Routes played by the real hook. `[identity]` checks the tables are still
shared, unfrozen and unmutated, as before. Validators never needed the new
file's name: surfaces, `declaring()` and `anchoredEdits` already found each
binding where it is declared. The one textual anchor on a moved declaration —
`final-acceptance`'s random-phase cap — now matches `export const` too, and
records the declaration without the modifier, so its evidence is unchanged.

**ROUTE GENERATION (ROUTE-C2)** — generation and certification live in
`src/games/escape-maze/route-generation.ts`, the board's graph primitives
(keys, neighbours, BFS distances and paths, grid ↔ walls) in
`src/games/escape-maze/route-geometry.ts`, and `randomItem` beside the stream
in `src/engine/route-random.ts`. The hook asks `generateMaze(difficulty,
routeNumber)` for a certified map and re-exports `generateMaze`, `posKey`,
`positionsEqual` and `MazeMap`. Writes nothing:

```bash
node tools/validation/route-generation-extraction-tests.mjs              # ~4 min
node tools/validation/route-generation-extraction-tests.mjs --rev=65932cf  # must fail every [structure] check, hold the rest
```

`[structure]` is the static gate: each moved binding is declared in its new
module and nowhere else in `src/`; the hook declares none of it (not even as
text) and imports exactly `generateMaze` + `MazeMap` from route-generation,
which exports exactly those; route-geometry exports exactly what the Rota walks
with; `randomItem` is the seam's, imported by generation and the Hunter (the
hook at C2, `route-defenders.ts` since C3 — whichever declares
`chooseGuardianMove`); the new modules import only config, geometry, `difficulty`,
`route-random` and types — no React, hook, UI, Babylon, sounds or scoring —
and reach no cycle back into the hook; the instrumented generator and every
validator anchor on the generator land in route-generation.ts. `[preserved]`:
every moved declaration (comments included) and every remaining hook statement
is 65932cf's text, the seam is 65932cf's plus `randomItem`, the turn is still
in the hook (the defenders and the dynamic invariants were too, until C3 and C4
moved them; route-defenders-extraction-tests and
route-invariants-extraction-tests hold those moves), the hook's public
surface (types and values) and its product consumers are unchanged, and the
instrumented loader still reports 18 structural reasons and 23 final gates.
`[equivalence]` against 65932cf through the loader: graph primitives over 300
random boards; 1080 maps seeded as final-acceptance's FASE 1, field by field,
with the objective route, escape width, dynamic invariants and the next three
draws of the shared stream; 270 maps on continuous streams and armed
diagnostic seeds; every attempt of 108 replayed generations; recovery and the
throw forced by an in-memory budget edit; 54 real Routes played by the real
hook, step by step, through chest, pickaxe, restart, mode change and the next
Route.

Validators that had to follow the code: `escape-generation-close` patched the
hook's text only (`transform:`), and its two counterfactual edits now go
through `anchoredEdits`, which applies each where its anchor lives and requires
it once in the graph; `cross-eol-tests` looks for each instrumentation anchor
in the module that declares its function, and hands CRLF to every module
(`transforms:`) instead of the hook alone, which would no longer reach the
instrumented one. `route-config-extraction-tests` S3 now requires the Rota's
modules together (not the hook alone) to import exactly what route-config
exports, and `MazeMap` left its kept-in-hook list; `game-continuation-contract`
I1 pins the two new runtime edges.

**ROUTE DEFENDERS (ROUTE-C3)** — how the Hunter and the Sentinel decide lives in
`src/games/escape-maze/route-defenders.ts`: `PORTAL_ZONE_RADIUS`,
`SENTINEL_LEASH`, `SENTINEL_THREAT_HORIZON`, `SENTINEL_COMMIT_TURNS`,
`EMPTY_BLOCKED`, `PortalDefenceZone`, `SentinelState`,
`computePortalDefenceZone`, `createSentinelState`, `decideSentinelMove` and
`chooseGuardianMove`, moved verbatim and in order (only `export` added to
`SENTINEL_COMMIT_TURNS` and `chooseGuardianMove`, which the hook imports). The
turn — `runDefenderPhase`, capture, Second Chance, messages, stats — stays in
the hook, text unchanged (the dynamic invariants did too, until C4). The hook
re-exports `computePortalDefenceZone`, `createSentinelState`,
`decideSentinelMove`, `PortalDefenceZone` and `SentinelState` as before, and
still not `chooseGuardianMove`. Writes nothing:

```bash
node tools/validation/route-defenders-extraction-tests.mjs              # ~4 min
node tools/validation/route-defenders-extraction-tests.mjs --rev=de8c94e  # must fail every [structure] check, hold the rest
```

`[structure]` is the static gate: every moved binding is declared in
route-defenders.ts and nowhere else in `src/`; the hook declares none of it
(not even as text), imports exactly what route-defenders exports and no longer
touches the RNG itself (`routeRandom`, `randomItem`, `getPredatorNextPosition`
are gone from it); route-defenders imports only config, geometry,
`difficulty`, `route-random` and types — `MazeMap` from route-generation as a
type only — never React, the hook, UI, Babylon or sounds; nothing below it
(config, geometry, generation, the seam, difficulty) reaches it and the hook's
run-time graph is acyclic; the C0 surface, the instrumented generator, the
runtime harness, `routeModuleDeclaring` and textual anchors (cross-eol's
`function chooseGuardianMove(`) all resolve to route-defenders.ts.
`[preserved]`: the moved block is de8c94e's text byte for byte; the hook's
remaining statements are exactly de8c94e's minus the moved ones; the whole
`useEscapeMaze` body (runDefenderPhase, Hunter before Sentinel) is unchanged;
the public surface (parser and run time, re-exports identical functions) and
every other Rota module are untouched. `[equivalence]` against de8c94e
through the loader: 10 800 Sentinel decisions over generated maps (zones with
one wall opened, posts, leash, horizon, commitment, re-aim, traps that cut the
held door, other commit lengths) and the starving-zone throw; the lab contract
c3 walk, FEINT and ROLE; 3 780 Hunter cases covering every branch (easy's 0.45
random branch and greedy fallback, medium/hard fallbacks, ties, portal / trap /
Sentinel blocking the preferred move, no alternative, default argument) with
draws consumed and the next three draws after each; 27 chains of turns with
generation before and after (seeded and armed); the trap contract; Second
Chance through the real hook on an armed per-step stream, so each capture is
attributed (Hunter, Sentinel, the Explorer's own step), with rollback, charge
and overlap checked; 144 real Routes (Routes 1/2/3 × every mode × eight
policies), step by step, plus restart, mode change, the next Route and the
stream after.

Validators that had to follow the code: none of the surfaces did — every
validator that reaches the defenders (`sentinel-runtime-equivalence`,
`trap-strategy-tests`, `dynamic-solvability-02`, `adversarial-runtime-replay`,
`chest-*`, `second-chance-*`, the dynamic solver…) goes through
`loadInstrumented` / `loadRouteRuntime`, whose surface finds the bindings
wherever they are declared. What pinned the old layout:
`route-generation-extraction-tests` S5 (the Hunter's module is now whichever declares
`chooseGuardianMove`) and P3 (the defenders left its kept-in-hook list);
`route-module-loader-tests` L10 (route-random's importers come from the graph);
`game-continuation-contract` I1 (the hook's runtime imports lose
`route-random` and gain `route-defenders`, whose own edges are pinned);
`cross-eol-tests` only had a comment to update.

**ROUTE INVARIANTS (ROUTE-C4)** — whether a logical state of the Rota is
possible, and whether every unfinished objective can still be reached on the
current walls, lives in `src/games/escape-maze/route-invariants.ts`:
`inspectDynamicMazeState`, `DynamicMazeStateSnapshot`,
`DynamicSolvabilityInspection`, and the state's vocabulary the snapshot is
written in, `GameStatus` and `ChestReward` (route-invariants may not import the
hook to name them, and nothing else needed them, so no separate types module).
Moved verbatim: the 26 issue codes, their push order, the effective walls (a
new set: base walls minus a valid broken wall), the Explorer/defender overlap
flagged only while `playing`, the objectives (uncollected lights, portal,
closed Chest), and "solvable" stays topological — mobile defenders are not
walls; the adversarial question is the exact dynamic solver's. The hook still
decides when to ask (`dynamicSolvability`, every render, same eleven-field
snapshot; `useEscapeMaze`'s text unchanged), imports the five names in one
declaration and re-exports them, so `RouteStrategyGame` (`ChestReward`) and
`RouteBabylonBoard` (`GameStatus`) still import from the hook, unchanged.
route-invariants imports `ROWS`/`COLS`, geometry and types only — never React,
the hook, the defenders, the RNG, UI, Babylon, sounds, scoring or storage.
Writes nothing:

```bash
node tools/validation/route-invariants-extraction-tests.mjs              # ~2 min
node tools/validation/route-invariants-extraction-tests.mjs --rev=940c856  # must fail every [structure] check, hold the rest
```

`[structure]` is the static gate: the five names are declared in
route-invariants.ts and nowhere else in the Rota (the Seed Garden's own
`GameStatus` is a homonym with another body, reported, not a copy); the hook
declares none of it (not even as text), imports exactly what route-invariants
exports in one declaration, re-exports the function as a value and the four
shapes as types, calls the contract once, and no longer imports
`getReachableDistances`; no issue code is spelled in any source module but
route-invariants.ts; route-invariants reaches only route-config and
route-geometry at run time, nothing below it reaches or names it, only the hook
imports it, and the hook's run-time graph is acyclic; the C0 surface, the
instrumented generator, the runtime harness (what `dynamic-solvability-02` and
`adversarial-runtime-replay` load), `routeModuleDeclaring` and textual anchors
all resolve it to route-invariants.ts. `[preserved]`: GameStatus and the block
from ChestReward to the end of inspectDynamicMazeState are 940c856's text byte
for byte; the hook's remaining statements are exactly 940c856's minus the moved
ones; the whole `useEscapeMaze` body — and in it the `dynamicSolvability` call
with its eleven fields — is unchanged; the public surface (parser and run time,
the re-export is the same function) and every other Rota module are untouched;
the issue catalogue read off each tree's code (22 push sites, the PLAYER /
HUNTER / SENTINEL loop, 26 codes) is the baseline's. `[equivalence]` against
940c856 through the loader: ~890 hand-built adversarial cases on one map per
stage × mode, each with its whole written issue SEQUENCE (every one of the 26
codes produced; each mobile out of the board and on a wall, defenders together,
the Explorer on each defender under setup/playing/won/lost, defenders on the
portal and on armed traps, unknown lights and traps, every Chest / reward /
Pickaxe combination, broken walls that are no wall, the opened wall walkable by
all, sealed lights/portal/Chest, a chest-less map, the Explorer boxed in by both
defenders still solvable); 7 560 random states (arrays, Sets and one-shot
generators; every code reached; every issue list in push order); effective
walls for every wall of 54 maps opened; mutation safety (frozen inputs, map and
positions unchanged, each key iterable read once, two calls equal and unshared);
and 171 real sessions played by the real hook — every mode, Routes 1/2/3, nine
policies through traps, Chest pause (and a move tried during it), Pickaxe,
Second Chance, win, loss, setup, restart, mode change and the next Route — with
`game.dynamicSolvability` (valid, topologicallySolvable, solvable, issues,
effective walls in order, unreachable objectives) compared at every render and
recomputed from the very state that render exposes.

Validators that had to follow the code: none of the surfaces did —
`dynamic-solvability-02`, `adversarial-runtime-replay`, `difficulty-baseline-run`
and the extraction tests' equivalence checks reach `inspectDynamicMazeState`
through `loadInstrumented` / `loadRouteRuntime` / `loadRouteModules`, which find
it wherever it is declared. What pinned the old layout:
`route-generation-extraction-tests` P3 and `route-defenders-extraction-tests`
P2/P3 (the invariants left their kept-in-hook lists; C3's P2 accepts the five
names as gone from the hook only where route-invariants.ts declares them);
`route-config-extraction-tests` S2 (`GameStatus` left the kept-in-hook list but
must still never be in route-config); `game-continuation-contract` I1 (the
hook's runtime imports gain `route-invariants`, whose own edges — route-config
and route-geometry, imported by the hook alone — are pinned); the coupling
gate (route-invariants counts as a Rota module file; the new test is declared
as C4's STRUCTURAL_ASSERTION); and `chest-acceptance` item 10, which read
`ChestReward` out of the hook's text and now reads it where the Rota declares
it (exactly once, through `readRouteLogicSources`) and requires the hook to
still export it. The dynamic-solvability campaign's identity hashes the hook's
run-time closure, which now includes route-invariants.ts: only cache keys move.

**ROUTE STATE (ROUTE-C5)** — the Rota's mutable session state is one value,
`RouteRuntimeState`, in `src/games/escape-maze/route-state.ts`, changed only by
the pure `routeStateReducer(state, action)`; `createRouteState` builds a new
session as one coherent state. The eighteen `useState` cells of 74ff2dc
(`difficulty`, `mazeMap`, `player`, `guardian`, `sentinel`, `collectedStars`,
`triggeredTraps`, `turns`, `blockedMoves`, `errors`, `status`, `message`,
`blockedShake`, `moveTick`, `chestOpened`, `rewardSelected`, `rewardSpent`,
`brokenWall`) are its fields; `routeNumber` (the session's identity) and
`lastMoveInputAtRef` (the input guard) stay out on purpose, and every derived
view (walls, zone, sets, Chest flags, break targets, counts, portal, progression,
score, `dynamicSolvability`) is still computed by the hook. Eleven actions, each
writing an exact set of fields: `START_ROUTE`, `BLOCK_STEP`, `COUNT_TURN`,
`MOVE_EXPLORER`, `OPEN_CHEST`, `SELECT_REWARD`, `SPEND_SECOND_CHANCE`,
`OPEN_WALL`, `SETTLE_DEFENDERS`, `COMMIT_CAPTURE`, `END_ROUTE` — transitions,
not domain events (ROUTE-C6). The hook holds the state with one `useReducer`
and still decides which transition applies, in what order, with what values;
it generates maps (the reducer's initialiser, once per mount, where the
`mazeMap` initialiser drew; `startNewMaze`), plays sounds, guards input and
calls `onComplete`. route-state imports types only and reaches nothing at run
time. Writes nothing:

```bash
node tools/validation/route-state-reducer-tests.mjs              # ~4 min
node tools/validation/route-state-reducer-tests.mjs --rev=74ff2dc  # must fail every [structure] and [reducer] check, hold the rest
node tools/validation/route-state-reducer-tests.mjs --mutants      # ~30 min; every in-memory mutant must be caught
node tools/validation/route-runtime-harness-tests.mjs             # ~30 s; the shim's useReducer against react-dom
```

`[structure]` is the static gate: route-state declares and exports the four
names and its session-start shape; the hook's only `useState` is `routeNumber`,
its one `useReducer` runs `routeStateReducer` with an initialiser, the eighteen
fields come out of that state once each, and no setter is left; the state's
fields are exactly the migrated cells — no derived view, nothing kept out; every
derived view is computed in the hook; route-state imports types only from the
defenders, generation, invariants and the shared types, its run-time closure is
itself, and it mentions no RNG, clock, browser, React, sound, storage, map
generation, defender policy or board geometry; in `src/` only the hook imports
it and nothing re-exports it; the union, the reducer's cases and what the hook
dispatches are the same eleven actions, with no generic patch and no C6 word;
the turn, the side effects (same call sites as 74ff2dc) and both `generateMaze`
calls stay in the hook; and the cells are counted (19 `useState` → 1 + 1
`useReducer`). `[reducer]` runs the reducer over thousands of states built from
generated maps, inputs deep-frozen, in a realm where `Math`, `Date`,
`performance`, `crypto` and every browser global are poisoned: deterministic,
never returns its input, writes exactly its action's fields (every other field
keeps its identity), and `START_ROUTE` from a dirty state keeps nothing of it.
`[preserved]`: the hook's exports and its consumers, every other Rota module,
every string of the hook (the 30 user-facing ones byte for byte; none in
route-state), every top-level statement but the hook itself and the new
`sentinelPostOn`, and the turn itself: the hook's body with every state write
(56 setter calls at 74ff2dc, 20 dispatches now), every cell declaration and
every write-only guard taken out prints identically on both trees — the same
conditions in the same order, computations, sounds, `onComplete`,
`generateMaze` calls and returns. C5 replaced writes; it moved no decision. `[equivalence]` against 74ff2dc through the loader, render by
render — all 43 fields the hook returns, at every render: 255 sessions on the
runtime harness (Routes 1/2/3 × every mode × eleven scripted Explorers × two
seeds, eight for the bait; a fresh entry and a continuation; inputs after the
end, restart, mode change, setup inputs, the next Route; three journeys
R1 → R3) with real scoring and recording sounds, each item its own check over
the inputs that exercise it (initial state, start, restart, mode change, both
blocked messages, valid moves, traps, lights, Chest pause and the frozen input,
both rewards, Pickaxe, Hunter / Sentinel / own-step captures, Second Chance
attributed to the Explorer, the Hunter and the Sentinel, win, loss, onComplete
with finalStats, continuation, the RNG — draws per input, `generateMaze` calls
per input, the stream after — and `dynamicSolvability`); and on the REAL React
(react-dom from node_modules, in workers): development + Strict Mode with `act`
and with native discrete events through the hook's own keyboard listener,
production with default updates and with discrete events — every commit,
commits and component calls per input (at most one commit per input; Strict
Mode's double initialiser draws two boards on both trees), completions,
sounds, draws, keyboard listeners and console output identical.

`tools/validation/route-react-runtime.mjs` is the driver: one scenario runner
over two renderers — the harness's shim and react-dom with a fake container
(the component renders `null`) — so both are compared on the same terms.
`route-runtime-harness.mjs` gained a `useReducer` with React's semantics
(`init(initialArg)` once, stable `dispatch`, actions queued and drained at the
next render through that render's reducer, dirty flag), `onRender` with a
`scheduled` flag, a `mocks` passthrough, and a `directDifficulty` edit written
in either state engine (the `status` setter up to C4, `END_ROUTE` with
"playing" and the held message since). `route-runtime-harness-tests.mjs` holds
the shim to react-dom: synthetic components for each property (and one React
has that the shim does not model — a reducer returning its input, which C5's
reducer never does), the real hook on both trees through both, and the
harness's own surface.

`--mutants` applies 13 mutations in memory — a reset forgotten
(`rewardSpent`, `triggeredTraps`); `moveTick` ticked twice, or on a blocked
step; the Hunter's capture falling through so a later write overwrites the
loss; the Sentinel resolved before the Hunter; the Hunter's move kept after a
Second Chance; win/loss swapped; a second board at mount; the reducer mutating
its input; a cell put back; a derived view stored; the RNG imported — and
requires every one to be caught. The capture-order swap is caught by P5 alone:
no scripted session reaches a turn where both defenders land on the Explorer,
so only the turn's text can see it.

Validators that had to follow the code: `route-generation-extraction-tests`
P2/P3, `route-defenders-extraction-tests` P2/P3 and
`route-invariants-extraction-tests` P2/P3 compared `useEscapeMaze`'s whole text
with their baselines; where route-state.ts exists the body (and the new
`sentinelPostOn`) is C5's, held by route-state-reducer-tests, and every other
statement is still compared byte for byte (on their own `--rev` counterfactuals
nothing changes). `route-invariants-extraction-tests` S4 now requires the hook
to be route-invariants' only RUN-TIME importer (route-state names
`GameStatus`/`ChestReward` as types). `game-continuation-contract` I1 pins the
hook's new runtime edge `route-state`, which imports nothing at run time and is
imported by the hook alone. `route-module-loader-tests` L15 accepts the
`directDifficulty` edit in either engine; `route-module-loader`'s inert React
has a `useReducer`. The coupling gate counts route-state.ts as a Rota module
file and declares the new test as C5's STRUCTURAL_ASSERTION. No evidence moved.

**ROUTE DOMAIN EVENTS (ROUTE-C6)** — the turn says what happened. A
`RouteDomainEvent` (`src/games/escape-maze/route-events.ts`) is one of thirteen
occurrences, each naming its meaning: `ROUTE_STARTED` (status `playing` for
start/restart, `setup` for a mode change), `EXPLORER_STEP_BLOCKED`
(`reason: boundary | wall`), `EXPLORER_STEP_COMMITTED`, `LIGHT_COLLECTED`,
`PORTAL_ACTIVATED`, `TRAP_ARMED`, `CHEST_OPENED`, `REWARD_SELECTED`,
`WALL_OPENED`, `SECOND_CHANCE_USED` (`cause: explorer | hunter | sentinel`),
`DEFENDERS_SETTLED`, `EXPLORER_CAPTURED` (`by: explorer-step | hunter |
sentinel`) and `ROUTE_ENDED` (`outcome: won | lost`, `journeyCompleted`). The
pure `routeStateActionsForEvent(event)` translates an event that already
happened into the C5 transitions that record it, in order; light, portal and
trap are observational (the step already wrote them) and translate to none.
`useEscapeMaze` still decides which events happen and in which order, and
applies each through one seam, `applyDomainEvent` — the hook's only
`dispatch`. Events are not stored, queued, published or exposed. Writes
nothing:

```bash
node tools/validation/route-domain-events-tests.mjs               # ~4 min
node tools/validation/route-domain-events-tests.mjs --rev=878057a  # must fail every [structure], [contract] and [trace] check, hold the rest
node tools/validation/route-domain-events-tests.mjs --mutants      # ~10 min; every in-memory mutant must be caught
```

`[structure]`: route-events is in the hook's run-time graph and exports the
union, its four meaning sets and the mapping; the TypeScript checker (on the
tree under test, `--rev` and overrides included) resolves the union to exactly
thirteen members with unique literal `type`s, exact payloads, nothing
any/unknown/optional/callable, no index signature — no generic event — and
closed sets of reasons, causes, captors and outcomes; route-events imports
types only (route-state's actions and session start, the domain's types —
never React, RNG, generation, difficulty, sounds, scoring, storage, UI,
Babylon or the shell), reaches nothing at run time, holds no copy and no
mutable state; the mapping calls nothing, reads nothing but its event and
branches only on `event.type` and the Second Chance's cause; the hook has one
seam (one `dispatch`, inside `applyDomainEvent`, over the mapping's output),
no `dispatch({ type })` left (878057a had 20), every event literal and emitted
where the inventory says; the same cells as 878057a plus the seam's
`useCallback`, route-state.ts byte for byte; no event surface (exports,
returned keys, consumers, importers, no history/bus/queue); the turn's
timeline, function by function — events, sounds, the clock, generateMaze,
onComplete and the hand-offs in order (the end's sound, then `ROUTE_ENDED`,
then `onComplete`; the wall, then the stone, then the defenders) — with every
effect called from the same functions as at 878057a. `[contract]`: every meaning, built from
generated maps, gives exactly its transitions (values by identity); folded
through the reducer it gives the same state as the C5 transition through
878057a's reducer; pure in a realm with `Math`, `Date`, `performance` and
`crypto` poisoned; observational events write nothing; the transitions depend
on the kind (and the Second Chance's cause) only — a capture by the Explorer's
own step, the Hunter or the Sentinel is the same `COMMIT_CAPTURE`, and only the
event tells them apart. `[trace]` observes the trace through the C0 graph:
`route-react-runtime.mjs` gained an opt-in `traceEvents` (and
`instrumentEvents`) that wraps the mapping and the reducer where they are
declared — no production API. Ten situations on hand-built boards (driven
through the real hook, the board standing in for `generateMaze`) have their
traces pinned input by input — including a light on a trap (light, portal,
trap, in that order), the Chest's pause and the reward that resumes the same
turn, the Pickaxe, each Second Chance cause and each captor, the journey's end
and both continuations; on 138 real generated Routes an oracle checks every
event against the render it produced and against the defenders' actual
decisions (their policies wrapped, pass-through), the turn grammar and its turn
numbers hold, every meaning occurs, traces are deterministic and their digest
and first occurrences are pinned. `[preserved]` (against 878057a): surface,
consumers, every other module (the reducer included), strings (the eleven
transition names moved to route-events; the 30 user-facing ones byte for byte),
the hook's other top-level statements, and the order of the turn — P5 erases
every write (and the seam) and requires the body to print as 878057a's and as
74ff2dc's; P6 resolves every event through the REAL mapping into the
transitions it applies (symbolically: a literal is its value, any other
expression its text) and requires the body to print exactly as 878057a's with
its dispatches. `[equivalence]` (against 878057a): every render of the real
Routes on the harness, each meaning over its inputs, completions and finalStats
with the real score, continuation, the RNG stream and generation, verdicts,
reducer runs per input (identical, all from the seam), the ten situations
render by render, and the real React (development + Strict Mode with `act` and
discrete events, production with default and discrete updates): identical
commits and component calls per input, effects and console; the trace the same
within each build, production's the same as the shim's.

`--mutants` (13): TRAP_ARMED dropped; LIGHT_COLLECTED/TRAP_ARMED swapped; the
Hunter's capture labelled the Sentinel's; the Hunter's Second Chance labelled
the Explorer's; ROUTE_ENDED before EXPLORER_CAPTURED; WALL_OPENED forgetting
COUNT_TURN; an extra transition; an observational event that writes; the
mapping deciding; a write that skips the seam; a generic event; an RNG import;
the last event exposed. Each must be caught; the reference is the unmutated
tree on the mutants' smaller set of Routes, which must pass everything first.

Validators that had to follow the code: `route-state-reducer-tests` — S5
accepts route-events as route-state's second importer, types only; S6 holds
the eleven transitions to what the hook writes in either engine (dispatched at
C5; at C6 the transitions its event literals become through route-events' real
mapping, with the seam's `dispatch` as the hook's only one); P5 counts an event
applied as a write and erases the seam, so the turn still prints as 74ff2dc's;
its "Hunter's move kept after a Second Chance" mutant is written as an event.
`route-invariants-extraction-tests` S4 accepts route-events as a second
type-only importer of route-invariants (the `ChestReward` a reward event
carries; the hook is still its only run-time importer).
`game-continuation-contract` I1 pins the hook's new runtime edge
`route-events`, which imports nothing at run time and is imported by the hook
alone. The coupling gate counts route-events.ts as a Rota module file and
declares the new test as C6's STRUCTURAL_ASSERTION. `route-react-runtime.mjs`
records traces only when asked. No evidence moved.
