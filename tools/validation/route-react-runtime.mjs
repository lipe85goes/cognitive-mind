/**
 * ROUTE-C5 — the REAL `useEscapeMaze`, rendered by the REAL React.
 *
 * route-runtime-harness.mjs drives the hook through a ~100-line React shim. That
 * is the right tool for thousands of games, and it is only as good as the shim:
 * it says nothing about how React itself batches updates, when it runs a
 * reducer, or what Strict Mode does to an initialiser. Moving eighteen state
 * cells into one `useReducer` is exactly a change in that territory, so this
 * module answers those questions with React and react-dom from node_modules.
 *
 *   - The component renders nothing (`null`), so react-dom needs no real DOM:
 *     a container object and the few window/document properties react-dom
 *     reads are enough. Nothing is mocked inside React.
 *   - Each configuration runs in its own worker thread, because React picks its
 *     development or production build once per module registry, from
 *     NODE_ENV. A worker is a fresh registry with its own env.
 *   - The Rota is loaded through route-module-loader (one tree: the working
 *     tree or a `rev`), with the real React handed in as `react`, the real
 *     scoring (not the stub every shim harness uses), and recording sounds.
 *   - The hook's own keyboard effect runs: `key` steps are dispatched on the
 *     window the effect subscribed to, which is the product's input path.
 *
 * A step is performed in one of three regimes:
 *
 *   act       inside `React.act` (development builds only);
 *   default   outside React, as a timer or network callback would: React
 *             schedules the render itself and batches whatever was queued;
 *   discrete  outside React with `window.event` set to the input event, the
 *             way a native keydown/click reaches React: sync-lane updates,
 *             flushed in a microtask.
 *
 * Every committed render is recorded through a layout effect (`commits`), and
 * every call of the component body too (`bodies` — Strict Mode calls it twice).
 * Each step also records what it did outside the state: sounds and onComplete,
 * in order, and the random draws and `generateMaze` calls it caused.
 *
 * Writes nothing.
 */
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { Worker, isMainThread, workerData, parentPort } from "node:worker_threads";

import { createModuleGraph, loadRouteModules, openSourceTree } from "./route-module-loader.mjs";
import { cellKey, loadRouteRuntime, pathBetween, sameCell, walkableNeighbours } from "./route-runtime-harness.mjs";

const SELF = fileURLToPath(import.meta.url);
const SCORING = "src/engine/scoring.ts";

// =================================================================================================
// what a render shows — shared by every driver, so two drivers are compared on the same terms
// =================================================================================================

const sha = (value) => crypto.createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex").slice(0, 16);
/** Sets keep their iteration order (it is part of what the hook hands out), tagged so a Set never equals an array. */
const plain = (value) =>
  JSON.parse(JSON.stringify(value, (_key, v) => (v instanceof Set || v?.constructor?.name === "Set" ? { $set: [...v] } : v)));

export const mapDigest = (map) => sha(plain(map));

/**
 * Everything a render of the hook exposes, field by field, in the order the hook returns them. Functions are only
 * named (their identity is React's business, compared separately where it matters); the map is a digest of all of
 * it (plus the portal, which a reader needs to re-ask the Sentinel); every other value is its full content.
 */
export function observeRoute(g) {
  const out = {};
  for (const key of Object.keys(g)) {
    const value = g[key];
    if (typeof value === "function") out[key] = "function";
    else if (key === "mazeMap") out[key] = { digest: mapDigest(value), exitPosition: plain(value.exitPosition) };
    else out[key] = plain(value);
  }
  return out;
}

// =================================================================================================
// scripted Explorers — decisions read only the state a render exposes, so equal states make equal decisions
// =================================================================================================

/**
 * One action of a scripted Explorer, or null when it has nothing to do.
 *
 *   win          lights then portal, around the Hunter's reach; Second Chance at the Chest
 *   lose         straight at the Hunter; Pickaxe at the Chest
 *   pickaxe      Chest, Pickaxe, break the first wall in reach, then win
 *   pickaxe-bump Chest, Pickaxe, walk into a wall once (the hint), break, then win
 *   traps        cross every trap, then win
 *   sc-hunter    Chest, Second Chance, then straight at the Hunter
 *   sc-sentinel  Chest, Second Chance, then straight at the Sentinel
 *   sc-portal    Chest, Second Chance, lights and portal around the defenders' cells only
 *   sc-bait      Chest, Second Chance, then onto the cell the Sentinel's own policy steps into (toward its door)
 *   chest-wait   Chest; once, try to move while the choice is pending; Pickaxe; break; win
 *   bump         every third action walks off the board or into a wall, otherwise win
 */
