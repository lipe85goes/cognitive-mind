/**
 * MINDFLOW-GAMEPLAY-PLATFORM-LOCK-V1 — the lock gate.
 *
 * A manifest of the contracts frozen by `docs/GAMEPLAY_PLATFORM_LOCK_V1.md`,
 * checked against the code. It is NOT a second CORE: every behaviour below is
 * proven in depth by the suite named beside it (the "owner"); this gate only
 * makes sure the frozen SHAPE is still there, so a change that reopens a
 * locked contract fails loudly and has to say which change class allows it.
 *
 *   [architecture]  canonical modules, no run-time cycles, Home without game
 *                   code, lazy registry, lazy Babylon, generation only in the
 *                   Worker, the Worker graph pure, the C7C production binding,
 *                   shell/GameScreen game-agnostic, continuation game-owned;
 *   [rota]          exactly three product Routes (evaluated), the three modes,
 *                   the v1 Chest rewards, the C5 action set, the C6 event set,
 *                   the hook's state shape (one routeNumber cell, one reducer);
 *   [circuit]       timers belong to the session, the entry contract;
 *   [doc]           the lock document, its decision, its canonical commit, the
 *                   debt register (every row classified, no BLOCKER), and the
 *                   older decision flags not reopened.
 *
 * Import graph: every product module is transpiled with TypeScript (ESNext
 * modules, so type-only imports are already elided) and its output is read
 * for three kinds of edge — static (`import … from`, `export … from`),
 * dynamic (`import()`), and worker (`new Worker(new URL("…", import.meta.url))`).
 * Nothing is executed except `continuation.ts` (R1), in a `vm` realm.
 *
 * Usage:
 *   node tools/validation/gameplay-platform-lock-v1.mjs                  # the gate, on the working tree
 *   node tools/validation/gameplay-platform-lock-v1.mjs --rev=<commit>   # code checks on <commit>; [doc] skipped
 *   node tools/validation/gameplay-platform-lock-v1.mjs --counterfactuals
 *        runs the code checks on the baselines in COUNTERFACTUALS and requires
 *        every check listed for a baseline to FAIL there (the gate would have
 *        caught the contract's absence), the working tree to pass them all, and
 *        every in-memory MUTANT of today's tree to fail its listed checks.
 *
 * Writes nothing. Exit 0 = every check holds, 1 = a check failed, 3 = usage error.
 */
import fs from "node:fs";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";
import { openSourceTree } from "./route-module-loader.mjs";

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
const COUNTERFACTUAL_MODE = args.includes("--counterfactuals");
if (args.some((arg) => arg !== revArg && arg !== "--counterfactuals") || REV === "" || (REV && COUNTERFACTUAL_MODE)) {
  console.error("usage: node tools/validation/gameplay-platform-lock-v1.mjs [--rev=<commit> | --counterfactuals]");
  process.exit(EXIT_USAGE);
}

const git = (gitArgs) => execFileSync("git", gitArgs, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }).trim();

// --- the frozen manifest -----------------------------------------------------------------------

const LOCK_DOC = "docs/GAMEPLAY_PLATFORM_LOCK_V1.md";
const LOCK_DECISION = "GAMEPLAY_PLATFORM_LOCK_V1 = PASS";
const APP_ROOTS = ["src/app/page.tsx", "src/app/layout.tsx"];
const ROTA = "src/games/escape-maze/";
const CIRCUIT = "src/games/color-sequence/";
const M = (name) => `${ROTA}${name}`;

const FILES = {
  page: "src/app/page.tsx",
  gameScreen: "src/components/GameScreen.tsx",
  registry: "src/games/index.ts",
  entryContract: "src/games/entry-contract.ts",
  types: "src/types/game.ts",
  storage: "src/engine/storage.ts",
  game: M("RouteStrategyGame.tsx"),
  hook: M("useEscapeMaze.ts"),
  continuation: M("continuation.ts"),
  board: M("RouteBabylonBoard.tsx"),
  scene: M("routeBabylonScene.ts"),
  generation: M("route-generation.ts"),
  runner: M("route-generation-runner.ts"),
  worker: M("route-generation.worker.ts"),
  executor: M("route-generation-worker-executor.ts"),
  protocol: M("route-generation-worker-protocol.ts"),
  client: M("route-generation-client.ts"),
  job: M("route-generation-job.ts"),
  state: M("route-state.ts"),
  events: M("route-events.ts"),
  invariants: M("route-invariants.ts"),
  circuitGame: `${CIRCUIT}MemoryCircuit3DGame.tsx`,
  circuitHook: `${CIRCUIT}useColorSequenceGame.ts`,
};

