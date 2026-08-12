# Exact dynamic solver design

## Graph

Packed numeric keys map to dense node IDs. Node fields and graph columns live in growable
typed arrays. BFS insertion order is an implicit FIFO queue, so queue operations allocate
no second structure. Edges retain action boundaries, successor IDs, and WIN/LOSS flags needed
for witnesses, AND-OR solving, predecessor construction, and SCC.

## Analyses

- Existential reachability: Explorer OR, RNG OR.
- Guaranteed reachability: Explorer OR, RNG AND.
- Both use linear backward attractors over compact predecessor lists.
- Guaranteed actions use remaining-outcome counters; LOSS never decrements.
- The first forward-BFS WIN reconstructs a shortest existential witness.
- SCC uses iterative Kosaraju in O(V + E), avoiding recursion limits and O(V^2) work.

The linear attractors matched the previous repeated-scan fixpoints on
5,263 states: 0 existential and
0 guaranteed mismatches.

## Resource safety and resume

Each case records state, transition, frontier, memory-estimate, and elapsed limits. Hitting
any limit yields `INCONCLUSIVE_RESOURCE_LIMIT`, never UNSOLVABLE. Cases are written to a
temporary file and atomically renamed only after completion. Work directories include a hash
of solver modules, runtime sources, campaign config, and seed matrix; `--resume` only reuses
matching final case files.
