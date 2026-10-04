/**
 * ROUTE-C1 — the Rota's grid and static configuration, extracted into
 * `src/games/escape-maze/route-config.ts`, tested.
 *
 * C1 is a pure refactor: the declarations moved, nothing they say did. Four
 * groups of checks hold it to that:
 *
 *   [structure]    WHERE the configuration lives. route-config.ts declares the
 *                  moved set (and is the only Rota module that does); the hook
 *                  declares none of it and consumes it by import; route-config
 *                  imports types only (no React, sounds, Babylon, RNG, hook);
 *                  it exports exactly what the Rota's modules consume (the
 *                  hook alone at C1; since ROUTE-C2 the hook, route-generation
 *                  and route-geometry between them); no template row,
 *                  stage copy or other copy of the configuration is left in
 *                  the hook. This is also the static gate against the
 *                  configuration drifting back into the hook.
 *   [config]       WHAT the configuration says, pinned literally: the 9x9 grid,
 *                  generation budget, start and safe cells, exit and guardian
 *                  seats, templates, stage mapping and copy, wall limits, light,
 *                  trap and separation counts, minimum path, quality and play
 *                  briefs. C1 may not change any of it.
 *   [equivalence]  the working tree against the last one-file Rota (4027baa),
 *                  both loaded through route-module-loader: every moved binding
 *                  and every helper over its whole domain equal; generated maps
 *                  identical field by field (grid, walls, start, Hunter,
 *                  Sentinel setup, exit, lights, traps, chest, RNG draws
 *                  consumed); real Routes played by the real hook to the same
 *                  ends, completion by completion.
 *   [identity]     the extraction kept the tables as shared, unfrozen
 *                  references (a map's playerStart IS PLAYER_START, a stage's
 *                  templates ARE its table entry) and nothing mutates them
 *                  through generation and play — same as before.
 *
 * `--rev=<commit>` runs every check on that tree instead of the working tree.
 * `--rev=4027baa` is the structural counterfactual: the configuration still
 * lived in useEscapeMaze.ts there, so every [structure] check must fail, while
 * every [preserved], [config], [equivalence] and [identity] check holds (same
 * values, same hook surface).
 *
 * Usage: node tools/validation/route-config-extraction-tests.mjs [--rev=<commit>]
 * Writes nothing. Exit 0 = every check holds, 1 = a check failed, 3 = usage error.
 */
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";
import { ROUTE_HOOK, ROUTE_MODULE_DIR, INTERNALS_EXPORT, loadRouteModules, openSourceTree } from "./route-module-loader.mjs";
import { loadRouteRuntime, playToEnd } from "./route-runtime-harness.mjs";

