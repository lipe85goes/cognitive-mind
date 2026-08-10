/**
 * ROTA-DUAL-GUARDIANS-MAPS-01A — design lab for two different defenders.
 *
 * Analysis only: nothing here touches the runtime. The point is to prove, on
 * the maps the generator already produces, that a territorial Sentinel would
 * have something to defend and would produce decisions a Hunter does not.
 *
 * Vocabulary used throughout:
 *
 *  - PORTAL ZONE: the cells within `ZONE_RADIUS` of the portal. This is the
 *    Sentinel's responsibility, not a rectangle — it follows the topology.
 *  - ACCESS: a cell OUTSIDE the zone that touches it. These are the doors the
 *    Sentinel has to choose between; a zone with one door cannot be defended
 *    interestingly, it can only be plugged.
 *  - HUNTER: the current guardian behaviour. Chases. Pressure that moves.
 *  - SENTINEL: stays in the zone, picks the threatened door, intercepts, and
 *    gives up a chase that pulls it out of its region.
 */
import {
  bfs, pathLength, shortestPath, neighbors, key, eq, objectiveRoute,
} from "./route-lab.mjs";

export const ZONE_RADIUS = 2;
/** How far outside the zone the Sentinel will step before turning back. */
export const SENTINEL_LEASH = 2;

// ------------------------------------------------------------ portal zone ---
export function portalZone(map) {
  const fromPortal = bfs(map.exitPosition, map.walls);
  const zone = [];
  fromPortal.forEach((d, k) => {
    if (d <= ZONE_RADIUS) {
      const [row, col] = k.split(",").map(Number);
      zone.push({ row, col });
    }
  });
  const zoneKeys = new Set(zone.map(key));

  // Doors: outside cells that touch the zone.
  const accessKeys = new Set();
  for (const cell of zone) {
    for (const n of neighbors(cell, map.walls)) {
      if (!zoneKeys.has(key(n))) accessKeys.add(key(n));
    }
  }
  const accesses = [...accessKeys].map((k) => {
    const [row, col] = k.split(",").map(Number);
    return { row, col };
  });

  // A door only counts if the Explorer can actually arrive through it without
  // first passing through another door — otherwise it is the same approach.
  const fromStart = bfs(map.playerStart, map.walls);
  const usefulAccesses = accesses.filter((a) => {
    if (!fromStart.has(key(a))) return false;
    const others = new Set(accesses.filter((o) => !eq(o, a)).map(key));
    return pathLength(map.playerStart, a, map.walls, others) !== null;
  });

  // How far apart the doors are: doors side by side are one door.
  const spread = [];
  for (let i = 0; i < usefulAccesses.length; i += 1) {
    for (let j = i + 1; j < usefulAccesses.length; j += 1) {
      const d = pathLength(usefulAccesses[i], usefulAccesses[j], map.walls);
      if (d !== null) spread.push(d);
    }
  }

  // Coverage: standing on one zone cell, how many doors can the Sentinel reach
  // in <= 2 steps? Covering all of them from one cell means it never has to
  // choose, which is exactly the boring case.
  let bestCoverage = 0;
  for (const cell of zone) {
    const d = bfs(cell, map.walls);
    const covered = usefulAccesses.filter((a) => (d.get(key(a)) ?? 99) <= 2).length;
    bestCoverage = Math.max(bestCoverage, covered);
  }

  // Lock risk: can a single occupied cell cut every route start -> portal?
  const path = shortestPath(map.playerStart, map.exitPosition, map.walls) ?? [];
  const lockCells = path
    .slice(1, -1)
    .filter((c) => pathLength(map.playerStart, map.exitPosition, map.walls, new Set([key(c)])) === null);

  return {
    zone,
    zoneKeys,
    accesses: usefulAccesses,
    portalZoneSize: zone.length,
    portalAccessCount: usefulAccesses.length,
    portalAccessDistance: spread.length
      ? { min: Math.min(...spread), mean: +(spread.reduce((a, b) => a + b, 0) / spread.length).toFixed(2), max: Math.max(...spread) }
      : null,
    portalAccessDiversity: usefulAccesses.length
      ? +(1 - bestCoverage / usefulAccesses.length).toFixed(3)
      : 0,
    sentinelCoveragePotential: bestCoverage,
    sentinelSingleCellLockRisk: lockCells.length,
  };
}

