/**
 * MINDFLOW-REPOSITORY-EOL-POLICY-05 — the tooling seams must not care what line
 * endings the checkout produced.
 *
 * This is a regression against a bug class, not a framework. The class:
 * a tool reads production source, anchors on a newline-shaped literal, and
 * silently stops matching when the working copy is CRLF. It cost this project a
 * validation gate that could not run at all (`final-acceptance`) and a harness
 * phase that measured unmodified production while reporting on a counterfactual.
 *
 * `.gitattributes` now pins LF, so the CRLF case should never arise again — but
 * a policy is a promise about checkouts, not a property of the code. These
 * checks assert the code is correct either way, so the seam cannot be quietly
 * removed on the grounds that "everything is LF now".
 *
 * Nothing is written to the repository: the CRLF variants exist only in memory.
 *
 * Usage: node tools/validation/cross-eol-tests.mjs [--check|--update]
 */
import {
  loadInstrumented,
  normalizeSource,
  productionSource,
  routeModuleDeclaring,
  routeSource,
} from "./instrumented-generator.mjs";
import { openEvidence } from "./evidence.mjs";

const EVIDENCE = openEvidence("docs/archive/mindflow-repository-eol-policy-05");

const checks = [];
function check(id, pass, detail) {
  checks.push({ id, pass, ...detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id}`);
  for (const [key, value] of Object.entries(detail)) {
    console.log(`        ${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`);
  }
}

const lf = productionSource();
const crlf = lf.replace(/\n/g, "\r\n");

// --- the seam itself --------------------------------------------------------

check("PRODUCTION_SOURCE_IS_ALWAYS_LF", !lf.includes("\r"), {
  carriageReturns: (lf.match(/\r/g) ?? []).length,
  note: "productionSource() normalises, so callers never see the checkout's line endings",
});

check(
  "NORMALIZE_IS_IDEMPOTENT_AND_CONVERGENT",
  normalizeSource(crlf) === lf && normalizeSource(lf) === lf,
  {
    crlfConvergesToLf: normalizeSource(crlf) === lf,
    lfIsUnchanged: normalizeSource(lf) === lf,
  },
);

// --- the anchors instrument() depends on ------------------------------------

/**
 * The exact literals `instrument()` searches for, asserted present in LF and —
 * for the ones that can — absent in CRLF. The second half is the point: it
 * records why the seam has to exist, so deleting it fails here loudly instead of
 * somewhere far away.
 *
 * The asymmetry is the dangerous part and is pinned deliberately. A LEADING
 * newline anchor ("\n  );") still matches CRLF text, because the \n of \r\n is
 * a real \n. Only a TRAILING one ("  return (\n") breaks, because the character
 * after "(" is \r, not \n. So a CRLF checkout does not fail cleanly: half the
 * anchors keep resolving and produce plausible-looking indices. That is exactly
 * how the previous mission saw retStart = -1 alongside a confident retEnd = 950.
 *
 * ROUTE-C2: each literal is looked for in the text of the module that declares
 * the function it belongs to (`owner`) — the text `instrument()` actually
 * receives — since isStructurallyValid and isValidMap moved to
 * route-generation.ts while chooseGuardianMove stayed in the hook (until
 * ROUTE-C3 moved it to route-defenders.ts; `owner` follows it there).
 */
const ANCHORS = [
  { literal: "function isStructurallyValid(", owner: "isStructurallyValid", breaksOnCrlf: false },
  { literal: "function isValidMap(", owner: "isValidMap", breaksOnCrlf: false },
  { literal: "function chooseGuardianMove(", owner: "chooseGuardianMove", breaksOnCrlf: false },
  { literal: "  return { blocks, objective };", owner: "isStructurallyValid", breaksOnCrlf: false },
  { literal: "  return (\n", owner: "isValidMap", breaksOnCrlf: true },
  { literal: "\n  );", owner: "isValidMap", breaksOnCrlf: false },
];
const ownerText = (owner) => routeSource(routeModuleDeclaring(owner));
const missingFromLf = ANCHORS.filter((a) => !ownerText(a.owner).includes(a.literal)).map((a) => a.literal);
const wrongOnCrlf = ANCHORS.filter(
  (a) => ownerText(a.owner).replace(/\n/g, "\r\n").includes(a.literal) === a.breaksOnCrlf,
).map((a) => a.literal);
check(
  "NEWLINE_SHAPED_ANCHORS_NEED_THE_SEAM",
  missingFromLf.length === 0 && wrongOnCrlf.length === 0,
  {
    anchors: ANCHORS.length,
    missingFromLf,
    anchorsThatBreakOnCrlf: ANCHORS.filter((a) => a.breaksOnCrlf).map((a) => a.literal),
    behavedUnexpectedlyOnCrlf: wrongOnCrlf,
    note: "a trailing-newline anchor breaks on CRLF; a leading-newline one does not, so CRLF fails silently rather than cleanly",
  },
);

// --- end to end -------------------------------------------------------------

/**
 * The strongest form: drive the real loader twice — once normally, once with a
 * transform that hands `instrument()` a fully CRLF source — and require the
 * instrumented result to be identical. This is what guards the class, because
 * `transform` is the one route by which foreign line endings can still arrive.
 *
 * ROUTE-C2: graph-wide (`transforms`), so EVERY module arrives CRLF — the
 * instrumented one included, wherever the generator lives. A hook-only CRLF
 * transform would no longer reach isStructurallyValid / isValidMap at all and
 * would pass without testing anything.
 */
const plain = loadInstrumented();
const viaCrlfTransform = loadInstrumented({
  transforms: (source) => source.replace(/\n/g, "\r\n"),
});

check(
  "INSTRUMENTED_LOAD_SURVIVES_A_CRLF_TRANSFORM",
  viaCrlfTransform.finalGateNames.length > 0,
  {
    gatesParsed: viaCrlfTransform.finalGateNames.length,
    note: "loadInstrumented re-normalises after transform, so instrument() never sees CRLF",
  },
);

check(
  "SAME_GATES_FROM_LF_AND_CRLF",
  JSON.stringify(plain.finalGateNames) === JSON.stringify(viaCrlfTransform.finalGateNames),
  {
    lfGates: plain.finalGateNames.length,
    crlfGates: viaCrlfTransform.finalGateNames.length,
    identical:
      JSON.stringify(plain.finalGateNames) === JSON.stringify(viaCrlfTransform.finalGateNames),
  },
);

check(
  "SAME_STRUCTURAL_REASONS_FROM_LF_AND_CRLF",
  JSON.stringify(plain.structuralReasons) === JSON.stringify(viaCrlfTransform.structuralReasons),
  {
    reasons: plain.structuralReasons.length,
    identical:
      JSON.stringify(plain.structuralReasons) === JSON.stringify(viaCrlfTransform.structuralReasons),
  },
);

/**
 * And the behavioural half: the same seed through both loaders must produce the
 * same map. Identical gate names would still allow a subtly different program.
 */
plain.setSeed(12432045);
const fromLf = plain.replayGeneration({ difficulty: "hard", stage: 3, capture: false });
viaCrlfTransform.setSeed(12432045);
const fromCrlf = viaCrlfTransform.replayGeneration({ difficulty: "hard", stage: 3, capture: false });

const fingerprint = (run) =>
  run.map
    ? JSON.stringify({
        attempts: run.totalAttempts,
        walls: [...run.map.walls].sort(),
        exit: run.map.exitPosition,
        guardian: run.map.guardianStart,
        stars: run.map.collectibleStars,
        traps: run.map.traps,
        chest: run.map.chest,
      })
    : `threw:${run.threw}`;

check("SAME_GENERATED_MAP_FROM_LF_AND_CRLF", fingerprint(fromLf) === fingerprint(fromCrlf), {
  seed: 12432045,
  lfAttempts: fromLf.totalAttempts,
  crlfAttempts: fromCrlf.totalAttempts,
  identicalMap: fingerprint(fromLf) === fingerprint(fromCrlf),
});

const allPass = checks.every(({ pass }) => pass);

EVIDENCE.write("cross-eol-tooling.json", {
  mission: "MINDFLOW-REPOSITORY-EOL-POLICY-05",
  seam: "tools/validation/instrumented-generator.mjs — normalizeSource / productionSource",
  bugClass:
    "a tool reads production source, anchors on a newline-shaped literal, and silently stops matching when the checkout is CRLF",
  policy: ".gitattributes pins LF, but these checks hold with or without it",
  checks,
  allPass,
});

console.log(`\n${allPass ? "CROSS_EOL_TOOLING_OK" : "CROSS_EOL_TOOLING_FAILED"}`);
process.exitCode = EVIDENCE.finish({ ok: allPass });