/** The last revision whose Rota was one file: what C1 must be equivalent to. */
const ONE_FILE_ROTA = "4027baab6c94e12fc53cb656344d54cf6539d052";
const ROUTE_CONFIG = "src/games/escape-maze/route-config.ts";

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
if (args.some((arg) => arg !== revArg) || REV === "") {
  console.error("usage: node tools/validation/route-config-extraction-tests.mjs [--rev=<commit>]");
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

// --- what C1 moved -------------------------------------------------------------------------------

/** Runtime bindings moved out of the hook. */
const MOVED_VALUES = [
  "ROWS", "COLS", "MAX_GENERATION_ATTEMPTS", "RECOVERY_ROUNDS", "RECOVERY_RETRIES_PER_SLOT",
  "PLAYER_START", "START_OPENING", "START_BRANCH", "START_SAFE_CELLS",
  "ROUTE_STAGE_EXIT_CANDIDATES", "GUARDIAN_CANDIDATES", "ROUTE_STAGE_GUARDIAN_CANDIDATES",
  "STAGE_ONE_TEMPLATES", "STAGE_TWO_TEMPLATES", "STAGE_THREE_TEMPLATES", "MAZE_TEMPLATES", "ROUTE_STAGE_TEMPLATES",
  "ROUTE_STAGE_COPY", "WALL_LIMITS", "BASE_STAR_COUNT", "BASE_TRAP_COUNT", "DIFFICULTY_PLAY_BRIEF", "ROUTE_STAGE_QUALITY",
  "getRouteStage", "getRouteProgression", "getWallLimits", "getStarCount", "getStarMinSeparation", "getTrapCount",
  "getMinimumPathLength", "getRouteStageTemplates",
];
/** Types moved with them. */
const MOVED_TYPES = ["RouteStage", "RouteProgression", "DifficultyPlayBrief", "RouteStageQuality"];
/**
 * What route-config.ts exports: exactly what the Rota's modules consume, nothing for convenience. At C1 the hook was the
 * only consumer; since ROUTE-C2 generation (route-generation.ts) and the board's primitives (route-geometry.ts) import
 * their share directly, and S3 requires the union of all their imports to be this list.
 */
const CONFIG_EXPORTS = [
  "COLS", "DIFFICULTY_PLAY_BRIEF", "GUARDIAN_CANDIDATES", "MAX_GENERATION_ATTEMPTS", "PLAYER_START",
  "RECOVERY_RETRIES_PER_SLOT", "RECOVERY_ROUNDS", "ROUTE_STAGE_EXIT_CANDIDATES", "ROUTE_STAGE_GUARDIAN_CANDIDATES",
  "ROUTE_STAGE_QUALITY", "ROWS", "START_SAFE_CELLS", "getMinimumPathLength", "getRouteProgression", "getRouteStage",
  "getRouteStageTemplates", "getStarCount", "getStarMinSeparation", "getTrapCount", "getWallLimits",
  "RouteProgression", "RouteStage",
].sort();
/**
 * Left in the hook on purpose (input/runtime, C5/C6) — must NOT have moved. `MazeMap` was here at C1; ROUTE-C2 moved it
 * with the generator that produces it (route-generation.ts), which route-generation-extraction-tests.mjs checks.
 * `GameStatus` was here too; ROUTE-C4 moved it with the runtime contract whose snapshot is written in it
 * (route-invariants.ts), which route-invariants-extraction-tests.mjs checks.
 */
const KEPT_IN_HOOK = ["ARROW_DELTAS", "BREAK_DIRECTION_DELTAS", "MOVE_INPUT_GUARD_MS", "BreakDirection", "BreakTarget"];
/** Runtime names C1 kept out of route-config. Whichever module holds them now, none of them is configuration. */
const NEVER_CONFIG = [...KEPT_IN_HOOK, "GameStatus"];

const DIFFICULTIES = ["easy", "medium", "hard"];
const STAGES = [1, 2, 3];

// --- harness -------------------------------------------------------------------------------------

const tests = [];
const record = (id, kind, name, pass, detail = {}) => {
  tests.push({ id, kind, name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} [${kind}] — ${name}`);
  for (const [k, v] of Object.entries(detail)) console.log(`        ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sha = (value) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
const sorted = (list) => [...list].sort();

const TREE = openSourceTree({ rev: REV });
const label = REV ? `rev ${TREE.rev.slice(0, 12)}` : "working tree";
console.log(`route-config extraction · ${label} vs one-file Rota ${ONE_FILE_ROTA.slice(0, 7)}\n`);

/** Top-level declarations of a module, by the parser: values and types, exported or not. */
function declarations(file, source) {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const out = { values: [], types: [], exported: [], imports: [], otherStatements: [] };
  const isExported = (node) => (ts.getModifiers?.(node) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  for (const statement of sf.statements) {
    if (ts.isImportDeclaration(statement)) {
      const clause = statement.importClause;
      const named = clause?.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements : [];
      out.imports.push({
        specifier: statement.moduleSpecifier.text,
        typeOnly: Boolean(clause?.isTypeOnly) || (named.length > 0 && !clause?.name && named.every((e) => e.isTypeOnly)),
        names: named.map((e) => e.name.text),
      });
    } else if (ts.isVariableStatement(statement)) {
      for (const d of statement.declarationList.declarations) {
        out.values.push(d.name.text);
        if (isExported(statement)) out.exported.push(d.name.text);
      }
    } else if (ts.isFunctionDeclaration(statement) && statement.name) {
      out.values.push(statement.name.text);
      if (isExported(statement)) out.exported.push(statement.name.text);
    } else if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
      out.types.push(statement.name.text);
      if (isExported(statement)) out.exported.push(statement.name.text);
    } else if (ts.isExportDeclaration(statement)) {
      // `export { X }` / `export type { X }` re-exports: not declarations of this module.
      if (statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        out.exported.push(...statement.exportClause.elements.map((e) => e.name.text));
      }
    } else if (!ts.isExpressionStatement(statement) || !ts.isStringLiteral(statement.expression)) {
      out.otherStatements.push(ts.SyntaxKind[statement.kind]);
    }
  }
  return out;
}

const codeOnly = (source) => source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
/** A template row: nine 0/1 cells in an array literal. */
const TEMPLATE_ROW = /\[\s*(?:[01]\s*,\s*){8}[01]\s*,?\s*\]/g;
const STAGE_COPY = ["Explora\\u00e7\\u00e3o inicial", "Novas escolhas", "Portal distante"];

// =================================================================================================
// [structure]
// =================================================================================================

const hookText = TREE.read(ROUTE_HOOK);
const hookDecl = declarations(ROUTE_HOOK, hookText);
const configExists = TREE.exists(ROUTE_CONFIG);
const configSource = configExists ? TREE.read(ROUTE_CONFIG) : "";
const configDecl = declarations(ROUTE_CONFIG, configSource);
const closure = TREE.closure(ROUTE_HOOK);

// S1 — the moved set lives in route-config.ts, and only there among the Rota's modules.
{
  const missing = [...MOVED_VALUES.filter((n) => !configDecl.values.includes(n)), ...MOVED_TYPES.filter((n) => !configDecl.types.includes(n))];
  const owners = Object.fromEntries(
    MOVED_VALUES.map((name) => {
      try {
        return [name, TREE.declaring(name)];
      } catch (error) {
        return [name, `error: ${error.message.slice(0, 80)}`];
      }
    }),
  );
  const elsewhere = Object.entries(owners).filter(([, file]) => file !== ROUTE_CONFIG);
  record("S1", "structure", "CONFIG_LIVES_IN_ROUTE_CONFIG", configExists && closure.includes(ROUTE_CONFIG) && missing.length === 0 && elsewhere.length === 0, {
    routeConfigInGraph: closure.includes(ROUTE_CONFIG),
    missingFromRouteConfig: missing,
    declaredElsewhere: Object.fromEntries(elsewhere.slice(0, 6)),
  });
}

// S2 — the hook declares none of it (values or types) and keeps what C1 left to C5/C6; no runtime name C1 kept out of
// route-config (GameStatus included, wherever it lives since ROUTE-C4) is in route-config.
{
  const redeclared = [...MOVED_VALUES, ...MOVED_TYPES].filter((n) => hookDecl.values.includes(n) || hookDecl.types.includes(n));
  const keptMissing = KEPT_IN_HOOK.filter((n) => !hookDecl.values.includes(n) && !hookDecl.types.includes(n));
  const keptMoved = NEVER_CONFIG.filter((n) => configDecl.values.includes(n) || configDecl.types.includes(n));
  record("S2", "structure", "HOOK_DECLARES_NONE_OF_IT", redeclared.length === 0 && keptMissing.length === 0 && keptMoved.length === 0, {
    redeclaredInHook: redeclared.length > 8 ? `${redeclared.length} of ${MOVED_VALUES.length + MOVED_TYPES.length}` : redeclared,
    keptInHookMissing: keptMissing,
    keptInHookButMoved: keptMoved,
  });
}

// S3 — the Rota consumes the configuration by import, every export of route-config is consumed, nothing else exported.
// ROUTE-C2: the consumers are every Rota module of the hook's graph (the hook, route-generation, route-geometry), each
// with one import declaration from route-config; the hook is still one of them.
{
  const importers = closure
    .filter((file) => file.startsWith(ROUTE_MODULE_DIR) && file !== ROUTE_CONFIG)
    .map((file) => {
      const decls = declarations(file, TREE.read(file)).imports.filter((imp) => {
        try {
          return TREE.resolve(imp.specifier, file) === ROUTE_CONFIG;
        } catch {
          return false;
        }
      });
      return { file, decls, names: decls.flatMap((imp) => imp.names) };
    })
    .filter((importer) => importer.decls.length > 0);
  const imported = sorted([...new Set(importers.flatMap((importer) => importer.names))]);
  const exported = sorted(configDecl.exported);
  record(
    "S3",
    "structure",
    "ROTA_IMPORTS_EXACTLY_WHAT_ROUTE_CONFIG_EXPORTS",
    importers.some((importer) => importer.file === ROUTE_HOOK) &&
      importers.every((importer) => importer.decls.length === 1) &&
      same(imported, CONFIG_EXPORTS) &&
      same(exported, CONFIG_EXPORTS),
    {
      importDeclarations: Object.fromEntries(importers.map((importer) => [importer.file, importer.decls.length])),
      importsByModule: Object.fromEntries(importers.map((importer) => [importer.file, importer.names.length])),
      rotaImports: imported.length,
      routeConfigExports: exported.length,
      exportedButNotExpected: exported.filter((n) => !CONFIG_EXPORTS.includes(n)),
      expectedButNotExported: CONFIG_EXPORTS.filter((n) => !exported.includes(n)),
      importedButNotExpected: imported.filter((n) => !CONFIG_EXPORTS.includes(n)),
    },
  );
}

// S4 — route-config is data: types-only imports, no run-time dependency, no side-effecting statement, no RNG.
{
  const runtimeImports = configExists ? TREE.runtimeImports(ROUTE_CONFIG) : null;
  const imports = configDecl.imports;
  const code = codeOnly(configSource);
  const forbidden = ["react", "game-sounds", "babylon", "route-random", "useEscapeMaze", "Math.random", "routeRandom", "difficulty\"", "scoring", "window", "document"].filter((word) =>
    code.includes(word),
  );
  record(
    "S4",
    "structure",
    "ROUTE_CONFIG_IS_PURE_DATA",
    configExists && same(runtimeImports, []) && imports.every((imp) => imp.typeOnly && imp.specifier === "@/types/game") && configDecl.otherStatements.length === 0 && forbidden.length === 0,
    { runtimeImports, imports, otherTopLevelStatements: configDecl.otherStatements, forbiddenMentions: forbidden },
  );
}

// S5 — no residual copy: no template row, no stage copy and no moved declaration text anywhere in the hook; every
// template row of the Rota is in route-config.ts.
{
  const hookCode = codeOnly(hookText);
  const rowsInHook = (hookCode.match(TEMPLATE_ROW) ?? []).length;
  const rowsByModule = Object.fromEntries(
    closure.filter((f) => f.startsWith(ROUTE_MODULE_DIR)).map((f) => [f, (codeOnly(TREE.read(f)).match(TEMPLATE_ROW) ?? []).length]),
  );
  const copyInHook = STAGE_COPY.filter((text) => hookText.includes(text));
  const declTextInHook = MOVED_VALUES.filter((n) => new RegExp(String.raw`(?:const|function)\s+${n}\b`).test(hookCode));
  record(
    "S5",
    "structure",
    "NO_RESIDUAL_CONFIG_IN_HOOK",
    rowsInHook === 0 && rowsByModule[ROUTE_CONFIG] === 81 && copyInHook.length === 0 && declTextInHook.length === 0,
    { templateRowsInHook: rowsInHook, templateRowsByModule: rowsByModule, stageCopyInHook: copyInHook, declarationTextInHook: declTextInHook.length },
  );
}

// =================================================================================================
// load both Rotas
// =================================================================================================

const SURFACE = [...MOVED_VALUES, "generateMaze", "posKey", "computePortalDefenceZone", "createSentinelState"];
const NOW = loadRouteModules({ rev: REV, surface: SURFACE });
const ONE = loadRouteModules({ rev: ONE_FILE_ROTA, surface: SURFACE });
const A = NOW.api;
const B = ONE.api;
const configFile = (rota) => rota.graph.modules().find((m) => Object.hasOwn(rota.graph.require(m.file)[INTERNALS_EXPORT] ?? {}, "ROWS"))?.file;

// S6 — the hook's public run-time surface is unchanged by the move (ROWS/COLS are still exported from it, and are
// route-config's own bindings, not copies).
{
  const surface = (rota) => sorted(Object.keys(rota.hook).filter((k) => k !== INTERNALS_EXPORT));
  const now = surface(NOW);
  const one = surface(ONE);
  record("S6", "preserved", "HOOK_PUBLIC_SURFACE_UNCHANGED", same(now, one) && NOW.hook.ROWS === A.ROWS && NOW.hook.COLS === A.COLS, {
    hookExports: now,
    configDeclaredIn: { now: configFile(NOW), oneFile: configFile(ONE) },
  });
}

// =================================================================================================
// [config] — the values, literally
// =================================================================================================

const P = (row, col) => ({ row, col });
record("C1", "config", "GRID_AND_GENERATION_BUDGET", A.ROWS === 9 && A.COLS === 9 && A.MAX_GENERATION_ATTEMPTS === 500 && A.RECOVERY_ROUNDS === 3 && A.RECOVERY_RETRIES_PER_SLOT === 12, {
  grid: `${A.ROWS}x${A.COLS}`,
  attempts: A.MAX_GENERATION_ATTEMPTS,
  recovery: `${A.RECOVERY_ROUNDS} rounds x ${A.RECOVERY_RETRIES_PER_SLOT} retries`,
});
record(
  "C2",
  "config",
  "START_AND_SAFE_CELLS",
  same(A.PLAYER_START, P(8, 0)) && same(A.START_OPENING, P(8, 1)) && same(A.START_BRANCH, P(7, 0)) && same(A.START_SAFE_CELLS, [P(8, 0), P(8, 1), P(7, 0), P(7, 1)]),
  { playerStart: A.PLAYER_START, startSafeCells: A.START_SAFE_CELLS },
);
record(
  "C3",
  "config",
  "EXIT_CANDIDATES",
  same(A.ROUTE_STAGE_EXIT_CANDIDATES, { 1: [P(2, 8), P(2, 7)], 2: [P(1, 8), P(0, 7), P(0, 8)], 3: [P(0, 8), P(0, 7)] }),
  { exits: A.ROUTE_STAGE_EXIT_CANDIDATES },
);
record(
  "C4",
  "config",
  "GUARDIAN_CANDIDATES",
  same(A.GUARDIAN_CANDIDATES, [P(0, 4), P(1, 6), P(2, 8), P(0, 8), P(3, 7)]) &&
    same(A.ROUTE_STAGE_GUARDIAN_CANDIDATES, {
      1: [P(0, 3), P(1, 5), P(2, 6)],
      2: [P(2, 3), P(1, 4), P(2, 5), P(0, 3)],
      3: [P(1, 4), P(2, 3), P(0, 3), P(1, 5)],
    }),
  { fallback: A.GUARDIAN_CANDIDATES, perStage: A.ROUTE_STAGE_GUARDIAN_CANDIDATES },
);
{
  const hashes = STAGES.map((s) => sha(A.ROUTE_STAGE_TEMPLATES[s]));
  const wallCounts = STAGES.map((s) => A.ROUTE_STAGE_TEMPLATES[s].map((t) => t.flat().filter((c) => c === 1).length));
  const shapeOk = STAGES.every((s) => A.ROUTE_STAGE_TEMPLATES[s].length === 3 && A.ROUTE_STAGE_TEMPLATES[s].every((t) => t.length === 9 && t.every((r) => r.length === 9 && r.every((c) => c === 0 || c === 1))));
  record(
    "C5",
    "config",
    "TEMPLATES",
    shapeOk &&
      same(hashes, ["7899eacfa5151247", "2187f9405ad26ce9", "ba78ae56b6f1b501"]) &&
      same(wallCounts, [[17, 18, 19], [21, 21, 22], [25, 28, 25]]) &&
      A.ROUTE_STAGE_TEMPLATES[1] === A.STAGE_ONE_TEMPLATES && A.ROUTE_STAGE_TEMPLATES[2] === A.STAGE_TWO_TEMPLATES && A.ROUTE_STAGE_TEMPLATES[3] === A.STAGE_THREE_TEMPLATES &&
      same(A.MAZE_TEMPLATES, [...A.STAGE_ONE_TEMPLATES, ...A.STAGE_TWO_TEMPLATES, ...A.STAGE_THREE_TEMPLATES]) &&
      STAGES.every((s) => A.getRouteStageTemplates(s) === A.ROUTE_STAGE_TEMPLATES[s]) &&
      A.getRouteStageTemplates(4) === A.MAZE_TEMPLATES,
    { sha256ByStage: hashes, wallsPerTemplate: wallCounts, mazeTemplates: A.MAZE_TEMPLATES.length },
  );
}
{
  const stages = [-5, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => A.getRouteStage(n));
  const progression = [1, 2, 3, 4].map((n) => A.getRouteProgression(n));
  const copy = {
    1: { label: "Exploração inicial", description: "Um mapa mais aberto para observar a rota." },
    2: { label: "Novas escolhas", description: "Mais caminhos pedem uma decisão por vez." },
    3: { label: "Portal distante", description: "A rota pede planejamento com calma." },
  };
  record(
    "C6",
    "config",
    "STAGE_MAPPING_AND_COPY",
    same(stages, [1, 1, 1, 2, 3, 1, 2, 3, 1, 2, 3, 1]) &&
      same(A.ROUTE_STAGE_COPY, copy) &&
      same(progression, [1, 2, 3, 4].map((n) => ({ routeNumber: n, stage: ((n - 1) % 3) + 1, ...copy[((n - 1) % 3) + 1] }))),
    { stageOfRoute: Object.fromEntries([-5, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n, i) => [n, stages[i]])), progression },
  );
}
const table = (fn) => Object.fromEntries(DIFFICULTIES.map((d) => [d, STAGES.map((s) => fn(d, s))]));
{
  const limits = table((d, s) => A.getWallLimits(d, s));
  const L = (min, max) => ({ min, max });
  record(
    "C7",
    "config",
    "WALL_LIMITS",
    same(A.WALL_LIMITS, { easy: L(13, 18), medium: L(18, 23), hard: L(25, 30) }) &&
      same(limits, { easy: [L(10, 15), L(13, 18), L(14, 19)], medium: [L(15, 20), L(18, 23), L(19, 24)], hard: [L(22, 27), L(25, 30), L(26, 31)] }) &&
      A.getWallLimits("medium", 2) === A.WALL_LIMITS.medium,
    { byModeAndStage: limits },
  );
}
{
  const stars = table((d, s) => A.getStarCount(d, s));
  const traps = table((d, s) => A.getTrapCount(d, s));
  const separation = table((d, s) => A.getStarMinSeparation(d, s));
  const minPath = STAGES.map((s) => A.getMinimumPathLength(s));
  record("C8", "config", "STAR_COUNTS", same(A.BASE_STAR_COUNT, { easy: 3, medium: 4, hard: 6 }) && same(stars, { easy: [3, 3, 4], medium: [4, 4, 5], hard: [6, 6, 6] }), { stars });
  record("C9", "config", "TRAP_COUNTS", same(A.BASE_TRAP_COUNT, { easy: 3, medium: 4, hard: 5 }) && same(traps, { easy: [2, 3, 4], medium: [3, 4, 5], hard: [4, 5, 6] }), { traps });
  record("C10", "config", "STAR_SEPARATION", same(separation, { easy: [2, 2, 3], medium: [2, 2, 3], hard: [2, 2, 4] }), { separation });
  record("C11", "config", "MINIMUM_PATH", same(minPath, [7, 8, 10]), { minPath });
}
{
  const Q = (minReachableCells, minJunctions, guardianMinStartDistance, starMinStartDistance, starMinSeparation, trapMinStartDistance, trapMinSeparation, chestMinStartDistance, chestTargetDistance, wallRandomizationAttempts) => ({
    minReachableCells, minJunctions, maxStartZoneWalls: 0, guardianMinStartDistance, starMinStartDistance, starMinExitDistance: 2,
    starMinSeparation, trapMinStartDistance, trapMinSeparation, chestMinStartDistance, chestTargetDistance, wallRandomizationAttempts,
  });
  const B_ = (minDecisionRatio, maxForcedStreak, maxIdleDeadEnds, min, max) => ({ minDecisionRatio, maxForcedStreak, maxIdleDeadEnds, guardianStartDistance: { min, max } });
  record(
    "C12",
    "config",
    "QUALITY_AND_PLAY_BRIEF",
    same(A.ROUTE_STAGE_QUALITY, { 1: Q(53, 10, 9, 3, 2, 4, 3, 3, 4, 8), 2: Q(50, 9, 8, 3, 2, 3, 2, 4, 5, 14), 3: Q(45, 8, 8, 4, 3, 4, 2, 4, 6, 26) }) &&
      same(A.DIFFICULTY_PLAY_BRIEF, { easy: B_(0.62, 3, 0, 8, 13), medium: B_(0.55, 4, 1, 7, 12), hard: B_(0.46, 6, 2, 6, 11) }),
    { qualitySha: sha(A.ROUTE_STAGE_QUALITY), playBriefSha: sha(A.DIFFICULTY_PLAY_BRIEF) },
  );
}

// =================================================================================================
// [equivalence] — against the one-file Rota
// =================================================================================================

// E1 — every moved binding, and every helper over its whole domain, equal.
{
  const helperDomain = (api) => ({
    stage: Array.from({ length: 14 }, (_, i) => api.getRouteStage(i - 1)),
    progression: Array.from({ length: 10 }, (_, i) => api.getRouteProgression(i)),
    wallLimits: Object.fromEntries(DIFFICULTIES.map((d) => [d, STAGES.map((s) => api.getWallLimits(d, s))])),
    stars: Object.fromEntries(DIFFICULTIES.map((d) => [d, STAGES.map((s) => api.getStarCount(d, s))])),
    separation: Object.fromEntries(DIFFICULTIES.map((d) => [d, STAGES.map((s) => api.getStarMinSeparation(d, s))])),
    traps: Object.fromEntries(DIFFICULTIES.map((d) => [d, STAGES.map((s) => api.getTrapCount(d, s))])),
    minPath: STAGES.map((s) => api.getMinimumPathLength(s)),
    templates: [1, 2, 3, 4].map((s) => api.getRouteStageTemplates(s)),
  });
  const differing = MOVED_VALUES.filter((n) => typeof A[n] !== "function" && !same(A[n], B[n]));
  const helpersSame = same(helperDomain(A), helperDomain(B));
  record("E1", "equivalence", "CONFIG_AND_HELPERS_EQUAL", differing.length === 0 && helpersSame, {
    dataBindingsCompared: MOVED_VALUES.filter((n) => typeof A[n] !== "function").length,
    helpersComparedOverDomain: MOVED_VALUES.filter((n) => typeof A[n] === "function").length,
    differing,
    helpersSame,
  });
}

// E2 — generated maps identical, field by field, and the same number of random draws consumed.
const SEEDS = Array.from({ length: 20 }, (_, i) => 1009 + i * 7919);
const ROUTES = [1, 2, 3, 4, 5, 6];
function canonical(rota, difficulty, routeNumber, seed) {
  const api = rota.api;
  rota.setSeed(seed);
  const map = api.generateMaze(difficulty, routeNumber);
  const zone = api.computePortalDefenceZone(map.playerStart, map.exitPosition, map.walls);
  const sentinel = api.createSentinelState(map, zone);
  return {
    grid: map.grid.map((row) => row.join("")).join("/"),
    walls: [...map.walls].sort().join(" "),
    playerStart: api.posKey(map.playerStart),
    guardianStart: api.posKey(map.guardianStart),
    exitPosition: api.posKey(map.exitPosition),
    lights: map.collectibleStars.map(api.posKey).join(" "),
    traps: map.traps.map(api.posKey).join(" "),
    chest: map.chest ? api.posKey(map.chest) : null,
    sentinel: { start: api.posKey(sentinel.position), target: sentinel.target, commitLeft: sentinel.commitLeft },
    portalZone: { zone: zone.zone.map(api.posKey).join(" "), accesses: zone.accesses.map(api.posKey).join(" ") },
    nextDraw: rota.seededMath.random(),
  };
}
{
  const diffs = [];
  let compared = 0;
  const fields = new Set();
  const digest = crypto.createHash("sha256");
  for (const routeNumber of ROUTES) {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of SEEDS) {
        const a = canonical(NOW, difficulty, routeNumber, seed);
        const b = canonical(ONE, difficulty, routeNumber, seed);
        Object.keys(a).forEach((k) => fields.add(k));
        compared += 1;
        digest.update(JSON.stringify(a));
        if (!same(a, b)) diffs.push({ routeNumber, difficulty, seed, fields: Object.keys(a).filter((k) => !same(a[k], b[k])) });
      }
    }
  }
  record("E2", "equivalence", "GENERATED_MAPS_IDENTICAL", diffs.length === 0 && compared === ROUTES.length * DIFFICULTIES.length * SEEDS.length, {
    mapsCompared: `${compared} (routes ${ROUTES.join(",")} x ${DIFFICULTIES.length} modes x ${SEEDS.length} seeds)`,
    fieldsPerMap: [...fields],
    digest: digest.digest("hex").slice(0, 16),
    diffs: diffs.slice(0, 5),
  });
}

