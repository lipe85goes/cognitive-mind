/**
 * ROTA-BABYLON-LIFECYCLE-07 — a strict Babylon double for lifecycle testing.
 *
 * `routeBabylonScene.ts` imports Babylon as `import type * as BABYLON`, i.e. it
 * has NO runtime imports and receives the whole engine as a parameter. That is
 * what makes this possible: the real controller can be driven end to end without
 * a browser, a GPU or the real library.
 *
 * The double is deliberately STRICTER than Babylon. After `scene.dispose()` or
 * `engine.dispose()`, every further interaction with that scene or engine is
 * recorded as an ownership violation instead of being tolerated. Real Babylon
 * sometimes tolerates a late touch, sometimes throws deep inside
 * `postProcessManager`, and sometimes corrupts quietly — which is exactly why a
 * test must not depend on which of those it happens to do today.
 *
 * A violation here therefore means: "this code path acts on a controller whose
 * ownership has ended." That is the property under test, not any particular
 * Babylon error string.
 *
 * Asset imports are controllable: `ImportMeshAsync` returns a promise the test
 * settles by hand, so "dispose while assets are still loading" is a state the
 * test can hold open for as long as it likes.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const ROOT = process.cwd();
const SCENE = path.join(ROOT, "src/games/escape-maze/routeBabylonScene.ts");

function compile(file, transformSource = (source) => source) {
  return ts.transpileModule(transformSource(fs.readFileSync(file, "utf8")), {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: file,
  }).outputText;
}

/**
 * Load the real controller factory once.
 *
 * `transformSource` lets a counterfactual test compile a deliberately broken
 * variant of the real source; `quiet` swaps the module's console for a no-op
 * (the procedural-fallback warnings are expected when no GLB can load).
 */
