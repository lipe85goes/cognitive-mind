/**
 * The Estúdio das Descobertas' test harness: everything the hidden-objects
 * suites need to run the REAL code from source — the import graph read with
 * TypeScript, a fake browser (virtual clock and frame queue, Pointer Events,
 * pointer capture, ResizeObserver, localStorage), a small React that renders
 * the real components, and openers for the pure modules, the platform tables,
 * the real Home, the scene controller on a fake viewport and the real game.
 *
 * Moved verbatim out of hidden-objects-skeleton-tests.mjs (GAME03-SKELETON-01)
 * by GAME03-EXPERIENCE-02, so its suite and hidden-objects-experience-tests.mjs
 * share one harness instead of two copies. Nothing here asserts anything, and
 * nothing here writes: suites decide what holds.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { createModuleGraph } from "./route-module-loader.mjs";

export const DIR = "src/games/hidden-objects/";
export const FILES = {
  types: "src/types/game.ts",
  registry: "src/games/index.ts",
  entryContract: "src/games/entry-contract.ts",
  stages: "src/engine/stage-progress.ts",
  activities: "src/data/activities.ts",
  worlds: "src/data/worlds.ts",
  intros: "src/data/game-intros.ts",
  homeLayout: "src/components/home/homeLayout.ts",
  homeStage: "src/components/home/HomeStage.tsx",
  visuals: "src/components/worlds/worldVisuals.ts",
  dioramas: "src/components/worlds/diorama/worldDioramaLayout.ts",
  rewards: "src/engine/rewards.ts",
  labels: "src/lib/detail-labels.ts",
  storage: "src/engine/storage.ts",
  page: "src/app/page.tsx",
  layout: "src/app/layout.tsx",
  screen: "src/components/GameScreen.tsx",
  entryController: "src/components/world-entry/useWorldEntryController.ts",
  entryTypes: "src/components/world-entry/worldEntryTypes.ts",
  transition: "src/components/WorldEntryTransition.tsx",
  rewardModal: "src/components/RewardResultModal.tsx",
  scene: `${DIR}hidden-objects-scene.ts`,
  rounds: `${DIR}hidden-objects-rounds.ts`,
  camera: `${DIR}hidden-objects-camera.ts`,
  gesture: `${DIR}hidden-objects-gesture.ts`,
  model: `${DIR}hidden-objects-model.ts`,
  controller: `${DIR}hidden-objects-controller.ts`,
  sceneView: `${DIR}HiddenObjectsScene.tsx`,
  game: `${DIR}HiddenObjectsGame.tsx`,
  css: `${DIR}hidden-objects.css`,
  discovery: "docs/GAME03_DISCOVERY_01.md",
};
export const APP_ROOTS = [FILES.page, FILES.layout];
export const STORAGE_KEY = "cognitive-mind-recent-results";

/**
 * Scene viewports — the scene area, not the window — the geometry is held on.
 * `compact` follows hidden-objects.css (≤ 899 px windows: bottom tray, 46 px
 * zoom buttons). The phone is the reference for the touch-size rules.
 * GAME03-EXPERIENCE-02 re-measured them on the production build with the
 * objectives open (the smaller scene; folding the list only enlarges it):
 * the docked dark panel is 19.5rem, the phone's tray two rows.
 */
export const VIEWPORTS = [
  { name: "desktop 1440×900", width: 1128, height: 842, compact: false },
  { name: "laptop 1280×800", width: 968, height: 742, compact: false },
  { name: "tablet 768×1024", width: 768, height: 842, compact: true },
  { name: "phone 390×844", width: 390, height: 662, compact: true },
  { name: "small phone 360×640", width: 360, height: 458, compact: true },
  { name: "phone landscape 844×390", width: 596, height: 337, compact: true },
];
export const DESKTOP = VIEWPORTS[0];
export const REFERENCE_PHONE = VIEWPORTS[3];
/** Where the viewport sits on the page: the controller must subtract it (client → viewport). */
export const VIEWPORT_ORIGIN = { left: 24, top: 72 };

// --- small helpers -------------------------------------------------------------------------------

export const git = (gitArgs, options = {}) =>
  execFileSync("git", gitArgs, { maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], ...options });
export const codeOnly = (source) => source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
export const sorted = (list) => [...list].sort();
export const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const clip = (text, max = 360) => (text.length > max ? `${text.slice(0, max - 3)}...` : text);
export const drain = async () => {
  for (let i = 0; i < 3; i += 1) await new Promise((resolve) => setImmediate(resolve));
};
export const nearCamera = (a, b, eps = 1e-6) =>
  Boolean(a && b) && Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps && Math.abs(a.zoom - b.zoom) < eps;
export const normalizeText = (text) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
export const intersects = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** A seeded generator, so a sweep is the same sweep on every run. */
export function lcg(seed) {
  let state = seed >>> 0;
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}

export const memo = new WeakMap();
export function cached(tree, key, build) {
  let entries = memo.get(tree);
  if (!entries) memo.set(tree, (entries = new Map()));
  if (!entries.has(key)) entries.set(key, build());
  return entries.get(key);
}

/** Every file under `prefix`: the commit's tree, or the working tree (tracked and untracked, not ignored). */
export function listFiles(tree, prefix) {
  const clean = prefix.replace(/\/$/, "");
  if (tree.rev) return git(["ls-tree", "-r", "--name-only", tree.rev, "--", clean], { encoding: "utf8" }).split("\n").filter(Boolean).sort();
  return git(["ls-files", "--cached", "--others", "--exclude-standard", "--", clean], { encoding: "utf8", cwd: tree.root })
    .split("\n")
    .filter(Boolean)
    .filter((file) => fs.existsSync(path.join(tree.root, file)))
    .sort();
}
export const sourceFiles = (tree) => cached(tree, "sources", () => listFiles(tree, "src").filter((file) => /\.(ts|tsx)$/.test(file)));
export const readBinary = (tree, file) => (tree.rev ? git(["show", `${tree.rev}:${file}`]) : fs.readFileSync(path.join(tree.root, file)));
export const TEXT_FILE = /\.(ts|tsx|js|mjs|cjs|css|json|md|txt|svg|html)$/i;
export const fileContent = (tree, file) => (TEXT_FILE.test(file) ? tree.read(file) : readBinary(tree, file).toString("base64"));
export function folderDiff(tree, base, folder) {
  const mine = listFiles(tree, folder);
  const theirs = listFiles(base, folder);
  return [...new Set([...mine, ...theirs])]
    .sort()
    .filter((file) => !mine.includes(file) || !theirs.includes(file) || fileContent(tree, file) !== fileContent(base, file));
}