// ----------------------------------------------------------- the Sentinel ---
/**
 * Territorial defender. No pathfinding cleverness — the question is whether the
 * MAP rewards a defender that thinks in doors instead of in distance.
 */
export function sentinelStep(state, playerPos, map, zoneInfo, tuning = {}) {
  const { patrol = true, commitTurns = 1 } = tuning;
  const { zoneKeys, accesses } = zoneInfo;
  const fromPlayer = bfs(playerPos, map.walls);
  const home = map.exitPosition;

  // Which door is the Explorer actually threatening?
  let target = home;
  let bestThreat = Infinity;
  for (const a of accesses) {
    const d = fromPlayer.get(key(a)) ?? Infinity;
    if (d < bestThreat) { bestThreat = d; target = a; }
  }

  // Commitment: a defender that re-aims every single turn is not patrolling, it
  // is tracking. Holding a door for a couple of turns is what gives the
  // Explorer something to play against — feint at one door, take another.
  if (state.commitLeft > 0 && state.target) {
    target = state.target;
    state.commitLeft -= 1;
  } else {
    state.target = target;
    state.commitLeft = commitTurns;
  }

  const distanceHome = pathLength(state.pos, home, map.walls) ?? 0;
  const outside = !zoneKeys.has(key(state.pos));
  if (bestThreat > 6 || (outside && distanceHome > ZONE_RADIUS + SENTINEL_LEASH)) {
    target = home;
    state.target = null;
    state.commitLeft = 0;
  }

  const toTarget = bfs(target, map.walls);
  const options = neighbors(state.pos, map.walls).filter((n) => {
    // A patrolling Sentinel never parks ON the portal: plugging the goal cell
    // is the degenerate defence this design exists to avoid.
    if (patrol && eq(n, home)) return false;
    const d = pathLength(n, home, map.walls);
    return d !== null && d <= ZONE_RADIUS + SENTINEL_LEASH;
  });
  if (!options.length) return state.pos;

  let best = state.pos;
  let bestScore = Infinity;
  for (const n of options) {
    const score = toTarget.get(key(n)) ?? 99;
    if (score < bestScore) { bestScore = score; best = n; }
  }
  const stayScore = toTarget.get(key(state.pos)) ?? 99;
  return bestScore < stayScore ? best : state.pos;
}

/** Naive comparison baseline: a defender that just sits on the portal. */
export function staticSentinelStep(state) {
  return state.pos;
}

// ------------------------------------------------------- Explorer agents ----
/**
 * Agents differ in how much they respect the defenders, not in randomness.
 *   optimal  — walks the objective route, ignores everyone.
 *   cautious — re-plans each turn, refuses cells a defender can reach next.
 *   human    — like cautious but only looks one defender ahead and accepts
 *              a short detour rather than a long one.
 *   flawed   — cautious, but every 5th decision it takes the second-best move.
 */
export function makeAgent(kind) {
  let tick = 0;
  return function step(player, remaining, map, defenders) {
    tick += 1;
    const goal = remaining.length ? remaining[0] : map.exitPosition;
    const toGoal = bfs(goal, map.walls);
    const options = neighbors(player, map.walls);
    if (!options.length) return player;

    const danger = new Set();
    if (kind !== "optimal") {
      for (const d of defenders) {
        if (!d) continue;
        danger.add(key(d));
        for (const n of neighbors(d, map.walls)) danger.add(key(n));
      }
    }

    const scored = options
      .map((n) => {
        const base = toGoal.get(key(n)) ?? 99;
        const risk = danger.has(key(n)) ? (kind === "human" ? 6 : 10) : 0;
        return { n, score: base + risk };
      })
      .sort((a, b) => a.score - b.score);

    if (kind === "flawed" && scored.length > 1 && tick % 5 === 0) return scored[1].n;
    return scored[0].n;
  };
}

