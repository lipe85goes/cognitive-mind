# ROUTE-PERF-WORKER-DECISION-01 — should Route generation move to a Web Worker (ROUTE-C7)?

Baseline: `e384d763507212b527801d0e0ce31a276d0181d2` (C0–C6 done). This mission
measures the current architecture; it changes no product source.

## 1. Rubric (registered BEFORE any measurement)

This section was written and committed before the first measurement was taken.
Thresholds below are not adjusted after looking at numbers; anything learned
later is reported as an observation, not as a new threshold.

### 1.1 Definitions

- **Long task**: a main-thread task > 50 ms (Long Task API, `PerformanceObserver({ type: "longtask" })`).
- **Next frame** of an input: from the input's `event.timeStamp` to the first
  `requestAnimationFrame` callback registered in a window capture-phase listener
  (i.e. the first rendering opportunity after the task that handled the input).
  The Event Timing API's `duration` (input → next paint, 8 ms granularity) is
  recorded alongside as a cross-check.
- **Visual ready**: the DOM state the action promises is present (status /
  board attributes changed as expected), measured from the same input timestamp.
- **Generation share** of an action: `generateMaze` inclusive time inside the
  action's task (production CPU profile, function located by its unique error
  literal in the shipped chunk) divided by the action's main-thread blocking
  time. Where the profile cannot locate it, the share is **UNKNOWN**, not guessed.
- **CPU-throttled browser approximation**: the same headless Chromium with CDP
  `Emulation.setCPUThrottlingRate` at 1×, 4× and 6×. It is NOT claimed to be any
  specific phone.
- **Material share**: ≥ 10 % of samples.
- **Consistent**: holds in at least 2 of 3 repetitions. A single outlier never
  decides.

### 1.2 Sampling (fixed in advance)

- Node intrinsic: 9 combinations (Routes 1/2/3 × easy/medium/hard), explicit
  warm-up of 50 generations per combination discarded, then 3 repetitions × 500
  generations per combination, seeds disjoint from the warm-up.
- Browser intrinsic (same Chromium as the product runs, the real generation
  modules bundled into a blank page, no React/Babylon): 1×/4×/6×, warm-up
  discarded, 3 repetitions × 100 generations per combination per throttle.
- Browser product (production build, `next start`, warm chunks): 1×/4×/6×,
  mobile viewport 390×844; ≥ 30 samples per action per throttle for Start,
  Restart, Difficulty change and the normal-move control; ≥ 20 for warm entry
  and Route continuation (each needs a full entry or a played Route — justified
  by cost); cold entry reported separately and never used alone to decide.
- No other heavy process (CORE, mutants, builds) runs during browser timing.

### 1.3 Gates

C7 **GO** if ANY of these holds consistently:

| id | gate | threshold |
| -- | ---- | --------- |
| T1 | browser intrinsic generation p95, all 9 combinations pooled, 4× | > 100 ms |
| T2 | browser intrinsic generation p95, pooled, 6× | > 200 ms |
| T3 | share of browser intrinsic generations > 50 ms, pooled, 4× | ≥ 10 % (material) |
| T4 | Start / Restart / Difficulty, 4×: input → next frame p95 > 200 ms **and** generation share ≥ 50 % of the blocking | both |

C7 **NO-GO NOW** if ALL of these hold:

- none of T1–T4 holds (not even in a single repetition);
- no gated metric lies in the borderline band (§1.4);
- in the warm product actions generation is not the dominant part of the
  blocking (share < 50 %), or the actions stay responsive (next frame p95 ≤ 200 ms at 4×);
- the normal-move control (no generation) is reported, so the generation-carrying
  actions are compared against a baseline of the same React/Babylon work.

C7 **DEFER — REAL DEVICE** if neither of the above: a gated metric is inside the
borderline band, a gate holds in only 1 of 3 repetitions, or the dominant
action's generation share is UNKNOWN.

### 1.4 Borderline band

A gated metric within ±25 % of its threshold without crossing it consistently
(T1: 75–125 ms; T2: 150–250 ms; T3: 7.5–12.5 %; T4 next frame 150–250 ms with
share ≥ 37.5 %) is borderline, and borderline means DEFER, not NO-GO.

### 1.5 What the decision may and may not use

- Production build only; `next dev`, Strict Mode and cold reloads are
  diagnostics, reported separately.
- Historical numbers in `final-acceptance.mjs` are context, never evidence.
- The Worker's cost side (RNG continuity, async lifecycle, transport, memory)
  is audited qualitatively and quantitatively, but a GO from §1.3 is not
  overturned by cost alone; a GO with a large cost is reported as such.

