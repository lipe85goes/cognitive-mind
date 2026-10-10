/**
 * GAME03-MULTISCENE-03 — Game 03 as a game with rooms, checked from source.
 *
 * The Estúdio das Descobertas stopped being one room: every room is a
 * SceneDefinition (data under src/games/hidden-objects/scenes/), a registry
 * lists them (hidden-objects-scenes.ts), the setup lets the Explorador choose
 * one, and the same engine — camera, gestures, hit testing, session, hints,
 * feedback, result — plays any of them. The second room is the Observatório do
 * Explorador.
 *
 * Everything runs the REAL code from source through the shared harness
 * (hidden-objects-harness.mjs): the pure modules opened per room (nothing bound
 * here — every room is passed explicitly), the real HiddenObjectsGame with its
 * real scene view under the harness's small React (every gesture a Pointer
 * Event on the viewport), the registry's in-memory choice of room, the art on
 * disk and its measured audit, and the import graph read with TypeScript.
 *
 * [multiscene] checks are what this mission introduced: they FAIL on its base
 * (58b5f08 — EXPERIENCE-02's final state: one room, no registry). [preserved]
 * checks pin what must not move — the Estúdio exactly as EXPERIENCE-02 left it
 * (data, camera, controller, rounds, rules, results), the shared platform, the
 * difficulty contract, the dependencies — and hold on both.
 *
 * GAME03-CALIBRATION-02A changed the difficulty contract on purpose, for every
 * room at once (Difficulty V3: clue banks, measured round rules, art kits v2),
 * as M20 foresaw. The checks it superseded read each tree by its own
 * generation ("calibrated trees": isCalibrated in the harness): M02 reads a
 * clue bank and the object's measurements where the one clue was; M15's
 * independent brute force applies Difficulty V3's measured rule
 * (v3RoundKeeper) and does not ask Difícil for the glance finds its rule
 * excludes; M16 holds every variant of every clue bank to what the one clue
 * was held to; M20 holds the contract frozen at Difficulty V3. M06 keeps the
 * Estúdio exactly as EXPERIENCE-02 left it wherever the calibration did not
 * reach — the camera, the controller, the room's frame and layers' geometry,
 * every object and look-alike EXPERIENCE-02 had (where it is, what it is
 * called, how its hints read), the hit testing of those objects, the intro
 * hero byte for byte — and leaves the rounds, the sessions' lists and the
 * art kit to Difficulty V3's own contract (hidden-objects-calibration-tests.mjs).
 *
 * Usage:
 *   node tools/validation/hidden-objects-multiscene-tests.mjs                  # the working tree
 *   node tools/validation/hidden-objects-multiscene-tests.mjs --rev=<commit>   # every source at <commit>
 *   node tools/validation/hidden-objects-multiscene-tests.mjs --counterfactuals
 *        the working tree must pass every check; the base must fail every
 *        [multiscene] check and hold every [preserved] one; every in-memory
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
  cameraSweep,
  clip,
  codeOnly,
  controllerRecord,
  createEnvironment,
  createReact,
  drain,
  folderDiff,
  hudRects,
  intersects,
  lcg,
  listFiles,
  normalizeText,
  platformTables,
  pureModules,
  readBinary,
  regionGap,
  isCalibrated,
  same,
  sameControllerRecord,
  sorted,
  sourceFiles,
  staticGraph,
  v3RoundKeeper,
  webpSize,
} from "./hidden-objects-harness.mjs";

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
const COUNTERFACTUAL_MODE = args.includes("--counterfactuals");
if (args.some((arg) => arg !== revArg && arg !== "--counterfactuals") || REV === "" || (REV && COUNTERFACTUAL_MODE)) {
  console.error("usage: node tools/validation/hidden-objects-multiscene-tests.mjs [--rev=<commit> | --counterfactuals]");
  process.exit(EXIT_USAGE);
}

// --- what the mission fixed ---------------------------------------------------------------------

/** EXPERIENCE-02's final state: the Estúdio with its target pool, one room. */
const BASE = "58b5f08bebee4a3eeee1398075208dbeee9ee27e";
const GAME = "hidden-objects";
const GAME_TITLE = "Estúdio das Descobertas";
const STUDIO_ID = "explorer-studio";
const OBSERVATORY_ID = "explorer-observatory";
/** The rooms, in the selector's order. Not "at least": these two (a third room is out of scope). */
const SCENE_IDS = [STUDIO_ID, OBSERVATORY_ID];
const DIFFICULTIES = ["easy", "medium", "hard"];
/** The difficulty contract is frozen (CALIBRATION-02A may change it later, for every room at once). */
const FROZEN_V2 = {
  easy: { count: 5, tiers: { A: 3, B: 2, C: 0 }, listStyle: "picture", hintLadder: ["station", "area", "reveal"], hintRadius: 240, tolerancePx: { touch: 16, mouse: 8 } },
  medium: { count: 6, tiers: { A: 1, B: 3, C: 2 }, listStyle: "silhouette", hintLadder: ["station", "wide-area", "direction"], hintRadius: 400, tolerancePx: { touch: 12, mouse: 6 } },
  hard: { count: 8, tiers: { A: 1, B: 3, C: 4 }, listStyle: "clue", hintLadder: ["station", "context"], hintRadius: 0, tolerancePx: { touch: 10, mouse: 5 } },
};
/** GAME03-CALIBRATION-02A changed it, for every room at once: Difficulty V3 (a round's tiers are bounds). */
const FROZEN_V3 = {
  easy: { count: 5, tiers: { A: [0, 1], B: [0, 5], C: [1, 5] }, listStyle: "picture", hintLadder: ["station", "area", "reveal"], hintRadius: 240, tolerancePx: { touch: 16, mouse: 8 } },
  medium: { count: 6, tiers: { A: [0, 1], B: [0, 6], C: [2, 6] }, listStyle: "clue", hintLadder: ["station", "reclue", "direction"], hintRadius: 0, tolerancePx: { touch: 12, mouse: 6 } },
  hard: { count: 8, tiers: { A: [0, 0], B: [0, 4], C: [4, 8] }, listStyle: "clue", hintLadder: ["station", "context"], hintRadius: 0, tolerancePx: { touch: 10, mouse: 5 } },
};
/** The scene-definition contract: what every room declares. */
const SCENE_FIELDS = ["backdrop", "copy", "height", "id", "initialStation", "layers", "lookAlikes", "name", "pool", "preview", "stations", "thumbnail", "width"];
const COPY_FIELDS = ["completeTitle", "summary", "tagline", "viewportLabel"];
const TARGET_FIELDS = ["accessibleLabel", "clue", "hintContext", "hintDirection", "hintRegion", "id", "label", "region", "station", "tier"];
/** A calibrated tree: a clue bank and the object's measurements where the one clue was. */
const targetFieldsOf = (tree) => (isCalibrated(tree) ? [...TARGET_FIELDS.filter((f) => f !== "clue"), "clues", "measured"] : TARGET_FIELDS);
/** The fairness floors (Discovery §9; the same numbers the Estúdio is held to — never lowered for new art). */
const VISIBLE_FLOOR = { A: 0.8, B: 0.6, C: 0.4 };
const EDGE_FLOOR = 1.3;
const MIN_TARGET_GAP_SU = 24;
const LOOKALIKE_CLEARANCE_SU = 32;
const FRONT_CLEARANCE_SU = 24;
const MIN_EFFECTIVE_TOUCH_PX = 44;
const MIN_VISIBLE_AT_COVER_PX = 32;
const LOOKALIKE_LIMIT = { A: 1, B: 2, C: 3 };
/** A tap on a look-alike's centre, with every difficulty's touch reach, at this scale (px/su), finds nothing (the Estúdio's E16). */
const LOOKALIKE_TAP_SCALE = 0.375;
const CLUE_MAX_CHARS = 48;
/** A direct variant of a clue bank is only said by a hint banner (Médio's reclue): one more short clause. */
const DIRECT_CLUE_MAX_CHARS = 56;
/** Every clue an object can be told by, with the length it must fit: its bank's variants, or its one clue. */
const cluesOf = (t) => (Array.isArray(t.clues) ? t.clues.map((c) => ({ text: c.text, max: c.level === "direct" ? DIRECT_CLUE_MAX_CHARS : CLUE_MAX_CHARS })) : [{ text: t.clue, max: CLUE_MAX_CHARS }]);
const COLOUR_WORDS = /\b(azul|vermelh[oa]|verde|amarel[oa]|rox[oa]|rosa|laranja|pret[oa]|branc[oa]|cinza|marrom|dourad[oa]|pratead[oa])\b/i;
/** A room's art (layers, thumbnails, preview) stays light: the skeleton's entry budget, per room. */
const ROOM_ENTRY_BUDGET_BYTES = 1_300_000;
/** The engine's files: nothing in them may name a room, a station or a target. */
const ENGINE_FILES = [
  `${DIR}hidden-objects-camera.ts`,
  `${DIR}hidden-objects-gesture.ts`,
  `${DIR}hidden-objects-controller.ts`,
  `${DIR}hidden-objects-model.ts`,
  `${DIR}hidden-objects-rounds.ts`,
  `${DIR}HiddenObjectsScene.tsx`,
  `${DIR}HiddenObjectsGame.tsx`,
  `${DIR}hidden-objects.css`,
];
const EPS = 1e-6;

// --- small helpers -------------------------------------------------------------------------------

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const words = (text) => normalizeText(text).split(/[^a-z]+/).filter((word) => word.length >= 4);
const isMultiscene = (tree) => tree.exists(FILES.scenes);
const plain = (value) => JSON.parse(JSON.stringify(value));

/** The rooms of a tree, from its registry (a tree without one has none: it throws). */
function rooms(tree) {
  return cached(tree, "rooms", () => {
    if (!isMultiscene(tree)) throw new Error(`${FILES.scenes} does not exist: one room, no registry`);
    const graph = createModuleGraph({ tree, mocks: {}, globals: {} });
    const registry = graph.require(FILES.scenes);
    return {
      graph,
      registry,
      scenes: registry.SCENES,
      byId: Object.fromEntries(registry.SCENES.map((scene) => [scene.id, scene])),
      contract: graph.require(FILES.scene),
      camera: graph.require(FILES.camera),
      model: graph.require(FILES.model),
      rounds: graph.require(FILES.rounds),
    };
  });
}
const room = (tree, id) => {
  const scene = rooms(tree).byId[id];
  if (!scene) throw new Error(`no room ${id} in the registry`);
  return scene;
};

/**
 * The real game, mounted the way GameScreen mounts it, in a module graph the
 * caller can keep: `remount()` is a new mount in the same graph — what "Praticar
 * outra vez" and the shell's retry are (the registry's in-memory choice
 * survives), while `openGame` again is a new visit.
 */
