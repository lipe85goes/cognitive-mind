/**
 * ROUTE-C4 — the Rota's dynamic invariants, extracted out of `useEscapeMaze.ts`, tested.
 *
 *   src/games/escape-maze/route-invariants.ts  the runtime contract: is a
 *                                               logical state of a Route
 *                                               possible, and can every
 *                                               unfinished objective still be
 *                                               reached on its walls —
 *                                               `inspectDynamicMazeState`, its
 *                                               snapshot, its verdict, and the
 *                                               state's vocabulary the snapshot
 *                                               is written in (`GameStatus`,
 *                                               `ChestReward`).
 *
 * When to ask stays in the hook (`dynamicSolvability`, computed on every render
 * from the state the hook holds), and so does the turn (`runDefenderPhase`,
 * step, Chest, Pickaxe, Second Chance, input, end of the Route). C4 is a pure
 * refactor: the declarations moved, nothing they decide did. Three groups of
 * checks hold it to that:
 *
 *   [structure]    WHERE the code lives, and the static gate against it
 *                  drifting back: every moved declaration is declared in
 *                  route-invariants.ts and nowhere else in `src/` (the Seed
 *                  Garden's own, unrelated `GameStatus` is a homonym, not a
 *                  copy); the hook declares none of it (not even as text),
 *                  imports exactly what route-invariants exports in one
 *                  declaration and re-exports all of it; no issue code is
 *                  spelled anywhere else; route-invariants imports only
 *                  configuration, geometry and types (`MazeMap` as a type only)
 *                  — never React, the hook, the defenders, the RNG, UI, Babylon,
 *                  sounds, scoring or storage — and reaches only configuration
 *                  and geometry at run time; nothing below it reaches it, only
 *                  the hook imports it, and the Rota's run-time graph has no
 *                  cycle; the C0 surface, the instrumented generator, the
 *                  runtime harness (which dynamic-solvability-02 and the
 *                  adversarial replay load), `routeModuleDeclaring` and textual
 *                  anchors all find it in route-invariants.ts.
 *   [preserved]    what must not have changed: GameStatus and the block from
 *                  ChestReward to the end of inspectDynamicMazeState are the
 *                  baseline's text byte for byte, comments included; every
 *                  remaining hook statement is the baseline's text, in order,
 *                  and none other went missing; the whole `useEscapeMaze` body
 *                  — and in it the `dynamicSolvability` call with its eleven
 *                  snapshot fields — is the baseline's; the hook's public
 *                  surface (types and values, parser and run time) is the
 *                  baseline's and its product consumers (RouteStrategyGame's
 *                  ChestReward, RouteBabylonBoard's GameStatus) still find it
 *                  there, unchanged; every other Rota module is untouched; the
 *                  catalogue of 26 issue codes, read off the code, is the
 *                  baseline's, in the same push order.
 *   [equivalence]  the working tree against 940c856 (C3, invariants still in
 *                  the hook), both loaded through route-module-loader: a
 *                  hand-built adversarial corpus that produces every issue code
 *                  (each mobile out of the board and on a wall, defenders
 *                  together, the Explorer on each defender under every status,
 *                  defenders on the portal and on armed traps, unknown lights
 *                  and traps, every Chest/reward/Pickaxe combination, broken
 *                  walls that are not walls, sealed objectives, a chest-less
 *                  map) compared as whole issue SEQUENCES against a written
 *                  expectation and between trees; thousands of random states
 *                  over generated maps (every code reached, issue order
 *                  checked against the push order); effective walls for every
 *                  wall of every map opened; topology vs mobile defenders and
 *                  the composition of objectives; mutation safety (walls,
 *                  lights, traps, positions, iterables read once, two calls
 *                  equal but not shared); and real Routes played by the real
 *                  hook — every mode, Routes 1/2/3, nine policies through
 *                  traps, Chest, Pickaxe, Second Chance, win, loss, restart,
 *                  mode change (setup) and the next Route — with
 *                  `game.dynamicSolvability` compared at every step and
 *                  recomputed from the very state it was computed from.
 *
 * `--rev=<commit>` runs every check on that tree instead of the working tree.
 * `--rev=940c856` is the structural counterfactual: the invariants still lived
 * in useEscapeMaze.ts there, so every [structure] check must fail, while every
 * [preserved] and [equivalence] check holds (same code, same behaviour).
 *
 * Usage: node tools/validation/route-invariants-extraction-tests.mjs [--rev=<commit>]
 * Writes nothing. Exit 0 = every check holds, 1 = a check failed, 3 = usage error.
 */
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";
import { loadInstrumented, routeModuleDeclaring } from "./instrumented-generator.mjs";
import {
  INTERNALS_EXPORT,
  ROUTE_HOOK,
  ROUTE_MODULE_DIR,
  ROUTE_RANDOM_SEAM,
  loadRouteModules,
  openSourceTree,
  routeRandomBeforeC7A,
  treeBeforeC7B,
  hookExportsBeforeC7C,
} from "./route-module-loader.mjs";
import { cellKey, loadRouteRuntime, pathBetween, walkableNeighbours } from "./route-runtime-harness.mjs";

