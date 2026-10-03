/**
 * Shared diagnostic loader for the Rota Estratégica generator.
 *
 * Loads the Rota's module graph (route-module-loader.mjs) with observability
 * added and nothing else changed:
 *
 *   - every `return null` inside `isStructurallyValid` carries a reason code,
 *     named after the check that produced it, in source order;
 *   - the routeCellsHaveEscape rejection publishes its full context (walls,
 *     guardian, portal, lights, objective route);
 *   - `isValidMap`'s final conjunction becomes named checks, so a candidate
 *     reports EVERY gate it fails instead of only the first. The conjuncts are
 *     pure, so dropping short-circuiting changes no verdict.
 *
 * ROUTE-C0: each of those is found by the parser in WHICHEVER Rota module
 * declares the function, not by its file or by the name of the function that
 * happens to follow it. The probes write to `globalThis`, which is one object
 * for the whole graph, so they keep reporting when the generator is split.
 *
 * Production source is never written to. Callers drive `buildCandidate` and
 * `isValidMap` through `replayGeneration`, which mirrors production's two
 * phases exactly.
 */
import {
  ROUTE_HOOK,
  ROUTE_MODULE_DIR,
  functionRange,
  loadRouteModules,
  normalizeSource,
  openSourceTree,
} from "./route-module-loader.mjs";

export { normalizeSource };

/** The private bindings the diagnostics reach, wherever in the Rota each is declared. */
const EXPORT_SURFACE = [
  "buildCandidate", "isValidMap", "generateMaze", "routeCellsHaveEscape", "computeObjectiveRoute",
  "resolveObjectiveRoute", "admissibleRouteCells", "escapeGeometryIsPossible",
  "computePortalDefenceZone", "createSentinelState", "decideSentinelMove", "chooseGuardianMove",
  "inspectDynamicMazeState",
  "decomposeBoardBlocks", "sharesBlock", "getNeighbors", "getReachableDistances", "findPathLength",
  "findPathCells", "chooseStars", "getRouteStageTemplates", "ROUTE_STAGE_EXIT_CANDIDATES",
  "ROUTE_STAGE_GUARDIAN_CANDIDATES", "ROUTE_STAGE_QUALITY", "ROUTE_STAGE_TEMPLATES",
  "WALL_LIMITS", "BASE_STAR_COUNT", "BASE_TRAP_COUNT", "DIFFICULTY_PLAY_BRIEF",
  "getWallLimits", "getStarCount", "getStarMinSeparation", "getTrapCount",
  "getMinimumPathLength",
  "MAX_GENERATION_ATTEMPTS", "RECOVERY_ROUNDS", "RECOVERY_RETRIES_PER_SLOT",
  "PORTAL_ZONE_RADIUS", "SENTINEL_LEASH", "SENTINEL_THREAT_HORIZON",
  "SENTINEL_COMMIT_TURNS", "MOVE_INPUT_GUARD_MS",
  "randomItem", "posKey", "PLAYER_START", "START_SAFE_CELLS", "ROWS", "COLS",
];

/**
 * MINDFLOW-VALIDATION-HYGIENE-04 — the seam that makes source instrumentation
 * line-ending independent.
 *
 * `instrument()` and every caller-supplied `transform` anchor on newline-shaped
 * literals ("  return (\n", "\n  );", "\r\n"-free regexes). The repository is
 * checked out with `core.autocrlf=true` and has no `.gitattributes`, so the git
 * blob is LF while the working copy is CRLF — and whether a given file is LF or
 * CRLF on disk depends on whether git last touched it. That made every textual
 * anchor depend on checkout history rather than on the code, and it is what
 * broke `final-acceptance` (the LF anchor "  return (\n" simply stopped
 * matching, with no change to `isValidMap` itself).
 *
 * Since ROUTE-C0 the normalisation itself lives in route-module-loader.mjs —
 * the single place any Rota source is read — and is re-exported here. Every
 * module of the graph, every override and every transform's output passes
 * through it, so there is still exactly one place that makes every present and
 * future anchor stable.
 */

