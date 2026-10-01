/**
 * GAME-REGISTRY-READINESS-01 — the entry readiness contract, owned by the registry.
 * GAME-LAZY-LOADING-01 — and each game's code, loaded only when it is opened.
 *
 * GameScreen holds the world entry until two things are true: the intro has
 * painted and the game has painted. How it learns the second depends on the
 * game. The Rota and the Circuito report it themselves through `onEntryReady`;
 * the legacy games never do, so the shell falls back to two animation frames
 * after mounting them. That decision used to be two hardcoded ids inside
 * GameScreen. It now lives in `src/games/index.ts`, which takes each game's
 * readiness from the metadata-only `src/games/entry-contract.ts`.
 *
 * The registry no longer imports the games either. Each entry carries a loader
 * whose `import()` the bundler turns into that game's own chunk, and GameScreen
 * mounts the game only once that code has arrived. "After mounting them" now
 * starts at that arrival: nothing may be counted toward readiness while the
 * game is not on the screen, and a chunk that fails must reach onEntryError.
 *
 * This runs the REAL GameScreen, the REAL registry (its loaders included) and
 * the REAL entry contract — compiled from source, unmodified — under:
 *
 *   - stub game components (one per registry import, named by module and export)
 *     and a stub intro, so nothing past the shell renders;
 *   - a virtual chunk gate: every load GameScreen starts is held until a test
 *     delivers the game's code or fails it. Both go through the registry's real
 *     loader — a failure makes the game module's import throw, the way a chunk
 *     that cannot be fetched does;
 *   - a virtual frame clock: `requestAnimationFrame` callbacks only run when a
 *     test advances a frame, and every request and cancellation is counted;
 *   - a small React: ordered hook cells, layout and passive effects with deps
 *     and cleanups, a real unmount, StrictMode's dev double-invoke on demand.
 *
 * B* pins what every game did before the registry owned readiness (the shell's
 * observable behaviour, not its declarations), counted from the moment the game
 * mounts. C* asserts the contract itself. L* asserts the lazy loading: no game
 * code until a game is opened, nothing counted before it mounts, failures and
 * retries through the entry's existing path.
 *
 * Usage: node tools/validation/game-readiness-registry-tests.mjs [--rev=<commit>]
 *
 *   --rev=<commit>  run against GameScreen, the registry, the Home's import graph
 *                   and the game sources as they were at <commit> (read with
 *                   `git show`, nothing is checked out or written).
 *                   `--rev=4386f9f` is the code before the registry owned
 *                   readiness: every B* check passes, every C* and L* check fails.
 *                   `--rev=3bb9232` is the code before lazy loading: every B* and
 *                   C* check passes, every L* check fails.
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
const HOME = "src/app/page.tsx";

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
if (args.some((arg) => arg !== revArg) || REV === "") {
  console.error(
    "usage: node tools/validation/game-readiness-registry-tests.mjs [--rev=<commit>]",
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

/** Let every queued promise continuation run (a compiled `import()` chains several). */
const flushMicrotasks = async () => {
  for (let i = 0; i < 3; i += 1) await new Promise((resolve) => setImmediate(resolve));
};

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
          // An ES module: a compiled `import()` hands it over as it is.
          if (name === "__esModule") return true;
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
 * The registry's view of the game modules: every one it asks for is logged, and
 * a test can make the asks throw — what an `import()` whose chunk cannot be
 * fetched does. The entry contract is metadata, not a game: the registry
 * composes the real one. Revisions before it existed never import it.
 */
const gameImports = { log: [], failure: null };
let entryContractModule = null;
const REGISTRY_MODULE = evaluate(compile(REGISTRY), {}, (specifier) => {
  if (specifier === ENTRY_CONTRACT_SPECIFIER) {
    return (entryContractModule ??= evaluate(compile(ENTRY_CONTRACT), {}, () => null));
  }
  if (!specifier.startsWith("@/games/")) return null;
  gameImports.log.push(specifier);
  if (gameImports.failure) throw gameImports.failure.reason;
  return stubModule(specifier);
});
/** Game modules the registry needed just to be evaluated: a lazy registry needs none. */
const GAME_IMPORTS_AT_EVALUATION = gameImports.log.splice(0);
const SCREEN_SOURCE = readSource(SCREEN);
const SCREEN_JS = compile(SCREEN);
const DECLARED = REGISTRY_MODULE.GAME_REGISTRY ?? null;

