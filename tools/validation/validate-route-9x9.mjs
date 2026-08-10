import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const SOURCE_PATH = path.join(
  ROOT,
  "src",
  "games",
  "escape-maze",
  "useEscapeMaze.ts",
);
const DIFFICULTIES = ["easy", "medium", "hard"];
const STAGES = [1, 2, 3];

function readNumberArgument(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  const value = Number(process.argv[index + 1]);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
}

function readStringArgument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

/**
 * Expose the generator's internals WITHOUT patching any function body.
 *
 * The previous version rewrote two exact statements inside `generateMaze` — one
 * to force a template, one to publish metadata. Both anchor strings died in the
 * buildCandidate/recovery-sweep refactor and this validator threw on every run,
 * silently, for as long as nobody ran it.
 *
 * Append-only export surface instead. Template and exit are chosen by the
 * caller anyway, so the harness drives `buildCandidate` + `isValidMap` itself
 * and observes what it needs by construction. A missing binding now fails with
 * the offending name; and `harnessGenerate` is held to production behaviour by
 * `checkGenerationFidelity`, which compares whole maps, not source text.
 */
const VALIDATION_BINDINGS = [
  "ROWS",
  "COLS",
  "MAX_GENERATION_ATTEMPTS",
  "RECOVERY_ROUNDS",
  "RECOVERY_RETRIES_PER_SLOT",
  "PLAYER_START",
  "START_SAFE_CELLS",
  "ROUTE_STAGE_EXIT_CANDIDATES",
  "ROUTE_STAGE_GUARDIAN_CANDIDATES",
  "MAZE_TEMPLATES",
  "STAGE_ONE_TEMPLATES",
  "ROUTE_STAGE_TEMPLATES",
  "ROUTE_STAGE_QUALITY",
  "WALL_LIMITS",
  "BASE_STAR_COUNT",
  "BASE_TRAP_COUNT",
  "generateMaze",
  "buildCandidate",
  "getMinimumPathLength",
  "getRouteStageTemplates",
  "getWallLimits",
  "getStarCount",
  "getTrapCount",
  "getReachableDistances",
  "countReachableJunctions",
  "findPathLength",
  "isValidMap",
  "chooseGuardianMove",
  "randomItem",
  "posKey",
];

function buildExportSurface(source) {
  const missing = VALIDATION_BINDINGS.filter(
    (name) => !new RegExp(`(?:function|const|let)\\s+${name}\\b`).test(source),
  );
  if (missing.length > 0) {
    throw new Error(
      `Route generator no longer declares: ${missing.join(", ")}. Update ` +
        "VALIDATION_BINDINGS — never change production to satisfy the validator.",
    );
  }
  const surface = VALIDATION_BINDINGS.map((name) => `  ${name},`).join("\n");
  return `${source}

export const __routeValidation = {
${surface}
};
`;
}

/**
 * `generateMaze`, driven from the harness so template and exit are observable
 * and forceable. Mirrors production's two phases exactly: randomised search,
 * then the bounded deterministic recovery sweep, both ending at the same
 * `isValidMap`. There is no uncertified path here either — it throws.
 *
 * Fidelity to production is asserted, not assumed: see checkGenerationFidelity.
 */
function harnessGenerate(api, difficulty, routeStage, forcedTemplateIndex) {
  const exitCandidates = api.ROUTE_STAGE_EXIT_CANDIDATES[routeStage];
  const templates = api.getRouteStageTemplates(routeStage);
  const forced =
    forcedTemplateIndex === undefined
      ? null
      : templates[Math.min(forcedTemplateIndex, templates.length - 1)];
  let attempts = 0;

  const settle = (template, exitPosition, phase) => {
    const candidate = api.buildCandidate(template, exitPosition, difficulty, routeStage);
    attempts += 1;
    if (
      candidate &&
      api.isValidMap(candidate.map, difficulty, routeStage, candidate.analysis)
    ) {
      return {
        map: candidate.map,
        attempts,
        templateIndex: templates.indexOf(template),
        phase,
        fallback: false,
      };
    }
    return null;
  };

  for (let attempt = 0; attempt < api.MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const template = forced ?? api.randomItem(templates);
    const settled = settle(template, api.randomItem(exitCandidates), "random");
    if (settled) return settled;
  }

  for (let round = 0; round < api.RECOVERY_ROUNDS; round += 1) {
    for (const template of forced ? [forced] : templates) {
      for (const exitPosition of exitCandidates) {
        for (let retry = 0; retry < api.RECOVERY_RETRIES_PER_SLOT; retry += 1) {
          const settled = settle(template, exitPosition, "recovery");
          if (settled) return settled;
        }
      }
    }
  }

  throw new Error(
    `Route map generation failed all gates for stage ${routeStage} (${difficulty}).`,
  );
}

