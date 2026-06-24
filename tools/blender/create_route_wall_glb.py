"""
Generate the premium Rota Estrategica wall / obstacle asset.

Run from the project root with Blender:
blender --background --python tools/blender/create_route_wall_glb.py

The script exports:
public/models/route/wall.glb

Optional preview render:
blender --background --python tools/blender/create_route_wall_glb.py -- --preview

The wall is a single, self-contained tabletop obstacle: a tapered dark-stone
body on a wider plinth, wrapped with aged-brass bands and a raised brass cap,
with small warm rivets. It is centered on the world origin, sits on Y = 0, fits
roughly within one 1.0-unit board tile, and uses only procedural materials (no
external textures). It is NOT wired into the game by this script.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import bpy
from mathutils import Vector


# Babylon's route grid uses 1.0 unit per tile; keep the wall comfortably inside
# one tile so it never covers its neighbours.
TILE_UNIT = 1.0


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def parse_args() -> argparse.Namespace:
    import sys

    script_args = []
    if "--" in sys.argv:
        script_args = sys.argv[sys.argv.index("--") + 1 :]

    parser = argparse.ArgumentParser(description="Create route wall GLB.")
    parser.add_argument(
        "--output",
        default=str(project_root() / "public" / "models" / "route" / "wall.glb"),
        help="Output GLB path.",
    )
    parser.add_argument(
        "--preview",
        action="store_true",
        help="Render wall-preview.png / wall-preview-top.png after export.",
    )
    parser.add_argument(
        "--preview-output",
        default=str(
            project_root() / "public" / "models" / "route" / "wall-preview.png"
        ),
        help="Optional 3/4 preview PNG path.",
    )
    parser.add_argument(
        "--top-preview-output",
        default=str(
            project_root() / "public" / "models" / "route" / "wall-preview-top.png"
        ),
        help="Optional top/near-top preview PNG path.",
    )
    return parser.parse_args(script_args)


def target_to_blender(location: tuple[float, float, float]) -> tuple[float, float, float]:
    """Target coordinate system is X width, Y vertical, Z depth.

    Blender is Z-up internally. The glTF exporter converts to Y-up on export so
    the asset arrives in Babylon with Y up and the same X/Z footprint.
    """

    x, y, z = location
    return (x, z, y)


def dimensions_to_blender(
    dimensions: tuple[float, float, float],
) -> tuple[float, float, float]:
    width, height, depth = dimensions
    return (width, depth, height)


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
    """Procedural dark-fantasy stone + aged brass set (no external textures)."""
    return {
        "WallDarkStone": make_material(
            "WallDarkStone", (0.085, 0.078, 0.07, 1), 0.04, 0.88
        ),
        "WallSideStone": make_material(
            "WallSideStone", (0.11, 0.105, 0.098, 1), 0.04, 0.84
        ),
        "AgedBrass": make_material(
            "AgedBrass", (0.6, 0.39, 0.15, 1), 0.7, 0.33
        ),
        "DeepShadow": make_material(
            "DeepShadow", (0.02, 0.016, 0.013, 1), 0.0, 0.95
        ),
        "WallEdgeHighlight": make_material(
            "WallEdgeHighlight",
            (0.78, 0.56, 0.26, 1),
            0.6,
            0.25,
            emission=(0.4, 0.24, 0.08),
            emission_strength=0.14,
        ),
        "WarmRivet": make_material(
            "WarmRivet",
            (0.92, 0.66, 0.28, 1),
            0.55,
            0.26,
            emission=(0.42, 0.22, 0.06),
            emission_strength=0.16,
        ),
    }


def _add_bevel(obj: bpy.types.Object, name: str, width: float) -> None:
    if width <= 0:
        return
    bevel_modifier = obj.modifiers.new(f"{name}_Bevel", "BEVEL")
    bevel_modifier.width = width
    bevel_modifier.segments = 2
    bevel_modifier.affect = "EDGES"
    normal_modifier = obj.modifiers.new(f"{name}_WeightedNormals", "WEIGHTED_NORMAL")
    normal_modifier.keep_sharp = True


def add_box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    material: bpy.types.Material,
    bevel: float = 0.02,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=target_to_blender(location))
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_Mesh"
    obj.dimensions = dimensions_to_blender(dimensions)
    obj.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    _add_bevel(obj, name, bevel)
    return obj


def add_tapered_box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    material: bpy.types.Material,
    top_scale: float,
    bevel: float = 0.04,
) -> bpy.types.Object:
    """A box whose top face is scaled in by `top_scale` (a frustum/taper)."""
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=target_to_blender(location))
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_Mesh"
    obj.dimensions = dimensions_to_blender(dimensions)
    obj.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    mesh = obj.data
    max_z = max(v.co.z for v in mesh.vertices)
    for vertex in mesh.vertices:
        if abs(vertex.co.z - max_z) < 1e-4:
            vertex.co.x *= top_scale
            vertex.co.y *= top_scale
    mesh.update()

    _add_bevel(obj, name, bevel)
    return obj


def add_rivet(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=radius,
        segments=16,
        ring_count=10,
        location=target_to_blender(location),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_Mesh"
    obj.data.materials.append(material)
    bpy.ops.object.shade_smooth()
    return obj


def build_wall(materials: dict[str, bpy.types.Material]) -> None:
    """All heights are in target Y (vertical); bottom rests on Y = 0."""
    # Wider stone plinth so the block sits naturally on its tile.
    add_box(
        "Wall_Base",
        (0.0, 0.05, 0.0),
        (0.84, 0.10, 0.84),
        materials["WallSideStone"],
        bevel=0.025,
    )
    # Dark recess line between plinth and body (reads as a seam shadow).
    add_box(
        "Wall_Seam",
        (0.0, 0.105, 0.0),
        (0.70, 0.03, 0.70),
        materials["DeepShadow"],
        bevel=0.004,
    )
    # Tapered dark-stone main body.
    add_tapered_box(
        "Wall_Body",
        (0.0, 0.29, 0.0),
        (0.70, 0.38, 0.70),
        materials["WallDarkStone"],
        top_scale=0.80,
        bevel=0.05,
    )
    # Aged-brass strap near the base.
    add_box(
        "Wall_Trim_Lower",
        (0.0, 0.155, 0.0),
        (0.76, 0.05, 0.76),
        materials["AgedBrass"],
        bevel=0.012,
    )
    # Aged-brass strap under the cap.
    add_box(
        "Wall_Trim_Upper",
        (0.0, 0.44, 0.0),
        (0.62, 0.05, 0.62),
        materials["AgedBrass"],
        bevel=0.012,
    )
    # Raised brass cap.
    add_box(
        "Wall_Top_Cap",
        (0.0, 0.53, 0.0),
        (0.55, 0.10, 0.55),
        materials["AgedBrass"],
        bevel=0.026,
    )
    # Subtle bright crown highlight on the cap.
    add_box(
        "Wall_Cap_Crown",
        (0.0, 0.59, 0.0),
        (0.45, 0.025, 0.45),
        materials["WallEdgeHighlight"],
        bevel=0.006,
    )
    # Four warm rivets / bolt heads, one centered on each side face of the body.
    body_half = 0.70 * 0.90 / 2  # body half-width near mid-height (~0.315)
    rivet_y = 0.30
    rivet_radius = 0.036
    for label, (x, z) in {
        "Front": (0.0, body_half),
        "Back": (0.0, -body_half),
        "Left": (-body_half, 0.0),
        "Right": (body_half, 0.0),
    }.items():
        add_rivet(
            f"Wall_Rivet_{label}",
            (x, rivet_y, z),
            rivet_radius,
            materials["WarmRivet"],
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
    # Warm dim studio world for a soft ambient + a little for metals to catch.
    world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.06, 0.055, 0.048, 1.0)
        bg.inputs["Strength"].default_value = 1.0

    # Soft warm key for stone shading + contact shadows.
    bpy.ops.object.light_add(type="AREA", location=(-1.7, -2.1, 2.7))
    key = bpy.context.object
    key.name = "Preview_Key_Light"
    key.data.energy = 60
    key.data.size = 2.4
    key.data.color = (1.0, 0.95, 0.88)

    # Strong-ish warm rim toward the camera side -> gold glints on the brass.
    bpy.ops.object.light_add(type="POINT", location=(1.9, -1.6, 1.6))
    rim = bpy.context.object
    rim.name = "Preview_Warm_Rim_Light"
    rim.data.energy = 22
    rim.data.color = (1.0, 0.72, 0.34)

    # Subtle cool fill to shape the shadow side.
    bpy.ops.object.light_add(type="POINT", location=(-1.6, 1.2, 0.9))
    fill = bpy.context.object
    fill.name = "Preview_Cool_Fill_Light"
    fill.data.energy = 5
    fill.data.color = (0.62, 0.78, 1.0)

    preview_camera = add_preview_camera(
        "Preview_Camera",
        location=(1.15, -1.35, 1.02),
        target=(0.0, 0.0, 0.28),
        ortho_scale=1.55,
    )
    top_camera = add_preview_camera(
        "Preview_Top_Camera",
        location=(0.0, -0.18, 2.0),
        target=(0.0, 0.0, 0.16),
        ortho_scale=1.18,
    )
    bpy.context.scene.camera = preview_camera
    return {"preview": preview_camera, "top": top_camera}


def configure_scene() -> None:
    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.cycles.samples = 96
    # Standard transform keeps the stone/brass colours vivid in the preview.
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
    build_wall(materials)

    # Export first, while the scene contains ONLY the wall meshes, so the GLB
    # never embeds the preview cameras / lights / softbox planes.
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
