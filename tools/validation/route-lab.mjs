/**
 * ROTA-MAPS-DIFFICULTY-01 — shared measurement lab for the Route.
 *
 * Loads the real generator (`useEscapeMaze.ts`) and the real predator engine
 * (`engine/difficulty.ts`) into a sandbox with a seeded RNG, so every number
 * below comes from the code that actually ships — not from a re-implementation.
 *
 * What it measures, and why each one is here:
 *
 *  - objective length: start -> every light -> portal, optimal light order.
 *    This is the real task, not the start->exit shortest path.
 *  - decisions / forced streak: walked along that optimal route. A step is
 *    "forced" when the only non-backtracking option is one cell. A long forced
 *    streak is the map playing itself.
 *  - disjoint routes: vertex connectivity between start and exit, by max-flow on
 *    a split-node graph. 1 means a single corridor with a choke point; >= 2
 *    means genuinely independent alternatives exist.
 *  - dead ends: degree-1 cells, split into USEFUL (holds a light, the chest or
 *    a trap, or is adjacent to the objective route) and IDLE (holds nothing and
 *    sits away from the route). Only idle ones are a defect.
 *  - guardian pressure: the real predator simulated against an optimal player.
 *  - trap value: how much the guardian's route lengthens if that cell becomes
 *    impassable — the future mechanic, measured today.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

export const ROOT = process.cwd();
const HOOK_PATH = path.join(ROOT, "src/games/escape-maze/useEscapeMaze.ts");
const DIFFICULTY_PATH = path.join(ROOT, "src/engine/difficulty.ts");

export const DIFFICULTIES = ["easy", "medium", "hard"];
export const ROUTES = [1, 2, 3];
export const DIFFICULTY_LABEL = { easy: "Aberto", medium: "Equilibrado", hard: "Desafiador" };

export const key = (p) => `${p.row},${p.col}`;
export const eq = (a, b) => a.row === b.row && a.col === b.col;
const DELTAS = [
  { row: -1, col: 0 },
  { row: 1, col: 0 },
  { row: 0, col: -1 },
  { row: 0, col: 1 },
];

export function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function transpile(file) {
  return ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      esModuleInterop: true,
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: file,
  }).outputText;
}

/** Append an export surface so the lab can reach module-private helpers. */
function exposeHookInternals(source) {
  // The generator no longer has an uncertified fallback path, so the only thing
  // worth instrumenting is how many attempts a certified map took. Recording it
  // at the top of the loop is stable against refactors of the success branch.
  const needle = "  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {";
  if (!source.includes(needle)) {
    throw new Error("Route generator shape changed; route-lab injection is stale.");
  }
  const instrumented = source.replace(
    needle,
    [
      needle,
      "    (globalThis as { __lastGeneration?: unknown }).__lastGeneration = {",
      "      attempts: attempt + 1, fallback: false, templateIndex: -1,",
      "    };",
    ].join("\n"),
  );
  return `${instrumented}
export const __lab = {
  ROWS, COLS, MAX_GENERATION_ATTEMPTS, PLAYER_START, START_SAFE_CELLS,
  ROUTE_STAGE_EXIT_CANDIDATES, ROUTE_STAGE_GUARDIAN_CANDIDATES,
  MAZE_TEMPLATES, STAGE_ONE_TEMPLATES, ROUTE_STAGE_TEMPLATES,
  ROUTE_STAGE_QUALITY, WALL_LIMITS, BASE_STAR_COUNT, BASE_TRAP_COUNT,
  generateMaze, getRouteStage, getMinimumPathLength, getRouteStageTemplates,
  getWallLimits, getStarCount, getStarMinSeparation, getTrapCount, isValidMap,
  chooseGuardianMove,
};
`;
}

