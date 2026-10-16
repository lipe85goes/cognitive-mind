/**
 * ROTA2-DYNAMIC-TRAPS-01 — the first dynamic-topology mechanic, asserted.
 *
 * A trap may be linked, by the generator, to one closed wall. Arming it (the
 * Explorer's step) opens that wall for the rest of the Route: the step commits,
 * the trap arms, the maze changes, and only then do the Hunter and the Sentinel
 * answer — on the changed maze. The relationship is telegraphed on the board
 * (a shared lavender rune) before anything happens.
 *
 * Everything here drives production: the REAL `useEscapeMaze` through the
 * runtime harness (route-runtime-harness.mjs, one tree: the working tree or a
 * `--rev`), the real generator, invariants, reducer and events through the
 * module graph, the real `RouteBabylonBoard` mapping and the real Babylon scene
 * on `@babylonjs/core`'s NullEngine. Instrumentation is read-only: a recorder
 * line at the top of `routeStateActionsForEvent` (every domain event, in
 * order) and of the two defender policies (the walls and blocked cells each
 * decision was given).
 *
 * Checks are tagged:
 *   [rota2]      the new contract — must FAIL on the v1 base (`--rev`);
 *   [preserved]  a v1 contract the mechanic must not disturb — must PASS on
 *                the base and on the working tree alike.
 *
 * Usage:
 *   node tools/validation/rota2-dynamic-traps-tests.mjs              # T01–T28 (check evidence)
 *   node tools/validation/rota2-dynamic-traps-tests.mjs --update     # rewrite the evidence
 *   node tools/validation/rota2-dynamic-traps-tests.mjs --rev=9f8ebb5   # counterfactual: every
 *       [rota2] check must fail and every [preserved] check must hold. Writes nothing.
 *   node tools/validation/rota2-dynamic-traps-tests.mjs --mutants    # each mutant must be
 *       caught by at least one of the checks it targets. Writes nothing.
 *
 * Exit: 0 pass · 1 a check (or counterfactual/mutant expectation) failed ·
 *       2 evidence diverged · 3 usage.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import * as BABYLON from "@babylonjs/core";

import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED, openEvidence } from "./evidence.mjs";
import { cellKey, loadRouteRuntime, pathBetween, playToEnd, sameCell, walkableNeighbours } from "./route-runtime-harness.mjs";
import { openSourceTree } from "./route-module-loader.mjs";
import { createCanvasDouble, loadSceneModule } from "./babylon-lifecycle-harness.mjs";
import { independentLinkOffences } from "./rota2-link-oracle.mjs";

export const ROTA2_BASE = "9f8ebb5d8c0c747e68d8719e523ecab3ecbdab00";
const ROTA = "src/games/escape-maze/";
const FILES = {
  hook: `${ROTA}useEscapeMaze.ts`,
  events: `${ROTA}route-events.ts`,
  state: `${ROTA}route-state.ts`,
  defenders: `${ROTA}route-defenders.ts`,
  generation: `${ROTA}route-generation.ts`,
  geometry: `${ROTA}route-geometry.ts`,
  invariants: `${ROTA}route-invariants.ts`,
  protocol: `${ROTA}route-generation-worker-protocol.ts`,
  runner: `${ROTA}route-generation-runner.ts`,
  worker: `${ROTA}route-generation.worker.ts`,
  board: `${ROTA}RouteBabylonBoard.tsx`,
  game: `${ROTA}RouteStrategyGame.tsx`,
  scene: `${ROTA}routeBabylonScene.ts`,
  continuation: `${ROTA}continuation.ts`,
};

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
const MUTANTS = args.includes("--mutants");
const known = new Set([revArg, "--mutants", "--check", "--update"].filter(Boolean));
if (args.some((arg) => !known.has(arg)) || REV === "" || (REV && MUTANTS)) {
  console.error("usage: node tools/validation/rota2-dynamic-traps-tests.mjs [--check|--update] [--rev=<commit> | --mutants]");
  process.exit(EXIT_USAGE);
}

BABYLON.Logger.LogLevels = BABYLON.Logger.ErrorLogLevel;

// =================================================================================================
// instrumentation — read-only recorder lines, the same anchors on the base and today
// =================================================================================================

const shapeChanged = (what) => new Error(`rota2-dynamic-traps-tests: anchor not found (${what})`);
function insertAfter(source, anchor, line, what) {
  if (source.split(anchor).length !== 2) throw shapeChanged(what);
  return source.replace(anchor, `${anchor}${line}`);
}
const INSTRUMENT = {
  [FILES.events]: (source) =>
    insertAfter(
      source,
      "): RouteStateAction[] {\n",
      "  (globalThis as any).__rota2?.events.push(event);\n",
      "routeStateActionsForEvent",
    ),
  [FILES.defenders]: (source) => {
    let out = insertAfter(
      source,
      "  blockedForDefenders: Set<string> = EMPTY_BLOCKED,\n): GridPosition {\n",
      "  (globalThis as any).__rota2?.hunter.push({ walls, blocked: blockedForDefenders });\n",
      "chooseGuardianMove",
    );
    out = insertAfter(
      out,
      "  blockedForDefenders: Set<string> = EMPTY_BLOCKED,\n): SentinelState {\n",
      "  (globalThis as any).__rota2?.sentinel.push({ walls, zone, blocked: blockedForDefenders });\n",
      "decideSentinelMove",
    );
    return out;
  },
};

// =================================================================================================
// small helpers
// =================================================================================================

const DIFFICULTIES = ["easy", "medium", "hard"];
const ROUTES = [1, 2, 3];
const keyToCell = (key) => {
  const [row, col] = key.split(",").map(Number);
  return { row, col };
};
const manhattan = (a, b) => Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
const sortedKeys = (set) => [...set].sort();
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const symmetricDifference = (a, b) => [...[...a].filter((k) => !b.has(k)), ...[...b].filter((k) => !a.has(k))].sort();

function readFromRev(rev, file) {
  if (!rev) return fs.readFileSync(path.resolve(file), "utf8").replace(/\r\n/g, "\n");
  return execFileSync("git", ["show", `${rev}:${file}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).replace(/\r\n/g, "\n");
}

/** What a render of the hook says about the board, compared across trees. */
function observe(g) {
  return {
    status: g.status,
    message: g.message,
    turns: g.turns,
    errors: g.errors,
    blockedMoves: g.blockedMoves,
    player: cellKey(g.player),
    guardian: cellKey(g.guardian),
    sentinel: cellKey(g.sentinel),
    collected: [...g.collectedSet],
    triggered: [...g.triggeredTrapSet],
    walls: sortedKeys(g.walls),
    brokenWall: g.brokenWall,
    chestOpened: g.chestOpened,
    rewardSelected: g.rewardSelected,
    rewardSpent: g.rewardSpent,
  };
}

// =================================================================================================
// the suite — one call is one tree (plus optional mutant transforms)
// =================================================================================================

