/**
 * ROUTE-BOARD-CHUNK-ERROR-01 — the Rota's board code, loaded by the Rota itself.
 *
 * `RouteStrategyGame` does not ship the Babylon board: `RouteBabylonBoard` is a
 * chunk of its own, fetched after the Rota mounts (and Babylon only once the
 * board mounts). That load used to be `next/dynamic`, which is one module-level
 * `React.lazy` behind a Suspense fallback. A chunk that could not be fetched was
 * thrown from the render — past the Rota, past GameScreen, to the page's own
 * boundary ("This page couldn’t load") — and the lazy kept that rejection, so no
 * later session could load the board either.
 *
 * The contract now: the board's code is a literal `import()` the Rota starts on
 * mount; until it lands the canvas shows the same loading line; a failure goes
 * to the current onEntryError, once; the retry (a new session, so a new mount)
 * fetches again; a Rota that has gone never reacts to a late arrival.
 *
 * This runs the REAL `RouteStrategyGame`, compiled from source and unmodified,
 * under:
 *
 *   - stubs for what it renders and reads (gameplay hook, icons, motion), so
 *     only the Rota's own render runs, and a board stub that is never rendered:
 *     the checks read the element the Rota hands it;
 *   - a virtual chunk gate: every `import()` the Rota starts is held until a test
 *     delivers the module or fails it the way a chunk that cannot be fetched
 *     does (a `ChunkLoadError`, or a non-Error rejection);
 *   - a small React: ordered hook cells, effects with deps and cleanups, a real
 *     unmount, StrictMode's dev double-invoke on demand;
 *   - for revisions that still use `next/dynamic`: a model of
 *     `next/dist/shared/lib/lazy-dynamic/loadable.js` — one `React.lazy` per
 *     `dynamic()` call, created when the module is evaluated, rendered through a
 *     Suspense whose fallback is `loading`. A rejected lazy throws from the
 *     render; nothing below the page catches it. Every render of a mount is
 *     expanded through it, and so is every settled load (React pings the
 *     Suspense boundary when the lazy settles).
 *
 * One evaluation of the module is one page load: every mount of a check shares
 * it, as every session in a tab does.
 *
 * Usage: node tools/validation/route-board-loader-tests.mjs [--rev=<commit>]
 *
 *   --rev=<commit>  run against the sources as they were at <commit> (read with
 *                   `git show`; nothing is checked out or written).
 *                   `--rev=c34b274` is the `next/dynamic` board: R1, R2 and R5
 *                   hold; R3, R4, R6 (its StrictMode failure) and R7 fail.
 *
 * Writes nothing. Exit 0 = every check holds, 1 = a check failed, 3 = usage error.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";

const GAME = "src/games/escape-maze/RouteStrategyGame.tsx";
const BOARD = "src/games/escape-maze/RouteBabylonBoard.tsx";
const BOARD_SPECIFIER = "@/games/escape-maze/RouteBabylonBoard";
const CONTINUATION = "src/games/escape-maze/continuation.ts";
const CONTINUATION_SPECIFIER = "@/games/escape-maze/continuation";
const LOADING_TEXT = "Preparando o tabuleiro Babylon…";

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
if (args.some((arg) => arg !== revArg) || REV === "") {
  console.error("usage: node tools/validation/route-board-loader-tests.mjs [--rev=<commit>]");
  process.exit(EXIT_USAGE);
}

const readSource = (file) =>
  REV
    ? execFileSync("git", ["show", `${REV}:${file}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    : fs.readFileSync(path.resolve(file), "utf8");

/**
 * `import()` becomes a call to the sandbox's chunk gate. Done on the AST, before
 * the CommonJS transform, so the gate sees exactly the specifier the source names.
 */
const gateDynamicImports = (context) => (sourceFile) => {
  const visit = (node) => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      return context.factory.createCallExpression(
        context.factory.createIdentifier("__chunkGate"),
        undefined,
        ts.visitNodes(node.arguments, visit),
      );
    }
    return ts.visitEachChild(node, visit, context);
  };
  return ts.visitNode(sourceFile, visit);
};

const GAME_SOURCE = readSource(GAME);
const GAME_JS = ts.transpileModule(GAME_SOURCE, {
  compilerOptions: {
    esModuleInterop: true,
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.ReactJSX,
  },
  fileName: GAME,
  transformers: { before: [gateDynamicImports] },
}).outputText;
const codeOnly = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
/**
 * The session the Rota is mounted on, in the form the Rota at this revision
 * takes it: one typed continuation since GAME-CONTINUATION-CONTRACT-01, two
 * Route fields before it. The gameplay hook is a stub, so it only has to match
 * the fixture below (Route 3, medium).
 */
