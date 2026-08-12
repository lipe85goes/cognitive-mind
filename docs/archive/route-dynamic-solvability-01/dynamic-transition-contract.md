# Dynamic transition contract

For each legal Explorer action:

1. reject out-of-board or wall moves without advancing the turn;
2. lose immediately if the Explorer enters either defender cell;
3. collect a light and arm a trap on the destination;
4. win immediately on a ready portal;
5. enumerate the complete positive-probability Hunter support;
6. apply the deterministic Sentinel decision for each Hunter branch;
7. if both defenders choose the same destination, keep the Sentinel at its prior cell;
8. lose if either settled defender reaches the Explorer; otherwise emit the canonical state.

`SUCCESSORS(state, explorerAction) -> Set<nextState | WIN | LOSS>` is a set by identity,
not a sample and not a multiset. Easy and medium Hunter support includes every base neighbour.
Hard support includes every tied best closer neighbour, or every neighbour when none is
closer. Illegal portal/armed-trap destinations trigger the runtime fallback support exactly.

The Sentinel contributes no RNG. Its commitment, threat selection, leash, trap-disconnection
fallback, neighbour order, distance scores, and shared-destination settlement match
`useEscapeMaze.ts`.
