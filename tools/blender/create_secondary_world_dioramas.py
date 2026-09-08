"""
Render layered 2.5D Home dioramas for the three secondary MindFlow worlds.

Central de Comandos, Trilha Logica and Jardim de Sementes were flat sprites in
the Home gallery; they read as clipart icons next to the layered Route and
Circuit maquettes. This script builds them as real maquettes from primitives,
using the SAME orthographic camera family, canvas and warm-key/teal-fill
lighting as the hero worlds, and writes transparent PNG passes.
(That camera family was first established by `create_route_home_diorama.py`,
removed in MINDFLOW-CLEANUP-03C; `create_hero_world_dioramas.py` carries it now.)

Run from the project root with Blender:
blender --background --python tools/blender/create_secondary_world_dioramas.py
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
OUT_ROOT = ROOT / "docs" / "archive" / "home-worlds-final-01" / "raw"

RES_X = 1040
RES_Y = 780

LAYER_SUFFIXES = [
    "contact-shadow",
    "base",
    "back",
    "main",
    "detail",
    "energy",
    "front",
]

LAYERS: dict[str, list[bpy.types.Object]] = {}


def to_blender(location: tuple[float, float, float]) -> tuple[float, float, float]:
    """Target coords (X width, Y height, Z depth) -> Blender Z-up."""
    x, y, z = location
    return (x, z, y)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.curves):
        for item in list(block):
            if item.users == 0:
                block.remove(item)


def set_input(node: bpy.types.Node, identifier: str, value) -> None:
    for socket in node.inputs:
        if socket.identifier == identifier:
            socket.default_value = value
            return


def make_material(
    name: str,
    color: tuple[float, float, float],
    metallic: float = 0.0,
    roughness: float = 0.65,
    *,
    emission: tuple[float, float, float] | None = None,
    emission_strength: float = 0.0,
    alpha: float = 1.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = next(
        node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"
    )
    set_input(bsdf, "Base Color", (*color, 1.0))
    set_input(bsdf, "Metallic", metallic)
    set_input(bsdf, "Roughness", roughness)
    set_input(bsdf, "Alpha", alpha)
    if emission is not None:
        set_input(bsdf, "Emission Color", (*emission, 1.0))
        set_input(bsdf, "Emission Strength", emission_strength)
    material.diffuse_color = (*color, alpha)
    return material


def make_stone(
    name: str,
    dark: tuple[float, float, float],
    light: tuple[float, float, float],
) -> bpy.types.Material:
    """Painted stone with subtle mineral variation, as in the Circuit kit."""
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    tree = material.node_tree
    bsdf = next(node for node in tree.nodes if node.type == "BSDF_PRINCIPLED")
    coords = tree.nodes.new("ShaderNodeTexCoord")
    noise = tree.nodes.new("ShaderNodeTexNoise")
    ramp = tree.nodes.new("ShaderNodeValToRGB")
    bump = tree.nodes.new("ShaderNodeBump")

    set_input(noise, "Scale", 4.6)
    set_input(noise, "Detail", 3.0)
    set_input(noise, "Roughness", 0.6)
    ramp.color_ramp.elements[0].position = 0.24
    ramp.color_ramp.elements[0].color = (*dark, 1.0)
    ramp.color_ramp.elements[1].position = 0.76
    ramp.color_ramp.elements[1].color = (*light, 1.0)
    set_input(bump, "Strength", 0.14)
    set_input(bsdf, "Metallic", 0.02)
    set_input(bsdf, "Roughness", 0.72)

    tree.links.new(coords.outputs["Generated"], noise.inputs["Vector"])
    tree.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    tree.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    material.diffuse_color = (*light, 1.0)
    return material


def make_glow(name: str, color: tuple[float, float, float], strength: float):
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
    ramp.color_ramp.elements[1].position = 0.82
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


def register(obj: bpy.types.Object, layer: str) -> bpy.types.Object:
    LAYERS.setdefault(layer, []).append(obj)
    return obj


def bevel(obj: bpy.types.Object, width: float, segments: int = 2) -> None:
    if width <= 0:
        return
    modifier = obj.modifiers.new("SoftEdge", "BEVEL")
    modifier.width = width
    modifier.segments = segments


def add_box(
    layer: str,
    name: str,
    location,
    dimensions,
    material,
    rotation_y: float = 0.0,
    edge: float = 0.02,
) -> bpy.types.Object:
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
    layer: str,
    name: str,
    location,
    radius: float,
    height: float,
    material,
    vertices: int = 64,
    scale=(1.0, 1.0, 1.0),
) -> bpy.types.Object:
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
    bevel(obj, min(height * 0.16, 0.04))
    return register(obj, layer)


def add_sphere(
    layer: str,
    name: str,
    location,
    radius: float,
    material,
    scale=(1.0, 1.0, 1.0),
    segments: int = 32,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments, ring_count=segments // 2, radius=radius,
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


def add_cone(
    layer: str,
    name: str,
    location,
    radius1: float,
    radius2: float,
    height: float,
    material,
    scale=(1.0, 1.0, 1.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=32, radius1=radius1, radius2=radius2, depth=height,
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


def add_torus(
    layer: str,
    name: str,
    location,
    major: float,
    minor: float,
    material,
    rotation_x: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor, major_segments=64,
        minor_segments=16, location=to_blender(location),
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler[0] = math.radians(rotation_x)
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return register(obj, layer)


def materials() -> dict:
    return {
        "shadow": make_glow("SecShadow", (0.02, 0.012, 0.008), 0.4),
        "wood": make_material("SecWood", (0.30, 0.16, 0.075), 0.05, 0.6),
        "wood_dark": make_material("SecWoodDark", (0.15, 0.075, 0.035), 0.08, 0.7),
        "stone": make_stone("SecStone", (0.06, 0.10, 0.10), (0.16, 0.235, 0.23)),
        "stone_pale": make_stone("SecStonePale", (0.13, 0.16, 0.15), (0.30, 0.34, 0.31)),
        "bronze": make_material("SecBronze", (0.50, 0.27, 0.09), 0.78, 0.34),
        "bronze_dark": make_material("SecBronzeDark", (0.24, 0.12, 0.04), 0.72, 0.44),
        "leaf": make_material("SecLeaf", (0.20, 0.42, 0.19), 0.0, 0.6),
        "leaf_light": make_material("SecLeafLight", (0.36, 0.58, 0.24), 0.0, 0.56),
        "soil": make_material("SecSoil", (0.16, 0.10, 0.06), 0.0, 0.82),
        "teal": make_material(
            "SecTeal", (0.16, 0.62, 0.58), 0.0, 0.24, emission=(0.06, 0.55, 0.5),
            emission_strength=0.9,
        ),
        "amber": make_material(
            "SecAmber", (0.95, 0.66, 0.22), 0.0, 0.26, emission=(1.0, 0.6, 0.14),
            emission_strength=0.9,
        ),
        "water": make_material(
            "SecWater", (0.20, 0.55, 0.62), 0.0, 0.12, emission=(0.1, 0.42, 0.5),
            emission_strength=0.45, alpha=0.85,
        ),
        "teal_glow": make_glow("SecTealGlow", (0.1, 0.62, 0.55), 0.22),
        "amber_glow": make_glow("SecAmberGlow", (1.0, 0.66, 0.2), 0.22),
    }


def add_plinth(prefix: str, mats: dict) -> None:
    """Shared base language: warm wood plinth + stone top + bronze pins."""
    add_cylinder(f"{prefix}-contact-shadow", f"{prefix}_Shadow", (0, -0.09, 0.3),
                 1.0, 0.012, mats["shadow"], 96, scale=(3.3, 0.05, 2.1))
    add_cylinder(f"{prefix}-base", f"{prefix}_Plinth", (0, -0.36, 0.2),
                 1.0, 0.5, mats["wood"], 96, scale=(2.95, 0.7, 1.95))
    add_cylinder(f"{prefix}-base", f"{prefix}_Under", (0, -0.6, 0.24),
                 1.0, 0.16, mats["wood_dark"], 96, scale=(2.85, 0.45, 1.85))
    add_cylinder(f"{prefix}-base", f"{prefix}_Top", (0, -0.05, 0.16),
                 1.0, 0.12, mats["stone"], 96, scale=(2.68, 0.2, 1.75))
    for index, (x, z) in enumerate([(-2.35, 0.85), (2.35, 0.8), (-2.15, -0.8), (2.15, -0.85)]):
        add_cylinder(f"{prefix}-base", f"{prefix}_Pin{index}", (x, 0.06, z),
                     0.1, 0.07, mats["bronze"], 24)


def build_commands(mats: dict) -> None:
    """Central de Comandos: physical protection mechanism, seals and levers."""
    p = "panel"
    add_plinth(p, mats)

    # Back: a bronze-framed stone gate with a seal.
    add_box(f"{p}-back", "Panel_GateStone", (0, 1.02, -1.35), (2.5, 1.85, 0.28),
            mats["stone_pale"], edge=0.05)
    add_box(f"{p}-back", "Panel_GateFrameL", (-1.3, 1.05, -1.3), (0.16, 2.0, 0.34),
            mats["bronze"], edge=0.03)
    add_box(f"{p}-back", "Panel_GateFrameR", (1.3, 1.05, -1.3), (0.16, 2.0, 0.34),
            mats["bronze"], edge=0.03)
    add_box(f"{p}-back", "Panel_GateLintel", (0, 2.02, -1.3), (2.8, 0.2, 0.36),
            mats["bronze"], edge=0.03)
    add_torus(f"{p}-back", "Panel_SealRing", (0, 1.15, -1.18), 0.46, 0.06,
              mats["bronze"], rotation_x=90)
    add_cylinder(f"{p}-back", "Panel_SealDisc", (0, 1.15, -1.2), 0.4, 0.08,
                 mats["stone"], 48, scale=(1, 1, 0.35))

    # Main: the console block with a shield plate and rotary controls.
    add_box(f"{p}-main", "Panel_ConsoleBody", (0, 0.42, 0.15), (2.35, 0.62, 1.15),
            mats["wood_dark"], edge=0.06)
    add_box(f"{p}-main", "Panel_ConsoleFace", (0, 0.74, 0.42), (2.15, 0.5, 0.5),
            mats["stone"], rotation_y=0, edge=0.05)
    add_box(f"{p}-main", "Panel_ConsoleTrim", (0, 0.96, 0.4), (2.3, 0.08, 0.6),
            mats["bronze"], edge=0.02)

    # Shield emblem: the world's readable silhouette.
    add_cone(f"{p}-detail", "Panel_Shield", (0, 0.82, 0.62), 0.42, 0.06, 0.1,
             mats["bronze"], scale=(1.0, 1.0, 1.15))
    add_cone(f"{p}-detail", "Panel_ShieldInner", (0, 0.86, 0.63), 0.3, 0.04, 0.08,
             mats["teal"], scale=(1.0, 1.0, 1.15))

    # Physical controls: levers and sealed buttons, never a flat screen.
    for index, x in enumerate((-0.82, -0.5)):
        add_cylinder(f"{p}-detail", f"Panel_LeverBase{index}", (x, 0.76, 0.66),
                     0.1, 0.07, mats["bronze_dark"], 20)
        add_cylinder(f"{p}-detail", f"Panel_LeverArm{index}", (x, 0.95, 0.62),
                     0.035, 0.34, mats["bronze"], 16)
        add_sphere(f"{p}-detail", f"Panel_LeverKnob{index}", (x, 1.12, 0.6), 0.075,
                   mats["amber"] if index else mats["teal"])
    for index, x in enumerate((0.5, 0.72, 0.94)):
        add_cylinder(f"{p}-detail", f"Panel_Dial{index}", (x, 0.78, 0.66),
                     0.095, 0.06, mats["bronze"], 24)

    # Energy: contained light in the seal and the shield.
    add_sphere(f"{p}-energy", "Panel_SealGlow", (0, 1.15, -1.1), 0.2,
               mats["teal_glow"], scale=(1.0, 1.0, 0.3))
    add_sphere(f"{p}-energy", "Panel_ShieldGlow", (0, 0.86, 0.66), 0.17,
               mats["teal_glow"], scale=(1.0, 1.1, 0.28))

    # Front: small stone blocks grounding the maquette.
    add_box(f"{p}-front", "Panel_BlockA", (-1.75, 0.2, 1.12), (0.5, 0.28, 0.42),
            mats["stone_pale"], rotation_y=-12, edge=0.03)
    add_box(f"{p}-front", "Panel_BlockB", (1.72, 0.17, 1.18), (0.42, 0.22, 0.38),
            mats["stone_pale"], rotation_y=9, edge=0.03)


def build_trail(mats: dict) -> None:
    """Trilha Logica: a rising path of stones with bronze milestones."""
    t = "trail"
    add_plinth(t, mats)

    # Back: a modest stone arch closing the route.
    add_box(f"{t}-back", "Trail_ArchL", (1.35, 0.85, -1.25), (0.22, 1.5, 0.26),
            mats["stone_pale"], edge=0.04)
    add_box(f"{t}-back", "Trail_ArchR", (2.15, 0.85, -1.3), (0.22, 1.5, 0.26),
            mats["stone_pale"], edge=0.04)
    add_box(f"{t}-back", "Trail_ArchTop", (1.75, 1.66, -1.28), (1.15, 0.2, 0.3),
            mats["bronze_dark"], edge=0.03)

    # Main: five stepping stones climbing left to right.
    steps = [
        (-1.95, 0.13, 0.95, 0.62),
        (-1.0, 0.28, 0.5, 0.58),
        (-0.05, 0.45, 0.08, 0.55),
        (0.88, 0.63, -0.35, 0.52),
        (1.75, 0.82, -0.8, 0.48),
    ]
    for index, (x, y, z, radius) in enumerate(steps):
        add_cylinder(f"{t}-main", f"Trail_Step{index}", (x, y, z), radius, 0.2,
                     mats["stone_pale"], 32, scale=(1.0, 1.0, 0.78))
        add_torus(f"{t}-main", f"Trail_StepRim{index}", (x, y + 0.11, z),
                  radius * 0.96, 0.028, mats["bronze"], rotation_x=90)

        # Milestone markers: height encodes the sequence, no literal digits.
        add_cylinder(f"{t}-detail", f"Trail_MarkPost{index}", (x + radius * 0.1, y + 0.28 + index * 0.045, z - radius * 0.55),
                     0.045, 0.36 + index * 0.09, mats["bronze_dark"], 14)
        add_sphere(f"{t}-detail", f"Trail_MarkTop{index}",
                   (x + radius * 0.1, y + 0.5 + index * 0.09, z - radius * 0.55), 0.075,
                   mats["teal"] if index % 2 == 0 else mats["amber"])

    # Energy: light pooling along the path.
    for index, (x, y, z, radius) in enumerate(steps):
        add_sphere(f"{t}-energy", f"Trail_Pool{index}", (x, y + 0.12, z), radius * 0.42,
                   mats["teal_glow"], scale=(1.0, 1.0, 0.2))

    # Front: loose pebbles and a low plank bridging two steps.
    add_box(f"{t}-front", "Trail_Plank", (-0.5, 0.4, 0.35), (1.15, 0.07, 0.3),
            mats["wood"], rotation_y=-16, edge=0.02)
    for index, (x, z, r) in enumerate([(-2.3, 1.2, 0.16), (0.35, 1.25, 0.13), (2.15, 1.1, 0.15)]):
        add_sphere(f"{t}-front", f"Trail_Pebble{index}", (x, 0.12, z), r,
                   mats["stone_pale"], scale=(1.2, 0.55, 1.0), segments=16)


def build_garden(mats: dict) -> None:
    """Jardim de Sementes: beds, growth stages, water and warm light."""
    g = "garden"
    add_plinth(g, mats)

    # Back: a low trellis and a warm lantern.
    for index, x in enumerate((-0.6, 0.1, 0.8)):
        add_box(f"{g}-back", f"Garden_TrellisPost{index}", (x, 0.95, -1.3),
                (0.07, 1.7, 0.07), mats["wood"], edge=0.015)
    add_box(f"{g}-back", "Garden_TrellisBar", (0.1, 1.62, -1.3), (1.9, 0.07, 0.07),
            mats["wood"], edge=0.015)
    add_cylinder(f"{g}-back", "Garden_LanternBase", (-2.15, 0.2, -1.1), 0.13, 0.1,
                 mats["bronze"], 20)
    add_cylinder(f"{g}-back", "Garden_LanternGlass", (-2.15, 0.44, -1.1), 0.11, 0.32,
                 mats["amber"], 20)

    # Main: three beds showing the cycle — seed, sprout, bloom.
    beds = [(-1.6, 0.55), (0.05, 0.6), (1.65, 0.55)]
    for index, (x, radius) in enumerate(beds):
        add_cylinder(f"{g}-main", f"Garden_BedRim{index}", (x, 0.2, 0.35), radius, 0.24,
                     mats["wood"], 32)
        add_cylinder(f"{g}-main", f"Garden_BedSoil{index}", (x, 0.3, 0.35), radius * 0.86,
                     0.1, mats["soil"], 32)

    # Stage 1: seeds resting in soil.
    for index, (dx, dz) in enumerate(((-0.16, 0.06), (0.05, -0.1), (0.16, 0.14))):
        add_sphere(f"{g}-detail", f"Garden_Seed{index}", (-1.6 + dx, 0.37, 0.35 + dz),
                   0.075, mats["bronze"], scale=(1.0, 0.7, 1.3), segments=16)

    # Stage 2: a sprout reaching up.
    add_cylinder(f"{g}-detail", "Garden_SproutStem", (0.05, 0.55, 0.35), 0.035, 0.42,
                 mats["leaf_light"], 12)
    for index, angle in enumerate((-40, 55)):
        add_sphere(f"{g}-detail", f"Garden_SproutLeaf{index}",
                   (0.05 + math.sin(math.radians(angle)) * 0.2, 0.7,
                    0.35 + math.cos(math.radians(angle)) * 0.12),
                   0.16, mats["leaf_light"], scale=(1.3, 0.22, 0.7), segments=16)

    # Stage 3: a small plant in bloom.
    add_cylinder(f"{g}-detail", "Garden_PlantStem", (1.65, 0.62, 0.35), 0.05, 0.58,
                 mats["leaf"], 12)
    for index, angle in enumerate((0, 72, 144, 216, 288)):
        add_sphere(f"{g}-detail", f"Garden_PlantLeaf{index}",
                   (1.65 + math.sin(math.radians(angle)) * 0.26, 0.86,
                    0.35 + math.cos(math.radians(angle)) * 0.18),
                   0.19, mats["leaf"], scale=(1.25, 0.2, 0.8), segments=16)
    add_sphere(f"{g}-detail", "Garden_Bloom", (1.65, 1.0, 0.35), 0.13, mats["amber"])

    # Water basin: the care/cycle element.
    add_cylinder(f"{g}-main", "Garden_BasinRim", (-0.02, 0.16, 1.25), 0.46, 0.18,
                 mats["stone_pale"], 32)
    add_cylinder(f"{g}-detail", "Garden_Water", (-0.02, 0.24, 1.25), 0.38, 0.05,
                 mats["water"], 32)

    # Energy: sunlight pools over the beds and a glint on the water.
    for index, (x, radius) in enumerate(beds):
        add_sphere(f"{g}-energy", f"Garden_Sun{index}", (x, 0.38, 0.35), radius * 0.44,
                   mats["amber_glow"], scale=(1.0, 1.0, 0.22))
    add_sphere(f"{g}-energy", "Garden_WaterGlow", (-0.02, 0.28, 1.25), 0.2,
               mats["teal_glow"], scale=(1.0, 1.0, 0.2))

    # Front: ground cover.
    for index, (x, z, sx) in enumerate([(-2.35, 1.15, 0.55), (2.3, 1.05, 0.5)]):
        add_sphere(f"{g}-front", f"Garden_Cover{index}", (x, 0.16, z), 0.26,
                   mats["leaf"], scale=(sx, 0.3, 0.45), segments=16)


WORLDS = {
    "panel": build_commands,
    "trail": build_trail,
    "garden": build_garden,
}


def add_camera_and_lights() -> None:
    """Same 2.5D camera family and light rig as the Route/Circuit dioramas."""
    elevation = math.radians(52)
    distance = 12.0
    bpy.ops.object.camera_add(
        location=(0.0, -math.cos(elevation) * distance, math.sin(elevation) * distance)
    )
    camera = bpy.context.object
    camera.name = "SecondaryWorldCamera"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 8.4
    target = Vector((0.0, 0.35, 0.3))
    camera.rotation_euler = (
        (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    )
    bpy.context.scene.camera = camera

    bpy.ops.object.light_add(type="AREA", location=(-3.8, -4.8, 7.4))
    key = bpy.context.object
    key.data.energy = 620
    key.data.size = 5.6
    key.data.color = (1.0, 0.9, 0.72)

    bpy.ops.object.light_add(type="AREA", location=(4.4, -3.1, 4.6))
    rim = bpy.context.object
    rim.data.energy = 210
    rim.data.size = 3.2
    rim.data.color = (1.0, 0.68, 0.32)

    bpy.ops.object.light_add(type="AREA", location=(-3.8, 2.6, 4.2))
    fill = bpy.context.object
    fill.data.energy = 130
    fill.data.size = 4.5
    fill.data.color = (0.55, 0.85, 1.0)


def configure_render() -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 48
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
    every = [obj for objects in LAYERS.values() for obj in objects if obj.type == "MESH"]

    for suffix in LAYER_SUFFIXES:
        layer = f"{prefix}-{suffix}"
        visible = set(LAYERS.get(layer, []))
        if not visible:
            print(f"Skipping empty layer {layer}")
            continue
        for obj in every:
            obj.hide_render = obj not in visible
        path = out_dir / f"{layer}.png"
        bpy.context.scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        print(f"Rendered {path.name}")


def main() -> None:
    for prefix, builder in WORLDS.items():
        clear_scene()
        LAYERS.clear()
        builder(materials())
        add_camera_and_lights()
        configure_render()
        render_world(prefix)


if __name__ == "__main__":
    main()
