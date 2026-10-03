/**
 * ROUTE-JOURNEY-OWNERSHIP-01 — one owner for "where the journey goes next".
 *
 * After GAME-CONTINUATION-CONTRACT-01 the product moved on through one path:
 *
 *   useEscapeMaze#endGame → GameResult.continuation → result screen →
 *   app/page.tsx#playAgain → a NEW session of the Rota on that continuation.
 *
 * A second one lived inside the game: `useEscapeMaze#continueJourney`, behind
 * a "next route" button RouteStrategyGame rendered once a Route was won or
 * lost. In the product it was dead — the shell takes the game off the screen
 * in the same update that saves the result, so the button was never attached
 * (route-journey-ownership-browser-probe.mjs shows it in a real DOM) — but it
 * shipped, and in /lab/route-launcher, where the game stays mounted, it moved
 * the Route on inside the session, with no result and no continuation.
 *
 * Checks marked [ownership] are what this mission establishes; [preserved] ones
 * pin what must not move (and hold on d258077 too). Everything runs the REAL
 * code: the hook through route-runtime-harness, RouteStrategyGame rendered by
 * real React (react-dom/server) over a stubbed hook, the launcher page driven
 * through a small hooks shim, and the sources read as TypeScript.
 *
 * Usage: node tools/validation/route-journey-ownership-tests.mjs [--rev=<commit>]
 *
 *   --rev=<commit>  every source as it was at <commit>, read with `git show`.
 *                   `--rev=d258077` (the internal path still there) must fail
 *                   every [ownership] check and hold every [preserved] one.
 *
 * Writes nothing. Exit 0 = every check holds, 1 = a check failed, 3 = usage error.
 *
 * Where a journey ends is ROUTE-JOURNEY-TERMINAL-01 (route-journey-terminal-tests.mjs):
 * three Routes, Route 3 lost resumes Route 3, Route 3 won completes the journey.
 * The rule itself lives in `continuation.ts#nextJourneyRoute`, which is now the
 * one place a Route is followed by `routeNumber + 1` (O3); the Route-to-Route
 * hops held here (P1) are Routes 1 and 2, the ones that existed before the end.
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";
import { loadRouteRuntime, playToEnd } from "./route-runtime-harness.mjs";

const FILES = {
  hook: "src/games/escape-maze/useEscapeMaze.ts",
  rota: "src/games/escape-maze/RouteStrategyGame.tsx",
  routeContinuation: "src/games/escape-maze/continuation.ts",
  launcher: "src/app/lab/route-launcher/page.tsx",
  storage: "src/engine/storage.ts",
  page: "src/app/page.tsx",
  screen: "src/components/GameScreen.tsx",
};
const MODES = ["easy", "medium", "hard"];
const ROUTE_KIND = "escape-maze-route";

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
if (args.some((arg) => arg !== revArg) || REV === "") {
  console.error("usage: node tools/validation/route-journey-ownership-tests.mjs [--rev=<commit>]");
  process.exit(EXIT_USAGE);
}
if (REV) {
  try {
    execFileSync("git", ["rev-parse", "--verify", `${REV}^{commit}`], { stdio: "ignore" });
  } catch {
    console.error(`unknown revision ${REV}`);
    process.exit(EXIT_USAGE);
  }
}

const readSource = (file) =>
  REV
    ? execFileSync("git", ["show", `${REV}:${file}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    : fs.readFileSync(path.resolve(file), "utf8");
const exists = (file) => {
  try {
    readSource(file);
    return true;
  } catch {
    return false;
  }
};

// --- evaluating real modules -----------------------------------------------------------------

const nodeRequire = createRequire(import.meta.url);
/** Compile a source file and run it as CommonJS; `modules` answers its imports, then node_modules. */
function evaluate(file, modules) {
  const { outputText } = ts.transpileModule(readSource(file), {
    fileName: file,
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const cjs = { exports: {} };
  const require = (specifier) => {
    if (specifier in modules) return modules[specifier];
    if (specifier.endsWith(".css")) return {};
    if (specifier.startsWith("@/") || specifier.startsWith(".")) {
      throw new Error(`${file}: ${specifier} is not provided to this stage`);
    }
    return nodeRequire(specifier);
  };
  vm.runInNewContext(outputText, { module: cjs, exports: cjs.exports, require, console, process }, { filename: file });
  return cjs.exports;
}

// --- checks ------------------------------------------------------------------------------------

const tests = [];
const record = (id, kind, name, pass, detail) => {
  tests.push({ id, kind, name, pass });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} [${kind}] — ${name}`);
  for (const [k, v] of Object.entries(detail)) {
    console.log(`        ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  }
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const RUNTIME = loadRouteRuntime({ hookSource: REV ? readSource(FILES.hook) : undefined });

/**
 * A session the way the product opens one: on a continuation (or none, a fresh
 * entry), at the setup screen. `start` presses "Iniciar rota".
 */
const open = (continuation, seed, start = false) =>
  RUNTIME.mount({
    seed,
    routeNumber: continuation?.routeNumber,
    difficulty: continuation?.difficulty,
    initialDifficulty: continuation?.difficulty,
    autoStart: start,
  });
const entry = (routeNumber, difficulty) => ({ kind: ROUTE_KIND, routeNumber, difficulty });

/** A Route played to the wanted end. Maps are random, so the seed is searched; the end is not chosen any other way. */
const finished = new Map();
function finish(continuation, outcome, seedBase) {
  const cacheKey = JSON.stringify([continuation, outcome]);
  const replay = (seed) => {
    const run = open(continuation, seed, true);
    return playToEnd(run, outcome === "won" ? "win" : "lose") === outcome ? run : null;
  };
  if (finished.has(cacheKey)) return replay(finished.get(cacheKey));
  for (let seed = seedBase; seed < seedBase + 200; seed += 1) {
    const run = replay(seed);
    if (run) {
      finished.set(cacheKey, seed);
      return run;
    }
  }
  return null;
}

// O1 — no way forward inside a session: every function the hook hands the game, called in every state a session
// can be in, leaves the Route where it is. Enumerated from the hook's own return value, so a new one is covered too.
{
  const from = entry(2, "medium");
  const contexts = {
    setup: () => open(from, 41_000),
    playing: () => open(from, 41_000, true),
    won: () => finish(from, "won", 42_000),
    lost: () => finish(from, "lost", 43_000),
  };
  const CALLS = {
    startGame: [[]],
    restartGame: [[]],
    changeDifficulty: MODES.map((mode) => [mode]),
    tryMovePlayer: [[{ row: -1, col: 0 }], [{ row: 1, col: 0 }], [{ row: 0, col: -1 }], [{ row: 0, col: 1 }]],
    chooseReward: [["pickaxe"], ["second-chance"]],
    breakWall: [[{ row: 1, col: 1 }]],
  };
  const handedToTheGame = open(from, 41_000).state;
  const api = Object.keys(handedToTheGame).filter((name) => typeof handedToTheGame[name] === "function").sort();
  const advances = [];
  const unreached = [];
  let calls = 0;
  for (const [state, make] of Object.entries(contexts)) {
    for (const name of api) {
      for (const callArgs of CALLS[name] ?? [[]]) {
        const run = make();
        if (!run) {
          unreached.push(state);
          continue;
        }
        const before = run.state.routeNumber;
        try {
          run.act((g) => g[name](...callArgs));
        } catch {
          // a refusal is not a way forward
        }
        calls += 1;
        if (run.state.routeNumber !== before) {
          advances.push({ state, call: `${name}(${callArgs.map((a) => JSON.stringify(a)).join(", ")})`, from: before, to: run.state.routeNumber });
        }
      }
    }
  }
  record("O1", "ownership", "NO_WAY_FORWARD_INSIDE_A_SESSION", advances.length === 0 && unreached.length === 0 && calls > 0, {
    api,
    callsMade: calls,
    routeAdvancedBy: advances,
    statesNotReached: [...new Set(unreached)],
  });
}

// O2 — a finished Route renders no way forward of its own: the real RouteStrategyGame, rendered by real React, offers
// no control once the Route is won or lost that it did not offer while it was being set up or played.
const ROTA_STATE = {
  difficulty: "medium",
  routeNumber: 3,
  routeProgression: { label: "Rota em construção", description: "Uma rota calma." },
  mazeMap: { walls: new Set(["1,1"]), exitPosition: { row: 0, col: 8 }, collectibleStars: [{ row: 4, col: 4 }], traps: [], chest: null },
  walls: new Set(["1,1"]),
  player: { row: 8, col: 0 },
  guardian: { row: 0, col: 0 },
  sentinel: { row: 0, col: 7 },
  sentinelTarget: null,
  collectedSet: new Set(),
  collectedCount: 0,
  totalLights: 1,
  portalActive: false,
  turns: 0,
  blockedMoves: 0,
  errors: 0,
  message: "",
  score: 0,
  blockedShake: 0,
  triggeredTrapSet: new Set(),
  trapsTriggered: 0,
  chestOpened: false,
  rewardSelected: null,
  rewardChoicePending: false,
  pickaxeAvailable: false,
  pickaxeSpent: false,
  secondChanceAvailable: false,
  secondChanceSpent: false,
  brokenWall: null,
  breakTargets: [],
};
{
  const React = nodeRequire("react");
  const { renderToStaticMarkup } = nodeRequire("react-dom/server");
  let state = null;
  const rotaModule = evaluate(FILES.rota, {
    "@/lib/feedback-motion": { gentleShakeAnimate: {} },
    ...(exists(FILES.routeContinuation) && {
      "@/games/escape-maze/continuation": evaluate(FILES.routeContinuation, {}),
    }),
    "@/games/escape-maze/useEscapeMaze": {
      COLS: 9,
      ROWS: 9,
      posKey: (p) => `${p.row},${p.col}`,
      // Whatever the hook hands back in that state; every function is inert here.
      useEscapeMaze: () => new Proxy(state, { get: (target, key) => (key in target ? target[key] : () => {}) }),
    },
    "@/components/worlds/master-scene/worldMasterSceneConfig": { getWorldMasterSceneStyle: () => ({}) },
  });
  const controls = (status) => {
    state = { ...ROTA_STATE, status };
    const html = renderToStaticMarkup(React.createElement(rotaModule.RouteStrategyGame, { onComplete: () => {}, onExit: () => {} }));
    return [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)]
      .map(([, attrs, inner]) => /aria-label="([^"]*)"/.exec(attrs)?.[1] ?? inner.replace(/<[^>]+>/g, "").trim())
      .sort();
  };
  const during = new Set([...controls("setup"), ...controls("playing")]);
  const onlyOnceEnded = Object.fromEntries(
    ["won", "lost"].map((status) => [status, controls(status).filter((label) => !during.has(label))]),
  );
  record("O2", "ownership", "FINISHED_ROUTE_RENDERS_NO_WAY_FORWARD", same(onlyOnceEnded, { won: [], lost: [] }) && during.size > 0, {
    controlsWhileSetUpOrPlayed: [...during].length,
    controlsThatAppearOnlyOnceEnded: onlyOnceEnded,
  });
}

