/**
 * ROTA2-SENTINEL-SOLVER-FIDELITY-03 — what the fidelity suite and its census share.
 *
 *   - `loadSolvers`      the two packed solvers (and the shared target-distance helper) of a tree — the working tree,
 *                        a commit, or either with in-memory edits (mutants) — imported from memory (`data:` URLs, their
 *                        relative imports bound to the working tree's other modules). Nothing is written to disk.
 *   - `oracleSuccessors` the PRODUCTION turn, composed from production pieces: the Explorer's step on the maze before
 *                        it, the trap arming and opening its linked wall, the reference Hunter support (the RNG support
 *                        model, `dynamic-solver.mjs`) on the maze after it, and for every Hunter outcome the REAL
 *                        `decideSentinelMove` with the REAL `computePortalDefenceZone` of that maze — exactly what
 *                        `runDefenderPhase` hands them. It answers in canonical form: held door as a CELL, not an index.
 *   - `decisionRecorder` a read-only line in production `decideSentinelMove` saying which branch it took (target,
 *                        whether that target is blocked in the graph, whether the target-root BFS reached the Sentinel,
 *                        whether the commitment was released). It classifies; it never decides a verdict.
 *   - `playFixtureGames` the REAL hook through the runtime harness, under scripted Explorer policies, every pre-Chest
 *                        turn recorded with the recorder's decisions and the RNG draws the turn made.
 *
 * ROTA2-ADAPTIVE-HUNTER-04: states carry `d`, the direction of the Explorer's last successful step (0 = none,
 * 1..4 = ACTIONS order + 1 — the hook's `lastExplorerDirection`). `oracleSuccessors` asks the PRODUCTION interception
 * policy (`planHunterInterception`, the module the hook runs, `octx.intercept`) exactly as `runDefenderPhase` does —
 * the maze after the step, the armed traps and the Sentinel's cell blocked — and takes its moves as the Hunter's
 * outcomes when it intercepts; otherwise the reference support, as before. Hunter before Sentinel, as before. `canon`
 * stays the seven fields this suite has always compared (the direction is the action's, so a successor is identified
 * by them); `canonD` adds `d`.
 *
 * Writes nothing.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

import { routeModuleDeclaring } from "./instrumented-generator.mjs";
import { normalizeSource } from "./route-module-loader.mjs";
import { cellKey, pathBetween, sameCell, walkableNeighbours } from "./route-runtime-harness.mjs";
import { ACTIONS, HUNTER_INTERCEPT_MODULE, hunterSupport as referenceHunterSupport } from "./dynamic-solver.mjs";
import { DIRECTION_CODES, directionCodeOf, directionCodeOfAction } from "./hunter-interception-support.mjs";

/** The mission's exact base: the reference solvers as they were before the correction. */
export const FIDELITY_BASE = "f5826b2e587d8381ac2e9d05be5c1b517b97dcdc";
export const HELPER_FILE = "sentinel-target-distance.mjs";
export const PACKED_FILE = "dynamic-solver-packed-successors.mjs";
export const ROTA2_FILE = "rota2-dynamic-solver.mjs";
/** ROTA2-ADAPTIVE-HUNTER-04: the adapter both packed solvers call the production interception policy through. */
export const INTERCEPT_ADAPTER_FILE = "hunter-interception-support.mjs";
/**
 * Load order matters: the helpers first, so the solvers that import them can be bound to their in-memory copies. The
 * adapter (ROTA2-ADAPTIVE-HUNTER-04) does not exist on a tree before it; the solvers of such a tree do not import it.
 */
export const SOLVER_FILES = [INTERCEPT_ADAPTER_FILE, HELPER_FILE, PACKED_FILE, ROTA2_FILE];

const TOOLS_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(TOOLS_DIR, "..", "..");
const CELL_COUNT = 81;

export const cellId = (p) => p.row * 9 + p.col;
export const cellOf = (id) => ({ row: Math.floor(id / 9), col: id % 9 });
export const keyOf = (id) => `${Math.floor(id / 9)},${id % 9}`;
export const idOfKey = (key) => {
  const [row, col] = key.split(",").map(Number);
  return row * 9 + col;
};
export const canon = (x) => `${x.e}|${x.h}|${x.s}|${x.target}|${x.c}|${x.lights}|${x.traps}`;
/** ROTA2-ADAPTIVE-HUNTER-04: the canonical state with the last direction. */
export const canonD = (x) => `${canon(x)}|${x.d ?? 0}`;
export const parseCanon = (text) => {
  const [e, h, s, target, c, lights, traps] = text.split("|").map(Number);
  return { e, h, s, target, c, lights, traps };
};

