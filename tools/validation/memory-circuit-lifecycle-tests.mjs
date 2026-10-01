/**
 * MEMORY-CIRCUIT-LIFECYCLE-01 — ownership of the Circuito de Memória's async work.
 *
 * `useColorSequenceGame` is a state machine whose transitions are mostly
 * DEFERRED: the playback walks the sequence on timeouts, a mistake resolves 750
 * ms later, a cleared round advances 700 ms later. Every one of those deferred
 * continuations has to belong to something, or it outlives the thing that
 * scheduled it. The audit found five ways it did:
 *
 *   1. the result emitted twice after the third mistake (Encerrar inside the
 *      750 ms window, then the window itself);
 *   2. leaving for Home inside that window still emitted a result afterwards;
 *   3. Recomeçar inside a mistake window replayed the OLD sequence over the new;
 *   4. Recomeçar after a cleared round let the old 700 ms callback advance the
 *      level of the new session;
 *   5. the playback kept stepping after the game unmounted.
 *
 * Each is a statement about time and ownership, so each is reproduced here by
 * running the REAL hook — compiled from source, unmodified — under:
 *
 *   - a virtual clock: `window.setTimeout`/`clearTimeout` are replaced, time only
 *     moves when a test advances it, and every requested duration is recorded;
 *   - a small React: ordered hook cells, memoised callbacks, effects with
 *     cleanups, a real unmount (and StrictMode's dev double-invoke on demand).
 *     A state update after unmount is RECORDED, not silently dropped the way
 *     React drops it — that is precisely the evidence of a callback that ran
 *     without an owner;
 *   - the product's own reaction to the hook: `app/page.tsx` answers
 *     `onComplete` with `setView("result")` and `onExit` with `setView("home")`,
 *     and both unmount the game. `app: false` keeps the game mounted instead, to
 *     show the hook defends itself without relying on its parent.
 *
 * Alongside the five repro cases, the normal flow is pinned to the millisecond
 * (SHOW_MS, GAP_MS, TAP_FLASH_MS, 750 ms, 700 ms), and the emitted result is
 * checked field by field against the real scoring function.
 *
 * Usage: node tools/validation/memory-circuit-lifecycle-tests.mjs [--rev=<commit>]
 *
 *   --rev=<commit>  run against the hook and scoring as they were at <commit>
 *                   (read with `git show`, nothing is checked out or written).
 *                   `--rev=61c3b04` reproduces the audit: cases 1–5 fail.
 *
 * Writes nothing. Exit 0 = every contract holds, 1 = a contract is broken,
 * 3 = usage error.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";

const HOOK = "src/games/color-sequence/useColorSequenceGame.ts";
const SCORING = "src/engine/scoring.ts";

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
if (args.some((arg) => arg !== revArg) || REV === "") {
  console.error(
    "usage: node tools/validation/memory-circuit-lifecycle-tests.mjs [--rev=<commit>]",
  );
  process.exit(EXIT_USAGE);
}

const readSource = (file) =>
  REV
    ? execFileSync("git", ["show", `${REV}:${file}`], { encoding: "utf8" })
    : fs.readFileSync(path.resolve(file), "utf8");

const compile = (file) =>
  ts.transpileModule(readSource(file), {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: file,
  }).outputText;

const HOOK_JS = compile(HOOK);
const SCORING_JS = compile(SCORING);

function evaluate(js, globals, resolve) {
  const mod = { exports: {} };
  const sandbox = {
    module: mod,
    exports: mod.exports,
    console,
    require: (specifier) => {
      const found = resolve(specifier);
      if (!found) throw new Error(`unexpected import ${specifier}`);
      return found;
    },
    ...globals,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  new vm.Script(js).runInContext(sandbox);
  return mod.exports;
}

const SCORING_MODULE = evaluate(SCORING_JS, {}, () => null);
const { calculateColorSequenceScore, COLOR_SEQUENCE_MAX_ERRORS } = SCORING_MODULE;

/** mulberry32 — the sequence colours are drawn from `Math.random`. */
function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Let every queued microtask run — an `await` continuation included. */
const flushMicrotasks = () => new Promise((resolve) => setImmediate(resolve));

