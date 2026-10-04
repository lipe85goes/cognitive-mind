/**
 * ROUTE-C5 — the runtime harness's React shim, held against the real React.
 *
 * route-runtime-harness.mjs drives the real `useEscapeMaze` through a small React of its own. Since ROUTE-C5 the
 * hook keeps its whole session state in one `useReducer`, so the shim has one — and a shim is only evidence if it
 * behaves like React wherever the hook can tell the difference. This test renders the same things through the shim
 * and through react-dom (the repository's own React 19, in a worker: production and development builds, Strict
 * Mode off), and requires the same committed values:
 *
 *   [semantics]  synthetic components, one property each: the initialiser runs once, at mount, as init(initialArg);
 *                without one the initial argument is the state itself; `dispatch` keeps its identity across renders
 *                and from a stale closure; several dispatches in one handler are one render, folded in order;
 *                the queue is drained at render with the reducer THAT render passes (a closure over state updated
 *                in the same batch); functional `useState` updates interleaved with dispatches; an input that
 *                schedules nothing renders nothing; mixed hook cells keep their order. One property React has and
 *                the shim does not model — a reducer returning the SAME state object — is reported, and C5's
 *                reducer is required never to do it (route-state-reducer-tests R2).
 *   [hook]       the real `useEscapeMaze`, on the working tree (useReducer) and on 74ff2dc (eighteen useState
 *                cells): scripted Routes through the shim and through the real React give the same committed
 *                renders, the same commits per input, completions, sounds, random draws and generateMaze calls.
 *                The shim runs no effects, so the keyboard listener count and body calls are not compared.
 *   [harness]    the harness itself: the directDifficulty edit lands in either state engine and starts the same
 *                Route both ways; `onRender` sees every render in order with `scheduled`; every helper the
 *                validators use is still there.
 *
 * Usage: node tools/validation/route-runtime-harness-tests.mjs
 * Writes nothing. Exit 0 = every check holds, 1 = a check failed.
 */
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { fileURLToPath } from "node:url";

import { EXIT_OK, EXIT_VALIDATION_FAILED } from "./evidence.mjs";
import { ROUTE_HOOK } from "./route-module-loader.mjs";
import { POLICIES, createReactRenderer, runInRealReact, runInShim } from "./route-react-runtime.mjs";
import {
  DIRECT_DIFFICULTY_START_GAME,
  createReactShim,
  loadRouteRuntime,
  pathBetween,
  playToEnd,
  sameCell,
  walkTo,
  walkableNeighbours,
} from "./route-runtime-harness.mjs";

const SELF = fileURLToPath(import.meta.url);
/** ROUTE-C4: the last revision whose hook held its state in independent useState cells. */
const SETTER_TREE = "74ff2dc3a0a926fe3b40b325771bd423a348e041";

// =================================================================================================
// synthetic components — each takes the React it runs on (`R`), so the same code runs on both
// =================================================================================================

/**
 * A case: `useBody(R, probe)` is the component's body (it returns what a step and `observe` read), `observe(value, probe)` is
 * what a commit records, `steps` are inputs — each a function of the last committed value. `probe` is a per-run
 * object the case may count into (initialiser calls, reducer calls).
 */