// E3 — the real hook, mounted by the runtime harness, plays the same Routes to the same ends.
{
  const play = (rev) => {
    const runtime = loadRouteRuntime({ rev });
    const out = [];
    for (const routeNumber of [1, 2, 3]) {
      for (const difficulty of DIFFICULTIES) {
        for (const policy of ["win", "lose"]) {
          const run = runtime.mount({ seed: 500 + routeNumber * 10 + DIFFICULTIES.indexOf(difficulty), routeNumber, difficulty });
          const end = playToEnd(run, policy);
          const g = run.state;
          out.push({
            routeNumber, difficulty, policy, end,
            progression: g.routeProgression,
            mode: g.difficulty,
            player: g.player, guardian: g.guardian, sentinel: g.sentinel,
            turns: g.turns, lights: `${g.collectedCount}/${g.totalLights}`, trapsTriggered: g.trapsTriggered,
            chest: [g.chestPosition, g.chestOpened, g.rewardSelected, g.rewardSpent, g.brokenWall],
            walls: [...g.mazeMap.walls].sort().join(" "),
            completions: JSON.parse(JSON.stringify(run.completions)),
          });
        }
      }
    }
    return out;
  };
  const now = play(REV);
  const one = play(ONE_FILE_ROTA);
  const diffs = now.map((r, i) => (same(r, one[i]) ? null : `${r.routeNumber}/${r.difficulty}/${r.policy}`)).filter(Boolean);
  const ends = {};
  for (const r of now) ends[r.end] = (ends[r.end] ?? 0) + 1;
  record("E3", "equivalence", "RUNTIME_PLAYS_IDENTICAL", diffs.length === 0 && now.length === 18 && now.some((r) => r.completions.length > 0), {
    runs: now.length,
    ends,
    progressions: [...new Set(now.map((r) => `${r.progression.routeNumber}:${r.progression.stage}:${r.progression.label}`))],
    diffs,
  });
}