/**
 * The replacement for the old string anchor: run the harness loop and the real
 * `generateMaze` from the same seed and require the same map, byte for byte.
 * If the production loop ever changes shape, this fails loudly with a diff
 * instead of the validator quietly measuring something else.
 */
function checkGenerationFidelity(api, setSeed, samples = 12) {
  const mismatches = [];
  let compared = 0;
  for (const stage of STAGES) {
    for (const difficulty of DIFFICULTIES) {
      for (let index = 0; index < samples; index += 1) {
        const seed = 900_000_000 + stage * 1_000_000 + index;
        setSeed(seed);
        const viaHarness = harnessGenerate(api, difficulty, stage, undefined);
        setSeed(seed);
        const viaProduction = api.generateMaze(difficulty, stage);
        compared += 1;
        const a = JSON.stringify(canonicalMap(viaHarness.map));
        const b = JSON.stringify(canonicalMap(viaProduction));
        if (a !== b) {
          mismatches.push({ stage, difficulty, seed });
        }
      }
    }
  }
  return { compared, mismatches };
}

function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function loadRouteGenerator() {
  const source = buildExportSurface(fs.readFileSync(SOURCE_PATH, "utf8"));
  const output = ts.transpileModule(source, {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: SOURCE_PATH,
  }).outputText;

  let currentRandom = createSeededRandom(1);
  const seededMath = Object.create(Math);
  seededMath.random = () => currentRandom();

  const moduleRecord = { exports: {} };
  const sandbox = {
    module: moduleRecord,
    exports: moduleRecord.exports,
    console,
    Math: seededMath,
    Date,
    Set,
    Map,
    setTimeout,
    clearTimeout,
    require(request) {
      if (request === "react") {
        return {
          useCallback: (callback) => callback,
          useEffect: () => undefined,
          useMemo: (factory) => factory(),
          useRef: (value) => ({ current: value }),
          useState: (value) => [typeof value === "function" ? value() : value, () => undefined],
        };
      }
      if (request === "@/engine/difficulty") {
        return {
          manhattanDistance: (a, b) =>
            Math.abs(a.row - b.row) + Math.abs(a.col - b.col),
          getPredatorNextPosition: (guardian) => guardian,
        };
      }
      if (request === "@/engine/scoring") {
        return { calculateEscapeMazeScore: () => 0 };
      }
      if (request === "@/lib/game-sounds") {
        return {
          playGentleErrorTone: () => undefined,
          playSuccessChime: () => undefined,
        };
      }
      throw new Error(`Unexpected validation import: ${request}`);
    },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  new vm.Script(output, { filename: SOURCE_PATH }).runInContext(sandbox);

  return {
    api: moduleRecord.exports.__routeValidation,
    sandbox,
    setSeed(seed) {
      currentRandom = createSeededRandom(seed);
    },
  };
}

function posKey(position) {
  return `${position.row},${position.col}`;
}

function isInBounds(position, rows, cols) {
  return (
    Number.isInteger(position.row) &&
    Number.isInteger(position.col) &&
    position.row >= 0 &&
    position.row < rows &&
    position.col >= 0 &&
    position.col < cols
  );
}

function neighbors(position, walls, rows, cols) {
  return [
    { row: position.row - 1, col: position.col },
    { row: position.row + 1, col: position.col },
    { row: position.row, col: position.col - 1 },
    { row: position.row, col: position.col + 1 },
  ].filter(
    (next) => isInBounds(next, rows, cols) && !walls.has(posKey(next)),
  );
}

function reachableDistances(start, walls, rows, cols) {
  const distances = new Map([[posKey(start), 0]]);
  const queue = [start];
  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    const distance = distances.get(posKey(current));
    for (const next of neighbors(current, walls, rows, cols)) {
      const key = posKey(next);
      if (distances.has(key)) continue;
      distances.set(key, distance + 1);
      queue.push(next);
    }
  }
  return distances;
}

