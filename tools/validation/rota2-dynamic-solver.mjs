/**
 * ROTA2-DYNAMIC-TRAPS-01 — the exact pre-chest solver, on a maze that changes.
 *
 * `dynamic-solver-packed*.mjs` (ROTA-DYNAMIC-SOLVABILITY-01) enumerates the
 * exact support of every turn on ONE wall graph, fixed for the whole Route.
 * Rota 2.0 breaks that assumption: arming a dynamic trap opens its linked wall
 * for the rest of the Route. This module is that solver with the one change
 * the mechanic needs, and nothing else:
 *
 *   - the topology is a function of the state already in the key — the armed
 *     traps bitmask — so the state space does not grow: with the linked trap's
 *     bit clear the board is the certified walls, with it set the linked wall
 *     is open ("variant"). No new state component, no new branch of the RNG.
 *   - the turn reads the topology exactly where the hook does: the Explorer's
 *     step is legal on the maze BEFORE the step; the trap the step arms opens
 *     its wall; the Hunter and the Sentinel then answer on the maze AFTER it
 *     (useEscapeMaze.ts: step commits → TRAP_ARMED → WALL_OPENED_BY_TRAP →
 *     defender phase on `turnWalls`).
 *   - each variant gets the packed context's own tables (neighbours, BFS
 *     distances, the Sentinel's threat table, the trap-blocked variants), built
 *     by the reference `preparePackedContext` from a map whose walls are that
 *     variant's walls. `hunterSupport` and `sentinelMove` below are the
 *     reference's, statement for statement; only WHICH table they read moved.
 *     Both read the Sentinel's distance to its target through the one shared
 *     helper (`sentinel-target-distance.mjs`, ROTA2-SENTINEL-SOLVER-FIDELITY-03).
 *
 * Soundness is asserted, not assumed (rota2-dynamic-traps-census.mjs):
 *   - with the dynamic topology switched off, the successor sets are identical
 *     to the reference `enumeratePackedSuccessors` on every explored state;
 *   - with it on, every transition the REAL hook makes in played Routes is in
 *     the enumerated support.
 *
 * Model limits (the same as the reference, said again): PRE_CHEST — no Chest,
 * no Pickaxe, no Second Chance. The Sentinel's usable doors are recomputed per
 * topology, as the hook recomputes its zone: opening a wall can make a door
 * usable that was not (`accessesDiffer`). The held door is therefore indexed in
 * the union of both variants' doors and read back as a cell — the hook's
 * Sentinel holds its door as a position — so it means the same door on both.
 *
 * ROTA2-DEPENDENT-OBJECTIVES-02 — objectives are part of the win condition.
 * `requirePassage: true` (Routes 2 and 3) makes the portal wait for the marked
 * passage too: reaching the exit with every light is a win only once the
 * linked wall is open. In this PRE_CHEST model the only way the wall opens is
 * its trap, and the trap's bit is already in the key — so the objective adds no
 * state component: "passage open" IS `traps & linkBit`. Either order of the two
 * prerequisites is representable (the lights mask and the trap bit are set
 * independently). The Pickaxe opening the passage is outside this model (no
 * Chest), and is covered structurally (rota2-dependent-objectives-census.mjs)
 * and by the hook. `requirePassage: false` (Route 1, and the default) is the
 * DYNAMIC-TRAPS-01 rule, unchanged.
 *
 * ROTA2-ADAPTIVE-HUNTER-04 — the Hunter reads a repeated direction on Routes 2 and 3. The state carries `d`, the
 * direction of the Explorer's last successful step (the hook's `lastExplorerDirection`; 0 = none), and a step leaves
 * the direction of its action — a component of the key, the one thing the policy remembers. `routeNumber` (default 1)
 * says whether the Route adapts. On the maze AFTER the step (the one the defenders answer on) the Hunter's outcomes are
 * the PRODUCTION interception moves whenever the production policy intercepts (`planHunterInterception`, through
 * hunter-interception-support.mjs — the same call the static solver makes), and the reference support otherwise.
 *
 * Writes nothing.
 */