export const POLICIES = [
  "win", "lose", "pickaxe", "pickaxe-bump", "traps", "sc-hunter", "sc-sentinel", "sc-portal", "sc-bait", "chest-wait", "bump",
];
const DELTAS = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

export function nextAction(g, policy, api, memo) {
  memo.n = (memo.n ?? 0) + 1;
  if (g.rewardChoicePending) {
    if (policy === "chest-wait" && !memo.waited) {
      memo.waited = true;
      return ["move", DELTAS.find((d) => !g.walls.has(cellKey({ row: g.player.row + d.row, col: g.player.col + d.col }))) ?? DELTAS[0]];
    }
    const pickaxe = ["lose", "pickaxe", "pickaxe-bump", "chest-wait"].includes(policy);
    return ["choose", pickaxe ? "pickaxe" : "second-chance"];
  }
  const blocked = (d) => {
    const cell = { row: g.player.row + d.row, col: g.player.col + d.col };
    return cell.row < 0 || cell.row > 8 || cell.col < 0 || cell.col > 8 || g.walls.has(cellKey(cell));
  };
  if (policy === "pickaxe-bump" && g.pickaxeAvailable && !memo.bumped) {
    const wall = DELTAS.find((d) => {
      const cell = { row: g.player.row + d.row, col: g.player.col + d.col };
      return cell.row >= 0 && cell.row <= 8 && cell.col >= 0 && cell.col <= 8 && g.walls.has(cellKey(cell));
    });
    if (wall) {
      memo.bumped = true;
      return ["move", wall];
    }
  }
  if (["pickaxe", "pickaxe-bump", "chest-wait"].includes(policy) && g.breakTargets.length > 0) return ["break", g.breakTargets[0].cell];
  if (policy === "bump" && memo.n % 3 === 0) {
    const wall = DELTAS.find(blocked);
    if (wall) return ["move", wall];
  }
  let best = null;
  const towardChest =
    ["pickaxe", "pickaxe-bump", "chest-wait"].includes(policy) || policy.startsWith("sc-") ? !g.chestOpened && g.chestPosition : false;
  if (towardChest) best = pathBetween(g.player, g.chestPosition, g.walls);
  else if (policy === "sc-bait" && g.secondChanceAvailable) {
    const free = walkableNeighbours(g.player, g.walls).filter((c) => !sameCell(c, g.guardian) && !sameCell(c, g.sentinel));
    const held = { position: g.sentinel, target: g.sentinelTarget, commitLeft: g.sentinelCommitLeft };
    const bait = free.find((c) => sameCell(api.decideSentinelMove(held, c, g.mazeMap.exitPosition, g.walls, g.portalDefenceZone, 3, g.triggeredTrapSet).position, c));
    if (bait) return ["step", bait];
    // No bait in reach: head for the door the Sentinel holds (or its neighbours), around the Hunter (C3's policy).
    const goals = [...(g.sentinelTarget ? [g.sentinelTarget] : []), ...walkableNeighbours(g.sentinel, g.walls)].filter((c) => !sameCell(c, g.player) && !sameCell(c, g.sentinel));
    const around = new Set([...g.walls, ...[g.guardian, g.sentinel, ...walkableNeighbours(g.guardian, g.walls)].map(cellKey)]);
    around.delete(cellKey(g.player));
    for (const goal of goals) {
      if (around.has(cellKey(goal))) continue;
      const route = pathBetween(g.player, goal, around);
      if (route && (!best || route.length < best.length)) best = route;
    }
    best ??= pathBetween(g.player, g.mazeMap.exitPosition, new Set([...g.walls, cellKey(g.sentinel), cellKey(g.guardian)]));
  } else if (policy === "lose" || policy === "sc-hunter") best = pathBetween(g.player, g.guardian, g.walls);
  else if (policy === "sc-sentinel") best = pathBetween(g.player, g.sentinel, g.walls);
  else {
    const unarmed = policy === "traps" ? g.mazeMap.traps.filter((trap) => !g.triggeredTrapSet.has(cellKey(trap))) : [];
    const remaining = g.mazeMap.collectibleStars.filter((star) => !g.collectedSet.has(cellKey(star)));
    const goals = unarmed.length ? unarmed : remaining.length ? remaining : [g.mazeMap.exitPosition];
    const reach = (policy === "sc-portal" ? [g.guardian, g.sentinel] : [g.guardian, g.sentinel, ...walkableNeighbours(g.guardian, g.walls)]).map(cellKey);
    const around = new Set([...g.walls, ...reach]);
    around.delete(cellKey(g.player));
    for (const goal of goals) {
      around.delete(cellKey(goal));
      const route = pathBetween(g.player, goal, around) ?? pathBetween(g.player, goal, g.walls);
      if (route && (!best || route.length < best.length)) best = route;
    }
  }
  if (!best || best.length < 2) return null;
  return ["step", best[1]];
}

