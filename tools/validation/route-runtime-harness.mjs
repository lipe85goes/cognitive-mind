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
 * Two deliberate simplifications, neither of which can hide a bug:
 *
 *  - `useMemo` recomputes every render. Memoisation is an optimisation; running
 *    it always can only produce the same values more often.
 *  - `useEffect` does nothing. The only effect in the hook is the keyboard
 *    listener, which is an input path, not a rule.
 *
 * `Date.now` is replaced by a monotonic counter so the 150 ms
 * `MOVE_INPUT_GUARD_MS` window never swallows a scripted move. That guard exists
 * to absorb a duplicated gesture from a human hand; a test that fires two moves
 * in the same millisecond is not that.
 */
import { loadInstrumented, normalizeSource } from "./instrumented-generator.mjs";

/**
 * The module captures ONE `react` object when it loads, so the shim cannot be
 * swapped per run. It dispatches instead — exactly the way React resolves hooks
 * against whichever component is currently rendering — which is what lets a
 * suite hold several independent routes alive at the same time.
 */
function createReactShim() {
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
    useRef(initial) {
      const store = active;
      const i = store.index++;
      if (!(i in store.cells)) store.cells[i] = { current: initial };
      return store.cells[i];
    },
    useMemo(factory) {
      active.index += 1;
      return factory();
    },
    useCallback(fn) {
      active.index += 1;
      return fn;
    },
    useEffect() {
      active.index += 1;
    },
  };

  return {
    shim,
    createStore: () => ({ cells: [], index: 0, dirty: false }),
    beginRender(store) {
      active = store;
      store.index = 0;
      store.dirty = false;
    },
    endRender() {
      active = null;
    },
  };
}

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
 * `hookSource` replaces the text of `useEscapeMaze.ts` — the hook as it was at
 * another commit, for a counterfactual run. Omitted, the working tree's hook is
 * loaded exactly as before.
 */
export function loadRouteRuntime({ directDifficulty = false, hookSource } = {}) {
  const react = createReactShim();
  const sourceTransform =
    hookSource === undefined ? undefined : () => hookSource;
  const directDifficultyTransform = directDifficulty
    ? (source) => {
        const startGame =
          /  const startGame = \(\) => \{\r?\n    startNewMaze\(difficulty, "playing"\);\r?\n  \};/;
        if (!startGame.test(source)) {
          throw new Error("directDifficulty transform: startGame shape changed");
        }
        return source.replace(
          startGame,
          `  const startGame = () => {
    setStatus("playing");
  };`,
        );
      }
    : undefined;
  const transform =
    sourceTransform && directDifficultyTransform
      ? (source) => directDifficultyTransform(normalizeSource(sourceTransform(source)))
      : sourceTransform ?? directDifficultyTransform;
  const LAB = loadInstrumented({
    bare: true, react: react.shim, transform,
  });
  const useEscapeMaze = LAB.exports.useEscapeMaze;
  if (typeof useEscapeMaze !== "function") {
    throw new Error("useEscapeMaze is not exported: the hook's shape changed.");
  }

  let clock = 0;
  LAB.sb.Date = { now: () => (clock += 1000) };

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
  }) {
    LAB.setSeed(seed);
    // In diagnostic mode the requested mode is handed to the hook the same way
    // a continuation hands it over, rather than patched into the source.
    const mountDifficulty = directDifficulty ? difficulty : initialDifficulty;

    const store = react.createStore();
    const completions = [];
    let game = null;

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
      react.beginRender(store);
      try {
        game = RouteHarness();
      } finally {
        react.endRender();
      }
      return game;
    };
    render();

    const act = (fn) => {
      fn(game);
      let guard = 0;
      do {
        render();
      } while (store.dirty && (guard += 1) < 8);
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
      completions,
      act,
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

  return { LAB, API: LAB.API, routeRandom: LAB.routeRandom, mount };
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