const hasLoader = (entry) => typeof entry?.load === "function";
/**
 * Each declared game's component, as the registry hands it over: through its
 * loader (and which game modules that load imported), or — an eager registry —
 * held directly.
 */
const RESOLVED = {};
for (const [gameId, entry] of Object.entries(DECLARED ?? {})) {
  const from = gameImports.log.length;
  try {
    RESOLVED[gameId] = {
      via: hasLoader(entry) ? "loader" : "eager",
      component: hasLoader(entry) ? await entry.load() : entry?.component,
      imports: gameImports.log.slice(from),
    };
  } catch (error) {
    RESOLVED[gameId] = {
      via: "loader",
      component: null,
      imports: gameImports.log.slice(from),
      error: String(error?.message ?? error),
    };
  }
}

// --- virtual chunks ---------------------------------------------------------------

/**
 * Holds every load GameScreen starts until the test says the game's code
 * arrived (`deliver`) or could not be fetched (`fail`). Both run the registry's
 * REAL loader once released. Entries without a loader (an eager registry) are
 * passed through untouched, so their component is there from the first render.
 */
function createChunkGate() {
  const held = [];
  const calls = [];
  return {
    calls,
    get held() {
      return held.length;
    },
    wrap(registryModule) {
      const registry = registryModule.GAME_REGISTRY;
      if (!registry) return registryModule;
      const gated = Object.fromEntries(
        Object.entries(registry).map(([gameId, entry]) => [
          gameId,
          hasLoader(entry)
            ? {
                ...entry,
                load: () => {
                  calls.push(gameId);
                  return new Promise((release) => held.push(release)).then(() => entry.load());
                },
              }
            : entry,
        ]),
      );
      return { ...registryModule, GAME_REGISTRY: gated };
    },
    async deliver() {
      for (const release of held.splice(0)) release();
      await flushMicrotasks();
    },
    async fail(reason) {
      gameImports.failure = { reason };
      try {
        for (const release of held.splice(0)) release();
        await flushMicrotasks();
      } finally {
        gameImports.failure = null;
      }
    },
  };
}

const chunkLoadError = () =>
  Object.assign(new Error("Failed to load chunk static/chunks/game.js from module 1"), {
    name: "ChunkLoadError",
  });

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
function countElements(node, predicate) {
  if (!isElement(node)) return 0;
  return (predicate(node) ? 1 : 0) + childrenOf(node).reduce((n, child) => n + countElements(child, predicate), 0);
}
const isGame = (el) => typeof el.type?.module === "string";
const findGame = (tree) => findElement(tree, isGame);
const findIntro = (tree) => findElement(tree, (el) => el.type === GameHowToPlay);

