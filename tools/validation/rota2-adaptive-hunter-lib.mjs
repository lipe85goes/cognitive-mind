/**
 * ROTA2-ADAPTIVE-HUNTER-04 — what the adaptive-Hunter suite and its census share.
 *
 *   - `contractInterception`  the mission's rules read literally, with production geometry (`findPathLength` with a
 *                             blocked set) for every distance. A JUDGE: no solver and no production code calls it; the
 *                             production policy (`route-hunter-intercept.ts`) is held against it.
 *   - `INSTRUMENT`            read-only recorder lines: every domain event; the order the defenders' policies are asked
 *                             in (H the pursuit, I the interception pick, S the Sentinel); every Sentinel decision input.
 *                             The same anchors on the base and today (the interception pick only exists today).
 *   - `playGame` / `POLICIES` the REAL hook through the runtime harness under scripted Explorers; every action recorded
 *                             with the state before and after, the events, the draws and the ask order. `trackedPrevious`
 *                             is the script's own memory of the last successful direction — it never reads the hook's.
 *   - `analyseTurn`           what the contract, the tree's policy module and the reference pursuit say about one turn.
 *
 * Writes nothing.
 */
import { cellKey, pathBetween, sameCell } from "./route-runtime-harness.mjs";
import { ACTIONS, API as REFERENCE_API, hunterSupport as referenceHunterSupport } from "./dynamic-solver.mjs";
import { cellId } from "./rota2-sentinel-solver-fidelity-lib.mjs";
import { directionCodeOf } from "./hunter-interception-support.mjs";

export const ADAPTIVE_BASE = "ec3e564a47b7fad8421bfae34fcbda32acebe043";
export const INTERCEPT_MESSAGE = "O Caçador tenta cortar seu caminho.";
export const DIFFICULTIES = ["easy", "medium", "hard"];
export const ROUTES = [1, 2, 3];
export const DIRECTIONS = ["up", "down", "left", "right"];
export const DELTA = { up: { row: -1, col: 0 }, down: { row: 1, col: 0 }, left: { row: 0, col: -1 }, right: { row: 0, col: 1 } };
export const NEIGHBOUR_ORDER = ["up", "down", "left", "right"];
export const manhattan = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
export const inBoard = (c) => c.row >= 0 && c.row < 9 && c.col >= 0 && c.col < 9;
export const add = (c, d, k = 1) => ({ row: c.row + d.row * k, col: c.col + d.col * k });
export const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const directionOf = (from, to) => DIRECTIONS.find((d) => DELTA[d].row === to.row - from.row && DELTA[d].col === to.col - from.col) ?? null;
export const actionIndexOf = (direction) => ACTIONS.findIndex((a) => a.row === DELTA[direction].row && a.col === DELTA[direction].col);
export const cellOfKey = (key) => {
  const [row, col] = key.split(",").map(Number);
  return { row, col };
};
export const lcgFrom = (seed) => {
  let state = (seed * 2654435761) >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32);
};
export const tally = (object, key, by = 1) => {
  object[key] = (object[key] ?? 0) + by;
};
export const planKey = (plan) => (plan === null || plan === undefined ? "null" : `${cellKey(plan.target)}@${plan.horizon}:${plan.moves.map(cellKey).join(";")}`);

// =================================================================================================
// the contract checker
// =================================================================================================

/**
 * What the mission says the Hunter does on this turn: null (the pursuit decides) or { target, horizon, moves }.
 *
 *   - Routes 2 and 3 only; a step whose direction equals the previous successful step's; the Hunter not already next
 *     to the Explorer.
 *   - From the mode's horizon (easy 1, medium 1, hard 2) down to 1: every cell from the Explorer to the prediction is
 *     on the board and not a wall of the current maze; the prediction is a cell the Hunter may stand on (not a wall,
 *     the portal, an armed trap or the Sentinel) and is not the Hunter's own cell; Easy — the Hunter steps onto it with
 *     this move; Medium/Hard — the legal moves one step closer to it, distances by production `findPathLength` on the
 *     current walls with the portal, the armed traps, the Sentinel and the Explorer blocked.
 *   - The first prediction with a move wins; moves in the board's neighbour order (up, down, left, right).
 */
