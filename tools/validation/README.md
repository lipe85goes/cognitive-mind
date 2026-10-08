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

**GAMEPLAY / PLATFORM LOCK v1** — the manifest of what
`docs/GAMEPLAY_PLATFORM_LOCK_V1.md` froze: canonical modules, no run-time
cycles, a Home without game code, a lazy registry, lazy Babylon, generation
only in the Worker (and a pure Worker graph), the C7C binding, a game-agnostic
shell/GameScreen, a game-owned continuation, three product Routes (evaluated),
the v1 modes/rewards/actions/events, the Rota hook's state shape, the Circuit's session-owned timers, and
the lock document itself (decision, canonical commit, every debt classified,
no BLOCKER, older decisions not reopened). It is a checksum of contracts, not
a second CORE: behaviour is the other suites'. Writes nothing:

```bash
node tools/validation/gameplay-platform-lock-v1.mjs                   # <5 s
node tools/validation/gameplay-platform-lock-v1.mjs --rev=<commit>    # code checks on another tree, [doc] skipped
node tools/validation/gameplay-platform-lock-v1.mjs --counterfactuals # bd75e69, 7b740e4, 61c3b04, 3e30148, 415cead must each fail their check
```

A change that moves a locked contract fails the gate until the lock document
and the manifest are updated in the same commit, naming the change class.

**GAME 03 — ESTÚDIO DAS DESCOBERTAS** — the skeleton (`hidden-objects`), the
retirement of the Trilha Lógica (`number-trail`), the experience V2 and the
target pool V1 (GAME03-EXPERIENCE-02). None writes anything unless asked to
(`--out`/`--json`):

```bash
node tools/validation/hidden-objects-skeleton-tests.mjs                      # 38 checks, no browser, ~8 s
node tools/validation/hidden-objects-skeleton-tests.mjs --rev=<commit>       # every source at <commit>
node tools/validation/hidden-objects-skeleton-tests.mjs --counterfactuals    # base f9254429 + 18 in-memory mutants, ~1 min
node tools/validation/hidden-objects-experience-tests.mjs                    # 45 checks ([experience], [pool], [preserved]), ~9 s
node tools/validation/hidden-objects-experience-tests.mjs --counterfactuals  # bases 87f30d3 and 8fbd638 + 31 mutants, ~3.5 min
node tools/validation/hidden-objects-round-fairness.mjs [--out DIR]         # the real selection over 1,000,000 seeds per difficulty
node tools/validation/hidden-objects-browser-probe.mjs [--scenario NAME]    # Playwright, needs `next build && next start -p 3100`
```

The experience suite holds the experience V2 (`[experience]`: what each
difficulty tells, the hint ladders, the found feedback, the result
presentation, the art kit and its measured audit) and the target pool
(`[pool]`: the authored pool and its metadata, every possible round valid, the
same seed always drawing the same round, seeds reaching every round without
bias, the round holding through the whole session, Recomeçar keeping it, a new
exploration drawing a new one, unlisted objects staying scenery, the result
recording its round). `--counterfactuals` requires the skeleton (`87f30d3`) to
fail every `[experience]` and `[pool]` check, the pre-addendum state
(`8fbd638`, fixed lists) to fail every `[pool]` check and hold the rest, and
each in-memory mutant to fail the checks it names. The fairness report runs
the game's own `selectRoundTargets` over a fixed seed stream and writes the
per-object frequencies, the tier and station distributions and the
perceptual load of each difficulty (`docs/archive/game03-experience-02/`).

