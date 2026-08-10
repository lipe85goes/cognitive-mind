/**
 * ROTA-DUAL-GUARDIANS-MAPS-01A-BALANCE — turning the dual architecture from
 * "oppressive" into "hard but fair". Analysis only; no runtime behaviour here.
 *
 * The previous pass measured a 16% win rate and 59 turns with no safe move, and
 * was correctly rejected. This module exists to answer *why* before anything is
 * weakened:
 *
 *  - `classifyUnsafeTurn` splits a no-safe-move turn into four very different
 *    things. Only one of them is a defect.
 *  - `makeHumanV2` is a strategist that actually looks ahead and understands the
 *    portal zone, so the Sentinel is judged against a competent opponent rather
 *    than against an agent that only avoided adjacent cells.
 *  - `routeVectors` + `findDominance` replace "the second route costs 2 moves"
 *    with a Pareto question: is any route better on every axis at once?
 */
import {
  bfs, pathLength, shortestPath, neighbors, key, eq,
} from "./route-lab.mjs";
import { portalZone, sentinelStep, staticSentinelStep, ZONE_RADIUS, SENTINEL_LEASH } from "./dual-guardian-lab.mjs";

const safeMoves = (pos, map, defenders) =>
  neighbors(pos, map.walls).filter(
    (n) => !defenders.some((d) => d && (eq(n, d) || neighbors(d, map.walls).some((x) => eq(x, n)))),
  );

/**
 * Can the Explorer survive `depth` more turns from here?
 *
 * Defenders are advanced with a deterministic worst case (both close in on the
 * Explorer), so a "survivable" verdict is conservative: if this says yes, a real
 * turn order can only be kinder.
 */
function survivable(pos, map, hunter, sentinel, zoneInfo, depth) {
  if (depth === 0) return true;
  const options = neighbors(pos, map.walls);
  for (const next of options) {
    if ((hunter && eq(next, hunter)) || (sentinel && eq(next, sentinel))) continue;
    const toPlayer = bfs(next, map.walls);
    const hNext = hunter
      ? (neighbors(hunter, map.walls)
          .sort((a, b) => (toPlayer.get(key(a)) ?? 99) - (toPlayer.get(key(b)) ?? 99))[0] ?? hunter)
      : null;
    let sNext = sentinel;
    if (sentinel) {
      const st = { pos: sentinel, target: null, commitLeft: 0 };
      sNext = sentinelStep(st, next, map, zoneInfo, { patrol: true, commitTurns: 1 });
    }
    if ((hNext && eq(next, hNext)) || (sNext && eq(next, sNext))) continue;
    if (survivable(next, map, hNext, sNext, zoneInfo, depth - 1)) return true;
  }
  return false;
}

/**
 * A/B/C/D for a turn where nothing was safe.
 *
 *   A tactical  — the Explorer had >= 2 safe options within the last 5 turns and
 *                 walked itself in. Legitimate consequence of a bad plan.
 *   B inevitable — no sequence survives, and no earlier choice avoided it. Defect.
 *   C agent      — a safe move existed that the agent did not take. Fix the
 *                  simulator, not the map.
 *   D pressure   — nothing is *safe*, but a legal move keeps the game alive.
 */
