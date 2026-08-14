/**
 * ROTA-ADVERSARIAL-SOLVABILITY-03
 *
 * Reconciles the exact PRE_CHEST label with the shipped Chest runtime. The
 * second-chance-only graph is exhausted exactly. The full-runtime search uses
 * exact positive-probability Hunter support and the production Sentinel policy;
 * its priority queue changes exploration order only, never transition identity.
 */
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";

import {
  ACTIONS,
  API,
  buildContext,
  hunterSupport,
  setSeed,
} from "./dynamic-solver.mjs";
import { enumeratePackedSuccessors } from "./dynamic-solver-packed-successors.mjs";
import {
  initialPackedState,
  packState,
  unpackState,
} from "./dynamic-solver-packed.mjs";

const OUT = path.resolve(
  process.env.ROUTE_VALIDATION_OUT ?? "docs/archive/route-adversarial-solvability-03",
);
const CASES = [
  { seed: 8_801_107, route: 1, mode: "medium" },
  { seed: 8_801_214, route: 1, mode: "hard" },
];
const BOARD_SIDE = 9;
const SECOND_PHASE = ["PRE_CHEST", "SECOND_CHANCE_READY", "SECOND_CHANCE_SPENT"];
const FULL_BUDGET = Number(process.argv.includes("--budget")
  ? process.argv[process.argv.indexOf("--budget") + 1]
  : 1_000_000);
const FULL_TIMEOUT_MS = Number(process.argv.includes("--timeout-ms")
  ? process.argv[process.argv.indexOf("--timeout-ms") + 1]
  : 120_000);

const same = (a, b) => a.row === b.row && a.col === b.col;
const keyOf = (position) => API.posKey(position);
const cellId = (position) => position.row * BOARD_SIDE + position.col;
const inBounds = (position) =>
  position.row >= 0 && position.row < BOARD_SIDE &&
  position.col >= 0 && position.col < BOARD_SIDE;
const rewardSpent = (reward) => reward === "PICKAXE_SPENT" || reward === "SECOND_CHANCE_SPENT";
const secondChanceReady = (reward) => reward === "SECOND_CHANCE_READY";

class MinHeap {
  constructor() { this.items = []; }
  get size() { return this.items.length; }
  push(value) {
    const items = this.items;
    items.push(value);
    let index = items.length - 1;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (items[parent].priority <= value.priority) break;
      items[index] = items[parent];
      index = parent;
    }
    items[index] = value;
  }
  pop() {
    const items = this.items;
    const first = items[0];
    const last = items.pop();
    if (items.length > 0) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= items.length) break;
        let child = left;
        if (right < items.length && items[right].priority < items[left].priority) child = right;
        if (items[child].priority >= last.priority) break;
        items[index] = items[child];
        index = child;
      }
      items[index] = last;
    }
    return first;
  }
}