The first runs the real code from source: the pure scene/camera/gesture/model
modules, the scene controller on a fake viewport under a virtual clock, the real
`HiddenObjectsGame` with its real scene under a small React (every gesture is a
Pointer Event on the viewport), and the real Home on a device holding an old
Trilha result. `[contract]` checks fail on the base (`f9254429`, the Trilha
active); `[preserved]` ones — the Rota, the Circuito, the Central, the Jardim,
the shell's agnosticism, no new dependency, the platform boundaries — hold on
both. `--counterfactuals` also requires each in-memory mutant (eager import,
lost explicit readiness, the Trilha kept active, a drag or a pinch that selects,
a camera that escapes the room, a wrong list, an unreachable target, a second
completion, ready before decode/paint, a listener left behind, React state per
pointermove, an old Trilha result that crashes, is shown as the Estúdio or is
dropped) to fail the checks it names. The probe drives the production build on
desktop (Fácil, Médio, Difícil), phone portrait and landscape, small phone and
reduced motion, with a stored Trilha result, nine planted round seeds and the
Home/reload race, and audits the bundle. Each scenario plants its own seeds in
`crypto.getRandomValues` and holds the list on screen to the one that seed
draws; every scenario also runs alone (`--scenario NAME`). `--out DIR` saves
the visual witnesses (`docs/archive/game03-skeleton-01/`,
`docs/archive/game03-experience-02/`).

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
| STRUCTURAL_ASSERTION | game-continuation-contract, route-journey-ownership, route-journey-terminal, route-config-extraction, route-generation-extraction, route-defenders-extraction, route-invariants-extraction, route-state-reducer, route-domain-events, route-worker-rng-handoff, route-generation-lifecycle, route-generation-worker, gameplay-platform-lock-v1, diagnostic-launcher, production-diagnostic-boundary, cross-eol | the check is about where code lives (I1/O3/T11, C1's, C2's, C3's, C4's, C5's, C6's, C7A's, C7B's and C7C's static gates, the lock's manifest, the seed seam's own code, CRLF of the hook's text); their Rota runs through the graph |
| UI_STAGE | route-board-loader | compiles the Rota component under a chunk gate with stage stubs |
| REPORT_LABEL | breakable-wall-feasibility, dynamic-solvability-finalize | a path inside report text |
| LEGACY_LEDGER | chest-acceptance | ROTA-CHEST-REWARDS-01 ledger; rewrites its archive when run |
| LEGACY_BROKEN | route-lab (`loadLab`), autopsy-generation, final-rejection-autopsy, star-capacity-proof, star-selection-proof, render-route-9x9-evidence | already failed to load at 5d541b2 and write archived evidence when run; kept as their missions' record |

A new validator that names the hook or resolves a Rota import by hand fails the
gate until it uses the loader or is declared with a reason; a declaration whose
coupling is gone must leave the table. `route-config.ts` counts as a Rota module
file for the gate (ROUTE-C1), and so do `route-generation.ts` and
`route-geometry.ts` (ROUTE-C2), `route-defenders.ts` (ROUTE-C3),
`route-invariants.ts` (ROUTE-C4), `route-state.ts` (ROUTE-C5), `route-events.ts` (ROUTE-C6),
`route-generation-job.ts` (ROUTE-C7A), `route-session.ts` and `route-generation-client.ts` (ROUTE-C7B), and
`route-generation-runner.ts`, `route-generation.worker.ts`, `route-generation-worker-executor.ts` and
`route-generation-worker-protocol.ts` (ROUTE-C7C).
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

**ROUTE WORKER RNG HANDOFF (ROUTE-C7A)** — the seeded stream as data, and
the synchronous contract a generation will cross a Worker with. Generation and
the Hunter draw from ONE `routeRandom()` stream; in a seeded diagnostic session
`generateMaze` restarts it at the armed seed (`beginSeededGeneration`) and the
Hunter continues exactly where generation left it. A Worker is another realm,
so that position has to travel. `src/engine/route-random.ts` now has
`RouteRandomCheckpoint` (`{ armedSeed, state }`: two numbers, the PRNG's state
verbatim — never wrapped, since past ~4.9M draws its counter passes 2^53 and the
double's rounding is part of the sequence), `getRouteRandomCheckpoint()` (null
in normal play) and `restoreRouteRandomCheckpoint(cp)` (seed and position; the
next `beginSeededGeneration` still restarts at the seed; malformed input is
rejected unchanged). The PRNG's state left `createSeededDraw`'s closure for the
module's `seededState`; the arithmetic is statement for statement the same.
`src/games/escape-maze/route-generation-job.ts` is request → run → accept,
synchronous and unwired: `useEscapeMaze` still calls `generateMaze` itself.
No Worker, no async, no loading state — that is C7B (lifecycle) and C7C (the
Worker). Normal play is still `Math.random()`. Writes nothing:

