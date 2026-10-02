/**
 * Shared diagnostic loader for the Rota Estratégica generator.
 *
 * Compiles `useEscapeMaze.ts` in a vm sandbox with observability added and
 * nothing else changed:
 *
 *   - every `return null` inside `isStructurallyValid` carries a reason code,
 *     named after the check that produced it, in source order;
 *   - the routeCellsHaveEscape rejection publishes its full context (walls,
 *     guardian, portal, lights, objective route);
 *   - `isValidMap`'s final conjunction becomes named checks, so a candidate
 *     reports EVERY gate it fails instead of only the first. The conjuncts are
 *     pure, so dropping short-circuiting changes no verdict.
 *
 * Production source is never written to. Callers drive `buildCandidate` and
 * `isValidMap` through `replayGeneration`, which mirrors production's two
 * phases exactly.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import { createSeededRandom } from "./route-lab.mjs";

const ROOT = process.cwd();
const HOOK = path.join(ROOT, "src/games/escape-maze/useEscapeMaze.ts");
const DIFF = path.join(ROOT, "src/engine/difficulty.ts");
const RANDOM = path.join(ROOT, "src/engine/route-random.ts");
const CONTINUATION = path.join(ROOT, "src/games/escape-maze/continuation.ts");

const EXPORT_SURFACE = `
export const __diag = {
  buildCandidate, isValidMap, generateMaze, routeCellsHaveEscape, computeObjectiveRoute,
  resolveObjectiveRoute, admissibleRouteCells, escapeGeometryIsPossible,
  computePortalDefenceZone, createSentinelState, decideSentinelMove, chooseGuardianMove,
  inspectDynamicMazeState,
  decomposeBoardBlocks, sharesBlock, getNeighbors, getReachableDistances, findPathLength,
  findPathCells, chooseStars, getRouteStageTemplates, ROUTE_STAGE_EXIT_CANDIDATES,
  ROUTE_STAGE_GUARDIAN_CANDIDATES, ROUTE_STAGE_QUALITY, ROUTE_STAGE_TEMPLATES,
  WALL_LIMITS, BASE_STAR_COUNT, BASE_TRAP_COUNT, DIFFICULTY_PLAY_BRIEF,
  getWallLimits, getStarCount, getStarMinSeparation, getTrapCount,
  getMinimumPathLength,
  MAX_GENERATION_ATTEMPTS, RECOVERY_ROUNDS, RECOVERY_RETRIES_PER_SLOT,
  PORTAL_ZONE_RADIUS, SENTINEL_LEASH, SENTINEL_THREAT_HORIZON,
  SENTINEL_COMMIT_TURNS, MOVE_INPUT_GUARD_MS,
  randomItem, posKey, PLAYER_START, START_SAFE_CELLS, ROWS, COLS,
};
`;

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
 * Normalising once, here, is deliberately preferred over widening each anchor to
 * `\r?\n`: there is one read of production source, so there is one place to make
 * every present and future anchor stable. Nothing is written to disk, and the
 * text TypeScript compiles is semantically identical — line terminators are not
 * part of the program.
 */
export const normalizeSource = (text) => text.replace(/\r\n/g, "\n");

function readProductionSource(file) {
  return normalizeSource(fs.readFileSync(file, "utf8"));
}

/**
 * The exact production text `transform` will receive.
 *
 * A caller that builds an anchor by reading `useEscapeMaze.ts` itself gets
 * whatever line endings the checkout happens to have, and its `replace` then
 * silently matches nothing — the transform becomes a no-op and the harness
 * measures unmodified production while believing it measured a counterfactual.
 * Anchors must come from here so both sides are the same text.
 */
export function productionSource() {
  return readProductionSource(HOOK);
}

function instrument(source) {
  const svStart = source.indexOf("function isStructurallyValid(");
  const svEnd = source.indexOf("function isValidMap(");
  if (svStart < 0 || svEnd < 0) throw new Error("generator shape changed: isStructurallyValid");
  const svBody = source.slice(svStart, svEnd);

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
  const tagged = svBody.replace(
    /return null;/g,
    () => `return ((globalThis as { __structuralReason?: number }).__structuralReason = ${tag++}, null);`,
  );
  let out = source.slice(0, svStart) + tagged + source.slice(svEnd);
  out = out.replace(
    "  return { blocks, objective };",
    "  (globalThis as { __structuralReason?: number }).__structuralReason = -1;\n  return { blocks, objective };",
  );

  // Context at the escape-width rejection: the only place the failing route exists.
  const escapeCall = out
    .split("\n")
    .find((line) => line.includes("routeCellsHaveEscape(") && line.includes("if (!"));
  if (!escapeCall) throw new Error("generator shape changed: routeCellsHaveEscape guard");
  out = out.replace(
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

  // isValidMap: named checks instead of one conjunction.
  const ivStart = out.indexOf("function isValidMap(");
  const ivEnd = out.indexOf("function chooseGuardianMove(");
  const ivBody = out.slice(ivStart, ivEnd);
  const retStart = ivBody.lastIndexOf("  return (\n");
  const retEnd = ivBody.indexOf("\n  );", retStart);
  if (retStart < 0 || retEnd < 0) throw new Error("generator shape changed: isValidMap return");
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
  out =
    out.slice(0, ivStart) +
    (ivBody.slice(0, retStart) + named + ivBody.slice(retEnd + "\n  );".length)) +
    out.slice(ivEnd);
  out = out.replace(
    "  if (!objective) return false;",
    `  if (!objective) {
    (globalThis as { __finalGates?: unknown }).__finalGates = ["objectiveRouteExists"];
    return false;
  }`,
  );

  return { source: out + EXPORT_SURFACE, structuralReasons, finalGateNames };
}

const compile = (src) =>
  ts.transpileModule(src, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: HOOK,
  }).outputText;

