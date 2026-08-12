/** Exact numeric successor enumerator; reference equivalence is tested separately. */
import { ACTIONS } from "./dynamic-solver.mjs";
import {
  canonicalToNumeric,
  preparePackedContext,
} from "./dynamic-solver-packed.mjs";

const CELL_COUNT = 81;
const UNREACHABLE = 255;
const MAX_COMMIT = 3;
const SENTINEL_THREAT_HORIZON = 6;
const SENTINEL_MAX_HOME_DISTANCE = 4;

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

function packFields(meta, e, h, s, t, c, lights, traps) {
  let key = e;
  key = key * CELL_COUNT + h;
  key = key * CELL_COUNT + s;
  key = key * meta.targetRadix + (t + 1);
  key = key * (MAX_COMMIT + 1) + c;
  key = key * meta.lightRadix + lights;
  return key * meta.trapRadix + traps;
}

function addUnique(target, value) {
  for (let index = 0; index < target.length; index += 1) {
    if (target[index] === value) return;
  }
  target.push(value);
}

function hunterSupport(meta, hunter, player, traps, output) {
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
  const illegal = (id) => id === meta.exitId || Boolean(meta.trapBitByCell[id] & traps);
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

function sentinelMove(meta, sentinel, targetIndex, commitLeft, player, traps) {
  let target = meta.exitId;
  const bestThreat = meta.threatDistance[player];
  const threatenedAccess = meta.threatTarget[player];
  if (threatenedAccess >= 0) target = meta.accessIds[threatenedAccess];
  let heldTarget = targetIndex;
  let nextCommit = commitLeft;
  if (nextCommit > 0 && heldTarget >= 0) {
    target = meta.accessIds[heldTarget];
    nextCommit -= 1;
  } else {
    heldTarget = threatenedAccess;
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
  if (
    traps !== 0 && heldTarget >= 0 &&
    variant.distances[sentinel * CELL_COUNT + target] === UNREACHABLE
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
    const rawScore = variant.distances[next * CELL_COUNT + target];
    const score = rawScore === UNREACHABLE ? 99 : rawScore;
    if (score < bestScore) {
      bestScore = score;
      best = next;
    }
  }
  if (optionCount === 0) return { s: sentinel, t: heldTarget, c: nextCommit };
  const rawStayScore = variant.distances[sentinel * CELL_COUNT + target];
  const stayScore = rawStayScore === UNREACHABLE ? 99 : rawStayScore;
  return { s: bestScore < stayScore ? best : sentinel, t: heldTarget, c: nextCommit };
}

/** Emit every exact successor without allocating a state object per edge. */
export function enumeratePackedSuccessors(
  ctx,
  canonicalOrNumericState,
  actionIndex,
  emit,
  { activateTraps = true, profile = null } = {},
) {
  const meta = preparePackedContext(ctx);
  const state = canonicalToNumeric(canonicalOrNumericState);
  const next = meta.moveTarget[state.e * ACTIONS.length + actionIndex];
  if (next < 0) return null;
  if (next === state.h || next === state.s) {
    return { hasWin: false, hasLoss: true, stateCount: 0 };
  }
  const lights = state.lights | meta.lightBitByCell[next];
  const traps = activateTraps ? state.traps | meta.trapBitByCell[next] : state.traps;
  if (next === meta.exitId && lights === meta.allLights) {
    return { hasWin: true, hasLoss: false, stateCount: 0 };
  }
  const hunterOutcomes = [];
  hunterSupport(meta, state.h, next, traps, hunterOutcomes);
  const seen = [];
  let hasLoss = false;
  for (const hunter of hunterOutcomes) {
    if (hunter === next) {
      hasLoss = true;
      continue;
    }
    const sentinel = sentinelMove(meta, state.s, state.t, state.c, next, traps);
    const settledSentinel = sentinel.s === hunter && sentinel.s !== state.s ? state.s : sentinel.s;
    if (settledSentinel === next) {
      hasLoss = true;
      continue;
    }
    const packStarted = profile ? performance.now() : 0;
    const key = packFields(
      meta, next, hunter, settledSentinel, sentinel.t, sentinel.c, lights, traps,
    );
    if (profile) profile.packingMs += performance.now() - packStarted;
    if (seen.includes(key)) continue;
    seen.push(key);
    emit(key, next, hunter, settledSentinel, sentinel.t, sentinel.c, lights, traps);
  }
  return { hasWin: false, hasLoss, stateCount: seen.length };
}

export function packedSuccessorSet(ctx, state, actionIndex, options) {
  const states = [];
  const result = enumeratePackedSuccessors(
    ctx, state, actionIndex, (key) => states.push(key), options,
  );
  if (!result) return null;
  return { ...result, states };
}
