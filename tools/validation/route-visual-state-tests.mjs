/**
 * ROTA-VISUAL-STATE-06 — source-level visual ownership contract.
 *
 * The reported defect is temporal, not a theme mapping: the procedural
 * emergency board was visible while the approved GLBs were still pending.
 * These checks keep the readiness boundary, fallback semantics, renderer
 * ownership, light budget and lifecycle ownership explicit without relying
 * on pixel snapshots.
 *
 * Usage: node tools/validation/route-visual-state-tests.mjs
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.resolve("docs/archive/route-visual-state-06");
fs.mkdirSync(OUT, { recursive: true });

const read = (relativePath) =>
  fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const codeOnly = (source) =>
  source.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/.*$/gm, "$1");

const game = read("src/games/escape-maze/RouteStrategyGame.tsx");
const board = read("src/games/escape-maze/RouteBabylonBoard.tsx");
const scene = read("src/games/escape-maze/routeBabylonScene.ts");
const css = read("src/app/globals.css");
const gameCode = codeOnly(game);
const boardCode = codeOnly(board);
const sceneCode = codeOnly(scene);

const checks = [];
function check(id, pass, detail) {
  checks.push({ id, pass, ...detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id}`);
  for (const [key, value] of Object.entries(detail)) {
    console.log(
      `        ${key}: ${typeof value === "object" ? JSON.stringify(value) : value}`,
    );
  }
}

const legacyRouteDirectory = path.join(ROOT, "src/components/three/route");
const legacyRouteFiles = fs.existsSync(legacyRouteDirectory)
  ? fs.readdirSync(legacyRouteDirectory).filter((file) => file.endsWith(".tsx"))
  : [];
const rendererImports = [
  ...gameCode.matchAll(
    /import\(["'](@\/(?:games\/escape-maze\/Route\w*Board|components\/three\/route\/[^"']+))["']\)/g,
  ),
].map((match) => match[1]);
const rendererElements = [
  ...gameCode.matchAll(/<(Route\w*Board)\b/g),
].map((match) => match[1]);
const rendererOwnership = {
  rendererImports,
  rendererElements,
  legacyRouteFiles,
  rendererFlagPresent: /const\s+USE_[A-Z0-9_]*ROUTE_BOARD\b/.test(gameCode),
  alternateRendererBranchPresent:
    /\?\s*\(\s*<Route\w*Board|:\s*\(\s*<Route\w*Board/.test(gameCode),
};
check(
  "SINGLE_BABYLON_RENDERER_OWNERSHIP",
  rendererImports.length === 1 &&
    rendererImports[0] === "@/games/escape-maze/RouteBabylonBoard" &&
    rendererElements.length === 1 &&
    rendererElements[0] === "RouteBabylonBoard" &&
    legacyRouteFiles.length === 0 &&
    !rendererOwnership.rendererFlagPresent &&
    !rendererOwnership.alternateRendererBranchPresent,
  {
    routeRendererCount: rendererElements.length,
    routeRenderer: rendererElements[0] ?? null,
    ...rendererOwnership,
  },
);

const stateInterface =
  /export interface RouteBabylonState \{([\s\S]*?)\n\}/.exec(scene)?.[1] ?? "";
const propsInterface =
  /interface RouteBabylonBoardProps \{([\s\S]*?)\n\}/.exec(board)?.[1] ?? "";
const forbiddenVisualInputs = ["routeNumber", "routeStage", "difficulty"];
const visualInputHits = forbiddenVisualInputs.filter(
  (name) =>
    new RegExp(`\\b${name}\\b`).test(codeOnly(stateInterface)) ||
    new RegExp(`\\b${name}\\b`).test(codeOnly(propsInterface)),
);
check("NO_ROUTE_STAGE_DIFFICULTY_THEME_INPUT", visualInputHits.length === 0, {
  forbiddenVisualInputs,
  hits: visualInputHits,
  note: "Route number, cyclic stage and difficulty do not enter the Babylon visual state",
});

const awaitReadyIndex = boardCode.indexOf("await controller.ready;");
const revealIndex = boardCode.indexOf("setIsVisualReady(true);");
const readinessContract = {
  startsHidden: /useState\(false\)/.test(boardCode),
  revealsAfterReady: awaitReadyIndex >= 0 && revealIndex > awaitReadyIndex,
  exposesState:
    /data-visual-state=\{isVisualReady \? "ready" : "loading"\}/.test(boardCode),
  pendingLoader: /!isVisualReady && \([\s\S]*rsg-canvas-loading/.test(boardCode),
  resetAfterReady: /isVisualReady && \([\s\S]*route-babylon-reset/.test(boardCode),
  canvasHiddenByDefault:
    /\.route-babylon-board\s*\{[\s\S]*?visibility:\s*hidden;[\s\S]*?\}/.test(css),
  canvasRevealedExplicitly:
    /\.route-babylon-wrap\[data-visual-state="ready"\] \.route-babylon-board\s*\{\s*visibility:\s*visible;\s*\}/.test(
      css,
    ),
};
check(
  "READY_FRAME_IS_THE_REVEAL_BOUNDARY",
  Object.values(readinessContract).every(Boolean),
  readinessContract,
);

const initialRenderIndex = sceneCode.indexOf("renderBoard();");
const assetBatchIndex = sceneCode.indexOf("const essentialAssetLoads = Promise.all([");
const readyIndex = sceneCode.indexOf("const ready = essentialAssetLoads.then(");
const fallbackContract = {
  boardStartsPending: /let boardAssetStatus: BoardAssetStatus = "pending";/.test(
    sceneCode,
  ),
  wallStartsPending: /let wallAssetStatus: BoardAssetStatus = "pending";/.test(
    sceneCode,
  ),
  proceduralBoardForNonLoaded:
    /if \(boardAssetStatus !== "loaded"\) \{\s*renderBase\(nextRoot\);/.test(
      sceneCode,
    ),
  failedBoardKeepsFallback:
    /catch \(error\) \{\s*boardAssetStatus = "failed";/.test(sceneCode),
  pendingFrameExists:
    initialRenderIndex >= 0 &&
    assetBatchIndex > initialRenderIndex &&
    readyIndex > assetBatchIndex,
  finalFrameAfterAssetSettlement:
    /const ready = essentialAssetLoads\.then\(\(\) => \{[\s\S]*?renderBoard\(\);[\s\S]*?onAfterRenderObservable\.addOnce/.test(
      sceneCode,
    ),
};
check(
  "FALLBACK_REMAINS_FAILURE_SAFE_BUT_PENDING_IS_HIDDEN",
  Object.values(fallbackContract).every(Boolean),
  fallbackContract,
);

const lightConstructions = [
  ...scene.matchAll(/new\s+B\.(\w*Light)\s*\(\s*"([^"]+)"/g),
].map((match) => ({ type: match[1], name: match[2] }));
const maxLights = Number(
  /const ROUTE_MAX_LIGHTS = (\d+);/.exec(scene)?.[1] ?? Number.NaN,
);
check(
  "BABYLON_LIGHT_BUDGET",
  lightConstructions.length === 3 &&
    maxLights === 3 &&
    lightConstructions.map(({ name }) => name).sort().join("|") ===
      ["route-fill-light", "route-key-light", "route-rim-light"].join("|"),
  { count: lightConstructions.length, maxLights, lights: lightConstructions },
);

const lifecycleContract = {
  controllerOwnedByMount: /controllerRef\.current = controller;/.test(boardCode),
  resizeObserverDisconnected: /resizeObserver\?\.disconnect\(\);/.test(boardCode),
  windowListenerRemoved:
    /window\.removeEventListener\("resize", controller\.resize\);/.test(boardCode),
  controllerDisposed: /controller\.dispose\(\);/.test(boardCode),
  pointerListenersRemoved:
    /canvas\.removeEventListener\("pointerdown", handlePointerDown\);/.test(
      sceneCode,
    ) && /canvas\.removeEventListener\("wheel", handleWheel\);/.test(sceneCode),
  renderLoopStopped: /engine\.stopRenderLoop\(\);/.test(sceneCode),
  sceneDisposed: /scene\.dispose\(\);/.test(sceneCode),
  engineDisposed: /engine\.dispose\(\);/.test(sceneCode),
};
check(
  "SCENE_LIFECYCLE_OWNERSHIP",
  Object.values(lifecycleContract).every(Boolean),
  lifecycleContract,
);

const controllerStart = sceneCode.indexOf("export function createRouteBabylonController");
const materialOwnership = {
  proceduralMaterialsControllerLocal:
    sceneCode.indexOf("const materials = createMaterials(B, scene);") > controllerStart,
  sentinelCacheControllerLocal:
    sceneCode.indexOf("const sentinelMaterials = new Map") > controllerStart,
  portalCacheControllerLocal:
    sceneCode.indexOf("const portalStateMaterials = new Map") > controllerStart,
  boardAssetTunedOnImport: /result\.meshes\.forEach\(\(mesh\) => \{[\s\S]*?tuneBoardGameMaterial\(mesh\)/.test(
    sceneCode,
  ),
  cachedPortalMaterialsDisposed: /portalStateMaterials\.forEach\(\(material\) => material\.dispose\(\)\);/.test(
    sceneCode,
  ),
};
check(
  "MATERIAL_OWNERSHIP",
  Object.values(materialOwnership).every(Boolean),
  materialOwnership,
);

const allPass = checks.every(({ pass }) => pass);
const evidence = {
  mission: "MINDFLOW-CLEANUP-03B-R3F-ROUTE-LEGACY-REMOVAL",
  classification: "BABYLON_SINGLE_RENDERER",
  reproducedTransition: {
    stateBefore: "first Babylon mount; essential GLBs pending",
    transition: "initial renderBoard before essentialAssetLoads settle",
    stateAfter: "controller.ready after loaded assets/fallbacks and one complete frame",
    beforeFix: "procedural cream board was visible during pending",
    afterFix: "loading surface remains visible until the ready frame",
  },
  checks,
  allPass,
};

fs.writeFileSync(
  path.join(OUT, "visual-state-contract.json"),
  `${JSON.stringify(evidence, null, 2)}\n`,
);

console.log(
  `\n${allPass ? "ROUTE_VISUAL_STATE_CONTRACT_OK" : "ROUTE_VISUAL_STATE_CONTRACT_FAILED"}`,
);
if (!allPass) process.exitCode = 1;