---

Everything below was written after the measurements. All figures are RUN
METADATA (wall clock on one machine); they are not gameplay evidence and are
not stored under `docs/archive`.

## 2. Environment

| item | value |
| ---- | ----- |
| machine | cloud container, Intel Xeon @ 2.10 GHz × 4 cores, 16 GiB, Linux 6.18 |
| Node | v22.22.0 |
| browser | Chromium 141.0.7390.37 (Playwright 1.56, headless), WebGL through **SwiftShader** (software rasterizer — there is no GPU) |
| build | `next build` (16.3.6, Turbopack) + `next start -p 3100` at baseline `e384d76`; `src/` byte-identical |
| viewport (product) | 390×844, `isMobile`, touch, deviceScaleFactor 1 (DPR 1 because every pixel goes through a software rasterizer, not a throttled GPU) |
| throttling | CDP `Emulation.setCPUThrottlingRate` 1× / 4× / 6× — "CPU-throttled browser approximation", not a phone |
| real device | **none available**; no Android/iPhone claim is made |
| isolation | Node run, browser intrinsic run and browser product run executed one after another, nothing else running |

Tools (new, read-only, `tools/validation/`):

- `route-generation-performance-gate.mjs` — Node intrinsic timing + attribution.
- `route-worker-browser-probe.mjs --phase intrinsic|product` — browser generation alone, transport, memory; production product actions.
- `route-module-loader.mjs#emitModuleBundle` (additive) — the generation closure as a standalone script, so the same transpiled modules run natively in Node, in a page and in a throwaway Worker. Equivalence: the bundle gives the same map as the validators' `vm` graph for every seed checked (200/200 Route 3 hard in the gate, 30/30 in a spot check).

## 3. Measurement 1+2 — intrinsic generation in Node (1×, native realm)

