/**
 * GAME03-SKELETON-01 — the Estúdio das Descobertas skeleton, checked from source.
 *
 * The Estúdio (`hidden-objects`) took the active slot of the Trilha Lógica
 * (`number-trail`). This battery holds the 36 points the mission listed — the
 * five active games, the lazy and explicitly-ready registry entry, the agnostic
 * shell, the Home slot, the old Trilha history, the dependencies, no Babylon and
 * no Rota/Circuito domain, the camera and gesture math, hit testing, the ten
 * targets, the 5/6/8 lists and their tiers, fairness geometry, hints, restart,
 * a single completion, the result, readiness, cleanup, reduced motion, no React
 * render per pointermove, the Discovery's record — plus the platform boundaries
 * (H37) and the scene's assets (H38).
 *
 * Everything runs the REAL code, compiled from source and unmodified:
 *
 *   - the pure modules (scene data, camera, gesture recogniser, session model);
 *   - the scene controller on a fake viewport (Pointer Events, wheel, keys,
 *     pointer capture, ResizeObserver) under a virtual clock and frame queue;
 *   - HiddenObjectsGame with its real HiddenObjectsScene, SetupCard and feedback
 *     layer under a small React (ordered hooks, reducer bail-out, passive effects
 *     with deps and cleanups, refs attached before effects, a real unmount):
 *     every gesture goes in as a Pointer Event on the viewport, every assertion
 *     reads what the components rendered or handed the shell;
 *   - the real Home page (page.tsx → HomeStage, the real storage, worlds, stages
 *     and entry controller) on a fake localStorage holding an old Trilha result.
 *
 * The platform tables (GameId, registry, entry contract, stages, activities,
 * worlds, intros, Home layout, visuals, dioramas, reward copy) are evaluated;
 * the import graph is read with TypeScript the way the lock gate reads it.
 *
 * [contract] checks are what this mission introduced: they FAIL on its base
 * (f9254429 — the Trilha active, no Estúdio). [preserved] checks pin what must
 * not move — the Rota, the Circuito, the Central, the Jardim, the shell's
 * agnosticism, the dependencies, the platform boundaries — and hold on both.
 *
 * Usage:
 *   node tools/validation/hidden-objects-skeleton-tests.mjs                  # the working tree
 *   node tools/validation/hidden-objects-skeleton-tests.mjs --rev=<commit>   # every source at <commit> (git show)
 *   node tools/validation/hidden-objects-skeleton-tests.mjs --counterfactuals
 *        the working tree must pass every check; the base must fail every
 *        [contract] check and hold every [preserved] one; every in-memory MUTANT
 *        of today's tree (MUTANTS below) must fail the checks it names. A mutant
 *        is a source override held in memory — nothing is ever written.
 *
 * Writes nothing. Exit 0 = every check holds, 1 = a check failed, 3 = usage error.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";
import { createModuleGraph, openSourceTree } from "./route-module-loader.mjs";

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
const COUNTERFACTUAL_MODE = args.includes("--counterfactuals");
if (args.some((arg) => arg !== revArg && arg !== "--counterfactuals") || REV === "" || (REV && COUNTERFACTUAL_MODE)) {
  console.error("usage: node tools/validation/hidden-objects-skeleton-tests.mjs [--rev=<commit> | --counterfactuals]");
  process.exit(EXIT_USAGE);
}

// --- what the mission fixed ---------------------------------------------------------------------

/** The mission's base: the Trilha still active, no Estúdio. */
const BASE = "f9254429feac68fb03329c28dec0d6e97686de14";
const STUDIO = "hidden-objects";
const RETIRED = "number-trail";
const TITLE = "Estúdio das Descobertas";
const SUMMARY = "Você encontrou todos os objetos do Estúdio.";
/** The product's five active games, in map order (PLAYABLE_STAGE_IDS). Not "at least five": these five. */
const ACTIVE_GAMES = ["color-sequence", "escape-maze", "security-panel", "hidden-objects", "seed-garden"];
const DIFFICULTIES = ["easy", "medium", "hard"];
const PREFERRED_LABELS = ["Lupa", "Chave antiga", "Bússola", "Relógio", "Câmera", "Barco em miniatura", "Binóculo", "Ampulheta", "Lanterna", "Estatueta"];
const TARGET_FIELDS = ["accessibleLabel", "hintRegion", "id", "label", "region", "station", "tier"];
const AMBIGUOUS_LABELS = /planta|livro azul/i;
const COLOUR_WORDS = /\b(azul|vermelh[oa]|verde|amarel[oa]|rox[oa]|rosa|laranja|pret[oa]|branc[oa]|cinza|marrom|dourad[oa]|pratead[oa])\b/i;
const ALLOWED_STUDIO_PACKAGES = ["lucide-react", "next/image", "react"];
const ROUTE_OR_CIRCUIT_NAMES = /route-(config|geometry|generation|defenders|invariants|state|events|session|random)|useEscapeMaze|RouteBabylon|routeBabylon|escape-maze|color-sequence|MemoryCircuit/;
const SHELL_GAME_NAMES = /hidden-objects|HiddenObjects|number-trail|NumberTrail|Est[uú]dio das Descobertas|Trilha/;

const DIR = "src/games/hidden-objects/";
const FILES = {
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
  camera: `${DIR}hidden-objects-camera.ts`,
  gesture: `${DIR}hidden-objects-gesture.ts`,
  model: `${DIR}hidden-objects-model.ts`,
  controller: `${DIR}hidden-objects-controller.ts`,
  sceneView: `${DIR}HiddenObjectsScene.tsx`,
  game: `${DIR}HiddenObjectsGame.tsx`,
  css: `${DIR}hidden-objects.css`,
  discovery: "docs/GAME03_DISCOVERY_01.md",
};
const APP_ROOTS = [FILES.page, FILES.layout];
const STORAGE_KEY = "cognitive-mind-recent-results";
const FOREIGN_KEY = "some-other-app-key";
const FOREIGN_VALUE = "left exactly as it was";

/**
 * Scene viewports — the scene area, not the window — the geometry is held on.
 * `compact` follows hidden-objects.css (≤ 899 px windows: bottom tray, 46 px
 * zoom buttons). The phone is the reference for the touch-size rules.
 */
const VIEWPORTS = [
  { name: "desktop 1440×900", width: 1096, height: 836, compact: false },
  { name: "laptop 1280×800", width: 936, height: 736, compact: false },
  { name: "tablet 768×1024", width: 768, height: 700, compact: true },
  { name: "phone 390×844", width: 390, height: 620, compact: true },
  { name: "small phone 360×640", width: 360, height: 440, compact: true },
  { name: "phone landscape 844×390", width: 596, height: 330, compact: true },
];
const DESKTOP = VIEWPORTS[0];
const REFERENCE_PHONE = VIEWPORTS[3];
/** Where the viewport sits on the page: the controller must subtract it (client → viewport). */
const VIEWPORT_ORIGIN = { left: 24, top: 72 };

/** Fairness thresholds (Discovery §9 and the mission's FAIRNESS block). */
const MIN_TARGET_GAP_SU = 24;
const FRONT_CLEARANCE_SU = 24;
const MIN_EFFECTIVE_TOUCH_PX = 44;
const MIN_VISIBLE_AT_COVER_PX = 32;
/** "Essenciais aproximadamente ≤ 1,3 MB" — the entry's art: layers, list thumbnails, transition art. */
const ENTRY_ASSET_BUDGET_BYTES = 1_300_000;
const EPS = 1e-6;

/** An old Trilha result exactly as NumberTrailGame wrote it at the base. */
const LEGACY_RESULT = {
  id: "number-trail-1759600000000",
  activityId: "number-trail",
  activityTitle: "Trilha Lógica",
  gameId: "number-trail",
  score: 340,
  playedAt: "2026-10-04T18:00:00.000Z",
  summary: "Você iluminou 2 trilhas completas na Trilha Lógica.",
  details: { level: 3, currentNumber: 12, errors: 0, roundsCompleted: 2, correctNumbers: 12, maxErrors: 3 },
};
const resultFor = (difficulty, total) => ({
  activityId: STUDIO,
  activityTitle: TITLE,
  gameId: STUDIO,
  score: total,
  summary: SUMMARY,
  details: { difficulty, foundObjects: total, totalObjects: total, completed: true },
});

// --- small helpers -------------------------------------------------------------------------------