export function classifyUnsafeTurn(record, map, zoneInfo) {
  const { pos, hunter, sentinel, history } = record;
  const defenders = [hunter, sentinel].filter(Boolean);
  const legal = neighbors(pos, map.walls).filter(
    (n) => !defenders.some((d) => eq(n, d)),
  );
  const safe = safeMoves(pos, map, defenders);

  if (safe.length > 0) return { klass: "C", reason: "agente ignorou movimento seguro", legal: legal.length, safe: safe.length };

  const horizon2 = survivable(pos, map, hunter, sentinel, zoneInfo, 2);
  const horizon3 = survivable(pos, map, hunter, sentinel, zoneInfo, 3);
  const horizon4 = survivable(pos, map, hunter, sentinel, zoneInfo, 4);

  if (legal.length > 0 && horizon2) {
    return {
      klass: "D", reason: "pressão temporária: existe movimento legal que mantém a partida",
      legal: legal.length, safe: 0, horizon2, horizon3, horizon4,
    };
  }

  // Did the Explorer have a genuine fork in the recent past?
  const hadChoice = history.slice(-5).some((h) => h.safeOptions >= 2);
  if (hadChoice) {
    return {
      klass: "A", reason: "o Explorador tinha 2+ opções seguras nos últimos 5 turnos",
      legal: legal.length, safe: 0, horizon2, horizon3, horizon4,
    };
  }
  return {
    klass: "B", reason: "sem escolha anterior e sem horizonte de sobrevivência",
    legal: legal.length, safe: 0, horizon2, horizon3, horizon4,
  };
}

// ------------------------------------------------------ human-like agent v2 --
/**
 * A strategist, not a distance follower. Uses only what a player can see: both
 * defenders, the doors of the portal zone, the lights left, and two to four
 * turns of consequence. No knowledge of future RNG, no perfect solution.
 */
export function makeHumanV2(zoneInfo, opts = {}) {
  const { lookahead = 3, zonePatience = true } = opts;
  return function step(player, remaining, map, defenders) {
    const [hunter, sentinel] = defenders;
    const goal = remaining.length ? remaining[0] : map.exitPosition;
    const toGoal = bfs(goal, map.walls);
    const options = neighbors(player, map.walls);
    if (!options.length) return player;

    // The door the Sentinel is currently sitting on / nearest to.
    let guarded = null;
    if (sentinel) {
      let best = Infinity;
      for (const a of zoneInfo.accesses) {
        const d = pathLength(sentinel, a, map.walls) ?? 99;
        if (d < best) { best = d; guarded = a; }
      }
    }

    const scored = options.map((n) => {
      let score = toGoal.get(key(n)) ?? 99;

      // Immediate danger.
      for (const d of defenders) {
        if (!d) continue;
        const dist = pathLength(n, d, map.walls) ?? 99;
        if (dist === 0) score += 100;
        else if (dist === 1) score += 14;
        else if (dist === 2) score += 5;
      }

      // Keep options open: a cell with one exit is how you get walked into a
      // corner two turns later.
      const exits = safeMoves(n, map, defenders).length;
      if (exits === 0) score += 12;
      else if (exits === 1) score += 4;

      // Do not enter the final region while lights are still out there — that
      // is the single most expensive mistake this board can offer. Mild, and
      // only while a light is genuinely elsewhere: at +7 the agent refused to
      // commit at all and timed out 72% of runs, which measured the simulator's
      // timidity, not the map.
      if (zonePatience && remaining.length > 0 && zoneInfo.zoneKeys.has(key(n))
          && !remaining.some((l) => zoneInfo.zoneKeys.has(key(l)))) {
        score += 2;
      }

      // Prefer the door the Sentinel is NOT holding.
      if (guarded && remaining.length === 0) {
        const viaGuarded = pathLength(n, guarded, map.walls) ?? 99;
        const alternatives = zoneInfo.accesses.filter((a) => !eq(a, guarded));
        const viaOther = Math.min(...alternatives.map((a) => pathLength(n, a, map.walls) ?? 99), 99);
        if (viaOther < viaGuarded + 4) score -= 3;
      }

      // Shallow lookahead: does this move still have a future? Weighted so it
      // vetoes a genuine dead end without freezing the agent — a player who
      // never accepts risk never reaches the portal either.
      if (!survivable(n, map, hunter, sentinel, zoneInfo, Math.min(2, lookahead))) score += 9;
      // Progress matters: a strategist that circles forever is not cautious,
      // it is stuck. Ties break toward the goal.
      score += (toGoal.get(key(n)) ?? 99) * 0.35;

      return { n, score };
    }).sort((a, b) => a.score - b.score);

    return scored[0].n;
  };
}