export function loadLab() {
  const difficultyJs = transpile(DIFFICULTY_PATH);
  const hookJs = ts.transpileModule(
    exposeHookInternals(fs.readFileSync(HOOK_PATH, "utf8")),
    {
      compilerOptions: {
        esModuleInterop: true,
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
      fileName: HOOK_PATH,
    },
  ).outputText;

  let random = createSeededRandom(1);
  const seededMath = Object.create(Math);
  seededMath.random = () => random();

  // The predator engine is loaded for real, sharing the same seeded Math.
  const diffModule = { exports: {} };
  const diffSandbox = {
    module: diffModule, exports: diffModule.exports, console,
    Math: seededMath, Set, Map, require() { throw new Error("no deps expected"); },
  };
  diffSandbox.globalThis = diffSandbox;
  vm.createContext(diffSandbox);
  new vm.Script(difficultyJs, { filename: DIFFICULTY_PATH }).runInContext(diffSandbox);
  const difficultyApi = diffModule.exports;

  const hookModule = { exports: {} };
  const sandbox = {
    module: hookModule, exports: hookModule.exports, console,
    Math: seededMath, Date, Set, Map, setTimeout, clearTimeout, performance,
    require(request) {
      if (request === "react") {
        return {
          useCallback: (cb) => cb,
          useEffect: () => undefined,
          useMemo: (factory) => factory(),
          useRef: (value) => ({ current: value }),
          useState: (value) => [typeof value === "function" ? value() : value, () => undefined],
        };
      }
      if (request === "@/engine/difficulty") return difficultyApi;
      if (request === "@/engine/scoring") return { calculateEscapeMazeScore: () => 0 };
      if (request === "@/lib/game-sounds") {
        return { playGentleErrorTone: () => undefined, playSuccessChime: () => undefined };
      }
      throw new Error(`Unexpected import in route-lab: ${request}`);
    },
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  new vm.Script(hookJs, { filename: HOOK_PATH }).runInContext(sandbox);

  const api = hookModule.exports.__lab;
  return {
    api,
    difficultyApi,
    sandbox,
    setSeed(seed) { random = createSeededRandom(seed); },
    generate(difficulty, routeNumber, seed) {
      random = createSeededRandom(seed);
      sandbox.__lastGeneration = undefined;
      const map = api.generateMaze(difficulty, routeNumber);
      return { map, generation: sandbox.__lastGeneration ?? { attempts: -1, fallback: false, templateIndex: -1 } };
    },
  };
}

// ---------------------------------------------------------------- graph ------
export const neighbors = (p, walls, rows = 9, cols = 9) =>
  DELTAS.map((d) => ({ row: p.row + d.row, col: p.col + d.col })).filter(
    (n) => n.row >= 0 && n.col >= 0 && n.row < rows && n.col < cols && !walls.has(key(n)),
  );

export function bfs(start, walls, blocked = new Set()) {
  const dist = new Map([[key(start), 0]]);
  const queue = [start];
  for (let i = 0; i < queue.length; i += 1) {
    const cur = queue[i];
    const d = dist.get(key(cur));
    for (const n of neighbors(cur, walls)) {
      const k = key(n);
      if (dist.has(k) || blocked.has(k)) continue;
      dist.set(k, d + 1);
      queue.push(n);
    }
  }
  return dist;
}

export const pathLength = (a, b, walls, blocked) => bfs(a, walls, blocked).get(key(b)) ?? null;

/** Shortest path as a cell list, or null. */
export function shortestPath(a, b, walls) {
  const prev = new Map([[key(a), null]]);
  const queue = [a];
  for (let i = 0; i < queue.length; i += 1) {
    const cur = queue[i];
    if (eq(cur, b)) {
      const out = [];
      let k = key(cur);
      while (k) { out.unshift(k); k = prev.get(k); }
      return out.map((s) => { const [row, col] = s.split(",").map(Number); return { row, col }; });
    }
    for (const n of neighbors(cur, walls)) {
      if (prev.has(key(n))) continue;
      prev.set(key(n), key(cur));
      queue.push(n);
    }
  }
  return null;
}

/**
 * Vertex connectivity between start and exit: how many routes exist that share
 * no intermediate cell. 1 means every run funnels through one choke point.
 * Max-flow with unit node capacities (node splitting), BFS augmentation.
 */
export function disjointRoutes(start, exit, walls, rows = 9, cols = 9) {
  const inN = (k) => `i:${k}`;
  const outN = (k) => `o:${k}`;
  const cap = new Map();
  const adj = new Map();
  const addEdge = (u, v, c) => {
    if (!adj.has(u)) adj.set(u, []);
    if (!adj.has(v)) adj.set(v, []);
    adj.get(u).push(v);
    adj.get(v).push(u);
    cap.set(`${u}|${v}`, (cap.get(`${u}|${v}`) ?? 0) + c);
    cap.set(`${v}|${u}`, cap.get(`${v}|${u}`) ?? 0);
  };
  const INF = 99;
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const p = { row: r, col: c };
      const k = key(p);
      if (walls.has(k)) continue;
      const isTerminal = eq(p, start) || eq(p, exit);
      addEdge(inN(k), outN(k), isTerminal ? INF : 1);
      for (const n of neighbors(p, walls, rows, cols)) addEdge(outN(k), inN(key(n)), INF);
    }
  }
  const source = outN(key(start));
  const sink = inN(key(exit));
  if (!adj.has(source) || !adj.has(sink)) return 0;

  let flow = 0;
  for (;;) {
    const prev = new Map([[source, null]]);
    const queue = [source];
    let found = false;
    for (let i = 0; i < queue.length && !found; i += 1) {
      const u = queue[i];
      for (const v of adj.get(u) ?? []) {
        if (prev.has(v) || (cap.get(`${u}|${v}`) ?? 0) <= 0) continue;
        prev.set(v, u);
        if (v === sink) { found = true; break; }
        queue.push(v);
      }
    }
    if (!found) break;
    let v = sink;
    while (prev.get(v) != null) {
      const u = prev.get(v);
      cap.set(`${u}|${v}`, cap.get(`${u}|${v}`) - 1);
      cap.set(`${v}|${u}`, (cap.get(`${v}|${u}`) ?? 0) + 1);
      v = u;
    }
    flow += 1;
    if (flow > 8) break;
  }
  return flow;
}

