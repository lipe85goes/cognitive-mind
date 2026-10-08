/**
 * GAME03-EXPERIENCE-02 — the Estúdio das Descobertas after its first human
 * playtest, checked from source: the same scene, with difficulty that changes
 * what the Explorador is TOLD (lists, hints), a semantic Difícil, look-alikes,
 * a lit and integrated art kit (v1), a HUD that leaves the room the stage, the
 * found feedback, and the result screen's per-game presentation.
 *
 * Everything runs the REAL code from source through the shared harness
 * (hidden-objects-harness.mjs): the pure modules, the scene controller on a fake
 * viewport under a virtual clock, the real HiddenObjectsGame under a small
 * React (every gesture is a Pointer Event on the viewport), the platform
 * tables, and the art kit and its measured fairness audit on disk.
 *
 * [experience] checks are what this mission introduced: they FAIL on its base
 * (87f30d3 — the skeleton). [preserved] checks pin what had to survive — the
 * camera/gesture/controller code, the ten targets, Fácil's full ladder, free
 * hints, no timer, no lives, no score race, parallax that never touches the
 * hit geometry, no React render per pointermove, one completion, the Rota, the
 * Circuito, no Babylon, no new dependency, the Trilha's retirement and its old
 * results — and hold on both.
 *
 * [pool] checks are the mission's addendum, TARGET POOL / ROUND VARIATION V1:
 * an authored pool larger than any round, rounds drawn from a seed under
 * explicit rules (tier mix, list style, an even spread over the stations),
 * enumerated exhaustively and sampled for bias, a round that holds through the
 * session and changes with a new exploration, the rest of the pool left as
 * scenery. They FAIL on the base and on RECOVERED (8fbd638 — this mission's
 * fixed-list implementation), where every [experience] and [preserved] check
 * holds: the addendum is what tells the two apart. The [experience] and
 * [preserved] checks read the lists through the harness (every possible round,
 * or the one fixed list), so they hold on every tree they describe.
 *
 * Usage:
 *   node tools/validation/hidden-objects-experience-tests.mjs                  # the working tree
 *   node tools/validation/hidden-objects-experience-tests.mjs --rev=<commit>   # every source at <commit>
 *   node tools/validation/hidden-objects-experience-tests.mjs --counterfactuals
 *        the working tree must pass every check; the base must fail every
 *        [experience] and [pool] check and hold every [preserved] one;
 *        RECOVERED must fail every [pool] check and hold every other one; every
 *        in-memory MUTANT must fail the checks it names. Nothing is ever written.
 *
 * Writes nothing. Exit 0 = every check holds, 1 = a check failed, 3 = usage error.
 */
import { createHash } from "node:crypto";
import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";
import { createModuleGraph, openSourceTree } from "./route-module-loader.mjs";
import {
  DIR,
  FILES,
  VIEWPORTS,
  activeSets,
  clip,
  codeOnly,
  createEnvironment,
  folderDiff,
  hudRects,
  intersects,
  listFiles,
  loaderTargets,
  mediaBlock,
  nearCamera,
  normalizeText,
  lcg,
  openRig,
  openStudio,
  platformTables,
  possibleRounds,
  pureModules,
  readBinary,
  regionGap,
  same,
  seedListing,
  sorted,
  sourceFiles,
  startSession,
  staticGraph,
  tapOn,
  webpSize,
} from "./hidden-objects-harness.mjs";

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
const COUNTERFACTUAL_MODE = args.includes("--counterfactuals");
if (args.some((arg) => arg !== revArg && arg !== "--counterfactuals") || REV === "" || (REV && COUNTERFACTUAL_MODE)) {
  console.error("usage: node tools/validation/hidden-objects-experience-tests.mjs [--rev=<commit> | --counterfactuals]");
  process.exit(EXIT_USAGE);
}

// --- what the mission fixed ---------------------------------------------------------------------

/** The mission's base: the skeleton, as the first human playtest played it. */
const BASE = "87f30d3e3cb39e40bef415a1a9312150fee7b78d";
/** This mission's work as recovered and pushed before the addendum: Difficulty V2 with fixed lists. */
const RECOVERED = "8fbd638254652dac6c7619ec654e8f52a2d9519c";
const STUDIO = "hidden-objects";
const RETIRED = "number-trail";
const DIFFICULTIES = ["easy", "medium", "hard"];
const SCENE_ID = "explorer-studio";
const KIT_BASE = "/assets/hidden-objects/explorer-studio/v1";
const V0_FOLDER = "public/assets/hidden-objects/explorer-studio/v0";
const HOME_MAQUETTE = "public/illustrations/home/dioramas/discovery";
const ART_SCRIPT = "tools/assets/create_hidden_objects_scene.mjs";
const KEPT_GAME_FOLDERS = { rota: "src/games/escape-maze/", circuito: "src/games/color-sequence/" };
const ALLOWED_STUDIO_PACKAGES = ["lucide-react", "next/image", "react"];

/**
 * Difficulty V2, literally (the mission's EASY / MEDIUM / HARD blocks). Every
 * list a difficulty can show has this size and this mix of tiers; which
 * objects fill it is the round's (the addendum) — before it, one fixed list.
 */
const DIFFICULTY_V2 = {
  easy: {
    label: "Fácil",
    size: 5,
    listStyle: "picture",
    hintLadder: ["station", "area", "reveal"],
    tiers: { A: 3, B: 2, C: 0 },
    tolerancePx: { touch: 16, mouse: 8 },
  },
  medium: {
    label: "Médio",
    size: 6,
    listStyle: "silhouette",
    hintLadder: ["station", "wide-area", "direction"],
    tiers: { A: 1, B: 3, C: 2 },
    tolerancePx: { touch: 12, mouse: 6 },
  },
  hard: {
    label: "Difícil",
    size: 8,
    listStyle: "clue",
    hintLadder: ["station", "context"],
    tiers: { A: 1, B: 3, C: 4 },
    tolerancePx: { touch: 10, mouse: 5 },
  },
};
/** The skeleton's ten, which every later pool keeps. */
const SKELETON_TEN = ["ampulheta", "binoculo", "chave", "lupa", "bussola", "relogio", "barco", "lanterna", "camera", "estatueta"];
/** The addendum's pool: six of each tier, every tier in every station; at least twice any round. */
const POOL_TIERS = { A: 6, B: 6, C: 6 };
/** Look-alikes per target, by tier. */
const LOOKALIKE_LIMIT = { A: 1, B: 2, C: 3 };
/** The measured audit's floors (Discovery F1 visibility; an edge no object may fall under). */
const VISIBLE_FLOOR = { A: 0.8, B: 0.6, C: 0.4 };
const EDGE_FLOOR = 1.3;
/** A clue fits two lines of the list. */
const CLUE_MAX_CHARS = 48;
/** The entry's art (layers, thumbnails, transition art) stays light. */
const ENTRY_BUDGET_BYTES = 600 * 1024;
const LAYERS_BUDGET_BYTES = 400 * 1024;
const FRONT_CLEARANCE_SU = 24;
const EPS = 1e-6;

// --- small helpers -------------------------------------------------------------------------------

const words = (text) => normalizeText(text).split(/[^a-z]+/).filter((word) => word.length >= 4);
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const mean = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
/** Every object a difficulty can list, on this tree. */
const listableIn = (tree, difficulty) => [...new Set(possibleRounds(tree, difficulty).flat())];
const tierCount = (model, list) =>
  list.reduce((acc, id) => ({ ...acc, [model.targetById(id).tier]: acc[model.targetById(id).tier] + 1 }), { A: 0, B: 0, C: 0 });
const centreOf = (region) => (region.kind === "rect" ? { x: region.x + region.w / 2, y: region.y + region.h / 2 } : { x: region.cx, y: region.cy });
const itemsOf = (studio) =>
  studio.harness.hosts(studio.cls("hos-item")).map((entry) => ({
    text: entry.text,
    aria: entry.props["aria-label"],
    found: entry.props["data-found"] === "true",
    entry,
  }));
const press = (studio, entry) => {
  entry.props.onClick?.({ preventDefault() {}, currentTarget: entry.node, target: entry.node });
  studio.harness.flush();
};
const focusItem = (studio, index) => press(studio, itemsOf(studio)[index].entry);
const liveText = (studio) => studio.harness.hosts((entry) => entry.props["aria-live"] === "polite")[0]?.text ?? "";
const fxEntries = (studio, name) => studio.harness.hosts(studio.cls(name));
/** Record what the scene controller is asked to do (the game calls it through the ref). */
function spyController(studio) {
  const calls = [];
  const controller = studio.controller;
  for (const method of ["goToStation", "showCircle", "reveal"]) {
    const original = controller[method].bind(controller);
    controller[method] = (...callArgs) => {
      calls.push([method, ...callArgs]);
      return original(...callArgs);
    };
  }
  return calls;
}
/** Play a whole round (seed `seed`) through the reducer, optionally climbing every ladder to the top first. */
function playThrough(model, scene, difficulty, { hints = 0, freeTaps = 0, seed = 1 } = {}) {
  const R = model.sessionReducer;
  let s = startSession(model, difficulty, seed);
  const listed = model.pendingTargets(s);
  for (let i = 0; i < freeTaps; i += 1) s = R(s, { type: "tap", point: { x: 5 + i, y: 5 }, scale: 1, pointerType: "touch" });
  for (const id of listed) {
    s = R(s, { type: "focus-target", targetId: id });
    for (let i = 0; i < hints; i += 1) s = R(s, { type: "hint" });
    s = R(s, tapOn(model, id));
  }
  return s;
}

/**
 * Every round the addendum's rules allow, found the slow way — every k-subset of
 * the objects a difficulty's list style can show, kept when it has the
 * difficulty's tier mix and the stations share it as evenly as its size allows.
 * Written apart from the product's enumeration so each can check the other.
 */