/**
 * humanV3 — plays to survive AND to finish.
 *
 * v2 was a good survivor and a bad player: it dodged well, never committed, and
 * timed out in 67% of runs. That measured the simulator's timidity, not the map,
 * so the Sentinel could not be judged fairly. v3 adds the two things v2 lacked:
 *
 *   - PROGRESS PRESSURE. Every turn without reaching the next objective raises
 *     the weight of progress. A player circling for eight turns starts accepting
 *     risk, because standing still is also losing. Capped, so it never becomes
 *     deliberate suicide.
 *   - ANTI-LOOP. Recent cells cost more, and an explicit A-B-A-B cycle is
 *     detected and broken by taking the best remaining option — never by RNG.
 *
 * It still only knows what a player can see, and it is deliberately not optimal.
 */
export function makeHumanV3(zoneInfo, opts = {}) {
  const { lookahead = 3, memory = 8, patienceTurns = 6 } = opts;
  const recent = [];
  let sinceProgress = 0;
  let lastRemaining = null;

  return function step(player, remaining, map, defenders) {
    const [hunter, sentinel] = defenders;
    if (lastRemaining === null || remaining.length < lastRemaining) {
      sinceProgress = 0;
      lastRemaining = remaining.length;
    } else {
      sinceProgress += 1;
    }

    const goal = remaining.length ? remaining[0] : map.exitPosition;
    const toGoal = bfs(goal, map.walls);
    const options = neighbors(player, map.walls);
    if (!options.length) return player;

    const urgency = Math.min(2.6, 0.9 + Math.max(0, sinceProgress - patienceTurns) * 0.22);

    const trail = recent.slice(-memory);
    const twoCycle = trail.length >= 4
      && trail[trail.length - 1] === trail[trail.length - 3]
      && trail[trail.length - 2] === trail[trail.length - 4];
    const revisits = new Map();
    for (const k of trail) revisits.set(k, (revisits.get(k) ?? 0) + 1);

    let guarded = null;
    if (sentinel) {
      let best = Infinity;
      for (const a of zoneInfo.accesses) {
        const d = pathLength(sentinel, a, map.walls) ?? 99;
        if (d < best) { best = d; guarded = a; }
      }
    }

    const scored = options.map((n) => {
      const k = key(n);
      let score = (toGoal.get(k) ?? 99) * urgency;

      for (const d of defenders) {
        if (!d) continue;
        const dist = pathLength(n, d, map.walls) ?? 99;
        if (dist === 0) score += 100;
        else if (dist === 1) score += 11;
        else if (dist === 2) score += 3.5;
      }

      const exits = safeMoves(n, map, defenders).length;
      if (exits === 0) score += 9;
      else if (exits === 1) score += 3;

      const seen = revisits.get(k) ?? 0;
      score += seen * 2.4;
      if (twoCycle && seen > 0) score += 8;

      if (remaining.length > 0 && zoneInfo.zoneKeys.has(k)
          && !remaining.some((l) => zoneInfo.zoneKeys.has(key(l)))) {
        score += Math.max(0, 3 - sinceProgress * 0.3);
      }

      if (guarded && remaining.length === 0) {
        const viaGuarded = pathLength(n, guarded, map.walls) ?? 99;
        const others = zoneInfo.accesses.filter((a) => !eq(a, guarded));
        const viaOther = Math.min(...others.map((a) => pathLength(n, a, map.walls) ?? 99), 99);
        if (viaOther < viaGuarded + 4) score -= 3;
      }

      // A move with no future is vetoed, but the veto shrinks under urgency —
      // otherwise the agent freezes instead of taking the only way on.
      if (!survivable(n, map, hunter, sentinel, zoneInfo, Math.min(2, lookahead))) {
        score += Math.max(4, 12 - sinceProgress * 0.6);
      }

      return { n, score };
    }).sort((a, b) => a.score - b.score);

    const chosen = scored[0].n;
    recent.push(key(chosen));
    if (recent.length > memory * 2) recent.shift();
    return chosen;
  };
}

