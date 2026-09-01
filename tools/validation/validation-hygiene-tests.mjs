/**
 * MINDFLOW-VALIDATION-HYGIENE-04 — the worktree immutability regression.
 *
 * The claim under test is narrow and physical: running the validators the normal
 * way does not modify the repository. Not "modifies it and puts it back" — the
 * proof here is that no evidence file's content OR modification time moved, and
 * that `git status --porcelain` is byte-identical before and after. A validator
 * that wrote a file and restored it would still fail, because the mtime would
 * have moved.
 *
 * It also doubles as the CORE regression battery: every validator below is run
 * in check mode as a real subprocess and its exit code recorded, so one run
 * answers both "do the contracts still hold?" and "did asking cost anything?".
 *
 * Usage: node tools/validation/validation-hygiene-tests.mjs [--check|--update]
 *        node tools/validation/validation-hygiene-tests.mjs --fast   (skips the
 *        four slowest validators; still proves immutability, less coverage)
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { openEvidence, EXIT_OK } from "./evidence.mjs";

const EVIDENCE = openEvidence("docs/archive/mindflow-validation-hygiene-04");
const FAST = process.argv.includes("--fast");
const ARCHIVE = path.resolve("docs/archive");

/**
 * The CORE check set: the validators a normal working session runs. Each is
 * expected to exit 0 in check mode on a clean tree, and to write nothing.
 * `slow` marks the ones `--fast` skips.
 */
const CORE = [
  { script: "route-visual-state-tests.mjs" },
  { script: "chest-static-render-audit.mjs" },
  { script: "babylon-lifecycle-tests.mjs" },
  { script: "production-diagnostic-boundary-tests.mjs" },
  { script: "trap-strategy-tests.mjs" },
  { script: "cross-eol-tests.mjs" },
  { script: "chest-controlled-tests.mjs" },
  { script: "diagnostic-launcher-tests.mjs" },
  { script: "difficulty-remount-persistence-tests.mjs" },
  { script: "second-chance-controlled-tests.mjs" },
  { script: "chest-runtime-gameplay.mjs", slow: true },
  { script: "difficulty-rebalance-tests.mjs", slow: true },
  { script: "difficulty-baseline-tests.mjs", slow: true },
  { script: "pickaxe-controlled-tests.mjs", slow: true },
  { script: "route-difficulty-identity-tests.mjs", slow: true },
];

// --- filesystem snapshot ----------------------------------------------------

/** Content hash AND mtime: a write-then-restore moves the second even if the first returns. */
function snapshot(directory) {
  const entries = new Map();
  const walk = (current) => {
    for (const item of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, item.name);
      if (item.isDirectory()) {
        walk(full);
        continue;
      }
      const stat = fs.statSync(full);
      entries.set(path.relative(ARCHIVE, full).replace(/\\/g, "/"), {
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        sha256: crypto.createHash("sha256").update(fs.readFileSync(full)).digest("hex"),
      });
    }
  };
  walk(directory);
  return entries;
}

const porcelain = () =>
  execFileSync("git", ["status", "--porcelain"], { encoding: "utf8" });

function compareSnapshots(before, after) {
  const created = [...after.keys()].filter((key) => !before.has(key));
  const deleted = [...before.keys()].filter((key) => !after.has(key));
  const contentChanged = [];
  const touchedOnly = [];
  for (const [key, was] of before) {
    const now = after.get(key);
    if (!now) continue;
    if (now.sha256 !== was.sha256) contentChanged.push(key);
    else if (now.mtimeMs !== was.mtimeMs) touchedOnly.push(key);
  }
  return { created, deleted, contentChanged, touchedOnly };
}

// --- run --------------------------------------------------------------------

const statusBefore = porcelain();
const before = snapshot(ARCHIVE);
console.log(
  `baseline: ${before.size} arquivos de evidência · git status ${statusBefore.trim() === "" ? "limpo" : "SUJO"}`,
);
if (statusBefore.trim() !== "") {
  console.log("  aviso: a worktree já estava suja; a comparação continua válida, mas o baseline não é HEAD");
}

const runs = [];
const timings = [];
for (const { script, slow } of CORE) {
  if (FAST && slow) {
    runs.push({ script, skipped: true });
    console.log(`  SKIP  ${script}`);
    continue;
  }
  const started = Date.now();
  let exitCode = 0;
  try {
    execFileSync("node", [`tools/validation/${script}`], { stdio: "pipe" });
  } catch (error) {
    exitCode = typeof error.status === "number" ? error.status : -1;
  }
  const seconds = Number(((Date.now() - started) / 1000).toFixed(1));
  // Wall-clock is RUN METADATA and is kept out of `runs`, which is verdict data.
  // Leaving it in would make this validator diverge from its own record on every
  // single run — the exact failure mode it exists to prevent.
  runs.push({ script, exitCode, ok: exitCode === EXIT_OK });
  timings.push({ script, seconds });
  console.log(`  ${exitCode === EXIT_OK ? "PASS" : "FAIL"}  ${script} (exit ${exitCode}, ${seconds}s)`);
}

