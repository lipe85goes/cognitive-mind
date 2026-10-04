/**
 * ROUTE-C5 — the Rota's mutable session state, consolidated in one reducer, tested.
 *
 *   src/games/escape-maze/route-state.ts  `RouteRuntimeState` (every logical, mutable field of a Route session),
 *                                          `RouteStateAction` (the transitions the hook applies),
 *                                          `routeStateReducer` (pure: state + action → new state) and
 *                                          `createRouteState` (a new session, as one coherent value).
 *
 * `useEscapeMaze` holds that state with ONE `useReducer` and is still the orchestrator: it decides which transition
 * applies, in what order and with what values, generates maps, plays sounds, guards input and calls onComplete.
 * C5 is a refactor of WHERE the state lives; nothing the Route does may change. Four groups of checks:
 *
 *   [structure]    the static gate: route-state declares and exports the four names; the hook's only useState is
 *                  `routeNumber` (the session's identity), its one useReducer runs routeStateReducer, the eighteen
 *                  migrated fields come out of that state once each and have no setter or cell of their own; the
 *                  state holds no derived view and nothing kept out on purpose; route-state imports types only,
 *                  reaches nothing at run time and mentions no RNG, clock, browser, React, sound or storage; only the
 *                  hook knows it; the actions are the transitions the hook dispatches — no generic patch, no C6
 *                  event; the turn, the side effects and map generation stay in the hook.
 *   [reducer]      the reducer itself, on thousands of states built from generated maps: pure (deep-frozen inputs,
 *                  equal results twice, no global touched — Math.random, Date, window… are poisoned), never returns
 *                  its input, writes exactly the fields of its action (every other field keeps its identity), and a
 *                  new Route keeps nothing of the old one.
 *   [preserved]    the hook's public surface and its consumers, every other Rota module, every user-facing string
 *                  byte for byte, the hook's other top-level statements, and the turn itself: the hook's body with
 *                  its state writes and cell declarations taken out prints exactly as the baseline's — C5 replaced
 *                  writes and moved no decision.
 *   [equivalence]  the working tree against 74ff2dc (C4: eighteen useState cells), both loaded through the
 *                  route-module-loader, render by render — every field the hook returns, at every render — on the
 *                  runtime harness (Routes 1/2/3 × every mode × eleven scripted Explorers × two seeds, with
 *                  restart, mode change, inputs after the end, setup inputs and the next Route; three journeys
 *                  R1 → R3) and on the REAL React (react-dom from node_modules; Strict Mode development with act and
 *                  with native discrete events through the hook's own keyboard listener, production with default
 *                  and discrete updates): commits per input, component calls, completions and finalStats, sounds,
 *                  random draws, generateMaze calls and the stream after. Each item C5 must hold (initial state,
 *                  start, restart, mode change, blocked and valid moves, traps, lights, Chest pause, reward, Pickaxe,
 *                  each capture, each Second Chance, win, loss, completion, continuation, RNG, dynamicSolvability) is
 *                  its own check, over the inputs that exercise it.
 *
 * `--rev=<commit>` runs every check on that tree instead of the working tree. `--rev=74ff2dc` is the counterfactual:
 * there the state was eighteen independent useState cells and no reducer existed, so every [structure] and
 * [reducer] check must fail, while every [preserved] and [equivalence] check holds (the tree against itself).
 *
 * `--mutants` instead applies, in memory, mutations C5 must not let through (a reset forgotten, a tick counted
 * twice, the capture order swapped, the Hunter's move kept after a Second Chance, win/loss swapped, a second board
 * drawn at mount, a cell put back, a derived view stored, the RNG imported…) and requires each to be caught.
 *
 * Usage: node tools/validation/route-state-reducer-tests.mjs [--rev=<commit> | --mutants]
 * Writes nothing. Exit 0 = every check holds (every mutant caught), 1 = a check failed, 3 = usage error.
 */
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import ts from "typescript";

import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";
import { ROUTE_HOOK, ROUTE_RANDOM_SEAM, createModuleGraph, loadRouteModules, openSourceTree } from "./route-module-loader.mjs";
import { POLICIES, runInRealReact, runInShim } from "./route-react-runtime.mjs";

/** C4: the last revision whose session state was independent useState cells — what C5 must be equivalent to. */
const BASELINE = "74ff2dc3a0a926fe3b40b325771bd423a348e041";
const ROUTE_STATE = "src/games/escape-maze/route-state.ts";
const CONSUMERS = ["src/games/escape-maze/RouteStrategyGame.tsx", "src/games/escape-maze/RouteBabylonBoard.tsx"];
/** Every file C5 must not have touched: the Rota's other modules, its consumers, the engine and the shared types. */
const UNTOUCHED = [
  "src/games/escape-maze/route-config.ts", "src/games/escape-maze/route-geometry.ts", "src/games/escape-maze/route-generation.ts",
  "src/games/escape-maze/route-defenders.ts", "src/games/escape-maze/route-invariants.ts", "src/games/escape-maze/continuation.ts",
  ROUTE_RANDOM_SEAM, "src/engine/difficulty.ts", "src/engine/scoring.ts", "src/lib/game-sounds.ts", "src/types/game.ts",
  ...CONSUMERS, "src/games/escape-maze/routeBabylonScene.ts", "src/games/escape-maze/route-visual.css",
];

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const MUTANTS = args.includes("--mutants");
const REV = revArg ? revArg.slice("--rev=".length) : null;
if (args.some((arg) => arg !== revArg && arg !== "--mutants") || REV === "" || (REV && MUTANTS)) {
  console.error("usage: node tools/validation/route-state-reducer-tests.mjs [--rev=<commit> | --mutants]");
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

// --- what C5 consolidated ------------------------------------------------------------------------

/** The eighteen useState cells of 74ff2dc that were the session's mutable state — now RouteRuntimeState's fields. */
const MIGRATED = [
  "difficulty", "mazeMap", "player", "guardian", "chestOpened", "rewardSelected", "rewardSpent", "brokenWall", "sentinel",
  "collectedStars", "turns", "blockedMoves", "errors", "status", "message", "blockedShake", "moveTick", "triggeredTraps",
];
/** Kept out of the reducer on purpose, and why. */
const KEPT_OUT = {
  routeNumber: "the session's identity: fixed for its whole life (the next Route is a new session), never written",
  lastMoveInputAtRef: "the input guard's clock stamp (Date.now, MOVE_INPUT_GUARD_MS): input control, not game state",
};
/** Views computed from the state on every render. Storing any of them would be a second truth. */
const DERIVED = [
  "walls", "portalDefenceZone", "collectedSet", "triggeredTrapSet", "rewardChoicePending", "pickaxeAvailable", "pickaxeSpent",
  "secondChanceAvailable", "secondChanceSpent", "breakTargets", "totalLights", "collectedCount", "portalActive",
  "routeProgression", "score", "dynamicSolvability",
];
const ROUTE_STATE_EXPORTS = ["RouteRuntimeState", "RouteSessionStart", "RouteStateAction", "createRouteState", "routeStateReducer"];
/** The transitions, and exactly the fields each writes. Every other field keeps its identity. */
const WRITES = {
  START_ROUTE: MIGRATED,
  BLOCK_STEP: ["blockedMoves", "blockedShake", "message"],
  COUNT_TURN: ["turns", "moveTick"],
  MOVE_EXPLORER: ["player", "collectedStars", "triggeredTraps"],
  OPEN_CHEST: ["chestOpened", "message"],
  SELECT_REWARD: ["rewardSelected"],
  SPEND_SECOND_CHANCE: ["rewardSpent", "message"],
  OPEN_WALL: ["brokenWall", "rewardSpent"],
  SETTLE_DEFENDERS: ["guardian", "sentinel", "message"],
  COMMIT_CAPTURE: ["guardian", "sentinel", "errors"],
  END_ROUTE: ["status", "message"],
};
const ACTIONS = Object.keys(WRITES);
/** The orchestration that must stay in the hook (C6 will separate events; C5 moves none of it). */
const ORCHESTRATION = ["startNewMaze", "endGame", "startGame", "restartGame", "changeDifficulty", "runDefenderPhase", "tryMovePlayer", "chooseReward", "breakWall"];
const SIDE_EFFECTS = ["playGentleErrorTone", "playStoneBreak", "playSuccessChime", "onComplete", "Date.now", "generateMaze"];
/** C6's vocabulary. C5 must not anticipate it. */
const C6_WORDS = /\b(PLAYER_MOVED|TRAP_TRIGGERED|HUNTER_CAUGHT_PLAYER|SENTINEL_CAUGHT_PLAYER|ROUTE_COMPLETED|LIGHT_COLLECTED|CHEST_OPENED|DomainEvent|RouteEvent|eventBus|EventBus|emit\(|subscribe\()/;
const ALLOWED_TYPE_IMPORTS = ["@/games/escape-maze/route-defenders", "@/games/escape-maze/route-generation", "@/games/escape-maze/route-invariants", "@/types/game"];
const FORBIDDEN_IMPORT =
  /react|route-random|useEscapeMaze|babylon|game-sounds|scoring|storage|continuation|difficulty|components\/|GameScreen|RouteStrategyGame|RouteBabylonBoard|\.tsx$|^@\/app\//i;
const FORBIDDEN_MENTIONS = [
  "Math.random", "routeRandom", "randomItem", "Date", "performance", "window", "document", "localStorage", "sessionStorage", "setTimeout",
  "setInterval", "requestAnimationFrame", "fetch", "console", "useState", "useReducer", "useEffect", "React", "BABYLON", "generateMaze",
  "chooseGuardianMove", "decideSentinelMove", "computePortalDefenceZone", "createSentinelState", "playGentleErrorTone", "playStoneBreak",
  "playSuccessChime", "onComplete", "positionsEqual", "posKey", "manhattanDistance", "use client",
];

const DIFFICULTIES = ["easy", "medium", "hard"];
const SC_EXPLORER = "Segunda Chance: você resistiu e não avançou.";
const SC_DEFENDER = "Segunda Chance: você resistiu e os defensores recuaram.";

// --- small helpers -------------------------------------------------------------------------------

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sha = (value) => crypto.createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex").slice(0, 16);
const sorted = (list) => [...list].sort();
const errorOf = (fn) => {
  try {
    fn();
    return null;
  } catch (error) {
    return error.message;
  }
};
const codeOnly = (source) => source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
const prng = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
};
const pick = (rand, items) => items[Math.floor(rand() * items.length)];
const tally = (counts, label, n = 1) => {
  counts[label] = (counts[label] ?? 0) + n;
};
const parse = (file, source) =>
  ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const walk = (node, visit) => {
  visit(node);
  ts.forEachChild(node, (child) => walk(child, visit));
};

/** A module's imports, exports and top-level statements, by the parser. */
function moduleShape(file, source) {
  const sf = parse(file, source);
  const out = { imports: [], exported: [], values: [], types: [], statements: [], sideEffects: [], sf };
  for (const statement of sf.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      const named = clause?.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements : [];
      out.imports.push({
        specifier: statement.moduleSpecifier.text,
        typeOnly: Boolean(clause?.isTypeOnly) || (named.length > 0 && !clause?.name && named.every((e) => e.isTypeOnly)),
        names: named.map((e) => e.name.text),
      });
      continue;
    }
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) out.exported.push(...statement.exportClause.elements.map((e) => e.name.text));
      continue;
    }
    const exported = (ts.getModifiers?.(statement) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    let name = null;
    if (ts.isVariableStatement(statement)) {
      for (const d of statement.declarationList.declarations) {
        name ??= d.name.text;
        out.values.push(d.name.text);
        if (exported) out.exported.push(d.name.text);
      }
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      name = statement.name.text;
      out.values.push(name);
      if (exported) out.exported.push(name);
    } else if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
      name = statement.name.text;
      out.types.push(name);
      if (exported) out.exported.push(name);
    } else out.sideEffects.push(statement.getText(sf).slice(0, 80));
    out.statements.push({ name, text: statement.getFullText(sf).trim() });
  }
  return out;
}

