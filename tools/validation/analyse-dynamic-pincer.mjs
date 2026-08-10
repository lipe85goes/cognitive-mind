/**
 * ROTA-DUAL-GUARDIANS-MAPS-01A-FINAL — dynamic pincer analysis.
 *
 * The topological gate (`routeCellsHaveEscape`) proved the MAP always has a way
 * round. It cannot prove the same about a STATE: defenders occupy cells, and
 * occupation is not a wall. Two defenders converging on a cell with only two
 * ways out seal it without any wall being involved.
 *
 * This explores states the game can actually reach — real move rules, the real
 * Hunter policy, the candidate Sentinel policy — and separates:
 *
 *   PLAYER-CAUSED TACTICAL TRAP — a recent state offered >= 2 reasonable moves
 *   and one of them avoided the sequence. Allowed, and good design.
 *
 *   SYSTEM-CAUSED INEVITABLE PINCER — no reasonable earlier choice avoided it.
 *   Forbidden.
 *
 * Usage:
 *   node tools/validation/analyse-dynamic-pincer.mjs --seeds 6
 *   node tools/validation/analyse-dynamic-pincer.mjs --case 5883 --route 2 --difficulty medium
 */
import fs from "node:fs";
import path from "node:path";
import {
  loadLab, objectiveRoute, stats, key, eq, neighbors, bfs,
  DIFFICULTIES, ROUTES,
} from "./route-lab.mjs";
import { portalZone, sentinelStep } from "./dual-guardian-lab.mjs";
import { makeHumanV3, safeMoves } from "./dual-guardian-balance.mjs";

const arg = (n, d) => { const i = process.argv.indexOf(n); return i === -1 ? d : process.argv[i + 1]; };
const SEEDS = Number(arg("--seeds", 6));
const HORIZON = Number(arg("--horizon", 4));
// --only route3-hard : targeted revalidation when only the generation
// mechanism changed and the accepted topology did not.
const ONLY = arg("--only", null);
const OUT = path.resolve("docs/archive/route-dual-guardians-maps-01a");
fs.mkdirSync(OUT, { recursive: true });
const write = (n, d) => { fs.writeFileSync(path.join(OUT, n), JSON.stringify(d, null, 2)); console.log("  wrote", n); };

const lab = loadLab();
const TUNING = { patrol: true, commitTurns: 3 };

/** One analysable state of the dual game. */
const stateKey = (s) =>
  `${key(s.explorer)}|${key(s.hunter)}|${key(s.sentinel)}|${s.commitRemaining}|${s.lightsLeft}`;

function advance(state, move, map, zone, difficulty) {
  const explorer = move;
  if (eq(explorer, state.hunter) || eq(explorer, state.sentinel)) return null;
  const lights = state.lights.filter((l) => !eq(l, explorer));
  const hunter = lab.api.chooseGuardianMove(state.hunter, explorer, map.exitPosition, map.walls, difficulty);
  if (eq(explorer, hunter)) return null;
  const sState = { pos: state.sentinel, target: state.committedAccess, commitLeft: state.commitRemaining };
  const sentinel = sentinelStep(sState, explorer, map, zone, TUNING);
  if (eq(explorer, sentinel)) return null;
  return {
    explorer, hunter, sentinel,
    committedAccess: sState.target,
    commitRemaining: sState.commitLeft,
    lights, lightsLeft: lights.length,
  };
}

/**
 * Classify a state by what continuations it still has.
 *   A safe · B risky but alive · C only capture · D no legal move
 */
function classifyState(state, map, zone, difficulty, depth) {
  const legal = neighbors(state.explorer, map.walls).filter(
    (n) => !eq(n, state.hunter) && !eq(n, state.sentinel),
  );
  if (legal.length === 0) return { klass: "D", legal: 0, safe: 0 };
  const safe = safeMoves(state.explorer, map, [state.hunter, state.sentinel]);
  if (safe.length > 0) return { klass: "A", legal: legal.length, safe: safe.length };

  const alive = (s, d) => {
    if (d === 0) return true;
    const opts = neighbors(s.explorer, map.walls);
    for (const m of opts) {
      const next = advance(s, m, map, zone, difficulty);
      if (next && alive(next, d - 1)) return true;
    }
    return false;
  };
  return alive(state, depth)
    ? { klass: "B", legal: legal.length, safe: 0 }
    : { klass: "C", legal: legal.length, safe: 0 };
}