// --------------------------------------------------------- dual simulation --
export function simulateDual(lab, map, difficulty, agentKind, opts = {}) {
  const { withSentinel = true, sentinelMode = "territorial", maxTurns = 140 } = opts;
  const zoneInfo = portalZone(map);
  const route = objectiveRoute(map);
  if (!route) return null;

  const agent = makeAgent(agentKind);
  let player = { ...map.playerStart };
  let hunter = { ...map.guardianStart };
  // The Sentinel starts on duty, not next to the Hunter.
  let sentinel = zoneInfo.zone.find((c) => !eq(c, map.exitPosition)) ?? { ...map.exitPosition };
  const sentinelState = { pos: sentinel, target: null, commitLeft: 0 };

  let remaining = [...route.cells.filter((c) => map.collectibleStars.some((s) => eq(s, c)))];
  const lights = map.collectibleStars.map((s) => ({ ...s }));
  remaining = lights.slice();

  let hunterInfluence = 0;
  let sentinelInfluence = 0;
  let bothThreatenSame = 0;
  let trappedTurns = 0;
  let repositions = 0;
  let lastSentinel = key(sentinel);
  let turns = 0;
  let outcome = "timeout";

  for (turns = 1; turns <= maxTurns; turns += 1) {
    const defenders = withSentinel ? [hunter, sentinel] : [hunter];

    // Pure-optimal move, for influence accounting.
    const goal = remaining.length ? remaining[0] : map.exitPosition;
    const toGoal = bfs(goal, map.walls);
    const pureBest = neighbors(player, map.walls)
      .sort((a, b) => (toGoal.get(key(a)) ?? 99) - (toGoal.get(key(b)) ?? 99))[0];

    const next = agent(player, remaining, map, defenders);
    if (pureBest && !eq(next, pureBest)) {
      const hunterNear = (pathLength(player, hunter, map.walls) ?? 99) <= 3;
      const sentinelNear = withSentinel && (pathLength(player, sentinel, map.walls) ?? 99) <= 3;
      if (hunterNear) hunterInfluence += 1;
      if (sentinelNear) sentinelInfluence += 1;
      if (hunterNear && sentinelNear) bothThreatenSame += 1;
    }

    const escapes = neighbors(player, map.walls).filter(
      (n) => !defenders.some((d) => d && (eq(n, d) || neighbors(d, map.walls).some((x) => eq(x, n)))),
    );
    if (!escapes.length) trappedTurns += 1;

    player = next;

    // Light pickup, then portal.
    const hit = remaining.findIndex((l) => eq(l, player));
    if (hit >= 0) remaining.splice(hit, 1);
    if (!remaining.length && eq(player, map.exitPosition)) { outcome = "won"; break; }

    if (eq(player, hunter)) { outcome = "caught-hunter"; break; }
    if (withSentinel && eq(player, sentinel)) { outcome = "caught-sentinel"; break; }

    hunter = lab.api.chooseGuardianMove(hunter, player, map.exitPosition, map.walls, difficulty);
    if (eq(player, hunter)) { outcome = "caught-hunter"; break; }

    if (withSentinel) {
      sentinelState.pos = sentinel;
      sentinel = sentinelMode === "static"
        ? staticSentinelStep(sentinelState)
        : sentinelStep(sentinelState, player, map, zoneInfo, opts.tuning);
      if (key(sentinel) !== lastSentinel) { repositions += 1; lastSentinel = key(sentinel); }
      if (eq(player, sentinel)) { outcome = "caught-sentinel"; break; }
    }
  }

  return {
    outcome, turns,
    optimalMoves: route.moves,
    hunterInfluence, sentinelInfluence, bothThreatenSame,
    trappedTurns, sentinelRepositions: repositions,
    lightsLeft: remaining.length,
  };
}

