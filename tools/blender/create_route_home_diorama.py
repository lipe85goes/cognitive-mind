"""
Render independent 2.5D Home diorama layers for Rota Estrategica.

This script is intentionally a Home asset generator only. It imports the active
Route GLBs from public/models/route, stages them in a shared orthographic scene,
and writes transparent PNG passes to docs/archive/world-diorama-2_5d-02/raw.

Run from the project root with Blender:
blender --background --python tools/blender/create_route_home_diorama.py
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "public" / "models" / "route"
OUT_DIR = ROOT / "docs" / "archive" / "world-diorama-2_5d-02" / "raw" / "route"

RES_X = 1040
RES_Y = 780
BOARD_SURFACE_Y = 0.2

LAYER_ORDER = [
    "route-contact-shadow",
    "route-base",
    "route-back-environment",
    "route-board",
    "route-walls",
    "route-gameplay-props",
    "route-portal",
    "route-guardian",
    "route-explorer",
    "route-lights",
    "route-front-environment",
    "route-energy",
]

LAYERS: dict[str, list[bpy.types.Object]] = {name: [] for name in LAYER_ORDER}


def target_to_blender(location: tuple[float, float, float]) -> tuple[float, float, float]:
    """Route target coords: X width, Y vertical, Z depth -> Blender Z-up."""
    x, y, z = location
    return (x, z, y)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


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


def add_box(
    layer: str,
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    material: bpy.types.Material,
    bevel: float = 0.025,
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
    add_bevel(obj, bevel)
    return register(obj, layer)


def add_cylinder(
    layer: str,
    name: str,
    location: tuple[float, float, float],
    radius: float,
    height: float,
    material: bpy.types.Material,
    vertices: int = 64,
    scale: tuple[float, float, float] = (1.0, 1.0, 1.0),
    smooth: bool = True,
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
    if smooth:
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


def add_cone(
    layer: str,
    name: str,
    location: tuple[float, float, float],
    radius1: float,
    radius2: float,
    height: float,
    material: bpy.types.Material,
    vertices: int = 32,
    scale: tuple[float, float, float] = (1.0, 1.0, 1.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius1,
        radius2=radius2,
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
    return register(obj, layer)


def add_torus(
    layer: str,
    name: str,
    location: tuple[float, float, float],
    major: float,
    minor: float,
    material: bpy.types.Material,
    major_segments: int = 72,
    minor_segments: int = 16,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=major_segments,
        minor_segments=minor_segments,
        location=target_to_blender(location),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return register(obj, layer)


def import_glb(
    layer: str,
    asset_name: str,
    instance_name: str,
    location: tuple[float, float, float],
    scale: float = 1.0,
    rotation_y: float = 0.0,
) -> list[bpy.types.Object]:
    path = MODEL_DIR / f"{asset_name}.glb"
    if not path.exists():
        raise FileNotFoundError(path)

    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in bpy.data.objects if obj not in before]
    imported_set = set(imported)

    root = bpy.data.objects.new(f"{instance_name}_Root", None)
    bpy.context.collection.objects.link(root)
    root.location = target_to_blender(location)
    root.rotation_euler[2] = math.radians(rotation_y)
    root.scale = (scale, scale, scale)

    for obj in imported:
        if obj.parent not in imported_set:
            obj.parent = root
        obj.name = f"{instance_name}_{obj.name}"
        if obj.type == "MESH":
            obj.hide_select = True
            register(obj, layer)

    return [obj for obj in imported if obj.type == "MESH"]


def make_materials() -> dict[str, bpy.types.Material]:
    return {
        "shadow": make_material("RouteHomeSoftShadow", (0.03, 0.018, 0.01, 1), 0, 0.9, alpha=0.34),
        "wood": make_material("RouteHomeWarmWood", (0.34, 0.18, 0.08, 1), 0.05, 0.58),
        "wood_dark": make_material("RouteHomeDarkWood", (0.16, 0.08, 0.035, 1), 0.1, 0.72),
        "grass": make_material("RouteHomeMoss", (0.19, 0.36, 0.18, 1), 0, 0.72),
        "stone": make_material("RouteHomeStone", (0.36, 0.38, 0.33, 1), 0.02, 0.74),
        "bronze": make_material("RouteHomeBronze", (0.62, 0.39, 0.17, 1), 0.72, 0.34),
        "leaf": make_material("RouteHomeLeaf", (0.24, 0.45, 0.22, 1), 0, 0.62),
        "leaf_light": make_material("RouteHomeLeafLight", (0.48, 0.63, 0.3, 1), 0, 0.58),
        "amber": make_material("RouteHomeAmberGlow", (1.0, 0.73, 0.22, 1), 0, 0.24, (1.0, 0.58, 0.12), 1.4),
        "teal": make_material("RouteHomeTealGlow", (0.38, 0.95, 0.78, 1), 0, 0.28, (0.1, 0.95, 0.72), 1.5),
        "crystal": make_material("RouteHomeCrystalBlue", (0.18, 0.48, 0.95, 1), 0.0, 0.18, (0.07, 0.38, 1.0), 1.0),
        "glow": make_material("RouteHomeSoftGlow", (0.62, 0.95, 0.82, 1), 0, 0.35, (0.45, 0.95, 0.76), 1.2, alpha=0.38),
    }


def cell(row: int, col: int, y: float = BOARD_SURFACE_Y) -> tuple[float, float, float]:
    return (col - 3, y, row - 3)


def add_tree(layer: str, x: float, z: float, scale: float, mats: dict[str, bpy.types.Material]) -> None:
    add_cylinder(layer, f"{layer}_Tree_Trunk_{x}_{z}", (x, 0.28 * scale, z), 0.08 * scale, 0.56 * scale, mats["wood"], 18)
    for index, (dx, dz, radius) in enumerate(((0, 0, 0.34), (-0.18, 0.04, 0.26), (0.18, -0.02, 0.24), (0.02, 0.18, 0.22))):
        add_sphere(
            layer,
            f"{layer}_Tree_Leaves_{index}_{x}_{z}",
            (x + dx * scale, 0.66 * scale, z + dz * scale),
            radius * scale,
            mats["leaf"],
            scale=(1.15, 0.86, 1.0),
        )


def add_lantern(layer: str, x: float, z: float, mats: dict[str, bpy.types.Material]) -> None:
    add_cylinder(layer, f"{layer}_Lantern_Base_{x}_{z}", (x, 0.05, z), 0.12, 0.08, mats["bronze"], 24)
    add_cylinder(layer, f"{layer}_Lantern_Glass_{x}_{z}", (x, 0.24, z), 0.09, 0.28, mats["amber"], 24)
    add_torus(layer, f"{layer}_Lantern_Ring_{x}_{z}", (x, 0.43, z), 0.1, 0.015, mats["bronze"], 32, 8)
    add_sphere(layer, f"{layer}_Lantern_Glow_{x}_{z}", (x, 0.27, z), 0.18, mats["amber"], scale=(1.05, 0.85, 1.05))


def add_rocks(layer: str, prefix: str, positions: list[tuple[float, float, float]], mats: dict[str, bpy.types.Material]) -> None:
    for index, (x, z, radius) in enumerate(positions):
        add_sphere(
            layer,
            f"{prefix}_Rock_{index}",
            (x, 0.07 + radius * 0.12, z),
            radius,
            mats["stone"],
            scale=(1.2, 0.42, 0.9),
            segments=16,
            rings=8,
        )


def build_scene() -> None:
    mats = make_materials()

    add_cylinder("route-contact-shadow", "RouteHome_Contact_Shadow_A", (0, -0.08, 0.35), 1.0, 0.012, mats["shadow"], 96, scale=(5.75, 0.05, 3.45))
    add_cylinder("route-contact-shadow", "RouteHome_Contact_Shadow_B", (0.15, -0.065, 0.48), 1.0, 0.012, mats["shadow"], 96, scale=(4.2, 0.04, 2.35))

    add_cylinder("route-base", "RouteHome_Wood_Plinth", (0, -0.38, 0.35), 1.0, 0.55, mats["wood"], 128, scale=(5.45, 0.72, 3.55))
    add_cylinder("route-base", "RouteHome_Dark_Underside", (0, -0.63, 0.42), 1.0, 0.18, mats["wood_dark"], 128, scale=(5.3, 0.5, 3.35))
    add_cylinder("route-base", "RouteHome_Moss_Surface", (0, -0.04, 0.25), 1.0, 0.12, mats["grass"], 128, scale=(4.9, 0.2, 3.05))
    for x, z in [(-4.25, 1.3), (4.2, 1.1), (-4.0, -1.2), (4.05, -1.25)]:
        add_cylinder("route-base", f"RouteHome_Bronze_Pin_{x}_{z}", (x, 0.07, z), 0.11, 0.08, mats["bronze"], 32)

    add_tree("route-back-environment", -3.15, -2.6, 0.92, mats)
    add_lantern("route-back-environment", 3.9, -2.55, mats)
    add_rocks("route-back-environment", "RouteBack", [(-2.1, -2.85, 0.18), (2.75, -2.7, 0.22), (3.35, -2.2, 0.16)], mats)
    add_sphere("route-back-environment", "RouteBack_Blue_Crystal", (-4.05, -0.95, -2.0), 0.22, mats["crystal"], scale=(0.8, 1.2, 0.8))

    import_glb("route-board", "board", "RouteHome_Board", (0, 0, 0), 1.0)

    for index, pos in enumerate([(0, 2), (1, 4), (2, 1), (2, 5), (3, 3), (4, 1), (4, 4), (5, 2), (5, 5)]):
        import_glb("route-walls", "wall", f"RouteHome_Wall_{index}", cell(*pos), 1.0)

    import_glb("route-portal", "portal", "RouteHome_Portal", cell(0, 6), 1.05, rotation_y=-6)
    import_glb("route-guardian", "guardian", "RouteHome_Guardian", cell(1, 3), 1.34, rotation_y=0)
    import_glb("route-explorer", "player", "RouteHome_Explorer", cell(5, 0), 1.18, rotation_y=8)

    for index, pos in enumerate([(1, 1), (2, 4), (4, 3), (5, 5)]):
        import_glb("route-lights", "light", f"RouteHome_Light_{index}", cell(*pos), 1.03)
        x, y, z = cell(*pos)
        add_sphere("route-energy", f"RouteHome_Light_Glow_{index}", (x, y + 0.38, z), 0.33, mats["amber"], scale=(1.0, 0.62, 1.0))

    for index, pos in enumerate([(2, 2), (3, 5)]):
        import_glb("route-gameplay-props", "trap", f"RouteHome_Trap_{index}", cell(*pos), 1.0)
    import_glb("route-gameplay-props", "shield", "RouteHome_Shield", cell(4, 5), 1.0, rotation_y=-6)

    x, y, z = cell(0, 6)
    add_sphere("route-energy", "RouteHome_Portal_Aura", (x, y + 0.55, z), 0.74, mats["teal"], scale=(0.78, 1.05, 0.36))
    add_torus("route-energy", "RouteHome_Portal_Ring_Energy", (x, y + 0.55, z), 0.42, 0.022, mats["teal"], 64, 8)

    add_rocks("route-front-environment", "RouteFront", [(-3.9, 2.1, 0.22), (-3.25, 2.35, 0.14), (3.65, 2.1, 0.2), (2.95, 2.5, 0.17)], mats)
    for index, (x, z, sx) in enumerate([(-4.25, 1.7, 0.62), (-3.55, 2.2, 0.5), (4.05, 1.9, 0.6), (3.25, 2.42, 0.48)]):
        add_sphere("route-front-environment", f"RouteFront_LeafCluster_{index}", (x, 0.16, z), 0.28, mats["leaf_light"], scale=(sx, 0.3, 0.42))


def add_camera_and_lights() -> bpy.types.Object:
    camera_location = Vector((5.4, -7.2, 5.25))
    target = Vector((0.0, 0.15, 0.25))
    bpy.ops.object.camera_add(location=camera_location)
    camera = bpy.context.object
    camera.name = "RouteHome_Camera"
    camera.data.type = "ORTHO"
    # UNIFIED-VISUAL-01: wide enough that the whole maquette (plinth, trees,
    # contact shadow) fits inside the frame with margin. The previous 8.25
    # cropped the board corners, forcing the Home to hide the cut with an
    # ellipse mask — which made the world read as a flat sticker. The board's
    # rotated diagonal projects ~11.8 world units wide, so 12.8 leaves ~4%
    # clear margin on each side.
    camera.data.ortho_scale = 12.8
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = camera

    bpy.ops.object.light_add(type="AREA", location=(-3.8, -4.8, 7.4))
    key = bpy.context.object
    key.name = "RouteHome_KeyLight"
    key.data.energy = 620
    key.data.size = 5.6
    key.data.color = (1.0, 0.9, 0.72)

    bpy.ops.object.light_add(type="AREA", location=(4.4, -3.1, 4.6))
    rim = bpy.context.object
    rim.name = "RouteHome_WarmRim"
    rim.data.energy = 210
    rim.data.size = 3.2
    rim.data.color = (1.0, 0.68, 0.32)

    bpy.ops.object.light_add(type="AREA", location=(-3.8, 2.6, 4.2))
    fill = bpy.context.object
    fill.name = "RouteHome_TealFill"
    fill.data.energy = 125
    fill.data.size = 4.5
    fill.data.color = (0.55, 0.85, 1.0)

    return camera


def configure_render() -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 72
    scene.cycles.use_denoising = True
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "Medium High Contrast"
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
    renderables = [obj for objects in LAYERS.values() for obj in objects if obj.type == "MESH"]
    visible = set(LAYERS[layer])
    for obj in renderables:
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
