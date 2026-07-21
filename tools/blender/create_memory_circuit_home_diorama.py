"""
Render independent 2.5D Home diorama layers for Circuito de Memoria.

The scene reuses tools/blender/create_memory_circuit_board.py so the Home
diorama keeps the same board, pads, core and trail identity as the active game.
It only changes the camera/framing for the Home world selector.

Run from the project root with Blender:
blender --background --python tools/blender/create_memory_circuit_home_diorama.py
"""

from __future__ import annotations

import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


SCRIPT_DIR = Path(__file__).resolve().parent
ROOT = SCRIPT_DIR.parents[1]
OUT_DIR = ROOT / "docs" / "archive" / "world-diorama-2_5d-02" / "raw" / "circuit"

if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

import create_memory_circuit_board as memory  # noqa: E402


RES_X = 1040
RES_Y = 780

LAYER_ORDER = [
    "circuit-contact-shadow",
    "circuit-base",
    "circuit-back-environment",
    "circuit-board",
    "circuit-pads",
    "circuit-core",
    "circuit-energy",
    "circuit-front-environment",
]

LAYERS: dict[str, list[bpy.types.Object]] = {name: [] for name in LAYER_ORDER}


def target_to_blender(location: tuple[float, float, float]) -> tuple[float, float, float]:
    x, y, z = location
    return (x, z, y)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    memory.BASE_OBJS.clear()
    for objects in memory.LIT_OBJS.values():
        objects.clear()


def _set_bsdf_input(node: bpy.types.Node, identifier: str, value) -> None:
    for socket in node.inputs:
        if socket.identifier == identifier:
            socket.default_value = value
            return


