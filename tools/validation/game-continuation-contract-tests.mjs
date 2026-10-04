/**
 * GAME-CONTINUATION-CONTRACT-01 — "play again" resumes through a typed
 * continuation, and the shell no longer speaks the Rota's protocol.
 *
 * The protocol this replaces, as it actually ran at 415cead:
 *
 *   useEscapeMaze#endGame   wrote `details.nextRouteNumber` (N + 1, won OR lost)
 *                           and `details.difficulty` into `GameResult.details`;
 *   app/page.tsx#playAgain  read them back — only when `gameId === "escape-maze"`,
 *                           narrowing the mode with its own `readDifficulty`, and
 *                           only when a `nextRouteNumber` was present — into
 *                           `initialRouteNumber` / `initialDifficulty` /
 *                           `skipGameIntro` (skip iff a Route number travelled);
 *   GameScreen              forwarded `initialRouteNumber` / `initialDifficulty`,
 *                           two Route fields in the props every game shares;
 *   RouteStrategyGame       handed them to `useEscapeMaze`.
 *
 * `details` — a loose record meant for history and the result screen — was the
 * control channel, and the shell was the only party that knew its keys. Results
 * read back from localStorage never took part: `lastResult` is only ever the
 * result the game just produced in this page session.
 *
 * The contract now: the game writes `GameResult.continuation`, a discriminated
 * union keyed by `kind` (one member today, the Rota's); page.tsx keeps it and
 * hands it back unopened; GameScreen carries it; only RouteStrategyGame reads
 * it, through `readRouteContinuation`, and anything that is not a well-formed
 * Route continuation is a fresh entry. `details` keeps every field it had.
 *
 * Everything runs the REAL code, compiled from source and unmodified, in stages
 * glued together by the props each stage hands the next — the way the
 * components hand them to each other:
 *
 *   the real useEscapeMaze (route-runtime-harness) plays a Route to its end;
 *   its onComplete payload goes to the REAL app/page.tsx, with the REAL
 *     world-entry controller and the REAL storage on a fake localStorage
 *     (HomeStage, RewardResultModal, WorldEntryTransition and GameScreen are
 *     read as the elements page.tsx renders, and driven through their props);
 *   the GameScreen element is mounted as the REAL GameScreen, over the REAL
 *     registry and entry contract (game modules stubbed);
 *   the game element GameScreen renders is mounted as the REAL
 *     RouteStrategyGame (its gameplay hook stubbed to record its arguments);
 *   and the real useEscapeMaze is mounted on exactly those arguments.
 *
 * Checks marked [contract] are what this mission introduces; [preserved] ones
 * pin behaviour that must not move (and hold on the old protocol too).
 *
 * ROUTE-JOURNEY-TERMINAL-01 gave the journey an end: three Routes; Route 1 and
 * 2 lead to N + 1 won or lost, Route 3 lost leads to Route 3 again, Route 3 won
 * completes the journey and writes no continuation. The checks below expect
 * exactly that (`expectedNextRoute`); the journeys through the shell leave a
 * completed journey the way its result screen does — back to the worlds — and
 * the [preserved] Route-to-Route checks hold for Routes 1 and 2, the hops that
 * existed before the end did. Everything specific to the end is in
 * route-journey-terminal-tests.mjs.
 *
 * Usage: node tools/validation/game-continuation-contract-tests.mjs [--rev=<commit>]
 *
 *   --rev=<commit>  run against every source as it was at <commit> — the
 *                   gameplay hook included — read with `git show`; nothing is
 *                   checked out or written. `--rev=415cead` is the protocol
 *                   above: every [contract] check fails, every [preserved] holds.
 *
 * Writes nothing. Exit 0 = every check holds, 1 = a check failed, 3 = usage error.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";
import { loadRouteRuntime, playToEnd } from "./route-runtime-harness.mjs";

const FILES = {
  types: "src/types/game.ts",
  page: "src/app/page.tsx",
  screen: "src/components/GameScreen.tsx",
  controller: "src/components/world-entry/useWorldEntryController.ts",
  entryTypes: "src/components/world-entry/worldEntryTypes.ts",
  registry: "src/games/index.ts",
  entryContract: "src/games/entry-contract.ts",
  rota: "src/games/escape-maze/RouteStrategyGame.tsx",
  hook: "src/games/escape-maze/useEscapeMaze.ts",
  routeContinuation: "src/games/escape-maze/continuation.ts",
  routeConfig: "src/games/escape-maze/route-config.ts",
  routeGeneration: "src/games/escape-maze/route-generation.ts",
  routeGeometry: "src/games/escape-maze/route-geometry.ts",
  routeDefenders: "src/games/escape-maze/route-defenders.ts",
  routeInvariants: "src/games/escape-maze/route-invariants.ts",
  routeState: "src/games/escape-maze/route-state.ts",
  routeEvents: "src/games/escape-maze/route-events.ts",
  storage: "src/engine/storage.ts",
  stageProgress: "src/engine/stage-progress.ts",
  routeRandom: "src/engine/route-random.ts",
  activities: "src/data/activities.ts",
  worlds: "src/data/worlds.ts",
  launcher: "src/app/lab/route-launcher/page.tsx",
};
const GAME_IDS = ["color-sequence", "escape-maze", "security-panel", "number-trail", "seed-garden"];
const ROUTE = "escape-maze";
const ROUTE_KIND = "escape-maze-route";
const MODES = ["easy", "medium", "hard"];
const OTHER_GAMES = GAME_IDS.filter((gameId) => gameId !== ROUTE);

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
if (args.some((arg) => arg !== revArg) || REV === "") {
  console.error("usage: node tools/validation/game-continuation-contract-tests.mjs [--rev=<commit>]");
  process.exit(EXIT_USAGE);
}
if (REV) {
  try {
    execFileSync("git", ["rev-parse", "--verify", `${REV}^{commit}`], { stdio: "ignore" });
  } catch {
    console.error(`unknown revision ${REV}`);
    process.exit(EXIT_USAGE);
  }
}

const sources = new Map();
/** Source at the requested revision, or null when the file does not exist there. */
function readSource(file) {
  if (!sources.has(file)) {
    let source = null;
    try {
      source = REV
        ? execFileSync("git", ["show", `${REV}:${file}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
        : fs.readFileSync(path.resolve(file), "utf8");
    } catch {
      // absent at this revision
    }
    sources.set(file, source);
  }
  return sources.get(file);
}

// --- compiling and evaluating the real modules ---------------------------------------

/** `import()` becomes a call to the sandbox's `__dynamicImport`, decided per stage. */
const gateDynamicImports = (context) => (sourceFile) => {
  const visit = (node) => {
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      return context.factory.createCallExpression(
        context.factory.createIdentifier("__dynamicImport"),
        undefined,
        ts.visitNodes(node.arguments, visit),
      );
    }
    return ts.visitEachChild(node, visit, context);
  };
  return ts.visitNode(sourceFile, visit);
};

const compiled = new Map();
function compile(file) {
  if (!compiled.has(file)) {
    const source = readSource(file);
    compiled.set(
      file,
      source === null
        ? null
        : ts.transpileModule(source, {
            compilerOptions: {
              esModuleInterop: true,
              module: ts.ModuleKind.CommonJS,
              target: ts.ScriptTarget.ES2020,
              jsx: ts.JsxEmit.ReactJSX,
            },
            fileName: file,
            transformers: { before: [gateDynamicImports] },
          }).outputText,
    );
  }
  return compiled.get(file);
}

const quietConsole = { ...console, error: () => {}, warn: () => {} };
function evaluate(file, globals, modules) {
  const js = compile(file);
  if (js === null) throw new Error(`${file} does not exist${REV ? ` at ${REV}` : ""}`);
  const mod = { exports: {} };
  const sandbox = {
    module: mod,
    exports: mod.exports,
    console: quietConsole,
    // One realm, as in a browser: an Error handed in is an Error in there too.
    Error,
    Promise,
    __dynamicImport: () => new Promise(() => {}),
    require: (specifier) => {
      if (specifier.endsWith(".css")) return {};
      const found = typeof modules === "function" ? modules(specifier) : modules[specifier];
      if (!found) throw new Error(`unexpected import ${specifier} in ${file}`);
      return found;
    },
    ...globals,
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  new vm.Script(js, { filename: file }).runInContext(sandbox);
  return mod.exports;
}

const flushMicrotasks = async () => {
  for (let i = 0; i < 4; i += 1) await new Promise((resolve) => setImmediate(resolve));
};

// --- a small React --------------------------------------------------------------------

const JSX_RUNTIME = {
  Fragment: Symbol.for("react.fragment"),
  jsx: (type, props, key) => ({ type, props, key: key === undefined ? null : String(key) }),
};
JSX_RUNTIME.jsxs = JSX_RUNTIME.jsx;

const sameDeps = (a, b) =>
  Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));

/** Ordered hook cells per mount, effects with deps and cleanups, re-render until settled. */
function createReact() {
  let current = null;
  const store = () => {
    if (!current) throw new Error("hook called outside a render");
    return current;
  };
  const effect = (layout) => (run, deps) => {
    const s = store();
    const i = s.index++;
    const cell = s.cells[i] ?? (s.cells[i] = { effect: true, layout });
    if (cell.deps === undefined || !sameDeps(cell.deps, deps)) s.pending.push({ cell, run, deps });
  };
  const react = {
    useState(initial) {
      const s = store();
      const i = s.index++;
      if (!(i in s.cells)) s.cells[i] = { value: typeof initial === "function" ? initial() : initial };
      const cell = s.cells[i];
      cell.setter ??= (next) => {
        if (!s.mounted) {
          s.lateSetState += 1;
          return;
        }
        const value = typeof next === "function" ? next(cell.value) : next;
        if (Object.is(value, cell.value)) return;
        cell.value = value;
        s.dirty = true;
      };
      return [cell.value, cell.setter];
    },
    useReducer(reducer, initialArg, init) {
      const s = store();
      const i = s.index++;
      if (!(i in s.cells)) s.cells[i] = { value: init ? init(initialArg) : initialArg };
      const cell = s.cells[i];
      cell.dispatch ??= (action) => {
        if (!s.mounted) {
          s.lateSetState += 1;
          return;
        }
        const value = reducer(cell.value, action);
        if (Object.is(value, cell.value)) return;
        cell.value = value;
        s.dirty = true;
      };
      return [cell.value, cell.dispatch];
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
      if (cell && deps !== undefined && sameDeps(cell.deps, deps)) return cell.value;
      s.cells[i] = { value: factory(), deps };
      return s.cells[i].value;
    },
    useCallback(fn, deps) {
      return react.useMemo(() => fn, deps);
    },
    useEffect: effect(false),
    useLayoutEffect: effect(true),
  };

  function mount(Component, initialProps) {
    const s = { cells: [], index: 0, dirty: false, mounted: true, pending: [], lateSetState: 0 };
    let props = initialProps;
    let tree = null;
    const commit = () => {
      const pending = s.pending.splice(0);
      for (const layout of [true, false]) {
        const group = pending.filter(({ cell }) => cell.layout === layout);
        for (const { cell } of group) {
          if (typeof cell.cleanup === "function") cell.cleanup();
          cell.cleanup = undefined;
        }
        for (const { cell, run, deps } of group) {
          cell.deps = deps;
          cell.cleanup = run();
        }
      }
    };
    const render = () => {
      let passes = 0;
      do {
        if ((passes += 1) > 32) throw new Error(`${Component.name} did not settle`);
        current = s;
        s.index = 0;
        s.dirty = false;
        try {
          tree = Component(props);
        } finally {
          current = null;
        }
        commit();
      } while (s.dirty);
    };
    render();
    return {
      get tree() {
        return tree;
      },
      store: s,
      /** One handler, one update: everything it set is rendered together, as React batches it. */
      act(fn) {
        const out = fn(tree);
        if (s.mounted && s.dirty) render();
        return out;
      },
      async settle() {
        await flushMicrotasks();
        if (s.mounted && s.dirty) render();
      },
      unmount() {
        s.mounted = false;
        for (const cell of s.cells) {
          if (cell?.effect && typeof cell.cleanup === "function") cell.cleanup();
        }
      },
    };
  }
  return { react, mount };
}

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
/** A component that is only ever read as an element, never rendered. */
const tagged = (tag) => {
  const component = () => {
    throw new Error(`${tag} rendered: only the stage under test renders here`);
  };
  component.tag = tag;
  return component;
};
const taggedProxy = (prefix) => {
  const made = new Map();
  return new Proxy(
    {},
    {
      get(_, name) {
        if (name === "__esModule") return true;
        if (typeof name !== "string") return undefined;
        if (!made.has(name)) made.set(name, tagged(`${prefix}${name}`));
        return made.get(name);
      },
    },
  );
};
const LUCIDE = taggedProxy("lucide-react#");

/** Key-order-insensitive structural equality. */
const canonical = (value) =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
      : v,
  );
const same = (a, b) => canonical(a) === canonical(b);

// --- shared real modules ------------------------------------------------------------------

const STAGE_PROGRESS = evaluate(FILES.stageProgress, {}, {});
const ACTIVITIES = evaluate(FILES.activities, {}, {});
const WORLDS = evaluate(FILES.worlds, {}, { "lucide-react": LUCIDE });
const ENTRY_CONTRACT = evaluate(FILES.entryContract, {}, {});
const ENTRY_TYPES = evaluate(FILES.entryTypes, {}, {});
const ROUTE_CONTINUATION = readSource(FILES.routeContinuation) === null ? null : evaluate(FILES.routeContinuation, {}, {});
const STORAGE_KEY = /const STORAGE_KEY = "([^"]+)"/.exec(readSource(FILES.storage))?.[1];
if (!STORAGE_KEY) throw new Error("storage.ts: STORAGE_KEY not found");

// --- stage 1: the real app/page.tsx -----------------------------------------------------------

const PAGE_STUBS = {
  GameScreen: tagged("GameScreen"),
  HomeStage: tagged("HomeStage"),
  RewardResultModal: tagged("RewardResultModal"),
  WorldEntryTransition: tagged("WorldEntryTransition"),
};

function createLocalStorage(entries) {
  const values = new Map();
  if (entries !== undefined) values.set(STORAGE_KEY, JSON.stringify(entries));
  return {
    read: () => JSON.parse(values.get(STORAGE_KEY) ?? "null"),
    api: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
    },
  };
}

/**
 * A tab with the product's Home loaded: the real page, the real entry controller,
 * the real storage. Every step drives page.tsx through the props of the element
 * that would call it in the browser.
 */
function openTab({ stored } = {}) {
  const localStorage = createLocalStorage(stored);
  const window = {
    localStorage: localStorage.api,
    scrollTo: () => {},
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    // The entry watchdog arms here; it never fires on its own in these checks.
    setTimeout: () => 0,
    clearTimeout: () => {},
  };
  const document = { querySelector: () => null, visibilityState: "visible" };
  const storage = evaluate(FILES.storage, { window, Date, Intl, JSON }, {});
  const { react, mount } = createReact();
  const controller = evaluate(FILES.controller, { window, document }, {
    react,
    "@/components/world-entry/worldEntryTypes": ENTRY_TYPES,
    "@/games/entry-contract": ENTRY_CONTRACT,
  });
  const pageModule = evaluate(FILES.page, { window, document }, {
    react,
    "react/jsx-runtime": JSX_RUNTIME,
    "@/components/GameScreen": { GameScreen: PAGE_STUBS.GameScreen },
    "@/components/home/HomeStage": { HomeStage: PAGE_STUBS.HomeStage },
    "@/components/RewardResultModal": { RewardResultModal: PAGE_STUBS.RewardResultModal },
    "@/components/WorldEntryTransition": { WorldEntryTransition: PAGE_STUBS.WorldEntryTransition },
    "@/components/world-entry/useWorldEntryController": controller,
    "@/data/activities": ACTIVITIES,
    "@/data/worlds": WORLDS,
    "@/engine/stage-progress": STAGE_PROGRESS,
    "@/engine/storage": storage,
  });
  const page = mount(pageModule.default, {});
  const find = (stub) => findElement(page.tree, (el) => el.type === PAGE_STUBS[stub]);
  const need = (stub) => {
    const element = find(stub);
    if (!element) throw new Error(`page.tsx is not rendering ${stub} now`);
    return element;
  };

  const tab = {
    localStorage,
    storage,
    find,
    /** HomeStage → onEnter(activity): openActivity, then the transition covers the screen. */
    enter(gameId) {
      const home = need("HomeStage");
      const world = home.props.worlds.find((entry) => entry.gameId === gameId);
      if (!world) throw new Error(`HomeStage offers no world for ${gameId}`);
      page.act(() => home.props.onEnter(world.activity));
      tab.cover();
      return need("GameScreen");
    },
    cover() {
      const transition = need("WorldEntryTransition");
      page.act(() => transition.props.onCovered());
    },
    /** The game reports ready and the transition finishes, as the browser does. */
    finishEntry() {
      page.act(() => need("GameScreen").props.onEntryReady());
      const transition = find("WorldEntryTransition");
      if (transition) page.act(() => transition.props.onDone());
    },
    /** GameScreen → onComplete(result), in one handler. */
    complete(result) {
      page.act(() => need("GameScreen").props.onComplete(result));
      return find("RewardResultModal");
    },
    /** RewardResultModal → onPlayAgain, then the transition covers the screen. */
    playAgain() {
      const modal = need("RewardResultModal");
      page.act(() => modal.props.onPlayAgain());
      tab.cover();
      return need("GameScreen");
    },
    /** RewardResultModal → onDashboard ("Continuar jornada"). */
    dashboard() {
      page.act(() => need("RewardResultModal").props.onDashboard());
    },
    /** The game's own back button. */
    exitGame() {
      page.act(() => need("GameScreen").props.onExit());
    },
    failEntry(error) {
      page.act(() => need("GameScreen").props.onEntryError(error));
    },
    /** The error panel's "Tentar novamente". */
    retry() {
      page.act(() => need("WorldEntryTransition").props.onRetry());
      return need("GameScreen");
    },
  };
  return tab;
}

// --- stage 2: the real GameScreen over the real registry ------------------------------------

const gameModules = new Map();
/** Every export of a game module is a named component that is read, never rendered. */
function gameModule(specifier) {
  if (!gameModules.has(specifier)) {
    const made = new Map();
    gameModules.set(
      specifier,
      new Proxy(
        {},
        {
          get(_, name) {
            if (name === "__esModule") return true;
            if (typeof name !== "string" || !/^[A-Z]/.test(name)) return undefined;
            if (!made.has(name)) {
              const component = tagged(`${specifier}#${name}`);
              component.module = specifier;
              made.set(name, component);
            }
            return made.get(name);
          },
        },
      ),
    );
  }
  return gameModules.get(specifier);
}
const SCREEN_STUBS = { GameHowToPlay: tagged("GameHowToPlay") };
const GAME_INTROS = new Proxy({}, { get: (_, id) => (typeof id === "string" ? { introFor: id } : undefined) });