async function runSuite({ rev = null, transforms = [], sceneTransform = null, boardTransform = null, fixturesHint = null, quiet = false } = {}) {
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

  const RT = loadRouteRuntime({ directDifficulty: true, rev, transforms: [INSTRUMENT, transforms] });
  const { API, LAB } = RT;
  const graph = LAB.graph;
  const sb = LAB.sb;
  const tryRequire = (file) => {
    try {
      return graph.require(file);
    } catch {
      return {};
    }
  };
  const internals = (names) => {
    try {
      return graph.internals(names);
    } catch {
      return {};
    }
  };
  const resetTrace = () => {
    sb.__rota2 = { events: [], hunter: [], sentinel: [] };
    return sb.__rota2;
  };
  resetTrace();
  const generate = (seed, difficulty, route) => {
    LAB.setSeed(seed);
    return API.generateMaze(difficulty, route);
  };
  const linkOf = (map) => (map.trapLinks ?? [])[0] ?? null;

  // --- the careful Explorer: walks around the defenders' reach, never onto what it was told to avoid ----
  const avoidSetFor = (g, target, extra = []) => {
    const avoid = new Set(extra);
    const map = g.mazeMap;
    if (map.chest && !g.chestOpened) avoid.add(cellKey(map.chest));
    // margin < 0: the least careful Explorer — lights and other traps are fair ground.
    if (margin >= 0) {
      for (const trap of map.traps) avoid.add(cellKey(trap));
      for (const star of map.collectibleStars) if (!g.collectedSet.has(cellKey(star))) avoid.add(cellKey(star));
    }
    avoid.add(cellKey(map.exitPosition));
    avoid.delete(cellKey(target));
    return avoid;
  };
  let margin = 1; // how far around the defenders the Explorer keeps (1: their next step; 2: two steps)
  const reachOf = (from, walls) => {
    const out = [from];
    let frontier = [from];
    for (let depth = 0; depth < margin; depth += 1) {
      frontier = frontier.flatMap((cell) => walkableNeighbours(cell, walls));
      out.push(...frontier);
    }
    return out;
  };
  const stepToward = (run, target, extraAvoid) => {
    const g = run.state;
    const avoid = avoidSetFor(g, target, extraAvoid);
    const reach = margin <= 0 ? [g.guardian, g.sentinel].map(cellKey) : [...reachOf(g.guardian, g.walls), ...reachOf(g.sentinel, g.walls)].map(cellKey);
    const careful = new Set([...g.walls, ...avoid, ...reach]);
    careful.delete(cellKey(g.player));
    careful.delete(cellKey(target));
    let route = pathBetween(g.player, target, careful);
    if (!route) {
      const plain = new Set([...g.walls, ...avoid, cellKey(g.guardian), cellKey(g.sentinel)]);
      plain.delete(cellKey(target));
      route = pathBetween(g.player, target, plain);
    }
    if (!route || route.length < 2) return false;
    run.stepTo(route[1]);
    return true;
  };
  const walkCarefully = (run, target, extraAvoid = [], budget = 60, onStep = null) => {
    for (let i = 0; i < budget; i += 1) {
      const g = run.state;
      if (sameCell(g.player, target)) return true;
      if (g.status !== "playing" || g.rewardChoicePending) return false;
      if (!stepToward(run, target, extraAvoid)) return false;
      onStep?.(run.state);
    }
    return sameCell(run.state.player, target);
  };
  /** Walk to the cell next to the trap, then take the trap step on its own (so a test can act between). */
  const walkToBeforeTrap = (run, trapCell, extraAvoid = []) => {
    const g = run.state;
    const around = walkableNeighbours(trapCell, g.walls).filter((cell) => !extraAvoid.includes(cellKey(cell)));
    for (const cell of around.sort((a, b) => manhattan(a, g.player) - manhattan(b, g.player))) {
      if (walkCarefully(run, cell, [cellKey(trapCell), ...extraAvoid])) return true;
      if (run.state.status !== "playing") return false;
    }
    return false;
  };

  /** A fixture remounted is replayed with the caution it was found with, so it walks the same path. */
  const mountFor = ({ seed, difficulty, route, margin: m }) => {
    margin = m ?? 1;
    resetTrace();
    return RT.mount({ seed, difficulty, routeNumber: route });
  };

  // =============================================================================================
  // fixtures — found by search on the tree under test, so a tree without links simply has none
  // =============================================================================================
  const SEARCH = { from: 6100, count: 120 };
  const seedsFor = (kind) => {
    const hinted = fixturesHint?.[kind];
    if (hinted) return [hinted];
    const out = [];
    for (let s = SEARCH.from; s < SEARCH.from + SEARCH.count; s += 1) out.push(s);
    return out;
  };

  /** activation[d-r]: the careful Explorer reaches the linked trap with the Route still on. */
  const activation = {};
  for (const difficulty of DIFFICULTIES) {
    for (const route of ROUTES) {
      const slot = `${difficulty}-${route}`;
      const hint = fixturesHint?.activation?.[slot];
      // The Explorer's caution is part of the fixture: the first that reaches the trap is kept.
      const attempts = hint
        ? [{ seed: hint.seed, margin: hint.margin }]
        : [1, 2, 0, -1].flatMap((m) => seedsFor("none").map((seed) => ({ seed, margin: m })));
      for (const { seed, margin: m } of attempts) {
        const run = mountFor({ seed, difficulty, route, margin: m });
        const link = linkOf(run.state.mazeMap);
        if (!link) break;
        const trap = keyToCell(link.trap);
        if (!walkToBeforeTrap(run, trap)) continue;
        const before = run.state;
        const beforeWalls = new Set(before.walls);
        const trace = resetTrace();
        run.stepTo(trap);
        const after = run.state;
        if (!sameCell(after.player, trap)) continue;
        activation[slot] = { seed, margin: m, difficulty, route, run, link, trap, before: observe(before), beforeWalls, afterWalls: new Set(after.walls), after, trace: { ...trace, events: [...trace.events], hunter: [...trace.hunter], sentinel: [...trace.sentinel] } };
        break;
      }
      margin = 1;
    }
  }
  margin = 1;
  const primary = activation["medium-2"] ?? Object.values(activation)[0] ?? null;

  /** pickaxeFirst: Pickaxe from the Chest opens the linked wall, then the Explorer arms its trap. */
  let pickaxeFirst = null;
  const scenarioSeeds = fixturesHint?.pickaxeFirst ? [fixturesHint.pickaxeFirst] : null;
  outer: for (const difficulty of scenarioSeeds ? [scenarioSeeds[0].difficulty] : DIFFICULTIES) {
    for (const route of scenarioSeeds ? [scenarioSeeds[0].route] : ROUTES) {
      for (const seed of scenarioSeeds ? [scenarioSeeds[0].seed] : seedsFor("none").slice(0, 25)) {
        const run = mountFor({ seed, difficulty, route });
        const link = linkOf(run.state.mazeMap);
        if (!link || !run.state.mazeMap.chest) break;
        const wall = keyToCell(link.mutation.wall);
        const trap = keyToCell(link.trap);
        if (!walkCarefully(run, run.state.mazeMap.chest, [link.trap])) continue;
        if (!run.state.rewardChoicePending) continue;
        run.choose("pickaxe");
        if (run.state.status !== "playing") continue;
        const doors = walkableNeighbours(wall, run.state.walls).filter((c) => cellKey(c) !== link.trap);
        let atDoor = false;
        for (const door of doors) {
          if (walkCarefully(run, door, [link.trap])) {
            atDoor = true;
            break;
          }
          if (run.state.status !== "playing") break;
        }
        if (!atDoor) continue;
        const aimed = run.state.breakTargets.some(({ cell }) => sameCell(cell, wall));
        if (!aimed) continue;
        run.break(wall);
        if (run.state.status !== "playing" || run.state.brokenWall !== link.mutation.wall) continue;
        if (!walkToBeforeTrap(run, trap)) continue;
        const wallsBefore = new Set(run.state.walls);
        const trace = resetTrace();
        run.stepTo(trap);
        if (!sameCell(run.state.player, trap)) continue;
        pickaxeFirst = { seed, difficulty, route, run, link, wallsBefore, after: run.state, events: [...trace.events] };
        break outer;
      }
    }
  }

  /** trapFirst: the trap opens its wall, then the Pickaxe opens another. */
  let trapFirst = null;
  const trapFirstSeeds = fixturesHint?.trapFirst ? [fixturesHint.trapFirst] : null;
  outer2: for (const difficulty of trapFirstSeeds ? [trapFirstSeeds[0].difficulty] : DIFFICULTIES) {
    for (const route of trapFirstSeeds ? [trapFirstSeeds[0].route] : ROUTES) {
      for (const seed of trapFirstSeeds ? [trapFirstSeeds[0].seed] : seedsFor("none").slice(0, 25)) {
        const run = mountFor({ seed, difficulty, route });
        const link = linkOf(run.state.mazeMap);
        if (!link || !run.state.mazeMap.chest) break;
        const trap = keyToCell(link.trap);
        if (!walkToBeforeTrap(run, trap)) continue;
        run.stepTo(trap);
        if (!sameCell(run.state.player, trap) || run.state.status !== "playing") continue;
        if (!walkCarefully(run, run.state.mazeMap.chest)) continue;
        if (!run.state.rewardChoicePending) continue;
        run.choose("pickaxe");
        if (run.state.status !== "playing") continue;
        const targetsSeen = [];
        const watch = (g) => targetsSeen.push(...g.breakTargets.map(({ cell }) => cellKey(cell)));
        watch(run.state);
        // Any wall in reach will do: walk until one is adjacent.
        for (let i = 0; i < 12 && run.state.breakTargets.length === 0 && run.state.status === "playing"; i += 1) {
          const g = run.state;
          const wallNeighbourCells = [];
          for (const w of g.walls) for (const n of walkableNeighbours(keyToCell(w), g.walls)) wallNeighbourCells.push(n);
          wallNeighbourCells.sort((a, b) => manhattan(a, g.player) - manhattan(b, g.player));
          if (!wallNeighbourCells.length || !stepToward(run, wallNeighbourCells[0])) break;
          watch(run.state);
        }
        if (run.state.breakTargets.length === 0 || run.state.status !== "playing") continue;
        const target = run.state.breakTargets[0].cell;
        const trace = resetTrace();
        run.break(target);
        if (run.state.brokenWall !== cellKey(target)) continue;
        trapFirst = { seed, difficulty, route, run, link, targetsSeen, broken: cellKey(target), after: run.state, events: [...trace.events] };
        break outer2;
      }
    }
  }

  /**
   * plainTrap: any trap armed through the hook (the linked one where the tree has links) — the v1 trap
   * contract, searched the same way on every tree. `withSecondChance` takes Second Chance from the Chest first.
   */
  const findPlainTrap = (withSecondChance) => {
    const hint = fixturesHint?.[withSecondChance ? "plainSecondChance" : "plainTrap"];
    const combos = hint ? [hint] : DIFFICULTIES.flatMap((difficulty) => ROUTES.map((route) => ({ difficulty, route })));
    for (const { difficulty, route, seed: hinted } of combos) {
      for (const seed of hinted ? [hinted] : seedsFor("none").slice(0, 20)) {
        const run = mountFor({ seed, difficulty, route });
        const map = run.state.mazeMap;
        const link = linkOf(map);
        const trap = link ? keyToCell(link.trap) : map.traps[0];
        if (!trap) continue;
        let held = null;
        if (withSecondChance) {
          if (!map.chest || !walkCarefully(run, map.chest, [cellKey(trap)]) || !run.state.rewardChoicePending) continue;
          run.choose("second-chance");
          if (run.state.status !== "playing") continue;
          held = { selected: run.state.rewardSelected, spent: run.state.rewardSpent, available: run.state.secondChanceAvailable };
        }
        if (!walkToBeforeTrap(run, trap)) continue;
        const trace = resetTrace();
        run.stepTo(trap);
        if (!sameCell(run.state.player, trap)) continue;
        return { seed, difficulty, route, trap, linked: !!link, held, after: run.state, trace: { events: [...trace.events], hunter: [...trace.hunter], sentinel: [...trace.sentinel] } };
      }
    }
    return null;
  };
  const plainTrap = findPlainTrap(false);
  const plainSecondChance = findPlainTrap(true);

  const fixtureSummary = {
    activation: Object.fromEntries(Object.entries(activation).map(([slot, f]) => [slot, { seed: f.seed, margin: f.margin }])),
    pickaxeFirst: pickaxeFirst && { seed: pickaxeFirst.seed, difficulty: pickaxeFirst.difficulty, route: pickaxeFirst.route },
    trapFirst: trapFirst && { seed: trapFirst.seed, difficulty: trapFirst.difficulty, route: trapFirst.route },
    plainTrap: plainTrap && { seed: plainTrap.seed, difficulty: plainTrap.difficulty, route: plainTrap.route },
    plainSecondChance: plainSecondChance && { seed: plainSecondChance.seed, difficulty: plainSecondChance.difficulty, route: plainSecondChance.route },
  };
  const need = (fixture, what) => {
    if (!fixture) throw new Error(`no ${what} fixture on this tree`);
    return fixture;
  };

  // =============================================================================================
  // T01–T03 · generation
  // =============================================================================================
  const SAMPLE_SEEDS = Array.from({ length: 12 }, (_, i) => 7_300_000 + i * 31);
  const sample = [];
  for (const difficulty of DIFFICULTIES) {
    for (const route of ROUTES) {
      for (const seed of SAMPLE_SEEDS) sample.push({ seed, difficulty, route, map: generate(seed, difficulty, route) });
    }
  }

  await guarded("T01", "rota2", "TRAP_TO_WALL_RELATION_GENERATED_AND_SEEDED", () => {
    const bad = sample.filter(({ map }) => {
      const links = map.trapLinks;
      if (!Array.isArray(links) || links.length !== 1) return true;
      const [link] = links;
      return link.mutation?.kind !== "open-wall" || !map.traps.some((t) => cellKey(t) === link.trap) || typeof link.mutation.wall !== "string";
    });
    return { pass: bad.length === 0, maps: sample.length, withoutExactlyOneOpenWallLink: bad.length, firstBad: bad[0] ? { seed: bad[0].seed, d: bad[0].difficulty, r: bad[0].route, trapLinks: bad[0].map.trapLinks ?? "absent" } : null };
  });

  await guarded("T02", "rota2", "SAME_SEED_SAME_LINKED_WALL", () => {
    const drift = [];
    for (const { seed, difficulty, route, map } of sample.slice(0, 54)) {
      // Later in the run, and twice back to back: nothing about when it is asked may move the link.
      const again = generate(seed, difficulty, route);
      const twice = generate(seed, difficulty, route);
      const same = (m) => sameJson(m.trapLinks, map.trapLinks) && sameJson(sortedKeys(m.walls), sortedKeys(map.walls));
      if (!same(again) || !same(twice)) drift.push({ seed, difficulty, route });
    }
    const links = new Set(sample.map(({ map }) => JSON.stringify(map.trapLinks ?? null)));
    return { pass: drift.length === 0 && sample.every(({ map }) => linkOf(map)) && links.size > 1, regenerated: 54, drift, distinctLinksInSample: links.size };
  });

  await guarded("T03", "rota2", "LINKED_WALL_BEGINS_CLOSED", () => {
    const openAtStart = sample.filter(({ map }) => !linkOf(map) || !map.walls.has(linkOf(map).mutation.wall));
    const f = need(primary, "activation");
    const mounted = f.beforeWalls.has(f.link.mutation.wall);
    return { pass: openAtStart.length === 0 && mounted, maps: sample.length, linkedWallNotStanding: openAtStart.length, standingInTheHookUntilTheStep: mounted };
  });

  // =============================================================================================
  // T04–T06 · activation
  // =============================================================================================
  await guarded("T04", "rota2", "ACTIVATION_OPENS_EXACTLY_THAT_WALL", () => {
    const rows = Object.values(activation).map((f) => {
      const diff = symmetricDifference(f.beforeWalls, f.afterWalls);
      return { slot: `${f.difficulty}-${f.route}`, seed: f.seed, linked: f.link.mutation.wall, diff, trapOpenedWalls: f.after.trapOpenedWalls ?? null };
    });
    const pass = rows.length > 0 && rows.every((r) => sameJson(r.diff, [r.linked]) && sameJson(r.trapOpenedWalls, [r.linked]));
    return { pass, activations: rows.length, rows: rows.slice(0, 3) };
  });

  await guarded("T05", "rota2", "UNRELATED_WALLS_UNCHANGED", () => {
    const rows = Object.values(activation).map((f) => {
      const map = f.after.mazeMap;
      const expected = new Set(map.walls);
      expected.delete(f.link.mutation.wall);
      // The certified board itself is never written to: regenerating the seed gives the same walls it holds.
      const regenerated = generate(f.seed, f.difficulty, f.route);
      return {
        slot: `${f.difficulty}-${f.route}`,
        sameAsCertifiedMinusLinked: sameJson(sortedKeys(f.afterWalls), sortedKeys(expected)),
        certifiedWallsUntouched: map.walls.has(f.link.mutation.wall) && sameJson(sortedKeys(map.walls), sortedKeys(regenerated.walls)),
      };
    });
    return { pass: rows.length > 0 && rows.every((r) => r.sameAsCertifiedMinusLinked && r.certifiedWallsUntouched), rows: rows.slice(0, 3) };
  });

  await guarded("T06", "rota2", "RUNTIME_MOVEMENT_SEES_THE_OPENED_PASSAGE", () => {
    const f = need(primary, "activation");
    const wall = keyToCell(f.link.mutation.wall);
    // Fresh session, same seed: from a cell beside the wall, stepping into it is blocked before activation.
    const closed = mountFor(f);
    const door = walkableNeighbours(wall, closed.state.walls).find((c) => cellKey(c) !== f.link.trap);
    let blockedBefore = null;
    if (door && walkCarefully(closed, door, [f.link.trap])) {
      const turns = closed.state.turns;
      closed.stepTo(wall);
      blockedBefore = sameCell(closed.state.player, door) && closed.state.turns === turns && closed.state.blockedMoves > 0;
    }
    // In the activated session: walk into the opened cell.
    const run = f.run;
    let entered = false;
    if (run.state.status === "playing") {
      entered = walkCarefully(run, wall, [], 40);
    }
    return { pass: blockedBefore === true && entered, wall: f.link.mutation.wall, blockedBeforeActivation: blockedBefore, enteredAfterActivation: entered, slot: `${f.difficulty}-${f.route}`, seed: f.seed };
  });

  // =============================================================================================
  // T07–T08 · defenders read the current maze — in the activation turn and after
  // =============================================================================================
  await guarded("T07", "rota2", "HUNTER_SEES_CURRENT_TOPOLOGY", () => {
    const rows = Object.values(activation).map((f) => {
      const calls = f.trace.hunter;
      return { slot: `${f.difficulty}-${f.route}`, calls: calls.length, everyCallOpen: calls.length > 0 && calls.every((c) => !c.walls.has(f.link.mutation.wall)) };
    });
    // Later turns too: keep walking and require every Hunter decision to have the wall open.
    const f = need(primary, "activation");
    const run = mountFor(f);
    walkToBeforeTrap(run, f.trap);
    const trace = resetTrace();
    run.stepTo(f.trap);
    // A few careful steps more, through the opened passage and back toward the start.
    walkCarefully(run, keyToCell(f.link.mutation.wall), [], 4);
    walkCarefully(run, run.state.mazeMap.playerStart, [], 4);
    const later = trace.hunter.length > 1 && trace.hunter.every((c) => !c.walls.has(f.link.mutation.wall));
    return { pass: rows.length > 0 && rows.every((r) => r.everyCallOpen) && later, activationTurns: rows.slice(0, 3), laterDecisions: trace.hunter.length, laterAllOpen: later };
  });

  await guarded("T08", "rota2", "SENTINEL_SEES_CURRENT_TOPOLOGY", () => {
    const rows = Object.values(activation).map((f) => {
      const calls = f.trace.sentinel;
      return { slot: `${f.difficulty}-${f.route}`, calls: calls.length, everyCallOpen: calls.length > 0 && calls.every((c) => !c.walls.has(f.link.mutation.wall)) };
    });
    const zoneSame = Object.values(activation).every((f) => {
      const call = f.trace.sentinel[0];
      if (!call) return false;
      const fresh = API.computePortalDefenceZone(f.after.mazeMap.playerStart, f.after.mazeMap.exitPosition, f.afterWalls);
      return sameJson(call.zone.accesses.map(cellKey), fresh.accesses.map(cellKey)) && sameJson(call.zone.zone.map(cellKey), fresh.zone.map(cellKey));
    });
    return { pass: rows.length > 0 && rows.every((r) => r.everyCallOpen) && zoneSame, activationTurns: rows.slice(0, 3), zoneComputedOnTheOpenedMaze: zoneSame };
  });

  // =============================================================================================
  // T09 · the board receives the current topology (real RouteBabylonBoard mapping → real scene)
  // =============================================================================================
  const boardModule = loadBoardComponent(rev, boardTransform);
  const sceneModule = loadSceneModule({ quiet: true, transformSource: sceneTransform ?? (rev ? () => readFromRev(rev, FILES.scene) : undefined) });
  const boardStateOf = (g) => renderBoardState(boardModule, g);

  await guarded("T09", "rota2", "RENDERER_RECEIVES_CURRENT_TOPOLOGY", async () => {
    const f = need(primary, "activation");
    const wall = f.link.mutation.wall;
    const fresh = mountFor(f);
    const beforeBoard = boardStateOf(fresh.state);
    const afterBoard = boardStateOf(f.after);
    const scene = await mountScene(sceneModule, beforeBoard.state);
    const before = sceneCensus(scene);
    scene.update(afterBoard.state);
    const after = sceneCensus(scene);
    scene.dispose();
    const facts = {
      boardWallsBefore: beforeBoard.state.walls.includes(wall),
      boardWallsAfter: afterBoard.state.walls.includes(wall),
      canvasWallCellsAfter: afterBoard.canvas["data-wall-cells"].split(" ").includes(wall),
      canvasOpenedAfter: (afterBoard.canvas["data-trap-opened-wall-cells"] ?? "").split(" ").includes(wall),
      wallMeshBefore: before.wallsAt.has(wall),
      wallMeshAfter: after.wallsAt.has(wall),
      openedRuneAfter: after.namedAt("route-passage-opened-rune").has(wall),
      wallRuneBefore: before.namedAt("route-passage-wall-rune").has(wall),
      trapRuneBefore: before.namedAt("route-passage-trap-rune").has(f.link.trap),
      duplicateWallMeshes: after.duplicateWalls,
    };
    const pass =
      facts.boardWallsBefore && !facts.boardWallsAfter && !facts.canvasWallCellsAfter && facts.canvasOpenedAfter &&
      facts.wallMeshBefore && !facts.wallMeshAfter && facts.openedRuneAfter && facts.wallRuneBefore && facts.trapRuneBefore &&
      facts.duplicateWallMeshes.length === 0;
    return { pass, wall, ...facts };
  });

  // =============================================================================================
  // T10 · an armed trap still blocks both defenders (v1)
  // =============================================================================================
  await guarded("T10", "preserved", "TRAP_STILL_BLOCKS_DEFENDERS", () => {
    // Behaviour, on whichever trap the tree arms first: every defender decision after arming carries it as blocked.
    const rows = [];
    for (const f of Object.values(activation)) {
      const blockedHunter = f.trace.hunter.every((c) => c.blocked.has(cellKey(f.trap)));
      const blockedSentinel = f.trace.sentinel.every((c) => c.blocked.has(cellKey(f.trap)));
      rows.push({ slot: `${f.difficulty}-${f.route}`, blockedHunter, blockedSentinel });
    }
    // Pure policy, linked or not: from a cell beside an armed trap, the Hunter never enters it.
    let entered = 0;
    let decisions = 0;
    for (const { map, difficulty } of sample.slice(0, 27)) {
      for (const trap of map.traps) {
        const from = API.getNeighbors(trap, map.walls)[0];
        if (!from) continue;
        for (let k = 0; k < 6; k += 1) {
          LAB.setSeed(9_400_000 + k);
          const next = API.chooseGuardianMove(from, trap, map.exitPosition, map.walls, difficulty, new Set([cellKey(trap)]));
          decisions += 1;
          if (sameCell(next, trap)) entered += 1;
        }
      }
    }
    // The same trap step on every tree: the defenders' answer that very turn carries the armed trap as blocked.
    const plain = need(plainTrap, "trap");
    const plainRow = {
      slot: `plain ${plain.difficulty}-${plain.route}@${plain.seed}`,
      blockedHunter: plain.trace.hunter.length > 0 && plain.trace.hunter.every((c) => c.blocked.has(cellKey(plain.trap))),
      blockedSentinel: plain.trace.sentinel.length > 0 && plain.trace.sentinel.every((c) => c.blocked.has(cellKey(plain.trap))),
    };
    const all = [plainRow, ...rows];
    return { pass: entered === 0 && decisions > 0 && all.every((r) => r.blockedHunter && r.blockedSentinel), policyDecisions: decisions, hunterEnteredArmedTrap: entered, runtime: all.slice(0, 4) };
  });

  // =============================================================================================
  // T11–T12 · the Pickaxe and the trap, in both orders
  // =============================================================================================
  await guarded("T11", "rota2", "PICKAXE_BEFORE_TRAP_IS_AN_IDEMPOTENT_NO_OP", () => {
    const f = need(pickaxeFirst, "pickaxe-before-trap");
    const wallsAfter = new Set(f.after.walls);
    const types = f.events.map((e) => e.type);
    const facts = {
      trapArmed: types.includes("TRAP_ARMED"),
      noTopologyEvent: !types.includes("WALL_OPENED_BY_TRAP") && !types.includes("WALL_OPENED"),
      wallsUnchangedByTheStep: sameJson(sortedKeys(wallsAfter), sortedKeys(f.wallsBefore)),
      trapOpenedWalls: f.after.trapOpenedWalls,
      brokenWall: f.after.brokenWall,
      pickaxeStillOneUse: f.after.rewardSpent === true && f.after.pickaxeAvailable === false,
      message: f.after.message,
      invariant: f.after.dynamicSolvability.issues,
    };
    const pass = facts.trapArmed && facts.noTopologyEvent && facts.wallsUnchangedByTheStep && sameJson(facts.trapOpenedWalls, []) &&
      facts.brokenWall === f.link.mutation.wall && facts.pickaxeStillOneUse && f.after.dynamicSolvability.valid && /já estava aberta/.test(f.after.message);
    return { pass, seed: f.seed, slot: `${f.difficulty}-${f.route}`, linked: f.link.mutation.wall, ...facts };
  });

  await guarded("T12", "rota2", "TRAP_BEFORE_PICKAXE_WORKS", () => {
    const f = need(trapFirst, "trap-before-pickaxe");
    const wall = f.link.mutation.wall;
    const facts = {
      linkedWallNeverAPickaxeTarget: !f.targetsSeen.includes(wall),
      broken: f.broken,
      brokenIsAnotherWall: f.broken !== wall,
      trapOpenedWalls: f.after.trapOpenedWalls,
      bothOpen: !f.after.walls.has(wall) && !f.after.walls.has(f.broken),
      pickaxeEvent: f.events.filter((e) => e.type === "WALL_OPENED").map((e) => e.wall),
      invariant: f.after.dynamicSolvability.issues,
    };
    const pass = facts.linkedWallNeverAPickaxeTarget && facts.brokenIsAnotherWall && sameJson(facts.trapOpenedWalls, [wall]) && facts.bothOpen && sameJson(facts.pickaxeEvent, [f.broken]) && f.after.dynamicSolvability.valid;
    return { pass, seed: f.seed, slot: `${f.difficulty}-${f.route}`, linked: wall, ...facts };
  });

  // =============================================================================================
  // T13 · Second Chance unchanged
  // =============================================================================================
  await guarded("T13", "preserved", "SECOND_CHANCE_UNCHANGED_BY_TOPOLOGY", () => {
    // Second Chance held across the trap step (the linked trap where the tree has links): only a capture spends it,
    // and a capture says so (SECOND_CHANCE_USED). Same search on every tree.
    const f = need(plainSecondChance, "Second Chance + trap");
    const types = f.trace.events.map((e) => e.type);
    const captured = types.includes("SECOND_CHANCE_USED");
    const linkedOpened = f.linked ? !f.after.walls.has(linkOf(f.after.mazeMap).mutation.wall) : null;
    const facts = {
      slot: `${f.difficulty}-${f.route}`,
      seed: f.seed,
      linkedTrap: f.linked,
      heldBefore: f.held,
      captured,
      rewardSpent: f.after.rewardSpent,
      stillHeld: f.after.secondChanceAvailable,
      rewardSelected: f.after.rewardSelected,
      linkedWallOpened: linkedOpened,
    };
    const pass = f.held?.available === true && f.after.rewardSelected === "second-chance" &&
      (captured ? f.after.rewardSpent === true : f.after.rewardSpent === false && f.after.secondChanceAvailable === true) &&
      linkedOpened !== false;
    return { pass, ...facts };
  });

  // =============================================================================================
  // T14–T16 · nothing of a mutation survives the session that made it
  // =============================================================================================
  await guarded("T14", "rota2", "RESTART_RESTORES_ORIGINAL_TOPOLOGY", async () => {
    const f = need(primary, "activation");
    const random = LAB.routeRandom;
    random.armRouteRandomSeed(f.seed);
    try {
      const run = mountFor(f);
      const original = { links: run.state.trapLinks ?? run.state.mazeMap.trapLinks, walls: sortedKeys(run.state.walls), map: JSON.stringify({ ...run.state.mazeMap, walls: sortedKeys(run.state.mazeMap.walls) }) };
      const link = linkOf(run.state.mazeMap);
      if (!link) return { pass: false, reason: "no link" };
      const trap = keyToCell(link.trap);
      if (!walkToBeforeTrap(run, trap)) return { pass: false, reason: "armed-seed walk failed" };
      run.stepTo(trap);
      const opened = !run.state.walls.has(link.mutation.wall);
      const openedBoard = boardStateOf(run.state);
      run.restart();
      const g = run.state;
      const facts = {
        openedBeforeRestart: opened,
        sameBoardAgain: JSON.stringify({ ...g.mazeMap, walls: sortedKeys(g.mazeMap.walls) }) === original.map,
        linkedWallClosedAgain: g.walls.has(link.mutation.wall),
        wallsAreTheCertifiedOnes: g.walls === g.mazeMap.walls && sameJson(sortedKeys(g.walls), original.walls),
        trapOpenedWalls: g.trapOpenedWalls,
        dormantTraps: [...g.triggeredTrapSet],
        linksRestored: sameJson(g.trapLinks, original.links),
      };
      // The board follows: the opened passage's mark and pulse go, the wall and its rune come back, nothing doubles.
      const restartedBoard = boardStateOf(g);
      const scene = await mountScene(sceneModule, openedBoard.state);
      const meshesOpened = sceneCensus(scene);
      scene.update(restartedBoard.state);
      const meshesRestarted = sceneCensus(scene);
      const freshScene = await mountScene(sceneModule, restartedBoard.state);
      const meshesFresh = sceneCensus(freshScene);
      scene.dispose();
      freshScene.dispose();
      facts.sceneWallBack = meshesRestarted.wallsAt.has(link.mutation.wall) && !meshesOpened.wallsAt.has(link.mutation.wall);
      facts.sceneOpenedMarkGone = meshesRestarted.namedAt("route-passage-opened-rune").size === 0;
      facts.sceneEqualsAFreshMount = sameJson(meshesRestarted.signature, meshesFresh.signature);
      const pass = facts.openedBeforeRestart && facts.sameBoardAgain && facts.linkedWallClosedAgain && facts.wallsAreTheCertifiedOnes &&
        sameJson(facts.trapOpenedWalls, []) && facts.dormantTraps.length === 0 && facts.linksRestored &&
        facts.sceneWallBack && facts.sceneOpenedMarkGone && facts.sceneEqualsAFreshMount;
      return { pass, seed: f.seed, ...facts };
    } finally {
      random.clearRouteRandomSeed();
    }
  });

  await guarded("T15", "rota2", "NEXT_ROUTE_DOES_NOT_INHERIT_THE_MUTATION", () => {
    const f = need(activation["easy-1"] ?? primary, "activation");
    const run = mountFor(f);
    const link = linkOf(run.state.mazeMap);
    walkToBeforeTrap(run, keyToCell(link.trap));
    run.stepTo(keyToCell(link.trap));
    const openedHere = !run.state.walls.has(link.mutation.wall);
    if (run.state.status === "playing") playToEnd(run, "lose");
    const next = run.nextSession({ seed: f.seed + 1 });
    const g = next.state;
    const facts = {
      openedOnTheFirstRoute: openedHere,
      firstRouteEnded: run.state.status,
      nextRoute: g.routeNumber,
      nextTrapOpenedWalls: g.trapOpenedWalls,
      nextWallsAreItsCertifiedWalls: g.walls === g.mazeMap.walls,
      nextLinkIsItsOwn: !!linkOf(g.mazeMap) && g.mazeMap.walls.has(linkOf(g.mazeMap).mutation.wall),
      previousOpenedWallStandsIfItIsAWallHere: !g.mazeMap.walls.has(link.mutation.wall) || g.walls.has(link.mutation.wall),
    };
    const pass = openedHere && g.routeNumber === f.route + 1 && sameJson(g.trapOpenedWalls, []) && facts.nextWallsAreItsCertifiedWalls && facts.nextLinkIsItsOwn && facts.previousOpenedWallStandsIfItIsAWallHere;
    return { pass, seed: f.seed, ...facts };
  });

  await guarded("T16", "rota2", "DIFFICULTY_CHANGE_DOES_NOT_INHERIT_THE_MUTATION", () => {
    const f = need(primary, "activation");
    const run = mountFor(f);
    const link = linkOf(run.state.mazeMap);
    walkToBeforeTrap(run, keyToCell(link.trap));
    run.stepTo(keyToCell(link.trap));
    const openedHere = !run.state.walls.has(link.mutation.wall);
    run.changeDifficulty(f.difficulty === "hard" ? "easy" : "hard");
    const inSetup = { status: run.state.status, trapOpenedWalls: run.state.trapOpenedWalls, identity: run.state.walls === run.state.mazeMap.walls };
    run.act((g) => g.startGame());
    const g = run.state;
    const pass = openedHere && inSetup.status === "setup" && sameJson(inSetup.trapOpenedWalls, []) && inSetup.identity &&
      g.status === "playing" && sameJson(g.trapOpenedWalls, []) && g.walls === g.mazeMap.walls && g.triggeredTrapSet.size === 0;
    return { pass, openedHere, inSetup, afterStart: { status: g.status, difficulty: g.difficulty, trapOpenedWalls: g.trapOpenedWalls } };
  });

  // =============================================================================================
  // T17–T18 · no draw chooses the mutation; the trace names its cause
  // =============================================================================================
  await guarded("T17", "rota2", "NO_RUNTIME_RANDOM_CHOOSES_THE_MUTATION", () => {
    const f = need(primary, "activation");
    const opened = [];
    for (const k of [1, 2, 3, 4, 5, 6]) {
      const run = mountFor(f);
      if (!walkToBeforeTrap(run, f.trap)) continue;
      const before = new Set(run.state.walls);
      LAB.setSeed(424_242 * k); // any stream at all, right before the trap step
      run.stepTo(f.trap);
      opened.push(symmetricDifference(before, new Set(run.state.walls)).join("|"));
    }
    // Static: the hook's trap-activation statements make no draw.
    const hook = readFromRev(rev, FILES.hook);
    const start = hook.indexOf("const trapLink = isUntriggeredTrap");
    const end = hook.indexOf("applyDomainEvent({\n        type: \"EXPLORER_STEP_COMMITTED\",\n        turn: nextTurn,\n        to: next,\n        collectedStars: nextCollectedStars,");
    const block = start >= 0 && end > start ? hook.slice(start, end) : null;
    const drawsInBlock = block === null ? null : /routeRandom|randomItem|Math\.random/.test(block);
    const linkInData = !!linkOf(f.after.mazeMap);
    const pass = opened.length === 6 && new Set(opened).size === 1 && opened[0] === f.link.mutation.wall && block !== null && drawsInBlock === false && linkInData;
    return { pass, reseededRuns: opened.length, openedPerRun: [...new Set(opened)], linked: f.link.mutation.wall, activationBlockFound: block !== null, drawsInActivationBlock: drawsInBlock };
  });

  await guarded("T18", "rota2", "TRACE_DISTINGUISHES_TRAP_OPEN_FROM_PICKAXE_OPEN", () => {
    const f = need(primary, "activation");
    const types = f.trace.events.map((e) => e.type);
    const trapEvent = f.trace.events.find((e) => e.type === "WALL_OPENED_BY_TRAP");
    const order = ["EXPLORER_STEP_COMMITTED", "TRAP_ARMED", "WALL_OPENED_BY_TRAP", "DEFENDERS_SETTLED"].map((t) => types.indexOf(t));
    const events = tryRequire(FILES.events);
    const stateModule = tryRequire(FILES.state);
    const translated = events.routeStateActionsForEvent?.({ type: "WALL_OPENED_BY_TRAP", turn: 3, trap: f.link.trap, wall: f.link.mutation.wall }) ?? [];
    const pickaxe = events.routeStateActionsForEvent?.({ type: "WALL_OPENED", turn: 3, wall: "1,1" }) ?? [];
    const before = { ...f.after, brokenWall: null, rewardSpent: false, trapOpenedWalls: [] };
    const applied = translated.reduce((s, a) => stateModule.routeStateReducer(s, a), before);
    const pickaxeInTrace = trapFirst ? trapFirst.events.filter((e) => e.type === "WALL_OPENED") : [];
    const facts = {
      trapEvent: trapEvent ?? null,
      noPickaxeEventOnTheTrapStep: !types.includes("WALL_OPENED"),
      orderStepArmOpenDefenders: order,
      translation: translated.map((a) => a.type),
      pickaxeTranslation: pickaxe.map((a) => a.type),
      appliedKeepsPickaxeFields: applied.brokenWall === null && applied.rewardSpent === false && sameJson(applied.trapOpenedWalls, [f.link.mutation.wall]),
      pickaxeEventsElsewhere: pickaxeInTrace.length,
    };
    const ordered = order.every((i) => i >= 0) && order[0] < order[1] && order[1] < order[2] && order[2] < order[3];
    const pass = !!trapEvent && trapEvent.trap === f.link.trap && trapEvent.wall === f.link.mutation.wall && facts.noPickaxeEventOnTheTrapStep && ordered &&
      sameJson(facts.translation, ["OPEN_WALL_BY_TRAP"]) && sameJson(facts.pickaxeTranslation, ["OPEN_WALL", "COUNT_TURN"]) && facts.appliedKeepsPickaxeFields &&
      (trapFirst === null || pickaxeInTrace.length === 1);
    return { pass, ...facts };
  });

  // =============================================================================================
  // T19–T21 · the invariants and the generator
  // =============================================================================================
  const snapshotOf = (map, overrides = {}) => {
    const zone = API.computePortalDefenceZone(map.playerStart, map.exitPosition, map.walls);
    const sentinel = API.createSentinelState(map, zone);
    return {
      mazeMap: map, player: map.playerStart, guardian: map.guardianStart, sentinel: sentinel.position,
      collectedStars: [], triggeredTraps: [], chestOpened: false, rewardSelected: null, rewardSpent: false,
      brokenWall: null, trapOpenedWalls: [], status: "playing", ...overrides,
    };
  };

  await guarded("T19", "rota2", "INSPECTOR_ACCEPTS_LEGAL_CHANGED_STATES", () => {
    const rejected = [];
    let states = 0;
    for (const { seed, difficulty, route, map } of sample) {
      const link = linkOf(map);
      if (!link) {
        rejected.push({ seed, difficulty, route, reason: "no link" });
        continue;
      }
      const otherWall = [...map.walls].find((w) => w !== link.mutation.wall);
      const cases = [
        snapshotOf(map, { triggeredTraps: [link.trap], trapOpenedWalls: [link.mutation.wall] }),
        // Pickaxe first: the trap then had nothing to open.
        snapshotOf(map, { chestOpened: true, rewardSelected: "pickaxe", rewardSpent: true, brokenWall: link.mutation.wall, triggeredTraps: [link.trap], trapOpenedWalls: [] }),
        // Trap first, then the Pickaxe on another wall.
        snapshotOf(map, { chestOpened: true, rewardSelected: "pickaxe", rewardSpent: true, brokenWall: otherWall, triggeredTraps: [link.trap], trapOpenedWalls: [link.mutation.wall] }),
      ];
      for (const snapshot of cases) {
        states += 1;
        const verdict = API.inspectDynamicMazeState(snapshot);
        const opened = !verdict.effectiveWalls.has(link.mutation.wall);
        if (!verdict.valid || !verdict.solvable || !opened) rejected.push({ seed, difficulty, route, issues: verdict.issues, opened });
      }
    }
    const runtime = Object.values(activation).every((f) => f.after.dynamicSolvability.valid && f.after.dynamicSolvability.solvable);
    return { pass: rejected.length === 0 && runtime && states > 0, states, rejected: rejected.slice(0, 3), runtimeActivationsValid: runtime };
  });

  await guarded("T20", "rota2", "INVALID_MUTATION_STATE_DETECTED", () => {
    const { map } = sample.find(({ map }) => linkOf(map)) ?? sample[0];
    const link = linkOf(map) ?? { trap: cellKey(map.traps[0]), mutation: { kind: "open-wall", wall: [...map.walls][0] } };
    const notLinked = [...map.walls].find((w) => w !== link.mutation.wall);
    const open = [...Array(81).keys()].map((i) => `${Math.floor(i / 9)},${i % 9}`).find((k) => !map.walls.has(k) && !map.traps.some((t) => cellKey(t) === k));
    const otherTrap = map.traps.map(cellKey).find((k) => k !== link.trap);
    const cases = [
      ["armed link, wall still closed", snapshotOf(map, { triggeredTraps: [link.trap] }), "ARMED_TRAP_LINK_WALL_STILL_CLOSED"],
      ["opened without arming", snapshotOf(map, { trapOpenedWalls: [link.mutation.wall] }), "TRAP_OPENED_WALL_WITHOUT_ARMED_LINK"],
      ["opened a wall no link names", snapshotOf(map, { triggeredTraps: [link.trap], trapOpenedWalls: [link.mutation.wall, notLinked] }), "TRAP_OPENED_WALL_WITHOUT_ARMED_LINK"],
      ["opened twice", snapshotOf(map, { triggeredTraps: [link.trap], trapOpenedWalls: [link.mutation.wall, link.mutation.wall] }), "TRAP_OPENED_WALL_TWICE"],
      ["opened a non-wall", snapshotOf(map, { triggeredTraps: [link.trap], trapOpenedWalls: [link.mutation.wall, open] }), "TRAP_OPENED_WALL_NOT_IN_BASE_MAP"],
      ["opened by both", snapshotOf(map, { chestOpened: true, rewardSelected: "pickaxe", rewardSpent: true, brokenWall: link.mutation.wall, triggeredTraps: [link.trap], trapOpenedWalls: [link.mutation.wall] }), "TRAP_OPENED_WALL_ALSO_BROKEN"],
      ["link to a non-wall", snapshotOf({ ...map, trapLinks: [{ trap: link.trap, mutation: { kind: "open-wall", wall: open } }] }), "TRAP_LINK_WALL_NOT_IN_BASE_MAP"],
      ["link from a non-trap", snapshotOf({ ...map, trapLinks: [{ trap: open, mutation: link.mutation }] }), "TRAP_LINK_UNKNOWN_TRAP"],
      ["two links, one wall", snapshotOf({ ...map, trapLinks: [link, { trap: otherTrap, mutation: link.mutation }] }), "TRAP_LINK_DUPLICATE_WALL"],
      ["two links, one trap", snapshotOf({ ...map, trapLinks: [link, { trap: link.trap, mutation: { kind: "open-wall", wall: notLinked } }] }), "TRAP_LINK_DUPLICATE_TRAP"],
      ["a closing mutation", snapshotOf({ ...map, trapLinks: [{ trap: link.trap, mutation: { kind: "close-wall", wall: open } }] }), "TRAP_LINK_UNKNOWN_MUTATION"],
    ];
    const rows = cases.map(([name, snapshot, code]) => {
      const verdict = API.inspectDynamicMazeState(snapshot);
      return { name, code, detected: !verdict.valid && verdict.issues.includes(code) };
    });
    const legal = API.inspectDynamicMazeState(snapshotOf(map));
    return { pass: rows.every((r) => r.detected) && legal.valid, cases: rows.length, missed: rows.filter((r) => !r.detected), untouchedMapValid: legal.valid };
  });

  await guarded("T21", "rota2", "GENERATION_NEVER_LINKS_AN_INVALID_EDGE", () => {
    // An oracle of its own — not production's predicate — over every sampled map.
    const offences = [];
    for (const { seed, difficulty, route, map } of sample) {
      const why = independentLinkOffences(API, map);
      if (why.length) offences.push({ seed, difficulty, route, why });
    }
    // And the final gate refuses what the oracle refuses: corrupt a certified map's link and ask isValidMap.
    const { trapLinksAreLegal } = internals(["trapLinksAreLegal"]);
    let gateRefusals = 0;
    let gateCases = 0;
    if (typeof trapLinksAreLegal === "function") {
      for (const { map } of sample.slice(0, 18)) {
        const link = linkOf(map);
        if (!link) continue;
        const trap = keyToCell(link.trap);
        const adjacentWall = [...map.walls].find((w) => manhattan(keyToCell(w), trap) === 1);
        const portalWall = [...map.walls].find((w) => manhattan(keyToCell(w), map.exitPosition) <= 2);
        const bad = [
          { ...map, trapLinks: [] },
          { ...map, trapLinks: [link, link] },
          { ...map, trapLinks: [{ ...link, mutation: { kind: "open-wall", wall: cellKey(map.playerStart) } }] },
          adjacentWall && { ...map, trapLinks: [{ ...link, mutation: { kind: "open-wall", wall: adjacentWall } }] },
          portalWall && { ...map, trapLinks: [{ ...link, mutation: { kind: "open-wall", wall: portalWall } }] },
        ].filter(Boolean);
        for (const corrupt of bad) {
          gateCases += 1;
          if (!trapLinksAreLegal(corrupt)) gateRefusals += 1;
        }
        if (!trapLinksAreLegal(map)) offences.push({ reason: "gate refuses its own certified link" });
      }
    }
    return { pass: offences.length === 0 && gateCases > 0 && gateRefusals === gateCases, maps: sample.length, offences: offences.slice(0, 3), gateCases, gateRefusals };
  });

  // =============================================================================================
  // T22–T23 · every mode; no new softlock class
  // =============================================================================================
  await guarded("T22", "rota2", "ALL_DIFFICULTIES_RECEIVE_VALID_BEHAVIOUR", () => {
    const slots = DIFFICULTIES.flatMap((d) => ROUTES.map((r) => `${d}-${r}`));
    const rows = slots.map((slot) => {
      const f = activation[slot];
      if (!f) return { slot, found: false };
      return { slot, found: true, seed: f.seed, opened: !f.afterWalls.has(f.link.mutation.wall), valid: f.after.dynamicSolvability.valid };
    });
    const everyMapLinked = sample.every(({ map }) => linkOf(map));
    const bad = rows.filter((r) => !(r.found && r.opened && r.valid));
    return { pass: bad.length === 0 && everyMapLinked, slots: rows.length, activated: rows.filter((r) => r.found).map((r) => `${r.slot}@${r.seed}`), bad, everyMapLinked };
  });

  await guarded("T23", "rota2", "NO_NEW_SOFTLOCK_CLASS", () => {
    // Topological, exhaustive over reachable topology states: the link closed/open × no Pickaxe wall or any wall.
    let topologyStates = 0;
    const softlocks = [];
    for (const { seed, difficulty, route, map } of sample) {
      const link = linkOf(map);
      if (!link) {
        softlocks.push({ seed, reason: "no link" });
        continue;
      }
      for (const linkOpen of [false, true]) {
        // The Pickaxe opens a wall the Explorer stands next to: one beside a cell it can reach on this maze.
        const maze = new Set(map.walls);
        if (linkOpen) maze.delete(link.mutation.wall);
        const reachable = API.getReachableDistances(map.playerStart, maze);
        const pickaxeWalls = [...maze].filter((w) => walkableNeighbours(keyToCell(w), maze).some((c) => reachable.has(cellKey(c))));
        for (const broken of [null, ...pickaxeWalls]) {
          const snapshot = snapshotOf(map, {
            triggeredTraps: linkOpen || broken === link.mutation.wall ? [link.trap] : [],
            trapOpenedWalls: linkOpen ? [link.mutation.wall] : [],
            ...(broken !== null && { chestOpened: true, rewardSelected: "pickaxe", rewardSpent: true, brokenWall: broken }),
          });
          topologyStates += 1;
          const verdict = API.inspectDynamicMazeState(snapshot);
          // Every open cell must reach every objective: no cell of the maze can be cut off by an opening.
          const reach = API.getReachableDistances(map.playerStart, verdict.effectiveWalls);
          const openCells = 81 - verdict.effectiveWalls.size;
          if (!verdict.valid || !verdict.topologicallySolvable || reach.size !== openCells) {
            softlocks.push({ seed, difficulty, route, linkOpen, broken, issues: verdict.issues, reach: reach.size, openCells });
          }
        }
      }
    }
    return { pass: softlocks.length === 0 && topologyStates > 0, maps: sample.length, topologyStates, softlocks: softlocks.slice(0, 3), note: "adversarial (exact solver) classes: rota2-dynamic-traps-census.mjs" };
  });

  // =============================================================================================
  // T24–T26 · reduced motion, the renderer decides nothing, the Worker stays the generation realm
  // =============================================================================================
  await guarded("T24", "rota2", "REDUCED_MOTION_PRESERVES_SEMANTICS", async () => {
    const f = need(primary, "activation");
    const hook = readFromRev(rev, FILES.hook);
    const hookIgnoresMotion = !/reducedMotion|prefers-reduced-motion|matchMedia/.test(hook);
    const fresh = mountFor(f);
    const before = boardStateOf(fresh.state).state;
    const after = boardStateOf(f.after).state;
    const census = async (reduced) => {
      const scene = await mountScene(sceneModule, { ...before, reducedMotion: reduced });
      scene.update({ ...after, reducedMotion: reduced });
      const now = sceneCensus(scene);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      scene.frame();
      const later = sceneCensus(scene);
      scene.dispose();
      return { pulses: now.named("route-passage-pulse-ring"), pulsesAfterASecond: later.named("route-passage-pulse-ring"), staticSignature: now.staticSignature };
    };
    const reduced = await census(true);
    const motion = await census(false);
    const facts = {
      hookIgnoresMotion,
      reducedPulses: reduced.pulses,
      motionPulses: motion.pulses,
      motionPulsesAfterASecond: motion.pulsesAfterASecond,
      sameBoardEitherWay: reduced.staticSignature === motion.staticSignature,
    };
    const pass = hookIgnoresMotion && reduced.pulses === 0 && motion.pulses === 2 && motion.pulsesAfterASecond === 0 && facts.sameBoardEitherWay;
    return { pass, ...facts };
  });

  await guarded("T25", "rota2", "NO_GAMEPLAY_RULE_IN_THE_RENDERER", async () => {
    const f = need(primary, "activation");
    // Hand the scene an armed linked trap whose wall the game did NOT open: it must draw the wall, because it draws `walls`.
    const fresh = mountFor(f);
    const base = boardStateOf(fresh.state).state;
    const contradiction = { ...base, triggeredTrapKeys: [f.link.trap] };
    const scene = await mountScene(sceneModule, contradiction);
    const drawn = sceneCensus(scene);
    scene.dispose();
    const sceneSource = sceneTransform ? sceneTransform(readFromRev(null, FILES.scene)) : readFromRev(rev, FILES.scene);
    const boardSource = readFromRev(rev, FILES.board);
    const gameSource = readFromRev(rev, FILES.game);
    const facts = {
      wallDrawnAsGiven: drawn.wallsAt.has(f.link.mutation.wall),
      sceneHasNoRuntimeImports: !/^import\s(?!type)/m.test(sceneSource),
      sceneNeverWritesWalls: !/state\.walls\s*=|walls\.(delete|add|splice|push)\(/.test(sceneSource),
      boardPassesWallsThrough: /walls: Array\.from\(walls\)/.test(boardSource),
      gamePassesHookTopology: /walls=\{walls\}/.test(gameSource) && /trapOpenedWalls=\{trapOpenedWalls\}/.test(gameSource) && /trapLinks=\{trapLinks\}/.test(gameSource),
      gameDecidesNoTopology: !/trapLinks\.(find|filter|some)|mutation\.wall/.test(gameSource),
    };
    return { pass: Object.values(facts).every(Boolean), ...facts };
  });

  await guarded("T26", "preserved", "WORKER_GENERATION_ARCHITECTURE_INTACT", () => {
    const tree = openSourceTree({ rev });
    const baseTree = openSourceTree({ rev: ROTA2_BASE });
    const workerNow = [...tree.closure(FILES.worker)].sort();
    const workerBase = [...baseTree.closure(FILES.worker)].sort();
    const hookClosure = [...tree.closure(FILES.hook)];
    const protocol = tryRequire(FILES.protocol);
    const runner = tryRequire(FILES.runner);
    // A board crosses the realm boundary by structured clone, and the reply check reads it.
    const map = generate(7_300_011, "hard", 3);
    const cloned = structuredClone(map);
    const reply = (m) => ({ protocol: protocol.ROUTE_GENERATION_WORKER_PROTOCOL, response: { requestId: 7, status: "ready", result: { map: m, random: null } } });
    const accepted = protocol.readRouteGenerationWorkerReply?.(reply(cloned), 7) !== null;
    // The runner (the Worker's half) gives the same board, links included, as a direct generation from the same seed.
    let runnerSame = null;
    if (typeof runner.runRouteGenerationSync === "function") {
      LAB.routeRandom.armRouteRandomSeed(515);
      try {
        const viaRunner = runner.runRouteGenerationSync({ difficulty: "medium", routeNumber: 2, random: LAB.routeRandom.getRouteRandomCheckpoint() }).map;
        const direct = API.generateMaze("medium", 2);
        runnerSame = sameJson({ ...viaRunner, walls: sortedKeys(viaRunner.walls) }, { ...direct, walls: sortedKeys(direct.walls) });
      } finally {
        LAB.routeRandom.clearRouteRandomSeed();
      }
    }
    const facts = {
      workerClosureUnchanged: sameJson(workerNow, workerBase),
      workerModules: workerNow.length,
      generationOffTheMainGraph: !hookClosure.includes(FILES.generation) && !hookClosure.includes(FILES.runner),
      clonedBoardAccepted: accepted,
      clonedBoardKeepsItsShape: sameJson(cloned.trapLinks ?? null, map.trapLinks ?? null) && cloned.walls instanceof Set,
      runnerSameAsDirect: runnerSame,
    };
    return { pass: facts.workerClosureUnchanged && facts.generationOffTheMainGraph && accepted && facts.clonedBoardKeepsItsShape && runnerSame === true, ...facts };
  });

  // =============================================================================================
  // T27–T28 · a Route that never arms the linked trap is the v1 Route; the journey still ends
  // =============================================================================================
  await guarded("T27", "preserved", "V1_ROUTE_WITHOUT_ACTIVATION_BEHAVES_EQUIVALENTLY", () => {
    const BASE_RT = loadRouteRuntime({ directDifficulty: true, rev: ROTA2_BASE });
    const play = (rt, seed, difficulty, route, avoidKey) => {
      const run = rt.mount({ seed, difficulty, routeNumber: route });
      const frames = [observe(run.state)];
      for (let i = 0; i < 160 && run.state.status === "playing"; i += 1) {
        const g = run.state;
        if (g.rewardChoicePending) {
          run.choose("second-chance");
          frames.push(observe(run.state));
          continue;
        }
        const remaining = g.mazeMap.collectibleStars.filter((s) => !g.collectedSet.has(cellKey(s)));
        const goal = remaining[0] ?? g.mazeMap.exitPosition;
        const blocked = new Set([...g.walls, cellKey(g.guardian), cellKey(g.sentinel), ...(avoidKey ? [avoidKey] : [])]);
        blocked.delete(cellKey(goal));
        const routeCells = pathBetween(g.player, goal, blocked);
        if (!routeCells || routeCells.length < 2) break;
        run.stepTo(routeCells[1]);
        frames.push(observe(run.state));
      }
      return { frames, map: run.state.mazeMap };
    };
    const v1Fields = (m) => JSON.stringify({ grid: m.grid, walls: sortedKeys(m.walls), playerStart: m.playerStart, guardianStart: m.guardianStart, exitPosition: m.exitPosition, collectibleStars: m.collectibleStars, traps: m.traps, chest: m.chest });
    let compared = 0;
    let differentMaps = 0;
    const divergences = [];
    for (const difficulty of DIFFICULTIES) {
      for (const route of ROUTES) {
        for (const seed of [8_100_001, 8_100_002, 8_100_003]) {
          const now = RT.mount({ seed, difficulty, routeNumber: route });
          const link = linkOf(now.state.mazeMap);
          const avoid = link ? link.trap : null;
          const a = play(RT, seed, difficulty, route, avoid);
          const b = play(BASE_RT, seed, difficulty, route, avoid);
          if (v1Fields(a.map) !== v1Fields(b.map)) {
            differentMaps += 1;
            continue;
          }
          compared += 1;
          if (!sameJson(a.frames, b.frames)) divergences.push({ seed, difficulty, route, at: a.frames.findIndex((fr, i) => !sameJson(fr, b.frames[i])) });
        }
      }
    }
    return { pass: divergences.length === 0 && compared >= 20, gamesCompared: compared, mapsDifferentFromV1: differentMaps, divergences: divergences.slice(0, 3), note: "the linked trap avoided; maps differing from v1 are the link gate's retries (census)" };
  });

  await guarded("T28", "preserved", "ROTA_JOURNEY_STILL_TERMINATES", () => {
    const continuation = readFromRev(rev, FILES.continuation) === readFromRev(ROTA2_BASE, FILES.continuation);
    // R1 lost → R2 lost → R3 lost → R3 again; R3 won completes the journey (searched over seeds).
    const chain = [];
    let run = RT.mount({ seed: 8_200_001, difficulty: "easy", routeNumber: 1 });
    for (let hop = 0; hop < 3; hop += 1) {
      const link = linkOf(run.state.mazeMap);
      if (link) {
        walkToBeforeTrap(run, keyToCell(link.trap));
        if (run.state.status === "playing") run.stepTo(keyToCell(link.trap));
      }
      if (run.state.status === "playing") playToEnd(run, "lose");
      const last = run.completions.at(-1);
      chain.push({ route: run.state.routeNumber, status: run.state.status, next: last?.continuation?.routeNumber ?? null });
      run = run.nextSession({ seed: 8_200_002 + hop });
    }
    let journeyCompleted = null;
    for (let seed = 8_210_000; seed < 8_210_060 && journeyCompleted === null; seed += 1) {
      const r3 = RT.mount({ seed, difficulty: "easy", routeNumber: 3 });
      if (playToEnd(r3, "win") === "won") {
        const last = r3.completions.at(-1);
        journeyCompleted = { seed, continuation: last?.continuation ?? null, journeyCompleted: last?.details?.journeyCompleted ?? null };
      }
    }
    const pass = continuation && sameJson(chain.map((c) => c.next), [2, 3, 3]) && chain.every((c) => c.status === "lost") &&
      journeyCompleted !== null && journeyCompleted.continuation === null && journeyCompleted.journeyCompleted === true;
    return { pass, continuationModuleUnchanged: continuation, chain, journeyCompleted };
  });

  return { results, fixtureSummary };
}

// =================================================================================================
// the real RouteBabylonBoard, rendered by a few lines of React — to read what it hands the scene
// =================================================================================================

function loadBoardComponent(rev, boardTransform) {
  let source = readFromRev(rev, FILES.board);
  if (boardTransform) source = boardTransform(source);
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    fileName: FILES.board,
  }).outputText;
  const hooks = { memo: [] };
  const react = {
    useMemo: (factory) => {
      const value = factory();
      hooks.memo.push(value);
      return value;
    },
    useRef: (value) => ({ current: value }),
    useEffect: () => {},
    useState: (value) => [value, () => {}],
  };
  const jsx = (type, props) => ({ type, props });
  const modules = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
    "lucide-react": { LocateFixed: "LocateFixed" },
    "@/games/escape-maze/useEscapeMaze": { COLS: 9, ROWS: 9, posKey: (p) => `${p.row},${p.col}` },
  };
  const mod = { exports: {} };
  const sandbox = { module: mod, exports: mod.exports, require: (name) => {
    if (name in modules) return modules[name];
    throw new Error(`board stub: unexpected import ${name}`);
  }, console, Array, Set, Map, JSON, Object, Promise, Error };
  vm.createContext(sandbox);
  new vm.Script(js).runInContext(sandbox);
  return { Board: mod.exports.RouteBabylonBoard, hooks };
}

