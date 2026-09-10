"""
Render the two MindFlow hero worlds as layered 2.5D Home dioramas.

Until now the Home showed the games themselves: the Route board GLB laid flat
on a plinth, and the Circuit's own V2 board render. Both read as "the game
enlarged on a table" rather than "a small world I can enter".

This script builds an environment around each artifact instead:

- Rota Estrategica: an irregular stone island where the board survives as a
  paved ruin platform, a path climbs toward the teal portal on a rise,
  lanterns line the way, and the Guardian and Explorer are small presences.
- Circuito de Memoria: a mineral island/altar whose top IS the real V2 board
  geometry (imported from the official generator, so the four positions, four
  colours, four symbols, bronze, stone, trails and teal core are literally the
  same artifact), with steps, energy channels and contained crystals around it.

Both share one orthographic camera family, canvas and light rig, and are framed
with real margin on every side — the previous Circuit kit ended exactly on the
last pixel row, which is what made its base look sliced off.

Run from the project root with Blender:
blender --background --python tools/blender/create_hero_world_dioramas.py
"""

from __future__ import annotations

import importlib.util
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
MODEL_DIR = ROOT / "public" / "models" / "route"
OUT_ROOT = ROOT / "docs" / "archive" / "home-hero-worlds-3d-01" / "raw"

RES_X = 1120
RES_Y = 840

LAYER_SUFFIXES = [
    "shadow",
    "base",
    "terrain",
    "structure",
    "props",
    "characters",
    "energy",
    "front",
]

LAYERS: dict[str, list[bpy.types.Object]] = {}
CURRENT: dict[str, str] = {"prefix": ""}


def to_blender(location) -> tuple[float, float, float]:
    """Target coords (X width, Y height, Z depth) -> Blender Z-up."""
    x, y, z = location
    return (x, z, y)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for collection in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
        for item in list(collection):
            if item.users == 0:
                collection.remove(item)


def set_input(node, identifier: str, value) -> None:
    for socket in node.inputs:
        if socket.identifier == identifier:
            socket.default_value = value
            return


def make_material(
    name: str,
    color,
    metallic: float = 0.0,
    roughness: float = 0.65,
    *,
    emission=None,
    emission_strength: float = 0.0,
    alpha: float = 1.0,
):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = next(n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    set_input(bsdf, "Base Color", (*color, 1.0))
    set_input(bsdf, "Metallic", metallic)
    set_input(bsdf, "Roughness", roughness)
    set_input(bsdf, "Alpha", alpha)
    if emission is not None:
        set_input(bsdf, "Emission Color", (*emission, 1.0))
        set_input(bsdf, "Emission Strength", emission_strength)
    material.diffuse_color = (*color, alpha)
    return material


def make_stone(name: str, dark, light, scale: float = 4.6, bump: float = 0.16):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    tree = material.node_tree
    bsdf = next(n for n in tree.nodes if n.type == "BSDF_PRINCIPLED")
    coords = tree.nodes.new("ShaderNodeTexCoord")
    noise = tree.nodes.new("ShaderNodeTexNoise")
    ramp = tree.nodes.new("ShaderNodeValToRGB")
    bump_node = tree.nodes.new("ShaderNodeBump")

    set_input(noise, "Scale", scale)
    set_input(noise, "Detail", 4.0)
    set_input(noise, "Roughness", 0.62)
    set_input(noise, "Distortion", 0.15)
    ramp.color_ramp.elements[0].position = 0.22
    ramp.color_ramp.elements[0].color = (*dark, 1.0)
    ramp.color_ramp.elements[1].position = 0.78
    ramp.color_ramp.elements[1].color = (*light, 1.0)
    set_input(bump_node, "Strength", bump)
    set_input(bsdf, "Metallic", 0.02)
    set_input(bsdf, "Roughness", 0.74)

    tree.links.new(coords.outputs["Generated"], noise.inputs["Vector"])
    tree.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    tree.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    tree.links.new(noise.outputs["Fac"], bump_node.inputs["Height"])
    tree.links.new(bump_node.outputs["Normal"], bsdf.inputs["Normal"])
    material.diffuse_color = (*light, 1.0)
    return material


def make_glow(name: str, color, strength: float):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    tree = material.node_tree
    tree.nodes.clear()
    output = tree.nodes.new("ShaderNodeOutputMaterial")
    mix = tree.nodes.new("ShaderNodeMixShader")
    transparent = tree.nodes.new("ShaderNodeBsdfTransparent")
    emission = tree.nodes.new("ShaderNodeEmission")
    gradient = tree.nodes.new("ShaderNodeTexGradient")
    ramp = tree.nodes.new("ShaderNodeValToRGB")
    coords = tree.nodes.new("ShaderNodeTexCoord")

    gradient.gradient_type = "SPHERICAL"
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.0, 0.0, 0.0, 1.0)
    ramp.color_ramp.elements[1].position = 0.84
    ramp.color_ramp.elements[1].color = (1.0, 1.0, 1.0, 1.0)
    set_input(emission, "Color", (*color, 1.0))
    set_input(emission, "Strength", strength)

    tree.links.new(coords.outputs["Object"], gradient.inputs["Vector"])
    tree.links.new(gradient.outputs["Fac"], ramp.inputs["Fac"])
    tree.links.new(ramp.outputs["Color"], mix.inputs["Fac"])
    tree.links.new(transparent.outputs["BSDF"], mix.inputs[1])
    tree.links.new(emission.outputs["Emission"], mix.inputs[2])
    tree.links.new(mix.outputs["Shader"], output.inputs["Surface"])
    return material


