/**
 * ROUTE-C0 — route-module-loader.mjs, tested.
 *
 * The loader is now what every Rota validator stands on, so it gets its own
 * contract. Three groups:
 *
 *   [loader]      resolution (`./`, `../`, `@/`), TS/TSX transpilation, one
 *                 instance per module, mocks, worktree vs `--rev` sources,
 *                 per-module overrides and transforms, clear errors, cycles,
 *                 line endings — on small in-memory fixtures and on the Rota.
 *   [extraction]  the point of C0: useEscapeMaze.ts is split IN MEMORY the way
 *                 C1 would split it (grid/config constants into one module, a
 *                 generation helper that draws from route-random into
 *                 another), and the instrumented generator, the runtime
 *                 harness and a declaration-aimed counterfactual all keep
 *                 working, map for map. Production is not touched.
 *                 ROUTE-C1 made production multi-file for real, so the
 *                 synthetic split is now taken from the last one-file hook
 *                 (C0's head, read with `rev`) — the exercise is unchanged —
 *                 and X6 holds the real split to the synthetic one.
 *   [counterfactual]  the loader the validators used at 5d541b2 (read from git)
 *                 cannot load that same split Rota, nor the real one.
 *
 * Fixtures are virtual (`sourceOverrides`) under a directory that does not
 * exist; the last check proves nothing on disk moved.
 *
 * Usage: node tools/validation/route-module-loader-tests.mjs
 * Writes nothing. Exit 0 = every check holds, 1 = a check failed.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import ts from "typescript";
import { EXIT_OK, EXIT_VALIDATION_FAILED } from "./evidence.mjs";
import { loadInstrumented } from "./instrumented-generator.mjs";
import { DIRECT_DIFFICULTY_START_GAME, loadRouteRuntime, playToEnd } from "./route-runtime-harness.mjs";
import {
  INTERNALS_EXPORT,
  ROUTE_HOOK,
  anchoredEdits,
  createModuleGraph,
  loadRouteModules,
  normalizeSource,
  openSourceTree,
} from "./route-module-loader.mjs";

const ROOT = process.cwd();
const BASELINE = "5d541b228247621a6521852db8d4d913ebb55be2";
/** The last revision whose Rota was one file (ROUTE-C0's head): the synthetic split starts from its hook. */
const ONE_FILE_ROTA = "4027baab6c94e12fc53cb656344d54cf6539d052";
const FIX = "src/__route_loader_fixtures__";

const tests = [];
const record = (id, kind, name, pass, detail = {}) => {
  tests.push({ id, kind, name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} [${kind}] — ${name}`);
  for (const [k, v] of Object.entries(detail)) {
    console.log(`        ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  }
};
const errorOf = (fn) => {
  try {
    fn();
    return null;
  } catch (error) {
    return String(error.message);
  }
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sha = (text) => crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);

// --- what the repository looks like before any of this runs -----------------------------------

const srcSnapshot = () => {
  const out = new Map();
  const walk = (dir) => {
    for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, item.name);
      if (item.isDirectory()) walk(full);
      else {
        const stat = fs.statSync(full);
        out.set(path.relative(ROOT, full), `${stat.mtimeMs}:${sha(fs.readFileSync(full))}`);
      }
    }
  };
  walk(path.join(ROOT, "src"));
  return out;
};
const porcelain = () => execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" });
const SRC_BEFORE = srcSnapshot();
const STATUS_BEFORE = porcelain();

// =================================================================================================
// [loader] — fixtures
// =================================================================================================

