/**
 * ROUTE-JOURNEY-TERMINAL-01 — Rota Estratégica v1 has three Routes.
 *
 *   Route 1 → Route 2, Route 2 → Route 3, won or lost;
 *   Route 3 lost → Route 3 again, same mode;
 *   Route 3 won  → the journey is complete: no continuation, `journeyCompleted`.
 *
 * Until this mission every Route N wrote a continuation to N + 1, so Route 3
 * opened a Route 4 the product never designed (`useEscapeMaze#endGame`:
 * `nextRouteNumber = routeNumber + 1`, continuation always written), and
 * `readRouteContinuation` accepted any positive integer.
 *
 * The rule belongs to the Rota (`continuation.ts`: `ROUTE_JOURNEY_FINAL_ROUTE`,
 * `nextJourneyRoute`, `readRouteContinuation`). The shell still only learns
 * whether a result carries a continuation.
 *
 * Checks marked [terminal] are what this mission establishes; [preserved] ones
 * pin what must not move (and hold on 7b740e4 too). Everything runs the REAL
 * code: the hook through route-runtime-harness; the reader, the storage and the
 * result screen compiled from source; RouteStrategyGame rendered by real React
 * over a stubbed hook; the launcher page driven through a small hooks shim; the
 * shell's sources read as TypeScript.
 *
 * Usage: node tools/validation/route-journey-terminal-tests.mjs [--rev=<commit>]
 *
 *   --rev=<commit>  every source as it was at <commit>, read with `git show`.
 *                   `--rev=7b740e4` (Route 3 → Route 4) must fail every
 *                   [terminal] check and hold every [preserved] one.
 *
 * Writes nothing. Exit 0 = every check holds, 1 = a check failed, 3 = usage error.
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
  modal: "src/components/RewardResultModal.tsx",
  rewards: "src/engine/rewards.ts",
  detailLabels: "src/lib/detail-labels.ts",
  launcher: "src/app/lab/route-launcher/page.tsx",
  storage: "src/engine/storage.ts",
  page: "src/app/page.tsx",
  screen: "src/components/GameScreen.tsx",
};
const MODES = ["easy", "medium", "hard"];
const ROUTE_KIND = "escape-maze-route";
/** The decision, restated so it is asserted rather than trusted. */
const FINAL_ROUTE = 3;

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
if (args.some((arg) => arg !== revArg) || REV === "") {
  console.error("usage: node tools/validation/route-journey-terminal-tests.mjs [--rev=<commit>]");
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

// --- evaluating real modules -----------------------------------------------------------------

const nodeRequire = createRequire(import.meta.url);
/** Compile a source file and run it as CommonJS; `modules` answers its imports, then node_modules. */
function evaluate(file, modules, globals = {}) {
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
  vm.runInNewContext(outputText, { module: cjs, exports: cjs.exports, require, console, process, ...globals }, { filename: file });
  return cjs.exports;
}

const CONTINUATION = evaluate(FILES.routeContinuation, {});
const { readRouteContinuation } = CONTINUATION;

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
const entry = (routeNumber, difficulty) => ({ kind: ROUTE_KIND, routeNumber, difficulty });

const RUNTIME = loadRouteRuntime({ hookSource: REV ? readSource(FILES.hook) : undefined });
const open = (continuation, seed, start = false) =>
  RUNTIME.mount({
    seed,
    routeNumber: continuation?.routeNumber,
    difficulty: continuation?.difficulty,
    initialDifficulty: continuation?.difficulty,
    autoStart: start,
  });
const landing = (run) => run && { route: run.state.routeNumber, mode: run.state.difficulty, status: run.state.status };

/** A Route played to the wanted end. Maps are random, so the seed is searched; the end is not chosen any other way. */
function finish(continuation, outcome, seedBase) {
  for (let seed = seedBase; seed < seedBase + 300; seed += 1) {
    const run = open(continuation, seed, true);
    if (playToEnd(run, outcome === "won" ? "win" : "lose") === outcome) return { run, seed };
  }
  return null;
}

/** Every Route of the journey, on every mode, won and lost: the result the real hook writes, and where it leads. */
const MATRIX = [];
for (const routeNumber of [1, 2, 3]) {
  for (const mode of MODES) {
    for (const outcome of ["won", "lost"]) {
      const seedBase = 70_000 + routeNumber * 3_000 + MODES.indexOf(mode) * 1_000 + (outcome === "won" ? 0 : 500);
      const done = finish(entry(routeNumber, mode), outcome, seedBase);
      const result = done?.run.completions.at(-1) ?? null;
      let next = null;
      let nextError = null;
      try {
        next = done ? landing(done.run.nextSession({ autoStart: false })) : null;
      } catch (error) {
        nextError = String(error?.message ?? error).split(" (")[0];
      }
      MATRIX.push({ routeNumber, mode, outcome, seed: done?.seed ?? null, result, next, nextError });
    }
  }
}
const cell = (routeNumber, mode, outcome) =>
  MATRIX.find((row) => row.routeNumber === routeNumber && row.mode === mode && row.outcome === outcome);
const routeNumberIn = (text) => [...String(text).matchAll(/Rota (\d+)/g)].map((m) => Number(m[1]));

// T1 — Routes 1 and 2 lead to the next Route, won or lost, on the mode they were played on; the next session opens there.
{
  const rows = MATRIX.filter((row) => row.routeNumber < FINAL_ROUTE).map((row) => {
    const details = row.result?.details ?? {};
    const want = row.routeNumber + 1;
    return {
      from: `R${row.routeNumber}/${row.mode}/${row.outcome}`,
      continuation: row.result?.continuation ?? null,
      next: row.next,
      ok:
        Boolean(row.result) &&
        same(row.result.continuation, entry(want, row.mode)) &&
        details.nextRouteNumber === want &&
        !("journeyCompleted" in details) &&
        same(row.next, { route: want, mode: row.mode, status: "setup" }),
    };
  });
  record("T1", "preserved", "ROUTES_1_AND_2_LEAD_TO_THE_NEXT", rows.length === 12 && rows.every((row) => row.ok), {
    cases: rows.length,
    failing: rows.filter((row) => !row.ok),
  });
}

// T2 — Route 3 lost: the result resumes Route 3 on the same mode (never Route 4), and the next session opens there.
const lostLast = MATRIX.filter((row) => row.routeNumber === FINAL_ROUTE && row.outcome === "lost");
{
  const rows = lostLast.map((row) => {
    const details = row.result?.details ?? {};
    return {
      from: `R3/${row.mode}/lost`,
      continuation: row.result?.continuation ?? null,
      nextRouteNumber: details.nextRouteNumber ?? null,
      journeyCompleted: details.journeyCompleted ?? null,
      next: row.next,
      summaryRoutes: routeNumberIn(row.result?.summary ?? ""),
      ok:
        Boolean(row.result) &&
        same(row.result.continuation, entry(FINAL_ROUTE, row.mode)) &&
        details.nextRouteNumber === FINAL_ROUTE &&
        details.journeyCompleted !== true &&
        same(row.next, { route: FINAL_ROUTE, mode: row.mode, status: "setup" }) &&
        routeNumberIn(row.result.summary).every((n) => n <= FINAL_ROUTE),
    };
  });
  record("T2", "terminal", "ROUTE_3_LOST_RESUMES_ROUTE_3", rows.length === 3 && rows.every((row) => row.ok), { rows });
}

// T3 — Route 3 won: the journey is complete. No continuation at all, `journeyCompleted: true`, no "next Route" in
// the details, nothing in the copy past Route 3 — and so nothing a next session could open.
const wonLast = MATRIX.filter((row) => row.routeNumber === FINAL_ROUTE && row.outcome === "won");
{
  const rows = wonLast.map((row) => {
    const details = row.result?.details ?? {};
    return {
      from: `R3/${row.mode}/won`,
      hasContinuation: row.result ? "continuation" in row.result : null,
      journeyCompleted: details.journeyCompleted ?? null,
      nextRouteFields: Object.keys(details).filter((key) => /^nextRoute/.test(key)),
      summaryRoutes: routeNumberIn(row.result?.summary ?? ""),
      nextSession: row.next ?? row.nextError,
      ok:
        Boolean(row.result) &&
        !("continuation" in row.result) &&
        details.journeyCompleted === true &&
        details.won === true &&
        details.routeNumber === FINAL_ROUTE &&
        details.difficulty === row.mode &&
        !Object.keys(details).some((key) => /^nextRoute/.test(key)) &&
        routeNumberIn(row.result.summary).every((n) => n <= FINAL_ROUTE) &&
        row.next === null,
    };
  });
  record("T3", "terminal", "ROUTE_3_WON_COMPLETES_THE_JOURNEY", rows.length === 3 && rows.every((row) => row.ok), { rows });
}

// T4 — the Rota's reader: Routes 1 to 3 on a known mode and nothing else. Past the journey (4, 999), malformed
// numbers, unknown modes, another kind, not an object — undefined, never a throw.
{
  const valid = [1, 2, 3].flatMap((route) => MODES.map((mode) => entry(route, mode)));
  const refused = [
    ["Route 4", entry(4, "hard")],
    ["Route 5", entry(5, "easy")],
    ["Route 999", entry(999, "medium")],
    ["Route 0", entry(0, "easy")],
    ["Route -1", entry(-1, "easy")],
    ["Route 2.5", entry(2.5, "easy")],
    ["Route NaN", entry(Number.NaN, "easy")],
    ["Route Infinity", entry(Number.POSITIVE_INFINITY, "easy")],
    ["Route as text", { kind: ROUTE_KIND, routeNumber: "3", difficulty: "easy" }],
    ["no Route", { kind: ROUTE_KIND, difficulty: "easy" }],
    ["unknown mode", entry(2, "nightmare")],
    ["mode as number", { kind: ROUTE_KIND, routeNumber: 2, difficulty: 2 }],
    ["no mode", { kind: ROUTE_KIND, routeNumber: 2 }],
    ["another kind", { kind: "probe-kind", routeNumber: 2, difficulty: "easy" }],
    ["no kind", { routeNumber: 2, difficulty: "easy" }],
    ["null", null],
    ["undefined", undefined],
    ["a string", ROUTE_KIND],
    ["an array", [ROUTE_KIND, 2, "easy"]],
  ];
  const read = (value) => {
    try {
      return { value: readRouteContinuation(value) ?? null, threw: null };
    } catch (error) {
      return { value: null, threw: String(error?.message ?? error) };
    }
  };
  const validRows = valid.map((value) => ({ value, out: read(value) }));
  const refusedRows = refused.map(([label, value]) => ({ label, out: read(value) }));
  record(
    "T4",
    "terminal",
    "READER_REFUSES_ROUTES_PAST_THE_JOURNEY",
    validRows.every((row) => same(row.out.value, row.value) && row.out.threw === null) &&
      refusedRows.every((row) => row.out.value === null && row.out.threw === null),
    {
      accepted: validRows.filter((row) => same(row.out.value, row.value)).length,
      refused: refusedRows.filter((row) => row.out.value === null && row.out.threw === null).map((row) => row.label),
      failing: [
        ...validRows.filter((row) => !same(row.out.value, row.value) || row.out.threw !== null),
        ...refusedRows.filter((row) => row.out.value !== null || row.out.threw !== null),
      ],
    },
  );
}

// --- the real RouteStrategyGame over a stubbed hook ---------------------------------------------

const React = nodeRequire("react");
const { renderToStaticMarkup } = nodeRequire("react-dom/server");
const ROTA_STATE = {
  difficulty: "medium",
  routeNumber: 3,
  routeProgression: { label: "Portal distante", description: "A rota pede planejamento com calma." },
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
let rotaState = ROTA_STATE;
const hookCalls = [];
const rotaModule = evaluate(FILES.rota, {
  "@/lib/feedback-motion": { gentleShakeAnimate: {} },
  "@/games/escape-maze/continuation": CONTINUATION,
  "@/games/escape-maze/useEscapeMaze": {
    COLS: 9,
    ROWS: 9,
    posKey: (p) => `${p.row},${p.col}`,
    useEscapeMaze: (_onComplete, initialRouteNumber, initialDifficulty) => {
      hookCalls.push({ initialRouteNumber, initialDifficulty });
      return new Proxy(rotaState, { get: (target, key) => (key in target ? target[key] : () => {}) });
    },
  },
  "@/components/worlds/master-scene/worldMasterSceneConfig": { getWorldMasterSceneStyle: () => ({}) },
});
const renderRota = (continuation, state = ROTA_STATE) => {
  rotaState = state;
  hookCalls.length = 0;
  const html = renderToStaticMarkup(
    React.createElement(rotaModule.RouteStrategyGame, { onComplete: () => {}, onExit: () => {}, continuation }),
  );
  return { html, args: hookCalls[0] ?? null };
};
const textOfHtml = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

// T5 — the Rota never mounts past the journey: whatever continuation it is handed, the hook receives Route 1 to 3, or
// nothing (a fresh entry) — and the real hook mounted on that lands on Route 1, the default mode.
{
  const offered = [
    ["Route 4 hard (a continuation written before the end existed)", entry(4, "hard")],
    ["Route 5 easy", entry(5, "easy")],
    ["Route 999 medium", entry(999, "medium")],
    ["Route 0", entry(0, "hard")],
    ["Route 2.5", entry(2.5, "hard")],
    ["unknown mode", entry(3, "nightmare")],
  ];
  const rows = offered.map(([label, continuation]) => {
    let out;
    try {
      const { args } = renderRota(continuation);
      out = { args, landed: landing(open(args && { routeNumber: args.initialRouteNumber, difficulty: args.initialDifficulty }, 75_000)), crash: null };
    } catch (error) {
      out = { args: null, landed: null, crash: String(error?.message ?? error).slice(0, 120) };
    }
    return {
      label,
      ...out,
      ok:
        out.crash === null &&
        same(out.args, { initialRouteNumber: undefined, initialDifficulty: undefined }) &&
        same(out.landed, { route: 1, mode: "easy", status: "setup" }),
    };
  });
  const resumed = MODES.map((mode) => {
    const { args } = renderRota(entry(FINAL_ROUTE, mode));
    return { mode, args, ok: same(args, { initialRouteNumber: FINAL_ROUTE, initialDifficulty: mode }) };
  });
  record(
    "T5",
    "terminal",
    "ROTA_NEVER_MOUNTS_PAST_THE_JOURNEY",
    rows.every((row) => row.ok) && resumed.every((row) => row.ok),
    {
      freshInstead: rows.filter((row) => row.ok).map((row) => row.label),
      route3Resumed: resumed.filter((row) => row.ok).map((row) => row.mode),
      failing: [...rows, ...resumed].filter((row) => !row.ok),
    },
  );
}

// T6 — the board's own status card (on screen only where the game stays after its end: the lab) says where the
// journey stands: Route 3 won is a completed journey, Route 3 lost offers Route 3 again; neither names a Route 4.
{
  const card = (routeNumber, status) => {
    const { html } = renderRota(undefined, { ...ROTA_STATE, routeNumber, status });
    const text = textOfHtml(html);
    return { journeyCompleted: text.includes("Jornada concluída"), routes: [...new Set(routeNumberIn(text))].sort(), text };
  };
  const won3 = card(3, "won");
  const lost3 = card(3, "lost");
  const won2 = card(2, "won");
  const actual = {
    route3Won: { journeyCompleted: won3.journeyCompleted, routes: won3.routes },
    route3Lost: { journeyCompleted: lost3.journeyCompleted, routes: lost3.routes, offersRoute3Again: /tentar a Rota 3 de novo/.test(lost3.text) },
    route2Won: { journeyCompleted: won2.journeyCompleted, announcesRoute3: /A Rota 3 fica disponível/.test(won2.text) },
  };
  record(
    "T6",
    "terminal",
    "ROTA_STATUS_CARD_KNOWS_THE_END",
    same(actual, {
      route3Won: { journeyCompleted: true, routes: [3] },
      route3Lost: { journeyCompleted: false, routes: [3], offersRoute3Again: true },
      route2Won: { journeyCompleted: false, announcesRoute3: true },
    }),
    actual,
  );
}

// --- the real result screen ---------------------------------------------------------------------

/** RewardResultModal called as a function under a hooks shim; its element tree is read, its buttons pressed. */
const modalModule = evaluate(FILES.modal, {
  react: { ...React, useEffect: () => {}, useRef: (value) => ({ current: value ?? null }) },
  "motion/react": { motion: { div: "div", button: "button" }, useReducedMotion: () => true },
  "@/data/worlds": {
    getWorldMeta: () => ({ icon: () => null, name: "Rota Estratégica", skill: "Planejamento" }),
  },
  "@/engine/rewards": evaluate(FILES.rewards, {}),
  "@/lib/confetti": { celebrateSuccess: () => {} },
  "@/lib/feedback-motion": { fadeSlideUp: {} },
  "@/lib/detail-labels": evaluate(FILES.detailLabels, {}),
});
const elements = (node, found = []) => {
  if (Array.isArray(node)) node.forEach((child) => elements(child, found));
  else if (node && typeof node === "object" && "props" in node) {
    found.push(node);
    elements(node.props.children, found);
  }
  return found;
};
const textOf = (node) =>
  elements(node)
    .flatMap((el) => [el.props.children].flat(Infinity))
    .filter((child) => typeof child === "string" || typeof child === "number")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
const ownText = (el) => [el.props.children].flat(Infinity).filter((c) => typeof c === "string" || typeof c === "number").join("").trim();
function resultScreen(result) {
  const pressed = [];
  const onPlayAgain = () => pressed.push("playAgain");
  const onDashboard = () => pressed.push("dashboard");
  const tree = modalModule.RewardResultModal({ result: { id: "r", playedAt: "2026-10-02T00:00:00.000Z", ...result }, onPlayAgain, onDashboard });
  const all = elements(tree);
  const title = ownText(all.find((el) => el.props.id === "reward-title") ?? { props: {} });
  const buttons = all
    .filter((el) => el.type === "button")
    .map((el) => {
      pressed.length = 0;
      el.props.onClick();
      return { label: ownText(el), leadsTo: pressed.join(",") };
    });
  return { title, buttons, text: textOf(tree) };
}

// T7 — the result screen of the journey's end. Route 3 won: "Jornada concluída", one action, back to the worlds — no
// "Explorar próxima rota", no second equivalent button, and "play again" (a new Rota session) is not reachable.
// Route 3 lost: not a completed journey; its action resumes Route 3, which is the continuation the result carries.
{
  const rows = [];
  for (const row of [...wonLast, ...lostLast]) {
    const screen = row.result ? resultScreen(row.result) : null;
    const won = row.outcome === "won";
    const expected = won
      ? { title: "Jornada concluída", buttons: [{ label: "Voltar aos mundos", leadsTo: "dashboard" }] }
      : {
          title: "Rota registrada",
          buttons: [
            { label: "Tentar Rota 3 novamente", leadsTo: "playAgain" },
            { label: "Continuar jornada", leadsTo: "dashboard" },
          ],
        };
    rows.push({
      from: `R3/${row.mode}/${row.outcome}`,
      title: screen?.title ?? null,
      buttons: screen?.buttons ?? null,
      routesNamed: screen ? [...new Set(routeNumberIn(screen.text))].sort() : null,
      ok:
        Boolean(screen) &&
        same({ title: screen.title, buttons: screen.buttons }, expected) &&
        !/Explorar próxima rota/.test(screen.text) &&
        routeNumberIn(screen.text).every((n) => n <= FINAL_ROUTE) &&
        (won ? /Jornada completa/.test(screen.text) : !/Jornada conclu/.test(screen.text)),
    });
  }
  record("T7", "terminal", "RESULT_SCREEN_ENDS_THE_JOURNEY", rows.length === 6 && rows.every((row) => row.ok), {
    rows: rows.map(({ from, title, buttons, routesNamed, ok }) => ({ from, title, buttons: buttons?.map((b) => `${b.label} → ${b.leadsTo}`), routesNamed, ok })),
  });
}

// T8 — Routes 1 and 2 on the result screen are what they were: the next Route offered, and the way back to the worlds.
{
  const rows = MATRIX.filter((row) => row.routeNumber < FINAL_ROUTE && row.mode === "medium").map((row) => {
    const screen = resultScreen(row.result);
    const won = row.outcome === "won";
    const expected = {
      title: won ? "Caminho aberto" : "Rota registrada",
      buttons: [
        { label: won ? "Explorar próxima rota" : "Explorar outra rota", leadsTo: "playAgain" },
        { label: "Continuar jornada", leadsTo: "dashboard" },
      ],
    };
    return {
      from: `R${row.routeNumber}/medium/${row.outcome}`,
      title: screen.title,
      ok:
        same({ title: screen.title, buttons: screen.buttons }, expected) &&
        screen.text.includes(`Rota ${row.routeNumber} salva. Rota ${row.routeNumber + 1}:`),
    };
  });
  record("T8", "preserved", "RESULT_SCREEN_ROUTES_1_AND_2_UNCHANGED", rows.length === 4 && rows.every((row) => row.ok), { rows });
}

// --- storage ------------------------------------------------------------------------------------

function storageOn(stored) {
  const data = new Map(stored === undefined ? [] : [["cognitive-mind-recent-results", JSON.stringify(stored)]]);
  const window = {
    localStorage: {
      getItem: (key) => (data.has(key) ? data.get(key) : null),
      setItem: (key, value) => data.set(key, String(value)),
      removeItem: (key) => data.delete(key),
    },
  };
  return evaluate(FILES.storage, {}, { window, Date, Intl, JSON });
}

// T9 — saved and read back: a won Route 3 keeps `journeyCompleted` and no continuation; a lost one keeps Route 3.
// Results written before the end existed (Route 4 and 5 in their details or continuation) still load, untouched — and
// the Rota's reader refuses the continuation they carry.
{
  const legacy = [
    { id: "legacy-r4", activityId: "escape-maze", activityTitle: "Rota Estratégica", gameId: "escape-maze", score: 40, playedAt: "2026-09-30T12:00:00.000Z", summary: "A Rota 4 espera por você no seu ritmo.", details: { won: true, routeNumber: 4, nextRouteNumber: 5, nextRouteStage: "Novas escolhas", difficulty: "hard" }, continuation: entry(5, "hard") },
    { id: "legacy-r3", activityId: "escape-maze", activityTitle: "Rota Estratégica", gameId: "escape-maze", score: 41, playedAt: "2026-09-30T12:01:00.000Z", summary: "A Rota 4 pode ser explorada.", details: { won: false, routeNumber: 3, nextRouteNumber: 4, nextRouteStage: "Exploração inicial", difficulty: "easy" }, continuation: entry(4, "easy") },
  ];
  const storage = storageOn(legacy);
  const won = wonLast.find((row) => row.mode === "hard")?.result;
  const lost = lostLast.find((row) => row.mode === "hard")?.result;
  let threw = null;
  let read = [];
  try {
    storage.saveGameResult(lost);
    storage.saveGameResult(won);
    read = storage.getRecentResults();
  } catch (error) {
    threw = String(error?.message ?? error);
  }
  const [readWon, readLost, ...readLegacy] = read;
  const actual = {
    threw,
    won: readWon && { journeyCompleted: readWon.details.journeyCompleted ?? null, hasContinuation: "continuation" in readWon, nextRouteFields: Object.keys(readWon.details).filter((key) => /^nextRoute/.test(key)) },
    lost: readLost && { continuation: readLost.continuation ?? null, journeyCompleted: readLost.details.journeyCompleted ?? null },
    legacyUntouched: same(readLegacy, legacy),
    legacyContinuationsRead: legacy.map((result) => readRouteContinuation(result.continuation) ?? null),
  };
  record(
    "T9",
    "terminal",
    "STORAGE_KEEPS_THE_END",
    same(actual, {
      threw: null,
      won: { journeyCompleted: true, hasContinuation: false, nextRouteFields: [] },
      lost: { continuation: entry(FINAL_ROUTE, "hard"), journeyCompleted: null },
      legacyUntouched: true,
      legacyContinuationsRead: [null, null],
    }),
    actual,
  );
}

// --- static reading -----------------------------------------------------------------------------

const SRC_FILES = (
  REV
    ? execFileSync("git", ["ls-tree", "-r", "--name-only", REV, "src"], { encoding: "utf8" })
    : execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "src"], { encoding: "utf8" })
)
  .split("\n")
  .filter((file) => /\.(ts|tsx)$/.test(file));
