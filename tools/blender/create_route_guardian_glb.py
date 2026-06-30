"""
Generate the premium Rota Estrategica guardian piece asset.

Run from the project root with Blender:
blender --background --python tools/blender/create_route_guardian_glb.py

The script exports:
public/models/route/guardian.glb

Optional preview render:
blender --background --python tools/blender/create_route_guardian_glb.py -- --preview

The guardian is a dark hooded tabletop miniature: a compact enemy character with
a flared cloak, oversized hood silhouette, visible sleeves, amber glowing eyes
and warm hem light. It faces target -Z, is centered on the world origin, sits on
Y = 0, fits inside one 1.0-unit board tile, and uses only procedural materials
(no external textures). It is taller / more imposing than the player but stays a
tabletop piece. It is NOT wired into the game by this script.
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import bpy
from mathutils import Vector


# Babylon's route grid uses 1.0 unit per tile; keep the guardian inside one tile
# so it never covers its neighbours.
TILE_UNIT = 1.0


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def parse_args() -> argparse.Namespace:
    import sys

    script_args = []
    if "--" in sys.argv:
        script_args = sys.argv[sys.argv.index("--") + 1 :]

    parser = argparse.ArgumentParser(description="Create route guardian GLB.")
    parser.add_argument(
        "--output",
        default=str(project_root() / "public" / "models" / "route" / "guardian.glb"),
        help="Output GLB path.",
    )
    parser.add_argument(
        "--preview",
        action="store_true",
        help="Render guardian-preview.png / guardian-preview-top.png after export.",
    )
    parser.add_argument(
        "--preview-output",
        default=str(
            project_root() / "public" / "models" / "route" / "guardian-preview.png"
        ),
        help="Optional 3/4 preview PNG path.",
    )
    parser.add_argument(
        "--top-preview-output",
        default=str(
            project_root()
            / "public"
            / "models"
            / "route"
            / "guardian-preview-top.png"
        ),
        help="Optional top/near-top preview PNG path.",
    )
    return parser.parse_args(script_args)


def target_to_blender(location: tuple[float, float, float]) -> tuple[float, float, float]:
    """Target coordinate system is X width, Y vertical, Z depth.

    Blender is Z-up internally. The glTF exporter converts to Y-up on export so
    the asset arrives in Babylon with Y up and the same X/Z footprint. Front of
    the piece (the hood opening / eyes) faces target -Z (Blender -Y).
    """

    x, y, z = location
    return (x, z, y)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()


def _set_bsdf_input(node: bpy.types.Node, identifier: str, value) -> None:
    """Set a Principled BSDF input by its (locale-independent) identifier.

    Blender socket display names are localised, so a Portuguese (or any
    non-English) Blender exposes e.g. "Cor base" instead of "Base Color". The
    socket `.identifier` stays English, so we match on that.
    """
    for socket in node.inputs:
        if socket.identifier == identifier:
            socket.default_value = value
            return


def make_material(
    name: str,
    color: tuple[float, float, float, float],
    metallic: float,
    roughness: float,
    emission: tuple[float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = next(
        (n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED"),
        None,
    )
    if bsdf:
        _set_bsdf_input(bsdf, "Base Color", color)
        _set_bsdf_input(bsdf, "Metallic", metallic)
        _set_bsdf_input(bsdf, "Roughness", roughness)
        if emission:
            _set_bsdf_input(
                bsdf,
                "Emission Color",
                (emission[0], emission[1], emission[2], 1.0),
            )
            _set_bsdf_input(bsdf, "Emission Strength", emission_strength)
    material.diffuse_color = color
    return material


def create_materials() -> dict[str, bpy.types.Material]:
    """Procedural dark hooded guardian character set with amber trim."""
    return {
        "GuardianBaseDark": make_material(
            "GuardianBaseDark", (0.02, 0.018, 0.015, 1), 0.1, 0.7
        ),
        "GuardianCloakDark": make_material(
            "GuardianCloakDark", (0.065, 0.052, 0.04, 1), 0.0, 0.82
        ),
        "GuardianHoodSoft": make_material(
            "GuardianHoodSoft", (0.11, 0.085, 0.065, 1), 0.0, 0.7
        ),
        "GuardianFaceVoid": make_material(
            "GuardianFaceVoid", (0.006, 0.004, 0.002, 1), 0.0, 0.92
        ),
        "GuardianAmberTrim": make_material(
            "GuardianAmberTrim",
            (0.6, 0.36, 0.12, 1),
            0.75,
            0.32,
            emission=(0.28, 0.13, 0.03),
            emission_strength=0.25,
        ),
        "GuardianEyeGlow": make_material(
            "GuardianEyeGlow",
            (1.0, 0.68, 0.18, 1),
            0.0,
            0.2,
            emission=(1.0, 0.55, 0.08),
            emission_strength=6.5,
        ),
        "GuardianWarmGlow": make_material(
            "GuardianWarmGlow",
            (0.7, 0.42, 0.15, 1),
            0.0,
            0.5,
            emission=(0.6, 0.3, 0.08),
            emission_strength=1.5,
        ),
        "GuardianShadow": make_material(
            "GuardianShadow", (0.01, 0.008, 0.006, 1), 0.0, 1.0
        ),
    }


def add_cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    height: float,
    material: bpy.types.Material,
    vertices: int = 64,
    smooth: bool = False,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=height,
        location=target_to_blender(location),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_Mesh"
    obj.data.materials.append(material)
    if smooth:
        bpy.ops.object.shade_smooth()
    return obj


def add_cone(
    name: str,
    location: tuple[float, float, float],
    radius_bottom: float,
    radius_top: float,
    height: float,
    material: bpy.types.Material,
    vertices: int = 64,
    smooth: bool = True,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius_bottom,
        radius2=radius_top,
        depth=height,
        location=target_to_blender(location),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_Mesh"
    obj.data.materials.append(material)
    if smooth:
        bpy.ops.object.shade_smooth()
    return obj


def add_sphere(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    material: bpy.types.Material,
    target_scale: tuple[float, float, float] = (1.0, 1.0, 1.0),
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
    obj.data.name = f"{name}_Mesh"
    # target_scale is (width, vertical, depth) -> Blender (width, depth, vertical)
    sx, sy, sz = target_scale
    obj.scale = (sx, sz, sy)
    obj.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.shade_smooth()
    return obj


def add_rounded_box(
    name: str,
    location: tuple[float, float, float],
    size: tuple[float, float, float],
    material: bpy.types.Material,
    bevel: float = 0.035,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(
        size=1,
        location=target_to_blender(location),
        rotation=(rotation[0], rotation[2], rotation[1]),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_Mesh"
    sx, sy, sz = size
    obj.dimensions = (sx, sz, sy)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel > 0:
        modifier = obj.modifiers.new(f"{name}_Bevel", "BEVEL")
        modifier.width = bevel
        modifier.segments = 4
        modifier.affect = "EDGES"
        obj.modifiers.new(f"{name}_WeightedNormals", "WEIGHTED_NORMAL")
    return obj


def add_cylinder_between(
    name: str,
    start: tuple[float, float, float],
    end: tuple[float, float, float],
    radius: float,
    material: bpy.types.Material,
    vertices: int = 24,
) -> bpy.types.Object:
    start_v = Vector(target_to_blender(start))
    end_v = Vector(target_to_blender(end))
    midpoint = (start_v + end_v) * 0.5
    direction = end_v - start_v
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=direction.length,
        location=midpoint,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_Mesh"
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return obj


def add_torus(
    name: str,
    location: tuple[float, float, float],
    major: float,
    minor: float,
    material: bpy.types.Material,
    face_front: bool = False,
    major_seg: int = 44,
    minor_seg: int = 14,
) -> bpy.types.Object:
    # Default torus lies flat (hole along vertical). face_front tips it so the
    # hole faces target -Z (Blender -Y) to frame the hood's face opening.
    rotation = (math.pi / 2, 0.0, 0.0) if face_front else (0.0, 0.0, 0.0)
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=major_seg,
        minor_segments=minor_seg,
        location=target_to_blender(location),
        rotation=rotation,
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_Mesh"
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return obj


def build_guardian(materials: dict[str, bpy.types.Material]) -> None:
    """All heights are in target Y (vertical); bottom rests on Y = 0.

    Front (hood opening / eyes) faces target -Z.
    """
    # Subtle baked contact disc (optional, separately named).
    add_cylinder(
        "Guardian_Shadow",
        (0.0, 0.006, 0.0),
        0.33,
        0.012,
        materials["GuardianShadow"],
        vertices=48,
    )
    # Dark plinth, kept compact so the tile hitbox remains visually clear.
    add_cylinder(
        "Guardian_Base",
        (0.0, 0.04, 0.0),
        0.30,
        0.08,
        materials["GuardianBaseDark"],
    )
    add_cylinder(
        "Guardian_Base_Step",
        (0.0, 0.093, 0.0),
        0.245,
        0.02,
        materials["GuardianBaseDark"],
    )
    add_torus(
        "Guardian_Base_Ring",
        (0.0, 0.086, 0.0),
        0.27,
        0.018,
        materials["GuardianWarmGlow"],
    )

    # Flared cloak skirt and torso. It should read as a hooded miniature, not a
    # pawn/cone, while still staying inside one tile.
    add_cone(
        "Guardian_Cloak_Skirt",
        (0.0, 0.31, 0.02),
        0.285,
        0.18,
        0.42,
        materials["GuardianCloakDark"],
    )
    add_sphere(
        "Guardian_Torso",
        (0.0, 0.48, -0.005),
        0.175,
        materials["GuardianCloakDark"],
        target_scale=(0.95, 1.22, 0.72),
        segments=32,
        rings=16,
    )
    add_torus(
        "Guardian_Cloak_Hem",
        (0.0, 0.135, 0.0),
        0.272,
        0.022,
        materials["GuardianWarmGlow"],
    )
    add_torus(
        "Guardian_Belt_Trim",
        (0.0, 0.385, 0.0),
        0.18,
        0.014,
        materials["GuardianAmberTrim"],
    )
    add_rounded_box(
        "Guardian_Belt_Buckle",
        (0.0, 0.385, -0.122),
        (0.055, 0.05, 0.026),
        materials["GuardianAmberTrim"],
        bevel=0.009,
    )

    # Sleeves give the piece a character pose and widen the silhouette just
    # enough to read at gameplay distance.
    add_cylinder_between(
        "Guardian_Sleeve_Left",
        (-0.13, 0.505, -0.01),
        (-0.255, 0.31, -0.04),
        0.046,
        materials["GuardianHoodSoft"],
    )
    add_cylinder_between(
        "Guardian_Sleeve_Right",
        (0.13, 0.505, -0.01),
        (0.255, 0.31, -0.04),
        0.046,
        materials["GuardianHoodSoft"],
    )
    add_sphere(
        "Guardian_Hand_Left",
        (-0.27, 0.295, -0.045),
        0.04,
        materials["GuardianAmberTrim"],
        target_scale=(0.8, 0.8, 0.8),
        segments=18,
        rings=10,
    )
    add_sphere(
        "Guardian_Hand_Right",
        (0.27, 0.295, -0.045),
        0.04,
        materials["GuardianAmberTrim"],
        target_scale=(0.8, 0.8, 0.8),
        segments=18,
        rings=10,
    )

    # Oversized hood: iconic enemy read from 3/4 and top.
    add_sphere(
        "Guardian_Hood",
        (0.0, 0.675, 0.0),
        0.205,
        materials["GuardianHoodSoft"],
        target_scale=(1.05, 1.0, 0.98),
        segments=40,
        rings=18,
    )
    # Back hood mass makes the top view recognisably hooded.
    add_sphere(
        "Guardian_Hood_Back",
        (0.0, 0.635, 0.12),
        0.14,
        materials["GuardianCloakDark"],
        target_scale=(1.16, 0.85, 0.78),
        segments=28,
        rings=12,
    )
    # Face cavity + eyes are lifted to the UPPER-front of the hood so the
    # elevated 3/4 game camera looks straight at the glowing eyes instead of the
    # hood brow occluding them. A larger dark void makes the amber eyes pop.
    add_sphere(
        "Guardian_Face",
        (0.0, 0.765, -0.165),
        0.14,
        materials["GuardianFaceVoid"],
        target_scale=(1.25, 1.05, 0.42),
        segments=28,
        rings=12,
    )
    add_torus(
        "Guardian_Hood_Trim",
        (0.0, 0.775, -0.195),
        0.15,
        0.017,
        materials["GuardianAmberTrim"],
        face_front=True,
    )
    # Brow + eyes: the strongest guardian readability markers — bigger, brighter
    # and raised to the part of the hood the camera actually sees.
    add_rounded_box(
        "Guardian_Brow",
        (0.0, 0.83, -0.2),
        (0.19, 0.03, 0.024),
        materials["GuardianWarmGlow"],
        bevel=0.009,
    )
    # Large, bright eyes placed high on the front of the hood — the part the
    # elevated 3/4 game camera looks straight at — so they read unmistakably as
    # glowing enemy eyes even at gameplay distance and on far cells.
    add_sphere(
        "Guardian_Eye_Left",
        (-0.063, 0.775, -0.216),
        0.058,
        materials["GuardianEyeGlow"],
        target_scale=(1.0, 0.88, 0.66),
        segments=22,
        rings=14,
    )
    add_sphere(
        "Guardian_Eye_Right",
        (0.063, 0.775, -0.216),
        0.058,
        materials["GuardianEyeGlow"],
        target_scale=(1.0, 0.88, 0.66),
        segments=22,
        rings=14,
    )
    add_torus(
        "Guardian_Hood_Collar",
        (0.0, 0.535, -0.015),
        0.17,
        0.017,
        materials["GuardianAmberTrim"],
    )


def point_camera_at(
    camera: bpy.types.Object,
    target: tuple[float, float, float],
) -> None:
    direction = Vector(target) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_preview_camera(
    name: str,
    location: tuple[float, float, float],
    target: tuple[float, float, float],
    ortho_scale: float,
) -> bpy.types.Object:
    bpy.ops.object.camera_add(location=location)
    camera = bpy.context.object
    camera.name = name
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = ortho_scale
    camera.data.lens = 55
    point_camera_at(camera, target)
    return camera


def add_camera_and_lights() -> dict[str, bpy.types.Object]:
    # Dark neutral studio world so the amber trim + eyes read richly.
    world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.045, 0.04, 0.034, 1.0)
        bg.inputs["Strength"].default_value = 1.0

    # Soft warm key for cloak shading + contact shadow.
    bpy.ops.object.light_add(type="AREA", location=(-1.6, -2.1, 2.7))
    key = bpy.context.object
    key.name = "Preview_Key_Light"
    key.data.energy = 55
    key.data.size = 2.4
    key.data.color = (1.0, 0.93, 0.82)

    # Strong warm rim toward the camera/front -> gold glints on the brass trim.
    bpy.ops.object.light_add(type="POINT", location=(1.9, -1.7, 1.6))
    rim = bpy.context.object
    rim.name = "Preview_Warm_Rim_Light"
    rim.data.energy = 22
    rim.data.color = (1.0, 0.7, 0.32)

    # Subtle cool fill to shape the shadow side without flattening the mood.
    bpy.ops.object.light_add(type="POINT", location=(-1.6, 1.2, 0.9))
    fill = bpy.context.object
    fill.name = "Preview_Cool_Fill_Light"
    fill.data.energy = 4
    fill.data.color = (0.6, 0.74, 1.0)

    preview_camera = add_preview_camera(
        "Preview_Camera",
        location=(1.05, -1.45, 0.96),
        target=(0.0, 0.0, 0.49),
        ortho_scale=1.2,
    )
    top_camera = add_preview_camera(
        "Preview_Top_Camera",
        location=(0.0, -0.28, 1.95),
        target=(0.0, 0.0, 0.26),
        ortho_scale=1.02,
    )
    bpy.context.scene.camera = preview_camera
    return {"preview": preview_camera, "top": top_camera}


def configure_scene() -> None:
    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.cycles.samples = 96
    # Standard transform keeps the amber/bronze + eye glow vivid in the preview.
    bpy.context.scene.view_settings.view_transform = "Standard"
    bpy.context.scene.view_settings.look = "None"
    bpy.context.scene.render.resolution_x = 1100
    bpy.context.scene.render.resolution_y = 1100
    bpy.context.scene.render.film_transparent = False


def export_glb(output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output_path),
        export_format="GLB",
        export_yup=True,
        use_selection=False,
        export_materials="EXPORT",
        export_apply=True,
    )


def render_preview(
    output_path: Path,
    camera: bpy.types.Object,
    resolution: tuple[int, int] | None = None,
) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.camera = camera
    if resolution:
        bpy.context.scene.render.resolution_x = resolution[0]
        bpy.context.scene.render.resolution_y = resolution[1]
    bpy.context.scene.render.filepath = str(output_path)
    bpy.ops.render.render(write_still=True)


def main() -> None:
    args = parse_args()
    output_path = Path(args.output).resolve()
    preview_path = Path(args.preview_output).resolve()
    top_preview_path = Path(args.top_preview_output).resolve()

    clear_scene()
    materials = create_materials()
    build_guardian(materials)

    # Export first, while the scene contains ONLY the guardian meshes, so the
    # GLB never embeds the preview cameras / lights.
    export_glb(output_path)
    print(f"Exported {output_path}")

    if args.preview:
        cameras = add_camera_and_lights()
        configure_scene()
        render_preview(preview_path, cameras["preview"], (1100, 1100))
        render_preview(top_preview_path, cameras["top"], (1100, 1100))
        print(f"Rendered {preview_path}")
        print(f"Rendered {top_preview_path}")


if __name__ == "__main__":
    main()
