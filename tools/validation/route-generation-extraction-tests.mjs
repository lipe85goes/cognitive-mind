/**
 * ROUTE-C2 — the Rota's map generation, certification and board geometry,
 * extracted out of `useEscapeMaze.ts`, tested.
 *
 *   src/games/escape-maze/route-geometry.ts    the board as a graph: keys,
 *                                               neighbours, BFS distances and
 *                                               paths, grid <-> walls;
 *   src/games/escape-maze/route-generation.ts  generation + certification:
 *                                               buildCandidate, the structural
 *                                               and final gates, recovery,
 *                                               the throw, `generateMaze`;
 *   src/engine/route-random.ts                 `randomItem`, the one-draw pick
 *                                               generation and the Hunter share.
 *
 * C2 is a pure refactor: the declarations moved, nothing they do did. Five
 * groups of checks hold it to that:
 *
 *   [structure]        WHERE the code lives, and the static gate against it
 *                      drifting back: each moved binding is declared in its
 *                      new module and nowhere else; the hook declares none of
 *                      it and gets `generateMaze` (and `MazeMap`) from
 *                      route-generation; no residual copy; the new modules
 *                      import no React, hook, UI, Babylon, sounds or scoring,
 *                      and the graph has no cycle back into the hook; the
 *                      instrumented generator and every textual anchor of the
 *                      validators land in route-generation.ts.
 *   [preserved]        what must not have changed: every moved declaration
 *                      (comments included) is the baseline's text, the hook's
 *                      remaining code is the baseline's text, the hook's
 *                      public surface (run-time and type) is the baseline's and
 *                      its real consumers still find every name; the turn
 *                      stays in the hook (the defender policy and the dynamic
 *                      invariants did too, until ROUTE-C3 moved the first to
 *                      route-defenders.ts and ROUTE-C4 the second to
 *                      route-invariants.ts — route-defenders-extraction-tests
 *                      and route-invariants-extraction-tests hold those moves);
 *                      the instrumented loader still sees 18 structural
 *                      reasons and 23 final gates, the escape context, bare
 *                      mode and replayGeneration's fidelity.
 *   [equivalence]      the working tree against 65932cf (C1, generation still
 *                      in the hook), both loaded through route-module-loader:
 *                      graph primitives over random boards; 1080 seeded maps
 *                      field by field (grid, walls, start, Hunter, exit,
 *                      lights, traps, chest, Sentinel setup, objective route,
 *                      next random draws), armed-seed maps, 270 maps on
 *                      continuous streams; every attempt of every replayed
 *                      generation (reason, gates, escape context, candidate,
 *                      objective cells); forced recovery and forced throws;
 *                      the dynamic invariants on every map; real Routes
 *                      played by the real hook, step by step, through chest,
 *                      pickaxe, restart, mode change and the next Route.
 *
 * `--rev=<commit>` runs every check on that tree instead of the working tree.
 * `--rev=65932cf` is the structural counterfactual: generation still lived in
 * useEscapeMaze.ts there, so every [structure] check must fail, while every
 * [preserved] and [equivalence] check holds (same code, same behaviour).
 *
 * Usage: node tools/validation/route-generation-extraction-tests.mjs [--rev=<commit>]
 * Writes nothing. Exit 0 = every check holds, 1 = a check failed, 3 = usage error.
 */
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";
import { loadInstrumented } from "./instrumented-generator.mjs";
import {
  INTERNALS_EXPORT,
  ROUTE_HOOK,
  ROUTE_MODULE_DIR,
  ROUTE_RANDOM_SEAM,
  anchoredEdits,
  loadRouteModules,
  openSourceTree,
  routeRandomBeforeC7A,
  treeBeforeC7B,
} from "./route-module-loader.mjs";
import { cellKey, loadRouteRuntime, pathBetween, walkableNeighbours } from "./route-runtime-harness.mjs";