/**
 * The exact text of `useEscapeMaze.ts` a hook transform receives.
 *
 * A caller that builds an anchor by reading the file itself gets whatever line
 * endings the checkout happens to have, and its `replace` then silently
 * matches nothing — the transform becomes a no-op and the harness measures
 * unmodified production while believing it measured a counterfactual. Anchors
 * must come from here (or `routeSource`) so both sides are the same text.
 */
export function productionSource() {
  return routeSource(ROUTE_HOOK);
}

/** Any Rota module's text, exactly as a transform of that module receives it. */
export function routeSource(file, { rev } = {}) {
  return openSourceTree({ rev }).read(file);
}

/**
 * The Rota module that declares `name` — where a transform aimed at that
 * declaration has to go. Asking for the declaration instead of naming the file
 * keeps a counterfactual working when the declaration is moved.
 */
export function routeModuleDeclaring(name, { rev } = {}) {
  return openSourceTree({ rev }).declaring(name);
}

const shapeChanged = (what, detail) => new Error(`generator shape changed: ${what} (${detail})`);

/** isStructurallyValid: a reason code per `return null`, and the escape-width context. */
function instrumentStructural(file, source) {
  const range = functionRange(file, source, "isStructurallyValid");
  const svBody = source.slice(range.start, range.end);

  const structuralReasons = [];
  const lines = svBody.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes("return null;")) continue;
    let label = lines[i].trim();
    if (label === "return null;") {
      for (let j = i - 1; j >= 0 && j > i - 6; j -= 1) {
        if (lines[j].trim()) { label = lines[j].trim(); break; }
      }
    }
    structuralReasons.push(
      label.replace(/^if \(/, "").replace(/\) return null;$/, "").slice(0, 96),
    );
  }
  let tag = 0;
  let body = svBody.replace(
    /return null;/g,
    () => `return ((globalThis as { __structuralReason?: number }).__structuralReason = ${tag++}, null);`,
  );
  const success = "  return { blocks, objective };";
  if (!body.includes(success)) throw shapeChanged("isStructurallyValid", `${file}: no "${success.trim()}"`);
  body = body.replace(
    success,
    "  (globalThis as { __structuralReason?: number }).__structuralReason = -1;\n  return { blocks, objective };",
  );

  // Context at the escape-width rejection: the only place the failing route exists.
  const escapeCall = body
    .split("\n")
    .find((line) => line.includes("routeCellsHaveEscape(") && line.includes("if (!"));
  if (!escapeCall) throw shapeChanged("routeCellsHaveEscape guard", `${file}#isStructurallyValid`);
  body = body.replace(
    escapeCall,
    `  (globalThis as { __escapeContext?: unknown }).__escapeContext = {
    walls: [...walls],
    guardianStart: posKey(guardianStart),
    exitPosition: posKey(exitPosition),
    stars: collectibleStars.map(posKey),
    objectiveCells: objective.cells.map(posKey),
    moves: objective.moves,
  };
${escapeCall}`,
  );

  return { source: source.slice(0, range.start) + body + source.slice(range.end), structuralReasons };
}

/** isValidMap: named checks instead of one conjunction. */
function instrumentFinalGates(file, source) {
  const range = functionRange(file, source, "isValidMap");
  const ivBody = source.slice(range.start, range.end);
  const retStart = ivBody.lastIndexOf("  return (\n");
  const retEnd = ivBody.indexOf("\n  );", retStart);
  if (retStart < 0 || retEnd < 0) throw shapeChanged("isValidMap return", file);
  const conjuncts = ivBody
    .slice(retStart + "  return (\n".length, retEnd)
    .split("&&\n")
    .map((part) => part.trim().replace(/&&$/, "").trim())
    .filter(Boolean);
  const finalGateNames = conjuncts.map((c) => c.replace(/\s+/g, " "));
  const named = `  const __checks: Array<[string, boolean]> = [
${conjuncts.map((c, i) => `    [${JSON.stringify(finalGateNames[i])}, Boolean(${c})],`).join("\n")}
  ];
  const __failed = __checks.filter((entry) => !entry[1]).map((entry) => entry[0]);
  (globalThis as { __finalGates?: unknown }).__finalGates = __failed;
  return __failed.length === 0;`;
  let body = ivBody.slice(0, retStart) + named + ivBody.slice(retEnd + "\n  );".length);
  const noObjective = "  if (!objective) return false;";
  if (!body.includes(noObjective)) throw shapeChanged("isValidMap return", `${file}: no "${noObjective.trim()}"`);
  body = body.replace(
    noObjective,
    `  if (!objective) {
    (globalThis as { __finalGates?: unknown }).__finalGates = ["objectiveRouteExists"];
    return false;
  }`,
  );

  return { source: source.slice(0, range.start) + body + source.slice(range.end), finalGateNames };
}

