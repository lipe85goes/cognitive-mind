/**
 * GAME03-CALIBRATION-02A — Difficulty V3 and the clue bank, checked from source.
 *
 * The mission raised Game 03's difficulty ceiling in both rooms: every object
 * carries a clue bank (direct / associative / indirect variants), a round draws
 * its list AND the clues it tells from one seed, and each difficulty's rounds
 * must meet a measured round rule — a band of the search-load ruler
 * (hidden-objects-difficulty.ts) derived from what Difficulty V2's Difícil asked
 * for, glance finds, tiers and look-alike pressure. Art kit v2 of both rooms
 * tucks five more objects into each room and paints more look-alikes, and its
 * audit is what the ruler reads.
 *
 * Everything runs the REAL code from source through the shared harness
 * (hidden-objects-harness.mjs): the pure modules opened per room, the real
 * HiddenObjectsGame with its real scene view under the harness's small React
 * (every gesture a Pointer Event on the viewport), the platform's storage and
 * result screen tables, the art on disk and its audits, and the calibration
 * base itself (git show) for the reference the floors are derived from.
 *
 * [calibration] checks are what this mission introduced: they FAIL on its base
 * (3b122cf — GAME03-MULTISCENE-03's final state: one static clue per object,
 * Difficulty V2's tier mixes, art kit v1). [preserved] checks are guards the
 * calibration must not break — the art's fairness floors, the hit areas, no
 * exact reveal in Médio/Difícil, Difícil never naming an object early, old
 * results, no timer/score/lives/ranking, replays that do not ask for the same
 * objects every time, the shared platform, one engine, the rooms' places, the
 * camera — and hold on both.
 *
 * Usage:
 *   node tools/validation/hidden-objects-calibration-tests.mjs                  # the working tree
 *   node tools/validation/hidden-objects-calibration-tests.mjs --rev=<commit>   # every source at <commit>
 *   node tools/validation/hidden-objects-calibration-tests.mjs --counterfactuals
 *        the working tree must pass every check; the base must fail every
 *        [calibration] check and hold every [preserved] one; every in-memory
 *        MUTANT must fail the checks it names. Nothing is ever written.
 *
 * Writes nothing. Exit 0 = every check holds, 1 = a check failed, 3 = usage error.
 */
import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";
import { composeShipped, measureClutter } from "../assets/hidden-objects-art-kit.mjs";
import { CALIBRATION_BASE, auditOf, deriveReference } from "./hidden-objects-calibration-lib.mjs";
import { createModuleGraph, openSourceTree } from "./route-module-loader.mjs";
import {
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
  folderDiff,
  hudRects,
  intersects,
  lcg,
  listFiles,
  nearCamera,
  normalizeText,
  platformTables,
  readBinary,
  regionGap,
  same,
  sorted,
} from "./hidden-objects-harness.mjs";
import { createHash } from "node:crypto";

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
const COUNTERFACTUAL_MODE = args.includes("--counterfactuals");
if (args.some((arg) => arg !== revArg && arg !== "--counterfactuals") || REV === "" || (REV && COUNTERFACTUAL_MODE)) {
  console.error("usage: node tools/validation/hidden-objects-calibration-tests.mjs [--rev=<commit> | --counterfactuals]");
  process.exit(EXIT_USAGE);
}

// --- what the mission fixed ---------------------------------------------------------------------

const BASE = CALIBRATION_BASE;
const GAME = "hidden-objects";
const STUDIO_ID = "explorer-studio";
const OBSERVATORY_ID = "explorer-observatory";
const SCENE_IDS = [STUDIO_ID, OBSERVATORY_ID];
const DIFFICULTIES = ["easy", "medium", "hard"];
const LEVELS = ["direct", "associative", "indirect"];
/** Difficulty V3, literally: what each difficulty lists, tells and gives back, and what its rounds may hold. */
const DIFFICULTY_V3 = {
  easy: { label: "Fácil", count: 5, listStyle: "picture", listClue: null, hintLadder: ["station", "area", "reveal"], reclue: null, tolerancePx: { touch: 16, mouse: 8 }, tiers: { A: [0, 1], B: [0, 5], C: [1, 5] }, maxPopOuts: 1 },
  medium: { label: "Médio", count: 6, listStyle: "clue", listClue: "associative", hintLadder: ["station", "reclue", "direction"], reclue: "direct", tolerancePx: { touch: 12, mouse: 6 }, tiers: { A: [0, 1], B: [0, 6], C: [2, 6] }, maxPopOuts: 1 },
  hard: { label: "Difícil", count: 8, listStyle: "clue", listClue: "indirect", hintLadder: ["station", "context"], reclue: null, tolerancePx: { touch: 10, mouse: 5 }, tiers: { A: [0, 0], B: [0, 4], C: [4, 8] }, maxPopOuts: 0 },
};
/** A clue bank: 3–5 variants, every level present. */
const BANK_SIZE = { min: 3, max: 5 };
/** The list shows associative and indirect clues (two lines of the list); a direct one is a hint banner's line. */
const MAX_CHARS = { direct: 56, associative: 48, indirect: 48 };
/** Two variants of one object sharing this much of their content words are the same clue said twice. */
const NEAR_DUPLICATE_JACCARD = 0.34;
/** Every difficulty draws from enough rounds that a familiar player cannot learn them (V2 drew from 148–768). */
const MIN_ROUNDS = 100;
/** Replays stay varied: no object a difficulty lists is in more than 3 of 4 of its rounds, none in fewer than 1 in 20. */
const EXPOSURE = { floor: 0.05, ceiling: 0.75 };
/** The fairness floors (Discovery §9; the same numbers since the skeleton — never lowered for new art). */
const VISIBLE_FLOOR = { A: 0.8, B: 0.6, C: 0.4 };
const EDGE_FLOOR = 1.3;
const MIN_TARGET_GAP_SU = 24;
const LOOKALIKE_CLEARANCE_SU = 32;
const FRONT_CLEARANCE_SU = 24;
const MIN_EFFECTIVE_TOUCH_PX = 44;
const MIN_VISIBLE_AT_COVER_PX = 32;
const LOOKALIKE_TAP_SCALE = 0.375;
const COLOUR_WORDS = /\b(azul|vermelh[oa]|verde|amarel[oa]|rox[oa]|rosa|laranja|pret[oa]|branc[oa]|cinza|marrom|dourad[oa]|pratead[oa])\b/i;
const STOP_WORDS = new Set(
  "para como quando onde mais menos muito muita pela pelo pelas pelos numa nele nela dele dela deles delas isso este esta esse essa aqui depois antes sempre nunca todo toda todos tudo ainda tambem outro outra dois duas entre sobre cada quem qual seus suas eles elas estao fica ficam umas".split(" "),
);
/** The engine's files: nothing in them may name a room, a station or a target. */
const ENGINE_FILES = ["hidden-objects-camera.ts", "hidden-objects-gesture.ts", "hidden-objects-controller.ts", "hidden-objects-model.ts", "hidden-objects-rounds.ts", "HiddenObjectsScene.tsx", "HiddenObjectsGame.tsx", "hidden-objects.css"].map((f) => `${DIR}${f}`);
/** The modules the camera and the gestures live in: this mission had no reason to touch them. */
const CAMERA_FILES = ["hidden-objects-camera.ts", "hidden-objects-gesture.ts", "hidden-objects-controller.ts"].map((f) => `${DIR}${f}`);
const CLUES_FILE = `${DIR}hidden-objects-clues.ts`;
const DIFFICULTY_FILE = `${DIR}hidden-objects-difficulty.ts`;
const EPS = 1e-9;

// --- small helpers -------------------------------------------------------------------------------

const plain = (value) => JSON.parse(JSON.stringify(value));
const words = (text) => normalizeText(text).split(/[^a-z]+/).filter((word) => word.length >= 4);
const content = (text) => new Set(words(text).filter((word) => !STOP_WORDS.has(word)));
const overlap = (a, b) => [...a].filter((word) => b.has(word));
const jaccard = (a, b) => (a.size + b.size === 0 ? 0 : overlap(a, b).length / new Set([...a, ...b]).size);
const isSentence = (text) => typeof text === "string" && /^[A-ZÀÁÉÍÓÚÂÊÔÃÕÇ].*[.!?]$/.test(text);
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const seedsOf = (salt, n) => {
  const random = lcg(salt);
  return Array.from({ length: n }, () => Math.floor(random() * 2 ** 32) >>> 0);
};

/** The rooms of a tree, the contract and the engine's pure modules (a tree without the calibration's modules throws). */
function engine(tree) {
  return cached(tree, "calibration:engine", () => {
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
    };
  });
}
/** The calibration's own modules (absent on the base: these throw there). */
function calibration(tree) {
  return cached(tree, "calibration:modules", () => {
    const { graph } = engine(tree);
    if (!tree.exists(CLUES_FILE) || !tree.exists(DIFFICULTY_FILE)) throw new Error("no clue bank / round model on this tree");
    return { clues: graph.require(CLUES_FILE), difficulty: graph.require(DIFFICULTY_FILE) };
  });
}
const room = (tree, id) => engine(tree).byId[id];

/** Every valid round of a difficulty in a room, with its profile. */
function profiled(tree, sceneId, difficulty) {
  return cached(tree, `calibration:profiled:${sceneId}:${difficulty}`, () => {
    const { rounds } = engine(tree);
    const { difficulty: model } = calibration(tree);
    const scene = room(tree, sceneId);
    return rounds.validRounds(scene, difficulty).map((ids) => ({ ids: [...ids], profile: model.roundProfile(scene, difficulty, ids) }));
  });
}

/**
 * The real game, mounted the way GameScreen mounts it (the multiscene suite's
 * opener): `seeds` are what the platform's random source hands out, in order.
 */
