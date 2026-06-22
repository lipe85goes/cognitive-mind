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
  moveTargets: string[];
  traps: GridPosition[];
  triggeredTrapKeys: string[];
  shield: GridPosition | null;
  shieldCollected: boolean;
  dangerTiles: string[];
  reducedMotion: boolean;
  status: "setup" | "playing" | "won" | "lost";
}

export interface RouteBabylonBridge {
  onMove: (delta: GridPosition) => void;
}

export interface RouteBabylonController {
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
  | "portal"
  | "portalGlow"
  | "light"
  | "trap"
  | "trapSpent"
  | "shield"
  | "danger"
  | "move",
  BABYLON.StandardMaterial
>;

const CELL = 1;
const TILE_HEIGHT = 0.12;
const BOARD_TOP = 0;
const BOARD_GLB_PATH = "/models/route/board.glb";

// --- Board model placement -------------------------------------------------
// The GLB grid is authored at exactly the same coordinates as `cellToPosition`
// (tiles at x = col-3, z = row-3, CELL = 1), so scale 1 keeps pieces aligned.
const BOARD_SCALE = 1;
const BOARD_Y_OFFSET = 0;
const BOARD_MODEL_OFFSET = { x: 0, y: BOARD_Y_OFFSET, z: 0 };
const BOARD_MODEL_ROTATION_Y = 0;
/** Top of the GLB stone tiles — every gameplay piece rests on this surface. */
const BOARD_SURFACE_Y = 0.2;

// --- Camera composition (cinematic 3/4 premium tabletop) -------------------
const DEFAULT_CAMERA_ALPHA = -Math.PI / 2.16;
const DEFAULT_CAMERA_BETA = Math.PI / 3.1;
const DEFAULT_CAMERA_RADIUS = 11.5;
const DEFAULT_CAMERA_RADIUS_MOBILE = 12;
const DEFAULT_CAMERA_TARGET = { x: -0.24, y: 0.0, z: 0.05 };

// --- Tablet camera clamps: inspect freely, never flip / never lose the board.
const MIN_CAMERA_ALPHA = DEFAULT_CAMERA_ALPHA - 0.5; // ~28 deg of side orbit
const MAX_CAMERA_ALPHA = DEFAULT_CAMERA_ALPHA + 0.5;
const MIN_CAMERA_BETA = 0.82; // ~47 deg — not too top-down
const MAX_CAMERA_BETA = 1.35; // ~77 deg — stays above the board (never upside down)
const MIN_CAMERA_RADIUS = 9; // closest inspect distance (no extreme crop)
const MAX_CAMERA_RADIUS = 15.5; // farthest (board still clearly visible)

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
    stone: makeMaterial(B, scene, "route-stone", "#1f2425", {
      specular: "#5e5646",
    }),
    stoneAlt: makeMaterial(B, scene, "route-stone-alt", "#2a2d2b", {
      specular: "#6e6049",
    }),
    brass: makeMaterial(B, scene, "route-brass", "#b98532", {
      specular: "#ffd98b",
    }),
    wall: makeMaterial(B, scene, "route-wall", "#4d3a2a", {
      specular: "#a98249",
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
    portal: makeMaterial(B, scene, "route-portal", "#245f31", {
      specular: "#b5ffb6",
    }),
    portalGlow: makeMaterial(B, scene, "route-portal-glow", "#7cff9b", {
      emissive: "#22c55e",
      alpha: 0.72,
    }),
    light: makeMaterial(B, scene, "route-light", "#f6c447", {
      emissive: "#facc15",
      specular: "#fff4b0",
    }),
    trap: makeMaterial(B, scene, "route-trap", "#df4e5a", {
      emissive: "#7f1d1d",
      specular: "#ffd5dc",
    }),
    trapSpent: makeMaterial(B, scene, "route-trap-spent", "#59333a", {
      emissive: "#241016",
      alpha: 0.44,
    }),
    shield: makeMaterial(B, scene, "route-shield", "#3ba8ff", {
      emissive: "#1554d1",
      specular: "#cae8ff",
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
    stencil: true,
  });
  const scene = new B.Scene(engine);
  scene.clearColor = new B.Color4(0, 0, 0, 0);
  scene.ambientColor = B.Color3.FromHexString("#43301d");

  // Warm cinematic grade: tone map + lift exposure/contrast so the dark wood
  // and brass read richly without washing out.
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType =
    B.ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure = 1.25;
  scene.imageProcessingConfiguration.contrast = 1.28;
  scene.imageProcessingConfiguration.vignetteEnabled = true;
  scene.imageProcessingConfiguration.vignetteWeight = 2.4;
  scene.imageProcessingConfiguration.vignetteColor = new B.Color4(0, 0, 0, 0);

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
  // Controlled tablet inspection: pointer orbit + pinch + wheel only. The
  // keyboard input is intentionally NOT added so the arrow keys stay owned by
  // the game (useEscapeMaze) and never orbit the camera.
  camera.inputs.clear();
  camera.inputs.addPointers();
  camera.inputs.addMouseWheel();
  camera.attachControl(canvas, true);
  camera.panningSensibility = 0; // no panning — orbit + zoom only
  camera.lowerAlphaLimit = MIN_CAMERA_ALPHA;
  camera.upperAlphaLimit = MAX_CAMERA_ALPHA;
  camera.lowerBetaLimit = MIN_CAMERA_BETA;
  camera.upperBetaLimit = MAX_CAMERA_BETA;
  camera.lowerRadiusLimit = MIN_CAMERA_RADIUS;
  camera.upperRadiusLimit = MAX_CAMERA_RADIUS;
  camera.angularSensibilityX = 1500; // higher = slower, calmer orbit
  camera.angularSensibilityY = 1500;
  camera.wheelPrecision = 38;
  camera.pinchPrecision = 90;
  camera.inertia = 0.72;
  camera.minZ = 0.05;
  camera.maxZ = 60;
  camera.fov = 0.72;

  const warmKey = new B.DirectionalLight(
    "route-key-light",
    new B.Vector3(-0.45, -1, -0.35),
    scene,
  );
  warmKey.position = new B.Vector3(5, 8.5, 6);
  warmKey.intensity = 2.6;
  warmKey.diffuse = B.Color3.FromHexString("#ffe1b0");
  warmKey.specular = B.Color3.FromHexString("#fff1cf");

  const fill = new B.HemisphericLight(
    "route-fill-light",
    new B.Vector3(0, 1, 0),
    scene,
  );
  fill.intensity = 0.52;
  fill.diffuse = B.Color3.FromHexString("#fbe6c2");
  fill.groundColor = B.Color3.FromHexString("#160a05");
  fill.specular = B.Color3.FromHexString("#caa264");

  // Cool back rim separates the board silhouette from the dark background.
  const rim = new B.PointLight(
    "route-rim-light",
    new B.Vector3(-4.2, 3.0, -4.4),
    scene,
  );
  rim.intensity = 0.7;
  rim.diffuse = B.Color3.FromHexString("#86e3ff");

  // Warm front-right glint that makes the aged brass frame pop.
  const brassGlint = new B.PointLight(
    "route-brass-glint",
    new B.Vector3(4.6, 2.4, 4.2),
    scene,
  );
  brassGlint.intensity = 0.62;
  brassGlint.diffuse = B.Color3.FromHexString("#ffcf83");

  const glow = new B.GlowLayer("route-glow-layer", scene, {
    mainTextureSamples: 4,
  });
  glow.intensity = 0.55;

  const shadowGenerator = new B.ShadowGenerator(1024, warmKey);
  shadowGenerator.useBlurExponentialShadowMap = true;
  shadowGenerator.blurKernel = 24;
  shadowGenerator.bias = 0.0008;

  const materials = createMaterials(B, scene);
  materials.hit.disableDepthWrite = true;
  let state = initialState;
  let boardRoot: BABYLON.TransformNode | null = null;
  let boardAssetRoot: BABYLON.TransformNode | null = null;
  let boardAssetStatus: BoardAssetStatus = "pending";
  let boardAssetWarningLogged = false;
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

  function renderBase(parent: BABYLON.TransformNode) {
    const boardWidth = state.cols * CELL + 1.1;
    const boardDepth = state.rows * CELL + 1.1;
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

  function renderTiles(parent: BABYLON.TransformNode) {
    const wallKeys = new Set(state.walls);
    const moveKeys = new Set(state.moveTargets);
    const dangerKeys = new Set(state.dangerTiles);
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

  function renderWalls(parent: BABYLON.TransformNode) {
    state.walls.forEach((key) => {
      const [row, col] = key.split(",").map(Number);
      const pos = cellToPosition(row, col);
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
    const light = new B.PointLight("route-player-light", new B.Vector3(pos.x, 0.7, pos.z), scene);
    light.diffuse = B.Color3.FromHexString("#38e8ff");
    light.intensity = 0.45;
    light.range = 2.1;
    light.parent = parent;
  }

  function renderGuardian(parent: BABYLON.TransformNode) {
    const pos = cellToPosition(state.guardian.row, state.guardian.col);
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

  function renderPortal(parent: BABYLON.TransformNode) {
    const pos = cellToPosition(state.exitPosition.row, state.exitPosition.col);
    box("route-portal-step", 0.78, 0.12, 0.68, new B.Vector3(pos.x, 0.26, pos.z), materials.portal, parent);
    cylinder("route-portal-left", 0.16, 0.72, new B.Vector3(pos.x - 0.3, 0.68, pos.z), materials.portal, parent, 16);
    cylinder("route-portal-right", 0.16, 0.72, new B.Vector3(pos.x + 0.3, 0.68, pos.z), materials.portal, parent, 16);
    const gate = torus(
      "route-portal-ring",
      0.72,
      0.065,
      new B.Vector3(pos.x, 0.86, pos.z),
      materials.portalGlow,
      parent,
    );
    gate.rotation.x = 0;
    box("route-portal-glow-plane", 0.42, 0.54, 0.025, new B.Vector3(pos.x, 0.8, pos.z + 0.01), materials.portalGlow, parent, false);
    const light = new B.PointLight("route-portal-light", new B.Vector3(pos.x, 0.9, pos.z), scene);
    light.diffuse = B.Color3.FromHexString("#5cff87");
    light.intensity = 0.92;
    light.range = 2.4;
    light.parent = parent;
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
      sphere("route-light-orb", 0.3, new B.Vector3(pos.x, 0.48, pos.z), materials.light, parent, false);
      const light = new B.PointLight("route-light-glow", new B.Vector3(pos.x, 0.52, pos.z), scene);
      light.diffuse = B.Color3.FromHexString("#facc15");
      light.intensity = 0.36;
      light.range = 1.8;
      light.parent = parent;
    });

    state.traps.forEach((trap) => {
      const pos = cellToPosition(trap.row, trap.col);
      const spent = triggeredTrapKeys.has(keyOf(trap));
      const crystal = B.MeshBuilder.CreateCylinder(
        "route-trap-crystal",
        {
          diameterTop: 0.05,
          diameterBottom: 0.36,
          height: 0.5,
          tessellation: 5,
        },
        scene,
      );
      crystal.position = new B.Vector3(pos.x, BOARD_SURFACE_Y + 0.26, pos.z);
      crystal.rotation.y = Math.PI / 5;
      crystal.material = spent ? materials.trapSpent : materials.trap;
      crystal.parent = parent;
      shadowGenerator.addShadowCaster(crystal);
    });

    if (state.shield && !state.shieldCollected) {
      const pos = cellToPosition(state.shield.row, state.shield.col);
      cylinder(
        "route-shield-token",
        0.46,
        0.08,
        new B.Vector3(pos.x, BOARD_SURFACE_Y + 0.06, pos.z),
        materials.shield,
        parent,
        6,
      );
      box(
        "route-shield-face",
        0.25,
        0.18,
        0.06,
        new B.Vector3(pos.x, BOARD_SURFACE_Y + 0.22, pos.z),
        materials.shield,
        parent,
      );
    }
  }

  function renderBoard() {
    boardRoot?.dispose(false, false);
    boardRoot = new B.TransformNode("route-board-root", scene);

    if (boardAssetStatus !== "loaded") {
      renderBase(boardRoot);
    }
    renderTiles(boardRoot);
    renderPickups(boardRoot);
    renderWalls(boardRoot);
    renderPortal(boardRoot);
    renderPlayer(boardRoot);
    renderGuardian(boardRoot);
    writeProjectedCellCenters();
  }

  // Default safe framing — also used by resetView(). Snaps alpha/beta/radius/
  // target back inside the clamps for the current canvas width.
  function fitCamera() {
    const width = canvas.clientWidth || engine.getRenderWidth();
    const isNarrow = width < 520;
    camera.alpha = DEFAULT_CAMERA_ALPHA;
    camera.radius = isNarrow
      ? DEFAULT_CAMERA_RADIUS_MOBILE
      : DEFAULT_CAMERA_RADIUS;
    camera.beta = isNarrow ? DEFAULT_CAMERA_BETA - 0.06 : DEFAULT_CAMERA_BETA;
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

  // Tap vs drag/pinch — robust, device-independent detection from the raw
  // pointer coordinates. A move only fires when a single pointer is released
  // near where it started, quickly, with no second finger involved during the
  // gesture. One-finger orbit drags exceed the distance threshold and
  // two-finger pinches raise the multi-touch flag, so neither moves a piece.
  // The camera's own pointer input still handles the orbit/pinch in parallel.
  const TAP_MOVE_THRESHOLD_PX = 14;
  const TAP_MAX_DURATION_MS = 650;
  let pointersDown = 0;
  let gestureMultiTouch = false;
  let tapPointerId = -1;
  let tapStartX = 0;
  let tapStartY = 0;
  let tapStartTime = 0;

  scene.onPointerObservable.add((pointerInfo) => {
    const event = pointerInfo.event as PointerEvent;

    if (pointerInfo.type === B.PointerEventTypes.POINTERDOWN) {
      pointersDown += 1;
      if (pointersDown > 1) {
        gestureMultiTouch = true;
      } else {
        gestureMultiTouch = false;
        tapPointerId = event.pointerId;
        tapStartX = event.clientX;
        tapStartY = event.clientY;
        tapStartTime = performance.now();
      }
      return;
    }

    if (pointerInfo.type !== B.PointerEventTypes.POINTERUP) return;

    pointersDown = Math.max(0, pointersDown - 1);
    if (pointersDown > 0) return; // wait for every finger to lift

    const wasMultiTouch = gestureMultiTouch;
    gestureMultiTouch = false;
    if (wasMultiTouch || event.pointerId !== tapPointerId) return;

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
  });

  fitCamera();
  renderBoard();
  void loadBoardAssetOnce();
  engine.runRenderLoop(() => {
    scene.render();
  });

  return {
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
      engine.stopRenderLoop();
      boardRoot?.dispose(false, false);
      boardAssetRoot?.dispose(false, true);
      glow.dispose();
      scene.dispose();
      engine.dispose();
    },
  };
}
