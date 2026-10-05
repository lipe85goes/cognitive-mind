/**
 * ROUTE-C7A — the Rota's seeded stream as data, and the synchronous contract a
 * generation will one day cross a Worker with. Tested.
 *
 *   src/engine/route-random.ts                       `RouteRandomCheckpoint`,
 *                                                     `getRouteRandomCheckpoint`,
 *                                                     `restoreRouteRandomCheckpoint`;
 *                                                     the PRNG's state lifted out of
 *                                                     its closure, arithmetic untouched;
 *   src/games/escape-maze/route-generation-job.ts    request → run → accept, synchronous,
 *                                                     unwired (the hook still calls
 *                                                     `generateMaze` itself).
 *
 * C7A is behaviour-preserving: no map, draw, Hunter decision, render or event
 * may differ from f19f319 (`ROUTE_C7A_BASE`). Every comparison below is exact —
 * numbers by `Object.is`, maps by their full content with Set order — never a
 * tolerance.
 *
 *   [structure]    the checkpoint API and the job exist, with exactly their
 *                  contract: the seam's edit is the sanctioned one and nothing
 *                  else (`routeRandomBeforeC7A` gives back f19f319's text, the
 *                  rewritten PRNG is the old closure statement for statement);
 *                  the job imports only the seam, generation and types, has no
 *                  async/Worker/React/UI, no cycle; nothing in the product calls
 *                  it or restores a stream; arming is still the launcher's alone.
 *   [gate]         no async, no Worker: useEscapeMaze still calls `generateMaze`
 *                  directly, twice, synchronously; no product file has Worker
 *                  wiring. Holds at f19f319 too.
 *   [equivalence]  the working tree against f19f319, both loaded through
 *                  route-module-loader: thousands of seeded stream scripts
 *                  (arm, draws, picks, beginSeededGeneration, clear, re-arm),
 *                  every draw against the tooling's own PRNG, two streams past
 *                  the 2^53 counter edge (~5M draws each); seeded generation
 *                  over R1–R3 × easy/medium/hard with the Hunter after it; the
 *                  real hook played session by session (Launch, Start, steps,
 *                  Restart, mode change), armed and not; the real React in
 *                  development Strict Mode, development and production.
 *   [unseeded]     with nothing armed `routeRandom()` is exactly one
 *                  `Math.random()` and returns it, `randomItem` one draw,
 *                  generation the same calls in the same order; no checkpoint
 *                  of normal play exists; the job neither creates one nor
 *                  touches the requesting realm's `Math.random`.
 *   [handoff]      the C7 flow, without a Worker in the product: a checkpoint
 *                  taken after N draws (N = 0 … 60 000) and restored in a fresh
 *                  module graph continues EXACTLY, again and again; restore
 *                  keeps `beginSeededGeneration` restarting at the armed seed
 *                  (same board on Launch/Start/Restart); malformed checkpoints
 *                  change nothing; generation in one realm → map + checkpoint
 *                  structured-cloned → Hunter in another is the baseline,
 *                  decision for decision; the real hook with its two
 *                  `generateMaze` calls routed (in memory) through a second
 *                  realm plays every session render for render like f19f319.
 *   [clone]        checkpoint, request and result survive structuredClone (and
 *                  the checkpoint JSON) unchanged, MazeMap's Set included; a
 *                  real node:worker_threads Worker runs the job from a bundle
 *                  of the real modules and its postMessage'd results continue
 *                  the main realm's stream exactly. `--chromium`: the same in a
 *                  Chromium Worker.
 *   [performance]  informational only: seeded draws per million and seeded
 *                  generation, f19f319 against the tree, native (no vm).
 *
 * `--rev=<commit>` runs every check with that tree as "current". `--rev=f19f319`
 * is the counterfactual: no checkpoint, no restore, no job — every [structure]
 * and [handoff] check (and the checkpoint half of [clone]/[unseeded]) must
 * fail, while [gate] and [equivalence] hold.
 *
 * `--mutants` applies ten-plus in-memory mutants of the working tree (never
 * written) and requires each to be caught by at least one check.
 *
 * Usage: node tools/validation/route-worker-rng-handoff-tests.mjs [--rev=<commit> | --mutants] [--chromium]
 * Writes nothing. Exit 0 = every check holds, 1 = a check failed, 3 = usage error.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import ts from "typescript";
import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";
import { createSeededRandom } from "./route-lab.mjs";
import {
  ROUTE_C7A_BASE,
  ROUTE_GENERATION_JOB,
  ROUTE_HOOK,
  ROUTE_RANDOM_C7A_EDIT,
  ROUTE_RANDOM_SEAM,
  createModuleGraph,
  emitModuleBundle,
  openSourceTree,
  routeMocks,
  routeRandomBeforeC7A,
  treeBeforeC7B,
  ROUTE_GENERATION_CLIENT,
  topLevelStatements,
  routeGenerationRunnerFile,
  treeBeforeC7C,
} from "./route-module-loader.mjs";
import { applyAction, mapDigest, nextAction, observeRoute, runInRealReact } from "./route-react-runtime.mjs";
import { loadRouteRuntime, pathBetween } from "./route-runtime-harness.mjs";

const ROUTE_GENERATION = "src/games/escape-maze/route-generation.ts";
const ROUTE_DEFENDERS = "src/games/escape-maze/route-defenders.ts";
const LAUNCHER = "src/app/lab/route-launcher/page.tsx";
/** The PRNG's increment: the checkpoint's state moves by exactly this per draw. */
const INC = 0x6d2b79f5;
const DIFFICULTIES = ["easy", "medium", "hard"];
const ROUTES = [1, 2, 3];
/** The launcher's same-seed witnesses (src/app/lab/route-launcher/page.tsx). */
const WITNESSES = [
  { seed: 12420031, route: 2, mode: "easy" },
  { seed: 12430048, route: 3, mode: "easy" },
  { seed: 12421027, route: 2, mode: "medium" },
  { seed: 12412046, route: 1, mode: "hard" },
  { seed: 12422073, route: 2, mode: "hard" },
  { seed: 12432116, route: 3, mode: "hard" },
  { seed: 12432045, route: 3, mode: "hard" },
];

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
const MUTANTS = args.includes("--mutants");
const CHROMIUM = args.includes("--chromium");
if (args.some((arg) => arg !== revArg && arg !== "--mutants" && arg !== "--chromium") || REV === "" || (REV && MUTANTS)) {
  console.error("usage: node tools/validation/route-worker-rng-handoff-tests.mjs [--rev=<commit> | --mutants] [--chromium]");
  process.exit(EXIT_USAGE);
}
if (REV) {
  try {
    execFileSync("git", ["rev-parse", "--verify", `${REV}^{commit}`], { stdio: "ignore" });
  } catch {
    console.error(`unknown revision ${REV}`);
    process.exit(EXIT_USAGE);
  }
}

// =================================================================================================
// harness
// =================================================================================================

function createRecorder({ quiet = false } = {}) {
  const tests = [];
  const record = (id, kind, name, pass, detail = {}) => {
    tests.push({ id, kind, name, pass: Boolean(pass) });
    if (quiet) return;
    console.log(`${pass ? "PASS" : "FAIL"}  ${id} [${kind}] — ${name}`);
    for (const [k, v] of Object.entries(detail)) {
      const text = typeof v === "object" ? JSON.stringify(v) : String(v);
      console.log(`        ${k}: ${text.length > 700 ? `${text.slice(0, 697)}...` : text}`);
    }
  };
  /** A check that throws (an API the tree does not have, a rejected result) is a failed check, with the reason. */
  const guarded = (id, kind, name, fn) => {
    try {
      fn();
    } catch (error) {
      record(id, kind, name, false, { threw: String(error?.message ?? error).split("\n")[0] });
    }
  };
  const guardedAsync = async (id, kind, name, fn) => {
    try {
      await fn();
    } catch (error) {
      record(id, kind, name, false, { threw: String(error?.message ?? error).split("\n")[0] });
    }
  };
  return { tests, record, guarded, guardedAsync };
}

const sha = (value) => crypto.createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex").slice(0, 16);
/** Exact sequence equality: same length, every element `Object.is` (so no tolerance, and -0 ≠ 0). */
const sameSeq = (a, b) => a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
/** Deep, exact equality of clone-able data: numbers by Object.is, Sets and Maps by ordered content, prototypes ignored. */
function deepSame(a, b) {
  if (typeof a === "number" || typeof b === "number") return Object.is(a, b);
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const tag = (v) => Object.prototype.toString.call(v);
  if (tag(a) !== tag(b)) return false;
  if (tag(a) === "[object Set]" || tag(a) === "[object Map]") return deepSame([...a], [...b]);
  if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => deepSame(v, b[i]));
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k, i) => k === kb[i] && deepSame(a[k], b[k]));
}
/** The whole map, Set order included: what "same board" means here. */
const mapPrint = (map) =>
  JSON.stringify({
    grid: map.grid,
    walls: [...map.walls],
    playerStart: map.playerStart,
    guardianStart: map.guardianStart,
    exitPosition: map.exitPosition,
    collectibleStars: map.collectibleStars,
    traps: map.traps,
    chest: map.chest,
  });
const codeOnly = (source) => source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:\\])\/\/.*$/gm, "$1");

// =================================================================================================
// the two sides, and realms of each
// =================================================================================================

/** A side is a tree plus in-memory transforms (mutants only). */
const makeSide = (tree, transforms) => ({ tree, transforms, hasJob: tree.exists(ROUTE_GENERATION_JOB) });
const BASE = makeSide(openSourceTree({ rev: ROUTE_C7A_BASE }));

/** A `Math` whose `random` is the tooling's seeded PRNG, counted: the realm's normal-play stream, observable. */
function countingMath(seed = 99) {
  const math = Object.create(Math);
  let stream = createSeededRandom(seed);
  const state = { calls: 0 };
  math.random = () => {
    state.calls += 1;
    return stream();
  };
  return { math, state, reseed: (next) => (stream = createSeededRandom(next)) };
}

/** A fresh module graph holding only the RNG seam: the cheapest "other realm". */
function seamRealm(side, mathSeed = 99) {
  const m = countingMath(mathSeed);
  const graph = createModuleGraph({ tree: side.tree, transforms: side.transforms, globals: { Math: m.math } });
  return { seam: graph.require(ROUTE_RANDOM_SEAM), math: m };
}

/** A fresh module graph with generation, the defenders and (where the tree has it) the job — all on one seam. */
function rotaRealm(side, mathSeed = 99) {
  const m = countingMath(mathSeed);
  const graph = createModuleGraph({
    tree: side.tree,
    transforms: side.transforms,
    mocks: routeMocks(),
    globals: { console, Math: m.math, Set, Map },
  });
  return {
    graph,
    math: m,
    seam: graph.require(ROUTE_RANDOM_SEAM),
    generation: graph.require(ROUTE_GENERATION),
    defenders: graph.require(ROUTE_DEFENDERS),
    job: side.hasJob ? generationContract(graph, side.tree) : null,
  };
}

/**
 * C7A's contract in one realm: the job's request and accept, and its run — which ROUTE-C7C moved, verbatim, to the
 * runner (route-generation-runner.ts) so the main thread's graph no longer reaches generation. Read off the modules
 * at each call, so an in-memory edit of either is the one that runs.
 */
function generationContract(graph, tree) {
  const job = graph.require(ROUTE_GENERATION_JOB);
  const runner = graph.require(routeGenerationRunnerFile(tree));
  return {
    createRouteGenerationRequest: (...a) => job.createRouteGenerationRequest(...a),
    runRouteGenerationSync: (...a) => runner.runRouteGenerationSync(...a),
    acceptRouteGenerationResult: (...a) => job.acceptRouteGenerationResult(...a),
  };
}

