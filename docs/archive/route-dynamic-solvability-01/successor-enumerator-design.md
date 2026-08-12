# Successor enumerator design

Completeness is grounded in source branch enumeration, not sampling:

- `src/engine/difficulty.ts`: every branch of `getPredatorNextPosition` and
  `pickRandom`;
- `chooseGuardianMove`: preferred destination, illegal-destination fallback, Easy's
  random alternative, best-distance ties, and stay-put fallback;
- `randomItem`: every array element has positive probability;
- `decideSentinelMove`: pure, deterministic, one Sentinel outcome per Hunter branch.

The runtime differential evidence observed 32,880
real transitions with 0 outside support. It observed
1241/1242
enumerated branches at least once. That sampling supports soundness; it does **not** prove
completeness. Completeness comes from the branch list above.

The optimized enumerator precomputes static neighbours, Manhattan distances, base all-pairs
distances, and exact all-pairs distances for each reached trap mask. It does not drop a state,
branch, RNG outcome, or action. 6,480
reachable `state + action` pairs were compared by complete canonical successor identity:
0 mismatches.
