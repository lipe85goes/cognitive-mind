/**
 * GAME-ENTRY-WATCHDOG-REGISTRY-01 — the entry watchdog window, owned by the game contract.
 *
 * While a world is "preparing", useWorldEntryController arms a watchdog: if the
 * game never reports that it painted, the Explorador falls over to the
 * retry/back panel instead of waiting forever. The window is 12 s, except for
 * the Rota, which loads a 3D engine and GLBs first and gets 28 s. That
 * exception used to be a hardcoded `"escape-maze"` map inside the controller.
 * It now lives in the metadata-only `src/games/entry-contract.ts`, next to each
 * game's readiness, and the controller reads it from there.
 *
 * This runs the REAL controller, the REAL entry reducer and the REAL entry
 * contract — compiled from source, unmodified — under:
 *
 *   - a virtual clock: `setTimeout` callbacks only run when a test advances
 *     time, and every arm (with its delay) and cancellation is recorded;
 *   - a controllable `document.visibilityState`;
 *   - a small React: ordered hook cells, reducer bail-out, passive effects with
 *     deps and cleanups, a real unmount.
 *
 * B* pins what every game did before the contract owned the window (observable
 * behaviour: when the error panel appears, how the timer re-arms). C* asserts
 * the contract itself, the controller's import closure and the absence of
 * import cycles in src/.
 *
 * Usage: node tools/validation/game-entry-watchdog-registry-tests.mjs [--rev=<commit>]
 *
 *   --rev=<commit>  run against the controller, the reducer, the contract and
 *                   src/ as they were at <commit> (read with `git show`, nothing
 *                   is checked out or written). `--rev=93ed0f1` is the code
 *                   before this mission: every B* check passes, C1–C3 fail
 *                   (C4–C5 held there too: the old controller imported no game,
 *                   it named one instead).
 *
 * Writes nothing. Exit 0 = every check holds, 1 = a check failed, 3 = usage error.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";

const CONTROLLER = "src/components/world-entry/useWorldEntryController.ts";
const ENTRY_TYPES = "src/components/world-entry/worldEntryTypes.ts";
const ENTRY_CONTRACT = "src/games/entry-contract.ts";
const REGISTRY = "src/games/index.ts";

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
if (args.some((arg) => arg !== revArg) || REV === "") {
  console.error(
    "usage: node tools/validation/game-entry-watchdog-registry-tests.mjs [--rev=<commit>]",
  );
  process.exit(EXIT_USAGE);
}

const sources = new Map();
/** Source at the requested revision, or null when the file does not exist there. */
function readSource(file) {
  if (!sources.has(file)) {
    let source = null;
    try {
      source = REV
        ? execFileSync("git", ["show", `${REV}:${file}`], {
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"],
          })
        : fs.readFileSync(path.resolve(file), "utf8");
    } catch {
      // absent at this revision
    }
    sources.set(file, source);
  }
  return sources.get(file);
}

const compile = (file) =>
  ts.transpileModule(readSource(file), {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: file,
  }).outputText;

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

const codeOnly = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

/** Key-order-insensitive structural equality. */
const canonical = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v,
  );
const same = (a, b) => canonical(a) === canonical(b);

// --- what the watchdog did before the contract owned it (93ed0f1) -------------------

const DEFAULT_WINDOW_MS = 12_000;
/** Effective "preparing" window per game, in ms. */
const PINNED = {
  "color-sequence": 12_000,
  "escape-maze": 28_000,
  "security-panel": 12_000,
  "number-trail": 12_000,
  "seed-garden": 12_000,
};
const WATCHDOG_MESSAGE =
  "World entry readiness was not reported within the watchdog window.";

const ENTRY_TYPES_MODULE = evaluate(compile(ENTRY_TYPES), {}, () => null);
const CONTRACT_SOURCE = readSource(ENTRY_CONTRACT);
/** Metadata only: the contract must load with nothing else available. */
let CONTRACT_MODULE = null;
let CONTRACT_LOAD_ERROR = null;
if (CONTRACT_SOURCE) {
  try {
    CONTRACT_MODULE = evaluate(compile(ENTRY_CONTRACT), {}, () => null);
  } catch (error) {
    CONTRACT_LOAD_ERROR = error.message;
  }
}
const DECLARED = CONTRACT_MODULE?.GAME_ENTRY_CONTRACTS ?? null;
const CONTROLLER_SOURCE = readSource(CONTROLLER);
const CONTROLLER_JS = compile(CONTROLLER);