/** Mount the GameScreen element page.tsx rendered; let the game's code arrive; read what it shows. */
async function mountScreen(screenElement) {
  const { react, mount } = createReact();
  const registry = evaluate(
    FILES.registry,
    { __dynamicImport: (specifier) => Promise.resolve(gameModule(specifier)) },
    { "@/games/entry-contract": ENTRY_CONTRACT },
  );
  const screenModule = evaluate(
    FILES.screen,
    {
      window: { requestAnimationFrame: () => 0, cancelAnimationFrame: () => {}, scrollTo: () => {} },
      document: { activeElement: null },
      HTMLElement: class HTMLElement {},
    },
    {
      react,
      "react/jsx-runtime": JSX_RUNTIME,
      "@/components/GameHowToPlay": { GameHowToPlay: SCREEN_STUBS.GameHowToPlay },
      "@/data/game-intros": { GAME_INTROS },
      "@/games": registry,
    },
  );
  const screen = mount(screenModule.GameScreen, screenElement.props);
  await screen.settle();
  const game = findElement(screen.tree, (el) => typeof el.type?.module === "string");
  const intro = findElement(screen.tree, (el) => el.type === SCREEN_STUBS.GameHowToPlay);
  const gameLayer = childrenOf(screen.tree).find((el) => el.props.className === "wentry-game-layer");
  screen.unmount();
  return {
    game,
    gameTag: game?.type.tag ?? null,
    introShown: Boolean(intro),
    focusTarget: gameLayer?.props["data-world-entry-focus"] ?? null,
  };
}

