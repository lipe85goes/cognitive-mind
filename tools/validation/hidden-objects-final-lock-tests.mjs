/**
 * GAME03-FINAL-POLISH-LOCK-06 — the Game 03 V1 lock candidate's contract: what the
 * final polish pass fixed, and what it was not allowed to change.
 *
 * [lock] checks — what the pass fixed (the base fails them):
 *   L01 the shared result screen's title fits every room (it read "Estúdio explorado" over the
 *       Observatório's summary); the summary under it names the room played
 *   L02 the intro ("Como jogar") speaks of the rooms, not of the Estúdio alone
 *   L03 no clue points at a place its object can leave (things move since REPLAYABILITY-05: a clue
 *       saying "the map", "a corner" or "behind the door" sent the player to a spot the object may
 *       not be at, or to a piece of the room that keeps something else) — a place word is allowed
 *       where every spot of the object says it too, or where this pass reviewed it as another sense
 *   L04 on a phone held upright the stations have a row of their own (beside the count and Pista,
 *       the Observatório's "Bancada" was cut)
 *   L05 the Observatório's mouse behind the blue trunk stands behind it (its spot was in front of
 *       the trunk's front edge, under the trunk's paint) and peeks out past its end, readable
 *
 * [preserved] checks — the lock candidate adds no gameplay (they hold on the base too):
 *   P01 nothing outside Game 03 changed but Game 03's own entries of the per-game tables (result
 *       title, intro); the Home, the shell, the Rota, the Circuito, the platform byte for byte; no
 *       dependency, the same lockfile
 *   P02 the engine is the base's: layout composer, rounds, session model, Difficulty V3, clue
 *       selection, pieces, camera, gestures — not one byte
 *   P03 the rooms hold the same things: the same pool, look-alikes, props, pieces, stations and
 *       slots; every thing keeps as many placements, each of the same tier
 *   P04 replayability holds: a seed gives one room and one list, again and again; another seed
 *       another arrangement; the room is never simplified to one arrangement
 *
 * Usage:
 *   node tools/validation/hidden-objects-final-lock-tests.mjs                  # the working tree
 *   node tools/validation/hidden-objects-final-lock-tests.mjs --rev=<commit>   # every source at <commit>
 *   node tools/validation/hidden-objects-final-lock-tests.mjs --counterfactuals
 *        the working tree must pass every check; the base must fail every [lock]
 *        check and hold every [preserved] one; every in-memory MUTANT must fail
 *        the checks it names. Nothing is ever written.
 *
 * Writes nothing. Exit 0 = every check holds, 1 = a check failed, 3 = usage error.
 */
import { EXIT_OK, EXIT_USAGE, EXIT_VALIDATION_FAILED } from "./evidence.mjs";
import { createModuleGraph, openSourceTree } from "./route-module-loader.mjs";
import { DIR, FILES, cached, changedOutsideGame03, clip, mediaBlock, normalizeText, platformTables, same } from "./hidden-objects-harness.mjs";

const args = process.argv.slice(2);
const revArg = args.find((arg) => arg.startsWith("--rev="));
const REV = revArg ? revArg.slice("--rev=".length) : null;
const COUNTERFACTUAL_MODE = args.includes("--counterfactuals");
if (args.some((arg) => arg !== revArg && arg !== "--counterfactuals") || REV === "" || (REV && COUNTERFACTUAL_MODE)) {
  console.error("usage: node tools/validation/hidden-objects-final-lock-tests.mjs [--rev=<commit> | --counterfactuals]");
  process.exit(EXIT_USAGE);
}

/** GAME03-REPLAYABILITY-05's final state, this mission's exact base. */
const BASE = "4dc446140b1c0249070c44a23053068473cc521a";
const BASE_TREE = openSourceTree({ rev: BASE });
const GAME = "hidden-objects";
const OBSERVATORY_ID = "explorer-observatory";
const DIFFICULTIES = ["easy", "medium", "hard"];
/** The engine: the lock candidate may not change one byte of it. */
const ENGINE_FILES = [
  "hidden-objects-layout.ts",
  "hidden-objects-rounds.ts",
  "hidden-objects-model.ts",
  "hidden-objects-difficulty.ts",
  "hidden-objects-clues.ts",
  "hidden-objects-interactions.ts",
  "hidden-objects-camera.ts",
  "hidden-objects-controller.ts",
  "hidden-objects-gesture.ts",
  "hidden-objects-scene.ts",
  "hidden-objects-scenes.ts",
].map((f) => `${DIR}${f}`);
/**
 * Words that name a place in a room. A clue may use one only if every place its
 * object can take says it too (the slot's own hint words); a room piece's name
 * (gaveta, porta…) is never a clue's — that piece keeps something else.
 */
