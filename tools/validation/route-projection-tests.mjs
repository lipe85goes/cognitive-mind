/**
 * ROTA-PROJECTED-CENTERS-01 — `data-cell-centers` must describe the camera the
 * board is drawn with NOW, not the one the previous frame was drawn with.
 *
 * The defect: `writeProjectedCellCenters()` projected through
 * `scene.getTransformMatrix()`, a cache the scene refreshes only inside
 * `scene.render()`. After `engine.resize()` + `fitCamera()` (or a gesture then
 * Centralizar) the published centres used the old view x projection and stayed
 * wrong until an unrelated `updateBoard` happened to rewrite them.
 *
 * Method — the REAL controller on the REAL Babylon, no browser:
 *  - `routeBabylonScene.ts` receives Babylon as a parameter, so it runs here on
 *    `@babylonjs/core` itself, with a `NullEngine` standing in for WebGL. Only
 *    three seams are replaced: the engine measures the canvas double instead of
 *    a DOM canvas, the render loop is driven by hand, and GLB imports fail so
 *    the procedural board is used (projection does not depend on the assets).
 *  - `Vector3.Project` is observed, not changed: each call's world point and
 *    the matrix it was given are recorded.
 *  - Truth is the matrix the NEXT frame actually renders with. After every
 *    action the test reads what the canvas published, renders one frame, and
 *    re-projects the recorded world points through that frame's matrix. A
 *    published centre that differs is stale by definition.
 *  - Between the action and the reading there is never an `updateBoard`, a
 *    `resetView` or a frame unless the scenario says so: the centres have to be
 *    right on their own.
 *  - Counterfactual: the same scenarios run against the source with the fix
 *    removed must FAIL. A regression test that cannot see the regression is not
 *    one, so if the anchor is missing or the stale build passes, this fails.
 *
 * Read-only: writes nothing, takes no flags.
 *
 * Usage: node tools/validation/route-projection-tests.mjs
 * Exit:  0 every check passed; 1 a check failed.
 */
import * as BABYLON from "@babylonjs/core";
import {
  loadSceneModule,
  createCanvasDouble,
  createStateDouble,
} from "./babylon-lifecycle-harness.mjs";

/** The fix, as it appears in the source. The counterfactual removes it. */
const FIX_ANCHOR = "scene.updateTransformMatrix(true);";
/** Anything further than this from the rendered projection is stale. */
const TOLERANCE_PX = 1e-6;

// The NullEngine banner on every mount is noise here; errors still print.
BABYLON.Logger.LogLevels = BABYLON.Logger.ErrorLogLevel;

const flush = async (rounds = 12) => {
  for (let i = 0; i < rounds; i += 1) await Promise.resolve();
};

/** Real Babylon, with the engine, render loop and loader seams replaced. */
function createRealBabylon() {
  const handles = { engine: null, scene: null, projections: [] };
  const imports = [];

  class TestEngine extends BABYLON.NullEngine {
    constructor(canvas) {
      super({
        renderWidth: canvas.clientWidth,
        renderHeight: canvas.clientHeight,
        textureSize: 256,
        deterministicLockstep: false,
        lockstepMaxSteps: 1,
      });
      this.__canvas = canvas;
      this.__loop = null;
      handles.engine = this;
    }
    /**
     * What `Engine.resize()` does with a DOM canvas at hardware scaling 1: take
     * the CSS size as the render size, invalidate the cameras' render id and
     * notify. A NullEngine has no canvas to measure, so it reads the double.
     */
    resize() {
      const width = this.__canvas.clientWidth | 0;
      const height = this.__canvas.clientHeight | 0;
      if (width === this._options.renderWidth && height === this._options.renderHeight) return;
      this._options.renderWidth = width;
      this._options.renderHeight = height;
      for (const scene of this.scenes) {
        for (const camera of scene.cameras) camera._currentRenderId = 0;
      }
      this.onResizeObservable.notifyObservers(this);
    }
    runRenderLoop(fn) {
      this.__loop = fn;
    }
    stopRenderLoop() {
      this.__loop = null;
    }
  }

  class TestScene extends BABYLON.Scene {
    constructor(...args) {
      super(...args);
      handles.scene = this;
    }
  }

  class ObservedVector3 extends BABYLON.Vector3 {
    static Project(vector, world, transform, viewport) {
      handles.projections.push({
        point: new BABYLON.Vector3(vector.x, vector.y, vector.z),
        matrix: transform.asArray().slice(),
      });
      return super.Project(vector, world, transform, viewport);
    }
  }

  const B = {
    ...BABYLON,
    Engine: TestEngine,
    Scene: TestScene,
    Vector3: ObservedVector3,
    SceneLoader: {
      ImportMeshAsync(_a, _b, path) {
        return new Promise((_resolve, reject) => {
          imports.push(() => reject(new Error(`no GLB in node: ${path}`)));
        });
      },
    },
  };
  return {
    B,
    handles,
    settleImports() {
      imports.splice(0).forEach((fail) => fail());
    },
  };
}