// =================================================================================================
// solver trees
// =================================================================================================

/** A tooling module's text at `rev` (null: the working tree), or null when it does not exist there. */
export function readToolSource(rev, file) {
  if (rev === null) {
    const full = path.join(TOOLS_DIR, file);
    return fs.existsSync(full) ? normalizeSource(fs.readFileSync(full, "utf8")) : null;
  }
  try {
    return normalizeSource(execFileSync("git", ["show", `${rev}:tools/validation/${file}`], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }));
  } catch {
    return null;
  }
}

/**
 * The solvers of one tree. `edits` maps a solver file to `(source) => source`, applied to that tree's text (a mutant);
 * an edit that cannot find its anchor throws, so a mutant can never be silently inert at load time. The modules are
 * imported from `data:` URLs: the three solver files bind to each other's in-memory copies, everything else they
 * import (`dynamic-solver.mjs`, the packed context, the graph store) to the working tree's — the parts this mission
 * does not touch.
 */
export async function loadSolvers({ rev = null, edits = {} } = {}) {
  const sources = {};
  for (const file of SOLVER_FILES) {
    let text = readToolSource(rev, file);
    if (text !== null && edits[file]) text = edits[file](text);
    else if (text === null && edits[file]) throw new Error(`solver tree: ${file} does not exist at ${rev ?? "the working tree"}`);
    sources[file] = text;
  }
  if (sources[PACKED_FILE] === null || sources[ROTA2_FILE] === null) {
    throw new Error(`solver tree: ${rev ?? "the working tree"} lacks ${PACKED_FILE} or ${ROTA2_FILE}`);
  }
  const urls = {};
  const bind = (text) =>
    text.replace(/from "\.\/([^"]+)"/g, (_, file) => {
      if (SOLVER_FILES.includes(file)) {
        if (!urls[file]) throw new Error(`solver tree: ${file} is imported but absent`);
        return `from "${urls[file]}"`;
      }
      return `from "${pathToFileURL(path.join(TOOLS_DIR, file)).href}"`;
    });
  for (const file of SOLVER_FILES) {
    if (sources[file] === null) continue;
    urls[file] = `data:text/javascript;base64,${Buffer.from(bind(sources[file])).toString("base64")}`;
  }
  return {
    rev,
    sources,
    helper: urls[HELPER_FILE] ? await import(urls[HELPER_FILE]) : null,
    packed: await import(urls[PACKED_FILE]),
    rota2: await import(urls[ROTA2_FILE]),
  };
}

/** The body of `sentinelMove` in a solver source — for the structural read of S09. */
export function sentinelMoveBody(source) {
  const start = source.indexOf("function sentinelMove(");
  if (start < 0) return null;
  const open = source.indexOf("{", source.indexOf(")", start));
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    else if (source[index] === "}" && (depth -= 1) === 0) return source.slice(open, index + 1);
  }
  return null;
}

// =================================================================================================
// solver answers in canonical form
// =================================================================================================

/**
 * A solver key's fields. ROTA2-ADAPTIVE-HUNTER-04 appended the last direction (radix 5) as the least significant
 * component; a solver tree from before it (a counterfactual) has no such component — `withDirection` says which.
 */
const decodeMixed = (meta, key, withDirection = true) => {
  let x = key;
  let d = 0;
  if (withDirection) {
    d = x % DIRECTION_CODES.length;
    x = (x - d) / DIRECTION_CODES.length;
  }
  const traps = x % meta.trapRadix;
  x = (x - traps) / meta.trapRadix;
  const lights = x % meta.lightRadix;
  x = (x - lights) / meta.lightRadix;
  const c = x % 4;
  x = (x - c) / 4;
  const t = (x % meta.targetRadix) - 1;
  x = (x - (t + 1)) / meta.targetRadix;
  const s = x % CELL_COUNT;
  x = (x - s) / CELL_COUNT;
  const h = x % CELL_COUNT;
  return { e: (x - h) / CELL_COUNT, h, s, t, c, lights, traps, d };
};
const keysCarryDirection = (module) => module.PACKED_KEY_HAS_DIRECTION === true;