const fixtures = {
  [`${FIX}/app/entry.ts`]: [
    'import { double } from "./sibling";',
    'import { tag } from "../shared/util";',
    'import { tag as aliasTag, counter } from "@/__route_loader_fixtures__/shared/util";',
    'import type { Shape } from "../shared/types";',
    "enum Mode { Easy = 1, Hard = 2 }",
    "const shape: Shape = { side: 3 } as const;",
    "export const result = double(shape.side) + Mode.Hard;",
    "export const sameTag = tag === aliasTag;",
    "export const counted = counter();",
  ].join("\n"),
  [`${FIX}/app/sibling.ts`]: 'import { counter } from "../shared/util";\nexport function double(n: number): number { counter(); return n * 2; }\n',
  [`${FIX}/shared/util.ts`]: "let calls = 0;\nexport const tag = { id: \"util\" };\nexport function counter(): number { return ++calls; }\n(globalThis as { __utilEvaluations?: number }).__utilEvaluations = ((globalThis as { __utilEvaluations?: number }).__utilEvaluations ?? 0) + 1;\n",
  [`${FIX}/shared/types.ts`]: "export interface Shape { side: number }\n",
  [`${FIX}/shared/index.ts`]: 'export { tag } from "./util";\n',
  [`${FIX}/dir-import.ts`]: 'export { tag } from "./shared";\n',
  [`${FIX}/view.tsx`]: "export const View = ({ n }: { n: number }) => <b data-n={n}>{n * 2}</b>;\n",
  [`${FIX}/env.ts`]: 'import { useState } from "react";\nimport { playSuccessChime } from "@/lib/game-sounds";\nexport const env = { useState, playSuccessChime };\n',
  [`${FIX}/bare.ts`]: 'import leftPad from "left-pad";\nexport const padded = leftPad("1", 3);\n',
  [`${FIX}/missing.ts`]: 'import { nothing } from "./not-there";\nexport const x = nothing;\n',
  [`${FIX}/escape.ts`]: 'import { x } from "../../../outside";\nexport const y = x;\n',
  [`${FIX}/cycle-a.ts`]: 'import { b } from "./cycle-b";\nexport function a(n: number): number { return n <= 0 ? 0 : 1 + b(n - 1); }\n(globalThis as { __cycleA?: number }).__cycleA = ((globalThis as { __cycleA?: number }).__cycleA ?? 0) + 1;\n',
  [`${FIX}/cycle-b.ts`]: 'import { a } from "./cycle-a";\nexport function b(n: number): number { return n <= 0 ? 0 : 10 + a(n - 1); }\n(globalThis as { __cycleB?: number }).__cycleB = ((globalThis as { __cycleB?: number }).__cycleB ?? 0) + 1;\n',
  [`${FIX}/crlf.ts`]: "export const lines = `one\r\ntwo\r\nthree`;\r\nexport function hasCR(): boolean { return lines.includes(\"\\r\"); }\r\n",
  [`${FIX}/broken.ts`]: "export const ok = 1;\n",
  [`${FIX}/private.ts`]: "const hidden = 41;\nfunction reveal(): number { return hidden + 1; }\nexport const visible = reveal();\n",
  [`${FIX}/private-twin.ts`]: "const hidden = 7;\nexport const twin = hidden;\n",
};
const fixtureGraph = (options = {}) =>
  createModuleGraph({
    sourceOverrides: { ...fixtures, ...options.sourceOverrides },
    transforms: options.transforms,
    mocks: options.mocks ?? {},
    exposeInternals: options.exposeInternals,
  });

// L1 / L2 — relative and alias imports resolve to the same file, evaluated once.
{
  const graph = fixtureGraph();
  const entry = graph.require(`${FIX}/app/entry.ts`);
  const files = graph.modules().map((m) => m.file);
  const utilEvaluations = graph.sandbox.__utilEvaluations;
  record("L1", "loader", "RELATIVE_IMPORTS_RESOLVE", entry.result === 8 && files.includes(`${FIX}/app/sibling.ts`) && files.includes(`${FIX}/shared/util.ts`), {
    result: entry.result,
    loaded: files,
  });
  record(
    "L2",
    "loader",
    "ALIAS_AND_RELATIVE_ARE_ONE_MODULE",
    entry.sameTag === true && utilEvaluations === 1 && entry.counted === 2 && files.filter((f) => f.endsWith("shared/util.ts")).length === 1,
    {
      sameTagObject: entry.sameTag,
      utilEvaluations,
      counterAfterBothImporters: entry.counted,
      typeOnlyModuleLoaded: files.includes(`${FIX}/shared/types.ts`),
    },
  );
  const dir = fixtureGraph().require(`${FIX}/dir-import.ts`);
  record("L3", "loader", "DIRECTORY_INDEX_RESOLVES", dir.tag?.id === "util", { tag: dir.tag });
}

// L4 — TypeScript and TSX are transpiled (enums, `as const`, types erased, JSX through the mocked runtime).
{
  const calls = [];
  const graph = fixtureGraph({ mocks: { "react/jsx-runtime": { jsx: (type, props) => (calls.push(type), { type, props }) } } });
  const view = graph.require(`${FIX}/view.tsx`).View({ n: 4 });
  const entry = fixtureGraph().require(`${FIX}/app/entry.ts`);
  record("L4", "loader", "TS_AND_TSX_TRANSPILE", entry.result === 8 && view.type === "b" && view.props.children === 8 && view.props["data-n"] === 4, {
    enumAndAsConst: entry.result,
    jsx: { type: view.type, children: view.props.children },
  });
}

// L5 — mocks: answered as given (same object to every importer), by specifier or by repository path; the real
// module behind a path mock is never evaluated.
{
  const react = { useState: () => ["mocked", () => {}] };
  const sounds = { playSuccessChime: () => "silent" };
  const graph = fixtureGraph({ mocks: { react, "src/lib/game-sounds.ts": sounds } });
  const { env } = graph.require(`${FIX}/env.ts`);
  const files = graph.modules().map((m) => m.file);
  record(
    "L5",
    "loader",
    "INJECTED_MOCKS",
    env.useState === react.useState && env.playSuccessChime === sounds.playSuccessChime && !files.includes("src/lib/game-sounds.ts"),
    { realSoundsEvaluated: files.includes("src/lib/game-sounds.ts"), loaded: files },
  );
}