function mount(sceneModule, width = 1280, height = 720) {
  const runtime = createRealBabylon();
  const canvas = createCanvasDouble();
  canvas.clientWidth = width;
  canvas.clientHeight = height;
  canvas.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    width: canvas.clientWidth,
    height: canvas.clientHeight,
  });
  const moves = [];
  const state = createStateDouble();
  const controller = sceneModule.createRouteBabylonController(
    runtime.B,
    canvas,
    state,
    { onMove: (delta) => moves.push(delta) },
  );
  const ready = { state: "pending" };
  controller.ready.then(
    () => {
      ready.state = "resolved";
    },
    (error) => {
      ready.state = `rejected: ${error?.message ?? error}`;
    },
  );

  let updateBoardCalls = 0;
  return {
    runtime,
    canvas,
    controller,
    state,
    moves,
    ready,
    get updateBoardCalls() {
      return updateBoardCalls;
    },
    updateBoard(next) {
      updateBoardCalls += 1;
      controller.updateBoard(next);
    },
    setSize(w, h) {
      canvas.clientWidth = w;
      canvas.clientHeight = h;
    },
    frame() {
      runtime.handles.engine.__loop?.();
    },
    /** Fire the controller's own canvas listeners, as the browser would. */
    fire(type, event) {
      canvas.__listeners.get(type)?.forEach((fn) => fn(event));
    },
  };
}

/**
 * Compare what the canvas published with the projection through the matrix
 * the next frame renders with. Renders exactly one frame.
 */
function measure(run) {
  const { handles } = run.runtime;
  const published = JSON.parse(run.canvas.dataset.cellCenters || "{}");
  const keys = Object.keys(published);
  // The last full batch of projections is the one behind the published data.
  const batch = handles.projections.slice(-keys.length);
  const usedMatrix = batch[0]?.matrix ?? null;

  run.frame();

  const { engine, scene } = handles;
  const rendered = scene.getTransformMatrix();
  const viewport = scene.activeCamera.viewport.toGlobal(
    engine.getRenderWidth(),
    engine.getRenderHeight(),
  );
  const sx = run.canvas.clientWidth / engine.getRenderWidth();
  const sy = run.canvas.clientHeight / engine.getRenderHeight();

  let maxErrorPx = 0;
  let worstCell = null;
  keys.forEach((key, index) => {
    const truth = BABYLON.Vector3.Project(
      batch[index].point,
      BABYLON.Matrix.Identity(),
      rendered,
      viewport,
    );
    const p = published[key];
    const d =
      p && Number.isFinite(p.x) && Number.isFinite(p.y)
        ? Math.hypot(p.x - truth.x * sx, p.y - truth.y * sy)
        : Infinity;
    if (d > maxErrorPx) {
      maxErrorPx = d;
      worstCell = key;
    }
  });
  const renderedArray = rendered.asArray();
  const matrixMatchesFrame =
    usedMatrix !== null && usedMatrix.every((v, i) => v === renderedArray[i]);
  return {
    cells: keys.length,
    maxErrorPx: Number.isFinite(maxErrorPx) ? +maxErrorPx.toFixed(6) : "non-finite",
    worstCell,
    matrixMatchesFrame,
    fresh: keys.length === 81 && maxErrorPx <= TOLERANCE_PX && matrixMatchesFrame,
  };
}

