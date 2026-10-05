/**
 * ROUTE-C0 — the Rota's module graph, as the validators load it.
 *
 * Until C0 every Rota validator carried its own copy of the same idea: read
 * `useEscapeMaze.ts`, append an export surface, transpile it alone, and answer
 * its imports from a hand-written `require` that knew which three or four
 * modules the hook happened to import that month. Each copy assumed the Rota
 * IS one file. When `difficulty.ts` started importing `route-random.ts`, five
 * of those copies stopped loading at all, silently, because nothing ran them.
 *
 * This module is the one place that knows how to turn repository TypeScript
 * into running code for a validator. It is deliberately small — not a bundler:
 *
 *   - a SOURCE TREE: one read-only view of the repository, either the working
 *     tree or one commit (`git show <rev>:<path>`), plus explicit in-memory
 *     overrides. Line endings are normalised here and nowhere else;
 *   - a MODULE GRAPH: resolves `./x`, `../x` and `@/x`, transpiles TS/TSX,
 *     evaluates every module ONCE (one instance per file, whoever imports it)
 *     in one shared realm, and answers everything that is not a repository
 *     module only from explicit mocks — never from a guess;
 *   - the ROTA PROFILE (`loadRouteModules`): the environment every Rota
 *     validator used to rebuild by hand — seeded `Math`, inert React, silent
 *     sounds — and a diagnostic surface that finds a private binding in
 *     whichever Rota module declares it, so a validator asks for
 *     `isValidMap`, not for "the `isValidMap` inside useEscapeMaze.ts".
 *
 * It never writes a file. A transform or an override changes the text that is
 * compiled, in memory; the repository is only ever read.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { createSeededRandom } from "./route-lab.mjs";

/** The Rota's entry: the hook the game mounts. Where its logic lives is the graph's business. */
export const ROUTE_HOOK = "src/games/escape-maze/useEscapeMaze.ts";
/** The Rota's own modules — what useEscapeMaze.ts is split into, and nothing from the engine. */
export const ROUTE_MODULE_DIR = "src/games/escape-maze/";
/** The export a module gets when its private bindings are exposed to a validator. */
export const INTERNALS_EXPORT = "__validationInternals";
/**
 * The RNG seam every Rota module draws from. Not a Rota module, but part of the
 * Rota's surface: since ROUTE-C2 it declares the one-draw pick (`randomItem`)
 * that generation and the Hunter share, and a validator that replays the
 * generator has to draw with that same function.
 */
export const ROUTE_RANDOM_SEAM = "src/engine/route-random.ts";
/** The modules whose private bindings a Rota surface can name: the Rota's own, and its RNG seam. */
export const exposesRouteSurface = (file) => file.startsWith(ROUTE_MODULE_DIR) || file === ROUTE_RANDOM_SEAM;

/**
 * The one normalisation of line endings. Every source the graph hands out or
 * compiles has passed through here — the worktree's, a commit's, an override,
 * and every transform's output — so a textual anchor written with "\n" means
 * the same thing whatever the checkout's `core.autocrlf` did to the file.
 */
export const normalizeSource = (text) => text.replace(/\r\n/g, "\n");

const RESOLVE_SUFFIXES = ["", ".ts", ".tsx", "/index.ts", "/index.tsx"];
const COMPILER_OPTIONS = {
  esModuleInterop: true,
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2020,
  jsx: ts.JsxEmit.ReactJSX,
};

const git = (root, args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });

const scriptKind = (file) => (file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const parse = (file, source) =>
  ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind(file));

/**
 * Top-level bindings that exist at run time: functions with a body, variables,
 * classes, enums. Types, interfaces, ambient declarations and imported names
 * are not declared HERE, so they are not this module's to expose.
 */
export function declaredValueNames(file, source) {
  const names = [];
  const isAmbient = (node) =>
    ts.getModifiers?.(node)?.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword) ?? false;
  const bindingNames = (name) =>
    ts.isIdentifier(name)
      ? [name.text]
      : name.elements.flatMap((element) => (ts.isOmittedExpression(element) ? [] : bindingNames(element.name)));
  for (const statement of parse(file, source).statements) {
    if (isAmbient(statement)) continue;
    if (ts.isFunctionDeclaration(statement) && statement.name && statement.body) names.push(statement.name.text);
    else if (ts.isClassDeclaration(statement) && statement.name) names.push(statement.name.text);
    else if (ts.isEnumDeclaration(statement) && !(ts.getModifiers?.(statement) ?? []).some((m) => m.kind === ts.SyntaxKind.ConstKeyword)) {
      names.push(statement.name.text);
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) names.push(...bindingNames(declaration.name));
    }
  }
  return [...new Set(names)];
}

/**
 * The [start, end) of a top-level `function name(...) {...}` in `source`, or
 * null. Found by the parser, not by searching for the next function's name, so
 * it does not care what is declared around it or in which file.
 */