/** Width/height from a WebP header (VP8X, lossy VP8 or lossless VP8L). */
export function webpSize(buffer) {
  if (!buffer || buffer.length < 30 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") return null;
  const chunk = buffer.toString("ascii", 12, 16);
  if (chunk === "VP8X") return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  if (chunk === "VP8 ") return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  if (chunk === "VP8L") {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return null;
}

/** The block of `@media (<query>) { … }` in a stylesheet, braces matched. */
export function mediaBlock(css, query) {
  const start = css.indexOf(`@media (${query})`);
  if (start === -1) return null;
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1;
    else if (css[i] === "}" && (depth -= 1) === 0) return css.slice(open + 1, i);
  }
  return null;
}

/** What the HUD lays over the scene viewport (hidden-objects.css): the zoom stack and the hint banner. */
export function hudRects(viewport) {
  const button = viewport.compact ? 46 : 48;
  const gap = viewport.compact ? 6.4 : 8;
  const inset = viewport.compact ? 9.6 : 14.4;
  const stack = 3 * button + 2 * gap;
  const bannerWidth = Math.min(544, viewport.width - 32);
  return [
    { name: "zoom controls", x: viewport.width - inset - button, y: viewport.height - inset - stack, w: button, h: stack },
    { name: "hint banner", x: (viewport.width - bannerWidth) / 2, y: 12.8, w: bannerWidth, h: 46 },
  ];
}

// --- the import graph (the lock gate's reading) -----------------------------------------------------

export function staticGraph(tree) {
  return cached(tree, "graph", () => {
    const nodes = new Map();
    const node = (file) => {
      if (nodes.has(file)) return nodes.get(file);
      const entry = { file, static: [], dynamic: [], worker: [], packages: { static: [], dynamic: [] } };
      nodes.set(file, entry);
      if (!/\.(ts|tsx)$/.test(file)) return entry;
      const js = ts.transpileModule(tree.read(file), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.Preserve },
        fileName: file,
      }).outputText;
      const sf = ts.createSourceFile(`${file}.js`, js, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
      const add = (kind, specifier) => {
        const resolved = tree.resolve(specifier, file);
        if (resolved) entry[kind].push(resolved);
        else entry.packages[kind].push(specifier);
      };
      const visit = (n) => {
        if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
          add("static", n.moduleSpecifier.text);
        } else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) {
          add("dynamic", n.arguments[0].text);
        } else if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "Worker") {
          entry.worker.push(n.getText(sf));
        }
        ts.forEachChild(n, visit);
      };
      visit(sf);
      entry.static = [...new Set(entry.static)];
      entry.dynamic = [...new Set(entry.dynamic)];
      return entry;
    };
    const closure = (roots, kinds) => {
      const seen = [...new Set([roots].flat())];
      for (let i = 0; i < seen.length; i += 1) {
        for (const kind of kinds) for (const next of node(seen[i])[kind]) if (!seen.includes(next)) seen.push(next);
      }
      return seen;
    };
    return { node, closure };
  });
}