/**
 * The hook's body, by the parser: every useState / useReducer call (with what it binds), every `set…` identifier,
 * every name declared in it, every `dispatch({ type })` with the function it sits in, every call of a side effect.
 */
function hookAnatomy(source) {
  const sf = parse(ROUTE_HOOK, source);
  const fn = sf.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === "useEscapeMaze");
  const out = { found: Boolean(fn), useState: [], useReducer: [], setters: new Set(), declared: {}, dispatches: [], effects: {}, generateMaze: [], destructuredFromState: [] };
  if (!fn) return out;
  const enclosing = (node) => {
    for (let p = node.parent; p && p !== fn; p = p.parent) {
      if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && ts.isVariableDeclaration(p.parent)) return p.parent.name.getText(sf);
      if (ts.isArrowFunction(p) && ts.isCallExpression(p.parent) && ts.isIdentifier(p.parent.expression)) {
        const callee = p.parent.expression.text;
        if (callee === "useCallback" && ts.isVariableDeclaration(p.parent.parent)) return p.parent.parent.name.getText(sf);
        if (callee === "useReducer") return "useReducer:init";
      }
    }
    return "useEscapeMaze";
  };
  const binding = (call) => {
    const decl = call.parent;
    if (!ts.isVariableDeclaration(decl)) return null;
    return ts.isArrayBindingPattern(decl.name) ? decl.name.elements.map((e) => (ts.isOmittedExpression(e) ? null : e.name.getText(sf))) : decl.name.getText(sf);
  };
  walk(fn.body, (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(sf);
      if (callee === "useState" || callee === "React.useState") out.useState.push({ binds: binding(node), arg: node.arguments.map((a) => a.getText(sf)).join(", ") });
      if (callee === "useReducer" || callee === "React.useReducer") {
        out.useReducer.push({ binds: binding(node), reducer: node.arguments[0]?.getText(sf), hasInit: node.arguments.length === 3 });
      }
      if (callee === "dispatch") {
        const arg = node.arguments[0];
        const type = arg && ts.isObjectLiteralExpression(arg)
          ? arg.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText(sf) === "type")?.initializer.getText(sf).replace(/"/g, "")
          : null;
        out.dispatches.push({ type, in: enclosing(node) });
      }
      if (callee === "generateMaze") out.generateMaze.push(enclosing(node));
      for (const effect of SIDE_EFFECTS) if (callee === effect) tally(out.effects, `${effect}@${enclosing(node)}`);
    }
    if (ts.isIdentifier(node) && /^set[A-Z]/.test(node.text)) out.setters.add(node.text);
    if (ts.isVariableDeclaration(node)) {
      const names = ts.isIdentifier(node.name)
        ? [node.name.text]
        : node.name.elements.filter((e) => !ts.isOmittedExpression(e)).map((e) => e.name.getText(sf));
      for (const name of names) tally(out.declared, name);
      if (ts.isObjectBindingPattern(node.name) && node.initializer?.getText(sf) === "state") out.destructuredFromState.push(...names);
    }
  });
  return out;
}