// --- virtual clock ----------------------------------------------------------

function createClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  /** Every duration the hook asked for, in order. */
  const requested = [];
  return {
    get now() {
      return now;
    },
    get pending() {
      return timers.size;
    },
    requested,
    setTimeout(fn, ms = 0) {
      const id = nextId++;
      timers.set(id, { at: now + ms, fn });
      requested.push(ms);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    /** The earliest timer due at or before `limit`; ties fire in scheduling order. */
    nextDue(limit) {
      let best = null;
      for (const [id, timer] of timers) {
        if (timer.at > limit) continue;
        if (!best || timer.at < best.timer.at) best = { id, timer };
      }
      return best;
    },
    fire({ id, timer }) {
      timers.delete(id);
      now = timer.at;
      timer.fn();
    },
    moveTo(time) {
      now = time;
    },
  };
}

// --- a small React ----------------------------------------------------------

const sameDeps = (a, b) =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length === b.length &&
  a.every((value, i) => Object.is(value, b[i]));

function createReactShim(store, onLateSetState) {
  const shim = {
    useState(initial) {
      const i = store.index++;
      if (!(i in store.cells)) {
        store.cells[i] = {
          value: typeof initial === "function" ? initial() : initial,
        };
      }
      const cell = store.cells[i];
      const setter =
        cell.setter ??
        (cell.setter = (next) => {
          if (!store.mounted) {
            onLateSetState(i);
            return;
          }
          cell.value = typeof next === "function" ? next(cell.value) : next;
          store.dirty = true;
        });
      return [cell.value, setter];
    },
    useRef(initial) {
      const i = store.index++;
      if (!(i in store.cells)) store.cells[i] = { current: initial };
      return store.cells[i];
    },
    useMemo(factory, deps) {
      const i = store.index++;
      const cell = store.cells[i];
      if (cell && sameDeps(cell.deps, deps)) return cell.value;
      const value = factory();
      store.cells[i] = { value, deps };
      return value;
    },
    useCallback(fn, deps) {
      return shim.useMemo(() => fn, deps);
    },
    useEffect(effect, deps) {
      const i = store.index++;
      const cell = store.cells[i] ?? (store.cells[i] = { effect: true });
      if (cell.deps === undefined || !sameDeps(cell.deps, deps)) {
        store.pendingEffects.push({ cell, effect, deps });
      }
    },
  };
  shim.useLayoutEffect = shim.useEffect;
  return shim;
}

// --- one mounted game ---------------------------------------------------------

/**
 * Mount the real hook. `app: true` models `app/page.tsx`: a result switches the
 * view, which unmounts the game. `strict: true` adds StrictMode's dev
 * mount → unmount → mount of every effect.
 */