// --- stage 3: the real RouteStrategyGame ------------------------------------------------------

const posKey = (p) => `${p.row},${p.col}`;
const noop = () => {};
const ROTA_FIXTURE = {
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
};
const MOTION = { motion: taggedProxy("motion."), useReducedMotion: () => false };

/**
 * Mount the Rota with the props it was handed and return what it gives the
 * gameplay hook: the arguments of every render (the hook's state initialisers
 * read the first), and the tree.
 */
function mountRota(props, fixture = ROTA_FIXTURE) {
  const { react, mount } = createReact();
  const calls = [];
  const modules = {
    react,
    "react/jsx-runtime": JSX_RUNTIME,
    "motion/react": MOTION,
    "lucide-react": LUCIDE,
    "@/lib/feedback-motion": { gentleShakeAnimate: {} },
    "@/games/escape-maze/useEscapeMaze": {
      COLS: 9,
      ROWS: 9,
      posKey,
      useEscapeMaze: (onComplete, initialRouteNumber, initialDifficulty) => {
        calls.push({ initialRouteNumber, initialDifficulty });
        return fixture;
      },
    },
    "@/components/worlds/master-scene/worldMasterSceneConfig": { getWorldMasterSceneStyle: () => ({}) },
  };
  if (ROUTE_CONTINUATION) modules["@/games/escape-maze/continuation"] = ROUTE_CONTINUATION;
  const rotaModule = evaluate(FILES.rota, { requestAnimationFrame: () => 0 }, modules);
  const rota = mount(rotaModule.RouteStrategyGame, props);
  const tree = rota.tree;
  rota.unmount();
  return { args: calls[0] ?? null, consistent: calls.every((call) => same(call, calls[0])), tree };
}

// --- stage 4: the real useEscapeMaze ------------------------------------------------------------

const RUNTIME = loadRouteRuntime({ rev: REV });

/** The hook mounted on exactly what the Rota handed it, at the setup screen. */
function arrive(args, seed) {
  return RUNTIME.mount({
    seed,
    routeNumber: args?.initialRouteNumber,
    initialDifficulty: args?.initialDifficulty,
    autoStart: false,
  });
}

const landings = new Map();
/**
 * Where the hook puts the Explorador for these arguments: Route, mode, screen.
 * The map is random, but the landing is a function of the arguments alone, so
 * it is measured once per distinct pair.
 */
function landedOn(args) {
  const key = canonical(args ?? null);
  if (!landings.has(key)) {
    const run = arrive(args, 33_000_000 + landings.size);
    landings.set(key, { route: run.state.routeNumber, mode: run.state.difficulty, status: run.state.status });
  }
  return landings.get(key);
}

/**
 * Play one session the way the Explorador would: arrive on what the Rota was
 * handed, optionally pick a mode on the setup screen, start, play to the wanted
 * end. Maps are random in the product, so the seed is searched until the
 * policy reaches that end; nothing else about the session is chosen.
 */
function playSession(args, { pick, outcome, seedBase }) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const seed = seedBase + attempt;
    const run = arrive(args, seed);
    const arrived = { route: run.state.routeNumber, mode: run.state.difficulty, status: run.state.status };
    if (pick && pick !== run.state.difficulty) run.changeDifficulty(pick);
    const setup = { route: run.state.routeNumber, mode: run.state.difficulty };
    run.act((g) => g.startGame());
    const end = playToEnd(run, outcome === "won" ? "win" : "lose");
    if (end !== outcome) continue;
    return { seed, attempts: attempt + 1, arrived, setup, completion: run.completions.at(-1) ?? null };
  }
  return null;
}

// --- one stage after the other ------------------------------------------------------------

/** From the GameScreen element page.tsx rendered down to what the gameplay hook receives. */
async function follow(screenElement) {
  const screen = await mountScreen(screenElement);
  const isRota = screen.gameTag === "@/games/escape-maze/RouteStrategyGame#RouteStrategyGame";
  const rota = isRota ? mountRota(screen.game.props) : null;
  return {
    gameId: screenElement.props.gameId,
    key: screenElement.key,
    skipIntro: screenElement.props.skipIntro === true,
    screenProps: screenElement.props,
    introShown: screen.introShown,
    focusTarget: screen.focusTarget,
    gameTag: screen.gameTag,
    gameProps: screen.game?.props ?? null,
    hookArgs: rota?.args ?? null,
    hookArgsConsistent: rota?.consistent ?? null,
  };
}

/** Hook arguments as text: `undefined` survives, where JSON would drop it. */
const argsLabel = (args) => (args ? `${args.initialRouteNumber}/${args.initialDifficulty}` : null);

/** Every value a game could take a session from, as the props carry it. */
const RESUME_PROPS = ["continuation", "initialRouteNumber", "initialDifficulty"];
const resumePropsOf = (props) =>
  Object.fromEntries(RESUME_PROPS.filter((key) => props?.[key] !== undefined).map((key) => [key, props[key]]));

// --- static reading ----------------------------------------------------------------------------

function parse(file) {
  const text = readSource(file);
  if (text === null) return null;
  return ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

/** Identifiers, string literals and reads INTO a `continuation` value, from the AST (comments excluded). */
function vocabulary(file) {
  const sf = parse(file);
  const identifiers = new Set();
  const strings = new Set();
  const continuationReads = [];
  const visit = (node) => {
    if (ts.isIdentifier(node)) identifiers.add(node.text);
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) strings.add(node.text);
    const readsInto =
      ((ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "continuation") ||
      (ts.isVariableDeclaration(node) &&
        ts.isObjectBindingPattern(node.name) &&
        node.initializer &&
        ts.isIdentifier(node.initializer) &&
        node.initializer.text === "continuation");
    if (readsInto) continuationReads.push(node.getText(sf));
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { identifiers, strings, continuationReads };
}

/** Static and dynamic imports of a file: specifier, kind, resolved src file (if any). */
function importsOf(file) {
  const sf = parse(file);
  if (!sf) return null;
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
      found.push({ specifier: node.moduleSpecifier.text, kind: typeOnly ? "type" : "runtime" });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      found.push({ specifier: node.moduleSpecifier.text, kind: node.isTypeOnly ? "type" : "runtime" });
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      found.push({ specifier: node.arguments[0].text, kind: "dynamic" });
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return found.map((entry) => ({ ...entry, file: resolveSpecifier(file, entry.specifier) }));
}

const SRC_FILES = (
  REV
    ? execFileSync("git", ["ls-tree", "-r", "--name-only", REV, "src"], { encoding: "utf8" })
    : execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "src"], { encoding: "utf8" })
)
  .split("\n")
  .filter((file) => /\.(ts|tsx|js|jsx|mjs|mts)$/.test(file) && readSource(file) !== null);
const KNOWN = new Set(SRC_FILES);
function resolveSpecifier(from, specifier) {
  let base;
  if (specifier.startsWith("@/")) base = `src/${specifier.slice(2)}`;
  else if (specifier.startsWith(".")) base = path.posix.join(path.posix.dirname(from), specifier);
  else return null;
  return ["", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".mts", "/index.ts", "/index.tsx"]
    .map((suffix) => base + suffix)
    .find((candidate) => KNOWN.has(candidate)) ?? null;
}
/** Files and packages reached from `start` through static, non-type imports: what ships with it. */
function runtimeClosure(start) {
  const files = new Set([start]);
  const packages = new Set();
  const queue = [start];
  while (queue.length) {
    for (const edge of importsOf(queue.shift()) ?? []) {
      if (edge.kind !== "runtime") continue;
      if (edge.file === null) {
        if (!edge.specifier.startsWith("@/") && !edge.specifier.startsWith(".")) packages.add(edge.specifier);
        continue;
      }
      if (!files.has(edge.file)) {
        files.add(edge.file);
        queue.push(edge.file);
      }
    }
  }
  return { files: [...files].sort(), packages: [...packages].sort() };
}

// --- checks --------------------------------------------------------------------------------------