Warm-up 50 per combination discarded; 3 repetitions × 500 per combination =
1 500 samples per combination, 13 500 total. Same seeds replayed through a
probed copy for attribution: **0/13 500 map mismatches** (the probes are
behaviour-neutral; the counting PRNG is the product's). 0 throws, 0 recovery.

| combination | p50 | p75 | p90 | p95 | p99 | max | mean | >16 | >32 | >50 | >100 | >200 | >500 | attempts p50/p95/max | draws p50/p95/max | p95 per rep |
| --- | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --- | --- | --- |
| R1 easy | 20.2 | 34.0 | 54.3 | 67.0 | 102.2 | 187.9 | 26.8 | 883 | 414 | 176 | 16 | 0 | 0 | 4/17/56 | 336/1289/4009 | 68.9/66.6/65.7 |
| R1 medium | 18.1 | 28.0 | 44.7 | 54.8 | 78.6 | 123.1 | 21.9 | 850 | 277 | 98 | 5 | 0 | 0 | 2/9/20 | 212/644/1538 | 58.7/49.2/54.0 |
| R1 hard | 16.3 | 24.0 | 36.1 | 45.4 | 64.6 | 131.8 | 19.8 | 762 | 200 | 61 | 6 | 0 | 0 | 4/15/42 | 225/709/2277 | 46.2/46.9/40.9 |
| R2 easy | 50.4 | 96.0 | 152.3 | 202.3 | 297.5 | 437.2 | 70.2 | 1289 | 998 | 753 | 361 | 78 | 0 | 8/33/77 | 810/3284/7293 | 212.0/202.3/190.5 |
| R2 medium | 23.8 | 41.6 | 67.9 | 87.8 | 120.6 | 206.7 | 32.3 | 1051 | 544 | 280 | 38 | 1 | 0 | 4/14/37 | 319/1109/2791 | 94.8/80.3/88.1 |
| R2 hard | 13.5 | 21.3 | 31.4 | 38.9 | 63.9 | 96.3 | 17.4 | 636 | 145 | 39 | 0 | 0 | 0 | 4/13/36 | 223/711/1730 | 46.4/40.1/34.9 |
| R3 easy | 70.4 | 139.4 | 221.0 | 286.6 | 417.5 | 1144.3 | 99.3 | 1339 | 1110 | 929 | 568 | 194 | 6 | 21/86/371 | 1721/6915/29796 | 287.1/274.2/286.6 |
| R3 medium | 31.9 | 56.4 | 93.2 | 118.3 | 165.7 | 380.6 | 43.2 | 1152 | 750 | 444 | 131 | 10 | 0 | 9/37/135 | 685/2660/9092 | 120.1/108.9/126.4 |
| R3 hard | 31.4 | 58.4 | 89.4 | 116.1 | 178.0 | 265.8 | 43.1 | 1132 | 746 | 461 | 111 | 9 | 0 | 10/45/108 | 661/2697/6561 | 120.5/108.1/112.7 |
| **total** | **23.9** | 48.4 | 93.9 | **137.4** | **252.0** | **1144.3** | 41.6 | 9094 | 5184 | 3241 | 1236 | 292 | 6 | 5/39/371 | 388/2971/29796 | 141.1/135.8/136.2 |

(ms; min 6.4–8.8 in every combination; counts out of 1 500, total out of 13 500.)

Noise: pooled p95 per repetition 141.1 / 135.8 / 136.2 ms (±2 %); per-combination
p95 varies up to ±10 % between repetitions. The maxima (663 / 1144 / 517 ms) are
single-seed tails and are not used as gates.

Cross-check: the validators' `vm` sandbox on the same 200 Route 3 hard seeds
gives p50 37.8 / p95 124.5 ms vs native 36.3 / 113.5 ms — the sandbox costs
≈ 5–10 %. The historical `final-acceptance` figures are therefore of the right
order for Route 3 hard, but **Route 3 hard is not the worst case**: easy is.

### Attribution (what makes a generation slow)

- Cost is almost entirely the number of candidates built: Spearman ρ(ms,
  attempts) = 0.93 overall (0.89–0.98 per combination), ρ(ms, draws) = 0.97
  (0.96–0.99). Mean cost ≈ 4.0 ms per candidate on this CPU.
- Recovery never ran (0 / 13 500): the outliers are long random phases, not the
  deterministic sweep.
- Slowest 1 % of each combination vs the rest: attempts 31 vs 6 (R1 easy),
  58 vs 11 (R2 easy), 173 vs 29 (R3 easy), 84 vs 14 (R3 hard); draws scale the
  same way.
- Difficulty: **easy is the slow mode** (p95 213 ms, 16 attempts on average)
  vs medium 93 ms / 7.0 and hard 79 ms / 8.5. Stage: Route 1 p95 57 ms, Route 2
  133 ms, Route 3 195 ms. The product's first Route on its default mode is not
  the expensive case; Route 2/3 on Aberto (easy) is.
- Draws per generation: mean 804, p50 388, p95 2 971, max 29 796.

## 4. Measurement 1 in the browser — generation alone, 1× / 4× / 6×

Same Chromium as the product, the bundled generation closure in a blank page,
each generation in its own task, product seed seam armed per sample. Warm-up 20
per combination discarded; 3 repetitions × 100 per combination per rate
(2 700 per rate). 0 throws. Counts: 1× >16 1655, >32 922, >50 542, >100 204,
>200 28, >500 1; 4× >50 1983, >100 1313, >200 652, >500 165; 6× >50 2589,
>100 1766, >200 1006, >500 346.

| rate | p50 | p75 | p90 | p95 | p99 | max | mean | > 50 ms | Long Task entries | p95 per rep |
| ---: | --: | --: | --: | --: | --: | --: | --: | --: | --: | --- |
| 1× | 21.0 | 42.3 | 85.6 | **119.0** | 204.0 | 553.7 | 36.1 | **20.1 %** | 542 / 2 700 | 112.9 / 124.5 / 123.6 |
| 4× | 96.7 | 192.8 | 389.7 | **560.6** | 960.1 | 2 573.9 | 165.4 | **73.4 %** | 1 986 / 2 700 | 528.5 / 582.8 / 578.2 |
| 6× | 145.0 | 290.3 | 589.6 | **844.7** | 1 443.3 | 3 815.4 | 249.4 | **95.9 %** | 2 602 / 2 700 | 799.6 / 869.7 / 862.8 |

Per combination (p95 ms; share > 50 ms):

| combination | 1× | 4× | 6× |
| --- | --: | --: | --: |
| R1 easy | 56.9 (9 %) | 263.5 (77 %) | 396.7 (100 %) |
| R1 medium | 45.9 (4 %) | 208.6 (52 %) | 318.4 (94 %) |
| R1 hard | 42.9 (2 %) | 183.2 (56 %) | 292.0 (94 %) |
| R2 easy | 170.7 (48 %) | 784.8 (87 %) | 1 167.0 (100 %) |
| R2 medium | 69.0 (11 %) | 325.2 (78 %) | 469.4 (98 %) |
| R2 hard | 32.0 (1 %) | 147.4 (53 %) | 214.5 (83 %) |
| R3 easy | 231.2 (54 %) | 1 057.7 (90 %) | 1 573.6 (100 %) |
| R3 medium | 103.4 (25 %) | 480.9 (87 %) | 712.1 (98 %) |
| R3 hard | 99.2 (26 %) | 438.7 (82 %) | 685.7 (96 %) |

The Long Task API sees generation: at every rate the number of Long Task
entries matches the number of generations > 50 ms (542/542, 1986/1983,
2602/2589 — one long task per slow generation). Browser 1× is close to Node 1× (p95 119 vs 137 ms). The
throttled slowdown is ≈ 4.6× and ≈ 6.9× at the median.

## 5. Measurement 9 + transport prototype — what a Worker would have to move

Throwaway Blob Worker created by the probe page only (nothing in `src/`), 60
real maps per rate:

| metric | 1× | 4× | 6× |
| --- | --: | --: | --: |
| MazeMap JSON size (Sets as arrays), p50 / max | 626 B / 752 B | same | same |
| walls per map, p50 / max | 21 / 30 | same | same |
| `structuredClone(map)` on main, p95 | 0.1 ms | 0.5 ms | 0.3 ms |
| main → Worker → main echo of a map, p95 | 0.2 ms | 0.9 ms | 1.7 ms |
| main-thread cost of receiving a map (`event.data`), p95 | 0.1 ms | 0.5 ms | 1.1 ms |
| `Set` survives `structuredClone` / `postMessage` (instanceof, size, every key, JSON-equal) | yes / yes | yes / yes | yes / yes |
| generation of R3 easy (same 30 seeds) in the Worker vs on main, p50 | 54.1 vs 52.3 ms | 57.3 vs 241.1 ms | 55.3 vs 384.8 ms |

Transport is negligible: a MazeMap is < 1 KB and crosses threads in about a
millisecond even at 6×, and Chrome 141 clones its `Set<string>` faithfully.
The last row also shows that CDP CPU throttling slows the main thread only —
the Worker ran at full speed — so "in-Worker under 4×" is NOT a valid
low-end estimate; on a real slow phone the Worker would be slow too, just not
blocking input.

Memory (CDP `HeapProfiler.collectGarbage` ×2 + `Runtime.getHeapUsage`, 1×):
600 generations discarded grow the heap by 7 KB (noise level — no leak);
a retained MazeMap costs ≈ 1.7 KB of heap. A Worker would add its own isolate
(V8 baseline of a few MB) plus a second copy of the generation code (the
bundle is ≈ 80 KB of source; the shipped chunk holding it is 32 KB minified) —
modest, but it is per-session overhead that today is zero.

## 6. Worker feasibility audit — RNG

Today (`src/engine/route-random.ts`): every draw of the Rota goes through
`routeRandom()`, which is `Math.random()` in normal play and a closure over a
32-bit state (`createSeededDraw`) when the lab launcher armed a seed.
`generateMaze` calls `beginSeededGeneration()` (restarts the armed stream from
the seed), then draws for template, exit, walls, light/trap scoring; the Hunter
(`route-defenders.ts`, `chooseGuardianMove`) and `difficulty.ts` keep drawing
from the **same** stream afterwards. Draws per generation: mean 804, p95 2 971,
max 29 796 (§3) — variable and unbounded in advance.

A Worker is another realm: its own `Math.random`, its own module instance of
`route-random` (nothing armed), so naively moving `generateMaze` there changes
two things: the armed seed never reaches generation, and the main-thread
stream is no longer advanced by generation's draws, so the Hunter's draws
after a seeded generation differ from today's.

| option | behaviour | cost / risk |
| --- | --- | --- |
| A. Worker uses its own RNG | Normal play: distribution-identical (both are uniform `Math.random`; normal play was never reproducible). Seeded diagnostics: **broken** — launcher boards stop being the witnesses, and the post-generation Hunter stream changes. | Small code, but every seeded validator and the launcher's contract ("same board on Launch / Start / Restart", next draws of the shared stream pinned by C2–C6 equivalence) fails. Not behaviour-preserving. |
| B. Explicit seed/state in, final state out | Seeded mode: the seeded state is one uint32, so the Worker can start from `armedSeed` (what `beginSeededGeneration` does) and return the map **plus the final state**; main resumes its closure at that state → the Hunter's stream is exactly today's. Normal play: unseeded `Math.random` state cannot be read or set, but it is not observable either; distribution-identical. | Needs a small contract change in the seam (export a way to resume the seeded stream at a given state, and to hand the Worker the armed seed), and `generateMaze` must run against the Worker's seam instance armed the same way. Behaviour-identical for diagnostics, distribution-identical for play. Moderate. |
| C. Pre-generate draws on main | Needs the draw count in advance — p95 2 971, max 29 796, unbounded through recovery. Over-drawing changes the seeded stream unless the state is re-seeked (= B); under-drawing needs a second round-trip. | Strictly worse than B. |
| D. One request/response per draw | ~800 (p95 ~3 000) synchronous round-trips per generation; needs `Atomics.wait` + `SharedArrayBuffer` (cross-origin isolation headers, COOP/COEP) or async ping-pong at ≥ 0.2–1.7 ms each (§5) ≈ 0.2–5 s per generation. | Infeasible. |
| E. Worker in normal play, synchronous path for seeded diagnostics | Diagnostics stay exactly today's code path. | Two runtimes for the same operation: the validated path (sync, everything C0–C6 proved) is not the path players run (async). Every lifecycle risk of §7 exists only on the untested path. Risky. |

Conclusion: a behaviour-preserving Worker is possible (option B) without
changing the RNG's semantics, but not without changing the seam's contract
(state hand-off) and not without making generation asynchronous everywhere it
is called. The RNG itself is not the obstacle; the asynchrony is.

## 7. Worker feasibility audit — async lifecycle

Generation is called at exactly two sites (`useEscapeMaze.ts`): the
`useReducer` initialiser (mount: fresh entry, continuation, retry remount) and
`startNewMaze` (Start, Restart, mode change). Both currently return a
certified map **in the same task**, and C5/C6 rely on it: `ROUTE_STARTED`
carries the map, one transition gives one coherent state, at most one commit
per input.

| concern | what an async generation forces |
| --- | --- |
| setup state | `createRouteState` needs a map. Either a new "generating" state with no map (route-state shape, reducer, every consumer — `RouteStrategyGame`, `RouteBabylonBoard` cannot mount a scene without walls) or the map is fetched before the session mounts (the game-agnostic shell would have to know about Rota maps). |
| readiness / watchdog | entry readiness is the Babylon ready frame today; it must also wait for the map. The 28 s Rota watchdog has room, but a Worker that fails to load (chunk error, CSP) needs its own error path into `onEntryError`/retry. |
| Strict Mode | the initialiser runs twice in development: two requests, the first must be discarded; effects mount/unmount/mount must cancel and re-request. |
| cancellation / unmount | leaving to Home, browser back, or a retry while a request is in flight: the late response must be ignored (session token), and the Worker terminated or shared. |
| retry | "Tentar novamente" remounts the session: a new token; the old response is stale. |
| difficulty race | mode A then mode B quickly: two requests, responses can arrive out of order; latest-wins by request id, and the board must not show A's map labelled B. |
| Start / Restart | today the status flips in the same frame; with a Worker the button needs a pending state (disabled, spinner, copy), inputs during it (moves, a second Restart, Details, exit) need defined behaviour. |
| continuation | same as mount: the next Route's session must wait for its map. |
| loading UI | new visual state + strings; the "instant" setup → playing transition becomes two commits. |
| test harness | `route-runtime-harness`, `route-react-runtime` and every C1–C6 `[equivalence]` suite drive the hook synchronously and pin "at most one commit per input", generation calls per input and the RNG stream per input; all need an async Worker model (mock channel, awaited responses) and new expected traces. ≥ 10 suites change. |
| lab seeded route | option B (state hand-off) or E (sync path) above. |

Estimated size: route-state (new phase or nullable map), the hook (both call
sites + request tokens + cancellation), the Rota component (pending UI), the
board (no-map state), the entry readiness, the RNG seam (state hand-off), a
Worker module + Turbopack worker wiring, and the validator suites — realistically
3–4 missions of the C-series size, with the highest regression risk of the
series because it changes the turn's timing model, not just where code lives.

## 8. Measurements 3–5, 7 — production product actions: INVALID for the gate in this environment

The product probe ran against `next start` (production build) at 390×844 with
Long Tasks, Event Timing, first/second rAF, DOM readiness and a CDP CPU profile
per action. `generateMaze` was located in the shipped chunk
(`/_next/static/chunks/2vhdk0gsouaa8.js`, the function holding its unique
error literal, offsets 16255–16747), so generation's share is measured, not
guessed.

### Why this measurement is invalid (and the rubric is not changed)

The rubric (§1) defined T4 on product actions assuming that the main thread's
cost of an action would be the action's own work. In this container that
assumption does not hold:

1. **The negative control fails.** An ordinary Explorer step — which never
   calls `generateMaze` — takes 2.0 s (1×), 1.6 s (4×) and 2.1 s (6×) to its
   next frame at the median, and every single step produces a Long Task
   (10/10 and 60/60). It is the same order as Start / Restart / mode change.
   The rubric itself says (§1.3, NO-GO list) that the control exists so the
   generation-carrying actions are compared against the same React/Babylon
   work; when the control blocks for seconds, nothing can be attributed to
   generation by difference.
2. **The blocking is WebGL on a software rasterizer.** There is no GPU: every
   GL call goes to SwiftShader. The profile attributes the bulk of each
   action to native WebGL entry points that wait on it synchronously —
   `getProgramParameter` (shader link status), `getUniformBlockIndex`,
   `getExtension`, `uniformMatrix4fv` — e.g. 1×: move 845 ms of 1 095 ms busy,
   restart 3 995 of 4 621, warm entry 12 103 of 16 187. On a device with a GPU
   these calls cost a small fraction of that, so the share generation would have
   there is unknowable from here.
3. **CPU throttling does not even scale it.** CDP throttling slows the main
   thread; SwiftShader runs in the GPU process, unthrottled. The throttled
   numbers are therefore a mix of throttled JS and unthrottled software
   rasterization — not an approximation of any device.
4. **The windows are polluted.** Because the next frame is seconds away, the
   profiled window contains several frames of Babylon's render loop; Babylon JS
   time (e.g. 4× move 707 ms) is not the action's own work either.

Per the user's instruction the full 30-loop runs at 4×/6× were stopped (they
added no information); the 1× run had completed (30 loops, 20 continuations,
3 cold entries, 5 profiled loops), and a short run (5 loops, 2
continuations, 1 cold, 2 profiled loops) was taken at 1×, 4× and 6× to show the
contamination holds at every rate. **T4 is reported as NOT EVALUABLE in this
environment** — neither held nor failed — and the decision rests on T1–T3
(intrinsic browser generation + Long Tasks), transport/memory and the
feasibility audits. The rubric text in §1 is unchanged.