const CASES = [
  {
    name: "INITIALISER_ONCE_AS_INIT_OF_INITIAL_ARG",
    useBody: (R, probe) => {
      const [state, dispatch] = R.useReducer(
        (s, a) => s + a,
        5,
        (arg) => {
          probe.inits.push(arg);
          return arg * 2;
        },
      );
      return { state, dispatch };
    },
    observe: (v, probe) => ({ state: v.state, inits: [...probe.inits] }),
    steps: [(v) => v.dispatch(1), (v) => (v.dispatch(2), v.dispatch(3))],
  },
  {
    name: "NO_INITIALISER_INITIAL_ARG_IS_THE_STATE",
    useBody: (R, probe) => {
      probe.initial ??= { n: 0 };
      const [state, dispatch] = R.useReducer((s, a) => ({ n: s.n + a }), probe.initial);
      return { state, dispatch };
    },
    observe: (v, probe) => ({ n: v.state.n, isTheInitialObject: v.state === probe.initial }),
    steps: [(v) => v.dispatch(4)],
  },
  {
    name: "DISPATCH_IDENTITY_STABLE_AND_STALE_CLOSURE_WORKS",
    useBody: (R, probe) => {
      const [state, dispatch] = R.useReducer((s, a) => s + a, 0);
      probe.first ??= dispatch;
      return { state, dispatch };
    },
    observe: (v, probe) => ({ state: v.state, sameDispatch: v.dispatch === probe.first }),
    steps: [(v) => v.dispatch(1), (v) => v.dispatch(1), (_v, probe) => probe.first(100)],
  },
  {
    name: "ONE_HANDLER_IS_ONE_RENDER_FOLDED_IN_ORDER",
    useBody: (R, probe) => {
      const [state, dispatch] = R.useReducer((s, a) => {
        probe.reduced.push(a);
        return [...s, a];
      }, []);
      return { state, dispatch };
    },
    observe: (v) => ({ state: v.state }),
    steps: [(v) => (v.dispatch("a"), v.dispatch("b"), v.dispatch("c")), (v) => v.dispatch("d")],
  },
  {
    name: "REDUCER_OF_THE_RENDER_DRAINS_THE_QUEUE",
    useBody: (R) => {
      const [k, setK] = R.useState(1);
      // A reducer that closes over render state: React runs the queued action with the reducer the NEXT render
      // passes (k already 10), not the one that existed when it was dispatched (k 1).
      const [state, dispatch] = R.useReducer((s, a) => s + a * k, 0);
      return { k, state, setK, dispatch };
    },
    observe: (v) => ({ k: v.k, state: v.state }),
    steps: [(v) => (v.dispatch(1), v.setK(10)), (v) => v.dispatch(1)],
  },
  {
    name: "FUNCTIONAL_SETSTATE_INTERLEAVED_WITH_DISPATCH",
    useBody: (R) => {
      const [log, dispatch] = R.useReducer((s, a) => [...s, a], []);
      const [n, setN] = R.useState(1);
      return { log, n, dispatch, setN };
    },
    observe: (v) => ({ log: v.log, n: v.n }),
    steps: [
      (v) => (v.dispatch("a"), v.setN((x) => x + 1), v.dispatch("b"), v.setN((x) => x * 10), v.dispatch("c")),
      (v) => (v.setN(7), v.setN((x) => x + 1), v.dispatch("d")),
    ],
  },
  {
    name: "NOTHING_SCHEDULED_NOTHING_RENDERED",
    useBody: (R) => {
      const [state, dispatch] = R.useReducer((s, a) => s + a, 0);
      return { state, dispatch };
    },
    observe: (v) => ({ state: v.state }),
    steps: [() => {}, (v) => v.dispatch(1), () => {}],
  },
  {
    name: "MIXED_HOOK_CELLS_KEEP_THEIR_ORDER",
    useBody: (R) => {
      const [a, setA] = R.useState("a0");
      const [x, dispatchX] = R.useReducer((s, v) => `${s}|${v}`, "x0");
      const ref = R.useRef({ n: 0 });
      const memo = R.useMemo(() => `${a}+${x}`, [a, x]);
      const cb = R.useCallback(() => a, [a]);
      const [y, dispatchY] = R.useReducer((s, v) => s + v, 0, (n) => n + 100);
      return { a, x, y, memo, cbA: cb(), ref, setA, dispatchX, dispatchY };
    },
    observe: (v) => ({ a: v.a, x: v.x, y: v.y, memo: v.memo, cbA: v.cbA, ref: v.ref.current.n }),
    steps: [(v) => (v.dispatchY(1), v.setA("a1")), (v) => (v.dispatchX("p"), v.dispatchY(5), (v.ref.current.n += 1)), (v) => v.dispatchX("q")],
  },
  {
    // React can skip committing when a reducer hands back the very same state object; the shim always renders a
    // dispatch. Reported, not required equal: C5's reducer never returns its input (route-state-reducer-tests R2).
    name: "SAME_STATE_OBJECT_RETURNED",
    informational: true,
    useBody: (R) => {
      const [state, dispatch] = R.useReducer((s, a) => (a === "same" ? s : { n: s.n + 1 }), { n: 0 });
      return { state, dispatch };
    },
    observe: (v) => ({ n: v.state.n }),
    steps: [(v) => v.dispatch("same"), (v) => v.dispatch("more")],
  },
];

