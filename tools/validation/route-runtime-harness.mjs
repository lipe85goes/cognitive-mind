/**
 * ROTA-CHEST-REWARDS-01 — a headless driver for the REAL `useEscapeMaze`.
 *
 * The Chest, the Pickaxe and the Second Chance are a state machine, and a state
 * machine can only be tested by running it. Everything the mission asks to
 * prove — that the defenders do not move while the choice is open, that the
 * Pickaxe has one use, that a restart closes the wall again — is a statement
 * about transitions, not about a pure helper.
 *
 * So instead of reimplementing the turn loop here (which would then be the thing
 * under test, rather than the shipped code), this is a ~70-line React: ordered
 * hook cells, a render function, and an `act` that applies an action and
 * re-renders. `useEscapeMaze` is imported unmodified from production.
 *
 * ROUTE-C5: the hook holds its session state with `useReducer`, so the shim has
 * one, with React's semantics rather than a convenient approximation — the
 * initialiser runs once, at mount, as `init(initialArg)`; `dispatch` is created
 * once and keeps its identity; a dispatch only QUEUES the action and marks the
 * route dirty; the queue is drained during the next render, in dispatch order,
 * through the reducer that render passes. `useState` keeps its eager setter: a
 * value is applied when set, and a functional update sees every update queued
 * before it, which is what React's queue gives too. Both are compared with real
 * React (react-dom, Strict Mode on and off) in route-runtime-harness-tests.mjs.
 *
 * `useMemo` and `useCallback` memoise as React does (they used to recompute
 * every render — the same values, more often — until ROUTE-C7B keyed an effect
 * on a callback's identity).
 *
 * ROUTE-C7B: `useEffect` used to do nothing — the only effect was the keyboard
 * listener, an input path. Boards are now asked for from an effect and arrive
 * on a timer (route-generation-client.ts), so the shim runs effects the way
 * React does after a commit (deps compared with Object.is, the previous
 * cleanup first, every cleanup on unmount), and the sandbox's `setTimeout` is
 * a virtual queue `act` drains in order. An input therefore still settles
 * synchronously: input → render → effects → due timers → render… until
 * nothing is scheduled. A render taken while a board is pending or failed
 * (`isLifecycleRender`) is the lifecycle's, not the game's: it is counted in
 * `lifecycleRenders` and handed to `onRender` only when `observeLifecycle` is
 * set, so a comparison with a tree that generated synchronously compares the
 * states the game reaches — the same ones — and not the pending in between.
 * The keyboard listener subscribes to an inert `window` here.
 *
 * `Date.now` is replaced by a monotonic counter so the 150 ms
 * `MOVE_INPUT_GUARD_MS` window never swallows a scripted move. That guard exists
 * to absorb a duplicated gesture from a human hand; a test that fires two moves
 * in the same millisecond is not that.
 */
import { loadInstrumented } from "./instrumented-generator.mjs";
import { ROUTE_HOOK } from "./route-module-loader.mjs";

/**
 * The module captures ONE `react` object when it loads, so the shim cannot be
 * swapped per run. It dispatches instead — exactly the way React resolves hooks
 * against whichever component is currently rendering — which is what lets a
 * suite hold several independent routes alive at the same time.
 */