/** Canonical state → the Rota 2.0 solver's numeric state (held door as an index into the union of doors). */
export function rota2Numeric(dctx, state) {
  const t = state.target < 0 ? -1 : [...dctx.unionAccessIds].indexOf(state.target);
  if (state.target >= 0 && t < 0) throw new Error(`door ${keyOf(state.target)} is not in the map's union of doors`);
  return { e: state.e, h: state.h, s: state.s, t, c: state.c, lights: state.lights, traps: state.traps, d: state.d ?? 0 };
}

/** The Rota 2.0 solver's answer for (state, action), canonical. Null when the step is illegal. */
export function rota2Answer(solvers, dctx, state, actionIndex) {
  const result = solvers.rota2.dynamicSuccessorSet(dctx, rota2Numeric(dctx, state), actionIndex);
  if (!result) return null;
  const meta = dctx.closed.packed;
  const decoded = result.states.map((key) => {
    const x = decodeMixed(meta, key, keysCarryDirection(solvers.rota2));
    return { ...x, target: x.t < 0 ? -1 : dctx.unionAccessIds[x.t] };
  });
  const states = decoded.map(canon);
  return {
    hasWin: result.hasWin,
    hasLoss: result.hasLoss,
    states: [...new Set(states)].sort(),
    statesD: [...new Set(decoded.map(canonD))].sort(),
    keys: result.states,
  };
}

/** The static (v1-topology) packed solver's answer, canonical. Null when the step is illegal or the door is unknown. */
export function packedAnswer(solvers, ctx, state, actionIndex) {
  const meta = ctx.packed ?? null;
  const accessIds = meta ? [...meta.accessIds] : ctx.zone.accesses.map(cellId);
  const t = state.target < 0 ? -1 : accessIds.indexOf(state.target);
  if (state.target >= 0 && t < 0) return null;
  const result = solvers.packed.packedSuccessorSet(ctx, { e: state.e, h: state.h, s: state.s, t, c: state.c, lights: state.lights, traps: state.traps, d: state.d ?? 0 }, actionIndex);
  if (!result) return null;
  const packed = ctx.packed;
  const decoded = result.states.map((key) => {
    const x = decodeMixed(packed, key, keysCarryDirection(solvers.packed));
    return { ...x, target: x.t < 0 ? -1 : packed.accessIds[x.t] };
  });
  return {
    hasWin: result.hasWin,
    hasLoss: result.hasLoss,
    states: [...new Set(decoded.map(canon))].sort(),
    statesD: [...new Set(decoded.map(canonD))].sort(),
  };
}

export const sameAnswer = (a, b) =>
  a === null || b === null
    ? a === b
    : a.hasWin === b.hasWin && a.hasLoss === b.hasLoss && a.states.length === b.states.length && a.states.every((x, i) => x === b.states[i]);

// =================================================================================================
// the production turn, composed from production pieces
// =================================================================================================

/**
 * One map's production context: both topologies (certified walls; the linked wall open) and the Sentinel's region of
 * each, computed by production `computePortalDefenceZone` exactly as the hook recomputes it (`turnZone`).
 */
export function oracleContext(API, map, difficulty, { requirePassage = false, dynamic = true, routeNumber = 1, intercept = null } = {}) {
  const link = dynamic ? (map.trapLinks ?? [])[0] ?? null : null;
  const trapKeys = map.traps.map(cellKey);
  const openWalls = new Set(map.walls);
  if (link) openWalls.delete(link.mutation.wall);
  const walls = [map.walls, link ? openWalls : map.walls];
  return {
    API,
    map,
    difficulty,
    link,
    trapKeys,
    lightKeys: map.collectibleStars.map(cellKey),
    linkBit: link ? 1 << trapKeys.indexOf(link.trap) : 0,
    exitId: cellId(map.exitPosition),
    walls,
    zones: walls.map((w, k) => (k === 1 && !link ? null : API.computePortalDefenceZone(map.playerStart, map.exitPosition, w))),
    requirePassage: Boolean(requirePassage) && link !== null,
    // ROTA2-ADAPTIVE-HUNTER-04: the Route, and the production interception module of the graph the hook runs in
    // (`productionIntercept(RT)`); null asks nothing — a tree before the mission, or a Route-1-only question.
    routeNumber,
    intercept,
  };
}