function openGame(tree, { viewport = DESKTOP, reducedMotion = false, seeds = [], remember = null } = {}) {
  const env = createEnvironment({ viewport, reducedMotion, seeds });
  const harness = createReact(env.createNode);
  const graph = createModuleGraph({ tree, mocks: browserMocks(harness), globals: env.globals });
  const registry = isMultiscene(tree) ? graph.require(FILES.scenes) : null;
  if (remember) registry.rememberScene(registry.sceneById(remember));
  const { HiddenObjectsGame } = graph.require(FILES.game);
  const model = graph.require(FILES.model);
  const cam = graph.require(FILES.camera);
  const rounds = graph.require(FILES.rounds);
  const calls = { complete: [], exit: 0, ready: 0, errors: [] };
  const props = {
    onComplete: (result) => calls.complete.push(plain(result)),
    onExit: () => {
      calls.exit += 1;
    },
    onEntryReady: () => {
      calls.ready += 1;
    },
    onEntryError: (error) => {
      calls.errors.push(String(error?.message ?? error));
    },
  };
  const mount = () => harness.mount(harness.jsxRuntime.jsx(HiddenObjectsGame, props));
  mount();
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
    rounds,
    calls,
    cls,
    host,
    remount() {
      harness.unmount();
      mount();
    },
    shell: () => host(cls("hos-shell"))?.props ?? {},
    status: () => game.shell()["data-status"] ?? null,
    sceneId: () => game.shell()["data-scene"] ?? null,
    scene: () => registry.sceneById(game.sceneId()),
    seed: () => (game.shell()["data-round-seed"] === undefined ? null : Number(game.shell()["data-round-seed"])),
    listed: () => harness.hosts(cls("hos-item")).map((entry) => entry.props["data-target"]),
    found: () => harness.hosts(cls("hos-item")).filter((entry) => entry.props["data-found"] === "true").map((entry) => entry.props["data-target"]),
    sceneView: () => harness.components("HiddenObjectsScene")[0]?.props ?? null,
    get controller() {
      return game.sceneView()?.controllerRef.current ?? null;
    },
    get viewport() {
      return env.node("hos-viewport");
    },
    /** Full-resolution layers on the page (src), and every other picture (thumbnails, previews). */
    layerSrcs: () => harness.hosts((entry) => entry.type === IMAGE && cls("hos-layer")(entry)).map((entry) => entry.props.src),
    imageSrcs: () => harness.hosts((entry) => entry.type === IMAGE).map((entry) => entry.props.src),
    stations: () => harness.hosts(cls("hos-station")).map((entry) => entry.text),
    sceneOptions: () => harness.hosts((entry) => entry.type === "input" && entry.props.name === "hos-scene").map((entry) => ({ id: entry.props.value, checked: entry.props.checked === true })),
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
    exploreButton: () => game.button((entry) => cls("hos-primary")(entry) && /Explorar|Preparando/.test(entry.text)),
    explore() {
      game.click((entry) => cls("hos-primary")(entry) && entry.text === "Explorar");
      game.settle();
    },
    /** Load + decode every layer on the page (the room on screen), then let the readiness frames pass. */
    async decode() {
      for (const entry of harness.hosts((e) => e.type === IMAGE && cls("hos-layer")(e))) entry.props.onLoad?.({ currentTarget: entry.node, target: entry.node });
      await drain();
      harness.flush();
      flushFrames(4);
    },
    failLayer(id) {
      const entry = host((e) => e.type === IMAGE && cls(`hos-layer-${id}`)(e));
      entry.props.onError?.({});
      harness.flush();
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
      const init = { pointerId: id, clientX: c.x, clientY: c.y, pointerType, button: 0 };
      game.pointer("pointerdown", init);
      game.pointer("pointerup", init);
    },
    goTo(stationId) {
      const label = game.scene().stations.find((s) => s.id === stationId).label;
      game.click((entry) => cls("hos-station")(entry) && entry.text === label);
      game.settle();
    },
    find(id) {
      const target = model.targetById(game.scene(), id);
      game.goTo(target.station);
      game.tapScene(model.regionCenter(target.region));
      game.settle();
    },
    drag(from, to, steps = 8) {
      game.pointer("pointerdown", { pointerId: 3, clientX: from.x, clientY: from.y, pointerType: "mouse", button: 0 });
      for (let i = 1; i <= steps; i += 1) {
        game.pointer("pointermove", { pointerId: 3, clientX: from.x + ((to.x - from.x) * i) / steps, clientY: from.y + ((to.y - from.y) * i) / steps, pointerType: "mouse" });
        flushFrames(1);
      }
      game.pointer("pointerup", { pointerId: 3, clientX: to.x, clientY: to.y, pointerType: "mouse", button: 0 });
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
    /** Find everything listed, wait for the closing card, press "Concluir exploração". */
    finish() {
      for (const id of game.listed()) if (!game.found().includes(id)) game.find(id);
      flushFrames(60);
      game.click((entry) => entry.text === "Concluir exploração");
      return calls.complete.at(-1) ?? null;
    },
    unmount: () => harness.unmount(),
  };
  return game;
}

/** A fresh round in `sceneId` on `difficulty`, drawn with `seed` (the game's first "Explorar" after the setup). */
async function startIn(tree, sceneId, difficulty, seed, options = {}) {
  const game = openGame(tree, { ...options, seeds: [seed, ...(options.seeds ?? [])] });
  if (sceneId !== game.sceneId()) game.chooseScene(sceneId);
  await game.decode();
  game.chooseDifficulty(difficulty);
  game.explore();
  return game;
}

/** Every valid round the rules allow, found the slow way (written apart from the product's enumeration). */
function bruteForceRounds(pool, preset, stations, keep = null) {
  const k = preset.count;
  const eligible = pool.filter((t) => !t.listedAs || t.listedAs.includes(preset.listStyle));
  const fewest = Math.floor(k / stations.length);
  const most = Math.ceil(k / stations.length);
  const found = [];
  const pick = (start, chosen) => {
    if (chosen.length === k) {
      const held = stations.map((s) => chosen.filter((t) => t.station === s.id).length);
      if (!held.every((n) => n >= fewest && n <= most)) return;
      const tiers = { A: 0, B: 0, C: 0 };
      for (const t of chosen) tiers[t.tier] += 1;
      // a calibrated tree: Difficulty V3's measured rule (v3RoundKeeper); before it, the difficulty's one tier mix
      if (keep ? keep(chosen.map((t) => t.id)) : same(tiers, preset.tiers)) found.push(chosen.map((t) => t.id).sort().join());
      return;
    }
    for (let i = start; i <= eligible.length - (k - chosen.length); i += 1) pick(i + 1, [...chosen, eligible[i]]);
  };
  pick(0, []);
  return found;
}

/**
 * M06 on a calibrated tree (GAME03-CALIBRATION-02A): the Estúdio exactly as
 * EXPERIENCE-02 left it wherever the calibration did not reach. The room's
 * frame, the layers' geometry, every object and look-alike EXPERIENCE-02 had
 * (where it is, what it is called, its tier, station and hint lines — only its
 * one clue became a clue bank, and it gained its measurements), the camera,
 * the controller, the hit testing of those objects and the intro hero (byte
 * for byte). The rounds, the sessions' lists, the difficulty contract and the
 * art kit are Difficulty V3's: hidden-objects-calibration-tests.mjs holds them.
 */
function studioBeyondTheCalibration(tree, mine, base) {
  const dataKeys = ["SCENE_ID", "SCENE_WIDTH", "SCENE_HEIGHT", "SAFE_MARGIN_X", "SAFE_MARGIN_Y", "SCENE_STATIONS", "LOOKALIKE_CLEARANCE_SU", "DIFFICULTY_ORDER"];
  const dataDiffers = dataKeys.filter((key) => !same(mine.scene[key], base.scene[key]));
  const geometry = (layers) => layers.map((l) => ({ id: l.id, rect: l.rect, parallax: l.parallax, opaque: l.opaque }));
  if (!same(geometry(mine.scene.SCENE_LAYERS), geometry(base.scene.SCENE_LAYERS))) dataDiffers.push("SCENE_LAYERS geometry");
  // the one clue became a clue bank and the object gained its measurements; a listedAs that only kept an object
  // out of the silhouette list (a style Difficulty V3 dropped) says nothing any more
  const asBefore = (target) => {
    const rest = Object.fromEntries(Object.entries(target).filter(([key]) => !["clue", "clues", "measured", "listedAs"].includes(key)));
    const styles = target.listedAs?.filter((style) => style !== "silhouette");
    return styles && !(styles.includes("picture") && styles.includes("clue")) ? { ...rest, listedAs: styles } : rest;
  };
  const objectsMoved = base.scene.HIDDEN_OBJECTS.filter((t) => {
    const now = mine.scene.HIDDEN_OBJECTS.find((candidate) => candidate.id === t.id);
    return !now || !same(asBefore(now), asBefore(t));
  }).map((t) => t.id);
  const lookAlikesMoved = base.scene.SCENE_LOOKALIKES.filter((l) => !same(mine.scene.SCENE_LOOKALIKES.find((candidate) => candidate.id === l.id), l)).map((l) => l.id);
  const thumbsDiffer = base.scene.HIDDEN_OBJECTS.filter((t) => mine.scene.thumbnailSrc(t.id) !== base.scene.thumbnailSrc(t.id).replace("/v1/", "/v2/")).map((t) => t.id);
  const cameraSame = JSON.stringify(cameraSweep(mine.camera)) === cached(BASE_TREE, "ms-sweep", () => JSON.stringify(cameraSweep(base.camera)));
  const controllerSame = [false, true].every((reducedMotion) =>
    sameControllerRecord(controllerRecord(tree, { reducedMotion }), cached(BASE_TREE, `ms-controller:${reducedMotion}`, () => controllerRecord(BASE_TREE, { reducedMotion }))),
  );
  // hit testing on a grid, at three scales: EXPERIENCE-02's objects listed, the same answers
  const theirIds = base.scene.HIDDEN_OBJECTS.map((t) => t.id);
  let hitsDiffer = 0;
  for (let x = 0; x <= 3200; x += 40) {
    for (let y = 0; y <= 1600; y += 40) {
      for (const [scale, tol] of [[0.375, 16], [0.8, 10], [1.25, 5]]) {
        if (mine.model.hitTest({ x, y }, theirIds, scale, tol) !== base.model.hitTest({ x, y }, theirIds, scale, tol)) hitsDiffer += 1;
      }
    }
  }
  const hero = "public/assets/hidden-objects/explorer-studio/v1/hero.webp";
  const heroKept = tree.exists(hero) && sha256(readBinary(tree, hero)) === sha256(readBinary(BASE_TREE, hero));
  return {
    pass: dataDiffers.length === 0 && objectsMoved.length === 0 && lookAlikesMoved.length === 0 && thumbsDiffer.length === 0 && cameraSame && controllerSame && hitsDiffer === 0 && heroKept,
    calibrated: "rounds, sessions' lists, difficulty and art kit are Difficulty V3's (hidden-objects-calibration-tests.mjs)",
    dataDiffers,
    objectsMoved,
    lookAlikesMoved,
    thumbsDiffer,
    cameraSame,
    controllerSame,
    hitsDiffer,
    heroKept,
  };
}

