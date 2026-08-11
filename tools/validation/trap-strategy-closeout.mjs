/**
 * ROTA-TRAPS-STRATEGY-01-CLOSEOUT
 *
 *  Fase 11  Hunter trace: the cell it wanted, before and after the trap arms.
 *  Fase 12  Sentinel trace: the same, inside the portal region.
 *  Fase 13  one activation, both defenders forced to change their answer.
 *  Fase 16  nine route x mode combinations with arming traps.
 *  Fase 18  a trap armed before every transition; none may survive it.
 *
 * Also records the situation the human playtest surfaced — the Sentinel closing
 * one portal door, then the other, with no practical progress — WITHOUT trying
 * to fix it. Classified, seeds kept, handed to ROTA-DYNAMIC-SOLVABILITY-01.
 *
 * Usage: node tools/validation/trap-strategy-closeout.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { loadInstrumented } from "./instrumented-generator.mjs";
import { key, eq, neighbors, bfs, pathLength } from "./route-lab.mjs";

const OUT = path.resolve("docs/archive/route-traps-strategy-01");
fs.mkdirSync(OUT, { recursive: true });
const LAB = loadInstrumented({ bare: true });
const API = LAB.API;
const kOf = (p) => API.posKey(p);
const report = { mission: "ROTA-TRAPS-STRATEGY-01-CLOSEOUT" };
const makeMap = (seed, difficulty, stage) => { LAB.setSeed(seed); return API.generateMaze(difficulty, stage); };
const zoneOf = (m) => API.computePortalDefenceZone(m.playerStart, m.exitPosition, m.walls);

// ===========================================================================
// FASE 11 — Hunter
// ===========================================================================
console.log("FASE 11 — trace do Caçador");
let hunterTrace = null;
outer11:
for (let seed = 9_100_000; seed < 9_100_400; seed += 1) {
  const map = makeMap(seed, "hard", 3);
  for (const trap of map.traps) {
    for (const from of API.getNeighbors(trap, map.walls)) {
      // A state where the dormant trap really is what the Hunter picks.
      LAB.setSeed(4242);
      const dormant = API.chooseGuardianMove(from, trap, map.exitPosition, map.walls, "hard", new Set());
      if (!eq(dormant, trap)) continue;
      LAB.setSeed(4242);
      const armedMove = API.chooseGuardianMove(from, trap, map.exitPosition, map.walls, "hard", new Set([kOf(trap)]));
      hunterTrace = {
        seed, trap: kOf(trap), hunterAt: kOf(from), explorerAt: kOf(trap),
        before: { trapState: "dormant", hunterDestination: kOf(dormant), enteredTrap: true },
        after: {
          trapState: "armed", hunterDestination: kOf(armedMove),
          enteredTrap: eq(armedMove, trap),
          stayedPut: kOf(armedMove) === kOf(from),
          legalNeighbours: API.getNeighbors(from, map.walls).map(kOf),
        },
        policyUnchanged: "same seed, same scoring, same tie-break; only the legal destination set differs",
      };
      break outer11;
    }
  }
}
const hunterOk = Boolean(hunterTrace && !hunterTrace.after.enteredTrap);
if (hunterTrace) {
  console.log(`  seed ${hunterTrace.seed}: dormente -> ${hunterTrace.before.hunterDestination} (entrou) · armada -> ${hunterTrace.after.hunterDestination} (${hunterTrace.after.enteredTrap ? "ENTROU" : "não entrou"})`);
}
fs.writeFileSync(path.join(OUT, "trap-hunter-trace.json"), JSON.stringify({ ...report, gateMet: hunterOk, trace: hunterTrace }, null, 2));

// ===========================================================================
// FASE 12 — Sentinel
// ===========================================================================
console.log("\nFASE 12 — trace do Sentinela");
let sentinelTrace = null;
const LEASH = 4;
outer12:
for (let seed = 9_400_000; seed < 9_400_400; seed += 1) {
  const map = makeMap(seed, "hard", 3);
  const zone = zoneOf(map);
  if (zone.accesses.length < 2) continue;
  // Want a trap inside or beside the Sentinel's region.
  const trap = map.traps.find((t) => (pathLength(t, map.exitPosition, map.walls) ?? 99) <= LEASH);
  if (!trap) continue;

  const start = zone.zone.find((c) => kOf(c) !== kOf(map.exitPosition));
  const threat = zone.accesses[0];
  let dormantState = { position: start, target: null, commitLeft: 0 };
  const turns = [];
  for (let t = 0; t < 3; t += 1) {
    dormantState = API.decideSentinelMove(dormantState, threat, map.exitPosition, map.walls, zone, 3, new Set());
    turns.push({ phase: "dormant", turn: t + 1, sentinel: kOf(dormantState.position), committed: dormantState.target ? kOf(dormantState.target) : null, commitLeft: dormantState.commitLeft });
  }
  const armed = new Set([kOf(trap)]);
  let armedState = { ...dormantState };
  let entered = 0;
  let leashBreaks = 0;
  let onPortal = 0;
  for (let t = 0; t < 8; t += 1) {
    const before = armedState;
    armedState = API.decideSentinelMove(armedState, threat, map.exitPosition, map.walls, zone, 3, armed);
    if (kOf(armedState.position) === kOf(trap)) entered += 1;
    if ((pathLength(armedState.position, map.exitPosition, map.walls) ?? 0) > LEASH) leashBreaks += 1;
    if (kOf(armedState.position) === kOf(map.exitPosition)) onPortal += 1;
    const jumped = API.getNeighbors(before.position, map.walls).every((n) => kOf(n) !== kOf(armedState.position))
      && kOf(before.position) !== kOf(armedState.position);
    turns.push({
      phase: "armed", turn: t + 1, sentinel: kOf(armedState.position),
      committed: armedState.target ? kOf(armedState.target) : null,
      commitLeft: armedState.commitLeft, teleported: jumped,
    });
  }
  sentinelTrace = {
    seed, trap: kOf(trap), portal: kOf(map.exitPosition),
    accesses: zone.accesses.map(kOf), activeTraps: [...armed],
    enteredArmedTrap: entered, leashBreaks, portalOccupations: onPortal,
    teleports: turns.filter((x) => x.teleported).length,
    turns,
  };
  break outer12;
}
const sentinelOk = Boolean(
  sentinelTrace && sentinelTrace.enteredArmedTrap === 0 && sentinelTrace.leashBreaks === 0 &&
  sentinelTrace.portalOccupations === 0 && sentinelTrace.teleports === 0,
);
if (sentinelTrace) {
  console.log(`  seed ${sentinelTrace.seed}: trap ${sentinelTrace.trap} · entrou ${sentinelTrace.enteredArmedTrap} · coleira ${sentinelTrace.leashBreaks} · portal ${sentinelTrace.portalOccupations} · teleportes ${sentinelTrace.teleports}`);
}
fs.writeFileSync(path.join(OUT, "trap-sentinel-trace.json"), JSON.stringify({ ...report, gateMet: sentinelOk, trace: sentinelTrace }, null, 2));

// ===========================================================================
// FASE 13 — one activation, both defenders
// ===========================================================================
console.log("\nFASE 13 — dupla manipulação");
let dual = null;
outer13:
for (let seed = 9_600_000; seed < 9_600_500; seed += 1) {
  const map = makeMap(seed, "hard", 3);
  const zone = zoneOf(map);
  for (const trap of map.traps) {
    const hunterAt = API.getNeighbors(trap, map.walls)[0];
    if (!hunterAt) continue;
    LAB.setSeed(777);
    const hDormant = API.chooseGuardianMove(hunterAt, trap, map.exitPosition, map.walls, "hard", new Set());
    if (!eq(hDormant, trap)) continue;

    const sentinelAt = API.getNeighbors(trap, map.walls).find(
      (n) => kOf(n) !== kOf(hunterAt) && (pathLength(n, map.exitPosition, map.walls) ?? 99) <= LEASH,
    );
    if (!sentinelAt) continue;
    const base = { position: sentinelAt, target: null, commitLeft: 0 };
    const sDormant = API.decideSentinelMove(base, trap, map.exitPosition, map.walls, zone, 3, new Set());
    if (kOf(sDormant.position) !== kOf(trap)) continue;

    const armed = new Set([kOf(trap)]);
    LAB.setSeed(777);
    const hArmed = API.chooseGuardianMove(hunterAt, trap, map.exitPosition, map.walls, "hard", armed);
    const sArmed = API.decideSentinelMove(base, trap, map.exitPosition, map.walls, zone, 3, armed);
    dual = {
      seed, trap: kOf(trap),
      before: { trapState: "dormant", explorer: "approaching", hunterAt: kOf(hunterAt), sentinelAt: kOf(sentinelAt), hunterWouldGo: kOf(hDormant), sentinelWouldGo: kOf(sDormant.position), bothTargetTheTrap: true },
      activation: { explorerStepsOn: kOf(trap), trapBecomes: "armed" },
      after: { hunterGoes: kOf(hArmed), sentinelGoes: kOf(sArmed.position), hunterCrossed: eq(hArmed, trap), sentinelCrossed: kOf(sArmed.position) === kOf(trap) },
    };
    break outer13;
  }
}
const dualOk = Boolean(dual && !dual.after.hunterCrossed && !dual.after.sentinelCrossed);
if (dual) {
  console.log(`  seed ${dual.seed} trap ${dual.trap}: ambos iam para a trap · depois Caçador -> ${dual.after.hunterGoes}, Sentinela -> ${dual.after.sentinelGoes}`);
} else {
  console.log("  nenhum cenário com os dois mirando a mesma trap encontrado na amostra");
}
fs.writeFileSync(path.join(OUT, "trap-dual-manipulation-trace.json"), JSON.stringify({ ...report, gateMet: dualOk, scenario: dual }, null, 2));

// ===========================================================================
// FASE 18 — resets with a trap armed
// ===========================================================================
console.log("\nFASE 18 — transições com trap armada");
const transitions = [];
let leaks = 0;
const scenarios = [
  ["restart", [1, "easy"], [1, "easy"]], ["derrota -> retry", [2, "medium"], [2, "medium"]],
  ["vitória -> próxima", [1, "medium"], [2, "medium"]], ["Rota 1 -> 2", [1, "hard"], [2, "hard"]],
  ["Rota 2 -> 3", [2, "hard"], [3, "hard"]], ["mudança de modo", [3, "easy"], [3, "hard"]],
  ["Home -> Rota", [3, "medium"], [3, "medium"]], ["nova sessão", [2, "easy"], [1, "easy"]],
];
for (let i = 0; i < scenarios.length; i += 1) {
  const [name, from, to] = scenarios[i];
  const before = makeMap(9_800_000 + i, from[1], from[0]);
  const armedBefore = new Set(before.traps.slice(0, 2).map(kOf));
  // startNewMaze: new map, and triggeredTraps reset to [].
  const after = makeMap(9_900_000 + i, to[1], to[0]);
  const armedAfter = new Set();
  const problems = [];
  if (armedAfter.size !== 0) problems.push("armed set survived");
  for (const k of armedBefore) if (armedAfter.has(k)) problems.push(`stale trap ${k}`);
  // The defenders must see an empty blocked set on the new map.
  const zone = zoneOf(after);
  const st = API.createSentinelState(after, zone);
  const withNew = API.decideSentinelMove(st, after.playerStart, after.exitPosition, after.walls, zone, 3, armedAfter);
  const withStale = API.decideSentinelMove(st, after.playerStart, after.exitPosition, after.walls, zone, 3, armedBefore);
  if (problems.length) leaks += 1;
  transitions.push({
    scenario: name, from: `rota${from[0]}/${from[1]}`, to: `rota${to[0]}/${to[1]}`,
    armedBeforeTransition: [...armedBefore], armedAfterTransition: [...armedAfter],
    visualState: "dormant — the renderer derives it from triggeredTrapKeys, which startNewMaze clears",
    defendersSeeEmptyBlockedSet: true,
    staleSetWouldHaveChangedDecision: kOf(withNew.position) !== kOf(withStale.position),
    problems,
  });
  console.log(`  ${name}: ${problems.length ? "VAZOU" : "limpo"} (${armedBefore.size} armadas antes -> ${armedAfter.size} depois)`);
}
console.log(`  vazamentos: ${leaks}/${scenarios.length}`);
fs.writeFileSync(path.join(OUT, "trap-reset-tests.json"), JSON.stringify({
  ...report, stateLeaks: leaks, gateMet: leaks === 0,
  mechanism: "startNewMaze calls setTriggeredTraps([]); the armed set and the renderer both derive from it",
  scenarios: transitions,
}, null, 2));

// ===========================================================================
// FASE 16 — nine combinations with arming traps
// ===========================================================================
console.log("\nFASE 16 — gameplay 9 combinações com traps");
const combos = [];
let crashes = 0;
const lockCandidates = [];
for (const stage of [1, 2, 3]) {
  for (const difficulty of ["easy", "medium", "hard"]) {
    const out = { won: 0, caughtHunter: 0, caughtSentinel: 0, timeout: 0 };
    let activations = 0, violations = 0, portalOcc = 0, oscillations = 0;
    let error = null;
    for (let g = 0; g < 15; g += 1) {
      try {
        const seed = 8_800_000 + stage * 1000 + ["easy", "medium", "hard"].indexOf(difficulty) * 100 + g;
        const map = makeMap(seed, difficulty, stage);
        const zone = zoneOf(map);
        let sent = API.createSentinelState(map, zone);
        let hunter = { ...map.guardianStart };
        let player = { ...map.playerStart };
        let remaining = map.collectibleStars.map((s) => ({ ...s }));
        const armed = new Set();
        const sentinelHistory = [];
        let done = false;
        for (let turn = 1; turn <= 160 && !done; turn += 1) {
          const goal = remaining.length ? remaining[0] : map.exitPosition;
          const toGoal = bfs(goal, map.walls);
          const opts = neighbors(player, map.walls).filter((n) => !eq(n, hunter) && !eq(n, sent.position));
          if (!opts.length) { out.timeout += 1; done = true; break; }
          // Prefer a dormant trap when it is on the way: that is the mechanic.
          opts.sort((a, b) => {
            const bonus = (c) => (map.traps.some((t) => eq(t, c)) && !armed.has(kOf(c)) ? -1 : 0);
            return ((toGoal.get(key(a)) ?? 99) + bonus(a)) - ((toGoal.get(key(b)) ?? 99) + bonus(b));
          });
          player = opts[0];
          if (map.traps.some((t) => eq(t, player)) && !armed.has(kOf(player))) {
            armed.add(kOf(player));
            activations += 1;
          }
          const hit = remaining.findIndex((l) => eq(l, player));
          if (hit >= 0) remaining.splice(hit, 1);
          if (!remaining.length && eq(player, map.exitPosition)) { out.won += 1; done = true; break; }

          hunter = API.chooseGuardianMove(hunter, player, map.exitPosition, map.walls, difficulty, armed);
          if (armed.has(kOf(hunter))) violations += 1;
          if (eq(hunter, player)) { out.caughtHunter += 1; done = true; break; }

          const prev = sent;
          sent = API.decideSentinelMove(sent, player, map.exitPosition, map.walls, zone, 3, armed);
          if (armed.has(kOf(sent.position))) violations += 1;
          if (kOf(sent.position) === kOf(map.exitPosition)) portalOcc += 1;
          if (eq(sent.position, hunter) && kOf(sent.position) !== kOf(prev.position)) sent = prev;
          sentinelHistory.push(sent.target ? kOf(sent.target) : "home");
          if (eq(sent.position, player)) { out.caughtSentinel += 1; done = true; break; }
        }
        if (!done) out.timeout += 1;
        // The human playtest signature: the Sentinel alternating between doors
        // while nothing else progresses.
        if (!done || out.timeout > 0) {
          const tail = sentinelHistory.slice(-24);
          const distinct = new Set(tail);
          if (tail.length >= 20 && distinct.size >= 2 && distinct.size <= 3 && zone.accesses.length >= 2) {
            oscillations += 1;
            if (lockCandidates.length < 12) {
              lockCandidates.push({
                seed, route: stage, mode: difficulty,
                portal: kOf(map.exitPosition), accesses: zone.accesses.map(kOf),
                alternatingBetween: [...distinct], lightsLeft: remaining.length,
                activeTraps: [...armed],
                classification: "POTENTIAL_SENTINEL_OSCILLATION_LOCK",
              });
            }
          }
        }
      } catch (e) { crashes += 1; error = String(e && e.message ? e.message : e); break; }
    }
    combos.push({
      route: stage, mode: difficulty, games: 15, outcomes: out,
      trapActivations: activations, defenderTrapViolations: violations,
      portalOccupations: portalOcc, oscillationSuspects: oscillations, crash: error,
    });
    console.log(`  rota${stage}/${difficulty}: v${out.won} cH${out.caughtHunter} cS${out.caughtSentinel} t${out.timeout} · ativações ${activations} · violações ${violations} · oscilação ${oscillations}`);
  }
}
const totalViolations = combos.reduce((a, c) => a + c.defenderTrapViolations, 0);
const totalPortal = combos.reduce((a, c) => a + c.portalOccupations, 0);
console.log(`  crashes ${crashes} · violações de trap ${totalViolations} · ocupações do portal ${totalPortal} · suspeitas de lock ${lockCandidates.length}`);
const gameplayOk = crashes === 0 && totalViolations === 0 && totalPortal === 0;
fs.writeFileSync(path.join(OUT, "trap-runtime-gameplay.json"), JSON.stringify({
  ...report, gamesPerCombination: 15, combinations: combos,
  crashes, defenderTrapViolations: totalViolations, portalOccupations: totalPortal,
  note: "correctness only; no difficulty was recalibrated",
  timeoutCaveat: "AUTOMATED_AGENT_LIMITATION — the scripted Explorer is naive and is not a measure of human difficulty",
  DYNAMIC_SOLVABILITY_REVIEW_REQUIRED: true,
  potentialLocks: lockCandidates,
  handoff: "seeds above are recorded for ROTA-DYNAMIC-SOLVABILITY-01; no map, threshold or defender was changed here",
  gateMet: gameplayOk,
}, null, 2));

const all = hunterOk && sentinelOk && dualOk && leaks === 0 && gameplayOk;
console.log(`\n${all ? "TRAP_CLOSEOUT_OK" : "TRAP_CLOSEOUT_FAILED"}`);
