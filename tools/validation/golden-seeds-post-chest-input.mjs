/**
 * ROTA-CHEST-REWARDS-01 §41 — the two golden pre-chest seeds, INSPECTED.
 *
 * These are the maps ROTA-DYNAMIC-SOLVABILITY-01 proved PROVED_UNSOLVABLE_PRE_CHEST.
 * This file records what the Chest mechanic hands the next mission as INPUT:
 * where the chest landed, which walls were certified, what opening each one
 * would produce. It deliberately does NOT run a solver and does NOT claim any of
 * them is now winnable.
 *
 * Nothing here is tuned. The certification is the general rule from
 * `breakable-wall-contract.md`, running exactly as it does on every other map.
 *
 * Usage: node tools/validation/golden-seeds-post-chest-input.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { loadInstrumented } from "./instrumented-generator.mjs";
import { auditBreakableWalls } from "./breakable-wall-certifier.mjs";

const OUT = path.resolve("docs/archive/route-chest-rewards-01");
fs.mkdirSync(OUT, { recursive: true });

const LAB = loadInstrumented({ bare: true });
const API = LAB.API;
const kOf = (p) => API.posKey(p);

const GOLDEN = [
  { seed: 8801214, difficulty: "hard", routeNumber: 1 },
  { seed: 8801107, difficulty: "medium", routeNumber: 1 },
];

const records = [];
for (const golden of GOLDEN) {
  LAB.setSeed(golden.seed);
  const map = API.generateMaze(golden.difficulty, golden.routeNumber);
  const zone = API.computePortalDefenceZone(
    map.playerStart,
    map.exitPosition,
    map.walls,
  );
  // Consulted ONLY to label walls with what the retired certifier would have
  // said. It has no authority: every wall below is a legal Pickaxe target.
  const audited = auditBreakableWalls(
    API,
    map.walls,
    map.playerStart,
    map.guardianStart,
    map.exitPosition,
    map.collectibleStars,
    map.traps,
    map.chest,
  );
  const certified = audited.filter((c) => c.certified);
  const reachableWalls = [...map.walls].filter((key) => {
    const [row, col] = key.split(",").map(Number);
    return API.getNeighbors({ row, col }, map.walls).length > 0;
  });

  records.push({
    ...golden,
    preChestVerdict: "PROVED_UNSOLVABLE_PRE_CHEST",
    postChestVerdict: "NOT_EVALUATED_IN_THIS_MISSION",
    map: {
      playerStart: kOf(map.playerStart),
      guardianStart: kOf(map.guardianStart),
      portal: kOf(map.exitPosition),
      lights: map.collectibleStars.map(kOf),
      traps: map.traps.map(kOf),
      walls: [...map.walls].sort(),
      wallCount: map.walls.size,
      portalZone: zone.zone.map(kOf),
      portalAccesses: zone.accesses.map(kOf),
    },
    chest: {
      position: map.chest ? kOf(map.chest) : null,
      // Both rewards are always offered; the Explorer decides. No RNG (§13/§43).
      rewardsAvailable: ["PICKAXE", "SECOND_CHANCE"],
      rewardSelectionRandom: false,
    },
    pickaxe: {
      // §23 — what the runtime NATURALLY presents. No selection, no marking.
      targetPolicy: "ANY_INTERNAL_MAZE_WALL",
      uses: 1,
      legalTargets: [...map.walls].sort(),
      legalTargetCount: map.walls.size,
      wallsWithAtLeastOneWalkableNeighbour: reachableWalls.length,
      generatorPreselection: null,
      permanentVisualHint: null,
      /**
       * The retired certifier's opinion, recorded ONLY so ROTA-DYNAMIC-
       * SOLVABILITY-02 can tell the two populations apart if it wants to. It
       * restricts nothing: the walls under `rejectedByRetiredCertifier` are as
       * legal to break as the ones above them.
       */
      retiredCertifierOpinion: {
        authority: "none",
        certifiedCount: certified.length,
        certified: certified.map((c) => ({
          cell: kOf(c.position),
          score: c.score,
          effect: c.effect,
        })),
        rejectedByRetiredCertifier: audited
          .filter((c) => !c.certified)
          .map((c) => ({ cell: kOf(c.position), reason: c.rejection })),
      },
    },
    tuning: {
      hardcodedForThisSeed: false,
      specialWall: false,
      specialTemplate: false,
      specialDifficultyException: false,
      dedicatedSpawn: false,
      dedicatedReward: false,
      // §23 explicitly: no wall was chosen to rescue these two maps, and no
      // claim is made that any wall does.
      wallGuaranteedToSolveThisSeed: false,
    },
  });
}

const report = {
  mission: "ROTA-CHEST-REWARDS-01",
  section: "§41 GOLDEN_PRE_CHEST_SEEDS",
  preChestBaselineCommit: "eb26368",
  statement:
    "Input for ROTA-DYNAMIC-SOLVABILITY-02. Chest position, available rewards and the Pickaxe's legal targets are recorded. Since the post-playtest revision the Pickaxe may open ANY internal maze wall, so the target list IS the map's wall list. No solvability conclusion is drawn here, and none of these maps was tuned.",
  PICKAXE_TARGET_POLICY: "ANY_INTERNAL_MAZE_WALL",
  CERTIFIED_WALL_RUNTIME_RESTRICTION: false,
  solver02Note:
    "With one use and N internal walls, the Explorer's branching at any cell is BREAK_WALL(w) for each adjacent standing wall, plus not breaking. Which wall leads to a winning region is exactly what ROTA-DYNAMIC-SOLVABILITY-02 exists to answer, and nothing here pre-empts it.",
  DYNAMIC_SOLVABILITY_02_REQUIRED: true,
  MAP_REPAIR_PERFORMED: false,
  SOLVER_RUN_IN_THIS_MISSION: false,
  records,
};

fs.writeFileSync(
  path.join(OUT, "golden-seeds-post-chest-input.json"),
  JSON.stringify(report, null, 2),
);

for (const r of records) {
  console.log(
    `seed ${r.seed} · ${r.difficulty}/r${r.routeNumber} · chest ${r.chest.position} · ` +
      `paredes legais ${r.pickaxe.legalTargetCount} · ` +
      `(o certificador aposentado teria aprovado ${r.pickaxe.retiredCertifierOpinion.certifiedCount})`,
  );
}
console.log("\nGOLDEN_SEEDS_RECORDED_NO_VERDICT");