// O3 — one producer of the next Route, read from the product's sources (labs aside): the only place a Route
// continuation is built is endGame; the hook's Route has no setter; no `continueJourney`; `routeNumber + 1` only in
// the journey's rule, `continuation.ts#nextJourneyRoute`, which endGame writes from and RouteStrategyGame shows from.
const SRC_FILES = (
  REV
    ? execFileSync("git", ["ls-tree", "-r", "--name-only", REV, "src"], { encoding: "utf8" })
    : execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "src"], { encoding: "utf8" })
)
  .split("\n")
  .filter((file) => /\.(ts|tsx)$/.test(file));
const PRODUCT_FILES = SRC_FILES.filter((file) => !file.startsWith("src/app/lab/"));
const parse = (file) =>
  ts.createSourceFile(file, readSource(file), ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
/** Name of the nearest enclosing named function (`const f = () =>`, `useCallback(() =>`, `function f`). */
function ownerOf(node) {
  for (let at = node.parent; at; at = at.parent) {
    if (ts.isFunctionDeclaration(at) && at.name) return at.name.text;
    if (ts.isArrowFunction(at) || ts.isFunctionExpression(at)) {
      const holder = ts.isCallExpression(at.parent) ? at.parent.parent : at.parent;
      if (holder && ts.isVariableDeclaration(holder) && ts.isIdentifier(holder.name)) return holder.name.text;
    }
  }
  return "(module)";
}
{
  const producers = [];
  const advances = [];
  const continueJourney = [];
  const routeSetters = [];
  for (const file of PRODUCT_FILES) {
    const sf = parse(file);
    const visit = (node) => {
      if (ts.isObjectLiteralExpression(node)) {
        const kind = node.properties.find(
          (p) => ts.isPropertyAssignment(p) && p.name.getText(sf) === "kind" && ts.isStringLiteral(p.initializer) && p.initializer.text === ROUTE_KIND,
        );
        if (kind) producers.push(`${file}#${ownerOf(node)}`);
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
        /(^|\.)routeNumber$/.test(node.left.getText(sf)) &&
        node.right.getText(sf) === "1"
      ) {
        advances.push(`${file}#${ownerOf(node)}`);
      }
      if (ts.isIdentifier(node) && node.text === "continueJourney") continueJourney.push(`${file}#${ownerOf(node)}`);
      if (ts.isIdentifier(node) && /^setRouteNumber$/.test(node.text)) routeSetters.push(`${file}#${ownerOf(node)}`);
      if (
        ts.isVariableDeclaration(node) &&
        ts.isArrayBindingPattern(node.name) &&
        node.name.elements[0]?.getText(sf) === "routeNumber" &&
        node.name.elements.length > 1
      ) {
        routeSetters.push(`${file}#${node.name.elements[1].getText(sf)}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  const actual = {
    continuationProducers: [...new Set(producers)].sort(),
    routeNumberPlusOne: [...new Set(advances)].sort(),
    routeSetters: [...new Set(routeSetters)].sort(),
    continueJourney: [...new Set(continueJourney)].sort(),
  };
  const expected = {
    continuationProducers: [`${FILES.hook}#endGame`],
    routeNumberPlusOne: [`${FILES.routeContinuation}#nextJourneyRoute`],
    routeSetters: [],
    continueJourney: [],
  };
  record("O3", "ownership", "ONE_PRODUCER_OF_THE_NEXT_ROUTE", same(actual, expected), { productFiles: PRODUCT_FILES.length, ...actual });
}

// O4 — the lab moves on through the contract too: once a Route ends (the game still on screen), the launcher's
// "Próxima rota" opens a NEW session on exactly the continuation the result carries, re-armed with the same seed. The
// launcher's default is Route 3, lost here, so that continuation is Route 3 again ("Repetir rota", since
// ROUTE-JOURNEY-TERMINAL-01).
{
  const finishedRun = finish(entry(3, "hard"), "lost", 44_000);
  const result = finishedRun?.completions.at(-1) ?? null;
  // A small React for one function component: ordered hook cells, re-render on demand.
  const cells = [];
  let index = 0;
  const hooks = {
    useState: (initial) => {
      const i = index++;
      if (!(i in cells)) cells[i] = { value: typeof initial === "function" ? initial() : initial };
      return [cells[i].value, (next) => (cells[i].value = typeof next === "function" ? next(cells[i].value) : next)];
    },
    useCallback: (fn) => (index++, fn),
    useEffect: () => void index++,
  };
  const GameScreen = () => null;
  const armed = [];
  const launcherModule = evaluate(FILES.launcher, {
    react: { ...nodeRequire("react"), ...hooks },
    "@/components/GameScreen": { GameScreen },
    "@/engine/route-random": { armRouteRandomSeed: (seed) => armed.push(seed), clearRouteRandomSeed: () => {}, getArmedRouteSeed: () => armed.at(-1) ?? null },
    "@/engine/storage": evaluate(FILES.storage, {}),
    ...(exists(FILES.routeContinuation) && {
      "@/games/escape-maze/continuation": evaluate(FILES.routeContinuation, {}),
    }),
  });
  const render = () => ((index = 0), launcherModule.default({}));
  const elements = (node, found = []) => {
    if (Array.isArray(node)) node.forEach((child) => elements(child, found));
    else if (node && typeof node === "object" && "props" in node) {
      found.push(node);
      elements(node.props.children, found);
    }
    return found;
  };
  const textOf = (el) => [el.props.children].flat(Infinity).filter((c) => typeof c === "string" || typeof c === "number").join("");
  const find = (tree, predicate) => elements(tree).find(predicate) ?? null;
  const screen = (tree) => find(tree, (el) => el.type === GameScreen);

  let tree = render();
  find(tree, (el) => el.type === "button" && textOf(el) === "Launch").props.onClick();
  tree = render();
  const launched = screen(tree);
  launched.props.onComplete(result);
  tree = render();
  const afterEnd = screen(tree);
  const next = find(tree, (el) => el.type === "button" && /^(Próxima|Repetir) rota/.test(textOf(el)));
  next?.props.onClick();
  tree = render();
  const reopened = screen(tree);
  const actual = {
    launched: launched.props.continuation,
    resultContinuation: result?.continuation ?? null,
    gameStaysAfterTheEnd: afterEnd?.key === launched.key,
    labOffersTheNextRoute: Boolean(next),
    nextSession: reopened && reopened.key !== launched.key ? reopened.props.continuation : null,
    nextSessionIsTheResultsValue: Boolean(result) && reopened?.props.continuation === result.continuation,
    seedsArmed: armed,
  };
  const expected = {
    launched: entry(3, "hard"),
    resultContinuation: entry(3, "hard"),
    gameStaysAfterTheEnd: true,
    labOffersTheNextRoute: true,
    nextSession: entry(3, "hard"),
    nextSessionIsTheResultsValue: true,
    seedsArmed: [12432045, 12432045],
  };
  record("O4", "ownership", "LAB_MOVES_ON_THROUGH_THE_CONTINUATION", same(actual, expected), actual);
}

// P1 — Route N → its result → Route N + 1, won or lost, on every mode: the continuation the result carries, and the
// session opened on it. Routes 1 and 2; where Route 3 leads is route-journey-terminal-tests.mjs.
{
  const rows = [];
  for (const routeNumber of [1, 2]) {
    for (const mode of MODES) {
      for (const outcome of ["won", "lost"]) {
        const run = finish(entry(routeNumber, mode), outcome, 50_000 + routeNumber * 1_000 + MODES.indexOf(mode) * 300 + (outcome === "won" ? 0 : 150));
        const continuation = run?.completions.at(-1)?.continuation ?? null;
        let nextRun = null;
        try {
          nextRun = run?.nextSession({ autoStart: false }) ?? null;
        } catch {
          // no continuation written: nothing to open
        }
        rows.push({
          from: `R${routeNumber}/${mode}/${outcome}`,
          ok:
            same(continuation, entry(routeNumber + 1, mode)) &&
            same(
              nextRun && { route: nextRun.state.routeNumber, mode: nextRun.state.difficulty, status: nextRun.state.status },
              { route: routeNumber + 1, mode, status: "setup" },
            ),
        });
      }
    }
  }
  record("P1", "preserved", "RESULT_OPENS_ROUTE_N_PLUS_1_WON_AND_LOST", rows.length === 12 && rows.every((row) => row.ok), {
    cases: rows.length,
    failing: rows.filter((row) => !row.ok).map((row) => row.from),
  });
}

// P2 — a fresh entry is Route 1 on the default mode; a retry stays on its Route: the in-game restart, a mode change,
// and the entry retry ("Tentar novamente": the same continuation, mounted again).
{
  const fresh = open(undefined, 60_000);
  const rows = [];
  for (const mode of MODES) {
    const from = entry(2, mode);
    const run = open(from, 60_100, true);
    run.restart();
    const restarted = run.state.routeNumber;
    run.changeDifficulty(MODES[(MODES.indexOf(mode) + 1) % 3]);
    const remounted = open(from, 60_200);
    rows.push({
      mode,
      restart: restarted,
      changeDifficulty: run.state.routeNumber,
      entryRetry: { route: remounted.state.routeNumber, mode: remounted.state.difficulty },
    });
  }
  const actual = { fresh: { route: fresh.state.routeNumber, mode: fresh.state.difficulty, status: fresh.state.status }, rows };
  const expected = {
    fresh: { route: 1, mode: "easy", status: "setup" },
    rows: MODES.map((mode) => ({ mode, restart: 2, changeDifficulty: 2, entryRetry: { route: 2, mode } })),
  };
  record("P2", "preserved", "FRESH_ENTRY_ROUTE_1_RETRY_KEEPS_THE_ROUTE", same(actual, expected), actual);
}

// P3 — the shell stays agnostic: page.tsx and GameScreen name nothing of the Route's; page.tsx sets the continuation
// only to "none" (an entry from Home) or to the result's own value (playAgain).
{
  const vocabulary = (file) => {
    const sf = parse(file);
    const found = new Set();
    const visit = (node) => {
      if (ts.isIdentifier(node) && /^(routeNumber|nextRouteNumber|initialRouteNumber|difficulty|initialDifficulty|continueJourney|readRouteContinuation|RouteContinuation)$/.test(node.text)) found.add(node.text);
      if (ts.isStringLiteral(node) && node.text === ROUTE_KIND) found.add(`"${ROUTE_KIND}"`);
      ts.forEachChild(node, visit);
    };
    visit(sf);
    return [...found].sort();
  };
  const sf = parse(FILES.page);
  const setContinuation = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) && node.expression.getText(sf) === "setContinuation") setContinuation.push(node.arguments.map((a) => a.getText(sf)).join(", "));
    ts.forEachChild(node, visit);
  };
  visit(sf);
  const actual = { page: vocabulary(FILES.page), screen: vocabulary(FILES.screen), setContinuation: setContinuation.sort() };
  record("P3", "preserved", "SHELL_STAYS_AGNOSTIC", same(actual, { page: [], screen: [], setContinuation: ["lastResult.continuation", "undefined"] }), actual);
}

const allPass = tests.every((t) => t.pass);
const tally = (kind) => {
  const subset = tests.filter((t) => t.kind === kind);
  return `${subset.filter((t) => t.pass).length}/${subset.length}`;
};
console.log(
  `\n${REV ? `rev ${REV} · ` : ""}${tests.filter((t) => t.pass).length}/${tests.length} passed · ownership ${tally("ownership")} · preserved ${tally("preserved")} · failing: ${tests.filter((t) => !t.pass).map((t) => t.id).join(", ") || "none"}`,
);
console.log(allPass ? "ROUTE_JOURNEY_OWNERSHIP_OK" : "ROUTE_JOURNEY_OWNERSHIP_FAILED");
process.exitCode = allPass ? EXIT_OK : EXIT_VALIDATION_FAILED;
