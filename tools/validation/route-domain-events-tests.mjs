/**
 * ROUTE-C6 — the Rota's domain events: a typed record of what happened, tested.
 *
 *   src/games/escape-maze/route-events.ts  `RouteDomainEvent` (a closed union: what happened in the game, with its
 *                                           reason / cause / outcome) and `routeStateActionsForEvent` (pure: an event
 *                                           that already happened → the C5 transitions that record it, in order).
 *
 * route-state (C5) knows HOW the state changes; route-events knows WHAT happened; `useEscapeMaze` still decides WHEN
 * and in WHICH ORDER — it decides which events happen, applies each through one seam (`applyDomainEvent`), and keeps
 * the sounds, `onComplete`, map generation and the input guard. Events are synchronous and ephemeral: nothing stores,
 * queues, publishes or exposes them. C6 is a refactor of how the turn SAYS what it writes; the game may not change.
 * Six groups of checks:
 *
 *   [structure]    the static gate: route-events exists in the Rota's graph, exports the union and the mapping; the
 *                  TypeScript checker reads the union as exactly thirteen members, each with a unique literal `type`,
 *                  its exact payload, no any/unknown, no callback, no index signature, no generic event, and the
 *                  closed sets of reasons, causes, captors and outcomes; route-events imports types only (no React,
 *                  RNG, generation, difficulty, sounds, scoring, storage, UI, Babylon, shell) and reaches nothing at
 *                  run time; the mapping calls nothing and reads nothing but its event; the hook has ONE seam — one
 *                  `dispatch`, inside `applyDomainEvent`, over the mapping's transitions — and every state write of the
 *                  turn is an event applied through it (no `dispatch({ type })` left), emitted where the inventory
 *                  says; no new state source; no event surface (exports, returned object, consumers, importers);
 *                  events, effects and completion in the turn's timeline, function by function (the end's sound, then
 *                  ROUTE_ENDED, then onComplete; the wall, then the stone, then the defenders), every effect from the
 *                  same functions as before.
 *   [contract]     the mapping alone, on events built from generated maps: each kind (and each cause / captor /
 *                  reason / outcome / status) gives exactly its transitions, values passed by identity; folding them
 *                  through the reducer gives the same state as the C5 transition 878057a's hook dispatched, folded
 *                  through 878057a's reducer; pure and deterministic in a realm where every ambient capability is
 *                  poisoned; the three observational events (light, portal, trap) give none, every other at least
 *                  one; the transitions depend only on the event's kind and its Second Chance cause.
 *   [trace]        the semantic trace, observed through the C0 graph (the mapping and the reducer wrapped where they
 *                  are declared — no production API): exact traces pinned for every situation on hand-built boards
 *                  driven through the real hook; on real generated Routes every event checked against the render it
 *                  produced and against the defenders' actual decisions (an oracle independent of the trace); the
 *                  turn grammar and its turn numbers; every cause and captor told apart; traces deterministic and the
 *                  same under the real React (Strict Mode, production) as in the shim; real traces pinned.
 *   [preserved]    against 878057a: the hook's surface, its consumers, every other module (route-state included —
 *                  the reducer is not rewritten), every user-facing string byte for byte, every top-level statement
 *                  but the hook itself, and the order of the turn: with every write erased (and the seam), the hook's
 *                  body prints as 878057a's and as 74ff2dc's (P5 of C5, carried over); with every event resolved
 *                  through the REAL mapping into the transitions it applies, it prints exactly as 878057a's with its
 *                  dispatches — the same decisions, the same writes, the same values, the same order (P6).
 *   [equivalence]  against 878057a through the loader, render by render on the runtime harness (all the fields the
 *                  hook returns, real scoring, recording sounds): every render, each kind of occurrence over the
 *                  inputs that exercise it, completions and finalStats, continuation, the RNG stream, generateMaze
 *                  calls and dynamicSolvability; the reducer runs per input exactly as many times as 878057a's did,
 *                  every run coming from the seam; and the REAL React (development + Strict Mode with act and with
 *                  native discrete events through the hook's own listener, production with default and discrete
 *                  updates): commits and component calls per input, effects, draws, no warning, no error.
 *
 * `--rev=<commit>` runs every check on that tree. `--rev=878057a` is the counterfactual: route-state and its reducer
 * exist, the hook dispatches the eleven actions itself, there is no route-events and no trace — every [structure],
 * [contract] and [trace] check must fail, every [preserved] and [equivalence] check hold (the tree against itself).
 *
 * `--mutants` applies, in memory, mutations C6 must not let through (an event dropped, two swapped, a cause or a
 * captor mislabelled, the end before the capture, a transition forgotten or added, an observational event that
 * writes, a write that skips the seam, a generic event, an RNG import, an event exposed) and requires each caught.
 *
 * Usage: node tools/validation/route-domain-events-tests.mjs [--rev=<commit> | --mutants]
 * Writes nothing. Exit 0 = every check holds (every mutant caught), 1 = a check failed, 3 = usage error.
 */
import crypto from "node:crypto";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";

import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";
import { ROUTE_HOOK, ROUTE_RANDOM_SEAM, createModuleGraph, loadRouteModules, openSourceTree } from "./route-module-loader.mjs";
import { POLICIES, applyAction, instrumentEvents, nextAction, runInRealReact, runInShim } from "./route-react-runtime.mjs";
import { loadRouteRuntime } from "./route-runtime-harness.mjs";

/** C5: the session state is one reducer and the hook dispatches its eleven actions itself — what C6 must be equivalent to. */
const BASELINE = "878057a972a2b8182cafd8b3001a72cf0f894685";
/** C4: eighteen useState cells — the tree C5's P5 compared the turn with, carried over here. */
const C4_BASELINE = "74ff2dc3a0a926fe3b40b325771bd423a348e041";
const ROUTE_EVENTS = "src/games/escape-maze/route-events.ts";
const ROUTE_STATE = "src/games/escape-maze/route-state.ts";
const CONSUMERS = ["src/games/escape-maze/RouteStrategyGame.tsx", "src/games/escape-maze/RouteBabylonBoard.tsx"];
/** Every file C6 must not have touched: the reducer, the Rota's other modules, its consumers, the engine, the types. */
const UNTOUCHED = [
  ROUTE_STATE, "src/games/escape-maze/route-config.ts", "src/games/escape-maze/route-geometry.ts", "src/games/escape-maze/route-generation.ts",
  "src/games/escape-maze/route-defenders.ts", "src/games/escape-maze/route-invariants.ts", "src/games/escape-maze/continuation.ts",
  ROUTE_RANDOM_SEAM, "src/engine/difficulty.ts", "src/engine/scoring.ts", "src/lib/game-sounds.ts", "src/types/game.ts",
  ...CONSUMERS, "src/games/escape-maze/routeBabylonScene.ts", "src/games/escape-maze/route-visual.css",
];

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const MUTANTS = args.includes("--mutants");
const REV = revArg ? revArg.slice("--rev=".length) : null;
if (args.some((arg) => arg !== revArg && arg !== "--mutants") || REV === "" || (REV && MUTANTS)) {
  console.error("usage: node tools/validation/route-domain-events-tests.mjs [--rev=<commit> | --mutants]");
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

// --- the contract C6 declares ---------------------------------------------------------------------

/** Every member of RouteDomainEvent and exactly its payload. */
const PAYLOAD = {
  ROUTE_STARTED: ["routeNumber", "difficulty", "mazeMap", "sentinel", "status", "message"],
  EXPLORER_STEP_BLOCKED: ["reason", "cell", "message"],
  EXPLORER_STEP_COMMITTED: ["turn", "to", "collectedStars", "armedTrap"],
  LIGHT_COLLECTED: ["turn", "light"],
  PORTAL_ACTIVATED: ["turn"],
  TRAP_ARMED: ["turn", "trap"],
  CHEST_OPENED: ["turn", "message"],
  REWARD_SELECTED: ["turn", "reward"],
  WALL_OPENED: ["turn", "wall"],
  SECOND_CHANCE_USED: ["cause", "turn", "at", "message"],
  DEFENDERS_SETTLED: ["turn", "guardian", "sentinel", "message"],
  EXPLORER_CAPTURED: ["by", "turn", "at", "guardian", "sentinel", "errors"],
  ROUTE_ENDED: ["outcome", "turn", "journeyCompleted", "message"],
};
const EVENTS = Object.keys(PAYLOAD);
/** The meaning an event names, as closed sets. */
const DISCRIMINANTS = {
  reason: ["boundary", "wall"],
  cause: ["explorer", "hunter", "sentinel"],
  by: ["explorer-step", "hunter", "sentinel"],
  outcome: ["lost", "won"],
};
/** Already written by the step that caused them: observable, and no transition of their own. */
const OBSERVATIONAL = ["LIGHT_COLLECTED", "PORTAL_ACTIVATED", "TRAP_ARMED"];
/** Every meaning an event can carry: each kind, with its reason, cause, captor, outcome, reward or status. Twenty-one. */
const MEANINGS = [
  "ROUTE_STARTED:playing", "ROUTE_STARTED:setup", "EXPLORER_STEP_BLOCKED:boundary", "EXPLORER_STEP_BLOCKED:wall", "EXPLORER_STEP_COMMITTED", "LIGHT_COLLECTED",
  "PORTAL_ACTIVATED", "TRAP_ARMED", "CHEST_OPENED", "REWARD_SELECTED:pickaxe", "REWARD_SELECTED:second-chance", "WALL_OPENED", "SECOND_CHANCE_USED:explorer",
  "SECOND_CHANCE_USED:hunter", "SECOND_CHANCE_USED:sentinel", "DEFENDERS_SETTLED", "EXPLORER_CAPTURED:explorer-step", "EXPLORER_CAPTURED:hunter",
  "EXPLORER_CAPTURED:sentinel", "ROUTE_ENDED:lost", "ROUTE_ENDED:won",
];
const ROUTE_EVENTS_EXPORTS = ["ExplorerBlockReason", "ExplorerCaptureBy", "RouteDomainEvent", "RouteOutcome", "SecondChanceCause", "routeStateActionsForEvent"];
const ACTIONS = ["START_ROUTE", "BLOCK_STEP", "COUNT_TURN", "MOVE_EXPLORER", "OPEN_CHEST", "SELECT_REWARD", "SPEND_SECOND_CHANCE", "OPEN_WALL", "SETTLE_DEFENDERS", "COMMIT_CAPTURE", "END_ROUTE"];

/**
 * The C5 transitions 878057a's hook dispatched for each occurrence, in its order — the contract the mapping must meet
 * (P6 checks the same thing against 878057a's own text). Keyed by kind, or kind:cause for the Second Chance.
 */
const EXPECTED_TRANSITIONS = {
  ROUTE_STARTED: (e) => [{ type: "START_ROUTE", difficulty: e.difficulty, mazeMap: e.mazeMap, sentinel: e.sentinel, status: e.status, message: e.message }],
  EXPLORER_STEP_BLOCKED: (e) => [{ type: "BLOCK_STEP", message: e.message }],
  EXPLORER_STEP_COMMITTED: (e) => [
    { type: "COUNT_TURN", turns: e.turn },
    { type: "MOVE_EXPLORER", player: e.to, collectedStars: e.collectedStars, armedTrap: e.armedTrap },
  ],
  LIGHT_COLLECTED: () => [],
  PORTAL_ACTIVATED: () => [],
  TRAP_ARMED: () => [],
  CHEST_OPENED: (e) => [{ type: "OPEN_CHEST", message: e.message }],
  REWARD_SELECTED: (e) => [{ type: "SELECT_REWARD", reward: e.reward }],
  WALL_OPENED: (e) => [{ type: "OPEN_WALL", wall: e.wall }, { type: "COUNT_TURN", turns: e.turn }],
  "SECOND_CHANCE_USED:explorer": (e) => [{ type: "SPEND_SECOND_CHANCE", message: e.message }, { type: "COUNT_TURN", turns: e.turn }],
  "SECOND_CHANCE_USED:hunter": (e) => [{ type: "SPEND_SECOND_CHANCE", message: e.message }],
  "SECOND_CHANCE_USED:sentinel": (e) => [{ type: "SPEND_SECOND_CHANCE", message: e.message }],
  DEFENDERS_SETTLED: (e) => [{ type: "SETTLE_DEFENDERS", guardian: e.guardian, sentinel: e.sentinel, message: e.message }],
  EXPLORER_CAPTURED: (e) => [{ type: "COMMIT_CAPTURE", guardian: e.guardian, sentinel: e.sentinel, errors: e.errors }],
  ROUTE_ENDED: (e) => [{ type: "END_ROUTE", status: e.outcome, message: e.message }],
};
const expectedTransitions = (e) => (EXPECTED_TRANSITIONS[`${e.type}:${e.cause}`] ?? EXPECTED_TRANSITIONS[e.type])(e);

/**
 * Where the hook says what happened: the events each orchestration function applies, in source order (with the cause,
 * captor or outcome where the site names it). The inventory of the turn.
 */
const EMISSIONS = {
  startNewMaze: ["ROUTE_STARTED"],
  endGame: ["ROUTE_ENDED:won", "ROUTE_ENDED:lost"],
  runDefenderPhase: ["SECOND_CHANCE_USED:hunter", "EXPLORER_CAPTURED:hunter", "SECOND_CHANCE_USED:sentinel", "EXPLORER_CAPTURED:sentinel", "DEFENDERS_SETTLED"],
  tryMovePlayer: [
    "EXPLORER_STEP_BLOCKED", "SECOND_CHANCE_USED:explorer", "EXPLORER_STEP_COMMITTED", "EXPLORER_CAPTURED:explorer-step",
    "EXPLORER_STEP_COMMITTED", "LIGHT_COLLECTED", "PORTAL_ACTIVATED", "TRAP_ARMED", "CHEST_OPENED",
  ],
  chooseReward: ["REWARD_SELECTED"],
  breakWall: ["WALL_OPENED"],
};
const SIDE_EFFECTS = ["playGentleErrorTone", "playStoneBreak", "playSuccessChime", "onComplete", "Date.now", "generateMaze"];
/**
 * The turn's timeline, function by function, in source order: every event applied, every side effect, every call that
 * hands the turn on (the defenders' policies, their phase, the end). Effects and completion stay in the hook, around
 * the events: the sound before the end is recorded, onComplete after it; the stone breaks after the wall is opened and
 * before the defenders answer; the board is generated before the Route that starts on it.
 */
const TIMELINE_CALLS = [...SIDE_EFFECTS, "endGame", "runDefenderPhase", "chooseGuardianMove", "decideSentinelMove"];
const TIMELINE = {
  startNewMaze: ["generateMaze", "ROUTE_STARTED"],
  endGame: ["playSuccessChime", "ROUTE_ENDED:won", "playGentleErrorTone", "ROUTE_ENDED:lost", "onComplete"],
  runDefenderPhase: ["chooseGuardianMove", "SECOND_CHANCE_USED:hunter", "EXPLORER_CAPTURED:hunter", "endGame", "decideSentinelMove", "SECOND_CHANCE_USED:sentinel", "EXPLORER_CAPTURED:sentinel", "endGame", "DEFENDERS_SETTLED"],
  tryMovePlayer: [
    "Date.now", "playGentleErrorTone", "EXPLORER_STEP_BLOCKED", "SECOND_CHANCE_USED:explorer", "EXPLORER_STEP_COMMITTED", "EXPLORER_CAPTURED:explorer-step", "endGame",
    "EXPLORER_STEP_COMMITTED", "LIGHT_COLLECTED", "PORTAL_ACTIVATED", "TRAP_ARMED", "endGame", "CHEST_OPENED", "runDefenderPhase",
  ],
  chooseReward: ["REWARD_SELECTED", "runDefenderPhase"],
  breakWall: ["WALL_OPENED", "playStoneBreak", "runDefenderPhase"],
};
const ALLOWED_TYPE_IMPORTS = ["@/games/escape-maze/route-defenders", "@/games/escape-maze/route-invariants", "@/games/escape-maze/route-state", "@/types/game"];
const FORBIDDEN_IMPORT =
  /react|route-random|route-generation|difficulty|useEscapeMaze|babylon|game-sounds|scoring|storage|continuation|components\/|GameScreen|RouteStrategyGame|RouteBabylonBoard|\.tsx$|^@\/app\//i;
const FORBIDDEN_MENTIONS = [
  "Math.random", "routeRandom", "randomItem", "Date", "performance", "window", "document", "localStorage", "sessionStorage", "setTimeout",
  "setInterval", "requestAnimationFrame", "queueMicrotask", "fetch", "console", "useState", "useReducer", "useEffect", "useCallback", "useRef",
  "React", "BABYLON", "generateMaze", "chooseGuardianMove", "decideSentinelMove", "computePortalDefenceZone", "createSentinelState",
  "inspectDynamicMazeState", "playGentleErrorTone", "playStoneBreak", "playSuccessChime", "onComplete", "dispatch", "routeStateReducer",
  "createRouteState", "positionsEqual", "posKey", "manhattanDistance", "use client",
];
/** An event history, a bus, a queue or a subscription — none may exist. */
const EVENT_SURFACE = /\b(lastEvent|eventHistory|eventLog|eventQueue|eventBus|EventBus|subscribe|unsubscribe|listeners|EventEmitter|EventTarget|CustomEvent|dispatchEvent|BroadcastChannel|postMessage)\b|\bemit\(/;

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
    return String(error?.message ?? error).split("\n")[0];
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
const cell = (p) => (p && typeof p.row === "number" ? `${p.row},${p.col}` : String(p));
const at = (a, b) => Boolean(a && b) && a.row === b.row && a.col === b.col;
const setOf = (value) => new Set(value instanceof Set ? value : value?.$set ?? value ?? []);
/** Keys sorted all the way down, so two transitions compare by content, not by the order a literal was written in. */
const canonical = (value) =>
  JSON.stringify(value, (_k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v));

/** A module's imports, exports and top-level statements, by the parser. */
function moduleShape(file, source) {
  const sf = parse(file, source);
  const out = { imports: [], exported: [], values: [], types: [], statements: [], sideEffects: [], mutable: [], sf };
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
      if (!(statement.declarationList.flags & ts.NodeFlags.Const)) out.mutable.push(statement.getText(sf).slice(0, 60));
      for (const d of statement.declarationList.declarations) {
        name ??= d.name.getText(sf);
        out.values.push(d.name.getText(sf));
        if (exported) out.exported.push(d.name.getText(sf));
      }
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      name = statement.name.text;
      out.values.push(name);
      if (exported) out.exported.push(name);
    } else if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
      name = statement.name.text;
      out.types.push(name);
      if (exported) out.exported.push(name);
    } else {
      if (ts.isClassDeclaration(statement)) out.mutable.push(`class ${statement.name?.text}`);
      out.sideEffects.push(statement.getText(sf).slice(0, 80));
    }
    out.statements.push({ name, text: statement.getFullText(sf).trim() });
  }
  return out;
}