const draws = (seam, n) => {
  const out = new Array(n);
  for (let i = 0; i < n; i += 1) out[i] = seam.routeRandom();
  return out;
};
const skip = (seam, n) => {
  for (let i = 0; i < n; i += 1) seam.routeRandom();
};
const requireApi = (seam) => {
  for (const name of ["getRouteRandomCheckpoint", "restoreRouteRandomCheckpoint"]) {
    if (typeof seam[name] !== "function") throw new Error(`the seam has no ${name}`);
  }
  return seam;
};
const requireJob = (realm) => {
  if (!realm.job) throw new Error(`${ROUTE_GENERATION_JOB} does not exist in this tree`);
  return realm.job;
};

/**
 * The Hunter after a generation, on that board: the Explorer walks its shortest way to the portal, the Hunter answers
 * every step through `chooseGuardianMove` (difficulty policy, ties by `randomItem`, the easy-mode 45% wander, traps as
 * cells defenders may not enter), then the stream's next draws. Every decision is a draw from the shared stream, in
 * the same order on both sides.
 */
function hunterTrace(realm, map, difficulty, steps = 24) {
  const key = (p) => `${p.row},${p.col}`;
  const route = pathBetween(map.playerStart, map.exitPosition, map.walls) ?? [map.playerStart];
  const blocked = new Set(map.traps.map(key));
  let guardian = map.guardianStart;
  const decisions = [];
  for (let i = 0; i < steps; i += 1) {
    const player = route[Math.min(i, route.length - 1)];
    guardian = realm.defenders.chooseGuardianMove(guardian, player, map.exitPosition, map.walls, difficulty, blocked);
    decisions.push(key(guardian));
  }
  const tieBreak = realm.seam.randomItem(["a", "b", "c", "d", "e"]);
  return { decisions, tieBreak, next: draws(realm.seam, 12) };
}

// =================================================================================================
// [structure] and [gate] — the code
// =================================================================================================

const parseTs = (file, source) =>
  ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