/** The props RouteStrategyGame hands the board, from a render of the hook (the same expressions as the view). */
function renderBoardState({ Board, hooks }, g) {
  hooks.memo.length = 0;
  const element = Board({
    mazeMap: g.mazeMap,
    walls: g.walls,
    player: g.player,
    guardian: g.guardian,
    sentinel: g.sentinel,
    sentinelCommitted: g.sentinelTarget !== null,
    collectedSet: g.collectedSet,
    moveTargets: new Set(),
    triggeredTrapSet: g.triggeredTrapSet,
    dangerTiles: new Set(),
    chestOpened: g.chestOpened,
    breakTargets: g.breakTargets.map(({ cell }) => cellKey(cell)),
    aimedWall: null,
    brokenWall: g.brokenWall,
    trapLinks: g.trapLinks ?? [],
    trapOpenedWalls: g.trapOpenedWalls ?? [],
    reducedMotion: true,
    status: g.status,
    onMove: () => {},
  });
  const state = hooks.memo.find((value) => value && Array.isArray(value.walls));
  const find = (node) => {
    if (!node || typeof node !== "object") return null;
    if (node.type === "canvas") return node.props;
    const kids = [node.props?.children].flat();
    for (const kid of kids) {
      const hit = find(kid);
      if (hit) return hit;
    }
    return null;
  };
  return { state: { trapLinks: [], trapOpenedWallKeys: [], ...state }, canvas: find(element) ?? {} };
}

