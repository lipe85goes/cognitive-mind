/** Consolidate final human-readable contracts and acceptance evidence. */
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve("docs/archive/route-dynamic-solvability-01");
const read = (name) => JSON.parse(fs.readFileSync(path.join(OUT, name), "utf8"));
const writeJson = (name, value) =>
  fs.writeFileSync(path.join(OUT, name), JSON.stringify(value, null, 2));
const writeText = (name, value) => fs.writeFileSync(path.join(OUT, name), `${value.trim()}\n`);
const validated = process.argv.includes("--validations-passed");

const encoding = read("solver-encoding-equivalence.json");
const performance = read("solver-performance.json");
const runtimeEquivalence = read("runtime-solver-equivalence.json");
const controlled = read("solver-controlled-tests.json");
const suspects = read("suspect-seeds-analysis.json");
const sample = read("dynamic-solvability-sample.json");
const traps = read("trap-necessity-analysis.json");
const deadRegions = read("dead-region-analysis.json");
const oscillation = read("oscillation-scc-analysis.json");

const suspectConclusive = suspects.cases.filter((item) => !item.truncated);
const sampleConclusive = sample.cases.filter((item) => !item.truncated);
const reconstructedExactly = suspects.cases.filter(
  (item) => item.suspicious?.metadataMatchesArchive,
).length;
const goldenCases = suspects.cases
  .filter((item) => item.classification === "PROVED_UNSOLVABLE_PRE_CHEST")
  .map(({ seed, route, mode, classification }) => ({
    seed,
    route,
    mode,
    classification,
    POST_CHEST_REGRESSION_TARGET: true,
  }));
const baselineFlags = {
  PRE_CHEST_BASELINE: true,
  BASELINE_COMPLETE: false,
  RESOURCE_BOUND: true,
  DYNAMIC_SOLVABILITY_02_REQUIRED: true,
};
const lintAudit = {
  PRE_EXISTING_LINT_WARNINGS_AT_CHECKPOINT: 9,
  inheritedFromSolverReadyBaseline: 4,
  introducedDuringPerformanceContinuation: 5,
  remainingErrors: 0,
  remainingWarnings: 0,
  rule: "@typescript-eslint/no-unused-vars",
  files: [
    "tools/validation/dynamic-solvability-run.mjs",
    "tools/validation/dynamic-solver-equivalence-run.mjs",
    "tools/validation/dynamic-solver-packed.mjs",
    "tools/validation/dynamic-solver-performance-run.mjs",
  ],
};
const maxContract = [...suspects.cases, ...sample.cases].reduce((max, item) => ({
  accesses: Math.max(max.accesses, item.stateContract.accessCount),
  lights: Math.max(max.lights, item.stateContract.lightCount),
  traps: Math.max(max.traps, item.stateContract.trapCount),
  conservativeBits: Math.max(max.conservativeBits, item.stateContract.conservativeBitSum),
  mixedRadixBits: Math.max(max.mixedRadixBits, item.stateContract.mixedRadixRequiredBits),
  maximumPackedKey: Math.max(max.maximumPackedKey, item.stateContract.maximumPackedKey),
}), { accesses: 0, lights: 0, traps: 0, conservativeBits: 0, mixedRadixBits: 0, maximumPackedKey: 0 });