const SESSION_CONTINUATION = /\bcontinuation\b/.test(codeOnly(GAME_SOURCE))
  ? { continuation: { kind: "escape-maze-route", routeNumber: 3, difficulty: "medium" } }
  : { initialRouteNumber: 3, initialDifficulty: "medium" };

let continuationModule = null;
/** The Rota's real continuation reader, compiled from source the first time a revision imports it. */
function loadContinuationModule() {
  if (!continuationModule) {
    const js = ts.transpileModule(readSource(CONTINUATION), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
      fileName: CONTINUATION,
    }).outputText;
    const mod = { exports: {} };
    vm.runInNewContext(js, {
      module: mod,
      exports: mod.exports,
      require: (specifier) => {
        throw new Error(`unexpected import ${specifier} in ${CONTINUATION}`);
      },
    });
    continuationModule = mod.exports;
  }
  return continuationModule;
}

/** Key-order-insensitive structural equality. */
const canonical = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v,
  );
const same = (a, b) => canonical(a) === canonical(b);

const flushMicrotasks = async () => {
  for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setImmediate(resolve));
};

const chunkLoadError = () =>
  Object.assign(new Error("Failed to load chunk /_next/static/chunks/board.js from module 947276"), {
    name: "ChunkLoadError",
  });

// --- stubs ------------------------------------------------------------------------------

const JSX_RUNTIME = {
  Fragment: Symbol.for("react.fragment"),
  jsx: (type, props, key) => ({ type, props, key: key === undefined ? null : String(key) }),
};
JSX_RUNTIME.jsxs = JSX_RUNTIME.jsx;

const tagged = (tag) => {
  const component = () => {
    throw new Error(`${tag} rendered: only the Rota renders here`);
  };
  component.tag = tag;
  return component;
};
const BoardStub = tagged(`${BOARD_SPECIFIER}#RouteBabylonBoard`);
const BOARD_MODULE = { __esModule: true, RouteBabylonBoard: BoardStub };
const icons = new Map();
const LUCIDE = new Proxy(
  {},
  {
    get(_, name) {
      if (name === "__esModule") return true;
      if (typeof name !== "string") return undefined;
      if (!icons.has(name)) icons.set(name, tagged(`lucide-react#${name}`));
      return icons.get(name);
    },
  },
);
const motionTags = new Map();
const MOTION = {
  motion: new Proxy(
    {},
    {
      get(_, name) {
        if (!motionTags.has(name)) motionTags.set(name, tagged(`motion.${String(name)}`));
        return motionTags.get(name);
      },
    },
  ),
  useReducedMotion: () => false,
};

/** A Rota at its setup screen. Stable identities, so memoised derivations stay put. */
const posKey = (p) => `${p.row},${p.col}`;
const noop = () => {};
const GAME_STATE = {
  difficulty: "medium",
  routeNumber: 3,
  routeProgression: { label: "Rota em construção", description: "Uma rota calma." },
  mazeMap: {
    walls: new Set(["1,1"]),
    exitPosition: { row: 0, col: 8 },
    collectibleStars: [{ row: 4, col: 4 }],
    traps: [],
    chest: null,
  },
  walls: new Set(["1,1"]),
  player: { row: 8, col: 0 },
  guardian: { row: 0, col: 0 },
  sentinel: { row: 0, col: 7 },
  sentinelTarget: null,
  collectedSet: new Set(),
  collectedCount: 0,
  totalLights: 1,
  portalActive: false,
  turns: 0,
  blockedMoves: 0,
  errors: 0,
  status: "setup",
  message: "Escolha o modo e inicie a rota.",
  score: 0,
  blockedShake: 0,
  triggeredTrapSet: new Set(),
  trapsTriggered: 0,
  chestOpened: false,
  rewardSelected: null,
  rewardChoicePending: false,
  pickaxeAvailable: false,
  pickaxeSpent: false,
  secondChanceAvailable: false,
  secondChanceSpent: false,
  brokenWall: null,
  breakTargets: [],
  startGame: noop,
  restartGame: noop,
  changeDifficulty: noop,
  tryMovePlayer: () => {},
  chooseReward: noop,
  breakWall: noop,
  // ROUTE-C7B: the board this stub hands over has been accepted; nothing is pending.
  generationPhase: "ready",
  requestedDifficulty: null,
  retryGeneration: noop,
};