import { ACTIONS, API, buildContext } from "./dynamic-solver.mjs";
import {
  canonicalToNumeric,
  initialPackedState,
  preparePackedContext,
} from "./dynamic-solver-packed.mjs";
import { GrowableBuffer, PackedNodeStore } from "./dynamic-solver-packed-graph.mjs";
import { classifyPacked, solvePackedGraph } from "./dynamic-solver-packed-solve.mjs";
import { sentinelTargetDistance } from "./sentinel-target-distance.mjs";
import { DIRECTION_RADIX, directionCodeOfAction, interceptionMoves, useDirectionQuotient } from "./hunter-interception-support.mjs";

/** The packed key's layout carries the last direction (ROTA2-ADAPTIVE-HUNTER-04). */
export const PACKED_KEY_HAS_DIRECTION = true;

const CELL_COUNT = 81;
const UNREACHABLE = 255;
const MAX_COMMIT = 3;
const SENTINEL_THREAT_HORIZON = 6;
const SENTINEL_MAX_HOME_DISTANCE = 4;

const cellId = (key) => {
  const [row, col] = key.split(",").map(Number);
  return row * 9 + col;
};

// --- reference tables, verbatim from dynamic-solver-packed-successors.mjs ---

function buildDistances(neighbours, walls) {
  const distances = new Uint8Array(CELL_COUNT * CELL_COUNT);
  distances.fill(UNREACHABLE);
  const queue = new Uint8Array(CELL_COUNT);
  for (let start = 0; start < CELL_COUNT; start += 1) {
    if (walls[start]) continue;
    const rowOffset = start * CELL_COUNT;
    let head = 0;
    let tail = 0;
    queue[tail++] = start;
    distances[rowOffset + start] = 0;
    while (head < tail) {
      const current = queue[head++];
      const nextDistance = distances[rowOffset + current] + 1;
      for (const next of neighbours[current]) {
        const index = rowOffset + next;
        if (distances[index] !== UNREACHABLE) continue;
        distances[index] = nextDistance;
        queue[tail++] = next;
      }
    }
  }
  return distances;
}

function trapVariant(meta, trapMask) {
  let variant = meta.trapVariants[trapMask];
  if (variant) return variant;
  const blocked = new Uint8Array(meta.walls);
  for (let index = 0; index < meta.trapIds.length; index += 1) {
    if (trapMask & (1 << index)) blocked[meta.trapIds[index]] = 1;
  }
  const neighbours = Array.from({ length: CELL_COUNT }, (_, id) => {
    if (blocked[id]) return new Uint8Array(0);
    return Uint8Array.from(meta.baseNeighbours[id].filter((next) => !blocked[next]));
  });
  variant = { neighbours, distances: buildDistances(neighbours, blocked) };
  meta.trapVariants[trapMask] = variant;
  return variant;
}

function packFields(meta, e, h, s, t, c, lights, traps, d) {
  let key = e;
  key = key * CELL_COUNT + h;
  key = key * CELL_COUNT + s;
  key = key * meta.targetRadix + (t + 1);
  key = key * (MAX_COMMIT + 1) + c;
  key = key * meta.lightRadix + lights;
  key = key * meta.trapRadix + traps;
  return key * DIRECTION_RADIX + d;
}

function addUnique(target, value) {
  for (let index = 0; index < target.length; index += 1) {
    if (target[index] === value) return;
  }
  target.push(value);
}

