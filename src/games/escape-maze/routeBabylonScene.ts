import type * as BABYLON from "@babylonjs/core";
import type { GridPosition } from "@/types/game";

export interface RouteBabylonState {
  rows: number;
  cols: number;
  walls: string[];
  exitPosition: GridPosition;
  lights: GridPosition[];
  collectedKeys: string[];
  player: GridPosition;
  guardian: GridPosition;
  /** The Portal Sentinel. Null before a map exists. */
  sentinel: GridPosition | null;
  /** True while the Sentinel is holding a door — a steadier glow, nothing more. */
  sentinelCommitted: boolean;
  moveTargets: string[];
  traps: GridPosition[];
  triggeredTrapKeys: string[];
  /** The reward chest, or null before a map exists. */
  chest: GridPosition | null;
  chestOpened: boolean;
  /**
   * Walls the Pickaxe could open from where the Explorer stands, right now.
   *
   * ROTA-CHEST-REWARDS-01 (revisão pós-playtest): this replaced a permanent
   * fissure on a certified subset. That crack told the player which walls the
   * generator approved of, which is exactly the hint the mechanic must not give.
   * These keys are contextual — they appear with the Pickaxe and disappear with
   * it — and they mark VALID targets, never good ones.
   */
  breakTargetKeys: string[];
  /** The target the player is pointing at, so it is clear which one will open. */
  aimedWallKey: string | null;
  /** The single wall the Pickaxe opened, or null. Already absent from `walls`. */
  brokenWallKey: string | null;
  dangerTiles: string[];
  reducedMotion: boolean;
  status: "setup" | "playing" | "won" | "lost";
}

export interface RouteBabylonBridge {
  onMove: (delta: GridPosition) => void;
}

export interface RouteBabylonController {
  /** Resolves only after essential assets/fallbacks and one complete frame. */
  ready: Promise<void>;
  updateBoard: (state: RouteBabylonState) => void;
  resize: () => void;
  /** Snap the camera back to the default safe inspection view. */
  resetView: () => void;
  dispose: () => void;
}

type BabylonRuntime = typeof BABYLON;
type RouteMaterials = Record<
  | "wood"
  | "stone"
  | "stoneAlt"
  | "brass"
  | "wall"
  | "hit"
  | "player"
  | "playerGlow"
  | "guardian"
  | "guardianGlow"
  | "sentinel"
  | "sentinelGlow"
  | "sentinelGlowCommitted"
  | "portal"
  | "portalGlow"
  | "portalLocked"
  | "portalGlowLocked"
  | "light"
  | "trap"
  | "trapSpent"
  | "trapDormant"
  | "trapArmed"
  | "trapArmedCore"
  | "chestStone"
  | "chestBronze"
  | "chestGlow"
  | "chestSpent"
  | "breakTarget"
  | "breakAim"
  | "rubble"
  | "danger"
  | "move",
  BABYLON.StandardMaterial
>;

const CELL = 1;
/**
 * How much wood/bronze the board carries around its playable field, per axis.
 *
 * ROTA-BOARD-9X9-SYNC-01: this mirrors `BODY_MARGIN` in
 * `tools/blender/create_route_board_glb.py`, which is where the geometry is
 * actually authored. The scene needs the number for two things the GLB cannot
 * tell it: how far the camera must pull back to hold the whole body, and how
 * wide the ground under the board should be. `--assert` on
 * `tools/validation/inspect-route-board-glb.mjs` checks the built asset against
 * the grid, so a drift between these two files fails loudly.
 */
const BOARD_BODY_MARGIN = 1.65;
/**
 * The board is a flat square seen from ~32 degrees above the horizontal, so its
 * footprint on the screen's vertical axis is roughly half its footprint on the
 * horizontal one — measured at 0.53 on the live scene. 0.62 keeps ~17% of
 * headroom over that for the portal arch, wall tops and the board's thickness.
 */
const BOARD_VERTICAL_FLATTEN = 0.62;
/**
 * How much of the canvas the board's near edge is allowed to span. The corners
 * closest to the camera are the extremes of the silhouette, so this is what
 * decides "complete board" versus "clipped board".
 */
const BOARD_CANVAS_FILL = 0.94;
/** Breathing room around the body, in world units, before the fill applies. */
const BOARD_FIT_MARGIN = 0.15;
/**
 * Every material in the Route scene is compiled for exactly this many lights,
 * which is also how many lights the scene has (key, fill, rim). Keeping the two
 * numbers equal is what stops `@babylonjs/loaders` from rewriting the cap on
 * every GLB import — see the light block in createRouteBabylonController.
 */
const ROUTE_MAX_LIGHTS = 3;
const TILE_HEIGHT = 0.12;
const BOARD_TOP = 0;
const BOARD_GLB_PATH = "/models/route/board.glb";
const WALL_GLB_PATH = "/models/route/wall.glb";
const PLAYER_GLB_PATH = "/models/route/player.glb";
const GUARDIAN_GLB_PATH = "/models/route/guardian.glb";
/**
 * ROTA-CHEST-REWARDS-01: `shield.glb` is no longer loaded. The chest that
 * replaced it is built from the scene's own primitives instead of a new asset —
 * it is four boxes, two bands and an ember, and authoring a GLB for that would
 * have added a build pipeline to save nothing.
 */
const ROUTE_PROP_ASSET_PATHS = {
  portal: "/models/route/portal.glb",
  light: "/models/route/light.glb",
  trap: "/models/route/trap.glb",
} as const;
type RoutePropAssetKey = keyof typeof ROUTE_PROP_ASSET_PATHS;

// --- Board model placement -------------------------------------------------
// The GLB grid is authored at exactly the same coordinates as `cellToPosition`
// — tile centres at x = (col - (COLS-1)/2) * CELL and z = ((ROWS-1)/2 - row) *
// CELL — so scale 1 keeps every piece on its own tile. Scaling the board to fit
// a different grid is never the answer: it would change the cell pitch that the
// pieces, walls and hitboxes all assume. Regenerate the asset instead
// (tools/blender/create_route_board_glb.py, GRID_SIZE) and re-run
// `node tools/validation/inspect-route-board-glb.mjs --assert`.
const BOARD_SCALE = 1;
const BOARD_Y_OFFSET = 0;
const BOARD_MODEL_OFFSET = { x: 0, y: BOARD_Y_OFFSET, z: 0 };
const BOARD_MODEL_ROTATION_Y = 0;
/** Top of the GLB stone tiles — every gameplay piece rests on this surface. */
const BOARD_SURFACE_Y = 0.2;

// --- Wall model placement --------------------------------------------------
// wall.glb follows the same Y-up contract as board.glb: centered in X/Z, base
// resting on local Y = 0, footprint ~0.84 and height ~0.60. Scale 1 keeps the
// block inside a single 0.86 tile (margin on every side) and short enough not
// to hide the player/guardian/portal pieces. Each clone's root sits at
// BOARD_SURFACE_Y so the base rests flat on the stone tile — no sink, no float.
const WALL_SCALE = 1;
const PORTAL_SCALE = 1;
const LIGHT_SCALE = 1;
// Props are authored with their front on target -Z. The portal arch just needs a
// small turn toward the camera's azimuth.
const PORTAL_ROTATION_Y = -0.1;
/** The chest sits slightly turned so both a face and a side catch the key light. */
const CHEST_ROTATION_Y = 0.24;

// --- Character model placement --------------------------------------------
// Both character assets are authored centered on X/Z, bottom at local Y = 0 and
// small enough to fit inside one tile. Scale 1 keeps their authored visual
// proportion: player ~0.71 high, guardian ~0.84 high.
// Player is enlarged a touch and lifted slightly so the friendly blue piece
// reads as clearly "Você" from the default camera. Guardian is made noticeably
// taller/more imposing than the player so the enemy reads at gameplay distance.
const PLAYER_SCALE = 1.22;
const GUARDIAN_SCALE = 1.42;
const PLAYER_Y_OFFSET = 0.02;
const GUARDIAN_Y_OFFSET = 0.02;
// guardian.glb currently reads back-facing from the gameplay camera unless turned 180°.
// Keep the cell alignment but bias the hood/eyes toward the default camera.
const GUARDIAN_ROTATION_Y = Math.PI - 0.12;

// --- Camera composition (cinematic 3/4 premium tabletop) -------------------
const DEFAULT_CAMERA_ALPHA = -Math.PI / 2.16;
const DEFAULT_CAMERA_BETA = Math.PI / 3.1;
// Starting distance before fitCamera() measures the real canvas. Kept close to
// the fitted value for a 9x9 body so nothing pops if a frame renders first.
const DEFAULT_CAMERA_RADIUS = 15.6;
const DEFAULT_CAMERA_TARGET = { x: -0.24, y: 0.08, z: 0.05 };

// --- Tight tablet inspection clamps. Small left/right orbit + a touch of tilt;
// never enough to swap front/back, go top-down, flip, or hit an extreme side
// view. The default view stays the main play view.
const MIN_CAMERA_ALPHA = DEFAULT_CAMERA_ALPHA - 0.3; // ~17 deg left
const MAX_CAMERA_ALPHA = DEFAULT_CAMERA_ALPHA + 0.3; // ~17 deg right
const MIN_CAMERA_BETA = 0.92; // ~53 deg — never top-down
const MAX_CAMERA_BETA = 1.2; // ~69 deg — stays well above the board (no flip)
// ROTA-BOARD-9X9-SYNC-01: both clamps were set around the old 8.65-unit body.
// A 10.65-unit body needs the camera ~2.5 units further out just to hold the
// frame, so 14.5 would have clamped the fit and cropped the board — the clamp,
// not the composition, would have been choosing the framing.
const MIN_CAMERA_RADIUS = 11.5; // closest inspect distance (manual zoom floor)
const MAX_CAMERA_RADIUS = 18; // farthest (board still clearly visible)

// Custom two-finger gesture sensitivities (one finger never orbits).
const ORBIT_ALPHA_SENSITIVITY = 0.005;
const ORBIT_BETA_SENSITIVITY = 0.004;
const WHEEL_ZOOM_STEP = 0.6;

type BoardAssetStatus = "pending" | "loaded" | "failed";

function keyOf(pos: GridPosition): string {
  return `${pos.row},${pos.col}`;
}

function isSameCell(a: GridPosition, b: GridPosition): boolean {
  return a.row === b.row && a.col === b.col;
}

function makeMaterial(
  B: BabylonRuntime,
  scene: BABYLON.Scene,
  name: string,
  diffuse: string,
  options: {
    emissive?: string;
    specular?: string;
    alpha?: number;
  } = {},
) {
  const material = new B.StandardMaterial(name, scene);
  material.maxSimultaneousLights = ROUTE_MAX_LIGHTS;
  material.diffuseColor = B.Color3.FromHexString(diffuse);
  material.specularColor = B.Color3.FromHexString(options.specular ?? "#2f2417");
  if (options.emissive) {
    material.emissiveColor = B.Color3.FromHexString(options.emissive);
  }
  if (options.alpha !== undefined) {
    material.alpha = options.alpha;
  }
  return material;
}