/**
 * Responsibility counterfactual.
 *
 * The question is not "did the Explorer have two legal moves" — it is the one
 * the mission poses: was there a REASONABLE action, using only visible
 * information, that kept progress AND avoided the pincer?
 *
 * Three things make an alternative reasonable, and all three are checked:
 *
 *   1. it survives — the state it leads to still has a continuation (A or B);
 *   2. it does not lose ground — distance to the current objective does not
 *      grow. A move that runs away from the goal is not "progress", it is the
 *      circling that humanV2 was rejected for;
 *   3. it leads somewhere recoverable — the cell it reaches, or a neighbour of
 *      it, has three or more ways out. That is a recovery node: somewhere two
 *      defenders cannot seal.
 *
 * Stepping off a recovery node into a degree-1 or degree-2 pocket, while such
 * an alternative existed, is a voluntary risk. The map is not obliged to
 * protect it — the mission is explicit that tactical traps the player walks
 * into are good design, and that the game must be able to punish a bad choice.
 */
function playerCouldHaveAvoided(trail, map, zone, difficulty) {
  // Scope is the whole play, not a window. The question is "was there ANY
  // earlier reasonable action", and the decision that matters is often the one
  // that entered a region, not the last step inside it: in R1/medium/5711 the
  // Explorer had every light and the portal behind it, walked into the opposite
  // corner over ten turns, and only then met a dead end. A 10-turn window could
  // not see the choice that mattered and called the map guilty.
  const evidence = [];
  const from = 0;

  for (let i = from; i < trail.length - 1; i += 1) {
    const s = trail[i];
    const goal = s.lights.length ? s.lights[0] : map.exitPosition;
    const toGoal = bfs(goal, map.walls);
    const hereDistance = toGoal.get(key(s.explorer)) ?? 99;
    const takenNext = trail[i + 1];

    let reasonableAlternatives = 0;
    let safeAlternative = null;

    for (const m of neighbors(s.explorer, map.walls)) {
      const next = advance(s, m, map, zone, difficulty);
      if (!next) continue;
      const c = classifyState(next, map, zone, difficulty, 2);
      if (c.klass === "C" || c.klass === "D") continue;

      // Does not lose ground toward the current objective.
      const keepsProgress = (toGoal.get(key(m)) ?? 99) <= hereDistance + 1;
      // Reaches, or touches, somewhere two defenders cannot seal.
      const width = neighbors(m, map.walls).length;
      const touchesRecoveryNode =
        width >= 3 || neighbors(m, map.walls).some((n) => neighbors(n, map.walls).length >= 3);

      if (keepsProgress && touchesRecoveryNode) {
        reasonableAlternatives += 1;
        // An alternative only counts as "the one that avoided it" if it is a
        // genuinely different move from the one actually taken.
        if (c.klass === "A" && takenNext && !eq(m, takenNext.explorer)) {
          safeAlternative = { move: key(m), width, distance: toGoal.get(key(m)) ?? 99 };
        }
      }
    }

    if (reasonableAlternatives >= 1 && safeAlternative) {
      evidence.push({
        atTurn: i,
        from: key(s.explorer),
        fromWidth: neighbors(s.explorer, map.walls).length,
        took: takenNext ? key(takenNext.explorer) : null,
        tookWidth: takenNext ? neighbors(takenNext.explorer, map.walls).length : null,
        alternative: safeAlternative,
        reasonableAlternatives,
        distanceToGoal: hereDistance,
      });
    }
  }

  return {
    avoidable: evidence.length > 0,
    atTurn: evidence.length ? evidence[evidence.length - 1].atTurn : null,
    evidence: evidence.slice(-3),
  };
}