export function loadSceneModule({ transformSource, quiet = false } = {}) {
  const mod = { exports: {} };
  const silent = { log() {}, info() {}, warn() {}, error() {} };
  const sandbox = {
    module: mod,
    exports: mod.exports,
    console: quiet ? silent : console,
    Math,
    Set,
    Map,
    Number,
    Array,
    Object,
    JSON,
    Promise,
    Error,
    // Read by the tap gesture's duration check; a pointer-driven test needs it.
    performance,
    require() {
      throw new Error("routeBabylonScene must have no runtime imports");
    },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  new vm.Script(compile(SCENE, transformSource)).runInContext(sandbox);
  if (typeof mod.exports.createRouteBabylonController !== "function") {
    throw new Error("createRouteBabylonController missing: module shape changed");
  }
  return mod.exports;
}

export function createBabylonDouble() {
  /** Every action taken on a scene/engine whose ownership already ended. */
  const violations = [];
  /** Asset imports the test can settle by hand. */
  const pendingImports = [];
  const counters = {
    enginesCreated: 0,
    enginesDisposed: 0,
    scenesCreated: 0,
    scenesDisposed: 0,
    renderLoopsStarted: 0,
    renderLoopsStopped: 0,
    framesRendered: 0,
    glowLayersCreated: 0,
    glowLayersDisposed: 0,
    lightsCreated: 0,
    importsRequested: 0,
  };

  let engineRef = null;
  let sceneRef = null;
  /** Registration helpers so the constructors never alias `this` to a local. */
  const registerEngine = (instance) => {
    engineRef = instance;
  };
  const registerScene = (instance) => {
    sceneRef = instance;
  };

  const note = (action, detail) => {
    violations.push({ action, ...detail });
  };
  /** True once the owning scene or engine is gone. */
  const ownershipEnded = () =>
    (sceneRef && sceneRef.__disposed) || (engineRef && engineRef.__disposed);

  const guard = (action) => {
    if (ownershipEnded()) note(action, {});
  };

  class Vector3 {
    constructor(x = 0, y = 0, z = 0) {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    set(x, y, z) {
      this.x = x;
      this.y = y;
      this.z = z;
      return this;
    }
    setAll(v) {
      return this.set(v, v, v);
    }
    copyFrom(other) {
      return this.set(other.x, other.y, other.z);
    }
    static Zero() {
      return new Vector3(0, 0, 0);
    }
    static TransformCoordinates() {
      return new Vector3(0, 0, 0);
    }
    static Project() {
      return new Vector3(0, 0, 0);
    }
  }
  class Color3 {
    constructor(r = 0, g = 0, b = 0) {
      this.r = r;
      this.g = g;
      this.b = b;
    }
    static FromHexString() {
      return new Color3(0.5, 0.5, 0.5);
    }
  }
  class Color4 {
    constructor(r = 0, g = 0, b = 0, a = 1) {
      Object.assign(this, { r, g, b, a });
    }
  }

  /** Anything that lives in the scene graph and can be disposed. */
  function makeNode(name, extra = {}) {
    const node = {
      name,
      position: new Vector3(),
      rotation: new Vector3(),
      scaling: new Vector3(1, 1, 1),
      metadata: null,
      material: null,
      parent: null,
      isPickable: true,
      receiveShadows: false,
      __disposed: false,
      setEnabled() {
        guard(`setEnabled:${name}`);
      },
      getDescendants() {
        guard(`getDescendants:${name}`);
        return [];
      },
      getChildMeshes() {
        guard(`getChildMeshes:${name}`);
        return [];
      },
      clone(cloneName, parent) {
        guard(`clone:${name}`);
        return makeNode(cloneName ?? name, { parent });
      },
      dispose() {
        node.__disposed = true;
      },
      ...extra,
    };
    return node;
  }

  const B = {
    Vector3,
    Color3,
    Color4,
    Matrix: { Identity: () => ({}) },
    ImageProcessingConfiguration: { TONEMAPPING_ACES: 1 },

    Engine: class {
      constructor(canvas) {
        counters.enginesCreated += 1;
        this.canvas = canvas;
        this.__disposed = false;
        this.__loop = null;
        registerEngine(this);
      }
      getRenderWidth() {
        guard("engine.getRenderWidth");
        return 1280;
      }
      getRenderHeight() {
        guard("engine.getRenderHeight");
        return 720;
      }
      resize() {
        guard("engine.resize");
      }
      runRenderLoop(fn) {
        guard("engine.runRenderLoop");
        counters.renderLoopsStarted += 1;
        this.__loop = fn;
      }
      stopRenderLoop() {
        counters.renderLoopsStopped += 1;
        this.__loop = null;
      }
      dispose() {
        counters.enginesDisposed += 1;
        this.__disposed = true;
        this.__loop = null;
      }
    },

    Scene: class {
      constructor() {
        counters.scenesCreated += 1;
        this.__disposed = false;
        this.lights = [];
        this.materials = [];
        this.clearColor = null;
        this.ambientColor = null;
        this.imageProcessingConfiguration = {};
        this.onAfterRenderObservable = {
          __once: [],
          addOnce: (fn) => {
            guard("scene.onAfterRenderObservable.addOnce");
            this.onAfterRenderObservable.__once.push(fn);
          },
          clear: () => {
            this.onAfterRenderObservable.__once.length = 0;
          },
        };
        registerScene(this);
      }
      updateTransformMatrix() {
        guard("scene.updateTransformMatrix");
      }
      getTransformMatrix() {
        guard("scene.getTransformMatrix");
        return {};
      }
      pick() {
        guard("scene.pick");
        return { hit: false };
      }
      render() {
        // The exact call real Babylon crashes inside, via postProcessManager.
        if (this.__disposed) {
          note("scene.render after dispose", { fatal: true });
          throw new Error(
            "Cannot read properties of null (reading 'postProcessManager')",
          );
        }
        counters.framesRendered += 1;
        const once = this.onAfterRenderObservable.__once.splice(0);
        once.forEach((fn) => fn());
      }
      dispose() {
        counters.scenesDisposed += 1;
        this.__disposed = true;
        // Real Babylon clears observables on dispose WITHOUT firing them.
        this.onAfterRenderObservable.clear();
      }
    },

    ArcRotateCamera: class {
      constructor() {
        this.inputs = { clear() {} };
        this.position = new Vector3();
        this.target = new Vector3();
        this.viewport = {
          toGlobal: () => ({ x: 0, y: 0, width: 1280, height: 720 }),
        };
      }
      setTarget() {}
      attachControl() {}
      getViewMatrix() {
        return {};
      }
      getProjectionMatrix() {
        return {};
      }
    },
    DirectionalLight: class {
      constructor(name) {
        counters.lightsCreated += 1;
        this.name = name;
        this.position = new Vector3();
      }
    },
    HemisphericLight: class {
      constructor(name) {
        counters.lightsCreated += 1;
        this.name = name;
      }
    },
    PointLight: class {
      constructor(name) {
        counters.lightsCreated += 1;
        this.name = name;
        this.position = new Vector3();
      }
    },
    GlowLayer: class {
      constructor() {
        counters.glowLayersCreated += 1;
        this.__disposed = false;
      }
      dispose() {
        counters.glowLayersDisposed += 1;
        this.__disposed = true;
      }
    },
    ShadowGenerator: class {
      constructor() {
        this.__casters = 0;
      }
      addShadowCaster() {
        guard("shadowGenerator.addShadowCaster");
        this.__casters += 1;
      }
    },
    StandardMaterial: class {
      constructor(name) {
        guard(`new StandardMaterial:${name}`);
        this.name = name;
        this.__disposed = false;
      }
      dispose() {
        this.__disposed = true;
      }
    },
    TransformNode: class {
      constructor(name) {
        guard(`new TransformNode:${name}`);
        const node = makeNode(name);
        Object.assign(this, node);
        this.dispose = node.dispose;
      }
    },
    MeshBuilder: {
      CreateBox: (name) => {
        guard(`MeshBuilder.CreateBox:${name}`);
        return makeNode(name);
      },
      CreateCylinder: (name) => {
        guard(`MeshBuilder.CreateCylinder:${name}`);
        return makeNode(name);
      },
      CreateSphere: (name) => {
        guard(`MeshBuilder.CreateSphere:${name}`);
        return makeNode(name);
      },
      CreateTorus: (name) => {
        guard(`MeshBuilder.CreateTorus:${name}`);
        return makeNode(name);
      },
    },

    SceneLoader: {
      ImportMeshAsync(_a, _b, path) {
        counters.importsRequested += 1;
        let settle;
        const promise = new Promise((resolve, reject) => {
          settle = { resolve, reject };
        });
        pendingImports.push({
          path,
          settled: false,
          resolve(payload) {
            this.settled = true;
            settle.resolve(
              payload ?? {
                meshes: [makeNode(`${path}#mesh`)],
                transformNodes: [makeNode(`${path}#node`)],
              },
            );
          },
          reject(error) {
            this.settled = true;
            settle.reject(error ?? new Error(`import failed: ${path}`));
          },
        });
        return promise;
      },
    },
  };

  return {
    B,
    violations,
    pendingImports,
    counters,
    get engine() {
      return engineRef;
    },
    get scene() {
      return sceneRef;
    },
    /** Drive one frame of the render loop, as requestAnimationFrame would. */
    tick() {
      if (engineRef?.__loop) engineRef.__loop();
    },
    resolveAllImports(payload) {
      pendingImports
        .filter((i) => !i.settled)
        .forEach((i) => i.resolve(payload));
    },
    rejectAllImports(error) {
      pendingImports.filter((i) => !i.settled).forEach((i) => i.reject(error));
    },
    reset() {
      violations.length = 0;
      pendingImports.length = 0;
      engineRef = null;
      sceneRef = null;
      Object.keys(counters).forEach((k) => {
        counters[k] = 0;
      });
    },
  };
}

/** A canvas with only the surface the controller actually touches. */
export function createCanvasDouble() {
  const listeners = new Map();
  return {
    clientWidth: 1280,
    clientHeight: 720,
    dataset: {},
    __listeners: listeners,
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: 1280, height: 720 };
    },
    setPointerCapture() {},
    /** Listeners still attached — a leak signal after dispose. */
    liveListenerCount() {
      let total = 0;
      listeners.forEach((set) => {
        total += set.size;
      });
      return total;
    },
  };
}

/** A minimal board state, shaped like what the hook produces. */
export function createStateDouble(overrides = {}) {
  return {
    rows: 9,
    cols: 9,
    walls: ["1,1", "2,2", "3,3"],
    exitPosition: { row: 0, col: 8 },
    lights: [{ row: 4, col: 4 }],
    collectedKeys: [],
    player: { row: 8, col: 0 },
    guardian: { row: 0, col: 3 },
    sentinel: { row: 1, col: 7 },
    sentinelCommitted: false,
    moveTargets: ["8,1"],
    traps: [{ row: 5, col: 5 }],
    triggeredTrapKeys: [],
    chest: { row: 6, col: 2 },
    chestOpened: false,
    breakTargetKeys: [],
    aimedWallKey: null,
    brokenWallKey: null,
    dangerTiles: [],
    reducedMotion: true,
    status: "playing",
    ...overrides,
  };
}