function mount({ seed = 1, app = true, strict = false } = {}) {
  const clock = createClock();
  const store = {
    cells: [],
    index: 0,
    dirty: false,
    mounted: true,
    pendingEffects: [],
  };
  const log = {
    completions: [],
    tones: [],
    lateSetState: [],
    unmountedAt: null,
    pendingAtUnmount: null,
  };

  const react = createReactShim(store, (cell) =>
    log.lateSetState.push({ at: clock.now, cell }),
  );
  const seededMath = Object.create(Math);
  seededMath.random = seededRandom(seed);

  const hookModule = evaluate(
    HOOK_JS,
    {
      Math: seededMath,
      window: {
        setTimeout: (fn, ms) => clock.setTimeout(fn, ms),
        clearTimeout: (id) => clock.clearTimeout(id),
      },
    },
    (specifier) => {
      if (specifier === "react") return react;
      if (specifier === "@/engine/scoring") return SCORING_MODULE;
      if (specifier === "@/lib/game-sounds") {
        return {
          playColorTone: (id) =>
            log.tones.push({ at: clock.now, id, mounted: store.mounted }),
          playSuccessChime: () => {},
          playGentleErrorTone: () => {},
        };
      }
      return null;
    },
  );
  const useColorSequenceGame = hookModule.useColorSequenceGame;
  if (typeof useColorSequenceGame !== "function") {
    throw new Error("useColorSequenceGame is not exported: the hook's shape changed.");
  }

  const onComplete = (result) =>
    log.completions.push({ at: clock.now, mounted: store.mounted, result });
  // Named like a component on purpose: this is the one place the game renders.
  const CircuitHarness = () => useColorSequenceGame(onComplete);

  let game = null;

  const commitEffects = () => {
    const effects = store.pendingEffects.splice(0);
    for (const { cell } of effects) {
      if (typeof cell.cleanup === "function") cell.cleanup();
      cell.cleanup = undefined;
    }
    for (const { cell, effect, deps } of effects) {
      cell.run = effect;
      cell.deps = deps;
      cell.cleanup = effect();
    }
  };

  const render = () => {
    let guard = 0;
    do {
      store.index = 0;
      store.dirty = false;
      game = CircuitHarness();
      commitEffects();
    } while (store.dirty && (guard += 1) < 16);
  };

  const effectCells = () => store.cells.filter((cell) => cell && cell.effect);

  const unmount = () => {
    if (!store.mounted) return;
    store.mounted = false;
    for (const cell of effectCells()) {
      if (typeof cell.cleanup === "function") cell.cleanup();
      cell.cleanup = undefined;
    }
    log.unmountedAt = clock.now;
    log.pendingAtUnmount = clock.pending;
  };

  /** Everything that happens after a handler or a timer: microtasks, render, parent. */
  const settle = async () => {
    await flushMicrotasks();
    if (!store.mounted) return;
    render();
    // page.tsx#handleGameComplete → setView("result"): the game unmounts.
    if (app && log.completions.some((c) => c.mounted)) unmount();
  };

  render();
  if (strict) {
    for (const cell of effectCells()) {
      if (typeof cell.cleanup === "function") cell.cleanup();
    }
    for (const cell of effectCells()) cell.cleanup = cell.run();
  }

  return {
    get state() {
      return game;
    },
    get mounted() {
      return store.mounted;
    },
    clock,
    log,
    async act(fn) {
      if (!store.mounted) throw new Error("act() on an unmounted game");
      fn(game);
      await settle();
    },
    /** page.tsx#returnHome → setView("home"): the game unmounts. */
    exit: unmount,
    async advance(ms) {
      const target = clock.now + ms;
      for (;;) {
        const due = clock.nextDue(target);
        if (!due) break;
        clock.fire(due);
        await settle();
      }
      clock.moveTo(target);
    },
    async advanceUntil(predicate, cap = 60_000) {
      const limit = clock.now + cap;
      while (!predicate(game)) {
        const due = clock.nextDue(limit);
        if (!due) throw new Error(`condition not reached by t=${limit}`);
        clock.fire(due);
        await settle();
      }
      return clock.now;
    },
    /** Tones that sounded at or after `time`, as colour ids. */
    tonesSince(time) {
      return log.tones.filter((tone) => tone.at >= time).map((tone) => tone.id);
    },
    lateActivity() {
      return {
        lateSetState: log.lateSetState.length,
        lateTones: log.tones.filter((tone) => !tone.mounted).length,
        lateCompletions: log.completions.filter((c) => !c.mounted).length,
      };
    },
  };
}

// --- player moves -------------------------------------------------------------

const inputReady = (g) => g.phase === "input" && g.canTap;
const waitForInput = (run) => run.advanceUntil(inputReady);
const tapCorrect = (run) =>
  run.act((g) => g.handleColorPress(g.sequence[g.inputIndex]));
const tapWrong = (run) =>
  run.act((g) => g.handleColorPress((g.sequence[g.inputIndex] + 1) % 4));

/** Repeat the whole sequence; leaves the game in `round-complete`. */
async function clearRound(run) {
  await waitForInput(run);
  const length = run.state.sequence.length;
  for (let i = 0; i < length; i += 1) await tapCorrect(run);
}