function exactSecondChance(ctx, budget = 2_000_000) {
  const started = performance.now();
  const chest = cellId(ctx.map.chest);
  const initial = initialPackedState(ctx);
  const initialBase = packState(ctx, initial);
  const ids = new Map();
  const baseKeys = [];
  const phases = [];
  const fields = [];
  const parents = [];
  const parentSteps = [];
  let processed = 0;
  let transitions = 0;
  let captures = 0;
  let terminalLosses = 0;
  let win = null;

  const add = (baseKey, phase, state, parent = -1, via = null) => {
    const key = baseKey * 3 + phase;
    const existing = ids.get(key);
    if (existing !== undefined) return existing;
    const id = baseKeys.length;
    ids.set(key, id);
    baseKeys.push(baseKey);
    phases.push(phase);
    fields.push(state);
    parents.push(parent);
    parentSteps.push(via);
    return id;
  };
  add(initialBase, 0, initial);

  while (processed < baseKeys.length && baseKeys.length <= budget && win === null) {
    const id = processed++;
    const state = fields[id];
    for (let actionIndex = 0; actionIndex < ACTIONS.length; actionIndex += 1) {
      const captured = [];
      const emitted = [];
      const result = enumeratePackedSuccessors(
        ctx,
        state,
        actionIndex,
        (baseKey, e, h, s, t, c, lights, traps) =>
          emitted.push({ baseKey, state: { e, h, s, t, c, lights, traps } }),
        { onCapture: (event) => captured.push(event) },
      );
      if (!result) continue;
      transitions += result.stateCount + Number(result.hasLoss) + Number(result.hasWin);
      if (result.hasWin) {
        win = { from: id, action: ACTIONS[actionIndex].name };
        break;
      }
      for (const outcome of emitted) {
        const phase = phases[id] === 0 && outcome.state.e === chest ? 1 : phases[id];
        add(outcome.baseKey, phase, outcome.state, id, {
          action: ACTIONS[actionIndex].name,
          event: phase !== phases[id] ? "CHEST_SECOND_CHANCE" : "NORMAL",
        });
      }
      for (const event of captured) {
        captures += 1;
        if (event.kind === "EXPLORER") {
          if (phases[id] === 1) {
            add(baseKeys[id], 2, state, id, {
              action: ACTIONS[actionIndex].name,
              event: "SECOND_CHANCE_EXPLORER",
            });
          } else terminalLosses += 1;
          continue;
        }
        const ready = phases[id] === 1 || (phases[id] === 0 && event.next === chest);
        if (!ready) {
          terminalLosses += 1;
          continue;
        }
        const recovered = {
          e: event.next,
          h: state.h,
          s: state.s,
          t: state.t,
          c: state.c,
          lights: event.lights,
          traps: event.traps,
        };
        add(packState(ctx, recovered), 2, recovered, id, {
          action: ACTIONS[actionIndex].name,
          event: `SECOND_CHANCE_${event.kind}`,
        });
      }
    }
  }

  let witness = null;
  if (win) {
    witness = [];
    let current = win.from;
    while (parents[current] >= 0) {
      witness.push({
        ...parentSteps[current],
        phase: SECOND_PHASE[phases[current]],
        state: unpackState(ctx, baseKeys[current]),
      });
      current = parents[current];
    }
    witness.reverse();
    witness.push({ action: win.action, event: "WIN", phase: "TERMINAL", state: "WIN" });
  }
  return {
    exact: true,
    states: baseKeys.length,
    processed,
    transitions,
    captures,
    terminalLosses,
    exhausted: processed === baseKeys.length,
    truncated: baseKeys.length > budget,
    possibleWin: Boolean(win),
    witness,
    elapsedMs: performance.now() - started,
  };
}

function fullStateKey(state) {
  return [
    keyOf(state.e), keyOf(state.h), keyOf(state.s),
    state.target ? keyOf(state.target) : "-", state.commit,
    state.lights, state.traps, state.reward, state.broken ?? "-",
  ].join("|");
}

function snapshot(state) {
  return {
    explorer: keyOf(state.e),
    hunter: keyOf(state.h),
    sentinel: keyOf(state.s),
    sentinelTarget: state.target ? keyOf(state.target) : null,
    commitLeft: state.commit,
    lights: state.lights,
    traps: state.traps,
    reward: state.reward,
    rewardSpent: rewardSpent(state.reward),
    brokenWall: state.broken,
  };
}