```bash
node tools/validation/route-worker-rng-handoff-tests.mjs               # ~3.5 min
node tools/validation/route-worker-rng-handoff-tests.mjs --chromium    # + the handoff through a Chromium Blob Worker
node tools/validation/route-worker-rng-handoff-tests.mjs --rev=f19f319 # must fail every [structure]/[handoff] check, hold [gate]/[equivalence]
node tools/validation/route-worker-rng-handoff-tests.mjs --mutants     # every in-memory mutant must be caught
```

`[structure]`: the seam exports its six pre-C7A names plus exactly the
checkpoint contract and imports nothing; with C7A's statements taken out (and
the two rewritten put back) route-random.ts is f19f319's byte for byte, the
rewritten PRNG is the old closure with `state` → `seededState`, disarming resets
it; the job exports exactly its five names, imports only the seam, generation
and types, reaches nothing that renders, plays, stores or schedules, has no
cycle and no async/Worker/host code; in `src/` only the seam and the job touch
a checkpoint, nothing imports the job, arming is still the launcher's alone,
no UI file knows the checkpoint. `[gate]` (holds at f19f319 too): the hook
calls `generateMaze` directly, twice (reducer initialiser, `startNewMaze`),
imports no job and has no Worker/await/Promise/token/pending/loading; no
product file has Worker wiring. `[equivalence]` (against f19f319): 4000 stream
scripts (arm, 0…60k draws, `randomItem`, `beginSeededGeneration`, clear,
unseeded draws, re-arm — 5.3M values) on persistent realms; every seeded draw
against the tooling's PRNG (2000 seeds); two ~5M-draw streams across the 2^53
edge; 216 seeded generations (R1–R3 × modes × 24 seeds) with 24 Hunter
decisions, a tie-break, the next draws and the Restart board; 34 launcher-shaped
real-hook sessions (Launch, Start, steps, Restart, mode change, Start, steps),
armed and not, render by render; the real React in development Strict Mode
(still two generations at mount), development and production. `[unseeded]`:
`routeRandom()` = one `Math.random()` returning it, `randomItem` one draw,
unseeded generation the same calls; no checkpoint of normal play; the job in
normal play carries no stream, clears a stale seed in the generating realm and
never touches the requesting realm's `Math.random`. `[handoff]`: 1600
checkpoints (N = 0…60 000) restored in fresh module graphs or a long-lived one
continue exactly (= the realm continuing = f19f319 drawing N + M); repeated and
chained restores; restore keeps `beginSeededGeneration` at the armed seed;
clear after restore is normal play; malformed checkpoints change nothing; the
216 generations again as request → structuredClone → generating realm →
structuredClone → accept → Hunter, equal to f19f319 decision for decision (and
the job in one realm = `generateMaze`); same board on Restart after a restore;
mismatched results refused; the REAL hook with its two `generateMaze` calls
pointed (in memory) at a second realm plays all 34 sessions render for render
like f19f319, generating nothing locally. `[clone]`: checkpoint, request and
result survive structuredClone (and JSON for checkpoint/request), walls stay a
`Set` in order; a real `node:worker_threads` Worker runs the job from
`emitModuleBundle` and its postMessage'd results continue the main stream
exactly; `--chromium` does the same in a Chromium Blob Worker. `[performance]`
(informational): seeded ms per million draws and seeded generation p50/p95,
f19f319 vs tree, native.

`--mutants` (16): checkpoint one draw behind/ahead, with the seed but the wrong
state, a wrapped uint32 state; restore losing the seed or ignoring the state;
`beginSeededGeneration` continuing the current state; clear keeping the seed or
the stream; arm not restarting; two `Math.random` per draw; `randomItem`
drawing twice; the job's result forgetting the checkpoint or reporting the
request's; accept not restoring; the generating realm keeping a stale seed.
The unmutated tree must pass the mutants' smaller suite first.

Validators that had to follow the code: route-random.ts was byte-for-byte
"untouched" in C2's P2 and in C3/C4/C5/C6's EVERY_OTHER_ROTA_MODULE_UNTOUCHED.
They now compare `routeRandomBeforeC7A(tree)` (route-module-loader.mjs): the
seam with C7A's four additions dropped and its two rewritten declarations put
back as at f19f319 — every other byte of the seam is still compared, and a tree
missing any C7A name falls back to the raw text. The coupling gate counts
route-generation-job.ts as a Rota module file and declares the new test as
C7A's STRUCTURAL_ASSERTION. No evidence moved.

