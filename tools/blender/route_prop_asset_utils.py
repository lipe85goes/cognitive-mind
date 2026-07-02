"""Shared Blender helpers for Rota Estrategica gameplay prop assets.

All helpers use the route asset contract:
- target coordinates are X width, Y vertical, Z depth
- exported glTF is Y-up
- assets are centered on X/Z and rest on local Y = 0
- no external texture dependencies
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import bpy
from mathutils import Vector


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def parse_prop_args(asset_name: str, description: str) -> argparse.Namespace:
    import sys

    script_args = []
    if "--" in sys.argv:
        script_args = sys.argv[sys.argv.index("--") + 1 :]

    route_dir = project_root() / "public" / "models" / "route"
    parser = argparse.ArgumentParser(description=description)
    parser.add_argument(
        "--output",
        default=str(route_dir / f"{asset_name}.glb"),
        help="Output GLB path.",
    )
    parser.add_argument(
        "--preview",
        action="store_true",
        help=f"Render {asset_name}-preview.png / {asset_name}-preview-top.png.",
    )
    parser.add_argument(
        "--preview-output",
        default=str(route_dir / f"{asset_name}-preview.png"),
        help="Optional 3/4 preview PNG path.",
    )
    parser.add_argument(
        "--top-preview-output",
        default=str(route_dir / f"{asset_name}-preview-top.png"),
        help="Optional top/near-top preview PNG path.",
    )
    return parser.parse_args(script_args)


def target_to_blender(location: tuple[float, float, float]) -> tuple[float, float, float]:
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
        (node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"),
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


def add_bevel(obj: bpy.types.Object, name: str, width: float, segments: int = 3) -> None:
    if width <= 0:
        return
    bevel = obj.modifiers.new(f"{name}_Bevel", "BEVEL")
    bevel.width = width
    bevel.segments = segments
    bevel.affect = "EDGES"
    normal = obj.modifiers.new(f"{name}_WeightedNormals", "WEIGHTED_NORMAL")
    normal.keep_sharp = True


def add_box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    material: bpy.types.Material,
    bevel: float = 0.02,
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
    obj.dimensions = dimensions_to_blender(dimensions)
    obj.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    add_bevel(obj, name, bevel)
    return obj


def add_cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    height: float,
    material: bpy.types.Material,
    vertices: int = 48,
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
    obj.data.name = f"{name}_Mesh"
    obj.data.materials.append(material)
    if smooth:
        bpy.ops.object.shade_smooth()
    return obj


def add_cone(
    name: str,
    location: tuple[float, float, float],
    radius1: float,
    radius2: float,
    height: float,
    material: bpy.types.Material,
    vertices: int = 32,
    smooth: bool = True,
    rotation: tuple[float, float, float] = (0.0, 0.0, 0.0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius1,
        radius2=radius2,
        depth=height,
        location=target_to_blender(location),
        rotation=(rotation[0], rotation[2], rotation[1]),
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
    sx, sy, sz = target_scale
    obj.scale = (sx, sz, sy)
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
    major_seg: int = 56,
    minor_seg: int = 14,
) -> bpy.types.Object:
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


def add_flat_prism(
    name: str,
    center: tuple[float, float, float],
    points_xy: list[tuple[float, float]],
    thickness: float,
    material: bpy.types.Material,
) -> bpy.types.Object:
    """Create an extruded front-facing flat shape.

    `points_xy` are local target X/Y coordinates; extrusion happens along target
    Z so the shape faces target -Z.
    """

    cx, cy, cz = center
    front = [(cx + x, cy + y, cz - thickness / 2) for x, y in points_xy]
    back = [(cx + x, cy + y, cz + thickness / 2) for x, y in points_xy]
    vertices = [target_to_blender(v) for v in front + back]
    count = len(points_xy)
    faces: list[tuple[int, ...]] = [tuple(range(count)), tuple(range(count, count * 2))]
    for index in range(count):
        faces.append(
            (
                index,
                (index + 1) % count,
                count + ((index + 1) % count),
                count + index,
            )
        )

    mesh = bpy.data.meshes.new(f"{name}_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    add_bevel(obj, name, 0.015, segments=2)
    return obj


def point_camera_at(camera: bpy.types.Object, target: tuple[float, float, float]) -> None:
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


def add_camera_and_lights(
    world_color: tuple[float, float, float, float] = (0.045, 0.04, 0.034, 1.0),
    preview_ortho_scale: float = 1.45,
    top_ortho_scale: float = 1.18,
    target: tuple[float, float, float] = (0.0, 0.0, 0.32),
) -> dict[str, bpy.types.Object]:
    world = bpy.data.worlds.get("World") or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = world_color
        bg.inputs["Strength"].default_value = 1.0

    bpy.ops.object.light_add(type="AREA", location=(-1.7, -2.1, 2.6))
    key = bpy.context.object
    key.name = "Preview_Key_Light"
    key.data.energy = 72
    key.data.size = 2.25
    key.data.color = (1.0, 0.94, 0.84)

    bpy.ops.object.light_add(type="POINT", location=(1.8, -1.5, 1.5))
    rim = bpy.context.object
    rim.name = "Preview_Warm_Rim_Light"
    rim.data.energy = 35
    rim.data.color = (1.0, 0.72, 0.32)

    bpy.ops.object.light_add(type="POINT", location=(-1.6, 1.0, 1.0))
    fill = bpy.context.object
    fill.name = "Preview_Cool_Fill_Light"
    fill.data.energy = 8
    fill.data.color = (0.62, 0.78, 1.0)

    preview_camera = add_preview_camera(
        "Preview_Camera",
        location=(1.2, -1.35, 1.05),
        target=target,
        ortho_scale=preview_ortho_scale,
    )
    top_camera = add_preview_camera(
        "Preview_Top_Camera",
        location=(0.0, -0.2, 2.0),
        target=(0.0, 0.0, 0.18),
        ortho_scale=top_ortho_scale,
    )
    bpy.context.scene.camera = preview_camera
    return {"preview": preview_camera, "top": top_camera}


def configure_scene() -> None:
    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.cycles.samples = 96
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


def export_and_render(
    output_path: Path,
    preview_path: Path,
    top_preview_path: Path,
    preview: bool,
    preview_ortho_scale: float,
    top_ortho_scale: float,
    target: tuple[float, float, float],
) -> None:
    export_glb(output_path)
    print(f"Exported {output_path}")

    if preview:
        cameras = add_camera_and_lights(
            preview_ortho_scale=preview_ortho_scale,
            top_ortho_scale=top_ortho_scale,
            target=target,
        )
        configure_scene()
        render_preview(preview_path, cameras["preview"], (1100, 1100))
        render_preview(top_preview_path, cameras["top"], (1100, 1100))
        print(f"Rendered {preview_path}")
        print(f"Rendered {top_preview_path}")