/** The stabilised architecture (C0–C7C) and the platform it plugs into. */
const CANONICAL_MODULES = [
  FILES.page, FILES.gameScreen, FILES.registry, FILES.entryContract, FILES.types, FILES.storage,
  "src/components/RewardResultModal.tsx", "src/components/WorldEntryTransition.tsx",
  "src/components/world-entry/useWorldEntryController.ts", "src/components/home/HomeStage.tsx",
  FILES.game, FILES.hook, FILES.continuation, M("route-config.ts"), M("route-geometry.ts"), FILES.generation,
  M("route-defenders.ts"), FILES.invariants, FILES.state, FILES.events, M("route-session.ts"), FILES.job,
  FILES.client, FILES.runner, FILES.worker, FILES.executor, FILES.protocol, FILES.board, FILES.scene,
  "src/engine/route-random.ts", FILES.circuitGame, FILES.circuitHook,
];

/** Files that make up the shell: they may know that games exist, never which. */
const SHELL_FILES = [
  "src/app/page.tsx", "src/app/layout.tsx", FILES.gameScreen, "src/components/WorldEntryTransition.tsx",
  "src/components/world-entry/useWorldEntryController.ts", "src/components/world-entry/worldEntryTypes.ts",
];
const SHELL_FORBIDDEN = /escape-maze|color-sequence|\bRota\b|\bRoute(?!r)|routeNumber|journeyCompleted|readRouteContinuation|MemoryCircuit|useEscapeMaze|Babylon/;

const V1_DIFFICULTIES = ["easy", "hard", "medium"];
const V1_CHEST_REWARDS = ["pickaxe", "second-chance"];
const V1_STATE_ACTIONS = [
  "BLOCK_STEP", "COMMIT_CAPTURE", "COUNT_TURN", "END_ROUTE", "MOVE_EXPLORER", "OPEN_CHEST", "OPEN_WALL",
  "SELECT_REWARD", "SETTLE_DEFENDERS", "SPEND_SECOND_CHANCE", "START_ROUTE",
];
const V1_DOMAIN_EVENTS = [
  "CHEST_OPENED", "DEFENDERS_SETTLED", "EXPLORER_CAPTURED", "EXPLORER_STEP_BLOCKED", "EXPLORER_STEP_COMMITTED",
  "LIGHT_COLLECTED", "PORTAL_ACTIVATED", "REWARD_SELECTED", "ROUTE_ENDED", "ROUTE_STARTED", "SECOND_CHANCE_USED",
  "TRAP_ARMED", "WALL_OPENED",
];

const DEBT_CLASSES = ["BLOCKER", "POST-LOCK", "ROTA-2.0", "DEV/TOOLING"];
/** Every debt the lock audited must be in the register (ids are the doc's first column). */
const REQUIRED_DEBT_IDS = [
  "D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08", "D09", "D10", "D11", "D12", "D13", "D14", "D15", "D16", "D17", "D18", "D19",
];
/** Decisions recorded before the lock that the lock relies on; each must still read the same. */
const DECISION_FLAGS = [
  { file: "docs/SOURCE_OF_TRUTH.md", text: "`GITHUB_SOURCE_OF_TRUTH = YES`" },
  { file: "docs/route-worker-decision.md", text: "**DECISION: C7_GO**" },
];

/**
 * Baselines from before a contract closed, and the checks that must fail there. Only those checks are asked of the
 * baseline: older trees miss later modules too, and that is not what the counterfactual is about.
 */
const COUNTERFACTUALS = [
  { rev: "bd75e69", before: "ROUTE-C7C (generation still on the main thread)", mustFail: ["A6", "A8"] },
  { rev: "7b740e4", before: "ROUTE-JOURNEY-TERMINAL-01 / P4B (Route 3 → Route 4)", mustFail: ["R1"] },
  { rev: "61c3b04", before: "MEMORY-CIRCUIT-LIFECYCLE-01 (timers not session-owned)", mustFail: ["M1"] },
  { rev: "3e30148", before: "platform lazy loading (registry imported every game eagerly)", mustFail: ["A3", "A4"] },
  { rev: "415cead", before: "typed game continuation (the shell read Route details)", mustFail: ["A10"] },
];

/**
 * In-memory edits of the working tree (nothing is written) that reopen a locked contract; each must fail its checks.
 * They prove the gate's own checks bite on today's code, where the baselines above prove they would have caught the
 * contract's absence before it closed.
 */