def make_material(
    name: str,
    color: tuple[float, float, float, float],
    metallic: float = 0.0,
    roughness: float = 0.65,
    emission: tuple[float, float, float] | None = None,
    emission_strength: float = 0.0,
    alpha: float = 1.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = next(
        (node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"),
        None,
    )
    if bsdf:
        _set_bsdf_input(bsdf, "Base Color", color)
        _set_bsdf_input(bsdf, "Metallic", metallic)
        _set_bsdf_input(bsdf, "Roughness", roughness)
        _set_bsdf_input(bsdf, "Alpha", alpha)
        if emission:
            _set_bsdf_input(bsdf, "Emission Color", (*emission, 1.0))
            _set_bsdf_input(bsdf, "Emission Strength", emission_strength)
    material.diffuse_color = (color[0], color[1], color[2], alpha)
    if alpha < 1.0:
        material.blend_method = "BLEND"
        material.use_screen_refraction = False
        material.show_transparent_back = False
    return material


def register(obj: bpy.types.Object, layer: str) -> bpy.types.Object:
    LAYERS[layer].append(obj)
    return obj


def add_bevel(obj: bpy.types.Object, width: float, segments: int = 2) -> None:
    if width <= 0:
        return
    bevel = obj.modifiers.new(f"{obj.name}_Bevel", "BEVEL")
    bevel.width = width
    bevel.segments = segments
    normal = obj.modifiers.new(f"{obj.name}_WeightedNormals", "WEIGHTED_NORMAL")
    normal.keep_sharp = True


def add_cylinder(
    layer: str,
    name: str,
    location: tuple[float, float, float],
    radius: float,
    height: float,
    material: bpy.types.Material,
    vertices: int = 64,
    scale: tuple[float, float, float] = (1.0, 1.0, 1.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=height,
        location=target_to_blender(location),
    )
    obj = bpy.context.object
    obj.name = name
    sx, sy, sz = scale
    obj.scale = (sx, sz, sy)
    obj.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.shade_smooth()
    add_bevel(obj, min(height * 0.18, 0.05), 2)
    return register(obj, layer)


def add_sphere(
    layer: str,
    name: str,
    location: tuple[float, float, float],
    radius: float,
    material: bpy.types.Material,
    scale: tuple[float, float, float] = (1.0, 1.0, 1.0),
    segments: int = 32,
    rings: int = 16,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=radius,
        segments=segments,
        ring_count=rings,
        location=target_to_blender(location),
    )
    obj = bpy.context.object
    obj.name = name
    sx, sy, sz = scale
    obj.scale = (sx, sz, sy)
    obj.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.shade_smooth()
    return register(obj, layer)


def add_box(
    layer: str,
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    material: bpy.types.Material,
    bevel: float = 0.02,
    rotation_y: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(
        size=1,
        location=target_to_blender(location),
        rotation=(0.0, 0.0, math.radians(rotation_y)),
    )
    obj = bpy.context.object
    obj.name = name
    width, height, depth = dimensions
    obj.dimensions = (width, depth, height)
    obj.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    add_bevel(obj, bevel, 2)
    return register(obj, layer)


def make_materials() -> dict[str, bpy.types.Material]:
    return {
        "shadow": make_material("CircuitHomeSoftShadow", (0.025, 0.015, 0.01, 1), 0, 0.9, alpha=0.32),
        "wood": make_material("CircuitHomeWarmWood", (0.32, 0.17, 0.08, 1), 0.05, 0.58),
        "stone": make_material("CircuitHomeStone", (0.34, 0.34, 0.3, 1), 0.02, 0.74),
        "bronze": make_material("CircuitHomeBronze", (0.62, 0.4, 0.18, 1), 0.68, 0.34),
        "leaf": make_material("CircuitHomeLeaf", (0.25, 0.45, 0.24, 1), 0, 0.62),
        "paper": make_material("CircuitHomeWarmPaper", (0.78, 0.68, 0.49, 1), 0, 0.72),
        "amber": make_material("CircuitHomeAmber", (1.0, 0.72, 0.22, 1), 0, 0.22, (1.0, 0.55, 0.12), 1.3),
        "teal": make_material("CircuitHomeTeal", (0.35, 0.88, 0.86, 1), 0, 0.28, (0.15, 0.8, 0.88), 1.1, alpha=0.42),
        "purple": make_material("CircuitHomePurpleCrystal", (0.55, 0.35, 0.9, 1), 0, 0.25, (0.32, 0.12, 0.75), 0.8),
    }


def assign_board_layers() -> None:
    for obj in memory.BASE_OBJS:
        name = obj.name
        if name.startswith(("Board_Body", "Skirt", "Gold_Rim", "Gem_Bezel", "Rim_Gem")):
            LAYERS["circuit-base"].append(obj)
        elif name.startswith(("Board_Top", "Rosette", "Trail_", "TrailLine_")):
            LAYERS["circuit-board"].append(obj)
        elif name.startswith(("Well_", "Ring_", "Enamel_", "Sym_")):
            LAYERS["circuit-pads"].append(obj)
        elif name.startswith("Core_"):
            LAYERS["circuit-core"].append(obj)
        else:
            LAYERS["circuit-board"].append(obj)

    energy_names = ("GlowPool_", "TrailLit_", "Core_GlowPool")
    for group in memory.LIT_OBJS.values():
        for obj in group:
            if obj.name.startswith(energy_names):
                LAYERS["circuit-energy"].append(obj)


def add_books(layer: str, x: float, z: float, mats: dict[str, bpy.types.Material]) -> None:
    colors = [mats["wood"], mats["paper"], mats["bronze"]]
    for index in range(4):
        add_box(
            layer,
            f"{layer}_Book_{index}_{x}_{z}",
            (x + index * 0.24, 0.09 + index * 0.015, z),
            (0.2, 0.18, 0.78),
            colors[index % len(colors)],
            0.018,
            rotation_y=-8 + index * 3,
        )


def add_plant(layer: str, x: float, z: float, mats: dict[str, bpy.types.Material], scale: float = 1.0) -> None:
    add_cylinder(layer, f"{layer}_PlantPot_{x}_{z}", (x, 0.12 * scale, z), 0.18 * scale, 0.22 * scale, mats["wood"], 28)
    for index, angle in enumerate((-60, -28, 0, 30, 62)):
        dx = math.sin(math.radians(angle)) * 0.18 * scale
        dz = math.cos(math.radians(angle)) * 0.16 * scale
        add_sphere(
            layer,
            f"{layer}_PlantLeaf_{index}_{x}_{z}",
            (x + dx, 0.33 * scale, z + dz),
            0.13 * scale,
            mats["leaf"],
            scale=(0.7, 0.16, 1.2),
        )


def build_scene() -> None:
    mats = make_materials()
    memory.build_scene()
    assign_board_layers()

    add_cylinder("circuit-contact-shadow", "CircuitHome_Contact_Shadow_A", (0, -0.12, 0.34), 1.0, 0.012, mats["shadow"], 96, scale=(4.35, 0.05, 3.0))
    add_cylinder("circuit-contact-shadow", "CircuitHome_Contact_Shadow_B", (0, -0.1, 0.46), 1.0, 0.012, mats["shadow"], 96, scale=(3.2, 0.04, 2.0))

    add_books("circuit-back-environment", -3.25, -2.65, mats)
    add_plant("circuit-back-environment", 3.25, -2.4, mats, 1.1)
    add_cylinder("circuit-back-environment", "CircuitBack_Lantern_Base", (2.25, 0.06, -2.75), 0.16, 0.08, mats["bronze"], 32)
    add_sphere("circuit-back-environment", "CircuitBack_Lantern_Glow", (2.25, 0.3, -2.75), 0.22, mats["amber"], scale=(0.85, 1.0, 0.85))
    add_sphere("circuit-back-environment", "CircuitBack_Teal_Crystal", (-2.65, 0.18, -2.15), 0.16, mats["teal"], scale=(0.75, 1.25, 0.75))

    add_plant("circuit-front-environment", -3.25, 2.2, mats, 1.0)
    add_plant("circuit-front-environment", 3.2, 2.1, mats, 0.92)
    add_books("circuit-front-environment", 2.05, 2.5, mats)
    add_sphere("circuit-front-environment", "CircuitFront_Purple_Crystal", (-2.55, 0.17, 2.65), 0.2, mats["purple"], scale=(0.75, 1.35, 0.75))


def add_camera_and_lights() -> bpy.types.Object:
    camera_location = Vector((5.0, -7.0, 5.0))
    target = Vector((0.0, 0.1, 0.18))
    bpy.ops.object.camera_add(location=camera_location)
    camera = bpy.context.object
    camera.name = "CircuitHome_Camera"
    camera.data.type = "ORTHO"
    # UNIFIED-VISUAL-01: fit the full platform, props and contact shadow in
    # frame (the previous 7.15 cropped the platform edge; 8.8 still clipped
    # the side book props, so 9.6 gives every prop clear margin).
    camera.data.ortho_scale = 9.6
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = camera

    bpy.ops.object.light_add(type="AREA", location=(-3.6, -4.8, 7.2))
    key = bpy.context.object
    key.name = "CircuitHome_KeyLight"
    key.data.energy = 650
    key.data.size = 5.8
    key.data.color = (1.0, 0.91, 0.76)

    bpy.ops.object.light_add(type="AREA", location=(4.0, -3.1, 4.4))
    rim = bpy.context.object
    rim.name = "CircuitHome_WarmRim"
    rim.data.energy = 190
    rim.data.size = 3.2
    rim.data.color = (1.0, 0.67, 0.35)

    bpy.ops.object.light_add(type="AREA", location=(-3.2, 2.8, 4.2))
    fill = bpy.context.object
    fill.name = "CircuitHome_TealFill"
    fill.data.energy = 120
    fill.data.size = 4.4
    fill.data.color = (0.55, 0.86, 1.0)

    return camera


def configure_render() -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 72
    scene.cycles.use_denoising = True
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.render.resolution_x = RES_X
    scene.render.resolution_y = RES_Y
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"

    world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    if background:
        background.inputs["Color"].default_value = (0.025, 0.022, 0.018, 1.0)
        background.inputs["Strength"].default_value = 0.0


def render_layer(layer: str) -> None:
    visible = set(LAYERS[layer])
    for obj in bpy.data.objects:
        if obj.type == "MESH":
            obj.hide_render = obj not in visible

    path = OUT_DIR / f"{layer}.png"
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {path}")


def main() -> None:
    clear_scene()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    build_scene()
    add_camera_and_lights()
    configure_render()

    for layer in LAYER_ORDER:
        render_layer(layer)


if __name__ == "__main__":
    main()