/** The hook call an action stands for. `key` goes through the window the hook's effect listens on. */
export function applyAction(g, [kind, arg]) {
  if (kind === "choose") return g.chooseReward(arg);
  if (kind === "break") return g.breakWall(arg);
  if (kind === "move") return g.tryMovePlayer(arg);
  if (kind === "step") return g.tryMovePlayer({ row: arg.row - g.player.row, col: arg.col - g.player.col });
  if (kind === "start") return g.startGame();
  if (kind === "restart") return g.restartGame();
  if (kind === "changeDifficulty") return g.changeDifficulty(arg);
  throw new Error(`unknown action ${kind}`);
}

/** Arrow key for a delta, and the Explorer's step as a key — the product's other input path. */
export const KEY_FOR = (d) => (d.row === -1 ? "ArrowUp" : d.row === 1 ? "ArrowDown" : d.col === -1 ? "ArrowLeft" : "ArrowRight");

/**
 * A scenario: where the session mounts and what happens, as data (it crosses into a worker).
 *
 *   { seed, routeNumber, difficulty?, initialDifficulty?, autoStart?, steps: [...] }
 *
 * Steps: ["start"] · ["restart"] · ["changeDifficulty", mode] · ["move", delta] · ["choose", reward] ·
 * ["break", cell] · ["play", policy, budget, { keys }] (a scripted Explorer; with `keys`, steps and moves are
 * pressed as arrow keys and a lone wall in reach is opened with Enter) · ["key", key, { repeat }] ·
 * ["next", seed] (unmount, mount the next session on the last continuation, if any).
 */

// =================================================================================================
// one scenario runner, two renderers
// =================================================================================================

/**
 * The environment every driver loads the Rota with, so two drivers differ only in the renderer: the real scoring
 * (the shim harnesses stub it to 0 elsewhere), and sounds that write to `effects` instead of playing.
 */
function rotaEnvironment(tree, effects) {
  return {
    [SCORING]: createModuleGraph({ tree }).require(SCORING),
    "src/lib/game-sounds.ts": {
      playGentleErrorTone: () => effects.push("sound:error"),
      playSuccessChime: () => effects.push("sound:success"),
      playStoneBreak: () => effects.push("sound:stone"),
    },
  };
}

/** Counts random draws and `generateMaze` calls on a loaded graph, wherever generation is declared. */
function instrumentStream(graph, math) {
  const counters = { draws: 0, generations: 0 };
  const seeded = math.random;
  math.random = () => {
    counters.draws += 1;
    return seeded();
  };
  const generation = graph.require(graph.tree.declaring("generateMaze"));
  const realGenerate = generation.generateMaze;
  generation.generateMaze = (...args) => {
    counters.generations += 1;
    return realGenerate(...args);
  };
  return { counters, peek: () => [seeded(), seeded(), seeded()] };
}

/**
 * Plays scenarios on a renderer. A renderer gives:
 *   mount({ seed, routeNumber, initialDifficulty, onComplete }) → Promise   (unmounts what was there)
 *   perform(fn, eventType) → Promise          one input, settled
 *   key(key, repeat)                          a native keydown on the window (null when there is none)
 *   committed()                               the game of the last committed render
 *   commits, bodies                           every committed render (observed) and every body call so far
 *   keyListeners()                            keydown listeners on the window
 *   unmount() → Promise
 */