/** Every scenario, run against one build of the scene module. */
async function runScenarios(sceneModule) {
  const results = [];
  const note = (id, name, measured, extra = {}) => {
    results.push({ id, name, ...measured, ...extra });
  };

  // A — mount: the first publication happens before any frame has rendered.
  {
    const run = mount(sceneModule);
    note("A", "MOUNT_BEFORE_FIRST_FRAME", measure(run), { updateBoardCalls: run.updateBoardCalls });
    run.controller.dispose();
  }

  // B1 — the canvas changes size while the GLBs are still loading; when they
  // settle, the readiness path re-fits and publishes before its ready frame.
  {
    const run = mount(sceneModule);
    run.frame();
    run.frame();
    run.setSize(1024, 640);
    run.runtime.settleImports();
    await flush();
    const measured = measure(run); // this frame is also the ready frame
    await flush();
    note("B1", "ENTRY_READY_AFTER_RESIZE", measured, {
      updateBoardCalls: run.updateBoardCalls,
      ready: run.ready.state,
    });
    run.controller.dispose();
  }

  // B2 — "Iniciar rota" right after a resize, inside one frame: the resize
  // observer publishes, then the status change goes through updateBoard.
  {
    const run = mount(sceneModule);
    run.runtime.settleImports();
    await flush();
    run.frame();
    run.setSize(1180, 680);
    run.controller.resize();
    run.updateBoard({ ...run.state, status: "playing" });
    note("B2", "START_ROUTE_AFTER_RESIZE", measure(run), { updateBoardCalls: run.updateBoardCalls });
    run.controller.dispose();
  }

  // C — a layout change with no window resize (Detalhes opening and closing,
  // the objective line growing after a blocked step): only the observer fires.
  {
    const run = mount(sceneModule);
    run.runtime.settleImports();
    await flush();
    run.frame();
    run.frame();
    const calls = run.updateBoardCalls;
    run.setSize(1280, 560);
    run.controller.resize();
    const open = measure(run);
    run.frame();
    run.setSize(1280, 720);
    run.controller.resize();
    const close = measure(run);
    note("C1", "LAYOUT_RESIZE_DETAILS_OPEN", open, { updateBoardCalls: run.updateBoardCalls - calls });
    note("C2", "LAYOUT_RESIZE_DETAILS_CLOSE", close, { updateBoardCalls: run.updateBoardCalls - calls });

    // A blocked step changes nothing on the board: it must neither need nor
    // trigger a rewrite, and what is published must still be current.
    run.frame();
    const before = run.canvas.dataset.cellCenters;
    note("C3", "BLOCKED_MOVE_KEEPS_CENTRES_CURRENT", measure(run), {
      updateBoardCalls: run.updateBoardCalls - calls,
      rewritten: run.canvas.dataset.cellCenters !== before,
    });
    run.controller.dispose();
  }

  // D — wheel zoom, frames render the zoomed camera, then Centralizar.
  {
    const run = mount(sceneModule);
    run.runtime.settleImports();
    await flush();
    run.frame();
    for (let i = 0; i < 3; i += 1) {
      run.fire("wheel", { deltaY: 120, preventDefault() {} });
    }
    run.frame();
    run.frame();
    run.controller.resetView();
    note("D1", "RESET_VIEW_AFTER_ZOOM", measure(run), { updateBoardCalls: run.updateBoardCalls });

    // Two-finger orbit, rendered, then Centralizar.
    run.fire("pointerdown", { pointerId: 1, clientX: 500, clientY: 360 });
    run.fire("pointerdown", { pointerId: 2, clientX: 700, clientY: 360 });
    run.fire("pointermove", { pointerId: 2, clientX: 640, clientY: 330 });
    run.fire("pointerup", { pointerId: 2, clientX: 640, clientY: 330 });
    run.fire("pointerup", { pointerId: 1, clientX: 500, clientY: 360 });
    run.frame();
    run.frame();
    run.controller.resetView();
    note("D2", "RESET_VIEW_AFTER_ORBIT", measure(run), {
      updateBoardCalls: run.updateBoardCalls,
      movesFromGesture: run.moves.length,
    });
    run.controller.dispose();
  }

  // E — real viewport resizes: the window `resize` listener first, then the
  // ResizeObserver after a frame, across very different aspect ratios.
  {
    const run = mount(sceneModule);
    run.runtime.settleImports();
    await flush();
    run.frame();
    const sizes = [
      [1440, 900],
      [390, 300],
      [820, 1180],
      [1280, 720],
    ];
    const window = [];
    const observer = [];
    for (const [w, h] of sizes) {
      run.setSize(w, h);
      run.controller.resize();
      window.push(measure(run));
      run.controller.resize();
      observer.push(measure(run));
    }
    const worst = (list) =>
      list.reduce((acc, m) =>
        typeof m.maxErrorPx !== "number" || m.maxErrorPx > acc.maxErrorPx ? m : acc,
      );
    note("E1", "VIEWPORT_RESIZE_WINDOW_LISTENER", worst(window), {
      fresh: window.every((m) => m.fresh),
      sizes: sizes.map(([w, h]) => `${w}x${h}`),
      updateBoardCalls: run.updateBoardCalls,
    });
    note("E2", "VIEWPORT_RESIZE_OBSERVER_AFTER_FRAME", worst(observer), {
      fresh: observer.every((m) => m.fresh),
      updateBoardCalls: run.updateBoardCalls,
    });

    // F — interaction still lands where the centres say: scene.pick at every
    // published centre hits that tile, and a tap on a move target moves there.
    run.setSize(1100, 640);
    run.controller.resize();
    const centres = JSON.parse(run.canvas.dataset.cellCenters);
    run.frame();
    const scene = run.runtime.handles.scene;
    const misses = [];
    for (const [key, p] of Object.entries(centres)) {
      const hit = scene.pick(p.x, p.y, (mesh) => Boolean(mesh.metadata?.routeTile));
      if (hit?.pickedMesh?.metadata?.key !== key) misses.push(key);
    }
    const target = run.state.moveTargets[0];
    const tc = centres[target];
    run.fire("pointerdown", { pointerId: 7, clientX: tc.x, clientY: tc.y });
    run.fire("pointerup", { pointerId: 7, clientX: tc.x, clientY: tc.y });
    const [tr, tcCol] = target.split(",").map(Number);
    const expected = { row: tr - run.state.player.row, col: tcCol - run.state.player.col };
    const moved = run.moves.length === 1 && run.moves[0].row === expected.row && run.moves[0].col === expected.col;
    results.push({
      id: "F",
      name: "PICK_AND_TAP_AT_PUBLISHED_CENTRES",
      fresh: misses.length === 0 && moved,
      cells: Object.keys(centres).length,
      pickMisses: misses.length,
      firstMisses: misses.slice(0, 6),
      tapTarget: target,
      tapMoved: moved,
    });
    run.controller.dispose();
  }

  return results;
}

