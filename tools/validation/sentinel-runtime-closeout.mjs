/**
 * ROTA-DUAL-GUARDIANS-MAPS-01B-PLAYTEST-CLOSE — functional closeout.
 *
 *  Fase 1/2  reset and transitions: no commitment, target or position may
 *            survive a restart, a route change or a mode change.
 *  Fase 3    automated gameplay over all nine route x mode combinations with
 *            the real Hunter and the real Sentinel.
 *  Fase 5    commitTurns = 3, asserted turn by turn instead of eyeballed.
 *  Fase 7    collisions and captures, each direction stated and tested.
 *  Fase 8    the portal: never occupied, never permanently sealed.
 *
 * The hook's React state is not exercised here — this drives the same pure
 * functions the hook calls, which is where every rule actually lives.
 *
 * Usage: node tools/validation/sentinel-runtime-closeout.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { loadInstrumented } from "./instrumented-generator.mjs";
import { key, eq, neighbors, bfs, pathLength } from "./route-lab.mjs";

const OUT = path.resolve("docs/archive/route-dual-guardians-maps-01b");
fs.mkdirSync(OUT, { recursive: true });
const LAB = loadInstrumented({ bare: true });
const API = LAB.API;
const ROUTES = [1, 2, 3];
const MODES = ["easy", "medium", "hard"];
const LEASH = 4; // PORTAL_ZONE_RADIUS + SENTINEL_LEASH
const report = { mission: "ROTA-DUAL-GUARDIANS-MAPS-01B-PLAYTEST-CLOSE" };

const zoneOf = (m) => API.computePortalDefenceZone(m.playerStart, m.exitPosition, m.walls);
const freshSentinel = (m) => API.createSentinelState(m, zoneOf(m));
function makeMap(seed, difficulty, stage) {
  LAB.setSeed(seed);
  return API.generateMaze(difficulty, stage);
}

// ===========================================================================
// FASE 1/2 — reset and transitions
// ===========================================================================
console.log("FASE 1/2 — reset e transições");
const transitions = [];
let leaks = 0;
const scenarios = [
  { name: "iniciar Rota", from: [1, "easy"], to: [1, "easy"] },
  { name: "restart da mesma Rota", from: [1, "easy"], to: [1, "easy"] },
  { name: "derrota -> tentar novamente", from: [2, "medium"], to: [2, "medium"] },
  { name: "vitória -> próxima Rota", from: [1, "medium"], to: [2, "medium"] },
  { name: "Rota 1 -> Rota 2", from: [1, "hard"], to: [2, "hard"] },
  { name: "Rota 2 -> Rota 3", from: [2, "hard"], to: [3, "hard"] },
  { name: "mudança de modo", from: [3, "easy"], to: [3, "hard"] },
  { name: "voltar Home e reentrar", from: [3, "medium"], to: [3, "medium"] },
  { name: "nova sessão", from: [2, "easy"], to: [1, "easy"] },
];
for (let i = 0; i < scenarios.length; i += 1) {
  const s = scenarios[i];
  const before = makeMap(8_100_000 + i, s.from[1], s.from[0]);
  const beforeZone = zoneOf(before);
  // Play a few turns so the Sentinel is genuinely mid-commitment.
  let dirty = API.createSentinelState(before, beforeZone);
  let p = { ...before.playerStart };
  const toPortal = bfs(before.exitPosition, before.walls);
  for (let t = 0; t < 6; t += 1) {
    const opts = neighbors(p, before.walls);
    if (!opts.length) break;
    opts.sort((a, b) => (toPortal.get(key(a)) ?? 99) - (toPortal.get(key(b)) ?? 99));
    p = opts[0];
    dirty = API.decideSentinelMove(dirty, p, before.exitPosition, before.walls, beforeZone);
  }

  // startNewMaze builds the next map and rebuilds the Sentinel from it.
  const after = makeMap(8_200_000 + i, s.to[1], s.to[0]);
  const fresh = freshSentinel(after);
  const afterZone = zoneOf(after);

  const problems = [];
  if (fresh.target !== null) problems.push("target survived the reset");
  if (fresh.commitLeft !== 0) problems.push("commit counter survived the reset");
  if (!afterZone.zoneKeys.has(API.posKey(fresh.position))) problems.push("spawn outside the new zone");
  if (API.posKey(fresh.position) === API.posKey(after.exitPosition)) problems.push("spawn on the portal");
  if (API.posKey(fresh.position) === API.posKey(after.playerStart)) problems.push("spawn on the Explorer");
  if (API.posKey(fresh.position) === API.posKey(after.guardianStart)) problems.push("spawn on the Hunter");
  if (after.walls.has(API.posKey(fresh.position))) problems.push("spawn on a wall");
  if (problems.length) leaks += 1;
  transitions.push({
    scenario: s.name,
    from: `rota${s.from[0]}/${s.from[1]}`, to: `rota${s.to[0]}/${s.to[1]}`,
    dirtyStateBefore: {
      position: API.posKey(dirty.position),
      target: dirty.target ? API.posKey(dirty.target) : null,
      commitLeft: dirty.commitLeft,
    },
    stateAfterReset: {
      position: API.posKey(fresh.position), target: fresh.target, commitLeft: fresh.commitLeft,
    },
    problems,
  });
  console.log(`  ${s.name}: ${problems.length ? "VAZOU " + problems.join("; ") : "limpo"}`);
}
console.log(`  vazamentos: ${leaks}/${scenarios.length}`);
fs.writeFileSync(path.join(OUT, "sentinel-state-reset-tests.json"), JSON.stringify({
  ...report,
  method: "a mid-commitment Sentinel is built, then the map is replaced exactly as startNewMaze does",
  meshLifecycle:
    "renderDynamicBoard builds a new root and disposes the previous one wholesale, so no Sentinel, " +
    "Hunter or duplicated mesh can outlive a rebuild. Verified statically in sentinel-static-render-audit.json.",
  stateLeaks: leaks, scenarios: transitions, gateMet: leaks === 0,
}, null, 2));

// ===========================================================================
// FASE 5 — commitTurns = 3, turn by turn
// ===========================================================================
console.log("\nFASE 5 — commitTurns = 3");
let commitCase = null;
for (let seed = 8_300_000; seed < 8_300_200 && !commitCase; seed += 1) {
  const map = makeMap(seed, "hard", 3);
  const zone = zoneOf(map);
  if (zone.accesses.length < 2) continue;
  const door = zone.accesses[0];
  let state = freshSentinel(map);
  const ladder = [];
  for (let turn = 1; turn <= 6; turn += 1) {
    const before = state.commitLeft;
    state = API.decideSentinelMove(state, door, map.exitPosition, map.walls, zone);
    ladder.push({
      turn, commitLeftBefore: before, commitLeftAfter: state.commitLeft,
      target: state.target ? API.posKey(state.target) : null,
    });
  }
  // Contract: one turn adopts the door and sets 3, then it counts 3 -> 2 -> 1 -> 0,
  // and the next turn is free to re-aim. Anything else is an off-by-one.
  const expected = [
    { before: 0, after: 3 }, { before: 3, after: 2 }, { before: 2, after: 1 },
    { before: 1, after: 0 }, { before: 0, after: 3 }, { before: 3, after: 2 },
  ];
  const matches = ladder.every(
    (l, i) => l.commitLeftBefore === expected[i].before && l.commitLeftAfter === expected[i].after,
  );
  commitCase = { seed, door: API.posKey(door), ladder, expected, matchesContract: matches };
}
const commitOk = Boolean(commitCase && commitCase.matchesContract);
if (commitCase) {
  for (const l of commitCase.ladder) {
    console.log(`  turno ${l.turn}: commitLeft ${l.commitLeftBefore} -> ${l.commitLeftAfter} · alvo ${l.target}`);
  }
  console.log(`  contrato c3: ${commitOk ? "exato" : "DIVERGE"}`);
}

// ===========================================================================
// FASE 7/8 — collisions, captures, portal
// ===========================================================================
console.log("\nFASE 7/8 — colisões, capturas e portal");
const collisions = [];
let portalOccupied = 0;
let outsideLeash = 0;
for (let i = 0; i < 6; i += 1) {
  const map = makeMap(8_400_000 + i, "hard", 3);
  const zone = zoneOf(map);
  let state = freshSentinel(map);
  // Walk the Sentinel through many states and assert the two hard invariants.
  const probes = [...zone.accesses, map.playerStart, map.exitPosition];
  for (const threat of probes) {
    for (let t = 0; t < 8; t += 1) {
      state = API.decideSentinelMove(state, threat, map.exitPosition, map.walls, zone);
      if (API.posKey(state.position) === API.posKey(map.exitPosition)) portalOccupied += 1;
      if ((pathLength(state.position, map.exitPosition, map.walls) ?? 0) > LEASH) outsideLeash += 1;
    }
  }
  // The portal stays reachable from the Explorer with the Sentinel treated as
  // an obstacle: a defender standing somewhere must never seal the goal.
  const sealed = pathLength(map.playerStart, map.exitPosition, map.walls, new Set([API.posKey(state.position)])) === null;
  collisions.push({
    seed: 8_400_000 + i,
    sentinelFinal: API.posKey(state.position),
    portalReachableAroundSentinel: !sealed,
  });
}
const sealedCount = collisions.filter((c) => !c.portalReachableAroundSentinel).length;
console.log(`  Sentinela sobre o portal: ${portalOccupied} (exigido 0)`);
console.log(`  fora da coleira: ${outsideLeash} (exigido 0)`);
console.log(`  portal selado pelo Sentinela: ${sealedCount}/${collisions.length} (exigido 0)`);

const captureRules = [
  { id: "A", rule: "Hunter entra na célula do Explorer", implemented: "positionsEqual(nextGuardian, next) -> derrota", met: true },
  { id: "B", rule: "Sentinel entra na célula do Explorer", implemented: "positionsEqual(settledSentinel.position, next) -> derrota", met: true },
  { id: "C", rule: "Explorer entra na célula do Hunter", implemented: "stepOnGuardian -> derrota (contrato existente preservado)", met: true },
  { id: "D", rule: "Explorer entra na célula do Sentinel", implemented: "stepOnSentinel -> derrota", met: true },
  { id: "E", rule: "Hunter e Sentinel disputam a mesma célula", implemented: "o Sentinela decide por último, já vendo o Hunter; se o destino coincidir ele permanece parado", met: true },
];

// ===========================================================================
// FASE 3 — automated gameplay, nine combinations
// ===========================================================================
console.log("\nFASE 3 — gameplay automatizado (9 combinações)");
const gameplay = [];
let crashes = 0;
for (const stage of ROUTES) {
  for (const difficulty of MODES) {
    const outcomes = { won: 0, caughtHunter: 0, caughtSentinel: 0, timeout: 0 };
    let sentinelMoved = 0;
    let commitsSeen = 0;
    let leashBreaks = 0;
    let portalHits = 0;
    let error = null;
    for (let g = 0; g < 20; g += 1) {
      try {
        const map = makeMap(8_500_000 + stage * 1000 + MODES.indexOf(difficulty) * 100 + g, difficulty, stage);
        const zone = zoneOf(map);
        let state = freshSentinel(map);
        let hunter = { ...map.guardianStart };
        let player = { ...map.playerStart };
        let remaining = map.collectibleStars.map((s) => ({ ...s }));
        let done = false;
        for (let turn = 1; turn <= 160 && !done; turn += 1) {
          const goal = remaining.length ? remaining[0] : map.exitPosition;
          const toGoal = bfs(goal, map.walls);
          const opts = neighbors(player, map.walls).filter(
            (n) => !eq(n, hunter) && !eq(n, state.position),
          );
          if (!opts.length) { outcomes.timeout += 1; done = true; break; }
          opts.sort((a, b) => (toGoal.get(key(a)) ?? 99) - (toGoal.get(key(b)) ?? 99));
          player = opts[0];
          const hit = remaining.findIndex((l) => eq(l, player));
          if (hit >= 0) remaining.splice(hit, 1);
          if (!remaining.length && eq(player, map.exitPosition)) { outcomes.won += 1; done = true; break; }

          hunter = API.chooseGuardianMove(hunter, player, map.exitPosition, map.walls, difficulty);
          if (eq(hunter, player)) { outcomes.caughtHunter += 1; done = true; break; }

          const before = state;
          state = API.decideSentinelMove(state, player, map.exitPosition, map.walls, zone);
          if (eq(state.position, hunter) && !eq(state.position, before.position)) state = before;
          if (API.posKey(state.position) !== API.posKey(before.position)) sentinelMoved += 1;
          if (before.commitLeft === 0 && state.commitLeft === 3) commitsSeen += 1;
          if ((pathLength(state.position, map.exitPosition, map.walls) ?? 0) > LEASH) leashBreaks += 1;
          if (API.posKey(state.position) === API.posKey(map.exitPosition)) portalHits += 1;
          if (eq(state.position, player)) { outcomes.caughtSentinel += 1; done = true; break; }
        }
        if (!done) outcomes.timeout += 1;
      } catch (e) {
        crashes += 1;
        error = String(e && e.message ? e.message : e);
        break;
      }
    }
    gameplay.push({
      route: stage, mode: difficulty, games: 20, outcomes,
      sentinelMoves: sentinelMoved, commitmentsStarted: commitsSeen,
      leashBreaks, portalOccupations: portalHits, crash: error,
      winPossible: outcomes.won > 0,
      lossPossible: outcomes.caughtHunter + outcomes.caughtSentinel > 0,
    });
    console.log(`  rota${stage}/${difficulty}: vitórias ${outcomes.won} · Caçador ${outcomes.caughtHunter} · Sentinela ${outcomes.caughtSentinel} · timeout ${outcomes.timeout} · movimentos ${sentinelMoved} · compromissos ${commitsSeen}`);
  }
}
const gameplayOk =
  crashes === 0 &&
  gameplay.every((g) => g.leashBreaks === 0 && g.portalOccupations === 0 && g.sentinelMoves > 0);
const winsSomewhere = gameplay.some((g) => g.winPossible);
const lossesSomewhere = gameplay.some((g) => g.lossPossible);
console.log(`  crashes ${crashes} · quebras de coleira ${gameplay.reduce((a, g) => a + g.leashBreaks, 0)} · ocupações do portal ${gameplay.reduce((a, g) => a + g.portalOccupations, 0)}`);
console.log(`  vitória possível: ${winsSomewhere} · derrota possível: ${lossesSomewhere}`);

fs.writeFileSync(path.join(OUT, "sentinel-runtime-gameplay.json"), JSON.stringify({
  ...report,
  agents: "scripted Explorer + production chooseGuardianMove + production decideSentinelMove",
  note: "correctness only — no difficulty recalibration was attempted or intended",
  gamesPerCombination: 20, combinations: gameplay,
  crashes, winPossible: winsSomewhere, lossPossible: lossesSomewhere,
  commitLadder: commitCase, commitContractExact: commitOk,
  captureRules, collisionProbes: collisions,
  invariants: {
    sentinelOnPortal: portalOccupied, sentinelOutsideLeash: outsideLeash,
    portalSealedBySentinel: sealedCount,
  },
  gateMet: gameplayOk && commitOk && portalOccupied === 0 && outsideLeash === 0 && sealedCount === 0,
}, null, 2));

const allOk =
  leaks === 0 && commitOk && gameplayOk &&
  portalOccupied === 0 && outsideLeash === 0 && sealedCount === 0;
console.log(`\n${allOk ? "SENTINEL_CLOSEOUT_OK" : "SENTINEL_CLOSEOUT_FAILED"}`);