/** The production interception module of a loaded runtime's graph — the very instance its hook calls — or null. */
export function productionIntercept(RT) {
  const graph = RT.LAB.graph;
  return graph.tree.exists(HUNTER_INTERCEPT_MODULE) ? graph.require(HUNTER_INTERCEPT_MODULE) : null;
}

/**
 * The production successors of a canonical state under `actionIndex`. `hunters` lists every Hunter outcome of the
 * support (a capture included); `perHunter` says what each led to; `decisions` is what the decision recorder saw
 * (one entry per Sentinel decision; empty when every Hunter outcome captured first).
 */
export function oracleSuccessors(octx, state, actionIndex, recorder = null) {
  const { API, map } = octx;
  const before = (state.traps & octx.linkBit) !== 0 ? 1 : 0;
  const row = Math.floor(state.e / 9) + ACTIONS[actionIndex].row;
  const col = (state.e % 9) + ACTIONS[actionIndex].col;
  if (row < 0 || col < 0 || row >= 9 || col >= 9) return null;
  const next = row * 9 + col;
  if (octx.walls[before].has(keyOf(next))) return null;
  if (next === state.h || next === state.s) return { hasWin: false, hasLoss: true, states: [], statesD: [], hunters: [], perHunter: [], decisions: [], next, intercepting: false, interception: null };
  const li = octx.lightKeys.indexOf(keyOf(next));
  const ti = octx.trapKeys.indexOf(keyOf(next));
  const lights = li >= 0 ? state.lights | (1 << li) : state.lights;
  const traps = ti >= 0 ? state.traps | (1 << ti) : state.traps;
  const portalReady = lights === (1 << octx.lightKeys.length) - 1 && (!octx.requirePassage || (traps & octx.linkBit) !== 0);
  if (next === octx.exitId && portalReady) return { hasWin: true, hasLoss: false, states: [], statesD: [], hunters: [], perHunter: [], decisions: [], next, intercepting: false, interception: null };
  const after = (traps & octx.linkBit) !== 0 ? 1 : 0;
  const turnWalls = octx.walls[after];
  const zone = octx.zones[after];
  const armed = new Set(octx.trapKeys.filter((_, i) => traps & (1 << i)));
  const nextCell = cellOf(next);
  const sentinelCell = cellOf(state.s);
  // ROTA2-ADAPTIVE-HUNTER-04: the Hunter answers first — by the production interception, asked as `runDefenderPhase`
  // asks it (this step's direction, the remembered one, the maze after the step, armed traps and the Sentinel's cell
  // blocked), when it intercepts: every move it may draw. Otherwise the reference support.
  const interception = octx.intercept
    ? octx.intercept.planHunterInterception({
      routeNumber: octx.routeNumber,
      difficulty: octx.difficulty,
      previousDirection: DIRECTION_CODES[state.d ?? 0],
      direction: DIRECTION_CODES[directionCodeOfAction(actionIndex)],
      hunter: cellOf(state.h),
      explorer: nextCell,
      exitPosition: map.exitPosition,
      walls: turnWalls,
      blocked: new Set([...armed, keyOf(state.s)]),
    })
    : null;
  const hunters = interception
    ? interception.moves.map(cellId)
    : referenceHunterSupport(cellOf(state.h), nextCell, map.exitPosition, turnWalls, octx.difficulty, armed, sentinelCell).map(cellId);
  const d = directionCodeOfAction(actionIndex);
  if (recorder) recorder.decisions.length = 0;
  const states = new Set();
  const statesD = new Set();
  const perHunter = [];
  let hasLoss = false;
  for (const hunter of hunters) {
    if (hunter === next) {
      hasLoss = true;
      perHunter.push({ hunter, outcome: "HUNTER_CAPTURE" });
      continue;
    }
    const decided = API.decideSentinelMove(
      { position: sentinelCell, target: state.target >= 0 ? cellOf(state.target) : null, commitLeft: state.c },
      nextCell, map.exitPosition, turnWalls, zone, 3, armed,
    );
    const moved = cellId(decided.position);
    const settled = moved === hunter && moved !== state.s ? state.s : moved;
    if (settled === next) {
      hasLoss = true;
      perHunter.push({ hunter, outcome: "SENTINEL_CAPTURE" });
      continue;
    }
    const successorState = { e: next, h: hunter, s: settled, target: decided.target ? cellId(decided.target) : -1, c: decided.commitLeft, lights, traps, d };
    const successor = canon(successorState);
    perHunter.push({ hunter, outcome: successor });
    states.add(successor);
    statesD.add(canonD(successorState));
  }
  return {
    hasWin: false,
    hasLoss,
    states: [...states].sort(),
    statesD: [...statesD].sort(),
    intercepting: interception !== null,
    interception,
    hunters: [...new Set(hunters)].sort((a, b) => a - b),
    perHunter,
    decisions: recorder ? recorder.decisions.map((d) => ({ ...d })) : [],
    next,
    traps,
    open: after === 1,
  };
}

