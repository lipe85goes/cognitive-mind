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

function injectValidationSurface(source) {
  const templateNeedle =
    "    const template = randomItem(getRouteStageTemplates(routeStage));";
  const acceptedNeedle =
    "    if (isValidMap(map, difficulty, routeStage)) return map;";

  if (!source.includes(templateNeedle) || !source.includes(acceptedNeedle)) {
    throw new Error("Route generator shape changed; validation injection is stale.");
  }

  let instrumented = source.replace(
    templateNeedle,
    [
      "    const validationTemplates = getRouteStageTemplates(routeStage);",
      "    const forcedTemplateIndex = (globalThis as { __routeValidationForcedTemplateIndex?: number }).__routeValidationForcedTemplateIndex;",
      "    const template = forcedTemplateIndex === undefined",
      "      ? randomItem(validationTemplates)",
      "      : validationTemplates[Math.min(forcedTemplateIndex, validationTemplates.length - 1)];",
    ].join("\n"),
  );

  instrumented = instrumented.replace(
    acceptedNeedle,
    [
      "    if (isValidMap(map, difficulty, routeStage)) {",
      "      (globalThis as { __routeValidationLastGeneration?: unknown }).__routeValidationLastGeneration = {",
      "        attempts: attempt + 1,",
      "        fallback: false,",
      "        templateIndex: validationTemplates.indexOf(template),",
      "      };",
      "      return map;",
      "    }",
    ].join("\n"),
  );

  const fallbackPattern = /  return \{\r?\n    grid: fallbackGrid,/;
  if (!fallbackPattern.test(instrumented)) {
    throw new Error("Route fallback shape changed; validation injection is stale.");
  }
  instrumented = instrumented.replace(
    fallbackPattern,
    [
      "  (globalThis as { __routeValidationLastGeneration?: unknown }).__routeValidationLastGeneration = {",
      "    attempts: MAX_GENERATION_ATTEMPTS,",
      "    fallback: true,",
      "    templateIndex: 0,",
      "  };",
      "",
      "  return {",
      "    grid: fallbackGrid,",
    ].join("\n"),
  );

  return `${instrumented}\n\nexport const __routeValidation = {\n  ROWS,\n  COLS,\n  MAX_GENERATION_ATTEMPTS,\n  PLAYER_START,\n  START_SAFE_CELLS,\n  ROUTE_STAGE_EXIT_CANDIDATES,\n  ROUTE_STAGE_GUARDIAN_CANDIDATES,\n  MAZE_TEMPLATES,\n  STAGE_ONE_TEMPLATES,\n  ROUTE_STAGE_TEMPLATES,\n  ROUTE_STAGE_QUALITY,\n  WALL_LIMITS,\n  BASE_STAR_COUNT,\n  BASE_TRAP_COUNT,\n  generateMaze,\n  getMinimumPathLength,\n  getRouteStageTemplates,\n  getWallLimits,\n  getStarCount,\n  getTrapCount,\n  getReachableDistances,\n  countReachableJunctions,\n  findPathLength,\n  isValidMap,\n  chooseGuardianMove,\n  posKey,\n};\n`;
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
  const source = injectValidationSurface(fs.readFileSync(SOURCE_PATH, "utf8"));
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
  const { api, sandbox, setSeed } = loaded;
  const startedAt = performance.now();
  const errors = [];
  const templateValidation = validateTemplates(api);
  errors.push(...templateValidation.errors);

  const summary = {};
  const forcedTemplateSummary = {};
  let generatedMaps = 0;
  let rejectedCandidates = 0;
  let fallbackMaps = 0;
  let forcedTemplateRuns = 0;

  function generate(seed, difficulty, routeNumber, forcedTemplateIndex) {
    setSeed(seed);
    sandbox.__routeValidationForcedTemplateIndex = forcedTemplateIndex;
    sandbox.__routeValidationLastGeneration = null;
    const map = api.generateMaze(difficulty, routeNumber);
    const metadata = sandbox.__routeValidationLastGeneration;
    if (!metadata) throw new Error("Generator did not publish validation metadata.");
    return { map, metadata };
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
        const { map, metadata } = generate(seed, difficulty, stage, undefined);
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
          const { map, metadata } = generate(seed, difficulty, stage, templateIndex);
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
    totals: {
      generatedMaps,
      forcedTemplateRuns,
      rejectedCandidates,
      fallbackMaps,
      validationErrors: errors.length,
      elapsedMs: Number((performance.now() - startedAt).toFixed(2)),
    },
    summary,
    forcedTemplateSummary,
    errors: errors.slice(0, 100),
  };

  if (reportPathArgument) {
    const reportPath = path.resolve(ROOT, reportPathArgument);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  if (quiet) {
    console.log(
      `Validated ${generatedMaps} maps; ${rejectedCandidates} rejected candidates; ${fallbackMaps} fallbacks; ${errors.length} errors; ${report.totals.elapsedMs} ms.`,
    );
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
  if (errors.length > 0) process.exitCode = 1;
}

run();