/** Optimal order to collect every light and then reach the portal. */
export function objectiveRoute(map) {
  const { walls, playerStart, exitPosition, collectibleStars } = map;
  const nodes = [playerStart, ...collectibleStars, exitPosition];
  const n = nodes.length;
  const dist = Array.from({ length: n }, () => new Array(n).fill(Infinity));
  const paths = Array.from({ length: n }, () => new Array(n).fill(null));
  for (let i = 0; i < n; i += 1) {
    const d = bfs(nodes[i], walls);
    for (let j = 0; j < n; j += 1) {
      dist[i][j] = d.get(key(nodes[j])) ?? Infinity;
      if (i !== j && dist[i][j] < Infinity) paths[i][j] = shortestPath(nodes[i], nodes[j], walls);
    }
  }
  const lightIdx = collectibleStars.map((_, i) => i + 1);
  const exitIdx = n - 1;
  let best = null;
  const permute = (rest, order) => {
    if (!rest.length) {
      let total = 0;
      let cur = 0;
      for (const idx of order) { total += dist[cur][idx]; cur = idx; }
      total += dist[cur][exitIdx];
      if (!Number.isFinite(total)) return;
      if (!best || total < best.total) best = { total, order: [...order] };
      return;
    }
    for (let i = 0; i < rest.length; i += 1) {
      permute([...rest.slice(0, i), ...rest.slice(i + 1)], [...order, rest[i]]);
    }
  };
  permute(lightIdx, []);
  if (!best) return null;

  const cells = [];
  let cur = 0;
  for (const idx of [...best.order, exitIdx]) {
    const seg = paths[cur][idx];
    if (!seg) return null;
    cells.push(...(cells.length ? seg.slice(1) : seg));
    cur = idx;
  }
  const toLights = best.order.reduce((acc, idx, i) => {
    const from = i === 0 ? 0 : best.order[i - 1];
    return acc + dist[from][idx];
  }, 0);
  return {
    moves: best.total,
    movesToAllLights: toLights,
    movesLastLightToPortal: dist[best.order.length ? best.order[best.order.length - 1] : 0][exitIdx],
    cells,
    lightOrder: best.order.map((i) => collectibleStars[i - 1]),
  };
}