/** C1: the last revision whose generation lived in the hook — what C2 must be equivalent to. */
const BASELINE = "65932cf50285427d50a6918a7378a6c5e62c7e01";
const ROUTE_GENERATION = "src/games/escape-maze/route-generation.ts";
const ROUTE_GEOMETRY = "src/games/escape-maze/route-geometry.ts";
const ROUTE_CONFIG = "src/games/escape-maze/route-config.ts";
const DIFFICULTY = "src/engine/difficulty.ts";
/** The hook's real consumers in the product. */
const CONSUMERS = ["src/games/escape-maze/RouteStrategyGame.tsx", "src/games/escape-maze/RouteBabylonBoard.tsx"];

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
if (args.some((arg) => arg !== revArg) || REV === "") {
  console.error("usage: node tools/validation/route-generation-extraction-tests.mjs [--rev=<commit>]");
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

// --- what C2 moved -------------------------------------------------------------------------------

/** The board's graph primitives: route-geometry.ts. */
const GEOMETRY_VALUES = [
  "keyToPosition", "posKey", "positionsEqual", "cloneGrid", "gridToWalls", "getNeighbors", "findPathLength",
  "countWalls", "getReachableDistances", "findPathCells",
];
/** Generation and certification: route-generation.ts. */
const GENERATION_VALUES = [
  "countReachableJunctions", "countStartZoneWalls", "protectedKeys", "chooseGuardianStart", "randomizeWalls",
  "chooseStars", "chooseTrapsAndChest", "decomposeBoardBlocks", "sharesBlock", "restrictToAdmissible",
  "computeObjectiveRoute", "measureRouteFlow", "countIdleDeadEnds", "scoreTrapForFuture", "routeCellsHaveEscape",
  "PORTAL_CONVERGENCE_RADIUS", "admissibleRouteCells", "escapeGeometryIsPossible", "resolveObjectiveRoute",
  "hasStrategicIdentity", "isStructurallyValid", "isValidMap", "buildCandidate", "generateMaze",
];
const GENERATION_TYPES = ["MazeMap", "BoardBlocks", "ObjectiveRoute", "CandidateAnalysis"];
/** The one-draw pick, beside the stream it draws from. */
const SEAM_VALUES = ["randomItem"];
const MOVED_VALUES = [...GEOMETRY_VALUES, ...GENERATION_VALUES, ...SEAM_VALUES];
const MOVED = [...MOVED_VALUES, ...GENERATION_TYPES];
const HOME = Object.fromEntries([
  ...GEOMETRY_VALUES.map((name) => [name, ROUTE_GEOMETRY]),
  ...GENERATION_VALUES.map((name) => [name, ROUTE_GENERATION]),
  ...GENERATION_TYPES.map((name) => [name, ROUTE_GENERATION]),
  ...SEAM_VALUES.map((name) => [name, ROUTE_RANDOM_SEAM]),
]);
/** What route-generation exports: the contract, nothing for convenience. */
const GENERATION_EXPORTS = ["MazeMap", "generateMaze"];

/**
 * Left in the hook on purpose: input, chest and turn orchestration are the hook's own. None of it may have moved. The
 * defenders' policy was here at C2 (PORTAL_ZONE_RADIUS, SENTINEL_*, computePortalDefenceZone, createSentinelState,
 * decideSentinelMove, EMPTY_BLOCKED, chooseGuardianMove, PortalDefenceZone, SentinelState); ROUTE-C3 moved it to
 * route-defenders.ts, which route-defenders-extraction-tests.mjs checks — verbatim, against this tree's head. So were
 * the dynamic invariants (inspectDynamicMazeState, DynamicMazeStateSnapshot, DynamicSolvabilityInspection) and the
 * state's vocabulary their snapshot is written in (GameStatus, ChestReward); ROUTE-C4 moved them to
 * route-invariants.ts, which route-invariants-extraction-tests.mjs checks the same way.
 */
const KEPT_IN_HOOK_VALUES = [
  "ARROW_DELTAS", "BREAK_DIRECTION_DELTAS", "MOVE_INPUT_GUARD_MS",
  "SECOND_CHANCE_EXPLORER_MESSAGE", "SECOND_CHANCE_DEFENDER_MESSAGE", "useEscapeMaze",
];
const KEPT_IN_HOOK_TYPES = [
  "BreakDirection", "BreakTarget", "CompleteFn", "DefenderPhaseInput",
];

/** What route-generation and route-geometry may import, and what they must never reach. */
const ALLOWED_IMPORTS = {
  [ROUTE_GENERATION]: [
    "@/engine/difficulty", "@/engine/route-random", "@/games/escape-maze/route-config",
    "@/games/escape-maze/route-geometry", "@/types/game",
  ],
  [ROUTE_GEOMETRY]: ["@/games/escape-maze/route-config", "@/types/game"],
};
const FORBIDDEN_IMPORT = /react|useEscapeMaze|babylon|game-sounds|scoring|components\/|RewardResultModal|GameScreen|\.tsx$|^@\/app\//i;

const DIFFICULTIES = ["easy", "medium", "hard"];
const STAGES = [1, 2, 3];

// --- harness -------------------------------------------------------------------------------------

const tests = [];
const record = (id, kind, name, pass, detail = {}) => {
  tests.push({ id, kind, name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} [${kind}] — ${name}`);
  for (const [k, v] of Object.entries(detail)) {
    const text = typeof v === "object" ? JSON.stringify(v) : String(v);
    console.log(`        ${k}: ${text.length > 600 ? `${text.slice(0, 597)}...` : text}`);
  }
};
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

// ROUTE-C7B: the text this extraction pins is read through C7B's sanctioned edit of the hook, the Rota's view and its
// stylesheet (route-module-loader.mjs `treeBeforeC7B`), and C7B's two new modules are not in it; every other byte is
// still compared. Its graph questions (closure, declaring, locate) are the tree's own, and its runs load `rev`.
const TREE = treeBeforeC7B(openSourceTree({ rev: REV }));
const BASE_TREE = openSourceTree({ rev: BASELINE });
const label = REV ? `rev ${TREE.rev.slice(0, 12)}` : "working tree";
console.log(`route-generation extraction · ${label} vs baseline ${BASELINE.slice(0, 7)} (generation in the hook)\n`);

const parse = (file, source) =>
  ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const isExported = (node) => (ts.getModifiers?.(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

/** Top-level declarations of a module, by the parser, with each statement's text (leading comments included). */
function declarations(file, source) {
  const sf = parse(file, source);
  const out = { values: [], types: [], exported: [], imports: [], statements: [], text: new Map() };
  const keep = (name, statement) => out.text.set(name, statement.getFullText(sf).trim());
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
        out.exported.push(...statement.exportClause.elements.map((e) => e.name.text));
      }
      continue;
    }
    out.statements.push(statement.getFullText(sf).trim());
    if (ts.isVariableStatement(statement)) {
      for (const d of statement.declarationList.declarations) {
        out.values.push(d.name.text);
        keep(d.name.text, statement);
        if (isExported(statement)) out.exported.push(d.name.text);
      }
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      out.values.push(statement.name.text);
      keep(statement.name.text, statement);
      if (isExported(statement)) out.exported.push(statement.name.text);
    } else if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
      out.types.push(statement.name.text);
      keep(statement.name.text, statement);
      if (isExported(statement)) out.exported.push(statement.name.text);
    }
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
const generationExists = TREE.exists(ROUTE_GENERATION);
const geometryExists = TREE.exists(ROUTE_GEOMETRY);
const generation = declarations(ROUTE_GENERATION, read(TREE, ROUTE_GENERATION));
const geometry = declarations(ROUTE_GEOMETRY, read(TREE, ROUTE_GEOMETRY));
const seam = declarations(ROUTE_RANDOM_SEAM, read(TREE, ROUTE_RANDOM_SEAM));
const baseHookText = BASE_TREE.read(ROUTE_HOOK);
const baseHook = declarations(ROUTE_HOOK, baseHookText);
const closure = TREE.closure(ROUTE_HOOK);
const owners = Object.fromEntries(
  MOVED_VALUES.map((name) => [name, errorOf(() => TREE.declaring(name, { within: "src/" })) ?? TREE.declaring(name, { within: "src/" })]),
);
const resolvesTo = (from, specifier) => errorOf(() => TREE.resolve(specifier, from)) ?? TREE.resolve(specifier, from);

// =================================================================================================
// [structure]
// =================================================================================================

// S1 — every moved binding is declared in its new module, and nowhere else in the Rota's graph (seam included).
{
  const misplaced = MOVED_VALUES.filter((name) => owners[name] !== HOME[name]);
  const typesMissing = GENERATION_TYPES.filter((name) => !generation.types.includes(name));
  record(
    "S1",
    "structure",
    "MOVED_CODE_LIVES_IN_ITS_NEW_MODULE",
    generationExists && geometryExists && closure.includes(ROUTE_GENERATION) && closure.includes(ROUTE_GEOMETRY) &&
      misplaced.length === 0 && typesMissing.length === 0,
    {
      inHookGraph: { generation: closure.includes(ROUTE_GENERATION), geometry: closure.includes(ROUTE_GEOMETRY) },
      declaredIn: Object.fromEntries(Object.entries(owners).filter(([name]) => misplaced.includes(name)).slice(0, 8)),
      misplaced: misplaced.length,
      typesMissingFromGeneration: typesMissing,
    },
  );
}

// S2 — the static gate: the hook declares none of it (values or types), not even as text.
{
  const redeclared = MOVED.filter((name) => hook.values.includes(name) || hook.types.includes(name));
  // Everything but the import/export header, where `type MazeMap` legitimately names the imported type.
  const hookCode = codeOnly(hook.statements.join("\n"));
  const declarationText = MOVED.filter((name) =>
    new RegExp(String.raw`\b(?:function|const|let|interface|type)\s+${name}\b`).test(hookCode),
  );
  record("S2", "structure", "HOOK_DECLARES_NONE_OF_IT", redeclared.length === 0 && declarationText.length === 0, {
    redeclaredInHook: redeclared.length > 8 ? `${redeclared.length} of ${MOVED.length}` : redeclared,
    declarationTextInHook: declarationText.length > 8 ? `${declarationText.length} of ${MOVED.length}` : declarationText,
  });
}

// S3 — the hook asks route-generation for maps: one import, exactly `generateMaze` and `MazeMap`, which is exactly what
// route-generation exports; the seeded-generation restart and every gate are gone from the hook's code.
{
  const fromGeneration = hook.imports.filter((imp) => resolvesTo(ROUTE_HOOK, imp.specifier) === ROUTE_GENERATION);
  const imported = sorted(fromGeneration.flatMap((imp) => imp.names));
  const exported = sorted(generation.exported);
  const hookCode = codeOnly(hookText);
  const generationInHook = ["beginSeededGeneration", "buildCandidate", "isValidMap", "isStructurallyValid", "MAX_GENERATION_ATTEMPTS", "RECOVERY_ROUNDS"].filter(
    (name) => new RegExp(String.raw`\b${name}\b`).test(hookCode),
  );
  const callsGenerateMaze = (hookCode.match(/\bgenerateMaze\(/g) ?? []).length;
  record(
    "S3",
    "structure",
    "HOOK_GETS_GENERATE_MAZE_FROM_ROUTE_GENERATION",
    fromGeneration.length === 1 && same(imported, GENERATION_EXPORTS) && same(exported, GENERATION_EXPORTS) &&
      generationInHook.length === 0 && callsGenerateMaze === 2,
    {
      importDeclarations: fromGeneration.map((imp) => imp.specifier),
      hookImports: imported,
      routeGenerationExports: exported,
      generationNamesStillInHook: generationInHook,
      generateMazeCallsInHook: callsGenerateMaze,
    },
  );
}

// S4 — every primitive route-geometry exports is consumed by the Rota, and only primitives are: the union of what the
// hook and route-generation import from it is exactly its exports.
{
  const importers = closure
    .filter((file) => file.startsWith(ROUTE_MODULE_DIR) && file !== ROUTE_GEOMETRY)
    .map((file) => ({
      file,
      names: declarations(file, TREE.read(file)).imports.filter((imp) => resolvesTo(file, imp.specifier) === ROUTE_GEOMETRY).flatMap((imp) => imp.names),
    }))
    .filter((importer) => importer.names.length > 0);
  const imported = sorted(new Set(importers.flatMap((importer) => importer.names)));
  const exported = sorted(geometry.exported);
  record(
    "S4",
    "structure",
    "ROUTE_GEOMETRY_EXPORTS_WHAT_THE_ROTA_WALKS_WITH",
    geometryExists && same(exported, sorted(GEOMETRY_VALUES)) && same(imported, exported) &&
      importers.some((importer) => importer.file === ROUTE_HOOK) && importers.some((importer) => importer.file === ROUTE_GENERATION),
    { exported, importers: Object.fromEntries(importers.map((importer) => [importer.file, importer.names.length])) },
  );
}

// S5 — `randomItem` is the seam's: declared once, in route-random.ts, beside the stream; generation and the Hunter both
// import that one function; no Rota module keeps a copy. difficulty.ts (its own `pickRandom`) untouched.
// ROUTE-C3: "the Hunter" is whichever module declares `chooseGuardianMove` — the hook at C2, route-defenders.ts since.
{
  const hunterModule = errorOf(() => TREE.declaring("chooseGuardianMove")) ?? TREE.declaring("chooseGuardianMove");
  const importersOfRandomItem = closure
    .filter((file) => file.startsWith(ROUTE_MODULE_DIR))
    .filter((file) =>
      declarations(file, TREE.read(file)).imports.some((imp) => resolvesTo(file, imp.specifier) === ROUTE_RANDOM_SEAM && imp.valueNames.includes("randomItem")),
    );
  const difficultyUntouched = read(TREE, DIFFICULTY) === read(BASE_TREE, DIFFICULTY);
  record(
    "S5",
    "structure",
    "RANDOM_ITEM_LIVES_BESIDE_THE_STREAM",
    owners.randomItem === ROUTE_RANDOM_SEAM && seam.exported.includes("randomItem") &&
      same(sorted(importersOfRandomItem), sorted([hunterModule, ROUTE_GENERATION])) && difficultyUntouched,
    { declaredIn: owners.randomItem, importedBy: importersOfRandomItem, hunterDeclaredIn: hunterModule, difficultyTsUnchanged: difficultyUntouched },
  );
}

// S6 — dependency rule: route-generation and route-geometry import only configuration, the engine helpers they were
// allowed, the geometry and types — never React, the hook, UI, Babylon, sounds or scoring — and nothing either reaches
// leads back to the hook (no cycle); geometry does not reach generation or the RNG.
{
  const report = {};
  let ok = generationExists && geometryExists;
  for (const file of [ROUTE_GENERATION, ROUTE_GEOMETRY]) {
    if (!TREE.exists(file)) continue;
    const source = TREE.read(file);
    const decl = declarations(file, source);
    const specifiers = decl.imports.map((imp) => imp.specifier);
    const notAllowed = specifiers.filter((spec) => !ALLOWED_IMPORTS[file].includes(spec));
    const forbidden = specifiers.filter((spec) => FORBIDDEN_IMPORT.test(spec));
    const reach = TREE.closure(file);
    const code = codeOnly(source);
    const mentions = ["use client", "window", "document", "Math.random", "useState", "useEffect", "BABYLON"].filter((word) => code.includes(word));
    const reachesHook = reach.includes(ROUTE_HOOK);
    const reachesGeneration = file === ROUTE_GEOMETRY && reach.includes(ROUTE_GENERATION);
    const reachesRng = file === ROUTE_GEOMETRY && reach.includes(ROUTE_RANDOM_SEAM);
    report[file] = { imports: specifiers, notAllowed, forbidden, mentions, runtimeReach: reach, reachesHook, reachesGeneration, reachesRng };
    ok &&= notAllowed.length === 0 && forbidden.length === 0 && mentions.length === 0 && !reachesHook && !reachesGeneration && !reachesRng;
  }
  record("S6", "structure", "NEW_MODULES_ARE_PURE_AND_ACYCLIC", ok, report);
}

// S7 — no residual duplication: across every source module of the repository, each moved name is declared exactly
// once at top level, and the body of each moved function exists exactly once.
{
  const srcFiles = (
    REV
      ? execFileSync("git", ["ls-tree", "-r", "--name-only", TREE.rev, "src"], { encoding: "utf8" })
      : execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "src"], { encoding: "utf8" })
  )
    .split("\n")
    // ROUTE-C7B: TREE is the view before C7B, which has neither of C7B's two new modules.
    .filter((file) => /\.(ts|tsx)$/.test(file) && TREE.exists(file));
  const declaredBy = Object.fromEntries(MOVED.map((name) => [name, []]));
  const bodies = new Map();
  const texts = srcFiles.map((file) => ({ file, text: TREE.read(file) }));
  for (const { file, text } of texts) {
    const decl = declarations(file, text);
    for (const name of MOVED) if (decl.values.includes(name) || decl.types.includes(name)) declaredBy[name].push(file);
    for (const name of MOVED_VALUES) {
      if (decl.text.has(name) && decl.values.includes(name)) bodies.set(name, unexported(decl.text.get(name)).replace(/^[\s\S]*?(?=(?:function|const) )/, ""));
    }
  }
  const duplicates = Object.entries(declaredBy).filter(([, files]) => files.length !== 1);
  const bodyCopies = [...bodies].map(([name, body]) => [name, texts.reduce((sum, { text }) => sum + (unexported(text).split(body).length - 1), 0)]);
  const copied = bodyCopies.filter(([, count]) => count !== 1);
  record("S7", "structure", "NO_RESIDUAL_DUPLICATION", duplicates.length === 0 && copied.length === 0 && bodies.size === MOVED_VALUES.length && owners.randomItem === ROUTE_RANDOM_SEAM, {
    sourceModulesScanned: srcFiles.length,
    declaredOtherThanOnce: Object.fromEntries(duplicates.slice(0, 6)),
    bodiesFound: bodies.size,
    bodiesNotExactlyOnce: Object.fromEntries(copied.slice(0, 6)),
  });
}

// =================================================================================================
// [preserved] — the text
// =================================================================================================

// P1 — every moved declaration is the baseline's text, leading comments included; only `export` was added.
{
  const homeText = Object.fromEntries(
    [ROUTE_GENERATION, ROUTE_GEOMETRY, ROUTE_RANDOM_SEAM, ROUTE_HOOK].map((file) => [file, unexported(read(TREE, file))]),
  );
  const changed = MOVED.filter((name) => {
    const before = baseHook.text.get(name);
    if (!before) return true;
    const owner = owners[name] && !owners[name].startsWith?.("route-module-loader") ? owners[name] : HOME[name];
    const where = GENERATION_TYPES.includes(name) ? (generationExists ? ROUTE_GENERATION : ROUTE_HOOK) : owner;
    return !(homeText[where] ?? "").includes(unexported(before));
  });
  record("P1", "preserved", "MOVED_DECLARATIONS_ARE_VERBATIM", changed.length === 0, {
    declarationsCompared: MOVED.length,
    textChanged: changed,
  });
}

// P2 — the hook's remaining code is the baseline's text: every statement but the import/export header is found,
// verbatim, in the baseline hook; and the seam is the baseline's seam plus `randomItem`, nothing else.
{
  const baseHookNormalized = unexported(baseHookText);
  const c5Statements = [...C5_REWRITTEN, ...C5_ADDED].map((name) => hook.text.get(name));
  const changedStatements = hook.statements.filter((statement) => !c5Statements.includes(statement) && !baseHookNormalized.includes(unexported(statement)));
  const randomItemText = seam.text.get("randomItem");
  // ROUTE-C7A: the seam's checkpoint is C7A's one sanctioned edit there (two declarations rewritten, four added —
  // route-worker-rng-handoff-tests.mjs holds them); every other byte is still compared.
  const seamNow = TREE.exists(ROUTE_RANDOM_SEAM) ? routeRandomBeforeC7A(TREE) : "";
  const seamWithout = randomItemText ? seamNow.replace(`\n\n${randomItemText}`, "") : seamNow;
  const seamOk = seamWithout === read(BASE_TREE, ROUTE_RANDOM_SEAM);
  record("P2", "preserved", "HOOK_AND_SEAM_OTHERWISE_UNCHANGED", changedStatements.length === 0 && seamOk, {
    hookStatements: hook.statements.length,
    changedStatements: changedStatements.map((s) => s.split("\n").find((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))?.slice(0, 80)),
    seamIsBaselinePlusRandomItem: seamOk,
    rewrittenOrAddedByC5: [...C5_REWRITTEN, ...C5_ADDED],
  });
}

// P3 — the turn itself is still in the hook, unchanged. (What C4 moved left this list for route-invariants.ts; the
// hook's body is C5's where route-state.ts exists — see C5_REWRITTEN.)
{
  const missing = [...KEPT_IN_HOOK_VALUES.filter((n) => !hook.values.includes(n)), ...KEPT_IN_HOOK_TYPES.filter((n) => !hook.types.includes(n))];
  const changed = [...KEPT_IN_HOOK_VALUES, ...KEPT_IN_HOOK_TYPES].filter((n) => !C5_REWRITTEN.includes(n) && hook.text.get(n) !== baseHook.text.get(n));
  record("P3", "preserved", "TURN_STAYS_IN_THE_HOOK", missing.length === 0 && changed.length === 0, {
    kept: KEPT_IN_HOOK_VALUES.length + KEPT_IN_HOOK_TYPES.length,
    missingFromHook: missing,
    textChanged: changed,
    rewrittenByC5: C5_REWRITTEN,
  });
}

// P4 — the hook's public surface, by the parser (values and types, declared or re-exported) and at run time, is the
// baseline's; the product's consumers still find every name they import, and are themselves unchanged.
{
  const exportsNow = sorted(hook.exported);
  const exportsBase = sorted(baseHook.exported);
  const consumers = CONSUMERS.map((file) => {
    const decl = declarations(file, TREE.read(file));
    const names = decl.imports.filter((imp) => resolvesTo(file, imp.specifier) === ROUTE_HOOK).flatMap((imp) => imp.names);
    return { file, names, missing: names.filter((name) => !exportsNow.includes(name)), unchanged: TREE.read(file) === BASE_TREE.read(file) };
  });
  record(
    "P4",
    "preserved",
    "PUBLIC_SURFACE_COMPATIBLE",
    same(exportsNow, exportsBase) && consumers.every((c) => c.missing.length === 0 && c.unchanged),
    { hookExports: exportsNow, consumers: consumers.map(({ file, names, missing, unchanged }) => ({ file, names, missing, unchanged })) },
  );
}

// =================================================================================================
// load both Rotas
// =================================================================================================

const SURFACE = [
  ...GEOMETRY_VALUES, "decomposeBoardBlocks", "sharesBlock", "resolveObjectiveRoute", "routeCellsHaveEscape",
  "escapeGeometryIsPossible", "generateMaze", "computePortalDefenceZone", "createSentinelState", "inspectDynamicMazeState",
  "PLAYER_START",
];
const NOW = loadRouteModules({ rev: REV, surface: SURFACE });
const BASE = loadRouteModules({ rev: BASELINE, surface: SURFACE });

// P5 — at run time: the same export names, and the hook's posKey / positionsEqual / generateMaze ARE the functions
// that do the work (a re-export, not a copy).
{
  const keys = (rota) => sorted(Object.keys(rota.hook).filter((k) => k !== INTERNALS_EXPORT));
  const identity = (rota) => ({
    posKey: rota.hook.posKey === rota.api.posKey,
    positionsEqual: rota.hook.positionsEqual === rota.api.positionsEqual,
    generateMaze: rota.hook.generateMaze === rota.api.generateMaze,
  });
  record("P5", "preserved", "RUNTIME_EXPORTS_UNCHANGED_AND_SHARED", same(keys(NOW), keys(BASE)) && Object.values(identity(NOW)).every(Boolean), {
    runtimeExports: keys(NOW),
    sameFunctionThroughTheHook: identity(NOW),
  });
}

// =================================================================================================
// [equivalence]
// =================================================================================================

// E1 — the graph primitives (moved and re-imported) answer the same over random boards.
{
  let state = 0x5eed;
  const rand = () => {
    state = (Math.imul(state, 1103515245) + 12345) >>> 0;
    return state / 4294967296;
  };
  const boards = Array.from({ length: 300 }, () => {
    const grid = Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => (rand() < 0.3 ? 1 : 0)));
    return grid;
  });
  const cell = () => ({ row: Math.floor(rand() * 9), col: Math.floor(rand() * 9) });
  const probes = boards.map(() => [cell(), cell(), cell()]);
  const answer = (api) =>
    sha(
      boards.map((grid, i) => {
        const walls = api.gridToWalls(grid);
        const [a, b, c] = probes[i];
        const blocks = api.decomposeBoardBlocks(walls);
        return {
          walls: [...walls],
          clone: api.cloneGrid(grid),
          count: api.countWalls(grid),
          neighbours: api.getNeighbors(a, walls),
          length: api.findPathLength(a, b, walls),
          lengthBlocked: api.findPathLength(a, b, walls, new Set([api.posKey(c)])),
          cells: api.findPathCells(a, b, walls),
          cellsBlocked: api.findPathCells(a, b, walls, new Set([api.posKey(c)])),
          distances: [...api.getReachableDistances(a, walls)],
          key: api.keyToPosition(api.posKey(c)),
          equal: [api.positionsEqual(a, b), api.positionsEqual(a, a)],
          blocks: [[...blocks.blocksOf], [...blocks.componentOf]],
          shares: [api.sharesBlock(blocks, a, b), api.sharesBlock(blocks, a, c)],
        };
      }),
    );
  const a = answer(NOW.api);
  const b = answer(BASE.api);
  record("E1", "equivalence", "GRAPH_PRIMITIVES_ANSWER_THE_SAME", a === b, { boards: boards.length, digest: a, baseline: b });
}

/** One generated map, every observable field, plus what the stream draws next. */
function canonical(rota, map) {
  const api = rota.api;
  const zone = api.computePortalDefenceZone(map.playerStart, map.exitPosition, map.walls);
  const sentinel = api.createSentinelState(map, zone);
  const blocks = api.decomposeBoardBlocks(map.walls);
  const objective = api.resolveObjectiveRoute(map.playerStart, map.collectibleStars, map.exitPosition, map.walls, blocks);
  const inspection = api.inspectDynamicMazeState({
    mazeMap: map,
    player: map.playerStart,
    guardian: map.guardianStart,
    sentinel: sentinel.position,
    collectedStars: [],
    triggeredTraps: [],
    chestOpened: false,
    rewardSelected: null,
    rewardSpent: false,
    brokenWall: null,
    status: "playing",
  });
  return {
    grid: map.grid.map((row) => row.join("")).join("/"),
    walls: [...map.walls].sort().join(" "),
    playerStart: api.posKey(map.playerStart),
    guardianStart: api.posKey(map.guardianStart),
    exitPosition: api.posKey(map.exitPosition),
    lights: map.collectibleStars.map(api.posKey).join(" "),
    traps: map.traps.map(api.posKey).join(" "),
    chest: map.chest ? api.posKey(map.chest) : null,
    playerStartIsTheTable: map.playerStart === api.PLAYER_START,
    sentinel: { start: api.posKey(sentinel.position), target: sentinel.target, commitLeft: sentinel.commitLeft },
    portalZone: { zone: zone.zone.map(api.posKey).join(" "), accesses: zone.accesses.map(api.posKey).join(" ") },
    objective: objective ? { moves: objective.moves, cells: objective.cells.map(api.posKey).join(" ") } : null,
    escape: [
      objective ? api.routeCellsHaveEscape(map.playerStart, map.exitPosition, objective.cells, map.walls, blocks) : null,
      api.escapeGeometryIsPossible(map.playerStart, map.exitPosition, map.walls, blocks),
    ],
    invariants: { valid: inspection.valid, solvable: inspection.solvable, issues: inspection.issues, unreachable: inspection.unreachableObjectives },
  };
}
const generate = (rota, difficulty, routeNumber) => {
  try {
    return { map: rota.api.generateMaze(difficulty, routeNumber), threw: null };
  } catch (error) {
    return { map: null, threw: error.message };
  }
};
/** The next draws of the ONE stream generation and the Hunter share, read through the seam. */
const nextDraws = (rota, n = 3) => Array.from({ length: n }, () => rota.routeRandom.routeRandom());

// E2 — 1080 maps, seeded per map exactly as final-acceptance's FASE 1, field by field, and the stream after each.
{
  const diffs = [];
  let compared = 0;
  let threw = 0;
  const digest = crypto.createHash("sha256");
  for (const stage of STAGES) {
    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < 120; i += 1) {
        const seed = stage * 10_000_000 + DIFFICULTIES.indexOf(difficulty) * 1_000_000 + i + 1;
        const run = (rota) => {
          rota.setSeed(seed);
          const { map, threw: error } = generate(rota, difficulty, stage);
          return { error, map: map ? canonical(rota, map) : null, next: nextDraws(rota) };
        };
        const a = run(NOW);
        const b = run(BASE);
        compared += 1;
        if (a.error) threw += 1;
        digest.update(JSON.stringify(a));
        if (!same(a, b)) diffs.push({ stage, difficulty, seed, fields: a.map && b.map ? Object.keys(a.map).filter((k) => !same(a.map[k], b.map[k])) : ["error/next"] });
      }
    }
  }
  record("E2", "equivalence", "MAPS_AND_NEXT_DRAWS_IDENTICAL_1080", diffs.length === 0 && compared === 1080, {
    mapsCompared: compared,
    fieldsPerMap: "grid, walls, playerStart, guardianStart, exitPosition, lights, traps, chest, Sentinel setup, portal zone, objective route, escape width, dynamic invariants, next 3 draws",
    threw,
    digest: digest.digest("hex").slice(0, 16),
    diffs: diffs.slice(0, 5),
  });
}

// E3 — continuous streams (no reseed between maps, the regime the product runs in) and armed diagnostic seeds (the
// seam restarts the stream at the top of each generation): same maps, same stream after them.
{
  const diffs = [];
  let compared = 0;
  for (const stage of STAGES) {
    for (const difficulty of DIFFICULTIES) {
      const stream = (rota) => {
        rota.setSeed(20260808);
        return Array.from({ length: 30 }, () => {
          const { map, threw } = generate(rota, difficulty, stage);
          return { threw, map: map ? sha(canonical(rota, map)) : null };
        }).concat([{ next: nextDraws(rota, 5) }]);
      };
      const armed = (rota) =>
        [101, 2027, 777001].map((seed) => {
          rota.routeRandom.armRouteRandomSeed(seed);
          try {
            rota.setSeed(1);
            const first = generate(rota, difficulty, stage);
            const after = nextDraws(rota, 3);
            rota.setSeed(999); // an armed seed must not follow the sandbox's Math
            const again = generate(rota, difficulty, stage);
            return { first: first.map ? sha(canonical(rota, first.map)) : first.threw, after, again: again.map ? sha(canonical(rota, again.map)) : again.threw };
          } finally {
            rota.routeRandom.clearRouteRandomSeed();
          }
        });
      const a = { stream: stream(NOW), armed: armed(NOW) };
      const b = { stream: stream(BASE), armed: armed(BASE) };
      compared += 30 + 6;
      if (!same(a, b)) diffs.push({ stage, difficulty, stream: same(a.stream, b.stream), armed: same(a.armed, b.armed) });
      if (!a.armed.every((entry) => entry.first === entry.again)) diffs.push({ stage, difficulty, armedNotReproducible: true });
    }
  }
  record("E3", "equivalence", "CONTINUOUS_AND_ARMED_STREAMS_IDENTICAL", diffs.length === 0 && compared === 9 * 36, {
    mapsCompared: `${compared} (9 x 30 continuous + 9 x 3 armed seeds x 2 generations)`,
    diffs: diffs.slice(0, 5),
  });
}

const NOW_LAB = loadInstrumented({ rev: REV });
const BASE_LAB = loadInstrumented({ rev: BASELINE });

// E4 — every attempt of every replayed generation, with capture on: structural reason, escape context, final gates
// failed, the candidate map and its objective cells — and the totals: attempts, random phase, recovery, throw.
{
  const diffs = [];
  let generations = 0;
  let attempts = 0;
  let escapeContexts = 0;
  const reasonsSeen = new Set();
  for (const stage of STAGES) {
    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < 12; i += 1) {
        const seed = 40_000 + stage * 1000 + DIFFICULTIES.indexOf(difficulty) * 100 + i;
        const replay = (lab) => {
          lab.setSeed(seed);
          const r = lab.replayGeneration({ difficulty, stage, capture: true });
          return { r, digest: sha([r.attempts, r.totalAttempts, r.randomAttempts, r.recoveryAttempts, r.threw, r.histogram, lab.sb.Math.random()]) };
        };
        const a = replay(NOW_LAB);
        const b = replay(BASE_LAB);
        generations += 1;
        attempts += a.r.totalAttempts;
        for (const attempt of a.r.attempts) {
          if (attempt.escapeContext) escapeContexts += 1;
          if (attempt.structuralReason !== undefined) reasonsSeen.add(attempt.structuralReason);
        }
        if (a.digest !== b.digest) diffs.push({ stage, difficulty, seed });
      }
    }
  }
  record("E4", "equivalence", "EVERY_ATTEMPT_EXPLAINED_THE_SAME", diffs.length === 0 && generations === 108 && escapeContexts > 0, {
    generations,
    attemptsCompared: attempts,
    escapeContextsCaptured: escapeContexts,
    structuralReasonsSeen: [...reasonsSeen].sort((x, y) => x - y),
    diffs: diffs.slice(0, 5),
  });
}

/** A Rota whose budget is rewritten in memory, wherever the budget is declared — the same edit on both trees. */
function budgeted(rev, edits) {
  const tree = openSourceTree({ rev });
  const lines = edits.map(([name, value]) => {
    const file = tree.declaring(name);
    const line = tree.read(file).split("\n").find((l) => new RegExp(String.raw`^(?:export )?const ${name} = \d+;$`).test(l));
    if (!line) throw new Error(`${name}: declaration not found in ${file}`);
    return [line, line.replace(/= \d+;$/, `= ${value};`)];
  });
  return loadRouteModules({ tree, transforms: anchoredEdits(tree, lines), surface: SURFACE });
}

// E5 — recovery and the throw, forced: with the random phase cut to one attempt the recovery sweep must enter and
// certify through the same gates; with recovery also cut to zero rounds, generation must throw the same error. Same
// outcome, same message, same stream after it, on both trees.
{
  const variants = {
    recovery: [["MAX_GENERATION_ATTEMPTS", 1]],
    throwing: [["MAX_GENERATION_ATTEMPTS", 1], ["RECOVERY_ROUNDS", 0]],
  };
  const summary = {};
  const diffs = [];
  for (const [variant, edits] of Object.entries(variants)) {
    const now = budgeted(REV, edits);
    const base = budgeted(BASELINE, edits);
    const outcomes = { certified: 0, threw: 0 };
    for (const stage of STAGES) {
      for (const difficulty of DIFFICULTIES) {
        for (let i = 0; i < 6; i += 1) {
          const seed = 31_000 + stage * 100 + DIFFICULTIES.indexOf(difficulty) * 10 + i;
          const run = (rota) => {
            rota.setSeed(seed);
            const { map, threw } = generate(rota, difficulty, stage);
            return { threw, map: map ? sha(canonical(rota, map)) : null, next: nextDraws(rota) };
          };
          const a = run(now);
          const b = run(base);
          outcomes[a.threw ? "threw" : "certified"] += 1;
          if (!same(a, b)) diffs.push({ variant, stage, difficulty, seed });
          if (a.threw && !/^Route map generation failed all gates for stage \d \((easy|medium|hard)\)\. This is a generator bug/.test(a.threw)) {
            diffs.push({ variant, unexpectedError: a.threw });
          }
        }
      }
    }
    summary[variant] = outcomes;
  }
  record(
    "E5",
    "equivalence",
    "RECOVERY_AND_THROW_IDENTICAL",
    diffs.length === 0 && summary.recovery.threw === 0 && summary.throwing.threw > 0 && summary.throwing.certified > 0,
    { outcomes: summary, diffs: diffs.slice(0, 5) },
  );
}

// E6 — real Routes, played by the real hook, recorded at every step: start, every move and defender answer, the
// chest and its reward, the pickaxe, a restart, a mode change, the Route's end, its completion and the next Route.
{
  const snapshot = (g) => ({
    status: g.status,
    message: g.message,
    route: [g.routeNumber, g.routeProgression.stage, g.routeProgression.label],
    mode: g.difficulty,
    player: cellKey(g.player),
    guardian: cellKey(g.guardian),
    sentinel: [cellKey(g.sentinel), g.sentinelTarget && cellKey(g.sentinelTarget), g.sentinelCommitLeft],
    counters: [g.turns, g.blockedMoves, g.errors, g.collectedCount, g.totalLights, g.trapsTriggered, g.moveTick, g.blockedShake],
    lights: [...g.collectedSet].sort(),
    traps: [...g.triggeredTrapSet].sort(),
    chest: [g.chestPosition && cellKey(g.chestPosition), g.chestOpened, g.rewardSelected, g.rewardSpent, g.brokenWall],
    breakTargets: g.breakTargets.map((t) => `${t.direction}:${cellKey(t.cell)}`),
    portal: [g.portalActive, g.portalDefenceZone.accesses.map(cellKey).join(" ")],
    invariants: [g.dynamicSolvability.valid, g.dynamicSolvability.solvable, g.dynamicSolvability.issues.join(",")],
    map: sha([[...g.mazeMap.walls].sort(), g.mazeMap.guardianStart, g.mazeMap.exitPosition, g.mazeMap.collectibleStars, g.mazeMap.traps, g.mazeMap.chest]),
  });
  const drive = (run, policy, trace, budget = 220) => {
    for (let guard = 0; guard < budget; guard += 1) {
      const g = run.state;
      if (g.status !== "playing") return g.status;
      if (g.rewardChoicePending) {
        run.choose(policy === "win" ? "second-chance" : "pickaxe");
      } else if (policy === "pickaxe" && g.breakTargets.length > 0) {
        run.break(g.breakTargets[0].cell);
      } else {
        let best = null;
        if (policy === "lose") best = pathBetween(g.player, g.guardian, g.walls);
        else if (policy === "pickaxe" && !g.chestOpened && g.chestPosition) best = pathBetween(g.player, g.chestPosition, g.walls);
        else {
          const remaining = g.mazeMap.collectibleStars.filter((star) => !g.collectedSet.has(cellKey(star)));
          const goals = remaining.length ? remaining : [g.mazeMap.exitPosition];
          const reach = [g.guardian, g.sentinel, ...walkableNeighbours(g.guardian, g.walls)].map(cellKey);
          const around = new Set([...g.walls, ...reach]);
          around.delete(cellKey(g.player));
          for (const goal of goals) {
            around.delete(cellKey(goal));
            const route = pathBetween(g.player, goal, around) ?? pathBetween(g.player, goal, g.walls);
            if (route && (!best || route.length < best.length)) best = route;
          }
        }
        if (!best || best.length < 2) return "stuck";
        run.stepTo(best[1]);
      }
      trace.push(snapshot(run.state));
    }
    return "budget";
  };
  const play = (rev) => {
    const runtime = loadRouteRuntime({ rev });
    const out = [];
    for (const routeNumber of [1, 2, 3]) {
      for (const difficulty of DIFFICULTIES) {
        for (const policy of ["win", "lose", "pickaxe"]) {
          for (const seedOffset of [0, 1]) {
            const seed = 7000 + routeNumber * 100 + DIFFICULTIES.indexOf(difficulty) * 10 + seedOffset;
            const run = runtime.mount({ seed, routeNumber, difficulty });
            const trace = [snapshot(run.state)];
            const end = drive(run, policy, trace);
            const completions = JSON.parse(JSON.stringify(run.completions));
            // The same session again: a restart and a mode change both generate on the stream the Hunter has been
            // drawing from, so any drift in either half shows up here.
            run.restart();
            trace.push(snapshot(run.state));
            drive(run, policy, trace, 12);
            run.changeDifficulty(DIFFICULTIES[(DIFFICULTIES.indexOf(difficulty) + 1) % 3]);
            trace.push(snapshot(run.state));
            // And the next Route, opened the only way the product opens it.
            let next = null;
            const continuation = completions.at(-1)?.continuation;
            if (continuation) {
              const nextRun = runtime.mount({ seed: seed + 1, routeNumber: continuation.routeNumber, difficulty: continuation.difficulty, initialDifficulty: continuation.difficulty });
              const nextTrace = [snapshot(nextRun.state)];
              drive(nextRun, policy, nextTrace, 12);
              next = nextTrace;
            }
            out.push({ routeNumber, difficulty, policy, seed, end, steps: trace.length, trace, completions, next });
          }
        }
      }
    }
    return out;
  };
  const now = play(REV);
  const base = play(BASELINE);
  const diffs = now
    .map((r, i) => {
      if (same(r, base[i])) return null;
      const step = r.trace.findIndex((s, j) => !same(s, base[i].trace[j]));
      return `${r.routeNumber}/${r.difficulty}/${r.policy}/${r.seed}@${step}`;
    })
    .filter(Boolean);
  const ends = {};
  for (const r of now) ends[`${r.policy}:${r.end}`] = (ends[`${r.policy}:${r.end}`] ?? 0) + 1;
  const steps = now.reduce((sum, r) => sum + r.steps + (r.next?.length ?? 0), 0);
  const wins = now.filter((r) => r.completions.some((c) => c.details?.won)).length;
  const losses = now.filter((r) => r.completions.some((c) => c.details && !c.details.won)).length;
  const pickaxes = now.filter((r) => r.trace.some((s) => s.chest[4] !== null)).length;
  record(
    "E6",
    "equivalence",
    "RUNTIME_GAMES_IDENTICAL_STEP_BY_STEP",
    diffs.length === 0 && now.length === 54 && wins > 0 && losses > 0 && pickaxes > 0 && now.some((r) => r.next),
    { runs: now.length, stepsCompared: steps, ends, wins, losses, pickaxeWallsBroken: pickaxes, nextRoutesOpened: now.filter((r) => r.next).length, digest: sha(now), diffs },
  );
}

// =================================================================================================
// [structure] + [preserved] — the C0 instrumentation follows the code
// =================================================================================================

// N1 — the instrumented generator (C0) rewrote isStructurallyValid / isValidMap in route-generation.ts, by itself.
{
  const instrumentedIn = (lab) =>
    lab.graph
      .modules()
      .map((m) => m.file)
      .filter((file) => {
        const text = lab.graph.compiledSource(file) ?? "";
        return text.includes("__structuralReason") || text.includes("__finalGates");
      });
  const now = instrumentedIn(NOW_LAB);
  record("N1", "structure", "INSTRUMENTATION_LANDS_IN_ROUTE_GENERATION", same(now, [ROUTE_GENERATION]), {
    instrumentedModules: now,
    baseline: instrumentedIn(BASE_LAB),
  });
}

// N2 — every textual anchor the validators aim at the generator (final-acceptance's gates, escape-generation-close's
// fixes, test-star-selection's search) is found once in the graph, in route-generation.ts — and the C1 budget anchor
// still in route-config.ts.
{
  const anchors = {
    "isValidMap return": "  return (\n    alternativeRoute &&",
    "structural success": "  return { blocks, objective };",
    "early guard": "  if (!escapeGeometryIsPossible(PLAYER_START, exitPosition, walls, blocks)) {\n    return null;\n  }",
    "admissible retry": "  const admissible = admissibleRouteCells(playerStart, exitPosition, walls, blocks);\n  return (",
    "star search": "  const ordered = candidates.map((candidate) => candidate.pos);",
    "analysis guard": "  if (!analysis) return null;",
    "gate 13": "  if (!collectibleStars.every((star) => sharesBlock(blocks, PLAYER_START, star))) {",
    "random phase": "  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {",
    "recovery sweep": "  for (let round = 0; round < RECOVERY_ROUNDS; round++) {",
    "throw": "Route map generation failed all gates for stage",
  };
  const located = Object.fromEntries(Object.entries(anchors).map(([name, anchor]) => [name, errorOf(() => TREE.locate(anchor)) ?? TREE.locate(anchor)]));
  const capFile = errorOf(() => TREE.declaring("MAX_GENERATION_ATTEMPTS")) ?? TREE.declaring("MAX_GENERATION_ATTEMPTS");
  record(
    "N2",
    "structure",
    "VALIDATOR_ANCHORS_FOLLOW_THE_CODE",
    Object.values(located).every((file) => file === ROUTE_GENERATION) && capFile === ROUTE_CONFIG,
    { located, budgetDeclaredIn: capFile },
  );
}

// N3 — the instrumented loader explains the same way: 18 structural reasons and 23 final gates, the same names in the
// same order; bare mode generates the instrumented mode's maps; replayGeneration still mirrors generateMaze.
{
  const nowBare = loadInstrumented({ rev: REV, bare: true });
  const fidelity = [];
  for (const [stage, difficulty, seed] of [[1, "easy", 3], [2, "medium", 5], [3, "hard", 8], [3, "hard", 13], [2, "easy", 21], [1, "hard", 34]]) {
    const map = (lab, how) => {
      lab.setSeed(seed);
      const m = how === "replay" ? lab.replayGeneration({ difficulty, stage, capture: false }).map : lab.API.generateMaze(difficulty, stage);
      return sha([[...m.walls].sort(), m.guardianStart, m.exitPosition, m.collectibleStars, m.traps, m.chest]);
    };
    const maps = [map(NOW_LAB, "generate"), map(NOW_LAB, "replay"), map(nowBare, "generate"), map(nowBare, "replay"), map(BASE_LAB, "generate")];
    fidelity.push(new Set(maps).size === 1);
  }
  record(
    "N3",
    "preserved",
    "INSTRUMENTED_LOADER_UNCHANGED",
    NOW_LAB.structuralReasons.length === 18 && NOW_LAB.finalGateNames.length === 23 &&
      same(NOW_LAB.structuralReasons, BASE_LAB.structuralReasons) && same(NOW_LAB.finalGateNames, BASE_LAB.finalGateNames) &&
      fidelity.every(Boolean) && nowBare.structuralReasons.length === 0,
    {
      structuralReasons: NOW_LAB.structuralReasons.length,
      finalGates: NOW_LAB.finalGateNames.length,
      sameAsBaseline: same(NOW_LAB.structuralReasons, BASE_LAB.structuralReasons) && same(NOW_LAB.finalGateNames, BASE_LAB.finalGateNames),
      generateEqualsReplayEqualsBareEqualsBaseline: `${fidelity.filter(Boolean).length}/${fidelity.length}`,
    },
  );
}

// =================================================================================================

const failing = tests.filter((t) => !t.pass).map((t) => t.id);
const tally = (kind) => {
  const of = tests.filter((t) => t.kind === kind);
  return `${of.filter((t) => t.pass).length}/${of.length}`;
};
console.log(
  `\n${REV ? `rev ${TREE.rev.slice(0, 12)} · ` : ""}${tests.length - failing.length}/${tests.length} passed · structure ${tally("structure")} · ` +
    `preserved ${tally("preserved")} · equivalence ${tally("equivalence")} · failing: ${failing.join(", ") || "none"}`,
);
process.exitCode = failing.length ? EXIT_VALIDATION_FAILED : EXIT_OK;
