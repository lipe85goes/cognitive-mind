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
  binding in whichever Rota module declares it.

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
once although the hook and `difficulty.ts` both import it), mocks, worktree vs
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
| STRUCTURAL_ASSERTION | game-continuation-contract, route-journey-ownership, route-journey-terminal, route-config-extraction, diagnostic-launcher, production-diagnostic-boundary, cross-eol | the check is about where code lives (I1/O3/T11, C1's static gate, the seed seam's own code, CRLF of the hook's text); their Rota runs through the graph |
| UI_STAGE | route-board-loader | compiles the Rota component under a chunk gate with stage stubs |
| PROVENANCE | dynamic-solvability-campaign-lib | campaign identity hash over named files; changing it would invalidate recorded identities |
| REPORT_LABEL | breakable-wall-feasibility, dynamic-solvability-finalize | a path inside report text |
| LEGACY_LEDGER | chest-acceptance | ROTA-CHEST-REWARDS-01 ledger; rewrites its archive when run |
| LEGACY_BROKEN | route-lab (`loadLab`), autopsy-generation, final-rejection-autopsy, star-capacity-proof, star-selection-proof, render-route-9x9-evidence | already failed to load at 5d541b2 and write archived evidence when run; kept as their missions' record |

A new validator that names the hook or resolves a Rota import by hand fails the
gate until it uses the loader or is declared with a reason; a declaration whose
coupling is gone must leave the table. `route-config.ts` counts as a Rota module
file for the gate (ROUTE-C1).

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