/**
 * The diagnostics as one graph-wide transform. It instruments a function in
 * the module that declares it, and `verify()` then insists each was found
 * exactly once in the whole graph — a generator that moved out from under the
 * instrumentation fails loudly instead of reporting nothing.
 */
function createInstrumentation() {
  const found = { isStructurallyValid: [], isValidMap: [] };
  const result = { structuralReasons: [], finalGateNames: [] };
  const transform = (source, file) => {
    if (!file.startsWith(ROUTE_MODULE_DIR)) return source;
    let out = source;
    if (functionRange(file, out, "isStructurallyValid")) {
      const instrumented = instrumentStructural(file, out);
      found.isStructurallyValid.push(file);
      result.structuralReasons = instrumented.structuralReasons;
      out = instrumented.source;
    }
    if (functionRange(file, out, "isValidMap")) {
      const instrumented = instrumentFinalGates(file, out);
      found.isValidMap.push(file);
      result.finalGateNames = instrumented.finalGateNames;
      out = instrumented.source;
    }
    return out;
  };
  const verify = () => {
    if (found.isStructurallyValid.length !== 1) {
      throw shapeChanged("isStructurallyValid", `declared by ${found.isStructurallyValid.length} Rota modules`);
    }
    if (found.isValidMap.length !== 1) {
      throw shapeChanged("isValidMap return", `declared by ${found.isValidMap.length} Rota modules`);
    }
  };
  return { transform, verify, result };
}

/**
 * `transform` lets a caller build a counterfactual variant of the generator in
 * memory — reverting a fix to reproduce pre-fix behaviour, or neutering a guard
 * so both its verdict and the full pipeline's can be observed on the same
 * candidate. The file on disk is never written to.
 *
 *   transform        the hook's text only (the original, single-file seam);
 *   transforms       per module, `{ "src/…": fn }`, or graph-wide `fn(source, file)`
 *                    — see route-module-loader.mjs; aim one at a declaration
 *                    with `routeModuleDeclaring(name)`;
 *   sourceOverrides  `{ "src/…": text }` — one module replaced in memory;
 *   rev              every module of the graph as it was at that commit.
 */