/** One case through the shim: the harness's own `act` loop (render, again while dirty), committing what was scheduled. */
function runCaseInShim(testCase) {
  const react = createReactShim();
  const store = react.createStore();
  const probe = { inits: [], reduced: [] };
  const commits = [];
  let value = null;
  // Named as a component, because that is what the harness renders it as.
  const ShimProbe = () => testCase.useBody(react.shim, probe);
  const render = () => {
    const scheduled = store.dirty;
    react.beginRender(store);
    try {
      value = ShimProbe();
    } finally {
      react.endRender();
    }
    return scheduled;
  };
  render();
  commits.push(testCase.observe(value, probe));
  const perStep = [];
  for (const step of testCase.steps) {
    const before = commits.length;
    step(value, probe);
    let guard = 0;
    do {
      if (render()) commits.push(testCase.observe(value, probe));
    } while (store.dirty && (guard += 1) < 8);
    perStep.push(commits.length - before);
  }
  return { commits, perStep, reduced: probe.reduced };
}

/** Every case through the real React, in this worker. */
async function runCasesInReact({ regime }) {
  const react = await createReactRenderer({ strict: false, regime });
  const out = [];
  for (const testCase of CASES) {
    const probe = { inits: [], reduced: [] };
    const start = react.commits.length;
    const CaseProbe = () => testCase.useBody(react.React, probe);
    await react.render(CaseProbe, (value) => testCase.observe(value, probe));
    const perStep = [];
    for (const step of testCase.steps) {
      const before = react.commits.length;
      await react.perform(() => step(react.committed(), probe), "click");
      perStep.push(react.commits.length - before);
    }
    out.push({ commits: react.commits.slice(start), perStep, reduced: probe.reduced });
    await react.unmount();
  }
  return out;
}

if (!isMainThread && workerData?.harnessCases) {
  runCasesInReact(workerData).then(
    (result) => parentPort.postMessage({ result }),
    (error) => parentPort.postMessage({ error: String(error?.stack ?? error) }),
  );
} else if (isMainThread) {
  await main();
}

function casesInReact({ nodeEnv, regime }) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(SELF, { workerData: { harnessCases: true, regime }, env: { ...process.env, NODE_ENV: nodeEnv } });
    worker.once("message", (message) => {
      worker.terminate();
      if (message.error) reject(new Error(message.error));
      else resolve(message.result);
    });
    worker.once("error", reject);
  });
}

// =================================================================================================