/** Explore reachable states along plays driven by humanV3 plus forced probes. */
function exploreMap(map, zone, difficulty, budget = 2600) {
  const seen = new Set();
  const pressure = [];
  let explored = 0;
  let maxHorizon = 0;

  const start = {
    explorer: { ...map.playerStart },
    hunter: { ...map.guardianStart },
    sentinel: zone.zone.find((c) => !eq(c, map.exitPosition)) ?? { ...map.exitPosition },
    committedAccess: null, commitRemaining: 0,
    lights: map.collectibleStars.map((l) => ({ ...l })),
    lightsLeft: map.collectibleStars.length,
  };

  // Several plays: humanV3 and deliberately greedier/wider variants, so the
  // exploration includes states a real player could stumble into.
  const agents = [
    makeHumanV3(zone, { lookahead: 3 }),
    makeHumanV3(zone, { lookahead: 2, patienceTurns: 2 }),
    makeHumanV3(zone, { lookahead: 3, patienceTurns: 12 }),
  ];

  for (let a = 0; a < agents.length && explored < budget; a += 1) {
    let state = { ...start, lights: start.lights.map((l) => ({ ...l })) };
    const trail = [state];
    for (let turn = 0; turn < 90 && explored < budget; turn += 1) {
      const k = stateKey(state);
      if (!seen.has(k)) {
        seen.add(k);
        explored += 1;
        const c = classifyState(state, map, zone, difficulty, HORIZON);
        maxHorizon = Math.max(maxHorizon, HORIZON);
        if (c.klass === "C" || c.klass === "D") {
          const verdict = playerCouldHaveAvoided(trail, map, zone, difficulty);
          pressure.push({
            turn, ...c,
            explorer: key(state.explorer), hunter: key(state.hunter), sentinel: key(state.sentinel),
            lightsLeft: state.lightsLeft,
            explorerDegree: neighbors(state.explorer, map.walls).length,
            inPortalZone: zone.zoneKeys.has(key(state.explorer)),
            verdict: verdict.avoidable ? "PLAYER_CAUSED" : "SYSTEM_CAUSED",
            avoidableAtTurn: verdict.atTurn,
            counterfactual: verdict.evidence,
          });
        }
      }
      if (!state.lightsLeft && eq(state.explorer, map.exitPosition)) break;
      const move = agents[a](state.explorer, state.lights, map, [state.hunter, state.sentinel]);
      const next = advance(state, move, map, zone, difficulty);
      if (!next) break;
      state = next;
      trail.push(state);
      // Keep the whole trail: the counterfactual scopes to the entire play.
    }
  }
  return { explored, pressure, maxHorizon };
}

// --------------------------------------------------------------------- run ---
const KNOWN = [
  { seed: 5883, routeNumber: 2, difficulty: "medium", label: "R2/medium/5883" },
  { seed: 7477, routeNumber: 3, difficulty: "hard", label: "R3/hard/7477" },
  { seed: 5659, routeNumber: 1, difficulty: "medium", label: "R1/medium/5659 (sem identidade)" },
  { seed: 7055, routeNumber: 1, difficulty: "hard", label: "R1/hard/7055 (pincer aberto)" },
  { seed: 7266, routeNumber: 2, difficulty: "hard", label: "R2/hard/7266 (pincer aberto)" },
];

console.log("reproducing known cases...");
const reproductions = [];
for (const c of KNOWN) {
  const { map, generation } = lab.generate(c.difficulty, c.routeNumber, c.seed);
  const zone = portalZone(map);
  const route = objectiveRoute(map);
  const res = exploreMap(map, zone, c.difficulty, 1400);
  const sys = res.pressure.filter((p) => p.verdict === "SYSTEM_CAUSED");
  reproductions.push({
    ...c,
    rejectedByGeneration: generation.fallback,
    portalAccesses: zone.portalAccessCount,
    objectiveMoves: route?.moves ?? null,
    statesExplored: res.explored,
    pressureStates: res.pressure.length,
    playerCaused: res.pressure.filter((p) => p.verdict === "PLAYER_CAUSED").length,
    systemCaused: sys.length,
    // Geometry of the collapse: this is what a cheap gate has to key on.
    systemCausedGeometry: sys.slice(0, 6).map((p) => ({
      explorer: p.explorer, degree: p.explorerDegree, inPortalZone: p.inPortalZone,
      hunter: p.hunter, sentinel: p.sentinel, klass: p.klass, legal: p.legal,
    })),
    playerCausedEvidence: res.pressure
      .filter((p) => p.verdict === "PLAYER_CAUSED")
      .slice(0, 4)
      .map((p) => ({ explorer: p.explorer, degree: p.explorerDegree, counterfactual: p.counterfactual })),
  });
  console.log(`  ${c.label}: ${res.explored} estados, ${res.pressure.length} sob pressão, ${sys.length} sistêmicos`);
}
write("dynamic-pincer-reproduction.json", {
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A-FINAL",
  horizon: HORIZON, tuning: TUNING, cases: reproductions,
});

