/** Replay ROTA-ADVERSARIAL-SOLVABILITY-03 witnesses through the real hook. */
import fs from "node:fs";
import path from "node:path";

import { loadRouteRuntime, cellKey } from "./route-runtime-harness.mjs";

const OUT = path.resolve(
  process.env.ROUTE_VALIDATION_OUT ?? "docs/archive/route-adversarial-solvability-03",
);
const SOURCE = path.join(OUT, "adversarial-solvability.json");
const source = JSON.parse(fs.readFileSync(SOURCE, "utf8"));
const runtime = loadRouteRuntime({ directDifficulty: true });
const SEEDED_RANDOM = runtime.LAB.sb.Math.random;
const VALUES = [0.01, 0.24, 0.49, 0.74, 0.76, 0.99];
const DELTAS = {
  UP: { row: -1, col: 0 },
  DOWN: { row: 1, col: 0 },
  LEFT: { row: 0, col: -1 },
  RIGHT: { row: 0, col: 1 },
};

const same = (a, b) => a.row === b.row && a.col === b.col;
const toCell = (key) => {
  const [row, col] = key.split(",").map(Number);
  return { row, col };
};

function sequences(length, prefix = [], output = []) {
  if (prefix.length === length) {
    output.push(prefix);
    return output;
  }
  for (const value of VALUES) sequences(length, [...prefix, value], output);
  return output;
}
const CANDIDATE_SEQUENCES = [
  [],
  ...sequences(1),
  ...sequences(2),
  ...sequences(3),
];

function maskFor(cells, active) {
  let mask = 0;
  cells.forEach((cell, index) => {
    if (active.has(cellKey(cell))) mask |= 1 << index;
  });
  return mask;
}

function rewardLabel(game) {
  if (!game.chestOpened) return "PRE_CHEST";
  if (game.rewardSelected === "pickaxe") {
    return game.rewardSpent ? "PICKAXE_SPENT" : "PICKAXE_READY";
  }
  if (game.rewardSelected === "second-chance") {
    return game.rewardSpent ? "SECOND_CHANCE_SPENT" : "SECOND_CHANCE_READY";
  }
  return "CHEST_PENDING";
}

function actualSnapshot(game) {
  return {
    explorer: cellKey(game.player),
    hunter: cellKey(game.guardian),
    sentinel: cellKey(game.sentinel),
    sentinelTarget: game.sentinelTarget ? cellKey(game.sentinelTarget) : null,
    commitLeft: game.sentinelCommitLeft,
    lights: maskFor(game.mazeMap.collectibleStars, game.collectedSet),
    traps: maskFor(game.mazeMap.traps, game.triggeredTrapSet),
    reward: rewardLabel(game),
    rewardSpent: game.rewardSpent,
    brokenWall: game.brokenWall,
  };
}

function assertSnapshot(expected, actual, context) {
  const fields = [
    "explorer", "hunter", "sentinel", "sentinelTarget", "commitLeft",
    "lights", "traps", "reward", "rewardSpent", "brokenWall",
  ];
  const mismatches = fields.filter(
    (field) => JSON.stringify(expected[field]) !== JSON.stringify(actual[field]),
  );
  if (mismatches.length > 0) {
    throw new Error(
      `${context}: state mismatch in ${mismatches.join(", ")}\n` +
      `expected=${JSON.stringify(expected)}\nactual=${JSON.stringify(actual)}`,
    );
  }
}

function actionDelta(action) {
  if (!action.startsWith("MOVE_")) return null;
  return DELTAS[action.split("_")[1]];
}

function findHunterRandomSequence({ game, expected, action }) {
  const delta = actionDelta(action);
  const playerPosition = delta
    ? { row: game.player.row + delta.row, col: game.player.col + delta.col }
    : game.player;
  const walls = new Set(game.walls);
  if (action.startsWith("BREAK_")) walls.delete(action.slice("BREAK_".length));
  const armed = new Set(game.triggeredTrapSet);
  const trap = game.mazeMap.traps.find((cell) => same(cell, playerPosition));
  if (trap) armed.add(cellKey(trap));
  armed.add(cellKey(game.sentinel));
  const expectedHunter = toCell(expected.hunter);

  for (const sequence of CANDIDATE_SEQUENCES) {
    let calls = 0;
    runtime.LAB.sb.Math.random = () => {
      const value = sequence[Math.min(calls, Math.max(0, sequence.length - 1))] ?? 0.5;
      calls += 1;
      return value;
    };
    const hunter = runtime.API.chooseGuardianMove(
      game.guardian,
      playerPosition,
      game.mazeMap.exitPosition,
      walls,
      game.difficulty,
      armed,
    );
    if (same(hunter, expectedHunter) && calls <= sequence.length) {
      return sequence.slice(0, calls);
    }
    if (same(hunter, expectedHunter) && calls === 0) return [];
  }
  throw new Error(
    `${action}: no positive-probability RNG sequence found for Hunter ` +
    `${cellKey(game.guardian)} -> ${expected.hunter}`,
  );
}