export function functionRange(file, source, name) {
  for (const statement of parse(file, source).statements) {
    if (ts.isFunctionDeclaration(statement) && statement.body && statement.name?.text === name) {
      return { start: statement.getStart(), end: statement.end };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// source tree
// ---------------------------------------------------------------------------

/**
 * A read-only view of the repository: the working tree, or every file as it
 * was at `rev`. `sourceOverrides` replaces (or adds) single modules in memory,
 * and is the only way to mix revisions — explicitly, file by file.
 */
export function openSourceTree({ root = process.cwd(), rev = null, sourceOverrides = {}, underlying = null } = {}) {
  const absoluteRoot = path.resolve(root);
  const toRepoPath = (file) =>
    (path.isAbsolute(file) ? path.relative(absoluteRoot, file) : file).replace(/\\/g, "/").replace(/^\.\//, "");

  let commit = null;
  // `underlying` (ROUTE-C7B): another tree to read every file through, instead of the disk or git — a view of that
  // tree, whose resolution, closure and lookups then answer for the view's texts. It keeps that tree's revision label.
  if (underlying) commit = underlying.rev ?? null;
  else if (rev) {
    try {
      commit = git(absoluteRoot, ["rev-parse", "--verify", `${rev}^{commit}`]).trim();
    } catch {
      throw new Error(`route-module-loader: unknown revision "${rev}"`);
    }
  }
  const overrides = new Map(
    Object.entries(sourceOverrides).map(([file, text]) => {
      if (typeof text !== "string") throw new Error(`route-module-loader: override for ${file} is not a string`);
      return [toRepoPath(file), normalizeSource(text)];
    }),
  );

  let revFiles = null;
  const filesAtRev = () => (revFiles ??= new Set(git(absoluteRoot, ["ls-tree", "-r", "--name-only", commit]).split("\n").filter(Boolean)));
  const exists = (file) => {
    const repoPath = toRepoPath(file);
    if (overrides.has(repoPath)) return true;
    if (underlying) return underlying.exists(repoPath);
    if (commit) return filesAtRev().has(repoPath);
    try {
      return fs.statSync(path.join(absoluteRoot, repoPath)).isFile();
    } catch {
      return false;
    }
  };

  const texts = new Map();
  const read = (file) => {
    const repoPath = toRepoPath(file);
    if (overrides.has(repoPath)) return overrides.get(repoPath);
    if (texts.has(repoPath)) return texts.get(repoPath);
    if (!exists(repoPath)) {
      throw new Error(`route-module-loader: ${repoPath} does not exist${commit ? ` at ${commit.slice(0, 12)}` : " in the working tree"}`);
    }
    const raw = underlying
      ? underlying.read(repoPath)
      : commit
        ? git(absoluteRoot, ["show", `${commit}:${repoPath}`])
        : fs.readFileSync(path.join(absoluteRoot, repoPath), "utf8");
    const text = normalizeSource(raw);
    texts.set(repoPath, text);
    return text;
  };

  const origin = (file) => {
    const repoPath = toRepoPath(file);
    return overrides.has(repoPath) ? "override" : commit ? `rev:${commit}` : "worktree";
  };

  /**
   * `./x`, `../x` (from `from`) and `@/x` (tsconfig `paths`: `src/x`), with
   * the extensions a TS import may omit. Anything else is not a repository
   * module, and `null` says so: the graph then wants a mock, not a guess.
   */
  const resolve = (specifier, from = "") => {
    let base;
    if (specifier.startsWith("@/")) base = `src/${specifier.slice(2)}`;
    else if (specifier.startsWith("./") || specifier.startsWith("../")) base = path.posix.join(path.posix.dirname(from || "."), specifier);
    else return null;
    base = path.posix.normalize(base);
    if (base.startsWith("../")) {
      throw new Error(`route-module-loader: ${from || "<root>"} imports "${specifier}", which leaves the repository`);
    }
    const tried = RESOLVE_SUFFIXES.map((suffix) => base + suffix);
    const found = tried.find((candidate) => exists(candidate));
    if (!found) {
      throw new Error(
        `route-module-loader: ${from || "<root>"} imports "${specifier}", which resolves to no file` +
          `${commit ? ` at ${commit.slice(0, 12)}` : ""} (tried ${tried.join(", ")})`,
      );
    }
    return found;
  };

  /** What a module requires at run time — read off the transpiled output, so type-only imports are already gone. */
  const runtimeImportsCache = new Map();
  const runtimeImports = (file) => {
    const repoPath = toRepoPath(file);
    if (!runtimeImportsCache.has(repoPath)) {
      const js = transpile(repoPath, read(repoPath));
      runtimeImportsCache.set(repoPath, [...new Set([...js.matchAll(/\brequire\("([^"]+)"\)/g)].map((m) => m[1]))]);
    }
    return runtimeImportsCache.get(repoPath);
  };

  /** Every repository module `entry` reaches through run-time imports, entry first. Nothing is executed. */
  const closure = (entry = ROUTE_HOOK) => {
    const seen = [toRepoPath(entry)];
    for (let i = 0; i < seen.length; i += 1) {
      for (const specifier of runtimeImports(seen[i])) {
        const file = resolve(specifier, seen[i]);
        if (file && !seen.includes(file)) seen.push(file);
      }
    }
    return seen;
  };

  /**
   * The one module of `entry`'s graph whose source contains `needle`, exactly
   * once. A textual counterfactual anchors here instead of on a file name, so
   * it follows the code it patches wherever that code is moved.
   */
  const locate = (needle, { entry = ROUTE_HOOK } = {}) => {
    const hits = closure(entry)
      .map((file) => ({ file, count: read(file).split(needle).length - 1 }))
      .filter((hit) => hit.count > 0);
    const total = hits.reduce((sum, hit) => sum + hit.count, 0);
    if (total !== 1) {
      const preview = JSON.stringify(needle.length > 80 ? `${needle.slice(0, 77)}...` : needle);
      throw new Error(
        `route-module-loader: anchor ${preview} appears ${total}x in the graph of ${entry}` +
          `${hits.length ? ` (${hits.map((hit) => `${hit.file}: ${hit.count}`).join(", ")})` : ""}; expected exactly 1`,
      );
    }
    return hits[0].file;
  };

  /** The one Rota module (`within`) of `entry`'s graph that declares the top-level value `name`. */
  const declaring = (name, { entry = ROUTE_HOOK, within = ROUTE_MODULE_DIR } = {}) => {
    const files = closure(entry)
      .filter((file) => file.startsWith(within))
      .filter((file) => declaredValueNames(file, read(file)).includes(name));
    if (files.length !== 1) {
      throw new Error(
        `route-module-loader: ${files.length === 0 ? "no module" : `${files.length} modules (${files.join(", ")})`} under ${within} ` +
          `in the graph of ${entry} declare${files.length === 1 ? "s" : ""} "${name}"; expected exactly 1`,
      );
    }
    return files[0];
  };

  return { root: absoluteRoot, rev: commit, toRepoPath, exists, read, origin, resolve, runtimeImports, closure, locate, declaring };
}

/**
 * A graph-wide transform made of textual edits `[anchor, replacement]`, each
 * applied (in order, `String#replace` semantics) in whichever module holds
 * its anchor. Every anchor must appear exactly once in the graph — checked
 * here, before anything is loaded — so an edit can neither miss silently nor
 * land in the wrong module, and it keeps working when its code is moved.
 */
export function anchoredEdits(tree, edits, { entry = ROUTE_HOOK } = {}) {
  const targets = edits.map(([anchor, replacement]) => ({ file: tree.locate(anchor, { entry }), anchor, replacement }));
  return (source, file) =>
    targets.filter((target) => target.file === file).reduce((text, target) => text.replace(target.anchor, target.replacement), source);
}

function transpile(file, source) {
  const { outputText, diagnostics } = ts.transpileModule(source, {
    compilerOptions: COMPILER_OPTIONS,
    fileName: file,
    reportDiagnostics: true,
  });
  const errors = (diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (errors.length) {
    const first = errors[0];
    const where = first.file && first.start !== undefined ? first.file.getLineAndCharacterOfPosition(first.start) : null;
    throw new Error(
      `route-module-loader: ${file}${where ? `:${where.line + 1}:${where.character + 1}` : ""} does not compile: ` +
        ts.flattenDiagnosticMessageText(first.messageText, "\n"),
    );
  }
  return outputText;
}

// ---------------------------------------------------------------------------
// module graph
// ---------------------------------------------------------------------------

/**
 * `transforms` is one of, or an array of (applied in order):
 *   - `{ "src/…/x.ts": (source, file) => source }` — that module only;
 *   - `(source, file) => source` — every repository module (return it unchanged
 *     to leave a module alone).
 * Each output is normalised again, so a transform cannot smuggle CRLF in.
 */
function transformPipeline(transforms, toRepoPath) {
  // Callers compose (`[theirs, mine]`, nested as deep as the layers above go):
  // flatten all the way, or a nested list would be read as a file map and
  // silently apply nothing.
  return [transforms]
    .flat(Infinity)
    .filter(Boolean)
    .map((entry) => {
      if (typeof entry === "function") return entry;
      if (typeof entry !== "object") throw new Error(`route-module-loader: a transform must be a function or a file map, not ${typeof entry}`);
      const byFile = new Map(
        Object.entries(entry).map(([file, fn]) => {
          if (typeof fn !== "function") throw new Error(`route-module-loader: the transform for ${file} is not a function`);
          return [toRepoPath(file), fn];
        }),
      );
      return (source, file) => (byFile.has(file) ? byFile.get(file)(source, file) : source);
    });
}

/** A module's text as the graph compiles it: source, then transforms, then the internals export. */
function preparedSource(sources, pipeline, exposeInternals, file) {
  let text = sources.read(file);
  for (const step of pipeline) {
    const next = step(text, file);
    if (typeof next !== "string") throw new Error(`route-module-loader: a transform returned ${typeof next} for ${file}`);
    text = normalizeSource(next);
  }
  if (exposeInternals(file)) {
    const names = declaredValueNames(file, text);
    if (names.includes(INTERNALS_EXPORT)) throw new Error(`route-module-loader: ${file} already declares ${INTERNALS_EXPORT}`);
    text += `\nexport const ${INTERNALS_EXPORT} = { ${names.join(", ")} };\n`;
  }
  return text;
}

/**
 * Evaluate a small graph of repository modules.
 *
 *   mocks      `{ specifier | repoPath: exports }` — answered as given, the
 *              SAME object to every importer. A specifier that is neither a
 *              repository module nor mocked is an error naming both ends.
 *   globals    the realm's globals. ONE realm for the whole graph, as in the
 *              browser: an object made in one module is an object of the same
 *              realm in every other, and `globalThis` is one object.
 *   exposeInternals(file) → boolean — append `INTERNALS_EXPORT` (every
 *              top-level value of that module) so `internals()` can reach
 *              private bindings without knowing which file holds them.
 */
export function createModuleGraph({
  tree,
  root,
  rev,
  sourceOverrides,
  transforms,
  mocks = {},
  globals = {},
  exposeInternals = () => false,
} = {}) {
  const sources = tree ?? openSourceTree({ root, rev, sourceOverrides });
  const pipeline = transformPipeline(transforms, sources.toRepoPath);
  const sandbox = { ...globals };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  const records = new Map();
  const compiled = new Map();

  const compiledSource = (file) => {
    const text = preparedSource(sources, pipeline, exposeInternals, file);
    compiled.set(file, text);
    return text;
  };

  const requireFrom = (specifier, from) => {
    if (Object.hasOwn(mocks, specifier)) return mocks[specifier];
    const file = sources.resolve(specifier, from);
    if (file === null) {
      throw new Error(
        `route-module-loader: ${from || "<root>"} imports "${specifier}", which is not a repository module ` +
          "and has no mock — pass one in `mocks` (environment dependencies are never loaded implicitly)",
      );
    }
    if (Object.hasOwn(mocks, file)) return mocks[file];
    return load(file);
  };

  const load = (file) => {
    const existing = records.get(file);
    // A module already being evaluated is a cycle: like Node, hand back what it
    // has exported so far rather than evaluating a second instance.
    if (existing) return existing.cjs.exports;
    const cjs = { exports: {} };
    const record = { file, origin: sources.origin(file), cjs, loaded: false };
    records.set(file, record);
    try {
      const js = transpile(file, compiledSource(file));
      const wrapper = new vm.Script(`(function (exports, require, module, __filename, __dirname) {${js}\n})`, {
        filename: file,
      }).runInContext(sandbox);
      wrapper.call(cjs.exports, cjs.exports, (specifier) => requireFrom(specifier, file), cjs, file, path.posix.dirname(file));
    } catch (error) {
      records.delete(file);
      throw error;
    }
    record.loaded = true;
    return cjs.exports;
  };

  /** A repository path, or a specifier resolved from the repository root. */
  const requireModule = (target) => {
    const repoPath = sources.toRepoPath(target);
    if (Object.hasOwn(mocks, target)) return mocks[target];
    if (Object.hasOwn(mocks, repoPath)) return mocks[repoPath];
    if (sources.exists(repoPath)) return load(repoPath);
    return requireFrom(target, "");
  };

  /**
   * Private bindings by name, each from the one loaded module that declares it
   * (among those with `exposeInternals`). Missing and ambiguous names are both
   * errors, all named at once.
   */
  const internals = (names, { within = "" } = {}) => {
    const owners = [...records.values()].filter(
      (record) => record.loaded && record.file.startsWith(within) && record.cjs.exports[INTERNALS_EXPORT],
    );
    const missing = [];
    const ambiguous = [];
    const surface = {};
    for (const name of names) {
      const holders = owners.filter((record) => Object.hasOwn(record.cjs.exports[INTERNALS_EXPORT], name));
      if (holders.length === 0) missing.push(name);
      else if (holders.length > 1) ambiguous.push(`${name} (${holders.map((record) => record.file).join(", ")})`);
      else surface[name] = holders[0].cjs.exports[INTERNALS_EXPORT][name];
    }
    if (missing.length || ambiguous.length) {
      throw new Error(
        "route-module-loader: " +
          [
            missing.length && `no loaded module declares: ${missing.join(", ")}`,
            ambiguous.length && `declared by more than one module: ${ambiguous.join("; ")}`,
          ]
            .filter(Boolean)
            .join(" · ") +
          " — update the validator's surface; never change production to satisfy it",
      );
    }
    return surface;
  };

  return {
    tree: sources,
    sandbox,
    require: requireModule,
    internals,
    /** The text that was compiled for `file`: source, then transforms, then the internals export. */
    compiledSource: (file) => compiled.get(sources.toRepoPath(file)) ?? null,
    /** Loaded modules in load order, with where each came from. */
    modules: () => [...records.values()].map(({ file, origin, loaded }) => ({ file, origin, loaded })),
  };
}

/**
 * ROUTE-PERF-WORKER-DECISION-01 — the same closure as one self-contained
 * script, for running it where the graph's `vm` realm cannot go: natively in
 * Node's main realm (timing without a sandbox's global proxy) and inside a
 * browser page or a Worker (timing under CPU throttling, transport probes).
 *
 * Returns the text of a function expression `(function (...params) { … })`
 * whose call evaluates `entry`'s run-time closure — the same files, transforms
 * and transpilation as `createModuleGraph` — and returns `{ exports, require }`:
 * the entry's exports and a `require(repoPath)` that hands out the SAME module
 * instances (one per file). `params` are free names the modules may read —
 * pass `Math` to shadow the realm's `Math`, or a probe a transform refers to.
 *
 * Nothing outside the repository is bundled: a closure that imports a package
 * (React, Babylon…) has no place in a standalone script, so it throws instead
 * of guessing. Generation's closure imports none. Read-only, like the rest.
 */
export function emitModuleBundle({
  tree,
  root,
  rev,
  sourceOverrides,
  entry = ROUTE_HOOK,
  transforms,
  exposeInternals = () => false,
  params = [],
} = {}) {
  const sources = tree ?? openSourceTree({ root, rev, sourceOverrides });
  const pipeline = transformPipeline(transforms, sources.toRepoPath);
  const start = sources.toRepoPath(entry);
  const definitions = sources.closure(start).map((file) => {
    const js = transpile(file, preparedSource(sources, pipeline, exposeInternals, file));
    const links = {};
    for (const [, specifier] of js.matchAll(/\brequire\("([^"]+)"\)/g)) {
      const target = sources.resolve(specifier, file);
      if (target === null) {
        throw new Error(`route-module-loader: ${file} imports "${specifier}", which a standalone bundle cannot provide`);
      }
      links[specifier] = target;
    }
    return `${JSON.stringify(file)}: [${JSON.stringify(links)}, function (exports, require, module) {\n${js}\n}]`;
  });
  return [
    `(function (${params.join(", ")}) {`,
    `const __definitions = {\n${definitions.join(",\n")}\n};`,
    "const __records = {};",
    "function __require(file) {",
    "  if (__records[file]) return __records[file].exports;",
    "  const definition = __definitions[file];",
    '  if (!definition) throw new Error("bundle: no module " + file);',
    "  const module = { exports: {} };",
    "  __records[file] = module;",
    "  definition[1].call(module.exports, module.exports, (specifier) => __require(definition[0][specifier]), module);",
    "  return module.exports;",
    "}",
    `return { exports: __require(${JSON.stringify(start)}), require: __require };`,
    "})",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// the Rota profile
// ---------------------------------------------------------------------------

/** Enough React for the pure generator: no component ever renders through it. */
export const inertReact = () => ({
  useCallback: (callback) => callback,
  useEffect: () => {},
  useMemo: (factory) => factory(),
  // ROUTE-C5: the hook imports it; inert like the rest — never dispatched through.
  useReducer: (_reducer, initialArg, init) => [init !== undefined ? init(initialArg) : initialArg, () => {}],
  useRef: (value) => ({ current: value }),
  useState: (value) => [typeof value === "function" ? value() : value, () => {}],
});

/**
 * The environment of every Rota validator, declared once.
 *
 *   react               the caller's shim (a stateful one drives the hook; see
 *                       route-runtime-harness.mjs) or the inert one.
 *   src/lib/game-sounds Web Audio — environment, silenced.
 *   src/engine/scoring  stubbed to 0, as every Rota harness has always had it:
 *                       the score is not what these validators measure, and a
 *                       real score would change what the existing suites see.
 *
 * Everything else — difficulty, route-random, continuation, and whatever the
 * hook is split into — is the real module, from the same tree as the hook.
 */
export const routeMocks = ({ react } = {}) => ({
  react: react ?? inertReact(),
  "src/lib/game-sounds.ts": {
    playGentleErrorTone: () => {},
    playSuccessChime: () => {},
    playStoneBreak: () => {},
  },
  "src/engine/scoring.ts": { calculateEscapeMazeScore: () => 0 },
});

/**
 * The Rota, loaded for validation: the hook and everything it imports, from
 * one tree (`rev`, or the working tree), in one realm whose `Math.random` is
 * the tooling's seeded PRNG.
 *
 *   surface   private bindings the validator needs, by name. They are looked
 *             up in whichever Rota module declares them — or in the RNG seam,
 *             which declares `randomItem` since ROUTE-C2. A name declared in
 *             more than one of them is an error, as before.
 *   transforms, sourceOverrides, rev, react, mocks — as above.
 *
 * `routeRandom` is the SAME instance the hook and `difficulty.ts` draw from: a
 * seed armed through it is the seed generation and the Hunter both see.
 */
export function loadRouteModules({
  root,
  rev = null,
  sourceOverrides,
  transforms,
  react,
  mocks,
  surface = [],
  entry = ROUTE_HOOK,
  tree,
} = {}) {
  let random = createSeededRandom(1);
  const seededMath = Object.create(Math);
  seededMath.random = () => random();

  const graph = createModuleGraph({
    tree: tree ?? openSourceTree({ root, rev, sourceOverrides }),
    transforms,
    mocks: { ...routeMocks({ react }), ...mocks },
    globals: { console, Math: seededMath, Date, Set, Map, setTimeout, clearTimeout, performance },
    exposeInternals: exposesRouteSurface,
  });
  const hook = graph.require(entry);
  const api = graph.internals(surface);

  return {
    graph,
    hook,
    api,
    sandbox: graph.sandbox,
    seededMath,
    setSeed(seed) {
      random = createSeededRandom(seed);
    },
    /** The RNG seam, as the hook's graph sees it (loaded on demand for trees that predate it). */
    get routeRandom() {
      return graph.require(ROUTE_RANDOM_SEAM);
    },
  };
}

/**
 * The Rota's own logic sources — the hook and the modules under
 * `ROUTE_MODULE_DIR` it reaches at run time — for validators whose question is
 * about the code itself ("nothing in the Rota mentions X"). Read, never run.
 */
export function readRouteLogicSources({ root, rev = null, sourceOverrides, tree } = {}) {
  const sources = tree ?? openSourceTree({ root, rev, sourceOverrides });
  return sources
    .closure(ROUTE_HOOK)
    .filter((file) => file.startsWith(ROUTE_MODULE_DIR))
    .map((file) => ({ file, source: sources.read(file) }));
}

// ---------------------------------------------------------------------------
// ROUTE-C7A — the RNG seam's one sanctioned edit
// ---------------------------------------------------------------------------

/** The last revision whose RNG seam had no checkpoint: what ROUTE-C7A is measured against. */
export const ROUTE_C7A_BASE = "f19f319947735ea8b834b756e30022ec30e53f3c";
/** C7A's generation contract. A tree that has it has C7A's seam. */
export const ROUTE_GENERATION_JOB = "src/games/escape-maze/route-generation-job.ts";
/**
 * What ROUTE-C7A changed in route-random.ts, by top-level name. `rewritten`:
 * the PRNG's state left `createSeededDraw`'s closure for the module-level
 * `seededState`, which disarming now resets. `added`: that state and the
 * checkpoint contract. Every other statement — the header, `routeRandom`,
 * `randomItem`, arming, `getArmedRouteSeed`, `beginSeededGeneration` — is
 * untouched. route-worker-rng-handoff-tests.mjs holds the rewritten two to
 * their exact edit and every stream to the baseline's, draw for draw.
 */
export const ROUTE_RANDOM_C7A_EDIT = Object.freeze({
  rewritten: Object.freeze(["createSeededDraw", "clearRouteRandomSeed"]),
  added: Object.freeze(["seededState", "RouteRandomCheckpoint", "getRouteRandomCheckpoint", "restoreRouteRandomCheckpoint"]),
});

/** Top-level statements of a module as [name | null, full text], in order; the texts concatenate back to the source. */
export function topLevelStatements(file, source) {
  const sf = parse(file, source);
  const nameOf = (statement) => {
    if (ts.isVariableStatement(statement)) {
      const names = statement.declarationList.declarations.map((d) => (ts.isIdentifier(d.name) ? d.name.text : null));
      return names.length === 1 ? names[0] : null;
    }
    return statement.name && ts.isIdentifier(statement.name) ? statement.name.text : null;
  };
  return [
    ...sf.statements.map((statement) => [nameOf(statement), statement.getFullText(sf)]),
    [null, sf.endOfFileToken.getFullText(sf)],
  ];
}

/**
 * route-random.ts as the earlier extractions (C2–C6) knew it: on a tree with
 * C7A's contract, the tree's seam with C7A's additions dropped and its two
 * rewritten declarations put back as they were at `ROUTE_C7A_BASE`; on any
 * other tree, the seam as it is. An earlier validator comparing this with its
 * own baseline still sees every other byte of the seam — so an edit anywhere
 * else in it, or a C7A name that went missing, still fails that comparison.
 */
export function routeRandomBeforeC7A(tree) {
  const text = tree.read(ROUTE_RANDOM_SEAM);
  if (!tree.exists(ROUTE_GENERATION_JOB)) return text;
  const before = new Map(
    topLevelStatements(ROUTE_RANDOM_SEAM, openSourceTree({ root: tree.root, rev: ROUTE_C7A_BASE }).read(ROUTE_RANDOM_SEAM)).filter(
      ([name]) => name,
    ),
  );
  const statements = topLevelStatements(ROUTE_RANDOM_SEAM, text);
  const names = statements.map(([name]) => name);
  if (![...ROUTE_RANDOM_C7A_EDIT.rewritten, ...ROUTE_RANDOM_C7A_EDIT.added].every((name) => names.includes(name))) return text;
  return statements
    .filter(([name]) => !ROUTE_RANDOM_C7A_EDIT.added.includes(name))
    .map(([name, statement]) => (ROUTE_RANDOM_C7A_EDIT.rewritten.includes(name) ? before.get(name) : statement))
    .join("");
}

// ---------------------------------------------------------------------------
// ROUTE-C7B — the hook's and the Rota view's sanctioned edit
// ---------------------------------------------------------------------------

/** The last revision whose hook generated its boards synchronously: what ROUTE-C7B is measured against. */
export const ROUTE_C7B_BASE = "e8971eb4f8f37207c2f76840f4ea0d1ecc4356ae";
/** C7B's hook state (the match and its generation lifecycle). A tree that has it has C7B's lifecycle. */
export const ROUTE_SESSION = "src/games/escape-maze/route-session.ts";
/** C7B's async seam: command/response, executor, latest-wins acceptance. */
export const ROUTE_GENERATION_CLIENT = "src/games/escape-maze/route-generation-client.ts";
export const ROUTE_GAME_VIEW = "src/games/escape-maze/RouteStrategyGame.tsx";
export const ROUTE_VISUAL_CSS = "src/games/escape-maze/route-visual.css";

/**
 * What ROUTE-C7B changed in the hook, by statement. Module level: the imports
 * of the new state and client (and route-state's types), and the comment on
 * the `generateMaze` re-export. Inside `useEscapeMaze`: `rewritten` are the
 * statements whose text C7B replaced (the reducer and the state's
 * destructuring, the derived views that now exist only with a board, the
 * Start/Restart/mode functions and `startNewMaze`, which ask for and receive a
 * board, the keyboard effect and the return); `added` are the lifecycle's own
 * statements; `guarded` are the three inputs that gained exactly one line,
 * `if (awaitingRoute) return;`, as their first statement; and the turn —
 * `runDefenderPhase`, `tryMovePlayer`, `chooseReward`, `breakWall`, the Chest
 * flags, the counts and the score — moved, unchanged, into `builder`. Every
 * other statement is where it was, byte for byte.
 */
export const ROUTE_HOOK_C7B_EDIT = Object.freeze({
  moduleRewritten: Object.freeze(["import:@/games/escape-maze/route-state", "export:generateMaze,posKey,positionsEqual"]),
  moduleAdded: Object.freeze([
    "import:@/games/escape-maze/route-session",
    "import:@/games/escape-maze/route-generation-client",
    "import:@/games/escape-maze/route-state:type",
  ]),
  rewritten: Object.freeze([
    "state,dispatch",
    "difficulty,mazeMap,player,guardian,sentinel,collectedStars,turns,blockedMoves,errors,status,message,blockedShake,moveTick,triggeredTraps,chestOpened,rewardSelected,rewardSpent,brokenWall",
    "walls",
    "portalDefenceZone",
    "collectedSet",
    "triggeredTrapSet",
    "breakTargets",
    "startNewMaze",
    "startGame",
    "restartGame",
    "changeDifficulty",
    "effect:keyboard",
    "return",
  ]),
  added: Object.freeze([
    "route,generation",
    "awaitingRoute",
    "requestedDifficulty",
    "effect:generation",
    "requestNewMaze",
    "retryGeneration",
    "boardMap",
    "boardBrokenWall",
    "boardCollectedStars",
    "boardTriggeredTraps",
    "boardStatus",
    "boardPlayer",
    "boardChoicePending",
    "boardPickaxeAvailable",
    "game",
  ]),
  guarded: Object.freeze(["tryMovePlayer", "chooseReward", "breakWall"]),
  guard: "if (awaitingRoute) return;",
  builder: "playRoute",
});

/**
 * What ROUTE-C7B changed in the Rota's view: the hook's import (its `MazeMap`
 * type), and `RouteStrategyGame`, which became the outer component (the
 * board's code, the hook, the first board's pending/failed screen) over
 * `RouteSessionView` (the view it was, with the pending board disabling its
 * controls). Every other statement is byte for byte. Whether the view on an
 * accepted board is the one it was is not a question of text:
 * route-generation-lifecycle-tests renders both and compares them.
 */
export const ROUTE_GAME_C7B_EDIT = Object.freeze({
  moduleRewritten: Object.freeze(["import:@/games/escape-maze/useEscapeMaze", "RouteStrategyGame"]),
  moduleAdded: Object.freeze([
    "GENERATION_PENDING_MESSAGE",
    "GENERATION_ERROR_MESSAGE",
    "RouteGame",
    "PlayableRouteGame",
    "RouteGenerationRetry",
    "RouteSessionView",
  ]),
});

/** The one rule ROUTE-C7B appended to route-visual.css: disabled controls while a board is pending. */
export const ROUTE_VISUAL_C7B_RULE = `
/*
 * ROUTE-C7B — while the next board is being prepared (or failed), the match is
 * frozen: its controls are disabled, visibly and without any new animation.
 */
.rsg-shell button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
`;

/** A statement's key: its declared names, the module an import reads, an export's names, or what an effect is for. */
function statementKey(sf, statement) {
  if (ts.isImportDeclaration(statement)) {
    const typeOnly = statement.importClause?.isTypeOnly ? ":type" : "";
    return `import:${statement.moduleSpecifier.text}${typeOnly}`;
  }
  if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
    return `export${statement.isTypeOnly ? "-type" : ""}:${statement.exportClause.elements.map((e) => e.name.text).join(",")}`;
  }
  if (ts.isVariableStatement(statement)) {
    const names = [];
    const collect = (name) => {
      if (ts.isIdentifier(name)) names.push(name.text);
      else for (const element of name.elements) if (!ts.isOmittedExpression(element)) collect(element.name);
    };
    for (const declaration of statement.declarationList.declarations) collect(declaration.name);
    return names.join(",");
  }
  if (ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression)) {
    const text = statement.getText(sf);
    if (/^useEffect\(/.test(text)) return text.includes('"keydown"') ? "effect:keyboard" : text.includes("startRouteGeneration") ? "effect:generation" : "effect:?";
  }
  if (ts.isReturnStatement(statement)) return "return";
  if (statement.name && ts.isIdentifier(statement.name)) return statement.name.text;
  return `?:${statement.getText(sf).slice(0, 40)}`;
}

const keyedStatements = (sf, statements) => statements.map((statement) => [statementKey(sf, statement), statement.getFullText(sf)]);

const dedent = (text, by) => text.replace(new RegExp(`\\n {${by}}`, "g"), "\n");

/**
 * The hook as it was before ROUTE-C7B, rebuilt from the tree's own hook: C7B's
 * rewritten statements put back as they were at `ROUTE_C7B_BASE`, its added
 * statements dropped, the turn taken back out of `playRoute`, and the one
 * guard line of each input dropped — every other statement is the tree's own
 * text. On a tree without C7B's lifecycle (or one missing a C7B statement) it
 * is the tree's hook as it is. route-generation-lifecycle-tests holds it equal
 * to the base hook byte for byte; earlier extractions (C2–C7A) read the hook
 * through it, so an edit anywhere else in the hook still fails them.
 */
export function routeHookBeforeC7B(tree) {
  const text = tree.read(ROUTE_HOOK);
  if (!tree.exists(ROUTE_SESSION)) return text;
  const base = openSourceTree({ root: tree.root, rev: ROUTE_C7B_BASE }).read(ROUTE_HOOK);
  const sfNow = parse(ROUTE_HOOK, text);
  const sfBase = parse(ROUTE_HOOK, base);
  const hookOf = (sf) => sf.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === "useEscapeMaze");
  const fnNow = hookOf(sfNow);
  const fnBase = hookOf(sfBase);
  if (!fnNow?.body || !fnBase?.body) return text;
  const edit = ROUTE_HOOK_C7B_EDIT;

  // Module level, in the base's order.
  const moduleNow = new Map(keyedStatements(sfNow, sfNow.statements));
  const moduleBase = keyedStatements(sfBase, sfBase.statements);
  // Inside the hook: its own statements, and the builder's (one level deeper).
  const bodyNow = new Map(keyedStatements(sfNow, fnNow.body.statements));
  const builder = fnNow.body.statements.find((s) => statementKey(sfNow, s) === edit.builder);
  const builderFn = builder && ts.isVariableStatement(builder) ? builder.declarationList.declarations[0].initializer : null;
  if (!builderFn || !ts.isArrowFunction(builderFn) || !ts.isBlock(builderFn.body)) return text;
  for (const [key, statement] of keyedStatements(sfNow, builderFn.body.statements)) {
    if (!bodyNow.has(key)) bodyNow.set(key, dedent(statement, 2));
  }
  // A kept statement's own blank lines in front of it follow its new neighbours; what precedes it is compared from its
  // first comment or token on.
  const leadingBlank = (statement) => statement.match(/^\s*/)[0];
  const asAtBase = (baseStatement, nowStatement) => leadingBlank(baseStatement) + nowStatement.slice(leadingBlank(nowStatement).length);
  const unguard = (key, statement) => {
    if (!edit.guarded.includes(key)) return statement;
    const guardLine = `\n    ${edit.guard}`;
    return statement.includes(guardLine) ? statement.replace(guardLine, "") : statement;
  };
  const missing = [];
  const body = keyedStatements(sfBase, fnBase.body.statements)
    .map(([key, statement]) => {
      if (edit.rewritten.includes(key)) return statement;
      if (!bodyNow.has(key)) {
        missing.push(key);
        return "";
      }
      return asAtBase(statement, unguard(key, bodyNow.get(key)));
    })
    .join("");
  if (missing.length) return text;
  const fnText = fnNow.getFullText(sfNow);
  const head = fnText.slice(0, fnNow.body.getStart(sfNow) - fnNow.getFullStart() + 1);
  const tail = base.slice(fnBase.body.statements.end, fnBase.end);
  const hook = head + body + tail;
  return (
    moduleBase
      .map(([key, statement]) =>
        key === "useEscapeMaze" ? hook : edit.moduleRewritten.includes(key) || !moduleNow.has(key) ? statement : moduleNow.get(key),
      )
      .join("") + sfBase.endOfFileToken.getFullText(sfBase)
  );
}

/**
 * RouteStrategyGame.tsx as it was before ROUTE-C7B: its two rewritten
 * statements put back as at `ROUTE_C7B_BASE`, its added ones dropped, every
 * other statement the tree's own. The tree's view as it is otherwise.
 */
export function routeGameBeforeC7B(tree) {
  const text = tree.read(ROUTE_GAME_VIEW);
  if (!tree.exists(ROUTE_SESSION)) return text;
  const base = openSourceTree({ root: tree.root, rev: ROUTE_C7B_BASE }).read(ROUTE_GAME_VIEW);
  const sfNow = parse(ROUTE_GAME_VIEW, text);
  const sfBase = parse(ROUTE_GAME_VIEW, base);
  const now = new Map(keyedStatements(sfNow, sfNow.statements));
  return (
    keyedStatements(sfBase, sfBase.statements)
      .map(([key, statement]) => (ROUTE_GAME_C7B_EDIT.moduleRewritten.includes(key) || !now.has(key) ? statement : now.get(key)))
      .join("") + sfBase.endOfFileToken.getFullText(sfBase)
  );
}

/** route-visual.css without the one rule ROUTE-C7B appended. */
export function routeVisualBeforeC7B(tree) {
  const text = tree.read(ROUTE_VISUAL_CSS);
  return text.endsWith(ROUTE_VISUAL_C7B_RULE) ? text.slice(0, -ROUTE_VISUAL_C7B_RULE.length) : text;
}

/**
 * A Rota file's text as the checks before ROUTE-C7B knew it: the hook, the
 * view and the stylesheet through their C7B reversal, every other file as it
 * is (the RNG seam included: C7A's reversal is `routeRandomBeforeC7A`'s).
 */
export function routeFileBeforeC7B(tree, file) {
  const repoPath = tree.toRepoPath(file);
  if (repoPath === ROUTE_HOOK) return routeHookBeforeC7B(tree);
  if (repoPath === ROUTE_GAME_VIEW) return routeGameBeforeC7B(tree);
  if (repoPath === ROUTE_VISUAL_CSS) return routeVisualBeforeC7B(tree);
  return tree.read(repoPath);
}

/** The files ROUTE-C7B added to the Rota. They did not exist before it. */
export const ROUTE_C7B_ADDED_FILES = Object.freeze([ROUTE_SESSION, ROUTE_GENERATION_CLIENT]);

/**
 * A read-only view of `tree` as the checks written before ROUTE-C7B read it:
 * every Rota file through `routeFileBeforeC7B`, and C7B's two new modules
 * absent — so its graph questions (`closure`, `locate`, `declaring`,
 * `runtimeImports`) answer for that text too. For TEXT checks only (structure,
 * preserved): the code that runs is the tree's own, so a validator loads its
 * runs from the tree, never from this view. On a tree without C7B it is the
 * tree.
 */
export function treeBeforeC7B(tree) {
  if (!tree.exists(ROUTE_SESSION)) return tree;
  const added = (file) => ROUTE_C7B_ADDED_FILES.includes(tree.toRepoPath(file));
  const view = openSourceTree({
    root: tree.root,
    underlying: {
      rev: tree.rev,
      exists: (file) => !added(file) && tree.exists(file),
      read: (file) => {
        if (added(file)) throw new Error(`route-module-loader: ${tree.toRepoPath(file)} does not exist before ROUTE-C7B`);
        return routeFileBeforeC7B(tree, file);
      },
    },
  });
  return { ...view, beforeC7B: true };
}