/** Clear rounds until `level` is on screen (its playback has just started). */
async function reachLevel(run, level) {
  while (run.state.level < level) {
    await clearRound(run);
    await run.advance(700);
  }
}

/** Make `count` mistakes; the last one leaves its 750 ms window open. Returns its time. */
async function makeMistakes(run, count) {
  let at = null;
  for (let i = 0; i < count; i += 1) {
    await waitForInput(run);
    at = run.clock.now;
    await tapWrong(run);
  }
  return at;
}

const expectedResult = (stats) => ({
  activityId: "color-sequence",
  activityTitle: "Circuito de Memória",
  gameId: "color-sequence",
  score: calculateColorSequenceScore(stats),
  summary:
    stats.level > 1
      ? `Circuito ativado! Você chegou à etapa ${stats.level}.`
      : "Boa tentativa! Observe o circuito com calma e tente novamente.",
  details: {
    level: stats.level,
    sequenceLength: stats.sequenceLength,
    errors: stats.errors,
    maxErrors: COLOR_SEQUENCE_MAX_ERRORS,
  },
});

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const seq = (g) => [...g.sequence];

// --- report -------------------------------------------------------------------

const tests = [];
const record = (id, name, pass, detail) => {
  tests.push({ id, name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${name}`);
  for (const [key, value] of Object.entries(detail)) {
    console.log(
      `        ${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`,
    );
  }
};

const unhandled = [];
process.on("unhandledRejection", (reason) => unhandled.push(String(reason)));

console.log(`source: ${REV ? `git ${REV}` : "working tree"} · ${HOOK}\n`);

// =============================================================================
// The five audit cases
// =============================================================================

// 1 — the result is emitted exactly once after the third mistake, even when
//     Encerrar is pressed inside the 750 ms window.
{
  const outcomes = {};
  for (const app of [true, false]) {
    const run = mount({ seed: 101, app });
    await run.act((g) => g.beginGame());
    const thirdMistakeAt = await makeMistakes(run, 3);
    await run.advance(300);
    await run.act((g) => g.endSession());
    await run.advance(10_000);
    outcomes[app ? "app" : "hookOnly"] = {
      thirdMistakeAt,
      completions: run.log.completions.map((c) => c.at),
      ...run.lateActivity(),
      pendingTimers: run.clock.pending,
    };
  }
  const pass = Object.values(outcomes).every(
    (o) =>
      o.completions.length === 1 &&
      o.lateSetState === 0 &&
      o.lateCompletions === 0 &&
      o.pendingTimers === 0,
  );
  record("1", "ONE_RESULT_AFTER_THIRD_MISTAKE", pass, outcomes);
}

// 2 — leaving for Home inside a mistake window emits nothing afterwards.
{
  const outcomes = {};
  for (const mistakes of [3, 1]) {
    const run = mount({ seed: 202 });
    await run.act((g) => g.beginGame());
    await makeMistakes(run, mistakes);
    await run.advance(300);
    run.exit();
    await run.advance(10_000);
    outcomes[`exitAfterMistake${mistakes}`] = {
      completions: run.log.completions.length,
      pendingAtExit: run.log.pendingAtUnmount,
      ...run.lateActivity(),
    };
  }
  const pass = Object.values(outcomes).every(
    (o) =>
      o.completions === 0 &&
      o.pendingAtExit === 0 &&
      o.lateSetState === 0 &&
      o.lateTones === 0,
  );
  record("2", "EXIT_INSIDE_MISTAKE_WINDOW_IS_FINAL", pass, outcomes);
}

// 3 — Recomeçar inside a mistake window never brings the old sequence back.
{
  const run = mount({ seed: 303 });
  await run.act((g) => g.beginGame());
  await reachLevel(run, 2);
  await makeMistakes(run, 1);
  const oldSequence = seq(run.state);
  await run.advance(300);
  const restartAt = run.clock.now;
  await run.act((g) => g.restartSession());
  const newSequence = seq(run.state);
  const inputAt = await waitForInput(run);
  await run.advance(10_000);
  const g = run.state;
  const outcome = {
    oldSequence,
    newSequence,
    tonesAfterRestart: run.tonesSince(restartAt),
    inputReadyAfter: inputAt - restartAt,
    state: { level: g.level, errors: g.errors, phase: g.phase, sequence: seq(g) },
    completions: run.log.completions.length,
  };
  const pass =
    same(outcome.tonesAfterRestart, newSequence) &&
    outcome.inputReadyAfter === 1250 &&
    same(outcome.state, { level: 1, errors: 0, phase: "input", sequence: newSequence }) &&
    outcome.completions === 0;
  record("3", "RESTART_IN_MISTAKE_WINDOW_DROPS_OLD_SEQUENCE", pass, outcome);
}

// 4 — Recomeçar after a cleared round: the old 700 ms callback never advances
//     the new session.
{
  const run = mount({ seed: 404 });
  await run.act((g) => g.beginGame());
  await clearRound(run);
  const phaseBeforeRestart = run.state.phase;
  await run.advance(300);
  const restartAt = run.clock.now;
  await run.act((g) => g.restartSession());
  const newSequence = seq(run.state);
  await run.advance(10_000);
  const g = run.state;
  const outcome = {
    phaseBeforeRestart,
    newSequence,
    tonesAfterRestart: run.tonesSince(restartAt),
    state: { level: g.level, errors: g.errors, phase: g.phase, sequence: seq(g) },
  };
  const pass =
    phaseBeforeRestart === "round-complete" &&
    same(outcome.tonesAfterRestart, newSequence) &&
    same(outcome.state, { level: 1, errors: 0, phase: "input", sequence: newSequence });
  record("4", "RESTART_AFTER_ROUND_COMPLETE_KEEPS_LEVEL_1", pass, outcome);
}

// 5 — the playback stops with the game.
{
  const run = mount({ seed: 505 });
  await run.act((g) => g.beginGame());
  await reachLevel(run, 3);
  await run.advance(900); // first signal shown, now in its gap
  const shownBeforeExit = run.state.showStep;
  run.exit();
  await run.advance(20_000);
  const outcome = {
    sequenceLength: run.state.sequence.length,
    shownBeforeExit,
    pendingAtUnmount: run.log.pendingAtUnmount,
    ...run.lateActivity(),
  };
  const pass =
    outcome.sequenceLength === 3 &&
    shownBeforeExit === 1 &&
    outcome.pendingAtUnmount === 0 &&
    outcome.lateSetState === 0 &&
    outcome.lateTones === 0;
  record("5", "PLAYBACK_STOPS_ON_UNMOUNT", pass, outcome);
}

// =============================================================================
// The normal flow — timings, messages, scoring — must not move
// =============================================================================

// N1 — a clean round, to the millisecond.
async function normalRoundTimeline({ strict = false } = {}) {
  const run = mount({ seed: 606, strict });
  await run.act((g) => g.beginGame());
  const firstInput = await waitForInput(run);
  const inputMessage = run.state.statusMessage;
  const tapAt = run.clock.now;
  await tapCorrect(run);
  const afterTap = {
    phase: run.state.phase,
    statusMessage: run.state.statusMessage,
    statusVariant: run.state.statusVariant,
  };
  await run.advance(279);
  const flashAt279 = run.state.activeColor !== null;
  await run.advance(1);
  const flashAt280 = run.state.activeColor !== null;
  await run.advance(419); // tap + 699
  const levelAt699 = run.state.level;
  await run.advance(1); // tap + 700
  const levelAt700 = run.state.level;
  const secondInput = await waitForInput(run);
  return {
    run,
    timeline: {
      firstInput,
      inputMessage,
      afterTap,
      flashAt279,
      flashAt280,
      levelAt699,
      levelAt700,
      secondInputAfterTap: secondInput - tapAt,
      tones: run.log.tones.map((tone) => tone.at),
      requested: run.clock.requested,
    },
  };
}

const EXPECTED_TIMELINE = {
  firstInput: 1250,
  inputMessage: "Agora repita — 1 sinais",
  afterTap: {
    phase: "round-complete",
    statusMessage: "Circuito ativado!",
    statusVariant: "success",
  },
  flashAt279: true,
  flashAt280: false,
  levelAt699: 1,
  levelAt700: 2,
  secondInputAfterTap: 700 + 2 * 1250,
  // playback of level 1, the player's own correct tap, playback of level 2
  tones: [0, 1250, 1950, 3200],
  requested: [850, 400, 280, 700, 850, 400, 850, 400],
};

{
  const { timeline } = await normalRoundTimeline();
  record("N1", "NORMAL_ROUND_TIMELINE", same(timeline, EXPECTED_TIMELINE), timeline);
}

// N2 — a mistake that is not the last: flash, window, replay, to the millisecond.
{
  const run = mount({ seed: 707 });
  await run.act((g) => g.beginGame());
  const sequenceBefore = seq(run.state);
  const mistakeAt = await makeMistakes(run, 1);
  const during = {
    errors: run.state.errors,
    statusMessage: run.state.statusMessage,
    statusVariant: run.state.statusVariant,
    shakeToken: run.state.shakeToken,
  };
  await run.advance(280);
  const flashClearedAt280 = run.state.activeColor === null;
  await run.advance(469); // mistake + 749
  const at749 = { phase: run.state.phase, roundMessage: run.state.roundMessage };
  await run.advance(1); // mistake + 750
  const at750 = { phase: run.state.phase, roundMessage: run.state.roundMessage };
  const replayInput = await waitForInput(run);
  const outcome = {
    during,
    flashClearedAt280,
    at749,
    at750,
    replayTones: run.tonesSince(mistakeAt),
    replayInputAfterMistake: replayInput - mistakeAt,
    sequenceKept: same(seq(run.state), sequenceBefore),
  };
  const pass = same(outcome, {
    during: {
      errors: 1,
      statusMessage: "Tente novamente com calma.",
      statusVariant: "error",
      shakeToken: 1,
    },
    flashClearedAt280: true,
    at749: { phase: "input", roundMessage: "wrong" },
    at750: { phase: "showing", roundMessage: null },
    replayTones: sequenceBefore,
    replayInputAfterMistake: 750 + 1250,
    sequenceKept: true,
  });
  record("N2", "MISTAKE_WINDOW_TIMELINE", pass, outcome);
}

// N3 — the third mistake alone ends the game once, 750 ms later, scored as before.
{
  const run = mount({ seed: 808 });
  await run.act((g) => g.beginGame());
  await reachLevel(run, 2);
  const thirdMistakeAt = await makeMistakes(run, 3);
  await run.advance(10_000);
  const completions = run.log.completions;
  const outcome = {
    completions: completions.map((c) => c.at - thirdMistakeAt),
    result: completions[0]?.result,
    ...run.lateActivity(),
    pendingTimers: run.clock.pending,
  };
  const pass =
    same(outcome.completions, [750]) &&
    same(outcome.result, expectedResult({ level: 2, sequenceLength: 2, errors: 3 })) &&
    outcome.lateSetState === 0 &&
    outcome.lateTones === 0 &&
    outcome.pendingTimers === 0;
  record("N3", "THIRD_MISTAKE_ENDS_ONCE_WITH_SAME_SCORE", pass, outcome);
}

// N4 — Encerrar emits the current stats, once, even if pressed again on a game
//      whose parent keeps it mounted.
{
  const run = mount({ seed: 909, app: false });
  await run.act((g) => g.beginGame());
  await reachLevel(run, 2);
  await waitForInput(run);
  const liveScore = run.state.score;
  await run.act((g) => g.endSession());
  await run.act((g) => g.endSession());
  await run.advance(10_000);
  const outcome = {
    liveScore,
    completions: run.log.completions.length,
    result: run.log.completions[0]?.result,
    tonesAfterEnd: run.log.tones.filter((t) => t.at > run.log.completions[0]?.at).length,
  };
  const expected = expectedResult({ level: 2, sequenceLength: 2, errors: 0 });
  const pass =
    outcome.liveScore === expected.score &&
    outcome.completions === 1 &&
    same(outcome.result, expected) &&
    outcome.tonesAfterEnd === 0;
  record("N4", "END_SESSION_EMITS_ONCE", pass, outcome);
}

// N5 — Encerrar inside the 700 ms round-complete window: one result, and the
//      pending advance never touches the unmounted game.
{
  const run = mount({ seed: 1010 });
  await run.act((g) => g.beginGame());
  await clearRound(run);
  await run.advance(300);
  await run.act((g) => g.endSession());
  await run.advance(10_000);
  const outcome = {
    completions: run.log.completions.length,
    result: run.log.completions[0]?.result,
    pendingAtUnmount: run.log.pendingAtUnmount,
    ...run.lateActivity(),
  };
  const pass =
    outcome.completions === 1 &&
    same(outcome.result, expectedResult({ level: 1, sequenceLength: 1, errors: 0 })) &&
    outcome.pendingAtUnmount === 0 &&
    outcome.lateSetState === 0 &&
    outcome.lateTones === 0;
  record("N5", "END_IN_ROUND_COMPLETE_WINDOW_IS_FINAL", pass, outcome);
}

// N6 — a restarted session is fully playable, on the same clock.
{
  const run = mount({ seed: 1111 });
  await run.act((g) => g.beginGame());
  await clearRound(run);
  await run.advance(300);
  await run.act((g) => g.restartSession());
  const restarted = seq(run.state);
  await clearRound(run);
  const tapAt = run.clock.now;
  await run.advance(699);
  const levelAt699 = run.state.level;
  await run.advance(1);
  const g = run.state;
  const outcome = {
    levelAt699,
    levelAt700: g.level,
    extendsRestarted: same(seq(g).slice(0, restarted.length), restarted),
    sequenceLength: g.sequence.length,
    secondInputAfterTap: (await waitForInput(run)) - tapAt,
  };
  const pass = same(outcome, {
    levelAt699: 1,
    levelAt700: 2,
    extendsRestarted: true,
    sequenceLength: 2,
    secondInputAfterTap: 700 + 2 * 1250,
  });
  record("N6", "RESTARTED_SESSION_PLAYS_NORMALLY", pass, outcome);
}

// N7 — Ativar pressed twice: the second session supersedes the first playback.
{
  const run = mount({ seed: 1212 });
  await run.act((g) => g.beginGame());
  await run.advance(300);
  const secondAt = run.clock.now;
  await run.act((g) => g.beginGame());
  const second = seq(run.state);
  const inputAt = await waitForInput(run);
  const outcome = {
    tonesAfterSecond: run.tonesSince(secondAt),
    second,
    inputAfterSecond: inputAt - secondAt,
  };
  const pass =
    same(outcome.tonesAfterSecond, second) && outcome.inputAfterSecond === 1250;
  record("N7", "BEGIN_SUPERSEDES_PREVIOUS_PLAYBACK", pass, outcome);
}

// N8 — StrictMode's dev effect double-invoke does not disarm the game.
{
  const { timeline } = await normalRoundTimeline({ strict: true });
  record(
    "N8",
    "STRICT_MODE_EFFECTS_KEEP_THE_GAME_ALIVE",
    same(timeline, EXPECTED_TIMELINE),
    timeline,
  );
}

await flushMicrotasks();
const allPass = tests.every((t) => t.pass) && unhandled.length === 0;
console.log(
  `\nunhandled rejections: ${unhandled.length}${unhandled.length ? ` -> ${unhandled.slice(0, 3).join(" | ")}` : ""}`,
);
console.log(
  `${tests.filter((t) => t.pass).length}/${tests.length} passed · failing: ${tests.filter((t) => !t.pass).map((t) => t.id).join(", ") || "none"}`,
);
console.log(allPass ? "MEMORY_CIRCUIT_LIFECYCLE_OK" : "MEMORY_CIRCUIT_LIFECYCLE_FAILED");
process.exitCode = allPass ? EXIT_OK : EXIT_VALIDATION_FAILED;
