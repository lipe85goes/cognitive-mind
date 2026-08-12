/**
 * ROTA-DYNAMIC-SOLVABILITY-01 — exact nondeterministic solver, pre-chest baseline.
 *
 * The Hunter is stochastic (measured: 89.4% of states in Aberto/Equilibrado and
 * 41.9% in Desafiador have more than one possible successor), so
 * `STEP(state, action)` is not a function. This models the game as it is:
 *
 *   SUCCESSORS(state, action) -> Set<state>
 *
 * enumerating the exact SUPPORT of every random branch rather than sampling it.
 *
 * Two questions on the same graph:
 *   EXISTENTIAL  Explorer = OR, RNG = OR — can it ever be won?
 *   GUARANTEED   Explorer = OR, RNG = AND — can it be won whatever the RNG does?
 *
 * PRE_CHEST_BASELINE: no pickaxe, no breakable walls, no second chance.
 *
 * Usage: node tools/validation/dynamic-solver.mjs [--seeds n] [--budget n]
 */
import { loadInstrumented } from "./instrumented-generator.mjs";

const LAB = loadInstrumented({ bare: true });
export const API = LAB.API;
export const setSeed = LAB.setSeed;
const kOf = (p) => API.posKey(p);
const md = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
const same = (a, b) => a.row === b.row && a.col === b.col;

/* ------------------------------------------------------ RNG support model ---
 *
 * Mirrors src/engine/difficulty.ts and chooseGuardianMove branch for branch.
 * Every outcome listed here has probability > 0; nothing else is reachable.
 * Soundness is asserted against the real runtime in the differential test.
 */
export function predatorSupport(hunter, player, walls, difficulty) {
  const neighbours = API.getNeighbors(hunter, walls);
  if (neighbours.length === 0) return [hunter];
  const current = md(hunter, player);
  const closer = neighbours.filter((n) => md(n, player) < current);

  if (difficulty === "easy") {
    // p<0.5 -> any neighbour; otherwise a not-closer one, or any if none.
    // The first branch alone already covers every neighbour.
    return neighbours;
  }
  if (difficulty === "medium") {
    // p<0.75 gates the greedy branch; the else branch is any neighbour.
    return neighbours;
  }
  // hard: greedy when possible, ties broken at random.
  if (closer.length > 0) {
    const best = Math.min(...closer.map((n) => md(n, player)));
    return closer.filter((n) => md(n, player) === best);
  }
  return neighbours;
}

export function hunterSupport(hunter, player, exitPosition, walls, difficulty, armed) {
  const illegal = (cell) => same(cell, exitPosition) || armed.has(kOf(cell));
  const support = new Map();
  const add = (cell) => support.set(kOf(cell), cell);

  const preferred = predatorSupport(hunter, player, walls, difficulty);
  let anyIllegal = false;
  for (const p of preferred) {
    if (illegal(p)) anyIllegal = true;
    else add(p);
  }
  if (anyIllegal) {
    const alternatives = API.getNeighbors(hunter, walls).filter((n) => !illegal(n));
    if (alternatives.length === 0) {
      add(hunter);
    } else {
      // easy has an extra p<0.45 branch over all alternatives.
      if (difficulty === "easy") for (const a of alternatives) add(a);
      const best = Math.min(...alternatives.map((a) => md(a, player)));
      for (const a of alternatives) if (md(a, player) === best) add(a);
    }
  }
  return [...support.values()];
}

/* ------------------------------------------------------ canonical state ---- */
export function buildContext(map, difficulty) {
  const zone = API.computePortalDefenceZone(map.playerStart, map.exitPosition, map.walls);
  const accessKeys = zone.accesses.map(kOf);
  const lightKeys = map.collectibleStars.map(kOf);
  const trapKeys = map.traps.map(kOf);
  return { map, difficulty, zone, accessKeys, lightKeys, trapKeys };
}

export function initialState(ctx) {
  const s = API.createSentinelState(ctx.map, ctx.zone);
  return {
    e: kOf(ctx.map.playerStart),
    h: kOf(ctx.map.guardianStart),
    s: kOf(s.position),
    t: s.target ? ctx.accessKeys.indexOf(kOf(s.target)) : -1,
    c: s.commitLeft,
    lights: 0,
    traps: 0,
  };
}
export const encode = (st) => `${st.e}|${st.h}|${st.s}|${st.t}|${st.c}|${st.lights}|${st.traps}`;
const toCell = (k) => { const [row, col] = k.split(",").map(Number); return { row, col }; };

/* ------------------------------------------------------------ transition --- */
export const ACTIONS = [
  { name: "UP", row: -1, col: 0 },
  { name: "DOWN", row: 1, col: 0 },
  { name: "LEFT", row: 0, col: -1 },
  { name: "RIGHT", row: 0, col: 1 },
];

/**
 * All states reachable from `st` when the Explorer plays `action`.
 * Returns { outcomes: [{ state, terminal }] } or null when the move is illegal
 * (a blocked move does not advance the turn in the runtime, so it is not an
 * action of the solver).
 */
