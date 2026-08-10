/**
 * ROTA-DUAL-GUARDIANS-MAPS-01A-BALANCE — runs the balance pass and writes the
 * evidence. Analysis only; runtime untouched.
 *
 * Usage: node tools/validation/analyse-dual-balance.mjs [--seeds 12]
 */
import fs from "node:fs";
import path from "node:path";
import {
  loadLab, structure, objectiveRoute, stats, key, eq, neighbors, bfs,
  DIFFICULTIES, ROUTES,
} from "./route-lab.mjs";
import {
  portalZone, sentinelStep, breakableWallCandidates,
  chestCandidates, classifyFamily, ZONE_RADIUS,
} from "./dual-guardian-lab.mjs";
import {
  classifyUnsafeTurn, makeHumanV2, makeHumanV3, routeVector, candidateRoutes,
  findDominance, contextualDominance, repositionDemand, trapSetSafety,
  dualPressureDecision, rewardEligibility, safeMoves,
} from "./dual-guardian-balance.mjs";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const SEEDS = Number(arg("--seeds", 12));
const OUT = path.resolve("docs/archive/route-dual-guardians-maps-01a");
fs.mkdirSync(OUT, { recursive: true });
const write = (n, d) => { fs.writeFileSync(path.join(OUT, n), JSON.stringify(d, null, 2)); console.log("  wrote", n); };

const lab = loadLab();
const t0 = Date.now();
const rows = [];
const genTimes = [];