// -------------------------------------------------------- route trade-offs --
/**
 * Describe a route as a vector, not a length. Two routes that differ only in
 * length are not a dilemma; two routes that trade Hunter exposure for Sentinel
 * exposure are.
 */
export function routeVector(cells, map, zoneInfo) {
  if (!cells || !cells.length) return null;
  const hunterExposure = cells.reduce(
    (a, c) => a + (((pathLength(c, map.guardianStart, map.walls) ?? 99) <= 3) ? 1 : 0), 0,
  );
  // Sentinel exposure: turns spent inside the zone or on a door.
  const doorKeys = new Set(zoneInfo.accesses.map(key));
  const sentinelExposure = cells.reduce(
    (a, c) => a + (zoneInfo.zoneKeys.has(key(c)) || doorKeys.has(key(c)) ? 1 : 0), 0,
  );
  // Which door does it arrive by, and how good is that door (how far from the
  // rest, i.e. how hard for one Sentinel position to also cover it)?
  let entryDoor = null;
  for (const c of cells) if (doorKeys.has(key(c))) { entryDoor = c; break; }
  const portalAccessQuality = entryDoor
    ? Math.min(...zoneInfo.accesses.filter((a) => !eq(a, entryDoor))
        .map((a) => pathLength(entryDoor, a, map.walls) ?? 0), 0) * -1 || 0
    : 0;
  const trapLeverage = cells.reduce(
    (a, c) => a + (map.traps.some((t) => eq(t, c)) ? 1 : 0), 0,
  );
  const recoveryPotential = cells.reduce(
    (a, c) => a + (neighbors(c, map.walls).length >= 3 ? 1 : 0), 0,
  );
  return {
    pathLength: cells.length - 1,
    hunterExposure,
    sentinelExposure,
    portalAccessQuality,
    trapLeverage,
    recoveryPotential,
    entryDoor: entryDoor ? key(entryDoor) : null,
  };
}