const hookFunction = (sf) => sf.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === "useEscapeMaze");

/**
 * The hook's body, by the parser: its cells, every `dispatch` call and every mention of `dispatch`, every call of the
 * mapping, every event it applies (with the function it sits in and the cause / captor / outcome its literal names),
 * every side effect, the keys of the object it returns.
 */
function hookAnatomy(source) {
  const sf = parse(ROUTE_HOOK, source);
  const fn = hookFunction(sf);
  const out = {
    found: Boolean(fn), cells: { useState: [], useReducer: [], useRef: [], useCallback: [], useMemo: 0, useEffect: 0 }, dispatchCalls: [],
    dispatchMentions: [], mappingCalls: [], applications: [], effects: {}, generateMaze: [], returnKeys: [], seam: null, addEventListener: 0, timeline: {}, sf, fn,
  };
  if (!fn) return out;
  const enclosing = (node) => {
    for (let p = node.parent; p && p !== fn; p = p.parent) {
      if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && ts.isVariableDeclaration(p.parent)) return p.parent.name.getText(sf);
      if (ts.isArrowFunction(p) && ts.isCallExpression(p.parent) && ts.isIdentifier(p.parent.expression)) {
        const callee = p.parent.expression.text;
        if ((callee === "useCallback" || callee === "useMemo") && ts.isVariableDeclaration(p.parent.parent)) return p.parent.parent.name.getText(sf);
        if (callee === "useReducer") return "useReducer:init";
        if (callee === "useEffect") return "useEffect";
      }
    }
    return "useEscapeMaze";
  };
  const binding = (call) => {
    const decl = call.parent;
    if (!ts.isVariableDeclaration(decl)) return null;
    return ts.isArrayBindingPattern(decl.name) ? decl.name.elements.map((e) => (ts.isOmittedExpression(e) ? null : e.name.getText(sf))) : decl.name.getText(sf);
  };
  const literalOf = (arg) => {
    if (!arg || !ts.isObjectLiteralExpression(arg)) return null;
    const out = {};
    for (const p of arg.properties) {
      if (ts.isPropertyAssignment(p) && (ts.isStringLiteral(p.initializer) || ts.isNoSubstitutionTemplateLiteral(p.initializer))) out[p.name.getText(sf)] = p.initializer.text;
    }
    return out;
  };
  walk(fn.body, (node) => {
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(sf);
      const where = enclosing(node);
      if (callee === "useState") out.cells.useState.push(binding(node));
      if (callee === "useReducer") out.cells.useReducer.push({ binds: binding(node), reducer: node.arguments[0]?.getText(sf), hasInit: node.arguments.length === 3 });
      if (callee === "useRef") out.cells.useRef.push(binding(node));
      if (callee === "useCallback") out.cells.useCallback.push(binding(node));
      if (callee === "useMemo") out.cells.useMemo += 1;
      if (callee === "useEffect") out.cells.useEffect += 1;
      if (callee === "window.addEventListener") out.addEventListener += 1;
      if (callee === "dispatch") {
        const arg = node.arguments[0];
        out.dispatchCalls.push({ in: where, arg: arg ? (ts.isObjectLiteralExpression(arg) ? "object" : ts.isIdentifier(arg) ? `identifier:${arg.text}` : "expression") : "none", type: literalOf(arg)?.type ?? null });
      }
      if (callee === "routeStateActionsForEvent") out.mappingCalls.push({ in: where, insideForOf: ts.isForOfStatement(node.parent) && node.parent.expression === node });
      if (callee === "applyDomainEvent") {
        const lit = literalOf(node.arguments[0]);
        const label = lit?.type ? [lit.type, lit.cause ?? lit.by ?? lit.outcome].filter(Boolean).join(":") : "non-literal";
        out.applications.push({ in: where, type: lit?.type ?? null, label, literal: Boolean(lit?.type) });
        (out.timeline[where] ??= []).push(label);
      }
      if (TIMELINE_CALLS.includes(callee)) (out.timeline[where] ??= []).push(callee);
      if (callee === "generateMaze") out.generateMaze.push(where);
      for (const effect of SIDE_EFFECTS) if (callee === effect) tally(out.effects, `${effect}@${where}`);
    }
    if (ts.isIdentifier(node) && node.text === "dispatch" && !(ts.isCallExpression(node.parent) && node.parent.expression === node)) {
      out.dispatchMentions.push(enclosing(node) + (ts.isBindingElement(node.parent) ? ":binding" : ""));
    }
    if (ts.isVariableDeclaration(node) && node.name.getText(sf) === "applyDomainEvent") {
      const init = node.initializer;
      const isCallback = init && ts.isCallExpression(init) && init.expression.getText(sf) === "useCallback";
      const handler = isCallback ? init.arguments[0] : null;
      const deps = isCallback ? init.arguments[1] : null;
      out.seam = {
        viaUseCallback: Boolean(isCallback),
        params: handler && (ts.isArrowFunction(handler) || ts.isFunctionExpression(handler)) ? handler.parameters.map((p) => `${p.name.getText(sf)}: ${p.type?.getText(sf)}`) : null,
        deps: deps ? deps.getText(sf) : null,
        body: handler ? ts.createPrinter({ removeComments: true }).printNode(ts.EmitHint.Unspecified, handler.body, sf) : null,
      };
    }
  });
  const ret = fn.body.statements.find((s) => ts.isReturnStatement(s) && s.expression && ts.isObjectLiteralExpression(s.expression));
  if (ret) out.returnKeys = ret.expression.properties.map((p) => p.name?.getText(sf) ?? p.getText(sf));
  return out;
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
// the TypeScript checker's reading of the contract
// =================================================================================================

/**
 * RouteDomainEvent and the mapping's signature as the TypeScript checker resolves them (intersections, aliases and
 * imported types included), on the tree under test — never on disk when the tree is a revision or carries overrides.
 */
function typeContract(tree) {
  if (!tree.exists(ROUTE_EVENTS)) return null;
  const root = tree.root;
  const toRepo = (file) => path.relative(root, file).replace(/\\/g, "/");
  const inTree = (file) => {
    const repo = toRepo(file);
    return !repo.startsWith("..") && repo.startsWith("src/") ? repo : null;
  };
  const options = {
    strict: true,
    noEmit: true,
    skipLibCheck: true,
    types: [],
    jsx: ts.JsxEmit.Preserve,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    baseUrl: root,
    paths: { "@/*": ["./src/*"] },
    lib: ["lib.es2020.d.ts", "lib.dom.d.ts"],
  };
  const host = ts.createCompilerHost(options);
  const fileExists = host.fileExists.bind(host);
  const readFile = host.readFile.bind(host);
  host.fileExists = (file) => (inTree(file) ? tree.exists(inTree(file)) : fileExists(file));
  host.readFile = (file) => (inTree(file) ? (tree.exists(inTree(file)) ? tree.read(inTree(file)) : undefined) : readFile(file));
  host.getSourceFile = (file, language) => {
    const text = host.readFile(file);
    return text === undefined ? undefined : ts.createSourceFile(file, text, language, true);
  };
  const program = ts.createProgram([path.join(root, ROUTE_EVENTS)], options, host);
  const checker = program.getTypeChecker();
  const sf = program.getSourceFile(path.join(root, ROUTE_EVENTS));
  const diagnostics = ts.getPreEmitDiagnostics(program).filter((d) => d.category === ts.DiagnosticCategory.Error)
    .map((d) => `${d.file ? toRepo(d.file.fileName) : ""}: ${ts.flattenDiagnosticMessageText(d.messageText, " ")}`.slice(0, 200));
  const alias = sf.statements.find((s) => ts.isTypeAliasDeclaration(s) && s.name.text === "RouteDomainEvent");
  if (!alias) return { diagnostics, members: [], signature: null };
  const union = checker.getTypeAtLocation(alias.name);
  const memberTypes = union.isUnion() ? union.types : [union];
  const members = memberTypes.map((member) => {
    const props = checker.getPropertiesOfType(member).map((symbol) => {
      const type = checker.getTypeOfSymbolAtLocation(symbol, alias);
      const parts = type.isUnion() ? type.types : [type];
      return {
        name: symbol.name,
        type: checker.typeToString(type),
        optional: Boolean(symbol.flags & ts.SymbolFlags.Optional),
        anyOrUnknown: parts.some((t) => t.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)),
        callable: parts.some((t) => t.getCallSignatures().length > 0 || t.getConstructSignatures().length > 0),
        literals: parts.every((t) => t.isStringLiteral()) ? parts.map((t) => t.value).sort() : null,
      };
    });
    const typeProp = props.find((p) => p.name === "type");
    return {
      type: typeProp?.literals?.length === 1 ? typeProp.literals[0] : null,
      typeIsLiteral: Boolean(typeProp?.literals?.length === 1),
      props,
      indexSignatures: checker.getIndexInfosOfType(member).length,
    };
  });
  const fnDecl = sf.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === "routeStateActionsForEvent");
  let signature = null;
  if (fnDecl) {
    const sig = checker.getSignatureFromDeclaration(fnDecl);
    signature = {
      params: sig.parameters.map((p) => `${p.name}: ${checker.typeToString(checker.getTypeOfSymbolAtLocation(p, fnDecl))}`),
      returns: checker.typeToString(sig.getReturnType()),
    };
  }
  return { diagnostics, members, signature };
}

// =================================================================================================
// [structure]
// =================================================================================================