export function createReactShim() {
  let active = null;

  const shim = {
    useState(initial) {
      const store = active;
      const i = store.index++;
      if (!(i in store.cells)) {
        store.cells[i] = {
          value: typeof initial === "function" ? initial() : initial,
        };
      }
      const cell = store.cells[i];
      return [
        cell.value,
        (next) => {
          cell.value = typeof next === "function" ? next(cell.value) : next;
          store.dirty = true;
        },
      ];
    },
    useReducer(reducer, initialArg, init) {
      const store = active;
      const i = store.index++;
      if (!(i in store.cells)) {
        const cell = {
          value: init !== undefined ? init(initialArg) : initialArg,
          queue: [],
        };
        cell.dispatch = (action) => {
          cell.queue.push(action);
          store.dirty = true;
        };
        store.cells[i] = cell;
      }
      const cell = store.cells[i];
      if (cell.queue.length > 0) {
        const queue = cell.queue;
        cell.queue = [];
        for (const action of queue) cell.value = reducer(cell.value, action);
      }
      return [cell.value, cell.dispatch];
    },
    useRef(initial) {
      const store = active;
      const i = store.index++;
      if (!(i in store.cells)) store.cells[i] = { current: initial };
      return store.cells[i];
    },
    // ROUTE-C7B: memoised with React's rule (deps compared with Object.is). Values are the same either way; identity
    // is not, and an effect keyed on a callback (the generation lifecycle's) re-runs only when React's would.
    useMemo(factory, deps) {
      const store = active;
      const i = store.index++;
      const cell = store.cells[i];
      if (cell && deps !== undefined && cell.deps !== undefined && deps.length === cell.deps.length && deps.every((d, k) => Object.is(d, cell.deps[k]))) {
        return cell.value;
      }
      store.cells[i] = { value: factory(), deps };
      return store.cells[i].value;
    },
    useCallback(fn, deps) {
      return shim.useMemo(() => fn, deps);
    },
    useEffect(effect, deps) {
      const store = active;
      const i = store.index++;
      const cell = store.cells[i] ?? (store.cells[i] = { effect: true, deps: undefined, cleanup: undefined, mounted: false });
      const changed =
        !cell.mounted ||
        deps === undefined ||
        cell.deps === undefined ||
        deps.length !== cell.deps.length ||
        deps.some((dep, k) => !Object.is(dep, cell.deps[k]));
      if (changed) store.pendingEffects.push({ cell, effect, deps });
    },
  };

  return {
    shim,
    createStore: () => ({ cells: [], index: 0, dirty: false, pendingEffects: [] }),
    beginRender(store) {
      active = store;
      store.index = 0;
      store.dirty = false;
      store.pendingEffects = [];
    },
    endRender() {
      active = null;
    },
    /** After a commit: each changed effect's previous cleanup, then the effect, in order. */
    flushEffects(store) {
      const pending = store.pendingEffects;
      store.pendingEffects = [];
      for (const { cell } of pending) {
        if (typeof cell.cleanup === "function") cell.cleanup();
        cell.cleanup = undefined;
      }
      for (const { cell, effect, deps } of pending) {
        const cleanup = effect();
        cell.cleanup = cleanup;
        cell.deps = deps;
        cell.mounted = true;
      }
    },
    /** Unmount: every effect's cleanup. */
    unmount(store) {
      for (const cell of store.cells) {
        if (cell?.effect && typeof cell.cleanup === "function") cell.cleanup();
        if (cell?.effect) cell.cleanup = undefined;
      }
    },
  };
}

/**
 * ROUTE-C7B — the hook's generation lifecycle keys: where the board's
 * generation stands, the mode it is for, how to ask for it again. A tree
 * before C7B has none of them.
 */
export const ROUTE_LIFECYCLE_KEYS = Object.freeze(["generationPhase", "requestedDifficulty", "retryGeneration"]);

/** A render taken while the board is pending or failed: no board yet, or the match frozen. */
export const isLifecycleRender = (game) =>
  game?.mazeMap === null || (typeof game?.generationPhase === "string" && game.generationPhase !== "ready");

/** A render as a tree before C7B would have shown it: the lifecycle keys dropped. */
export const withoutLifecycle = (game) => {
  if (!game || !("generationPhase" in game)) return game;
  const out = {};
  for (const key of Object.keys(game)) if (!ROUTE_LIFECYCLE_KEYS.includes(key)) out[key] = game[key];
  return out;
};

/**
 * A virtual `setTimeout` for the sandbox: callbacks queue in order and run
 * only when drained. Delays are ignored — order is what the lifecycle depends
 * on, and nothing in the Rota schedules more than "next".
 */
export function createVirtualTimers() {
  let nextId = 1;
  const queue = [];
  return {
    setTimeout(fn, _ms, ...args) {
      const id = nextId++;
      queue.push({ id, fn, args });
      return id;
    },
    clearTimeout(id) {
      const index = queue.findIndex((timer) => timer.id === id);
      if (index >= 0) queue.splice(index, 1);
    },
    get pending() {
      return queue.length;
    },
    /** Run the oldest due timer. False when none is queued. */
    runNext() {
      const timer = queue.shift();
      if (!timer) return false;
      timer.fn(...timer.args);
      return true;
    },
  };
}

/** What the `directDifficulty` edit turns `startGame` into, per state engine (see below). */
export const DIRECT_DIFFICULTY_START_GAME = {
  setter: `  const startGame = () => {
    setStatus("playing");
  };`,
  reducer: `  const startGame = () => {
    dispatch({ type: "END_ROUTE", status: "playing", message });
  };`,
  /** ROUTE-C7B: the same edit inside the turn's builder; the match is ready when Start is pressed. */
  lifecycle: `    const startGame = () => {
      dispatch({ type: "END_ROUTE", status: "playing", message });
    };`,
};

