/**
 * ROTA2-DEPENDENT-OBJECTIVES-02 — the first dependent objective, asserted.
 *
 * Route 1 keeps v1's objective (every light → portal). On Routes 2 and 3 the portal waits for two prerequisites, in
 * any order: every light, AND the marked passage — the dynamic trap's linked wall — open, whoever opened it (its
 * trap or the Pickaxe). Objectives are derived from the lights and the current walls; nothing new is stored.
 *
 * Everything drives production: the REAL `useEscapeMaze` through the runtime harness (one tree: the working tree or
 * a `--rev`), the real generator, the real objective module, the exact Rota 2.0 solver held against the hook. One
 * read-only recorder line is inserted at the top of `routeStateActionsForEvent` (every domain event, in order) and
 * of the Hunter's policy (the walls each decision was given).
 *
 * Checks are tagged:
 *   [objectives]  the new contract — must FAIL on the mission's base (`--rev=32c419a`, DYNAMIC-TRAPS-01's tree);
 *   [preserved]   a contract the mission must not disturb — must PASS on the base and on the working tree;
 *   [structure]   a property of the maps alone (the same maps on both trees) — must PASS on both.
 *
 * Usage:
 *   node tools/validation/rota2-dependent-objectives-tests.mjs                # O01–O30 (check evidence)
 *   node tools/validation/rota2-dependent-objectives-tests.mjs --update       # rewrite the evidence
 *   node tools/validation/rota2-dependent-objectives-tests.mjs --rev=32c419a  # counterfactual: every [objectives]
 *        check fails, every [preserved]/[structure] check holds. Writes nothing.
 *   node tools/validation/rota2-dependent-objectives-tests.mjs --mutants      # each mutant caught by a check it
 *        targets. Writes nothing.
 *
 * Exit: 0 pass · 1 a check (or counterfactual/mutant expectation) failed · 2 evidence diverged · 3 usage.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";
import ts from "typescript";

import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED, openEvidence } from "./evidence.mjs";
import { cellKey, loadRouteRuntime, pathBetween, playToEnd, sameCell, walkableNeighbours } from "./route-runtime-harness.mjs";
import { ACTIONS } from "./dynamic-solver.mjs";
import { buildDynamicContext, dynamicSuccessorSet, exploreDynamic, packDynamicState } from "./rota2-dynamic-solver.mjs";
import { objectiveStructure } from "./rota2-objectives-structure.mjs";

export const OBJECTIVES_BASE = "32c419a2784b54043f38f08afd60c8628f44f54c";
const ROTA = "src/games/escape-maze/";
const FILES = {
  hook: `${ROTA}useEscapeMaze.ts`,
  events: `${ROTA}route-events.ts`,
  state: `${ROTA}route-state.ts`,
  defenders: `${ROTA}route-defenders.ts`,
  objectives: `${ROTA}route-objectives.ts`,
  invariants: `${ROTA}route-invariants.ts`,
  generation: `${ROTA}route-generation.ts`,
  scoring: "src/engine/scoring.ts",
};

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
const MUTANTS = args.includes("--mutants");
const known = new Set([revArg, "--mutants", "--check", "--update"].filter(Boolean));
if (args.some((arg) => !known.has(arg)) || REV === "" || (REV && MUTANTS)) {
  console.error("usage: node tools/validation/rota2-dependent-objectives-tests.mjs [--check|--update] [--rev=<commit> | --mutants]");
  process.exit(EXIT_USAGE);
}

// =================================================================================================
// instrumentation — read-only recorder lines, the same anchors on the base and today
// =================================================================================================

const shapeChanged = (what) => new Error(`rota2-dependent-objectives-tests: anchor not found (${what})`);
function insertAfter(source, anchor, line, what) {
  if (source.split(anchor).length !== 2) throw shapeChanged(what);
  return source.replace(anchor, `${anchor}${line}`);
}
const INSTRUMENT = {
  [FILES.events]: (source) =>
    insertAfter(source, "): RouteStateAction[] {\n", "  (globalThis as any).__obj?.events.push(event);\n", "routeStateActionsForEvent"),
  [FILES.defenders]: (source) =>
    insertAfter(
      source,
      "  blockedForDefenders: Set<string> = EMPTY_BLOCKED,\n): GridPosition {\n",
      "  (globalThis as any).__obj?.hunter.push({ walls });\n",
      "chooseGuardianMove",
    ),
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
const seedFor = (route, difficulty, index) => 9_200_000 + route * 10_000 + DIFFICULTIES.indexOf(difficulty) * 1_000 + index;
const mapFields = (m) =>
  JSON.stringify({ grid: m.grid, walls: sortedKeys(m.walls), playerStart: m.playerStart, guardianStart: m.guardianStart, exitPosition: m.exitPosition, collectibleStars: m.collectibleStars, traps: m.traps, chest: m.chest, trapLinks: m.trapLinks ?? null });

function readFromRev(rev, file) {
  try {
    if (!rev) return fs.readFileSync(path.resolve(file), "utf8").replace(/\r\n/g, "\n");
    return execFileSync("git", ["show", `${rev}:${file}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).replace(/\r\n/g, "\n");
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

/** What a render of the hook says about the board, compared across trees (no field that only one tree has). */
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
    trapOpenedWalls: g.trapOpenedWalls,
    chestOpened: g.chestOpened,
    rewardSelected: g.rewardSelected,
    rewardSpent: g.rewardSpent,
    portalActive: g.portalActive,
    score: g.score,
    valid: g.dynamicSolvability.valid,
  };
}

const MESSAGES = {
  bothMissing: "Faltam luzes e a passagem marcada.",
  passageMissing: "As luzes estão prontas. Falta abrir a passagem marcada.",
  lightsMissing: "A passagem está aberta. Ainda faltam luzes.",
  lightsDonePassageMissing: "Todas as luzes coletadas. Falta abrir a passagem marcada.",
  trapPortal: "Armadilha ativada: a passagem marcada se abriu, para todos. Portal ativado! Vá até a saída.",
  trapLightsMissing: "Armadilha ativada: a passagem marcada se abriu, para todos. Ainda faltam luzes.",
  pickaxePortal: "Parede aberta: a passagem marcada está aberta. Portal ativado! Vá até a saída.",
  pickaxeLightsMissing: "Parede aberta: a passagem marcada está aberta. Ainda faltam luzes.",
};
const STRESSFUL = /!{2,}|perig|cuidado|erro|falh|alerta|urgente|rápido/i;

// =================================================================================================
// the suite — one call is one tree (plus optional mutant transforms)
// =================================================================================================