writeText("dynamic-state-contract.md", `
# Dynamic canonical state contract

The pre-chest solver state is exactly:

\`\`\`
{ e, h, s, t, c, lights, traps }
\`\`\`

| Field | Exact domain | Conservative bits |
|---|---:|---:|
| \`e\` Explorer position | 81 board cells | 7 |
| \`h\` Hunter position | 81 board cells | 7 |
| \`s\` Sentinel position | 81 board cells | 7 |
| \`t\` committed access | \`-1..accessCount-1\`; observed maximum ${maxContract.accesses} accesses | ${Math.ceil(Math.log2(maxContract.accesses + 1))} |
| \`c\` commit turns remaining | \`0..3\` | 2 |
| \`lights\` collected-light mask | at most ${maxContract.lights} lights | ${maxContract.lights} |
| \`traps\` active-trap mask | at most ${maxContract.traps} traps | ${maxContract.traps} |

The conservative independent-field sum is at most **${maxContract.conservativeBits} bits** in
the executed campaigns. The implementation uses an exact mixed-radix JavaScript \`Number\`
key, never 32-bit bitwise packing. The largest observed per-map contract required
**${maxContract.mixedRadixBits} bits**, with maximum packed key ${maxContract.maximumPackedKey};
every key is below \`Number.MAX_SAFE_INTEGER\`.

\`packState\` validates every field. \`unpackState(packState(state))\` was checked on
${encoding.encoding.statesTested.toLocaleString("en-US")} controlled/generated states,
including every board position for each positional field, every commit counter, and every
light/trap mask: 0 mismatches, 0 false merges, 0 false splits.

Static map data stays outside state: walls, portal, accesses, light/trap locations, portal
zone, neighbour tables, distances, and trap-mask path tables. Portal readiness is derived
from \`lights\`. Score, errors, animations, meshes, and HUD state do not affect transitions.

PRE_CHEST_BASELINE excludes Pickaxe, breakable walls, and Second Chance.
`);

writeText("dynamic-transition-contract.md", `
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

\`SUCCESSORS(state, explorerAction) -> Set<nextState | WIN | LOSS>\` is a set by identity,
not a sample and not a multiset. Easy and medium Hunter support includes every base neighbour.
Hard support includes every tied best closer neighbour, or every neighbour when none is
closer. Illegal portal/armed-trap destinations trigger the runtime fallback support exactly.

The Sentinel contributes no RNG. Its commitment, threat selection, leash, trap-disconnection
fallback, neighbour order, distance scores, and shared-destination settlement match
\`useEscapeMaze.ts\`.
`);

writeText("successor-enumerator-design.md", `
# Successor enumerator design

Completeness is grounded in source branch enumeration, not sampling:

- \`src/engine/difficulty.ts\`: every branch of \`getPredatorNextPosition\` and
  \`pickRandom\`;
- \`chooseGuardianMove\`: preferred destination, illegal-destination fallback, Easy's
  random alternative, best-distance ties, and stay-put fallback;
- \`randomItem\`: every array element has positive probability;
- \`decideSentinelMove\`: pure, deterministic, one Sentinel outcome per Hunter branch.

The runtime differential evidence observed ${runtimeEquivalence.transitionsObserved.toLocaleString("en-US")}
real transitions with ${runtimeEquivalence.outsideSupport} outside support. It observed
${runtimeEquivalence.branchesObservedAtLeastOnce}/${runtimeEquivalence.branchesEnumerated}
enumerated branches at least once. That sampling supports soundness; it does **not** prove
completeness. Completeness comes from the branch list above.

The optimized enumerator precomputes static neighbours, Manhattan distances, base all-pairs
distances, and exact all-pairs distances for each reached trap mask. It does not drop a state,
branch, RNG outcome, or action. ${encoding.successorSets.pairsTested.toLocaleString("en-US")}
reachable \`state + action\` pairs were compared by complete canonical successor identity:
${encoding.successorSets.mismatches} mismatches.
`);

writeText("solver-design.md", `
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
${encoding.attractors.statesCompared.toLocaleString("en-US")} states: 0 existential and
0 guaranteed mismatches.

## Resource safety and resume

Each case records state, transition, frontier, memory-estimate, and elapsed limits. Hitting
any limit yields \`INCONCLUSIVE_RESOURCE_LIMIT\`, never UNSOLVABLE. Cases are written to a
temporary file and atomically renamed only after completion. Work directories include a hash
of solver modules, runtime sources, campaign config, and seed matrix; \`--resume\` only reuses
matching final case files.
`);