function fullRuntimePossible(ctx, budget = FULL_BUDGET, timeoutMs = FULL_TIMEOUT_MS) {
  const started = performance.now();
  const { map, difficulty } = ctx;
  const lightKeys = map.collectibleStars.map(keyOf);
  const trapKeys = map.traps.map(keyOf);
  const allLights = (1 << lightKeys.length) - 1;
  const topologyCache = new Map();
  const topology = (broken) => {
    const id = broken ?? "BASE";
    let value = topologyCache.get(id);
    if (value) return value;
    const walls = new Set(map.walls);
    if (broken) walls.delete(broken);
    value = {
      walls,
      zone: API.computePortalDefenceZone(map.playerStart, map.exitPosition, walls),
    };
    topologyCache.set(id, value);
    return value;
  };
  const sentinelInitial = API.createSentinelState(map, topology(null).zone);
  const initial = {
    e: map.playerStart,
    h: map.guardianStart,
    s: sentinelInitial.position,
    target: sentinelInitial.target,
    commit: sentinelInitial.commitLeft,
    lights: 0,
    traps: 0,
    reward: "PRE_CHEST",
    broken: null,
  };
  const ids = new Map();
  const states = [];
  const parents = [];
  const steps = [];
  const depths = [];
  const heap = new MinHeap();
  let processed = 0;
  let transitions = 0;
  let captureBranches = 0;
  let terminalLosses = 0;
  let serial = 0;
  let win = null;

  const heuristic = (state) => {
    let remaining = 0;
    let nearest = Number.POSITIVE_INFINITY;
    const { walls } = topology(state.broken);
    for (let index = 0; index < map.collectibleStars.length; index += 1) {
      if (state.lights & (1 << index)) continue;
      remaining += 1;
      nearest = Math.min(
        nearest,
        API.findPathLength(state.e, map.collectibleStars[index], walls) ?? 99,
      );
    }
    if (remaining === 0) nearest = API.findPathLength(state.e, map.exitPosition, walls) ?? 99;
    if (state.reward === "PRE_CHEST") {
      nearest = Math.min(nearest, API.findPathLength(state.e, map.chest, walls) ?? 99);
    }
    const breakBias = state.reward === "PICKAXE_READY" ? -8 : 0;
    return remaining * 20 + nearest + breakBias;
  };
  const add = (state, parent = -1, via = null) => {
    const key = fullStateKey(state);
    const existing = ids.get(key);
    if (existing !== undefined) return existing;
    const id = states.length;
    ids.set(key, id);
    states.push(state);
    parents.push(parent);
    steps.push(via);
    const depth = parent < 0 ? 0 : depths[parent] + 1;
    depths.push(depth);
    heap.push({ id, priority: depth + heuristic(state), serial: serial++ });
    return id;
  };
  add(initial);

  const armedTraps = (mask) => {
    const armed = new Set();
    for (let index = 0; index < trapKeys.length; index += 1) {
      if (mask & (1 << index)) armed.add(trapKeys[index]);
    }
    return armed;
  };

  const defenderOutcomes = (before, committed, reward, broken, action, event) => {
    const { walls, zone } = topology(broken);
    const armed = armedTraps(committed.traps);
    const outcomes = [];
    const seen = new Set();
    const hunters = hunterSupport(
      before.h, committed.e, map.exitPosition, walls, difficulty, armed, before.s,
    );
    const sentinelBefore = {
      position: before.s,
      target: before.target,
      commitLeft: before.commit,
    };
    for (const hunter of hunters) {
      if (same(hunter, committed.e)) {
        captureBranches += 1;
        if (secondChanceReady(reward)) {
          const recovered = {
            ...committed,
            h: before.h,
            s: before.s,
            target: before.target,
            commit: before.commit,
            reward: "SECOND_CHANCE_SPENT",
            broken,
          };
          const key = fullStateKey(recovered);
          if (!seen.has(key)) {
            seen.add(key);
            outcomes.push({ state: recovered, via: { action, event: `${event}_SECOND_CHANCE_HUNTER` } });
          }
        } else terminalLosses += 1;
        continue;
      }
      const sentinel = API.decideSentinelMove(
        sentinelBefore, committed.e, map.exitPosition, walls, zone, 3, armed,
      );
      const settled = same(sentinel.position, hunter) && !same(sentinel.position, before.s)
        ? { ...sentinel, position: before.s }
        : sentinel;
      if (same(settled.position, committed.e)) {
        captureBranches += 1;
        if (secondChanceReady(reward)) {
          const recovered = {
            ...committed,
            h: before.h,
            s: before.s,
            target: before.target,
            commit: before.commit,
            reward: "SECOND_CHANCE_SPENT",
            broken,
          };
          const key = fullStateKey(recovered);
          if (!seen.has(key)) {
            seen.add(key);
            outcomes.push({ state: recovered, via: { action, event: `${event}_SECOND_CHANCE_SENTINEL` } });
          }
        } else terminalLosses += 1;
        continue;
      }
      const next = {
        ...committed,
        h: hunter,
        s: settled.position,
        target: settled.target,
        commit: settled.commitLeft,
        reward,
        broken,
      };
      const key = fullStateKey(next);
      if (!seen.has(key)) {
        seen.add(key);
        outcomes.push({ state: next, via: { action, event } });
      }
    }
    return outcomes;
  };

  const expandMove = (id, state, action) => {
    const { walls } = topology(state.broken);
    const next = { row: state.e.row + action.row, col: state.e.col + action.col };
    if (!inBounds(next) || walls.has(keyOf(next))) return [];
    const actionName = `MOVE_${action.name}`;
    if (same(next, state.h) || same(next, state.s)) {
      if (!secondChanceReady(state.reward)) {
        terminalLosses += 1;
        return [];
      }
      return [{
        state: { ...state, reward: "SECOND_CHANCE_SPENT" },
        via: { action: actionName, event: "SECOND_CHANCE_EXPLORER" },
      }];
    }
    let lights = state.lights;
    const lightIndex = lightKeys.indexOf(keyOf(next));
    if (lightIndex >= 0) lights |= 1 << lightIndex;
    let traps = state.traps;
    const trapIndex = trapKeys.indexOf(keyOf(next));
    if (trapIndex >= 0) traps |= 1 << trapIndex;
    if (same(next, map.exitPosition) && lights === allLights) {
      win = { from: id, via: { action: actionName, event: "WIN" } };
      return [];
    }
    const committed = { ...state, e: next, lights, traps };
    if (state.reward === "PRE_CHEST" && same(next, map.chest)) {
      return [
        ...defenderOutcomes(
          state, committed, "PICKAXE_READY", null,
          `${actionName}_CHOOSE_PICKAXE`, "CHEST_PICKAXE",
        ),
        ...defenderOutcomes(
          state, committed, "SECOND_CHANCE_READY", null,
          `${actionName}_CHOOSE_SECOND_CHANCE`, "CHEST_SECOND_CHANCE",
        ),
      ];
    }
    return defenderOutcomes(
      state, committed, state.reward, state.broken, actionName, "NORMAL",
    );
  };

  while (heap.size > 0 && states.length <= budget && win === null) {
    if (performance.now() - started > timeoutMs) break;
    const { id } = heap.pop();
    const state = states[id];
    processed += 1;
    if (state.reward === "PICKAXE_READY") {
      for (const action of ACTIONS) {
        const wall = { row: state.e.row + action.row, col: state.e.col + action.col };
        if (!inBounds(wall) || !map.walls.has(keyOf(wall))) continue;
        const broken = keyOf(wall);
        const committed = { ...state, reward: "PICKAXE_SPENT", broken };
        const outcomes = defenderOutcomes(
          state, committed, "PICKAXE_SPENT", broken,
          `BREAK_${broken}`, "PICKAXE_BREAK",
        );
        transitions += outcomes.length;
        for (const outcome of outcomes) add(outcome.state, id, outcome.via);
      }
    }
    for (const action of ACTIONS) {
      const outcomes = expandMove(id, state, action);
      transitions += outcomes.length;
      for (const outcome of outcomes) add(outcome.state, id, outcome.via);
      if (win) break;
    }
  }

  let witness = null;
  if (win) {
    witness = [];
    let current = win.from;
    while (parents[current] >= 0) {
      witness.push({ ...steps[current], state: snapshot(states[current]) });
      current = parents[current];
    }
    witness.reverse();
    witness.push({ ...win.via, state: "WIN" });
  }
  return {
    exactTransitions: true,
    searchOrder: "A_STAR_DIAGNOSTIC",
    absenceIsProof: false,
    states: states.length,
    processed,
    transitions,
    captureBranches,
    terminalLosses,
    topologyVariants: topologyCache.size,
    budget,
    timedOut: performance.now() - started > timeoutMs,
    truncated: states.length > budget,
    possibleWin: Boolean(win),
    witness,
    elapsedMs: performance.now() - started,
  };
}