/** RouteRuntimeState's fields and RouteStateAction's members, by the parser. */
function stateTypes(source) {
  const sf = parse(ROUTE_STATE, source);
  const iface = sf.statements.find((s) => ts.isInterfaceDeclaration(s) && s.name.text === "RouteRuntimeState");
  const fields = iface ? iface.members.map((m) => m.name.getText(sf)) : [];
  const union = sf.statements.find((s) => ts.isTypeAliasDeclaration(s) && s.name.text === "RouteStateAction");
  const actions = [];
  const payloads = {};
  const visitMember = (node) => {
    if (ts.isTypeLiteralNode(node)) {
      const type = node.members.find((m) => m.name?.getText(sf) === "type");
      if (type) {
        const name = type.type.getText(sf).replace(/"/g, "");
        actions.push(name);
        payloads[name] = node.members.map((m) => m.name.getText(sf)).filter((n) => n !== "type");
      }
    }
    ts.forEachChild(node, visitMember);
  };
  if (union) visitMember(union.type);
  const reducer = sf.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === "routeStateReducer");
  const cases = [];
  if (reducer) walk(reducer, (n) => ts.isCaseClause(n) && cases.push(n.expression.getText(sf).replace(/"/g, "")));
  return { fields, actions, payloads, cases };
}

const stringLiterals = (file, source) => {
  const out = [];
  walk(parse(file, source), (n) => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(n.text);
    if (ts.isTemplateExpression(n)) out.push(n.getText());
  });
  return out;
};
const userFacing = (literals) => sorted(new Set(literals.filter((text) => / /.test(text) && !/^(?:@|\.\/|\s)/.test(text) && !text.includes("Error"))));

// =================================================================================================
// [structure]
// =================================================================================================

function structureChecks(tree) {
  const out = [];
  const record = (id, name, pass, detail) => out.push({ id, kind: "structure", name, pass, detail });
  const exists = tree.exists(ROUTE_STATE);
  const stateText = exists ? tree.read(ROUTE_STATE) : "";
  const state = moduleShape(ROUTE_STATE, stateText);
  const types = stateTypes(stateText);
  const hookText = tree.read(ROUTE_HOOK);
  const hook = hookAnatomy(hookText);
  const closure = tree.closure(ROUTE_HOOK);

  // S1 — route-state.ts declares and exports exactly the four names (and the session-start shape), and is in the
  // hook's run-time graph.
  record("S1", "ROUTE_STATE_MODULE_EXISTS_IN_THE_ROTA", exists && same(sorted(state.exported), sorted(ROUTE_STATE_EXPORTS)) && closure.includes(ROUTE_STATE), {
    exists,
    exports: sorted(state.exported),
    inHookGraph: closure.includes(ROUTE_STATE),
  });

  // S2 — one source of state: the hook's only useState is `routeNumber`, it has exactly one useReducer, running
  // routeStateReducer with an initialiser; the eighteen migrated fields come out of that state, once each; no setter
  // identifier is left and no migrated name is declared anywhere else in the hook.
  {
    const onlyRouteNumber = hook.useState.length === 1 && same(hook.useState[0].binds, ["routeNumber"]);
    const reducer = hook.useReducer.length === 1 && hook.useReducer[0].reducer === "routeStateReducer" && hook.useReducer[0].hasInit && same(hook.useReducer[0].binds, ["state", "dispatch"]);
    const fromState = sorted(hook.destructuredFromState);
    const declaredTwice = MIGRATED.filter((name) => (hook.declared[name] ?? 0) !== 1);
    record(
      "S2",
      "ONE_SOURCE_OF_STATE_NO_DUPLICATED_CELL",
      hook.found && onlyRouteNumber && reducer && same(fromState, sorted(MIGRATED)) && hook.setters.size === 0 && declaredTwice.length === 0,
      {
        useStateCells: hook.useState.length,
        useState: hook.useState.map((c) => c.binds),
        useReducerCells: hook.useReducer.length,
        useReducer: hook.useReducer,
        fieldsFromReducerState: fromState.length,
        missingFromState: MIGRATED.filter((name) => !fromState.includes(name)),
        settersLeft: [...hook.setters],
        declaredOtherThanOnce: Object.fromEntries(declaredTwice.map((name) => [name, hook.declared[name] ?? 0])),
      },
    );
  }

  // S3 — the state's shape: RouteRuntimeState's fields are exactly the migrated cells; it holds no derived view and
  // nothing kept out on purpose; every derived view is still computed in the hook; routeNumber and the input ref are
  // still there, outside the reducer, as they were.
  {
    const derivedStored = types.fields.filter((f) => DERIVED.includes(f));
    const keptOutStored = types.fields.filter((f) => Object.keys(KEPT_OUT).includes(f) || /lastMove|routeNumber/.test(f));
    const derivedMissing = DERIVED.filter((name) => name !== "dynamicSolvability" && (hook.declared[name] ?? 0) !== 1);
    const solvabilityComputed = /dynamicSolvability: inspectDynamicMazeState\(\{/.test(hookText);
    const routeNumberKept = /const \[routeNumber\] = useState\(normalizedInitialRouteNumber\);/.test(hookText);
    const refKept = /const lastMoveInputAtRef = useRef\(0\);/.test(hookText) && /const MOVE_INPUT_GUARD_MS = 150;/.test(hookText) &&
      /if \(now - lastMoveInputAtRef\.current < MOVE_INPUT_GUARD_MS\) return;/.test(hookText);
    record(
      "S3",
      "STATE_IS_THE_CELLS_DERIVED_STAY_DERIVED_KEPT_OUT_STAY_OUT",
      exists && same(sorted(types.fields), sorted(MIGRATED)) && derivedStored.length === 0 && keptOutStored.length === 0 &&
        derivedMissing.length === 0 && solvabilityComputed && routeNumberKept && refKept,
      {
        stateFields: types.fields,
        derivedStored,
        keptOutStored,
        derivedNotComputedInHook: derivedMissing,
        dynamicSolvabilityComputedPerRender: solvabilityComputed,
        keptOut: Object.fromEntries(Object.entries(KEPT_OUT).map(([name, why]) => [name, `${name === "routeNumber" ? routeNumberKept : refKept ? "kept" : "MISSING"} — ${why}`])),
      },
    );
  }

  // S4 — route-state is pure: type-only imports from the allowed modules, nothing forbidden, no run-time import at
  // all (its closure is itself), no top-level statement but declarations, and no mention of RNG, clock, browser,
  // React, sound, storage, map generation, defender policy or board geometry.
  {
    const specifiers = state.imports.map((imp) => imp.specifier);
    const notAllowed = specifiers.filter((s) => !ALLOWED_TYPE_IMPORTS.includes(s));
    const forbidden = specifiers.filter((s) => FORBIDDEN_IMPORT.test(s));
    const valueImports = state.imports.filter((imp) => !imp.typeOnly).map((imp) => imp.specifier);
    const code = codeOnly(stateText);
    const mentions = FORBIDDEN_MENTIONS.filter((word) => new RegExp(String.raw`(^|[^\w.])${word.replace(/\./g, "\\.")}\b`).test(code));
    const reach = exists ? tree.closure(ROUTE_STATE) : [];
    record(
      "S4",
      "ROUTE_STATE_IS_PURE_TYPES_ONLY_NO_RUNTIME_DEPENDENCY",
      exists && notAllowed.length === 0 && forbidden.length === 0 && valueImports.length === 0 && same(reach, [ROUTE_STATE]) &&
        state.sideEffects.length === 0 && mentions.length === 0,
      {
        imports: state.imports.map((imp) => `${imp.specifier}${imp.typeOnly ? " (type)" : ""}`),
        notAllowed,
        forbidden,
        valueImports,
        runtimeReach: reach,
        topLevelSideEffects: state.sideEffects,
        mentions,
      },
    );
  }

  // S5 — nobody outside the hook knows route-state: in src only the hook imports it, the hook re-exports none of it,
  // and nothing below the hook (config, geometry, generation, defenders, invariants, the seam) reaches it.
  {
    const src = (tree.rev
      ? execFileSync("git", ["ls-tree", "-r", "--name-only", tree.rev, "src"], { encoding: "utf8" })
      : execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "src"], { encoding: "utf8" }))
      .split("\n")
      .filter((file) => /\.(ts|tsx)$/.test(file) && tree.exists(file));
    const importers = src.filter((file) => file !== ROUTE_STATE && /route-state["']/.test(tree.read(file)));
    const hookShape = moduleShape(ROUTE_HOOK, hookText);
    const reexported = hookShape.exported.filter((name) => ROUTE_STATE_EXPORTS.includes(name));
    const below = UNTOUCHED.filter((file) => file.endsWith(".ts") && tree.exists(file) && tree.closure(file).includes(ROUTE_STATE));
    record("S5", "ONLY_THE_HOOK_KNOWS_ROUTE_STATE", exists && same(importers, [ROUTE_HOOK]) && reexported.length === 0 && below.length === 0, {
      sourceModulesScanned: src.length,
      importedBy: importers,
      reexportedByHook: reexported,
      modulesBelowThatReachIt: below,
    });
  }

  // S6 — the actions are the hook's transitions: the union, the reducer's cases and what the hook dispatches are the
  // same eleven, each dispatched; START_ROUTE is the only one that rebuilds the state (createRouteState) — no generic
  // patch spreads an action into the state; no C6 vocabulary anywhere in src/games.
  {
    const dispatched = sorted(new Set(hook.dispatches.map((d) => d.type)));
    const spreadsAction = /\.\.\.action\b/.test(codeOnly(stateText));
    const patchPayload = Object.entries(types.payloads).filter(([, keys]) => keys.some((k) => /patch|changes|partial|value|fields/i.test(k)));
    const c6 = [ROUTE_HOOK, ROUTE_STATE].filter((file) => tree.exists(file) && C6_WORDS.test(codeOnly(tree.read(file))));
    const sites = {};
    for (const d of hook.dispatches) (sites[d.in] ??= []).push(d.type);
    record(
      "S6",
      "ACTIONS_ARE_THE_HOOKS_TRANSITIONS_NOT_PATCHES_NOT_EVENTS",
      exists && same(sorted(types.actions), sorted(ACTIONS)) && same(sorted(types.cases), sorted(ACTIONS)) && same(dispatched, sorted(ACTIONS)) &&
        !spreadsAction && patchPayload.length === 0 && c6.length === 0 && /case "START_ROUTE":\s*return createRouteState\(action\);/.test(stateText),
      {
        unionMembers: types.actions,
        reducerCases: types.cases,
        dispatchedByHook: dispatched,
        payloads: types.payloads,
        dispatchSites: sites,
        genericPatch: spreadsAction || patchPayload.map(([name]) => name),
        c6Vocabulary: c6,
      },
    );
  }

  // S7 — the turn and its effects stay in the hook: every orchestration function is declared in its body; every
  // sound, onComplete, the clock and map generation are called there, in the same functions as before (counted against
  // the baseline's own anatomy); route-state's code names none of them.
  {
    const base = hookAnatomy(openSourceTree({ rev: BASELINE }).read(ROUTE_HOOK));
    const missing = ORCHESTRATION.filter((name) => (hook.declared[name] ?? 0) !== 1);
    const leaked = ORCHESTRATION.filter((name) => new RegExp(String.raw`\b${name}\b`).test(codeOnly(stateText)));
    const effectsNow = Object.fromEntries(Object.entries(hook.effects).filter(([k]) => !k.startsWith("generateMaze")));
    const effectsBase = Object.fromEntries(Object.entries(base.effects).filter(([k]) => !k.startsWith("generateMaze")));
    // Map generation: twice in the hook's text, exactly where the baseline drew (the mount's initialiser — a useState
    // initialiser there, the reducer's here — and startNewMaze), never in route-state.
    const generationSites = sorted(hook.generateMaze);
    record(
      "S7",
      "TURN_EFFECTS_AND_GENERATION_STAY_IN_THE_HOOK",
      hook.found && missing.length === 0 && leaked.length === 0 && same(effectsNow, effectsBase) && same(generationSites, ["startNewMaze", "useReducer:init"]),
      {
        orchestrationMissing: missing,
        orchestrationNamedInRouteState: leaked,
        sideEffectCallSites: effectsNow,
        sameSitesAsBaseline: same(effectsNow, effectsBase),
        generateMazeCalledIn: generationSites,
        baselineGenerateMazeCalledIn: sorted(base.generateMaze),
      },
    );
  }

  // S8 — the cells, counted: what the baseline had and what is left. Fails while the hook still holds its state in
  // independent cells (the counterfactual) — the static gate against going back.
  {
    const base = hookAnatomy(openSourceTree({ rev: BASELINE }).read(ROUTE_HOOK));
    record(
      "S8",
      "STATE_CELLS_CONSOLIDATED",
      hook.useState.length === 1 && hook.useReducer.length === 1 && base.useState.length === MIGRATED.length + 1 && base.useReducer.length === 0,
      {
        baseline: { useState: base.useState.length, useReducer: base.useReducer.length, setters: base.setters.size },
        now: { useState: hook.useState.length, useReducer: hook.useReducer.length, setters: hook.setters.size },
      },
    );
  }
  return out;
}

// =================================================================================================
// [reducer]
// =================================================================================================

const deepFreeze = (value, seen = new Set()) => {
  if (value === null || typeof value !== "object" || seen.has(value) || Object.isFrozen(value)) return value;
  seen.add(value);
  if (value instanceof Set) {
    for (const v of value) deepFreeze(v, seen);
    // A frozen Set can still be mutated through its methods: make them throw.
    for (const m of ["add", "delete", "clear"]) Object.defineProperty(value, m, { value: () => { throw new Error(`Set.${m} on a frozen input`); } });
  } else for (const v of Object.values(value)) deepFreeze(v, seen);
  return Object.freeze(value);
};
const snapshotOf = (value) => JSON.stringify(value, (_k, v) => (v instanceof Set ? { $set: [...v] } : v));

function reducerChecks(tree) {
  const out = [];
  const record = (id, name, pass, detail) => out.push({ id, kind: "reducer", name, pass, detail });
  if (!tree.exists(ROUTE_STATE)) {
    for (const [id, name] of [["R1", "REDUCER_IS_PURE_AND_DETERMINISTIC"], ["R2", "EACH_ACTION_WRITES_EXACTLY_ITS_FIELDS"], ["R3", "A_NEW_ROUTE_KEEPS_NOTHING_OF_THE_OLD"], ["R4", "NO_GLOBAL_TOUCHED"]]) {
      record(id, name, false, { routeState: "absent — the state is still independent useState cells" });
    }
    return out;
  }
  // The reducer in a realm where every ambient capability is poisoned: no clock, no RNG, no browser, no console, no
  // timers. Touching any of them throws, so a corpus that runs clean proves none was touched.
  const touched = [];
  const poison = (name) => new Proxy(function poisoned() {}, {
    get: (_t, key) => {
      touched.push(`${name}.${String(key)}`);
      throw new Error(`route-state touched ${name}.${String(key)}`);
    },
    apply: () => {
      touched.push(`${name}()`);
      throw new Error(`route-state called ${name}`);
    },
    construct: () => {
      touched.push(`new ${name}`);
      throw new Error(`route-state constructed ${name}`);
    },
  });
  const graph = createModuleGraph({
    tree,
    globals: { Math: poison("Math"), Date: poison("Date"), performance: poison("performance"), crypto: poison("crypto") },
  });
  const mod = graph.require(ROUTE_STATE);
  const loadedModules = graph.modules().map((m) => m.file);
  const { routeStateReducer, createRouteState } = mod;

  // States built from real maps, both shapes of every field. Maps come from the Rota's own generation (another graph).
  const rota = loadRouteModules({ tree, surface: ["generateMaze", "computePortalDefenceZone", "createSentinelState"] });
  const rand = prng(5_550_005);
  const maps = [];
  for (const routeNumber of [1, 2, 3]) {
    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < 3; i += 1) {
        rota.setSeed(55_000 + routeNumber * 100 + DIFFICULTIES.indexOf(difficulty) * 10 + i);
        const map = rota.api.generateMaze(difficulty, routeNumber);
        const sentinel = rota.api.createSentinelState(map, rota.api.computePortalDefenceZone(map.playerStart, map.exitPosition, map.walls));
        maps.push({ map, sentinel, difficulty });
      }
    }
  }
  const cell = () => ({ row: Math.floor(rand() * 9), col: Math.floor(rand() * 9) });
  const key = (c) => `${c.row},${c.col}`;
  const randomState = ({ map, sentinel, difficulty }) => ({
    ...createRouteState({ difficulty, mazeMap: map, sentinel, status: pick(rand, ["setup", "playing", "won", "lost"]), message: `m${Math.floor(rand() * 9)}` }),
    player: cell(),
    guardian: cell(),
    sentinel: { position: cell(), target: rand() < 0.5 ? null : cell(), commitLeft: Math.floor(rand() * 4) },
    collectedStars: map.collectibleStars.filter(() => rand() < 0.5).map(key),
    triggeredTraps: map.traps.filter(() => rand() < 0.5).map(key),
    turns: Math.floor(rand() * 60),
    blockedMoves: Math.floor(rand() * 9),
    errors: Math.floor(rand() * 3),
    blockedShake: Math.floor(rand() * 9),
    moveTick: Math.floor(rand() * 60),
    chestOpened: rand() < 0.5,
    rewardSelected: pick(rand, [null, "pickaxe", "second-chance"]),
    rewardSpent: rand() < 0.5,
    brokenWall: rand() < 0.5 ? null : pick(rand, [...map.walls]),
  });
  const randomAction = (type, source) => {
    switch (type) {
      case "START_ROUTE": {
        const fresh = pick(rand, maps);
        return { type, difficulty: pick(rand, DIFFICULTIES), mazeMap: fresh.map, sentinel: fresh.sentinel, status: pick(rand, ["setup", "playing"]), message: "start" };
      }
      case "BLOCK_STEP": return { type, message: pick(rand, ["Parede no caminho. A Picareta pode abri-la.", "Caminho bloqueado. Escolha outra direção."]) };
      case "COUNT_TURN": return { type, turns: Math.floor(rand() * 80) };
      case "MOVE_EXPLORER": return { type, player: cell(), collectedStars: rand() < 0.5 ? source.collectedStars : [...source.collectedStars, "x"], armedTrap: rand() < 0.5 ? null : key(cell()) };
      case "OPEN_CHEST": return { type, message: "Baú encontrado. Escolha a sua ferramenta." };
      case "SELECT_REWARD": return { type, reward: pick(rand, ["pickaxe", "second-chance"]) };
      case "SPEND_SECOND_CHANCE": return { type, message: pick(rand, [SC_EXPLORER, SC_DEFENDER]) };
      case "OPEN_WALL": return { type, wall: key(cell()) };
      case "SETTLE_DEFENDERS": return { type, guardian: cell(), sentinel: { position: cell(), target: null, commitLeft: 2 }, message: "calm" };
      case "COMMIT_CAPTURE": return { type, guardian: cell(), sentinel: rand() < 0.5 ? source.sentinel : { position: cell(), target: null, commitLeft: 1 }, errors: Math.floor(rand() * 4) };
      case "END_ROUTE": return { type, status: pick(rand, ["won", "lost"]), message: "end" };
      default: throw new Error(type);
    }
  };
  /** What each action must produce, field by field — the writer table as a function. */
  const expected = (state, action) => {
    switch (action.type) {
      case "START_ROUTE": return null; // R3
      case "BLOCK_STEP": return { blockedMoves: state.blockedMoves + 1, blockedShake: state.blockedShake + 1, message: action.message };
      case "COUNT_TURN": return { turns: action.turns, moveTick: state.moveTick + 1 };
      case "MOVE_EXPLORER": return { player: action.player, collectedStars: action.collectedStars, triggeredTraps: action.armedTrap === null ? state.triggeredTraps : [...state.triggeredTraps, action.armedTrap] };
      case "OPEN_CHEST": return { chestOpened: true, message: action.message };
      case "SELECT_REWARD": return { rewardSelected: action.reward };
      case "SPEND_SECOND_CHANCE": return { rewardSpent: true, message: action.message };
      case "OPEN_WALL": return { brokenWall: action.wall, rewardSpent: true };
      case "SETTLE_DEFENDERS": return { guardian: action.guardian, sentinel: action.sentinel, message: action.message };
      case "COMMIT_CAPTURE": return { guardian: action.guardian, sentinel: action.sentinel, errors: action.errors };
      case "END_ROUTE": return { status: action.status, message: action.message };
      default: return undefined;
    }
  };

  const purity = [];
  const writes = [];
  const fresh = [];
  let calls = 0;
  const perAction = {};
  for (let n = 0; n < 2400; n += 1) {
    const source = randomState(pick(rand, maps));
    const type = ACTIONS[n % ACTIONS.length];
    const action = randomAction(type, source);
    const before = snapshotOf(source);
    const actionBefore = snapshotOf(action);
    // Two independent copies of the same input, the first deep-frozen: equal results, no mutation, no throw.
    const twin = JSON.parse(before, (_k, v) => (v && typeof v === "object" && Array.isArray(v.$set) ? new Set(v.$set) : v));
    deepFreeze(source);
    deepFreeze(action);
    let result;
    let again;
    const threw = errorOf(() => {
      result = routeStateReducer(source, action);
      again = routeStateReducer(twin, { ...action });
    });
    calls += 2;
    tally(perAction, type);
    if (threw || snapshotOf(source) !== before || snapshotOf(action) !== actionBefore || snapshotOf(result) !== snapshotOf(again)) {
      if (purity.length < 5) purity.push({ type, threw, mutated: snapshotOf(source) !== before, deterministic: snapshotOf(result) === snapshotOf(again) });
      continue;
    }
    if (result === source) {
      if (writes.length < 5) writes.push({ type, problem: "returned its input" });
      continue;
    }
    if (type === "START_ROUTE") {
      const want = createRouteState(action);
      const leaks = MIGRATED.filter((f) => snapshotOf(result[f]) !== snapshotOf(want[f]));
      const sharedArrays = ["collectedStars", "triggeredTraps"].filter((f) => result[f] === source[f]);
      const pieces = result.player === action.mazeMap.playerStart && result.guardian === action.mazeMap.guardianStart && result.sentinel === action.sentinel && result.mazeMap === action.mazeMap;
      if ((leaks.length || sharedArrays.length || !pieces || Object.keys(result).length !== MIGRATED.length) && fresh.length < 5) fresh.push({ leaks, sharedArrays, pieces });
      continue;
    }
    const want = expected(source, action);
    const keys = Object.keys(result);
    const bad = [];
    if (!same(sorted(keys), sorted(MIGRATED))) bad.push("field set changed");
    for (const field of MIGRATED) {
      if (WRITES[type].includes(field)) {
        const value = want[field];
        const identity = typeof value === "object" && value !== null && !(field === "triggeredTraps" && action.armedTrap !== null);
        if (identity ? result[field] !== value : snapshotOf(result[field]) !== snapshotOf(value)) bad.push(`${field} not as written`);
        if (field === "triggeredTraps" && action.armedTrap !== null && result[field] === source[field]) bad.push("traps array mutated in place");
      } else if (result[field] !== source[field]) bad.push(`${field} not kept by identity`);
    }
    if (bad.length && writes.length < 5) writes.push({ type, bad });
  }
  record("R1", "REDUCER_IS_PURE_AND_DETERMINISTIC", purity.length === 0 && calls >= 4800, {
    calls,
    perAction,
    statesFromMaps: maps.length,
    violations: purity,
  });
  record("R2", "EACH_ACTION_WRITES_EXACTLY_ITS_FIELDS", writes.length === 0, {
    writes: Object.fromEntries(Object.entries(WRITES).map(([type, fields]) => [type, type === "START_ROUTE" ? "every field (a new session)" : fields])),
    neverReturnsItsInput: !writes.some((w) => w.problem),
    violations: writes,
  });
  record("R3", "A_NEW_ROUTE_KEEPS_NOTHING_OF_THE_OLD", fresh.length === 0 && perAction.START_ROUTE > 100, {
    newRoutesFromDirtyStates: perAction.START_ROUTE,
    violations: fresh,
  });
  record("R4", "NO_GLOBAL_TOUCHED", touched.length === 0 && same(loadedModules, [ROUTE_STATE]), {
    poisoned: ["Math", "Date", "performance", "crypto", "and every browser global (absent from the realm)"],
    touched: [...new Set(touched)],
    modulesLoaded: loadedModules,
  });
  return out;
}

// =================================================================================================
// [preserved]
// =================================================================================================

/**
 * The hook's body with its state taken out: every write (a `set…` call up to C4, a `dispatch` since), every cell
 * declaration (useState / useReducer, and the destructuring of the reducer's state) but `routeNumber`'s, and every
 * `if` that only guarded writes — printed without comments, so formatting cannot differ. What is left is the turn:
 * every condition, every computation, every call (sounds, onComplete, generateMaze, the defenders' policies), every
 * return, in order. C5 may only have changed how state is written, so this must be the baseline's, character for
 * character.
 */
function turnSkeleton(source) {
  const sf = parse(ROUTE_HOOK, source);
  const fn = sf.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === "useEscapeMaze");
  if (!fn) return null;
  const isWrite = (n) =>
    ts.isExpressionStatement(n) && ts.isCallExpression(n.expression) && ts.isIdentifier(n.expression.expression) &&
    (/^set[A-Z]/.test(n.expression.expression.text) || n.expression.expression.text === "dispatch");
  const isCell = (n) =>
    ts.isVariableStatement(n) &&
    n.declarationList.declarations.every((d) => {
      const init = d.initializer;
      if (init && ts.isIdentifier(init) && init.text === "state" && ts.isObjectBindingPattern(d.name)) return true;
      if (!init || !ts.isCallExpression(init) || !ts.isIdentifier(init.expression)) return false;
      if (init.expression.text === "useReducer") return true;
      const routeNumber = ts.isArrayBindingPattern(d.name) && d.name.elements.length === 1 && d.name.elements[0].name?.text === "routeNumber";
      return init.expression.text === "useState" && !routeNumber;
    });
  const removed = { writes: 0, cells: 0, guards: 0 };
  const result = ts.transform(fn, [
    (ctx) => (root) => {
      const visit = (node) => {
        if (isWrite(node)) return (removed.writes += 1), undefined;
        if (isCell(node)) return (removed.cells += 1), undefined;
        const out = ts.visitEachChild(node, visit, ctx);
        if (ts.isIfStatement(out) && !out.elseStatement && ts.isBlock(out.thenStatement) && out.thenStatement.statements.length === 0) {
          removed.guards += 1;
          return undefined;
        }
        return out;
      };
      return ts.visitNode(root, visit);
    },
  ]);
  return { text: ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified, result.transformed[0], sf), removed };
}