export function loadInstrumented({
  transform,
  transforms,
  sourceOverrides,
  rev = null,
  bare = false,
  react,
} = {}) {
  // `bare` skips the diagnostics entirely and only exposes the surface. Timing
  // must be measured on the real control flow: the named-checks rewrite drops
  // short-circuiting in isValidMap, which is overhead production never pays.
  const instrumentation = bare ? null : createInstrumentation();
  // Transforms are normalised again after they run, not only before: a caller
  // can splice in text that carries its own line endings (a literal read from
  // another file, a string built on Windows), and the instrumentation must
  // never be handed CRLF whatever route the text took to reach it.
  const ROTA = loadRouteModules({
    rev,
    sourceOverrides,
    // `react` lets a caller supply a STATEFUL shim and drive the hook
    // headlessly (see route-runtime-harness.mjs). Without it the inert shim is
    // enough for the pure generator functions.
    react,
    surface: EXPORT_SURFACE,
    transforms: [transform && { [ROUTE_HOOK]: transform }, transforms, instrumentation?.transform],
  });
  instrumentation?.verify();
  const { structuralReasons, finalGateNames } = instrumentation?.result ?? { structuralReasons: [], finalGateNames: [] };

  const sb = ROTA.sandbox;
  const { setSeed } = ROTA;
  const API = ROTA.api;

  /**
   * Production's generateMaze, attempt by attempt, with every rejection
   * explained. `forcedTemplateIndex` pins the template the way the 9x9
   * validator does; omit it for the production regime.
   */
  function replayGeneration({ difficulty, stage, forcedTemplateIndex, capture = true }) {
    const templates = API.getRouteStageTemplates(stage);
    const exits = API.ROUTE_STAGE_EXIT_CANDIDATES[stage];
    const forced =
      forcedTemplateIndex === undefined || forcedTemplateIndex === null
        ? null
        : templates[Math.min(forcedTemplateIndex, templates.length - 1)];
    const attempts = [];
    let settled = null;

    const settle = (template, exitPosition, phase) => {
      sb.__structuralReason = undefined;
      sb.__escapeContext = undefined;
      sb.__finalGates = undefined;
      sb.__early = undefined;
      const candidate = API.buildCandidate(template, exitPosition, difficulty, stage);
      const record = {
        attempt: attempts.length + 1,
        phase,
        templateIndex: templates.indexOf(template),
        exit: API.posKey(exitPosition),
        structuralReason: sb.__structuralReason,
        // Only present in a variant where the early guard is observed rather
        // than enforced; undefined in the shipped generator.
        earlyVerdict: sb.__early,
        passedStructural: Boolean(candidate),
      };
      if (capture) record.escapeContext = sb.__escapeContext ?? null;
      if (candidate) {
        const ok = API.isValidMap(candidate.map, difficulty, stage, candidate.analysis);
        record.finalGatesFailed = sb.__finalGates ?? [];
        record.certified = ok;
        if (capture) {
          record.map = {
            walls: [...candidate.map.walls].sort(),
            guardianStart: API.posKey(candidate.map.guardianStart),
            exitPosition: API.posKey(candidate.map.exitPosition),
            stars: candidate.map.collectibleStars.map(API.posKey),
            traps: candidate.map.traps.map(API.posKey),
            chest: candidate.map.chest ? API.posKey(candidate.map.chest) : null,
            objectiveCells: candidate.analysis.objective
              ? candidate.analysis.objective.cells.map(API.posKey)
              : null,
          };
        }
        attempts.push(record);
        return ok ? candidate.map : null;
      }
      attempts.push(record);
      return null;
    };

    for (let i = 0; i < API.MAX_GENERATION_ATTEMPTS && !settled; i += 1) {
      const template = forced ?? API.randomItem(templates);
      settled = settle(template, API.randomItem(exits), "random");
    }
    if (!settled) {
      outer:
      for (let round = 0; round < API.RECOVERY_ROUNDS; round += 1) {
        for (const template of forced ? [forced] : templates) {
          for (const exitPosition of exits) {
            for (let retry = 0; retry < API.RECOVERY_RETRIES_PER_SLOT; retry += 1) {
              settled = settle(template, exitPosition, "recovery");
              if (settled) break outer;
            }
          }
        }
      }
    }

    const randomAttempts = attempts.filter((a) => a.phase === "random").length;
    const histogram = {};
    for (const a of attempts) {
      const label =
        a.structuralReason === -1 || a.structuralReason === undefined
          ? a.certified
            ? "CERTIFIED"
            : `FINAL: ${(a.finalGatesFailed ?? []).join(" | ") || "?"}`
          : `[${a.structuralReason}] ${structuralReasons[a.structuralReason] ?? "?"}`;
      histogram[label] = (histogram[label] ?? 0) + 1;
    }
    return {
      map: settled,
      threw: !settled,
      attempts,
      totalAttempts: attempts.length,
      randomAttempts,
      recoveryAttempts: attempts.length - randomAttempts,
      histogram,
    };
  }

  return {
    API,
    /** The hook module's real export surface — `useEscapeMaze` included. */
    exports: ROTA.hook,
    /** The shared RNG seam, as every module of the graph sees it (one instance). */
    get routeRandom() {
      return ROTA.routeRandom;
    },
    /** The graph's one global object: the probes above write to it. */
    sb,
    /** The loaded graph, for callers that need a module or its provenance. */
    graph: ROTA.graph,
    setSeed,
    replayGeneration,
    structuralReasons,
    finalGateNames,
  };
}