export function contractInterception({ route, difficulty, previous, direction, hunter, explorer, exit, walls, blocked }) {
  if (route < 2) return null;
  if (!direction || previous !== direction) return null;
  if (manhattan(hunter, explorer) <= 1) return null;
  const horizon = difficulty === "hard" ? 2 : 1;
  const hunterMay = (c) => inBoard(c) && !walls.has(cellKey(c)) && !sameCell(c, exit) && !blocked.has(cellKey(c));
  const obstacles = new Set([...blocked, cellKey(exit), cellKey(explorer)]);
  const legal = NEIGHBOUR_ORDER.map((d) => add(hunter, DELTA[d])).filter(hunterMay);
  for (let k = horizon; k >= 1; k -= 1) {
    const cells = Array.from({ length: k }, (_, i) => add(explorer, DELTA[direction], i + 1));
    if (!cells.every((c) => inBoard(c) && !walls.has(cellKey(c)))) continue;
    const target = cells[k - 1];
    if (!hunterMay(target) || sameCell(target, hunter)) continue;
    let moves;
    if (difficulty === "easy") moves = legal.filter((c) => sameCell(c, target));
    else {
      const fromHunter = REFERENCE_API.findPathLength(hunter, target, walls, obstacles);
      moves = fromHunter === null ? [] : legal.filter((c) => REFERENCE_API.findPathLength(c, target, walls, obstacles) === fromHunter - 1);
    }
    if (moves.length > 0) return { target, horizon: k, moves };
  }
  return null;
}

// =================================================================================================
// instrumentation
// =================================================================================================

const shapeChanged = (what) => new Error(`rota2-adaptive-hunter: anchor not found (${what})`);
function insertAfter(source, anchor, line, what, { optional = false } = {}) {
  const parts = source.split(anchor).length;
  if (parts === 1 && optional) return source;
  if (parts !== 2) throw shapeChanged(what);
  return source.replace(anchor, `${anchor}${line}`);
}
export const INSTRUMENT = {
  "src/games/escape-maze/route-events.ts": (source) =>
    insertAfter(source, "): RouteStateAction[] {\n", "  (globalThis as any).__ah?.events.push(event);\n", "routeStateActionsForEvent"),
  "src/games/escape-maze/route-defenders.ts": (source) => {
    let text = insertAfter(
      source,
      "  blockedForDefenders: Set<string> = EMPTY_BLOCKED,\n): GridPosition {\n",
      "  (globalThis as any).__ah?.order.push(\"H\");\n",
      "chooseGuardianMove",
    );
    text = insertAfter(
      text,
      "  blockedForDefenders: Set<string> = EMPTY_BLOCKED,\n): SentinelState {\n",
      "  (globalThis as any).__ah?.order.push(\"S\");\n  if ((globalThis as any).__ah?.recordSentinel) (globalThis as any).__ah.sentinel.push({ state: { ...state }, playerPosition: { ...playerPosition }, exitPosition: { ...exitPosition }, walls: [...walls], zone, commitTurns, blocked: [...blockedForDefenders] });\n",
      "decideSentinelMove",
    );
    return insertAfter(text, "  moves: readonly GridPosition[],\n): GridPosition {\n", "  (globalThis as any).__ah?.order.push(\"I\");\n", "chooseInterceptionMove", { optional: true });
  },
};
/** The recorder's store on a loaded runtime. `recordSentinel` keeps every Sentinel decision input (H27). */
export function attachTrace(rt, { recordSentinel = false } = {}) {
  rt.LAB.sb.__ah = { events: [], order: [], sentinel: [], recordSentinel };
  return rt.LAB.sb.__ah;
}
/** Every value the Rota's stream hands out, in order (the harness seeds the sandbox's Math.random). */
export function drawLogOf(rt) {
  const math = rt.LAB.sb.Math;
  if (math.__adaptiveLog) return math.__adaptiveLog;
  const log = { values: [] };
  const draw = math.random;
  math.random = () => {
    const value = draw();
    log.values.push(value);
    return value;
  };
  math.__adaptiveLog = log;
  return log;
}

