/**
 * GAME-REGISTRY-READINESS-01 — the entry readiness contract, owned by the registry.
 *
 * GameScreen holds the world entry until two things are true: the intro has
 * painted and the game has painted. How it learns the second depends on the
 * game. The Rota and the Circuito report it themselves through `onEntryReady`;
 * the legacy games never do, so the shell falls back to two animation frames
 * after mounting them. That decision used to be two hardcoded ids inside
 * GameScreen. It now lives in `src/games/index.ts`, which takes each game's
 * readiness from the metadata-only `src/games/entry-contract.ts`.
 *
 * This runs the REAL GameScreen, the REAL registry and the REAL entry contract —
 * compiled from source, unmodified — under:
 *
 *   - stub game components (one per registry import, named by module and export)
 *     and a stub intro, so nothing past the shell renders;
 *   - a virtual frame clock: `requestAnimationFrame` callbacks only run when a
 *     test advances a frame, and every request and cancellation is counted;
 *   - a small React: ordered hook cells, layout and passive effects with deps
 *     and cleanups, a real unmount, StrictMode's dev double-invoke on demand.
 *
 * B* pins what every game did before the registry owned readiness (the shell's
 * observable behaviour, not its declarations). C* asserts the contract itself.
 *
 * Usage: node tools/validation/game-readiness-registry-tests.mjs [--rev=<commit>]
 *
 *   --rev=<commit>  run against GameScreen, the registry and the game sources as
 *                   they were at <commit> (read with `git show`, nothing is
 *                   checked out or written). `--rev=4386f9f` is the code before
 *                   this mission: every B* check passes, every C* check fails.
 *
 * Writes nothing. Exit 0 = every check holds, 1 = a check failed, 3 = usage error.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";

const REGISTRY = "src/games/index.ts";
const ENTRY_CONTRACT = "src/games/entry-contract.ts";
const ENTRY_CONTRACT_SPECIFIER = "@/games/entry-contract";
const SCREEN = "src/components/GameScreen.tsx";

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
if (args.some((arg) => arg !== revArg) || REV === "") {
  console.error(
    "usage: node tools/validation/game-readiness-registry-tests.mjs [--rev=<commit>]",
  );
  process.exit(EXIT_USAGE);
}

/** Source at the requested revision, or null when the file does not exist there. */
function readSource(file) {
  try {
    return REV
      ? execFileSync("git", ["show", `${REV}:${file}`], {
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        })
      : fs.readFileSync(path.resolve(file), "utf8");
  } catch {
    return null;
  }
}

