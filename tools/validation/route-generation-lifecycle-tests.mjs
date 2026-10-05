/**
 * ROUTE-C7B — the Rota's board generation, asynchronous: one lifecycle, tested.
 *
 *   src/games/escape-maze/route-generation-client.ts  the seam a generation crosses: `RouteGenerationCommand` (the C7A
 *                                                       request in a lifecycle envelope: request id + intent),
 *                                                       `RouteGenerationResponse`, `RouteGenerationExecutor`,
 *                                                       `runRouteGenerationLocally` (this realm, one macrotask later)
 *                                                       and `startRouteGeneration` (one generation, latest-wins
 *                                                       acceptance: check, THEN accept the RNG, THEN report).
 *   src/games/escape-maze/route-session.ts            the hook's state: the match (C5's RouteRuntimeState, or null
 *                                                       before the mount's first board) and where its next board's
 *                                                       generation stands (pending / ready / error, with the target).
 *
 * `useEscapeMaze` asks for every board (mount, Start, Restart, a mode) by putting a pending generation in its state;
 * one effect, keyed on that generation, runs it through the client and opens the session on the accepted board. The
 * effect's cleanup is the token: a superseded, unmounted or Strict-Mode-remounted request is withdrawn — cancelled for
 * real if it had not run, ignored if it had — and nothing of it reaches the state or the RNG. C7B does NOT move the
 * computation off the main thread: the local executor still runs it there, on a later task. That is C7C.
 *
 * Six groups:
 *
 *   [structure]    the static gate (fails at e8971eb): the client and the session exist with exactly their contract;
 *                  the client checks a response BEFORE `acceptRouteGenerationResult`; the session is pure; the hook
 *                  calls no `generateMaze` and no job function, asks the client, keeps one state source, and writes
 *                  the turn only through C6's seam (its other dispatches are lifecycle actions); no lifecycle event in
 *                  the domain events; no Worker anywhere in the product; the launcher's session owns its seed.
 *   [preserved]    against e8971eb (holds there too): C7B's edit of the hook, the Rota's view and its stylesheet is
 *                  exactly the declared one (route-module-loader.mjs `routeHookBeforeC7B`… give e8971eb back byte for
 *                  byte); the turn's inputs gained exactly one guard line; every other product file is untouched but
 *                  the launcher.
 *   [lifecycle]    the lifecycle itself, on the shim (controllable executor + virtual timers) and the real React (dev
 *                  Strict Mode, production): async boundary, latest-wins out of order, stale results change neither
 *                  the state nor the RNG, unmount, Strict Mode, instance tokens, the mount's first board, Start,
 *                  Restart, a double Restart, the mode race, errors, retry, continuation, leaving while pending,
 *                  seeded and unseeded requests, monotonic request ids, no sound of its own, gameplay frozen.
 *   [equivalence]  against e8971eb: for every accepted board, the ready state is the baseline's — shim and real React
 *                  (all fields, completions, sounds, RNG, generations), armed seeds included — and every pending render
 *                  is coherent (the previous board, frozen, or no board at all; never a gameplay render).
 *   [view]         the REAL RouteStrategyGame and the REAL launcher page through React's own reconciler (React 19.2,
 *                  dev Strict Mode and production): the board never mounts before the first board; the preparing
 *                  and error screens; a first-board failure reaches onEntryError once and retry generates again; the
 *                  board chunk's failure stays the board's; the view on every accepted board is the baseline's, node
 *                  for node; controls are disabled while pending; leaving while pending mounts nothing; the
 *                  launcher's every request carries its seed in Strict Mode.
 *   [performance]  informational, never a verdict: the scheduling overhead of the local executor and whether a paint
 *                  opportunity exists before the computation. C7B claims no performance gain.
 *
 * `--rev=<commit>` runs every check on that tree. `--rev=e8971eb` is the counterfactual: [structure], [lifecycle] and
 * the C7B-only [view] checks must fail; [preserved], [equivalence] and the view-after-ready check hold (the tree
 * against itself).
 *
 * `--mutants` applies, in memory, the mutations C7B must not let through and requires each to be caught.
 *
 * Usage: node tools/validation/route-generation-lifecycle-tests.mjs [--rev=<commit> | --mutants]
 * Writes nothing. Exit 0 = every check holds (every mutant caught), 1 = a check failed, 3 = usage error.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import ts from "typescript";

import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";
import {
  ROUTE_C7B_BASE,
  ROUTE_GAME_VIEW,
  ROUTE_GENERATION_CLIENT,
  ROUTE_GENERATION_JOB,
  ROUTE_GENERATION_RUNNER,
  ROUTE_HOOK,
  ROUTE_HOOK_C7B_EDIT,
  ROUTE_RANDOM_SEAM,
  ROUTE_SESSION,
  ROUTE_VISUAL_CSS,
  createModuleGraph,
  loadRouteModules,
  openSourceTree,
  routeGenerationRunnerFile,
  treeBeforeC7C,
  routeGameBeforeC7B,
  routeHookBeforeC7B,
  routeVisualBeforeC7B,
} from "./route-module-loader.mjs";
import { createReactRenderer, mapDigest, observeRoute, runInRealReact, runInShim } from "./route-react-runtime.mjs";
import { isLifecycleRender, loadRouteRuntime, playToEnd, withoutLifecycle } from "./route-runtime-harness.mjs";

const SELF = fileURLToPath(import.meta.url);
const BASELINE = ROUTE_C7B_BASE;
const ROUTE_EVENTS = "src/games/escape-maze/route-events.ts";
const LAUNCHER = "src/app/lab/route-launcher/page.tsx";
const BOARD_SPECIFIER = "@/games/escape-maze/RouteBabylonBoard";
/** Every product file C7B may change, and the two it adds. Everything else in src/ is byte for byte. */
const C7B_CHANGED = [ROUTE_HOOK, ROUTE_GAME_VIEW, ROUTE_VISUAL_CSS, LAUNCHER];
const C7B_ADDED = [ROUTE_SESSION, ROUTE_GENERATION_CLIENT];