function solveObjective(map, rows, cols) {
  const lightIndexes = new Map(
    map.collectibleStars.map((position, index) => [posKey(position), index]),
  );
  const fullMask = (1 << map.collectibleStars.length) - 1;
  const startLight = lightIndexes.get(posKey(map.playerStart));
  const startMask = startLight === undefined ? 0 : 1 << startLight;
  const startState = {
    position: map.playerStart,
    mask: startMask,
    distance: 0,
  };
  const queue = [startState];
  const visited = new Set([`${posKey(map.playerStart)}|${startMask}`]);
  const parents = new Map();
  let finalKey = null;

  for (let index = 0; index < queue.length; index += 1) {
    const current = queue[index];
    const currentKey = `${posKey(current.position)}|${current.mask}`;
    if (
      current.mask === fullMask &&
      posKey(current.position) === posKey(map.exitPosition)
    ) {
      finalKey = currentKey;
      break;
    }

    for (const next of neighbors(current.position, map.walls, rows, cols)) {
      const lightIndex = lightIndexes.get(posKey(next));
      const nextMask =
        lightIndex === undefined ? current.mask : current.mask | (1 << lightIndex);
      const nextKey = `${posKey(next)}|${nextMask}`;
      if (visited.has(nextKey)) continue;
      visited.add(nextKey);
      parents.set(nextKey, currentKey);
      queue.push({ position: next, mask: nextMask, distance: current.distance + 1 });
    }
  }

  if (finalKey === null) return null;

  const reversedPath = [];
  let cursor = finalKey;
  while (cursor) {
    const [cell] = cursor.split("|");
    const [row, col] = cell.split(",").map(Number);
    reversedPath.push({ row, col });
    cursor = parents.get(cursor) ?? null;
  }
  const path = reversedPath.reverse();
  let maxDecisionGap = 0;
  let currentGap = 0;
  for (const position of path) {
    if (neighbors(position, map.walls, rows, cols).length >= 3) {
      maxDecisionGap = Math.max(maxDecisionGap, currentGap);
      currentGap = 0;
    } else {
      currentGap += 1;
    }
  }
  maxDecisionGap = Math.max(maxDecisionGap, currentGap);

  return {
    moves: path.length - 1,
    maxDecisionGap,
    path,
  };
}

function duplicateKeys(positions) {
  const seen = new Set();
  return positions
    .map(posKey)
    .filter((key) => (seen.has(key) ? true : (seen.add(key), false)));
}