// Degree distribution of collapse cells across a sample: the general signature.
console.log(`\ndeep sample: ${SEEDS} seeds x 9 combinations...`);
const deep = [];
const t0 = Date.now();
for (const routeNumber of ROUTES) {
  for (const difficulty of DIFFICULTIES) {
    if (ONLY && ONLY !== `route${routeNumber}-${difficulty}`) continue;
    for (let s = 0; s < SEEDS; s += 1) {
      const seed = 4_000 + s * 13 + routeNumber * 211 + DIFFICULTIES.indexOf(difficulty) * 1409;
      const { map, generation } = lab.generate(difficulty, routeNumber, seed);
      const zone = portalZone(map);
      const t = Date.now();
      const res = exploreMap(map, zone, difficulty, 1200);
      deep.push({
        routeNumber, difficulty, seed, fallback: generation.fallback,
        ms: Date.now() - t, statesExplored: res.explored,
        pressureStates: res.pressure.length,
        playerCaused: res.pressure.filter((p) => p.verdict === "PLAYER_CAUSED").length,
        systemCaused: res.pressure.filter((p) => p.verdict === "SYSTEM_CAUSED").length,
        zeroLegal: res.pressure.filter((p) => p.klass === "D").length,
        collapseDegrees: res.pressure.map((p) => p.explorerDegree),
        collapseInZone: res.pressure.filter((p) => p.inPortalZone).length,
      });
    }
  }
}
const allDegrees = deep.flatMap((d) => d.collapseDegrees);
const degreeHist = {};
for (const g of allDegrees) degreeHist[g] = (degreeHist[g] ?? 0) + 1;

write(ONLY ? "route3-hard-dynamic-final.json" : "dynamic-large-sample.json", {
  mission: "ROTA-DUAL-GUARDIANS-MAPS-01A-FINAL",
  maps: deep.length, seedsPerCombination: SEEDS, horizon: HORIZON,
  elapsedMs: Date.now() - t0,
  statesExplored: stats(deep.map((d) => d.statesExplored)),
  msPerMap: stats(deep.map((d) => d.ms)),
  totals: {
    pressureStates: deep.reduce((a, d) => a + d.pressureStates, 0),
    playerCaused: deep.reduce((a, d) => a + d.playerCaused, 0),
    systemCaused: deep.reduce((a, d) => a + d.systemCaused, 0),
    zeroLegalMoveStates: deep.reduce((a, d) => a + d.zeroLegal, 0),
    collapseInsidePortalZone: deep.reduce((a, d) => a + d.collapseInZone, 0),
  },
  collapseCellDegreeHistogram: degreeHist,
  gate_zeroSystemCaused: deep.every((d) => d.systemCaused === 0),
  offenders: deep.filter((d) => d.systemCaused > 0).map((d) => ({
    route: d.routeNumber, difficulty: d.difficulty, seed: d.seed, systemCaused: d.systemCaused,
  })),
});

console.log("\n=== resultado ===");
console.log("estados explorados (mediana):", stats(deep.map((d) => d.statesExplored))?.median);
console.log("sob pressão:", deep.reduce((a, d) => a + d.pressureStates, 0));
console.log("PLAYER_CAUSED:", deep.reduce((a, d) => a + d.playerCaused, 0));
console.log("SYSTEM_CAUSED:", deep.reduce((a, d) => a + d.systemCaused, 0));
console.log("grau das células de colapso:", JSON.stringify(degreeHist));
console.log("tempo/mapa mediana:", stats(deep.map((d) => d.ms))?.median, "ms");
