/**
 * GAME03-REPLAYABILITY-05 — seeded, authored room layouts, checked from source.
 *
 * Both rooms stopped being one fixed picture: the things that can move (pool
 * objects, look-alikes and the rooms' own small props) stand on authored slots
 * (scene data: `slots`, each thing's `placements`), and one exploration's seed
 * picks a placement for every one of them (hidden-objects-layout.ts,
 * composeLayout) — jointly with the round's list (hidden-objects-rounds.ts,
 * selectRound), so the round model reads each object where it stands, with the
 * measurements the art kit's audit took there (the art module beside each
 * room). The plate is painted without them; the view paints each from one
 * sprite atlas per room. The same seed is the same room, "Recomeçar" keeps it,
 * a new exploration draws another one (never the room just played, while
 * another exists), and nothing else — a render, the camera, a hint, a piece, a
 * find — moves anything.
 *
 * Everything runs the REAL code from source through the shared harness
 * (hidden-objects-harness.mjs): the pure modules, the real HiddenObjectsGame
 * with its real scene view under the harness's small React (every tap, drag,
 * pinch and wheel a Pointer Event on the viewport, through the real gesture
 * recogniser and camera controller), the platform's storage and Home, the art
 * kit's audit on disk and the shipped atlas, and the base itself (git show).
 *
 * [replayability] checks are what this mission introduced: they FAIL on its
 * base (36ab89a — GAME03-INTERACTIONS-04's final state: every thing painted
 * where it has always been). [preserved] checks are guards the layouts must not
 * break — the rooms' anchors, a light Home, no timer or score, old results, two
 * rooms — and hold on both; their mutants show they are not vacuous.
 *
 * Usage:
 *   node tools/validation/hidden-objects-replayability-tests.mjs                  # the working tree
 *   node tools/validation/hidden-objects-replayability-tests.mjs --rev=<commit>   # every source at <commit>
 *   node tools/validation/hidden-objects-replayability-tests.mjs --counterfactuals
 *        the working tree must pass every check; the base must fail every
 *        [replayability] check and hold every [preserved] one; every in-memory
 *        MUTANT must fail the checks it names. Nothing is ever written.
 *
 * Writes nothing. Exit 0 = every check holds, 1 = a check failed, 3 = usage error.
 */
import { createHash } from "node:crypto";
import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";
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
  lcg,
  listFiles,
  platformTables,
  readBinary,
  same,
  sorted,
  staticGraph,
} from "./hidden-objects-harness.mjs";

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
const COUNTERFACTUAL_MODE = args.includes("--counterfactuals");
if (args.some((arg) => arg !== revArg && arg !== "--counterfactuals") || REV === "" || (REV && COUNTERFACTUAL_MODE)) {
  console.error("usage: node tools/validation/hidden-objects-replayability-tests.mjs [--rev=<commit> | --counterfactuals]");
  process.exit(EXIT_USAGE);
}

// --- what the mission fixed ---------------------------------------------------------------------

/** GAME03-INTERACTIONS-04's final state, this mission's exact base. */
const BASE = "36ab89a7dfdf592792f93c7c489b57a6128ce38f";
const GAME = "hidden-objects";
const STUDIO_ID = "explorer-studio";
const OBSERVATORY_ID = "explorer-observatory";
const SCENE_IDS = [STUDIO_ID, OBSERVATORY_ID];
const DIFFICULTIES = ["easy", "medium", "hard"];
const LAYOUT_FILE = `${DIR}hidden-objects-layout.ts`;
const DIFFICULTY_FILE = `${DIR}hidden-objects-difficulty.ts`;
const ART_FILES = { [STUDIO_ID]: `${DIR}scenes/explorer-studio.art.ts`, [OBSERVATORY_ID]: `${DIR}scenes/explorer-observatory.art.ts` };
/** The engine: nothing in it may name a room, a station, a slot, a thing or a piece. */
const ENGINE_FILES = [
  "hidden-objects-layout.ts",
  "hidden-objects-rounds.ts",
  "hidden-objects-model.ts",
  "hidden-objects-difficulty.ts",
  "hidden-objects-clues.ts",
  "hidden-objects-interactions.ts",
  "hidden-objects-camera.ts",
  "hidden-objects-controller.ts",
  "HiddenObjectsScene.tsx",
  "HiddenObjectsGame.tsx",
  "hidden-objects.css",
].map((f) => `${DIR}${f}`);
/** The fairness floors (the same since the skeleton — never lowered). */
const VISIBLE_FLOOR = { A: 0.8, B: 0.6, C: 0.4 };
const EDGE_FLOOR = 1.3;
/** A shut piece hides what it keeps: at most this share of it shows (GAME03-INTERACTIONS-04). */
const HIDDEN_AT_REST = 0.05;
/**
 * The occupancy rule, as the mission states it (the suite's own copy, not the
 * engine's): a look-alike keeps the contract's clearance from every pool
 * object; any other two things keep this gap between their boxes unless one
 * stands clearly in front of the other (bottoms DEPTH apart) and the one behind
 * is not a pool object.
 */
const OCCUPANCY_GAP = 4;
const DEPTH = 40;
/** Placements a thing may have: a fixed thing one, a small one 2–4. */
const PLACEMENTS_PER_THING = { max: 4 };
/** A thing this large (su², its box: furniture-sized, ~200×200 su) is part of the room's structure: it never moves. */
const ANCHOR_AREA = 40_000;
/** Of the room's things, the share that moves between two explorations (the mission's ~30–50 %, measured on every thing a layout places). */
const MOVED_SHARE = { min: 0.3, max: 0.6 };
/** No thing's placement is taken more often than this; none less often (layouts of fresh seeds). */
const SLOT_SHARE = { max: 0.85, min: 0.05 };
/** A Difícil object with two Difícil placements or more: none of them may take more than this of its Difícil rounds. */
const HARD_SLOT_CEILING = 0.9;
/** Bounds the generation must keep (the mission: bounded, deterministic). */
const BOUNDS = { layoutSteps: 50_000, layoutAttempts: 10, roundDraws: 10_000, repeatDraws: 16 };
const EPS = 1e-6;

const plain = (value) => JSON.parse(JSON.stringify(value));
const boundsOf = (region) => (region.kind === "rect" ? { x: region.x, y: region.y, w: region.w, h: region.h } : { x: region.cx - region.r, y: region.cy - region.r, w: 2 * region.r, h: 2 * region.r });
const centreOf = (r) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });
const boxGap = (a, b) => Math.hypot(Math.max(a.x - (b.x + b.w), 0, b.x - (a.x + a.w)), Math.max(a.y - (b.y + b.h), 0, b.y - (a.y + a.h)));
const contains = (outer, inner, slack = 0) =>
  inner.x >= outer.x - slack && inner.y >= outer.y - slack && inner.x + inner.w <= outer.x + outer.w + slack && inner.y + inner.h <= outer.y + outer.h + slack;
/** Shape-to-shape distance, as the contract has always measured the look-alike clearance. */
function shapeGap(a, b) {
  if (a.kind === "circle" && b.kind === "circle") return Math.max(0, Math.hypot(a.cx - b.cx, a.cy - b.cy) - a.r - b.r);
  if (a.kind === "circle" || b.kind === "circle") {
    const c = a.kind === "circle" ? a : b;
    const r = a.kind === "circle" ? b : a;
    const dx = Math.max(r.x - c.cx, 0, c.cx - (r.x + r.w));
    const dy = Math.max(r.y - c.cy, 0, c.cy - (r.y + r.h));
    return Math.max(0, Math.hypot(dx, dy) - c.r);
  }
  return boxGap(a, b);
}
const shift = (region, dx, dy) => (region.kind === "rect" ? { ...region, x: region.x + dx, y: region.y + dy } : { ...region, cx: region.cx + dx, cy: region.cy + dy });
const shares = (counts) => {
  const total = [...counts.values()].reduce((s, v) => s + v, 0);
  return [...counts.entries()].map(([k, v]) => [k, v / Math.max(1, total)]);
};

// --- the tree's engine ---------------------------------------------------------------------------

function engine(tree) {
  return cached(tree, "replay:engine", () => {
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
    };
  });
}
/** The layout engine (absent on the base: this throws there). */
function layoutEngine(tree) {
  return cached(tree, "replay:layout", () => {
    if (!tree.exists(LAYOUT_FILE)) throw new Error("no layout engine on this tree");
    return engine(tree).graph.require(LAYOUT_FILE);
  });
}
const room = (tree, id) => engine(tree).byId[id];

/**
 * A room's things read straight from its data (the suite's own reading, not the
 * engine's): every pool object, look-alike and prop with its home box, its
 * placements and each placement's box on its slot.
 */
function thingsOf(scene) {
  if (!Array.isArray(scene.slots)) throw new Error(`${scene.id} declares no slots`);
  const slot = new Map(scene.slots.map((s) => [s.id, s]));
  const onSlot = (home, id) => {
    const s = slot.get(id);
    if (!s) throw new Error(`${scene.id}: unknown slot ${id}`);
    const y = s.align === "bottom" ? s.at.y - home.h : s.align === "top" ? s.at.y : s.at.y - home.h / 2;
    return { x: s.at.x - home.w / 2, y, w: home.w, h: home.h };
  };
  const make = (role, id, region, placements, extra = {}) => {
    const home = boundsOf(region);
    if (!Array.isArray(placements) || placements.length === 0) throw new Error(`${scene.id}/${id}: no placements`);
    return {
      role,
      id,
      home,
      region,
      ...extra,
      placements: placements.map((p) => {
        const box = onSlot(home, p.slot);
        return { ...p, key: `${id}@${p.slot}`, box, region: shift(region, box.x - home.x, box.y - home.y), slot: slot.get(p.slot) };
      }),
    };
  };
  return [
    ...scene.pool.map((t) => make("target", t.id, t.region, t.placements, { tier: t.tier, gate: t.gate ?? null, station: t.station })),
    ...scene.lookAlikes.map((l) => make("lookalike", l.id, l.region, l.placements)),
    ...(scene.props ?? []).map((p) => make("prop", p.id, { kind: "rect", ...p.box }, p.placements)),
  ];
}
const tierOf = (thing, placement) => placement.tier ?? thing.tier;

/** The contract's look-alike clearance (su), read from the tree under test. */
let clearance = 32;

/** Whether two placements of two things may not stand in one room (the suite's copy of the mission's rule). */
function clashes(scene, a, pa, b, pb) {
  if (pa.slot.id === pb.slot.id) return true;
  const decoy = (a.role === "target" && b.role === "lookalike") || (a.role === "lookalike" && b.role === "target");
  if (decoy) return shapeGap(pa.region, pb.region) < clearance - EPS;
  if (boxGap(pa.box, pb.box) >= OCCUPANCY_GAP - EPS) return false;
  const depth = pa.box.y + pa.box.h - (pb.box.y + pb.box.h);
  if (Math.abs(depth) < DEPTH) return true;
  return (depth < 0 ? a : b).role === "target";
}