/**
 * `next/dynamic`, as `loadable.js` builds it: the lazy exists from the moment
 * `dynamic()` runs (module evaluation), so it is shared by every mount and keeps
 * whatever its single load settled to.
 */
function nextDynamicModel(loader, options = {}) {
  const lazy = { status: "uninitialized", value: undefined };
  const Loadable = tagged("next/dynamic");
  Loadable.expand = (props) => {
    if (lazy.status === "uninitialized") {
      lazy.status = "pending";
      loader().then(
        (mod) => {
          lazy.status = "resolved";
          lazy.value = mod && typeof mod === "object" && "default" in mod ? mod.default : mod;
        },
        (error) => {
          lazy.status = "rejected";
          lazy.value = error;
        },
      );
    }
    if (lazy.status === "pending") return options.loading ? options.loading() : null;
    if (lazy.status === "resolved") return JSX_RUNTIME.jsx(lazy.value, props);
    throw lazy.value;
  };
  return Loadable;
}

// --- one page load: the module, evaluated once ------------------------------------------------

function createChunkGate() {
  const held = [];
  const calls = [];
  return {
    calls,
    get held() {
      return held.length;
    },
    import(specifier, step) {
      calls.push({ specifier, step });
      return new Promise((resolve, reject) => held.push({ specifier, resolve, reject }));
    },
    async deliver() {
      for (const { specifier, resolve, reject } of held.splice(0)) {
        if (specifier === BOARD_SPECIFIER) resolve(BOARD_MODULE);
        else reject(new Error(`no module for ${specifier}`));
      }
      await flushMicrotasks();
    },
    async fail(reason) {
      for (const { reject } of held.splice(0)) reject(reason);
      await flushMicrotasks();
    },
  };
}

const sameDeps = (a, b) =>
  Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));

/**
 * React's hooks for whichever mount is rendering right now: the module is
 * shared, the hook cells are per mount.
 */
function createReactShim(current) {
  const store = () => current.store;
  const effect = (layout) => (run, deps) => {
    const s = store();
    const i = s.index++;
    const cell = s.cells[i] ?? (s.cells[i] = { effect: true, layout });
    if (cell.deps === undefined || !sameDeps(cell.deps, deps)) s.pending.push({ cell, run, deps });
  };
  return {
    useState(initial) {
      const s = store();
      const i = s.index++;
      if (!(i in s.cells)) s.cells[i] = { value: typeof initial === "function" ? initial() : initial };
      const cell = s.cells[i];
      const setter =
        cell.setter ??
        (cell.setter = (next) => {
          if (!s.mounted) {
            s.lateSetState += 1;
            return;
          }
          const value = typeof next === "function" ? next(cell.value) : next;
          if (Object.is(value, cell.value)) return;
          cell.value = value;
          s.dirty = true;
        });
      return [cell.value, setter];
    },
    useRef(initial) {
      const s = store();
      const i = s.index++;
      if (!(i in s.cells)) s.cells[i] = { current: initial };
      return s.cells[i];
    },
    useMemo(factory, deps) {
      const s = store();
      const i = s.index++;
      const cell = s.cells[i];
      if (cell && sameDeps(cell.deps, deps)) return cell.value;
      s.cells[i] = { value: factory(), deps };
      return s.cells[i].value;
    },
    useCallback(fn, deps) {
      return this.useMemo(() => fn, deps);
    },
    useEffect: effect(false),
    useLayoutEffect: effect(true),
  };
}