/**
 * One loaded copy of the hook module, plus a factory for independent runs.
 * Loading is not cheap (TypeScript in a vm), so a suite loads once and mounts
 * many routes.
 *
 * `directDifficulty` is diagnostic-only. Exact validation seeds are defined as a
 * single direct `generateMaze(difficulty, route)` call, while production draws
 * more than one board on the way to the setup screen. The option aligns those
 * two regimes inside the sandbox, without changing production or the default
 * harness path.
 *
 * ROTA-DIFFICULTY-04B shrank it. It used to rewrite three things; two of them —
 * mounting on the requested mode, and generating the first board for that mode
 * — are now what `initialDifficulty` does in production, so the harness asks
 * for them instead of patching them in. What remains is the one thing
 * production legitimately does and a one-call comparison cannot afford:
 * `startGame` generating a SECOND board.
 *
 * ROUTE-C5: the edit is "status becomes playing, nothing else moves", written
 * in the state engine of the tree being loaded. Up to C4 that is the `status`
 * setter. From C5 the state is one reducer, and `END_ROUTE` is the one
 * transition whose writes are exactly `status` and `message`; the edit hands it
 * "playing" and the message the state already holds, so every other field —
 * the board, the pieces, the counters, the arrays by identity — is untouched,
 * on whatever state `startGame` is called. Production never dispatches it so.
 *
 * `onRender(game, index, { scheduled })` (on `mount`) sees every render, mount
 * included, in order — what route-state-reducer-tests compares render by
 * render. `scheduled` says whether a state update was pending when the render
 * began: `act` always renders once, and React renders only when something was
 * scheduled. `mocks` answers environment modules (route-module-loader).
 *
 * ROUTE-C0: the Rota under test is a module GRAPH, not one file.
 *
 *   rev              every module the hook reaches — the hook, whatever it is
 *                    split into, `difficulty`, `route-random`, `continuation` —
 *                    as it was at that commit, read with `git show`. A
 *                    counterfactual is one coherent revision, never an old hook
 *                    on top of today's engine.
 *   sourceOverrides  `{ "src/…": text }` — replace single modules in memory.
 *                    The one way to mix revisions, and it has to be spelled out.
 *   transforms       per-module (or graph-wide) in-memory edits, as in
 *                    route-module-loader.mjs.
 *
 * Omitted, the working tree is loaded exactly as before. Nothing is written.
 */