function validateMap(api, map, difficulty, stage) {
  const errors = [];
  const rows = api.ROWS;
  const cols = api.COLS;
  if (map.grid.length !== rows) {
    errors.push(`grid has ${map.grid.length} rows, expected ${rows}`);
  }
  map.grid.forEach((row, index) => {
    if (row.length !== cols) {
      errors.push(`grid row ${index} has ${row.length} columns, expected ${cols}`);
    }
  });

  const entities = [
    ["player", map.playerStart],
    ["guardian", map.guardianStart],
    ["portal", map.exitPosition],
    ...map.collectibleStars.map((position, index) => [`light-${index}`, position]),
    ...map.traps.map((position, index) => [`trap-${index}`, position]),
    ...(map.shield ? [["shield", map.shield]] : []),
  ];
  for (const [label, position] of entities) {
    if (!isInBounds(position, rows, cols)) {
      errors.push(`${label} is out of bounds at ${posKey(position)}`);
    }
    if (map.walls.has(posKey(position))) {
      errors.push(`${label} overlaps a wall at ${posKey(position)}`);
    }
  }

  for (const wallKey of map.walls) {
    const [row, col] = wallKey.split(",").map(Number);
    if (!isInBounds({ row, col }, rows, cols)) {
      errors.push(`wall is out of bounds at ${wallKey}`);
    }
  }
  map.grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      const key = `${rowIndex},${colIndex}`;
      if ((cell === 1) !== map.walls.has(key)) {
        errors.push(`grid/wall set mismatch at ${key}`);
      }
    });
  });

  const primaryKeys = [
    posKey(map.playerStart),
    posKey(map.guardianStart),
    posKey(map.exitPosition),
  ];
  if (new Set(primaryKeys).size !== primaryKeys.length) {
    errors.push("player, guardian and portal must occupy different cells");
  }
  if (posKey(map.playerStart) === posKey(map.exitPosition)) {
    errors.push("portal overlaps the player start");
  }

  const lightDuplicates = duplicateKeys(map.collectibleStars);
  const trapDuplicates = duplicateKeys(map.traps);
  if (lightDuplicates.length > 0) errors.push(`duplicate lights: ${lightDuplicates}`);
  if (trapDuplicates.length > 0) errors.push(`duplicate traps: ${trapDuplicates}`);

  const occupied = new Map(primaryKeys.map((key, index) => [key, ["player", "guardian", "portal"][index]]));
  for (const [label, positions] of [
    ["light", map.collectibleStars],
    ["trap", map.traps],
    ["shield", map.shield ? [map.shield] : []],
  ]) {
    for (const position of positions) {
      const key = posKey(position);
      if (occupied.has(key)) {
        errors.push(`${label} overlaps ${occupied.get(key)} at ${key}`);
      } else {
        occupied.set(key, label);
      }
    }
  }

  const distances = reachableDistances(map.playerStart, map.walls, rows, cols);
  const directPortalDistance = distances.get(posKey(map.exitPosition));
  const objectiveSolution = solveObjective(map, rows, cols);
  const junctions = [...distances.keys()].filter((key) => {
    const [row, col] = key.split(",").map(Number);
    return neighbors({ row, col }, map.walls, rows, cols).length >= 3;
  }).length;
  const guardianDistance =
    Math.abs(map.playerStart.row - map.guardianStart.row) +
    Math.abs(map.playerStart.col - map.guardianStart.col);
  const wallCount = map.grid.flat().filter((cell) => cell === 1).length;
  const firstChoices = neighbors(map.playerStart, map.walls, rows, cols).length;
  const profile = api.ROUTE_STAGE_QUALITY[stage];
  const limits = api.getWallLimits(difficulty, stage);
  const startZoneWallCount = api.START_SAFE_CELLS.filter((position) =>
    map.walls.has(posKey(position)),
  ).length;

  if (directPortalDistance === undefined) errors.push("portal is unreachable");
  if (objectiveSolution === null) errors.push("full light-to-portal objective is unsolvable");
  if (
    directPortalDistance !== undefined &&
    directPortalDistance < api.getMinimumPathLength(stage)
  ) {
    errors.push(
      `portal path ${directPortalDistance} is shorter than stage minimum ${api.getMinimumPathLength(stage)}`,
    );
  }
  if (guardianDistance < profile.guardianMinStartDistance) {
    errors.push(
      `guardian distance ${guardianDistance} is below ${profile.guardianMinStartDistance}`,
    );
  }
  if (firstChoices < 2) errors.push(`player has only ${firstChoices} initial choices`);
  if (wallCount < limits.min || wallCount > limits.max) {
    errors.push(`wall count ${wallCount} is outside ${limits.min}-${limits.max}`);
  }
  if (distances.size < profile.minReachableCells) {
    errors.push(
      `reachable area ${distances.size} is below ${profile.minReachableCells}`,
    );
  }
  if (junctions < profile.minJunctions) {
    errors.push(`junction count ${junctions} is below ${profile.minJunctions}`);
  }
  if (startZoneWallCount > profile.maxStartZoneWalls) {
    errors.push(
      `start zone has ${startZoneWallCount} walls, maximum is ${profile.maxStartZoneWalls}`,
    );
  }
  if (map.collectibleStars.length !== api.getStarCount(difficulty, stage)) {
    errors.push(
      `light count ${map.collectibleStars.length} differs from ${api.getStarCount(difficulty, stage)}`,
    );
  }
  if (map.traps.length !== api.getTrapCount(difficulty, stage)) {
    errors.push(
      `trap count ${map.traps.length} differs from ${api.getTrapCount(difficulty, stage)}`,
    );
  }
  if (map.shield === null) errors.push("shield was not placed");
  if (neighbors(map.guardianStart, map.walls, rows, cols).length < 2) {
    errors.push("guardian starts with fewer than two exits");
  }
  if (!api.isValidMap(map, difficulty, stage)) {
    errors.push("production isValidMap rejected the returned map");
  }

  return {
    errors,
    metrics: {
      directPortalDistance: directPortalDistance ?? null,
      objectiveMoves: objectiveSolution?.moves ?? null,
      maxDecisionGap: objectiveSolution?.maxDecisionGap ?? null,
      reachableCells: distances.size,
      junctions,
      guardianDistance,
      wallCount,
      firstChoices,
      startZoneWallCount,
      lightCount: map.collectibleStars.length,
      trapCount: map.traps.length,
    },
  };
}

function canonicalMap(map) {
  return JSON.stringify({
    grid: map.grid,
    walls: [...map.walls].sort(),
    playerStart: map.playerStart,
    guardianStart: map.guardianStart,
    exitPosition: map.exitPosition,
    collectibleStars: map.collectibleStars,
    traps: map.traps,
    shield: map.shield,
  });
}