const results = [];
for (const spec of CASES) {
  setSeed(spec.seed);
  const map = API.generateMaze(spec.mode, spec.route);
  const ctx = buildContext(map, spec.mode);
  const secondChance = exactSecondChance(ctx);
  const fullRuntime = fullRuntimePossible(ctx);
  results.push({
    ...spec,
    initial: {
      explorer: keyOf(map.playerStart),
      hunter: keyOf(map.guardianStart),
      sentinel: keyOf(API.createSentinelState(map, ctx.zone).position),
      portal: keyOf(map.exitPosition),
      chest: keyOf(map.chest),
      lights: map.collectibleStars.map(keyOf),
      traps: map.traps.map(keyOf),
      accesses: ctx.zone.accesses.map(keyOf),
    },
    secondChance,
    fullRuntime,
  });
  console.log(
    `${spec.seed} ${spec.mode}: second=${secondChance.possibleWin} ` +
    `full=${fullRuntime.possibleWin} states=${fullRuntime.states} ` +
    `${fullRuntime.elapsedMs.toFixed(1)}ms`,
  );
}

const output = {
  mission: "ROTA-ADVERSARIAL-SOLVABILITY-03",
  generatedAt: new Date().toISOString(),
  scope: "Exact PRE_CHEST and Second Chance; exact-transition diagnostic search for full Chest runtime",
  fullBudget: FULL_BUDGET,
  fullTimeoutMs: FULL_TIMEOUT_MS,
  results,
};
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "adversarial-solvability.json"), JSON.stringify(output, null, 2));
console.log(results.every((item) => item.fullRuntime.possibleWin)
  ? "ACTUAL_RUNTIME_WITNESSES_FOUND"
  : "ACTUAL_RUNTIME_WITNESS_SEARCH_INCOMPLETE");