console.log(`sweeping ${SEEDS} seeds x 9 combinations...`);
for (const routeNumber of ROUTES) {
  for (const difficulty of DIFFICULTIES) {
    for (let s = 0; s < SEEDS; s += 1) {
      const seed = 4_000 + s * 13 + routeNumber * 211 + DIFFICULTIES.indexOf(difficulty) * 1409;
      const tg = Date.now();
      const { map, generation } = lab.generate(difficulty, routeNumber, seed);
      genTimes.push({ ms: Date.now() - tg, attempts: generation.attempts, routeNumber, difficulty });
      const zone = portalZone(map);
      const route = objectiveRoute(map);
      const st = structure(map);
      const breakables = breakableWallCandidates(map, zone);
      rows.push({
        routeNumber, difficulty, seed, map, zone, route, st, breakables,
        chest: chestCandidates(map, route),
        family: classifyFamily(map, zone, breakables, st),
        reposition: repositionDemand(map, zone),
        trapSafety: trapSetSafety(map, zone),
        fallback: generation.fallback,
      });
    }
  }
}
console.log(`  ${rows.length} maps in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

// ---------------------------------------- simulation with agents incl. v2 ---
console.log("simulating (optimal / cautious / humanV2 / flawed)...");
const unsafe = [];
const dualDecisions = [];
const agentResults = { optimal: [], cautious: [], humanV2: [], humanV3: [], flawed: [] };

function simulate(r, agentKind, tuning) {
  const { map, zone } = r;
  const route = r.route;
  if (!route) return null;
  const humanV2 = makeHumanV2(zone, { lookahead: 3 });
  const humanV3 = makeHumanV3(zone, { lookahead: 3 });
  let player = { ...map.playerStart };
  let hunter = { ...map.guardianStart };
  let sentinel = zone.zone.find((c) => !eq(c, map.exitPosition)) ?? { ...map.exitPosition };
  const sState = { pos: sentinel, target: null, commitLeft: 0 };
  let remaining = map.collectibleStars.map((s) => ({ ...s }));
  const history = [];
  let dualCount = 0;
  let outcome = "timeout";
  let turns = 0;

  for (turns = 1; turns <= 140; turns += 1) {
    const defenders = [hunter, sentinel];
    const safe = safeMoves(player, map, defenders);
    history.push({ pos: key(player), safeOptions: safe.length });

    if (safe.length === 0) {
      unsafe.push({
        route: r.routeNumber, difficulty: r.difficulty, seed: r.seed, agent: agentKind, turn: turns,
        player: key(player), hunter: key(hunter), sentinel: key(sentinel),
        last5: history.slice(-6, -1).map((h) => h.pos),
        ...classifyUnsafeTurn({ pos: player, hunter, sentinel, history }, map, zone),
      });
    }

    const dd = dualPressureDecision(player, remaining, map, hunter, sentinel, zone);
    if (dd?.isDualDecision) {
      dualCount += 1;
      if (dualDecisions.length < 400) {
        dualDecisions.push({ route: r.routeNumber, difficulty: r.difficulty, seed: r.seed, turn: turns, ...dd });
      }
    }

    let next;
    if (agentKind === "objectiveOptimal") {
      const goal = remaining.length ? remaining[0] : map.exitPosition;
      const tg = bfs(goal, map.walls);
      next = neighbors(player, map.walls).sort((a, b) => (tg.get(key(a)) ?? 99) - (tg.get(key(b)) ?? 99))[0] ?? player;
    } else if (agentKind === "humanV2") {
      next = humanV2(player, remaining, map, defenders);
    } else if (agentKind === "humanV3") {
      next = humanV3(player, remaining, map, defenders);
    } else {
      const goal = remaining.length ? remaining[0] : map.exitPosition;
      const tg = bfs(goal, map.walls);
      const danger = new Set();
      for (const d of defenders) { danger.add(key(d)); for (const n of neighbors(d, map.walls)) danger.add(key(n)); }
      const scored = neighbors(player, map.walls)
        .map((n) => ({ n, s: (tg.get(key(n)) ?? 99) + (danger.has(key(n)) ? 10 : 0) }))
        .sort((a, b) => a.s - b.s);
      next = (agentKind === "flawed" && scored.length > 1 && turns % 5 === 0) ? scored[1].n : (scored[0]?.n ?? player);
    }
    player = next;

    const hit = remaining.findIndex((l) => eq(l, player));
    if (hit >= 0) remaining.splice(hit, 1);
    if (!remaining.length && eq(player, map.exitPosition)) { outcome = "won"; break; }
    if (eq(player, hunter)) { outcome = "caught-hunter"; break; }
    if (eq(player, sentinel)) { outcome = "caught-sentinel"; break; }

    hunter = lab.api.chooseGuardianMove(hunter, player, map.exitPosition, map.walls, r.difficulty);
    if (eq(player, hunter)) { outcome = "caught-hunter"; break; }
    sState.pos = sentinel;
    sentinel = sentinelStep(sState, player, map, zone, tuning);
    if (eq(player, sentinel)) { outcome = "caught-sentinel"; break; }
  }
  return { outcome, turns, dualDecisions: dualCount, optimalMoves: route.moves };
}

const TUNED = { patrol: true, commitTurns: 3, reactionDelay: 1 };
for (const r of rows) {
  for (const a of ["objectiveOptimal", "cautious", "humanV2", "humanV3", "flawed"]) {
    const res = simulate(r, a, TUNED);
    if (res) agentResults[a].push({ route: r.routeNumber, difficulty: r.difficulty, seed: r.seed, ...res });
  }
}

const rate = (l, p) => (l.length ? +(l.filter(p).length / l.length).toFixed(3) : 0);
write("human-like-agent-v2.json", {
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A-BALANCE",
  note: "humanV2 usa apenas informação visível: posição dos dois defensores, portas da zona, luzes restantes e 2-3 turnos de consequência.",
  byAgent: Object.fromEntries(Object.entries(agentResults).map(([k, v]) => [k, {
    runs: v.length,
    won: rate(v, (x) => x.outcome === "won"),
    caughtHunter: rate(v, (x) => x.outcome === "caught-hunter"),
    caughtSentinel: rate(v, (x) => x.outcome === "caught-sentinel"),
    timeout: rate(v, (x) => x.outcome === "timeout"),
    turns: stats(v.map((x) => x.turns)),
    dualDecisions: stats(v.map((x) => x.dualDecisions)),
  }])),
});

// ------------------------------------------------ unsafe turn classification --
const byClass = { A: 0, B: 0, C: 0, D: 0 };
for (const u of unsafe) byClass[u.klass] += 1;
write("unsafe-turn-classification.json", {
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A-BALANCE",
  totalUnsafeTurns: unsafe.length,
  classes: {
    A_tatica_causada_pelo_jogador: byClass.A,
    B_inevitavel_defeito: byClass.B,
    C_falha_do_agente: byClass.C,
    D_pressao_temporaria_recuperavel: byClass.D,
  },
  gate_zeroInevitable: byClass.B === 0,
  byAgent: Object.fromEntries(["objectiveOptimal", "cautious", "humanV2", "humanV3", "flawed"].map((a) => {
    const sub = unsafe.filter((u) => u.agent === a);
    const c = { A: 0, B: 0, C: 0, D: 0 };
    for (const u of sub) c[u.klass] += 1;
    return [a, { total: sub.length, ...c }];
  })),
  inevitableCases: unsafe.filter((u) => u.klass === "B").slice(0, 40),
  sample: unsafe.slice(0, 60),
});

// ---------------------------------------------------------- route trade-offs --
const tradeRows = rows.map((r) => {
  const cands = candidateRoutes(r.map).map((c) => ({
    name: c.name, vector: routeVector(c.cells, r.map, r.zone),
  }));
  const dominance = findDominance(cands);
  const contextual = contextualDominance(
    r.map,
    r.zone,
    candidateRoutes(r.map).map((c) => ({ name: c.name, cells: c.cells })),
  );
  const lens = cands.map((c) => c.vector?.pathLength).filter((x) => typeof x === "number");
  return {
    route: r.routeNumber, difficulty: r.difficulty, seed: r.seed,
    candidates: cands, dominance, contextual,
    routeCount: cands.length,
    lengthSpread: lens.length > 1 ? Math.max(...lens) - Math.min(...lens) : 0,
    hasRealTradeoff: cands.length >= 2 && dominance.length === 0,
  };
});
write("route-tradeoff-analysis.json", {
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A-BALANCE",
  maps: tradeRows.length,
  mapsWithTwoPlusRoutes: tradeRows.filter((t) => t.routeCount >= 2).length,
  mapsWithRealTradeoff: tradeRows.filter((t) => t.hasRealTradeoff).length,
  lengthSpread: stats(tradeRows.map((t) => t.lengthSpread)),
  hunterExposureSpread: stats(tradeRows.map((t) => {
    const v = t.candidates.map((c) => c.vector?.hunterExposure).filter((x) => typeof x === "number");
    return v.length > 1 ? Math.max(...v) - Math.min(...v) : 0;
  })),
  sentinelExposureSpread: stats(tradeRows.map((t) => {
    const v = t.candidates.map((c) => c.vector?.sentinelExposure).filter((x) => typeof x === "number");
    return v.length > 1 ? Math.max(...v) - Math.min(...v) : 0;
  })),
  examples: tradeRows.filter((t) => t.hasRealTradeoff).slice(0, 25),
});
write("route-dominance-analysis.json", {
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A-BALANCE",
  rule: "uma rota domina outra se é <= em comprimento, <= em exposição ao Caçador, <= em exposição ao Sentinela e >= em potencial de recuperação, sendo estritamente melhor em pelo menos um eixo",
  mapsAnalysed: tradeRows.length,
  staticDominance: tradeRows.filter((t) => t.dominance.length > 0).length,
  contextualUniversallyDominant: tradeRows.filter((t) => t.contextual.dominantAcrossStates !== null).length,
  contextualTradeoffScore: stats(tradeRows.map((t) => t.contextual.contextualTradeoffScore)),
  routeSwitchCount: stats(tradeRows.map((t) => t.contextual.routeSwitchCount)),
  contextualExamples: tradeRows.filter((t) => t.contextual.routeSwitchCount >= 2).slice(0, 20).map((t) => ({
    route: t.route, difficulty: t.difficulty, seed: t.seed,
    preferredCounts: t.contextual.preferredCounts,
    sample: t.contextual.preferredRouteByState.slice(0, 8),
  })),
  mapsWithoutAlternative: tradeRows.filter((t) => t.routeCount < 2).length,
  dominancePairs: tradeRows.flatMap((t) => t.dominance.map((d) => ({ route: t.routeNumber, difficulty: t.difficulty, seed: t.seed, ...d }))).slice(0, 60),
});

// ------------------------------------------------------------ sentinel zone --
write("sentinel-zone-reposition-analysis.json", {
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A-BALANCE",
  maps: rows.length,
  requiresReposition: rows.filter((r) => r.reposition.requiresReposition).length,
  trivialCoverageAtRadius2: rows.filter((r) => r.reposition.trivialCoverage).length,
  coverageAt1: stats(rows.map((r) => r.reposition.bestCoverageAt1)),
  coverageAt2: stats(rows.map((r) => r.reposition.bestCoverageAt2)),
  accesses: stats(rows.map((r) => r.zone.portalAccessCount)),
  trivialCases: rows.filter((r) => r.reposition.trivialCoverage).map((r) => ({
    route: r.routeNumber, difficulty: r.difficulty, seed: r.seed,
    accesses: r.zone.portalAccessCount, coverageAt1: r.reposition.bestCoverageAt1,
  })).slice(0, 40),
});

// ------------------------------------------------------------ sentinel tune --
console.log("sweeping sentinel parameters...");
const TUNINGS = [
  { name: "rastreador (negativo)", patrol: false, commitTurns: 0 },
  { name: "territorial c1", patrol: true, commitTurns: 1 },
  { name: "territorial c2", patrol: true, commitTurns: 2 },
  { name: "territorial c3 (proposto)", patrol: true, commitTurns: 3 },
  { name: "territorial c4", patrol: true, commitTurns: 4 },
];
const tuneRows = TUNINGS.map((t) => {
  const runs = rows.filter((_, i) => i % 2 === 0).map((r) => simulate(r, "humanV3", t)).filter(Boolean);
  return {
    ...t, runs: runs.length,
    won: rate(runs, (x) => x.outcome === "won"),
    caughtHunter: rate(runs, (x) => x.outcome === "caught-hunter"),
    caughtSentinel: rate(runs, (x) => x.outcome === "caught-sentinel"),
    dualDecisions: stats(runs.map((x) => x.dualDecisions)),
  };
});
write("sentinel-balance-analysis.json", {
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A-BALANCE",
  agent: "humanV3",
  note: "dificuldade não é taxa de derrota: o critério é decisões provocadas, possibilidade de enganar e ausência de bloqueio inevitável.",
  zoneRadius: ZONE_RADIUS,
  tunings: tuneRows,
  proposed: { patrol: true, commitTurns: 3, neverOnPortal: true, leash: "ZONE_RADIUS + SENTINEL_LEASH" },
});

// ----------------------------------------------------------- trap safety ----
const trapAgg = rows.map((r) => r.trapSafety);
write("trap-combination-safety.json", {
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A-BALANCE",
  contract: "toda combinação de armadilhas que NASCE junta deve ser segura; nenhuma regra invisível no runtime",
  maps: rows.length,
  totalCombinationsChecked: trapAgg.reduce((a, t) => a + t.totalCombinations, 0),
  unsafeSingles: trapAgg.reduce((a, t) => a + t.unsafeSingles, 0),
  unsafePairs: trapAgg.reduce((a, t) => a + t.unsafePairs, 0),
  unsafeTriples: trapAgg.reduce((a, t) => a + t.unsafeTriples, 0),
  mapsWhereAllTrapsUnsafe: trapAgg.filter((t) => t.allTrapsUnsafe).length,
  gate_zeroUnsafeCoexisting: trapAgg.every((t) => t.unsafeCombinations === 0),
  offenders: rows.filter((r) => r.trapSafety.unsafeCombinations > 0).map((r) => ({
    route: r.routeNumber, difficulty: r.difficulty, seed: r.seed,
    unsafePairs: r.trapSafety.unsafePairs, worst: r.trapSafety.worstPairs,
  })).slice(0, 30),
});

// ------------------------------------------------------- reward contract ----
const rewards = rows.map((r) => ({
  route: r.routeNumber, difficulty: r.difficulty, seed: r.seed,
  chestCandidates: r.chest.length,
  ...rewardEligibility(r.map, r.breakables),
}));
write("contextual-reward-contract.json", {
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A-BALANCE",
  contract: {
    shape: "o baú oferece DUAS opções e o jogador escolhe UMA; sem RNG puro",
    rewardEligibility: "cada recompensa declara quando pode aparecer, quando não faz sentido e o impacto máximo",
    PICARETA: "elegível apenas se existir parede quebrável com utilidade >= 35",
    SEGUNDA_CHANCE: "elegível sempre que um defensor puder alcançar o Explorador",
    TERCEIRA: "em aberto — isca, tempo no Desafiador ou interação com armadilha",
    neverRequired: "nenhum item futuro é necessário para vencer",
  },
  maps: rewards.length,
  mapsWithChestCandidate: rewards.filter((r) => r.chestCandidates > 0).length,
  pickaxeEligible: rewards.filter((r) => r.PICARETA.eligible).length,
  pickaxeNotEligible: rewards.filter((r) => !r.PICARETA.eligible).length,
  secondChanceEligible: rewards.filter((r) => r.SEGUNDA_CHANCE.eligible).length,
  mapsWithFewerThanTwoEligible: rewards.filter(
    (r) => [r.PICARETA.eligible, r.SEGUNDA_CHANCE.eligible, r.TERCEIRA.eligible].filter(Boolean).length < 2,
  ).length,
  sample: rewards.slice(0, 30),
});

// ------------------------------------------------------------- families -----
const famRows = rows.map((r) => {
  const tags = r.family.tags.slice();
  // Family D only when the breakable is genuinely significant.
  const dOk = r.breakables.length > 0 && r.breakables[0].breakableWallUtility >= 35;
  const filtered = tags.filter((t) => t !== "D_ATALHO_POTENCIAL" || dOk);
  // Family A is earned by a real contextual dilemma, not by a length gap: the
  // best route must genuinely change with the defenders' positions.
  const ctx = contextualDominance(r.map, r.zone, candidateRoutes(r.map).map((c) => ({ name: c.name, cells: c.cells })));
  const aOk = ctx.routeSwitchCount >= 2 && ctx.contextualTradeoffScore >= 0.2;
  const withA = filtered.filter((t) => t !== "A_DUAS_ROTAS");
  if (aOk && !withA.includes("A_DUAS_ROTAS")) withA.unshift("A_DUAS_ROTAS");
  return { route: r.routeNumber, difficulty: r.difficulty, seed: r.seed, tags: withA, primary: withA[0] ?? "SEM_IDENTIDADE", zoneAccesses: r.zone.portalAccessCount, breakableTop: r.breakables[0]?.breakableWallUtility ?? 0, contextualTradeoff: ctx.contextualTradeoffScore };
});
const famCount = {};
for (const f of famRows) for (const t of f.tags) famCount[t] = (famCount[t] ?? 0) + 1;

// --------------------------------------------------------- dual pressure ----
write("hunter-sentinel-interactions.json", {
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A-BALANCE",
  metric: "dualPressureDecision: a melhor jogada considerando SÓ o Caçador difere da melhor considerando SÓ o Sentinela, e a jogada com os dois difere de ambas",
  decisionsFound: dualDecisions.length,
  perRun: stats(agentResults.humanV3.map((r) => r.dualDecisions)),
  runsWithAtLeastOne: agentResults.humanV3.filter((r) => r.dualDecisions > 0).length,
  totalRuns: agentResults.humanV3.length,
  byRoute: Object.fromEntries(ROUTES.map((rn) => [`rota${rn}`, stats(
    agentResults.humanV3.filter((r) => r.route === rn).map((r) => r.dualDecisions),
  )])),
  examples: dualDecisions.slice(0, 40),
});

// -------------------------------------------------------------- readiness ---
const unsafeB = byClass.B;
const gates = {
  zeroFallback: rows.every((r) => !r.fallback),
  zeroInevitableTraps: unsafeB === 0,
  sentinelDistinctFromHunter: tuneRows.find((t) => t.name.includes("c3"))?.caughtSentinel > 0,
  sentinelRequiresReposition: rows.filter((r) => r.reposition.requiresReposition).length / rows.length >= 0.8,
  zeroMapsWithoutIdentity: famRows.every((f) => f.primary !== "SEM_IDENTIDADE"),
  realTradeoffs: tradeRows.filter((t) => t.hasRealTradeoff).length > 0,
  noUniversallyDominantRoute: tradeRows.every((t) => t.contextual.dominantAcrossStates === null),
  zeroUnsafeCoexistingTraps: trapAgg.every((t) => t.unsafeCombinations === 0),
  everyMapHasChestCandidate: rows.every((r) => r.chest.length > 0),
  pickaxeOnlyWhenUseful: rewards.every((r) => !r.PICARETA.eligible || r.PICARETA.maxImpact > 0),
  familyDOnlyWithBreakable: famRows.every((f) => !f.tags.includes("D_ATALHO_POTENCIAL") || f.breakableTop >= 35),
  dualDecisionsMeasurable: dualDecisions.length > 0,
  allMapsSolvable: rows.every((r) => r.route !== null),
};
write("final-runtime-readiness.json", {
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A-BALANCE",
  generatedAt: new Date().toISOString(),
  maps: rows.length,
  gates,
  allGatesPass: Object.values(gates).every(Boolean),
  familyCounts: famCount,
  mapsWithoutIdentity: famRows.filter((f) => f.primary === "SEM_IDENTIDADE").length,
  winRates: Object.fromEntries(Object.entries(agentResults).map(([k, v]) => [k, rate(v, (x) => x.outcome === "won")])),
  byRoute: Object.fromEntries(ROUTES.map((rn) => [`rota${rn}`, {
    dualDecisions: stats(agentResults.humanV3.filter((r) => r.route === rn).map((r) => r.dualDecisions)),
    won: rate(agentResults.humanV3.filter((r) => r.route === rn), (x) => x.outcome === "won"),
    tradeoffs: tradeRows.filter((t) => t.routeNumber === rn && t.hasRealTradeoff).length,
  }])),
});
write("map-family-analysis.json", {
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A-BALANCE",
  maps: famRows.length, counts: famCount,
  mapsWithoutIdentity: famRows.filter((f) => f.primary === "SEM_IDENTIDADE").length,
  familyDGate: "só aceita mapa com parede quebrável de utilidade >= 35",
  rows: famRows,
});
write("generation-performance.json", {
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A-BALANCE",
  samples: genTimes.length,
  maxGenerationAttempts: lab.api.MAX_GENERATION_ATTEMPTS,
  attempts: stats(genTimes.map((g) => g.attempts)),
  milliseconds: stats(genTimes.map((g) => g.ms)),
  worst: [...genTimes].sort((a, b) => b.ms - a.ms).slice(0, 10),
  fallbacks: rows.filter((r) => r.fallback).length,
});

console.log("\n=== GATES ===");
for (const [k, v] of Object.entries(gates)) console.log(` ${v ? "OK  " : "FAIL"} ${k}`);
console.log("\nvitória:", JSON.stringify(Object.fromEntries(Object.entries(agentResults).map(([k, v]) => [k, rate(v, (x) => x.outcome === "won")]))));
console.log("turnos inseguros:", unsafe.length, JSON.stringify(byClass));
console.log("done in", ((Date.now() - t0) / 1000).toFixed(1), "s");