// =================================================================================================
// the decision recorder (read-only lines in production decideSentinelMove)
// =================================================================================================

const once = (file, source, anchor, insert, where) => {
  if (source.split(anchor).length !== 2) throw new Error(`fidelity recorder: anchor not found exactly once in ${file}: ${JSON.stringify(anchor.slice(0, 60))}`);
  return source.replace(anchor, where === "after" ? anchor + insert : insert + anchor);
};
/**
 * Records, per decision: the target the release test is about to read, the held door, the commitment, whether the
 * target is blocked in the defenders' graph (an armed trap), whether the target-root BFS reached the Sentinel, how many
 * traps were armed, and — set inside the release branch itself — whether the commitment was released. Aimed at
 * whichever Rota module declares `decideSentinelMove` in the tree at `rev` (ROUTE-C0: never a file named by hand).
 */
export function decisionRecorder(rev = null) {
  const file = routeModuleDeclaring("decideSentinelMove", { rev });
  return {
    [file]: (source) => {
      let text = once(file, source, "  let toTarget = getReachableDistances(target, graph);\n",
        "  (globalThis as any).__fidelity?.decisions.push({ target: posKey(target), held: heldTarget ? posKey(heldTarget) : null, commitLeft, blocked: graph.has(posKey(target)), reached: toTarget.get(posKey(state.position)) !== undefined, armed: blockedForDefenders.size, released: false });\n",
        "after");
      text = once(file, text, "    target = home;\n    heldTarget = null;\n    commitLeft = 0;\n    toTarget = getReachableDistances(target, graph);\n",
        "    { const d = (globalThis as any).__fidelity?.decisions; if (d && d.length) d[d.length - 1].released = true; }\n",
        "before");
      return text;
    },
  };
}
export function attachRecorder(RT) {
  RT.LAB.sb.__fidelity = { decisions: [] };
  return RT.LAB.sb.__fidelity;
}

/**
 * The production decision class of one Sentinel decision.
 *   NO_TRAP          nothing armed: the graph is the walls
 *   BLOCKED_KEPT     the target is an armed trap and the target-root BFS still reaches the Sentinel — kept (the gap)
 *   BLOCKED_RELEASED the target is an armed trap and the BFS does not reach the Sentinel — released
 *   OPEN_RELEASED    the target is walkable, another armed trap cuts the Sentinel off — released
 *   OTHER_TRAP       traps armed elsewhere; the target walkable and reached
 */
export function decisionClass(decision) {
  if (!decision) return "NO_DECISION";
  if (decision.armed === 0) return "NO_TRAP";
  if (decision.blocked) return decision.released ? "BLOCKED_RELEASED" : "BLOCKED_KEPT";
  return decision.released ? "OPEN_RELEASED" : "OTHER_TRAP";
}

// =================================================================================================
// the real hook, scripted
// =================================================================================================

/**
 * Counts the Rota's random draws. The harness seeds the sandbox's `Math.random` (route-module-loader.mjs), which is
 * what `routeRandom()` reads when nothing is armed; the counter wraps it without changing a single value.
 */
export function attachDrawCounter(RT) {
  const math = RT.LAB.sb.Math;
  const counter = { draws: 0 };
  if (!math.__fidelityCounted) {
    const draw = math.random;
    math.random = () => {
      counter.draws += 1;
      return draw();
    };
    math.__fidelityCounted = counter;
  }
  return math.__fidelityCounted;
}

/** The hook's state, in canonical form. */
export function canonicalOfGame(g) {
  let lights = 0;
  g.mazeMap.collectibleStars.forEach((s, i) => {
    if (g.collectedSet.has(cellKey(s))) lights |= 1 << i;
  });
  let traps = 0;
  g.mazeMap.traps.forEach((t, i) => {
    if (g.triggeredTrapSet.has(cellKey(t))) traps |= 1 << i;
  });
  return {
    e: cellId(g.player), h: cellId(g.guardian), s: cellId(g.sentinel),
    target: g.sentinelTarget ? cellId(g.sentinelTarget) : -1, c: g.sentinelCommitLeft, lights, traps,
    // ROTA2-ADAPTIVE-HUNTER-04: the hook's memory (a tree before the mission has none: 0).
    d: directionCodeOf(g.lastExplorerDirection),
  };
}