/** A layout as the suite reads it: thing id → its placement (from the layout's picks). */
function placementsIn(scene, layout) {
  return Object.fromEntries(thingsOf(scene).map((thing) => [thing.id, thing.placements[layout.picks[thing.id] ?? 0]]));
}

/** Seeds 1… whose round (room, difficulty) satisfies `predicate(draw, things)`; null if none in the first `limit`. */
function seedWhere(tree, scene, difficulty, key, predicate, limit = 40_000) {
  return cached(tree, `replay:seed:${scene.id}:${difficulty}:${key}`, () => {
    const { rounds } = engine(tree);
    const things = thingsOf(scene);
    for (let seed = 1; seed < limit; seed += 1) {
      const draw = rounds.selectRound(scene, difficulty, seed);
      if (predicate(draw, things)) return seed;
    }
    return null;
  });
}
/** A round that lists `id` with it off its home placement (and, given, on `slot`). */
const listedAway = (id, slot = null) => (draw, things) => {
  if (!draw.targets.includes(id)) return false;
  const thing = things.find((t) => t.id === id);
  const p = thing.placements[draw.layout.picks[id] ?? 0];
  return slot ? p.slot.id === slot : p !== thing.placements[0] && boxGap(p.box, thing.home) > 40;
};

/** Every round the suite samples: seeds 1…n of (room, difficulty), with the room each one places. */
function sampleRounds(tree, scene, difficulty, n) {
  return cached(tree, `replay:rounds:${scene.id}:${difficulty}:${n}`, () => {
    const { rounds } = engine(tree);
    const out = [];
    for (let seed = 1; seed <= n; seed += 1) out.push({ seed, ...rounds.selectRound(scene, difficulty, seed) });
    return out;
  });
}
/** Fresh layouts of `n` seeds (the composer alone). */
function sampleLayouts(tree, scene, n) {
  return cached(tree, `replay:layouts:${scene.id}:${n}`, () => {
    const L = layoutEngine(tree);
    return Array.from({ length: n }, (_, i) => L.composeLayout(scene, L.derivedSeed(i + 1, "layout:0")));
  });
}

// --- the real game -----------------------------------------------------------------------------

