/**
 * ROUTE-C0 — the coupling gate: no Rota validator goes back to assuming the Rota
 * is one file.
 *
 * Reads every `tools/validation/*.mjs` as text (comments stripped) and finds
 * five kinds of coupling to the Rota's physical layout:
 *
 *   hook-path         names `useEscapeMaze.ts` in code;
 *   hook-text         asks for the hook's text (`productionSource()`) to
 *                     anchor on, instead of the module that holds the code;
 *   rota-module-path  names another Rota module file (difficulty, route-random,
 *                     continuation, route-config since ROUTE-C1, route-generation
 *                     and route-geometry since ROUTE-C2, route-defenders since
 *                     ROUTE-C3, route-invariants since ROUTE-C4) in code;
 *   rota-resolver     answers a Rota import by hand (`=== "@/engine/…"`) — a
 *                     private module resolver;
 *   rota-ts-compile   compiles TypeScript in a file that also names Rota
 *                     sources — a private loader;
 *   single-file-seam  `hookSource`: one text standing in for the whole Rota.
 *
 * Not every coupling is a defect. A source-analysis test that asserts WHERE
 * something lives has to name the file; a UI-stage test compiles its own
 * component. Those are declared in ALLOWED below, each with its reason, file by
 * file and kind by kind. Everything else fails:
 *
 *   [decoupling]  the validators C0 migrated load the Rota through the graph,
 *                 nobody uses the single-file seam, and the only hand-written
 *                 Rota resolvers left are legacy scripts that already failed
 *                 to load at 5d541b2;
 *   [regression]  every coupling found is declared, and every declaration is
 *                 still needed (a fixed coupling must leave the list).
 *
 * A normal run also scans 5d541b2 and prints the delta. `--rev=5d541b2` runs the
 * gate ON that tree: it must fail every [decoupling] check — the structural
 * counterfactual.
 *
 * Usage: node tools/validation/route-validation-coupling-gate.mjs [--rev=<commit>]
 * Writes nothing. Exit 0 = gate holds, 1 = a check failed, 3 = usage error.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";

const BASELINE = "5d541b228247621a6521852db8d4d913ebb55be2";
const DIR = "tools/validation";

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
if (args.some((arg) => arg !== revArg) || REV === "") {
  console.error("usage: node tools/validation/route-validation-coupling-gate.mjs [--rev=<commit>]");
  process.exit(EXIT_USAGE);
}
const git = (gitArgs) => execFileSync("git", gitArgs, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
if (REV) {
  try {
    git(["rev-parse", "--verify", `${REV}^{commit}`]);
  } catch {
    console.error(`unknown revision ${REV}`);
    process.exit(EXIT_USAGE);
  }
}

// --- the patterns ------------------------------------------------------------------------------

const codeOnly = (source) => source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
const ROTA_SPECIFIER = String.raw`@\/(?:engine\/(?:difficulty|route-random)|games\/escape-maze\/(?:continuation|route-config|route-defenders|route-generation|route-geometry|route-invariants|useEscapeMaze))`;
const SIGNALS = {
  "hook-path": /useEscapeMaze\.ts/,
  "hook-text": /(?<!function\s)\bproductionSource\s*\(/,
  "rota-module-path": /["'](?:src\/engine\/)?(?:difficulty|route-random)\.ts["']|["'](?:src\/games\/escape-maze\/)?(?:continuation|route-config|route-defenders|route-generation|route-geometry|route-invariants)\.ts["']/,
  "rota-resolver": new RegExp(String.raw`===\s*["']${ROTA_SPECIFIER}["']`),
  "single-file-seam": /\bhookSource\b/,
};
const COMPILES_TS = /\btranspileModule\s*\(/;

function couplingsOf(source) {
  const code = codeOnly(source);
  const found = Object.entries(SIGNALS)
    .filter(([, pattern]) => pattern.test(code))
    .map(([kind]) => kind);
  if (COMPILES_TS.test(code) && found.some((kind) => kind !== "single-file-seam")) found.push("rota-ts-compile");
  return found.sort();
}

function scan(rev) {
  const files = rev
    ? git(["ls-tree", "--name-only", rev, `${DIR}/`]).split("\n").filter((file) => file.endsWith(".mjs"))
    : fs.readdirSync(DIR).filter((file) => file.endsWith(".mjs")).map((file) => `${DIR}/${file}`);
  const result = new Map();
  for (const file of files.sort()) {
    const source = rev ? git(["show", `${rev}:${file}`]) : fs.readFileSync(file, "utf8");
    result.set(path.basename(file), { couplings: couplingsOf(source), source: codeOnly(source) });
  }
  return result;
}

// --- what is allowed, and why ------------------------------------------------------------------

const REASON = {
  SHARED_LOADER: "the shared loader itself: the one place that names, reads and compiles the Rota's modules",
  LOADER_TESTS: "tests of the shared loader: patch and assert on named Rota modules on purpose",
  STRUCTURAL_ASSERTION:
    "intentional source/AST assertion: the check is about WHERE code lives (a contract on the file), so it names the file",
  UI_STAGE:
    "stage-isolated UI test: compiles a component (page, GameScreen, the Rota component, launcher) with stage stubs; the Rota's logic runs through route-runtime-harness",
  PROVENANCE: "provenance hash of a recorded campaign: changing its inputs would invalidate the recorded identity",
  REPORT_LABEL: "names the file inside report/evidence text only — nothing is read or compiled",
  LEGACY_LEDGER:
    "historical acceptance ledger of a closed mission: rewrites its archive on every run and is not a check; its source scan is that mission's record",
  LEGACY_BROKEN:
    "legacy one-shot script that already failed at 5d541b2 and writes archived evidence when run; not migrated (reviving it would rewrite a closed mission's record)",
};

/** file → { kinds allowed, reason }. Anything found and not listed here fails the gate. */
const ALLOWED = {
  "route-module-loader.mjs": { kinds: ["hook-path", "rota-module-path", "rota-ts-compile"], reason: "SHARED_LOADER" },
  // ROUTE-C3: L10 no longer names the hook — it reads route-random's importers off the graph — so "hook-path" left.
  "route-module-loader-tests.mjs": { kinds: ["rota-module-path"], reason: "LOADER_TESTS" },
  "cross-eol-tests.mjs": {
    kinds: ["hook-text"],
    reason: "STRUCTURAL_ASSERTION",
    note: "pins the hook-text helper itself: the hook's text must arrive with LF whatever the checkout did",
  },
  "game-continuation-contract-tests.mjs": {
    kinds: ["hook-path", "rota-module-path", "rota-ts-compile"],
    reason: "STRUCTURAL_ASSERTION",
    note: "I1 names the hook's runtime imports and the reader's importers; stages are compiled as UI_STAGE",
  },
  "route-journey-ownership-tests.mjs": {
    kinds: ["hook-path", "rota-module-path", "rota-ts-compile"],
    reason: "STRUCTURAL_ASSERTION",
    note: "O3 names the one producer of the next Route; stages are compiled as UI_STAGE",
  },
  "route-journey-terminal-tests.mjs": {
    kinds: ["hook-path", "rota-module-path", "rota-ts-compile"],
    reason: "STRUCTURAL_ASSERTION",
    note: "T11 names where the journey's end is declared and read; stages are compiled as UI_STAGE",
  },
  "route-config-extraction-tests.mjs": {
    kinds: ["rota-module-path"],
    reason: "STRUCTURAL_ASSERTION",
    note: "ROUTE-C1's static gate: the grid/config is declared in route-config.ts and nowhere else; its Rota runs through the graph",
  },
  "route-generation-extraction-tests.mjs": {
    kinds: ["rota-module-path"],
    reason: "STRUCTURAL_ASSERTION",
    note: "ROUTE-C2's static gate: generation in route-generation.ts, primitives in route-geometry.ts, randomItem in the seam, none of it in the hook; its Rota runs through the graph",
  },
  "route-defenders-extraction-tests.mjs": {
    kinds: ["rota-module-path"],
    reason: "STRUCTURAL_ASSERTION",
    note: "ROUTE-C3's static gate: the Hunter's and the Sentinel's policy in route-defenders.ts and nowhere else, none of it in the hook, every other Rota module untouched; its Rota runs through the graph",
  },
  "route-invariants-extraction-tests.mjs": {
    kinds: ["rota-module-path"],
    reason: "STRUCTURAL_ASSERTION",
    note: "ROUTE-C4's static gate: the dynamic invariants (and GameStatus/ChestReward) in route-invariants.ts and nowhere else, none of it in the hook, every other Rota module untouched; its Rota runs through the graph",
  },
  "route-board-loader-tests.mjs": { kinds: ["rota-module-path", "rota-ts-compile"], reason: "UI_STAGE" },
  "diagnostic-launcher-tests.mjs": {
    kinds: ["rota-module-path"],
    reason: "STRUCTURAL_ASSERTION",
    note: "G reads route-random.ts's own code: no storage, no global Math.random assignment",
  },
  "production-diagnostic-boundary-tests.mjs": {
    kinds: ["rota-module-path", "rota-ts-compile"],
    reason: "STRUCTURAL_ASSERTION",
    note: "scans every src file for seed-arming callers; the TypeScript it compiles is src/engine/storage.ts, not the Rota",
  },
  "breakable-wall-feasibility.mjs": { kinds: ["hook-path"], reason: "REPORT_LABEL" },
  "dynamic-solvability-finalize.mjs": { kinds: ["hook-path"], reason: "REPORT_LABEL" },
  "chest-acceptance.mjs": { kinds: ["hook-path"], reason: "LEGACY_LEDGER", note: "ROTA-CHEST-REWARDS-01" },
  "render-route-9x9-evidence.mjs": {
    kinds: ["hook-path"],
    reason: "LEGACY_BROKEN",
    note: "parses template arrays out of the hook's text; STAGE_ONE_TEMPLATES stopped being a literal before 5d541b2",
  },
  "route-lab.mjs": {
    kinds: ["hook-path", "rota-module-path", "rota-resolver", "rota-ts-compile"],
    reason: "LEGACY_BROKEN",
    note: "loadLab only (its difficulty sandbox predates route-random); the pure helpers other validators import are unaffected",
  },
  ...Object.fromEntries(
    ["autopsy-generation.mjs", "final-rejection-autopsy.mjs", "star-capacity-proof.mjs", "star-selection-proof.mjs"].map((file) => [
      file,
      {
        kinds: ["hook-path", "rota-module-path", "rota-resolver", "rota-ts-compile"],
        reason: "LEGACY_BROKEN",
        note: "its difficulty sandbox predates route-random",
      },
    ]),
  ),
};