async function runScenarios(renderer, scenarios, { counters, peek, effects, setSeed }) {
  const results = [];
  for (const scenario of scenarios) {
    const record = { scenario: scenario.name, steps: [], completions: [], sessions: 0 };
    const commitsAtStart = renderer.commits.length;
    const bodiesAtStart = renderer.bodies();
    counters.draws = 0;
    counters.generations = 0;

    const measure = async (label, fn) => {
      const before = { commits: renderer.commits.length, bodies: renderer.bodies(), draws: counters.draws, generations: counters.generations, effects: effects.length };
      await fn();
      record.steps.push({
        label,
        commits: renderer.commits.length - before.commits,
        bodies: renderer.bodies() - before.bodies,
        draws: counters.draws - before.draws,
        generations: counters.generations - before.generations,
        effects: effects.slice(before.effects),
        keyListeners: renderer.keyListeners(),
      });
    };
    const mount = (label, { seed, routeNumber, initialDifficulty }) =>
      measure(label, async () => {
        setSeed(seed);
        record.sessions += 1;
        await renderer.mount({
          seed,
          routeNumber,
          initialDifficulty,
          onComplete: (result) => {
            effects.push(`onComplete:${result.details?.won ? "won" : "lost"}`);
            record.completions.push(plain(result));
          },
        });
      });
    const act = (label, action) => measure(label, () => renderer.perform(() => applyAction(renderer.committed(), action), "click"));
    const press = (label, k, repeat) => measure(label, () => renderer.perform(() => renderer.key(k, repeat), null));

    await mount("mount", scenario);
    if (scenario.changeDifficulty) await act(`changeDifficulty:${scenario.changeDifficulty}`, ["changeDifficulty", scenario.changeDifficulty]);
    if (scenario.autoStart !== false) await act("start", ["start"]);
    for (const [kind, arg, options] of scenario.steps ?? []) {
      if (kind === "play") {
        const memo = {};
        for (let guard = 0; guard < arg && renderer.committed().status === "playing"; guard += 1) {
          const g = renderer.committed();
          const action = nextAction(g, options?.policy ?? "win", renderer.api, memo);
          if (!action) break;
          if (options?.keys && renderer.key && (action[0] === "step" || action[0] === "move")) {
            const d = action[0] === "move" ? action[1] : { row: action[1].row - g.player.row, col: action[1].col - g.player.col };
            await press(`key:${KEY_FOR(d)}`, KEY_FOR(d), false);
          } else if (options?.keys && renderer.key && action[0] === "break" && g.breakTargets.length === 1) {
            await press("key:Enter", "Enter", false);
          } else {
            await act(action[0], action);
          }
        }
      } else if (kind === "key") {
        await press(`key:${arg}${options?.repeat ? ":repeat" : ""}`, arg, Boolean(options?.repeat));
      } else if (kind === "next") {
        const continuation = record.completions.at(-1)?.continuation;
        if (!continuation) {
          record.steps.push({ label: "next:none" });
          continue;
        }
        await mount("next", { seed: arg, routeNumber: continuation.routeNumber, initialDifficulty: continuation.difficulty });
        await act("start", ["start"]);
      } else {
        await act(kind, [kind, arg]);
      }
    }
    record.commits = renderer.commits.slice(commitsAtStart);
    record.bodies = renderer.bodies() - bodiesAtStart;
    record.draws = counters.draws;
    record.generations = counters.generations;
    // The stream after the session: the next three numbers anyone would draw (read past the counter).
    record.next = peek();
    await renderer.unmount();
    record.keyListenersAfterUnmount = renderer.keyListeners();
    results.push(record);
  }
  return results;
}

// =================================================================================================
// the shim (route-runtime-harness.mjs), on the same terms
// =================================================================================================

/**
 * The same scenarios through route-runtime-harness.mjs. Its `act` renders once even when nothing was scheduled;
 * React renders only when something was, so a render counts as a commit here when it was scheduled (or is the
 * mount). The shim runs no effects: no keyboard listener, so scenarios with keys are for the real React only.
 */
