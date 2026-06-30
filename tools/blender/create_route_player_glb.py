"""
Generate the premium Rota Estrategica player pawn asset.

Run from the project root with Blender:
blender --background --python tools/blender/create_route_player_glb.py

The script exports:
public/models/route/player.glb

Optional preview render:
blender --background --python tools/blender/create_route_player_glb.py -- --preview

The player is a friendly premium tabletop miniature: a small blue character with
an oversized head, stylized hair, simple body, arms, boots and a cyan identity
base. It is centered on the world origin, sits on Y = 0, fits comfortably inside
one 1.0-unit board tile, and uses only procedural materials (no external
textures). It is NOT wired into the game by this script.
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import bpy
from mathutils import Vector


# Babylon's route grid uses 1.0 unit per tile; keep the pawn comfortably inside
# one tile so it never covers walls or the portal.
TILE_UNIT = 1.0


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def parse_args() -> argparse.Namespace:
    import sys

    script_args = []
    if "--" in sys.argv:
        script_args = sys.argv[sys.argv.index("--") + 1 :]

    parser = argparse.ArgumentParser(description="Create route player GLB.")
    parser.add_argument(
        "--output",
        default=str(project_root() / "public" / "models" / "route" / "player.glb"),
        help="Output GLB path.",
    )
    parser.add_argument(
        "--preview",
        action="store_true",
        help="Render player-preview.png / player-preview-top.png after export.",
    )
    parser.add_argument(
        "--preview-output",
        default=str(
            project_root() / "public" / "models" / "route" / "player-preview.png"
        ),
        help="Optional 3/4 preview PNG path.",
    )
    parser.add_argument(
        "--top-preview-output",
        default=str(
            project_root() / "public" / "models" / "route" / "player-preview-top.png"
        ),
        help="Optional top/near-top preview PNG path.",
    )
    return parser.parse_args(script_args)


def target_to_blender(location: tuple[float, float, float]) -> tuple[float, float, float]:
    """Target coordinate system is X width, Y vertical, Z depth.

    Blender is Z-up internally. The glTF exporter converts to Y-up on export so
    the asset arrives in Babylon with Y up and the same X/Z footprint. Front of
    the piece faces target -Z (Blender -Y).
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
    """Procedural friendly blue character set (no external textures)."""
    return {
        "PlayerBaseDark": make_material(
            "PlayerBaseDark", (0.035, 0.05, 0.06, 1), 0.2, 0.55
        ),
        "PlayerSuitBlue": make_material(
            "PlayerSuitBlue", (0.025, 0.23, 0.42, 1), 0.05, 0.42
        ),
        "PlayerSuitTrim": make_material(
            "PlayerSuitTrim",
            (0.04, 0.48, 0.72, 1),
            0.0,
            0.36,
            emission=(0.02, 0.18, 0.28),
            emission_strength=0.28,
        ),
        "PlayerSkin": make_material(
            "PlayerSkin", (0.93, 0.64, 0.43, 1), 0.0, 0.46
        ),
        "PlayerHairBlue": make_material(
            "PlayerHairBlue",
            (0.0, 0.44, 0.68, 1),
            0.0,
            0.34,
            emission=(0.0, 0.07, 0.12),
            emission_strength=0.22,
        ),
        "PlayerEyeDark": make_material(
            "PlayerEyeDark", (0.015, 0.024, 0.032, 1), 0.0, 0.25
        ),
        "PlayerBootDark": make_material(
            "PlayerBootDark", (0.025, 0.045, 0.07, 1), 0.08, 0.48
        ),
        "PlayerGoldBuckle": make_material(
            "PlayerGoldBuckle",
            (0.9, 0.56, 0.2, 1),
            0.65,
            0.32,
            emission=(0.22, 0.1, 0.02),
            emission_strength=0.18,
        ),
        "PlayerCyanGlow": make_material(
            "PlayerCyanGlow",
            (0.06, 0.45, 0.52, 1),
            0.0,
            0.34,
            emission=(0.04, 0.55, 0.65),
            emission_strength=1.7,
        ),
        "PlayerCyanCore": make_material(
            "PlayerCyanCore",
            (0.55, 0.95, 1.0, 1),
            0.0,
            0.18,
            emission=(0.45, 0.92, 1.0),
            emission_strength=3.4,
        ),
        "PlayerGlassHighlight": make_material(
            "PlayerGlassHighlight",
            (0.75, 0.95, 1.0, 1),
            0.0,
            0.08,
            emission=(0.3, 0.62, 0.72),
            emission_strength=0.7,
        ),
        "PlayerShadow": make_material(
            "PlayerShadow", (0.012, 0.014, 0.016, 1), 0.0, 1.0
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
    # hole faces target -Z (Blender -Y), e.g. to frame a face opening.
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


def build_player(materials: dict[str, bpy.types.Material]) -> None:
    """All heights are in target Y (vertical); bottom rests on Y = 0.

    Front / face points toward target -Z.
    """
    # Subtle baked contact disc (optional, separately named so integration can
    # drop it if Babylon supplies its own shadows).
    add_cylinder(
        "Player_Shadow",
        (0.0, 0.006, 0.0),
        0.31,
        0.012,
        materials["PlayerShadow"],
        vertices=48,
    )
    # Small tabletop base: still a game piece, but no longer only a pawn.
    add_cylinder(
        "Player_Base",
        (0.0, 0.04, 0.0),
        0.27,
        0.07,
        materials["PlayerBaseDark"],
    )
    add_cylinder(
        "Player_Base_Step",
        (0.0, 0.083, 0.0),
        0.218,
        0.02,
        materials["PlayerBaseDark"],
    )
    add_torus(
        "Player_Base_Ring",
        (0.0, 0.078, 0.0),
        0.237,
        0.016,
        materials["PlayerCyanGlow"],
    )

    # Boots and legs. The footprint remains inside a single tile.
    add_rounded_box(
        "Player_Boot_Left",
        (-0.075, 0.125, -0.02),
        (0.105, 0.085, 0.17),
        materials["PlayerBootDark"],
        bevel=0.025,
    )
    add_rounded_box(
        "Player_Boot_Right",
        (0.075, 0.125, -0.02),
        (0.105, 0.085, 0.17),
        materials["PlayerBootDark"],
        bevel=0.025,
    )
    add_cylinder_between(
        "Player_Leg_Left",
        (-0.065, 0.165, 0.0),
        (-0.07, 0.32, 0.0),
        0.038,
        materials["PlayerSuitBlue"],
    )
    add_cylinder_between(
        "Player_Leg_Right",
        (0.065, 0.165, 0.0),
        (0.07, 0.32, 0.0),
        0.038,
        materials["PlayerSuitBlue"],
    )

    # Compact blue suit torso with a readable front at -Z.
    add_sphere(
        "Player_Torso",
        (0.0, 0.405, 0.0),
        0.17,
        materials["PlayerSuitBlue"],
        target_scale=(0.92, 1.18, 0.72),
        segments=32,
        rings=16,
    )
    add_rounded_box(
        "Player_Chest_Panel",
        (0.0, 0.43, -0.108),
        (0.14, 0.16, 0.025),
        materials["PlayerSuitTrim"],
        bevel=0.018,
    )
    add_rounded_box(
        "Player_Belt",
        (0.0, 0.305, -0.005),
        (0.25, 0.038, 0.18),
        materials["PlayerBootDark"],
        bevel=0.012,
    )
    add_rounded_box(
        "Player_Belt_Buckle",
        (0.0, 0.31, -0.105),
        (0.055, 0.045, 0.028),
        materials["PlayerGoldBuckle"],
        bevel=0.01,
    )

    # Arms use simple cylinder capsules; readable but not over-detailed.
    add_cylinder_between(
        "Player_Arm_Left",
        (-0.13, 0.47, -0.005),
        (-0.245, 0.34, -0.045),
        0.034,
        materials["PlayerSuitBlue"],
    )
    add_cylinder_between(
        "Player_Arm_Right",
        (0.13, 0.47, -0.005),
        (0.245, 0.34, -0.045),
        0.034,
        materials["PlayerSuitBlue"],
    )
    add_sphere(
        "Player_Hand_Left",
        (-0.255, 0.325, -0.05),
        0.045,
        materials["PlayerSkin"],
        target_scale=(0.9, 0.9, 0.9),
        segments=20,
        rings=12,
    )
    add_sphere(
        "Player_Hand_Right",
        (0.255, 0.325, -0.05),
        0.045,
        materials["PlayerSkin"],
        target_scale=(0.9, 0.9, 0.9),
        segments=20,
        rings=12,
    )

    # Oversized friendly head: strongest change versus the old pawn.
    add_sphere(
        "Player_Head",
        (0.0, 0.64, -0.01),
        0.155,
        materials["PlayerSkin"],
        target_scale=(0.95, 1.05, 0.9),
        segments=40,
        rings=18,
    )
    add_sphere(
        "Player_Eye_Left",
        (-0.055, 0.655, -0.145),
        0.019,
        materials["PlayerEyeDark"],
        target_scale=(1.0, 1.0, 0.42),
        segments=16,
        rings=8,
    )
    add_sphere(
        "Player_Eye_Right",
        (0.055, 0.655, -0.145),
        0.019,
        materials["PlayerEyeDark"],
        target_scale=(1.0, 1.0, 0.42),
        segments=16,
        rings=8,
    )

    # Blue stylized hair masses: visible from 3/4 and top cameras.
    add_sphere(
        "Player_Hair_Cap",
        (0.0, 0.725, 0.005),
        0.165,
        materials["PlayerHairBlue"],
        target_scale=(1.04, 0.72, 0.98),
        segments=32,
        rings=14,
    )
    add_sphere(
        "Player_Hair_Front",
        (-0.045, 0.725, -0.13),
        0.075,
        materials["PlayerHairBlue"],
        target_scale=(1.45, 0.82, 0.68),
        segments=24,
        rings=12,
    )
    add_sphere(
        "Player_Hair_Left",
        (-0.13, 0.695, -0.035),
        0.075,
        materials["PlayerHairBlue"],
        target_scale=(0.78, 1.0, 0.78),
        segments=24,
        rings=12,
    )
    add_sphere(
        "Player_Hair_Right",
        (0.13, 0.695, -0.035),
        0.075,
        materials["PlayerHairBlue"],
        target_scale=(0.78, 1.0, 0.78),
        segments=24,
        rings=12,
    )
    add_sphere(
        "Player_Hair_Back",
        (0.0, 0.69, 0.13),
        0.075,
        materials["PlayerHairBlue"],
        target_scale=(1.35, 0.85, 0.75),
        segments=24,
        rings=12,
    )

    # Small cyan crest and collar keep the old blue identity but no longer define
    # the whole asset.
    add_torus(
        "Player_Collar",
        (0.0, 0.515, 0.0),
        0.105,
        0.015,
        materials["PlayerGlassHighlight"],
    )
    add_sphere(
        "Player_Crest",
        (0.0, 0.825, -0.025),
        0.035,
        materials["PlayerCyanCore"],
        target_scale=(1.0, 0.85, 1.0),
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
    # Dark neutral studio world so the cyan emission reads richly.
    world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.035, 0.04, 0.05, 1.0)
        bg.inputs["Strength"].default_value = 1.0

    # Soft cool-neutral key for body shading + contact shadow.
    bpy.ops.object.light_add(type="AREA", location=(-1.5, -2.0, 2.6))
    key = bpy.context.object
    key.name = "Preview_Key_Light"
    key.data.energy = 48
    key.data.size = 2.4
    key.data.color = (0.86, 0.95, 1.0)

    # Cyan rim toward the camera side -> glassy highlights pop.
    bpy.ops.object.light_add(type="POINT", location=(1.8, -1.5, 1.4))
    rim = bpy.context.object
    rim.name = "Preview_Cyan_Rim_Light"
    rim.data.energy = 16
    rim.data.color = (0.4, 0.85, 1.0)

    # Subtle warm fill to keep the dark base from going pure black.
    bpy.ops.object.light_add(type="POINT", location=(-1.5, 1.1, 0.8))
    fill = bpy.context.object
    fill.name = "Preview_Warm_Fill_Light"
    fill.data.energy = 4
    fill.data.color = (1.0, 0.85, 0.66)

    preview_camera = add_preview_camera(
        "Preview_Camera",
        location=(1.05, -1.25, 0.95),
        target=(0.0, 0.0, 0.33),
        ortho_scale=1.05,
    )
    top_camera = add_preview_camera(
        "Preview_Top_Camera",
        location=(0.0, -0.22, 1.85),
        target=(0.0, 0.0, 0.2),
        ortho_scale=0.92,
    )
    bpy.context.scene.camera = preview_camera
    return {"preview": preview_camera, "top": top_camera}


def configure_scene() -> None:
    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.cycles.samples = 96
    # Standard transform keeps the teal/cyan emission vivid in the preview.
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
    build_player(materials)

    # Export first, while the scene contains ONLY the pawn meshes, so the GLB
    # never embeds the preview cameras / lights.
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