const lcgFrom = (seed) => {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32);
};

/**
 * Plays `specs` ({ seed, route, difficulty, policy }) on the real hook and returns every pre-Chest turn:
 * { spec, k, map, before, after (canonical), actionIndex, status, decisions, draws, requirePassage }.
 *
 *   portalRush  the DEPENDENT-OBJECTIVES-02 census measurement (D3): straight to the portal, around the pieces and
 *               the Chest — the walk that found the 25/2016 gap.
 *   trapTour    every trap in turn (arming them, the linked one opening its wall), then the lights, then the portal,
 *               with one step in seven a random legal one.
 *   doorTraps   the same, the traps that are doors of the Sentinel's region first.
 */
export function playFixtureGames(RT, recorder, specs) {
  const turns = [];
  const counter = attachDrawCounter(RT);
  for (const spec of specs) {
    const run = RT.mount({ seed: spec.seed, difficulty: spec.difficulty, routeNumber: spec.route });
    const map = run.state.mazeMap;
    const chest = map.chest ? cellKey(map.chest) : null;
    const rand = lcgFrom(spec.seed);
    const traps = map.traps.map(cellKey);
    const doors = new Set(RT.API.computePortalDefenceZone(map.playerStart, map.exitPosition, map.walls).accesses.map(cellKey));
    const tour = spec.policy === "doorTraps" ? [...traps.filter((t) => doors.has(t)), ...traps.filter((t) => !doors.has(t))] : traps;
    let k = 0;
    const step = (cell) => {
      const g = run.state;
      const before = canonicalOfGame(g);
      const actionIndex = ACTIONS.findIndex((a) => a.row === cell.row - g.player.row && a.col === cell.col - g.player.col);
      const preChest = !g.chestOpened && g.rewardSelected === null;
      recorder.decisions.length = 0;
      const drawsBefore = counter.draws;
      run.stepTo(cell);
      const a = run.state;
      const draws = counter.draws - drawsBefore;
      if (preChest && actionIndex >= 0 && !a.rewardChoicePending && !a.chestOpened && a.turns === g.turns + 1) {
        turns.push({
          spec, k: k++, map, before, after: canonicalOfGame(a), actionIndex, status: a.status,
          decisions: recorder.decisions.map((d) => ({ ...d })), draws,
          requirePassage: Boolean(a.objectives?.passage?.required), open: a.trapOpenedWalls.length > 0,
        });
      }
    };
    if (spec.policy === "portalRush") {
      for (let i = 0; i < 40 && run.state.status === "playing" && !run.state.chestOpened; i += 1) {
        const g = run.state;
        if (sameCell(g.player, map.exitPosition)) break;
        const blocked = new Set([...g.walls, cellKey(g.guardian), cellKey(g.sentinel), ...(chest ? [chest] : [])]);
        const route = pathBetween(g.player, map.exitPosition, blocked);
        if (!route || route.length < 2) break;
        step(route[1]);
      }
    } else {
      for (let i = 0; i < 160 && run.state.status === "playing" && !run.state.chestOpened && !run.state.rewardChoicePending; i += 1) {
        const g = run.state;
        const pending = tour.filter((t) => !g.triggeredTrapSet.has(t));
        const lightsLeft = map.collectibleStars.filter((s) => !g.collectedSet.has(cellKey(s)));
        const goal = pending.length ? cellOf(idOfKey(pending[0])) : lightsLeft.length ? lightsLeft[0] : map.exitPosition;
        if (rand() < 0.15) {
          const legal = walkableNeighbours(g.player, g.walls).filter((c) => cellKey(c) !== chest);
          if (legal.length) {
            step(legal[Math.floor(rand() * legal.length)]);
            continue;
          }
        }
        const blocked = new Set([...g.walls, cellKey(g.guardian), cellKey(g.sentinel), ...(chest ? [chest] : [])]);
        blocked.delete(cellKey(goal));
        const route = pathBetween(g.player, goal, blocked);
        if (!route || route.length < 2) break;
        step(route[1]);
      }
    }
    run.unmount();
  }
  return turns;
}