// L6 — unsupported imports fail clearly: a bare package without a mock, a file that is not there, a path that
// leaves the repository, and TypeScript that does not compile.
{
  const bare = errorOf(() => fixtureGraph().require(`${FIX}/bare.ts`));
  const missing = errorOf(() => fixtureGraph().require(`${FIX}/missing.ts`));
  const escape = errorOf(() => fixtureGraph().require(`${FIX}/escape.ts`));
  const broken = errorOf(() =>
    fixtureGraph({ transforms: { [`${FIX}/broken.ts`]: () => "export const ok = (;\n" } }).require(`${FIX}/broken.ts`),
  );
  const pass =
    /"left-pad".*not a repository module.*mocks/.test(bare ?? "") &&
    /bare\.ts/.test(bare ?? "") &&
    /"\.\/not-there".*resolves to no file.*tried/.test(missing ?? "") &&
    /leaves the repository/.test(escape ?? "") &&
    /broken\.ts:1:\d+ does not compile/.test(broken ?? "");
  record("L6", "loader", "UNSUPPORTED_IMPORTS_FAIL_CLEARLY", pass, { bare, missing, escape, broken });
}

// L7 — a cycle terminates, each side is evaluated once, and calls across it work (Node's CommonJS semantics).
{
  const graph = fixtureGraph();
  const { a } = graph.require(`${FIX}/cycle-a.ts`);
  const { b } = graph.require(`${FIX}/cycle-b.ts`);
  record("L7", "loader", "CYCLES_EVALUATE_ONCE", a(3) === 12 && b(2) === 11 && graph.sandbox.__cycleA === 1 && graph.sandbox.__cycleB === 1, {
    a3: a(3),
    b2: b(2),
    evaluations: { a: graph.sandbox.__cycleA, b: graph.sandbox.__cycleB },
  });
}

// L8 — line endings are normalised in one place: an override, a transform's output and the tree's reads.
{
  const tree = openSourceTree({ sourceOverrides: fixtures });
  const viaTransform = fixtureGraph({ transforms: (source) => source.replace(/\n/g, "\r\n") });
  viaTransform.require(`${FIX}/app/entry.ts`);
  const compiled = viaTransform.compiledSource(`${FIX}/app/entry.ts`);
  const lfAnchor = "export const lines = `one\ntwo";
  const edited = fixtureGraph({ transforms: anchoredEdits(tree, [[lfAnchor, "export const lines = `ONE\ntwo"]], { entry: `${FIX}/crlf.ts` }) });
  const crlf = edited.require(`${FIX}/crlf.ts`);
  record(
    "L8",
    "loader",
    "LINE_ENDINGS_NORMALISED_ONCE",
    !tree.read(`${FIX}/crlf.ts`).includes("\r") && !compiled.includes("\r") && crlf.hasCR() === false && crlf.lines.startsWith("ONE"),
    { overrideHasCR: tree.read(`${FIX}/crlf.ts`).includes("\r"), transformOutputHasCR: compiled.includes("\r"), lfAnchorMatchedCrlfSource: crlf.lines.startsWith("ONE") },
  );
}

// L9 — private bindings are reachable by name; a missing or doubly-declared name is an error naming it.
{
  const graph = fixtureGraph({ exposeInternals: (file) => file.startsWith(FIX) });
  graph.require(`${FIX}/private.ts`);
  const one = graph.internals(["hidden", "reveal"]);
  graph.require(`${FIX}/private-twin.ts`);
  const ambiguous = errorOf(() => graph.internals(["hidden"]));
  const missing = errorOf(() => graph.internals(["nowhere"]));
  record(
    "L9",
    "loader",
    "INTERNALS_BY_DECLARATION",
    one.hidden === 41 && one.reveal() === 42 && /more than one module: hidden/.test(ambiguous ?? "") && /no loaded module declares: nowhere/.test(missing ?? ""),
    { hidden: one.hidden, ambiguous, missing },
  );
}

// =================================================================================================
// [loader] — the Rota
// =================================================================================================

