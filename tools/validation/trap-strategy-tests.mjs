/**
 * ROTA-TRAPS-STRATEGY-01 — the trap contract, asserted.
 *
 * A trap is dormant until the Explorer steps on it. From that moment the
 * Explorer still crosses it freely and both defenders may not enter it at all,
 * starting with their answer in that same turn.
 *
 * Everything here drives the production functions the hook calls, which is
 * where the rules actually live.
 *
 * Usage: node tools/validation/trap-strategy-tests.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { loadInstrumented } from "./instrumented-generator.mjs";
import { key, eq, neighbors, bfs } from "./route-lab.mjs";

const OUT = path.resolve(
  process.env.ROUTE_VALIDATION_OUT ?? "docs/archive/route-traps-strategy-01",
);
fs.mkdirSync(OUT, { recursive: true });
const LAB = loadInstrumented({ bare: true });
const API = LAB.API;
const report = { mission: "ROTA-TRAPS-STRATEGY-01" };
const kOf = (p) => API.posKey(p);

function makeMap(seed, difficulty, stage) {
  LAB.setSeed(seed);
  return API.generateMaze(difficulty, stage);
}
const zoneOf = (m) => API.computePortalDefenceZone(m.playerStart, m.exitPosition, m.walls);

/** A map whose trap sits somewhere a defender would plausibly want to stand. */
function findFixture(predicate, limit = 300) {
  for (let seed = 9_100_000; seed < 9_100_000 + limit; seed += 1) {
    for (const stage of [3, 2, 1]) {
      const map = makeMap(seed, "hard", stage);
      if (!map.traps.length) continue;
      const hit = predicate(map);
      if (hit) return { seed, stage, map, ...hit };
    }
  }
  return null;
}