**ROUTE GENERATION LIFECYCLE (ROUTE-C7B)** — the Rota asks for its boards
asynchronously and applies a board only when it arrives, still on the main
thread. `src/games/escape-maze/route-generation-client.ts` is the seam:
`RouteGenerationCommand` (C7A's request in a lifecycle envelope: request id +
intent), `RouteGenerationResponse`, `RouteGenerationExecutor` (callback-shaped,
`(command, deliver) => cancel` — the one thing C7C swaps for a Worker),
`runRouteGenerationLocally` (this realm, `setTimeout(…, 0)`: cancelled for real
before it runs, ignored after) and `startRouteGeneration` (checks the token and
the request id, THEN `acceptRouteGenerationResult`, THEN reports the map).
`src/games/escape-maze/route-session.ts` is the hook's one state: the C5 match
(`RouteRuntimeState | null` — null only before the mount's first board) and the
generation (`pending`/`ready`/`error` with its target), pure. One effect,
keyed on the pending generation, runs it; its cleanup is the token (latest
wins, unmount, Strict Mode). The hook calls no `generateMaze`; the launcher's
session owns its seed through a layout effect. C7B blocks the main thread
during the computation exactly as before — no performance claim. Writes
nothing:

```bash
node tools/validation/route-generation-lifecycle-tests.mjs               # ~3.5 min
node tools/validation/route-generation-lifecycle-tests.mjs --rev=e8971eb # must fail every [structure]/[lifecycle]/C7B [view] check, hold [preserved]/[equivalence]
node tools/validation/route-generation-lifecycle-tests.mjs --mutants     # every in-memory mutant must be caught
node tools/validation/route-generation-lifecycle-browser-probe.mjs       # Playwright, needs `next build && next start -p 3100`
```

`[structure]`: the client's exact contract (job its one run-time import, no
React/UI/Worker/sound/storage/domain event, the local executor schedules and
clears a timer, `routeGenerationExecutor` is the local one); check → accept →
report, in that order; the session pure, nullable match, three phases, four
intents, delegation to `routeStateReducer` and refusal while awaiting; the hook
with no `generateMaze`/job call, one generation effect keyed on the pending
generation; C6's seam still the turn's (every other `dispatch` is a lifecycle
action); `route-events.ts` untouched; no Worker wiring in `src/`; the
launcher's session-owned seed. `[preserved]` (holds at e8971eb): C7B's edit of
the hook, the view and the stylesheet is exactly the declared one
(`routeHookBeforeC7B`, `routeGameBeforeC7B`, `routeVisualBeforeC7B` give
e8971eb back byte for byte); the turn's three inputs gained one guard line each
and nothing else; every other product file but the launcher is untouched; one
state source. `[lifecycle]`: on the shim (a controllable executor injected
through the client module's export, answering from a second module realm) —
async boundary, latest wins out of order, a stale result never restores its
RNG, unmount, instance token vs request id, no stand-in map, Start/Restart/mode
freeze then open, double Restart and the mode race (one generation, every
answer order ends on the last mode), error → retry under a new id, continuation,
seeded/unseeded, no sound of its own; on the real React (dev Strict Mode,
production): one generation at mount (Strict Mode's first request withdrawn
before it runs — same request id, different token), Start/double Restart/leave,
stale and unmounted answers silent, no console output. `[equivalence]`: every
accepted board reaches the baseline's ready state — shim and four real-React
configurations, field for field, armed seeds included — and every pending
commit is the previous match frozen (or no board at all). `[view]`: the REAL
`RouteStrategyGame` and launcher page through React's reconciler (the 19.2
build @react-three/fiber ships, a plain-object host): no board before the first
board, the calm pending screen, a first-board failure reaches onEntryError once
and retry generates again, the board chunk's failure stays the board's, leaving
while pending mounts nothing, the launcher's every request carries its
session's seed in Strict Mode, and the view on every accepted board is the
baseline's node for node. `[performance]` (informational): scheduling overhead
vs the computation still on the main thread.

