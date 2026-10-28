/**
 * ROTA2-DEPENDENT-OBJECTIVES-02 — the second approved Rota 2.0 delta, pinned hunk by hunk.
 *
 * Same contract as rota2-dynamic-traps-edit.mjs, one mission later. The approved Rota 2.0 missions are a CHAIN:
 * the live tree reverses this mission's hunks first (back to ROTA2-DYNAMIC-TRAPS-01's final tree, this mission's
 * base) and then ROTA2-DYNAMIC-TRAPS-01's hunks (back to the v1 tree). route-module-loader's `treeBeforeRota2`
 * applies both, in that order, so every extraction suite still reads the Rota as it was before Rota 2.0 — and an
 * edit outside either mission's hunks still survives the reversal and still fails them.
 *
 * This mission also ADDS one module, `route-objectives.ts`: before the mission it does not exist, so the reversed
 * view has no such file (`ROTA2_DEPENDENT_OBJECTIVES_ADDED_FILES`). Its text is the mission's own and is proven by
 * rota2-dependent-objectives-tests.mjs (O24: pure, no React/Babylon/browser).
 *
 * Usage:
 *   node tools/validation/rota2-dependent-objectives-edit.mjs          # check: the manifest reverses the working
 *        tree to the mission's base byte for byte, file by file (exit 1 if not)
 *   node tools/validation/rota2-dependent-objectives-edit.mjs --write  # regenerate the manifest from the diff
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  ROTA2_ADAPTIVE_HUNTER_ADDED_FILES,
  ROTA2_ADAPTIVE_HUNTER_FILES,
  reverseAdaptive,
} from "./rota2-adaptive-hunter-edit.mjs";

export const ROTA2_DEPENDENT_OBJECTIVES_BASE = "32c419a2784b54043f38f08afd60c8628f44f54c";
export const ROTA2_DEPENDENT_OBJECTIVES_MARKER = "ROTA2-DEPENDENT-OBJECTIVES-02";
export const ROTA2_DEPENDENT_OBJECTIVES_FILES = Object.freeze([
  "src/games/escape-maze/useEscapeMaze.ts",
  "src/games/escape-maze/route-invariants.ts",
  "src/games/escape-maze/RouteBabylonBoard.tsx",
  "src/games/escape-maze/RouteStrategyGame.tsx",
  "src/games/escape-maze/routeBabylonScene.ts",
  "src/games/escape-maze/route-visual.css",
]);
/** Modules the mission adds: absent from the tree before it. */
export const ROTA2_DEPENDENT_OBJECTIVES_ADDED_FILES = Object.freeze(["src/games/escape-maze/route-objectives.ts"]);
const MANIFEST = path.join(path.dirname(new URL(import.meta.url).pathname), "rota2-dependent-objectives-edit.json");

const normalize = (text) => text.replace(/\r\n/g, "\n");

/** The manifest: { file: [{ now, before }] }. Empty when it has not been written yet. */
export function readObjectivesEdit() {
  return fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : {};
}

/**
 * `text` (the file `file`) with this mission's delta reversed. A text without the mission's marker is a tree
 * before the mission and comes back as it is; a text with it must take every hunk exactly once, or the reversal
 * refuses loudly — the manifest is stale or the file was edited where the delta lives.
 */
export function reverseObjectives(file, text, edit = readObjectivesEdit()) {
  const hunks = edit[file];
  if (!hunks || !text.includes(ROTA2_DEPENDENT_OBJECTIVES_MARKER)) return text;
  let out = text;
  for (const [index, hunk] of hunks.entries()) {
    const at = out.indexOf(hunk.now);
    if (at < 0 || out.indexOf(hunk.now, at + 1) >= 0) {
      throw new Error(
        `rota2 objectives reversal: hunk ${index + 1} of ${file} is ${at < 0 ? "missing" : "ambiguous"} — ` +
          "regenerate tools/validation/rota2-dependent-objectives-edit.json " +
          "(node tools/validation/rota2-dependent-objectives-edit.mjs --write) only if the change is part of the approved mission",
      );
    }
    out = out.slice(0, at) + hunk.before + out.slice(at + hunk.now.length);
  }
  return out;
}