function structureChecks(tree) {
  const out = [];
  const record = (id, name, pass, detail) => out.push({ id, kind: "structure", name, pass, detail });
  const base = openSourceTree({ rev: BASELINE });
  const exists = tree.exists(ROUTE_EVENTS);
  const eventsText = exists ? tree.read(ROUTE_EVENTS) : "";
  const events = moduleShape(ROUTE_EVENTS, eventsText);
  const hookText = tree.read(ROUTE_HOOK);
  const hook = hookAnatomy(hookText);
  const baseHook = hookAnatomy(base.read(ROUTE_HOOK));
  const closure = tree.closure(ROUTE_HOOK);

  // S1 — route-events.ts exists in the hook's run-time graph and exports exactly the union, its four named sets and
  // the mapping.
  record("S1", "ROUTE_EVENTS_MODULE_EXISTS_IN_THE_ROTA", exists && closure.includes(ROUTE_EVENTS) && same(sorted(events.exported), ROUTE_EVENTS_EXPORTS), {
    exists,
    inHookGraph: closure.includes(ROUTE_EVENTS),
    exports: sorted(events.exported),
  });

  // S2 — a closed discriminated union, as the TypeScript checker resolves it: exactly the thirteen kinds, each member's
  // `type` one string literal and unique, each payload exactly as declared above, nothing any/unknown, no callback, no
  // index signature, nothing optional (so no generic `{ type: string; payload: any }` can hide in it); reasons, causes,
  // captors and outcomes are closed literal sets; the mapping takes one RouteDomainEvent and returns RouteStateAction[];
  // the module type-checks.
  {
    const contract = typeContract(tree);
    const members = contract?.members ?? [];
    const kinds = members.map((m) => m.type);
    const payloadProblems = [];
    const discriminants = {};
    for (const m of members) {
      if (!m.typeIsLiteral) payloadProblems.push(`a member whose type is not one string literal (${m.props.find((p) => p.name === "type")?.type ?? "none"})`);
      const keys = m.props.map((p) => p.name).filter((n) => n !== "type");
      if (m.type && !same(sorted(keys), sorted(PAYLOAD[m.type] ?? []))) payloadProblems.push(`${m.type}: payload ${keys.join(",")}`);
      if (m.indexSignatures) payloadProblems.push(`${m.type}: index signature`);
      for (const p of m.props) {
        if (p.anyOrUnknown) payloadProblems.push(`${m.type}.${p.name}: ${p.type}`);
        if (p.callable) payloadProblems.push(`${m.type}.${p.name}: a function`);
        if (p.optional) payloadProblems.push(`${m.type}.${p.name}: optional`);
        if (p.name in DISCRIMINANTS) discriminants[p.name] = p.literals ?? `NOT A CLOSED SET: ${p.type}`;
      }
    }
    const pass =
      Boolean(contract) && contract.diagnostics.length === 0 && members.length === EVENTS.length && same(sorted(kinds), sorted(EVENTS)) &&
      new Set(kinds).size === kinds.length && payloadProblems.length === 0 && same(discriminants, Object.fromEntries(Object.keys(DISCRIMINANTS).map((k) => [k, DISCRIMINANTS[k]]))) &&
      same(contract.signature, { params: ["event: RouteDomainEvent"], returns: "RouteStateAction[]" });
    record("S2", "CLOSED_DISCRIMINATED_UNION_NO_GENERIC_EVENT", pass, {
      members: members.length,
      kinds,
      payloadProblems,
      discriminants,
      signature: contract?.signature ?? null,
      typeErrors: contract?.diagnostics.slice(0, 3) ?? "route-events absent",
    });
  }

  // S3 — route-events is pure: type-only imports from the allowed modules (RouteStateAction and the session start from
  // route-state, the domain's own types), nothing forbidden — React, RNG, generation, difficulty, sounds, scoring,
  // storage, UI, Babylon, the shell — no run-time import at all (its closure is itself), only declarations at the top
  // level (no mutable module state), no mention of an ambient capability or of the turn's machinery, and no copy.
  {
    const specifiers = events.imports.map((imp) => imp.specifier);
    const notAllowed = specifiers.filter((s) => !ALLOWED_TYPE_IMPORTS.includes(s));
    const forbidden = specifiers.filter((s) => FORBIDDEN_IMPORT.test(s));
    const valueImports = events.imports.filter((imp) => !imp.typeOnly).map((imp) => imp.specifier);
    const code = codeOnly(eventsText);
    const mentions = FORBIDDEN_MENTIONS.filter((word) => new RegExp(String.raw`(^|[^\w.])${word.replace(/\./g, "\\.")}\b`).test(code));
    const reach = exists ? tree.closure(ROUTE_EVENTS) : [];
    const copy = exists ? userFacing(stringLiterals(ROUTE_EVENTS, eventsText)) : [];
    record(
      "S3",
      "ROUTE_EVENTS_IS_PURE_TYPES_ONLY_NO_RUNTIME_DEPENDENCY",
      exists && notAllowed.length === 0 && forbidden.length === 0 && valueImports.length === 0 && same(reach, [ROUTE_EVENTS]) &&
        events.sideEffects.length === 0 && events.mutable.length === 0 && mentions.length === 0 && copy.length === 0 &&
        events.imports.some((imp) => imp.specifier === "@/games/escape-maze/route-state" && imp.names.includes("RouteStateAction")),
      {
        imports: events.imports.map((imp) => `${imp.specifier}${imp.typeOnly ? " (type)" : ""}: ${imp.names.join(", ")}`),
        notAllowed,
        forbidden,
        valueImports,
        runtimeReach: reach,
        topLevelSideEffects: events.sideEffects,
        mutableModuleState: events.mutable,
        mentions,
        copy,
      },
    );
  }

  // S4 — the mapping translates; it does not decide. Its body calls nothing, reads nothing but its `event` (every
  // identifier is the parameter; everything else is a property name), branches only on `event.type` (one case per kind,
  // no default) and on the Second Chance's `event.cause`, and every value it returns is an array of action literals
  // whose `type` is one of the eleven C5 transitions.
  {
    const sf = events.sf;
    const fn = sf.statements.find((s) => ts.isFunctionDeclaration(s) && s.name?.text === "routeStateActionsForEvent");
    const problems = [];
    const caseLabels = [];
    const produced = new Set();
    let defaults = 0;
    if (fn) {
      const param = fn.parameters.map((p) => p.name.getText(sf));
      if (!same(param, ["event"])) problems.push(`parameters ${param.join(",")}`);
      walk(fn.body, (n) => {
        if (ts.isCallExpression(n) || ts.isNewExpression(n)) problems.push(`calls ${n.expression.getText(sf)}`);
        if (ts.isIdentifier(n)) {
          const parent = n.parent;
          const isName = (ts.isPropertyAccessExpression(parent) && parent.name === n) || (ts.isPropertyAssignment(parent) && parent.name === n);
          if (!isName && n.text !== "event") problems.push(`reads ${n.text}`);
        }
        if (ts.isConditionalExpression(n) || ts.isIfStatement(n)) {
          const test = (n.condition ?? n.expression).getText(sf);
          if (!/^event\.cause === "explorer"$/.test(test)) problems.push(`branches on ${test}`);
        }
        if (ts.isSwitchStatement(n) && n.expression.getText(sf) !== "event.type") problems.push(`switches on ${n.expression.getText(sf)}`);
        if (ts.isCaseClause(n)) caseLabels.push(n.expression.getText(sf).replace(/"/g, ""));
        if (ts.isDefaultClause(n)) defaults += 1;
        if (ts.isReturnStatement(n)) {
          const values = [];
          const collect = (e) => (ts.isConditionalExpression(e) ? (collect(e.whenTrue), collect(e.whenFalse)) : values.push(e));
          collect(n.expression);
          for (const v of values) {
            if (!ts.isArrayLiteralExpression(v)) problems.push(`returns ${v.getText(sf).slice(0, 40)}`);
            else
              for (const element of v.elements) {
                const type = ts.isObjectLiteralExpression(element)
                  ? element.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText(sf) === "type")?.initializer
                  : null;
                if (!type || !ts.isStringLiteral(type) || !ACTIONS.includes(type.text)) problems.push(`returns ${element.getText(sf).slice(0, 40)}`);
                else produced.add(type.text);
              }
          }
        }
      });
    } else problems.push("routeStateActionsForEvent not declared");
    record(
      "S4",
      "MAPPING_TRANSLATES_DOES_NOT_DECIDE",
      exists && problems.length === 0 && same(sorted(caseLabels), sorted(EVENTS)) && defaults === 0 && same(sorted(produced), sorted(ACTIONS)),
      { problems: [...new Set(problems)].slice(0, 12), caseLabels, defaults, transitionsProduced: sorted(produced) },
    );
  }

  // S5 — the hook has ONE seam: `applyDomainEvent`, declared once (useCallback, no deps — `dispatch` is stable) with one
  // RouteDomainEvent parameter; the hook calls `dispatch` exactly once, there, with the transition it is iterating;
  // the mapping is called exactly once, there, as the iterable of that loop; and `dispatch` is mentioned nowhere else
  // (it is never handed to anything).
  {
    const seam = hook.seam;
    const oneDispatch = same(hook.dispatchCalls, [{ in: "applyDomainEvent", arg: "identifier:action", type: null }]);
    const oneMapping = same(hook.mappingCalls, [{ in: "applyDomainEvent", insideForOf: true }]);
    const mentions = hook.dispatchMentions.filter((m) => m !== "useEscapeMaze:binding");
    record(
      "S5",
      "ONE_SEAM_APPLIES_EVERY_EVENT",
      hook.found && Boolean(seam) && seam.viaUseCallback && same(seam.params, ["event: RouteDomainEvent"]) && seam.deps === "[]" && oneDispatch && oneMapping && mentions.length === 0 &&
        hook.cells.useCallback.filter((b) => b === "applyDomainEvent").length === 1,
      {
        seam,
        dispatchCalls: hook.dispatchCalls,
        mappingCalls: hook.mappingCalls,
        dispatchMentionedElsewhere: mentions,
      },
    );
  }

  // S6 — every state write of the turn is an event applied through the seam: no `dispatch({ type })` is left (878057a
  // had twenty), every application is a literal event of the union (no event assembled elsewhere), every kind is
  // emitted, and each orchestration function emits exactly the events of the inventory, in that order. The one write
  // that is not an event is the mount's initial state — the reducer's initialiser, `createRouteState`, which is a
  // starting value and not a transition.
  {
    const literalDispatches = hook.dispatchCalls.filter((d) => d.arg === "object");
    const byFunction = {};
    for (const a of hook.applications) (byFunction[a.in] ??= []).push(a.label);
    const nonLiteral = hook.applications.filter((a) => !a.literal || !EVENTS.includes(a.type));
    const emitted = sorted(new Set(hook.applications.map((a) => a.type).filter(Boolean)));
    const initialiser = /useReducer\(routeStateReducer, null, \(\) => \{[\s\S]*?return createRouteState\(\{/.test(hookText);
    record(
      "S6",
      "EVERY_STATE_WRITE_IS_AN_EVENT_THROUGH_THE_SEAM",
      hook.found && literalDispatches.length === 0 && nonLiteral.length === 0 && same(emitted, sorted(EVENTS)) && same(byFunction, EMISSIONS) && initialiser,
      {
        directDispatches: { baseline: baseHook.dispatchCalls.filter((d) => d.arg === "object").length, now: literalDispatches.length },
        directDispatchSites: literalDispatches,
        eventApplications: hook.applications.length,
        emissionsByFunction: byFunction,
        nonLiteralOrUnknown: nonLiteral,
        exception: initialiser ? "useReducer initialiser → createRouteState (the mount's starting value, not a transition)" : "MISSING",
      },
    );
  }

  // S7 — no new source of state: the same cells as 878057a (one useState — routeNumber —, one useReducer running
  // routeStateReducer, one useRef — the input guard —, the same memos and effects), one useCallback more (the seam and
  // nothing else), no mutable module state in the hook or route-events, and route-state.ts — the state and its reducer
  // — byte for byte 878057a's.
  {
    const cells = hook.cells;
    const was = baseHook.cells;
    const addedCallbacks = cells.useCallback.filter((b) => !was.useCallback.includes(b));
    const stateUnchanged = tree.read(ROUTE_STATE) === base.read(ROUTE_STATE);
    const hookShape = moduleShape(ROUTE_HOOK, hookText);
    record(
      "S7",
      "NO_NEW_STATE_SOURCE",
      same(cells.useState, was.useState) && same(cells.useReducer, was.useReducer) && same(cells.useRef, was.useRef) && cells.useMemo === was.useMemo &&
        cells.useEffect === was.useEffect && same(addedCallbacks, ["applyDomainEvent"]) && cells.useCallback.length === was.useCallback.length + 1 &&
        stateUnchanged && hookShape.mutable.length === 0 && events.mutable.length === 0,
      {
        now: { ...cells, useReducer: cells.useReducer.map((r) => r.binds) },
        baseline: { ...was, useReducer: was.useReducer.map((r) => r.binds) },
        addedCallbacks,
        routeStateUnchanged: stateUnchanged,
        mutableModuleState: [...hookShape.mutable, ...events.mutable],
      },
    );
  }

  // S8 — no event surface: the hook exports what 878057a exported, returns the same keys, re-exports nothing of
  // route-events; the product's consumers are byte for byte 878057a's; in src only the hook imports route-events; and
  // nothing in the hook or in route-events keeps, queues, publishes or subscribes to events (the keyboard listener is
  // the only listener, as before).
  {
    const src = (tree.rev
      ? execFileSync("git", ["ls-tree", "-r", "--name-only", tree.rev, "src"], { encoding: "utf8" })
      : execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "src"], { encoding: "utf8" }))
      .split("\n")
      .filter((file) => /\.(ts|tsx)$/.test(file) && tree.exists(file));
    const importers = src.filter((file) => file !== ROUTE_EVENTS && /route-events["']/.test(tree.read(file)));
    const hookShape = moduleShape(ROUTE_HOOK, hookText);
    const baseShape = moduleShape(ROUTE_HOOK, base.read(ROUTE_HOOK));
    const reexported = hookShape.exported.filter((name) => ROUTE_EVENTS_EXPORTS.includes(name));
    const consumers = CONSUMERS.map((file) => ({ file, unchanged: tree.read(file) === base.read(file) }));
    const surface = [ROUTE_HOOK, ROUTE_EVENTS].filter((file) => tree.exists(file) && EVENT_SURFACE.test(codeOnly(tree.read(file))));
    record(
      "S8",
      "NO_EVENT_SURFACE_PUBLIC_API_UNCHANGED",
      exists && same(importers, [ROUTE_HOOK]) && reexported.length === 0 && same(sorted(hookShape.exported), sorted(baseShape.exported)) &&
        same(hook.returnKeys, baseHook.returnKeys) && consumers.every((c) => c.unchanged) && surface.length === 0 && hook.addEventListener === baseHook.addEventListener,
      {
        sourceModulesScanned: src.length,
        importedBy: importers,
        reexportedByHook: reexported,
        hookExportsUnchanged: same(sorted(hookShape.exported), sorted(baseShape.exported)),
        returnedKeys: hook.returnKeys.length,
        returnedKeysUnchanged: same(hook.returnKeys, baseHook.returnKeys),
        consumers,
        eventHistoryBusOrQueueIn: surface,
        windowListeners: hook.addEventListener,
      },
    );
  }

  // S9 — the events sit in the turn's timeline, and the effects and completion around them stay in the hook: function by
  // function, the events applied, the sounds, the clock, generateMaze, onComplete and the calls that hand the turn on
  // come in exactly the order of TIMELINE (the end's sound, then ROUTE_ENDED, then onComplete; the wall opened, then
  // the stone, then the defenders; the board, then ROUTE_STARTED); every effect is called from the same functions, as
  // often, as at 878057a; route-events names none of them.
  {
    const timeline = Object.fromEntries(Object.keys(TIMELINE).map((fn) => [fn, hook.timeline[fn] ?? []]));
    const differ = Object.keys(TIMELINE).filter((fn) => !same(timeline[fn], TIMELINE[fn]));
    const effectsNow = Object.fromEntries(Object.entries(hook.effects).filter(([k]) => !k.startsWith("generateMaze")));
    const effectsBase = Object.fromEntries(Object.entries(baseHook.effects).filter(([k]) => !k.startsWith("generateMaze")));
    record(
      "S9",
      "EVENTS_IN_THE_TURNS_TIMELINE_EFFECTS_AND_COMPLETION_AROUND_THEM",
      hook.found && differ.length === 0 && same(effectsNow, effectsBase) && same(sorted(hook.generateMaze), ["startNewMaze", "useReducer:init"]) &&
        same(sorted(hook.generateMaze), sorted(baseHook.generateMaze)),
      {
        timelineDiffers: Object.fromEntries(differ.map((fn) => [fn, timeline[fn]])),
        sideEffectCallSites: effectsNow,
        sameSitesAsBaseline: same(effectsNow, effectsBase),
        generateMazeCalledIn: sorted(hook.generateMaze),
      },
    );
  }
  return out;
}

// =================================================================================================
// [contract]
// =================================================================================================

const deepFreeze = (value, seen = new Set()) => {
  if (value === null || typeof value !== "object" || seen.has(value) || Object.isFrozen(value)) return value;
  seen.add(value);
  if (value instanceof Set) {
    for (const v of value) deepFreeze(v, seen);
    for (const m of ["add", "delete", "clear"]) Object.defineProperty(value, m, { value: () => { throw new Error(`Set.${m} on a frozen input`); } });
  } else for (const v of Object.values(value)) deepFreeze(v, seen);
  return Object.freeze(value);
};
const snapshotOf = (value) => JSON.stringify(value, (_k, v) => (v instanceof Set ? { $set: [...v] } : v));
/** Two lists of transitions are the same when every field is the same value — objects by identity, not by copy. */
const sameTransitions = (a, b) =>
  Array.isArray(a) && a.length === b.length &&
  a.every((x, i) => x && same(Object.keys(x).sort(), Object.keys(b[i]).sort()) && Object.keys(x).every((k) => x[k] === b[i][k]));
const variantOf = (e) => [e.type, e.reason ?? e.cause ?? e.by ?? e.outcome ?? e.reward ?? (e.type === "ROUTE_STARTED" ? e.status : null)].filter(Boolean).join(":");

/** Generated boards, each with its Sentinel on its post: what every corpus is built from. */
function corpusMaps(tree, seedBase) {
  const rota = loadRouteModules({ tree, surface: ["generateMaze", "computePortalDefenceZone", "createSentinelState"] });
  const maps = [];
  for (const routeNumber of [1, 2, 3]) {
    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < 2; i += 1) {
        rota.setSeed(seedBase + routeNumber * 100 + DIFFICULTIES.indexOf(difficulty) * 10 + i);
        const map = rota.api.generateMaze(difficulty, routeNumber);
        const sentinel = rota.api.createSentinelState(map, rota.api.computePortalDefenceZone(map.playerStart, map.exitPosition, map.walls));
        maps.push({ map, sentinel, difficulty, routeNumber });
      }
    }
  }
  return maps;
}

/** One event of every kind and every meaning, with values taken from a real board. */
function eventsOn({ map, sentinel, difficulty, routeNumber }, rand) {
  const free = [];
  for (let row = 0; row < 9; row += 1) for (let col = 0; col < 9; col += 1) if (!map.walls.has(`${row},${col}`)) free.push({ row, col });
  const key = (c) => `${c.row},${c.col}`;
  const some = () => ({ ...pick(rand, free) });
  const turn = 1 + Math.floor(rand() * 40);
  const lights = map.collectibleStars.filter(() => rand() < 0.5).map(key);
  const trap = map.traps.length ? key(pick(rand, map.traps)) : "4,4";
  const wall = pick(rand, [...map.walls]);
  const defender = () => ({ position: some(), target: rand() < 0.5 ? null : some(), commitLeft: Math.floor(rand() * 4) });
  const message = pick(rand, ["Boa jogada. O Caçador se moveu.", "Caminho bloqueado. Escolha outra direção.", SC_EXPLORER, SC_DEFENDER, "Baú encontrado. Escolha a sua ferramenta."]);
  return [
    { type: "ROUTE_STARTED", routeNumber, difficulty, mazeMap: map, sentinel, status: "playing", message },
    { type: "ROUTE_STARTED", routeNumber, difficulty, mazeMap: map, sentinel, status: "setup", message },
    { type: "EXPLORER_STEP_BLOCKED", reason: "boundary", cell: { row: 9, col: Math.floor(rand() * 9) }, message },
    { type: "EXPLORER_STEP_BLOCKED", reason: "wall", cell: { row: Number(wall.split(",")[0]), col: Number(wall.split(",")[1]) }, message },
    { type: "EXPLORER_STEP_COMMITTED", turn, to: some(), collectedStars: lights, armedTrap: rand() < 0.5 ? null : trap },
    { type: "LIGHT_COLLECTED", turn, light: lights[0] ?? key(map.collectibleStars[0]) },
    { type: "PORTAL_ACTIVATED", turn },
    { type: "TRAP_ARMED", turn, trap },
    { type: "CHEST_OPENED", turn, message },
    { type: "REWARD_SELECTED", turn, reward: "pickaxe" },
    { type: "REWARD_SELECTED", turn, reward: "second-chance" },
    { type: "WALL_OPENED", turn, wall },
    ...["explorer", "hunter", "sentinel"].map((cause) => ({ type: "SECOND_CHANCE_USED", cause, turn, at: some(), message })),
    { type: "DEFENDERS_SETTLED", turn, guardian: some(), sentinel: defender(), message },
    ...["explorer-step", "hunter", "sentinel"].map((by) => ({ type: "EXPLORER_CAPTURED", by, turn, at: some(), guardian: some(), sentinel: defender(), errors: 1 + Math.floor(rand() * 3) })),
    ...["won", "lost"].map((outcome) => ({ type: "ROUTE_ENDED", outcome, turn, journeyCompleted: outcome === "won" && rand() < 0.5, message })),
  ];
}

/** A session state built on a real board, every field moved off its start. */
function randomState(createRouteState, { map, sentinel, difficulty }, rand) {
  const c = () => ({ row: Math.floor(rand() * 9), col: Math.floor(rand() * 9) });
  const key = (p) => `${p.row},${p.col}`;
  return {
    ...createRouteState({ difficulty, mazeMap: map, sentinel, status: pick(rand, ["setup", "playing", "won", "lost"]), message: `m${Math.floor(rand() * 9)}` }),
    player: c(),
    guardian: c(),
    sentinel: { position: c(), target: rand() < 0.5 ? null : c(), commitLeft: Math.floor(rand() * 4) },
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
  };
}

const CONTRACT_IDS = [
  ["M1", "EACH_EVENT_GIVES_EXACTLY_ITS_TRANSITIONS"],
  ["M2", "SAME_STATE_AS_THE_C5_TRANSITION"],
  ["M3", "MAPPING_IS_PURE_AND_DETERMINISTIC"],
  ["M4", "OBSERVATIONAL_EVENTS_WRITE_NOTHING"],
  ["M5", "TRANSITIONS_DEPEND_ONLY_ON_THE_KIND_NOT_ON_THE_MEANING"],
];

function contractChecks(tree) {
  const out = [];
  const record = (id, name, pass, detail) => out.push({ id, kind: "contract", name, pass, detail });
  if (!tree.exists(ROUTE_EVENTS)) {
    for (const [id, name] of CONTRACT_IDS) record(id, name, false, { routeEvents: "absent — the hook dispatches the eleven C5 actions itself" });
    return out;
  }
  // The mapping in a realm where every ambient capability is poisoned: touching any of them throws, so a corpus that
  // runs clean proves none was touched.
  const touched = [];
  const poison = (name) => new Proxy(function poisoned() {}, {
    get: (_t, k) => {
      touched.push(`${name}.${String(k)}`);
      throw new Error(`route-events touched ${name}.${String(k)}`);
    },
    apply: () => {
      touched.push(`${name}()`);
      throw new Error(`route-events called ${name}`);
    },
    construct: () => {
      touched.push(`new ${name}`);
      throw new Error(`route-events constructed ${name}`);
    },
  });
  const graph = createModuleGraph({ tree, globals: { Math: poison("Math"), Date: poison("Date"), performance: poison("performance"), crypto: poison("crypto") } });
  const { routeStateActionsForEvent: map } = graph.require(ROUTE_EVENTS);
  const loaded = graph.modules().map((m) => m.file);
  const stateNow = createModuleGraph({ tree }).require(ROUTE_STATE);
  const stateBase = createModuleGraph({ tree: openSourceTree({ rev: BASELINE }) }).require(ROUTE_STATE);
  const maps = corpusMaps(tree, 66_000);
  const rand = prng(6_600_006);

  const exact = [];
  const folds = [];
  const purity = [];
  const writers = {};
  const shapes = {};
  const perturbed = [];
  const variants = {};
  let calls = 0;
  let foldsRun = 0;
  for (let round = 0; round < 12; round += 1) {
    for (const board of maps) {
      for (const event of eventsOn(board, rand)) {
        const label = variantOf(event);
        tally(variants, label);
        const twin = { ...event };
        deepFreeze(event);
        const before = snapshotOf(event);
        let first;
        let second;
        const threw = errorOf(() => {
          first = map(event);
          second = map(twin);
        });
        calls += 2;
        // M3 — no throw, input untouched, equal twice, a fresh list every call.
        if (threw || snapshotOf(event) !== before || snapshotOf(first) !== snapshotOf(second) || (first === second && first !== undefined)) {
          if (purity.length < 5) purity.push({ label, threw, mutated: snapshotOf(event) !== before, deterministic: snapshotOf(first) === snapshotOf(second), shared: first === second });
          continue;
        }
        // M1 — exactly the expected transitions, values by identity.
        const want = expectedTransitions(event);
        if (!sameTransitions(first, want) && exact.length < 6) exact.push({ label, got: first?.map((a) => a?.type), want: want.map((a) => a.type) });
        // M4 — who writes.
        (writers[event.type] ??= new Set()).add(first.length);
        // M5 — the transitions' kinds are fixed per meaning, whatever the values.
        (shapes[label] ??= new Set()).add(first.map((a) => a.type).join(","));
        // M5 — what only describes the occurrence (who, why, where, which Route) never reaches a transition.
        const informational = { routeNumber: 99, reason: event.reason === "wall" ? "boundary" : "wall", cell: { row: -1, col: -1 }, at: { row: -1, col: -1 },
          by: event.by === "hunter" ? "sentinel" : "hunter", journeyCompleted: !event.journeyCompleted, light: "x", trap: "x" };
        if (!["EXPLORER_STEP_COMMITTED", "WALL_OPENED"].includes(event.type) && !(event.type === "SECOND_CHANCE_USED" && event.cause === "explorer")) informational.turn = -7;
        const variant = { ...twin, ...Object.fromEntries(Object.entries(informational).filter(([k]) => k in twin)) };
        const other = errorOf(() => map(variant)) ?? map(variant);
        if (!sameTransitions(other, first) && perturbed.length < 5) perturbed.push({ label, changed: Object.keys(informational).filter((k) => k in twin) });
        // M2 — folded through the reducer, the same state as the C5 transition through 878057a's reducer.
        for (let s = 0; s < 3; s += 1) {
          const state = randomState(stateNow.createRouteState, board, rand);
          const viaEvent = first.reduce(stateNow.routeStateReducer, state);
          const viaC5 = want.reduce(stateBase.routeStateReducer, state);
          foldsRun += 1;
          if (snapshotOf(viaEvent) !== snapshotOf(viaC5) && folds.length < 5) folds.push({ label, field: Object.keys(viaC5).find((k) => snapshotOf(viaEvent[k]) !== snapshotOf(viaC5[k])) });
        }
      }
    }
  }
  const covered = Object.keys(variants).sort();
  record("M1", "EACH_EVENT_GIVES_EXACTLY_ITS_TRANSITIONS", exact.length === 0 && purity.length === 0 && same(covered, sorted(MEANINGS)), {
    eventsMapped: calls / 2,
    variants: covered,
    contract: Object.fromEntries(Object.keys(EXPECTED_TRANSITIONS).map((k) => [k, EXPECTED_TRANSITIONS[k](new Proxy({}, { get: (_t, p) => p })).map((a) => a.type).join(" + ") || "—"])),
    violations: exact,
  });
  record("M2", "SAME_STATE_AS_THE_C5_TRANSITION", folds.length === 0 && foldsRun > 2000, {
    folds: foldsRun,
    statesFromMaps: maps.length,
    reducer: "route-state's own (working tree) vs 878057a's — never a copy",
    violations: folds,
  });
  record("M3", "MAPPING_IS_PURE_AND_DETERMINISTIC", purity.length === 0 && touched.length === 0 && same(loaded, [ROUTE_EVENTS]) && calls > 5000, {
    calls,
    poisoned: ["Math", "Date", "performance", "crypto", "and every browser global (absent from the realm)"],
    touched: [...new Set(touched)],
    modulesLoaded: loaded,
    violations: purity,
  });
  const silent = Object.entries(writers).filter(([, n]) => same([...n], [0])).map(([type]) => type).sort();
  const writing = Object.entries(writers).filter(([, n]) => ![...n].includes(0)).map(([type]) => type).sort();
  record("M4", "OBSERVATIONAL_EVENTS_WRITE_NOTHING", same(silent, sorted(OBSERVATIONAL)) && same(writing, sorted(EVENTS.filter((t) => !OBSERVATIONAL.includes(t)))), {
    withTransitions: writing.length,
    observational: silent,
    transitionsPerKind: Object.fromEntries(Object.entries(writers).map(([t, n]) => [t, [...n]])),
  });
  const unstable = Object.entries(shapes).filter(([, s]) => s.size !== 1).map(([k, s]) => `${k}: ${[...s].join(" | ")}`);
  const shapeOf = (label) => [...(shapes[label] ?? [])].join(" | ") || "never mapped";
  const captures = ["explorer-step", "hunter", "sentinel"].map((by) => shapeOf(`EXPLORER_CAPTURED:${by}`));
  record("M5", "TRANSITIONS_DEPEND_ONLY_ON_THE_KIND_NOT_ON_THE_MEANING", unstable.length === 0 && perturbed.length === 0 &&
    same(captures, ["COMMIT_CAPTURE", "COMMIT_CAPTURE", "COMMIT_CAPTURE"]) &&
    shapeOf("SECOND_CHANCE_USED:hunter") === "SPEND_SECOND_CHANCE" && shapeOf("SECOND_CHANCE_USED:sentinel") === "SPEND_SECOND_CHANCE" &&
    shapeOf("SECOND_CHANCE_USED:explorer") === "SPEND_SECOND_CHANCE,COUNT_TURN", {
    transitionsByKind: Object.fromEntries(Object.entries(shapes).map(([k, s]) => [k, [...s]])),
    unstable,
    meaningReachedATransition: perturbed,
    note: "a capture by the Explorer's own step, the Hunter or the Sentinel is ONE transition (COMMIT_CAPTURE); the event tells them apart",
  });
  return out;
}

// =================================================================================================
// [trace] — the semantic trace of real games, observed through the C0 graph
// =================================================================================================

/**
 * The Rota on the runtime harness, with three things observed and nothing changed: the trace (the mapping and the
 * reducer wrapped where they are declared — route-react-runtime's `instrumentEvents`), the defenders' actual decisions
 * (their policies wrapped the same way: pass-through, no extra draw), and the board generation, which a hand-built
 * board can stand in for.
 */
function createTracedRota({ rev = null, sourceOverrides, sounds = null } = {}) {
  const mocks = sounds && {
    "src/lib/game-sounds.ts": {
      playGentleErrorTone: () => sounds.push("sound:error"),
      playSuccessChime: () => sounds.push("sound:success"),
      playStoneBreak: () => sounds.push("sound:stone"),
    },
  };
  const runtime = loadRouteRuntime({ rev, sourceOverrides, mocks });
  const graph = runtime.LAB.graph;
  const tracer = instrumentEvents(graph);
  const generation = graph.require(graph.tree.declaring("generateMaze"));
  const generate = generation.generateMaze;
  const defenders = graph.require(graph.tree.declaring("chooseGuardianMove"));
  const decisions = [];
  const hunter = defenders.chooseGuardianMove;
  const sentinel = defenders.decideSentinelMove;
  defenders.chooseGuardianMove = (...a) => {
    const move = hunter(...a);
    decisions.push({ who: "hunter", move });
    return move;
  };
  defenders.decideSentinelMove = (...a) => {
    const move = sentinel(...a);
    decisions.push({ who: "sentinel", move });
    return move;
  };
  return {
    runtime,
    tracer,
    api: runtime.API,
    useBoard(make) {
      generation.generateMaze = make ?? generate;
    },
    takeDecisions: () => decisions.splice(0),
  };
}

/** A hand-built 9x9 board: `#` wall, `P` Explorer, `H` Hunter, `E` portal, `L` light, `T` trap, `X` a light on a trap, `C` Chest. */
function handBuilt(rows) {
  return () => {
    const grid = [];
    const walls = new Set();
    const stars = [];
    const traps = [];
    let player = null;
    let guardian = null;
    let exit = null;
    let chest = null;
    rows.forEach((line, row) => {
      grid.push([...line].map((ch, col) => {
        const p = { row, col };
        if (ch === "#") {
          walls.add(`${row},${col}`);
          return 1;
        }
        if (ch === "P") player = p;
        if (ch === "H") guardian = p;
        if (ch === "E") exit = p;
        if (ch === "L" || ch === "X") stars.push({ ...p });
        if (ch === "T" || ch === "X") traps.push({ ...p });
        if (ch === "C") chest = p;
        return 0;
      }));
    });
    return { grid, walls, playerStart: player, guardianStart: guardian, exitPosition: exit, collectibleStars: stars, traps, chest };
  };
}

const DELTA = { U: { row: -1, col: 0 }, D: { row: 1, col: 0 }, L: { row: 0, col: -1 }, R: { row: 0, col: 1 } };

/**
 * Drive one scenario through the traced Rota and record every input: its label, the render before and after, the
 * events the seam applied, the transitions they gave and the reducer runs, the defenders' decisions, the completions.
 *
 * A scenario is `{ name, seed, routeNumber, changeDifficulty?, initialDifficulty?, board?, script? | steps? }`:
 * `script` is a hand-written list — "start", "restart", "mode:<level>", "U"/"D"/"L"/"R", "choose:<reward>",
 * "break:r,c", "next" — and `steps` the scripted Explorers of route-react-runtime (["play", budget, { policy }],
 * ["move", delta], ["restart"], ["changeDifficulty", mode], ["start"], ["next", seed]).
 */
function drive(rota, scenario) {
  rota.useBoard(scenario.board ? handBuilt(scenario.board) : null);
  const inputs = [];
  const mounts = [];
  let run = null;
  let completions = [];
  const open = ({ seed, routeNumber, initialDifficulty }) => {
    rota.tracer.take();
    run = rota.runtime.mount({ seed, routeNumber, initialDifficulty, autoStart: false });
    mounts.push(rota.tracer.take().events);
  };
  const input = (label, fn) => {
    const before = run.state;
    const done = run.completions.length;
    rota.tracer.take();
    rota.takeDecisions();
    run.act(fn);
    const { events, actions, reducerCalls } = rota.tracer.take();
    const after = run.state;
    const finished = run.completions.slice(done);
    completions = [...completions, ...finished];
    inputs.push({ scenario: scenario.name, index: inputs.length, label, before, after, events, actions, reducerCalls, decisions: rota.takeDecisions(), completions: finished });
  };
  const next = (seed) => {
    const continuation = completions.at(-1)?.continuation;
    if (!continuation) return false;
    open({ seed, routeNumber: continuation.routeNumber, initialDifficulty: continuation.difficulty });
    input("start", (g) => g.startGame());
    return true;
  };
  try {
    open(scenario);
    if (scenario.changeDifficulty) input(`changeDifficulty:${scenario.changeDifficulty}`, (g) => g.changeDifficulty(scenario.changeDifficulty));
    for (const token of scenario.script ?? []) {
      if (token === "start") input("start", (g) => g.startGame());
      else if (token === "restart") input("restart", (g) => g.restartGame());
      else if (token === "next") next(scenario.seed);
      else if (token.startsWith("mode:")) input(`changeDifficulty:${token.slice(5)}`, (g) => g.changeDifficulty(token.slice(5)));
      else if (token.startsWith("choose:")) input("choose", (g) => g.chooseReward(token.slice(7)));
      else if (token.startsWith("break:")) {
        const [row, col] = token.slice(6).split(",").map(Number);
        input("break", (g) => g.breakWall({ row, col }));
      } else input(`move:${token}`, (g) => g.tryMovePlayer(DELTA[token]));
    }
    if (scenario.steps) {
      if (scenario.autoStart !== false) input("start", (g) => g.startGame());
      for (const [kind, arg, options] of scenario.steps) {
        if (kind === "play") {
          const memo = {};
          for (let guard = 0; guard < arg && run.state.status === "playing"; guard += 1) {
            const action = nextAction(run.state, options?.policy ?? "win", rota.api, memo);
            if (!action) break;
            input(action[0], (g) => applyAction(g, action));
          }
        } else if (kind === "next") next(arg);
        else if (kind === "move") input("move", (g) => g.tryMovePlayer(arg));
        else input(kind === "changeDifficulty" ? `changeDifficulty:${arg}` : kind, (g) => applyAction(g, [kind, arg]));
      }
    }
  } finally {
    rota.useBoard(null);
  }
  return { inputs, mounts };
}

/** One line per event: its kind and its meaning, where and when. Robust to a malformed (mutated) event. */
function brief(e) {
  if (!e || typeof e !== "object") return `NOT_AN_EVENT ${String(e)}`;
  switch (e.type) {
    case "ROUTE_STARTED": return `ROUTE_STARTED R${e.routeNumber} ${e.difficulty} ${e.status}`;
    case "EXPLORER_STEP_BLOCKED": return `EXPLORER_STEP_BLOCKED ${e.reason} ${cell(e.cell)}`;
    case "EXPLORER_STEP_COMMITTED": return `EXPLORER_STEP_COMMITTED t${e.turn} ${cell(e.to)}${e.armedTrap ? ` trap=${e.armedTrap}` : ""}`;
    case "LIGHT_COLLECTED": return `LIGHT_COLLECTED t${e.turn} ${e.light}`;
    case "PORTAL_ACTIVATED": return `PORTAL_ACTIVATED t${e.turn}`;
    case "TRAP_ARMED": return `TRAP_ARMED t${e.turn} ${e.trap}`;
    case "CHEST_OPENED": return `CHEST_OPENED t${e.turn}`;
    case "REWARD_SELECTED": return `REWARD_SELECTED t${e.turn} ${e.reward}`;
    case "WALL_OPENED": return `WALL_OPENED t${e.turn} ${e.wall}`;
    case "SECOND_CHANCE_USED": return `SECOND_CHANCE_USED ${e.cause} t${e.turn} ${cell(e.at)}`;
    case "DEFENDERS_SETTLED": return `DEFENDERS_SETTLED t${e.turn} hunter=${cell(e.guardian)} sentinel=${cell(e.sentinel?.position)}`;
    case "EXPLORER_CAPTURED": return `EXPLORER_CAPTURED ${e.by} t${e.turn} ${cell(e.at)} errors=${e.errors}`;
    case "ROUTE_ENDED": return `ROUTE_ENDED ${e.outcome} t${e.turn}${e.journeyCompleted ? " journey-completed" : ""}`;
    default: return `UNKNOWN ${JSON.stringify(e).slice(0, 60)}`;
  }
}

/** The grammar's alphabet: an event's kind with its meaning. */
const token = (e) =>
  ({ ROUTE_STARTED: `START:${e?.status}`, EXPLORER_STEP_BLOCKED: `BLOCK:${e?.reason}`, SECOND_CHANCE_USED: `SC:${e?.cause}`, EXPLORER_CAPTURED: `CAP:${e?.by}`, ROUTE_ENDED: `END:${e?.outcome}`,
    EXPLORER_STEP_COMMITTED: "STEP", LIGHT_COLLECTED: "LIGHT", PORTAL_ACTIVATED: "PORTAL", TRAP_ARMED: "TRAP", CHEST_OPENED: "CHEST", REWARD_SELECTED: "REWARD",
    WALL_OPENED: "WALL", DEFENDERS_SETTLED: "SETTLED" })[e?.type] ?? `?${e?.type}`;
/**
 * The turn, as a language over one input's events. The step first; then what it did (the light, the portal that light
 * opened, the trap); then the Chest's pause, the win, or the defenders' answer — settle, a Second Chance (Hunter,
 * Sentinel), or a capture and the end. The reward and the Pickaxe resume or spend a turn into the same answer. An
 * Explorer walking into a defender is a capture or its own Second Chance, and the defenders are never asked.
 */
const PHASE = "(?: SETTLED| SC:(?:hunter|sentinel)| CAP:(?:hunter|sentinel) END:lost)";
const GRAMMAR = new RegExp(
  `^(?:START:(?:playing|setup)|BLOCK:(?:boundary|wall)|SC:explorer|STEP CAP:explorer-step END:lost|STEP(?: LIGHT(?: PORTAL)?)?(?: TRAP)?(?: END:won| CHEST|${PHASE})|REWARD${PHASE}|WALL${PHASE})?$`,
);
const isMove = (label) => /^(move|step)/.test(label);

/**
 * What the render shows, and what the defenders actually decided, against the events the hook applied — an oracle
 * that never reads the trace to judge it. Every event must be true of the render, and every change of the render the
 * events describe must have its event.
 */
function audit(input) {
  const { label, before: b, after: a, events, decisions, completions } = input;
  if (!Array.isArray(events)) return ["no semantic trace"];
  const problems = [];
  const expect = (ok, message) => {
    if (!ok) problems.push(message);
  };
  const of = (type) => events.filter((e) => e?.type === type);
  const one = (type) => of(type)[0];
  const sentinelOf = (g) => ({ position: g.sentinel, target: g.sentinelTarget, commitLeft: g.sentinelCommitLeft });
  const key = (p) => `${p.row},${p.col}`;
  const inside = (p) => p.row >= 0 && p.row < 9 && p.col >= 0 && p.col < 9;
  const hunterMove = decisions.find((d) => d.who === "hunter")?.move;
  const sentinelMove = decisions.find((d) => d.who === "sentinel")?.move;
  const fresh = Boolean(one("ROUTE_STARTED"));
  expect(input.actions === input.reducerCalls, `the reducer ran ${input.reducerCalls}x for ${input.actions} transitions`);
  for (const e of events) {
    const fields = Object.keys(e ?? {}).filter((k) => k !== "type").sort();
    expect(same(fields, sorted(PAYLOAD[e?.type] ?? ["?"])), `${e?.type}: payload ${fields.join(",")}`);
  }
  // ROUTE_STARTED — only on start / restart / a mode change, alone, describing the new session the render shows.
  const startLabel = label === "start" || label === "restart" || label.startsWith("changeDifficulty");
  expect(fresh === startLabel, `ROUTE_STARTED ${fresh ? "on" : "missing from"} ${label}`);
  if (fresh) {
    const e = one("ROUTE_STARTED");
    expect(events.length === 1, "ROUTE_STARTED is not alone");
    expect(e.mazeMap === a.mazeMap && e.mazeMap !== b.mazeMap, "ROUTE_STARTED is not the new board");
    expect(e.routeNumber === a.routeNumber && e.difficulty === a.difficulty && e.status === a.status && e.message === a.message, "ROUTE_STARTED differs from the session");
    expect(e.status === (label.startsWith("changeDifficulty") ? "setup" : "playing"), `ROUTE_STARTED ${e.status} on ${label}`);
    expect(same(e.sentinel, sentinelOf(a)) && a.turns === 0, "ROUTE_STARTED: the Sentinel or the counters differ");
    return problems;
  }
  // EXPLORER_STEP_BLOCKED — exactly when a blocked move is counted; why, and where.
  const blocked = one("EXPLORER_STEP_BLOCKED");
  expect(Boolean(blocked) === (a.blockedMoves === b.blockedMoves + 1), "EXPLORER_STEP_BLOCKED ⇔ blockedMoves + 1");
  if (blocked) {
    const off = !inside(blocked.cell);
    expect(events.length === 1, "EXPLORER_STEP_BLOCKED is not alone");
    expect(Math.abs(blocked.cell.row - b.player.row) + Math.abs(blocked.cell.col - b.player.col) === 1, "EXPLORER_STEP_BLOCKED: not the next cell");
    expect(blocked.reason === (off ? "boundary" : "wall") && (off || setOf(b.walls).has(key(blocked.cell))), `EXPLORER_STEP_BLOCKED ${blocked.reason} at ${cell(blocked.cell)}`);
    expect(blocked.message === a.message, "EXPLORER_STEP_BLOCKED: message differs");
  }
  // EXPLORER_STEP_COMMITTED — the Explorer is where it says, on the turn it says, with the lights and trap it says.
  const step = one("EXPLORER_STEP_COMMITTED");
  if (step) {
    expect(isMove(label), `EXPLORER_STEP_COMMITTED on ${label}`);
    expect(step.turn === b.turns + 1 && a.turns === step.turn, "EXPLORER_STEP_COMMITTED: turn");
    expect(at(a.player, step.to) && Math.abs(step.to.row - b.player.row) + Math.abs(step.to.col - b.player.col) === 1, "EXPLORER_STEP_COMMITTED: position");
    expect(same([...setOf(a.collectedSet)], step.collectedStars), "EXPLORER_STEP_COMMITTED: lights");
    expect(step.armedTrap === null ? a.trapsTriggered === b.trapsTriggered : setOf(a.triggeredTrapSet).has(step.armedTrap) && !setOf(b.triggeredTrapSet).has(step.armedTrap), "EXPLORER_STEP_COMMITTED: trap");
  }
  // LIGHT_COLLECTED, PORTAL_ACTIVATED, TRAP_ARMED — exactly when the render gained a light, opened the portal, armed a trap.
  const light = one("LIGHT_COLLECTED");
  expect(Boolean(light) === (a.collectedCount === b.collectedCount + 1), "LIGHT_COLLECTED ⇔ one more light");
  if (light) expect(light.light === key(a.player) && !setOf(b.collectedSet).has(light.light) && light.turn === a.turns, "LIGHT_COLLECTED: which light");
  expect(Boolean(one("PORTAL_ACTIVATED")) === (!b.portalActive && a.portalActive), "PORTAL_ACTIVATED ⇔ the portal opened");
  const trap = one("TRAP_ARMED");
  expect(Boolean(trap) === (a.trapsTriggered === b.trapsTriggered + 1), "TRAP_ARMED ⇔ one more armed trap");
  if (trap) expect(trap.trap === key(a.player) && trap.turn === a.turns, "TRAP_ARMED: which trap");
  // CHEST_OPENED — exactly when the Chest opened; the turn waits.
  const chest = one("CHEST_OPENED");
  expect(Boolean(chest) === (!b.chestOpened && a.chestOpened), "CHEST_OPENED ⇔ the Chest opened");
  if (chest) expect(a.rewardChoicePending && chest.turn === a.turns && chest.message === a.message && decisions.length === 0, "CHEST_OPENED: the turn did not pause");
  // REWARD_SELECTED — the choice, on the paused turn: no turn of its own.
  const reward = one("REWARD_SELECTED");
  expect(Boolean(reward) === (b.rewardSelected === null && a.rewardSelected !== null), "REWARD_SELECTED ⇔ a reward was chosen");
  if (reward) expect(label === "choose" && reward.reward === a.rewardSelected && reward.turn === b.turns && a.turns === b.turns && b.rewardChoicePending, "REWARD_SELECTED: not the paused turn");
  // WALL_OPENED — the Pickaxe's wall, spent, as a turn.
  const wall = one("WALL_OPENED");
  expect(Boolean(wall) === (b.brokenWall === null && a.brokenWall !== null), "WALL_OPENED ⇔ a wall was opened");
  if (wall) expect(/^(break|key:Enter)/.test(label) && wall.wall === a.brokenWall && wall.turn === b.turns + 1 && a.turns === wall.turn && a.pickaxeSpent, "WALL_OPENED: wall or turn");
  // SECOND_CHANCE_USED — exactly when the charge was spent; WHO it saved the Explorer from, from the decisions.
  const sc = one("SECOND_CHANCE_USED");
  // Held before the input — or chosen by it: a Second Chance protects the rest of the very turn it is chosen in.
  const held = b.secondChanceAvailable || reward?.reward === "second-chance";
  expect(Boolean(sc) === (held && a.secondChanceSpent), "SECOND_CHANCE_USED ⇔ the charge was spent");
  if (sc) {
    const nobodyMoved = at(a.guardian, b.guardian) && at(a.sentinel, b.sentinel);
    expect(nobodyMoved, "SECOND_CHANCE_USED: a defender's move was kept");
    if (sc.cause === "explorer") {
      expect(isMove(label) && events.length === 1 && decisions.length === 0 && at(a.player, b.player) && a.turns === b.turns + 1 && sc.turn === a.turns &&
        (at(sc.at, b.guardian) || at(sc.at, b.sentinel)) && a.message === SC_EXPLORER, "SECOND_CHANCE_USED explorer: not the Explorer stepping into a defender");
    } else if (sc.cause === "hunter") {
      expect(at(hunterMove, a.player) && !sentinelMove && at(sc.at, a.player) && sc.turn === a.turns && a.message === SC_DEFENDER, "SECOND_CHANCE_USED hunter: the Hunter did not step in");
      expect(isMove(label) || /^(choose|break|key:Enter)/.test(label), `SECOND_CHANCE_USED hunter on ${label}`);
    } else if (sc.cause === "sentinel") {
      expect(hunterMove && !at(hunterMove, a.player) && at(sentinelMove?.position, a.player) && at(sc.at, a.player) && sc.turn === a.turns && a.message === SC_DEFENDER,
        "SECOND_CHANCE_USED sentinel: the Sentinel did not step in");
    } else problems.push(`SECOND_CHANCE_USED: cause ${sc.cause}`);
  }
  // EXPLORER_CAPTURED — exactly when the Route was lost; WHO caught the Explorer, from the decisions and the board.
  const capture = one("EXPLORER_CAPTURED");
  expect(Boolean(capture) === (b.status === "playing" && a.status === "lost"), "EXPLORER_CAPTURED ⇔ the Route was lost");
  if (capture) {
    expect(a.errors === b.errors + 1 && capture.errors === a.errors && at(capture.at, a.player) && capture.turn === a.turns, "EXPLORER_CAPTURED: errors, cell or turn");
    expect(at(capture.guardian, a.guardian) && at(capture.sentinel?.position, a.sentinel), "EXPLORER_CAPTURED: pieces");
    if (capture.by === "explorer-step") {
      expect(decisions.length === 0 && (at(capture.at, b.guardian) || at(capture.at, b.sentinel)) && at(a.guardian, b.guardian) && at(a.sentinel, b.sentinel),
        "EXPLORER_CAPTURED explorer-step: not the Explorer's own step");
    } else if (capture.by === "hunter") {
      expect(at(hunterMove, capture.at) && !sentinelMove && at(a.guardian, capture.at) && at(a.sentinel, b.sentinel), "EXPLORER_CAPTURED hunter: the Hunter did not step in");
    } else if (capture.by === "sentinel") {
      expect(hunterMove && !at(hunterMove, capture.at) && at(sentinelMove?.position, capture.at) && at(a.sentinel, capture.at), "EXPLORER_CAPTURED sentinel: the Sentinel did not step in");
    } else problems.push(`EXPLORER_CAPTURED: by ${capture.by}`);
  }
  // DEFENDERS_SETTLED — the defenders answered and caught nobody: they stand where they decided.
  const settled = one("DEFENDERS_SETTLED");
  if (settled) {
    expect(at(settled.guardian, a.guardian) && at(hunterMove, a.guardian) && same(settled.sentinel, sentinelOf(a)) && Boolean(sentinelMove), "DEFENDERS_SETTLED: not where the defenders decided");
    expect(!at(a.guardian, a.player) && !at(a.sentinel, a.player) && settled.turn === a.turns && settled.message === a.message && a.status === "playing", "DEFENDERS_SETTLED: someone caught, or the turn differs");
  }
  expect(Boolean(settled || sc?.cause === "hunter" || sc?.cause === "sentinel" || capture?.by === "hunter" || capture?.by === "sentinel") === decisions.length > 0,
    "the defenders were asked without an answer in the trace (or answered without being asked)");
  // ROUTE_ENDED — exactly when the Route ended, as onComplete reported it.
  const ended = one("ROUTE_ENDED");
  expect(Boolean(ended) === (b.status === "playing" && (a.status === "won" || a.status === "lost")), "ROUTE_ENDED ⇔ the Route ended");
  expect(Boolean(ended) === (completions.length === 1), "ROUTE_ENDED ⇔ one completion");
  if (ended) {
    const result = completions[0];
    expect(ended.outcome === a.status && result?.details?.won === (ended.outcome === "won") && ended.journeyCompleted === (result?.details?.journeyCompleted === true), "ROUTE_ENDED: outcome or journey");
    expect(ended.turn === a.turns && result?.details?.turns === a.turns && ended.message === a.message, "ROUTE_ENDED: turn or message");
  }
  // Nothing in the trace, nothing changed.
  if (events.length === 0) expect(snapshotOf(withoutFunctions(a)) === snapshotOf(withoutFunctions(b)), `${label}: the render changed with no event`);
  return problems;
}
const withoutFunctions = (g) => Object.fromEntries(Object.entries(g).filter(([, v]) => typeof v !== "function"));

// --- the situations, on hand-built boards: every event, every meaning, a few inputs each ----------

/** The Hunter penned in the top-left corner, walled in: it can never move, so the Sentinel alone answers. */
const PENNED = ["H#.......", "##......."];
const BOARDS = {
  /** Lights, a trap, a light on a trap (the last light: it opens the portal), the Chest, a wall above it for the Pickaxe. */
  overlays: ["E.......H", ".........", ".........", ".........", ".........", ".........", ".........", "#...#....", "PLTXC...."],
  /** A corridor: the Hunter an even distance away (it steps in), the Chest first. */
  corridorEven: ["E........", ".........", ".........", ".........", ".........", ".........", ".........", "#########", "PC....H.."],
  /** The same, an odd distance away (the Explorer steps in). */
  corridorOdd: ["E........", ".........", ".........", ".........", ".........", ".........", ".........", "#########", "PC...H..."],
  /** The Hunter, no Chest. */
  corridorHunter: ["E........", ".........", ".........", ".........", ".........", ".........", ".........", "#########", "P...H...."],
  /** The portal in a corner behind a wall, one door open toward the Explorer: the Sentinel steps out onto it. */
  sentinelDoor: [...PENNED, ".........", "........P", ".........", ".....#...", ".....#...", ".....#...", "........E"],
  /** The same, the Chest on the way. */
  sentinelDoorChest: [...PENNED, ".........", "........P", "........C", ".....#...", ".....#...", ".....#...", "........E"],
  /** An open row to the portal: the Sentinel comes to hold it, the Explorer walks into it. */
  sentinelOpen: [...PENNED, ".........", ".........", ".........", ".........", ".........", ".........", "P.......E"],
  /** The portal two cells off, its one light one cell beyond it. */
  portalRun: [...PENNED, ".........", ".........", ".........", ".........", ".........", "L........", "E..P....."],
};
const SYNTHETIC = [
  {
    name: "overlays: start, blocked by the boundary and by a wall, a light, a trap, the last light on a trap, the Chest, a frozen input, the Pickaxe, its hint, the wall opened, restart, mode change, an input on setup, start",
    board: BOARDS.overlays, seed: 1, routeNumber: 1, initialDifficulty: "hard",
    script: ["start", "D", "U", "R", "R", "R", "R", "R", "choose:pickaxe", "U", "break:7,4", "restart", "mode:easy", "R", "start"],
  },
  { name: "corridorEven: Second Chance (Hunter), then the Explorer steps onto the Hunter", board: BOARDS.corridorEven, seed: 1, routeNumber: 1, initialDifficulty: "hard", script: ["start", "R", "choose:second-chance", "R", "R", "R"] },
  { name: "corridorOdd: Second Chance (Explorer), then the Explorer steps onto the Hunter", board: BOARDS.corridorOdd, seed: 1, routeNumber: 1, initialDifficulty: "hard", script: ["start", "R", "choose:second-chance", "R", "R", "R"] },
  { name: "corridorHunter: the Hunter's capture", board: BOARDS.corridorHunter, seed: 1, routeNumber: 1, initialDifficulty: "hard", script: ["start", "R", "R"] },
  { name: "sentinelDoor: the Sentinel moves, then captures", board: BOARDS.sentinelDoor, seed: 1, routeNumber: 1, initialDifficulty: "hard", script: ["start", "D", "D"] },
  { name: "sentinelDoorChest: Second Chance (Sentinel)", board: BOARDS.sentinelDoorChest, seed: 1, routeNumber: 1, initialDifficulty: "hard", script: ["start", "D", "choose:second-chance", "D"] },
  { name: "sentinelOpen: the Explorer steps onto the Sentinel", board: BOARDS.sentinelOpen, seed: 1, routeNumber: 1, initialDifficulty: "hard", script: ["start", "R", "R", "R", "R", "R"] },
  { name: "portalRun: the portal before its light, the light, the win on Route 1, Route 2 opened", board: BOARDS.portalRun, seed: 1, routeNumber: 1, initialDifficulty: "hard", script: ["start", "L", "L", "L", "U", "D", "next"] },
  { name: "portalRun: the win on Route 3 completes the journey", board: BOARDS.portalRun, seed: 1, routeNumber: 3, initialDifficulty: "medium", script: ["start", "L", "L", "L", "U", "D"] },
  { name: "corridorHunter: lost on Route 3, Route 3 again", board: BOARDS.corridorHunter, seed: 1, routeNumber: 3, initialDifficulty: "hard", script: ["start", "R", "R", "next"] },
];

/** The traces C6 produces for those situations, pinned: `label: event | event | …`, one line per input. */
const EXPECTED_SYNTHETIC = {
  "overlays: start, blocked by the boundary and by a wall, a light, a trap, the last light on a trap, the Chest, a frozen input, the Pickaxe, its hint, the wall opened, restart, mode change, an input on setup, start": [
    "start: ROUTE_STARTED R1 hard playing",
    "move:D: EXPLORER_STEP_BLOCKED boundary 9,0",
    "move:U: EXPLORER_STEP_BLOCKED wall 7,0",
    "move:R: EXPLORER_STEP_COMMITTED t1 8,1 | LIGHT_COLLECTED t1 8,1 | DEFENDERS_SETTLED t1 hunter=0,7 sentinel=2,0",
    "move:R: EXPLORER_STEP_COMMITTED t2 8,2 trap=8,2 | TRAP_ARMED t2 8,2 | DEFENDERS_SETTLED t2 hunter=1,7 sentinel=1,0",
    "move:R: EXPLORER_STEP_COMMITTED t3 8,3 trap=8,3 | LIGHT_COLLECTED t3 8,3 | PORTAL_ACTIVATED t3 | TRAP_ARMED t3 8,3 | DEFENDERS_SETTLED t3 hunter=1,6 sentinel=1,0",
    "move:R: EXPLORER_STEP_COMMITTED t4 8,4 | CHEST_OPENED t4",
    "move:R: ",
    "choose: REWARD_SELECTED t4 pickaxe | DEFENDERS_SETTLED t4 hunter=1,5 sentinel=1,0",
    "move:U: EXPLORER_STEP_BLOCKED wall 7,4",
    "break: WALL_OPENED t5 7,4 | DEFENDERS_SETTLED t5 hunter=1,4 sentinel=1,0",
    "restart: ROUTE_STARTED R1 hard playing",
    "changeDifficulty:easy: ROUTE_STARTED R1 easy setup",
    "move:R: ",
    "start: ROUTE_STARTED R1 easy playing",
  ],
  "corridorEven: Second Chance (Hunter), then the Explorer steps onto the Hunter": [
    "start: ROUTE_STARTED R1 hard playing",
    "move:R: EXPLORER_STEP_COMMITTED t1 8,1 | CHEST_OPENED t1",
    "choose: REWARD_SELECTED t1 second-chance | DEFENDERS_SETTLED t1 hunter=8,5 sentinel=1,0",
    "move:R: EXPLORER_STEP_COMMITTED t2 8,2 | DEFENDERS_SETTLED t2 hunter=8,4 sentinel=1,0",
    "move:R: EXPLORER_STEP_COMMITTED t3 8,3 | SECOND_CHANCE_USED hunter t3 8,3",
    "move:R: EXPLORER_STEP_COMMITTED t4 8,4 | EXPLORER_CAPTURED explorer-step t4 8,4 errors=1 | ROUTE_ENDED lost t4",
  ],
  "corridorOdd: Second Chance (Explorer), then the Explorer steps onto the Hunter": [
    "start: ROUTE_STARTED R1 hard playing",
    "move:R: EXPLORER_STEP_COMMITTED t1 8,1 | CHEST_OPENED t1",
    "choose: REWARD_SELECTED t1 second-chance | DEFENDERS_SETTLED t1 hunter=8,4 sentinel=1,0",
    "move:R: EXPLORER_STEP_COMMITTED t2 8,2 | DEFENDERS_SETTLED t2 hunter=8,3 sentinel=1,0",
    "move:R: SECOND_CHANCE_USED explorer t3 8,3",
    "move:R: EXPLORER_STEP_COMMITTED t4 8,3 | EXPLORER_CAPTURED explorer-step t4 8,3 errors=1 | ROUTE_ENDED lost t4",
  ],
  "corridorHunter: the Hunter's capture": [
    "start: ROUTE_STARTED R1 hard playing",
    "move:R: EXPLORER_STEP_COMMITTED t1 8,1 | DEFENDERS_SETTLED t1 hunter=8,3 sentinel=1,0",
    "move:R: EXPLORER_STEP_COMMITTED t2 8,2 | EXPLORER_CAPTURED hunter t2 8,2 errors=1 | ROUTE_ENDED lost t2",
  ],
  "sentinelDoor: the Sentinel moves, then captures": [
    "start: ROUTE_STARTED R1 hard playing",
    "move:D: EXPLORER_STEP_COMMITTED t1 4,8 | DEFENDERS_SETTLED t1 hunter=0,0 sentinel=6,8",
    "move:D: EXPLORER_STEP_COMMITTED t2 5,8 | EXPLORER_CAPTURED sentinel t2 5,8 errors=1 | ROUTE_ENDED lost t2",
  ],
  "sentinelDoorChest: Second Chance (Sentinel)": [
    "start: ROUTE_STARTED R1 hard playing",
    "move:D: EXPLORER_STEP_COMMITTED t1 4,8 | CHEST_OPENED t1",
    "choose: REWARD_SELECTED t1 second-chance | DEFENDERS_SETTLED t1 hunter=0,0 sentinel=6,8",
    "move:D: EXPLORER_STEP_COMMITTED t2 5,8 | SECOND_CHANCE_USED sentinel t2 5,8",
  ],
  "sentinelOpen: the Explorer steps onto the Sentinel": [
    "start: ROUTE_STARTED R1 hard playing",
    "move:R: EXPLORER_STEP_COMMITTED t1 8,1 | DEFENDERS_SETTLED t1 hunter=0,0 sentinel=7,7",
    "move:R: EXPLORER_STEP_COMMITTED t2 8,2 | DEFENDERS_SETTLED t2 hunter=0,0 sentinel=8,7",
    "move:R: EXPLORER_STEP_COMMITTED t3 8,3 | DEFENDERS_SETTLED t3 hunter=0,0 sentinel=8,6",
    "move:R: EXPLORER_STEP_COMMITTED t4 8,4 | DEFENDERS_SETTLED t4 hunter=0,0 sentinel=8,5",
    "move:R: EXPLORER_STEP_COMMITTED t5 8,5 | EXPLORER_CAPTURED explorer-step t5 8,5 errors=1 | ROUTE_ENDED lost t5",
  ],
  "portalRun: the portal before its light, the light, the win on Route 1, Route 2 opened": [
    "start: ROUTE_STARTED R1 hard playing",
    "move:L: EXPLORER_STEP_COMMITTED t1 8,2 | DEFENDERS_SETTLED t1 hunter=0,0 sentinel=7,1",
    "move:L: EXPLORER_STEP_COMMITTED t2 8,1 | DEFENDERS_SETTLED t2 hunter=0,0 sentinel=7,2",
    "move:L: EXPLORER_STEP_COMMITTED t3 8,0 | DEFENDERS_SETTLED t3 hunter=0,0 sentinel=7,2",
    "move:U: EXPLORER_STEP_COMMITTED t4 7,0 | LIGHT_COLLECTED t4 7,0 | PORTAL_ACTIVATED t4 | DEFENDERS_SETTLED t4 hunter=0,0 sentinel=7,2",
    "move:D: EXPLORER_STEP_COMMITTED t5 8,0 | ROUTE_ENDED won t5",
    "start: ROUTE_STARTED R2 hard playing",
  ],
  "portalRun: the win on Route 3 completes the journey": [
    "start: ROUTE_STARTED R3 medium playing",
    "move:L: EXPLORER_STEP_COMMITTED t1 8,2 | DEFENDERS_SETTLED t1 hunter=0,0 sentinel=7,1",
    "move:L: EXPLORER_STEP_COMMITTED t2 8,1 | DEFENDERS_SETTLED t2 hunter=0,0 sentinel=7,2",
    "move:L: EXPLORER_STEP_COMMITTED t3 8,0 | DEFENDERS_SETTLED t3 hunter=0,0 sentinel=7,2",
    "move:U: EXPLORER_STEP_COMMITTED t4 7,0 | LIGHT_COLLECTED t4 7,0 | PORTAL_ACTIVATED t4 | DEFENDERS_SETTLED t4 hunter=0,0 sentinel=7,2",
    "move:D: EXPLORER_STEP_COMMITTED t5 8,0 | ROUTE_ENDED won t5 journey-completed",
  ],
  "corridorHunter: lost on Route 3, Route 3 again": [
    "start: ROUTE_STARTED R3 hard playing",
    "move:R: EXPLORER_STEP_COMMITTED t1 8,1 | DEFENDERS_SETTLED t1 hunter=8,3 sentinel=1,0",
    "move:R: EXPLORER_STEP_COMMITTED t2 8,2 | EXPLORER_CAPTURED hunter t2 8,2 errors=1 | ROUTE_ENDED lost t2",
    "start: ROUTE_STARTED R3 hard playing",
  ],
};

/** Real generated Routes: every scripted Explorer on every Route and mode, restart, mode change, the next Route, three journeys. */
function realScenarios(scale) {
  const out = [];
  for (const routeNumber of [1, 2, 3]) {
    for (const [d, difficulty] of DIFFICULTIES.entries()) {
      if (scale === "mutant" && d !== routeNumber - 1) continue;
      for (const [p, policy] of POLICIES.entries()) {
        // A Sentinel's capture and its Second Chance are rare (the Hunter usually gets there first): those Explorers get more Routes.
        const offsets = scale === "mutant" ? [0] : policy === "sc-sentinel" || policy === "sc-bait" ? [0, 1, 2] : [0];
        for (const offset of offsets) {
          const seed = 660_000 + routeNumber * 1000 + d * 100 + p * 10 + offset;
          out.push({
            name: `R${routeNumber}/${difficulty}/${policy}/${offset}`,
            seed,
            routeNumber,
            ...(offset % 2 === 1 ? { initialDifficulty: difficulty } : difficulty !== "easy" ? { changeDifficulty: difficulty } : {}),
            steps: [
              ["play", 220, { policy }],
              ["move", { row: 1, col: 0 }],
              ["restart"],
              ["play", 10, { policy }],
              ["changeDifficulty", DIFFICULTIES[(d + 1) % 3]],
              ["move", { row: -1, col: 0 }],
              ["start"],
              ["play", 10, { policy: policy === "lose" ? "win" : "lose" }],
              ["next", seed + 1],
              ["play", 40, { policy }],
            ],
          });
        }
      }
    }
  }
  for (const [d, difficulty] of DIFFICULTIES.entries()) {
    if (scale === "mutant" && d > 0) break;
    out.push({
      name: `journey/${difficulty}`,
      seed: 670_000 + d,
      routeNumber: 1,
      ...(difficulty !== "easy" ? { changeDifficulty: difficulty } : {}),
      steps: [["play", 220, { policy: "sc-portal" }], ["next", 670_100 + d], ["play", 220, { policy: "win" }], ["next", 670_200 + d], ["play", 220, { policy: "pickaxe" }], ["next", 670_300 + d], ["play", 220, { policy: "win" }]],
    });
  }
  return out;
}

/** The real traces, pinned: a digest of every line, and the first input that shows each meaning. Per scale. */
const PINNED_REAL = {
  full: {
    digest: "27b3e9ce30116a81",
    firsts: {
      "START:playing": "R1/easy/win/0#0 start: ROUTE_STARTED R1 easy playing",
      "STEP": "R1/easy/win/0#1 step: EXPLORER_STEP_COMMITTED t1 7,0 | DEFENDERS_SETTLED t1 hunter=0,5 sentinel=1,7",
      "SETTLED": "R1/easy/win/0#1 step: EXPLORER_STEP_COMMITTED t1 7,0 | DEFENDERS_SETTLED t1 hunter=0,5 sentinel=1,7",
      "LIGHT": "R1/easy/win/0#5 step: EXPLORER_STEP_COMMITTED t5 4,1 | LIGHT_COLLECTED t5 4,1 | DEFENDERS_SETTLED t5 hunter=0,7 sentinel=1,7",
      "CHEST": "R1/easy/win/0#6 step: EXPLORER_STEP_COMMITTED t6 5,1 | CHEST_OPENED t6",
      "REWARD": "R1/easy/win/0#7 choose: REWARD_SELECTED t6 second-chance | DEFENDERS_SETTLED t6 hunter=0,6 sentinel=1,7",
      "PORTAL": "R1/easy/win/0#12 step: EXPLORER_STEP_COMMITTED t11 7,4 | LIGHT_COLLECTED t11 7,4 | PORTAL_ACTIVATED t11 | DEFENDERS_SETTLED t11 hunter=0,7 sentinel=1,7",
      "END:won": "R1/easy/win/0#20 step: EXPLORER_STEP_COMMITTED t19 2,7 | ROUTE_ENDED won t19",
      "START:setup": "R1/easy/win/0#33 changeDifficulty:medium: ROUTE_STARTED R1 medium setup",
      "TRAP": "R1/easy/win/0#68 step: EXPLORER_STEP_COMMITTED t22 4,0 trap=4,0 | TRAP_ARMED t22 4,0 | DEFENDERS_SETTLED t22 hunter=2,7 sentinel=1,7",
      "CAP:explorer-step": "R1/easy/lose/0#21 step: EXPLORER_STEP_COMMITTED t20 1,7 | EXPLORER_CAPTURED explorer-step t20 1,7 errors=1 | ROUTE_ENDED lost t20",
      "END:lost": "R1/easy/lose/0#21 step: EXPLORER_STEP_COMMITTED t20 1,7 | EXPLORER_CAPTURED explorer-step t20 1,7 errors=1 | ROUTE_ENDED lost t20",
      "WALL": "R1/easy/pickaxe/0#6 break: WALL_OPENED t5 6,1 | DEFENDERS_SETTLED t5 hunter=0,6 sentinel=1,7",
      "CAP:hunter": "R1/easy/pickaxe/0#45 step: EXPLORER_STEP_COMMITTED t9 6,7 | EXPLORER_CAPTURED hunter t9 6,7 errors=1 | ROUTE_ENDED lost t9",
      "BLOCK:wall": "R1/easy/pickaxe-bump/0#6 move: EXPLORER_STEP_BLOCKED wall 6,1",
      "SC:explorer": "R1/easy/sc-hunter/0#15 step: SECOND_CHANCE_USED explorer t14 2,6",
      "BLOCK:boundary": "R1/easy/bump/0#3 move: EXPLORER_STEP_BLOCKED boundary 6,-1",
      "SC:hunter": "R1/medium/win/0#22 step: EXPLORER_STEP_COMMITTED t20 5,1 | SECOND_CHANCE_USED hunter t20 5,1",
      "CAP:sentinel": "R2/easy/pickaxe/0#25 step: EXPLORER_STEP_COMMITTED t24 0,5 | EXPLORER_CAPTURED sentinel t24 0,5 errors=1 | ROUTE_ENDED lost t24",
      "END:won:journey": "R2/hard/win/0#94 step: EXPLORER_STEP_COMMITTED t20 0,8 | ROUTE_ENDED won t20 journey-completed",
    },
  },
  // Mutants run a smaller set of Routes: their reference is the unmutated working tree on that set (runMutants).
  mutant: { digest: null },
};

const TRACE_IDS = [
  ["T1", "SITUATION_TRACES_PINNED"],
  ["T2", "TRACE_DESCRIBES_WHAT_THE_RENDER_AND_THE_DEFENDERS_DID"],
  ["T3", "TURN_GRAMMAR_AND_TURN_NUMBERS"],
  ["T4", "CAUSES_AND_CAPTORS_TOLD_APART"],
  ["T5", "TRACES_DETERMINISTIC"],
  ["T6", "REAL_TRACES_PINNED"],
];
const lineOf = (input) => `${input.label}: ${(input.events ?? ["NO TRACE"]).map((e) => (typeof e === "string" ? e : brief(e))).join(" | ")}`;

function traceChecks({ rev = null, sourceOverrides, scale = "full", tree }) {
  const out = [];
  const record = (id, name, pass, detail) => out.push({ id, kind: "trace", name, pass, detail });
  const rota = createTracedRota({ rev, sourceOverrides });
  if (!rota.tracer.available) {
    for (const [id, name] of TRACE_IDS) record(id, name, false, { trace: "none — this tree has no route-events: nothing says what happened, only how the state changed" });
    return out;
  }
  const synthetic = SYNTHETIC.map((scenario) => ({ scenario, ...drive(rota, scenario) }));
  const real = realScenarios(scale).map((scenario) => ({ scenario, ...drive(rota, scenario) }));
  const inputs = [...synthetic, ...real].flatMap((s) => s.inputs);
  const realInputs = real.flatMap((s) => s.inputs);
  const mapping = createModuleGraph({ tree }).require(ROUTE_EVENTS).routeStateActionsForEvent;

  // T1 — the situations, input by input, exactly as pinned; mounting writes nothing (the initial state is no event).
  {
    const actual = Object.fromEntries(synthetic.map((s) => [s.scenario.name, s.inputs.map(lineOf)]));
    const mismatched = SYNTHETIC.filter((s) => !same(actual[s.name], EXPECTED_SYNTHETIC[s.name])).map((s) => {
      const got = actual[s.name];
      const want = EXPECTED_SYNTHETIC[s.name] ?? [];
      const i = got.findIndex((line, n) => line !== want[n]);
      return { scenario: s.name.split(":")[0], input: i, got: got[i] ?? null, want: want[i] ?? null };
    });
    const mountWrites = synthetic.flatMap((s) => s.mounts).filter((events) => events?.length);
    record("T1", "SITUATION_TRACES_PINNED", mismatched.length === 0 && mountWrites.length === 0 && Object.keys(EXPECTED_SYNTHETIC).length === SYNTHETIC.length, {
      situations: SYNTHETIC.length,
      inputs: synthetic.reduce((n, s) => n + s.inputs.length, 0),
      mismatched: mismatched.slice(0, 4),
      eventsAtMount: mountWrites.length,
      ...(mismatched.length && process.env.ROUTE_C6_PRINT_TRACES ? { actual } : {}),
    });
  }

  // T2 — the oracle: every event of every input (situations and real Routes) is true of the render it produced and of
  // what the defenders actually decided, and every change the events describe has its event; the reducer ran exactly
  // once per transition the events gave.
  {
    const problems = [];
    const tokens = {};
    for (const input of inputs) {
      for (const e of input.events ?? []) tally(tokens, token(e));
      for (const problem of audit(input)) if (problems.length < 8) problems.push(`${input.scenario.split(":")[0]}#${input.index} ${input.label}: ${problem}`);
    }
    record("T2", "TRACE_DESCRIBES_WHAT_THE_RENDER_AND_THE_DEFENDERS_DID", problems.length === 0 && realInputs.length > (scale === "mutant" ? 800 : 4000), {
      inputs: inputs.length,
      realRoutes: real.length,
      eventsByMeaning: tokens,
      problems,
    });
  }

  // T3 — the turn's grammar, over every input: the step, then what it did (light, portal, trap — in that order), then
  // the Chest's pause, the win or the defenders' answer (Hunter first: a Hunter's capture ends it, the Sentinel is not
  // asked); a reward resumes the turn the Chest paused (same turn number), a wall spends one; every event of one input
  // belongs to one turn; every meaning of the alphabet occurs.
  {
    const offGrammar = [];
    const turns = [];
    const seen = new Set();
    for (const s of [...synthetic, ...real]) {
      let pausedTurn = null;
      for (const input of s.inputs) {
        const word = (input.events ?? []).map(token).join(" ");
        for (const e of input.events ?? []) seen.add(token(e));
        if (!GRAMMAR.test(word) && offGrammar.length < 6) offGrammar.push(`${s.scenario.name.split(":")[0]}#${input.index} ${input.label}: ${word}`);
        const numbers = new Set((input.events ?? []).filter((e) => e && "turn" in e).map((e) => e.turn));
        if (numbers.size > 1 && turns.length < 6) turns.push(`${s.scenario.name.split(":")[0]}#${input.index}: turns ${[...numbers].join(",")}`);
        const chest = (input.events ?? []).find((e) => e?.type === "CHEST_OPENED");
        const reward = (input.events ?? []).find((e) => e?.type === "REWARD_SELECTED");
        if (reward && reward.turn !== pausedTurn && turns.length < 6) turns.push(`${s.scenario.name.split(":")[0]}#${input.index}: reward on turn ${reward.turn}, Chest paused turn ${pausedTurn}`);
        if (chest) pausedTurn = chest.turn;
        if (reward || (input.events ?? []).some((e) => e?.type === "ROUTE_STARTED")) pausedTurn = null;
      }
    }
    const alphabet = [
      "START:playing", "START:setup", "BLOCK:boundary", "BLOCK:wall", "STEP", "LIGHT", "PORTAL", "TRAP", "CHEST", "REWARD", "WALL", "SETTLED",
      "SC:explorer", "SC:hunter", "SC:sentinel", "CAP:explorer-step", "CAP:hunter", "CAP:sentinel", "END:won", "END:lost",
    ];
    const missing = alphabet.filter((t) => !seen.has(t));
    const foreign = [...seen].filter((t) => !alphabet.includes(t));
    record("T3", "TURN_GRAMMAR_AND_TURN_NUMBERS", offGrammar.length === 0 && turns.length === 0 && missing.length === 0 && foreign.length === 0, {
      grammar: GRAMMAR.source,
      offGrammar,
      turnNumbers: turns,
      meaningsObserved: alphabet.length - missing.length,
      missing,
      foreign,
    });
  }

  // T4 — who and why, told apart: every Second Chance cause and every captor occurs (on the boards built for them, and on
  // real Routes), the oracle agrees with each, and the transition each capture records is the same COMMIT_CAPTURE — the
  // state alone could not say who it was; the trace does.
  {
    const kinds = ["SC:explorer", "SC:hunter", "SC:sentinel", "CAP:explorer-step", "CAP:hunter", "CAP:sentinel"];
    const count = (list) => Object.fromEntries(kinds.map((k) => [k, list.filter((i) => (i.events ?? []).some((e) => token(e) === k)).length]));
    const inSituations = count(synthetic.flatMap((s) => s.inputs));
    const inReal = count(realInputs);
    const disagreements = inputs.filter((i) => (i.events ?? []).some((e) => kinds.includes(token(e))) && audit(i).length > 0).length;
    const captureTransitions = new Set(inputs.flatMap((i) => (i.events ?? []).filter((e) => e?.type === "EXPLORER_CAPTURED")).map((e) => mapping(e).map((a) => a.type).join(",")));
    record("T4", "CAUSES_AND_CAPTORS_TOLD_APART", kinds.every((k) => inSituations[k] > 0) && kinds.filter((k) => inReal[k] > 0).length >= (scale === "mutant" ? 3 : 5) &&
      disagreements === 0 && same([...captureTransitions], ["COMMIT_CAPTURE"]), {
      onHandBuiltBoards: inSituations,
      onRealRoutes: inReal,
      oracleDisagreements: disagreements,
      transitionEveryCaptureRecords: [...captureTransitions],
    });
  }

  // T5 — determinism: the same scenarios in a fresh Rota give the same trace, event for event and value for value.
  {
    const again = createTracedRota({ rev, sourceOverrides });
    const sample = [...SYNTHETIC, ...realScenarios(scale).slice(0, scale === "mutant" ? 8 : 24)];
    const first = sample.map((scenario) => drive(rota, scenario).inputs.map((i) => snapshotOf(i.events)));
    const second = sample.map((scenario) => drive(again, scenario).inputs.map((i) => snapshotOf(i.events)));
    record("T5", "TRACES_DETERMINISTIC", same(first, second), { scenarios: sample.length, inputs: first.flat().length, digest: sha(first) });
  }

  // T6 — the real traces, pinned: every line of every real Route, digested; and the first input that shows each meaning.
  {
    const lines = real.map((s) => [s.scenario.name, s.inputs.map(lineOf)]);
    const digest = sha(lines);
    const firsts = {};
    for (const s of real) {
      for (const input of s.inputs) {
        for (const e of input.events ?? []) {
          const k = token(e) + (e?.journeyCompleted ? ":journey" : "");
          firsts[k] ??= `${s.scenario.name}#${input.index} ${lineOf(input)}`;
        }
      }
    }
    const pinned = PINNED_REAL[scale];
    const firstsDiffer = scale === "full" ? Object.keys({ ...pinned.firsts, ...firsts }).filter((k) => pinned.firsts[k] !== firsts[k]) : [];
    record("T6", "REAL_TRACES_PINNED", digest === pinned.digest && firstsDiffer.length === 0, {
      routes: real.length,
      lines: lines.reduce((n, [, l]) => n + l.length, 0),
      digest,
      pinnedDigest: pinned.digest,
      firstsDiffer: firstsDiffer.map((k) => ({ meaning: k, now: firsts[k] ?? null, pinned: pinned.firsts[k] ?? null })).slice(0, 4),
      ...(process.env.ROUTE_C6_PRINT_TRACES ? { firsts } : {}),
    });
  }
  return out;
}

// =================================================================================================
// [preserved]
// =================================================================================================

const printer = ts.createPrinter({ removeComments: true });

/**
 * The hook's body with its writes taken out — the turn itself: every condition, computation, call (sounds, onComplete,
 * generateMaze, the defenders' policies) and return, in order — printed without comments.
 *
 *   erase    every write is removed: a setter call (up to C4), a `dispatch` (C5), an event applied (C6); with them the
 *            cell declarations (but routeNumber's), the seam's declaration and its mention in dependency lists, and
 *            every `if` left guarding nothing. What remains is the order of the turn's decisions (C5's P5).
 *   resolve  every write is replaced by the C5 transitions it applies, in order, each as `__write("<transition>")`: a
 *            `dispatch({…})` by its literal; an event applied by what the REAL mapping (`mapping`) gives for it, the
 *            event evaluated symbolically — a literal is its value, any other expression `⟨its text⟩`. Two hooks that
 *            print the same apply the same transitions, with the same values, at the same points of the same decisions.
 */
function turnSkeleton(source, { mode, mapping = null }) {
  const sf = parse(ROUTE_HOOK, source);
  const fn = hookFunction(sf);
  if (!fn) return null;
  const removed = { writes: 0, cells: 0, guards: 0, seam: 0, deps: 0 };
  const problems = [];
  const writeCallee = (n) =>
    ts.isExpressionStatement(n) && ts.isCallExpression(n.expression) && ts.isIdentifier(n.expression.expression) &&
    (/^set[A-Z]/.test(n.expression.expression.text) || n.expression.expression.text === "dispatch" || n.expression.expression.text === "applyDomainEvent")
      ? n.expression.expression.text
      : null;
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
  const isSeam = (n) => ts.isVariableStatement(n) && n.declarationList.declarations.some((d) => d.name.getText(sf) === "applyDomainEvent");
  const symbolic = (expr) => {
    if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
    if (ts.isNumericLiteral(expr)) return Number(expr.text);
    if (expr.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (expr.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (expr.kind === ts.SyntaxKind.NullKeyword) return null;
    return `⟨${printer.printNode(ts.EmitHint.Expression, expr, sf)}⟩`;
  };
  const objectOf = (literal) =>
    Object.fromEntries(literal.properties.map((p) =>
      ts.isShorthandPropertyAssignment(p) ? [p.name.text, `⟨${p.name.text}⟩`] : ts.isPropertyAssignment(p) ? [p.name.getText(sf), symbolic(p.initializer)] : [`…${p.getText(sf)}`, "⟨spread⟩"]));
  const writeOf = (value) =>
    ts.factory.createExpressionStatement(ts.factory.createCallExpression(ts.factory.createIdentifier("__write"), undefined, [ts.factory.createStringLiteral(canonical(value))]));
  const result = ts.transform(fn, [
    (ctx) => (root) => {
      const visit = (node) => {
        const write = writeCallee(node);
        if (write) {
          removed.writes += 1;
          if (mode === "erase") return undefined;
          const arg = node.expression.arguments[0];
          if (!arg || !ts.isObjectLiteralExpression(arg)) return writeOf({ opaque: `${write}(${arg ? printer.printNode(ts.EmitHint.Expression, arg, sf) : ""})` });
          if (write !== "applyDomainEvent") return writeOf(objectOf(arg));
          let transitions;
          const threw = errorOf(() => {
            transitions = mapping(objectOf(arg));
          });
          if (threw || !Array.isArray(transitions)) {
            problems.push(`the mapping ${threw ? `threw (${threw})` : "returned no list"} for ${objectOf(arg).type}`);
            return writeOf({ unmapped: objectOf(arg).type });
          }
          return transitions.map(writeOf);
        }
        if (isCell(node)) return (removed.cells += 1), undefined;
        if (isSeam(node)) return (removed.seam += 1), undefined;
        if (ts.isArrayLiteralExpression(node) && node.elements.some((e) => ts.isIdentifier(e) && e.text === "applyDomainEvent")) {
          removed.deps += 1;
          return ts.factory.updateArrayLiteralExpression(node, node.elements.filter((e) => !(ts.isIdentifier(e) && e.text === "applyDomainEvent")));
        }
        const next = ts.visitEachChild(node, visit, ctx);
        if (ts.isIfStatement(next) && !next.elseStatement && ts.isBlock(next.thenStatement) && next.thenStatement.statements.length === 0) {
          removed.guards += 1;
          return undefined;
        }
        return next;
      };
      return ts.visitNode(root, visit);
    },
  ]);
  return { text: printer.printNode(ts.EmitHint.Unspecified, result.transformed[0], sf), removed, problems };
}

const firstLineDiff = (a, b) => {
  const x = a?.split("\n") ?? [];
  const y = b?.split("\n") ?? [];
  const line = x.findIndex((text, i) => text !== y[i]);
  return line < 0 && x.length === y.length ? null : { line, now: x.slice(Math.max(0, line), line + 2), other: y.slice(Math.max(0, line), line + 2) };
};

function preservedChecks(tree) {
  const out = [];
  const record = (id, name, pass, detail) => out.push({ id, kind: "preserved", name, pass, detail });
  const base = openSourceTree({ rev: BASELINE });
  const hookNow = moduleShape(ROUTE_HOOK, tree.read(ROUTE_HOOK));
  const hookBase = moduleShape(ROUTE_HOOK, base.read(ROUTE_HOOK));

  // P1 — the hook's public surface, by the parser (exports and the returned object's keys), and its consumers byte for byte.
  {
    const consumers = CONSUMERS.map((file) => ({ file, unchanged: tree.read(file) === base.read(file) }));
    const keysNow = hookAnatomy(tree.read(ROUTE_HOOK)).returnKeys;
    const keysBase = hookAnatomy(base.read(ROUTE_HOOK)).returnKeys;
    record("P1", "PUBLIC_SURFACE_AND_CONSUMERS_UNCHANGED", same(sorted(hookNow.exported), sorted(hookBase.exported)) && same(keysNow, keysBase) && consumers.every((c) => c.unchanged), {
      hookExports: sorted(hookNow.exported),
      returnedKeys: keysNow.length,
      returnedKeysUnchanged: same(keysNow, keysBase),
      consumers,
    });
  }
  // P2 — nothing else moved: the reducer and the state (route-state.ts), the Rota's other modules, the engine, the types.
  {
    const touched = UNTOUCHED.filter((file) => (tree.exists(file) ? tree.read(file) : null) !== (base.exists(file) ? base.read(file) : null));
    record("P2", "EVERY_OTHER_MODULE_UNTOUCHED_REDUCER_INCLUDED", touched.length === 0, { compared: UNTOUCHED.length, touched });
  }
  // P3 — every string of 878057a's hook is still in the hook, the user-facing ones exactly the same, and route-events
  // holds no copy: C6 is not a copy system.
  {
    const now = stringLiterals(ROUTE_HOOK, tree.read(ROUTE_HOOK));
    const was = stringLiterals(ROUTE_HOOK, base.read(ROUTE_HOOK));
    const lost = sorted(new Set(was.filter((text) => !now.includes(text))));
    const copyNow = userFacing(now);
    const copyWas = userFacing(was);
    const eventsLiterals = tree.exists(ROUTE_EVENTS) ? stringLiterals(ROUTE_EVENTS, tree.read(ROUTE_EVENTS)) : [];
    const eventsCopy = userFacing(eventsLiterals);
    // The eleven transitions' names are the one thing that left the hook: the hook says what happened, and route-events
    // names the transitions that record it. Nothing else may be missing.
    const movedToEvents = lost.filter((t) => ACTIONS.includes(t) && eventsLiterals.includes(t));
    const reallyLost = lost.filter((t) => !movedToEvents.includes(t));
    record("P3", "EVERY_STRING_BYTE_FOR_BYTE", reallyLost.length === 0 && same(copyNow, copyWas) && eventsCopy.length === 0, {
      baselineLiterals: was.length,
      lost: reallyLost,
      transitionNamesNowInRouteEvents: movedToEvents,
      userFacingStrings: copyWas.length,
      added: copyNow.filter((t) => !copyWas.includes(t)),
      removed: copyWas.filter((t) => !copyNow.includes(t)),
      copyInRouteEvents: eventsCopy,
      digest: sha(copyNow),
    });
  }
  // P4 — the hook's top level is 878057a's but for the hook itself: every other statement (DefenderPhaseInput, the
  // Second Chance messages, sentinelPostOn, the input deltas…), leading comments included, byte for byte, in order.
  {
    const expected = hookBase.statements.filter((s) => s.name !== "useEscapeMaze").map((s) => s.text);
    const now = hookNow.statements.filter((s) => s.name !== "useEscapeMaze").map((s) => s.text);
    record("P4", "HOOK_TOP_LEVEL_OTHERWISE_UNCHANGED", same(now, expected), {
      statements: hookNow.statements.length,
      baselineStatements: hookBase.statements.length,
      changed: expected.filter((t) => !now.includes(t)).map((t) => t.split("\n").find((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))?.slice(0, 70)),
      added: now.filter((t) => !expected.includes(t)).map((t) => t.split("\n").find((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))?.slice(0, 70)),
    });
  }
  // P5 — the order of the turn, C5's P5 carried over: with every write erased (the events applied, the seam, the cells),
  // the hook's body prints as 878057a's with its dispatches erased, and as 74ff2dc's with its setters erased — the same
  // conditions in the same order (the Chest's pause before the defenders, Hunter before Sentinel, capture before Second
  // Chance), computations, sounds, onComplete, generateMaze calls and returns.
  {
    const now = turnSkeleton(tree.read(ROUTE_HOOK), { mode: "erase" });
    const c5 = turnSkeleton(base.read(ROUTE_HOOK), { mode: "erase" });
    const c4 = turnSkeleton(openSourceTree({ rev: C4_BASELINE }).read(ROUTE_HOOK), { mode: "erase" });
    record("P5", "TURN_ORDER_UNCHANGED_WITH_WRITES_ERASED", Boolean(now && c5 && c4) && now.text === c5.text && now.text === c4.text, {
      skeletonChars: now?.text.length,
      removedNow: now?.removed,
      removedAt878057a: c5?.removed,
      removedAt74ff2dc: c4?.removed,
      firstDifferenceFrom878057a: firstLineDiff(now?.text, c5?.text),
      firstDifferenceFrom74ff2dc: firstLineDiff(now?.text, c4?.text),
      digest: now ? sha(now.text) : null,
    });
  }
  // P6 — the writes themselves, in place: each event the hook applies, resolved through the REAL mapping into the C5
  // transitions it gives, prints exactly where, and exactly as, 878057a's hook dispatched them — the same transitions
  // with the same values (`⟨nextTurn⟩`, `⟨SECOND_CHANCE_DEFENDER_MESSAGE⟩`…) at the same points of the same decisions,
  // in the same order. Nothing reordered, dropped, added or re-valued between the two.
  {
    const mapping = tree.exists(ROUTE_EVENTS) ? createModuleGraph({ tree }).require(ROUTE_EVENTS).routeStateActionsForEvent : () => {
      throw new Error("no route-events");
    };
    const now = turnSkeleton(tree.read(ROUTE_HOOK), { mode: "resolve", mapping });
    const c5 = turnSkeleton(base.read(ROUTE_HOOK), { mode: "resolve" });
    const writes = (text) => (text?.match(/__write\(/g) ?? []).length;
    record("P6", "TURN_WRITES_RESOLVED_THROUGH_THE_MAPPING_ARE_878057A_DISPATCHES", Boolean(now && c5) && now.text === c5.text && now.problems.length === 0, {
      transitionsNow: writes(now?.text),
      dispatchesAt878057a: writes(c5?.text),
      writeSitesNow: now?.removed.writes,
      problems: now?.problems,
      firstDifference: firstLineDiff(now?.text, c5?.text),
      digest: now ? sha(now.text) : null,
    });
  }
  return out;
}

// =================================================================================================
// [equivalence]
// =================================================================================================

/** Sessions for the real React. The last presses keys outside any scripted Explorer, so only the real React runs it. */
function reactScenarios({ keys }) {
  return [
    { name: "R1/easy/win+next", seed: 761_001, routeNumber: 1, steps: [["play", 160, { policy: "win", keys }], ["next", 761_101], ["play", 40, { policy: "lose", keys }]] },
    { name: "R2/medium/pickaxe-bump", seed: 761_002, routeNumber: 2, changeDifficulty: "medium", steps: [["play", 160, { policy: "pickaxe-bump", keys }], ["restart"], ["play", 12, { policy: "bump", keys }]] },
    { name: "R3/hard/chest-wait+traps", seed: 761_003, routeNumber: 3, changeDifficulty: "hard", steps: [["play", 160, { policy: "chest-wait", keys }], ["changeDifficulty", "easy"], ["start"], ["play", 20, { policy: "traps", keys }]] },
    { name: "R1/hard/sc-hunter+next", seed: 761_004, routeNumber: 1, initialDifficulty: "hard", steps: [["play", 160, { policy: "sc-hunter", keys }], ["next", 761_104], ["play", 30, { policy: "win", keys }]] },
    { name: "R2/easy/sc-sentinel", seed: 761_005, routeNumber: 2, steps: [["play", 160, { policy: "sc-sentinel", keys }]] },
    { name: "R3/medium/sc-bait", seed: 761_006, routeNumber: 3, initialDifficulty: "medium", steps: [["play", 160, { policy: "sc-bait", keys }]] },
    { name: "R3/easy/pickaxe+journey-end", seed: 761_008, routeNumber: 3, steps: [["play", 160, { policy: "pickaxe", keys }], ["next", 761_108], ["play", 160, { policy: "win", keys }], ["next", 761_208]] },
    { name: "R1/medium/setup+keys", seed: 761_009, routeNumber: 1, initialDifficulty: "medium", autoStart: false, keysOnly: true,
      steps: [["move", { row: 0, col: 1 }], ["key", "ArrowLeft"], ["start"], ["key", "ArrowUp", { repeat: true }], ["play", 60, { policy: "traps", keys }]] },
  ];
}
const REACT_CONFIGS = [
  { label: "development · StrictMode · act", nodeEnv: "development", strict: true, regime: "act", keys: true },
  { label: "development · StrictMode · discrete events", nodeEnv: "development", strict: true, regime: "discrete", keys: true },
  { label: "production · default updates", nodeEnv: "production", strict: false, regime: "default", keys: false },
  { label: "production · discrete events", nodeEnv: "production", strict: false, regime: "discrete", keys: true },
];

/** A run without its traces: what the two trees are compared on. */
const strip = (results) => results.map((r) => Object.fromEntries(Object.entries(r).filter(([key]) => key !== "traces")));
const eventsPerStep = (results) => results.map((r) => (r.traces ?? []).map((t) => (t.events ? t.events.map((e) => snapshotOf(e)) : null)));

/**
 * What each input did, read off the trace of the tree under test — the baseline must then have rendered exactly the
 * same for that input. Labels: the meaning of each event, the start's origin, and a few things that are not events
 * (an input the paused Chest froze, a continuation opened, a completion, a board generated).
 */
function classify(now, base) {
  const items = {};
  const add = (label, ok, where) => {
    items[label] ??= { inputs: 0, identical: 0, first: null };
    items[label].inputs += 1;
    if (ok) items[label].identical += 1;
    else items[label].first ??= where;
  };
  now.forEach((session, s) => {
    const other = base[s];
    let c = 0;
    let previous = null;
    session.steps.forEach((step, i) => {
      const commits = session.commits.slice(c, c + (step.commits ?? 0));
      const otherCommits = other?.commits.slice(c, c + (step.commits ?? 0)) ?? [];
      c += step.commits ?? 0;
      const ok = same(step, other?.steps[i]) && same(commits, otherCommits) && session.traces?.[i]?.reducerCalls === other?.traces?.[i]?.reducerCalls;
      const where = `${session.scenario}#${i}:${step.label}`;
      const events = session.traces?.[i]?.events ?? [];
      add("ANY", ok, where);
      for (const e of events) {
        const t = token(e);
        add(t === "START:playing" ? `START:playing(${step.label})` : t, ok, where);
        if (e.type === "REWARD_SELECTED") add(`REWARD:${e.reward}`, ok, where);
        if (e.type === "ROUTE_ENDED" && e.journeyCompleted) add("END:won(journey-completed)", ok, where);
        if (e.type === "DEFENDERS_SETTLED" && previous) {
          if (!at(e.guardian, previous.guardian)) add("SETTLED:hunter-moved", ok, where);
          if (!at(e.sentinel.position, previous.sentinel)) add("SETTLED:sentinel-moved", ok, where);
        }
      }
      if (/^(step|move|key:Arrow)/.test(step.label) && events.length === 0 && previous?.rewardChoicePending) add("chest-pause:frozen-input", ok, where);
      if (step.label === "next") add("continuation", ok, where);
      if (step.effects?.some((e) => e.startsWith("onComplete"))) add("completion", ok, where);
      if (step.generations) add("generateMaze", ok, where);
      if (commits.length) previous = commits.at(-1);
    });
  });
  return items;
}

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

const baselineCache = {};
async function equivalenceChecks({ rev = null, sourceOverrides, scale = "full", react = true }) {
  const out = [];
  const record = (id, name, pass, detail) => out.push({ id, kind: "equivalence", name, pass, detail });
  const scenarios = realScenarios(scale);
  const now = await runInShim({ rev, sourceOverrides, scenarios, traceEvents: true });
  baselineCache[scale] ??= await runInShim({ rev: BASELINE, scenarios, traceEvents: true });
  const base = baselineCache[scale];
  const traced = now.every((r) => r.traces.every((t) => Array.isArray(t.events)));
  const items = classify(now, base);
  const holds = (label, min = 1) => items[label] && items[label].inputs >= min && items[label].identical === items[label].inputs;
  const commits = now.reduce((sum, r) => sum + r.commits.length, 0);
  const report = (labels) => Object.fromEntries(labels.map((l) => [l, items[l] ? `${items[l].identical}/${items[l].inputs}${items[l].first ? ` first diff ${items[l].first}` : ""}` : "never exercised"]));

  // E1 — everything, render by render: every committed render of every session, every field the hook returns.
  record("E1", "EVERY_RENDER_IDENTICAL", same(strip(now), strip(base)) && commits > (scale === "mutant" ? 1500 : 6000), {
    sessions: now.length,
    rendersCompared: commits,
    inputs: items.ANY?.inputs,
    fieldsPerRender: Object.keys(now[0]?.commits[0] ?? {}).length,
    digest: sha(strip(now)),
    firstDiff: firstDiff(strip(now), strip(base)),
  });
  // E2 — each kind of occurrence, over the inputs whose trace says it happened: identical to 878057a, input by input.
  // (The rarest meanings also have their own boards, compared in E8.) On a tree without a trace there is nothing to
  // classify by: the comparison is E1's alone.
  {
    const wanted = [
      "START:playing(start)", "START:playing(restart)", "START:setup", "BLOCK:boundary", "BLOCK:wall", "STEP", "LIGHT", "PORTAL", "TRAP", "CHEST",
      "chest-pause:frozen-input", "REWARD:pickaxe", "REWARD:second-chance", "WALL", "SETTLED:hunter-moved", "SETTLED:sentinel-moved",
      "SC:explorer", "SC:hunter", "CAP:explorer-step", "CAP:hunter", "END:won", "END:lost", "END:won(journey-completed)", "continuation", "completion", "generateMaze",
    ];
    const rare = ["SC:sentinel", "CAP:sentinel"];
    // The mutants' smaller set of Routes cannot exercise every occurrence: there, each one it does exercise must hold.
    const ok = traced
      ? (scale === "full" ? wanted.every((l) => holds(l)) : Object.keys(items).every((l) => holds(l))) && rare.every((l) => !items[l] || holds(l))
      : same(strip(now), strip(base));
    record("E2", "EACH_OCCURRENCE_IDENTICAL", ok, { classifiedBy: traced ? "the trace of the tree under test" : "nothing (no trace): E1 decides", items: report([...wanted, ...rare]) });
  }
  // E3 — onComplete: every completion, finalStats (details) included, deep-equal, after the same sounds, at the same
  // input; with the real score.
  {
    const completions = now.flatMap((r) => r.completions);
    const baseCompletions = base.flatMap((r) => r.completions);
    const effectsNow = now.flatMap((r) => r.steps.map((s) => s.effects ?? []));
    const effectsBase = base.flatMap((r) => r.steps.map((s) => s.effects ?? []));
    record("E3", "COMPLETION_SCORE_AND_SOUNDS_IDENTICAL", same(completions, baseCompletions) && same(effectsNow, effectsBase) && completions.some((c) => c.score > 0) && completions.length > 20, {
      completions: completions.length,
      won: completions.filter((c) => c.details.won).length,
      lost: completions.filter((c) => !c.details.won).length,
      sounds: effectsNow.flat().reduce((acc, e) => (tally(acc, e), acc), {}),
      digest: sha(completions),
    });
  }
  // E4 — continuation: what each result opens, and the session opened on it; Route 3 won writes none.
  {
    const continuations = now.flatMap((r) => r.completions.map((c) => [c.details.routeNumber, c.details.won, c.continuation ?? null]));
    const baseContinuations = base.flatMap((r) => r.completions.map((c) => [c.details.routeNumber, c.details.won, c.continuation ?? null]));
    const journeyEnd = continuations.filter(([route, won, next]) => route === 3 && won && next === null).length;
    record("E4", "CONTINUATION_IDENTICAL", same(continuations, baseContinuations) && (scale !== "full" || journeyEnd > 0) && (!traced || holds("continuation")), {
      results: continuations.length,
      journeyCompleted: journeyEnd,
      byRoute: continuations.reduce((acc, [route, won, next]) => (tally(acc, `R${route} ${won ? "won" : "lost"} → ${next ? `R${next.routeNumber}` : "end"}`), acc), {}),
    });
  }
  // E5 — the RNG: draws and generateMaze calls per input, and the next three numbers after each session.
  {
    const gens = {};
    for (const r of now) for (const s of r.steps) if (s.generations) tally(gens, `${s.label.split(":")[0]}:${s.generations}`);
    const extra = Object.keys(gens).filter((k) => !/^(mount|next|start|restart|changeDifficulty):1$/.test(k));
    const stream = now.map((r) => [r.draws, r.generations, r.next, r.steps.map((s) => [s.draws, s.generations])]);
    const baseStream = base.map((r) => [r.draws, r.generations, r.next, r.steps.map((s) => [s.draws, s.generations])]);
    record("E5", "RNG_STREAM_AND_GENERATION_IDENTICAL", same(stream, baseStream) && extra.length === 0, {
      draws: now.reduce((sum, r) => sum + r.draws, 0),
      generateMazeCalls: gens,
      unexpectedGenerations: extra,
      digest: sha(stream),
    });
  }
  // E6 — dynamicSolvability: the verdict at every render.
  {
    const verdicts = now.flatMap((r) => r.commits.map((c) => c.dynamicSolvability));
    const baseVerdicts = base.flatMap((r) => r.commits.map((c) => c.dynamicSolvability));
    record("E6", "DYNAMIC_SOLVABILITY_IDENTICAL", same(verdicts, baseVerdicts) && verdicts.length === commits, {
      verdicts: verdicts.length,
      solvable: verdicts.filter((v) => v.solvable).length,
      digest: sha(verdicts),
    });
  }
  // E7 — the writes, counted: per input the reducer ran exactly as many times as at 878057a, and — on a tree with a
  // trace — every run was a transition an event gave (none came from anywhere but the seam). Observational events gave
  // none.
  {
    const perInput = now.flatMap((r, s) => r.traces.map((t, i) => ({ where: `${r.scenario}#${i}`, now: t.reducerCalls, base: base[s]?.traces[i]?.reducerCalls, mapped: t.actions })));
    const differ = perInput.filter((x) => x.now !== x.base);
    const unmapped = perInput.filter((x) => x.now !== x.mapped);
    const observational = now.flatMap((r) => r.traces).filter((t) => (t.events ?? []).some((e) => OBSERVATIONAL.includes(e.type))).length;
    record("E7", "SAME_WRITES_PER_INPUT_ALL_THROUGH_THE_SEAM", differ.length === 0 && (!traced || unmapped.length === 0), {
      inputs: perInput.length,
      reducerRuns: perInput.reduce((n, x) => n + x.now, 0),
      reducerRunsAt878057a: perInput.reduce((n, x) => n + (x.base ?? 0), 0),
      inputsWithObservationalEvents: observational,
      differ: differ.slice(0, 3),
      notFromTheSeam: traced ? unmapped.slice(0, 3) : "no seam on this tree (C5): the hook dispatches itself",
    });
  }
  // E8 — the situations of [trace] on both trees: every render after every input, the completions and the sounds,
  // identical to 878057a — so the rarest meanings (a Sentinel's capture, its Second Chance, a light on a trap) are
  // compared too, not only described.
  {
    const run = (options) => {
      const sounds = [];
      const rota = createTracedRota({ ...options, sounds });
      return SYNTHETIC.map((scenario) => {
        const { inputs } = drive(rota, scenario);
        return inputs.map((i) => snapshotOf({ label: i.label, after: withoutFunctions(i.after), completions: i.completions, sounds: sounds.splice(0) }));
      });
    };
    const a = run({ rev, sourceOverrides });
    const b = run({ rev: BASELINE });
    const at0 = a.findIndex((s, i) => !same(s, b[i]));
    record("E8", "SITUATIONS_IDENTICAL", same(a, b), {
      situations: a.length,
      inputs: a.flat().length,
      firstDiff: at0 < 0 ? null : { situation: SYNTHETIC[at0].name.split(":")[0], input: a[at0].findIndex((x, n) => x !== b[at0][n]) },
    });
  }
  if (!react) return out;

  // E9 — the REAL React, tree against tree: in each configuration every commit, commits and component calls per input
  // (no render added — an event that writes nothing renders nothing), completions, sounds, draws, generateMaze calls,
  // keyboard listeners, and no warning or error; the trace is the same in every configuration (Strict Mode applies no
  // event twice) and the same as in the shim. (A tree without a trace is compared on behaviour alone.)
  {
    const configs = [];
    const traces = [];
    for (const config of REACT_CONFIGS) {
      const scenariosFor = reactScenarios({ keys: config.keys });
      const [a, b] = await Promise.all([
        runInRealReact({ rev, sourceOverrides, nodeEnv: config.nodeEnv, strict: config.strict, regime: config.regime, scenarios: scenariosFor, traceEvents: true }),
        runInRealReact({ rev: BASELINE, nodeEnv: config.nodeEnv, strict: config.strict, regime: config.regime, scenarios: scenariosFor }),
      ]);
      const inputs = a.results.flatMap((r) => r.steps.filter((s) => s.label !== "mount" && s.label !== "next" && s.commits !== undefined));
      const observational = a.results.flatMap((r) => r.steps.filter((_s, i) => (r.traces[i]?.events ?? []).some((e) => OBSERVATIONAL.includes(e.type))));
      traces.push(eventsPerStep(a.results));
      configs.push({
        label: config.label,
        identical: same(strip(a.results), b.results) && same(a.consoleErrors, b.consoleErrors),
        atMostOneCommitPerInput: inputs.every((s) => s.commits <= 1),
        inputsWithObservationalEvents: observational.length,
        theirCommits: [...new Set(observational.map((s) => s.commits))],
        commits: a.results.reduce((sum, r) => sum + r.commits.length, 0),
        bodies: a.results.reduce((sum, r) => sum + r.bodies, 0),
        keys: inputs.filter((s) => s.label.startsWith("key:")).length,
        completions: a.results.reduce((sum, r) => sum + r.completions.length, 0),
        consoleErrors: a.consoleErrors.length + b.consoleErrors.length,
        firstDiff: firstDiff(strip(a.results), b.results),
        react: a.reactVersion,
      });
    }
    // Development and production play different boards — Strict Mode calls the reducer's initialiser twice, which draws
    // a second board at mount, on both trees — so traces are compared within one build: every configuration of a build
    // gives the same trace, production gives the shim's, and in development (where React calls things twice) every
    // input's trace is still a word of the turn's grammar: nothing applied twice.
    const shimScenarios = reactScenarios({ keys: false }).filter((s) => !s.keysOnly);
    const shim = eventsPerStep(await runInShim({ rev, sourceOverrides, scenarios: shimScenarios, traceEvents: true }));
    const production = traces[REACT_CONFIGS.findIndex((c) => !c.keys)].filter((_r, i) => !reactScenarios({ keys: false })[i].keysOnly);
    const byBuild = {};
    REACT_CONFIGS.forEach((c, i) => (byBuild[c.nodeEnv] ??= []).push(traces[i]));
    const sameWithinBuild = Object.values(byBuild).every((list) => list.every((t) => same(t, list[0])));
    const words = traces.flatMap((t) => t.flatMap((session) => session.map((events) => (events ?? []).map((e) => token(JSON.parse(e))).join(" "))));
    const offGrammar = [...new Set(words.filter((w) => !GRAMMAR.test(w)))];
    record(
      "E9",
      "REAL_REACT_RENDERS_EFFECTS_AND_TRACE_IDENTICAL",
      configs.every((c) => c.identical && c.atMostOneCommitPerInput && c.consoleErrors === 0 && c.completions > 3 && (!traced || c.inputsWithObservationalEvents > 0)) &&
        configs.filter((c) => c.label.includes("discrete")).every((c) => c.keys > 20) && (!traced || (sameWithinBuild && same(production, shim) && offGrammar.length === 0)),
      { configs, traceSameWithinEachBuild: sameWithinBuild, productionTraceSameAsTheShim: same(production, shim), offGrammar: offGrammar.slice(0, 3) },
    );
  }
  return out;
}

// =================================================================================================
// mutants
// =================================================================================================

const HUNTER_CAPTURE = `      applyDomainEvent({
        type: "EXPLORER_CAPTURED",
        by: "hunter",
        turn: input.turnNumber,
        at: input.playerPosition,
        guardian: nextGuardian,
        sentinel: input.sentinelFrom,
        errors: caughtErrors,
      });
`;
const LIGHT_THEN_TRAP = `    if (collectedStar) {
      applyDomainEvent({ type: "LIGHT_COLLECTED", turn: nextTurn, light: nextKey });
      if (nextPortalActive) {
        applyDomainEvent({ type: "PORTAL_ACTIVATED", turn: nextTurn });
      }
    }
    if (isUntriggeredTrap) {
      applyDomainEvent({ type: "TRAP_ARMED", turn: nextTurn, trap: nextKey });
    }
`;
/** Mutations C6 must catch, each an exact edit of the working tree (in memory). */
const MUTANT_LIST = [
  ["TRAP_ARMED dropped from the trace", ROUTE_HOOK, ["      applyDomainEvent({ type: \"TRAP_ARMED\", turn: nextTurn, trap: nextKey });\n", ""]],
  ["LIGHT_COLLECTED and TRAP_ARMED swapped", ROUTE_HOOK, [LIGHT_THEN_TRAP, `    if (isUntriggeredTrap) {
      applyDomainEvent({ type: "TRAP_ARMED", turn: nextTurn, trap: nextKey });
    }
    if (collectedStar) {
      applyDomainEvent({ type: "LIGHT_COLLECTED", turn: nextTurn, light: nextKey });
      if (nextPortalActive) {
        applyDomainEvent({ type: "PORTAL_ACTIVATED", turn: nextTurn });
      }
    }
`]],
  ["the Hunter's capture labelled the Sentinel's", ROUTE_HOOK, ["        by: \"hunter\",", "        by: \"sentinel\","]],
  ["the Hunter's Second Chance labelled the Explorer's", ROUTE_HOOK, ["          cause: \"hunter\",", "          cause: \"explorer\","]],
  ["ROUTE_ENDED before EXPLORER_CAPTURED (the Hunter's)", ROUTE_HOOK, [`${HUNTER_CAPTURE}      endGame(false, statsAt(caughtErrors));\n`, `      endGame(false, statsAt(caughtErrors));\n${HUNTER_CAPTURE}`]],
  ["WALL_OPENED forgets COUNT_TURN", ROUTE_EVENTS, ["        { type: \"OPEN_WALL\", wall: event.wall },\n        { type: \"COUNT_TURN\", turns: event.turn },\n", "        { type: \"OPEN_WALL\", wall: event.wall },\n"]],
  ["REWARD_SELECTED gives an extra transition", ROUTE_EVENTS, ["      return [{ type: \"SELECT_REWARD\", reward: event.reward }];", "      return [{ type: \"SELECT_REWARD\", reward: event.reward }, { type: \"COUNT_TURN\", turns: event.turn }];"]],
  ["TRAP_ARMED (observational) writes the state", ROUTE_EVENTS, ["    case \"TRAP_ARMED\":\n      return [];", "      return [];\n    case \"TRAP_ARMED\":\n      return [{ type: \"COUNT_TURN\", turns: event.turn }];"]],
  ["the mapping decides: a Chest on turn 1 records nothing", ROUTE_EVENTS, ["      return [{ type: \"OPEN_CHEST\", message: event.message }];", "      return event.turn > 1 ? [{ type: \"OPEN_CHEST\", message: event.message }] : [];"]],
  ["a write skips the seam: the reward dispatched directly", ROUTE_HOOK, ["    applyDomainEvent({ type: \"REWARD_SELECTED\", turn: turns, reward });", "    dispatch({ type: \"SELECT_REWARD\", reward });"]],
  ["a generic event in the union", ROUTE_EVENTS, ["  | { type: \"PORTAL_ACTIVATED\"; turn: number }\n", "  | { type: \"PORTAL_ACTIVATED\"; turn: number }\n  // eslint-disable-next-line @typescript-eslint/no-explicit-any\n  | { type: string; payload: any }\n"]],
  ["route-events imports the RNG", ROUTE_EVENTS, ["import type { GridPosition } from \"@/types/game\";\n", "import type { GridPosition } from \"@/types/game\";\nimport { routeRandom } from \"@/engine/route-random\";\nvoid routeRandom;\n"]],
  ["the hook exposes the last event", ROUTE_HOOK, ["    breakWall,\n  };\n}", "    breakWall,\n    lastEvent: null,\n  };\n}"]],
];

async function runMutants() {
  const worktree = openSourceTree();
  // The reference: the unmutated working tree, on the mutants' smaller set of Routes, must pass everything; its real
  // trace digest is what T6 holds each mutant to at that scale.
  const reference = traceChecks({ scale: "mutant", tree: worktree });
  PINNED_REAL.mutant.digest = reference.find((r) => r.id === "T6").detail.digest;
  const clean = [
    ...structureChecks(worktree), ...contractChecks(worktree), ...traceChecks({ scale: "mutant", tree: worktree }), ...preservedChecks(worktree),
    ...(await equivalenceChecks({ scale: "mutant", react: false })),
  ];
  const dirty = clean.filter((r) => !r.pass).map((r) => r.id);
  console.log(`reference (unmutated, mutant scale): ${clean.length - dirty.length}/${clean.length} pass${dirty.length ? ` · failing: ${dirty.join(", ")}` : ""} · T6 digest ${PINNED_REAL.mutant.digest}\n`);
  if (dirty.length) {
    process.exitCode = EXIT_VALIDATION_FAILED;
    return;
  }
  const rows = [];
  for (const [name, file, [from, to]] of MUTANT_LIST) {
    const text = worktree.read(file);
    const hits = text.split(from).length - 1;
    if (hits !== 1) {
      rows.push({ name, caught: false, by: [], error: `anchor found ${hits}x in ${file}` });
      console.log(`BROKEN  ${name} — anchor found ${hits}x in ${file}`);
      continue;
    }
    const sourceOverrides = { [file]: text.replace(from, () => to) };
    const tree = openSourceTree({ sourceOverrides });
    const results = [];
    const errors = [];
    const attempt = async (group, fn) => {
      try {
        results.push(...(await fn()));
      } catch (e) {
        errors.push(`${group}: ${String(e?.message ?? e).split("\n")[0].slice(0, 120)}`);
      }
    };
    await attempt("structure", () => structureChecks(tree));
    await attempt("contract", () => contractChecks(tree));
    await attempt("trace", () => traceChecks({ sourceOverrides, scale: "mutant", tree }));
    await attempt("preserved", () => preservedChecks(tree));
    await attempt("equivalence", () => equivalenceChecks({ sourceOverrides, scale: "mutant", react: false }));
    const by = results.filter((r) => !r.pass).map((r) => r.id);
    rows.push({ name, caught: by.length > 0, by, errors });
    console.log(`${by.length ? "CAUGHT" : "MISSED"}  ${name}${by.length ? ` — by ${by.join(", ")}` : ""}${errors.length ? ` — threw: ${errors.join("; ")}` : ""}`);
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
    console.log(`        ${k}: ${text.length > 1200 && !process.env.ROUTE_C6_PRINT_TRACES ? `${text.slice(0, 1197)}...` : text}`);
  }
};

if (MUTANTS) {
  console.log(`route domain events · mutants of the working tree (in memory), against baseline ${BASELINE.slice(0, 7)}\n`);
  await runMutants();
} else {
  const TREE = openSourceTree({ rev: REV });
  console.log(`route domain events · ${REV ? `rev ${TREE.rev.slice(0, 12)}` : "working tree"} vs baseline ${BASELINE.slice(0, 7)} (the hook dispatches the eleven C5 actions itself)\n`);
  const tests = [];
  const show = (results) => {
    for (const result of results) {
      tests.push(result);
      print(result);
    }
  };
  show(structureChecks(TREE));
  show(contractChecks(TREE));
  show(traceChecks({ rev: REV, tree: TREE }));
  show(preservedChecks(TREE));
  show(await equivalenceChecks({ rev: REV }));
  const failing = tests.filter((t) => !t.pass).map((t) => t.id);
  const tallyKind = (kind) => {
    const of = tests.filter((t) => t.kind === kind);
    return `${of.filter((t) => t.pass).length}/${of.length}`;
  };
  console.log(
    `\n${REV ? `rev ${TREE.rev.slice(0, 12)} · ` : ""}${tests.length - failing.length}/${tests.length} passed · structure ${tallyKind("structure")} · ` +
      `contract ${tallyKind("contract")} · trace ${tallyKind("trace")} · preserved ${tallyKind("preserved")} · equivalence ${tallyKind("equivalence")} · ` +
      `failing: ${failing.join(", ") || "none"}`,
  );
  process.exitCode = failing.length ? EXIT_VALIDATION_FAILED : EXIT_OK;
}
