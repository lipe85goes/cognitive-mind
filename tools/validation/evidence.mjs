/**
 * MINDFLOW-VALIDATION-HYGIENE-04 — the evidence write contract.
 *
 * A validator answers a question about the repository. Asking a question must
 * not change the thing being asked about, so running one normally now writes
 * NOTHING: it compares what it just computed against the recorded evidence and
 * reports agreement or divergence. Rewriting evidence is a separate, explicit
 * act (`--update`), because replacing the record is a decision, not a side
 * effect of reading.
 *
 * Two distinct causes of churn are handled here, and they need different
 * treatment:
 *
 *   VERDICT DATA — what the validator concluded. A difference here is a real
 *   signal and must FAIL loudly with a diff, never be absorbed.
 *
 *   RUN METADATA — when the run happened, how long it took, where its temp
 *   directory was. These differ on every run by construction and say nothing
 *   about the code. They are excluded from the comparison by name, and on
 *   `--update` they are carried over unchanged whenever the verdict is
 *   unchanged, so `--update` is a no-op when nothing was actually decided
 *   differently.
 *
 * The repository is checked out with `core.autocrlf=true` and no
 * `.gitattributes`, so a file git wrote is CRLF while a file a tool wrote is
 * LF. An unconditional `writeFileSync` therefore dirtied `git status` even when
 * every byte of meaning was identical — most of the churn this mission was
 * asked to remove had no content difference at all. Writes here reproduce the
 * existing file's line endings and trailing-newline convention, so the only
 * thing that can ever produce a diff is a changed verdict.
 *
 * Exit codes (shared by every validator using this module):
 *   0  agreement — checks passed and evidence matches
 *   1  the validation itself failed (a contract or check is broken)
 *   2  evidence divergence in --check (verdict differs from the record)
 *   3  usage error
 */
import fs from "node:fs";
import path from "node:path";

export const EXIT_OK = 0;
export const EXIT_VALIDATION_FAILED = 1;
export const EXIT_EVIDENCE_DIVERGED = 2;
export const EXIT_USAGE = 3;

/** Resolve the mode from argv. `--check` is the default and needs no flag. */
export function evidenceMode(argv = process.argv.slice(2)) {
  const update = argv.includes("--update");
  const check = argv.includes("--check");
  if (update && check) {
    console.error("usage: pass --check or --update, not both");
    process.exit(EXIT_USAGE);
  }
  return update ? "update" : "check";
}

// --- verdict / metadata separation ------------------------------------------

const clone = (value) => JSON.parse(JSON.stringify(value));

function readPath(object, dotted) {
  return dotted
    .split(".")
    .reduce((node, key) => (node == null ? undefined : node[key]), object);
}

function deletePath(object, dotted) {
  const keys = dotted.split(".");
  const last = keys.pop();
  const parent = keys.reduce(
    (node, key) => (node == null ? undefined : node[key]),
    object,
  );
  if (parent && typeof parent === "object") delete parent[last];
}

function assignPath(object, dotted, value) {
  if (value === undefined) return;
  const keys = dotted.split(".");
  const last = keys.pop();
  const parent = keys.reduce(
    (node, key) => (node == null ? undefined : node[key]),
    object,
  );
  if (parent && typeof parent === "object") parent[last] = value;
}

/** The payload with every declared RUN METADATA path removed. */
function verdictOf(payload, metadata) {
  const stripped = clone(payload);
  for (const dotted of metadata) deletePath(stripped, dotted);
  return stripped;
}

// --- diffing ----------------------------------------------------------------

const describe = (value) => {
  if (value === undefined) return "(absent)";
  const text = JSON.stringify(value);
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
};

/**
 * A structural diff, so a divergence names the field that moved instead of
 * dumping two documents and leaving the reader to find it.
 */
function diff(expected, actual, prefix = "", found = [], limit = 25) {
  if (found.length >= limit) return found;
  const bothObjects =
    expected && actual && typeof expected === "object" && typeof actual === "object" &&
    Array.isArray(expected) === Array.isArray(actual);

  if (!bothObjects) {
    if (JSON.stringify(expected) !== JSON.stringify(actual)) {
      found.push({ path: prefix || "(root)", recorded: describe(expected), computed: describe(actual) });
    }
    return found;
  }

  const keys = [...new Set([...Object.keys(expected), ...Object.keys(actual)])];
  for (const key of keys) {
    if (found.length >= limit) break;
    const at = prefix ? `${prefix}.${key}` : key;
    diff(expected[key], actual[key], at, found, limit);
  }
  return found;
}

// --- file style preservation ------------------------------------------------