// ------------------------------------------------------------ future traps --
/** Trap value with BOTH defenders, plus its effect on the portal zone. */
export function dualTrapAnalysis(map, zoneInfo) {
  const hunterBase = pathLength(map.guardianStart, map.playerStart, map.walls);
  const sentinelHome = map.exitPosition;
  const per = map.traps.map((trap) => {
    const blocked = new Set([key(trap)]);
    const hunterAfter = pathLength(map.guardianStart, map.playerStart, map.walls, blocked);
    const isolatesHunter = hunterAfter === null;

    // Does it change which doors the Sentinel can still use?
    const doorsBefore = zoneInfo.accesses.length;
    const doorsAfter = zoneInfo.accesses.filter(
      (a) => pathLength(sentinelHome, a, map.walls, blocked) !== null,
    ).length;

    const inZone = zoneInfo.zoneKeys.has(key(trap));
    const isAccess = zoneInfo.accesses.some((a) => eq(a, trap));
    const degree = neighbors(trap, map.walls).length;
    const hunterDetour = isolatesHunter ? null : hunterAfter - hunterBase;

    // A trap that removes the last door makes the portal unreachable for the
    // defender AND trivial for the Explorer — never allowed.
    const sealsPortal = doorsAfter === 0 || (isAccess && doorsBefore <= 1);

    return {
      cell: key(trap), degree, inPortalZone: inZone, isPortalAccess: isAccess,
      hunterDetour, isolatesHunter, doorsBefore, doorsAfter, sealsPortal,
      score: isolatesHunter || sealsPortal
        ? 0
        : Math.min(100, Math.round(
            (hunterDetour ?? 0) * 12 +
            (doorsBefore - doorsAfter) * 18 +
            (degree >= 3 ? 20 : degree === 2 ? 8 : 0),
          )),
    };
  });

  // Every subset up to pairs: nothing may cut the defenders off entirely.
  const combos = [];
  for (let i = 0; i < map.traps.length; i += 1) {
    for (let j = i + 1; j < map.traps.length; j += 1) {
      const blocked = new Set([key(map.traps[i]), key(map.traps[j])]);
      const hunter = pathLength(map.guardianStart, map.playerStart, map.walls, blocked);
      const doors = zoneInfo.accesses.filter(
        (a) => pathLength(sentinelHome, a, map.walls, blocked) !== null,
      ).length;
      combos.push({
        cells: [key(map.traps[i]), key(map.traps[j])],
        hunterPath: hunter, doorsLeft: doors,
        forbidden: hunter === null || doors === 0,
      });
    }
  }
  const all = new Set(map.traps.map(key));
  const allHunter = pathLength(map.guardianStart, map.playerStart, map.walls, all);
  const allDoors = zoneInfo.accesses.filter(
    (a) => pathLength(sentinelHome, a, map.walls, all) !== null,
  ).length;

  return {
    hunterBase, traps: per, pairs: combos,
    forbiddenPairs: combos.filter((c) => c.forbidden).length,
    allTrapsForbidden: allHunter === null || allDoors === 0,
    meanScore: per.length ? +(per.reduce((a, t) => a + t.score, 0) / per.length).toFixed(1) : 0,
    worthless: per.filter((t) => t.score < 15).length,
  };
}

// ------------------------------------------------------------ future chest --
/**
 * Where would a chest pose a real question? Off the objective route, with a
 * detour that costs something but is affordable, and not next to the start.
 */
export function chestCandidates(map, route) {
  const fromStart = bfs(map.playerStart, map.walls);
  const routeKeys = new Set((route?.cells ?? []).map(key));
  const taken = new Set([
    key(map.playerStart), key(map.exitPosition),
    ...map.collectibleStars.map(key), ...map.traps.map(key),
  ]);
  const out = [];
  fromStart.forEach((d, k) => {
    if (taken.has(k) || routeKeys.has(k)) return;
    if (d < 4) return; // never beside the start
    const [row, col] = k.split(",").map(Number);
    const cell = { row, col };
    if ((pathLength(cell, map.exitPosition, map.walls) ?? 99) < 3) return; // not on the portal

    // Detour cost: nearest route cell, out and back.
    let nearest = Infinity;
    for (const c of route?.cells ?? []) {
      const dd = pathLength(cell, c, map.walls);
      if (dd !== null && dd < nearest) nearest = dd;
    }
    if (!Number.isFinite(nearest)) return;
    const detour = nearest * 2;
    if (detour < 4 || detour > 12) return; // trivial, or never worth it
    out.push({
      cell: k, startDistance: d, detourCost: detour,
      degree: neighbors(cell, map.walls).length,
    });
  });
  out.sort((a, b) => Math.abs(a.detourCost - 7) - Math.abs(b.detourCost - 7));
  return out;
}

