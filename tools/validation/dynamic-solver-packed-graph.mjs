/** Compact exact graph construction for the packed dynamic solver. */
import { ACTIONS } from "./dynamic-solver.mjs";
import {
  initialPackedState,
  preparePackedContext,
} from "./dynamic-solver-packed.mjs";
import { enumeratePackedSuccessors } from "./dynamic-solver-packed-successors.mjs";

const CELL_COUNT = 81;
const MAX_COMMIT = 3;

function packFields(meta, e, h, s, t, c, lights, traps) {
  let key = e;
  key = key * CELL_COUNT + h;
  key = key * CELL_COUNT + s;
  key = key * meta.targetRadix + (t + 1);
  key = key * (MAX_COMMIT + 1) + c;
  key = key * meta.lightRadix + lights;
  return key * meta.trapRadix + traps;
}

export class GrowableBuffer {
  constructor(Type, initialCapacity = 1024) {
    this.Type = Type;
    this.data = new Type(Math.max(1, initialCapacity));
    this.length = 0;
  }

  ensure(requiredLength) {
    if (requiredLength <= this.data.length) return;
    let capacity = this.data.length;
    while (capacity < requiredLength) capacity *= 2;
    const next = new this.Type(capacity);
    next.set(this.data);
    this.data = next;
  }

  push(value) {
    this.ensure(this.length + 1);
    this.data[this.length] = value;
    return this.length++;
  }

  allocatedBytes() {
    return this.data.byteLength;
  }
}

export class PackedNodeStore {
  constructor(initialCapacity = 4096) {
    this.capacity = Math.max(1, initialCapacity);
    this.count = 0;
    this.ids = new Map();
    this.keys = new Float64Array(this.capacity);
    this.e = new Uint8Array(this.capacity);
    this.h = new Uint8Array(this.capacity);
    this.s = new Uint8Array(this.capacity);
    this.t = new Int8Array(this.capacity);
    this.c = new Uint8Array(this.capacity);
    this.lights = new Uint8Array(this.capacity);
    this.traps = new Uint8Array(this.capacity);
    this.depth = new Uint32Array(this.capacity);
    this.parent = new Int32Array(this.capacity);
    this.parent.fill(-1);
    this.parentAction = new Int8Array(this.capacity);
    this.parentAction.fill(-1);
    this.actionOffset = new Uint32Array(this.capacity);
    this.actionCount = new Uint8Array(this.capacity);
  }

  grow() {
    const oldCapacity = this.capacity;
    this.capacity *= 2;
    const replace = (name, Type, fill = null) => {
      const next = new Type(this.capacity);
      if (fill !== null) next.fill(fill);
      next.set(this[name].subarray(0, oldCapacity));
      this[name] = next;
    };
    replace("keys", Float64Array);
    replace("e", Uint8Array);
    replace("h", Uint8Array);
    replace("s", Uint8Array);
    replace("t", Int8Array);
    replace("c", Uint8Array);
    replace("lights", Uint8Array);
    replace("traps", Uint8Array);
    replace("depth", Uint32Array);
    replace("parent", Int32Array, -1);
    replace("parentAction", Int8Array, -1);
    replace("actionOffset", Uint32Array);
    replace("actionCount", Uint8Array);
  }

  add(key, e, h, s, t, c, lights, traps, parent = -1, parentAction = -1, depth = 0) {
    if (this.count === this.capacity) this.grow();
    const id = this.count++;
    this.ids.set(key, id);
    this.keys[id] = key;
    this.e[id] = e;
    this.h[id] = h;
    this.s[id] = s;
    this.t[id] = t;
    this.c[id] = c;
    this.lights[id] = lights;
    this.traps[id] = traps;
    this.parent[id] = parent;
    this.parentAction[id] = parentAction;
    this.depth[id] = depth;
    return id;
  }

  numericState(id) {
    return {
      e: this.e[id], h: this.h[id], s: this.s[id], t: this.t[id],
      c: this.c[id], lights: this.lights[id], traps: this.traps[id],
    };
  }

  allocatedBytes() {
    return this.keys.byteLength + this.e.byteLength + this.h.byteLength + this.s.byteLength +
      this.t.byteLength + this.c.byteLength + this.lights.byteLength + this.traps.byteLength +
      this.depth.byteLength + this.parent.byteLength + this.parentAction.byteLength +
      this.actionOffset.byteLength + this.actionCount.byteLength;
  }
}

function normalizeLimits(limits) {
  if (typeof limits === "number") return { maxStates: limits };
  return limits ?? {};
}

function memoryEstimate(nodes, buffers) {
  const typedArrayBytes = nodes.allocatedBytes() +
    buffers.reduce((sum, buffer) => sum + buffer.allocatedBytes(), 0);
  const estimatedMapBytes = nodes.ids.size * 40;
  return {
    typedArrayBytes,
    estimatedMapBytes,
    estimatedTotalBytes: typedArrayBytes + estimatedMapBytes,
  };
}