const MUTANTS = [
  {
    name: "the Rota's executor bound back to local generation",
    file: "src/games/escape-maze/route-generation-client.ts",
    edits: [
      ['import { runRouteGenerationInWorker } from "@/games/escape-maze/route-generation-worker-executor";', 'import { runRouteGenerationInWorker } from "@/games/escape-maze/route-generation-worker-executor";\nimport { runRouteGenerationLocally } from "@/games/escape-maze/route-generation-runner";\nvoid runRouteGenerationInWorker;'],
      ["  runRouteGenerationInWorker;\n", "  runRouteGenerationLocally;\n"],
    ],
    mustFail: ["A6", "A8"],
  },
  {
    name: "a fourth product Route",
    file: "src/games/escape-maze/continuation.ts",
    edits: [["export const ROUTE_JOURNEY_FINAL_ROUTE = 3;", "export const ROUTE_JOURNEY_FINAL_ROUTE = 4;"]],
    mustFail: ["R1"],
  },
  {
    name: "a game imported eagerly by the registry",
    file: "src/games/index.ts",
    edits: [['import type { ComponentType } from "react";', 'import type { ComponentType } from "react";\nimport { RouteStrategyGame } from "@/games/escape-maze/RouteStrategyGame";\nvoid RouteStrategyGame;']],
    mustFail: ["A3", "A4"],
  },
  {
    name: "GameScreen learns about the Rota",
    file: "src/components/GameScreen.tsx",
    edits: [["  const ActiveGame = loadedGame?.component ?? null;", '  const ActiveGame = loadedGame?.component ?? null;\n  const isRoute = gameId === "escape-maze";\n  void isRoute;']],
    mustFail: ["A9"],
  },
  {
    name: "a Rota hook cell put back (the C5 mutant the historical runner no longer sees)",
    file: "src/games/escape-maze/useEscapeMaze.ts",
    edits: [["  const [routeNumber] = useState(normalizedInitialRouteNumber);\n", "  const [routeNumber] = useState(normalizedInitialRouteNumber);\n  const [moveTickCell] = useState(0);\n"]],
    mustFail: ["R3"],
  },
  {
    name: "the Circuit's session no longer revoked on unmount",
    file: "src/games/color-sequence/useColorSequenceGame.ts",
    edits: [["  useEffect(() => () => revokeSession(sessionRef), []);", "  useEffect(() => undefined, []);"]],
    mustFail: ["M1"],
  },
];

// --- the import graph --------------------------------------------------------------------------

function buildGraph(tree) {
  const nodes = new Map();
  const parseFile = (file) => {
    if (nodes.has(file)) return nodes.get(file);
    const node = { file, static: [], dynamic: [], worker: [], packages: { static: [], dynamic: [] } };
    nodes.set(file, node);
    if (!/\.(ts|tsx)$/.test(file)) return node;
    const source = tree.read(file);
    const js = ts.transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.Preserve },
      fileName: file,
    }).outputText;
    const sf = ts.createSourceFile(`${file}.js`, js, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
    const add = (kind, specifier) => {
      const resolved = tree.resolve(specifier, file);
      if (resolved) node[kind].push(resolved);
      else if (kind !== "worker") node.packages[kind].push(specifier);
    };
    const visit = (n) => {
      if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
        add("static", n.moduleSpecifier.text);
      } else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && ts.isStringLiteral(n.arguments[0] ?? {})) {
        add("dynamic", n.arguments[0].text);
      } else if (
        ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === "Worker" &&
        n.arguments?.[0] && ts.isNewExpression(n.arguments[0]) && ts.isIdentifier(n.arguments[0].expression) &&
        n.arguments[0].expression.text === "URL" && ts.isStringLiteral(n.arguments[0].arguments?.[0] ?? {})
      ) {
        add("worker", n.arguments[0].arguments[0].text);
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
    for (const kind of ["static", "dynamic", "worker"]) node[kind] = [...new Set(node[kind])];
    return node;
  };
  /** Closure over the given edge kinds; every reached node is parsed. */
  const closure = (roots, kinds) => {
    const seen = [...new Set([roots].flat())];
    for (let i = 0; i < seen.length; i += 1) {
      const node = parseFile(seen[i]);
      for (const kind of kinds) for (const next of node[kind]) if (!seen.includes(next)) seen.push(next);
    }
    return seen;
  };
  const node = (file) => parseFile(file);
  return { node, closure, nodes };
}

/** Strongly connected components (> 1 node, or a self-loop) over static edges. */
function staticCycles(graph, files) {
  const index = new Map(), low = new Map(), onStack = new Set(), stack = [], cycles = [];
  let counter = 0;
  const strong = (v) => {
    index.set(v, counter); low.set(v, counter); counter += 1; stack.push(v); onStack.add(v);
    for (const w of graph.node(v).static) {
      if (!index.has(w)) { strong(w); low.set(v, Math.min(low.get(v), low.get(w))); }
      else if (onStack.has(w)) low.set(v, Math.min(low.get(v), index.get(w)));
    }
    if (low.get(v) === index.get(v)) {
      const component = [];
      let w;
      do { w = stack.pop(); onStack.delete(w); component.push(w); } while (w !== v);
      if (component.length > 1 || graph.node(v).static.includes(v)) cycles.push(component.sort());
    }
  };
  for (const file of files) if (!index.has(file)) strong(file);
  return cycles;
}

// --- helpers -------------------------------------------------------------------------------------