function hunterSupport(meta, hunter, player, traps, sentinel, output) {
  output.length = 0;
  const neighbours = meta.baseNeighbours[hunter];
  if (neighbours.length === 0) {
    output.push(hunter);
    return output;
  }
  const preferred = [];
  if (meta.difficulty === "easy" || meta.difficulty === "medium") {
    for (const next of neighbours) preferred.push(next);
  } else {
    const currentDistance = meta.manhattan[hunter * CELL_COUNT + player];
    let bestDistance = UNREACHABLE;
    for (const next of neighbours) {
      const distance = meta.manhattan[next * CELL_COUNT + player];
      if (distance < currentDistance && distance < bestDistance) bestDistance = distance;
    }
    if (bestDistance === UNREACHABLE) {
      for (const next of neighbours) preferred.push(next);
    } else {
      for (const next of neighbours) {
        if (meta.manhattan[next * CELL_COUNT + player] === bestDistance) preferred.push(next);
      }
    }
  }
  const illegal = (id) =>
    id === meta.exitId ||
    id === sentinel ||
    Boolean(meta.trapBitByCell[id] & traps);
  let anyIllegal = false;
  for (const next of preferred) {
    if (illegal(next)) anyIllegal = true;
    else addUnique(output, next);
  }
  if (!anyIllegal) return output;
  const alternatives = [];
  for (const next of neighbours) if (!illegal(next)) alternatives.push(next);
  if (alternatives.length === 0) {
    addUnique(output, hunter);
    return output;
  }
  if (meta.difficulty === "easy") {
    for (const next of alternatives) addUnique(output, next);
  }
  let bestDistance = UNREACHABLE;
  for (const next of alternatives) {
    bestDistance = Math.min(bestDistance, meta.manhattan[next * CELL_COUNT + player]);
  }
  for (const next of alternatives) {
    if (meta.manhattan[next * CELL_COUNT + player] === bestDistance) addUnique(output, next);
  }
  return output;
}

// The reference's `sentinelMove`, with one change: the held door is an index into the map's UNION of doors (both
// topologies), and becomes a cell before it is used — exactly as the hook's Sentinel holds its door as a position,
// so a door that only the opened maze has (or a door held across the opening) means the same cell either way.
function sentinelMove(meta, sentinel, targetIndex, commitLeft, player, traps) {
  let target = meta.exitId;
  const bestThreat = meta.threatDistance[player];
  const threatenedAccess = meta.threatTarget[player];
  const threatenedUnion = threatenedAccess >= 0 ? meta.toUnion[threatenedAccess] : -1;
  if (threatenedAccess >= 0) target = meta.accessIds[threatenedAccess];
  let heldTarget = targetIndex;
  let nextCommit = commitLeft;
  if (nextCommit > 0 && heldTarget >= 0) {
    target = meta.unionAccessIds[heldTarget];
    nextCommit -= 1;
  } else {
    heldTarget = threatenedUnion;
    nextCommit = MAX_COMMIT;
  }
  const variant = trapVariant(meta, traps);
  const rawDistanceHome = variant.distances[sentinel * CELL_COUNT + meta.exitId];
  const distanceHome = rawDistanceHome === UNREACHABLE ? 0 : rawDistanceHome;
  const outside = !meta.zoneMask[sentinel];
  if (bestThreat > SENTINEL_THREAT_HORIZON || (outside && distanceHome > SENTINEL_MAX_HOME_DISTANCE)) {
    target = meta.exitId;
    heldTarget = -1;
    nextCommit = 0;
  }
  // ROTA2-SENTINEL-SOLVER-FIDELITY-03: as in the reference, every distance to the target is the hook's
  // `getReachableDistances(target, graph)` (sentinel-target-distance.mjs), read on the topology after the step.
  if (
    traps !== 0 && heldTarget >= 0 &&
    sentinelTargetDistance(meta, variant, traps, sentinel, target) === UNREACHABLE
  ) {
    target = meta.exitId;
    heldTarget = -1;
    nextCommit = 0;
  }
  let best = sentinel;
  let bestScore = Number.POSITIVE_INFINITY;
  let optionCount = 0;
  for (const next of variant.neighbours[sentinel]) {
    if (next === meta.exitId) continue;
    const homeDistance = variant.distances[next * CELL_COUNT + meta.exitId];
    if (homeDistance === UNREACHABLE || homeDistance > SENTINEL_MAX_HOME_DISTANCE) continue;
    optionCount += 1;
    const rawScore = sentinelTargetDistance(meta, variant, traps, next, target);
    const score = rawScore === UNREACHABLE ? 99 : rawScore;
    if (score < bestScore) {
      bestScore = score;
      best = next;
    }
  }
  if (optionCount === 0) return { s: sentinel, t: heldTarget, c: nextCommit };
  const rawStayScore = sentinelTargetDistance(meta, variant, traps, sentinel, target);
  const stayScore = rawStayScore === UNREACHABLE ? 99 : rawStayScore;
  return { s: bestScore < stayScore ? best : sentinel, t: heldTarget, c: nextCommit };
}