/** C3: the last revision whose dynamic invariants lived in the hook — what C4 must be equivalent to. */
const BASELINE = "940c85642a1f06d4cb31f83252361609ff650848";
const ROUTE_INVARIANTS = "src/games/escape-maze/route-invariants.ts";
const ROUTE_DEFENDERS = "src/games/escape-maze/route-defenders.ts";
const ROUTE_GENERATION = "src/games/escape-maze/route-generation.ts";
const ROUTE_GEOMETRY = "src/games/escape-maze/route-geometry.ts";
const ROUTE_CONFIG = "src/games/escape-maze/route-config.ts";
const CONTINUATION = "src/games/escape-maze/continuation.ts";
const DIFFICULTY = "src/engine/difficulty.ts";
/** Every Rota file C4 must not have touched, product consumers included. */
const UNTOUCHED = [
  ROUTE_CONFIG, ROUTE_GEOMETRY, ROUTE_GENERATION, ROUTE_DEFENDERS, ROUTE_RANDOM_SEAM, DIFFICULTY, CONTINUATION,
  "src/games/escape-maze/RouteStrategyGame.tsx", "src/games/escape-maze/RouteBabylonBoard.tsx",
  "src/games/escape-maze/routeBabylonScene.ts", "src/types/game.ts", "src/engine/scoring.ts", "src/lib/game-sounds.ts",
];
/** The hook's real consumers in the product, and the names C4 moved that they import from it. */
const CONSUMERS = ["src/games/escape-maze/RouteStrategyGame.tsx", "src/games/escape-maze/RouteBabylonBoard.tsx"];
const CONSUMED_MOVED = { "src/games/escape-maze/RouteStrategyGame.tsx": ["ChestReward"], "src/games/escape-maze/RouteBabylonBoard.tsx": ["GameStatus"] };

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
if (args.some((arg) => arg !== revArg) || REV === "") {
  console.error("usage: node tools/validation/route-invariants-extraction-tests.mjs [--rev=<commit>]");
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

// --- what C4 moved -------------------------------------------------------------------------------

const MOVED_VALUES = ["inspectDynamicMazeState"];
/**
 * The snapshot and the verdict, and the state's vocabulary the snapshot is written in. `GameStatus` and `ChestReward`
 * moved because route-invariants may not import the hook to name them; nothing else needed them: a separate types
 * module would have held exactly these two names and served exactly these two modules.
 */
const MOVED_TYPES = ["GameStatus", "ChestReward", "DynamicMazeStateSnapshot", "DynamicSolvabilityInspection"];
const MOVED = [...MOVED_VALUES, ...MOVED_TYPES];
/** What route-invariants exports: exactly what moved, all of it already exported from the hook before. */
const INVARIANTS_EXPORTS = sortedList(MOVED);
/** Left in the hook on purpose: input, chest copy and the turn itself (C5/C6). None of it may have moved. */
const KEPT_IN_HOOK_VALUES = [
  "ARROW_DELTAS", "BREAK_DIRECTION_DELTAS", "MOVE_INPUT_GUARD_MS", "SECOND_CHANCE_EXPLORER_MESSAGE",
  "SECOND_CHANCE_DEFENDER_MESSAGE", "useEscapeMaze",
];
const KEPT_IN_HOOK_TYPES = ["BreakDirection", "BreakTarget", "CompleteFn", "DefenderPhaseInput"];

/** What route-invariants may import. `route-generation` for the `MazeMap` type, and only as a type. */
const ALLOWED_IMPORTS = [
  "@/games/escape-maze/route-config", "@/games/escape-maze/route-generation", "@/games/escape-maze/route-geometry",
  "@/types/game",
];
const TYPE_ONLY_IMPORTS = ["@/games/escape-maze/route-generation", "@/types/game"];
const FORBIDDEN_IMPORT =
  /react|useEscapeMaze|route-defenders|route-random|difficulty|continuation|babylon|game-sounds|scoring|storage|components\/|GameScreen|RouteStrategyGame|RouteBabylonBoard|\.tsx$|^@\/app\//i;

/**
 * The issue codes, as the code pushes them: one entry per `issues.push` site, in source order. `${label}` is the
 * mobile loop, expanded over PLAYER, HUNTER, SENTINEL (out of the board OR on a wall, never both, per mobile).
 */
const PUSH_SITES = [
  "BROKEN_WALL_NOT_IN_BASE_MAP", "${label}_OUT_OF_BOUNDS", "${label}_ON_WALL", "DEFENDER_CO_OCCUPANCY",
  "PLAYER_DEFENDER_CO_OCCUPANCY", "HUNTER_ON_PORTAL", "SENTINEL_ON_PORTAL", "UNKNOWN_COLLECTED_LIGHT",
  "UNKNOWN_ARMED_TRAP", "HUNTER_ON_ARMED_TRAP", "SENTINEL_ON_ARMED_TRAP", "REWARD_BEFORE_CHEST",
  "REWARD_SPENT_BEFORE_CHEST", "WALL_BROKEN_BEFORE_CHEST", "PLAYER_ON_UNOPENED_CHEST", "PENDING_REWARD_ALREADY_SPENT",
  "PENDING_REWARD_AWAY_FROM_CHEST", "SELECTED_REWARD_WITH_CLOSED_CHEST", "SPENT_REWARD_WITHOUT_SELECTION",
  "SPENT_PICKAXE_WITHOUT_OPEN_WALL", "OPEN_WALL_WITHOUT_SPENT_PICKAXE", "UNREACHABLE_OBJECTIVE",
];
const MOBILE_LABELS = ["PLAYER", "HUNTER", "SENTINEL"];
/** The 26 codes the contract can produce — confirmed against the code (P7), not trusted. */
const ISSUE_CODES = [
  "BROKEN_WALL_NOT_IN_BASE_MAP", "PLAYER_OUT_OF_BOUNDS", "HUNTER_OUT_OF_BOUNDS", "SENTINEL_OUT_OF_BOUNDS",
  "PLAYER_ON_WALL", "HUNTER_ON_WALL", "SENTINEL_ON_WALL", "DEFENDER_CO_OCCUPANCY", "PLAYER_DEFENDER_CO_OCCUPANCY",
  "HUNTER_ON_PORTAL", "SENTINEL_ON_PORTAL", "UNKNOWN_COLLECTED_LIGHT", "UNKNOWN_ARMED_TRAP", "HUNTER_ON_ARMED_TRAP",
  "SENTINEL_ON_ARMED_TRAP", "REWARD_BEFORE_CHEST", "REWARD_SPENT_BEFORE_CHEST", "WALL_BROKEN_BEFORE_CHEST",
  "PLAYER_ON_UNOPENED_CHEST", "PENDING_REWARD_ALREADY_SPENT", "PENDING_REWARD_AWAY_FROM_CHEST",
  "SELECTED_REWARD_WITH_CLOSED_CHEST", "SPENT_REWARD_WITHOUT_SELECTION", "SPENT_PICKAXE_WITHOUT_OPEN_WALL",
  "OPEN_WALL_WITHOUT_SPENT_PICKAXE", "UNREACHABLE_OBJECTIVE",
];
/**
 * Emission rank of each code: the push site it comes from, with the three mobiles of the loop as three consecutive
 * ranks. An issue list is in contract order exactly when its ranks never decrease; only the two per-key codes (one
 * issue per unknown light / armed trap) may repeat.
 */
const RANK = (() => {
  const rank = {};
  let next = 0;
  for (const site of PUSH_SITES) {
    if (site === "${label}_OUT_OF_BOUNDS") {
      MOBILE_LABELS.forEach((label, i) => {
        rank[`${label}_OUT_OF_BOUNDS`] = next + i;
        rank[`${label}_ON_WALL`] = next + i;
      });
      next += MOBILE_LABELS.length;
    } else if (site !== "${label}_ON_WALL") rank[site] = next++;
  }
  return rank;
})();
const REPEATABLE = ["UNKNOWN_COLLECTED_LIGHT", "UNKNOWN_ARMED_TRAP"];
/** The snapshot the hook hands the contract on every render, field by field, as written in its return. */
const DYNAMIC_SOLVABILITY_CALL_FIELDS = [
  "mazeMap", "player", "guardian", "sentinel: sentinel.position", "collectedStars", "triggeredTraps", "chestOpened",
  "rewardSelected", "rewardSpent", "brokenWall", "status",
];

const DIFFICULTIES = ["easy", "medium", "hard"];
const STAGES = [1, 2, 3];
const STATUSES = ["setup", "playing", "won", "lost"];

// --- harness -------------------------------------------------------------------------------------

const tests = [];
const record = (id, kind, name, pass, detail = {}) => {
  tests.push({ id, kind, name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} [${kind}] — ${name}`);
  for (const [k, v] of Object.entries(detail)) {
    const text = typeof v === "object" ? JSON.stringify(v) : String(v);
    console.log(`        ${k}: ${text.length > 700 ? `${text.slice(0, 697)}...` : text}`);
  }
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sha = (value) => crypto.createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex").slice(0, 16);
function sortedList(list) {
  return [...list].sort();
}
const sorted = sortedList;
const errorOf = (fn) => {
  try {
    fn();
    return null;
  } catch (error) {
    return error.message;
  }
};
const codeOnly = (source) => source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
/** A test-local PRNG: the corpus is the same for both trees and never touches the Rota's stream. */
const prng = (seed) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
};
const pick = (rand, items) => items[Math.floor(rand() * items.length)];
const tally = (counts, label) => {
  counts[label] = (counts[label] ?? 0) + 1;
};

// ROUTE-C7B: the text this extraction pins is read through C7B's sanctioned edit of the hook, the Rota's view and its
// stylesheet (route-module-loader.mjs `treeBeforeC7B`), and C7B's two new modules are not in it; every other byte is
// still compared. Its graph questions (closure, declaring, locate) are the tree's own, and its runs load `rev`.
const TREE = treeBeforeC7B(openSourceTree({ rev: REV }));
const BASE_TREE = openSourceTree({ rev: BASELINE });
const label = REV ? `rev ${TREE.rev.slice(0, 12)}` : "working tree";
console.log(`route-invariants extraction · ${label} vs baseline ${BASELINE.slice(0, 7)} (invariants in the hook)\n`);

const parse = (file, source) =>
  ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const isExported = (node) => (ts.getModifiers?.(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

/** Top-level declarations of a module, by the parser, with each statement's text (leading comments included). */
function declarations(file, source) {
  const sf = parse(file, source);
  const out = {
    values: [], types: [], exported: [], reexports: [], imports: [], statements: [], named: [], text: new Map(), code: new Map(), span: new Map(),
  };
  const keep = (name, statement) => {
    out.text.set(name, statement.getFullText(sf).trim());
    out.code.set(name, statement.getText(sf));
    out.span.set(name, { start: statement.getFullStart(), end: statement.end });
  };
  for (const statement of sf.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      const named = clause?.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements : [];
      out.imports.push({
        specifier: statement.moduleSpecifier.text,
        typeOnly: Boolean(clause?.isTypeOnly) || (named.length > 0 && !clause?.name && named.every((e) => e.isTypeOnly)),
        names: named.map((e) => e.name.text),
        valueNames: clause?.isTypeOnly ? [] : named.filter((e) => !e.isTypeOnly).map((e) => e.name.text),
      });
      continue;
    }
    if (ts.isExportDeclaration(statement)) {
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        const names = statement.exportClause.elements.map((e) => e.name.text);
        out.exported.push(...names);
        out.reexports.push({ names, typeOnly: statement.isTypeOnly, from: statement.moduleSpecifier?.text ?? null });
      }
      continue;
    }
    const text = statement.getFullText(sf).trim();
    out.statements.push(text);
    let name = null;
    if (ts.isVariableStatement(statement)) {
      for (const d of statement.declarationList.declarations) {
        name ??= d.name.text;
        out.values.push(d.name.text);
        keep(d.name.text, statement);
        if (isExported(statement)) out.exported.push(d.name.text);
      }
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      name = statement.name.text;
      out.values.push(name);
      keep(name, statement);
      if (isExported(statement)) out.exported.push(name);
    } else if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
      name = statement.name.text;
      out.types.push(name);
      keep(name, statement);
      if (isExported(statement)) out.exported.push(name);
    }
    out.named.push({ name, text });
  }
  return out;
}
/** A declaration's text with the `export` modifier removed — the one change a moved declaration may carry. */
const unexported = (text) => text.replace(/^export (?=(?:async )?(?:function|interface|const|let|type|class) )/gm, "");

const read = (tree, file) => (tree.exists(file) ? tree.read(file) : "");
const hookText = TREE.read(ROUTE_HOOK);
const hook = declarations(ROUTE_HOOK, hookText);
/**
 * ROUTE-C5 rewrote `useEscapeMaze`'s body (the session state became one reducer, in route-state.ts) and added one pure
 * helper beside it (`sentinelPostOn`). On a tree that has route-state.ts those two are C5's text — held render by render
 * against 74ff2dc by route-state-reducer-tests.mjs — and every other statement must still be this baseline's.
 */
const C5_REWRITTEN = TREE.exists("src/games/escape-maze/route-state.ts") ? ["useEscapeMaze"] : [];
const C5_ADDED = C5_REWRITTEN.length ? ["sentinelPostOn"] : [];
const invariantsExists = TREE.exists(ROUTE_INVARIANTS);
const invariantsText = read(TREE, ROUTE_INVARIANTS);
const invariants = declarations(ROUTE_INVARIANTS, invariantsText);
const baseHookText = BASE_TREE.read(ROUTE_HOOK);
const baseHook = declarations(ROUTE_HOOK, baseHookText);
const closure = TREE.closure(ROUTE_HOOK);
const valueOwner = (name) => errorOf(() => TREE.declaring(name, { within: "src/" })) ?? TREE.declaring(name, { within: "src/" });
const owners = Object.fromEntries(MOVED_VALUES.map((name) => [name, valueOwner(name)]));
/** Which of the two candidate modules declares a moved type (types are not run-time bindings, so `declaring` cannot). */
const typeOwner = (name) => {
  const holders = [invariants.types.includes(name) && ROUTE_INVARIANTS, hook.types.includes(name) && ROUTE_HOOK].filter(Boolean);
  return holders.length === 1 ? holders[0] : holders.length ? holders : null;
};
const ownerOf = (name) => (MOVED_TYPES.includes(name) ? typeOwner(name) : owners[name]?.startsWith?.("src/") ? owners[name] : null);
const resolvesTo = (from, specifier) => errorOf(() => TREE.resolve(specifier, from)) ?? TREE.resolve(specifier, from);
const srcFiles = (
  REV
    ? execFileSync("git", ["ls-tree", "-r", "--name-only", TREE.rev, "src"], { encoding: "utf8" })
    : execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "src"], { encoding: "utf8" })
)
  .split("\n")
  .filter((file) => /\.(ts|tsx)$/.test(file) && TREE.exists(file));

// =================================================================================================
// [structure]
// =================================================================================================

// S1 — every moved declaration is declared in route-invariants.ts, which is in the hook's run-time graph.
{
  const misplaced = MOVED.filter((name) => ownerOf(name) !== ROUTE_INVARIANTS);
  record(
    "S1",
    "structure",
    "INVARIANTS_LIVE_IN_ROUTE_INVARIANTS",
    invariantsExists && closure.includes(ROUTE_INVARIANTS) && misplaced.length === 0,
    {
      inHookGraph: closure.includes(ROUTE_INVARIANTS),
      declaredIn: Object.fromEntries(MOVED.map((name) => [name, ownerOf(name)])),
      misplaced,
    },
  );
}

// S2 — the static gate: the hook declares none of it (values or types), not even as declaration text.
{
  const redeclared = MOVED.filter((name) => hook.values.includes(name) || hook.types.includes(name));
  // Everything but the import/export header, where `type GameStatus` legitimately names the imported type.
  const hookCode = codeOnly(hook.statements.join("\n"));
  const declarationText = MOVED.filter((name) =>
    new RegExp(String.raw`\b(?:function|const|let|var|interface|type|class)\s+${name}\b`).test(hookCode),
  );
  record("S2", "structure", "HOOK_DECLARES_NONE_OF_IT", redeclared.length === 0 && declarationText.length === 0, {
    redeclaredInHook: redeclared,
    declarationTextInHook: declarationText,
  });
}

// S3 — the hook asks route-invariants: one import declaration naming exactly what route-invariants exports (the
// function as a value, the four shapes as types); it re-exports all five, the function as a value and the four as
// types; it calls the contract once (`dynamicSolvability`); and the BFS the contract walks with left the hook with it.
{
  const fromInvariants = hook.imports.filter((imp) => resolvesTo(ROUTE_HOOK, imp.specifier) === ROUTE_INVARIANTS);
  const imported = sorted(fromInvariants.flatMap((imp) => imp.names));
  const importedValues = sorted(fromInvariants.flatMap((imp) => imp.valueNames));
  const exported = sorted(invariants.exported);
  const valueReexports = sorted(hook.reexports.filter((r) => !r.typeOnly && r.from === null).flatMap((r) => r.names).filter((n) => MOVED.includes(n)));
  const typeReexports = sorted(hook.reexports.filter((r) => r.typeOnly && r.from === null).flatMap((r) => r.names).filter((n) => MOVED.includes(n)));
  const hookCode = codeOnly(hookText);
  const calls = (hookCode.match(/\binspectDynamicMazeState\(/g) ?? []).length;
  const bfsInHook = ["getReachableDistances", "unreachableObjectives", "effectiveWalls", "insideBoard"].filter((name) => new RegExp(String.raw`\b${name}\b`).test(hookCode));
  record(
    "S3",
    "structure",
    "HOOK_IMPORTS_AND_REEXPORTS_THE_INVARIANTS",
    fromInvariants.length === 1 && same(imported, INVARIANTS_EXPORTS) && same(exported, INVARIANTS_EXPORTS) &&
      same(importedValues, MOVED_VALUES) && same(valueReexports, MOVED_VALUES) && same(typeReexports, sorted(MOVED_TYPES)) &&
      calls === 1 && bfsInHook.length === 0,
    {
      importDeclarations: fromInvariants.map((imp) => imp.specifier),
      hookImports: imported,
      hookValueImports: importedValues,
      routeInvariantsExports: exported,
      hookReexports: { values: valueReexports, types: typeReexports },
      callsInHook: calls,
      invariantInternalsStillInHook: bfsInHook,
    },
  );
}

/** The Rota's run-time import graph (type-only edges are gone from the transpiled output), as edges file → file. */
const runtimeEdges = (tree, files) =>
  Object.fromEntries(
    files.map((file) => [
      file,
      tree
        .runtimeImports(file)
        .map((specifier) => errorOf(() => tree.resolve(specifier, file)) ?? tree.resolve(specifier, file))
        .filter((target) => typeof target === "string" && tree.exists(target)),
    ]),
  );
function findCycle(edges) {
  const state = new Map();
  const stack = [];
  const visit = (file) => {
    state.set(file, "open");
    stack.push(file);
    for (const next of edges[file] ?? []) {
      if (state.get(next) === "open") return [...stack.slice(stack.indexOf(next)), next];
      if (!state.has(next)) {
        const found = visit(next);
        if (found) return found;
      }
    }
    stack.pop();
    state.set(file, "done");
    return null;
  };
  for (const file of Object.keys(edges)) {
    if (!state.has(file)) {
      const found = visit(file);
      if (found) return found;
    }
  }
  return null;
}

// S4 — dependency rule: route-invariants imports only configuration, geometry and types (route-generation and types as
// types only), nothing forbidden, mentions no browser/React/RNG/render global; at run time it reaches exactly
// configuration and geometry — never the hook, generation, the defenders, the RNG seam or difficulty; nothing below it
// reaches it or names it; in `src/` only the hook imports it at run time (the product's consumers keep importing from
// the hook; since ROUTE-C5 route-state.ts names its two state types, and since ROUTE-C6 route-events.ts names
// `ChestReward` for the reward an event chooses — both as types only);
// and the whole run-time graph of the hook is acyclic.
{
  const decl = invariants;
  const specifiers = decl.imports.map((imp) => imp.specifier);
  const notAllowed = specifiers.filter((spec) => !ALLOWED_IMPORTS.includes(spec));
  const forbidden = specifiers.filter((spec) => FORBIDDEN_IMPORT.test(spec));
  const notTypeOnly = decl.imports.filter((imp) => TYPE_ONLY_IMPORTS.includes(imp.specifier) && !imp.typeOnly).map((imp) => imp.specifier);
  const code = codeOnly(invariantsText);
  const mentions = [
    "use client", "window", "document", "Math.random", "routeRandom", "useState", "useEffect", "useMemo", "useCallback", "useRef",
    "BABYLON", "localStorage", "setTimeout", "Date.now", "console.",
  ].filter((word) => code.includes(word));
  const reach = invariantsExists ? TREE.closure(ROUTE_INVARIANTS) : [];
  const below = [ROUTE_CONFIG, ROUTE_GEOMETRY, ROUTE_GENERATION, ROUTE_DEFENDERS, ROUTE_RANDOM_SEAM, DIFFICULTY, CONTINUATION];
  const reachInvariants = below.filter((file) => TREE.exists(file) && TREE.closure(file).includes(ROUTE_INVARIANTS));
  const namesInvariants = below.filter((file) => /route-invariants/.test(read(TREE, file)));
  const importers = srcFiles.filter((file) =>
    file !== ROUTE_INVARIANTS && declarations(file, TREE.read(file)).imports.some((imp) => resolvesTo(file, imp.specifier) === ROUTE_INVARIANTS),
  );
  // ROUTE-C5: route-state.ts names `GameStatus` and `ChestReward` for its state's fields — as types only, so the hook
  // is still the one module that imports route-invariants at run time. ROUTE-C6: so does route-events.ts, for the
  // reward REWARD_SELECTED carries — a type only, too.
  const typeOnlyImporters = importers.filter((file) =>
    declarations(file, TREE.read(file)).imports.filter((imp) => resolvesTo(file, imp.specifier) === ROUTE_INVARIANTS).every((imp) => imp.typeOnly),
  );
  const runtimeImporters = importers.filter((file) => !typeOnlyImporters.includes(file));
  const edges = runtimeEdges(TREE, closure);
  const cycle = findCycle(edges);
  record(
    "S4",
    "structure",
    "ROUTE_INVARIANTS_IS_PURE_AND_ACYCLIC",
    invariantsExists && notAllowed.length === 0 && forbidden.length === 0 && notTypeOnly.length === 0 && mentions.length === 0 &&
      same(sorted(reach), sorted([ROUTE_INVARIANTS, ROUTE_GEOMETRY, ROUTE_CONFIG])) && reachInvariants.length === 0 &&
      namesInvariants.length === 0 && same(runtimeImporters, [ROUTE_HOOK]) &&
      typeOnlyImporters.every((file) => file === "src/games/escape-maze/route-state.ts" || file === "src/games/escape-maze/route-events.ts") && cycle === null &&
      (edges[ROUTE_HOOK] ?? []).includes(ROUTE_INVARIANTS),
    {
      imports: decl.imports.map((imp) => `${imp.specifier}${imp.typeOnly ? " (type)" : ""}`),
      notAllowed,
      forbidden,
      shouldBeTypeOnly: notTypeOnly,
      mentions,
      runtimeReach: reach,
      modulesBelowThatReachIt: reachInvariants,
      modulesBelowThatNameIt: namesInvariants,
      importedBy: importers,
      typeOnlyImporters,
      cycle,
      rotaRuntimeGraph: Object.fromEntries(Object.entries(edges).map(([file, to]) => [file.replace(ROUTE_MODULE_DIR, ""), to.map((t) => t.replace(ROUTE_MODULE_DIR, ""))])),
    },
  );
}

// S5 — no residual duplication: across every source module of the repository, each moved name is declared exactly once
// among the Rota's modules — in route-invariants.ts — and the code of each moved declaration exists exactly once
// (the Seed Garden's own `GameStatus` is a homonym with another body, reported, not a copy); and no issue code is
// spelled in any source module but route-invariants.ts, where each push site is written once.
{
  const texts = srcFiles.map((file) => ({ file, text: TREE.read(file) }));
  const declaredBy = Object.fromEntries(MOVED.map((name) => [name, []]));
  const bodies = new Map();
  for (const { file, text } of texts) {
    const decl = declarations(file, text);
    for (const name of MOVED) if (decl.values.includes(name) || decl.types.includes(name)) declaredBy[name].push(file);
    if (file === ownerOf("inspectDynamicMazeState") || file === ROUTE_HOOK || file === ROUTE_INVARIANTS) {
      for (const name of MOVED) if (decl.code.has(name)) bodies.set(name, unexported(decl.code.get(name)));
    }
  }
  const inRota = (files) => files.filter((file) => file.startsWith(ROUTE_MODULE_DIR));
  const notOnce = Object.entries(declaredBy).filter(([, files]) => inRota(files).length !== 1 || inRota(files)[0] !== ROUTE_INVARIANTS);
  const homonyms = Object.fromEntries(Object.entries(declaredBy).map(([name, files]) => [name, files.filter((file) => !file.startsWith(ROUTE_MODULE_DIR))]).filter(([, files]) => files.length));
  const bodyCopies = [...bodies].map(([name, body]) => [name, texts.reduce((sum, { text }) => sum + (unexported(text).split(body).length - 1), 0)]);
  const copied = bodyCopies.filter(([, count]) => count !== 1);
  const literalCodes = PUSH_SITES.filter((site) => !site.includes("${"));
  const codeSpelledIn = {};
  for (const { file, text } of texts) {
    const code = codeOnly(text);
    const found = [...literalCodes.filter((c) => code.includes(`"${c}"`)), ...["_OUT_OF_BOUNDS`", "_ON_WALL`"].filter((c) => code.includes(c))];
    if (found.length) codeSpelledIn[file] = found.length;
  }
  const pushSitesOnce = literalCodes.every((c) => codeOnly(invariantsText).split(`issues.push("${c}")`).length - 1 === 1);
  record(
    "S5",
    "structure",
    "NO_RESIDUAL_DUPLICATION",
    notOnce.length === 0 && copied.length === 0 && bodies.size === MOVED.length && same(Object.keys(codeSpelledIn), [ROUTE_INVARIANTS]) && pushSitesOnce,
    {
      sourceModulesScanned: srcFiles.length,
      notDeclaredOnceInRouteInvariants: Object.fromEntries(notOnce),
      homonymsOutsideTheRota: homonyms,
      bodiesFound: bodies.size,
      bodiesNotExactlyOnce: Object.fromEntries(copied),
      issueCodesSpelledIn: codeSpelledIn,
      eachPushSiteOnceInRouteInvariants: pushSitesOnce,
    },
  );
}

// =================================================================================================
// [preserved] — the text
// =================================================================================================

// P1 — every moved declaration, wherever it is declared now, is the baseline's text, leading comments included; the
// whole block from ChestReward's comment to the end of inspectDynamicMazeState is the baseline's block verbatim — same
// order, nothing inserted — and so is the GameStatus line. Nothing gained or lost `export`: all five were exported.
{
  const changed = MOVED.filter((name) => {
    const before = baseHook.text.get(name);
    const where = ownerOf(name);
    return !before || typeof where !== "string" || !read(TREE, where).includes(before);
  });
  const first = baseHook.span.get("ChestReward");
  const last = baseHook.span.get("inspectDynamicMazeState");
  const baseBlock = baseHookText.slice(first.start, last.end).trim();
  const blockHome = ownerOf("inspectDynamicMazeState");
  const blockVerbatim = typeof blockHome === "string" && read(TREE, blockHome).includes(baseBlock);
  const home = typeof blockHome === "string" ? declarations(blockHome, read(TREE, blockHome)) : null;
  const exportChanged = home ? MOVED.filter((name) => home.exported.includes(name) !== baseHook.exported.includes(name)) : MOVED;
  record("P1", "preserved", "MOVED_DECLARATIONS_ARE_VERBATIM", changed.length === 0 && blockVerbatim && exportChanged.length === 0, {
    declarationsCompared: MOVED.length,
    textChanged: changed,
    blockLines: baseBlock.split("\n").length,
    blockVerbatimIn: blockVerbatim ? blockHome : null,
    exportModifierChanged: exportChanged,
  });
}

// P2 — the hook's remaining code is the baseline's text: its statements (everything but the import/export header) are
// exactly the baseline's statements minus the moved ones, in the same order, each byte for byte.
{
  const movedHere = (name) => MOVED.includes(name) && ownerOf(name) !== ROUTE_HOOK;
  const expected = baseHook.named.filter((entry) => !movedHere(entry.name) && !C5_REWRITTEN.includes(entry.name)).map((entry) => entry.text);
  const now = hook.named.filter((entry) => !C5_REWRITTEN.includes(entry.name) && !C5_ADDED.includes(entry.name)).map((entry) => entry.text);
  const extra = now.filter((text) => !expected.includes(text));
  const missing = expected.filter((text) => !now.includes(text));
  const firstLine = (text) => text.split("\n").find((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))?.slice(0, 80);
  record("P2", "preserved", "HOOK_OTHERWISE_UNCHANGED", same(now, expected), {
    hookStatements: now.length,
    baselineStatements: baseHook.named.length,
    removed: baseHook.named.filter((entry) => movedHere(entry.name)).map((entry) => entry.name),
    rewrittenOrAddedByC5: [...C5_REWRITTEN, ...C5_ADDED],
    notInBaseline: extra.map(firstLine),
    missingFromHook: missing.map(firstLine),
  });
}

// P3 — the turn and the moment of asking stay in the hook, untouched: the whole `useEscapeMaze` body is the baseline's
// text (or C5's, where route-state.ts exists — C5_REWRITTEN) — runDefenderPhase, the step, the Chest, the Pickaxe,
// Second Chance, input, the end of the Route, and the one `dynamicSolvability: inspectDynamicMazeState({...})` with the
// same eleven fields in the same order; what C6 will move is still declared in the hook; none of the turn leaked into
// route-invariants' code.
{
  const missing = [...KEPT_IN_HOOK_VALUES.filter((n) => !hook.values.includes(n)), ...KEPT_IN_HOOK_TYPES.filter((n) => !hook.types.includes(n))];
  const changed = [...KEPT_IN_HOOK_VALUES, ...KEPT_IN_HOOK_TYPES].filter((n) => !C5_REWRITTEN.includes(n) && hook.text.get(n) !== baseHook.text.get(n));
  const body = hook.text.get("useEscapeMaze") ?? "";
  // The body is the baseline's — or C5's, where route-state.ts exists (C5_REWRITTEN). The moment of asking is checked
  // either way: the same one call, with the same eleven fields.
  const sameBody = C5_REWRITTEN.includes("useEscapeMaze") || body === baseHook.text.get("useEscapeMaze");
  const call = body.match(/ {4}dynamicSolvability: inspectDynamicMazeState\(\{\n([\s\S]*?)\n {4}\}\),/);
  const fields = call ? call[1].split("\n").map((line) => line.trim().replace(/,$/, "")) : null;
  const phase = (body.match(/const runDefenderPhase = \(input: DefenderPhaseInput\) => \{/g) ?? []).length;
  const leaked = [
    "runDefenderPhase", "useEscapeMaze", "SECOND_CHANCE", "setRewardSpent", "setStatus", "DefenderPhaseInput", "chooseGuardianMove",
    "decideSentinelMove", "generateMaze", "tryMovePlayer", "breakWall", "chooseReward", "endGame", "onComplete",
  ].filter((name) => codeOnly(invariantsText).includes(name));
  record(
    "P3",
    "preserved",
    "TURN_AND_MOMENT_OF_ASKING_STAY_IN_THE_HOOK",
    missing.length === 0 && changed.length === 0 && sameBody &&
      same(fields, DYNAMIC_SOLVABILITY_CALL_FIELDS) && phase === 1 && leaked.length === 0,
    {
      kept: KEPT_IN_HOOK_VALUES.length + KEPT_IN_HOOK_TYPES.length,
      missingFromHook: missing,
      textChanged: changed,
      useEscapeMazeBody: sha(body),
      sameBodyAsBaseline: body === baseHook.text.get("useEscapeMaze"),
      rewrittenByC5: C5_REWRITTEN,
      dynamicSolvabilityFields: fields,
      runDefenderPhaseDeclarations: phase,
      leakedToRouteInvariants: leaked,
    },
  );
}

// P4 — the hook's public surface, by the parser (values and types, declared or re-exported), is the baseline's: the
// five moved names are still exported from it; the product's consumers still import what they import from the hook —
// RouteStrategyGame its ChestReward, RouteBabylonBoard its GameStatus — find every name, and are unchanged.
{
  const exportsNow = sorted(hook.exported);
  const exportsBase = sorted(baseHook.exported);
  const consumers = CONSUMERS.map((file) => {
    const decl = declarations(file, TREE.read(file));
    const names = decl.imports.filter((imp) => resolvesTo(file, imp.specifier) === ROUTE_HOOK).flatMap((imp) => imp.names);
    return {
      file,
      names,
      movedNamesFromHook: CONSUMED_MOVED[file].filter((name) => names.includes(name)),
      missing: names.filter((name) => !exportsNow.includes(name)),
      unchanged: TREE.read(file) === BASE_TREE.read(file),
    };
  });
  record(
    "P4",
    "preserved",
    "PUBLIC_SURFACE_COMPATIBLE",
    same(exportsNow, exportsBase) && MOVED.every((name) => exportsNow.includes(name)) &&
      consumers.every((c) => c.missing.length === 0 && c.unchanged && same(c.movedNamesFromHook, CONSUMED_MOVED[c.file])),
    { hookExports: exportsNow, movedNamesExported: MOVED.filter((name) => exportsNow.includes(name)), consumers },
  );
}

// P5 — nothing else in the Rota moved: configuration, geometry, generation, the defenders, the RNG seam, difficulty,
// continuation, the product's Rota component, board and scene, the shared types, scoring and sounds are byte for byte
// the baseline's.
{
  // ROUTE-C7A: the RNG seam's checkpoint is C7A's one sanctioned edit there (two declarations rewritten, four added —
  // route-worker-rng-handoff-tests.mjs holds them); every other byte of the seam is still compared.
  const seamAware = (tree, file) => (file === ROUTE_RANDOM_SEAM && tree.exists(file) ? routeRandomBeforeC7A(tree) : read(tree, file));
  const touched = UNTOUCHED.filter((file) => seamAware(TREE, file) !== read(BASE_TREE, file));
  record("P5", "preserved", "EVERY_OTHER_ROTA_MODULE_UNTOUCHED", touched.length === 0, { compared: UNTOUCHED.length, touched });
}

// =================================================================================================
// load both Rotas
// =================================================================================================

const SURFACE = ["inspectDynamicMazeState", "generateMaze", "posKey", "computePortalDefenceZone", "createSentinelState", "decideSentinelMove"];
const NOW = loadRouteModules({ rev: REV, surface: SURFACE });
const BASE = loadRouteModules({ rev: BASELINE, surface: SURFACE });

// P6 — at run time: the same export names as the baseline, and the hook's inspectDynamicMazeState IS the function that
// inspects (a re-export, not a copy).
{
  // ROUTE-C7C's one declared removal from the hook (`generateMaze`, route-module-loader#ROUTE_HOOK_C7C_REMOVED_EXPORTS)
  // is counted back in: every other name is compared as before.
  const keys = (rota) => hookExportsBeforeC7C(rota.graph.tree, Object.keys(rota.hook).filter((k) => k !== INTERNALS_EXPORT));
  const shared = NOW.hook.inspectDynamicMazeState === NOW.api.inspectDynamicMazeState;
  record("P6", "preserved", "RUNTIME_SURFACE_UNCHANGED_AND_SHARED", same(keys(NOW), keys(BASE)) && shared && typeof NOW.hook.inspectDynamicMazeState === "function", {
    runtimeExports: keys(NOW),
    sameFunctionThroughTheHook: shared,
  });
}

// P7 — the catalogue of issue codes, read off each tree's code (not trusted): the push sites in source order and the
// labels of the mobile loop; both trees agree, and the expansion is exactly the 26 codes, each once.
const catalogue = (rota) => {
  const fn = rota.api.inspectDynamicMazeState.toString();
  const sites = [...fn.matchAll(/issues\.push\((`[^`]*`|"[^"]*")\)/g)].map((m) => m[1].slice(1, -1));
  const mobile = fn.match(/const mobile = \[([\s\S]*?)\] as const;|const mobile = \[([\s\S]*?)\];/);
  const labels = mobile ? [...(mobile[1] ?? mobile[2]).matchAll(/\[\s*"(\w+)",/g)].map((m) => m[1]) : [];
  const codes = sites.flatMap((site) => (site.includes("${label}") ? labels.map((l) => site.replace("${label}", l)) : [site]));
  return { sites, labels, codes };
};
{
  const now = catalogue(NOW);
  const base = catalogue(BASE);
  const expanded = sorted(now.codes);
  record(
    "P7",
    "preserved",
    "ISSUE_CODE_CATALOGUE_AND_PUSH_ORDER_UNCHANGED",
    same(now, base) && same(now.sites, PUSH_SITES) && same(now.labels, MOBILE_LABELS) && same(expanded, sorted(ISSUE_CODES)) &&
      new Set(now.codes).size === ISSUE_CODES.length,
    { pushSites: now.sites.length, mobileLabels: now.labels, codes: now.codes.length, sameAsBaseline: same(now, base) },
  );
}

// =================================================================================================
// [equivalence]
// =================================================================================================

/**
 * Runs one equivalence check. A check whose subject is broken enough to throw (a contract that hands back the map's own
 * wall set lets a caller empty it, and the next corpus has no walls to build on) is a failed check, with its error —
 * never a crashed run that hides the checks after it.
 */
const guarded = (id, kind, name, body) => {
  try {
    body();
  } catch (error) {
    record(id, kind, name, false, { threw: String(error?.stack ?? error).split("\n").slice(0, 3).join(" | ") });
  }
};

/** The verdict, canonical: Sets as their iteration order AND sorted (the contract's order and its content). */
const canonical = (out) => ({
  valid: out.valid,
  topologicallySolvable: out.topologicallySolvable,
  solvable: out.solvable,
  issues: [...out.issues],
  effectiveWalls: [...out.effectiveWalls],
  effectiveWallsSorted: [...out.effectiveWalls].sort(),
  effectiveWallsIsSet: out.effectiveWalls instanceof Set || out.effectiveWalls?.constructor?.name === "Set",
  unreachableObjectives: [...out.unreachableObjectives],
});
/** Contract order: ranks never decrease, and only the per-key codes repeat. */
const inContractOrder = (issues) =>
  issues.every((code, i) => RANK[code] !== undefined && (i === 0 || RANK[code] > RANK[issues[i - 1]] || (RANK[code] === RANK[issues[i - 1]] && code === issues[i - 1] && REPEATABLE.includes(code))));

/** The same maps on both trees, seeded per map: generation is not what C4 moved, so they must also be identical. */
function corpus(perCombination, base) {
  const maps = [];
  for (const stage of STAGES) {
    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < perCombination; i += 1) {
        const seed = base + stage * 10_000 + DIFFICULTIES.indexOf(difficulty) * 1000 + i;
        const make = (rota) => {
          rota.setSeed(seed);
          return rota.api.generateMaze(difficulty, stage);
        };
        maps.push({ seed, stage, difficulty, now: make(NOW), base: make(BASE) });
      }
    }
  }
  return maps;
}
const mapDigest = (map) => sha([[...map.walls], map.playerStart, map.guardianStart, map.exitPosition, map.collectibleStars, map.traps, map.chest]);
const MAPS = corpus(6, 4_400_000);
/** E3 mutates the sets the contract returns, on purpose: it gets maps of its own, so a broken contract cannot spill over. */
const WALL_MAPS = corpus(6, 4_500_000);
const mapsAgree = [...MAPS, ...WALL_MAPS].every((m) => mapDigest(m.now) === mapDigest(m.base));
const P = (row, col) => ({ row, col });
const keyOf = (cell) => `${cell.row},${cell.col}`;
const ALL_CELLS = Array.from({ length: 81 }, (_, i) => P(Math.floor(i / 9), i % 9));

/** One tree's verdict for a snapshot. `build(map)` gets that tree's own map, so each side reads only its own objects. */
const inspectOn = (rota, map, build) => rota.api.inspectDynamicMazeState(build(map));
/** A map variant on a tree: same objects, other walls and/or chest. Walls are made in that tree's realm. */
const variant = (rota, map, { walls, chest } = {}) => ({
  ...map,
  ...(walls ? { walls: new rota.sandbox.Set(walls) } : {}),
  ...(chest !== undefined ? { chest } : {}),
});

/**
 * The cells a hand-built case needs, chosen from the map itself: a free walkable cell reachable from the start that is
 * none of the special cells, a wall that touches the reachable board (so standing on it still reaches everything), a
 * second free cell, and the post the real Sentinel takes.
 */
/** Every cell reachable from `from` on `walls` (the test's own BFS — a corpus builder, not the contract). */
function reachFrom(from, walls) {
  const reach = new Set([keyOf(from)]);
  const queue = [from];
  for (let i = 0; i < queue.length; i += 1) {
    for (const next of walkableNeighbours(queue[i], walls)) {
      if (!reach.has(keyOf(next))) {
        reach.add(keyOf(next));
        queue.push(next);
      }
    }
  }
  return reach;
}
function cellsFor(rota, map) {
  const reach = reachFrom(map.playerStart, map.walls);
  const special = new Set([
    map.playerStart, map.guardianStart, map.exitPosition, ...(map.chest ? [map.chest] : []), ...map.collectibleStars, ...map.traps,
  ].map(keyOf));
  const post = rota.api.createSentinelState(map, rota.api.computePortalDefenceZone(map.playerStart, map.exitPosition, map.walls)).position;
  const free = ALL_CELLS.filter((c) => reach.has(keyOf(c)) && !special.has(keyOf(c)) && keyOf(c) !== keyOf(post));
  // The real post when it is a plain cell; otherwise (a post on a light, trap or Chest would add codes the case does not
  // name) the last free cell, which no other role takes.
  const sentinelPost = special.has(keyOf(post)) ? free.at(-1) : { ...post };
  const wall = [...map.walls].sort().map((k) => P(...k.split(",").map(Number))).find((w) => walkableNeighbours(w, new Set()).some((n) => reach.has(keyOf(n))));
  return { reach, special, sentinelPost, free: free.filter((c) => keyOf(c) !== keyOf(sentinelPost)), wall };
}

/**
 * A sealed objective: the walkable cells around it become walls. None of them may be a piece or another objective, and
 * every other objective must still be reachable from the start — so the target, and only the target, is cut off.
 */
function sealable(map, cells, target) {
  const around = walkableNeighbours(target, map.walls);
  const objectives = [...map.collectibleStars, map.exitPosition, ...(map.chest ? [map.chest] : [])];
  const protectedKeys = new Set([map.playerStart, map.guardianStart, cells.sentinelPost, ...objectives].map(keyOf));
  protectedKeys.delete(keyOf(target));
  if (around.length === 0 || around.some((c) => protectedKeys.has(keyOf(c)))) return null;
  const walls = [...map.walls, ...around.map(keyOf)];
  const reach = reachFrom(map.playerStart, new Set(walls));
  const others = objectives.filter((o) => keyOf(o) !== keyOf(target));
  return others.every((o) => reach.has(keyOf(o))) && !reach.has(keyOf(target)) ? walls : null;
}

/**
 * The hand-built adversarial corpus for one map: every case is a snapshot builder (given that tree's map) and the
 * whole issue sequence the contract must produce, plus the unreachable objectives where they matter.
 */
function handCases(m) {
  const map = m.now;
  const c = cellsFor(NOW, map);
  const E = map.exitPosition;
  const C = map.chest;
  const ST = map.collectibleStars;
  const TR = map.traps;
  const W = c.wall;
  const F1 = c.free[0];
  const F2 = c.free[1];
  const S0 = c.sentinelPost;
  const OOB = [P(-1, 0), P(9, 4), P(4, 9), P(0, -1), P(1.5, 2), P(Number.NaN, 3)];
  const base = (overrides = {}) => (mm) => ({
    mazeMap: mm,
    player: { ...mm.playerStart },
    guardian: { ...mm.guardianStart },
    sentinel: { ...S0 },
    collectedStars: [],
    triggeredTraps: [],
    chestOpened: false,
    rewardSelected: null,
    rewardSpent: false,
    brokenWall: null,
    status: "playing",
    ...overrides,
  });
  const onMap = (variantOf, overrides) => (mm) => base(overrides)(variantOf(mm));
  const cases = [];
  const add = (name, build, issues, extra = {}) => cases.push({ name, build, issues, ...extra });

  add("valid-start", base(), []);
  for (const status of STATUSES) add(`valid-start-${status}`, base({ status }), []);
  OOB.forEach((cell, i) => {
    add(`player-out-of-board-${i}`, base({ player: cell }), ["PLAYER_OUT_OF_BOUNDS", "UNREACHABLE_OBJECTIVE"], {
      unreachable: [...ST.map(keyOf), keyOf(E), keyOf(C)],
    });
    add(`hunter-out-of-board-${i}`, base({ guardian: cell }), ["HUNTER_OUT_OF_BOUNDS"]);
    add(`sentinel-out-of-board-${i}`, base({ sentinel: cell }), ["SENTINEL_OUT_OF_BOUNDS"]);
  });
  add("player-on-wall", base({ player: W }), ["PLAYER_ON_WALL"]);
  add("hunter-on-wall", base({ guardian: W }), ["HUNTER_ON_WALL"]);
  add("sentinel-on-wall", base({ sentinel: W }), ["SENTINEL_ON_WALL"]);
  add("all-three-on-one-wall", base({ player: W, guardian: W, sentinel: W }), ["PLAYER_ON_WALL", "HUNTER_ON_WALL", "SENTINEL_ON_WALL", "DEFENDER_CO_OCCUPANCY", "PLAYER_DEFENDER_CO_OCCUPANCY"]);
  add("each-mobile-out-or-on-wall", base({ player: P(-1, 0), guardian: W, sentinel: P(9, 9) }), ["PLAYER_OUT_OF_BOUNDS", "HUNTER_ON_WALL", "SENTINEL_OUT_OF_BOUNDS", "UNREACHABLE_OBJECTIVE"]);
  add("defenders-together", base({ guardian: S0 }), ["DEFENDER_CO_OCCUPANCY"]);
  for (const status of STATUSES) {
    const flagged = status === "playing" ? ["PLAYER_DEFENDER_CO_OCCUPANCY"] : [];
    add(`player-on-hunter-${status}`, base({ player: { ...map.guardianStart }, status }), flagged);
    add(`player-on-sentinel-${status}`, base({ player: S0, status }), flagged);
    add(`player-on-both-${status}`, base({ player: F1, guardian: F1, sentinel: F1, status }), ["DEFENDER_CO_OCCUPANCY", ...flagged]);
  }
  add("hunter-on-portal", base({ guardian: E }), ["HUNTER_ON_PORTAL"]);
  add("sentinel-on-portal", base({ sentinel: E }), ["SENTINEL_ON_PORTAL"]);
  add("both-on-portal-won", base({ guardian: E, sentinel: E, status: "won" }), ["DEFENDER_CO_OCCUPANCY", "HUNTER_ON_PORTAL", "SENTINEL_ON_PORTAL"]);
  add("player-on-portal", base({ player: E }), []);
  add("known-lights-collected", base({ collectedStars: ST.map(keyOf) }), []);
  add("unknown-lights", base({ collectedStars: [keyOf(ST[0]), keyOf(F1), "junk", keyOf(F1)] }), ["UNKNOWN_COLLECTED_LIGHT", "UNKNOWN_COLLECTED_LIGHT"], {
    unreachable: [],
  });
  add("unknown-light-as-set", (mm) => base({ collectedStars: new NOW.sandbox.Set([keyOf(F2)]) })(mm), ["UNKNOWN_COLLECTED_LIGHT"]);
  add("known-traps-armed", base({ triggeredTraps: TR.map(keyOf) }), []);
  add("unknown-armed-trap", base({ triggeredTraps: [keyOf(TR[0]), keyOf(F1), "9,9"] }), ["UNKNOWN_ARMED_TRAP", "UNKNOWN_ARMED_TRAP"]);
  add("hunter-on-armed-trap", base({ guardian: TR[0], triggeredTraps: [keyOf(TR[0])] }), ["HUNTER_ON_ARMED_TRAP"]);
  add("sentinel-on-armed-trap", base({ sentinel: TR[0], triggeredTraps: [keyOf(TR[0])] }), ["SENTINEL_ON_ARMED_TRAP"]);
  add("hunter-on-dormant-trap", base({ guardian: TR[0] }), []);
  add("both-on-armed-traps", base({ guardian: TR[0], sentinel: TR[1], triggeredTraps: [keyOf(TR[0]), keyOf(TR[1])] }), ["HUNTER_ON_ARMED_TRAP", "SENTINEL_ON_ARMED_TRAP"]);
  add("hunter-on-unknown-armed-key", base({ guardian: F1, triggeredTraps: [keyOf(F1)] }), ["UNKNOWN_ARMED_TRAP", "HUNTER_ON_ARMED_TRAP"]);
  // The Chest, the reward and the Pickaxe — every combination of the four raw fields that the contract reads.
  for (const reward of ["pickaxe", "second-chance"]) {
    add(`closed-chest-${reward}-selected`, base({ rewardSelected: reward }), ["REWARD_BEFORE_CHEST", "SELECTED_REWARD_WITH_CLOSED_CHEST"]);
    add(`closed-chest-${reward}-spent`, base({ rewardSelected: reward, rewardSpent: true }), [
      "REWARD_BEFORE_CHEST", "REWARD_SPENT_BEFORE_CHEST", "SELECTED_REWARD_WITH_CLOSED_CHEST",
      ...(reward === "pickaxe" ? ["SPENT_PICKAXE_WITHOUT_OPEN_WALL"] : []),
    ]);
  }
  add("closed-chest-spent-nothing", base({ rewardSpent: true }), ["REWARD_SPENT_BEFORE_CHEST", "SPENT_REWARD_WITHOUT_SELECTION"]);
  add("closed-chest-wall-broken", base({ brokenWall: keyOf(W) }), ["WALL_BROKEN_BEFORE_CHEST", "OPEN_WALL_WITHOUT_SPENT_PICKAXE"]);
  add("player-on-closed-chest", base({ player: C }), ["PLAYER_ON_UNOPENED_CHEST"]);
  add("closed-chest-pickaxe-spent-wall-player-on-chest", base({ player: C, rewardSelected: "pickaxe", rewardSpent: true, brokenWall: keyOf(W) }), [
    "REWARD_BEFORE_CHEST", "REWARD_SPENT_BEFORE_CHEST", "WALL_BROKEN_BEFORE_CHEST", "PLAYER_ON_UNOPENED_CHEST", "SELECTED_REWARD_WITH_CLOSED_CHEST",
  ]);
  add("open-chest-pending-on-chest", base({ player: C, chestOpened: true }), []);
  add("open-chest-pending-away", base({ chestOpened: true }), ["PENDING_REWARD_AWAY_FROM_CHEST"]);
  add("open-chest-pending-spent-on-chest", base({ player: C, chestOpened: true, rewardSpent: true }), ["PENDING_REWARD_ALREADY_SPENT", "SPENT_REWARD_WITHOUT_SELECTION"]);
  add("open-chest-pending-spent-away", base({ chestOpened: true, rewardSpent: true }), ["PENDING_REWARD_ALREADY_SPENT", "PENDING_REWARD_AWAY_FROM_CHEST", "SPENT_REWARD_WITHOUT_SELECTION"]);
  add("open-chest-pending-wall-away", base({ chestOpened: true, brokenWall: keyOf(W) }), ["PENDING_REWARD_AWAY_FROM_CHEST", "OPEN_WALL_WITHOUT_SPENT_PICKAXE"]);
  add("pickaxe-held", base({ chestOpened: true, rewardSelected: "pickaxe" }), []);
  add("pickaxe-spent-no-wall", base({ chestOpened: true, rewardSelected: "pickaxe", rewardSpent: true }), ["SPENT_PICKAXE_WITHOUT_OPEN_WALL"]);
  add("pickaxe-spent-wall-open", base({ chestOpened: true, rewardSelected: "pickaxe", rewardSpent: true, brokenWall: keyOf(W) }), []);
  add("pickaxe-held-wall-open", base({ chestOpened: true, rewardSelected: "pickaxe", brokenWall: keyOf(W) }), ["OPEN_WALL_WITHOUT_SPENT_PICKAXE"]);
  add("second-chance-spent-wall-open", base({ chestOpened: true, rewardSelected: "second-chance", rewardSpent: true, brokenWall: keyOf(W) }), ["OPEN_WALL_WITHOUT_SPENT_PICKAXE"]);
  add("second-chance-held-wall-open", base({ chestOpened: true, rewardSelected: "second-chance", brokenWall: keyOf(W) }), ["OPEN_WALL_WITHOUT_SPENT_PICKAXE"]);
  add("second-chance-held", base({ chestOpened: true, rewardSelected: "second-chance" }), []);
  add("second-chance-spent", base({ chestOpened: true, rewardSelected: "second-chance", rewardSpent: true }), []);
  // The opened wall is open for everyone: standing on it is no longer standing on a wall.
  add("everyone-on-the-opened-wall", base({ player: W, guardian: W, chestOpened: true, rewardSelected: "pickaxe", rewardSpent: true, brokenWall: keyOf(W), status: "lost" }), []);
  add("hunter-on-the-opened-wall", base({ guardian: W, chestOpened: true, rewardSelected: "pickaxe", rewardSpent: true, brokenWall: keyOf(W) }), []);
  // A broken wall that is not a wall of the map: flagged, and nothing is opened.
  for (const [i, key] of [keyOf(F1), "junk", "-1,0", keyOf(E)].entries()) {
    add(`broken-wall-not-in-map-${i}`, base({ chestOpened: true, rewardSelected: "pickaxe", rewardSpent: true, brokenWall: key }), ["BROKEN_WALL_NOT_IN_BASE_MAP"], {
      wallsUnchanged: true,
    });
  }
  // A map without a Chest: no chest objective, no chest position to be on or away from.
  const chestless = (mm) => variant(mm === m.now ? NOW : BASE, mm, { chest: null });
  add("chestless-closed", onMap(chestless, {}), []);
  add("chestless-opened-pending-anywhere", onMap(chestless, { chestOpened: true }), []);
  add("chestless-closed-player-on-old-chest", onMap(chestless, { player: C }), []);
  add("chestless-player-sealed", onMap((mm) => variant(mm === m.now ? NOW : BASE, mm, { chest: null, walls: ALL_CELLS.map(keyOf).filter((k) => k !== keyOf(mm.playerStart)) }), {}), [
    "HUNTER_ON_WALL", "SENTINEL_ON_WALL", "UNREACHABLE_OBJECTIVE",
  ], { unreachable: [...ST.map(keyOf), keyOf(E)] });
  // Topology: everything sealed off — the objectives are listed lights (uncollected, map order), portal, Chest (closed).
  const sealedAll = (mm) => variant(mm === m.now ? NOW : BASE, mm, { walls: ALL_CELLS.map(keyOf).filter((k) => k !== keyOf(mm.playerStart)) });
  add("player-sealed", onMap(sealedAll, {}), ["HUNTER_ON_WALL", "SENTINEL_ON_WALL", "UNREACHABLE_OBJECTIVE"], {
    unreachable: [...ST.map(keyOf), keyOf(E), keyOf(C)],
  });
  add("player-sealed-light-collected-chest-open", onMap(sealedAll, { collectedStars: [keyOf(ST[0])], chestOpened: true, rewardSelected: "second-chance" }), [
    "HUNTER_ON_WALL", "SENTINEL_ON_WALL", "UNREACHABLE_OBJECTIVE",
  ], { unreachable: [...ST.slice(1).map(keyOf), keyOf(E)] });
  // Mobile defenders are threats, not walls: the Explorer boxed in by both of them is still topologically solvable.
  const exits = walkableNeighbours(map.playerStart, map.walls);
  if (exits.length === 2) add("explorer-boxed-in-by-defenders", base({ guardian: exits[0], sentinel: exits[1] }), [], { unreachable: [] });
  // One objective sealed by walls: only it is unreachable, and only while it is still an objective.
  const sealedTargets = [
    ...ST.map((s, i) => ({ what: `light-${i}`, target: s, done: { collectedStars: [keyOf(s)] } })),
    { what: "portal", target: E, done: null },
    { what: "chest", target: C, done: { chestOpened: true, rewardSelected: "second-chance" } },
  ];
  let sealedKinds = 0;
  for (const { what, target, done } of sealedTargets) {
    const walls = sealable(map, c, target);
    if (!walls) continue;
    sealedKinds += 1;
    const sealed = (mm) => variant(mm === m.now ? NOW : BASE, mm, { walls });
    add(`sealed-${what}`, onMap(sealed, {}), ["UNREACHABLE_OBJECTIVE"], { unreachable: [keyOf(target)] });
    if (done) add(`sealed-${what}-finished`, onMap(sealed, done), [], { unreachable: [] });
  }
  // Everything at once: the full sequence, in contract order.
  add("kitchen-sink", base({
    player: P(-1, 0), guardian: W, sentinel: W, collectedStars: ["x"], triggeredTraps: ["y"], rewardSelected: "pickaxe", rewardSpent: true, brokenWall: "z",
  }), [
    "BROKEN_WALL_NOT_IN_BASE_MAP", "PLAYER_OUT_OF_BOUNDS", "HUNTER_ON_WALL", "SENTINEL_ON_WALL", "DEFENDER_CO_OCCUPANCY",
    "UNKNOWN_COLLECTED_LIGHT", "UNKNOWN_ARMED_TRAP", "REWARD_BEFORE_CHEST", "REWARD_SPENT_BEFORE_CHEST", "WALL_BROKEN_BEFORE_CHEST",
    "SELECTED_REWARD_WITH_CLOSED_CHEST", "UNREACHABLE_OBJECTIVE",
  ]);
  add("kitchen-sink-armed", base({
    player: E, guardian: E, sentinel: TR[0], collectedStars: [keyOf(F1)], triggeredTraps: [keyOf(TR[0]), keyOf(E)], chestOpened: true, rewardSpent: true, brokenWall: keyOf(W),
  }), [
    "PLAYER_DEFENDER_CO_OCCUPANCY", "HUNTER_ON_PORTAL", "UNKNOWN_COLLECTED_LIGHT", "UNKNOWN_ARMED_TRAP", "HUNTER_ON_ARMED_TRAP", "SENTINEL_ON_ARMED_TRAP",
    "PENDING_REWARD_ALREADY_SPENT", "PENDING_REWARD_AWAY_FROM_CHEST", "SPENT_REWARD_WITHOUT_SELECTION", "OPEN_WALL_WITHOUT_SPENT_PICKAXE",
  ]);
  return { cases, cells: { W: keyOf(W), F1: keyOf(F1), S0: keyOf(S0) }, sealedKinds, boxedIn: exits.length === 2 };
}

// E1 — the hand-built adversarial corpus, on one map of every stage and mode: every case gives, on both trees, exactly
// the written issue SEQUENCE (not a set: order and repeats), the written unreachable objectives where given, and the
// same whole verdict (valid, topologicallySolvable, solvable, effective walls in order, unreachable objectives); every
// one of the 26 codes is produced by some case, and multi-issue cases are compared whole.
guarded("E1", "equivalence", "ADVERSARIAL_CORPUS_EVERY_ISSUE_CODE_IDENTICAL", () => {
  const failures = [];
  const produced = {};
  let cases = 0;
  let multi = 0;
  const digest = crypto.createHash("sha256");
  const picked = STAGES.flatMap((stage) => DIFFICULTIES.map((difficulty) => MAPS.find((m) => m.stage === stage && m.difficulty === difficulty)));
  const meta = [];
  for (const m of picked) {
    const { cases: list, cells, sealedKinds, boxedIn } = handCases(m);
    meta.push({ seed: m.seed, stage: m.stage, mode: m.difficulty, cases: list.length, cells, sealedKinds, boxedIn });
    for (const item of list) {
      const a = canonical(inspectOn(NOW, m.now, item.build));
      const b = canonical(inspectOn(BASE, m.base, item.build));
      cases += 1;
      if (item.issues.length > 1) multi += 1;
      for (const code of a.issues) tally(produced, code);
      digest.update(JSON.stringify([item.name, a]));
      const expectedValid = item.issues.length === 0;
      const expectedTopo = !item.issues.includes("UNREACHABLE_OBJECTIVE");
      const ok =
        same(a, b) && same(a.issues, item.issues) && a.valid === expectedValid && a.topologicallySolvable === expectedTopo &&
        a.solvable === (expectedValid && expectedTopo) && (item.unreachable === undefined || same(a.unreachableObjectives, item.unreachable)) &&
        (!item.wallsUnchanged || same(a.effectiveWalls, [...m.now.walls])) && inContractOrder(a.issues) && a.effectiveWallsIsSet;
      if (!ok) failures.push({ seed: m.seed, case: item.name, expected: item.issues, now: a.issues, base: b.issues, unreachable: [item.unreachable, a.unreachableObjectives], sameTrees: same(a, b) });
    }
  }
  const missing = ISSUE_CODES.filter((code) => !produced[code]);
  record(
    "E1",
    "equivalence",
    "ADVERSARIAL_CORPUS_EVERY_ISSUE_CODE_IDENTICAL",
    mapsAgree && failures.length === 0 && missing.length === 0 && meta.every((x) => x.sealedKinds > 0),
    {
      maps: meta.map(({ seed, stage, mode, cases: n, sealedKinds, boxedIn }) => `${stage}/${mode}#${seed}:${n} cases, ${sealedKinds} sealable, boxedIn=${boxedIn}`),
      casesCompared: cases,
      multiIssueCases: multi,
      codesProduced: `${ISSUE_CODES.length - missing.length}/${ISSUE_CODES.length}`,
      missing,
      producedCounts: produced,
      failures: failures.slice(0, 6),
      digest: digest.digest("hex").slice(0, 16),
    },
  );
});

// E2 — random states over generated maps, both trees given the same snapshot: positions anywhere (walkable, wall, out
// of the board, portal, Chest, lights, traps, each other), known and unknown lights and traps, any Chest/reward/spent
// combination, broken walls real or not, every status, base or sealed walls, arrays, Sets and one-shot iterables. The
// whole verdict must agree; every code must be reached and every issue list must be in contract order.
guarded("E2", "equivalence", "RANDOM_STATES_IDENTICAL_IN_CONTRACT_ORDER", () => {
  const diffs = [];
  const produced = {};
  const shapes = {};
  const outOfOrder = [];
  let states = 0;
  const digest = crypto.createHash("sha256");
  for (const m of MAPS) {
    const rand = prng(m.seed ^ 0x5bd1e995);
    const map = m.now;
    const walkable = ALL_CELLS.filter((c) => !map.walls.has(keyOf(c)));
    const wallCells = [...map.walls].map((k) => P(...k.split(",").map(Number)));
    const oob = [P(-1, 0), P(9, 0), P(0, 9), P(4, -1), P(0.5, 1), P(9, 9)];
    const cellOf = (others) => {
      const kind = pick(rand, ["walkable", "walkable", "walkable", "wall", "out", "portal", "chest", "light", "trap", "other"]);
      tally(shapes, `cell:${kind}`);
      if (kind === "wall") return pick(rand, wallCells);
      if (kind === "out") return pick(rand, oob);
      if (kind === "portal") return map.exitPosition;
      if (kind === "chest") return map.chest ?? pick(rand, walkable);
      if (kind === "light") return pick(rand, map.collectibleStars);
      if (kind === "trap") return pick(rand, map.traps);
      if (kind === "other" && others.length) return pick(rand, others);
      return pick(rand, walkable);
    };
    for (let k = 0; k < 140; k += 1) {
      const player = cellOf([]);
      const guardian = cellOf([player]);
      const sentinel = cellOf([player, guardian]);
      const lights = map.collectibleStars.filter(() => rand() < 0.4).map(keyOf);
      if (rand() < 0.12) lights.push(keyOf(pick(rand, walkable)));
      if (rand() < 0.05) lights.push("??");
      const traps = map.traps.filter(() => rand() < 0.35).map(keyOf);
      if (rand() < 0.1) traps.push(keyOf(pick(rand, [guardian, sentinel, ...walkable])));
      const chestOpened = rand() < 0.5;
      const rewardSelected = pick(rand, [null, null, "pickaxe", "second-chance"]);
      const rewardSpent = rand() < 0.35;
      const brokenKind = pick(rand, ["none", "none", "none", "wall", "wall", "walkable", "junk"]);
      tally(shapes, `broken:${brokenKind}`);
      const brokenWall = brokenKind === "none" ? null : brokenKind === "wall" ? keyOf(pick(rand, wallCells)) : brokenKind === "walkable" ? keyOf(pick(rand, walkable)) : "x,y";
      const status = pick(rand, STATUSES);
      const wallsKind = pick(rand, ["base", "base", "base", "base", "sealed"]);
      tally(shapes, `walls:${wallsKind}`);
      const sealedTarget = pick(rand, [...map.collectibleStars, map.exitPosition, ...(map.chest ? [map.chest] : [])]);
      const extraWalls = wallsKind === "sealed" ? walkableNeighbours(sealedTarget, map.walls).map(keyOf) : [];
      const iterKind = pick(rand, ["array", "set", "generator"]);
      tally(shapes, `iterable:${iterKind}`);
      const chestless = rand() < 0.08;
      if (chestless) tally(shapes, "chestless");
      const build = (rota, mm) => {
        const iter = (keys) => (iterKind === "set" ? new rota.sandbox.Set(keys) : iterKind === "generator" ? (function* () { yield* keys; })() : [...keys]);
        const board = wallsKind === "sealed" || chestless ? variant(rota, mm, { ...(wallsKind === "sealed" ? { walls: [...mm.walls, ...extraWalls] } : {}), ...(chestless ? { chest: null } : {}) }) : mm;
        return {
          mazeMap: board, player: { ...player }, guardian: { ...guardian }, sentinel: { ...sentinel }, collectedStars: iter(lights), triggeredTraps: iter(traps),
          chestOpened, rewardSelected, rewardSpent, brokenWall, status,
        };
      };
      const a = canonical(NOW.api.inspectDynamicMazeState(build(NOW, m.now)));
      const b = canonical(BASE.api.inspectDynamicMazeState(build(BASE, m.base)));
      states += 1;
      digest.update(JSON.stringify(a));
      for (const code of a.issues) tally(produced, code);
      tally(shapes, a.valid ? "valid" : "invalid");
      tally(shapes, a.topologicallySolvable ? "topologicallySolvable" : "topologicallyUnsolvable");
      if (a.solvable) tally(shapes, "solvable");
      if (a.issues.length > 1) tally(shapes, "multiIssue");
      if (!inContractOrder(a.issues) && outOfOrder.length < 5) outOfOrder.push({ seed: m.seed, k, issues: a.issues });
      if (!same(a, b) && diffs.length < 5) diffs.push({ seed: m.seed, k, now: a.issues, base: b.issues });
    }
  }
  const missing = ISSUE_CODES.filter((code) => !produced[code]);
  record(
    "E2",
    "equivalence",
    "RANDOM_STATES_IDENTICAL_IN_CONTRACT_ORDER",
    mapsAgree && diffs.length === 0 && outOfOrder.length === 0 && missing.length === 0 && shapes.valid > 0 && shapes.topologicallyUnsolvable > 0 && shapes.solvable > 0,
    { maps: MAPS.length, statesCompared: states, codesReached: `${ISSUE_CODES.length - missing.length}/${ISSUE_CODES.length}`, missing, shapes, outOfOrder, diffs, digest: digest.digest("hex").slice(0, 16) },
  );
});

// E3 — effective walls: with nothing broken they are the map's walls, in the same order, as a NEW set; with any wall of
// the map broken they are the map's walls minus that one, order kept — for every wall of every map; with a broken key
// that is no wall of the map nothing is opened. Both trees agree, and `mazeMap.walls` is never touched (same object,
// same content, same order) — not even when the caller then mutates the set it got back.
guarded("E3", "equivalence", "EFFECTIVE_WALLS_IDENTICAL_AND_NEW", () => {
  const diffs = [];
  let opened = 0;
  let untouched = true;
  let sharedWithMap = 0;
  for (const m of WALL_MAPS) {
    const before = [...m.now.walls];
    const baseBefore = [...m.base.walls];
    const snap = (mm, brokenWall) => ({
      mazeMap: mm, player: { ...mm.playerStart }, guardian: { ...mm.guardianStart }, sentinel: { ...mm.guardianStart }, collectedStars: [], triggeredTraps: [],
      chestOpened: true, rewardSelected: "pickaxe", rewardSpent: brokenWall !== null, brokenWall, status: "playing",
    });
    const check = (brokenWall, expected) => {
      const outNow = NOW.api.inspectDynamicMazeState(snap(m.now, brokenWall));
      const outBase = BASE.api.inspectDynamicMazeState(snap(m.base, brokenWall));
      if (outNow.effectiveWalls === m.now.walls || outBase.effectiveWalls === m.base.walls) sharedWithMap += 1;
      const a = [...outNow.effectiveWalls];
      if (!same(a, [...outBase.effectiveWalls]) || !same(a, expected)) diffs.push({ seed: m.seed, brokenWall, now: a.length, expected: expected.length });
      // The verdict's set is the caller's: mutating it changes nothing of the map's.
      outNow.effectiveWalls.add("mutated");
      outNow.effectiveWalls.clear();
    };
    check(null, before);
    for (const wall of before) {
      check(wall, before.filter((k) => k !== wall));
      opened += 1;
    }
    for (const key of ["junk", keyOf(m.now.playerStart), keyOf(m.now.exitPosition), "9,9", "-1,-1"]) check(key, before);
    if (!same([...m.now.walls], before) || !same([...m.base.walls], baseBefore)) untouched = false;
  }
  record("E3", "equivalence", "EFFECTIVE_WALLS_IDENTICAL_AND_NEW", mapsAgree && diffs.length === 0 && untouched && sharedWithMap === 0 && opened > 900, {
    maps: WALL_MAPS.length,
    wallsOpened: opened,
    mapWallsUntouched: untouched,
    verdictsSharingTheMapSet: sharedWithMap,
    diffs: diffs.slice(0, 5),
  });
});

// E4 — mutation safety, both trees: the map (walls, lights, traps, Chest, portal, starts) and the snapshot's positions
// and key lists are deeply equal before and after, and frozen inputs are accepted (nothing is written to them); each
// key iterable is read exactly once (a counting iterable sees one iterator per call; a one-shot generator gives the
// same verdict as an array); two calls on the same snapshot give equal verdicts that share no array or set.
guarded("E4", "equivalence", "INSPECTION_MUTATES_NOTHING_AND_READS_ONCE", () => {
  const violations = [];
  let calls = 0;
  const deepFreeze = (value) => {
    if (value && typeof value === "object" && !(value instanceof Set) && value.constructor?.name !== "Set") {
      Object.values(value).forEach(deepFreeze);
      Object.freeze(value);
    }
    return value;
  };
  for (const m of MAPS.filter((_, i) => i % 3 === 0)) {
    for (const [rota, map] of [[NOW, m.now], [BASE, m.base]]) {
      const { cases } = handCases({ ...m, now: map });
      for (const item of cases) {
        const snapshot = item.build(map);
        const mapBefore = JSON.stringify([[...snapshot.mazeMap.walls], snapshot.mazeMap.collectibleStars, snapshot.mazeMap.traps, snapshot.mazeMap.chest, snapshot.mazeMap.exitPosition, snapshot.mazeMap.playerStart, snapshot.mazeMap.guardianStart, snapshot.mazeMap.grid]);
        const wallsObject = snapshot.mazeMap.walls;
        const listOf = (v) => [...v];
        const lights = listOf(snapshot.collectedStars);
        const traps = listOf(snapshot.triggeredTraps);
        const positionsBefore = JSON.stringify([snapshot.player, snapshot.guardian, snapshot.sentinel]);
        // Frozen copies of everything freezable: a write would throw in the module's strict code.
        const frozen = {
          ...snapshot,
          // Copies, so freezing never reaches the shared tables a map points into (PLAYER_START is route-config's own).
          mazeMap: deepFreeze({
            ...snapshot.mazeMap,
            grid: snapshot.mazeMap.grid.map((row) => [...row]),
            playerStart: { ...snapshot.mazeMap.playerStart },
            guardianStart: { ...snapshot.mazeMap.guardianStart },
            exitPosition: { ...snapshot.mazeMap.exitPosition },
            collectibleStars: snapshot.mazeMap.collectibleStars.map((c) => ({ ...c })),
            traps: snapshot.mazeMap.traps.map((c) => ({ ...c })),
            chest: snapshot.mazeMap.chest && { ...snapshot.mazeMap.chest },
          }),
          player: deepFreeze({ ...snapshot.player }),
          guardian: deepFreeze({ ...snapshot.guardian }),
          sentinel: deepFreeze({ ...snapshot.sentinel }),
          collectedStars: deepFreeze([...lights]),
          triggeredTraps: deepFreeze([...traps]),
        };
        // The snapshot itself first, as the hook hands it over (arrays, or a Set where the case built one).
        const direct = canonical(rota.api.inspectDynamicMazeState(snapshot));
        const thrown = errorOf(() => rota.api.inspectDynamicMazeState(frozen));
        const counting = (keys) => {
          const box = { reads: 0, [Symbol.iterator]() { box.reads += 1; return keys[Symbol.iterator](); } };
          return box;
        };
        const lightsIter = counting(lights);
        const trapsIter = counting(traps);
        const viaCounting = canonical(rota.api.inspectDynamicMazeState({ ...snapshot, collectedStars: lightsIter, triggeredTraps: trapsIter }));
        const viaGenerator = canonical(rota.api.inspectDynamicMazeState({ ...snapshot, collectedStars: (function* () { yield* lights; })(), triggeredTraps: (function* () { yield* traps; })() }));
        const once = rota.api.inspectDynamicMazeState({ ...snapshot, collectedStars: [...lights], triggeredTraps: [...traps] });
        const twice = rota.api.inspectDynamicMazeState({ ...snapshot, collectedStars: [...lights], triggeredTraps: [...traps] });
        calls += 6;
        const mapAfter = JSON.stringify([[...snapshot.mazeMap.walls], snapshot.mazeMap.collectibleStars, snapshot.mazeMap.traps, snapshot.mazeMap.chest, snapshot.mazeMap.exitPosition, snapshot.mazeMap.playerStart, snapshot.mazeMap.guardianStart, snapshot.mazeMap.grid]);
        const problems = [
          thrown && `frozen input threw: ${thrown}`,
          mapAfter !== mapBefore && "map changed",
          snapshot.mazeMap.walls !== wallsObject && "walls object replaced",
          JSON.stringify([snapshot.player, snapshot.guardian, snapshot.sentinel]) !== positionsBefore && "positions changed",
          (lightsIter.reads !== 1 || trapsIter.reads !== 1) && `iterables read ${lightsIter.reads}/${trapsIter.reads} times`,
          !same(direct, canonical(once)) && "direct verdict differs",
          !same(viaCounting, canonical(once)) && "counting iterable verdict differs",
          !same(viaGenerator, canonical(once)) && "one-shot generator verdict differs",
          !same(canonical(once), canonical(twice)) && "second call differs",
          (once.effectiveWalls === twice.effectiveWalls || once.issues === twice.issues || once.unreachableObjectives === twice.unreachableObjectives) && "calls share state",
          !same(listOf(snapshot.collectedStars), lights) && "light list consumed",
          !same(listOf(snapshot.triggeredTraps), traps) && "trap list consumed",
        ].filter(Boolean);
        if (problems.length && violations.length < 6) violations.push({ seed: m.seed, tree: rota === NOW ? "now" : "base", case: item.name, problems });
      }
    }
  }
  record("E4", "equivalence", "INSPECTION_MUTATES_NOTHING_AND_READS_ONCE", violations.length === 0 && calls > 1000, { calls, violations });
});

// =================================================================================================
// [equivalence] — the real hook
// =================================================================================================

/** The hook's verdict, canonical, plus the state it was computed from (so a diff names the moment). */
const snapshotOf = (g) => ({
  status: g.status,
  route: [g.routeNumber, g.difficulty],
  player: cellKey(g.player),
  hunter: cellKey(g.guardian),
  sentinel: cellKey(g.sentinel),
  turns: g.turns,
  lights: [...g.collectedSet],
  traps: [...g.triggeredTrapSet],
  chest: [g.chestOpened, g.rewardSelected, g.rewardSpent, g.brokenWall],
  message: g.message,
  dynamicSolvability: canonical(g.dynamicSolvability),
});

/**
 * One action of a scripted Explorer (the C3 policies). `win` (lights then portal, around the Hunter's reach, Second
 * Chance), `lose` (straight at the Hunter, Pickaxe), `pickaxe` (Chest, Pickaxe, break, then win), `traps` (cross every
 * trap, then win), `sc-hunter` / `sc-sentinel` (Chest, Second Chance, then straight at that defender), `sc-portal`
 * (Chest, Second Chance, lights and portal around the defenders' cells), `sc-bait` (Chest, Second Chance, then onto the
 * cell the Sentinel's own policy would step into), `chest-wait` (walk to the Chest and, once, try to move while the
 * choice is pending — the frozen turn — before choosing the Pickaxe and playing to win).
 */
function nextAction(g, policy, api, memo) {
  if (g.rewardChoicePending) {
    if (policy === "chest-wait" && !memo.waited) {
      memo.waited = true;
      return ["step", walkableNeighbours(g.player, g.walls)[0] ?? g.player];
    }
    return ["choose", ["win", "traps", "sc-hunter", "sc-sentinel", "sc-portal", "sc-bait"].includes(policy) ? "second-chance" : "pickaxe"];
  }
  if ((policy === "pickaxe" || policy === "chest-wait") && g.breakTargets.length > 0) return ["break", g.breakTargets[0].cell];
  let best = null;
  const towardChest = (policy === "pickaxe" || policy === "chest-wait" || policy.startsWith("sc-")) && !g.chestOpened && g.chestPosition;
  if (towardChest) best = pathBetween(g.player, g.chestPosition, g.walls);
  else if (policy === "sc-bait" && g.secondChanceAvailable) {
    const free = walkableNeighbours(g.player, g.walls).filter((c) => cellKey(c) !== cellKey(g.guardian) && cellKey(c) !== cellKey(g.sentinel));
    const held = { position: g.sentinel, target: g.sentinelTarget, commitLeft: g.sentinelCommitLeft };
    const bait = free.find((c) => cellKey(api.decideSentinelMove(held, c, g.mazeMap.exitPosition, g.walls, g.portalDefenceZone, 3, g.triggeredTrapSet).position) === cellKey(c));
    if (bait) return ["step", bait];
    best = pathBetween(g.player, g.mazeMap.exitPosition, new Set([...g.walls, cellKey(g.sentinel), cellKey(g.guardian)]));
  } else if (policy === "lose" || policy === "sc-hunter") best = pathBetween(g.player, g.guardian, g.walls);
  else if (policy === "sc-sentinel") best = pathBetween(g.player, g.sentinel, g.walls);
  else {
    const unarmed = policy === "traps" ? g.mazeMap.traps.filter((trap) => !g.triggeredTrapSet.has(cellKey(trap))) : [];
    const remaining = g.mazeMap.collectibleStars.filter((star) => !g.collectedSet.has(cellKey(star)));
    const goals = unarmed.length ? unarmed : remaining.length ? remaining : [g.mazeMap.exitPosition];
    const reach = (policy === "sc-portal" ? [g.guardian, g.sentinel] : [g.guardian, g.sentinel, ...walkableNeighbours(g.guardian, g.walls)]).map(cellKey);
    const around = new Set([...g.walls, ...reach]);
    around.delete(cellKey(g.player));
    for (const goal of goals) {
      around.delete(cellKey(goal));
      const route = pathBetween(g.player, goal, around) ?? pathBetween(g.player, goal, g.walls);
      if (route && (!best || route.length < best.length)) best = route;
    }
  }
  if (!best || best.length < 2) return null;
  return ["step", best[1]];
}
const perform = (run, [kind, arg]) => (kind === "choose" ? run.choose(arg) : kind === "break" ? run.break(arg) : run.stepTo(arg));
const POLICIES = ["win", "lose", "pickaxe", "traps", "sc-hunter", "sc-sentinel", "sc-portal", "sc-bait", "chest-wait"];

// E5 — real Routes, played by the real hook on a continuous seeded stream, on both trees: `game.dynamicSolvability` —
// valid, topologicallySolvable, solvable, issues, effective walls (order and content), unreachable objectives — at
// every render, from the setup screen (fresh mount, and the mode change) through every step, Chest pause, reward,
// break, Second Chance, win and loss, a restart and the next Route opened from the continuation. On the tree under
// test, every render's verdict is ALSO recomputed from the very state that render exposes (same snapshot, same
// moment), and its effective walls are the walls the hook plays on.
guarded("E5", "equivalence", "RUNTIME_DYNAMIC_SOLVABILITY_IDENTICAL_STEP_BY_STEP", () => {
  const play = (rev) => {
    const runtime = loadRouteRuntime({ rev });
    const api = runtime.API;
    const out = [];
    const events = {};
    const inconsistent = [];
    const observe = (g, trace) => {
      trace.push(snapshotOf(g));
      const again = canonical(api.inspectDynamicMazeState({
        mazeMap: g.mazeMap, player: g.player, guardian: g.guardian, sentinel: g.sentinel, collectedStars: [...g.collectedSet],
        triggeredTraps: [...g.triggeredTrapSet], chestOpened: g.chestOpened, rewardSelected: g.rewardSelected, rewardSpent: g.rewardSpent,
        brokenWall: g.brokenWall, status: g.status,
      }));
      const verdict = canonical(g.dynamicSolvability);
      if ((!same(again, verdict) || !same(verdict.effectiveWallsSorted, [...g.walls].sort())) && inconsistent.length < 5) {
        inconsistent.push({ route: g.routeNumber, status: g.status, turns: g.turns });
      }
      tally(events, `status:${g.status}`);
      for (const code of verdict.issues) tally(events, `issue:${g.status}:${code}`);
      if (g.status === "playing" && !verdict.solvable) tally(events, "playingNotSolvable");
      if (g.status !== "playing" && (cellKey(g.player) === cellKey(g.guardian) || cellKey(g.player) === cellKey(g.sentinel))) {
        tally(events, verdict.issues.includes("PLAYER_DEFENDER_CO_OCCUPANCY") ? "terminalOverlapFlagged" : "terminalOverlapNotFlagged");
      }
      if (g.rewardChoicePending) tally(events, "chestPause");
      if (g.brokenWall !== null) tally(events, "wallOpen");
      if (g.secondChanceSpent) tally(events, "secondChanceSpent");
      if (g.triggeredTrapSet.size > 0) tally(events, "trapArmed");
    };
    const drive = (run, policy, trace, budget) => {
      const memo = {};
      for (let guard = 0; guard < budget; guard += 1) {
        const g = run.state;
        if (g.status !== "playing") return g.status;
        const action = nextAction(g, policy, api, memo);
        if (!action) return "stuck";
        perform(run, action);
        observe(run.state, trace);
      }
      return "budget";
    };
    for (const routeNumber of [1, 2, 3]) {
      for (const difficulty of DIFFICULTIES) {
        // The setup screen of a fresh session, before the first board is played.
        const setup = runtime.mount({ seed: 6100 + routeNumber * 10 + DIFFICULTIES.indexOf(difficulty), routeNumber, difficulty, autoStart: false });
        const setupTrace = [];
        observe(setup.state, setupTrace);
        out.push({ routeNumber, difficulty, policy: "setup", trace: setupTrace });
        for (const policy of POLICIES) {
          for (const seedOffset of [0, 1]) {
            const seed = 8400 + routeNumber * 100 + DIFFICULTIES.indexOf(difficulty) * 10 + seedOffset;
            const run = runtime.mount({ seed, routeNumber, difficulty });
            const trace = [];
            observe(run.state, trace);
            const end = drive(run, policy, trace, 220);
            const completions = JSON.parse(JSON.stringify(run.completions));
            run.restart();
            observe(run.state, trace);
            drive(run, policy, trace, 12);
            run.changeDifficulty(DIFFICULTIES[(DIFFICULTIES.indexOf(difficulty) + 1) % 3]);
            observe(run.state, trace);
            let next = null;
            const continuation = completions.at(-1)?.continuation;
            if (continuation) {
              const nextRun = runtime.mount({ seed: seed + 1, routeNumber: continuation.routeNumber, difficulty: continuation.difficulty, initialDifficulty: continuation.difficulty });
              next = [];
              observe(nextRun.state, next);
              drive(nextRun, policy, next, 12);
            }
            out.push({ routeNumber, difficulty, policy, seed, end, trace, completions, next });
          }
        }
      }
    }
    return { out, events, inconsistent };
  };
  const now = play(REV);
  const base = play(BASELINE);
  const diffs = now.out
    .map((r, i) => (same(r, base.out[i]) ? null : `${r.routeNumber}/${r.difficulty}/${r.policy}/${r.seed}@${r.trace.findIndex((s, j) => !same(s, base.out[i].trace[j]))}`))
    .filter(Boolean);
  const ends = {};
  for (const r of now.out) if (r.end) tally(ends, `${r.policy}:${r.end}`);
  const steps = now.out.reduce((sum, r) => sum + r.trace.length + (r.next?.length ?? 0), 0);
  const needed = ["status:setup", "status:playing", "status:won", "status:lost", "chestPause", "wallOpen", "secondChanceSpent", "trapArmed", "terminalOverlapNotFlagged"];
  record(
    "E5",
    "equivalence",
    "RUNTIME_DYNAMIC_SOLVABILITY_IDENTICAL_STEP_BY_STEP",
    diffs.length === 0 && same(now.events, base.events) && now.inconsistent.length === 0 && needed.every((k) => now.events[k] > 0) &&
      !now.events.terminalOverlapFlagged && now.out.length === 9 * (1 + POLICIES.length * 2) && now.out.some((r) => r.next),
    {
      runs: now.out.length,
      stepsCompared: steps,
      ends,
      events: now.events,
      missing: needed.filter((k) => !(now.events[k] > 0)),
      recomputedFromStateMismatches: now.inconsistent,
      nextRoutesOpened: now.out.filter((r) => r.next).length,
      digest: sha(now.out),
      diffs: diffs.slice(0, 6),
    },
  );
});

// =================================================================================================
// [structure] — the C0 instrumentation follows the code
// =================================================================================================

/** The loaded module whose validation internals hold `name`, for a graph. */
const holderOf = (graph, name) =>
  graph
    .modules()
    .filter((m) => m.loaded)
    .map((m) => m.file)
    .filter((file) => Object.hasOwn(graph.require(file)[INTERNALS_EXPORT] ?? {}, name));

// N1 — the C0 surface finds inspectDynamicMazeState in route-invariants.ts, once, and what a validator gets is the
// function the hook runs: the hook's re-export is that very function, and route-invariants was evaluated once.
{
  const holders = holderOf(NOW.graph, "inspectDynamicMazeState");
  const identical = holders.length === 1 && NOW.api.inspectDynamicMazeState === NOW.graph.require(holders[0])[INTERNALS_EXPORT].inspectDynamicMazeState;
  const loads = NOW.graph.modules().filter((m) => m.file === ROUTE_INVARIANTS).length;
  record(
    "N1",
    "structure",
    "C0_SURFACE_FINDS_THE_INVARIANTS_IN_ROUTE_INVARIANTS",
    same(holders, [ROUTE_INVARIANTS]) && identical && loads === 1 && NOW.hook.inspectDynamicMazeState === NOW.api.inspectDynamicMazeState,
    { holders, sameObjectAsSurface: identical, routeInvariantsEvaluations: loads },
  );
}

// N2 — every shared validator path lands there by itself: the instrumented generator's surface and the runtime harness
// (both C0 — the harness is what dynamic-solvability-02 and adversarial-runtime-replay load) resolve
// inspectDynamicMazeState to route-invariants.ts; `routeModuleDeclaring` (the counterfactual aim) and `locate` (textual
// anchors on the contract's code) find it there too.
{
  const LAB = loadInstrumented({ rev: REV, bare: true });
  const RUNTIME = loadRouteRuntime({ rev: REV });
  const lab = holderOf(LAB.graph, "inspectDynamicMazeState");
  const runtime = holderOf(RUNTIME.LAB.graph, "inspectDynamicMazeState");
  const declaring = errorOf(() => routeModuleDeclaring("inspectDynamicMazeState", { rev: REV })) ?? routeModuleDeclaring("inspectDynamicMazeState", { rev: REV });
  const anchors = {
    "export function inspectDynamicMazeState(": null,
    "  const effectiveWalls = new Set(mazeMap.walls);": null,
    "  if (unreachableObjectives.length > 0) issues.push(\"UNREACHABLE_OBJECTIVE\");": null,
    "export type ChestReward = \"pickaxe\" | \"second-chance\";": null,
  };
  for (const anchor of Object.keys(anchors)) anchors[anchor] = errorOf(() => TREE.locate(anchor)) ?? TREE.locate(anchor);
  record(
    "N2",
    "structure",
    "VALIDATOR_PATHS_FOLLOW_THE_INVARIANTS",
    same(lab, [ROUTE_INVARIANTS]) && same(runtime, [ROUTE_INVARIANTS]) && declaring === ROUTE_INVARIANTS &&
      Object.values(anchors).every((file) => file === ROUTE_INVARIANTS) &&
      LAB.API.inspectDynamicMazeState !== undefined && RUNTIME.API.inspectDynamicMazeState !== undefined,
    { instrumentedGenerator: lab, runtimeHarness: runtime, routeModuleDeclaring: declaring, anchorsLocatedIn: anchors },
  );
}

// =================================================================================================

const failing = tests.filter((t) => !t.pass).map((t) => t.id);
const tallyKind = (kind) => {
  const of = tests.filter((t) => t.kind === kind);
  return `${of.filter((t) => t.pass).length}/${of.length}`;
};
console.log(
  `\n${REV ? `rev ${TREE.rev.slice(0, 12)} · ` : ""}${tests.length - failing.length}/${tests.length} passed · structure ${tallyKind("structure")} · ` +
    `preserved ${tallyKind("preserved")} · equivalence ${tallyKind("equivalence")} · failing: ${failing.join(", ") || "none"}`,
);
process.exitCode = failing.length ? EXIT_VALIDATION_FAILED : EXIT_OK;