// --- the fixed build ---------------------------------------------------------
const fixed = await runScenarios(loadSceneModule({ quiet: true }));

// --- the counterfactual: the same source with the fix removed ---------------
let anchorMatches = 0;
const stale = await runScenarios(
  loadSceneModule({
    quiet: true,
    transformSource(source) {
      anchorMatches = source.split(FIX_ANCHOR).length - 1;
      return source.replace(FIX_ANCHOR, "");
    },
  }),
);

const checks = [];
const check = (id, pass, detail) => {
  checks.push({ id, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id}`);
  for (const [k, v] of Object.entries(detail)) {
    console.log(`        ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  }
};

for (const r of fixed) {
  const { id, name, fresh, ...detail } = r;
  const noUpdateBoard = id === "B2" ? r.updateBoardCalls === 1 : (r.updateBoardCalls ?? 0) === 0;
  const notRewritten = id === "C3" ? r.rewritten === false : true;
  check(`${id} ${name}`, fresh && noUpdateBoard && notRewritten, detail);
}

const staleById = Object.fromEntries(stale.map((r) => [r.id, r]));
const mustCatch = ["A", "B1", "B2", "C1", "C2", "D1", "D2", "E1"];
check(
  "COUNTERFACTUAL_DETECTS_STALE_PROJECTION",
  anchorMatches === 1 && mustCatch.every((id) => staleById[id] && !staleById[id].fresh),
  {
    anchor: FIX_ANCHOR,
    anchorMatches,
    staleBuildErrorsPx: Object.fromEntries(
      mustCatch.map((id) => [id, staleById[id]?.maxErrorPx]),
    ),
    caughtBy: mustCatch.filter((id) => staleById[id] && !staleById[id].fresh),
  },
);

const failed = checks.filter((c) => !c.pass);
console.log(
  `\n${failed.length === 0 ? "ROUTE_PROJECTION_OK" : "ROUTE_PROJECTION_FAILED"} (${checks.length - failed.length}/${checks.length})`,
);
process.exitCode = failed.length === 0 ? 0 : 1;