The browser probe drives the production build from the Home: the first board
pending (no board, the calm message) before the Rota appears; Start (disabled
while pending), Restart, two Restarts in one task (one pending, one board), a
failing Restart from Detalhes (Math.random made to throw inside the local
executor's one task only — recognised by its code; the product has no test
hook) with its retry, leaving while pending, three modes in one task (only the
last appears), no console error. It also stamps each state with the animation
frames the page ran: under software WebGL (headless SwiftShader) the pending
state lasts ~60–200 ms of page time and no frame was observed inside it, so
"a paint opportunity before the computation" is a macrotask boundary, not a
measured paint.

`--mutants` (14): stale answer accepted, stale RNG restored, the effect never
withdraws, request ids reused, mode A over B, error pending forever, retry
reusing the failed request, accept forgotten, gameplay during pending, board
mounted before the first board, a second Restart not withdrawing the first,
Strict Mode's cleanup not cancelling the local run, the launcher's passive
clear back, a failure silently reopening gameplay.

Validators that had to follow the code. The runtime drivers learned the
lifecycle: `route-runtime-harness.mjs` runs effects (deps, cleanups, unmount),
drains a virtual `setTimeout` queue inside each input (`act(fn, {
drainTimers })`), memoises `useMemo`/`useCallback` like React (the generation
effect is keyed on a callback), reports renders taken while a board is pending
or failed apart (`lifecycleRenders`, `observeLifecycle`) and gives the hook an
inert window for its keyboard effect; `route-react-runtime.mjs` lets the board
arrive inside the input (also under `act`), counts lifecycle commits and bodies
apart, leaves the lifecycle keys out of every observation
(`withoutLifecycle`), and — Strict Mode only, on a C7B tree — replays the
discarded board a pre-C7B initialiser drew and re-attributes Strict Mode's one
re-run of the mount's effects to the board's commit (`strictMountReplays`,
`strictMountEffectReplays`). So C5's and C6's render-by-render comparisons
compare the states the game reaches, which are identical. The text checks of
C2–C7A read the hook, the view and the stylesheet through `treeBeforeC7B`
(route-module-loader.mjs; it also hides C7B's two new modules), exactly as they
read route-random.ts through `routeRandomBeforeC7A`; their runs load the tree's
own code. C7A's H9 now drives its second realm through C7B's executor seam
instead of editing `generateMaze` calls that no longer exist; its S4/G1 (the
unwired job, the synchronous hook) are C7A's state and read the view before
C7B. C6's E8 drops the lifecycle keys; game-continuation-contract I1 pins the
two new edges; route-board-loader renders the Rota's own components inline;
the journeys' launcher stubs gained `useLayoutEffect`;
production-diagnostic-boundary and diagnostic-launcher accept the
session-owned seed; route-journey-ownership-browser-probe waits for the chosen
mode's board to arrive before reading the setup. The coupling gate counts the two new modules as Rota
module files and declares the new test as STRUCTURAL_ASSERTION. No evidence
moved.

**ROUTE GENERATION WORKER (ROUTE-C7C)** — the Rota's boards are generated in a
real Web Worker. `src/games/escape-maze/route-generation.worker.ts` receives
one command, runs C7A's `runRouteGenerationSync` and posts one reply;
`route-generation-worker-executor.ts` is the product's executor (one dedicated
Worker per command, created when the hook's effect asks, terminated on reply,
failure or cancel — `terminate()` interrupts a running `generateMaze`, so a
superseded board never delays the next; every failure is C7B's failure
response, never a silent main-thread fallback);
`route-generation-worker-protocol.ts` holds the two messages and the main
thread's shape check; `route-generation-runner.ts` holds the run and C7B's local
executor, moved verbatim out of the job and the client, so the main thread's
graph (hook, client, job, view) no longer reaches `generateMaze` — and the hook's
`generateMaze` re-export (no product consumer) is gone. C7B's lifecycle is
untouched: only `routeGenerationExecutor`'s binding changed. Writes nothing:

```bash
node tools/validation/route-generation-worker-tests.mjs                 # ~25 s
node tools/validation/route-generation-worker-tests.mjs --rev=bd75e69   # must fail every [structure] check, hold [preserved] P4
node tools/validation/route-generation-worker-tests.mjs --mutants       # every in-memory mutant must be caught (~2 min)
node tools/validation/route-generation-bundle-audit.mjs --gate          # reads .next: generation only in the Worker's chunks
node tools/validation/route-generation-worker-browser-probe.mjs         # Playwright, needs `next build && next start -p 3100` (+ `--launcher-base` = `next dev`)
node tools/validation/route-generation-worker-performance-probe.mjs --gate   # Playwright, production build, 1×/4×/6× CPU throttle
```