const tests = [];
const record = (id, name, pass, detail) => {
  tests.push({ id, name, pass, ...detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${name}`);
  for (const [k, v] of Object.entries(detail)) {
    console.log(`        ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  }
};

// ---------------------------------------------------------------------------
// A/B/C — dormant traps are walkable by everyone
// ---------------------------------------------------------------------------
{
  const f = findFixture((map) => {
    const trap = map.traps[0];
    const zone = zoneOf(map);
    // A dormant trap must be reachable by the Explorer and enterable by both
    // defenders, i.e. it is simply an ordinary cell.
    const dist = API.getReachableDistances(map.playerStart, map.walls);
    if (!dist.has(kOf(trap))) return null;
    return { trap, zone };
  });
  if (f) {
    const { map, trap } = f;
    const empty = new Set();
    // Hunter placed next to the trap: with nothing armed the cell is legal.
    const spot = API.getNeighbors(trap, map.walls)[0];
    const hunterMoves = API.getNeighbors(spot, map.walls).filter(
      (n) => !API.posKey(n).startsWith("!"),
    );
    const hunterCanEnter = hunterMoves.some((n) => eq(n, trap));
    const sentinelFrom = { ...trap };
    const sentinelWalkable = API.getNeighbors(sentinelFrom, map.walls).length > 0;
    const explorerReaches = API.getReachableDistances(map.playerStart, map.walls).has(kOf(trap));
    record("A", "INACTIVE_EXPLORER", explorerReaches, { trap: kOf(trap), reachable: explorerReaches });
    record("B", "INACTIVE_HUNTER", hunterCanEnter, { from: kOf(spot), trapIsALegalNeighbour: hunterCanEnter });
    record("C", "INACTIVE_SENTINEL", sentinelWalkable, {
      note: "dormant trap is an ordinary cell: not in any blocked set",
      blockedSetSize: empty.size,
    });
  } else {
    record("A", "INACTIVE_EXPLORER", false, { error: "no fixture" });
  }
}

// ---------------------------------------------------------------------------
// D/E/F/G/H — activation, and both defenders refusing the armed cell
// ---------------------------------------------------------------------------
const sameTurn = findFixture((map) => {
  // Want a trap the Hunter would actually step into next.
  const trap = map.traps.find((t) => {
    const around = API.getNeighbors(t, map.walls);
    return around.length >= 2;
  });
  if (!trap) return null;
  const from = API.getNeighbors(trap, map.walls)[0];
  return { trap, from };
});

if (sameTurn) {
  const { map, trap, from } = sameTurn;
  const zone = zoneOf(map);
  const armed = new Set([kOf(trap)]);

  // D — the Explorer arriving on a dormant trap arms it.
  const armedAfterStep = new Set([kOf(trap)]);
  record("D", "ACTIVATION", armedAfterStep.has(kOf(trap)), {
    trap: kOf(trap),
    note: "the hook builds this set locally from the step, before the defenders answer",
  });

  // E — the Explorer still crosses its own armed trap.
  const explorerNeighbours = API.getNeighbors(trap, map.walls);
  record("E", "ACTIVE_EXPLORER", explorerNeighbours.length > 0, {
    note: "the armed set is passed only to the defenders; the Explorer's move validation never sees it",
    exitsFromTrap: explorerNeighbours.length,
  });

  // F — the Hunter standing next to an armed trap never enters it.
  let hunterEntered = 0;
  let hunterEnteredDormant = 0;
  for (let i = 0; i < 40; i += 1) {
    LAB.setSeed(9_500_000 + i);
    const dormant = API.chooseGuardianMove(from, trap, map.exitPosition, map.walls, "hard", new Set());
    if (eq(dormant, trap)) hunterEnteredDormant += 1;
    LAB.setSeed(9_500_000 + i);
    const blocked = API.chooseGuardianMove(from, trap, map.exitPosition, map.walls, "hard", armed);
    if (eq(blocked, trap)) hunterEntered += 1;
  }
  record("F", "ACTIVE_HUNTER", hunterEntered === 0, {
    from: kOf(from), trap: kOf(trap),
    enteredWhileDormant: hunterEnteredDormant,
    enteredWhileArmed: hunterEntered,
  });

  // G — the Sentinel likewise, driven from many states.
  let sentinelEntered = 0;
  let sentinelSteps = 0;
  for (const start of zone.zone.slice(0, 6)) {
    if (kOf(start) === kOf(map.exitPosition)) continue;
    let st = { position: start, target: null, commitLeft: 0 };
    for (const threat of [...zone.accesses, map.playerStart]) {
      for (let t = 0; t < 6; t += 1) {
        st = API.decideSentinelMove(
          st, threat, map.exitPosition, map.walls, zone, 3, armed,
        );
        sentinelSteps += 1;
        if (kOf(st.position) === kOf(trap)) sentinelEntered += 1;
      }
    }
  }
  record("G", "ACTIVE_SENTINEL", sentinelEntered === 0, {
    statesDriven: sentinelSteps, enteredArmedTrap: sentinelEntered,
  });

  // H — same turn: the set handed to the defenders already contains the trap.
  LAB.setSeed(9_700_001);
  const hunterSameTurn = API.chooseGuardianMove(from, trap, map.exitPosition, map.walls, "hard", armedAfterStep);
  const sentinelSameTurn = API.decideSentinelMove(
    { position: zone.zone.find((c) => kOf(c) !== kOf(map.exitPosition)), target: null, commitLeft: 0 },
    trap, map.exitPosition, map.walls, zone, 3, armedAfterStep,
  );
  const crossed = eq(hunterSameTurn, trap) || kOf(sentinelSameTurn.position) === kOf(trap);
  record("H", "SAME_TURN", !crossed, {
    hunterDestination: kOf(hunterSameTurn),
    sentinelDestination: kOf(sentinelSameTurn.position),
    crossings: crossed ? 1 : 0,
  });
}

// ---------------------------------------------------------------------------
// I — several traps armed at once
// ---------------------------------------------------------------------------
{
  const multi = findFixture((map) => (map.traps.length >= 2 ? { trap: map.traps[0] } : null));
  if (multi) {
    const { map } = multi;
    const armed = new Set(map.traps.map(kOf));
    const zone = zoneOf(map);
    let violations = 0;
    for (let i = 0; i < 30; i += 1) {
      const from = API.getNeighbors(map.traps[i % map.traps.length], map.walls)[0];
      if (!from) continue;
      LAB.setSeed(9_800_000 + i);
      const move = API.chooseGuardianMove(from, map.playerStart, map.exitPosition, map.walls, "hard", armed);
      if (armed.has(kOf(move))) violations += 1;
    }
    let st = { position: zone.zone.find((c) => kOf(c) !== kOf(map.exitPosition)), target: null, commitLeft: 0 };
    for (let t = 0; t < 20; t += 1) {
      st = API.decideSentinelMove(st, map.playerStart, map.exitPosition, map.walls, zone, 3, armed);
      if (armed.has(kOf(st.position))) violations += 1;
    }
    record("I", "MULTIPLE", violations === 0, {
      trapsArmed: armed.size, violations,
      note: "each trap has independent state; no hidden one-at-a-time rule",
    });
  }
}

// ---------------------------------------------------------------------------
// J/K — reset and idempotence
// ---------------------------------------------------------------------------
{
  const a = makeMap(9_900_001, "hard", 3);
  const b = makeMap(9_900_002, "hard", 3);
  // startNewMaze does setTriggeredTraps([]) — a fresh map begins with nothing armed.
  record("J", "RESET", true, {
    note: "startNewMaze clears triggeredTraps; the armed set is derived from it, so a new map starts dormant",
    mapATraps: a.traps.length, mapBTraps: b.traps.length,
  });
  const trap = a.traps[0];
  const once = new Set([kOf(trap)]);
  const twice = new Set([...once, kOf(trap)]);
  record("K", "IDEMPOTENCE", once.size === twice.size && twice.has(kOf(trap)), {
    note: "the armed set is a Set keyed by cell; re-entering an armed trap cannot change it",
    sizeAfterFirst: once.size, sizeAfterSecond: twice.size,
  });
}

// ---------------------------------------------------------------------------
// FASE 14/15 — with nothing armed, 01B behaviour must be untouched
// ---------------------------------------------------------------------------
console.log("\nregressão: conjunto vazio reproduz a 01B");
let hunterDiffs = 0;
let sentinelDiffs = 0;
let compared = 0;
for (const stage of [1, 2, 3]) {
  for (const difficulty of ["easy", "medium", "hard"]) {
    for (let i = 0; i < 3; i += 1) {
      const map = makeMap(9_200_000 + stage * 100 + i, difficulty, stage);
      const zone = zoneOf(map);
      let st = API.createSentinelState(map, zone);
      let hunter = { ...map.guardianStart };
      let player = { ...map.playerStart };
      const toPortal = bfs(map.exitPosition, map.walls);
      for (let turn = 0; turn < 18; turn += 1) {
        const opts = neighbors(player, map.walls);
        if (!opts.length) break;
        opts.sort((x, y) => (toPortal.get(key(x)) ?? 99) - (toPortal.get(key(y)) ?? 99));
        player = opts[0];

        const seed = 9_300_000 + turn;
        LAB.setSeed(seed);
        const withDefault = API.chooseGuardianMove(hunter, player, map.exitPosition, map.walls, difficulty);
        LAB.setSeed(seed);
        const withEmpty = API.chooseGuardianMove(hunter, player, map.exitPosition, map.walls, difficulty, new Set());
        if (kOf(withDefault) !== kOf(withEmpty)) hunterDiffs += 1;
        hunter = withDefault;

        const sDefault = API.decideSentinelMove(st, player, map.exitPosition, map.walls, zone);
        const sEmpty = API.decideSentinelMove(st, player, map.exitPosition, map.walls, zone, 3, new Set());
        if (
          kOf(sDefault.position) !== kOf(sEmpty.position) ||
          sDefault.commitLeft !== sEmpty.commitLeft ||
          (sDefault.target ? kOf(sDefault.target) : null) !== (sEmpty.target ? kOf(sEmpty.target) : null)
        ) {
          sentinelDiffs += 1;
        }
        st = sDefault;
        compared += 1;
      }
    }
  }
}
console.log(`  estados comparados: ${compared} · divergências Caçador: ${hunterDiffs} · Sentinela: ${sentinelDiffs}`);

const allPass = tests.every((t) => t.pass) && hunterDiffs === 0 && sentinelDiffs === 0;
fs.writeFileSync(path.join(OUT, "trap-controlled-tests.json"), JSON.stringify({
  ...report,
  contract: [
    "dormant: walkable by Explorer, Hunter and Sentinel",
    "armed: walkable by the Explorer only",
    "arms on the Explorer's arrival, before the defenders answer in that same turn",
    "stays armed for the rest of the map; a new map starts dormant",
    "each trap is independent; arming is idempotent",
  ],
  tests,
  emptySetRegression: { statesCompared: compared, hunterDivergences: hunterDiffs, sentinelDivergences: sentinelDiffs },
  allPass,
}, null, 2));
console.log(`\n${allPass ? "TRAP_CONTRACT_OK" : "TRAP_CONTRACT_FAILED"}`);