/** Degree map, dead ends, corridors. */
export function structure(map) {
  const { walls } = map;
  const open = [];
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      const p = { row: r, col: c };
      if (!walls.has(key(p))) open.push(p);
    }
  }
  const reach = bfs(map.playerStart, walls);
  const inReach = open.filter((p) => reach.has(key(p)));
  const deg = new Map(inReach.map((p) => [key(p), neighbors(p, walls).length]));
  const deadEnds = inReach.filter((p) => (deg.get(key(p)) ?? 0) <= 1);
  const junctions = inReach.filter((p) => (deg.get(key(p)) ?? 0) >= 3);

  // Longest chain of degree-2 cells: a corridor with no decision in it.
  let longestCorridor = 0;
  const seen = new Set();
  for (const p of inReach) {
    if ((deg.get(key(p)) ?? 0) !== 2 || seen.has(key(p))) continue;
    let len = 0;
    const stack = [p];
    while (stack.length) {
      const cur = stack.pop();
      if (seen.has(key(cur))) continue;
      seen.add(key(cur));
      len += 1;
      for (const n of neighbors(cur, walls)) {
        if ((deg.get(key(n)) ?? 0) === 2 && !seen.has(key(n))) stack.push(n);
      }
    }
    longestCorridor = Math.max(longestCorridor, len);
  }

  // Regions over the whole open set (not just the reachable component).
  const regionSeen = new Set();
  let largestRegion = 0;
  let regions = 0;
  for (const p of open) {
    if (regionSeen.has(key(p))) continue;
    regions += 1;
    let size = 0;
    const stack = [p];
    while (stack.length) {
      const cur = stack.pop();
      if (regionSeen.has(key(cur))) continue;
      regionSeen.add(key(cur));
      size += 1;
      for (const n of neighbors(cur, walls)) if (!regionSeen.has(key(n))) stack.push(n);
    }
    largestRegion = Math.max(largestRegion, size);
  }

  return {
    openCells: open.length,
    reachableCells: reach.size,
    deadEnds,
    junctions: junctions.length,
    longestCorridor,
    largestRegion,
    regions,
    degree: deg,
  };
}

/** Decisions and forced streaks along the optimal objective route. */
export function routeDecisions(map, route) {
  if (!route) return { decisions: 0, forcedSteps: 0, longestForcedStreak: 0, decisionRatio: 0 };
  const { walls } = map;
  let decisions = 0;
  let forced = 0;
  let streak = 0;
  let longest = 0;
  for (let i = 0; i < route.cells.length - 1; i += 1) {
    const cur = route.cells[i];
    const prev = i > 0 ? route.cells[i - 1] : null;
    const options = neighbors(cur, walls).filter((n) => !prev || !eq(n, prev));
    if (options.length >= 2) {
      decisions += 1;
      streak = 0;
    } else {
      forced += 1;
      streak += 1;
      longest = Math.max(longest, streak);
    }
  }
  const steps = Math.max(1, route.cells.length - 1);
  return {
    decisions,
    forcedSteps: forced,
    longestForcedStreak: longest,
    decisionRatio: +(decisions / steps).toFixed(3),
  };
}