### What was measured anyway (for the record, not for the gate)

Input → next frame (ms, p50 / p95) and generation's share of the profiled busy time:

| action | 1× full run (n) | 1× short | 4× short | 6× short | generation share 1× / 4× / 6× |
| --- | --- | --- | --- | --- | --- |
| mode change | 1354 / 3264 (60) | 1292 / 3650 | 2439 / 4252 | 2502 / 4357 | 1.1–1.4 % / 2.5 % / 3.2 % |
| Start | 1110 / 1166 (30) | 615 / 1151 | 2689 / 2743 | 2669 / 2792 | 0.9–1.5 % / 8.2 % / 2.4 % |
| Restart | 2871 / 4832 (60) | 2525 / 4863 | 2537 / 3913 | 2886 / 4230 | 0.7–1.8 % / 2.0 % / 1.8 % |
| **move (control, no generation)** | **2084 / 2315 (60)** | **2005 / 2220** | **1567 / 3038** | **2089 / 2843** | 0 % |
| warm entry (click → board ready p95) | 12 707 (30) | 12 561 | 20 650 | 24 736 | 0.2–0.4 % / 0.3 % / 0.4 % |
| continuation (click → board ready p95) | 13 357 (20) | 11 891 | 21 593 | 25 009 | 0.2 % / 0.8 % / 0.5 % |
| cold entry (click → board ready) | 11 345 / 11 524 / 10 989 | 12 384 | 19 509–20 299 | 25 681 | — |