const codeOnly = (source) => source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
const sorted = (list) => [...list].sort();
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** The string-literal members of a top-level `type Name = "a" | "b"` (or the `type` tags of a union of objects). */
function unionLiterals(tree, file, name, { tag = null } = {}) {
  const sf = ts.createSourceFile(file, tree.read(file), ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  const alias = sf.statements.find((s) => ts.isTypeAliasDeclaration(s) && s.name.text === name);
  if (!alias) return null;
  const out = [];
  const walk = (t) => {
    if (ts.isUnionTypeNode(t) || ts.isIntersectionTypeNode(t)) t.types.forEach(walk);
    else if (ts.isParenthesizedTypeNode(t)) walk(t.type);
    else if (!tag && ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)) out.push(t.literal.text);
    else if (tag && ts.isTypeLiteralNode(t)) {
      for (const member of t.members) {
        if (ts.isPropertySignature(member) && member.name.getText(sf) === tag && member.type && ts.isLiteralTypeNode(member.type) && ts.isStringLiteral(member.type.literal)) {
          out.push(member.type.literal.text);
        }
      }
    }
  };
  walk(alias.type);
  return sorted(new Set(out));
}

/** Evaluates a module that imports types only (`continuation.ts`) in a fresh realm. */
function evaluateTypesOnlyModule(tree, file) {
  const js = ts.transpileModule(tree.read(file), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: file,
  }).outputText;
  if (/\brequire\(/.test(js)) throw new Error(`${file} imports something at run time`);
  const cjs = { exports: {} };
  vm.runInNewContext(js, { module: cjs, exports: cjs.exports }, { filename: file });
  return cjs.exports;
}

// --- the checks ----------------------------------------------------------------------------------