// L10 — route-random exists once: several modules of the Rota's graph import it (difficulty.ts among them), it is
// evaluated once, and a seed armed through the handle the harness exposes is the one generation draws from.
// ROUTE-C3: the hook itself no longer imports the seam — the Hunter's draws left with `chooseGuardianMove` for
// route-defenders.ts — so the importers are read off the hook's run-time closure instead of naming the hook.
{
  const counted = loadRouteModules({
    transforms: {
      "src/engine/route-random.ts": (source) =>
        `${source}\n(globalThis as { __routeRandomInstances?: number }).__routeRandomInstances = ((globalThis as { __routeRandomInstances?: number }).__routeRandomInstances ?? 0) + 1;\n`,
    },
    surface: ["generateMaze", "posKey"],
  });
  const importers = counted.graph.tree
    .closure()
    .filter((file) => counted.graph.tree.runtimeImports(file).includes("@/engine/route-random"));
  const instances = counted.sandbox.__routeRandomInstances;
  const handle = counted.routeRandom;
  const sameObject = handle === counted.graph.require("@/engine/route-random") && handle === counted.graph.require("src/engine/route-random.ts");
  const canonical = (map) => JSON.stringify({ walls: [...map.walls].sort(), stars: map.collectibleStars, exit: map.exitPosition, guardian: map.guardianStart });
  handle.armRouteRandomSeed(424242);
  const first = canonical(counted.api.generateMaze("hard", 3));
  counted.setSeed(1); // the sandbox's Math stream moves; the armed seam must not care
  const second = canonical(counted.api.generateMaze("hard", 3));
  const armedSeen = handle.getArmedRouteSeed();
  handle.clearRouteRandomSeed();
  record(
    "L10",
    "identity",
    "ROUTE_RANDOM_IS_ONE_INSTANCE",
    importers.length >= 2 && importers.includes("src/engine/difficulty.ts") && instances === 1 && sameObject && first === second && armedSeen === 424242,
    { importers, evaluations: instances, sameObjectByAliasAndPath: sameObject, armedSeedReproducesGeneration: first === second },
  );
}

// L11 — the working tree: the hook as read is the file on disk, normalised; every module says where it came from.
{
  const rota = loadRouteModules({ surface: ["ROWS"] });
  const onDisk = normalizeSource(fs.readFileSync(path.join(ROOT, ROUTE_HOOK), "utf8"));
  const origins = [...new Set(rota.graph.modules().map((m) => m.origin))];
  record("L11", "rev", "WORKTREE_SOURCE", rota.graph.tree.read(ROUTE_HOOK) === onDisk && same(origins, ["worktree"]), {
    modules: rota.graph.modules().map((m) => m.file),
    origins,
  });
}

// L12 — `rev`: EVERY module of the graph comes from that commit (not an old hook over today's engine), and a module
// the old hook never imported is not loaded at all.
{
  const REV = "7b740e4";
  const rota = loadRouteModules({ rev: REV, surface: ["generateMaze"] });
  const commit = rota.graph.tree.rev;
  const modules = rota.graph.modules();
  const fromRev = modules.every((m) => m.origin === `rev:${commit}`);
  const textsMatchGit = modules.every(
    (m) => rota.graph.tree.read(m.file) === normalizeSource(execFileSync("git", ["show", `${commit}:${m.file}`], { cwd: ROOT, encoding: "utf8" })),
  );
  const continuationDiffers =
    normalizeSource(execFileSync("git", ["show", `${commit}:src/games/escape-maze/continuation.ts`], { cwd: ROOT, encoding: "utf8" })) !==
    normalizeSource(fs.readFileSync(path.join(ROOT, "src/games/escape-maze/continuation.ts"), "utf8"));
  const unknown = errorOf(() => openSourceTree({ rev: "not-a-revision-c0" }));
  record(
    "L12",
    "rev",
    "REV_LOADS_ONE_COHERENT_TREE",
    fromRev && textsMatchGit && !modules.some((m) => m.file.endsWith("continuation.ts")) && continuationDiffers && /unknown revision/.test(unknown ?? ""),
    { rev: commit, modules: modules.map((m) => m.file), allFromRev: fromRev, textsMatchGitShow: textsMatchGit, unknownRevision: unknown },
  );
}

// L13 — a source override replaces ONE module, in memory, also on top of a revision (the only way to mix trees).
{
  const file = "src/games/escape-maze/continuation.ts";
  const original = openSourceTree().read(file);
  const overridden = original.replace("export const ROUTE_JOURNEY_FINAL_ROUTE = 3;", "export const ROUTE_JOURNEY_FINAL_ROUTE = 5;");
  const rota = loadRouteModules({ rev: BASELINE, sourceOverrides: { [file]: overridden }, surface: ["generateMaze"] });
  const continuation = rota.graph.require(file);
  const origins = Object.fromEntries(rota.graph.modules().map((m) => [m.file, m.origin.startsWith("rev:") ? "rev" : m.origin]));
  record(
    "L13",
    "loader",
    "PER_MODULE_SOURCE_OVERRIDE",
    overridden !== original &&
      continuation.ROUTE_JOURNEY_FINAL_ROUTE === 5 &&
      continuation.nextJourneyRoute(4, false) === 5 &&
      origins[file] === "override" &&
      origins[ROUTE_HOOK] === "rev" &&
      openSourceTree().read(file) === original,
    { origins, finalRoute: continuation.ROUTE_JOURNEY_FINAL_ROUTE, worktreeUntouched: openSourceTree().read(file) === original },
  );
}