const git = (gitArgs, options = {}) =>
  execFileSync("git", gitArgs, { maxBuffer: 256 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"], ...options });
const codeOnly = (source) => source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
const sorted = (list) => [...list].sort();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clip = (text, max = 360) => (text.length > max ? `${text.slice(0, max - 3)}...` : text);
const drain = async () => {
  for (let i = 0; i < 3; i += 1) await new Promise((resolve) => setImmediate(resolve));
};
const nearCamera = (a, b, eps = 1e-6) =>
  Boolean(a && b) && Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps && Math.abs(a.zoom - b.zoom) < eps;
const normalizeText = (text) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
const intersects = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
/** A seeded generator, so a sweep is the same sweep on every run. */
function lcg(seed) {
  let state = seed >>> 0;
  return () => (state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}

const memo = new WeakMap();
function cached(tree, key, build) {
  let entries = memo.get(tree);
  if (!entries) memo.set(tree, (entries = new Map()));
  if (!entries.has(key)) entries.set(key, build());
  return entries.get(key);
}

/** Every file under `prefix`: the commit's tree, or the working tree (tracked and untracked, not ignored). */
function listFiles(tree, prefix) {
  const clean = prefix.replace(/\/$/, "");
  if (tree.rev) return git(["ls-tree", "-r", "--name-only", tree.rev, "--", clean], { encoding: "utf8" }).split("\n").filter(Boolean).sort();
  return git(["ls-files", "--cached", "--others", "--exclude-standard", "--", clean], { encoding: "utf8", cwd: tree.root })
    .split("\n")
    .filter(Boolean)
    .filter((file) => fs.existsSync(path.join(tree.root, file)))
    .sort();
}
const sourceFiles = (tree) => cached(tree, "sources", () => listFiles(tree, "src").filter((file) => /\.(ts|tsx)$/.test(file)));
const readBinary = (tree, file) => (tree.rev ? git(["show", `${tree.rev}:${file}`]) : fs.readFileSync(path.join(tree.root, file)));
const TEXT_FILE = /\.(ts|tsx|js|mjs|cjs|css|json|md|txt|svg|html)$/i;
const fileContent = (tree, file) => (TEXT_FILE.test(file) ? tree.read(file) : readBinary(tree, file).toString("base64"));
function folderDiff(tree, base, folder) {
  const mine = listFiles(tree, folder);
  const theirs = listFiles(base, folder);
  return [...new Set([...mine, ...theirs])]
    .sort()
    .filter((file) => !mine.includes(file) || !theirs.includes(file) || fileContent(tree, file) !== fileContent(base, file));
}

/** Width/height from a WebP header (VP8X, lossy VP8 or lossless VP8L). */
function webpSize(buffer) {
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
function mediaBlock(css, query) {
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
function hudRects(viewport) {
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

function staticGraph(tree) {
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
function loaderTargets(tree) {
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
function unionLiterals(tree, file, name) {
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
function createClock() {
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

class FakeElement {
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

function createEnvironment({ viewport = DESKTOP, reducedMotion = false, storage = {} } = {}) {
  const clock = createClock();
  const env = {
    clock,
    log: { writes: [], moving: [], focus: [], scrolls: 0 },
    nodes: [],
    observers: [],
    store: new Map(Object.entries(storage)),
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
  const window = {
    ...timers,
    matchMedia: (query) => ({
      media: query,
      matches: /prefers-reduced-motion:\s*reduce/.test(query) ? reducedMotion : false,
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
  env.globals = { window, document, performance: { now: () => clock.now }, ResizeObserver, console, ...timers };
  return env;
}

// --- a small React ----------------------------------------------------------------------------------

const FRAGMENT = Symbol.for("hidden-objects-tests.fragment");

/** A component the harness never renders: a leaf whose props (and ref) the checks read. */
function mockComponent(name) {
  const component = () => null;
  Object.defineProperty(component, "name", { value: name });
  component.mocked = true;
  return component;
}
const IMAGE = mockComponent("Image");

/**
 * Enough React for these components: ordered hook cells, a reducer and setState
 * that bail out on an identical value, passive effects with deps and cleanups
 * run child-first after refs are attached, function components rendered again
 * when their parent renders or their own state changed, and a real unmount.
 */
function createReact(createNode) {
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

function browserMocks(harness) {
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

/** Scene data, camera, gesture recogniser and session model: pure modules, no mocks. */
function pureModules(tree) {
  return cached(tree, "pure", () => {
    const graph = createModuleGraph({ tree, mocks: {}, globals: {} });
    return {
      scene: graph.require(FILES.scene),
      camera: graph.require(FILES.camera),
      gesture: graph.require(FILES.gesture),
      model: graph.require(FILES.model),
    };
  });
}

/** The platform tables, evaluated. */
function platformTables(tree) {
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
function activeSets(t) {
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
function renderHome(tree, { storage = {} } = {}) {
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
function openRig(tree, { viewport = DESKTOP, reducedMotion = false } = {}) {
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

/** The real game, mounted the way GameScreen mounts it, with the shell's four callbacks recorded. */
function openStudio(tree, { viewport = DESKTOP, reducedMotion = false } = {}) {
  const env = createEnvironment({ viewport, reducedMotion });
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
    async decode(ids = ["back", "plate", "front"]) {
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
    renders: () => (harness.stats.renders.HiddenObjectsGame ?? 0) + (harness.stats.renders.HiddenObjectsScene ?? 0),
    unmount: () => harness.unmount(),
  };
  return studio;
}

/** A gesture sequence through the pure recogniser: everything it emitted, and the taps among it. */
const gestureRunner = (g) => (events, cameraMoving = false) => {
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
const sample = (kind, id, x, y, t, pointerType = "touch", button = 0) => [kind, { id, x, y, t, pointerType, button }];
const tapOn = (model, id, pointerType = "mouse") => ({ type: "tap", point: model.regionCenter(model.targetById(id).region), scale: 1, pointerType });

function regionGap(model, a, b) {
  if (a.kind === "circle") return model.distanceToRegion({ x: a.cx, y: a.cy }, b) - a.r;
  if (b.kind === "circle") return model.distanceToRegion({ x: b.cx, y: b.cy }, a) - b.r;
  const dx = Math.max(a.x - (b.x + b.w), b.x - (a.x + a.w), 0);
  const dy = Math.max(a.y - (b.y + b.h), b.y - (a.y + a.h), 0);
  return Math.hypot(dx, dy);
}

// --- the checks ----------------------------------------------------------------------------------------

const BASE_TREE = openSourceTree({ rev: BASE });

const KEPT_GAMES = [
  { id: "H03", name: "ROTA_ESTRATEGICA_STAYS", gameId: "escape-maze", component: "src/games/escape-maze/RouteStrategyGame.tsx", contract: { readiness: "explicit", entryWatchdogMs: 28_000 } },
  { id: "H04", name: "CIRCUITO_DE_MEMORIA_STAYS", gameId: "color-sequence", component: "src/games/color-sequence/MemoryCircuit3DGame.tsx", contract: { readiness: "explicit" } },
  { id: "H05", name: "CENTRAL_DE_COMANDOS_STAYS", gameId: "security-panel", component: "src/games/security-panel/SecurityPanelGame.tsx", contract: { readiness: "frame-fallback" } },
  { id: "H06", name: "JARDIM_DE_SEMENTES_STAYS", gameId: "seed-garden", component: "src/games/seed-garden/SeedGardenGame.tsx", contract: { readiness: "frame-fallback" } },
];

async function runChecks(tree) {
  const results = [];
  const check = async (id, tag, name, body) => {
    try {
      const { pass, ...detail } = await body();
      results.push({ id, tag, name, pass: Boolean(pass), detail });
    } catch (error) {
      results.push({ id, tag, name, pass: false, detail: { threw: String(error?.message ?? error).split("\n")[0] } });
    }
  };

  // --- 1–16: the platform ---------------------------------------------------------------------------

  await check("H01", "contract", "HIDDEN_OBJECTS_IS_AN_ACTIVE_GAME", () => {
    const t = platformTables(tree);
    const activity = t.activities.find((entry) => entry.gameId === STUDIO);
    const missingFrom = Object.entries(activeSets(t)).filter(([, ids]) => !ids.includes(STUDIO)).map(([table]) => table);
    const names = {
      activity: activity?.title ?? null,
      world: t.worlds.GAME_WORLDS[STUDIO]?.name ?? null,
      intro: t.intros[STUDIO]?.title ?? null,
      visual: t.visuals[STUDIO]?.visualName ?? null,
    };
    const rewardTitle = t.rewards.getRewardCopy({ gameId: STUDIO, score: 5, details: { completed: true } }).title;
    return {
      pass:
        missingFrom.length === 0 && activity?.id === STUDIO && activity?.status === "available" &&
        Object.values(names).every((value) => value === TITLE) && rewardTitle === "Estúdio explorado",
      missingFrom,
      names,
      activityStatus: activity?.status ?? null,
      rewardTitle,
    };
  });

  await check("H02", "contract", "NUMBER_TRAIL_IS_RETIRED", () => {
    const t = platformTables(tree);
    const stillListedIn = Object.entries(activeSets(t)).filter(([, ids]) => ids.includes(RETIRED)).map(([table]) => table);
    const activities = t.activities.filter((entry) => entry.id === RETIRED || entry.gameId === RETIRED).map((entry) => `${entry.id}:${entry.status}`);
    const gameFiles = listFiles(tree, `src/games/${RETIRED}`);
    const codeNaming = sourceFiles(tree).filter((file) => /\b(number-trail|NumberTrail)\b/.test(codeOnly(tree.read(file))));
    const retiredArt = ["public/illustrations/home/world-trail.webp", ...listFiles(tree, "public/illustrations/home/dioramas/trail")].filter((file) => tree.exists(file));
    return {
      pass: stillListedIn.length + activities.length + gameFiles.length + codeNaming.length + retiredArt.length === 0,
      stillListedIn,
      activities,
      gameFiles,
      codeNaming,
      retiredArtStillServed: retiredArt,
    };
  });

  for (const kept of KEPT_GAMES) {
    await check(kept.id, "preserved", kept.name, () => {
      const t = platformTables(tree);
      const b = platformTables(BASE_TREE);
      const missingFrom = Object.entries(activeSets(t)).filter(([, ids]) => !ids.includes(kept.gameId)).map(([table]) => table);
      const asAtBase = {
        entryContract: same(t.contracts[kept.gameId], kept.contract),
        literalLazyLoader: same(loaderTargets(tree)[kept.gameId] ?? [], [kept.component]),
        mapPosition: t.stages.indexOf(kept.gameId) === b.stages.indexOf(kept.gameId),
        activity: same(t.activities.find((a) => a.gameId === kept.gameId), b.activities.find((a) => a.gameId === kept.gameId)),
        worldMeta: same(t.worlds.GAME_WORLDS[kept.gameId], b.worlds.GAME_WORLDS[kept.gameId]),
        intro: same(t.intros[kept.gameId], b.intros[kept.gameId]),
        homeLayout: same(t.homeLayout[kept.gameId], b.homeLayout[kept.gameId]),
        worldVisual: same(t.visuals[kept.gameId], b.visuals[kept.gameId]),
        diorama: same(t.dioramas[kept.gameId], b.dioramas[kept.gameId]),
      };
      const folder = `src/games/${kept.gameId}/`;
      const changedFiles = folderDiff(tree, BASE_TREE, folder);
      const differs = Object.entries(asAtBase).filter(([, ok]) => !ok).map(([key]) => key);
      return {
        pass: missingFrom.length === 0 && differs.length === 0 && changedFiles.length === 0,
        missingFrom,
        differsFromBase: differs,
        gameFolderFiles: listFiles(tree, folder).length,
        gameFolderChangedSinceBase: changedFiles,
      };
    });
  }

  await check("H07", "contract", "EXACTLY_THE_FIVE_ACTIVE_GAMES", () => {
    const t = platformTables(tree);
    const expected = sorted(ACTIVE_GAMES);
    const sets = activeSets(t);
    const wrong = Object.fromEntries(Object.entries(sets).filter(([, ids]) => !same(ids, expected)));
    return {
      pass: Object.keys(wrong).length === 0 && same(t.stages, ACTIVE_GAMES),
      expected: ACTIVE_GAMES,
      tablesChecked: Object.keys(sets).length,
      wrong,
      mapOrder: t.stages,
    };
  });

  await check("H08", "contract", "STUDIO_LOADS_LAZILY_BY_LITERAL_IMPORT", async () => {
    const graph = staticGraph(tree);
    const loader = loaderTargets(tree)[STUDIO] ?? null;
    const staticGameImports = graph.node(FILES.registry).static.filter((file) => /^src\/games\/[^/]+\//.test(file));
    const studioInHome = graph.closure(APP_ROOTS, ["static"]).filter((file) => file.startsWith(DIR));
    const importers = sourceFiles(tree)
      .filter((file) => !file.startsWith(DIR) && tree.read(file).includes("hidden-objects/"))
      .flatMap((file) => {
        const node = graph.node(file);
        return [
          ...node.static.filter((target) => target.startsWith(DIR)).map(() => `${file} (static)`),
          ...node.dynamic.filter((target) => target.startsWith(DIR)).map(() => `${file} (dynamic)`),
        ];
      });
    // evaluated: registering the game loads none of its code; asking for it hands back its component
    const env = createEnvironment();
    const harness = createReact(env.createNode);
    const runtime = createModuleGraph({ tree, mocks: browserMocks(harness), globals: env.globals });
    const { GAME_REGISTRY } = runtime.require(FILES.registry);
    const loadedEarly = runtime.modules().filter((record) => record.file.startsWith(DIR)).map((record) => record.file);
    const component = await GAME_REGISTRY[STUDIO].load();
    const expected = runtime.require(FILES.game).HiddenObjectsGame;
    return {
      pass:
        same(loader, [FILES.game]) && staticGameImports.length === 0 && studioInHome.length === 0 &&
        same(importers, [`${FILES.registry} (dynamic)`]) && loadedEarly.length === 0 && typeof component === "function" && component === expected,
      loaderImports: loader,
      registryStaticGameImports: staticGameImports,
      studioModulesInHomeGraph: studioInHome,
      importersOfTheStudio: importers,
      loadedBeforeAsked: loadedEarly,
      loaderResolvesTo: component?.name ?? null,
    };
  });

  await check("H09", "contract", "STUDIO_READINESS_IS_EXPLICIT", () => {
    const t = platformTables(tree);
    const studio = openStudio(tree);
    const sceneProps = studio.sceneProps();
    const wired = sceneProps?.onReady === studio.props.onEntryReady && sceneProps?.onError === studio.props.onEntryError;
    studio.unmount();
    return {
      pass: same(t.contracts[STUDIO], { readiness: "explicit" }) && t.registry[STUDIO]?.readiness === "explicit" && wired,
      entryContract: t.contracts[STUDIO] ?? null,
      registryReadiness: t.registry[STUDIO]?.readiness ?? null,
      watchdog: "shell default (no entryWatchdogMs)",
      entryCallbacksReachTheScene: wired,
    };
  });

  await check("H10", "preserved", "GAMESCREEN_IS_GAME_AGNOSTIC", () => {
    const named = codeOnly(tree.read(FILES.screen)).match(SHELL_GAME_NAMES);
    const gameImports = staticGraph(tree).node(FILES.screen).static.filter((file) => /^src\/games\/[^/]+\//.test(file));
    return { pass: !named && gameImports.length === 0, gameNamed: named?.[0] ?? null, gameImports };
  });

  await check("H11", "preserved", "APP_SHELL_IS_GAME_AGNOSTIC", () => {
    const shell = [FILES.page, FILES.layout, FILES.entryController, FILES.entryTypes, FILES.transition, FILES.homeStage, FILES.rewardModal];
    const present = shell.filter((file) => tree.exists(file));
    const naming = present.filter((file) => SHELL_GAME_NAMES.test(codeOnly(tree.read(file))));
    const gameImports = present.flatMap((file) =>
      staticGraph(tree).node(file).static.filter((target) => /^src\/games\/[^/]+\//.test(target)).map((target) => `${file} -> ${target}`),
    );
    return { pass: present.length === shell.length && naming.length === 0 && gameImports.length === 0, shellFiles: present.length, naming, gameImports };
  });

  await check("H12", "contract", "STUDIO_TAKES_THE_TRILHAS_HOME_SLOT", () => {
    const t = platformTables(tree);
    const b = platformTables(BASE_TREE);
    const slot = (layout) => layout && { tier: layout.tier, navOrder: layout.navOrder, mobileOrder: layout.mobileOrder, desktop: layout.desktop };
    const swap = (list) => list.map((id) => (id === RETIRED ? STUDIO : id));
    const withoutArt = (layer) => Object.fromEntries(Object.entries(layer).filter(([key]) => key !== "src" && key !== "alt"));
    const dioramaShape = (config) => config && { width: config.width, height: config.height, layers: config.layers.map(withoutArt) };
    const studioLayers = t.dioramas[STUDIO]?.layers ?? [];
    const missingArt = studioLayers.map((layer) => `public${layer.src}`).filter((file) => !tree.exists(file));
    const home = renderHome(tree);
    const baseHome = cached(BASE_TREE, "home", () => renderHome(BASE_TREE));
    const order = home.worlds.map((world) => world.gameId);
    const facts = {
      slotInherited: same(slot(t.homeLayout[STUDIO]), slot(b.homeLayout[RETIRED])),
      otherSlotsUntouched: ACTIVE_GAMES.filter((id) => id !== STUDIO).every((id) => same(t.homeLayout[id], b.homeLayout[id])),
      mapPosition: same(t.stages, swap(b.stages)),
      activityPosition: same(t.activities.map((a) => a.gameId ?? a.id), swap(b.activities.map((a) => a.gameId ?? a.id))),
      dioramaFrame: same(dioramaShape(t.dioramas[STUDIO]), dioramaShape(b.dioramas[RETIRED])),
      dioramaArt: studioLayers.length > 0 && missingArt.length === 0,
      homeOrder: same(order, swap(baseHome.worlds.map((world) => world.gameId))),
      homeName: home.worlds.find((world) => world.gameId === STUDIO)?.name === TITLE,
    };
    return {
      pass: Object.values(facts).every(Boolean) && home.worlds.length === ACTIVE_GAMES.length,
      ...facts,
      slot: slot(t.homeLayout[STUDIO]) ?? null,
      homeOrder: order,
      missingArt,
    };
  });

  await check("H13", "contract", "OLD_TRILHA_HISTORY_STAYS_SAFE", () => {
    const t = platformTables(tree);
    // a device that never played the Trilha
    const fresh = renderHome(tree);
    const freshSelected = fresh.worlds.filter((world) => world.selected).map((world) => world.gameId);
    // a device whose newest result is an old Trilha result, next to a key the app must never touch
    const stored = JSON.stringify([LEGACY_RESULT]);
    const device = { [STORAGE_KEY]: stored, [FOREIGN_KEY]: FOREIGN_VALUE };
    const home = renderHome(tree, { storage: device });
    const selected = home.worlds.filter((world) => world.selected).map((world) => world.gameId);
    const homeFacts = {
      freshDeviceLoads: fresh.worlds.length === ACTIVE_GAMES.length && freshSelected.length === 1,
      legacyDeviceLoads: home.worlds.length === ACTIVE_GAMES.length && home.gameScreens === 0,
      selectsAPlayableWorld: selected.length === 1 && ACTIVE_GAMES.includes(selected[0]),
      notShownAsTheStudio: selected[0] !== STUDIO,
      noRetiredWorld: !home.worlds.some((world) => world.gameId === RETIRED),
      storageUntouchedByTheHome: home.env.store.get(STORAGE_KEY) === stored && home.env.store.get(FOREIGN_KEY) === FOREIGN_VALUE,
    };
    // the real storage: read it back, then save a new Estúdio result next to it
    const env = createEnvironment({ storage: device });
    const storage = createModuleGraph({ tree, mocks: {}, globals: env.globals }).require(FILES.storage);
    const readBack = storage.getRecentResults();
    storage.saveGameResult(resultFor("easy", 5));
    const after = JSON.parse(env.store.get(STORAGE_KEY));
    // what a stored id can reach: no loader, no entry, no activity, no Estúdio name or copy
    const meta = t.worlds.getWorldMeta(RETIRED);
    const reward = t.rewards.getRewardCopy(LEGACY_RESULT);
    const storeFacts = {
      readBackAsStored: same(readBack, [LEGACY_RESULT]),
      keptAfterANewSave: after.length === 2 && after[0].gameId === STUDIO && JSON.stringify(after[1]) === JSON.stringify(LEGACY_RESULT),
      foreignKeyKept: env.store.get(FOREIGN_KEY) === FOREIGN_VALUE,
      cannotBeOpened: !(RETIRED in t.registry) && !(RETIRED in t.contracts) && !t.activities.some((a) => a.gameId === RETIRED || a.id === RETIRED),
      lookupNotTheStudio: meta.name !== TITLE && meta.world !== t.worlds.GAME_WORLDS[STUDIO].world && reward.title !== "Estúdio explorado",
    };
    return {
      pass: Object.values(homeFacts).every(Boolean) && Object.values(storeFacts).every(Boolean),
      ...homeFacts,
      ...storeFacts,
      legacyDeviceSelects: selected,
      storedAfterSave: after.map((result) => result.gameId),
      retiredLookup: { world: meta.world, name: meta.name, rewardTitle: reward.title },
    };
  });

  await check("H14", "preserved", "NO_NEW_DEPENDENCY", () => {
    const fields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
    const mine = JSON.parse(tree.read("package.json"));
    const base = JSON.parse(BASE_TREE.read("package.json"));
    const differs = fields.filter((field) => !same(mine[field] ?? {}, base[field] ?? {}));
    const lockfileUnchanged = tree.read("package-lock.json") === BASE_TREE.read("package-lock.json");
    return { pass: differs.length === 0 && lockfileUnchanged, differs, lockfileUnchanged, dependencies: Object.keys(mine.dependencies ?? {}).length };
  });

  await check("H15", "contract", "STUDIO_HAS_NO_BABYLON_OR_WEBGL", () => {
    if (!tree.exists(FILES.game)) throw new Error(`${FILES.game} does not exist`);
    const graph = staticGraph(tree);
    const closure = graph.closure([FILES.game], ["static", "dynamic"]);
    const packages = sorted(new Set(closure.flatMap((file) => [...graph.node(file).packages.static, ...graph.node(file).packages.dynamic])));
    const unexpected = packages.filter((name) => !ALLOWED_STUDIO_PACKAGES.includes(name));
    const engines = packages.filter((name) => /^(@babylonjs\/|three$|@react-three\/)/.test(name));
    const markers = closure
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .flatMap((file) => [...codeOnly(tree.read(file)).matchAll(/\.glb\b|\.gltf\b|getContext\s*\(|webgl|Babylon|new\s+Worker\b|<canvas/gi)].map((m) => `${file}: ${m[0]}`));
    const workers = closure.filter((file) => graph.node(file).worker.length > 0);
    return {
      pass: engines.length === 0 && unexpected.length === 0 && markers.length === 0 && workers.length === 0,
      modules: closure.length,
      packages,
      unexpectedPackages: unexpected,
      engineMarkers: markers,
    };
  });

  await check("H16", "contract", "STUDIO_HAS_NO_ROUTE_OR_CIRCUIT_DOMAIN", () => {
    if (!tree.exists(FILES.game)) throw new Error(`${FILES.game} does not exist`);
    const graph = staticGraph(tree);
    const closure = graph.closure([FILES.game], ["static", "dynamic"]);
    const outside = closure.filter((file) => !file.startsWith(DIR));
    const specifiers = closure
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .flatMap((file) => [...tree.read(file).matchAll(/from\s+"([^"]+)"|import\(\s*"([^"]+)"/g)].map((m) => m[1] ?? m[2]))
      .filter((specifier) => ROUTE_OR_CIRCUIT_NAMES.test(specifier));
    return {
      pass: outside.length === 0 && specifiers.length === 0,
      closure: closure.map((file) => file.replace(DIR, "")),
      modulesOutsideTheGame: outside,
      routeOrCircuitSpecifiers: specifiers,
    };
  });

  // --- 17–23: camera, gestures, coordinates, hit testing ---------------------------------------------

  await check("H17", "contract", "CAMERA_STAYS_INSIDE_THE_ROOM", () => {
    const { camera: cam, scene } = pureModules(tree);
    const W = scene.SCENE_WIDTH;
    const H = scene.SCENE_HEIGHT;
    const inside = (rect) => rect.x >= -EPS && rect.y >= -EPS && rect.x + rect.w <= W + EPS && rect.y + rect.h <= H + EPS;
    const random = lcg(0x5eed);
    const range = (min, max) => min + (max - min) * random();
    const escapes = [];
    let samples = 0;
    const hold = (camera, viewport, label) => {
      samples += 1;
      const ok =
        Number.isFinite(camera.x) && Number.isFinite(camera.y) && inside(cam.visibleRect(camera, viewport)) &&
        camera.zoom >= cam.MIN_ZOOM - EPS && camera.zoom <= cam.maxZoom(viewport) + EPS;
      if (!ok && escapes.length < 5) escapes.push({ viewport: viewport.name, label, camera });
    };
    for (const viewport of VIEWPORTS) {
      for (let i = 0; i < 250; i += 1) {
        const clamped = cam.clampCamera({ x: range(-3000, 6200), y: range(-3000, 4600), zoom: range(0.05, 12) }, viewport);
        hold(clamped, viewport, "clampCamera");
        hold(cam.panBy(clamped, range(-6000, 6000), range(-6000, 6000), viewport), viewport, "panBy");
        const focal = { x: range(0, viewport.width), y: range(0, viewport.height) };
        hold(cam.zoomAt(clamped, [0.001, 0.5, 1.7, 1000][i % 4], focal, viewport), viewport, "zoomAt");
        const current = { centroid: { x: range(-500, viewport.width + 500), y: range(-500, viewport.height + 500) }, distance: range(1, 2000) };
        hold(cam.pinchCamera(clamped, { centroid: focal, distance: range(10, 300) }, current, viewport), viewport, "pinchCamera");
        const other = cam.clampCamera({ x: range(0, W), y: range(0, H), zoom: range(1, 4) }, viewport);
        hold(cam.interpolateCamera(clamped, other, cam.easeInOut(random())), viewport, "glide frame");
        hold(cam.revealCamera({ x: range(0, W - 50), y: range(0, H - 50), w: range(10, 400), h: range(10, 400) }, viewport), viewport, "revealCamera");
        hold(cam.frameCircle({ x: range(0, W), y: range(0, H) }, range(20, 600), clamped, viewport), viewport, "frameCircle");
      }
      for (const station of scene.SCENE_STATIONS) hold(cam.stationCamera(station.id, viewport), viewport, `station ${station.id}`);
      hold(cam.initialCamera(viewport), viewport, "initial");
    }
    // the controller, pushed far past every wall by drags, the wheel and the arrow keys
    const rig = openRig(tree);
    const viewport = { ...DESKTOP, ...rig.size() };
    const centre = rig.centre();
    for (const [dx, dy] of [[4000, 0], [-8000, 0], [0, 4000], [0, -8000], [3000, 3000], [-3000, -3000]]) {
      rig.drag(centre, { x: centre.x + dx, y: centre.y + dy }, { steps: 6 });
      rig.frame();
      hold(rig.camera(), viewport, `drag ${dx},${dy}`);
    }
    for (let i = 0; i < 40; i += 1) rig.wheel(rig.client({ x: 4, y: 4 }), -400);
    hold(rig.camera(), viewport, "wheel in at a corner");
    for (let i = 0; i < 40; i += 1) rig.wheel(rig.client({ x: viewport.width - 4, y: viewport.height - 4 }), 400);
    hold(rig.camera(), viewport, "wheel out at the other corner");
    const zoomedOut = Math.abs(rig.camera().zoom - cam.MIN_ZOOM) < EPS;
    for (const key of ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"]) {
      for (let i = 0; i < 30; i += 1) rig.key(key, { shiftKey: true });
      hold(rig.camera(), viewport, key);
    }
    rig.controller.destroy();
    return { pass: escapes.length === 0 && zoomedOut, samples, viewports: VIEWPORTS.length, escapes, wheelOutReachesCover: zoomedOut };
  });

  await check("H18", "contract", "ZOOM_IS_FOCAL_AND_BOUNDED", () => {
    const { camera: cam } = pureModules(tree);
    const constants = { MIN_ZOOM: cam.MIN_ZOOM, DEFAULT_ZOOM: cam.DEFAULT_ZOOM, MAX_ZOOM_FLOOR: cam.MAX_ZOOM_FLOOR, MAX_ZOOM_CEILING: cam.MAX_ZOOM_CEILING, ZOOM_STEP: cam.ZOOM_STEP };
    const named = cam.MIN_ZOOM === 1 && cam.DEFAULT_ZOOM === 1 && cam.MAX_ZOOM_FLOOR >= 2 && cam.MAX_ZOOM_CEILING >= cam.MAX_ZOOM_FLOOR && cam.ZOOM_STEP > 1;
    const maxZooms = VIEWPORTS.map((viewport) => Number(cam.maxZoom(viewport).toFixed(3)));
    const bounded = maxZooms.every((zoom) => zoom >= cam.MAX_ZOOM_FLOOR && zoom <= cam.MAX_ZOOM_CEILING);
    const startsAtDefault = VIEWPORTS.every((viewport) => cam.initialCamera(viewport).zoom === cam.DEFAULT_ZOOM);
    // the scene point under the cursor (or the fingers) stays under it, away from the walls
    let drift = 0;
    for (const viewport of VIEWPORTS) {
      const start = cam.clampCamera({ x: 1600, y: 800, zoom: 1.6 }, viewport);
      for (const focal of [{ x: viewport.width * 0.3, y: viewport.height * 0.4 }, { x: viewport.width * 0.7, y: viewport.height * 0.6 }]) {
        const anchor = cam.viewportToScene(focal, start, viewport);
        const zoomed = cam.zoomAt(start, 1.2, focal, viewport);
        const after = cam.viewportToScene(focal, zoomed, viewport);
        drift = Math.max(drift, Math.hypot(after.x - anchor.x, after.y - anchor.y));
        const moved = { x: focal.x + 30, y: focal.y - 20 };
        const pinched = cam.pinchCamera(start, { centroid: focal, distance: 100 }, { centroid: moved, distance: 120 }, viewport);
        const under = cam.viewportToScene(moved, pinched, viewport);
        drift = Math.max(drift, Math.hypot(under.x - anchor.x, under.y - anchor.y));
      }
    }
    const wheel = {
      linesIn: cam.wheelZoomFactor(-3, 1, false, 800),
      pixelsIn: cam.wheelZoomFactor(-100, 0, false, 800),
      pixelsOut: cam.wheelZoomFactor(100, 0, false, 800),
      trackpadPinchIn: cam.wheelZoomFactor(-10, 0, true, 800),
      trackpadSameDeltaAsWheel: cam.wheelZoomFactor(-10, 0, false, 800),
      hugeIn: cam.wheelZoomFactor(-1e6, 0, false, 800),
      hugeOut: cam.wheelZoomFactor(1e6, 0, false, 800),
    };
    const wheelOk =
      wheel.linesIn > 1 && wheel.pixelsIn > 1 && wheel.pixelsOut < 1 && wheel.trackpadPinchIn > wheel.trackpadSameDeltaAsWheel &&
      wheel.hugeIn === cam.WHEEL_STEP_MAX && wheel.hugeOut === cam.WHEEL_STEP_MIN;
    // the controller: the wheel zooms at the cursor; + and − zoom at the centre by ZOOM_STEP
    const rig = openRig(tree);
    const size = rig.size();
    rig.controller.zoomBy(1.6);
    const focal = { x: size.width * 0.35, y: size.height * 0.45 };
    const before = cam.viewportToScene(focal, rig.camera(), size);
    rig.wheel(rig.client(focal), -120);
    const after = cam.viewportToScene(focal, rig.camera(), size);
    const wheelDrift = Math.hypot(after.x - before.x, after.y - before.y);
    const middle = { x: size.width / 2, y: size.height / 2 };
    const centreBefore = cam.viewportToScene(middle, rig.camera(), size);
    const zoomBefore = rig.camera().zoom;
    rig.controller.zoomBy(1 / cam.ZOOM_STEP);
    const centreAfter = cam.viewportToScene(middle, rig.camera(), size);
    const buttonDrift = Math.hypot(centreAfter.x - centreBefore.x, centreAfter.y - centreBefore.y);
    const stepRatio = zoomBefore / rig.camera().zoom;
    rig.controller.destroy();
    return {
      pass: named && bounded && startsAtDefault && drift < 1e-6 && wheelOk && wheelDrift < 1e-6 && buttonDrift < 1e-6 && Math.abs(stepRatio - cam.ZOOM_STEP) < 1e-9,
      constants,
      maxZoomPerViewport: maxZooms,
      focalDriftSu: drift,
      controllerWheelDriftSu: wheelDrift,
      controllerButtonDriftSu: buttonDrift,
      wheel,
    };
  });

  await check("H19", "contract", "CLIENT_TO_SCENE_PIPELINE", () => {
    const { camera: cam } = pureModules(tree);
    const random = lcg(42);
    let roundTrip = 0;
    let transform = 0;
    for (const viewport of VIEWPORTS) {
      for (let i = 0; i < 60; i += 1) {
        const camera = cam.clampCamera({ x: random() * 3200, y: random() * 1600, zoom: 1 + random() * 3 }, viewport);
        const rect = { left: random() * 300, top: random() * 200 };
        const client = { x: rect.left + random() * viewport.width, y: rect.top + random() * viewport.height };
        const local = cam.clientToViewport(client.x, client.y, rect);
        const point = cam.viewportToScene(local, camera, viewport);
        const back = cam.sceneToViewport(point, camera, viewport);
        roundTrip = Math.max(roundTrip, Math.hypot(back.x - local.x, back.y - local.y));
        const { tx, ty, scale } = cam.worldTransform(camera, viewport);
        transform = Math.max(transform, Math.hypot(tx + point.x * scale - local.x, ty + point.y * scale - local.y));
      }
    }
    // the controller hands React the scene point under the pointer, wherever the viewport sits on the page
    const rig = openRig(tree);
    const cases = [];
    const probe = (label) => {
      const local = { x: rig.size().width * 0.62, y: rig.size().height * 0.37 };
      const expected = cam.viewportToScene(local, rig.camera(), rig.size());
      const count = rig.taps.length;
      rig.tap(rig.client(local));
      const tap = rig.taps[count];
      cases.push({
        label,
        errorSu: tap ? Math.hypot(tap.point.x - expected.x, tap.point.y - expected.y) : null,
        scaleError: tap ? Math.abs(tap.scale - cam.scaleOf(rig.camera(), rig.size())) : null,
      });
    };
    probe("initial view");
    rig.controller.zoomBy(1.7);
    rig.frame();
    probe("zoomed");
    rig.drag(rig.centre(), { x: rig.centre().x - 180, y: rig.centre().y + 40 }, { steps: 6 });
    rig.frame();
    probe("panned");
    rig.viewport.rect = { ...rig.viewport.rect, left: 140, top: 230 };
    probe("viewport moved on the page");
    rig.controller.destroy();
    const ok = cases.every((c) => c.errorSu !== null && c.errorSu < 1e-6 && c.scaleError < 1e-9);
    return { pass: roundTrip < 1e-6 && transform < 1e-6 && ok, roundTripPx: roundTrip, worldTransformPx: transform, controller: cases };
  });

  await check("H20", "contract", "TAP_THRESHOLDS_ARE_NAMED_AND_HELD", () => {
    const { gesture: g } = pureModules(tree);
    const run = gestureRunner(g);
    const constants = { TAP_SLOP_TOUCH_PX: g.TAP_SLOP_TOUCH_PX, TAP_SLOP_MOUSE_PX: g.TAP_SLOP_MOUSE_PX, TAP_MAX_DURATION_MS: g.TAP_MAX_DURATION_MS };
    const press = (pointerType, dx, upAt, { moving = false, button = 0 } = {}) =>
      run(
        [
          sample("down", 1, 100, 100, 0, pointerType, button),
          sample("move", 1, 100 + dx, 100, Math.min(50, upAt), pointerType),
          sample("up", 1, 100 + dx, 100, upAt, pointerType),
        ],
        moving,
      );
    const taps = (outcome) => outcome.taps.length;
    const cases = {
      mouseAtSlop: taps(press("mouse", g.TAP_SLOP_MOUSE_PX, 80)) === 1,
      mousePastSlop: taps(press("mouse", g.TAP_SLOP_MOUSE_PX + 0.5, 80)) === 0,
      touchAtSlop: taps(press("touch", g.TAP_SLOP_TOUCH_PX, 80)) === 1,
      touchPastSlop: taps(press("touch", g.TAP_SLOP_TOUCH_PX + 0.5, 80)) === 0,
      penUsesTheTouchSlop: taps(press("pen", g.TAP_SLOP_TOUCH_PX, 80)) === 1,
      atMaxDuration: taps(press("touch", 0, g.TAP_MAX_DURATION_MS)) === 1,
      pastMaxDuration: taps(press("touch", 0, g.TAP_MAX_DURATION_MS + 1)) === 0,
      tapLandsWhereThePointerWentDown: (() => {
        const [tap] = press("touch", 5, 80).taps;
        return tap?.x === 100 && tap?.y === 100;
      })(),
      secondaryMouseButtonIgnored: (() => {
        const outcome = run([sample("down", 1, 100, 100, 0, "mouse", 2), sample("up", 1, 100, 100, 40, "mouse", 2)]);
        return outcome.taps.length === 0 && outcome.captures.length === 0 && outcome.state.phase === "idle";
      })(),
    };
    // the controller holds the same line on real Pointer Events
    const rig = openRig(tree);
    const viaController = (pointerType, dx) => {
      const before = rig.taps.length;
      const from = rig.centre();
      rig.pointer("pointerdown", { pointerId: 3, clientX: from.x, clientY: from.y, pointerType, button: 0 });
      rig.pointer("pointermove", { pointerId: 3, clientX: from.x + dx, clientY: from.y, pointerType });
      rig.pointer("pointerup", { pointerId: 3, clientX: from.x + dx, clientY: from.y, pointerType, button: 0 });
      rig.settle();
      return rig.taps.length - before;
    };
    const controller = {
      mouse5: viaController("mouse", 5) === 1,
      mouse7: viaController("mouse", 7) === 0,
      touch13: viaController("touch", 13) === 1,
      touch15: viaController("touch", 15) === 0,
    };
    rig.controller.destroy();
    const failed = [...Object.entries(cases), ...Object.entries(controller)].filter(([, ok]) => !ok).map(([name]) => name);
    return {
      pass: g.TAP_SLOP_TOUCH_PX === 14 && g.TAP_SLOP_MOUSE_PX === 6 && g.TAP_MAX_DURATION_MS === 1000 && failed.length === 0,
      constants,
      failed,
    };
  });

  await check("H21", "contract", "DRAG_NEVER_SELECTS", () => {
    const { gesture: g, model } = pureModules(tree);
    const run = gestureRunner(g);
    const pure = {
      dragAndRelease: run([sample("down", 1, 0, 0, 0, "mouse"), sample("move", 1, 40, 0, 30, "mouse"), sample("up", 1, 40, 0, 60, "mouse")]).taps.length === 0,
      dragAwayAndBack: run([sample("down", 1, 0, 0, 0), sample("move", 1, 30, 0, 30), sample("move", 1, 0, 0, 60), sample("up", 1, 0, 0, 90)]).taps.length === 0,
      pressThatCatchesAGlide: run([sample("down", 1, 0, 0, 0), sample("up", 1, 0, 0, 40)], true).taps.length === 0,
    };
    // the controller: a drag that starts on a target pans and selects nothing
    const rig = openRig(tree);
    const lupa = rig.clientOf(model.regionCenter(model.targetById("lupa").region));
    const before = rig.camera();
    rig.drag(lupa, { x: lupa.x + 60, y: lupa.y + 10 }, { steps: 6 });
    rig.settle();
    const controllerDrag = rig.taps.length === 0 && rig.camera().x !== before.x;
    // a press that stops a gliding camera stops it, and is never a tap
    rig.controller.goToStation("janela");
    rig.frame(2);
    const gliding = rig.env.clock.pending().frames > 0;
    const caughtAt = rig.camera();
    rig.tap(rig.centre(), { pointerType: "touch" });
    rig.settle();
    const caught = gliding && rig.taps.length === 0 && nearCamera(rig.camera(), caughtAt);
    rig.controller.destroy();
    // the game: a drag over the Lupa in a real session finds nothing; the same press without the drag does
    const studio = openStudio(tree);
    studio.start("easy");
    const p = studio.targetClient("lupa");
    studio.drag(p, { x: p.x + 50, y: p.y + 8 }, { steps: 6 });
    studio.settle();
    const gameDrag = studio.found().length === 0 && studio.status() === "playing";
    studio.tapAt(studio.targetClient("lupa"));
    const tapFinds = same(studio.found(), ["Lupa"]);
    studio.unmount();
    const failed = Object.entries({ ...pure, controllerDrag, caught, gameDrag, tapFinds }).filter(([, ok]) => !ok).map(([name]) => name);
    return { pass: failed.length === 0, failed, checked: ["pure recogniser", "controller", "game session"] };
  });

  await check("H22", "contract", "PINCH_NEVER_SELECTS", () => {
    const { gesture: g, model } = pureModules(tree);
    const run = gestureRunner(g);
    const pure = {
      secondPointerStartsAPinch: (() => {
        const outcome = run([sample("down", 1, 0, 0, 0), sample("down", 2, 20, 0, 10)]);
        return outcome.state.phase === "pinch" && outcome.effects[0]?.kind === "pinch-start" && same(outcome.captures, [1, 2]);
      })(),
      liftOneThenTheOther: run([sample("down", 1, 0, 0, 0), sample("down", 2, 20, 0, 10), sample("move", 2, 60, 0, 30), sample("up", 2, 60, 0, 50), sample("up", 1, 0, 0, 70)]).taps.length === 0,
      twoFingerTapWithoutMoving: run([sample("down", 1, 0, 0, 0), sample("down", 2, 20, 0, 10), sample("up", 1, 0, 0, 40), sample("up", 2, 20, 0, 60)]).taps.length === 0,
      thirdPointerIgnored: run([sample("down", 1, 0, 0, 0), sample("down", 2, 20, 0, 10), sample("down", 3, 40, 0, 20)]).state.pointers.length === 2,
      cancelSelectsNothing: (() => {
        const outcome = run([sample("down", 1, 0, 0, 0), ["cancel", { id: 1 }]]);
        return outcome.taps.length === 0 && outcome.state.phase === "idle" && outcome.effects.some((effect) => effect.kind === "end");
      })(),
    };
    // the controller: two fingers on the Lupa zoom; pointercancel and a lost capture select nothing
    const rig = openRig(tree);
    const lupa = rig.clientOf(model.regionCenter(model.targetById("lupa").region));
    const zoomBefore = rig.camera().zoom;
    const at = (distance, sign) => ({ clientX: lupa.x + (sign * distance) / 2, clientY: lupa.y });
    rig.pointer("pointerdown", { pointerId: 1, pointerType: "touch", ...at(16, -1) });
    rig.pointer("pointerdown", { pointerId: 2, pointerType: "touch", ...at(16, 1) });
    for (let i = 1; i <= 6; i += 1) {
      rig.pointer("pointermove", { pointerId: 2, pointerType: "touch", ...at(16 + i * 20, 1) });
      rig.pointer("pointermove", { pointerId: 1, pointerType: "touch", ...at(16 + i * 20, -1) });
      rig.frame();
    }
    rig.pointer("pointerup", { pointerId: 2, pointerType: "touch", ...at(136, 1) });
    rig.pointer("pointerup", { pointerId: 1, pointerType: "touch", ...at(136, -1) });
    rig.settle();
    const controllerPinch = rig.taps.length === 0 && rig.camera().zoom > zoomBefore;
    for (const type of ["pointercancel", "lostpointercapture"]) {
      rig.pointer("pointerdown", { pointerId: 5, pointerType: "touch", clientX: lupa.x, clientY: lupa.y });
      rig.pointer(type, { pointerId: 5, pointerType: "touch", clientX: lupa.x, clientY: lupa.y });
      rig.pointer("pointerup", { pointerId: 5, pointerType: "touch", clientX: lupa.x, clientY: lupa.y });
    }
    const controllerAborts = rig.taps.length === 0;
    rig.controller.destroy();
    // the game: a pinch on the Lupa finds nothing
    const studio = openStudio(tree);
    studio.start("easy");
    studio.pinch(studio.targetClient("lupa"));
    studio.settle();
    const gamePinch = studio.found().length === 0 && studio.camera().zoom > 1;
    studio.unmount();
    const failed = Object.entries({ ...pure, controllerPinch, controllerAborts, gamePinch }).filter(([, ok]) => !ok).map(([name]) => name);
    return { pass: failed.length === 0, failed, checked: ["pure recogniser", "controller", "game session"] };
  });

  await check("H23", "contract", "HIT_TEST_USES_SCENE_GEOMETRY", () => {
    const { model, scene } = pureModules(tree);
    const all = scene.HIDDEN_OBJECTS.map((target) => target.id);
    const failures = [];
    for (const target of scene.HIDDEN_OBJECTS) {
      const centre = model.regionCenter(target.region);
      if (model.hitTest(centre, all, 1, 0) !== target.id) failures.push(`${target.id}: centre`);
      const b = model.regionBounds(target.region);
      const edge = target.region.kind === "circle" ? { x: target.region.cx + target.region.r, y: target.region.cy } : { x: b.x + b.w, y: b.y + b.h / 2 };
      if (model.hitTest({ x: edge.x + 9, y: edge.y }, [target.id], 1, 10) !== target.id) failures.push(`${target.id}: 9 su off with 10 px reach`);
      if (model.hitTest({ x: edge.x + 11, y: edge.y }, [target.id], 1, 10) !== null) failures.push(`${target.id}: 11 su off with 10 px reach`);
      if (model.hitTest({ x: edge.x + 19, y: edge.y }, [target.id], 0.5, 10) !== target.id) failures.push(`${target.id}: px → su at 0.5 px/su`);
      if (model.hitTest(centre, all.filter((id) => id !== target.id), 1, 0) === target.id) failures.push(`${target.id}: selected while not listed`);
    }
    const between = [
      model.hitTest({ x: 2660, y: 620 }, ["barco", "camera"], 1, 100),
      model.hitTest({ x: 2712, y: 600 }, ["barco", "camera"], 1, 100),
    ];
    const tolerances = DIFFICULTIES.map((d) => ({ difficulty: d, touch: model.tolerancePxFor(d, "touch"), pen: model.tolerancePxFor(d, "pen"), mouse: model.tolerancePxFor(d, "mouse") }));
    const tolerancesOk = tolerances.every((t) => t.touch > t.mouse && t.pen === t.touch);
    const start = model.sessionReducer(model.createSession("easy"), { type: "start" });
    const missed = model.sessionReducer(start, { type: "tap", point: { x: 5, y: 5 }, scale: 1, pointerType: "mouse" });
    const missRecordsNothing = missed.lastEvent?.kind === "miss" && missed.foundIds.length === 0 && same(sorted(Object.keys(missed)), sorted(Object.keys(start)));
    const hit = model.sessionReducer(start, tapOn(model, "lupa"));
    return {
      pass: failures.length === 0 && same(between, ["barco", "camera"]) && tolerancesOk && missRecordsNothing && same(hit.foundIds, ["lupa"]),
      failures,
      nearestBetweenTwo: between,
      tolerances,
      missRecordsNothing,
    };
  });

  // --- 24–27: targets, lists, tiers, fairness ------------------------------------------------------

  await check("H24", "contract", "EXACTLY_TEN_TARGETS", () => {
    const { scene, model } = pureModules(tree);
    const pool = scene.HIDDEN_OBJECTS;
    const labels = pool.map((target) => target.label);
    const regionValid = (region) =>
      region.kind === "circle" ? region.r > 0 : region.kind === "rect" ? region.w > 0 && region.h > 0 : false;
    const malformed = pool
      .filter(
        (t) =>
          !same(sorted(Object.keys(t)), TARGET_FIELDS) || !t.label || !normalizeText(t.accessibleLabel).includes(normalizeText(t.label)) ||
          !["A", "B", "C"].includes(t.tier) || !scene.SCENE_STATIONS.some((station) => station.id === t.station) || !t.hintRegion || !regionValid(t.region),
      )
      .map((t) => t.id);
    const ambiguous = labels.filter((label) => AMBIGUOUS_LABELS.test(label));
    return {
      pass:
        pool.length === 10 && new Set(pool.map((t) => t.id)).size === 10 && new Set(labels).size === 10 &&
        same(sorted(labels), sorted(PREFERRED_LABELS)) && malformed.length === 0 && ambiguous.length === 0 &&
        pool.every((t) => model.targetById(t.id) === t),
      count: pool.length,
      labels,
      malformed,
      ambiguous,
    };
  });

  await check("H25", "contract", "DIFFICULTY_LISTS_ARE_5_6_8_AND_FIXED", () => {
    const { scene, model } = pureModules(tree);
    const ids = new Set(scene.HIDDEN_OBJECTS.map((target) => target.id));
    const expected = { easy: [5, "picture", "Fácil"], medium: [6, "silhouette", "Médio"], hard: [8, "word", "Difícil"] };
    const lists = Object.fromEntries(DIFFICULTIES.map((d) => [d, [...(scene.DIFFICULTY_PRESETS[d]?.targets ?? [])]]));
    const wrong = DIFFICULTIES.filter((d) => {
      const preset = scene.DIFFICULTY_PRESETS[d];
      const [size, style, label] = expected[d];
      return !preset || preset.targets.length !== size || new Set(preset.targets).size !== size || preset.targets.some((id) => !ids.has(id)) || preset.listStyle !== style || preset.label !== label;
    });
    const fixed = DIFFICULTIES.every((d) => {
      const a = model.sessionReducer(model.createSession(d), { type: "start" });
      const b = model.sessionReducer(model.createSession(d), { type: "start" });
      return same(model.pendingTargets(a), model.pendingTargets(b)) && same(model.pendingTargets(a), lists[d]);
    });
    const code = listFiles(tree, DIR).filter((file) => /\.(ts|tsx)$/.test(file)).map((file) => [file, codeOnly(tree.read(file))]);
    const chance = code.filter(([, text]) => /Math\.random|getRandomValues|randomUUID/.test(text)).map(([file]) => file);
    const clocks = code.filter(([, text]) => /setInterval|Date\.now|new Date\(/.test(text)).map(([file]) => file);
    return {
      pass: wrong.length === 0 && fixed && chance.length === 0 && clocks.length === 0 && same(scene.DIFFICULTY_ORDER, DIFFICULTIES),
      lists,
      wrong,
      randomness: chance,
      clockDriven: clocks,
    };
  });

  await check("H26", "contract", "TIER_COMPOSITION", () => {
    const { scene, model } = pureModules(tree);
    const count = (list) => list.reduce((acc, id) => ({ ...acc, [model.targetById(id).tier]: acc[model.targetById(id).tier] + 1 }), { A: 0, B: 0, C: 0 });
    const actual = {
      pool: count(scene.HIDDEN_OBJECTS.map((target) => target.id)),
      ...Object.fromEntries(DIFFICULTIES.map((d) => [d, count(scene.DIFFICULTY_PRESETS[d].targets)])),
    };
    const expected = { pool: { A: 4, B: 3, C: 3 }, easy: { A: 4, B: 1, C: 0 }, medium: { A: 2, B: 3, C: 1 }, hard: { A: 2, B: 3, C: 3 } };
    return {
      pass: same(actual, expected),
      ...actual,
      deviation: "Difícil is 2A+3B+3C: the preferred 1A+4B+3C needs four B beside Fácil's four A and Difícil's three C — 4 + 4 + 3 = 11 > 10",
    };
  });

  await check("H27", "contract", "FAIRNESS_GEOMETRY", () => {
    const { scene, camera: cam, model } = pureModules(tree);
    const W = scene.SCENE_WIDTH;
    const H = scene.SCENE_HEIGHT;
    const pool = scene.HIDDEN_OBJECTS;
    const box = (target) => model.regionBounds(target.region);
    const problems = [];
    // F1 inside the room, clear of the safe margins (nothing pinned under the corner controls at a wall)
    for (const t of pool) {
      const b = box(t);
      if (b.x < scene.SAFE_MARGIN_X || b.y < scene.SAFE_MARGIN_Y || b.x + b.w > W - scene.SAFE_MARGIN_X || b.y + b.h > H - scene.SAFE_MARGIN_Y) problems.push(`F1 ${t.id} outside the safe area`);
    }
    // F2 one unambiguous exemplar each: no two regions overlap or crowd each other
    let minGap = Infinity;
    for (let i = 0; i < pool.length; i += 1) {
      for (let j = i + 1; j < pool.length; j += 1) {
        const gap = regionGap(model, pool[i].region, pool[j].region);
        minGap = Math.min(minGap, gap);
        if (gap < MIN_TARGET_GAP_SU) problems.push(`F2 ${pool[i].id}/${pool[j].id} ${gap.toFixed(1)} su apart`);
      }
    }
    // F3 stations: each target in its station's stretch, each station ≥ 3, each list visits all three
    for (const t of pool) {
      const c = model.regionCenter(t.region);
      const station = scene.SCENE_STATIONS.find((s) => c.x >= s.span.x0 && c.x < s.span.x1);
      if (station?.id !== t.station) problems.push(`F3 ${t.id} is not in ${t.station}`);
    }
    for (const s of scene.SCENE_STATIONS) if (pool.filter((t) => t.station === s.id).length < 3) problems.push(`F3 ${s.id} holds fewer than 3`);
    for (const d of DIFFICULTIES) {
      if (new Set(scene.DIFFICULTY_PRESETS[d].targets.map((id) => model.targetById(id).station)).size !== scene.SCENE_STATIONS.length) problems.push(`F3 ${d} skips a station`);
    }
    // F4 never covered: paint in front of the plate, at its furthest parallax drift plus clearance, misses every target
    const order = scene.SCENE_LAYERS.map((layer) => layer.id);
    const plate = order.indexOf("plate");
    if (!(order.indexOf("back") < plate && plate >= 0)) problems.push(`F4 layer order ${order.join(",")}`);
    for (const layer of scene.SCENE_LAYERS.slice(plate + 1)) {
      const drift = cam.maxParallaxOffset(layer.parallax);
      for (const paint of layer.opaque) {
        const grown = {
          x: paint.x - drift.x - FRONT_CLEARANCE_SU,
          y: paint.y - drift.y - FRONT_CLEARANCE_SU,
          w: paint.w + 2 * (drift.x + FRONT_CLEARANCE_SU),
          h: paint.h + 2 * (drift.y + FRONT_CLEARANCE_SU),
        };
        for (const t of pool) if (intersects(grown, box(t))) problems.push(`F4 ${layer.id} paint can cover ${t.id}`);
      }
    }
    // F5 reachable: on every viewport the camera can frame every target fully, clear of the HUD
    for (const viewport of VIEWPORTS) {
      for (const t of pool) {
        const b = box(t);
        const camera = cam.revealCamera(b, viewport);
        const a = cam.sceneToViewport({ x: b.x, y: b.y }, camera, viewport);
        const z = cam.sceneToViewport({ x: b.x + b.w, y: b.y + b.h }, camera, viewport);
        const screen = { x: a.x, y: a.y, w: z.x - a.x, h: z.y - a.y };
        if (screen.x < -EPS || screen.y < -EPS || screen.x + screen.w > viewport.width + EPS || screen.y + screen.h > viewport.height + EPS) problems.push(`F5 ${t.id} not fully on screen (${viewport.name})`);
        for (const hud of hudRects(viewport)) if (intersects(screen, hud)) problems.push(`F5 ${t.id} under the ${hud.name} (${viewport.name})`);
      }
    }
    // F6 not microscopic on the reference phone; enough zoom everywhere to inspect without pixel hunting
    const cover = cam.coverScale(REFERENCE_PHONE);
    const topScale = cover * cam.maxZoom(REFERENCE_PHONE);
    const sizes = pool.map((t) => {
      const b = box(t);
      const reach = DIFFICULTIES.filter((d) => scene.DIFFICULTY_PRESETS[d].targets.includes(t.id)).map((d) => model.tolerancePxFor(d, "touch"));
      return {
        id: t.id,
        atCoverPx: Math.max(b.w, b.h) * cover,
        effectiveAtFullZoomPx: Math.min(b.w, b.h) * topScale + 2 * (reach.length ? Math.min(...reach) : 0),
      };
    });
    for (const s of sizes) {
      if (s.atCoverPx < MIN_VISIBLE_AT_COVER_PX) problems.push(`F6 ${s.id} is ${s.atCoverPx.toFixed(1)} px at cover on the phone`);
      if (s.effectiveAtFullZoomPx < MIN_EFFECTIVE_TOUCH_PX) problems.push(`F6 ${s.id} is ${s.effectiveAtFullZoomPx.toFixed(1)} px at full zoom on the phone`);
    }
    const smallestSide = Math.min(...pool.map((t) => Math.min(box(t).w, box(t).h)));
    for (const viewport of VIEWPORTS) {
      const best = smallestSide * cam.coverScale(viewport) * cam.maxZoom(viewport);
      if (best < MIN_EFFECTIVE_TOUCH_PX) problems.push(`F6 zoom tops out at ${best.toFixed(1)} px for the smallest target (${viewport.name})`);
    }
    // F7 never colour alone
    for (const t of pool) if (COLOUR_WORDS.test(t.label) || COLOUR_WORDS.test(t.accessibleLabel)) problems.push(`F7 ${t.id} named by a colour`);
    return {
      pass: problems.length === 0,
      problems: problems.slice(0, 10),
      problemCount: problems.length,
      minGapSu: Math.round(minGap),
      viewports: VIEWPORTS.map((viewport) => viewport.name),
      phonePx: sizes.map((s) => `${s.id} ${Math.round(s.atCoverPx)}→${Math.round(s.effectiveAtFullZoomPx)}`),
    };
  });

  // --- 28–35: the session in the real game -----------------------------------------------------------

  await check("H28", "contract", "HINTS_CLIMB_ON_REQUEST_AND_COST_NOTHING", () => {
    const { model, scene, camera: cam } = pureModules(tree);
    const R = model.sessionReducer;
    let s = R(model.createSession("easy"), { type: "start" });
    const ladder = [];
    for (let i = 0; i < 4; i += 1) {
      s = R(s, { type: "hint" });
      ladder.push(`${s.hintTarget}:${s.hintStage}`);
    }
    const climbs = same(ladder, ["lupa:1", "lupa:2", "lupa:3", "lupa:3"]) && s.hintSeq === 4 && s.foundIds.length === 0;
    s = R(R(s, { type: "focus-target", targetId: "barco" }), { type: "hint" });
    const perObject = s.hintTarget === "barco" && s.hintStage === 1;
    const afterFind = R(s, tapOn(model, "barco"));
    const findClears = afterFind.hintTarget === null && afterFind.hintStage === 0 && same(afterFind.foundIds, ["barco"]);
    // the halo: stage 2 holds the whole object without centring on it; stage 3 sits on it; stages 0–1 have none
    const haloProblems = [];
    for (const d of DIFFICULTIES) {
      for (const id of scene.DIFFICULTY_PRESETS[d].targets) {
        const t = model.targetById(id);
        const c = model.regionCenter(t.region);
        const pool = model.hintHalo(id, d, 2);
        const reveal = model.hintHalo(id, d, 3);
        const b = model.regionBounds(t.region);
        const holds =
          t.region.kind === "circle"
            ? Math.hypot(t.region.cx - pool.cx, t.region.cy - pool.cy) + t.region.r <= pool.r + EPS
            : [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]].every(([x, y]) => Math.hypot(x - pool.cx, y - pool.cy) <= pool.r + EPS);
        const offCentre = Math.hypot(pool.cx - c.x, pool.cy - c.y) > 1;
        const onIt = Math.hypot(reveal.cx - c.x, reveal.cy - c.y) < EPS && reveal.r > model.regionRadius(t.region);
        if (!holds || !offCentre || !onIt || model.hintHalo(id, d, 1) !== null || model.hintHalo(id, d, 0) !== null) haloProblems.push(`${d}/${id}`);
      }
    }
    // the game: nothing appears by itself; each press climbs and moves the camera only then
    const studio = openStudio(tree);
    studio.start("easy");
    studio.frames(300);
    const nothingByItself = studio.banner() === null && studio.halo() === null;
    studio.goTo("janela");
    const size = studio.size();
    const lupa = model.targetById("lupa");
    studio.clickHint();
    studio.settle();
    const one = { banner: studio.banner(), station: nearCamera(studio.camera(), cam.stationCamera("mesa", size)), halo: studio.halo(), next: studio.hintLabel() };
    studio.clickHint();
    studio.settle();
    const expected2 = model.hintHalo("lupa", "easy", 2);
    const halo2 = studio.halo();
    const two = {
      banner: studio.banner(),
      halo: halo2 && halo2.kind === "hint" && Math.abs(halo2.cx - expected2.cx) < 1e-6 && Math.abs(halo2.r - expected2.r) < 1e-6,
      onScreen: cam.circleVisible({ x: expected2.cx, y: expected2.cy }, expected2.r, studio.camera(), size),
      next: studio.hintLabel(),
    };
    studio.clickHint();
    studio.settle();
    const three = {
      banner: studio.banner(),
      halo: studio.halo()?.kind === "reveal",
      framed: nearCamera(studio.camera(), cam.revealCamera(model.regionBounds(lupa.region), size)),
      next: studio.hintLabel(),
    };
    studio.tapAt(studio.targetClient("lupa"));
    const cleared = studio.banner() === null && studio.halo() === null && same(studio.found(), ["Lupa"]);
    for (const id of scene.DIFFICULTY_PRESETS.easy.targets.filter((targetId) => targetId !== "lupa")) studio.find(id);
    studio.frames(60);
    studio.click(studio.cls("hos-primary"));
    const [result] = studio.calls.complete;
    studio.unmount();
    const game = {
      nothingByItself,
      stage1: one.banner === "Pista: procure na mesa." && one.station && one.halo === null && one.next.startsWith("Mais uma pista"),
      stage2: two.banner === "Pista: procure sobre o mapa." && two.halo && two.onScreen && two.next.startsWith("Mostrar onde está"),
      stage3: three.banner === "Aqui está: Lupa." && three.halo && three.framed && three.next.startsWith("Mostrar de novo"),
      findClearsTheHint: cleared,
      costsNothing: same(result, resultFor("easy", 5)),
    };
    const failed = Object.entries({ climbs, perObject, findClears, ...game }).filter(([, ok]) => !ok).map(([name]) => name);
    return { pass: failed.length === 0 && haloProblems.length === 0, failed, ladder, haloProblems, banners: [one.banner, two.banner, three.banner] };
  });

  await check("H29", "contract", "RESTART_KEEPS_THE_LIST_AND_CLEARS_THE_ROUND", () => {
    const { model, camera: cam } = pureModules(tree);
    const R = model.sessionReducer;
    let s = R(R(model.createSession(), { type: "select-difficulty", difficulty: "medium" }), { type: "start" });
    for (const id of ["ampulheta", "bussola"]) s = R(s, tapOn(model, id));
    s = R(R(s, { type: "hint" }), { type: "focus-target", targetId: "camera" });
    const restarted = R(s, { type: "restart" });
    const reducer = {
      playing: restarted.status === "playing",
      sameDifficulty: restarted.difficulty === "medium",
      sameList: same(model.pendingTargets(restarted), [...model.targetsFor("medium")]),
      clearsFound: restarted.foundIds.length === 0,
      clearsHint: restarted.hintTarget === null && restarted.hintStage === 0 && restarted.focusedTarget === null && restarted.lastEvent === null,
      newRound: restarted.round === s.round + 1,
      nothingInSetup: R(model.createSession(), { type: "restart" }).status === "setup",
      difficultyLockedWhilePlaying: R(s, { type: "select-difficulty", difficulty: "hard" }).difficulty === "medium",
    };
    // the game: same component and scene controller (no reload), back to the table
    const studio = openStudio(tree);
    const restartButton = (entry) => entry.props["aria-label"] === "Recomeçar a exploração";
    const disabledInSetup = studio.button(restartButton)?.props.disabled === true;
    studio.start("medium");
    const controller = studio.controller;
    const list = studio.items().map((item) => item.label);
    for (const id of ["ampulheta", "bussola"]) studio.find(id);
    studio.clickHint();
    studio.settle();
    studio.drag(studio.centre(), { x: studio.centre().x - 120, y: studio.centre().y }, { steps: 5 });
    studio.settle();
    const mountsBefore = studio.harness.stats.mounts.HiddenObjectsScene;
    studio.click(restartButton);
    studio.settle();
    const game = {
      disabledInSetup,
      playing: studio.status() === "playing",
      sameDifficulty: studio.listStyle() === "silhouette",
      sameList: same(studio.items().map((item) => item.label), list),
      clearsFound: studio.found().length === 0 && studio.progress() === "0/6 encontrados",
      clearsHint: studio.banner() === null && studio.halo() === null,
      cameraBackAtTheTable: nearCamera(studio.camera(), cam.initialCamera(studio.size())),
      noReload: studio.controller === controller && studio.harness.stats.mounts.HiddenObjectsScene === mountsBefore,
    };
    studio.unmount();
    const failed = [...Object.entries(reducer).map(([k, v]) => [`reducer.${k}`, v]), ...Object.entries(game).map(([k, v]) => [`game.${k}`, v])]
      .filter(([, ok]) => !ok)
      .map(([name]) => name);
    return { pass: failed.length === 0, failed };
  });

  await check("H30", "contract", "COMPLETION_HAPPENS_ONCE", () => {
    const { model, scene } = pureModules(tree);
    const R = model.sessionReducer;
    let s = R(model.createSession("easy"), { type: "start" });
    const statuses = [];
    for (const id of scene.DIFFICULTY_PRESETS.easy.targets) {
      s = R(s, tapOn(model, id));
      statuses.push(s.status);
    }
    const reducer = {
      completesOnTheLastFind: same(statuses, ["playing", "playing", "playing", "playing", "completed"]),
      frozenAfterwards:
        R(s, tapOn(model, "lupa")) === s && R(s, { type: "hint" }) === s && R(s, { type: "focus-target", targetId: "lupa" }) === s && R(s, { type: "start" }) === s,
    };
    // the game: the closing card waits for the last glow; one result, however many times "Concluir" is pressed
    const studio = openStudio(tree);
    studio.start("easy");
    for (const id of scene.DIFFICULTY_PRESETS.easy.targets) studio.find(id);
    const completed = studio.status() === "completed";
    const cardAtOnce = studio.card() !== null;
    studio.frames(30);
    const cardBeforeDelay = studio.card() !== null;
    studio.frames(20);
    const cardShown = studio.card() !== null;
    const resultBeforeConclude = studio.calls.complete.length;
    studio.click(studio.cls("hos-primary"));
    studio.click(studio.cls("hos-primary"));
    studio.click(studio.cls("hos-secondary"));
    const small = studio.button(studio.cls("hos-primary-small")) !== null;
    if (small) studio.click(studio.cls("hos-primary-small"));
    const rendersBefore = studio.renders();
    studio.tapAt(studio.targetClient("lupa"));
    const quietAfterwards = studio.renders() === rendersBefore;
    const results = studio.calls.complete;
    studio.unmount();
    const game = {
      completed,
      cardWaits: !cardAtOnce && !cardBeforeDelay && cardShown,
      noResultBeforeConclude: resultBeforeConclude === 0,
      exactlyOneResult: results.length === 1,
      theResult: same(results[0], resultFor("easy", 5)),
      continueLookingKeepsConclude: small,
      quietAfterwards,
    };
    const failed = Object.entries({ ...reducer, ...game }).filter(([, ok]) => !ok).map(([name]) => name);
    return { pass: failed.length === 0, failed, onCompleteCalls: results.length };
  });

  await check("H31", "contract", "RESULT_CONTRACT", () => {
    const { model, scene } = pureModules(tree);
    const t = platformTables(tree);
    const R = model.sessionReducer;
    const results = {};
    for (const d of DIFFICULTIES) {
      let s = R(R(model.createSession(), { type: "select-difficulty", difficulty: d }), { type: "start" });
      s = R(R(s, { type: "hint" }), { type: "hint" });
      s = R(s, { type: "tap", point: { x: 3, y: 3 }, scale: 1, pointerType: "touch" });
      for (const id of scene.DIFFICULTY_PRESETS[d].targets) s = R(s, tapOn(model, id));
      results[d] = model.buildHiddenObjectsResult(s);
    }
    const wrongShape = DIFFICULTIES.filter((d) => !same(results[d], resultFor(d, scene.DIFFICULTY_PRESETS[d].targets.length)));
    const forbiddenKeys = Object.values(results).flatMap((r) => Object.keys(r).concat(Object.keys(r.details))).filter((key) => /time|elapsed|error|miss|hint|star|rank|streak|lives|continuation/i.test(key));
    const shell = Object.values(results).every((r) => t.rewards.isSuccessfulResult(r) && t.rewards.getRewardCopy(r).title === "Estúdio explorado");
    const labelled = ["difficulty", "foundObjects", "totalObjects", "completed"].every((key) => typeof t.labels.DETAIL_LABELS[key] === "string");
    const env = createEnvironment();
    const storage = createModuleGraph({ tree, mocks: {}, globals: env.globals }).require(FILES.storage);
    const saved = storage.saveGameResult(results.hard);
    const [readBack] = storage.getRecentResults();
    const stored = readBack?.id === saved.id && same({ ...readBack, id: undefined, playedAt: undefined }, results.hard);
    return {
      pass: wrongShape.length === 0 && forbiddenKeys.length === 0 && shell && labelled && stored,
      hard: results.hard,
      wrongShape,
      forbiddenKeys,
      rewardCopy: t.rewards.getRewardCopy(results.easy).title,
      storedAndReadBack: stored,
    };
  });

  await check("H32", "contract", "READY_ONLY_AFTER_DECODE_AND_A_PAINT", async () => {
    const studio = openStudio(tree);
    const trace = [];
    studio.frames(3);
    trace.push(["mounted, 3 frames", studio.calls.ready]);
    await studio.decode(["back", "plate"]);
    studio.frames(3);
    trace.push(["back + plate decoded, 3 frames", studio.calls.ready]);
    await studio.decode(["front"]);
    trace.push(["all decoded, no frame yet", studio.calls.ready]);
    studio.frames(1);
    trace.push(["1 frame", studio.calls.ready]);
    studio.frames(1);
    trace.push(["2 frames", studio.calls.ready]);
    await studio.decode(["plate"]);
    studio.frames(4);
    trace.push(["a layer loads again", studio.calls.ready]);
    const happy = same(trace.map(([, ready]) => ready), [0, 0, 0, 0, 1, 1]) && studio.calls.errors.length === 0;
    studio.unmount();
    // an essential layer that fails: one onEntryError, never ready
    const broken = openStudio(tree);
    await broken.decode(["back"]);
    broken.fail("plate");
    await broken.decode(["plate", "front"]);
    broken.frames(4);
    const loadError = broken.calls.ready === 0 && broken.calls.errors.length === 1 && /plate\.webp/.test(broken.calls.errors[0]);
    broken.unmount();
    // a decode that rejects is a failure too
    const rejecting = openStudio(tree);
    rejecting.layer("front").node.decode = () => Promise.reject(new Error("EncodingError"));
    await rejecting.decode();
    rejecting.frames(4);
    const decodeError = rejecting.calls.ready === 0 && rejecting.calls.errors.length === 1 && /front\.webp/.test(rejecting.calls.errors[0]);
    rejecting.unmount();
    // unmounted between the decode and the paint: nothing reports late
    const leaving = openStudio(tree);
    await leaving.decode();
    leaving.frames(1);
    leaving.unmount();
    leaving.env.clock.frame();
    leaving.env.clock.frame();
    const noLateReady = leaving.calls.ready === 0;
    return { pass: happy && loadError && decodeError && noLateReady, trace: trace.map(([label, ready]) => `${label}: ${ready}`), loadError, decodeError, noLateReady };
  });

  await check("H33", "contract", "EVERYTHING_IS_RELEASED_ON_EXIT_AND_UNMOUNT", () => {
    const { scene } = pureModules(tree);
    // exit: the shell's onExit, and no partial result
    const exiting = openStudio(tree);
    exiting.start("easy");
    exiting.find("lupa");
    exiting.click((entry) => entry.props["aria-label"] === "Voltar à jornada");
    const exit = exiting.calls.exit === 1 && exiting.calls.complete.length === 0;
    exiting.unmount();
    // unmount in the middle of everything: a captured drag, a wheel burst, a glide, the closing card's timer
    const busy = openStudio(tree);
    busy.start("easy");
    for (const id of scene.DIFFICULTY_PRESETS.easy.targets) busy.find(id);
    busy.frames(2);
    const viewport = busy.viewport;
    const centre = busy.centre();
    busy.pointer("pointerdown", { pointerId: 7, clientX: centre.x, clientY: centre.y, pointerType: "touch", button: 0 });
    busy.pointer("pointermove", { pointerId: 7, clientX: centre.x + 40, clientY: centre.y, pointerType: "touch" });
    busy.wheel(centre, -120);
    busy.clickStation("Janela");
    const live = (env) => env.observers.filter((observer) => observer.connected).length;
    const before = { listeners: viewport.listenerCount(), captured: viewport.captured.size, ...busy.env.clock.pending(), observers: live(busy.env) };
    busy.unmount();
    const after = { listeners: viewport.listenerCount(), captured: viewport.captured.size, ...busy.env.clock.pending(), observers: live(busy.env) };
    const updates = busy.harness.stats.stateUpdates;
    for (let i = 0; i < 120; i += 1) busy.env.clock.frame();
    const quiet = busy.harness.stats.stateUpdates === updates && busy.calls.complete.length === 0;
    // the controller alone: destroyed twice, nothing it owned is left
    const rig = openRig(tree);
    rig.pointer("pointerdown", { pointerId: 2, clientX: rig.centre().x, clientY: rig.centre().y, pointerType: "mouse", button: 0 });
    rig.wheel(rig.centre(), 120);
    rig.controller.goToStation("estante");
    rig.controller.destroy();
    rig.controller.destroy();
    const controllerClean =
      rig.viewport.listenerCount() === 0 && rig.viewport.captured.size === 0 && rig.env.clock.pending().frames === 0 &&
      rig.env.clock.pending().timers === 0 && live(rig.env) === 0;
    const exercised = before.listeners >= 7 && before.captured === 1 && before.frames >= 1 && before.timers >= 2 && before.observers === 1;
    const released = after.listeners === 0 && after.captured === 0 && after.frames === 0 && after.timers === 0 && after.observers === 0;
    return { pass: exit && exercised && released && quiet && controllerClean, exit, before, after, quietAfterUnmount: quiet, controllerDestroy: controllerClean };
  });

  await check("H34", "contract", "REDUCED_MOTION_CUTS_INSTEAD_OF_GLIDING", () => {
    const { camera: cam, model } = pureModules(tree);
    // motion on: a station glides over several frames, marked as moving, and the parallax drifts
    const moving = openRig(tree);
    moving.controller.goToStation("estante");
    let glideFrames = 0;
    while (moving.env.clock.pending().frames > 0 && glideFrames < 240) {
      moving.env.clock.frame();
      glideFrames += 1;
    }
    const glides = glideFrames >= 10 && moving.env.log.moving.some((mark) => mark.value === "true") && nearCamera(moving.camera(), cam.stationCamera("estante", moving.size()));
    const drifts = moving.parallax.some((layer) => !/^translate3d\(0px, 0px, 0\)$/.test(layer.style.transform));
    moving.controller.destroy();
    // reduced: the same request lands at once, never marked as moving, and the layers stay put
    const still = openRig(tree, { reducedMotion: true });
    const marks = still.env.log.moving.length;
    still.controller.goToStation("estante");
    const immediate = nearCamera(still.camera(), cam.stationCamera("estante", still.size()));
    still.frame();
    const cut = immediate && still.env.clock.pending().frames === 0 && !still.env.log.moving.slice(marks).some((mark) => mark.value === "true");
    still.drag(still.centre(), { x: still.centre().x + 150, y: still.centre().y + 30 }, { steps: 4 });
    still.frame();
    const layersStill = still.parallax.every((layer) => /^translate3d\(0px, 0px, 0\)$/.test(layer.style.transform));
    still.controller.destroy();
    // the game under reduced motion: "Mostrar onde está" frames the object in one frame
    const studio = openStudio(tree, { reducedMotion: true });
    studio.start("easy");
    studio.goTo("estante");
    for (let i = 0; i < 3; i += 1) studio.clickHint();
    studio.frames(1);
    const revealCut = nearCamera(studio.camera(), cam.revealCamera(model.regionBounds(model.targetById("lupa").region), studio.size())) && studio.env.clock.pending().frames === 0;
    studio.unmount();
    // the stylesheet: no fades, pulses or breathing under prefers-reduced-motion
    const block = mediaBlock(tree.read(FILES.css), "prefers-reduced-motion: reduce") ?? "";
    const css = {
      block: block.length > 0,
      haloWithoutFades: /\.hos-halo\s*\{[^}]*steps\(1/.test(block),
      bannerStill: /hos-hint-banner/.test(block),
      foundGlowStill: /hos-found/.test(block),
      animationsOff: /animation:\s*none/.test(block),
    };
    const failed = Object.entries({ glides, drifts, cut, layersStill, revealCut, ...css }).filter(([, ok]) => !ok).map(([name]) => name);
    return { pass: failed.length === 0, failed, glideFrames };
  });

  await check("H35", "contract", "NO_REACT_RENDER_PER_POINTERMOVE", () => {
    const studio = openStudio(tree);
    studio.start("easy");
    studio.settle();
    const { harness, env } = studio;
    const snapshot = () => ({ renders: studio.renders(), updates: harness.stats.stateUpdates, writes: env.log.writes.filter((w) => w.name === "hos-world").length });
    const centre = studio.centre();
    // a mouse drag: 40 pointermoves, a frame after each
    const s0 = snapshot();
    studio.pointer("pointerdown", { pointerId: 1, clientX: centre.x, clientY: centre.y, pointerType: "mouse", button: 0 });
    let writesInHandlers = 0;
    for (let i = 1; i <= 40; i += 1) {
      const count = env.log.writes.length;
      studio.pointer("pointermove", { pointerId: 1, clientX: centre.x - i * 6, clientY: centre.y + (i % 3), pointerType: "mouse" });
      writesInHandlers += env.log.writes.length - count;
      studio.frames(1);
    }
    const s1 = snapshot();
    studio.pointer("pointerup", { pointerId: 1, clientX: centre.x - 240, clientY: centre.y, pointerType: "mouse", button: 0 });
    studio.frames(2);
    const s2 = snapshot();
    // a pinch: 2 × 12 pointermoves
    studio.pointer("pointerdown", { pointerId: 2, clientX: centre.x - 10, clientY: centre.y, pointerType: "touch", button: 0 });
    studio.pointer("pointerdown", { pointerId: 3, clientX: centre.x + 10, clientY: centre.y, pointerType: "touch", button: 0 });
    const p0 = snapshot();
    for (let i = 1; i <= 12; i += 1) {
      studio.pointer("pointermove", { pointerId: 3, clientX: centre.x + 10 + i * 8, clientY: centre.y, pointerType: "touch" });
      studio.pointer("pointermove", { pointerId: 2, clientX: centre.x - 10 - i * 8, clientY: centre.y, pointerType: "touch" });
      studio.frames(1);
    }
    const p1 = snapshot();
    studio.pointer("pointerup", { pointerId: 3, clientX: centre.x + 106, clientY: centre.y, pointerType: "touch", button: 0 });
    studio.pointer("pointerup", { pointerId: 2, clientX: centre.x - 106, clientY: centre.y, pointerType: "touch", button: 0 });
    studio.frames(2);
    // a wheel burst: 12 events, then the settle
    const w0 = snapshot();
    for (let i = 0; i < 12; i += 1) {
      studio.wheel(centre, i % 2 ? -60 : 40);
      studio.frames(1);
    }
    const w1 = snapshot();
    studio.frames(20);
    const w2 = snapshot();
    const perFrame = new Map();
    for (const write of env.log.writes.filter((w) => w.name === "hos-world" && w.inFrame)) perFrame.set(write.frame, (perFrame.get(write.frame) ?? 0) + 1);
    const outsideFrames = env.log.writes.filter((w) => w.name === "hos-world" && !w.inFrame).length;
    studio.unmount();
    const facts = {
      dragRendersNothing: s1.renders === s0.renders && s1.updates === s0.updates,
      dragWritesTheTransform: s1.writes - s0.writes >= 30,
      nothingWrittenInsideHandlers: writesInHandlers === 0,
      settleRendersAtMostOnce: s2.renders - s1.renders <= 2,
      pinchRendersNothing: p1.renders === p0.renders && p1.updates === p0.updates && p1.writes > p0.writes,
      wheelRendersNothingUntilSettled: w1.renders === w0.renders && w1.updates === w0.updates && w2.renders - w1.renders <= 2,
      oneWritePerFrame: Math.max(0, ...perFrame.values()) <= 1,
      onlyTheMountWriteOutsideAFrame: outsideFrames === 1,
    };
    const failed = Object.entries(facts).filter(([, ok]) => !ok).map(([name]) => name);
    return {
      pass: failed.length === 0,
      failed,
      drag: { pointermoves: 40, renders: s1.renders - s0.renders, stateUpdates: s1.updates - s0.updates, transformWrites: s1.writes - s0.writes },
      pinch: { pointermoves: 24, renders: p1.renders - p0.renders, stateUpdates: p1.updates - p0.updates },
      wheel: { events: 12, rendersDuring: w1.renders - w0.renders, rendersAtSettle: w2.renders - w1.renders },
    };
  });

  // --- 36: the Discovery's record ---------------------------------------------------------------------

  await check("H36", "contract", "DISCOVERY_RECORDS_THE_APPROVED_REPLACEMENT", () => {
    const doc = tree.read(FILES.discovery);
    const baseLines = BASE_TREE.read(FILES.discovery).split("\n").filter((line) => line.trim());
    const kept = new Set(doc.split("\n"));
    const keptShare = baseLines.filter((line) => kept.has(line)).length / baseLines.length;
    const facts = {
      recommendationLine: /^GAME03_LEGACY_SLOT_RECOMMENDATION = number-trail$/m.test(doc),
      decisionLine: /^GAME03_REPLACEMENT_DECISION = APPROVED$/m.test(doc),
      notRewritten: keptShare >= 0.98,
    };
    return { pass: Object.values(facts).every(Boolean), ...facts, baseLinesKept: `${(keptShare * 100).toFixed(1)}%` };
  });

  // --- beyond the list: the platform's boundaries and the scene's assets ----------------------------

  await check("H37", "preserved", "PLATFORM_BOUNDARIES_HOLD", () => {
    const graph = staticGraph(tree);
    const home = graph.closure(APP_ROOTS, ["static"]);
    const gameCode = home.filter((file) => /^src\/games\/[^/]+\//.test(file));
    const heavy = [...new Set(home.flatMap((file) => graph.node(file).packages.static))].filter((name) => /^(@babylonjs\/|three$|@react-three\/)/.test(name));
    const staticGames = graph.node(FILES.registry).static.filter((file) => /^src\/games\/[^/]+\//.test(file));
    const loaders = loaderTargets(tree);
    const badLoaders = Object.entries(loaders).filter(([key, targets]) => targets.length !== 1 || !targets[0]?.startsWith(`src/games/${key}/`)).map(([key]) => key);
    const contract = graph.node(FILES.entryContract);
    return {
      pass:
        home.includes(FILES.registry) && gameCode.length === 0 && heavy.length === 0 && staticGames.length === 0 &&
        Object.keys(loaders).length > 0 && badLoaders.length === 0 && contract.static.length + contract.dynamic.length === 0,
      homeModules: home.length,
      gameCodeInHome: gameCode,
      heavyPackagesInHome: heavy,
      registryStaticGameImports: staticGames,
      loaders: Object.keys(loaders),
      nonLiteralOrForeignLoaders: badLoaders,
    };
  });

  await check("H38", "contract", "STUDIO_ASSETS_FIT_THE_BUDGET", () => {
    const { scene } = pureModules(tree);
    const t = platformTables(tree);
    const read = (src) => {
      const file = `public${src}`;
      const bytes = tree.exists(file) ? readBinary(tree, file) : null;
      return { file, bytes: bytes?.length ?? 0, size: bytes ? webpSize(bytes) : null };
    };
    const layers = scene.SCENE_LAYERS.map((layer) => ({ id: layer.id, declared: { width: layer.rect.w, height: layer.rect.h }, ...read(layer.src) }));
    const thumbs = scene.HIDDEN_OBJECTS.map((target) => ({ id: target.id, ...read(scene.thumbnailSrc(target.id)) }));
    const hero = read(t.visuals[STUDIO].introArt);
    const layersOk = layers.every((layer) => layer.size && layer.size.width === layer.declared.width && layer.size.height === layer.declared.height);
    const thumbsOk = thumbs.every((thumb) => thumb.size && thumb.size.width >= 64 && thumb.size.width === thumb.size.height);
    const layerBytes = layers.reduce((sum, layer) => sum + layer.bytes, 0);
    const entryBytes = layerBytes + thumbs.reduce((sum, thumb) => sum + thumb.bytes, 0) + hero.bytes;
    return {
      pass: layersOk && thumbsOk && Boolean(hero.size) && entryBytes <= ENTRY_ASSET_BUDGET_BYTES && /\/v\d+$/.test(scene.SCENE_ASSET_BASE),
      layers: layers.map((layer) => `${layer.id} ${layer.size?.width}×${layer.size?.height} ${(layer.bytes / 1024).toFixed(1)} KB`),
      thumbnails: `${thumbs.length} × ${thumbs[0]?.size?.width}px, ${(thumbs.reduce((sum, thumb) => sum + thumb.bytes, 0) / 1024).toFixed(1)} KB`,
      transitionArt: `${hero.size?.width}×${hero.size?.height} ${(hero.bytes / 1024).toFixed(1)} KB`,
      readinessBytes: `${(layerBytes / 1024).toFixed(1)} KB`,
      entryBytes: `${(entryBytes / 1024).toFixed(1)} KB of ${(ENTRY_ASSET_BUDGET_BYTES / 1024).toFixed(0)} KB`,
    };
  });

  return results;
}

// --- mutants (in memory only) -------------------------------------------------------------------------

/**
 * Each mutant is a set of textual edits to today's tree, applied in memory with
 * `openSourceTree({ sourceOverrides })`. Every anchor must appear exactly once.
 */
const MUTANTS = [
  {
    name: "the Estúdio loses explicit readiness",
    files: { [FILES.entryContract]: [['  "hidden-objects": { readiness: "explicit" },', '  "hidden-objects": { readiness: "frame-fallback" },']] },
    mustFail: ["H09"],
  },
  {
    name: "the Estúdio is imported eagerly",
    files: {
      [FILES.registry]: [
        ['import type { GameComponentProps, GameId } from "@/types/game";', 'import type { GameComponentProps, GameId } from "@/types/game";\nimport { HiddenObjectsGame } from "@/games/hidden-objects/HiddenObjectsGame";'],
        ['  "hidden-objects": () =>\n    import("@/games/hidden-objects/HiddenObjectsGame").then(\n      (mod) => mod.HiddenObjectsGame,\n    ),', '  "hidden-objects": () => Promise.resolve(HiddenObjectsGame),'],
      ],
    },
    mustFail: ["H08", "H37"],
  },
  {
    name: "number-trail stays active next to the Estúdio",
    files: {
      [FILES.types]: [['  | "hidden-objects"\n', '  | "hidden-objects"\n  | "number-trail"\n']],
      [FILES.stages]: [['  "hidden-objects",\n', '  "hidden-objects",\n  "number-trail",\n']],
    },
    mustFail: ["H02", "H07"],
  },
  {
    name: "the Rota is removed by accident",
    files: { [FILES.registry]: [['  "escape-maze": () =>\n    import("@/games/escape-maze/RouteStrategyGame").then(\n      (mod) => mod.RouteStrategyGame,\n    ),\n', ""]] },
    mustFail: ["H03", "H07"],
  },
  {
    name: "the Circuito is removed by accident",
    files: { [FILES.stages]: [['  "color-sequence",\n', ""]] },
    mustFail: ["H04", "H07"],
  },
  {
    name: "a drag selects a target",
    files: {
      [FILES.gesture]: [['  if (state.phase === "pressed") {\n    const origin = state.origin!;\n    const quick', '  if (state.phase === "pressed" || state.phase === "panning") {\n    const origin = state.origin!;\n    const quick']],
    },
    mustFail: ["H21"],
  },
  {
    name: "a pinch selects a target",
    files: {
      [FILES.gesture]: [['    return { state: { ...state, phase: "panning", pointers }, effects: [{ kind: "pinch-end" }] };', '    return { state: { ...state, phase: "pressed", pointers, multi: false }, effects: [{ kind: "pinch-end" }] };']],
    },
    mustFail: ["H22"],
  },
  {
    name: "the camera escapes the room",
    files: { [FILES.camera]: [["    x: clamp(camera.x, halfW, SCENE_WIDTH - halfW),\n    y: clamp(camera.y, halfH, SCENE_HEIGHT - halfH),", "    x: camera.x,\n    y: camera.y,"]] },
    mustFail: ["H17"],
  },
  {
    name: "Médio lists five objects",
    files: { [FILES.scene]: [['    targets: ["ampulheta", "binoculo", "bussola", "relogio", "camera", "lanterna"],', '    targets: ["ampulheta", "binoculo", "bussola", "relogio", "camera"],']] },
    mustFail: ["H25"],
  },
  {
    name: "a target out of reach",
    files: { [FILES.scene]: [['    region: { kind: "rect", x: 2615, y: 245, w: 84, h: 122 },', '    region: { kind: "rect", x: 3150, y: 245, w: 84, h: 122 },']] },
    mustFail: ["H27"],
  },
  {
    name: "completion is sent twice",
    files: { [FILES.game]: [['    if (completionSent.current || state.status !== "completed") return;', '    if (state.status !== "completed") return;']] },
    mustFail: ["H30"],
  },
  {
    name: "ready before the layers decode",
    files: { [FILES.sceneView]: [["    if (!this.essentials.every((id) => this.decoded.has(id))) return;\n", ""]] },
    mustFail: ["H32"],
  },
  {
    name: "ready without a paint opportunity",
    files: { [FILES.sceneView]: [["    if (this.frames.length > 0) return;\n", "    if (this.frames.length > 0) return;\n    this.done = true;\n    this.callbacks.onReady?.();\n    return;\n"]] },
    mustFail: ["H32"],
  },
  {
    name: "the pointermove listener is left behind",
    files: { [FILES.controller]: [['    viewport.removeEventListener("pointermove", this.handlePointerMove);\n', ""]] },
    mustFail: ["H33"],
  },
  {
    name: "every pointermove pushes the camera into React state",
    files: {
      [FILES.controller]: [
        [
          "        this.camera = panBy(this.camera, effect.dx, effect.dy, this.size);\n        this.moving = true;\n        this.requestRender();\n        return;",
          '        this.camera = panBy(this.camera, effect.dx, effect.dy, this.size);\n        this.moving = true;\n        this.requestRender();\n        this.lastView = "";\n        this.notifySettle();\n        return;',
        ],
      ],
    },
    mustFail: ["H35"],
  },
  {
    name: "an old Trilha result crashes the world lookup",
    files: { [FILES.worlds]: [['  return GAME_WORLDS[gameId as GameId] ?? GAME_WORLDS["color-sequence"];', "  return GAME_WORLDS[gameId as GameId];"]] },
    mustFail: ["H13"],
  },
  {
    name: "an old Trilha result is shown as the Estúdio",
    files: {
      [FILES.storage]: [
        [
          "    return Array.isArray(parsed) ? parsed.filter(isStoredResult) : [];",
          '    return Array.isArray(parsed)\n      ? parsed.filter(isStoredResult).map((result) => (result.gameId === ("number-trail" as string) ? { ...result, gameId: "hidden-objects" as const } : result))\n      : [];',
        ],
      ],
    },
    mustFail: ["H13"],
  },
  {
    name: "old Trilha results are silently dropped at the next save",
    files: {
      [FILES.storage]: [
        ["    return Array.isArray(parsed) ? parsed.filter(isStoredResult) : [];", '    return Array.isArray(parsed) ? parsed.filter(isStoredResult).filter((result) => result.gameId !== ("number-trail" as string)) : [];'],
      ],
    },
    mustFail: ["H13"],
  },
];

function mutate(worktree, mutant) {
  const overrides = {};
  for (const [file, edits] of Object.entries(mutant.files)) {
    let text = worktree.read(file);
    for (const [from, to] of edits) {
      const count = text.split(from).length - 1;
      if (count !== 1) throw new Error(`anchor ${JSON.stringify(clip(from, 70))} appears ${count}x in ${file}`);
      text = text.replace(from, () => to);
    }
    overrides[file] = text;
  }
  return openSourceTree({ sourceOverrides: overrides });
}

// --- run ---------------------------------------------------------------------------------------------

const print = (results) => {
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.id} [${r.tag}] — ${r.name}`);
    for (const [key, value] of Object.entries(r.detail)) console.log(`        ${key}: ${clip(JSON.stringify(value) ?? "undefined")}`);
  }
};

if (COUNTERFACTUAL_MODE) {
  const worktree = openSourceTree();
  const current = await runChecks(worktree);
  const currentFailing = current.filter((r) => !r.pass).map((r) => r.id);
  console.log(`working tree: ${current.length - currentFailing.length}/${current.length} checks pass${currentFailing.length ? ` · failing: ${currentFailing.join(", ")}` : ""}`);
  let ok = currentFailing.length === 0;

  const base = await runChecks(BASE_TREE);
  const contract = base.filter((r) => r.tag === "contract");
  const preserved = base.filter((r) => r.tag === "preserved");
  const contractHolding = contract.filter((r) => r.pass).map((r) => r.id);
  const preservedBroken = preserved.filter((r) => !r.pass).map((r) => r.id);
  const baseHeld = contractHolding.length === 0 && preservedBroken.length === 0;
  ok &&= baseHeld;
  console.log(`${baseHeld ? "CAUGHT" : "MISSED"}  base ${BASE.slice(0, 8)} — the Trilha active, no Estúdio`);
  console.log(`        [contract] failing: ${contract.length - contractHolding.length}/${contract.length}${contractHolding.length ? ` · still holding: ${contractHolding.join(", ")}` : ""}`);
  console.log(`        [preserved] holding: ${preserved.length - preservedBroken.length}/${preserved.length}${preservedBroken.length ? ` · broken: ${preservedBroken.join(", ")}` : ""}`);
  for (const r of base.filter((x) => (x.tag === "preserved" && !x.pass) || (x.tag === "contract" && x.pass))) {
    console.log(`        ${r.id} ${r.pass ? "PASSED" : "FAILED"}: ${clip(JSON.stringify(r.detail), 300)}`);
  }

  for (const mutant of MUTANTS) {
    let tree;
    try {
      tree = mutate(worktree, mutant);
    } catch (error) {
      ok = false;
      console.log(`BROKEN  mutant — ${mutant.name}: ${error.message}`);
      continue;
    }
    const results = await runChecks(tree);
    const failing = results.filter((r) => !r.pass).map((r) => r.id);
    const held = mutant.mustFail.every((id) => failing.includes(id));
    ok &&= held;
    console.log(`${held ? "CAUGHT" : "MISSED"}  mutant — ${mutant.name}`);
    console.log(`        required to fail: ${mutant.mustFail.join(", ")} · failed: ${failing.join(", ") || "none"}`);
  }
  console.log(ok ? "HIDDEN_OBJECTS_SKELETON_COUNTERFACTUALS_HOLD" : "HIDDEN_OBJECTS_SKELETON_COUNTERFACTUALS_BROKEN");
  process.exit(ok ? EXIT_OK : EXIT_VALIDATION_FAILED);
}

let tree;
try {
  tree = openSourceTree({ rev: REV });
} catch (error) {
  console.error(String(error.message));
  process.exit(EXIT_USAGE);
}
const results = await runChecks(tree);
print(results);
const failing = results.filter((r) => !r.pass).map((r) => r.id);
console.log(
  `\n${REV ? `rev ${tree.rev.slice(0, 12)} · ` : ""}${results.length - failing.length}/${results.length} passed` +
    ` (${results.filter((r) => r.tag === "contract").length} contract, ${results.filter((r) => r.tag === "preserved").length} preserved)` +
    `${failing.length ? ` · failing: ${failing.join(", ")}` : ""}`,
);
console.log(failing.length ? "HIDDEN_OBJECTS_SKELETON_FAILED" : "HIDDEN_OBJECTS_SKELETON_OK");
process.exit(failing.length ? EXIT_VALIDATION_FAILED : EXIT_OK);