/** An old Game 03 result exactly as EXPERIENCE-02 saved it, and an old Trilha result. */
const OLD_STUDIO_RESULT = {
  id: "hidden-objects-1760000000000",
  activityId: GAME,
  activityTitle: GAME_TITLE,
  gameId: GAME,
  score: 6,
  playedAt: "2026-10-08T18:00:00.000Z",
  summary: "Você encontrou todos os objetos do Estúdio.",
  details: { difficulty: "medium", foundObjects: 6, totalObjects: 6, completed: true, sceneId: STUDIO_ID, roundSeed: 202 },
};
const LEGACY_TRILHA_RESULT = {
  id: "number-trail-1759600000000",
  activityId: "number-trail",
  activityTitle: "Trilha Lógica",
  gameId: "number-trail",
  score: 340,
  playedAt: "2026-10-04T18:00:00.000Z",
  summary: "Você iluminou 2 trilhas completas na Trilha Lógica.",
  details: { level: 3, currentNumber: 12, errors: 0, roundsCompleted: 2, correctNumbers: 12, maxErrors: 3 },
};

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

  await check("M01", "multiscene", "THE_REGISTRY_HOLDS_THE_STUDIO_AND_THE_OBSERVATORY", () => {
    const { registry, scenes } = rooms(tree);
    const ids = scenes.map((scene) => scene.id);
    const facts = {
      exactlyTheTwoRooms: same(ids, SCENE_IDS),
      uniqueIds: new Set(ids).size === ids.length,
      studioFirstAndDefault: registry.DEFAULT_SCENE === scenes[0] && scenes[0].id === STUDIO_ID,
      lookupById: SCENE_IDS.every((id) => registry.sceneById(id)?.id === id) && registry.sceneById("explorer-attic") === undefined,
      eachRoomItsOwnModule: tree.exists(FILES.studioScene) && tree.exists(FILES.observatoryScene),
      noUnlockOrProgress: !/unlock|locked|requires|stars|progress|campaign/i.test(codeOnly(tree.read(FILES.scenes))),
    };
    return { pass: Object.values(facts).every(Boolean), ...facts, ids, names: scenes.map((scene) => scene.name) };
  });

  await check("M02", "multiscene", "EVERY_ROOM_SATISFIES_THE_SCENE_CONTRACT", () => {
    const { scenes, model, contract } = rooms(tree);
    const problems = [];
    for (const scene of scenes) {
      const p = (message) => problems.push(`${scene.id}: ${message}`);
      const missing = SCENE_FIELDS.filter((field) => !(field in scene));
      if (missing.length) p(`missing ${missing.join(",")}`);
      if (!same(sorted(Object.keys(scene.copy ?? {})), COPY_FIELDS) || Object.values(scene.copy ?? {}).some((v) => typeof v !== "string" || !v.trim())) p("copy incomplete");
      if (!(scene.width > 0 && scene.height > 0)) p("no size");
      // stations: left to right, contiguous, covering the whole width; the opening one exists
      const spans = scene.stations.map((s) => s.span);
      if (scene.stations.length < 3) p("fewer than three stations");
      if (spans[0]?.x0 !== 0 || spans.at(-1)?.x1 !== scene.width || spans.some((s, i) => i > 0 && s.x0 !== spans[i - 1].x1)) p("station spans do not tile the room");
      if (!scene.stations.some((s) => s.id === scene.initialStation)) p("initial station unknown");
      for (const s of scene.stations) if (!s.label || !s.hintPhrase || !(s.center.x >= s.span.x0 && s.center.x < s.span.x1)) p(`station ${s.id} malformed`);
      // the pool
      const pool = scene.pool;
      if (new Set(pool.map((t) => t.id)).size !== pool.length || new Set(pool.map((t) => t.label)).size !== pool.length) p("duplicate target ids or labels");
      for (const t of pool) {
        const fields = targetFieldsOf(tree).filter((f) => !(f in t) || (typeof t[f] === "string" && !t[f].trim()) || (Array.isArray(t[f]) && t[f].length === 0));
        if (fields.length) p(`${t.id} lacks ${fields.join(",")}`);
        if (!scene.stations.some((s) => s.id === t.station)) p(`${t.id} in an unknown station`);
        if (!["A", "B", "C"].includes(t.tier)) p(`${t.id} tier ${t.tier}`);
      }
      const largest = Math.max(...DIFFICULTIES.map((d) => contract.DIFFICULTY_PRESETS[d].count));
      if (pool.length < 2 * largest) p(`pool of ${pool.length} is not materially larger than a round`);
      // layers: back to front, the plate whole, every file present at its declared size, the art in the room's own folder
      const plate = scene.layers.find((l) => l.id === "plate");
      if (!plate || plate.rect.x !== 0 || plate.rect.y !== 0 || plate.rect.w !== scene.width || plate.rect.h !== scene.height || plate.parallax !== 1) p("no whole plate");
      if (new Set(scene.layers.map((l) => l.id)).size !== scene.layers.length) p("duplicate layer ids");
      const folder = plate?.src.replace(/\/[^/]+$/, "") ?? "";
      for (const layer of scene.layers) {
        const file = `public${layer.src}`;
        const size = tree.exists(file) ? webpSize(readBinary(tree, file)) : null;
        if (!size || size.width !== layer.rect.w || size.height !== layer.rect.h) p(`layer ${layer.id} missing or not ${layer.rect.w}×${layer.rect.h}`);
        if (!layer.src.startsWith(`${folder}/`)) p(`layer ${layer.id} outside the room's folder`);
      }
      for (const t of pool) if (!tree.exists(`public${scene.thumbnail(t.id)}`)) p(`no thumbnail for ${t.id}`);
      if (!tree.exists(`public${scene.preview}`)) p("no preview");
      // look-alikes name what they resemble
      for (const l of scene.lookAlikes) if (!pool.some((t) => t.id === l.resembles) || !l.label || !l.tellApart || !l.region) p(`look-alike ${l.id} malformed`);
      // regions are real shapes
      for (const r of [...pool, ...scene.lookAlikes]) {
        const b = model.regionBounds(r.region);
        if (!(b.w > 0 && b.h > 0)) p(`${r.id} empty region`);
      }
    }
    return { pass: problems.length === 0, problems: problems.slice(0, 10), problemCount: problems.length, rooms: scenes.map((s) => `${s.id} ${s.width}×${s.height} · ${s.stations.length} stations · ${s.pool.length} objects · ${s.lookAlikes.length} look-alikes · ${s.layers.length} layers`) };
  });

  await check("M03", "multiscene", "ONE_ENGINE_PLAYS_EVERY_ROOM", async () => {
    const { scenes } = rooms(tree);
    // nothing in the engine names a room, a station, a target or a room's art
    const names = new Set();
    for (const scene of scenes) {
      names.add(scene.id);
      for (const s of scene.stations) names.add(s.id);
      for (const t of scene.pool) names.add(t.id);
      names.add(scene.layers.find((l) => l.id === "plate").src.replace(/\/[^/]+$/, ""));
    }
    const named = [];
    for (const file of ENGINE_FILES) {
      const code = codeOnly(tree.read(file));
      for (const name of names) if (new RegExp(`["'\`/]${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\`/]`).test(code)) named.push(`${file.replace(DIR, "")}: ${name}`);
    }
    // no per-room copy of the game: one component, one scene view, one model, one controller
    const gameFiles = listFiles(tree, DIR).filter((file) => /\.(ts|tsx)$/.test(file));
    const perRoomForks = gameFiles.filter((file) => /(Studio|Observatory|Estudio|Observatorio)\w*\.(tsx|ts)$/i.test(file) && !file.startsWith(`${DIR}scenes/`));
    const roomModules = gameFiles.filter((file) => file.startsWith(`${DIR}scenes/`));
    const roomModulesRunNothing = roomModules.every((file) => !/\bfunction\b|=>\s*\{|\bclass\b/.test(codeOnly(tree.read(file)).replace(/thumbnailSrc = \(id: TargetId\) =>/, "")));
    // the same component plays both rooms to the end, through the same gestures
    const played = {};
    for (const id of SCENE_IDS) {
      const game = await startIn(tree, id, "medium", 4242);
      const result = game.finish();
      played[id] = { components: game.harness.components("HiddenObjectsScene").length, result: result?.details ?? null, summary: result?.summary ?? null };
      game.unmount();
    }
    const bothPlayed = SCENE_IDS.every((id) => played[id].result?.completed === true && played[id].result.sceneId === id && played[id].components === 1);
    return {
      pass: named.length === 0 && perRoomForks.length === 0 && roomModulesRunNothing && bothPlayed,
      engineNamesARoom: named.slice(0, 8),
      perRoomForks,
      roomModules,
      roomModulesRunNothing,
      played,
    };
  });

  await check("M04", "multiscene", "SAME_ROOM_DIFFICULTY_AND_SEED_SAME_ROUND", () => {
    const { byId, rounds } = rooms(tree);
    const random = lcg(0x5ce4e);
    const seeds = Array.from({ length: 300 }, () => Math.floor(random() * 2 ** 32));
    // a module graph of its own: no state shared with the first
    const freshGraph = createModuleGraph({ tree, mocks: {}, globals: {} });
    const fresh = { rounds: freshGraph.require(FILES.rounds), byId: Object.fromEntries(freshGraph.require(FILES.scenes).SCENES.map((s) => [s.id, s])) };
    const unstable = [];
    const crossed = [];
    let differentAcrossRooms = 0;
    for (const d of DIFFICULTIES) {
      for (const seed of seeds) {
        const lists = {};
        for (const id of SCENE_IDS) {
          const a = rounds.selectRoundTargets(byId[id], d, seed);
          const b = rounds.selectRoundTargets(byId[id], d, seed);
          const c = fresh.rounds.selectRoundTargets(fresh.byId[id], d, seed);
          if (!same(a, b) || !same(a, c)) unstable.push(`${id}/${d}/${seed}`);
          // a seed resolves through its own room: every id it lists is that room's
          const own = new Set(byId[id].pool.map((t) => t.id));
          if (!a.every((t) => own.has(t))) crossed.push(`${id}/${d}/${seed}`);
          lists[id] = a;
        }
        if (!same(sorted(lists[STUDIO_ID]), sorted(lists[OBSERVATORY_ID]))) differentAcrossRooms += 1;
      }
    }
    return {
      pass: unstable.length === 0 && crossed.length === 0 && differentAcrossRooms === DIFFICULTIES.length * seeds.length,
      draws: DIFFICULTIES.length * seeds.length * SCENE_IDS.length,
      unstable: unstable.slice(0, 4),
      crossed: crossed.slice(0, 4),
      sameSeedDifferentRooms: `${differentAcrossRooms}/${DIFFICULTIES.length * seeds.length} draw different lists`,
      example: { seed: seeds[0], studio: rounds.selectRoundTargets(byId[STUDIO_ID], "hard", seeds[0]), observatory: rounds.selectRoundTargets(byId[OBSERVATORY_ID], "hard", seeds[0]) },
    };
  });

  await check("M05", "multiscene", "EACH_ROOM_DRAWS_FROM_ITS_OWN_POOL", async () => {
    const { byId, rounds } = rooms(tree);
    const studio = byId[STUDIO_ID];
    const observatory = byId[OBSERVATORY_ID];
    const shared = studio.pool.filter((t) => observatory.pool.some((o) => o.id === t.id || o.label === t.label)).map((t) => t.id);
    const leaks = [];
    for (const d of DIFFICULTIES) {
      for (const [id, scene] of Object.entries(byId)) {
        const own = new Set(scene.pool.map((t) => t.id));
        const reached = new Set(rounds.validRounds(scene, d).flat());
        if ([...reached].some((t) => !own.has(t))) leaks.push(`${id}/${d}`);
      }
    }
    // the real game, in the Observatório: the list on screen is its own
    const game = await startIn(tree, OBSERVATORY_ID, "hard", 777);
    const listed = game.listed();
    const own = listed.every((id) => observatory.pool.some((t) => t.id === id));
    const asDrawn = same(listed, rounds.selectRoundTargets(observatory, "hard", 777));
    game.unmount();
    return { pass: shared.length === 0 && leaks.length === 0 && own && asDrawn, sharedObjects: shared, leaks, observatoryListOnScreen: listed, listIsTheObservatorysDraw: asDrawn };
  });

  await check("M06", "preserved", "THE_STUDIO_PLAYS_EXACTLY_AS_EXPERIENCE_02", () => {
    // the Estúdio, read the way the earlier suites read it (bound to the Estúdio on a multiscene tree), against 58b5f08
    const mine = pureModules(tree);
    const base = pureModules(BASE_TREE);
    if (isCalibrated(tree)) return studioBeyondTheCalibration(tree, mine, base);
    const dataKeys = ["SCENE_ID", "SCENE_WIDTH", "SCENE_HEIGHT", "SAFE_MARGIN_X", "SAFE_MARGIN_Y", "SCENE_STATIONS", "HIDDEN_OBJECTS", "SCENE_LOOKALIKES", "LOOKALIKE_CLEARANCE_SU", "DIFFICULTY_PRESETS", "DIFFICULTY_ORDER", "SCENE_ASSET_BASE", "SCENE_LAYERS"];
    const dataDiffers = dataKeys.filter((key) => !same(mine.scene[key], base.scene[key]));
    const thumbsDiffer = mine.scene.HIDDEN_OBJECTS.filter((t) => mine.scene.thumbnailSrc(t.id) !== base.scene.thumbnailSrc(t.id)).map((t) => t.id);
    const cameraSame = JSON.stringify(cameraSweep(mine.camera)) === cached(BASE_TREE, "ms-sweep", () => JSON.stringify(cameraSweep(base.camera)));
    const controllerSame = [false, true].every((reducedMotion) =>
      sameControllerRecord(controllerRecord(tree, { reducedMotion }), cached(BASE_TREE, `ms-controller:${reducedMotion}`, () => controllerRecord(BASE_TREE, { reducedMotion }))),
    );
    // rounds: every valid round, and the draw of a fixed sweep of seeds
    const random = lcg(0xe02);
    const seeds = Array.from({ length: 1500 }, () => Math.floor(random() * 2 ** 32));
    const roundsDiffer = DIFFICULTIES.filter(
      (d) => !same(mine.rounds.validRounds(d), base.rounds.validRounds(d)) || seeds.some((seed) => !same(mine.rounds.selectRoundTargets(d, seed), base.rounds.selectRoundTargets(d, seed))),
    );
    // the rules: a whole session per difficulty (free taps, the full ladder for every object, finds, a restart), compared step by step
    const sessionTrace = (m, d, seed) => {
      const R = m.model.sessionReducer;
      let s = R(R(m.model.createSession(), { type: "select-difficulty", difficulty: d }), { type: "start", seed });
      const trace = [];
      const note = () => {
        const { scene, ...rest } = s;
        trace.push({ ...rest, sceneId: scene?.id ?? null, label: m.model.hintButtonLabel(s), say: m.model.announcementFor(s), progress: m.model.progressLabel(s), list: s.targets.map((id) => m.model.listEntryFor(s, id)) });
      };
      s = R(s, { type: "tap", point: { x: 20, y: 30 }, scale: 0.4, pointerType: "touch" });
      note();
      for (const id of [...s.targets]) {
        s = R(s, { type: "focus-target", targetId: id });
        for (let k = 0; k < 4; k += 1) {
          s = R(s, { type: "hint" });
          note();
          trace.push({ halo: m.model.hintHalo(id, d, s.hintStage), move: m.model.hintCameraMove(id, d, s.hintStage), msg: m.model.hintMessage(id, d, s.hintStage) });
        }
        const t = m.model.targetById(id);
        s = R(s, { type: "tap", point: m.model.regionCenter(t.region), scale: 0.5, pointerType: "mouse" });
        note();
      }
      trace.push(m.model.buildHiddenObjectsResult(s));
      s = R(s, { type: "restart" });
      note();
      return JSON.stringify(trace).replace(/"sceneId":(null|"explorer-studio"),/g, "");
    };
    const sessionsDiffer = DIFFICULTIES.flatMap((d) => [11, 202, 3003].filter((seed) => sessionTrace(mine, d, seed) !== sessionTrace(base, d, seed)).map((seed) => `${d}/${seed}`));
    // hit testing on a grid, at three scales and both pointer kinds
    const everyId = mine.scene.HIDDEN_OBJECTS.map((t) => t.id);
    let hitsDiffer = 0;
    for (let x = 0; x <= 3200; x += 40) {
      for (let y = 0; y <= 1600; y += 40) {
        for (const [scale, tol] of [[0.375, 16], [0.8, 10], [1.25, 5]]) {
          if (mine.model.hitTest({ x, y }, everyId, scale, tol) !== base.model.hitTest({ x, y }, everyId, scale, tol)) hitsDiffer += 1;
        }
      }
    }
    // the Estúdio's art kit, byte for byte
    const kit = "public/assets/hidden-objects/explorer-studio";
    const artChanged = folderDiff(tree, BASE_TREE, kit);
    return {
      pass: dataDiffers.length === 0 && thumbsDiffer.length === 0 && cameraSame && controllerSame && roundsDiffer.length === 0 && sessionsDiffer.length === 0 && hitsDiffer === 0 && artChanged.length === 0,
      dataDiffers,
      thumbsDiffer,
      cameraSame,
      controllerSame,
      roundsDiffer,
      seedsCompared: seeds.length * DIFFICULTIES.length,
      sessionsDiffer,
      hitsDiffer,
      artChanged,
    };
  });

  await check("M07", "multiscene", "CHOOSING_A_ROOM_RECORDS_NOTHING", async () => {
    const stored = JSON.stringify([LEGACY_TRILHA_RESULT]);
    const game = openGame(tree, { seeds: [91, 92] });
    game.env.store.set(STORAGE_KEY, stored);
    await game.decode();
    // back and forth in the setup, then a round left through "Trocar de cena", then the other room
    for (const id of [OBSERVATORY_ID, STUDIO_ID, OBSERVATORY_ID]) {
      game.chooseScene(id);
      await game.decode();
    }
    game.explore();
    game.find(game.listed()[0]);
    game.click((entry) => entry.props["aria-label"] === "Trocar de cena");
    game.chooseScene(STUDIO_ID);
    await game.decode();
    const facts = {
      noResult: game.calls.complete.length === 0,
      noExit: game.calls.exit === 0,
      storageUntouched: game.env.store.get(STORAGE_KEY) === stored && game.env.store.size === 1,
      backInSetup: game.status() === "setup" && game.seed() === null && game.listed().length === 0,
    };
    game.unmount();
    return { pass: Object.values(facts).every(Boolean), ...facts, results: game.calls.complete.length };
  });

  await check("M08", "multiscene", "CHOOSING_A_ROOM_SETS_UP_THAT_ROOM", async () => {
    const { byId, rounds } = rooms(tree);
    const game = openGame(tree, { seeds: [5150] });
    await game.decode();
    const before = { scene: game.sceneId(), options: game.sceneOptions() };
    game.chooseScene(OBSERVATORY_ID);
    const obs = byId[OBSERVATORY_ID];
    const after = {
      shell: game.sceneId(),
      view: game.sceneView()?.scene.id ?? null,
      checked: game.sceneOptions().find((o) => o.checked)?.id ?? null,
      layers: game.layerSrcs(),
      stations: game.stations(),
      viewportLabel: game.harness.hosts(game.cls("hos-viewport"))[0]?.props["aria-label"] ?? null,
    };
    await game.decode();
    game.chooseDifficulty("easy");
    game.explore();
    const listed = game.listed();
    const facts = {
      opensOnTheStudio: before.scene === STUDIO_ID && same(before.options, SCENE_IDS.map((id) => ({ id, checked: id === STUDIO_ID }))),
      shellViewAndRadioAgree: after.shell === OBSERVATORY_ID && after.view === OBSERVATORY_ID && after.checked === OBSERVATORY_ID,
      itsLayers: same(after.layers, obs.layers.map((l) => l.src)),
      itsStations: same(after.stations, obs.stations.map((s) => s.label)),
      itsName: after.viewportLabel === obs.copy.viewportLabel,
      itsRound: same(listed, rounds.selectRoundTargets(obs, "easy", 5150)) && game.seed() === 5150,
      itsTitle: /Observatório do Explorador · Fácil/.test(game.harness.hosts(game.cls("hos-title"))[0]?.text ?? ""),
    };
    game.unmount();
    return { pass: Object.values(facts).every(Boolean), ...facts, listed };
  });

  await check("M09", "multiscene", "THE_ROUND_HOLDS_THROUGH_EVERYTHING_IN_EVERY_ROOM", async () => {
    const problems = [];
    for (const id of SCENE_IDS) {
      const game = await startIn(tree, id, "hard", 60606);
      const round = { seed: game.seed(), listed: game.listed(), scene: game.sceneId() };
      const draws = () => game.env.random.calls;
      const drawsAfterStart = draws();
      const same3 = (label) => {
        if (game.seed() !== round.seed || !same(game.listed(), round.listed) || game.sceneId() !== round.scene) problems.push(`${id}: ${label} changed the round`);
      };
      game.harness.flush();
      same3("a render");
      game.drag(game.centre(), { x: game.centre().x - 260, y: game.centre().y + 40 });
      game.settle();
      same3("a pan");
      game.click((entry) => entry.props["aria-label"] === "Aproximar");
      game.settle();
      same3("a zoom");
      game.pointer("wheel", { deltaY: -300, deltaMode: 0, clientX: game.centre().x, clientY: game.centre().y });
      game.frames(14);
      same3("the wheel");
      for (let k = 0; k < 3; k += 1) game.click(game.cls("hos-hint-button"));
      game.settle();
      same3("hints");
      game.resize({ width: 596, height: 337 });
      game.resize({ width: DESKTOP.width, height: DESKTOP.height });
      same3("a resize / rotation");
      game.env.setReducedMotion(true);
      game.goTo(game.scene().stations[0].id);
      game.env.setReducedMotion(false);
      same3("reduced motion on and off");
      game.click(game.cls("hos-tray-toggle"));
      game.click(game.cls("hos-tray-toggle"));
      same3("folding the list");
      game.find(round.listed[0]);
      same3("a find");
      if (draws() !== drawsAfterStart) problems.push(`${id}: ${draws() - drawsAfterStart} more draw(s) after "Explorar"`);
      game.unmount();
    }
    return { pass: problems.length === 0, problems };
  });

  await check("M10", "multiscene", "RECOMECAR_KEEPS_THE_ROOM_AND_THE_ROUND", async () => {
    const game = await startIn(tree, OBSERVATORY_ID, "medium", 1010);
    const round = { scene: game.sceneId(), seed: game.seed(), listed: game.listed() };
    game.find(round.listed[0]);
    game.find(round.listed[1]);
    const foundBefore = game.found().length;
    const drawsBefore = game.env.random.calls;
    game.click((entry) => entry.props["aria-label"] === "Recomeçar a exploração");
    game.settle();
    const facts = {
      sameRoom: game.sceneId() === OBSERVATORY_ID,
      sameRound: game.seed() === round.seed && same(game.listed(), round.listed),
      clearedFinds: foundBefore === 2 && game.found().length === 0 && game.status() === "playing",
      noNewDraw: game.env.random.calls === drawsBefore,
      cameraBackWhereTheRoomOpens: game.camera().x === game.cam.initialCamera(game.scene(), game.size()).x,
    };
    game.unmount();
    return { pass: Object.values(facts).every(Boolean), ...facts };
  });

  await check("M11", "multiscene", "PRACTICE_AGAIN_IS_A_NEW_ROUND_IN_THE_SAME_ROOM", async () => {
    const { byId, rounds } = rooms(tree);
    const game = await startIn(tree, OBSERVATORY_ID, "easy", 111, { seeds: [222] });
    const first = { seed: game.seed(), listed: game.listed() };
    const result = game.finish();
    // the shell's "Praticar outra vez": a new mount of the game, in the same visit
    game.remount();
    await game.decode();
    const setup = { status: game.status(), scene: game.sceneId(), checked: game.sceneOptions().find((o) => o.checked)?.id ?? null, options: game.sceneOptions().map((o) => o.id) };
    game.explore();
    const second = { scene: game.sceneId(), seed: game.seed(), listed: game.listed() };
    game.unmount();
    // a new visit (a new page) starts where any first visit does
    const visit = openGame(tree);
    const newVisitScene = visit.sceneId();
    visit.unmount();
    const facts = {
      firstWasTheObservatory: result?.details.sceneId === OBSERVATORY_ID,
      setupKeepsTheRoom: setup.status === "setup" && setup.scene === OBSERVATORY_ID && setup.checked === OBSERVATORY_ID,
      newRoundSameRoom: second.scene === OBSERVATORY_ID && second.seed === 222 && same(second.listed, rounds.selectRoundTargets(byId[OBSERVATORY_ID], "easy", 222)) && !same(sorted(second.listed), sorted(first.listed)),
      everyRoomOfferedAgain: same(setup.options, SCENE_IDS),
      aNewVisitOpensOnTheStudio: newVisitScene === STUDIO_ID,
    };
    return { pass: Object.values(facts).every(Boolean), ...facts, first, second };
  });

  await check("M12", "multiscene", "TROCAR_DE_CENA_STARTS_A_NEW_EXPLORATION_THERE", async () => {
    const { byId, rounds } = rooms(tree);
    const game = await startIn(tree, OBSERVATORY_ID, "hard", 1212, { seeds: [3434] });
    const before = { seed: game.seed(), listed: game.listed() };
    game.find(before.listed[0]);
    const trocar = game.button((entry) => entry.props["aria-label"] === "Trocar de cena");
    game.click((entry) => entry.props["aria-label"] === "Trocar de cena");
    const inSetup = { status: game.status(), seed: game.seed(), listed: game.listed(), found: game.found(), scene: game.sceneId() };
    game.chooseScene(STUDIO_ID);
    await game.decode();
    game.explore();
    const after = { scene: game.sceneId(), seed: game.seed(), listed: game.listed(), found: game.found() };
    const result = game.finish();
    const facts = {
      offeredWhilePlaying: Boolean(trocar) && !trocar.props.disabled,
      backToSetupWithNothingKept: inSetup.status === "setup" && inSetup.seed === null && inSetup.listed.length === 0 && inSetup.found.length === 0 && inSetup.scene === OBSERVATORY_ID,
      aNewRoundInTheNewRoom: after.scene === STUDIO_ID && after.seed === 3434 && same(after.listed, rounds.selectRoundTargets(byId[STUDIO_ID], "hard", 3434)) && after.found.length === 0,
      noObservatoryObjectSurvives: !after.listed.some((id) => byId[OBSERVATORY_ID].pool.some((t) => t.id === id)),
      theResultIsTheNewRooms: result?.details.sceneId === STUDIO_ID && result.details.roundSeed === 3434 && game.calls.complete.length === 1,
    };
    game.unmount();
    return { pass: Object.values(facts).every(Boolean), ...facts };
  });

  await check("M13", "multiscene", "THE_RESULT_RECORDS_ITS_ROOM_AND_ROUND", async () => {
    const { registry, rounds } = rooms(tree);
    const t = platformTables(tree);
    const results = {};
    for (const [id, d, seed] of [[OBSERVATORY_ID, "medium", 1313], [STUDIO_ID, "medium", 1313], [OBSERVATORY_ID, "hard", 99]]) {
      const game = await startIn(tree, id, d, seed);
      const listed = game.listed();
      const result = game.finish();
      game.unmount();
      results[`${id}/${d}`] = { result, listed };
    }
    const problems = [];
    for (const [key, { result, listed }] of Object.entries(results)) {
      const [id, d] = key.split("/");
      const scene = registry.sceneById(id);
      const want = { difficulty: d, foundObjects: listed.length, totalObjects: listed.length, completed: true, sceneId: id, roundSeed: result?.details.roundSeed };
      if (!result || !same(result.details, want)) problems.push(`${key}: details ${JSON.stringify(result?.details)}`);
      if (result?.gameId !== GAME || result.activityId !== GAME || result.activityTitle !== GAME_TITLE || result.score !== listed.length) problems.push(`${key}: identity`);
      if (result?.summary !== scene.copy.summary) problems.push(`${key}: summary`);
      if (result && !same(rounds.selectRoundTargets(registry.sceneById(result.details.sceneId), result.details.difficulty, result.details.roundSeed), listed)) problems.push(`${key}: (room, difficulty, seed) does not draw the list played`);
      if (result && Object.keys(result).some((k) => /continuation|time|elapsed/i.test(k))) problems.push(`${key}: unexpected field`);
    }
    // through the generic platform: saved and read back; old results stay readable; the modal names no room
    const env = createEnvironment({ storage: { [STORAGE_KEY]: JSON.stringify([OLD_STUDIO_RESULT, LEGACY_TRILHA_RESULT]) } });
    const storage = createModuleGraph({ tree, mocks: {}, globals: env.globals }).require(FILES.storage);
    const saved = storage.saveGameResult(results[`${OBSERVATORY_ID}/medium`].result);
    const stored = storage.getRecentResults();
    const presentation = t.rewards.getResultPresentation({ gameId: GAME });
    const shown = (r) => t.labels.formatResultDetails(r.details, presentation);
    const facts = {
      savedAndReadBack: stored[0]?.id === saved.id && same({ ...stored[0], id: undefined, playedAt: undefined }, results[`${OBSERVATORY_ID}/medium`].result),
      oldResultsKept: same(stored.slice(1), [OLD_STUDIO_RESULT, LEGACY_TRILHA_RESULT]),
      oldStudioResultShown: same(shown(OLD_STUDIO_RESULT), [{ key: "difficulty", label: "Modo", value: "Médio" }]) && t.rewards.getRewardCopy(OLD_STUDIO_RESULT).title === "Estúdio explorado",
      observatoryResultShown: same(shown(saved), [{ key: "difficulty", label: "Modo", value: "Médio" }]) && t.rewards.isSuccessfulResult(saved),
      legacyStillReadable: t.rewards.getRewardCopy(LEGACY_TRILHA_RESULT).title !== "Estúdio explorado" && Array.isArray(shown(LEGACY_TRILHA_RESULT)),
      modalNamesNoRoom: !/explorer-|Observat|sceneId/.test(codeOnly(tree.read(FILES.rewardModal))) && !/explorer-|Observat/.test(codeOnly(tree.read(FILES.rewards))),
    };
    return { pass: problems.length === 0 && Object.values(facts).every(Boolean), problems, ...facts, observatoryResult: results[`${OBSERVATORY_ID}/medium`].result };
  });

  await check("M14", "multiscene", "UNLISTED_OBJECTS_ARE_SCENERY_IN_EVERY_ROOM", async () => {
    const problems = [];
    let tapped = 0;
    for (const id of SCENE_IDS) {
      for (const d of DIFFICULTIES) {
        const game = await startIn(tree, id, d, 1400 + d.length);
        const listed = game.listed();
        const scene = game.scene();
        const unlisted = scene.pool.filter((t) => !listed.includes(t.id));
        for (const target of unlisted) {
          game.goTo(target.station);
          const before = { found: game.found(), listed: game.listed(), status: game.status() };
          game.tapScene(game.model.regionCenter(target.region), { pointerType: "touch" });
          game.settle();
          tapped += 1;
          const live = game.harness.hosts((entry) => entry.props["aria-live"] === "polite")[0]?.text ?? "";
          if (!same(game.found(), before.found) || !same(game.listed(), before.listed) || game.status() !== before.status) problems.push(`${id}/${d}: ${target.id} answered`);
          if (live.includes(target.label)) problems.push(`${id}/${d}: ${target.id} announced`);
        }
        // nothing on the page marks a candidate: the scene's DOM names no pool object
        const fxNames = game.harness.hosts((entry) => typeof entry.props["data-target"] === "string" && !game.cls("hos-item")(entry)).map((entry) => entry.props["data-target"]);
        if (fxNames.length) problems.push(`${id}/${d}: scene marks ${fxNames.join(",")}`);
        game.unmount();
      }
    }
    return { pass: problems.length === 0 && tapped > 0, tapped, problems: problems.slice(0, 8) };
  });

  await check("M15", "multiscene", "EVERY_ROUND_CROSSES_ITS_ROOM", () => {
    const { scenes, rounds, contract, graph } = rooms(tree);
    const keeper = v3RoundKeeper(tree);
    const difficulty = keeper ? graph.require(FILES.difficulty) : null;
    const problems = [];
    const counts = {};
    for (const scene of scenes) {
      for (const d of DIFFICULTIES) {
        const preset = contract.DIFFICULTY_PRESETS[d];
        const valid = rounds.validRounds(scene, d);
        const brute = bruteForceRounds(scene.pool, preset, scene.stations, keeper && ((ids) => keeper(scene, d, ids)));
        counts[`${scene.id}/${d}`] = valid.length;
        if (!same(sorted(valid.map((r) => [...r].sort().join())), sorted(brute))) problems.push(`${scene.id}/${d}: enumeration ≠ brute force (${valid.length} vs ${brute.length})`);
        if (valid.length < 20) problems.push(`${scene.id}/${d}: only ${valid.length} rounds`);
        const fewest = Math.floor(preset.count / scene.stations.length);
        const most = Math.ceil(preset.count / scene.stations.length);
        const byId = Object.fromEntries(scene.pool.map((t) => [t.id, t]));
        for (const round of valid) {
          const held = scene.stations.map((s) => round.filter((id) => byId[id].station === s.id).length);
          if (held.some((n) => n < fewest || n > most)) problems.push(`${scene.id}/${d}: ${round.join(",")} crowds a station`);
          const tiers = { A: 0, B: 0, C: 0 };
          for (const id of round) tiers[byId[id].tier] += 1;
          if ((keeper ? !keeper(scene, d, round) : !same(tiers, preset.tiers)) || new Set(round).size !== preset.count) problems.push(`${scene.id}/${d}: ${round.join(",")} breaks the mix`);
        }
        // every object the list style can show is reachable, and drawing is not stuck on a few rounds (a calibrated
        // tree: every object its tiers allow, except a glance find where the rule allows none)
        const reachable = new Set(valid.flat());
        const allowed = (t) =>
          keeper
            ? preset.round.tiers[t.tier][1] > 0 && (preset.round.maxPopOuts > 0 || difficulty.loadOf(scene, t.id) >= difficulty.POP_OUT_BELOW)
            : preset.tiers[t.tier] > 0;
        const listable = scene.pool.filter((t) => (!t.listedAs || t.listedAs.includes(preset.listStyle)) && allowed(t));
        if (listable.some((t) => !reachable.has(t.id))) problems.push(`${scene.id}/${d}: an object can never be asked for`);
        const random = lcg(0x15 + d.length);
        const seen = new Set();
        for (let i = 0; i < 4000; i += 1) seen.add([...rounds.selectRoundTargets(scene, d, Math.floor(random() * 2 ** 32))].sort().join());
        if (seen.size < Math.min(valid.length, 4000) * 0.6) problems.push(`${scene.id}/${d}: 4000 seeds reached only ${seen.size} rounds`);
      }
    }
    return { pass: problems.length === 0, problems: problems.slice(0, 8), validRounds: counts };
  });

  await check("M16", "multiscene", "THE_OBSERVATORY_MEETS_THE_FAIRNESS_FLOORS", () => {
    const { contract, camera: cam, model, rounds } = rooms(tree);
    const scene = room(tree, OBSERVATORY_ID);
    const W = scene.width;
    const H = scene.height;
    const pool = scene.pool;
    const box = (r) => model.regionBounds(r.region);
    const problems = [];
    // F1 inside the safe area; F2 no crowding; F3 each target in its station, every station every tier
    for (const r of [...pool, ...scene.lookAlikes]) {
      const b = box(r);
      if (b.x < contract.SAFE_MARGIN_X || b.y < contract.SAFE_MARGIN_Y || b.x + b.w > W - contract.SAFE_MARGIN_X || b.y + b.h > H - contract.SAFE_MARGIN_Y) problems.push(`F1 ${r.id} outside the safe area`);
    }
    let minGap = Infinity;
    for (let i = 0; i < pool.length; i += 1) {
      for (let j = i + 1; j < pool.length; j += 1) {
        const gap = regionGap(model, pool[i].region, pool[j].region);
        minGap = Math.min(minGap, gap);
        if (gap < MIN_TARGET_GAP_SU) problems.push(`F2 ${pool[i].id}/${pool[j].id} ${gap.toFixed(1)} su`);
      }
    }
    for (const t of pool) {
      const c = model.regionCenter(t.region);
      if (scene.stations.find((s) => c.x >= s.span.x0 && c.x < s.span.x1)?.id !== t.station) problems.push(`F3 ${t.id} not in ${t.station}`);
    }
    const grid = Object.fromEntries(scene.stations.map((s) => [s.id, Object.fromEntries(["A", "B", "C"].map((tier) => [tier, pool.filter((t) => t.station === s.id && t.tier === tier).length]))]));
    if (Object.values(grid).some((row) => Object.values(row).some((count) => count < 1))) problems.push("F3 a station lacks a tier");
    // F4 never covered: every layer in front of the plate, at its furthest drift + clearance, misses every target and look-alike
    const order = scene.layers.map((l) => l.id);
    const plateIndex = order.indexOf("plate");
    for (const layer of scene.layers.slice(plateIndex + 1)) {
      if (!(layer.parallax >= 1 && layer.parallax <= 1.08)) problems.push(`F4 ${layer.id} parallax ${layer.parallax}`);
      const drift = cam.maxParallaxOffset(scene, layer.parallax);
      for (const paint of layer.opaque) {
        const grown = { x: paint.x - drift.x - FRONT_CLEARANCE_SU, y: paint.y - drift.y - FRONT_CLEARANCE_SU, w: paint.w + 2 * (drift.x + FRONT_CLEARANCE_SU), h: paint.h + 2 * (drift.y + FRONT_CLEARANCE_SU) };
        for (const r of [...pool, ...scene.lookAlikes]) if (intersects(grown, box(r))) problems.push(`F4 ${layer.id} can cover ${r.id}`);
        if (paint.x < layer.rect.x || paint.y < layer.rect.y || paint.x + paint.w > layer.rect.x + layer.rect.w || paint.y + paint.h > layer.rect.y + layer.rect.h) problems.push(`F4 ${layer.id} paint outside its layer`);
      }
    }
    for (const layer of scene.layers.slice(0, plateIndex)) if (!(layer.parallax < 1)) problems.push(`F4 ${layer.id} behind the plate drifts in front`);
    // F5 reachable: every target framed whole, clear of the HUD, on every viewport
    for (const viewport of VIEWPORTS) {
      for (const t of pool) {
        const b = box(t);
        const camera = cam.revealCamera(scene, b, viewport);
        const a = cam.sceneToViewport(scene, { x: b.x, y: b.y }, camera, viewport);
        const z = cam.sceneToViewport(scene, { x: b.x + b.w, y: b.y + b.h }, camera, viewport);
        const screen = { x: a.x, y: a.y, w: z.x - a.x, h: z.y - a.y };
        if (screen.x < -EPS || screen.y < -EPS || screen.x + screen.w > viewport.width + EPS || screen.y + screen.h > viewport.height + EPS) problems.push(`F5 ${t.id} off screen (${viewport.name})`);
        for (const hud of hudRects(viewport)) if (intersects(screen, hud)) problems.push(`F5 ${t.id} under the ${hud.name} (${viewport.name})`);
      }
    }
    // F6 not microscopic: on the reference phone at cover, and with the zoom on every viewport
    const listable = Object.fromEntries(DIFFICULTIES.map((d) => [d, rounds.validRounds(scene, d)]));
    const cover = cam.coverScale(scene, REFERENCE_PHONE);
    const top = cover * cam.maxZoom(scene, REFERENCE_PHONE);
    for (const t of pool) {
      const b = box(t);
      const reach = DIFFICULTIES.filter((d) => listable[d].some((round) => round.includes(t.id))).map((d) => model.tolerancePxFor(d, "touch"));
      if (Math.max(b.w, b.h) * cover < MIN_VISIBLE_AT_COVER_PX) problems.push(`F6 ${t.id} ${(Math.max(b.w, b.h) * cover).toFixed(1)} px at cover on the phone`);
      if (Math.min(b.w, b.h) * top + 2 * Math.min(...reach) < MIN_EFFECTIVE_TOUCH_PX) problems.push(`F6 ${t.id} small at full zoom on the phone`);
    }
    const smallestSide = Math.min(...pool.map((t) => Math.min(box(t).w, box(t).h)));
    for (const viewport of VIEWPORTS) {
      const best = smallestSide * cam.coverScale(scene, viewport) * cam.maxZoom(scene, viewport);
      if (best < MIN_EFFECTIVE_TOUCH_PX) problems.push(`F6 zoom tops out at ${best.toFixed(1)} px (${viewport.name})`);
    }
    // F7 never colour alone; clues say what, never which; hint words present
    const labelWords = new Set(pool.flatMap((t) => words(t.label)));
    for (const t of pool) {
      if (COLOUR_WORDS.test(t.label) || COLOUR_WORDS.test(t.accessibleLabel)) problems.push(`F7 ${t.id} named by a colour`);
      for (const { text, max } of cluesOf(t)) {
        if (text.length > max) problems.push(`clue ${t.id} too long`);
        const clueWords = new Set(words(text));
        for (const other of pool) if (words(other.label).some((w) => clueWords.has(w))) problems.push(`clue of ${t.id} names ${other.id}`);
      }
      for (const field of ["hintRegion", "hintDirection", "hintContext"]) if (words(t[field]).some((w) => words(t.label).includes(w))) problems.push(`${field} of ${t.id} names it`);
    }
    // look-alikes: in their target's station, clear of every target, not too many, never named like a target or by a clue
    for (const l of scene.lookAlikes) {
      const target = pool.find((t) => t.id === l.resembles);
      const c = model.regionCenter(l.region);
      if (scene.stations.find((s) => c.x >= s.span.x0 && c.x < s.span.x1)?.id !== target.station) problems.push(`look-alike ${l.id} not in ${target.station}`);
      for (const t of pool) if (regionGap(model, l.region, t.region) < LOOKALIKE_CLEARANCE_SU - EPS) problems.push(`look-alike ${l.id} ${regionGap(model, l.region, t.region).toFixed(1)} su from ${t.id}`);
      if (words(l.label).some((w) => labelWords.has(w))) problems.push(`look-alike ${l.id} shares a target's name`);
      if (pool.some((t) => cluesOf(t).some(({ text }) => normalizeText(text).includes(normalizeText(l.label))))) problems.push(`look-alike ${l.id} named by a clue`);
      for (const d of DIFFICULTIES) if (model.hitTest(scene, c, pool.map((t) => t.id), LOOKALIKE_TAP_SCALE, model.tolerancePxFor(d, "touch")) !== null) problems.push(`${d}: tapping ${l.id} finds something`);
    }
    for (let i = 0; i < scene.lookAlikes.length; i += 1) for (let j = i + 1; j < scene.lookAlikes.length; j += 1) if (regionGap(model, scene.lookAlikes[i].region, scene.lookAlikes[j].region) <= 0) problems.push(`look-alikes ${scene.lookAlikes[i].id}/${scene.lookAlikes[j].id} overlap`);
    for (const t of pool) if (scene.lookAlikes.filter((l) => l.resembles === t.id).length > LOOKALIKE_LIMIT[t.tier]) problems.push(`${t.id} has too many look-alikes`);
    // the art itself, measured: the audit of THIS plate; every target above its tier's floor; C more covered than A
    const plate = scene.layers.find((l) => l.id === "plate");
    const kit = plate.src.replace(/\/plate\.webp$/, "");
    const auditFile = `docs/archive/hidden-objects/${OBSERVATORY_ID}/review/${kit.split("/").pop()}/fairness.json`;
    const audit = tree.exists(auditFile) ? JSON.parse(tree.read(auditFile)) : null;
    const plateHash = tree.exists(`public${plate.src}`) ? sha256(readBinary(tree, `public${plate.src}`)) : null;
    const auditRows = {};
    if (!audit) problems.push(`no audit at ${auditFile}`);
    else {
      if (audit.kit !== kit) problems.push(`audit of ${audit.kit}`);
      if (audit.plateSha256 !== plateHash) problems.push("audit is stale (the plate changed after it)");
      for (const row of audit.targets ?? []) auditRows[row.id] = row;
      for (const t of pool) {
        const row = auditRows[t.id];
        if (!row) problems.push(`${t.id} not audited`);
        else {
          if (row.tier !== t.tier) problems.push(`${t.id} audited as ${row.tier}`);
          if (row.visible < VISIBLE_FLOOR[t.tier]) problems.push(`${t.id} ${(row.visible * 100).toFixed(0)}% visible`);
          if (row.edge < EDGE_FLOOR) problems.push(`${t.id} edge ${row.edge}:1`);
          if (!same(sorted(row.lookAlikes ?? []), sorted(scene.lookAlikes.filter((l) => l.resembles === t.id).map((l) => l.id)))) problems.push(`${t.id} audited with other look-alikes`);
        }
      }
      const mean = (tier) => {
        const list = pool.filter((t) => t.tier === tier && auditRows[t.id]).map((t) => auditRows[t.id].visible);
        return list.reduce((a, b) => a + b, 0) / Math.max(1, list.length);
      };
      if (!(mean("C") < mean("B") && mean("B") < mean("A"))) problems.push(`tiers are not ordered by cover (A ${mean("A").toFixed(2)} B ${mean("B").toFixed(2)} C ${mean("C").toFixed(2)})`);
    }
    // the art script paints every target and look-alike exactly once (it reads this room's module)
    const script = tree.exists("tools/assets/create_observatory_scene.mjs") ? tree.read("tools/assets/create_observatory_scene.mjs") : "";
    for (const t of pool) if ((script.match(new RegExp(`\\n  "?${t.id}"?: \\{`, "g")) ?? []).length !== 1 || (script.split(`t(omit, "${t.id}")`).length - 1) !== 1) problems.push(`${t.id} not painted exactly once`);
    for (const l of scene.lookAlikes) if ((script.split(`lookSvg("${l.id}")`).length - 1) !== 1) problems.push(`look-alike ${l.id} not painted exactly once`);
    return {
      pass: problems.length === 0,
      problems: problems.slice(0, 12),
      problemCount: problems.length,
      minGapSu: Math.round(minGap),
      stationsByTier: grid,
      audit: Object.values(auditRows).map((row) => `${row.id} ${row.tier} ${(row.visible * 100).toFixed(0)}% edge ${row.edge}`),
    };
  });

  await check("M17", "multiscene", "A_ROOMS_ART_LOADS_ONLY_WITH_THAT_ROOM", async () => {
    const { scenes } = rooms(tree);
    const graph = staticGraph(tree);
    // the Home: no Game 03 module and no room's art in its static graph
    const homeClosure = graph.closure(APP_ROOTS, ["static"]);
    const homeGame = homeClosure.filter((file) => file.startsWith(DIR));
    const artPaths = scenes.map((scene) => scene.layers.find((l) => l.id === "plate").src.replace(/\/[^/]+$/, ""));
    const homeNamesArt = homeClosure.filter((file) => /\.(ts|tsx)$/.test(file) && artPaths.some((p) => tree.read(file).includes(`${p}/plate`) || tree.read(file).includes(`${p}/back`)));
    // the game imports no picture as a module: every room's art is a URL fetched only when rendered
    const gameClosure = graph.closure([FILES.game], ["static", "dynamic"]);
    const assetImports = gameClosure.filter((file) => /\.(webp|png|jpe?g|avif|gif|svg)$/i.test(file));
    // on screen: the setup shows every room's light preview, and only the chosen room's full-resolution layers
    const game = openGame(tree);
    const layerSets = {};
    const otherRoomsArt = [];
    for (const id of [STUDIO_ID, OBSERVATORY_ID, STUDIO_ID]) {
      if (game.sceneId() !== id) game.chooseScene(id);
      await game.decode();
      const scene = scenes.find((s) => s.id === id);
      const own = scene.layers.map((l) => l.src);
      layerSets[id] = game.layerSrcs();
      const others = scenes.filter((s) => s.id !== id);
      for (const src of game.imageSrcs()) {
        for (const other of others) {
          if (other.layers.some((l) => l.src === src) || other.pool.some((t) => other.thumbnail(t.id) === src)) otherRoomsArt.push(`${id}: ${src}`);
        }
      }
      if (!same(layerSets[id], own)) otherRoomsArt.push(`${id}: layers ${layerSets[id].join(",")}`);
    }
    const previews = game.imageSrcs().filter((src) => scenes.some((s) => s.preview === src));
    game.unmount();
    // and each room's art stays light: its layers, its list's pictures and its preview within the entry budget
    const roomBytes = Object.fromEntries(
      scenes.map((scene) => {
        const files = [...scene.layers.map((l) => l.src), ...scene.pool.map((t) => scene.thumbnail(t.id)), scene.preview];
        return [scene.id, files.reduce((sum, src) => sum + (tree.exists(`public${src}`) ? readBinary(tree, `public${src}`).length : Infinity), 0)];
      }),
    );
    const overBudget = Object.entries(roomBytes).filter(([, bytes]) => bytes > ROOM_ENTRY_BUDGET_BYTES).map(([id]) => id);
    return {
      pass:
        homeGame.length === 0 && homeNamesArt.length === 0 && assetImports.length === 0 && otherRoomsArt.length === 0 &&
        same(sorted(previews), sorted(scenes.map((s) => s.preview))) && overBudget.length === 0,
      roomArtKB: Object.fromEntries(Object.entries(roomBytes).map(([id, bytes]) => [id, Math.round(bytes / 102.4) / 10])),
      overBudget,
      homeGameModules: homeGame,
      homeNamesArt,
      assetImports,
      otherRoomsArtOnScreen: otherRoomsArt.slice(0, 6),
      previews,
    };
  });

  await check("M18", "multiscene", "A_ROOM_THAT_CANNOT_LOAD_NEVER_BREAKS_THE_OTHER", async () => {
    const { rounds } = rooms(tree);
    // (1) at the entry: the Observatório (chosen earlier in the visit) fails → the shell's boundary hears it once
    const game = openGame(tree, { remember: OBSERVATORY_ID, seeds: [1818] });
    const enteredOn = game.sceneId();
    game.failLayer("plate");
    game.failLayer("back");
    const atEntry = { errors: [...game.calls.errors], ready: game.calls.ready };
    // the shell's "Tentar novamente": a new mount in the same visit → it opens on the Estúdio, which works
    game.remount();
    const retriedOn = game.sceneId();
    await game.decode();
    const readyAfterRetry = game.calls.ready;
    game.explore();
    const studioRound = { scene: game.sceneId(), listed: game.listed() };
    const studioResult = game.finish();
    game.unmount();
    // (2) after the entry: the Estúdio is on screen, the Observatório is chosen and fails → a calm notice, Explorar held, the Estúdio still a tap away
    const later = openGame(tree, { seeds: [2828] });
    await later.decode();
    const readyBefore = later.calls.ready;
    later.chooseScene(OBSERVATORY_ID);
    const waiting = later.exploreButton();
    later.failLayer("plate");
    const failed = {
      notice: later.harness.hosts(later.cls("hos-scene-failed"))[0]?.text ?? "",
      explore: later.exploreButton(),
      retry: later.button((entry) => entry.text === "Tentar de novo"),
    };
    later.chooseScene(STUDIO_ID);
    await later.decode();
    later.chooseDifficulty("easy");
    later.explore();
    const recovered = { scene: later.sceneId(), seed: later.seed(), listed: later.listed() };
    later.unmount();
    const facts = {
      entryFailureReachesTheBoundary: enteredOn === OBSERVATORY_ID && atEntry.errors.length >= 1 && atEntry.errors.every((e) => /scene asset/.test(e)) && atEntry.ready === 0,
      retryOpensTheStudio: retriedOn === STUDIO_ID && readyAfterRetry === 1,
      studioPlaysToTheEnd: studioRound.scene === STUDIO_ID && studioResult?.details.sceneId === STUDIO_ID,
      laterChoiceWaitsForItsArt: readyBefore === 1 && Boolean(waiting?.props.disabled) && /Preparando/.test(waiting?.text ?? ""),
      laterFailureIsShownCalmly: /Não foi possível abrir o Observatório do Explorador/.test(failed.notice) && Boolean(failed.explore?.props.disabled) && Boolean(failed.retry),
      theStudioStillPlays: recovered.scene === STUDIO_ID && recovered.seed === 2828 && same(recovered.listed, rounds.selectRoundTargets(room(tree, STUDIO_ID), "easy", 2828)),
    };
    return { pass: Object.values(facts).every(Boolean), ...facts, atEntry };
  });

  // --- preserved: what this mission must not move ---------------------------------------------------

  await check("M19", "preserved", "THE_SHARED_PLATFORM_IS_UNTOUCHED", () => {
    // everything outside Game 03's own folder: the shell, GameScreen, the registry, the entry contract, results,
    // storage, the Home, the Rota, the Circuito, the legacy games, the types — byte for byte
    const changed = folderDiff(tree, BASE_TREE, "src").filter((file) => !file.startsWith(DIR));
    const fields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
    const mine = JSON.parse(tree.read("package.json"));
    const base = JSON.parse(BASE_TREE.read("package.json"));
    const depsChanged = fields.filter((field) => !same(mine[field] ?? {}, base[field] ?? {}));
    const lockfileUnchanged = tree.read("package-lock.json") === BASE_TREE.read("package-lock.json");
    // the new room never reaches the shell (the Estúdio's intro art path in worldVisuals.ts is EXPERIENCE-02's own metadata)
    const shellNamesARoom = sourceFiles(tree).filter((file) => !file.startsWith(DIR) && /explorer-observatory|Observat[oó]rio|sceneId/.test(codeOnly(tree.read(file))));
    return { pass: changed.length === 0 && depsChanged.length === 0 && lockfileUnchanged && shellNamesARoom.length === 0, changedOutsideGame03: changed, depsChanged, lockfileUnchanged, shellNamesARoom };
  });

  await check("M20", "preserved", "THE_DIFFICULTY_CONTRACT_IS_FROZEN", () => {
    const { scene } = pureModules(tree);
    const actual = Object.fromEntries(
      DIFFICULTIES.map((d) => {
        const p = scene.DIFFICULTY_PRESETS[d];
        return [d, { count: p.count, tiers: p.tiers ?? p.round?.tiers, listStyle: p.listStyle, hintLadder: [...p.hintLadder], hintRadius: p.hintRadius, tolerancePx: p.tolerancePx }];
      }),
    );
    // no room brings its own difficulty, and nothing in Game 03 counts time, lives or score against the Explorador
    const perRoomPresets = isMultiscene(tree) ? rooms(tree).scenes.filter((s) => "presets" in s || "difficulty" in s).map((s) => s.id) : [];
    const pressure = listFiles(tree, DIR)
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .filter((file) => /setInterval|Date\.now|performance\.now\(\)\s*-|\blives\b|\bstreak|\branking|countdown|timeLeft/i.test(codeOnly(tree.read(file))) && !file.endsWith("hidden-objects-controller.ts"));
    const frozen = isCalibrated(tree) ? FROZEN_V3 : FROZEN_V2;
    return { pass: same(actual, frozen) && same(scene.DIFFICULTY_ORDER, DIFFICULTIES) && perRoomPresets.length === 0 && pressure.length === 0, actual, perRoomPresets, pressure };
  });

  return results;
}