// L14 — a transform aimed at ONE module changes that module and nothing else.
{
  const file = "src/engine/difficulty.ts";
  const plain = loadRouteModules({ surface: ["posKey"] });
  const patched = loadRouteModules({
    transforms: { [file]: (source) => source.replace("return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);", "return 0;") },
    surface: ["posKey"],
  });
  const changed = plain.graph.modules().filter((m) => plain.graph.compiledSource(m.file) !== patched.graph.compiledSource(m.file)).map((m) => m.file);
  const distance = patched.graph.require(file).manhattanDistance({ row: 0, col: 0 }, { row: 3, col: 4 });
  record("L14", "loader", "PER_MODULE_TRANSFORM", same(changed, [file]) && distance === 0 && plain.graph.require(file).manhattanDistance({ row: 0, col: 0 }, { row: 3, col: 4 }) === 7, {
    modulesWhoseTextChanged: changed,
    patchedDistance: distance,
  });
}

// L15 — transforms compose through every layer: the harness's own edit (directDifficulty) and a caller's,
// nested as `[caller, [harness]]`, both land; a nested list is never mistaken for a file map.
{
  const difficultyFile = "src/engine/difficulty.ts";
  const runtime = loadRouteRuntime({
    directDifficulty: true,
    transforms: [[{ [difficultyFile]: (source) => `${source}\nexport const __composed = true;\n` }]],
  });
  const hookText = runtime.LAB.graph.compiledSource(ROUTE_HOOK);
  // ROUTE-C5: the edit is written in the loaded tree's state engine — the `status` setter up to C4, the reducer's
  // END_ROUTE since — so either of the harness's two shapes counts as the edit landing.
  const directApplied = Object.values(DIRECT_DIFFICULTY_START_GAME).some((edit) => hookText.includes(edit));
  const callerApplied = runtime.LAB.graph.require(difficultyFile).__composed === true;
  const badEntry = errorOf(() => fixtureGraph({ transforms: [["not a transform"]] }).require(`${FIX}/broken.ts`));
  record("L15", "loader", "NESTED_TRANSFORMS_COMPOSE", directApplied && callerApplied && /must be a function or a file map/.test(badEntry ?? ""), {
    directDifficultyApplied: directApplied,
    callerTransformApplied: callerApplied,
    badEntry,
  });
}

// =================================================================================================
// [extraction] — useEscapeMaze.ts split in memory, the way C1 would split it
// =================================================================================================
//
// Since ROUTE-C1 the working tree's hook no longer declares ROWS & co., so the split is cut from the one-file hook at
// ONE_FILE_ROTA and every load below is `rev: ONE_FILE_ROTA` + the split as overrides. Same exercise, same Rota: the
// virtual route-config.ts shadows nothing on that tree (it did not exist there), and X6 compares the real C1 tree.

/**
 * Move top-level declarations out of the hook into a new module, by the parser:
 *   - `route-config.ts`: the grid and the generation budget (ROWS, COLS, MAX_GENERATION_ATTEMPTS, RECOVERY_*);
 *   - `route-pick.ts`: `randomItem`, which draws from `@/engine/route-random` — a second importer of the seam.
 * The hook imports both back and re-exports ROWS/COLS, as a real extraction would.
 */
