/** Iterative O(V + E) SCC and dead-region analysis for packed graphs. */

function buildForwardAdjacency(graph) {
  const nodeCount = graph.nodes.count;
  const count = new Uint32Array(nodeCount);
  for (let node = 0; node < nodeCount; node += 1) {
    const actionStart = graph.nodes.actionOffset[node];
    const actionEnd = actionStart + graph.nodes.actionCount[node];
    for (let action = actionStart; action < actionEnd; action += 1) {
      count[node] += graph.actionSuccessorCount.data[action];
    }
  }
  const offset = new Uint32Array(nodeCount + 1);
  for (let node = 0; node < nodeCount; node += 1) offset[node + 1] = offset[node] + count[node];
  const ids = new Uint32Array(offset[nodeCount]);
  const cursor = new Uint32Array(offset.subarray(0, nodeCount));
  for (let node = 0; node < nodeCount; node += 1) {
    const actionStart = graph.nodes.actionOffset[node];
    const actionEnd = actionStart + graph.nodes.actionCount[node];
    for (let action = actionStart; action < actionEnd; action += 1) {
      const successorStart = graph.actionSuccessorOffset.data[action];
      const successorEnd = successorStart + graph.actionSuccessorCount.data[action];
      for (let index = successorStart; index < successorEnd; index += 1) {
        ids[cursor[node]++] = graph.successorIds.data[index];
      }
    }
  }
  return { offset, ids };
}

/** Iterative Kosaraju avoids recursion depth while preserving linear cost. */
export function analyzePackedScc(graph, solved) {
  const started = performance.now();
  const nodeCount = graph.nodes.count;
  const forward = buildForwardAdjacency(graph);
  const predecessors = solved.predecessors;
  const visited = new Uint8Array(nodeCount);
  const order = new Uint32Array(nodeCount);
  let orderLength = 0;
  const stackNode = new Uint32Array(nodeCount);
  const stackEdge = new Uint32Array(nodeCount);

  for (let root = 0; root < nodeCount; root += 1) {
    if (visited[root]) continue;
    let top = 0;
    stackNode[0] = root;
    stackEdge[0] = forward.offset[root];
    visited[root] = 1;
    while (top >= 0) {
      const node = stackNode[top];
      const edge = stackEdge[top];
      if (edge < forward.offset[node + 1]) {
        const next = forward.ids[edge];
        stackEdge[top] += 1;
        if (!visited[next]) {
          visited[next] = 1;
          top += 1;
          stackNode[top] = next;
          stackEdge[top] = forward.offset[next];
        }
      } else {
        order[orderLength++] = node;
        top -= 1;
      }
    }
  }

  const component = new Int32Array(nodeCount);
  component.fill(-1);
  const componentSizes = [];
  let componentCount = 0;
  for (let orderIndex = orderLength - 1; orderIndex >= 0; orderIndex -= 1) {
    const root = order[orderIndex];
    if (component[root] >= 0) continue;
    let top = 0;
    let size = 0;
    stackNode[0] = root;
    component[root] = componentCount;
    while (top >= 0) {
      const node = stackNode[top--];
      size += 1;
      const start = predecessors.predecessorOffset[node];
      const end = predecessors.predecessorOffset[node + 1];
      for (let index = start; index < end; index += 1) {
        const action = predecessors.predecessorActions[index];
        const previous = graph.actionSource.data[action];
        if (component[previous] >= 0) continue;
        component[previous] = componentCount;
        stackNode[++top] = previous;
      }
    }
    componentSizes.push(size);
    componentCount += 1;
  }

  const hasOutgoingComponent = new Uint8Array(componentCount);
  const hasWinTerminal = new Uint8Array(componentCount);
  const entirelyNonWinning = new Uint8Array(componentCount);
  entirelyNonWinning.fill(1);
  for (let node = 0; node < nodeCount; node += 1) {
    const currentComponent = component[node];
    if (solved.existentialWinning[node]) entirelyNonWinning[currentComponent] = 0;
    const actionStart = graph.nodes.actionOffset[node];
    const actionEnd = actionStart + graph.nodes.actionCount[node];
    for (let action = actionStart; action < actionEnd; action += 1) {
      if (graph.actionFlags.data[action] & 1) hasWinTerminal[currentComponent] = 1;
      const successorStart = graph.actionSuccessorOffset.data[action];
      const successorEnd = successorStart + graph.actionSuccessorCount.data[action];
      for (let index = successorStart; index < successorEnd; index += 1) {
        if (component[graph.successorIds.data[index]] !== currentComponent) {
          hasOutgoingComponent[currentComponent] = 1;
        }
      }
    }
  }
  const closedNonWinningComponents = [];
  for (let id = 0; id < componentCount; id += 1) {
    if (entirelyNonWinning[id] && !hasOutgoingComponent[id] && !hasWinTerminal[id]) {
      closedNonWinningComponents.push({ componentId: id, states: componentSizes[id] });
    }
  }
  closedNonWinningComponents.sort((a, b) => b.states - a.states);
  return {
    component,
    componentCount,
    largestComponentStates: Math.max(0, ...componentSizes),
    cyclicComponents: componentSizes.filter((size) => size > 1).length,
    closedNonWinningComponents,
    closedNonWinningStates: closedNonWinningComponents.reduce((sum, item) => sum + item.states, 0),
    elapsedMs: performance.now() - started,
  };
}