function createMaterials(
  B: BabylonRuntime,
  scene: BABYLON.Scene,
): RouteMaterials {
  return {
    wood: makeMaterial(B, scene, "route-wood", "#2a1710", {
      specular: "#76552d",
    }),
    stone: makeMaterial(B, scene, "route-stone", "#50584b", {
      specular: "#a89867",
    }),
    stoneAlt: makeMaterial(B, scene, "route-stone-alt", "#5e654f", {
      specular: "#b6a76f",
    }),
    brass: makeMaterial(B, scene, "route-brass", "#d8a449", {
      specular: "#fff0a8",
    }),
    wall: makeMaterial(B, scene, "route-wall", "#725636", {
      specular: "#e0b05e",
    }),
    hit: makeMaterial(B, scene, "route-hit-tile", "#000000", {
      alpha: 0.001,
      specular: "#000000",
    }),
    player: makeMaterial(B, scene, "route-player", "#37d9ea", {
      emissive: "#0f8491",
      specular: "#c7ffff",
    }),
    playerGlow: makeMaterial(B, scene, "route-player-glow", "#67e8f9", {
      emissive: "#20d9ff",
      alpha: 0.38,
    }),
    guardian: makeMaterial(B, scene, "route-guardian", "#5c3a18", {
      specular: "#d69b35",
    }),
    guardianGlow: makeMaterial(B, scene, "route-guardian-glow", "#ffd166", {
      emissive: "#f59e0b",
    }),
    // The Hunter is warm bronze because it moves at you. The Sentinel is cold
    // stone with the portal's own teal: it belongs to the place it guards.
    // Emissive only — the scene keeps exactly three lights.
    sentinel: makeMaterial(B, scene, "route-sentinel", "#2f4858", {
      specular: "#8fb8c9",
    }),
    sentinelGlow: makeMaterial(B, scene, "route-sentinel-glow", "#7fd8d0", {
      emissive: "#2f9e91",
    }),
    sentinelGlowCommitted: makeMaterial(B, scene, "route-sentinel-glow-committed", "#a9f0e6", {
      emissive: "#4fd1c5",
    }),
    portal: makeMaterial(B, scene, "route-portal", "#245f31", {
      specular: "#b5ffb6",
    }),
    portalGlow: makeMaterial(B, scene, "route-portal-glow", "#7cff9b", {
      emissive: "#22c55e",
      alpha: 0.72,
    }),
    portalLocked: makeMaterial(B, scene, "route-portal-locked", "#394338", {
      emissive: "#071108",
      specular: "#6f866f",
    }),
    portalGlowLocked: makeMaterial(
      B,
      scene,
      "route-portal-glow-locked",
      "#5f7661",
      {
        emissive: "#12351a",
        alpha: 0.34,
      },
    ),
    light: makeMaterial(B, scene, "route-light", "#f6c447", {
      emissive: "#facc15",
      specular: "#fff4b0",
    }),
    // ROTA-TRAPS-VISUAL-REFINE-01: an old rune asleep in the stone, and the
    // same rune sealed. The previous pass read as a pink badge laid on the tile
    // and lit almost white — close enough to a collectible to invite picking it
    // up, which is the opposite of what it means. Wine and burnt red now, with
    // no light value anywhere near white. Emissive only: three lights, still.
    trapDormant: makeMaterial(B, scene, "route-trap-dormant", "#3a1a1f", {
      specular: "#4a2229",
    }),
    trapArmed: makeMaterial(B, scene, "route-trap-armed", "#7e1620", {
      emissive: "#8f1a24",
    }),
    trapArmedCore: makeMaterial(B, scene, "route-trap-armed-core", "#a51e2a", {
      emissive: "#b3202c",
    }),
    trap: makeMaterial(B, scene, "route-trap", "#df4e5a", {
      emissive: "#7f1d1d",
      specular: "#ffd5dc",
    }),
    trapSpent: makeMaterial(B, scene, "route-trap-spent", "#59333a", {
      emissive: "#241016",
      alpha: 0.44,
    }),
    // ROTA-CHEST-REWARDS-01: the blue shield is gone. The chest is the board's
    // own language — the same stone the tiles are cut from, the same bronze the
    // frame is banded with — plus one restrained teal ember that ties it to the
    // world. It is deliberately quieter than the portal: a relic on the floor,
    // not a second objective. Emissive only; the scene still has three lights.
    chestStone: makeMaterial(B, scene, "route-chest-stone", "#3d3a30", {
      specular: "#8b7f5e",
    }),
    chestBronze: makeMaterial(B, scene, "route-chest-bronze", "#a9762f", {
      specular: "#ffdc9a",
    }),
    chestGlow: makeMaterial(B, scene, "route-chest-glow", "#63b6ad", {
      emissive: "#236f68",
    }),
    chestSpent: makeMaterial(B, scene, "route-chest-spent", "#4a463c", {
      specular: "#6b6355",
    }),
    // The Pickaxe's own bronze, borrowed from the tool and from its button — so
    // the ring under a wall reads as "the Pickaxe can reach this", not as a
    // property of the wall. It exists only while the Pickaxe does. The aim is
    // the same colour, brighter, for the one wall about to open.
    breakTarget: makeMaterial(B, scene, "route-break-target", "#c9903f", {
      emissive: "#5a3a12",
      alpha: 0.5,
    }),
    breakAim: makeMaterial(B, scene, "route-break-aim", "#ffcf7a", {
      emissive: "#a8641a",
      alpha: 0.78,
    }),
    rubble: makeMaterial(B, scene, "route-rubble", "#4b3826", {
      specular: "#7d5f3a",
    }),
    danger: makeMaterial(B, scene, "route-danger", "#f5a524", {
      emissive: "#a85506",
      alpha: 0.45,
    }),
    move: makeMaterial(B, scene, "route-move", "#54f3ad", {
      emissive: "#16a34a",
      alpha: 0.35,
    }),
  };
}

