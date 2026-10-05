/**
 * ROUTE-C7C — the Rota's board generation runs in a Web Worker: the boundary, tested.
 *
 *   src/games/escape-maze/route-generation.worker.ts          the Worker entry: one command in, C7A's run
 *                                                              (`runRouteGenerationSync`), one reply out. The one
 *                                                              production caller of the run, and so of `generateMaze`.
 *   src/games/escape-maze/route-generation-worker-executor.ts the product's executor: one dedicated Worker per command,
 *                                                              terminated on reply, failure or cancel; every failure is
 *                                                              C7B's failure response (no silent main-thread fallback).
 *   src/games/escape-maze/route-generation-worker-protocol.ts the two messages and the main thread's shape check.
 *   src/games/escape-maze/route-generation-runner.ts          C7A's run and C7B's local executor, moved verbatim out
 *                                                              of the job and the client, so the main thread's graph no
 *                                                              longer reaches generation.
 *
 * C7B's lifecycle (route-session, the hook's effect, `startRouteGeneration`) is untouched: only the binding of
 * `routeGenerationExecutor` changed, and where the run lives.
 *
 * Groups:
 *
 *   [structure]   the static gate (fails at bd75e69): the product binding is the Worker executor; the Worker entry
 *                 exists, runs the runner and nothing else; the protocol is closed; the Worker's graph reaches
 *                 generation and nothing that renders, plays, stores or holds session state; the main thread's graph
 *                 (hook, view) reaches neither generation nor the runner, and no main-thread product file calls
 *                 them; no Worker is constructed at module level; the Worker URL is the analysable
 *                 `new URL("./route-generation.worker.ts", import.meta.url)`; no fallback to local generation.
 *   [preserved]   against bd75e69: C7C's edit of the job, the client and the hook is exactly the declared one
 *                 (route-module-loader.mjs `routeFileBeforeC7C` gives bd75e69 back byte for byte, every statement
 *                 accounted for); the run and the local executor moved byte for byte; every other product file is
 *                 untouched — the lifecycle, the view, the board, the domain.
 *   [executor]    the REAL executor in a module realm whose `Worker` is a host that runs the REAL Worker entry (one
 *                 fresh realm per Worker, messages through structuredClone, a virtual clock for generation time): ready,
 *                 a throwing generation, constructor failure, script load error, an unreadable job, an unreadable
 *                 reply, malformed replies, a silent Worker, cancel before start, cancel mid-generation, a reply
 *                 already queued when cancelled, a double post, the request-id collision of two hook instances, a
 *                 stale answer never reaching the RNG. The host is adversarial: a reply queued before terminate is
 *                 still dispatched — only the executor's own token stops it.
 *   [hook]        the REAL hook (route-runtime-harness shim) with the product binding and the host: the first board
 *                 (pending → Worker → board, no board before the reply), Start, Restart, a double Restart, rapid
 *                 Restarts and the mode race (only the last arrives, and it is not delayed by the ones it superseded),
 *                 leaving while pending, no Worker leaked over 200 Restarts, failure → retry on a new Worker under a new
 *                 request, continuation, and generation never on the main realm.
 *   [rng]         seeded sessions through the Worker (R1–R3 × easy/medium/hard × seeds: mount, Start, the Hunter's
 *                 moves, Restart, more moves, the next draws) equal bd75e69's local generation render for render and
 *                 checkpoint for checkpoint; every seeded request carries its checkpoint; normal play carries none —
 *                 the Worker draws its own `Math.random`, the main realm's is never touched by generation.
 *   [clone]       a real `node:worker_threads` isolate runs the Worker entry's bundle: the map crosses back by real
 *                 structured clone (walls a `Set`, in order) and the seeded checkpoint continues exactly.
 *
 * `--mutants` applies, in memory, the mutations C7C must not let through and requires each to be caught.
 * `--rev=<commit>` runs the static groups on that tree (`--rev=bd75e69`: [structure] must fail).
 *
 * Usage: node tools/validation/route-generation-worker-tests.mjs [--rev=<commit> | --mutants]
 * Writes nothing. Exit 0 = every check holds (every mutant caught), 1 = a check failed, 3 = usage error.
 */
import path from "node:path";
import { execFileSync } from "node:child_process";
import { Worker as NodeWorker } from "node:worker_threads";
import ts from "typescript";

import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";
import {
  ROUTE_C7C_BASE,
  ROUTE_C7C_ADDED_FILES,
  ROUTE_C7C_EDIT,
  ROUTE_GAME_VIEW,
  ROUTE_GENERATION_CLIENT,
  ROUTE_GENERATION_JOB,
  ROUTE_GENERATION_RUNNER,
  ROUTE_GENERATION_WORKER,
  ROUTE_GENERATION_WORKER_EXECUTOR,
  ROUTE_GENERATION_WORKER_PROTOCOL,
  ROUTE_HOOK,
  ROUTE_RANDOM_SEAM,
  ROUTE_SESSION,
  createModuleGraph,
  emitModuleBundle,
  moduleStatementKeys,
  openSourceTree,
  routeFileBeforeC7C,
} from "./route-module-loader.mjs";
import { createSeededRandom } from "./route-lab.mjs";
import { applyAction, mapDigest, nextAction, observeRoute } from "./route-react-runtime.mjs";
import { loadRouteRuntime } from "./route-runtime-harness.mjs";

const ROUTE_GENERATION = "src/games/escape-maze/route-generation.ts";
const ROUTE_STATE = "src/games/escape-maze/route-state.ts";
const ROUTE_EVENTS = "src/games/escape-maze/route-events.ts";
const BASELINE = ROUTE_C7C_BASE;
/** How long a generation takes in the host's virtual time, and a Worker's start-up. */
const GENERATION_MS = 400;
const STARTUP_MS = 30;
const WATCHDOG_MS = 30_000;

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
const MUTANTS = args.includes("--mutants");

// =================================================================================================
// small things
// =================================================================================================

const canonical = (value) =>
  JSON.stringify(value, (_key, v) =>
    v instanceof Set || v?.constructor?.name === "Set"
      ? { $set: [...v] }
      : v && typeof v === "object" && !Array.isArray(v)
        ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]]))
        : v,
  );
const same = (a, b) => canonical(a) === canonical(b);
const sorted = (list) => [...list].sort();
const codeOnly = (source) => source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const parse = (file, source) => ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const read = (tree, file) => (tree.exists(file) ? tree.read(file) : null);

function recorder() {
  const out = [];
  return {
    out,
    record(id, kind, name, pass, detail = {}) {
      out.push({ id, kind, name, pass: Boolean(pass), detail });
    },
    guard(id, kind, name, fn) {
      try {
        fn();
      } catch (error) {
        out.push({ id, kind, name, pass: false, detail: { threw: String(error?.stack ?? error).slice(0, 700) } });
      }
    },
    async guardAsync(id, kind, name, fn) {
      try {
        await fn();
      } catch (error) {
        out.push({ id, kind, name, pass: false, detail: { threw: String(error?.stack ?? error).slice(0, 700) } });
      }
    },
  };
}