function bruteForceRounds(pool, preset, stations) {
  const k = preset.count;
  const eligible = pool.filter((t) => !t.listedAs || t.listedAs.includes(preset.listStyle));
  const fewest = Math.floor(k / stations.length);
  const most = Math.ceil(k / stations.length);
  const found = [];
  const pick = (start, chosen) => {
    if (chosen.length === k) {
      const tiers = { A: 0, B: 0, C: 0 };
      for (const t of chosen) tiers[t.tier] += 1;
      if (!same(tiers, preset.tiers)) return;
      const held = stations.map((s) => chosen.filter((t) => t.station === s.id).length);
      if (held.every((n) => n >= fewest && n <= most)) found.push(chosen.map((t) => t.id).sort().join());
      return;
    }
    for (let i = start; i <= eligible.length - (k - chosen.length); i += 1) pick(i + 1, [...chosen, eligible[i]]);
  };
  pick(0, []);
  return found;
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

  // --- the skeleton's core, kept --------------------------------------------------------------------

  await check("E01", "preserved", "CAMERA_GESTURE_CONTROLLER_UNTOUCHED", () => {
    // the camera math, the gesture recogniser and the DOM controller are the playtested ones
    const files = [FILES.camera, FILES.gesture, FILES.controller];
    const changed = files.filter((file) => tree.read(file) !== BASE_TREE.read(file));
    return { pass: changed.length === 0, files, changedSinceTheSkeleton: changed };
  });

  await check("E02", "preserved", "THE_TEN_STAY_AND_EVERY_POOL_OBJECT_IS_PAINTED_ONCE", () => {
    const { scene } = pureModules(tree);
    const pool = scene.HIDDEN_OBJECTS;
    const script = tree.read(ART_SCRIPT);
    // an entry of the art script's target map, quoted or not (the addendum's ids may hold a hyphen)
    const unpainted = pool.filter((target) => (script.match(new RegExp(`\\n  "?${target.id}"?: [{a]`, "g")) ?? []).length !== 1).map((target) => target.id);
    return {
      pass:
        SKELETON_TEN.every((id) => pool.some((t) => t.id === id)) && new Set(pool.map((t) => t.id)).size === pool.length &&
        new Set(pool.map((t) => t.label)).size === pool.length && unpainted.length === 0,
      count: pool.length,
      unpainted,
    };
  });

  // --- difficulty V2 ---------------------------------------------------------------------------------

  await check("E03", "experience", "DIFFICULTY_V2_CHANGES_WHAT_IS_TOLD", () => {
    const { scene, model } = pureModules(tree);
    const wrong = {};
    for (const d of DIFFICULTIES) {
      const preset = scene.DIFFICULTY_PRESETS[d];
      const want = DIFFICULTY_V2[d];
      const lists = possibleRounds(tree, d);
      const mixes = [...new Set(lists.map((list) => JSON.stringify(tierCount(model, list))))].map((mix) => JSON.parse(mix));
      const actual = {
        label: preset.label,
        size: [...new Set(lists.map((list) => list.length))].length === 1 ? lists[0].length : lists.map((list) => list.length),
        listStyle: preset.listStyle,
        hintLadder: [...(preset.hintLadder ?? [])],
        tiers: mixes.length === 1 ? mixes[0] : mixes,
        tolerancePx: preset.tolerancePx,
      };
      if (!same(actual, want)) wrong[d] = actual;
    }
    const ladders = DIFFICULTIES.map((d) => JSON.stringify(scene.DIFFICULTY_PRESETS[d].hintLadder ?? null));
    const facts = {
      threeDistinctLadders: new Set(ladders).size === 3,
      onlyFacilRevealsExactly: DIFFICULTIES.filter((d) => (scene.DIFFICULTY_PRESETS[d].hintLadder ?? []).includes("reveal")).join() === "easy",
      dificilLightsNothing: !(scene.DIFFICULTY_PRESETS.hard.hintLadder ?? []).some((rung) => ["area", "wide-area", "reveal"].includes(rung)),
      medioPoolWiderThanFacil: scene.DIFFICULTY_PRESETS.medium.hintRadius > scene.DIFFICULTY_PRESETS.easy.hintRadius,
      notByShrinkingTargets: same(scene.DIFFICULTY_PRESETS.hard.tolerancePx, { touch: 10, mouse: 5 }),
    };
    return { pass: Object.keys(wrong).length === 0 && Object.values(facts).every(Boolean), wrong, ...facts };
  });

  await check("E04", "experience", "SEMANTIC_CLUES_SAY_WHAT_NOT_WHICH", () => {
    const { scene } = pureModules(tree);
    const pool = scene.HIDDEN_OBJECTS;
    const labelWords = new Set(pool.flatMap((t) => words(t.label)));
    const lookalikeWords = new Set((scene.SCENE_LOOKALIKES ?? []).flatMap((l) => words(l.label)));
    const problems = [];
    for (const t of pool) {
      const clue = t.clue;
      if (typeof clue !== "string" || !/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ].*\.$/.test(clue)) problems.push(`${t.id}: not a sentence`);
      else {
        if (clue.length > CLUE_MAX_CHARS) problems.push(`${t.id}: ${clue.length} chars`);
        const named = words(clue).filter((word) => labelWords.has(word) || lookalikeWords.has(word));
        if (named.length) problems.push(`${t.id}: names ${named.join(",")}`);
      }
      for (const line of [t.hintDirection, t.hintContext]) {
        if (typeof line !== "string" || !line) problems.push(`${t.id}: missing hint line`);
        else if (words(line).some((word) => words(t.label).includes(word))) problems.push(`${t.id}: a hint line names it`);
      }
    }
    const uniqueClues = new Set(pool.map((t) => t.clue)).size === pool.length;
    // the real game: Difícil's list reads as the clues, and never says a pending object's name
    const studio = openStudio(tree);
    studio.start("hard");
    const listed = studio.listedIds().map((id) => pool.find((t) => t.id === id));
    const items = itemsOf(studio);
    const listIsTheClues = same(items.map((item) => item.text), listed.map((t) => t.clue));
    const namesOnScreen = items.filter((item) => listed.some((t) => normalizeText(`${item.text} ${item.aria}`).includes(normalizeText(t.label))));
    studio.unmount();
    return {
      pass: problems.length === 0 && uniqueClues && listIsTheClues && namesOnScreen.length === 0,
      problems,
      uniqueClues,
      listIsTheClues,
      namesOnScreen: namesOnScreen.map((item) => item.aria),
      clues: listed.map((t) => t.clue),
    };
  });

  await check("E05", "experience", "A_FIND_SAYS_THE_NAME", () => {
    const { scene, model } = pureModules(tree);
    const studio = openStudio(tree);
    studio.start("hard");
    const [id] = studio.listedIds();
    const target = model.targetById(id);
    const before = itemsOf(studio)[0];
    const hintButton = studio.hintLabel() ?? "";
    studio.find(id);
    const after = itemsOf(studio)[0];
    const tags = fxEntries(studio, "hos-found-tag").map((entry) => entry.text);
    const live = liveText(studio);
    studio.unmount();
    const facts = {
      beforeIsTheClue: before.text === target.clue && !normalizeText(before.aria).includes(normalizeText(target.label)),
      pistaRefersByTheClue: hintButton.includes(target.clue) && !normalizeText(hintButton).includes(normalizeText(target.label)),
      afterIsTheName: after.found && after.text.startsWith(target.label) && after.text.includes(target.clue) && after.aria === `${target.accessibleLabel}: encontrado`,
      theRoomSaysIt: same(tags, [target.label]),
      announced: live.includes(target.label) && live.includes(target.clue),
    };
    return { pass: Object.values(facts).every(Boolean), ...facts, before: before.text, after: after.text, tags, live };
  });

  // --- hints V2 ----------------------------------------------------------------------------------------

  await check("E06", "preserved", "FACIL_CAN_STILL_SHOW_WHERE", () => {
    const { model, camera: cam } = pureModules(tree);
    const R = model.sessionReducer;
    let s = startSession(model, "easy", 1);
    for (let i = 0; i < 3; i += 1) s = R(s, { type: "hint" });
    const halo = model.hintHalo(s.hintTarget, "easy", s.hintStage);
    const c = model.regionCenter(model.targetById(s.hintTarget).region);
    const pure = s.hintStage === 3 && halo && Math.hypot(halo.cx - c.x, halo.cy - c.y) < EPS;
    const studio = openStudio(tree);
    studio.start("easy");
    // the hint is for the list's first line until another is picked
    const subject = model.targetById(studio.listedIds()[0]);
    for (let i = 0; i < 3; i += 1) {
      studio.clickHint();
      studio.settle();
    }
    const game = {
      banner: studio.banner() === `Aqui está: ${subject.label}.`,
      revealHalo: studio.halo()?.kind === "reveal",
      framed: nearCamera(studio.camera(), cam.revealCamera(model.regionBounds(subject.region), studio.size())),
    };
    studio.unmount();
    return { pass: Boolean(pure) && Object.values(game).every(Boolean), pure: Boolean(pure), ...game };
  });

  await check("E07", "experience", "MEDIO_NEVER_POINTS_AT_THE_OBJECT", () => {
    const { model, camera: cam } = pureModules(tree);
    const seed = 5150;
    const first = openStudio(tree, { seeds: [seed] });
    first.start("medium");
    const list = first.listedIds();
    first.unmount();
    const problems = [];
    const ladders = [];
    for (const [index, id] of list.entries()) {
      const target = model.targetById(id);
      const bounds = model.regionBounds(target.region);
      const c = model.regionCenter(target.region);
      const studio = openStudio(tree, { seeds: [seed] });
      studio.start("medium");
      focusItem(studio, index);
      const seen = [];
      let cameraAfterPool = null;
      for (let press = 1; press <= 6; press += 1) {
        studio.clickHint();
        studio.settle();
        const halo = studio.halo();
        const camera = studio.camera();
        const banner = studio.banner() ?? "";
        const label = studio.hintLabel() ?? "";
        seen.push(halo ? halo.kind : "-");
        if (halo?.kind === "reveal") problems.push(`${id}: press ${press} reveals`);
        if (nearCamera(camera, cam.revealCamera(bounds, studio.size()), 1e-3)) problems.push(`${id}: press ${press} frames it`);
        if (/Aqui está/.test(banner)) problems.push(`${id}: press ${press} names its place`);
        if (/Mostrar/.test(label)) problems.push(`${id}: press ${press} offers "${label}"`);
        if (press === 2) {
          cameraAfterPool = camera;
          if (!halo || halo.kind !== "hint") problems.push(`${id}: no pool at press 2`);
          else {
            if (halo.r < 400 - EPS) problems.push(`${id}: pool r ${halo.r}`);
            if (Math.hypot(halo.cx - c.x, halo.cy - c.y) < 40) problems.push(`${id}: pool centred on it`);
          }
        }
        if (press === 3) {
          if (halo) problems.push(`${id}: the direction lights the room`);
          if (banner !== `Pista: olhe ${target.hintDirection}.`) problems.push(`${id}: banner "${banner}"`);
          if (!nearCamera(camera, cameraAfterPool, 1e-6)) problems.push(`${id}: the direction moved the camera`);
        }
      }
      ladders.push(`${id}:${seen.join("")}`);
      studio.unmount();
    }
    return { pass: problems.length === 0, problems: problems.slice(0, 8), problemCount: problems.length, ladders };
  });

  await check("E08", "experience", "DIFICIL_HAS_NO_EXACT_REVEAL", () => {
    const { scene, model, camera: cam } = pureModules(tree);
    const listable = listableIn(tree, "hard");
    const problems = [];
    // the model: no reveal rung, no light, the camera only ever to the station — for every object Difícil can list
    if (model.revealsExactly("hard") !== false) problems.push("revealsExactly(hard)");
    for (const id of listable) {
      for (const stage of [0, 1, 2, 3]) {
        const rung = model.hintRung("hard", stage);
        if (["reveal", "area", "wide-area"].includes(rung)) problems.push(`${id}: rung ${rung}`);
        if (model.hintHalo(id, "hard", stage) !== null) problems.push(`${id}: halo at ${stage}`);
        const move = model.hintCameraMove(id, "hard", stage);
        if (stage === 1 ? !(move?.kind === "station" && move.station === model.targetById(id).station) : move !== null) problems.push(`${id}: camera ${JSON.stringify(move)} at ${stage}`);
      }
    }
    // the reducer: ten presses never climb past the second rung (each object in a round that lists it)
    const R = model.sessionReducer;
    for (const id of listable) {
      let s = R(startSession(model, "hard", seedListing(tree, "hard", [id])), { type: "focus-target", targetId: id });
      for (let i = 0; i < 10; i += 1) s = R(s, { type: "hint" });
      if (s.hintStage > 2) problems.push(`${id}: stage ${s.hintStage}`);
    }
    // the real game: every line of a seeded round, five presses each
    const seed = 6060;
    const first = openStudio(tree, { seeds: [seed] });
    first.start("hard");
    const list = first.listedIds();
    first.unmount();
    for (const [index, id] of list.entries()) {
      const target = model.targetById(id);
      const studio = openStudio(tree, { seeds: [seed] });
      studio.start("hard");
      focusItem(studio, index);
      let previous = null;
      for (let press = 1; press <= 5; press += 1) {
        studio.clickHint();
        studio.settle();
        const banner = studio.banner() ?? "";
        const label = studio.hintLabel() ?? "";
        const camera = studio.camera();
        if (studio.halo()) problems.push(`${id}: halo at press ${press}`);
        if (normalizeText(banner).includes(normalizeText(target.label)) || /Aqui está/.test(banner)) problems.push(`${id}: banner "${banner}"`);
        if (/Mostrar/.test(label)) problems.push(`${id}: offers "${label}"`);
        if (nearCamera(camera, cam.revealCamera(model.regionBounds(target.region), studio.size()), 1e-3)) problems.push(`${id}: framed at press ${press}`);
        if (press === 1 && !nearCamera(camera, cam.stationCamera(target.station, studio.size()))) problems.push(`${id}: press 1 is not the station`);
        if (press > 1 && !nearCamera(camera, previous)) problems.push(`${id}: press ${press} moved the camera`);
        if (press === 2 && banner !== `Pista: está ${target.hintContext}.`) problems.push(`${id}: context "${banner}"`);
        previous = camera;
      }
      studio.unmount();
    }
    return { pass: problems.length === 0, problems: problems.slice(0, 8), problemCount: problems.length, listableInDificil: listable.length, ladder: scene.DIFFICULTY_PRESETS.hard.hintLadder ?? null };
  });

  await check("E09", "experience", "DIFICIL_LIGHTS_NOTHING_IN_THE_ROOM", () => {
    const { model } = pureModules(tree);
    const studio = openStudio(tree);
    studio.start("hard");
    const list = studio.listedIds();
    const lit = [];
    // climb every object's ladder, then find half of them: the room only ever marks what was found
    for (let index = 0; index < list.length; index += 1) {
      focusItem(studio, index);
      for (let i = 0; i < 4; i += 1) {
        studio.clickHint();
        studio.settle();
        if (fxEntries(studio, "hos-halo").length) lit.push(`${list[index]}: halo`);
      }
    }
    const found = list.filter((_, i) => i % 2 === 0);
    for (const id of found) studio.find(id);
    const marks = fxEntries(studio, "hos-found").map((entry) => entry.props["data-target"]);
    const strays = fxEntries(studio, "hos-halo").length + fxEntries(studio, "hos-halo-reveal").length;
    studio.unmount();
    const ok = lit.length === 0 && same(sorted(marks), sorted(found)) && strays === 0;
    return { pass: ok && model.revealsExactly("hard") === false, lit, marks, strays };
  });

  await check("E10", "experience", "DIFICIL_NEVER_GLIDES_TO_THE_OBJECT", () => {
    const { model } = pureModules(tree);
    const run = (difficulty) => {
      const studio = openStudio(tree);
      studio.start(difficulty);
      const calls = spyController(studio);
      const list = studio.listedIds();
      for (let index = 0; index < list.length; index += 1) {
        focusItem(studio, index);
        for (let i = 0; i < 4; i += 1) {
          studio.clickHint();
          studio.settle();
        }
      }
      studio.unmount();
      return { calls, list };
    };
    const { calls: hard, list: hardList } = run("hard");
    const { calls: easy } = run("easy");
    const hardKinds = sorted([...new Set(hard.map(([method]) => method))]);
    const stationsAsked = hard.filter(([method]) => method === "goToStation").map(([, station]) => station);
    const expectedStations = hardList.map((id) => model.targetById(id).station);
    return {
      pass:
        same(hardKinds, ["goToStation"]) && same(stationsAsked, expectedStations) &&
        easy.some(([method]) => method === "reveal") /* the spy sees a reveal where one exists */,
      hardCalls: hardKinds,
      stationsAsked,
      easyRevealCalls: easy.filter(([method]) => method === "reveal").length,
    };
  });

  await check("E11", "preserved", "HINTS_STAY_FREE", () => {
    const { scene, model } = pureModules(tree);
    const wrong = [];
    for (const d of DIFFICULTIES) {
      const plain = model.buildHiddenObjectsResult(playThrough(model, scene, d));
      const helped = model.buildHiddenObjectsResult(playThrough(model, scene, d, { hints: 6, freeTaps: 12 }));
      if (!same(plain, helped)) wrong.push(d);
      const keys = [...Object.keys(helped), ...Object.keys(helped.details)];
      if (keys.some((key) => /hint|miss|help|tap|reveal/i.test(key))) wrong.push(`${d}: a help key`);
    }
    // nothing appears without a press
    const studio = openStudio(tree);
    studio.start("hard");
    studio.frames(600);
    const quiet = studio.banner() === null && studio.halo() === null;
    studio.unmount();
    return { pass: wrong.length === 0 && quiet, wrong, nothingByItself: quiet };
  });

  await check("E12", "preserved", "NO_TIMER", () => {
    const { scene, model } = pureModules(tree);
    const code = listFiles(tree, DIR).filter((file) => /\.(ts|tsx)$/.test(file)).map((file) => [file, codeOnly(tree.read(file))]);
    const intervals = code.filter(([, text]) => /setInterval|Date\.now|new Date\(/.test(text)).map(([file]) => file);
    const timeouts = code.flatMap(([file, text]) => [...text.matchAll(/setTimeout\(/g)].map(() => file));
    const allowedTimeouts = [FILES.game, FILES.controller];
    const result = model.buildHiddenObjectsResult(playThrough(model, scene, "hard"));
    const stateKeys = Object.keys(model.createSession());
    const timeKeys = [...Object.keys(result), ...Object.keys(result.details), ...stateKeys].filter((key) => /time|elapsed|duration|clock|countdown|deadline/i.test(key));
    return {
      pass: intervals.length === 0 && timeouts.every((file) => allowedTimeouts.includes(file)) && timeKeys.length === 0,
      intervals,
      timeouts: [...new Set(timeouts)],
      timeKeys,
    };
  });

  await check("E13", "preserved", "NO_LIVES_NO_PENALTY", () => {
    const { model } = pureModules(tree);
    const R = model.sessionReducer;
    const start = startSession(model, "hard", 1);
    let s = start;
    for (let i = 0; i < 100; i += 1) s = R(s, { type: "tap", point: { x: 3 + (i % 7), y: 3 }, scale: 1, pointerType: i % 2 ? "touch" : "mouse" });
    const ignore = new Set(["lastEvent", "eventSeq"]);
    const changed = Object.keys(start).filter((key) => !ignore.has(key) && !same(start[key], s[key]));
    const keys = Object.keys(s).filter((key) => /lives|vidas|error|erro|mistake|penalt|strike|fail/i.test(key));
    return { pass: changed.length === 0 && keys.length === 0 && s.status === "playing", changedByMisses: changed, penaltyKeys: keys };
  });

  await check("E14", "preserved", "NO_SCORE_RACE", () => {
    const { scene, model } = pureModules(tree);
    const rows = DIFFICULTIES.map((d) => {
      const r = model.buildHiddenObjectsResult(playThrough(model, scene, d, { hints: 3 }));
      return { d, score: r.score, found: r.details.foundObjects, total: r.details.totalObjects, keys: [...Object.keys(r), ...Object.keys(r.details)] };
    });
    const ok = rows.every((row) => row.score === row.found && row.found === row.total && row.total === DIFFICULTY_V2[row.d].size);
    const raceKeys = rows.flatMap((row) => row.keys.filter((key) => /rank|best|record|streak|star|points|level|bonus/i.test(key)));
    return { pass: ok && raceKeys.length === 0, scores: rows.map((row) => `${row.d} ${row.score}/${row.total}`), raceKeys };
  });

  // --- the result screen ---------------------------------------------------------------------------

  await check("E15", "experience", "RESULT_PRESENTATION_IS_PER_GAME_METADATA", () => {
    const { scene, model } = pureModules(tree);
    const t = platformTables(tree);
    const studio = t.rewards.getResultPresentation({ gameId: STUDIO });
    const hard = model.buildHiddenObjectsResult(playThrough(model, scene, "hard"));
    const shown = t.labels.formatResultDetails(hard.details, studio);
    const legacy = { gameId: RETIRED, details: { level: 3, currentNumber: 12, errors: 0, roundsCompleted: 2, correctNumbers: 12, maxErrors: 3 } };
    const others = [
      { gameId: "escape-maze", details: { turns: 14, won: true, difficulty: "hard", routeNumber: 2, starsCollected: 3, totalStars: 3 } },
      { gameId: "color-sequence", details: { level: 4, sequenceLength: 6, errors: 1, maxErrors: 3 } },
      { gameId: "security-panel", details: { panelsCompleted: 2, errors: 0 } },
      { gameId: "seed-garden", details: { movesUsed: 4, targetCompleted: true } },
      legacy,
    ];
    // every other game (and an old Trilha result) is listed exactly as the modal listed it before
    const before = (details) =>
      Object.entries(details)
        .filter(([, value]) => typeof value !== "object")
        .map(([key, value]) => ({ key, label: t.labels.formatDetailKeyPt(key), value: t.labels.formatDetailValuePt(value) }));
    const unchanged = others.filter((r) => {
      const p = t.rewards.getResultPresentation(r);
      return !(p.scoreLabel === "Registro da prática" && p.detailKeys === null && p.modeLabels === null && same(t.labels.formatResultDetails(r.details, p), before(r.details)));
    });
    const modal = codeOnly(tree.read(FILES.rewardModal));
    const facts = {
      studioPresentation: same(studio, { scoreLabel: "Objetos encontrados", detailKeys: ["difficulty"], modeLabels: { easy: "Fácil", medium: "Médio", hard: "Difícil" } }),
      studioShowsOnlyTheMode: same(shown, [{ key: "difficulty", label: "Modo", value: "Difícil" }]),
      everyoneElseUnchanged: unchanged.length === 0,
      modalReadsTheMetadata: /getResultPresentation\(/.test(modal) && /formatResultDetails\(/.test(modal) && !/Registro da prática/.test(modal),
      modalNamesNoGame: !/hidden-objects|HiddenObjects|Est[uú]dio/.test(modal),
    };
    return { pass: Object.values(facts).every(Boolean), ...facts, shown, unchangedFailures: unchanged.map((r) => r.gameId) };
  });

  // --- look-alikes and fairness ---------------------------------------------------------------------

  await check("E16", "experience", "LOOKALIKES_ARE_FAIR", () => {
    const { scene, model } = pureModules(tree);
    const looks = scene.SCENE_LOOKALIKES;
    if (!Array.isArray(looks) || looks.length === 0) throw new Error("no SCENE_LOOKALIKES");
    const clearance = scene.LOOKALIKE_CLEARANCE_SU;
    const W = scene.SCENE_WIDTH;
    const H = scene.SCENE_HEIGHT;
    const labelWords = new Set(scene.HIDDEN_OBJECTS.flatMap((t) => words(t.label)));
    const script = tree.read(ART_SCRIPT);
    const problems = [];
    if (!(clearance >= 32)) problems.push(`clearance ${clearance}`);
    if (new Set(looks.map((l) => l.id)).size !== looks.length) problems.push("duplicate ids");
    for (const l of looks) {
      const target = scene.HIDDEN_OBJECTS.find((t) => t.id === l.resembles);
      if (!target) {
        problems.push(`${l.id}: resembles nothing`);
        continue;
      }
      if (!l.tellApart || !l.label) problems.push(`${l.id}: no label / tellApart`);
      if (words(l.label).some((word) => labelWords.has(word))) problems.push(`${l.id}: shares a target's name`);
      if (scene.HIDDEN_OBJECTS.some((t) => normalizeText(t.clue ?? "").includes(normalizeText(l.label)))) problems.push(`${l.id}: named by a clue`);
      const b = model.regionBounds(l.region);
      if (b.x < scene.SAFE_MARGIN_X || b.y < scene.SAFE_MARGIN_Y || b.x + b.w > W - scene.SAFE_MARGIN_X || b.y + b.h > H - scene.SAFE_MARGIN_Y) problems.push(`${l.id}: outside the safe area`);
      const c = centreOf(l.region);
      const station = scene.SCENE_STATIONS.find((s) => c.x >= s.span.x0 && c.x < s.span.x1);
      if (station?.id !== target.station) problems.push(`${l.id}: not in ${target.station}`);
      for (const t of scene.HIDDEN_OBJECTS) {
        const gap = regionGap(model, l.region, t.region);
        if (gap < clearance - EPS) problems.push(`${l.id}: ${gap.toFixed(1)} su from ${t.id}`);
      }
      if ((script.split(`lookSvg("${l.id}")`).length - 1) !== 1) problems.push(`${l.id}: not painted exactly once by the art script`);
    }
    for (let i = 0; i < looks.length; i += 1) for (let j = i + 1; j < looks.length; j += 1) if (regionGap(model, looks[i].region, looks[j].region) <= 0) problems.push(`${looks[i].id}/${looks[j].id} overlap`);
    const perTarget = Object.fromEntries(scene.HIDDEN_OBJECTS.map((t) => [t.id, looks.filter((l) => l.resembles === t.id).length]));
    for (const t of scene.HIDDEN_OBJECTS) if (perTarget[t.id] > LOOKALIKE_LIMIT[t.tier]) problems.push(`${t.id} (${t.tier}): ${perTarget[t.id]} look-alikes`);
    // a tap on a look-alike is a free tap, never a find: against the whole pool (whichever objects a round
    // lists), with every difficulty's touch reach, at the phone's cover scale
    const everyId = scene.HIDDEN_OBJECTS.map((t) => t.id);
    for (const d of DIFFICULTIES) {
      for (const l of looks) {
        const hit = model.hitTest(centreOf(l.region), everyId, 0.375, model.tolerancePxFor(d, "touch"));
        if (hit !== null) problems.push(`${d}: tapping ${l.id} would find ${hit}`);
      }
    }
    return { pass: problems.length === 0, problems: problems.slice(0, 10), problemCount: problems.length, count: looks.length, perTarget };
  });

  await check("E17", "experience", "FAIRNESS_HOLDS_ON_THE_NEW_ART", () => {
    const { scene, camera: cam, model } = pureModules(tree);
    const problems = [];
    // the foreground layers, at their furthest drift + clearance, cover no target and no look-alike
    const plate = scene.SCENE_LAYERS.findIndex((layer) => layer.id === "plate");
    const shapes = [...scene.HIDDEN_OBJECTS.map((t) => [t.id, t.region]), ...(scene.SCENE_LOOKALIKES ?? []).map((l) => [l.id, l.region])];
    for (const layer of scene.SCENE_LAYERS.slice(plate + 1)) {
      const drift = cam.maxParallaxOffset(layer.parallax);
      for (const paint of layer.opaque) {
        const grown = { x: paint.x - drift.x - FRONT_CLEARANCE_SU, y: paint.y - drift.y - FRONT_CLEARANCE_SU, w: paint.w + 2 * (drift.x + FRONT_CLEARANCE_SU), h: paint.h + 2 * (drift.y + FRONT_CLEARANCE_SU) };
        for (const [id, region] of shapes) if (intersects(grown, model.regionBounds(region))) problems.push(`${layer.id} can cover ${id}`);
      }
    }
    // every target can be framed whole and clear of the HUD on every viewport of the new HUD
    for (const viewport of VIEWPORTS) {
      for (const t of scene.HIDDEN_OBJECTS) {
        const b = model.regionBounds(t.region);
        const camera = cam.revealCamera(b, viewport);
        const a = cam.sceneToViewport({ x: b.x, y: b.y }, camera, viewport);
        const z = cam.sceneToViewport({ x: b.x + b.w, y: b.y + b.h }, camera, viewport);
        const screen = { x: a.x, y: a.y, w: z.x - a.x, h: z.y - a.y };
        if (screen.x < -EPS || screen.y < -EPS || screen.x + screen.w > viewport.width + EPS || screen.y + screen.h > viewport.height + EPS) problems.push(`${t.id} off screen (${viewport.name})`);
        for (const hud of hudRects(viewport)) if (intersects(screen, hud)) problems.push(`${t.id} under the ${hud.name} (${viewport.name})`);
      }
    }
    // the art itself, measured: the audit of THIS plate, every target visible enough, no edge lost in its ground
    const kit = scene.SCENE_ASSET_BASE.split("/").pop();
    const auditFile = `docs/archive/hidden-objects/explorer-studio/review/${kit}/fairness.json`;
    const audit = tree.exists(auditFile) ? JSON.parse(tree.read(auditFile)) : null;
    const platePath = `public${scene.SCENE_LAYERS[plate].src}`;
    const plateHash = tree.exists(platePath) ? sha256(readBinary(tree, platePath)) : null;
    if (!audit) problems.push(`no audit at ${auditFile}`);
    else {
      if (audit.kit !== scene.SCENE_ASSET_BASE) problems.push(`audit of ${audit.kit}`);
      if (audit.plateSha256 !== plateHash) problems.push("audit is stale (the plate changed after it)");
      const rows = Object.fromEntries((audit.targets ?? []).map((row) => [row.id, row]));
      for (const t of scene.HIDDEN_OBJECTS) {
        const row = rows[t.id];
        if (!row) problems.push(`${t.id}: not audited`);
        else {
          if (row.tier !== t.tier) problems.push(`${t.id}: audited as ${row.tier}`);
          if (row.visible < VISIBLE_FLOOR[t.tier]) problems.push(`${t.id}: ${(row.visible * 100).toFixed(0)}% visible`);
          if (row.edge < EDGE_FLOOR) problems.push(`${t.id}: edge ${row.edge}:1`);
        }
      }
      const mean = (tier) => {
        const list = scene.HIDDEN_OBJECTS.filter((t) => t.tier === tier && rows[t.id]).map((t) => rows[t.id].visible);
        return list.reduce((sum, v) => sum + v, 0) / Math.max(1, list.length);
      };
      if (!(mean("C") < mean("A"))) problems.push("C is not more covered than A");
    }
    return {
      pass: problems.length === 0,
      problems: problems.slice(0, 10),
      problemCount: problems.length,
      audit: audit ? (audit.targets ?? []).map((row) => `${row.id} ${row.tier} ${(row.visible * 100).toFixed(0)}% edge ${row.edge}`) : null,
    };
  });

  await check("E18", "preserved", "PARALLAX_NEVER_MOVES_THE_HIT_GEOMETRY", () => {
    const { scene, model, camera: cam } = pureModules(tree);
    const layers = scene.SCENE_LAYERS.filter((layer) => layer.parallax !== 1);
    const subtle = layers.every((layer) => layer.id !== "plate" && Math.abs(1 - layer.parallax) <= 0.08);
    const problems = [];
    for (const reducedMotion of [false, true]) {
      const rig = openRig(tree, { reducedMotion });
      rig.drag(rig.centre(), { x: rig.centre().x - 260, y: rig.centre().y + 40 }, { steps: 6 });
      rig.controller.zoomBy(1.4);
      rig.controller.goToStation("estante");
      rig.settle();
      const drifted = rig.parallax.some((element) => !/^translate3d\(0px, 0px, 0\)$/.test(element.style.transform));
      if (drifted === reducedMotion) problems.push(`parallax ${drifted ? "drifts" : "still"} with reducedMotion=${reducedMotion}`);
      // a tap on each visible target's on-screen centre lands on its scene point and selects it
      let s = startSession(model, "hard", 1);
      for (const t of scene.HIDDEN_OBJECTS.filter((target) => target.station === "estante")) {
        const point = model.regionCenter(t.region);
        const local = cam.sceneToViewport(point, rig.camera(), rig.size());
        if (local.x < 0 || local.y < 0 || local.x > rig.size().width || local.y > rig.size().height) continue;
        const before = rig.taps.length;
        rig.tap(rig.client(local));
        const tap = rig.taps[before];
        if (!tap || Math.hypot(tap.point.x - point.x, tap.point.y - point.y) > 1e-6) problems.push(`${t.id}: tap at ${JSON.stringify(tap?.point)}`);
        const hit = model.hitTest(tap.point, scene.HIDDEN_OBJECTS.map((target) => target.id), tap.scale, 0);
        if (hit !== t.id) problems.push(`${t.id}: hit ${hit}`);
        s = model.sessionReducer(s, { type: "tap", point: tap.point, scale: tap.scale, pointerType: "mouse" });
      }
      rig.controller.destroy();
    }
    // the feedback layer lives inside the room (it pans with the plate, never with a parallax layer)
    const studio = openStudio(tree);
    const world = studio.harness.hosts(studio.cls("hos-world"))[0];
    const fx = studio.harness.hosts(studio.cls("hos-fx"))[0];
    const fxInsideTheWorld = Boolean(world && fx && fx.path.startsWith(world.path));
    studio.unmount();
    return { pass: subtle && problems.length === 0 && fxInsideTheWorld, parallax: layers.map((layer) => `${layer.id} ${layer.parallax}`), problems, fxInsideTheWorld };
  });

  await check("E19", "experience", "REDUCED_MOTION_COVERS_THE_NEW_FEEDBACK", () => {
    const css = tree.read(FILES.css);
    const block = mediaBlock(css, "prefers-reduced-motion: reduce") ?? "";
    const outside = css.replace(block, "");
    const rule = (text, selector) => new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`).exec(text)?.[1] ?? "";
    const facts = {
      ringAnimates: /animation:\s*hos-ring/.test(rule(outside, ".hos-found-ring")),
      tagAnimates: /animation:\s*hos-tag/.test(rule(outside, ".hos-found-tag")),
      ringStillUnderReducedMotion: /steps\(1/.test(rule(block, ".hos-found-ring")),
      tagStillUnderReducedMotion: /steps\(1/.test(rule(block, ".hos-found-tag")),
      haloStillUnderReducedMotion: /steps\(1/.test(rule(block, ".hos-halo")),
      vignetteNeverMoves: !/animation|transition/.test(rule(css, ".hos-vignette")),
    };
    // and the controller: no parallax drift, no glide, under reduced motion
    const rig = openRig(tree, { reducedMotion: true });
    rig.drag(rig.centre(), { x: rig.centre().x + 180, y: rig.centre().y }, { steps: 4 });
    rig.controller.goToStation("janela");
    const cut = rig.env.clock.pending().frames <= 1;
    rig.frame(2);
    const still = rig.parallax.every((element) => /^translate3d\(0px, 0px, 0\)$/.test(element.style.transform));
    rig.controller.destroy();
    return { pass: Object.values(facts).every(Boolean) && cut && still, ...facts, glideCut: cut, parallaxStill: still };
  });

  await check("E20", "preserved", "NO_REACT_RENDER_PER_POINTERMOVE", () => {
    const studio = openStudio(tree);
    studio.start("hard");
    const toggle = studio.button(studio.cls("hos-tray-toggle"));
    if (toggle) studio.click(studio.cls("hos-tray-toggle"));
    studio.settle();
    const { harness, env } = studio;
    const snapshot = () => ({ renders: studio.renders(), updates: harness.stats.stateUpdates, writes: env.log.writes.filter((w) => w.name === "hos-world").length });
    const centre = studio.centre();
    const s0 = snapshot();
    studio.pointer("pointerdown", { pointerId: 1, clientX: centre.x, clientY: centre.y, pointerType: "touch", button: 0 });
    for (let i = 1; i <= 40; i += 1) {
      studio.pointer("pointermove", { pointerId: 1, clientX: centre.x - i * 5, clientY: centre.y + (i % 4), pointerType: "touch" });
      studio.frames(1);
    }
    const s1 = snapshot();
    studio.pointer("pointerup", { pointerId: 1, clientX: centre.x - 200, clientY: centre.y, pointerType: "touch", button: 0 });
    studio.frames(2);
    const s2 = snapshot();
    studio.unmount();
    return {
      pass: s1.renders === s0.renders && s1.updates === s0.updates && s1.writes - s0.writes >= 30 && s2.renders - s1.renders <= 2,
      trayFolded: Boolean(toggle),
      drag: { pointermoves: 40, renders: s1.renders - s0.renders, stateUpdates: s1.updates - s0.updates, transformWrites: s1.writes - s0.writes },
    };
  });

  await check("E21", "preserved", "ONE_COMPLETION_PER_SESSION", () => {
    const studio = openStudio(tree);
    studio.start("hard");
    for (const id of studio.listedIds()) studio.find(id);
    studio.frames(60);
    studio.click(studio.cls("hos-primary"));
    studio.click(studio.cls("hos-primary"));
    const results = studio.calls.complete;
    studio.unmount();
    const [r] = results;
    return { pass: results.length === 1 && r.score === 8 && r.details.completed === true && r.details.difficulty === "hard", onCompleteCalls: results.length, score: r?.score ?? null };
  });

  // --- what must not move -------------------------------------------------------------------------

  for (const [id, name, folder] of [
    ["E22", "ROTA_UNTOUCHED", KEPT_GAME_FOLDERS.rota],
    ["E23", "CIRCUITO_UNTOUCHED", KEPT_GAME_FOLDERS.circuito],
  ]) {
    await check(id, "preserved", name, () => {
      const changed = folderDiff(tree, BASE_TREE, folder);
      const gameId = folder.split("/").at(-2);
      const t = platformTables(tree);
      const b = platformTables(BASE_TREE);
      const contract = same(t.contracts[gameId], b.contracts[gameId]) && same(loaderTargets(tree)[gameId], loaderTargets(BASE_TREE)[gameId]);
      return { pass: changed.length === 0 && contract && listFiles(tree, folder).length > 0, folder, changedSinceTheSkeleton: changed, contractAndLoaderSame: contract };
    });
  }

  await check("E24", "preserved", "NO_BABYLON_OR_WEBGL_IN_THE_STUDIO", () => {
    const graph = staticGraph(tree);
    const closure = graph.closure([FILES.game], ["static", "dynamic"]);
    const packages = sorted(new Set(closure.flatMap((file) => [...graph.node(file).packages.static, ...graph.node(file).packages.dynamic])));
    const markers = closure
      .filter((file) => /\.(ts|tsx)$/.test(file))
      .flatMap((file) => [...codeOnly(tree.read(file)).matchAll(/\.glb\b|getContext\s*\(|webgl|Babylon|new\s+Worker\b|<canvas|confetti/gi)].map((m) => `${file}: ${m[0]}`));
    const outside = closure.filter((file) => !file.startsWith(DIR));
    return { pass: same(packages, ALLOWED_STUDIO_PACKAGES) && markers.length === 0 && outside.length === 0, packages, markers, modulesOutsideTheGame: outside };
  });

  await check("E25", "preserved", "NO_NEW_RUNTIME_DEPENDENCY", () => {
    const fields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
    const mine = JSON.parse(tree.read("package.json"));
    const base = JSON.parse(BASE_TREE.read("package.json"));
    const differs = fields.filter((field) => !same(mine[field] ?? {}, base[field] ?? {}));
    const lockfileUnchanged = tree.read("package-lock.json") === BASE_TREE.read("package-lock.json");
    return { pass: differs.length === 0 && lockfileUnchanged, differs, lockfileUnchanged };
  });

  await check("E26", "preserved", "NUMBER_TRAIL_STAYS_RETIRED", () => {
    const t = platformTables(tree);
    const stillListedIn = Object.entries(activeSets(t)).filter(([, ids]) => ids.includes(RETIRED)).map(([table]) => table);
    const codeNaming = sourceFiles(tree).filter((file) => /\b(number-trail|NumberTrail)\b/.test(codeOnly(tree.read(file))));
    return {
      pass: stillListedIn.length === 0 && codeNaming.length === 0 && listFiles(tree, `src/games/${RETIRED}`).length === 0 && sorted(Object.keys(t.registry)).includes(STUDIO),
      stillListedIn,
      codeNaming,
    };
  });

  await check("E27", "preserved", "OLD_TRILHA_RESULTS_STAY_READABLE", () => {
    const legacy = {
      id: "number-trail-1759600000000",
      activityId: RETIRED,
      activityTitle: "Trilha Lógica",
      gameId: RETIRED,
      score: 340,
      playedAt: "2026-10-04T18:00:00.000Z",
      summary: "Você iluminou 2 trilhas completas na Trilha Lógica.",
      details: { level: 3, currentNumber: 12, errors: 0, roundsCompleted: 2, correctNumbers: 12, maxErrors: 3 },
    };
    const { scene, model } = pureModules(tree);
    const env = createEnvironment({ storage: { "cognitive-mind-recent-results": JSON.stringify([legacy]) } });
    const storage = createModuleGraph({ tree, mocks: {}, globals: env.globals }).require(FILES.storage);
    const readBack = storage.getRecentResults();
    storage.saveGameResult(model.buildHiddenObjectsResult(playThrough(model, scene, "hard")));
    const after = JSON.parse(env.store.get("cognitive-mind-recent-results"));
    const t = platformTables(tree);
    const copy = t.rewards.getRewardCopy(legacy);
    return {
      pass: same(readBack, [legacy]) && after.length === 2 && after[0].gameId === STUDIO && same(after[1], legacy) && copy.title !== "Estúdio explorado",
      storedAfterSave: after.map((r) => r.gameId),
      legacyTitle: copy.title,
    };
  });

  // --- the HUD, the result's scene, the art kit, the found feedback ---------------------------------

  await check("E28", "experience", "THE_OBJECTIVES_FOLD_AWAY", () => {
    const studio = openStudio(tree);
    const shell = () => studio.harness.hosts(studio.cls("hos-shell"))[0]?.props["data-tray"];
    const list = () => studio.harness.hosts(studio.cls("hos-list"))[0];
    const toggle = () => studio.button(studio.cls("hos-tray-toggle"));
    const storeBefore = JSON.stringify([...studio.env.store]);
    const inSetup = shell();
    studio.start("hard");
    const open = { tray: shell(), expanded: toggle()?.props["aria-expanded"], controls: toggle()?.props["aria-controls"] === list()?.props.id, listHidden: list()?.props.hidden };
    studio.click(studio.cls("hos-tray-toggle"));
    const closed = { tray: shell(), expanded: toggle()?.props["aria-expanded"], listHidden: list()?.props.hidden };
    // folded, Pista and the stations still work
    studio.clickHint();
    studio.settle();
    const hintWorks = Boolean(studio.banner());
    studio.clickStation("Janela");
    studio.settle();
    const stationWorks = nearCamera(studio.camera(), studio.cam.stationCamera("janela", studio.size()));
    studio.click(studio.cls("hos-tray-toggle"));
    const reopened = shell();
    const storeAfter = JSON.stringify([...studio.env.store]);
    studio.unmount();
    const facts = {
      openInSetup: inSetup === "open",
      startsOpen: open.tray === "open" && open.expanded === true && open.controls && !open.listHidden,
      folds: closed.tray === "closed" && closed.expanded === false && closed.listHidden === true,
      foldedPistaWorks: hintWorks,
      foldedStationsWork: stationWorks,
      unfolds: reopened === "open",
      remembersNothing: storeBefore === storeAfter,
    };
    return { pass: Object.values(facts).every(Boolean), ...facts };
  });

  await check("E29", "experience", "THE_RESULT_NAMES_THE_SCENE", () => {
    const { scene, model } = pureModules(tree);
    const t = platformTables(tree);
    const rows = DIFFICULTIES.map((d) => model.buildHiddenObjectsResult(playThrough(model, scene, d)).details.sceneId);
    const shown = t.labels.formatResultDetails(model.buildHiddenObjectsResult(playThrough(model, scene, "easy")).details, t.rewards.getResultPresentation({ gameId: STUDIO }));
    return { pass: scene.SCENE_ID === SCENE_ID && rows.every((id) => id === SCENE_ID) && !shown.some((line) => line.key === "sceneId"), sceneIds: rows, listed: shown.map((line) => line.key) };
  });

  await check("E30", "experience", "ART_KIT_V1_SHIPS_ALONE", () => {
    const { scene } = pureModules(tree);
    const t = platformTables(tree);
    const read = (src) => {
      const file = `public${src}`;
      const bytes = tree.exists(file) ? readBinary(tree, file) : null;
      return { file, bytes: bytes?.length ?? 0, size: bytes ? webpSize(bytes) : null };
    };
    const layers = scene.SCENE_LAYERS.map((layer) => ({ id: layer.id, declared: layer.rect, ...read(layer.src) }));
    const thumbs = scene.HIDDEN_OBJECTS.map((target) => read(scene.thumbnailSrc(target.id)));
    const visual = t.visuals[STUDIO];
    const hero = read(visual.introArt);
    const layerBytes = layers.reduce((sum, layer) => sum + layer.bytes, 0);
    const entryBytes = layerBytes + thumbs.reduce((sum, thumb) => sum + thumb.bytes, 0) + hero.bytes;
    const homeMaquette = folderDiff(tree, BASE_TREE, HOME_MAQUETTE);
    const facts = {
      kitV1: scene.SCENE_ASSET_BASE === KIT_BASE,
      v0NoLongerServed: listFiles(tree, V0_FOLDER).length === 0,
      layersAsDeclared: layers.every((layer) => layer.size && layer.size.width === layer.declared.w && layer.size.height === layer.declared.h),
      thumbsPresent: thumbs.every((thumb) => thumb.size && thumb.size.width === thumb.size.height && thumb.size.width >= 64),
      introFromTheSameKit: visual.introArt.startsWith(KIT_BASE) && visual.transitionArt.startsWith(KIT_BASE) && Boolean(hero.size),
      homeMaquetteUntouched: homeMaquette.length === 0,
      layersBudget: layerBytes <= LAYERS_BUDGET_BYTES,
      entryBudget: entryBytes <= ENTRY_BUDGET_BYTES,
    };
    return {
      pass: Object.values(facts).every(Boolean),
      ...facts,
      layers: layers.map((layer) => `${layer.id} ${layer.size?.width}×${layer.size?.height} ${(layer.bytes / 1024).toFixed(1)} KB`),
      entry: `${(entryBytes / 1024).toFixed(1)} KB (layers ${(layerBytes / 1024).toFixed(1)} KB)`,
      homeMaquetteChanged: homeMaquette,
    };
  });

  await check("E31", "experience", "FOUND_FEEDBACK_IS_CALM_AND_NAMED", () => {
    const studio = openStudio(tree, { seeds: [seedListing(tree, "easy", ["lupa", "bussola"])] });
    studio.start("easy");
    studio.find("lupa");
    const first = {
      ring: fxEntries(studio, "hos-found-ring").length,
      tags: fxEntries(studio, "hos-found-tag").map((entry) => entry.text),
      seals: fxEntries(studio, "hos-found-seal").length,
    };
    studio.find("bussola");
    const second = {
      ringOn: fxEntries(studio, "hos-found").filter((entry) => entry.children?.some?.((child) => child?.props?.className === "hos-found-ring")).map((entry) => entry.props["data-target"]),
      rings: fxEntries(studio, "hos-found-ring").length,
      tags: fxEntries(studio, "hos-found-tag").map((entry) => entry.text),
      seals: fxEntries(studio, "hos-found-seal").length,
    };
    studio.unmount();
    const css = tree.read(FILES.css);
    const loud = /confetti|shake|explod/i.test(css) || /#(?:f00|ff0000|e53935|d32f2f)\b/i.test(css);
    const facts = {
      firstFind: first.ring === 1 && same(first.tags, ["Lupa"]) && first.seals === 1,
      onlyTheLatestSpeaks: second.rings === 1 && same(second.tags, ["Bússola"]) && second.seals === 2,
      nothingLoud: !loud,
    };
    return { pass: Object.values(facts).every(Boolean), ...facts, first, second: { rings: second.rings, tags: second.tags, seals: second.seals } };
  });

  await check("E32", "preserved", "GESTURES_STILL_NEVER_MISFIRE", () => {
    // the controller: a drag (out and back, so the room returns under the pointer) emits no tap
    const rig = openRig(tree);
    const from = rig.centre();
    rig.pointer("pointerdown", { pointerId: 1, clientX: from.x, clientY: from.y, pointerType: "touch", button: 0 });
    for (const dx of [20, 40, 60, 40, 20, 0]) {
      rig.pointer("pointermove", { pointerId: 1, clientX: from.x + dx, clientY: from.y, pointerType: "touch" });
      rig.frame();
    }
    rig.pointer("pointerup", { pointerId: 1, clientX: from.x, clientY: from.y, pointerType: "touch", button: 0 });
    rig.settle();
    const controllerDrag = rig.taps.length === 0;
    rig.controller.destroy();
    // the game, in Difícil: the same out-and-back drag starting on the Lupa finds nothing; a pinch on it neither; a tap does
    const studio = openStudio(tree, { seeds: [seedListing(tree, "hard", ["lupa"])] });
    studio.start("hard");
    studio.goTo("mesa");
    const p = studio.targetClient("lupa");
    studio.pointer("pointerdown", { pointerId: 2, clientX: p.x, clientY: p.y, pointerType: "touch", button: 0 });
    for (const dx of [20, 40, 60, 40, 20, 0]) {
      studio.pointer("pointermove", { pointerId: 2, clientX: p.x + dx, clientY: p.y, pointerType: "touch" });
      studio.frames(1);
    }
    studio.pointer("pointerup", { pointerId: 2, clientX: p.x, clientY: p.y, pointerType: "touch", button: 0 });
    studio.settle();
    const dragFindsNothing = studio.found().length === 0;
    studio.pinch(studio.targetClient("lupa"));
    studio.settle();
    const pinchFindsNothing = studio.found().length === 0;
    studio.tapAt(studio.targetClient("lupa"));
    const tapFinds = studio.found().length === 1;
    studio.unmount();
    return { pass: controllerDrag && dragFindsNothing && pinchFindsNothing && tapFinds, controllerDrag, dragFindsNothing, pinchFindsNothing, tapFinds };
  });


  // --- Difficulty V2, measured in the art over every round ---------------------------------------------

  await check("E33", "experience", "DIFICIL_IS_HARDER_IN_THE_ART_ITSELF", () => {
    // Not only other constants: over every list each difficulty can show, the objects Difícil asks for are
    // more covered (the measured audit's visible share) and stand among more look-alikes than Fácil's.
    const { scene } = pureModules(tree);
    const kit = scene.SCENE_ASSET_BASE.split("/").pop();
    const audit = JSON.parse(tree.read(`docs/archive/hidden-objects/explorer-studio/review/${kit}/fairness.json`));
    const rows = Object.fromEntries(audit.targets.map((row) => [row.id, row]));
    const looks = (id) => (scene.SCENE_LOOKALIKES ?? []).filter((l) => l.resembles === id).length;
    const profile = Object.fromEntries(
      DIFFICULTIES.map((d) => {
        const lists = possibleRounds(tree, d);
        const visible = lists.map((list) => mean(list.map((id) => rows[id].visible)));
        return [d, { lists: lists.length, visible: Number(mean(visible).toFixed(3)), lookAlikes: Number(mean(lists.map((list) => mean(list.map(looks)))).toFixed(3)) }];
      }),
    );
    const facts = {
      lessVisibleAsItClimbs: profile.easy.visible > profile.medium.visible && profile.medium.visible > profile.hard.visible,
      dificilClearlyMoreCovered: profile.easy.visible - profile.hard.visible >= 0.05,
      moreLookAlikesInDificil: profile.hard.lookAlikes > profile.easy.lookAlikes,
    };
    return { pass: Object.values(facts).every(Boolean), ...facts, profile };
  });

  // --- the target pool (the addendum: TARGET POOL / ROUND VARIATION V1) --------------------------------

  await check("P01", "pool", "THE_POOL_IS_AUTHORED_AND_LARGER_THAN_ANY_ROUND", () => {
    const { scene } = pureModules(tree);
    const pool = scene.HIDDEN_OBJECTS;
    const largest = Math.max(...DIFFICULTIES.map((d) => scene.DIFFICULTY_PRESETS[d].count ?? scene.DIFFICULTY_PRESETS[d].targets?.length ?? 0));
    // positions are authored: every region (pool and look-alikes) is a literal in the scene module, nothing computes one
    const literal = /region: \{ kind: "(?:rect", x: \d+, y: \d+, w: \d+, h: \d+|circle", cx: \d+, cy: \d+, r: \d+) \}/g;
    const literalRegions = [...tree.read(FILES.scene).matchAll(literal)].length;
    const regions = pool.length + (scene.SCENE_LOOKALIKES?.length ?? 0);
    const tiers = tierCount({ targetById: (id) => pool.find((t) => t.id === id) }, pool.map((t) => t.id));
    const grid = Object.fromEntries(scene.SCENE_STATIONS.map((s) => [s.id, Object.fromEntries(["A", "B", "C"].map((tier) => [tier, pool.filter((t) => t.station === s.id && t.tier === tier).length]))]));
    const facts = {
      atLeastTwiceTheLargestRound: pool.length >= 2 * largest,
      regionsAreLiterals: literalRegions === regions,
      balancedTiers: same(tiers, POOL_TIERS),
      everyStationHoldsEveryTier: Object.values(grid).every((row) => Object.values(row).every((n) => n >= 1)),
    };
    return { pass: Object.values(facts).every(Boolean), ...facts, pool: pool.length, largestRound: largest, literalRegions, tiers, stationsByTier: grid };
  });

  await check("P02", "pool", "EVERY_POOL_OBJECT_CARRIES_ITS_METADATA", () => {
    const { scene, model } = pureModules(tree);
    const listable = Object.fromEntries(DIFFICULTIES.map((d) => [d, new Set(listableIn(tree, d))]));
    const problems = [];
    for (const t of scene.HIDDEN_OBJECTS) {
      for (const field of ["label", "accessibleLabel", "clue", "hintRegion", "hintDirection", "hintContext"]) {
        if (typeof t[field] !== "string" || !t[field].trim()) problems.push(`${t.id}: no ${field}`);
      }
      if (!["A", "B", "C"].includes(t.tier)) problems.push(`${t.id}: tier`);
      if (!scene.SCENE_STATIONS.some((station) => station.id === t.station)) problems.push(`${t.id}: station`);
      if (t.listedAs !== undefined && !(Array.isArray(t.listedAs) && t.listedAs.length && t.listedAs.every((style) => ["picture", "silhouette", "clue"].includes(style)))) problems.push(`${t.id}: listedAs`);
      if (!tree.exists(`public${scene.thumbnailSrc(t.id)}`)) problems.push(`${t.id}: no thumbnail`);
      // every rung of every ladder that can ask for it has its words
      for (const d of DIFFICULTIES) {
        if (!listable[d].has(t.id)) continue;
        (scene.DIFFICULTY_PRESETS[d].hintLadder ?? []).forEach((rung, index) => {
          if (!model.hintMessage(t.id, d, index + 1)) problems.push(`${t.id}: ${d} "${rung}" says nothing`);
        });
      }
    }
    const counts = Object.fromEntries(DIFFICULTIES.map((d) => [d, listable[d].size]));
    const roomToDraw = DIFFICULTIES.every((d) => counts[d] >= 1.5 * DIFFICULTY_V2[d].size);
    return { pass: problems.length === 0 && roomToDraw, listablePerDifficulty: counts, roomToDraw, problems: problems.slice(0, 10), problemCount: problems.length };
  });

  await check("P03", "pool", "EVERY_POSSIBLE_ROUND_IS_VALID", () => {
    // exhaustive: the product's enumeration, every round of it checked, and compared with an independent brute force
    const { scene, model, rounds } = pureModules(tree);
    if (!rounds) throw new Error("no round selection on this tree: the lists are fixed");
    const coverage = {};
    const problems = [];
    for (const d of DIFFICULTIES) {
      const preset = scene.DIFFICULTY_PRESETS[d];
      const all = rounds.validRounds(d);
      const fewest = Math.floor(preset.count / scene.SCENE_STATIONS.length);
      const most = Math.ceil(preset.count / scene.SCENE_STATIONS.length);
      for (const round of all) {
        const targets = round.map((id) => model.targetById(id));
        if (round.length !== DIFFICULTY_V2[d].size || new Set(round).size !== round.length) problems.push(`${d}: ${round.join()} size/duplicate`);
        if (!same(tierCount(model, round), DIFFICULTY_V2[d].tiers)) problems.push(`${d}: ${round.join()} mix`);
        for (const station of scene.SCENE_STATIONS) {
          const held = targets.filter((t) => t.station === station.id).length;
          if (held < fewest || held > most) problems.push(`${d}: ${round.join()} ${station.id} holds ${held}`);
        }
        for (const t of targets) {
          if (t.listedAs && !t.listedAs.includes(preset.listStyle)) problems.push(`${d}: ${t.id} cannot be shown as ${preset.listStyle}`);
          for (let stage = 1; stage <= preset.hintLadder.length; stage += 1) {
            if (!model.hintMessage(t.id, d, stage)) problems.push(`${d}: ${t.id} stage ${stage} silent`);
            if (d === "hard" && (model.hintHalo(t.id, d, stage) !== null || (stage > 1 && model.hintCameraMove(t.id, d, stage) !== null))) problems.push(`hard: ${t.id} points at stage ${stage}`);
          }
        }
      }
      const independent = bruteForceRounds(scene.HIDDEN_OBJECTS, preset, scene.SCENE_STATIONS);
      const product = all.map((round) => [...round].sort().join());
      const agree = same(sorted(product), sorted(independent));
      coverage[d] = { rounds: all.length, bruteForce: independent.length, sameRounds: agree };
      if (!agree) problems.push(`${d}: the enumeration (${all.length}) and the brute force (${independent.length}) disagree`);
    }
    return { pass: problems.length === 0, coverage, problems: problems.slice(0, 10), problemCount: problems.length };
  });

  await check("P04", "pool", "THE_SAME_SEED_ALWAYS_DRAWS_THE_SAME_ROUND", () => {
    const { model, rounds } = pureModules(tree);
    if (!rounds) throw new Error("no round selection on this tree: the lists are fixed");
    const seeds = Array.from({ length: 400 }, (_, i) => Math.imul(i + 1, 2654435761) >>> 0);
    const unstable = [];
    for (const d of DIFFICULTIES) {
      for (const seed of seeds) {
        const a = rounds.selectRoundTargets(d, seed);
        const b = rounds.selectRoundTargets(d, seed);
        const session = startSession(model, d, seed);
        if (!same(a, b) || !same(model.pendingTargets(session), a) || session.roundSeed !== seed) unstable.push(`${d}/${seed}`);
      }
    }
    // a module graph of its own (no state shared with the first): the very same lists
    const fresh = createModuleGraph({ tree, mocks: {}, globals: {} }).require(FILES.rounds);
    const freshDiffers = DIFFICULTIES.flatMap((d) => seeds.slice(0, 60).filter((seed) => !same(fresh.selectRoundTargets(d, seed), rounds.selectRoundTargets(d, seed))).map((seed) => `${d}/${seed}`));
    return {
      pass: unstable.length === 0 && freshDiffers.length === 0,
      draws: DIFFICULTIES.length * seeds.length,
      unstable: unstable.slice(0, 5),
      freshDiffers: freshDiffers.slice(0, 5),
      example: { difficulty: "hard", seed: seeds[0], list: rounds.selectRoundTargets("hard", seeds[0]) },
    };
  });

  await check("P05", "pool", "SEEDS_REACH_EVERY_ROUND_WITHOUT_BIAS", () => {
    const { scene, rounds } = pureModules(tree);
    if (!rounds) throw new Error("no round selection on this tree: the lists are fixed");
    const SAMPLES = 30000;
    const report = {};
    const problems = [];
    for (const d of DIFFICULTIES) {
      const valid = rounds.validRounds(d);
      const index = new Map(valid.map((round, i) => [[...round].sort().join(), i]));
      const roundHits = new Array(valid.length).fill(0);
      const itemHits = new Map();
      const firstStation = Object.fromEntries(scene.SCENE_STATIONS.map((s) => [s.id, 0]));
      const next = lcg(0x9e3779b9 + d.length);
      let invalid = 0;
      for (let i = 0; i < SAMPLES; i += 1) {
        const seed = Math.floor(next() * 2 ** 32) >>> 0;
        const list = rounds.selectRoundTargets(d, seed);
        const key = [...list].sort().join();
        if (new Set(list).size !== list.length || !index.has(key)) {
          invalid += 1;
          continue;
        }
        roundHits[index.get(key)] += 1;
        for (const id of list) itemHits.set(id, (itemHits.get(id) ?? 0) + 1);
        firstStation[scene.HIDDEN_OBJECTS.find((t) => t.id === list[0]).station] += 1;
      }
      // what "every valid round equally likely" means for each object, exactly
      const exact = new Map();
      for (const round of valid) for (const id of round) exact.set(id, (exact.get(id) ?? 0) + 1 / valid.length);
      const reached = roundHits.filter((n) => n > 0).length;
      const expected = (SAMPLES - invalid) / valid.length;
      const chiSquare = roundHits.reduce((sum, n) => sum + (n - expected) ** 2 / expected, 0);
      const dof = valid.length - 1;
      const z = (chiSquare - dof) / Math.sqrt(2 * dof);
      const deviation = Math.max(...[...exact].map(([id, p]) => Math.abs((itemHits.get(id) ?? 0) / SAMPLES - p)));
      // Exposure inside a tier cannot be equal: every round takes ⌊k/3⌋..⌈k/3⌉ objects from each station, and
      // the room gives the Janela 5 objects, the Mesa 7 and the Estante 6, so a Janela object is asked more
      // often than a Mesa one of the same tier. What must hold is that no listable object is starved or
      // hogs its tier: each is asked between half and twice as often as its tier's mean (the tier's count
      // over the objects the list style can show). The max/min ratio is reported as measured.
      const preset = scene.DIFFICULTY_PRESETS[d];
      const byTier = {};
      const exposure = {};
      for (const t of scene.HIDDEN_OBJECTS) {
        const listable = !t.listedAs || t.listedAs.includes(preset.listStyle);
        if (!listable || !preset.tiers[t.tier]) continue;
        (byTier[t.tier] ??= []).push([t.id, exact.get(t.id) ?? 0]);
      }
      for (const [tier, rows] of Object.entries(byTier)) {
        const mean = preset.tiers[tier] / rows.length;
        const share = rows.map(([id, p]) => [id, p / mean]);
        exposure[tier] = {
          mean: Number(mean.toFixed(3)),
          leastAsked: share.reduce((a, b) => (b[1] < a[1] ? b : a)).map((v) => (typeof v === "number" ? Number(v.toFixed(2)) : v)),
          mostAsked: share.reduce((a, b) => (b[1] > a[1] ? b : a)).map((v) => (typeof v === "number" ? Number(v.toFixed(2)) : v)),
          maxOverMin: Number((Math.max(...rows.map(([, p]) => p)) / Math.min(...rows.map(([, p]) => p))).toFixed(2)),
        };
        for (const [id, ratio] of share) {
          if (ratio < 0.5) problems.push(`${d}: ${id} is asked for under half as often as its tier's mean (${ratio.toFixed(2)})`);
          if (ratio > 2) problems.push(`${d}: ${id} is asked for over twice as often as its tier's mean (${ratio.toFixed(2)})`);
        }
      }
      const firstShare = Object.fromEntries(Object.entries(firstStation).map(([s, n]) => [s, Number((n / SAMPLES).toFixed(3))]));
      if (invalid) problems.push(`${d}: ${invalid} drawn lists were not valid rounds`);
      if (reached !== valid.length) problems.push(`${d}: ${reached}/${valid.length} rounds reached`);
      if (Math.abs(z) > 4) problems.push(`${d}: round frequencies off (z = ${z.toFixed(1)})`);
      if (deviation > 0.015) problems.push(`${d}: an object's frequency is off by ${deviation.toFixed(3)}`);
      if (Object.values(firstShare).some((share) => share < 0.15)) problems.push(`${d}: the list's first line favours a station`);
      report[d] = {
        validRounds: valid.length,
        reached,
        chiSquareZ: Number(z.toFixed(2)),
        maxObjectDeviation: Number(deviation.toFixed(4)),
        objectProbability: { min: Number(Math.min(...exact.values()).toFixed(3)), max: Number(Math.max(...exact.values()).toFixed(3)) },
        exposureByTier: exposure,
        firstLineStation: firstShare,
      };
    }
    return { pass: problems.length === 0, samplesPerDifficulty: SAMPLES, report, problems: problems.slice(0, 8) };
  });

  await check("P06", "pool", "THE_ROUND_HOLDS_THROUGH_EVERYTHING_THE_SESSION_DOES", () => {
    const seed = 0xc0ffee;
    const studio = openStudio(tree, { seeds: [seed] });
    studio.start("medium");
    const first = studio.round();
    const rendersAtStart = studio.renders();
    const drift = [];
    const holds = (step) => {
      const now = studio.round();
      if (!same(now, first)) drift.push({ step, now });
    };
    const centre = studio.centre();
    studio.drag(centre, { x: centre.x - 160, y: centre.y + 30 }, { steps: 6 });
    studio.settle();
    holds("pan");
    studio.wheel(centre, -240);
    studio.settle();
    holds("wheel zoom");
    studio.click((entry) => entry.props["aria-label"] === "Aproximar");
    studio.settle();
    holds("+ button");
    studio.pinch(studio.centre());
    studio.settle();
    holds("pinch");
    for (const station of ["Janela", "Mesa", "Estante"]) {
      studio.clickStation(station);
      studio.settle();
      holds(`station ${station}`);
    }
    studio.click((entry) => entry.props["aria-label"] === "Recentrar");
    studio.settle();
    holds("recentre");
    studio.resize({ width: 596, height: 337 });
    holds("resize to a phone turned sideways");
    studio.resize({ width: 390, height: 662 });
    holds("resize back upright");
    for (let i = 0; i < 4; i += 1) {
      studio.clickHint();
      studio.settle();
    }
    holds("every rung of Pista");
    studio.focusTarget(first.ids[2]);
    holds("a line picked");
    studio.click(studio.cls("hos-tray-toggle"));
    holds("tray folded");
    studio.click(studio.cls("hos-tray-toggle"));
    holds("tray unfolded");
    studio.env.setReducedMotion(true);
    studio.clickStation("Janela");
    studio.frames(4);
    holds("reduced motion turned on");
    studio.find(first.ids[0]);
    holds("a find");
    studio.frames(120);
    holds("idle frames");
    const renders = studio.renders() - rendersAtStart;
    const draws = studio.env.random.calls;
    studio.unmount();
    return {
      pass: drift.length === 0 && renders >= 10 && draws === 1 && first.seed === seed && first.ids.length === 6,
      seed: first.seed,
      list: first.ids,
      rendersDuringTheRound: renders,
      seedsDrawn: draws,
      drift: drift.slice(0, 3),
    };
  });

  await check("P07", "pool", "RECOMECAR_KEEPS_THE_ROUND", () => {
    const { model } = pureModules(tree);
    const seed = 424242;
    let s = startSession(model, "hard", seed);
    const drawn = [...s.targets];
    s = model.sessionReducer(s, tapOn(model, drawn[0]));
    const restarted = model.sessionReducer(s, { type: "restart" });
    const reducer = same(restarted.targets, drawn) && restarted.roundSeed === seed && restarted.foundIds.length === 0 && restarted.status === "playing";
    const studio = openStudio(tree, { seeds: [seed] });
    studio.start("hard");
    const before = studio.round();
    studio.find(before.ids[1]);
    studio.click((entry) => entry.props["aria-label"] === "Recomeçar a exploração");
    studio.settle();
    const after = studio.round();
    const draws = studio.env.random.calls;
    const cleared = studio.found().length === 0;
    studio.unmount();
    const game = same(after, before) && draws === 1 && cleared;
    return { pass: reducer && game, reducer, game, seed, before: before.ids, after: after.ids, seedsDrawn: draws };
  });

  await check("P08", "pool", "A_NEW_EXPLORATION_DRAWS_A_NEW_ROUND", () => {
    const { rounds } = pureModules(tree);
    if (!rounds) throw new Error("no round selection on this tree: the lists are fixed");
    // two fresh entries (a new mount each — "Praticar outra vez" and an entry from the Home both are), each
    // handed its own seed by the platform's random source
    const entries = [11, 12].map((seed) => {
      const studio = openStudio(tree, { seeds: [seed] });
      studio.frames(30);
      const quietInSetup = studio.env.random.calls === 0 && studio.round().ids.length === 0;
      studio.start("easy");
      const round = studio.round();
      const draws = studio.env.random.calls;
      studio.unmount();
      return { seed, round, quietInSetup, draws };
    });
    const listsDiffer = !same(sorted(entries[0].round.ids), sorted(entries[1].round.ids));
    const asDrawn = entries.every(({ seed, round }) => round.seed === seed && same(round.ids, rounds.selectRoundTargets("easy", seed)));
    return {
      pass: listsDiffer && asDrawn && entries.every((e) => e.quietInSetup && e.draws === 1),
      listsDiffer,
      entries: entries.map((e) => ({ seed: e.round.seed, list: e.round.ids, nothingDrawnInSetup: e.quietInSetup, seedsDrawn: e.draws })),
    };
  });

  await check("P09", "pool", "UNLISTED_POOL_OBJECTS_ARE_SCENERY", () => {
    const { scene, model } = pureModules(tree);
    const studio = openStudio(tree, { seeds: [2026] });
    studio.start("medium");
    const { ids } = studio.round();
    const unlisted = scene.HIDDEN_OBJECTS.map((t) => t.id).filter((id) => !ids.includes(id));
    const counted = [];
    for (const id of unlisted) {
      studio.goTo(model.targetById(id).station);
      const before = studio.found().length;
      studio.tapAt(studio.targetClient(id), { pointerType: "touch" });
      studio.settle();
      if (studio.found().length !== before) counted.push(id);
    }
    const found = ids.slice(0, 2);
    for (const id of found) studio.find(id);
    // nothing in the room tells a listed object from the rest: only what was found is marked
    const world = studio.harness.hosts(studio.cls("hos-world"))[0];
    const marked = studio.harness.hosts((entry) => entry.props["data-target"] !== undefined && world && entry.path.startsWith(world.path)).map((entry) => entry.props["data-target"]);
    studio.unmount();
    return {
      pass: unlisted.length >= ids.length && counted.length === 0 && same(sorted(marked), sorted(found)),
      listed: ids,
      unlistedTapped: unlisted.length,
      countedAsFinds: counted,
      markedInTheRoom: marked,
    };
  });

  await check("P10", "pool", "THE_RESULT_RECORDS_ITS_ROUND", () => {
    const { rounds } = pureModules(tree);
    const t = platformTables(tree);
    const seed = 31337;
    const studio = openStudio(tree, { seeds: [seed] });
    studio.start("easy");
    const { ids } = studio.round();
    for (const id of ids) studio.find(id);
    studio.frames(60);
    studio.click(studio.cls("hos-primary"));
    const [result] = studio.calls.complete;
    studio.unmount();
    const replayed = rounds ? rounds.selectRoundTargets(result.details.difficulty, result.details.roundSeed) : null;
    const shown = t.labels.formatResultDetails(result.details, t.rewards.getResultPresentation({ gameId: STUDIO })).map((line) => line.key);
    return {
      pass: result.details.roundSeed === seed && same(replayed, ids) && result.details.totalObjects === ids.length && !shown.includes("roundSeed"),
      roundSeed: result.details.roundSeed ?? null,
      replayed,
      listed: ids,
      shownOnTheResultScreen: shown,
    };
  });

  await check("P11", "pool", "DIFICIL_NEVER_REVEALS_ANYTHING_IT_CAN_LIST", () => {
    const { model } = pureModules(tree);
    const listable = listableIn(tree, "hard");
    const problems = [];
    for (const id of listable) {
      const t = model.targetById(id);
      for (let stage = 0; stage <= 3; stage += 1) {
        const rung = model.hintRung("hard", stage);
        if (["reveal", "area", "wide-area"].includes(rung)) problems.push(`${id}: rung ${rung}`);
        if (model.hintHalo(id, "hard", stage) !== null) problems.push(`${id}: a halo at ${stage}`);
        const move = model.hintCameraMove(id, "hard", stage);
        if (stage === 1 ? !(move?.kind === "station" && move.station === t.station) : move !== null) problems.push(`${id}: the camera at ${stage}`);
        const words = model.hintMessage(id, "hard", stage);
        if (normalizeText(words).includes(normalizeText(t.label)) || /Aqui está/.test(words)) problems.push(`${id}: the words name it at ${stage}`);
      }
    }
    return {
      pass: problems.length === 0 && model.revealsExactly("hard") === false && listable.length >= 1.5 * DIFFICULTY_V2.hard.size,
      listableInDificil: listable.length,
      problems: problems.slice(0, 8),
    };
  });

  await check("P12", "pool", "LIST_STYLES_ONLY_SHOW_WHAT_THEY_CAN", () => {
    const { scene } = pureModules(tree);
    const plain = scene.HIDDEN_OBJECTS.filter((t) => t.listedAs && !t.listedAs.includes("silhouette")).map((t) => t.id);
    const medioListingThem = possibleRounds(tree, "medium").filter((round) => round.some((id) => plain.includes(id))).length;
    const shownElsewhere = plain.filter((id) => ["easy", "hard"].every((d) => possibleRounds(tree, d).some((round) => round.includes(id))));
    return {
      pass: plain.length > 0 && medioListingThem === 0 && same(shownElsewhere, plain),
      plainOutlines: plain,
      medioRoundsListingThem: medioListingThem,
      listedByPictureAndByClue: shownElsewhere,
    };
  });

  return results;
}