export async function runInShim({ rev = null, scenarios, sourceOverrides }) {
  const effects = [];
  const tree = openSourceTree({ rev, sourceOverrides });
  const runtime = loadRouteRuntime({ rev, sourceOverrides, mocks: rotaEnvironment(tree, effects) });
  const { counters, peek } = instrumentStream(runtime.LAB.graph, runtime.LAB.sb.Math);
  const commits = [];
  let bodies = 0;
  let run = null;
  const renderer = {
    api: runtime.API,
    commits,
    bodies: () => bodies,
    key: null,
    keyListeners: () => 0,
    committed: () => run.state,
    async mount({ routeNumber, initialDifficulty, onComplete, seed }) {
      run = runtime.mount({
        seed,
        routeNumber,
        initialDifficulty,
        autoStart: false,
        onRender: (game, index, { scheduled }) => {
          bodies += 1;
          if (index === 0 || scheduled) commits.push(observeRoute(game));
        },
      });
      // The harness collects completions itself; hand each one to the scenario as React's onComplete would.
      const seen = run.completions;
      const push = seen.push.bind(seen);
      seen.push = (...items) => {
        items.forEach(onComplete);
        return push(...items);
      };
    },
    async perform(fn) {
      run.act(() => fn());
    },
    async unmount() {
      run = null;
    },
  };
  // `mount` reseeds through the harness; the scenario runner seeds first, which is the same seed.
  return runScenarios(renderer, scenarios, { counters, peek, effects, setSeed: runtime.LAB.setSeed });
}

// =================================================================================================
// real React, in a worker
// =================================================================================================

/**
 * Run scenarios on the real React. `nodeEnv` "development" | "production", `strict` wraps the session in
 * <StrictMode>, `regime` "act" | "default" | "discrete" (act needs development). Resolves with
 * `{ results, consoleErrors, reactVersion }`, one record per scenario.
 */
export function runInRealReact({ rev = null, nodeEnv = "development", strict = false, regime = "discrete", scenarios, sourceOverrides }) {
  if (regime === "act" && nodeEnv !== "development") throw new Error("React.act exists in development builds only");
  return new Promise((resolve, reject) => {
    const worker = new Worker(SELF, {
      workerData: { routeReactRuntime: true, rev, strict, regime, scenarios, sourceOverrides },
      env: { ...process.env, NODE_ENV: nodeEnv },
    });
    let settled = false;
    worker.once("message", (message) => {
      settled = true;
      if (message.error) reject(new Error(message.error));
      else resolve(message.result);
      worker.terminate();
    });
    worker.once("error", (error) => {
      if (!settled) reject(error);
    });
    worker.once("exit", (code) => {
      if (!settled) reject(new Error(`real React worker exited with ${code} before answering`));
    });
  });
}

function installDom() {
  class FakeIFrame {}
  const listeners = new Map();
  const fakeWindow = {
    event: undefined,
    HTMLIFrameElement: FakeIFrame,
    getSelection: () => null,
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    /** A native event on the window: `window.event` is the event while listeners run, as in a browser. */
    dispatch(event) {
      const previous = fakeWindow.event;
      fakeWindow.event = event;
      try {
        for (const fn of [...(listeners.get(event.type) ?? [])]) fn(event);
      } finally {
        fakeWindow.event = previous;
      }
    },
    listenerCount: (type) => listeners.get(type)?.size ?? 0,
  };
  const fakeDocument = {
    nodeType: 9,
    activeElement: null,
    defaultView: fakeWindow,
    documentElement: {},
    addEventListener() {},
    removeEventListener() {},
    createElement: () => ({ style: {} }),
  };
  // react-dom decides at load time whether it runs in a DOM (window.document.createElement). It must not: there is
  // nothing to draw. The document is attached once it has loaded — commits read it through the container's owner.
  globalThis.window = fakeWindow;
  const attachDocument = () => {
    fakeWindow.document = fakeDocument;
  };
  const container = () => ({
    nodeType: 1,
    nodeName: "DIV",
    tagName: "DIV",
    ownerDocument: fakeDocument,
    childNodes: [],
    firstChild: null,
    textContent: "",
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    removeChild() {},
  });
  return { fakeWindow, container, attachDocument };
}