const PLACE_WORDS = ["mapa", "canto", "porta", "janela", "mesa", "mesinha", "estante", "prateleira", "chao", "tapete", "parede", "gaveta", "cortina", "bau", "cesto", "peitoril", "bancada", "armario", "vitrine", "lambri", "rodape", "estrado", "telescopio"];
/**
 * The clues that use a place word in another sense, reviewed one by one in this
 * pass and kept: they do not say where their object is. Any other clue with a
 * place word its object can leave fails L03 until it is reviewed the same way.
 */
const REVIEWED_PLACE_WORDS = [
  { room: "explorer-studio", id: "chave", word: "porta", why: "a door in general (what a key opens); the Estúdio has no door piece" },
  { room: "explorer-studio", id: "bolsa", word: "mapa", why: "what the satchel carries; the satchel never moves (one placement)" },
  { room: "explorer-studio", id: "colar", word: "chao", why: "the beads that scatter when the clasp opens; the necklace is kept in the box" },
  { room: "explorer-observatory", id: "pipa", word: "chao", why: "a kite without wind; Difícil-only clue and the kite is never in a Difícil round (A on both spots)" },
  { room: "explorer-observatory", id: "esquadro", word: "canto", why: "the square's right-angled corner, a shape" },
];
/** The Observatório's blue trunk (tools/assets/create_observatory_scene.mjs, cupulaFloor): x 420–620, front edge y 1366. */
const TRUNK = { x0: 420, x1: 620, front: 1366 };

const words = (text) => normalizeText(text).split(/[^a-z]+/).filter(Boolean);

