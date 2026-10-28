/**
 * ROTA2-ADAPTIVE-HUNTER-04 — the first pattern-aware Hunter, asserted.
 *
 * On Routes 2 and 3, a step that repeats the direction of the Explorer's previous successful step lets the Hunter
 * try to get ahead of it: it predicts a cell along that direction (Easy and Medium one cell, Hard up to two) and takes
 * a legal one-cell move that shortens its shortest path to it on the CURRENT maze; when nothing works, the usual
 * pursuit decides. Route 1 never adapts. One remembered fact (`lastExplorerDirection`), one shared pure policy
 * (`route-hunter-intercept.ts`) that the hook and both reference solvers call.
 *
 * Everything is held against production and against the mission's text, never against another copy of the policy:
 *   - the REAL hook (route-runtime-harness.mjs) of the tree under test (the working tree, a `--rev`, or a mutant);
 *   - the CONTRACT CHECKER below — the mission's rules read literally, with production geometry (`findPathLength` with
 *     a blocked set) for every distance. It is a judge only: no solver and no production code calls it;
 *   - the tree's own policy module (when it has one), the production-backed oracle (`oracleSuccessors`), the static
 *     packed solver and the Rota 2.0 dynamic solver of the tree;
 *   - the exact base (`ec3e564`) for everything that must not move: Route 1 render for render and draw for draw, the
 *     pre-mission solvers' Route 1 support, the Sentinel's every decision.
 *
 * Checks are tagged:
 *   [adaptive]   the new behaviour or representation — must FAIL on the base (`--rev=ec3e564`) and PASS here. Safety
 *                checks of the interception (H15–H18) are [adaptive] too: they require the branch to have run;
 *   [preserved]  what the mission must not disturb — must PASS on the base and here.
 *
 * Usage:
 *   node tools/validation/rota2-adaptive-hunter-tests.mjs                # H01–H32 (check evidence)
 *   node tools/validation/rota2-adaptive-hunter-tests.mjs --update       # rewrite the evidence
 *   node tools/validation/rota2-adaptive-hunter-tests.mjs --rev=ec3e564  # counterfactual: every [adaptive] check
 *        fails, every [preserved] check holds. Writes nothing.
 *   node tools/validation/rota2-adaptive-hunter-tests.mjs --mutants      # M01–M25, each caught by a check it targets.
 *        Writes nothing.
 *
 * Exit: 0 pass · 1 a check (or counterfactual/mutant expectation) failed · 2 evidence diverged · 3 usage.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import ts from "typescript";

import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED, openEvidence } from "./evidence.mjs";
import { cellKey, loadRouteRuntime, pathBetween, sameCell, walkableNeighbours } from "./route-runtime-harness.mjs";
import { ACTIONS, API as REFERENCE_API, HUNTER_INTERCEPT_MODULE, buildContext, hunterSupport as referenceHunterSupport } from "./dynamic-solver.mjs";
import { decodePackedKey, packState, unpackState, packedStateContract } from "./dynamic-solver-packed.mjs";
import {
  INTERCEPT_ADAPTER_FILE,
  PACKED_FILE,
  ROTA2_FILE,
  canon,
  canonD,
  cellId,
  cellOf,
  keyOf,
  loadSolvers,
  oracleContext,
  oracleSuccessors,
  packedAnswer,
  productionIntercept,
  rota2Answer,
} from "./rota2-sentinel-solver-fidelity-lib.mjs";
import { DIRECTION_CODES, directionCodeOf } from "./hunter-interception-support.mjs";

export const ADAPTIVE_BASE = "ec3e564a47b7fad8421bfae34fcbda32acebe043";
const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const ROTA = "src/games/escape-maze/";
const FILES = {
  hook: `${ROTA}useEscapeMaze.ts`,
  events: `${ROTA}route-events.ts`,
  state: `${ROTA}route-state.ts`,
  defenders: `${ROTA}route-defenders.ts`,
  objectives: `${ROTA}route-objectives.ts`,
  invariants: `${ROTA}route-invariants.ts`,
  intercept: HUNTER_INTERCEPT_MODULE,
  scoring: "src/engine/scoring.ts",
};
const INTERCEPT_MESSAGE = "O Caçador tenta cortar seu caminho.";

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
const MUTANTS = args.includes("--mutants");
const known = new Set([revArg, "--mutants", "--check", "--update"].filter(Boolean));
if (args.some((arg) => !known.has(arg)) || REV === "" || (REV && MUTANTS)) {
  console.error("usage: node tools/validation/rota2-adaptive-hunter-tests.mjs [--check|--update] [--rev=<commit> | --mutants]");
  process.exit(EXIT_USAGE);
}

// =================================================================================================
// instrumentation — read-only recorder lines, the same anchors on the base and today
// =================================================================================================

const shapeChanged = (what) => new Error(`rota2-adaptive-hunter-tests: anchor not found (${what})`);
function insertAfter(source, anchor, line, what, { optional = false } = {}) {
  const parts = source.split(anchor).length;
  if (parts === 1 && optional) return source;
  if (parts !== 2) throw shapeChanged(what);
  return source.replace(anchor, `${anchor}${line}`);
}
/**
 * Every domain event; the order the defenders' policies are asked in (H: the pursuit, I: the interception pick, S: the
 * Sentinel); and the Sentinel's every decision input, re-decided on the base by H27.
 */
const INSTRUMENT = {
  [FILES.events]: (source) =>
    insertAfter(source, "): RouteStateAction[] {\n", "  (globalThis as any).__ah?.events.push(event);\n", "routeStateActionsForEvent"),
  [FILES.defenders]: (source) => {
    let text = insertAfter(
      source,
      "  blockedForDefenders: Set<string> = EMPTY_BLOCKED,\n): GridPosition {\n",
      "  (globalThis as any).__ah?.order.push(\"H\");\n",
      "chooseGuardianMove",
    );
    text = insertAfter(
      text,
      "  blockedForDefenders: Set<string> = EMPTY_BLOCKED,\n): SentinelState {\n",
      "  (globalThis as any).__ah?.order.push(\"S\");\n  (globalThis as any).__ah?.sentinel.push({ state: { ...state }, playerPosition: { ...playerPosition }, exitPosition: { ...exitPosition }, walls: [...walls], zone, commitTurns, blocked: [...blockedForDefenders] });\n",
      "decideSentinelMove",
    );
    // A tree before the mission has no interception pick.
    return insertAfter(text, "  moves: readonly GridPosition[],\n): GridPosition {\n", "  (globalThis as any).__ah?.order.push(\"I\");\n", "chooseInterceptionMove", { optional: true });
  },
};

// =================================================================================================
// small helpers
// =================================================================================================

const DIFFICULTIES = ["easy", "medium", "hard"];
const ROUTES = [1, 2, 3];
const DIRECTIONS = ["up", "down", "left", "right"];
const DELTA = { up: { row: -1, col: 0 }, down: { row: 1, col: 0 }, left: { row: 0, col: -1 }, right: { row: 0, col: 1 } };
const NEIGHBOUR_ORDER = ["up", "down", "left", "right"];
const manhattan = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
const inBoard = (c) => c.row >= 0 && c.row < 9 && c.col >= 0 && c.col < 9;
const add = (c, d, k = 1) => ({ row: c.row + d.row * k, col: c.col + d.col * k });
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const directionOf = (from, to) => DIRECTIONS.find((d) => DELTA[d].row === to.row - from.row && DELTA[d].col === to.col - from.col) ?? null;
const actionIndexOf = (direction) => ACTIONS.findIndex((a) => a.row === DELTA[direction].row && a.col === DELTA[direction].col);
const lcgFrom = (seed) => {
  let state = (seed * 2654435761) >>> 0;
  return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 2 ** 32);
};
const tally = (object, key, by = 1) => {
  object[key] = (object[key] ?? 0) + by;
};

function readFromRev(rev, file) {
  try {
    if (!rev) return fs.readFileSync(path.join(REPO_ROOT, file), "utf8").replace(/\r\n/g, "\n");
    return execFileSync("git", ["show", `${rev}:${file}`], { cwd: REPO_ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).replace(/\r\n/g, "\n");
  } catch {
    return null;
  }
}

/** Members of an interface, or the tag literals of a union, read from a file's text. */
function declared(source, file, name, { tag = null } = {}) {
  if (source === null) return null;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  for (const st of sf.statements) {
    if (ts.isInterfaceDeclaration(st) && st.name.text === name) return st.members.filter(ts.isPropertySignature).map((m) => m.name.getText(sf)).sort();
    if (ts.isTypeAliasDeclaration(st) && st.name.text === name) {
      const out = [];
      const walk = (t) => {
        if (ts.isUnionTypeNode(t)) t.types.forEach(walk);
        else if (ts.isParenthesizedTypeNode(t)) walk(t.type);
        else if (ts.isIntersectionTypeNode(t)) t.types.forEach(walk);
        else if (tag && ts.isTypeLiteralNode(t)) {
          for (const m of t.members) {
            if (ts.isPropertySignature(m) && m.name.getText(sf) === tag && m.type && ts.isLiteralTypeNode(m.type) && ts.isStringLiteral(m.type.literal)) out.push(m.type.literal.text);
          }
        } else if (!tag && ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)) out.push(t.literal.text);
      };
      walk(st.type);
      return out.sort();
    }
  }
  return null;
}

// =================================================================================================
// the contract checker — the mission's rules, read literally (a judge; nothing else calls it)
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
const planKey = (plan) => (plan === null || plan === undefined ? "null" : `${cellKey(plan.target)}@${plan.horizon}:${plan.moves.map(cellKey).join(";")}`);

// =================================================================================================
// the suite
// =================================================================================================

