/**
 * Exact packed-state implementation for ROTA-DYNAMIC-SOLVABILITY-01.
 *
 * The string-based solver remains the executable reference model. This module
 * changes representation and algorithms, never the runtime support model.
 */
import {
  API,
  ACTIONS,
  encode as oldStringKey,
  initialState as initialCanonicalState,
} from "./dynamic-solver.mjs";

const BOARD_SIDE = 9;
const CELL_COUNT = BOARD_SIDE * BOARD_SIDE;
const UNREACHABLE = 255;
const MAX_COMMIT = 3;

const cellId = (position) => position.row * BOARD_SIDE + position.col;
const cellKey = (id) => `${Math.floor(id / BOARD_SIDE)},${id % BOARD_SIDE}`;
const cellPosition = (id) => ({ row: Math.floor(id / BOARD_SIDE), col: id % BOARD_SIDE });

function assertIntegerInRange(value, min, max, name) {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer in [${min}, ${max}], got ${value}`);
  }
}

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

/** Build static map-local tables once. No dynamic state is removed. */
export function preparePackedContext(ctx) {
  if (ctx.packed) return ctx.packed;
  const started = performance.now();
  const walls = new Uint8Array(CELL_COUNT);
  for (const key of ctx.map.walls) {
    const [row, col] = key.split(",").map(Number);
    walls[row * BOARD_SIDE + col] = 1;
  }
  const cells = Array.from({ length: CELL_COUNT }, (_, id) => cellPosition(id));
  const baseNeighbours = cells.map((position) => Uint8Array.from(
    API.getNeighbors(position, ctx.map.walls).map(cellId),
  ));
  const moveTarget = new Int16Array(CELL_COUNT * ACTIONS.length);
  moveTarget.fill(-1);
  for (let id = 0; id < CELL_COUNT; id += 1) {
    if (walls[id]) continue;
    const row = Math.floor(id / BOARD_SIDE);
    const col = id % BOARD_SIDE;
    for (let action = 0; action < ACTIONS.length; action += 1) {
      const nextRow = row + ACTIONS[action].row;
      const nextCol = col + ACTIONS[action].col;
      if (nextRow < 0 || nextCol < 0 || nextRow >= BOARD_SIDE || nextCol >= BOARD_SIDE) continue;
      const next = nextRow * BOARD_SIDE + nextCol;
      if (!walls[next]) moveTarget[id * ACTIONS.length + action] = next;
    }
  }
  const manhattan = new Uint8Array(CELL_COUNT * CELL_COUNT);
  for (let from = 0; from < CELL_COUNT; from += 1) {
    const fromRow = Math.floor(from / BOARD_SIDE);
    const fromCol = from % BOARD_SIDE;
    for (let to = 0; to < CELL_COUNT; to += 1) {
      manhattan[from * CELL_COUNT + to] =
        Math.abs(fromRow - Math.floor(to / BOARD_SIDE)) + Math.abs(fromCol - (to % BOARD_SIDE));
    }
  }
  const baseDistances = buildDistances(baseNeighbours, walls);
  const accessIds = Uint8Array.from(ctx.zone.accesses.map(cellId));
  const lightIds = Uint8Array.from(ctx.map.collectibleStars.map(cellId));
  const trapIds = Uint8Array.from(ctx.map.traps.map(cellId));
  if (lightIds.length > 6 || trapIds.length > 6) {
    throw new RangeError(`Runtime maximum is 6 lights/traps; got ${lightIds.length}/${trapIds.length}`);
  }
  const lightBitByCell = new Uint8Array(CELL_COUNT);
  const trapBitByCell = new Uint8Array(CELL_COUNT);
  for (let index = 0; index < lightIds.length; index += 1) lightBitByCell[lightIds[index]] = 1 << index;
  for (let index = 0; index < trapIds.length; index += 1) trapBitByCell[trapIds[index]] = 1 << index;
  const zoneMask = new Uint8Array(CELL_COUNT);
  for (const position of ctx.zone.zone) zoneMask[cellId(position)] = 1;
  const threatTarget = new Int8Array(CELL_COUNT);
  threatTarget.fill(-1);
  const threatDistance = new Uint8Array(CELL_COUNT);
  threatDistance.fill(UNREACHABLE);
  for (let player = 0; player < CELL_COUNT; player += 1) {
    let best = UNREACHABLE;
    let target = -1;
    for (let access = 0; access < accessIds.length; access += 1) {
      const distance = baseDistances[player * CELL_COUNT + accessIds[access]];
      if (distance < best) {
        best = distance;
        target = access;
      }
    }
    threatDistance[player] = best;
    threatTarget[player] = target;
  }

  const targetRadix = accessIds.length + 1;
  const lightRadix = 1 << lightIds.length;
  const trapRadix = 1 << trapIds.length;
  const stateCardinality =
    CELL_COUNT * CELL_COUNT * CELL_COUNT * targetRadix * (MAX_COMMIT + 1) * lightRadix * trapRadix;
  if (!Number.isSafeInteger(stateCardinality - 1)) {
    throw new RangeError(`Packed state space exceeds Number.MAX_SAFE_INTEGER: ${stateCardinality}`);
  }
  const meta = {
    cells,
    walls,
    baseNeighbours,
    baseDistances,
    moveTarget,
    manhattan,
    accessIds,
    lightIds,
    trapIds,
    lightBitByCell,
    trapBitByCell,
    zoneMask,
    exitId: cellId(ctx.map.exitPosition),
    difficulty: ctx.difficulty,
    threatTarget,
    threatDistance,
    targetRadix,
    lightRadix,
    trapRadix,
    allLights: lightRadix - 1,
    stateCardinality,
    maximumPackedKey: stateCardinality - 1,
    requiredBits: Math.ceil(Math.log2(stateCardinality)),
    componentBits: {
      explorerPosition: 7,
      hunterPosition: 7,
      sentinelPosition: 7,
      committedAccess: Math.ceil(Math.log2(Math.max(2, targetRadix))),
      commitTurnsRemaining: 2,
      collectedLights: lightIds.length,
      activeTraps: trapIds.length,
    },
    trapVariants: new Array(trapRadix),
    precomputeMs: 0,
  };
  meta.trapVariants[0] = { neighbours: baseNeighbours, distances: baseDistances };
  meta.precomputeMs = performance.now() - started;
  ctx.packed = meta;
  return meta;
}

export function canonicalToNumeric(state) {
  const convert = (value) => {
    if (typeof value === "number") return value;
    const [row, col] = value.split(",").map(Number);
    return row * BOARD_SIDE + col;
  };
  return {
    e: convert(state.e), h: convert(state.h), s: convert(state.s),
    t: state.t, c: state.c, lights: state.lights, traps: state.traps,
  };
}

export function numericToCanonical(state) {
  return {
    e: cellKey(state.e), h: cellKey(state.h), s: cellKey(state.s),
    t: state.t, c: state.c, lights: state.lights, traps: state.traps,
  };
}

function validateNumericState(meta, state) {
  assertIntegerInRange(state.e, 0, CELL_COUNT - 1, "Explorer position");
  assertIntegerInRange(state.h, 0, CELL_COUNT - 1, "Hunter position");
  assertIntegerInRange(state.s, 0, CELL_COUNT - 1, "Sentinel position");
  assertIntegerInRange(state.t, -1, meta.accessIds.length - 1, "committedAccess");
  assertIntegerInRange(state.c, 0, MAX_COMMIT, "commitTurnsRemaining");
  assertIntegerInRange(state.lights, 0, meta.lightRadix - 1, "collectedLights");
  assertIntegerInRange(state.traps, 0, meta.trapRadix - 1, "activeTraps");
}

function packFields(meta, e, h, s, t, c, lights, traps) {
  let key = e;
  key = key * CELL_COUNT + h;
  key = key * CELL_COUNT + s;
  key = key * meta.targetRadix + (t + 1);
  key = key * (MAX_COMMIT + 1) + c;
  key = key * meta.lightRadix + lights;
  key = key * meta.trapRadix + traps;
  return key;
}

export function packState(ctx, canonicalOrNumericState) {
  const meta = preparePackedContext(ctx);
  const state = canonicalToNumeric(canonicalOrNumericState);
  validateNumericState(meta, state);
  return packFields(meta, state.e, state.h, state.s, state.t, state.c, state.lights, state.traps);
}

export function unpackNumericState(ctx, packedKey) {
  const meta = preparePackedContext(ctx);
  assertIntegerInRange(packedKey, 0, meta.maximumPackedKey, "packedKey");
  let value = packedKey;
  const traps = value % meta.trapRadix;
  value = Math.floor(value / meta.trapRadix);
  const lights = value % meta.lightRadix;
  value = Math.floor(value / meta.lightRadix);
  const c = value % (MAX_COMMIT + 1);
  value = Math.floor(value / (MAX_COMMIT + 1));
  const t = (value % meta.targetRadix) - 1;
  value = Math.floor(value / meta.targetRadix);
  const s = value % CELL_COUNT;
  value = Math.floor(value / CELL_COUNT);
  const h = value % CELL_COUNT;
  value = Math.floor(value / CELL_COUNT);
  return { e: value, h, s, t, c, lights, traps };
}

export function unpackState(ctx, packedKey) {
  return numericToCanonical(unpackNumericState(ctx, packedKey));
}

export function initialPackedState(ctx) {
  return canonicalToNumeric(initialCanonicalState(ctx));
}

export function packedStateContract(ctx) {
  const meta = preparePackedContext(ctx);
  return {
    boardCells: CELL_COUNT,
    accessCount: meta.accessIds.length,
    lightCount: meta.lightIds.length,
    trapCount: meta.trapIds.length,
    commitValues: MAX_COMMIT + 1,
    componentBits: meta.componentBits,
    conservativeBitSum: Object.values(meta.componentBits).reduce((sum, bits) => sum + bits, 0),
    mixedRadixStateCardinality: meta.stateCardinality,
    maximumPackedKey: meta.maximumPackedKey,
    mixedRadixRequiredBits: meta.requiredBits,
    numberSafe: Number.isSafeInteger(meta.maximumPackedKey),
  };
}

export { oldStringKey };
