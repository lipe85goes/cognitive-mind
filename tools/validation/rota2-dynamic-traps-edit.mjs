/**
 * ROTA2-DYNAMIC-TRAPS-01 — the approved Rota 2.0 delta, pinned hunk by hunk.
 *
 * The Rota's extraction suites (ROUTE-C1 … C7C) prove that each extraction
 * moved code verbatim and changed no behaviour, by comparing the live tree with
 * the tree before the extraction. ROTA2-DYNAMIC-TRAPS-01 is an explicitly
 * approved Rota 2.0 mission (class 4 of the lock's change policy): it changes
 * the Rota's behaviour on purpose, inside those modules. So those suites read
 * the live tree with EXACTLY this delta reversed — `treeBeforeRota2` and the
 * `beforeRota2` load option in route-module-loader.mjs — the same way they read
 * it through C7B's and C7C's sanctioned edits. What the mission itself does is
 * proven by rota2-dynamic-traps-tests.mjs and rota2-dynamic-traps-census.mjs.
 *
 * The manifest (`rota2-dynamic-traps-edit.json`) is the diff of each touched
 * Rota source against the mission's base, as hunks: `now` (the live text, with
 * context) and `before` (the base text it replaced). Reversal replaces each
 * `now`, found exactly once, by its `before`. Any other change to those files
 * survives the reversal, so an unsanctioned edit still fails every historical
 * check that would have caught it.
 *
 * Usage:
 *   node tools/validation/rota2-dynamic-traps-edit.mjs          # check: the manifest reverses the
 *        working tree to the base byte for byte, file by file (exit 1 if not)
 *   node tools/validation/rota2-dynamic-traps-edit.mjs --write  # regenerate the manifest from the diff
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export const ROTA2_DYNAMIC_TRAPS_BASE = "9f8ebb5d8c0c747e68d8719e523ecab3ecbdab00";
export const ROTA2_DYNAMIC_TRAPS_MARKER = "ROTA2-DYNAMIC-TRAPS-01";
export const ROTA2_DYNAMIC_TRAPS_FILES = Object.freeze([
  "src/games/escape-maze/route-generation.ts",
  "src/games/escape-maze/route-geometry.ts",
  "src/games/escape-maze/route-state.ts",
  "src/games/escape-maze/route-events.ts",
  "src/games/escape-maze/route-invariants.ts",
  "src/games/escape-maze/route-generation-worker-protocol.ts",
  "src/games/escape-maze/useEscapeMaze.ts",
  "src/games/escape-maze/RouteBabylonBoard.tsx",
  "src/games/escape-maze/RouteStrategyGame.tsx",
  "src/games/escape-maze/routeBabylonScene.ts",
]);
const MANIFEST = path.join(path.dirname(new URL(import.meta.url).pathname), "rota2-dynamic-traps-edit.json");

const normalize = (text) => text.replace(/\r\n/g, "\n");

/** The manifest: { file: [{ now, before }] }. Empty when it has not been written yet. */
export function readRota2Edit() {
  return fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : {};
}

/**
 * `text` (the file `file`) with the Rota 2.0 delta reversed. A text without the
 * mission's marker is a tree before Rota 2.0 and comes back as it is; a text
 * with it must take every hunk exactly once, or the reversal refuses loudly —
 * the manifest is stale or the file was edited where the delta lives.
 */
export function reverseRota2(file, text, edit = readRota2Edit()) {
  const hunks = edit[file];
  if (!hunks || !text.includes(ROTA2_DYNAMIC_TRAPS_MARKER)) return text;
  let out = text;
  for (const [index, hunk] of hunks.entries()) {
    const at = out.indexOf(hunk.now);
    if (at < 0 || out.indexOf(hunk.now, at + 1) >= 0) {
      throw new Error(
        `rota2 reversal: hunk ${index + 1} of ${file} is ${at < 0 ? "missing" : "ambiguous"} — ` +
          "regenerate tools/validation/rota2-dynamic-traps-edit.json (node tools/validation/rota2-dynamic-traps-edit.mjs --write) " +
          "only if the change is part of the approved mission",
      );
    }
    out = out.slice(0, at) + hunk.before + out.slice(at + hunk.now.length);
  }
  return out;
}

/** Hunks of `git diff -U<context> base -- file`, as { now, before } pairs of whole lines. */
function diffHunks(root, file, context) {
  const diff = execFileSync("git", ["diff", "--no-color", `-U${context}`, ROTA2_DYNAMIC_TRAPS_BASE, "--", file], { cwd: root, encoding: "utf8" });
  const hunks = [];
  let current = null;
  for (const line of normalize(diff).split("\n")) {
    if (line.startsWith("@@")) {
      current = { now: [], before: [] };
      hunks.push(current);
      continue;
    }
    if (!current || line.startsWith("\\")) continue;
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    const mark = line[0];
    const body = line.slice(1);
    if (mark === " ") {
      current.now.push(body);
      current.before.push(body);
    } else if (mark === "+") current.now.push(body);
    else if (mark === "-") current.before.push(body);
  }
  return hunks.map((h) => ({ now: `${h.now.join("\n")}\n`, before: `${h.before.join("\n")}\n` }));
}

function main() {
  const root = process.cwd();
  if (process.argv.includes("--write")) {
    const edit = {};
    for (const file of ROTA2_DYNAMIC_TRAPS_FILES) {
      // Widen the context until every hunk is unique in the live text.
      for (let context = 3; context <= 12; context += 1) {
        const hunks = diffHunks(root, file, context);
        const text = normalize(fs.readFileSync(path.join(root, file), "utf8"));
        if (hunks.every((h) => text.indexOf(h.now) >= 0 && text.indexOf(h.now, text.indexOf(h.now) + 1) < 0)) {
          edit[file] = hunks;
          break;
        }
      }
      if (!edit[file]) throw new Error(`could not make the hunks of ${file} unique`);
    }
    fs.writeFileSync(MANIFEST, `${JSON.stringify(edit, null, 2)}\n`);
    console.log(`wrote ${path.relative(root, MANIFEST)}: ${Object.entries(edit).map(([f, h]) => `${path.basename(f)} ${h.length}`).join(", ")}`);
  }
  const edit = readRota2Edit();
  const rows = ROTA2_DYNAMIC_TRAPS_FILES.map((file) => {
    const live = normalize(fs.readFileSync(path.join(root, file), "utf8"));
    const base = normalize(execFileSync("git", ["show", `${ROTA2_DYNAMIC_TRAPS_BASE}:${file}`], { cwd: root, encoding: "utf8" }));
    let reversed = null;
    let error = null;
    try {
      reversed = reverseRota2(file, live, edit);
    } catch (e) {
      error = e.message;
    }
    return { file, hunks: edit[file]?.length ?? 0, exact: reversed === base, error };
  });
  for (const row of rows) console.log(`${row.exact ? "EXACT " : "DRIFT "} ${row.file} (${row.hunks} hunks)${row.error ? ` — ${row.error}` : ""}`);
  const ok = rows.every((r) => r.exact);
  console.log(ok ? "ROTA2_REVERSAL_EXACT" : "ROTA2_REVERSAL_DRIFT");
  process.exitCode = ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