/** Classify dead ends: a dead end with a reason is design, an empty one is noise. */
export function deadEndAudit(map, structureInfo, route) {
  const routeKeys = new Set((route?.cells ?? []).map(key));
  const payload = new Set([
    ...map.collectibleStars.map(key),
    ...map.traps.map(key),
    ...(map.chest ? [key(map.chest)] : []),
    key(map.exitPosition),
  ]);
  let useful = 0;
  const idle = [];
  for (const p of structureInfo.deadEnds) {
    if (eq(p, map.playerStart)) continue;
    const k = key(p);
    const adjacentToRoute = neighbors(p, map.walls).some((n) => routeKeys.has(key(n)));
    if (payload.has(k) || routeKeys.has(k) || adjacentToRoute) useful += 1;
    else idle.push(p);
  }
  return { usefulDeadEnds: useful, idleDeadEnds: idle.length, idleCells: idle };
}

/** Real predator simulated against a player walking the optimal route. */
export function guardianPressure(lab, map, difficulty, runs = 12, seed = 7) {
  const route = objectiveRoute(map);
  if (!route) return null;
  let captured = 0;
  let minDistanceSum = 0;
  let firstThreatSum = 0;
  let threatTurnsSum = 0;
  for (let run = 0; run < runs; run += 1) {
    lab.setSeed(seed + run * 7919);
    let guardian = { ...map.guardianStart };
    let minDist = 99;
    let firstThreat = route.cells.length;
    let threatTurns = 0;
    let caught = false;
    for (let step = 1; step < route.cells.length; step += 1) {
      const player = route.cells[step];
      if (eq(player, guardian)) { caught = true; break; }
      guardian = lab.api.chooseGuardianMove(guardian, player, map.exitPosition, map.walls, difficulty);
      if (eq(player, guardian)) { caught = true; break; }
      const d = pathLength(player, guardian, map.walls) ?? 99;
      if (d < minDist) minDist = d;
      if (d <= 2) { threatTurns += 1; firstThreat = Math.min(firstThreat, step); }
    }
    if (caught) { captured += 1; minDist = 0; firstThreat = Math.min(firstThreat, route.cells.length); }
    minDistanceSum += minDist;
    firstThreatSum += firstThreat;
    threatTurnsSum += threatTurns;
  }
  return {
    runs,
    captureRate: +(captured / runs).toFixed(3),
    avgMinDistance: +(minDistanceSum / runs).toFixed(2),
    avgFirstThreatStep: +(firstThreatSum / runs).toFixed(1),
    avgThreatTurns: +(threatTurnsSum / runs).toFixed(2),
  };
}

/**
 * Future value of each trap, measured today: how much the guardian's route to
 * the player lengthens if that single cell becomes impassable, plus whether an
 * alternative still exists (it must — a trap that seals the guardian off kills
 * the chase).
 */
export function trapAnalysis(map) {
  const base = pathLength(map.guardianStart, map.playerStart, map.walls) ?? Infinity;
  const guardianReach = bfs(map.guardianStart, map.walls);
  const totalReach = guardianReach.size;
  const perTrap = map.traps.map((trap) => {
    const blocked = new Set([key(trap)]);
    const withTrap = pathLength(map.guardianStart, map.playerStart, map.walls, blocked);
    const reach = bfs(map.guardianStart, map.walls, blocked);
    const detour = withTrap === null ? null : withTrap - base;
    const deg = neighbors(trap, map.walls).length;
    const isolates = withTrap === null;
    const reachLoss = totalReach - reach.size;
    // A cell only matters later if it is a real junction or bottleneck and the
    // guardian keeps a way around it.
    const score = isolates
      ? 0
      : Math.min(100, Math.round(
          (detour ?? 0) * 14 + (deg >= 3 ? 22 : deg === 2 ? 8 : 0) + Math.min(20, reachLoss * 2),
        ));
    return {
      cell: key(trap), degree: deg, guardianDetour: detour,
      isolatesGuardian: isolates, guardianReachLoss: reachLoss, score,
      onGuardianShortestPath: (shortestPath(map.guardianStart, map.playerStart, map.walls) ?? [])
        .some((c) => eq(c, trap)),
    };
  });

  // Plausible future combinations: every pair, checking nothing seals the board.
  const combos = [];
  for (let i = 0; i < map.traps.length; i += 1) {
    for (let j = i + 1; j < map.traps.length; j += 1) {
      const blocked = new Set([key(map.traps[i]), key(map.traps[j])]);
      const d = pathLength(map.guardianStart, map.playerStart, map.walls, blocked);
      combos.push({
        cells: [key(map.traps[i]), key(map.traps[j])],
        guardianPath: d,
        isolates: d === null,
        detour: d === null ? null : d - base,
      });
    }
  }
  const allBlocked = new Set(map.traps.map(key));
  const allAtOnce = pathLength(map.guardianStart, map.playerStart, map.walls, allBlocked);

  return {
    baseGuardianPath: base === Infinity ? null : base,
    traps: perTrap,
    pairs: combos,
    isolatingPairs: combos.filter((c) => c.isolates).length,
    allTrapsIsolate: allAtOnce === null,
    meanScore: perTrap.length ? +(perTrap.reduce((a, t) => a + t.score, 0) / perTrap.length).toFixed(1) : 0,
    uselessTraps: perTrap.filter((t) => t.score < 15).length,
  };
}