`[structure]`: the client's binding IS `runRouteGenerationInWorker` (text and
run time); the Worker entry imports the runner and the protocol, runs once per
message, posts once on both paths, throws what it cannot read and never closes;
the protocol is closed; the Worker's graph reaches the runner, generation and
the seam and nothing that renders, plays, stores or holds session state; the
main thread's graph (hook, view) reaches neither generation nor the runner nor
the entry, only the entry imports the runner, only the runner imports
generation, no main-thread product file calls them; `new Worker` appears only
inside the executor function (none constructed while loading the graph, none
needed to import it, as during SSR); the Worker URL is the static
`new URL("./route-generation.worker.ts", import.meta.url)`; the executor has no
path to local generation; the hook imports `MazeMap` as a type only; the job is
the main thread's half, the runner the generating half. `[preserved]` (against
bd75e69): `routeFileBeforeC7C` gives the job, the client and the hook back byte
for byte and the statement diff is exactly `ROUTE_C7C_EDIT`; the run and the
local executor moved byte for byte; every other product file is untouched (the
session, the view, route-state, route-events, generation, the seam); the hook's
`useEscapeMaze` is bd75e69's text. `[executor]`: the REAL executor in a realm
whose `Worker` is a host running the REAL entry's bundle (one fresh realm per
Worker, `structuredClone` both ways, a virtual clock) — ready (walls a `Set`,
the reference map and checkpoint, terminated on reply, never synchronous), a
throwing generation, constructor failure, script load error, unreadable job,
unreadable reply, seven malformed replies, a silent Worker (failed at the
watchdog), cancel before start, cancel mid-generation (interrupted, never
completes), a reply queued before cancel (the host dispatches it anyway), a
double post, two hook instances at request id 1, a stale answer never reaching
the RNG. `[hook]`: the REAL hook with the product binding on that host — the
first board (pending, one Worker, no board before the reply), Start/Restart/
double Restart, rapid Restarts and the mode race (every superseded Worker
terminated mid-generation, one generation completes, the last board arrives one
generation after it was asked for), leaving while pending, 200 Restarts without
a leaked Worker, failure → Retry on a new Worker under a new id, continuation,
and no generation in the main realm. `[rng]`: 27 seeded sessions (R1–R3 ×
modes × 3 seeds; mount, Start, the Explorer's moves, Restart, more moves, the
next draws — 486 observations) through the Worker equal bd75e69's local
generation, checkpoint for checkpoint; every seeded request carries its seed
and every reply its stream; normal play carries none, the Worker draws its own
`Math.random` and the main realm's is not drawn while generating; stale Worker
answers are never accepted. `[clone]`: a `node:worker_threads` isolate runs the
entry's bundle; real structured clone keeps walls a `Set` in order and the
seeded checkpoint exact.

`--mutants` (12): the binding back to the local executor, a reply to another
request id accepted, no `terminate()` on cancel, a queued stale reply delivered,
the seeded result without its checkpoint, a Worker that swallows a generation
error, a Worker error left pending, the main thread running the runner too,
walls flattened on the way back, a persistent Worker routed by request id (a
remounted instance hears the old one), a persistent Worker that cannot
interrupt (the latest waits for the superseded), a Worker created at module
evaluation. The unmutated tree must pass the mutants' smaller suite first.

