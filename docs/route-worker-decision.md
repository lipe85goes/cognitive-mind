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