function preservedChecks(tree) {
  const out = [];
  const record = (id, name, pass, detail) => out.push({ id, kind: "preserved", name, pass, detail });
  const base = openSourceTree({ rev: BASELINE });
  const hookNow = moduleShape(ROUTE_HOOK, tree.read(ROUTE_HOOK));
  const hookBase = moduleShape(ROUTE_HOOK, base.read(ROUTE_HOOK));

  // P1 — the hook's public surface, by the parser, and the product's consumers: same exports, consumers byte for byte.
  {
    const consumers = CONSUMERS.map((file) => ({ file, unchanged: tree.read(file) === base.read(file) }));
    record("P1", "PUBLIC_SURFACE_AND_CONSUMERS_UNCHANGED", same(sorted(hookNow.exported), sorted(hookBase.exported)) && consumers.every((c) => c.unchanged), {
      hookExports: sorted(hookNow.exported),
      consumers,
    });
  }
  // P2 — nothing else moved.
  {
    const touched = UNTOUCHED.filter((file) => (tree.exists(file) ? tree.read(file) : null) !== (base.exists(file) ? base.read(file) : null));
    record("P2", "EVERY_OTHER_ROTA_MODULE_UNTOUCHED", touched.length === 0, { compared: UNTOUCHED.length, touched });
  }
  // P3 — every string of the baseline hook is still in the hook, and the user-facing ones are exactly the baseline's:
  // no copy changed, none added, none moved out (route-state holds no message).
  {
    const now = stringLiterals(ROUTE_HOOK, tree.read(ROUTE_HOOK));
    const was = stringLiterals(ROUTE_HOOK, base.read(ROUTE_HOOK));
    const lost = sorted(new Set(was.filter((text) => !now.includes(text))));
    const copyNow = userFacing(now);
    const copyWas = userFacing(was);
    const stateCopy = tree.exists(ROUTE_STATE) ? userFacing(stringLiterals(ROUTE_STATE, tree.read(ROUTE_STATE))) : [];
    record("P3", "EVERY_STRING_BYTE_FOR_BYTE", lost.length === 0 && same(copyNow, copyWas) && stateCopy.length === 0, {
      baselineLiterals: was.length,
      lost,
      userFacingStrings: copyWas.length,
      added: copyNow.filter((t) => !copyWas.includes(t)),
      removed: copyWas.filter((t) => !copyNow.includes(t)),
      copyInRouteState: stateCopy,
      digest: sha(copyNow),
    });
  }
  // P4 — the hook's top level is the baseline's but for the hook itself and one pure helper: every other statement,
  // leading comments included, is byte for byte the baseline's, in order.
  {
    const expected = hookBase.statements.filter((s) => s.name !== "useEscapeMaze").map((s) => s.text);
    const now = hookNow.statements.filter((s) => s.name !== "useEscapeMaze" && s.name !== "sentinelPostOn").map((s) => s.text);
    const added = hookNow.statements.filter((s) => !hookBase.statements.some((b) => b.name === s.name)).map((s) => s.name);
    record("P4", "HOOK_TOP_LEVEL_OTHERWISE_UNCHANGED", same(now, expected) && added.every((name) => name === "sentinelPostOn"), {
      statements: hookNow.statements.length,
      baselineStatements: hookBase.statements.length,
      newTopLevel: added,
      changed: expected.filter((t) => !now.includes(t)).map((t) => t.split("\n").find((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))?.slice(0, 70)),
    });
  }
  // P5 — the turn is the baseline's, decision for decision: the hook's body with every state write, every cell
  // declaration and every write-only guard taken out (turnSkeleton) prints identically on both trees — the same
  // conditions in the same order (Hunter before Sentinel, capture before Second Chance, the Chest's pause before the
  // defenders), the same computations, sounds, onComplete, generateMaze calls and returns. C5 replaced writes; it moved
  // no decision.
  {
    const now = turnSkeleton(tree.read(ROUTE_HOOK));
    const was = turnSkeleton(base.read(ROUTE_HOOK));
    const a = now?.text.split("\n") ?? [];
    const b = was?.text.split("\n") ?? [];
    const line = a.findIndex((text, i) => text !== b[i]);
    record("P5", "TURN_UNCHANGED_BUT_FOR_ITS_WRITES", Boolean(now && was) && now.text === was.text, {
      skeletonChars: now?.text.length,
      removedNow: now?.removed,
      removedAtBaseline: was?.removed,
      firstDifference: now?.text === was?.text ? null : { line, now: a.slice(line, line + 3), baseline: b.slice(line, line + 3) },
      digest: now ? sha(now.text) : null,
    });
  }
  return out;
}