// --- the dynamic context ------------------------------------------------------

const sameIds = (a, b) => a.length === b.length && a.every((value, index) => value === b[index]);

/**
 * Two packed contexts for one map — certified walls, and certified walls with
 * the linked wall open — and the bit of the linked trap. `dynamic: false`
 * (or a map without a link) gives the v1 model: both variants are the same.
 */
/** Both variants index the Sentinel's doors in one list: the closed maze's doors, then any only the open maze has. */
function unifyAccesses(closedMeta, openMeta) {
  const union = [...closedMeta.accessIds];
  for (const id of openMeta.accessIds) if (!union.includes(id)) union.push(id);
  const unionAccessIds = Uint8Array.from(union);
  for (const meta of new Set([closedMeta, openMeta])) {
    meta.unionAccessIds = unionAccessIds;
    meta.toUnion = Int8Array.from([...meta.accessIds].map((id) => union.indexOf(id)));
    meta.targetRadix = union.length + 1;
  }
  return unionAccessIds;
}

export function buildDynamicContext(map, difficulty, { dynamic = true, requirePassage = false, routeNumber = 1, intercept } = {}) {
  const closed = buildContext(map, difficulty);
  // ROTA2-ADAPTIVE-HUNTER-04: the Route (does the Hunter adapt?) and, for a suite, the production policy module to ask.
  closed.routeNumber = routeNumber;
  if (intercept !== undefined) closed.intercept = intercept;
  const link = dynamic ? (map.trapLinks ?? [])[0] ?? null : null;
  if (!link) {
    const meta = preparePackedContext(closed);
    const unionAccessIds = unifyAccesses(meta, meta);
    // No link, nothing to open: the passage objective is complete (route-objectives.ts reads it the same way).
    return { map, difficulty, routeNumber, closed, open: closed, linkBit: 0, link: null, accessesDiffer: false, unionAccessIds, requirePassage: false };
  }
  const openedWalls = new Set(map.walls);
  openedWalls.delete(link.mutation.wall);
  const open = buildContext({ ...map, walls: openedWalls }, difficulty);
  open.routeNumber = routeNumber;
  if (intercept !== undefined) open.intercept = intercept;
  const closedMeta = preparePackedContext(closed);
  const openMeta = preparePackedContext(open);
  const accessesDiffer = !sameIds([...closedMeta.accessIds], [...openMeta.accessIds]);
  const unionAccessIds = unifyAccesses(closedMeta, openMeta);
  const trapIndex = map.traps.map(API.posKey).indexOf(link.trap);
  return {
    map,
    difficulty,
    routeNumber,
    closed,
    open,
    linkBit: trapIndex < 0 ? 0 : 1 << trapIndex,
    link,
    // Reported, and modelled: the opened maze can give the Sentinel a usable door it did not have.
    accessesDiffer,
    unionAccessIds,
    zoneDiffers: !sameIds([...closedMeta.zoneMask], [...openMeta.zoneMask]),
    openedCell: cellId(link.mutation.wall),
    // ROTA2-DEPENDENT-OBJECTIVES-02: the portal also waits for the linked wall (= the linked trap's bit).
    requirePassage: Boolean(requirePassage) && trapIndex >= 0,
  };
}

/** The topology the state's armed traps imply. */
const metaFor = (dctx, traps) =>
  traps & dctx.linkBit ? dctx.open.packed : dctx.closed.packed;

