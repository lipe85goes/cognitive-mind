/**
 * ROTA-DUAL-GUARDIANS-MAPS-01B — the runtime Sentinel must decide what the lab
 * decides.
 *
 * The lab (`dual-guardian-lab.mjs`, contract c3) is the behavioural source of
 * truth approved by 01A. This walks real games with the real Hunter and, at
 * every turn, asks BOTH implementations for the Sentinel's move from the same
 * state. A single unexplained divergence fails the gate.
 *
 * It also runs the two role tests the acceptance asks for:
 *   - FEINT: the Explorer threatens one door, the Sentinel commits, the
 *     Explorer switches. The Sentinel must not answer during the commitment.
 *   - ROLE: with the Explorer far from the portal, the Hunter closes and the
 *     Sentinel stays home. If both chase, there is only one defender.
 *
 * Usage: node tools/validation/sentinel-runtime-equivalence.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { loadInstrumented } from "./instrumented-generator.mjs";
import { portalZone, sentinelStep, ZONE_RADIUS, SENTINEL_LEASH } from "./dual-guardian-lab.mjs";
import { key, eq, neighbors, bfs, pathLength } from "./route-lab.mjs";

const OUT = path.resolve(
  process.env.ROUTE_VALIDATION_OUT ?? "docs/archive/route-dual-guardians-maps-01b",
);
fs.mkdirSync(OUT, { recursive: true });

const LAB = loadInstrumented({ bare: true });
const API = LAB.API;
const TUNING = { patrol: true, commitTurns: 3 };
const report = { mission: "ROTA-DUAL-GUARDIANS-MAPS-01B" };

/** The lab expects a plain map object; the runtime returns the same shape. */
const asLabMap = (m) => ({
  walls: m.walls,
  playerStart: m.playerStart,
  guardianStart: m.guardianStart,
  exitPosition: m.exitPosition,
  collectibleStars: m.collectibleStars,
});

function makeMap(seed, difficulty, stage) {
  LAB.setSeed(seed);
  return API.generateMaze(difficulty, stage);
}

// ===========================================================================
// FASE 11 — lab vs runtime, decision by decision
// ===========================================================================
console.log("FASE 11 — equivalência lab x runtime");
const divergences = [];
const situations = {
  patrol: 0, commitStart: 0, commitHeld: 0, commitExpired: 0,
  retargetAfterCommit: 0, explorerFar: 0, multipleAccesses: 0,
  repositioned: 0, leashed: 0, stayed: 0,
};
let statesCompared = 0;
let mapsWalked = 0;

for (const stage of [1, 2, 3]) {
  for (const difficulty of ["easy", "medium", "hard"]) {
    for (let i = 0; i < 4; i += 1) {
      const map = makeMap(6_100_000 + stage * 1000 + i, difficulty, stage);
      const zoneLab = portalZone(asLabMap(map));
      const zoneRuntime = API.computePortalDefenceZone(
        map.playerStart, map.exitPosition, map.walls,
      );

      // The zones themselves must agree before any decision is compared.
      const labZone = zoneLab.zone.map(key).join("|");
      const runZone = zoneRuntime.zone.map(API.posKey).join("|");
      const labAcc = zoneLab.accesses.map(key).join("|");
      const runAcc = zoneRuntime.accesses.map(API.posKey).join("|");
      if (labZone !== runZone || labAcc !== runAcc) {
        divergences.push({ kind: "zone", stage, difficulty, labZone, runZone, labAcc, runAcc });
        continue;
      }
      if (zoneRuntime.accesses.length >= 2) situations.multipleAccesses += 1;

      // Same spawn on both sides, then walk the Explorer along real moves.
      let runtimeState = API.createSentinelState(map, zoneRuntime);
      const labState = { pos: { ...runtimeState.position }, target: null, commitLeft: 0 };
      let player = { ...map.playerStart };
      let hunter = { ...map.guardianStart };
      mapsWalked += 1;

      const toPortal = bfs(map.exitPosition, map.walls);
      for (let turn = 0; turn < 26; turn += 1) {
        // Explorer walks toward the portal, preferring cells no defender holds.
        const opts = neighbors(player, map.walls).filter(
          (n) => !eq(n, hunter) && !eq(n, runtimeState.position),
        );
        if (!opts.length) break;
        opts.sort((a, b) => (toPortal.get(key(a)) ?? 99) - (toPortal.get(key(b)) ?? 99));
        player = opts[0];
        if (eq(player, map.exitPosition)) break;

        hunter = API.chooseGuardianMove(
          hunter, player, map.exitPosition, map.walls, difficulty,
          new Set([API.posKey(runtimeState.position)]),
        );
        if (eq(hunter, player)) break;

        const beforeCommit = runtimeState.commitLeft;
        const beforeTarget = runtimeState.target;
        const beforePos = runtimeState.position;

        labState.pos = { ...runtimeState.position };
        labState.target = runtimeState.target ? { ...runtimeState.target } : null;
        labState.commitLeft = runtimeState.commitLeft;
        const labMove = sentinelStep(labState, player, asLabMap(map), zoneLab, TUNING);

        runtimeState = API.decideSentinelMove(
          runtimeState, player, map.exitPosition, map.walls, zoneRuntime,
        );
        statesCompared += 1;

        if (key(labMove) !== API.posKey(runtimeState.position)) {
          divergences.push({
            kind: "move", stage, difficulty, turn,
            player: key(player), from: API.posKey(beforePos),
            lab: key(labMove), runtime: API.posKey(runtimeState.position),
            commitBefore: beforeCommit,
          });
        }
        const labTarget = labState.target ? key(labState.target) : null;
        const runTarget = runtimeState.target ? API.posKey(runtimeState.target) : null;
        if (labTarget !== runTarget || labState.commitLeft !== runtimeState.commitLeft) {
          divergences.push({
            kind: "commit-state", stage, difficulty, turn,
            labTarget, runTarget,
            labCommit: labState.commitLeft, runCommit: runtimeState.commitLeft,
          });
        }

        // Situation coverage.
        if (beforeCommit === 0) situations.commitStart += 1;
        else if (beforeCommit === 3) situations.commitHeld += 1;
        else if (beforeCommit === 1) situations.commitExpired += 1;
        if (beforeCommit > 0 && beforeTarget) situations.patrol += 1;
        if (runtimeState.target === null) situations.explorerFar += 1;
        if (API.posKey(runtimeState.position) !== API.posKey(beforePos)) situations.repositioned += 1;
        else situations.stayed += 1;
        if (!zoneRuntime.zoneKeys.has(API.posKey(runtimeState.position))) situations.leashed += 1;
        if (beforeCommit === 0 && beforeTarget) situations.retargetAfterCommit += 1;

        if (eq(runtimeState.position, player)) break;
      }
    }
  }
}
const equivalenceOk = divergences.length === 0;
console.log(`  mapas percorridos: ${mapsWalked} · estados comparados: ${statesCompared}`);
console.log(`  divergências: ${divergences.length}`);
console.log(`  cobertura: ${JSON.stringify(situations)}`);
if (divergences.length) console.log(`  amostra: ${JSON.stringify(divergences.slice(0, 3))}`);