// =================================================================================================
// [equivalence]
// =================================================================================================

/** Scripted sessions on the runtime harness: Routes × modes × Explorers × seeds, plus three journeys. */
function harnessScenarios() {
  const scenarios = [];
  for (const routeNumber of [1, 2, 3]) {
    for (const [d, difficulty] of DIFFICULTIES.entries()) {
      for (const [p, policy] of POLICIES.entries()) {
        // A Sentinel capture with the charge in hand is rare (the Hunter usually gets there first), so the bait
        // Explorer gets more Routes, as in C3.
        for (const offset of policy === "sc-bait" ? [0, 1, 2, 3, 4, 5, 6, 7] : [0, 1]) {
          const seed = 610_000 + routeNumber * 1000 + d * 100 + p * 10 + offset;
          const continuing = offset % 2 === 1;
          const otherMode = DIFFICULTIES[(d + 1) % 3];
          scenarios.push({
            name: `R${routeNumber}/${difficulty}/${policy}/${offset}`,
            seed,
            routeNumber,
            // Two ways in: a fresh entry that picks the mode on the setup screen, and a continuation that arrives on it.
            ...(continuing ? { initialDifficulty: difficulty } : difficulty !== "easy" ? { changeDifficulty: difficulty } : {}),
            steps: [
              ["play", 220, { policy }],
              ["move", { row: -1, col: 0 }],
              ["move", { row: 0, col: 1 }],
              ["restart"],
              ["play", 14, { policy }],
              ["changeDifficulty", otherMode],
              ["move", { row: 0, col: -1 }],
              ["start"],
              ["play", 10, { policy: policy === "lose" ? "win" : "lose" }],
              ["next", seed + 1],
              ["play", 14, { policy }],
            ],
          });
        }
      }
    }
  }
  for (const [d, difficulty] of DIFFICULTIES.entries()) {
    scenarios.push({
      name: `journey/${difficulty}`,
      seed: 620_000 + d,
      routeNumber: 1,
      ...(difficulty !== "easy" ? { changeDifficulty: difficulty } : {}),
      steps: [["play", 220, { policy: "sc-portal" }], ["next", 620_100 + d], ["play", 220, { policy: "win" }], ["next", 620_200 + d], ["play", 220, { policy: "pickaxe" }], ["next", 620_300 + d], ["play", 220, { policy: "win" }]],
    });
  }
  return scenarios;
}