function hasDefenderPhase(step) {
  return step.state !== "WIN" &&
    step.event !== "SECOND_CHANCE_EXPLORER";
}

function executeStep(run, step, randomSequence) {
  let cursor = 0;
  runtime.LAB.sb.Math.random = () => {
    if (cursor >= randomSequence.length) {
      throw new Error(`${step.action}: runtime consumed unexpected Math.random call ${cursor + 1}`);
    }
    return randomSequence[cursor++];
  };

  if (step.action.startsWith("MOVE_")) {
    const delta = actionDelta(step.action);
    run.move(delta);
    if (step.action.endsWith("_CHOOSE_PICKAXE")) run.choose("pickaxe");
    if (step.action.endsWith("_CHOOSE_SECOND_CHANCE")) run.choose("second-chance");
  } else if (step.action.startsWith("BREAK_")) {
    run.break(toCell(step.action.slice("BREAK_".length)));
  } else {
    throw new Error(`Unknown witness action: ${step.action}`);
  }
  if (cursor !== randomSequence.length) {
    throw new Error(
      `${step.action}: expected ${randomSequence.length} Math.random calls, observed ${cursor}`,
    );
  }
  return cursor;
}

function replay(item) {
  runtime.LAB.sb.Math.random = SEEDED_RANDOM;
  const run = runtime.mount({
    seed: item.seed,
    difficulty: item.mode,
    routeNumber: item.route,
  });
  const expectedInitial = item.initial;
  const actualInitial = {
    explorer: cellKey(run.state.player),
    hunter: cellKey(run.state.guardian),
    sentinel: cellKey(run.state.sentinel),
    portal: cellKey(run.state.mazeMap.exitPosition),
    chest: cellKey(run.state.chestPosition),
    lights: run.state.mazeMap.collectibleStars.map(cellKey),
    traps: run.state.mazeMap.traps.map(cellKey),
    accesses: run.state.portalDefenceZone.accesses.map(cellKey),
  };
  if (JSON.stringify(expectedInitial) !== JSON.stringify(actualInitial)) {
    throw new Error(
      `${item.seed}: direct hook map differs from solver map\n` +
      `expected=${JSON.stringify(expectedInitial)}\nactual=${JSON.stringify(actualInitial)}`,
    );
  }

  const trace = [];
  let randomCalls = 0;
  for (let index = 0; index < item.fullRuntime.witness.length; index += 1) {
    const step = item.fullRuntime.witness[index];
    const before = actualSnapshot(run.state);
    const randomSequence = hasDefenderPhase(step)
      ? findHunterRandomSequence({ game: run.state, expected: step.state, action: step.action })
      : [];
    randomCalls += executeStep(run, step, randomSequence);
    if (step.state === "WIN") {
      if (run.state.status !== "won") {
        throw new Error(`${item.seed} step ${index + 1}: witness terminal did not win`);
      }
    } else {
      assertSnapshot(step.state, actualSnapshot(run.state), `${item.seed} step ${index + 1}`);
      if (!run.state.dynamicSolvability.valid) {
        throw new Error(
          `${item.seed} step ${index + 1}: invalid runtime state ` +
          run.state.dynamicSolvability.issues.join(","),
        );
      }
    }
    trace.push({
      step: index + 1,
      action: step.action,
      event: step.event,
      randomSequence,
      before,
      after: step.state === "WIN" ? "WIN" : actualSnapshot(run.state),
      status: run.state.status,
    });
  }
  return {
    seed: item.seed,
    route: item.route,
    mode: item.mode,
    mapMatched: true,
    actions: trace.length,
    randomCalls,
    finalStatus: run.state.status,
    completionRecorded: run.completions.length === 1,
    dynamicStateValidThroughout: true,
    trace,
  };
}

const replays = source.results.map(replay);
const gateMet = replays.every(
  (item) => item.mapMatched && item.finalStatus === "won" &&
    item.completionRecorded && item.dynamicStateValidThroughout,
);
const output = {
  mission: "ROTA-ADVERSARIAL-SOLVABILITY-03",
  generatedAt: new Date().toISOString(),
  source: path.relative(process.cwd(), SOURCE),
  regime: "direct validation map replay through production useEscapeMaze",
  replays,
  gateMet,
};
fs.writeFileSync(path.join(OUT, "actual-runtime-replay.json"), JSON.stringify(output, null, 2));
console.log(JSON.stringify(replays.map((item) => ({
  seed: item.seed,
  actions: item.actions,
  randomCalls: item.randomCalls,
  finalStatus: item.finalStatus,
  mapMatched: item.mapMatched,
})), null, 2));
console.log(gateMet ? "ACTUAL_RUNTIME_REPLAY_OK" : "ACTUAL_RUNTIME_REPLAY_FAILED");
if (!gateMet) process.exitCode = 1;