// --- mutants (in memory only) -------------------------------------------------------------------------

/**
 * Each mutant is a set of textual edits to today's tree, applied in memory with
 * `openSourceTree({ sourceOverrides })`. Every anchor must appear exactly once.
 */
const MUTANTS = [
  {
    name: "Difícil regains the exact reveal",
    files: { [FILES.scene]: [['    hintLadder: ["station", "context"],', '    hintLadder: ["station", "context", "reveal"],']] },
    mustFail: ["E03", "E08", "E10", "P11"],
  },
  {
    name: "a halo is added to Difícil's context hint",
    files: { [FILES.model]: [['  if (rung !== "area" && rung !== "wide-area") return null;', '  if (rung !== "area" && rung !== "wide-area" && rung !== "context") return null;']] },
    mustFail: ["E08", "E09"],
  },
  {
    name: "Difícil's list names the objects again",
    files: { [FILES.model]: [["    return { id, found, text: target.clue, answered: null, art: null, accessibleText: `${target.clue} Procurar.` };", "    return { id, found, text: target.label, answered: null, art: null, accessibleText: `${target.accessibleLabel}: procurar` };"]] },
    mustFail: ["E04", "E05"],
  },
  {
    name: "a drag selects a target",
    files: {
      [FILES.gesture]: [['  if (state.phase === "pressed") {\n    const origin = state.origin!;\n    const quick', '  if (state.phase === "pressed" || state.phase === "panning") {\n    const origin = state.origin!;\n    const quick']],
    },
    mustFail: ["E01", "E32"],
  },
  {
    name: "parallax contaminates the hit test",
    files: {
      [FILES.controller]: [
        [
          "      point: viewportToScene(point, this.camera, this.size),",
          "      point: viewportToScene({ x: point.x + parallaxOffset(this.camera, 1.05, false).x * scaleOf(this.camera, this.size), y: point.y }, this.camera, this.size),",
        ],
      ],
    },
    mustFail: ["E01", "E18"],
  },
  {
    name: "every difficulty climbs the same ladder",
    files: {
      [FILES.scene]: [
        ['    hintLadder: ["station", "wide-area", "direction"],', '    hintLadder: ["station", "area", "reveal"],'],
        ['    hintLadder: ["station", "context"],', '    hintLadder: ["station", "area", "reveal"],'],
      ],
    },
    mustFail: ["E03", "E07", "E08"],
  },
  {
    name: "a target moved out of reach",
    files: { [FILES.scene]: [['    region: { kind: "rect", x: 2615, y: 245, w: 84, h: 122 },', '    region: { kind: "rect", x: 3150, y: 245, w: 84, h: 122 },']] },
    mustFail: ["E17"],
  },
  {
    name: "reduced motion still animates the found ring",
    files: { [FILES.css]: [["  .hos-found-ring {\n    animation: hos-halo-life-still 1.4s steps(1, end) forwards;\n  }\n\n", ""]] },
    mustFail: ["E19"],
  },
  {
    name: "every pointermove pushes the camera into React state",
    files: {
      [FILES.controller]: [
        [
          "        this.camera = panBy(this.camera, effect.dx, effect.dy, this.size);\n        this.moving = true;\n        this.requestRender();\n        return;",
          '        this.camera = panBy(this.camera, effect.dx, effect.dy, this.size);\n        this.moving = true;\n        this.requestRender();\n        this.lastView = "";\n        this.notifySettle();\n        return;',
        ],
      ],
    },
    mustFail: ["E01", "E20"],
  },
  {
    name: "number-trail becomes active again",
    files: {
      [FILES.types]: [['  | "hidden-objects"\n', '  | "hidden-objects"\n  | "number-trail"\n']],
      [FILES.stages]: [['  "hidden-objects",\n', '  "hidden-objects",\n  "number-trail",\n']],
    },
    mustFail: ["E26"],
  },
  {
    name: "Médio regains the exact reveal",
    files: { [FILES.scene]: [['    hintLadder: ["station", "wide-area", "direction"],', '    hintLadder: ["station", "wide-area", "reveal"],']] },
    mustFail: ["E03", "E07"],
  },
  {
    name: "a look-alike sits on its target",
    files: { [FILES.scene]: [['    region: { kind: "rect", x: 1410, y: 1180, w: 32, h: 28 },', '    region: { kind: "rect", x: 1360, y: 1180, w: 32, h: 28 },']] },
    mustFail: ["E16"],
  },
  {
    name: "the result shows a bare number again",
    files: { [FILES.rewards]: [['      scoreLabel: "Objetos encontrados",\n', ""]] },
    mustFail: ["E15"],
  },
  {
    name: "the found name is never shown",
    files: { [FILES.sceneView]: [["                {feedback.latestFound?.label}\n", ""]] },
    mustFail: ["E05", "E31"],
  },
  {
    name: "the objectives cannot fold away",
    files: { [FILES.game]: [["              onClick={() => setTrayOpen((open) => !open)}", "              onClick={() => setTrayOpen(true)}"]] },
    mustFail: ["E28"],
  },
  {
    name: "the Rota is touched",
    files: { "src/games/escape-maze/continuation.ts": [["export ", "// touched\nexport "]] },
    mustFail: ["E22"],
  },
  {
    name: "a runtime dependency is added",
    files: { "package.json": [['    "canvas-confetti": "^1.9.4",\n', '    "canvas-confetti": "^1.9.4",\n    "left-pad": "^1.3.0",\n']] },
    mustFail: ["E25"],
  },
  {
    name: "hints start costing",
    files: { [FILES.model]: [["    score: state.foundIds.length,\n", "    score: Math.max(0, state.foundIds.length - state.hintSeq),\n"]] },
    mustFail: ["E11", "E14"],
  },
  // --- the target pool's invariants (the addendum), one product rule each ---------------------------
  {
    name: "every seed draws the same round",
    files: { [FILES.rounds]: [["  const list = [...rounds[Math.floor(random() * rounds.length)]];", "  const list = [...rounds[0]];"]] },
    mustFail: ["P05", "P08"],
  },
  {
    name: "the difficulty's tier mix is ignored",
    files: { [FILES.rounds]: [["    const picks = combinations(eligible.filter((target) => target.tier === tier), preset.tiers[tier]);", '    const picks = tier === "A" ? combinations(eligible, preset.count) : [[]];']] },
    mustFail: ["E03", "P03"],
  },
  {
    name: "a round may list an object twice",
    files: { [FILES.rounds]: [["  return list;\n}", "  list[list.length - 1] = list[0];\n  return list;\n}"]] },
    mustFail: ["P05"],
  },
  {
    name: "rounds no longer spread over the stations",
    files: { [FILES.rounds]: [["        return held >= spread.min && held <= spread.max;", "        return held >= 0;"]] },
    mustFail: ["P03"],
  },
  {
    name: "the list is drawn again on every render",
    files: {
      [FILES.game]: [
        ['import "@/games/hidden-objects/hidden-objects.css";', 'import "@/games/hidden-objects/hidden-objects.css";\nimport { selectRoundTargets } from "@/games/hidden-objects/hidden-objects-rounds";'],
        ["  const listed = state.targets;", '  const listed = state.status === "setup" ? state.targets : selectRoundTargets(state.difficulty, freshRoundSeed());'],
      ],
    },
    mustFail: ["P06"],
  },
  {
    name: "a round lists one object too few",
    files: { [FILES.rounds]: [["  return list;\n}", "  return list.slice(1);\n}"]] },
    mustFail: ["P05"],
  },
  {
    name: "the seed is ignored: Math.random draws the round",
    files: { [FILES.rounds]: [["  const random = seededRandom(seed);", "  const random = Math.random;"]] },
    mustFail: ["P04"],
  },
  {
    name: "Recomeçar draws a new list",
    files: {
      [FILES.model]: [
        [
          '      return state.status === "setup" ? state : freshRound(state);',
          '      return state.status === "setup" ? state : freshRound({ ...state, targets: selectRoundTargets(state.difficulty, ((state.roundSeed ?? 0) + 1) >>> 0), roundSeed: ((state.roundSeed ?? 0) + 1) >>> 0 });',
        ],
      ],
    },
    mustFail: ["P07"],
  },
  {
    name: "every pool object answers a tap, listed or not",
    files: { [FILES.model]: [["      const listed = state.targets;", "      const listed = HIDDEN_OBJECTS.map((target) => target.id);"]] },
    mustFail: ["P09"],
  },
  {
    name: "Médio lists a framed picture by its outline",
    files: { [FILES.rounds]: [["  const eligible = source.pool.filter((target) => listableIn(target, preset));", "  const eligible = source.pool;"]] },
    mustFail: ["P12"],
  },
  {
    name: "a fresh entry repeats the last list",
    files: { [FILES.game]: [["  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];", "  return 1;"]] },
    mustFail: ["P08"],
  },
  {
    name: "the result forgets its round",
    files: { [FILES.model]: [["      roundSeed: state.roundSeed ?? 0,\n", ""]] },
    mustFail: ["P10"],
  },
  {
    name: "a pool object loses its hint words",
    files: { [FILES.scene]: [['    hintContext: "presa num gancho, perto de uma planta pendurada",\n', ""]] },
    mustFail: ["P02"],
  },
];