// --- virtual clock --------------------------------------------------------------------

function createClock() {
  let now = 0;
  let nextId = 1;
  const timers = new Map();
  const log = { arms: [], cleared: 0 };
  return {
    log,
    get now() {
      return now;
    },
    get pending() {
      return timers.size;
    },
    /** When the earliest pending timer is due, or null. */
    get nextAt() {
      let next = null;
      for (const timer of timers.values()) if (next === null || timer.at < next) next = timer.at;
      return next;
    },
    setTimeout(fn, delay) {
      const id = nextId++;
      timers.set(id, { at: now + delay, fn });
      log.arms.push({ at: now, delay });
      return id;
    },
    clearTimeout(id) {
      if (timers.delete(id)) log.cleared += 1;
    },
    /** Runs due timers in order; `afterEach` lets React settle between them. */
    advance(ms, afterEach) {
      const end = now + ms;
      for (;;) {
        let due = null;
        for (const [id, timer] of timers) {
          if (timer.at <= end && (!due || timer.at < due[1].at)) due = [id, timer];
        }
        if (!due) break;
        timers.delete(due[0]);
        now = due[1].at;
        due[1].fn();
        afterEach();
      }
      now = end;
    },
  };
}

// --- a small React ------------------------------------------------------------------------

const sameDeps = (a, b) =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length === b.length &&
  a.every((value, i) => Object.is(value, b[i]));

function createReactShim(store, onLateDispatch) {
  return {
    useReducer(reducer, initial) {
      const i = store.index++;
      if (!(i in store.cells)) store.cells[i] = { state: initial };
      const cell = store.cells[i];
      cell.reducer = reducer;
      cell.dispatch ??= (action) => {
        if (!store.mounted) {
          onLateDispatch();
          return;
        }
        const next = cell.reducer(cell.state, action);
        if (Object.is(next, cell.state)) return;
        cell.state = next;
        store.dirty = true;
      };
      return [cell.state, cell.dispatch];
    },
    useRef(initial) {
      const i = store.index++;
      if (!(i in store.cells)) store.cells[i] = { current: initial };
      return store.cells[i];
    },
    useCallback(fn, deps) {
      const i = store.index++;
      const cell = store.cells[i];
      if (!cell || !sameDeps(cell.deps, deps)) store.cells[i] = { value: fn, deps };
      return store.cells[i].value;
    },
    useEffect(run, deps) {
      const i = store.index++;
      const cell = store.cells[i] ?? (store.cells[i] = { effect: true });
      if (cell.deps === undefined || !sameDeps(cell.deps, deps)) {
        store.pending.push({ cell, run, deps });
      }
    },
  };
}

// --- one mounted controller ---------------------------------------------------------------

function mount({ contractModule = CONTRACT_MODULE } = {}) {
  const clock = createClock();
  const store = { cells: [], index: 0, dirty: false, mounted: true, pending: [] };
  const log = { lateDispatch: 0 };
  const doc = { visibilityState: "visible" };

  const react = createReactShim(store, () => {
    log.lateDispatch += 1;
  });
  // Renamed: the harness drives the hook as its own host, not as a component.
  const { useWorldEntryController: runController } = evaluate(
    CONTROLLER_JS,
    {
      window: {
        setTimeout: (fn, delay) => clock.setTimeout(fn, delay),
        clearTimeout: (id) => clock.clearTimeout(id),
      },
      document: doc,
    },
    (specifier) =>
      ({
        react,
        "@/components/world-entry/worldEntryTypes": ENTRY_TYPES_MODULE,
        "@/games/entry-contract": contractModule,
      })[specifier] ?? null,
  );

  let api = null;
  const commit = () => {
    const pending = store.pending.splice(0);
    for (const { cell } of pending) {
      if (typeof cell.cleanup === "function") cell.cleanup();
      cell.cleanup = undefined;
    }
    for (const { cell, run, deps } of pending) {
      cell.deps = deps;
      cell.cleanup = run();
    }
  };
  const render = () => {
    let passes = 0;
    do {
      if ((passes += 1) > 16) throw new Error("controller did not settle");
      store.index = 0;
      store.dirty = false;
      api = runController();
      commit();
    } while (store.dirty);
  };
  const settle = () => {
    if (store.mounted && store.dirty) render();
  };
  render();

  return {
    clock,
    log,
    get api() {
      return api;
    },
    get phase() {
      return api.state.phase;
    },
    act(fn) {
      const value = fn(api);
      settle();
      return value;
    },
    advance(ms) {
      clock.advance(ms, settle);
      settle();
    },
    setVisibility(state) {
      doc.visibilityState = state;
    },
    unmount() {
      store.mounted = false;
      for (const cell of store.cells) {
        if (cell?.effect && typeof cell.cleanup === "function") cell.cleanup();
        if (cell) cell.cleanup = undefined;
      }
    },
  };
}