function engine(tree) {
  return cached(tree, "lock06:engine", () => {
    const graph = createModuleGraph({ tree, mocks: {}, globals: {} });
    const registry = graph.require(FILES.scenes);
    return {
      scenes: registry.SCENES,
      byId: Object.fromEntries(registry.SCENES.map((scene) => [scene.id, scene])),
      rounds: graph.require(FILES.rounds),
      layout: graph.require(`${DIR}hidden-objects-layout.ts`),
    };
  });
}
/** Every thing of a room that has placements: pool objects, look-alikes and props. */
const thingsOf = (scene) => [...scene.pool, ...scene.lookAlikes, ...(scene.props ?? [])];

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

  // --- what the pass fixed -------------------------------------------------------------------------------

  await check("L01", "lock", "THE_RESULT_TITLE_FITS_EVERY_ROOM", () => {
    const t = platformTables(tree);
    const { scenes } = engine(tree);
    const roomWords = scenes.flatMap((scene) => words(scene.name).filter((w) => w.length > 3 && w !== "explorador"));
    const shown = scenes.map((scene) => {
      const copy = t.rewards.getRewardCopy({ gameId: GAME, score: 6, details: { completed: true, sceneId: scene.id } });
      return { room: scene.id, title: copy.title, summary: scene.copy.summary };
    });
    const fallback = t.rewards.getRewardCopy({ gameId: "no-such-game", score: 6, details: { completed: true } }).title;
    const problems = [];
    for (const s of shown) {
      const named = words(s.title).filter((w) => roomWords.includes(w));
      if (named.length) problems.push(`${s.room}: the title names ${named.join(", ")}`);
      if (s.title === fallback) problems.push(`${s.room}: the default title`);
      const own = words(engine(tree).byId[s.room].name).filter((w) => roomWords.includes(w));
      if (!own.some((w) => words(s.summary).includes(w))) problems.push(`${s.room}: the summary does not name the room`);
    }
    return { pass: problems.length === 0, shown, problems };
  });

  await check("L02", "lock", "THE_INTRO_NAMES_NO_SINGLE_ROOM", () => {
    const intro = platformTables(tree).intros[GAME];
    const text = [intro.description, intro.reassurance, ...intro.steps].join(" ");
    const roomNouns = ["estudio", "observatorio"];
    const named = words(text).filter((w) => roomNouns.includes(w));
    return { pass: named.length === 0 && /sala/.test(normalizeText(text)), named, intro: clip(text, 260) };
  });

  await check("L03", "lock", "NO_CLUE_POINTS_AT_A_PLACE_ITS_OBJECT_CAN_LEAVE", () => {
    const problems = [];
    let clues = 0;
    for (const scene of engine(tree).scenes) {
      const slots = Object.fromEntries(scene.slots.map((s) => [s.id, s]));
      const pieceWords = (scene.interactables ?? []).flatMap((piece) => words(piece.label));
      for (const target of scene.pool) {
        const places = (target.placements ?? [{ slot: null }]).map((p) => {
          const h = p.slot ? slots[p.slot]?.hints : null;
          return words(h ? `${h.region} ${h.direction} ${h.context}` : `${target.hintRegion} ${target.hintDirection} ${target.hintContext}`);
        });
        for (const clue of target.clues ?? []) {
          clues += 1;
          for (const word of words(clue.text)) {
            const reviewed = REVIEWED_PLACE_WORDS.some((r) => r.room === scene.id && r.id === target.id && r.word === word);
            if (PLACE_WORDS.includes(word) && !reviewed && !places.every((place) => place.includes(word))) problems.push(`${scene.id}/${target.id}: "${clue.text}" — ${word}`);
            else if (pieceWords.includes(word) && PLACE_WORDS.includes(word)) problems.push(`${scene.id}/${target.id}: "${clue.text}" — names a piece (${word})`);
          }
        }
      }
    }
    return { pass: clues > 0 && problems.length === 0, clues, problems };
  });

  await check("L04", "lock", "A_PHONE_GIVES_THE_STATIONS_A_ROW", () => {
    const css = tree.read(FILES.css);
    const block = mediaBlock(css, "max-width: 479px") ?? "";
    const rows = (selector) => {
      const at = block.indexOf(`${selector} {`);
      if (at === -1) return null;
      return block.slice(at, block.indexOf("}", at));
    };
    const open = rows(".hos-panel");
    const closed = rows('.hos-shell[data-tray="closed"] .hos-panel');
    const own = (rule) => Boolean(rule && /"stations stations"/.test(rule) && /"head hint"/.test(rule));
    return { pass: own(open) && own(closed), open: clip(open ?? "none", 200), closed: clip(closed ?? "none", 200) };
  });

  await check("L05", "lock", "THE_MOUSE_STANDS_BEHIND_THE_TRUNK", () => {
    const { byId, layout } = engine(tree);
    const scene = byId[OBSERVATORY_ID];
    const mouse = scene.pool.find((t) => t.id === "ratinho");
    const placement = mouse.placements.find((p) => p.slot === "bau-cupula");
    const slot = scene.slots.find((s) => s.id === "bau-cupula");
    const box = layout.placedBox(scene, layout.layoutThings(scene).find((t) => t.id === "ratinho"), placement);
    const art = scene.placementArt?.["ratinho@bau-cupula"];
    const facts = {
      behindTheFrontEdge: slot.at.y < TRUNK.front,
      peeksPastTheEnd: box.x < TRUNK.x1 && box.x + box.w > TRUNK.x1,
      facesTheOpenEnd: placement.flip === true,
      readable: (art?.measured?.visible ?? 0) >= 0.6,
    };
    return { pass: Object.values(facts).every(Boolean), ...facts, at: slot.at, box, visible: art?.measured?.visible ?? null };
  });

  // --- what it was not allowed to change -------------------------------------------------------------------

  await check("P01", "preserved", "NOTHING_OUTSIDE_GAME03_BUT_ITS_OWN_TABLE_ENTRIES", () => {
    // HOME-WORLD-VISUAL-UNIFICATION-01 (restated): the Home files that mission owns are the Home's (HOME_ATELIER_FILES)
    const changed = changedOutsideGame03(tree, BASE_TREE, DIR);
    const fields = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];
    const mine = JSON.parse(tree.read("package.json"));
    const base = JSON.parse(BASE_TREE.read("package.json"));
    const depsChanged = fields.filter((field) => !same(mine[field] ?? {}, base[field] ?? {}));
    const lockfileUnchanged = tree.read("package-lock.json") === BASE_TREE.read("package-lock.json");
    return { pass: changed.length === 0 && depsChanged.length === 0 && lockfileUnchanged, changedOutsideGame03: changed, depsChanged, lockfileUnchanged };
  });

  await check("P02", "preserved", "THE_ENGINE_IS_THE_BASES", () => {
    const changed = ENGINE_FILES.filter((file) => tree.read(file) !== BASE_TREE.read(file));
    return { pass: changed.length === 0, changed };
  });

  await check("P03", "preserved", "THE_ROOMS_HOLD_THE_SAME_THINGS", () => {
    const problems = [];
    for (const scene of engine(tree).scenes) {
      const base = engine(BASE_TREE).byId[scene.id];
      const ids = (list) => list.map((x) => x.id).sort();
      for (const [what, mine, theirs] of [
        ["pool", scene.pool, base.pool],
        ["look-alikes", scene.lookAlikes, base.lookAlikes],
        ["props", scene.props ?? [], base.props ?? []],
        ["pieces", scene.interactables ?? [], base.interactables ?? []],
        ["stations", scene.stations, base.stations],
        ["slots", scene.slots, base.slots],
      ]) {
        if (!same(ids(mine), ids(theirs))) problems.push(`${scene.id}: ${what} differ`);
      }
      if (!same(scene.stations, base.stations)) problems.push(`${scene.id}: stations changed`);
      if (!same(scene.interactables, base.interactables)) problems.push(`${scene.id}: pieces changed`);
      for (const thing of thingsOf(scene)) {
        const was = thingsOf(base).find((t) => t.id === thing.id);
        if (!was) continue;
        const mineP = (thing.placements ?? []).map((p) => `${p.slot}:${p.tier ?? thing.tier ?? ""}`);
        const theirsP = (was.placements ?? []).map((p) => `${p.slot}:${p.tier ?? was.tier ?? ""}`);
        if (!same(mineP, theirsP)) problems.push(`${scene.id}/${thing.id}: placements changed`);
        if (thing.tier !== was.tier || thing.station !== was.station || thing.gate !== was.gate) problems.push(`${scene.id}/${thing.id}: tier, station or piece changed`);
      }
    }
    return { pass: problems.length === 0, problems: problems.slice(0, 8) };
  });

  await check("P04", "preserved", "A_SEED_IS_ONE_ROOM_AND_ROOMS_STILL_VARY", () => {
    const { scenes, rounds } = engine(tree);
    const problems = [];
    const facts = {};
    for (const scene of scenes) {
      for (const difficulty of DIFFICULTIES) {
        const signatures = new Set();
        for (let seed = 1; seed <= 40; seed += 1) {
          const a = rounds.selectRound(scene, difficulty, seed * 7919);
          const b = rounds.selectRound(scene, difficulty, seed * 7919);
          if (a.layout.signature !== b.layout.signature || !same(a.targets, b.targets)) problems.push(`${scene.id}/${difficulty}/${seed}: the same seed, another room`);
          signatures.add(a.layout.signature);
        }
        facts[`${scene.id}/${difficulty}`] = signatures.size;
        if (signatures.size < 36) problems.push(`${scene.id}/${difficulty}: ${signatures.size} arrangements in 40 seeds`);
      }
    }
    return { pass: problems.length === 0, arrangementsIn40Seeds: facts, problems: problems.slice(0, 6) };
  });

  return results;
}