export function loadRouteRuntime({ directDifficulty = false, rev = null, sourceOverrides, transforms, mocks } = {}) {
  const react = createReactShim();
  const directDifficultyTransform = directDifficulty
    ? {
        // `startGame` lives inside the hook itself, so this one edit is aimed at it.
        [ROUTE_HOOK]: (source) => {
          // ROUTE-C7B: `startGame` asks for its board (and is nested one level
          // deeper, in the turn's builder); the edit is the same either way.
          const lifecycleStart =
            /    const startGame = \(\) => \{\r?\n      if \(awaitingRoute\) return;\r?\n      requestNewMaze\("start", difficulty, "playing"\);\r?\n    \};/;
          if (lifecycleStart.test(source)) {
            return source.replace(lifecycleStart, DIRECT_DIFFICULTY_START_GAME.lifecycle);
          }
          const startGame =
            /  const startGame = \(\) => \{\r?\n    startNewMaze\(difficulty, "playing"\);\r?\n  \};/;
          if (!startGame.test(source)) {
            throw new Error("directDifficulty transform: startGame shape changed");
          }
          const reducerState = /\buseReducer\(routeStateReducer\b/.test(source);
          const setterState = /const \[status, setStatus\] = useState/.test(source);
          if (reducerState === setterState) {
            throw new Error("directDifficulty transform: cannot tell how this tree holds `status`");
          }
          return source.replace(
            startGame,
            reducerState ? DIRECT_DIFFICULTY_START_GAME.reducer : DIRECT_DIFFICULTY_START_GAME.setter,
          );
        },
      }
    : undefined;
  const LAB = loadInstrumented({
    bare: true,
    react: react.shim,
    rev,
    sourceOverrides,
    transforms: [transforms, directDifficultyTransform],
    mocks,
  });
  const useEscapeMaze = LAB.exports.useEscapeMaze;
  if (typeof useEscapeMaze !== "function") {
    throw new Error("useEscapeMaze is not exported: the hook's shape changed.");
  }

  let clock = 0;
  LAB.sb.Date = { now: () => (clock += 1000) };
  // ROUTE-C7B: the generation client schedules on the sandbox's timer, and the
  // keyboard effect subscribes on its window; both are the shim's.
  const timers = createVirtualTimers();
  LAB.sb.setTimeout = timers.setTimeout;
  LAB.sb.clearTimeout = timers.clearTimeout;
  LAB.sb.window ??= { addEventListener() {}, removeEventListener() {} };

  /**
   * Mount a route and play it. `difficulty` is applied through the product's own
   * `changeDifficulty` + `startGame`, so the run goes through the same path a
   * player does — no state is written from outside.
   *
   * ROTA-DIFFICULTY-04B: `initialDifficulty` models the OTHER entry path — a
   * continuation remount, where `app/page.tsx` hands the mode back to a brand
   * new instance instead of the player re-selecting it. Passing it skips the
   * `changeDifficulty` tap, because that is precisely what the product does.
   * Passing `autoStart: false` stops before `startGame()`, which is what the
   * player sees on arrival: the setup screen, with a mode already chosen.
   */
  function mount({
    seed,
    difficulty = "easy",
    routeNumber = 1,
    initialDifficulty,
    autoStart = true,
    onRender,
    observeLifecycle = false,
  }) {
    LAB.setSeed(seed);
    // In diagnostic mode the requested mode is handed to the hook the same way
    // a continuation hands it over, rather than patched into the source.
    const mountDifficulty = directDifficulty ? difficulty : initialDifficulty;

    const store = react.createStore();
    const completions = [];
    let game = null;
    let renders = 0;
    let lifecycleRenders = 0;
    let mounted = true;

    // The hook has to be called from something the hooks lint rule recognises as
    // a component, because that is exactly what this is: the one place the route
    // is rendered.
    const RouteHarness = () =>
      useEscapeMaze(
        (result) => completions.push(result),
        routeNumber,
        mountDifficulty,
      );

    const render = () => {
      const scheduled = store.dirty;
      react.beginRender(store);
      try {
        game = RouteHarness();
      } finally {
        react.endRender();
      }
      if (isLifecycleRender(game)) {
        if (observeLifecycle) onRender?.(game, renders + lifecycleRenders, { scheduled, lifecycle: true });
        lifecycleRenders += 1;
      } else {
        onRender?.(game, renders, { scheduled });
        renders += 1;
      }
      react.flushEffects(store);
      return game;
    };
    /** Render while something is scheduled, then let the due timers (a generation's answer) run, until quiet. */
    const settle = () => {
      let guard = 0;
      for (;;) {
        while (store.dirty && (guard += 1) < 64) render();
        if (!mounted || !timers.runNext()) break;
        if ((guard += 1) > 256) throw new Error("route-runtime-harness: the route never settled");
      }
    };
    render();
    settle();

    /**
     * One input, settled. `drainTimers: false` renders it (and runs its effects) but leaves the timers queued: the
     * next input then arrives before a generation it asked for has run, as a second tap can.
     */
    const act = (fn, { drainTimers = true } = {}) => {
      fn(game);
      let guard = 0;
      do {
        render();
      } while (store.dirty && (guard += 1) < 8);
      if (drainTimers) settle();
      return game;
    };

    if (mountDifficulty === undefined && difficulty !== "easy") {
      act((g) => g.changeDifficulty(difficulty));
    }
    if (autoStart) act((g) => g.startGame());

    const run = {
      get state() {
        return game;
      },
      /** How many times the route has rendered, mount included (lifecycle renders aside). */
      get renders() {
        return renders;
      },
      /** ROUTE-C7B: renders taken while a board was pending or failed. */
      get lifecycleRenders() {
        return lifecycleRenders;
      },
      completions,
      act,
      /** ROUTE-C7B: run every effect's cleanup, as React does when the route leaves the screen. */
      unmount() {
        mounted = false;
        react.unmount(store);
      },
      /** Move by a delta, as the D-pad and the arrow keys both do. */
      move: (delta) => act((g) => g.tryMovePlayer(delta)),
      /** Step onto a specific ORTHOGONALLY ADJACENT cell. */
      stepTo(cell) {
        return act((g) =>
          g.tryMovePlayer({
            row: cell.row - g.player.row,
            col: cell.col - g.player.col,
          }),
        );
      },
      choose: (reward) => act((g) => g.chooseReward(reward)),
      break: (wall) => act((g) => g.breakWall(wall)),
      restart: () => act((g) => g.restartGame()),
      changeDifficulty: (level) => act((g) => g.changeDifficulty(level)),
      /**
       * ROUTE-JOURNEY-OWNERSHIP-01 — the next Route, the only way the product
       * opens it: a NEW session, mounted on the continuation this Route's
       * result carries (the arguments the Rota hands the hook for it). There
       * is no way forward inside a session, so a Route that has not ended has
       * nothing to open and this throws. `autoStart` as in `mount`.
       */
      nextSession({ seed: nextSeed = seed, autoStart: nextAutoStart = true } = {}) {
        const continuation = completions.at(-1)?.continuation;
        if (!continuation) {
          throw new Error("nextSession: this Route wrote no continuation to open (it has not ended, or it completed the journey)");
        }
        return mount({
          seed: nextSeed,
          routeNumber: continuation.routeNumber,
          difficulty: continuation.difficulty,
          initialDifficulty: continuation.difficulty,
          autoStart: nextAutoStart,
        });
      },
    };
    return run;
  }

  return {
    LAB,
    API: LAB.API,
    get routeRandom() {
      return LAB.routeRandom;
    },
    mount,
  };
}

/** Board helpers that read the runtime's own walls, broken cell included. */
export const cellKey = (p) => `${p.row},${p.col}`;
export const sameCell = (a, b) => a.row === b.row && a.col === b.col;

export function walkableNeighbours(pos, walls, rows = 9, cols = 9) {
  return [
    { row: pos.row - 1, col: pos.col },
    { row: pos.row + 1, col: pos.col },
    { row: pos.row, col: pos.col - 1 },
    { row: pos.row, col: pos.col + 1 },
  ].filter(
    (n) =>
      n.row >= 0 &&
      n.row < rows &&
      n.col >= 0 &&
      n.col < cols &&
      !walls.has(cellKey(n)),
  );
}

/** Shortest walkable route between two cells, as a list of cells. */
export function pathBetween(from, to, walls) {
  const previous = new Map([[cellKey(from), null]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i += 1) {
    const current = queue[i];
    if (sameCell(current, to)) {
      const cells = [];
      let cursor = cellKey(current);
      while (cursor) {
        const [row, col] = cursor.split(",").map(Number);
        cells.unshift({ row, col });
        cursor = previous.get(cursor);
      }
      return cells;
    }
    for (const next of walkableNeighbours(current, walls)) {
      const key = cellKey(next);
      if (previous.has(key)) continue;
      previous.set(key, cellKey(current));
      queue.push(next);
    }
  }
  return null;
}

/**
 * Play a Route to its end. To win: lights, then the portal, around the Hunter's
 * reach when there is a way around (and the Second Chance in hand). To lose:
 * straight at the Hunter, with the Pickaxe. Losing is a completion too, and
 * writes the same continuation. Returns the final status, or "stuck"/"budget".
 */
export function playToEnd(run, policy, budget = 400) {
  for (let guard = 0; guard < budget; guard += 1) {
    const g = run.state;
    if (g.status !== "playing") return g.status;
    if (g.rewardChoicePending) {
      run.choose(policy === "lose" ? "pickaxe" : "second-chance");
      continue;
    }
    let best = null;
    if (policy === "lose") {
      best = pathBetween(g.player, g.guardian, g.walls);
    } else {
      const remaining = g.mazeMap.collectibleStars.filter((star) => !g.collectedSet.has(cellKey(star)));
      const goals = remaining.length ? remaining : [g.mazeMap.exitPosition];
      const reach = [g.guardian, g.sentinel, ...walkableNeighbours(g.guardian, g.walls)].map(cellKey);
      const around = new Set([...g.walls, ...reach]);
      around.delete(cellKey(g.player));
      for (const goal of goals) {
        around.delete(cellKey(goal));
        const route = pathBetween(g.player, goal, around) ?? pathBetween(g.player, goal, g.walls);
        if (route && (!best || route.length < best.length)) best = route;
      }
    }
    if (!best || best.length < 2) return "stuck";
    run.stepTo(best[1]);
  }
  return "budget";
}

/**
 * Walk the Explorer to a target cell one legal step at a time, stopping early if
 * the route ends (a win, a loss, or a Chest that paused the turn).
 */
export function walkTo(run, target) {
  for (let step = 0; step < 64; step += 1) {
    const game = run.state;
    if (sameCell(game.player, target)) return true;
    if (game.status !== "playing" || game.rewardChoicePending) return false;
    const path = pathBetween(game.player, target, game.walls);
    if (!path || path.length < 2) return false;
    run.stepTo(path[1]);
  }
  return false;
}