/** Forward exhaustive graph construction with exact resource-limit reporting. */
export function explorePacked(ctx, limitsOrStateBudget = {}, options = {}) {
  const limits = normalizeLimits(limitsOrStateBudget);
  const profile = {
    packingMs: 0,
    successorEnumerationMs: 0,
    visitedLookupMs: 0,
    graphStorageMs: 0,
    queueOperationsMs: 0,
  };
  const started = performance.now();
  const meta = preparePackedContext(ctx);
  const start = initialPackedState(ctx);
  const startKey = packFields(
    meta, start.e, start.h, start.s, start.t, start.c, start.lights, start.traps,
  );
  const initialCapacity = Math.min(Math.max(limits.maxStates ?? 4096, 4096), 65_536);
  const nodes = new PackedNodeStore(initialCapacity);
  nodes.add(startKey, start.e, start.h, start.s, start.t, start.c, start.lights, start.traps);
  const actionSource = new GrowableBuffer(Uint32Array);
  const actionName = new GrowableBuffer(Uint8Array);
  const actionSuccessorOffset = new GrowableBuffer(Uint32Array);
  const actionSuccessorCount = new GrowableBuffer(Uint8Array);
  const actionFlags = new GrowableBuffer(Uint8Array);
  const successorIds = new GrowableBuffer(Uint32Array, 4096);
  const buffers = [
    actionSource, actionName, actionSuccessorOffset,
    actionSuccessorCount, actionFlags, successorIds,
  ];
  let transitions = 0;
  let head = 0;
  let peakFrontier = 1;
  let shortestWin = null;
  let resourceLimit = null;
  let lastMemory = memoryEstimate(nodes, buffers);

  const limitReached = () => {
    const elapsedMs = performance.now() - started;
    const frontier = nodes.count - head;
    if (limits.maxStates !== undefined && nodes.count > limits.maxStates) return "STATE_LIMIT";
    if (limits.maxTransitions !== undefined && transitions > limits.maxTransitions) return "TRANSITION_LIMIT";
    if (limits.maxFrontier !== undefined && frontier > limits.maxFrontier) return "FRONTIER_LIMIT";
    if (limits.maxElapsedMs !== undefined && elapsedMs > limits.maxElapsedMs) return "TIME_LIMIT";
    if (limits.maxMemoryBytes !== undefined) {
      lastMemory = memoryEstimate(nodes, buffers);
      if (lastMemory.estimatedTotalBytes > limits.maxMemoryBytes) return "MEMORY_LIMIT";
    }
    return null;
  };

  // Node IDs are assigned in BFS insertion order, so `head` is an implicit FIFO
  // queue with no shift/copy cost and no additional queue allocation.
  while (head < nodes.count) {
    if ((head & 255) === 0) {
      resourceLimit = limitReached();
      if (resourceLimit) break;
    }
    const nodeId = head++;
    const state = nodes.numericState(nodeId);
    nodes.actionOffset[nodeId] = actionSource.length;
    for (let action = 0; action < ACTIONS.length; action += 1) {
      const successorOffset = successorIds.length;
      const successorStarted = performance.now();
      const result = enumeratePackedSuccessors(
        ctx,
        state,
        action,
        (key, e, h, s, t, c, lights, traps) => {
          const lookupStarted = performance.now();
          let successorId = nodes.ids.get(key);
          profile.visitedLookupMs += performance.now() - lookupStarted;
          if (successorId === undefined) {
            successorId = nodes.add(
              key, e, h, s, t, c, lights, traps,
              nodeId, action, nodes.depth[nodeId] + 1,
            );
          }
          successorIds.push(successorId);
        },
        { activateTraps: options.activateTraps !== false, profile },
      );
      profile.successorEnumerationMs += performance.now() - successorStarted;
      if (!result) continue;
      const storageStarted = performance.now();
      let flags = 0;
      if (result.hasWin) flags |= 1;
      if (result.hasLoss) flags |= 2;
      actionSource.push(nodeId);
      actionName.push(action);
      actionSuccessorOffset.push(successorOffset);
      actionSuccessorCount.push(result.stateCount);
      actionFlags.push(flags);
      transitions += result.stateCount + Number(result.hasWin) + Number(result.hasLoss);
      if (result.hasWin && shortestWin === null) shortestWin = { nodeId, action };
      profile.graphStorageMs += performance.now() - storageStarted;
    }
    nodes.actionCount[nodeId] = actionSource.length - nodes.actionOffset[nodeId];
    peakFrontier = Math.max(peakFrontier, nodes.count - head);
  }

  if (!resourceLimit && head < nodes.count) resourceLimit = limitReached() ?? "RESOURCE_LIMIT";
  lastMemory = memoryEstimate(nodes, buffers);
  const elapsedMs = performance.now() - started;
  return {
    kind: "PACKED_GRAPH",
    ctx,
    meta,
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
    transitions,
    explored: nodes.count,
    frontier: nodes.count - head,
    peakFrontier,
    truncated: head < nodes.count,
    resourceLimit,
    shortestWin,
    elapsedMs,
    memory: lastMemory,
    profile: {
      ...profile,
      totalMs: elapsedMs,
      statesPerSecond: nodes.count / (elapsedMs / 1000),
      transitionsPerSecond: transitions / (elapsedMs / 1000),
    },
  };
}