// -------------------------------------------------- future breakable walls --
/**
 * A wall worth a future pickaxe: opening it must shorten or open something
 * meaningful, without handing over a straight line to the portal and without
 * making the Sentinel pointless.
 */
export function breakableWallCandidates(map, zoneInfo) {
  const baseStart = pathLength(map.playerStart, map.exitPosition, map.walls);
  const out = [];
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 9; col += 1) {
      const cell = { row, col };
      const k = key(cell);
      if (!map.walls.has(k)) continue;
      const opened = new Set(map.walls);
      opened.delete(k);
      // Must actually join two things: at least two open neighbours.
      const open = neighbors(cell, opened);
      if (open.length < 2) continue;

      const newStart = pathLength(map.playerStart, map.exitPosition, opened);
      if (newStart === null) continue;
      const shortcut = (baseStart ?? 0) - newStart;
      if (shortcut <= 0) continue;             // opens nothing useful
      if (newStart < 10) continue;             // would trivialise the board

      const zoneAfter = portalZone({ ...map, walls: opened });
      const newDoor = zoneAfter.portalAccessCount > zoneInfo.portalAccessCount;
      const hunterBefore = pathLength(map.guardianStart, map.playerStart, map.walls);
      const hunterAfter = pathLength(map.guardianStart, map.playerStart, opened);
      const hunterGain = (hunterBefore ?? 0) - (hunterAfter ?? 0);

      // It must never be required: the map is already solvable without it.
      const utility = Math.min(100, Math.round(
        shortcut * 9 + (newDoor ? 26 : 0) + Math.max(0, hunterGain) * 4 + open.length * 3,
      ));
      if (utility < 20) continue;
      out.push({
        cell: k, shortcut, newPortalDoor: newDoor,
        portalDoorsAfter: zoneAfter.portalAccessCount,
        hunterGain, openNeighbours: open.length,
        pathAfter: newStart, breakableWallUtility: utility,
        requiredForSolution: false,
      });
    }
  }
  out.sort((a, b) => b.breakableWallUtility - a.breakableWallUtility);
  return out;
}

// ------------------------------------------------------------- family tag ---
/** Which design family does this map's topology actually belong to? */
export function classifyFamily(map, zoneInfo, breakables, structureInfo) {
  const short = pathLength(map.playerStart, map.exitPosition, map.walls) ?? 0;
  // Second route: the best path that avoids the first one's middle cells.
  const first = shortestPath(map.playerStart, map.exitPosition, map.walls) ?? [];
  const avoid = new Set(first.slice(1, -1).map(key));
  const second = pathLength(map.playerStart, map.exitPosition, map.walls, avoid);
  const detourCost = second === null ? null : second - short;

  const tags = [];
  if (detourCost !== null && detourCost >= 4) tags.push("A_DUAS_ROTAS");
  if (structureInfo && structureInfo.longestCorridor >= 3 && zoneInfo.portalAccessCount >= 2) tags.push("B_REGIOES_GARGALOS");
  if (zoneInfo.portalAccessCount >= 3) tags.push("C_PORTAL_MULTIACESSO");
  if (breakables.length > 0 && breakables[0].breakableWallUtility >= 35) tags.push("D_ATALHO_POTENCIAL");

  return {
    tags,
    primary: tags[0] ?? "SEM_IDENTIDADE",
    shortestRoute: short,
    secondRoute: second,
    secondRouteCost: detourCost,
  };
}