/** True when `tree`-like reader shows this mission's delta in any of its files. */
export function carriesObjectives(exists, read) {
  return (
    ROTA2_DEPENDENT_OBJECTIVES_ADDED_FILES.some((file) => exists(file)) ||
    ROTA2_DEPENDENT_OBJECTIVES_FILES.some((file) => exists(file) && read(file).includes(ROTA2_DEPENDENT_OBJECTIVES_MARKER))
  );
}

/** Hunks of `git diff -U<context> base -- file`, as { now, before } pairs of whole lines. */
function diffHunks(root, file, context) {
  const diff = execFileSync("git", ["diff", "--no-color", `-U${context}`, ROTA2_DEPENDENT_OBJECTIVES_BASE, "--", file], {
    cwd: root,
    encoding: "utf8",
  });
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
    for (const file of ROTA2_DEPENDENT_OBJECTIVES_FILES) {
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
  const edit = readObjectivesEdit();
  // Every Rota file that changed since the base must be one the manifest covers (or one the mission adds).
  const changed = execFileSync("git", ["diff", "--name-only", ROTA2_DEPENDENT_OBJECTIVES_BASE, "--", "src/games/escape-maze/"], {
    cwd: root,
    encoding: "utf8",
  })
    .split("\n")
    .filter(Boolean);
  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "src/games/escape-maze/"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  // ROTA2-ADAPTIVE-HUNTER-04 came after: the chain reverses the newer mission first (rota2-adaptive-hunter-edit.mjs),
  // so this manifest is checked against the tree it was written for — and a file only that mission touched (or added)
  // is outside THIS delta only if it still differs from this base once that mission's hunks are reversed.
  const laterMissionOnly = (file) => {
    if (ROTA2_ADAPTIVE_HUNTER_ADDED_FILES.includes(file)) return true;
    if (!ROTA2_ADAPTIVE_HUNTER_FILES.includes(file)) return false;
    const reversed = reverseAdaptive(file, normalize(fs.readFileSync(path.join(root, file), "utf8")));
    const base = normalize(execFileSync("git", ["show", `${ROTA2_DEPENDENT_OBJECTIVES_BASE}:${file}`], { cwd: root, encoding: "utf8" }));
    return reversed === base;
  };
  const outside = [...changed, ...untracked].filter(
    (file) =>
      !ROTA2_DEPENDENT_OBJECTIVES_FILES.includes(file) &&
      !ROTA2_DEPENDENT_OBJECTIVES_ADDED_FILES.includes(file) &&
      !laterMissionOnly(file),
  );
  const rows = ROTA2_DEPENDENT_OBJECTIVES_FILES.map((file) => {
    const live = reverseAdaptive(file, normalize(fs.readFileSync(path.join(root, file), "utf8")));
    const base = normalize(execFileSync("git", ["show", `${ROTA2_DEPENDENT_OBJECTIVES_BASE}:${file}`], { cwd: root, encoding: "utf8" }));
    let reversed = null;
    let error = null;
    try {
      reversed = reverseObjectives(file, live, edit);
    } catch (e) {
      error = e.message;
    }
    return { file, hunks: edit[file]?.length ?? 0, exact: reversed === base, error };
  });
  for (const row of rows) console.log(`${row.exact ? "EXACT " : "DRIFT "} ${row.file} (${row.hunks} hunks)${row.error ? ` — ${row.error}` : ""}`);
  for (const file of ROTA2_DEPENDENT_OBJECTIVES_ADDED_FILES) {
    console.log(`${fs.existsSync(path.join(root, file)) ? "ADDED " : "ABSENT"} ${file}`);
  }
  if (outside.length) console.log(`OUTSIDE the approved delta: ${outside.join(", ")}`);
  const ok = rows.every((r) => r.exact) && outside.length === 0;
  console.log(ok ? "ROTA2_OBJECTIVES_REVERSAL_EXACT" : "ROTA2_OBJECTIVES_REVERSAL_DRIFT");
  process.exitCode = ok ? 0 : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) main();