async function runSuite({ rev = null, transforms = [], solverEdits = {}, quiet = false } = {}) {
  const log = quiet ? () => {} : (...m) => console.log(...m);
  const results = [];
  const record = (id, tag, name, pass, detail = {}) => {
    results.push({ id, tag, name, pass: Boolean(pass), detail });
    log(`${pass ? "PASS" : "FAIL"}  ${id} [${tag}] — ${name}`);
    for (const [k, v] of Object.entries(detail)) {
      const text = typeof v === "object" ? JSON.stringify(v) : String(v);
      log(`        ${k}: ${text.length > 400 ? `${text.slice(0, 397)}...` : text}`);
    }
  };
  const guarded = async (id, tag, name, fn) => {
    try {
      const { pass, ...detail } = await fn();
      record(id, tag, name, pass, detail);
    } catch (error) {
      record(id, tag, name, false, { error: String(error?.stack ?? error).split("\n").slice(0, 3).join(" | ") });
    }
  };

  // --- the tree under test, and the base ----------------------------------------------------------------------------
  const RT = loadRouteRuntime({ directDifficulty: true, rev, transforms: [INSTRUMENT, transforms] });
  const PRE = loadRouteRuntime({ directDifficulty: true, rev: ADAPTIVE_BASE, transforms: [INSTRUMENT] });
  for (const rt of [RT, PRE]) rt.LAB.sb.__ah = { events: [], order: [], sentinel: [] };
  const trace = RT.LAB.sb.__ah;
  const preTrace = PRE.LAB.sb.__ah;
  const textOf = (file) => {
    const text = readFromRev(rev, file);
    const fn = transforms && !Array.isArray(transforms) ? transforms[file] : null;
    return text !== null && fn ? fn(text) : text;
  };
  const baseText = (file) => readFromRev(ADAPTIVE_BASE, file);
  /** The tree's interception module — the very instance its hook runs — or null (a tree before the mission). */
  const intercept = productionIntercept(RT);
  const solvers = await loadSolvers({ rev, edits: solverEdits });
  const preSolvers = await loadSolvers({ rev: ADAPTIVE_BASE });
  const generate = (rt, seed, difficulty, route) => {
    rt.LAB.setSeed(seed);
    return rt.API.generateMaze(difficulty, route);
  };

  // Draw log: every value the Rota's stream hands out, in order (the harness seeds the sandbox's Math.random).
  const drawLogOf = (rt) => {
    const math = rt.LAB.sb.Math;
    const log = { values: [] };
    const draw = math.random;
    math.random = () => {
      const value = draw();
      log.values.push(value);
      return value;
    };
    return log;
  };
  const draws = drawLogOf(RT);
  const preDraws = drawLogOf(PRE);

  // --- fixtures: the real hook, scripted Explorers, every turn recorded ---------------------------------------------

  const snapshot = (g) => ({
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
  });

  /**
   * One game. `policy(g, ctx)` returns { kind: "move", direction } | { kind: "choose", reward } | { kind: "break", wall }
   * | null (stop). Every action is recorded with the state before and after, the events, the draws and the defenders'
   * ask order; `tracked` is the suite's own memory of the last successful direction (it never reads the hook's).
   */
  function playGame(rt, rtTrace, rtDraws, spec, policy, { maxActions = 120, onRender = null } = {}) {
    const run = rt.mount({ seed: spec.seed, difficulty: spec.difficulty, routeNumber: spec.route, onRender });
    const map = run.state.mazeMap;
    const turns = [];
    const ctx = { rand: lcgFrom(spec.seed + spec.route * 7 + DIFFICULTIES.indexOf(spec.difficulty) * 13), map, lastDirection: null, steps: 0, spec };
    let tracked = null;
    for (let i = 0; i < maxActions && run.state.status === "playing"; i += 1) {
      const g = run.state;
      const action = g.rewardChoicePending ? { kind: "choose", reward: spec.reward ?? "second-chance" } : policy(g, ctx);
      if (!action) break;
      const before = snapshot(g);
      rtTrace.events.length = 0;
      rtTrace.order.length = 0;
      const drawStart = rtDraws.values.length;
      if (action.kind === "move") run.move(DELTA[action.direction]);
      else if (action.kind === "choose") run.choose(action.reward);
      else if (action.kind === "break") run.break(action.wall);
      const after = snapshot(run.state);
      const stepped = action.kind === "move" && after.turns === before.turns + 1 && !sameCell(after.player, before.player);
      const turn = {
        spec, map, k: turns.length, action, before, after, stepped,
        trackedPrevious: tracked,
        events: rtTrace.events.map((e) => ({ ...e })),
        order: [...rtTrace.order],
        draws: rtDraws.values.slice(drawStart),
      };
      turns.push(turn);
      if (stepped) {
        tracked = action.direction;
        ctx.lastDirection = action.direction;
      }
      ctx.steps += 1;
    }
    return { run, map, turns };
  }

  // Explorer policies. All avoid stepping onto a defender (a capture by the Explorer's own step tells nothing).
  const legalDirections = (g, { avoidDefenders = true, chest = true } = {}) =>
    DIRECTIONS.filter((d) => {
      const c = add(g.player, DELTA[d]);
      if (!inBoard(c) || g.walls.has(cellKey(c))) return false;
      if (avoidDefenders && (sameCell(c, g.guardian) || sameCell(c, g.sentinel))) return false;
      if (!chest && g.mazeMap.chest && sameCell(c, g.mazeMap.chest) && !g.chestOpened) return false;
      return true;
    });
  const towards = (g, goal, { chest = true } = {}) => {
    const blocked = new Set([...g.walls, cellKey(g.guardian), cellKey(g.sentinel)]);
    if (!chest && g.mazeMap.chest && !g.chestOpened) blocked.add(cellKey(g.mazeMap.chest));
    blocked.delete(cellKey(goal));
    const route = pathBetween(g.player, goal, blocked);
    return route && route.length >= 2 ? directionOf(g.player, route[1]) : null;
  };
  const goalOf = (g, { trapFirst = false } = {}) => {
    const link = (g.mazeMap.trapLinks ?? [])[0] ?? null;
    const linkTrap = link ? cellOf(cellId({ row: +link.trap.split(",")[0], col: +link.trap.split(",")[1] })) : null;
    const lightsLeft = g.mazeMap.collectibleStars.filter((s) => !g.collectedSet.has(cellKey(s)));
    if (trapFirst && linkTrap && !g.triggeredTrapSet.has(link.trap)) return linkTrap;
    if (lightsLeft.length) return lightsLeft[0];
    if (linkTrap && !g.triggeredTrapSet.has(link.trap)) return linkTrap;
    return g.mazeMap.exitPosition;
  };
  const POLICIES = {
    // Keeps going the way it went while it can (the pattern), turns when it must; drifts toward its goal.
    straight: (g, ctx) => {
      const legal = legalDirections(g, { chest: false });
      if (!legal.length) return null;
      if (ctx.lastDirection && legal.includes(ctx.lastDirection) && ctx.rand() < 0.7) return { kind: "move", direction: ctx.lastDirection };
      const toward = towards(g, goalOf(g, { trapFirst: ctx.spec.trapFirst }), { chest: false });
      if (toward && ctx.rand() < 0.7) return { kind: "move", direction: toward };
      return { kind: "move", direction: legal[Math.floor(ctx.rand() * legal.length)] };
    },
    // Never repeats a direction when it has another legal one (H06).
    turner: (g, ctx) => {
      const legal = legalDirections(g, { chest: false });
      if (!legal.length) return null;
      const others = legal.filter((d) => d !== ctx.lastDirection);
      const pool = others.length ? others : legal;
      const toward = towards(g, goalOf(g), { chest: false });
      if (toward && pool.includes(toward) && ctx.rand() < 0.6) return { kind: "move", direction: toward };
      return { kind: "move", direction: pool[Math.floor(ctx.rand() * pool.length)] };
    },
    // The linked trap first (its wall opens), then straight runs — the opened topology under the interception (H26).
    linkRunner: (g, ctx) => {
      const link = (g.mazeMap.trapLinks ?? [])[0] ?? null;
      const legal = legalDirections(g, { chest: false });
      if (!legal.length) return null;
      if (link && !g.triggeredTrapSet.has(link.trap)) {
        const toward = towards(g, cellOf(cellId({ row: +link.trap.split(",")[0], col: +link.trap.split(",")[1] })), { chest: false });
        if (toward) return { kind: "move", direction: toward };
      }
      const wall = link ? cellOf(cellId({ row: +link.mutation.wall.split(",")[0], col: +link.mutation.wall.split(",")[1] })) : null;
      if (ctx.lastDirection && legal.includes(ctx.lastDirection) && ctx.rand() < 0.8) return { kind: "move", direction: ctx.lastDirection };
      if (wall && ctx.rand() < 0.6) {
        const toward = towards(g, wall, { chest: false });
        if (toward) return { kind: "move", direction: toward };
      }
      return { kind: "move", direction: legal[Math.floor(ctx.rand() * legal.length)] };
    },
    // Chest, a reward, a blocked bump now and then, the Pickaxe on an adjacent wall (H05, Route 1 equivalence).
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

  const SEEDS_PER = 10;
  const specs = [];
  for (const route of ROUTES) {
    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < SEEDS_PER; i += 1) {
        const seed = 9_400_000 + route * 10_000 + DIFFICULTIES.indexOf(difficulty) * 1_000 + i;
        specs.push({ seed, route, difficulty, policy: "straight", trapFirst: i % 2 === 1 });
        if (i < 4) specs.push({ seed, route, difficulty, policy: "turner" });
        if (route >= 2 && i < 6) specs.push({ seed, route, difficulty, policy: "linkRunner" });
        if (i < 4) specs.push({ seed, route, difficulty, policy: "mixed", reward: i % 2 ? "pickaxe" : "second-chance" });
      }
    }
  }
  const games = specs.map((spec) => {
    const game = playGame(RT, trace, draws, spec, POLICIES[spec.policy]);
    game.run.unmount();
    return game;
  });
  const allTurns = games.flatMap((game) => game.turns);

  // --- per-turn analysis ----------------------------------------------------------------------------------------------
  const settledHunter = (turn) => {
    const settle = turn.events.find((e) => e.type === "DEFENDERS_SETTLED" || (e.type === "EXPLORER_CAPTURED" && e.by !== "explorer-step"));
    return settle ? settle.guardian : null;
  };
  const turnInput = (turn, previous) => ({
    route: turn.spec.route,
    difficulty: turn.spec.difficulty,
    previous,
    direction: turn.action.direction,
    hunter: turn.before.guardian,
    explorer: turn.after.player,
    exit: turn.map.exitPosition,
    walls: turn.after.walls,
    blocked: new Set([...turn.after.armed, cellKey(turn.before.sentinel)]),
  });
  const helperPlan = (input) =>
    intercept
      ? intercept.planHunterInterception({
        routeNumber: input.route, difficulty: input.difficulty, previousDirection: input.previous, direction: input.direction,
        hunter: input.hunter, explorer: input.explorer, exitPosition: input.exit, walls: input.walls, blocked: input.blocked,
      })
      : null;
  // The defenders answer a step on these turns: a successful step, the Chest not opened, the Route still on.
  const answered = (turn) => turn.stepped && !turn.after.rewardChoicePending && turn.after.status !== "won";
  for (const turn of allTurns) {
    if (!answered(turn)) continue;
    const input = turnInput(turn, turn.trackedPrevious);
    turn.input = input;
    turn.contract = contractInterception(input);
    turn.helper = helperPlan(input);
    // Production's pursuit support, as the reference models it: armed traps and the Sentinel's cell illegal.
    turn.legacy = referenceHunterSupport(input.hunter, input.explorer, input.exit, input.walls, input.difficulty, turn.after.armed, turn.before.sentinel);
    turn.hunterAfter = settledHunter(turn);
    turn.secondChanceByDefender = turn.events.some((e) => e.type === "SECOND_CHANCE_USED" && e.cause !== "explorer");
    turn.repeat = input.previous !== null && input.previous === input.direction;
  }
  const answeredTurns = allTurns.filter((t) => t.input);
  const adaptiveRoute = (t) => t.spec.route >= 2;
  const contractTurns = answeredTurns.filter((t) => t.contract !== null);
  const observedMove = (t) => t.hunterAfter !== null && !t.secondChanceByDefender;

  // --- solver contexts per map ----------------------------------------------------------------------------------------
  const contexts = new Map();
  const contextOf = (turn) => {
    const key = `${turn.spec.seed}|${turn.spec.route}|${turn.spec.difficulty}`;
    if (!contexts.has(key)) {
      const requirePassage = turn.before.passageRequired;
      const octx = oracleContext(RT.API, turn.map, turn.spec.difficulty, { requirePassage, routeNumber: turn.spec.route, intercept });
      const dctx = solvers.rota2.buildDynamicContext(turn.map, turn.spec.difficulty, { requirePassage, routeNumber: turn.spec.route, intercept });
      const sctx = buildContext(turn.map, turn.spec.difficulty);
      sctx.routeNumber = turn.spec.route;
      sctx.intercept = intercept;
      const preDctx = preSolvers.rota2.buildDynamicContext(turn.map, turn.spec.difficulty, { requirePassage });
      const preSctx = buildContext(turn.map, turn.spec.difficulty);
      contexts.set(key, { octx, dctx, sctx, preDctx, preSctx });
    }
    return contexts.get(key);
  };
  const canonicalBefore = (turn) => {
    const g = turn.before;
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
      d: directionCodeOf(turn.trackedPrevious),
    };
  };
  const canonicalAfter = (turn) => {
    const g = turn.after;
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
      d: directionCodeOf(turn.action.direction),
    };
  };
  // Pre-Chest, with defenders that answered and a state the solvers model (no Chest, no Pickaxe, no Second Chance).
  const solverTurns = answeredTurns.filter((t) => !t.before.chestOpened && !t.after.chestOpened && !t.secondChanceByDefender && t.after.status !== "won");

  const fixtureSummary = {
    games: games.length,
    turns: allTurns.length,
    answeredSteps: answeredTurns.length,
    repeats: answeredTurns.filter((t) => t.repeat).length,
    repeatsOnAdaptiveRoutes: answeredTurns.filter((t) => t.repeat && adaptiveRoute(t)).length,
    contractInterceptions: contractTurns.length,
    byRouteMode: Object.fromEntries(ROUTES.flatMap((r) => DIFFICULTIES.map((d) => [`R${r}-${d}`, contractTurns.filter((t) => t.spec.route === r && t.spec.difficulty === d).length]))),
    solverTurns: solverTurns.length,
  };
  log(`fixtures: ${JSON.stringify(fixtureSummary)}`);

  // ===============================================================================================================
  // H01 — Route 1 Hunter support unchanged
  // ===============================================================================================================
  await guarded("H01", "preserved", "Route 1 Hunter support unchanged (hook, solvers, every remembered direction)", () => {
    const route1 = solverTurns.filter((t) => t.spec.route === 1);
    let hookOutsideLegacy = 0;
    let pairs = 0;
    let projectedDiffers = 0;
    let directionSensitive = 0;
    const examples = [];
    for (const t of route1) {
      if (observedMove(t) && !t.legacy.some((c) => sameCell(c, t.hunterAfter))) hookOutsideLegacy += 1;
      const { dctx, sctx, preDctx, preSctx } = contextOf(t);
      const state = canonicalBefore(t);
      for (let a = 0; a < ACTIONS.length; a += 1) {
        const preDyn = rota2Answer(preSolvers, preDctx, state, a);
        const preSta = packedAnswer(preSolvers, preSctx, state, a);
        let first = null;
        for (let d = 0; d < DIRECTION_CODES.length; d += 1) {
          const withD = { ...state, d };
          const dyn = rota2Answer(solvers, dctx, withD, a);
          const sta = packedAnswer(solvers, sctx, withD, a);
          pairs += 1;
          const same = (x, y) => (x === null || y === null ? x === y : x.hasWin === y.hasWin && x.hasLoss === y.hasLoss && sameJson(x.states, y.states));
          if (!same(dyn, preDyn) || !same(sta, preSta)) {
            projectedDiffers += 1;
            if (examples.length < 3) examples.push({ seed: t.spec.seed, mode: t.spec.difficulty, state: canon(state), action: a, d, dyn: dyn?.states, preDyn: preDyn?.states });
          }
          const signature = JSON.stringify([dyn?.statesD, sta?.statesD].map((x) => (x ?? []).map((s) => s.slice(0, s.lastIndexOf("|")))));
          if (first === null) first = signature;
          else if (signature !== first) directionSensitive += 1;
        }
      }
    }
    return {
      pass: route1.length > 0 && hookOutsideLegacy === 0 && projectedDiffers === 0 && directionSensitive === 0,
      route1Turns: route1.length,
      hookMovesOutsidePursuitSupport: hookOutsideLegacy,
      solverPairs: pairs,
      differFromPreMissionSolvers: projectedDiffers,
      supportDependsOnRememberedDirection: directionSensitive,
      examples,
    };
  });

  // ===============================================================================================================
  // H02 / H25 — Route 1 against the base, render for render
  // ===============================================================================================================
  const observeRender = (g) => g?.mazeMap ? JSON.stringify({
    status: g.status, message: g.message, turns: g.turns, errors: g.errors, blockedMoves: g.blockedMoves,
    player: g.player, guardian: g.guardian, sentinel: g.sentinel, sentinelTarget: g.sentinelTarget, sentinelCommitLeft: g.sentinelCommitLeft,
    walls: [...g.walls].sort(), armed: [...g.triggeredTrapSet].sort(), collected: [...g.collectedSet].sort(), score: g.score,
    chestOpened: g.chestOpened, rewardSelected: g.rewardSelected, rewardSpent: g.rewardSpent, brokenWall: g.brokenWall,
    trapOpenedWalls: g.trapOpenedWalls, portalActive: g.portalActive,
  }) : null;
  const route1Equivalence = (() => {
    const out = { games: 0, renders: 0, turns: 0, draws: 0, mapsDiffer: 0, rendersDiffer: 0, eventsDiffer: 0, drawsDiffer: 0, resultsDiffer: 0, captures: 0, wins: 0, losses: 0, examples: [] };
    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < 12; i += 1) {
        const spec = { seed: 9_410_000 + DIFFICULTIES.indexOf(difficulty) * 1_000 + i, route: 1, difficulty, policy: i % 3 === 0 ? "mixed" : i % 3 === 1 ? "straight" : "turner", reward: i % 2 ? "pickaxe" : "second-chance" };
        const framesNow = [];
        const framesPre = [];
        const now = playGame(RT, trace, draws, spec, POLICIES[spec.policy], { onRender: (g) => framesNow.push(observeRender(g)) });
        const pre = playGame(PRE, preTrace, preDraws, spec, POLICIES[spec.policy], { onRender: (g) => framesPre.push(observeRender(g)) });
        out.games += 1;
        out.renders += framesNow.length;
        out.turns += now.turns.length;
        if (JSON.stringify([...now.map.walls].sort()) + JSON.stringify(now.map.trapLinks) !== JSON.stringify([...pre.map.walls].sort()) + JSON.stringify(pre.map.trapLinks)) out.mapsDiffer += 1;
        if (!sameJson(framesNow, framesPre)) {
          out.rendersDiffer += 1;
          if (out.examples.length < 3) {
            const at = framesNow.findIndex((f, k) => f !== framesPre[k]);
            out.examples.push({ seed: spec.seed, difficulty, render: at, now: framesNow[at]?.slice(0, 200), pre: framesPre[at]?.slice(0, 200) });
          }
        }
        const eventsOf = (game) => game.turns.map((t) => t.events.map((e) => JSON.stringify(e)));
        if (!sameJson(eventsOf(now), eventsOf(pre))) out.eventsDiffer += 1;
        const drawsOf = (game) => game.turns.map((t) => t.draws);
        out.draws += now.turns.reduce((n, t) => n + t.draws.length, 0);
        if (!sameJson(drawsOf(now), drawsOf(pre))) out.drawsDiffer += 1;
        const result = (game) => JSON.stringify(game.run.completions.map((c) => ({ ...c, details: c.details })));
        if (result(now) !== result(pre)) out.resultsDiffer += 1;
        for (const t of now.turns) if (t.events.some((e) => e.type === "EXPLORER_CAPTURED")) out.captures += 1;
        if (now.run.state.status === "won") out.wins += 1;
        if (now.run.state.status === "lost") out.losses += 1;
        now.run.unmount();
        pre.run.unmount();
      }
    }
    return out;
  })();

  await guarded("H02", "preserved", "Route 1 RNG draws unchanged (count and value, turn by turn, against the base)", () => ({
    pass: route1Equivalence.games >= 36 && route1Equivalence.draws > 0 && route1Equivalence.drawsDiffer === 0,
    games: route1Equivalence.games,
    turns: route1Equivalence.turns,
    draws: route1Equivalence.draws,
    gamesWithDifferentDraws: route1Equivalence.drawsDiffer,
  }));

  // ===============================================================================================================
  // H03 / H04 / H05 / H24 / H29 — the memory's lifecycle
  // ===============================================================================================================
  await guarded("H03", "adaptive", "the remembered direction starts null (mount, start, every new session)", () => {
    const out = [];
    for (const route of ROUTES) {
      for (const difficulty of DIFFICULTIES) {
        const run = RT.mount({ seed: 9_420_000 + route * 10 + DIFFICULTIES.indexOf(difficulty), difficulty, routeNumber: route, autoStart: false });
        const atSetup = run.state.lastExplorerDirection;
        run.act((g) => g.startGame());
        out.push({ route, difficulty, atSetup, afterStart: run.state.lastExplorerDirection });
        run.unmount();
      }
    }
    return { pass: out.every((o) => o.atSetup === null && o.afterStart === null), sessions: out.length, values: [...new Set(out.flatMap((o) => [String(o.atSetup), String(o.afterStart)]))] };
  });

  await guarded("H04", "adaptive", "a successful step stores its direction (all four, every Route)", () => {
    const seen = {};
    let mismatches = 0;
    for (const t of allTurns) {
      if (!t.stepped) continue;
      tally(seen, t.action.direction);
      // After a step the hook remembers that step's direction (a capture or a Chest included: the step happened).
      if (t.after.lastExplorerDirection !== t.action.direction) mismatches += 1;
    }
    return { pass: DIRECTIONS.every((d) => (seen[d] ?? 0) > 0) && mismatches === 0, stepsByDirection: seen, mismatches };
  });

  await guarded("H05", "adaptive", "a blocked step — and a break, a reward choice, a Second Chance in place — keeps the last direction", () => {
    const kinds = { blocked: 0, break: 0, choose: 0, secondChanceInPlace: 0 };
    let changed = 0;
    let nonNullKept = 0;
    for (const t of allTurns) {
      let kind = null;
      if (t.action.kind === "move" && !t.stepped) kind = t.after.turns === t.before.turns ? "blocked" : "secondChanceInPlace";
      else if (t.action.kind === "break") kind = "break";
      else if (t.action.kind === "choose") kind = "choose";
      if (!kind) continue;
      kinds[kind] += 1;
      if (t.after.lastExplorerDirection !== t.before.lastExplorerDirection) changed += 1;
      else if (t.before.lastExplorerDirection) nonNullKept += 1;
    }
    return { pass: kinds.blocked > 0 && kinds.break > 0 && kinds.choose > 0 && changed === 0 && nonNullKept > 0, kinds, overwritten: changed, nonNullDirectionsKept: nonNullKept };
  });

  // ===============================================================================================================
  // H06 / H07 / H08 — when the Hunter adapts
  // ===============================================================================================================
  await guarded("H06", "preserved", "a change of direction never adapts (Routes 2/3: pursuit support, no interception message)", () => {
    const changes = answeredTurns.filter((t) => adaptiveRoute(t) && !t.repeat && observedMove(t));
    const outside = changes.filter((t) => !t.legacy.some((c) => sameCell(c, t.hunterAfter)));
    const message = changes.filter((t) => t.after.message === INTERCEPT_MESSAGE);
    const helperNonNull = changes.filter((t) => t.helper !== null);
    const interceptPicks = changes.filter((t) => t.order.includes("I"));
    return {
      pass: changes.length >= 200 && outside.length === 0 && message.length === 0 && helperNonNull.length === 0 && interceptPicks.length === 0,
      directionChanges: changes.length,
      firstSteps: answeredTurns.filter((t) => adaptiveRoute(t) && t.input.previous === null).length,
      hunterOutsidePursuit: outside.length,
      interceptionMessage: message.length,
      helperIntercepts: helperNonNull.length,
      interceptionPicks: interceptPicks.length,
    };
  });

  await guarded("H07", "adaptive", "a repeated direction on Routes 2/3 makes the Hunter intercept, as the contract says", () => {
    const cases = contractTurns.filter((t) => observedMove(t));
    const notInPlan = cases.filter((t) => !t.contract.moves.some((c) => sameCell(c, t.hunterAfter)));
    const onlyInterception = cases.filter((t) => !t.legacy.some((c) => sameCell(c, t.hunterAfter)));
    // The message is said exactly when the interception made the move — unless the step's own event outranks it.
    const eventOutranks = (t) => t.events.some((e) => ["LIGHT_COLLECTED", "TRAP_ARMED", "WALL_OPENED_BY_TRAP", "PORTAL_ACTIVATED"].includes(e.type)) || sameCell(t.after.player, t.map.exitPosition);
    const settled = cases.filter((t) => t.events.some((e) => e.type === "DEFENDERS_SETTLED"));
    const silent = settled.filter((t) => !eventOutranks(t) && t.after.message !== INTERCEPT_MESSAGE);
    const falseClaims = answeredTurns.filter((t) => t.contract === null && t.after.message === INTERCEPT_MESSAGE);
    const helperDisagrees = answeredTurns.filter((t) => planKey(t.helper) !== planKey(t.contract));
    const byRouteMode = {};
    for (const t of cases) tally(byRouteMode, `R${t.spec.route}-${t.spec.difficulty}`);
    return {
      pass:
        cases.length >= 60 && notInPlan.length === 0 && onlyInterception.length > 0 && silent.length === 0 && falseClaims.length === 0 &&
        helperDisagrees.length === 0 && Object.keys(byRouteMode).length === 6,
      interceptionTurns: cases.length,
      byRouteMode,
      hookMoveNotAnInterceptionMove: notInPlan.length,
      movesThePursuitCouldNotHaveMade: onlyInterception.length,
      interceptionWithoutMessage: silent.length,
      messageWithoutInterception: falseClaims.length,
      treeHelperDisagreesWithContract: helperDisagrees.length,
      example: helperDisagrees[0] ? { seed: helperDisagrees[0].spec.seed, contract: planKey(helperDisagrees[0].contract), helper: planKey(helperDisagrees[0].helper) } : null,
    };
  });

  await guarded("H08", "preserved", "a repeated direction on Route 1 changes nothing (pursuit support, no message, no interception pick)", () => {
    const repeats = answeredTurns.filter((t) => t.spec.route === 1 && t.repeat && observedMove(t));
    const outside = repeats.filter((t) => !t.legacy.some((c) => sameCell(c, t.hunterAfter)));
    const message = repeats.filter((t) => t.after.message === INTERCEPT_MESSAGE);
    const picks = repeats.filter((t) => t.order.includes("I"));
    // Where the Hunter WOULD intercept were this Route 2 — the repeats that actually tempt the policy.
    const tempting = repeats.filter((t) => contractInterception({ ...t.input, route: 2 }) !== null);
    return {
      pass: repeats.length >= 100 && tempting.length > 0 && outside.length === 0 && message.length === 0 && picks.length === 0,
      route1Repeats: repeats.length,
      repeatsThatWouldInterceptOnRoute2: tempting.length,
      hunterOutsidePursuit: outside.length,
      interceptionMessage: message.length,
      interceptionPicks: picks.length,
    };
  });

  // ===============================================================================================================
  // the policy itself, on a battery of states from real maps (the contract checker judges the tree's module)
  // ===============================================================================================================
  const battery = (() => {
    const out = [];
    for (const route of [2, 3]) {
      for (const difficulty of DIFFICULTIES) {
        for (let i = 0; i < 3; i += 1) {
          const map = generate(RT, 9_430_000 + route * 100 + DIFFICULTIES.indexOf(difficulty) * 10 + i, difficulty, route);
          const link = (map.trapLinks ?? [])[0] ?? null;
          const topologies = [map.walls];
          if (link) {
            const open = new Set(map.walls);
            open.delete(link.mutation.wall);
            topologies.push(open);
          }
          const rand = lcgFrom(route * 1000 + i * 31 + DIFFICULTIES.indexOf(difficulty));
          for (const [ti, walls] of topologies.entries()) {
            const walk = [];
            for (let id = 0; id < 81; id += 1) if (!walls.has(keyOf(id))) walk.push(cellOf(id));
            for (const explorer of walk) {
              for (const direction of DIRECTIONS) {
                // Hunters across the board; the Sentinel and armed traps drawn from the map.
                for (let n = 0; n < 6; n += 1) {
                  const hunter = walk[Math.floor(rand() * walk.length)];
                  if (sameCell(hunter, explorer) || sameCell(hunter, map.exitPosition)) continue;
                  const sentinel = walk[Math.floor(rand() * walk.length)];
                  if (sameCell(sentinel, hunter) || sameCell(sentinel, explorer) || sameCell(sentinel, map.exitPosition)) continue;
                  const armed = map.traps.filter(() => rand() < 0.4).map(cellKey).filter((k) => k !== cellKey(hunter));
                  const blocked = new Set([...armed, cellKey(sentinel)]);
                  for (const previous of [direction, ...DIRECTIONS.filter((d) => d !== direction).slice(0, 1), null]) {
                    out.push({ route, difficulty, previous, direction, hunter, explorer, exit: map.exitPosition, walls, blocked, opened: ti === 1, link, map });
                  }
                }
              }
            }
          }
        }
      }
    }
    return out;
  })();
  for (const input of battery) {
    input.contract = contractInterception(input);
    input.helper = helperPlan(input);
  }
  const batteryAgree = battery.filter((b) => planKey(b.contract) === planKey(b.helper)).length;
  const helperPlans = battery.filter((b) => b.helper);
  const legalMove = (b, c) => inBoard(c) && manhattan(c, b.hunter) === 1 && !b.walls.has(cellKey(c)) && !sameCell(c, b.exit) && !b.blocked.has(cellKey(c)) && !sameCell(c, b.explorer);
  const projectionWalkable = (b, plan) => Array.from({ length: plan.horizon }, (_, i) => add(b.explorer, DELTA[b.direction], i + 1)).every((c) => inBoard(c) && !b.walls.has(cellKey(c)));

  await guarded("H09", "adaptive", "Easy intercepts only a predicted cell it reaches with this one move", () => {
    const easy = battery.filter((b) => b.difficulty === "easy");
    const plans = easy.filter((b) => b.helper);
    const wrong = plans.filter((b) => b.helper.horizon !== 1 || b.helper.moves.length !== 1 || !sameCell(b.helper.moves[0], b.helper.target) || !sameCell(b.helper.target, add(b.explorer, DELTA[b.direction])));
    // Medium would chase that prediction from afar; Easy does not.
    const distant = easy.filter((b) => !b.helper && contractInterception({ ...b, difficulty: "medium" }) !== null);
    const hookEasy = contractTurns.filter((t) => t.spec.difficulty === "easy" && observedMove(t));
    const hookWrong = hookEasy.filter((t) => !sameCell(t.hunterAfter, t.contract.target));
    return {
      pass: plans.length > 0 && wrong.length === 0 && distant.length > 0 && hookEasy.length > 0 && hookWrong.length === 0 && easy.every((b) => planKey(b.helper) === planKey(b.contract)),
      easyStates: easy.length,
      easyInterceptions: plans.length,
      notAOneMoveOneCellPlan: wrong.length,
      distantPredictionsLeftToThePursuit: distant.length,
      hookEasyInterceptions: hookEasy.length,
      hookEasyNotOnThePrediction: hookWrong.length,
    };
  });

  await guarded("H10", "adaptive", "Medium predicts one cell ahead and takes every legal move one step closer to it", () => {
    const medium = battery.filter((b) => b.difficulty === "medium");
    const plans = medium.filter((b) => b.helper);
    const obstaclesOf = (b) => new Set([...b.blocked, cellKey(b.exit), cellKey(b.explorer)]);
    let notOneAhead = 0;
    let notCloser = 0;
    let missing = 0;
    let adjacent = 0;
    let farther = 0;
    for (const b of plans) {
      const plan = b.helper;
      if (plan.horizon !== 1 || !sameCell(plan.target, add(b.explorer, DELTA[b.direction]))) notOneAhead += 1;
      const obstacles = obstaclesOf(b);
      const fromHunter = REFERENCE_API.findPathLength(b.hunter, plan.target, b.walls, obstacles);
      if (fromHunter === 1) adjacent += 1;
      else farther += 1;
      for (const m of plan.moves) if (REFERENCE_API.findPathLength(m, plan.target, b.walls, obstacles) !== fromHunter - 1) notCloser += 1;
      for (const d of NEIGHBOUR_ORDER) {
        const c = add(b.hunter, DELTA[d]);
        if (!legalMove(b, c)) continue;
        const listed = plan.moves.some((m) => sameCell(m, c));
        if (!listed && REFERENCE_API.findPathLength(c, plan.target, b.walls, obstacles) === fromHunter - 1) missing += 1;
      }
    }
    return {
      pass: plans.length > 0 && adjacent > 0 && farther > 0 && notOneAhead === 0 && notCloser === 0 && missing === 0 && medium.every((b) => planKey(b.helper) === planKey(b.contract)),
      mediumStates: medium.length,
      mediumInterceptions: plans.length,
      hunterAdjacentToPrediction: adjacent,
      hunterFartherFromPrediction: farther,
      notOneCellAhead: notOneAhead,
      moveNotOneStepCloser: notCloser,
      improvingMoveLeftOut: missing,
    };
  });

  await guarded("H11", "adaptive", "Hard predicts two cells ahead when both are clear and the second can be approached", () => {
    const hard = battery.filter((b) => b.difficulty === "hard");
    const two = hard.filter((b) => b.helper?.horizon === 2);
    const wrongTwo = two.filter((b) => !sameCell(b.helper.target, add(b.explorer, DELTA[b.direction], 2)) || !projectionWalkable(b, b.helper));
    // Whenever the two-cell prediction works by the contract, the module uses it.
    const missed = hard.filter((b) => b.contract?.horizon === 2 && b.helper?.horizon !== 2);
    const hookTwo = contractTurns.filter((t) => t.spec.difficulty === "hard" && t.contract.horizon === 2 && observedMove(t));
    return {
      pass: two.length > 0 && wrongTwo.length === 0 && missed.length === 0 && hookTwo.length > 0 && hookTwo.every((t) => t.contract.moves.some((c) => sameCell(c, t.hunterAfter))),
      hardStates: hard.length,
      twoCellPlans: two.length,
      twoCellPlanWrong: wrongTwo.length,
      twoCellPredictionNotUsed: missed.length,
      hookTwoCellInterceptions: hookTwo.length,
    };
  });

  await guarded("H12", "adaptive", "Hard falls back to one cell when the two-cell prediction does not work, and never forces it", () => {
    const hard = battery.filter((b) => b.difficulty === "hard" && b.previous === b.direction && manhattan(b.hunter, b.explorer) > 1);
    const p2Blocked = hard.filter((b) => {
      const p1 = add(b.explorer, DELTA[b.direction]);
      const p2 = add(b.explorer, DELTA[b.direction], 2);
      const p1ok = inBoard(p1) && !b.walls.has(cellKey(p1));
      const p2ok = inBoard(p2) && !b.walls.has(cellKey(p2)) && !sameCell(p2, b.exit) && !b.blocked.has(cellKey(p2));
      return p1ok && !p2ok;
    });
    const fellBack = p2Blocked.filter((b) => b.helper?.horizon === 1);
    const forced = p2Blocked.filter((b) => b.helper?.horizon === 2);
    const byReason = { wallOrBoard: 0, portal: 0, armedTrap: 0, sentinel: 0 };
    for (const b of p2Blocked) {
      const p2 = add(b.explorer, DELTA[b.direction], 2);
      if (!inBoard(p2) || b.walls.has(cellKey(p2))) byReason.wallOrBoard += 1;
      else if (sameCell(p2, b.exit)) byReason.portal += 1;
      else if (b.blocked.has(cellKey(p2)) && b.map.traps.some((t) => sameCell(t, p2))) byReason.armedTrap += 1;
      else byReason.sentinel += 1;
    }
    // Two-cell prediction clear but no move closer to it: the one-cell prediction is tried next.
    const noApproach = hard.filter((b) => b.contract?.horizon === 1 && b.helper?.horizon === 1 && (() => {
      const p2 = add(b.explorer, DELTA[b.direction], 2);
      return inBoard(p2) && !b.walls.has(cellKey(p2)) && !sameCell(p2, b.exit) && !b.blocked.has(cellKey(p2));
    })());
    return {
      pass: p2Blocked.length > 0 && fellBack.length > 0 && forced.length === 0 && byReason.wallOrBoard > 0 && byReason.armedTrap + byReason.sentinel + byReason.portal > 0 && hard.every((b) => planKey(b.helper) === planKey(b.contract)),
      hardRepeats: hard.length,
      twoCellPredictionUnusable: p2Blocked.length,
      byReason,
      fellBackToOneCell: fellBack.length,
      unusableTwoCellForced: forced.length,
      twoCellClearButUnapproachableFellBack: noApproach.length,
    };
  });

  await guarded("H13", "adaptive", "a blocked one-cell prediction falls back to the pursuit (every mode)", () => {
    const repeats = battery.filter((b) => b.previous === b.direction && manhattan(b.hunter, b.explorer) > 1);
    const blockedP1 = repeats.filter((b) => {
      const p1 = add(b.explorer, DELTA[b.direction]);
      return !inBoard(p1) || b.walls.has(cellKey(p1)) || sameCell(p1, b.exit) || b.blocked.has(cellKey(p1));
    });
    // With the one-cell prediction unusable, only Hard's two-cell one could still apply — and it needs p1 walkable.
    const intercepted = blockedP1.filter((b) => b.helper && !(b.difficulty === "hard" && b.helper.horizon === 2 && inBoard(add(b.explorer, DELTA[b.direction])) && !b.walls.has(cellKey(add(b.explorer, DELTA[b.direction])))));
    const hookFallback = answeredTurns.filter((t) => adaptiveRoute(t) && t.repeat && t.contract === null && observedMove(t) && manhattan(t.input.hunter, t.input.explorer) > 1);
    const hookOutside = hookFallback.filter((t) => !t.legacy.some((c) => sameCell(c, t.hunterAfter)));
    return {
      pass: intercept !== null && helperPlans.length > 0 && blockedP1.length > 0 && intercepted.length === 0 && hookFallback.length > 0 && hookOutside.length === 0,
      interceptionModule: intercept !== null,
      repeatsWithBlockedPrediction: blockedP1.length,
      interceptedAnyway: intercepted.length,
      hookRepeatsLeftToThePursuit: hookFallback.length,
      hookOutsidePursuit: hookOutside.length,
    };
  });

  await guarded("H14", "adaptive", "a prediction behind a wall is never treated as walkable (closed and opened mazes)", () => {
    const behindWall = battery.filter((b) => {
      const p1 = add(b.explorer, DELTA[b.direction]);
      return b.previous === b.direction && inBoard(p1) && b.walls.has(cellKey(p1));
    });
    const throughWall = helperPlans.filter((b) => !projectionWalkable(b, b.helper));
    const behindIntercepted = behindWall.filter((b) => b.helper);
    // The opened link wall IS walkable once open: predictions through it exist only in the opened maze.
    const throughOpenedLink = helperPlans.filter((b) => b.opened && b.link && Array.from({ length: b.helper.horizon }, (_, i) => add(b.explorer, DELTA[b.direction], i + 1)).some((c) => cellKey(c) === b.link.mutation.wall));
    return {
      pass: behindWall.length > 0 && throughWall.length === 0 && behindIntercepted.length === 0 && throughOpenedLink.length > 0,
      predictionsIntoAWall: behindWall.length,
      interceptedThroughAWall: behindIntercepted.length,
      plansWithAWallOnTheProjection: throughWall.length,
      predictionsThroughTheOpenedPassage: throughOpenedLink.length,
    };
  });

  // H15–H18: the interception's moves are legal moves of one cell; every real Hunter position too. Each requires the
  // branch to have run: the tree's module answered with plans, and the hook picked among interception moves.
  const hookInterceptionMoves = contractTurns.filter((t) => observedMove(t));
  const hookPicks = answeredTurns.filter((t) => t.order.includes("I")).length;
  const exercised = intercept !== null && helperPlans.length > 0 && hookPicks > 0;
  const hookPositions = allTurns.filter((t) => t.after.status === "playing");
  await guarded("H15", "adaptive", "the Hunter never enters an armed trap (interception moves and every real position)", () => {
    const planOnTrap = helperPlans.filter((b) => b.helper.moves.some((m) => b.blocked.has(cellKey(m)) && b.map.traps.some((t) => sameCell(t, m))) || (b.blocked.has(cellKey(b.helper.target)) && b.map.traps.some((t) => sameCell(t, b.helper.target))));
    const plansNearArmedTrap = helperPlans.filter((b) => [...b.blocked].some((k) => b.map.traps.some((t) => cellKey(t) === k) && manhattan(cellOf(cellId({ row: +k.split(",")[0], col: +k.split(",")[1] })), b.hunter) === 1));
    const hookOnTrap = hookPositions.filter((t) => t.after.armed.has(cellKey(t.after.guardian)));
    return {
      pass: exercised && plansNearArmedTrap.length > 0 && planOnTrap.length === 0 && hookOnTrap.length === 0,
      hookInterceptionPicks: hookPicks,
      interceptionPlans: helperPlans.length,
      plansWithAnArmedTrapNextToTheHunter: plansNearArmedTrap.length,
      planMovesOrTargetsOnAnArmedTrap: planOnTrap.length,
      hookHunterOnAnArmedTrap: hookOnTrap.length,
    };
  });
  await guarded("H16", "adaptive", "the Hunter never enters the Sentinel's cell", () => {
    const sentinelOf = (b) => [...b.blocked].find((k) => !b.map.traps.some((t) => cellKey(t) === k));
    const planOnSentinel = helperPlans.filter((b) => b.helper.moves.some((m) => cellKey(m) === sentinelOf(b)) || cellKey(b.helper.target) === sentinelOf(b));
    const plansNextToSentinel = helperPlans.filter((b) => {
      const s = sentinelOf(b);
      return s && manhattan(cellOf(cellId({ row: +s.split(",")[0], col: +s.split(",")[1] })), b.hunter) === 1;
    });
    const hookOnSentinel = hookPositions.filter((t) => sameCell(t.after.guardian, t.after.sentinel));
    const hookIntoSentinel = hookInterceptionMoves.filter((t) => sameCell(t.hunterAfter, t.before.sentinel));
    return {
      pass: exercised && plansNextToSentinel.length > 0 && planOnSentinel.length === 0 && hookOnSentinel.length === 0 && hookIntoSentinel.length === 0,
      hookInterceptionPicks: hookPicks,
      plansWithTheSentinelNextToTheHunter: plansNextToSentinel.length,
      planMovesOrTargetsOnTheSentinel: planOnSentinel.length,
      hookHunterOnTheSentinel: hookOnSentinel.length + hookIntoSentinel.length,
    };
  });
  await guarded("H17", "adaptive", "the Hunter never enters the portal", () => {
    const planOnPortal = helperPlans.filter((b) => b.helper.moves.some((m) => sameCell(m, b.exit)) || sameCell(b.helper.target, b.exit));
    const nextToPortal = helperPlans.filter((b) => manhattan(b.hunter, b.exit) === 1);
    const predictionIsPortal = battery.filter((b) => b.previous === b.direction && sameCell(add(b.explorer, DELTA[b.direction]), b.exit) && manhattan(b.hunter, b.explorer) > 1);
    const hookOnPortal = hookPositions.filter((t) => sameCell(t.after.guardian, t.map.exitPosition));
    return {
      pass: exercised && nextToPortal.length > 0 && predictionIsPortal.length > 0 && planOnPortal.length === 0 && hookOnPortal.length === 0 && predictionIsPortal.every((b) => !b.helper || !sameCell(b.helper.target, b.exit)),
      hookInterceptionPicks: hookPicks,
      plansWithThePortalNextToTheHunter: nextToPortal.length,
      predictionsOntoThePortal: predictionIsPortal.length,
      planMovesOrTargetsOnThePortal: planOnPortal.length,
      hookHunterOnThePortal: hookOnPortal.length,
    };
  });
  await guarded("H18", "adaptive", "the Hunter moves at most one cell, to a legal cell, and captures only by a real move", () => {
    const notOneCell = helperPlans.filter((b) => b.helper.moves.some((m) => !legalMove(b, m)));
    const hookJump = answeredTurns.filter((t) => observedMove(t) && manhattan(t.input.hunter, t.hunterAfter) > 1);
    const hookIntoWall = hookPositions.filter((t) => t.after.walls.has(cellKey(t.after.guardian)));
    // A Hunter capture is the Hunter standing on the Explorer after its move; nothing else ends a Route for it.
    const hunterCaptures = allTurns.filter((t) => t.events.some((e) => e.type === "EXPLORER_CAPTURED" && e.by === "hunter"));
    const fakeCaptures = hunterCaptures.filter((t) => {
      const e = t.events.find((x) => x.type === "EXPLORER_CAPTURED");
      return !sameCell(e.guardian, e.at) || manhattan(t.before.guardian, e.guardian) !== 1;
    });
    const interceptionCaptures = hookInterceptionMoves.filter((t) => sameCell(t.hunterAfter, t.after.player));
    const invalid = allTurns.filter((t) => t.after.status === "playing" && !t.after.valid);
    return {
      pass: exercised && notOneCell.length === 0 && hookJump.length === 0 && hookIntoWall.length === 0 && fakeCaptures.length === 0 && interceptionCaptures.length === 0 && invalid.length === 0,
      hookInterceptionPicks: hookPicks,
      interceptionPlanMovesNotOneLegalCell: notOneCell.length,
      hookHunterMovedMoreThanOneCell: hookJump.length,
      hookHunterInAWall: hookIntoWall.length,
      hunterCaptures: hunterCaptures.length,
      capturesWithoutARealMove: fakeCaptures.length,
      interceptionMovesThatCaptured: interceptionCaptures.length,
      invalidStatesWhilePlaying: invalid.length,
    };
  });

  // ===============================================================================================================
  // H19 / H20 — determinism and the random seam
  // ===============================================================================================================
  await guarded("H19", "adaptive", "the moves come in a fixed order, the same every time, and asking draws nothing", () => {
    if (!intercept) return { pass: false, interceptionModule: "absent" };
    let unstable = 0;
    let orderBroken = 0;
    let insertionSensitive = 0;
    let ties = 0;
    const drawsBefore = draws.values.length;
    for (const b of helperPlans) {
      const again = helperPlan(b);
      if (planKey(again) !== planKey(b.helper)) unstable += 1;
      const shuffled = helperPlan({ ...b, walls: new Set([...b.walls].reverse()), blocked: new Set([...b.blocked].reverse()) });
      if (planKey(shuffled) !== planKey(b.helper)) insertionSensitive += 1;
      const ranks = b.helper.moves.map((m) => NEIGHBOUR_ORDER.findIndex((d) => sameCell(add(b.hunter, DELTA[d]), m)));
      if (ranks.some((r, i) => i > 0 && r <= ranks[i - 1])) orderBroken += 1;
      if (b.helper.moves.length > 1) ties += 1;
    }
    const drawn = draws.values.length - drawsBefore;
    return {
      pass: helperPlans.length > 0 && ties > 0 && unstable === 0 && orderBroken === 0 && insertionSensitive === 0 && drawn === 0,
      plans: helperPlans.length,
      ties,
      differentAnswerTwice: unstable,
      notInNeighbourOrder: orderBroken,
      dependsOnSetInsertionOrder: insertionSensitive,
      drawsWhileAsking: drawn,
    };
  });

  await guarded("H20", "adaptive", "the hook draws only to break a tie among the listed moves, and picks the drawn one", () => {
    const cases = contractTurns.filter((t) => observedMove(t) && !t.events.some((e) => e.type === "SECOND_CHANCE_USED"));
    let single = 0;
    let tie = 0;
    let wrongDraws = 0;
    let wrongPick = 0;
    for (const t of cases) {
      const n = t.contract.moves.length;
      if (n === 1) {
        single += 1;
        if (t.draws.length !== 0) wrongDraws += 1;
      } else {
        tie += 1;
        if (t.draws.length !== 1) wrongDraws += 1;
        else if (!sameCell(t.contract.moves[Math.floor(t.draws[0] * n)], t.hunterAfter)) wrongPick += 1;
      }
    }
    return {
      pass: single > 0 && tie > 0 && wrongDraws === 0 && wrongPick === 0,
      singleMoveTurns: single,
      tieTurns: tie,
      unexpectedDrawCount: wrongDraws,
      pickNotTheDrawnMove: wrongPick,
    };
  });

  // ===============================================================================================================
  // H21 / H22 / H23 / H24 — the solvers and the oracle against the hook
  // ===============================================================================================================
  const solverCheck = (() => {
    const out = {
      turns: 0, adaptiveTurns: 0, oracleMiss: 0, dynamicMiss: 0, staticTurns: 0, staticAdaptive: 0, staticMiss: 0,
      oracleVsDynamic: 0, oracleVsDynamicPairs: 0, adaptivePairs: 0, supportChangedByPolicy: 0, examples: [],
    };
    for (const t of solverTurns) {
      const { octx, dctx, sctx } = contextOf(t);
      const before = canonicalBefore(t);
      const after = canonD(canonicalAfter(t));
      const lost = t.after.status === "lost";
      const a = actionIndexOf(t.action.direction);
      out.turns += 1;
      const o = oracleSuccessors(octx, before, a);
      if (o.intercepting) out.adaptiveTurns += 1;
      const has = (answer) => answer && (lost ? answer.hasLoss : answer.statesD.includes(after));
      if (!has(o)) {
        out.oracleMiss += 1;
        if (out.examples.length < 3) out.examples.push({ who: "oracle", seed: t.spec.seed, route: t.spec.route, mode: t.spec.difficulty, k: t.k, after, oracle: o.statesD.slice(0, 4) });
      }
      const dyn = rota2Answer(solvers, dctx, before, a);
      if (!has(dyn)) {
        out.dynamicMiss += 1;
        if (out.examples.length < 3) out.examples.push({ who: "dynamic", seed: t.spec.seed, route: t.spec.route, mode: t.spec.difficulty, k: t.k, after, dynamic: dyn?.statesD.slice(0, 4) });
      }
      const stays = !t.before.trapOpenedWalls.length && !t.after.trapOpenedWalls.length && !sameCell(t.after.player, t.map.exitPosition);
      if (stays) {
        out.staticTurns += 1;
        if (o.intercepting) out.staticAdaptive += 1;
        const sta = packedAnswer(solvers, sctx, before, a);
        if (!has(sta)) {
          out.staticMiss += 1;
          if (out.examples.length < 3) out.examples.push({ who: "static", seed: t.spec.seed, route: t.spec.route, mode: t.spec.difficulty, k: t.k, after, static: sta?.statesD.slice(0, 4) });
        }
      }
      // Depth one around the real state: every action, the oracle's whole support against the dynamic solver's.
      for (let b = 0; b < ACTIONS.length; b += 1) {
        const ob = oracleSuccessors(octx, before, b);
        const db = rota2Answer(solvers, dctx, before, b);
        if (ob === null && db === null) continue;
        out.oracleVsDynamicPairs += 1;
        if (ob?.intercepting) {
          out.adaptivePairs += 1;
          const off = oracleSuccessors({ ...octx, intercept: null }, before, b);
          if (!sameJson(off.statesD, ob.statesD)) out.supportChangedByPolicy += 1;
        }
        if (ob === null || db === null || ob.hasWin !== db.hasWin || ob.hasLoss !== db.hasLoss || !sameJson(ob.statesD, db.statesD)) {
          out.oracleVsDynamic += 1;
          if (out.examples.length < 3) out.examples.push({ who: "oracle≠dynamic", seed: t.spec.seed, route: t.spec.route, k: t.k, action: b, oracle: ob?.statesD.slice(0, 4), dynamic: db?.statesD.slice(0, 4) });
        }
      }
    }
    return out;
  })();

  await guarded("H21", "adaptive", "the static solver's support holds every production outcome (Route 1, and Routes 2/3 on the certified walls)", () => ({
    pass: solverCheck.staticTurns > 0 && solverCheck.staticAdaptive > 0 && solverCheck.staticMiss === 0,
    staticTurns: solverCheck.staticTurns,
    interceptionTurnsAmongThem: solverCheck.staticAdaptive,
    outsideTheStaticSupport: solverCheck.staticMiss,
    examples: solverCheck.examples.filter((e) => e.who === "static"),
  }));

  await guarded("H22", "adaptive", "the dynamic solver's support holds every production outcome; it equals the production-backed oracle", () => ({
    pass: solverCheck.turns > 0 && solverCheck.adaptiveTurns > 0 && solverCheck.oracleMiss === 0 && solverCheck.dynamicMiss === 0 && solverCheck.oracleVsDynamic === 0 && solverCheck.supportChangedByPolicy > 0,
    realTurns: solverCheck.turns,
    interceptionTurns: solverCheck.adaptiveTurns,
    outsideTheOracle: solverCheck.oracleMiss,
    outsideTheDynamicSolver: solverCheck.dynamicMiss,
    oracleDynamicPairs: solverCheck.oracleVsDynamicPairs,
    oracleDynamicDisagreements: solverCheck.oracleVsDynamic,
    interceptionPairs: solverCheck.adaptivePairs,
    pairsWhoseSupportThePolicyChanged: solverCheck.supportChangedByPolicy,
    examples: solverCheck.examples.filter((e) => e.who !== "static"),
  }));

  await guarded("H23", "adaptive", "the last direction is encoded and decoded exactly (contract, pack/unpack, both solvers' keys)", () => {
    const sample = solverTurns.slice(0, 400);
    let roundTrip = 0;
    let collisions = 0;
    let keysWrong = 0;
    let keys = 0;
    const rejects = [];
    const contract = sample.length ? packedStateContract(contextOf(sample[0]).sctx) : null;
    for (const t of sample) {
      const { sctx, dctx } = contextOf(t);
      const base = canonicalBefore(t);
      const seen = new Set();
      for (let d = 0; d < DIRECTION_CODES.length; d += 1) {
        const canonical = { e: keyOf(base.e), h: keyOf(base.h), s: keyOf(base.s), t: base.target < 0 ? -1 : [...sctx.packed.accessIds].indexOf(base.target), c: base.c, lights: base.lights, traps: base.traps, d };
        if (canonical.t < -1 || (base.target >= 0 && canonical.t < 0)) continue;
        const key = packState(sctx, canonical);
        if (seen.has(key)) collisions += 1;
        seen.add(key);
        if (!sameJson(unpackState(sctx, key), canonical)) roundTrip += 1;
      }
      // The solvers' own successor keys carry the step's direction.
      const a = actionIndexOf(t.action.direction);
      for (const [module, ctx] of [[solvers.rota2, null], [solvers.packed, sctx]]) {
        const set = module === solvers.rota2
          ? module.dynamicSuccessorSet(dctx, { e: base.e, h: base.h, s: base.s, t: base.target < 0 ? -1 : [...dctx.unionAccessIds].indexOf(base.target), c: base.c, lights: base.lights, traps: base.traps, d: base.d }, a)
          : module.packedSuccessorSet(ctx, { e: base.e, h: base.h, s: base.s, t: base.target < 0 ? -1 : [...sctx.packed.accessIds].indexOf(base.target), c: base.c, lights: base.lights, traps: base.traps, d: base.d }, a);
        if (!set || (module === solvers.packed && base.target >= 0 && ![...sctx.packed.accessIds].includes(base.target))) continue;
        for (const key of set.states) {
          keys += 1;
          const meta = module === solvers.rota2 ? dctx.closed.packed : sctx.packed;
          const x = decodePackedKey(meta, key);
          if (x.d !== a + 1 || module.PACKED_KEY_HAS_DIRECTION !== true) keysWrong += 1;
        }
      }
    }
    for (const bad of [-1, DIRECTION_CODES.length, 1.5]) {
      try {
        packState(contextOf(sample[0]).sctx, { ...canonicalBefore(sample[0]), e: keyOf(canonicalBefore(sample[0]).e), h: keyOf(canonicalBefore(sample[0]).h), s: keyOf(canonicalBefore(sample[0]).s), t: -1, d: bad });
        rejects.push({ d: bad, rejected: false });
      } catch {
        rejects.push({ d: bad, rejected: true });
      }
    }
    return {
      pass: sample.length > 0 && contract?.directionValues === 5 && roundTrip === 0 && collisions === 0 && keys > 0 && keysWrong === 0 && rejects.every((r) => r.rejected),
      directionValues: contract?.directionValues ?? null,
      states: sample.length,
      roundTripMismatches: roundTrip,
      keyCollisionsAcrossDirections: collisions,
      solverSuccessorKeys: keys,
      successorKeysWithoutTheStepsDirection: keysWrong,
      invalidDirectionsRejected: rejects,
    };
  });

  await guarded("H24", "adaptive", "the next state's direction is the step actually taken (hook and solvers); an illegal step is no successor", () => {
    let hookWrong = 0;
    let solverWrong = 0;
    let checked = 0;
    let illegalWithSuccessors = 0;
    let illegal = 0;
    for (const t of solverTurns.slice(0, 600)) {
      if (t.after.lastExplorerDirection !== t.action.direction) hookWrong += 1;
      const { dctx, sctx } = contextOf(t);
      const before = canonicalBefore(t);
      for (let a = 0; a < ACTIONS.length; a += 1) {
        const dyn = rota2Answer(solvers, dctx, before, a);
        const target = { row: Math.floor(before.e / 9) + ACTIONS[a].row, col: (before.e % 9) + ACTIONS[a].col };
        const blockedStep = !inBoard(target) || t.before.walls.has(cellKey(target));
        if (blockedStep) {
          illegal += 1;
          if (dyn !== null) illegalWithSuccessors += 1;
          continue;
        }
        if (!dyn) continue;
        checked += dyn.statesD.length;
        solverWrong += dyn.statesD.filter((s) => Number(s.slice(s.lastIndexOf("|") + 1)) !== a + 1).length;
        const sta = t.before.trapOpenedWalls.length ? null : packedAnswer(solvers, sctx, before, a);
        if (sta) {
          checked += sta.statesD.length;
          solverWrong += sta.statesD.filter((s) => Number(s.slice(s.lastIndexOf("|") + 1)) !== a + 1).length;
        }
      }
    }
    return {
      pass: checked > 0 && illegal > 0 && hookWrong === 0 && solverWrong === 0 && illegalWithSuccessors === 0,
      successorStates: checked,
      successorsWithAnotherDirection: solverWrong,
      hookMemoryNotTheStep: hookWrong,
      illegalSteps: illegal,
      illegalStepsWithSuccessors: illegalWithSuccessors,
    };
  });

  await guarded("H25", "preserved", "Route 1 maps and observable outcomes equal the base (36 seeded games, every mode)", () => ({
    pass:
      route1Equivalence.games >= 36 && route1Equivalence.mapsDiffer === 0 && route1Equivalence.rendersDiffer === 0 &&
      route1Equivalence.eventsDiffer === 0 && route1Equivalence.resultsDiffer === 0 && route1Equivalence.drawsDiffer === 0,
    games: route1Equivalence.games,
    renders: route1Equivalence.renders,
    turns: route1Equivalence.turns,
    wins: route1Equivalence.wins,
    losses: route1Equivalence.losses,
    captures: route1Equivalence.captures,
    mapsDiffer: route1Equivalence.mapsDiffer,
    gamesWithADifferentRender: route1Equivalence.rendersDiffer,
    gamesWithDifferentEvents: route1Equivalence.eventsDiffer,
    gamesWithADifferentResult: route1Equivalence.resultsDiffer,
    examples: route1Equivalence.examples,
  }));

  // ===============================================================================================================
  // H26 — the opened wall is part of the maze the Hunter plans on
  // ===============================================================================================================
  await guarded("H26", "adaptive", "the interception plans on the maze as it stands (the trap's opened wall included)", () => {
    const opened = answeredTurns.filter((t) => adaptiveRoute(t) && t.after.trapOpenedWalls.length > 0 && t.contract !== null && observedMove(t));
    const stale = (t) => contractInterception({ ...t.input, walls: t.map.walls });
    const sensitive = opened.filter((t) => planKey(stale(t)) !== planKey(t.contract));
    const followedStale = sensitive.filter((t) => {
      const s = stale(t);
      return s && s.moves.some((c) => sameCell(c, t.hunterAfter)) && !t.contract.moves.some((c) => sameCell(c, t.hunterAfter));
    });
    const notCurrent = sensitive.filter((t) => !t.contract.moves.some((c) => sameCell(c, t.hunterAfter)));
    const sameTurn = answeredTurns.filter((t) => t.events.some((e) => e.type === "WALL_OPENED_BY_TRAP") && adaptiveRoute(t) && t.repeat);
    // In the battery: the same state on the closed and the opened maze, planned differently.
    const batteryDiffers = battery.filter((b) => b.opened && planKey(b.helper) !== planKey(contractInterception({ ...b, walls: b.map.walls })) && planKey(b.helper) === planKey(b.contract));
    return {
      pass: opened.length > 0 && sensitive.length > 0 && notCurrent.length === 0 && followedStale.length === 0 && batteryDiffers.length > 0,
      interceptionsAfterTheWallOpened: opened.length,
      whereTheOpenedWallChangesThePlan: sensitive.length,
      hookNotOnTheCurrentMazePlan: notCurrent.length,
      hookOnTheStaleMazePlan: followedStale.length,
      repeatsOnTheTurnTheWallOpened: sameTurn.length,
      batteryStatesPlannedOnTheOpenedMaze: batteryDiffers.length,
    };
  });

  // ===============================================================================================================
  // H27 / H28 — turn order and objectives
  // ===============================================================================================================
  await guarded("H27", "preserved", "the Hunter answers before the Sentinel; the Sentinel decides exactly as on the base", () => {
    let hunterFirst = 0;
    let wrongOrder = 0;
    let sentinelAfterHunterCapture = 0;
    for (const t of answeredTurns) {
      const order = t.order.filter((x) => x !== "I");
      if (!order.length) continue;
      const hi = order.indexOf("H") === -1 ? t.order.indexOf("I") : order.indexOf("H");
      const si = order.indexOf("S");
      const capturedByHunter = t.events.some((e) => e.type === "EXPLORER_CAPTURED" && e.by === "hunter") || t.events.some((e) => e.type === "SECOND_CHANCE_USED" && e.cause === "hunter");
      if (capturedByHunter) {
        if (si >= 0) sentinelAfterHunterCapture += 1;
        continue;
      }
      if (si >= 0 && (t.order.indexOf("I") === 0 || (hi >= 0 && hi < si))) hunterFirst += 1;
      else wrongOrder += 1;
    }
    // Every Sentinel decision this suite caused, re-decided by the base's production `decideSentinelMove`.
    const decisions = trace.sentinel.slice(0, 20_000);
    let differs = 0;
    for (const d of decisions) {
      const args = [d.state, d.playerPosition, d.exitPosition, new Set(d.walls), d.zone, d.commitTurns, new Set(d.blocked)];
      const now = RT.API.decideSentinelMove(...args);
      const pre = PRE.API.decideSentinelMove(...args);
      if (!sameJson(now, pre)) differs += 1;
    }
    const sentinelSourceSame = (() => {
      const body = (text) => {
        if (!text) return null;
        const start = text.indexOf("export function decideSentinelMove(");
        const end = text.indexOf("const EMPTY_BLOCKED", start);
        return text.slice(start, end);
      };
      return body(textOf(FILES.defenders)) === body(baseText(FILES.defenders));
    })();
    return {
      pass: hunterFirst > 0 && wrongOrder === 0 && sentinelAfterHunterCapture === 0 && decisions.length > 0 && differs === 0 && sentinelSourceSame,
      turnsHunterThenSentinel: hunterFirst,
      turnsInAnotherOrder: wrongOrder,
      sentinelAskedAfterAHunterCapture: sentinelAfterHunterCapture,
      sentinelDecisionsReplayedOnTheBase: decisions.length,
      decisionsThatDiffer: differs,
      decideSentinelMoveTextUnchanged: sentinelSourceSame,
    };
  });

  await guarded("H28", "preserved", "the portal's requirements are unchanged (plan module, every render, one activation)", () => {
    const moduleSame = textOf(FILES.objectives) === baseText(FILES.objectives);
    let renders = 0;
    let mismatch = 0;
    let doubleActivation = 0;
    for (const game of games) {
      let activations = 0;
      for (const t of game.turns) {
        activations += t.events.filter((e) => e.type === "PORTAL_ACTIVATED").length;
        const g = t.after;
        renders += 1;
        const lights = g.collected.size >= game.map.collectibleStars.length;
        const link = (game.map.trapLinks ?? [])[0] ?? null;
        const open = link ? !g.walls.has(link.mutation.wall) : true;
        const expected = lights && (game.turns[0].spec.route === 1 || open);
        if (g.portalActive !== expected) mismatch += 1;
      }
      if (activations > 1) doubleActivation += 1;
    }
    return { pass: moduleSame && renders > 0 && mismatch === 0 && doubleActivation === 0, objectivesModuleUnchanged: moduleSame, states: renders, portalMismatch: mismatch, sessionsActivatingTwice: doubleActivation };
  });

  // ===============================================================================================================
  // H29 — new sessions forget
  // ===============================================================================================================
  await guarded("H29", "adaptive", "restart, a change of mode and the next Route all start with no remembered direction", () => {
    const rows = [];
    for (const route of [1, 2]) {
      for (const difficulty of ["medium", "hard"]) {
        const run = RT.mount({ seed: 9_440_000 + route * 10 + DIFFICULTIES.indexOf(difficulty), difficulty, routeNumber: route });
        const steps = () => {
          for (let i = 0; i < 6 && run.state.status === "playing"; i += 1) {
            const g = run.state;
            const legal = legalDirections(g, { chest: false });
            if (!legal.length) break;
            run.move(DELTA[legal[0]]);
          }
          return run.state.lastExplorerDirection;
        };
        const beforeRestart = steps();
        run.restart();
        const afterRestart = run.state.lastExplorerDirection;
        const beforeMode = steps();
        run.changeDifficulty(difficulty === "hard" ? "medium" : "hard");
        const afterMode = run.state.lastExplorerDirection;
        run.act((g) => g.startGame());
        const afterModeStart = run.state.lastExplorerDirection;
        steps();
        // Lose on purpose, then the next Route through the product's continuation.
        for (let i = 0; i < 200 && run.state.status === "playing"; i += 1) {
          const g = run.state;
          if (g.rewardChoicePending) {
            run.choose("pickaxe");
            continue;
          }
          const toward = pathBetween(g.player, g.guardian, g.walls);
          if (!toward || toward.length < 2) break;
          run.stepTo(toward[1]);
        }
        const beforeNext = run.state.lastExplorerDirection;
        let afterNext = "no continuation";
        let firstStepAdapts = null;
        if (run.state.status !== "playing" && run.completions.at(-1)?.continuation) {
          const next = run.nextSession();
          afterNext = next.state.lastExplorerDirection;
          const legal = legalDirections(next.state, { chest: false });
          if (legal.length) {
            next.move(DELTA[legal[0]]);
            firstStepAdapts = next.state.message === INTERCEPT_MESSAGE;
          }
          next.unmount();
        }
        rows.push({ route, difficulty, beforeRestart, afterRestart, beforeMode, afterMode, afterModeStart, beforeNext, afterNext, firstStepAdapts });
        run.unmount();
      }
    }
    const remembered = rows.filter((r) => r.beforeRestart && r.beforeMode && r.beforeNext).length;
    return {
      pass: rows.length > 0 && remembered === rows.length && rows.every((r) => r.afterRestart === null && r.afterMode === null && r.afterModeStart === null && r.afterNext === null && r.firstStepAdapts === false),
      sessions: rows.length,
      rememberedBeforeEachReset: remembered,
      rows,
    };
  });

  // ===============================================================================================================
  // H30 / H31 — what the mission did NOT add
  // ===============================================================================================================
  await guarded("H30", "preserved", "no new action or domain event; the state gains at most the one approved field", () => {
    const actions = declared(textOf(FILES.state), FILES.state, "RouteStateAction", { tag: "type" });
    const actionsBase = declared(baseText(FILES.state), FILES.state, "RouteStateAction", { tag: "type" });
    const events = declared(textOf(FILES.events), FILES.events, "RouteDomainEvent", { tag: "type" });
    const eventsBase = declared(baseText(FILES.events), FILES.events, "RouteDomainEvent", { tag: "type" });
    const fields = declared(textOf(FILES.state), FILES.state, "RouteRuntimeState");
    const fieldsBase = declared(baseText(FILES.state), FILES.state, "RouteRuntimeState");
    const added = fields.filter((f) => !fieldsBase.includes(f));
    const removed = fieldsBase.filter((f) => !fields.includes(f));
    const eventsFile = textOf(FILES.events) === baseText(FILES.events);
    return {
      pass: sameJson(actions, actionsBase) && sameJson(events, eventsBase) && eventsFile && removed.length === 0 && added.every((f) => f === "lastExplorerDirection"),
      actions: actions.length,
      events: events.length,
      eventsModuleUnchanged: eventsFile,
      stateFields: fields.length,
      addedFields: added,
      removedFields: removed,
    };
  });

  await guarded("H31", "preserved", "no timer, no score change, no new reward; an interception costs the Explorer nothing", () => {
    const timers = (text) => (text?.match(/\bset(Timeout|Interval)\(/g) ?? []).length;
    const rota = [FILES.hook, FILES.state, FILES.defenders, FILES.intercept];
    const timerCounts = Object.fromEntries(rota.map((f) => [f.split("/").pop(), { now: timers(textOf(f)), base: timers(baseText(f)) }]));
    const scoring = textOf(FILES.scoring) === baseText(FILES.scoring);
    const scoreCalls = (text) => (text?.match(/calculateEscapeMazeScore\(\{[\s\S]*?\}\)/g) ?? []).join("\n");
    const rewards = declared(textOf(FILES.invariants), FILES.invariants, "ChestReward");
    const rewardsBase = declared(baseText(FILES.invariants), FILES.invariants, "ChestReward");
    // Errors only grow on a capture; an interception turn changes no counter but `turns`.
    const errorWithoutCapture = allTurns.filter((t) => t.after.errors !== t.before.errors && !t.events.some((e) => e.type === "EXPLORER_CAPTURED"));
    const clock = /Date\.now|performance\.now|setTimeout|setInterval/.test(textOf(FILES.intercept) ?? "");
    return {
      pass: Object.values(timerCounts).every((c) => c.now === c.base) && scoring && scoreCalls(textOf(FILES.hook)) === scoreCalls(baseText(FILES.hook)) && sameJson(rewards, rewardsBase) && errorWithoutCapture.length === 0 && !clock,
      timerCallSites: timerCounts,
      scoringModuleUnchanged: scoring,
      scoreCallsUnchanged: scoreCalls(textOf(FILES.hook)) === scoreCalls(baseText(FILES.hook)),
      chestRewards: rewards,
      errorsWithoutACapture: errorWithoutCapture.length,
      clockInThePolicy: clock,
    };
  });

  // ===============================================================================================================
  // H32 — one implementation
  // ===============================================================================================================
  await guarded("H32", "adaptive", "the solvers call the production module the hook runs — no copy of the policy anywhere else", () => {
    if (!intercept) return { pass: false, interceptionModule: "absent" };
    // (a) one module: the hook's graph imports it, the solvers are handed that same instance.
    const hookImports = /from "@\/games\/escape-maze\/route-hunter-intercept"/.test(textOf(FILES.hook) ?? "");
    const productionImportsTools = (() => {
      const out = [];
      const walk = (dir) => {
        for (const entry of fs.readdirSync(path.join(REPO_ROOT, dir), { withFileTypes: true })) {
          const rel = `${dir}/${entry.name}`;
          if (entry.isDirectory()) walk(rel);
          else if (/\.(ts|tsx)$/.test(entry.name) && /from ["'][^"']*tools\//.test(fs.readFileSync(path.join(REPO_ROOT, rel), "utf8"))) out.push(rel);
        }
      };
      walk("src");
      return out;
    })();
    // (b) every interception a solver enumerates comes from a call to that module: count the calls the solvers make.
    const calls = { total: 0, intercepting: 0 };
    const counting = {
      ...intercept,
      planHunterInterception: (input) => {
        calls.total += 1;
        const plan = intercept.planHunterInterception(input);
        if (plan) calls.intercepting += 1;
        return plan;
      },
      hunterAdaptsOnRoute: intercept.hunterAdaptsOnRoute,
    };
    const perSolver = {};
    // Turns where the Hunter is asked at all: not an Explorer stepping onto a defender (the turn ends before it).
    const sample = solverTurns
      .filter((t) => adaptiveRoute(t) && t.contract !== null && !t.events.some((e) => e.type === "EXPLORER_CAPTURED" && e.by === "explorer-step"))
      .slice(0, 150);
    for (const [name, answerOf] of [
      ["dynamic", (t) => rota2Answer(solvers, solvers.rota2.buildDynamicContext(t.map, t.spec.difficulty, { requirePassage: t.before.passageRequired, routeNumber: t.spec.route, intercept: counting }), canonicalBefore(t), actionIndexOf(t.action.direction))],
      ["static", (t) => {
        if (t.before.trapOpenedWalls.length || t.after.trapOpenedWalls.length) return null;
        const ctx = buildContext(t.map, t.spec.difficulty);
        ctx.routeNumber = t.spec.route;
        ctx.intercept = counting;
        return packedAnswer(solvers, ctx, canonicalBefore(t), actionIndexOf(t.action.direction));
      }],
    ]) {
      const start = { ...calls };
      let asked = 0;
      for (const t of sample) {
        if (answerOf(t) !== null) asked += 1;
      }
      perSolver[name] = { transitionsAsked: asked, moduleCalls: calls.total - start.total, interceptingCalls: calls.intercepting - start.intercepting };
    }
    // (c) no tooling file holds a policy of its own: no horizon table, no "two cells ahead" outside the module.
    const toolFiles = fs.readdirSync(path.join(REPO_ROOT, "tools/validation")).filter((f) => f.endsWith(".mjs") && f !== path.basename(new URL(import.meta.url).pathname));
    const copies = toolFiles.filter((f) => /INTERCEPT_HORIZON\s*[:=]|horizon\s*=\s*difficulty\s*===\s*"hard"/.test(fs.readFileSync(path.join(REPO_ROOT, "tools/validation", f), "utf8")));
    const solverSources = Object.fromEntries([INTERCEPT_ADAPTER_FILE, PACKED_FILE, ROTA2_FILE].map((f) => [f, solvers.sources[f] ?? ""]));
    const adapterCalls = /intercept\.planHunterInterception\(/.test(solverSources[INTERCEPT_ADAPTER_FILE]);
    const solversUseAdapter = [PACKED_FILE, ROTA2_FILE].every((f) => /interceptionMoves\(/.test(solverSources[f]) && /from "\.\/hunter-interception-support\.mjs"/.test(solverSources[f]));
    return {
      pass:
        hookImports && productionImportsTools.length === 0 && Object.values(perSolver).every((s) => s.transitionsAsked > 0 && s.moduleCalls >= s.transitionsAsked && s.interceptingCalls > 0) &&
        copies.length === 0 && adapterCalls && solversUseAdapter,
      hookImportsTheModule: hookImports,
      productionFilesImportingTools: productionImportsTools,
      callsToTheProductionModule: perSolver,
      toolingFilesWithAPolicyOfTheirOwn: copies,
      adapterCallsTheModule: adapterCalls,
      bothSolversCallTheAdapter: solversUseAdapter,
    };
  });

  return { results, fixtureSummary };
}

// =================================================================================================
// mutants — in-memory edits of today's tree (production or a solver); each must fail a check it targets
// =================================================================================================

const edit = (from, to, id) => (source) => {
  if (source.split(from).length !== 2) throw new Error(`mutant ${id}: anchor not found exactly once`);
  return source.replace(from, () => to);
};
const chain = (...fns) => (source) => fns.reduce((s, fn) => fn(s), source);
const HOOK = FILES.hook;
const STATE = FILES.state;
const DEFENDERS = FILES.defenders;
const INTERCEPT = FILES.intercept;
const MUTANTS_LIST = [
  { id: "M01", name: "the adaptive Hunter triggers on Route 1", targets: ["H08", "H01", "H02", "H25"], transforms: { [INTERCEPT]: edit("  return routeNumber >= 2;", "  return routeNumber >= 1;", "M01") } },
  { id: "M02", name: "a repeated direction never triggers", targets: ["H07", "H22"], transforms: { [INTERCEPT]: edit("  if (direction === null || previousDirection !== direction) return null;", "  if (direction === null || previousDirection !== direction || direction !== null) return null;", "M02") } },
  { id: "M03", name: "a different direction triggers too", targets: ["H06"], transforms: { [INTERCEPT]: edit("  if (direction === null || previousDirection !== direction) return null;", "  if (direction === null || previousDirection === null) return null;", "M03") } },
  { id: "M04", name: "the direction memory never updates", targets: ["H04", "H07"], transforms: { [STATE]: edit("          explorerStepDirection(state.player, action.player) ??\n          state.lastExplorerDirection,", "          state.lastExplorerDirection,", "M04") } },
  { id: "M05", name: "the memory the turn reads is reset on every render", targets: ["H07"], transforms: { [HOOK]: edit("          previousDirection: lastExplorerDirection,", "          previousDirection: null,", "M05") } },
  {
    id: "M06", name: "the memory leaks from the previous Route", targets: ["H29"],
    transforms: { [STATE]: chain(
      edit("export interface RouteRuntimeState {", "let carriedDirection: ExplorerDirection | null = null;\nexport interface RouteRuntimeState {", "M06 module"),
      edit("    lastExplorerDirection: null,\n  };", "    lastExplorerDirection: carriedDirection,\n  };", "M06 create"),
      edit("        lastExplorerDirection:\n          explorerStepDirection(state.player, action.player) ??\n          state.lastExplorerDirection,", "        lastExplorerDirection: (carriedDirection =\n          explorerStepDirection(state.player, action.player) ??\n          state.lastExplorerDirection),", "M06 move"),
    ) },
  },
  { id: "M07", name: "Easy predicts two cells ahead", targets: ["H09"], transforms: { [INTERCEPT]: edit("  easy: 1,\n  medium: 1,", "  easy: 2,\n  medium: 1,", "M07") } },
  { id: "M08", name: "Hard does not use the two-cell prediction", targets: ["H11"], transforms: { [INTERCEPT]: edit("  medium: 1,\n  hard: 2,", "  medium: 1,\n  hard: 1,", "M08") } },
  { id: "M09", name: "the Hunter may step onto an armed trap", targets: ["H15"], transforms: { [HOOK]: edit("              blocked: hunterBlocked,", "              blocked: new Set([posKey(input.sentinelFrom.position)]),", "M09") } },
  { id: "M10", name: "the Hunter may step onto the Sentinel", targets: ["H16"], transforms: { [HOOK]: edit("              blocked: hunterBlocked,", "              blocked: input.armedTraps,", "M10") } },
  { id: "M11", name: "the Hunter may step onto the portal", targets: ["H17"], transforms: { [INTERCEPT]: edit("    !(row === exitPosition.row && col === exitPosition.col) &&\n", "", "M11") } },
  { id: "M12", name: "the Hunter teleports to the predicted cell", targets: ["H18"], transforms: { [INTERCEPT]: edit("    if (moves.length > 0) return { target, horizon, moves };", "    if (moves.length > 0) return { target, horizon, moves: [target] };", "M12") } },
  { id: "M13", name: "the prediction passes through a wall", targets: ["H14"], transforms: { [INTERCEPT]: edit("      if (!inBoard(row, col) || isWall(row, col)) {", "      if (!inBoard(row, col)) {", "M13") } },
  {
    id: "M14", name: "a solver computes the moves with its own copy of the policy", targets: ["H32"],
    solverEdits: {
      [ROTA2_FILE]: edit(
        "  const intercepting = interceptionMoves(after, state.h, next, state.d, actionIndex, traps, state.s);",
        "  const intercepting = copiedInterceptionMoves(after, state.h, next, state.d, actionIndex, traps, state.s);",
        "M14 call",
      ),
    },
    // The copy is the module's own algorithm, transcribed: identical answers, a second implementation.
    copyInto: ROTA2_FILE,
  },
  { id: "M15", name: "the static solver is updated but the dynamic solver is stale", targets: ["H22"], solverEdits: { [ROTA2_FILE]: edit("  const intercepting = interceptionMoves(after, state.h, next, state.d, actionIndex, traps, state.s);", "  const intercepting = null;", "M15") } },
  {
    id: "M16", name: "the dynamic solver is updated but the static solver is stale (no direction, no interception)", targets: ["H21", "H24"],
    solverEdits: { [PACKED_FILE]: chain(
      edit("  const direction = directionCodeOfAction(actionIndex);\n  const intercepting = interceptionMoves(meta, state.h, next, state.d, actionIndex, traps, state.s);", "  const direction = 0;\n  const intercepting = null;", "M16"),
    ) },
  },
  {
    id: "M17", name: "the solvers ignore the remembered direction", targets: ["H22", "H21"],
    solverEdits: {
      [ROTA2_FILE]: edit("interceptionMoves(after, state.h, next, state.d, actionIndex, traps, state.s)", "interceptionMoves(after, state.h, next, 0, actionIndex, traps, state.s)", "M17 dynamic"),
      [PACKED_FILE]: edit("interceptionMoves(meta, state.h, next, state.d, actionIndex, traps, state.s)", "interceptionMoves(meta, state.h, next, 0, actionIndex, traps, state.s)", "M17 static"),
    },
  },
  { id: "M18", name: "a successor keeps the previous direction instead of the step's", targets: ["H24"], solverEdits: { [ROTA2_FILE]: edit("  const direction = directionCodeOfAction(actionIndex);", "  const direction = state.d;", "M18") } },
  { id: "M19", name: "the interception peeks at the random stream before choosing", targets: ["H20"], transforms: { [DEFENDERS]: edit("  return moves.length === 1 ? moves[0] : randomItem(moves);", "  const peek = routeRandom();\n  return moves.length === 1 ? moves[0] : moves[Math.floor(peek * moves.length)];", "M19") } },
  { id: "M20", name: "a single interception move still consumes a draw", targets: ["H20"], transforms: { [DEFENDERS]: edit("  return moves.length === 1 ? moves[0] : randomItem(moves);", "  return randomItem(moves);", "M20") } },
  { id: "M21", name: "the opened wall is ignored by the interception", targets: ["H26"], transforms: { [HOOK]: edit("              walls: input.graphWalls,", "              walls: mazeMap.walls,", "M21") } },
  { id: "M22", name: "the Sentinel's policy changes", targets: ["H27"], transforms: { [DEFENDERS]: edit("const SENTINEL_THREAT_HORIZON = 6;", "const SENTINEL_THREAT_HORIZON = 5;", "M22") } },
  { id: "M23", name: "Route 1's random stream changes", targets: ["H02", "H25"], transforms: { [HOOK]: edit("          : chooseGuardianMove(\n", "          : (chooseInterceptionMove([input.guardianFrom, input.guardianFrom]), chooseGuardianMove)(\n", "M23") } },
  { id: "M24", name: "the interception can put the Hunter in a wall (an illegal state)", targets: ["H18"], transforms: { [INTERCEPT]: edit("  const hunterMoves = NEIGHBOUR_DELTAS.map((delta) => ({\n    row: hunter.row + delta.row,\n    col: hunter.col + delta.col,\n  })).filter((cell) => hunterMayEnter(cell.row, cell.col));", "  const hunterMoves = NEIGHBOUR_DELTAS.map((delta) => ({\n    row: hunter.row + delta.row,\n    col: hunter.col + delta.col,\n  })).filter((cell) => inBoard(cell.row, cell.col));", "M24") } },
  {
    id: "M25", name: "an interception that reaches its prediction counts as a capture (a result without a real move)", targets: ["H18"],
    transforms: { [HOOK]: edit("      if (positionsEqual(nextGuardian, input.playerPosition)) {", "      if (positionsEqual(nextGuardian, input.playerPosition) || (interception !== null && positionsEqual(nextGuardian, interception.target))) {", "M25") },
  },
];

/** M14's transcription: the module's algorithm, written into the dynamic solver as its own function. */
function copiedPolicySource() {
  return `
// M14 MUTANT — a transcription of the production policy, in the solver.
function copiedInterceptionMoves(meta, hunter, player, previousCode, actionIndex, traps, sentinel) {
  if (meta.routeNumber < 2) return null;
  if (previousCode !== actionIndex + 1) return null;
  const H = { row: Math.floor(hunter / 9), col: hunter % 9 };
  const E = { row: Math.floor(player / 9), col: player % 9 };
  if (Math.abs(H.row - E.row) + Math.abs(H.col - E.col) <= 1) return null;
  const isBlocked = (id) => id === sentinel || (meta.trapBitByCell[id] & traps) !== 0;
  const inB = (r, c) => r >= 0 && r < 9 && c >= 0 && c < 9;
  const may = (r, c) => inB(r, c) && !meta.walls[r * 9 + c] && r * 9 + c !== meta.exitId && !isBlocked(r * 9 + c);
  const D = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const step = D[actionIndex];
  const moves0 = D.map(([dr, dc]) => [H.row + dr, H.col + dc]).filter(([r, c]) => may(r, c));
  for (let k = meta.difficulty === "hard" ? 2 : 1; k >= 1; k -= 1) {
    let ok = true;
    for (let i = 1; i <= k; i += 1) if (!inB(E.row + step[0] * i, E.col + step[1] * i) || meta.walls[(E.row + step[0] * i) * 9 + E.col + step[1] * i]) ok = false;
    if (!ok) continue;
    const T = [E.row + step[0] * k, E.col + step[1] * k];
    if (!may(T[0], T[1]) || (T[0] === H.row && T[1] === H.col)) continue;
    let moves;
    if (meta.difficulty === "easy") moves = moves0.filter(([r, c]) => r === T[0] && c === T[1]);
    else {
      const dist = new Int16Array(81).fill(-1);
      const q = [T[0] * 9 + T[1]];
      dist[q[0]] = 0;
      for (let h = 0; h < q.length; h += 1) {
        const r = Math.floor(q[h] / 9), c = q[h] % 9;
        for (const [dr, dc] of D) {
          const nr = r + dr, nc = c + dc;
          if (!inB(nr, nc) || dist[nr * 9 + nc] !== -1) continue;
          const isH = nr === H.row && nc === H.col;
          if (!isH && (!may(nr, nc) || (nr === E.row && nc === E.col))) continue;
          dist[nr * 9 + nc] = dist[q[h]] + 1;
          q.push(nr * 9 + nc);
        }
      }
      const fh = dist[H.row * 9 + H.col];
      moves = fh === -1 ? [] : moves0.filter(([r, c]) => dist[r * 9 + c] === fh - 1);
    }
    if (moves.length) return moves.map(([r, c]) => r * 9 + c);
  }
  return null;
}
`;
}

// =================================================================================================
// main
// =================================================================================================

async function main() {
  if (MUTANTS) {
    console.log("ROTA2 adaptive Hunter — mutants (each must be caught by a check it targets)\n");
    const clean = await runSuite({ quiet: true });
    const cleanFailing = clean.results.filter((r) => !r.pass).map((r) => r.id);
    if (cleanFailing.length) {
      console.log(`the clean tree fails ${cleanFailing.join(", ")} — mutants are meaningless until it passes`);
      return EXIT_VALIDATION_FAILED;
    }
    const rows = [];
    for (const mutant of MUTANTS_LIST) {
      let outcome;
      try {
        const solverEdits = { ...(mutant.solverEdits ?? {}) };
        if (mutant.copyInto) {
          const call = solverEdits[mutant.copyInto];
          solverEdits[mutant.copyInto] = (source) => `${call(source)}\n${copiedPolicySource()}`;
        }
        const run = await runSuite({ quiet: true, transforms: mutant.transforms ?? [], solverEdits });
        const failing = run.results.filter((r) => !r.pass).map((r) => r.id);
        const caughtBy = mutant.targets.filter((id) => failing.includes(id));
        outcome = { caught: caughtBy.length > 0, caughtBy, alsoFailing: failing.filter((id) => !mutant.targets.includes(id)) };
      } catch (error) {
        outcome = { caught: false, broken: String(error?.message ?? error).split("\n")[0] };
      }
      rows.push({ id: mutant.id, name: mutant.name, targets: mutant.targets, ...outcome });
      console.log(`${outcome.caught ? "CAUGHT" : outcome.broken ? "BROKEN" : "MISSED"}  ${mutant.id} — ${mutant.name}${outcome.caughtBy ? ` (by ${outcome.caughtBy.join(", ")}${outcome.alsoFailing?.length ? `; also failing ${outcome.alsoFailing.join(", ")}` : ""})` : ""}${outcome.broken ? `: ${outcome.broken}` : ""}`);
    }
    const caught = rows.filter((r) => r.caught).length;
    console.log(`\n${caught}/${rows.length} mutants caught`);
    console.log(caught === rows.length ? "ROTA2_ADAPTIVE_HUNTER_MUTANTS_CAUGHT" : "ROTA2_ADAPTIVE_HUNTER_MUTANTS_MISSED");
    const EVIDENCE = openEvidence(process.env.ROUTE_VALIDATION_OUT ?? "docs/archive/rota2-adaptive-hunter-04");
    EVIDENCE.write("mutants.json", { mission: "ROTA2-ADAPTIVE-HUNTER-04", caught, total: rows.length, mutants: rows });
    return EVIDENCE.finish({ ok: caught === rows.length });
  }

  if (REV) {
    console.log(`ROTA2 adaptive Hunter — counterfactual on ${REV}: every [adaptive] check must FAIL, every [preserved] check must PASS\n`);
    const { results } = await runSuite({ rev: REV });
    const wrong = results.filter((r) => (r.tag === "adaptive" ? r.pass : !r.pass));
    const n = (tag, pass) => results.filter((r) => r.tag === tag && r.pass === pass).length;
    const all = (tag) => results.filter((r) => r.tag === tag).length;
    console.log(`\nadaptive failing ${n("adaptive", false)}/${all("adaptive")} · preserved holding ${n("preserved", true)}/${all("preserved")}`);
    if (wrong.length) console.log(`unexpected: ${wrong.map((r) => `${r.id}(${r.pass ? "passed" : "failed"})`).join(", ")}`);
    console.log(wrong.length === 0 ? "ROTA2_ADAPTIVE_HUNTER_COUNTERFACTUAL_HOLDS" : "ROTA2_ADAPTIVE_HUNTER_COUNTERFACTUAL_BROKEN");
    const EVIDENCE = openEvidence(process.env.ROUTE_VALIDATION_OUT ?? "docs/archive/rota2-adaptive-hunter-04");
    EVIDENCE.write(`counterfactual-${REV.slice(0, 7)}.json`, {
      mission: "ROTA2-ADAPTIVE-HUNTER-04",
      rev: REV,
      holds: wrong.length === 0,
      adaptiveFailing: n("adaptive", false),
      adaptiveTotal: all("adaptive"),
      preservedHolding: n("preserved", true),
      preservedTotal: all("preserved"),
      checks: results.map(({ id, tag, name, pass, detail }) => ({ id, tag, name, pass, detail })),
    });
    return EVIDENCE.finish({ ok: wrong.length === 0 });
  }

  const started = performance.now();
  const { results, fixtureSummary } = await runSuite();
  const passed = results.filter((r) => r.pass).length;
  const allPass = passed === results.length;
  console.log(`\n${passed}/${results.length} passed${allPass ? "" : ` · failing: ${results.filter((r) => !r.pass).map((r) => r.id).join(", ")}`}`);
  console.log(allPass ? "ROTA2_ADAPTIVE_HUNTER_TESTS_OK" : "ROTA2_ADAPTIVE_HUNTER_TESTS_FAILED");
  const EVIDENCE = openEvidence(process.env.ROUTE_VALIDATION_OUT ?? "docs/archive/rota2-adaptive-hunter-04");
  EVIDENCE.write(
    "adaptive-hunter-tests.json",
    {
      mission: "ROTA2-ADAPTIVE-HUNTER-04",
      base: ADAPTIVE_BASE,
      allPass,
      passed,
      total: results.length,
      fixtures: fixtureSummary,
      checks: results.map(({ id, tag, name, pass, detail }) => ({ id, tag, name, pass, detail })),
      run: { elapsedMs: Math.round(performance.now() - started) },
    },
    { metadata: ["run"] },
  );
  return EVIDENCE.finish({ ok: allPass });
}

process.exitCode = await main();