function openGame(tree, { viewport = DESKTOP, reducedMotion = false, seeds = [] } = {}) {
  const env = createEnvironment({ viewport, reducedMotion, seeds });
  const harness = createReact(env.createNode);
  const graph = createModuleGraph({ tree, mocks: browserMocks(harness), globals: env.globals });
  const registry = graph.require(FILES.scenes);
  const { HiddenObjectsGame } = graph.require(FILES.game);
  const model = graph.require(FILES.model);
  const cam = graph.require(FILES.camera);
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
    registry,
    model,
    cam,
    calls,
    cls,
    host,
    shell: () => host(cls("hos-shell"))?.props ?? {},
    status: () => game.shell()["data-status"] ?? null,
    sceneId: () => game.shell()["data-scene"] ?? null,
    scene: () => registry.sceneById(game.sceneId()),
    seed: () => (game.shell()["data-round-seed"] === undefined ? null : Number(game.shell()["data-round-seed"])),
    items: () =>
      harness.hosts(cls("hos-item")).map((entry) => ({
        id: entry.props["data-target"],
        text: entry.text,
        aria: entry.props["aria-label"],
        found: entry.props["data-found"] === "true",
        hasArt: harness.hosts((e) => e.type === IMAGE && e.path.startsWith(entry.path)).length > 0,
        entry,
      })),
    listed: () => game.items().map((item) => item.id),
    texts: () => game.items().map((item) => item.text),
    banner: () => host(cls("hos-hint-banner"))?.text ?? null,
    live: () => harness.hosts((entry) => entry.props["aria-live"] === "polite")[0]?.text ?? "",
    hintLabel: () => host(cls("hos-hint-button"))?.text ?? null,
    halo: () => host(cls("hos-halo")),
    revealHalo: () => host(cls("hos-halo-reveal")),
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
    focus(id) {
      const item = game.items().find((candidate) => candidate.id === id);
      item.entry.props.onClick?.({ preventDefault() {}, currentTarget: item.entry.node, target: item.entry.node });
      harness.flush();
    },
    hint() {
      game.click(cls("hos-hint-button"));
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

/** The clue texts a round of (room, difficulty, seed) lists, by the product's own selection. */
function expectedListTexts(tree, scene, difficulty, seed) {
  const { rounds } = engine(tree);
  const { clues } = calibration(tree);
  const ids = rounds.selectRoundTargets(scene, difficulty, seed);
  const choice = clues.selectRoundClues(scene, difficulty, seed, ids);
  return ids.map((id) => clues.clueAt(scene.pool.find((t) => t.id === id), choice[id].list)?.text ?? null);
}

/** Results as each earlier mission saved them (and a Trilha result, older still). */
const OLD_RESULTS = [
  {
    id: "hidden-objects-1759900000000",
    activityId: GAME,
    activityTitle: "Estúdio das Descobertas",
    gameId: GAME,
    score: 5,
    playedAt: "2026-10-06T18:00:00.000Z",
    summary: "Você encontrou todos os objetos do Estúdio.",
    details: { difficulty: "easy", foundObjects: 5, totalObjects: 5, completed: true },
  },
  {
    id: "hidden-objects-1760000000000",
    activityId: GAME,
    activityTitle: "Estúdio das Descobertas",
    gameId: GAME,
    score: 6,
    playedAt: "2026-10-08T18:00:00.000Z",
    summary: "Você encontrou todos os objetos do Estúdio.",
    details: { difficulty: "medium", foundObjects: 6, totalObjects: 6, completed: true, sceneId: STUDIO_ID, roundSeed: 202 },
  },
  {
    id: "hidden-objects-1760100000000",
    activityId: GAME,
    activityTitle: "Estúdio das Descobertas",
    gameId: GAME,
    score: 8,
    playedAt: "2026-10-09T18:00:00.000Z",
    summary: "Você encontrou todos os objetos do Observatório.",
    details: { difficulty: "hard", foundObjects: 8, totalObjects: 8, completed: true, sceneId: OBSERVATORY_ID, roundSeed: 777 },
  },
  {
    id: "number-trail-1759600000000",
    activityId: "number-trail",
    activityTitle: "Trilha Lógica",
    gameId: "number-trail",
    score: 340,
    playedAt: "2026-10-04T18:00:00.000Z",
    summary: "Você iluminou 2 trilhas completas na Trilha Lógica.",
    details: { level: 3, currentNumber: 12, errors: 0, roundsCompleted: 2, correctNumbers: 12, maxErrors: 3 },
  },
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

  // --- the clue bank ----------------------------------------------------------------------------------

  await check("C01", "calibration", "EVERY_TARGET_HAS_A_VALID_CLUE_BANK", () => {
    const { scenes } = engine(tree);
    const problems = [];
    const sizes = {};
    for (const scene of scenes) {
      for (const t of scene.pool) {
        const bank = t.clues;
        if (!Array.isArray(bank)) {
          problems.push(`${scene.id}/${t.id}: no clue bank`);
          continue;
        }
        if ("clue" in t) problems.push(`${scene.id}/${t.id}: still carries the one static clue`);
        if (bank.length < BANK_SIZE.min || bank.length > BANK_SIZE.max) problems.push(`${scene.id}/${t.id}: ${bank.length} variants`);
        for (const variant of bank) {
          if (!LEVELS.includes(variant.level)) problems.push(`${scene.id}/${t.id}: level ${variant.level}`);
          if (!isSentence(variant.text)) problems.push(`${scene.id}/${t.id}: not a sentence: ${variant.text}`);
        }
        for (const level of LEVELS) if (!bank.some((variant) => variant.level === level)) problems.push(`${scene.id}/${t.id}: no ${level} variant`);
        sizes[bank.length] = (sizes[bank.length] ?? 0) + 1;
      }
    }
    const objects = scenes.reduce((n, s) => n + s.pool.length, 0);
    return { pass: problems.length === 0 && objects > 0, objects, variantsPerObject: sizes, problems: problems.slice(0, 10), problemCount: problems.length };
  });

  await check("C02", "calibration", "NO_DUPLICATE_OR_NEAR_DUPLICATE_CLUES", () => {
    const { scenes } = engine(tree);
    const problems = [];
    let pairs = 0;
    let worst = 0;
    for (const scene of scenes) {
      const seen = new Map();
      for (const t of scene.pool) {
        const bank = t.clues;
        for (const variant of bank) {
          const key = normalizeText(variant.text).replace(/[^a-z]+/g, " ").trim();
          if (seen.has(key)) problems.push(`${scene.id}: "${variant.text}" repeats (${seen.get(key)}, ${t.id})`);
          seen.set(key, t.id);
        }
        for (let i = 0; i < bank.length; i += 1) {
          for (let j = i + 1; j < bank.length; j += 1) {
            pairs += 1;
            const a = bank[i].text;
            const b = bank[j].text;
            const similarity = jaccard(content(a), content(b));
            worst = Math.max(worst, similarity);
            if (similarity >= NEAR_DUPLICATE_JACCARD) problems.push(`${scene.id}/${t.id}: "${a}" ~ "${b}" (${similarity.toFixed(2)})`);
            if (normalizeText(a).includes(normalizeText(b).replace(/\.$/, "")) || normalizeText(b).includes(normalizeText(a).replace(/\.$/, ""))) problems.push(`${scene.id}/${t.id}: one variant contains the other`);
          }
        }
      }
    }
    return { pass: problems.length === 0 && pairs > 0, variantPairsCompared: pairs, mostSimilarPair: Number(worst.toFixed(2)), problems: problems.slice(0, 8), problemCount: problems.length };
  });

  await check("C03", "calibration", "CLUE_LEVELS_KEEP_THEIR_SEMANTIC_CONTRACT", () => {
    const { scenes, contract } = engine(tree);
    const problems = [];
    for (const scene of scenes) {
      // nothing in a clue may name an object of the room or one of its look-alikes
      const named = new Set([...scene.pool.flatMap((t) => words(t.label)), ...scene.lookAlikes.flatMap((l) => words(l.label))]);
      for (const t of scene.pool) {
        const own = new Set([...content(t.label), ...content(t.accessibleLabel)]);
        const direct = new Set(t.clues.filter((c) => c.level === "direct").flatMap((c) => [...content(c.text)]));
        for (const { level, text } of t.clues) {
          const p = (message) => problems.push(`${scene.id}/${t.id} ${level}: ${message} — "${text}"`);
          const naming = words(text).filter((word) => named.has(word));
          if (naming.length) p(`names ${naming.join(",")}`);
          if (COLOUR_WORDS.test(normalizeText(text))) p("leans on a colour");
          if (text.length > MAX_CHARS[level]) p(`${text.length} chars`);
          // associative and indirect: no word of the object's own description
          if (level !== "direct" && overlap(content(text), own).length) p(`shares ${overlap(content(text), own).join(",")} with its label`);
          // indirect: one or two associations further — not a word of the direct telling
          if (level === "indirect" && overlap(content(text), direct).length) p(`shares ${overlap(content(text), direct).join(",")} with its direct variant`);
        }
      }
    }
    // each difficulty reads the level its contract names, and a reclue only ever tells it more plainly
    const rank = { direct: 1, associative: 2, indirect: 3 };
    const presets = contract.DIFFICULTY_PRESETS;
    const levels = Object.fromEntries(DIFFICULTIES.map((d) => [d, { list: presets[d].listClue ?? null, reclue: presets[d].reclue ?? null }]));
    const contractHolds =
      levels.easy.list === null && levels.medium.list === "associative" && levels.hard.list === "indirect" &&
      levels.medium.reclue === "direct" && DIFFICULTIES.every((d) => !levels[d].reclue || rank[levels[d].reclue] < rank[levels[d].list]) &&
      DIFFICULTIES.every((d) => (presets[d].hintLadder.includes("reclue") ? Boolean(levels[d].reclue) : !levels[d].reclue));
    return { pass: problems.length === 0 && contractHolds, levels, problems: problems.slice(0, 8), problemCount: problems.length };
  });

  // --- the clues a round tells -------------------------------------------------------------------------

  await check("C04", "calibration", "SAME_SCENE_DIFFICULTY_AND_SEED_SAME_CLUES", async () => {
    const { byId, rounds, model } = engine(tree);
    const { clues } = calibration(tree);
    const fresh = createModuleGraph({ tree, mocks: {}, globals: {} });
    const freshClues = fresh.require(CLUES_FILE);
    const freshRooms = Object.fromEntries(fresh.require(FILES.scenes).SCENES.map((s) => [s.id, s]));
    const unstable = [];
    let draws = 0;
    for (const id of SCENE_IDS) {
      for (const d of DIFFICULTIES) {
        for (const seed of seedsOf(0xc104 + d.length, 200)) {
          const ids = rounds.selectRoundTargets(byId[id], d, seed);
          const a = clues.selectRoundClues(byId[id], d, seed, ids);
          const b = clues.selectRoundClues(byId[id], d, seed, ids);
          const c = freshClues.selectRoundClues(freshRooms[id], d, seed, ids);
          const R = model.sessionReducer;
          const session = R(R(model.createSession(byId[id]), { type: "select-difficulty", difficulty: d }), { type: "start", seed });
          draws += 1;
          if (!same(a, b) || !same(a, c) || !same(session.clues, a)) unstable.push(`${id}/${d}/${seed}`);
        }
      }
    }
    // on screen: the list a seeded round shows is exactly the clues (room, difficulty, seed) tell
    const onScreen = {};
    for (const id of SCENE_IDS) {
      for (const d of ["medium", "hard"]) {
        const game = await startIn(tree, id, d, 0x5eed + d.length);
        const shown = game.texts();
        const want = expectedListTexts(tree, byId[id], d, 0x5eed + d.length);
        onScreen[`${id}/${d}`] = same(shown, want);
        game.unmount();
      }
    }
    return { pass: unstable.length === 0 && Object.values(onScreen).every(Boolean), rounds: draws, unstable: unstable.slice(0, 4), listOnScreenIsTheSeedsClues: onScreen };
  });

  await check("C05", "calibration", "RESTART_PRESERVES_THE_CLUES", async () => {
    const { byId, model } = engine(tree);
    const facts = {};
    for (const id of SCENE_IDS) {
      for (const d of ["medium", "hard"]) {
        const seed = 0x0505 + d.length;
        // the reducer: a restart keeps the round's clues
        const R = model.sessionReducer;
        let s = R(R(model.createSession(byId[id]), { type: "select-difficulty", difficulty: d }), { type: "start", seed });
        const drawn = s.clues;
        s = R(s, { type: "hint" });
        s = R(s, { type: "tap", point: model.regionCenter(model.targetById(byId[id], s.targets[0]).region), scale: 1, pointerType: "mouse" });
        const restarted = R(s, { type: "restart" });
        // the game: the same lines, the same reclue, no new draw
        const game = await startIn(tree, id, d, seed);
        const before = game.texts();
        game.focus(game.listed()[1]);
        game.hint();
        game.hint();
        const bannerBefore = game.banner();
        game.find(game.listed()[0]);
        const drawsBefore = game.env.random.calls;
        game.click((entry) => entry.props["aria-label"] === "Recomeçar a exploração");
        game.settle();
        const after = game.texts();
        game.focus(game.listed()[1]);
        game.hint();
        game.hint();
        const bannerAfter = game.banner();
        facts[`${id}/${d}`] = {
          reducerKeepsThem: same(restarted.clues, drawn) && restarted.foundIds.length === 0,
          sameLines: same(after, before),
          sameSecondHint: bannerAfter === bannerBefore,
          noNewDraw: game.env.random.calls === drawsBefore,
        };
        game.unmount();
      }
    }
    return { pass: Object.values(facts).every((f) => Object.values(f).every(Boolean)), ...facts };
  });

  await check("C06", "calibration", "A_FRESH_EXPLORATION_CAN_TELL_OTHER_CLUES", async () => {
    const { byId, rounds } = engine(tree);
    const { clues } = calibration(tree);
    const problems = [];
    const coverage = {};
    for (const id of SCENE_IDS) {
      const scene = byId[id];
      for (const d of ["medium", "hard"]) {
        const preset = engine(tree).contract.DIFFICULTY_PRESETS[d];
        const told = new Map();
        let independent = true;
        for (const seed of seedsOf(0x0606 + d.length, 3000)) {
          const ids = rounds.selectRoundTargets(scene, d, seed);
          const choice = clues.selectRoundClues(scene, d, seed, ids);
          for (const target of ids) {
            if (!told.has(target)) told.set(target, new Set());
            told.get(target).add(choice[target].list);
            // an object's clue depends on the round's seed, never on the objects listed with it
            if (!same(clues.selectRoundClues(scene, d, seed, [target])[target], choice[target])) independent = false;
          }
        }
        const missing = [...told].filter(([target, set]) => clues.variantsAt(scene.pool.find((t) => t.id === target), preset.listClue).some((index) => !set.has(index))).map(([target]) => target);
        const varied = [...told].filter(([, set]) => set.size > 1).length;
        coverage[`${id}/${d}`] = { objects: told.size, toldMoreThanOneWay: varied, everyVariantReached: missing.length === 0, independentOfRoundMates: independent };
        if (missing.length) problems.push(`${id}/${d}: never tells some variant of ${missing.slice(0, 4).join(",")}`);
        if (!independent) problems.push(`${id}/${d}: a clue depends on the round's other objects`);
      }
    }
    // two fresh entries that list the same object can tell it differently (a new exploration, a new seed)
    const scene = byId[OBSERVATORY_ID];
    let pair = null;
    const seeds = seedsOf(0x6006, 400);
    for (let i = 0; i < seeds.length && !pair; i += 1) {
      for (let j = i + 1; j < seeds.length && !pair; j += 1) {
        const a = rounds.selectRoundTargets(scene, "hard", seeds[i]);
        const b = rounds.selectRoundTargets(scene, "hard", seeds[j]);
        const shared = a.find((t) => b.includes(t));
        if (!shared) continue;
        const ca = clues.selectRoundClues(scene, "hard", seeds[i], a)[shared].list;
        const cb = clues.selectRoundClues(scene, "hard", seeds[j], b)[shared].list;
        if (ca !== cb) pair = { seeds: [seeds[i], seeds[j]], object: shared };
      }
    }
    let onScreen = false;
    if (pair) {
      const lines = [];
      for (const seed of pair.seeds) {
        const game = await startIn(tree, OBSERVATORY_ID, "hard", seed);
        lines.push(game.items().find((item) => item.id === pair.object)?.text ?? null);
        game.unmount();
      }
      onScreen = lines[0] && lines[1] && lines[0] !== lines[1];
      pair.lines = lines;
    }
    return { pass: problems.length === 0 && onScreen, coverage, twoEntries: pair, problems };
  });

  await check("C07", "calibration", "NO_CLUE_CHANGES_DURING_THE_SESSION", async () => {
    const problems = [];
    const runs = {};
    for (const id of SCENE_IDS) {
      for (const d of ["medium", "hard"]) {
        const game = await startIn(tree, id, d, 0x0707 + d.length);
        const first = game.texts();
        const ids = game.listed();
        const drawsAtStart = game.env.random.calls;
        const holds = (step) => {
          const now = game.items();
          for (const [index, item] of now.entries()) {
            if (item.id !== ids[index]) problems.push(`${id}/${d}: ${step} reordered the list`);
            else if (!item.found && item.text !== first[index]) problems.push(`${id}/${d}: ${step} changed "${first[index]}" to "${item.text}"`);
            else if (item.found && !item.text.includes(first[index])) problems.push(`${id}/${d}: ${step} — the found line lost its clue`);
          }
        };
        game.harness.flush();
        holds("a render");
        game.drag(game.centre(), { x: game.centre().x - 240, y: game.centre().y + 30 });
        game.settle();
        holds("a pan");
        game.click((entry) => entry.props["aria-label"] === "Aproximar");
        game.settle();
        holds("a zoom");
        game.pointer("wheel", { deltaY: -300, deltaMode: 0, clientX: game.centre().x, clientY: game.centre().y });
        game.frames(14);
        holds("the wheel");
        game.focus(ids[1]);
        const banners = [];
        for (let k = 0; k < 4; k += 1) {
          game.hint();
          banners.push(game.banner());
        }
        holds("every rung of Pista");
        // the top rung, pressed again, says the same thing
        if (banners[2] !== banners[3] && banners.length === 4 && engine(tree).contract.DIFFICULTY_PRESETS[d].hintLadder.length <= 3) {
          if (banners.at(-1) !== banners.at(-2)) problems.push(`${id}/${d}: the top rung changed its words`);
        }
        game.resize({ width: 596, height: 337 });
        game.resize({ width: DESKTOP.width, height: DESKTOP.height });
        holds("a resize / rotation");
        game.env.setReducedMotion(true);
        game.goTo(game.scene().stations[0].id);
        game.env.setReducedMotion(false);
        holds("reduced motion on and off");
        game.click(game.cls("hos-tray-toggle"));
        game.click(game.cls("hos-tray-toggle"));
        holds("folding the list");
        game.find(ids[0]);
        holds("a find");
        game.frames(120);
        holds("idle frames");
        if (game.env.random.calls !== drawsAtStart) problems.push(`${id}/${d}: ${game.env.random.calls - drawsAtStart} more draw(s) after "Explorar"`);
        runs[`${id}/${d}`] = { lines: first.length, banners: banners.map((b) => clip(b ?? "", 60)) };
        game.unmount();
      }
    }
    return { pass: problems.length === 0, problems: problems.slice(0, 8), runs };
  });

  // --- the round model -----------------------------------------------------------------------------------

  /** The bands every room's valid rounds must sit in, and how each difficulty's rounds spread. */
  const bandFacts = (d) => {
    const { contract } = engine(tree);
    const rule = contract.DIFFICULTY_PRESETS[d].round;
    const perRoom = {};
    const problems = [];
    for (const id of SCENE_IDS) {
      const rows = profiled(tree, id, d);
      const p = rows.map((r) => r.profile);
      if (rows.length < MIN_ROUNDS) problems.push(`${id}: only ${rows.length} rounds`);
      for (const { ids, profile } of rows) {
        const fails = [];
        if (profile.count !== DIFFICULTY_V3[d].count) fails.push("count");
        if (profile.search < rule.minSearch - EPS) fails.push(`search ${profile.search.toFixed(3)} under ${rule.minSearch}`);
        if (!(profile.search < rule.maxSearch)) fails.push(`search ${profile.search.toFixed(3)} at or above ${rule.maxSearch}`);
        if (profile.popOuts > DIFFICULTY_V3[d].maxPopOuts) fails.push(`${profile.popOuts} glance finds`);
        for (const tier of ["A", "B", "C"]) {
          const [lo, hi] = DIFFICULTY_V3[d].tiers[tier];
          if (profile.tiers[tier] < lo || profile.tiers[tier] > hi) fails.push(`tier ${tier} ${profile.tiers[tier]}`);
        }
        if (profile.decoys < rule.minDecoys - EPS) fails.push(`look-alikes ${profile.decoys}`);
        if (fails.length) problems.push(`${id}: ${ids.join(",")} — ${fails.join("; ")}`);
      }
      perRoom[id] = {
        rounds: rows.length,
        search: { min: Number(Math.min(...p.map((x) => x.search)).toFixed(3)), mean: Number(mean(p.map((x) => x.search)).toFixed(3)), max: Number(Math.max(...p.map((x) => x.search)).toFixed(3)) },
        decoys: Number(mean(p.map((x) => x.decoys)).toFixed(3)),
        popOuts: Number(mean(p.map((x) => x.popOuts)).toFixed(3)),
        places: Number(mean(p.map((x) => x.places)).toFixed(2)),
      };
    }
    return { rule, perRoom, problems };
  };

  await check("C08", "calibration", "EASY_ROUNDS_MEET_THE_NEW_FLOOR", () => {
    const { rule, perRoom, problems } = bandFacts("easy");
    const { rounds, byId } = engine(tree);
    // the selector, the way the game calls it, never hands out anything else
    for (const id of SCENE_IDS) {
      const valid = new Set(profiled(tree, id, "easy").map((r) => r.ids.join()));
      for (const seed of seedsOf(0x0808, 2000)) {
        const ids = rounds.selectRoundTargets(byId[id], "easy", seed);
        const order = byId[id].pool.map((t) => t.id);
        if (!valid.has([...ids].sort((a, b) => order.indexOf(a) - order.indexOf(b)).join())) problems.push(`${id}: seed ${seed} drew an invalid round`);
      }
    }
    return { pass: problems.length === 0, floor: rule.minSearch, ceiling: rule.maxSearch, maxGlanceFinds: rule.maxPopOuts, perRoom, problems: problems.slice(0, 6), problemCount: problems.length };
  });

  await check("C09", "calibration", "MEDIUM_IS_MEASURABLY_ABOVE_EASY", () => {
    const easy = bandFacts("easy");
    const medium = bandFacts("medium");
    const { contract } = engine(tree);
    const problems = [...medium.problems];
    for (const id of SCENE_IDS) {
      const e = easy.perRoom[id];
      const m = medium.perRoom[id];
      if (!(m.search.min >= e.search.max)) problems.push(`${id}: a Médio round (${m.search.min}) asks less than a Fácil one (${e.search.max})`);
      if (!(m.search.mean - e.search.mean >= 0.02)) problems.push(`${id}: Médio's mean is not clearly above Fácil's`);
    }
    // and beyond the room: what the list tells and what the hints give back
    const presets = contract.DIFFICULTY_PRESETS;
    const semantic = presets.medium.listStyle === "clue" && presets.easy.listStyle === "picture";
    const weaker = !presets.medium.hintLadder.includes("reveal") && !presets.medium.hintLadder.includes("area") && presets.easy.hintLadder.includes("reveal");
    return { pass: problems.length === 0 && semantic && weaker, easy: easy.perRoom, medium: medium.perRoom, listTellsAClue: semantic, hintsGiveLessBack: weaker, problems: problems.slice(0, 6) };
  });

  await check("C10", "calibration", "HARD_IS_MEASURABLY_ABOVE_MEDIUM", () => {
    const medium = bandFacts("medium");
    const hard = bandFacts("hard");
    const { contract } = engine(tree);
    const problems = [...hard.problems];
    for (const id of SCENE_IDS) {
      const m = medium.perRoom[id];
      const h = hard.perRoom[id];
      if (!(h.search.min >= m.search.max)) problems.push(`${id}: a Difícil round (${h.search.min}) asks less than a Médio one (${m.search.max})`);
      if (!(h.search.mean - m.search.mean >= 0.05)) problems.push(`${id}: Difícil's mean is not clearly above Médio's`);
      if (!(h.decoys > m.decoys)) problems.push(`${id}: Difícil's look-alike pressure is not above Médio's`);
    }
    const presets = contract.DIFFICULTY_PRESETS;
    const rank = { direct: 1, associative: 2, indirect: 3 };
    const furtherClue = rank[presets.hard.listClue] > rank[presets.medium.listClue];
    const leastHelp = presets.hard.hintLadder.length < presets.medium.hintLadder.length && !presets.hard.reclue;
    return { pass: problems.length === 0 && furtherClue && leastHelp, medium: medium.perRoom, hard: hard.perRoom, cluesOneStepFurther: furtherClue, fewerHints: leastHelp, problems: problems.slice(0, 6) };
  });

  await check("C11", "calibration", "NO_ACCEPTED_HARD_ROUND_IS_BELOW_THE_HARD_FLOOR", () => {
    const { rule, perRoom, problems } = bandFacts("hard");
    const { rounds, byId } = engine(tree);
    const { difficulty } = calibration(tree);
    const rejectedBelow = {};
    for (const id of SCENE_IDS) {
      // the floor bites: the structural rules alone would let easier rounds through
      const below = rounds.candidateRounds(byId[id], "hard").filter((ids) => difficulty.roundProfile(byId[id], "hard", ids).search < rule.minSearch).length;
      rejectedBelow[id] = below;
      if (below === 0) problems.push(`${id}: no candidate round was below the floor — it rejects nothing`);
      // and the draw the game makes never lands under it
      for (const seed of seedsOf(0x1111, 5000)) {
        const profile = difficulty.roundProfile(byId[id], "hard", rounds.selectRoundTargets(byId[id], "hard", seed));
        if (profile.search < rule.minSearch || profile.popOuts > 0 || profile.tiers.A > 0) problems.push(`${id}: seed ${seed} drew ${profile.search.toFixed(3)}`);
      }
    }
    return { pass: problems.length === 0, floor: rule.minSearch, decoyFloor: rule.minDecoys, perRoom, candidatesRejectedBelowTheFloor: rejectedBelow, problems: problems.slice(0, 6), problemCount: problems.length };
  });

  await check("C12", "calibration", "THE_MODEL_IS_NOT_SATISFIED_BY_TARGET_COUNT", () => {
    const { byId, contract, rounds } = engine(tree);
    const { difficulty } = calibration(tree);
    const problems = [];
    const facts = {};
    for (const id of SCENE_IDS) {
      const scene = byId[id];
      // (1) the profile is per object: the same objects listed twice ask exactly as much
      const sample = profiled(tree, id, "hard").slice(0, 50);
      for (const { ids, profile } of sample) {
        const doubled = difficulty.roundProfile(scene, "hard", [...ids, ...ids]);
        if (Math.abs(doubled.search - profile.search) > EPS || Math.abs(doubled.decoys - profile.decoys) > EPS || doubled.places !== profile.places) problems.push(`${id}: doubling ${ids.join(",")} moved the profile`);
      }
      // (2) the verdict never moves with the count: any profile, any count
      for (const d of DIFFICULTIES) {
        const rule = contract.DIFFICULTY_PRESETS[d].round;
        for (const ids of rounds.candidateRounds(scene, d).slice(0, 400)) {
          const profile = difficulty.roundProfile(scene, d, ids);
          for (const count of [1, 3, 8, 40, 1000]) if (difficulty.meetsRule(rule, { ...profile, count }) !== difficulty.meetsRule(rule, profile)) problems.push(`${id}/${d}: count ${count} changed the verdict`);
        }
      }
      // (3) the room's easiest objects, however many, never make a Difícil (or even a Médio) round
      const easiest = [...scene.pool].sort((a, b) => difficulty.loadOf(scene, a.id) - difficulty.loadOf(scene, b.id));
      const many = easiest.slice(0, 12).map((t) => t.id);
      const verdicts = [5, 8, 12].map((k) => ({
        k,
        hard: difficulty.meetsRule(contract.DIFFICULTY_PRESETS.hard.round, difficulty.roundProfile(scene, "hard", many.slice(0, k))),
        medium: difficulty.meetsRule(contract.DIFFICULTY_PRESETS.medium.round, difficulty.roundProfile(scene, "medium", many.slice(0, k))),
      }));
      if (verdicts.some((v) => v.hard || v.medium)) problems.push(`${id}: a list of the easiest objects passes as Médio/Difícil`);
      facts[id] = { easiestObjects: many.slice(0, 5), verdicts };
    }
    return { pass: problems.length === 0, ...facts, problems: problems.slice(0, 6), problemCount: problems.length };
  });

  await check("C13", "calibration", "LOOKALIKE_PRESSURE_RISES_WITH_THE_DIFFICULTY", () => {
    const { byId, contract } = engine(tree);
    const problems = [];
    const perRoom = {};
    const floors = DIFFICULTIES.map((d) => contract.DIFFICULTY_PRESETS[d].round.minDecoys);
    if (!(floors[0] < floors[1] && floors[1] < floors[2])) problems.push(`the floors do not rise: ${floors.join(" / ")}`);
    for (const id of SCENE_IDS) {
      const means = DIFFICULTIES.map((d) => mean(profiled(tree, id, d).map((r) => r.profile.decoys)));
      const mins = DIFFICULTIES.map((d) => Math.min(...profiled(tree, id, d).map((r) => r.profile.decoys)));
      if (!(means[0] <= means[1] && means[1] < means[2])) problems.push(`${id}: look-alike pressure ${means.map((m) => m.toFixed(2)).join(" / ")}`);
      DIFFICULTIES.forEach((d, i) => {
        if (mins[i] < floors[i] - EPS) problems.push(`${id}/${d}: a round under its floor`);
      });
      // more look-alikes painted than the base's art had, each a fair one (C14, C15 hold them)
      const baseCount = BASE_TREE.exists(FILES.scenes) ? engine(BASE_TREE).byId[id].lookAlikes.length : 0;
      if (!(byId[id].lookAlikes.length > baseCount)) problems.push(`${id}: no new look-alike`);
      perRoom[id] = { lookAlikes: `${baseCount} → ${byId[id].lookAlikes.length}`, perObjectByDifficulty: means.map((m) => Number(m.toFixed(3))), minimum: mins.map((m) => Number(m.toFixed(3))) };
    }
    return { pass: problems.length === 0, floors, perRoom, problems };
  });

  // --- what must hold whatever the calibration did ------------------------------------------------------

  await check("C14", "preserved", "ART_FAIRNESS_FLOORS_REMAIN_INTACT", () => {
    const { scenes, model, camera: cam, contract } = engine(tree);
    const problems = [];
    const audits = {};
    for (const scene of scenes) {
      const p = (message) => problems.push(`${scene.id}: ${message}`);
      const { kit, file, audit } = auditOf(tree, scene);
      const plate = scene.layers.find((l) => l.id === "plate");
      if (!audit) {
        p(`no audit at ${file}`);
        continue;
      }
      if (audit.plateSha256 !== sha256(readBinary(tree, `public${plate.src}`))) p("audit is stale (the plate changed after it)");
      const rows = Object.fromEntries(audit.targets.map((row) => [row.id, row]));
      for (const t of scene.pool) {
        const row = rows[t.id];
        if (!row) p(`${t.id} not audited`);
        else {
          if (row.tier !== t.tier) p(`${t.id} audited as ${row.tier}`);
          if (row.visible < VISIBLE_FLOOR[t.tier]) p(`${t.id} ${(row.visible * 100).toFixed(0)}% visible`);
          if (row.edge < EDGE_FLOOR) p(`${t.id} edge ${row.edge}:1`);
          if (!same(sorted(row.lookAlikes ?? []), sorted(scene.lookAlikes.filter((l) => l.resembles === t.id).map((l) => l.id)))) p(`${t.id} audited with other look-alikes`);
        }
      }
      const tierMean = (tier) => mean(scene.pool.filter((t) => t.tier === tier && rows[t.id]).map((t) => rows[t.id].visible));
      if (!(tierMean("C") < tierMean("B") && tierMean("B") < tierMean("A"))) p(`tiers are not ordered by cover (A ${tierMean("A").toFixed(2)} B ${tierMean("B").toFixed(2)} C ${tierMean("C").toFixed(2)})`);
      // geometry: safe margins, gaps, look-alike clearance, the foreground's paint
      const W = scene.width;
      const H = scene.height;
      for (const r of [...scene.pool, ...scene.lookAlikes]) {
        const b = model.regionBounds(r.region);
        if (b.x < contract.SAFE_MARGIN_X || b.y < contract.SAFE_MARGIN_Y || b.x + b.w > W - contract.SAFE_MARGIN_X || b.y + b.h > H - contract.SAFE_MARGIN_Y) p(`${r.id} outside the safe area`);
        const c = model.regionCenter(r.region);
        const station = scene.stations.find((s) => c.x >= s.span.x0 && c.x < s.span.x1)?.id;
        const want = "resembles" in r ? scene.pool.find((t) => t.id === r.resembles)?.station : r.station;
        if (station !== want) p(`${r.id} is not in ${want}`);
      }
      for (let i = 0; i < scene.pool.length; i += 1) {
        for (let j = i + 1; j < scene.pool.length; j += 1) if (regionGap(model, scene.pool[i].region, scene.pool[j].region) < MIN_TARGET_GAP_SU) p(`${scene.pool[i].id}/${scene.pool[j].id} closer than ${MIN_TARGET_GAP_SU} su`);
      }
      for (const l of scene.lookAlikes) {
        for (const t of scene.pool) if (regionGap(model, l.region, t.region) < LOOKALIKE_CLEARANCE_SU) p(`look-alike ${l.id} within ${LOOKALIKE_CLEARANCE_SU} su of ${t.id}`);
      }
      for (let i = 0; i < scene.lookAlikes.length; i += 1) {
        for (let j = i + 1; j < scene.lookAlikes.length; j += 1) if (regionGap(model, scene.lookAlikes[i].region, scene.lookAlikes[j].region) <= 0) p(`${scene.lookAlikes[i].id}/${scene.lookAlikes[j].id} overlap`);
      }
      const plateIndex = scene.layers.findIndex((l) => l.id === "plate");
      for (const layer of scene.layers.slice(plateIndex + 1)) {
        const drift = cam.maxParallaxOffset(scene, layer.parallax);
        for (const paint of layer.opaque) {
          const grown = { x: paint.x - drift.x - FRONT_CLEARANCE_SU, y: paint.y - drift.y - FRONT_CLEARANCE_SU, w: paint.w + 2 * (drift.x + FRONT_CLEARANCE_SU), h: paint.h + 2 * (drift.y + FRONT_CLEARANCE_SU) };
          for (const r of [...scene.pool, ...scene.lookAlikes]) if (intersects(grown, model.regionBounds(r.region))) p(`${layer.id} can cover ${r.id}`);
        }
      }
      audits[scene.id] = `${kit}: ${scene.pool.length} objects, lowest visible ${Math.min(...audit.targets.map((r) => r.visible))}, lowest edge ${Math.min(...audit.targets.map((r) => r.edge))}`;
    }
    return { pass: problems.length === 0, audits, floors: { visible: VISIBLE_FLOOR, edge: EDGE_FLOOR }, problems: problems.slice(0, 10), problemCount: problems.length };
  });

  await check("C15", "preserved", "NO_ACCESSIBILITY_HIT_AREA_REGRESSION", () => {
    const { scenes, model, camera: cam, contract } = engine(tree);
    const problems = [];
    const tolerances = Object.fromEntries(DIFFICULTIES.map((d) => [d, contract.DIFFICULTY_PRESETS[d].tolerancePx]));
    if (!same(tolerances, Object.fromEntries(DIFFICULTIES.map((d) => [d, DIFFICULTY_V3[d].tolerancePx])))) problems.push(`tolerances ${JSON.stringify(tolerances)}`);
    let smallest = Infinity;
    for (const scene of scenes) {
      for (const t of scene.pool) {
        const b = model.regionBounds(t.region);
        smallest = Math.min(smallest, Math.min(b.w, b.h));
        const cover = cam.coverScale(scene, REFERENCE_PHONE);
        if (Math.max(b.w, b.h) * cover < MIN_VISIBLE_AT_COVER_PX) problems.push(`${scene.id}/${t.id}: ${(Math.max(b.w, b.h) * cover).toFixed(1)} px at cover on the phone`);
        for (const viewport of VIEWPORTS) {
          const top = cam.coverScale(scene, viewport) * cam.maxZoom(scene, viewport);
          const reach = Math.min(...DIFFICULTIES.map((d) => tolerances[d].touch));
          if (Math.min(b.w, b.h) * top + 2 * reach < MIN_EFFECTIVE_TOUCH_PX) problems.push(`${scene.id}/${t.id}: ${(Math.min(b.w, b.h) * top + 2 * reach).toFixed(1)} px at full zoom (${viewport.name})`);
          // every object can be framed whole, clear of the HUD
          const camera = cam.revealCamera(scene, b, viewport);
          const a = cam.sceneToViewport(scene, { x: b.x, y: b.y }, camera, viewport);
          const z = cam.sceneToViewport(scene, { x: b.x + b.w, y: b.y + b.h }, camera, viewport);
          const screen = { x: a.x, y: a.y, w: z.x - a.x, h: z.y - a.y };
          if (screen.x < -1e-6 || screen.y < -1e-6 || screen.x + screen.w > viewport.width + 1e-6 || screen.y + screen.h > viewport.height + 1e-6) problems.push(`${scene.id}/${t.id} off screen (${viewport.name})`);
          for (const hud of hudRects(viewport)) if (intersects(screen, hud)) problems.push(`${scene.id}/${t.id} under the ${hud.name} (${viewport.name})`);
        }
      }
      // a tap on a look-alike's centre never finds anything, with every difficulty's touch reach
      const everyId = scene.pool.map((t) => t.id);
      for (const d of DIFFICULTIES) {
        for (const l of scene.lookAlikes) {
          const hit = model.hitTest(scene, model.regionCenter(l.region), everyId, LOOKALIKE_TAP_SCALE, model.tolerancePxFor(d, "touch"));
          if (hit !== null) problems.push(`${scene.id}/${d}: tapping ${l.id} finds ${hit}`);
        }
      }
    }
    return { pass: problems.length === 0, tolerances, smallestSideSu: smallest, problems: problems.slice(0, 8), problemCount: problems.length };
  });

  await check("C16", "preserved", "NO_EXACT_REVEAL_IN_MEDIUM_OR_HARD", async () => {
    const { byId, model, rounds } = engine(tree);
    const problems = [];
    for (const d of ["medium", "hard"]) {
      if (model.revealsExactly(d) !== false) problems.push(`${d}: revealsExactly`);
      for (const id of SCENE_IDS) {
        const scene = byId[id];
        for (const targetId of new Set(rounds.validRounds(scene, d).flat())) {
          const t = model.targetById(scene, targetId);
          const c = model.regionCenter(t.region);
          for (let stage = 0; stage <= 4; stage += 1) {
            if (model.hintRung(d, stage) === "reveal") problems.push(`${id}/${d}/${targetId}: a reveal rung`);
            const halo = model.hintHalo(scene, targetId, d, stage);
            if (halo && Math.hypot(halo.cx - c.x, halo.cy - c.y) < 1) problems.push(`${id}/${d}/${targetId}: a halo on the object at ${stage}`);
            if (model.hintCameraMove(scene, targetId, d, stage)?.kind === "frame") problems.push(`${id}/${d}/${targetId}: the camera frames it at ${stage}`);
          }
        }
      }
    }
    // the real game: every press, in both rooms, for the first two lines of a round
    for (const id of SCENE_IDS) {
      for (const d of ["medium", "hard"]) {
        const game = await startIn(tree, id, d, 0x1616 + d.length);
        for (const targetId of game.listed().slice(0, 2)) {
          game.focus(targetId);
          const bounds = model.regionBounds(model.targetById(game.scene(), targetId).region);
          for (let press = 1; press <= 5; press += 1) {
            game.hint();
            if (game.revealHalo()) problems.push(`${id}/${d}/${targetId}: a reveal halo at press ${press}`);
            if (/Aqui está/.test(game.banner() ?? "")) problems.push(`${id}/${d}/${targetId}: "Aqui está" at press ${press}`);
            if (/Mostrar/.test(game.hintLabel() ?? "")) problems.push(`${id}/${d}/${targetId}: offers "Mostrar" at press ${press}`);
            if (nearCamera(game.camera(), game.cam.revealCamera(game.scene(), bounds, game.size()), 1e-3)) problems.push(`${id}/${d}/${targetId}: framed at press ${press}`);
          }
        }
        game.unmount();
      }
    }
    return { pass: problems.length === 0, problems: problems.slice(0, 8), problemCount: problems.length };
  });

  await check("C17", "preserved", "HARD_NEVER_NAMES_A_TARGET_BEFORE_DISCOVERY", async () => {
    const problems = [];
    const shown = {};
    for (const id of SCENE_IDS) {
      const game = await startIn(tree, id, "hard", 0x1717);
      const scene = game.scene();
      const names = (targetId) => {
        const t = scene.pool.find((candidate) => candidate.id === targetId);
        return [normalizeText(t.label), normalizeText(t.accessibleLabel)];
      };
      const says = (text, targetId) => names(targetId).some((name) => normalizeText(text ?? "").includes(name));
      const pending = () => game.items().filter((item) => !item.found);
      const audit = (moment) => {
        for (const item of pending()) {
          if (says(item.text, item.id) || says(item.aria, item.id)) problems.push(`${id}: ${moment} — the line of ${item.id} names it`);
          if (item.hasArt) problems.push(`${id}: ${moment} — ${item.id} pictured before it is found`);
          for (const other of pending()) if (other.id !== item.id && says(item.text, other.id)) problems.push(`${id}: ${moment} — ${item.id}'s line names ${other.id}`);
        }
      };
      audit("the list");
      const ids = game.listed();
      for (const targetId of ids.slice(0, 4)) {
        game.focus(targetId);
        if (says(game.hintLabel(), targetId)) problems.push(`${id}: the Pista button names ${targetId}`);
        for (let press = 1; press <= 3; press += 1) {
          game.hint();
          if (says(game.banner(), targetId)) problems.push(`${id}: a hint names ${targetId}`);
          if (says(game.live(), targetId)) problems.push(`${id}: the live region names ${targetId}`);
        }
      }
      audit("after every hint");
      game.find(ids[0]);
      const found = game.items().find((item) => item.id === ids[0]);
      const label = scene.pool.find((t) => t.id === ids[0]).label;
      if (!found.found || !found.text.startsWith(label)) problems.push(`${id}: a find does not say the name`);
      audit("after a find");
      shown[id] = game.texts().slice(0, 3);
      game.unmount();
    }
    return { pass: problems.length === 0, problems: problems.slice(0, 8), shown };
  });

  await check("C18", "calibration", "BOTH_ROOMS_SATISFY_DIFFICULTY_V3", async () => {
    const { scenes, contract, rounds } = engine(tree);
    const { difficulty } = calibration(tree);
    const problems = [];
    if (!same(scenes.map((s) => s.id), SCENE_IDS)) problems.push(`rooms ${scenes.map((s) => s.id).join(",")}`);
    const perRoom = {};
    for (const scene of scenes) {
      if (["presets", "difficulty", "round", "rules", "floors"].some((key) => key in scene)) problems.push(`${scene.id} brings its own difficulty`);
      perRoom[scene.id] = {};
      for (const d of DIFFICULTIES) {
        const rule = contract.DIFFICULTY_PRESETS[d].round;
        const valid = rounds.validRounds(scene, d);
        const offRule = valid.filter((ids) => !difficulty.meetsRule(rule, difficulty.roundProfile(scene, d, ids)));
        if (valid.length < MIN_ROUNDS) problems.push(`${scene.id}/${d}: ${valid.length} rounds`);
        if (offRule.length) problems.push(`${scene.id}/${d}: ${offRule.length} rounds off the global rule`);
        perRoom[scene.id][d] = valid.length;
      }
      // the room's loads come from its own measurements
      const unmeasured = scene.pool.filter((t) => !t.measured || !(t.measured.visible > 0) || !(t.measured.edge > 0) || !(t.measured.clutter >= 0)).map((t) => t.id);
      if (unmeasured.length) problems.push(`${scene.id}: unmeasured ${unmeasured.join(",")}`);
    }
    // both rooms play a Difícil round to the end through the real game, from its clue list
    const played = {};
    for (const id of SCENE_IDS) {
      const game = await startIn(tree, id, "hard", 0x1818);
      const listIsClues = game.items().every((item) => !item.hasArt && item.text.length > 0);
      const result = game.finish();
      played[id] = { listIsClues, completed: result?.details.completed === true && result.details.sceneId === id };
      game.unmount();
    }
    return { pass: problems.length === 0 && Object.values(played).every((p) => p.listIsClues && p.completed), roundsPerRoom: perRoom, played, problems: problems.slice(0, 6) };
  });

  await check("C19", "preserved", "OLD_RESULTS_REMAIN_READABLE", async () => {
    const t = platformTables(tree);
    const env = createEnvironment({ storage: { [STORAGE_KEY]: JSON.stringify(OLD_RESULTS) } });
    const storage = createModuleGraph({ tree, mocks: {}, globals: env.globals }).require(FILES.storage);
    const readBack = storage.getRecentResults();
    // a result played now, saved beside them
    const game = await startIn(tree, OBSERVATORY_ID, "medium", 0x1919);
    const result = game.finish();
    game.unmount();
    const saved = storage.saveGameResult(result);
    const after = storage.getRecentResults();
    const presentation = t.rewards.getResultPresentation({ gameId: GAME });
    const shown = (r) => t.labels.formatResultDetails(r.details, presentation);
    const facts = {
      readBackAsSaved: same(readBack, OLD_RESULTS),
      keptAfterANewSave: after[0]?.id === saved.id && same(after.slice(1), OLD_RESULTS),
      oldGame03ResultsShowTheirMode: OLD_RESULTS.slice(0, 3).every((r) => same(shown(r), [{ key: "difficulty", label: "Modo", value: { easy: "Fácil", medium: "Médio", hard: "Difícil" }[r.details.difficulty] }])),
      oldGame03ResultsKeepTheirTitle: OLD_RESULTS.slice(0, 3).every((r) => t.rewards.getRewardCopy(r).title === "Estúdio explorado"),
      theTrilhaResultStillReads: Array.isArray(shown(OLD_RESULTS[3])) && t.rewards.getRewardCopy(OLD_RESULTS[3]).title !== "Estúdio explorado",
      aNewResultHasTheSameShape: same(sorted(Object.keys(result.details)), RESULT_DETAIL_KEYS) && result.gameId === GAME && result.score === result.details.foundObjects,
    };
    return { pass: Object.values(facts).every(Boolean), ...facts, newDetails: result.details };
  });

  await check("C20", "preserved", "NO_TIMER_SCORE_LIVES_OR_RANKING", async () => {
    const files = listFiles(tree, DIR).filter((file) => /\.(ts|tsx)$/.test(file));
    const pressure = files.filter((file) => /setInterval|Date\.now|new Date\(|countdown|timeLeft|\blives\b|\bvidas\b|\bstreak|\branking|leaderboard|\bpenalt/i.test(codeOnly(tree.read(file))));
    const { byId, model } = engine(tree);
    const R = model.sessionReducer;
    const play = (hints, misses) => {
      let s = R(R(model.createSession(byId[STUDIO_ID]), { type: "select-difficulty", difficulty: "hard" }), { type: "start", seed: 2020 });
      for (let i = 0; i < misses; i += 1) s = R(s, { type: "tap", point: { x: 3, y: 3 }, scale: 1, pointerType: "touch" });
      for (const id of [...s.targets]) {
        s = R(s, { type: "focus-target", targetId: id });
        for (let i = 0; i < hints; i += 1) s = R(s, { type: "hint" });
        s = R(s, { type: "tap", point: model.regionCenter(model.targetById(byId[STUDIO_ID], id).region), scale: 1, pointerType: "mouse" });
      }
      return model.buildHiddenObjectsResult(s);
    };
    const plainResult = play(0, 0);
    const helped = play(5, 30);
    const keys = [...Object.keys(helped), ...Object.keys(helped.details), ...Object.keys(model.createSession(byId[STUDIO_ID]))];
    const raceKeys = keys.filter((key) => /time|elapsed|clock|countdown|deadline|rank|best|streak|lives|points|bonus|penalt|star/i.test(key));
    return {
      pass: pressure.length === 0 && same(plainResult, helped) && raceKeys.length === 0 && helped.score === helped.details.foundObjects,
      sourcesWithPressure: pressure,
      hintsAndMissesChangeNothing: same(plainResult, helped),
      raceKeys,
    };
  });

  // --- where the numbers come from, and what Difficulty V3 says ----------------------------------------

  await check("C21", "calibration", "THE_FLOORS_ARE_DERIVED_FROM_THE_BASE", async () => {
    const { contract } = engine(tree);
    const { difficulty } = calibration(tree);
    const reference = await deriveReference(BASE_TREE, difficulty);
    const product = {
      ruler: { edge: difficulty.SEARCH_RULER.edge, clutter: difficulty.SEARCH_RULER.clutter, side: difficulty.SEARCH_RULER.side },
      popOut: difficulty.POP_OUT_BELOW,
      floors: contract.ROUND_FLOORS,
      decoyFloors: contract.DECOY_FLOORS,
    };
    const derived = { ruler: reference.ruler, popOut: reference.popOut, floors: reference.floors, decoyFloors: reference.decoyFloors };
    // the presets read those floors, and each band ends where the next begins
    const presets = contract.DIFFICULTY_PRESETS;
    const wired =
      DIFFICULTIES.every((d) => presets[d].round.minSearch === contract.ROUND_FLOORS[d] && presets[d].round.minDecoys === contract.DECOY_FLOORS[d]) &&
      presets.easy.round.maxSearch === contract.ROUND_FLOORS.medium && presets.medium.round.maxSearch === contract.ROUND_FLOORS.hard && presets.hard.round.maxSearch === Infinity;
    const v2 = Object.fromEntries(DIFFICULTIES.map((d) => [d, reference.v2[d].reduce((n, r) => n + r.rounds.length, 0)]));
    return { pass: same(product, derived) && wired, derived, product: same(product, derived) ? "equal" : product, bandsWired: wired, v2RoundsMeasured: v2 };
  });

  await check("C22", "calibration", "THE_MEASURED_INPUTS_ARE_THE_AUDITS", async () => {
    const { scenes } = engine(tree);
    const problems = [];
    for (const scene of scenes) {
      const { audit, file } = auditOf(tree, scene);
      if (!audit) {
        problems.push(`${scene.id}: no audit at ${file}`);
        continue;
      }
      const rows = Object.fromEntries(audit.targets.map((row) => [row.id, row]));
      const composed = await composeShipped(scene, (publicPath) => readBinary(tree, publicPath));
      for (const t of scene.pool) {
        const row = rows[t.id];
        const measured = t.measured ?? {};
        if (!row) problems.push(`${scene.id}/${t.id}: not in the audit`);
        else if (measured.visible !== row.visible || measured.edge !== row.edge || measured.clutter !== row.clutter) problems.push(`${scene.id}/${t.id}: measured ${JSON.stringify(measured)} is not the audit's`);
        const now = measureClutter(composed, scene.width, scene.height, t.region);
        if (measured.clutter !== now) problems.push(`${scene.id}/${t.id}: clutter ${measured.clutter} recorded, ${now} on the shipped art`);
      }
    }
    return { pass: problems.length === 0, problems: problems.slice(0, 8), problemCount: problems.length };
  });

  await check("C23", "calibration", "DIFFICULTY_V3_TELLS_WHAT_IT_SAYS", async () => {
    const { contract, byId, model } = engine(tree);
    const wrong = {};
    for (const d of DIFFICULTIES) {
      const p = contract.DIFFICULTY_PRESETS[d];
      const actual = { label: p.label, count: p.count, listStyle: p.listStyle, listClue: p.listClue ?? null, hintLadder: [...p.hintLadder], reclue: p.reclue ?? null, tolerancePx: p.tolerancePx, tiers: p.round?.tiers, maxPopOuts: p.round?.maxPopOuts };
      if (!same(actual, DIFFICULTY_V3[d])) wrong[d] = actual;
    }
    // the real game, in both rooms: what the list shows and what each press of Pista says
    const games = {};
    for (const id of SCENE_IDS) {
      const scene = byId[id];
      const easy = await startIn(tree, id, "easy", 0x2323);
      const easyItems = easy.items();
      games[`${id}/easy`] = easyItems.every((item) => item.hasArt && item.text === scene.pool.find((t) => t.id === item.id).label);
      easy.unmount();
      const medium = await startIn(tree, id, "medium", 0x2324);
      const { clues } = calibration(tree);
      const ids = medium.listed();
      const choice = clues.selectRoundClues(scene, "medium", 0x2324, ids);
      const t = scene.pool.find((candidate) => candidate.id === ids[0]);
      medium.focus(ids[0]);
      const banners = [];
      const halos = [];
      for (let press = 1; press <= 3; press += 1) {
        medium.hint();
        banners.push(medium.banner());
        halos.push(Boolean(medium.halo()));
      }
      const station = scene.stations.find((s) => s.id === t.station);
      games[`${id}/medium`] =
        medium.items().every((item) => !item.hasArt && clues.clueAt(scene.pool.find((x) => x.id === item.id), choice[item.id].list)?.level === "associative") &&
        banners[0] === `Pista: procure ${station.hintPhrase}.` &&
        banners[1] === `Pista: em outras palavras — ${clues.clueAt(t, choice[ids[0]].reclue).text}` &&
        clues.clueAt(t, choice[ids[0]].reclue).level === "direct" &&
        banners[2] === `Pista: olhe ${t.hintDirection}.` &&
        halos.every((lit) => !lit);
      medium.unmount();
      const hard = await startIn(tree, id, "hard", 0x2325);
      const hardIds = hard.listed();
      const hardChoice = clues.selectRoundClues(scene, "hard", 0x2325, hardIds);
      games[`${id}/hard`] = hard.items().every((item) => !item.hasArt && clues.clueAt(scene.pool.find((x) => x.id === item.id), hardChoice[item.id].list)?.level === "indirect");
      hard.unmount();
    }
    void model;
    return { pass: Object.keys(wrong).length === 0 && Object.values(games).every(Boolean), wrong, games };
  });

  await check("C24", "preserved", "NO_OBJECT_IS_ASKED_IN_EVERY_ROUND", () => {
    // Every valid round is equally likely, so an object's share of the valid rounds is how often a replay asks for it.
    // A round rule that only a few objects can satisfy (a look-alike floor that only they reach, a band only they fit)
    // would make them fixtures of every replay: none may be, and none a difficulty can list may be starved.
    const { rounds, byId } = engine(tree);
    const problems = [];
    const perRoom = {};
    for (const id of SCENE_IDS) {
      perRoom[id] = {};
      for (const d of DIFFICULTIES) {
        const valid = rounds.validRounds(byId[id], d);
        const share = new Map();
        for (const round of valid) for (const target of round) share.set(target, (share.get(target) ?? 0) + 1 / valid.length);
        const rows = [...share].sort((a, b) => a[1] - b[1]);
        for (const [target, p] of rows) {
          if (p > EXPOSURE.ceiling) problems.push(`${id}/${d}: ${target} in ${(p * 100).toFixed(0)}% of the rounds`);
          if (p < EXPOSURE.floor) problems.push(`${id}/${d}: ${target} in ${(p * 100).toFixed(1)}% of the rounds`);
        }
        perRoom[id][d] = { listable: rows.length, least: `${rows[0][0]} ${(rows[0][1] * 100).toFixed(1)}%`, most: `${rows.at(-1)[0]} ${(rows.at(-1)[1] * 100).toFixed(1)}%` };
      }
    }
    return { pass: problems.length === 0, exposure: EXPOSURE, perRoom, problems: problems.slice(0, 8), problemCount: problems.length };
  });

  // --- preserved: the rest of the game as MULTISCENE-03 left it -------------------------------------------

  await check("P01", "preserved", "THE_SHARED_PLATFORM_IS_UNTOUCHED", () => {
    const changed = folderDiff(tree, BASE_TREE, "src").filter((file) => !file.startsWith(DIR));
    const fields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
    const mine = JSON.parse(tree.read("package.json"));
    const base = JSON.parse(BASE_TREE.read("package.json"));
    const depsChanged = fields.filter((field) => !same(mine[field] ?? {}, base[field] ?? {}));
    const lockfileUnchanged = tree.read("package-lock.json") === BASE_TREE.read("package-lock.json");
    return { pass: changed.length === 0 && depsChanged.length === 0 && lockfileUnchanged, changedOutsideGame03: changed, depsChanged, lockfileUnchanged };
  });

  await check("P02", "preserved", "ONE_ENGINE_PLAYS_EVERY_ROOM", () => {
    const { scenes } = engine(tree);
    const names = new Set();
    for (const scene of scenes) {
      names.add(scene.id);
      for (const s of scene.stations) names.add(s.id);
      for (const t of scene.pool) names.add(t.id);
    }
    const named = [];
    for (const file of [...ENGINE_FILES, ...(tree.exists(CLUES_FILE) ? [CLUES_FILE, DIFFICULTY_FILE] : [])]) {
      const code = codeOnly(tree.read(file));
      for (const name of names) if (new RegExp(`["'\`/]${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\`/]`).test(code)) named.push(`${file.replace(DIR, "")}: ${name}`);
    }
    return { pass: named.length === 0, engineNamesARoom: named.slice(0, 8) };
  });

  await check("P03", "preserved", "THE_ROOMS_KEEP_THEIR_PLACES", () => {
    // every object, look-alike and station the base had is where it was: the calibration only adds
    const mine = engine(tree);
    const base = engine(BASE_TREE);
    const problems = [];
    for (const id of SCENE_IDS) {
      const a = mine.byId[id];
      const b = base.byId[id];
      if (a.width !== b.width || a.height !== b.height || !same(a.stations, b.stations) || a.initialStation !== b.initialStation) problems.push(`${id}: the room's frame moved`);
      for (const t of b.pool) {
        const now = a.pool.find((x) => x.id === t.id);
        if (!now) problems.push(`${id}/${t.id}: gone`);
        else if (!same(now.region, t.region) || now.station !== t.station || now.tier !== t.tier || now.label !== t.label) problems.push(`${id}/${t.id}: moved, renamed or re-tiered`);
      }
      for (const l of b.lookAlikes) {
        const now = a.lookAlikes.find((x) => x.id === l.id);
        if (!now || !same(now.region, l.region) || now.resembles !== l.resembles) problems.push(`${id}/${l.id}: look-alike moved`);
      }
      const geometry = (layers) => layers.map((l) => ({ id: l.id, rect: l.rect, parallax: l.parallax, opaque: l.opaque }));
      if (!same(geometry(a.layers), geometry(b.layers))) problems.push(`${id}: the layers' geometry moved`);
    }
    return { pass: problems.length === 0, problems: problems.slice(0, 8) };
  });

  await check("P04", "preserved", "THE_CAMERA_AND_GESTURES_ARE_UNTOUCHED", () => {
    const changed = CAMERA_FILES.filter((file) => tree.read(file) !== BASE_TREE.read(file));
    return { pass: changed.length === 0, changed };
  });

  return results;
}

// --- mutants: in-memory overrides of today's tree, each of which some check must catch ----------------

const MUTANTS = [
  {
    name: "the clue is always the same variant",
    files: { [CLUES_FILE]: [["  return options[Math.floor(drawFor(seed, `${target.id}:${purpose}:${level}`) * options.length)];", "  return options[0];"]] },
    mustFail: ["C06"],
  },
  {
    name: "the clues are drawn again on every render",
    files: {
      [FILES.game]: [
        ['import "@/games/hidden-objects/hidden-objects.css";', 'import "@/games/hidden-objects/hidden-objects.css";\nimport { selectRoundClues } from "@/games/hidden-objects/hidden-objects-clues";'],
        ["              const entry = listEntryFor(state, id);", "              const entry = listEntryFor({ ...state, clues: selectRoundClues(scene, state.difficulty, freshRoundSeed(), listed) }, id);"],
      ],
    },
    mustFail: ["C04", "C07"],
  },
  {
    name: "the difficulty is ignored: every difficulty draws by Fácil's rule",
    files: { [FILES.rounds]: [["    const rule = DIFFICULTY_PRESETS[difficulty].round;", "    const rule = DIFFICULTY_PRESETS.easy.round;"]] },
    mustFail: ["C09", "C10", "C11"],
  },
  {
    name: "Difícil accepts trivial rounds",
    files: { [FILES.scene]: [["round: { tiers: { A: [0, 0], B: [0, 4], C: [4, 8] }, maxPopOuts: 0, minSearch: ROUND_FLOORS.hard,", "round: { tiers: { A: [0, 8], B: [0, 8], C: [0, 8] }, maxPopOuts: 8, minSearch: 0,"]] },
    mustFail: ["C11", "C10"],
  },
  {
    name: "the number of objects alone decides the difficulty",
    files: { [DIFFICULTY_FILE]: [["    profile.search >= rule.minSearch &&\n    profile.search < rule.maxSearch &&", "    (profile.search * profile.count) / 6 >= rule.minSearch &&\n    (profile.search * profile.count) / 6 < rule.maxSearch &&"]] },
    mustFail: ["C12"],
  },
  {
    name: "Médio gets the exact reveal",
    files: { [FILES.scene]: [['    hintLadder: ["station", "reclue", "direction"],', '    hintLadder: ["station", "reclue", "reveal"],']] },
    mustFail: ["C16"],
  },
  {
    name: "Difícil lists the direct clue",
    files: { [FILES.scene]: [['    listClue: "indirect",', '    listClue: "direct",']] },
    mustFail: ["C03", "C23"],
  },
  {
    name: "Difícil names the objects before they are found",
    files: { [FILES.model]: [["    return { id, found, text: clue, answered: null, art: null, accessibleText: `${clue} Procurar.` };", "    return { id, found, text: `${target.label}: ${clue}`, answered: null, art: null, accessibleText: `${target.accessibleLabel}: procurar` };"]] },
    mustFail: ["C17"],
  },
  {
    name: "look-alike pressure is ignored",
    files: { [DIFFICULTY_FILE]: [["    profile.search < rule.maxSearch &&\n    profile.decoys >= rule.minDecoys", "    profile.search < rule.maxSearch"]] },
    mustFail: ["C13"],
  },
  {
    name: "one room bypasses the calibration",
    files: {
      [FILES.rounds]: [
        [
          "    rounds = candidateRounds(scene, difficulty).filter((round) => meetsRule(rule, roundProfile(scene, difficulty, round)));",
          '    rounds = candidateRounds(scene, difficulty).filter((round) => scene.id === "explorer-observatory" || meetsRule(rule, roundProfile(scene, difficulty, round)));',
        ],
      ],
    },
    mustFail: ["C18", "P02"],
  },
  {
    name: "an art threshold is weakened so a target passes (the ruler's fairness anchor)",
    files: { [DIFFICULTY_FILE]: [["  edge: { pops: 2.96, blends: 1.3 },", "  edge: { pops: 2.96, blends: 1.0 },"]] },
    mustFail: ["C21"],
  },
  {
    name: "a measurement is recorded better than the art's audit (the padlock's edge)",
    files: (worktree) => {
      const file = FILES.observatoryScene;
      const text = worktree.read(file);
      const start = text.indexOf('    id: "cadeado",');
      const line = text.slice(start).match(/    measured: \{ visible: [\d.]+, edge: [\d.]+, clutter: [\d.]+ \},/)[0];
      return { [file]: [[line, line.replace(/edge: [\d.]+/, "edge: 2.6")]] };
    },
    mustFail: ["C22"],
  },
  {
    name: "a target's fairness drops under the floor",
    files: (worktree) => {
      const file = `docs/archive/hidden-objects/${STUDIO_ID}/review/v2/fairness.json`;
      const audit = JSON.parse(worktree.read(file));
      const row = audit.targets.find((r) => r.id === "gaita");
      return { [file]: [[`"id": "gaita",\n      "tier": "C",\n      "visible": ${row.visible},\n      "contrast": ${row.contrast},\n      "edge": ${row.edge},`, `"id": "gaita",\n      "tier": "C",\n      "visible": ${row.visible},\n      "contrast": ${row.contrast},\n      "edge": 1.21,`]] };
    },
    mustFail: ["C14"],
  },
  {
    name: "Difícil's look-alike floor only a few objects reach (the same objects in every replay)",
    files: { [FILES.scene]: [["{ easy: 0.75, medium: 0.794, hard: 1.25 };", "{ easy: 0.75, medium: 0.794, hard: 1.5 };"]] },
    mustFail: ["C24", "C21"],
  },
  {
    name: "a clue names its object",
    files: { [FILES.observatoryScene]: [['{ level: "indirect", text: "Galopa no fundo do mar sem nunca usar sela." }', '{ level: "indirect", text: "Um cavalo-marinho galopa sem usar sela." }']] },
    mustFail: ["C03"],
  },
  {
    name: "a clue is said twice",
    files: { [FILES.studioScene]: [['{ level: "associative", text: "Gira dentro da fechadura." }', '{ level: "associative", text: "Abre o que está bem trancado." }']] },
    mustFail: ["C02"],
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
  const contract = results.filter((r) => r.tag === "calibration");
  const kept = results.filter((r) => r.tag !== "calibration");
  const held = contract.every((r) => !r.pass) && kept.every((r) => r.pass);
  ok &&= held;
  console.log(`${held ? "CAUGHT" : "MISSED"}  base ${BASE.slice(0, 8)} — GAME03-MULTISCENE-03's final state: one static clue, Difficulty V2, art kit v1`);
  console.log(`        [calibration] failing: ${contract.filter((r) => !r.pass).length}/${contract.length}`);
  console.log(`        [preserved] holding: ${kept.filter((r) => r.pass).length}/${kept.length}`);
  for (const r of results.filter((x) => (x.tag === "calibration" && x.pass) || (x.tag !== "calibration" && !x.pass))) {
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
  console.log(ok ? "HIDDEN_OBJECTS_CALIBRATION_COUNTERFACTUALS_HOLD" : "HIDDEN_OBJECTS_CALIBRATION_COUNTERFACTUALS_BROKEN");
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
    ` (${results.filter((r) => r.tag === "calibration").length} calibration, ${results.filter((r) => r.tag === "preserved").length} preserved)` +
    `${failing.length ? ` · failing: ${failing.join(", ")}` : ""}`,
);
console.log(failing.length ? "HIDDEN_OBJECTS_CALIBRATION_FAILED" : "HIDDEN_OBJECTS_CALIBRATION_OK");
process.exit(failing.length ? EXIT_VALIDATION_FAILED : EXIT_OK);