Every action at every rate had at least one Long Task (100 %). Mean profiled
milliseconds per action (1× full run): generation 13 (mode), 18 (Start),
35 (Restart), 53 (warm entry), 32 (continuation); Babylon JS 168–2 361; native
WebGL 669–14 133; React 0.6–23. Absolute generation time inside the product
matches the intrinsic distribution (a few tens of ms at 1×, 50–270 ms at 4×),
which is the one product number that is consistent with §4.

Cold vs warm: cold entry (fresh context: chunk download, Babylon import, GLB,
shader compilation) 11–12 s at 1×, ~20 s at 4×, ~26 s at 6×, with one 4.4–8.7 s
long task; warm entry ~12.6 s at 1× — i.e. in this environment warm and cold
entry are both dominated by scene creation and shader compilation on
SwiftShader, not by downloads and not by generation (≤ 0.4 %). No watchdog
retry occurred (the Rota's window is 28 s).

Event Timing `duration` was recorded where Chrome emitted a matching entry
(restart, entry, continuation, some moves); for clicks whose processing was
short and whose paint was delayed by the render loop it often did not, so the
rAF-based next frame is the primary interaction metric.

Product memory: 120 Restarts in one session grew the heap by 2.9 MB (full run)
and 3.7 MB (short run) after forced GC (~24–31 KB per Restart). Generation alone
does not explain it (600 generations: +7 KB, §5); it is the board/scene side and
is noted as a separate observation, not part of this decision.

## 9. Measurements 6 + 8 — `next dev` and Strict Mode (diagnostic only)

`next dev -p 3000`, warm server (first two requests discarded), same probe at 1×,
3 loops + 2 profiled loops. Not used by any gate.

| action (dev, 1×) | next frame p50 / p95 | generation (profiled mean) | share |
| --- | --- | --: | --: |
| mode change | 1393 / 3688 | 37.6 ms | 1.5 % |
| Start | 1472 / 1478 | 30.1 ms | 3.1 % |
| Restart | 2780 / 4577 | 27.5 ms | 1.2 % |
| move (control) | 1514 / 1831 | 0 | 0 % |
| warm entry (ready p95) | 13 439 | 45.8 ms | 0.3 % |

Same picture as production: SwiftShader dominates. In development the Rota's
`useReducer` initialiser runs twice under Strict Mode, so every mount draws two
boards (pinned by `route-state-reducer-tests` on the real react-dom: "Strict
Mode's double initialiser draws two boards on both trees"); the profiler cannot
count calls, so the dev entry's generation time (≈ 46 ms vs ≈ 30 ms in
production) is consistent with, but not proof of, two generations. Production is
what the decision uses.

## 10. Decision matrix

Gate thresholds are §1's, unchanged. Browser intrinsic = generation alone in
the product's Chromium (§4); product rows are §8 and NOT EVALUABLE here.

| metric | 1× | 4× | 6× | gate | result |
| --- | --: | --: | --: | --- | --- |
| generation p95, pooled (browser intrinsic) | 119.0 ms | **560.6 ms** | **844.7 ms** | T1 > 100 ms @4× · T2 > 200 ms @6× | **T1 HOLDS** (3/3 reps: 528/583/578) · **T2 HOLDS** (3/3: 800/870/863) |
| generation p99 / max (browser intrinsic) | 204 / 554 ms | 960 / 2 574 ms | 1 443 / 3 815 ms | not gated (outliers) | heavy tail, single seeds |
| generations > 50 ms (= Long Task entries) | 20.1 % | **73.4 %** | 95.9 % | T3 ≥ 10 % @4× | **T3 HOLDS** (3/3: 72.9/73.3/74.1 %) |
| generation p95 / p99 / max (Node, native) | 137 / 252 / 1 144 ms | — | — | context | — |
| Start next frame p95 | 1 166 ms | 2 743 ms | 2 792 ms | T4 (with share ≥ 50 %) | NOT EVALUABLE (share 0.9–8 %, control invalid) |
| Restart next frame p95 | 4 832 ms | 3 913 ms | 4 230 ms | T4 | NOT EVALUABLE |
| mode change next frame p95 | 3 264 ms | 4 252 ms | 4 357 ms | T4 | NOT EVALUABLE |
| normal move control (no generation) next frame p50 / p95 | 2 084 / 2 315 ms | 1 567 / 3 038 ms | 2 089 / 2 843 ms | must be small for T4 to mean anything | **FAILS** → product timing invalid |
| clone / transport of a MazeMap (echo p95; receive p95) | 0.2 ms; 0.1 ms | 0.9 ms; 0.5 ms | 1.7 ms; 1.1 ms | cost side | negligible; `Set` survives |
| heap: 600 generations / per retained map | +7 KB / 1.7 KB | — | — | cost side | negligible |
| cold entry (click → board ready) | 11.0–12.4 s | 19.5–20.3 s | 25.7 s | reported apart, never decides | SwiftShader/scene-bound; generation ≤ 0.4 % |

Borderline band (§1.4): no gated metric is near its threshold — T1 is 5.6× its
threshold, T2 4.2×, T3 7.3×.

## 11. Attribution in one paragraph

Generation alone, in this Chromium, costs p50 21 ms / p95 119 ms at 1× and
p50 97 ms / p95 561 ms at 4×, every generation over 50 ms is a Long Task, and
the cost is driven by how many candidates the random phase builds (≈ 4 ms each
on this CPU; ρ = 0.93), worst on Aberto (easy) and on Routes 2–3. Inside the
product the same generation is present at the same size, but in this container
it sits in tasks that are 1–5 s long because of native WebGL on SwiftShader and
Babylon's scene work; how large a share it would be on a device with a GPU is
UNKNOWN from here. Download/compilation (cold) and the Babylon/GLB/shader
readiness (warm and cold entry) dominate entry by two orders of magnitude.

## 12. Decision

**DECISION: C7_GO**

Why, against the rubric registered before measuring (§1, commit `a974f97`):

- T1, T2 and T3 each hold, consistently (3 of 3 repetitions), and far from the
  borderline band. Any one of them suffices; T4 could not be evaluated in this
  environment and is neither for nor against (§8).
- The Long Task API confirms the mechanism directly: every generation over
  50 ms is its own main-thread long task — 20 % of generations already at 1× on
  a desktop-class core, 73 % at 4×, 96 % at 6×, with a tail of seconds.
  Generation is the only part of Start / Restart / mode change / entry that is
  pure CPU, GPU-independent and unbounded in advance (attempts p95 39, max 371),
  so unlike the WebGL figures it does not shrink on better graphics hardware.

Why it is worth the complexity:

- The thing to move is already isolated: since C2 `generateMaze` lives in a
  module whose run-time closure is five files with no React, Babylon or DOM (the
  probe ran it unchanged in a Blob Worker).
- Transport is free in practice: < 1 KB per map, ≤ 1.7 ms round trip even at 6×,
  `Set<string>` survives `postMessage` in Chrome 141; heap cost is negligible.
- The RNG is not a blocker: option B (seeded state in, final state out)
  preserves seeded diagnostics byte for byte and keeps normal play
  distribution-identical (§6).

What GO does NOT claim, and how C7 must be scoped:

- It removes generation's long tasks (tens of ms at 1×, hundreds at 4×); it does
  not make Start / Restart / mode change instant, because the same task also
  rebuilds the Babylon board synchronously. How much remains on a real GPU is
  not measurable here; that is a separate question for the board, not for C7.
- The cost is the asynchrony, not the Worker: §7 lists what changes (setup
  state, readiness, Strict Mode, cancellation, retry, races, continuation,
  loading UI, ≥ 10 validator suites). Recommended shape: option B for the RNG
  (never A — it breaks seeded diagnostics; avoid E — the validated path would not
  be the played path), one async generation state machine with request tokens
  and latest-wins, staged as several C-sized missions (seam state hand-off with
  generation still synchronous → async generation in the hook with a
  synchronous adapter → the Worker adapter and its wiring → validators).
- A real-device run (Android mid/low-end and an iPhone, production build,
  hardware WebGL) is still recommended before implementation to size the
  user-visible gain and to give the product timing (T4) a valid environment; it
  is not required by the rubric for this decision, since T1–T3 hold by a wide
  margin.

What would reopen the decision (toward NO-GO): a change that makes generation
cheap enough that browser-intrinsic p95 at 4× falls below 100 ms and the
> 50 ms share below 10 % — e.g. a generator that wastes far fewer candidates on
Aberto and Routes 2–3. Such a change alters maps and the RNG stream (a gameplay
change), so it is outside this mission; if it is ever made, re-run
`route-worker-browser-probe.mjs --phase intrinsic` before starting C7.

## 13. Reproduce

```bash
node tools/validation/route-generation-performance-gate.mjs [--out FILE]                # ~17 min
node tools/validation/route-worker-browser-probe.mjs --phase intrinsic [--out FILE]      # ~16 min
next build && next start -p 3100
node tools/validation/route-worker-browser-probe.mjs --phase product --loops 5 --continuations 2 --cold 1 --profile-loops 2 [--out FILE]
```

Run nothing else at the same time. On a machine with a real GPU the product
phase becomes meaningful; that is the run §12 recommends.

## 14. Validations (product untouched)

`git diff e384d76 -- src` is empty: no product source changed. Run after all
measurements, sequentially, nothing else running:

| check | result |
| --- | --- |
| `npm run lint` | exit 0 |
| `npx tsc --noEmit` | exit 0 |
| `next build` | exit 0 |
| `git diff --check` | clean |
| `route-validation-coupling-gate` | exit 0 (the new tools name no Rota file) |
| `route-module-loader-tests` | 23/23 (a first run failed only H1 "loader writes nothing" because the report was being edited during it; re-run on a still worktree: 23/23) |
| `route-generation-performance-gate` (30 × 9 quick) | exit 0 — no throw, probes neutral, sandbox = native |
| `route-domain-events-tests` | 35/35 |
| `route-state-reducer-tests` | 42/42 |
| `route-generation-extraction-tests` | 21/21 |
| DEEP `final-acceptance` | exit 0, evidence MATCHES (its FASE 6 timing is run metadata) |
| CORE `validation-hygiene-tests` | CORE_BATTERY_PASSED, immutability: 0 created / 0 deleted / 0 changed, git status identical |

No gameplay evidence was updated; every performance figure here is run
metadata. `AGENTS.md`, rewritten by `next dev`, was restored and not committed.