const compile = (file) =>
  ts.transpileModule(readSource(file), {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
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

// --- what the shell did before the registry owned it (4386f9f) ----------------

/**
 * Behaviour, not declarations: `explicit` means the shell waits for the game's
 * own onEntryReady; `frame-fallback` means it is ready two frames after mount.
 */
const PINNED = {
  "color-sequence": {
    component: "@/games/color-sequence/MemoryCircuit3DGame#MemoryCircuit3DGame",
    readiness: "explicit",
  },
  "escape-maze": {
    component: "@/games/escape-maze/RouteStrategyGame#RouteStrategyGame",
    readiness: "explicit",
  },
  "security-panel": {
    component: "@/games/security-panel/SecurityPanelGame#SecurityPanelGame",
    readiness: "frame-fallback",
  },
  "number-trail": {
    component: "@/games/number-trail/NumberTrailGame#NumberTrailGame",
    readiness: "frame-fallback",
  },
  "seed-garden": {
    component: "@/games/seed-garden/SeedGardenGame#SeedGardenGame",
    readiness: "frame-fallback",
  },
};
const READINESS = ["explicit", "frame-fallback"];
const FRAMES_ADVANCED = 5;

// --- stubs ----------------------------------------------------------------------

const stubModules = new Map();
/** Every export of a game module is a distinct, named, never-rendered component. */
function stubModule(specifier) {
  if (!stubModules.has(specifier)) {
    const exports = {};
    stubModules.set(
      specifier,
      new Proxy(exports, {
        get(target, name) {
          if (typeof name !== "string" || !/^[A-Z]/.test(name)) return undefined;
          if (!(name in target)) {
            const stub = () => {
              throw new Error(`${specifier}#${name} rendered: only the shell renders here`);
            };
            stub.tag = `${specifier}#${name}`;
            stub.module = specifier;
            target[name] = stub;
          }
          return target[name];
        },
      }),
    );
  }
  return stubModules.get(specifier);
}

const GameHowToPlay = () => {
  throw new Error("GameHowToPlay rendered: only the shell renders here");
};
GameHowToPlay.tag = "GameHowToPlay";
const GAME_INTROS = new Proxy({}, {
  get: (_, id) => (typeof id === "string" ? { introFor: id } : undefined),
});
const JSX_RUNTIME = {
  Fragment: Symbol.for("react.fragment"),
  jsx: (type, props, key) => ({ type, props, key: key === undefined ? null : String(key) }),
};
JSX_RUNTIME.jsxs = JSX_RUNTIME.jsx;

/**
 * The entry contract is metadata, not a game: the registry composes the real one.
 * Revisions before it existed never import it.
 */
let entryContractModule = null;
const REGISTRY_MODULE = evaluate(compile(REGISTRY), {}, (specifier) => {
  if (specifier === ENTRY_CONTRACT_SPECIFIER) {
    return (entryContractModule ??= evaluate(compile(ENTRY_CONTRACT), {}, () => null));
  }
  return specifier.startsWith("@/games/") ? stubModule(specifier) : null;
});
const SCREEN_SOURCE = readSource(SCREEN);
const SCREEN_JS = compile(SCREEN);
const DECLARED = REGISTRY_MODULE.GAME_REGISTRY ?? null;

// --- virtual frames ---------------------------------------------------------------

function createFrames() {
  let nextId = 1;
  const queue = new Map();
  const counts = { requested: 0, cancelled: 0 };
  return {
    counts,
    get pending() {
      return queue.size;
    },
    request(fn) {
      const id = nextId++;
      queue.set(id, fn);
      counts.requested += 1;
      return id;
    },
    cancel(id) {
      if (queue.delete(id)) counts.cancelled += 1;
    },
    /** One frame: callbacks requested during it wait for the next one. */
    tick() {
      const due = [...queue.values()];
      queue.clear();
      for (const fn of due) fn(0);
    },
  };
}

// --- a small React ------------------------------------------------------------------

const sameDeps = (a, b) =>
  Array.isArray(a) &&
  Array.isArray(b) &&
  a.length === b.length &&
  a.every((value, i) => Object.is(value, b[i]));

function createReactShim(store, onLateSetState) {
  const effect = (layout) => (run, deps) => {
    const i = store.index++;
    const cell = store.cells[i] ?? (store.cells[i] = { effect: true, layout });
    if (cell.deps === undefined || !sameDeps(cell.deps, deps)) {
      store.pending.push({ cell, run, deps });
    }
  };
  return {
    useState(initial) {
      const i = store.index++;
      if (!(i in store.cells)) {
        store.cells[i] = { value: typeof initial === "function" ? initial() : initial };
      }
      const cell = store.cells[i];
      const setter =
        cell.setter ??
        (cell.setter = (next) => {
          if (!store.mounted) {
            onLateSetState();
            return;
          }
          const value = typeof next === "function" ? next(cell.value) : next;
          if (Object.is(value, cell.value)) return;
          cell.value = value;
          store.dirty = true;
        });
      return [cell.value, setter];
    },
    useRef(initial) {
      const i = store.index++;
      if (!(i in store.cells)) store.cells[i] = { current: initial };
      return store.cells[i];
    },
    useEffect: effect(false),
    useLayoutEffect: effect(true),
  };
}

// --- one mounted GameScreen -------------------------------------------------------------

function isElement(node) {
  return node !== null && typeof node === "object" && "type" in node && "props" in node;
}
const childrenOf = (element) => [element.props.children].flat(Infinity).filter(isElement);
function findElement(node, predicate) {
  if (!isElement(node)) return null;
  if (predicate(node)) return node;
  for (const child of childrenOf(node)) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return null;
}
const findGame = (tree) => findElement(tree, (el) => typeof el.type?.module === "string");
const findIntro = (tree) => findElement(tree, (el) => el.type === GameHowToPlay);

function mount({ gameId, skipIntro = false, strict = false, registryModule = REGISTRY_MODULE }) {
  const frames = createFrames();
  const store = { cells: [], index: 0, dirty: false, mounted: true, pending: [] };
  const log = { readyAt: [], lateSetState: 0 };
  let step = "mount";

  const react = createReactShim(store, () => {
    log.lateSetState += 1;
  });
  const { GameScreen } = evaluate(
    SCREEN_JS,
    {
      window: {
        requestAnimationFrame: (fn) => frames.request(fn),
        cancelAnimationFrame: (id) => frames.cancel(id),
        scrollTo: () => {},
      },
      document: { activeElement: null },
      HTMLElement: class HTMLElement {},
    },
    (specifier) =>
      ({
        react,
        "react/jsx-runtime": JSX_RUNTIME,
        "@/components/GameHowToPlay": { GameHowToPlay },
        "@/data/game-intros": { GAME_INTROS },
        "@/games": registryModule,
      })[specifier] ?? null,
  );

  let props = {
    gameId,
    sessionKey: 7,
    onComplete: () => {},
    onExit: () => {},
    initialRouteNumber: 4,
    initialDifficulty: "hard",
    onEntryReady: () => log.readyAt.push(step),
    onEntryError: () => {},
    skipIntro,
  };
  let tree = null;

  const effectCells = () => store.cells.filter((cell) => cell?.effect);
  const commit = () => {
    const pending = store.pending.splice(0);
    for (const layout of [true, false]) {
      const group = pending.filter(({ cell }) => cell.layout === layout);
      for (const { cell } of group) {
        if (typeof cell.cleanup === "function") cell.cleanup();
        cell.cleanup = undefined;
      }
      for (const { cell, run, deps } of group) {
        cell.run = run;
        cell.deps = deps;
        cell.cleanup = run();
      }
    }
  };
  const render = () => {
    let passes = 0;
    do {
      if ((passes += 1) > 16) throw new Error("GameScreen did not settle");
      store.index = 0;
      store.dirty = false;
      tree = GameScreen(props);
      commit();
    } while (store.dirty);
  };
  const settle = () => {
    if (store.mounted && store.dirty) render();
  };

  render();
  if (strict) {
    for (const cell of effectCells()) {
      if (typeof cell.cleanup === "function") cell.cleanup();
    }
    for (const cell of effectCells()) cell.cleanup = cell.run();
    settle();
  }
  const framesRequestedAtMount = frames.counts.requested;

  return {
    get tree() {
      return tree;
    },
    frames,
    framesRequestedAtMount,
    log,
    props: () => props,
    act(label, fn) {
      step = label;
      fn(tree);
      settle();
    },
    rerender(label, next) {
      step = label;
      props = { ...props, ...next };
      render();
    },
    unmount() {
      store.mounted = false;
      for (const cell of effectCells()) {
        if (typeof cell.cleanup === "function") cell.cleanup();
        cell.cleanup = undefined;
      }
    },
  };
}

// --- scenarios ------------------------------------------------------------------------------

const frameSteps = Array.from({ length: FRAMES_ADVANCED }, (_, i) => `frame-${i + 1}`);
const SCENARIOS = {
  "intro-first": {
    skipIntro: false,
    steps: ["intro-ready", ...frameSteps, "game-reports", "repeat", "parent-rerender"],
  },
  "game-first": {
    skipIntro: false,
    steps: [...frameSteps, "game-reports", "intro-ready", "repeat", "parent-rerender"],
  },
  "skip-intro": {
    skipIntro: true,
    steps: [...frameSteps, "game-reports", "repeat", "parent-rerender"],
  },
};

function perform(screen, step) {
  if (step.startsWith("frame-")) return screen.act(step, () => screen.frames.tick());
  switch (step) {
    case "intro-ready":
      return screen.act(step, (tree) => findIntro(tree).props.onReady());
    case "game-reports":
      return screen.act(step, (tree) => findGame(tree).props.onEntryReady());
    case "repeat":
      return screen.act(step, (tree) => {
        findGame(tree).props.onEntryReady();
        findIntro(tree)?.props.onReady();
      });
    case "parent-rerender":
      // page.tsx re-rendering with a new callback identity must not report twice.
      return screen.rerender(step, { onEntryReady: () => screen.log.readyAt.push(step) });
    default:
      throw new Error(`unknown step ${step}`);
  }
}

function runScenario(gameId, name, { strict = false, registryModule } = {}) {
  const { skipIntro, steps } = SCENARIOS[name];
  const screen = mount({ gameId, skipIntro, strict, registryModule });
  for (const step of steps) perform(screen, step);
  const trace = {
    readyAt: screen.log.readyAt,
    framesPendingAtEnd: screen.frames.pending,
  };
  if (!strict) {
    trace.framesRequestedAtMount = screen.framesRequestedAtMount;
    trace.framesRequested = screen.frames.counts.requested;
  }
  return trace;
}

const EXPECTED_READY_AT = {
  explicit: { "intro-first": ["game-reports"], "game-first": ["intro-ready"], "skip-intro": ["game-reports"] },
  "frame-fallback": { "intro-first": ["frame-2"], "game-first": ["intro-ready"], "skip-intro": ["frame-2"] },
};
const EXPECTED_FRAMES = {
  explicit: { framesRequestedAtMount: 0, framesRequested: 0 },
  "frame-fallback": { framesRequestedAtMount: 1, framesRequested: 2 },
};
const expectedTrace = (readiness, name, { strict = false } = {}) => ({
  readyAt: EXPECTED_READY_AT[readiness][name],
  framesPendingAtEnd: 0,
  ...(strict ? {} : EXPECTED_FRAMES[readiness]),
});

function describeTree(screen) {
  const { tree } = screen;
  const props = screen.props();
  const layer = (el) => ({
    className: el.props.className,
    ariaHidden: el.props["aria-hidden"],
    inert: el.props.inert ?? null,
    focusTarget: el.props["data-world-entry-focus"] ?? null,
  });
  const game = findGame(tree);
  const intro = findIntro(tree);
  return {
    root: tree.props.className,
    layers: childrenOf(tree).map(layer),
    game: game && {
      component: game.type.tag,
      key: game.key,
      propKeys: Object.keys(game.props).sort(),
      onComplete: game.props.onComplete === props.onComplete,
      onExit: game.props.onExit === props.onExit,
      onEntryError: game.props.onEntryError === props.onEntryError,
      initialRouteNumber: game.props.initialRouteNumber,
      initialDifficulty: game.props.initialDifficulty,
      onEntryReadyIsShellOwned:
        typeof game.props.onEntryReady === "function" &&
        game.props.onEntryReady !== props.onEntryReady,
    },
    intro: intro && {
      gameId: intro.props.gameId,
      introFor: intro.props.intro?.introFor,
      onBackToMap: intro.props.onBackToMap === props.onExit,
      onError: intro.props.onError === props.onEntryError,
    },
  };
}

function expectedTree({ component, gameId, skipIntro, started }) {
  const showIntro = !skipIntro && !started;
  return {
    root: "wentry-screen",
    layers: [
      {
        className: "wentry-game-layer",
        ariaHidden: showIntro,
        inert: showIntro ? true : null,
        focusTarget: skipIntro ? "true" : null,
      },
      ...(skipIntro
        ? []
        : [{ className: "wentry-intro-layer", ariaHidden: !showIntro, inert: showIntro ? null : true, focusTarget: null }]),
    ],
    game: {
      component,
      key: "7",
      propKeys: ["initialDifficulty", "initialRouteNumber", "onComplete", "onEntryError", "onEntryReady", "onExit"],
      onComplete: true,
      onExit: true,
      onEntryError: true,
      initialRouteNumber: 4,
      initialDifficulty: "hard",
      onEntryReadyIsShellOwned: true,
    },
    intro: skipIntro ? null : { gameId, introFor: gameId, onBackToMap: true, onError: true },
  };
}

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
 * Pinned games are held to the pre-registry behaviour. A game added later is
 * held to its own declaration instead, so the battery does not need editing to
 * register one.
 */
const subjects = Object.fromEntries([
  ...Object.entries(PINNED).map(([id, pin]) => [id, pin]),
  ...Object.entries(DECLARED ?? {})
    .filter(([id]) => !(id in PINNED))
    .map(([id, entry]) => [id, { component: entry.component?.tag, readiness: entry.readiness }]),
]);
const subjectIds = Object.keys(subjects);

// B1 — intro + game mounted together, with the same props, before and after Start.
{
  const mismatches = [];
  for (const [gameId, { component }] of Object.entries(subjects)) {
    for (const skipIntro of [false, true]) {
      const screen = mount({ gameId, skipIntro });
      const atMount = describeTree(screen);
      if (!same(atMount, expectedTree({ component, gameId, skipIntro, started: false }))) {
        mismatches.push({ gameId, skipIntro, phase: "mount", actual: atMount });
      }
      if (skipIntro) continue;
      screen.act("start", (tree) => findIntro(tree).props.onStart());
      const afterStart = describeTree(screen);
      if (!same(afterStart, expectedTree({ component, gameId, skipIntro, started: true }))) {
        mismatches.push({ gameId, skipIntro, phase: "after-start", actual: afterStart });
      }
    }
  }
  record("B1", "INTRO_AND_GAME_MOUNTED_AS_BEFORE", mismatches.length === 0, {
    games: subjectIds.length,
    mismatches,
  });
}

// B2–B4 — when the parent hears onEntryReady, per ordering, and how many frames it cost.
const behaviour = {};
for (const [id, name] of [["B2", "intro-first"], ["B3", "game-first"], ["B4", "skip-intro"]]) {
  const rows = subjectIds.map((gameId) => {
    const actual = runScenario(gameId, name);
    const expected = expectedTrace(subjects[gameId].readiness, name);
    (behaviour[gameId] ??= {})[name] = actual.readyAt.join(",") || "never";
    return { gameId, ok: same(actual, expected), actual, expected };
  });
  record(id, `READY_${name.toUpperCase().replace(/-/g, "_")}`, rows.every((row) => row.ok), {
    failing: rows.filter((row) => !row.ok),
    readyAt: Object.fromEntries(rows.map((row) => [row.gameId, row.actual.readyAt])),
  });
}

// B5 — onEntryReady reaches the parent exactly once, whatever repeats or re-renders follow.
{
  const counts = [];
  for (const gameId of subjectIds) {
    for (const name of Object.keys(SCENARIOS)) {
      for (const strict of [false, true]) {
        counts.push({ gameId, name, strict, calls: runScenario(gameId, name, { strict }).readyAt.length });
      }
    }
  }
  record("B5", "ENTRY_READY_EMITTED_ONCE", counts.every((c) => c.calls === 1), {
    runs: counts.length,
    notOnce: counts.filter((c) => c.calls !== 1),
  });
}

// B6 — StrictMode's dev effect double-invoke changes nothing the parent can see.
{
  const rows = [];
  for (const gameId of subjectIds) {
    for (const name of Object.keys(SCENARIOS)) {
      const actual = runScenario(gameId, name, { strict: true });
      const expected = expectedTrace(subjects[gameId].readiness, name, { strict: true });
      rows.push({ gameId, name, ok: same(actual, expected), actual, expected });
    }
  }
  record("B6", "STRICT_MODE_SAME_READINESS", rows.every((row) => row.ok), {
    runs: rows.length,
    failing: rows.filter((row) => !row.ok),
  });
}

// B7 — leaving mid-fallback cancels the pending frame and reports nothing.
{
  const rows = subjectIds.map((gameId) => {
    const screen = mount({ gameId });
    perform(screen, "intro-ready");
    perform(screen, "frame-1");
    screen.unmount();
    const cancelledOnUnmount = screen.frames.counts.cancelled;
    screen.frames.tick();
    screen.frames.tick();
    const actual = {
      readyAt: screen.log.readyAt,
      cancelledOnUnmount,
      framesPendingAfterUnmount: screen.frames.pending,
      lateSetState: screen.log.lateSetState,
    };
    const expected = {
      readyAt: [],
      cancelledOnUnmount: subjects[gameId].readiness === "frame-fallback" ? 1 : 0,
      framesPendingAfterUnmount: 0,
      lateSetState: 0,
    };
    return { gameId, ok: same(actual, expected), actual };
  });
  record("B7", "UNMOUNT_CANCELS_FALLBACK_FRAMES", rows.every((row) => row.ok), {
    failing: rows.filter((row) => !row.ok),
  });
}

// C1 — the registry declares a component and a readiness for every game.
{
  const entries = Object.entries(DECLARED ?? {});
  const invalid = entries
    .filter(
      ([, entry]) =>
        typeof entry?.component !== "function" ||
        typeof entry.component.tag !== "string" ||
        !READINESS.includes(entry.readiness),
    )
    .map(([gameId]) => gameId);
  const drift = Object.entries(PINNED)
    .filter(
      ([gameId, pin]) =>
        DECLARED?.[gameId]?.component?.tag !== pin.component ||
        DECLARED?.[gameId]?.readiness !== pin.readiness,
    )
    .map(([gameId, pin]) => ({
      gameId,
      pinned: pin,
      declared: DECLARED?.[gameId]
        ? { component: DECLARED[gameId].component?.tag, readiness: DECLARED[gameId].readiness }
        : null,
    }));
  record(
    "C1",
    "REGISTRY_DECLARES_READINESS",
    DECLARED !== null && entries.length > 0 && invalid.length === 0 && drift.length === 0,
    {
      registryExport: DECLARED ? "GAME_REGISTRY" : `none (exports: ${Object.keys(REGISTRY_MODULE).join(", ")})`,
      declared: Object.fromEntries(entries.map(([gameId, entry]) => [gameId, entry?.readiness])),
      invalid,
      drift,
    },
  );
}

// C2 — GameScreen names no game.
{
  const code = codeOnly(SCREEN_SOURCE);
  const named = subjectIds.filter((gameId) => code.includes(gameId));
  record("C2", "GAME_SCREEN_NAMES_NO_GAME", named.length === 0, { named });
}

// C3 — flip every declaration: the shell must follow the registry, not a list of its own.
{
  const flip = (readiness) => (readiness === "explicit" ? "frame-fallback" : "explicit");
  const rows = DECLARED
    ? Object.entries(DECLARED).map(([gameId, entry]) => {
        const flipped = {
          ...REGISTRY_MODULE,
          GAME_REGISTRY: Object.fromEntries(
            Object.entries(DECLARED).map(([id, e]) => [id, { ...e, readiness: flip(e.readiness) }]),
          ),
        };
        const actual = runScenario(gameId, "intro-first", { registryModule: flipped });
        const expected = expectedTrace(flip(entry.readiness), "intro-first");
        return { gameId, declaredAs: flip(entry.readiness), ok: same(actual, expected), actual };
      })
    : [];
  record("C3", "REGISTRY_DRIVES_SHELL_READINESS", rows.length > 0 && rows.every((row) => row.ok), {
    failing: rows.filter((row) => !row.ok),
    note: DECLARED ? "every declaration inverted; the shell followed each one" : "the registry declares no readiness",
  });
}

// C4 — a declaration matches its component: `explicit` games forward onEntryReady, the others never touch it.
{
  const rows = Object.entries(DECLARED ?? {}).map(([gameId, entry]) => {
    const base = entry.component.module.replace(/^@\//, "src/");
    const file = [`${base}.tsx`, `${base}.ts`].find((candidate) => readSource(candidate) !== null);
    const forwards = file ? /\bonEntryReady\b/.test(codeOnly(readSource(file))) : null;
    return {
      gameId,
      file,
      readiness: entry.readiness,
      forwardsOnEntryReady: forwards,
      ok: file !== undefined && forwards === (entry.readiness === "explicit"),
    };
  });
  record("C4", "DECLARATION_MATCHES_COMPONENT", rows.length > 0 && rows.every((row) => row.ok), {
    failing: rows.filter((row) => !row.ok),
    forwards: Object.fromEntries(rows.map((row) => [row.gameId, row.forwardsOnEntryReady])),
  });
}

console.log("\ncomportamento por jogo (onEntryReady chega ao pai em):");
for (const gameId of subjectIds) {
  const row = behaviour[gameId];
  console.log(
    `  ${gameId.padEnd(15)} ${subjects[gameId].readiness.padEnd(15)} intro-first=${row["intro-first"]} · game-first=${row["game-first"]} · skip-intro=${row["skip-intro"]}`,
  );
}

const allPass = tests.every((t) => t.pass);
console.log(
  `\n${REV ? `rev ${REV} · ` : ""}${tests.filter((t) => t.pass).length}/${tests.length} passed · failing: ${tests.filter((t) => !t.pass).map((t) => t.id).join(", ") || "none"}`,
);
console.log(allPass ? "GAME_READINESS_REGISTRY_OK" : "GAME_READINESS_REGISTRY_FAILED");
process.exitCode = allPass ? EXIT_OK : EXIT_VALIDATION_FAILED;