// --- mutants: in-memory overrides of today's tree, each of which some check must catch ----------------

const MUTANTS = [
  {
    name: "the scene selector always launches the Studio",
    files: { [FILES.game]: [["                onChange={() => onScene(option)}", "                onChange={() => onScene(SCENES[0])}"]] },
    mustFail: ["M08"],
  },
  {
    name: "the Observatory accidentally uses the Studio's pool",
    files: {
      [FILES.observatoryScene]: [
        ['import type { HiddenObjectDefinition', 'import { HIDDEN_OBJECTS as STUDIO_POOL } from "@/games/hidden-objects/scenes/explorer-studio";\nimport type { HiddenObjectDefinition'],
        ["  pool: HIDDEN_OBJECTS,\n", "  pool: STUDIO_POOL,\n"],
      ],
    },
    mustFail: ["M05", "M16"],
  },
  {
    name: "the result forgets its room",
    files: { [FILES.model]: [["      sceneId: state.scene.id,\n", ""]] },
    mustFail: ["M13"],
  },
  {
    name: "Recomeçar goes back to the Studio",
    files: {
      [FILES.game]: [
        [
          '            onClick={() => dispatch({ type: "restart" })}',
          '            onClick={() => {\n              dispatch({ type: "change-scene" });\n              dispatch({ type: "select-scene", scene: SCENES[0] });\n              dispatch({ type: "start", seed: state.roundSeed ?? 0 });\n            }}',
        ],
      ],
    },
    mustFail: ["M10"],
  },
  {
    name: "a change of room keeps the old list",
    files: { [FILES.model]: [["  ...createSession(scene, state.difficulty),\n", "  ...createSession(scene, state.difficulty),\n  targets: state.targets,\n  roundSeed: state.roundSeed,\n"]] },
    mustFail: ["M12"],
  },
  {
    name: "choosing a room saves a result",
    files: { [FILES.game]: [["    dispatch({ type: \"select-scene\", scene: next });\n", "    dispatch({ type: \"select-scene\", scene: next });\n    onComplete(buildHiddenObjectsResult(state));\n"]] },
    mustFail: ["M07"],
  },
  {
    name: "every room's art is loaded eagerly",
    files: {
      [FILES.game]: [
        [
          "      <p id={instructionsId} className=\"hos-sr-only\">",
          "      <div hidden>{SCENES.flatMap((room) => room.layers).map((layer) => <Image key={layer.src} src={layer.src} alt=\"\" width={8} height={8} unoptimized className=\"hos-layer hos-preload\" />)}</div>\n      <p id={instructionsId} className=\"hos-sr-only\">",
        ],
      ],
    },
    mustFail: ["M17"],
  },
  {
    name: "a room-specific branch leaks into the shared platform",
    files: {
      [FILES.rewards]: [
        [
          "  const success = isSuccessfulResult(result);\n  const worldCopy",
          '  const success = isSuccessfulResult(result);\n  if (result.details.sceneId === "explorer-observatory") return { title: "Observatório explorado", subtitle: "", progressLine: "", encouragement: "" };\n  const worldCopy',
        ],
      ],
    },
    mustFail: ["M13", "M19"],
  },
  {
    name: "a room-specific branch leaks into the engine",
    files: { [FILES.model]: [["  return state.targets.filter((id) => !state.foundIds.includes(id));", '  if (state.scene.id === "explorer-observatory") return state.targets.filter((id) => !state.foundIds.includes(id)).reverse();\n  return state.targets.filter((id) => !state.foundIds.includes(id));']] },
    mustFail: ["M03"],
  },
  {
    name: "an unlisted Observatory object answers a tap",
    files: { [FILES.model]: [["      const listed = state.targets;", '      const listed = state.scene.id === "explorer-observatory" ? state.scene.pool.map((target) => target.id) : state.targets;']] },
    mustFail: ["M14"],
  },
  {
    name: "a target is hidden by the foreground",
    files: { [FILES.observatoryScene]: [['    region: { kind: "rect", x: 3140, y: 608, w: 104, h: 92 },', '    region: { kind: "rect", x: 3240, y: 360, w: 104, h: 92 },']] },
    mustFail: ["M16"],
  },
  {
    name: "a foreground layer grows over the room",
    files: { [FILES.observatoryScene]: [["      { x: 3370, y: 0, w: 140, h: 470 },", "      { x: 3180, y: 0, w: 330, h: 760 },"]] },
    mustFail: ["M16"],
  },
  {
    name: "region balancing is ignored",
    files: { [FILES.rounds]: [["        return held >= spread.min && held <= spread.max;", "        return held >= 0;"]] },
    mustFail: ["M15"],
  },
  {
    name: "practice again forgets the room",
    files: { [FILES.scenes]: [["  if (SCENES.includes(scene)) lastExplored = scene;", "  if (SCENES.includes(scene)) lastExplored = DEFAULT_SCENE;"]] },
    mustFail: ["M11"],
  },
  {
    name: "a room that fails is offered again first",
    files: { [FILES.scenes]: [["  if (lastExplored === scene) lastExplored = DEFAULT_SCENE;", "  if (lastExplored === scene) lastExplored = scene;"]] },
    mustFail: ["M18"],
  },
  {
    name: "the Observatory draws its rounds from the Studio's stations",
    files: {
      [FILES.rounds]: [
        ["  const spread = stationSpread(preset.count, source.stations.length);", "  const spread = stationSpread(preset.count, 3);"],
        ["      source.stations.every((station) => {", '      [{ id: "janela" }, { id: "mesa" }, { id: "estante" }].every((station) => {'],
      ],
    },
    mustFail: ["M15", "M03"],
  },
  {
    name: "Médio's difficulty is recalibrated",
    files: { [FILES.scene]: [["    tiers: { A: 1, B: 3, C: 2 },", "    tiers: { A: 0, B: 3, C: 3 },"]] },
    mustFail: ["M20"],
  },
  {
    name: "the Observatory's art is repainted without a new audit",
    files: { [`docs/archive/hidden-objects/${OBSERVATORY_ID}/review/v1/fairness.json`]: [['"plateSha256": "', '"plateSha256": "0']] },
    mustFail: ["M16"],
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
  const contract = results.filter((r) => r.tag === "multiscene");
  const kept = results.filter((r) => r.tag !== "multiscene");
  const held = contract.every((r) => !r.pass) && kept.every((r) => r.pass);
  ok &&= held;
  console.log(`${held ? "CAUGHT" : "MISSED"}  base ${BASE.slice(0, 8)} — EXPERIENCE-02's final state: one room, no registry`);
  console.log(`        [multiscene] failing: ${contract.filter((r) => !r.pass).length}/${contract.length}`);
  console.log(`        [preserved] holding: ${kept.filter((r) => r.pass).length}/${kept.length}`);
  for (const r of results.filter((x) => (x.tag === "multiscene" && x.pass) || (x.tag !== "multiscene" && !x.pass))) {
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
  console.log(ok ? "HIDDEN_OBJECTS_MULTISCENE_COUNTERFACTUALS_HOLD" : "HIDDEN_OBJECTS_MULTISCENE_COUNTERFACTUALS_BROKEN");
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
    ` (${results.filter((r) => r.tag === "multiscene").length} multiscene, ${results.filter((r) => r.tag === "preserved").length} preserved)` +
    `${failing.length ? ` · failing: ${failing.join(", ")}` : ""}`,
);
console.log(failing.length ? "HIDDEN_OBJECTS_MULTISCENE_FAILED" : "HIDDEN_OBJECTS_MULTISCENE_OK");
process.exit(failing.length ? EXIT_VALIDATION_FAILED : EXIT_OK);