export function successors(ctx, st, action) {
  const { map, difficulty, zone, accessKeys, lightKeys, trapKeys } = ctx;
  const from = toCell(st.e);
  const next = { row: from.row + action.row, col: from.col + action.col };
  if (next.row < 0 || next.col < 0 || next.row >= 9 || next.col >= 9) return null;
  const nk = kOf(next);
  if (map.walls.has(nk)) return null;

  // Explorer steps onto a defender -> immediate loss.
  if (nk === st.h || nk === st.s) return { outcomes: [{ terminal: "LOSS" }] };

  // Light pickup, then trap arming, then the portal check.
  let lights = st.lights;
  const li = lightKeys.indexOf(nk);
  if (li >= 0) lights |= 1 << li;
  let traps = st.traps;
  const ti = trapKeys.indexOf(nk);
  if (ti >= 0) traps |= 1 << ti;

  const portalReady = lights === (1 << lightKeys.length) - 1;
  if (nk === kOf(map.exitPosition) && portalReady) {
    return { outcomes: [{ terminal: "WIN" }] };
  }

  // The trap armed on this step already blocks both defenders this turn.
  const armed = new Set();
  for (let i = 0; i < trapKeys.length; i += 1) if (traps & (1 << i)) armed.add(trapKeys[i]);

  const outcomes = [];
  const seen = new Set();
  for (const h of hunterSupport(toCell(st.h), next, map.exitPosition, map.walls, difficulty, armed)) {
    if (same(h, next)) { if (!seen.has("LOSS")) { seen.add("LOSS"); outcomes.push({ terminal: "LOSS" }); } continue; }
    const sentinelBefore = {
      position: toCell(st.s),
      target: st.t >= 0 ? toCell(accessKeys[st.t]) : null,
      commitLeft: st.c,
    };
    const after = API.decideSentinelMove(
      sentinelBefore, next, map.exitPosition, map.walls, zone, 3, armed,
    );
    // Shared destination: the Sentinel decides last and stays put.
    const sPos = same(after.position, h) && !same(after.position, sentinelBefore.position)
      ? sentinelBefore.position
      : after.position;
    if (same(sPos, next)) { if (!seen.has("LOSS")) { seen.add("LOSS"); outcomes.push({ terminal: "LOSS" }); } continue; }
    const state = {
      e: nk, h: kOf(h), s: kOf(sPos),
      t: after.target ? accessKeys.indexOf(kOf(after.target)) : -1,
      c: after.commitLeft, lights, traps,
    };
    const key = encode(state);
    if (seen.has(key)) continue;
    seen.add(key);
    outcomes.push({ state });
  }
  return { outcomes };
}

/* ---------------------------------------------------------- graph + solve --- */
export function explore(ctx, budget = 400_000) {
  const start = initialState(ctx);
  const startKey = encode(start);
  const nodes = new Map([[startKey, start]]);
  const edges = new Map(); // key -> [{ action, outcomeKeys, hasLoss, hasWin }]
  const queue = [startKey];
  let transitions = 0;
  let head = 0;
  let truncated = false;

  while (head < queue.length) {
    if (nodes.size > budget) { truncated = true; break; }
    const key = queue[head++];
    const st = nodes.get(key);
    const list = [];
    for (const action of ACTIONS) {
      const res = successors(ctx, st, action);
      if (!res) continue;
      const outcomeKeys = [];
      let hasWin = false;
      let hasLoss = false;
      for (const o of res.outcomes) {
        transitions += 1;
        if (o.terminal === "WIN") { hasWin = true; outcomeKeys.push("WIN"); continue; }
        if (o.terminal === "LOSS") { hasLoss = true; outcomeKeys.push("LOSS"); continue; }
        const ok = encode(o.state);
        outcomeKeys.push(ok);
        if (!nodes.has(ok)) { nodes.set(ok, o.state); queue.push(ok); }
      }
      list.push({ action: action.name, outcomeKeys, hasWin, hasLoss });
    }
    edges.set(key, list);
  }
  return { start: startKey, nodes, edges, transitions, truncated, explored: nodes.size };
}

/** EXISTENTIAL: Explorer = OR, RNG = OR. Backward closure from WIN. */
export function existential(graph) {
  const winning = new Set(["WIN"]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [key, list] of graph.edges) {
      if (winning.has(key)) continue;
      for (const e of list) {
        if (e.outcomeKeys.some((o) => winning.has(o))) { winning.add(key); changed = true; break; }
      }
    }
  }
  return winning;
}

/** GUARANTEED: Explorer = OR, RNG = AND. Greatest fixpoint from WIN. */
export function guaranteed(graph) {
  const winning = new Set(["WIN"]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const [key, list] of graph.edges) {
      if (winning.has(key)) continue;
      for (const e of list) {
        if (e.outcomeKeys.length > 0 && e.outcomeKeys.every((o) => winning.has(o))) {
          winning.add(key); changed = true; break;
        }
      }
    }
  }
  return winning;
}

/** Shortest existential witness, as a list of { action, stateKey }. */
export function witness(graph, winning) {
  if (!winning.has(graph.start)) return null;
  const path = [];
  let cur = graph.start;
  const guard = new Set();
  while (cur !== "WIN" && !guard.has(cur)) {
    guard.add(cur);
    const list = graph.edges.get(cur) ?? [];
    let picked = null;
    for (const e of list) {
      const target = e.outcomeKeys.find((o) => winning.has(o));
      if (target) { picked = { action: e.action, next: target }; break; }
    }
    if (!picked) return path;
    path.push({ action: picked.action, state: picked.next });
    cur = picked.next;
  }
  return path;
}

export function classify(graph, existentialSet, guaranteedSet) {
  if (graph.truncated) return "INCONCLUSIVE_RESOURCE_LIMIT";
  if (guaranteedSet.has(graph.start)) return "GUARANTEED_SOLVABLE_PRE_CHEST";
  if (existentialSet.has(graph.start)) return "POSSIBLE_BUT_NOT_GUARANTEED_PRE_CHEST";
  return "PROVED_UNSOLVABLE_PRE_CHEST";
}
