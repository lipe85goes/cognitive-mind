/**
 * GAME03-INTERACTIONS-04 — the room's movable pieces, checked from source.
 *
 * Both rooms gained a few pieces the Explorador can open or move — drawers, a
 * door, a curtain, a lid, a basket pushed aside — as scene data
 * (`SceneInteractable`), one small finite-state engine for all of them
 * (hidden-objects-interactions.ts), and objects kept behind them: an object
 * whose `gate` names a piece can be neither seen nor found until that piece is
 * in a state that exposes it. Where the pieces are belongs to one exploration:
 * every start and every "Recomeçar" puts them back as the room is authored. A
 * round's rule bounds how many listed objects it keeps behind pieces
 * (RoundRule.gated: Fácil 0–1, Médio 1–2, Difícil 1–3); the search load is
 * untouched (it measures an object as it looks once in view).
 *
 * Everything runs the REAL code from source through the shared harness
 * (hidden-objects-harness.mjs): the pure modules, the real HiddenObjectsGame
 * with its real scene view under the harness's small React (every tap, drag,
 * pinch and wheel a Pointer Event on the viewport, through the real gesture
 * recogniser and camera controller), the platform's storage and Home, the art
 * on disk and its audits, and the base itself (git show).
 *
 * [interactions] checks are what this mission introduced: they FAIL on its base
 * (ede2cb1 — GAME03-CALIBRATION-02A's final state: no piece in any room).
 * [preserved] checks are guards the interactions must not break — no timer or
 * score, old results, every object the rooms already had, a light Home — and
 * hold on both; their mutants show they are not vacuous.
 *
 * Usage:
 *   node tools/validation/hidden-objects-interactions-tests.mjs                  # the working tree
 *   node tools/validation/hidden-objects-interactions-tests.mjs --rev=<commit>   # every source at <commit>
 *   node tools/validation/hidden-objects-interactions-tests.mjs --counterfactuals
 *        the working tree must pass every check; the base must fail every
 *        [interactions] check and hold every [preserved] one; every in-memory
 *        MUTANT must fail the checks it names. Nothing is ever written.
 *
 * Writes nothing. Exit 0 = every check holds, 1 = a check failed, 3 = usage error.
 */
import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";
import { auditOf } from "./hidden-objects-calibration-lib.mjs";
import { createModuleGraph, openSourceTree } from "./route-module-loader.mjs";
import {
  APP_ROOTS,
  DESKTOP,
  DIR,
  FILES,
  IMAGE,
  REFERENCE_PHONE,
  STORAGE_KEY,
  VIEWPORTS,
  browserMocks,
  cached,
  clip,
  codeOnly,
  createEnvironment,
  createReact,
  drain,
  hudRects,
  intersects,
  listFiles,
  mediaBlock,
  nearCamera,
  normalizeText,
  platformTables,
  same,
  sorted,
  staticGraph,
} from "./hidden-objects-harness.mjs";

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
const COUNTERFACTUAL_MODE = args.includes("--counterfactuals");
if (args.some((arg) => arg !== revArg && arg !== "--counterfactuals") || REV === "" || (REV && COUNTERFACTUAL_MODE)) {
  console.error("usage: node tools/validation/hidden-objects-interactions-tests.mjs [--rev=<commit> | --counterfactuals]");
  process.exit(EXIT_USAGE);
}

// --- what the mission fixed ---------------------------------------------------------------------

/** GAME03-CALIBRATION-02A's final state, this mission's exact base. */
const BASE = "ede2cb124cf93506d2530fe1c6a007619e6fda01";
const GAME = "hidden-objects";
const STUDIO_ID = "explorer-studio";
const OBSERVATORY_ID = "explorer-observatory";
const SCENE_IDS = [STUDIO_ID, OBSERVATORY_ID];
const DIFFICULTIES = ["easy", "medium", "hard"];
const KINDS = ["drawer", "door", "curtain", "lid", "prop"];
/** 2–4 meaningful pieces a room: enough to explore, never a room of switches. */
const PIECES_PER_ROOM = { min: 2, max: 4 };
/** How many listed objects a round may keep behind pieces, per difficulty (the mission's guidance, fixed after enumeration). */
const GATED_BOUNDS = { easy: [0, 1], medium: [1, 2], hard: [1, 3] };
/** A shut piece hides what it keeps: at most this share of it shows (the art's audit). */
const HIDDEN_AT_REST = 0.05;
/** The fairness floors (the same since the skeleton — never lowered). */
const VISIBLE_FLOOR = { A: 0.8, B: 0.6, C: 0.4 };
const EDGE_FLOOR = 1.3;
const MIN_EFFECTIVE_TOUCH_PX = 44;
const MIN_VISIBLE_AT_COVER_PX = 32;
/** A state's tap area must hold its art (the posed picture's bounds) within this slack (su): the picture's soft shadow edge. */
const HIT_SLACK_SU = 12;
/** Replays stay varied: no object behind a piece in more than 3 of 4 of a difficulty's rounds. */
const EXPOSURE_CEILING = 0.75;
const INTERACTIONS_FILE = `${DIR}hidden-objects-interactions.ts`;
const DIFFICULTY_FILE = `${DIR}hidden-objects-difficulty.ts`;
const CLUES_FILE = `${DIR}hidden-objects-clues.ts`;
/** The engine: nothing in it may name a room, a station, an object, a piece or a piece's state. */
const ENGINE_FILES = [
  "hidden-objects-camera.ts",
  "hidden-objects-gesture.ts",
  "hidden-objects-controller.ts",
  "hidden-objects-model.ts",
  "hidden-objects-rounds.ts",
  "hidden-objects-clues.ts",
  "hidden-objects-difficulty.ts",
  "hidden-objects-interactions.ts",
  "HiddenObjectsScene.tsx",
  "HiddenObjectsGame.tsx",
  "hidden-objects.css",
].map((f) => `${DIR}${f}`);
const EPS = 1e-6;

const plain = (value) => JSON.parse(JSON.stringify(value));
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const words = (text) => normalizeText(text).split(/[^a-z]+/).filter((word) => word.length >= 4);
const centreOf = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const boundsOf = (region) => (region.kind === "rect" ? { x: region.x, y: region.y, w: region.w, h: region.h } : { x: region.cx - region.r, y: region.cy - region.r, w: 2 * region.r, h: 2 * region.r });
const contains = (outer, inner, slack = 0) =>
  inner.x >= outer.x - slack && inner.y >= outer.y - slack && inner.x + inner.w <= outer.x + outer.w + slack && inner.y + inner.h <= outer.y + outer.h + slack;

// --- the tree's engine ---------------------------------------------------------------------------

function engine(tree) {
  return cached(tree, "interactions:engine", () => {
    const graph = createModuleGraph({ tree, mocks: {}, globals: {} });
    const registry = graph.require(FILES.scenes);
    return {
      graph,
      registry,
      scenes: registry.SCENES,
      byId: Object.fromEntries(registry.SCENES.map((scene) => [scene.id, scene])),
      contract: graph.require(FILES.scene),
      model: graph.require(FILES.model),
      rounds: graph.require(FILES.rounds),
      camera: graph.require(FILES.camera),
      difficulty: tree.exists(DIFFICULTY_FILE) ? graph.require(DIFFICULTY_FILE) : null,
      clues: tree.exists(CLUES_FILE) ? graph.require(CLUES_FILE) : null,
    };
  });
}
/** The pieces' engine (absent on the base: this throws there). */
function pieces(tree) {
  return cached(tree, "interactions:pieces", () => {
    if (!tree.exists(INTERACTIONS_FILE)) throw new Error("no movable pieces on this tree");
    return engine(tree).graph.require(INTERACTIONS_FILE);
  });
}
const room = (tree, id) => engine(tree).byId[id];
const piecesOf = (scene) => {
  if (!Array.isArray(scene.interactables)) throw new Error(`${scene.id} declares no pieces`);
  return scene.interactables;
};
const gatedOf = (scene) => scene.pool.filter((t) => t.gate);
const openState = (piece) => piece.states.find((s) => s.open);
const shutState = (piece) => piece.states.find((s) => s.id === piece.initial);

/** A seed (from 1 up) whose round in (room, difficulty) satisfies `predicate(ids)`; null if none in the first 200 000. */
function seedWhere(tree, scene, difficulty, predicate) {
  return cached(tree, `interactions:seed:${scene.id}:${difficulty}:${predicate.key}`, () => {
    const { rounds } = engine(tree);
    for (let seed = 1; seed < 200_000; seed += 1) if (predicate(rounds.selectRoundTargets(scene, difficulty, seed))) return seed;
    return null;
  });
}
const listing = (id) => Object.assign((ids) => ids.includes(id), { key: `has:${id}` });
const notListing = (id) => Object.assign((ids) => !ids.includes(id), { key: `not:${id}` });

/**
 * The real game, mounted the way GameScreen mounts it: `seeds` are what the
 * platform's random source hands out, in order. The pieces' helpers read the
 * DOM the view renders (each piece's picture and its keyboard button).
 */
