/**
 * ROTA-CHEST-REWARDS-01 — static render audit (§31, §32, §22).
 *
 * The environment cannot composite frames, so this reads the official Babylon
 * renderer as source and asserts the properties that a screenshot would
 * otherwise have to prove: three lights and no more, every Chest/Pickaxe state
 * represented, and no trace of the old shield in the active render path.
 *
 * Usage: node tools/validation/chest-static-render-audit.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.resolve("docs/archive/route-chest-rewards-01");
fs.mkdirSync(OUT, { recursive: true });

const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");

/**
 * Comments are documentation, not behaviour. "The blue shield is gone" is a
 * sentence that MUST survive — it is the record of what was replaced — so the
 * absence checks below read code only. Everything else reads the full source.
 */
const codeOnly = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");
const babylon = read("src/games/escape-maze/routeBabylonScene.ts");
const babylonBoard = read("src/games/escape-maze/RouteBabylonBoard.tsx");
const game = read("src/games/escape-maze/RouteStrategyGame.tsx");
const hook = read("src/games/escape-maze/useEscapeMaze.ts");
const css = read("src/app/globals.css");

const checks = [];
const check = (id, pass, detail) => {
  checks.push({ id, pass, ...detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id}`);
  for (const [k, v] of Object.entries(detail)) {
    console.log(`        ${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`);
  }
};

// --- §31: three lights, and the cap that matches them ----------------------
const lightConstructions = [
  ...babylon.matchAll(/new\s+B\.(\w*Light)\s*\(\s*"([^"]+)"/g),
].map((m) => ({ type: m[1], name: m[2] }));
const glowLayers = [...babylon.matchAll(/new\s+B\.GlowLayer\s*\(/g)].length;
const routeMaxLights = /const ROUTE_MAX_LIGHTS = (\d+);/.exec(babylon)?.[1];

check("BABYLON_LIGHTS", lightConstructions.length === 3 && routeMaxLights === "3", {
  lights: lightConstructions,
  count: lightConstructions.length,
  ROUTE_MAX_LIGHTS: Number(routeMaxLights),
  expectedNames: ["route-key-light", "route-fill-light", "route-rim-light"],
  namesMatch:
    lightConstructions.map((l) => l.name).sort().join(",") ===
    ["route-fill-light", "route-key-light", "route-rim-light"].join(","),
  glowLayers,
});

// Every new chest/wall material must be emissive-or-plain, never a light.
const newChestMaterials = [
  "chestStone",
  "chestBronze",
  "chestGlow",
  "chestSpent",
  "breakTarget",
  "breakAim",
  "rubble",
];
check(
  "NO_NEW_LIGHT_FOR_CHEST",
  newChestMaterials.every((m) => babylon.includes(`${m}: makeMaterial(`)),
  {
    materialsAdded: newChestMaterials,
    allAreMaterials: newChestMaterials.every((m) =>
      babylon.includes(`${m}: makeMaterial(`),
    ),
    note: "chest ember and fissures are material + emissive + the existing GlowLayer",
  },
);

// --- §32: the official renderer carries every required state ---------------
const babylonStates = {
  chestClosed: babylon.includes("const opened = state.chestOpened") ||
    babylon.includes("const opened = state.chestOpened;"),
  chestOpened: babylon.includes("lid.rotation.x = -1.15"),
  breakTargetContextual: babylon.includes("renderBreakTargets("),
  breakAim: babylon.includes("route-break-aim-ring"),
  brokenWall: babylon.includes("renderBrokenWallTrace("),
  stateFields:
    /chest: GridPosition \| null;/.test(babylon) &&
    /chestOpened: boolean;/.test(babylon) &&
    /breakTargetKeys: string\[\];/.test(babylon) &&
    /aimedWallKey: string \| null;/.test(babylon) &&
    /brokenWallKey: string \| null;/.test(babylon),
};
check(
  "OFFICIAL_RENDERER_CARRIES_EVERY_STATE",
  Object.values(babylonStates).every(Boolean),
  { renderer: "RouteBabylonBoard", babylon: babylonStates },
);

// The Pickaxe and Second Chance states are visible in the HUD, not in a canvas.
check(
  "REWARD_STATE_IS_VISIBLE",
  game.includes("pickaxeAvailable") &&
    game.includes("pickaxeSpent") &&
    game.includes("secondChanceAvailable") &&
    game.includes("secondChanceSpent") &&
    game.includes("rsg-hud-reward-active") &&
    game.includes("rsg-hud-reward-spent") &&
    css.includes(".rsg-hud-reward-active") &&
    css.includes(".rsg-hud-reward-spent"),
  {
    hudTokenStates: ["Picareta", "Picareta usada", "2ª Chance", "2ª Chance usada", "Escolha", "No mapa"],
    contextualBreakAction: game.includes("rsg-break-btn") && css.includes(".rsg-break-btn"),
    rewardChoicePanel: game.includes("rsg-reward-btn") && css.includes(".rsg-reward-btn"),
  },
);

/**
 * §14/§16/§35 (revisão pós-playtest) — the single most important visual claim of
 * this continuation: NO PERMANENT MARK IDENTIFIES A "GOOD" WALL.
 *
 * The old design drew fissures on a certified subset. Those must be gone from
 * the official renderer, and what replaced them must be contextual: born with
 * the Pickaxe, gone when it is spent.
 */
const permanentHint = {
  babylonFissureRenderer: /renderWallFissures|route-wall-fissure|route-wall-chip/.test(
    codeOnly(babylon),
  ),
  babylonWeakWallMaterial: /wallWeak|wallFissure/.test(codeOnly(babylon)),
  // A wall's own appearance must not branch on anything but "it is a wall".
  babylonWallMaterialBranches:
    /materials\.wall\b[^;]*\?|\?\s*materials\.wall\b/.test(codeOnly(babylon)),
  // The static board must not be rebuilt by target changes — they are dynamic.
  targetsInStaticSignature: /breakTargetKeys[\s\S]{0,120}getStaticBoardSignature|getStaticBoardSignature[\s\S]{0,400}breakTargetKeys/.test(
    codeOnly(babylon),
  ),
};
check("NO_PERMANENT_GOOD_WALL_HINT", !Object.values(permanentHint).some(Boolean), {
  ...permanentHint,
  contextualTargetsLiveOnTheDynamicBoard:
    /renderDynamicBoard[\s\S]{0,200}renderBreakTargets/.test(babylon),
  targetRingColour: /route-break-target", "(#[0-9a-f]{6})"/i.exec(babylon)?.[1],
  aimRingColour: /route-break-aim", "(#[0-9a-f]{6})"/i.exec(babylon)?.[1],
  note:
    "valid-target rings are control information and appear only with the Pickaxe; no wall carries a mark of its own",
});

// The contextual ring must not borrow a colour that already means something.
const forbiddenOnTarget = {
  trapRed: /route-break-(target|aim)", "#(7e1620|a51e2a|df4e5a|f0463e)/i.test(babylon),
  sentinelTeal: /route-break-(target|aim)", "#(7fd8d0|2f9e91|a9f0e6|4fd1c5)/i.test(babylon),
  moveGreen: /route-break-(target|aim)", "#(54f3ad|16a34a|5fce8b|34d399)/i.test(babylon),
};
check("BREAK_TARGET_VISUAL_LANGUAGE", !Object.values(forbiddenOnTarget).some(Boolean), {
  ...forbiddenOnTarget,
  note:
    "bronze, borrowed from the Pickaxe itself — not the trap's red, not the Sentinel's teal, not the move ring's green",
});

// --- §22/§26: the shield is gone, the spent chest is not -------------------
const shieldTraces = {
  babylonScene: /shield/i.test(codeOnly(babylon)),
  babylonBoard: /shield/i.test(codeOnly(babylonBoard)),
  hook: /shield/i.test(codeOnly(hook)),
  // The Hunter's and the Sentinel's legend icons are lucide's `Shield` /
  // `ShieldPlus` glyphs, which name a defender, not the removed pickup. What
  // must be gone is the WORD the player used to read.
  gameShieldWording: /escudo/i.test(game) || /rsg-hud-shield|rsg-shield-chip/.test(game),
  detailLabels: /shield/i.test(read("src/lib/detail-labels.ts")),
  cssShieldClasses: /rsg-hud-shield-active|rsg-shield-chip|rsg-chips/.test(css),
  shieldComponentFile: fs.existsSync(
    path.join(ROOT, "src/components/three/route/RouteShield3D.tsx"),
  ),
};
check("SHIELD_FULLY_REMOVED", !Object.values(shieldTraces).some(Boolean), {
  ...shieldTraces,
  remainingOnDisk: {
    "public/models/route/shield.glb": fs.existsSync(
      path.join(ROOT, "public/models/route/shield.glb"),
    ),
    note:
      "no longer loaded by the Route board; the file and its Blender script stay only because two unrelated diorama scripts import them",
  },
});

check(
  "CHEST_STAYS_VISIBLY_SPENT",
  babylon.includes("chestSpent") &&
    babylon.includes("if (state.chest) renderChest(parent);") &&
    !babylon.includes("!state.chestOpened) {\n      const pos"),
  {
    babylonDrawsWhenOpened: babylon.includes("if (state.chest) renderChest(parent);"),
    note: "§26 — an opened chest stays on the board, lid back and ember out",
  },
);

// --- no strategy in the renderer -------------------------------------------
const strategyLeaks = {
  babylonDecidesBreakable:
    /chooseBreakableWalls|auditBreakableWalls|certifyBreakableWall/.test(
      codeOnly(babylon),
    ),
  babylonMutatesWalls: /walls\.(delete|add)\(/.test(codeOnly(babylon)),
};
check("NO_STRATEGY_IN_RENDER_LAYER", !Object.values(strategyLeaks).some(Boolean), {
  ...strategyLeaks,
  note: "the renderer receives breakableWallKeys / brokenWallKey and draws them; it never decides them",
});

const allPass = checks.every((c) => c.pass);
fs.writeFileSync(
  path.join(OUT, "chest-static-render-audit.json"),
  JSON.stringify(
    {
      mission: "ROTA-CHEST-REWARDS-01",
      note: "Static source inspection only; this environment cannot composite frames.",
      babylonLights: lightConstructions,
      ROUTE_MAX_LIGHTS: Number(routeMaxLights),
      checks,
      allPass,
    },
    null,
    2,
  ),
);
console.log(`\n${allPass ? "STATIC_RENDER_AUDIT_OK" : "STATIC_RENDER_AUDIT_FAILED"}`);
if (!allPass) process.exitCode = 1;