/**
 * The real game, mounted the way GameScreen mounts it: `seeds` are what the
 * platform's random source hands out, in order.
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
  harness.mount(
    harness.jsxRuntime.jsx(HiddenObjectsGame, {
      onComplete: (result) => calls.complete.push(plain(result)),
      onExit: () => {},
      onEntryReady: () => {},
      onEntryError: () => {},
    }),
  );
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
    calls,
    shell: () => host(cls("hos-shell"))?.props ?? {},
    status: () => game.shell()["data-status"] ?? null,
    sceneId: () => game.shell()["data-scene"] ?? null,
    scene: () => registry.sceneById(game.sceneId()),
    seed: () => (game.shell()["data-round-seed"] === undefined ? null : Number(game.shell()["data-round-seed"])),
    /** The layout the session says it plays (the shell's signature) — null where there is none. */
    signature: () => game.shell()["data-layout"] ?? null,
    /** What the view paints for the things that move: each picture's thing, slot and room rectangle. */
    things: () =>
      harness
        .hosts(cls("hos-thing"))
        .map((e) => ({ thing: e.props["data-thing"], slot: e.props["data-slot"], x: e.props.style.left, y: e.props.style.top, w: e.props.style.width, h: e.props.style.height, bg: e.props.style.backgroundPosition }))
        .sort((a, b) => (a.thing < b.thing ? -1 : 1)),
    /** The room as the session plays it (the model's own reading of its state). */
    session: () => harness.components("HiddenObjectsScene")[0]?.props ?? null,
    items: () => harness.hosts(cls("hos-item")).map((entry) => ({ id: entry.props["data-target"], found: entry.props["data-found"] === "true" })),
    listed: () => game.items().map((item) => item.id),
    found: () => game.items().filter((item) => item.found).map((item) => item.id),
    banner: () => host(cls("hos-hint-banner"))?.text ?? null,
    halo: () => {
      const entry = host(cls("hos-halo"));
      if (!entry) return null;
      const style = entry.props.style;
      return { cx: parseFloat(style["--hos-halo-x"]), cy: parseFloat(style["--hos-halo-y"]), r: parseFloat(style["--hos-halo-r"]) };
    },
    pieces: () =>
      Object.fromEntries(harness.hosts((e) => e.type === IMAGE && cls("hos-piece")(e)).map((e) => [e.props["data-piece"], { state: e.props["data-state"], open: e.props["data-open"] === "true" }])),
    get controller() {
      return harness.components("HiddenObjectsScene")[0]?.props.controllerRef.current ?? null;
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
      // the room's essential art: its layers, its pieces and (GAME03-REPLAYABILITY-05) its sprite atlas
      for (const entry of harness.hosts((e) => e.type === IMAGE && (cls("hos-layer")(e) || cls("hos-piece")(e) || cls("hos-atlas")(e)))) entry.props.onLoad?.({ currentTarget: entry.node, target: entry.node });
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
    tapScene(point, { pointerType = "mouse", id = 1 } = {}) {
      const c = game.client(point);
      game.pointer("pointerdown", { pointerId: id, clientX: c.x, clientY: c.y, pointerType, button: 0 });
      game.pointer("pointerup", { pointerId: id, clientX: c.x, clientY: c.y, pointerType, button: 0 });
    },
    frame(bounds) {
      game.controller.reveal(bounds);
      game.settle();
    },
    /** Tap a room rectangle's centre, framed first. */
    tapAt(bounds, options = {}) {
      game.frame(bounds);
      game.tapScene(centreOf(bounds), options);
      game.settle();
    },
    tapPiece(pieceId) {
      const scene = game.scene();
      const piece = scene.interactables.find((p) => p.id === pieceId);
      const state = piece.states.find((s) => s.id === game.pieces()[pieceId].state);
      game.tapAt(state.hit);
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
    toggleTray() {
      game.click((entry) => cls("hos-tray-toggle")(entry));
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
      const scene = game.roomPlayed();
      for (const id of game.listed()) {
        if (game.found().includes(id)) continue;
        const target = scene.pool.find((t) => t.id === id);
        if (target.gate && !game.pieces()[target.gate].open) game.tapPiece(target.gate);
        game.tapAt(boundsOf(target.region));
      }
      flushFrames(60);
      game.click((entry) => entry.text === "Concluir exploração");
      return calls.complete.at(-1) ?? null;
    },
    /** The room as this exploration plays it, from the layout the shell names (the model's own placement of it). */
    roomPlayed() {
      const L = graph.require(LAYOUT_FILE);
      const layout = L.layoutFromSignature(game.scene(), game.signature());
      if (!layout) throw new Error("the shell names no layout of this room");
      return L.placedScene(game.scene(), layout);
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

/** A room's audit as its art kit wrote it (the kit the room's plate names). */
function auditOf(tree, scene) {
  return cached(tree, `replay:audit:${scene.id}`, () => {
    const kit = /\/(v\d+)$/.exec(scene.layers.find((l) => l.id === "plate").src.replace(/\/plate\.webp$/, ""))[1];
    return JSON.parse(tree.read(`docs/archive/hidden-objects/${scene.id}/review/${kit}/fairness.json`));
  });
}

/** Exact: whether a placement can stand in some complete room (most-constrained-first search with forward checking). */
function feasible(scene, things, forcedKey) {
  const all = things.flatMap((thing, t) => thing.placements.map((p) => ({ t, p, thing })));
  const index = new Map(all.map((entry, i) => [entry.p.key, i]));
  const n = all.length;
  const clash = new Uint8Array(n * n);
  for (let i = 0; i < n; i += 1)
    for (let j = i + 1; j < n; j += 1)
      if (all[i].t !== all[j].t && clashes(scene, all[i].thing, all[i].p, all[j].thing, all[j].p)) clash[i * n + j] = clash[j * n + i] = 1;
  const forced = index.get(forcedKey);
  const domains = things.map((thing, t) => (all[forced].t === t ? [forced] : thing.placements.map((p) => index.get(p.key))));
  const placed = [];
  const free = (k) => placed.every((q) => !clash[k * n + q]);
  let nodes = 0;
  const go = (left) => {
    if ((nodes += 1) > 2e6) throw new Error("search budget");
    if (!left.length) return true;
    let best = -1;
    let options = null;
    for (const t of left) {
      const o = domains[t].filter(free);
      if (!o.length) return false;
      if (!options || o.length < options.length) {
        best = t;
        options = o;
      }
    }
    const rest = left.filter((t) => t !== best);
    for (const k of options) {
      placed.push(k);
      if (go(rest)) return true;
      placed.pop();
    }
    return false;
  };
  return go([...things.keys()]);
}

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
  clearance = engine(tree).contract.LOOKALIKE_CLEARANCE_SU ?? 32;

  // --- the authored layout model ---------------------------------------------------------------------------

  await check("R01", "replayability", "BOTH_ROOMS_DECLARE_VALID_LAYOUTS", () => {
    const problems = [];
    const facts = {};
    for (const scene of engine(tree).scenes) {
      const ids = scene.slots.map((s) => s.id);
      if (new Set(ids).size !== ids.length) problems.push(`${scene.id}: duplicate slot ids`);
      const stations = new Set(scene.stations.map((s) => s.id));
      const pieces = new Set((scene.interactables ?? []).map((p) => p.id));
      for (const s of scene.slots) {
        if (!stations.has(s.station)) problems.push(`${scene.id}/${s.id}: unknown station ${s.station}`);
        if (!["top", "bottom", "center"].includes(s.align)) problems.push(`${scene.id}/${s.id}: align ${s.align}`);
        if (!(s.at.x >= 0 && s.at.x <= scene.width && s.at.y >= 0 && s.at.y <= scene.height)) problems.push(`${scene.id}/${s.id}: anchor outside the room`);
        if (s.gate && !pieces.has(s.gate)) problems.push(`${scene.id}/${s.id}: unknown piece ${s.gate}`);
      }
      const things = thingsOf(scene);
      const thingIds = things.map((t) => t.id);
      if (new Set(thingIds).size !== thingIds.length) problems.push(`${scene.id}: a thing id is used twice`);
      for (const thing of things) {
        if (thing.placements.length > PLACEMENTS_PER_THING.max) problems.push(`${scene.id}/${thing.id}: ${thing.placements.length} placements`);
        if (new Set(thing.placements.map((p) => p.slot.id)).size !== thing.placements.length) problems.push(`${scene.id}/${thing.id}: a slot twice`);
        if (boxGap(thing.placements[0].box, thing.home) > EPS || Math.abs(thing.placements[0].box.x - thing.home.x) > EPS || Math.abs(thing.placements[0].box.y - thing.home.y) > EPS)
          problems.push(`${scene.id}/${thing.id}: its first placement is not where it was painted`);
      }
      // the art: one atlas, one picture per placement that moves, the audit of every pool placement
      const art = scene.placementArt ?? {};
      const movable = things.filter((t) => t.placements.length > 1);
      if (movable.length && !scene.atlas) problems.push(`${scene.id}: things move but no atlas`);
      for (const thing of things)
        for (const p of thing.placements) {
          const a = art[p.key];
          if (!a) problems.push(`${scene.id}/${p.key}: no art`);
          else if (thing.placements.length > 1 && !a.sprite) problems.push(`${scene.id}/${p.key}: no picture`);
          else if (a.sprite && (a.sprite.sx < 0 || a.sprite.sy < 0 || a.sprite.sx + a.sprite.w > scene.atlas.width || a.sprite.sy + a.sprite.h > scene.atlas.height)) problems.push(`${scene.id}/${p.key}: picture outside the atlas`);
          if (thing.role === "target" && !a?.measured) problems.push(`${scene.id}/${p.key}: no audit`);
        }
      const keys = new Set(things.flatMap((t) => t.placements.map((p) => p.key)));
      const extra = Object.keys(art).filter((k) => !keys.has(k));
      if (extra.length) problems.push(`${scene.id}: art for no placement: ${extra.slice(0, 3).join(", ")}`);
      facts[scene.id] = { slots: scene.slots.length, things: things.length, movable: movable.length, placements: keys.size };
    }
    return { pass: problems.length === 0, ...facts, problems: problems.slice(0, 8) };
  });

  await check("R02", "replayability", "NO_FREE_COORDINATE_PLACEMENT", () => {
    const L = layoutEngine(tree);
    const problems = [];
    // every box the game ever places is a thing's own size on an authored slot
    for (const scene of engine(tree).scenes) {
      const things = thingsOf(scene);
      const authored = new Map(things.map((t) => [t.id, t.placements.map((p) => JSON.stringify(p.box))]));
      for (const difficulty of DIFFICULTIES)
        for (const draw of sampleRounds(tree, scene, difficulty, 200)) {
          const placed = L.placedScene(scene, draw.layout);
          for (const t of [...placed.pool, ...placed.lookAlikes]) {
            const box = JSON.stringify(boundsOf(t.region));
            if (!authored.get(t.id).includes(box)) problems.push(`${scene.id}/${t.id}: placed at ${box}, on no slot (seed ${draw.seed})`);
          }
          for (const s of L.layoutSprites(scene, draw.layout)) if (!authored.get(s.thing).includes(JSON.stringify(s.box))) problems.push(`${scene.id}/${s.thing}: painted on no slot`);
        }
    }
    // and nothing in the game draws a coordinate: its only randomness is the exploration's seed (crypto, on "Explorar")
    const sources = listFiles(tree, DIR).filter((f) => /\.(ts|tsx)$/.test(f));
    const random = sources.filter((f) => /Math\.random/.test(codeOnly(tree.read(f))));
    return { pass: problems.length === 0 && random.length === 0, problems: [...new Set(problems)].slice(0, 6), mathRandomIn: random };
  });

  await check("R03", "replayability", "EVERY_THING_HAS_VALID_COMPATIBLE_SLOTS", () => {
    const problems = [];
    let counted = 0;
    for (const scene of engine(tree).scenes) {
      const stationOf = (x) => scene.stations.find((s) => x >= s.span.x0 && x < s.span.x1)?.id;
      for (const thing of thingsOf(scene)) {
        for (const p of thing.placements) {
          counted += 1;
          // a pool object stays in its station (its clues and the list's station hints name it)
          if (thing.role === "target" && p.slot.station !== thing.station) problems.push(`${scene.id}/${p.key}: slot in ${p.slot.station}, object of ${thing.station}`);
          if (thing.role === "target" && stationOf(centreOf(p.box).x) !== thing.station) problems.push(`${scene.id}/${p.key}: drawn outside its station`);
          // what a piece keeps stands only behind that piece; nothing else ever stands there
          if ((p.slot.gate ?? null) !== (thing.gate ?? null)) problems.push(`${scene.id}/${p.key}: slot behind ${p.slot.gate ?? "nothing"}, thing kept by ${thing.gate ?? "nothing"}`);
          // a pool object's slot says where it is in words that name only what never moves
          if (thing.role === "target" && !(p.slot.hints?.region && p.slot.hints?.direction && p.slot.hints?.context)) problems.push(`${scene.id}/${p.key}: slot without hint words`);
          if (thing.role === "target" && !["A", "B", "C"].includes(tierOf(thing, p))) problems.push(`${scene.id}/${p.key}: no tier`);
        }
      }
      // a slot's hint words never name a thing that moves
      const moving = thingsOf(scene).filter((t) => t.placements.length > 1);
      const names = moving.flatMap((t) => [t.id, ...(scene.pool.find((x) => x.id === t.id)?.label ? [scene.pool.find((x) => x.id === t.id).label] : []), ...(scene.lookAlikes.find((x) => x.id === t.id)?.label ? [scene.lookAlikes.find((x) => x.id === t.id).label] : [])]);
      for (const s of scene.slots) {
        const text = Object.values(s.hints ?? {}).join(" ").toLowerCase();
        for (const name of names) if (name.length >= 5 && new RegExp(`\\b${name.toLowerCase()}\\b`).test(text)) problems.push(`${scene.id}/${s.id}: its hint names ${name}, which moves`);
      }
    }
    return { pass: problems.length === 0 && counted > 0, placements: counted, problems: problems.slice(0, 8) };
  });

  // --- the seed ---------------------------------------------------------------------------------------------

  await check("R04", "replayability", "SAME_SEED_SAME_LAYOUT", () => {
    const problems = [];
    let compared = 0;
    for (const scene of engine(tree).scenes)
      for (const difficulty of DIFFICULTIES)
        for (const seed of [1, 7, 4242, 0x9e3779b9, 2 ** 32 - 1]) {
          const a = engine(tree).rounds.selectRound(scene, difficulty, seed);
          // a fresh copy of every module: nothing remembered between the two
          const fresh = createModuleGraph({ tree, mocks: {}, globals: {} });
          const b = fresh.require(FILES.rounds).selectRound(fresh.require(FILES.scenes).sceneById(scene.id), difficulty, seed);
          const c = engine(tree).rounds.selectRound(scene, difficulty, seed);
          compared += 1;
          if (a.layout.signature !== b.layout.signature || a.layout.signature !== c.layout.signature || !same(a.targets, b.targets) || !same(a.targets, c.targets)) problems.push(`${scene.id}/${difficulty}/${seed}`);
          const back = layoutEngine(tree).layoutFromSignature(scene, a.layout.signature);
          if (!back || !same(plain(back.picks), plain(a.layout.picks))) problems.push(`${scene.id}/${difficulty}/${seed}: the signature does not name its layout`);
        }
    return { pass: problems.length === 0 && compared > 0, compared, problems: problems.slice(0, 6) };
  });

  await check("R05", "replayability", "SAME_SEED_SAME_COORDINATES_AND_HIT_REGIONS", async () => {
    const problems = [];
    const facts = {};
    for (const id of SCENE_IDS) {
      const scene = room(tree, id);
      const seed = seedWhere(tree, scene, "medium", "away", (draw, things) => draw.targets.some((t) => listedAway(t)(draw, things)));
      const a = await startIn(tree, id, "medium", seed);
      const b = await startIn(tree, id, "medium", seed);
      const ta = a.things();
      const regions = (game) => game.roomPlayed().pool.filter((t) => game.listed().includes(t.id)).map((t) => [t.id, t.region]);
      if (!ta.length) problems.push(`${id}: nothing painted from the atlas`);
      if (!same(ta, b.things()) || a.signature() !== b.signature()) problems.push(`${id}: two visits with seed ${seed} paint different rooms`);
      if (!same(regions(a), regions(b))) problems.push(`${id}: two visits with seed ${seed} place the list differently`);
      // the same tap finds the same object in both
      const away = a.roomPlayed().pool.find((t) => a.listed().includes(t.id) && !same(t.region, scene.pool.find((x) => x.id === t.id).region) && !t.gate);
      if (away) {
        a.tapAt(boundsOf(away.region));
        b.tapAt(boundsOf(away.region));
        if (!a.found().includes(away.id) || !same(a.found(), b.found())) problems.push(`${id}: a tap on ${away.id} where it stands finds ${a.found()} / ${b.found()}`);
      } else problems.push(`${id}: no listed object off its home to tap`);
      facts[id] = { seed, signature: a.signature(), painted: ta.length, tapped: away?.id ?? null };
      a.unmount();
      b.unmount();
    }
    return { pass: problems.length === 0, ...facts, problems };
  });

  await check("R06", "replayability", "RECOMECAR_KEEPS_THE_LAYOUT", async () => {
    const problems = [];
    for (const id of SCENE_IDS) {
      const scene = room(tree, id);
      const game = await startIn(tree, id, "medium", 0x0606 + id.length);
      const before = { signature: game.signature(), things: game.things(), list: game.listed(), seed: game.seed() };
      if (!before.signature) problems.push(`${id}: the session names no layout`);
      for (const piece of scene.interactables ?? []) game.tapPiece(piece.id);
      const target = game.roomPlayed().pool.find((t) => game.listed().includes(t.id));
      game.tapAt(boundsOf(target.region));
      game.hint();
      game.restart();
      const after = { signature: game.signature(), things: game.things(), list: game.listed(), seed: game.seed() };
      if (!same(before, after)) problems.push(`${id}: Recomeçar moved the room (${before.signature} → ${after.signature})`);
      if (game.found().length) problems.push(`${id}: finds kept`);
      for (const piece of scene.interactables ?? []) if (game.pieces()[piece.id]?.state !== piece.initial) problems.push(`${id}: ${piece.id} not shut`);
      game.unmount();
    }
    return { pass: problems.length === 0, problems };
  });

  await check("R07", "replayability", "A_NEW_EXPLORATION_CAN_CHANGE_THE_LAYOUT", async () => {
    const problems = [];
    const facts = {};
    for (const id of SCENE_IDS) {
      const game = await startIn(tree, id, "easy", 0x0707, { seeds: [0x7070, 0x7171, 0x7272] });
      const seen = [game.signature()];
      const painted = [JSON.stringify(game.things())];
      for (let i = 0; i < 3; i += 1) {
        game.changeScene();
        game.explore();
        seen.push(game.signature());
        painted.push(JSON.stringify(game.things()));
      }
      if (new Set(seen).size < 3) problems.push(`${id}: 4 explorations, ${new Set(seen).size} layouts`);
      if (new Set(painted).size !== new Set(seen).size) problems.push(`${id}: the pictures do not follow the layouts`);
      facts[id] = seen;
      game.unmount();
    }
    return { pass: problems.length === 0, ...facts, problems };
  });

  await check("R08", "replayability", "NOTHING_BUT_A_NEW_EXPLORATION_MOVES_A_THING", async () => {
    const problems = [];
    const steps = {};
    for (const id of SCENE_IDS) {
      const scene = room(tree, id);
      const game = await startIn(tree, id, "medium", 0x0808);
      const snap = () => JSON.stringify({ s: game.signature(), t: game.things(), r: game.roomPlayed().pool.map((t) => t.region) });
      const first = snap();
      const done = [];
      const step = (name, act) => {
        act();
        done.push(name);
        if (snap() !== first) problems.push(`${id}: ${name} moved the room`);
      };
      const c = game.centre();
      step("render", () => game.frames(12));
      step("zoom", () => game.wheel(c, -480));
      step("pan", () => game.drag(c, { x: c.x - 220, y: c.y + 40 }));
      step("pinch", () => game.pinch(c));
      step("resize", () => game.resize({ width: 900, height: 700 }));
      step("rotation", () => game.resize({ width: 700, height: 900 }));
      step("hints", () => {
        game.hint();
        game.hint();
        game.hint();
      });
      step("pieces", () => {
        for (const piece of scene.interactables ?? []) game.tapPiece(piece.id);
      });
      step("a find", () => {
        const t = game.roomPlayed().pool.find((x) => game.listed().includes(x.id) && !game.found().includes(x.id));
        game.tapAt(boundsOf(t.region));
      });
      step("the tray", () => {
        if (game.button((e) => typeof e.props.className === "string" && e.props.className.includes("hos-tray-toggle"))) game.toggleTray();
      });
      step("visibility", () => {
        game.env.globals.document.visibilityState = "hidden";
        game.frames(4);
        game.env.globals.document.visibilityState = "visible";
        game.frames(4);
      });
      // reduced motion: the same seed is the same room
      const still = await startIn(tree, id, "medium", 0x0808, { reducedMotion: true });
      if (still.signature() !== game.signature() || !same(still.things(), game.things())) problems.push(`${id}: reduced motion plays another room`);
      still.unmount();
      // a phone: the same seed is the same room
      const phone = await startIn(tree, id, "medium", 0x0808, { viewport: REFERENCE_PHONE });
      if (phone.signature() !== game.signature() || !same(phone.things(), game.things())) problems.push(`${id}: the phone plays another room`);
      phone.unmount();
      steps[id] = done;
      game.unmount();
    }
    // and nothing in the view composes a layout: it only paints the session's
    const view = codeOnly(tree.read(FILES.sceneView)) + codeOnly(tree.read(FILES.game));
    const composes = /composeLayout|selectRound\(|Math\.random/.test(view);
    return { pass: problems.length === 0 && !composes, steps, viewComposesALayout: composes, problems: problems.slice(0, 8) };
  });

  // --- occupancy ---------------------------------------------------------------------------------------------

  await check("R09", "replayability", "NO_TWO_THINGS_SHARE_A_SLOT_OR_CLASH", () => {
    const problems = [];
    let layouts = 0;
    for (const scene of engine(tree).scenes) {
      const things = thingsOf(scene);
      const seen = [...DIFFICULTIES.flatMap((d) => sampleRounds(tree, scene, d, 200).map((r) => r.layout)), ...sampleLayouts(tree, scene, 400).map((c) => c.layout)];
      for (const layout of seen) {
        layouts += 1;
        const at = placementsIn(scene, layout);
        for (let i = 0; i < things.length; i += 1)
          for (let j = i + 1; j < things.length; j += 1) {
            const a = things[i];
            const b = things[j];
            if (clashes(scene, a, at[a.id], b, at[b.id])) problems.push(`${scene.id}: ${at[a.id].key} × ${at[b.id].key}`);
            // two pool objects never overlap: a tap is never ambiguous
            if (a.role === "target" && b.role === "target" && boxGap(at[a.id].box, at[b.id].box) <= 0) problems.push(`${scene.id}: ${a.id} overlaps ${b.id}`);
          }
      }
    }
    const unique = [...new Set(problems)];
    return { pass: unique.length === 0 && layouts > 0, layouts, problems: unique.slice(0, 8) };
  });

  await check("R10", "replayability", "NO_PLACEMENT_OUTSIDE_THE_ROOM_OR_UNDER_THE_FOREGROUND", () => {
    const problems = [];
    let placements = 0;
    for (const scene of engine(tree).scenes) {
      const fronts = scene.layers.slice(scene.layers.findIndex((l) => l.id === "plate") + 1).flatMap((l) => l.opaque ?? []);
      for (const thing of thingsOf(scene))
        for (const p of thing.placements) {
          placements += 1;
          if (!contains({ x: 0, y: 0, w: scene.width, h: scene.height }, p.box)) problems.push(`${scene.id}/${p.key}: outside the room`);
          if (fronts.some((r) => contains(r, p.box))) problems.push(`${scene.id}/${p.key}: wholly under a foreground layer`);
          // a picture of it is painted where its box is
          const sprite = scene.placementArt?.[p.key]?.sprite;
          if (sprite && boxGap(p.box, { x: sprite.x, y: sprite.y, w: sprite.w, h: sprite.h }) > 0) problems.push(`${scene.id}/${p.key}: its picture is elsewhere`);
        }
    }
    return { pass: problems.length === 0 && placements > 0, placements, problems: problems.slice(0, 8) };
  });

  // --- the session follows the layout ----------------------------------------------------------------------

  await check("R11", "replayability", "HIT_TESTING_FOLLOWS_THE_PLACEMENT", async () => {
    const problems = [];
    const facts = {};
    for (const id of SCENE_IDS) {
      const scene = room(tree, id);
      const pick = scene.pool.find((t) => !t.gate && t.placements?.length > 1 && seedWhere(tree, scene, "easy", `away:${t.id}`, listedAway(t.id)) !== null);
      const seed = seedWhere(tree, scene, "easy", `away:${pick.id}`, listedAway(pick.id));
      const game = await startIn(tree, id, "easy", seed);
      const now = game.roomPlayed().pool.find((t) => t.id === pick.id);
      // where it used to be: nothing to find (on a mouse, whose reach is small)
      game.tapAt(boundsOf(pick.region));
      const atHome = game.found().includes(pick.id);
      game.tapAt(boundsOf(now.region));
      const atPlacement = game.found().includes(pick.id);
      if (atHome) problems.push(`${id}: ${pick.id} found where it was painted before`);
      if (!atPlacement) problems.push(`${id}: ${pick.id} not found where it stands`);
      facts[id] = { object: pick.id, home: boundsOf(pick.region), now: boundsOf(now.region), atHome, atPlacement };
      game.unmount();
    }
    return { pass: problems.length === 0, ...facts, problems };
  });

  await check("R12", "replayability", "HINTS_FOLLOW_THE_PLACEMENT", async () => {
    const problems = [];
    const facts = {};
    for (const id of SCENE_IDS) {
      const scene = room(tree, id);
      const pick = scene.pool.find((t) => !t.gate && t.placements?.length > 1 && seedWhere(tree, scene, "easy", `away:${t.id}`, listedAway(t.id)) !== null);
      const seed = seedWhere(tree, scene, "easy", `away:${pick.id}`, listedAway(pick.id));
      const game = await startIn(tree, id, "easy", seed);
      // hint only this object: find every other listed one first
      for (const other of game.roomPlayed().pool.filter((t) => game.listed().includes(t.id) && t.id !== pick.id)) {
        if (other.gate && !game.pieces()[other.gate].open) game.tapPiece(other.gate);
        game.tapAt(boundsOf(other.region));
      }
      const now = game.roomPlayed().pool.find((t) => t.id === pick.id);
      const texts = [];
      let halo = null;
      for (let i = 0; i < 3; i += 1) {
        game.hint();
        texts.push(game.banner() ?? "");
        halo = game.halo() ?? halo;
      }
      const centre = centreOf(boundsOf(now.region));
      const away = centreOf(boundsOf(pick.region));
      if (!halo || Math.hypot(halo.cx - centre.x, halo.cy - centre.y) > 1) problems.push(`${id}: the last hint rings ${halo ? `${halo.cx},${halo.cy}` : "nothing"}, ${pick.id} stands at ${centre.x},${centre.y}`);
      const words = [now.hintRegion, now.hintDirection, now.hintContext].filter(Boolean);
      const said = texts.join(" ");
      const homeWords = [pick.hintRegion, pick.hintDirection, pick.hintContext].filter((w) => w && !words.includes(w));
      if (!words.some((w) => said.includes(w))) problems.push(`${id}: the hints never say where ${pick.id} stands (${clip(said, 120)})`);
      if (homeWords.some((w) => said.includes(w))) problems.push(`${id}: a hint still says where ${pick.id} was painted`);
      // the camera goes where it stands
      const cam = game.camera();
      if (Math.hypot(cam.x - centre.x, cam.y - centre.y) > Math.hypot(cam.x - away.x, cam.y - away.y) && Math.hypot(centre.x - away.x, centre.y - away.y) > 200) problems.push(`${id}: the camera went nearer where ${pick.id} was`);
      facts[id] = { object: pick.id, halo, at: centre };
      game.unmount();
    }
    return { pass: problems.length === 0, ...facts, problems };
  });

  await check("R13", "replayability", "A_SHUT_PIECE_HIDES_ITS_OBJECT_IN_EVERY_PLACEMENT", () => {
    const { model } = engine(tree);
    const R = model.sessionReducer;
    const problems = [];
    let tried = 0;
    for (const scene of engine(tree).scenes)
      for (const thing of thingsOf(scene).filter((t) => t.gate))
        for (const p of thing.placements) {
          const seed = seedWhere(tree, scene, "medium", `gated:${p.key}`, listedAway(thing.id, p.slot.id));
          if (seed === null) {
            if (p !== thing.placements[0]) problems.push(`${scene.id}/${p.key}: never in a round`);
            continue;
          }
          tried += 1;
          // one tap where it stands, with each pointer: a tap on the shut piece may open it, never find what it keeps
          for (const tool of ["touch", "mouse"]) {
            const s = R(session(tree, scene, "medium", seed), { type: "tap", point: centreOf(p.box), scale: 1, pointerType: tool });
            if (s.foundIds.includes(thing.id)) problems.push(`${scene.id}/${p.key}: found through its shut piece (${tool})`);
          }
          // and the art: shut, nothing of it shows
          const row = auditOf(tree, scene).placements.find((r) => r.key === p.key);
          if (!row || row.visibleAtRest > HIDDEN_AT_REST) problems.push(`${scene.id}/${p.key}: shows ${row?.visibleAtRest} shut`);
        }
    return { pass: problems.length === 0 && tried > 0, tried, problems: problems.slice(0, 8) };
  });

  await check("R14", "replayability", "OPENING_ITS_PIECE_EXPOSES_IT_WHERE_IT_STANDS", async () => {
    const { model } = engine(tree);
    const R = model.sessionReducer;
    const problems = [];
    let tried = 0;
    for (const scene of engine(tree).scenes)
      for (const thing of thingsOf(scene).filter((t) => t.gate))
        for (const p of thing.placements) {
          const seed = seedWhere(tree, scene, "medium", `gated:${p.key}`, listedAway(thing.id, p.slot.id));
          if (seed === null) continue;
          tried += 1;
          let s = session(tree, scene, "medium", seed);
          s = R(s, { type: "interact", interactableId: thing.gate });
          s = R(s, { type: "tap", point: centreOf(p.box), scale: 1, pointerType: "mouse" });
          if (!s.foundIds.includes(thing.id)) problems.push(`${scene.id}/${p.key}: not found with its piece open`);
          const row = auditOf(tree, scene).placements.find((r) => r.key === p.key);
          if (!row || row.visibleOpen < VISIBLE_FLOOR[tierOf(thing, p)]) problems.push(`${scene.id}/${p.key}: shows ${row?.visibleOpen} open`);
        }
    // the view too: the Observatório's drawer, opened, its object found where the round put it
    const scene = room(tree, OBSERVATORY_ID);
    const gated = thingsOf(scene).find((t) => t.gate && t.placements.length > 1);
    const seed = seedWhere(tree, scene, "medium", `gated:${gated.placements[1].key}`, listedAway(gated.id, gated.placements[1].slot.id));
    const game = await startIn(tree, OBSERVATORY_ID, "medium", seed);
    game.tapPiece(gated.gate);
    game.tapAt(gated.placements[1].box);
    if (!game.found().includes(gated.id)) problems.push(`${OBSERVATORY_ID}: ${gated.placements[1].key} not found in the game`);
    game.unmount();
    return { pass: problems.length === 0 && tried > 0, tried, problems: problems.slice(0, 8) };
  });

  await check("R15", "replayability", "WHAT_IS_NOT_LISTED_STAYS_SCENERY", () => {
    const L = layoutEngine(tree);
    const { model } = engine(tree);
    const R = model.sessionReducer;
    const problems = [];
    let taps = 0;
    for (const scene of engine(tree).scenes) {
      const draw = sampleRounds(tree, scene, "easy", 40)[17];
      const placed = L.placedScene(scene, draw.layout);
      const s0 = session(tree, scene, "easy", draw.seed);
      const pieces = (scene.interactables ?? []).flatMap((p) => p.states.map((st) => st.hit));
      const inert = [
        ...placed.lookAlikes.map((l) => ({ id: l.id, region: l.region })),
        ...placed.pool.filter((t) => !draw.targets.includes(t.id)).map((t) => ({ id: t.id, region: t.region })),
        ...(scene.props ?? []).map((p) => ({ id: p.id, region: { kind: "rect", ...L.placedBox(scene, L.layoutThings(scene).find((t) => t.id === p.id), p.placements[draw.layout.picks[p.id]]) } })),
      ];
      for (const thing of inert) {
        const at = centreOf(boundsOf(thing.region));
        if (pieces.some((h) => contains(h, { ...at, w: 0, h: 0 }))) continue;
        // a mouse tap on its centre, far from every listed object
        const listed = placed.pool.filter((t) => draw.targets.includes(t.id));
        if (listed.some((t) => boxGap(boundsOf(t.region), { ...at, w: 0, h: 0 }) < 60)) continue;
        taps += 1;
        const s = R(s0, { type: "tap", point: at, scale: 1, pointerType: "mouse" });
        if (s.foundIds.length) problems.push(`${scene.id}: a tap on ${thing.id} found ${s.foundIds}`);
      }
    }
    return { pass: problems.length === 0 && taps > 20, taps, problems: problems.slice(0, 8) };
  });

  // --- what moves --------------------------------------------------------------------------------------------

  await check("R16", "replayability", "LOOK_ALIKES_MOVE_BY_SEED", () => {
    const L = layoutEngine(tree);
    const problems = [];
    const facts = {};
    for (const scene of engine(tree).scenes) {
      const looks = thingsOf(scene).filter((t) => t.role === "lookalike");
      const movable = looks.filter((t) => t.placements.length > 1);
      const layouts = sampleLayouts(tree, scene, 400).map((c) => c.layout);
      const moved = movable.filter((t) => layouts.some((l) => (l.picks[t.id] ?? 0) !== 0));
      const placedMoves = movable.filter((t) => layouts.some((l) => !same(L.placedScene(scene, l).lookAlikes.find((x) => x.id === t.id).region, t.region)));
      if (movable.length < looks.length * 0.6) problems.push(`${scene.id}: ${movable.length} of ${looks.length} look-alikes can move`);
      if (moved.length !== movable.length) problems.push(`${scene.id}: ${movable.length - moved.length} movable look-alikes never move`);
      if (placedMoves.length !== movable.length) problems.push(`${scene.id}: the placed room leaves look-alikes home`);
      facts[scene.id] = { lookAlikes: looks.length, movable: movable.length, moved: moved.length };
    }
    return { pass: problems.length === 0, ...facts, problems };
  });

  await check("R17", "replayability", "PROPS_MOVE_TOO_AND_MOVING_SAYS_NOTHING", () => {
    const problems = [];
    const facts = {};
    for (const scene of engine(tree).scenes) {
      const things = thingsOf(scene);
      const props = things.filter((t) => t.role === "prop" && t.placements.length > 1);
      if (!props.length) problems.push(`${scene.id}: no prop moves`);
      // across the rounds a difficulty draws, a listed object is off home about as often as anything else that can move
      const movable = things.filter((t) => t.placements.length > 1);
      let listedAwayCount = 0;
      let listedN = 0;
      let otherAway = 0;
      let otherN = 0;
      const propMoved = new Set();
      for (const difficulty of DIFFICULTIES)
        for (const draw of sampleRounds(tree, scene, difficulty, 200))
          for (const t of movable) {
            const away = (draw.layout.picks[t.id] ?? 0) !== 0;
            if (t.role === "prop" && away) propMoved.add(t.id);
            if (draw.targets.includes(t.id)) {
              listedN += 1;
              listedAwayCount += away;
            } else {
              otherN += 1;
              otherAway += away;
            }
          }
      const listedShare = listedAwayCount / Math.max(1, listedN);
      const otherShare = otherAway / Math.max(1, otherN);
      if (propMoved.size !== props.length) problems.push(`${scene.id}: ${props.length - propMoved.size} props never move`);
      if (otherAway === 0) problems.push(`${scene.id}: only listed objects move`);
      if (Math.abs(listedShare - otherShare) > 0.2) problems.push(`${scene.id}: a listed object is off home ${(listedShare * 100).toFixed(0)}% of rounds, anything else ${(otherShare * 100).toFixed(0)}%`);
      facts[scene.id] = { props: props.length, listedOffHome: Number(listedShare.toFixed(3)), othersOffHome: Number(otherShare.toFixed(3)) };
    }
    return { pass: problems.length === 0, ...facts, problems };
  });

  // --- the round model reads the room as it stands -----------------------------------------------------------

  await check("R18", "replayability", "PLACEMENT_MEASUREMENTS_FEED_THE_ROUND_MODEL", () => {
    const L = layoutEngine(tree);
    const { difficulty: D } = engine(tree);
    const problems = [];
    let checked = 0;
    let differs = 0;
    for (const scene of engine(tree).scenes) {
      const things = thingsOf(scene);
      for (const draw of sampleRounds(tree, scene, "medium", 60)) {
        const placed = L.placedScene(scene, draw.layout);
        const at = placementsIn(scene, draw.layout);
        const occupied = new Set(Object.values(at).map((p) => p.key));
        for (const t of placed.pool) {
          const thing = things.find((x) => x.id === t.id);
          const p = at[t.id];
          const m = scene.placementArt[p.key].measured;
          // the suite's own arithmetic: the audit on that slot, its neighbours' share of its ring
          let busy = m.busy;
          for (const [other, delta] of Object.entries(m.near)) if (occupied.has(other)) busy += delta;
          const expect = { visible: m.visible, edge: m.edge, clutter: Number((busy / Math.max(1, m.ring)).toFixed(3)) };
          checked += 1;
          if (Math.abs(t.measured.visible - expect.visible) > 1e-9 || Math.abs(t.measured.edge - expect.edge) > 1e-9 || Math.abs(t.measured.clutter - expect.clutter) > 0.0015)
            problems.push(`${scene.id}/${p.key}: the round model reads ${JSON.stringify(t.measured)}, the audit says ${JSON.stringify(expect)}`);
          if (t.tier !== tierOf(thing, p)) problems.push(`${scene.id}/${p.key}: tier ${t.tier}, the placement's ${tierOf(thing, p)}`);
          if (!same(t.measured, scene.pool.find((x) => x.id === t.id).measured)) differs += 1;
        }
        // the round's profile is the placed room's: the mean load of each object where it stands
        const profile = D.roundProfile(placed, "medium", draw.targets);
        const loads = draw.targets.map((id) => D.searchLoad(placed, placed.pool.find((t) => t.id === id)));
        if (Math.abs(profile.search - loads.reduce((a, b) => a + b, 0) / loads.length) > 1e-9) problems.push(`${scene.id}/${draw.seed}: the profile ignores where the list stands`);
      }
    }
    return { pass: problems.length === 0 && checked > 0 && differs > checked * 0.2, checked, measuredOffHome: differs, problems: [...new Set(problems)].slice(0, 6) };
  });

  const floorsHold = (difficulty) => () => {
    const L = layoutEngine(tree);
    const { difficulty: D, contract } = engine(tree);
    const rule = contract.DIFFICULTY_PRESETS[difficulty].round;
    const problems = [];
    let rounds = 0;
    let fallbacks = 0;
    for (const scene of engine(tree).scenes) {
      const things = thingsOf(scene);
      for (const draw of sampleRounds(tree, scene, difficulty, 250)) {
        rounds += 1;
        if (draw.fallback) fallbacks += 1;
        const placed = L.placedScene(scene, draw.layout);
        const profile = D.roundProfile(placed, difficulty, draw.targets);
        if (!D.meetsRule(rule, profile)) problems.push(`${scene.id}/${draw.seed}: the composed round misses the ${difficulty} rule`);
        // the suite's own count of tiers, from each object's placement
        const at = placementsIn(scene, draw.layout);
        const tiers = { A: 0, B: 0, C: 0 };
        for (const id of draw.targets) tiers[tierOf(things.find((t) => t.id === id), at[id])] += 1;
        for (const tier of ["A", "B", "C"]) if (tiers[tier] < rule.tiers[tier][0] || tiers[tier] > rule.tiers[tier][1]) problems.push(`${scene.id}/${draw.seed}: ${tiers[tier]} tier-${tier} placements in ${difficulty}`);
        if (draw.targets.length !== contract.DIFFICULTY_PRESETS[difficulty].targetCount && contract.DIFFICULTY_PRESETS[difficulty].targetCount !== undefined) problems.push(`${scene.id}/${draw.seed}: ${draw.targets.length} objects`);
      }
    }
    return { pass: problems.length === 0 && rounds > 0, rounds, fallbacks, problems: [...new Set(problems)].slice(0, 6) };
  };
  await check("R19", "replayability", "EASY_ROUNDS_HOLD_THEIR_FLOORS_IN_EVERY_LAYOUT", floorsHold("easy"));
  await check("R20", "replayability", "MEDIUM_ROUNDS_HOLD_THEIR_FLOORS_IN_EVERY_LAYOUT", floorsHold("medium"));
  await check("R21", "replayability", "HARD_ROUNDS_HOLD_THEIR_FLOORS_IN_EVERY_LAYOUT", floorsHold("hard"));

  await check("R22", "replayability", "INTERACTION_DEPTH_STAYS_IN_BOUNDS", () => {
    const { contract } = engine(tree);
    const problems = [];
    const counts = {};
    for (const scene of engine(tree).scenes) {
      const things = thingsOf(scene);
      for (const difficulty of DIFFICULTIES) {
        const [lo, hi] = contract.GATED_BOUNDS[difficulty];
        for (const draw of sampleRounds(tree, scene, difficulty, 250)) {
          const at = placementsIn(scene, draw.layout);
          const gated = draw.targets.filter((id) => things.find((t) => t.id === id).gate);
          if (gated.length < lo || gated.length > hi) problems.push(`${scene.id}/${difficulty}/${draw.seed}: ${gated.length} kept objects`);
          for (const id of gated) if (at[id].slot.gate !== things.find((t) => t.id === id).gate) problems.push(`${scene.id}/${id}: kept outside its piece`);
          counts[`${scene.id}:${difficulty}`] = (counts[`${scene.id}:${difficulty}`] ?? 0) + gated.length;
        }
      }
    }
    return { pass: problems.length === 0, keptObjectsListed: counts, problems: [...new Set(problems)].slice(0, 6) };
  });

  await check("R23", "replayability", "EVERY_PLACEMENT_OF_EVERY_OBJECT_IS_FAIR", () => {
    const problems = [];
    const facts = {};
    for (const scene of engine(tree).scenes) {
      const audit = auditOf(tree, scene);
      const rows = new Map(audit.placements.map((r) => [r.key, r]));
      // the audit is of the shipped atlas
      const atlasSha = createHash("sha256").update(readBinary(tree, `public${scene.atlas.src}`)).digest("hex");
      if (atlasSha !== audit.atlasSha256) problems.push(`${scene.id}: the audit is of another atlas`);
      let n = 0;
      for (const thing of thingsOf(scene).filter((t) => t.role === "target"))
        for (const p of thing.placements) {
          n += 1;
          const row = rows.get(p.key);
          const tier = tierOf(thing, p);
          if (!row) {
            problems.push(`${scene.id}/${p.key}: not audited`);
            continue;
          }
          if (row.tier !== tier) problems.push(`${scene.id}/${p.key}: audited as ${row.tier}, plays as ${tier}`);
          if (row.visible < VISIBLE_FLOOR[tier] - EPS) problems.push(`${scene.id}/${p.key}: ${row.visible} visible (${tier} floor ${VISIBLE_FLOOR[tier]})`);
          if (row.edge < EDGE_FLOOR - EPS) problems.push(`${scene.id}/${p.key}: edge ${row.edge}`);
          if (thing.gate && row.visibleAtRest > HIDDEN_AT_REST) problems.push(`${scene.id}/${p.key}: shows ${row.visibleAtRest} with its piece shut`);
          const m = scene.placementArt[p.key].measured;
          if (m.visible !== row.visible || m.edge !== row.edge || m.busy !== row.busy || m.ring !== row.ring) problems.push(`${scene.id}/${p.key}: the game reads another audit`);
        }
      facts[scene.id] = { placements: n, kit: audit.kit };
    }
    return { pass: problems.length === 0, ...facts, problems: problems.slice(0, 8) };
  });

  // --- variety --------------------------------------------------------------------------------------------

  await check("R24", "replayability", "EVERY_AUTHORED_PLACEMENT_IS_REACHABLE", () => {
    const problems = [];
    const facts = {};
    for (const scene of engine(tree).scenes) {
      const things = thingsOf(scene);
      const observed = new Set(sampleLayouts(tree, scene, 1500).flatMap((c) => Object.values(placementsIn(scene, c.layout)).map((p) => p.key)));
      for (const d of DIFFICULTIES) for (const draw of sampleRounds(tree, scene, d, 250)) for (const p of Object.values(placementsIn(scene, draw.layout))) observed.add(p.key);
      let total = 0;
      for (const thing of things)
        for (const p of thing.placements) {
          total += 1;
          let ok;
          try {
            ok = feasible(scene, things, p.key);
          } catch {
            ok = false;
          }
          if (!ok) problems.push(`${scene.id}/${p.key}: no room can hold it`);
          else if (!observed.has(p.key)) problems.push(`${scene.id}/${p.key}: never drawn`);
        }
      facts[scene.id] = { placements: total, observed: observed.size };
    }
    return { pass: problems.length === 0, ...facts, problems: problems.slice(0, 8) };
  });

  await check("R25", "replayability", "NO_SLOT_DOMINATES_AND_NO_HARD_OBJECT_COLLAPSES", () => {
    const problems = [];
    const facts = {};
    for (const scene of engine(tree).scenes) {
      const things = thingsOf(scene).filter((t) => t.placements.length > 1);
      const layouts = sampleLayouts(tree, scene, 1500).map((c) => c.layout);
      let worst = { id: null, share: 0 };
      for (const thing of things) {
        const counts = new Map(thing.placements.map((p) => [p.key, 0]));
        for (const l of layouts) counts.set(thing.placements[l.picks[thing.id] ?? 0].key, counts.get(thing.placements[l.picks[thing.id] ?? 0].key) + 1);
        for (const [key, share] of shares(counts)) {
          if (share > SLOT_SHARE.max) problems.push(`${scene.id}/${key}: ${(share * 100).toFixed(0)}% of layouts`);
          if (share < SLOT_SHARE.min) problems.push(`${scene.id}/${key}: ${(share * 100).toFixed(1)}% of layouts`);
          if (share > worst.share) worst = { id: key, share: Number(share.toFixed(3)) };
        }
      }
      // Difícil: an object with two Difícil placements or more is never asked for in one of them only
      const hard = sampleRounds(tree, scene, "hard", 600);
      for (const thing of things.filter((t) => t.role === "target")) {
        const eligible = thing.placements.filter((p) => tierOf(thing, p) !== "A");
        if (eligible.length < 2) continue;
        const counts = new Map(eligible.map((p) => [p.key, 0]));
        for (const draw of hard) if (draw.targets.includes(thing.id)) counts.set(thing.placements[draw.layout.picks[thing.id] ?? 0].key, (counts.get(thing.placements[draw.layout.picks[thing.id] ?? 0].key) ?? 0) + 1);
        const total = [...counts.values()].reduce((s, v) => s + v, 0);
        if (total < 20) continue;
        const top = Math.max(...counts.values()) / total;
        if (top > HARD_SLOT_CEILING) problems.push(`${scene.id}/${thing.id}: ${(top * 100).toFixed(0)}% of its Difícil rounds on one placement`);
      }
      facts[scene.id] = { mostTaken: worst };
    }
    return { pass: problems.length === 0, ...facts, problems: problems.slice(0, 8) };
  });

  await check("R26", "replayability", "NO_IMMEDIATE_REPEAT_WHILE_ANOTHER_ROOM_EXISTS", () => {
    const { rounds } = engine(tree);
    const problems = [];
    const facts = {};
    for (const scene of engine(tree).scenes)
      for (const difficulty of DIFFICULTIES) {
        const next = lcg(0x2626 + difficulty.length);
        let previous = null;
        let repeats = 0;
        for (let i = 0; i < 150; i += 1) {
          const { signature } = rounds.explorationSeed(scene, difficulty, previous, () => Math.floor(next() * 2 ** 32));
          if (signature === previous) repeats += 1;
          previous = signature;
        }
        // forced: the draw would repeat the room just played — another seed is drawn
        const repeatSeed = 0x1234;
        const sig = rounds.selectRound(scene, difficulty, repeatSeed).layout.signature;
        const queue = [repeatSeed, repeatSeed, 0x4321];
        const forced = rounds.explorationSeed(scene, difficulty, sig, () => queue.shift() ?? 0x5555);
        if (forced.signature === sig) problems.push(`${scene.id}/${difficulty}: the forced repeat was kept`);
        if (repeats) problems.push(`${scene.id}/${difficulty}: ${repeats} immediate repeats in 150 explorations`);
        facts[`${scene.id}:${difficulty}`] = { repeats, forcedDraws: forced.draws };
      }
    return { pass: problems.length === 0, ...facts, problems };
  });

  await check("R27", "replayability", "THE_MEMORY_NEVER_CHANGES_WHAT_A_SEED_GIVES", () => {
    const { rounds, registry } = engine(tree);
    const problems = [];
    for (const scene of engine(tree).scenes)
      for (const difficulty of DIFFICULTIES)
        for (const seed of [11, 4242, 0xbeef]) {
          const first = session(tree, scene, difficulty, seed);
          registry.rememberLayout(scene, first.layout.signature);
          const again = session(tree, scene, difficulty, seed);
          const direct = rounds.selectRound(scene, difficulty, seed);
          if (again.layout.signature !== first.layout.signature || direct.layout.signature !== first.layout.signature || !same(again.targets, first.targets)) problems.push(`${scene.id}/${difficulty}/${seed}`);
          // the seed the anti-repeat keeps is the whole of the round
          const kept = rounds.explorationSeed(scene, difficulty, first.layout.signature, (() => {
            const q = [seed, seed + 1, seed + 2];
            return () => q.shift() ?? seed + 3;
          })());
          if (rounds.selectRound(scene, difficulty, kept.seed).layout.signature !== kept.signature) problems.push(`${scene.id}/${difficulty}/${seed}: the kept seed composes another room`);
        }
    return { pass: problems.length === 0, problems: problems.slice(0, 6) };
  });

  await check("R28", "replayability", "GENERATION_IS_BOUNDED", () => {
    const L = layoutEngine(tree);
    const { rounds } = engine(tree);
    const problems = [];
    const constants = { layoutSteps: L.LAYOUT_STEPS, layoutAttempts: rounds.LAYOUT_ATTEMPTS, roundDraws: rounds.ROUND_DRAWS, repeatDraws: rounds.REPEAT_DRAWS };
    for (const [key, value] of Object.entries(constants)) if (!(Number.isFinite(value) && value > 0 && value <= BOUNDS[key])) problems.push(`${key} = ${value}`);
    let worstSteps = 0;
    let worstMs = 0;
    let worstAttempt = 0;
    let fallbacks = 0;
    for (const scene of engine(tree).scenes) {
      for (const c of sampleLayouts(tree, scene, 1500)) worstSteps = Math.max(worstSteps, c.steps);
      for (const difficulty of DIFFICULTIES)
        for (let seed = 1; seed <= 120; seed += 1) {
          const t0 = performance.now();
          const draw = rounds.selectRound(scene, difficulty, seed * 7919);
          worstMs = Math.max(worstMs, performance.now() - t0);
          worstAttempt = Math.max(worstAttempt, draw.attempt);
          fallbacks += draw.fallback ? 1 : 0;
          if (draw.attempt > constants.layoutAttempts || draw.draws > constants.roundDraws * (constants.layoutAttempts + 1)) problems.push(`${scene.id}/${difficulty}: ${draw.attempt} attempts, ${draw.draws} draws`);
        }
      // the anti-repeat ends even when every draw repeats the room
      let calls = 0;
      try {
        const sig = rounds.selectRound(scene, "easy", 99).layout.signature;
        const out = rounds.explorationSeed(scene, "easy", sig, () => {
          calls += 1;
          if (calls > 1000) throw new Error("unbounded");
          return 99;
        });
        if (out.draws > constants.repeatDraws || calls > constants.repeatDraws) problems.push(`${scene.id}: ${calls} draws for one exploration`);
      } catch (error) {
        problems.push(`${scene.id}: the anti-repeat never stopped (${error.message})`);
      }
    }
    if (worstSteps > constants.layoutSteps) problems.push(`a composition took ${worstSteps} steps`);
    const loops = [LAYOUT_FILE, FILES.rounds].filter((f) => /while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*\)/.test(codeOnly(tree.read(f))));
    if (loops.length) problems.push(`open loops in ${loops.join(", ")}`);
    return { pass: problems.length === 0, constants, worstSteps, worstAttempt, worstRoundMs: Number(worstMs.toFixed(1)), fallbacks, problems };
  });

  await check("R29", "replayability", "TWENTY_EXPLORATIONS_LOOK_DIFFERENT", async () => {
    const L = layoutEngine(tree);
    const problems = [];
    const facts = {};
    for (const id of SCENE_IDS) {
      const scene = room(tree, id);
      const things = thingsOf(scene);
      const game = await startIn(tree, id, "medium", 0x2929);
      const sigs = [game.signature()];
      for (let i = 1; i < 20; i += 1) {
        game.changeScene();
        game.explore();
        sigs.push(game.signature());
      }
      game.unmount();
      const layouts = sigs.map((s) => L.layoutFromSignature(scene, s));
      let moved = 0;
      let repeats = 0;
      for (let i = 1; i < layouts.length; i += 1) {
        if (sigs[i] === sigs[i - 1]) repeats += 1;
        moved += things.filter((t) => (layouts[i].picks[t.id] ?? 0) !== (layouts[i - 1].picks[t.id] ?? 0)).length / things.length;
      }
      const meanMoved = moved / (layouts.length - 1);
      const targets = things.filter((t) => t.role === "target" && t.placements.length > 1);
      const stayed = targets.filter((t) => new Set(layouts.map((l) => l.picks[t.id] ?? 0)).size < 2).map((t) => t.id);
      const used = new Set(layouts.flatMap((l) => things.map((t) => `${t.id}@${l.picks[t.id] ?? 0}`)));
      const total = things.reduce((s, t) => s + t.placements.length, 0);
      if (new Set(sigs).size !== 20) problems.push(`${id}: ${new Set(sigs).size} rooms in 20 explorations`);
      if (repeats) problems.push(`${id}: ${repeats} immediate repeats`);
      if (meanMoved < MOVED_SHARE.min || meanMoved > MOVED_SHARE.max) problems.push(`${id}: ${(meanMoved * 100).toFixed(0)}% of the room moves between explorations`);
      if (stayed.length > targets.length * 0.1) problems.push(`${id}: ${stayed.length} objects never moved in 20 explorations (${stayed.join(", ")})`);
      if (used.size / total < 0.8) problems.push(`${id}: 20 explorations used ${used.size} of ${total} placements`);
      facts[id] = { rooms: new Set(sigs).size, meanMoved: Number(meanMoved.toFixed(3)), placementsUsed: `${used.size}/${total}`, objectsThatNeverMoved: stayed };
    }
    return { pass: problems.length === 0, ...facts, problems };
  });

  // --- guards ------------------------------------------------------------------------------------------------

  await check("R30", "preserved", "THE_ROOMS_KEEP_THEIR_ANCHORS", () => {
    const mine = engine(tree);
    const base = engine(BASE_TREE);
    const problems = [];
    const anchors = {};
    for (const id of SCENE_IDS) {
      const a = mine.byId[id];
      const b = base.byId[id];
      if (a.width !== b.width || a.height !== b.height || !same(a.stations, b.stations) || a.initialStation !== b.initialStation) problems.push(`${id}: the room's frame moved`);
      if (!same(a.layers.map((l) => [l.id, l.rect, l.opaque, l.depth]), b.layers.map((l) => [l.id, l.rect, l.opaque, l.depth]))) problems.push(`${id}: a layer moved`);
      if (!same((a.interactables ?? []).map((p) => ({ ...p, src: null })), (b.interactables ?? []).map((p) => ({ ...p, src: null })))) problems.push(`${id}: a piece moved`);
      // the room's large things are its structure: one place each
      const big = [...a.pool, ...a.lookAlikes].filter((t) => boundsOf(t.region).w * boundsOf(t.region).h >= ANCHOR_AREA);
      for (const t of big) if ((t.placements?.length ?? 1) > 1) problems.push(`${id}/${t.id}: a structural thing moves`);
      anchors[id] = big.map((t) => t.id);
    }
    return { pass: problems.length === 0, anchors, problems };
  });

  await check("R31", "preserved", "HOME_NEVER_LOADS_A_ROOM_LAYOUT", () => {
    const graph = staticGraph(tree);
    const home = graph.closure(APP_ROOTS, ["static"]);
    const leaked = home.filter((file) => file.startsWith(DIR));
    const named = home.filter((file) => /\.(ts|tsx)$/.test(file) && /hidden-objects\/[a-z-]+\/v\d+\/(atlas|plate)|\.art["']/.test(codeOnly(tree.read(file))));
    const registry = graph.node(FILES.registry);
    const staticGame = registry.static.filter((file) => file.startsWith(DIR));
    // a room's art module is reached only from its room
    const artImporters = Object.values(ART_FILES)
      .filter((f) => tree.exists(f))
      .flatMap((f) => listFiles(tree, "src").filter((s) => /\.(ts|tsx)$/.test(s) && graph.node(s).static.includes(f) && ![FILES.studioScene, FILES.observatoryScene].includes(s)));
    return { pass: leaked.length === 0 && named.length === 0 && staticGame.length === 0 && artImporters.length === 0, homeModules: home.length, game03InHome: leaked, homeNamesRoomArt: named, staticGame, artImporters };
  });

  await check("R32", "preserved", "NO_TIMER_SCORE_LIVES_OR_RANKING", () => {
    const files = listFiles(tree, DIR).filter((file) => /\.(ts|tsx)$/.test(file));
    const pressure = files.filter((file) => /setInterval|Date\.now|new Date\(|countdown|timeLeft|\blives\b|\bvidas\b|\bstreak|\branking|leaderboard|\bpenalt/i.test(codeOnly(tree.read(file))));
    const { byId, model } = engine(tree);
    const scene = byId[STUDIO_ID];
    const R = model.sessionReducer;
    const play = (fiddle) => {
      let s = session(tree, scene, "hard", 2020);
      const placedRoom = model.roomOf ? model.roomOf(s) : scene;
      for (const id of [...s.targets]) {
        const t = model.targetById(placedRoom, id);
        if (fiddle) {
          for (let i = 0; i < 3; i += 1) s = R(s, { type: "hint" });
          s = R(s, { type: "tap", point: { x: 3, y: 3 }, scale: 1, pointerType: "touch" });
        }
        if (t.gate && s.interactions && !scene.interactables.find((p) => p.id === t.gate).states.find((x) => x.id === s.interactions[t.gate])?.open) s = R(s, { type: "interact", interactableId: t.gate });
        s = R(s, { type: "tap", point: model.regionCenter(t.region), scale: 1, pointerType: "mouse" });
      }
      return model.buildHiddenObjectsResult(s);
    };
    const quiet = play(false);
    const busy = play(true);
    const keys = [...Object.keys(busy), ...Object.keys(busy.details), ...Object.keys(model.createSession(scene))];
    const raceKeys = keys.filter((key) => /time|elapsed|clock|countdown|deadline|rank|best|streak|lives|points|bonus|penalt|star|moves|opened/i.test(key));
    return { pass: pressure.length === 0 && same(quiet, busy) && raceKeys.length === 0 && busy.details.completed === true, sourcesWithPressure: pressure, hintsAndMissesChangeNothing: same(quiet, busy), raceKeys };
  });

  await check("R33", "preserved", "OLD_RESULTS_REMAIN_READABLE", async () => {
    const t = platformTables(tree);
    const env = createEnvironment({ storage: { [STORAGE_KEY]: JSON.stringify(OLD_RESULTS) } });
    const storage = createModuleGraph({ tree, mocks: {}, globals: env.globals }).require(FILES.storage);
    const readBack = storage.getRecentResults();
    const game = openGame(tree, { seeds: [0x3333] });
    if (game.sceneId() !== OBSERVATORY_ID) game.chooseScene(OBSERVATORY_ID);
    await game.decode();
    game.chooseDifficulty("hard");
    game.explore();
    // the base has no layout: its room is the scene as painted
    if (!tree.exists(LAYOUT_FILE)) game.roomPlayed = () => game.scene();
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
      theTrilhaResultStillReads: Array.isArray(shown(OLD_RESULTS[3])),
      aNewResultHasTheSameShape: same(sorted(Object.keys(result.details)), RESULT_DETAIL_KEYS) && result.score === result.details.foundObjects && result.details.completed === true,
    };
    return { pass: Object.values(facts).every(Boolean), ...facts, newDetails: result.details };
  });

  await check("R34", "preserved", "TWO_ROOMS_NO_THIRD", () => {
    const ids = engine(tree).scenes.map((s) => s.id);
    const sceneFiles = listFiles(tree, `${DIR}scenes/`).filter((f) => /\.ts$/.test(f) && !/\.art\.ts$/.test(f));
    return { pass: same(ids, SCENE_IDS) && sceneFiles.length === 2, rooms: ids, sceneFiles };
  });

  await check("R35", "replayability", "BOTH_ROOMS_USE_THE_ONE_SYSTEM", () => {
    const L = layoutEngine(tree);
    const problems = [];
    const facts = {};
    for (const scene of engine(tree).scenes) {
      const engineThings = L.layoutThings(scene);
      const mine = thingsOf(scene);
      if (engineThings.length !== mine.length) problems.push(`${scene.id}: the engine sees ${engineThings.length} things, the data has ${mine.length}`);
      const movable = mine.filter((t) => t.placements.length > 1);
      if (movable.length < mine.length * 0.6) problems.push(`${scene.id}: ${movable.length} of ${mine.length} things move`);
      if (!movable.some((t) => t.role === "target") || !movable.some((t) => t.role === "lookalike") || !movable.some((t) => t.role === "prop")) problems.push(`${scene.id}: not every kind of thing moves`);
      if (!scene.atlas || !scene.placementArt) problems.push(`${scene.id}: no atlas`);
      facts[scene.id] = { things: mine.length, movable: movable.length, slots: scene.slots.length };
    }
    // one composer for both: the registry's rooms are plain data
    const roomSources = [FILES.studioScene, FILES.observatoryScene].map((f) => codeOnly(tree.read(f)));
    const roomCode = roomSources.filter((text) => /function\s|=>\s*\{/.test(text.replace(/thumbnailSrc[^\n]*\n/g, "")));
    if (roomCode.length) problems.push("a room module carries layout code");
    return { pass: problems.length === 0, ...facts, problems };
  });

  await check("R36", "replayability", "NO_ROOM_BRANCH_IN_THE_ENGINE", () => {
    if (!tree.exists(LAYOUT_FILE)) throw new Error("no layout engine on this tree");
    const names = new Set();
    for (const scene of engine(tree).scenes) {
      names.add(scene.id);
      for (const s of scene.stations) names.add(s.id);
      for (const s of scene.slots ?? []) names.add(s.id);
      for (const t of thingsOf(scene)) names.add(t.id);
      for (const p of scene.interactables ?? []) names.add(p.id);
    }
    const hits = [];
    for (const file of ENGINE_FILES) {
      const code = codeOnly(tree.read(file));
      for (const name of names) if (new RegExp(`["'\`]${name}["'\`]`).test(code)) hits.push(`${file.slice(DIR.length)}: "${name}"`);
      if (/scene\.id\s*===|\.id\s*===\s*["']explorer-/.test(code)) hits.push(`${file.slice(DIR.length)}: compares a room's id`);
    }
    return { pass: hits.length === 0, names: names.size, hits: hits.slice(0, 8) };
  });

  return results;
}

// --- mutants: in-memory overrides of today's tree, each of which some check must catch ----------------

const MUTANTS = [
  {
    name: "the view composes its own layout with Math.random on every render",
    files: {
      [FILES.sceneView]: [
        ["      {layoutSprites(scene, layout).map((sprite) => (", "      {layoutSprites(scene, composeLayout(scene, Math.floor(Math.random() * 2 ** 32)).layout).map((sprite) => ("],
        ["import { layoutSprites, placedScene", "import { composeLayout, layoutSprites, placedScene"],
      ],
    },
    mustFail: ["R02", "R08"],
  },
  {
    name: "the same seed gives another position (the composer counts its calls)",
    files: { [LAYOUT_FILE]: [["  const random = mulberry(seed);\n  const picks", "  const random = mulberry(seed + (calls += 1));\n  const picks"], ["const planIndex = new WeakMap", "let calls = 0;\nconst planIndex = new WeakMap"]] },
    mustFail: ["R04", "R05"],
  },
  {
    name: "Recomeçar draws another layout",
    files: { [FILES.model]: [["      return state.status === \"setup\" ? state : freshRound(state);", "      return state.status === \"setup\" ? state : freshRound({ ...state, layout: selectRound(state.scene, state.difficulty, (state.roundSeed ?? 0) + 1).layout });"]] },
    mustFail: ["R06"],
  },
  {
    name: "a tap still tests the object where it was painted",
    files: { [FILES.model]: [["      const hit = hitTest(roomOf(state), action.point, reachable, action.scale, tolerance);", "      const hit = hitTest(state.scene, action.point, reachable, action.scale, tolerance);"]] },
    mustFail: ["R11"],
  },
  {
    name: "the hint's halo rings where the object was painted",
    files: { [FILES.game]: [["    const halo = state.hintTarget ? hintHalo(roomOf(state), state.hintTarget", "    const halo = state.hintTarget ? hintHalo(state.scene, state.hintTarget"]] },
    mustFail: ["R12"],
  },
  {
    name: "two things may share a slot",
    files: { [LAYOUT_FILE]: [["      if (slots[i] === slots[j] || tooClose(", "      if (tooClose("]] },
    mustFail: ["R09"],
  },
  {
    name: "a slot outside the room",
    files: { [FILES.studioScene]: [['    at: { x: 1930, y: 998 },', '    at: { x: 3990, y: 998 },']] },
    mustFail: ["R10"],
  },
  {
    name: "look-alikes never move",
    files: { [LAYOUT_FILE]: [["? [{ id: lookAlike.id, role: \"lookalike\", home: regionBox(lookAlike.region), placements: lookAlike.placements, region: lookAlike.region }]", "? [{ id: lookAlike.id, role: \"lookalike\", home: regionBox(lookAlike.region), placements: lookAlike.placements.slice(0, 1), region: lookAlike.region }]"]] },
    mustFail: ["R16"],
  },
  {
    name: "the rooms' props never move",
    files: { [LAYOUT_FILE]: [["home: prop.box, placements: prop.placements, region: rectRegion(prop.box)", "home: prop.box, placements: prop.placements.slice(0, 1), region: rectRegion(prop.box)"]] },
    mustFail: ["R17"],
  },
  {
    name: "only the listed objects move",
    files: {
      [LAYOUT_FILE]: [
        ["? [{ id: lookAlike.id, role: \"lookalike\", home: regionBox(lookAlike.region), placements: lookAlike.placements, region: lookAlike.region }]", "? [{ id: lookAlike.id, role: \"lookalike\", home: regionBox(lookAlike.region), placements: lookAlike.placements.slice(0, 1), region: lookAlike.region }]"],
        ["home: prop.box, placements: prop.placements, region: rectRegion(prop.box)", "home: prop.box, placements: prop.placements.slice(0, 1), region: rectRegion(prop.box)"],
      ],
    },
    mustFail: ["R16", "R17"],
  },
  {
    name: "a kept object moves out of its piece",
    files: { [FILES.observatoryScene]: [['placements: [{ slot: "cubby-a" }, { slot: "cubby-b", flip: true }],', 'placements: [{ slot: "cubby-a" }, { slot: "rodape-cupula" }],']] },
    mustFail: ["R03"],
  },
  {
    name: "a shut piece can be tapped through",
    files: { [FILES.model]: [["      const reachable = listed.filter((id) => isExposed(state.scene, state.interactions, id));", "      const reachable = listed;"]] },
    mustFail: ["R13"],
  },
  {
    name: "the round model ignores what the audit measured on the slot",
    files: { [LAYOUT_FILE]: [["      measured: measured ?? target.measured,", "      measured: target.measured,"]] },
    mustFail: ["R18"],
  },
  {
    name: "Difícil accepts an object on a plain-sight placement",
    files: { [LAYOUT_FILE]: [["      tier: placement.tier ?? target.tier,", "      tier: target.tier,"]] },
    mustFail: ["R21"],
  },
  {
    name: "one placement no room can hold",
    files: { [FILES.studioScene]: [['placements: [{ slot: "s3-caixa" }', 'placements: [{ slot: "s3-caixa" }, { slot: "s3-barco" }']] },
    mustFail: ["R24"],
  },
  {
    name: "every thing always takes its first slot",
    files: { [LAYOUT_FILE]: [["    const preference = order.map((t) => shuffle([...plan.domains[t]], random));", "    const preference = order.map((t) => [...plan.domains[t]]);"]] },
    mustFail: ["R07", "R25", "R29"],
  },
  {
    name: "the anti-repeat changes what a seed gives",
    files: {
      [FILES.model]: [
        ["      const { targets, layout } = selectRound(state.scene, state.difficulty, roundSeed);", "      const drawn = selectRound(state.scene, state.difficulty, roundSeed);\n      const { targets, layout } = drawn.layout.signature === lastLayoutOf(state.scene) ? selectRound(state.scene, state.difficulty, roundSeed + 1) : drawn;"],
        ['import { selectRound }', 'import { lastLayoutOf } from "@/games/hidden-objects/hidden-objects-scenes";\nimport { selectRound }'],
      ],
    },
    mustFail: ["R27"],
  },
  {
    name: "the anti-repeat rerolls until the room differs",
    files: { [FILES.rounds]: [["  while (previousSignature !== null && signature === previousSignature && draws < REPEAT_DRAWS) {", "  while (previousSignature !== null && signature === previousSignature) {"]] },
    mustFail: ["R28"],
  },
  {
    name: "a room-specific branch in the composer",
    files: { [LAYOUT_FILE]: [["  const random = mulberry(seed);\n  const picks", "  const random = mulberry(scene.id === \"explorer-studio\" ? seed ^ 1 : seed);\n  const picks"]] },
    mustFail: ["R36"],
  },
  {
    name: "Home imports a room's layout art",
    files: { [FILES.page]: [['"use client";', '"use client";\nimport "@/games/hidden-objects/scenes/explorer-studio.art";']] },
    mustFail: ["R31"],
  },
];

/** An in-memory copy of `worktree` with `mutant`'s edits; every anchor must appear exactly once. */
function mutate(worktree, mutant) {
  const overrides = {};
  for (const [file, edits] of Object.entries(mutant.files)) {
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
  const contract = results.filter((r) => r.tag === "replayability");
  const kept = results.filter((r) => r.tag !== "replayability");
  const held = contract.every((r) => !r.pass) && kept.every((r) => r.pass);
  ok &&= held;
  console.log(`${held ? "CAUGHT" : "MISSED"}  base ${BASE.slice(0, 8)} — GAME03-INTERACTIONS-04's final state: every thing where it was painted`);
  console.log(`        [replayability] failing: ${contract.filter((r) => !r.pass).length}/${contract.length}`);
  console.log(`        [preserved] holding: ${kept.filter((r) => r.pass).length}/${kept.length}`);
  for (const r of results.filter((x) => (x.tag === "replayability" && x.pass) || (x.tag !== "replayability" && !x.pass))) {
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
  console.log(ok ? "HIDDEN_OBJECTS_REPLAYABILITY_COUNTERFACTUALS_HOLD" : "HIDDEN_OBJECTS_REPLAYABILITY_COUNTERFACTUALS_BROKEN");
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
    ` (${results.filter((r) => r.tag === "replayability").length} replayability, ${results.filter((r) => r.tag === "preserved").length} preserved)` +
    `${failing.length ? ` · failing: ${failing.join(", ")}` : ""}`,
);
console.log(failing.length ? "HIDDEN_OBJECTS_REPLAYABILITY_FAILED" : "HIDDEN_OBJECTS_REPLAYABILITY_OK");
process.exit(failing.length ? EXIT_VALIDATION_FAILED : EXIT_OK);