// --- mutants: each must fail what it names -------------------------------------------------------------------

const STUDIO_FILE = `${DIR}scenes/explorer-studio.ts`;
const OBSERVATORY_FILE = `${DIR}scenes/explorer-observatory.ts`;
const MUTANTS = [
  {
    name: "the result title is the Estúdio's again",
    files: { [FILES.rewards]: [['    successTitle: "Exploração concluída",', '    successTitle: "Estúdio explorado",']] },
    mustFail: ["L01"],
  },
  {
    name: "the result title names the Observatório",
    files: { [FILES.rewards]: [['    successTitle: "Exploração concluída",', '    successTitle: "Observatório explorado",']] },
    mustFail: ["L01"],
  },
  {
    name: "the intro sends the player into the Estúdio",
    files: { [FILES.intros]: [['"Escolha a sala e a dificuldade."', '"Escolha a dificuldade e entre no estúdio."']] },
    mustFail: ["L02"],
  },
  {
    name: "the scissors' clue points at the map again",
    files: { [STUDIO_FILE]: [['"Na aula de artes, faz o recorte sem rasgar."', '"Sem ela, o recorte do mapa sairia rasgado."']] },
    mustFail: ["L03"],
  },
  {
    name: "the horseshoe's clue says behind the door again",
    files: { [OBSERVATORY_FILE]: [['"Pendurada na entrada, promete afastar o azar."', '"Atrás da porta, promete afastar o azar."']] },
    mustFail: ["L03"],
  },
  {
    name: "the umbrella's clue puts it in a corner again",
    files: { [STUDIO_FILE]: [['"Fechado, fica esperando o tempo virar."', '"Fechado num canto, espera o tempo virar."']] },
    mustFail: ["L03"],
  },
  {
    name: "a phone squeezes the stations beside Pista again",
    files: { [FILES.css]: [['      "head hint"\n      "stations stations";\n    grid-template-columns: auto minmax(0, 1fr);\n    grid-template-rows: auto auto;', '      "head hint stations";\n    grid-template-columns: auto minmax(0, 1fr) minmax(0, 1.5fr);\n    grid-template-rows: auto;']] },
    mustFail: ["L04"],
  },
  {
    name: "the mouse stands in front of the trunk again, under its paint",
    files: { [OBSERVATORY_FILE]: [["    at: { x: 618, y: 1362 },", "    at: { x: 620, y: 1380 },"], ['{ slot: "bau-cupula", flip: true }', '{ slot: "bau-cupula" }']] },
    mustFail: ["L05"],
  },
  {
    name: "the Home changes",
    files: { [FILES.page]: [['"use client";', '"use client";\n// a Home change']] },
    mustFail: ["P01"],
  },
  {
    name: "another game's result copy changes",
    files: { [FILES.rewards]: [['    successTitle: "Rota concluída",', '    successTitle: "Rota encerrada",']] },
    mustFail: ["P01"],
  },
  {
    name: "the anti-repeat draws more seeds (an engine change)",
    files: { [FILES.rounds]: [["REPEAT_DRAWS = 8", "REPEAT_DRAWS = 9"]] },
    mustFail: ["P02"],
  },
  {
    name: "a thing gains a placement",
    files: { [OBSERVATORY_FILE]: [['placements: [{ slot: "toca" }, { slot: "bau-cupula", flip: true }]', 'placements: [{ slot: "toca" }, { slot: "bau-cupula", flip: true }, { slot: "chao-cupula-a" }]']] },
    mustFail: ["P03"],
  },
  {
    name: "the composer ignores the seed (Math.random)",
    files: { [`${DIR}hidden-objects-layout.ts`]: [["  const random = mulberry(seed);\n  const picks", "  const random = Math.random;\n  const picks"]] },
    mustFail: ["P02", "P04"],
  },
];

