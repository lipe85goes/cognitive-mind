"""
Generate the official Memory Circuit V2 2.5D runtime kit.

Run from the project root:
  blender --background --python tools/blender/create_memory_circuit_visual_v2.py

All runtime passes share the same camera, lights, resolution and transparent
film. Active passes add only energy, rim and trail accents over the idle board;
they never replace the colored pad surface or its symbol.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = ROOT / "public" / "assets" / "memory-circuit" / "v2"
RES_X, RES_Y = 1280, 1024

PAD_DEFS = {
    "flame": {
        "pos": (0.0, 1.76),
        "base": (0.48, 0.075, 0.045),
        "accent": (0.95, 0.19, 0.075),
        "symbol": (0.98, 0.46, 0.18),
    },
    "wave": {
        "pos": (1.76, 0.0),
        "base": (0.035, 0.20, 0.47),
        "accent": (0.07, 0.47, 0.92),
        "symbol": (0.29, 0.73, 1.0),
    },
    "leaf": {
        "pos": (-1.76, 0.0),
        "base": (0.045, 0.30, 0.13),
        "accent": (0.12, 0.64, 0.25),
        "symbol": (0.42, 0.86, 0.39),
    },
    "sun": {
        "pos": (0.0, -1.76),
        "base": (0.52, 0.29, 0.035),
        "accent": (0.96, 0.58, 0.06),
        "symbol": (1.0, 0.79, 0.28),
    },
}

BASE_OBJECTS: list[bpy.types.Object] = []
STATE_OBJECTS: dict[str, list[bpy.types.Object]] = {
    "flame": [],
    "wave": [],
    "leaf": [],
    "sun": [],
    "core": [],
    "complete": [],
}


def to_blender(location: tuple[float, float, float]) -> tuple[float, float, float]:
    """Target coordinates (X, height, board Y) to Blender Z-up coordinates."""
    x, height, board_y = location
    return (x, board_y, height)


def set_input(node: bpy.types.Node, identifier: str, value) -> None:
    for socket in node.inputs:
        if socket.identifier == identifier:
            socket.default_value = value
            return


def make_material(
    name: str,
    color: tuple[float, float, float],
    metallic: float,
    roughness: float,
    *,
    emission: tuple[float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = next(
        node
        for node in material.node_tree.nodes
        if node.type == "BSDF_PRINCIPLED"
    )
    set_input(bsdf, "Base Color", (*color, 1.0))
    set_input(bsdf, "Metallic", metallic)
    set_input(bsdf, "Roughness", roughness)
    if emission is not None:
        set_input(bsdf, "Emission Color", (*emission, 1.0))
        set_input(bsdf, "Emission Strength", emission_strength)
    material.diffuse_color = (*color, 1.0)
    return material


def make_painted_stone(
    name: str,
    dark: tuple[float, float, float],
    light: tuple[float, float, float],
) -> bpy.types.Material:
    """Stylized painted stone with subtle color and surface variation."""
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    tree = material.node_tree
    bsdf = next(node for node in tree.nodes if node.type == "BSDF_PRINCIPLED")
    texcoord = tree.nodes.new("ShaderNodeTexCoord")
    noise = tree.nodes.new("ShaderNodeTexNoise")
    ramp = tree.nodes.new("ShaderNodeValToRGB")
    bump = tree.nodes.new("ShaderNodeBump")

    set_input(noise, "Scale", 4.2)
    set_input(noise, "Detail", 3.0)
    set_input(noise, "Roughness", 0.62)
    set_input(noise, "Distortion", 0.12)
    ramp.color_ramp.elements[0].position = 0.22
    ramp.color_ramp.elements[0].color = (*dark, 1.0)
    ramp.color_ramp.elements[1].position = 0.78
    ramp.color_ramp.elements[1].color = (*light, 1.0)
    set_input(bump, "Strength", 0.16)
    set_input(bump, "Distance", 0.09)
    set_input(bsdf, "Metallic", 0.02)
    set_input(bsdf, "Roughness", 0.72)

    tree.links.new(texcoord.outputs["Generated"], noise.inputs["Vector"])
    tree.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    tree.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    tree.links.new(noise.outputs["Fac"], bump.inputs["Height"])
    tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    material.diffuse_color = (*light, 1.0)
    return material


def make_aged_metal(
    name: str,
    dark: tuple[float, float, float],
    light: tuple[float, float, float],
    roughness: float,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    tree = material.node_tree
    bsdf = next(node for node in tree.nodes if node.type == "BSDF_PRINCIPLED")
    texcoord = tree.nodes.new("ShaderNodeTexCoord")
    noise = tree.nodes.new("ShaderNodeTexNoise")
    ramp = tree.nodes.new("ShaderNodeValToRGB")

    set_input(noise, "Scale", 7.0)
    set_input(noise, "Detail", 2.0)
    set_input(noise, "Roughness", 0.7)
    ramp.color_ramp.elements[0].position = 0.28
    ramp.color_ramp.elements[0].color = (*dark, 1.0)
    ramp.color_ramp.elements[1].position = 0.76
    ramp.color_ramp.elements[1].color = (*light, 1.0)
    set_input(bsdf, "Metallic", 0.82)
    set_input(bsdf, "Roughness", roughness)

    tree.links.new(texcoord.outputs["Generated"], noise.inputs["Vector"])
    tree.links.new(noise.outputs["Fac"], ramp.inputs["Fac"])
    tree.links.new(ramp.outputs["Color"], bsdf.inputs["Base Color"])
    material.diffuse_color = (*light, 1.0)
    return material


def make_soft_glow(
    name: str,
    color: tuple[float, float, float],
    strength: float,
) -> bpy.types.Material:
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
    ramp.color_ramp.elements[1].position = 0.8
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


def register(
    obj: bpy.types.Object,
    group: str | None = None,
) -> bpy.types.Object:
    if group is None:
        BASE_OBJECTS.append(obj)
    else:
        STATE_OBJECTS[group].append(obj)
    return obj


def add_cylinder(
    name: str,
    location,
    radius: float,
    height: float,
    material,
    group: str | None = None,
    vertices: int = 96,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=height,
        location=to_blender(location),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    return register(obj, group)


def add_torus(
    name: str,
    location,
    major: float,
    minor: float,
    material,
    group: str | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=96,
        minor_segments=20,
        location=to_blender(location),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return register(obj, group)


def add_box(
    name: str,
    location,
    dimensions,
    material,
    group: str | None = None,
    rotation_deg: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=to_blender(location))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (dimensions[0], dimensions[2], dimensions[1])
    obj.rotation_euler[2] = math.radians(rotation_deg)
    obj.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = obj.modifiers.new("SoftEdge", "BEVEL")
    bevel.width = min(dimensions) * 0.18
    bevel.segments = 3
    return register(obj, group)


def add_sphere(
    name: str,
    location,
    radius: float,
    material,
    group: str | None = None,
    scale=(1.0, 1.0, 1.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=48,
        ring_count=24,
        radius=radius,
        location=to_blender(location),
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = (scale[0], scale[2], scale[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return register(obj, group)


def add_ico(
    name: str,
    location,
    radius: float,
    material,
    group: str | None = None,
    scale=(1.0, 1.0, 1.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=2,
        radius=radius,
        location=to_blender(location),
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = (scale[0], scale[2], scale[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    bevel = obj.modifiers.new("CrystalEdges", "BEVEL")
    bevel.width = 0.025
    bevel.segments = 2
    return register(obj, group)


def add_cone(
    name: str,
    location,
    radius1: float,
    radius2: float,
    height: float,
    material,
    group: str | None = None,
    scale=(1.0, 1.0, 1.0),
    rotation_deg: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=48,
        radius1=radius1,
        radius2=radius2,
        depth=height,
        location=to_blender(location),
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = (scale[0], scale[2], scale[1])
    obj.rotation_euler[2] = math.radians(rotation_deg)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    bevel = obj.modifiers.new("SymbolEdge", "BEVEL")
    bevel.width = 0.025
    bevel.segments = 2
    return register(obj, group)


def add_disc_glow(name, location, radius, material, group):
    return add_sphere(
        name,
        location,
        radius,
        material,
        group,
        scale=(1.0, 0.045, 1.0),
    )


def add_curve_path(
    name: str,
    points: list[tuple[float, float]],
    height: float,
    material,
    group: str | None = None,
    *,
    bevel: float = 0.035,
    cyclic: bool = False,
) -> bpy.types.Object:
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = bevel
    curve.bevel_resolution = 3
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, (x, board_y) in zip(spline.points, points):
        point.co = (x, board_y, height, 1.0)
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return register(obj, group)


def build_symbol(
    element: str,
    cx: float,
    cy: float,
    material,
    group: str | None = None,
    suffix: str = "Idle",
) -> None:
    if element == "flame":
        add_curve_path(
            f"SymbolFlameOutline{suffix}",
            [
                (cx, cy - 0.35),
                (cx - 0.22, cy - 0.13),
                (cx - 0.18, cy + 0.08),
                (cx - 0.03, cy + 0.34),
                (cx + 0.03, cy + 0.10),
                (cx + 0.20, cy + 0.25),
                (cx + 0.24, cy - 0.03),
                (cx + 0.12, cy - 0.26),
            ],
            0.225,
            material,
            group,
            bevel=0.046,
            cyclic=True,
        )
        add_curve_path(
            f"SymbolFlameInner{suffix}",
            [
                (cx - 0.01, cy - 0.21),
                (cx - 0.07, cy - 0.06),
                (cx + 0.03, cy + 0.10),
                (cx + 0.11, cy - 0.06),
                (cx + 0.08, cy - 0.20),
            ],
            0.235,
            material,
            group,
            bevel=0.032,
            cyclic=True,
        )
    elif element == "wave":
        for index, offset in enumerate((0.14, -0.12)):
            add_curve_path(
                f"SymbolWave{index}{suffix}",
                [
                    (cx - 0.36, cy + offset),
                    (cx - 0.22, cy + offset + 0.10),
                    (cx - 0.05, cy + offset + 0.10),
                    (cx + 0.09, cy + offset),
                    (cx + 0.23, cy + offset - 0.10),
                    (cx + 0.37, cy + offset - 0.08),
                ],
                0.21,
                material,
                group,
                bevel=0.048,
            )
    elif element == "leaf":
        add_curve_path(
            f"SymbolLeafOutline{suffix}",
            [
                (cx - 0.36, cy - 0.02),
                (cx - 0.20, cy + 0.22),
                (cx + 0.08, cy + 0.29),
                (cx + 0.32, cy + 0.08),
                (cx + 0.22, cy - 0.20),
                (cx - 0.06, cy - 0.28),
            ],
            0.215,
            material,
            group,
            bevel=0.043,
            cyclic=True,
        )
        add_curve_path(
            f"SymbolLeafVein{suffix}",
            [
                (cx - 0.34, cy - 0.20),
                (cx - 0.12, cy - 0.06),
                (cx + 0.08, cy + 0.08),
                (cx + 0.28, cy + 0.22),
            ],
            0.225,
            material,
            group,
            bevel=0.032,
        )
    else:
        add_cylinder(
            f"SymbolSunCore{suffix}",
            (cx, 0.18, cy),
            0.18,
            0.08,
            material,
            group,
            vertices=48,
        )
        for index in range(8):
            angle = index * math.pi / 4
            add_box(
                f"SymbolSunRay{index}{suffix}",
                (
                    cx + math.cos(angle) * 0.31,
                    0.16,
                    cy + math.sin(angle) * 0.31,
                ),
                (0.16, 0.04, 0.055),
                material,
                group,
                rotation_deg=math.degrees(angle),
            )


def build_scene() -> None:
    materials = {
        "body": make_painted_stone(
            "BoardBodyStone",
            (0.03, 0.045, 0.05),
            (0.075, 0.105, 0.11),
        ),
        "top": make_painted_stone(
            "BoardTopStone",
            (0.048, 0.086, 0.096),
            (0.155, 0.235, 0.24),
        ),
        "panel": make_painted_stone(
            "BoardPanelStone",
            (0.075, 0.125, 0.13),
            (0.17, 0.245, 0.235),
        ),
        "bronze": make_aged_metal(
            "AgedBronze",
            (0.16, 0.075, 0.025),
            (0.49, 0.24, 0.07),
            0.38,
        ),
        "bronze_edge": make_aged_metal(
            "PolishedBronzeEdge",
            (0.31, 0.13, 0.035),
            (0.73, 0.43, 0.12),
            0.26,
        ),
        "well": make_material("PadWell", (0.025, 0.045, 0.045), 0.12, 0.76),
        "trail": make_material("TrailIdle", (0.035, 0.22, 0.22), 0.26, 0.36),
        "trail_edge": make_material(
            "TrailBronzeEdge", (0.38, 0.18, 0.055), 0.72, 0.34
        ),
        "gem": make_material(
            "RimGem",
            (0.015, 0.32, 0.44),
            0.05,
            0.18,
            emission=(0.02, 0.24, 0.32),
            emission_strength=0.55,
        ),
        "core_idle": make_material(
            "CoreCrystalIdle",
            (0.08, 0.55, 0.58),
            0.03,
            0.14,
            emission=(0.02, 0.35, 0.38),
            emission_strength=0.58,
        ),
        # CIRCUIT-MASTER-FINAL-01: active/complete crystals keep a deep teal
        # base and restrained emission so the core stays a material object in
        # every state — it must never read as a white/cyan flash.
        "core_active": make_material(
            "CoreCrystalActive",
            (0.10, 0.60, 0.62),
            0.02,
            0.12,
            emission=(0.03, 0.50, 0.48),
            emission_strength=0.85,
        ),
        "core_complete": make_material(
            "CoreCrystalComplete",
            (0.14, 0.66, 0.60),
            0.02,
            0.12,
            emission=(0.08, 0.56, 0.46),
            emission_strength=0.95,
        ),
        "core_glow": make_soft_glow("CoreGlow", (0.05, 0.56, 0.53), 0.5),
        "contact_shadow": make_soft_glow(
            "ContactShadow", (0.025, 0.015, 0.008), 0.42
        ),
    }

    for key, definition in PAD_DEFS.items():
        materials[f"{key}_enamel"] = make_material(
            f"{key.title()}Enamel",
            definition["base"],
            0.18,
            0.34,
            emission=definition["accent"],
            emission_strength=0.07,
        )
        materials[f"{key}_symbol"] = make_material(
            f"{key.title()}Symbol",
            definition["symbol"],
            0.22,
            0.29,
            emission=definition["accent"],
            emission_strength=0.18,
        )
        materials[f"{key}_active"] = make_material(
            f"{key.title()}Active",
            definition["accent"],
            0.12,
            0.24,
            emission=definition["accent"],
            emission_strength=0.42,
        )
        # Restrained pad glow: enough to read "lit" without washing the enamel
        # color during observe/complete (the flame must stay coral, not salmon).
        materials[f"{key}_glow"] = make_soft_glow(
            f"{key.title()}Glow",
            definition["accent"],
            0.42,
        )

    # Contact shadow is rendered as part of the base pass to ground the artifact.
    add_disc_glow(
        "BoardContactShadow",
        (0.0, -0.71, -0.24),
        3.42,
        materials["contact_shadow"],
        None,
    )

    # Layered physical body.
    add_cylinder("BoardLowerBody", (0.0, -0.44, 0.0), 3.12, 0.42, materials["body"])
    add_torus("BoardLowerBronze", (0.0, -0.48, 0.0), 2.98, 0.12, materials["bronze"])
    add_cylinder("BoardUpperBody", (0.0, -0.15, 0.0), 2.98, 0.28, materials["body"])
    add_cylinder("BoardTop", (0.0, 0.015, 0.0), 2.79, 0.08, materials["top"])
    add_torus("BoardOuterRim", (0.0, 0.10, 0.0), 2.90, 0.095, materials["bronze_edge"])
    add_torus("BoardInnerRim", (0.0, 0.085, 0.0), 2.55, 0.038, materials["bronze"])

    # Radial stone panels and physical bronze separators.
    for index in range(12):
        angle = index * 30.0
        radius = 1.72
        x = math.cos(math.radians(angle)) * radius
        y = math.sin(math.radians(angle)) * radius
        add_box(
            f"PanelAccent{index}",
            (x, 0.075, y),
            (1.58, 0.025, 0.018),
            materials["panel"],
            rotation_deg=angle,
        )
        add_box(
            f"RadialInlay{index}",
            (
                math.cos(math.radians(angle)) * 2.02,
                0.11,
                math.sin(math.radians(angle)) * 2.02,
            ),
            (1.25, 0.032, 0.032),
            materials["bronze"],
            rotation_deg=angle,
        )

    for radius in (1.05, 2.12):
        add_torus(
            f"ArcaneRing{int(radius * 100)}",
            (0.0, 0.11, 0.0),
            radius,
            0.026,
            materials["bronze_edge"],
        )

    # Corner gems echo the Home object-world without dominating the board.
    for index in range(4):
        angle = math.pi / 4 + index * math.pi / 2
        x, y = math.cos(angle) * 2.87, math.sin(angle) * 2.87
        add_cylinder(
            f"GemBezel{index}",
            (x, 0.15, y),
            0.16,
            0.08,
            materials["bronze_edge"],
            vertices=8,
        )
        add_ico(
            f"RimGem{index}",
            (x, 0.23, y),
            0.105,
            materials["gem"],
            scale=(1.0, 0.76, 1.0),
        )

    # Core: the heart of the circuit — larger, layered and readable at idle.
    add_cylinder("CoreWell", (0.0, 0.075, 0.0), 0.67, 0.08, materials["well"])
    add_torus("CoreBronzeRing", (0.0, 0.16, 0.0), 0.58, 0.055, materials["bronze_edge"])
    add_cylinder("CorePedestal", (0.0, 0.18, 0.0), 0.42, 0.18, materials["bronze"])
    add_ico(
        "CoreCrystalIdle",
        (0.0, 0.53, 0.0),
        0.34,
        materials["core_idle"],
        scale=(0.92, 1.7, 0.92),
    )

    # Trails: bronze channel + teal glass inlay extending from core to every pad.
    for key, definition in PAD_DEFS.items():
        px, py = definition["pos"]
        ux, uy = px / 1.76, py / 1.76
        angle = math.degrees(math.atan2(uy, ux))
        midpoint = 1.12
        add_box(
            f"TrailChannel{key.title()}",
            (ux * midpoint, 0.105, uy * midpoint),
            (1.13, 0.045, 0.18),
            materials["trail_edge"],
            rotation_deg=angle,
        )
        add_box(
            f"TrailGlass{key.title()}",
            (ux * midpoint, 0.135, uy * midpoint),
            (1.02, 0.028, 0.07),
            materials["trail"],
            rotation_deg=angle,
        )
        for bead_index in range(4):
            distance = 0.68 + bead_index * 0.30
            add_cylinder(
                f"TrailBead{key.title()}{bead_index}",
                (ux * distance, 0.155, uy * distance),
                0.045,
                0.025,
                materials["bronze_edge"],
                vertices=32,
            )

    # Integrated pad wells, enamel and identity symbols.
    for key, definition in PAD_DEFS.items():
        px, py = definition["pos"]
        add_cylinder(f"PadWell{key.title()}", (px, 0.08, py), 0.88, 0.11, materials["well"])
        add_torus(
            f"PadOuterRing{key.title()}",
            (px, 0.15, py),
            0.81,
            0.07,
            materials["bronze_edge"],
        )
        add_torus(
            f"PadInnerRing{key.title()}",
            (px, 0.17, py),
            0.68,
            0.025,
            materials["bronze"],
        )
        add_cylinder(
            f"PadEnamel{key.title()}",
            (px, 0.13, py),
            0.68,
            0.10,
            materials[f"{key}_enamel"],
        )
        build_symbol(
            key,
            px,
            py,
            materials[f"{key}_symbol"],
            suffix="Idle",
        )

        # State pass: colored rim, trail and symbol accent only. The enamel stays
        # in the base image, preventing white clipping and preserving identity.
        add_torus(
            f"PadActiveRing{key.title()}",
            (px, 0.205, py),
            0.76,
            0.055,
            materials[f"{key}_active"],
            key,
        )
        build_symbol(
            key,
            px,
            py,
            materials[f"{key}_active"],
            key,
            suffix="Active",
        )
        add_disc_glow(
            f"PadGlow{key.title()}",
            (px, 0.12, py),
            0.91,
            materials[f"{key}_glow"],
            key,
        )
        ux, uy = px / 1.76, py / 1.76
        angle = math.degrees(math.atan2(uy, ux))
        add_box(
            f"TrailActive{key.title()}",
            (ux * 1.12, 0.175, uy * 1.12),
            (1.03, 0.035, 0.075),
            materials[f"{key}_active"],
            key,
            rotation_deg=angle,
        )
        for bead_index in range(4):
            distance = 0.68 + bead_index * 0.30
            add_sphere(
                f"EnergyBead{key.title()}{bead_index}",
                (ux * distance, 0.205, uy * distance),
                0.055,
                materials[f"{key}_active"],
                key,
            )

    # Core state passes. The state crystals sit exactly over the idle crystal
    # (slightly larger so no idle fringe peeks out), and the glow discs stay
    # inside the bronze ring so the pedestal keeps reading as a real object.
    add_ico(
        "CoreCrystalActive",
        (0.0, 0.53, 0.0),
        0.345,
        materials["core_active"],
        "core",
        scale=(0.92, 1.7, 0.92),
    )
    add_torus(
        "CoreActiveRing",
        (0.0, 0.22, 0.0),
        0.54,
        0.045,
        materials["core_active"],
        "core",
    )
    add_disc_glow(
        "CoreActiveGlow",
        (0.0, 0.29, 0.0),
        0.6,
        materials["core_glow"],
        "core",
    )

    add_ico(
        "CoreCrystalComplete",
        (0.0, 0.53, 0.0),
        0.35,
        materials["core_complete"],
        "complete",
        scale=(0.92, 1.7, 0.92),
    )
    add_torus(
        "CoreCompleteRing",
        (0.0, 0.22, 0.0),
        0.56,
        0.05,
        materials["core_complete"],
        "complete",
    )
    add_disc_glow(
        "CoreCompleteGlow",
        (0.0, 0.30, 0.0),
        0.64,
        materials["core_glow"],
        "complete",
    )


def add_camera_and_lights() -> bpy.types.Object:
    elevation = math.radians(54)
    distance = 11.4
    bpy.ops.object.camera_add(
        location=(0.0, -math.cos(elevation) * distance, math.sin(elevation) * distance)
    )
    camera = bpy.context.object
    camera.name = "MemoryCircuitCamera"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 7.35
    target = Vector((0.0, 0.20, 0.05))
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = camera

    bpy.ops.object.light_add(type="AREA", location=(-3.8, -4.0, 7.2))
    key = bpy.context.object
    key.data.energy = 640
    key.data.size = 5.6
    key.data.color = (1.0, 0.83, 0.62)

    bpy.ops.object.light_add(type="AREA", location=(3.7, -2.4, 5.3))
    fill = bpy.context.object
    fill.data.energy = 250
    fill.data.size = 5.2
    fill.data.color = (0.63, 0.86, 0.92)

    bpy.ops.object.light_add(type="AREA", location=(0.0, 4.2, 5.0))
    rim = bpy.context.object
    rim.data.energy = 310
    rim.data.size = 4.0
    rim.data.color = (0.97, 0.51, 0.24)
    return camera


def configure_render() -> None:
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.film_transparent = True
    scene.render.resolution_x = RES_X
    scene.render.resolution_y = RES_Y
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "WEBP"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.image_settings.quality = 84
    scene.view_settings.look = "AgX - Medium High Contrast"
    scene.render.filepath = str(OUT_DIR / "memory-board.webp")


def render_pass(path: Path, visible: set[bpy.types.Object]) -> None:
    all_objects = BASE_OBJECTS + [
        obj for objects in STATE_OBJECTS.values() for obj in objects
    ]
    for obj in all_objects:
        obj.hide_render = obj not in visible
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {path.name}")


def print_hitboxes(camera: bpy.types.Object) -> None:
    scene = bpy.context.scene
    print("=== MEMORY CIRCUIT V2 HITBOXES ===")
    for key, definition in PAD_DEFS.items():
        x, y = definition["pos"]
        center = world_to_camera_view(scene, camera, Vector(to_blender((x, 0.18, y))))
        edge = world_to_camera_view(
            scene,
            camera,
            Vector(to_blender((x + 0.88, 0.18, y))),
        )
        radius = abs(edge.x - center.x) * 100
        print(
            f"{key}: x={center.x * 100:.1f}% "
            f"y={(1.0 - center.y) * 100:.1f}% size={radius * 2:.1f}%"
        )


def main() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    build_scene()
    camera = add_camera_and_lights()
    configure_render()

    render_pass(OUT_DIR / "memory-board.webp", set(BASE_OBJECTS))
    for key in ("flame", "wave", "leaf", "sun"):
        render_pass(
            OUT_DIR / f"overlay-{key}.webp",
            set(STATE_OBJECTS[key]),
        )
    render_pass(OUT_DIR / "overlay-core.webp", set(STATE_OBJECTS["core"]))
    render_pass(
        OUT_DIR / "overlay-complete.webp",
        set(
            STATE_OBJECTS["complete"]
            + STATE_OBJECTS["flame"]
            + STATE_OBJECTS["wave"]
            + STATE_OBJECTS["leaf"]
            + STATE_OBJECTS["sun"]
        ),
    )
    print_hitboxes(camera)


if __name__ == "__main__":
    main()