// =================================================================================================
// the real scene on the real Babylon (NullEngine) — what is on the board after each state
// =================================================================================================

async function mountScene(sceneModule, initialState) {
  const handles = { engine: null, scene: null };
  const imports = [];
  class TestEngine extends BABYLON.NullEngine {
    constructor(canvas) {
      super({ renderWidth: canvas.clientWidth, renderHeight: canvas.clientHeight, textureSize: 256, deterministicLockstep: false, lockstepMaxSteps: 1 });
      this.__loop = null;
      handles.engine = this;
    }
    resize() {}
    runRenderLoop(fn) {
      this.__loop = fn;
    }
    stopRenderLoop() {
      this.__loop = null;
    }
  }
  class TestScene extends BABYLON.Scene {
    constructor(...a) {
      super(...a);
      handles.scene = this;
    }
  }
  const B = {
    ...BABYLON,
    Engine: TestEngine,
    Scene: TestScene,
    SceneLoader: {
      ImportMeshAsync(_a, _b, file) {
        return new Promise((_resolve, reject) => imports.push(() => reject(new Error(`no GLB in node: ${file}`))));
      },
    },
  };
  const canvas = createCanvasDouble();
  const controller = sceneModule.createRouteBabylonController(B, canvas, initialState, { onMove: () => {} });
  imports.splice(0).forEach((fail) => fail());
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  handles.engine.__loop?.();
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  return {
    handles,
    update(next) {
      controller.updateBoard(next);
    },
    frame() {
      handles.engine.__loop?.();
    },
    dispose() {
      controller.dispose();
    },
  };
}