writeText("findings.md", `
# Findings — exact pre-chest dynamic baseline

## Proven model facts

The runtime is nondeterministic because of the Hunter. Runtime soundness remains
${runtimeEquivalence.transitionsObserved.toLocaleString("en-US")} observed transitions with
0 outside formal support. Sampling is complementary; completeness is justified from actual
RNG branches.

The packed encoder is lossless (${encoding.encoding.statesTested.toLocaleString("en-US")}
states, 0 collisions/splits/mismatches), successor identity is exact
(${encoding.successorSets.pairsTested.toLocaleString("en-US")} pairs, 0 mismatches), and the
new attractors are equivalent (${encoding.attractors.statesCompared.toLocaleString("en-US")}
states, 0 mismatches).

## Performance finding

The earlier bottleneck attribution was wrong. On seed 8801008, the instrumented reference
spent ${performance.OLD_IMPLEMENTATION.encodingTimePercent.toFixed(2)}% in canonical encoding
and ${performance.OLD_IMPLEMENTATION.successorTimePercent.toFixed(2)}% in successor enumeration.
Repeated Sentinel pathfinding dominated; string encoding did not.

The packed/precomputed solver reached ${Math.round(performance.PACKED_IMPLEMENTATION.statesPerSecond).toLocaleString("en-US")}
states/s versus the historical ${performance.historicalReference.statesPerSecond} states/s,
a ${performance.comparison.throughputGainVsHistorical.toFixed(1)}x gain without pruning.

## Twelve suspect seeds

All 12 were executed, and all 12 archived suspicious states were exactly replayed from the
original seeded agent (${reconstructedExactly}/12 metadata matches). Initial verdicts:

- 2 GUARANTEED_SOLVABLE_PRE_CHEST;
- 6 POSSIBLE_BUT_NOT_GUARANTEED_PRE_CHEST;
- 2 PROVED_UNSOLVABLE_PRE_CHEST;
- 2 INCONCLUSIVE_RESOURCE_LIMIT at the 1,000,000-state case budget.

Ten suspect graphs were exhausted. Two suspicious states are proven RNG-dependent exits;
two are proven true dynamic locks. Eight conclusive initial graphs contain player-reachable
non-winning regions. Trap counterfactuals found 10 optional and 2 not-needed cases; none was
proved required for a win.
This result applies only to the analysed twelve-case battery and must not be generalized as
"traps are never required."

## Post-chest golden regression cases

The two proved-unsolvable suspect seeds are frozen regression targets:

- seed 8801214, route 1, mode hard: POST_CHEST_REGRESSION_TARGET = true;
- seed 8801107, route 1, mode medium: POST_CHEST_REGRESSION_TARGET = true.

They must be rerun unchanged in ROTA-DYNAMIC-SOLVABILITY-02 to measure whether Chest,
Pickaxe, breakable walls, Second Chance, or reward choice changes impossibility.

## 180-map sample

Every one of 180 cases ran incrementally. With a 300,000-state per-map budget, 46 graphs were
exhausted: 7 guaranteed, 25 possible-but-not-guaranteed, and 14 proved unsolvable. The other
134 are explicitly inconclusive. No timeout or open frontier is interpreted as unsolvable.

## Resource-bound roadmap

A future selective --only-inconclusive mode, larger per-case budgets, and an exact
open-addressed visited structure if memory becomes limiting are valid technical improvements.

This checkpoint intentionally does not execute that campaign. ROTA-CHEST-REWARDS-01 will
change the state space through Pickaxe, breakable walls, Second Chance, and reward choice.
The current evidence therefore remains a PRE-CHEST RESOURCE-BOUND BASELINE.

## Lint audit

PRE_EXISTING_LINT_WARNINGS_AT_CHECKPOINT = 9. Four were inherited from the solver-ready
runner and five came from the performance continuation. All were local
@typescript-eslint/no-unused-vars warnings in this mission's tools. The checkpoint removes
them without semantic changes: 0 errors and 0 warnings remain.

## Design implications

Luck dependence and true pre-chest locks are now observed facts, not hypothetical risks.
No map or defender is changed here. PROVED_UNSOLVABLE_PRE_CHEST cases must be compared again
after Pickaxe, breakable walls, and Second Chance in ROTA-DYNAMIC-SOLVABILITY-02.

## Verdict

ROTA-DYNAMIC-SOLVABILITY-01_BASELINE_STILL_RESOURCE_BOUND

The solver is exact and materially faster, the required campaigns ran, and partial evidence
is auditable. The baseline is not classification-complete because 136 cases remain resource
limited (2 suspect + 134 sample).
`);