/** Up to three genuinely different ways of doing the same job. */
export function candidateRoutes(map) {
  const out = [];
  const direct = shortestPath(map.playerStart, map.exitPosition, map.walls);
  if (direct) out.push({ name: "direta", cells: direct });

  // Avoid the direct route's interior: the structural alternative.
  if (direct) {
    const avoid = new Set(direct.slice(1, -1).map(key));
    const alt = (() => {
      const prev = new Map([[key(map.playerStart), null]]);
      const q = [map.playerStart];
      for (let i = 0; i < q.length; i += 1) {
        const cur = q[i];
        if (eq(cur, map.exitPosition)) {
          const cells = []; let k = key(cur);
          while (k) { const [row, col] = k.split(",").map(Number); cells.unshift({ row, col }); k = prev.get(k); }
          return cells;
        }
        for (const n of neighbors(cur, map.walls)) {
          if (prev.has(key(n)) || avoid.has(key(n))) continue;
          prev.set(key(n), key(cur)); q.push(n);
        }
      }
      return null;
    })();
    if (alt) out.push({ name: "alternativa", cells: alt });
  }

  // Avoid the Hunter's neighbourhood: the "safe but long" way.
  const hunterZone = new Set();
  const hb = bfs(map.guardianStart, map.walls);
  hb.forEach((d, k) => { if (d <= 2) hunterZone.add(k); });
  hunterZone.delete(key(map.playerStart));
  hunterZone.delete(key(map.exitPosition));
  const away = (() => {
    const prev = new Map([[key(map.playerStart), null]]);
    const q = [map.playerStart];
    for (let i = 0; i < q.length; i += 1) {
      const cur = q[i];
      if (eq(cur, map.exitPosition)) {
        const cells = []; let k = key(cur);
        while (k) { const [row, col] = k.split(",").map(Number); cells.unshift({ row, col }); k = prev.get(k); }
        return cells;
      }
      for (const n of neighbors(cur, map.walls)) {
        if (prev.has(key(n)) || hunterZone.has(key(n))) continue;
        prev.set(key(n), key(cur)); q.push(n);
      }
    }
    return null;
  })();
  if (away) out.push({ name: "longe-do-cacador", cells: away });

  // De-duplicate by cell set.
  const seen = new Set();
  return out.filter((r) => {
    const sig = r.cells.map(key).join("|");
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
}

/**
 * A route dominates another when it is at least as good on EVERY axis and
 * strictly better on one. If that happens the choice is fake.
 */
export function findDominance(vectors) {
  const dominated = [];
  for (let i = 0; i < vectors.length; i += 1) {
    for (let j = 0; j < vectors.length; j += 1) {
      if (i === j || !vectors[i].vector || !vectors[j].vector) continue;
      const a = vectors[i].vector;
      const b = vectors[j].vector;
      const noWorse =
        a.pathLength <= b.pathLength &&
        a.hunterExposure <= b.hunterExposure &&
        a.sentinelExposure <= b.sentinelExposure &&
        a.recoveryPotential >= b.recoveryPotential;
      const strictlyBetter =
        a.pathLength < b.pathLength ||
        a.hunterExposure < b.hunterExposure ||
        a.sentinelExposure < b.sentinelExposure ||
        a.recoveryPotential > b.recoveryPotential;
      if (noWorse && strictlyBetter) {
        dominated.push({ dominant: vectors[i].name, dominated: vectors[j].name });
      }
    }
  }
  return dominated;
}


/**
 * Dominance, contextually.
 *
 * The static detector froze the Hunter at its spawn and called 30/72 maps
 * "dominated". But a route that only wins while the Hunter sits in one corner is
 * not universally better — the mission was right to suspect the detector. This
 * replays the same routes across plausible states: Hunter in different regions,
 * Sentinel committed to different doors, different lights outstanding.
 *
 * A map only fails when ONE route wins in EVERY state.
 */
export function contextualDominance(map, zoneInfo, routes) {
  if (routes.length < 2) {
    return {
      routes: routes.length, states: 0, dominantAcrossStates: null,
      routeSwitchCount: 0, preferredCounts: {}, contextualTradeoffScore: 0,
      preferredRouteByState: [],
    };
  }

  const reach = [...bfs(map.playerStart, map.walls).keys()].map((k) => {
    const [row, col] = k.split(",").map(Number);
    return { row, col };
  });
  const hunterStates = [map.guardianStart];
  for (const q of [[0, 0], [0, 8], [8, 8], [4, 4]]) {
    let best = null;
    let bestD = Infinity;
    for (const c of reach) {
      const d = Math.abs(c.row - q[0]) + Math.abs(c.col - q[1]);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best && !hunterStates.some((h) => eq(h, best))) hunterStates.push(best);
  }
  const doorStates = zoneInfo.accesses.slice(0, 4);
  const lightStates = [map.collectibleStars.length, Math.floor(map.collectibleStars.length / 2), 0];

  const preferred = [];
  for (const h of hunterStates) {
    const hb = bfs(h, map.walls);
    for (const door of doorStates) {
      for (const lightsLeft of lightStates) {
        const cost = routes.map((r) => {
          if (!r.cells) return Infinity;
          const hunterExposure = r.cells.reduce(
            (a, c) => a + (((hb.get(key(c)) ?? 99) <= 3) ? 1 : 0), 0);
          const doorPenalty = r.cells.some((c) => eq(c, door)) ? 4 : 0;
          const lengthWeight = lightsLeft > 0 ? 1.0 : 0.6;
          return (r.cells.length - 1) * lengthWeight + hunterExposure * 1.5 + doorPenalty;
        });
        let bestIdx = 0;
        for (let i = 1; i < cost.length; i += 1) if (cost[i] < cost[bestIdx]) bestIdx = i;
        preferred.push({ hunter: key(h), door: key(door), lightsLeft, route: routes[bestIdx].name });
      }
    }
  }

  const counts = {};
  for (const p of preferred) counts[p.route] = (counts[p.route] ?? 0) + 1;
  const names = Object.keys(counts);
  const winner = names.sort((a, b) => counts[b] - counts[a])[0];

  return {
    routes: routes.length,
    states: preferred.length,
    dominantAcrossStates: names.length === 1 ? winner : null,
    routeSwitchCount: names.length,
    preferredCounts: counts,
    contextualTradeoffScore: +(1 - (counts[winner] ?? 0) / preferred.length).toFixed(3),
    preferredRouteByState: preferred.slice(0, 24),
  };
}

// -------------------------------------------------- sentinel repositioning --
/**
 * Does defending this zone actually require moving? A position that covers
 * every door within two steps means the Sentinel never chooses.
 */
export function repositionDemand(map, zoneInfo) {
  if (zoneInfo.accesses.length < 2) return { requiresReposition: false, bestCoverage: zoneInfo.accesses.length, coverRadius: 0 };
  let bestAt2 = 0;
  let bestAt1 = 0;
  for (const cell of zoneInfo.zone) {
    if (eq(cell, map.exitPosition)) continue; // patrol never parks on the portal
    const d = bfs(cell, map.walls);
    bestAt2 = Math.max(bestAt2, zoneInfo.accesses.filter((a) => (d.get(key(a)) ?? 99) <= 2).length);
    bestAt1 = Math.max(bestAt1, zoneInfo.accesses.filter((a) => (d.get(key(a)) ?? 99) <= 1).length);
  }
  return {
    accesses: zoneInfo.accesses.length,
    bestCoverageAt1: bestAt1,
    bestCoverageAt2: bestAt2,
    // "Requires repositioning" = no single patrol cell answers every door
    // immediately. Radius 1 is the honest test: at radius 2 the Sentinel still
    // has to commit a move, which is the decision we want.
    requiresReposition: bestAt1 < zoneInfo.accesses.length,
    trivialCoverage: bestAt2 >= zoneInfo.accesses.length,
  };
}

// ------------------------------------------------- trap combination safety --
/**
 * Every pair that can coexist on the board must be safe to activate together.
 * A rule the player cannot see ("this one is allowed, that one is not") is not
 * acceptable design — the fix belongs in generation, not in the runtime.
 */
export function trapSetSafety(map, zoneInfo) {
  const hunterBase = pathLength(map.guardianStart, map.playerStart, map.walls);
  const doorsOf = (blocked) =>
    zoneInfo.accesses.filter((a) => pathLength(map.exitPosition, a, map.walls, blocked) !== null).length;

  const check = (cells) => {
    const blocked = new Set(cells.map(key));
    const hunter = pathLength(map.guardianStart, map.playerStart, map.walls, blocked);
    const doors = doorsOf(blocked);
    return { hunterPath: hunter, doorsLeft: doors, unsafe: hunter === null || doors === 0 };
  };

  const singles = map.traps.map((t) => ({ cells: [key(t)], ...check([t]) }));
  const pairs = [];
  for (let i = 0; i < map.traps.length; i += 1) {
    for (let j = i + 1; j < map.traps.length; j += 1) {
      pairs.push({ cells: [key(map.traps[i]), key(map.traps[j])], ...check([map.traps[i], map.traps[j]]) });
    }
  }
  const triples = [];
  for (let i = 0; i < map.traps.length; i += 1) {
    for (let j = i + 1; j < map.traps.length; j += 1) {
      for (let k = j + 1; k < map.traps.length; k += 1) {
        triples.push({
          cells: [key(map.traps[i]), key(map.traps[j]), key(map.traps[k])],
          ...check([map.traps[i], map.traps[j], map.traps[k]]),
        });
      }
    }
  }
  const all = check(map.traps);

  return {
    hunterBase,
    unsafeSingles: singles.filter((s) => s.unsafe).length,
    unsafePairs: pairs.filter((p) => p.unsafe).length,
    unsafeTriples: triples.filter((t) => t.unsafe).length,
    allTrapsUnsafe: all.unsafe,
    totalCombinations: singles.length + pairs.length + triples.length + 1,
    unsafeCombinations:
      singles.filter((s) => s.unsafe).length +
      pairs.filter((p) => p.unsafe).length +
      triples.filter((t) => t.unsafe).length +
      (all.unsafe ? 1 : 0),
    worstPairs: pairs.filter((p) => p.unsafe).slice(0, 6),
  };
}

// ------------------------------------------------- dual pressure decisions --
/**
 * A decision counts as dual-pressure when the presence of BOTH defenders
 * changes the move: the best move considering only the Hunter differs from the
 * best move considering only the Sentinel, and the chosen move differs from the
 * defender-free optimum.
 */
export function dualPressureDecision(player, remaining, map, hunter, sentinel, zoneInfo) {
  const goal = remaining.length ? remaining[0] : map.exitPosition;
  const toGoal = bfs(goal, map.walls);
  const options = neighbors(player, map.walls);
  if (options.length < 2) return null;

  const rank = (defs) => {
    const agent = makeHumanV2(zoneInfo, { lookahead: 2 });
    return agent(player, remaining, map, defs);
  };
  const free = options.sort((a, b) => (toGoal.get(key(a)) ?? 99) - (toGoal.get(key(b)) ?? 99))[0];
  const vsHunter = rank([hunter, null]);
  const vsSentinel = rank([null, sentinel]);
  const vsBoth = rank([hunter, sentinel]);

  const hunterMatters = !eq(vsHunter, free);
  const sentinelMatters = !eq(vsSentinel, free);
  const combined = !eq(vsBoth, vsHunter) || !eq(vsBoth, vsSentinel);

  return {
    isDualDecision: hunterMatters && sentinelMatters && combined,
    hunterMatters, sentinelMatters, combined,
    free: key(free), vsHunter: key(vsHunter), vsSentinel: key(vsSentinel), vsBoth: key(vsBoth),
  };
}

// ------------------------------------------------- contextual reward rules --
/**
 * `rewardEligibility(mapState)` — the chest offers TWO options and the player
 * picks one, so each reward must be able to say when it makes sense. This is
 * the contract the next mission implements; nothing is active here.
 */
export function rewardEligibility(map, breakables) {
  const bestBreakable = breakables[0] ?? null;
  return {
    PICARETA: {
      eligible: Boolean(bestBreakable && bestBreakable.breakableWallUtility >= 35),
      reason: bestBreakable
        ? `melhor parede quebrável tem utilidade ${bestBreakable.breakableWallUtility}`
        : "nenhuma parede quebrável útil neste mapa",
      maxImpact: bestBreakable ? bestBreakable.shortcut : 0,
    },
    SEGUNDA_CHANCE: {
      // Always meaningful while a defender can reach the Explorer at all.
      eligible: (pathLength(map.guardianStart, map.playerStart, map.walls) ?? 99) < 99,
      reason: "protege uma vez contra captura; sempre relevante com defensores ativos",
      maxImpact: 1,
    },
    TERCEIRA: {
      eligible: false,
      reason: "categoria em aberto — isca, tempo no Desafiador ou interação com armadilha",
      maxImpact: null,
    },
    poolSize: 0,
  };
}

export { safeMoves, survivable, ZONE_RADIUS, SENTINEL_LEASH, portalZone, sentinelStep, staticSentinelStep };