function splitRoute(hook) {
  const sf = ts.createSourceFile(ROUTE_HOOK, hook, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const take = (name) => {
    const statement = sf.statements.find(
      (s) =>
        (ts.isVariableStatement(s) && s.declarationList.declarations.some((d) => ts.isIdentifier(d.name) && d.name.text === name)) ||
        (ts.isFunctionDeclaration(s) && s.name?.text === name),
    );
    if (!statement) throw new Error(`splitRoute: ${name} not found at top level`);
    return { start: statement.getStart(sf), end: statement.end, text: statement.getText(sf) };
  };
  const configNames = ["ROWS", "COLS", "MAX_GENERATION_ATTEMPTS", "RECOVERY_ROUNDS", "RECOVERY_RETRIES_PER_SLOT"];
  const moved = [...configNames.map(take), take("randomItem")];
  let rest = hook;
  for (const cut of [...moved].sort((x, y) => y.start - x.start)) rest = rest.slice(0, cut.start) + rest.slice(cut.end);
  const lastImport = [...sf.statements].filter(ts.isImportDeclaration).at(-1);
  // Cuts are all after the imports, so the import block's offset is still valid.
  const insertAt = lastImport.end;
  rest =
    rest.slice(0, insertAt) +
    `\nimport { ${configNames.join(", ")} } from "./route-config";\nimport { randomItem } from "./route-pick";\nexport { ROWS, COLS };` +
    rest.slice(insertAt);
  const config = moved
    .slice(0, configNames.length)
    .map((cut) => (cut.text.startsWith("export ") ? cut.text : `export ${cut.text}`))
    .join("\n");
  const pick = `import { routeRandom } from "@/engine/route-random";\n\nexport ${moved.at(-1).text}\n`;
  return {
    [ROUTE_HOOK]: rest,
    "src/games/escape-maze/route-config.ts": `${config}\n`,
    "src/games/escape-maze/route-pick.ts": pick,
  };
}

const ONE_FILE_TREE = openSourceTree({ rev: ONE_FILE_ROTA });
const SPLIT = splitRoute(ONE_FILE_TREE.read(ROUTE_HOOK));
const VIRTUAL = ["src/games/escape-maze/route-config.ts", "src/games/escape-maze/route-pick.ts"];
const canonicalMap = (api, map) =>
  JSON.stringify({
    walls: [...map.walls].sort(),
    guardianStart: api.posKey(map.guardianStart),
    exitPosition: api.posKey(map.exitPosition),
    stars: map.collectibleStars.map(api.posKey),
    traps: map.traps.map(api.posKey),
    chest: map.chest ? api.posKey(map.chest) : null,
  });

// X1 — the split graph loads: the new modules are real modules of the graph, and the surface finds each binding
// in the module that now declares it.
{
  const LAB = loadInstrumented({ rev: ONE_FILE_ROTA, sourceOverrides: SPLIT });
  const files = LAB.graph.modules().map((m) => m.file);
  const declares = (file, name) => Object.hasOwn(LAB.graph.require(file)[INTERNALS_EXPORT] ?? {}, name);
  // The split modules are virtual: neither existed on the one-file tree, both were loaded from the overrides (the
  // real route-config.ts on disk is not what this graph read), and route-pick.ts exists nowhere.
  const origins = Object.fromEntries(LAB.graph.modules().map((m) => [m.file, m.origin]));
  const noFileOnDisk =
    VIRTUAL.every((file) => !ONE_FILE_TREE.exists(file) && origins[file] === "override") &&
    !fs.existsSync(path.join(ROOT, "src/games/escape-maze/route-pick.ts"));
  record(
    "X1",
    "extraction",
    "SPLIT_ROTA_LOADS_AS_A_GRAPH",
    files.includes("src/games/escape-maze/route-config.ts") &&
      files.includes("src/games/escape-maze/route-pick.ts") &&
      declares("src/games/escape-maze/route-config.ts", "MAX_GENERATION_ATTEMPTS") &&
      declares("src/games/escape-maze/route-pick.ts", "randomItem") &&
      !declares(ROUTE_HOOK, "MAX_GENERATION_ATTEMPTS") &&
      LAB.API.MAX_GENERATION_ATTEMPTS === 500 &&
      LAB.API.ROWS === 9 &&
      LAB.exports.ROWS === 9 &&
      LAB.structuralReasons.length > 0 &&
      LAB.finalGateNames.length > 0 &&
      noFileOnDisk,
    {
      loaded: files,
      hookImports: LAB.graph.tree.runtimeImports(ROUTE_HOOK),
      instrumented: { structuralReasons: LAB.structuralReasons.length, finalGates: LAB.finalGateNames.length },
      virtualModuleOrigins: Object.fromEntries(VIRTUAL.map((file) => [file, origins[file]])),
    },
  );
}

// X2 — the split Rota generates the SAME maps, and replayGeneration explains them the same way.
{
  const whole = loadInstrumented({ rev: ONE_FILE_ROTA });
  const split = loadInstrumented({ rev: ONE_FILE_ROTA, sourceOverrides: SPLIT });
  const diffs = [];
  let compared = 0;
  for (const stage of [1, 2, 3]) {
    for (const difficulty of ["easy", "medium", "hard"]) {
      for (const seed of [11, 4242, 90210]) {
        whole.setSeed(seed);
        split.setSeed(seed);
        const a = canonicalMap(whole.API, whole.API.generateMaze(difficulty, stage));
        const b = canonicalMap(split.API, split.API.generateMaze(difficulty, stage));
        whole.setSeed(seed);
        split.setSeed(seed);
        const ra = whole.replayGeneration({ difficulty, stage, capture: false });
        const rb = split.replayGeneration({ difficulty, stage, capture: false });
        compared += 1;
        if (a !== b || !same(ra.histogram, rb.histogram) || ra.totalAttempts !== rb.totalAttempts) diffs.push({ stage, difficulty, seed });
      }
    }
  }
  record("X2", "extraction", "SPLIT_ROTA_GENERATES_THE_SAME_MAPS", diffs.length === 0 && compared === 27, { compared, diffs });
}

// X3 — the seam stays one instance across the NEW import edge: a seed armed through the harness's handle is the
// seed the extracted helper draws from.
{
  const armed = (overrides) => {
    const rota = loadRouteModules({ rev: ONE_FILE_ROTA, sourceOverrides: overrides, surface: ["generateMaze", "posKey"] });
    rota.routeRandom.armRouteRandomSeed(777);
    rota.setSeed(1);
    const a = canonicalMap(rota.api, rota.api.generateMaze("medium", 2));
    rota.setSeed(999); // move the sandbox's Math: only an un-armed (second) instance would follow it
    const b = canonicalMap(rota.api, rota.api.generateMaze("medium", 2));
    const importers = rota.graph.modules().filter((m) => rota.graph.tree.runtimeImports(m.file).includes("@/engine/route-random")).map((m) => m.file);
    return { a, b, importers, loadedOnce: rota.graph.modules().filter((m) => m.file === "src/engine/route-random.ts").length === 1 };
  };
  const whole = armed(undefined);
  const split = armed(SPLIT);
  record(
    "X3",
    "extraction",
    "SEAM_IS_SHARED_ACROSS_THE_NEW_MODULE",
    split.importers.includes("src/games/escape-maze/route-pick.ts") && split.loadedOnce && split.a === split.b && split.a === whole.a,
    { importersOfRouteRandom: split.importers, armedSeedHoldsWhenMathMoves: split.a === split.b, sameMapAsUnsplit: split.a === whole.a },
  );
}

// X4 — a counterfactual aimed at a DECLARATION follows it into the new module (final-acceptance's recovery proof).
{
  const tree = openSourceTree({ rev: ONE_FILE_ROTA, sourceOverrides: SPLIT });
  const capFile = tree.declaring("MAX_GENERATION_ATTEMPTS");
  const capLine = tree.read(capFile).split("\n").find((l) => l.includes("const MAX_GENERATION_ATTEMPTS"));
  const LAB = loadInstrumented({
    rev: ONE_FILE_ROTA,
    sourceOverrides: SPLIT,
    transforms: { [capFile]: (src) => src.replace(capLine, "export const MAX_GENERATION_ATTEMPTS = 1;") },
  });
  LAB.setSeed(5);
  const replay = LAB.replayGeneration({ difficulty: "hard", stage: 3, capture: false });
  record(
    "X4",
    "extraction",
    "DECLARATION_AIMED_TRANSFORM_FOLLOWS_THE_CODE",
    capFile === "src/games/escape-maze/route-config.ts" && LAB.API.MAX_GENERATION_ATTEMPTS === 1 && replay.randomAttempts === 1 && !replay.threw,
    { capFile, cap: LAB.API.MAX_GENERATION_ATTEMPTS, randomAttempts: replay.randomAttempts, recoveryAttempts: replay.recoveryAttempts },
  );
}

// X5 — the runtime harness mounts the split hook and plays the same Routes to the same ends.
{
  const play = (sourceOverrides, rev = ONE_FILE_ROTA) => {
    const runtime = loadRouteRuntime({ rev, sourceOverrides });
    return [1, 2, 3].flatMap((routeNumber) =>
      ["win", "lose"].map((policy) => {
        const run = runtime.mount({ seed: 300 + routeNumber, routeNumber, difficulty: "medium" });
        const end = playToEnd(run, policy);
        const g = run.state;
        return {
          routeNumber,
          policy,
          end,
          player: g.player,
          guardian: g.guardian,
          collected: g.collectedSet.size,
          completions: JSON.parse(JSON.stringify(run.completions)),
        };
      }),
    );
  };
  const whole = play(undefined);
  const split = play(SPLIT);
  const ended = whole.filter((r) => r.completions.length > 0).length;
  record("X5", "extraction", "SPLIT_HOOK_PLAYS_THE_SAME_ROUTES", same(whole, split) && ended >= 3, {
    runs: whole.map((r) => `${r.routeNumber}/${r.policy}: ${r.end}`),
    runsThatEnded: ended,
    split: same(whole, split) ? "identical, completion by completion" : split,
  });

  // X6 — ROUTE-C1 did the extraction for real. The working tree declares what the synthetic split moved in the module
  // the split predicted, the hook declares none of it, and the real multi-file Rota generates, explains and plays
  // exactly what the one-file Rota and its synthetic split do.
  const tree = openSourceTree();
  const moved = ["ROWS", "COLS", "MAX_GENERATION_ATTEMPTS", "RECOVERY_ROUNDS", "RECOVERY_RETRIES_PER_SLOT"];
  const declaredIn = Object.fromEntries(moved.map((name) => [name, errorOf(() => tree.declaring(name)) ?? tree.declaring(name)]));
  const hookDeclares = moved.filter((name) => declaredIn[name] === ROUTE_HOOK);
  const one = loadInstrumented({ rev: ONE_FILE_ROTA });
  const synthetic = loadInstrumented({ rev: ONE_FILE_ROTA, sourceOverrides: SPLIT });
  const real = loadInstrumented();
  const mapDiffs = [];
  let compared = 0;
  for (const stage of [1, 2, 3]) {
    for (const difficulty of ["easy", "medium", "hard"]) {
      for (const seed of [11, 4242, 90210]) {
        const maps = [one, synthetic, real].map((lab) => {
          lab.setSeed(seed);
          return canonicalMap(lab.API, lab.API.generateMaze(difficulty, stage));
        });
        const replays = [one, real].map((lab) => {
          lab.setSeed(seed);
          const replay = lab.replayGeneration({ difficulty, stage, capture: false });
          return JSON.stringify([replay.histogram, replay.totalAttempts]);
        });
        compared += 1;
        if (new Set(maps).size !== 1 || replays[0] !== replays[1]) mapDiffs.push({ stage, difficulty, seed });
      }
    }
  }
  const realPlay = play(undefined, null);
  const realFiles = real.graph.modules().map((m) => m.file);
  record(
    "X6",
    "extraction",
    "REAL_SPLIT_IS_THE_SYNTHETIC_SPLIT",
    moved.every((name) => declaredIn[name] === "src/games/escape-maze/route-config.ts") &&
      hookDeclares.length === 0 &&
      realFiles.includes("src/games/escape-maze/route-config.ts") &&
      real.graph.modules().every((m) => m.origin === "worktree") &&
      mapDiffs.length === 0 &&
      compared === 27 &&
      same(realPlay, whole),
    {
      declaredIn,
      realGraph: realFiles,
      mapsCompared: `${compared} (one-file = synthetic split = real split)`,
      mapDiffs,
      realPlays: same(realPlay, whole) ? "identical to the one-file Rota, completion by completion" : realPlay,
    },
  );
}

// =================================================================================================
// [counterfactual] — the loader the validators had at 5d541b2 cannot load the split Rota
// =================================================================================================
{
  const baselineSource = execFileSync("git", ["show", `${BASELINE}:tools/validation/instrumented-generator.mjs`], { cwd: ROOT, encoding: "utf8" });
  const nodeRequire = createRequire(import.meta.url);
  const rewired = baselineSource
    .replace('from "typescript"', `from ${JSON.stringify(pathToFileURL(nodeRequire.resolve("typescript")).href)}`)
    .replace('from "./route-lab.mjs"', `from ${JSON.stringify(pathToFileURL(path.join(ROOT, "tools/validation/route-lab.mjs")).href)}`);
  const baseline = await import(`data:text/javascript;base64,${Buffer.from(rewired).toString("base64")}`);
  // The baseline loader reads the working tree's hook; a transform hands it the text under test instead.
  const loadsWhole = errorOf(() => baseline.loadInstrumented({ bare: true, transform: () => ONE_FILE_TREE.read(ROUTE_HOOK) })) === null;
  const splitError = errorOf(() => baseline.loadInstrumented({ bare: true, transform: () => SPLIT[ROUTE_HOOK] }));
  const realError = errorOf(() => baseline.loadInstrumented({ bare: true }));
  record(
    "C1",
    "counterfactual",
    "BASELINE_LOADER_NEEDS_THE_MEGA_FILE",
    loadsWhole && /unexpected import \.\/route-config/.test(splitError ?? "") && /route-config/.test(realError ?? ""),
    {
      baselineLoadsOneFileHook: loadsWhole,
      baselineOnSplitHook: splitError,
      baselineOnRealC1Hook: realError,
    },
  );
}

// =================================================================================================
// [hygiene] — nothing was written
// =================================================================================================
{
  const after = srcSnapshot();
  const moved = [...new Set([...SRC_BEFORE.keys(), ...after.keys()])].filter((file) => SRC_BEFORE.get(file) !== after.get(file));
  const statusSame = porcelain() === STATUS_BEFORE;
  record("H1", "hygiene", "LOADER_WRITES_NOTHING", moved.length === 0 && statusSame && !fs.existsSync(path.join(ROOT, FIX)), {
    srcFilesChanged: moved,
    gitStatusUnchanged: statusSame,
  });
}

const failing = tests.filter((t) => !t.pass).map((t) => t.id);
console.log(`\n${tests.length - failing.length}/${tests.length} passed · failing: ${failing.join(", ") || "none"}`);
process.exitCode = failing.length ? EXIT_VALIDATION_FAILED : EXIT_OK;