async function runSuite({ rev = null, transforms = [], solverRequirePassage = null, fixturesHint = null, quiet = false } = {}) {
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
  // The text of a file of the tree under test — with a mutant's edit, when it has one, exactly as the runtime got it.
  const textOf = (file) => {
    const text = readFromRev(rev, file);
    const fn = transforms && !Array.isArray(transforms) ? transforms[file] : null;
    return text !== null && fn ? fn(text) : text;
  };
  const { API, LAB } = RT;
  const sb = LAB.sb;
  sb.__obj = { events: [], hunter: [] };
  const trace = sb.__obj;
  const objectivesModule = (() => {
    try {
      return LAB.graph.require(FILES.objectives);
    } catch {
      return null;
    }
  })();
  const generate = (seed, difficulty, route) => {
    LAB.setSeed(seed);
    return API.generateMaze(difficulty, route);
  };
  const linkOf = (map) => (map.trapLinks ?? [])[0] ?? null;
  // What the solver's win condition is told: the tree's own rule (the hook says whether the passage is required),
  // unless a mutant forces the old rule.
  const requiresPassage = (g) => (solverRequirePassage === null ? Boolean(g.objectives?.passage?.required) : solverRequirePassage && g.routeNumber >= 2);

  // --- every render is checked against the objective truth, and every pre-Chest step against the solver -----------
  const renders = { inspected: 0, passageMismatch: 0, portalMismatch: 0, examples: [] };
  // `unsound` counts every disagreement; `heldDoorArmed` is the one pre-existing shape of the reference solver (found by
  // this mission, present on the v1 tree 9f8ebb5 too): the Explorer arms a trap that IS the door the Sentinel holds;
  // the reference drops the Sentinel's commitment (door unreachable once blocked), the hook keeps it. Every piece
  // lands on the same cell either way — only the Sentinel's (target, commitLeft) bookkeeping differs.
  // `defenderModelGap`: the same state is missing under the OLD win rule too — the reference defender model, not the
  // objective condition (which only decides whether a step onto the exit wins). See the census's `referenceGap`.
  const differential = { transitions: 0, unsound: 0, heldDoorArmed: 0, defenderModelGap: 0, objectiveUnsound: 0, afterPassage: 0, wins: 0, examples: [] };
  let dctx = null;
  let dctxOld = null;
  const inspectRender = (g) => {
    if (!g || g.mazeMap === null || !g.objectives) return;
    renders.inspected += 1;
    const link = linkOf(g.mazeMap);
    const required = g.objectives.passage.required;
    const open = link ? !g.walls.has(link.mutation.wall) : true;
    const lights = g.collectedSet.size >= g.mazeMap.collectibleStars.length;
    if (g.objectives.passage.open !== open) renders.passageMismatch += 1;
    const expectedPortal = lights && (!required || open);
    if (g.portalActive !== expectedPortal) {
      renders.portalMismatch += 1;
      if (renders.examples.length < 3) renders.examples.push({ route: g.routeNumber, lights, open, required, portalActive: g.portalActive });
    }
  };
  const numericOf = (g) => {
    const id = (p) => p.row * 9 + p.col;
    let lights = 0;
    g.mazeMap.collectibleStars.forEach((s, i) => {
      if (g.collectedSet.has(cellKey(s))) lights |= 1 << i;
    });
    let traps = 0;
    g.mazeMap.traps.forEach((t, i) => {
      if (g.triggeredTrapSet.has(cellKey(t))) traps |= 1 << i;
    });
    const t = g.sentinelTarget ? [...dctx.unionAccessIds].indexOf(id(g.sentinelTarget)) : -1;
    return { e: id(g.player), h: id(g.guardian), s: id(g.sentinel), t, c: g.sentinelCommitLeft, lights, traps };
  };
  const step = (run, cell) => {
    const before = run.state;
    const preChest = !before.chestOpened && before.rewardSelected === null;
    // Only a session mounted through `mountFor` is held against the solver: its context is built for that board.
    const pre = preChest && dctx && dctx.map === before.mazeMap && !dctx.accessesDiffer ? numericOf(before) : null;
    const delta = { row: cell.row - before.player.row, col: cell.col - before.player.col };
    const actionIndex = ACTIONS.findIndex((a) => a.row === delta.row && a.col === delta.col);
    run.stepTo(cell);
    const after = run.state;
    inspectRender(after);
    if (pre && actionIndex >= 0 && !after.rewardChoicePending && after.turns === before.turns + 1) {
      const support = dynamicSuccessorSet(dctx, pre, actionIndex);
      differential.transitions += 1;
      if (dctx.link && (after.triggeredTrapSet.has(dctx.link.trap) || !after.walls.has(dctx.link.mutation.wall))) differential.afterPassage += 1;
      let sound;
      if (after.status === "lost") sound = Boolean(support?.hasLoss);
      else if (after.status === "won") {
        sound = Boolean(support?.hasWin);
        differential.wins += 1;
      } else sound = Boolean(support) && !(support.hasWin && support.states.length === 0) && support.states.includes(packDynamicState(dctx, numericOf(after)));
      if (!sound) {
        differential.unsound += 1;
        const decoded = (support?.states ?? []).map((k) => decodeKey(dctx, k));
        const post = numericOf(after);
        const armedNow = after.triggeredTrapSet.size > before.triggeredTrapSet.size;
        const heldDoor = before.sentinelTarget ? cellKey(before.sentinelTarget) : null;
        const samePieces = decoded.some((d) => d.e === post.e && d.h === post.h && d.s === post.s && d.lights === post.lights && d.traps === post.traps);
        const oldSupport = dctxOld ? dynamicSuccessorSet(dctxOld, pre, actionIndex) : null;
        const oldAlsoMisses = after.status === "playing" && oldSupport && !oldSupport.hasWin && !oldSupport.states.includes(packDynamicState(dctxOld, post));
        if (after.status === "playing" && armedNow && heldDoor === cellKey(after.player) && samePieces) differential.heldDoorArmed += 1;
        else if (oldAlsoMisses && !support?.hasWin) differential.defenderModelGap += 1;
        else differential.objectiveUnsound += 1;
        if (differential.examples.length < 5) differential.examples.push({ ...currentLabel, actionIndex, status: after.status, solverWin: Boolean(support?.hasWin), from: cellKey(before.player), to: cellKey(after.player), exit: cellKey(before.mazeMap.exitPosition), hunter: [cellKey(before.guardian), cellKey(after.guardian)], sentinel: [cellKey(before.sentinel), cellKey(after.sentinel)], target: [before.sentinelTarget && cellKey(before.sentinelTarget), after.sentinelTarget && cellKey(after.sentinelTarget), after.sentinelCommitLeft], pre, post: numericOf(after), support: support?.states?.map((k) => k) ?? null });
      }
    }
    return after;
  };

  // --- the careful Explorer: around the defenders' reach, never onto what it was told to avoid -------------------
  let margin = 1;
  const reachOf = (from, walls) => {
    const out = [from];
    let frontier = [from];
    for (let depth = 0; depth < margin; depth += 1) {
      frontier = frontier.flatMap((c) => walkableNeighbours(c, walls));
      out.push(...frontier);
    }
    return out;
  };
  const stepToward = (run, target, avoidKeys) => {
    const g = run.state;
    const avoid = new Set(avoidKeys);
    const map = g.mazeMap;
    if (map.chest && !g.chestOpened) avoid.add(cellKey(map.chest));
    if (margin >= 0) {
      for (const trap of map.traps) avoid.add(cellKey(trap));
      for (const star of map.collectibleStars) if (!g.collectedSet.has(cellKey(star))) avoid.add(cellKey(star));
    }
    avoid.add(cellKey(map.exitPosition));
    avoid.delete(cellKey(target));
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
    step(run, route[1]);
    return true;
  };
  const walkTo = (run, target, avoidKeys = [], budget = 60) => {
    for (let i = 0; i < budget; i += 1) {
      const g = run.state;
      if (sameCell(g.player, target)) return true;
      if (g.status !== "playing" || g.rewardChoicePending) return false;
      if (!stepToward(run, target, avoidKeys)) return false;
    }
    return sameCell(run.state.player, target);
  };
  const walkBeside = (run, target, avoidKeys = []) => {
    const g = run.state;
    for (const c of walkableNeighbours(target, g.walls).sort((a, b) => manhattan(a, g.player) - manhattan(b, g.player))) {
      if (avoidKeys.includes(cellKey(c))) continue;
      if (walkTo(run, c, [cellKey(target), ...avoidKeys])) return true;
      if (run.state.status !== "playing") return false;
    }
    return false;
  };
  /** Every light, nearest first, never through `avoidKeys`. Stops before the last one when `keepLast`. */
  const collectLights = (run, avoidKeys = [], { keepLast = false } = {}) => {
    for (let guard = 0; guard < 12; guard += 1) {
      const g = run.state;
      const left = g.mazeMap.collectibleStars.filter((s) => !g.collectedSet.has(cellKey(s))).sort((a, b) => manhattan(a, g.player) - manhattan(b, g.player));
      if (left.length === 0 || (keepLast && left.length === 1)) return true;
      if (!walkTo(run, left[0], avoidKeys)) return false;
    }
    return false;
  };
  /** A step whose events are recorded on their own. */
  const tracedStep = (run, cell) => {
    const from = trace.events.length;
    const hunterFrom = trace.hunter.length;
    const after = step(run, cell);
    return { after, events: trace.events.slice(from), hunter: trace.hunter.slice(hunterFrom) };
  };
  let currentLabel = null;
  const mountFor = ({ seed, difficulty, route, margin: m }) => {
    margin = m ?? 1;
    currentLabel = { seed, difficulty, route, margin: m };
    trace.events.length = 0;
    trace.hunter.length = 0;
    const run = RT.mount({ seed, difficulty, routeNumber: route });
    // The model is the MISSION's: on Routes 2 and 3 the portal waits for the passage, whatever the tree under test
    // does — so a tree whose portal opens on the lights alone disagrees with it (unless a mutant forces the old rule).
    const missionRule = solverRequirePassage === null ? route >= 2 : solverRequirePassage && route >= 2;
    dctx = run.state.mazeMap ? buildDynamicContext(run.state.mazeMap, difficulty, { requirePassage: missionRule }) : null;
    dctxOld = run.state.mazeMap ? buildDynamicContext(run.state.mazeMap, difficulty, { requirePassage: false }) : null;
    inspectRender(run.state);
    return run;
  };
  /** Try a scenario over seeds × modes × cautions; the first that plays through is the fixture. */
  const SEEDS = Array.from({ length: 40 }, (_, i) => 6_400 + i);
  const findFixture = (name, routes, scenario) => {
    const hint = fixturesHint?.[name];
    const attempts = hint
      ? [hint]
      : [1, 0, -1].flatMap((m) => SEEDS.flatMap((seed) => routes.flatMap((route) => DIFFICULTIES.map((difficulty) => ({ seed, difficulty, route, margin: m })))));
    for (const attempt of attempts) {
      const run = mountFor(attempt);
      if (!run.state.mazeMap || !linkOf(run.state.mazeMap)) continue;
      const outcome = scenario(run, linkOf(run.state.mazeMap));
      if (outcome) {
        margin = 1;
        return { ...attempt, run, ...outcome, sessionEvents: [...trace.events] };
      }
    }
    margin = 1;
    return null;
  };
  const types = (events) => events.map((e) => e.type);

  // =============================================================================================
  // fixtures
  // =============================================================================================

  /** lights → (early portal) → trap → portal → win. The scenario only walks; what happens is the checks'. */
  const lightsFirst = {};
  for (const route of [2, 3]) {
    lightsFirst[route] = findFixture(`lightsFirst${route}`, [route], (run, link) => {
      const trap = keyToCell(link.trap);
      if (!collectLights(run, [link.trap])) return null;
      const afterLights = run.state;
      const afterLightsView = { portalActive: afterLights.portalActive, objectives: afterLights.objectives ?? null, message: afterLights.message, status: afterLights.status };
      // visit the portal early (lights done, passage closed)
      let early = null;
      if (run.state.status === "playing" && walkTo(run, run.state.mazeMap.exitPosition, [link.trap])) {
        early = { status: run.state.status, message: run.state.message, completions: run.completions.length };
      }
      if (run.state.status !== "playing") return { afterLights: afterLightsView, early, trapStep: null, won: run.state.status === "won" };
      if (!walkBeside(run, trap)) return null;
      const wallStanding = run.state.walls.has(link.mutation.wall);
      const trapStep = tracedStep(run, trap);
      if (!sameCell(trapStep.after.player, trap)) return null;
      const trapView = { portalActive: trapStep.after.portalActive, objectives: trapStep.after.objectives ?? null, message: trapStep.after.message, status: trapStep.after.status, wallStanding };
      let won = false;
      let exitStep = null;
      if (run.state.status === "playing" && walkBeside(run, run.state.mazeMap.exitPosition)) {
        exitStep = tracedStep(run, run.state.mazeMap.exitPosition);
        won = run.state.status === "won";
      }
      return { afterLights: afterLightsView, early, trapStep: { events: trapStep.events, hunter: trapStep.hunter, view: trapView }, exitStep: exitStep && { events: types(exitStep.events) }, won };
    });
  }

  /** trap → (early portal) → lights → portal → win. */
  const passageFirst = findFixture("passageFirst", [2, 3], (run, link) => {
    const trap = keyToCell(link.trap);
    if (!walkBeside(run, trap)) return null;
    const trapStep = tracedStep(run, trap);
    if (!sameCell(trapStep.after.player, trap) || run.state.status !== "playing") return null;
    const trapView = { portalActive: trapStep.after.portalActive, objectives: trapStep.after.objectives ?? null, message: trapStep.after.message };
    let early = null;
    if (walkTo(run, run.state.mazeMap.exitPosition)) early = { status: run.state.status, message: run.state.message };
    if (run.state.status !== "playing") return null;
    if (!collectLights(run, [], { keepLast: true })) return null;
    const g = run.state;
    const last = g.mazeMap.collectibleStars.find((s) => !g.collectedSet.has(cellKey(s)));
    if (!last || !walkBeside(run, last)) return null;
    const lastStep = tracedStep(run, last);
    if (!lastStep.after.collectedSet.has(cellKey(last))) return null;
    const lastView = { portalActive: lastStep.after.portalActive, message: lastStep.after.message };
    let won = false;
    if (run.state.status === "playing" && walkBeside(run, run.state.mazeMap.exitPosition)) {
      step(run, run.state.mazeMap.exitPosition);
      won = run.state.status === "won";
    }
    return { trapStep: { events: trapStep.events, view: trapView }, early, lastStep: { events: lastStep.events, view: lastView }, won };
  });

  /** Chest → Pickaxe → the marked wall → lights → win. */
  const pickaxeFirst = findFixture("pickaxeFirst", [2, 3], (run, link) => {
    const map = run.state.mazeMap;
    const wall = keyToCell(link.mutation.wall);
    if (!map.chest || !walkTo(run, map.chest, [link.trap]) || !run.state.rewardChoicePending) return null;
    run.choose("pickaxe");
    if (run.state.status !== "playing" || !walkBeside(run, wall, [link.trap])) return null;
    if (!run.state.breakTargets.some(({ cell }) => sameCell(cell, wall))) return null;
    const before = run.state.objectives ?? null;
    const from = trace.events.length;
    run.break(wall);
    inspectRender(run.state);
    const breakEvents = trace.events.slice(from);
    const after = run.state;
    const breakView = { objectives: after.objectives ?? null, portalActive: after.portalActive, message: after.message, brokenWall: after.brokenWall };
    if (after.status !== "playing") return null;
    // then the trap, still asleep: it arms and opens nothing more
    if (!collectLights(run, [link.trap])) return null;
    let won = false;
    if (run.state.status === "playing" && walkBeside(run, run.state.mazeMap.exitPosition)) {
      step(run, run.state.mazeMap.exitPosition);
      won = run.state.status === "won";
    }
    return { before, breakEvents: types(breakEvents), breakView, won, rewardSelected: run.state.rewardSelected };
  });

  /** Chest → Pickaxe → lights → the marked wall (the final prerequisite) → win. */
  const pickaxeLast = findFixture("pickaxeLast", [2, 3], (run, link) => {
    const map = run.state.mazeMap;
    const wall = keyToCell(link.mutation.wall);
    if (!map.chest || !walkTo(run, map.chest, [link.trap]) || !run.state.rewardChoicePending) return null;
    run.choose("pickaxe");
    if (run.state.status !== "playing" || !collectLights(run, [link.trap])) return null;
    if (run.state.status !== "playing" || !walkBeside(run, wall, [link.trap])) return null;
    if (!run.state.breakTargets.some(({ cell }) => sameCell(cell, wall))) return null;
    const lightsBefore = run.state.objectives?.lights?.complete ?? run.state.collectedSet.size === map.collectibleStars.length;
    const portalBefore = run.state.portalActive;
    const from = trace.events.length;
    const hunterFrom = trace.hunter.length;
    run.break(wall);
    inspectRender(run.state);
    const breakEvents = trace.events.slice(from);
    const hunter = trace.hunter.slice(hunterFrom);
    const view = { portalActive: run.state.portalActive, message: run.state.message, status: run.state.status };
    let won = false;
    if (run.state.status === "playing" && walkBeside(run, run.state.mazeMap.exitPosition, [link.trap])) {
      step(run, run.state.mazeMap.exitPosition);
      won = run.state.status === "won";
    }
    return { lightsBefore, portalBefore, breakEvents, hunterOnOpened: hunter.every((h) => !h.walls.has(link.mutation.wall)) && hunter.length > 0, view, won };
  });

  /** Chest → Pickaxe → some OTHER wall. */
  const pickaxeOther = findFixture("pickaxeOther", [2, 3], (run, link) => {
    const map = run.state.mazeMap;
    if (!map.chest || !walkTo(run, map.chest, [link.trap]) || !run.state.rewardChoicePending) return null;
    run.choose("pickaxe");
    for (let i = 0; i < 14 && run.state.status === "playing"; i += 1) {
      const other = run.state.breakTargets.find(({ cell }) => cellKey(cell) !== link.mutation.wall);
      if (other) {
        const from = trace.events.length;
        run.break(other.cell);
        inspectRender(run.state);
        return { broken: cellKey(other.cell), linked: link.mutation.wall, events: types(trace.events.slice(from)), objectives: run.state.objectives ?? null, portalActive: run.state.portalActive, message: run.state.message };
      }
      const g = run.state;
      const near = [...g.walls].filter((w) => w !== link.mutation.wall).flatMap((w) => walkableNeighbours(keyToCell(w), g.walls)).sort((a, b) => manhattan(a, g.player) - manhattan(b, g.player))[0];
      if (!near || !stepToward(run, near, [link.trap])) break;
    }
    return null;
  });

  /** Chest → Second Chance → trap → lights → win. */
  const secondChance = findFixture("secondChance", [2, 3], (run, link) => {
    const map = run.state.mazeMap;
    const trap = keyToCell(link.trap);
    if (!map.chest || !walkTo(run, map.chest, [link.trap]) || !run.state.rewardChoicePending) return null;
    run.choose("second-chance");
    if (run.state.status !== "playing" || !walkBeside(run, trap)) return null;
    step(run, trap);
    if (!sameCell(run.state.player, trap) || run.state.status !== "playing") return null;
    const passage = run.state.objectives?.passage ?? null;
    if (!collectLights(run, [])) return null;
    if (run.state.status !== "playing" || !walkBeside(run, run.state.mazeMap.exitPosition)) return null;
    step(run, run.state.mazeMap.exitPosition);
    if (run.state.status !== "won") return null;
    return { passageAfterTrap: passage, won: true, rewardSelected: run.state.rewardSelected, pickaxeEverHeld: false };
  });

  /** The portal at once, nothing done. */
  const earlyNothing = findFixture("earlyNothing", [2, 3], (run, link) => {
    if (!walkTo(run, run.state.mazeMap.exitPosition, [link.trap])) return null;
    return { status: run.state.status, message: run.state.message, completions: run.completions.length, collected: run.state.collectedSet.size };
  });

  const fixtureSummary = Object.fromEntries(
    Object.entries({ lightsFirst2: lightsFirst[2], lightsFirst3: lightsFirst[3], passageFirst, pickaxeFirst, pickaxeLast, pickaxeOther, secondChance, earlyNothing }).map(([k, f]) => [
      k,
      f && { seed: f.seed, difficulty: f.difficulty, route: f.route, margin: f.margin },
    ]),
  );
  const need = (fixture, what) => {
    if (!fixture) throw new Error(`no ${what} fixture on this tree`);
    return fixture;
  };

  // =============================================================================================
  // O01 · Route 1 is v1-equivalent — against the mission's base, render by render
  // =============================================================================================
  await guarded("O01", "preserved", "ROUTE1_OBJECTIVE_V1_EQUIVALENT", () => {
    const BASE_RT = loadRouteRuntime({ directDifficulty: true, rev: OBJECTIVES_BASE, transforms: [INSTRUMENT] });
    BASE_RT.LAB.sb.__obj = { events: [], hunter: [] };
    const play = (rt, seed, difficulty) => {
      const run = rt.mount({ seed, difficulty, routeNumber: 1 });
      const box = rt.LAB.sb.__obj;
      box.events.length = 0;
      let lcg = seed >>> 0;
      const rand = () => ((lcg = (Math.imul(lcg, 1664525) + 1013904223) >>> 0) / 2 ** 32);
      const frames = [observe(run.state)];
      for (let i = 0; i < 140 && run.state.status === "playing"; i += 1) {
        const g = run.state;
        if (g.rewardChoicePending) {
          run.choose(rand() < 0.5 ? "pickaxe" : "second-chance");
        } else if (g.breakTargets.length && rand() < 0.3) {
          run.break(g.breakTargets[Math.floor(rand() * g.breakTargets.length)].cell);
        } else {
          const remaining = g.mazeMap.collectibleStars.filter((s) => !g.collectedSet.has(cellKey(s)));
          const trap = linkOf(g.mazeMap)?.trap;
          // sometimes the linked trap first, sometimes the lights, sometimes a random legal step
          const goal = rand() < 0.15 && trap && !g.triggeredTrapSet.has(trap) ? keyToCell(trap) : remaining[0] ?? g.mazeMap.exitPosition;
          const legal = walkableNeighbours(g.player, g.walls);
          const blocked = new Set([...g.walls, cellKey(g.guardian), cellKey(g.sentinel)]);
          blocked.delete(cellKey(goal));
          const route = pathBetween(g.player, goal, blocked);
          const next = rand() < 0.3 || !route || route.length < 2 ? legal[Math.floor(rand() * legal.length)] : route[1];
          if (!next) break;
          run.stepTo(next);
        }
        frames.push(observe(run.state));
      }
      return { frames, events: box.events.map((e) => JSON.stringify(e, (k, v) => (v instanceof Set ? [...v].sort() : v))), completion: JSON.stringify(run.completions), map: mapFields(run.state.mazeMap) };
    };
    let compared = 0;
    let frames = 0;
    let wins = 0;
    let portalActivations = 0;
    const divergences = [];
    for (const difficulty of DIFFICULTIES) {
      for (let i = 0; i < 12; i += 1) {
        const seed = 8_400_000 + i * 7;
        const a = play(RT, seed, difficulty);
        const b = play(BASE_RT, seed, difficulty);
        compared += 1;
        frames += a.frames.length;
        if (a.frames.at(-1)?.status === "won") wins += 1;
        portalActivations += a.events.filter((e) => e.includes('"PORTAL_ACTIVATED"')).length;
        if (a.map !== b.map || !sameJson(a.frames, b.frames) || !sameJson(a.events, b.events) || a.completion !== b.completion) {
          divergences.push({ seed, difficulty, map: a.map === b.map, at: a.frames.findIndex((f, k) => !sameJson(f, b.frames[k])) });
        }
      }
    }
    const plan = objectivesModule?.routeObjectivePlan?.(1)?.prerequisites ?? null;
    return { pass: divergences.length === 0 && compared === 36 && wins > 0 && (plan === null || sameJson([...plan], ["collect-all-lights"])), gamesCompared: compared, framesCompared: frames, wins, portalActivations, plan, divergences: divergences.slice(0, 3) };
  });

  // =============================================================================================
  // O02–O05 · the plans
  // =============================================================================================
  const planCheck = (route) => {
    const f = need(lightsFirst[route], `lights-first R${route}`);
    const run = RT.mount({ seed: f.seed, difficulty: f.difficulty, routeNumber: route });
    const plan = run.state.objectives?.plan?.prerequisites ?? null;
    return {
      pass: sameJson(plan && [...plan], ["collect-all-lights", "open-linked-passage"]) && f.afterLights.portalActive === false && f.afterLights.objectives?.lights?.complete === true,
      plan,
      allLightsCollectedPortalActive: f.afterLights.portalActive,
      fixture: fixtureSummary[`lightsFirst${route}`],
    };
  };
  await guarded("O02", "objectives", "ROUTE2_LIGHTS_AND_PASSAGE_PREREQUISITE", () => planCheck(2));
  await guarded("O03", "objectives", "ROUTE3_LIGHTS_AND_PASSAGE_PREREQUISITE", () => planCheck(3));

  await guarded("O04", "objectives", "OBJECTIVE_PLAN_USES_NO_RNG", () => {
    if (!objectivesModule) return { pass: false, module: "absent" };
    // The plan, asked with a Math.random that would throw, and asked again: a table, not a draw.
    const realMath = sb.Math;
    let threw = false;
    let plans;
    try {
      sb.Math = Object.assign(Object.create(Math), { random: () => { threw = true; throw new Error("drawn"); } });
      plans = [1, 2, 3, 1, 2, 3].map((n) => [...objectivesModule.routeObjectivePlan(n).prerequisites]);
    } finally {
      sb.Math = realMath;
    }
    // The hook reports the same plan for a Route on every seed and mode.
    const hookPlans = new Set();
    for (const route of ROUTES) for (const difficulty of DIFFICULTIES) for (const seed of [6_501, 6_502]) {
      const g = RT.mount({ seed, difficulty, routeNumber: route }).state;
      hookPlans.add(`${route}:${JSON.stringify(g.objectives?.plan?.prerequisites ?? null)}`);
    }
    // The maps themselves: the same seed gives the same map as on the mission's base (no new draw, no retry).
    const BASE_RT = loadRouteRuntime({ directDifficulty: true, rev: OBJECTIVES_BASE });
    let different = 0;
    let compared = 0;
    for (const route of ROUTES) for (const difficulty of DIFFICULTIES) for (let i = 0; i < 6; i += 1) {
      const seed = seedFor(route, difficulty, i);
      BASE_RT.LAB.setSeed(seed);
      const before = BASE_RT.API.generateMaze(difficulty, route);
      const now = generate(seed, difficulty, route);
      compared += 1;
      if (mapFields(before) !== mapFields(now)) different += 1;
    }
    return { pass: !threw && sameJson(plans.slice(0, 3), plans.slice(3)) && hookPlans.size === 3 && different === 0, randomDrawn: threw, plans: plans.slice(0, 3), hookPlans: [...hookPlans], mapsCompared: compared, mapsDifferentFromBase: different };
  });

  await guarded("O05", "objectives", "LINKED_PASSAGE_INITIALLY_INCOMPLETE", () => {
    const rows = [];
    for (const route of [2, 3]) for (const difficulty of DIFFICULTIES) for (const seed of [6_501, 6_502, 6_503]) {
      const g = RT.mount({ seed, difficulty, routeNumber: route }).state;
      const link = linkOf(g.mazeMap);
      rows.push({ wall: g.objectives?.passage?.wall ?? null, linked: link?.mutation.wall ?? null, standing: link ? g.walls.has(link.mutation.wall) : null, complete: g.objectives?.passage?.complete ?? null, portalActive: g.portalActive });
    }
    const bad = rows.filter((r) => r.wall !== r.linked || r.standing !== true || r.complete !== false || r.portalActive !== false);
    return { pass: rows.length === 18 && bad.length === 0, mounts: rows.length, bad: bad.slice(0, 3) };
  });

  // =============================================================================================
  // O06–O09 · what completes the passage
  // =============================================================================================
  await guarded("O06", "objectives", "TRAP_OPEN_COMPLETES_PASSAGE_OBJECTIVE", () => {
    const rows = [lightsFirst[2], lightsFirst[3]].filter((f) => f?.trapStep).map((f) => ({ route: f.route, wallStandingBefore: f.trapStep.view.wallStanding, passage: f.trapStep.view.objectives?.passage ?? null }));
    const p = need(passageFirst, "passage-first").trapStep.view.objectives?.passage ?? null;
    rows.push({ route: passageFirst.route, wallStandingBefore: true, passage: p });
    return { pass: rows.length >= 2 && rows.every((r) => r.wallStandingBefore && r.passage?.open === true && r.passage?.complete === true), rows };
  });

  await guarded("O07", "objectives", "PICKAXE_OPEN_OF_LINKED_WALL_COMPLETES_PASSAGE", () => {
    const f = need(pickaxeFirst, "Pickaxe-first");
    return {
      pass: f.before?.passage?.complete === false && f.breakView.objectives?.passage?.complete === true && f.breakView.objectives?.passage?.open === true && f.breakView.portalActive === false && f.breakView.message === MESSAGES.pickaxeLightsMissing,
      before: f.before?.passage ?? null,
      after: f.breakView.objectives?.passage ?? null,
      portalActive: f.breakView.portalActive,
      message: f.breakView.message,
      thenWon: f.won,
      fixture: fixtureSummary.pickaxeFirst,
    };
  });

  await guarded("O08", "objectives", "PICKAXE_OPEN_OF_ANOTHER_WALL_DOES_NOT", () => {
    const f = need(pickaxeOther, "Pickaxe-other-wall");
    return {
      pass: f.broken !== f.linked && f.objectives?.passage?.required === true && f.objectives.passage.complete === false && f.portalActive === false && !f.events.includes("PORTAL_ACTIVATED") && f.message === "Parede aberta. O caminho novo serve para todos.",
      broken: f.broken,
      linked: f.linked,
      passage: f.objectives?.passage ?? null,
      events: f.events,
    };
  });

  await guarded("O09", "objectives", "SECOND_CHANCE_PATH_REMAINS_VIABLE", () => {
    const f = need(secondChance, "Second Chance");
    return { pass: f.won && f.rewardSelected === "second-chance" && f.passageAfterTrap?.complete === true, won: f.won, reward: f.rewardSelected, passageAfterTrap: f.passageAfterTrap, fixture: fixtureSummary.secondChance };
  });

  // =============================================================================================
  // O10–O15 · the portal
  // =============================================================================================
  await guarded("O10", "objectives", "ALL_LIGHTS_ALONE_DO_NOT_ACTIVATE_PORTAL_R2_R3", () => {
    const rows = [2, 3].map((route) => {
      const f = lightsFirst[route];
      return f && { route, portalActive: f.afterLights.portalActive, lightsComplete: f.afterLights.objectives?.lights?.complete ?? null, message: f.afterLights.message, early: f.early };
    });
    return { pass: rows.every((r) => r && r.portalActive === false && r.lightsComplete === true && (r.early === null || r.early.status === "playing")), rows };
  });

  await guarded("O11", "objectives", "PASSAGE_ALONE_DOES_NOT_ACTIVATE_PORTAL", () => {
    const f = need(passageFirst, "passage-first");
    const v = f.trapStep.view;
    return { pass: v.portalActive === false && v.objectives?.passage?.complete === true && v.objectives?.lights?.complete === false && !types(f.trapStep.events).includes("PORTAL_ACTIVATED"), view: v, events: types(f.trapStep.events) };
  });

  await guarded("O12", "preserved", "FINAL_LIGHT_ACTIVATES_PORTAL_IF_PASSAGE_OPEN", () => {
    const f = need(passageFirst, "passage-first");
    const t = types(f.lastStep.events);
    const order = sameJson(t.slice(0, 3), ["EXPLORER_STEP_COMMITTED", "LIGHT_COLLECTED", "PORTAL_ACTIVATED"]);
    const defendersAfter = t.slice(3).every((x) => ["DEFENDERS_SETTLED", "EXPLORER_CAPTURED", "SECOND_CHANCE_USED", "ROUTE_ENDED"].includes(x));
    return { pass: order && defendersAfter && f.lastStep.view.portalActive === true && f.lastStep.view.message === "Portal ativado! Vá até a saída." && f.won, events: t, view: f.lastStep.view, won: f.won };
  });

  await guarded("O13", "objectives", "TRAP_ACTIVATES_PORTAL_IF_LIGHTS_COMPLETE", () => {
    const rows = [2, 3].map((route) => {
      const f = lightsFirst[route];
      if (!f?.trapStep) return null;
      const t = types(f.trapStep.events);
      const wall = linkOf(f.run.state.mazeMap).mutation.wall;
      return {
        route,
        events: t,
        order: sameJson(t.slice(0, 4), ["EXPLORER_STEP_COMMITTED", "TRAP_ARMED", "WALL_OPENED_BY_TRAP", "PORTAL_ACTIVATED"]),
        defendersAfter: t.slice(4).every((x) => ["DEFENDERS_SETTLED", "EXPLORER_CAPTURED", "SECOND_CHANCE_USED"].includes(x)),
        hunterOnNewTopology: f.trapStep.hunter.length > 0 && f.trapStep.hunter.every((h) => !h.walls.has(wall)),
        portalActive: f.trapStep.view.portalActive,
        message: f.trapStep.view.message,
        won: f.won,
      };
    });
    const ok = rows.filter(Boolean);
    return { pass: ok.length >= 1 && ok.every((r) => r.order && r.defendersAfter && r.hunterOnNewTopology && r.portalActive === true && r.message === MESSAGES.trapPortal) && ok.some((r) => r.won), rows };
  });

  await guarded("O14", "objectives", "PICKAXE_ACTIVATES_PORTAL_IF_LIGHTS_COMPLETE", () => {
    const f = need(pickaxeLast, "Pickaxe-last");
    const t = types(f.breakEvents);
    return {
      pass: f.lightsBefore === true && f.portalBefore === false && sameJson(t.slice(0, 2), ["WALL_OPENED", "PORTAL_ACTIVATED"]) && t.slice(2).every((x) => ["DEFENDERS_SETTLED", "EXPLORER_CAPTURED"].includes(x)) && f.hunterOnOpened && f.view.portalActive === true && f.view.message === MESSAGES.pickaxePortal,
      events: t,
      lightsBefore: f.lightsBefore,
      portalBefore: f.portalBefore,
      hunterOnOpenedMaze: f.hunterOnOpened,
      view: f.view,
      thenWon: f.won,
    };
  });

  await guarded("O15", "preserved", "PORTAL_ACTIVATED_FIRES_ONCE", () => {
    const sessions = [lightsFirst[2], lightsFirst[3], passageFirst, pickaxeFirst, pickaxeLast, secondChance].filter(Boolean).map((f) => {
      const count = f.sessionEvents.filter((e) => e.type === "PORTAL_ACTIVATED").length;
      const won = f.sessionEvents.some((e) => e.type === "ROUTE_ENDED" && e.outcome === "won");
      return { fixture: `${f.route}/${f.seed}`, count, won };
    });
    return { pass: sessions.length >= 4 && sessions.every((s) => s.count <= 1 && (!s.won || s.count === 1)) && sessions.some((s) => s.won), sessions };
  });

  // =============================================================================================
  // O16–O17 · the portal visited early
  // =============================================================================================
  await guarded("O16", "objectives", "EARLY_PORTAL_DOES_NOT_WIN", () => {
    const rows = [
      earlyNothing && { case: "nothing done", status: earlyNothing.status, completions: earlyNothing.completions },
      lightsFirst[2]?.early && { case: "lights done R2", status: lightsFirst[2].early.status, completions: lightsFirst[2].early.completions },
      lightsFirst[3]?.early && { case: "lights done R3", status: lightsFirst[3].early.status, completions: lightsFirst[3].early.completions },
      passageFirst?.early && { case: "passage done", status: passageFirst.early.status, completions: 0 },
    ].filter(Boolean);
    return { pass: rows.length >= 3 && rows.every((r) => r.status === "playing" && r.completions === 0), rows };
  });

  await guarded("O17", "objectives", "MISSING_OBJECTIVE_FEEDBACK_CORRECT_AND_CALM", () => {
    const seen = {
      bothMissing: earlyNothing?.message ?? null,
      passageMissing: lightsFirst[2]?.early?.message ?? lightsFirst[3]?.early?.message ?? null,
      lightsMissing: passageFirst?.early?.message ?? null,
      lightsDonePassageMissing: lightsFirst[2]?.afterLights?.message ?? lightsFirst[3]?.afterLights?.message ?? null,
      trapLightsMissing: passageFirst?.trapStep?.view?.message ?? null,
    };
    const wrong = Object.entries(seen).filter(([k, v]) => v !== MESSAGES[k]);
    const stressful = Object.values(MESSAGES).filter((m) => STRESSFUL.test(m));
    return { pass: wrong.length === 0 && stressful.length === 0, seen, wrong: wrong.map(([k]) => k), stressful };
  });

  // =============================================================================================
  // O18–O21 · restart and the journey
  // =============================================================================================
  await guarded("O18", "objectives", "RESTART_RESETS_DERIVED_OBJECTIVE_PROGRESS", () => {
    const f = need(passageFirst, "passage-first");
    // Replay the fixture to the point where both prerequisites hold, then restart.
    const run = RT.mount({ seed: f.seed, difficulty: f.difficulty, routeNumber: f.route });
    const link = linkOf(run.state.mazeMap);
    margin = f.margin;
    walkBeside(run, keyToCell(link.trap));
    step(run, keyToCell(link.trap));
    const progressed = run.state.objectives?.passage?.complete === true;
    margin = 1;
    run.restart();
    const g = run.state;
    const relink = linkOf(g.mazeMap);
    const fresh = g.status === "playing" && g.objectives?.passage?.required === true && g.objectives.passage.complete === false && g.objectives.lights.collected === 0 && g.portalActive === false && g.walls.has(relink.mutation.wall) && g.trapOpenedWalls.length === 0;
    return { pass: progressed && fresh, progressedBeforeRestart: progressed, after: { passage: g.objectives?.passage ?? null, lights: g.objectives?.lights ?? null, portalActive: g.portalActive } };
  });

  const journey = (() => {
    const out = [];
    let run = RT.mount({ seed: 6_601, difficulty: "easy", routeNumber: 1 });
    for (let hop = 0; hop < 3; hop += 1) {
      const g = run.state;
      out.push({ route: g.routeNumber, plan: g.objectives?.plan?.prerequisites ? [...g.objectives.plan.prerequisites] : null, passageComplete: g.objectives?.passage?.complete ?? null, portalActive: g.portalActive, wallStanding: linkOf(g.mazeMap) ? g.walls.has(linkOf(g.mazeMap).mutation.wall) : null });
      if (hop === 2) break;
      // Open the passage before leaving, so a leak would show on the next Route.
      const link = linkOf(g.mazeMap);
      if (link && walkBeside(run, keyToCell(link.trap)) && run.state.status === "playing") step(run, keyToCell(link.trap));
      out[out.length - 1].passageOpenedBeforeLeaving = run.state.objectives?.passage?.open ?? null;
      if (run.state.status === "playing") playToEnd(run, "lose");
      run = run.nextSession({ seed: 6_602 + hop });
    }
    return out;
  })();
  await guarded("O19", "objectives", "NEXT_ROUTE_GETS_ITS_OWN_OBJECTIVE_PLAN", () => {
    const f = lightsFirst[2];
    let fromWon = null;
    if (f?.won) {
      const next = f.run.nextSession({ seed: f.seed + 1 });
      const g = next.state;
      fromWon = { route: g.routeNumber, passageComplete: g.objectives?.passage?.complete ?? null, lights: g.objectives?.lights?.collected ?? null, portalActive: g.portalActive };
    }
    const fresh = journey.slice(1).every((j) => j.passageComplete === false && j.portalActive === false && j.wallStanding === true);
    return { pass: fresh && fromWon !== null && fromWon.route === 3 && fromWon.passageComplete === false && fromWon.lights === 0 && fromWon.portalActive === false, journey, afterAWonRoute2: fromWon };
  });
  await guarded("O20", "objectives", "ROUTE1_TO_ROUTE2_INTRODUCES_PASSAGE_REQUIREMENT", () => {
    const [r1, r2] = journey;
    return { pass: r1?.route === 1 && sameJson(r1.plan, ["collect-all-lights"]) && r2?.route === 2 && sameJson(r2.plan, ["collect-all-lights", "open-linked-passage"]) && r2.passageComplete === false, r1, r2 };
  });
  await guarded("O21", "objectives", "ROUTE2_TO_ROUTE3_PRESERVES_REQUIREMENT", () => {
    const [, r2, r3] = journey;
    return { pass: r2?.route === 2 && r3?.route === 3 && sameJson(r3.plan, ["collect-all-lights", "open-linked-passage"]) && r3.passageComplete === false && r3.wallStanding === true, r2, r3 };
  });

  // =============================================================================================
  // O22–O24 · one truth
  // =============================================================================================
  await guarded("O22", "objectives", "CURRENT_TOPOLOGY_IS_THE_PASSAGE_TRUTH", () => {
    if (!objectivesModule) return { pass: false, module: "absent", rendersInspected: renders.inspected };
    // The evaluator alone: the same map, the linked wall standing or not, nothing else changed.
    const map = generate(6_501, "medium", 2);
    const wall = linkOf(map).mutation.wall;
    const plan = objectivesModule.routeObjectivePlan(2);
    const all = map.collectibleStars.map(cellKey);
    const opened = new Set(map.walls);
    opened.delete(wall);
    const otherOpened = new Set(map.walls);
    otherOpened.delete([...map.walls].find((w) => w !== wall));
    const ev = (walls, stars) => objectivesModule.evaluateRouteObjectives({ plan, mazeMap: map, collectedStars: stars, walls });
    const table = {
      standing: ev(map.walls, all).passage.complete,
      opened: ev(opened, all).passage.complete,
      otherOpened: ev(otherOpened, all).passage.complete,
      openedNoLights: ev(opened, []).portalReady,
      standingAllLights: ev(map.walls, all).portalReady,
      openedAllLights: ev(opened, all).portalReady,
    };
    const unit = !table.standing && table.opened && !table.otherOpened && !table.openedNoLights && !table.standingAllLights && table.openedAllLights;
    return { pass: unit && renders.inspected > 200 && renders.passageMismatch === 0 && renders.portalMismatch === 0, table, rendersInspected: renders.inspected, passageMismatch: renders.passageMismatch, portalMismatch: renders.portalMismatch, examples: renders.examples };
  });

  await guarded("O23", "objectives", "NO_DUPLICATE_OBJECTIVE_STATE", () => {
    const now = textOf;
    const base = (file) => readFromRev(OBJECTIVES_BASE, file);
    const fieldsNow = declared(now(FILES.state), FILES.state, "RouteRuntimeState");
    const fieldsBase = declared(base(FILES.state), FILES.state, "RouteRuntimeState");
    const actionsNow = declared(now(FILES.state), FILES.state, "RouteStateAction", { tag: "type" });
    const actionsBase = declared(base(FILES.state), FILES.state, "RouteStateAction", { tag: "type" });
    const eventsNow = declared(now(FILES.events), FILES.events, "RouteDomainEvent", { tag: "type" });
    const eventsBase = declared(base(FILES.events), FILES.events, "RouteDomainEvent", { tag: "type" });
    const objectiveNamed = (fieldsNow ?? []).filter((f) => /objective|passage|portal|ready/i.test(f));
    // The objective truth must actually be derived: the hook evaluates the module, and the reducer never sees it.
    const hook = now(FILES.hook) ?? "";
    const derived = /evaluateRouteObjectives\(/.test(hook) && objectivesModule !== null;
    return {
      pass: derived && sameJson(fieldsNow, fieldsBase) && sameJson(actionsNow, actionsBase) && sameJson(eventsNow, eventsBase) && objectiveNamed.length === 0,
      derivedInTheHook: derived,
      stateFields: fieldsNow?.length ?? null,
      addedStateFields: (fieldsNow ?? []).filter((f) => !(fieldsBase ?? []).includes(f)),
      addedActions: (actionsNow ?? []).filter((f) => !(actionsBase ?? []).includes(f)),
      addedEvents: (eventsNow ?? []).filter((f) => !(eventsBase ?? []).includes(f)),
      objectiveNamedFields: objectiveNamed,
    };
  });

  await guarded("O24", "objectives", "OBJECTIVE_MODULE_IS_PURE", () => {
    const source = textOf(FILES.objectives);
    if (source === null) return { pass: false, module: "absent" };
    const sf = ts.createSourceFile(FILES.objectives, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
    const imports = sf.statements.filter(ts.isImportDeclaration).map((d) => ({ from: d.moduleSpecifier.text, typeOnly: Boolean(d.importClause?.isTypeOnly) }));
    const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }, fileName: FILES.objectives }).outputText;
    const code = js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
    const forbidden = [...new Set(code.match(/\brequire\(|Math\.random|\bwindow\b|\bdocument\b|localStorage|sessionStorage|indexedDB|\bWorker\b|postMessage|navigator|\bfetch\(|setTimeout|setInterval|Date\.now|performance\./g) ?? [])];
    let runs = false;
    try {
      const mod = { exports: {} };
      vm.runInNewContext(js, { module: mod, exports: mod.exports, Object, Number, Math: { min: Math.min, max: Math.max, floor: Math.floor } });
      runs = typeof mod.exports.evaluateRouteObjectives === "function" && mod.exports.routeObjectivePlan(2).prerequisites.length === 2;
    } catch {
      runs = false;
    }
    return { pass: imports.every((i) => i.typeOnly) && forbidden.length === 0 && runs, imports, forbidden, runsInABareRealm: runs };
  });

  // =============================================================================================
  // O25–O28 · the solver and the structure
  // =============================================================================================
  await guarded("O25", "objectives", "DYNAMIC_SOLVER_MODELS_PASSAGE_REQUIREMENT", () => {
    // The win transition itself, exactly: the Explorer one step from the exit with every light, the defenders far
    // away. With the model THIS tree's hook asks for on Routes 2/3, that step wins only when the linked trap's bit
    // (the passage, pre-Chest) is set; the old rule wins either way. Route 1 keeps the old rule.
    const rows = [];
    for (const route of ROUTES) for (const difficulty of DIFFICULTIES) for (const seed of [6_501, 6_502]) {
      const run = RT.mount({ seed, difficulty, routeNumber: route });
      const map = run.state.mazeMap;
      const required = requiresPassage(run.state);
      const ctx = buildDynamicContext(map, difficulty, { requirePassage: required });
      const id = (p) => p.row * 9 + p.col;
      const exit = map.exitPosition;
      const actionIndex = ACTIONS.findIndex((a) => {
        const from = { row: exit.row - a.row, col: exit.col - a.col };
        return from.row >= 0 && from.row < 9 && from.col >= 0 && from.col < 9 && !map.walls.has(cellKey(from));
      });
      const from = { row: exit.row - ACTIONS[actionIndex].row, col: exit.col - ACTIONS[actionIndex].col };
      const far = [...Array(81).keys()].map((k) => ({ row: Math.floor(k / 9), col: k % 9 }))
        .filter((c) => !map.walls.has(cellKey(c)) && manhattan(c, exit) >= 5 && manhattan(c, from) >= 4 && !map.traps.some((t) => sameCell(t, c)))
        .sort((a, b) => manhattan(b, exit) - manhattan(a, exit));
      const allLights = (1 << map.collectibleStars.length) - 1;
      const trapIndex = map.traps.findIndex((t) => cellKey(t) === linkOf(map).trap);
      const winOf = (traps) => Boolean(dynamicSuccessorSet(ctx, { e: id(from), h: id(far[0]), s: id(far[1]), t: -1, c: 0, lights: allLights, traps }, actionIndex)?.hasWin);
      rows.push({ route, difficulty, seed, required, passageClosedWins: winOf(0), passageOpenWins: winOf(1 << trapIndex) });
    }
    const ok = rows.every((r) => r.required === r.route >= 2 && r.passageOpenWins && r.passageClosedWins === !r.required);
    return { pass: ok, winsWithPassageClosed: rows.filter((r) => r.passageClosedWins).map((r) => r.route), rows: rows.filter((_, i) => i % 6 === 0) };
  });

  await guarded("O26", "objectives", "SOLVER_AND_HOOK_AGREE", () => ({
    pass: differential.transitions > 100 && differential.objectiveUnsound === 0 && differential.unsound === differential.heldDoorArmed + differential.defenderModelGap && differential.afterPassage > 0 && differential.wins > 0,
    ...differential,
  }));

  await guarded("O27", "structure", "ALL_1080_MAPS_STRUCTURALLY_COMPLETABLE", () => {
    const tallies = { maps: 0, standard: 0, dependent: 0, completable: 0, trapPath: 0, pickaxePath: 0, lightsFirst: 0, passageFirst: 0, impossible: 0, examples: [] };
    for (const route of ROUTES) for (const difficulty of DIFFICULTIES) for (let i = 0; i < 120; i += 1) {
      const seed = seedFor(route, difficulty, i);
      const map = generate(seed, difficulty, route);
      const s = objectiveStructure(map, { requirePassage: route >= 2 });
      tallies.maps += 1;
      if (route === 1) tallies.standard += 1;
      else {
        tallies.dependent += 1;
        if (s.trapPath) tallies.trapPath += 1;
        if (s.pickaxePath) tallies.pickaxePath += 1;
        if (s.orders.lightsFirst) tallies.lightsFirst += 1;
        if (s.orders.passageFirst) tallies.passageFirst += 1;
      }
      if (s.completable && s.portalReachableAfterPrerequisites && s.lightsReachable) tallies.completable += 1;
      else {
        tallies.impossible += 1;
        if (tallies.examples.length < 3) tallies.examples.push({ seed, route, difficulty });
      }
    }
    STRUCTURE.tallies = tallies;
    return { pass: tallies.maps === 1080 && tallies.completable === 1080 && tallies.trapPath === tallies.dependent && tallies.lightsFirst === tallies.dependent && tallies.passageFirst === tallies.dependent, ...tallies };
  });

  await guarded("O28", "structure", "NO_OBJECTIVE_CIRCULAR_DEPENDENCY", () => {
    let circular = 0;
    let trapNeedsPassage = 0;
    for (const route of [2, 3]) for (const difficulty of DIFFICULTIES) for (let i = 0; i < 120; i += 1) {
      const map = generate(seedFor(route, difficulty, i), difficulty, route);
      const s = objectiveStructure(map, { requirePassage: true });
      if (s.circular) circular += 1;
      if (!s.trapReachable) trapNeedsPassage += 1;
    }
    // The plan itself: the portal is no prerequisite, and neither prerequisite waits for the other.
    let planAcyclic = true;
    let independent = true;
    if (objectivesModule) {
      for (const n of ROUTES) planAcyclic &&= !objectivesModule.routeObjectivePlan(n).prerequisites.includes("reach-portal");
      const map = generate(6_501, "easy", 2);
      const plan = objectivesModule.routeObjectivePlan(2);
      const opened = new Set(map.walls);
      opened.delete(linkOf(map).mutation.wall);
      const ev = (walls, stars) => objectivesModule.evaluateRouteObjectives({ plan, mazeMap: map, collectedStars: stars, walls }).missing;
      independent = sameJson(ev(opened, []), ["collect-all-lights"]) && sameJson(ev(map.walls, map.collectibleStars.map(cellKey)), ["open-linked-passage"]);
    }
    return { pass: circular === 0 && trapNeedsPassage === 0 && planAcyclic && independent, mapsWithPassage: 720, circular, trapReachableOnlyThroughItsWall: trapNeedsPassage, planAcyclic, prerequisitesIndependent: independent, moduleOnThisTree: objectivesModule !== null };
  });

  // =============================================================================================
  // O29–O30 · nothing else moved
  // =============================================================================================
  await guarded("O29", "preserved", "HOME_GAME03_CIRCUITO_UNAFFECTED", () => {
    const target = rev ?? "HEAD";
    const changed = execFileSync("git", ["diff", "--name-only", OBJECTIVES_BASE, ...(rev ? [rev] : []), "--", "src/"], { encoding: "utf8" }).split("\n").filter(Boolean);
    const untracked = rev ? [] : execFileSync("git", ["ls-files", "--others", "--exclude-standard", "src/"], { encoding: "utf8" }).split("\n").filter(Boolean);
    const outside = [...changed, ...untracked].filter((f) => !f.startsWith(ROTA));
    return { pass: outside.length === 0, comparedWith: target, srcFilesChanged: changed.length + untracked.length, outsideTheRota: outside };
  });

  await guarded("O30", "preserved", "NO_TIMER_SCORE_OR_NEW_REWARD", () => {
    const now = (file) => textOf(file) ?? "";
    const base = (file) => readFromRev(OBJECTIVES_BASE, file) ?? "";
    const count = (text, re) => (text.match(re) ?? []).length;
    const timers = /\bset(Timeout|Interval)\(|requestAnimationFrame\(/g;
    const rotaFiles = [FILES.hook, FILES.objectives, `${ROTA}RouteStrategyGame.tsx`];
    const timersNow = rotaFiles.reduce((n, f) => n + count(now(f), timers), 0);
    const timersBase = rotaFiles.reduce((n, f) => n + count(base(f), timers), 0);
    const scoreCalls = (text) => (text.match(/calculateEscapeMazeScore\(\{[\s\S]*?\}\)/g) ?? []).map((c) => c.replace(/\s+/g, " "));
    const rewardsNow = declared(now(FILES.invariants), FILES.invariants, "ChestReward");
    const rewardsBase = declared(base(FILES.invariants), FILES.invariants, "ChestReward");
    return {
      pass: timersNow === timersBase && now(FILES.scoring) === base(FILES.scoring) && sameJson(scoreCalls(now(FILES.hook)), scoreCalls(base(FILES.hook))) && sameJson(rewardsNow, rewardsBase),
      timersNow,
      timersBase,
      scoringModuleUnchanged: now(FILES.scoring) === base(FILES.scoring),
      scoreCallsUnchanged: sameJson(scoreCalls(now(FILES.hook)), scoreCalls(base(FILES.hook))),
      chestRewards: rewardsNow,
    };
  });

  return { results, fixtureSummary };
}

const STRUCTURE = {};

/** A packed solver key back into its fields (rota2-dynamic-solver.mjs `packFields`, in reverse). */
function decodeKey(dctx, key) {
  const m = dctx.closed.packed;
  let x = key;
  const traps = x % m.trapRadix;
  x = (x - traps) / m.trapRadix;
  const lights = x % m.lightRadix;
  x = (x - lights) / m.lightRadix;
  const c = x % 4;
  x = (x - c) / 4;
  const t = (x % m.targetRadix) - 1;
  x = (x - (t + 1)) / m.targetRadix;
  const s = x % 81;
  x = (x - s) / 81;
  const h = x % 81;
  return { e: (x - h) / 81, h, s, t, c, lights, traps };
}

// =================================================================================================
// mutants — in-memory edits of today's tree; each must fail a check it targets
// =================================================================================================

const edit = (from, to, id) => (source) => {
  if (source.split(from).length !== 2) throw new Error(`mutant ${id}: anchor not found exactly once`);
  return source.replace(from, to);
};
const chain = (...fns) => (source) => fns.reduce((s, fn) => fn(s), source);
const HOOK = `${ROTA}useEscapeMaze.ts`;
const OBJ = `${ROTA}route-objectives.ts`;
const STATE = `${ROTA}route-state.ts`;
const MUTANTS_LIST = [
  { id: "M01", name: "Route 1 accidentally requires the passage", targets: ["O01"], transforms: { [OBJ]: edit("    1: STANDARD_PLAN,", "    1: LIGHTS_AND_PASSAGE_PLAN,", "M01") } },
  { id: "M02", name: "Route 2 forgets the passage requirement", targets: ["O02", "O10"], transforms: { [OBJ]: edit("    2: LIGHTS_AND_PASSAGE_PLAN,", "    2: STANDARD_PLAN,", "M02") } },
  { id: "M03", name: "Route 3 forgets the passage requirement", targets: ["O03", "O21"], transforms: { [OBJ]: edit("    3: LIGHTS_AND_PASSAGE_PLAN,", "    3: STANDARD_PLAN,", "M03") } },
  { id: "M04", name: "all lights activate the portal regardless of the passage", targets: ["O10", "O02"], transforms: { [OBJ]: edit("    portalReady: missing.length === 0,", "    portalReady: lightsComplete,", "M04") } },
  { id: "M05", name: "the passage activates the portal regardless of the lights", targets: ["O11"], transforms: { [OBJ]: edit("    portalReady: missing.length === 0,", "    portalReady: missing.length === 0 || (required && open),", "M05") } },
  {
    id: "M06", name: "only the trap counts — the Pickaxe wrongly ignored", targets: ["O07", "O14"],
    transforms: { [HOOK]: edit(`        collectedStars,
        walls: opened,
      });`, `        collectedStars,
        walls,
      });`, "M06") },
  },
  {
    id: "M07", name: "any Pickaxe wall counts as the passage", targets: ["O08"],
    transforms: { [OBJ]: edit("  const open = wall === null || !walls.has(wall);", "  const open = wall === null || !walls.has(wall) || walls.size < (mazeMap as { walls?: Set<string> }).walls!.size;", "M07") },
  },
  {
    // Only the Pickaxe's wall is read: the trap's opening no longer counts, so a Route without the Pickaxe (Second
    // Chance) can never open its portal.
    id: "M08", name: "the Second Chance route becomes impossible (only the Pickaxe opens the passage)", targets: ["O09"],
    transforms: { [HOOK]: chain(
      edit(`      collectedStars,
      walls,
    });
    const passageRequired`, `      collectedStars,
      walls: currentWalls(mazeMap.walls, brokenWall),
    });
    const passageRequired`, "M08 render"),
      edit(`        collectedStars: nextCollectedStars,
        walls: turnWalls,
      });`, `        collectedStars: nextCollectedStars,
        walls: currentWalls(mazeMap.walls, brokenWall),
      });`, "M08 step"),
    ) },
  },
  {
    id: "M09", name: "the portal can win early", targets: ["O16", "O10"],
    transforms: { [HOOK]: edit("      if (positionsEqual(next, mazeMap.exitPosition) && nextPortalActive) {", "      if (positionsEqual(next, mazeMap.exitPosition) && (nextPortalActive || nextObjectives.lights.complete)) {", "M09") },
  },
  {
    id: "M10", name: "PORTAL_ACTIVATED emitted twice", targets: ["O15", "O12", "O13"],
    transforms: { [HOOK]: edit(`      if (portalActivatedNow) {
        applyDomainEvent({ type: "PORTAL_ACTIVATED", turn: nextTurn });
      }

      if (positionsEqual`, `      if (portalActivatedNow || (collectedStar && nextObjectives.lights.complete)) {
        applyDomainEvent({ type: "PORTAL_ACTIVATED", turn: nextTurn });
      }

      if (positionsEqual`, "M10") },
  },
  {
    id: "M11", name: "objective state duplicated in the reducer", targets: ["O23"],
    transforms: { [STATE]: edit("  trapOpenedWalls: string[];\n}", "  trapOpenedWalls: string[];\n  passageObjectiveDone?: boolean;\n}", "M11") },
  },
  { id: "M12", name: "the objective plan uses Math.random", targets: ["O04"], transforms: { [OBJ]: edit("  return ROUTE_OBJECTIVE_PLANS[route as 1 | 2 | 3];", "  return Math.random() < 2 ? ROUTE_OBJECTIVE_PLANS[route as 1 | 2 | 3] : STANDARD_PLAN;", "M12") } },
  { id: "M13", name: "the objective evaluator imports React", targets: ["O24"], transforms: { [OBJ]: edit('import type { MazeMap } from "@/games/escape-maze/route-generation";', 'import type { MazeMap } from "@/games/escape-maze/route-generation";\nimport { useMemo } from "react";\nvoid useMemo;', "M13") } },
  { id: "M14", name: "the solver still uses the old win condition", targets: ["O25", "O26"], solverRequirePassage: false },
  {
    id: "M15", name: "restart leaks objective completion", targets: ["O18"],
    transforms: { [OBJ]: chain(
      edit("export function evaluateRouteObjectives({", "let passageSeen = new Set<unknown>();\nexport function evaluateRouteObjectives({", "M15 module"),
      edit("  const open = wall === null || !walls.has(wall);", "  if (wall !== null && !walls.has(wall)) passageSeen.add(wall);\n  const open = wall === null || !walls.has(wall) || passageSeen.size > 0;\n  void (passageSeen = passageSeen);", "M15 open"),
    ) },
  },
  {
    id: "M16", name: "the next Route inherits objective state", targets: ["O19", "O21"],
    transforms: { [OBJ]: chain(
      edit("export function evaluateRouteObjectives({", "let anyPassageOpened = false;\nexport function evaluateRouteObjectives({", "M16 module"),
      edit("  const passageComplete = !required || open;", "  if (required && open) anyPassageOpened = true;\n  const passageComplete = !required || open || anyPassageOpened;", "M16 complete"),
    ) },
  },
];

// =================================================================================================
// main
// =================================================================================================

async function main() {
  if (MUTANTS) {
    console.log("ROTA2 dependent objectives — mutants (each must be caught by a check it targets)\n");
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
        const run = await runSuite({ quiet: true, transforms: mutant.transforms ?? [], solverRequirePassage: mutant.solverRequirePassage ?? null, fixturesHint: clean.fixtureSummary });
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
    console.log(caught === rows.length ? "ROTA2_OBJECTIVES_MUTANTS_CAUGHT" : "ROTA2_OBJECTIVES_MUTANTS_MISSED");
    return caught === rows.length ? EXIT_OK : EXIT_VALIDATION_FAILED;
  }

  if (REV) {
    console.log(`ROTA2 dependent objectives — counterfactual on ${REV}: every [objectives] check must FAIL, every [preserved]/[structure] check must PASS\n`);
    const { results } = await runSuite({ rev: REV });
    const wrong = results.filter((r) => (r.tag === "objectives" ? r.pass : !r.pass));
    const n = (tag, pass) => results.filter((r) => r.tag === tag && r.pass === pass).length;
    const all = (tag) => results.filter((r) => r.tag === tag).length;
    console.log(`\nobjectives failing ${n("objectives", false)}/${all("objectives")} · preserved holding ${n("preserved", true)}/${all("preserved")} · structure holding ${n("structure", true)}/${all("structure")}`);
    if (wrong.length) console.log(`unexpected: ${wrong.map((r) => `${r.id}(${r.pass ? "passed" : "failed"})`).join(", ")}`);
    console.log(wrong.length === 0 ? "ROTA2_OBJECTIVES_COUNTERFACTUAL_HOLDS" : "ROTA2_OBJECTIVES_COUNTERFACTUAL_BROKEN");
    return wrong.length === 0 ? EXIT_OK : EXIT_VALIDATION_FAILED;
  }

  const started = performance.now();
  const { results, fixtureSummary } = await runSuite();
  const passed = results.filter((r) => r.pass).length;
  const allPass = passed === results.length;
  console.log(`\n${passed}/${results.length} passed${allPass ? "" : ` · failing: ${results.filter((r) => !r.pass).map((r) => r.id).join(", ")}`}`);
  console.log(allPass ? "ROTA2_OBJECTIVES_TESTS_OK" : "ROTA2_OBJECTIVES_TESTS_FAILED");
  const EVIDENCE = openEvidence(process.env.ROUTE_VALIDATION_OUT ?? "docs/archive/rota2-dependent-objectives-02");
  EVIDENCE.write(
    "dependent-objectives-tests.json",
    {
      mission: "ROTA2-DEPENDENT-OBJECTIVES-02",
      base: OBJECTIVES_BASE,
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