// =================================================================================================
// the real hook, scripted
// =================================================================================================

export const snapshot = (g) => ({
  status: g.status,
  message: g.message,
  turns: g.turns,
  errors: g.errors,
  player: { ...g.player },
  guardian: { ...g.guardian },
  sentinel: { ...g.sentinel },
  sentinelTarget: g.sentinelTarget ? { ...g.sentinelTarget } : null,
  sentinelCommitLeft: g.sentinelCommitLeft,
  walls: new Set(g.walls),
  armed: new Set(g.triggeredTrapSet),
  collected: new Set(g.collectedSet),
  chestOpened: g.chestOpened,
  rewardSelected: g.rewardSelected,
  rewardSpent: g.rewardSpent,
  rewardChoicePending: g.rewardChoicePending,
  lastExplorerDirection: g.lastExplorerDirection,
  portalActive: g.portalActive,
  passageRequired: Boolean(g.objectives?.passage?.required),
  trapOpenedWalls: [...(g.trapOpenedWalls ?? [])],
  valid: g.dynamicSolvability?.valid ?? true,
  solvable: g.dynamicSolvability?.topologicallySolvable ?? true,
});

export const legalDirections = (g, { avoidDefenders = true, chest = true } = {}) =>
  DIRECTIONS.filter((d) => {
    const c = add(g.player, DELTA[d]);
    if (!inBoard(c) || g.walls.has(cellKey(c))) return false;
    if (avoidDefenders && (sameCell(c, g.guardian) || sameCell(c, g.sentinel))) return false;
    if (!chest && g.mazeMap.chest && sameCell(c, g.mazeMap.chest) && !g.chestOpened) return false;
    return true;
  });
export const towards = (g, goal, { chest = true } = {}) => {
  const blocked = new Set([...g.walls, cellKey(g.guardian), cellKey(g.sentinel)]);
  if (!chest && g.mazeMap.chest && !g.chestOpened) blocked.add(cellKey(g.mazeMap.chest));
  blocked.delete(cellKey(goal));
  const route = pathBetween(g.player, goal, blocked);
  return route && route.length >= 2 ? directionOf(g.player, route[1]) : null;
};
export const goalOf = (g, { trapFirst = false } = {}) => {
  const link = (g.mazeMap.trapLinks ?? [])[0] ?? null;
  const lightsLeft = g.mazeMap.collectibleStars.filter((s) => !g.collectedSet.has(cellKey(s)));
  if (trapFirst && link && !g.triggeredTrapSet.has(link.trap)) return cellOfKey(link.trap);
  if (lightsLeft.length) return lightsLeft[0];
  if (link && !g.triggeredTrapSet.has(link.trap)) return cellOfKey(link.trap);
  return g.mazeMap.exitPosition;
};