/** Sessions for the real React: fewer, with keys through the hook's own listener where the regime allows. */
function reactScenarios({ keys }) {
  return [
    { name: "R1/easy/win+next", seed: 701_001, routeNumber: 1, steps: [["play", 160, { policy: "win", keys }], ["key", "ArrowUp", { repeat: true }], ["next", 701_101], ["play", 40, { policy: "lose", keys }]] },
    { name: "R2/medium/pickaxe-bump", seed: 701_002, routeNumber: 2, changeDifficulty: "medium", steps: [["play", 160, { policy: "pickaxe-bump", keys }], ["restart"], ["play", 12, { policy: "bump", keys }]] },
    { name: "R3/hard/chest-wait", seed: 701_003, routeNumber: 3, changeDifficulty: "hard", steps: [["play", 160, { policy: "chest-wait", keys }], ["changeDifficulty", "easy"], ["start"], ["play", 20, { policy: "traps", keys }]] },
    { name: "R1/hard/sc-hunter", seed: 701_004, routeNumber: 1, initialDifficulty: "hard", steps: [["play", 160, { policy: "sc-hunter", keys }], ["next", 701_104], ["play", 30, { policy: "win", keys }]] },
    { name: "R2/easy/sc-sentinel", seed: 701_005, routeNumber: 2, steps: [["play", 160, { policy: "sc-sentinel", keys }]] },
    { name: "R3/medium/setup", seed: 701_006, routeNumber: 3, initialDifficulty: "medium", autoStart: false, steps: [["move", { row: 0, col: 1 }], ["key", "ArrowLeft"], ["start"], ["play", 60, { policy: "sc-bait", keys }]] },
    { name: "R2/hard/traps", seed: 701_007, routeNumber: 2, changeDifficulty: "hard", steps: [["play", 160, { policy: "traps", keys }], ["next", 701_107], ["play", 40, { policy: "sc-portal", keys }]] },
    { name: "R3/easy/pickaxe+journey-end", seed: 701_008, routeNumber: 3, steps: [["play", 160, { policy: "pickaxe", keys }], ["next", 701_108], ["play", 160, { policy: "win", keys }], ["next", 701_208]] },
  ];
}

const REACT_CONFIGS = [
  { label: "development · StrictMode · act", nodeEnv: "development", strict: true, regime: "act", keys: true },
  { label: "development · StrictMode · discrete events", nodeEnv: "development", strict: true, regime: "discrete", keys: true },
  { label: "production · default updates", nodeEnv: "production", strict: false, regime: "default", keys: false },
  { label: "production · discrete events", nodeEnv: "production", strict: false, regime: "discrete", keys: true },
];

/**
 * Every input of every session, classified by what it did to the state (read off the tree under test's own renders;
 * the baseline must then have rendered exactly the same), with whether that input was identical on both trees.
 */
function classify(now, base, api) {
  const items = {};
  const add = (label, ok, where) => {
    items[label] ??= { inputs: 0, identical: 0, first: null };
    items[label].inputs += 1;
    if (ok) items[label].identical += 1;
    else items[label].first ??= where;
  };
  const at = (c, a) => c && a && c.row === a.row && c.col === a.col;
  const set = (v) => new Set(v?.$set ?? []);
  now.forEach((session, s) => {
    const other = base[s];
    let c = 0;
    let previous = null;
    session.steps.forEach((step, i) => {
      const commits = session.commits.slice(c, c + (step.commits ?? 0));
      const otherCommits = other?.commits.slice(c, c + (step.commits ?? 0)) ?? [];
      c += step.commits ?? 0;
      const ok = same(step, other?.steps[i]) && same(commits, otherCommits);
      const where = `${session.scenario}#${i}:${step.label}`;
      const after = commits.at(-1) ?? previous;
      const before = previous;
      const label = step.label;
      const input = /^(step|move|key:Arrow)/.test(label);
      add("ANY", ok, where);
      if (label === "mount") add("mount", ok, where);
      if (label === "next") add("continuation", ok, where);
      if (label === "start") add("start", ok, where);
      if (label === "restart") add("restart", ok, where);
      if (label.startsWith("changeDifficulty")) add("changeDifficulty", ok, where);
      if (step.effects?.some((e) => e.startsWith("onComplete"))) add("completion", ok, where);
      if (step.generations) add("generateMaze", ok, where);
      if (before && after) {
        if (input && after.blockedMoves === before.blockedMoves + 1) add(after.message === "Parede no caminho. A Picareta pode abri-la." ? "blocked:pickaxe-hint" : "blocked", ok, where);
        if (input && step.commits === 0) add(before.rewardChoicePending ? "chestPause:frozen-input" : before.status !== "playing" ? "input-outside-play" : "input-ignored", ok, where);
        if (input && after.turns === before.turns + 1 && after.status === "playing" && !at(after.player, before.player)) add("validMove", ok, where);
        if (after.trapsTriggered > before.trapsTriggered) add("trap", ok, where);
        if (after.collectedCount > before.collectedCount) add("light", ok, where);
        if (!before.chestOpened && after.chestOpened) add("chestPause:opened", ok, where);
        if (label === "choose") add(`reward:${after.rewardSelected}`, ok, where);
        if (label === "break" || label === "key:Enter") add(after.brokenWall !== before.brokenWall ? "pickaxe:wall-opened" : "pickaxe:refused", ok, where);
        if (after.message === SC_EXPLORER && before.message !== SC_EXPLORER) add("secondChance:explorer", ok, where);
        if (after.message === SC_DEFENDER && before.message !== SC_DEFENDER) {
          // Who stepped in? Re-ask the Sentinel (pure, no RNG) from the state the rollback restored: if its move does
          // not land on the Explorer, the Hunter's did; if it does and the Hunter could not reach, it was the Sentinel.
          const held = { position: after.sentinel, target: after.sentinelTarget, commitLeft: after.sentinelCommitLeft };
          const zone = { ...after.portalDefenceZone, zoneKeys: set(after.portalDefenceZone.zoneKeys) };
          const sentinelMove = api.decideSentinelMove(held, after.player, after.mazeMap.exitPosition, set(after.walls), zone, 3, set(after.triggeredTrapSet)).position;
          const hunterCanReach = Math.abs(after.guardian.row - after.player.row) + Math.abs(after.guardian.col - after.player.col) <= 1;
          add(!at(sentinelMove, after.player) ? "secondChance:hunter" : !hunterCanReach ? "secondChance:sentinel" : "secondChance:either", ok, where);
        }
        if (after.status === "won" && before.status === "playing") add("win", ok, where);
        if (after.status === "lost" && before.status === "playing") {
          const ownStep = input && (at(after.player, before.guardian) || at(after.player, before.sentinel)) && at(after.guardian, before.guardian) && at(after.sentinel, before.sentinel);
          add("loss", ok, where);
          add(ownStep ? "capture:explorer-stepped-in" : at(after.sentinel, after.player) && !at(after.sentinel, before.sentinel) ? "capture:sentinel" : at(after.guardian, after.player) ? "capture:hunter" : "capture:other", ok, where);
        }
      }
      if (commits.length) previous = commits.at(-1);
    });
  });
  return items;
}