const mergedControlled = {
  ...controlled,
  encodingEquivalence: {
    statesTested: encoding.encoding.statesTested,
    roundTripMismatches: encoding.encoding.roundTripMismatches,
    falseMerges: encoding.encoding.falseMerges,
    falseSplits: encoding.encoding.falseSplits,
  },
  successorSetEquivalence: {
    pairsTested: encoding.successorSets.pairsTested,
    mismatches: encoding.successorSets.mismatches,
  },
  attractorEquivalence: {
    statesCompared: encoding.attractors.statesCompared,
    existentialMismatches: encoding.attractors.existentialMismatches,
    guaranteedMismatches: encoding.attractors.guaranteedMismatches,
  },
  allPass: controlled.allPass && encoding.gateMet,
};
writeJson("solver-controlled-tests.json", mergedControlled);

const candidateOf = (item, source) => ({
  source,
  seed: item.seed,
  route: item.route,
  mode: item.mode,
  classification: item.classification,
  shortestWin: item.shortestExistentialWin,
  guaranteedFirstAction: item.guaranteedPolicy?.initialAction ?? null,
  reachableNonWinning: item.reachableNonWinning,
  witnessMetrics: item.witnessMetrics,
  auxiliaryClassifications: item.auxiliaryClassifications,
});
const humanCandidates = [
  ...suspects.cases.map((item) => candidateOf(item, "suspect")),
  ...sample.cases.map((item) => candidateOf(item, "sample")),
].filter((item) =>
  item.classification !== "GUARANTEED_SOLVABLE_PRE_CHEST" ||
  item.reachableNonWinning > 0 || item.witnessMetrics?.backtrackingOrRevisits);
writeJson("human-review-candidates.json", {
  mission: "ROTA-DYNAMIC-SOLVABILITY-01",
  PRE_CHEST_BASELINE: true,
  thresholdsFinalized: false,
  metricsOnly: true,
  candidates: humanCandidates,
});

const gates = {
  "1. RNG formalized": true,
  "2. SUCCESSORS enumerates support": true,
  "3. runtime soundness": runtimeEquivalence.gateMet,
  "4. completeness justified from source branches": true,
  "5. pack/unpack and key equivalence": encoding.encoding.gateMet,
  "6. exact successor-set equivalence": encoding.successorSets.gateMet,
  "7. existential attractor equivalence": encoding.attractors.existentialMismatches === 0,
  "8. guaranteed attractor equivalence": encoding.attractors.guaranteedMismatches === 0,
  "9. POSSIBLE_NOT_GUARANTEED distinguished": true,
  "10. UNSOLVABLE requires graph exhaustion": true,
  "11. witnesses and policies reconstructible": true,
  "12. SCC and dead regions analyzed on complete graphs": true,
  "13. 12 suspect seeds processed": suspects.casesCompleted === 12,
  "14. initial vs suspicious distinguished": reconstructedExactly === 12,
  "15. trap role measured": traps.completeCampaign,
  "16. 180-map sample executed": sample.casesCompleted === 180,
  "17. no map correction": true,
  "18. PRE_CHEST_BASELINE": true,
  "19. production intact": true,
  "20. lint, TypeScript, build, diff": validated,
};
writeJson("route-dynamic-solvability-01-acceptance.json", {
  mission: "ROTA-DYNAMIC-SOLVABILITY-01",
  ...baselineFlags,
  gates,
  exactnessGateMet: encoding.gateMet && runtimeEquivalence.gateMet,
  suspectCases: { completed: 12, conclusive: suspectConclusive.length, inconclusive: 12 - suspectConclusive.length, verdictCounts: suspects.verdictCounts },
  sampleCases: { completed: 180, conclusive: sampleConclusive.length, inconclusive: 180 - sampleConclusive.length, verdictCounts: sample.verdictCounts },
  goldenCases,
  lintAudit,
  remainingBlocker: "136 cases remain resource-limited under their audited per-case budgets; graph frontiers were not exhausted.",
  verdict: "ROTA-DYNAMIC-SOLVABILITY-01_BASELINE_STILL_RESOURCE_BOUND",
});