/** Starts `gameId` and lets the cover finish: the watchdog's phase begins here. */
function enterPreparing(entry, gameId) {
  const started = entry.act((api) => api.start(gameId));
  const armsWhileCovering = entry.clock.log.arms.length;
  entry.act((api) => api.covered());
  return { started, armsWhileCovering };
}

/** Advance timer by timer until the error panel shows (or `limit` ms pass). */
function timeToError(entry, limit = 200_000) {
  const from = entry.clock.now;
  while (entry.phase !== "error" && entry.clock.nextAt !== null && entry.clock.nextAt - from <= limit) {
    entry.advance(entry.clock.nextAt - entry.clock.now);
  }
  return entry.phase === "error" ? entry.clock.now - from : null;
}

const armDelaysSince = (entry, index) => entry.clock.log.arms.slice(index).map((arm) => arm.delay);

// --- checks ------------------------------------------------------------------------------------

const tests = [];
const record = (id, name, pass, detail) => {
  tests.push({ id, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${name}`);
  for (const [k, v] of Object.entries(detail)) {
    console.log(`        ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  }
};

/**
 * `body` returns [pass, detail]. A harness that cannot run (a module importing
 * something it must not, say) fails the check with the reason instead of
 * aborting the battery, so the import-graph checks still report.
 */
function check(id, name, body) {
  let result;
  try {
    result = body();
  } catch (error) {
    result = [false, { threw: error.message }];
  }
  record(id, name, ...result);
}

/**
 * Pinned games are held to the pre-contract behaviour. A game added later is
 * held to its own declaration instead, so the battery does not need editing to
 * register one.
 */
const subjects = Object.fromEntries([
  ...Object.entries(PINNED),
  ...Object.entries(DECLARED ?? {})
    .filter(([id]) => !(id in PINNED))
    .map(([id, contract]) => [id, contract.entryWatchdogMs || DEFAULT_WINDOW_MS]),
]);
const subjectIds = Object.keys(subjects);

/** One visible-tab entry that never reports ready. */
function failTrace(gameId, { contractModule } = {}) {
  const entry = mount({ contractModule });
  const { started, armsWhileCovering } = enterPreparing(entry, gameId);
  const armIndex = entry.clock.log.arms.length - 1;
  const failedAfterMs = timeToError(entry);
  return {
    started,
    armsWhileCovering,
    arms: armDelaysSince(entry, armIndex),
    failedAfterMs,
    phase: entry.phase,
    message: entry.api.state.error?.message ?? null,
    pendingAfter: entry.clock.pending,
  };
}
const expectedFail = (windowMs) => ({
  started: true,
  armsWhileCovering: 0,
  arms: [windowMs],
  failedAfterMs: windowMs,
  phase: "error",
  message: WATCHDOG_MESSAGE,
  pendingAfter: 0,
});

// B1 — the error panel appears exactly one window after "preparing" begins, per game.
const windows = {};
check("B1", "WATCHDOG_WINDOW_PER_GAME", () => {
  const rows = subjectIds.map((gameId) => {
    const actual = failTrace(gameId);
    windows[gameId] = actual.failedAfterMs;
    // One millisecond earlier, the entry is still preparing.
    const early = mount();
    enterPreparing(early, gameId);
    early.advance(subjects[gameId] - 1);
    const stillPreparing = early.phase === "preparing";
    return {
      gameId,
      ok: same(actual, expectedFail(subjects[gameId])) && stillPreparing,
      actual,
      stillPreparingOneMsBefore: stillPreparing,
    };
  });
  return [
    rows.every((row) => row.ok),
    {
      failing: rows.filter((row) => !row.ok),
      windowMs: windows,
    },
  ];
});

// B2 — a hidden tab re-arms the same window instead of failing; visible again, it fails on the next one.
check("B2", "HIDDEN_TAB_REARMS_SAME_WINDOW", () => {
  const rows = subjectIds.map((gameId) => {
    const w = subjects[gameId];
    const entry = mount();
    enterPreparing(entry, gameId);
    const armIndex = entry.clock.log.arms.length - 1;
    entry.setVisibility("hidden");
    entry.advance(2 * w);
    const phaseWhileHidden = entry.phase;
    entry.setVisibility("visible");
    entry.advance(w - 1);
    const phaseOneMsBefore = entry.phase;
    entry.advance(1);
    const actual = {
      phaseWhileHidden,
      phaseOneMsBefore,
      phase: entry.phase,
      failedAtMs: entry.clock.now,
      arms: armDelaysSince(entry, armIndex),
      pendingAfter: entry.clock.pending,
    };
    // Hidden then visible again before the window ends: fails on the first window.
    const blink = mount();
    enterPreparing(blink, gameId);
    blink.setVisibility("hidden");
    blink.advance(w - 1);
    blink.setVisibility("visible");
    blink.advance(1);
    const blinkFailedAfterMs = blink.phase === "error" ? blink.clock.now : null;
    const expected = {
      phaseWhileHidden: "preparing",
      phaseOneMsBefore: "preparing",
      phase: "error",
      failedAtMs: 3 * w,
      arms: [w, w, w],
      pendingAfter: 0,
    };
    return {
      gameId,
      ok: same(actual, expected) && blinkFailedAfterMs === w,
      actual,
      blinkFailedAfterMs,
    };
  });
  return [
    rows.every((row) => row.ok),
    {
      failing: rows.filter((row) => !row.ok),
    },
  ];
});

// B3 — retry re-arms the game's window on a new attempt; ready disarms it for good.
check("B3", "RETRY_REARMS_AND_READY_DISARMS", () => {
  const rows = subjectIds.map((gameId) => {
    const w = subjects[gameId];
    const entry = mount();
    enterPreparing(entry, gameId);
    const firstFailAfterMs = timeToError(entry);
    const armIndex = entry.clock.log.arms.length;
    entry.act((api) => api.retry());
    const afterRetry = { phase: entry.phase, attempt: entry.api.state.attempt, error: entry.api.state.error };
    const secondFailAfterMs = timeToError(entry);
    entry.act((api) => api.retry());
    entry.advance(w - 1);
    entry.act((api) => api.markReady());
    const phaseAfterReady = entry.phase;
    const pendingAfterReady = entry.clock.pending;
    entry.advance(10 * w);
    const phaseLongAfterReady = entry.phase;
    entry.act((api) => api.complete());
    const actual = {
      firstFailAfterMs,
      afterRetry,
      secondFailAfterMs,
      retryArms: armDelaysSince(entry, armIndex),
      phaseAfterReady,
      pendingAfterReady,
      phaseLongAfterReady,
      attempt: entry.api.state.attempt,
      phaseAfterComplete: entry.phase,
      isActiveAfterComplete: entry.api.isActive,
    };
    const expected = {
      firstFailAfterMs: w,
      afterRetry: { phase: "preparing", attempt: 2, error: null },
      secondFailAfterMs: w,
      retryArms: [w, w],
      phaseAfterReady: "revealing",
      pendingAfterReady: 0,
      phaseLongAfterReady: "revealing",
      attempt: 3,
      phaseAfterComplete: "complete",
      isActiveAfterComplete: false,
    };
    return { gameId, ok: same(actual, expected), actual };
  });
  return [
    rows.every((row) => row.ok),
    {
      failing: rows.filter((row) => !row.ok),
    },
  ];
});

// B4 — reset clears the timer and the lock; the next entry, of any game, gets its own window.
check("B4", "RESET_CLEARS_AND_NEXT_GAME_USES_ITS_WINDOW", () => {
  const rows = [];
  for (const from of subjectIds) {
    for (const to of subjectIds) {
      const entry = mount();
      enterPreparing(entry, from);
      entry.advance(subjects[from] - 1);
      const lockedStart = entry.act((api) => api.start(to));
      entry.act((api) => api.reset());
      const afterReset = {
        phase: entry.phase,
        gameId: entry.api.state.gameId,
        attempt: entry.api.state.attempt,
        pending: entry.clock.pending,
      };
      entry.advance(2 * subjects[from]);
      const phaseLongAfterReset = entry.phase;
      const armIndex = entry.clock.log.arms.length;
      const { started } = enterPreparing(entry, to);
      const failedAfterMs = timeToError(entry);
      const actual = {
        lockedStart,
        afterReset,
        phaseLongAfterReset,
        started,
        arms: armDelaysSince(entry, armIndex),
        failedAfterMs,
      };
      const expected = {
        lockedStart: false,
        afterReset: { phase: "idle", gameId: null, attempt: 0, pending: 0 },
        phaseLongAfterReset: "idle",
        started: true,
        arms: [subjects[to]],
        failedAfterMs: subjects[to],
      };
      rows.push({ from, to, ok: same(actual, expected), actual });
    }
  }
  return [
    rows.every((row) => row.ok),
    {
      pairs: rows.length,
      failing: rows.filter((row) => !row.ok),
    },
  ];
});

// B5 — one session through every game (complete, then start the next): each uses its own window; unmount leaves nothing behind.
check("B5", "SESSION_ACROSS_GAMES_AND_UNMOUNT", () => {
  const entry = mount();
  const sequence = [];
  for (const gameId of subjectIds) {
    const armIndex = entry.clock.log.arms.length;
    enterPreparing(entry, gameId);
    entry.advance(subjects[gameId] - 1);
    entry.act((api) => api.markReady());
    entry.act((api) => api.complete());
    sequence.push({ gameId, arms: armDelaysSince(entry, armIndex), phase: entry.phase });
  }
  enterPreparing(entry, subjectIds[0]);
  entry.unmount();
  const pendingAfterUnmount = entry.clock.pending;
  entry.advance(200_000);
  const ok =
    sequence.every((row) => same(row, { gameId: row.gameId, arms: [subjects[row.gameId]], phase: "complete" })) &&
    pendingAfterUnmount === 0 &&
    entry.log.lateDispatch === 0;
  return [
    ok,
    {
      sequence: Object.fromEntries(sequence.map((row) => [row.gameId, row.arms])),
      pendingAfterUnmount,
      lateDispatch: entry.log.lateDispatch,
    },
  ];
});

// C1 — the contract declares every game, and its declared windows give the pinned behaviour.
check("C1", "CONTRACT_DECLARES_WATCHDOG", () => {
  const entries = Object.entries(DECLARED ?? {});
  const invalid = entries
    .filter(
      ([, contract]) =>
        contract?.entryWatchdogMs !== undefined &&
        !(Number.isInteger(contract.entryWatchdogMs) && contract.entryWatchdogMs > 0),
    )
    .map(([gameId]) => gameId);
  const drift = Object.entries(PINNED)
    .filter(([gameId, windowMs]) => {
      const contract = DECLARED?.[gameId];
      return !contract || (contract.entryWatchdogMs ?? DEFAULT_WINDOW_MS) !== windowMs;
    })
    .map(([gameId, windowMs]) => ({ gameId, pinned: windowMs, declared: DECLARED?.[gameId] ?? null }));
  return [
    DECLARED !== null && entries.length > 0 && invalid.length === 0 && drift.length === 0,
    {
      contractExport: DECLARED
        ? "GAME_ENTRY_CONTRACTS"
        : CONTRACT_MODULE
          ? `none (exports: ${Object.keys(CONTRACT_MODULE).join(", ")})`
          : CONTRACT_LOAD_ERROR
            ? `${ENTRY_CONTRACT} does not load on its own: ${CONTRACT_LOAD_ERROR}`
            : `${ENTRY_CONTRACT} does not exist`,
      overrides: Object.fromEntries(
        entries.filter(([, c]) => c?.entryWatchdogMs !== undefined).map(([id, c]) => [id, c.entryWatchdogMs]),
      ),
      invalid,
      drift,
    },
  ];
});

// C2 — the controller names no game.
check("C2", "CONTROLLER_NAMES_NO_GAME", () => {
  const code = codeOnly(CONTROLLER_SOURCE);
  const named = subjectIds.filter((gameId) => code.includes(gameId));
  return [
    named.length === 0,
    { named },
  ];
});

// C3 — rewrite the contract: the controller must follow it, not a list of its own.
check("C3", "CONTRACT_DRIVES_WATCHDOG", () => {
  const base = DECLARED ?? Object.fromEntries(subjectIds.map((id) => [id, { readiness: "explicit" }]));
  const variants = {
    // Every game its own distinct window.
    distinct: Object.fromEntries(
      Object.keys(base).map((id, i) => [id, { ...base[id], entryWatchdogMs: 5_000 + 1_000 * i + 7 }]),
    ),
    // Nobody declares one: everybody gets the default, including the Rota.
    none: Object.fromEntries(
      Object.entries(base).map(([id, contract]) => {
        const withoutWindow = { ...contract };
        delete withoutWindow.entryWatchdogMs;
        return [id, withoutWindow];
      }),
    ),
  };
  const rows = [];
  for (const [variant, contracts] of Object.entries(variants)) {
    const contractModule = { ...(CONTRACT_MODULE ?? {}), GAME_ENTRY_CONTRACTS: contracts };
    for (const gameId of Object.keys(contracts)) {
      const actual = failTrace(gameId, { contractModule }).failedAfterMs;
      const expected = contracts[gameId].entryWatchdogMs ?? DEFAULT_WINDOW_MS;
      rows.push({ variant, gameId, ok: actual === expected, actual, expected });
    }
  }
  return [
    rows.length > 0 && rows.every((row) => row.ok),
    {
      failing: rows.filter((row) => !row.ok),
      note: "distinct window per game, then no window anywhere; the controller followed each",
    },
  ];
});

// --- static import graph of src/ ------------------------------------------------------------

function importGraph() {
  const listed = REV
    ? execFileSync("git", ["ls-tree", "-r", "--name-only", REV, "src"], { encoding: "utf8" })
    : execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "src"], {
        encoding: "utf8",
      });
  const files = listed
    .split("\n")
    .filter((file) => /\.(ts|tsx|js|jsx|mjs|mts)$/.test(file) && readSource(file) !== null);
  const known = new Set(files);
  const resolve = (from, specifier) => {
    let base;
    if (specifier.startsWith("@/")) base = `src/${specifier.slice(2)}`;
    else if (specifier.startsWith(".")) base = path.posix.join(path.posix.dirname(from), specifier);
    else return null;
    const suffixes = ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts", "/index.ts", "/index.tsx"];
    return suffixes.map((suffix) => base + suffix).find((candidate) => known.has(candidate)) ?? null;
  };
  /** file -> [{ to, kind: "runtime" | "type" | "dynamic" }] */
  const edges = new Map();
  for (const file of files) {
    const source = ts.createSourceFile(file, readSource(file), ts.ScriptTarget.Latest, true);
    const out = [];
    const add = (specifier, kind) => {
      const to = resolve(file, specifier);
      if (to) out.push({ to, kind });
    };
    const visit = (node) => {
      if (ts.isImportDeclaration(node)) {
        const clause = node.importClause;
        const bindings = clause?.namedBindings;
        const typeOnly =
          clause?.isTypeOnly ||
          (clause &&
            !clause.name &&
            bindings &&
            ts.isNamedImports(bindings) &&
            bindings.elements.length > 0 &&
            bindings.elements.every((element) => element.isTypeOnly));
        add(node.moduleSpecifier.text, typeOnly ? "type" : "runtime");
      } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
        add(node.moduleSpecifier.text, node.isTypeOnly ? "type" : "runtime");
      } else if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        add(node.arguments[0].text, "dynamic");
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    edges.set(file, out);
  }
  return { files, edges };
}