def register(obj, layer: str):
    """Layers are stored already namespaced by world, so passes never mix."""
    key = layer if layer.startswith(f"{CURRENT['prefix']}-") else f"{CURRENT['prefix']}-{layer}"
    LAYERS.setdefault(key, []).append(obj)
    return obj


def bevel(obj, width: float, segments: int = 2) -> None:
    if width <= 0:
        return
    modifier = obj.modifiers.new("SoftEdge", "BEVEL")
    modifier.width = width
    modifier.segments = segments


def add_box(layer, name, location, dimensions, material, rotation_y=0.0, edge=0.03):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=to_blender(location))
    obj = bpy.context.object
    obj.name = name
    width, height, depth = dimensions
    obj.dimensions = (width, depth, height)
    obj.rotation_euler[2] = math.radians(rotation_y)
    obj.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel(obj, min(edge, min(dimensions) * 0.3))
    return register(obj, layer)


def add_cylinder(
    layer, name, location, radius, height, material, vertices=64, scale=(1, 1, 1)
):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=height, location=to_blender(location)
    )
    obj = bpy.context.object
    obj.name = name
    sx, sy, sz = scale
    obj.scale = (sx, sz, sy)
    obj.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.shade_smooth()
    bevel(obj, min(height * 0.15, 0.04))
    return register(obj, layer)


def add_sphere(layer, name, location, radius, material, scale=(1, 1, 1), segments=32):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=max(8, segments // 2),
        radius=radius,
        location=to_blender(location),
    )
    obj = bpy.context.object
    obj.name = name
    sx, sy, sz = scale
    obj.scale = (sx, sz, sy)
    obj.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.shade_smooth()
    return register(obj, layer)


def add_rock(layer, name, location, radius, material, seed=0):
    """A chipped stone: irregular silhouette, never a clean ball."""
    random.seed(seed)
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=2, radius=radius, location=to_blender(location)
    )
    obj = bpy.context.object
    obj.name = name
    mesh = obj.data
    for vertex in mesh.vertices:
        jitter = 1.0 + random.uniform(-0.24, 0.24)
        vertex.co *= jitter
    obj.scale = (1.0, random.uniform(0.55, 0.8), random.uniform(0.85, 1.15))
    obj.rotation_euler[2] = random.uniform(0, math.tau)
    obj.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bevel(obj, radius * 0.08)
    return register(obj, layer)


def add_torus(layer, name, location, major, minor, material, rotation_x=0.0):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=72,
        minor_segments=18,
        location=to_blender(location),
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler[0] = math.radians(rotation_x)
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return register(obj, layer)