const CELL_OF = (mesh) => {
  mesh.computeWorldMatrix(true);
  const p = mesh.getAbsolutePosition();
  return `${Math.round(4 - p.z)},${Math.round(p.x + 4)}`;
};
function sceneCensus(scene) {
  const meshes = scene.handles.scene.meshes.filter((m) => !m.isDisposed());
  const named = (name) => meshes.filter((m) => m.name === name).length;
  const namedAt = (name) => new Set(meshes.filter((m) => m.name === name).map(CELL_OF));
  const walls = meshes.filter((m) => m.name === "route-wall-base" || m.name.startsWith("route-wall-glb-"));
  const wallCells = walls.map(CELL_OF);
  const duplicateWalls = wallCells.filter((cell, i) => wallCells.indexOf(cell) !== i);
  const staticNames = new Set(["route-wall-base", "route-wall-cap", "route-passage-wall-rune", "route-passage-wall-ring", "route-passage-opened-rune", "route-passage-opened-ring", "route-broken-chip", "route-broken-dust"]);
  const staticSignature = meshes.filter((m) => staticNames.has(m.name)).map((m) => `${m.name}@${CELL_OF(m)}`).sort().join("|");
  const signature = meshes.filter((m) => m.name !== "route-passage-pulse-ring").map((m) => `${m.name}@${CELL_OF(m)}`).sort();
  return { wallsAt: new Set(wallCells), duplicateWalls, named, namedAt, staticSignature, signature, total: meshes.length };
}