/**
 * Every exact successor of `state` under `actionIndex`, on the maze the state
 * implies before the step and the maze the step leaves for the defenders.
 * Same contract as the reference `enumeratePackedSuccessors`.
 */
export function enumerateDynamicSuccessors(dctx, canonicalOrNumericState, actionIndex, emit) {
  const state = canonicalToNumeric(canonicalOrNumericState);
  const before = metaFor(dctx, state.traps);
  const next = before.moveTarget[state.e * ACTIONS.length + actionIndex];
  if (next < 0) return null;
  if (next === state.h || next === state.s) return { hasWin: false, hasLoss: true, stateCount: 0 };
  const lights = state.lights | before.lightBitByCell[next];
  const traps = state.traps | before.trapBitByCell[next];
  // ROTA2-DEPENDENT-OBJECTIVES-02: the portal is ready when its prerequisites are — every light, and on a
  // Route with the passage objective the linked wall open, which pre-Chest means its trap armed. An Explorer on
  // the exit before that simply stands there, as in the hook.
  const portalReady = lights === before.allLights && (!dctx.requirePassage || Boolean(traps & dctx.linkBit));
  if (next === before.exitId && portalReady) {
    return { hasWin: true, hasLoss: false, stateCount: 0 };
  }
  // The trap this step armed has already opened its wall: the defenders read
  // the maze after the step.
  const after = metaFor(dctx, traps);
  // ROTA2-ADAPTIVE-HUNTER-04: the step's direction becomes the memory; the Hunter answers first, on the maze after the
  // step — by the production interception when it intercepts (every move it may draw), by the reference support
  // otherwise.
  const direction = directionCodeOfAction(actionIndex);
  const intercepting = interceptionMoves(after, state.h, next, state.d, actionIndex, traps, state.s);
  const hunterOutcomes = intercepting ?? [];
  if (intercepting === null) hunterSupport(after, state.h, next, traps, state.s, hunterOutcomes);
  const seen = [];
  let hasLoss = false;
  for (const hunter of hunterOutcomes) {
    if (hunter === next) {
      hasLoss = true;
      continue;
    }
    const sentinel = sentinelMove(after, state.s, state.t, state.c, next, traps);
    const settledSentinel = sentinel.s === hunter && sentinel.s !== state.s ? state.s : sentinel.s;
    if (settledSentinel === next) {
      hasLoss = true;
      continue;
    }
    const key = packFields(after, next, hunter, settledSentinel, sentinel.t, sentinel.c, lights, traps, direction);
    if (seen.includes(key)) continue;
    seen.push(key);
    emit(key, next, hunter, settledSentinel, sentinel.t, sentinel.c, lights, traps, direction);
  }
  return { hasWin: false, hasLoss, stateCount: seen.length };
}

/** The successor keys as a set, for differential checks. */
export function dynamicSuccessorSet(dctx, state, actionIndex) {
  const states = [];
  const result = enumerateDynamicSuccessors(dctx, state, actionIndex, (key) => states.push(key));
  if (!result) return null;
  return { ...result, states };
}

export function packDynamicState(dctx, numeric) {
  return packFields(metaFor(dctx, numeric.traps), numeric.e, numeric.h, numeric.s, numeric.t, numeric.c, numeric.lights, numeric.traps, numeric.d ?? 0);
}

/**
 * Breadth-first exploration into the reference's graph layout, so the
 * reference attractors (`solvePackedGraph`) and classification apply as they
 * are. Limits as the reference's `maxStates` / `maxElapsedMs`.
 */
