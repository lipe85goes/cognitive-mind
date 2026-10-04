/**
 * ROUTE-C3 — the defenders' policy, extracted out of `useEscapeMaze.ts`, tested.
 *
 *   src/games/escape-maze/route-defenders.ts   how the two defenders decide:
 *                                               the portal zone, the Sentinel's
 *                                               post and its contract-c3 move,
 *                                               the Hunter's trap-aware move,
 *                                               and their constants.
 *
 * The turn that asks them (`runDefenderPhase`: commit, Second Chance rollback,
 * capture, messages, stats) stays in the hook; so did the dynamic invariants,
 * until ROUTE-C4 moved them to route-invariants.ts
 * (route-invariants-extraction-tests.mjs holds that move). C3 is a pure
 * refactor: the declarations moved, nothing they decide did. Four groups of
 * checks hold it to that:
 *
 *   [structure]    WHERE the code lives, and the static gate against it
 *                  drifting back: every moved binding is declared in
 *                  route-defenders.ts and nowhere else in `src/`; the hook
 *                  declares none of it (not even as text), imports exactly
 *                  what route-defenders exports, and no longer touches the RNG
 *                  itself; route-defenders imports only configuration,
 *                  geometry, the difficulty helpers, the RNG seam and types
 *                  (`MazeMap` as a type only) — never React, the hook, UI,
 *                  Babylon or sounds; the Rota's run-time graph has no cycle
 *                  and generation does not reach the defenders; the C0 surface,
 *                  the instrumented generator, the runtime harness and every
 *                  validator anchor on the defenders find them in
 *                  route-defenders.ts.
 *   [preserved]    what must not have changed: every moved declaration
 *                  (comments included) and their order is the baseline's text,
 *                  only `export` added; every remaining hook statement is the
 *                  baseline's text and none other went missing (what C4 moved
 *                  on to route-invariants.ts aside); the whole
 *                  `useEscapeMaze` body — runDefenderPhase, the step, the
 *                  reward, the wall, Second Chance — is byte for byte the
 *                  baseline's; the turn is still in the hook; the
 *                  hook's public surface (types and values, parser and run
 *                  time) is the baseline's, `chooseGuardianMove` still is not
 *                  part of it, and every other Rota module is untouched.
 *   [equivalence]  the working tree against de8c94e (C2, defenders still in
 *                  the hook), both loaded through route-module-loader: the
 *                  Sentinel over a corpus of states (zones, posts, leash,
 *                  horizon, commitment, re-aim, traps that cut the held door,
 *                  custom commit lengths); the Sentinel against
 *                  dual-guardian-lab contract c3, FEINT and ROLE; the Hunter on
 *                  every branch (easy's 0.45 random branch, easy/medium/hard
 *                  fallbacks, ties, portal and trap and Sentinel blocking the
 *                  preferred move, no alternative) with the number of draws
 *                  and the next draws of the shared stream after every
 *                  decision; whole chains of turns with generation before and
 *                  after, seeded and armed; the trap contract; Second Chance
 *                  captured by the Hunter, by the Sentinel and by the
 *                  Explorer's own step, rollback and charge; real Routes on
 *                  every mode and Route 1/2/3 played by the real hook, step by
 *                  step.
 *
 * `--rev=<commit>` runs every check on that tree instead of the working tree.
 * `--rev=de8c94e` is the structural counterfactual: the defenders still lived
 * in useEscapeMaze.ts there, so every [structure] check must fail, while every
 * [preserved] and [equivalence] check holds (same code, same behaviour).
 *
 * Usage: node tools/validation/route-defenders-extraction-tests.mjs [--rev=<commit>]
 * Writes nothing. Exit 0 = every check holds, 1 = a check failed, 3 = usage error.
 */
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";
import { portalZone, sentinelStep } from "./dual-guardian-lab.mjs";
import { loadInstrumented, routeModuleDeclaring } from "./instrumented-generator.mjs";
import {
  INTERNALS_EXPORT,
  ROUTE_HOOK,
  ROUTE_MODULE_DIR,
  ROUTE_RANDOM_SEAM,
  loadRouteModules,
  openSourceTree,
} from "./route-module-loader.mjs";
import { cellKey, loadRouteRuntime, pathBetween, walkableNeighbours } from "./route-runtime-harness.mjs";