const tests = [];
const record = (id, kind, name, pass, detail) => {
  tests.push({ id, kind, name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} [${kind}] — ${name}`);
  for (const [k, v] of Object.entries(detail)) {
    const text = typeof v === "object" ? JSON.stringify(v) : String(v);
    console.log(`        ${k}: ${text.length > 600 ? `${text.slice(0, 600)}…` : text}`);
  }
};
const expectedRouteContinuation = (routeNumber, difficulty) => ({ kind: ROUTE_KIND, routeNumber, difficulty });
/**
 * Where a Route's end leads (ROUTE-JOURNEY-TERMINAL-01), restated so it is asserted rather than trusted: Rota
 * Estratégica v1 has three Routes. Before the last, won or lost → N + 1; the last lost → itself; the last won → none.
 */
const FINAL_ROUTE = 3;
const expectedNextRoute = (route, outcome) => (route < FINAL_ROUTE ? route + 1 : outcome === "lost" ? FINAL_ROUTE : null);

// A1 — the contract is a type: a union keyed by `kind`, carried by GameResult and handed to games.
{
  const sf = parse(FILES.types);
  const declaration = (name) =>
    sf.statements.find(
      (statement) =>
        (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) && statement.name.text === name,
    ) ?? null;
  const propertiesOf = (node) =>
    node
      ? Object.fromEntries(
          node.members
            .filter(ts.isPropertySignature)
            .map((member) => [member.name.getText(sf), { optional: Boolean(member.questionToken), type: member.type?.getText(sf) }]),
        )
      : null;
  const union = declaration("GameContinuation");
  const unionMembers = union && ts.isTypeAliasDeclaration(union)
    ? (ts.isUnionTypeNode(union.type) ? union.type.types : [union.type]).map((member) => {
        if (ts.isTypeLiteralNode(member)) return { name: "(literal)", properties: propertiesOf(member) };
        const name = ts.isTypeReferenceNode(member) ? member.typeName.getText(sf) : member.getText(sf);
        const target = declaration(name);
        return { name, properties: target && ts.isInterfaceDeclaration(target) ? propertiesOf(target) : null };
      })
    : [];
  const kinds = unionMembers.map((member) => member.properties?.kind);
  const routeMember = unionMembers.find((member) => member.properties?.kind?.type === `"${ROUTE_KIND}"`) ?? null;
  const result = propertiesOf(declaration("GameResult"));
  const gameProps = propertiesOf(declaration("GameComponentProps"));
  const actual = {
    unionDeclared: Boolean(union),
    everyMemberHasLiteralKind:
      unionMembers.length > 0 && kinds.every((kind) => kind && !kind.optional && /^"[^"]+"$/.test(kind.type)),
    kindsDistinct: new Set(kinds.map((kind) => kind?.type)).size === kinds.length,
    routeMember: routeMember?.properties ?? null,
    resultContinuation: result?.continuation ?? null,
    resultKeepsDetails: result?.details ?? null,
    gameComponentProps: gameProps ? Object.keys(gameProps).sort() : null,
    gamePropsContinuation: gameProps?.continuation ?? null,
  };
  const expected = {
    unionDeclared: true,
    everyMemberHasLiteralKind: true,
    kindsDistinct: true,
    routeMember: {
      kind: { optional: false, type: `"${ROUTE_KIND}"` },
      routeNumber: { optional: false, type: "number" },
      difficulty: { optional: false, type: "DifficultyLevel" },
    },
    resultContinuation: { optional: true, type: "GameContinuation" },
    resultKeepsDetails: { optional: false, type: "Record<string, number | string | boolean>" },
    gameComponentProps: ["continuation", "onComplete", "onEntryError", "onEntryReady", "onExit"],
    gamePropsContinuation: { optional: true, type: "GameContinuation" },
  };
  record("A1", "contract", "CONTINUATION_IS_A_TYPED_UNION", same(actual, expected), {
    actual,
    note: "GameComponentProps carries one opaque continuation; no Route field is part of the props every game shares",
  });
}

// A2 — a finished Route writes the typed continuation: the Route the journey goes to (N + 1 before the last; the last
// again when it was lost), the mode it was played on — and none at all once the last Route is won.
const producedResults = [];
{
  const rows = [];
  let seedBase = 31_000_000;
  for (const route of [1, 2, 3]) {
    for (const mode of MODES) {
      for (const outcome of ["won", "lost"]) {
        seedBase += 1_000;
        const session = playSession({ initialRouteNumber: route, initialDifficulty: mode }, { outcome, seedBase });
        const completion = session?.completion ?? null;
        const continuation = completion?.continuation;
        const details = completion?.details ?? {};
        if (completion) producedResults.push(completion);
        const next = expectedNextRoute(route, outcome);
        const row = {
          played: `R${route}/${mode}/${outcome}`,
          seed: session?.seed ?? null,
          continuation: continuation ?? null,
          detailsAgree:
            details.routeNumber === route &&
            (next === null
              ? details.journeyCompleted === true && !("nextRouteNumber" in details) && !("nextRouteStage" in details)
              : details.nextRouteNumber === next && !("journeyCompleted" in details)) &&
            details.difficulty === mode &&
            details.won === (outcome === "won"),
        };
        row.ok =
          Boolean(completion) &&
          (next === null
            ? !("continuation" in completion)
            : same(continuation, expectedRouteContinuation(next, mode)) && Object.keys(continuation).length === 3) &&
          row.detailsAgree;
        rows.push(row);
      }
    }
  }
  // The mode that travels is the one the Route was finished on, not the one it arrived on.
  const changed = (() => {
    const run = arrive({ initialRouteNumber: 2, initialDifficulty: "easy" }, 31_900_000);
    run.changeDifficulty("hard");
    run.act((g) => g.startGame());
    const end = playToEnd(run, "lose");
    const continuation = run.completions.at(-1)?.continuation ?? null;
    return { end, continuation, ok: end === "lost" && same(continuation, expectedRouteContinuation(3, "hard")) };
  })();
  record(
    "A2",
    "contract",
    "FINISHED_ROUTE_WRITES_TYPED_CONTINUATION",
    rows.every((row) => row.ok) && changed.ok,
    {
      sessions: rows.length,
      failing: rows.filter((row) => !row.ok),
      sample: rows[0],
      modeChangedBeforeStart: changed,
      note: "details keeps routeNumber / nextRouteNumber (or journeyCompleted) / difficulty / won for history and the result screen, and agrees with the continuation",
    },
  );
}

// B1 — page.tsx speaks no Route protocol: no Route vocabulary, no GameId, nothing read from details or from inside the continuation.
{
  const { identifiers, strings, continuationReads } = vocabulary(FILES.page);
  const ROUTE_WORDS = [
    "nextRouteNumber",
    "routeNumber",
    "initialRouteNumber",
    "initialDifficulty",
    "difficulty",
    "readDifficulty",
    "DifficultyLevel",
    "DIFFICULTY_LEVELS",
    "details",
    "kind",
  ];
  const actual = {
    routeVocabulary: ROUTE_WORDS.filter((word) => identifiers.has(word)),
    gameIdLiterals: [...GAME_IDS, ROUTE_KIND].filter((literal) => strings.has(literal)),
    readsIntoContinuation: continuationReads,
  };
  record(
    "B1",
    "contract",
    "PAGE_SPEAKS_NO_ROUTE_PROTOCOL",
    same(actual, { routeVocabulary: [], gameIdLiterals: [], readsIntoContinuation: [] }),
    { actual },
  );
}

// B2 — GameScreen carries the continuation without opening it, and names no game.
{
  const { identifiers, strings, continuationReads } = vocabulary(FILES.screen);
  const ROUTE_WORDS = ["nextRouteNumber", "routeNumber", "initialRouteNumber", "initialDifficulty", "difficulty", "kind"];
  const actual = {
    routeVocabulary: ROUTE_WORDS.filter((word) => identifiers.has(word)),
    gameIdLiterals: [...GAME_IDS, ROUTE_KIND].filter((literal) => strings.has(literal)),
    readsIntoContinuation: continuationReads,
    carries: identifiers.has("continuation"),
  };
  record(
    "B2",
    "contract",
    "GAME_SCREEN_CARRIES_WITHOUT_OPENING",
    same(actual, { routeVocabulary: [], gameIdLiterals: [], readsIntoContinuation: [], carries: true }),
    { actual },
  );
}

// B3 — the shell hands back the very value the game wrote: not rebuilt from details, not filtered by kind.
{
  const source = producedResults.find((result) => result.details.won === true && result.details.routeNumber === 2) ?? null;
  if (!source) throw new Error("B3 needs a won Route 2 result from A2");
  // (i) details that disagree with the continuation: whatever the shell follows is what arrives.
  const disagreeing = source && {
    ...source,
    details: { ...source.details, nextRouteNumber: 9, difficulty: source.details.difficulty === "hard" ? "easy" : "hard" },
  };
  const tabA = openTab();
  tabA.enter(ROUTE);
  tabA.finishEntry();
  tabA.complete(disagreeing ?? {});
  const followed = await follow(tabA.playAgain());
  const routeCase = {
    continuationWritten: source?.continuation ?? null,
    detailsSay: disagreeing ? { nextRouteNumber: 9, difficulty: disagreeing.details.difficulty } : null,
    sameValueToGameScreen: Boolean(source?.continuation) && followed.screenProps.continuation === source.continuation,
    sameValueToGame: Boolean(source?.continuation) && followed.gameProps?.continuation === source.continuation,
    hookArgs: followed.hookArgs,
  };
  const routeOk =
    routeCase.sameValueToGameScreen &&
    routeCase.sameValueToGame &&
    same(followed.hookArgs, {
      initialRouteNumber: source.continuation.routeNumber,
      initialDifficulty: source.continuation.difficulty,
    });

  // (ii) a continuation of a kind the shell has never heard of, from another game: carried all the same.
  const probe = { kind: "probe-kind", token: { opaque: true } };
  const tabB = openTab();
  tabB.enter("color-sequence");
  tabB.finishEntry();
  tabB.complete({
    activityId: "color-sequence",
    activityTitle: "Circuito de Memória",
    gameId: "color-sequence",
    score: 10,
    summary: "probe",
    details: { level: 3 },
    continuation: probe,
  });
  const carried = await follow(tabB.playAgain());
  const probeCase = {
    sameValueToGameScreen: carried.screenProps.continuation === probe,
    sameValueToGame: carried.gameProps?.continuation === probe,
    skipIntro: carried.skipIntro,
    game: carried.gameTag,
  };
  const probeOk = probeCase.sameValueToGameScreen && probeCase.sameValueToGame && probeCase.skipIntro;
  record("B3", "contract", "SHELL_HANDS_BACK_THE_SAME_VALUE", routeOk && probeOk, {
    routeResultWithDisagreeingDetails: routeCase,
    unknownKindFromAnotherGame: probeCase,
    note: "page.tsx and GameScreen pass the game's own object through by identity; details are not consulted and kinds are not filtered",
  });
}

// C* / D1 / E* / F1 — journeys through the real shell: Route after Route, then Home, then the other worlds.
/**
 * Each journey enters from Home, picks its mode on Route 1's setup screen and
 * plays three Routes, ending each the way `outcomes` says. A win and a loss per
 * mode; where the wins sit only follows how often the policy wins there.
 */
const JOURNEYS = [
  { label: "easy", mode: "easy", outcomes: ["won", "lost", "won"], retryAt: 1 },
  { label: "medium", mode: "medium", outcomes: ["lost", "won", "lost"], retryAt: 0 },
  { label: "hard", mode: "hard", outcomes: ["won", "lost", "lost"], retryAt: 2 },
  { label: "easy, hard picked on Route 2", mode: "easy", outcomes: ["won", "lost", "lost"], switchTo: { atHop: 1, mode: "hard" } },
];
const hops = [];
/** Route 3 won: the journey is complete. Its result screen's one way on is the worlds; nothing is resumed. */
const completedJourneys = [];
const retries = [];
const freshEntries = [];
const crossGame = [];
const replays = [];
let journeySeed = 32_000_000;
for (const journey of JOURNEYS) {
  const tab = openTab();
  const entry = await follow(tab.enter(ROUTE));
  tab.finishEntry();
  freshEntries.push({ journey: journey.label, from: "first entry", ...describeArrival(entry) });
  let stage = entry;
  for (const [index, outcome] of journey.outcomes.entries()) {
    journeySeed += 1_000;
    const pick = index === 0 ? journey.mode : journey.switchTo?.atHop === index ? journey.switchTo.mode : undefined;
    const session = playSession(stage.hookArgs, { pick, outcome, seedBase: journeySeed });
    if (!session) throw new Error(`${journey.label}: no seed reached "${outcome}" on hop ${index}`);
    const savedBefore = tab.localStorage.read()?.length ?? 0;
    const modal = tab.complete(session.completion);
    if (expectedNextRoute(session.setup.route, outcome) === null) {
      // The journey is complete: the result screen leads back to the worlds, and the Rota from there is a new journey.
      tab.dashboard();
      const home = Boolean(tab.find("HomeStage")) && !tab.find("GameScreen");
      const again = await follow(tab.enter(ROUTE));
      tab.finishEntry();
      const arrival = describeArrival(again);
      completedJourneys.push({
        journey: journey.label,
        played: { route: session.setup.route, mode: session.setup.mode, outcome },
        journeyCompleted: session.completion.details.journeyCompleted ?? null,
        backHome: home,
        resultsSaved: (tab.localStorage.read()?.length ?? 0) - savedBefore,
      });
      freshEntries.push({ journey: journey.label, from: "Route 3 won → Home", ...arrival });
      stage = again;
      continue;
    }
    const nextScreen = tab.playAgain();
    let next = await follow(nextScreen);
    if (journey.retryAt === index) {
      // What the session landed on first; every retry must land there again.
      const firstArgs = next.hookArgs;
      // The entry fails (the board's chunk, say) and the Explorador retries, three times.
      const attempts = [];
      for (let attempt = 0; attempt < 3; attempt += 1) {
        tab.failEntry(Object.assign(new Error("Failed to load chunk"), { name: "ChunkLoadError" }));
        const retried = await follow(tab.retry());
        attempts.push({
          key: retried.key,
          skipIntro: retried.skipIntro,
          hookArgs: retried.hookArgs,
          sameContinuationValue:
            retried.screenProps.continuation === undefined ||
            retried.screenProps.continuation === next.screenProps.continuation,
        });
        next = retried;
      }
      retries.push({
        journey: journey.label,
        afterRoute: session.setup.route,
        firstKey: nextScreen.key,
        expectedArgs: firstArgs,
        attempts,
        resultsSaved: (tab.localStorage.read()?.length ?? 0) - savedBefore,
      });
    }
    tab.finishEntry();
    const arrival = describeArrival(next);
    hops.push({
      journey: journey.label,
      played: { route: session.setup.route, mode: session.setup.mode, outcome },
      seed: session.seed,
      modalResultWon: modal?.props.result.details.won ?? null,
      gameId: next.gameId,
      ...arrival,
    });
    stage = next;
  }
  // From the result screen, "Continuar jornada", then into the Rota again from Home.
  journeySeed += 1_000;
  const last = playSession(stage.hookArgs, { outcome: "lost", seedBase: journeySeed });
  tab.complete(last.completion);
  tab.dashboard();
  const again = await follow(tab.enter(ROUTE));
  tab.finishEntry();
  freshEntries.push({ journey: journey.label, from: "result → Continuar jornada → Home", ...describeArrival(again) });
  // From inside a session, the back button, then the Rota again.
  tab.exitGame();
  const backAgain = await follow(tab.enter(ROUTE));
  tab.finishEntry();
  freshEntries.push({ journey: journey.label, from: "Voltar à jornada → Home", ...describeArrival(backAgain) });
  tab.exitGame();
  // Every other world, reached two ways while the Rota has a journey going: from a Route result
  // still on screen ("Continuar jornada"), and from the next Route already open in the shell
  // ("Voltar à jornada"). Neither may hand that world anything of the Rota's.
  for (const gameId of OTHER_GAMES) {
    for (const via of ["result → Continuar jornada", "next Route open → Voltar à jornada"]) {
      tab.enter(ROUTE);
      tab.finishEntry();
      tab.complete(last.completion);
      if (via === "result → Continuar jornada") {
        tab.dashboard();
      } else {
        tab.playAgain();
        tab.finishEntry();
        tab.exitGame();
      }
      const other = await follow(tab.enter(gameId));
      tab.finishEntry();
      crossGame.push({
        journey: journey.label,
        gameId,
        via,
        game: other.gameTag,
        screenResumeProps: resumePropsOf(other.screenProps),
        gameResumeProps: resumePropsOf(other.gameProps),
        skipIntro: other.skipIntro,
        introShown: other.introShown,
      });
      tab.exitGame();
    }
    // ...and each replays exactly as before: same world, from its start, with its intro.
    tab.enter(gameId);
    tab.finishEntry();
    tab.complete({
      activityId: gameId,
      activityTitle: gameId,
      gameId,
      score: 5,
      summary: `${gameId} witness`,
      details: { completed: true, level: 2 },
    });
    const replay = await follow(tab.playAgain());
    tab.finishEntry();
    replays.push({
      journey: journey.label,
      gameId,
      replayedGameId: replay.gameId,
      screenResumeProps: resumePropsOf(replay.screenProps),
      gameResumeProps: resumePropsOf(replay.gameProps),
      skipIntro: replay.skipIntro,
      introShown: replay.introShown,
    });
    tab.exitGame();
  }
}

/** Where a session landed: what the shell showed, what the Rota handed the hook, and what the hook did with it. */
function describeArrival(stage) {
  return {
    skipIntro: stage.skipIntro,
    introShown: stage.introShown,
    focusTarget: stage.focusTarget,
    hookArgs: stage.hookArgs,
    hookArgsLabel: argsLabel(stage.hookArgs),
    hookArgsConsistent: stage.hookArgsConsistent,
    landed: stage.hookArgs ? landedOn(stage.hookArgs) : null,
  };
}

// C1 — Route N, its result, "Explorar próxima rota" / "Explorar outra rota": Route N + 1 (Routes 1 and 2; where the
// last Route leads is C5).
{
  const rows = hops.filter((hop) => hop.played.route < FINAL_ROUTE).map((hop) => ({
    journey: hop.journey,
    played: hop.played,
    landed: hop.landed,
    ok: hop.gameId === ROUTE && hop.landed?.route === hop.played.route + 1 && hop.landed?.status === "setup",
  }));
  record("C1", "preserved", "ROUTE_N_CONTINUES_TO_N_PLUS_1", rows.length > 0 && rows.every((row) => row.ok), {
    hops: rows.length,
    routesReached: [...new Set(rows.map((row) => row.landed?.route))].sort(),
    failing: rows.filter((row) => !row.ok),
  });
}

// C2 — the mode travels: easy stays easy, medium medium, hard hard; a mode picked on the setup screen travels from then on.
{
  const rows = hops.map((hop) => ({
    journey: hop.journey,
    played: hop.played,
    landed: hop.landed,
    ok: hop.landed?.mode === hop.played.mode && hop.hookArgsConsistent === true,
  }));
  const byMode = Object.fromEntries(
    MODES.map((mode) => [mode, rows.filter((row) => row.played.mode === mode).map((row) => row.landed?.mode)]),
  );
  record("C2", "preserved", "MODE_TRAVELS_UNCHANGED", rows.every((row) => row.ok), {
    landedModeByPlayedMode: byMode,
    switchJourney: rows
      .filter((row) => row.journey.includes("picked on Route 2"))
      .map((row) => `R${row.played.route}/${row.played.mode} -> R${row.landed?.route}/${row.landed?.mode}`),
    failing: rows.filter((row) => !row.ok),
  });
}

// C3 — the intro is skipped exactly when a journey continues, and shown on every entry from Home.
{
  const continued = hops.map((hop) => ({ journey: hop.journey, skipIntro: hop.skipIntro, introShown: hop.introShown, focusTarget: hop.focusTarget }));
  const entered = freshEntries.map((entry) => ({ journey: entry.journey, from: entry.from, skipIntro: entry.skipIntro, introShown: entry.introShown, focusTarget: entry.focusTarget }));
  const ok =
    continued.every((row) => row.skipIntro && !row.introShown && row.focusTarget === "true") &&
    entered.every((row) => !row.skipIntro && row.introShown && row.focusTarget === null);
  record("C3", "preserved", "INTRO_SKIPPED_ONLY_WHEN_CONTINUING", ok, {
    continued: continued.length,
    entered: entered.length,
    failing: [
      ...continued.filter((row) => !(row.skipIntro && !row.introShown && row.focusTarget === "true")),
      ...entered.filter((row) => !(!row.skipIntro && row.introShown && row.focusTarget === null)),
    ],
  });
}

// C4 — a lost Route: "Explorar outra rota" opens Route N + 1 on the same mode, intro skipped — exactly the won path
// (Routes 1 and 2; the last Route lost is C5).
{
  const lost = hops.filter((hop) => hop.played.outcome === "lost" && hop.played.route < FINAL_ROUTE);
  const rows = lost.map((hop) => ({
    journey: hop.journey,
    played: hop.played,
    modalResultWon: hop.modalResultWon,
    landed: hop.landed,
    skipIntro: hop.skipIntro,
    ok:
      hop.modalResultWon === false &&
      hop.landed?.route === hop.played.route + 1 &&
      hop.landed?.mode === hop.played.mode &&
      hop.skipIntro,
  }));
  record("C4", "preserved", "LOST_ROUTE_EXPLORES_THE_NEXT_ONE", rows.length > 0 && rows.every((row) => row.ok), {
    lostRoutes: rows.length,
    failing: rows.filter((row) => !row.ok),
  });
}

// C5 — the end of the journey, through the shell: Route 3 lost resumes Route 3 on the same mode, intro skipped; Route 3
// won writes no continuation, is recorded as a completed journey, and its way on is Home — from there, a new journey.
{
  const lastLost = hops
    .filter((hop) => hop.played.route === FINAL_ROUTE)
    .map((hop) => ({
      journey: hop.journey,
      played: hop.played,
      landed: hop.landed,
      ok: hop.played.outcome === "lost" && hop.landed?.route === FINAL_ROUTE && hop.landed?.mode === hop.played.mode && hop.landed?.status === "setup" && hop.skipIntro,
    }));
  const won = completedJourneys.map((row) => ({
    ...row,
    ok: row.played.route === FINAL_ROUTE && row.played.outcome === "won" && row.journeyCompleted === true && row.backHome && row.resultsSaved === 1,
  }));
  const afterCompletion = freshEntries
    .filter((entry) => entry.from === "Route 3 won → Home")
    .map((entry) => ({ journey: entry.journey, landed: entry.landed, ok: same(entry.landed, { route: 1, mode: "easy", status: "setup" }) && !entry.skipIntro }));
  record(
    "C5",
    "terminal",
    "LAST_ROUTE_RETRIES_OR_COMPLETES_THE_JOURNEY",
    lastLost.length > 0 && won.length > 0 && afterCompletion.length === won.length && [...lastLost, ...won, ...afterCompletion].every((row) => row.ok),
    {
      lastRouteLost: lastLost.length,
      journeysCompleted: won.length,
      routesReached: [...new Set(hops.map((hop) => hop.landed?.route))].sort(),
      failing: [...lastLost, ...won, ...afterCompletion].filter((row) => !row.ok),
    },
  );
}

// D1 — entering from Home is a fresh journey, whatever was played or pending before it.
{
  const rows = freshEntries.map((entry) => ({
    journey: entry.journey,
    from: entry.from,
    hookArgs: entry.hookArgs,
    landed: entry.landed,
    ok:
      same(entry.hookArgs, { initialRouteNumber: undefined, initialDifficulty: undefined }) &&
      same(entry.landed, { route: 1, mode: "easy", status: "setup" }) &&
      !entry.skipIntro,
  }));
  record("D1", "preserved", "FRESH_ENTRY_INHERITS_NOTHING", rows.every((row) => row.ok), {
    entries: rows.length,
    failing: rows.filter((row) => !row.ok),
    note: "the hook's own defaults apply: Route 1, easy, setup screen — the previous journey's Route and mode are not reused",
  });
}

// E1 — with a Route continuation pending, every other world opens with nothing of the Rota's.
{
  const rows = crossGame.map((row) => ({
    ...row,
    ok:
      row.game === `@/games/${gameFolder(row.gameId)}` &&
      same(row.screenResumeProps, {}) &&
      same(row.gameResumeProps, {}) &&
      !row.skipIntro &&
      row.introShown,
  }));
  record("E1", "preserved", "NO_ROUTE_DATA_IN_OTHER_WORLDS", rows.length === JOURNEYS.length * OTHER_GAMES.length * 2 && rows.every((row) => row.ok), {
    entries: rows.length,
    games: OTHER_GAMES,
    via: [...new Set(rows.map((row) => row.via))],
    failing: rows.filter((row) => !row.ok),
  });
}

function gameFolder(gameId) {
  return {
    "color-sequence": "color-sequence/MemoryCircuit3DGame#MemoryCircuit3DGame",
    "escape-maze": "escape-maze/RouteStrategyGame#RouteStrategyGame",
    "security-panel": "security-panel/SecurityPanelGame#SecurityPanelGame",
    "number-trail": "number-trail/NumberTrailGame#NumberTrailGame",
    "seed-garden": "seed-garden/SeedGardenGame#SeedGardenGame",
  }[gameId];
}

// E2 — the other worlds replay exactly as before: same world, from the start, intro shown.
{
  const rows = replays.map((row) => ({
    ...row,
    ok:
      row.replayedGameId === row.gameId &&
      same(row.screenResumeProps, {}) &&
      same(row.gameResumeProps, {}) &&
      !row.skipIntro &&
      row.introShown,
  }));
  record("E2", "preserved", "OTHER_WORLDS_REPLAY_AS_BEFORE", rows.length > 0 && rows.every((row) => row.ok), {
    replays: rows.length,
    failing: rows.filter((row) => !row.ok),
  });
}

// F1 — a failed entry and "Tentar novamente" remount the SAME session: same Route, same mode, intro still skipped, nothing saved twice.
{
  const rows = retries.map((row) => ({
    ...row,
    ok:
      row.attempts.length === 3 &&
      new Set([row.firstKey, ...row.attempts.map((attempt) => attempt.key)]).size === 4 &&
      row.attempts.every(
        (attempt) => attempt.skipIntro && attempt.sameContinuationValue && same(attempt.hookArgs, row.expectedArgs),
      ) &&
      row.resultsSaved === 1,
  }));
  record("F1", "preserved", "RETRY_REMOUNTS_THE_SAME_SESSION", rows.length === 3 && rows.every((row) => row.ok), {
    retried: rows.map((row) => ({
      journey: row.journey,
      afterRoute: row.afterRoute,
      keys: [row.firstKey, ...row.attempts.map((attempt) => attempt.key)],
      hookArgs: row.attempts.map((attempt) => argsLabel(attempt.hookArgs)),
    })),
    failing: rows.filter((row) => !row.ok),
    note: "each retry is a new mount of the same request; the Route is a value carried by the session, never incremented by mounting",
  });
}

// G1 — storage keeps the continuation: what the game wrote is what a later read returns.
{
  const tab = openTab();
  tab.enter(ROUTE);
  tab.finishEntry();
  const saved = [];
  for (const result of producedResults) {
    tab.complete(result);
    saved.push(result);
    if (result.continuation) {
      tab.playAgain();
    } else {
      // A completed journey: back to the worlds, then the Rota again.
      tab.dashboard();
      tab.enter(ROUTE);
    }
    tab.finishEntry();
  }
  const read = tab.storage.getRecentResults();
  const newestFirst = [...saved].reverse().slice(0, read.length);
  const rows = newestFirst.map((result, i) => ({
    played: `R${result.details.routeNumber}/${result.details.difficulty}`,
    written: result.continuation ?? null,
    read: read[i]?.continuation ?? null,
    journeyCompleted: read[i]?.details?.journeyCompleted ?? null,
    ok:
      same(read[i]?.continuation ?? null, result.continuation ?? null) &&
      (result.continuation ? true : read[i]?.details?.journeyCompleted === true && !("continuation" in read[i])),
  }));
  record("G1", "contract", "STORAGE_ROUNDTRIP_KEEPS_THE_CONTINUATION", rows.length > 0 && rows.every((row) => row.ok), {
    savedThroughThePage: saved.length,
    readBack: read.length,
    completedJourneysReadBack: rows.filter((row) => row.journeyCompleted === true).length,
    failing: rows.filter((row) => !row.ok).slice(0, 4),
  });
}

// G2/G3 — results saved before the contract: they load, they are kept, and they never resumed anything.
const LEGACY = [
  { label: "valid legacy Route result (R4 hard, next 5)", gameId: ROUTE, details: { won: true, turns: 14, difficulty: "hard", routeNumber: 4, routeStage: "Rota em construção", nextRouteNumber: 5, nextRouteStage: "Rota de abertura" } },
  { label: "unknown mode", gameId: ROUTE, details: { won: false, difficulty: "nightmare", routeNumber: 1, nextRouteNumber: 2 } },
  { label: "no nextRouteNumber", gameId: ROUTE, details: { won: true, difficulty: "medium", routeNumber: 2 } },
  { label: "nextRouteNumber as text", gameId: ROUTE, details: { won: true, difficulty: "easy", routeNumber: 2, nextRouteNumber: "3" } },
  { label: "nextRouteNumber negative", gameId: ROUTE, details: { won: true, difficulty: "easy", nextRouteNumber: -2 } },
  { label: "nextRouteNumber fractional", gameId: ROUTE, details: { won: true, difficulty: "hard", nextRouteNumber: 2.5 } },
  { label: "nextRouteNumber null (NaN once serialised)", gameId: ROUTE, details: { won: true, difficulty: "hard", nextRouteNumber: null } },
  { label: "another game with Route-shaped details", gameId: "color-sequence", details: { level: 3, difficulty: "hard", nextRouteNumber: 4 } },
].map((entry, i) => ({
  id: `legacy-${i}`,
  activityId: entry.gameId,
  activityTitle: entry.gameId === ROUTE ? "Rota Estratégica" : "Circuito de Memória",
  gameId: entry.gameId,
  score: 40 + i,
  playedAt: new Date(Date.UTC(2026, 8, 1, 12, i)).toISOString(),
  summary: entry.label,
  details: entry.details,
}));
const GARBAGE = [null, 7, "result", { id: "half", gameId: ROUTE }, { ...LEGACY[0], details: null }];

{
  const stored = [...LEGACY, ...GARBAGE];
  const before = JSON.parse(JSON.stringify(stored));
  let threw = null;
  let homeProps = null;
  let afterSave = null;
  let tab = null;
  try {
    tab = openTab({ stored });
    const home = tab.find("HomeStage");
    homeProps = { recentResults: home.props.recentResults, selectedGameId: home.props.selectedGameId };
    tab.enter(ROUTE);
    tab.finishEntry();
    tab.complete(producedResults[0] ?? { gameId: ROUTE, activityId: ROUTE, activityTitle: "Rota", score: 1, summary: "s", details: { won: true } });
    afterSave = tab.storage.getRecentResults();
  } catch (error) {
    threw = String(error?.message ?? error);
  }
  const actual = {
    threw,
    homeGotTheWellFormed: homeProps ? same(homeProps.recentResults, LEGACY) : false,
    detailsUntouched: homeProps ? homeProps.recentResults.every((result, i) => same(result.details, before[i].details)) : false,
    selectedWorld: homeProps?.selectedGameId ?? null,
    keptAfterANewSave: afterSave ? same(afterSave.slice(1), LEGACY.slice(0, afterSave.length - 1)) : false,
    noContinuationInvented: homeProps ? homeProps.recentResults.every((result) => !("continuation" in result)) : false,
  };
  record(
    "G2",
    "preserved",
    "LEGACY_RESULTS_STILL_LOAD",
    same(actual, {
      threw: null,
      homeGotTheWellFormed: true,
      detailsUntouched: true,
      selectedWorld: ROUTE,
      keptAfterANewSave: true,
      noContinuationInvented: true,
    }),
    { actual, legacyShapes: LEGACY.map((entry) => entry.summary), garbageFiltered: GARBAGE.length },
  );
}

{
  // (a) The only way into the result screen is the result the game just produced: setLastResult is
  // only ever handed what saveGameResult returned, and stored results only feed the Home.
  const sf = parse(FILES.page);
  const setLastResultArgs = [];
  const bindings = new Map();
  const storedResultUses = [];
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      bindings.set(node.name.text, node.initializer.getText(sf));
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      if (node.expression.text === "setLastResult") setLastResultArgs.push(node.arguments.map((arg) => arg.getText(sf)).join(", "));
    }
    if (ts.isIdentifier(node) && (node.text === "storedResults" || node.text === "nextResults") && !ts.isVariableDeclaration(node.parent)) {
      storedResultUses.push(node.parent.getText(sf).slice(0, 80));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  const lastResultSources = setLastResultArgs.map((arg) => ({ arg, boundTo: bindings.get(arg) ?? null }));
  const staticProof = {
    setLastResultCalls: lastResultSources,
    onlyWhatSaveGameResultReturned:
      lastResultSources.length > 0 && lastResultSources.every((entry) => /^saveGameResult\(/.test(entry.boundTo ?? "")),
    storedResultsFeed: [...new Set(storedResultUses)],
  };
  // (b) With the valid legacy Route result (R4 hard, next 5) newest in storage, the Rota from Home is a fresh entry.
  const tab = openTab({ stored: LEGACY });
  const entered = await follow(tab.enter(ROUTE));
  const arrival = describeArrival(entered);
  const fresh =
    same(arrival.hookArgs, { initialRouteNumber: undefined, initialDifficulty: undefined }) &&
    same(arrival.landed, { route: 1, mode: "easy", status: "setup" }) &&
    !arrival.skipIntro;
  record(
    "G3",
    "preserved",
    "STORED_RESULTS_NEVER_RESUMED_A_JOURNEY",
    staticProof.onlyWhatSaveGameResultReturned &&
      staticProof.storedResultsFeed.every((use) => /setRecentResults|setSelectedDashboardGameId|storedResults\[0\]|return nextResults/.test(use)) &&
      fresh,
    {
      staticProof,
      enteringWithLegacyRouteResultStored: arrival,
      note: "a stored result never reached playAgain — before this mission or after it — so there is no stored continuation to decode: old results keep feeding history and nothing else",
    },
  );
}

// H1 — the Rota resumes only on a well-formed continuation of its own; anything else is a fresh entry, never a crash.
{
  const valid = [
    ...MODES.map((mode) => expectedRouteContinuation(2, mode)),
    expectedRouteContinuation(1, "hard"),
    expectedRouteContinuation(3, "medium"),
  ];
  const malformed = [
    ["another kind", { kind: "probe-kind", routeNumber: 5, difficulty: "hard" }],
    ["no kind", { routeNumber: 5, difficulty: "hard" }],
    ["unknown mode", { kind: ROUTE_KIND, routeNumber: 3, difficulty: "nightmare" }],
    ["mode as number", { kind: ROUTE_KIND, routeNumber: 3, difficulty: 3 }],
    ["no mode", { kind: ROUTE_KIND, routeNumber: 3 }],
    ["no Route", { kind: ROUTE_KIND, difficulty: "hard" }],
    ["Route as text", { kind: ROUTE_KIND, routeNumber: "3", difficulty: "hard" }],
    ["Route 0", { kind: ROUTE_KIND, routeNumber: 0, difficulty: "hard" }],
    ["Route 4, past the journey", { kind: ROUTE_KIND, routeNumber: 4, difficulty: "hard" }],
    ["Route 7, past the journey", { kind: ROUTE_KIND, routeNumber: 7, difficulty: "medium" }],
    ["Route 999, past the journey", { kind: ROUTE_KIND, routeNumber: 999, difficulty: "easy" }],
    ["Route negative", { kind: ROUTE_KIND, routeNumber: -1, difficulty: "hard" }],
    ["Route fractional", { kind: ROUTE_KIND, routeNumber: 2.5, difficulty: "hard" }],
    ["Route NaN", { kind: ROUTE_KIND, routeNumber: Number.NaN, difficulty: "hard" }],
    ["Route Infinity", { kind: ROUTE_KIND, routeNumber: Number.POSITIVE_INFINITY, difficulty: "hard" }],
    ["Route unsafe", { kind: ROUTE_KIND, routeNumber: Number.MAX_SAFE_INTEGER + 2, difficulty: "hard" }],
    ["null", null],
    ["a string", ROUTE_KIND],
    ["an array", [ROUTE_KIND, 3, "hard"]],
  ];
  const run = (continuation) => {
    try {
      const { args, consistent } = mountRota({ onComplete: noop, onExit: noop, continuation });
      return { args, consistent, landed: landedOn(args), crash: null };
    } catch (error) {
      return { args: null, consistent: null, landed: null, crash: String(error?.message ?? error) };
    }
  };
  const validRows = valid.map((continuation) => {
    const out = run(continuation);
    return {
      continuation,
      ...out,
      ok: out.consistent && same(out.landed, { route: continuation.routeNumber, mode: continuation.difficulty, status: "setup" }),
    };
  });
  const malformedRows = malformed.map(([label, continuation]) => {
    const out = run(continuation);
    return {
      label,
      ...out,
      ok:
        out.crash === null &&
        same(out.args, { initialRouteNumber: undefined, initialDifficulty: undefined }) &&
        same(out.landed, { route: 1, mode: "easy", status: "setup" }),
    };
  });
  record(
    "H1",
    "contract",
    "ROTA_READS_ONLY_ITS_OWN_WELL_FORMED_CONTINUATION",
    validRows.every((row) => row.ok) && malformedRows.every((row) => row.ok),
    {
      resumed: validRows.map((row) => `${row.continuation.routeNumber}/${row.continuation.difficulty} -> ${row.landed ? `${row.landed.route}/${row.landed.mode}` : row.crash}`),
      freshInstead: malformedRows.filter((row) => row.ok).map((row) => row.label),
      failing: [...validRows, ...malformedRows].filter((row) => !row.ok),
    },
  );
}

// I1 — the contract costs nothing: the Route's reader is types-only and ships only with the Rota. Its one runtime
// importer besides the Rota is the hook, for the journey's end (`nextJourneyRoute`, ROUTE-JOURNEY-TERMINAL-01) — the
// same chunk; the dev-only launcher reads the journey's length from it too.
// ROUTE-C1 added the hook's one new runtime edge, `route-config`: static data the hook alone imports, which itself
// imports nothing at run time (types only) — so it cannot pull the shell, Babylon or UI into the Rota, nor the Rota
// into anything else.
// ROUTE-C2 moved generation out of the hook: `route-generation` (maps and their certification) and `route-geometry`
// (the board's graph primitives) are two more Rota modules only the Rota reaches. Generation imports configuration,
// geometry, the difficulty helpers and the RNG seam; geometry imports configuration alone — neither the shell, UI,
// Babylon nor the hook — so the Rota chunk carries the same code, split across files.
// ROUTE-C3 moved the defenders' policy out of the hook: `route-defenders` (the Hunter's and the Sentinel's decisions)
// is one more Rota module only the hook reaches. It imports configuration, geometry, the difficulty helpers and the
// RNG seam — the Hunter's draws left the hook with it, so the hook no longer imports `route-random` at all — and
// `MazeMap` from generation as a type only.
// ROUTE-C4 moved the dynamic invariants out of the hook: `route-invariants` (is a logical state possible, can every
// objective still be reached) is one more Rota module only the hook reaches. It imports configuration and geometry at
// run time, and `MazeMap` from generation and `GridPosition` as types only — no RNG, no defenders, no difficulty.
// ROUTE-C5 consolidated the session's mutable state in `route-state` (the state, its actions, the reducer): one more
// Rota module only the hook reaches, and it reaches nothing at run time — its imports are all types.
// ROUTE-C6 added the domain events in `route-events` (what happened in the turn, and the C5 transitions that record
// it): one more Rota module only the hook reaches, and it too reaches nothing at run time — route-state's actions and
// the domain's types are imported as types.
{
  const reader = importsOf(FILES.routeContinuation);
  const importers = SRC_FILES.filter((file) =>
    (importsOf(file) ?? []).some((edge) => edge.file === FILES.routeContinuation && edge.kind === "runtime"),
  );
  const hookRuntime = (importsOf(FILES.hook) ?? []).filter((edge) => edge.kind === "runtime").map((edge) => edge.specifier).sort();
  const typesRuntime = (importsOf(FILES.types) ?? []).filter((edge) => edge.kind === "runtime").map((edge) => edge.specifier);
  const config = importsOf(FILES.routeConfig);
  const runtimeImportersOf = (target) =>
    SRC_FILES.filter((file) => (importsOf(file) ?? []).some((edge) => edge.file === target && edge.kind !== "type")).sort();
  const runtimeSpecifiersOf = (file) => {
    const edges = importsOf(file);
    return edges ? edges.filter((edge) => edge.kind !== "type").map((edge) => edge.specifier).sort() : null;
  };
  const configImporters = runtimeImportersOf(FILES.routeConfig);
  const actual = {
    readerExists: reader !== null,
    readerRuntimeImports: reader ? reader.filter((edge) => edge.kind !== "type").map((edge) => edge.specifier) : null,
    readerImportedAtRuntimeBy: importers,
    hookRuntimeImports: hookRuntime,
    typesRuntimeImports: typesRuntime,
    routeConfigRuntimeImports: config ? config.filter((edge) => edge.kind !== "type").map((edge) => edge.specifier) : null,
    routeConfigImportedAtRuntimeBy: configImporters,
    routeGenerationRuntimeImports: runtimeSpecifiersOf(FILES.routeGeneration),
    routeGenerationImportedAtRuntimeBy: runtimeImportersOf(FILES.routeGeneration),
    routeGeometryRuntimeImports: runtimeSpecifiersOf(FILES.routeGeometry),
    routeGeometryImportedAtRuntimeBy: runtimeImportersOf(FILES.routeGeometry),
    routeDefendersRuntimeImports: runtimeSpecifiersOf(FILES.routeDefenders),
    routeDefendersImportedAtRuntimeBy: runtimeImportersOf(FILES.routeDefenders),
    routeInvariantsRuntimeImports: runtimeSpecifiersOf(FILES.routeInvariants),
    routeInvariantsImportedAtRuntimeBy: runtimeImportersOf(FILES.routeInvariants),
    routeStateRuntimeImports: runtimeSpecifiersOf(FILES.routeState),
    routeStateImportedAtRuntimeBy: runtimeImportersOf(FILES.routeState),
    routeEventsRuntimeImports: runtimeSpecifiersOf(FILES.routeEvents),
    routeEventsImportedAtRuntimeBy: runtimeImportersOf(FILES.routeEvents),
  };
  const expected = {
    readerExists: true,
    readerRuntimeImports: [],
    readerImportedAtRuntimeBy: [FILES.launcher, FILES.rota, FILES.hook],
    hookRuntimeImports: [
      "@/engine/difficulty",
      "@/engine/scoring",
      "@/games/escape-maze/continuation",
      "@/games/escape-maze/route-config",
      "@/games/escape-maze/route-defenders",
      "@/games/escape-maze/route-events",
      "@/games/escape-maze/route-generation",
      "@/games/escape-maze/route-geometry",
      "@/games/escape-maze/route-invariants",
      "@/games/escape-maze/route-state",
      "@/lib/game-sounds",
      "react",
    ],
    typesRuntimeImports: [],
    routeConfigRuntimeImports: [],
    routeConfigImportedAtRuntimeBy: [FILES.routeDefenders, FILES.routeGeneration, FILES.routeGeometry, FILES.routeInvariants, FILES.hook],
    routeGenerationRuntimeImports: [
      "@/engine/difficulty",
      "@/engine/route-random",
      "@/games/escape-maze/route-config",
      "@/games/escape-maze/route-geometry",
    ],
    routeGenerationImportedAtRuntimeBy: [FILES.hook],
    routeGeometryRuntimeImports: ["@/games/escape-maze/route-config"],
    routeGeometryImportedAtRuntimeBy: [FILES.routeDefenders, FILES.routeGeneration, FILES.routeInvariants, FILES.hook],
    routeDefendersRuntimeImports: [
      "@/engine/difficulty",
      "@/engine/route-random",
      "@/games/escape-maze/route-config",
      "@/games/escape-maze/route-geometry",
    ],
    routeDefendersImportedAtRuntimeBy: [FILES.hook],
    routeInvariantsRuntimeImports: ["@/games/escape-maze/route-config", "@/games/escape-maze/route-geometry"],
    routeInvariantsImportedAtRuntimeBy: [FILES.hook],
    routeStateRuntimeImports: [],
    routeStateImportedAtRuntimeBy: [FILES.hook],
    routeEventsRuntimeImports: [],
    routeEventsImportedAtRuntimeBy: [FILES.hook],
  };
  record("I1", "contract", "CONTRACT_COSTS_NOTHING", same(actual, expected), { actual });
}

// I2 — the Home still ships no game: no game module, no Babylon; the registry reaches each game only by import().
{
  const home = runtimeClosure(FILES.page);
  const allowed = new Set([FILES.registry, FILES.entryContract]);
  const registryEdges = importsOf(FILES.registry) ?? [];
  const actual = {
    gameCodeInHome: home.files.filter((file) => file.startsWith("src/games/") && !allowed.has(file)),
    babylonInHome: home.packages.filter((pkg) => pkg.startsWith("@babylonjs/")),
    registryStaticGameImports: registryEdges
      .filter((edge) => edge.kind === "runtime" && edge.file?.startsWith("src/games/") && !allowed.has(edge.file))
      .map((edge) => edge.file),
    registryDynamicImports: registryEdges.filter((edge) => edge.kind === "dynamic").length,
    homeReachesScreenAndRegistry: home.files.includes(FILES.screen) && home.files.includes(FILES.registry),
  };
  record(
    "I2",
    "preserved",
    "HOME_SHIPS_NO_GAME_CODE",
    same(actual, {
      gameCodeInHome: [],
      babylonInHome: [],
      registryStaticGameImports: [],
      registryDynamicImports: GAME_IDS.length,
      homeReachesScreenAndRegistry: true,
    }),
    { actual, homeStaticModules: home.files.length },
  );
}

// J1 — where a finished Route stands. Product: the shell takes the game off the screen in the same handler that saves
// the result, so the result screen is the only way on. Lab launcher (dev-only): the game stays, same session, until the
// lab opens the next one. That nothing inside the game moves the journey on — the Rota's own "next route" button and
// `continueJourney` were removed — is route-journey-ownership-tests.mjs, with its counterfactual against d258077.
{
  // (a) the product shell
  const tab = openTab();
  tab.enter(ROUTE);
  tab.finishEntry();
  const screenBefore = tab.find("GameScreen");
  tab.complete(producedResults[0] ?? { gameId: ROUTE, activityId: ROUTE, activityTitle: "Rota", score: 1, summary: "s", details: { won: true } });
  const product = { gameOnScreenBefore: Boolean(screenBefore), gameOnScreenAfterOnComplete: Boolean(tab.find("GameScreen")), resultShown: Boolean(tab.find("RewardResultModal")) };
  // (b) the dev-only route launcher, the real page
  const launcherWindow = { localStorage: createLocalStorage().api };
  const { react, mount } = createReact();
  const launcherModule = evaluate(FILES.launcher, { window: launcherWindow }, {
    react,
    "react/jsx-runtime": JSX_RUNTIME,
    "@/components/GameScreen": { GameScreen: PAGE_STUBS.GameScreen },
    "@/engine/route-random": evaluate(FILES.routeRandom, {}, {}),
    "@/engine/storage": evaluate(FILES.storage, { window: launcherWindow, Date }, {}),
    ...(ROUTE_CONTINUATION && { "@/games/escape-maze/continuation": ROUTE_CONTINUATION }),
  });
  const launcher = mount(launcherModule.default, {});
  const launch = findElement(launcher.tree, (el) => el.type === "button" && el.props.children === "Launch");
  launcher.act(() => launch.props.onClick());
  const labScreen = findElement(launcher.tree, (el) => el.type === PAGE_STUBS.GameScreen);
  launcher.act(() => labScreen.props.onComplete(producedResults[0] ?? { gameId: ROUTE, details: { won: true } }));
  const labScreenAfter = findElement(launcher.tree, (el) => el.type === PAGE_STUBS.GameScreen);
  const lab = { gameOnScreenAfterOnComplete: Boolean(labScreenAfter), sameSession: labScreenAfter?.key === labScreen?.key };
  record(
    "J1",
    "preserved",
    "RESULT_REPLACES_THE_GAME_IN_PRODUCT_LAB_KEEPS_IT",
    same(product, { gameOnScreenBefore: true, gameOnScreenAfterOnComplete: false, resultShown: true }) &&
      same(lab, { gameOnScreenAfterOnComplete: true, sameSession: true }),
    {
      product,
      lab,
      note: "the browser smoke proves the product half in a real DOM; route-journey-ownership-tests.mjs proves the result's continuation is the only way on, in the product and in the lab",
    },
  );
}

const allPass = tests.every((t) => t.pass);
const tally = (kind) => {
  const subset = tests.filter((t) => t.kind === kind);
  return `${subset.filter((t) => t.pass).length}/${subset.length}`;
};
console.log(
  `\n${REV ? `rev ${REV} · ` : ""}${tests.filter((t) => t.pass).length}/${tests.length} passed · contract ${tally("contract")} · preserved ${tally("preserved")} · terminal ${tally("terminal")} · failing: ${tests.filter((t) => !t.pass).map((t) => t.id).join(", ") || "none"}`,
);
console.log(allPass ? "GAME_CONTINUATION_CONTRACT_OK" : "GAME_CONTINUATION_CONTRACT_FAILED");
process.exitCode = allPass ? EXIT_OK : EXIT_VALIDATION_FAILED;