const parse = (file) =>
  ts.createSourceFile(file, readSource(file), ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
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

// T10 — the shell stays agnostic: page.tsx and GameScreen name nothing of the Rota's — not its Routes, not the
// journey's length or end — import nothing of it, hold no literal 3, and set the continuation only to "none" or to
// the result's own value.
{
  const ROUTE_WORDS = /^(routeNumber|nextRouteNumber|journeyCompleted|ROUTE_JOURNEY_FINAL_ROUTE|nextJourneyRoute|readRouteContinuation|RouteContinuation|difficulty|initialRouteNumber|initialDifficulty)$/;
  const scan = (file) => {
    const sf = parse(file);
    const found = new Set();
    const visit = (node) => {
      if (ts.isIdentifier(node) && ROUTE_WORDS.test(node.text)) found.add(node.text);
      if (ts.isStringLiteral(node) && (node.text === ROUTE_KIND || node.text === "journeyCompleted" || node.text.startsWith("@/games/escape-maze"))) found.add(`"${node.text}"`);
      if (ts.isNumericLiteral(node) && Number(node.text) === FINAL_ROUTE) found.add(`literal ${node.text}`);
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
  const actual = { page: scan(FILES.page), screen: scan(FILES.screen), setContinuation: setContinuation.sort() };
  record("T10", "preserved", "SHELL_STAYS_AGNOSTIC", same(actual, { page: [], screen: [], setContinuation: ["lastResult.continuation", "undefined"] }), actual);
}

// T11 — one source for the end: the journey's length is declared once, in the Rota's continuation module, and read by
// the Rota's producer and reader (and the dev launcher) only; `routeNumber + 1` exists only inside that rule.
{
  const declared = [];
  const users = new Set();
  const plusOne = [];
  for (const file of SRC_FILES) {
    const sf = parse(file);
    const visit = (node) => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "ROUTE_JOURNEY_FINAL_ROUTE") declared.push(file);
      if (ts.isIdentifier(node) && /^(ROUTE_JOURNEY_FINAL_ROUTE|nextJourneyRoute)$/.test(node.text) && file !== FILES.routeContinuation) users.add(file);
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
        /(^|\.)routeNumber$/.test(node.left.getText(sf)) &&
        node.right.getText(sf) === "1"
      ) {
        plusOne.push(`${file}#${ownerOf(node)}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
  const actual = { declaredIn: declared, readBy: [...users].sort(), routeNumberPlusOne: [...new Set(plusOne)].sort() };
  record(
    "T11",
    "terminal",
    "ONE_SOURCE_FOR_THE_JOURNEY_END",
    same(actual, {
      declaredIn: [FILES.routeContinuation],
      readBy: [FILES.launcher, FILES.rota, FILES.hook],
      routeNumberPlusOne: [`${FILES.routeContinuation}#nextJourneyRoute`],
    }),
    actual,
  );
}

// --- the dev-only launcher -----------------------------------------------------------------------

// T12 — the lab respects the end: its form opens Routes 1 to 3 only (Route 4 and 999 are refused, no session); after
// Route 3 won there is nothing to open; after Route 3 lost it offers Route 3 again; after Route 2 it still offers 3.
{
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
    react: { ...React, ...hooks },
    "@/components/GameScreen": { GameScreen },
    "@/engine/route-random": { armRouteRandomSeed: (seed) => armed.push(seed), clearRouteRandomSeed: () => {}, getArmedRouteSeed: () => armed.at(-1) ?? null },
    "@/engine/storage": storageOn(undefined),
    "@/games/escape-maze/continuation": CONTINUATION,
  });
  const render = () => ((index = 0), launcherModule.default({}));
  const find = (tree, predicate) => elements(tree).find(predicate) ?? null;
  const screen = (tree) => find(tree, (el) => el.type === GameScreen);
  const button = (tree, pattern) => find(tree, (el) => el.type === "button" && pattern.test(ownText(el)));
  const fresh = () => {
    cells.length = 0;
    armed.length = 0;
    return render();
  };
  const launchRoute = (raw) => {
    let tree = fresh();
    const routeInput = find(tree, (el) => el.type === "label" && /^Route/.test(ownText(el)));
    const input = elements(routeInput?.props.children).find((el) => el.type === "input");
    input.props.onChange({ target: { value: raw } });
    tree = render();
    button(tree, /^Launch$/).props.onClick();
    tree = render();
    return { tree, session: screen(tree), error: textOf(find(tree, (el) => el.type === "p" && /inválida/.test(ownText(el))) ?? []) || null };
  };
  const afterEnd = (raw, result) => {
    let { tree } = launchRoute(raw);
    const first = screen(tree);
    first.props.onComplete(result);
    tree = render();
    const next = button(tree, /^(Próxima|Repetir) rota/);
    const offered = next ? ownText(next) : null;
    next?.props.onClick();
    tree = render();
    const reopened = screen(tree);
    return {
      launched: first.props.continuation,
      offered,
      completedShown: /jornada concluída/.test(textOf(tree)),
      nextSession: reopened && reopened.key !== first.key ? reopened.props.continuation : null,
    };
  };
  const hardWon3 = wonLast.find((row) => row.mode === "hard")?.result;
  const hardLost3 = lostLast.find((row) => row.mode === "hard")?.result;
  const hardWon2 = cell(2, "hard", "won")?.result;
  const formRows = ["4", "999", "0", "3"].map((raw) => {
    const out = launchRoute(raw);
    return { route: raw, session: out.session?.props.continuation ?? null, error: out.error };
  });
  const actual = {
    form: formRows,
    afterRoute3Won: afterEnd("3", hardWon3),
    afterRoute3Lost: afterEnd("3", hardLost3),
    afterRoute2Won: afterEnd("2", hardWon2),
  };
  const refusedForm = (route) => ({ route, session: null, error: "Route inválida: use um inteiro de 1 a 3." });
  record(
    "T12",
    "terminal",
    "LAB_RESPECTS_THE_END",
    same(actual, {
      form: [refusedForm("4"), refusedForm("999"), refusedForm("0"), { route: "3", session: entry(3, "hard"), error: null }],
      afterRoute3Won: { launched: entry(3, "hard"), offered: null, completedShown: true, nextSession: null },
      afterRoute3Lost: { launched: entry(3, "hard"), offered: "Repetir rota → Route 3", completedShown: false, nextSession: entry(3, "hard") },
      afterRoute2Won: { launched: entry(2, "hard"), offered: "Próxima rota → Route 3", completedShown: false, nextSession: entry(3, "hard") },
    }),
    actual,
  );
}