function openGame(tree, { viewport = DESKTOP, reducedMotion = false, seeds = [] } = {}) {
  const env = createEnvironment({ viewport, reducedMotion, seeds });
  const harness = createReact(env.createNode);
  const graph = createModuleGraph({ tree, mocks: browserMocks(harness), globals: env.globals });
  const registry = graph.require(FILES.scenes);
  const { HiddenObjectsGame } = graph.require(FILES.game);
  const model = graph.require(FILES.model);
  const cam = graph.require(FILES.camera);
  const calls = { complete: [] };
  const props = {
    onComplete: (result) => calls.complete.push(plain(result)),
    onExit: () => {},
    onEntryReady: () => {},
    onEntryError: () => {},
  };
  harness.mount(harness.jsxRuntime.jsx(HiddenObjectsGame, props));
  const cls = (name) => (entry) => typeof entry.props.className === "string" && entry.props.className.split(/\s+/).includes(name);
  const host = (predicate) => harness.hosts(predicate)[0] ?? null;
  const flushFrames = (count) => {
    for (let i = 0; i < count; i += 1) {
      env.clock.frame();
      harness.flush();
    }
  };
  const game = {
    env,
    harness,
    graph,
    registry,
    model,
    cam,
    calls,
    shell: () => host(cls("hos-shell"))?.props ?? {},
    status: () => game.shell()["data-status"] ?? null,
    sceneId: () => game.shell()["data-scene"] ?? null,
    scene: () => registry.sceneById(game.sceneId()),
    seed: () => (game.shell()["data-round-seed"] === undefined ? null : Number(game.shell()["data-round-seed"])),
    items: () =>
      harness.hosts(cls("hos-item")).map((entry) => ({ id: entry.props["data-target"], text: entry.text, aria: entry.props["aria-label"], found: entry.props["data-found"] === "true", entry })),
    listed: () => game.items().map((item) => item.id),
    found: () => game.items().filter((item) => item.found).map((item) => item.id),
    texts: () => game.items().map((item) => item.text),
    banner: () => host(cls("hos-hint-banner"))?.text ?? null,
    live: () => harness.hosts((entry) => entry.props["aria-live"] === "polite")[0]?.text ?? "",
    halo: () => {
      const entry = host(cls("hos-halo"));
      if (!entry) return null;
      const style = entry.props.style;
      return { reveal: cls("hos-halo-reveal")(entry), cx: parseFloat(style["--hos-halo-x"]), cy: parseFloat(style["--hos-halo-y"]), r: parseFloat(style["--hos-halo-r"]) };
    },
    /** Every piece the view paints: its state, as the picture and the keyboard button say it. */
    pieces: () =>
      Object.fromEntries(
        harness.hosts((e) => e.type === IMAGE && cls("hos-piece")(e)).map((e) => {
          const button = host((b) => b.type === "button" && cls("hos-piece-key")(b) && b.props["data-piece"] === e.props["data-piece"]);
          return [e.props["data-piece"], { state: e.props["data-state"], open: e.props["data-open"] === "true", transform: e.props.style?.transform, expanded: button?.props["aria-expanded"] ?? null, button }];
        }),
      ),
    pieceStates: () => Object.fromEntries(Object.entries(game.pieces()).map(([id, p]) => [id, p.state])),
    pieceFocusRing: () => host(cls("hos-piece-focus"))?.props["data-piece"] ?? null,
    sceneView: () => harness.components("HiddenObjectsScene")[0]?.props ?? null,
    get controller() {
      return game.sceneView()?.controllerRef.current ?? null;
    },
    get viewport() {
      return env.node("hos-viewport");
    },
    button: (predicate) => host((entry) => entry.type === "button" && predicate(entry)),
    click(predicate) {
      const entry = game.button(predicate);
      if (!entry) throw new Error("no such button on screen");
      if (entry.props.disabled) throw new Error(`button "${entry.text || entry.props["aria-label"]}" is disabled`);
      entry.props.onClick?.({ preventDefault() {}, currentTarget: entry.node, target: entry.node });
      harness.flush();
    },
    chooseScene(id) {
      const radio = host((entry) => entry.type === "input" && entry.props.name === "hos-scene" && entry.props.value === id);
      if (!radio) throw new Error(`no scene option ${id}`);
      radio.props.onChange?.({ target: radio.node, currentTarget: radio.node });
      harness.flush();
    },
    chooseDifficulty(level) {
      const radio = host((entry) => entry.type === "input" && entry.props.name === "hos-difficulty" && entry.props.value === level);
      radio.props.onChange?.({ target: radio.node, currentTarget: radio.node });
      harness.flush();
    },
    explore() {
      game.click((entry) => cls("hos-primary")(entry) && entry.text === "Explorar");
      game.settle();
    },
    async decode() {
      for (const entry of harness.hosts((e) => e.type === IMAGE && cls("hos-layer")(e))) entry.props.onLoad?.({ currentTarget: entry.node, target: entry.node });
      await drain();
      harness.flush();
      flushFrames(4);
    },
    frames: flushFrames,
    settle(limit = 240) {
      for (let i = 0; i < limit && env.clock.pending().frames > 0; i += 1) flushFrames(1);
    },
    size: () => game.controller.getViewportSize(),
    camera: () => game.controller.getCamera(),
    client(point) {
      const local = cam.sceneToViewport(game.scene(), point, game.camera(), game.size());
      const rect = game.viewport.getBoundingClientRect();
      return { x: rect.left + local.x, y: rect.top + local.y };
    },
    pointer(type, init) {
      game.viewport.dispatch(type, init);
      harness.flush();
    },
    tapScene(point, { pointerType = "mouse", id = 1, jitter = 0 } = {}) {
      const c = game.client(point);
      game.pointer("pointerdown", { pointerId: id, clientX: c.x, clientY: c.y, pointerType, button: 0 });
      if (jitter) game.pointer("pointermove", { pointerId: id, clientX: c.x + jitter, clientY: c.y - jitter, pointerType });
      game.pointer("pointerup", { pointerId: id, clientX: c.x + jitter, clientY: c.y - jitter, pointerType, button: 0 });
    },
    /** Bring a room rectangle on screen (as "Mostrar onde está" frames, but the test's own move). */
    frame(bounds) {
      game.controller.reveal(bounds);
      game.settle();
    },
    hitOf: (pieceId) => {
      const scene = game.scene();
      const piece = scene.interactables.find((p) => p.id === pieceId);
      const state = piece.states.find((s) => s.id === game.pieces()[pieceId].state);
      return state.hit;
    },
    /** A tap on a piece, where it is now, framed first. */
    tapPiece(pieceId, options = {}) {
      game.frame(game.hitOf(pieceId));
      game.tapScene(centreOf(game.hitOf(pieceId)), options);
      game.settle();
    },
    pressPieceKey(pieceId) {
      game.click((entry) => cls("hos-piece-key")(entry) && entry.props["data-piece"] === pieceId);
      game.settle();
    },
    focusPieceKey(pieceId) {
      const entry = game.button((b) => cls("hos-piece-key")(b) && b.props["data-piece"] === pieceId);
      entry.props.onFocus?.({ currentTarget: entry.node, target: entry.node });
      harness.flush();
      game.settle();
    },
    blurPieceKey(pieceId) {
      const entry = game.button((b) => cls("hos-piece-key")(b) && b.props["data-piece"] === pieceId);
      entry.props.onBlur?.({ currentTarget: entry.node, target: entry.node });
      harness.flush();
    },
    /** Tap an object's centre, framed (whatever is in front of it). */
    tapObject(id, options = {}) {
      const target = model.targetById(game.scene(), id);
      game.frame(boundsOf(target.region));
      game.tapScene(model.regionCenter(target.region), options);
      game.settle();
    },
    /** The player's find: open its piece if it is shut, then tap it. */
    find(id) {
      const target = model.targetById(game.scene(), id);
      if (target.gate && !game.pieces()[target.gate].open) game.tapPiece(target.gate);
      game.tapObject(id);
    },
    focus(id) {
      const item = game.items().find((candidate) => candidate.id === id);
      item.entry.props.onClick?.({ preventDefault() {}, currentTarget: item.entry.node, target: item.entry.node });
      harness.flush();
    },
    hint() {
      game.click(cls("hos-hint-button"));
      game.settle();
    },
    restart() {
      game.click((entry) => entry.props["aria-label"] === "Recomeçar a exploração");
      game.settle();
    },
    changeScene() {
      game.click((entry) => entry.props["aria-label"] === "Trocar de cena");
      game.settle();
    },
    goTo(stationId) {
      const label = game.scene().stations.find((s) => s.id === stationId).label;
      game.click((entry) => cls("hos-station")(entry) && entry.text === label);
      game.settle();
    },
    drag(from, to, { steps = 8, pointerType = "mouse", id = 3 } = {}) {
      game.pointer("pointerdown", { pointerId: id, clientX: from.x, clientY: from.y, pointerType, button: 0 });
      for (let i = 1; i <= steps; i += 1) {
        game.pointer("pointermove", { pointerId: id, clientX: from.x + ((to.x - from.x) * i) / steps, clientY: from.y + ((to.y - from.y) * i) / steps, pointerType });
        flushFrames(1);
      }
      game.pointer("pointerup", { pointerId: id, clientX: to.x, clientY: to.y, pointerType, button: 0 });
      game.settle();
    },
    pinch(centre, { from = 16, to = 140, steps = 8 } = {}) {
      const at = (distance, sign) => ({ clientX: centre.x + (sign * distance) / 2, clientY: centre.y });
      game.pointer("pointerdown", { pointerId: 11, pointerType: "touch", button: 0, ...at(from, -1) });
      game.pointer("pointerdown", { pointerId: 12, pointerType: "touch", button: 0, ...at(from, 1) });
      for (let i = 1; i <= steps; i += 1) {
        const distance = from + ((to - from) * i) / steps;
        game.pointer("pointermove", { pointerId: 12, pointerType: "touch", ...at(distance, 1) });
        game.pointer("pointermove", { pointerId: 11, pointerType: "touch", ...at(distance, -1) });
        flushFrames(1);
      }
      game.pointer("pointerup", { pointerId: 12, pointerType: "touch", button: 0, ...at(to, 1) });
      game.pointer("pointerup", { pointerId: 11, pointerType: "touch", button: 0, ...at(to, -1) });
      game.settle();
    },
    wheel(point, deltaY) {
      game.viewport.dispatch("wheel", { deltaY, deltaMode: 0, ctrlKey: false, clientX: point.x, clientY: point.y });
      harness.flush();
      flushFrames(14);
    },
    key(key) {
      game.viewport.dispatch("keydown", { key });
      harness.flush();
      game.settle();
    },
    centre() {
      const rect = game.viewport.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    },
    resize({ width, height }) {
      game.viewport.rect = { ...game.viewport.rect, width, height };
      for (const observer of env.observers) if (observer.connected) observer.callback([], observer);
      harness.flush();
      game.settle();
    },
    finish() {
      for (const id of game.listed()) if (!game.items().find((item) => item.id === id).found) game.find(id);
      flushFrames(60);
      game.click((entry) => entry.text === "Concluir exploração");
      return calls.complete.at(-1) ?? null;
    },
    unmount: () => harness.unmount(),
  };
  return game;
}

/** A fresh round in `sceneId` on `difficulty`, drawn with `seed`. */
async function startIn(tree, sceneId, difficulty, seed, options = {}) {
  const game = openGame(tree, { ...options, seeds: [seed, ...(options.seeds ?? [])] });
  if (sceneId !== game.sceneId()) game.chooseScene(sceneId);
  await game.decode();
  game.chooseDifficulty(difficulty);
  game.explore();
  return game;
}

/** A session through the pure reducer, started on (room, difficulty, seed). */
function session(tree, scene, difficulty, seed) {
  const { model } = engine(tree);
  const R = model.sessionReducer;
  return R(R(model.createSession(scene), { type: "select-difficulty", difficulty }), { type: "start", seed });
}

/** Results as each earlier mission saved them (and a Trilha result, older still). */
const OLD_RESULTS = [
  { id: "hidden-objects-1759900000000", activityId: GAME, activityTitle: "Estúdio das Descobertas", gameId: GAME, score: 5, playedAt: "2026-10-06T18:00:00.000Z", summary: "Você encontrou todos os objetos do Estúdio.", details: { difficulty: "easy", foundObjects: 5, totalObjects: 5, completed: true } },
  { id: "hidden-objects-1760000000000", activityId: GAME, activityTitle: "Estúdio das Descobertas", gameId: GAME, score: 6, playedAt: "2026-10-08T18:00:00.000Z", summary: "Você encontrou todos os objetos do Estúdio.", details: { difficulty: "medium", foundObjects: 6, totalObjects: 6, completed: true, sceneId: STUDIO_ID, roundSeed: 202 } },
  { id: "hidden-objects-1760200000000", activityId: GAME, activityTitle: "Estúdio das Descobertas", gameId: GAME, score: 8, playedAt: "2026-10-11T18:00:00.000Z", summary: "Você encontrou todos os objetos do Observatório.", details: { difficulty: "hard", foundObjects: 8, totalObjects: 8, completed: true, sceneId: OBSERVATORY_ID, roundSeed: 4242 } },
  { id: "number-trail-1759600000000", activityId: "number-trail", activityTitle: "Trilha Lógica", gameId: "number-trail", score: 340, playedAt: "2026-10-04T18:00:00.000Z", summary: "Você iluminou 2 trilhas completas na Trilha Lógica.", details: { level: 3, currentNumber: 12, errors: 0, roundsCompleted: 2, correctNumbers: 12, maxErrors: 3 } },
];
const RESULT_DETAIL_KEYS = ["completed", "difficulty", "foundObjects", "roundSeed", "sceneId", "totalObjects"];