function mutate(worktree, mutant) {
  const overrides = {};
  for (const [file, edits] of Object.entries(mutant.files)) {
    let text = worktree.read(file);
    for (const [from, to] of edits) {
      const count = text.split(from).length - 1;
      if (count !== 1 && !(file.endsWith("continuation.ts") && count >= 1)) throw new Error(`anchor ${JSON.stringify(clip(from, 70))} appears ${count}x in ${file}`);
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

  // every check of a baseline's `mustFail` tags must fail there, every other one must hold
  const baselines = [
    { tree: BASE_TREE, label: "the skeleton the playtest played", mustFail: ["experience", "pool"] },
    { tree: openSourceTree({ rev: RECOVERED }), label: "this mission before the addendum: Difficulty V2, fixed lists", mustFail: ["pool"] },
  ];
  for (const baseline of baselines) {
    const results = await runChecks(baseline.tree);
    const contract = results.filter((r) => baseline.mustFail.includes(r.tag));
    const kept = results.filter((r) => !baseline.mustFail.includes(r.tag));
    const contractHolding = contract.filter((r) => r.pass).map((r) => r.id);
    const keptBroken = kept.filter((r) => !r.pass).map((r) => r.id);
    const held = contractHolding.length === 0 && keptBroken.length === 0;
    ok &&= held;
    console.log(`${held ? "CAUGHT" : "MISSED"}  base ${baseline.tree.rev.slice(0, 8)} — ${baseline.label}`);
    for (const tag of ["experience", "pool", "preserved"]) {
      const tagged = results.filter((r) => r.tag === tag);
      const failing = tagged.filter((r) => !r.pass).length;
      console.log(`        [${tag}] ${baseline.mustFail.includes(tag) ? `failing: ${failing}/${tagged.length}` : `holding: ${tagged.length - failing}/${tagged.length}`}`);
    }
    for (const r of results.filter((x) => (baseline.mustFail.includes(x.tag) && x.pass) || (!baseline.mustFail.includes(x.tag) && !x.pass))) {
      console.log(`        ${r.id} ${r.pass ? "PASSED" : "FAILED"}: ${clip(JSON.stringify(r.detail), 300)}`);
    }
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
    const results = await runChecks(tree);
    const failing = results.filter((r) => !r.pass).map((r) => r.id);
    const held = mutant.mustFail.every((id) => failing.includes(id));
    ok &&= held;
    console.log(`${held ? "CAUGHT" : "MISSED"}  mutant — ${mutant.name}`);
    console.log(`        required to fail: ${mutant.mustFail.join(", ")} · failed: ${failing.join(", ") || "none"}`);
  }
  console.log(ok ? "HIDDEN_OBJECTS_EXPERIENCE_COUNTERFACTUALS_HOLD" : "HIDDEN_OBJECTS_EXPERIENCE_COUNTERFACTUALS_BROKEN");
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
    ` (${results.filter((r) => r.tag === "experience").length} experience, ${results.filter((r) => r.tag === "pool").length} pool, ${results.filter((r) => r.tag === "preserved").length} preserved)` +
    `${failing.length ? ` · failing: ${failing.join(", ")}` : ""}`,
);
console.log(failing.length ? "HIDDEN_OBJECTS_EXPERIENCE_FAILED" : "HIDDEN_OBJECTS_EXPERIENCE_OK");
process.exit(failing.length ? EXIT_VALIDATION_FAILED : EXIT_OK);