function summarize(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((total, value) => total + value, 0);
  return {
    min: sorted[0] ?? null,
    max: sorted.at(-1) ?? null,
    mean: sorted.length === 0 ? null : Number((sum / sorted.length).toFixed(2)),
    p95:
      sorted.length === 0
        ? null
        : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))],
  };
}

function summarizeRun(samples) {
  const fields = [
    "attempts",
    "directPortalDistance",
    "objectiveMoves",
    "maxDecisionGap",
    "reachableCells",
    "junctions",
    "guardianDistance",
    "wallCount",
  ];
  return Object.fromEntries(
    fields.map((field) => [
      field,
      summarize(samples.map((sample) => sample[field]).filter(Number.isFinite)),
    ]),
  );
}

function templateIdentity(template) {
  return template.map((row) => row.join("")).join("/");
}

function validateTemplates(api) {
  const errors = [];
  const assignments = {};
  const uniqueTemplates = new Map();

  for (const stage of STAGES) {
    const templates = api.ROUTE_STAGE_TEMPLATES[stage];
    assignments[stage] = templates.length;
    templates.forEach((template, templateIndex) => {
      const identity = templateIdentity(template);
      uniqueTemplates.set(identity, template);
      if (template.length !== api.ROWS) {
        errors.push(`stage ${stage} template ${templateIndex} has ${template.length} rows`);
      }
      template.forEach((row, rowIndex) => {
        if (row.length !== api.COLS) {
          errors.push(
            `stage ${stage} template ${templateIndex} row ${rowIndex} has ${row.length} columns`,
          );
        }
        if (row.some((cell) => cell !== 0 && cell !== 1)) {
          errors.push(`stage ${stage} template ${templateIndex} contains a non-binary cell`);
        }
      });
    });
  }

  return {
    errors,
    assignments,
    uniqueCount: uniqueTemplates.size,
  };
}

