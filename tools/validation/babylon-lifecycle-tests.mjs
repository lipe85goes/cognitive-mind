/**
 * ROTA-BABYLON-LIFECYCLE-07 — lifecycle contract for the Route Babylon scene.
 *
 * Drives the REAL controller through the six lifecycle scenarios the mission
 * names, with a strict Babylon double that records any action taken on a scene
 * or engine whose ownership has already ended.
 *
 * Usage: node tools/validation/babylon-lifecycle-tests.mjs [--check|--update]
 */
import {
  loadSceneModule,
  createBabylonDouble,
  createCanvasDouble,
  createStateDouble,
} from "./babylon-lifecycle-harness.mjs";
import { openEvidence } from "./evidence.mjs";

const EVIDENCE = openEvidence("docs/archive/route-babylon-lifecycle-07-async-dispose");

const sceneModule = loadSceneModule();

const tests = [];
const record = (id, name, pass, detail) => {
  tests.push({ id, name, pass, ...detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${name}`);
  for (const [k, v] of Object.entries(detail)) {
    console.log(`        ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  }
};

/** Let queued microtasks run, the way an await would between frames. */
const flush = async (rounds = 6) => {
  for (let i = 0; i < rounds; i += 1) await Promise.resolve();
};

const unhandled = [];
process.on("unhandledRejection", (reason) => {
  unhandled.push(String(reason));
});

/**
 * One controller under a fresh double. `ready` is attached immediately, exactly
 * as `RouteBabylonBoard` does, so a rejection is never unhandled.
 */
function mountController(stateOverrides) {
  const babylon = createBabylonDouble();
  const canvas = createCanvasDouble();
  const controller = sceneModule.createRouteBabylonController(
    babylon.B,
    canvas,
    createStateDouble(stateOverrides),
    { onMove: () => {} },
  );
  const readyOutcome = { state: "pending", error: null };
  controller.ready.then(
    () => {
      readyOutcome.state = "resolved";
    },
    (error) => {
      readyOutcome.state = "rejected";
      readyOutcome.error = String(error?.message ?? error);
    },
  );
  return { babylon, canvas, controller, readyOutcome };
}

// ===========================================================================
// A — dispose while assets are still pending
// ===========================================================================
{
  const run = mountController();
  await flush();
  const importsInFlight = run.babylon.pendingImports.filter((i) => !i.settled).length;

  run.controller.dispose();
  const afterDispose = run.babylon.violations.length;

  // The imports land AFTER ownership ended. This is the moment under test.
  run.babylon.resolveAllImports();
  await flush(12);

  record(
    "A",
    "DISPOSE_DURING_PENDING_LOAD",
    run.babylon.violations.length === 0 && unhandled.length === 0,
    {
      importsInFlightAtDispose: importsInFlight,
      violationsAtDispose: afterDispose,
      violationsAfterLateCompletion: run.babylon.violations.length,
      offendingActions: run.babylon.violations.map((v) => v.action).slice(0, 12),
      readyOutcome: run.readyOutcome.state,
      unhandledRejections: unhandled.length,
      scenesDisposed: run.babylon.counters.scenesDisposed,
      enginesDisposed: run.babylon.counters.enginesDisposed,
      renderLoopsStopped: run.babylon.counters.renderLoopsStopped,
    },
  );
}

// ===========================================================================
// B — a stale completion must not touch a NEW controller
// ===========================================================================
{
  const first = mountController();
  await flush();
  first.controller.dispose();

  // The retry mounts a second controller while the first one's imports are
  // still in flight — the retry/remount race.
  const second = mountController();
  await flush();

  const secondViolationsBefore = second.babylon.violations.length;
  first.babylon.resolveAllImports();
  await flush(12);

  second.babylon.resolveAllImports();
  await flush(12);
  second.babylon.tick(); // the new controller's ready frame
  await flush(12);

  record(
    "B",
    "RETRY_DURING_PENDING_STALE_IGNORED",
    first.babylon.violations.length === 0 &&
      second.babylon.violations.length === secondViolationsBefore &&
      second.readyOutcome.state === "resolved" &&
      unhandled.length === 0,
    {
      staleControllerViolations: first.babylon.violations.length,
      staleOffendingActions: first.babylon.violations.map((v) => v.action).slice(0, 12),
      newControllerViolations: second.babylon.violations.length,
      newControllerReady: second.readyOutcome.state,
      newControllerScenesDisposed: second.babylon.counters.scenesDisposed,
      unhandledRejections: unhandled.length,
      note:
        "the two controllers own separate scenes; a stale completion must not reach either one",
    },
  );
  second.controller.dispose();
}

// ===========================================================================
// C — dispose while pending, then never render again (navigate away)
// ===========================================================================
{
  const run = mountController();
  await flush();
  run.controller.dispose();
  // Navigation: nothing ticks after this point.
  run.babylon.resolveAllImports();
  await flush(12);

  record(
    "C",
    "NAVIGATE_AWAY_DURING_PENDING",
    run.babylon.violations.length === 0 &&
      run.canvas.liveListenerCount() === 0 &&
      unhandled.length === 0,
    {
      violations: run.babylon.violations.map((v) => v.action).slice(0, 12),
      canvasListenersLeft: run.canvas.liveListenerCount(),
      readyOutcome: run.readyOutcome.state,
      readySettled: run.readyOutcome.state !== "pending",
      unhandledRejections: unhandled.length,
      note:
        "a ready promise that never settles is a dangling continuation, so it is measured here too",
    },
  );
}

// ===========================================================================
// D — the normal path: ready, then dispose
// ===========================================================================
{
  const run = mountController();
  await flush();
  run.babylon.resolveAllImports();
  await flush(12);
  run.babylon.tick(); // the ready frame
  await flush(12);

  const readyBeforeDispose = run.readyOutcome.state;
  const framesBefore = run.babylon.counters.framesRendered;
  run.controller.dispose();
  run.babylon.tick(); // must be a no-op: the loop is stopped

  record(
    "D",
    "READY_THEN_DISPOSE",
    readyBeforeDispose === "resolved" &&
      run.babylon.violations.length === 0 &&
      run.babylon.counters.framesRendered === framesBefore &&
      run.canvas.liveListenerCount() === 0,
    {
      readyOutcome: readyBeforeDispose,
      framesRenderedBeforeDispose: framesBefore,
      framesRenderedAfterDispose:
        run.babylon.counters.framesRendered - framesBefore,
      violations: run.babylon.violations.map((v) => v.action),
      canvasListenersLeft: run.canvas.liveListenerCount(),
      glowLayersCreated: run.babylon.counters.glowLayersCreated,
      glowLayersDisposed: run.babylon.counters.glowLayersDisposed,
    },
  );
}

// ===========================================================================
// E — asset failure must still produce a usable procedural fallback
// ===========================================================================
{
  const alive = mountController();
  await flush();
  alive.babylon.rejectAllImports(new Error("simulated GLB 404"));
  await flush(12);
  alive.babylon.tick();
  await flush(12);
  const aliveReady = alive.readyOutcome.state;
  alive.controller.dispose();

  // And the same failure AFTER dispose must change nothing.
  const dead = mountController();
  await flush();
  dead.controller.dispose();
  dead.babylon.rejectAllImports(new Error("simulated GLB 404 after dispose"));
  await flush(12);

  record(
    "E",
    "ASSET_FAILURE_CONTRACT",
    aliveReady === "resolved" &&
      alive.babylon.violations.length === 0 &&
      dead.babylon.violations.length === 0 &&
      unhandled.length === 0,
    {
      liveControllerReadyAfterFailure: aliveReady,
      liveControllerViolations: alive.babylon.violations.map((v) => v.action),
      disposedControllerViolations: dead.babylon.violations.map((v) => v.action),
      unhandledRejections: unhandled.length,
      note:
        "a failed asset on a LIVE controller must still reveal the procedural fallback; on a disposed one it must do nothing at all",
    },
  );
}

// ===========================================================================
// F — rapid mount/unmount cycles, and a Strict-Mode-shaped double mount
// ===========================================================================
{
  const cycles = 30;
  let totalViolations = 0;
  const offending = new Set();
  let leakedListeners = 0;
  let scenes = 0;
  let engines = 0;
  let scenesDisposed = 0;
  let enginesDisposed = 0;
  let loopsStarted = 0;
  let loopsStopped = 0;

  for (let i = 0; i < cycles; i += 1) {
    const run = mountController();
    // Vary how far the mount gets before being torn down.
    if (i % 3 === 1) await flush(2);
    if (i % 3 === 2) {
      await flush();
      run.babylon.resolveAllImports();
      await flush(8);
      run.babylon.tick();
      await flush(4);
    }
    run.controller.dispose();
    run.babylon.resolveAllImports();
    run.babylon.tick();
    await flush(8);

    totalViolations += run.babylon.violations.length;
    run.babylon.violations.forEach((v) => offending.add(v.action));
    leakedListeners += run.canvas.liveListenerCount();
    scenes += run.babylon.counters.scenesCreated;
    engines += run.babylon.counters.enginesCreated;
    scenesDisposed += run.babylon.counters.scenesDisposed;
    enginesDisposed += run.babylon.counters.enginesDisposed;
    loopsStarted += run.babylon.counters.renderLoopsStarted;
    loopsStopped += run.babylon.counters.renderLoopsStopped;
  }

  record(
    "F",
    "RAPID_CYCLES_AND_DOUBLE_MOUNT",
    totalViolations === 0 &&
      leakedListeners === 0 &&
      scenes === scenesDisposed &&
      engines === enginesDisposed &&
      loopsStarted <= loopsStopped &&
      unhandled.length === 0,
    {
      cycles,
      totalViolations,
      offendingActions: [...offending].slice(0, 12),
      leakedCanvasListeners: leakedListeners,
      scenesCreated: scenes,
      scenesDisposed,
      enginesCreated: engines,
      enginesDisposed,
      renderLoopsStarted: loopsStarted,
      renderLoopsStopped: loopsStopped,
      unhandledRejections: unhandled.length,
    },
  );
}

// ===========================================================================
// G — three lights, unchanged, and no second render loop
// ===========================================================================
{
  const run = mountController();
  await flush();
  run.babylon.resolveAllImports();
  await flush(12);
  run.babylon.tick();
  await flush(8);
  const lights = run.babylon.counters.lightsCreated;
  const loops = run.babylon.counters.renderLoopsStarted;
  run.controller.dispose();

  record("G", "SCENE_SHAPE_UNCHANGED", lights === 3 && loops === 1, {
    lightsCreated: lights,
    renderLoopsStarted: loops,
    note: "the lifecycle work must not add a light or a second render loop",
  });
}

// ===========================================================================
// H — dispose in the window BETWEEN assets landing and the ready frame
// ===========================================================================
{
  /**
   * The narrowest window, and the one the other scenarios miss. Assets have
   * landed, so the outer `disposed` guard already passed and the chain is now
   * waiting on `scene.onAfterRenderObservable.addOnce` for its first complete
   * frame. Real Babylon CLEARS observables on dispose without firing them, so
   * anything waiting on that frame is waiting on an event that will never come.
   */
  const run = mountController();
  await flush();
  run.babylon.resolveAllImports();
  await flush(12); // the chain now holds an addOnce observer, no frame yet
  const readyBeforeDispose = run.readyOutcome.state;

  run.controller.dispose(); // the frame never arrives
  await flush(20);

  record(
    "H",
    "DISPOSE_BEFORE_READY_FRAME",
    run.readyOutcome.state !== "pending" && run.babylon.violations.length === 0,
    {
      readyBeforeDispose,
      readyAfterDispose: run.readyOutcome.state,
      readySettled: run.readyOutcome.state !== "pending",
      readyError: run.readyOutcome.error,
      violations: run.babylon.violations.map((v) => v.action),
      whyItMatters:
        "an unsettled ready leaves `await controller.ready` suspended forever, holding the canvas, controller and board state alive with it",
    },
  );
}

// ===========================================================================
// I — a stale reference must not be able to drive a disposed controller
// ===========================================================================
{
  /**
   * `updateBoard`, `resize` and `resetView` are reachable from whoever holds
   * the controller. The React owner nulls its ref on cleanup, but that puts
   * ownership enforcement in the CONSUMER. This measures the controller's own
   * behaviour when something calls it after dispose.
   */
  const run = mountController();
  await flush();
  run.babylon.resolveAllImports();
  await flush(12);
  run.babylon.tick();
  await flush(8);

  run.controller.dispose();
  const violationsAtDispose = run.babylon.violations.length;

  const attempts = [];
  const attempt = (label, fn) => {
    const before = run.babylon.violations.length;
    let threw = null;
    try {
      fn();
    } catch (error) {
      threw = String(error?.message ?? error);
    }
    attempts.push({
      label,
      newViolations: run.babylon.violations.length - before,
      threw,
    });
  };

  attempt("updateBoard", () => run.controller.updateBoard(createStateDouble()));
  attempt("resize", () => run.controller.resize());
  attempt("resetView", () => run.controller.resetView());
  attempt("dispose twice", () => run.controller.dispose());

  record(
    "I",
    "STALE_REFERENCE_IS_INERT",
    attempts.every((a) => a.newViolations === 0 && a.threw === null),
    {
      violationsAtDispose,
      attempts,
      note:
        "the controller must defend its own ownership, not rely on the React owner nulling a ref",
    },
  );
}

await flush(20);

const allPass = tests.every((t) => t.pass) && unhandled.length === 0;
EVIDENCE.write("babylon-lifecycle.json", {
  mission: "ROTA-BABYLON-LIFECYCLE-07-ASYNC-DISPOSE",
  harness:
    "tools/validation/babylon-lifecycle-harness.mjs — strict Babylon double; any action on a scene/engine whose ownership ended is a violation",
  driver: "the real createRouteBabylonController, compiled from source",
  tests,
  unhandledRejections: unhandled,
  allPass,
});
console.log(
  `\nunhandled rejections: ${unhandled.length}${unhandled.length ? ` -> ${unhandled.slice(0, 3).join(" | ")}` : ""}`,
);
console.log(`${allPass ? "BABYLON_LIFECYCLE_OK" : "BABYLON_LIFECYCLE_FAILED"}`);
process.exitCode = EVIDENCE.finish({ ok: allPass });