// --- the checks ----------------------------------------------------------------------------------------

const BASE_TREE = openSourceTree({ rev: BASE });

async function runChecks(tree) {
  const results = [];
  const check = async (id, tag, name, body) => {
    try {
      const { pass, ...detail } = await body();
      results.push({ id, tag, name, pass: Boolean(pass), detail });
    } catch (error) {
      results.push({ id, tag, name, pass: false, detail: { threw: String(error?.message ?? error).split("\n")[0] } });
    }
  };

  // --- the contract --------------------------------------------------------------------------------------

  await check("I01", "interactions", "BOTH_ROOMS_DECLARE_VALID_PIECES", () => {
    const { scenes, contract } = engine(tree);
    const problems = [];
    const kinds = new Set();
    const perRoom = {};
    for (const scene of scenes) {
      const list = piecesOf(scene);
      const p = (message) => problems.push(`${scene.id}: ${message}`);
      if (list.length < PIECES_PER_ROOM.min || list.length > PIECES_PER_ROOM.max) p(`${list.length} pieces`);
      const base = scene.layers.find((l) => l.id === "plate").src.replace(/\/[^/]+$/, "");
      for (const piece of list) {
        const q = (message) => p(`${piece.id}: ${message}`);
        kinds.add(piece.kind);
        if (!KINDS.includes(piece.kind)) q(`kind ${piece.kind}`);
        if (!piece.label?.trim() || !piece.accessibleLabel?.trim() || !piece.hintAction?.trim()) q("an empty label");
        if (!scene.stations.some((s) => s.id === piece.station)) q(`station ${piece.station}`);
        const c = centreOf(piece.rect);
        const station = scene.stations.find((s) => c.x >= s.span.x0 && c.x < s.span.x1)?.id;
        if (station !== piece.station) q(`painted in ${station}, said to be in ${piece.station}`);
        if (!piece.src?.startsWith(`${base}/pieces/`) || !tree.exists(`public${piece.src}`)) q(`art ${piece.src} not in the room's kit`);
        const r = piece.rect;
        if (!(r.w > 0 && r.h > 0 && r.x >= 0 && r.y >= 0 && r.x + r.w <= scene.width && r.y + r.h <= scene.height)) q("rect outside the room");
        if (!(piece.origin.x >= 0 && piece.origin.x <= r.w && piece.origin.y >= 0 && piece.origin.y <= r.h)) q("origin outside its rect");
        const ids = piece.states.map((s) => s.id);
        if (ids.length < 2 || new Set(ids).size !== ids.length) q(`states ${ids.join(",")}`);
        if (!ids.includes(piece.initial)) q(`initial ${piece.initial} is not a state`);
        if (shutState(piece)?.open !== false) q("does not start shut");
        if (!piece.states.some((s) => s.open)) q("never opens");
        for (const s of piece.states) {
          if (!/^[A-ZÀ-Ú].*\.$/.test(s.announce ?? "")) q(`${s.id}: announce "${s.announce}"`);
          if (!(s.hit.w > 0 && s.hit.h > 0)) q(`${s.id}: no hit area`);
        }
        if (!(piece.motionMs > 0 && piece.motionMs <= 1000)) q(`motion ${piece.motionMs} ms`);
        if (!scene.pool.some((t) => t.gate === piece.id)) q("keeps nothing");
      }
      for (const t of gatedOf(scene)) {
        const piece = list.find((x) => x.id === t.gate);
        if (!piece) p(`${t.id}: gate ${t.gate} is not a piece of the room`);
        else if (piece.station !== t.station) p(`${t.id}: kept in another station's piece`);
      }
      perRoom[scene.id] = list.map((piece) => `${piece.id} (${piece.kind}) → ${gatedOf(scene).filter((t) => t.gate === piece.id).map((t) => t.id).join(",")}`);
    }
    // the round rule knows the pieces: every difficulty bounds the objects kept behind them
    const bounds = Object.fromEntries(DIFFICULTIES.map((d) => [d, contract.DIFFICULTY_PRESETS[d].round.gated]));
    if (!same(plain(bounds), GATED_BOUNDS)) problems.push(`gated bounds ${JSON.stringify(bounds)}`);
    const missingKinds = KINDS.filter((k) => !kinds.has(k));
    return { pass: problems.length === 0 && missingKinds.length === 0, perRoom, kinds: [...kinds], missingKinds, gatedBounds: bounds, problems: problems.slice(0, 8), problemCount: problems.length };
  });

  await check("I02", "interactions", "PIECE_IDS_ARE_UNIQUE_AND_DATA_DRIVEN", () => {
    const { scenes, model } = engine(tree);
    const ip = pieces(tree);
    const problems = [];
    for (const scene of scenes) {
      const ids = piecesOf(scene).map((piece) => piece.id);
      const others = new Set([...scene.pool.map((t) => t.id), ...scene.lookAlikes.map((l) => l.id), ...scene.stations.map((s) => s.id), scene.id]);
      if (new Set(ids).size !== ids.length) problems.push(`${scene.id}: duplicate piece ids`);
      for (const id of ids) if (others.has(id)) problems.push(`${scene.id}: ${id} is also another thing's id`);
      // the engine only knows what the data says: a copy of the room with its pieces renamed and moved plays by the copy
      const moved = piecesOf(scene).map((piece, i) => ({
        ...piece,
        id: `peca-${i}`,
        states: piece.states.map((s) => ({ ...s, id: `${s.id}-x`, hit: { ...s.hit, x: s.hit.x + 7, y: s.hit.y + 5 } })),
        initial: `${piece.initial}-x`,
      }));
      const copy = { ...scene, id: `${scene.id}-copia`, interactables: moved, pool: scene.pool.map((t) => (t.gate ? { ...t, gate: `peca-${piecesOf(scene).findIndex((piece) => piece.id === t.gate)}` } : t)) };
      const R = model.sessionReducer;
      let s = R(R(model.createSession(copy), { type: "select-difficulty", difficulty: "easy" }), { type: "start", seed: 7 });
      if (!same(plain(s.interactions), Object.fromEntries(moved.map((piece) => [piece.id, piece.initial])))) problems.push(`${scene.id}: the copy does not start as its data says`);
      for (const piece of moved) {
        s = R(s, { type: "tap", point: centreOf(shutState(piece).hit), scale: 1, pointerType: "mouse" });
        if (s.interactions[piece.id] !== openState(piece).id) problems.push(`${scene.id}: a tap on the copy's ${piece.id} did not open it`);
        if (s.lastEvent?.kind !== "interact" || s.lastEvent.interactableId !== piece.id) problems.push(`${scene.id}: the copy's ${piece.id} sent no event`);
      }
      if (ip.initialInteractions(copy)[moved[0].id] !== moved[0].initial) problems.push(`${scene.id}: initialInteractions ignores the data`);
    }
    return { pass: problems.length === 0, problems: problems.slice(0, 8) };
  });

  await check("I03", "interactions", "THE_ENGINE_HAS_NO_ROOM_OR_PIECE_BRANCH", () => {
    const { scenes } = engine(tree);
    const names = new Set();
    for (const scene of scenes) {
      names.add(scene.id);
      for (const s of scene.stations) names.add(s.id);
      for (const t of scene.pool) names.add(t.id);
      for (const piece of piecesOf(scene)) {
        names.add(piece.id);
        for (const s of piece.states) names.add(s.id);
      }
    }
    const named = [];
    const branches = [];
    if (!tree.exists(INTERACTIONS_FILE)) named.push("no interactions engine");
    for (const file of ENGINE_FILES.filter((f) => tree.exists(f))) {
      const code = codeOnly(tree.read(file));
      for (const name of names) if (new RegExp(`["'\`/]${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\`/]`).test(code)) named.push(`${file.replace(DIR, "")}: ${name}`);
      // no comparison of an id or a kind with a literal: the engine branches on data, never on names
      for (const m of code.matchAll(/\b(piece|scene|room|interactable|target|t)\.(id|kind|station|gate|initial)\s*[!=]==?\s*["'`]/g)) branches.push(`${file.replace(DIR, "")}: …${m[0]}`);
    }
    return { pass: named.length === 0 && branches.length === 0, engineNamesARoomOrPiece: named.slice(0, 8), literalBranches: branches.slice(0, 8) };
  });

  // --- the life of a piece -------------------------------------------------------------------------------

  await check("I04", "interactions", "EVERY_PIECE_STARTS_AS_AUTHORED", async () => {
    const { scenes, model } = engine(tree);
    const problems = [];
    for (const scene of scenes) {
      const authored = Object.fromEntries(piecesOf(scene).map((piece) => [piece.id, piece.initial]));
      if (!same(plain(model.createSession(scene).interactions), authored)) problems.push(`${scene.id}: setup`);
      for (const d of DIFFICULTIES) if (!same(plain(session(tree, scene, d, 41).interactions), authored)) problems.push(`${scene.id}/${d}: start`);
      const game = await startIn(tree, scene.id, "medium", 0x0404);
      const shown = game.pieces();
      for (const piece of piecesOf(scene)) {
        const v = shown[piece.id];
        if (!v) problems.push(`${scene.id}/${piece.id}: not painted`);
        else if (v.state !== piece.initial || v.open || v.expanded !== false) problems.push(`${scene.id}/${piece.id}: starts ${v.state} (expanded ${v.expanded})`);
      }
      game.unmount();
    }
    return { pass: problems.length === 0, problems };
  });

  await check("I05", "interactions", "A_TAP_STEPS_THE_AUTHORED_STATES", async () => {
    const problems = [];
    const said = {};
    for (const id of SCENE_IDS) {
      const scene = room(tree, id);
      const game = await startIn(tree, id, "easy", 0x0505);
      for (const piece of piecesOf(scene)) {
        const steps = [];
        for (let i = 0; i < piece.states.length; i += 1) {
          for (const pointerType of i % 2 ? ["touch"] : ["mouse"]) game.tapPiece(piece.id, { pointerType });
          const v = game.pieces()[piece.id];
          const expected = piece.states[(i + 1) % piece.states.length];
          steps.push(v.state);
          if (v.state !== expected.id || v.open !== expected.open || v.expanded !== expected.open) problems.push(`${id}/${piece.id}: tap ${i + 1} → ${v.state}`);
          if (game.live() !== expected.announce) problems.push(`${id}/${piece.id}: says "${game.live()}"`);
          if (!v.transform?.includes("translate(")) problems.push(`${id}/${piece.id}: no pose written`);
        }
        said[`${id}/${piece.id}`] = steps.join(" → ");
      }
      game.unmount();
    }
    return { pass: problems.length === 0, said, problems: problems.slice(0, 8) };
  });

  await check("I06", "interactions", "THE_KEYBOARD_MOVES_EVERY_PIECE", async () => {
    const problems = [];
    for (const id of SCENE_IDS) {
      const scene = room(tree, id);
      const game = await startIn(tree, id, "hard", 0x0606);
      for (const piece of piecesOf(scene)) {
        const button = game.pieces()[piece.id].button;
        if (!button) {
          problems.push(`${id}/${piece.id}: no button`);
          continue;
        }
        if (button.props["aria-label"] !== piece.accessibleLabel) problems.push(`${id}/${piece.id}: labelled "${button.props["aria-label"]}"`);
        if (button.props.type !== "button") problems.push(`${id}/${piece.id}: not a native button (Enter and Space)`);
        // focus: the piece is outlined and brought into view; nothing moves
        game.focusPieceKey(piece.id);
        if (game.pieceFocusRing() !== piece.id) problems.push(`${id}/${piece.id}: focus draws no outline`);
        const view = game.cam.visibleRect(scene, game.camera(), game.size());
        if (!intersects(view, shutState(piece).hit)) problems.push(`${id}/${piece.id}: focus leaves it off screen`);
        if (game.pieces()[piece.id].state !== piece.initial) problems.push(`${id}/${piece.id}: focus moved it`);
        // Enter / Space on a native button is a click
        game.pressPieceKey(piece.id);
        if (!game.pieces()[piece.id].open || game.pieces()[piece.id].expanded !== true) problems.push(`${id}/${piece.id}: the button did not open it`);
        if (game.live() !== openState(piece).announce) problems.push(`${id}/${piece.id}: the button's step is not announced`);
        game.pressPieceKey(piece.id);
        if (game.pieces()[piece.id].state !== piece.initial) problems.push(`${id}/${piece.id}: the button did not shut it again`);
        game.blurPieceKey(piece.id);
        if (game.pieceFocusRing() !== null) problems.push(`${id}/${piece.id}: the outline stays after blur`);
      }
      // the reticle: the room's own keyboard tap (Enter) on a piece centred in the view
      const piece = piecesOf(scene)[0];
      game.frame(shutState(piece).hit);
      game.key("Enter");
      if (!game.pieces()[piece.id].open) problems.push(`${id}: Enter on the reticle over ${piece.id} did not open it`);
      game.unmount();
    }
    return { pass: problems.length === 0, problems: problems.slice(0, 8) };
  });

  await check("I07", "interactions", "REDUCED_MOTION_KEEPS_EVERY_STATE", async () => {
    const problems = [];
    const css = tree.read(FILES.css);
    const block = mediaBlock(css, "prefers-reduced-motion: reduce") ?? "";
    if (!/\.hos-piece\s*\{[^}]*transition:\s*none/.test(block)) problems.push("reduced motion does not stop the pieces' transition");
    if (!/\.hos-piece\s*\{[^}]*transition:/.test(css.replace(block, ""))) problems.push("the pieces have no transition to stop");
    for (const id of SCENE_IDS) {
      const scene = room(tree, id);
      const still = await startIn(tree, id, "medium", 0x0707, { reducedMotion: true });
      const moving = await startIn(tree, id, "medium", 0x0707);
      for (const piece of piecesOf(scene)) {
        still.tapPiece(piece.id);
        moving.tapPiece(piece.id);
        const a = still.pieces()[piece.id];
        const b = moving.pieces()[piece.id];
        if (a.state !== b.state || a.transform !== b.transform || !a.open || a.expanded !== true) problems.push(`${id}/${piece.id}: reduced motion ${a.state} vs ${b.state}`);
        if (still.live() !== moving.live()) problems.push(`${id}/${piece.id}: reduced motion says something else`);
      }
      // the gated objects are found the same way
      const target = gatedOf(scene).find((t) => still.listed().includes(t.id));
      if (target) {
        still.tapObject(target.id);
        if (!still.found().includes(target.id)) problems.push(`${id}: ${target.id} not found with reduced motion`);
      }
      still.unmount();
      moving.unmount();
    }
    return { pass: problems.length === 0, problems: problems.slice(0, 8) };
  });

  await check("I08", "interactions", "A_CAMERA_DRAG_NEVER_MOVES_A_PIECE", async () => {
    const problems = [];
    for (const id of SCENE_IDS) {
      const scene = room(tree, id);
      const game = await startIn(tree, id, "easy", 0x0808);
      for (const piece of piecesOf(scene)) {
        for (const pointerType of ["mouse", "touch"]) {
          game.frame(shutState(piece).hit);
          const from = game.client(centreOf(shutState(piece).hit));
          const before = game.camera();
          game.drag(from, { x: from.x + 160, y: from.y + 40 }, { pointerType });
          if (nearCamera(before, game.camera())) problems.push(`${id}/${piece.id}: a ${pointerType} drag from it did not pan`);
          if (game.pieces()[piece.id].state !== piece.initial) problems.push(`${id}/${piece.id}: a ${pointerType} drag from it moved it`);
          // and a drag across it, ending on it
          const start = game.client({ x: piece.rect.x - 200, y: piece.rect.y });
          game.drag(start, game.client(centreOf(shutState(piece).hit)), { pointerType });
          if (game.pieces()[piece.id].state !== piece.initial) problems.push(`${id}/${piece.id}: a ${pointerType} drag onto it moved it`);
        }
        // a pinch on it zooms, never opens
        game.frame(shutState(piece).hit);
        game.pinch(game.client(centreOf(shutState(piece).hit)));
        if (game.pieces()[piece.id].state !== piece.initial) problems.push(`${id}/${piece.id}: a pinch on it moved it`);
      }
      game.unmount();
    }
    return { pass: problems.length === 0, problems: problems.slice(0, 8) };
  });

  await check("I09", "interactions", "A_PIECE_TAP_NEVER_PANS", async () => {
    const problems = [];
    for (const id of SCENE_IDS) {
      const scene = room(tree, id);
      for (const viewport of [DESKTOP, REFERENCE_PHONE]) {
        const game = await startIn(tree, id, "medium", 0x0909, { viewport });
        for (const piece of piecesOf(scene)) {
          game.frame(shutState(piece).hit);
          for (const [pointerType, jitter] of [["mouse", 0], ["touch", 0], ["touch", 5]]) {
            const before = game.camera();
            const state = game.pieces()[piece.id].state;
            game.tapScene(centreOf(game.hitOf(piece.id)), { pointerType, jitter });
            game.settle();
            if (!nearCamera(before, game.camera())) problems.push(`${id}/${viewport.name}/${piece.id}: a ${pointerType} tap moved the camera`);
            if (game.pieces()[piece.id].state === state) problems.push(`${id}/${viewport.name}/${piece.id}: a ${pointerType} tap (jitter ${jitter}) did not step it`);
          }
        }
        game.unmount();
      }
    }
    return { pass: problems.length === 0, problems: problems.slice(0, 8) };
  });

  // --- what the pieces keep ------------------------------------------------------------------------------

  await check("I10", "interactions", "A_SHUT_PIECE_KEEPS_ITS_OBJECT_UNFINDABLE", async () => {
    const { scenes, model, contract } = engine(tree);
    const problems = [];
    let probes = 0;
    for (const scene of scenes) {
      const gated = gatedOf(scene);
      if (gated.length === 0) problems.push(`${scene.id}: nothing is kept behind a piece`);
      // the rules: with every piece shut, no tap anywhere on or near a kept object finds it, whatever the reach
      const shut = model.createSession(scene).interactions;
      for (const t of gated) {
        const b = boundsOf(t.region);
        for (const d of DIFFICULTIES) {
          for (const pointerType of ["mouse", "touch"]) {
            for (let i = 0; i <= 4; i += 1) {
              for (let j = 0; j <= 4; j += 1) {
                probes += 1;
                const point = { x: b.x + (b.w * i) / 4, y: b.y + (b.h * j) / 4 };
                const reachable = scene.pool.map((x) => x.id).filter((x) => model.isExposed(scene, shut, x));
                if (reachable.includes(t.id)) problems.push(`${scene.id}/${t.id}: exposed at rest`);
                if (model.hitTest(scene, point, reachable, 1, model.tolerancePxFor(d, pointerType)) === t.id) problems.push(`${scene.id}/${t.id}: hit at rest`);
              }
            }
          }
        }
        void contract;
      }
      // the real game: a round listing it, a tap on its centre through the shut piece
      for (const t of gated) {
        for (const d of ["easy", "hard"]) {
          const seed = seedWhere(tree, scene, d, listing(t.id));
          if (seed === null) continue;
          const game = await startIn(tree, scene.id, d, seed);
          game.tapObject(t.id);
          if (game.found().includes(t.id)) problems.push(`${scene.id}/${d}: ${t.id} found through its shut piece`);
          if (normalizeText(game.live()).includes(normalizeText(t.label))) problems.push(`${scene.id}/${d}: the live region names ${t.id} while it is shut away`);
          if (game.pieces()[t.gate].state === shutState(scene.interactables.find((p) => p.id === t.gate)).id && game.live() === "") problems.push(`${scene.id}/${d}: nothing at all answered the tap`);
          game.unmount();
        }
      }
    }
    return { pass: problems.length === 0, pointsProbed: probes, problems: problems.slice(0, 8), problemCount: problems.length };
  });

  await check("I11", "interactions", "OPENING_ITS_OWN_PIECE_EXPOSES_IT", async () => {
    const problems = [];
    const played = {};
    for (const id of SCENE_IDS) {
      const scene = room(tree, id);
      for (const t of gatedOf(scene)) {
        const seed = seedWhere(tree, scene, "medium", listing(t.id));
        if (seed === null) {
          problems.push(`${id}: no Médio round lists ${t.id}`);
          continue;
        }
        const game = await startIn(tree, id, "medium", seed);
        // every other piece open: still kept away
        for (const other of piecesOf(scene).filter((p) => p.id !== t.gate)) game.tapPiece(other.id);
        game.tapObject(t.id);
        if (game.found().includes(t.id)) problems.push(`${id}: opening other pieces exposed ${t.id}`);
        // its own piece open: the same tap finds it, same object, same place
        game.tapPiece(t.gate);
        game.tapObject(t.id);
        if (!game.found().includes(t.id)) problems.push(`${id}: ${t.id} not found with ${t.gate} open`);
        if (!normalizeText(game.live()).includes(normalizeText(t.label))) problems.push(`${id}: the find of ${t.id} is not announced`);
        played[`${id}/${t.id}`] = { seed, found: game.found().includes(t.id) };
        game.unmount();
      }
    }
    return { pass: problems.length === 0, played, problems: problems.slice(0, 8) };
  });

  await check("I12", "interactions", "AN_UNLISTED_OBJECT_BEHIND_A_PIECE_STAYS_SCENERY", async () => {
    const problems = [];
    for (const id of SCENE_IDS) {
      const scene = room(tree, id);
      for (const t of gatedOf(scene)) {
        const seed = seedWhere(tree, scene, "hard", notListing(t.id));
        const game = await startIn(tree, id, "hard", seed);
        const before = game.items().map((item) => [item.id, item.found]);
        game.tapPiece(t.gate);
        game.tapObject(t.id, { pointerType: "touch" });
        if (game.found().includes(t.id) || game.listed().includes(t.id)) problems.push(`${id}: ${t.id} became a find in a round that does not list it`);
        if (!same(game.items().map((item) => [item.id, item.found]), before)) problems.push(`${id}: the list changed`);
        if (normalizeText(game.live()).includes(normalizeText(t.label))) problems.push(`${id}: ${t.id} announced`);
        game.unmount();
      }
    }
    return { pass: problems.length === 0, problems: problems.slice(0, 8) };
  });

  // --- the life of an exploration ------------------------------------------------------------------------

  await check("I13", "interactions", "RECOMECAR_KEEPS_THE_ROUND_AND_SHUTS_THE_PIECES", async () => {
    const problems = [];
    for (const id of SCENE_IDS) {
      const scene = room(tree, id);
      const t = gatedOf(scene)[0];
      const seed = seedWhere(tree, scene, "medium", listing(t.id));
      const game = await startIn(tree, id, "medium", seed);
      const round = { seed: game.seed(), ids: game.listed(), texts: game.texts() };
      for (const piece of piecesOf(scene)) game.tapPiece(piece.id);
      game.tapObject(t.id);
      if (!game.found().includes(t.id)) problems.push(`${id}: ${t.id} not found before the restart`);
      game.restart();
      const after = { seed: game.seed(), ids: game.listed(), texts: game.texts() };
      if (!same(after, round)) problems.push(`${id}: the round changed on Recomeçar`);
      if (game.found().length) problems.push(`${id}: finds kept`);
      for (const piece of piecesOf(scene)) if (game.pieces()[piece.id].state !== piece.initial) problems.push(`${id}: ${piece.id} still ${game.pieces()[piece.id].state}`);
      game.tapObject(t.id);
      if (game.found().includes(t.id)) problems.push(`${id}: ${t.id} findable through its piece after Recomeçar`);
      game.unmount();
    }
    return { pass: problems.length === 0, problems };
  });

  await check("I14", "interactions", "PRACTISING_AGAIN_DRAWS_A_NEW_ROUND_WITH_SHUT_PIECES", async () => {
    const problems = [];
    for (const id of SCENE_IDS) {
      const scene = room(tree, id);
      // a whole exploration, then the platform's "Praticar outra vez": a new mount, a new seed, the same room
      const first = await startIn(tree, id, "easy", 0x1414, { seeds: [0x5151] });
      for (const piece of piecesOf(scene)) first.tapPiece(piece.id);
      const firstRound = first.listed();
      const result = first.finish();
      if (!result?.details.completed) problems.push(`${id}: the first exploration did not complete`);
      const remembered = first.registry.rememberedScene().id;
      first.unmount();
      if (remembered !== id) problems.push(`${id}: Praticar outra vez would open ${remembered}`);
      const again = await startIn(tree, id, "easy", 0x2424);
      if (again.sceneId() !== id || again.seed() !== 0x2424) problems.push(`${id}: the new exploration is not a new round of the room`);
      for (const piece of piecesOf(scene)) if (again.pieces()[piece.id].state !== piece.initial) problems.push(`${id}: ${piece.id} not shut on the new round`);
      if (same(again.listed(), firstRound)) problems.push(`${id}: the same list again`);
      again.unmount();
      // in the same mount: Trocar de cena, the same room, Explorar — a new seed, every piece shut
      const game = await startIn(tree, id, "medium", 0x3434, { seeds: [0x4343] });
      for (const piece of piecesOf(scene)) game.tapPiece(piece.id);
      game.changeScene();
      game.explore();
      if (game.seed() !== 0x4343) problems.push(`${id}: Explorar again did not draw a new seed`);
      for (const piece of piecesOf(scene)) if (game.pieces()[piece.id].state !== piece.initial) problems.push(`${id}: ${piece.id} kept open into a new exploration`);
      game.unmount();
    }
    return { pass: problems.length === 0, problems };
  });

  await check("I15", "interactions", "ANOTHER_ROOM_STARTS_WITH_ITS_OWN_PIECES", async () => {
    const problems = [];
    const game = await startIn(tree, STUDIO_ID, "easy", 0x1515, { seeds: [0x5115, 0x1551] });
    for (const piece of piecesOf(room(tree, STUDIO_ID))) game.tapPiece(piece.id);
    game.changeScene();
    game.chooseScene(OBSERVATORY_ID);
    await game.decode();
    game.explore();
    const observatory = room(tree, OBSERVATORY_ID);
    if (!same(sorted(Object.keys(game.pieces())), sorted(piecesOf(observatory).map((p) => p.id)))) problems.push(`the Observatório paints ${Object.keys(game.pieces()).join(",")}`);
    for (const piece of piecesOf(observatory)) if (game.pieces()[piece.id]?.state !== piece.initial) problems.push(`${piece.id} not as authored`);
    for (const piece of piecesOf(observatory)) game.tapPiece(piece.id);
    game.changeScene();
    game.chooseScene(STUDIO_ID);
    await game.decode();
    game.explore();
    for (const piece of piecesOf(room(tree, STUDIO_ID))) if (game.pieces()[piece.id]?.state !== piece.initial) problems.push(`back in the Estúdio, ${piece.id} remembered as ${game.pieces()[piece.id]?.state}`);
    if (Object.keys(game.pieces()).some((p) => piecesOf(observatory).some((o) => o.id === p))) problems.push("the Observatório's pieces leaked into the Estúdio");
    game.unmount();
    // the rules: a room never carries another room's pieces
    const { model } = engine(tree);
    const R = model.sessionReducer;
    let s = session(tree, room(tree, STUDIO_ID), "easy", 3);
    s = R(s, { type: "interact", interactableId: piecesOf(room(tree, STUDIO_ID))[0].id });
    s = R(R(s, { type: "change-scene" }), { type: "select-scene", scene: observatory });
    if (!same(plain(s.interactions), plain(model.createSession(observatory).interactions))) problems.push("the session carried the Estúdio's pieces into the Observatório");
    return { pass: problems.length === 0, problems };
  });

  await check("I16", "interactions", "NOTHING_BUT_THE_EXPLORADOR_MOVES_A_PIECE", async () => {
    const problems = [];
    for (const id of SCENE_IDS) {
      const scene = room(tree, id);
      const t = gatedOf(scene)[0];
      const game = await startIn(tree, id, "easy", seedWhere(tree, scene, "easy", listing(t.id)));
      const [opened, ...shut] = piecesOf(scene);
      game.tapPiece(opened.id);
      const snapshot = () => JSON.stringify(game.pieceStates());
      const expected = snapshot();
      const steps = [];
      const step = (name, run) => {
        run();
        steps.push(name);
        if (snapshot() !== expected) problems.push(`${id}: ${name} moved a piece (${snapshot()})`);
      };
      step("renders", () => {
        game.harness.flush();
        game.frames(30);
      });
      step("zoom buttons", () => {
        game.click((e) => e.props["aria-label"] === "Aproximar");
        game.click((e) => e.props["aria-label"] === "Afastar");
        game.settle();
      });
      step("wheel", () => game.wheel(game.centre(), -240));
      step("pinch", () => game.pinch(game.centre()));
      step("drag", () => game.drag(game.centre(), { x: game.centre().x - 300, y: game.centre().y }));
      step("stations", () => {
        for (const s of scene.stations) game.goTo(s.id);
      });
      step("keys", () => {
        for (const key of ["ArrowLeft", "+", "-", "0", "1"]) game.key(key);
      });
      step("resize", () => game.resize({ width: 600, height: 400 }));
      step("rotation", () => {
        game.resize({ width: REFERENCE_PHONE.width, height: REFERENCE_PHONE.height });
        game.resize({ width: REFERENCE_PHONE.height, height: REFERENCE_PHONE.width });
        game.resize({ width: DESKTOP.width, height: DESKTOP.height });
      });
      step("reduced motion turned on", () => {
        game.env.setReducedMotion(true);
        game.goTo(scene.stations[0].id);
        game.env.setReducedMotion(false);
      });
      step("hints, every rung", () => {
        game.focus(t.id);
        for (let i = 0; i < 4; i += 1) game.hint();
      });
      step("the tray", () => {
        game.click((e) => typeof e.props.className === "string" && e.props.className.includes("hos-tray-toggle"));
        game.click((e) => typeof e.props.className === "string" && e.props.className.includes("hos-tray-toggle"));
      });
      step("a piece's button focused and blurred", () => {
        game.focusPieceKey(shut[0].id);
        game.blurPieceKey(shut[0].id);
      });
      step("a free tap", () => {
        game.tapScene({ x: scene.width / 2, y: 40 });
        game.settle();
      });
      step("a find", () => {
        const plainOne = game.listed().find((x) => !scene.pool.find((p) => p.id === x).gate);
        game.tapObject(plainOne);
      });
      game.unmount();
      void steps;
    }
    return { pass: problems.length === 0, problems: problems.slice(0, 8) };
  });

  // --- the hints -----------------------------------------------------------------------------------------

  await check("I17", "interactions", "EASY_POINTS_AT_THE_PIECE_AND_LETS_THE_EXPLORADOR_OPEN_IT", async () => {
    const problems = [];
    const shown = {};
    for (const id of SCENE_IDS) {
      const scene = room(tree, id);
      for (const t of gatedOf(scene)) {
        const piece = piecesOf(scene).find((p) => p.id === t.gate);
        const seed = seedWhere(tree, scene, "easy", listing(t.id));
        if (seed === null) {
          problems.push(`${id}: no Fácil round lists ${t.id}`);
          continue;
        }
        const game = await startIn(tree, id, "easy", seed);
        game.focus(t.id);
        for (let press = 0; press < 3; press += 1) game.hint();
        const halo = game.halo();
        const hit = shutState(piece).hit;
        const c = centreOf(hit);
        if (!halo?.reveal || Math.hypot(halo.cx - c.x, halo.cy - c.y) > 1) problems.push(`${id}/${t.id}: the last rung does not ring the piece`);
        if (!(game.banner() ?? "").includes(piece.hintAction)) problems.push(`${id}/${t.id}: the last rung does not say what to open ("${game.banner()}")`);
        const view = game.cam.visibleRect(scene, game.camera(), game.size());
        if (!contains(view, hit)) problems.push(`${id}/${t.id}: the piece is not framed`);
        if (game.pieces()[piece.id].state !== piece.initial) problems.push(`${id}/${t.id}: the hint opened the piece`);
        if (game.found().includes(t.id)) problems.push(`${id}/${t.id}: the hint found it`);
        shown[`${id}/${t.id}`] = game.banner();
        // the Explorador opens it; the same rung now shows the object itself
        game.tapPiece(piece.id);
        game.hint();
        const after = game.halo();
        const o = game.model.regionCenter(t.region);
        if (!after?.reveal || Math.hypot(after.cx - o.x, after.cy - o.y) > 1) problems.push(`${id}/${t.id}: once open, the reveal does not show the object`);
        game.tapObject(t.id);
        if (!game.found().includes(t.id)) problems.push(`${id}/${t.id}: not found after the hint and the opening`);
        game.unmount();
      }
    }
    return { pass: problems.length === 0, shown, problems: problems.slice(0, 8) };
  });

  const hintsNeverPoint = async (difficulty) => {
    const problems = [];
    for (const id of SCENE_IDS) {
      const scene = room(tree, id);
      const { model } = engine(tree);
      for (const t of gatedOf(scene)) {
        const piece = piecesOf(scene).find((p) => p.id === t.gate);
        // the rules, for every rung and both piece states
        for (const states of [model.createSession(scene).interactions, { ...model.createSession(scene).interactions, [piece.id]: openState(piece).id }]) {
          for (let stage = 0; stage <= 4; stage += 1) {
            if (model.hintHalo(scene, t.id, difficulty, stage, states)) problems.push(`${id}/${difficulty}/${t.id}: a halo at ${stage}`);
            const move = model.hintCameraMove(scene, t.id, difficulty, stage, states);
            if (move && move.kind !== "station") problems.push(`${id}/${difficulty}/${t.id}: the camera ${move.kind}s at ${stage}`);
            if (model.revealedPiece?.(scene, t.id, difficulty, stage, states)) problems.push(`${id}/${difficulty}/${t.id}: a rung names its piece`);
          }
        }
        // the real game: every press, piece shut
        const seed = seedWhere(tree, scene, difficulty, listing(t.id));
        const game = await startIn(tree, id, difficulty, seed);
        game.focus(t.id);
        const pieceWords = new Set([...words(piece.label), ...words(piece.accessibleLabel)]);
        for (let press = 1; press <= 4; press += 1) {
          const before = game.camera();
          game.hint();
          if (game.halo()) problems.push(`${id}/${difficulty}/${t.id}: light at press ${press}`);
          if (/Aqui está/.test(game.banner() ?? "")) problems.push(`${id}/${difficulty}/${t.id}: "Aqui está" at press ${press}`);
          if (game.pieces()[piece.id].state !== piece.initial) problems.push(`${id}/${difficulty}/${t.id}: press ${press} opened ${piece.id}`);
          if (game.pieceFocusRing()) problems.push(`${id}/${difficulty}/${t.id}: press ${press} outlined a piece`);
          if (press > 1 && !nearCamera(before, game.camera())) problems.push(`${id}/${difficulty}/${t.id}: press ${press} moved the camera`);
          if (game.found().includes(t.id)) problems.push(`${id}/${difficulty}/${t.id}: found by a hint`);
          if (difficulty === "hard") {
            const said = new Set(words(`${game.banner() ?? ""} ${game.live()}`));
            const named = [...pieceWords].filter((w) => said.has(w));
            if (named.length) problems.push(`${id}/hard/${t.id}: press ${press} names its piece (${named.join(",")})`);
            if (normalizeText(game.banner() ?? "").includes(normalizeText(t.label))) problems.push(`${id}/hard/${t.id}: press ${press} names it`);
          }
        }
        game.unmount();
      }
    }
    return problems;
  };

  await check("I18", "interactions", "MEDIO_NEVER_REVEALS_A_KEPT_OBJECT", async () => {
    const problems = await hintsNeverPoint("medium");
    return { pass: problems.length === 0, problems: problems.slice(0, 8), problemCount: problems.length };
  });

  await check("I19", "interactions", "DIFICIL_NEVER_POINTS_AT_OR_OPENS_THE_PIECE", async () => {
    const problems = await hintsNeverPoint("hard");
    // and its context line never names the piece it is behind
    for (const scene of engine(tree).scenes) {
      for (const t of gatedOf(scene)) {
        const piece = piecesOf(scene).find((p) => p.id === t.gate);
        const pieceWords = new Set([...words(piece.label), ...words(piece.accessibleLabel)]);
        const named = words(t.hintContext).filter((w) => pieceWords.has(w));
        if (named.length) problems.push(`${scene.id}/${t.id}: its Difícil context names ${named.join(",")}`);
      }
    }
    return { pass: problems.length === 0, problems: problems.slice(0, 8), problemCount: problems.length };
  });

  // --- the round model -----------------------------------------------------------------------------------

  const roundFacts = () => cached(tree, "interactions:roundFacts", () => {
    const facts = {};
    const { rounds, difficulty } = engine(tree);
    for (const id of SCENE_IDS) {
      const scene = room(tree, id);
      facts[id] = {};
      for (const d of DIFFICULTIES) {
        const valid = rounds.validRounds(scene, d).map((ids) => [...ids]);
        const profiles = valid.map((ids) => difficulty.roundProfile(scene, d, ids));
        const gated = valid.map((ids) => ids.filter((x) => scene.pool.find((t) => t.id === x).gate).length);
        const histogram = {};
        for (const g of gated) histogram[g] = (histogram[g] ?? 0) + 1;
        const exposure = {};
        for (const ids of valid) for (const x of ids) if (scene.pool.find((t) => t.id === x).gate) exposure[x] = (exposure[x] ?? 0) + 1 / valid.length;
        facts[id][d] = { valid, profiles, gated, histogram, exposure, meanGated: mean(gated), meanSearch: mean(profiles.map((p) => p.search)) };
      }
    }
    return facts;
  });

  await check("I20", "interactions", "THE_ROUND_RULE_COUNTS_INTERACTION_DEPTH", () => {
    const { contract, rounds, difficulty } = engine(tree);
    const problems = [];
    const rejected = {};
    const facts = roundFacts();
    for (const id of SCENE_IDS) {
      const scene = room(tree, id);
      rejected[id] = {};
      for (const d of DIFFICULTIES) {
        const rule = contract.DIFFICULTY_PRESETS[d].round;
        const f = facts[id][d];
        f.profiles.forEach((p, i) => {
          if (p.gated !== f.gated[i]) problems.push(`${id}/${d}: a profile counts ${p.gated}, the round has ${f.gated[i]}`);
          if (p.gated < rule.gated[0] || p.gated > rule.gated[1]) problems.push(`${id}/${d}: a round keeps ${p.gated}`);
        });
        // the bound bites: rounds the rest of the rule accepts, rejected only for their depth
        const onlyDepth = rounds.candidateRounds(scene, d).filter((ids) => {
          const p = difficulty.roundProfile(scene, d, ids);
          return !difficulty.meetsRule(rule, p) && difficulty.meetsRule({ ...rule, gated: [0, ids.length] }, p);
        });
        rejected[id][d] = onlyDepth.length;
        if (d !== "easy" && onlyDepth.length === 0) problems.push(`${id}/${d}: the depth bound rejects nothing`);
        // the draw the game makes respects it
        for (let seed = 1; seed <= 1500; seed += 1) {
          const ids = rounds.selectRoundTargets(scene, d, seed * 7919);
          const g = ids.filter((x) => scene.pool.find((t) => t.id === x).gate).length;
          if (g < rule.gated[0] || g > rule.gated[1]) problems.push(`${id}/${d}: seed ${seed * 7919} keeps ${g}`);
        }
      }
    }
    return { pass: problems.length === 0, roundsRejectedOnlyForTheirDepth: rejected, problems: problems.slice(0, 8), problemCount: problems.length };
  });

  await check("I21", "interactions", "NO_ROUND_IS_ALL_DRAWERS", () => {
    const problems = [];
    const facts = roundFacts();
    const summary = {};
    for (const id of SCENE_IDS) {
      const scene = room(tree, id);
      summary[id] = {};
      for (const d of DIFFICULTIES) {
        const f = facts[id][d];
        const count = f.valid[0]?.length ?? 0;
        if (f.valid.length === 0) problems.push(`${id}/${d}: no round`);
        if (Math.max(...f.gated) > Math.floor(count / 2)) problems.push(`${id}/${d}: a round keeps ${Math.max(...f.gated)} of ${count} behind pieces`);
        if (d === "easy" && Math.max(...f.gated) > 1) problems.push(`${id}/easy: a round asks for several shut pieces`);
        if (d === "hard" && Math.min(...f.gated) < 1) problems.push(`${id}/hard: a round with nothing behind a piece`);
        for (const t of gatedOf(scene)) {
          const p = f.exposure[t.id] ?? 0;
          if (p > EXPOSURE_CEILING) problems.push(`${id}/${d}: ${t.id} in ${(p * 100).toFixed(0)}% of the rounds`);
        }
        const unlisted = gatedOf(scene).filter((t) => !(f.exposure[t.id] > 0)).map((t) => t.id);
        if (unlisted.length) problems.push(`${id}/${d}: ${unlisted.join(",")} never asked for`);
        summary[id][d] = { rounds: f.valid.length, keptBehindPieces: f.histogram, exposure: Object.fromEntries(Object.entries(f.exposure).map(([k, v]) => [k, Number(v.toFixed(3))])) };
      }
    }
    return { pass: problems.length === 0, summary, problems: problems.slice(0, 8), problemCount: problems.length };
  });

  await check("I22", "interactions", "EASY_MEDIUM_HARD_STAY_ORDERED", () => {
    const { contract } = engine(tree);
    const problems = [];
    const facts = roundFacts();
    const ordered = {};
    const b = DIFFICULTIES.map((d) => contract.DIFFICULTY_PRESETS[d].round.gated);
    if (!(b[0][0] <= b[1][0] && b[1][0] <= b[2][0] && b[0][1] < b[1][1] && b[1][1] < b[2][1])) problems.push(`the depth bounds do not climb: ${JSON.stringify(b)}`);
    for (const id of SCENE_IDS) {
      const search = DIFFICULTIES.map((d) => facts[id][d].meanSearch);
      const depth = DIFFICULTIES.map((d) => facts[id][d].meanGated);
      const minSearch = DIFFICULTIES.map((d) => Math.min(...facts[id][d].profiles.map((p) => p.search)));
      const maxSearch = DIFFICULTIES.map((d) => Math.max(...facts[id][d].profiles.map((p) => p.search)));
      if (!(search[0] < search[1] && search[1] < search[2])) problems.push(`${id}: search ${search.map((x) => x.toFixed(3)).join(" / ")}`);
      if (!(maxSearch[0] <= minSearch[1] + EPS && maxSearch[1] <= minSearch[2] + EPS)) problems.push(`${id}: the search bands overlap`);
      if (!(depth[0] < depth[1] && depth[1] < depth[2])) problems.push(`${id}: interaction pressure ${depth.map((x) => x.toFixed(2)).join(" / ")}`);
      ordered[id] = { meanSearch: search.map((x) => Number(x.toFixed(3))), meanKeptBehindPieces: depth.map((x) => Number(x.toFixed(2))) };
    }
    return { pass: problems.length === 0, depthBounds: b, ordered, problems };
  });

  // --- the art -------------------------------------------------------------------------------------------

  await check("I23", "interactions", "EVERY_KEPT_OBJECT_IS_FAIR_SHUT_AND_OPEN", () => {
    const { scenes } = engine(tree);
    const ip = pieces(tree);
    const problems = [];
    const rows = {};
    for (const scene of scenes) {
      const { audit, file } = auditOf(tree, scene);
      if (!audit) {
        problems.push(`${scene.id}: no audit at ${file}`);
        continue;
      }
      const byId = Object.fromEntries(audit.targets.map((r) => [r.id, r]));
      for (const t of scene.pool) {
        const row = byId[t.id];
        if (!row || row.visibleAtRest === undefined || row.visibleOpen === undefined) {
          problems.push(`${scene.id}/${t.id}: not audited with its pieces`);
          continue;
        }
        if (t.gate) {
          // shut: hidden enough that opening matters; open: every floor the room's objects meet
          if (row.visibleAtRest > HIDDEN_AT_REST) problems.push(`${scene.id}/${t.id}: ${(row.visibleAtRest * 100).toFixed(0)}% shows with its piece shut`);
          if (row.visible < VISIBLE_FLOOR[t.tier] || row.visibleOpen < VISIBLE_FLOOR[t.tier]) problems.push(`${scene.id}/${t.id}: ${row.visibleOpen} visible open`);
          if (row.edge < EDGE_FLOOR) problems.push(`${scene.id}/${t.id}: edge ${row.edge} open`);
          if (row.gate !== t.gate) problems.push(`${scene.id}/${t.id}: audited behind ${row.gate}`);
          rows[`${scene.id}/${t.id}`] = { shut: row.visibleAtRest, open: row.visibleOpen, edge: row.edge, tier: t.tier };
        } else if (Math.abs(row.visibleAtRest - row.visible) > 0.02 || Math.abs(row.visibleOpen - row.visible) > 0.02) {
          // no piece ever covers an object it does not keep, shut or open
          problems.push(`${scene.id}/${t.id}: a piece covers it (${row.visible} → ${row.visibleAtRest} / ${row.visibleOpen})`);
        }
      }
      // geometry, every state: a shut piece covers what it keeps; nothing else is ever under a piece or its tap area
      for (const piece of piecesOf(scene)) {
        for (const state of piece.states) {
          const art = ip.poseBounds(piece, state.pose);
          for (const t of scene.pool) {
            const b = boundsOf(t.region);
            const kept = t.gate === piece.id;
            if (kept && !state.open && !(contains(state.hit, b) && contains(art, b))) problems.push(`${scene.id}/${piece.id}/${state.id}: does not cover ${t.id}`);
            if ((!kept || state.open) && intersects(state.hit, b)) problems.push(`${scene.id}/${piece.id}/${state.id}: its tap area overlaps ${t.id}`);
            if (!kept && intersects(art, b)) problems.push(`${scene.id}/${piece.id}/${state.id}: paints over ${t.id}`);
          }
        }
      }
    }
    return { pass: problems.length === 0, kept: rows, floors: { hiddenAtRest: HIDDEN_AT_REST, visible: VISIBLE_FLOOR, edge: EDGE_FLOOR }, problems: problems.slice(0, 10), problemCount: problems.length };
  });

  await check("I24", "interactions", "EVERY_PIECE_MEETS_THE_TOUCH_FLOORS", () => {
    const { scenes, camera: cam, contract } = engine(tree);
    const ip = pieces(tree);
    const problems = [];
    let smallest = Infinity;
    const reach = Math.min(...DIFFICULTIES.map((d) => contract.DIFFICULTY_PRESETS[d].tolerancePx.touch));
    for (const scene of scenes) {
      for (const piece of piecesOf(scene)) {
        if (!piece.accessibleLabel?.trim()) problems.push(`${scene.id}/${piece.id}: no accessible label`);
        for (const state of piece.states) {
          const h = state.hit;
          smallest = Math.min(smallest, Math.min(h.w, h.h));
          // the tap area holds what is painted (its soft shadow aside)
          if (!contains(h, ip.poseBounds(piece, state.pose), HIT_SLACK_SU)) problems.push(`${scene.id}/${piece.id}/${state.id}: the art reaches past its tap area`);
          if (Math.max(h.w, h.h) * cam.coverScale(scene, REFERENCE_PHONE) < MIN_VISIBLE_AT_COVER_PX) problems.push(`${scene.id}/${piece.id}/${state.id}: too small at cover on the phone`);
          for (const viewport of VIEWPORTS) {
            const top = cam.coverScale(scene, viewport) * cam.maxZoom(scene, viewport);
            if (Math.min(h.w, h.h) * top + 2 * reach < MIN_EFFECTIVE_TOUCH_PX) problems.push(`${scene.id}/${piece.id}/${state.id}: ${(Math.min(h.w, h.h) * top + 2 * reach).toFixed(1)} px at full zoom (${viewport.name})`);
            // it can be framed whole, clear of the HUD
            const camera = cam.revealCamera(scene, h, viewport);
            const a = cam.sceneToViewport(scene, { x: h.x, y: h.y }, camera, viewport);
            const z = cam.sceneToViewport(scene, { x: h.x + h.w, y: h.y + h.h }, camera, viewport);
            const screen = { x: a.x, y: a.y, w: z.x - a.x, h: z.y - a.y };
            if (screen.x < -EPS || screen.y < -EPS || screen.x + screen.w > viewport.width + EPS || screen.y + screen.h > viewport.height + EPS) problems.push(`${scene.id}/${piece.id}/${state.id}: off screen framed (${viewport.name})`);
            for (const hud of hudRects(viewport)) if (intersects(screen, hud)) problems.push(`${scene.id}/${piece.id}/${state.id}: under the ${hud.name} (${viewport.name})`);
          }
          // the foreground layers never paint over a piece's tap area
          const plateIndex = scene.layers.findIndex((l) => l.id === "plate");
          for (const layer of scene.layers.slice(plateIndex + 1)) {
            const drift = cam.maxParallaxOffset(scene, layer.parallax);
            for (const paint of layer.opaque) {
              const grown = { x: paint.x - drift.x, y: paint.y - drift.y, w: paint.w + 2 * drift.x, h: paint.h + 2 * drift.y };
              if (intersects(grown, h)) problems.push(`${scene.id}/${piece.id}/${state.id}: ${layer.id} can cover it`);
            }
          }
        }
      }
    }
    return { pass: problems.length === 0, smallestSideSu: smallest, floors: { touchPx: MIN_EFFECTIVE_TOUCH_PX, atCoverPx: MIN_VISIBLE_AT_COVER_PX }, problems: problems.slice(0, 8), problemCount: problems.length };
  });

  // --- preserved ------------------------------------------------------------------------------------------

  await check("I25", "preserved", "NO_TIMER_SCORE_LIVES_OR_RANKING", () => {
    const files = listFiles(tree, DIR).filter((file) => /\.(ts|tsx)$/.test(file));
    const pressure = files.filter((file) => /setInterval|Date\.now|new Date\(|countdown|timeLeft|\blives\b|\bvidas\b|\bstreak|\branking|leaderboard|\bpenalt/i.test(codeOnly(tree.read(file))));
    const { byId, model } = engine(tree);
    const scene = byId[STUDIO_ID];
    const R = model.sessionReducer;
    const play = (fiddle) => {
      let s = session(tree, scene, "hard", 2020);
      for (const id of [...s.targets]) {
        const t = model.targetById(scene, id);
        if (fiddle) {
          for (let i = 0; i < 3; i += 1) s = R(s, { type: "hint" });
          s = R(s, { type: "tap", point: { x: 3, y: 3 }, scale: 1, pointerType: "touch" });
          for (const piece of scene.interactables ?? []) for (let k = 0; k < 3; k += 1) s = R(s, { type: "interact", interactableId: piece.id });
        }
        if (t.gate && s.interactions && !(scene.interactables.find((p) => p.id === t.gate).states.find((x) => x.id === s.interactions[t.gate])?.open)) s = R(s, { type: "interact", interactableId: t.gate });
        s = R(s, { type: "tap", point: model.regionCenter(t.region), scale: 1, pointerType: "mouse" });
      }
      return model.buildHiddenObjectsResult(s);
    };
    const quiet = play(false);
    const busy = play(true);
    const keys = [...Object.keys(busy), ...Object.keys(busy.details), ...Object.keys(model.createSession(scene))];
    const raceKeys = keys.filter((key) => /time|elapsed|clock|countdown|deadline|rank|best|streak|lives|points|bonus|penalt|star|moves|opened/i.test(key));
    return {
      pass: pressure.length === 0 && same(quiet, busy) && raceKeys.length === 0 && busy.details.completed === true,
      sourcesWithPressure: pressure,
      piecesHintsAndMissesChangeNothing: same(quiet, busy),
      raceKeys,
    };
  });

  await check("I26", "preserved", "OLD_RESULTS_REMAIN_READABLE", async () => {
    const t = platformTables(tree);
    const env = createEnvironment({ storage: { [STORAGE_KEY]: JSON.stringify(OLD_RESULTS) } });
    const storage = createModuleGraph({ tree, mocks: {}, globals: env.globals }).require(FILES.storage);
    const readBack = storage.getRecentResults();
    const game = await startIn(tree, OBSERVATORY_ID, "hard", 0x2626);
    const result = game.finish();
    game.unmount();
    const saved = storage.saveGameResult(result);
    const after = storage.getRecentResults();
    const presentation = t.rewards.getResultPresentation({ gameId: GAME });
    const shown = (r) => t.labels.formatResultDetails(r.details, presentation);
    const facts = {
      readBackAsSaved: same(readBack, OLD_RESULTS),
      keptAfterANewSave: after[0]?.id === saved.id && same(after.slice(1), OLD_RESULTS),
      oldResultsShowTheirMode: OLD_RESULTS.slice(0, 3).every((r) => same(shown(r), [{ key: "difficulty", label: "Modo", value: { easy: "Fácil", medium: "Médio", hard: "Difícil" }[r.details.difficulty] }])),
      oldResultsKeepTheirTitle: OLD_RESULTS.slice(0, 3).every((r) => t.rewards.getRewardCopy(r).title === "Estúdio explorado"),
      theTrilhaResultStillReads: Array.isArray(shown(OLD_RESULTS[3])),
      aNewResultHasTheSameShape: same(sorted(Object.keys(result.details)), RESULT_DETAIL_KEYS) && result.score === result.details.foundObjects && result.details.completed === true,
    };
    return { pass: Object.values(facts).every(Boolean), ...facts, newDetails: result.details };
  });

  await check("I27", "preserved", "BOTH_ROOMS_KEEP_EVERY_OBJECT_THEY_HAD", () => {
    const mine = engine(tree);
    const base = engine(BASE_TREE);
    const problems = [];
    const kept = {};
    for (const id of SCENE_IDS) {
      const a = mine.byId[id];
      const b = base.byId[id];
      if (a.width !== b.width || a.height !== b.height || !same(a.stations, b.stations) || a.initialStation !== b.initialStation) problems.push(`${id}: the room's frame moved`);
      for (const t of b.pool) {
        const now = a.pool.find((x) => x.id === t.id);
        if (!now) problems.push(`${id}/${t.id}: gone`);
        else {
          for (const field of ["label", "accessibleLabel", "tier", "station", "region", "clues", "hintRegion", "hintDirection", "hintContext"]) if (!same(now[field], t[field])) problems.push(`${id}/${t.id}: ${field} changed`);
          if (now.gate) problems.push(`${id}/${t.id}: now kept behind ${now.gate}`);
        }
      }
      for (const l of b.lookAlikes) {
        const now = a.lookAlikes.find((x) => x.id === l.id);
        if (!now || !same(now.region, l.region) || now.resembles !== l.resembles) problems.push(`${id}/${l.id}: look-alike moved`);
      }
      kept[id] = `${b.pool.length} objects, ${b.lookAlikes.length} look-alikes`;
    }
    return { pass: problems.length === 0, kept, problems: problems.slice(0, 8) };
  });

  await check("I28", "preserved", "THE_PIECES_NEVER_REACH_HOME", () => {
    const graph = staticGraph(tree);
    const home = graph.closure(APP_ROOTS, ["static"]);
    const leaked = home.filter((file) => file.startsWith(DIR));
    const piecesSrc = SCENE_IDS.flatMap((id) => room(tree, id).interactables ?? []).map((piece) => piece.src);
    const named = home.filter((file) => /\.(ts|tsx)$/.test(file) && /hidden-objects\/[a-z-]+\/v\d+\/pieces\//.test(codeOnly(tree.read(file))));
    // the game itself is reached only through the registry's dynamic import
    const registry = graph.node(FILES.registry);
    const staticGame = registry.static.filter((file) => file.startsWith(DIR));
    return { pass: leaked.length === 0 && named.length === 0 && staticGame.length === 0, homeModules: home.length, game03InHome: leaked, homeNamesRoomArt: named, staticGame, pieces: piecesSrc.length };
  });

  return results;
}

// --- mutants: in-memory overrides of today's tree, each of which some check must catch ----------------

const MUTANTS = [
  {
    name: "an object can be tapped through its shut drawer",
    files: { [FILES.model]: [["      const reachable = listed.filter((id) => isExposed(state.scene, state.interactions, id));", "      const reachable = listed;"]] },
    mustFail: ["I10"],
  },
  {
    name: "opening any piece exposes every kept object",
    files: { [INTERACTIONS_FILE]: [["  return !gate || pieceState(scene, interactions, gate).open;", "  return !gate || Object.keys(interactions).some((id) => pieceState(scene, interactions, id).open);"]] },
    mustFail: ["I11"],
  },
  {
    name: "an object behind a piece is found even when the round does not list it",
    files: { [FILES.model]: [["      const reachable = listed.filter((id) => isExposed(state.scene, state.interactions, id));", "      const reachable = [...listed, ...state.scene.pool.filter((t) => t.gate && isExposed(state.scene, state.interactions, t.id)).map((t) => t.id)].filter((id) => isExposed(state.scene, state.interactions, id));"]] },
    mustFail: ["I12"],
  },
  {
    name: "Recomeçar keeps the drawers open",
    files: { [FILES.model]: [["  foundIds: [],\n  interactions: initialInteractions(state.scene),", "  foundIds: [],"]] },
    mustFail: ["I13"],
  },
  {
    name: "a render puts the drawers back",
    files: { [FILES.game]: [["            interactions={state.interactions}", "            interactions={initialInteractions(scene)}"], ['import { pieceState } from "@/games/hidden-objects/hidden-objects-interactions";', 'import { initialInteractions, pieceState } from "@/games/hidden-objects/hidden-objects-interactions";']] },
    mustFail: ["I05"],
  },
  {
    name: "a camera drag opens the piece it started on",
    files: {
      [FILES.game]: [
        [
          "  const handleTap = useCallback((tap: SceneTap) => {",
          "  useEffect(() => {\n    const viewport = viewportRef.current;\n    const down = (event: PointerEvent) => {\n      const rect = viewport?.getBoundingClientRect();\n      const camera = controllerRef.current?.getCamera();\n      const size = controllerRef.current?.getViewportSize();\n      if (!rect || !camera || !size) return;\n      dispatch({ type: \"tap\", point: viewportToScene(scene, { x: event.clientX - rect.left, y: event.clientY - rect.top }, camera, size), scale: 1, pointerType: \"pan\" });\n    };\n    viewport?.addEventListener(\"pointerdown\", down);\n    return () => viewport?.removeEventListener(\"pointerdown\", down);\n  }, [scene]);\n\n  const handleTap = useCallback((tap: SceneTap) => {",
        ],
        ['import { pieceState } from "@/games/hidden-objects/hidden-objects-interactions";', 'import { pieceState } from "@/games/hidden-objects/hidden-objects-interactions";\nimport { viewportToScene } from "@/games/hidden-objects/hidden-objects-camera";'],
      ],
    },
    mustFail: ["I08"],
  },
  {
    name: "a tap on a piece also pans the camera",
    files: { [FILES.game]: [["    dispatch({ type: \"tap\", point: tap.point, scale: tap.scale, pointerType: tap.pointerType });", "    dispatch({ type: \"tap\", point: tap.point, scale: tap.scale, pointerType: tap.pointerType });\n    controllerRef.current?.zoomBy(1.1);"]] },
    mustFail: ["I09"],
  },
  {
    name: "Difícil rings the exact drawer",
    files: { [FILES.model]: [['  if (hintRung(difficulty, stage) !== "reveal" || !gate || pieceState(scene, interactions, gate).open) return null;', '  if ((hintRung(difficulty, stage) !== "reveal" && hintRung(difficulty, stage) !== "context") || !gate || pieceState(scene, interactions, gate).open) return null;']] },
    mustFail: ["I19"],
  },
  {
    name: "Médio opens the cover itself",
    files: {
      [FILES.model]: [
        [
          "      return emit(\n        { ...state, hintTarget: subject, hintStage: stage, hintSeq: state.hintSeq + 1 },",
          "      const gate = targetById(state.scene, subject).gate;\n      const opened = gate && state.difficulty === \"medium\" ? { ...state.interactions, [gate]: nextPieceState(interactableById(state.scene, gate), pieceState(state.scene, state.interactions, gate).id) } : state.interactions;\n      return emit(\n        { ...state, interactions: opened, hintTarget: subject, hintStage: stage, hintSeq: state.hintSeq + 1 },",
        ],
      ],
    },
    mustFail: ["I18"],
  },
  {
    name: "the round rule ignores interaction depth",
    files: { [DIFFICULTY_FILE]: [["    profile.decoys >= rule.minDecoys &&\n    profile.gated >= rule.gated[0] &&\n    profile.gated <= rule.gated[1]", "    profile.decoys >= rule.minDecoys"]] },
    mustFail: ["I20", "I21"],
  },
  {
    name: "every Difícil round keeps every object it can behind pieces",
    files: { [FILES.scene]: [["{ easy: [0, 1], medium: [1, 2], hard: [1, 3] }", "{ easy: [0, 1], medium: [1, 2], hard: [3, 8] }"]] },
    mustFail: ["I01", "I21"],
  },
  {
    name: "a piece's accessible label is removed",
    files: { [FILES.game]: [["                  aria-label={piece.accessibleLabel}\n", ""]] },
    mustFail: ["I06"],
  },
  {
    name: "a piece's tap area shrinks under the floor",
    files: { [FILES.observatoryScene]: [['hit: { x: 2408, y: 938, w: 44, h: 240 }', 'hit: { x: 2420, y: 938, w: 20, h: 240 }']] },
    mustFail: ["I24"],
  },
  {
    name: "a room-specific piece branch in the engine",
    files: { [INTERACTIONS_FILE]: [["  return piece.states[(index + 1) % piece.states.length].id;", '  if (piece.id === "cesto-de-mapas") return piece.states[0].id;\n  return piece.states[(index + 1) % piece.states.length].id;']] },
    mustFail: ["I03"],
  },
  {
    name: "every room's art is imported eagerly by Home",
    files: { [FILES.page]: [['"use client";', '"use client";\nimport "@/games/hidden-objects/scenes/explorer-studio";\nimport "@/games/hidden-objects/scenes/explorer-observatory";']] },
    mustFail: ["I28"],
  },
  {
    name: "a piece covers an object it does not keep (the curtain's tap area over the microscope)",
    files: { [FILES.observatoryScene]: [['hit: { x: 2412, y: 938, w: 132, h: 240 }, open: false', 'hit: { x: 2412, y: 880, w: 132, h: 298 }, open: false']] },
    mustFail: ["I23"],
  },
  {
    name: "Fácil opens the piece for the Explorador",
    files: { [FILES.game]: [["    if (move?.kind === \"frame\") controller.reveal(move.bounds);", "    if (move?.kind === \"frame\") controller.reveal(move.bounds);\n    const gate = targetById(state.scene, event.targetId).gate;\n    if (gate && hintRung(state.difficulty, event.stage) === \"reveal\") dispatch({ type: \"interact\", interactableId: gate });"]] },
    mustFail: ["I17"],
  },
  {
    name: "hints and opened pieces make the result",
    files: { [FILES.model]: [["    score: state.foundIds.length,", "    score: state.foundIds.length - state.hintSeq,"]] },
    mustFail: ["I25"],
  },
];

/** An in-memory copy of `worktree` with `mutant`'s edits; every anchor must appear exactly once. */
function mutate(worktree, mutant) {
  const files = typeof mutant.files === "function" ? mutant.files(worktree) : mutant.files;
  const overrides = {};
  for (const [file, edits] of Object.entries(files)) {
    let text = worktree.read(file);
    for (const [from, to] of edits) {
      const count = text.split(from).length - 1;
      if (count !== 1) throw new Error(`anchor ${JSON.stringify(clip(from, 70))} appears ${count}x in ${file}`);
      text = text.replace(from, () => to);
    }
    overrides[file] = text;
  }
  return openSourceTree({ sourceOverrides: overrides });
}

// --- run ---------------------------------------------------------------------------------------------

const print = (results) => {
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"}  ${r.id} [${r.tag}] — ${r.name}`);
    for (const [key, value] of Object.entries(r.detail)) console.log(`        ${key}: ${clip(JSON.stringify(value) ?? "undefined")}`);
  }
};

if (COUNTERFACTUAL_MODE) {
  const worktree = openSourceTree();
  const current = await runChecks(worktree);
  const currentFailing = current.filter((r) => !r.pass).map((r) => r.id);
  console.log(`working tree: ${current.length - currentFailing.length}/${current.length} checks pass${currentFailing.length ? ` · failing: ${currentFailing.join(", ")}` : ""}`);
  let ok = currentFailing.length === 0;

  const results = await runChecks(BASE_TREE);
  const contract = results.filter((r) => r.tag === "interactions");
  const kept = results.filter((r) => r.tag !== "interactions");
  const held = contract.every((r) => !r.pass) && kept.every((r) => r.pass);
  ok &&= held;
  console.log(`${held ? "CAUGHT" : "MISSED"}  base ${BASE.slice(0, 8)} — GAME03-CALIBRATION-02A's final state: no piece in any room`);
  console.log(`        [interactions] failing: ${contract.filter((r) => !r.pass).length}/${contract.length}`);
  console.log(`        [preserved] holding: ${kept.filter((r) => r.pass).length}/${kept.length}`);
  for (const r of results.filter((x) => (x.tag === "interactions" && x.pass) || (x.tag !== "interactions" && !x.pass))) {
    console.log(`        ${r.id} ${r.pass ? "PASSED" : "FAILED"}: ${clip(JSON.stringify(r.detail), 300)}`);
  }

  for (const mutant of MUTANTS) {
    let tree;
    try {
      tree = mutate(worktree, mutant);
    } catch (error) {
      ok = false;
      console.log(`BROKEN  mutant — ${mutant.name}: ${error.message}`);
      continue;
    }
    const mutated = await runChecks(tree);
    const failing = mutated.filter((r) => !r.pass).map((r) => r.id);
    const caught = mutant.mustFail.every((id) => failing.includes(id));
    ok &&= caught;
    console.log(`${caught ? "CAUGHT" : "MISSED"}  mutant — ${mutant.name}`);
    console.log(`        required to fail: ${mutant.mustFail.join(", ")} · failed: ${failing.join(", ") || "none"}`);
  }
  console.log(ok ? "HIDDEN_OBJECTS_INTERACTIONS_COUNTERFACTUALS_HOLD" : "HIDDEN_OBJECTS_INTERACTIONS_COUNTERFACTUALS_BROKEN");
  process.exit(ok ? EXIT_OK : EXIT_VALIDATION_FAILED);
}

let tree;
try {
  tree = openSourceTree({ rev: REV });
} catch (error) {
  console.error(String(error.message));
  process.exit(EXIT_USAGE);
}
const results = await runChecks(tree);
print(results);
const failing = results.filter((r) => !r.pass).map((r) => r.id);
console.log(
  `\n${REV ? `rev ${tree.rev.slice(0, 12)} · ` : ""}${results.length - failing.length}/${results.length} passed` +
    ` (${results.filter((r) => r.tag === "interactions").length} interactions, ${results.filter((r) => r.tag === "preserved").length} preserved)` +
    `${failing.length ? ` · failing: ${failing.join(", ")}` : ""}`,
);
console.log(failing.length ? "HIDDEN_OBJECTS_INTERACTIONS_FAILED" : "HIDDEN_OBJECTS_INTERACTIONS_OK");
process.exit(failing.length ? EXIT_VALIDATION_FAILED : EXIT_OK);