/**
 * `transform` lets a caller build a counterfactual variant of the generator in
 * memory — reverting a fix to reproduce pre-fix behaviour, or neutering a guard
 * so both its verdict and the full pipeline's can be observed on the same
 * candidate. The file on disk is never written to.
 */
export function loadInstrumented({ transform, bare = false, react } = {}) {
  const raw = readProductionSource(HOOK);
  // Normalised again after `transform`, not only before it: a caller can splice
  // in text that carries its own line endings (a literal read from another file,
  // a string built on Windows), and `instrument()` must never be handed CRLF
  // whatever route the text took to reach it.
  const base = transform ? normalizeSource(transform(raw)) : raw;
  // `bare` skips the diagnostics entirely and only appends the export surface.
  // Timing must be measured on the real control flow: the named-checks rewrite
  // drops short-circuiting in isValidMap, which is overhead production never pays.
  const { source, structuralReasons, finalGateNames } = bare
    ? { source: base + EXPORT_SURFACE, structuralReasons: [], finalGateNames: [] }
    : instrument(base);

  let random = createSeededRandom(1);
  const seededMath = Object.create(Math);
  seededMath.random = () => random();

  /**
   * ROTA-DIFFICULTY-04C: the Rota's RNG seam. Instantiated ONCE and handed to
   * both modules that import it, because a seed armed through one has to be the
   * seed the other draws from — two copies would silently desynchronise the
   * Hunter from generation.
   *
   * `Math` inside it is the sandbox's seeded `Math`, so the tooling's existing
   * `setSeed` path keeps working untouched when no diagnostic seed is armed.
   */
  const rMod = { exports: {} };
  const rS = {
    module: rMod, exports: rMod.exports, console, Math: seededMath, Set, Map,
    require() { throw new Error("unexpected import"); },
  };
  rS.globalThis = rS;
  vm.createContext(rS);
  new vm.Script(compile(fs.readFileSync(RANDOM, "utf8"))).runInContext(rS);

  const dMod = { exports: {} };
  const dS = {
    module: dMod, exports: dMod.exports, console, Math: seededMath, Set, Map,
    require(r) {
      if (r === "@/engine/route-random") return rMod.exports;
      throw new Error("unexpected import " + r);
    },
  };
  dS.globalThis = dS;
  vm.createContext(dS);
  new vm.Script(compile(fs.readFileSync(DIFF, "utf8"))).runInContext(dS);

  // ROUTE-JOURNEY-TERMINAL-01: where a Route's end leads (`nextJourneyRoute`).
  // Types-only module, so it needs nothing. Loaded only if the hook asks: a
  // hook read from an older commit never imports it.
  let cMod = null;
  const continuationModule = () => {
    if (!cMod) {
      cMod = { exports: {} };
      const cS = {
        module: cMod, exports: cMod.exports, Number,
        require() { throw new Error("unexpected import"); },
      };
      cS.globalThis = cS;
      vm.createContext(cS);
      new vm.Script(compile(fs.readFileSync(CONTINUATION, "utf8"))).runInContext(cS);
    }
    return cMod.exports;
  };

  const hMod = { exports: {} };
  const sb = {
    module: hMod, exports: hMod.exports, console, Math: seededMath, Date, Set, Map,
    setTimeout, clearTimeout, performance,
    require(r) {
      if (r === "react") {
        // `react` lets a caller supply a STATEFUL shim and drive the hook
        // headlessly (see route-runtime-harness.mjs). Without it the default
        // inert shim is enough for the pure generator functions.
        return (
          react ?? {
            useCallback: (c) => c, useEffect: () => {}, useMemo: (f) => f(),
            useRef: (v) => ({ current: v }),
            useState: (v) => [typeof v === "function" ? v() : v, () => {}],
          }
        );
      }
      if (r === "@/engine/difficulty") return dMod.exports;
      if (r === "@/engine/route-random") return rMod.exports;
      if (r === "@/engine/scoring") return { calculateEscapeMazeScore: () => 0 };
      if (r === "@/games/escape-maze/continuation") return continuationModule();
      if (r === "@/lib/game-sounds") {
        return {
          playGentleErrorTone: () => {},
          playSuccessChime: () => {},
          playStoneBreak: () => {},
        };
      }
      throw new Error("unexpected import " + r);
    },
  };
  sb.globalThis = sb;
  vm.createContext(sb);
  new vm.Script(compile(source)).runInContext(sb);

  const API = hMod.exports.__diag;
  const setSeed = (seed) => { random = createSeededRandom(seed); };

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
    /** The module's real export surface — `useEscapeMaze` included. */
    exports: hMod.exports,
    /** The shared RNG seam, as both production modules see it. */
    routeRandom: rMod.exports,
    sb,
    setSeed,
    replayGeneration,
    structuralReasons,
    finalGateNames,
  };
}
