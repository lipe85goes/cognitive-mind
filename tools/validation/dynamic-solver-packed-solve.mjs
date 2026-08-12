/** Linear exact attractors and witness extraction for packed graphs. */
import { ACTIONS, encode as oldStringKey } from "./dynamic-solver.mjs";
import { numericToCanonical } from "./dynamic-solver-packed.mjs";

export function buildPredecessors(graph) {
  const started = performance.now();
  const count = graph.nodes.count;
  const predecessorCount = new Uint32Array(count);
  for (let action = 0; action < graph.actionSource.length; action += 1) {
    const offset = graph.actionSuccessorOffset.data[action];
    const length = graph.actionSuccessorCount.data[action];
    for (let index = offset; index < offset + length; index += 1) {
      predecessorCount[graph.successorIds.data[index]] += 1;
    }
  }
  const predecessorOffset = new Uint32Array(count + 1);
  for (let node = 0; node < count; node += 1) {
    predecessorOffset[node + 1] = predecessorOffset[node] + predecessorCount[node];
  }
  const predecessorActions = new Uint32Array(predecessorOffset[count]);
  const cursor = new Uint32Array(predecessorOffset.subarray(0, count));
  for (let action = 0; action < graph.actionSource.length; action += 1) {
    const offset = graph.actionSuccessorOffset.data[action];
    const length = graph.actionSuccessorCount.data[action];
    for (let index = offset; index < offset + length; index += 1) {
      const successor = graph.successorIds.data[index];
      predecessorActions[cursor[successor]++] = action;
    }
  }
  return {
    predecessorOffset,
    predecessorActions,
    elapsedMs: performance.now() - started,
  };
}

function markWinning(winning, queue, queueTail, node) {
  if (winning[node]) return queueTail;
  winning[node] = 1;
  queue[queueTail] = node;
  return queueTail + 1;
}

/**
 * EXISTENTIAL: Explorer OR, RNG OR.
 * GUARANTEED: Explorer OR, RNG AND.
 * Both are backward reachability attractors and run in O(V + E).
 */
export function solvePackedGraph(graph) {
  const started = performance.now();
  const predecessors = buildPredecessors(graph);
  const nodeCount = graph.nodes.count;
  const actionCount = graph.actionSource.length;
  const queue = new Uint32Array(nodeCount);

  const existentialStarted = performance.now();
  const existentialWinning = new Uint8Array(nodeCount);
  let queueHead = 0;
  let queueTail = 0;
  for (let action = 0; action < actionCount; action += 1) {
    if (!(graph.actionFlags.data[action] & 1)) continue;
    queueTail = markWinning(
      existentialWinning, queue, queueTail, graph.actionSource.data[action],
    );
  }
  while (queueHead < queueTail) {
    const winningNode = queue[queueHead++];
    const start = predecessors.predecessorOffset[winningNode];
    const end = predecessors.predecessorOffset[winningNode + 1];
    for (let index = start; index < end; index += 1) {
      const action = predecessors.predecessorActions[index];
      queueTail = markWinning(
        existentialWinning, queue, queueTail, graph.actionSource.data[action],
      );
    }
  }
  const existentialMs = performance.now() - existentialStarted;
  const existentialCount = queueTail;

  const guaranteedStarted = performance.now();
  const guaranteedWinning = new Uint8Array(nodeCount);
  const policyAction = new Int8Array(nodeCount);
  policyAction.fill(-1);
  const remaining = new Uint8Array(actionCount);
  queueHead = 0;
  queueTail = 0;
  for (let action = 0; action < actionCount; action += 1) {
    remaining[action] =
      graph.actionSuccessorCount.data[action] + Number(Boolean(graph.actionFlags.data[action] & 2));
    if (remaining[action] !== 0) continue;
    const source = graph.actionSource.data[action];
    if (!guaranteedWinning[source]) policyAction[source] = graph.actionName.data[action];
    queueTail = markWinning(guaranteedWinning, queue, queueTail, source);
  }
  while (queueHead < queueTail) {
    const winningNode = queue[queueHead++];
    const start = predecessors.predecessorOffset[winningNode];
    const end = predecessors.predecessorOffset[winningNode + 1];
    for (let index = start; index < end; index += 1) {
      const action = predecessors.predecessorActions[index];
      if (remaining[action] === 0) continue;
      remaining[action] -= 1;
      if (remaining[action] !== 0) continue;
      const source = graph.actionSource.data[action];
      if (!guaranteedWinning[source]) policyAction[source] = graph.actionName.data[action];
      queueTail = markWinning(guaranteedWinning, queue, queueTail, source);
    }
  }
  const guaranteedMs = performance.now() - guaranteedStarted;
  const guaranteedCount = queueTail;

  return {
    existentialWinning,
    guaranteedWinning,
    policyAction,
    existentialCount,
    guaranteedCount,
    predecessors,
    profile: {
      predecessorBuildMs: predecessors.elapsedMs,
      existentialMs,
      guaranteedMs,
      totalMs: performance.now() - started,
    },
  };
}

/** The first WIN found by forward BFS is a shortest existential witness. */
export function packedWitness(graph) {
  if (!graph.shortestWin) return null;
  const reversed = [];
  let current = graph.shortestWin.nodeId;
  while (current !== graph.startId) {
    reversed.push({
      action: ACTIONS[graph.nodes.parentAction[current]].name,
      state: oldStringKey(numericToCanonical(graph.nodes.numericState(current))),
    });
    current = graph.nodes.parent[current];
  }
  reversed.reverse();
  reversed.push({ action: ACTIONS[graph.shortestWin.action].name, state: "WIN" });
  return reversed;
}

export function classifyPacked(graph, solved) {
  if (graph.truncated) return "INCONCLUSIVE_RESOURCE_LIMIT";
  if (solved.guaranteedWinning[graph.startId]) return "GUARANTEED_SOLVABLE_PRE_CHEST";
  if (solved.existentialWinning[graph.startId]) return "POSSIBLE_BUT_NOT_GUARANTEED_PRE_CHEST";
  return "PROVED_UNSOLVABLE_PRE_CHEST";
}

export function guaranteedPolicySummary(graph, solved, limit = 256) {
  if (!solved.guaranteedWinning[graph.startId]) return null;
  const entries = [];
  for (let node = 0; node < graph.nodes.count && entries.length < limit; node += 1) {
    const action = solved.policyAction[node];
    if (action < 0 || !solved.guaranteedWinning[node]) continue;
    entries.push({
      state: oldStringKey(numericToCanonical(graph.nodes.numericState(node))),
      action: ACTIONS[action].name,
    });
  }
  return {
    initialAction: ACTIONS[solved.policyAction[graph.startId]].name,
    winningPolicyStates: solved.guaranteedCount,
    entries,
    truncatedEntries: solved.guaranteedCount > entries.length,
  };
}