const CLIENT_EXPORTS = [
  "RouteGenerationCommand", "RouteGenerationExecutor", "RouteGenerationHandlers", "RouteGenerationOrder", "RouteGenerationResponse",
  "routeGenerationExecutor", "runRouteGenerationLocally", "startRouteGeneration",
];
const SESSION_EXPORTS = [
  "RouteGenerationIntent", "RouteGenerationState", "RouteGenerationTarget", "RouteSessionAction", "RouteSessionState",
  "createRouteSessionState", "routeSessionReducer",
];
const LIFECYCLE_ACTIONS = ["GENERATION_REQUESTED", "GENERATION_RETRIED", "GENERATION_FAILED", "INITIAL_ROUTE"];
const PENDING_MESSAGE = "Preparando a rota…";
const ERROR_MESSAGE = "Não foi possível preparar esta rota.";
/** Worker wiring a product file must not have (a Worker of the tooling's own is allowed in tools/validation). */
const WORKER_WIRING = /\bnew\s+(?:Shared)?Worker\s*\(|\bpostMessage\s*\(|\bonmessage\b|addEventListener\(\s*["']message["']|import\.meta\.url/;

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const MUTANTS = args.includes("--mutants");
const REV = revArg ? revArg.slice("--rev=".length) : null;

// =================================================================================================
// small things
// =================================================================================================

const sha = (value) => crypto.createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex").slice(0, 16);
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
const errorOf = (fn) => {
  try {
    fn();
    return null;
  } catch (error) {
    return String(error?.message ?? error).slice(0, 200);
  }
};
const codeOnly = (source) => source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const parse = (file, source) => ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const read = (tree, file) => (tree.exists(file) ? tree.read(file) : null);

/** Exported names (values and types) and imports (specifier → runtime | type) of a module, by the parser. */
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
      imports.push({ specifier: statement.moduleSpecifier.text, kind: typeOnly ? "type" : "runtime" });
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
  return { exported: sorted(new Set(exported)), imports };
}

/** Every call expression whose callee is the identifier `name` (or `x.name`), in `source`. */
function callsOf(file, source, name) {
  const sf = parse(file, source);
  const out = [];
  const visit = (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const id = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : null;
      if (id === name) out.push(node.getText(sf));
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** The hook function's declaration and every function-valued declaration inside it (one level of nesting allowed). */
function hookParts(source) {
  const sf = parse(ROUTE_HOOK, source);
  const fn = sf.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === "useEscapeMaze");
  return { sf, fn };
}

/** The text of the `const name = …` declaration found anywhere inside the hook (at any nesting), dedented. */
function innerDeclaration(source, name) {
  const { sf, fn } = hookParts(source);
  if (!fn) return null;
  let found = null;
  const visit = (node) => {
    if (found) return;
    if (ts.isVariableStatement(node) && node.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === name)) {
      const indent = sf.getLineAndCharacterOfPosition(node.getStart(sf)).character;
      found = node.getText(sf).split("\n").map((line, i) => (i === 0 ? line : line.slice(Math.min(indent, line.match(/^ */)[0].length)))).join("\n");
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(fn.body);
  return found;
}

// =================================================================================================
// results
// =================================================================================================

function recorder() {
  const out = [];
  return {
    out,
    record(id, kind, name, pass, detail = {}) {
      out.push({ id, kind, name, pass: Boolean(pass), detail });
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


/** Product source files (ts/tsx/css) of a tree, by git for a revision and by the file system for the working tree. */
function productFiles(tree) {
  if (tree.rev) {
    return execFileSync("git", ["ls-tree", "-r", "--name-only", tree.rev, "src/"], { encoding: "utf8" })
      .split("\n")
      .filter((file) => /\.(ts|tsx|css)$/.test(file))
      .filter((file) => tree.exists(file));
  }
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(full) : [full];
    });
  return walk(path.join(tree.root, "src"))
    .map((file) => path.relative(tree.root, file).replace(/\\/g, "/"))
    .filter((file) => /\.(ts|tsx|css)$/.test(file))
    // a view (`treeBeforeC7C`) hides the files added after it
    .filter((file) => tree.exists(file));
}

// =================================================================================================
// [structure]
// =================================================================================================

function structureChecks(tree) {
  const R = recorder();
  const client = read(tree, ROUTE_GENERATION_CLIENT);
  const session = read(tree, ROUTE_SESSION);
  const hook = tree.read(ROUTE_HOOK);

  // S1 — the client: exactly its contract; the job is its one run-time import; it reaches no React, UI, Worker, sound,
  // storage or domain event; the local executor schedules a macrotask and cancels it for real; the executor the Rota
  // uses IS the local one (C7C swaps this binding, nothing else).
  {
    const shape = client ? moduleShape(ROUTE_GENERATION_CLIENT, client) : null;
    const runtime = shape ? shape.imports.filter((i) => i.kind === "runtime").map((i) => i.specifier) : null;
    const types = shape ? sorted(shape.imports.filter((i) => i.kind === "type").map((i) => i.specifier)) : null;
    const code = client ? codeOnly(client) : "";
    const forbidden = client ? /\breact\b|lucide|motion|babylon|game-sounds|scoring|storage|route-events|\bwindow\b|document\b|localStorage/.test(code) : true;
    const schedules = /setTimeout\(\s*\(\)\s*=>/.test(code) && /return \(\) => clearTimeout\(timer\)/.test(code);
    const executorIsLocal = /export const routeGenerationExecutor: RouteGenerationExecutor =\s*runRouteGenerationLocally;/.test(code);
    const pass =
      Boolean(client) &&
      same(shape.exported, sorted(CLIENT_EXPORTS)) &&
      same(runtime, ["@/games/escape-maze/route-generation-job"]) &&
      types.every((s) => ["@/games/escape-maze/route-generation", "@/games/escape-maze/route-session", "@/types/game"].includes(s)) &&
      !forbidden &&
      !WORKER_WIRING.test(code) &&
      schedules &&
      executorIsLocal;
    R.record("S1", "structure", "CLIENT_IS_THE_ASYNC_SEAM_AND_NOTHING_ELSE", pass, {
      exists: Boolean(client), exported: shape?.exported, runtimeImports: runtime, typeImports: types, forbidden, schedules, executorIsLocal,
    });
  }

  // S2 — latest-wins acceptance, in that order: inside `startRouteGeneration` the response is checked (still open, and
  // answering THIS request) before `acceptRouteGenerationResult` continues the stream, and the map reaches the caller
  // only after that. A withdrawn generation closes the token and cancels the executor's command.
  {
    let order = null;
    let withdraw = false;
    if (client) {
      const sf = parse(ROUTE_GENERATION_CLIENT, client);
      const fn = sf.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === "startRouteGeneration");
      const text = fn ? fn.getText(sf) : "";
      const at = (needle) => text.indexOf(needle);
      order = {
        check: at("if (!open || response.requestId !== order.requestId) return;"),
        accept: at("acceptRouteGenerationResult(request, response.result)"),
        ready: at("handlers.onReady(map)"),
        requestBuilt: at("createRouteGenerationRequest("),
        executorCalled: at("executor("),
      };
      withdraw = /return \(\) => \{\s*if \(!open\) return;\s*open = false;\s*cancel\(\);\s*\};/.test(text);
    }
    const pass =
      order !== null &&
      Object.values(order).every((i) => i >= 0) &&
      order.requestBuilt < order.executorCalled &&
      order.check < order.accept &&
      order.accept < order.ready &&
      withdraw;
    R.record("S2", "structure", "CHECK_THEN_ACCEPT_THEN_REPORT", pass, { order, withdrawClosesAndCancels: withdraw });
  }

  // S3 — the session: pure (route-state at run time, types otherwise; no React, RNG, timers, generation, sounds); the
  // match is `RouteRuntimeState | null` (no stand-in map); exactly three phases and four intents; the reducer hands
  // the match's own transitions to routeStateReducer and refuses them while a board is pending or failed.
  {
    const shape = session ? moduleShape(ROUTE_SESSION, session) : null;
    const runtime = shape ? shape.imports.filter((i) => i.kind === "runtime").map((i) => i.specifier) : null;
    const code = session ? codeOnly(session) : "";
    const impure = /\breact\b|route-random|routeRandom|Math\.|Date\.|setTimeout|generateMaze|game-sounds|window|localStorage/.test(code);
    const nullableMatch = /readonly route: RouteRuntimeState \| null;/.test(code);
    const phases = [...code.matchAll(/readonly phase: "(\w+)"/g)].map((m) => m[1]);
    const intents = [...(code.match(/export type RouteGenerationIntent =([\s\S]*?);/)?.[1] ?? "").matchAll(/"(\w+)"/g)].map((m) => m[1]);
    const delegates = /routeStateReducer\(state\.route, action\)/.test(code);
    const frozen = /if \(state\.route === null \|\| state\.generation\.phase !== "ready"\) \{\s*return state;/.test(code);
    const pass =
      Boolean(session) &&
      same(shape.exported, sorted(SESSION_EXPORTS)) &&
      same(runtime, ["@/games/escape-maze/route-state"]) &&
      !impure &&
      nullableMatch &&
      same(sorted(new Set(phases)), ["error", "pending", "ready"]) &&
      same(intents, ["mount", "start", "restart", "difficulty"]) &&
      delegates &&
      frozen;
    R.record("S3", "structure", "SESSION_STATE_PURE_AND_EXPLICIT", pass, {
      exists: Boolean(session), exported: shape?.exported, runtimeImports: runtime, impure, nullableMatch, phases: [...new Set(phases)], intents, delegates, frozenWhileAwaiting: frozen,
    });
  }

  // S4 — the hook asks; it never generates: no `generateMaze(` call, no job function, no RNG restore; it imports
  // the client's `startRouteGeneration` and `routeGenerationExecutor` and holds `routeSessionReducer`; exactly one
  // generation effect, keyed on the pending generation, whose cleanup is what `startRouteGeneration` returns. It still
  // re-exports `generateMaze` (its public surface), and knows nothing of postMessage or Workers.
  {
    const calls = callsOf(ROUTE_HOOK, hook, "generateMaze");
    const jobCalls = ["createRouteGenerationRequest", "runRouteGenerationSync", "acceptRouteGenerationResult", "restoreRouteRandomCheckpoint", "getRouteRandomCheckpoint"]
      .flatMap((name) => callsOf(ROUTE_HOOK, hook, name).map(() => name));
    const shape = moduleShape(ROUTE_HOOK, hook);
    const clientImport = /import \{\s*routeGenerationExecutor,\s*startRouteGeneration,\s*\} from "@\/games\/escape-maze\/route-generation-client";/.test(hook);
    const reducer = /useReducer\(\s*routeSessionReducer,\s*initialDifficulty,\s*createRouteSessionState,\s*\)/.test(hook);
    const effects = callsOf(ROUTE_HOOK, hook, "useEffect");
    const generationEffects = effects.filter((text) => text.includes("startRouteGeneration("));
    const keyed = generationEffects.length === 1 && /return startRouteGeneration\(\s*routeGenerationExecutor,/.test(generationEffects[0]) &&
      /\}, \[generation, routeNumber, startNewMaze\]\)$/.test(generationEffects[0]);
    const reexports = shape.exported.includes("generateMaze");
    const pass = calls.length === 0 && jobCalls.length === 0 && clientImport && reducer && keyed && reexports && !WORKER_WIRING.test(codeOnly(hook));
    R.record("S4", "structure", "HOOK_ASKS_THE_CLIENT_AND_NEVER_GENERATES", pass, {
      generateMazeCalls: calls.length, jobCalls, clientImport, reducer, generationEffects: generationEffects.length, keyedOnThePendingGeneration: keyed, reexportsGenerateMaze: reexports,
    });
  }

  // P4 — one source of state: one useReducer, one useState (routeNumber, the session's identity), one ref (the input
  // guard); no second copy of the map (no pending map, no map in a ref or a state cell).
  {
    const count = (name) => callsOf(ROUTE_HOOK, hook, name).length;
    const cells = { useReducer: count("useReducer"), useState: count("useState"), useRef: count("useRef") };
    const secondMap = /pendingMazeMap|nextMazeMap|useState<MazeMap|useRef<MazeMap|mazeMapRef/.test(codeOnly(hook));
    const pass = same(cells, { useReducer: 1, useState: 1, useRef: 1 }) && !secondMap && /const \[routeNumber\] = useState\(normalizedInitialRouteNumber\);/.test(hook);
    // C5's single source, carried: it holds at e8971eb too, so it is a protection, not C7B's own structure.
    R.record("P4", "preserved", "ONE_STATE_SOURCE_NO_SECOND_MAP", pass, { cells, secondMap });
  }

  // S6 — C6's seam stays the turn's: every `dispatch(` outside `applyDomainEvent` dispatches a lifecycle action literal
  // (asked, retried, failed, the mount's starting value) — never a match transition — and the turn's writes are
  // still events applied through the seam.
  {
    const dispatches = callsOf(ROUTE_HOOK, hook, "dispatch");
    const outsideSeam = dispatches.filter((text) => text !== "dispatch(action)");
    const types = outsideSeam.map((text) => text.match(/type: "(\w+)"/)?.[1] ?? "<opaque>");
    const seam = /const applyDomainEvent = useCallback\(\(event: RouteDomainEvent\) => \{\s*for \(const action of routeStateActionsForEvent\(event\)\) dispatch\(action\);\s*\}, \[\]\);/.test(hook);
    const pass = seam && dispatches.filter((t) => t === "dispatch(action)").length === 1 && types.every((t) => LIFECYCLE_ACTIONS.includes(t)) && types.length > 0;
    R.record("S6", "structure", "TURN_WRITES_STAY_EVENTS_LIFECYCLE_DISPATCHES_ONLY", pass, { seam, lifecycleDispatches: types });
  }

  // S7 — the lifecycle is infrastructure, not the domain: route-events is e8971eb's byte for byte (no MAP_GENERATED,
  // no generation event), and neither the client nor the session imports route-events, sounds or scoring.
  {
    const base = openSourceTree({ rev: BASELINE });
    const eventsSame = read(tree, ROUTE_EVENTS) === base.read(ROUTE_EVENTS);
    const generationEvent = /MAP_GENERATED|GENERATION_/.test(codeOnly(read(tree, ROUTE_EVENTS) ?? ""));
    const reach = [client, session].map((text) => (text ? /route-events|game-sounds|scoring/.test(codeOnly(text)) : true));
    const pass = eventsSame && !generationEvent && reach.every((r) => !r) && Boolean(client) && Boolean(session);
    R.record("S7", "structure", "NO_LIFECYCLE_DOMAIN_EVENT", pass, { routeEventsUnchanged: eventsSame, generationEvent, clientOrSessionReachDomain: reach });
  }

  // S8 — no Worker in the product: no `new Worker(`, no postMessage, no message listener, no `import.meta.url` wiring.
  // And the launcher's active session owns its seed: armed by a layout effect for exactly the session's life, with no
  // page-level passive clear that could run after it.
  {
    const files = productFiles(tree).filter((f) => !f.endsWith(".css"));
    const wired = files.filter((file) => WORKER_WIRING.test(codeOnly(tree.read(file))));
    const launcher = codeOnly(tree.read(LAUNCHER));
    const owns = /useLayoutEffect\(\(\) => \{\s*if \(session === null\) return;\s*armRouteRandomSeed\(session\.seed\);\s*return clearRouteRandomSeed;\s*\}, \[session\]\);/.test(launcher);
    const passiveClear = /useEffect\(\(\)\s*=>\s*clearRouteRandomSeed/.test(launcher);
    R.record("S8", "structure", "NO_WORKER_AND_THE_SESSION_OWNS_ITS_SEED", wired.length === 0 && owns && !passiveClear, {
      scanned: files.length, wired, launcherSessionOwnsSeed: owns, pagePassiveClear: passiveClear,
    });
  }
  return R.out;
}

// =================================================================================================
// [preserved]
// =================================================================================================

function preservedChecks(tree) {
  const R = recorder();
  const base = openSourceTree({ rev: BASELINE });

  // P1 — C7B's edit is exactly the declared one: the hook, the view and the stylesheet, reversed through
  // route-module-loader.mjs, are e8971eb's byte for byte. (On e8971eb itself the reversal is the identity.)
  {
    const rows = [
      [ROUTE_HOOK, routeHookBeforeC7B(tree)],
      [ROUTE_GAME_VIEW, routeGameBeforeC7B(tree)],
      [ROUTE_VISUAL_CSS, routeVisualBeforeC7B(tree)],
    ].map(([file, text]) => ({ file, exact: text === base.read(file) }));
    R.record("P1", "preserved", "SANCTIONED_EDIT_IS_EXACT", rows.every((r) => r.exact), { rows, edit: ROUTE_HOOK_C7B_EDIT.added.length + ROUTE_HOOK_C7B_EDIT.rewritten.length });
  }

  // P2 — the turn: `runDefenderPhase` and `endGame` are e8971eb's text; `tryMovePlayer`, `chooseReward` and
  // `breakWall` are e8971eb's with exactly one line in front — `if (awaitingRoute) return;` — and nothing else.
  {
    const now = tree.read(ROUTE_HOOK);
    const was = base.read(ROUTE_HOOK);
    const rows = ["runDefenderPhase", "endGame", "tryMovePlayer", "chooseReward", "breakWall"].map((name) => {
      const a = innerDeclaration(now, name);
      const b = innerDeclaration(was, name);
      const guarded = ROUTE_HOOK_C7B_EDIT.guarded.includes(name);
      const expected = guarded && b ? b.replace(/\) => \{\n/, `) => {\n  ${ROUTE_HOOK_C7B_EDIT.guard}\n`) : b;
      const lifecycleTree = tree.exists(ROUTE_SESSION);
      return { name, guarded, same: a !== null && a === (lifecycleTree ? expected : b) };
    });
    R.record("P2", "preserved", "TURN_UNCHANGED_BUT_ONE_GUARD_PER_INPUT", rows.every((r) => r.same), { rows });
  }

  // P3 — nothing else moved: every product file but the four C7B edits (hook, view, stylesheet, launcher) and its two
  // new modules is e8971eb's byte for byte — route-state, route-events, generation, the C7A job and seam, defenders,
  // invariants, config, geometry, continuation, the board, GameScreen, the shell, the types.
  {
    const now = productFiles(tree);
    const was = productFiles(base);
    const added = now.filter((f) => !was.includes(f));
    const removed = was.filter((f) => !now.includes(f));
    const changed = now.filter((f) => was.includes(f) && tree.read(f) !== base.read(f));
    const pass =
      same(sorted(added), sorted(tree.exists(ROUTE_SESSION) ? C7B_ADDED : [])) &&
      removed.length === 0 &&
      changed.every((f) => C7B_CHANGED.includes(f));
    R.record("P3", "preserved", "EVERY_OTHER_PRODUCT_FILE_UNTOUCHED", pass, { compared: now.length, added, removed, changed });
  }
  return R.out;
}

// =================================================================================================
// [lifecycle] — on the shim: virtual timers for the local executor, a controllable executor for races
// =================================================================================================

/** Sounds, recorded instead of played. */
const recordingSounds = (log) => ({
  "src/lib/game-sounds.ts": {
    playGentleErrorTone: () => log.push("sound:error"),
    playSuccessChime: () => log.push("sound:success"),
    playStoneBreak: () => log.push("sound:stone"),
  },
});

/**
 * One loaded Rota on the shim, instrumented through its own module graph — no production API: the job's accept and
 * the session reducer are wrapped where they are declared (the client and the hook read them off their modules when
 * they call them), and `useExecutor` points the client's `routeGenerationExecutor` at a test executor, the one
 * binding C7C will point at a Worker. A tree without the client has nothing to point.
 */
function instrumentedRota({ rev = null, sourceOverrides } = {}) {
  const sounds = [];
  const rt = loadRouteRuntime({ rev, sourceOverrides, mocks: recordingSounds(sounds) });
  const graph = rt.LAB.graph;
  const tree = graph.tree;
  const lifecycleTree = tree.exists(ROUTE_GENERATION_CLIENT);
  const seam = graph.require(ROUTE_RANDOM_SEAM);
  const counters = { accepts: 0, reducer: 0, generations: 0 };
  const job = graph.require(ROUTE_GENERATION_JOB);
  const realAccept = job.acceptRouteGenerationResult;
  job.acceptRouteGenerationResult = (...a) => {
    counters.accepts += 1;
    return realAccept(...a);
  };
  const generation = graph.require(tree.declaring("generateMaze"));
  const realGenerate = generation.generateMaze;
  generation.generateMaze = (...a) => {
    counters.generations += 1;
    return realGenerate(...a);
  };
  let client = null;
  if (lifecycleTree) {
    client = graph.require(ROUTE_GENERATION_CLIENT);
    const sessionModule = graph.require(ROUTE_SESSION);
    const realReducer = sessionModule.routeSessionReducer;
    sessionModule.routeSessionReducer = (state, action) => {
      counters.reducer += 1;
      return realReducer(state, action);
    };
  }
  const local = client?.routeGenerationExecutor ?? null;
  return {
    rt,
    graph,
    tree,
    lifecycleTree,
    seam,
    sounds,
    counters,
    /** Point the Rota's executor at `executor` (or back at the local one). */
    useExecutor(executor) {
      if (!client) throw new Error("no generation client in this tree");
      client.routeGenerationExecutor = executor ?? local;
    },
    /** Wrap the local executor to count commands and cancels (cancelled before running vs. after). */
    countingLocal() {
      const log = { commands: [], cancels: 0, ran: 0 };
      this.useExecutor((command, deliver) => {
        log.commands.push(command);
        const cancel = local(command, (response) => {
          log.ran += 1;
          deliver(response);
        });
        return () => {
          log.cancels += 1;
          cancel();
        };
      });
      return log;
    },
  };
}

/**
 * A test executor whose commands wait until the test answers them, in any order, from ANOTHER realm (a second module
 * graph of the same tree: its own route-random, its own generateMaze), exactly as a Worker would. Cancelling records
 * the cancel and nothing else: an answer may still be delivered after it, as a Worker's would.
 */
function controllableExecutor(tree) {
  const otherRealm = createModuleGraph({ tree }).require(routeGenerationRunnerFile(tree));
  const jobs = [];
  const executor = (command, deliver) => {
    const job = { command: structuredClone(command), deliver, cancels: 0 };
    jobs.push(job);
    return () => {
      job.cancels += 1;
    };
  };
  return {
    executor,
    jobs,
    /** The answer the other realm computes for `job` (as a Worker would post it). */
    answer(job) {
      return structuredClone({ requestId: job.command.requestId, status: "ready", result: otherRealm.runRouteGenerationSync(job.command.request) });
    },
    failure(job, message = "forced generation failure") {
      return { requestId: job.command.requestId, status: "failed", message };
    },
  };
}

/**
 * Mount a session on the shim, recording every render React would make — the lifecycle's included. The shim's `act`
 * renders once even when nothing was scheduled; React does not, so only scheduled renders (and the mount) count.
 */
function mountObserved(rota, options) {
  const renders = [];
  let first = true;
  const run = rota.rt.mount({
    autoStart: false,
    ...options,
    observeLifecycle: true,
    onRender: (game, _i, meta) => {
      if (first || meta?.scheduled) renders.push({ game, lifecycle: Boolean(meta?.lifecycle) });
      first = false;
    },
  });
  return { run, renders };
}

const boardOf = (game) => (game?.mazeMap ? mapDigest(game.mazeMap) : null);
/** The match a render shows, without the lifecycle's keys: what a frozen render must keep. */
const matchView = (game) => (game?.mazeMap ? canonical(observeRoute(withoutLifecycle(game))) : null);

function lifecycleChecks({ rev = null, sourceOverrides } = {}) {
  const R = recorder();
  const attempt = (id, name, fn) => {
    let result;
    const error = errorOf(() => {
      result = fn();
    });
    if (error) R.record(id, "lifecycle", name, false, { error });
    else R.record(id, "lifecycle", name, result.pass, result.detail);
  };
  const fresh = () => instrumentedRota({ rev, sourceOverrides });

  // L1 — a real async boundary: the mount's render has no board and asks for one; nothing is generated during it;
  // the board arrives on a later task (the local executor's timer), and only then is there a match.
  attempt("L1", "ASYNC_BOUNDARY_THE_MOUNT_ASKS_THEN_THE_BOARD_ARRIVES", () => {
    const rota = fresh();
    const counting = rota.lifecycleTree ? rota.countingLocal() : null;
    const generationsBefore = rota.counters.generations;
    const renders = [];
    let atFirstRender = null;
    rota.rt.mount({
      seed: 9101,
      routeNumber: 2,
      autoStart: false,
      observeLifecycle: true,
      onRender: (game, _i, meta) => {
        if (renders.length === 0) atFirstRender = rota.counters.generations - generationsBefore;
        renders.push({ phase: game.generationPhase ?? null, board: boardOf(game), lifecycle: Boolean(meta?.lifecycle) });
      },
    });
    const first = renders[0];
    const last = renders.at(-1);
    return {
      pass:
        first?.board === null && first.phase === "pending" && first.lifecycle && atFirstRender === 0 &&
        last?.phase === "ready" && last.board !== null && counting?.commands.length === 1 && counting.ran === 1,
      detail: { renders: renders.map((r) => `${r.phase}:${r.board ? "board" : "none"}`), generationsDuringFirstRender: atFirstRender, commands: counting?.commands.length, ran: counting?.ran },
    };
  });

  // L2 — latest wins, out of order: Restart A, Restart B; B answers first and is the board; A answers last and changes
  // nothing — not the board, the status, the message, the pieces, the counters, the RNG — and causes no render.
  attempt("L2", "LATEST_WINS_OUT_OF_ORDER", () => {
    const rota = fresh();
    const ctl = controllableExecutor(rota.tree);
    rota.useExecutor(ctl.executor);
    const { run, renders } = mountObserved(rota, { seed: 9102, routeNumber: 1 });
    run.act(() => ctl.jobs[0].deliver(ctl.answer(ctl.jobs[0])));
    run.act((g) => g.startGame());
    run.act(() => ctl.jobs[1].deliver(ctl.answer(ctl.jobs[1])));
    run.act((g) => g.restartGame());
    run.act((g) => g.restartGame());
    const [a, b] = ctl.jobs.slice(2);
    const answerA = ctl.answer(a);
    const answerB = ctl.answer(b);
    run.act(() => b.deliver(answerB));
    const afterB = { game: run.state, renders: renders.length, reducer: rota.counters.reducer, accepts: rota.counters.accepts };
    run.act(() => a.deliver(answerA));
    const afterA = { game: run.state, renders: renders.length, reducer: rota.counters.reducer, accepts: rota.counters.accepts };
    return {
      pass:
        boardOf(afterB.game) === mapDigest(answerB.result.map) &&
        mapDigest(answerA.result.map) !== mapDigest(answerB.result.map) &&
        matchView(afterA.game) === matchView(afterB.game) && afterA.game.generationPhase === "ready" &&
        afterA.renders === afterB.renders &&
        afterA.reducer === afterB.reducer &&
        afterA.accepts === afterB.accepts &&
        a.cancels === 1 && b.cancels <= 1 &&
        afterB.game.status === "playing" && afterB.game.turns === 0,
      detail: {
        boardIsB: boardOf(afterB.game) === mapDigest(answerB.result.map),
        staleChangedState: matchView(afterA.game) !== matchView(afterB.game),
        staleRenders: afterA.renders - afterB.renders,
        staleReducerRuns: afterA.reducer - afterB.reducer,
        staleAccepts: afterA.accepts - afterB.accepts,
        cancelsA: a.cancels,
      },
    };
  });

  // L3 — a stale result never touches the RNG: in a seeded session (armed seed), two mode changes whose boards differ;
  // the later one is accepted and continues the stream; the earlier one, delivered after, restores nothing — the
  // main realm's checkpoint is exactly the accepted one's, and `acceptRouteGenerationResult` ran once.
  attempt("L3", "STALE_RESULT_NEVER_RESTORES_ITS_RNG", () => {
    const rota = fresh();
    const ctl = controllableExecutor(rota.tree);
    rota.useExecutor(ctl.executor);
    rota.seam.armRouteRandomSeed(12432045);
    try {
      const { run } = mountObserved(rota, { seed: 9103, routeNumber: 3 });
      run.act(() => ctl.jobs[0].deliver(ctl.answer(ctl.jobs[0])));
      run.act((g) => g.changeDifficulty("medium"));
      run.act((g) => g.changeDifficulty("hard"));
      const [a, b] = ctl.jobs.slice(1);
      const answerA = ctl.answer(a);
      const answerB = ctl.answer(b);
      const acceptsBefore = rota.counters.accepts;
      run.act(() => b.deliver(answerB));
      const afterB = rota.seam.getRouteRandomCheckpoint();
      run.act(() => a.deliver(answerA));
      const afterA = rota.seam.getRouteRandomCheckpoint();
      return {
        pass:
          a.command.request.random?.armedSeed === 12432045 &&
          !same(answerA.result.random, answerB.result.random) &&
          same(afterB, answerB.result.random) &&
          same(afterA, afterB) &&
          rota.counters.accepts - acceptsBefore === 1 &&
          run.state.difficulty === "hard",
        detail: { checkpointAfterB: afterB, checkpointAfterStaleA: afterA, staleCheckpoint: answerA.result.random, accepts: rota.counters.accepts - acceptsBefore, difficulty: run.state.difficulty },
      };
    } finally {
      rota.seam.clearRouteRandomSeed();
    }
  });

  // L4 — unmount: a pending board answered after the Rota left changes nothing at all — no reducer run, no accept, no
  // RNG, no sound, no completion — and the local executor's timer was cleared (it never ran).
  attempt("L4", "UNMOUNT_INVALIDATES_EVERYTHING", () => {
    const rota = fresh();
    const ctl = controllableExecutor(rota.tree);
    rota.useExecutor(ctl.executor);
    rota.seam.armRouteRandomSeed(7);
    try {
      const { run } = mountObserved(rota, { seed: 9104, routeNumber: 1 });
      run.act(() => ctl.jobs[0].deliver(ctl.answer(ctl.jobs[0])));
      run.act((g) => g.startGame());
      const pending = ctl.jobs[1];
      const answer = ctl.answer(pending);
      const before = { reducer: rota.counters.reducer, accepts: rota.counters.accepts, cp: rota.seam.getRouteRandomCheckpoint(), sounds: rota.sounds.length, completions: run.completions.length };
      run.unmount();
      pending.deliver(answer);
      const after = { reducer: rota.counters.reducer, accepts: rota.counters.accepts, cp: rota.seam.getRouteRandomCheckpoint(), sounds: rota.sounds.length, completions: run.completions.length };
      // The local executor: a Restart, then leaving before its timer — the generation never runs.
      const rota2 = fresh();
      const counting = rota2.countingLocal();
      const second = rota2.rt.mount({ seed: 9105, routeNumber: 2 });
      const generations = rota2.counters.generations;
      second.act((g) => g.restartGame(), { drainTimers: false });
      second.unmount();
      second.act(() => {});
      return {
        pass: same(before, after) && pending.cancels === 1 && rota2.counters.generations === generations && counting.ran === counting.commands.length - 1,
        detail: { before, after, cancelled: pending.cancels, localCommands: counting.commands.length, localRan: counting.ran, generationsAfterLeaving: rota2.counters.generations - generations },
      };
    } finally {
      rota.seam.clearRouteRandomSeed();
    }
  });

  // L5 — request identity is the instance's: two instances one after the other both ask with request id 1; the first,
  // unmounted, is answered after the second mounted — and the second stays pending until ITS answer arrives, which is
  // the only board it shows. Request ids are monotonic inside an instance and never reused (mount 1, then 2, 3, …).
  attempt("L5", "INSTANCE_TOKEN_NOT_REQUEST_ID", () => {
    const rota = fresh();
    const ctl = controllableExecutor(rota.tree);
    rota.useExecutor(ctl.executor);
    const first = mountObserved(rota, { seed: 9106, routeNumber: 1 });
    const jobA = ctl.jobs[0];
    first.run.unmount();
    const second = mountObserved(rota, { seed: 9107, routeNumber: 1 });
    const jobB = ctl.jobs[1];
    second.run.act(() => jobA.deliver({ ...ctl.answer(jobA), requestId: jobB.command.requestId }));
    const stillPending = second.run.state.mazeMap === null && second.run.state.generationPhase === "pending";
    const answerB = ctl.answer(jobB);
    second.run.act(() => jobB.deliver(answerB));
    // monotonic ids inside the second instance
    second.run.act((g) => g.changeDifficulty("medium"));
    second.run.act((g) => g.changeDifficulty("hard"));
    second.run.act((g) => g.changeDifficulty("easy"));
    const ids = ctl.jobs.slice(1).map((j) => j.command.requestId);
    return {
      pass:
        jobA.command.requestId === 1 && jobB.command.requestId === 1 && stillPending &&
        boardOf(second.run.state) === mapDigest(answerB.result.map) &&
        same(ids, [1, 2, 3, 4]),
      detail: { idA: jobA.command.requestId, idB: jobB.command.requestId, secondStillPendingAfterAsAnswer: stillPending, ids },
    };
  });

  // L6 — the mount's first board: until it arrives the hook hands out no match and no stand-in — exactly the routeNumber,
  // its progression, `mazeMap: null` and the lifecycle (phase, mode, retry); nothing to play, nothing derived.
  attempt("L6", "INITIAL_PENDING_IS_EXPLICIT_NO_FAKE_MAP", () => {
    const rota = fresh();
    const ctl = controllableExecutor(rota.tree);
    rota.useExecutor(ctl.executor);
    const { run } = mountObserved(rota, { seed: 9108, routeNumber: 2, initialDifficulty: "medium" });
    const keys = Object.keys(run.state).sort();
    return {
      pass:
        same(keys, ["generationPhase", "mazeMap", "requestedDifficulty", "retryGeneration", "routeNumber", "routeProgression"]) &&
        run.state.mazeMap === null && run.state.generationPhase === "pending" && run.state.requestedDifficulty === "medium" &&
        ctl.jobs[0].command.intent === "mount" && ctl.jobs[0].command.request.difficulty === "medium" && ctl.jobs[0].command.request.routeNumber === 2,
      detail: { keys, command: { intent: ctl.jobs[0].command.intent, request: { ...ctl.jobs[0].command.request } } },
    };
  });

  // L7 — Start, Restart, mode: each asks once, with its intent and the session it opens; while it is pending the match
  // on screen is frozen — a step, a reward, a wall, Start itself are no-ops, nothing renders for them, no sound — and
  // the board that arrives opens exactly the session it was asked for. A second Restart (and a mode change) replaces
  // a pending one; Start does not.
  attempt("L7", "START_RESTART_MODE_FREEZE_THEN_OPEN", () => {
    const rota = fresh();
    const ctl = controllableExecutor(rota.tree);
    rota.useExecutor(ctl.executor);
    const { run, renders } = mountObserved(rota, { seed: 9109, routeNumber: 1 });
    run.act(() => ctl.jobs[0].deliver(ctl.answer(ctl.jobs[0])));
    const setup = run.state;
    run.act((g) => g.startGame());
    const startJob = ctl.jobs[1];
    const frozenStart = run.state;
    const rendersBeforeNoops = renders.length;
    const soundsBefore = rota.sounds.length;
    run.act((g) => g.startGame());
    run.act((g) => g.tryMovePlayer({ row: -1, col: 0 }));
    const noopsRendered = renders.length - rendersBeforeNoops;
    const jobsAfterNoopStart = ctl.jobs.length;
    run.act(() => startJob.deliver(ctl.answer(startJob)));
    const playing = run.state;
    // a few real steps, then Restart while playing
    run.act((g) => g.tryMovePlayer({ row: -1, col: 0 }));
    run.act((g) => g.tryMovePlayer({ row: 0, col: 1 }));
    const midGame = run.state;
    run.act((g) => g.restartGame());
    const restartJob = ctl.jobs[2];
    const frozenRestart = run.state;
    // While pending, an input runs nothing: no reducer, no draw (the Hunter's policy is never asked).
    const reducerBeforeNoops = rota.counters.reducer;
    const draws = { n: 0 };
    const seededMath = rota.rt.LAB.sb.Math;
    const realRandom = seededMath.random;
    seededMath.random = () => {
      draws.n += 1;
      return realRandom();
    };
    run.act((g) => g.tryMovePlayer({ row: 1, col: 0 }));
    run.act((g) => g.chooseReward("pickaxe"));
    run.act((g) => g.breakWall({ row: midGame.player.row - 1, col: midGame.player.col }));
    const afterNoops = run.state;
    seededMath.random = realRandom;
    const pendingInputs = { reducerRuns: rota.counters.reducer - reducerBeforeNoops, draws: draws.n };
    run.act(() => restartJob.deliver(ctl.answer(restartJob)));
    const restarted = run.state;
    const pass =
      setup.status === "setup" && setup.message === "Escolha a dificuldade e inicie." &&
      startJob.command.intent === "start" &&
      frozenStart.generationPhase === "pending" && frozenStart.status === "setup" && frozenStart.mazeMap === setup.mazeMap &&
      jobsAfterNoopStart === 2 && noopsRendered === 0 && rota.sounds.length === soundsBefore &&
      playing.status === "playing" && playing.generationPhase === "ready" && playing.turns === 0 && playing.message === `${playing.routeProgression.label}: observe a rota e colete as luzes.` &&
      restartJob.command.intent === "restart" &&
      frozenRestart.generationPhase === "pending" && matchView(afterNoops) === matchView(frozenRestart) && afterNoops.turns === midGame.turns &&
      pendingInputs.reducerRuns === 0 && pendingInputs.draws === 0 &&
      restarted.status === "playing" && restarted.turns === 0 && restarted.blockedMoves === 0 && restarted.collectedCount === 0 && restarted.brokenWall === null;
    return {
      pass,
      detail: {
        startIntent: startJob.command.intent, restartIntent: restartJob.command.intent, jobs: ctl.jobs.length, jobsAfterNoopStart,
        frozenStartPhase: frozenStart.generationPhase, noopRendersWhilePending: noopsRendered, playingMessage: playing.message,
        frozenMatchUnchanged: matchView(afterNoops) === matchView(frozenRestart), pendingInputs, restartedTurns: restarted.turns,
      },
    };
  });

  // L8 — a double Restart with the local executor: the first request's timer is cleared before it runs — one
  // generation, not two — and the board is the second's. The same rapid change of mode (easy → medium → hard):
  // one generation, hard on screen; and with the controllable executor every order of the three answers ends on hard.
  attempt("L8", "RAPID_RESTART_AND_MODE_RACE_LAST_ONLY", () => {
    const rota = fresh();
    const counting = rota.countingLocal();
    const run = rota.rt.mount({ seed: 9110, routeNumber: 2 });
    const generations = rota.counters.generations;
    const ran = counting.ran;
    // Two Restarts, the second before the first's timer has run.
    run.act((g) => g.restartGame(), { drainTimers: false });
    run.act((g) => g.restartGame());
    const restartGenerations = rota.counters.generations - generations;
    const rota2 = fresh();
    const counting2 = rota2.countingLocal();
    const run2 = rota2.rt.mount({ seed: 9111, routeNumber: 1, autoStart: false });
    const g0 = rota2.counters.generations;
    // Three mode changes, each before the previous one's timer has run.
    const commands0 = counting2.commands.length;
    run2.act((g) => g.changeDifficulty("easy"), { drainTimers: false });
    run2.act((g) => g.changeDifficulty("medium"), { drainTimers: false });
    run2.act((g) => g.changeDifficulty("hard"));
    const modeCommands = counting2.commands.length - commands0;
    const modeGenerations = rota2.counters.generations - g0;
    // controllable: every permutation of the three answers
    const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
    const outcomes = orders.map((order) => {
      const r = fresh();
      const ctl = controllableExecutor(r.tree);
      r.useExecutor(ctl.executor);
      const { run: s } = mountObserved(r, { seed: 9112, routeNumber: 3 });
      s.act(() => ctl.jobs[0].deliver(ctl.answer(ctl.jobs[0])));
      s.act((g) => g.changeDifficulty("easy"));
      s.act((g) => g.changeDifficulty("medium"));
      s.act((g) => g.changeDifficulty("hard"));
      const three = ctl.jobs.slice(1);
      const answers = three.map((j) => ctl.answer(j));
      for (const i of order) s.act(() => three[i].deliver(answers[i]));
      return { order: order.join(""), difficulty: s.state.difficulty, board: boardOf(s.state) === mapDigest(answers[2].result.map), status: s.state.status, phase: s.state.generationPhase };
    });
    const pass =
      restartGenerations === 1 && counting.ran - ran === 1 &&
      modeGenerations === 1 && modeCommands === 3 && run2.state.difficulty === "hard" && counting2.cancels === 2 &&
      outcomes.every((o) => o.difficulty === "hard" && o.board && o.status === "setup" && o.phase === "ready");
    return { pass, detail: { restartGenerations, modeCommands, modeGenerations, modeCancels: counting2.cancels, finalMode: run2.state.difficulty, outcomes } };
  });

  // L9 — a generation that fails: the state goes to "error" with nothing of the failure applied (the match on screen
  // is the very same object), no sound; the match stays frozen; retry asks again under a NEW request id, for the same
  // mode, Route, intent and session, and its board opens normally. An answer to the failed request arriving after the
  // retry is ignored. A real throw from generation (budget forced to zero in memory) takes the same path.
  attempt("L9", "ERROR_THEN_RETRY_NEW_REQUEST_SAME_INTENT", () => {
    const rota = fresh();
    const ctl = controllableExecutor(rota.tree);
    rota.useExecutor(ctl.executor);
    const { run } = mountObserved(rota, { seed: 9113, routeNumber: 2, initialDifficulty: "hard" });
    run.act(() => ctl.jobs[0].deliver(ctl.answer(ctl.jobs[0])));
    run.act((g) => g.startGame());
    const failing = ctl.jobs[1];
    const before = run.state;
    const soundsBefore = rota.sounds.length;
    run.act(() => failing.deliver(ctl.failure(failing)));
    const failed = run.state;
    run.act((g) => g.tryMovePlayer({ row: -1, col: 0 }));
    const stillFrozen = run.state;
    run.act((g) => g.retryGeneration());
    const retryJob = ctl.jobs[2];
    run.act(() => failing.deliver(ctl.answer(failing)));
    const afterStaleOld = run.state;
    const answer = ctl.answer(retryJob);
    run.act(() => retryJob.deliver(answer));
    const done = run.state;
    const pass =
      failed.generationPhase === "error" && failed.status === before.status && failed.mazeMap === before.mazeMap && matchView(failed) === matchView(before) &&
      rota.sounds.length === soundsBefore &&
      matchView(stillFrozen) === matchView(failed) &&
      retryJob && retryJob.command.requestId > failing.command.requestId && retryJob.command.intent === "start" && retryJob.command.request.difficulty === "hard" && retryJob.command.request.routeNumber === 2 &&
      afterStaleOld.generationPhase === "pending" && afterStaleOld.mazeMap === before.mazeMap &&
      done.generationPhase === "ready" && done.status === "playing" && boardOf(done) === mapDigest(answer.result.map);
    // a real throw, from the real local executor
    const budget = rota.tree.declaring("MAX_GENERATION_ATTEMPTS");
    let throwing = null;
    const throwError = errorOf(() => {
      const broken = instrumentedRota({
        rev,
        sourceOverrides: { ...(sourceOverrides ?? {}), [budget]: rota.tree.read(budget).replace(/(MAX_GENERATION_ATTEMPTS\s*=\s*)\d[\d_]*/, "$10").replace(/(RECOVERY_ROUNDS\s*=\s*)\d[\d_]*/, "$10") },
      });
      const r = broken.rt.mount({ seed: 9114, routeNumber: 1, autoStart: false });
      throwing = { phase: r.state.generationPhase, board: r.state.mazeMap };
    });
    return {
      pass: pass && throwing?.phase === "error" && throwing.board === null,
      detail: {
        failedPhase: failed.generationPhase, matchUntouched: failed.mazeMap === before.mazeMap, retryId: retryJob?.command.requestId, failedId: failing.command.requestId,
        retryIntent: retryJob?.command.intent, staleOldAnswerIgnored: afterStaleOld.generationPhase === "pending", finalPhase: done.generationPhase,
        realThrow: throwing ?? throwError,
      },
    };
  });

  // L10 — continuation: a finished Route's continuation opens a NEW session on the next Route and mode, which asks
  // for its own first board; the old session, left with a pending Restart, never reaches it.
  attempt("L10", "CONTINUATION_OPENS_ITS_OWN_GENERATION", () => {
    const rota = fresh();
    const run = rota.rt.mount({ seed: 9115, routeNumber: 1, difficulty: "medium" });
    const status = playToEnd(run, "win");
    const continuation = run.completions.at(-1)?.continuation;
    const ctl = controllableExecutor(rota.tree);
    rota.useExecutor(ctl.executor);
    run.act((g) => g.restartGame?.());
    const oldJob = ctl.jobs[0];
    run.unmount();
    const next = mountObserved(rota, { seed: 9116, routeNumber: continuation.routeNumber, initialDifficulty: continuation.difficulty });
    const newJob = ctl.jobs[1];
    next.run.act(() => oldJob.deliver({ ...ctl.answer(oldJob), requestId: newJob.command.requestId }));
    const ignored = next.run.state.mazeMap === null;
    const answer = ctl.answer(newJob);
    next.run.act(() => newJob.deliver(answer));
    return {
      pass:
        ["won", "lost"].includes(status) && continuation?.routeNumber === 2 && continuation.difficulty === "medium" &&
        newJob.command.intent === "mount" && newJob.command.request.routeNumber === 2 && newJob.command.request.difficulty === "medium" &&
        ignored && next.run.state.routeNumber === 2 && next.run.state.difficulty === "medium" && boardOf(next.run.state) === mapDigest(answer.result.map),
      detail: { status, continuation, newCommand: { intent: newJob.command.intent, ...newJob.command.request, random: undefined }, oldAnswerIgnored: ignored },
    };
  });

  // L11 — normal play carries no stream (request.random null, nothing armed throughout) and draws its board from
  // Math.random on the executor's task; a seeded session's every request carries the armed seed, and its board and
  // the Hunter after it are exactly a one-call `generateMaze` from that seed (C7A's contract, now asynchronous).
  attempt("L11", "SEEDED_EXACT_UNSEEDED_UNTOUCHED", () => {
    const rota = fresh();
    const ctl = controllableExecutor(rota.tree);
    rota.useExecutor(ctl.executor);
    const { run } = mountObserved(rota, { seed: 9117, routeNumber: 1 });
    const unseeded = ctl.jobs[0].command.request.random === null && rota.seam.getArmedRouteSeed() === null;
    run.unmount();
    rota.useExecutor(null);
    rota.seam.armRouteRandomSeed(12412046);
    try {
      const seeded = rota.rt.mount({ seed: 1, routeNumber: 1, initialDifficulty: "hard", autoStart: true });
      const reference = createModuleGraph({ tree: rota.tree });
      const refSeam = reference.require(ROUTE_RANDOM_SEAM);
      refSeam.armRouteRandomSeed(12412046);
      const refMap = reference.require(rota.tree.declaring("generateMaze")).generateMaze("hard", 1);
      const refNext = [refSeam.routeRandom(), refSeam.routeRandom(), refSeam.routeRandom()];
      const cp = rota.seam.getRouteRandomCheckpoint();
      const next = [rota.seam.routeRandom(), rota.seam.routeRandom(), rota.seam.routeRandom()];
      return {
        pass: unseeded && boardOf(seeded.state) === mapDigest(refMap) && same(next, refNext) && cp?.armedSeed === 12412046,
        detail: { unseededRequestCarriesNoStream: unseeded, seededBoardIsOneCallFromTheSeed: boardOf(seeded.state) === mapDigest(refMap), streamContinues: same(next, refNext) },
      };
    } finally {
      rota.seam.clearRouteRandomSeed();
    }
  });

  // L12 — no sound and no completion of its own: pending, a board arriving, an error and a retry play nothing and
  // complete nothing; the game's sounds are the turn's.
  attempt("L12", "NO_SOUND_NO_COMPLETION_FROM_THE_LIFECYCLE", () => {
    const rota = fresh();
    const ctl = controllableExecutor(rota.tree);
    rota.useExecutor(ctl.executor);
    const { run } = mountObserved(rota, { seed: 9118, routeNumber: 1 });
    run.act(() => ctl.jobs[0].deliver(ctl.answer(ctl.jobs[0])));
    run.act((g) => g.startGame());
    run.act(() => ctl.jobs[1].deliver(ctl.failure(ctl.jobs[1])));
    run.act((g) => g.retryGeneration());
    run.act(() => ctl.jobs[2].deliver(ctl.answer(ctl.jobs[2])));
    run.act((g) => g.restartGame());
    run.act(() => ctl.jobs[3].deliver(ctl.answer(ctl.jobs[3])));
    return { pass: rota.sounds.length === 0 && run.completions.length === 0 && ctl.jobs.length === 4, detail: { sounds: rota.sounds, completions: run.completions.length, jobs: ctl.jobs.length } };
  });

  return R.out;
}


// =================================================================================================
// [lifecycle] — the real React (react-dom), in a worker per build
// =================================================================================================


/**
 * Real React scenarios, run inside a worker whose NODE_ENV picks React's build. Each mounts the REAL hook through
 * react-dom (inside <StrictMode> when `strict`), with the client's executor pointed at a counting local executor or a
 * controllable one, and reports what happened: commands, cancels, runs, commits (lifecycle and game), reducer runs,
 * accepts, console output.
 */
async function realReactLifecycleMain({ rev, sourceOverrides, strict }) {
  const consoleErrors = [];
  console.error = (...a) => consoleErrors.push(a.map(String).join(" ").slice(0, 300));
  console.warn = (...a) => consoleErrors.push(`warn: ${a.map(String).join(" ").slice(0, 300)}`);
  const react = await createReactRenderer({ strict, regime: "discrete" });
  const tree = openSourceTree({ rev, sourceOverrides });
  const rota = loadRouteModules({ tree, react: react.React, surface: [] });
  rota.sandbox.window = react.fakeWindow;
  let clock = 0;
  rota.sandbox.Date = { now: () => (clock += 1000) };
  const graph = rota.graph;
  const lifecycleTree = tree.exists(ROUTE_GENERATION_CLIENT);
  if (!lifecycleTree) return { lifecycleTree, consoleErrors, results: null };
  const client = graph.require(ROUTE_GENERATION_CLIENT);
  const local = client.routeGenerationExecutor;
  const counters = { reducer: 0, accepts: 0, generations: 0 };
  const sessionModule = graph.require(ROUTE_SESSION);
  const realReducer = sessionModule.routeSessionReducer;
  sessionModule.routeSessionReducer = (state, action) => {
    counters.reducer += 1;
    return realReducer(state, action);
  };
  const job = graph.require(ROUTE_GENERATION_JOB);
  const realAccept = job.acceptRouteGenerationResult;
  job.acceptRouteGenerationResult = (...a) => {
    counters.accepts += 1;
    return realAccept(...a);
  };
  const generation = graph.require(tree.declaring("generateMaze"));
  const realGenerate = generation.generateMaze;
  generation.generateMaze = (...a) => {
    counters.generations += 1;
    return realGenerate(...a);
  };
  const { useEscapeMaze } = rota.hook;
  const observe = (g) => ({ phase: g.generationPhase ?? null, board: g.mazeMap ? mapDigest(g.mazeMap) : null, status: g.status ?? null, difficulty: g.difficulty ?? null, turns: g.turns ?? null });
  const mount = (routeNumber, initialDifficulty) =>
    react.render(() => useEscapeMaze(() => {}, routeNumber, initialDifficulty), observe, { lifecycle: isLifecycleRender });
  const click = (fn) => react.perform(() => fn(react.committed()), "click");
  const snapshot = () => ({ commits: react.commits.length, lifecycle: react.lifecycleCommits.length, bodies: react.bodies(), lifecycleBodies: react.lifecycleBodies(), ...counters });
  const delta = (a, b) => Object.fromEntries(Object.keys(b).map((k) => [k, b[k] - a[k]]));
  const results = {};

  // the local executor, counted
  const log = { commands: [], cancels: 0, ran: 0 };
  client.routeGenerationExecutor = (command, deliver) => {
    log.commands.push(command.requestId);
    const cancel = local(command, (response) => {
      log.ran += 1;
      deliver(response);
    });
    return () => {
      log.cancels += 1;
      cancel();
    };
  };
  rota.setSeed(5150);
  let s0 = snapshot();
  await mount(2, "medium");
  results.mount = { ...delta(s0, snapshot()), commands: [...log.commands], cancels: log.cancels, ran: log.ran, last: react.commits.at(-1) };
  s0 = snapshot();
  const before = { ...log, commands: log.commands.length };
  await click((g) => g.startGame());
  results.start = { ...delta(s0, snapshot()), commands: log.commands.length - before.commands, ran: log.ran - before.ran, last: react.commits.at(-1) };
  // two Restarts in ONE event: React batches them; the effect sees only the second.
  s0 = snapshot();
  const beforeRestart = { commands: log.commands.length, ran: log.ran, cancels: log.cancels };
  await react.perform(() => {
    const g = react.committed();
    g.restartGame();
    g.restartGame();
  }, "click");
  results.doubleRestart = { ...delta(s0, snapshot()), commands: log.commands.length - beforeRestart.commands, ran: log.ran - beforeRestart.ran, last: react.commits.at(-1) };
  // leave while a Restart is pending: no generation runs, nothing renders.
  s0 = snapshot();
  const beforeLeave = { commands: log.commands.length, ran: log.ran };
  react.perform(() => react.committed().restartGame(), "click");
  await react.unmount();
  await new Promise((r) => setTimeout(r, 20));
  results.leavePending = { ...delta(s0, snapshot()), commands: log.commands.length - beforeLeave.commands, ran: log.ran - beforeLeave.ran };

  // the controllable executor: answers held until the scenario gives them, computed by a second realm
  const otherRealm = createModuleGraph({ tree }).require(routeGenerationRunnerFile(tree));
  const jobs = [];
  client.routeGenerationExecutor = (command, deliver) => {
    const j = { command: structuredClone(command), deliver, cancels: 0 };
    jobs.push(j);
    return () => {
      j.cancels += 1;
    };
  };
  const answer = (j) => structuredClone({ requestId: j.command.requestId, status: "ready", result: otherRealm.runRouteGenerationSync(j.command.request) });
  const give = (j, response) => react.perform(() => j.deliver(response ?? answer(j)), null);

  // the mount's own requests: in Strict Mode the first effect's request is withdrawn by React's simulated unmount and
  // the second asks again — with the SAME request id. Answering the withdrawn one changes nothing.
  s0 = snapshot();
  await mount(1, "easy");
  const mountJobs = jobs.slice();
  const withdrawn = mountJobs.filter((j) => j.cancels > 0);
  const live = mountJobs.filter((j) => j.cancels === 0);
  if (withdrawn[0]) await give(withdrawn[0], answer(withdrawn[0]));
  const afterWithdrawn = { phase: react.committed().generationPhase, board: react.committed().mazeMap };
  const liveAnswer = live[0] ? answer(live[0]) : null;
  if (live[0]) await give(live[0], liveAnswer);
  results.strictToken = {
    ids: mountJobs.map((j) => j.command.requestId),
    withdrawn: withdrawn.length,
    live: live.length,
    afterWithdrawnAnswer: { phase: afterWithdrawn.phase, board: afterWithdrawn.board === null ? null : "board" },
    final: { phase: react.committed().generationPhase, isLiveBoard: liveAnswer ? mapDigest(react.committed().mazeMap) === mapDigest(liveAnswer.result.map) : false },
  };
  // latest wins, out of order, in React
  await click((g) => g.startGame());
  await give(jobs.at(-1));
  await click((g) => g.restartGame());
  await click((g) => g.restartGame());
  const [a, b] = jobs.slice(-2);
  const answerA = answer(a);
  const answerB = answer(b);
  await give(b, answerB);
  s0 = snapshot();
  const shownB = react.committed();
  await give(a, answerA);
  results.outOfOrder = {
    isB: mapDigest(react.committed().mazeMap) === mapDigest(answerB.result.map),
    staleDelta: delta(s0, snapshot()),
    unchanged: react.committed() === shownB,
  };
  // unmount with a pending Start: the late answer reaches nothing
  await click((g) => g.restartGame());
  const pending = jobs.at(-1);
  const pendingAnswer = answer(pending);
  await react.unmount();
  s0 = snapshot();
  await react.perform(() => pending.deliver(pendingAnswer), null);
  results.unmountLate = { delta: delta(s0, snapshot()), cancels: pending.cancels };
  return { lifecycleTree, consoleErrors, results, reactVersion: react.React.version };
}

function runRealReactLifecycle({ rev = null, sourceOverrides, nodeEnv, strict }) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(SELF, {
      workerData: { c7bRealReact: true, rev, sourceOverrides, strict },
      env: { ...process.env, NODE_ENV: nodeEnv },
    });
    let settled = false;
    worker.once("message", (message) => {
      settled = true;
      if (message.error) reject(new Error(message.error));
      else resolve(message.result);
      worker.terminate();
    });
    worker.once("error", (error) => {
      if (!settled) reject(error);
    });
    worker.once("exit", (code) => {
      if (!settled) reject(new Error(`worker exited with ${code} before answering`));
    });
  });
}

async function realReactLifecycleChecks({ rev = null, sourceOverrides } = {}) {
  const R = recorder();
  const configs = [
    { label: "development · StrictMode", nodeEnv: "development", strict: true },
    { label: "production", nodeEnv: "production", strict: false },
  ];
  const runs = [];
  for (const config of configs) {
    let run = null;
    const error = await runRealReactLifecycle({ rev, sourceOverrides, ...config }).then(
      (r) => {
        run = r;
        return null;
      },
      (e) => String(e?.message ?? e).slice(0, 300),
    );
    runs.push({ ...config, run, error });
  }
  const ok = (r) => r.run?.lifecycleTree && r.run.results;
  // RR1 — the mount in React: the first commit is the pending one, the board's commit follows on a later task; one
  // generation even in Strict Mode, whose first request is withdrawn before it runs (two commands, one cancel, one
  // run); production asks once.
  {
    const rows = runs.map((r) => {
      const m = ok(r) ? r.run.results.mount : null;
      return {
        label: r.label,
        error: r.error,
        commands: m?.commands,
        cancels: m?.cancels,
        ran: m?.ran,
        generations: m?.generations,
        lifecycleCommits: m?.lifecycle,
        gameCommits: m?.commits,
        board: m?.last?.board ? "board" : null,
        pass:
          Boolean(m) && m.generations === 1 && m.ran === 1 && m.lifecycle >= 1 && m.commits === 1 && m.last?.phase === "ready" &&
          (r.strict ? same(m.commands, [1, 1]) && m.cancels === 1 : same(m.commands, [1]) && m.cancels === 0),
      };
    });
    R.record("RR1", "lifecycle", "REAL_REACT_MOUNT_ASYNC_ONE_GENERATION_STRICT_WITHDRAWS_THE_FIRST", rows.every((r) => r.pass), { rows });
  }
  // RR2 — Start, a double Restart in ONE event, leaving while pending: Start asks once and commits pending then the
  // board; the two Restarts React batches into one request (one command, one generation); leaving before the timer
  // runs no generation and commits nothing.
  {
    const rows = runs.map((r) => {
      const x = ok(r) ? r.run.results : null;
      return {
        label: r.label,
        start: x && { commands: x.start.commands, ran: x.start.ran, lifecycle: x.start.lifecycle, commits: x.start.commits, status: x.start.last?.status },
        doubleRestart: x && { commands: x.doubleRestart.commands, ran: x.doubleRestart.ran, commits: x.doubleRestart.commits },
        leavePending: x && { commands: x.leavePending.commands, ran: x.leavePending.ran, generations: x.leavePending.generations, commits: x.leavePending.commits },
        pass:
          Boolean(x) &&
          x.start.commands === 1 && x.start.ran === 1 && x.start.lifecycle >= 1 && x.start.commits === 1 && x.start.last?.status === "playing" &&
          x.doubleRestart.commands === 1 && x.doubleRestart.ran === 1 && x.doubleRestart.commits === 1 &&
          x.leavePending.ran === 0 && x.leavePending.generations === 0 && x.leavePending.commits === 0,
      };
    });
    R.record("RR2", "lifecycle", "REAL_REACT_START_DOUBLE_RESTART_LEAVE_PENDING", rows.every((r) => r.pass), { rows });
  }
  // RR3 — the token is the effect run, not the request id: in Strict Mode the withdrawn request (id 1) answered after
  // the remount changes nothing; the live one (also id 1) is the board. Out of order in React: B shown, A's late
  // answer commits nothing. Unmounted: a late answer runs no reducer, no accept, commits nothing. No console output.
  {
    const rows = runs.map((r) => {
      const x = ok(r) ? r.run.results : null;
      return {
        label: r.label,
        strictToken: x?.strictToken,
        outOfOrder: x?.outOfOrder,
        unmountLate: x?.unmountLate,
        consoleErrors: r.run?.consoleErrors,
        pass:
          Boolean(x) &&
          (r.strict
            ? x.strictToken.withdrawn === 1 && same(x.strictToken.ids, [1, 1]) && x.strictToken.afterWithdrawnAnswer.phase === "pending" && x.strictToken.afterWithdrawnAnswer.board === null
            : x.strictToken.withdrawn === 0) &&
          x.strictToken.final.phase === "ready" && x.strictToken.final.isLiveBoard &&
          x.outOfOrder.isB && x.outOfOrder.unchanged && x.outOfOrder.staleDelta.commits === 0 && x.outOfOrder.staleDelta.lifecycle === 0 && x.outOfOrder.staleDelta.reducer === 0 && x.outOfOrder.staleDelta.accepts === 0 &&
          x.unmountLate.delta.commits === 0 && x.unmountLate.delta.reducer === 0 && x.unmountLate.delta.accepts === 0 && x.unmountLate.cancels === 1 &&
          r.run.consoleErrors.length === 0,
      };
    });
    R.record("RR3", "lifecycle", "REAL_REACT_TOKENS_STALE_AND_UNMOUNTED_ANSWERS_SILENT", rows.every((r) => r.pass), { rows });
  }
  return R.out;
}

if (!isMainThread && workerData?.c7bRealReact) {
  realReactLifecycleMain(workerData).then(
    (result) => parentPort.postMessage({ result }),
    (error) => parentPort.postMessage({ error: String(error?.stack ?? error) }),
  );
}


// =================================================================================================
// [equivalence] — every accepted board reaches the baseline's ready state
// =================================================================================================

/** Scenarios for both drivers: every Route and mode, Start, Restart, mode changes, the next Route, many Explorers. */
function equivalenceScenarios({ keys, scale = "full" }) {
  const policies = ["win", "lose", "pickaxe", "sc-hunter", "traps", "chest-wait", "bump", "pickaxe-bump"];
  const out = [];
  let n = 0;
  for (const routeNumber of [1, 2, 3]) {
    for (const difficulty of ["easy", "medium", "hard"]) {
      const policy = policies[n % policies.length];
      const seed = 771_000 + n * 7;
      n += 1;
      out.push({
        name: `R${routeNumber}/${difficulty}/${policy}`,
        seed,
        routeNumber,
        ...(n % 2 ? { initialDifficulty: difficulty } : { changeDifficulty: difficulty === "easy" ? undefined : difficulty }),
        steps: [
          ["play", 12, { policy, keys }],
          ["restart"],
          ["play", 90, { policy, keys }],
          ...(routeNumber < 3 ? [["next", seed + 1], ["play", 30, { policy: "win", keys }]] : [["restart"], ["play", 20, { policy: "lose", keys }]]),
        ],
      });
    }
  }
  out.push({ name: "setup/modes/start", seed: 771_900, routeNumber: 2, autoStart: false, steps: [["changeDifficulty", "hard"], ["changeDifficulty", "medium"], ["start"], ["play", 40, { policy: "win", keys }]] });
  return scale === "full" ? out : out.slice(0, 3);
}

/**
 * The pending renders of a C7B run are coherent: every lifecycle commit either has no board at all (only while the
 * mount's first board is pending: exactly the lifecycle's own keys) or shows the match of the commit before it,
 * frozen, field for field — never a gameplay render of its own.
 */
const matchFields = (observed) =>
  Object.fromEntries(Object.entries(observed).filter(([k]) => !["generationPhase", "requestedDifficulty", "retryGeneration", "breakTargets"].includes(k)));

function pendingCoherence(record) {
  const problems = [];
  let lastGame = null;
  let commitCursor = 0;
  record.steps.forEach((step, index) => {
    const lifecycle = record.lifecycle?.[index];
    if (lifecycle) {
      for (const observed of lifecycle.observed) {
        if (observed.mazeMap === null) {
          const keys = Object.keys(observed).sort();
          if (!same(keys, ["generationPhase", "mazeMap", "requestedDifficulty", "retryGeneration", "routeNumber", "routeProgression"]) || !["mount", "next"].includes(step.label)) {
            problems.push(`${step.label}: a board-less pending render outside a mount (${keys.join(",")})`);
          }
          continue;
        }
        // The one view that changes: the Pickaxe's targets are withdrawn while the match is frozen (nothing can be
        // broken), so they are compared as "none" — and must be none.
        const frozen = matchFields(observed);
        if (!["pending", "error"].includes(observed.generationPhase)) problems.push(`${step.label}: lifecycle commit in phase ${observed.generationPhase}`);
        if (observed.breakTargets?.length) problems.push(`${step.label}: break targets offered while a board is pending`);
        if (!lastGame || !same(frozen, matchFields(lastGame))) problems.push(`${step.label}: a pending render that is not the previous match, frozen`);
      }
    }
    lastGame = record.commits[commitCursor + step.commits - 1] ?? lastGame;
    commitCursor += step.commits;
  });
  return problems;
}

async function equivalenceChecks({ rev = null, sourceOverrides, scale = "full" } = {}) {
  const R = recorder();
  // E1 — the shim: every render the game makes, completions, sounds, draws, generateMaze calls, the stream after —
  // the baseline's, scenario by scenario.
  {
    const scenarios = equivalenceScenarios({ keys: false, scale });
    const [a, b] = await Promise.all([runInShim({ rev, sourceOverrides, scenarios }), runInShim({ rev: BASELINE, scenarios })]);
    const firstDiff = a.findIndex((r, i) => !same(r, b[i]));
    R.record("E1", "equivalence", "SHIM_READY_STATES_ARE_THE_BASELINES", firstDiff < 0, {
      scenarios: a.length,
      commits: a.reduce((n, r) => n + r.commits.length, 0),
      completions: a.reduce((n, r) => n + r.completions.length, 0),
      firstDiff: firstDiff < 0 ? null : a[firstDiff].scenario,
    });
  }
  // E2 + E3 — the real React, four configurations: every committed game render, commits and component calls per input,
  // completions, sounds, draws, generations, keyboard listeners and console output are the baseline's; and on the
  // tree, every pending commit is coherent.
  {
    const configs = [
      { label: "development · StrictMode · act", nodeEnv: "development", strict: true, regime: "act", keys: true },
      { label: "development · StrictMode · discrete events", nodeEnv: "development", strict: true, regime: "discrete", keys: true },
      { label: "production · default updates", nodeEnv: "production", strict: false, regime: "default", keys: false },
      { label: "production · discrete events", nodeEnv: "production", strict: false, regime: "discrete", keys: true },
    ];
    const rows = [];
    const coherence = [];
    for (const config of configs) {
      const scenarios = equivalenceScenarios({ keys: config.keys, scale: scale === "full" ? "small" : "small" });
      const [a, b, l] = await Promise.all([
        runInRealReact({ rev, sourceOverrides, ...config, scenarios }),
        runInRealReact({ rev: BASELINE, ...config, scenarios }),
        runInRealReact({ rev, sourceOverrides, ...config, scenarios, observeLifecycle: true }),
      ]);
      const firstDiff = a.results.findIndex((r, i) => !same(r, b.results[i]));
      rows.push({
        label: config.label,
        identical: firstDiff < 0 && same(a.consoleErrors, b.consoleErrors),
        consoleErrors: a.consoleErrors.length,
        commits: a.results.reduce((n, r) => n + r.commits.length, 0),
        strictMountReplays: a.strictMountReplays ?? null,
        firstDiff: firstDiff < 0 ? null : a.results[firstDiff].scenario,
      });
      const lifecycleCommits = l.results.reduce((n, r) => n + (r.lifecycleCommits?.length ?? 0), 0);
      coherence.push({ label: config.label, lifecycleCommits, problems: l.results.flatMap(pendingCoherence).slice(0, 4) });
    }
    R.record("E2", "equivalence", "REAL_REACT_READY_STATES_ARE_THE_BASELINES", rows.every((r) => r.identical && r.consoleErrors === 0), { rows });
    const lifecycleTree = openSourceTree({ rev, sourceOverrides }).exists(ROUTE_SESSION);
    R.record(
      "E3",
      "equivalence",
      "PENDING_RENDERS_ARE_COHERENT_NEVER_GAMEPLAY",
      coherence.every((c) => c.problems.length === 0 && (lifecycleTree ? c.lifecycleCommits > 0 : c.lifecycleCommits === 0)),
      { coherence },
    );
  }
  // E4 — seeded diagnostic sessions (armed seeds, the launcher's shape: mount on the continuation, Start, steps, Restart,
  // a mode change, Start, steps): board, Hunter, Sentinel, every render and the stream after — the baseline's.
  {
    const witnesses = [
      { seed: 12420031, routeNumber: 2, difficulty: "easy" },
      { seed: 12430048, routeNumber: 3, difficulty: "easy" },
      { seed: 12421027, routeNumber: 2, difficulty: "medium" },
      { seed: 12412046, routeNumber: 1, difficulty: "hard" },
      { seed: 12432045, routeNumber: 3, difficulty: "hard" },
    ];
    const session = (side, w) => {
      const rt = loadRouteRuntime({ rev: side.rev, sourceOverrides: side.sourceOverrides });
      const seam = rt.LAB.graph.require(ROUTE_RANDOM_SEAM);
      seam.armRouteRandomSeed(w.seed);
      try {
        const frames = [];
        const run = rt.mount({ seed: 1, routeNumber: w.routeNumber, initialDifficulty: w.difficulty, autoStart: false, onRender: (g) => frames.push(observeRoute(g)) });
        run.act((g) => g.startGame());
        for (let i = 0; i < 6 && run.state.status === "playing"; i += 1) {
          const g = run.state;
          const d = [{ row: -1, col: 0 }, { row: 0, col: 1 }, { row: 1, col: 0 }, { row: 0, col: -1 }][i % 4];
          run.act(() => g.tryMovePlayer(d));
        }
        run.act((g) => g.restartGame());
        run.act((g) => g.changeDifficulty?.(w.difficulty === "hard" ? "medium" : "hard"));
        run.act((g) => g.startGame());
        playToEnd(run, "win", 60);
        return { frames: sha(frames), last: observeRoute(run.state), next: [seam.routeRandom(), seam.routeRandom(), seam.routeRandom()], completions: sha(run.completions) };
      } finally {
        seam.clearRouteRandomSeed();
      }
    };
    const rows = witnesses.map((w) => {
      const a = session({ rev, sourceOverrides }, w);
      const b = session({ rev: BASELINE }, w);
      return { ...w, identical: same(a, b) };
    });
    R.record("E4", "equivalence", "SEEDED_SESSIONS_ARE_THE_BASELINES", rows.every((r) => r.identical), { rows });
  }
  return R.out;
}


// =================================================================================================
// [view] — the REAL Rota view and launcher, rendered by React's own reconciler
// =================================================================================================

/**
 * React's reconciler (19.2, the build @react-three/fiber ships; ESM, transpiled here in memory) with a host config
 * that keeps host elements as plain objects: the same React core as react-dom — hooks, batching, layout and passive
 * effects, Strict Mode's double invocation in development — with nothing to draw.
 */
function createViewRenderer(React) {
  const require = createRequire(SELF);
  const scheduler = require("scheduler");
  const source = fs.readFileSync(path.resolve("node_modules/@react-three/fiber/react-reconciler/index.js"), "utf8");
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
  const mod = { exports: {} };
  new vm.Script(`(function (exports, require, module, process) {${js}\n})`).runInThisContext()(
    mod.exports,
    (specifier) => (specifier === "react" ? React : specifier === "scheduler" ? scheduler : require(specifier)),
    mod,
    process,
  );
  const createReconciler = mod.exports.default;
  let priority = 0;
  let commits = 0;
  const host = {
    isPrimaryRenderer: true, warnsIfNotActing: false, supportsMutation: true, supportsPersistence: false, supportsHydration: false,
    createInstance: (type, props) => ({ type, props, children: [] }),
    createTextInstance: (text) => ({ text }),
    appendInitialChild: (p, c) => void p.children.push(c),
    appendChild: (p, c) => {
      const at = p.children.indexOf(c);
      if (at >= 0) p.children.splice(at, 1);
      p.children.push(c);
    },
    appendChildToContainer: (p, c) => host.appendChild(p, c),
    insertBefore: (p, c, b) => {
      const at = p.children.indexOf(c);
      if (at >= 0) p.children.splice(at, 1);
      p.children.splice(p.children.indexOf(b), 0, c);
    },
    insertInContainerBefore: (p, c, b) => host.insertBefore(p, c, b),
    removeChild: (p, c) => void p.children.splice(p.children.indexOf(c), 1),
    removeChildFromContainer: (p, c) => void p.children.splice(p.children.indexOf(c), 1),
    commitUpdate: (instance, _type, _old, next) => {
      instance.props = next;
    },
    commitTextUpdate: (t, _o, n) => {
      t.text = n;
    },
    finalizeInitialChildren: () => false, commitMount() {}, shouldSetTextContent: () => false,
    getRootHostContext: () => ({}), getChildHostContext: (c) => c, getPublicInstance: (i) => i,
    prepareForCommit: () => null,
    resetAfterCommit: () => {
      commits += 1;
    },
    preparePortalMount() {}, clearContainer: (c) => void (c.children.length = 0),
    hideInstance() {}, unhideInstance() {}, hideTextInstance() {}, unhideTextInstance() {}, resetTextContent() {},
    scheduleTimeout: setTimeout, cancelTimeout: clearTimeout, noTimeout: -1,
    getInstanceFromNode: () => null, beforeActiveInstanceBlur() {}, afterActiveInstanceBlur() {}, detachDeletedInstance() {},
    prepareScopeUpdate() {}, getInstanceFromScope: () => null, shouldAttemptEagerTransition: () => false, trackSchedulerEvent() {},
    resolveEventType: () => null, resolveEventTimeStamp: () => -1.1, requestPostPaintCallback() {},
    maySuspendCommit: () => false, preloadInstance: () => true, startSuspendingCommit() {}, suspendInstance() {}, waitForCommitToBeReady: () => null,
    NotPendingTransition: null, HostTransitionContext: React.createContext(null),
    setCurrentUpdatePriority: (p) => {
      priority = p;
    },
    getCurrentUpdatePriority: () => priority,
    resolveUpdatePriority: () => priority || 32,
    resetFormInstance() {}, rendererPackageName: "route-view-validation", rendererVersion: "0",
  };
  const reconciler = createReconciler(host);
  return {
    get commits() {
      return commits;
    },
    mount(element, { strict }) {
      const container = { children: [] };
      const errors = [];
      const root = reconciler.createContainer(container, 1, null, strict, null, "", (e) => errors.push(String(e)), (e) => errors.push(String(e)), (e) => errors.push(String(e)), () => {}, null);
      reconciler.updateContainer(element, root, null, null);
      return {
        container,
        errors,
        unmount: () => reconciler.updateContainer(null, root, null, null),
      };
    },
  };
}

/**
 * A host tree as data: element type, its props (functions as "ƒ", children apart), its children; text as text. A prop
 * react-dom writes no attribute for is left out the way react-dom leaves it out: `undefined`, and a `false` boolean
 * attribute (`disabled={false}`) — so two trees that produce the same DOM serialise the same.
 */
function serializeHost(node) {
  if (node.text !== undefined) return node.text;
  const props = {};
  for (const [key, value] of Object.entries(node.props)) {
    if (key === "children" || key === "ref" || key === "key") continue;
    if (value === undefined || (key === "disabled" && value === false)) continue;
    props[key] = typeof value === "function" ? "ƒ" : value;
  }
  return { t: node.type, p: props, c: node.children.map(serializeHost) };
}
function findHost(node, predicate, found = []) {
  if (node.text === undefined) {
    if (predicate(node)) found.push(node);
    for (const child of node.children) findHost(child, predicate, found);
  }
  return found;
}
const textOfHost = (node) => (node.text !== undefined ? node.text : node.children.map(textOfHost).join(""));

/**
 * Load the Rota's view (or the launcher) with the REAL hook, the REAL component and React's reconciler. Icons are
 * `svg` elements named after the icon, motion elements are their plain tags, the stylesheets are nothing, and the
 * Babylon board is a stub that records the props the Rota hands it and reports ready from its first effect — as the
 * real board reports its own readiness after mounting.
 */
function loadView({ rev, sourceOverrides, React, entry = ROUTE_GAME_VIEW, board }) {
  const require = createRequire(SELF);
  const jsxRuntime = require("react/jsx-runtime");
  const MOTION_ONLY = new Set(["initial", "animate", "exit", "transition", "whileTap", "whileHover", "whileFocus", "layout", "variants"]);
  const motionTags = new Map();
  const motion = new Proxy({}, {
    get(_, tag) {
      if (!motionTags.has(tag)) {
        const element = React.forwardRef((props, ref) => React.createElement(tag, { ...Object.fromEntries(Object.entries(props).filter(([k]) => !MOTION_ONLY.has(k))), ref }));
        element.displayName = `motion.${String(tag)}`;
        motionTags.set(tag, element);
      }
      return motionTags.get(tag);
    },
  });
  const icons = new Map();
  const lucide = new Proxy({ __esModule: true }, {
    get(target, name) {
      if (name in target) return target[name];
      if (typeof name !== "string") return undefined;
      if (!icons.has(name)) icons.set(name, (props) => React.createElement("svg", { "data-icon": name, className: props.className, "aria-hidden": props["aria-hidden"] }));
      return icons.get(name);
    },
  });
  const BoardStub = (props) => {
    board.renders.push(props);
    React.useEffect(() => {
      board.mounts += 1;
      props.onReady?.();
      return () => {
        board.unmounts += 1;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const sortedSet = (set) => [...(set ?? [])].sort();
    return React.createElement("route-board", {
      map: props.mazeMap ? mapDigest(props.mazeMap) : null,
      walls: sortedSet(props.walls),
      player: props.player, guardian: props.guardian, sentinel: props.sentinel, status: props.status,
      moveTargets: sortedSet(props.moveTargets), dangerTiles: sortedSet(props.dangerTiles), breakTargets: props.breakTargets,
      brokenWall: props.brokenWall, chestOpened: props.chestOpened, collected: sortedSet(props.collectedSet), traps: sortedSet(props.triggeredTrapSet),
      sentinelCommitted: props.sentinelCommitted, aimedWall: props.aimedWall, reducedMotion: props.reducedMotion,
    });
  };
  const boardModule = {
    __esModule: true,
    get RouteBabylonBoard() {
      if (board.fail) throw Object.assign(new Error("Failed to load chunk board.js"), { name: "ChunkLoadError" });
      return BoardStub;
    },
  };
  const sounds = [];
  const tree = openSourceTree({ rev, sourceOverrides });
  let graphRef = null;
  const rota = loadRouteModules({
    tree,
    entry,
    react: React,
    surface: [],
    mocks: {
      "react/jsx-runtime": jsxRuntime,
      "motion/react": { motion, useReducedMotion: () => false },
      "lucide-react": lucide,
      "@/lib/feedback-motion": { gentleShakeAnimate: { x: [0, -4, 4, 0] } },
      "@/components/worlds/master-scene/worldMasterSceneConfig": { getWorldMasterSceneStyle: () => ({ "--world": "route" }) },
      "@/components/worlds/master-scene/world-master-scene.css": {},
      "@/games/escape-maze/route-visual.css": {},
      [BOARD_SPECIFIER]: boardModule,
      "src/lib/game-sounds.ts": {
        playGentleErrorTone: () => sounds.push("sound:error"),
        playSuccessChime: () => sounds.push("sound:success"),
        playStoneBreak: () => sounds.push("sound:stone"),
      },
      "@/components/GameScreen": {
        // The launcher's session, as GameScreen mounts it (intro skipped): the REAL Rota on the session's continuation.
        GameScreen: (props) =>
          React.createElement(graphRef.require(ROUTE_GAME_VIEW).RouteStrategyGame, {
            key: props.sessionKey,
            onComplete: props.onComplete,
            onExit: props.onExit,
            continuation: props.continuation,
          }),
      },
      "@/engine/storage": { createTransientGameResult: (result) => ({ ...result, id: "transient", playedAt: "now" }) },
    },
  });
  graphRef = rota.graph;
  const fakeWindow = { addEventListener() {}, removeEventListener() {}, event: undefined };
  rota.sandbox.window = fakeWindow;
  rota.sandbox.requestAnimationFrame = () => 0;
  let clock = 0;
  rota.sandbox.Date = { now: () => (clock += 1000) };
  return { rota, tree, sounds, graph: rota.graph };
}

async function viewMain({ rev, sourceOverrides, strict, suite }) {
  const consoleErrors = [];
  console.error = (...a) => consoleErrors.push(a.map(String).join(" ").slice(0, 300));
  console.warn = (...a) => consoleErrors.push(`warn: ${a.map(String).join(" ").slice(0, 300)}`);
  const require = createRequire(SELF);
  const React = require("react");
  const renderer = createViewRenderer(React);
  const tick = () => new Promise((r) => setTimeout(r, 0));
  const settle = async () => {
    for (let quiet = 0, guard = 0; quiet < 4 && guard < 300; guard += 1) {
      const before = renderer.commits;
      await tick();
      quiet = renderer.commits === before ? quiet + 1 : 0;
    }
  };
  const results = {};

  if (suite === "flows") {
    // The view on every accepted board, step by step, through the product's own buttons.
    const board = { renders: [], mounts: 0, unmounts: 0, fail: false };
    const view = loadView({ rev, sourceOverrides, React, board });
    const { RouteStrategyGame } = view.graph.require(ROUTE_GAME_VIEW);
    const frames = [];
    const entry = { ready: 0, errors: [] };
    view.rota.setSeed(424_242);
    // An armed diagnostic seed: every board is a one-call generation from it, so a development Strict Mode mount (which
    // drew a second, discarded board before C7B) shows the same boards on both trees.
    view.graph.require(ROUTE_RANDOM_SEAM).armRouteRandomSeed(12421027);
    const mounted = renderer.mount(
      React.createElement(RouteStrategyGame, {
        onComplete: () => {},
        onExit: () => {},
        continuation: { kind: "escape-maze-route", routeNumber: 2, difficulty: "medium" },
        onEntryReady: () => (entry.ready += 1),
        onEntryError: (e) => entry.errors.push(String(e?.message ?? e)),
      }),
      { strict },
    );
    await settle();
    const root = () => mounted.container.children[0];
    const button = (label) => findHost(root(), (n) => n.type === "button" && (typeof label === "string" ? n.props["aria-label"] === label : label.test(n.props["aria-label"] ?? "")))[0] ?? null;
    const frame = (label) => frames.push({ label, tree: sha(serializeHost(root())), ...(process.env.C7B_DUMP && { raw: serializeHost(root()) }), pending: Boolean(findHost(root(), (n) => n.props?.["data-route-generation"] !== undefined).length) || textOfHost(root()).includes(PENDING_MESSAGE) });
    const press = async (label) => {
      const b = button(label);
      if (!b) return false;
      b.props.onClick?.({ preventDefault() {}, currentTarget: b });
      await settle();
      return true;
    };
    frame("mount");
    await press(/^Modo Desafiador/);
    frame("mode:hard");
    await press(/^Modo Equilibrado/);
    frame("mode:medium");
    await press("Iniciar rota com a dificuldade selecionada");
    frame("start");
    // An Explorer that reads only what the board is handed: lights first, then the portal, around the Hunter.
    const nextDirection = () => {
      const props = board.renders.at(-1);
      if (!props || props.status !== "playing") return null;
      const key = (p) => `${p.row},${p.col}`;
      const goals = props.mazeMap.collectibleStars.filter((star) => !props.collectedSet.has(key(star)));
      const targets = new Set((goals.length ? goals : [props.mazeMap.exitPosition]).map(key));
      const blocked = new Set([...props.walls, key(props.guardian), key(props.sentinel)]);
      const deltas = [["Mover Cima", -1, 0], ["Mover Baixo", 1, 0], ["Mover Esquerda", 0, -1], ["Mover Direita", 0, 1]];
      const seen = new Map([[key(props.player), null]]);
      const queue = [props.player];
      for (let q = 0; q < queue.length; q += 1) {
        const cell = queue[q];
        if (targets.has(key(cell)) && q > 0) {
          let cursor = key(cell);
          while (seen.get(cursor)?.from !== key(props.player)) cursor = seen.get(cursor).from;
          return seen.get(cursor).label;
        }
        for (const [label, dr, dc] of deltas) {
          const next = { row: cell.row + dr, col: cell.col + dc };
          if (next.row < 0 || next.row > 8 || next.col < 0 || next.col > 8 || blocked.has(key(next)) || seen.has(key(next))) continue;
          seen.set(key(next), { from: key(cell), label });
          queue.push(next);
        }
      }
      return deltas[0][0];
    };
    for (let i = 0; i < 40; i += 1) {
      const reward = button(/^Escolher /);
      if (reward) await press(reward.props["aria-label"]);
      else {
        const direction = nextDirection();
        if (!direction || !(await press(direction))) break;
      }
      frame(`step:${i}`);
    }
    await press(/^Detalhes da rota|Detalhes/) ;
    const details = findHost(root(), (n) => n.type === "button" && n.props.className === "rsg-details-trigger")[0];
    details?.props.onClick?.();
    await settle();
    frame("details");
    await press("Começar outra rota");
    frame("restart");
    results.flows = { frames, entry, board: { mounts: board.mounts, unmounts: board.unmounts }, sounds: view.sounds, errors: mounted.errors };
    mounted.unmount();
    await settle();
    view.graph.require(ROUTE_RANDOM_SEAM).clearRouteRandomSeed();
  }

  if (suite === "lifecycle") {
    // The first board pending, failing, retried; the board chunk failing on its own; leaving while pending; the
    // controls while a board is pending.
    const run = async ({ failBoard = false } = {}) => {
      const board = { renders: [], mounts: 0, unmounts: 0, fail: failBoard };
      const view = loadView({ rev, sourceOverrides, React, board });
      if (!view.tree.exists(ROUTE_GENERATION_CLIENT)) return null;
      const client = view.graph.require(ROUTE_GENERATION_CLIENT);
      const other = createModuleGraph({ tree: view.tree }).require(routeGenerationRunnerFile(view.tree));
      const jobs = [];
      client.routeGenerationExecutor = (command, deliver) => {
        const j = { command: structuredClone(command), deliver, cancels: 0 };
        jobs.push(j);
        return () => {
          j.cancels += 1;
        };
      };
      const answer = (j) => structuredClone({ requestId: j.command.requestId, status: "ready", result: other.runRouteGenerationSync(j.command.request) });
      const { RouteStrategyGame } = view.graph.require(ROUTE_GAME_VIEW);
      const entry = { ready: 0, errors: [] };
      const mounted = renderer.mount(
        React.createElement(RouteStrategyGame, {
          onComplete: () => {},
          onExit: () => {},
          continuation: { kind: "escape-maze-route", routeNumber: 1, difficulty: "easy" },
          onEntryReady: () => (entry.ready += 1),
          onEntryError: (e) => entry.errors.push(String(e?.message ?? e)),
        }),
        { strict },
      );
      await settle();
      const live = () => jobs.filter((j) => j.cancels === 0).at(-1);
      const root = () => mounted.container.children[0];
      const has = (type) => findHost(root() ?? { children: [] }, (n) => n.type === type).length;
      const text = () => (root() ? textOfHost(root()) : "");
      const button = (label) => findHost(root(), (n) => n.type === "button" && n.props["aria-label"] === label)[0] ?? null;
      const give = async (j, response) => {
        j.deliver(response ?? answer(j));
        await settle();
      };
      return { view, board, jobs, live, answer, give, entry, mounted, root, has, text, button };
    };

    // V1: the first board pending → no board, the calm message; the board's code arrived meanwhile; its arrival mounts
    // the board, whose own readiness is the entry's.
    {
      const r = await run();
      if (r) {
        const pending = { board: r.has("route-board"), message: r.text().includes(PENDING_MESSAGE), hud: r.text().includes("Luzes"), ready: r.entry.ready, phase: r.root().props["data-route-generation"] };
        await r.give(r.live());
        const ready = { board: r.has("route-board"), mounts: r.board.mounts, ready: r.entry.ready, message: r.text().includes(PENDING_MESSAGE), hud: r.text().includes("Luzes") };
        // V4: the controls while a board is pending (Start from setup; Restart while playing), then back to exactly
        // the view on the new board.
        const start = r.button("Iniciar rota com a dificuldade selecionada");
        start.props.onClick();
        await settle();
        const whileStart = {
          startDisabled: r.button("Iniciar rota com a dificuldade selecionada")?.props.disabled === true,
          modesEnabled: findHost(r.root(), (n) => n.type === "button" && /^Modo /.test(n.props["aria-label"] ?? "")).every((b) => !b.props.disabled),
          message: r.text().includes(PENDING_MESSAGE),
        };
        await r.give(r.live());
        const moveDisabledBefore = r.button("Mover Cima")?.props.disabled;
        const restart = r.button("Começar outra rota");
        restart.props.onClick();
        await settle();
        const whileRestart = {
          movesDisabled: ["Mover Cima", "Mover Baixo", "Mover Esquerda", "Mover Direita"].every((l) => r.button(l)?.props.disabled === true),
          restartStillOffered: Boolean(r.button("Começar outra rota")) && !r.button("Começar outra rota").props.disabled,
          message: r.text().includes(PENDING_MESSAGE),
          noMoveHints: (r.board.renders.at(-1)?.moveTargets?.size ?? 0) === 0,
        };
        await r.give(r.live());
        const after = { movesEnabled: r.button("Mover Cima")?.props.disabled === false || r.button("Mover Cima")?.props.disabled === undefined ? !r.button("Mover Cima").props.disabled : false, message: r.text().includes(PENDING_MESSAGE) };
        // A Restart that fails, from Detalhes (where Restart lives): the calm error and its retry, right there; the
        // entry hears nothing (it is long revealed); the retry opens the new board.
        findHost(r.root(), (n) => n.type === "button" && n.props.className === "rsg-details-trigger")[0].props.onClick();
        await settle();
        r.button("Começar outra rota").props.onClick();
        await settle();
        const failing = r.live();
        await r.give(failing, { requestId: failing.command.requestId, status: "failed", message: "forced" });
        const inGameFailure = {
          message: r.text().includes(ERROR_MESSAGE),
          retryShownWithDetailsOpen: Boolean(r.button("Tentar preparar a rota novamente")),
          movesDisabled: r.button("Mover Cima")?.props.disabled !== false,
          entryErrors: r.entry.errors.length,
        };
        r.button("Tentar preparar a rota novamente").props.onClick();
        await settle();
        const retried = r.live();
        await r.give(retried);
        inGameFailure.retryId = retried.command.requestId > failing.command.requestId;
        inGameFailure.afterRetry = { error: r.text().includes(ERROR_MESSAGE), retry: Boolean(r.button("Tentar preparar a rota novamente")) };
        results.firstBoard = { pending, ready, whileStart, moveDisabledBefore: moveDisabledBefore ?? null, whileRestart, after, inGameFailure, errors: r.mounted.errors, entryErrors: r.entry.errors };
        r.mounted.unmount();
        await settle();
      }
    }
    // V2: the first board fails → the entry hears it, once; the calm error and a retry; the retry asks again (a new
    // request id) and the board mounts.
    {
      const r = await run();
      if (r) {
        const failing = r.live();
        await r.give(failing, { requestId: failing.command.requestId, status: "failed", message: "forced" });
        const failed = { board: r.has("route-board"), message: r.text().includes(ERROR_MESSAGE), entryErrors: [...r.entry.errors], retry: Boolean(r.button("Tentar preparar a rota novamente")) };
        r.button("Tentar preparar a rota novamente").props.onClick();
        await settle();
        const retried = r.live();
        const retryId = retried?.command.requestId;
        await r.give(retried);
        results.firstBoardFails = {
          failed,
          retryId,
          failedId: failing.command.requestId,
          board: r.has("route-board"),
          ready: r.entry.ready,
          entryErrorsAfter: r.entry.errors.length,
        };
        r.mounted.unmount();
        await settle();
      }
    }
    // V3: the board's chunk fails while generation succeeds — the board's failure, alone: one onEntryError from the
    // board's load, no generation error on screen, the match ready.
    {
      const r = await run({ failBoard: true });
      if (r) {
        await r.give(r.live());
        results.chunkFails = {
          entryErrors: r.entry.errors,
          generationErrorShown: r.text().includes(ERROR_MESSAGE),
          boardLoading: r.text().includes("Preparando o tabuleiro Babylon…"),
          board: r.has("route-board"),
        };
        r.mounted.unmount();
        await settle();
      }
    }
    // V5: leaving while the first board is pending: the late answer mounts nothing, reports nothing.
    {
      const r = await run();
      if (r) {
        const pendingJob = r.live();
        const late = r.answer(pendingJob);
        r.mounted.unmount();
        await settle();
        const commitsBefore = renderer.commits;
        pendingJob.deliver(late);
        await settle();
        results.leavePending = { cancels: pendingJob.cancels, commits: renderer.commits - commitsBefore, boardMounts: r.board.mounts, ready: r.entry.ready, children: r.mounted.container.children.length };
      }
    }
  }

  if (suite === "launcher") {
    // The REAL launcher page: Launch, Start, Relançar, another scenario, exit — every request the Rota sends carries
    // the seed of the session that sent it, in development Strict Mode as in production.
    const board = { renders: [], mounts: 0, unmounts: 0, fail: false };
    const view = loadView({ rev, sourceOverrides, React, board, entry: LAUNCHER });
    const seam = view.graph.require(ROUTE_RANDOM_SEAM);
    const requests = [];
    const job = view.graph.require(ROUTE_GENERATION_JOB);
    const realCreate = job.createRouteGenerationRequest;
    job.createRouteGenerationRequest = (...a) => {
      const request = realCreate(...a);
      requests.push({ armed: request.random?.armedSeed ?? null, difficulty: request.difficulty, routeNumber: request.routeNumber });
      return request;
    };
    const generation = view.graph.require(view.tree.declaring("generateMaze"));
    const realGenerate = generation.generateMaze;
    const boards = [];
    generation.generateMaze = (...a) => {
      const map = realGenerate(...a);
      boards.push({ armed: seam.getArmedRouteSeed(), map: mapDigest(map), difficulty: a[0], routeNumber: a[1] });
      return map;
    };
    const Page = view.graph.require(LAUNCHER).default;
    const mounted = renderer.mount(React.createElement(Page), { strict });
    await settle();
    const root = () => mounted.container.children[0];
    const button = (pattern) => findHost(root(), (n) => n.type === "button" && pattern.test(textOfHost(n)))[0] ?? null;
    const click = async (pattern) => {
      const b = button(pattern);
      b?.props.onClick?.();
      await settle();
      return Boolean(b);
    };
    const armedAtStart = seam.getArmedRouteSeed();
    const steps = [];
    const mark = (label) => steps.push({ label, armed: seam.getArmedRouteSeed(), requests: requests.splice(0), boards: boards.splice(0) });
    await click(/^Launch$/);
    mark("launch");
    const rotaButton = (label) => findHost(root(), (n) => n.type === "button" && n.props["aria-label"] === label)[0] ?? null;
    rotaButton("Iniciar rota com a dificuldade selecionada")?.props.onClick();
    await settle();
    mark("start");
    rotaButton("Começar outra rota")?.props.onClick();
    await settle();
    mark("restart");
    await click(/^Relançar$/);
    mark("relaunch");
    await click(/^Sair do diagnóstico$/);
    mark("exit");
    await click(/^BASE-1 ·/);
    mark("scenario:BASE-1");
    mounted.unmount();
    await settle();
    mark("unmount");
    // the expected board for each seeded request: one `generateMaze` from the seed, in a fresh realm
    const reference = (seed, difficulty, routeNumber) => {
      const g = createModuleGraph({ tree: view.tree });
      g.require(ROUTE_RANDOM_SEAM).armRouteRandomSeed(seed);
      return mapDigest(g.require(view.tree.declaring("generateMaze")).generateMaze(difficulty, routeNumber));
    };
    results.launcher = {
      armedAtStart,
      steps: steps.map((s) => ({
        label: s.label,
        armed: s.armed,
        requests: s.requests,
        boardsFromTheirSeed: s.boards.map((b) => b.armed !== null && b.map === reference(b.armed, b.difficulty, b.routeNumber)),
        boards: s.boards.length,
      })),
      errors: mounted.errors,
    };
  }
  return { results, consoleErrors, strict };
}

function runView({ rev = null, sourceOverrides, nodeEnv, strict, suite }) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(SELF, { workerData: { c7bView: true, rev, sourceOverrides, strict, suite }, env: { ...process.env, NODE_ENV: nodeEnv } });
    let settled = false;
    worker.once("message", (message) => {
      settled = true;
      if (message.error) reject(new Error(message.error));
      else resolve(message.result);
      worker.terminate();
    });
    worker.once("error", (error) => {
      if (!settled) reject(error);
    });
    worker.once("exit", (code) => {
      if (!settled) reject(new Error(`view worker exited with ${code} before answering`));
    });
  });
}

if (!isMainThread && workerData?.c7bView) {
  viewMain(workerData).then(
    (result) => parentPort.postMessage({ result }),
    (error) => parentPort.postMessage({ error: String(error?.stack ?? error) }),
  );
}


async function viewChecks({ rev = null, sourceOverrides, includeBaseline = true } = {}) {
  const R = recorder();
  const builds = [
    { label: "development · StrictMode", nodeEnv: "development", strict: true },
    { label: "production", nodeEnv: "production", strict: false },
  ];
  const run = async (suite, side = { rev, sourceOverrides }) => {
    const out = [];
    for (const build of builds) {
      try {
        out.push({ ...build, ...(await runView({ ...side, ...build, suite })) });
      } catch (error) {
        out.push({ ...build, error: String(error?.message ?? error).slice(0, 400) });
      }
    }
    return out;
  };
  const lifecycle = await run("lifecycle");
  const rowsOf = (key) => lifecycle.map((b) => ({ label: b.label, error: b.error ?? null, consoleErrors: b.consoleErrors ?? null, ...(b.results?.[key] ?? { missing: true }) }));
  // V1 — the first board: until it arrives no board is mounted (its code has arrived), the screen says calmly that
  // the Route is being prepared and shows no match; the entry is not ready. Its arrival mounts the board, whose own
  // readiness is the entry's. While Start is pending, Start is disabled and the modes stay usable; while a Restart is
  // pending, the moves are disabled, no move is hinted on the board, Restart can still replace it; then back. A Restart
  // that fails from Detalhes shows its error and retry right there, never reaches the (revealed) entry, and retries.
  {
    const rows = rowsOf("firstBoard");
    const pass = rows.every(
      (r) =>
        !r.missing && !r.error && r.consoleErrors?.length === 0 &&
        r.pending.board === 0 && r.pending.message && !r.pending.hud && r.pending.ready === 0 && r.pending.phase === "pending" &&
        r.ready.board === 1 && r.ready.mounts >= 1 && r.ready.ready === r.ready.mounts && !r.ready.message && r.ready.hud &&
        r.whileStart.startDisabled && r.whileStart.modesEnabled && r.whileStart.message &&
        r.moveDisabledBefore === false &&
        r.whileRestart.movesDisabled && r.whileRestart.restartStillOffered && r.whileRestart.message && r.whileRestart.noMoveHints &&
        r.after.movesEnabled && !r.after.message &&
        r.inGameFailure.message && r.inGameFailure.retryShownWithDetailsOpen && r.inGameFailure.movesDisabled && r.inGameFailure.entryErrors === 0 &&
        r.inGameFailure.retryId && !r.inGameFailure.afterRetry.error && !r.inGameFailure.afterRetry.retry,
    );
    R.record("V1", "view", "NO_BOARD_BEFORE_THE_FIRST_BOARD_PENDING_IS_CALM_AND_FROZEN", pass, { rows });
  }
  // V2 — the first board fails: the entry hears it once (its watchdog does not run out on it), the screen says so
  // calmly and offers a retry; the retry asks again under a new request id, and the board mounts and reports ready.
  {
    const rows = rowsOf("firstBoardFails");
    const pass = rows.every(
      (r) =>
        !r.missing && !r.error &&
        r.failed.board === 0 && r.failed.message && r.failed.retry && r.failed.entryErrors.length === 1 &&
        r.retryId > r.failedId && r.board === 1 && r.ready >= 1 && r.entryErrorsAfter === 1,
    );
    R.record("V2", "view", "FIRST_BOARD_FAILURE_REACHES_THE_ENTRY_ONCE_RETRY_GENERATES_AGAIN", pass, { rows });
  }
  // V3 — the board's code failing is the board's failure alone: one onEntryError from its load, no generation error on
  // screen, no board — the two failures and their retries never mix.
  {
    const rows = rowsOf("chunkFails");
    const pass = rows.every((r) => !r.missing && !r.error && r.entryErrors.length === 1 && /Route board's code/.test(r.entryErrors[0]) && !r.generationErrorShown && r.boardLoading && r.board === 0);
    R.record("V3", "view", "BOARD_CHUNK_FAILURE_STAYS_THE_BOARDS", pass, { rows });
  }
  // V4 — leaving while the first board is pending: the request is withdrawn, its late answer commits nothing, mounts
  // no board, reports nothing.
  {
    const rows = rowsOf("leavePending");
    const pass = rows.every((r) => !r.missing && !r.error && r.cancels === 1 && r.commits === 0 && r.boardMounts === 0 && r.ready === 0 && r.children === 0);
    R.record("V4", "view", "LEAVING_WHILE_PENDING_MOUNTS_NOTHING", pass, { rows });
  }
  // V5 — the REAL launcher: every request the Rota sends carries the armed seed of the session that sent it — Launch,
  // Start, Restart, Relançar, another scenario — in development Strict Mode as in production; each board is a one-call
  // generation from that seed; nothing is armed before a session, after exit or after the page unmounts.
  {
    const launcher = await run("launcher");
    const rows = launcher.map((b) => {
      const l = b.results?.launcher;
      const expected = { launch: 12432045, start: 12432045, restart: 12432045, relaunch: 12432045, exit: null, "scenario:BASE-1": 12420031, unmount: null };
      const ok =
        l && !b.error && b.consoleErrors?.length === 0 && l.armedAtStart === null &&
        l.steps.every((step) => step.armed === expected[step.label] && step.requests.every((r) => r.armed === expected[step.label]) && step.boardsFromTheirSeed.every(Boolean)) &&
        ["launch", "start", "restart", "relaunch", "scenario:BASE-1"].every((label) => l.steps.find((s) => s.label === label)?.requests.length >= 1);
      return { label: b.label, error: b.error ?? null, pass: Boolean(ok), steps: l?.steps.map((s) => `${s.label}:${s.armed}:${s.requests.map((r) => r.armed).join("/")}`) };
    });
    R.record("V5", "view", "LAUNCHER_REQUESTS_CARRY_THEIR_SESSIONS_SEED_STRICT_MODE_INCLUDED", rows.every((r) => r.pass), { rows });
  }
  // V6 — on every accepted board the view is the baseline's, node for node (every element, attribute, text, the board's
  // props), through the product's own buttons: mount, two modes, Start, forty steps (a reward taken when offered),
  // Detalhes, Restart — development Strict Mode and production, on an armed seed.
  if (includeBaseline) {
    const now = await run("flows");
    const was = await run("flows", { rev: BASELINE });
    const rows = now.map((b, i) => {
      const a = b.results?.flows;
      const c = was[i].results?.flows;
      const frames = a?.frames.map((f) => [f.label, f.tree]) ?? null;
      const baseFrames = c?.frames.map((f) => [f.label, f.tree]) ?? null;
      const firstDiff = frames && baseFrames ? frames.findIndex((f, k) => !same(f, baseFrames[k])) : -2;
      return {
        label: b.label,
        error: b.error ?? was[i].error ?? null,
        frames: frames?.length ?? null,
        identical: Boolean(frames) && same(frames, baseFrames) && same(a.sounds, c.sounds) && same(a.entry, c.entry) && same(a.board, c.board),
        firstDiff: firstDiff >= 0 ? frames[firstDiff][0] : firstDiff === -2 ? "missing" : null,
        anyPendingFrame: a?.frames.some((f) => f.pending) ?? null,
      };
    });
    R.record("V6", "equivalence", "VIEW_ON_EVERY_ACCEPTED_BOARD_IS_THE_BASELINES", rows.every((r) => r.identical && r.frames > 20 && !r.anyPendingFrame), { rows });
  }
  return R.out;
}


// =================================================================================================
// [performance] — informational: what the local executor costs, and when it runs
// =================================================================================================

/**
 * C7B moves WHEN a generation runs, not where: the local executor still computes on the main thread. Measured here,
 * natively in Node (no vm sandbox in the timed path for the timer; the generation runs in the graph's realm as the hook
 * runs it): the delay from a command to its timer firing (the scheduling overhead) against the generation itself.
 * Never a verdict.
 */
async function performanceInfo({ rev = null, sourceOverrides } = {}) {
  const tree = openSourceTree({ rev, sourceOverrides });
  if (!tree.exists(ROUTE_GENERATION_CLIENT)) return { id: "I1", kind: "performance", name: "LOCAL_EXECUTOR_SCHEDULING_OVERHEAD", pass: true, detail: { note: "no generation client in this tree" } };
  const graph = createModuleGraph({ tree, globals: { setTimeout, clearTimeout, Math, Date } });
  const job = graph.require(ROUTE_GENERATION_JOB);
  // ROUTE-C7C: the run and the local executor moved to the runner (the job keeps request/accept). Same functions.
  const runner = graph.require(routeGenerationRunnerFile(tree));
  const { runRouteGenerationLocally } = runner.runRouteGenerationLocally ? runner : graph.require(ROUTE_GENERATION_CLIENT);
  const realRun = runner.runRouteGenerationSync;
  const samples = [];
  for (let n = 0; n < 40; n += 1) {
    const sample = {};
    runner.runRouteGenerationSync = (request) => {
      sample.start = performance.now();
      const result = realRun(request);
      sample.end = performance.now();
      return result;
    };
    await new Promise((resolve) => {
      const request = job.createRouteGenerationRequest(["easy", "medium", "hard"][n % 3], 1 + (n % 3));
      sample.issued = performance.now();
      runRouteGenerationLocally({ requestId: n + 1, intent: "restart", request }, () => resolve());
    });
    samples.push({ schedule: sample.start - sample.issued, compute: sample.end - sample.start });
  }
  runner.runRouteGenerationSync = realRun;
  const pct = (list, q) => {
    const sortedList = [...list].sort((a, b) => a - b);
    return Number(sortedList[Math.min(sortedList.length - 1, Math.floor(q * sortedList.length))].toFixed(2));
  };
  const schedule = samples.map((x) => x.schedule);
  const compute = samples.map((x) => x.compute);
  return {
    id: "I1",
    kind: "performance",
    name: "LOCAL_EXECUTOR_SCHEDULING_OVERHEAD",
    pass: true,
    detail: {
      samples: samples.length,
      scheduleMs: { p50: pct(schedule, 0.5), p95: pct(schedule, 0.95) },
      computeOnTheMainThreadMs: { p50: pct(compute, 0.5), p95: pct(compute, 0.95) },
      note: "one macrotask between asking and computing (the pending commit lands first); the computation itself still blocks the main thread — no performance gain is claimed, that is C7C's",
    },
  };
}

// =================================================================================================
// mutants
// =================================================================================================

const MUTANTS_LIST = [
  ["a stale answer accepted: the token is not checked", ROUTE_GENERATION_CLIENT, ["if (!open || response.requestId !== order.requestId) return;", "if (response.requestId !== order.requestId) return;"]],
  ["a stale answer restores its RNG: accepted before the check", ROUTE_GENERATION_CLIENT, ["    (response) => {\n      if (!open", "    (response) => {\n      if (response.status === \"ready\") acceptRouteGenerationResult(request, response.result);\n      if (!open"]],
  ["an unmounted (or superseded) answer dispatches: the effect never withdraws", ROUTE_HOOK, ["    return startRouteGeneration(\n      routeGenerationExecutor,", "    startRouteGeneration(\n      routeGenerationExecutor,"]],
  ["request ids reused", ROUTE_SESSION, ["    case \"GENERATION_REQUESTED\": {\n      const requestId = state.requests + 1;", "    case \"GENERATION_REQUESTED\": {\n      const requestId = state.requests;"]],
  ["mode A overwrites B: a new request does not replace a pending one", ROUTE_HOOK, ["  }, [generation, routeNumber, startNewMaze]);", "  // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [generation.phase, routeNumber, startNewMaze]);"]],
  ["an error keeps the board pending forever", ROUTE_SESSION, ["      return {\n        ...state,\n        generation: { phase: \"error\", target: state.generation.target },\n      };", "      return state;"]],
  ["retry reuses the failed request", ROUTE_SESSION, ["          target: { ...state.generation.target, requestId },", "          target: state.generation.target,"]],
  ["an accepted board forgets acceptRouteGenerationResult", ROUTE_GENERATION_CLIENT, ["        map = acceptRouteGenerationResult(request, response.result);", "        map = response.result.map;"]],
  ["gameplay active while a board is pending", ROUTE_HOOK, ["    const tryMovePlayer = (delta: GridPosition) => {\n      if (awaitingRoute) return;\n", "    const tryMovePlayer = (delta: GridPosition) => {\n"]],
  ["the board mounted before the first board", ROUTE_GAME_VIEW, ["                <div className=\"rsg-canvas\">\n                  <div className=\"rsg-canvas-loading\">", "                <div className=\"rsg-canvas\">\n                  {RouteBabylonBoard && <RouteBabylonBoard {...({ onReady: onEntryReady, onError: onEntryError } as never)} />}\n                  <div className=\"rsg-canvas-loading\">"]],
  ["a second Restart does not withdraw the first", ROUTE_GENERATION_CLIENT, ["  return () => {\n    if (!open) return;\n    open = false;\n    cancel();\n  };", "  return () => {};"]],
  // ROUTE-C7C: the local executor moved, verbatim, to the runner — the executor the Rota profile binds in validation.
  ["Strict Mode's cleanup does not cancel the local run", ROUTE_GENERATION_RUNNER, ["  return () => clearTimeout(timer);", "  return () => {};"]],
  ["the launcher's page-level passive clear is back", LAUNCHER, ["  useLayoutEffect(() => {\n    if (session === null) return;\n    armRouteRandomSeed(session.seed);\n    return clearRouteRandomSeed;\n  }, [session]);", "  useLayoutEffect(() => {}, []);\n  // eslint-disable-next-line react-hooks/exhaustive-deps\n  useEffect(() => clearRouteRandomSeed, []);"]],
  ["a generation error goes silently to gameplay: the failure opens the match", ROUTE_SESSION, ["    case \"GENERATION_FAILED\":\n      if (", "    case \"GENERATION_FAILED\":\n      if (state.route !== null) return { ...state, generation: { phase: \"ready\" } };\n      if ("]],
];

async function mutantSuite({ sourceOverrides }) {
  const tree = openSourceTree({ sourceOverrides });
  const results = [];
  const attempt = async (group, fn) => {
    try {
      results.push(...(await fn()));
    } catch (error) {
      results.push({ id: group, kind: group, name: "THREW", pass: false, detail: { error: String(error?.message ?? error).slice(0, 200) } });
    }
  };
  await attempt("structure", () => structureChecks(treeBeforeC7C(tree)));
  await attempt("preserved", () => preservedChecks(treeBeforeC7C(tree)));
  await attempt("lifecycle", () => lifecycleChecks({ sourceOverrides }));
  await attempt("real", () => realReactLifecycleChecks({ sourceOverrides }));
  await attempt("view", () => viewChecks({ sourceOverrides, includeBaseline: false }));
  await attempt("equivalence", async () => (await equivalenceChecks({ sourceOverrides, scale: "quick" })).filter((r) => r.id === "E4"));
  return results;
}

async function runMutants() {
  const worktree = openSourceTree();
  console.log("route generation lifecycle · mutants (each applied in memory to the working tree)\n");
  const unmutated = await mutantSuite({ sourceOverrides: {} });
  const unmutatedFailing = unmutated.filter((r) => !r.pass).map((r) => r.id);
  console.log(`unmutated: ${unmutated.length - unmutatedFailing.length}/${unmutated.length} hold${unmutatedFailing.length ? ` · failing: ${unmutatedFailing.join(", ")}` : ""}`);
  let allCaught = unmutatedFailing.length === 0;
  for (const [name, file, [anchor, replacement]] of MUTANTS_LIST) {
    const text = worktree.read(file);
    if (text.split(anchor).length !== 2) {
      console.log(`  NOT APPLIED  ${name} — anchor not found exactly once in ${file}`);
      allCaught = false;
      continue;
    }
    const results = await mutantSuite({ sourceOverrides: { [file]: text.replace(anchor, replacement) } });
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
    console.error("usage: node tools/validation/route-generation-lifecycle-tests.mjs [--rev=<commit> | --mutants]");
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
  console.log(`route generation lifecycle · ${REV ? `rev ${tree.rev.slice(0, 12)}` : "working tree"} vs baseline ${BASELINE.slice(0, 7)} (generation synchronous in the hook)\n`);
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
  // ROUTE-C7C came after: C7B's text checks are C7B's state, read through the tree before C7C (the job, the client and
  // the hook reversed, C7C's modules absent — route-module-loader.mjs#treeBeforeC7C). route-generation-worker-tests
  // holds that reversal exact and checks C7C's own state. The runs below load the tree's own code.
  await group("structure", () => structureChecks(treeBeforeC7C(tree)));
  await group("preserved", () => preservedChecks(treeBeforeC7C(tree)));
  await group("lifecycle", async () => [...lifecycleChecks({ rev: REV }), ...(await realReactLifecycleChecks({ rev: REV }))]);
  await group("equivalence", () => equivalenceChecks({ rev: REV }));
  await group("view", () => viewChecks({ rev: REV }));
  await group("performance", async () => [await performanceInfo({ rev: REV })]);
  const verdicts = results.filter((r) => r.kind !== "performance");
  const failing = verdicts.filter((r) => !r.pass).map((r) => r.id);
  const tally = (kind) => {
    const of = verdicts.filter((r) => r.kind === kind);
    return `${of.filter((r) => r.pass).length}/${of.length}`;
  };
  console.log(
    `${REV ? `rev ${tree.rev.slice(0, 12)} · ` : ""}${verdicts.length - failing.length}/${verdicts.length} passed · structure ${tally("structure")} · preserved ${tally("preserved")} · ` +
      `lifecycle ${tally("lifecycle")} · equivalence ${tally("equivalence")} · view ${tally("view")} · failing: ${failing.length ? failing.join(", ") : "none"}`,
  );
  if (failing.length) console.log("ROUTE_GENERATION_LIFECYCLE_FAILED");
  return failing.length ? EXIT_VALIDATION_FAILED : EXIT_OK;
}

if (isMainThread) {
  process.exitCode = await main();
}