function show(results) {
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.id} [${r.kind}] — ${r.name}`);
    for (const [key, value] of Object.entries(r.detail ?? {})) {
      const text = typeof value === "string" ? value : String(JSON.stringify(value));
      console.log(`        ${key}: ${text.length > 900 ? `${text.slice(0, 897)}...` : text}`);
    }
  }
}

/** Imports of a module: specifier and whether it is type-only. Exports by name. */
function moduleShape(file, source) {
  const sf = parse(file, source);
  const exported = [];
  const imports = [];
  const exportedHere = (node) => ts.getModifiers?.(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  for (const statement of sf.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      const named = clause?.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements : [];
      const typeOnly = Boolean(clause?.isTypeOnly) || (named.length > 0 && named.every((e) => e.isTypeOnly) && !clause?.name);
      imports.push({ specifier: statement.moduleSpecifier.text, kind: typeOnly ? "type" : "runtime", names: named.map((e) => e.name.text) });
      continue;
    }
    if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) exported.push(element.name.text);
      continue;
    }
    if (!exportedHere(statement)) continue;
    if (ts.isVariableStatement(statement)) for (const d of statement.declarationList.declarations) exported.push(d.name.getText(sf));
    else if (statement.name) exported.push(statement.name.text);
  }
  return { exported: sorted(new Set(exported)), imports, sf };
}
const runtimeImports = (shape) => sorted(shape.imports.filter((i) => i.kind === "runtime").map((i) => i.specifier));

/** Every `new X(` and call of `name` in a source, with whether it sits at module level (outside any function). */
function sites(file, source, { calls = [], news = [] }) {
  const sf = parse(file, source);
  const out = [];
  const visit = (node, depth) => {
    const inFn = depth + (ts.isFunctionLike(node) ? 1 : 0);
    if (ts.isNewExpression(node) && ts.isIdentifier(node.expression) && news.includes(node.expression.text)) {
      out.push({ kind: "new", name: node.expression.text, moduleLevel: depth === 0, text: node.getText(sf) });
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const id = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : null;
      if (calls.includes(id)) out.push({ kind: "call", name: id, moduleLevel: depth === 0, text: node.getText(sf).slice(0, 120) });
    }
    ts.forEachChild(node, (child) => visit(child, inFn));
  };
  visit(sf, 0);
  return out;
}

/** Product sources (ts/tsx) of a tree. */
function productFiles(tree) {
  const list = tree.rev
    ? execFileSync("git", ["ls-tree", "-r", "--name-only", tree.rev, "src/"], { encoding: "utf8" }).split("\n")
    : execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "src/"], { encoding: "utf8", cwd: tree.root }).split("\n");
  return list.filter((file) => /\.(ts|tsx|css)$/.test(file) && tree.exists(file));
}

/** Like `tree.closure`, through scripts only (a view imports its stylesheet, which has no imports to follow). */
function scriptClosure(tree, entry) {
  const seen = [entry];
  for (let i = 0; i < seen.length; i += 1) {
    for (const specifier of tree.runtimeImports(seen[i])) {
      const file = tree.resolve(specifier, seen[i]);
      if (file && /\.tsx?$/.test(file) && !seen.includes(file)) seen.push(file);
    }
  }
  return seen;
}

/** The top-level statement declaring `name`, as text without its leading trivia. */
function declarationText(file, source, name) {
  const sf = parse(file, source);
  for (const statement of sf.statements) {
    const names = ts.isVariableStatement(statement)
      ? statement.declarationList.declarations.map((d) => d.name.getText(sf))
      : statement.name
        ? [statement.name.text]
        : [];
    if (names.includes(name)) return statement.getText(sf);
  }
  return null;
}
/** The JSDoc directly in front of a declaration. */
function leadingDoc(file, source, name) {
  const sf = parse(file, source);
  for (const statement of sf.statements) {
    const names = ts.isVariableStatement(statement) ? statement.declarationList.declarations.map((d) => d.name.getText(sf)) : statement.name ? [statement.name.text] : [];
    if (!names.includes(name)) continue;
    const full = statement.getFullText(sf);
    const docs = full.slice(0, full.length - statement.getText(sf).length).match(/\/\*\*[\s\S]*?\*\//g);
    return docs?.at(-1) ?? null;
  }
  return null;
}

// =================================================================================================
// the host: a virtual clock, and Workers that run the REAL entry in fresh realms
// =================================================================================================

/** setTimeout/clearTimeout with delays honoured in virtual time. */
function createClock() {
  let now = 0;
  let seq = 0;
  const tasks = [];
  const clock = {
    get now() {
      return now;
    },
    get pending() {
      return tasks.length;
    },
    setTimeout(fn, ms = 0, ...rest) {
      const id = ++seq;
      tasks.push({ id, due: now + Math.max(0, Number(ms) || 0), fn, rest });
      return id;
    },
    clearTimeout(id) {
      const i = tasks.findIndex((t) => t.id === id);
      if (i >= 0) tasks.splice(i, 1);
    },
    /** Run the next due task (advancing time to it). False when none is left, or the next is after `until`. */
    step(until = Infinity) {
      if (!tasks.length) return false;
      let best = 0;
      for (let i = 1; i < tasks.length; i += 1) {
        if (tasks[i].due < tasks[best].due || (tasks[i].due === tasks[best].due && tasks[i].id < tasks[best].id)) best = i;
      }
      if (tasks[best].due > until) return false;
      const [task] = tasks.splice(best, 1);
      now = Math.max(now, task.due);
      task.fn(...task.rest);
      return true;
    },
    /** Run every task due up to `until` (default: all of them). Returns how many ran. */
    run(until = Infinity) {
      let n = 0;
      while (clock.step(until)) if ((n += 1) > 100000) throw new Error("clock: runaway");
      if (until !== Infinity) now = Math.max(now, until);
      return n;
    },
  };
  return clock;
}

/** A `Math` whose `random` is the tooling's PRNG, counted; it can be made to throw. */
function realmMath(seed) {
  const math = Object.create(Math);
  const stream = createSeededRandom(seed);
  const state = { draws: 0, throwing: false };
  math.random = () => {
    if (state.throwing) throw new Error("generation forced to fail in the Worker");
    state.draws += 1;
    return stream();
  };
  return { math, state };
}

/**
 * Workers for a module realm. Each `new Worker(url, options)` evaluates the REAL entry's bundle (route-module-loader
 * `emitModuleBundle`, the same files and transpilation as the graph) in a fresh registry — its own route-random, its own
 * generation, its own `Math` — with `self` a minimal worker scope. Messages cross by `structuredClone` both ways.
 *
 * Time: a job is read `STARTUP_MS` after it is posted (a cold Worker) and generated `cost` later; terminating before
 * then interrupts it. A reply is dispatched on the main side at the moment it is posted — through the handler as it
 * was when the reply was QUEUED, even if the Worker is terminated before it is dispatched (an already-queued message
 * event): only the executor's own token can stop it.
 *
 * `mode` makes the next Workers misbehave: constructThrows, loadError, silent, jobUnreadable, replyUnreadable,
 * doublePost, replyDelay (ms between posting and dispatching), reply (a function rewriting the reply), mathThrows.
 */
function createWorkerHost({ tree, transforms, clock, mathSeed = 7000, cost = () => GENERATION_MS }) {
  const bundle = emitModuleBundle({ tree, transforms, entry: ROUTE_GENERATION_WORKER, params: ["self", "Math"] });
  const factory = (0, eval)(bundle);
  const host = {
    constructed: [],
    alive: 0,
    terminated: 0,
    jobs: [],
    replies: [],
    generations: 0,
    mode: {},
    nextSeed: mathSeed,
  };
  class HostWorker {
    constructor(url, options) {
      const mode = { ...host.mode };
      if (mode.constructThrows) throw new Error("Worker construction blocked (simulated CSP)");
      this.url = String(url?.href ?? url);
      this.options = options;
      this.mode = mode;
      this.isAlive = true;
      this.onmessage = null;
      this.onerror = null;
      this.onmessageerror = null;
      this.pending = [];
      host.constructed.push(this);
      host.alive += 1;
      const listeners = { message: [], messageerror: [] };
      this.math = realmMath(host.nextSeed++);
      if (mode.mathThrows) this.math.state.throwing = true;
      this.scope = {
        addEventListener: (type, fn) => listeners[type]?.push(fn),
        removeEventListener: () => {},
        postMessage: (data) => {
          const clone = structuredClone(data);
          host.replies.push(clone);
          const post = (payload) => {
            const handler = mode.replyUnreadable ? this.onmessageerror : this.onmessage;
            const dispatch = () => handler?.call(this, { data: payload });
            if (mode.replyDelay) clock.setTimeout(dispatch, mode.replyDelay);
            else dispatch();
          };
          post(mode.reply ? mode.reply(clone) : clone);
          if (mode.doublePost) post(structuredClone(clone));
        },
        close() {},
      };
      this.listeners = listeners;
      if (mode.loadError) {
        this.pending.push(clock.setTimeout(() => this.raise(""), STARTUP_MS));
        return;
      }
      // the entry's own code, in this Worker's realm: its listeners register now
      this.realm = factory(this.scope, this.math.math);
      // count generations in this realm without changing them
      const generation = this.realm.require(ROUTE_GENERATION);
      const real = generation.generateMaze;
      generation.generateMaze = (...a) => {
        host.generations += 1;
        return real(...a);
      };
    }
    raise(message) {
      if (!this.isAlive) return;
      const handler = this.onerror;
      const event = { message, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
      handler?.call(this, event);
      this.lastError = event;
    }
    postMessage(data) {
      if (!this.isAlive) return;
      const clone = structuredClone(data);
      host.jobs.push(clone);
      if (this.mode.loadError || this.mode.silent) return;
      const type = this.mode.jobUnreadable ? "messageerror" : "message";
      this.pending.push(
        clock.setTimeout(() => {
          if (!this.isAlive) return;
          try {
            for (const fn of this.listeners[type]) fn({ data: clone });
          } catch (error) {
            this.raise(String(error?.message ?? error));
          }
        }, STARTUP_MS + cost(this)),
      );
    }
    terminate() {
      if (!this.isAlive) return;
      this.isAlive = false;
      host.alive -= 1;
      host.terminated += 1;
      for (const id of this.pending) clock.clearTimeout(id);
    }
  }
  host.Worker = HostWorker;
  return host;
}

/** The main realm of a tree, for the executor alone: the client, the job, the seam, with the host's Worker and clock. */
function mainRealm({ tree, transforms, host, clock, sourceOverrides }) {
  const graph = createModuleGraph({
    tree: tree ?? openSourceTree({ sourceOverrides }),
    transforms,
    globals: { console, Set, Map, Math: Object.create(Math), URL, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, Worker: host?.Worker },
  });
  return {
    graph,
    client: graph.require(ROUTE_GENERATION_CLIENT),
    job: graph.require(ROUTE_GENERATION_JOB),
    seam: graph.require(ROUTE_RANDOM_SEAM),
    executor: graph.tree.exists(ROUTE_GENERATION_WORKER_EXECUTOR) ? graph.require(ROUTE_GENERATION_WORKER_EXECUTOR).runRouteGenerationInWorker : null,
  };
}

/** The map a seeded request produces, computed by the runner in a realm of its own (the expected answer). */
function referenceRun(tree, request) {
  const graph = createModuleGraph({ tree, globals: { console, Set, Map, Math: Object.create(Math) } });
  const runner = graph.require(tree.exists(ROUTE_GENERATION_RUNNER) ? ROUTE_GENERATION_RUNNER : ROUTE_GENERATION_JOB);
  return runner.runRouteGenerationSync(structuredClone(request));
}

// =================================================================================================
// [structure]
// =================================================================================================

const WORKER_FORBIDDEN = /react|lucide|motion|babylon|RouteStrategyGame|RouteBabylonBoard|routeBabylonScene|\.css$|game-sounds|storage|components\/|src\/app\/|route-state|route-events|route-session|useEscapeMaze|continuation|route-generation-client|route-generation-worker-executor/i;
const PROTOCOL_EXPORTS = [
  "ROUTE_GENERATION_WORKER_PROTOCOL", "RouteGenerationWorkerJob", "RouteGenerationWorkerReply", "readRouteGenerationWorkerReply",
  // the C7B seam's message types, moved here unchanged (the client re-exports them): no import cycle, not even of types
  "RouteGenerationCommand", "RouteGenerationResponse", "RouteGenerationExecutor",
];
const RUNNER_EXPORTS = ["runRouteGenerationLocally", "runRouteGenerationSync"];

function structureChecks(tree) {
  const R = recorder();
  const client = read(tree, ROUTE_GENERATION_CLIENT) ?? "";
  const executor = read(tree, ROUTE_GENERATION_WORKER_EXECUTOR);
  const worker = read(tree, ROUTE_GENERATION_WORKER);
  const protocol = read(tree, ROUTE_GENERATION_WORKER_PROTOCOL);
  const runner = read(tree, ROUTE_GENERATION_RUNNER);
  const job = read(tree, ROUTE_GENERATION_JOB) ?? "";
  const hook = read(tree, ROUTE_HOOK) ?? "";

  // S1 — the product binding: the client's `routeGenerationExecutor` IS the Worker executor, imported from its module;
  // the client imports no runner, no generation and knows no local executor any more.
  R.guard("S1", "structure", "PRODUCT_BINDING_IS_THE_WORKER_EXECUTOR", () => {
    const shape = moduleShape(ROUTE_GENERATION_CLIENT, client);
    const binding = /export const routeGenerationExecutor: RouteGenerationExecutor =\s*runRouteGenerationInWorker;/.test(codeOnly(client));
    const imported = shape.imports.some(
      (i) => tree.resolve(i.specifier, ROUTE_GENERATION_CLIENT) === ROUTE_GENERATION_WORKER_EXECUTOR && i.kind === "runtime" && same(i.names, ["runRouteGenerationInWorker"]),
    );
    const runtime = runtimeImports(shape);
    const local = /runRouteGenerationLocally|runRouteGenerationSync|route-generation-runner|generateMaze\s*\(/.test(codeOnly(client));
    // and at run time: the client module's own binding (not rebound by any validator profile) is that function
    let identity = false;
    if (executor) {
      const graph = createModuleGraph({ tree, globals: { console, Set, Map, Math, setTimeout, clearTimeout } });
      identity = graph.require(ROUTE_GENERATION_CLIENT).routeGenerationExecutor === graph.require(ROUTE_GENERATION_WORKER_EXECUTOR).runRouteGenerationInWorker;
    }
    R.record("S1", "structure", "PRODUCT_BINDING_IS_THE_WORKER_EXECUTOR", binding && imported && !local && identity &&
      same(runtime, ["@/games/escape-maze/route-generation-job", "@/games/escape-maze/route-generation-worker-executor"]), {
      binding, imported, runtimeImports: runtime, knowsLocalGeneration: local, runtimeIdentity: identity,
    });
  });

  // S2 — the Worker entry: exists; imports the runner and the protocol at run time (the client's response type only as
  // a type); its message listener calls `runRouteGenerationSync` exactly once and posts exactly one reply on both
  // paths (ready, failed); an unreadable message is thrown (→ the Worker's `error`), never swallowed; it never closes.
  R.guard("S2", "structure", "WORKER_ENTRY_RUNS_THE_RUNNER_AND_ANSWERS_ONCE", () => {
    const exists = worker !== null;
    const shape = exists ? moduleShape(ROUTE_GENERATION_WORKER, worker) : null;
    const runtime = shape ? runtimeImports(shape) : [];
    const types = shape ? sorted(shape.imports.filter((i) => i.kind === "type").map((i) => i.specifier)) : [];
    const code = exists ? codeOnly(worker) : "";
    const runs = exists ? sites(ROUTE_GENERATION_WORKER, worker, { calls: ["runRouteGenerationSync"] }) : [];
    const posts = (code.match(/\bself\.postMessage\(/g) ?? []).length;
    const listeners = (code.match(/self\.addEventListener\("(message|messageerror)"/g) ?? []).map((m) => m.match(/"(\w+)"/)[1]);
    const throwsUnreadable = /self\.addEventListener\("messageerror", \(\) => \{\s*throw new Error\(/.test(code) && /if \(job\?\.protocol !== ROUTE_GENERATION_WORKER_PROTOCOL \|\| !job\.command\) \{\s*throw new Error\(/.test(code);
    const bothPaths = /response = \{\s*requestId: command\.requestId,\s*status: "ready",\s*result: runRouteGenerationSync\(command\.request\),\s*\};\s*\} catch \(error\) \{\s*response = \{\s*requestId: command\.requestId,\s*status: "failed",/.test(code);
    const closes = /\bclose\s*\(/.test(code);
    R.record("S2", "structure", "WORKER_ENTRY_RUNS_THE_RUNNER_AND_ANSWERS_ONCE",
      exists && same(runtime, ["@/games/escape-maze/route-generation-runner", "@/games/escape-maze/route-generation-worker-protocol"]) &&
        types.length === 0 && runs.length === 1 && !runs[0].moduleLevel && posts === 1 &&
        same(sorted(listeners), ["message", "messageerror"]) && throwsUnreadable && bothPaths && !closes,
      { exists, runtimeImports: runtime, typeImports: types, runCalls: runs.length, posts, listeners, throwsUnreadable, readyAndFailedBothPosted: bothPaths, closes },
    );
  });

  // S3 — the protocol is closed: exactly its two message types, the tag and the shape check; no run-time import; the
  // shape check demands the tag, the request id, a `Set` of walls, a grid, a stream that is null or two numbers, and a
  // failure that is a message.
  R.guard("S3", "structure", "PROTOCOL_CLOSED", () => {
    const exists = protocol !== null;
    const shape = exists ? moduleShape(ROUTE_GENERATION_WORKER_PROTOCOL, protocol) : null;
    const code = exists ? codeOnly(protocol) : "";
    const demands = {
      tag: /data\.protocol !== ROUTE_GENERATION_WORKER_PROTOCOL/.test(code),
      requestId: /response\.requestId !== requestId/.test(code),
      wallsSet: /map\.walls instanceof Set/.test(code),
      grid: /Array\.isArray\(map\.grid\)/.test(code),
      stream: /typeof random\.armedSeed === "number"/.test(code) && /typeof random\.state === "number"/.test(code),
      failureMessage: /typeof response\.message === "string"/.test(code),
    };
    R.record("S3", "structure", "PROTOCOL_CLOSED", exists && same(shape.exported, sorted(PROTOCOL_EXPORTS)) && runtimeImports(shape).length === 0 && Object.values(demands).every(Boolean), {
      exists, exported: shape?.exported, runtimeImports: shape ? runtimeImports(shape) : null, demands,
    });
  });

  // S4 — the Worker's graph: it reaches the runner, generation and the RNG seam, and nothing that renders, plays,
  // stores, holds session state or belongs to the main thread's lifecycle.
  R.guard("S4", "structure", "WORKER_GRAPH_IS_GENERATION_ONLY", () => {
    const exists = worker !== null;
    const closure = exists ? tree.closure(ROUTE_GENERATION_WORKER) : [];
    const forbidden = closure.filter((file) => WORKER_FORBIDDEN.test(file));
    const packages = exists
      ? closure.flatMap((file) => tree.runtimeImports(file).filter((s) => tree.resolve(s, file) === null))
      : [];
    R.record("S4", "structure", "WORKER_GRAPH_IS_GENERATION_ONLY",
      exists && [ROUTE_GENERATION_RUNNER, ROUTE_GENERATION, ROUTE_RANDOM_SEAM, ROUTE_GENERATION_WORKER_PROTOCOL].every((f) => closure.includes(f)) &&
        forbidden.length === 0 && packages.length === 0,
      { closure, forbidden, packageImports: packages },
    );
  });

  // S5 — the main thread's graph: the hook and the Rota's view reach neither generation nor the runner nor the Worker
  // entry; no product file but the Worker entry imports the runner; no product file but the runner imports generation
  // at run time; no main-thread product file calls `runRouteGenerationSync` or `generateMaze`.
  R.guard("S5", "structure", "MAIN_THREAD_GRAPH_HAS_NO_GENERATION", () => {
    const offMain = [ROUTE_GENERATION, ROUTE_GENERATION_RUNNER, ROUTE_GENERATION_WORKER];
    const hookClosure = tree.closure(ROUTE_HOOK);
    const viewClosure = scriptClosure(tree, ROUTE_GAME_VIEW);
    const reached = [...new Set([...hookClosure, ...viewClosure])].filter((f) => offMain.includes(f));
    const files = productFiles(tree).filter((f) => !f.endsWith(".css"));
    const importersOf = (target) =>
      files.filter((file) => file !== target && tree.runtimeImports(file).some((s) => tree.resolve(s, file) === target));
    const runnerImporters = importersOf(ROUTE_GENERATION_RUNNER);
    const generationImporters = importersOf(ROUTE_GENERATION);
    const callers = files
      .filter((f) => ![ROUTE_GENERATION, ROUTE_GENERATION_RUNNER, ROUTE_GENERATION_WORKER].includes(f))
      .flatMap((file) => sites(file, tree.read(file), { calls: ["runRouteGenerationSync", "generateMaze", "runRouteGenerationLocally"] }).map((s) => `${file}: ${s.name}`));
    R.record("S5", "structure", "MAIN_THREAD_GRAPH_HAS_NO_GENERATION",
      reached.length === 0 && same(runnerImporters, [ROUTE_GENERATION_WORKER]) && same(generationImporters, [ROUTE_GENERATION_RUNNER]) && callers.length === 0 && Boolean(worker),
      { hookClosure, reachedOffMainModules: reached, runnerImporters, generationRuntimeImporters: generationImporters, mainThreadCallers: callers },
    );
  });

  // S6 — no Worker at import: `new Worker` appears only inside the executor function, never at module level, in any
  // product file; and loading the whole main-thread graph with a counting `Worker` constructs none (nor throws when
  // there is no `Worker` at all, as during SSR).
  R.guard("S6", "structure", "NO_WORKER_CONSTRUCTED_AT_MODULE_EVALUATION", () => {
    const files = productFiles(tree).filter((f) => !f.endsWith(".css"));
    const all = files.flatMap((file) => sites(file, tree.read(file), { news: ["Worker", "SharedWorker"] }).map((s) => ({ file, ...s })));
    const rota = all.filter((s) => s.file.startsWith("src/games/escape-maze/"));
    const moduleLevel = all.filter((s) => s.moduleLevel);
    let constructedAtImport = null;
    let ssrImport = null;
    if (executor) {
      let count = 0;
      const Counting = function () {
        count += 1;
      };
      const graph = createModuleGraph({ tree, globals: { console, Set, Map, Math, URL, setTimeout, clearTimeout, Worker: Counting } });
      graph.require(ROUTE_GENERATION_CLIENT);
      graph.require(ROUTE_GENERATION_WORKER_EXECUTOR);
      graph.require(ROUTE_SESSION);
      constructedAtImport = count;
      try {
        const ssr = createModuleGraph({ tree, globals: { console, Set, Map, Math, setTimeout, clearTimeout } });
        ssr.require(ROUTE_GENERATION_CLIENT);
        ssrImport = "ok";
      } catch (error) {
        ssrImport = String(error.message).slice(0, 120);
      }
    }
    const inExecutor = rota.every((s) => s.file === ROUTE_GENERATION_WORKER_EXECUTOR);
    R.record("S6", "structure", "NO_WORKER_CONSTRUCTED_AT_MODULE_EVALUATION",
      rota.length === 1 && inExecutor && moduleLevel.length === 0 && constructedAtImport === 0 && ssrImport === "ok",
      { rotaWorkerSites: rota.map((s) => `${s.file}${s.moduleLevel ? " (module level)" : ""}`), moduleLevelAnywhere: moduleLevel.map((s) => s.file), constructedAtImport, importWithoutWorker: ssrImport },
    );
  });

  // S7 — the Worker URL is the bundler-analysable form, it names the entry next to the executor, as a module Worker.
  R.guard("S7", "structure", "WORKER_URL_IS_STATIC_AND_NAMES_THE_ENTRY", () => {
    const code = executor ? codeOnly(executor) : "";
    const match = code.match(/new Worker\(\s*new URL\("([^"]+)", import\.meta\.url\),\s*\{\s*type: "module"/);
    const target = match ? path.posix.normalize(path.posix.join(path.posix.dirname(ROUTE_GENERATION_WORKER_EXECUTOR), match[1])) : null;
    const dynamic = /new URL\(\s*[^"\s]/.test(code);
    R.record("S7", "structure", "WORKER_URL_IS_STATIC_AND_NAMES_THE_ENTRY", Boolean(match) && target === ROUTE_GENERATION_WORKER && !dynamic, { literal: match?.[1] ?? null, resolvesTo: target, dynamicUrl: dynamic });
  });

  // S8 — no silent fallback: the executor reaches no generation, no runner, no local executor; every failure path ends
  // in `fail(...)` (C7B's failure response): constructor, error, messageerror, malformed, unsendable, silent.
  R.guard("S8", "structure", "NO_SILENT_MAIN_THREAD_FALLBACK", () => {
    const code = executor ? codeOnly(executor) : "";
    const shape = executor ? moduleShape(ROUTE_GENERATION_WORKER_EXECUTOR, executor) : null;
    const local = /runRouteGenerationSync|runRouteGenerationLocally|generateMaze|route-generation-runner|route-generation"/.test(code);
    const paths = {
      constructor: /failLater\(`route generation worker could not start/.test(code),
      error: /worker\.onerror = \(event: ErrorEvent\) => \{\s*event\.preventDefault\(\);\s*fail\(/.test(code),
      messageerror: /worker\.onmessageerror = \(\) =>\s*fail\(/.test(code),
      malformed: /if \(response === null\) fail\("route generation worker: malformed reply"\);/.test(code),
      unsendable: /failLater\(`route generation worker: the command could not be sent/.test(code),
      silent: /\(\) => fail\("route generation worker: no reply"\),\s*ROUTE_GENERATION_WORKER_TIMEOUT_MS/.test(code),
    };
    R.record("S8", "structure", "NO_SILENT_MAIN_THREAD_FALLBACK", Boolean(executor) && !local && Object.values(paths).every(Boolean) &&
      same(runtimeImports(shape), ["@/games/escape-maze/route-generation-worker-protocol"]), {
      reachesLocalGeneration: local, failurePaths: paths, runtimeImports: shape ? runtimeImports(shape) : null,
    });
  });

  // S9 — the hook asks the client exactly as in C7B and holds no generation at all: `MazeMap` is a type import, the
  // `generateMaze` re-export is gone (no product consumer), and no Worker or job call is in it.
  R.guard("S9", "structure", "HOOK_HAS_NO_GENERATION_IMPORT", () => {
    const shape = moduleShape(ROUTE_HOOK, hook);
    const generationImport = shape.imports.find((i) => tree.resolve(i.specifier, ROUTE_HOOK) === ROUTE_GENERATION) ?? null;
    const workerWords = /\bWorker\b|postMessage|runRouteGenerationSync|route-generation-runner/.test(codeOnly(hook));
    R.record("S9", "structure", "HOOK_HAS_NO_GENERATION_IMPORT", generationImport?.kind === "type" && !shape.exported.includes("generateMaze") && !workerWords, {
      generationImport: generationImport ?? null, exportsGenerateMaze: shape.exported.includes("generateMaze"), workerWords,
    });
  });

  // S10 — the job is the main thread's half only: request and accept, no run, `MazeMap` as a type; the runner is the
  // generating realm's half: exactly the run and the local executor, its run-time imports the seam and generation.
  R.guard("S10", "structure", "JOB_MAIN_HALF_RUNNER_GENERATING_HALF", () => {
    const jobShape = moduleShape(ROUTE_GENERATION_JOB, job);
    const runnerShape = runner ? moduleShape(ROUTE_GENERATION_RUNNER, runner) : null;
    R.record("S10", "structure", "JOB_MAIN_HALF_RUNNER_GENERATING_HALF",
      same(jobShape.exported, sorted(["RouteGenerationRequest", "RouteGenerationResult", "createRouteGenerationRequest", "acceptRouteGenerationResult"])) &&
        same(runtimeImports(jobShape), ["@/engine/route-random"]) &&
        Boolean(runnerShape) && same(runnerShape.exported, sorted(RUNNER_EXPORTS)) &&
        same(runtimeImports(runnerShape), ["@/engine/route-random", "@/games/escape-maze/route-generation"]),
      { jobExports: jobShape.exported, jobRuntimeImports: runtimeImports(jobShape), runnerExports: runnerShape?.exported, runnerRuntimeImports: runnerShape ? runtimeImports(runnerShape) : null },
    );
  });
  return R.out;
}

// =================================================================================================
// [preserved]
// =================================================================================================

function preservedChecks(tree) {
  const R = recorder();
  const base = openSourceTree({ rev: BASELINE });

  // P1 — C7C's edit of the job, the client and the hook is exactly the declared one: the reversal gives bd75e69 back
  // byte for byte, and the statements that differ are exactly those declared rewritten/removed/added.
  R.guard("P1", "preserved", "SANCTIONED_EDIT_IS_EXACT", () => {
    const rows = Object.entries(ROUTE_C7C_EDIT).map(([file, edit]) => {
      const now = tree.read(file);
      const was = base.read(file);
      const keysNow = moduleStatementKeys(file, now);
      const keysWas = moduleStatementKeys(file, was);
      const added = keysNow.filter((k) => !keysWas.includes(k));
      const removed = keysWas.filter((k) => !keysNow.includes(k));
      return {
        file,
        exact: routeFileBeforeC7C(tree, file) === was,
        added: same(sorted(added), sorted(edit.added)),
        removed: same(sorted(removed), sorted(edit.removed)),
        actual: { added, removed },
      };
    });
    R.record("P1", "preserved", "SANCTIONED_EDIT_IS_EXACT", rows.every((r) => r.exact && r.added && r.removed), { rows });
  });

  // P2 — the moves are verbatim: the runner's `runRouteGenerationSync` is bd75e69's job's, and its
  // `runRouteGenerationLocally` (with its doc line) is bd75e69's client's, byte for byte.
  R.guard("P2", "preserved", "RUN_AND_LOCAL_EXECUTOR_MOVED_VERBATIM", () => {
    const runner = read(tree, ROUTE_GENERATION_RUNNER) ?? "";
    const rows = {
      run: declarationText(ROUTE_GENERATION_RUNNER, runner, "runRouteGenerationSync") === declarationText(ROUTE_GENERATION_JOB, base.read(ROUTE_GENERATION_JOB), "runRouteGenerationSync"),
      runDoc: leadingDoc(ROUTE_GENERATION_RUNNER, runner, "runRouteGenerationSync") === leadingDoc(ROUTE_GENERATION_JOB, base.read(ROUTE_GENERATION_JOB), "runRouteGenerationSync"),
      local: declarationText(ROUTE_GENERATION_RUNNER, runner, "runRouteGenerationLocally") === declarationText(ROUTE_GENERATION_CLIENT, base.read(ROUTE_GENERATION_CLIENT), "runRouteGenerationLocally"),
      localDoc: leadingDoc(ROUTE_GENERATION_RUNNER, runner, "runRouteGenerationLocally") === leadingDoc(ROUTE_GENERATION_CLIENT, base.read(ROUTE_GENERATION_CLIENT), "runRouteGenerationLocally"),
    };
    R.record("P2", "preserved", "RUN_AND_LOCAL_EXECUTOR_MOVED_VERBATIM", Object.values(rows).every(Boolean), rows);
  });

  // P3 — nothing else moved: every product file but the three edited and the four added is bd75e69's byte for byte —
  // the session, the view, the board, the scene, route-state, route-events, generation, the seam, the launcher.
  R.guard("P3", "preserved", "EVERY_OTHER_PRODUCT_FILE_UNTOUCHED", () => {
    const now = productFiles(tree);
    const was = productFiles(base);
    const added = now.filter((f) => !was.includes(f));
    const removed = was.filter((f) => !now.includes(f));
    const changed = now.filter((f) => was.includes(f) && tree.read(f) !== base.read(f));
    const edited = Object.keys(ROUTE_C7C_EDIT);
    const pinned = [ROUTE_SESSION, ROUTE_GAME_VIEW, ROUTE_STATE, ROUTE_EVENTS, ROUTE_GENERATION, ROUTE_RANDOM_SEAM].filter((f) => tree.read(f) !== base.read(f));
    R.record("P3", "preserved", "EVERY_OTHER_PRODUCT_FILE_UNTOUCHED",
      same(sorted(added), sorted(ROUTE_C7C_ADDED_FILES)) && removed.length === 0 && changed.every((f) => edited.includes(f)) && pinned.length === 0,
      { compared: now.length, added, removed, changed, lifecycleOrDomainChanged: pinned },
    );
  });

  // P4 — the lifecycle did not move: the hook's `useEscapeMaze` and every hook statement but the generation import and
  // the re-export are bd75e69's text (P1 holds the module level; this pins the function itself).
  R.guard("P4", "preserved", "HOOK_LIFECYCLE_UNCHANGED", () => {
    const now = declarationText(ROUTE_HOOK, tree.read(ROUTE_HOOK), "useEscapeMaze");
    const was = declarationText(ROUTE_HOOK, base.read(ROUTE_HOOK), "useEscapeMaze");
    R.record("P4", "preserved", "HOOK_LIFECYCLE_UNCHANGED", now !== null && now === was, { identical: now === was });
  });
  return R.out;
}

// =================================================================================================
// [executor] — the REAL executor and the REAL Worker entry, on the host
// =================================================================================================

const command = (request, requestId = 1, intent = "restart") => ({ requestId, intent, request });

function executorChecks({ tree, transforms } = {}) {
  tree ??= openSourceTree();
  const R = recorder();
  const fresh = (hostOptions = {}) => {
    const clock = createClock();
    const host = createWorkerHost({ tree, transforms, clock, ...hostOptions });
    const main = mainRealm({ tree, transforms, host, clock });
    return { clock, host, main };
  };
  const seeded = (main, seed, difficulty = "medium", route = 2) => {
    main.seam.armRouteRandomSeed(seed);
    const request = main.job.createRouteGenerationRequest(difficulty, route);
    main.seam.clearRouteRandomSeed();
    return request;
  };
  const runOne = (env, cmd, { cancelAt = null } = {}) => {
    const delivered = [];
    const cancel = env.main.executor(cmd, (response) => delivered.push({ at: env.clock.now, response }));
    const synchronous = delivered.length;
    if (cancelAt === 0) cancel();
    else if (cancelAt !== null) {
      env.clock.run(cancelAt);
      cancel();
    }
    env.clock.run();
    return { delivered, synchronous, cancel };
  };
  const failedWith = (out, pattern) =>
    out.delivered.length === 1 && out.delivered[0].response.status === "failed" && pattern.test(out.delivered[0].response.message) && out.delivered[0].at < WATCHDOG_MS;

  // E1 — ready: one module Worker on the entry's URL; the job posted is { protocol, command }; ONE response, never
  // synchronous, answering the request with the map (walls a Set of the main realm, in order) and the seeded stream
  // the runner leaves in a realm of its own; the Worker is terminated as soon as it answers.
  R.guard("E1", "executor", "READY_RESPONSE_THROUGH_A_REAL_ENTRY", () => {
    const env = fresh();
    const request = seeded(env.main, 4242, "hard", 3);
    const out = runOne(env, command(request, 7));
    const reference = referenceRun(tree, request);
    const response = out.delivered[0]?.response;
    const w = env.host.constructed[0];
    const pass =
      out.synchronous === 0 && out.delivered.length === 1 && response.status === "ready" && response.requestId === 7 &&
      response.result.map.walls instanceof Set && same([...response.result.map.walls], [...reference.map.walls]) &&
      mapDigest(response.result.map) === mapDigest(reference.map) && same(response.result.random, reference.random) &&
      env.host.constructed.length === 1 && /route-generation\.worker\.ts$/.test(w.url) && w.options?.type === "module" &&
      same(env.host.jobs[0], { protocol: "rota-generation/1", command: command(request, 7) }) && env.host.alive === 0 && env.host.generations === 1;
    R.record("E1", "executor", "READY_RESPONSE_THROUGH_A_REAL_ENTRY", pass, {
      synchronousDeliveries: out.synchronous, deliveries: out.delivered.length, status: response?.status, wallsIsSet: response?.result?.map?.walls instanceof Set,
      sameMapAsReference: response ? mapDigest(response.result.map) === mapDigest(reference.map) : false, stream: response?.result?.random, workerUrl: w?.url, options: w?.options, aliveAfter: env.host.alive,
    });
  });

  // E2 — a generation that throws in the Worker is answered with a failure carrying its message (the entry's catch),
  // promptly — not by the watchdog — and the Worker is terminated.
  R.guard("E2", "executor", "GENERATION_THROW_IS_A_FAILURE_RESPONSE", () => {
    const env = fresh();
    env.host.mode = { mathThrows: true };
    const out = runOne(env, command(env.main.job.createRouteGenerationRequest("easy", 1)));
    R.record("E2", "executor", "GENERATION_THROW_IS_A_FAILURE_RESPONSE", failedWith(out, /generation forced to fail in the Worker/) && env.host.alive === 0, {
      delivered: out.delivered, alive: env.host.alive,
    });
  });

  // E3 — the constructor throws (no Worker support, a blocked script): a failure, never synchronous; cancelled before
  // it is reported, nothing is reported.
  R.guard("E3", "executor", "CONSTRUCTOR_FAILURE_IS_A_FAILURE_RESPONSE", () => {
    const env = fresh();
    env.host.mode = { constructThrows: true };
    const req = env.main.job.createRouteGenerationRequest("easy", 1);
    const out = runOne(env, command(req));
    const env2 = fresh();
    env2.host.mode = { constructThrows: true };
    const cancelled = runOne(env2, command(req), { cancelAt: 0 });
    R.record("E3", "executor", "CONSTRUCTOR_FAILURE_IS_A_FAILURE_RESPONSE", out.synchronous === 0 && failedWith(out, /could not start/) && cancelled.delivered.length === 0, {
      synchronous: out.synchronous, delivered: out.delivered, cancelledDeliveries: cancelled.delivered.length,
    });
  });

  // E4 — the script fails to load (an `error` event, no message): a failure; the event's default is prevented and the
  // Worker terminated.
  R.guard("E4", "executor", "SCRIPT_LOAD_ERROR_IS_A_FAILURE_RESPONSE", () => {
    const env = fresh();
    env.host.mode = { loadError: true };
    const out = runOne(env, command(env.main.job.createRouteGenerationRequest("easy", 1)));
    const w = env.host.constructed[0];
    R.record("E4", "executor", "SCRIPT_LOAD_ERROR_IS_A_FAILURE_RESPONSE", failedWith(out, /route generation worker failed/) && w?.lastError?.defaultPrevented === true && env.host.alive === 0, {
      delivered: out.delivered, defaultPrevented: w?.lastError?.defaultPrevented, alive: env.host.alive,
    });
  });

  // E5 — the Worker cannot read the job (`messageerror` in the Worker): the entry throws, the main side hears `error`,
  // a failure.
  R.guard("E5", "executor", "UNREADABLE_JOB_IS_A_FAILURE_RESPONSE", () => {
    const env = fresh();
    env.host.mode = { jobUnreadable: true };
    const out = runOne(env, command(env.main.job.createRouteGenerationRequest("easy", 1)));
    R.record("E5", "executor", "UNREADABLE_JOB_IS_A_FAILURE_RESPONSE", failedWith(out, /could not be read/) && env.host.alive === 0, { delivered: out.delivered });
  });

  // E6 — the main side cannot read the reply (`messageerror`): a failure.
  R.guard("E6", "executor", "UNREADABLE_REPLY_IS_A_FAILURE_RESPONSE", () => {
    const env = fresh();
    env.host.mode = { replyUnreadable: true };
    const out = runOne(env, command(env.main.job.createRouteGenerationRequest("easy", 1)));
    R.record("E6", "executor", "UNREADABLE_REPLY_IS_A_FAILURE_RESPONSE", failedWith(out, /reply could not be read/) && env.host.alive === 0, { delivered: out.delivered });
  });

  // E7 — malformed replies are failures, never boards: another protocol, another request id, walls flattened to an
  // array, a stream that is not two numbers, an unknown status, a failure without a message, no response at all.
  R.guard("E7", "executor", "MALFORMED_REPLIES_ARE_FAILURES", () => {
    const variants = {
      protocol: (r) => ({ ...r, protocol: "other/1" }),
      requestId: (r) => ({ ...r, response: { ...r.response, requestId: r.response.requestId + 1 } }),
      flattenedWalls: (r) => ({ ...r, response: { ...r.response, result: { ...r.response.result, map: { ...r.response.result.map, walls: [...r.response.result.map.walls] } } } }),
      badStream: (r) => ({ ...r, response: { ...r.response, result: { ...r.response.result, random: { armedSeed: "1", state: 2 } } } }),
      status: (r) => ({ ...r, response: { ...r.response, status: "done" } }),
      failedNoMessage: (r) => ({ ...r, response: { requestId: r.response.requestId, status: "failed" } }),
      empty: () => null,
    };
    const rows = Object.fromEntries(
      Object.entries(variants).map(([name, reply]) => {
        const env = fresh();
        env.host.mode = { reply };
        const out = runOne(env, command(env.main.job.createRouteGenerationRequest("medium", 1), 3));
        return [name, failedWith(out, /malformed reply/) && env.host.alive === 0];
      }),
    );
    R.record("E7", "executor", "MALFORMED_REPLIES_ARE_FAILURES", Object.values(rows).every(Boolean), rows);
  });

  // E8 — a Worker that never answers (no event at all): failed by the watchdog, at its timeout, and terminated.
  R.guard("E8", "executor", "SILENT_WORKER_FAILS_AT_THE_WATCHDOG", () => {
    const env = fresh();
    env.host.mode = { silent: true };
    const delivered = [];
    env.main.executor(command(env.main.job.createRouteGenerationRequest("easy", 1)), (r) => delivered.push({ at: env.clock.now, r }));
    env.clock.run();
    R.record("E8", "executor", "SILENT_WORKER_FAILS_AT_THE_WATCHDOG",
      delivered.length === 1 && delivered[0].r.status === "failed" && /no reply/.test(delivered[0].r.message) && delivered[0].at === WATCHDOG_MS && env.host.alive === 0,
      { delivered, alive: env.host.alive },
    );
  });

  // E9 — cancelled before the Worker read the job: terminated, nothing generated, nothing delivered.
  R.guard("E9", "executor", "CANCEL_BEFORE_START_TERMINATES", () => {
    const env = fresh();
    const out = runOne(env, command(seeded(env.main, 11)), { cancelAt: 0 });
    R.record("E9", "executor", "CANCEL_BEFORE_START_TERMINATES", out.delivered.length === 0 && env.host.generations === 0 && env.host.alive === 0 && env.host.terminated === 1, {
      delivered: out.delivered.length, generations: env.host.generations, alive: env.host.alive, terminated: env.host.terminated,
    });
  });

  // E10 — cancelled in the middle of the generation: `terminate()` interrupts it — it never completes, nothing is
  // delivered, and the Worker is gone at once (not when the generation would have ended).
  R.guard("E10", "executor", "CANCEL_MID_GENERATION_INTERRUPTS", () => {
    const env = fresh();
    const delivered = [];
    const cancel = env.main.executor(command(seeded(env.main, 12)), (r) => delivered.push(r));
    env.clock.run(STARTUP_MS + GENERATION_MS / 2);
    const aliveMid = env.host.alive;
    cancel();
    const aliveAfterCancel = env.host.alive;
    env.clock.run();
    R.record("E10", "executor", "CANCEL_MID_GENERATION_INTERRUPTS", aliveMid === 1 && aliveAfterCancel === 0 && delivered.length === 0 && env.host.generations === 0, {
      aliveMid, aliveAfterCancel, delivered: delivered.length, generations: env.host.generations,
    });
  });

  // E11 — the old Worker's answer, already queued when cancelled (the host dispatches it anyway): ignored.
  R.guard("E11", "executor", "QUEUED_REPLY_AFTER_CANCEL_IGNORED", () => {
    const env = fresh();
    env.host.mode = { replyDelay: 5 };
    const delivered = [];
    const cancel = env.main.executor(command(seeded(env.main, 13)), (r) => delivered.push(r));
    env.clock.run(STARTUP_MS + GENERATION_MS + 1);
    const repliedBeforeCancel = env.host.replies.length;
    cancel();
    env.clock.run();
    R.record("E11", "executor", "QUEUED_REPLY_AFTER_CANCEL_IGNORED", repliedBeforeCancel === 1 && delivered.length === 0, { repliedBeforeCancel, delivered: delivered.length });
  });

  // E12 — a Worker that posts twice: one response.
  R.guard("E12", "executor", "ONE_RESPONSE_PER_COMMAND", () => {
    const env = fresh();
    env.host.mode = { doublePost: true };
    const out = runOne(env, command(seeded(env.main, 14)));
    R.record("E12", "executor", "ONE_RESPONSE_PER_COMMAND", out.delivered.length === 1 && out.delivered[0].response.status === "ready", { deliveries: out.delivered.length });
  });

  // E13 — two hook instances, both at request id 1 (ids restart per instance): the first is withdrawn (its cleanup),
  // the second asks under another seed. Only the second's own board is accepted — never the first's answer, even
  // queued — the first's Worker is terminated, and the RNG continues from the second's generation.
  R.guard("E13", "executor", "REMOUNT_REQUEST_ID_COLLISION_SAFE", () => {
    const env = fresh();
    env.host.mode = { replyDelay: 5 };
    const accepts = [];
    const realAccept = env.main.job.acceptRouteGenerationResult;
    env.main.job.acceptRouteGenerationResult = (request, result) => {
      accepts.push(result.random?.armedSeed ?? null);
      return realAccept(request, result);
    };
    const boards = { a: [], b: [] };
    const order = (seed) => ({ requestId: 1, intent: "mount", difficulty: "medium", routeNumber: 2, seed });
    const start = (who, seed) => {
      env.main.seam.armRouteRandomSeed(seed);
      return env.main.client.startRouteGeneration(env.main.executor, order(seed), {
        onReady: (map) => boards[who].push(map),
        onFailed: (e) => boards[who].push(String(e)),
      });
    };
    const withdrawA = start("a", 101);
    env.clock.run(STARTUP_MS + GENERATION_MS + 1); // A has answered; its reply is queued
    withdrawA();
    start("b", 202);
    env.clock.run();
    // the main stream continues from B's generation: exactly the reference run's checkpoint for B's request
    const streamAfterB = env.main.seam.getRouteRandomCheckpoint();
    env.main.seam.armRouteRandomSeed(202);
    const expected = referenceRun(tree, env.main.job.createRouteGenerationRequest("medium", 2));
    const ownBoard = boards.b.length === 1 && typeof boards.b[0] === "object" && mapDigest(boards.b[0]) === mapDigest(expected.map);
    const pass =
      boards.a.length === 0 && ownBoard && same(accepts, [202]) && same(streamAfterB, expected.random) &&
      env.host.constructed[0].isAlive === false && env.host.alive === 0;
    env.main.seam.clearRouteRandomSeed();
    R.record("E13", "executor", "REMOUNT_REQUEST_ID_COLLISION_SAFE", pass, {
      firstInstanceBoards: boards.a.length, secondInstanceBoards: boards.b.length, secondIsItsOwnBoard: ownBoard, accepts, streamAfterB, expectedStream: expected.random,
    });
  });

  // E14 — a stale answer never reaches the RNG: withdrawn after its reply is queued, `acceptRouteGenerationResult` is
  // never called and the main stream is exactly where it was.
  R.guard("E14", "executor", "STALE_ANSWER_NEVER_RESTORES_ITS_STREAM", () => {
    const env = fresh();
    env.host.mode = { replyDelay: 5 };
    let accepts = 0;
    const realAccept = env.main.job.acceptRouteGenerationResult;
    env.main.job.acceptRouteGenerationResult = (...a) => {
      accepts += 1;
      return realAccept(...a);
    };
    env.main.seam.armRouteRandomSeed(303);
    const before = env.main.seam.getRouteRandomCheckpoint();
    const withdraw = env.main.client.startRouteGeneration(env.main.executor, { requestId: 4, intent: "restart", difficulty: "hard", routeNumber: 1 }, { onReady: () => {}, onFailed: () => {} });
    env.clock.run(STARTUP_MS + GENERATION_MS + 1);
    withdraw();
    env.clock.run();
    const after = env.main.seam.getRouteRandomCheckpoint();
    env.main.seam.clearRouteRandomSeed();
    R.record("E14", "executor", "STALE_ANSWER_NEVER_RESTORES_ITS_STREAM", accepts === 0 && same(before, after) && env.host.replies.length === 1, { accepts, before, after, replies: env.host.replies.length });
  });
  return R.out;
}

// =================================================================================================
// [hook] and [rng] — the REAL hook with the product binding, on the host
// =================================================================================================

/** The Rota of a tree on the shim, generating through the product's Worker executor on the host. */
function productRota({ tree, sourceOverrides, rev = null, transforms, mathSeed } = {}) {
  const rt = loadRouteRuntime({ rev, sourceOverrides, transforms, generationExecutor: "product" });
  const graph = rt.LAB.graph;
  const clock = createClock();
  const host = createWorkerHost({ tree: tree ?? graph.tree, transforms, clock, mathSeed });
  Object.assign(rt.LAB.sb, { setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout, Worker: host.Worker, URL });
  const client = graph.require(ROUTE_GENERATION_CLIENT);
  const seam = graph.require(ROUTE_RANDOM_SEAM);
  const job = graph.require(ROUTE_GENERATION_JOB);
  const counters = { accepts: 0, mainGenerations: 0, mainRuns: 0, mainDraws: 0 };
  const realAccept = job.acceptRouteGenerationResult;
  job.acceptRouteGenerationResult = (...a) => {
    counters.accepts += 1;
    return realAccept(...a);
  };
  // generation and the runner are loaded in the main realm by the validator profile: counted, they must never run
  if (graph.tree.exists(ROUTE_GENERATION_RUNNER)) {
    const runner = graph.require(ROUTE_GENERATION_RUNNER);
    const realRun = runner.runRouteGenerationSync;
    runner.runRouteGenerationSync = (...a) => {
      counters.mainRuns += 1;
      return realRun(...a);
    };
  }
  const generation = graph.require(ROUTE_GENERATION);
  const realGenerate = generation.generateMaze;
  generation.generateMaze = (...a) => {
    counters.mainGenerations += 1;
    return realGenerate(...a);
  };
  const mainMath = rt.LAB.sb.Math;
  const realRandom = mainMath.random;
  mainMath.random = () => {
    counters.mainDraws += 1;
    return realRandom();
  };
  /** Let the host's time run (Workers answer), rendering whatever they dispatch, until nothing is left. */
  const pump = (run, until = Infinity) => {
    for (let i = 0; i < 400; i += 1) {
      const ran = clock.run(until);
      run.act(() => {}, { drainTimers: false });
      if (!ran) return run.state;
    }
    throw new Error("pump: never settled");
  };
  const act = (run, fn) => {
    run.act(fn, { drainTimers: false });
    return pump(run);
  };
  return { rt, graph, clock, host, client, seam, job, counters, pump, act, binding: client.routeGenerationExecutor };
}

/** The baseline's Rota (bd75e69: C7B's local executor, the harness's own timers). */
function baselineRota() {
  const rt = loadRouteRuntime({ rev: BASELINE });
  const seam = rt.LAB.graph.require(ROUTE_RANDOM_SEAM);
  return { rt, seam, pump: (run) => run.state, act: (run, fn) => run.act(fn) };
}

/** One session, observed: mount (setup), Start, the Explorer's moves, Restart, more moves, the stream's next draws. */
function sessionTrace(rota, { armed, seed, mathSeed, route, mode, policy = "win", steps = 10 }) {
  if (armed) rota.seam.armRouteRandomSeed(seed);
  else rota.seam.clearRouteRandomSeed();
  const run = rota.rt.mount({ seed: mathSeed, routeNumber: route, initialDifficulty: mode, autoStart: false });
  rota.pump(run);
  const trace = [];
  const snap = (label) => trace.push({ label, state: canonical(observeRoute(run.state)), stream: rota.seam.getRouteRandomCheckpoint() });
  snap("mount");
  rota.act(run, (g) => g.startGame());
  snap("start");
  const play = (n, tag) => {
    const memo = {};
    for (let i = 0; i < n && run.state.status === "playing"; i += 1) {
      const action = nextAction(run.state, policy, rota.rt.API, memo);
      if (!action) break;
      rota.act(run, (g) => applyAction(g, action));
      snap(`${tag}${i}`);
    }
  };
  play(steps, "move");
  rota.act(run, (g) => g.restartGame());
  snap("restart");
  play(4, "after-restart");
  trace.push({ label: "next", draws: Array.from({ length: 6 }, () => rota.seam.routeRandom()) });
  run.unmount();
  rota.seam.clearRouteRandomSeed();
  return trace;
}

function hookChecks({ sourceOverrides, transforms, quick = false } = {}) {
  const R = recorder();

  // H1 — the first board: right after mount the board is pending — no board, one Worker alive, no generation on the
  // main realm; nothing with a board renders before the Worker's reply; then the board, and the Worker is gone.
  R.guard("H1", "hook", "INITIAL_MOUNT_PENDING_WORKER_BOARD", () => {
    const rota = productRota({ sourceOverrides, transforms });
    const renders = [];
    const run = rota.rt.mount({ seed: 3, routeNumber: 1, initialDifficulty: "easy", autoStart: false, observeLifecycle: true, onRender: (g) => renders.push({ at: rota.clock.now, board: g.mazeMap !== null, phase: g.generationPhase }) });
    const atMount = { phase: run.state.generationPhase, board: run.state.mazeMap !== null, alive: rota.host.alive, constructed: rota.host.constructed.length };
    rota.pump(run);
    const replyAt = STARTUP_MS + GENERATION_MS;
    const boardBeforeReply = renders.filter((r) => r.board && r.at < replyAt).length;
    const final = { phase: run.state.generationPhase, board: run.state.mazeMap !== null, status: run.state.status, alive: rota.host.alive };
    const pass =
      rota.binding === rota.graph.require(ROUTE_GENERATION_WORKER_EXECUTOR).runRouteGenerationInWorker &&
      atMount.phase === "pending" && !atMount.board && atMount.alive === 1 && atMount.constructed === 1 && boardBeforeReply === 0 &&
      final.phase === "ready" && final.board && final.status === "setup" && final.alive === 0 && rota.counters.mainGenerations === 0 && rota.counters.mainRuns === 0;
    R.record("H1", "hook", "INITIAL_MOUNT_PENDING_WORKER_BOARD", pass, { atMount, boardRendersBeforeReply: boardBeforeReply, final, mainGenerations: rota.counters.mainGenerations });
  });

  // H2 — Start, Restart and a double Restart in one input: each pending, each one new Worker (two Restarts batched in
  // one input ask once), each ends playing at turn 0 on a new board; no Worker left.
  R.guard("H2", "hook", "START_RESTART_DOUBLE_RESTART", () => {
    const rota = productRota({ sourceOverrides, transforms });
    const run = rota.rt.mount({ seed: 5, routeNumber: 1, initialDifficulty: "medium", autoStart: false });
    rota.pump(run);
    const step = (label, fn) => {
      const before = rota.host.constructed.length;
      run.act(fn, { drainTimers: false });
      const pending = run.state.generationPhase;
      rota.pump(run);
      return { label, pending, workers: rota.host.constructed.length - before, status: run.state.status, turns: run.state.turns, phase: run.state.generationPhase };
    };
    const rows = [
      step("start", (g) => g.startGame()),
      step("restart", (g) => g.restartGame()),
      step("double-restart", (g) => {
        g.restartGame();
        g.restartGame();
      }),
    ];
    const pass = rows.every((r) => r.pending === "pending" && r.workers === 1 && r.status === "playing" && r.turns === 0 && r.phase === "ready") && rota.host.alive === 0;
    R.record("H2", "hook", "START_RESTART_DOUBLE_RESTART", pass, { rows, alive: rota.host.alive });
  });

  // H3/H4 — rapid replacement: inputs arrive while the previous generation is still running in its Worker. Each
  // superseded Worker is terminated at the next input (before its generation could end), only the last board arrives,
  // and it arrives one generation after it was asked for — the superseded ones do not delay it.
  const rapid = (id, name, prepare, inputs, expect) =>
    R.guard(id, "hook", name, () => {
      const rota = productRota({ sourceOverrides, transforms });
      const run = rota.rt.mount({ seed: 9, routeNumber: 1, initialDifficulty: "easy", autoStart: false });
      rota.pump(run);
      if (prepare) rota.act(run, prepare);
      const boards = [];
      const seen = new Set();
      const first = rota.host.constructed.length;
      const generationsBefore = rota.host.generations;
      let lastAskedAt = 0;
      for (const input of inputs) {
        run.act(input, { drainTimers: false });
        lastAskedAt = rota.clock.now;
        rota.clock.run(rota.clock.now + 100); // the next input comes 100 ms later, mid-generation
        run.act(() => {}, { drainTimers: false });
        seen.add(run.state.mazeMap ? mapDigest(run.state.mazeMap) : null);
      }
      const workers = rota.host.constructed.slice(first);
      const supersededAlive = workers.slice(0, -1).filter((w) => w.isAlive).length;
      // let the last one finish, noting when its board arrives
      let arrivedAt = null;
      for (let i = 0; i < 50 && arrivedAt === null; i += 1) {
        if (!rota.clock.step()) break;
        run.act(() => {}, { drainTimers: false });
        if (run.state.generationPhase === "ready") arrivedAt = rota.clock.now;
        boards.push(run.state.mazeMap ? mapDigest(run.state.mazeMap) : null);
      }
      rota.pump(run);
      const latency = arrivedAt === null ? null : arrivedAt - lastAskedAt;
      const pass =
        workers.length === inputs.length && supersededAlive === 0 && rota.host.generations - generationsBefore === 1 && latency === STARTUP_MS + GENERATION_MS &&
        expect(run.state) && rota.host.alive === 0 && rota.counters.mainGenerations === 0;
      R.record(id, "hook", name, pass, {
        workers: workers.length, supersededStillAlive: supersededAlive, generationsCompleted: rota.host.generations - generationsBefore, lastBoardLatencyMs: latency,
        expectedLatencyMs: STARTUP_MS + GENERATION_MS, final: { status: run.state.status, difficulty: run.state.difficulty, phase: run.state.generationPhase }, alive: rota.host.alive,
      });
    });
  rapid("H3", "RAPID_RESTARTS_LATEST_WINS_WITHOUT_WAITING", (g) => g.startGame(), [(g) => g.restartGame(), (g) => g.restartGame(), (g) => g.restartGame()], (s) => s.status === "playing" && s.turns === 0);
  rapid("H4", "RAPID_MODES_LATEST_WINS_WITHOUT_WAITING", null, [(g) => g.changeDifficulty("medium"), (g) => g.changeDifficulty("hard"), (g) => g.changeDifficulty("easy"), (g) => g.changeDifficulty("hard")], (s) => s.difficulty === "hard" && s.status === "setup");

  // H5 — leaving while a board is pending: the Worker is terminated at unmount, nothing is delivered or rendered after,
  // no Worker is left.
  R.guard("H5", "hook", "UNMOUNT_WHILE_PENDING_TERMINATES", () => {
    const rota = productRota({ sourceOverrides, transforms });
    const run = rota.rt.mount({ seed: 6, routeNumber: 1, initialDifficulty: "easy", autoStart: false });
    rota.pump(run);
    rota.act(run, (g) => g.startGame());
    const renders = run.renders + run.lifecycleRenders;
    run.act((g) => g.restartGame(), { drainTimers: false });
    const aliveBefore = rota.host.alive;
    run.unmount();
    const aliveAfter = rota.host.alive;
    const acceptsBefore = rota.counters.accepts;
    rota.clock.run();
    R.record("H5", "hook", "UNMOUNT_WHILE_PENDING_TERMINATES", aliveBefore === 1 && aliveAfter === 0 && rota.counters.accepts === acceptsBefore && rota.host.generations === 2, {
      aliveBefore, aliveAfter, acceptsAfterUnmount: rota.counters.accepts - acceptsBefore, rendersBeforeRestart: renders,
    });
  });

  // H6 — no Worker leak: 200 Restarts — half answered, half superseded mid-generation — then leaving: every Worker
  // constructed is terminated, none alive.
  R.guard("H6", "hook", "NO_WORKER_LEAK_OVER_MANY_RESTARTS", () => {
    const rota = productRota({ sourceOverrides, transforms });
    const run = rota.rt.mount({ seed: 8, routeNumber: 1, initialDifficulty: "easy", autoStart: false });
    rota.pump(run);
    rota.act(run, (g) => g.startGame());
    const n = quick ? 40 : 200;
    let peak = 0;
    for (let i = 0; i < n; i += 1) {
      run.act((g) => g.restartGame(), { drainTimers: false });
      peak = Math.max(peak, rota.host.alive);
      if (i % 2) rota.pump(run);
      else rota.clock.run(rota.clock.now + 50);
    }
    rota.pump(run);
    run.unmount();
    rota.clock.run();
    R.record("H6", "hook", "NO_WORKER_LEAK_OVER_MANY_RESTARTS",
      rota.host.alive === 0 && rota.host.terminated === rota.host.constructed.length && peak === 1,
      { restarts: n, constructed: rota.host.constructed.length, terminated: rota.host.terminated, alive: rota.host.alive, peakAlive: peak },
    );
  });

  // H7 — a Worker failure is C7B's generation error (the match frozen, Retry offered), and Retry asks again under a new
  // request id on a NEW Worker, which answers.
  R.guard("H7", "hook", "FAILURE_THEN_RETRY_ON_A_NEW_WORKER", () => {
    const rota = productRota({ sourceOverrides, transforms });
    const run = rota.rt.mount({ seed: 10, routeNumber: 1, initialDifficulty: "easy", autoStart: false });
    rota.pump(run);
    rota.act(run, (g) => g.startGame());
    rota.host.mode = { loadError: true };
    rota.act(run, (g) => g.restartGame());
    const failed = { phase: run.state.generationPhase, retry: typeof run.state.retryGeneration, workers: rota.host.constructed.length };
    const failedId = rota.host.jobs.at(-1)?.command?.requestId ?? null;
    rota.host.mode = {};
    rota.act(run, (g) => g.retryGeneration());
    const retryId = rota.host.jobs.at(-1)?.command?.requestId ?? null;
    const workers = rota.host.constructed;
    const pass = failed.phase === "error" && failed.retry === "function" && run.state.generationPhase === "ready" && run.state.status === "playing" &&
      workers.length === failed.workers + 1 && workers.at(-1) !== workers.at(-2) && retryId !== null && (failedId === null || retryId > failedId) && rota.host.alive === 0;
    R.record("H7", "hook", "FAILURE_THEN_RETRY_ON_A_NEW_WORKER", pass, { failed, failedJobRequestId: failedId, retryRequestId: retryId, final: { phase: run.state.generationPhase, status: run.state.status }, alive: rota.host.alive });
  });

  // H8 — continuation: a session mounted on Route 2/3 with the mode it continues on asks the Worker for exactly that
  // Route and mode, and opens on its board.
  R.guard("H8", "hook", "CONTINUATION_ASKS_FOR_ITS_ROUTE_AND_MODE", () => {
    const rows = [[2, "medium"], [3, "hard"]].map(([route, mode]) => {
      const rota = productRota({ sourceOverrides, transforms });
      const run = rota.rt.mount({ seed: 12, routeNumber: route, initialDifficulty: mode, autoStart: false });
      rota.pump(run);
      const request = rota.host.jobs[0]?.command?.request;
      return { route, mode, asked: request ? [request.routeNumber, request.difficulty] : null, board: run.state.mazeMap !== null, difficulty: run.state.difficulty };
    });
    R.record("H8", "hook", "CONTINUATION_ASKS_FOR_ITS_ROUTE_AND_MODE", rows.every((r) => same(r.asked, [r.route, r.mode]) && r.board && r.difficulty === r.mode), { rows });
  });
  return R.out;
}

function rngChecks({ sourceOverrides, transforms, quick = false } = {}) {
  const R = recorder();
  const seeds = quick ? [71] : [71, 1009, 424242];
  const routes = quick ? [2] : [1, 2, 3];
  const modes = quick ? ["hard"] : ["easy", "medium", "hard"];

  // R1 — seeded sessions through the Worker equal bd75e69's local generation: every observed state (mount, Start, each
  // move, Restart, the moves after) and the stream's checkpoint after each, and the next draws — the Hunter continues
  // exactly from where generation left the stream, across the Worker boundary.
  R.guard("R1", "rng", "SEEDED_SESSIONS_EXACT_ACROSS_THE_WORKER", () => {
    const product = productRota({ sourceOverrides, transforms, mathSeed: 555 });
    const base = baselineRota();
    const rows = [];
    for (const seed of seeds) for (const route of routes) for (const mode of modes) {
      const spec = { armed: true, seed, mathSeed: seed + 1, route, mode };
      const a = sessionTrace(product, spec);
      const b = sessionTrace(base, spec);
      rows.push({ seed, route, mode, steps: a.length, equal: same(a, b), firstDiff: a.findIndex((x, i) => !same(x, b[i])) });
    }
    const pass = rows.every((r) => r.equal) && product.counters.mainGenerations === 0 && product.counters.mainRuns === 0 && product.host.generations > 0;
    R.record("R1", "rng", "SEEDED_SESSIONS_EXACT_ACROSS_THE_WORKER", pass, {
      sessions: rows.length, unequal: rows.filter((r) => !r.equal), observations: rows.reduce((n, r) => n + r.steps, 0), workerGenerations: product.host.generations, mainGenerations: product.counters.mainGenerations,
    });
  });

  // R2 — every request a seeded session posts carries the main stream's checkpoint (its seed), and every reply carries
  // the Worker's stream back on that seed — mount, Start, Restart and a mode change alike.
  R.guard("R2", "rng", "SEEDED_REQUESTS_CARRY_THEIR_CHECKPOINT", () => {
    const rota = productRota({ sourceOverrides, transforms });
    rota.seam.armRouteRandomSeed(8080);
    const run = rota.rt.mount({ seed: 1, routeNumber: 1, initialDifficulty: "easy", autoStart: false });
    rota.pump(run);
    rota.act(run, (g) => g.changeDifficulty("hard"));
    rota.act(run, (g) => g.startGame());
    rota.act(run, (g) => g.restartGame());
    rota.seam.clearRouteRandomSeed();
    const jobs = rota.host.jobs.map((j) => ({ intent: j.command.intent, seed: j.command.request.random?.armedSeed ?? null }));
    const replies = rota.host.replies.map((r) => r.response?.result?.random?.armedSeed ?? null);
    R.record("R2", "rng", "SEEDED_REQUESTS_CARRY_THEIR_CHECKPOINT",
      jobs.length === 4 && jobs.every((j) => j.seed === 8080) && replies.length === 4 && replies.every((s) => s === 8080) && same(jobs.map((j) => j.intent), ["mount", "difficulty", "start", "restart"]),
      { jobs, replySeeds: replies },
    );
  });

  // R3 — normal play: the request carries no stream, the reply none; the Worker draws its own `Math.random`; the main
  // realm's `Math.random` is not drawn while a board is generated (it is the Hunter's, later, not generation's).
  R.guard("R3", "rng", "NORMAL_PLAY_REQUESTS_CARRY_NO_STREAM", () => {
    const rota = productRota({ sourceOverrides, transforms });
    rota.seam.clearRouteRandomSeed();
    const run = rota.rt.mount({ seed: 2, routeNumber: 2, initialDifficulty: "medium", autoStart: false });
    const drawsBefore = rota.counters.mainDraws;
    rota.pump(run);
    const drawsDuringMount = rota.counters.mainDraws - drawsBefore;
    rota.act(run, (g) => g.startGame());
    const jobs = rota.host.jobs.map((j) => j.command.request.random);
    const replies = rota.host.replies.map((r) => r.response?.result?.random);
    const workerDraws = rota.host.constructed.map((w) => w.math.state.draws);
    R.record("R3", "rng", "NORMAL_PLAY_REQUESTS_CARRY_NO_STREAM",
      jobs.length === 2 && jobs.every((r) => r === null) && replies.every((r) => r === null) && workerDraws.every((d) => d > 0) && drawsDuringMount === 0 && rota.counters.mainGenerations === 0,
      { requestStreams: jobs, replyStreams: replies, workerMathDraws: workerDraws, mainDrawsWhileGenerating: drawsDuringMount },
    );
  });

  // R4 — a stale answer never reaches the RNG in the hook either: under rapid Restarts with already-queued replies
  // (the host dispatches them after terminate), accepts are exactly the boards that opened.
  R.guard("R4", "rng", "STALE_WORKER_ANSWERS_NEVER_ACCEPTED", () => {
    const rota = productRota({ sourceOverrides, transforms });
    rota.seam.armRouteRandomSeed(9090);
    const run = rota.rt.mount({ seed: 4, routeNumber: 1, initialDifficulty: "easy", autoStart: false });
    rota.pump(run);
    rota.act(run, (g) => g.startGame());
    rota.host.mode = { replyDelay: 50 };
    const acceptsBefore = rota.counters.accepts;
    for (let i = 0; i < 6; i += 1) {
      run.act((g) => g.restartGame(), { drainTimers: false });
      rota.clock.run(rota.clock.now + STARTUP_MS + GENERATION_MS + 10); // replied, reply queued for 50 ms
      run.act(() => {}, { drainTimers: false });
    }
    rota.pump(run);
    // armed, every Restart draws the same board (the seed restarts generation): what opened is a NEW session — turn 0,
    // playing, ready — and the stream continues from exactly one accepted generation.
    const opened = run.state.generationPhase === "ready" && run.state.status === "playing" && run.state.turns === 0;
    const stream = rota.seam.getRouteRandomCheckpoint();
    rota.seam.clearRouteRandomSeed();
    const accepts = rota.counters.accepts - acceptsBefore;
    R.record("R4", "rng", "STALE_WORKER_ANSWERS_NEVER_ACCEPTED", accepts === 1 && opened && rota.host.replies.length - 2 === 6 && run.state.generationPhase === "ready", {
      restarts: 6, repliesPosted: rota.host.replies.length - 2, accepts, newSessionOpened: opened, streamAfter: stream,
    });
  });
  return R.out;
}

// =================================================================================================
// [clone] — a real isolate
// =================================================================================================

const THREAD_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");
const listeners = {};
const self = {
  addEventListener: (type, fn) => ((listeners[type] ??= []).push(fn)),
  postMessage: (data) => parentPort.postMessage(data),
};
(0, eval)(workerData.bundle)(self, Math);
parentPort.on("message", (data) => {
  try {
    for (const fn of listeners.message ?? []) fn({ data });
  } catch (error) {
    parentPort.postMessage({ uncaught: String(error && error.message || error) });
  }
});
`;

async function cloneChecks() {
  const R = recorder();
  // C1 — a node:worker_threads isolate runs the Worker entry's bundle (the real modules) and answers through real
  // structured clone: walls arrive a Set, in the runner's order; the seeded checkpoint continues the main stream
  // exactly as an in-realm run would; normal play brings no stream back; the main realm accepts through the REAL
  // protocol check and the REAL accept.
  await R.guardAsync("C1", "clone", "REAL_ISOLATE_STRUCTURED_CLONE", async () => {
    const tree = openSourceTree();
    const bundle = emitModuleBundle({ tree, entry: ROUTE_GENERATION_WORKER, params: ["self", "Math"] });
    const thread = new NodeWorker(THREAD_SOURCE, { eval: true, workerData: { bundle } });
    const ask = (message) =>
      new Promise((resolve) => {
        thread.once("message", resolve);
        thread.postMessage(message);
      });
    const clock = createClock();
    const main = mainRealm({ tree, host: null, clock });
    const protocol = main.graph.require(ROUTE_GENERATION_WORKER_PROTOCOL);
    const rows = [];
    try {
      for (const [seed, mode, route] of [[71, "easy", 1], [1009, "medium", 2], [424242, "hard", 3], [null, "medium", 1]]) {
        if (seed === null) main.seam.clearRouteRandomSeed();
        else main.seam.armRouteRandomSeed(seed);
        const request = main.job.createRouteGenerationRequest(mode, route);
        const reply = await ask({ protocol: protocol.ROUTE_GENERATION_WORKER_PROTOCOL, command: command(request, rows.length + 1) });
        const response = protocol.readRouteGenerationWorkerReply(reply, rows.length + 1);
        const reference = referenceRun(tree, request);
        const map = response ? main.job.acceptRouteGenerationResult(request, response.result) : null;
        // Normal play draws the isolate's own Math.random: a valid board, no stream — not the reference's values.
        const seededRow = seed !== null;
        rows.push({
          seed, mode, route,
          wellFormed: response !== null && response.status === "ready",
          wallsSet: map?.walls instanceof Set,
          wallOrder: seededRow ? (map ? same([...map.walls], [...reference.map.walls]) : false) : "n/a (normal play)",
          sameMap: seededRow ? (map ? mapDigest(map) === mapDigest(reference.map) : false) : "n/a (normal play)",
          stream: seededRow ? same(main.seam.getRouteRandomCheckpoint(), reference.random) : response?.result?.random === null && main.seam.getRouteRandomCheckpoint() === null,
        });
      }
    } finally {
      main.seam.clearRouteRandomSeed();
      await thread.terminate();
    }
    R.record("C1", "clone", "REAL_ISOLATE_STRUCTURED_CLONE", rows.every((r) => r.wellFormed && r.wallsSet && r.wallOrder && r.sameMap && r.stream === true), { rows });
  });
  return R.out;
}

// =================================================================================================
// mutants
// =================================================================================================

const edit = (file, anchor, replacement) => ({ file, anchor, replacement });
const MUTANTS_LIST = [
  ["the product binding is back to the local executor", [
    edit(ROUTE_GENERATION_CLIENT, 'import { runRouteGenerationInWorker } from "@/games/escape-maze/route-generation-worker-executor";', 'import { runRouteGenerationLocally as runRouteGenerationInWorker } from "@/games/escape-maze/route-generation-runner";'),
  ]],
  ["a reply to another request id is accepted", [
    edit(ROUTE_GENERATION_WORKER_PROTOCOL, "if (!isRecord(response) || response.requestId !== requestId) return null;", "if (!isRecord(response)) return null;"),
  ]],
  ["the Worker is not terminated on cancel", [
    edit(ROUTE_GENERATION_WORKER_EXECUTOR, "      worker.onmessageerror = null;\n      worker.terminate();\n      worker = null;", "      worker.onmessageerror = null;\n      worker = null;"),
  ]],
  ["a stale (queued) Worker answer is delivered", [
    edit(ROUTE_GENERATION_WORKER_EXECUTOR, "  const settle = (response: RouteGenerationResponse) => {\n    if (!open) return;", "  const settle = (response: RouteGenerationResponse) => {"),
  ]],
  ["the seeded result loses its checkpoint", [
    edit(ROUTE_GENERATION_WORKER, "      result: runRouteGenerationSync(command.request),", "      result: { ...runRouteGenerationSync(command.request), random: null },"),
  ]],
  ["the Worker catches a generation error and never answers", [
    edit(ROUTE_GENERATION_WORKER, "  } catch (error) {\n    response = {", "  } catch (error) {\n    return;\n    response = {"),
  ]],
  ["a Worker error leaves the generation pending", [
    edit(ROUTE_GENERATION_WORKER_EXECUTOR, "    event.preventDefault();\n    fail(`route generation worker failed: ${event.message || \"script error\"}`);", "    event.preventDefault();"),
  ]],
  ["the main thread runs the runner as well as the Worker", [
    edit(ROUTE_GENERATION_WORKER_EXECUTOR, 'import {\n  ROUTE_GENERATION_WORKER_PROTOCOL,', 'import { runRouteGenerationSync } from "@/games/escape-maze/route-generation-runner";\nimport {\n  ROUTE_GENERATION_WORKER_PROTOCOL,'),
    edit(ROUTE_GENERATION_WORKER_EXECUTOR, "  try {\n    worker.postMessage(job);", "  runRouteGenerationSync(command.request);\n  try {\n    worker.postMessage(job);"),
  ]],
  ["the map's Set is flattened on the way back", [
    edit(ROUTE_GENERATION_WORKER, "  const reply: RouteGenerationWorkerReply = {\n    protocol: ROUTE_GENERATION_WORKER_PROTOCOL,\n    response,\n  };", "  if (response.status === \"ready\") response = { ...response, result: { ...response.result, map: { ...response.result.map, walls: [...response.result.map.walls] as never } } };\n  const reply: RouteGenerationWorkerReply = {\n    protocol: ROUTE_GENERATION_WORKER_PROTOCOL,\n    response,\n  };"),
  ]],
  ["one persistent Worker routed by request id: a remounted instance hears the old one", [
    edit(ROUTE_GENERATION_WORKER_EXECUTOR, "export const runRouteGenerationInWorker: RouteGenerationExecutor = (", "let persistent: Worker | null = null;\n\nexport const runRouteGenerationInWorker: RouteGenerationExecutor = ("),
    edit(ROUTE_GENERATION_WORKER_EXECUTOR, "    worker = new Worker(", "    worker = persistent ??= new Worker("),
    edit(ROUTE_GENERATION_WORKER_EXECUTOR, "      worker.onmessageerror = null;\n      worker.terminate();\n      worker = null;", "      worker.onmessageerror = null;\n      worker = null;"),
  ]],
  ["one persistent Worker, cancel cannot interrupt: the latest waits for the superseded", [
    edit(ROUTE_GENERATION_WORKER_EXECUTOR, "export const runRouteGenerationInWorker: RouteGenerationExecutor = (", "let persistent: Worker | null = null;\nconst queue: Array<(data: unknown) => void> = [];\n\nexport const runRouteGenerationInWorker: RouteGenerationExecutor = ("),
    edit(ROUTE_GENERATION_WORKER_EXECUTOR, "    worker = new Worker(", "    worker = persistent ??= new Worker("),
    edit(ROUTE_GENERATION_WORKER_EXECUTOR, "      worker.onmessageerror = null;\n      worker.terminate();\n      worker = null;", "      worker = null;"),
    edit(ROUTE_GENERATION_WORKER_EXECUTOR, "  worker.onmessage = (event: MessageEvent<unknown>) => {\n    const response", "  const handle = (data: unknown) => {\n    const event = { data };\n    const response"),
    edit(ROUTE_GENERATION_WORKER_EXECUTOR, "    else settle(response);\n  };", "    else settle(response);\n  };\n  queue.push(handle);\n  worker.onmessage = (event: MessageEvent<unknown>) => queue.shift()?.(event.data);"),
  ]],
  ["a Worker is created at module evaluation", [
    edit(ROUTE_GENERATION_WORKER_EXECUTOR, "export const ROUTE_GENERATION_WORKER_TIMEOUT_MS = 30_000;", "export const ROUTE_GENERATION_WORKER_TIMEOUT_MS = 30_000;\n\nexport const warmWorker = typeof Worker === \"undefined\" ? null : new Worker(new URL(\"./route-generation.worker.ts\", import.meta.url), { type: \"module\" });"),
  ]],
];

function mutantOverrides(worktree, edits) {
  const texts = {};
  for (const { file, anchor, replacement } of edits) {
    const text = texts[file] ?? worktree.read(file);
    if (text.split(anchor).length !== 2) return { error: `anchor not found exactly once in ${file}: ${anchor.slice(0, 60)}` };
    texts[file] = text.replace(anchor, replacement);
  }
  return { overrides: texts };
}

async function mutantSuite(sourceOverrides) {
  const tree = openSourceTree({ sourceOverrides });
  const results = [];
  const attempt = async (group, fn) => {
    try {
      results.push(...(await fn()));
    } catch (error) {
      results.push({ id: group, kind: group, name: "THREW", pass: false, detail: { error: String(error?.message ?? error).slice(0, 200) } });
    }
  };
  await attempt("structure", () => structureChecks(tree));
  await attempt("executor", () => executorChecks({ tree }));
  await attempt("hook", () => hookChecks({ sourceOverrides, quick: true }));
  await attempt("rng", () => rngChecks({ sourceOverrides, quick: true }));
  return results;
}

async function runMutants() {
  const worktree = openSourceTree();
  console.log("route generation worker · mutants (each applied in memory to the working tree)\n");
  const unmutated = await mutantSuite({});
  const unmutatedFailing = unmutated.filter((r) => !r.pass).map((r) => r.id);
  console.log(`unmutated: ${unmutated.length - unmutatedFailing.length}/${unmutated.length} hold${unmutatedFailing.length ? ` · failing: ${unmutatedFailing.join(", ")}` : ""}`);
  let allCaught = unmutatedFailing.length === 0;
  for (const [name, edits] of MUTANTS_LIST) {
    const { overrides, error } = mutantOverrides(worktree, edits);
    if (error) {
      console.log(`  NOT APPLIED  ${name} — ${error}`);
      allCaught = false;
      continue;
    }
    const results = await mutantSuite(overrides);
    const caughtBy = results.filter((r) => !r.pass).map((r) => r.id);
    console.log(`  ${caughtBy.length ? "CAUGHT" : "MISSED"}  ${name}${caughtBy.length ? ` — by ${caughtBy.join(", ")}` : ""}`);
    if (!caughtBy.length) allCaught = false;
  }
  console.log(`\n${allCaught ? "every mutant caught" : "MUTANTS_NOT_ALL_CAUGHT"}`);
  return allCaught;
}

// =================================================================================================
// main
// =================================================================================================

async function main() {
  if (args.some((arg) => arg !== revArg && arg !== "--mutants") || REV === "" || (REV && MUTANTS)) {
    console.error("usage: node tools/validation/route-generation-worker-tests.mjs [--rev=<commit> | --mutants]");
    return EXIT_USAGE;
  }
  if (REV) {
    try {
      execFileSync("git", ["rev-parse", "--verify", `${REV}^{commit}`], { stdio: "ignore" });
    } catch {
      console.error(`unknown revision ${REV}`);
      return EXIT_USAGE;
    }
  }
  if (MUTANTS) return (await runMutants()) ? EXIT_OK : EXIT_VALIDATION_FAILED;
  const tree = openSourceTree({ rev: REV });
  console.log(`route generation worker · ${REV ? `rev ${tree.rev.slice(0, 12)}` : "working tree"} vs baseline ${BASELINE.slice(0, 7)} (generation on the main thread, C7B's local executor)\n`);
  const results = [];
  const group = async (label, fn) => {
    console.log(`— [${label}]`);
    let out;
    try {
      out = await fn();
    } catch (error) {
      out = [{ id: label, kind: label, name: "THREW", pass: false, detail: { error: String(error?.stack ?? error).slice(0, 600) } }];
    }
    show(out);
    results.push(...out);
    console.log("");
  };
  await group("structure", () => structureChecks(tree));
  await group("preserved", () => preservedChecks(tree));
  if (!REV) {
    await group("executor", () => executorChecks({ tree }));
    await group("hook", () => hookChecks());
    await group("rng", () => rngChecks());
    await group("clone", () => cloneChecks());
  }
  const failing = results.filter((r) => !r.pass).map((r) => r.id);
  const tally = (kind) => {
    const of = results.filter((r) => r.kind === kind);
    return `${of.filter((r) => r.pass).length}/${of.length}`;
  };
  console.log(
    `${REV ? `rev ${tree.rev.slice(0, 12)} · ` : ""}${results.length - failing.length}/${results.length} passed · structure ${tally("structure")} · preserved ${tally("preserved")}` +
      `${REV ? "" : ` · executor ${tally("executor")} · hook ${tally("hook")} · rng ${tally("rng")} · clone ${tally("clone")}`} · failing: ${failing.length ? failing.join(", ") : "none"}`,
  );
  if (failing.length) console.log("ROUTE_GENERATION_WORKER_FAILED");
  return failing.length ? EXIT_VALIDATION_FAILED : EXIT_OK;
}

process.exitCode = await main();