function mount({ gameId, skipIntro = false, strict = false, registryModule = REGISTRY_MODULE, sessionKey = 7 }) {
  const frames = createFrames();
  const chunks = createChunkGate();
  const store = { cells: [], index: 0, dirty: false, mounted: true, pending: [] };
  const log = { readyAt: [], errors: [], lateSetState: 0, gameAbsentAt: [] };
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
      // One realm, as in a browser: an Error the registry's import throws is an Error here too.
      Error,
    },
    (specifier) =>
      ({
        react,
        "react/jsx-runtime": JSX_RUNTIME,
        "@/components/GameHowToPlay": { GameHowToPlay },
        "@/data/game-intros": { GAME_INTROS },
        "@/games": chunks.wrap(registryModule),
      })[specifier] ?? null,
  );

  let props = {
    gameId,
    sessionKey,
    onComplete: () => {},
    onExit: () => {},
    initialRouteNumber: 4,
    initialDifficulty: "hard",
    onEntryReady: () => log.readyAt.push(step),
    onEntryError: (...received) => log.errors.push({ via: "initial", step, received }),
    skipIntro,
  };
  let tree = null;
  let framesRequestedAtGameMount = null;

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
  /** The frames the shell had asked for by the end of the commit that mounted the game. */
  const noteGameMount = () => {
    if (framesRequestedAtGameMount === null && store.mounted && findGame(tree)) {
      framesRequestedAtGameMount = frames.counts.requested;
    }
  };

  render();
  if (strict) {
    for (const cell of effectCells()) {
      if (typeof cell.cleanup === "function") cell.cleanup();
    }
    for (const cell of effectCells()) cell.cleanup = cell.run();
    settle();
  }
  noteGameMount();

  return {
    get tree() {
      return tree;
    },
    frames,
    chunks,
    log,
    get framesRequestedAtGameMount() {
      return framesRequestedAtGameMount;
    },
    /** The step being performed: what a callback called right now is attributed to. */
    get step() {
      return step;
    },
    props: () => props,
    act(label, fn) {
      step = label;
      fn(tree);
      settle();
      noteGameMount();
    },
    async deliver(label) {
      step = label;
      await chunks.deliver();
      settle();
      noteGameMount();
    },
    async fail(label, reason) {
      step = label;
      await chunks.fail(reason);
      settle();
      noteGameMount();
    },
    rerender(label, next) {
      step = label;
      props = { ...props, ...next };
      if (store.mounted) render();
      noteGameMount();
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
/** Frames that pass while the game's code is still on its way. */
const waitSteps = Array.from({ length: FRAMES_ADVANCED }, (_, i) => `wait-${i + 1}`);
/** Every pinned ordering starts when the game's code arrives: the game mounts there. */
const SCENARIOS = {
  "intro-first": {
    skipIntro: false,
    steps: ["chunk", "intro-ready", ...frameSteps, "game-reports", "repeat", "parent-rerender"],
  },
  "game-first": {
    skipIntro: false,
    steps: ["chunk", ...frameSteps, "game-reports", "intro-ready", "repeat", "parent-rerender"],
  },
  "skip-intro": {
    skipIntro: true,
    steps: ["chunk", ...frameSteps, "game-reports", "repeat", "parent-rerender"],
  },
};

/** The game reports through the shell's callback, which only a mounted game holds. */
function reportFromGame(screen, tree, step) {
  const game = findGame(tree);
  if (game) game.props.onEntryReady();
  else screen.log.gameAbsentAt.push(step);
}

async function perform(screen, step) {
  if (step === "chunk") return screen.deliver(step);
  if (step.startsWith("frame-") || step.startsWith("wait-")) {
    return screen.act(step, () => screen.frames.tick());
  }
  switch (step) {
    case "intro-ready":
      return screen.act(step, (tree) => findIntro(tree).props.onReady());
    case "game-reports":
      return screen.act(step, (tree) => reportFromGame(screen, tree, step));
    case "repeat":
      return screen.act(step, (tree) => {
        reportFromGame(screen, tree, step);
        findIntro(tree)?.props.onReady();
      });
    case "parent-rerender":
      // page.tsx re-rendering with a new callback identity must not report twice.
      return screen.rerender(step, { onEntryReady: () => screen.log.readyAt.push(screen.step) });
    default:
      throw new Error(`unknown step ${step}`);
  }
}

async function runScenario(gameId, name, { strict = false, registryModule } = {}) {
  const { skipIntro, steps } = SCENARIOS[name];
  const screen = mount({ gameId, skipIntro, strict, registryModule });
  for (const step of steps) await perform(screen, step);
  const trace = {
    readyAt: screen.log.readyAt,
    framesPendingAtEnd: screen.frames.pending,
    gameAbsentAt: screen.log.gameAbsentAt,
  };
  if (!strict) {
    trace.framesRequestedAtGameMount = screen.framesRequestedAtGameMount;
    trace.framesRequested = screen.frames.counts.requested;
  }
  return trace;
}

const EXPECTED_READY_AT = {
  explicit: { "intro-first": ["game-reports"], "game-first": ["intro-ready"], "skip-intro": ["game-reports"] },
  "frame-fallback": { "intro-first": ["frame-2"], "game-first": ["intro-ready"], "skip-intro": ["frame-2"] },
};
const EXPECTED_FRAMES = {
  explicit: { framesRequestedAtGameMount: 0, framesRequested: 0 },
  "frame-fallback": { framesRequestedAtGameMount: 1, framesRequested: 2 },
};
const expectedTrace = (readiness, name, { strict = false } = {}) => ({
  readyAt: EXPECTED_READY_AT[readiness][name],
  framesPendingAtEnd: 0,
  gameAbsentAt: [],
  ...(strict ? {} : EXPECTED_FRAMES[readiness]),
});

const describeLayer = (el) => ({
  className: el.props.className,
  ariaHidden: el.props["aria-hidden"],
  inert: el.props.inert ?? null,
  focusTarget: el.props["data-world-entry-focus"] ?? null,
});

function describeTree(screen) {
  const { tree } = screen;
  const props = screen.props();
  const game = findGame(tree);
  const intro = findIntro(tree);
  return {
    root: tree.props.className,
    layers: childrenOf(tree).map(describeLayer),
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

// --- static import graph of src/ ---------------------------------------------------------------

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
    visit(ts.createSourceFile(file, readSource(file), ts.ScriptTarget.Latest, true));
    edges.set(file, out);
  }
  return { files, edges, resolve };
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
    .map(([id, entry]) => [id, { component: RESOLVED[id]?.component?.tag, readiness: entry.readiness }]),
]);
const subjectIds = Object.keys(subjects);
const moduleOf = (gameId) => subjects[gameId].component?.split("#")[0] ?? null;
/** L* precondition: a lazy registry gives every game a loader. */
const lazyFor = (gameId) => hasLoader(DECLARED?.[gameId]);

// B1 — intro + game mounted together, with the same props, before and after Start.
{
  const mismatches = [];
  for (const [gameId, { component }] of Object.entries(subjects)) {
    for (const skipIntro of [false, true]) {
      const screen = mount({ gameId, skipIntro });
      await perform(screen, "chunk");
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
  const rows = [];
  for (const gameId of subjectIds) {
    const actual = await runScenario(gameId, name);
    const expected = expectedTrace(subjects[gameId].readiness, name);
    (behaviour[gameId] ??= {})[name] = actual.readyAt.join(",") || "never";
    rows.push({ gameId, ok: same(actual, expected), actual, expected });
  }
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
        counts.push({ gameId, name, strict, calls: (await runScenario(gameId, name, { strict })).readyAt.length });
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
      const actual = await runScenario(gameId, name, { strict: true });
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
  const rows = [];
  for (const gameId of subjectIds) {
    const screen = mount({ gameId });
    await perform(screen, "chunk");
    await perform(screen, "intro-ready");
    await perform(screen, "frame-1");
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
    rows.push({ gameId, ok: same(actual, expected), actual });
  }
  record("B7", "UNMOUNT_CANCELS_FALLBACK_FRAMES", rows.every((row) => row.ok), {
    failing: rows.filter((row) => !row.ok),
  });
}

// C1 — the registry declares a component and a readiness for every game.
{
  const entries = Object.entries(DECLARED ?? {});
  const invalid = entries
    .filter(([gameId, entry]) => {
      const component = RESOLVED[gameId]?.component;
      return (
        typeof component !== "function" ||
        typeof component.tag !== "string" ||
        !READINESS.includes(entry?.readiness)
      );
    })
    .map(([gameId]) => gameId);
  const drift = Object.entries(PINNED)
    .filter(
      ([gameId, pin]) =>
        RESOLVED[gameId]?.component?.tag !== pin.component ||
        DECLARED?.[gameId]?.readiness !== pin.readiness,
    )
    .map(([gameId, pin]) => ({
      gameId,
      pinned: pin,
      declared: DECLARED?.[gameId]
        ? { component: RESOLVED[gameId]?.component?.tag, readiness: DECLARED[gameId].readiness }
        : null,
    }));
  record(
    "C1",
    "REGISTRY_DECLARES_READINESS",
    DECLARED !== null && entries.length > 0 && invalid.length === 0 && drift.length === 0,
    {
      registryExport: DECLARED ? "GAME_REGISTRY" : `none (exports: ${Object.keys(REGISTRY_MODULE).join(", ")})`,
      declared: Object.fromEntries(entries.map(([gameId, entry]) => [gameId, entry?.readiness])),
      componentVia: Object.fromEntries(entries.map(([gameId]) => [gameId, RESOLVED[gameId]?.via])),
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
  const rows = [];
  if (DECLARED) {
    const flipped = {
      ...REGISTRY_MODULE,
      GAME_REGISTRY: Object.fromEntries(
        Object.entries(DECLARED).map(([id, e]) => [id, { ...e, readiness: flip(e.readiness) }]),
      ),
    };
    for (const [gameId, entry] of Object.entries(DECLARED)) {
      const actual = await runScenario(gameId, "intro-first", { registryModule: flipped });
      const expected = expectedTrace(flip(entry.readiness), "intro-first");
      rows.push({ gameId, declaredAs: flip(entry.readiness), ok: same(actual, expected), actual });
    }
  }
  record("C3", "REGISTRY_DRIVES_SHELL_READINESS", rows.length > 0 && rows.every((row) => row.ok), {
    failing: rows.filter((row) => !row.ok),
    note: DECLARED ? "every declaration inverted; the shell followed each one" : "the registry declares no readiness",
  });
}

// C4 — a declaration matches its component: `explicit` games forward onEntryReady, the others never touch it.
{
  const rows = Object.entries(DECLARED ?? {}).map(([gameId, entry]) => {
    const base = RESOLVED[gameId]?.component?.module?.replace(/^@\//, "src/");
    const file = base && [`${base}.tsx`, `${base}.ts`].find((candidate) => readSource(candidate) !== null);
    const forwards = file ? /\bonEntryReady\b/.test(codeOnly(readSource(file))) : null;
    return {
      gameId,
      file,
      readiness: entry.readiness,
      forwardsOnEntryReady: forwards,
      ok: Boolean(file) && forwards === (entry.readiness === "explicit"),
    };
  });
  record("C4", "DECLARATION_MATCHES_COMPONENT", rows.length > 0 && rows.every((row) => row.ok), {
    failing: rows.filter((row) => !row.ok),
    forwards: Object.fromEntries(rows.map((row) => [row.gameId, row.forwardsOnEntryReady])),
  });
}

// L1 — the registry imports no game to be evaluated; each loader imports exactly its own game, on demand.
{
  const rows = subjectIds.map((gameId) => {
    const resolved = RESOLVED[gameId];
    const row = {
      gameId,
      loader: lazyFor(gameId),
      importsOnLoad: resolved?.imports ?? null,
      resolvesTo: resolved?.component?.tag ?? null,
    };
    row.ok =
      row.loader &&
      same(row.importsOnLoad, [moduleOf(gameId)]) &&
      row.resolvesTo === subjects[gameId].component;
    return row;
  });
  record(
    "L1",
    "REGISTRY_LOADS_EACH_GAME_ON_DEMAND",
    GAME_IMPORTS_AT_EVALUATION.length === 0 && rows.every((row) => row.ok),
    {
      gameModulesImportedToEvaluateTheRegistry: GAME_IMPORTS_AT_EVALUATION,
      failing: rows.filter((row) => !row.ok),
    },
  );
}

/**
 * L2/L3 share their runs: the intro (when shown) is ready and frames keep
 * passing while the game's code is on its way; then it arrives.
 */
const lazyRuns = [];
for (const gameId of subjectIds) {
  for (const skipIntro of [false, true]) {
    const screen = mount({ gameId, skipIntro });
    const loadsAtMount = screen.chunks.calls.length;
    if (!skipIntro) await perform(screen, "intro-ready");
    for (const step of waitSteps) await perform(screen, step);
    await perform(screen, "parent-rerender");
    const whileLoading = {
      loadsAtMount,
      gameInTree: Boolean(findGame(screen.tree)),
      layers: childrenOf(screen.tree).map(describeLayer),
      introPresent: Boolean(findIntro(screen.tree)),
      framesRequested: screen.frames.counts.requested,
      readyAt: [...screen.log.readyAt],
      errors: screen.log.errors.length,
    };
    await perform(screen, "chunk");
    const treeOnArrival = describeTree(screen);
    for (const step of [...frameSteps, "game-reports", "repeat", "parent-rerender"]) await perform(screen, step);
    lazyRuns.push({
      gameId,
      skipIntro,
      whileLoading,
      onArrival: {
        tree: treeOnArrival,
        framesRequestedAtGameMount: screen.framesRequestedAtGameMount,
      },
      end: {
        readyAt: screen.log.readyAt,
        framesRequested: screen.frames.counts.requested,
        framesPendingAtEnd: screen.frames.pending,
        loads: screen.chunks.calls.length,
        errors: screen.log.errors.length,
        gameAbsentAt: screen.log.gameAbsentAt,
      },
    });
  }
}

// L2 — until its code arrives the game is not on the screen and nothing is counted: the layers stand, the load has started.
{
  const rows = lazyRuns.map(({ gameId, skipIntro, whileLoading }) => {
    const expected = {
      loadsAtMount: 1,
      gameInTree: false,
      layers: expectedTree({ component: null, gameId, skipIntro, started: false }).layers,
      introPresent: !skipIntro,
      framesRequested: 0,
      readyAt: [],
      errors: 0,
    };
    return { gameId, skipIntro, ok: lazyFor(gameId) && same(whileLoading, expected), loader: lazyFor(gameId), whileLoading };
  });
  record("L2", "GAME_LAYER_WAITS_FOR_ITS_CODE", rows.every((row) => row.ok), {
    runs: rows.length,
    failing: rows.filter((row) => !row.ok),
  });
}

// L3 — readiness counts from the game's own mount: the fallback starts there, an explicit game is waited for.
{
  const rows = lazyRuns.map(({ gameId, skipIntro, onArrival, end }) => {
    const { readiness, component } = subjects[gameId];
    const actual = { tree: onArrival.tree, framesRequestedAtGameMount: onArrival.framesRequestedAtGameMount, ...end };
    const expected = {
      tree: expectedTree({ component, gameId, skipIntro, started: false }),
      framesRequestedAtGameMount: EXPECTED_FRAMES[readiness].framesRequestedAtGameMount,
      readyAt: readiness === "explicit" ? ["game-reports"] : ["frame-2"],
      framesRequested: EXPECTED_FRAMES[readiness].framesRequested,
      framesPendingAtEnd: 0,
      loads: 1,
      errors: 0,
      gameAbsentAt: [],
    };
    return { gameId, skipIntro, ok: lazyFor(gameId) && same(actual, expected), loader: lazyFor(gameId), actual };
  });
  record("L3", "READINESS_COUNTS_FROM_GAME_MOUNT", rows.every((row) => row.ok), {
    runs: rows.length,
    failing: rows.filter((row) => !row.ok),
    readyAt: Object.fromEntries(rows.filter((row) => !row.skipIntro).map((row) => [row.gameId, row.actual.readyAt])),
  });
}

// L4 — a chunk that cannot be fetched reaches the current onEntryError once; the game never mounts, nothing is counted.
{
  const rows = [];
  for (const gameId of subjectIds) {
    for (const [kind, reason] of [["ChunkLoadError", chunkLoadError()], ["non-Error", "network down"]]) {
      const screen = mount({ gameId });
      await perform(screen, "intro-ready");
      // The parent re-renders with a new callback while the code is on its way: the failure belongs to it.
      screen.rerender("new-callback", {
        onEntryError: (...received) => screen.log.errors.push({ via: "latest", step: "chunk-fails", received }),
      });
      await screen.fail("chunk-fails", reason);
      for (const step of frameSteps) await perform(screen, step);
      await perform(screen, "parent-rerender");
      const [call] = screen.log.errors;
      const received = call?.received ?? [];
      const actual = {
        errorCalls: screen.log.errors.length,
        via: call?.via ?? null,
        arity: received.length,
        sameError: kind === "ChunkLoadError" ? received[0] === reason : null,
        isError: received[0] instanceof Error,
        hasMessage: typeof received[0]?.message === "string" && received[0].message.length > 0,
        gameInTree: Boolean(findGame(screen.tree)),
        readyAt: screen.log.readyAt,
        framesRequested: screen.frames.counts.requested,
        loads: screen.chunks.calls.length,
      };
      const expected = {
        errorCalls: 1,
        via: "latest",
        arity: 1,
        sameError: kind === "ChunkLoadError" ? true : null,
        isError: true,
        hasMessage: true,
        gameInTree: false,
        readyAt: [],
        framesRequested: 0,
        loads: 1,
      };
      rows.push({ gameId, kind, ok: lazyFor(gameId) && same(actual, expected), loader: lazyFor(gameId), actual });
    }
  }
  record("L4", "CHUNK_FAILURE_REACHES_ON_ENTRY_ERROR", rows.every((row) => row.ok), {
    runs: rows.length,
    failing: rows.filter((row) => !row.ok),
  });
}

// L5 — retry is a new session (page.tsx remounts GameScreen): it fetches again and enters as if nothing had failed.
{
  const rows = [];
  for (const gameId of subjectIds) {
    const failed = mount({ gameId, sessionKey: 7 });
    await failed.fail("chunk-fails", chunkLoadError());
    failed.unmount();
    const retry = mount({ gameId, sessionKey: 8 });
    const loadsAtMount = retry.chunks.calls.length;
    for (const step of SCENARIOS["intro-first"].steps) await perform(retry, step);
    // Anything the failed session still held must stay silent.
    failed.frames.tick();
    failed.frames.tick();
    const actual = {
      failedSession: {
        errorCalls: failed.log.errors.length,
        readyAt: failed.log.readyAt,
        lateSetState: failed.log.lateSetState,
      },
      retry: {
        loadsAtMount,
        errorCalls: retry.log.errors.length,
        gameMounted: Boolean(findGame(retry.tree)),
        readyAt: retry.log.readyAt,
      },
    };
    const expected = {
      failedSession: { errorCalls: 1, readyAt: [], lateSetState: 0 },
      retry: {
        loadsAtMount: 1,
        errorCalls: 0,
        gameMounted: true,
        readyAt: EXPECTED_READY_AT[subjects[gameId].readiness]["intro-first"],
      },
    };
    rows.push({ gameId, ok: lazyFor(gameId) && same(actual, expected), loader: lazyFor(gameId), actual });
  }
  record("L5", "RETRY_FETCHES_AGAIN", rows.every((row) => row.ok), {
    failing: rows.filter((row) => !row.ok),
  });
}

// L6 — leaving while the code is on its way: when it lands (or fails) afterwards, nothing happens.
{
  const rows = [];
  for (const gameId of subjectIds) {
    for (const outcome of ["arrives", "fails"]) {
      const screen = mount({ gameId });
      await perform(screen, "intro-ready");
      screen.unmount();
      if (outcome === "arrives") await screen.deliver("late-chunk");
      else await screen.fail("late-chunk", chunkLoadError());
      screen.frames.tick();
      screen.frames.tick();
      const actual = {
        readyAt: screen.log.readyAt,
        errorCalls: screen.log.errors.length,
        lateSetState: screen.log.lateSetState,
        framesRequested: screen.frames.counts.requested,
        loads: screen.chunks.calls.length,
      };
      const expected = { readyAt: [], errorCalls: 0, lateSetState: 0, framesRequested: 0, loads: 1 };
      rows.push({ gameId, outcome, ok: lazyFor(gameId) && same(actual, expected), loader: lazyFor(gameId), actual });
    }
  }
  record("L6", "UNMOUNT_WHILE_LOADING_IS_SILENT", rows.every((row) => row.ok), {
    runs: rows.length,
    failing: rows.filter((row) => !row.ok),
  });
}

// L7 — one load per session: parent re-renders never fetch again; StrictMode's double effect mounts one game.
{
  const rows = [];
  for (const gameId of subjectIds) {
    const screen = mount({ gameId });
    const fresh = (label) => ({
      onEntryReady: () => screen.log.readyAt.push(label),
      onEntryError: (...received) => screen.log.errors.push({ via: label, received }),
      onExit: () => {},
      onComplete: () => {},
    });
    for (const label of ["rerender-1", "rerender-2", "rerender-3"]) screen.rerender(label, fresh(label));
    await perform(screen, "chunk");
    for (const label of ["rerender-4", "rerender-5"]) screen.rerender(label, fresh(label));
    const strict = mount({ gameId, strict: true });
    await perform(strict, "chunk");
    const actual = {
      loads: screen.chunks.calls.length,
      gameMounted: Boolean(findGame(screen.tree)),
      strict: {
        gamesMounted: countElements(strict.tree, isGame),
        errorCalls: strict.log.errors.length,
        lateSetState: strict.log.lateSetState,
      },
    };
    const expected = { loads: 1, gameMounted: true, strict: { gamesMounted: 1, errorCalls: 0, lateSetState: 0 } };
    rows.push({
      gameId,
      ok: lazyFor(gameId) && same(actual, expected),
      loader: lazyFor(gameId),
      actual,
      strictLoads: strict.chunks.calls.length,
    });
  }
  record("L7", "ONE_LOAD_PER_SESSION", rows.every((row) => row.ok), {
    failing: rows.filter((row) => !row.ok),
    strictModeLoads: Object.fromEntries(rows.map((row) => [row.gameId, row.strictLoads])),
  });
}

// L8 — the Home's static imports carry no game code; the registry reaches each game only through import().
{
  const graph = importGraph();
  const isGameCode = (file) => file.startsWith("src/games/") && file !== REGISTRY && file !== ENTRY_CONTRACT;
  const homeClosure = closure(graph, HOME, ["runtime"]);
  const registryEdges = graph.edges.get(REGISTRY) ?? [];
  const eagerGameCode = homeClosure.filter(isGameCode);
  const registryStaticGameImports = registryEdges
    .filter((edge) => edge.kind === "runtime" && isGameCode(edge.to))
    .map((edge) => edge.to);
  const registryDynamicImports = registryEdges.filter((edge) => edge.kind === "dynamic").map((edge) => edge.to).sort();
  const expectedDynamicImports = subjectIds
    .map((gameId) => graph.resolve(REGISTRY, moduleOf(gameId) ?? ""))
    .sort();
  record(
    "L8",
    "HOME_IMPORTS_NO_GAME_CODE",
    homeClosure.includes(SCREEN) &&
      homeClosure.includes(REGISTRY) &&
      eagerGameCode.length === 0 &&
      registryStaticGameImports.length === 0 &&
      same(registryDynamicImports, expectedDynamicImports),
    {
      homeStaticModules: homeClosure.length,
      eagerGameCode,
      registryStaticGameImports,
      registryDynamicImports,
      expectedDynamicImports,
    },
  );
}

console.log("\ncomportamento por jogo (onEntryReady chega ao pai em):");
for (const gameId of subjectIds) {
  const row = behaviour[gameId];
  console.log(
    `  ${gameId.padEnd(15)} ${subjects[gameId].readiness.padEnd(15)} intro-first=${row["intro-first"]} · game-first=${row["game-first"]} · skip-intro=${row["skip-intro"]}`,
  );
}
console.log("\ncódigo de cada jogo (como o registry o entrega):");
for (const gameId of subjectIds) {
  const resolved = RESOLVED[gameId];
  console.log(
    `  ${gameId.padEnd(15)} ${(resolved?.via ?? "absent").padEnd(7)} ${resolved?.via === "loader" ? `import() sob demanda -> ${resolved.imports.join(", ") || "nada"}` : "importado junto com o registry"}`,
  );
}

const allPass = tests.every((t) => t.pass);
console.log(
  `\n${REV ? `rev ${REV} · ` : ""}${tests.filter((t) => t.pass).length}/${tests.length} passed · failing: ${tests.filter((t) => !t.pass).map((t) => t.id).join(", ") || "none"}`,
);
console.log(allPass ? "GAME_READINESS_REGISTRY_OK" : "GAME_READINESS_REGISTRY_FAILED");
process.exitCode = allPass ? EXIT_OK : EXIT_VALIDATION_FAILED;