function closure(graph, start, kinds) {
  const seen = new Set([start]);
  const queue = [start];
  while (queue.length > 0) {
    for (const { to, kind } of graph.edges.get(queue.shift()) ?? []) {
      if (kinds.includes(kind) && !seen.has(to)) {
        seen.add(to);
        queue.push(to);
      }
    }
  }
  return [...seen].sort();
}

/** Tarjan: every strongly connected component that is a cycle. */
function cycles(graph, kinds) {
  let counter = 0;
  const index = new Map();
  const low = new Map();
  const stack = [];
  const onStack = new Set();
  const found = [];
  const strong = (file) => {
    index.set(file, counter);
    low.set(file, counter);
    counter += 1;
    stack.push(file);
    onStack.add(file);
    for (const { to, kind } of graph.edges.get(file) ?? []) {
      if (!kinds.includes(kind)) continue;
      if (!index.has(to)) {
        strong(to);
        low.set(file, Math.min(low.get(file), low.get(to)));
      } else if (onStack.has(to)) {
        low.set(file, Math.min(low.get(file), index.get(to)));
      }
    }
    if (low.get(file) !== index.get(file)) return;
    const component = [];
    let member;
    do {
      member = stack.pop();
      onStack.delete(member);
      component.push(member);
    } while (member !== file);
    const selfLoop = (graph.edges.get(file) ?? []).some((e) => e.to === file && kinds.includes(e.kind));
    if (component.length > 1 || selfLoop) found.push(component.sort());
  };
  for (const file of graph.files) if (!index.has(file)) strong(file);
  return found;
}