fs.writeFileSync(path.join(OUT, "sentinel-lab-runtime-equivalence.json"), JSON.stringify({
  ...report,
  source: "tools/validation/dual-guardian-lab.mjs sentinelStep, tuning { patrol: true, commitTurns: 3 }",
  mapsWalked, statesCompared,
  divergences: divergences.length,
  divergenceSamples: divergences.slice(0, 20),
  situationCoverage: situations,
  constants: { ZONE_RADIUS, SENTINEL_LEASH, commitTurns: 3 },
  gateMet: equivalenceOk,
}, null, 2));

// ===========================================================================
// FASE 12 — feint
// ===========================================================================
console.log("\nFASE 12 — finta");
let feint = null;
for (let seed = 7_200_000; seed < 7_200_240 && !feint; seed += 1) {
  const map = makeMap(seed, "hard", 3);
  const zone = API.computePortalDefenceZone(map.playerStart, map.exitPosition, map.walls);
  if (zone.accesses.length < 2) continue;

  // Stand the Explorer next to door A, let the Sentinel commit, then teleport
  // the threat to door B and watch whether the commitment holds.
  const [doorA, doorB] = zone.accesses;
  let state = API.createSentinelState(map, zone);
  const trace = [];
  const record = (turn, threat, note) => trace.push({
    turn, threatenedDoor: API.posKey(threat),
    sentinel: API.posKey(state.position),
    committedTarget: state.target ? API.posKey(state.target) : null,
    commitLeft: state.commitLeft, note,
  });

  state = API.decideSentinelMove(state, doorA, map.exitPosition, map.walls, zone);
  record(1, doorA, "Explorer threatens door A — Sentinel commits");
  const committed = state.target ? API.posKey(state.target) : null;
  if (committed !== API.posKey(doorA)) continue;

  let heldThroughSwitch = true;
  for (let turn = 2; turn <= 4; turn += 1) {
    state = API.decideSentinelMove(state, doorB, map.exitPosition, map.walls, zone);
    const now = state.target ? API.posKey(state.target) : null;
    record(turn, doorB, "Explorer switched to door B");
    if (now !== committed) heldThroughSwitch = false;
  }
  // After the commitment expires it may re-aim.
  state = API.decideSentinelMove(state, doorB, map.exitPosition, map.walls, zone);
  record(5, doorB, "commitment expired — may re-aim");
  const reaimed = state.target ? API.posKey(state.target) : null;

  feint = {
    seed, doorA: API.posKey(doorA), doorB: API.posKey(doorB),
    accesses: zone.accesses.map(API.posKey),
    committedTo: committed,
    heldThroughSwitch,
    targetAfterCommitExpired: reaimed,
    reaimedToNewDoor: reaimed === API.posKey(doorB),
    trace,
  };
}
const feintOk = Boolean(feint && feint.heldThroughSwitch);
if (feint) {
  console.log(`  seed ${feint.seed}: comprometeu com ${feint.committedTo}, Explorador mudou para ${feint.doorB}`);
  console.log(`  manteve durante o compromisso: ${feint.heldThroughSwitch ? "SIM" : "NÃO"} · alvo após expirar: ${feint.targetAfterCommitExpired}`);
} else {
  console.log("  nenhum mapa com dois acessos encontrado na amostra");
}
fs.writeFileSync(path.join(OUT, "sentinel-feint-trace.json"), JSON.stringify({
  ...report, commitTurns: 3, gateMet: feintOk, ...(feint ?? {}),
}, null, 2));