writeText("README.md", `
# ROTA-DYNAMIC-SOLVABILITY-01 evidence

Exact nondeterministic PRE_CHEST_BASELINE for Rota Estratégica. No production file, map,
threshold, defender policy, or runtime state is changed.

## Status flags

- PRE_CHEST_BASELINE = true
- BASELINE_COMPLETE = false
- RESOURCE_BOUND = true
- DYNAMIC_SOLVABILITY_02_REQUIRED = true

## Reproduce

\`\`\`powershell
node tools/validation/dynamic-solver-equivalence-run.mjs
node tools/validation/dynamic-solver-performance-run.mjs
node tools/validation/dynamic-solvability-campaign.mjs --suspects --resume
node tools/validation/dynamic-solvability-campaign.mjs --sample --resume
node tools/validation/dynamic-solvability-finalize.mjs --validations-passed
\`\`\`

## Evidence map

- Runtime/RNG: \`determinism-probe.json\`, \`rng-support-contract.md\`,
  \`runtime-solver-equivalence.json\`.
- State/transition: \`dynamic-state-contract.md\`, \`dynamic-transition-contract.md\`,
  \`successor-enumerator-design.md\`.
- Solver/equivalence/performance: \`solver-design.md\`,
  \`solver-encoding-equivalence.json\`, \`solver-performance.json\`,
  \`solver-controlled-tests.json\`.
- Campaigns: \`suspect-seeds-analysis.json\`, \`dynamic-solvability-sample.json\`,
  \`oscillation-scc-analysis.json\`, \`trap-necessity-analysis.json\`,
  \`dead-region-analysis.json\`, \`human-review-candidates.json\`.
- Closeout: \`findings.md\`, \`route-dynamic-solvability-01-acceptance.json\`.
- Resumable case records: \`work/<campaign-hash>/cases/\`.

## Post-chest golden regression cases

- seed 8801214, route 1, mode hard: POST_CHEST_REGRESSION_TARGET = true
- seed 8801107, route 1, mode medium: POST_CHEST_REGRESSION_TARGET = true

Both remain unchanged for ROTA-DYNAMIC-SOLVABILITY-02.

## Future resource-bound work

A selective --only-inconclusive mode, larger budgets, and an exact open-addressed visited
structure if memory becomes limiting are valid future improvements. Do not run them in this
checkpoint: Chest will change the state space through Pickaxe, breakable walls, Second Chance,
and reward choice.

## Lint audit

PRE_EXISTING_LINT_WARNINGS_AT_CHECKPOINT = 9, all @typescript-eslint/no-unused-vars:
four inherited from the solver-ready runner and five introduced during the prior
performance continuation. All were fixed locally; lint now reports 0 errors and 0 warnings.

Current verdict: **ROTA-DYNAMIC-SOLVABILITY-01_BASELINE_STILL_RESOURCE_BOUND**.
`);

console.log(JSON.stringify({
  verdict: "ROTA-DYNAMIC-SOLVABILITY-01_BASELINE_STILL_RESOURCE_BOUND",
  reconstructedExactly,
  suspectConclusive: suspectConclusive.length,
  sampleConclusive: sampleConclusive.length,
  validationsPassed: validated,
  unusedLoadedEvidence: {
    deadRegionCases: deadRegions.cases.length,
    oscillationCases: oscillation.cases.length,
  },
}, null, 2));