async function main() {
  const tests = [];
  const record = (id, kind, name, pass, detail = {}) => {
    tests.push({ id, kind, name, pass });
    console.log(`${pass ? "PASS" : "FAIL"}  ${id} [${kind}] — ${name}`);
    for (const [k, v] of Object.entries(detail)) {
      const text = typeof v === "object" ? JSON.stringify(v) : String(v);
      console.log(`        ${k}: ${text.length > 700 ? `${text.slice(0, 697)}...` : text}`);
    }
  };
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  console.log("route runtime harness · the shim's useState/useReducer against react-dom\n");

  // [semantics] ----------------------------------------------------------------------------------
  const shim = CASES.map(runCaseInShim);
  const realms = {
    "production/default": await casesInReact({ nodeEnv: "production", regime: "default" }),
    "development/act": await casesInReact({ nodeEnv: "development", regime: "act" }),
    "development/discrete": await casesInReact({ nodeEnv: "development", regime: "discrete" }),
  };
  CASES.forEach((testCase, i) => {
    const verdicts = Object.fromEntries(Object.entries(realms).map(([realm, results]) => [realm, same(shim[i].commits, results[i].commits) && same(shim[i].perStep, results[i].perStep)]));
    const agree = Object.values(verdicts).every(Boolean);
    const id = `H${i + 1}`;
    if (testCase.informational) {
      record(id, "semantics", `${testCase.name} (informational)`, true, {
        shim: { commits: shim[i].commits, perStep: shim[i].perStep },
        react: { commits: realms["production/default"][i].commits, perStep: realms["production/default"][i].perStep },
        shimMatchesReact: agree,
      });
      return;
    }
    record(id, "semantics", testCase.name, agree, {
      commits: shim[i].commits,
      commitsPerInput: shim[i].perStep,
      ...(agree ? {} : { react: Object.fromEntries(Object.entries(realms).map(([realm, results]) => [realm, results[i]])) }),
      realms: verdicts,
    });
  });
  // The reducer is never called eagerly: a dispatch that is followed by no render has not run it yet.
  {
    const react = createReactShim();
    const store = react.createStore();
    const calls = [];
    let value;
    const ReducerProbe = () => react.shim.useReducer((s, a) => (calls.push(a), s + a), 0);
    const render = () => {
      react.beginRender(store);
      value = ReducerProbe();
      react.endRender();
    };
    render();
    value[1](1);
    value[1](2);
    const beforeRender = [...calls];
    render();
    record("H10", "semantics", "DISPATCH_QUEUES_REDUCER_RUNS_AT_RENDER", beforeRender.length === 0 && same(calls, [1, 2]) && value[0] === 3, {
      reducerCallsBeforeRender: beforeRender,
      reducerCallsAtRender: calls,
      state: value[0],
    });
  }

  // [hook] ---------------------------------------------------------------------------------------
  const scenarios = [
    { name: "r1-easy-win", seed: 8401, routeNumber: 1, steps: [["play", 160, { policy: "win" }], ["next", 9001], ["play", 30, { policy: "lose" }]] },
    { name: "r2-medium-pickaxe", seed: 8411, routeNumber: 2, changeDifficulty: "medium", steps: [["play", 160, { policy: "pickaxe-bump" }], ["restart"], ["play", 12, { policy: "bump" }]] },
    { name: "r3-hard-chest-wait", seed: 8421, routeNumber: 3, changeDifficulty: "hard", steps: [["play", 160, { policy: "chest-wait" }], ["changeDifficulty", "easy"]] },
    { name: "r1-hard-sc-hunter", seed: 8431, routeNumber: 1, changeDifficulty: "hard", steps: [["play", 160, { policy: "sc-hunter" }]] },
    { name: "r2-easy-traps", seed: 8441, routeNumber: 2, steps: [["play", 160, { policy: "traps" }], ["next", 9002], ["play", 30, { policy: "sc-sentinel" }]] },
    { name: "r3-medium-setup", seed: 8451, routeNumber: 3, initialDifficulty: "medium", autoStart: false, steps: [["move", { row: 0, col: 1 }], ["start"], ["play", 40, { policy: "sc-bait" }]] },
    // Every scripted Explorer once, across the three Routes and modes.
    ...POLICIES.map((policy, i) => ({
      name: `policy-${policy}`,
      seed: 8500 + i,
      routeNumber: 1 + (i % 3),
      changeDifficulty: ["medium", "hard", undefined][Math.floor(i / 3) % 3],
      steps: [["play", 160, { policy }]],
    })),
  ];
  // Body calls and keyboard listeners are the two things the shim cannot show (it runs no effects, and renders even
  // when nothing was scheduled); everything else is compared.
  const omit = (object, keys) => Object.fromEntries(Object.entries(object).filter(([key]) => !keys.includes(key)));
  const strip = (results) =>
    results.map((r) => ({ ...omit(r, ["bodies", "keyListenersAfterUnmount"]), steps: r.steps.map((step) => omit(step, ["bodies", "keyListeners"])) }));
  for (const [id, tree, label] of [["H11", null, "WORKING_TREE_USEREDUCER"], ["H12", SETTER_TREE, "74FF2DC_USESTATE_CELLS"]]) {
    const viaShim = await runInShim({ rev: tree, scenarios });
    const viaProd = await runInRealReact({ rev: tree, nodeEnv: "production", strict: false, regime: "default", scenarios });
    const viaDev = await runInRealReact({ rev: tree, nodeEnv: "development", strict: false, regime: "act", scenarios });
    const prodSame = same(strip(viaShim), strip(viaProd.results));
    const devSame = same(strip(viaShim), strip(viaDev.results));
    const firstDiff = (a, b) => {
      for (const [i, r] of a.entries()) {
        const k = r.commits.findIndex((c, n) => !same(c, b[i].commits[n]));
        const s = r.steps.findIndex((step, n) => !same(step, b[i].steps[n]));
        if (k >= 0 || s >= 0 || !same(r, b[i])) return { scenario: r.scenario, commit: k, step: s };
      }
      return null;
    };
    const commits = viaShim.reduce((sum, r) => sum + r.commits.length, 0);
    const steps = viaShim.reduce((sum, r) => sum + r.steps.length, 0);
    const zero = viaShim.flatMap((r) => r.steps.filter((s) => s.commits === 0).map((s) => `${r.scenario}:${s.label}`));
    record(id, "hook", `SHIM_EQUALS_REACT_ON_THE_REAL_HOOK_${label}`, prodSame && devSame && viaProd.consoleErrors.length === 0 && viaDev.consoleErrors.length === 0 && commits > 300, {
      tree: tree ? tree.slice(0, 7) : "working tree",
      scenarios: scenarios.length,
      inputs: steps,
      commitsCompared: commits,
      inputsThatCommitNothing: zero,
      completions: viaShim.reduce((sum, r) => sum + r.completions.length, 0),
      reactVersion: viaProd.reactVersion,
      productionDefault: prodSame || firstDiff(strip(viaShim), strip(viaProd.results)),
      developmentAct: devSame || firstDiff(strip(viaShim), strip(viaDev.results)),
      consoleErrors: [...viaProd.consoleErrors, ...viaDev.consoleErrors].slice(0, 3),
    });
  }

  // [harness] ------------------------------------------------------------------------------------
  // H13 — directDifficulty: the edit lands in either engine (setter up to C4, reducer from C5) and the Route it starts
  // is the same Route, render for render: same board, same pieces, status "playing", the setup message kept.
  {
    const observe = (g) => ({ status: g.status, message: g.message, turns: g.turns, player: g.player, guardian: g.guardian, sentinel: g.sentinel, map: [...g.mazeMap.walls].length, exit: g.mazeMap.exitPosition, lights: [...g.collectedSet], traps: [...g.triggeredTrapSet] });
    const play = (rev) => {
      const runtime = loadRouteRuntime({ directDifficulty: true, rev });
      const text = runtime.LAB.graph.compiledSource(ROUTE_HOOK);
      const out = [];
      for (const [i, difficulty] of ["easy", "medium", "hard"].entries()) {
        for (const routeNumber of [1, 2, 3]) {
          const log = [];
          const run = runtime.mount({ seed: 7100 + i * 10 + routeNumber, difficulty, routeNumber, onRender: (g) => log.push(observe(g)) });
          playToEnd(run, i === 1 ? "lose" : "win", 60);
          out.push({ difficulty, routeNumber, log, completions: run.completions.length });
        }
      }
      return { out, text };
    };
    const now = play(null);
    const base = play(SETTER_TREE);
    const landed = { reducer: now.text.includes(DIRECT_DIFFICULTY_START_GAME.reducer), setter: base.text.includes(DIRECT_DIFFICULTY_START_GAME.setter) };
    const started = now.out.every((r) => r.log[1]?.status === "playing" && r.log[1]?.message === "Escolha a dificuldade e inicie." && r.log[1]?.turns === 0);
    record("H13", "harness", "DIRECT_DIFFICULTY_EDIT_IN_BOTH_ENGINES", landed.reducer && landed.setter && same(now.out, base.out) && started, {
      landed,
      routes: now.out.length,
      rendersCompared: now.out.reduce((sum, r) => sum + r.log.length, 0),
      startsPlayingOnTheSameBoard: started,
      sameAsSetterEngine: same(now.out, base.out),
    });
  }

  // H14 — `onRender` sees every render in order (mount = 0), with `scheduled` false only when nothing was pending;
  // `renders` counts them; a move with nothing to do (setup screen) renders without scheduling.
  {
    const runtime = loadRouteRuntime();
    const seen = [];
    const run = runtime.mount({ seed: 4242, autoStart: false, onRender: (_g, index, { scheduled }) => seen.push([index, scheduled]) });
    run.move({ row: 0, col: 1 });
    run.act((g) => g.startGame());
    run.move({ row: 0, col: -1 });
    const ok = same(seen.map(([i]) => i), [0, 1, 2, 3]) && same(seen.map(([, s]) => s), [false, false, true, true]) && run.renders === 4;
    record("H14", "harness", "ON_RENDER_SEES_EVERY_RENDER_WITH_SCHEDULED", ok, { renders: seen });
  }

  // H15 — the surface the validators use is still there, and still works on the reducer engine.
  {
    const runtime = loadRouteRuntime();
    const run = runtime.mount({ seed: 5150 });
    const helpers = { pathBetween, walkableNeighbours, walkTo, playToEnd, sameCell };
    const methods = ["act", "move", "stepTo", "choose", "break", "restart", "changeDifficulty", "nextSession"];
    const missing = [...methods.filter((m) => typeof run[m] !== "function"), ...Object.entries(helpers).filter(([, fn]) => typeof fn !== "function").map(([n]) => n)];
    const end = playToEnd(run, "win");
    const next = run.completions.at(-1)?.continuation ? run.nextSession() : null;
    record("H15", "harness", "HARNESS_SURFACE_UNCHANGED", missing.length === 0 && ["won", "lost"].includes(end) && (next === null || next.state.routeNumber === 2), {
      missing,
      end,
      nextRoute: next?.state.routeNumber ?? null,
      api: Object.keys(runtime).sort(),
    });
  }

  const failing = tests.filter((t) => !t.pass).map((t) => t.id);
  console.log(`\n${tests.length - failing.length}/${tests.length} passed · failing: ${failing.join(", ") || "none"}`);
  process.exitCode = failing.length ? EXIT_VALIDATION_FAILED : EXIT_OK;
}