// =================================================================================================
// mutants — each a sanctioned in-memory edit of the working tree; each must be caught
// =================================================================================================

const edit = (anchor, replacement, what) => (source) => {
  if (source.split(anchor).length !== 2) throw new Error(`mutant anchor not found: ${what}`);
  return source.replace(anchor, replacement);
};
const ACTIVATION_PICK = `      const trapOpensWall =
        trapLink !== null && walls.has(trapLink.mutation.wall)
          ? trapLink.mutation.wall
          : null;`;
const MUTANTS_LIST = [
  {
    id: "M01", name: "linked wall chosen randomly at trigger time", targets: ["T04", "T05", "T17"],
    transforms: { [FILES.hook]: edit(ACTIVATION_PICK, `      const trapOpensWall =
        trapLink !== null ? [...walls][Math.floor(Math.random() * walls.size)] : null;`, "M01") },
  },
  {
    id: "M02", name: "trap opens the wrong wall", targets: ["T04", "T05"],
    transforms: { [FILES.hook]: edit(ACTIVATION_PICK, `      const trapOpensWall =
        trapLink !== null && walls.has(trapLink.mutation.wall)
          ? [...walls].sort().find((w) => w !== trapLink.mutation.wall) ?? null
          : null;`, "M02") },
  },
  {
    id: "M03", name: "trap opens two walls", targets: ["T04", "T05"],
    transforms: { [FILES.hook]: edit(`          wall: trapOpensWall,
        });
      }`, `          wall: trapOpensWall,
        });
        const extraWall = [...walls].sort().find((w) => w !== trapOpensWall);
        if (extraWall) applyDomainEvent({ type: "WALL_OPENED_BY_TRAP", turn: nextTurn, trap: nextKey, wall: extraWall });
      }`, "M03") },
  },
  {
    id: "M04", name: "renderer changes but logic does not", targets: ["T04", "T25"],
    transforms: { [FILES.hook]: edit(ACTIVATION_PICK, "      const trapOpensWall: string | null = null;", "M04 hook") },
    sceneTransform: edit(`    state.walls.forEach((key) => {
      const [row, col] = key.split(",").map(Number);
      const pos = cellToPosition(row, col);
      if (linkedWalls.has(key)) {`, `    state.walls.forEach((key) => {
      const [row, col] = key.split(",").map(Number);
      const pos = cellToPosition(row, col);
      if (state.trapLinks.some((link) => link.wall === key && state.triggeredTrapKeys.includes(link.trap))) return;
      if (linkedWalls.has(key)) {`, "M04 scene"),
  },
  {
    id: "M05", name: "logic changes but renderer does not", targets: ["T09"],
    boardTransform: edit("      walls: Array.from(walls),", "      walls: Array.from(mazeMap.walls),", "M05"),
  },
  {
    id: "M06", name: "Hunter sees the old topology", targets: ["T07"],
    transforms: { [FILES.hook]: edit(`      const nextGuardian = chooseGuardianMove(
        input.guardianFrom,
        input.playerPosition,
        mazeMap.exitPosition,
        input.graphWalls,`, `      const nextGuardian = chooseGuardianMove(
        input.guardianFrom,
        input.playerPosition,
        mazeMap.exitPosition,
        mazeMap.walls,`, "M06") },
  },
  {
    id: "M07", name: "Sentinel sees the old topology", targets: ["T08"],
    transforms: { [FILES.hook]: edit(`        input.playerPosition,
        mazeMap.exitPosition,
        input.graphWalls,
        input.zone,`, `        input.playerPosition,
        mazeMap.exitPosition,
        mazeMap.walls,
        input.zone,`, "M07") },
  },
  {
    id: "M08", name: "restart keeps the opened wall", targets: ["T14"],
    transforms: { [FILES.state]: edit(`    case "START_ROUTE":
      return createRouteState(action);`, `    case "START_ROUTE":
      return { ...createRouteState(action), trapOpenedWalls: state.trapOpenedWalls };`, "M08") },
  },
  {
    id: "M09", name: "next Route inherits the wall change", targets: ["T15"],
    transforms: { [FILES.hook]: (source) => edit("    return currentWalls(boardMap.walls, boardBrokenWall, boardTrapOpenedWalls);", "    for (const w of boardTrapOpenedWalls) if (!ROTA2_CARRY.includes(w)) ROTA2_CARRY.push(w);\n    return currentWalls(boardMap.walls, boardBrokenWall, ROTA2_CARRY);", "M09 walls")(
      edit("const MOVE_INPUT_GUARD_MS = 150;", "const MOVE_INPUT_GUARD_MS = 150;\nconst ROTA2_CARRY: string[] = [];", "M09 module")(source),
    ) },
  },
  {
    id: "M10", name: "the Pickaxe makes the trap reroll another wall", targets: ["T11"],
    transforms: { [FILES.hook]: edit(ACTIVATION_PICK, `      const trapOpensWall =
        trapLink !== null
          ? walls.has(trapLink.mutation.wall)
            ? trapLink.mutation.wall
            : [...walls].sort()[0] ?? null
          : null;`, "M10") },
  },
  {
    id: "M11", name: "Second Chance consumed by the topology change", targets: ["T13"],
    transforms: { [FILES.events]: edit(`      return [{ type: "OPEN_WALL_BY_TRAP", wall: event.wall }];`, `      return [{ type: "OPEN_WALL_BY_TRAP", wall: event.wall }, { type: "SPEND_SECOND_CHANCE", message: "" }];`, "M11") },
  },
  {
    id: "M12", name: "the trap no longer blocks the defenders", targets: ["T10"],
    transforms: { [FILES.hook]: edit(`      const armedTraps = isUntriggeredTrap
        ? new Set<string>([...triggeredTrapSet, nextKey])
        : triggeredTrapSet;`, `      const armedTraps = isUntriggeredTrap && trapLink === null
        ? new Set<string>([...triggeredTrapSet, nextKey])
        : triggeredTrapSet;`, "M12") },
  },
  {
    id: "M13a", name: "generation accepts an invalid edge (a wall touching the portal region)", targets: ["T21"],
    transforms: { [FILES.generation]: edit("    if (distance === undefined || distance <= PORTAL_CONVERGENCE_RADIUS) return null;", "    if (distance === undefined) return null;", "M13a") },
  },
  {
    id: "M13c", name: "generation accepts an invalid edge (a wall opening into a plaza)", targets: ["T21"],
    transforms: { [FILES.generation]: edit("  if (open.length < 2 || open.length > 3) return null;", "  if (open.length < 2) return null;", "M13c") },
  },
  {
    id: "M13b", name: "the inspector accepts a link to a non-wall", targets: ["T20"],
    transforms: { [FILES.invariants]: edit(`      issues.push("TRAP_LINK_WALL_NOT_IN_BASE_MAP");`, "      // accepted", "M13b") },
  },
  {
    id: "M14", name: "generation relation non-deterministic", targets: ["T02"],
    transforms: { [FILES.generation]: (source) => edit("  const links: RouteTrapLink[] = [];", "  ROTA2_SHUFFLE += 1;\n  pairs.push(...pairs.splice(0, ROTA2_SHUFFLE % Math.max(1, pairs.length)));\n  const links: RouteTrapLink[] = [];", "M14 pick")(
      edit("const TRAP_LINKS_PER_ROUTE = 1;", "const TRAP_LINKS_PER_ROUTE = 1;\nlet ROTA2_SHUFFLE = 0;", "M14 module")(source),
    ) },
  },
  {
    id: "M15", name: "the topology event loses its cause", targets: ["T18"],
    transforms: { [FILES.hook]: edit(`          type: "WALL_OPENED_BY_TRAP",
          turn: nextTurn,
          trap: nextKey,
          wall: trapOpensWall,`, `          type: "WALL_OPENED",
          turn: nextTurn,
          wall: trapOpensWall,`, "M15") },
  },
];