/** An in-memory copy of `worktree` with `mutant`'s edits; every anchor must appear exactly once. */
function mutate(worktree, mutant) {
  const overrides = {};
  for (const [file, edits] of Object.entries(mutant.files)) {
    let text = overrides[file] ?? worktree.read(file);
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
  const contract = results.filter((r) => r.tag === "lock");
  const kept = results.filter((r) => r.tag !== "lock");
  const held = contract.every((r) => !r.pass) && kept.every((r) => r.pass);
  ok &&= held;
  console.log(`${held ? "CAUGHT" : "MISSED"}  base ${BASE.slice(0, 8)} — GAME03-REPLAYABILITY-05's final state`);
  console.log(`        [lock] failing: ${contract.filter((r) => !r.pass).length}/${contract.length}`);
  console.log(`        [preserved] holding: ${kept.filter((r) => r.pass).length}/${kept.length}`);
  for (const r of results.filter((x) => (x.tag === "lock" && x.pass) || (x.tag !== "lock" && !x.pass))) {
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
  console.log(ok ? "HIDDEN_OBJECTS_FINAL_LOCK_COUNTERFACTUALS_HOLD" : "HIDDEN_OBJECTS_FINAL_LOCK_COUNTERFACTUALS_BROKEN");
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
    ` (${results.filter((r) => r.tag === "lock").length} lock, ${results.filter((r) => r.tag === "preserved").length} preserved)` +
    `${failing.length ? ` · failing: ${failing.join(", ")}` : ""}`,
);
console.log(failing.length ? "HIDDEN_OBJECTS_FINAL_LOCK_FAILED" : "HIDDEN_OBJECTS_FINAL_LOCK_OK");
process.exit(failing.length ? EXIT_VALIDATION_FAILED : EXIT_OK);