/** A diff's first position, for a report. */
function firstDiff(now, base) {
  for (const [i, r] of now.entries()) {
    const b = base[i];
    if (same(r, b)) continue;
    const commit = r.commits.findIndex((c, n) => !same(c, b?.commits[n]));
    const step = r.steps.findIndex((s, n) => !same(s, b?.steps[n]));
    const field = commit >= 0 ? Object.keys(r.commits[commit]).find((k) => !same(r.commits[commit][k], b?.commits[commit]?.[k])) : null;
    return { scenario: r.scenario, commit, field, step, stepLabel: r.steps[step]?.label };
  }
  return null;
}

let baselineCache = null;
async function equivalenceChecks({ rev = null, sourceOverrides, react = true } = {}) {
  const out = [];
  const record = (id, name, pass, detail) => out.push({ id, kind: "equivalence", name, pass, detail });
  const scenarios = harnessScenarios();
  const now = await runInShim({ rev, sourceOverrides, scenarios });
  // The baseline's run is the same for every tree compared (the mutants reuse it).
  baselineCache ??= await runInShim({ rev: BASELINE, scenarios });
  const base = baselineCache;
  const api = loadRouteModules({ rev, sourceOverrides, surface: ["decideSentinelMove"] }).api;
  const items = classify(now, base, api);
  const holds = (label, min = 1) => items[label] && items[label].inputs >= min && items[label].identical === items[label].inputs;
  const commits = now.reduce((sum, r) => sum + r.commits.length, 0);
  const report = (labels) => Object.fromEntries(labels.map((l) => [l, items[l] ? `${items[l].identical}/${items[l].inputs}${items[l].first ? ` first diff ${items[l].first}` : ""}` : "never exercised"]));

  // E1 — everything, render by render: every committed render of every session, every field the hook returns.
  record("E1", "EVERY_RENDER_IDENTICAL", same(now, base) && commits > 9000, {
    sessions: now.length,
    rendersCompared: commits,
    inputs: items.ANY?.inputs,
    fieldsPerRender: Object.keys(now[0]?.commits[0] ?? {}).length,
    digest: sha(now),
    firstDiff: firstDiff(now, base),
  });
  // Each item C5 must hold, over the inputs that exercise it.
  const itemChecks = [
    ["E2", "INITIAL_STATE_IDENTICAL", ["mount"], () => holds("mount", 9)],
    ["E3", "START_IDENTICAL", ["start"], () => holds("start", 9)],
    ["E4", "RESTART_IDENTICAL_NOTHING_LEAKS", ["restart"], () => holds("restart", 9)],
    ["E5", "DIFFICULTY_CHANGE_IDENTICAL", ["changeDifficulty"], () => holds("changeDifficulty", 9)],
    ["E6", "BLOCKED_MOVE_IDENTICAL", ["blocked", "blocked:pickaxe-hint"], () => holds("blocked") && holds("blocked:pickaxe-hint")],
    ["E7", "VALID_MOVE_IDENTICAL", ["validMove"], () => holds("validMove", 100)],
    ["E8", "TRAP_IDENTICAL", ["trap"], () => holds("trap")],
    ["E9", "LIGHT_IDENTICAL", ["light"], () => holds("light")],
    ["E10", "CHEST_PAUSE_IDENTICAL", ["chestPause:opened", "chestPause:frozen-input"], () => holds("chestPause:opened") && holds("chestPause:frozen-input")],
    ["E11", "REWARD_CHOICE_IDENTICAL", ["reward:pickaxe", "reward:second-chance"], () => holds("reward:pickaxe") && holds("reward:second-chance")],
    ["E12", "PICKAXE_IDENTICAL", ["pickaxe:wall-opened"], () => holds("pickaxe:wall-opened")],
    ["E13", "HUNTER_CAPTURE_IDENTICAL", ["capture:hunter"], () => holds("capture:hunter")],
    ["E14", "SENTINEL_CAPTURE_IDENTICAL", ["capture:sentinel"], () => holds("capture:sentinel")],
    ["E15", "EXPLORER_STEPS_INTO_A_DEFENDER_IDENTICAL", ["capture:explorer-stepped-in"], () => holds("capture:explorer-stepped-in")],
    ["E16", "SECOND_CHANCE_EXPLORER_IDENTICAL", ["secondChance:explorer"], () => holds("secondChance:explorer")],
    ["E17", "SECOND_CHANCE_HUNTER_IDENTICAL", ["secondChance:hunter"], () => holds("secondChance:hunter")],
    ["E18", "SECOND_CHANCE_SENTINEL_IDENTICAL", ["secondChance:sentinel", "secondChance:either"], () => holds("secondChance:sentinel") && (!items["secondChance:either"] || holds("secondChance:either"))],
    ["E19", "WIN_IDENTICAL", ["win"], () => holds("win", 20)],
    ["E20", "LOSS_IDENTICAL", ["loss", "capture:other"], () => holds("loss", 20) && !items["capture:other"]],
  ];
  for (const [id, name, labels, pass] of itemChecks) record(id, name, pass(), { items: report(labels) });

  // E21 — onComplete: every completion, finalStats (details) included, deep-equal, at the same input, after the same
  // sounds; with the real score (not the stub).
  {
    const completions = now.flatMap((r) => r.completions);
    const baseCompletions = base.flatMap((r) => r.completions);
    const effectsNow = now.flatMap((r) => r.steps.map((s) => s.effects ?? []));
    const effectsBase = base.flatMap((r) => r.steps.map((s) => s.effects ?? []));
    const scored = completions.some((c) => c.score > 0);
    record("E21", "ON_COMPLETE_AND_FINAL_STATS_IDENTICAL", same(completions, baseCompletions) && same(effectsNow, effectsBase) && completions.length > 50 && scored && holds("completion"), {
      completions: completions.length,
      won: completions.filter((c) => c.details.won).length,
      lost: completions.filter((c) => !c.details.won).length,
      realScores: scored,
      sounds: effectsNow.flat().reduce((acc, e) => (tally(acc, e), acc), {}),
      digest: sha(completions),
    });
  }
  // E22 — continuation: what each result opens, and the session opened on it, identical; Route 3 won writes none.
  {
    const continuations = now.flatMap((r) => r.completions.map((c) => [c.details.routeNumber, c.details.won, c.continuation ?? null]));
    const journeyEnd = continuations.filter(([route, won, next]) => route === 3 && won && next === null).length;
    const wrongEnd = continuations.filter(([route, won, next]) => (route === 3 && won) !== (next === null)).length;
    record("E22", "CONTINUATION_IDENTICAL", holds("continuation", 9) && journeyEnd > 0 && wrongEnd === 0, {
      items: report(["continuation"]),
      results: continuations.length,
      journeyCompleted: journeyEnd,
      byRoute: continuations.reduce((acc, [route, won, next]) => (tally(acc, `R${route} ${won ? "won" : "lost"} → ${next ? `R${next.routeNumber}` : "end"}`), acc), {}),
    });
  }
  // E23 — the RNG: draws per input, generateMaze calls per input (one per mount, start, restart and mode change —
  // none anywhere else), and the next three numbers after each session.
  {
    const gens = {};
    for (const r of now) for (const s of r.steps) if (s.generations) tally(gens, `${s.label.split(":")[0]}:${s.generations}`);
    const extra = Object.keys(gens).filter((k) => !/^(mount|next|start|restart|changeDifficulty):1$/.test(k));
    const stream = now.map((r) => [r.draws, r.generations, r.next]);
    const baseStream = base.map((r) => [r.draws, r.generations, r.next]);
    record("E23", "RNG_STREAM_IDENTICAL", same(stream, baseStream) && extra.length === 0 && holds("generateMaze", 9), {
      draws: now.reduce((sum, r) => sum + r.draws, 0),
      generateMazeCalls: gens,
      unexpectedGenerations: extra,
      digest: sha(stream),
    });
  }
  // E24 — dynamicSolvability: the verdict at every render is part of E1; here, the verdicts themselves, counted.
  {
    const verdicts = now.flatMap((r) => r.commits.map((c) => c.dynamicSolvability));
    const baseVerdicts = base.flatMap((r) => r.commits.map((c) => c.dynamicSolvability));
    const issues = {};
    for (const v of verdicts) for (const code of v.issues) tally(issues, code);
    record("E24", "DYNAMIC_SOLVABILITY_IDENTICAL", same(verdicts, baseVerdicts) && verdicts.length > 9000, {
      verdicts: verdicts.length,
      solvable: verdicts.filter((v) => v.solvable).length,
      issues,
      digest: sha(verdicts),
    });
  }
  if (!react) return out;

  // E25 — the REAL React, tree against tree: each configuration, every commit, commits and component calls per input
  // (no new intermediate render, none missing), completions, sounds, draws, generateMaze calls, keyboard listeners,
  // console output. Batching proven, not assumed.
  {
    const configs = [];
    for (const config of REACT_CONFIGS) {
      const scenarios = reactScenarios({ keys: config.keys });
      const [a, b] = await Promise.all([
        runInRealReact({ rev, sourceOverrides, nodeEnv: config.nodeEnv, strict: config.strict, regime: config.regime, scenarios }),
        runInRealReact({ rev: BASELINE, nodeEnv: config.nodeEnv, strict: config.strict, regime: config.regime, scenarios }),
      ]);
      const inputs = a.results.flatMap((r) => r.steps.filter((s) => s.label !== "mount" && s.label !== "next" && s.commits !== undefined));
      const perInput = inputs.reduce((acc, s) => (tally(acc, `${s.commits} commit${s.commits === 1 ? "" : "s"}`), acc), {});
      const mounts = a.results.flatMap((r) => r.steps.filter((s) => s.label === "mount" || s.label === "next").map((s) => [s.commits, s.bodies, s.generations]));
      configs.push({
        label: config.label,
        identical: same(a.results, b.results) && same(a.consoleErrors, b.consoleErrors),
        atMostOneCommitPerInput: inputs.every((s) => s.commits <= 1),
        commits: a.results.reduce((sum, r) => sum + r.commits.length, 0),
        bodies: a.results.reduce((sum, r) => sum + r.bodies, 0),
        perInput,
        mountsCommitsBodiesGenerations: [...new Set(mounts.map((m) => m.join("/")))],
        keys: inputs.filter((s) => s.label.startsWith("key:")).length,
        completions: a.results.reduce((sum, r) => sum + r.completions.length, 0),
        consoleErrors: a.consoleErrors.length,
        firstDiff: firstDiff(a.results, b.results),
        react: a.reactVersion,
      });
    }
    record(
      "E25",
      "REAL_REACT_BATCHING_RENDERS_AND_EFFECTS_IDENTICAL",
      configs.every((c) => c.identical && c.atMostOneCommitPerInput && c.consoleErrors === 0 && c.completions > 3) &&
        configs.filter((c) => c.label.includes("discrete")).every((c) => c.keys > 20),
      { configs },
    );
  }
  return out;
}