// =================================================================================================
// main
// =================================================================================================

async function main() {
  if (MUTANTS) {
    console.log("ROTA2 dynamic traps — mutants (each must be caught by a check it targets)\n");
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
        const run = await runSuite({ quiet: true, transforms: mutant.transforms ?? [], sceneTransform: mutant.sceneTransform ?? null, boardTransform: mutant.boardTransform ?? null, fixturesHint: clean.fixtureSummary });
        const failing = run.results.filter((r) => !r.pass).map((r) => r.id);
        const caughtBy = mutant.targets.filter((id) => failing.includes(id));
        outcome = { caught: caughtBy.length > 0, caughtBy, alsoFailing: failing.filter((id) => !mutant.targets.includes(id)) };
      } catch (error) {
        outcome = { caught: false, broken: String(error?.message ?? error).split("\n")[0] };
      }
      rows.push({ id: mutant.id, name: mutant.name, targets: mutant.targets, ...outcome });
      console.log(`${outcome.caught ? "CAUGHT" : outcome.broken ? "BROKEN" : "MISSED"}  ${mutant.id} — ${mutant.name}${outcome.caughtBy ? ` (by ${outcome.caughtBy.join(", ")})` : ""}${outcome.broken ? `: ${outcome.broken}` : ""}`);
    }
    const caught = rows.filter((r) => r.caught).length;
    console.log(`\n${caught}/${rows.length} mutants caught`);
    console.log(caught === rows.length ? "ROTA2_DYNAMIC_TRAPS_MUTANTS_CAUGHT" : "ROTA2_DYNAMIC_TRAPS_MUTANTS_MISSED");
    return caught === rows.length ? EXIT_OK : EXIT_VALIDATION_FAILED;
  }

  if (REV) {
    console.log(`ROTA2 dynamic traps — counterfactual on ${REV}: every [rota2] check must FAIL, every [preserved] check must PASS\n`);
    const { results } = await runSuite({ rev: REV });
    const wrong = results.filter((r) => (r.tag === "rota2" ? r.pass : !r.pass));
    console.log(`\nrota2 failing ${results.filter((r) => r.tag === "rota2" && !r.pass).length}/${results.filter((r) => r.tag === "rota2").length} · preserved holding ${results.filter((r) => r.tag === "preserved" && r.pass).length}/${results.filter((r) => r.tag === "preserved").length}`);
    if (wrong.length) console.log(`unexpected: ${wrong.map((r) => `${r.id}(${r.pass ? "passed" : "failed"})`).join(", ")}`);
    console.log(wrong.length === 0 ? "ROTA2_DYNAMIC_TRAPS_COUNTERFACTUAL_HOLDS" : "ROTA2_DYNAMIC_TRAPS_COUNTERFACTUAL_BROKEN");
    return wrong.length === 0 ? EXIT_OK : EXIT_VALIDATION_FAILED;
  }

  const started = performance.now();
  const { results, fixtureSummary } = await runSuite();
  const passed = results.filter((r) => r.pass).length;
  const allPass = passed === results.length;
  console.log(`\n${passed}/${results.length} passed${allPass ? "" : ` · failing: ${results.filter((r) => !r.pass).map((r) => r.id).join(", ")}`}`);
  console.log(allPass ? "ROTA2_DYNAMIC_TRAPS_TESTS_OK" : "ROTA2_DYNAMIC_TRAPS_TESTS_FAILED");
  const EVIDENCE = openEvidence(process.env.ROUTE_VALIDATION_OUT ?? "docs/archive/rota2-dynamic-traps-01");
  EVIDENCE.write(
    "dynamic-traps-tests.json",
    {
      mission: "ROTA2-DYNAMIC-TRAPS-01",
      base: ROTA2_BASE,
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