def add_cone(layer, name, location, r1, r2, height, material, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_cone_add(
        vertices=40, radius1=r1, radius2=r2, depth=height,
        location=to_blender(location),
    )
    obj = bpy.context.object
    obj.name = name
    sx, sy, sz = scale
    obj.scale = (sx, sz, sy)
    obj.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.shade_smooth()
    return register(obj, layer)


def import_glb(layer, asset, instance, location, scale=1.0, rotation_y=0.0):
    path = MODEL_DIR / f"{asset}.glb"
    if not path.exists():
        raise FileNotFoundError(path)
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [o for o in bpy.data.objects if o not in before]
    imported_set = set(imported)

    root = bpy.data.objects.new(f"{instance}_Root", None)
    bpy.context.collection.objects.link(root)
    root.location = to_blender(location)
    root.rotation_euler[2] = math.radians(rotation_y)
    root.scale = (scale, scale, scale)

    for obj in imported:
        if obj.parent not in imported_set:
            obj.parent = root
        obj.name = f"{instance}_{obj.name}"
        if obj.type == "MESH":
            register(obj, layer)
    return root


def shared_materials() -> dict:
    return {
        "shadow": make_glow("HeroShadow", (0.02, 0.012, 0.008), 0.42),
        "rock": make_stone("HeroRock", (0.055, 0.075, 0.07), (0.20, 0.235, 0.215), 3.2, 0.24),
        "rock_deep": make_stone("HeroRockDeep", (0.03, 0.042, 0.04), (0.10, 0.125, 0.115), 2.4, 0.3),
        "teal_stone": make_stone("HeroTealStone", (0.035, 0.085, 0.085), (0.14, 0.245, 0.235), 4.2, 0.2),
        "earth": make_stone("HeroEarth", (0.09, 0.055, 0.03), (0.24, 0.15, 0.08), 5.5, 0.26),
        "paving": make_stone("HeroPaving", (0.075, 0.115, 0.115), (0.24, 0.30, 0.28), 8.0, 0.18),
        "wood": make_material("HeroWood", (0.28, 0.15, 0.07), 0.05, 0.6),
        "bronze": make_material("HeroBronze", (0.52, 0.29, 0.10), 0.8, 0.32),
        "bronze_dark": make_material("HeroBronzeDark", (0.22, 0.11, 0.04), 0.74, 0.44),
        "moss": make_material("HeroMoss", (0.16, 0.31, 0.15), 0.0, 0.7),
        "leaf": make_material("HeroLeaf", (0.21, 0.40, 0.19), 0.0, 0.62),
        "teal": make_material(
            "HeroTeal", (0.16, 0.66, 0.60), 0.0, 0.22,
            emission=(0.06, 0.58, 0.52), emission_strength=1.1,
        ),
        "amber": make_material(
            "HeroAmber", (0.96, 0.68, 0.24), 0.0, 0.26,
            emission=(1.0, 0.6, 0.14), emission_strength=1.0,
        ),
        "crystal": make_material(
            "HeroCrystal", (0.24, 0.55, 0.92), 0.0, 0.16,
            emission=(0.08, 0.34, 0.9), emission_strength=0.6,
        ),
        "teal_glow": make_glow("HeroTealGlow", (0.1, 0.62, 0.55), 0.34),
        "amber_glow": make_glow("HeroAmberGlow", (1.0, 0.66, 0.2), 0.3),
    }


def add_island(mats: dict, radius_x: float, radius_z: float, seed: int) -> None:
    """Shared island language: irregular rock mass with a soft contact shadow."""
    add_sphere(
        "shadow", "Island_Shadow", (0.0, -0.62, 0.45), 1.0, mats["shadow"],
        scale=(radius_x * 1.06, 0.045, radius_z * 1.08), segments=48,
    )

    # Body: stacked irregular masses so the silhouette is never a clean disc.
    add_cylinder(
        "base", "Island_Body", (0.0, -0.95, 0.15), 1.0, 1.5, mats["rock_deep"], 96,
        scale=(radius_x * 0.94, 1.0, radius_z * 0.92),
    )
    random.seed(seed)
    for index in range(9):
        angle = index * math.tau / 9 + random.uniform(-0.16, 0.16)
        px = math.cos(angle) * radius_x * random.uniform(0.78, 0.95)
        pz = math.sin(angle) * radius_z * random.uniform(0.78, 0.95)
        add_rock(
            "base", f"Island_Mass{index}", (px, -1.0 + random.uniform(-0.2, 0.2), pz),
            random.uniform(0.55, 0.95), mats["rock_deep"], seed + index,
        )
    add_cylinder(
        "base", "Island_Crown", (0.0, -0.22, 0.1), 1.0, 0.6, mats["rock"], 96,
        scale=(radius_x, 1.0, radius_z),
    )


def build_route(mats: dict) -> None:
    """Rota: island terrain where the board survives as a paved ruin."""
    add_island(mats, 4.5, 3.0, seed=11)

    # Terrain: earth shelf, moss and a rising ledge toward the portal.
    add_cylinder(
        "terrain", "Route_Soil", (0.0, 0.06, 0.15), 1.0, 0.22, mats["earth"], 96,
        scale=(4.3, 1.0, 2.85),
    )
    add_cylinder(
        "terrain", "Route_Ledge", (2.35, 0.34, -1.15), 1.0, 0.5, mats["rock"], 64,
        scale=(1.85, 1.0, 1.25),
    )
    add_cylinder(
        "terrain", "Route_LedgeTop", (2.35, 0.6, -1.15), 1.0, 0.16, mats["paving"], 64,
        scale=(1.6, 1.0, 1.05),
    )
    for index, (x, z, r) in enumerate([(-3.7, -1.5, 0.7), (-4.0, 0.9, 0.55), (3.9, 1.5, 0.6)]):
        add_rock("terrain", f"Route_Outcrop{index}", (x, 0.2, z), r, mats["rock"], 40 + index)

    # Structure: the game board, embedded low as a paved ruin platform, plus
    # broken pillars. It stays recognisable without dominating as a big grid.
    # The board survives as a small paved ruin sunk into the terrain: still
    # recognisable as the Route grid, but no longer the whole world.
    import_glb("structure", "board", "Route_Board", (-1.75, 0.12, 1.05), 0.33, rotation_y=-26)
    add_cylinder(
        "structure", "Route_BoardBed", (-1.75, 0.08, 1.05), 1.0, 0.18, mats["paving"], 48,
        scale=(1.35, 1.0, 1.1),
    )
    for index, (x, z, height) in enumerate([(-3.0, -1.5, 1.9), (-1.85, -2.15, 1.3), (0.9, -2.35, 0.9)]):
        add_cylinder(
            "structure", f"Route_Pillar{index}", (x, 0.2 + height / 2, z), 0.16, height,
            mats["rock"], 18,
        )
        add_cylinder(
            "structure", f"Route_PillarCap{index}", (x, 0.22 + height, z), 0.21, 0.12,
            mats["bronze_dark"], 18,
        )

    # A stepped path climbing from the board to the portal ledge.
    steps = [
        (-0.75, 0.24, 0.9), (-0.05, 0.28, 0.55), (0.6, 0.34, 0.15),
        (1.2, 0.42, -0.25), (1.75, 0.52, -0.6), (2.15, 0.62, -0.9),
    ]
    for index, (x, y, z) in enumerate(steps):
        add_cylinder(
            "structure", f"Route_Step{index}", (x, y, z), 0.36 - index * 0.015, 0.13,
            mats["paving"], 24, scale=(1.0, 1.0, 0.7),
        )

    # Props: walls as ruin blocks, lanterns along the path, moss and foliage.
    for index, (x, z, rot) in enumerate([(-1.9, 1.05, 12), (0.45, 1.5, -8), (-0.35, -1.35, 20)]):
        import_glb("props", "wall", f"Route_Wall{index}", (x, 0.2, z), 0.66, rotation_y=rot)
    for index, (x, z) in enumerate([(-1.35, 1.75), (0.95, 0.95), (1.85, -0.3)]):
        import_glb("props", "light", f"Route_Light{index}", (x, 0.24, z), 0.62)
    import_glb("props", "trap", "Route_Trap", (-1.85, 0.2, -0.3), 0.6)

    # MINDFLOW-HOME-VISUAL-04: the reward the Explorer detours for is the Chest.
    # This slot used to hold `shield.glb`, a pickup the game removed in
    # ROTA-CHEST-REWARDS-01 — the maquette was still advertising it. The Chest
    # has no GLB of its own: the board builds it from boxes, so it is rebuilt
    # here the same way and in the same palette the renderer uses — a small
    # stone relic banded in bronze, turned slightly so a face and a side both
    # catch the key light, with a single teal ember on the lid.
    chest_x, chest_z, chest_turn = 1.25, 1.45, -16
    turn_cos = math.cos(math.radians(chest_turn))
    turn_sin = math.sin(math.radians(chest_turn))

    add_box(
        "props", "Route_ChestPlinth", (chest_x, 0.215, chest_z), (0.40, 0.05, 0.32),
        mats["bronze_dark"], rotation_y=chest_turn, edge=0.012,
    )
    add_box(
        "props", "Route_ChestBody", (chest_x, 0.335, chest_z), (0.34, 0.19, 0.26),
        mats["rock"], rotation_y=chest_turn, edge=0.02,
    )
    # The lid overhangs the body. The ruin blocks nearby are flush stacks, so the
    # overhang is what stops this reading as one more piece of rubble.
    add_box(
        "props", "Route_ChestLid", (chest_x, 0.465, chest_z), (0.40, 0.08, 0.30),
        mats["rock"], rotation_y=chest_turn, edge=0.022,
    )
    # No strapping over the lid. Bronze bands are what a chest has close up, but
    # this maquette is shown at roughly a third of the render size, where straps
    # thin enough to be in scale render as dark grooves and read as damage. The
    # silhouette and the ember carry the object at the size the player sees.
    #
    # A bronze lock plate on the face that is turned towards the camera.
    add_box(
        "props", "Route_ChestLock",
        (chest_x + 0.135 * turn_sin, 0.40, chest_z + 0.135 * turn_cos),
        (0.10, 0.09, 0.03), mats["bronze"], rotation_y=chest_turn, edge=0.006,
    )
    for index, (x, z, sx) in enumerate([(-3.4, 1.7, 0.7), (3.5, -1.9, 0.6), (-2.6, 2.15, 0.55)]):
        add_sphere(
            "props", f"Route_Moss{index}", (x, 0.26, z), 0.34, mats["moss"],
            scale=(sx, 0.28, 0.5), segments=18,
        )

    # The portal: destination and the scene's main light, up on the ledge.
    import_glb("structure", "portal", "Route_Portal", (2.35, 0.68, -1.15), 0.82, rotation_y=-10)

    # Characters: small presences that give the world its scale.
    import_glb("characters", "guardian", "Route_Guardian", (-1.15, 0.2, -0.75), 0.62, rotation_y=8)
    import_glb("characters", "player", "Route_Explorer", (-0.45, 0.2, 1.55), 0.6, rotation_y=-16)

    # Energy: the portal aura and lantern pools, all contained.
    add_sphere(
        "energy", "Route_PortalAura", (2.35, 1.32, -1.15), 0.38, mats["teal_glow"],
        scale=(0.9, 1.5, 0.4),
    )
    add_torus(
        "energy", "Route_PortalRing", (2.35, 1.3, -1.15), 0.36, 0.022, mats["teal"],
        rotation_x=90,
    )
    for index, (x, z) in enumerate([(-1.35, 1.75), (0.95, 0.95), (1.85, -0.3)]):
        add_sphere(
            "energy", f"Route_LightPool{index}", (x, 0.4, z), 0.19, mats["amber_glow"],
            scale=(1.0, 0.8, 1.0), segments=18,
        )
    # The Chest's one teal ember — the same single point of reward light the
    # board renders, so the maquette and the game read as the same object. It
    # floats clear of the lid: sunk into it, it rendered as a flat pasted disc
    # rather than a light.
    # Sized against the lantern pools above (0.19): smaller, because the Chest is
    # one reward rather than a light source, but large enough to survive the
    # downscale — at 0.055 it disappeared on the Home card entirely.
    add_sphere(
        "energy", "Route_ChestEmber", (1.25, 0.60, 1.45), 0.10, mats["teal_glow"],
        scale=(1.0, 0.8, 1.0), segments=18,
    )

    # Foreground: rocks and leaves that close the composition.
    for index, (x, z, r) in enumerate([(-3.15, 2.5, 0.5), (2.9, 2.45, 0.44), (0.15, 2.85, 0.36)]):
        add_rock("front", f"Route_FrontRock{index}", (x, 0.3, z), r, mats["rock"], 70 + index)
    for index, (x, z, sx) in enumerate([(-2.35, 2.75, 0.62), (1.85, 2.8, 0.55)]):
        add_sphere(
            "front", f"Route_FrontLeaf{index}", (x, 0.34, z), 0.3, mats["leaf"],
            scale=(sx, 0.24, 0.42), segments=18,
        )


def load_circuit_board_module():
    """Import the official V2 generator so the Home shows the same artifact."""
    path = ROOT / "tools" / "blender" / "create_memory_circuit_visual_v2.py"
    spec = importlib.util.spec_from_file_location("mindflow_circuit_v2", path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def build_circuit(mats: dict) -> None:
    """Circuito: a mineral altar island whose top is the real V2 board."""
    add_island(mats, 4.2, 2.85, seed=23)

    # Terrain: teal mineral shelf with a stepped ring rising to the altar.
    add_cylinder(
        "terrain", "Circuit_Shelf", (0.0, 0.06, 0.12), 1.0, 0.24, mats["teal_stone"], 96,
        scale=(4.0, 1.0, 2.7),
    )
    for index, (radius_scale, y, height) in enumerate([(3.1, 0.28, 0.3), (2.55, 0.5, 0.3)]):
        add_cylinder(
            "terrain", f"Circuit_Step{index}", (0.0, y, 0.05), 1.0, height,
            mats["teal_stone"], 96, scale=(radius_scale, 1.0, radius_scale * 0.68),
        )
        add_torus(
            "terrain", f"Circuit_StepRim{index}", (0.0, y + height / 2, 0.05),
            radius_scale * 0.99, 0.035, mats["bronze_dark"], rotation_x=0,
        )

    # Structure: the OFFICIAL V2 board geometry, scaled onto the altar top.
    circuit = load_circuit_board_module()
    circuit.build_scene()
    # ONLY the resting artifact: `BASE_OBJECTS` is the board itself. The
    # generator's `STATE_OBJECTS` are the game's lit passes (active rings,
    # coloured symbol outlines, glow discs); pulling them in lit every pad at
    # once and turned the altar into noise.
    renderable = {"MESH", "CURVE", "SURFACE", "FONT", "META"}
    board_objects = [o for o in circuit.BASE_OBJECTS if o.type in renderable]

    holder = bpy.data.objects.new("Circuit_BoardRoot", None)
    bpy.context.collection.objects.link(holder)
    holder.location = to_blender((0.0, 0.66, 0.02))
    holder.scale = (0.74, 0.74, 0.74)
    for obj in board_objects:
        if obj.parent is None:
            obj.parent = holder
        register(obj, "structure")

    # Props: bronze fragments, crystals and mineral growth around the altar.
    for index, angle_deg in enumerate((28, 118, 208, 298)):
        angle = math.radians(angle_deg)
        px = math.cos(angle) * 3.15
        pz = math.sin(angle) * 2.05
        add_box(
            "props", f"Circuit_Fragment{index}", (px, 0.34, pz), (0.62, 0.18, 0.42),
            mats["bronze_dark"], rotation_y=angle_deg * 0.4, edge=0.03,
        )
        add_cone(
            "props", f"Circuit_Crystal{index}", (px * 0.86, 0.46, pz * 0.86),
            0.11, 0.02, 0.36, mats["crystal"], scale=(1.0, 1.0, 1.0),
        )
    for index, (x, z, r) in enumerate([(-3.55, -1.15, 0.6), (3.6, 1.1, 0.52), (-3.3, 1.45, 0.46)]):
        add_rock("props", f"Circuit_Rock{index}", (x, 0.24, z), r, mats["rock"], 90 + index)
    for index, (x, z, sx) in enumerate([(-2.95, 1.85, 0.6), (3.0, -1.75, 0.5)]):
        add_sphere(
            "props", f"Circuit_Moss{index}", (x, 0.26, z), 0.3, mats["moss"],
            scale=(sx, 0.26, 0.46), segments=18,
        )

    # Characters slot stays empty for the Circuit: the artifact is the subject.

    # Energy: four channels leaving the altar toward the island rim.
    # No floating channel dashes: the board already carries its four trails,
    # and the altar glow is what ties them to the island.
    add_sphere(
        "energy", "Circuit_AltarGlow", (0.0, 0.8, 0.02), 1.15, mats["teal_glow"],
        scale=(1.0, 0.3, 0.68),
    )
    for index, angle_deg in enumerate((28, 118, 208, 298)):
        angle = math.radians(angle_deg)
        add_sphere(
            "energy", f"Circuit_CrystalGlow{index}",
            (math.cos(angle) * 3.15 * 0.86, 0.52, math.sin(angle) * 2.05 * 0.86),
            0.14, mats["teal_glow"], scale=(1.0, 1.3, 1.0), segments=18,
        )

    # Foreground: rocks and a bronze shard closing the composition.
    for index, (x, z, r) in enumerate([(-2.85, 2.35, 0.48), (2.7, 2.3, 0.42), (0.05, 2.7, 0.34)]):
        add_rock("front", f"Circuit_FrontRock{index}", (x, 0.3, z), r, mats["rock"], 120 + index)
    add_box(
        "front", "Circuit_FrontShard", (-1.35, 0.32, 2.55), (0.7, 0.12, 0.3),
        mats["bronze"], rotation_y=-14, edge=0.02,
    )


WORLDS = {"route": build_route, "circuit": build_circuit}


def add_camera_and_lights() -> None:
    """One camera family for both heroes, framed with margin on every side."""
    elevation = math.radians(50)
    distance = 13.0
    bpy.ops.object.camera_add(
        location=(0.0, -math.cos(elevation) * distance, math.sin(elevation) * distance)
    )
    camera = bpy.context.object
    camera.name = "HeroWorldCamera"
    camera.data.type = "ORTHO"
    # 11.6 keeps the widest island (9.0 units) plus its shadow well inside the
    # frame: the previous Circuit kit ended on the last pixel row.
    camera.data.ortho_scale = 11.6
    target = Vector((0.0, 0.25, 0.15))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = camera

    bpy.ops.object.light_add(type="AREA", location=(-4.0, -5.0, 7.6))
    key = bpy.context.object
    key.data.energy = 700
    key.data.size = 6.0
    key.data.color = (1.0, 0.9, 0.72)

    bpy.ops.object.light_add(type="AREA", location=(4.6, -3.2, 4.8))
    rim = bpy.context.object
    rim.data.energy = 230
    rim.data.size = 3.4
    rim.data.color = (1.0, 0.68, 0.32)

    bpy.ops.object.light_add(type="AREA", location=(-3.8, 3.0, 4.4))
    fill = bpy.context.object
    fill.data.energy = 150
    fill.data.size = 4.8
    fill.data.color = (0.55, 0.85, 1.0)


def configure_render() -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 56
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


def render_world(prefix: str) -> None:
    out_dir = OUT_ROOT / prefix
    out_dir.mkdir(parents=True, exist_ok=True)
    renderable = {"MESH", "CURVE", "SURFACE", "FONT", "META"}
    known = {
        obj
        for objects in LAYERS.values()
        for obj in objects
        if obj.type in renderable
    }

    # Anything the imported generators created but we did not register must
    # never leak into a pass — curves included, or symbol outlines float
    # over every layer.
    for obj in bpy.data.objects:
        if obj.type in renderable and obj not in known:
            obj.hide_render = True

    for suffix in LAYER_SUFFIXES:
        layer = f"{prefix}-{suffix}"
        visible = set(LAYERS.get(layer, []))
        if not visible:
            print(f"Skipping empty layer {layer}")
            continue
        for obj in known:
            obj.hide_render = obj not in visible
        path = out_dir / f"{layer}.png"
        bpy.context.scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        print(f"Rendered {path.name}")


def main() -> None:
    # MINDFLOW-HOME-VISUAL-04: render one world instead of all of them, with
    #   blender --background --python <this> -- --world route
    # Re-rendering a world it did not need to touch would leave a diff on that
    # world's passes for no reason, and make "the other worlds are unchanged"
    # something to argue rather than something that is true by construction.
    requested = None
    if "--" in sys.argv:
        rest = sys.argv[sys.argv.index("--") + 1:]
        if "--world" in rest:
            requested = rest[rest.index("--world") + 1]
    if requested is not None and requested not in WORLDS:
        raise SystemExit(f"unknown world {requested!r}; expected one of {sorted(WORLDS)}")

    for prefix, builder in WORLDS.items():
        if requested is not None and prefix != requested:
            continue
        clear_scene()
        LAYERS.clear()
        CURRENT["prefix"] = prefix
        builder(shared_materials())
        add_camera_and_lights()
        configure_render()
        render_world(prefix)


if __name__ == "__main__":
    main()