const after = snapshot(ARCHIVE);
const statusAfter = porcelain();
const delta = compareSnapshots(before, after);

const statusUnchanged = statusBefore === statusAfter;
const allRunsPassed = runs.every((run) => run.skipped || run.ok);

console.log("\nimutabilidade:");
console.log(`  arquivos criados          : ${delta.created.length}`);
console.log(`  arquivos apagados         : ${delta.deleted.length}`);
console.log(`  conteúdo alterado         : ${delta.contentChanged.length}${delta.contentChanged.length ? ` -> ${delta.contentChanged.slice(0, 5).join(", ")}` : ""}`);
console.log(`  reescritos com o mesmo conteúdo (mtime mexeu): ${delta.touchedOnly.length}${delta.touchedOnly.length ? ` -> ${delta.touchedOnly.slice(0, 5).join(", ")}` : ""}`);
console.log(`  git status idêntico       : ${statusUnchanged ? "sim" : "NÃO"}`);

/**
 * Two independent claims, deliberately not merged into one label. "Nothing was
 * modified" is true or false regardless of whether the contracts still hold, and
 * reporting a clean read-only run as a mutation because some contract's evidence
 * is stale would be exactly the kind of blurred verdict this mission is removing.
 */
const immutability = [
  { id: "NO_EVIDENCE_CONTENT_CHANGED", pass: delta.contentChanged.length === 0, detail: delta.contentChanged },
  { id: "NO_EVIDENCE_FILE_TOUCHED", pass: delta.touchedOnly.length === 0, detail: delta.touchedOnly },
  { id: "NO_EVIDENCE_FILE_CREATED_OR_DELETED", pass: delta.created.length === 0 && delta.deleted.length === 0, detail: { created: delta.created, deleted: delta.deleted } },
  // The detail is deliberately just the verdict: the raw porcelain text depends
  // on whatever else is uncommitted at the moment, which is not this validator's
  // conclusion. The full text goes to `worktreeStatus`, declared run metadata.
  { id: "GIT_STATUS_UNCHANGED", pass: statusUnchanged, detail: { identical: statusUnchanged } },
];
const battery = [
  { id: "EVERY_CORE_VALIDATOR_PASSED_IN_CHECK_MODE", pass: allRunsPassed, detail: runs.filter((run) => !run.skipped && !run.ok) },
];
const readOnly = immutability.every(({ pass }) => pass);
const checks = [...immutability, ...battery];
const allPass = readOnly && allRunsPassed;

/**
 * `--fast` skips four validators, so its `runs` array is a different verdict by
 * construction and could never match a full baseline. Rather than record a
 * second, weaker baseline or let it fail forever, the fast path simply does not
 * touch evidence: it is a local iteration aid, and the immutability proof it
 * prints is real on its own terms.
 */
if (FAST) {
  console.log(`\n${readOnly ? "VALIDATION_CHECK_IS_READ_ONLY" : "VALIDATION_CHECK_MUTATES_WORKTREE"}`);
  console.log(allRunsPassed ? "CORE_BATTERY_PASSED (fast subset)" : "CORE_BATTERY_FAILED (fast subset)");
  console.log("evidence: not compared — --fast is a subset, not a baseline");
  process.exitCode = allPass ? 0 : 1;
} else {
EVIDENCE.write("validation-check-is-read-only.json", {
  mission: "MINDFLOW-VALIDATION-HYGIENE-04",
  claim:
    "Running the CORE validators normally modifies nothing. Proven by content hash AND mtime, so a write-then-restore would still fail this test.",
  method:
    "hash+mtime snapshot of every file under docs/archive, run each CORE validator as a subprocess in its default (check) mode, re-snapshot, and compare git status --porcelain before and after",
  coverage: FAST ? "FAST (slow validators skipped)" : "FULL",
  evidenceFilesWatched: before.size,
  worktreeStatus: { before: statusBefore, after: statusAfter },
  runs,
  timings,
  checks,
  readOnly,
  coreBatteryPassed: allRunsPassed,
  allPass,
}, { metadata: ["timings", "evidenceFilesWatched", "worktreeStatus"] });

  console.log(`\n${readOnly ? "VALIDATION_CHECK_IS_READ_ONLY" : "VALIDATION_CHECK_MUTATES_WORKTREE"}`);
  console.log(allRunsPassed ? "CORE_BATTERY_PASSED" : "CORE_BATTERY_FAILED");
  process.exitCode = EVIDENCE.finish({ ok: allPass });
}