export function createRouteBabylonController(
  B: BabylonRuntime,
  canvas: HTMLCanvasElement,
  initialState: RouteBabylonState,
  bridge: RouteBabylonBridge,
): RouteBabylonController {
  const engine = new B.Engine(canvas, true, {
    antialias: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
    premultipliedAlpha: false,
    stencil: true,
  });
  const scene = new B.Scene(engine);
  scene.clearColor = new B.Color4(0, 0, 0, 0);
  scene.ambientColor = B.Color3.FromHexString("#6c5635");

  // Bright, warm "premium toy board" grade. ACES tone-mapping keeps the brass
  // and emissive pieces from blowing out, but exposure is lifted and contrast
  // relaxed so the board reads as a brightly-lit stage object, not a dark
  // render test. The heavy vignette that used to crush the board edges into
  // black is removed — the warmth now comes from lights + the table, not from
  // drowning everything in shadow.
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType =
    B.ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure = 1.34;
  scene.imageProcessingConfiguration.contrast = 1.06;
  scene.imageProcessingConfiguration.vignetteEnabled = false;

  const camera = new B.ArcRotateCamera(
    "route-camera",
    DEFAULT_CAMERA_ALPHA,
    DEFAULT_CAMERA_BETA,
    DEFAULT_CAMERA_RADIUS,
    new B.Vector3(
      DEFAULT_CAMERA_TARGET.x,
      DEFAULT_CAMERA_TARGET.y,
      DEFAULT_CAMERA_TARGET.z,
    ),
    scene,
  );
  // Camera interaction is a fully custom two-finger gesture layer (see below),
  // so NO Babylon pointer/keyboard inputs are attached. Consequences:
  //  - a single-finger drag can never orbit the camera (one finger is reserved
  //    for tile taps),
  //  - the arrow keys stay owned by the game (useEscapeMaze), never the camera.
  // The arc-rotate limits below back up the manual clamps in the gesture layer.
  camera.inputs.clear();
  camera.lowerAlphaLimit = MIN_CAMERA_ALPHA;
  camera.upperAlphaLimit = MAX_CAMERA_ALPHA;
  camera.lowerBetaLimit = MIN_CAMERA_BETA;
  camera.upperBetaLimit = MAX_CAMERA_BETA;
  camera.lowerRadiusLimit = MIN_CAMERA_RADIUS;
  camera.upperRadiusLimit = MAX_CAMERA_RADIUS;
  camera.minZ = 0.05;
  camera.maxZ = 60;
  camera.fov = 0.72;

  const warmKey = new B.DirectionalLight(
    "route-key-light",
    new B.Vector3(-0.45, -1, -0.35),
    scene,
  );
  warmKey.position = new B.Vector3(5, 8.5, 6);
  warmKey.intensity = 2.85;
  warmKey.diffuse = B.Color3.FromHexString("#ffe7bd");
  warmKey.specular = B.Color3.FromHexString("#fff4d6");

  // Strong warm sky fill lifts the whole board out of the muddy shadows so the
  // sage tiles and gold frame read brightly at gameplay distance.
  const fill = new B.HemisphericLight(
    "route-fill-light",
    new B.Vector3(0, 1, 0),
    scene,
  );
  fill.intensity = 0.92;
  fill.diffuse = B.Color3.FromHexString("#fff4dd");
  fill.groundColor = B.Color3.FromHexString("#56391f");
  fill.specular = B.Color3.FromHexString("#f4c97e");

  // Cool back rim separates the board silhouette from the dark background.
  const rim = new B.PointLight(
    "route-rim-light",
    new B.Vector3(-4.2, 3.0, -4.4),
    scene,
  );
  rim.intensity = 0.92;
  rim.diffuse = B.Color3.FromHexString("#86e3ff");

  // ROTA-RUNTIME-STABILITY-01: key + fill + rim are the ONLY lights in this
  // scene, and that is a hard invariant, not a coincidence.
  //
  // Two things depend on it:
  //
  //  1. Every material here is capped at ROUTE_MAX_LIGHTS (3) and Babylon binds
  //     the FIRST `cap` entries of `mesh.lightSources`, which follow scene
  //     creation order. These three are created first, so a fourth light could
  //     never reach a surface anyway — it would only cost shader work. That was
  //     measured: disabling the seven decorative point lights that used to live
  //     here changed 1 pixel out of 646.816 (0,000%).
  //
  //  2. `@babylonjs/loaders` raises the cap of EVERY material in the scene to
  //     `scene.lights.length` after each GLB import (glTFLoader.js: "Making sure
  //     we enable enough lights to have all lights together"). With 3 lights and
  //     Babylon's default cap of 4 that line is a permanent no-op. With 11 it
  //     rewrote 200+ materials eight times over, and each write marks every
  //     submesh light-dirty, forcing a full shader recompile.
  //
  // Portal state, light orbs, the chest ember, trap runes and the guardian's eyes
  // are all read through emissive materials plus the glow layer below — they
  // never needed point lights. Keep it that way: adding a light here is a
  // scene-wide recompile, not a local decision.
  const glow = new B.GlowLayer("route-glow-layer", scene, {
    mainTextureSamples: 4,
  });
  glow.intensity = 0.55;

  const shadowGenerator = new B.ShadowGenerator(1024, warmKey);
  shadowGenerator.useBlurExponentialShadowMap = true;
  shadowGenerator.blurKernel = 24;
  shadowGenerator.bias = 0.0008;

  // --- Quiet ground ------------------------------------------------------------
  // ROTA-BOARD-FOCUS-01: the previous territory (a stone shelf ringing the
  // board, ten outcrops on the rim and two access steps) crowded the frame and
  // competed with the board — the rocks touched the frame and pulled the eye
  // outward. All of it is gone. What remains is a single low, dark mass far
  // under the board: it grounds the scene and catches shadow, and never reads
  // as scenery next to the board. No painted ellipse, no plinth, no panel.
  const groundMat = new B.StandardMaterial("route-ground", scene);
  groundMat.maxSimultaneousLights = ROUTE_MAX_LIGHTS;
  groundMat.diffuseColor = B.Color3.FromHexString("#1d2224");
  groundMat.specularColor = B.Color3.FromHexString("#000000");

  // ROTA-BOARD-9X9-SYNC-01: sized from the board body it sits under (10.65 at
  // 9x9) instead of the 8.65 it was hand-fitted to, so it still reads as ground
  // beneath the board rather than a disc peeking out from under it.
  const groundSpan =
    Math.max(initialState.rows, initialState.cols) * CELL + BOARD_BODY_MARGIN;
  const ground = B.MeshBuilder.CreateCylinder(
    "route-ground",
    {
      diameterTop: groundSpan * 0.995,
      diameterBottom: groundSpan * 0.902,
      height: 0.7,
      tessellation: 9,
    },
    scene,
  );
  ground.position.set(0, -1.02, 0.1);
  ground.rotation.y = 0.24;
  ground.scaling.z = 0.86;
  ground.material = groundMat;
  ground.isPickable = false;
  ground.receiveShadows = true;

  const materials = createMaterials(B, scene);
  materials.hit.disableDepthWrite = true;
  let state = initialState;
  let staticBoardRoot: BABYLON.TransformNode | null = null;
  let dynamicBoardRoot: BABYLON.TransformNode | null = null;
  let staticBoardSignature = "";
  let boardAssetRoot: BABYLON.TransformNode | null = null;
  let boardAssetStatus: BoardAssetStatus = "pending";
  let boardAssetWarningLogged = false;
  // Loaded-once wall.glb prototype; cloned onto every wall cell each render.
  let wallAssetProto: BABYLON.TransformNode | null = null;
  let wallAssetStatus: BoardAssetStatus = "pending";
  let wallAssetWarningLogged = false;
  let playerAssetProto: BABYLON.TransformNode | null = null;
  let playerAssetStatus: BoardAssetStatus = "pending";
  let playerAssetWarningLogged = false;
  let guardianAssetProto: BABYLON.TransformNode | null = null;
  let guardianAssetStatus: BoardAssetStatus = "pending";
  let guardianAssetWarningLogged = false;
  const propAssets: Record<
    RoutePropAssetKey,
    {
      proto: BABYLON.TransformNode | null;
      status: BoardAssetStatus;
      warningLogged: boolean;
    }
  > = {
    portal: { proto: null, status: "pending", warningLogged: false },
    light: { proto: null, status: "pending", warningLogged: false },
    trap: { proto: null, status: "pending", warningLogged: false },
  };
  let disposed = false;

  // Visual cell -> world position. Columns map straight to +X (col 0 left ->
  // col 6 right). Rows map to -Z so that row 0 sits at the FAR/back edge and
  // row 6 (the player's start side) sits at the NEAR/front edge for the
  // intended 3/4 camera. This is a pure visual mapping shared by the rendered
  // pieces, the invisible pick tiles and the projection, so hitboxes always
  // stay aligned with what is drawn.
  function cellToPosition(row: number, col: number) {
    const x = (col - (state.cols - 1) / 2) * CELL;
    const z = ((state.rows - 1) / 2 - row) * CELL;
    return new B.Vector3(x, BOARD_TOP, z);
  }

  function box(
    name: string,
    width: number,
    height: number,
    depth: number,
    position: BABYLON.Vector3,
    material: BABYLON.Material,
    parent: BABYLON.TransformNode,
    castsShadow = true,
  ) {
    const mesh = B.MeshBuilder.CreateBox(name, { width, height, depth }, scene);
    mesh.position.copyFrom(position);
    mesh.material = material;
    mesh.parent = parent;
    mesh.receiveShadows = true;
    if (castsShadow) shadowGenerator.addShadowCaster(mesh);
    return mesh;
  }

  function cylinder(
    name: string,
    diameter: number,
    height: number,
    position: BABYLON.Vector3,
    material: BABYLON.Material,
    parent: BABYLON.TransformNode,
    tessellation = 32,
    castsShadow = true,
  ) {
    const mesh = B.MeshBuilder.CreateCylinder(
      name,
      { diameter, height, tessellation },
      scene,
    );
    mesh.position.copyFrom(position);
    mesh.material = material;
    mesh.parent = parent;
    mesh.receiveShadows = true;
    if (castsShadow) shadowGenerator.addShadowCaster(mesh);
    return mesh;
  }

  function sphere(
    name: string,
    diameter: number,
    position: BABYLON.Vector3,
    material: BABYLON.Material,
    parent: BABYLON.TransformNode,
    castsShadow = true,
  ) {
    const mesh = B.MeshBuilder.CreateSphere(name, { diameter, segments: 24 }, scene);
    mesh.position.copyFrom(position);
    mesh.material = material;
    mesh.parent = parent;
    if (castsShadow) shadowGenerator.addShadowCaster(mesh);
    return mesh;
  }

  function torus(
    name: string,
    diameter: number,
    thickness: number,
    position: BABYLON.Vector3,
    material: BABYLON.Material,
    parent: BABYLON.TransformNode,
  ) {
    const mesh = B.MeshBuilder.CreateTorus(
      name,
      { diameter, thickness, tessellation: 54 },
      scene,
    );
    mesh.position.copyFrom(position);
    mesh.rotation.x = Math.PI / 2;
    mesh.material = material;
    mesh.parent = parent;
    return mesh;
  }

  function isBakedShadowNode(node: BABYLON.Node) {
    return node.name.toLowerCase().includes("shadow");
  }

  type TunableAssetMaterial = BABYLON.Material & {
    alpha?: number;
    albedoColor?: BABYLON.Color3;
    diffuseColor?: BABYLON.Color3;
    emissiveColor?: BABYLON.Color3;
    emissiveIntensity?: number;
    maxSimultaneousLights?: number;
    metallic?: number;
    roughness?: number;
    specularColor?: BABYLON.Color3;
  };

  function setMaterialColor(
    material: TunableAssetMaterial,
    color: BABYLON.Color3,
  ) {
    material.albedoColor = color;
    material.diffuseColor = color;
  }

  /**
   * Clamp a material to the scene's light budget — but only when it is actually
   * off budget.
   *
   * The guard is the point. `maxSimultaneousLights` is an `expandToProperty`
   * accessor: Babylon runs `_markAllSubMeshesAsLightsDirty()` on every
   * assignment, equal value or not. The tuners below run inside
   * `configureVisualClone`, which runs on every `renderDynamicBoard()` — once
   * per Explorer move. Assigning unconditionally therefore dirtied a few hundred
   * submeshes on every single turn and made the whole scene queue a shader
   * revalidation for nothing.
   */
  function capMaterialLights(material: TunableAssetMaterial) {
    if (material.maxSimultaneousLights === undefined) return;
    if (material.maxSimultaneousLights === ROUTE_MAX_LIGHTS) return;
    material.maxSimultaneousLights = ROUTE_MAX_LIGHTS;
  }

  /**
   * Catch materials the tuners never see: the baked-shadow materials (skipped by
   * `isBakedShadowNode`) and anything a future GLB brings in. Cheap to run,
   * because `capMaterialLights` is a no-op once a material is on budget.
   */
  function capSceneMaterialLights() {
    scene.materials.forEach((material) =>
      capMaterialLights(material as TunableAssetMaterial),
    );
  }

  function tuneBoardGameMaterial(mesh: BABYLON.AbstractMesh) {
    const material = mesh.material as TunableAssetMaterial | null;
    if (!material) return;
    capMaterialLights(material);

    const materialName = material.name.toLowerCase();
    if (materialName.includes("darkwood")) {
      setMaterialColor(material, B.Color3.FromHexString("#6b3f20"));
      if (material.roughness !== undefined) material.roughness = 0.58;
    } else if (materialName.includes("woodgraindark")) {
      setMaterialColor(material, B.Color3.FromHexString("#2f1a0d"));
      if (material.roughness !== undefined) material.roughness = 0.74;
    } else if (materialName.includes("woodgrainwarm")) {
      setMaterialColor(material, B.Color3.FromHexString("#875028"));
      if (material.roughness !== undefined) material.roughness = 0.68;
    } else if (materialName.includes("woodgrainsoft")) {
      setMaterialColor(material, B.Color3.FromHexString("#a86a34"));
      if (material.roughness !== undefined) material.roughness = 0.68;
    } else if (
      materialName.includes("darkstone") ||
      materialName.includes("tilevariationa")
    ) {
      setMaterialColor(material, B.Color3.FromHexString("#4b625f"));
      if (material.roughness !== undefined) material.roughness = 0.68;
    } else if (materialName.includes("tilevariationb")) {
      setMaterialColor(material, B.Color3.FromHexString("#405754"));
      if (material.roughness !== undefined) material.roughness = 0.72;
    } else if (materialName.includes("tilevariationc")) {
      setMaterialColor(material, B.Color3.FromHexString("#596b5b"));
      if (material.roughness !== undefined) material.roughness = 0.7;
    } else if (materialName.includes("tilemarkdark")) {
      setMaterialColor(material, B.Color3.FromHexString("#1b2725"));
      if (material.roughness !== undefined) material.roughness = 0.84;
    } else if (materialName.includes("tilemarklight")) {
      setMaterialColor(material, B.Color3.FromHexString("#879782"));
      if (material.roughness !== undefined) material.roughness = 0.8;
    } else if (materialName.includes("tileedgewear")) {
      setMaterialColor(material, B.Color3.FromHexString("#74836f"));
      if (material.roughness !== undefined) material.roughness = 0.82;
    } else if (
      materialName.includes("agedbrass") ||
      materialName.includes("warmrivet") ||
      materialName.includes("walledgehighlight")
    ) {
      setMaterialColor(material, B.Color3.FromHexString("#a86f31"));
      material.emissiveColor = B.Color3.FromHexString("#1a0d03");
      if (material.metallic !== undefined) material.metallic = 0.72;
      if (material.roughness !== undefined) material.roughness = 0.44;
    } else if (materialName.includes("bronzedark")) {
      setMaterialColor(material, B.Color3.FromHexString("#70431f"));
      material.emissiveColor = B.Color3.FromHexString("#120803");
      if (material.metallic !== undefined) material.metallic = 0.74;
      if (material.roughness !== undefined) material.roughness = 0.56;
    } else if (
      materialName.includes("brasspolished") ||
      materialName.includes("runeinlay")
    ) {
      setMaterialColor(material, B.Color3.FromHexString("#bd873c"));
      material.emissiveColor = B.Color3.FromHexString("#190c03");
      if (material.metallic !== undefined) material.metallic = 0.78;
      if (material.roughness !== undefined) material.roughness = 0.34;
    } else if (materialName.includes("cornergemhighlight")) {
      setMaterialColor(material, B.Color3.FromHexString("#9ad7ff"));
      material.emissiveColor = B.Color3.FromHexString("#2364b8");
      if (material.roughness !== undefined) material.roughness = 0.1;
    } else if (materialName.includes("cornergem")) {
      setMaterialColor(material, B.Color3.FromHexString("#1666c8"));
      material.emissiveColor = B.Color3.FromHexString("#072a72");
      if (material.roughness !== undefined) material.roughness = 0.12;
    } else if (materialName.includes("deepshadow")) {
      setMaterialColor(material, B.Color3.FromHexString("#2c2118"));
      if (material.roughness !== undefined) material.roughness = 0.76;
    } else if (materialName.includes("walldarkstone")) {
      setMaterialColor(material, B.Color3.FromHexString("#5d625c"));
      if (material.roughness !== undefined) material.roughness = 0.66;
    } else if (materialName.includes("wallsidestone")) {
      setMaterialColor(material, B.Color3.FromHexString("#74736a"));
      if (material.roughness !== undefined) material.roughness = 0.62;
    }
  }

  function tuneCharacterMaterial(mesh: BABYLON.AbstractMesh) {
    const material = mesh.material as TunableAssetMaterial | null;
    if (!material) return;
    capMaterialLights(material);

    const materialName = material.name.toLowerCase();
    if (materialName.includes("playersuitblue")) {
      material.albedoColor = B.Color3.FromHexString("#075f91");
      material.diffuseColor = B.Color3.FromHexString("#075f91");
      if (material.roughness !== undefined) material.roughness = 0.44;
    } else if (materialName.includes("playersuittrim")) {
      material.albedoColor = B.Color3.FromHexString("#1ba5cf");
      material.diffuseColor = B.Color3.FromHexString("#1ba5cf");
      material.emissiveColor = B.Color3.FromHexString("#0b4f66");
      if (material.emissiveIntensity !== undefined) {
        material.emissiveIntensity = 0.28;
      }
    } else if (materialName.includes("playerhairblue")) {
      material.albedoColor = B.Color3.FromHexString("#0394bf");
      material.diffuseColor = B.Color3.FromHexString("#0394bf");
      material.emissiveColor = B.Color3.FromHexString("#01202c");
      if (material.roughness !== undefined) material.roughness = 0.36;
    } else if (materialName.includes("playerskin")) {
      material.albedoColor = B.Color3.FromHexString("#d9a077");
      material.diffuseColor = B.Color3.FromHexString("#d9a077");
      if (material.roughness !== undefined) material.roughness = 0.52;
    } else if (materialName.includes("playereyedark")) {
      material.albedoColor = B.Color3.FromHexString("#07111a");
      material.diffuseColor = B.Color3.FromHexString("#07111a");
      if (material.roughness !== undefined) material.roughness = 0.24;
    } else if (materialName.includes("playerbootdark")) {
      material.albedoColor = B.Color3.FromHexString("#081725");
      material.diffuseColor = B.Color3.FromHexString("#081725");
      if (material.roughness !== undefined) material.roughness = 0.5;
    } else if (materialName.includes("playergoldbuckle")) {
      material.albedoColor = B.Color3.FromHexString("#d28a2c");
      material.diffuseColor = B.Color3.FromHexString("#d28a2c");
      if (material.metallic !== undefined) material.metallic = 0.65;
      if (material.roughness !== undefined) material.roughness = 0.36;
    } else if (materialName.includes("playercyanglow")) {
      material.emissiveColor = B.Color3.FromHexString("#1fdcef");
      if (material.emissiveIntensity !== undefined) {
        material.emissiveIntensity = 0.78;
      }
    } else if (materialName.includes("playercyancore")) {
      material.emissiveColor = B.Color3.FromHexString("#9efbff");
      if (material.emissiveIntensity !== undefined) {
        material.emissiveIntensity = 0.95;
      }
    } else if (materialName.includes("guardiancloakdark")) {
      // Dark silhouette so the guardian never reads like the tan wall blocks.
      material.albedoColor = B.Color3.FromHexString("#221308");
      material.diffuseColor = B.Color3.FromHexString("#221308");
      if (material.roughness !== undefined) material.roughness = 0.74;
    } else if (materialName.includes("guardianhoodsoft")) {
      material.albedoColor = B.Color3.FromHexString("#2c1c10");
      material.diffuseColor = B.Color3.FromHexString("#2c1c10");
      if (material.roughness !== undefined) material.roughness = 0.7;
    } else if (materialName.includes("guardianfacevoid")) {
      material.albedoColor = B.Color3.FromHexString("#070302");
      material.diffuseColor = B.Color3.FromHexString("#070302");
      material.emissiveColor = B.Color3.FromHexString("#120500");
      if (material.roughness !== undefined) material.roughness = 0.9;
    } else if (materialName.includes("guardianbasedark")) {
      material.albedoColor = B.Color3.FromHexString("#2d2117");
      material.diffuseColor = B.Color3.FromHexString("#2d2117");
    } else if (materialName.includes("guardianambertrim")) {
      material.albedoColor = B.Color3.FromHexString("#d98b2c");
      material.diffuseColor = B.Color3.FromHexString("#d98b2c");
      if (material.metallic !== undefined) material.metallic = 0.78;
      if (material.roughness !== undefined) material.roughness = 0.38;
    } else if (materialName.includes("guardianeyeglow")) {
      // Hot amber eyes — the primary "danger" read against the dark hood.
      material.emissiveColor = B.Color3.FromHexString("#ffc740");
      if (material.emissiveIntensity !== undefined) {
        material.emissiveIntensity = 6.2;
      }
    } else if (materialName.includes("guardianwarmglow")) {
      material.emissiveColor = B.Color3.FromHexString("#f9a417");
      if (material.emissiveIntensity !== undefined) {
        material.emissiveIntensity = 1.45;
      }
    }
  }

  /**
   * The Sentinel wears the Hunter's model in a cold palette.
   *
   * Same family, different job: reusing the guardian mesh is the whole point —
   * a defender should read as a defender, not as scenery. The separation is
   * carried entirely by material.
   *
   * Every material is CLONED before it is touched. The proto's materials are
   * shared with the Hunter, so mutating them in place would turn him teal too,
   * and the two render in the same pass. The clones are cached by source name,
   * so a board rebuild reuses them instead of growing the material count.
   */
  const sentinelMaterials = new Map<string, TunableAssetMaterial>();

  function tuneSentinelMaterial(mesh: BABYLON.AbstractMesh) {
    const source = mesh.material as TunableAssetMaterial | null;
    if (!source) return;
    const sourceName = source.name.toLowerCase();
    let material = sentinelMaterials.get(sourceName);

    if (!material) {
      const cloned = source.clone(`route-sentinel-${sourceName}`) as
        | TunableAssetMaterial
        | null;
      if (!cloned) return;
      material = cloned;
      sentinelMaterials.set(sourceName, material);
      capMaterialLights(material);

      const paint = (hex: string, roughness?: number) => {
        material!.albedoColor = B.Color3.FromHexString(hex);
        material!.diffuseColor = B.Color3.FromHexString(hex);
        if (roughness !== undefined && material!.roughness !== undefined) {
          material!.roughness = roughness;
        }
      };

      if (sourceName.includes("guardiancloakdark")) {
        paint("#0d1f26", 0.72);
      } else if (sourceName.includes("guardianhoodsoft")) {
        paint("#13303a", 0.68);
      } else if (sourceName.includes("guardianfacevoid")) {
        paint("#04090c", 0.9);
        material.emissiveColor = B.Color3.FromHexString("#062028");
      } else if (sourceName.includes("guardianbasedark")) {
        paint("#17323a");
      } else if (sourceName.includes("guardianambertrim")) {
        paint("#3fb3a6", 0.38);
        if (material.metallic !== undefined) material.metallic = 0.72;
      } else if (sourceName.includes("guardianeyeglow")) {
        // Watchful teal instead of the Hunter's hot amber: this one is waiting
        // for you, not coming for you.
        material.emissiveColor = B.Color3.FromHexString("#7ff2e4");
        if (material.emissiveIntensity !== undefined) {
          material.emissiveIntensity = 4.6;
        }
      } else if (sourceName.includes("guardianwarmglow")) {
        material.emissiveColor = B.Color3.FromHexString("#2f9e91");
        if (material.emissiveIntensity !== undefined) {
          material.emissiveIntensity = 1.2;
        }
      }
    }

    mesh.material = material;
  }

  function tunePropMaterial(mesh: BABYLON.AbstractMesh) {
    const material = mesh.material as TunableAssetMaterial | null;
    if (!material) return;
    capMaterialLights(material);

    const materialName = material.name.toLowerCase();
    if (materialName.includes("portalstone")) {
      setMaterialColor(material, B.Color3.FromHexString("#615943"));
      if (material.roughness !== undefined) material.roughness = 0.72;
    } else if (
      materialName.includes("portalbronze") ||
      materialName.includes("lightbronze") ||
      materialName.includes("trapbronze")
    ) {
      setMaterialColor(material, B.Color3.FromHexString("#a86d2f"));
      material.emissiveColor = B.Color3.FromHexString("#170b03");
      if (material.metallic !== undefined) material.metallic = 0.72;
      if (material.roughness !== undefined) material.roughness = 0.4;
    } else if (
      materialName.includes("portalgreenglow") ||
      materialName.includes("portalglasscore")
    ) {
      material.emissiveColor = B.Color3.FromHexString("#3bf07f");
      if (material.emissiveIntensity !== undefined) {
        material.emissiveIntensity = 1.25;
      }
    } else if (materialName.includes("portalbluegem")) {
      setMaterialColor(material, B.Color3.FromHexString("#1976d2"));
      material.emissiveColor = B.Color3.FromHexString("#0c3a8f");
      if (material.roughness !== undefined) material.roughness = 0.12;
    } else if (
      materialName.includes("lightwarmorb") ||
      materialName.includes("lightglasshighlight")
    ) {
      material.emissiveColor = B.Color3.FromHexString("#ffcf3a");
      if (material.emissiveIntensity !== undefined) {
        material.emissiveIntensity = 0.85;
      }
    } else if (
      materialName.includes("lightdarkbase") ||
      materialName.includes("trapdarkbase")
    ) {
      setMaterialColor(material, B.Color3.FromHexString("#2a1b10"));
      if (material.roughness !== undefined) material.roughness = 0.68;
    } else if (
      materialName.includes("trapcrystalred") ||
      materialName.includes("trapcrystalhighlight")
    ) {
      setMaterialColor(material, B.Color3.FromHexString("#f0463e"));
      material.emissiveColor = B.Color3.FromHexString("#7a0d0b");
      if (material.emissiveIntensity !== undefined) {
        material.emissiveIntensity = 0.95;
      }
      if (material.roughness !== undefined) material.roughness = 0.28;
    }
  }

  /**
   * The two portal looks, built once and reused.
   *
   * ROTA-RUNTIME-STABILITY-01: this used to clone a material per mesh per
   * render. The portal is rebuilt on every `renderDynamicBoard()`, and the
   * previous root is released with `dispose(false, false)` — materials
   * deliberately survive, because the prototypes share them. The clones did not
   * belong to a prototype, so nothing ever freed them: the scene went from 173
   * to 303 materials over ten Explorer moves, and kept climbing.
   *
   * Keyed by source material + state, so a route can be replayed for as long as
   * the Explorer likes and the count stays flat.
   */
  const portalStateMaterials = new Map<string, BABYLON.Material>();

  function applyPortalActivationVisual(
    root: BABYLON.TransformNode,
    active: boolean,
  ) {
    root.getChildMeshes(false).forEach((mesh) => {
      const material = mesh.material as TunableAssetMaterial | null;
      if (!material || isBakedShadowNode(mesh)) return;

      // A fresh clone always carries the prototype's material, so the key stays
      // stable across renders. The guard covers the case of this running twice
      // over the same root.
      const key = `${material.name}::${active ? "active" : "locked"}`;
      const cached = portalStateMaterials.get(key);
      if (cached) {
        mesh.material = cached;
        return;
      }

      const materialClone = material.clone(
        `route-portal-${active ? "active" : "locked"}-${material.name}`,
      ) as TunableAssetMaterial | null;
      if (!materialClone) return;
      capMaterialLights(materialClone);
      portalStateMaterials.set(key, materialClone);

      mesh.material = materialClone;
      const materialName = material.name.toLowerCase();

      if (materialName.includes("portalstone")) {
        setMaterialColor(
          materialClone,
          B.Color3.FromHexString(active ? "#665d43" : "#42483e"),
        );
      } else if (materialName.includes("portalbronze")) {
        setMaterialColor(
          materialClone,
          B.Color3.FromHexString(active ? "#b17634" : "#6b5a3a"),
        );
        materialClone.emissiveColor = B.Color3.FromHexString(
          active ? "#1c0d03" : "#080704",
        );
      } else if (
        materialName.includes("portalgreenglow") ||
        materialName.includes("portalglasscore")
      ) {
        materialClone.emissiveColor = B.Color3.FromHexString(
          active ? "#48ff8b" : "#174421",
        );
        if (materialClone.emissiveIntensity !== undefined) {
          materialClone.emissiveIntensity = active ? 1.65 : 0.22;
        }
        materialClone.alpha = active ? 0.86 : 0.42;
      } else if (materialName.includes("portalbluegem")) {
        setMaterialColor(
          materialClone,
          B.Color3.FromHexString(active ? "#2489ef" : "#24445e"),
        );
        materialClone.emissiveColor = B.Color3.FromHexString(
          active ? "#0f4fbd" : "#071525",
        );
      }
    });
  }

  async function importPrototypeAsset(
    path: string,
    rootName: string,
    tuneMesh: (mesh: BABYLON.AbstractMesh) => void = tuneCharacterMaterial,
  ) {
    const result = await B.SceneLoader.ImportMeshAsync("", "", path, scene);
    if (disposed) {
      result.meshes.forEach((mesh) => mesh.dispose(false, true));
      result.transformNodes.forEach((node) => node.dispose(false, true));
      return null;
    }

    const proto = new B.TransformNode(rootName, scene);
    const importedNodes = [
      ...result.meshes,
      ...result.transformNodes,
    ] as BABYLON.Node[];
    const importedNodeSet = new Set<BABYLON.Node>(importedNodes);

    importedNodes.forEach((node) => {
      if (!node.parent || !importedNodeSet.has(node.parent)) {
        node.parent = proto;
      }
    });

    result.meshes.forEach((mesh) => {
      mesh.isPickable = false;
      if (isBakedShadowNode(mesh)) {
        mesh.setEnabled(false);
        return;
      }
      tuneMesh(mesh);
      mesh.receiveShadows = true;
      shadowGenerator.addShadowCaster(mesh);
    });

    proto.setEnabled(false);
    return proto;
  }

  function configureVisualClone(
    root: BABYLON.TransformNode,
    tuneMesh: (mesh: BABYLON.AbstractMesh) => void = tuneCharacterMaterial,
  ) {
    root.setEnabled(true);
    root.getDescendants(false).forEach((node) => {
      if (!isBakedShadowNode(node)) node.setEnabled(true);
    });
    root.getChildMeshes(false).forEach((mesh) => {
      mesh.isPickable = false;
      if (isBakedShadowNode(mesh)) {
        mesh.setEnabled(false);
        return;
      }
      tuneMesh(mesh);
      mesh.receiveShadows = true;
      shadowGenerator.addShadowCaster(mesh);
    });
  }

  async function loadBoardAssetOnce() {
    if (boardAssetStatus !== "pending") return;

    try {
      const result = await B.SceneLoader.ImportMeshAsync(
        "",
        "",
        BOARD_GLB_PATH,
        scene,
      );
      if (disposed) {
        result.meshes.forEach((mesh) => mesh.dispose(false, true));
        result.transformNodes.forEach((node) => node.dispose(false, true));
        return;
      }

      const root = new B.TransformNode("route-board-glb-root", scene);
      root.position = new B.Vector3(
        BOARD_MODEL_OFFSET.x,
        BOARD_MODEL_OFFSET.y,
        BOARD_MODEL_OFFSET.z,
      );
      root.scaling.setAll(BOARD_SCALE);
      root.rotation.y = BOARD_MODEL_ROTATION_Y;

      const importedNodes = [
        ...result.meshes,
        ...result.transformNodes,
      ] as BABYLON.Node[];
      const importedNodeSet = new Set<BABYLON.Node>(importedNodes);

      importedNodes.forEach((node) => {
        if (!node.parent || !importedNodeSet.has(node.parent)) {
          node.parent = root;
        }
      });

      result.meshes.forEach((mesh) => {
        mesh.isPickable = false;
        tuneBoardGameMaterial(mesh);
        mesh.receiveShadows = true;
        shadowGenerator.addShadowCaster(mesh);
      });

      boardAssetRoot = root;
      boardAssetStatus = "loaded";
      renderBoard();
    } catch (error) {
      boardAssetStatus = "failed";
      if (!boardAssetWarningLogged) {
        boardAssetWarningLogged = true;
        console.warn(
          "[MindFlow] Failed to load route board GLB; using procedural fallback.",
          error,
        );
      }
    }
  }

  // Load wall.glb once into a disabled, never-rendered prototype. renderWalls()
  // then clones that prototype onto every wall cell. If the import fails we keep
  // the procedural wall blocks (renderWalls falls back automatically).
  async function loadWallAssetOnce() {
    if (wallAssetStatus !== "pending") return;

    try {
      const result = await B.SceneLoader.ImportMeshAsync(
        "",
        "",
        WALL_GLB_PATH,
        scene,
      );
      if (disposed) {
        result.meshes.forEach((mesh) => mesh.dispose(false, true));
        result.transformNodes.forEach((node) => node.dispose(false, true));
        return;
      }

      const proto = new B.TransformNode("route-wall-glb-proto", scene);
      const importedNodes = [
        ...result.meshes,
        ...result.transformNodes,
      ] as BABYLON.Node[];
      const importedNodeSet = new Set<BABYLON.Node>(importedNodes);

      // Re-root only the top-level imported nodes so the glTF __root__
      // (handedness conversion) stays intact above the wall meshes — the same
      // approach board.glb uses, which keeps the grid alignment correct.
      importedNodes.forEach((node) => {
        if (!node.parent || !importedNodeSet.has(node.parent)) {
          node.parent = proto;
        }
      });

      // The prototype is never drawn; only its per-cell clones are.
      result.meshes.forEach((mesh) => {
        mesh.isPickable = false;
        tuneBoardGameMaterial(mesh);
        mesh.receiveShadows = true;
        shadowGenerator.addShadowCaster(mesh);
      });
      proto.setEnabled(false);
      wallAssetProto = proto;
      wallAssetStatus = "loaded";
      renderBoard();
    } catch (error) {
      wallAssetStatus = "failed";
      if (!wallAssetWarningLogged) {
        wallAssetWarningLogged = true;
        console.warn(
          "[MindFlow] Failed to load route wall GLB; using procedural fallback.",
          error,
        );
      }
    }
  }

  async function loadPlayerAssetOnce() {
    if (playerAssetStatus !== "pending") return;

    try {
      const proto = await importPrototypeAsset(
        PLAYER_GLB_PATH,
        "route-player-glb-proto",
      );
      if (!proto) return;
      playerAssetProto = proto;
      playerAssetStatus = "loaded";
      renderBoard();
    } catch (error) {
      playerAssetStatus = "failed";
      if (!playerAssetWarningLogged) {
        playerAssetWarningLogged = true;
        console.warn(
          "[MindFlow] Failed to load route player GLB; using procedural fallback.",
          error,
        );
      }
    }
  }

  async function loadGuardianAssetOnce() {
    if (guardianAssetStatus !== "pending") return;

    try {
      const proto = await importPrototypeAsset(
        GUARDIAN_GLB_PATH,
        "route-guardian-glb-proto",
      );
      if (!proto) return;
      guardianAssetProto = proto;
      guardianAssetStatus = "loaded";
      renderBoard();
    } catch (error) {
      guardianAssetStatus = "failed";
      if (!guardianAssetWarningLogged) {
        guardianAssetWarningLogged = true;
        console.warn(
          "[MindFlow] Failed to load route guardian GLB; using procedural fallback.",
          error,
        );
      }
    }
  }

  async function loadPropAssetOnce(kind: RoutePropAssetKey) {
    const asset = propAssets[kind];
    if (asset.status !== "pending") return;

    try {
      const proto = await importPrototypeAsset(
        ROUTE_PROP_ASSET_PATHS[kind],
        `route-${kind}-glb-proto`,
        tunePropMaterial,
      );
      if (!proto) return;
      asset.proto = proto;
      asset.status = "loaded";
      renderBoard();
    } catch (error) {
      asset.status = "failed";
      if (!asset.warningLogged) {
        asset.warningLogged = true;
        console.warn(
          `[MindFlow] Failed to load route ${kind} GLB; using procedural fallback.`,
          error,
        );
      }
    }
  }

  function clonePropAsset(
    kind: RoutePropAssetKey,
    name: string,
    parent: BABYLON.TransformNode,
    position: BABYLON.Vector3,
    scale: number,
  ) {
    const asset = propAssets[kind];
    if (asset.status !== "loaded" || !asset.proto) return null;

    const clone = asset.proto.clone(name, parent, false);
    if (!clone) return null;
    clone.position.copyFrom(position);
    clone.scaling.setAll(scale);
    configureVisualClone(clone, tunePropMaterial);
    return clone;
  }

  function renderBase(parent: BABYLON.TransformNode) {
    // Emergency board, drawn only if board.glb fails to load. It uses the same
    // body margin as the real asset so the camera framing — which is derived
    // from that margin — holds in both paths.
    const boardWidth = state.cols * CELL + BOARD_BODY_MARGIN;
    const boardDepth = state.rows * CELL + BOARD_BODY_MARGIN;
    box(
      "route-board-core",
      boardWidth,
      0.52,
      boardDepth,
      new B.Vector3(0, -0.34, 0),
      materials.wood,
      parent,
    );
    box(
      "route-board-plate",
      boardWidth - 0.32,
      0.11,
      boardDepth - 0.32,
      new B.Vector3(0, -0.02, 0),
      materials.brass,
      parent,
      false,
    );

    const edgeY = 0.2;
    const edgeZ = boardDepth / 2 - 0.18;
    const edgeX = boardWidth / 2 - 0.18;
    box("route-frame-front", boardWidth, 0.34, 0.24, new B.Vector3(0, edgeY, edgeZ), materials.brass, parent);
    box("route-frame-back", boardWidth, 0.34, 0.24, new B.Vector3(0, edgeY, -edgeZ), materials.brass, parent);
    box("route-frame-left", 0.24, 0.34, boardDepth, new B.Vector3(-edgeX, edgeY, 0), materials.brass, parent);
    box("route-frame-right", 0.24, 0.34, boardDepth, new B.Vector3(edgeX, edgeY, 0), materials.brass, parent);

    for (const x of [-edgeX, edgeX]) {
      for (const z of [-edgeZ, edgeZ]) {
        box(
          "route-corner-brace",
          0.46,
          0.43,
          0.46,
          new B.Vector3(x, edgeY + 0.04, z),
          materials.brass,
          parent,
        );
        sphere(
          "route-rivet",
          0.12,
          new B.Vector3(x, edgeY + 0.3, z),
          materials.light,
          parent,
          false,
        );
      }
    }

    for (let i = 0; i < state.cols; i += 1) {
      const x = (i - (state.cols - 1) / 2) * CELL;
      sphere("route-front-rivet", 0.07, new B.Vector3(x, 0.38, edgeZ), materials.brass, parent, false);
      sphere("route-back-rivet", 0.07, new B.Vector3(x, 0.38, -edgeZ), materials.brass, parent, false);
    }
  }

  function renderStaticTiles(parent: BABYLON.TransformNode) {
    const useInvisibleHitTiles = boardAssetStatus === "loaded";

    for (let row = 0; row < state.rows; row += 1) {
      for (let col = 0; col < state.cols; col += 1) {
        const key = `${row},${col}`;
        const pos = cellToPosition(row, col);
        const tile = box(
          "route-tile",
          0.86,
          useInvisibleHitTiles ? 0.08 : TILE_HEIGHT,
          0.86,
          new B.Vector3(pos.x, useInvisibleHitTiles ? 0.26 : 0.08, pos.z),
          useInvisibleHitTiles
            ? materials.hit
            : (row + col) % 2 === 0
              ? materials.stone
              : materials.stoneAlt,
          parent,
          false,
        );
        tile.metadata = { routeTile: true, row, col, key };
        tile.isPickable = true;
      }
    }
  }

  function renderTileOverlays(parent: BABYLON.TransformNode) {
    const wallKeys = new Set(state.walls);
    const moveKeys = new Set(state.moveTargets);
    const dangerKeys = new Set(state.dangerTiles);
    const useInvisibleHitTiles = boardAssetStatus === "loaded";

    for (let row = 0; row < state.rows; row += 1) {
      for (let col = 0; col < state.cols; col += 1) {
        const key = `${row},${col}`;
        const pos = cellToPosition(row, col);

        if (dangerKeys.has(key) && !wallKeys.has(key)) {
          torus(
            "route-danger-ring",
            0.58,
            0.026,
            new B.Vector3(
              pos.x,
              useInvisibleHitTiles ? BOARD_SURFACE_Y + 0.02 : 0.18,
              pos.z,
            ),
            materials.danger,
            parent,
          );
        }

        if (moveKeys.has(key)) {
          torus(
            "route-move-ring",
            0.48,
            0.02,
            new B.Vector3(
              pos.x,
              useInvisibleHitTiles ? BOARD_SURFACE_Y + 0.028 : 0.2,
              pos.z,
            ),
            materials.move,
            parent,
          );
        }
      }
    }
  }
  /**
   * ROTA-CHEST-REWARDS-01 §16 (revisão pós-playtest): the Pickaxe's reach.
   *
   * A bronze ring at the foot of a wall the Explorer is standing next to, drawn
   * only while the Pickaxe is in hand — and a brighter, taller one on the wall
   * the player is actually pointing at. Both are CONTROL information: "this is
   * a target you can hit". Neither says anything about whether hitting it is a
   * good idea, and neither survives the Pickaxe being spent.
   *
   * This lives on the DYNAMIC board, not the static one, because it changes with
   * every step the Explorer takes.
   */
  function renderBreakTargets(parent: BABYLON.TransformNode) {
    if (state.breakTargetKeys.length === 0) return;
    state.breakTargetKeys.forEach((key) => {
      if (!state.walls.includes(key)) return;
      const [row, col] = key.split(",").map(Number);
      const pos = cellToPosition(row, col);
      const aimed = state.aimedWallKey === key;
      torus(
        aimed ? "route-break-aim-ring" : "route-break-target-ring",
        aimed ? 0.78 : 0.7,
        aimed ? 0.034 : 0.022,
        new B.Vector3(pos.x, BOARD_SURFACE_Y + (aimed ? 0.07 : 0.03), pos.z),
        aimed ? materials.breakAim : materials.breakTarget,
        parent,
      );
      if (!aimed) return;
      // The aimed wall also gets a second ring higher up its body, so the
      // player can tell the two apart at a glance from the 3/4 camera.
      torus(
        "route-break-aim-collar",
        0.72,
        0.026,
        new B.Vector3(pos.x, BOARD_SURFACE_Y + 0.42, pos.z),
        materials.breakAim,
        parent,
      );
    });
  }

  /**
   * Small stone left where a wall stood. The opening itself is real geometry —
   * the block is simply gone — and these chips are the only thing that says it
   * was ever there. No explosion, no shake, no particle storm (§30).
   */
  function renderBrokenWallTrace(
    parent: BABYLON.TransformNode,
    pos: BABYLON.Vector3,
  ) {
    const chips: Array<[number, number, number]> = [
      [-0.26, 0.09, 0.22],
      [0.24, 0.07, -0.18],
      [0.06, 0.05, 0.3],
    ];
    chips.forEach(([dx, size, dz], index) => {
      const chip = B.MeshBuilder.CreateBox(
        "route-broken-chip",
        { width: size, height: size * 0.55, depth: size * 0.82 },
        scene,
      );
      chip.position = new B.Vector3(
        pos.x + dx,
        BOARD_SURFACE_Y + size * 0.28,
        pos.z + dz,
      );
      chip.rotation.y = 0.5 + index * 0.9;
      chip.material = materials.rubble;
      chip.parent = parent;
      chip.isPickable = false;
      chip.receiveShadows = true;
    });
    // Settled dust, flat on the tile — the mark of the block's own footprint.
    torus(
      "route-broken-dust",
      0.6,
      0.014,
      new B.Vector3(pos.x, BOARD_SURFACE_Y + 0.008, pos.z),
      materials.rubble,
      parent,
    );
  }

  /**
   * Every wall is drawn the same way, because every wall is the same thing.
   *
   * ROTA-CHEST-REWARDS-01 (revisão pós-playtest): this function used to give a
   * certified subset older stone and visible fissures. It no longer does — a
   * permanent mark would have been the game answering the question the Pickaxe
   * is supposed to ask (§14).
   */
  function renderWalls(parent: BABYLON.TransformNode) {
    const useWallAsset = wallAssetStatus === "loaded" && wallAssetProto !== null;

    if (state.brokenWallKey) {
      const [row, col] = state.brokenWallKey.split(",").map(Number);
      renderBrokenWallTrace(parent, cellToPosition(row, col));
    }

    state.walls.forEach((key) => {
      const [row, col] = key.split(",").map(Number);
      const pos = cellToPosition(row, col);

      if (useWallAsset && wallAssetProto) {
        // Clone the loaded prototype onto this cell. Clones share the GLB's
        // geometry and materials, so one clone per wall stays cheap.
        const clone = wallAssetProto.clone(
          `route-wall-glb-${key}`,
          parent,
          false,
        );
        if (clone) {
          // Centered on the tile, base resting on the stone surface. The block
          // is 4-fold symmetric, so the fixed board orientation needs no extra
          // rotation here.
          clone.position.set(pos.x, BOARD_SURFACE_Y, pos.z);
          clone.scaling.setAll(WALL_SCALE);
          clone.rotation.y = 0;
          clone.setEnabled(true);
          // The prototype was disabled, so re-enable the whole clone subtree and
          // make sure none of its meshes intercept tile taps or skip shadows.
          clone.getDescendants(false).forEach((node) => node.setEnabled(true));
          clone.getChildMeshes(false).forEach((mesh) => {
            mesh.isPickable = false;
            tuneBoardGameMaterial(mesh);
            mesh.receiveShadows = true;
            shadowGenerator.addShadowCaster(mesh);
          });
          return;
        }
      }

      // Procedural fallback block — used until the GLB finishes loading and
      // whenever the GLB fails to load.
      box(
        "route-wall-base",
        0.72,
        0.52,
        0.72,
        new B.Vector3(pos.x, BOARD_SURFACE_Y + 0.26, pos.z),
        materials.wall,
        parent,
      );
      box(
        "route-wall-cap",
        0.62,
        0.14,
        0.62,
        new B.Vector3(pos.x, BOARD_SURFACE_Y + 0.59, pos.z),
        materials.brass,
        parent,
      );
    });
  }

  function renderPlayer(parent: BABYLON.TransformNode) {
    const pos = cellToPosition(state.player.row, state.player.col);

    if (playerAssetStatus === "loaded" && playerAssetProto) {
      const clone = playerAssetProto.clone("route-player-glb", parent, false);
      if (clone) {
        clone.position.set(
          pos.x,
          BOARD_SURFACE_Y + PLAYER_Y_OFFSET,
          pos.z,
        );
        clone.scaling.setAll(PLAYER_SCALE);
        clone.rotation.y = 0;
        configureVisualClone(clone);
        return;
      }
    }

    cylinder("route-player-base", 0.48, 0.12, new B.Vector3(pos.x, 0.28, pos.z), materials.player, parent);
    sphere("route-player-body", 0.46, new B.Vector3(pos.x, 0.58, pos.z), materials.player, parent);
    sphere("route-player-head", 0.34, new B.Vector3(pos.x, 0.93, pos.z), materials.player, parent);
    torus(
      "route-player-glow",
      0.72,
      0.026,
      new B.Vector3(pos.x, 0.22, pos.z),
      materials.playerGlow,
      parent,
    );
  }

  function renderGuardian(parent: BABYLON.TransformNode) {
    const pos = cellToPosition(state.guardian.row, state.guardian.col);

    if (guardianAssetStatus === "loaded" && guardianAssetProto) {
      const clone = guardianAssetProto.clone(
        "route-guardian-glb",
        parent,
        false,
      );
      if (clone) {
        clone.position.set(
          pos.x,
          BOARD_SURFACE_Y + GUARDIAN_Y_OFFSET,
          pos.z,
        );
        clone.scaling.setAll(GUARDIAN_SCALE);
        clone.rotation.y = GUARDIAN_ROTATION_Y;
        configureVisualClone(clone);
        torus(
          "route-guardian-alert-ring",
          0.8,
          0.035,
          new B.Vector3(pos.x, BOARD_SURFACE_Y + 0.03, pos.z),
          materials.guardianGlow,
          parent,
        );
        return;
      }
    }

    cylinder("route-guardian-base", 0.56, 0.13, new B.Vector3(pos.x, 0.29, pos.z), materials.guardianGlow, parent);
    cylinder("route-guardian-body", 0.44, 0.66, new B.Vector3(pos.x, 0.61, pos.z), materials.guardian, parent, 18);
    const hood = B.MeshBuilder.CreateCylinder(
      "route-guardian-hood",
      { diameterTop: 0.08, diameterBottom: 0.56, height: 0.52, tessellation: 22 },
      scene,
    );
    hood.position = new B.Vector3(pos.x, 1.12, pos.z);
    hood.material = materials.guardian;
    hood.parent = parent;
    shadowGenerator.addShadowCaster(hood);
    sphere("route-guardian-eye-left", 0.07, new B.Vector3(pos.x - 0.09, 1.05, pos.z + 0.21), materials.guardianGlow, parent, false);
    sphere("route-guardian-eye-right", 0.07, new B.Vector3(pos.x + 0.09, 1.05, pos.z + 0.21), materials.guardianGlow, parent, false);
  }

  /**
   * The Sentinel: the Hunter's silhouette, planted and cold.
   *
   * The first version was a faceted column, and it read as furniture — the
   * player saw scenery, not a defender. It wears the guardian model now,
   * scaled a little wider and a little shorter so it looks rooted rather than
   * mobile, with a discreet teal ring marking the ground it answers for.
   *
   * No new asset, and no Babylon light: the glow is emissive picked up by the
   * existing GlowLayer, so the scene still runs on three lights.
   */
  function renderSentinel(parent: BABYLON.TransformNode) {
    if (!state.sentinel) return;
    const pos = cellToPosition(state.sentinel.row, state.sentinel.col);
    const crown = state.sentinelCommitted
      ? materials.sentinelGlowCommitted
      : materials.sentinelGlow;

    // Territory first, and secondary to the figure: a thin ring, not a halo.
    torus(
      "route-sentinel-territory-ring",
      0.78,
      0.028,
      new B.Vector3(pos.x, BOARD_SURFACE_Y + 0.03, pos.z),
      crown,
      parent,
    );

    if (guardianAssetStatus === "loaded" && guardianAssetProto) {
      const clone = guardianAssetProto.clone("route-sentinel-glb", parent, false);
      if (clone) {
        clone.position.set(pos.x, BOARD_SURFACE_Y + GUARDIAN_Y_OFFSET, pos.z);
        // Wider and shorter than the Hunter: same species, heavier stance.
        clone.scaling.set(
          GUARDIAN_SCALE * 1.08,
          GUARDIAN_SCALE * 0.92,
          GUARDIAN_SCALE * 1.08,
        );
        clone.rotation.y = GUARDIAN_ROTATION_Y;
        configureVisualClone(clone, tuneSentinelMaterial);
        return;
      }
    }

    // Same fallback anatomy as the Hunter — base, body, hood, eyes — so the two
    // still belong together when the model is unavailable.
    cylinder("route-sentinel-base", 0.62, 0.14, new B.Vector3(pos.x, 0.29, pos.z), materials.sentinelGlow, parent);
    cylinder("route-sentinel-body", 0.48, 0.6, new B.Vector3(pos.x, 0.58, pos.z), materials.sentinel, parent, 18);
    const hood = B.MeshBuilder.CreateCylinder(
      "route-sentinel-hood",
      { diameterTop: 0.1, diameterBottom: 0.6, height: 0.48, tessellation: 22 },
      scene,
    );
    hood.position = new B.Vector3(pos.x, 1.05, pos.z);
    hood.material = materials.sentinel;
    hood.parent = parent;
    shadowGenerator.addShadowCaster(hood);
    sphere("route-sentinel-eye-left", 0.07, new B.Vector3(pos.x - 0.09, 0.99, pos.z + 0.22), crown, parent, false);
    sphere("route-sentinel-eye-right", 0.07, new B.Vector3(pos.x + 0.09, 0.99, pos.z + 0.22), crown, parent, false);
  }

  function renderPortal(parent: BABYLON.TransformNode) {
    const pos = cellToPosition(state.exitPosition.row, state.exitPosition.col);
    const collectedKeys = new Set(state.collectedKeys);
    const portalActive =
      state.lights.length === 0 ||
      state.lights.every((lightCell) => collectedKeys.has(keyOf(lightCell)));
    const clone = clonePropAsset(
      "portal",
      "route-portal-glb",
      parent,
      new B.Vector3(pos.x, BOARD_SURFACE_Y, pos.z),
      PORTAL_SCALE,
    );
    if (clone) {
      clone.rotation.y = PORTAL_ROTATION_Y;
      applyPortalActivationVisual(clone, portalActive);
      return;
    }

    const portalMaterial = portalActive ? materials.portal : materials.portalLocked;
    const portalGlowMaterial = portalActive
      ? materials.portalGlow
      : materials.portalGlowLocked;
    box("route-portal-step", 0.78, 0.12, 0.68, new B.Vector3(pos.x, 0.26, pos.z), portalMaterial, parent);
    cylinder("route-portal-left", 0.16, 0.72, new B.Vector3(pos.x - 0.3, 0.68, pos.z), portalMaterial, parent, 16);
    cylinder("route-portal-right", 0.16, 0.72, new B.Vector3(pos.x + 0.3, 0.68, pos.z), portalMaterial, parent, 16);
    const gate = torus(
      "route-portal-ring",
      0.72,
      0.065,
      new B.Vector3(pos.x, 0.86, pos.z),
      portalGlowMaterial,
      parent,
    );
    gate.rotation.x = 0;
    box("route-portal-glow-plane", 0.42, 0.54, 0.025, new B.Vector3(pos.x, 0.8, pos.z + 0.01), portalGlowMaterial, parent, false);
  }

  function renderPickups(parent: BABYLON.TransformNode) {
    const collectedKeys = new Set(state.collectedKeys);
    const triggeredTrapKeys = new Set(state.triggeredTrapKeys);

    state.lights.forEach((lightCell) => {
      if (
        collectedKeys.has(keyOf(lightCell)) ||
        isSameCell(lightCell, state.player) ||
        isSameCell(lightCell, state.guardian)
      ) {
        return;
      }
      const pos = cellToPosition(lightCell.row, lightCell.col);
      const clone = clonePropAsset(
        "light",
        `route-light-glb-${keyOf(lightCell)}`,
        parent,
        new B.Vector3(pos.x, BOARD_SURFACE_Y, pos.z),
        LIGHT_SCALE,
      );
      if (clone) return;

      sphere("route-light-orb", 0.3, new B.Vector3(pos.x, 0.48, pos.z), materials.light, parent, false);
    });

    state.traps.forEach((trap) => {
      const pos = cellToPosition(trap.row, trap.col);
      const armed = triggeredTrapKeys.has(keyOf(trap));
      // A rune cut into the floor, not an object standing on it. Dormant it is
      // oxide and almost flat; armed, the same shape lights up. The player
      // should read "something is set into this tile", never "this is attacking".
      const face = armed ? materials.trapArmed : materials.trapDormant;
      const core = armed ? materials.trapArmedCore : materials.trapDormant;

      // No filled plate: a disc sitting on the tile is exactly what read as a
      // badge. Only the engraving remains — an outer groove ring, three radial
      // cuts and an inner ring, all within 0.03 of the floor.
      torus(
        "route-trap-rune-ring",
        0.5,
        0.018,
        new B.Vector3(pos.x, BOARD_SURFACE_Y + 0.014, pos.z),
        face,
        parent,
      );

      for (let spoke = 0; spoke < 3; spoke += 1) {
        const angle = (spoke * 2 * Math.PI) / 3 + Math.PI / 6;
        const groove = B.MeshBuilder.CreateBox(
          "route-trap-rune-groove",
          { width: 0.24, height: 0.014, depth: 0.042 },
          scene,
        );
        groove.position = new B.Vector3(
          pos.x + Math.cos(angle) * 0.18,
          BOARD_SURFACE_Y + 0.012,
          pos.z + Math.sin(angle) * 0.18,
        );
        groove.rotation.y = -angle;
        groove.material = core;
        groove.parent = parent;
      }

      torus(
        "route-trap-rune-core",
        0.2,
        0.016,
        new B.Vector3(pos.x, BOARD_SURFACE_Y + 0.016, pos.z),
        core,
        parent,
      );
    });

    if (state.chest) renderChest(parent);
  }

  /**
   * The reward chest: a small stone relic banded in bronze, with one teal ember
   * in its lock.
   *
   * ROTA-CHEST-REWARDS-01 §25/§26. Closed it is shut and lit; once opened the
   * lid stands back, the ember goes out and the whole piece drops to a spent
   * grey — it stays on the board, visibly used, because a chest that vanished
   * would leave the player wondering whether it was ever there.
   */
  function renderChest(parent: BABYLON.TransformNode) {
    if (!state.chest) return;
    const pos = cellToPosition(state.chest.row, state.chest.col);
    const opened = state.chestOpened;
    const body = opened ? materials.chestSpent : materials.chestStone;
    const band = opened ? materials.chestSpent : materials.chestBronze;

    const root = new B.TransformNode("route-chest-root", scene);
    root.parent = parent;
    root.position.set(pos.x, BOARD_SURFACE_Y, pos.z);
    root.rotation.y = CHEST_ROTATION_Y;

    // Plinth: the relic sits ON the stone, it is not part of it.
    box("route-chest-plinth", 0.5, 0.04, 0.4, new B.Vector3(0, 0.02, 0), band, root);
    // Body.
    box("route-chest-body", 0.42, 0.2, 0.32, new B.Vector3(0, 0.14, 0), body, root);
    // Two bronze bands around the body.
    [-0.13, 0.13].forEach((offset, index) => {
      box(
        `route-chest-band-${index}`,
        0.04,
        0.21,
        0.335,
        new B.Vector3(offset, 0.14, 0),
        band,
        root,
      );
    });
    // Lid: shut and level when closed, tipped back and open once used.
    const lid = B.MeshBuilder.CreateBox(
      "route-chest-lid",
      { width: 0.44, height: 0.1, depth: 0.34 },
      scene,
    );
    lid.material = body;
    lid.parent = root;
    lid.receiveShadows = true;
    shadowGenerator.addShadowCaster(lid);
    if (opened) {
      lid.position.set(0, 0.28, -0.15);
      lid.rotation.x = -1.15;
    } else {
      lid.position.set(0, 0.28, 0);
    }

    // The lock. Closed: one restrained teal ember, the world's own colour, well
    // below the portal's brightness. Opened: dark bronze, plainly spent.
    const lock = B.MeshBuilder.CreateBox(
      "route-chest-lock",
      { width: 0.09, height: 0.11, depth: 0.05 },
      scene,
    );
    lock.position.set(0, 0.2, 0.17);
    lock.material = opened ? materials.chestSpent : materials.chestGlow;
    lock.parent = root;
    if (!opened) {
      torus(
        "route-chest-ember",
        0.2,
        0.016,
        new B.Vector3(0, 0.345, 0),
        materials.chestGlow,
        root,
      );
    }
  }

  function getStaticBoardSignature() {
    return [
      state.rows,
      state.cols,
      boardAssetStatus,
      wallAssetStatus,
      state.walls.slice().sort().join("|"),
      // The rubble lives on the static board, so opening a wall rebuilds it.
      // The break-target rings do NOT: they move with the Explorer every turn,
      // so they belong to the dynamic board and must not force a static rebuild.
      state.brokenWallKey ?? "",
    ].join(";");
  }

  function renderStaticBoard() {
    const nextRoot = new B.TransformNode("route-static-board-root", scene);

    if (boardAssetStatus !== "loaded") {
      renderBase(nextRoot);
    }
    renderStaticTiles(nextRoot);
    renderWalls(nextRoot);

    const previousRoot = staticBoardRoot;
    staticBoardRoot = nextRoot;
    staticBoardSignature = getStaticBoardSignature();
    previousRoot?.dispose(false, false);
  }

  function renderDynamicBoard() {
    const nextRoot = new B.TransformNode("route-dynamic-board-root", scene);

    renderTileOverlays(nextRoot);
    renderBreakTargets(nextRoot);
    renderPickups(nextRoot);
    renderPortal(nextRoot);
    renderPlayer(nextRoot);
    renderGuardian(nextRoot);
    renderSentinel(nextRoot);

    const previousRoot = dynamicBoardRoot;
    dynamicBoardRoot = nextRoot;
    previousRoot?.dispose(false, false);
  }

  function renderBoard() {
    const nextStaticSignature = getStaticBoardSignature();

    if (!staticBoardRoot || staticBoardSignature !== nextStaticSignature) {
      renderStaticBoard();
    }
    renderDynamicBoard();
    writeProjectedCellCenters();
  }

  // Default safe framing — also used by resetView(). Snaps alpha/beta/radius/
  // target back inside the clamps for the current canvas width.
  /**
   * ROTA-VISUAL-01 pass 2: the board used to be cut off at the bottom because
   * the radius was a constant and only checked width < 520. A short canvas
   * (the HUD eats vertical space) simply could not fit the board.
   *
   * The distance is now derived from the canvas aspect ratio: how far the
   * camera must stand for the territory's half-extent to fit BOTH axes of the
   * perspective frustum. Wide-and-short viewports pull back automatically;
   * tall phone viewports do not zoom out more than they need to. The board
   * keeps its size on screen and nothing is cropped.
   */
  function fitCamera() {
    const width = canvas.clientWidth || engine.getRenderWidth();
    const height = canvas.clientHeight || engine.getRenderHeight();
    const isNarrow = width < 520;
    const aspect = width > 0 && height > 0 ? width / height : 16 / 9;

    camera.alpha = DEFAULT_CAMERA_ALPHA;
    camera.beta = isNarrow ? DEFAULT_CAMERA_BETA - 0.06 : DEFAULT_CAMERA_BETA;

    // ROTA-BOARD-9X9-SYNC-01: the framing now contains the PHYSICAL board, not
    // the playable field.
    //
    // It used to be `max(rows, cols) / 2 + margin` — the grid plus padding. That
    // held while the body was wider than the grid it carried. With a real 9x9
    // body (field 9.00, wood 10.65, footprint 11.12) the grid is no longer the
    // outer edge of anything, so the frame, corner caps and base are what have
    // to fit.
    //
    // The second half of the fix is the vertical axis. Reserving the full
    // half-extent on both axes ignored that the 3/4 camera flattens a tabletop:
    // the board covered 92% of the canvas width but only 65% of its height. With
    // the larger body that over-reservation pushed `needed` past
    // MAX_CAMERA_RADIUS, so the clamp — not the fit — would have decided the
    // framing, and the board would have been cut. Applying the measured
    // flattening makes the horizontal axis bind, which is what actually
    // constrains this composition.
    const bodyHalf = (Math.max(state.rows, state.cols) * CELL + BOARD_BODY_MARGIN) / 2;
    const half = bodyHalf + BOARD_FIT_MARGIN;
    const halfFov = camera.fov / 2;
    const tanHalfFov = Math.tan(halfFov);
    const sinBeta = Math.sin(camera.beta);
    const cosBeta = Math.cos(camera.beta);

    // Distance the camera needs so a half-extent of `half` covers at most
    // `BOARD_CANVAS_FILL` of the axis:
    //
    //   the near edge sits at  d = hypot(R*sinB - half, R*cosB)  from the eye,
    //   and a length L there covers  L / (2*d*tan(fov/2)*aspect)  of the canvas.
    //
    // Setting that equal to the fill and solving the quadratic for R gives the
    // closed form below. Reproduces the previous camera to within 0.03 units on
    // the old 8.65 body, and the measured 84.8px cell pitch exactly, so this is
    // the same composition solved properly rather than a new one.
    const distanceFor = (target: number) => {
      const inner = target * target - (half * cosBeta) ** 2;
      return half * sinBeta + Math.sqrt(Math.max(0, inner));
    };
    const horizontalFit = distanceFor(
      half / (BOARD_CANVAS_FILL * tanHalfFov * aspect),
    );
    const verticalFit = distanceFor(
      (half * BOARD_VERTICAL_FLATTEN) / (BOARD_CANVAS_FILL * tanHalfFov),
    );
    const needed = Math.max(verticalFit, horizontalFit);

    camera.radius = Math.min(
      MAX_CAMERA_RADIUS,
      Math.max(MIN_CAMERA_RADIUS, needed),
    );

    camera.target.set(
      DEFAULT_CAMERA_TARGET.x,
      DEFAULT_CAMERA_TARGET.y,
      DEFAULT_CAMERA_TARGET.z,
    );
  }

  function writeProjectedCellCenters() {
    const viewport = camera.viewport.toGlobal(
      engine.getRenderWidth(),
      engine.getRenderHeight(),
    );
    const transform = scene.getTransformMatrix();
    const widthScale = canvas.clientWidth / engine.getRenderWidth();
    const heightScale = canvas.clientHeight / engine.getRenderHeight();
    const centers: Record<string, { x: number; y: number }> = {};

    for (let row = 0; row < state.rows; row += 1) {
      for (let col = 0; col < state.cols; col += 1) {
        const position = cellToPosition(row, col);
        const projected = B.Vector3.Project(
          new B.Vector3(position.x, 0.22, position.z),
          B.Matrix.Identity(),
          transform,
          viewport,
        );
        centers[`${row},${col}`] = {
          x: projected.x * widthScale,
          y: projected.y * heightScale,
        };
      }
    }

    canvas.dataset.cellCenters = JSON.stringify(centers);
  }

  // --- Custom tablet gesture layer ---------------------------------------
  // Policy (raw pointer events so a single pointer can never reach the camera):
  //   - one short single-finger tap on a move tile  -> move the piece
  //   - a single-finger drag                         -> nothing (no orbit/move)
  //   - two fingers                                  -> orbit + pinch-zoom
  //   - mouse wheel (desktop)                        -> zoom
  // All within the tight clamps; the default view stays the main play view.
  const TAP_MOVE_THRESHOLD_PX = 14;
  const TAP_MAX_DURATION_MS = 650;
  const clampValue = (value: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, value));

  const gesturePointers = new Map<number, { x: number; y: number }>();
  let gestureMultiTouch = false;
  let tapPointerId = -1;
  let tapStartX = 0;
  let tapStartY = 0;
  let tapStartTime = 0;
  let twoFingerCentroidX = 0;
  let twoFingerCentroidY = 0;
  let twoFingerDistance = 0;

  function readTwoFingers() {
    const points = Array.from(gesturePointers.values());
    return {
      cx: (points[0].x + points[1].x) / 2,
      cy: (points[0].y + points[1].y) / 2,
      dist: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y),
    };
  }

  function handlePointerDown(event: PointerEvent) {
    gesturePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      /* pointer capture is best-effort */
    }
    if (gesturePointers.size >= 2) {
      gestureMultiTouch = true;
      const two = readTwoFingers();
      twoFingerCentroidX = two.cx;
      twoFingerCentroidY = two.cy;
      twoFingerDistance = two.dist;
    } else {
      gestureMultiTouch = false;
      tapPointerId = event.pointerId;
      tapStartX = event.clientX;
      tapStartY = event.clientY;
      tapStartTime = performance.now();
    }
  }

  function handlePointerMove(event: PointerEvent) {
    if (!gesturePointers.has(event.pointerId)) return;
    gesturePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    // Orbit + zoom happen only with exactly two active fingers.
    if (gesturePointers.size !== 2) return;
    const two = readTwoFingers();
    camera.alpha = clampValue(
      camera.alpha - (two.cx - twoFingerCentroidX) * ORBIT_ALPHA_SENSITIVITY,
      MIN_CAMERA_ALPHA,
      MAX_CAMERA_ALPHA,
    );
    camera.beta = clampValue(
      camera.beta - (two.cy - twoFingerCentroidY) * ORBIT_BETA_SENSITIVITY,
      MIN_CAMERA_BETA,
      MAX_CAMERA_BETA,
    );
    if (twoFingerDistance > 0 && two.dist > 0) {
      camera.radius = clampValue(
        camera.radius * (twoFingerDistance / two.dist),
        MIN_CAMERA_RADIUS,
        MAX_CAMERA_RADIUS,
      );
    }
    twoFingerCentroidX = two.cx;
    twoFingerCentroidY = two.cy;
    twoFingerDistance = two.dist;
  }

  function handlePointerUp(event: PointerEvent) {
    const wasTapCandidate =
      gesturePointers.size === 1 &&
      !gestureMultiTouch &&
      event.pointerId === tapPointerId;
    gesturePointers.delete(event.pointerId);
    if (gesturePointers.size < 2) twoFingerDistance = 0;
    if (gesturePointers.size > 0) return; // wait for the last finger to lift

    const wasMultiTouch = gestureMultiTouch;
    gestureMultiTouch = false;
    if (wasMultiTouch || !wasTapCandidate) return;

    const moved = Math.hypot(
      event.clientX - tapStartX,
      event.clientY - tapStartY,
    );
    const duration = performance.now() - tapStartTime;
    if (moved > TAP_MOVE_THRESHOLD_PX || duration > TAP_MAX_DURATION_MS) return;

    const rect = canvas.getBoundingClientRect();
    const pick = scene.pick(
      event.clientX - rect.left,
      event.clientY - rect.top,
      (mesh) => Boolean(mesh.metadata?.routeTile),
    );
    const metadata = pick?.pickedMesh?.metadata as
      | { row: number; col: number; key: string }
      | undefined;
    if (!metadata || !state.moveTargets.includes(metadata.key)) return;

    bridge.onMove({
      row: metadata.row - state.player.row,
      col: metadata.col - state.player.col,
    });
  }

  function handleWheel(event: WheelEvent) {
    event.preventDefault();
    camera.radius = clampValue(
      camera.radius + Math.sign(event.deltaY) * WHEEL_ZOOM_STEP,
      MIN_CAMERA_RADIUS,
      MAX_CAMERA_RADIUS,
    );
  }

  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerup", handlePointerUp);
  canvas.addEventListener("pointercancel", handlePointerUp);
  canvas.addEventListener("wheel", handleWheel, { passive: false });

  fitCamera();
  renderBoard();
  const essentialAssetLoads = Promise.all([
    loadBoardAssetOnce(),
    loadWallAssetOnce(),
    loadPlayerAssetOnce(),
    loadGuardianAssetOnce(),
    loadPropAssetOnce("portal"),
    loadPropAssetOnce("light"),
    loadPropAssetOnce("trap"),
  ]);
  engine.runRenderLoop(() => {
    scene.render();
  });

  const ready = essentialAssetLoads.then(() => {
    if (disposed) {
      throw new Error("Route scene was disposed before entry readiness.");
    }

    // Apply the final mix of loaded assets and valid procedural fallbacks,
    // then settle the real canvas size/camera before observing the first
    // complete frame that may be revealed to the Explorer.
    renderBoard();
    // The tuners skip baked-shadow materials, and the ground is built by hand,
    // so neither goes through them. Normalise the whole scene once so no
    // material is left compiling for more lights than the scene has.
    capSceneMaterialLights();
    engine.resize();
    fitCamera();
    writeProjectedCellCenters();

    return new Promise<void>((resolve, reject) => {
      scene.onAfterRenderObservable.addOnce(() => {
        if (disposed) {
          reject(new Error("Route scene was disposed before its ready frame."));
          return;
        }
        resolve();
      });
    });
  });

  return {
    ready,
    updateBoard(nextState: RouteBabylonState) {
      state = nextState;
      renderBoard();
    },
    resize() {
      engine.resize();
      fitCamera();
      writeProjectedCellCenters();
    },
    resetView() {
      fitCamera();
      writeProjectedCellCenters();
    },
    dispose() {
      disposed = true;
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerUp);
      canvas.removeEventListener("wheel", handleWheel);
      engine.stopRenderLoop();
      staticBoardRoot?.dispose(false, false);
      dynamicBoardRoot?.dispose(false, false);
      boardAssetRoot?.dispose(false, true);
      wallAssetProto?.dispose(false, true);
      playerAssetProto?.dispose(false, true);
      guardianAssetProto?.dispose(false, true);
      Object.values(propAssets).forEach((asset) => {
        asset.proto?.dispose(false, true);
      });
      portalStateMaterials.forEach((material) => material.dispose());
      portalStateMaterials.clear();
      glow.dispose();
      scene.dispose();
      engine.dispose();
    },
  };
}