/**
 * The real React, as a renderer for `runScenarios`. Exported for the shim's own tests, which render synthetic
 * components through both; `load` is how the caller gets its module graph once React is in place.
 */
export async function createReactRenderer({ strict, regime }) {
  if (regime === "act") globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { fakeWindow, container, attachDocument } = installDom();
  const require = createRequire(SELF);
  const React = require("react");
  const ReactDOMClient = require("react-dom/client");
  attachDocument();

  const commits = [];
  let bodies = 0;
  let committed = null;
  let root = null;

  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  const microtasks = () => new Promise((resolve) => queueMicrotask(resolve));
  async function perform(fn, eventType) {
    if (regime === "act") {
      React.act(() => {
        fn();
      });
      return;
    }
    if (regime === "discrete" && eventType) {
      const previous = fakeWindow.event;
      fakeWindow.event = { type: eventType };
      try {
        fn();
      } finally {
        fakeWindow.event = previous;
      }
    } else fn();
    await microtasks();
    // Let React's scheduler run whatever it scheduled, then make sure nothing else is coming.
    for (let quiet = 0, guard = 0; quiet < 3 && guard < 200; guard += 1) {
      const before = commits.length + bodies;
      await tick();
      quiet = commits.length + bodies === before ? quiet + 1 : 0;
    }
  }

  /**
   * Render `Body` (a component of no props whose return value is what we observe) as the root, inside StrictMode when
   * asked; every call of it is counted, every commit recorded through `observe`.
   */
  async function render(Body, observe) {
    if (root) {
      const old = root;
      root = null;
      await perform(() => old.unmount());
    }
    const counted = () => {
      bodies += 1;
      return Body();
    };
    function Probe() {
      const value = counted();
      React.useLayoutEffect(() => {
        committed = value;
        commits.push(observe(value));
      });
      return null;
    }
    root = ReactDOMClient.createRoot(container());
    const element = React.createElement(Probe);
    await perform(() => root.render(strict ? React.createElement(React.StrictMode, null, element) : element));
  }

  return {
    React,
    fakeWindow,
    commits,
    bodies: () => bodies,
    committed: () => committed,
    perform,
    render,
    key(k, repeat = false) {
      fakeWindow.dispatch({ type: "keydown", key: k, repeat, defaultPrevented: false, preventDefault() {
        this.defaultPrevented = true;
      } });
    },
    keyListeners: () => fakeWindow.listenerCount("keydown"),
    async unmount() {
      if (!root) return;
      const old = root;
      root = null;
      await perform(() => old.unmount());
    },
  };
}

async function workerMain() {
  const { rev, strict, regime, scenarios, sourceOverrides } = workerData;
  const consoleErrors = [];
  console.error = (...args) => consoleErrors.push(args.map(String).join(" ").slice(0, 300));
  console.warn = (...args) => consoleErrors.push(`warn: ${args.map(String).join(" ").slice(0, 300)}`);

  const react = await createReactRenderer({ strict, regime });
  const effects = [];
  const tree = openSourceTree({ rev, sourceOverrides });
  const rota = loadRouteModules({ tree, react: react.React, mocks: rotaEnvironment(tree, effects), surface: ["decideSentinelMove"] });
  const { counters, peek } = instrumentStream(rota.graph, rota.seededMath);
  let clock = 0;
  rota.sandbox.Date = { now: () => (clock += 1000) };
  // The hook's keyboard effect subscribes on `window`: the same object react-dom reads `window.event` from.
  rota.sandbox.window = react.fakeWindow;
  const { useEscapeMaze } = rota.hook;

  const renderer = {
    ...react,
    api: rota.api,
    mount: ({ routeNumber, initialDifficulty, onComplete }) => {
      const RouteProbe = () => useEscapeMaze(onComplete, routeNumber, initialDifficulty);
      return react.render(RouteProbe, observeRoute);
    },
  };
  const results = await runScenarios(renderer, scenarios, { counters, peek, effects, setSeed: rota.setSeed });
  return { results, consoleErrors, reactVersion: react.React.version };
}

if (!isMainThread && workerData?.routeReactRuntime) {
  workerMain().then(
    (result) => parentPort.postMessage({ result }),
    (error) => parentPort.postMessage({ error: String(error?.stack ?? error) }),
  );
}