/** Everything about one generated map, in one object. */
export function measure(lab, difficulty, routeNumber, seed) {
  const { map, generation } = lab.generate(difficulty, routeNumber, seed);
  const st = structure(map);
  const route = objectiveRoute(map);
  const dec = routeDecisions(map, route);
  const de = deadEndAudit(map, st, route);
  const routes = disjointRoutes(map.playerStart, map.exitPosition, map.walls);
  const pressure = guardianPressure(lab, map, difficulty);
  const traps = trapAnalysis(map);
  const walls = [...map.walls].sort().join("|");
  const chestDist = map.chest ? bfs(map.playerStart, map.walls).get(key(map.chest)) ?? null : null;

  return {
    difficulty, routeNumber, seed,
    templateIndex: generation.templateIndex,
    attempts: generation.attempts,
    fallback: generation.fallback,
    wallCount: map.grid.flat().filter((c) => c === 1).length,
    lights: map.collectibleStars.length,
    trapCount: map.traps.length,
    hasChest: Boolean(map.chest),
    chestDistance: chestDist,
    objectiveMoves: route?.moves ?? null,
    movesToAllLights: route?.movesToAllLights ?? null,
    movesLastLightToPortal: route?.movesLastLightToPortal ?? null,
    portalShortest: pathLength(map.playerStart, map.exitPosition, map.walls),
    reachableCells: st.reachableCells,
    largestRegion: st.largestRegion,
    regions: st.regions,
    junctions: st.junctions,
    deadEnds: st.deadEnds.length,
    usefulDeadEnds: de.usefulDeadEnds,
    idleDeadEnds: de.idleDeadEnds,
    longestCorridor: st.longestCorridor,
    disjointRoutes: routes,
    decisions: dec.decisions,
    decisionRatio: dec.decisionRatio,
    longestForcedStreak: dec.longestForcedStreak,
    guardianStartDistance: pathLength(map.guardianStart, map.playerStart, map.walls),
    pressure,
    trapMeanScore: traps.meanScore,
    trapUseless: traps.uselessTraps,
    trapIsolatingPairs: traps.isolatingPairs,
    trapAllIsolate: traps.allTrapsIsolate,
    wallSignature: walls,
    map,
    route,
    trapDetail: traps,
  };
}

export function stats(values) {
  const clean = values.filter((v) => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (!clean.length) return null;
  const at = (q) => clean[Math.min(clean.length - 1, Math.floor(q * clean.length))];
  return {
    min: clean[0],
    p10: at(0.1),
    median: at(0.5),
    p90: at(0.9),
    max: clean[clean.length - 1],
    mean: +(clean.reduce((a, b) => a + b, 0) / clean.length).toFixed(2),
  };
}