/** Explorer policies. All but `mixed` avoid the Chest; all avoid stepping onto a defender. */
export const POLICIES = {
  // Keeps going the way it went while it can (the pattern), turns when it must; drifts toward its goal.
  straight: (g, ctx) => {
    const legal = legalDirections(g, { chest: false });
    if (!legal.length) return null;
    if (ctx.lastDirection && legal.includes(ctx.lastDirection) && ctx.rand() < 0.7) return { kind: "move", direction: ctx.lastDirection };
    const toward = towards(g, goalOf(g, { trapFirst: ctx.spec.trapFirst }), { chest: false });
    if (toward && ctx.rand() < 0.7) return { kind: "move", direction: toward };
    return { kind: "move", direction: legal[Math.floor(ctx.rand() * legal.length)] };
  },
  // Never repeats a direction when it has another legal one.
  turner: (g, ctx) => {
    const legal = legalDirections(g, { chest: false });
    if (!legal.length) return null;
    const others = legal.filter((d) => d !== ctx.lastDirection);
    const pool = others.length ? others : legal;
    const toward = towards(g, goalOf(g), { chest: false });
    if (toward && pool.includes(toward) && ctx.rand() < 0.6) return { kind: "move", direction: toward };
    return { kind: "move", direction: pool[Math.floor(ctx.rand() * pool.length)] };
  },
  // The linked trap first (its wall opens), then straight runs — the opened topology under the interception.
  linkRunner: (g, ctx) => {
    const link = (g.mazeMap.trapLinks ?? [])[0] ?? null;
    const legal = legalDirections(g, { chest: false });
    if (!legal.length) return null;
    if (link && !g.triggeredTrapSet.has(link.trap)) {
      const toward = towards(g, cellOfKey(link.trap), { chest: false });
      if (toward) return { kind: "move", direction: toward };
    }
    if (ctx.lastDirection && legal.includes(ctx.lastDirection) && ctx.rand() < 0.8) return { kind: "move", direction: ctx.lastDirection };
    if (link && ctx.rand() < 0.6) {
      const toward = towards(g, cellOfKey(link.mutation.wall), { chest: false });
      if (toward) return { kind: "move", direction: toward };
    }
    return { kind: "move", direction: legal[Math.floor(ctx.rand() * legal.length)] };
  },
  // Chest, a reward, a blocked bump now and then, the Pickaxe on an adjacent wall.
  mixed: (g, ctx) => {
    if (g.pickaxeAvailable && g.breakTargets?.length && ctx.rand() < 0.25) return { kind: "break", wall: g.breakTargets[Math.floor(ctx.rand() * g.breakTargets.length)].cell };
    if (ctx.rand() < 0.08) {
      const bump = DIRECTIONS.find((d) => {
        const c = add(g.player, DELTA[d]);
        return !inBoard(c) || g.walls.has(cellKey(c));
      });
      if (bump) return { kind: "move", direction: bump };
    }
    const legal = legalDirections(g);
    if (!legal.length) return null;
    const goal = g.mazeMap.chest && !g.chestOpened && ctx.steps < 40 ? g.mazeMap.chest : goalOf(g);
    if (ctx.lastDirection && legal.includes(ctx.lastDirection) && ctx.rand() < 0.4) return { kind: "move", direction: ctx.lastDirection };
    const toward = towards(g, goal);
    if (toward && ctx.rand() < 0.75) return { kind: "move", direction: toward };
    return { kind: "move", direction: legal[Math.floor(ctx.rand() * legal.length)] };
  },
};

/**
 * One game on `rt`. `policy(g, ctx)` returns { kind: "move", direction } | { kind: "break", wall } | null (stop); a
 * pending Chest is answered with `spec.reward`. Every action is recorded; `onRender` sees every render.
 */
export function playGame(rt, rtTrace, rtDraws, spec, policy, { maxActions = 120, onRender = null } = {}) {
  const run = rt.mount({ seed: spec.seed, difficulty: spec.difficulty, routeNumber: spec.route, onRender });
  const map = run.state.mazeMap;
  const turns = [];
  const ctx = { rand: lcgFrom(spec.seed + spec.route * 7 + DIFFICULTIES.indexOf(spec.difficulty) * 13), map, lastDirection: null, steps: 0, spec };
  let tracked = null;
  let stopped = "budget";
  for (let i = 0; i < maxActions; i += 1) {
    if (run.state.status !== "playing") {
      stopped = run.state.status;
      break;
    }
    const g = run.state;
    const action = g.rewardChoicePending ? { kind: "choose", reward: spec.reward ?? "second-chance" } : policy(g, ctx);
    if (!action) {
      stopped = "no-move";
      break;
    }
    const before = snapshot(g);
    rtTrace.events.length = 0;
    rtTrace.order.length = 0;
    const drawStart = rtDraws.values.length;
    if (action.kind === "move") run.move(DELTA[action.direction]);
    else if (action.kind === "choose") run.choose(action.reward);
    else if (action.kind === "break") run.break(action.wall);
    const after = snapshot(run.state);
    const stepped = action.kind === "move" && after.turns === before.turns + 1 && !sameCell(after.player, before.player);
    turns.push({
      spec, map, k: turns.length, action, before, after, stepped,
      trackedPrevious: tracked,
      events: rtTrace.events.map((e) => ({ ...e })),
      order: [...rtTrace.order],
      draws: rtDraws.values.slice(drawStart),
    });
    if (stepped) {
      tracked = action.direction;
      ctx.lastDirection = action.direction;
    }
    ctx.steps += 1;
  }
  if (run.state.status !== "playing") stopped = run.state.status;
  return { run, map, turns, stopped };
}