function detectStyle(text) {
  if (text === null) return { eol: "\n", trailingNewline: true };
  return {
    eol: text.includes("\r\n") ? "\r\n" : "\n",
    trailingNewline: /\n$/.test(text),
  };
}

function render(payload, style) {
  const body = JSON.stringify(payload, null, 2);
  const withEnding = style.trailingNewline ? `${body}\n` : body;
  return style.eol === "\r\n" ? withEnding.replace(/\n/g, "\r\n") : withEnding;
}

const readIfPresent = (file) =>
  fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;

// --- the recorder -----------------------------------------------------------

/**
 * Open an evidence directory. In check mode the directory is NOT created:
 * creating a directory is a modification, and a check that has nowhere to read
 * from should say so rather than quietly prepare a place to write.
 */
export function openEvidence(directory, { mode = evidenceMode() } = {}) {
  const root = path.resolve(directory);
  const artifacts = [];

  return {
    mode,
    /**
     * @param {string} name        file name inside the evidence directory
     * @param {object} payload     the full evidence document
     * @param {string[]} metadata  dotted paths that are RUN METADATA, not verdict
     */
    write(name, payload, { metadata = [] } = {}) {
      const file = path.join(root, name);
      const relative = path.relative(process.cwd(), file).replace(/\\/g, "/");
      const existingText = readIfPresent(file);

      let recorded = null;
      let unreadable = false;
      if (existingText !== null) {
        try {
          recorded = JSON.parse(existingText);
        } catch {
          unreadable = true;
        }
      }

      const computedVerdict = verdictOf(payload, metadata);
      const recordedVerdict = recorded === null ? null : verdictOf(recorded, metadata);
      const missing = existingText === null;
      const diverged =
        missing ||
        unreadable ||
        JSON.stringify(recordedVerdict) !== JSON.stringify(computedVerdict);

      if (mode === "check") {
        artifacts.push({
          artifact: relative,
          state: missing ? "MISSING" : unreadable ? "UNREADABLE" : diverged ? "DIVERGED" : "MATCHES",
          differences: diverged && !missing && !unreadable ? diff(recordedVerdict, computedVerdict) : [],
        });
        return { changed: false, diverged };
      }

      // update: keep the recorded RUN METADATA when the verdict did not move, so
      // an --update that decides nothing new writes nothing at all.
      const next = clone(payload);
      if (!diverged && recorded !== null) {
        for (const dotted of metadata) assignPath(next, dotted, readPath(recorded, dotted));
      }

      const text = render(next, detectStyle(existingText));
      const identical = existingText !== null && existingText === text;
      if (!identical) {
        fs.mkdirSync(root, { recursive: true });
        fs.writeFileSync(file, text);
      }
      artifacts.push({
        artifact: relative,
        state: missing ? "CREATED" : identical ? "UNCHANGED" : "REWRITTEN",
        differences: diverged && !missing && !unreadable ? diff(recordedVerdict, computedVerdict) : [],
      });
      return { changed: !identical, diverged };
    },

    /**
     * Print the artifact summary and return the process exit code.
     * @param {boolean} ok  the validator's own verdict (did its checks pass?)
     */
    finish({ ok = true } = {}) {
      const diverged = artifacts.filter(({ state }) =>
        ["DIVERGED", "MISSING", "UNREADABLE"].includes(state),
      );

      console.log(`\nevidence (${mode}):`);
      for (const entry of artifacts) console.log(`  ${entry.state.padEnd(10)} ${entry.artifact}`);

      if (mode === "update") {
        const written = artifacts.filter(({ state }) => state !== "UNCHANGED");
        console.log(
          written.length === 0
            ? "  nothing to rewrite — the recorded evidence already matches"
            : `  rewritten: ${written.map(({ artifact }) => artifact).join(", ")}`,
        );
        return ok ? EXIT_OK : EXIT_VALIDATION_FAILED;
      }

      if (diverged.length > 0) {
        console.log("\nEVIDENCE_DIVERGED — the computed verdict differs from the record:");
        for (const entry of diverged) {
          console.log(`\n  ${entry.artifact} (${entry.state})`);
          for (const d of entry.differences) {
            console.log(`    ${d.path}\n      recorded: ${d.recorded}\n      computed: ${d.computed}`);
          }
        }
        console.log(
          "\nIf the new verdict is the correct one, re-run with --update to replace the record.",
        );
      }

      // A broken contract outranks a stale record. If both are true the diff is
      // still printed above, but the exit code reports the more serious of the
      // two — otherwise a genuine regression would be read as "evidence is old".
      if (!ok) return EXIT_VALIDATION_FAILED;
      return diverged.length > 0 ? EXIT_EVIDENCE_DIVERGED : EXIT_OK;
    },
  };
}