/** For each `GAME_LOADERS` key, the files its `import()` calls name (null for a non-literal import). */
export function loaderTargets(tree) {
  return cached(tree, "loaders", () => {
    const sf = ts.createSourceFile(FILES.registry, tree.read(FILES.registry), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const out = {};
    const visit = (node) => {
      if (ts.isVariableDeclaration(node) && node.name.getText(sf) === "GAME_LOADERS" && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
        for (const property of node.initializer.properties) {
          if (!ts.isPropertyAssignment(property)) continue;
          const key = ts.isStringLiteral(property.name) ? property.name.text : property.name.getText(sf);
          const imports = [];
          const find = (n) => {
            if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword) {
              const [argument] = n.arguments;
              imports.push(argument && ts.isStringLiteral(argument) ? tree.resolve(argument.text, FILES.registry) : null);
            }
            ts.forEachChild(n, find);
          };
          find(property.initializer);
          out[key] = imports;
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
    return out;
  });
}

/** The string-literal members of a top-level `type Name = "a" | "b"`. */
export function unionLiterals(tree, file, name) {
  const sf = ts.createSourceFile(file, tree.read(file), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const alias = sf.statements.find((s) => ts.isTypeAliasDeclaration(s) && s.name.text === name);
  if (!alias) return [];
  const out = [];
  const walk = (t) => {
    if (ts.isUnionTypeNode(t)) t.types.forEach(walk);
    else if (ts.isParenthesizedTypeNode(t)) walk(t.type);
    else if (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)) out.push(t.literal.text);
  };
  walk(alias.type);
  return out;
}

// --- the fake browser ----------------------------------------------------------------------------

/** A virtual clock: timers and animation frames run only when a check advances time. */
export function createClock() {
  let now = 1000;
  let seq = 1;
  let frameIndex = 0;
  let inFrame = false;
  const timers = new Map();
  const frames = new Map();
  const clock = {
    get now() {
      return now;
    },
    get frameIndex() {
      return frameIndex;
    },
    get inFrame() {
      return inFrame;
    },
    setTimeout(callback, ms) {
      const id = seq++;
      timers.set(id, { at: now + Math.max(0, Number(ms) || 0), callback });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    requestAnimationFrame(callback) {
      const id = seq++;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame(id) {
      frames.delete(id);
    },
    pending: () => ({ frames: frames.size, timers: timers.size }),
    /** One display frame: 16 ms pass, due timers fire, then every frame callback queued before it. */
    frame() {
      now += 16;
      frameIndex += 1;
      for (;;) {
        const due = [...timers].filter(([, timer]) => timer.at <= now).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
        if (!due) break;
        timers.delete(due[0]);
        due[1].callback();
      }
      const batch = [...frames.values()];
      frames.clear();
      inFrame = true;
      try {
        for (const callback of batch) callback(now);
      } finally {
        inFrame = false;
      }
      return batch.length;
    },
  };
  return clock;
}

export class FakeElement {
  constructor(tag, name, env) {
    this.tag = tag;
    this.name = name;
    this.env = env;
    this.listeners = new Map();
    this.captured = new Set();
    this.rect = { left: 0, top: 0, width: 0, height: 0 };
    this.decode = () => Promise.resolve();
    let transform = "";
    this.style = {
      vars: {},
      get transform() {
        return transform;
      },
      set transform(value) {
        transform = value;
        env.log.writes.push({ name, value, inFrame: env.clock.inFrame, frame: env.clock.frameIndex });
      },
      setProperty(key, value) {
        this.vars[key] = value;
      },
    };
    this.dataset = new Proxy(
      {},
      {
        set(target, key, value) {
          target[key] = value;
          if (key === "moving") env.log.moving.push({ name, value });
          return true;
        },
        deleteProperty(target, key) {
          delete target[key];
          if (key === "moving") env.log.moving.push({ name, value: undefined });
          return true;
        },
      },
    );
  }
  addEventListener(type, listener) {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  removeEventListener(type, listener) {
    const list = this.listeners.get(type) ?? [];
    const index = list.indexOf(listener);
    if (index >= 0) list.splice(index, 1);
  }
  listenerCount() {
    return [...this.listeners.values()].reduce((sum, list) => sum + list.length, 0);
  }
  getBoundingClientRect() {
    const { left, top, width, height } = this.rect;
    return { left, top, width, height, x: left, y: top, right: left + width, bottom: top + height };
  }
  setPointerCapture(id) {
    this.captured.add(id);
  }
  releasePointerCapture(id) {
    if (!this.captured.delete(id)) throw new Error(`NotFoundError: pointer ${id} is not captured`);
  }
  hasPointerCapture(id) {
    return this.captured.has(id);
  }
  focus() {
    this.env.log.focus.push(this.name);
  }
  dispatch(type, init = {}) {
    const event = {
      type,
      button: 0,
      ctrlKey: false,
      shiftKey: false,
      altKey: false,
      metaKey: false,
      deltaMode: 0,
      ...init,
      defaultPrevented: false,
      currentTarget: this,
      target: this,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {},
    };
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener(event);
    return event;
  }
}

/**
 * The platform's random source, made deterministic (GAME03-EXPERIENCE-02): each
 * `getRandomValues` call takes the next of `seeds`, then continues from a fixed
 * generator — so a test decides which round "Explorar" draws, and two runs of
 * the same check draw the same rounds. `calls` counts the draws.
 */
export function createRandomSource(seeds = []) {
  const queue = [...seeds];
  let next = lcg(0x0e57d10);
  const source = {
    calls: 0,
    getRandomValues(array) {
      for (let i = 0; i < array.length; i += 1) {
        source.calls += 1;
        array[i] = queue.length ? queue.shift() >>> 0 : Math.floor(next() * 2 ** 32) >>> 0;
      }
      return array;
    },
  };
  return source;
}

export function createEnvironment({ viewport = DESKTOP, reducedMotion = false, storage = {}, seeds = [] } = {}) {
  const clock = createClock();
  const env = {
    clock,
    log: { writes: [], moving: [], focus: [], scrolls: 0 },
    nodes: [],
    observers: [],
    store: new Map(Object.entries(storage)),
    random: createRandomSource(seeds),
  };
  const localStorage = {
    getItem: (key) => (env.store.has(key) ? env.store.get(key) : null),
    setItem: (key, value) => {
      env.store.set(key, String(value));
    },
    removeItem: (key) => {
      env.store.delete(key);
    },
    clear: () => env.store.clear(),
    key: (index) => [...env.store.keys()][index] ?? null,
    get length() {
      return env.store.size;
    },
  };
  class ResizeObserver {
    constructor(callback) {
      this.callback = callback;
      this.targets = new Set();
      this.connected = true;
      env.observers.push(this);
    }
    observe(target) {
      this.targets.add(target);
    }
    unobserve(target) {
      this.targets.delete(target);
    }
    disconnect() {
      this.targets.clear();
      this.connected = false;
    }
  }
  const timers = {
    requestAnimationFrame: (callback) => clock.requestAnimationFrame(callback),
    cancelAnimationFrame: (id) => clock.cancelAnimationFrame(id),
    setTimeout: (callback, ms) => clock.setTimeout(callback, ms),
    clearTimeout: (id) => clock.clearTimeout(id),
  };
  // the reduced-motion preference can change while the game runs (GAME03-EXPERIENCE-02): `matches` is read live
  let reduced = reducedMotion;
  env.setReducedMotion = (value) => {
    reduced = value;
  };
  const window = {
    ...timers,
    matchMedia: (query) => ({
      media: query,
      get matches() {
        return /prefers-reduced-motion:\s*reduce/.test(query) ? reduced : false;
      },
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
    }),
    scrollTo: () => {
      env.log.scrolls += 1;
    },
    localStorage,
  };
  const document = { visibilityState: "visible", querySelector: () => null, addEventListener() {}, removeEventListener() {} };
  env.createNode = (type, props = {}) => {
    const node = new FakeElement(typeof type === "string" ? type : type.name, String(props.className ?? ""), env);
    if (node.name === "hos-viewport") node.rect = { ...VIEWPORT_ORIGIN, width: viewport.width, height: viewport.height };
    env.nodes.push(node);
    return node;
  };
  env.node = (name) => env.nodes.filter((node) => node.name === name).at(-1) ?? null;
  env.globals = { window, document, performance: { now: () => clock.now }, ResizeObserver, console, crypto: env.random, ...timers };
  return env;
}

// --- a small React ----------------------------------------------------------------------------------

export const FRAGMENT = Symbol.for("hidden-objects-tests.fragment");

/** A component the harness never renders: a leaf whose props (and ref) the checks read. */
export function mockComponent(name) {
  const component = () => null;
  Object.defineProperty(component, "name", { value: name });
  component.mocked = true;
  return component;
}
export const IMAGE = mockComponent("Image");

/**
 * Enough React for these components: ordered hook cells, a reducer and setState
 * that bail out on an identical value, passive effects with deps and cleanups
 * run child-first after refs are attached, function components rendered again
 * when their parent renders or their own state changed, and a real unmount.
 */
export function createReact(createNode) {
  let current = null;
  let root = null;
  let firstPass = false;
  let resolved = null;
  let nextId = 0;
  const instances = new Map();
  const hosts = new Map();
  const stats = { renders: {}, mounts: {}, stateUpdates: 0 };

  const element = (type, props, key) => ({ type, props: props ?? {}, key: key ?? null });
  const jsxRuntime = { jsx: element, jsxs: element, Fragment: FRAGMENT };

  const slot = (create) => {
    const instance = current;
    if (!instance) throw new Error("a hook was called outside a component");
    const index = instance.hookIndex++;
    if (!(index in instance.hooks)) instance.hooks[index] = create(instance);
    return instance.hooks[index];
  };
  const changed = (before, after) =>
    before === undefined || after === undefined || before.length !== after.length || before.some((value, i) => !Object.is(value, after[i]));
  const invalidate = (instance) => {
    if (instance.unmounted) return;
    stats.stateUpdates += 1;
    instance.dirty = true;
  };

  const react = {
    useState(initial) {
      const cell = slot((instance) => {
        const state = { value: typeof initial === "function" ? initial() : initial };
        state.set = (next) => {
          const value = typeof next === "function" ? next(state.value) : next;
          if (Object.is(value, state.value)) return;
          state.value = value;
          invalidate(instance);
        };
        return state;
      });
      return [cell.value, cell.set];
    },
    useReducer(reducer, arg, init) {
      const cell = slot((instance) => {
        const state = { value: init ? init(arg) : arg, reducer };
        state.dispatch = (action) => {
          const value = state.reducer(state.value, action);
          if (Object.is(value, state.value)) return;
          state.value = value;
          invalidate(instance);
        };
        return state;
      });
      cell.reducer = reducer;
      return [cell.value, cell.dispatch];
    },
    useRef: (initial) => slot(() => ({ current: initial })),
    useMemo(factory, deps) {
      const cell = slot(() => ({ ready: false, deps: undefined, value: undefined }));
      if (!cell.ready || changed(cell.deps, deps)) Object.assign(cell, { ready: true, deps, value: factory() });
      return cell.value;
    },
    useCallback: (callback, deps) => react.useMemo(() => callback, deps),
    useEffect(effect, deps) {
      const instance = current;
      const cell = slot(() => ({ effect: true, ran: false, deps: undefined, cleanup: undefined }));
      if (!cell.ran || deps === undefined || changed(cell.deps, deps)) instance.effects.push({ cell, effect, deps });
    },
    useLayoutEffect: (effect, deps) => react.useEffect(effect, deps),
    useId: () => slot((instance) => ({ id: `:r${instance.id}:` })).id,
  };

  const nameOf = (type) => (typeof type === "string" ? type : type === FRAGMENT ? "#" : type?.name || "anonymous");
  const keyOf = (node) =>
    node && typeof node === "object" && !Array.isArray(node) && node.key !== null && node.key !== undefined ? `#${node.key}` : "";

  function walk(node, path, parentRendered, pass) {
    if (node === null || node === undefined || typeof node === "boolean") return null;
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return node.map((child, index) => walk(child, `${path}[${keyOf(child) || index}]`, parentRendered, pass));
    const { type, props } = node;
    const id = `${path}/${nameOf(type)}${keyOf(node)}`;
    if (type === FRAGMENT) return { kind: "fragment", children: walk(props.children, id, parentRendered, pass) };
    if (typeof type === "function" && !type.mocked) {
      pass.seen.add(id);
      let instance = instances.get(id);
      if (instance && instance.type !== type) {
        unmountInstance(instance);
        instances.delete(id);
        instance = undefined;
      }
      if (!instance) {
        instance = { id: nextId++, path: id, type, hooks: [], effects: [], hookIndex: 0, dirty: true, unmounted: false, output: null, props };
        instances.set(id, instance);
        stats.mounts[type.name] = (stats.mounts[type.name] ?? 0) + 1;
      }
      let rendered = false;
      if (parentRendered || instance.dirty) {
        instance.props = props;
        instance.hookIndex = 0;
        instance.effects = [];
        const outer = current;
        current = instance;
        try {
          instance.output = type(props);
        } finally {
          current = outer;
        }
        instance.dirty = false;
        stats.renders[type.name] = (stats.renders[type.name] ?? 0) + 1;
        rendered = true;
      }
      const children = walk(instance.output, id, rendered, pass);
      if (rendered) pass.rendered.push(instance);
      return { kind: "component", type, props: instance.props, children };
    }
    pass.hosts.set(id, { type, props });
    const children = typeof type === "string" ? walk(props.children, id, parentRendered, pass) : null;
    return { kind: "host", type, props, children, path: id };
  }

  function attachRef(host, ref) {
    host.ref = ref;
    if (typeof ref === "function") host.cleanup = ref(host.node);
    else if (ref && typeof ref === "object") ref.current = host.node;
  }
  function detachRef(host) {
    const { ref } = host;
    if (typeof ref === "function") {
      if (typeof host.cleanup === "function") host.cleanup();
      else ref(null);
    } else if (ref && typeof ref === "object" && ref.current === host.node) ref.current = null;
    host.ref = null;
    host.cleanup = undefined;
  }
  function unmountInstance(instance) {
    instance.unmounted = true;
    for (const cell of instance.hooks) {
      if (cell?.effect && typeof cell.cleanup === "function") {
        const cleanup = cell.cleanup;
        cell.cleanup = undefined;
        cleanup();
      }
    }
  }

  function flush() {
    for (let round = 0; round < 100; round += 1) {
      const dirty = firstPass || [...instances.values()].some((instance) => instance.dirty && !instance.unmounted);
      if (!dirty || root === null) return;
      const isFirst = firstPass;
      firstPass = false;
      const pass = { seen: new Set(), hosts: new Map(), rendered: [] };
      resolved = walk(root, "", isFirst, pass);
      for (const [id, instance] of [...instances]) {
        if (!pass.seen.has(id)) {
          unmountInstance(instance);
          instances.delete(id);
        }
      }
      for (const [id, host] of [...hosts]) {
        if (!pass.hosts.has(id)) {
          detachRef(host);
          hosts.delete(id);
        }
      }
      for (const [id, { type, props }] of pass.hosts) {
        let host = hosts.get(id);
        if (!host) {
          host = { node: createNode(type, props), ref: null, cleanup: undefined };
          hosts.set(id, host);
        }
        if ((props.ref ?? null) !== host.ref) {
          detachRef(host);
          attachRef(host, props.ref ?? null);
        }
      }
      for (const instance of pass.rendered) {
        for (const { cell, effect, deps } of instance.effects) {
          if (instance.unmounted) break;
          if (typeof cell.cleanup === "function") cell.cleanup();
          const cleanup = effect();
          Object.assign(cell, { ran: true, deps, cleanup: typeof cleanup === "function" ? cleanup : undefined });
        }
        instance.effects = [];
      }
    }
    throw new Error("the small React did not settle within 100 passes");
  }

  function* traverse(node) {
    if (!node || typeof node === "string") return;
    if (Array.isArray(node)) {
      for (const child of node) yield* traverse(child);
      return;
    }
    if (node.kind === "host" || node.kind === "component") yield node;
    yield* traverse(node.children);
  }
  const textOf = (node) => {
    if (!node) return "";
    if (typeof node === "string") return node;
    if (Array.isArray(node)) return node.map(textOf).join("");
    return textOf(node.children);
  };

  return {
    react,
    jsxRuntime,
    stats,
    mount(rootElement) {
      root = rootElement;
      firstPass = true;
      flush();
    },
    flush,
    unmount() {
      for (const instance of instances.values()) unmountInstance(instance);
      instances.clear();
      for (const host of hosts.values()) detachRef(host);
      hosts.clear();
      root = null;
      resolved = null;
    },
    /** Host elements and mocked components of the last render, in tree order, with their fake node and text. */
    hosts: (predicate = () => true) =>
      [...traverse(resolved)]
        .filter((entry) => entry.kind === "host")
        .map((entry) => ({ ...entry, node: hosts.get(entry.path)?.node ?? null, text: textOf(entry).trim() }))
        .filter(predicate),
    components: (name) => [...traverse(resolved)].filter((entry) => entry.kind === "component" && entry.type.name === name),
  };
}

export function browserMocks(harness) {
  const icons = new Map();
  const lucide = new Proxy(
    {},
    {
      get(_, name) {
        if (typeof name !== "string" || name === "__esModule" || name === "then" || name === "default") return undefined;
        if (!icons.has(name)) icons.set(name, mockComponent(name));
        return icons.get(name);
      },
    },
  );
  return {
    react: harness.react,
    "react/jsx-runtime": harness.jsxRuntime,
    "next/image": { __esModule: true, default: IMAGE },
    "lucide-react": lucide,
    [FILES.css]: {},
  };
}

// --- what the checks open ---------------------------------------------------------------------------

/**
 * Scene data, camera, gesture recogniser, session model and (GAME03-EXPERIENCE-02's
 * target pool) the round selection: pure modules, no mocks. `rounds` is null on
 * trees from before the pool, whose lists were fixed.
 */
export function pureModules(tree) {
  return cached(tree, "pure", () => {
    const graph = createModuleGraph({ tree, mocks: {}, globals: {} });
    return {
      scene: graph.require(FILES.scene),
      camera: graph.require(FILES.camera),
      gesture: graph.require(FILES.gesture),
      model: graph.require(FILES.model),
      rounds: tree.exists(FILES.rounds) ? graph.require(FILES.rounds) : null,
    };
  });
}

/** Every list a difficulty can show on this tree: each valid round of the pool, or the one fixed list before it. */
export function possibleRounds(tree, difficulty) {
  const { scene, rounds } = pureModules(tree);
  return rounds ? rounds.validRounds(difficulty).map((round) => [...round]) : [[...scene.DIFFICULTY_PRESETS[difficulty].targets]];
}

/** The first seed (from 1 up) whose round lists every id in `ids`; null if none does. Fixed-list trees: 1 when the list has them. */
export function seedListing(tree, difficulty, ids) {
  const { scene, rounds } = pureModules(tree);
  if (!rounds) return ids.every((id) => scene.DIFFICULTY_PRESETS[difficulty].targets.includes(id)) ? 1 : null;
  for (let seed = 1; seed < 100000; seed += 1) {
    const list = rounds.selectRoundTargets(difficulty, seed);
    if (ids.every((id) => list.includes(id))) return seed;
  }
  return null;
}

/** The first seed (from 1 up) whose round lists exactly `ids`, in any order; null if none. Fixed-list trees: 1 when their list is that set. */
export function seedDrawing(tree, difficulty, ids) {
  const want = sorted(ids).join();
  const { scene, rounds } = pureModules(tree);
  if (!rounds) return sorted(scene.DIFFICULTY_PRESETS[difficulty].targets).join() === want ? 1 : null;
  return cached(tree, `seedDrawing:${difficulty}:${want}`, () => {
    for (let seed = 1; seed < 1_000_000; seed += 1) if (sorted(rounds.selectRoundTargets(difficulty, seed)).join() === want) return seed;
    return null;
  });
}

/** A session started on `difficulty` with `seed` (trees from before the pool ignore the seed). */
export function startSession(model, difficulty, seed = 1) {
  const R = model.sessionReducer;
  return R(R(model.createSession(), { type: "select-difficulty", difficulty }), { type: "start", seed });
}

/** The platform tables, evaluated. */
export function platformTables(tree) {
  return cached(tree, "tables", () => {
    const env = createEnvironment();
    const harness = createReact(env.createNode);
    const graph = createModuleGraph({ tree, mocks: browserMocks(harness), globals: env.globals });
    const load = (file) => graph.require(file);
    return {
      union: unionLiterals(tree, FILES.types, "GameId"),
      registry: load(FILES.registry).GAME_REGISTRY,
      contracts: load(FILES.entryContract).GAME_ENTRY_CONTRACTS,
      stages: [...load(FILES.stages).PLAYABLE_STAGE_IDS],
      activities: load(FILES.activities).ACTIVITIES,
      worlds: load(FILES.worlds),
      intros: load(FILES.intros).GAME_INTROS,
      homeLayout: load(FILES.homeLayout).HOME_WORLD_LAYOUT,
      visuals: load(FILES.visuals).WORLD_VISUALS,
      dioramas: load(FILES.dioramas).WORLD_DIORAMA_CONFIGS,
      rewards: load(FILES.rewards),
      labels: load(FILES.labels),
    };
  });
}

/** Every table that lists the games, as a sorted id list. */
export function activeSets(t) {
  return {
    gameIdUnion: sorted(t.union),
    registry: sorted(Object.keys(t.registry)),
    entryContracts: sorted(Object.keys(t.contracts)),
    playableStages: sorted(t.stages),
    availableActivities: sorted(t.activities.filter((a) => a.status === "available" && a.gameId).map((a) => a.gameId)),
    gameWorlds: sorted(Object.keys(t.worlds.GAME_WORLDS)),
    gameIntros: sorted(Object.keys(t.intros)),
    homeLayout: sorted(Object.keys(t.homeLayout)),
    worldVisuals: sorted(Object.keys(t.visuals)),
    worldDioramas: sorted(Object.keys(t.dioramas)),
  };
}

/** The real Home (page.tsx → HomeStage) on a device holding `storage`; the worlds it renders. */
export function renderHome(tree, { storage = {} } = {}) {
  const env = createEnvironment({ storage });
  const harness = createReact(env.createNode);
  const mocks = {
    ...browserMocks(harness),
    "src/components/GameScreen.tsx": { GameScreen: mockComponent("GameScreen") },
    "src/components/RewardResultModal.tsx": { RewardResultModal: mockComponent("RewardResultModal") },
    "src/components/WorldEntryTransition.tsx": { WorldEntryTransition: mockComponent("WorldEntryTransition") },
    "src/components/home/WorldObject.tsx": { WorldObject: mockComponent("WorldObject") },
    "src/components/home/HomeGreeting.tsx": { HomeGreeting: mockComponent("HomeGreeting") },
  };
  const graph = createModuleGraph({ tree, mocks, globals: env.globals });
  const HomePage = graph.require(FILES.page).default;
  harness.mount(harness.jsxRuntime.jsx(HomePage, {}));
  const worlds = harness
    .hosts((entry) => entry.type?.name === "WorldObject")
    .map((entry) => ({ gameId: entry.props.entry.gameId, name: entry.props.entry.name, selected: entry.props.selected === true }));
  const gameScreens = harness.hosts((entry) => entry.type?.name === "GameScreen").length;
  harness.unmount();
  return { env, worlds, gameScreens };
}

/** The scene controller alone, on a fake viewport. */
export function openRig(tree, { viewport = DESKTOP, reducedMotion = false } = {}) {
  const env = createEnvironment({ viewport, reducedMotion });
  const graph = createModuleGraph({ tree, mocks: {}, globals: env.globals });
  const { HiddenObjectsSceneController } = graph.require(FILES.controller);
  const scene = graph.require(FILES.scene);
  const cam = graph.require(FILES.camera);
  const viewportNode = env.createNode("div", { className: "hos-viewport" });
  const world = env.createNode("div", { className: "hos-world" });
  const parallax = scene.SCENE_LAYERS.filter((layer) => layer.parallax !== 1).map((layer) => ({
    element: env.createNode("img", { className: `hos-layer hos-layer-${layer.id}` }),
    factor: layer.parallax,
  }));
  const taps = [];
  const settles = [];
  const controller = new HiddenObjectsSceneController({
    viewport: viewportNode,
    world,
    parallax,
    isReducedMotion: () => reducedMotion,
    onTap: (tap) => taps.push(tap),
    onSettle: (view) => settles.push(view),
  });
  controller.attach();
  const rig = {
    env,
    cam,
    scene,
    controller,
    viewport: viewportNode,
    world,
    parallax: parallax.map((layer) => layer.element),
    taps,
    settles,
    size: () => controller.getViewportSize(),
    camera: () => controller.getCamera(),
    client(local) {
      const rect = viewportNode.getBoundingClientRect();
      return { x: rect.left + local.x, y: rect.top + local.y };
    },
    clientOf: (point) => rig.client(cam.sceneToViewport(point, rig.camera(), rig.size())),
    centre: () => rig.client({ x: rig.size().width / 2, y: rig.size().height / 2 }),
    pointer: (type, init) => viewportNode.dispatch(type, init),
    frame(count = 1) {
      for (let i = 0; i < count; i += 1) env.clock.frame();
    },
    settle(limit = 240) {
      for (let i = 0; i < limit && env.clock.pending().frames > 0; i += 1) env.clock.frame();
    },
    tap(point, { pointerType = "mouse", id = 1 } = {}) {
      const init = { pointerId: id, clientX: point.x, clientY: point.y, pointerType, button: 0 };
      rig.pointer("pointerdown", init);
      rig.pointer("pointerup", init);
    },
    drag(from, to, { steps = 8, pointerType = "mouse", id = 1 } = {}) {
      rig.pointer("pointerdown", { pointerId: id, clientX: from.x, clientY: from.y, pointerType, button: 0 });
      for (let i = 1; i <= steps; i += 1) {
        rig.pointer("pointermove", { pointerId: id, clientX: from.x + ((to.x - from.x) * i) / steps, clientY: from.y + ((to.y - from.y) * i) / steps, pointerType });
        env.clock.frame();
      }
      rig.pointer("pointerup", { pointerId: id, clientX: to.x, clientY: to.y, pointerType, button: 0 });
    },
    wheel: (point, deltaY, ctrlKey = false) => viewportNode.dispatch("wheel", { deltaY, deltaMode: 0, ctrlKey, clientX: point.x, clientY: point.y }),
    key: (key, extra = {}) => viewportNode.dispatch("keydown", { key, ...extra }),
  };
  return rig;
}

/**
 * The real game, mounted the way GameScreen mounts it, with the shell's four
 * callbacks recorded. `seeds`: what the platform's random source hands out, in
 * order — the first "Explorar" draws the round of `seeds[0]`.
 */
export function openStudio(tree, { viewport = DESKTOP, reducedMotion = false, seeds = [] } = {}) {
  const env = createEnvironment({ viewport, reducedMotion, seeds });
  const harness = createReact(env.createNode);
  const graph = createModuleGraph({ tree, mocks: browserMocks(harness), globals: env.globals });
  const { HiddenObjectsGame } = graph.require(FILES.game);
  const cam = graph.require(FILES.camera);
  const scene = graph.require(FILES.scene);
  const model = graph.require(FILES.model);
  const calls = { complete: [], exit: 0, ready: 0, errors: [] };
  const props = {
    onComplete: (result) => {
      calls.complete.push(JSON.parse(JSON.stringify(result)));
    },
    onExit: () => {
      calls.exit += 1;
    },
    onEntryReady: () => {
      calls.ready += 1;
    },
    onEntryError: (error) => {
      calls.errors.push(String(error?.message ?? error));
    },
  };
  harness.mount(harness.jsxRuntime.jsx(HiddenObjectsGame, props));
  const host = (predicate) => harness.hosts(predicate)[0] ?? null;
  const cls = (name) => (entry) => typeof entry.props.className === "string" && entry.props.className.split(/\s+/).includes(name);
  const studio = {
    env,
    harness,
    cam,
    scene,
    model,
    calls,
    props,
    cls,
    get viewport() {
      return env.node("hos-viewport");
    },
    get controller() {
      return harness.components("HiddenObjectsScene")[0]?.props.controllerRef.current ?? null;
    },
    sceneProps: () => harness.components("HiddenObjectsScene")[0]?.props ?? null,
    size: () => studio.controller.getViewportSize(),
    camera: () => studio.controller.getCamera(),
    status: () => host(cls("hos-shell"))?.props["data-status"] ?? null,
    listStyle: () => host(cls("hos-shell"))?.props["data-list"] ?? null,
    items: () => harness.hosts(cls("hos-item")).map((entry) => ({ label: entry.text, found: entry.props["data-found"] === "true" })),
    found: () => studio.items().filter((item) => item.found).map((item) => item.label),
    /** The list's objects, in the order shown (by `data-target`, or — trees from before the pool — by accessible name). */
    listedIds: () =>
      harness.hosts(cls("hos-item")).map(
        (entry) =>
          entry.props["data-target"] ??
          scene.HIDDEN_OBJECTS.find((t) => [`${t.accessibleLabel}: procurar`, `${t.accessibleLabel}: encontrado`, `${t.clue} Procurar.`].includes(entry.props["aria-label"]))?.id ??
          null,
      ),
    /** The round on screen: the seed the shell reports (null before the pool, or in setup) and its list. */
    round() {
      const seed = host(cls("hos-shell"))?.props["data-round-seed"];
      return { seed: seed === undefined ? null : Number(seed), ids: studio.listedIds() };
    },
    /** Press a listed object's line (the next Pista is for it). */
    focusTarget(id) {
      const entry = harness.hosts(cls("hos-item"))[studio.listedIds().indexOf(id)];
      if (!entry) throw new Error(`${id} is not on the list`);
      entry.props.onClick?.({ preventDefault() {}, currentTarget: entry.node, target: entry.node });
      harness.flush();
    },
    banner: () => host(cls("hos-hint-banner"))?.text ?? null,
    halo() {
      const entry = host(cls("hos-halo"));
      if (!entry) return null;
      const style = entry.props.style;
      return {
        kind: cls("hos-halo-reveal")(entry) ? "reveal" : "hint",
        cx: parseFloat(style["--hos-halo-x"]),
        cy: parseFloat(style["--hos-halo-y"]),
        r: parseFloat(style["--hos-halo-r"]),
      };
    },
    progress: () => host(cls("hos-progress-text"))?.text ?? null,
    card: () => host(cls("hos-overlay-complete")),
    hintLabel: () => host(cls("hos-hint-button"))?.text ?? null,
    button: (predicate) => host((entry) => entry.type === "button" && predicate(entry)),
    click(predicate) {
      const entry = studio.button(predicate);
      if (!entry) throw new Error("no such button on screen");
      if (entry.props.disabled) throw new Error(`button "${entry.text || entry.props["aria-label"]}" is disabled`);
      entry.props.onClick?.({ preventDefault() {}, currentTarget: entry.node, target: entry.node });
      harness.flush();
    },
    clickHint: () => studio.click(cls("hos-hint-button")),
    clickStation: (label) => studio.click((entry) => cls("hos-station")(entry) && entry.text === label),
    frames(count = 1) {
      for (let i = 0; i < count; i += 1) {
        env.clock.frame();
        harness.flush();
      }
    },
    settle(limit = 240) {
      for (let i = 0; i < limit && env.clock.pending().frames > 0; i += 1) studio.frames(1);
    },
    layer: (id) => host((entry) => entry.type === IMAGE && cls(`hos-layer-${id}`)(entry)),
    /** Load + decode these layers (default: every essential layer of the tree under test). */
    async decode(ids = scene.SCENE_LAYERS.map((layer) => layer.id)) {
      for (const id of ids) {
        const entry = studio.layer(id);
        entry.props.onLoad({ currentTarget: entry.node, target: entry.node });
      }
      await drain();
      harness.flush();
    },
    fail(id) {
      studio.layer(id).props.onError?.({});
      harness.flush();
    },
    start(difficulty = "easy") {
      const radio = host((entry) => entry.type === "input" && entry.props.value === difficulty);
      radio.props.onChange?.({ target: radio.node, currentTarget: radio.node });
      harness.flush();
      studio.click((entry) => entry.text === "Explorar");
      studio.settle();
    },
    goTo(stationId) {
      studio.clickStation(scene.SCENE_STATIONS.find((station) => station.id === stationId).label);
      studio.settle();
    },
    client(point) {
      const local = cam.sceneToViewport(point, studio.camera(), studio.size());
      const rect = studio.viewport.getBoundingClientRect();
      return { x: rect.left + local.x, y: rect.top + local.y };
    },
    targetClient: (id) => studio.client(model.regionCenter(model.targetById(id).region)),
    centre() {
      const rect = studio.viewport.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    },
    pointer(type, init) {
      studio.viewport.dispatch(type, init);
      harness.flush();
    },
    tapAt(point, { pointerType = "mouse", id = 1 } = {}) {
      const init = { pointerId: id, clientX: point.x, clientY: point.y, pointerType, button: 0 };
      studio.pointer("pointerdown", init);
      studio.pointer("pointerup", init);
    },
    drag(from, to, { steps = 8, pointerType = "mouse", id = 1 } = {}) {
      studio.pointer("pointerdown", { pointerId: id, clientX: from.x, clientY: from.y, pointerType, button: 0 });
      for (let i = 1; i <= steps; i += 1) {
        studio.pointer("pointermove", { pointerId: id, clientX: from.x + ((to.x - from.x) * i) / steps, clientY: from.y + ((to.y - from.y) * i) / steps, pointerType });
        studio.frames(1);
      }
      studio.pointer("pointerup", { pointerId: id, clientX: to.x, clientY: to.y, pointerType, button: 0 });
    },
    /** Two fingers on `centre`, `from` px apart, spread to `to` px; the second lifts first. */
    pinch(centre, { from = 16, to = 140, steps = 8 } = {}) {
      const at = (distance, sign) => ({ clientX: centre.x + (sign * distance) / 2, clientY: centre.y });
      studio.pointer("pointerdown", { pointerId: 1, pointerType: "touch", button: 0, ...at(from, -1) });
      studio.pointer("pointerdown", { pointerId: 2, pointerType: "touch", button: 0, ...at(from, 1) });
      for (let i = 1; i <= steps; i += 1) {
        const distance = from + ((to - from) * i) / steps;
        studio.pointer("pointermove", { pointerId: 2, pointerType: "touch", ...at(distance, 1) });
        studio.pointer("pointermove", { pointerId: 1, pointerType: "touch", ...at(distance, -1) });
        studio.frames(1);
      }
      studio.pointer("pointerup", { pointerId: 2, pointerType: "touch", button: 0, ...at(to, 1) });
      studio.pointer("pointerup", { pointerId: 1, pointerType: "touch", button: 0, ...at(to, -1) });
    },
    wheel(point, deltaY) {
      studio.viewport.dispatch("wheel", { deltaY, deltaMode: 0, ctrlKey: false, clientX: point.x, clientY: point.y });
      harness.flush();
    },
    find(id) {
      studio.goTo(model.targetById(id).station);
      studio.tapAt(studio.targetClient(id));
      studio.settle();
    },
    /** The viewport takes a new size (a window resized, a phone turned): every live ResizeObserver fires. */
    resize({ width, height }) {
      studio.viewport.rect = { ...studio.viewport.rect, width, height };
      for (const observer of env.observers) if (observer.connected) observer.callback([], observer);
      harness.flush();
      studio.settle();
    },
    renders: () => (harness.stats.renders.HiddenObjectsGame ?? 0) + (harness.stats.renders.HiddenObjectsScene ?? 0),
    unmount: () => harness.unmount(),
  };
  return studio;
}

/** A gesture sequence through the pure recogniser: everything it emitted, and the taps among it. */
export const gestureRunner = (g) => (events, cameraMoving = false) => {
  let state = g.IDLE_GESTURE;
  const effects = [];
  const captures = [];
  for (const [kind, sample] of events) {
    const step =
      kind === "down"
        ? g.pointerDown(state, sample, cameraMoving)
        : kind === "move"
          ? g.pointerMove(state, sample)
          : kind === "up"
            ? g.pointerUp(state, sample)
            : g.pointerCancel(state, sample);
    if (step.capture !== undefined) captures.push(step.capture);
    state = step.state;
    effects.push(...step.effects);
  }
  return { state, effects, captures, taps: effects.filter((effect) => effect.kind === "tap") };
};
export const sample = (kind, id, x, y, t, pointerType = "touch", button = 0) => [kind, { id, x, y, t, pointerType, button }];
export const tapOn = (model, id, pointerType = "mouse") => ({ type: "tap", point: model.regionCenter(model.targetById(id).region), scale: 1, pointerType });

export function regionGap(model, a, b) {
  if (a.kind === "circle") return model.distanceToRegion({ x: a.cx, y: a.cy }, b) - a.r;
  if (b.kind === "circle") return model.distanceToRegion({ x: b.cx, y: b.cy }, a) - b.r;
  const dx = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), 0);
  const dy = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h), 0);
  return Math.hypot(dx, dy);
}