export function exploreDynamic(dctx, { maxStates = 3_000_000, maxElapsedMs = 60_000, directionQuotient = "auto" } = {}) {
  const started = performance.now();
  // ROTA2-ADAPTIVE-HUNTER-04: where this Route's Hunter cannot read the direction, states that differ only in it are
  // identified (exact; hunter-interception-support.mjs `useDirectionQuotient`). The key's direction digit is its least
  // significant, so the quotient key is `key - d`.
  const quotient = useDirectionQuotient(dctx.closed.packed, directionQuotient);
  const start = initialPackedState(dctx.closed);
  const startMeta = metaFor(dctx, start.traps);
  const startKey = packFields(startMeta, start.e, start.h, start.s, start.t, start.c, start.lights, start.traps, start.d);
  const nodes = new PackedNodeStore(65_536);
  nodes.add(startKey, start.e, start.h, start.s, start.t, start.c, start.lights, start.traps, -1, -1, 0, start.d);
  const actionSource = new GrowableBuffer(Uint32Array);
  const actionName = new GrowableBuffer(Uint8Array);
  const actionSuccessorOffset = new GrowableBuffer(Uint32Array);
  const actionSuccessorCount = new GrowableBuffer(Uint8Array);
  const actionFlags = new GrowableBuffer(Uint8Array);
  const successorIds = new GrowableBuffer(Uint32Array, 4096);
  let head = 0;
  let resourceLimit = null;
  let shortestWin = null;
  while (head < nodes.count) {
    if ((head & 255) === 0) {
      if (nodes.count > maxStates) resourceLimit = "STATE_LIMIT";
      else if (performance.now() - started > maxElapsedMs) resourceLimit = "TIME_LIMIT";
      if (resourceLimit) break;
    }
    const nodeId = head++;
    const state = nodes.numericState(nodeId);
    nodes.actionOffset[nodeId] = actionSource.length;
    for (let action = 0; action < ACTIONS.length; action += 1) {
      const successorOffset = successorIds.length;
      const result = enumerateDynamicSuccessors(dctx, state, action, (rawKey, e, h, s, t, c, lights, traps, rawD) => {
        const key = quotient ? rawKey - rawD : rawKey;
        const d = quotient ? 0 : rawD;
        let successorId = nodes.ids.get(key);
        if (successorId === undefined) {
          successorId = nodes.add(key, e, h, s, t, c, lights, traps, nodeId, action, nodes.depth[nodeId] + 1, d);
        }
        successorIds.push(successorId);
      });
      if (!result) continue;
      let flags = 0;
      if (result.hasWin) flags |= 1;
      if (result.hasLoss) flags |= 2;
      actionSource.push(nodeId);
      actionName.push(action);
      actionSuccessorOffset.push(successorOffset);
      actionSuccessorCount.push(result.stateCount);
      actionFlags.push(flags);
      if (result.hasWin && shortestWin === null) shortestWin = { nodeId, action };
    }
    nodes.actionCount[nodeId] = actionSource.length - nodes.actionOffset[nodeId];
  }
  return {
    kind: "PACKED_GRAPH",
    ctx: dctx.closed,
    nodes,
    startId: 0,
    startKey,
    processedNodes: head,
    actionSource,
    actionName,
    actionSuccessorOffset,
    actionSuccessorCount,
    actionFlags,
    successorIds,
    explored: nodes.count,
    truncated: head < nodes.count,
    resourceLimit,
    shortestWin,
    directionQuotient: quotient,
    elapsedMs: performance.now() - started,
  };
}

/**
 * Classify one map under one model. `dynamic: false` is the v1 model (the
 * link ignored: the trap only blocks the defenders). Labels are the
 * reference's PRE_CHEST labels; INCONCLUSIVE when a limit cut the search.
 */
export function classifyMap(map, difficulty, { dynamic = true, requirePassage = false, routeNumber = 1, intercept, maxStates, maxElapsedMs, directionQuotient } = {}) {
  const dctx = buildDynamicContext(map, difficulty, { dynamic, requirePassage, routeNumber, intercept });
  const graph = exploreDynamic(dctx, { maxStates, maxElapsedMs, directionQuotient });
  const solved = solvePackedGraph(graph);
  return {
    label: classifyPacked(graph, solved),
    explored: graph.explored,
    directionQuotient: graph.directionQuotient,
    elapsedMs: Math.round(graph.elapsedMs),
    // Is the linked trap's bit set anywhere the Explorer can still win from?
    graph,
    solved,
    dctx,
  };
}