function run() {
  const seedsPerCombination = readNumberArgument("--seeds", 200);
  const templateSeeds = readNumberArgument("--template-seeds", 20);
  const reportPathArgument = readStringArgument("--write-report");
  const quiet = process.argv.includes("--quiet");
  const loaded = loadRouteGenerator();
  const { api, setSeed } = loaded;
  const startedAt = performance.now();
  const errors = [];
  const templateValidation = validateTemplates(api);
  errors.push(...templateValidation.errors);

  // The anchor that replaced the string anchor. Must run before anything else
  // trusts harnessGenerate to stand in for production.
  const fidelity = checkGenerationFidelity(api, setSeed);
  if (fidelity.mismatches.length > 0) {
    errors.push(
      `harnessGenerate diverged from generateMaze on ${fidelity.mismatches.length} of ` +
        `${fidelity.compared} seeds: ${JSON.stringify(fidelity.mismatches.slice(0, 4))}`,
    );
  }

  const summary = {};
  const forcedTemplateSummary = {};
  let generatedMaps = 0;
  let rejectedCandidates = 0;
  let fallbackMaps = 0;
  let forcedTemplateRuns = 0;
  const generationThrows = [];

  // Production throws rather than return an uncertified map, so a seed that
  // exhausts every gate is an observation this tool has to RECORD. Crashing on
  // it would hide the very thing the validator exists to measure.
  function generate(seed, difficulty, routeNumber, forcedTemplateIndex) {
    setSeed(seed);
    try {
      const settled = harnessGenerate(api, difficulty, routeNumber, forcedTemplateIndex);
      return { map: settled.map, metadata: settled };
    } catch (error) {
      generationThrows.push({
        seed,
        difficulty,
        stage: routeNumber,
        forcedTemplateIndex: forcedTemplateIndex ?? null,
        message: String(error && error.message ? error.message : error),
      });
      return null;
    }
  }

  for (const stage of STAGES) {
    summary[stage] = {};
    forcedTemplateSummary[stage] = {};
    for (let difficultyIndex = 0; difficultyIndex < DIFFICULTIES.length; difficultyIndex += 1) {
      const difficulty = DIFFICULTIES[difficultyIndex];
      const samples = [];
      const templateCoverage = new Map();

      for (let seedIndex = 0; seedIndex < seedsPerCombination; seedIndex += 1) {
        const seed = stage * 1_000_000 + difficultyIndex * 100_000 + seedIndex + 1;
        const settled = generate(seed, difficulty, stage, undefined);
        if (!settled) continue;
        const { map, metadata } = settled;
        const validation = validateMap(api, map, difficulty, stage);
        generatedMaps += 1;
        rejectedCandidates += metadata.attempts - 1;
        if (metadata.fallback) fallbackMaps += 1;
        templateCoverage.set(
          metadata.templateIndex,
          (templateCoverage.get(metadata.templateIndex) ?? 0) + 1,
        );
        samples.push({
          attempts: metadata.attempts,
          fallback: metadata.fallback,
          ...validation.metrics,
        });
        if (validation.errors.length > 0) {
          errors.push(
            `stage ${stage} ${difficulty} seed ${seed}: ${validation.errors.join("; ")}`,
          );
        }
      }

      const assignedTemplates = api.ROUTE_STAGE_TEMPLATES[stage];
      forcedTemplateSummary[stage][difficulty] = {};
      for (let templateIndex = 0; templateIndex < assignedTemplates.length; templateIndex += 1) {
        const forcedSamples = [];
        for (let seedIndex = 0; seedIndex < templateSeeds; seedIndex += 1) {
          const seed =
            50_000_000 +
            stage * 1_000_000 +
            difficultyIndex * 100_000 +
            templateIndex * 1_000 +
            seedIndex;
          const settledForced = generate(seed, difficulty, stage, templateIndex);
          if (!settledForced) continue;
          const { map, metadata } = settledForced;
          const validation = validateMap(api, map, difficulty, stage);
          forcedTemplateRuns += 1;
          generatedMaps += 1;
          rejectedCandidates += metadata.attempts - 1;
          if (metadata.fallback) {
            fallbackMaps += 1;
            errors.push(
              `stage ${stage} ${difficulty} forced template ${templateIndex} seed ${seed} reached fallback`,
            );
          }
          forcedSamples.push({
            attempts: metadata.attempts,
            fallback: metadata.fallback,
            ...validation.metrics,
          });
          if (validation.errors.length > 0) {
            errors.push(
              `stage ${stage} ${difficulty} forced template ${templateIndex} seed ${seed}: ${validation.errors.join("; ")}`,
            );
          }
        }
        forcedTemplateSummary[stage][difficulty][templateIndex] = {
          generated: forcedSamples.length,
          fallback: forcedSamples.filter((sample) => sample.fallback).length,
          metrics: summarizeRun(forcedSamples),
        };
      }

      for (const deterministicSeed of [11, 29, 47]) {
        const seed = stage * 10_000 + difficultyIndex * 1_000 + deterministicSeed;
        const first = generate(seed, difficulty, stage, undefined).map;
        const second = generate(seed, difficulty, stage, undefined).map;
        if (canonicalMap(first) !== canonicalMap(second)) {
          errors.push(`stage ${stage} ${difficulty} seed ${seed} is not deterministic`);
        }
      }

      summary[stage][difficulty] = {
        generated: samples.length,
        fallback: samples.filter((sample) => sample.fallback).length,
        templateCoverage: Object.fromEntries(
          [...templateCoverage.entries()].sort(([a], [b]) => a - b),
        ),
        metrics: summarizeRun(samples),
      };
    }
  }

  const report = {
    mission: "ROTA-9X9-VALIDATION-01",
    generatedAt: new Date().toISOString(),
    source: path.relative(ROOT, SOURCE_PATH).replaceAll("\\", "/"),
    configuration: {
      rows: api.ROWS,
      cols: api.COLS,
      seedsPerCombination,
      templateSeeds,
      difficulties: DIFFICULTIES,
      stages: STAGES,
    },
    templates: templateValidation,
    generationFidelity: fidelity,
    totals: {
      generatedMaps,
      forcedTemplateRuns,
      rejectedCandidates,
      fallbackMaps,
      generationThrows: generationThrows.length,
      validationErrors: errors.length,
      elapsedMs: Number((performance.now() - startedAt).toFixed(2)),
    },
    summary,
    forcedTemplateSummary,
    generationThrows: generationThrows.slice(0, 40),
    errors: errors.slice(0, 100),
  };

  if (reportPathArgument) {
    const reportPath = path.resolve(ROOT, reportPathArgument);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  if (quiet) {
    console.log(
      `Validated ${generatedMaps} maps; ${rejectedCandidates} rejected candidates; ${fallbackMaps} fallbacks; ${generationThrows.length} generation throws; ${errors.length} errors; ${report.totals.elapsedMs} ms.`,
    );
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
  if (errors.length > 0) process.exitCode = 1;
}

run();