// =================================================================================================
// [identity] — shared references, unfrozen, unmutated — as before
// =================================================================================================
{
  const probe = (rota) => {
    const api = rota.api;
    const tables = MOVED_VALUES.filter((n) => typeof api[n] !== "function");
    const before = JSON.stringify(tables.map((n) => api[n]));
    rota.setSeed(77);
    const maps = STAGES.flatMap((s) => DIFFICULTIES.map((d) => api.generateMaze(d, s)));
    return {
      mapStartIsPlayerStart: maps.every((m) => m.playerStart === api.PLAYER_START),
      startSafeHoldsPlayerStart: api.START_SAFE_CELLS[0] === api.PLAYER_START,
      stageTemplatesAreTableEntries: STAGES.every((s) => api.getRouteStageTemplates(s) === api.ROUTE_STAGE_TEMPLATES[s]),
      wallLimitsSharedForStageTwo: api.getWallLimits("hard", 2) === api.WALL_LIMITS.hard,
      anythingFrozen: tables.some((n) => typeof api[n] === "object" && Object.isFrozen(api[n])),
      tablesUnchangedByGeneration: JSON.stringify(tables.map((n) => api[n])) === before,
    };
  };
  const now = probe(NOW);
  const one = probe(ONE);
  record(
    "I1",
    "identity",
    "SHARED_UNFROZEN_UNMUTATED_AS_BEFORE",
    same(now, one) && now.mapStartIsPlayerStart && now.stageTemplatesAreTableEntries && !now.anythingFrozen && now.tablesUnchangedByGeneration,
    { now, oneFile: same(now, one) ? "identical" : one },
  );
}

// =================================================================================================

const failing = tests.filter((t) => !t.pass).map((t) => t.id);
const tally = (kind) => {
  const of = tests.filter((t) => t.kind === kind);
  return `${of.filter((t) => t.pass).length}/${of.length}`;
};
console.log(
  `\n${REV ? `rev ${TREE.rev.slice(0, 12)} · ` : ""}${tests.length - failing.length}/${tests.length} passed · structure ${tally("structure")} · preserved ${tally("preserved")} · ` +
    `config ${tally("config")} · equivalence ${tally("equivalence")} · identity ${tally("identity")} · failing: ${failing.join(", ") || "none"}`,
);
process.exitCode = failing.length ? EXIT_VALIDATION_FAILED : EXIT_OK;