/** C2: the last revision whose defenders lived in the hook — what C3 must be equivalent to. */
const BASELINE = "de8c94e6e4500748383c03851ef4499b0f950fcf";
const ROUTE_DEFENDERS = "src/games/escape-maze/route-defenders.ts";
const ROUTE_GENERATION = "src/games/escape-maze/route-generation.ts";
const ROUTE_GEOMETRY = "src/games/escape-maze/route-geometry.ts";
const ROUTE_CONFIG = "src/games/escape-maze/route-config.ts";
const DIFFICULTY = "src/engine/difficulty.ts";
/** Every Rota file C3 must not have touched, product consumers included. */
const UNTOUCHED = [
  ROUTE_CONFIG, ROUTE_GEOMETRY, ROUTE_GENERATION, ROUTE_RANDOM_SEAM, DIFFICULTY,
  "src/games/escape-maze/continuation.ts", "src/games/escape-maze/RouteStrategyGame.tsx",
  "src/games/escape-maze/RouteBabylonBoard.tsx", "src/games/escape-maze/routeBabylonScene.ts", "src/types/game.ts",
];
/** The hook's real consumers in the product. */
const CONSUMERS = ["src/games/escape-maze/RouteStrategyGame.tsx", "src/games/escape-maze/RouteBabylonBoard.tsx"];

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
if (args.some((arg) => arg !== revArg) || REV === "") {
  console.error("usage: node tools/validation/route-defenders-extraction-tests.mjs [--rev=<commit>]");
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

// --- what C3 moved -------------------------------------------------------------------------------

/** The Sentinel's and the Hunter's policy and constants, in the order they were declared in the hook. */
const MOVED_VALUES = [
  "PORTAL_ZONE_RADIUS", "SENTINEL_LEASH", "SENTINEL_THREAT_HORIZON", "SENTINEL_COMMIT_TURNS",
  "computePortalDefenceZone", "createSentinelState", "decideSentinelMove", "EMPTY_BLOCKED", "chooseGuardianMove",
];
const MOVED_TYPES = ["PortalDefenceZone", "SentinelState"];
const MOVED = [...MOVED_VALUES, ...MOVED_TYPES];
/**
 * What route-defenders exports: exactly what the hook consumes. `SENTINEL_COMMIT_TURNS` because runDefenderPhase
 * passes it (its text is unchanged); `chooseGuardianMove` because runDefenderPhase calls it — but the hook does not
 * re-export it, so it is still no part of the product's surface.
 */
const DEFENDERS_EXPORTS = [
  "PortalDefenceZone", "SENTINEL_COMMIT_TURNS", "SentinelState", "chooseGuardianMove", "computePortalDefenceZone",
  "createSentinelState", "decideSentinelMove",
].sort();
/** What the hook re-exports of them, exactly as it exported them at the baseline. */
const HOOK_REEXPORTS = ["PortalDefenceZone", "SentinelState", "computePortalDefenceZone", "createSentinelState", "decideSentinelMove"];

/**
 * Left in the hook on purpose: input, chest copy and the turn itself (runDefenderPhase lives in useEscapeMaze). The
 * dynamic invariants were here at C3 too; ROUTE-C4 moved them on, with the state's vocabulary their snapshot is
 * written in, to route-invariants.ts — see C4_MOVED below.
 */
const KEPT_IN_HOOK_VALUES = [
  "ARROW_DELTAS", "BREAK_DIRECTION_DELTAS", "MOVE_INPUT_GUARD_MS",
  "SECOND_CHANCE_EXPLORER_MESSAGE", "SECOND_CHANCE_DEFENDER_MESSAGE", "useEscapeMaze",
];
const KEPT_IN_HOOK_TYPES = ["BreakDirection", "BreakTarget", "CompleteFn", "DefenderPhaseInput"];
/**
 * What ROUTE-C4 moved out of the hook after C3: they may be missing from the hook only where route-invariants.ts
 * declares them (route-invariants-extraction-tests.mjs holds the move itself — verbatim, against C3's head).
 */
const ROUTE_INVARIANTS = "src/games/escape-maze/route-invariants.ts";
const C4_MOVED = ["GameStatus", "ChestReward", "DynamicMazeStateSnapshot", "DynamicSolvabilityInspection", "inspectDynamicMazeState"];

/** What route-defenders may import. `route-generation` for the `MazeMap` type, and only as a type. */
const ALLOWED_IMPORTS = [
  "@/engine/difficulty", "@/engine/route-random", "@/games/escape-maze/route-config",
  "@/games/escape-maze/route-generation", "@/games/escape-maze/route-geometry", "@/types/game",
];
const TYPE_ONLY_IMPORTS = ["@/games/escape-maze/route-generation", "@/types/game"];
const FORBIDDEN_IMPORT = /react|useEscapeMaze|babylon|game-sounds|scoring|components\/|RewardResultModal|GameScreen|RouteStrategyGame|\.tsx$|^@\/app\//i;

const DIFFICULTIES = ["easy", "medium", "hard"];
const STAGES = [1, 2, 3];

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

const TREE = openSourceTree({ rev: REV });
const BASE_TREE = openSourceTree({ rev: BASELINE });
const label = REV ? `rev ${TREE.rev.slice(0, 12)}` : "working tree";
console.log(`route-defenders extraction · ${label} vs baseline ${BASELINE.slice(0, 7)} (defenders in the hook)\n`);

const parse = (file, source) =>
  ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const isExported = (node) => (ts.getModifiers?.(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);

/** Top-level declarations of a module, by the parser, with each statement's text (leading comments included). */
function declarations(file, source) {
  const sf = parse(file, source);
  const out = { values: [], types: [], exported: [], imports: [], statements: [], named: [], text: new Map(), span: new Map() };
  const keep = (name, statement) => {
    out.text.set(name, statement.getFullText(sf).trim());
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
        out.exported.push(...statement.exportClause.elements.map((e) => e.name.text));
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
const defendersExists = TREE.exists(ROUTE_DEFENDERS);
const defendersText = read(TREE, ROUTE_DEFENDERS);
const defenders = declarations(ROUTE_DEFENDERS, defendersText);
const baseHookText = BASE_TREE.read(ROUTE_HOOK);
const baseHook = declarations(ROUTE_HOOK, baseHookText);
const closure = TREE.closure(ROUTE_HOOK);
const owners = Object.fromEntries(
  MOVED_VALUES.map((name) => [name, errorOf(() => TREE.declaring(name, { within: "src/" })) ?? TREE.declaring(name, { within: "src/" })]),
);
const typeOwner = (name) => (defenders.types.includes(name) ? ROUTE_DEFENDERS : hook.types.includes(name) ? ROUTE_HOOK : null);
const resolvesTo = (from, specifier) => errorOf(() => TREE.resolve(specifier, from)) ?? TREE.resolve(specifier, from);

// =================================================================================================
// [structure]
// =================================================================================================

// S1 — every moved binding is declared in route-defenders.ts, and nowhere else in the Rota's graph; the types too.
{
  const misplaced = MOVED_VALUES.filter((name) => owners[name] !== ROUTE_DEFENDERS);
  const typesMisplaced = MOVED_TYPES.filter((name) => typeOwner(name) !== ROUTE_DEFENDERS);
  record(
    "S1",
    "structure",
    "DEFENDER_POLICY_LIVES_IN_ROUTE_DEFENDERS",
    defendersExists && closure.includes(ROUTE_DEFENDERS) && misplaced.length === 0 && typesMisplaced.length === 0,
    {
      inHookGraph: closure.includes(ROUTE_DEFENDERS),
      declaredIn: Object.fromEntries(MOVED_VALUES.map((name) => [name, owners[name]?.startsWith?.("route-module-loader") ? "?" : owners[name]])),
      typesDeclaredIn: Object.fromEntries(MOVED_TYPES.map((name) => [name, typeOwner(name)])),
    },
  );
}

// S2 — the static gate: the hook declares none of it (values or types), not even as declaration text.
{
  const redeclared = MOVED.filter((name) => hook.values.includes(name) || hook.types.includes(name));
  // Everything but the import/export header, where `type SentinelState` legitimately names the imported type.
  const hookCode = codeOnly(hook.statements.join("\n"));
  const declarationText = MOVED.filter((name) =>
    new RegExp(String.raw`\b(?:function|const|let|var|interface|type|class)\s+${name}\b`).test(hookCode),
  );
  record("S2", "structure", "HOOK_DECLARES_NONE_OF_IT", redeclared.length === 0 && declarationText.length === 0, {
    redeclaredInHook: redeclared,
    declarationTextInHook: declarationText,
  });
}

// S3 — the hook asks route-defenders: one import, exactly what route-defenders exports; runDefenderPhase's two calls go
// to those imports; the hook no longer draws, picks or predicts itself (no RNG, no getPredatorNextPosition).
{
  const fromDefenders = hook.imports.filter((imp) => resolvesTo(ROUTE_HOOK, imp.specifier) === ROUTE_DEFENDERS);
  const imported = sorted(fromDefenders.flatMap((imp) => imp.names));
  const exported = sorted(defenders.exported);
  const hookCode = codeOnly(hookText);
  const rngInHook = ["routeRandom", "randomItem", "getPredatorNextPosition", "Math.random", "@/engine/route-random"].filter((name) =>
    hookCode.includes(name),
  );
  const calls = {
    chooseGuardianMove: (hookCode.match(/\bchooseGuardianMove\(/g) ?? []).length,
    decideSentinelMove: (hookCode.match(/\bdecideSentinelMove\(/g) ?? []).length,
  };
  record(
    "S3",
    "structure",
    "HOOK_IMPORTS_THE_DEFENDERS",
    fromDefenders.length === 1 && same(imported, DEFENDERS_EXPORTS) && same(exported, DEFENDERS_EXPORTS) &&
      rngInHook.length === 0 && calls.chooseGuardianMove === 1 && calls.decideSentinelMove === 1,
    {
      importDeclarations: fromDefenders.map((imp) => imp.specifier),
      hookImports: imported,
      routeDefendersExports: exported,
      rngStillInHook: rngInHook,
      callsInHook: calls,
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

// S4 — dependency rule: route-defenders imports only the allowed modules (route-generation and types as types only),
// nothing forbidden, mentions no browser/React/RNG-global; it reaches neither the hook nor generation at run time; no
// Rota module below it (config, geometry, generation, the seam, difficulty) reaches it — generation does not depend on
// the defenders even by type; and the whole run-time graph of the hook is acyclic.
{
  const decl = defenders;
  const specifiers = decl.imports.map((imp) => imp.specifier);
  const notAllowed = specifiers.filter((spec) => !ALLOWED_IMPORTS.includes(spec));
  const forbidden = specifiers.filter((spec) => FORBIDDEN_IMPORT.test(spec));
  const notTypeOnly = decl.imports.filter((imp) => TYPE_ONLY_IMPORTS.includes(imp.specifier) && !imp.typeOnly).map((imp) => imp.specifier);
  const code = codeOnly(defendersText);
  const mentions = ["use client", "window", "document", "Math.random", "useState", "useEffect", "useMemo", "BABYLON", "localStorage"].filter((word) =>
    code.includes(word),
  );
  const reach = defendersExists ? TREE.closure(ROUTE_DEFENDERS) : [];
  const below = [ROUTE_CONFIG, ROUTE_GEOMETRY, ROUTE_GENERATION, ROUTE_RANDOM_SEAM, DIFFICULTY];
  const reachDefenders = below.filter((file) => TREE.exists(file) && TREE.closure(file).includes(ROUTE_DEFENDERS));
  const generationNamesDefenders = /route-defenders/.test(read(TREE, ROUTE_GENERATION));
  const edges = runtimeEdges(TREE, closure);
  const cycle = findCycle(edges);
  record(
    "S4",
    "structure",
    "ROUTE_DEFENDERS_IS_PURE_AND_ACYCLIC",
    defendersExists && notAllowed.length === 0 && forbidden.length === 0 && notTypeOnly.length === 0 && mentions.length === 0 &&
      !reach.includes(ROUTE_HOOK) && !reach.includes(ROUTE_GENERATION) && reachDefenders.length === 0 &&
      !generationNamesDefenders && cycle === null && (edges[ROUTE_HOOK] ?? []).includes(ROUTE_DEFENDERS),
    {
      imports: decl.imports.map((imp) => `${imp.specifier}${imp.typeOnly ? " (type)" : ""}`),
      notAllowed,
      forbidden,
      shouldBeTypeOnly: notTypeOnly,
      mentions,
      runtimeReach: reach,
      modulesBelowThatReachIt: reachDefenders,
      generationNamesDefenders,
      cycle,
      rotaRuntimeGraph: Object.fromEntries(Object.entries(edges).map(([file, to]) => [file.replace(ROUTE_MODULE_DIR, ""), to.map((t) => t.replace(ROUTE_MODULE_DIR, ""))])),
    },
  );
}

// S5 — no residual duplication: across every source module of the repository, each moved name is declared exactly
// once — in route-defenders.ts — and the body of each moved function and constant exists exactly once.
{
  const srcFiles = (
    REV
      ? execFileSync("git", ["ls-tree", "-r", "--name-only", TREE.rev, "src"], { encoding: "utf8" })
      : execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "src"], { encoding: "utf8" })
  )
    .split("\n")
    .filter((file) => /\.(ts|tsx)$/.test(file) && TREE.exists(file));
  const declaredBy = Object.fromEntries(MOVED.map((name) => [name, []]));
  const bodies = new Map();
  const texts = srcFiles.map((file) => ({ file, text: TREE.read(file) }));
  for (const { file, text } of texts) {
    const decl = declarations(file, text);
    for (const name of MOVED) if (decl.values.includes(name) || decl.types.includes(name)) declaredBy[name].push(file);
    for (const name of MOVED) {
      if (decl.text.has(name)) bodies.set(name, unexported(decl.text.get(name)).replace(/^[\s\S]*?(?=(?:function|const|interface) )/, ""));
    }
  }
  const notOnce = Object.entries(declaredBy).filter(([, files]) => files.length !== 1 || files[0] !== ROUTE_DEFENDERS);
  const bodyCopies = [...bodies].map(([name, body]) => [name, texts.reduce((sum, { text }) => sum + (unexported(text).split(body).length - 1), 0)]);
  const copied = bodyCopies.filter(([, count]) => count !== 1);
  record("S5", "structure", "NO_RESIDUAL_DUPLICATION", notOnce.length === 0 && copied.length === 0 && bodies.size === MOVED.length, {
    sourceModulesScanned: srcFiles.length,
    notDeclaredOnceInRouteDefenders: Object.fromEntries(notOnce),
    bodiesFound: bodies.size,
    bodiesNotExactlyOnce: Object.fromEntries(copied),
  });
}

// =================================================================================================
// [preserved] — the text
// =================================================================================================

// P1 — every moved declaration, wherever it is declared now, is the baseline's text, leading comments included (the
// portal-sentinel header travels with PORTAL_ZONE_RADIUS); and the whole block, from that header to the end of
// chooseGuardianMove, is the baseline's block verbatim — same order, nothing inserted. Only `export` was added.
{
  const homeOf = (name) =>
    MOVED_TYPES.includes(name) ? typeOwner(name) : owners[name]?.startsWith?.("src/") ? owners[name] : null;
  const changed = MOVED.filter((name) => {
    const before = baseHook.text.get(name);
    const where = homeOf(name);
    return !before || !where || !unexported(read(TREE, where)).includes(unexported(before));
  });
  const first = baseHook.span.get(MOVED_VALUES[0]);
  const last = baseHook.span.get("chooseGuardianMove");
  const baseBlock = unexported(baseHookText.slice(first.start, last.end).trim());
  const blockHome = homeOf("chooseGuardianMove");
  const blockVerbatim = Boolean(blockHome) && unexported(read(TREE, blockHome)).includes(baseBlock);
  // The added `export`s are exactly the bindings the hook imports, nothing else.
  const addedExports = defendersExists
    ? MOVED.filter((name) => defenders.exported.includes(name) && !baseHook.exported.includes(name))
    : [];
  record(
    "P1",
    "preserved",
    "MOVED_DECLARATIONS_ARE_VERBATIM",
    changed.length === 0 && blockVerbatim && (!defendersExists || same(sorted(addedExports), ["SENTINEL_COMMIT_TURNS", "chooseGuardianMove"])),
    {
      declarationsCompared: MOVED.length,
      textChanged: changed,
      blockLines: baseBlock.split("\n").length,
      blockVerbatimIn: blockVerbatim ? blockHome : null,
      exportAddedTo: addedExports,
    },
  );
}

// P2 — the hook's remaining code is the baseline's text: its statements (everything but the import/export header) are
// exactly the baseline's statements minus the moved ones, in the same order, each byte for byte. ROUTE-C4's names are
// "moved on" only where route-invariants.ts declares them and the hook no longer does.
{
  const movedHere = (name) => MOVED.includes(name) && (MOVED_TYPES.includes(name) ? typeOwner(name) : owners[name]) !== ROUTE_HOOK;
  const invariantsDecl = declarations(ROUTE_INVARIANTS, read(TREE, ROUTE_INVARIANTS));
  const movedOnByC4 = (name) =>
    C4_MOVED.includes(name) && !hook.values.includes(name) && !hook.types.includes(name) &&
    (invariantsDecl.values.includes(name) || invariantsDecl.types.includes(name));
  const expected = baseHook.named.filter((entry) => !movedHere(entry.name) && !movedOnByC4(entry.name)).map((entry) => entry.text);
  const now = hook.named.map((entry) => entry.text);
  const extra = now.filter((text) => !expected.includes(text));
  const missing = expected.filter((text) => !now.includes(text));
  const firstLine = (text) => text.split("\n").find((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))?.slice(0, 80);
  record("P2", "preserved", "HOOK_OTHERWISE_UNCHANGED", same(now, expected), {
    hookStatements: now.length,
    baselineStatements: baseHook.named.length,
    removed: baseHook.named.filter((entry) => movedHere(entry.name)).map((entry) => entry.name),
    movedOnByC4: baseHook.named.filter((entry) => movedOnByC4(entry.name)).map((entry) => entry.name),
    notInBaseline: extra.map(firstLine),
    missingFromHook: missing.map(firstLine),
  });
}

// P3 — the turn stays in the hook, untouched: the whole `useEscapeMaze` body (runDefenderPhase with its Hunter-then-
// Sentinel order, the step, the reward, the wall, Second Chance and its rollback) is the baseline's text; runDefenderPhase
// is declared there once; the invariants (in the hook at C3, in route-invariants.ts since C4) never reached
// route-defenders.
{
  const missing = [...KEPT_IN_HOOK_VALUES.filter((n) => !hook.values.includes(n)), ...KEPT_IN_HOOK_TYPES.filter((n) => !hook.types.includes(n))];
  const changed = [...KEPT_IN_HOOK_VALUES, ...KEPT_IN_HOOK_TYPES].filter((n) => hook.text.get(n) !== baseHook.text.get(n));
  const body = hook.text.get("useEscapeMaze") ?? "";
  const phase = (body.match(/const runDefenderPhase = \(input: DefenderPhaseInput\) => \{/g) ?? []).length;
  const order = body.indexOf("const nextGuardian = chooseGuardianMove(") < body.indexOf("const nextSentinel = decideSentinelMove(");
  // Code only: route-defenders' header may name the turn it serves, it may not contain it.
  const leakedToDefenders = ["inspectDynamicMazeState", "DynamicMazeStateSnapshot", "DynamicSolvabilityInspection", "runDefenderPhase", "useEscapeMaze", "SECOND_CHANCE", "setRewardSpent"].filter(
    (name) => codeOnly(defendersText).includes(name),
  );
  record(
    "P3",
    "preserved",
    "TURN_ORCHESTRATION_STAYS_IN_THE_HOOK",
    missing.length === 0 && changed.length === 0 && phase === 1 && order && leakedToDefenders.length === 0,
    {
      kept: KEPT_IN_HOOK_VALUES.length + KEPT_IN_HOOK_TYPES.length,
      missingFromHook: missing,
      textChanged: changed,
      useEscapeMazeBody: sha(body),
      runDefenderPhaseDeclarations: phase,
      hunterBeforeSentinel: order,
      leakedToRouteDefenders: leakedToDefenders,
    },
  );
}

// P4 — the hook's public surface, by the parser (values and types, declared or re-exported), is the baseline's: the five
// defender names are still exported from it, `chooseGuardianMove` still is not; the product's consumers still find every
// name and are unchanged.
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
    same(exportsNow, exportsBase) && HOOK_REEXPORTS.every((name) => exportsNow.includes(name)) && !exportsNow.includes("chooseGuardianMove") &&
      consumers.every((c) => c.missing.length === 0 && c.unchanged),
    { hookExports: exportsNow, defenderNamesExported: HOOK_REEXPORTS.filter((name) => exportsNow.includes(name)), consumers },
  );
}

// P5 — nothing else in the Rota moved: config, geometry, generation, the RNG seam, difficulty, continuation, the
// product's Rota component, board and scene are byte for byte the baseline's.
{
  const touched = UNTOUCHED.filter((file) => read(TREE, file) !== read(BASE_TREE, file));
  record("P5", "preserved", "EVERY_OTHER_ROTA_MODULE_UNTOUCHED", touched.length === 0, { compared: UNTOUCHED.length, touched });
}

// =================================================================================================
// load both Rotas
// =================================================================================================

const SURFACE = [
  ...MOVED_VALUES, "generateMaze", "posKey", "positionsEqual", "getNeighbors", "getReachableDistances", "findPathLength",
  "inspectDynamicMazeState",
];
const NOW = loadRouteModules({ rev: REV, surface: SURFACE });
const BASE = loadRouteModules({ rev: BASELINE, surface: SURFACE });
for (const rota of [NOW, BASE]) rota.difficulty = rota.graph.require(DIFFICULTY);

/** Counts every draw the sandbox's Math makes — with no seed armed, every `routeRandom()` is one. */
function countDraws(rota) {
  let draws = 0;
  const inner = rota.seededMath.random;
  rota.seededMath.random = () => {
    draws += 1;
    return inner();
  };
  return { reset: () => (draws = 0), get: () => draws };
}
NOW.draws = countDraws(NOW);
BASE.draws = countDraws(BASE);
const nextDraws = (rota, n = 3) => Array.from({ length: n }, () => rota.routeRandom.routeRandom());

// P6 — at run time: the same export names as the baseline, and the hook's computePortalDefenceZone /
// createSentinelState / decideSentinelMove ARE the functions that decide (a re-export, not a copy); the constants the
// validators read are the baseline's values.
{
  const keys = (rota) => sorted(Object.keys(rota.hook).filter((k) => k !== INTERNALS_EXPORT));
  const identity = Object.fromEntries(
    ["computePortalDefenceZone", "createSentinelState", "decideSentinelMove"].map((name) => [name, NOW.hook[name] === NOW.api[name]]),
  );
  const constants = (rota) => ["PORTAL_ZONE_RADIUS", "SENTINEL_LEASH", "SENTINEL_THREAT_HORIZON", "SENTINEL_COMMIT_TURNS"].map((n) => rota.api[n]);
  const emptyBlocked = NOW.api.EMPTY_BLOCKED instanceof NOW.sandbox.Set && NOW.api.EMPTY_BLOCKED.size === 0;
  record(
    "P6",
    "preserved",
    "RUNTIME_SURFACE_UNCHANGED_AND_SHARED",
    same(keys(NOW), keys(BASE)) && Object.values(identity).every(Boolean) && !("chooseGuardianMove" in NOW.hook) &&
      same(constants(NOW), [2, 2, 6, 3]) && same(constants(NOW), constants(BASE)) && emptyBlocked,
    { runtimeExports: keys(NOW), sameFunctionThroughTheHook: identity, constants: constants(NOW), emptyBlockedIsEmptySet: emptyBlocked },
  );
}

// =================================================================================================
// [equivalence]
// =================================================================================================

/** The same maps on both trees, seeded per map as final-acceptance's FASE 1 — generation is not what C3 moved. */
function corpus(perCombination) {
  const maps = [];
  for (const stage of STAGES) {
    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < perCombination; i += 1) {
        const seed = 3_300_000 + stage * 10_000 + DIFFICULTIES.indexOf(difficulty) * 1000 + i;
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
const MAPS = corpus(10);
const mapDigest = (rota, map) => sha([[...map.walls].sort(), map.playerStart, map.guardianStart, map.exitPosition, map.collectibleStars, map.traps, map.chest]);
const mapsAgree = MAPS.every((m) => mapDigest(NOW, m.now) === mapDigest(BASE, m.base));
const walkableOf = (walls) => {
  const cells = [];
  for (let row = 0; row < 9; row += 1) for (let col = 0; col < 9; col += 1) if (!walls.has(`${row},${col}`)) cells.push({ row, col });
  return cells;
};
const toSet = (rota, keys) => new rota.sandbox.Set(keys);
const stateOut = (s) => ({ position: cellKey(s.position), target: s.target ? cellKey(s.target) : null, commitLeft: s.commitLeft });

// E1 — the Sentinel's policy over a corpus of states, both trees given the same inputs: the portal zone (base board and
// one wall opened, as the Pickaxe does), the starting post (and its throw), and decideSentinelMove from any post — in
// and out of the zone, past the leash —, any held door or none, any commitment, near and far Explorers, armed traps or
// arbitrary blocked cells (including the ones that cut the held door), the default and other commit lengths.
{
  const diffs = [];
  const coverage = {};
  let decisions = 0;
  let zones = 0;
  const digest = crypto.createHash("sha256");
  for (const m of MAPS) {
    const rand = prng(m.seed);
    const internalWalls = [...m.now.walls].sort();
    const variants = [null, pick(rand, internalWalls), pick(rand, internalWalls)];
    for (const opened of variants) {
      const wallsOf = (rota, map) => {
        if (opened === null) return map.walls;
        const walls = new rota.sandbox.Set(map.walls);
        walls.delete(opened);
        return walls;
      };
      const wNow = wallsOf(NOW, m.now);
      const wBase = wallsOf(BASE, m.base);
      const zNow = NOW.api.computePortalDefenceZone(m.now.playerStart, m.now.exitPosition, wNow);
      const zBase = BASE.api.computePortalDefenceZone(m.base.playerStart, m.base.exitPosition, wBase);
      const zoneOut = (z) => ({ zone: z.zone.map(cellKey), keys: [...z.zoneKeys], accesses: z.accesses.map(cellKey) });
      zones += 1;
      if (!same(zoneOut(zNow), zoneOut(zBase))) diffs.push({ seed: m.seed, opened, field: "zone" });
      const postNow = stateOut(NOW.api.createSentinelState(m.now, zNow));
      const postBase = stateOut(BASE.api.createSentinelState(m.base, zBase));
      if (!same(postNow, postBase)) diffs.push({ seed: m.seed, opened, field: "post" });
      digest.update(JSON.stringify([zoneOut(zNow), postNow]));

      const cells = walkableOf(wNow).filter((c) => !(c.row === m.now.exitPosition.row && c.col === m.now.exitPosition.col));
      const accesses = zNow.accesses.map(cellKey);
      for (let k = 0; k < 40; k += 1) {
        const position = pick(rand, cells);
        const targetKind = pick(rand, ["null", "access", "access", "cell", "exit"]);
        const target =
          targetKind === "null" ? null
            : targetKind === "access" && accesses.length ? accesses[Math.floor(rand() * accesses.length)]
              : targetKind === "exit" ? cellKey(m.now.exitPosition) : cellKey(pick(rand, cells));
        const commitLeft = Math.floor(rand() * 5);
        const player = pick(rand, walkableOf(wNow));
        const blockedKind = pick(rand, ["omitted", "empty", "traps", "cells", "around-post", "around-target"]);
        const around = (key) => {
          if (!key) return [];
          const [row, col] = key.split(",").map(Number);
          return walkableNeighbours({ row, col }, wNow).map(cellKey).filter((c) => c !== cellKey(position));
        };
        const blockedKeys =
          blockedKind === "omitted" ? null
            : blockedKind === "empty" ? []
              : blockedKind === "traps" ? m.now.traps.map(cellKey)
                : blockedKind === "cells" ? Array.from({ length: 1 + Math.floor(rand() * 3) }, () => cellKey(pick(rand, cells)))
                  : blockedKind === "around-post" ? around(cellKey(position))
                    : around(target);
        const commitTurns = pick(rand, [undefined, undefined, 3, 1, 2, 4]);
        const decide = (rota, map, walls, zone) => {
          const toCell = (key) => (key ? { row: Number(key.split(",")[0]), col: Number(key.split(",")[1]) } : null);
          const state = { position: { ...position }, target: toCell(target), commitLeft };
          const callArgs = [state, { ...player }, map.exitPosition, walls, zone];
          if (blockedKeys !== null) callArgs.push(commitTurns, toSet(rota, blockedKeys));
          else if (commitTurns !== undefined) callArgs.push(commitTurns);
          const before = JSON.stringify(state);
          const out = stateOut(rota.api.decideSentinelMove(...callArgs));
          return { out, inputUntouched: JSON.stringify(state) === before };
        };
        const a = decide(NOW, m.now, wNow, zNow);
        const b = decide(BASE, m.base, wBase, zBase);
        decisions += 1;
        digest.update(JSON.stringify(a));
        if (!same(a, b) || !a.inputUntouched) diffs.push({ seed: m.seed, opened, k, a, b });
        // Coverage, read off the decision itself (the policy is pure, so asking again without traps is free).
        const free = blockedKeys === null || blockedKeys.length === 0 ? a.out
          : stateOut(NOW.api.decideSentinelMove({ position: { ...position }, target: target && { row: +target.split(",")[0], col: +target.split(",")[1] }, commitLeft }, { ...player }, m.now.exitPosition, wNow, zNow, commitTurns ?? 3));
        if (commitLeft > 0 && target) tally(coverage, a.out.target === null ? "commitBrokenByLeashOrHorizonOrTrap" : "commitHeld");
        else tally(coverage, a.out.target === null ? "homeFallback" : "commitStartOrReaim");
        if (blockedKeys?.length && free.target !== null && a.out.target === null) tally(coverage, "trapReleasedHeldDoor");
        if (blockedKeys?.length && free.position !== a.out.position) tally(coverage, "trapChangedTheStep");
        tally(coverage, a.out.position === cellKey(position) ? "stayed" : "moved");
        if (!zNow.zoneKeys.has(cellKey(position))) tally(coverage, "startedOutsideZone");
        if (commitTurns !== undefined && commitTurns !== 3) tally(coverage, "customCommitTurns");
      }
    }
  }
  // createSentinelState refuses a zone with no usable cell, with the same words on both trees.
  const m0 = MAPS[0];
  const starved = (rota, map) => errorOf(() => rota.api.createSentinelState(map, { zone: [map.exitPosition, map.playerStart, map.guardianStart], zoneKeys: new rota.sandbox.Set(), accesses: [] }));
  const throwNow = starved(NOW, m0.now);
  const throwBase = starved(BASE, m0.base);
  const needed = ["commitHeld", "commitStartOrReaim", "homeFallback", "commitBrokenByLeashOrHorizonOrTrap", "trapReleasedHeldDoor", "trapChangedTheStep", "moved", "stayed", "startedOutsideZone", "customCommitTurns"];
  record(
    "E1",
    "equivalence",
    "SENTINEL_POLICY_IDENTICAL",
    mapsAgree && diffs.length === 0 && Boolean(throwNow) && throwNow === throwBase && needed.every((k) => coverage[k] > 0),
    { maps: MAPS.length, zonesCompared: zones, decisionsCompared: decisions, coverage, throwsTheSame: throwNow === throwBase, digest: digest.digest("hex").slice(0, 16), diffs: diffs.slice(0, 4) },
  );
}

// E2 — the Sentinel is still contract c3: walked through real games with the real Hunter, each tree's decideSentinelMove
// matches dual-guardian-lab's `sentinelStep` (tuning { patrol, commitTurns: 3 }) decision for decision, both trees walk
// the same trace; FEINT (commit to door A, hold through the switch to B, re-aim after) and ROLE (Sentinel territorial,
// Hunter not) give the same outcome on both.
{
  const asLabMap = (map) => ({ walls: map.walls, playerStart: map.playerStart, guardianStart: map.guardianStart, exitPosition: map.exitPosition, collectibleStars: map.collectibleStars });
  const walk = (rota) => {
    const api = rota.api;
    const out = { divergences: 0, states: 0, trace: [] };
    for (const stage of STAGES) {
      for (const difficulty of DIFFICULTIES) {
        for (let i = 0; i < 4; i += 1) {
          rota.setSeed(6_100_000 + stage * 1000 + i);
          const map = api.generateMaze(difficulty, stage);
          const zone = api.computePortalDefenceZone(map.playerStart, map.exitPosition, map.walls);
          const zoneLab = portalZone(asLabMap(map));
          if (zone.zone.map(cellKey).join("|") !== zoneLab.zone.map(cellKey).join("|") || zone.accesses.map(cellKey).join("|") !== zoneLab.accesses.map(cellKey).join("|")) out.divergences += 1;
          let state = api.createSentinelState(map, zone);
          let player = { ...map.playerStart };
          let hunter = { ...map.guardianStart };
          const toPortal = api.getReachableDistances(map.exitPosition, map.walls);
          for (let turn = 0; turn < 26; turn += 1) {
            const options = api.getNeighbors(player, map.walls).filter((n) => !api.positionsEqual(n, hunter) && !api.positionsEqual(n, state.position));
            if (!options.length) break;
            options.sort((a, b) => (toPortal.get(cellKey(a)) ?? 99) - (toPortal.get(cellKey(b)) ?? 99));
            player = options[0];
            if (api.positionsEqual(player, map.exitPosition)) break;
            hunter = api.chooseGuardianMove(hunter, player, map.exitPosition, map.walls, difficulty, new rota.sandbox.Set([cellKey(state.position)]));
            if (api.positionsEqual(hunter, player)) break;
            const labState = { pos: { ...state.position }, target: state.target ? { ...state.target } : null, commitLeft: state.commitLeft };
            const labMove = sentinelStep(labState, player, asLabMap(map), zoneLab, { patrol: true, commitTurns: 3 });
            state = api.decideSentinelMove(state, player, map.exitPosition, map.walls, zone);
            out.states += 1;
            const labOut = { position: cellKey(labMove), target: labState.target ? cellKey(labState.target) : null, commitLeft: labState.commitLeft };
            if (!same(labOut, stateOut(state))) out.divergences += 1;
            out.trace.push([cellKey(player), cellKey(hunter), stateOut(state)]);
            if (api.positionsEqual(state.position, player)) break;
          }
        }
      }
    }
    return out;
  };
  const feint = (rota) => {
    const api = rota.api;
    for (let seed = 7_200_000; seed < 7_200_240; seed += 1) {
      rota.setSeed(seed);
      const map = api.generateMaze("hard", 3);
      const zone = api.computePortalDefenceZone(map.playerStart, map.exitPosition, map.walls);
      if (zone.accesses.length < 2) continue;
      const [doorA, doorB] = zone.accesses;
      let state = api.createSentinelState(map, zone);
      const trace = [];
      state = api.decideSentinelMove(state, doorA, map.exitPosition, map.walls, zone);
      trace.push(stateOut(state));
      if (state.target === null || cellKey(state.target) !== cellKey(doorA)) continue;
      for (let turn = 2; turn <= 5; turn += 1) {
        state = api.decideSentinelMove(state, doorB, map.exitPosition, map.walls, zone);
        trace.push(stateOut(state));
      }
      const held = trace.slice(1, 4).every((s) => s.target === cellKey(doorA));
      return { seed, doorA: cellKey(doorA), doorB: cellKey(doorB), held, reaimed: trace[4].target === cellKey(doorB), trace };
    }
    return null;
  };
  const role = (rota) => {
    const api = rota.api;
    const cases = [];
    for (let i = 0; i < 6; i += 1) {
      rota.setSeed(7_400_000 + i);
      const map = api.generateMaze("hard", 3);
      const zone = api.computePortalDefenceZone(map.playerStart, map.exitPosition, map.walls);
      let state = api.createSentinelState(map, zone);
      let hunter = { ...map.guardianStart };
      const player = { ...map.playerStart };
      const leash = api.PORTAL_ZONE_RADIUS + api.SENTINEL_LEASH;
      let hunterLeft = false;
      let sentinelStayed = true;
      for (let turn = 1; turn <= 12; turn += 1) {
        hunter = api.chooseGuardianMove(hunter, player, map.exitPosition, map.walls, "hard", new rota.sandbox.Set([cellKey(state.position)]));
        state = api.decideSentinelMove(state, player, map.exitPosition, map.walls, zone);
        if ((api.findPathLength(hunter, map.exitPosition, map.walls) ?? 0) > leash) hunterLeft = true;
        if ((api.findPathLength(state.position, map.exitPosition, map.walls) ?? 99) > leash) sentinelStayed = false;
      }
      cases.push({ hunter: cellKey(hunter), sentinel: stateOut(state), hunterLeft, sentinelStayed });
    }
    return cases;
  };
  const now = { walk: walk(NOW), feint: feint(NOW), role: role(NOW) };
  const base = { walk: walk(BASE), feint: feint(BASE), role: role(BASE) };
  const feintOk = Boolean(now.feint?.held);
  const rolesOk = now.role.every((c) => c.hunterLeft && c.sentinelStayed);
  record(
    "E2",
    "equivalence",
    "SENTINEL_CONTRACT_C3_FEINT_AND_ROLE_IDENTICAL",
    now.walk.divergences === 0 && base.walk.divergences === 0 && now.walk.states > 300 && same(now, base) && feintOk && rolesOk,
    {
      labStatesCompared: now.walk.states,
      labDivergences: { now: now.walk.divergences, baseline: base.walk.divergences },
      traceDigest: sha(now.walk.trace),
      sameTraceAsBaseline: same(now.walk, base.walk),
      feint: now.feint && { seed: now.feint.seed, doors: [now.feint.doorA, now.feint.doorB], heldThroughSwitch: now.feint.held, reaimedAfter: now.feint.reaimed },
      sameFeintAsBaseline: same(now.feint, base.feint),
      rolesDistinct: rolesOk,
      sameRolesAsBaseline: same(now.role, base.role),
    },
  );
}

// E3 — the Hunter, branch by branch, with the RNG: for every case both trees start from the same Math seed; the move,
// the number of draws it took and the next three draws of the shared stream must agree. Cases are built so every branch
// of chooseGuardianMove fires: preferred move legal (every mode), preferred move illegal because it is the portal, an
// armed trap or the Sentinel's cell, easy's random branch (draw < 0.45) and its greedy branch, medium's and hard's
// deterministic fallback, ties among the best alternatives, and no alternative at all.
{
  const diffs = [];
  const coverage = {};
  let cases = 0;
  const digest = crypto.createHash("sha256");
  const decide = (rota, guardian, player, map, mode, blockedKeys, seed) => {
    const blocked = blockedKeys === null ? undefined : toSet(rota, blockedKeys);
    rota.setSeed(seed);
    rota.draws.reset();
    const move = rota.api.chooseGuardianMove({ ...guardian }, { ...player }, map.exitPosition, map.walls, mode, ...(blocked ? [blocked] : []));
    const draws = rota.draws.get();
    return { move: cellKey(move), draws, next: nextDraws(rota) };
  };
  /** Which branch a case takes, read with the real difficulty helper and the real stream of the tree under test. */
  const classify = (guardian, player, map, mode, blockedKeys, seed) => {
    const api = NOW.api;
    NOW.setSeed(seed);
    const preferred = NOW.difficulty.getPredatorNextPosition(guardian, player, map.walls, 9, 9, mode);
    const blocked = new Set(blockedKeys ?? []);
    const portal = api.positionsEqual(preferred, map.exitPosition);
    const illegal = portal || blocked.has(cellKey(preferred));
    if (!illegal) return [`preferredLegal:${mode}`];
    const labels = [portal ? "preferredIsPortal" : "preferredBlocked"];
    const alternatives = api.getNeighbors(guardian, map.walls).filter((n) => !api.positionsEqual(n, map.exitPosition) && !blocked.has(cellKey(n)));
    if (alternatives.length === 0) return [...labels, "noAlternative"];
    if (mode === "easy" && NOW.routeRandom.routeRandom() < 0.45) return [...labels, "easyRandomBranch"];
    const distance = (n) => Math.abs(n.row - player.row) + Math.abs(n.col - player.col);
    const best = Math.min(...alternatives.map(distance));
    const ties = alternatives.filter((n) => distance(n) === best).length;
    return [...labels, `${mode}Fallback`, ...(ties > 1 ? ["tiesAmongBest"] : [])];
  };
  for (const m of MAPS) {
    const rand = prng(m.seed ^ 0x9e3779b9);
    const map = m.now;
    const cells = walkableOf(map.walls);
    const exitKey = cellKey(map.exitPosition);
    const nearExit = cells.filter((c) => Math.abs(c.row - map.exitPosition.row) + Math.abs(c.col - map.exitPosition.col) === 1);
    for (const mode of DIFFICULTIES) {
      for (let k = 0; k < 14; k += 1) {
        const shape = pick(rand, ["free", "free", "traps", "sentinel", "blockPreferred", "blockPreferred", "portal", "portal", "boxed"]);
        let guardian = pick(rand, cells.filter((c) => cellKey(c) !== exitKey));
        let player = pick(rand, cells.filter((c) => cellKey(c) !== cellKey(guardian)));
        if (shape === "portal" && nearExit.length) {
          // The Hunter next to the portal, the Explorer on or beyond it: the greedy step is the portal itself.
          guardian = pick(rand, nearExit);
          player = { ...map.exitPosition };
        }
        const seed = (m.seed * 31 + DIFFICULTIES.indexOf(mode) * 7 + k) >>> 0;
        let blockedKeys = null;
        if (shape === "traps") blockedKeys = map.traps.map(cellKey);
        else if (shape === "sentinel") blockedKeys = [cellKey(pick(rand, cells))];
        else if (shape === "boxed") blockedKeys = walkableNeighbours(guardian, map.walls).map(cellKey);
        else if (shape === "blockPreferred") {
          NOW.setSeed(seed);
          const preferred = NOW.difficulty.getPredatorNextPosition(guardian, player, map.walls, 9, 9, mode);
          blockedKeys = [cellKey(preferred), ...(rand() < 0.5 ? map.traps.map(cellKey) : [])];
        } else if (rand() < 0.3) blockedKeys = [];
        const a = decide(NOW, guardian, player, m.now, mode, blockedKeys, seed);
        const b = decide(BASE, guardian, player, m.base, mode, blockedKeys, seed);
        const labels = classify(guardian, player, map, mode, blockedKeys, seed);
        for (const l of labels) tally(coverage, l);
        if (shape === "traps" && labels[0] === "preferredBlocked") tally(coverage, "trapBlocksPreferred");
        if (shape === "sentinel" && labels[0] === "preferredBlocked") tally(coverage, "sentinelBlocksPreferred");
        if (blockedKeys === null) tally(coverage, "defaultBlockedArgument");
        cases += 1;
        digest.update(JSON.stringify([labels, a]));
        if (!same(a, b)) diffs.push({ seed: m.seed, mode, k, shape, labels, a, b });
      }
    }
  }
  const needed = [
    "preferredLegal:easy", "preferredLegal:medium", "preferredLegal:hard", "preferredIsPortal", "preferredBlocked", "trapBlocksPreferred",
    "sentinelBlocksPreferred", "easyRandomBranch", "easyFallback", "mediumFallback", "hardFallback", "tiesAmongBest", "noAlternative",
    "defaultBlockedArgument",
  ];
  record("E3", "equivalence", "HUNTER_POLICY_AND_DRAWS_IDENTICAL", diffs.length === 0 && needed.every((k) => coverage[k] > 0), {
    casesCompared: cases,
    perCase: "move, draws consumed, next 3 draws of the shared stream",
    coverage,
    missingBranches: needed.filter((k) => !(coverage[k] > 0)),
    digest: digest.digest("hex").slice(0, 16),
    diffs: diffs.slice(0, 4),
  });
}

// E4 — the stream across whole turns: generate a map, then 40 turns of Explorer step → Hunter → Sentinel (traps arming
// as the Explorer crosses them), then generate again — on a continuous seeded stream and with the seam armed. Every
// Hunter move, every draw count per turn, the next draws and the next map agree.
{
  const diffs = [];
  let turns = 0;
  const chain = (rota, stage, difficulty, seed, armed) => {
    const api = rota.api;
    const seam = rota.routeRandom;
    if (armed) seam.armRouteRandomSeed(seed);
    rota.setSeed(seed);
    try {
      const map = api.generateMaze(difficulty, stage);
      const zone = api.computePortalDefenceZone(map.playerStart, map.exitPosition, map.walls);
      let sentinel = api.createSentinelState(map, zone);
      let player = { ...map.playerStart };
      let hunter = { ...map.guardianStart };
      const armedTraps = new rota.sandbox.Set();
      const trapKeys = new Set(map.traps.map(cellKey));
      const log = [];
      const rand = prng(seed);
      for (let turn = 0; turn < 40; turn += 1) {
        const options = api.getNeighbors(player, map.walls).filter((n) => !api.positionsEqual(n, hunter) && !api.positionsEqual(n, sentinel.position));
        if (!options.length) break;
        player = options[Math.floor(rand() * options.length)];
        if (trapKeys.has(cellKey(player))) armedTraps.add(cellKey(player));
        rota.draws.reset();
        hunter = api.chooseGuardianMove(hunter, player, map.exitPosition, map.walls, difficulty, new rota.sandbox.Set([...armedTraps, cellKey(sentinel.position)]));
        const hunterDraws = armed ? null : rota.draws.get();
        sentinel = api.decideSentinelMove(sentinel, player, map.exitPosition, map.walls, zone, api.SENTINEL_COMMIT_TURNS, armedTraps);
        log.push([cellKey(player), cellKey(hunter), hunterDraws, stateOut(sentinel), armedTraps.size]);
        if (api.positionsEqual(hunter, player) || api.positionsEqual(sentinel.position, player)) break;
      }
      const after = nextDraws(rota, 4);
      const nextMap = api.generateMaze(difficulty, stage);
      return { log, after, nextMap: mapDigest(rota, nextMap), map: mapDigest(rota, map) };
    } finally {
      if (armed) seam.clearRouteRandomSeed();
    }
  };
  for (const stage of STAGES) {
    for (const difficulty of DIFFICULTIES) {
      for (const [seed, armed] of [[880_001 + stage * 10 + DIFFICULTIES.indexOf(difficulty), false], [990_001 + stage * 10, false], [424_242 + stage, true]]) {
        const a = chain(NOW, stage, difficulty, seed, armed);
        const b = chain(BASE, stage, difficulty, seed, armed);
        turns += a.log.length;
        if (!same(a, b)) diffs.push({ stage, difficulty, seed, armed });
      }
    }
  }
  record("E4", "equivalence", "STREAM_IDENTICAL_ACROSS_TURNS_AND_GENERATIONS", diffs.length === 0 && turns > 400, {
    chains: `${STAGES.length * DIFFICULTIES.length * 3} (2 seeded, 1 armed per stage/mode)`,
    turnsCompared: turns,
    diffs: diffs.slice(0, 5),
  });
}

// E5 — the trap contract on both trees: dormant, the trap changes nothing; armed, neither defender may enter it — the
// Hunter reconsiders with its normal rule among the remaining legal cells, the Sentinel walks around it and releases a
// door it can no longer reach, in the same turn the trap arms; and the trap never becomes a wall for the Explorer.
{
  const outcomes = (rota) => {
    const api = rota.api;
    const out = { hunter: [], sentinel: [], release: [], sameTurn: [] };
    for (let seed = 9_100_000; seed < 9_100_000 + 160; seed += 1) {
      for (const stage of [3, 2, 1]) {
        rota.setSeed(seed);
        const map = api.generateMaze("hard", stage);
        if (!map.traps.length) continue;
        const zone = api.computePortalDefenceZone(map.playerStart, map.exitPosition, map.walls);
        for (const trap of map.traps) {
          const trapKey = cellKey(trap);
          const armed = new rota.sandbox.Set([trapKey]);
          const none = new rota.sandbox.Set();
          // Hunter: from each neighbour of the trap, chasing an Explorer standing on it.
          for (const from of api.getNeighbors(trap, map.walls)) {
            if (api.positionsEqual(from, map.exitPosition)) continue;
            rota.setSeed(seed + 17);
            const dormant = api.chooseGuardianMove(from, trap, map.exitPosition, map.walls, "hard", none);
            rota.setSeed(seed + 17);
            const blocked = api.chooseGuardianMove(from, trap, map.exitPosition, map.walls, "hard", armed);
            out.hunter.push([trapKey, cellKey(from), cellKey(dormant), cellKey(blocked)]);
          }
          // Sentinel: posted next to the trap, holding a door, with the Explorer on the trap (it just armed it).
          for (const from of api.getNeighbors(trap, map.walls)) {
            if (api.positionsEqual(from, map.exitPosition)) continue;
            for (const door of zone.accesses) {
              const state = { position: from, target: door, commitLeft: 2 };
              const dormant = api.decideSentinelMove(state, trap, map.exitPosition, map.walls, zone, 3, none);
              const blocked = api.decideSentinelMove(state, trap, map.exitPosition, map.walls, zone, 3, armed);
              out.sentinel.push([trapKey, cellKey(from), cellKey(door), stateOut(dormant), stateOut(blocked)]);
              // The door cut off: wall the Sentinel in with the trap plus its other neighbours.
              const sealed = new rota.sandbox.Set([trapKey, ...api.getNeighbors(from, map.walls).map(cellKey).filter((k) => k !== trapKey && k !== cellKey(door))]);
              out.release.push([trapKey, cellKey(from), cellKey(door), stateOut(api.decideSentinelMove(state, trap, map.exitPosition, map.walls, zone, 3, sealed))]);
            }
          }
          out.sameTurn.push([trapKey, map.walls.has(trapKey)]);
        }
        break;
      }
    }
    return out;
  };
  const now = outcomes(NOW);
  const base = outcomes(BASE);
  const hunterRespects = now.hunter.every(([trap, , , blocked]) => blocked !== trap);
  const hunterWouldHaveEntered = now.hunter.filter(([trap, , dormant]) => dormant === trap).length;
  const sentinelRespects = now.sentinel.every(([trap, , , , blocked]) => blocked.position !== trap);
  const sentinelWouldHaveEntered = now.sentinel.filter(([trap, , , dormant]) => dormant.position === trap).length;
  const released = now.release.filter(([, , , s]) => s.target === null && s.commitLeft === 0).length;
  const trapsAreNotWalls = now.sameTurn.every(([, isWall]) => !isWall);
  record(
    "E5",
    "equivalence",
    "TRAP_CONTRACT_IDENTICAL",
    same(now, base) && hunterRespects && sentinelRespects && hunterWouldHaveEntered > 0 && sentinelWouldHaveEntered > 0 && released > 0 && trapsAreNotWalls,
    {
      hunterCases: now.hunter.length,
      hunterWouldEnterDormantTrap: hunterWouldHaveEntered,
      hunterEntersArmedTrap: now.hunter.length - now.hunter.filter(([trap, , , blocked]) => blocked !== trap).length,
      sentinelCases: now.sentinel.length,
      sentinelWouldEnterDormantTrap: sentinelWouldHaveEntered,
      sentinelEntersArmedTrap: now.sentinel.filter(([trap, , , , blocked]) => blocked.position === trap).length,
      heldDoorReleasedWhenCutOff: released,
      trapCellsThatAreWalls: now.sameTurn.filter(([, isWall]) => isWall).length,
      digest: sha(now),
      sameAsBaseline: same(now, base),
    },
  );
}

// --- the real hook -------------------------------------------------------------------------------

/** Every field a step can change, defenders' commitment included. */
const snapshot = (g) => ({
  status: g.status,
  message: g.message,
  route: [g.routeNumber, g.routeProgression.stage, g.routeProgression.label],
  mode: g.difficulty,
  player: cellKey(g.player),
  hunter: cellKey(g.guardian),
  sentinel: [cellKey(g.sentinel), g.sentinelTarget && cellKey(g.sentinelTarget), g.sentinelCommitLeft],
  counters: [g.turns, g.blockedMoves, g.errors, g.collectedCount, g.totalLights, g.trapsTriggered, g.moveTick, g.blockedShake],
  lights: [...g.collectedSet].sort(),
  traps: [...g.triggeredTrapSet].sort(),
  chest: [g.chestPosition && cellKey(g.chestPosition), g.chestOpened, g.rewardSelected, g.rewardSpent, g.brokenWall, g.pickaxeAvailable, g.secondChanceAvailable],
  breakTargets: g.breakTargets.map((t) => `${t.direction}:${cellKey(t.cell)}`),
  portal: [g.portalActive, g.portalDefenceZone.zone.map(cellKey).join(" "), g.portalDefenceZone.accesses.map(cellKey).join(" ")],
  invariants: [g.dynamicSolvability.valid, g.dynamicSolvability.solvable, g.dynamicSolvability.issues.join(",")],
});

/**
 * One action of a scripted Explorer. Policies: `win` (lights then portal, around the Hunter's reach, Second Chance),
 * `lose` (straight at the Hunter, Pickaxe), `pickaxe` (chest, Pickaxe, break, then win), `traps` (cross every trap,
 * then win), `sc-hunter` / `sc-sentinel` (chest, Second Chance, then straight at that defender, again and again),
 * `sc-portal` (chest, Second Chance, then lights and portal stepping around the defenders' cells but not their reach —
 * the Sentinel's doors included), `sc-bait` (chest, Second Chance, then onto a cell the Sentinel's own policy would
 * step into — asked of the tree's pure decideSentinelMove — or toward its door, around the Hunter's reach).
 */
function nextAction(g, policy, api) {
  if (g.rewardChoicePending) return ["choose", ["win", "traps", "sc-hunter", "sc-sentinel", "sc-portal", "sc-bait"].includes(policy) ? "second-chance" : "pickaxe"];
  if (policy === "pickaxe" && g.breakTargets.length > 0) return ["break", g.breakTargets[0].cell];
  let best = null;
  const towardChest = (policy === "pickaxe" || policy.startsWith("sc-")) && !g.chestOpened && g.chestPosition;
  if (towardChest) best = pathBetween(g.player, g.chestPosition, g.walls);
  else if (policy === "sc-bait" && g.secondChanceAvailable) {
    const free = walkableNeighbours(g.player, g.walls).filter((c) => cellKey(c) !== cellKey(g.guardian) && cellKey(c) !== cellKey(g.sentinel));
    const held = { position: g.sentinel, target: g.sentinelTarget, commitLeft: g.sentinelCommitLeft };
    const bait = free.find((c) => cellKey(api.decideSentinelMove(held, c, g.mazeMap.exitPosition, g.walls, g.portalDefenceZone, 3, g.triggeredTrapSet).position) === cellKey(c));
    if (bait) return ["step", bait];
    const goals = [...(g.sentinelTarget ? [g.sentinelTarget] : []), ...walkableNeighbours(g.sentinel, g.walls)].filter((c) => cellKey(c) !== cellKey(g.player) && cellKey(c) !== cellKey(g.sentinel));
    const around = new Set([...g.walls, ...[g.guardian, g.sentinel, ...walkableNeighbours(g.guardian, g.walls)].map(cellKey)]);
    around.delete(cellKey(g.player));
    for (const goal of goals) {
      if (around.has(cellKey(goal))) continue;
      const route = pathBetween(g.player, goal, around);
      if (route && (!best || route.length < best.length)) best = route;
    }
    best ??= pathBetween(g.player, g.mazeMap.exitPosition, new Set([...g.walls, cellKey(g.sentinel), cellKey(g.guardian)]));
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
const POLICIES = ["win", "lose", "pickaxe", "traps", "sc-hunter", "sc-sentinel", "sc-portal", "sc-bait"];

// E6 — Second Chance through the real hook, both trees: every action is played on a stream armed through the seam with
// a per-step seed, so the Hunter's answer can be asked again afterwards and the capture attributed — to the Hunter, to
// the Sentinel, or to the Explorer's own step. For each: the charge is spent exactly then, the defenders (position,
// held door, commitment) are rolled back to the start of the turn, no two pieces overlap, and the next capture ends the
// Route; plain captures by either defender end it at once.
{
  const play = (rev) => {
    const runtime = loadRouteRuntime({ rev });
    const api = runtime.API;
    const seam = () => runtime.routeRandom;
    const out = { runs: [], events: {}, violations: [] };
    for (const routeNumber of [1, 2, 3]) {
      for (const difficulty of DIFFICULTIES) {
        for (const policy of ["sc-hunter", "sc-sentinel", "sc-bait", "lose", "win"]) {
          // A Sentinel capture with the charge in hand is rare in play — the Hunter usually gets there first — so the
          // bait policy gets more Routes.
          for (const seedOffset of policy === "sc-bait" ? [0, 1, 2, 3, 4, 5, 6, 7] : [0, 1, 2]) {
            const seed = 5100 + routeNumber * 100 + DIFFICULTIES.indexOf(difficulty) * 10 + seedOffset;
            const run = runtime.mount({ seed, routeNumber, difficulty });
            const trace = [snapshot(run.state)];
            let spentAt = null;
            for (let step = 0; step < 160 && run.state.status === "playing"; step += 1) {
              const pre = run.state;
              const action = nextAction(pre, policy, api);
              if (!action) break;
              const stepSeed = (seed * 1000 + step) >>> 0;
              seam().armRouteRandomSeed(stepSeed);
              try {
                perform(run, action);
              } finally {
                seam().clearRouteRandomSeed();
              }
              const post = run.state;
              trace.push(snapshot(post));
              const playing = post.status === "playing";
              const cells = [cellKey(post.player), cellKey(post.guardian), cellKey(post.sentinel)];
              if (playing && new Set(cells).size !== 3) out.violations.push({ seed, step, overlap: cells });
              const chargeSpent = !pre.rewardSpent && post.rewardSpent && pre.rewardSelected === "second-chance";
              if (chargeSpent) {
                if (spentAt !== null) out.violations.push({ seed, step, spentTwice: true });
                spentAt = step;
                const rolledBack = cellKey(post.guardian) === cellKey(pre.guardian) && cellKey(post.sentinel) === cellKey(pre.sentinel) &&
                  cellKey(post.sentinelTarget ?? { row: -1, col: -1 }) === cellKey(pre.sentinelTarget ?? { row: -1, col: -1 }) &&
                  post.sentinelCommitLeft === pre.sentinelCommitLeft;
                let who;
                if (post.message === "Segunda Chance: você resistiu e não avançou.") {
                  who = "explorerStep";
                  if (cellKey(post.player) !== cellKey(pre.player) || post.turns !== pre.turns + 1) out.violations.push({ seed, step, explorerStepMoved: true });
                } else {
                  // Ask the Hunter again, on the same armed stream, from the start of the turn.
                  seam().armRouteRandomSeed(stepSeed);
                  let hunterMove;
                  try {
                    hunterMove = api.chooseGuardianMove(pre.guardian, post.player, pre.mazeMap.exitPosition, pre.walls, pre.difficulty, new runtime.LAB.sb.Set([...post.triggeredTrapSet, cellKey(pre.sentinel)]));
                  } finally {
                    seam().clearRouteRandomSeed();
                  }
                  if (cellKey(hunterMove) === cellKey(post.player)) who = "hunter";
                  else {
                    const raw = api.decideSentinelMove({ position: pre.sentinel, target: pre.sentinelTarget, commitLeft: pre.sentinelCommitLeft }, post.player, pre.mazeMap.exitPosition, pre.walls, pre.portalDefenceZone, 3, post.triggeredTrapSet);
                    const settled = cellKey(raw.position) === cellKey(hunterMove) && cellKey(raw.position) !== cellKey(pre.sentinel) ? pre.sentinel : raw.position;
                    who = cellKey(settled) === cellKey(post.player) ? "sentinel" : "unexplained";
                  }
                }
                tally(out.events, `secondChance:${who}`);
                if (!rolledBack || who === "unexplained" || post.secondChanceAvailable || !post.secondChanceSpent || post.status !== "playing") {
                  out.violations.push({ seed, step, who, rolledBack, available: post.secondChanceAvailable, status: post.status });
                }
              }
              if (post.status === "lost") {
                const by = cellKey(post.guardian) === cellKey(post.player) ? "hunter" : cellKey(post.sentinel) === cellKey(post.player) ? "sentinel" : "explorerStep";
                tally(out.events, `${spentAt !== null ? "lossAfterSecondChance" : "loss"}:${by}`);
                if (post.errors !== pre.errors + 1) out.violations.push({ seed, step, lossErrors: [pre.errors, post.errors] });
              }
            }
            out.runs.push({ routeNumber, difficulty, policy, seed, trace, completions: JSON.parse(JSON.stringify(run.completions)) });
          }
        }
      }
    }
    return out;
  };
  const now = play(REV);
  const base = play(BASELINE);
  const diffs = now.runs
    .map((r, i) => (same(r, base.runs[i]) ? null : `${r.routeNumber}/${r.difficulty}/${r.policy}/${r.seed}@${r.trace.findIndex((s, j) => !same(s, base.runs[i].trace[j]))}`))
    .filter(Boolean);
  const needed = ["secondChance:hunter", "secondChance:sentinel", "secondChance:explorerStep", "loss:hunter", "loss:sentinel", "lossAfterSecondChance:hunter"];
  record(
    "E6",
    "equivalence",
    "SECOND_CHANCE_CAPTURES_ROLLBACK_AND_CHARGE_IDENTICAL",
    diffs.length === 0 && same(now.events, base.events) && now.violations.length === 0 && needed.every((k) => now.events[k] > 0),
    {
      runs: now.runs.length,
      stepsCompared: now.runs.reduce((sum, r) => sum + r.trace.length, 0),
      events: now.events,
      missing: needed.filter((k) => !(now.events[k] > 0)),
      violations: now.violations.slice(0, 5),
      digest: sha(now.runs),
      diffs: diffs.slice(0, 5),
    },
  );
}

// E7 — real Routes, played by the real hook on a continuous seeded stream (the product's regime), recorded at every
// step: Explorer, Hunter, Sentinel and its held door and commitment, armed traps, lights, chest and reward, broken wall,
// status, errors, turns, messages, invariants and the completion — on every mode, Routes 1/2/3, eight policies; then a
// restart, a mode change and the next Route opened from the continuation; then the stream itself.
{
  const play = (rev) => {
    const runtime = loadRouteRuntime({ rev });
    const out = [];
    const drive = (run, policy, trace, budget) => {
      for (let guard = 0; guard < budget; guard += 1) {
        const g = run.state;
        if (g.status !== "playing") return g.status;
        const action = nextAction(g, policy, runtime.API);
        if (!action) return "stuck";
        perform(run, action);
        trace.push(snapshot(run.state));
      }
      return "budget";
    };
    for (const routeNumber of [1, 2, 3]) {
      for (const difficulty of DIFFICULTIES) {
        for (const policy of POLICIES) {
          for (const seedOffset of [0, 1]) {
            const seed = 7300 + routeNumber * 100 + DIFFICULTIES.indexOf(difficulty) * 10 + seedOffset;
            const run = runtime.mount({ seed, routeNumber, difficulty });
            const trace = [snapshot(run.state)];
            const end = drive(run, policy, trace, 220);
            const completions = JSON.parse(JSON.stringify(run.completions));
            run.restart();
            trace.push(snapshot(run.state));
            drive(run, policy, trace, 12);
            run.changeDifficulty(DIFFICULTIES[(DIFFICULTIES.indexOf(difficulty) + 1) % 3]);
            trace.push(snapshot(run.state));
            let next = null;
            const continuation = completions.at(-1)?.continuation;
            if (continuation) {
              const nextRun = runtime.mount({ seed: seed + 1, routeNumber: continuation.routeNumber, difficulty: continuation.difficulty, initialDifficulty: continuation.difficulty });
              next = [snapshot(nextRun.state)];
              drive(nextRun, policy, next, 12);
            }
            out.push({ routeNumber, difficulty, policy, seed, end, trace, completions, next, stream: nextDraws({ routeRandom: runtime.routeRandom }, 3) });
          }
        }
      }
    }
    return out;
  };
  const now = play(REV);
  const base = play(BASELINE);
  const diffs = now
    .map((r, i) => (same(r, base[i]) ? null : `${r.routeNumber}/${r.difficulty}/${r.policy}/${r.seed}@${r.trace.findIndex((s, j) => !same(s, base[i].trace[j]))}`))
    .filter(Boolean);
  const ends = {};
  for (const r of now) tally(ends, `${r.policy}:${r.end}`);
  const steps = now.reduce((sum, r) => sum + r.trace.length + (r.next?.length ?? 0), 0);
  const wins = now.filter((r) => r.completions.some((c) => c.details?.won)).length;
  const losses = now.filter((r) => r.completions.some((c) => c.details && !c.details.won)).length;
  const trapsArmed = now.filter((r) => r.trace.some((s) => s.traps.length > 0)).length;
  const walls = now.filter((r) => r.trace.some((s) => s.chest[4] !== null)).length;
  const commitments = now.reduce((sum, r) => sum + r.trace.filter((s) => s.sentinel[2] > 0).length, 0);
  const defenderOnArmedTrap = now.reduce((sum, r) => sum + r.trace.filter((s) => s.traps.includes(s.hunter) || s.traps.includes(s.sentinel[0])).length, 0);
  record(
    "E7",
    "equivalence",
    "RUNTIME_GAMES_IDENTICAL_STEP_BY_STEP",
    diffs.length === 0 && now.length === 144 && wins > 0 && losses > 0 && trapsArmed > 0 && walls > 0 && commitments > 0 &&
      defenderOnArmedTrap === 0 && now.some((r) => r.next),
    {
      runs: now.length,
      stepsCompared: steps,
      ends,
      wins,
      losses,
      runsWithArmedTraps: trapsArmed,
      runsWithBrokenWall: walls,
      stepsWithSentinelCommitted: commitments,
      stepsWithDefenderOnArmedTrap: defenderOnArmedTrap,
      nextRoutesOpened: now.filter((r) => r.next).length,
      digest: sha(now),
      diffs: diffs.slice(0, 6),
    },
  );
}

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

// N1 — the C0 surface finds every moved binding in route-defenders.ts, once, and what a validator gets is the function
// the hook runs: the hook's re-exports are those very functions, and route-defenders was evaluated once.
{
  const holders = Object.fromEntries(MOVED_VALUES.map((name) => [name, holderOf(NOW.graph, name)]));
  const misplaced = MOVED_VALUES.filter((name) => !same(holders[name], [ROUTE_DEFENDERS]));
  const identical = MOVED_VALUES.filter((name) => holders[name].length === 1 && NOW.api[name] === NOW.graph.require(holders[name][0])[INTERNALS_EXPORT][name]);
  const loads = NOW.graph.modules().filter((m) => m.file === ROUTE_DEFENDERS).length;
  record(
    "N1",
    "structure",
    "C0_SURFACE_FINDS_THE_DEFENDERS_IN_ROUTE_DEFENDERS",
    misplaced.length === 0 && identical.length === MOVED_VALUES.length && loads === 1 &&
      ["computePortalDefenceZone", "createSentinelState", "decideSentinelMove"].every((name) => NOW.hook[name] === NOW.api[name]),
    { holders, misplaced, sameObjectAsSurface: `${identical.length}/${MOVED_VALUES.length}`, routeDefendersEvaluations: loads },
  );
}

// N2 — every shared validator path lands there by itself: the instrumented generator's surface and the runtime
// harness (both C0) resolve the four functions and four constants to route-defenders.ts; `routeModuleDeclaring` (the
// counterfactual aim) and `locate` (textual anchors, cross-eol's `function chooseGuardianMove(` among them) find it.
{
  const LAB = loadInstrumented({ rev: REV, bare: true });
  const RUNTIME = loadRouteRuntime({ rev: REV });
  const names = ["computePortalDefenceZone", "createSentinelState", "decideSentinelMove", "chooseGuardianMove", "PORTAL_ZONE_RADIUS", "SENTINEL_LEASH", "SENTINEL_THREAT_HORIZON", "SENTINEL_COMMIT_TURNS"];
  const labHolders = Object.fromEntries(names.map((name) => [name, holderOf(LAB.graph, name)]));
  const runtimeHolders = Object.fromEntries(names.map((name) => [name, holderOf(RUNTIME.LAB.graph, name)]));
  const declaring = Object.fromEntries(MOVED_VALUES.map((name) => [name, errorOf(() => routeModuleDeclaring(name, { rev: REV })) ?? routeModuleDeclaring(name, { rev: REV })]));
  const anchors = {
    "function chooseGuardianMove(": null,
    "export function decideSentinelMove(": null,
    "  const options = getNeighbors(state.position, graph).filter((next) => {": null,
    "  if (difficulty === \"easy\" && routeRandom() < 0.45) {": null,
  };
  for (const anchor of Object.keys(anchors)) anchors[anchor] = errorOf(() => TREE.locate(anchor)) ?? TREE.locate(anchor);
  const allIn = (map) => Object.values(map).every((v) => (Array.isArray(v) ? same(v, [ROUTE_DEFENDERS]) : v === ROUTE_DEFENDERS));
  record(
    "N2",
    "structure",
    "VALIDATOR_PATHS_FOLLOW_THE_DEFENDERS",
    allIn(labHolders) && allIn(runtimeHolders) && allIn(declaring) && allIn(anchors) && names.every((name) => LAB.API[name] !== undefined && RUNTIME.API[name] !== undefined),
    { instrumentedGenerator: labHolders, runtimeHarness: runtimeHolders, routeModuleDeclaring: declaring, anchorsLocatedIn: anchors },
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