// =================================================================================================
// mutants
// =================================================================================================

/** Mutations C5 must catch, each an exact edit of the working tree (in memory), and the checks expected to see it. */
const MUTANT_LIST = [
  ["reset forgotten: rewardSpent survives a new Route", ROUTE_STATE, ["    case \"START_ROUTE\":\n      return createRouteState(action);", "    case \"START_ROUTE\":\n      return { ...createRouteState(action), rewardSpent: state.rewardSpent };"]],
  ["reset forgotten: triggeredTraps survive a new Route", ROUTE_STATE, ["    case \"START_ROUTE\":\n      return createRouteState(action);", "    case \"START_ROUTE\":\n      return { ...createRouteState(action), triggeredTraps: state.triggeredTraps };"]],
  ["moveTick counted twice per turn", ROUTE_STATE, ["moveTick: state.moveTick + 1", "moveTick: state.moveTick + 2"]],
  ["a blocked step also ticks moveTick", ROUTE_STATE, ["        blockedShake: state.blockedShake + 1,\n", "        blockedShake: state.blockedShake + 1,\n        moveTick: state.moveTick + 1,\n"]],
  ["the Hunter's capture falls through: a later write overwrites the loss", ROUTE_HOOK, ["      endGame(false, statsAt(caughtErrors));\n      return;\n    }\n\n    const nextSentinel", "      endGame(false, statsAt(caughtErrors));\n    }\n\n    const nextSentinel"]],
  ["capture order swapped: the Sentinel resolved before the Hunter", ROUTE_HOOK, ["    if (positionsEqual(nextGuardian, input.playerPosition)) {", "    if (positionsEqual(nextGuardian, input.playerPosition) && !positionsEqual(decideSentinelMove(input.sentinelFrom, input.playerPosition, mazeMap.exitPosition, input.graphWalls, input.zone, SENTINEL_COMMIT_TURNS, input.armedTraps).position, input.playerPosition)) {"]],
  ["the Hunter's move kept after a Second Chance", ROUTE_HOOK, ["      if (input.secondChanceReady) {\n        dispatch({ type: \"SPEND_SECOND_CHANCE\", message: SECOND_CHANCE_DEFENDER_MESSAGE });\n        return;\n      }\n      const caughtErrors = input.errorsSoFar + 1;\n      // The Hunter steps in;", "      if (input.secondChanceReady) {\n        dispatch({ type: \"COMMIT_CAPTURE\", guardian: nextGuardian, sentinel: input.sentinelFrom, errors: input.errorsSoFar });\n        dispatch({ type: \"SPEND_SECOND_CHANCE\", message: SECOND_CHANCE_DEFENDER_MESSAGE });\n        return;\n      }\n      const caughtErrors = input.errorsSoFar + 1;\n      // The Hunter steps in;"]],
  ["win and loss statuses swapped", ROUTE_STATE, ["return { ...state, status: action.status, message: action.message };", "return { ...state, status: action.status === \"won\" ? \"lost\" : \"won\", message: action.message };"]],
  ["a second board drawn at mount", ROUTE_HOOK, ["    const firstMap = generateMaze(initialDifficulty, normalizedInitialRouteNumber);", "    generateMaze(initialDifficulty, normalizedInitialRouteNumber);\n    const firstMap = generateMaze(initialDifficulty, normalizedInitialRouteNumber);"]],
  ["the reducer mutates its input (traps pushed in place)", ROUTE_STATE, [": [...state.triggeredTraps, action.armedTrap],", ": (state.triggeredTraps.push(action.armedTrap), state.triggeredTraps),"]],
  ["a cell put back: moveTick in its own useState", ROUTE_HOOK, ["  const [routeNumber] = useState(normalizedInitialRouteNumber);\n", "  const [routeNumber] = useState(normalizedInitialRouteNumber);\n  const [moveTickCell] = useState(0);\n"]],
  ["a derived view stored: rewardChoicePending in the state", ROUTE_STATE, ["  brokenWall: string | null;\n}", "  brokenWall: string | null;\n  rewardChoicePending: boolean;\n}"]],
  ["route-state imports the RNG", ROUTE_STATE, ["import type { DifficultyLevel, GridPosition } from \"@/types/game\";", "import type { DifficultyLevel, GridPosition } from \"@/types/game\";\nimport { routeRandom } from \"@/engine/route-random\";\nvoid routeRandom;"]],
];

async function runMutants() {
  const worktree = openSourceTree();
  const rows = [];
  for (const [name, file, [from, to]] of MUTANT_LIST) {
    const text = worktree.read(file);
    const hits = text.split(from).length - 1;
    if (hits !== 1) {
      rows.push({ name, caught: false, by: [], error: `anchor found ${hits}x in ${file}` });
      continue;
    }
    const sourceOverrides = { [file]: text.replace(from, () => to) };
    const tree = openSourceTree({ sourceOverrides });
    const results = [...structureChecks(tree), ...reducerChecks(tree), ...preservedChecks(tree)];
    let error = null;
    try {
      results.push(...(await equivalenceChecks({ sourceOverrides, react: false })));
    } catch (e) {
      error = String(e?.message ?? e).split("\n")[0];
    }
    const by = results.filter((r) => !r.pass).map((r) => r.id);
    rows.push({ name, caught: by.length > 0 || error !== null, by, error });
    console.log(`${by.length || error ? "CAUGHT" : "MISSED"}  ${name}${by.length ? ` — by ${by.join(", ")}` : ""}${error ? ` — threw: ${error}` : ""}`);
  }
  const missed = rows.filter((r) => !r.caught);
  console.log(`\n${rows.length - missed.length}/${rows.length} mutants caught${missed.length ? ` · missed: ${missed.map((r) => r.name).join("; ")}` : ""}`);
  process.exitCode = missed.length ? EXIT_VALIDATION_FAILED : EXIT_OK;
}

// =================================================================================================

const print = ({ id, kind, name, pass, detail }) => {
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} [${kind}] — ${name}`);
  for (const [k, v] of Object.entries(detail ?? {})) {
    const text = typeof v === "object" ? JSON.stringify(v) : String(v);
    console.log(`        ${k}: ${text.length > 900 ? `${text.slice(0, 897)}...` : text}`);
  }
};

if (MUTANTS) {
  console.log(`route-state reducer · mutants of the working tree (in memory), against baseline ${BASELINE.slice(0, 7)}\n`);
  await runMutants();
} else {
  const TREE = openSourceTree({ rev: REV });
  console.log(`route-state reducer · ${REV ? `rev ${TREE.rev.slice(0, 12)}` : "working tree"} vs baseline ${BASELINE.slice(0, 7)} (eighteen useState cells)\n`);
  const tests = [];
  for (const group of [() => structureChecks(TREE), () => reducerChecks(TREE), () => preservedChecks(TREE)]) {
    for (const result of group()) {
      tests.push(result);
      print(result);
    }
  }
  for (const result of await equivalenceChecks({ rev: REV })) {
    tests.push(result);
    print(result);
  }
  const failing = tests.filter((t) => !t.pass).map((t) => t.id);
  const tallyKind = (kind) => {
    const of = tests.filter((t) => t.kind === kind);
    return `${of.filter((t) => t.pass).length}/${of.length}`;
  };
  console.log(
    `\n${REV ? `rev ${TREE.rev.slice(0, 12)} · ` : ""}${tests.length - failing.length}/${tests.length} passed · structure ${tallyKind("structure")} · ` +
      `reducer ${tallyKind("reducer")} · preserved ${tallyKind("preserved")} · equivalence ${tallyKind("equivalence")} · failing: ${failing.join(", ") || "none"}`,
  );
  process.exitCode = failing.length ? EXIT_VALIDATION_FAILED : EXIT_OK;
}