// =================================================================================================
// one turn, read
// =================================================================================================

/** The Hunter's cell after the defenders answered, when the turn shows it (not after a Second Chance roll-back). */
export const settledHunter = (turn) => {
  const settle = turn.events.find((e) => e.type === "DEFENDERS_SETTLED" || (e.type === "EXPLORER_CAPTURED" && e.by !== "explorer-step"));
  return settle ? settle.guardian : null;
};

/** The defenders answer a step on this turn: a successful step, the Chest not opened, the Route not won. */
export const answered = (turn) => turn.stepped && !turn.after.rewardChoicePending && turn.after.status !== "won";

/**
 * Annotates an answered turn: the interception input as the hook builds it (maze after the step, armed traps and the
 * Sentinel's cell blocked), the contract's plan, the tree's module's plan, the reference pursuit support, the Hunter's
 * observed cell. `intercept` is the tree's policy module (or null).
 */
export function analyseTurn(turn, intercept) {
  if (!answered(turn)) return turn;
  const input = {
    route: turn.spec.route,
    difficulty: turn.spec.difficulty,
    previous: turn.trackedPrevious,
    direction: turn.action.direction,
    hunter: turn.before.guardian,
    explorer: turn.after.player,
    exit: turn.map.exitPosition,
    walls: turn.after.walls,
    blocked: new Set([...turn.after.armed, cellKey(turn.before.sentinel)]),
  };
  turn.input = input;
  turn.contract = contractInterception(input);
  turn.helper = modulePlan(intercept, input);
  turn.legacy = referenceHunterSupport(input.hunter, input.explorer, input.exit, input.walls, input.difficulty, turn.after.armed, turn.before.sentinel);
  turn.hunterAfter = settledHunter(turn);
  turn.secondChanceByDefender = turn.events.some((e) => e.type === "SECOND_CHANCE_USED" && e.cause !== "explorer");
  turn.repeat = input.previous !== null && input.previous === input.direction;
  turn.observed = turn.hunterAfter !== null && !turn.secondChanceByDefender;
  return turn;
}

/** The tree's module asked as the hook asks it, or null when the tree has none. */
export const modulePlan = (intercept, input) =>
  intercept
    ? intercept.planHunterInterception({
      routeNumber: input.route, difficulty: input.difficulty, previousDirection: input.previous, direction: input.direction,
      hunter: input.hunter, explorer: input.explorer, exitPosition: input.exit, walls: input.walls, blocked: input.blocked,
    })
    : null;

/** A recorded state in canonical form (cells as ids, held door as a cell, `d` the remembered direction). */
export function canonicalOf(turn, which) {
  const g = turn[which];
  let lights = 0;
  turn.map.collectibleStars.forEach((s, i) => {
    if (g.collected.has(cellKey(s))) lights |= 1 << i;
  });
  let traps = 0;
  turn.map.traps.forEach((t, i) => {
    if (g.armed.has(cellKey(t))) traps |= 1 << i;
  });
  return {
    e: cellId(g.player), h: cellId(g.guardian), s: cellId(g.sentinel),
    target: g.sentinelTarget ? cellId(g.sentinelTarget) : -1, c: g.sentinelCommitLeft, lights, traps,
    d: directionCodeOf(which === "before" ? turn.trackedPrevious : turn.action.direction),
  };
}