const GRAPH = importGraph();

// C4 — the controller loads metadata only: no game implementation, not the component registry.
check("C4", "CONTROLLER_LOADS_NO_GAME_CODE", () => {
  const controllerClosure = closure(GRAPH, CONTROLLER, ["runtime"]);
  const gameCode = controllerClosure.filter(
    (file) => file.startsWith("src/games/") && file !== ENTRY_CONTRACT,
  );
  const contractRuntimeImports = (GRAPH.edges.get(ENTRY_CONTRACT) ?? [])
    .filter((edge) => edge.kind !== "type")
    .map((edge) => edge.to);
  return [
    gameCode.length === 0 && contractRuntimeImports.length === 0,
    {
      controllerClosure,
      gameCode,
      contractRuntimeImports,
      forReference: `importing ${REGISTRY} instead would load ${closure(GRAPH, REGISTRY, ["runtime"]).length} modules`,
    },
  ];
});

// C5 — src/ has no import cycle (runtime or type imports).
check("C5", "NO_IMPORT_CYCLES", () => {
  const runtime = cycles(GRAPH, ["runtime"]);
  const withTypes = cycles(GRAPH, ["runtime", "type"]);
  return [
    runtime.length === 0 && withTypes.length === 0,
    {
      modules: GRAPH.files.length,
      imports: [...GRAPH.edges.values()].reduce((n, list) => n + list.length, 0),
      runtimeCycles: runtime,
      cyclesWithTypeImports: withTypes,
    },
  ];
});

console.log("\njanela do watchdog por jogo (preparing -> painel de erro):");
for (const gameId of subjectIds) {
  const declared = DECLARED?.[gameId]?.entryWatchdogMs;
  const source =
    declared !== undefined
      ? "(declarado no contrato)"
      : windows[gameId] === DEFAULT_WINDOW_MS
        ? "(padrão do shell)"
        : "(fora do contrato)";
  console.log(
    `  ${gameId.padEnd(15)} ${String(windows[gameId] ?? "never").padStart(6)} ms  ${source}`,
  );
}

const allPass = tests.every((t) => t.pass);
console.log(
  `\n${REV ? `rev ${REV} · ` : ""}${tests.filter((t) => t.pass).length}/${tests.length} passed · failing: ${tests.filter((t) => !t.pass).map((t) => t.id).join(", ") || "none"}`,
);
console.log(allPass ? "GAME_ENTRY_WATCHDOG_REGISTRY_OK" : "GAME_ENTRY_WATCHDOG_REGISTRY_FAILED");
process.exitCode = allPass ? EXIT_OK : EXIT_VALIDATION_FAILED;