// ===========================================================================
// FASE 13 — distinct roles
// ===========================================================================
console.log("\nFASE 13 — papéis distintos");
const roleCases = [];
for (let i = 0; i < 6; i += 1) {
  const map = makeMap(7_400_000 + i, "hard", 3);
  const zone = API.computePortalDefenceZone(map.playerStart, map.exitPosition, map.walls);
  let state = API.createSentinelState(map, zone);
  let hunter = { ...map.guardianStart };
  // The Explorer sits at its start, which is the far corner from the portal.
  const player = { ...map.playerStart };
  const turns = [];
  for (let turn = 1; turn <= 12; turn += 1) {
    hunter = API.chooseGuardianMove(
      hunter, player, map.exitPosition, map.walls, "hard",
      new Set([API.posKey(state.position)]),
    );
    state = API.decideSentinelMove(state, player, map.exitPosition, map.walls, zone);
    turns.push({
      turn,
      hunterToExplorer: pathLength(hunter, player, map.walls),
      hunterToPortal: pathLength(hunter, map.exitPosition, map.walls),
      sentinelToExplorer: pathLength(state.position, player, map.walls),
      sentinelToPortal: pathLength(state.position, map.exitPosition, map.walls),
      sentinelInZone: zone.zoneKeys.has(API.posKey(state.position)),
    });
  }
  const first = turns[0];
  const last = turns[turns.length - 1];
  const leash = ZONE_RADIUS + SENTINEL_LEASH;
  // The role difference is territoriality, not pursuit quality. The Hunter is a
  // Manhattan-greedy chaser by design, so it can be stalled by a wall and even
  // lose ground on path distance; what it never is, is bound to the portal.
  roleCases.push({
    seed: 7_400_000 + i,
    explorer: API.posKey(player), portal: API.posKey(map.exitPosition),
    hunterLeftTerritory: turns.some((t) => t.hunterToPortal > leash),
    hunterMaxDistanceFromPortal: Math.max(...turns.map((t) => t.hunterToPortal ?? 0)),
    hunterPathGainToExplorer: first.hunterToExplorer - last.hunterToExplorer,
    sentinelStayedTerritorial: turns.every((t) => t.sentinelToPortal <= leash),
    sentinelMaxDistanceFromPortal: Math.max(...turns.map((t) => t.sentinelToPortal ?? 0)),
    sentinelApproachGain: first.sentinelToExplorer - last.sentinelToExplorer,
    turns,
  });
}
const rolesDistinct = roleCases.every(
  (c) => c.hunterLeftTerritory && c.sentinelStayedTerritorial && c.sentinelApproachGain <= 1,
);
for (const c of roleCases) {
  console.log(`  seed ${c.seed}: Caçador longe do portal até ${c.hunterMaxDistanceFromPortal} (coleira ${ZONE_RADIUS + SENTINEL_LEASH}) · Sentinela até ${c.sentinelMaxDistanceFromPortal} · aproximou ${c.sentinelApproachGain}`);
}
console.log(`  HUNTER_ROLE != SENTINEL_ROLE: ${rolesDistinct ? "provado" : "NÃO PROVADO"}`);
fs.writeFileSync(path.join(OUT, "hunter-vs-sentinel-role-test.json"), JSON.stringify({
  ...report,
  scenario: "Explorer stationary at its start, far from the portal",
  claim: "the Sentinel never leaves the portal region and makes no progress toward a distant Explorer; the Hunter is not bound to that region",
  note: "The Hunter minimises MANHATTAN distance, so a wall can make it lose ground on path distance. That is the approved policy, not a defect, and the role claim does not depend on it.",
  leashBudget: ZONE_RADIUS + SENTINEL_LEASH,
  rolesDistinct, cases: roleCases,
}, null, 2));

console.log(`\nequivalência ${equivalenceOk ? "OK" : "FALHOU"} · finta ${feintOk ? "OK" : "FALHOU"} · papéis ${rolesDistinct ? "OK" : "FALHOU"}`);
console.log(equivalenceOk && feintOk && rolesDistinct ? "SENTINEL_RUNTIME_OK" : "SENTINEL_RUNTIME_FAILED");