/**
 * The validators ROUTE-C0 migrated, and the shared module each now loads the Rota through. None of them may
 * name the hook, resolve a Rota import, compile TypeScript or take one text for the Rota again.
 */
const MIGRATED = {
  "instrumented-generator.mjs": "route-module-loader.mjs",
  "route-runtime-harness.mjs": "instrumented-generator.mjs",
  "validate-route-9x9.mjs": "route-module-loader.mjs",
  "test-star-selection.mjs": "route-module-loader.mjs",
  "final-acceptance.mjs": "instrumented-generator.mjs",
  "inspect-route-board-glb.mjs": "route-module-loader.mjs",
  "chest-static-render-audit.mjs": "route-module-loader.mjs",
  "diagnostic-launcher-tests.mjs": "route-module-loader.mjs",
  "game-continuation-contract-tests.mjs": "route-runtime-harness.mjs",
  "route-journey-ownership-tests.mjs": "route-runtime-harness.mjs",
  "route-journey-terminal-tests.mjs": "route-runtime-harness.mjs",
};
const FORBIDDEN_IN_MIGRATED = ["hook-path", "hook-text", "rota-resolver", "rota-ts-compile", "single-file-seam"];
/** Never declarable for a migrated validator, whatever else it legitimately names. */
const ALWAYS_FORBIDDEN = ["rota-resolver", "single-file-seam"];
const isAllowed = (file, kind) => ALLOWED[file]?.kinds.includes(kind) ?? false;
const undeclaredForbidden = (file, couplings) =>
  couplings.filter((kind) => ALWAYS_FORBIDDEN.includes(kind) || (FORBIDDEN_IN_MIGRATED.includes(kind) && !isAllowed(file, kind)));

