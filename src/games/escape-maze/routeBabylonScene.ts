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
  dispose: () => void;
}

type BabylonRuntime = typeof BABYLON;
type RouteMaterials = Record<
  | "wood"
  | "stone"
  | "stoneAlt"
  | "brass"
  | "wall"
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
  scene.ambientColor = B.Color3.FromHexString("#3a281a");

  const camera = new B.ArcRotateCamera(
    "route-camera",
    -Math.PI / 2.25,
    Math.PI / 3.05,
    9.1,
    new B.Vector3(0, 0.2, 0.15),
    scene,
  );
  camera.inputs.clear();
  camera.minZ = 0.05;
  camera.maxZ = 60;
  camera.fov = 0.72;

  const warmKey = new B.DirectionalLight(
    "route-key-light",
    new B.Vector3(-0.45, -1, -0.35),
    scene,
  );
  warmKey.position = new B.Vector3(5, 8, 6);
  warmKey.intensity = 2.15;
  warmKey.diffuse = B.Color3.FromHexString("#ffdfae");

  const fill = new B.HemisphericLight(
    "route-fill-light",
    new B.Vector3(0, 1, 0),
    scene,
  );
  fill.intensity = 0.42;
  fill.diffuse = B.Color3.FromHexString("#f8e2bd");
  fill.groundColor = B.Color3.FromHexString("#120805");

  const rim = new B.PointLight(
    "route-rim-light",
    new B.Vector3(-3.9, 2.6, -4),
    scene,
  );
  rim.intensity = 0.62;
  rim.diffuse = B.Color3.FromHexString("#78e0ff");

  const glow = new B.GlowLayer("route-glow-layer", scene, {
    mainTextureSamples: 2,
  });
  glow.intensity = 0.42;

  const shadowGenerator = new B.ShadowGenerator(1024, warmKey);
  shadowGenerator.useBlurExponentialShadowMap = true;
  shadowGenerator.blurKernel = 24;
  shadowGenerator.bias = 0.0008;

  const materials = createMaterials(B, scene);
  let state = initialState;
  let boardRoot: BABYLON.TransformNode | null = null;

  function cellToPosition(row: number, col: number) {
    const x = (col - (state.cols - 1) / 2) * CELL;
    const z = (row - (state.rows - 1) / 2) * CELL;
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

    for (let row = 0; row < state.rows; row += 1) {
      for (let col = 0; col < state.cols; col += 1) {
        const key = `${row},${col}`;
        const pos = cellToPosition(row, col);
        const tile = box(
          "route-tile",
          0.86,
          TILE_HEIGHT,
          0.86,
          new B.Vector3(pos.x, 0.08, pos.z),
          (row + col) % 2 === 0 ? materials.stone : materials.stoneAlt,
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
            new B.Vector3(pos.x, 0.18, pos.z),
            materials.danger,
            parent,
          );
        }

        if (moveKeys.has(key)) {
          torus(
            "route-move-ring",
            0.48,
            0.02,
            new B.Vector3(pos.x, 0.2, pos.z),
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
        0.58,
        0.72,
        new B.Vector3(pos.x, 0.42, pos.z),
        materials.wall,
        parent,
      );
      box(
        "route-wall-cap",
        0.62,
        0.14,
        0.62,
        new B.Vector3(pos.x, 0.79, pos.z),
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
      crystal.position = new B.Vector3(pos.x, 0.5, pos.z);
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
        new B.Vector3(pos.x, 0.38, pos.z),
        materials.shield,
        parent,
        6,
      );
      box(
        "route-shield-face",
        0.25,
        0.18,
        0.06,
        new B.Vector3(pos.x, 0.53, pos.z),
        materials.shield,
        parent,
      );
    }
  }

  function renderBoard() {
    boardRoot?.dispose(false, false);
    boardRoot = new B.TransformNode("route-board-root", scene);

    renderBase(boardRoot);
    renderTiles(boardRoot);
    renderPickups(boardRoot);
    renderWalls(boardRoot);
    renderPortal(boardRoot);
    renderPlayer(boardRoot);
    renderGuardian(boardRoot);
    writeProjectedCellCenters();
  }

  function fitCamera() {
    const width = engine.getRenderWidth();
    camera.radius = width < 520 ? 10.4 : 9.1;
    camera.beta = width < 520 ? Math.PI / 3.35 : Math.PI / 3.05;
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

  scene.onPointerObservable.add((pointerInfo) => {
    if (pointerInfo.type !== B.PointerEventTypes.POINTERDOWN) return;

    const pick = scene.pick(scene.pointerX, scene.pointerY, (mesh) => {
      return Boolean(mesh.metadata?.routeTile);
    });
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
    dispose() {
      engine.stopRenderLoop();
      boardRoot?.dispose(false, false);
      glow.dispose();
      scene.dispose();
      engine.dispose();
    },
  };
}