// T13 — a fresh entry is Route 1 on the default mode; an entry retry (the same continuation mounted again), the
// in-game restart and a mode change keep the Route — on Route 2 and Route 3 alike, every mode.
{
  const fresh = landing(open(undefined, 78_000));
  const rows = [];
  for (const routeNumber of [2, 3]) {
    for (const mode of MODES) {
      const from = entry(routeNumber, mode);
      const first = open(from, 78_100);
      const retried = open(from, 78_200);
      const run = open(from, 78_300, true);
      run.restart();
      const restarted = run.state.routeNumber;
      run.changeDifficulty(MODES[(MODES.indexOf(mode) + 1) % 3]);
      rows.push({
        from: `R${routeNumber}/${mode}`,
        ok:
          same(landing(first), { route: routeNumber, mode, status: "setup" }) &&
          same(landing(retried), landing(first)) &&
          restarted === routeNumber &&
          run.state.routeNumber === routeNumber,
      });
    }
  }
  record(
    "T13",
    "preserved",
    "FRESH_ENTRY_ROUTE_1_RETRY_KEEPS_THE_ROUTE",
    same(fresh, { route: 1, mode: "easy", status: "setup" }) && rows.every((row) => row.ok),
    { fresh, cases: rows.length, failing: rows.filter((row) => !row.ok).map((row) => row.from) },
  );
}

const allPass = tests.every((t) => t.pass);
const tally = (kind) => {
  const subset = tests.filter((t) => t.kind === kind);
  return `${subset.filter((t) => t.pass).length}/${subset.length}`;
};
console.log(
  `\n${REV ? `rev ${REV} · ` : ""}${tests.filter((t) => t.pass).length}/${tests.length} passed · terminal ${tally("terminal")} · preserved ${tally("preserved")} · failing: ${tests.filter((t) => !t.pass).map((t) => t.id).join(", ") || "none"}`,
);
console.log(allPass ? "ROUTE_JOURNEY_TERMINAL_OK" : "ROUTE_JOURNEY_TERMINAL_FAILED");
process.exitCode = allPass ? EXIT_OK : EXIT_VALIDATION_FAILED;