The bundle audit follows what the browser loads from a `next build`: the
Home's initial scripts, the Rota's lazy set, every Turbopack Worker entry the
Rota set constructs, the board's Babylon set, where the generation literal
lives, raw/gzip, and the module groups both realms carry (route-random,
route-config/difficulty/geometry). The browser probe drives the production
build: a Chromium trace attributes generation's chunk to the Worker's thread
and to no main-thread sample (cold and warm entry, a Restart), the Worker's
start-up and compute span; one `rota-generation` module Worker per board,
terminated on reply; walls arrive as a `Set`; rapid Restarts terminate every
superseded Worker before it replies; a blocked constructor and a script that
fails to load both reach the calm error and Retry; 60 Restarts leave no Worker
and no heap growth; leaving while pending terminates; with `--launcher-base`
(the launcher is development-only) every seeded request and reply equals what
the runner computes in Node. The performance probe measures the session's
FIRST board — pending → accepted, before the Babylon board mounts — at 1×/4×/6×:
Worker latency, long tasks (attributed by a CPU profile of the main thread),
the main thread's heartbeat while the Worker computes, frames, main-thread
samples in generation's chunk; cold (first page) and warm (back to the Home and
in again) apart. Its wall-clock output is run metadata, never evidence.

Validators that had to follow the code. The loader learned the Rota's second
realm: `closure()`, `locate`, `declaring` and `anchoredEdits` default to the
Rota's roots (the hook and, on a C7C tree, the Worker entry), `import.meta.url`
compiles to the module's repository URL (a `vm` realm runs CommonJS), and
`loadRouteModules` binds the Rota's executor to the runner's local executor in
the validator's realm (`generationExecutor: "product"` keeps the Worker; the
runtime harness and the instrumented generator pass it through), so every
runtime validator generates where C7B generated. `treeBeforeC7C` (with
`routeFileBeforeC7C`, `ROUTE_C7C_EDIT`) is C7C's sanctioned edit:
`treeBeforeC7B` now reads through it, so C2–C7A's text checks see the tree as
they knew it; C7B's [structure]/[preserved] read through it too (C7B's state),
and C7A's S3 (the job's contract) and G2 (no Worker in the product).
C1–C4's runtime surface checks count C7C's one declared removal back
(`hookExportsBeforeC7C`); C2's identity check for `generateMaze` becomes "the
hook no longer exports it, generation declares it". C7A and C7B find the run in
`routeGenerationRunnerFile(tree)` (the runner, or the job before C7C), and
their mutants that edit the run or the local executor follow it to the runner.
The C7B browser probe's forced failure now blocks the next Worker's
constructor. route-board-chunk-browser-probe's leave scenarios read the
canvas's loading text once the first board has arrived: the board's own
"Preparando o tabuleiro Babylon…" exists only then, and the Worker's start-up
made the first board's pending screen outlast the instant the canvas attaches
(C7B's local generation usually finished before it). The coupling gate counts the four new modules as Rota module files
and declares the new test as STRUCTURAL_ASSERTION. No evidence moved.

**ROUTE PERFORMANCE / WORKER DECISION (ROUTE-PERF-WORKER-DECISION-01)** — how
long generation takes, and what moving it to a Web Worker could buy. Read-only,
wall-clock output is RUN METADATA (never evidence); `--out FILE` writes a JSON
report, nothing is written otherwise. Decision and numbers:
`docs/route-worker-decision.md`.

```bash
node tools/validation/route-generation-performance-gate.mjs                 # ~17 min; Node, 9 combinations × 3 reps × 500
node tools/validation/route-worker-browser-probe.mjs --phase intrinsic      # ~16 min; Chromium, 1×/4×/6× CPU throttle
node tools/validation/route-worker-browser-probe.mjs --phase product        # needs `next build && next start -p 3100`
```

Both time the real generation closure through
`route-module-loader.mjs#emitModuleBundle`, which emits `entry`'s run-time
closure (same files, transforms and transpilation as the graph) as one
self-contained function expression — so it runs natively in Node's main realm,
in a page and in a throwaway Worker, with no `vm` sandbox in the timed path; it
refuses closures that import packages. The gate times an unmodified copy with
the product's seed seam armed, then replays every seed through a copy with
attempt/recovery counters (anchored edits) and a draw-counting `Math`, and fails
if a map differs (probes must be behaviour-neutral) or a generation throws. The
browser probe's intrinsic phase adds Long Tasks, structuredClone/postMessage
transport with `Set` fidelity, generation inside the Worker and heap; its
product phase records input → first/second rAF, DOM readiness, Event Timing,
Long Tasks and a CPU profile per action, locating `generateMaze` in the shipped
chunk by its unique error literal. Under SwiftShader (no GPU) product timings
are dominated by native WebGL — the no-generation move control blocks for
seconds — so they are not usable for the Worker gate in such an environment.