function codeChecks(tree) {
  const results = [];
  const graph = buildGraph(tree);
  const check = (id, tag, name, fn) => {
    try {
      const { pass, ...detail } = fn();
      results.push({ id, tag, name, pass: Boolean(pass), detail });
    } catch (error) {
      results.push({ id, tag, name, pass: false, detail: { error: String(error?.message ?? error).split("\n")[0] } });
    }
  };
  const has = (file) => tree.exists(file);
  const text = (file) => (has(file) ? tree.read(file) : "");

  const workerRoots = () => (has(FILES.worker) ? [FILES.worker] : []);
  /** The main thread: app roots, static + dynamic edges (Worker URLs are another realm). */
  const mainGraph = () => graph.closure(APP_ROOTS, ["static", "dynamic"]);
  /** What the Home's first paint evaluates: static edges only. */
  const homeGraph = () => graph.closure(APP_ROOTS, ["static"]);
  const workerGraph = () => graph.closure(workerRoots(), ["static"]);

  check("A1", "architecture", "CANONICAL_MODULES_EXIST", () => {
    const missing = CANONICAL_MODULES.filter((file) => !has(file));
    return { pass: missing.length === 0, modules: CANONICAL_MODULES.length, missing };
  });

  check("A2", "architecture", "NO_RUNTIME_CYCLES", () => {
    const files = [...new Set([...mainGraph(), ...workerGraph()])];
    const cycles = staticCycles(graph, files.filter((f) => /\.(ts|tsx)$/.test(f)));
    return { pass: cycles.length === 0, modulesScanned: files.length, cycles };
  });

  check("A3", "architecture", "HOME_INITIAL_GRAPH_HAS_NO_GAME_CODE", () => {
    const home = homeGraph();
    const gameCode = home.filter((f) => /^src\/games\/[^/]+\//.test(f));
    const heavyPackages = [...new Set(home.flatMap((f) => graph.node(f).packages.static))]
      .filter((p) => /^(@babylonjs\/|three$|@react-three\/)/.test(p));
    const workerEntries = home.filter((f) => graph.node(f).worker.length > 0);
    return {
      pass: gameCode.length === 0 && heavyPackages.length === 0 && workerEntries.length === 0 && home.includes(FILES.registry),
      homeModules: home.length,
      gameCode,
      heavyPackages,
      workerEntries,
    };
  });

  check("A4", "architecture", "REGISTRY_LOADS_EVERY_GAME_LAZILY", () => {
    const registry = graph.node(FILES.registry);
    const gameIds = unionLiterals(tree, FILES.types, "GameId");
    const staticGame = registry.static.filter((f) => /^src\/games\/[^/]+\//.test(f));
    const dynamicGames = registry.dynamic.filter((f) => /^src\/games\/[^/]+\//.test(f));
    const contract = graph.node(FILES.entryContract);
    const contractKeys = sorted([...codeOnly(text(FILES.entryContract)).matchAll(/^\s*"([a-z-]+)":\s*\{\s*readiness:/gm)].map((m) => m[1]));
    const loaderKeys = sorted([...codeOnly(text(FILES.registry)).matchAll(/^\s*"([a-z-]+)":\s*\(\)\s*=>/gm)].map((m) => m[1]));
    return {
      pass:
        staticGame.length === 0 && dynamicGames.length === gameIds.length &&
        same(contractKeys, gameIds) && same(loaderKeys, gameIds) &&
        contract.static.length === 0 && contract.dynamic.length === 0,
      gameIds,
      staticGameImports: staticGame,
      dynamicGameImports: dynamicGames.length,
      entryContractKeys: contractKeys,
      loaderKeys,
      entryContractRuntimeImports: [...contract.static, ...contract.dynamic],
    };
  });

  check("A5", "architecture", "BABYLON_STAYS_LAZY", () => {
    const main = mainGraph();
    const staticBabylon = main.filter((f) => graph.node(f).packages.static.some((p) => p.startsWith("@babylonjs/")));
    const dynamicBabylon = main.filter((f) => graph.node(f).packages.dynamic.some((p) => p.startsWith("@babylonjs/")));
    const staticImportersOf = (target) => main.filter((f) => graph.node(f).static.includes(target));
    const boardStatic = staticImportersOf(FILES.board);
    const sceneStatic = staticImportersOf(FILES.scene);
    return {
      pass:
        staticBabylon.length === 0 && same(dynamicBabylon, [FILES.board]) && boardStatic.length === 0 &&
        sceneStatic.length === 0 && main.includes(FILES.board) && graph.node(FILES.game).dynamic.includes(FILES.board),
      staticBabylonImporters: staticBabylon,
      dynamicBabylonImporters: dynamicBabylon,
      boardStaticImporters: boardStatic,
      sceneStaticImporters: sceneStatic,
    };
  });

  check("A6", "architecture", "GENERATION_RUNS_ONLY_IN_THE_WORKER", () => {
    const main = mainGraph();
    const onMain = [FILES.generation, FILES.runner, FILES.worker].filter((f) => main.includes(f));
    const worker = workerGraph();
    const workerEdges = main.flatMap((f) => graph.node(f).worker.map((to) => `${f} -> ${to}`));
    return {
      pass: onMain.length === 0 && worker.includes(FILES.generation) && same(workerEdges, [`${FILES.executor} -> ${FILES.worker}`]),
      generationModulesOnMain: onMain,
      workerReachesGeneration: worker.includes(FILES.generation),
      workerEdges,
    };
  });

  check("A7", "architecture", "WORKER_GRAPH_HAS_NO_UI_RENDER_OR_SESSION", () => {
    const worker = workerGraph();
    if (worker.length === 0) return { pass: false, reason: "no worker entry" };
    const packages = [...new Set(worker.flatMap((f) => graph.node(f).packages.static))];
    const forbiddenFiles = worker.filter((f) =>
      /^src\/(app|components|lib|data)\//.test(f) || /\.(tsx|css)$/.test(f) ||
      [FILES.hook, FILES.state, M("route-session.ts"), FILES.events, FILES.storage, FILES.client, FILES.executor].includes(f),
    );
    const dynamicOrWorker = worker.filter((f) => graph.node(f).dynamic.length + graph.node(f).worker.length > 0);
    return {
      pass: packages.length === 0 && forbiddenFiles.length === 0 && dynamicOrWorker.length === 0,
      workerModules: worker,
      packages,
      forbiddenFiles,
      dynamicOrWorker,
    };
  });

  check("A8", "architecture", "C7C_WORKER_IS_THE_PRODUCTION_BINDING", () => {
    const client = codeOnly(text(FILES.client));
    const executor = codeOnly(text(FILES.executor));
    const binding = /export const routeGenerationExecutor:\s*RouteGenerationExecutor\s*=\s*runRouteGenerationInWorker\s*;/.test(client);
    const clientImportsExecutor = graph.node(FILES.client).static.includes(FILES.executor);
    const staticWorkerUrl = /new Worker\(\s*new URL\(\s*"\.\/route-generation\.worker\.ts",\s*import\.meta\.url\s*\)/.test(executor);
    const executorEdges = [...graph.node(FILES.executor).static, ...graph.node(FILES.executor).dynamic];
    const noLocalFallback = !executorEdges.some((f) => [FILES.runner, FILES.generation].includes(f)) && !/runRouteGenerationLocally|generateMaze\(/.test(executor);
    const runnerImporters = [...graph.nodes.keys()].filter((f) => graph.node(f).static.includes(FILES.runner) || graph.node(f).dynamic.includes(FILES.runner));
    return {
      pass: binding && clientImportsExecutor && staticWorkerUrl && noLocalFallback && same(runnerImporters, [FILES.worker]),
      binding,
      clientImportsExecutor,
      staticWorkerUrl,
      noLocalFallback,
      runnerImporters,
    };
  });

  check("A9", "architecture", "SHELL_AND_GAMESCREEN_ARE_GAME_AGNOSTIC", () => {
    const offenders = SHELL_FILES.filter(has).flatMap((file) => {
      const match = codeOnly(text(file)).match(SHELL_FORBIDDEN);
      const gameImports = graph.node(file).static.filter((f) => /^src\/games\/[^/]+\//.test(f));
      return match || gameImports.length ? [{ file, word: match?.[0] ?? null, gameImports }] : [];
    });
    const gameScreenOpensOnlyTheRegistry = graph.node(FILES.gameScreen).static.includes(FILES.registry);
    return { pass: offenders.length === 0 && gameScreenOpensOnlyTheRegistry, shellFiles: SHELL_FILES.filter(has), offenders };
  });

  check("A10", "architecture", "CONTINUATION_IS_TYPED_AND_GAME_OWNED", () => {
    const union = /export type GameContinuation\s*=/.test(text(FILES.types));
    const kindTag = /kind:\s*"escape-maze-route"/.test(text(FILES.types));
    const resultField = /continuation\?:\s*GameContinuation/.test(text(FILES.types));
    const shellReads = [FILES.page, FILES.gameScreen].filter((file) => /continuation\??\.\s*\w|\.routeNumber|\.kind\b|details\.\w*[Rr]oute/.test(codeOnly(text(file))));
    const readers = [...graph.nodes.keys()].filter((f) => /\.(ts|tsx)$/.test(f) && f !== FILES.continuation && /\breadRouteContinuation\b/.test(codeOnly(text(f))));
    return {
      pass: union && kindTag && resultField && shellReads.length === 0 && readers.length > 0 && readers.every((f) => f.startsWith(ROTA)),
      gameContinuationUnion: union,
      routeKindTag: kindTag,
      resultCarriesContinuation: resultField,
      shellFilesOpeningIt: shellReads,
      readers,
    };
  });

  check("R1", "rota", "JOURNEY_HAS_EXACTLY_THREE_PRODUCT_ROUTES", () => {
    const mod = evaluateTypesOnlyModule(tree, FILES.continuation);
    const next = typeof mod.nextJourneyRoute === "function" ? mod.nextJourneyRoute : () => "no nextJourneyRoute";
    const read = typeof mod.readRouteContinuation === "function" ? mod.readRouteContinuation : () => undefined;
    const table = [1, 2, 3].flatMap((n) => [true, false].map((won) => ({ route: n, won, next: next(n, won) ?? "complete" })));
    const expected = [
      { route: 1, won: true, next: 2 }, { route: 1, won: false, next: 2 },
      { route: 2, won: true, next: 3 }, { route: 2, won: false, next: 3 },
      { route: 3, won: true, next: "complete" }, { route: 3, won: false, next: 3 },
    ];
    const accepted = [0, 1, 2, 3, 4, 999].filter((routeNumber) => read({ kind: "escape-maze-route", routeNumber, difficulty: "easy" }) !== undefined);
    return {
      pass: mod.ROUTE_JOURNEY_FINAL_ROUTE === 3 && same(table, expected) && same(accepted, [1, 2, 3]),
      finalRoute: mod.ROUTE_JOURNEY_FINAL_ROUTE,
      table,
      continuationsAccepted: accepted,
    };
  });

  check("R2", "rota", "V1_MODES_REWARDS_ACTIONS_EVENTS_FROZEN", () => {
    const difficulties = unionLiterals(tree, FILES.types, "DifficultyLevel");
    const rewards = unionLiterals(tree, FILES.invariants, "ChestReward");
    const actions = unionLiterals(tree, FILES.state, "RouteStateAction", { tag: "type" });
    const events = unionLiterals(tree, FILES.events, "RouteDomainEvent", { tag: "type" });
    return {
      pass: same(difficulties, V1_DIFFICULTIES) && same(rewards, V1_CHEST_REWARDS) && same(actions, V1_STATE_ACTIONS) && same(events, V1_DOMAIN_EVENTS),
      difficulties,
      chestRewards: rewards,
      stateActions: actions?.length ?? null,
      domainEvents: events?.length ?? null,
      actionDelta: actions ? { added: actions.filter((a) => !V1_STATE_ACTIONS.includes(a)), removed: V1_STATE_ACTIONS.filter((a) => !actions.includes(a)) } : null,
      eventDelta: events ? { added: events.filter((e) => !V1_DOMAIN_EVENTS.includes(e)), removed: V1_DOMAIN_EVENTS.filter((e) => !events.includes(e)) } : null,
    };
  });

  // C5's "no cell put back" read on the LIVE hook text: since C7B the C5 gate reads the hook through `treeBeforeC7B`,
  // whose reconstruction drops an added cell (debt D19), so the lock pins the shape itself.
  check("R3", "rota", "HOOK_STATE_IS_ONE_ROUTE_NUMBER_CELL_AND_ONE_SESSION_REDUCER", () => {
    const hook = codeOnly(text(FILES.hook));
    const useStates = [...hook.matchAll(/const \[([^\]]*)\]\s*=\s*useState\b/g)].map((m) => m[1].trim());
    const anyUseState = (hook.match(/\buseState\s*[(<]/g) ?? []).length;
    const reducers = [...hook.matchAll(/useReducer\(\s*(\w+)/g)].map((m) => m[1]);
    return {
      pass: same(useStates, ["routeNumber"]) && anyUseState === 1 && same(reducers, ["routeSessionReducer"]),
      useStateCells: useStates,
      useStateCalls: anyUseState,
      useReducers: reducers,
    };
  });

  check("M1", "circuit", "CIRCUIT_TIMERS_BELONG_TO_THE_SESSION", () => {
    const hook = codeOnly(text(FILES.circuitHook));
    const setTimeouts = (hook.match(/\bsetTimeout\(/g) ?? []).length;
    const scheduleBody = hook.match(/function scheduleForSession\([\s\S]*?\n\}/)?.[0] ?? "";
    const ownedTimeout = /window\.setTimeout\(/.test(scheduleBody) && /session\.timers\.add\(/.test(scheduleBody) && /sessionRef\.current === session/.test(scheduleBody);
    const revoke = hook.match(/function revokeSession\([\s\S]*?\n\}/)?.[0] ?? "";
    const revokeClears = /clearTimeout\(/.test(revoke) && /sessionRef\.current = null/.test(revoke);
    const unmountRevokes = /useEffect\(\(\) => \(\) => revokeSession\(sessionRef\), \[\]\)/.test(hook);
    const intervals = (hook.match(/\bsetInterval\(/g) ?? []).length;
    return {
      pass: setTimeouts === 1 && ownedTimeout && revokeClears && unmountRevokes && intervals === 0,
      setTimeoutCallSites: setTimeouts,
      theOneTimeoutIsSessionOwned: ownedTimeout,
      revokeClearsTimers: revokeClears,
      unmountRevokesSession: unmountRevokes,
      setIntervalCallSites: intervals,
    };
  });

  check("M2", "circuit", "CIRCUIT_ENTRY_CONTRACT", () => {
    const explicit = /"color-sequence":\s*\{\s*readiness:\s*"explicit"\s*\}/.test(text(FILES.entryContract));
    const game = codeOnly(text(FILES.circuitGame));
    const props = /GameComponentProps/.test(game);
    const reports = /onReady=\{onEntryReady\}/.test(game) && /onError=\{onEntryError\}/.test(game);
    const loaded = graph.node(FILES.registry).dynamic.includes(FILES.circuitGame);
    return { pass: explicit && props && reports && loaded, explicitReadiness: explicit, gameComponentProps: props, reportsReadyAndError: reports, lazyFromRegistry: loaded };
  });

  return results;
}

function docChecks() {
  const results = [];
  const check = (id, name, fn) => {
    try {
      const { pass, ...detail } = fn();
      results.push({ id, tag: "doc", name, pass: Boolean(pass), detail });
    } catch (error) {
      results.push({ id, tag: "doc", name, pass: false, detail: { error: String(error?.message ?? error).split("\n")[0] } });
    }
  };
  const doc = fs.existsSync(LOCK_DOC) ? fs.readFileSync(LOCK_DOC, "utf8").replace(/\r\n/g, "\n") : "";

  check("D1", "LOCK_DOCUMENT_RECORDS_THE_DECISION", () => {
    const decisions = doc.match(/GAMEPLAY_PLATFORM_LOCK_V1 = (PASS|BLOCKED)/g) ?? [];
    const canonical = doc.match(/Canonical commit:\s*`([0-9a-f]{40})`/)?.[1] ?? null;
    let ancestor = false;
    if (canonical) {
      try {
        git(["merge-base", "--is-ancestor", canonical, "HEAD"]);
        ancestor = true;
      } catch {
        ancestor = false;
      }
    }
    const sections = [
      "Canonical commit", "Lock date", "Games covered", "Frozen contracts", "Architecture snapshot", "Validation summary",
      "Browser summary", "Performance", "Known debt", "Explicit exclusions", "Change policy",
    ];
    const missing = sections.filter((s) => !doc.includes(s));
    return {
      pass: doc.length > 0 && decisions.length > 0 && decisions.every((d) => d === LOCK_DECISION) && Boolean(canonical) && ancestor && missing.length === 0,
      exists: doc.length > 0,
      decisions,
      canonical,
      canonicalIsAncestorOfHead: ancestor,
      missingSections: missing,
    };
  });

  check("D2", "KNOWN_DEBT_IS_CLASSIFIED_AND_NOT_BLOCKING", () => {
    const rows = [...doc.matchAll(/^\|\s*(D\d{2})\s*\|([^\n]*)$/gm)].map((m) => {
      const cells = m[2].split("|").map((c) => c.trim());
      return { id: m[1], cls: cells.find((c) => DEBT_CLASSES.includes(c.replace(/\*/g, ""))) ?? null };
    });
    const unclassified = rows.filter((r) => !r.cls).map((r) => r.id);
    const blockers = rows.filter((r) => r.cls?.replace(/\*/g, "") === "BLOCKER").map((r) => r.id);
    const missing = REQUIRED_DEBT_IDS.filter((id) => !rows.some((r) => r.id === id));
    const duplicates = rows.map((r) => r.id).filter((id, i, all) => all.indexOf(id) !== i);
    const byClass = Object.fromEntries(DEBT_CLASSES.map((c) => [c, rows.filter((r) => r.cls?.replace(/\*/g, "") === c).length]));
    return { pass: rows.length > 0 && unclassified.length === 0 && blockers.length === 0 && missing.length === 0 && duplicates.length === 0, rows: rows.length, byClass, unclassified, blockers, missing, duplicates };
  });

  check("D3", "EARLIER_DECISION_FLAGS_NOT_REOPENED", () => {
    const reopened = DECISION_FLAGS.filter(({ file, text }) => !fs.existsSync(file) || !fs.readFileSync(file, "utf8").includes(text));
    const sot = fs.existsSync("docs/SOURCE_OF_TRUTH.md") ? fs.readFileSync("docs/SOURCE_OF_TRUTH.md", "utf8") : "";
    const arch = fs.existsSync("docs/ARCHITECTURE.md") ? fs.readFileSync("docs/ARCHITECTURE.md", "utf8") : "";
    const lockReferenced = sot.includes("GAMEPLAY_PLATFORM_LOCK_V1") && arch.includes("GAMEPLAY_PLATFORM_LOCK_V1");
    return { pass: reopened.length === 0 && lockReferenced, flags: DECISION_FLAGS.length, reopened, lockReferencedBySourceOfTruthAndArchitecture: lockReferenced };
  });

  return results;
}

// --- run -----------------------------------------------------------------------------------------

const print = (results) => {
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.id} [${r.tag}] — ${r.name}`);
    for (const [key, value] of Object.entries(r.detail)) console.log(`        ${key}: ${JSON.stringify(value)}`);
  }
};

if (COUNTERFACTUAL_MODE) {
  const current = codeChecks(openSourceTree());
  const currentFailing = current.filter((r) => !r.pass).map((r) => r.id);
  console.log(`working tree: ${current.length - currentFailing.length}/${current.length} code checks pass${currentFailing.length ? ` · failing: ${currentFailing.join(", ")}` : ""}`);
  let ok = currentFailing.length === 0;
  for (const { rev, before, mustFail } of COUNTERFACTUALS) {
    const tree = openSourceTree({ rev });
    const results = codeChecks(tree);
    const failing = results.filter((r) => !r.pass).map((r) => r.id);
    const caught = mustFail.filter((id) => failing.includes(id));
    const held = caught.length === mustFail.length;
    ok &&= held;
    console.log(`${held ? "CAUGHT" : "MISSED"}  ${rev} — before ${before}`);
    console.log(`        required to fail: ${mustFail.join(", ")} · failed: ${failing.join(", ") || "none"}`);
    for (const r of results.filter((x) => mustFail.includes(x.id))) {
      console.log(`        ${r.id} ${r.pass ? "PASSED (not caught)" : "FAILED"}: ${JSON.stringify(r.detail).slice(0, 400)}`);
    }
  }
  const worktree = openSourceTree();
  for (const { name, file, edits, mustFail } of MUTANTS) {
    let text = worktree.read(file);
    const misses = edits.filter(([from]) => text.split(from).length - 1 !== 1);
    if (misses.length) {
      ok = false;
      console.log(`BROKEN  mutant — ${name}: anchor not found exactly once in ${file}`);
      continue;
    }
    for (const [from, to] of edits) text = text.replace(from, () => to);
    const failing = codeChecks(openSourceTree({ sourceOverrides: { [file]: text } })).filter((r) => !r.pass).map((r) => r.id);
    const held = mustFail.every((id) => failing.includes(id));
    ok &&= held;
    console.log(`${held ? "CAUGHT" : "MISSED"}  mutant — ${name}`);
    console.log(`        required to fail: ${mustFail.join(", ")} · failed: ${failing.join(", ") || "none"}`);
  }
  console.log(ok ? "LOCK_GATE_COUNTERFACTUALS_HOLD" : "LOCK_GATE_COUNTERFACTUALS_BROKEN");
  process.exit(ok ? EXIT_OK : EXIT_VALIDATION_FAILED);
}

let tree;
try {
  tree = openSourceTree({ rev: REV });
} catch (error) {
  console.error(String(error.message));
  process.exit(EXIT_USAGE);
}
const results = [...codeChecks(tree), ...(REV ? [] : docChecks())];
print(results);
const failing = results.filter((r) => !r.pass).map((r) => r.id);
console.log(`\n${results.length - failing.length}/${results.length} passed${REV ? ` on ${tree.rev.slice(0, 12)} ([doc] checks skipped)` : ""}${failing.length ? ` · failing: ${failing.join(", ")}` : ""}`);
if (!REV) console.log(failing.length ? "GAMEPLAY_PLATFORM_LOCK_GATE_FAILED" : "GAMEPLAY_PLATFORM_LOCK_GATE_HOLDS");
process.exit(failing.length ? EXIT_VALIDATION_FAILED : EXIT_OK);