function moduleShape(file, source) {
  const sf = parseTs(file, source);
  const out = { exported: [], imports: [] };
  const exported = (node) => (ts.getModifiers?.(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  for (const statement of sf.statements) {
    if (ts.isImportDeclaration(statement)) {
      out.imports.push(statement.moduleSpecifier.text);
      continue;
    }
    if (!exported(statement)) continue;
    if (ts.isVariableStatement(statement)) out.exported.push(...statement.declarationList.declarations.map((d) => d.name.text));
    else if (statement.name) out.exported.push(statement.name.text);
  }
  return out;
}
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
/** Every product source of `tree` (src/**.ts, .tsx), repository-relative. */
function productFiles(tree) {
  if (tree.rev) {
    return execFileSync("git", ["ls-tree", "-r", "--name-only", tree.rev, "src/"], { encoding: "utf8" })
      .split("\n")
      .filter((file) => /\.(ts|tsx)$/.test(file) && tree.exists(file));
  }
  return walk(path.join(tree.root, "src"))
    .map((file) => path.relative(tree.root, file).replace(/\\/g, "/"))
    .filter((file) => tree.exists(file));
}

const SEAM_EXPORTS_BEFORE = ["routeRandom", "randomItem", "armRouteRandomSeed", "clearRouteRandomSeed", "getArmedRouteSeed", "beginSeededGeneration"];
const SEAM_EXPORTS_ADDED = ["RouteRandomCheckpoint", "getRouteRandomCheckpoint", "restoreRouteRandomCheckpoint"];
const JOB_EXPORTS = ["RouteGenerationRequest", "RouteGenerationResult", "createRouteGenerationRequest", "runRouteGenerationSync", "acceptRouteGenerationResult"];
const JOB_IMPORTS = ["@/engine/route-random", "@/games/escape-maze/route-generation", "@/types/game"];
const FORBIDDEN_IMPORT = /react|useEscapeMaze|babylon|game-sounds|scoring|storage|continuation|components\/|GameScreen|RouteStrategyGame|RouteBabylonBoard|\.tsx$|^@\/app\//i;
/** What a synchronous, transport-only module must not contain. */
const ASYNC_OR_HOST = /\basync\b|\bawait\b|\bPromise\b|\.then\s*\(|\bWorker\b|\bpostMessage\b|\bMessagePort\b|\bMessageChannel\b|\bAbortSignal\b|\bAbortController\b|\bsetTimeout\b|\bsetInterval\b|\bwindow\b|\bdocument\b|\bReact\b|\buse[A-Z]\w*\s*\(/;
/** Worker wiring in a product file. */
const WORKER_WIRING = /\bnew\s+(?:Shared)?Worker\s*\(|\bimportScripts\s*\(|\bself\.onmessage\b|\bonmessage\s*=|\bnew\s+URL\s*\([^)]*worker/i;
/** The async generation lifecycle C7B will add — none of it may be in the hook yet. */
const HOOK_ASYNC_LIFECYCLE =
  /\bWorker\b|\bpostMessage\b|\bawait\b|\basync\b|\bPromise\b|\.then\s*\(|\bAbortController\b|\b(?:generation|request)(?:Token|Id)\b|\bisGenerating\b|\bpendingGeneration\b|\bisLoading\b|\bloading\b|\brunRouteGenerationSync\b|\bcreateRouteGenerationRequest\b|\bacceptRouteGenerationResult\b/;

function structureChecks(R, side) {
  const tree = side.tree;
  const seamText = tree.read(ROUTE_RANDOM_SEAM);
  const baseSeam = BASE.tree.read(ROUTE_RANDOM_SEAM);
  const seamShape = moduleShape(ROUTE_RANDOM_SEAM, seamText);

  // S1 — the seam's public surface: every pre-C7A export still exported, plus exactly the checkpoint contract.
  {
    const missingBefore = SEAM_EXPORTS_BEFORE.filter((name) => !seamShape.exported.includes(name));
    const missingAdded = SEAM_EXPORTS_ADDED.filter((name) => !seamShape.exported.includes(name));
    const extra = seamShape.exported.filter((name) => !SEAM_EXPORTS_BEFORE.includes(name) && !SEAM_EXPORTS_ADDED.includes(name));
    R.record("S1", "structure", "SEAM_EXPORTS_CHECKPOINT_CONTRACT", !missingBefore.length && !missingAdded.length && !extra.length && seamShape.imports.length === 0, {
      exported: seamShape.exported,
      missingBefore,
      missingAdded,
      extra,
      imports: seamShape.imports,
    });
  }

  // S2 — the seam's edit is the sanctioned one: with C7A's statements taken out (and the two rewritten put back),
  // route-random.ts is f19f319's byte for byte; the rewritten PRNG is the old closure with `state` renamed to the
  // module's `seededState`, statement for statement; disarming resets that state; the checkpoint's shape is two
  // readonly numbers.
  {
    const asBefore = side.hasJob ? routeRandomBeforeC7A(tree) : null;
    const now = new Map(topLevelStatements(ROUTE_RANDOM_SEAM, seamText).filter(([n]) => n));
    const was = new Map(topLevelStatements(ROUTE_RANDOM_SEAM, baseSeam).filter(([n]) => n));
    const body = (text) => codeOnly(text ?? "").replace(/\s+/g, " ").trim();
    const expectedDraw = body(was.get("createSeededDraw"))
      .replace("function createSeededDraw(seed: number): () => number { let state = seed >>> 0;", "function createSeededDraw(state: number): () => number { seededState = state;")
      .replace(/(?<=return \(\) => \{.*)\bstate\b/g, "seededState");
    const drawIsRenamedClosure = body(now.get("createSeededDraw")) === expectedDraw;
    const expectedClear = body(was.get("clearRouteRandomSeed")).replace("seededDraw = null; }", "seededDraw = null; seededState = 0; }");
    const clearResetsState = body(now.get("clearRouteRandomSeed")) === expectedClear;
    const stateDecl = body(now.get("seededState"));
    const checkpointType = body(now.get("RouteRandomCheckpoint"));
    const pass =
      asBefore === baseSeam &&
      drawIsRenamedClosure &&
      clearResetsState &&
      stateDecl === "let seededState = 0;" &&
      checkpointType === "export interface RouteRandomCheckpoint { readonly armedSeed: number; readonly state: number; }" &&
      body(now.get("routeRandom")) === body(was.get("routeRandom")) &&
      body(now.get("randomItem")) === body(was.get("randomItem"));
    R.record("S2", "structure", "SEAM_EDIT_IS_EXACTLY_THE_SANCTIONED_ONE", pass, {
      seamWithoutC7AIsBaseline: asBefore === baseSeam,
      rewritten: ROUTE_RANDOM_C7A_EDIT.rewritten,
      added: ROUTE_RANDOM_C7A_EDIT.added,
      prngIsTheOldClosureRenamed: drawIsRenamedClosure,
      clearResetsState,
      stateDecl,
      checkpointType,
    });
  }

  // S3 — the job module: its exact exports, its imports (the seam, generation, types — nothing that renders, plays,
  // stores or schedules), no cycle back into it, no async/Worker/host code.
  // ROUTE-C7C split this contract: the run moved, verbatim, to route-generation-runner.ts so that the main thread's
  // graph no longer reaches generation. This is C7A's contract, so it reads the job as it was before C7C's sanctioned
  // edit (`treeBeforeC7C`); route-generation-worker-tests holds that reversal exact and the run moved byte for byte.
  {
    const tree = treeBeforeC7C(side.tree);
    const exists = side.hasJob;
    const text = exists ? tree.read(ROUTE_GENERATION_JOB) : "";
    const shape = moduleShape(ROUTE_GENERATION_JOB, text);
    const closure = exists ? tree.closure(ROUTE_GENERATION_JOB) : [];
    const forbidden = closure.filter((file) => FORBIDDEN_IMPORT.test(file) || file === ROUTE_HOOK);
    const cycle = closure.filter((file) => file !== ROUTE_GENERATION_JOB && tree.closure(file).includes(ROUTE_GENERATION_JOB));
    const asyncHits = (codeOnly(text).match(new RegExp(ASYNC_OR_HOST.source, "g")) ?? []);
    const pass =
      exists &&
      JSON.stringify([...shape.exported].sort()) === JSON.stringify([...JOB_EXPORTS].sort()) &&
      JSON.stringify([...shape.imports].sort()) === JSON.stringify([...JOB_IMPORTS].sort()) &&
      forbidden.length === 0 &&
      cycle.length === 0 &&
      asyncHits.length === 0;
    R.record("S3", "structure", "JOB_CONTRACT_SYNC_AND_BOUNDED", pass, {
      exists,
      exported: shape.exported,
      imports: shape.imports,
      runTimeClosure: closure,
      forbidden,
      cycle,
      asyncOrHost: asyncHits,
    });
  }

  // S4 — the product boundary: nothing in src/ but the seam and the job reads or restores a stream; nothing imports
  // the job yet (C7A leaves it unwired); arming is still the launcher's alone; no UI file knows the checkpoint;
  // the Rota's component and board still do not touch the seam.
  // ROUTE-C7B wired the job (through route-generation-client, which only the hook imports). This is C7A's boundary,
  // so it reads the product as it was before C7B's sanctioned edit (`treeBeforeC7B`); the wired boundary is
  // route-generation-lifecycle-tests' to hold.
  {
    const tree = treeBeforeC7B(side.tree);
    const files = productFiles(tree);
    const code = (file) => codeOnly(tree.read(file));
    const callers = (pattern) => files.filter((file) => pattern.test(code(file)));
    const checkpointUsers = callers(/\b(?:getRouteRandomCheckpoint|restoreRouteRandomCheckpoint)\s*\(/);
    const jobImporters = files.filter((file) => /route-generation-job["']/.test(code(file)));
    const armers = callers(/\barmRouteRandomSeed\s*\(/);
    const uiMentions = files.filter((file) => file.endsWith(".tsx") && /Checkpoint|route-generation-job/.test(code(file)));
    const consumersOnSeam = ["src/games/escape-maze/RouteStrategyGame.tsx", "src/games/escape-maze/RouteBabylonBoard.tsx"].filter((file) =>
      /route-random/.test(code(file)),
    );
    const sortedEq = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());
    const pass =
      sortedEq(checkpointUsers, [ROUTE_RANDOM_SEAM, ROUTE_GENERATION_JOB]) &&
      jobImporters.length === 0 &&
      sortedEq(armers, [ROUTE_RANDOM_SEAM, LAUNCHER]) &&
      uiMentions.length === 0 &&
      consumersOnSeam.length === 0;
    R.record("S4", "structure", "PRODUCT_BOUNDARY_UNWIRED_AND_CONTAINED", pass, { checkpointUsers, jobImporters, armers, uiMentions, consumersOnSeam });
  }
}

function gateChecks(R, side) {
  const tree = side.tree;
  // G1 — no async in the hook: it still calls `generateMaze` directly, exactly twice (the reducer's initialiser and
  // startNewMaze), imports no job, and has none of the lifecycle C7B will bring (Worker, await, Promise, request
  // tokens, pending/loading state).
  // ROUTE-C7B made exactly this asynchronous: its own gate (route-generation-lifecycle-tests) requires the opposite.
  // Here the hook is read through C7B's sanctioned edit, which gives back the synchronous hook only if nothing else
  // in it changed.
  {
    const hook = codeOnly(treeBeforeC7B(tree).read(ROUTE_HOOK));
    const calls = hook.match(/\bgenerateMaze\s*\(/g)?.length ?? 0;
    const lifecycle = hook.match(new RegExp(HOOK_ASYNC_LIFECYCLE.source, "g")) ?? [];
    const importsJob = /route-generation-job/.test(hook);
    const initialiser = /useReducer\(routeStateReducer, null, \(\) => \{\s*const firstMap = generateMaze\(initialDifficulty, normalizedInitialRouteNumber\);/.test(hook);
    const restart = /const nextMap = generateMaze\(nextDifficulty, nextRouteNumber\);/.test(hook);
    R.record("G1", "gate", "HOOK_GENERATES_SYNCHRONOUSLY", calls === 2 && lifecycle.length === 0 && !importsJob && initialiser && restart, {
      generateMazeCalls: calls,
      asyncLifecycle: lifecycle,
      importsJob,
      initialiserGenerates: initialiser,
      startNewMazeGenerates: restart,
    });
  }
  // G2 — no Worker wiring anywhere in the product.
  // ROUTE-C7C wired exactly that Worker (route-generation.worker.ts and its executor) — its own gate
  // (route-generation-worker-tests) requires it. This is C7A's gate, so it reads the product as it was before C7C's
  // sanctioned edit (`treeBeforeC7C`: C7C's four modules absent, the job, the client and the hook reversed).
  {
    const tree = treeBeforeC7C(side.tree);
    const files = productFiles(tree);
    const wired = files.filter((file) => WORKER_WIRING.test(codeOnly(tree.read(file))));
    R.record("G2", "gate", "NO_WORKER_WIRING_IN_PRODUCT", wired.length === 0, { scanned: files.length, wired });
  }
}

// =================================================================================================
// [equivalence] — the tree against f19f319
// =================================================================================================

/** Seeds: edges (0, 2^32−1, sign bit, values `>>> 0` folds), the launcher's witnesses, then a fixed pseudo-random spread. */
function seedList(count) {
  const edges = [0, 1, 2, 0x7fffffff, 0x80000000, 0xfffffffe, 0xffffffff, 2 ** 32, 2 ** 32 + 5, -1, -12345, 1.5, 424242, ...WITNESSES.map((w) => w.seed)];
  const spread = createSeededRandom(0xc7a);
  const out = [...edges];
  while (out.length < count) out.push(Math.floor(spread() * 2 ** 32));
  return out.slice(0, count);
}

/** One stream script: every seam operation, recorded — draws by value, picks by value and Math.random calls. */
function streamScript(seed, plan, { long = false } = {}) {
  const pick = (list) => list[Math.floor(plan() * list.length)];
  const SMALL = [0, 1, 2, 3, 5, 8, 13, 64, 137, 1000];
  const other = Math.floor(plan() * 2 ** 32);
  return [
    ["armed"],
    ["arm", seed],
    ["armed"],
    ["draw", long ? 30000 + Math.floor(plan() * 30000) : pick(SMALL)],
    ["item", 1 + Math.floor(plan() * 12)],
    ["draw", pick(SMALL)],
    ["begin"],
    ["draw", pick(SMALL)],
    ["item", pick([1, 2, 3, 4, 7, 81])],
    ["clear"],
    ["armed"],
    ["math"],
    ["draw", 3],
    ["item", 5],
    ["begin"],
    ["draw", 2],
    ["math"],
    ["arm", other],
    ["draw", pick(SMALL)],
    ["arm", seed],
    ["draw", pick(SMALL)],
    ["arm", seed],
    ["draw", 5],
    ["begin"],
    ["draw", 4],
    ["clear"],
  ];
}
function runScript(realm, script) {
  const { seam, math } = realm;
  const out = [];
  for (const [op, arg] of script) {
    if (op === "arm") seam.armRouteRandomSeed(arg);
    else if (op === "clear") seam.clearRouteRandomSeed();
    else if (op === "begin") seam.beginSeededGeneration();
    else if (op === "draw") for (let i = 0; i < arg; i += 1) out.push(seam.routeRandom());
    else if (op === "item") {
      const before = math.state.calls;
      out.push(seam.randomItem(Array.from({ length: arg }, (_, i) => i)), `m+${math.state.calls - before}`);
    } else if (op === "armed") out.push(`a:${seam.getArmedRouteSeed()}`);
    else if (op === "math") out.push(`m:${math.state.calls}`);
  }
  return out;
}

function equivalenceStreamChecks(R, cur, scale) {
  // E1 — thousands of scripts, one persistent realm per side (state carried from script to script, as a session's is).
  {
    const base = seamRealm(BASE);
    const now = seamRealm(cur);
    const plan = createSeededRandom(7070);
    const seeds = seedList(scale.scripts);
    let values = 0;
    const diffs = [];
    seeds.forEach((seed, i) => {
      const script = streamScript(seed, plan, { long: i % Math.max(1, Math.floor(scale.scripts / scale.longScripts)) === 0 });
      const a = runScript(base, script);
      const b = runScript(now, script);
      values += a.length;
      if (!sameSeq(a, b) && diffs.length < 5) diffs.push({ seed, at: a.findIndex((v, k) => !Object.is(v, b[k])) });
    });
    R.record("E1", "equivalence", "SEEDED_STREAM_SCRIPTS_IDENTICAL", diffs.length === 0, {
      scripts: seeds.length,
      longScripts: scale.longScripts,
      valuesCompared: values,
      operations: "arm · draws (0…60k) · randomItem · beginSeededGeneration · clear · unseeded draws · re-arm",
      diffs,
    });
  }
  // E2 — every seeded draw is the tooling's PRNG (route-lab.mjs#createSeededRandom), the generator baselines were measured with.
  {
    const now = seamRealm(cur);
    const seeds = seedList(scale.oracleSeeds);
    const diffs = [];
    for (const seed of seeds) {
      now.seam.armRouteRandomSeed(seed);
      const reference = createSeededRandom(seed >>> 0);
      for (let i = 0; i < 512; i += 1) {
        if (!Object.is(now.seam.routeRandom(), reference())) {
          diffs.push({ seed, draw: i });
          break;
        }
      }
    }
    now.seam.clearRouteRandomSeed();
    R.record("E2", "equivalence", "SEEDED_DRAWS_ARE_THE_TOOLING_PRNG", diffs.length === 0, { seeds: seeds.length, drawsPerSeed: 512, diffs: diffs.slice(0, 5) });
  }
  // E3 — past the counter's 2^53 edge: the PRNG never wraps its state, so from ~4.9M draws on the double's rounding is
  // part of the sequence. The tree must keep it (a uint32 state would diverge exactly there).
  if (scale.edgeDraws > 0) {
    const results = [];
    for (const seed of [0xffffffff, 0]) {
      const base = seamRealm(BASE);
      const now = seamRealm(cur);
      base.seam.armRouteRandomSeed(seed);
      now.seam.armRouteRandomSeed(seed);
      const hashA = crypto.createHash("sha256");
      const hashB = crypto.createHash("sha256");
      const chunk = 1 << 16;
      const bufA = new Float64Array(chunk);
      const bufB = new Float64Array(chunk);
      let firstDiff = -1;
      for (let done = 0; done < scale.edgeDraws; done += chunk) {
        const n = Math.min(chunk, scale.edgeDraws - done);
        for (let i = 0; i < n; i += 1) {
          bufA[i] = base.seam.routeRandom();
          bufB[i] = now.seam.routeRandom();
          if (firstDiff < 0 && !Object.is(bufA[i], bufB[i])) firstDiff = done + i;
        }
        hashA.update(new Uint8Array(bufA.buffer, 0, n * 8));
        hashB.update(new Uint8Array(bufB.buffer, 0, n * 8));
      }
      const crossesAt = Math.ceil((2 ** 53 - (seed >>> 0)) / INC);
      results.push({ seed, draws: scale.edgeDraws, counterPasses2pow53AtDraw: crossesAt, firstDiff, base: hashA.digest("hex").slice(0, 16), tree: hashB.digest("hex").slice(0, 16) });
    }
    R.record("E3", "equivalence", "STREAM_IDENTICAL_PAST_THE_2POW53_COUNTER", results.every((r) => r.firstDiff < 0 && r.base === r.tree), { results });
  }
}

/** One seeded generation and what follows it, on a realm: the map, the Hunter's decisions, the next draws; then Restart. */
function seededGenerationRecord(realm, seed, route, mode) {
  realm.seam.armRouteRandomSeed(seed);
  const map = realm.generation.generateMaze(mode, route);
  const hunter = hunterTrace(realm, map, mode);
  const again = realm.generation.generateMaze(mode, route);
  const afterRestart = draws(realm.seam, 6);
  realm.seam.clearRouteRandomSeed();
  return { map: mapPrint(map), hunter, restartMap: mapPrint(again), afterRestart };
}

function equivalenceGenerationChecks(R, cur, scale, baseRecords) {
  // E4 — seeded generation and the Hunter after it, R1–R3 × easy/medium/hard: the map, every Hunter decision (policy,
  // tie-breaks, the wander, traps), the next draws, and the board after a Restart — the tree's own `generateMaze`.
  const base = rotaRealm(BASE);
  const now = rotaRealm(cur);
  const diffs = [];
  let compared = 0;
  for (const route of ROUTES) {
    for (const mode of DIFFICULTIES) {
      for (const seed of scale.generationSeeds(route, mode)) {
        const key = `${route}/${mode}/${seed}`;
        const a = baseRecords.get(key) ?? seededGenerationRecord(base, seed, route, mode);
        baseRecords.set(key, a);
        const b = seededGenerationRecord(now, seed, route, mode);
        compared += 1;
        if (!deepSame(a, b) && diffs.length < 5) diffs.push({ key, map: a.map === b.map, hunter: deepSame(a.hunter, b.hunter) });
      }
    }
  }
  R.record("E4", "equivalence", "SEEDED_GENERATION_AND_HUNTER_IDENTICAL", diffs.length === 0 && compared > 0, { generationsCompared: compared, diffs });
}

// --- the real hook, session by session ------------------------------------------------------------

/** Launcher-shaped sessions: arm, mount on the mode (Launch), Start, play, Restart, play, mode change, Start, play. */
function sessionPlan(scale) {
  const plan = [...WITNESSES];
  const spread = createSeededRandom(0x5e55);
  for (const route of ROUTES) {
    for (const mode of DIFFICULTIES) {
      for (let i = 0; i < scale.sessionsPerCell; i += 1) plan.push({ seed: Math.floor(spread() * 2 ** 32), route, mode });
    }
  }
  return plan;
}
const OTHER_MODE = { easy: "hard", medium: "easy", hard: "medium" };

function playSessions(runtime, plan, { armed, counter }) {
  const seam = runtime.routeRandom;
  const out = [];
  for (const session of plan) {
    if (armed) seam.armRouteRandomSeed(session.seed);
    const renders = [];
    const startCount = counter();
    const run = runtime.mount({
      seed: session.seed,
      routeNumber: session.route,
      initialDifficulty: session.mode,
      autoStart: false,
      onRender: (game) => renders.push(sha(observeRoute(game))),
    });
    const boards = { launch: mapDigest(run.state.mazeMap) };
    const play = (budget) => {
      const memo = {};
      for (let i = 0; i < budget && run.state.status === "playing"; i += 1) {
        const action = nextAction(run.state, "win", runtime.API, memo);
        if (!action) break;
        run.act((g) => applyAction(g, action));
      }
    };
    run.act((g) => g.startGame());
    boards.start = mapDigest(run.state.mazeMap);
    play(10);
    run.restart();
    boards.restart = mapDigest(run.state.mazeMap);
    play(10);
    run.changeDifficulty(OTHER_MODE[session.mode]);
    boards.modeChange = mapDigest(run.state.mazeMap);
    run.act((g) => g.startGame());
    boards.secondStart = mapDigest(run.state.mazeMap);
    play(6);
    const next = draws(seam, 8);
    if (armed) seam.clearRouteRandomSeed();
    out.push({ ...session, renders, renderCount: run.renders, boards, next, generations: counter() - startCount, final: sha(observeRoute(run.state)) });
  }
  return out;
}

/** The hook as the product has it, with every `generateMaze` call it makes counted. */
function plainRuntime(side) {
  const runtime = loadRouteRuntime({ rev: side.tree.rev, transforms: side.transforms });
  const generation = runtime.LAB.graph.require(ROUTE_GENERATION);
  const real = generation.generateMaze;
  let count = 0;
  generation.generateMaze = (...a) => {
    count += 1;
    return real(...a);
  };
  return { runtime, counter: () => count };
}

/**
 * ROUTE-C7A — the C7 flow in the real hook, in memory: its two `generateMaze` calls are pointed at an adapter that
 * builds a request in the hook's realm, structured-clones it into a second, long-lived realm (the "Worker"), runs the
 * job there, structured-clones the result back and accepts it in the hook's realm. Nothing is written; the product
 * has no such adapter.
 */
const REMOTE_EDITS = [
  ["const firstMap = generateMaze(initialDifficulty, normalizedInitialRouteNumber);", "const firstMap = (globalThis as any).__c7aGenerate(initialDifficulty, normalizedInitialRouteNumber);"],
  ["const nextMap = generateMaze(nextDifficulty, nextRouteNumber);", "const nextMap = (globalThis as any).__c7aGenerate(nextDifficulty, nextRouteNumber);"],
];
function remoteRuntime(side) {
  // ROUTE-C7B gave this flow a seam of its own: the hook no longer calls `generateMaze`, it asks the generation client,
  // whose executor is the one binding C7C points at a Worker. On such a tree the "Worker" is that executor — the
  // request built by the client in the hook's realm, cloned into the second realm, run by the job there, cloned back
  // and delivered on the sandbox's timer for the client to accept — and no source is edited.
  if (side.tree.exists(ROUTE_GENERATION_CLIENT)) {
    const runtime = loadRouteRuntime({ rev: side.tree.rev, transforms: side.transforms });
    const local = runtime.LAB.graph.require(ROUTE_GENERATION);
    const realLocal = local.generateMaze;
    let localCount = 0;
    local.generateMaze = (...a) => {
      localCount += 1;
      return realLocal(...a);
    };
    const worker = rotaRealm(side, 4242);
    const stats = { remote: 0, seededResults: 0, nullResults: 0 };
    const client = runtime.LAB.graph.require(ROUTE_GENERATION_CLIENT);
    client.routeGenerationExecutor = (command, deliver) => {
      const timer = runtime.LAB.sb.setTimeout(() => {
        stats.remote += 1;
        const result = requireJob(worker).runRouteGenerationSync(structuredClone(command.request));
        if (result.random === null) stats.nullResults += 1;
        else stats.seededResults += 1;
        deliver(structuredClone({ requestId: command.requestId, status: "ready", result }));
      }, 0);
      return () => runtime.LAB.sb.clearTimeout(timer);
    };
    return { runtime, counter: () => stats.remote, localCount: () => localCount, stats, worker };
  }
  const hookEdit = {
    [ROUTE_HOOK]: (source) =>
      REMOTE_EDITS.reduce((text, [anchor, replacement]) => {
        if (text.split(anchor).length !== 2) throw new Error(`remote adapter: anchor not found exactly once: ${anchor}`);
        return text.replace(anchor, replacement);
      }, source),
  };
  const runtime = loadRouteRuntime({ rev: side.tree.rev, transforms: [side.transforms, hookEdit] });
  const local = runtime.LAB.graph.require(ROUTE_GENERATION);
  const realLocal = local.generateMaze;
  let localCount = 0;
  local.generateMaze = (...a) => {
    localCount += 1;
    return realLocal(...a);
  };
  const job = runtime.LAB.graph.require(ROUTE_GENERATION_JOB);
  const worker = rotaRealm(side, 4242);
  const stats = { remote: 0, seededResults: 0, nullResults: 0 };
  runtime.LAB.sb.__c7aGenerate = (difficulty, routeNumber) => {
    stats.remote += 1;
    const request = job.createRouteGenerationRequest(difficulty, routeNumber);
    const result = requireJob(worker).runRouteGenerationSync(structuredClone(request));
    if (result.random === null) stats.nullResults += 1;
    else stats.seededResults += 1;
    return job.acceptRouteGenerationResult(request, structuredClone(result));
  };
  return { runtime, counter: () => stats.remote, localCount: () => localCount, stats, worker };
}

function equivalenceSessionChecks(R, cur, scale, cache) {
  const plan = sessionPlan(scale);
  cache.baseSessions ??= (() => {
    const base = plainRuntime(BASE);
    return { armed: playSessions(base.runtime, plan, { armed: true, counter: base.counter }), unseeded: playSessions(base.runtime, plan, { armed: false, counter: base.counter }) };
  })();
  const now = plainRuntime(cur);
  const armed = playSessions(now.runtime, plan, { armed: true, counter: now.counter });
  const unseeded = playSessions(now.runtime, plan, { armed: false, counter: now.counter });
  const diff = (a, b) => a.map((s, i) => (deepSame(s, b[i]) ? null : { seed: s.seed, route: s.route, mode: s.mode })).filter(Boolean);
  const armedDiffs = diff(cache.baseSessions.armed, armed);
  const unseededDiffs = diff(cache.baseSessions.unseeded, unseeded);
  // Same board on Launch, Start and Restart for one seed/mode/Route — the launcher's promise — on both sides.
  const sameBoard = armed.every((s) => s.boards.launch === s.boards.start && s.boards.start === s.boards.restart && s.boards.modeChange === s.boards.secondStart);
  R.record("E5", "equivalence", "REAL_HOOK_SESSIONS_IDENTICAL", armedDiffs.length === 0 && unseededDiffs.length === 0 && sameBoard, {
    sessions: plan.length,
    rendersCompared: armed.reduce((n, s) => n + s.renderCount, 0) + unseeded.reduce((n, s) => n + s.renderCount, 0),
    generations: { armed: armed.reduce((n, s) => n + s.generations, 0), unseeded: unseeded.reduce((n, s) => n + s.generations, 0) },
    armedDiffs: armedDiffs.slice(0, 5),
    unseededDiffs: unseededDiffs.slice(0, 5),
    sameBoardOnLaunchStartRestart: sameBoard,
  });
}

async function equivalenceReactChecks(R, cur) {
  // E6 — the real React: development Strict Mode (the initialiser still runs twice: two mount generations), plain
  // development and production. Every commit, body call, draw, generation, effect and the stream after, per scenario.
  const scenarios = [
    { name: "r1-easy-win", seed: 101, routeNumber: 1, initialDifficulty: "easy", steps: [["play", 40, { policy: "win" }]] },
    { name: "r2-medium-restart", seed: 202, routeNumber: 2, initialDifficulty: "medium", steps: [["play", 8, { policy: "win" }], ["restart"], ["play", 8, { policy: "traps" }]] },
    { name: "r3-hard-lose", seed: 303, routeNumber: 3, initialDifficulty: "hard", steps: [["play", 40, { policy: "lose" }]] },
    { name: "r1-mode-change", seed: 404, routeNumber: 1, changeDifficulty: "hard", steps: [["play", 6, { policy: "pickaxe" }]] },
  ];
  const configs = [
    { nodeEnv: "development", strict: true },
    { nodeEnv: "development", strict: false },
    { nodeEnv: "production", strict: false },
  ];
  const rows = [];
  for (const config of configs) {
    const [a, b] = await Promise.all([
      runInRealReact({ rev: BASE.tree.rev, ...config, regime: "discrete", scenarios }),
      runInRealReact({ rev: cur.tree.rev, ...config, regime: "discrete", scenarios }),
    ]);
    rows.push({
      ...config,
      identical: deepSame(a.results, b.results),
      mountGenerations: b.results.map((r) => r.steps[0].generations),
      generations: b.results.map((r) => r.generations),
      consoleErrors: b.consoleErrors?.length ?? 0,
    });
  }
  const strictTwice = rows[0].mountGenerations.every((n) => n === 2) && rows[1].mountGenerations.every((n) => n === 1);
  R.record("E6", "equivalence", "REAL_REACT_STRICT_DEV_PROD_IDENTICAL", rows.every((r) => r.identical && r.consoleErrors === 0) && strictTwice, {
    rows,
    strictModeStillGeneratesTwiceAtMount: strictTwice,
  });
}

// =================================================================================================
// [unseeded] — normal play
// =================================================================================================

function unseededChecks(R, cur) {
  // U1 — `routeRandom()` is one Math.random call returning its value; `randomItem` one draw; on both sides.
  {
    const rows = [];
    for (const side of [BASE, cur]) {
      const realm = seamRealm(side, 31337);
      const reference = createSeededRandom(31337);
      let valuesMatch = true;
      let callsMatch = true;
      for (const n of [1, 2, 3, 10, 100, 1000, 10000]) {
        const before = realm.math.state.calls;
        for (let i = 0; i < n; i += 1) if (!Object.is(realm.seam.routeRandom(), reference())) valuesMatch = false;
        if (realm.math.state.calls - before !== n) callsMatch = false;
      }
      let itemOneDraw = true;
      for (const length of [1, 2, 3, 5, 9, 81, 1000]) {
        const before = realm.math.state.calls;
        const value = reference();
        const items = Array.from({ length }, (_, i) => i);
        if (realm.seam.randomItem(items) !== items[Math.floor(value * length)] || realm.math.state.calls - before !== 1) itemOneDraw = false;
      }
      rows.push({ side: side === BASE ? "f19f319" : "tree", valuesMatch, callsMatch, itemOneDraw, armed: realm.seam.getArmedRouteSeed() });
    }
    R.record("U1", "unseeded", "ROUTE_RANDOM_IS_ONE_MATH_RANDOM", rows.every((r) => r.valuesMatch && r.callsMatch && r.itemOneDraw && r.armed === null), { rows });
  }
  // U2 — unseeded generation: the same Math.random calls in the same order (same deterministic Math stream on both
  // sides, so the same count and the same maps), R1–R3 × modes.
  {
    const base = rotaRealm(BASE, 5150);
    const now = rotaRealm(cur, 5150);
    const rows = [];
    for (const route of ROUTES) {
      for (const mode of DIFFICULTIES) {
        for (let k = 0; k < 2; k += 1) {
          const ca = base.math.state.calls;
          const a = mapPrint(base.generation.generateMaze(mode, route));
          const cb = now.math.state.calls;
          const b = mapPrint(now.generation.generateMaze(mode, route));
          rows.push({ route, mode, calls: [base.math.state.calls - ca, now.math.state.calls - cb], same: a === b });
        }
      }
    }
    R.record("U2", "unseeded", "UNSEEDED_GENERATION_SAME_CALLS", rows.every((r) => r.same && r.calls[0] === r.calls[1] && r.calls[0] > 0), {
      generations: rows.length,
      mathCallsPerGeneration: rows.map((r) => r.calls[1]),
      diffs: rows.filter((r) => !r.same || r.calls[0] !== r.calls[1]),
    });
  }
}

function unseededCheckpointChecks(R, cur) {
  // U3 — there is no checkpoint of normal play: null before arming and after clearing; reading one draws nothing.
  R.guarded("U3", "unseeded", "NO_CHECKPOINT_OF_NORMAL_PLAY", () => {
    const realm = seamRealm(cur, 77);
    const seam = requireApi(realm.seam);
    const before = seam.getRouteRandomCheckpoint();
    seam.armRouteRandomSeed(9);
    skip(seam, 3);
    const calls = realm.math.state.calls;
    const armedCp = seam.getRouteRandomCheckpoint();
    seam.clearRouteRandomSeed();
    const after = seam.getRouteRandomCheckpoint();
    const unseededDraw = realm.math.state.calls;
    seam.routeRandom();
    const pass = before === null && after === null && armedCp !== null && realm.math.state.calls - unseededDraw === 1 && calls === 0;
    R.record("U3", "unseeded", "NO_CHECKPOINT_OF_NORMAL_PLAY", pass, { beforeArming: before, afterClear: after, mathCallsWhileSeeded: calls, oneMathCallAfterClear: realm.math.state.calls - unseededDraw === 1 });
  });
  // U4 — the job in normal play: the request carries no stream, the generating realm forgets any earlier session's
  // seed and draws from its own Math.random, the result carries no stream, and accepting it touches nothing in the
  // requesting realm — no Math.random call, no seed.
  R.guarded("U4", "unseeded", "JOB_IN_NORMAL_PLAY_CARRIES_NO_STREAM", () => {
    const main = rotaRealm(cur, 1);
    const worker = rotaRealm(cur, 2);
    requireJob(main);
    // The worker realm served a seeded session before this one.
    worker.seam.armRouteRandomSeed(12412046);
    const request = main.job.createRouteGenerationRequest("medium", 2);
    const workerCallsBefore = worker.math.state.calls;
    const result = requireJob(worker).runRouteGenerationSync(structuredClone(request));
    const workerCalls = worker.math.state.calls - workerCallsBefore;
    const mainCallsBefore = main.math.state.calls;
    const map = main.job.acceptRouteGenerationResult(request, structuredClone(result));
    const pass =
      request.random === null &&
      result.random === null &&
      worker.seam.getArmedRouteSeed() === null &&
      workerCalls > 0 &&
      main.math.state.calls === mainCallsBefore &&
      main.seam.getArmedRouteSeed() === null &&
      map.walls instanceof Set;
    R.record("U4", "unseeded", "JOB_IN_NORMAL_PLAY_CARRIES_NO_STREAM", pass, {
      requestRandom: request.random,
      resultRandom: result.random,
      workerSeedAfter: worker.seam.getArmedRouteSeed(),
      workerMathCalls: workerCalls,
      mainMathCallsOnAccept: main.math.state.calls - mainCallsBefore,
    });
  });
}

// =================================================================================================
// [handoff] — checkpoint, restore, and the cross-realm flow
// =================================================================================================

const N_LIST = [0, 1, 2, 5, 17, 137, 1000, 2500, 6000, 9000, 12000, 20000, 31000, 35000, 47000, 60000];
const M_LIST = [1, 8, 64, 1000];

function handoffChecks(R, cur, scale) {
  // H1 — Realm A: arm, N draws, checkpoint. Realm B (a fresh module graph every few cases, otherwise a long-lived one
  // that served other seeds): restore the structured-cloned checkpoint, M draws. Both equal A continuing and f19f319
  // drawing N + M from the seed; B's checkpoint afterwards equals A's; the state is seed + N·increment.
  R.guarded("H1", "handoff", "CHECKPOINT_RESTORES_EXACTLY_ACROSS_REALMS", () => {
    const A = seamRealm(cur);
    const longB = seamRealm(cur);
    const base = seamRealm(BASE);
    requireApi(A.seam);
    const seeds = seedList(scale.handoffSeeds);
    const diffs = [];
    let fresh = 0;
    let drawn = 0;
    let largest = 0;
    seeds.forEach((seed, i) => {
      const N = N_LIST[i % N_LIST.length];
      const M = M_LIST[i % M_LIST.length];
      A.seam.armRouteRandomSeed(seed);
      skip(A.seam, N);
      const cp = A.seam.getRouteRandomCheckpoint();
      const wire = structuredClone(cp);
      const B = i % scale.freshEvery === 0 ? ((fresh += 1), requireApi(seamRealm(cur, 1000 + i).seam)) : longB.seam;
      B.restoreRouteRandomCheckpoint(wire);
      const seqB = draws(B, M);
      const seqA = draws(A.seam, M);
      base.seam.armRouteRandomSeed(seed);
      skip(base.seam, N);
      const seqBase = draws(base.seam, M);
      drawn += 2 * N + 3 * M;
      largest = Math.max(largest, N);
      const ok =
        sameSeq(seqA, seqB) &&
        sameSeq(seqA, seqBase) &&
        deepSame(A.seam.getRouteRandomCheckpoint(), B.getRouteRandomCheckpoint()) &&
        B.getArmedRouteSeed() === seed >>> 0 &&
        cp.armedSeed === seed >>> 0 &&
        cp.state === (seed >>> 0) + N * INC;
      if (!ok && diffs.length < 5) diffs.push({ seed, N, M });
    });
    R.record("H1", "handoff", "CHECKPOINT_RESTORES_EXACTLY_ACROSS_REALMS", diffs.length === 0, {
      cases: seeds.length,
      freshModuleGraphs: fresh,
      largestN: largest,
      drawsCompared: drawn,
      N: N_LIST,
      M: M_LIST,
      diffs,
    });
  });
  // H2 — restoring many times: the same checkpoint into several realms (and twice into one), and a chain A → B → C,
  // each continuing exactly; a checkpoint is a snapshot (mutating it changes nothing) and reading it draws nothing.
  R.guarded("H2", "handoff", "REPEATED_AND_CHAINED_RESTORES", () => {
    const A = requireApi(seamRealm(cur).seam);
    const B = requireApi(seamRealm(cur).seam);
    const C = requireApi(seamRealm(cur).seam);
    const failures = [];
    for (const [i, seed] of seedList(scale.repeatSeeds).entries()) {
      A.armRouteRandomSeed(seed);
      skip(A, 50 + (i % 900));
      const cp = A.getRouteRandomCheckpoint();
      const reread = A.getRouteRandomCheckpoint();
      const expected = draws(A, 40);
      B.restoreRouteRandomCheckpoint(structuredClone(cp));
      const once = draws(B, 40);
      B.restoreRouteRandomCheckpoint(structuredClone(cp));
      const twice = draws(B, 40);
      cp.state += INC; // the caller's copy; the stream never reads it back
      C.restoreRouteRandomCheckpoint(structuredClone(reread));
      const first = draws(C, 15);
      B.restoreRouteRandomCheckpoint(structuredClone(C.getRouteRandomCheckpoint()));
      const chained = [...first, ...draws(B, 25)];
      if (!sameSeq(expected, once) || !sameSeq(expected, twice) || !sameSeq(expected, chained) || !deepSame(reread, { armedSeed: seed >>> 0, state: reread.state })) {
        failures.push(seed);
      }
    }
    R.record("H2", "handoff", "REPEATED_AND_CHAINED_RESTORES", failures.length === 0, { seeds: scale.repeatSeeds, failures: failures.slice(0, 5) });
  });
  // H3 — a restore moves the stream, never what a generation starts from: afterwards the armed seed is the
  // checkpoint's, `beginSeededGeneration()` restarts at it (the fresh-arm sequence of f19f319), re-arming restarts,
  // and a restore replaces whatever the realm had armed (or makes an unseeded realm seeded — the Worker's case).
  R.guarded("H3", "handoff", "RESTORE_KEEPS_BEGIN_AT_THE_ARMED_SEED", () => {
    const base = seamRealm(BASE);
    const now = requireApi(seamRealm(cur).seam);
    const failures = [];
    for (const [i, seed] of seedList(scale.repeatSeeds).entries()) {
      base.seam.armRouteRandomSeed(seed);
      const fresh = draws(base.seam, 30);
      const source = requireApi(seamRealm(cur).seam);
      source.armRouteRandomSeed(seed);
      skip(source, 1 + (i % 4000));
      if (i % 3 === 0) now.armRouteRandomSeed(seed ^ 0x5a5a5a5a);
      else if (i % 3 === 1) now.clearRouteRandomSeed();
      now.restoreRouteRandomCheckpoint(structuredClone(source.getRouteRandomCheckpoint()));
      const armedOk = now.getArmedRouteSeed() === seed >>> 0;
      skip(now, i % 17);
      now.beginSeededGeneration();
      const afterBegin = draws(now, 30);
      skip(now, 5);
      now.armRouteRandomSeed(seed);
      const afterArm = draws(now, 30);
      if (!armedOk || !sameSeq(fresh, afterBegin) || !sameSeq(fresh, afterArm)) failures.push(seed);
    }
    now.clearRouteRandomSeed();
    R.record("H3", "handoff", "RESTORE_KEEPS_BEGIN_AT_THE_ARMED_SEED", failures.length === 0, { seeds: scale.repeatSeeds, failures: failures.slice(0, 5) });
  });
  // H4 — clear after a restore erases seed, stream and checkpoint: null checkpoint, null seed, one Math.random per draw.
  R.guarded("H4", "handoff", "CLEAR_AFTER_RESTORE_IS_NORMAL_PLAY", () => {
    const realm = seamRealm(cur, 4);
    const seam = requireApi(realm.seam);
    seam.restoreRouteRandomCheckpoint({ armedSeed: 77, state: 77 + 500 * INC });
    skip(seam, 10);
    seam.clearRouteRandomSeed();
    const calls = realm.math.state.calls;
    const values = draws(seam, 25);
    const reference = createSeededRandom(4);
    const expected = Array.from({ length: 25 }, () => reference());
    const pass = seam.getRouteRandomCheckpoint() === null && seam.getArmedRouteSeed() === null && realm.math.state.calls - calls === 25 && sameSeq(values, expected);
    R.record("H4", "handoff", "CLEAR_AFTER_RESTORE_IS_NORMAL_PLAY", pass, { checkpoint: seam.getRouteRandomCheckpoint(), armed: seam.getArmedRouteSeed(), mathCalls: realm.math.state.calls - calls });
  });
  // H5 — a malformed checkpoint is rejected before anything changes: the stream continues as if nothing was tried.
  R.guarded("H5", "handoff", "MALFORMED_CHECKPOINT_CHANGES_NOTHING", () => {
    const realm = seamRealm(cur);
    const seam = requireApi(realm.seam);
    const bad = [
      null, undefined, {}, { armedSeed: 1 }, { state: 1 }, { armedSeed: -1, state: 5 }, { armedSeed: 2 ** 32, state: 2 ** 32 },
      { armedSeed: 1.5, state: 3 }, { armedSeed: 5, state: 4 }, { armedSeed: 5, state: NaN }, { armedSeed: 5, state: Infinity },
      { armedSeed: "5", state: 9 }, { armedSeed: 5, state: 5.5 }, { armedSeed: 5, state: "9" }, 42,
    ];
    const reference = seamRealm(cur).seam;
    seam.armRouteRandomSeed(2024);
    reference.armRouteRandomSeed(2024);
    skip(seam, 10);
    skip(reference, 10);
    const accepted = [];
    for (const checkpoint of bad) {
      try {
        seam.restoreRouteRandomCheckpoint(checkpoint);
        accepted.push(JSON.stringify(checkpoint) ?? String(checkpoint));
      } catch {
        // rejected, as it must be
      }
    }
    const pass = accepted.length === 0 && sameSeq(draws(seam, 50), draws(reference, 50)) && seam.getArmedRouteSeed() === 2024;
    R.record("H5", "handoff", "MALFORMED_CHECKPOINT_CHANGES_NOTHING", pass, { tried: bad.length, accepted });
  });
}

/**
 * H6 — the product proof. f19f319: arm → generateMaze → Hunter. The tree, across realms: the requesting realm arms
 * (as the launcher does) and builds a request; it is structured-cloned into the generating realm (long-lived, or fresh
 * every few cases), which runs the job; the result is structured-cloned back, accepted, and the Hunter plays on the
 * cloned map with the restored stream. Map, every Hunter decision, the tie-break, the next draws, the Restart board.
 * Also: the job run in ONE realm is `generateMaze`, and the generating realm's checkpoint is the one accepted.
 */
function generationHandoffChecks(R, cur, scale, baseRecords) {
  R.guarded("H6", "handoff", "GENERATION_TO_HUNTER_ACROSS_REALMS", () => {
    const base = rotaRealm(BASE);
    const main = rotaRealm(cur);
    let worker = rotaRealm(cur, 8);
    const single = rotaRealm(cur);
    requireJob(main);
    const diffs = [];
    const generationDraws = [];
    let compared = 0;
    let freshWorkers = 0;
    for (const route of ROUTES) {
      for (const mode of DIFFICULTIES) {
        for (const [i, seed] of scale.generationSeeds(route, mode).entries()) {
          const key = `${route}/${mode}/${seed}`;
          const expected = baseRecords.get(key) ?? seededGenerationRecord(base, seed, route, mode);
          baseRecords.set(key, expected);
          if (i % scale.freshWorkerEvery === 0) {
            worker = rotaRealm(cur, 8 + i);
            freshWorkers += 1;
          }
          main.seam.armRouteRandomSeed(seed);
          const generate = () => {
            const request = main.job.createRouteGenerationRequest(mode, route);
            const result = requireJob(worker).runRouteGenerationSync(structuredClone(request));
            const wire = structuredClone(result);
            const map = main.job.acceptRouteGenerationResult(request, wire);
            return { map, request, result: wire };
          };
          const first = generate();
          const workerCp = worker.seam.getRouteRandomCheckpoint();
          const mainCp = main.seam.getRouteRandomCheckpoint();
          generationDraws.push((first.result.random.state - first.result.random.armedSeed) / INC);
          const hunter = hunterTrace(main, first.map, mode);
          const again = generate();
          const afterRestart = draws(main.seam, 6);
          main.seam.clearRouteRandomSeed();
          const got = { map: mapPrint(first.map), hunter, restartMap: mapPrint(again.map), afterRestart };

          // The same job, run where it was requested: exactly generateMaze.
          single.seam.armRouteRandomSeed(seed);
          const request = single.job.createRouteGenerationRequest(mode, route);
          const inRealm = single.job.acceptRouteGenerationResult(request, single.job.runRouteGenerationSync(request));
          const singleRecord = { map: mapPrint(inRealm), hunter: hunterTrace(single, inRealm, mode) };
          single.seam.clearRouteRandomSeed();

          compared += 1;
          const ok =
            deepSame(expected, got) &&
            deepSame(workerCp, mainCp) &&
            first.request.random.armedSeed === seed >>> 0 &&
            first.map.walls instanceof Set &&
            singleRecord.map === expected.map &&
            deepSame(singleRecord.hunter, expected.hunter);
          if (!ok && diffs.length < 5) {
            diffs.push({ key, map: expected.map === got.map, hunter: deepSame(expected.hunter, got.hunter), restart: expected.restartMap === got.restartMap, checkpoints: deepSame(workerCp, mainCp), inRealm: singleRecord.map === expected.map });
          }
        }
      }
    }
    generationDraws.sort((a, b) => a - b);
    R.record("H6", "handoff", "GENERATION_TO_HUNTER_ACROSS_REALMS", diffs.length === 0 && compared > 0, {
      generations: compared,
      freshGeneratingRealms: freshWorkers,
      drawsPerGeneration: { min: generationDraws[0], p50: generationDraws[Math.floor(generationDraws.length / 2)], max: generationDraws.at(-1) },
      compared: "map · 24 Hunter decisions (policy, ties, wander, traps) · tie-break · 12 next draws · Restart board · 6 draws after",
      diffs,
    });
  });
  // H7 — same board on Restart after a handoff: once the stream was restored from a checkpoint and the Hunter drew
  // from it, the next generation still restarts at the armed seed — in the requesting realm and in the generating one.
  R.guarded("H7", "handoff", "SAME_BOARD_ON_RESTART_AFTER_RESTORE", () => {
    const main = rotaRealm(cur);
    const worker = rotaRealm(cur, 3);
    requireJob(main);
    const failures = [];
    for (const { seed, route, mode } of WITNESSES) {
      main.seam.armRouteRandomSeed(seed);
      const launch = main.job.createRouteGenerationRequest(mode, route);
      const first = main.job.acceptRouteGenerationResult(launch, structuredClone(requireJob(worker).runRouteGenerationSync(structuredClone(launch))));
      hunterTrace(main, first, mode, 40);
      const local = main.generation.generateMaze(mode, route);
      skip(main.seam, 777);
      const request = main.job.createRouteGenerationRequest(mode, route);
      const remote = main.job.acceptRouteGenerationResult(request, structuredClone(worker.job.runRouteGenerationSync(structuredClone(request))));
      main.seam.clearRouteRandomSeed();
      if (mapPrint(first) !== mapPrint(local) || mapPrint(first) !== mapPrint(remote)) failures.push({ seed, route, mode });
    }
    R.record("H7", "handoff", "SAME_BOARD_ON_RESTART_AFTER_RESTORE", failures.length === 0, { witnesses: WITNESSES.length, failures });
  });
  // H8 — results that do not answer their request are refused, and refusing changes nothing.
  R.guarded("H8", "handoff", "MISMATCHED_RESULTS_REFUSED", () => {
    const main = rotaRealm(cur);
    const worker = rotaRealm(cur, 9);
    requireJob(main);
    main.seam.armRouteRandomSeed(12412046);
    const seeded = main.job.createRouteGenerationRequest("hard", 1);
    const good = worker.job.runRouteGenerationSync(structuredClone(seeded));
    const before = main.seam.getRouteRandomCheckpoint();
    const refused = [
      ["seeded request, no stream", seeded, { map: good.map, random: null }],
      ["seeded request, stream forgotten", seeded, { map: good.map }],
      ["seeded request, another seed's stream", seeded, { map: good.map, random: { armedSeed: 1, state: 1 + 3 * INC } }],
      ["normal-play request, a stream", { ...seeded, random: null }, good],
    ].filter(([, request, result]) => {
      try {
        main.job.acceptRouteGenerationResult(request, result);
        return false;
      } catch {
        return true;
      }
    });
    const unchanged = deepSame(before, main.seam.getRouteRandomCheckpoint());
    main.seam.clearRouteRandomSeed();
    R.record("H8", "handoff", "MISMATCHED_RESULTS_REFUSED", refused.length === 4 && unchanged, { refused: refused.map(([label]) => label), streamUnchanged: unchanged });
  });
}

function hookHandoffChecks(R, cur, scale, cache) {
  // H9 — the C7 flow inside the REAL hook (in memory): every generation goes request → clone → generating realm →
  // clone → accept; the sessions are f19f319's render for render, the hook's realm generates nothing itself, the
  // generation count is f19f319's, and in normal play no stream ever travels.
  R.guarded("H9", "handoff", "REAL_HOOK_THROUGH_A_SECOND_REALM", () => {
    if (!cur.hasJob) throw new Error(`${ROUTE_GENERATION_JOB} does not exist in this tree`);
    const plan = sessionPlan(scale);
    cache.baseSessions ??= (() => {
      const base = plainRuntime(BASE);
      return { armed: playSessions(base.runtime, plan, { armed: true, counter: base.counter }), unseeded: playSessions(base.runtime, plan, { armed: false, counter: base.counter }) };
    })();
    const remote = remoteRuntime(cur);
    const armed = playSessions(remote.runtime, plan, { armed: true, counter: remote.counter });
    const seededResults = remote.stats.seededResults;
    const unseeded = playSessions(remote.runtime, plan, { armed: false, counter: remote.counter });
    const diffs = cache.baseSessions.armed.map((s, i) => (deepSame(s, armed[i]) ? null : { seed: s.seed, route: s.route, mode: s.mode })).filter(Boolean);
    const unseededGenerationsMatch = cache.baseSessions.unseeded.every((s, i) => s.generations === unseeded[i].generations);
    const pass =
      diffs.length === 0 &&
      remote.localCount() === 0 &&
      seededResults === armed.reduce((n, s) => n + s.generations, 0) &&
      remote.stats.nullResults === unseeded.reduce((n, s) => n + s.generations, 0) &&
      unseededGenerationsMatch &&
      remote.worker.seam.getArmedRouteSeed() === null;
    R.record("H9", "handoff", "REAL_HOOK_THROUGH_A_SECOND_REALM", pass, {
      sessions: plan.length,
      remoteGenerations: remote.stats.remote,
      localGenerations: remote.localCount(),
      seededResults,
      nullResults: remote.stats.nullResults,
      armedDiffs: diffs.slice(0, 5),
      unseededGenerationCountsMatch: unseededGenerationsMatch,
    });
  });
}

// =================================================================================================
// [clone] — structured clone, a real Worker thread, Chromium
// =================================================================================================

function cloneChecks(R, cur) {
  // C1 — the checkpoint: own keys exactly armedSeed/state, both numbers; structuredClone and JSON give it back exactly,
  // including past 2^53.
  R.guarded("C1", "clone", "CHECKPOINT_IS_PLAIN_CLONEABLE_DATA", () => {
    const seam = requireApi(seamRealm(cur).seam);
    const rows = [];
    for (const [seed, n] of [[0, 0], [1, 1], [0xffffffff, 9000], [12412046, 35000]]) {
      seam.armRouteRandomSeed(seed);
      skip(seam, n);
      rows.push(seam.getRouteRandomCheckpoint());
    }
    rows.push({ armedSeed: 0xffffffff, state: 0xffffffff + 4_950_000 * INC }); // a position past the 2^53 edge, as data
    const shapeOk = rows.slice(0, 4).every((cp) => JSON.stringify(Object.keys(cp)) === '["armedSeed","state"]' && typeof cp.armedSeed === "number" && typeof cp.state === "number");
    const cloneOk = rows.every((cp) => deepSame(structuredClone(cp), cp) && deepSame(JSON.parse(JSON.stringify(cp)), cp));
    seam.clearRouteRandomSeed();
    R.record("C1", "clone", "CHECKPOINT_IS_PLAIN_CLONEABLE_DATA", shapeOk && cloneOk, { samples: rows, shapeOk, cloneAndJsonRoundTrip: cloneOk });
  });
  // C2 — request and result: structuredClone gives them back deep-equal; the map's walls stay a Set with the same
  // members in the same order; the request is JSON-safe too. (structuredClone throws on a function: none travels.)
  R.guarded("C2", "clone", "REQUEST_AND_RESULT_STRUCTURED_CLONE", () => {
    const main = rotaRealm(cur);
    requireJob(main);
    const rows = [];
    for (const armed of [true, false]) {
      if (armed) main.seam.armRouteRandomSeed(12432045);
      const request = main.job.createRouteGenerationRequest("hard", 3);
      const result = main.job.runRouteGenerationSync(request);
      const requestClone = structuredClone(request);
      const resultClone = structuredClone(result);
      rows.push({
        armed,
        requestKeys: Object.keys(request),
        resultKeys: Object.keys(result),
        requestClone: deepSame(requestClone, request),
        requestJson: deepSame(JSON.parse(JSON.stringify(request)), request),
        resultClone: deepSame(resultClone, result),
        wallsStayASet: resultClone.map.walls instanceof Set && deepSame([...resultClone.map.walls], [...result.map.walls]),
      });
      main.seam.clearRouteRandomSeed();
    }
    const pass = rows.every(
      (r) =>
        r.requestClone && r.requestJson && r.resultClone && r.wallsStayASet &&
        JSON.stringify(r.requestKeys) === '["difficulty","routeNumber","random"]' && JSON.stringify(r.resultKeys) === '["map","random"]',
    );
    R.record("C2", "clone", "REQUEST_AND_RESULT_STRUCTURED_CLONE", pass, { rows });
  });
}

/** The job and its closure, as one script of the real modules (route-module-loader#emitModuleBundle). */
function jobBundle(side) {
  // ROUTE-C7C: the generating realm's half — `runRouteGenerationSync` — is the runner's (the job's before C7C).
  return emitModuleBundle({ tree: side.tree, transforms: side.transforms, entry: routeGenerationRunnerFile(side.tree) });
}
const WORKER_SOURCE = `
const { parentPort, workerData } = require("node:worker_threads");
const bundle = (0, eval)(workerData.bundle)();
const job = bundle.exports;
const seam = bundle.require(${JSON.stringify(ROUTE_RANDOM_SEAM)});
parentPort.on("message", (request) => {
  try {
    const result = job.runRouteGenerationSync(request);
    parentPort.postMessage({ result, armedAfter: seam.getArmedRouteSeed() });
  } catch (error) {
    parentPort.postMessage({ error: String(error && error.message || error) });
  }
});
`;

async function workerThreadChecks(R, cur, scale, baseRecords) {
  // C3 — a real node:worker_threads Worker (another isolate, real postMessage structured clone) runs the job from a
  // bundle of the real modules; the main realm accepts and the Hunter continues exactly as in f19f319. A normal-play
  // request after seeded ones leaves the Worker unseeded and carries no stream back.
  await R.guardedAsync("C3", "clone", "NODE_WORKER_THREAD_HANDOFF", async () => {
    if (!cur.hasJob) throw new Error(`${ROUTE_GENERATION_JOB} does not exist in this tree`);
    const worker = new Worker(WORKER_SOURCE, { eval: true, workerData: { bundle: jobBundle(cur) } });
    let pending = null;
    worker.on("message", (message) => {
      const settle = pending;
      pending = null;
      if (message.error) settle?.reject(new Error(message.error));
      else settle?.resolve(message);
    });
    worker.on("error", (error) => pending?.reject(error));
    const ask = (request) =>
      new Promise((resolve, reject) => {
        pending = { resolve, reject };
        worker.postMessage(request);
      });
    const base = rotaRealm(BASE);
    const main = rotaRealm(cur);
    const diffs = [];
    let compared = 0;
    try {
      for (const route of ROUTES) {
        for (const mode of DIFFICULTIES) {
          for (const seed of scale.generationSeeds(route, mode).slice(0, scale.workerSeedsPerCell)) {
            const key = `${route}/${mode}/${seed}`;
            const expected = baseRecords.get(key) ?? seededGenerationRecord(base, seed, route, mode);
            baseRecords.set(key, expected);
            main.seam.armRouteRandomSeed(seed);
            const request = main.job.createRouteGenerationRequest(mode, route);
            const { result } = await ask(request);
            const map = main.job.acceptRouteGenerationResult(request, result);
            const hunter = hunterTrace(main, map, mode);
            const restartRequest = main.job.createRouteGenerationRequest(mode, route);
            const again = main.job.acceptRouteGenerationResult(restartRequest, (await ask(restartRequest)).result);
            const afterRestart = draws(main.seam, 6);
            main.seam.clearRouteRandomSeed();
            compared += 1;
            if (!deepSame(expected, { map: mapPrint(map), hunter, restartMap: mapPrint(again), afterRestart }) && diffs.length < 5) diffs.push(key);
          }
        }
      }
      const normal = await ask(main.job.createRouteGenerationRequest("easy", 1));
      const pass = diffs.length === 0 && compared > 0 && normal.result.random === null && normal.armedAfter === null && normal.result.map.walls instanceof Set;
      R.record("C3", "clone", "NODE_WORKER_THREAD_HANDOFF", pass, { generations: compared, diffs, normalPlay: { random: normal.result.random, workerSeedAfter: normal.armedAfter } });
    } finally {
      await worker.terminate();
    }
  });
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    const dirs = [process.env.PLAYWRIGHT_DIR, path.join(path.dirname(process.execPath), "..", "lib", "node_modules")].filter(Boolean);
    for (const dir of dirs) {
      for (const entry of ["index.mjs", "index.js"]) {
        const file = path.join(dir, "playwright", entry);
        if (fs.existsSync(file)) return await import(pathToFileURL(file).href);
      }
    }
    return null;
  }
}

/** The page's main realm for C4: the job, the defenders and the seam in ONE registry, as the product's bundle has them. */
const C4_MAIN = "src/__c7a-handoff-main.ts";
function pageMainBundle(side) {
  const tree = openSourceTree({
    rev: side.tree.rev,
    sourceOverrides: {
      [C4_MAIN]:
        'export * as job from "@/games/escape-maze/route-generation-job";\n' +
        'export * as defenders from "@/games/escape-maze/route-defenders";\n' +
        'export * as seam from "@/engine/route-random";\n',
    },
  });
  return emitModuleBundle({ tree, transforms: side.transforms, entry: C4_MAIN });
}

async function chromiumChecks(R, cur) {
  // C4 (--chromium) — the same handoff in Chromium: a Blob Worker evaluates the job bundle and generates; the page's
  // main realm (the job, the defenders and the seam in one registry) arms, requests, accepts and plays the Hunter.
  // Maps, checkpoints, Hunter decisions and the next draws must be f19f319's, computed in Node; structuredClone of the
  // result and of the checkpoint is deep-equal in the page; the Worker ends each seeded job armed with that seed.
  await R.guardedAsync("C4", "clone", "CHROMIUM_WORKER_HANDOFF", async () => {
    if (!cur.hasJob) throw new Error(`${ROUTE_GENERATION_JOB} does not exist in this tree`);
    const playwright = await loadPlaywright();
    if (!playwright) throw new Error("playwright not found (set PLAYWRIGHT_DIR)");
    const browser = await playwright.chromium.launch();
    const ORIGIN = "https://c7a-handoff.invalid";
    try {
      const page = await browser.newPage();
      await page.route(`${ORIGIN}/**`, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>c7a</title>" }));
      await page.goto(`${ORIGIN}/`);
      const cases = WITNESSES.map(({ seed, route, mode }) => ({ seed, route, mode }));
      const out = await page.evaluate(
        async ({ jobSource, mainSource, cases, seamPath }) => {
          const workerSource =
            `const bundle = (${jobSource})(); const job = bundle.exports; const seam = bundle.require(${JSON.stringify(seamPath)});\n` +
            "self.onmessage = (e) => { const result = job.runRouteGenerationSync(e.data); self.postMessage({ result, armedAfter: seam.getArmedRouteSeed() }); };";
          const worker = new Worker(URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" })));
          const ask = (request) =>
            new Promise((resolve) => {
              worker.onmessage = (e) => resolve(e.data);
              worker.postMessage(request);
            });
          const { job, defenders, seam } = (0, eval)(mainSource)().exports;
          const tagged = (value) => JSON.stringify(value, (_k, v) => (v instanceof Set ? { $set: [...v] } : v));
          const key = (p) => `${p.row},${p.col}`;
          const results = [];
          for (const { seed, route, mode } of cases) {
            seam.armRouteRandomSeed(seed);
            const request = job.createRouteGenerationRequest(mode, route);
            const reply = await ask(request);
            const cloneOk = tagged(structuredClone(reply.result)) === tagged(reply.result) && tagged(structuredClone(reply.result.random)) === tagged(reply.result.random);
            const map = job.acceptRouteGenerationResult(request, reply.result);
            const blocked = new Set(map.traps.map(key));
            let guardian = map.guardianStart;
            const decisions = [];
            for (let i = 0; i < 6; i += 1) {
              guardian = defenders.chooseGuardianMove(guardian, map.playerStart, map.exitPosition, map.walls, mode, blocked);
              decisions.push(key(guardian));
            }
            const next = Array.from({ length: 12 }, () => seam.routeRandom());
            seam.clearRouteRandomSeed();
            results.push({ seed, walls: [...map.walls], wallsIsSet: map.walls instanceof Set, stars: map.collectibleStars, checkpoint: reply.result.random, decisions, next, cloneOk, workerArmedAfter: reply.armedAfter });
          }
          worker.terminate();
          return results;
        },
        { jobSource: jobBundle(cur), mainSource: pageMainBundle(cur), cases, seamPath: ROUTE_RANDOM_SEAM },
      );
      // The same in Node, on f19f319: arm → generate → the six Hunter decisions (Explorer on its start) → 12 draws.
      const base = rotaRealm(BASE);
      const diffs = [];
      out.forEach((r, i) => {
        const { seed, route, mode } = cases[i];
        base.seam.armRouteRandomSeed(seed);
        const map = base.generation.generateMaze(mode, route);
        const key = (p) => `${p.row},${p.col}`;
        const blocked = new Set(map.traps.map(key));
        let guardian = map.guardianStart;
        const decisions = [];
        for (let k = 0; k < 6; k += 1) {
          guardian = base.defenders.chooseGuardianMove(guardian, map.playerStart, map.exitPosition, map.walls, mode, blocked);
          decisions.push(key(guardian));
        }
        const next = draws(base.seam, 12);
        base.seam.clearRouteRandomSeed();
        const ok =
          r.wallsIsSet && r.cloneOk && r.workerArmedAfter === seed >>> 0 && r.checkpoint?.armedSeed === seed >>> 0 &&
          deepSame(r.walls, [...map.walls]) && deepSame(r.stars, map.collectibleStars) && deepSame(r.decisions, decisions) && sameSeq(r.next, next);
        if (!ok) diffs.push(seed);
      });
      R.record("C4", "clone", "CHROMIUM_WORKER_HANDOFF", diffs.length === 0 && out.length === cases.length, {
        browser: `Chromium ${browser.version()}`,
        cases: cases.length,
        drawsPerGeneration: out.map((r) => (r.checkpoint.state - r.checkpoint.armedSeed) / INC),
        diffs,
      });
    } finally {
      await browser.close();
    }
  });
}

// =================================================================================================
// [performance] — informational
// =================================================================================================

function performanceReport(R, cur) {
  const native = (side, entry) => (0, eval)(emitModuleBundle({ tree: side.tree, transforms: side.transforms, entry }))();
  const rows = {};
  for (const [label, side] of [["f19f319", BASE], ["tree", cur]]) {
    const seam = native(side, ROUTE_RANDOM_SEAM).exports;
    seam.armRouteRandomSeed(1);
    let sink = 0;
    for (let i = 0; i < 2e6; i += 1) sink += seam.routeRandom(); // warm-up
    const reps = [];
    for (let r = 0; r < 5; r += 1) {
      const t = performance.now();
      for (let i = 0; i < 1e7; i += 1) sink += seam.routeRandom();
      reps.push((performance.now() - t) / 10);
    }
    seam.clearRouteRandomSeed();
    reps.sort((a, b) => a - b);
    const generation = native(side, ROUTE_GENERATION);
    const genSeam = generation.require(ROUTE_RANDOM_SEAM);
    const times = [];
    for (let k = 0; k < 45; k += 1) {
      genSeam.armRouteRandomSeed(9000 + k);
      const t = performance.now();
      generation.exports.generateMaze(DIFFICULTIES[k % 3], ROUTES[Math.floor(k / 3) % 3]);
      times.push(performance.now() - t);
    }
    genSeam.clearRouteRandomSeed();
    times.sort((a, b) => a - b);
    rows[label] = {
      seededMsPerMillionDraws: Number(reps[2].toFixed(3)),
      generationMs: { p50: Number(times[22].toFixed(1)), p95: Number(times[42].toFixed(1)), n: times.length },
      sink: Number.isFinite(sink),
    };
  }
  rows.ratio = {
    draws: Number((rows.tree.seededMsPerMillionDraws / rows.f19f319.seededMsPerMillionDraws).toFixed(3)),
    generationP50: Number((rows.tree.generationMs.p50 / rows.f19f319.generationMs.p50).toFixed(3)),
  };
  console.log(`INFO  P1 [performance] — informational, not a gate (${os.cpus()[0]?.model ?? "cpu"}, node ${process.version})`);
  console.log(`        ${JSON.stringify(rows)}`);
  return rows;
}

// =================================================================================================
// the suite, at a scale
// =================================================================================================

const FULL = {
  scripts: 4000,
  longScripts: 60,
  oracleSeeds: 2000,
  edgeDraws: 4_950_000,
  handoffSeeds: 1600,
  freshEvery: 5,
  repeatSeeds: 600,
  generationSeeds: (route, mode) => {
    const spread = createSeededRandom(route * 1000 + DIFFICULTIES.indexOf(mode) * 100 + 7);
    return Array.from({ length: 24 }, () => Math.floor(spread() * 2 ** 32));
  },
  freshWorkerEvery: 6,
  sessionsPerCell: 3,
  workerSeedsPerCell: 5,
};
const SMALL = {
  ...FULL,
  scripts: 300,
  longScripts: 3,
  oracleSeeds: 50,
  edgeDraws: 0,
  handoffSeeds: 120,
  repeatSeeds: 40,
  generationSeeds: (route, mode) => FULL.generationSeeds(route, mode).slice(0, 2),
  sessionsPerCell: 0,
  workerSeedsPerCell: 1,
};

async function suite(cur, scale, { quiet = false, react = true, chromium = false, perf = true } = {}) {
  const R = createRecorder({ quiet });
  const baseRecords = scale.baseRecords ?? new Map();
  const cache = scale.cache ?? {};
  const log = (title) => !quiet && console.log(`\n— ${title}`);
  log("[structure] / [gate]");
  structureChecks(R, cur);
  gateChecks(R, cur);
  log("[equivalence]");
  equivalenceStreamChecks(R, cur, scale);
  equivalenceGenerationChecks(R, cur, scale, baseRecords);
  equivalenceSessionChecks(R, cur, scale, cache);
  if (react) await equivalenceReactChecks(R, cur);
  log("[unseeded]");
  unseededChecks(R, cur);
  unseededCheckpointChecks(R, cur);
  log("[handoff]");
  handoffChecks(R, cur, scale);
  generationHandoffChecks(R, cur, scale, baseRecords);
  hookHandoffChecks(R, cur, scale, cache);
  log("[clone]");
  cloneChecks(R, cur);
  await workerThreadChecks(R, cur, scale, baseRecords);
  if (chromium) await chromiumChecks(R, cur);
  let perfRows = null;
  if (perf) {
    log("[performance]");
    perfRows = performanceReport(R, cur);
  }
  return { tests: R.tests, perf: perfRows };
}

// =================================================================================================
// mutants (in memory, never written)
// =================================================================================================

const replaceOnce = (file, anchor, replacement) => ({
  [file]: (source) => {
    if (source.split(anchor).length !== 2) throw new Error(`mutant anchor not found exactly once in ${file}: ${anchor}`);
    return source.replace(anchor, replacement);
  },
});
/** Where C7A's run lives in the working tree: the runner since ROUTE-C7C (moved verbatim from the job). */
const RUNNER_FILE = routeGenerationRunnerFile(openSourceTree());
const MUTANTS_LIST = [
  ["checkpoint one draw behind", replaceOnce(ROUTE_RANDOM_SEAM, "return { armedSeed, state: seededState };", "return { armedSeed, state: seededState - 0x6d2b79f5 };")],
  ["checkpoint one draw ahead", replaceOnce(ROUTE_RANDOM_SEAM, "return { armedSeed, state: seededState };", "return { armedSeed, state: seededState + 0x6d2b79f5 };")],
  ["restore loses the armed seed", replaceOnce(ROUTE_RANDOM_SEAM, "  armedSeed = seed;\n  seededDraw = createSeededDraw(state);", "  seededDraw = createSeededDraw(state);")],
  ["restore restarts at the seed (ignores the state)", replaceOnce(ROUTE_RANDOM_SEAM, "  armedSeed = seed;\n  seededDraw = createSeededDraw(state);", "  armedSeed = seed;\n  seededDraw = createSeededDraw(seed);")],
  ["beginSeededGeneration continues the current state", replaceOnce(ROUTE_RANDOM_SEAM, "  if (armedSeed === null) return;\n  seededDraw = createSeededDraw(armedSeed);", "  if (armedSeed === null) return;\n  seededDraw = createSeededDraw(seededState);")],
  ["clear keeps the checkpoint (seed survives)", replaceOnce(ROUTE_RANDOM_SEAM, "  armedSeed = null;\n  seededDraw = null;\n  seededState = 0;", "  seededDraw = null;\n  seededState = 0;")],
  ["clear keeps the seeded stream", replaceOnce(ROUTE_RANDOM_SEAM, "  armedSeed = null;\n  seededDraw = null;\n  seededState = 0;", "  armedSeed = null;\n  seededState = 0;")],
  ["arm does not restart the stream", replaceOnce(ROUTE_RANDOM_SEAM, "  armedSeed = seed >>> 0;\n  seededDraw = createSeededDraw(armedSeed);", "  armedSeed = seed >>> 0;\n  seededDraw ??= createSeededDraw(armedSeed);")],
  ["normal play draws Math.random twice", replaceOnce(ROUTE_RANDOM_SEAM, "return seededDraw ? seededDraw() : Math.random();", "return seededDraw ? seededDraw() : (Math.random(), Math.random());")],
  ["randomItem consumes two draws", replaceOnce(ROUTE_RANDOM_SEAM, "  return items[Math.floor(routeRandom() * items.length)];", "  routeRandom();\n  return items[Math.floor(routeRandom() * items.length)];")],
  ["checkpoint with the seed but the wrong state", replaceOnce(ROUTE_RANDOM_SEAM, "return { armedSeed, state: seededState };", "return { armedSeed, state: armedSeed };")],
  ["the state wraps to uint32", replaceOnce(ROUTE_RANDOM_SEAM, "    seededState += 0x6d2b79f5;", "    seededState = (seededState + 0x6d2b79f5) >>> 0;")],
  ["job result forgets the checkpoint", replaceOnce(RUNNER_FILE, "return { map, random: getRouteRandomCheckpoint() };", "return { map, random: null };")],
  ["job result reports the request's stream, not generation's", replaceOnce(RUNNER_FILE, "return { map, random: getRouteRandomCheckpoint() };", "return { map, random: request.random };")],
  ["accept does not restore", replaceOnce(ROUTE_GENERATION_JOB, "  restoreRouteRandomCheckpoint(result.random);\n  return result.map;", "  return result.map;")],
  ["the generating realm keeps a stale seed in normal play", replaceOnce(RUNNER_FILE, "  if (request.random === null) clearRouteRandomSeed();\n  else restoreRouteRandomCheckpoint(request.random);", "  if (request.random !== null) restoreRouteRandomCheckpoint(request.random);")],
];

// =================================================================================================
// main
// =================================================================================================

const started = performance.now();
if (MUTANTS) {
  console.log(`route worker rng handoff · mutants of the working tree (in memory), against baseline ${ROUTE_C7A_BASE.slice(0, 7)}\n`);
  const tree = openSourceTree();
  const shared = { ...SMALL, baseRecords: new Map(), cache: {} };
  const clean = await suite(makeSide(tree), shared, { quiet: true, react: false, perf: false });
  const cleanFailures = clean.tests.filter((t) => !t.pass).map((t) => t.id);
  console.log(`${cleanFailures.length === 0 ? "PASS" : "FAIL"}  the unmutated tree passes the mutant-scale suite${cleanFailures.length ? ` (failing: ${cleanFailures.join(", ")})` : ""}`);
  const rows = [];
  for (const [label, transform] of MUTANTS_LIST) {
    let caughtBy;
    try {
      const result = await suite(makeSide(tree, transform), shared, { quiet: true, react: false, perf: false });
      caughtBy = result.tests.filter((t) => !t.pass).map((t) => t.id);
    } catch (error) {
      caughtBy = [`load:${String(error.message).slice(0, 60)}`];
    }
    rows.push({ label, caughtBy });
    console.log(`${caughtBy.length ? "PASS" : "FAIL"}  mutant caught — ${label}${caughtBy.length ? `  (by ${caughtBy.join(", ")})` : "  (NOT CAUGHT)"}`);
  }
  const ok = cleanFailures.length === 0 && rows.every((r) => r.caughtBy.length > 0);
  console.log(`\n${rows.filter((r) => r.caughtBy.length).length}/${rows.length} mutants caught · ${((performance.now() - started) / 1000).toFixed(0)} s`);
  console.log(ok ? "ROUTE_WORKER_RNG_HANDOFF_MUTANTS_OK" : "ROUTE_WORKER_RNG_HANDOFF_MUTANTS_FAILED");
  process.exit(ok ? EXIT_OK : EXIT_VALIDATION_FAILED);
}

const CURRENT = makeSide(openSourceTree({ rev: REV }));
console.log(
  `route worker rng handoff · ${REV ? `rev ${CURRENT.tree.rev.slice(0, 12)}` : "working tree"} vs baseline ${ROUTE_C7A_BASE.slice(0, 7)} (no checkpoint, no job)`,
);
const { tests } = await suite(CURRENT, FULL, { chromium: CHROMIUM });
const failed = tests.filter((t) => !t.pass);
const byKind = {};
for (const t of tests) {
  byKind[t.kind] ??= { pass: 0, fail: 0 };
  byKind[t.kind][t.pass ? "pass" : "fail"] += 1;
}
console.log(`\n${tests.length - failed.length}/${tests.length} checks hold · ${JSON.stringify(byKind)} · ${((performance.now() - started) / 1000).toFixed(0)} s`);
console.log(failed.length === 0 ? "ROUTE_WORKER_RNG_HANDOFF_OK" : "ROUTE_WORKER_RNG_HANDOFF_FAILED");
process.exit(failed.length === 0 ? EXIT_OK : EXIT_VALIDATION_FAILED);