// --- checks --------------------------------------------------------------------------------------

const tests = [];
const record = (id, kind, name, pass, detail) => {
  tests.push({ id, kind, name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} [${kind}] — ${name}`);
  for (const [k, v] of Object.entries(detail)) console.log(`        ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
};

const TREE = scan(REV);
const label = REV ? `rev ${REV}` : "working tree";
console.log(`scanning ${TREE.size} validators (${label})\n`);

// D1 — the migrated validators go through the graph.
{
  const offenders = {};
  for (const [file, via] of Object.entries(MIGRATED)) {
    const entry = TREE.get(file);
    if (!entry) {
      offenders[file] = "missing";
      continue;
    }
    // Declared structural couplings still apply (the journey tests name the hook in their architecture
    // assertions); a private resolver or the single-file seam never does.
    const bad = undeclaredForbidden(file, entry.couplings);
    const usesGraph = entry.source.includes(`"./${via}"`);
    if (bad.length || !usesGraph) offenders[file] = { couplings: bad, importsSharedLoader: usesGraph };
  }
  record("D1", "decoupling", "MIGRATED_VALIDATORS_LOAD_THE_GRAPH", Object.keys(offenders).length === 0, {
    migrated: Object.keys(MIGRATED).length,
    offenders,
  });
}

// D2 — nobody hands the Rota over as one text.
{
  const users = [...TREE].filter(([, entry]) => entry.couplings.includes("single-file-seam")).map(([file]) => file);
  record("D2", "decoupling", "NO_SINGLE_FILE_SEAM", users.length === 0, { users });
}

// D3 — the only private Rota resolvers left are legacy scripts that were already broken.
{
  const resolvers = [...TREE].filter(([, entry]) => entry.couplings.includes("rota-resolver")).map(([file]) => file);
  const live = resolvers.filter((file) => ALLOWED[file]?.reason !== "LEGACY_BROKEN");
  record("D3", "decoupling", "NO_LIVE_PRIVATE_ROTA_RESOLVER", live.length === 0, { live, legacy: resolvers.filter((file) => !live.includes(file)) });
}

// R1 — every coupling found is declared, with a reason.
{
  const undeclared = [];
  for (const [file, entry] of TREE) {
    for (const kind of entry.couplings) if (!isAllowed(file, kind)) undeclared.push(`${file}: ${kind}`);
  }
  record("R1", "regression", "EVERY_COUPLING_IS_DECLARED", undeclared.length === 0, { undeclared });
}

// R2 — every declaration is still needed: a coupling that was removed must leave the list.
{
  const stale = [];
  for (const [file, { kinds }] of Object.entries(ALLOWED)) {
    const entry = TREE.get(file);
    if (!entry) stale.push(`${file}: no such validator`);
    else for (const kind of kinds) if (!entry.couplings.includes(kind)) stale.push(`${file}: ${kind}`);
  }
  record("R2", "regression", "ALLOWLIST_IS_CURRENT", stale.length === 0, { stale });
}

// --- the delta against 5d541b2 -------------------------------------------------------------------

const inventory = (tree) => {
  const byKind = Object.fromEntries([...Object.keys(SIGNALS), "rota-ts-compile"].map((kind) => [kind, []]));
  for (const [file, entry] of tree) for (const kind of entry.couplings) byKind[kind].push(file);
  return byKind;
};
const base = REV ? null : scan(BASELINE);
if (base) {
  const before = inventory(base);
  const after = inventory(TREE);
  console.log(`\ncouplings, 5d541b2 → working tree (files per kind):`);
  for (const kind of Object.keys(before)) {
    const removed = before[kind].filter((file) => !after[kind].includes(file));
    const added = after[kind].filter((file) => !before[kind].includes(file));
    console.log(`  ${kind.padEnd(17)} ${String(before[kind].length).padStart(2)} → ${String(after[kind].length).padStart(2)}` +
      `${removed.length ? `   removed: ${removed.join(", ")}` : ""}${added.length ? `   added: ${added.join(", ")}` : ""}`);
  }
  // D4 — the migration removed real couplings: every migrated validator that existed at the baseline had at least
  // one forbidden coupling there and has none of those kinds now (declared structural ones aside).
  const removedPerFile = {};
  const notReduced = Object.keys(MIGRATED).filter((file) => {
    const was = base.get(file)?.couplings.filter((kind) => FORBIDDEN_IN_MIGRATED.includes(kind)) ?? [];
    const now = TREE.get(file)?.couplings.filter((kind) => FORBIDDEN_IN_MIGRATED.includes(kind)) ?? [];
    removedPerFile[file] = was.filter((kind) => !now.includes(kind));
    return removedPerFile[file].length === 0 || undeclaredForbidden(file, now).length > 0;
  });
  const liveResolvers = (tree) => [...tree].filter(([file, entry]) => entry.couplings.includes("rota-resolver") && ALLOWED[file]?.reason !== "LEGACY_BROKEN").map(([file]) => file);
  record("D4", "decoupling", "COUPLING_REMOVED_SINCE_5d541b2", notReduced.length === 0 && liveResolvers(TREE).length < liveResolvers(base).length, {
    liveResolversAtBaseline: liveResolvers(base),
    liveResolversNow: liveResolvers(TREE),
    singleFileSeamAtBaseline: before["single-file-seam"],
    removedPerFile,
    notReduced,
  });
}

const failing = tests.filter((t) => !t.pass).map((t) => t.id);
const tally = (kind) => {
  const of = tests.filter((t) => t.kind === kind);
  return `${of.filter((t) => t.pass).length}/${of.length}`;
};
console.log(
  `\n${REV ? `rev ${REV} · ` : ""}${tests.length - failing.length}/${tests.length} passed · decoupling ${tally("decoupling")} · regression ${tally("regression")} · failing: ${failing.join(", ") || "none"}`,
);
console.log(`\nallowed couplings, by reason:`);
for (const [reason, text] of Object.entries(REASON)) {
  const files = Object.entries(ALLOWED).filter(([, entry]) => entry.reason === reason).map(([file]) => file);
  if (files.length) console.log(`  ${reason} — ${text}\n    ${files.join(", ")}`);
}
process.exitCode = failing.length ? EXIT_VALIDATION_FAILED : EXIT_OK;