function loadPage() {
  const gate = createChunkGate();
  const current = { store: null, step: "load" };
  const react = createReactShim(current);
  const modules = {
    react,
    "react/jsx-runtime": JSX_RUNTIME,
    "motion/react": MOTION,
    "lucide-react": LUCIDE,
    "next/dynamic": { __esModule: true, default: nextDynamicModel },
    "@/lib/feedback-motion": { gentleShakeAnimate: {} },
    "@/games/escape-maze/useEscapeMaze": { COLS: 9, ROWS: 9, posKey, useEscapeMaze: () => GAME_STATE },
    "@/components/worlds/master-scene/worldMasterSceneConfig": { getWorldMasterSceneStyle: () => ({}) },
  };
  const mod = { exports: {} };
  const sandbox = {
    module: mod,
    exports: mod.exports,
    console,
    // One realm, as in a browser: an Error the gate rejects with is an Error here too.
    Error,
    Promise,
    requestAnimationFrame: () => 0,
    __chunkGate: (specifier) => gate.import(specifier, current.step),
    require: (specifier) => {
      if (specifier.endsWith(".css")) return {};
      if (specifier in modules) return modules[specifier];
      if (specifier === CONTINUATION_SPECIFIER) return loadContinuationModule();
      throw new Error(`unexpected import ${specifier}`);
    },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  new vm.Script(GAME_JS, { filename: GAME }).runInContext(sandbox);
  const { RouteStrategyGame } = mod.exports;
  if (typeof RouteStrategyGame !== "function") throw new Error(`${GAME} exports no RouteStrategyGame`);
  return { RouteStrategyGame, gate, current };
}

// --- one mounted Rota ----------------------------------------------------------------------------

const isElement = (node) => node !== null && typeof node === "object" && "type" in node && "props" in node;
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
/**
 * The tree with `next/dynamic` expanded the way it renders right now. A throw is
 * an error leaving the Rota for the page's boundary; it is recorded once per error.
 */
function expand(node, escapes) {
  if (!isElement(node)) return node;
  // ROUTE-C7B: the Rota renders its board view through a component of its own module (`RouteSessionView`). It is
  // rendered inline, as React would render it: its hooks take the next cells of this mount, in order. Stubs (tagged)
  // are never rendered.
  if (typeof node.type === "function" && !node.type.tag && typeof node.type.expand !== "function") {
    return expand(node.type(node.props), escapes);
  }
  if (typeof node.type?.expand === "function") {
    try {
      return expand(node.type.expand(node.props), escapes);
    } catch (error) {
      if (!escapes.includes(error)) escapes.push(error);
      return { type: "<thrown to the page's error boundary>", props: {} };
    }
  }
  const children = node.props.children;
  if (children === undefined) return node;
  const next = Array.isArray(children) ? children.map((child) => expand(child, escapes)) : expand(children, escapes);
  return { ...node, props: { ...node.props, children: next } };
}

function mount(page, { strict = false, label = "rota" } = {}) {
  const store = { cells: [], index: 0, dirty: false, mounted: true, pending: [], lateSetState: 0 };
  const log = { readyAt: [], errors: [], escapes: [] };
  let step = "mount";
  let tree = null;
  /** `tree` as rendered down through `next/dynamic` (the same tree when there is none). */
  let rendered = null;
  let props = {
    onComplete: noop,
    onExit: noop,
    ...SESSION_CONTINUATION,
    onEntryReady: (...received) => log.readyAt.push({ step, received }),
    onEntryError: (...received) => log.errors.push({ via: "initial", step, received }),
  };

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
      if ((passes += 1) > 16) throw new Error("RouteStrategyGame did not settle");
      page.current.store = store;
      page.current.step = `${label}:${step}`;
      store.index = 0;
      store.dirty = false;
      tree = page.RouteStrategyGame(props);
      rendered = expand(tree, log.escapes);
      commit();
    } while (store.dirty);
  };
  /** A settled load re-renders what waited on it: GameScreen's state, or the lazy's Suspense. */
  const settle = () => {
    if (!store.mounted) return;
    // A full render: since ROUTE-C7B the tree holds components of the Rota's own module, whose hooks only have their
    // cells when rendered after the Rota's, in order.
    render();
  };

  render();
  if (strict) {
    for (const cell of effectCells()) if (typeof cell.cleanup === "function") cell.cleanup();
    for (const cell of effectCells()) cell.cleanup = cell.run();
    settle();
  }

  return {
    log,
    store,
    get props() {
      return props;
    },
    /** The canvas slot as the Explorador would see it now (null once unmounted). */
    canvas() {
      if (!store.mounted) return null;
      const slot = findElement(rendered, (el) => el.props?.className === "rsg-canvas");
      if (!slot) return { found: false };
      return { found: true, children: childrenOf(slot) };
    },
    async deliver(label2) {
      step = label2;
      await page.gate.deliver();
      settle();
    },
    async fail(label2, reason) {
      step = label2;
      await page.gate.fail(reason);
      settle();
    },
    rerender(label2, next) {
      step = label2;
      props = { ...props, ...next };
      if (store.mounted) render();
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

const LOADING_ELEMENT = { type: "div", props: { className: "rsg-canvas-loading", children: LOADING_TEXT } };
const isLoading = (el) => same({ type: el.type, props: el.props }, LOADING_ELEMENT);
const isBoard = (el) => el.type === BoardStub;
const BOARD_PROP_KEYS = [
  "aimedWall",
  "breakTargets",
  "brokenWall",
  "chestOpened",
  "collectedSet",
  "dangerTiles",
  "guardian",
  "mazeMap",
  "moveTargets",
  "onError",
  "onMove",
  "onReady",
  "player",
  "reducedMotion",
  "sentinel",
  "sentinelCommitted",
  "status",
  "triggeredTrapSet",
  "walls",
];
/** What the slot shows, as a short name; anything unexpected is spelled out. */
function describeSlot(rota) {
  const canvas = rota.canvas();
  if (!canvas) return "unmounted";
  if (!canvas.found) return "no .rsg-canvas";
  return canvas.children.map((el) =>
    isLoading(el)
      ? "loading"
      : isBoard(el)
        ? "board"
        : typeof el.type === "string"
          ? `<${el.type} ${JSON.stringify(el.props)}>`
          : String(el.type?.tag ?? el.type),
  );
}
const boardImports = (page) => page.gate.calls.filter((call) => call.specifier === BOARD_SPECIFIER).length;
const otherImports = (page) => page.gate.calls.filter((call) => call.specifier !== BOARD_SPECIFIER).map((c) => c.specifier);

// --- checks ------------------------------------------------------------------------------------

const tests = [];
const record = (id, name, pass, detail) => {
  tests.push({ id, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${name}`);
  for (const [k, v] of Object.entries(detail)) {
    console.log(`        ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  }
};

// R1 — until the board's code lands, the canvas shows the loading line it always showed, and the load has started.
{
  const page = loadPage();
  const importsAtEvaluation = page.gate.calls.length;
  const rota = mount(page);
  for (const label of ["rerender-1", "rerender-2"]) {
    rota.rerender(label, { onEntryReady: () => rota.log.readyAt.push({ step: label }) });
  }
  const actual = {
    importsAtEvaluation,
    slot: describeSlot(rota),
    boardImports: boardImports(page),
    otherImports: otherImports(page),
    readyCalls: rota.log.readyAt.length,
    errorCalls: rota.log.errors.length,
    escapes: rota.log.escapes.length,
  };
  const expected = {
    importsAtEvaluation: 0,
    slot: ["loading"],
    boardImports: 1,
    otherImports: [],
    readyCalls: 0,
    errorCalls: 0,
    escapes: 0,
  };
  record("R1", "LOADING_UNTIL_BOARD_CODE_ARRIVES", same(actual, expected), { actual });
}

// R2 — when it lands, the board takes the loading line's place with every prop it had; readiness stays the board's.
{
  const page = loadPage();
  const rota = mount(page);
  await rota.deliver("board-arrives");
  for (const label of ["rerender-1", "rerender-2"]) rota.rerender(label, {});
  const board = rota.canvas().children.find(isBoard);
  const actual = {
    slot: describeSlot(rota),
    boardImports: boardImports(page),
    propKeys: board ? Object.keys(board.props).sort() : null,
    onReadyIsOnEntryReady: board?.props.onReady === rota.props.onEntryReady,
    onErrorIsOnEntryError: board?.props.onError === rota.props.onEntryError,
    onMoveIsTryMovePlayer: board?.props.onMove === GAME_STATE.tryMovePlayer,
    mazeMap: board?.props.mazeMap === GAME_STATE.mazeMap,
    readyCalls: rota.log.readyAt.length,
    errorCalls: rota.log.errors.length,
    escapes: rota.log.escapes.length,
    lateSetState: rota.store.lateSetState,
  };
  const expected = {
    slot: ["board"],
    boardImports: 1,
    propKeys: BOARD_PROP_KEYS,
    onReadyIsOnEntryReady: true,
    onErrorIsOnEntryError: true,
    onMoveIsTryMovePlayer: true,
    mazeMap: true,
    readyCalls: 0,
    errorCalls: 0,
    escapes: 0,
    lateSetState: 0,
  };
  record("R2", "BOARD_MOUNTS_WITH_ITS_PROPS", same(actual, expected), { actual });
}

// R3 — a board chunk that cannot be fetched reaches the CURRENT onEntryError once; nothing escapes the Rota.
{
  const rows = [];
  for (const [kind, reason] of [["ChunkLoadError", chunkLoadError()], ["non-Error", "network down"]]) {
    const page = loadPage();
    const rota = mount(page);
    // The parent re-renders with a new callback while the code is on its way: the failure belongs to it.
    rota.rerender("new-callback", {
      onEntryError: (...received) => rota.log.errors.push({ via: "latest", received }),
    });
    await rota.fail("chunk-fails", reason);
    const slot = describeSlot(rota);
    for (const label of ["after-1", "after-2"]) rota.rerender(label, {});
    const [call] = rota.log.errors;
    const received = call?.received ?? [];
    const actual = {
      errorCalls: rota.log.errors.length,
      via: call?.via ?? null,
      arity: received.length,
      sameError: kind === "ChunkLoadError" ? received[0] === reason : null,
      isError: received[0] instanceof Error,
      hasMessage: typeof received[0]?.message === "string" && received[0].message.length > 0,
      escapes: rota.log.escapes.map((e) => String(e?.name ?? e)),
      slot,
      readyCalls: rota.log.readyAt.length,
      boardImports: boardImports(page),
    };
    const expected = {
      errorCalls: 1,
      via: "latest",
      arity: 1,
      sameError: kind === "ChunkLoadError" ? true : null,
      isError: true,
      hasMessage: true,
      escapes: [],
      slot: ["loading"],
      readyCalls: 0,
      boardImports: 1,
    };
    rows.push({ kind, ok: same(actual, expected), actual });
  }
  record("R3", "BOARD_CHUNK_FAILURE_REACHES_ON_ENTRY_ERROR", rows.every((row) => row.ok), {
    failing: rows.filter((row) => !row.ok),
  });
}

// R4 — the retry is a new session (GameScreen remounts the Rota): it fetches the board again and gets it.
{
  const page = loadPage();
  const failed = mount(page, { label: "session-7" });
  await failed.fail("chunk-fails", chunkLoadError());
  failed.unmount();
  const retry = mount(page, { label: "session-8" });
  const importsAtRetryMount = boardImports(page);
  const slotWhileLoading = describeSlot(retry);
  await retry.deliver("board-arrives");
  const actual = {
    failedSession: {
      errorCalls: failed.log.errors.length,
      readyCalls: failed.log.readyAt.length,
      lateSetState: failed.store.lateSetState,
    },
    retry: {
      boardImportsAtMount: importsAtRetryMount,
      slotWhileLoading,
      slot: describeSlot(retry),
      errorCalls: retry.log.errors.length,
      escapes: [...failed.log.escapes, ...retry.log.escapes].map((e) => String(e?.name ?? e)),
      onReadyIsOnEntryReady: retry.canvas().children.find(isBoard)?.props.onReady === retry.props.onEntryReady,
    },
  };
  const expected = {
    failedSession: { errorCalls: 1, readyCalls: 0, lateSetState: 0 },
    retry: {
      boardImportsAtMount: 2,
      slotWhileLoading: ["loading"],
      slot: ["board"],
      errorCalls: 0,
      escapes: [],
      onReadyIsOnEntryReady: true,
    },
  };
  record("R4", "RETRY_FETCHES_THE_BOARD_AGAIN", same(actual, expected), { actual });
}

// R5 — leaving while the board's code is on its way: when it lands (or fails) afterwards, nothing happens.
{
  const rows = [];
  for (const outcome of ["arrives", "fails"]) {
    const page = loadPage();
    const rota = mount(page);
    rota.unmount();
    if (outcome === "arrives") await rota.deliver("late-chunk");
    else await rota.fail("late-chunk", chunkLoadError());
    const actual = {
      readyCalls: rota.log.readyAt.length,
      errorCalls: rota.log.errors.length,
      lateSetState: rota.store.lateSetState,
      escapes: rota.log.escapes.length,
      boardImports: boardImports(page),
    };
    const expected = { readyCalls: 0, errorCalls: 0, lateSetState: 0, escapes: 0, boardImports: 1 };
    rows.push({ outcome, ok: same(actual, expected), actual });
  }
  record("R5", "UNMOUNT_WHILE_LOADING_IS_SILENT", rows.every((row) => row.ok), {
    failing: rows.filter((row) => !row.ok),
  });
}

// R6 — one load per mount: new callbacks never fetch again; StrictMode's double effect mounts one board and reports one failure.
{
  const page = loadPage();
  const rota = mount(page);
  const fresh = (label) => ({
    onEntryReady: () => rota.log.readyAt.push({ step: label }),
    onEntryError: (...received) => rota.log.errors.push({ via: label, received }),
    onExit: () => {},
    onComplete: () => {},
  });
  for (const label of ["rerender-1", "rerender-2", "rerender-3"]) rota.rerender(label, fresh(label));
  await rota.deliver("board-arrives");
  for (const label of ["rerender-4", "rerender-5"]) rota.rerender(label, fresh(label));

  const strictPage = loadPage();
  const strict = mount(strictPage, { strict: true });
  await strict.deliver("board-arrives");
  const strictFailPage = loadPage();
  const strictFail = mount(strictFailPage, { strict: true });
  await strictFail.fail("chunk-fails", chunkLoadError());

  const actual = {
    boardImports: boardImports(page),
    slot: describeSlot(rota),
    strict: {
      slot: describeSlot(strict),
      errorCalls: strict.log.errors.length,
      lateSetState: strict.store.lateSetState,
    },
    strictFailure: {
      slot: describeSlot(strictFail),
      errorCalls: strictFail.log.errors.length,
      lateSetState: strictFail.store.lateSetState,
    },
  };
  const expected = {
    boardImports: 1,
    slot: ["board"],
    strict: { slot: ["board"], errorCalls: 0, lateSetState: 0 },
    strictFailure: { slot: ["loading"], errorCalls: 1, lateSetState: 0 },
  };
  record("R6", "ONE_LOAD_PER_MOUNT", same(actual, expected), {
    actual,
    strictModeLoads: { delivered: boardImports(strictPage), failed: boardImports(strictFailPage) },
  });
}

// R7 — the board (and Babylon behind it) is reached only through import(), with nothing that caches a failed load.
{
  const importsOf = (file) => {
    const found = [];
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
        const named = bindings && ts.isNamedImports(bindings) ? bindings.elements.map((e) => (e.propertyName ?? e.name).text) : [];
        found.push({ specifier: node.moduleSpecifier.text, kind: typeOnly ? "type" : "static", named });
      } else if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments[0] &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        found.push({ specifier: node.arguments[0].text, kind: "dynamic", named: [] });
      }
      ts.forEachChild(node, visit);
    };
    visit(ts.createSourceFile(file, readSource(file), ts.ScriptTarget.Latest, true));
    return found;
  };
  const game = importsOf(GAME);
  const board = importsOf(BOARD);
  const actual = {
    gameReachesBoard: game.filter((i) => i.specifier === BOARD_SPECIFIER).map((i) => i.kind).sort(),
    gameStaticBabylon: game.filter((i) => i.kind === "static" && i.specifier.startsWith("@babylonjs/")).length,
    gameUsesNextDynamic: game.some((i) => i.specifier === "next/dynamic" && i.kind !== "type"),
    gameUsesReactLazy: game.some((i) => i.specifier === "react" && i.kind === "static" && i.named.includes("lazy")),
    boardStaticBabylon: board.filter((i) => i.kind === "static" && i.specifier.startsWith("@babylonjs/")).length,
    boardDynamicBabylon: board.filter((i) => i.kind === "dynamic" && i.specifier.startsWith("@babylonjs/")).map((i) => i.specifier).sort(),
  };
  const expected = {
    gameReachesBoard: actual.gameReachesBoard.includes("type") ? ["dynamic", "type"] : ["dynamic"],
    gameStaticBabylon: 0,
    gameUsesNextDynamic: false,
    gameUsesReactLazy: false,
    boardStaticBabylon: 0,
    boardDynamicBabylon: ["@babylonjs/core", "@babylonjs/loaders/glTF"],
  };
  record("R7", "BOARD_CODE_ONLY_THROUGH_IMPORT", same(actual, expected), { actual });
}

const allPass = tests.every((t) => t.pass);
console.log(
  `\n${REV ? `rev ${REV} · ` : ""}${tests.filter((t) => t.pass).length}/${tests.length} passed · failing: ${tests.filter((t) => !t.pass).map((t) => t.id).join(", ") || "none"}`,
);
console.log(allPass ? "ROUTE_BOARD_LOADER_OK" : "ROUTE_BOARD_LOADER_FAILED");
process.exitCode = allPass ? EXIT_OK : EXIT_VALIDATION_FAILED;
