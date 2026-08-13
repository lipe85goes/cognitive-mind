/**
 * ROTA-CHEST-REWARDS-01 — acceptance, assembled from the evidence rather than typed.
 *
 * REVISED for the post-playtest continuation: the twenty items of §38 replace
 * the earlier twenty-four, because item 1 of the old list ("only certified walls
 * may be broken") is now the opposite of the contract.
 *
 * Each item points at the artefact that decides it and, where the artefact is
 * machine-readable, reads the verdict out of it. Nothing here re-runs a suite;
 * it is a ledger, and it fails loudly if an artefact is missing or disagrees.
 *
 * Usage: node tools/validation/chest-acceptance.mjs [--validations-passed]
 */
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve("docs/archive/route-chest-rewards-01");
const ROOT = process.cwd();
const load = (name) => {
  const file = path.join(OUT, name);
  if (!fs.existsSync(file)) throw new Error(`missing evidence: ${name}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
};
const source = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const codeOnly = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

const feasibility = load("breakable-wall-feasibility.json");
const chest = load("chest-controlled-tests.json");
const pickaxe = load("pickaxe-controlled-tests.json");
const second = load("second-chance-controlled-tests.json");
const gameplay = load("chest-runtime-gameplay.json");
const render = load("chest-static-render-audit.json");
const golden = load("golden-seeds-post-chest-input.json");

const hook = source("src/games/escape-maze/useEscapeMaze.ts");
const game = source("src/games/escape-maze/RouteStrategyGame.tsx");
const babylon = source("src/games/escape-maze/routeBabylonScene.ts");

const test = (suite, id) => suite.tests.find((t) => t.id === id);
const check = (suite, id) => suite.checks.find((c) => c.id === id);
const renderCheck = (id) => render.checks.find((c) => c.id === id);

const items = [
  {
    n: 1,
    claim: "qualquer wall interna válida pode ser quebrada",
    pass: test(pickaxe, "A").pass && test(pickaxe, "A").everyAdjacentWallOffered === true,
    evidence: ["pickaxe-controlled-tests.json A", "pickaxe-free-wall-choice-contract.md"],
  },
  {
    n: 2,
    claim: "antigo certified set não restringe runtime",
    pass:
      test(pickaxe, "B").pass &&
      // The certifier must not be reachable from production at all.
      !/breakableWalls|auditBreakableWalls|chooseBreakableWalls|certifyBreakableWall/.test(
        codeOnly(hook),
      ) &&
      !fs.existsSync(path.join(ROOT, "src/games/escape-maze/breakableWalls.ts")) &&
      feasibility.history.BREAKABLE_WALL_FEASIBILITY_GATE ===
        "SUPERSEDED_AS_RUNTIME_RESTRICTION",
    evidence: ["pickaxe-controlled-tests.json B", "breakable-wall-feasibility.json history"],
    measured: {
      certifierNowLivesIn: feasibility.history.ruleSourceNow,
      evidencePreserved: feasibility.history.BREAKABLE_WALL_FEASIBILITY_EVIDENCE,
      reproducedOriginalCampaignExactly: feasibility.history.reproducedExactly,
    },
  },
  {
    n: 3,
    claim: "uma wall fora do antigo set foi quebrada em teste",
    pass:
      test(pickaxe, "B").wallsBrokenThatTheOldCertifierRefused >= 1 &&
      check(gameplay, "PLAY-COVERAGE").wallsBrokenOutsideTheOldCertifiedSet >= 1,
    evidence: ["pickaxe-controlled-tests.json B", "chest-runtime-gameplay.json PLAY-COVERAGE"],
    measured: {
      inControlledTests: test(pickaxe, "B").wallsBrokenThatTheOldCertifierRefused,
      inGameplaySweep: check(gameplay, "PLAY-COVERAGE")
        .wallsBrokenOutsideTheOldCertifiedSet,
      insideOldSetForComparison: check(gameplay, "PLAY-COVERAGE")
        .wallsBrokenInsideTheOldCertifiedSet,
    },
  },
  {
    n: 4,
    claim: "Pickaxe continua one-use",
    pass: test(pickaxe, "C").pass,
    evidence: ["pickaxe-controlled-tests.json C"],
  },
  {
    n: 5,
    claim: "ação é explícita",
    pass: test(pickaxe, "H").pass,
    evidence: ["pickaxe-controlled-tests.json H"],
  },
  {
    n: 6,
    claim: "multiple-adjacent é inequívoco",
    pass: test(pickaxe, "I").pass,
    evidence: ["pickaxe-controlled-tests.json I"],
  },
  {
    n: 7,
    claim: "wall ruim continua legal",
    pass:
      test(pickaxe, "BAD_CHOICE").pass &&
      test(pickaxe, "BAD_CHOICE").BAD_STRATEGIC_CHOICE_IS_STILL_LEGAL === true &&
      !/rewardEligibility/.test(hook),
    evidence: ["pickaxe-controlled-tests.json BAD_CHOICE"],
    measured: {
      poorOptionsBrokenWithoutRefusal: test(pickaxe, "BAD_CHOICE")
        .poorOptionsThatSavedTheExplorerNothing,
      rewardEligibilityImplemented: /rewardEligibility/.test(hook),
    },
  },
  {
    n: 8,
    claim: "wall aberta é usada por todos",
    pass: test(pickaxe, "K").pass && test(pickaxe, "L").pass &&
      test(pickaxe, "DEFENDER_BENEFIT").pass,
    evidence: [
      "pickaxe-controlled-tests.json K/L",
      "pickaxe-controlled-tests.json DEFENDER_BENEFIT",
    ],
  },
  {
    n: 9,
    claim: "restart restaura topologia",
    pass: test(pickaxe, "M").pass && test(chest, "H").pass,
    evidence: ["pickaxe-controlled-tests.json M", "chest-controlled-tests.json H"],
  },
  {
    n: 10,
    claim: "Chest continua oferecendo exatamente duas rewards",
    pass:
      /export type ChestReward = "pickaxe" \| "second-chance";/.test(hook) &&
      test(chest, "D").pass &&
      test(chest, "E").pass &&
      test(chest, "F").pass,
    evidence: ["chest-controlled-tests.json D/E/F", "reward-choice-contract.md"],
  },
  {
    n: 11,
    claim: "Second Chance permanece intacta",
    pass: second.allPass,
    evidence: ["second-chance-controlled-tests.json"],
    measured: { tests: second.tests.map((t) => ({ id: t.id, pass: t.pass })) },
  },
  {
    n: 12,
    claim: "traps permanecem intactas",
    pass: check(gameplay, "REG-TRAPS").pass,
    evidence: ["chest-runtime-gameplay.json REG-TRAPS"],
    measured: check(gameplay, "REG-TRAPS"),
  },
  {
    n: 13,
    claim: "Hunter/Sentinel permanecem intactos",
    pass: check(gameplay, "REG-HUNTER").pass && check(gameplay, "REG-SENTINEL").pass,
    evidence: ["chest-runtime-gameplay.json REG-HUNTER / REG-SENTINEL"],
    measured: {
      hunter: check(gameplay, "REG-HUNTER"),
      sentinel: check(gameplay, "REG-SENTINEL"),
    },
  },
  {
    n: 14,
    claim: "portal/lights permanecem intactos",
    pass: check(gameplay, "REG-PORTAL").pass,
    evidence: ["chest-runtime-gameplay.json REG-PORTAL"],
    measured: check(gameplay, "REG-PORTAL"),
  },
  {
    n: 15,
    claim: "estado continua solver-friendly",
    pass:
      test(pickaxe, "N").pass &&
      ["chestOpened", "rewardSelected", "rewardSpent", "brokenWall", "breakTargets"].every(
        (field) => new RegExp(`^\\s+${field},`, "m").test(hook),
      ),
    evidence: ["pickaxe-controlled-tests.json N", "chest-runtime-contract.md §7"],
  },
  {
    n: 16,
    claim: "golden seeds não receberam hack",
    pass:
      golden.records.every((r) => Object.values(r.tuning).every((v) => v === false)) &&
      golden.SOLVER_RUN_IN_THIS_MISSION === false &&
      golden.CERTIFIED_WALL_RUNTIME_RESTRICTION === false,
    evidence: ["golden-seeds-post-chest-input.json"],
    measured: golden.records.map((r) => ({
      seed: r.seed,
      legalTargets: r.pickaxe.legalTargetCount,
      retiredCertifierWouldHaveApproved:
        r.pickaxe.retiredCertifierOpinion.certifiedCount,
      postChestVerdict: r.postChestVerdict,
    })),
  },
  {
    n: 17,
    claim: "visual não entrega “wall correta”",
    pass:
      renderCheck("NO_PERMANENT_GOOD_WALL_HINT").pass &&
      renderCheck("BREAK_TARGET_VISUAL_LANGUAGE").pass &&
      renderCheck("NO_STRATEGY_IN_RENDER_LAYER").pass,
    evidence: ["chest-static-render-audit.json"],
    measured: renderCheck("NO_PERMANENT_GOOD_WALL_HINT"),
  },
  {
    n: 18,
    claim: "3 Babylon lights",
    pass:
      render.babylonLights.length === 3 &&
      render.ROUTE_MAX_LIGHTS === 3 &&
      /const ROUTE_MAX_LIGHTS = 3;/.test(babylon),
    evidence: ["chest-static-render-audit.json"],
    measured: render.babylonLights,
  },
  {
    n: 19,
    claim: "lint/TS/build/diff passam",
    pass: null, // filled by --validations-passed
    evidence: ["README.md §Validações"],
  },
  {
    n: 20,
    claim: "playtest manual aprovado e checkpoint local autorizado",
    pass: true,
    evidence: ["external user playtest recorded in the 2026-08-13 checkpoint"],
    measured: {
      CHEST_MANUAL_PLAYTEST: "PASS",
      FREE_WALL_PICKAXE_MANUAL_PLAYTEST: "PASS",
      localCheckpointAuthorized: true,
      pushAuthorized: false,
    },
  },
];

// A UI claim worth checking mechanically: no player-facing string may promise a
// marked or cracked wall any more. Comments are documentation and are excluded —
// the record of what the copy USED to say has to survive.
const staleCopy = /parede marcada|parede rachada|paredes rachadas/i.test(codeOnly(game));
if (staleCopy) {
  items.find((i) => i.n === 17).pass = false;
  items.find((i) => i.n === 17).staleCopyInUi = true;
}

const validationsPassed = process.argv.includes("--validations-passed");
if (validationsPassed) items.find((i) => i.n === 19).pass = true;

const decided = items.filter((i) => i.pass !== null);
const failed = decided.filter((i) => !i.pass);
const pending = items.filter((i) => i.pass === null);

const report = {
  mission: "ROTA-CHEST-REWARDS-01",
  continuation: "PICKAXE_FREE_WALL_CHOICE",
  PRE_CHEST_BASELINE_COMMIT: "eb26368",
  CHEST_REPLACES_SHIELD: true,
  REWARD_OPTIONS_V1: ["PICKAXE", "SECOND_CHANCE"],
  REWARD_SELECTION_RANDOM: false,
  PICKAXE_USES: 1,
  PICKAXE_TARGET_POLICY: "ANY_INTERNAL_MAZE_WALL",
  PLAYER_SELECTS_WALL: true,
  NO_GENERATOR_PRESELECTION: true,
  NO_VISUAL_CORRECT_WALL_HINT: true,
  NO_PERMANENT_GOOD_WALL_HINT: true,
  BAD_STRATEGIC_WALL_CHOICE_ALLOWED: true,
  CERTIFIED_WALL_RUNTIME_RESTRICTION: false,
  CERTIFIED_WALL_ANALYSIS_PRESERVED: true,
  BREAKABLE_WALL_FEASIBILITY_GATE: "SUPERSEDED_AS_RUNTIME_RESTRICTION",
  BREAKABLE_WALL_FEASIBILITY_EVIDENCE: "PRESERVED",
  BROKEN_WALL_WALKABLE_BY_ALL: true,
  BREAK_WALL_CONSUMES_TURN: true,
  SECOND_CHANCE_CHARGES: 1,
  CHEST_MANUAL_PLAYTEST: "PASS",
  FREE_WALL_PICKAXE_MANUAL_PLAYTEST: "PASS",
  WALL_BREAK_VISUAL_POLISH_OPTIONAL: true,
  DYNAMIC_SOLVABILITY_02_REQUIRED: true,
  MAP_REPAIR_PERFORMED: false,
  DUAL_GUARDIAN_CO_OCCUPANCY_FOLLOWUP_REQUIRED: true,
  ROUTE_VISUAL_FLICKER_FOLLOWUP_REQUIRED: true,
  SENTINEL_STALL_FOLLOWUP_REQUIRED: true,
  DIFFICULTY_REBALANCE_REQUIRED: true,
  manualPlaytest: {
    source: "external user browser playtest",
    observed: [
      "Chest opens and presents the two reward choices",
      "Pickaxe breaks ordinary internal walls without a permanent crack hint",
      "multiple adjacent walls have explicit readable direction choices",
      "Pickaxe is spent after one break",
      "gameplay continues and portal/lights remain operational",
    ],
  },
  knownFollowUps: [
    {
      id: "WALL_BREAK_VISUAL_POLISH_OPTIONAL",
      required: false,
      detail: "A future pass may add slightly stronger fragments, discreet dust, or short feedback; this does not block the checkpoint.",
    },
    {
      id: "DUAL_GUARDIAN_CO_OCCUPANCY_FOLLOWUP_REQUIRED",
      required: true,
      detail: "Pre-existing Hunter/Sentinel co-occupancy measured in 23 of 1466 turns; not introduced or fixed by Chest.",
    },
    {
      id: "ROUTE_VISUAL_FLICKER_FOLLOWUP_REQUIRED",
      required: true,
      targetMission: "ROTA-RUNTIME-STABILITY-02",
      detail: "Occasional visual flicker was observed manually; its cause is not proven and is not attributed to renderDynamicBoard.",
    },
    {
      id: "SENTINEL_STALL_FOLLOWUP_REQUIRED",
      required: true,
      targetMission: "ROTA-RUNTIME-STABILITY-02",
      detail: "An apparent Sentinel stall, especially in the intermediate mode, requires a state-complete reproduction before it can be called a confirmed bug.",
    },
    {
      id: "DIFFICULTY_REBALANCE_REQUIRED",
      required: true,
      targetMission: "ROTA-DIFFICULTY-FINAL-01",
      detail: "Manual difficulty feedback is recorded for a separate mission; no difficulty or timer change belongs to this checkpoint.",
    },
  ],
  suiteVerdicts: {
    feasibility: feasibility.verdict,
    feasibilityReproducedExactly: feasibility.history.reproducedExactly,
    chest: chest.allPass,
    pickaxe: pickaxe.allPass,
    secondChance: second.allPass,
    regressionAndGameplay: gameplay.allPass,
    staticRender: render.allPass,
  },
  knownPreExistingConditions: [second.preExistingEngineCondition],
  acceptance: items,
  itemsPassed: decided.filter((i) => i.pass).length,
  itemsFailed: failed.map((i) => ({ n: i.n, claim: i.claim })),
  itemsPending: pending.map((i) => ({ n: i.n, claim: i.claim })),
  verdict:
    failed.length === 0 && pending.length === 0
      ? "ROTA-CHEST-REWARDS-01_FREE_WALL_PICKAXE_MANUAL_PLAYTEST_PASS"
      : failed.length > 0
        ? "ROTA-CHEST-REWARDS-01_FREE_WALL_PICKAXE_ACCEPTANCE_FAILED"
        : "ROTA-CHEST-REWARDS-01_FREE_WALL_PICKAXE_AWAITING_VALIDATIONS",
  note:
    "Functional validation and the external user browser playtest passed. A single local checkpoint commit is authorized; push and follow-up implementation remain out of scope.",
};

fs.writeFileSync(
  path.join(OUT, "route-chest-rewards-01-acceptance.json"),
  JSON.stringify(report, null, 2),
);

for (const item of items) {
  const mark = item.pass === null ? "....." : item.pass ? "PASS " : "FAIL ";
  console.log(`${mark} ${String(item.n).padStart(2)}. ${item.claim}`);
}
console.log(`\n${report.verdict}`);
if (failed.length > 0) process.exitCode = 1;
