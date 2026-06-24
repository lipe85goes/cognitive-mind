"""
Generate the premium Rota Estrategica board asset.

Run from the project root with Blender:
blender --background --python tools/blender/create_route_board_glb.py

The script exports:
public/models/route/board.glb

Optional preview render:
blender --background --python tools/blender/create_route_board_glb.py -- --preview
"""

from __future__ import annotations

import argparse
from math import radians
from pathlib import Path

import bpy
from mathutils import Vector


CELL_SIZE = 1.0
GRID_SIZE = 7
TILE_SIZE = 0.86
BOARD_WIDTH = 8.65
BOARD_DEPTH = 8.65


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def parse_args() -> argparse.Namespace:
    import sys

    script_args = []
    if "--" in sys.argv:
        script_args = sys.argv[sys.argv.index("--") + 1 :]

    parser = argparse.ArgumentParser(description="Create route board GLB.")
    parser.add_argument(
        "--output",
        default=str(project_root() / "public" / "models" / "route" / "board.glb"),
        help="Output GLB path.",
    )
    parser.add_argument(
        "--preview",
        action="store_true",
        help="Render public/models/route/board-preview.png after export.",
    )
    parser.add_argument(
        "--preview-output",
        default=str(
            project_root() / "public" / "models" / "route" / "board-preview.png"
        ),
        help="Optional preview PNG path.",
    )
    parser.add_argument(
        "--top-preview-output",
        default=str(
            project_root()
            / "public"
            / "models"
            / "route"
            / "board-preview-top.png"
        ),
        help="Optional top/near-top preview PNG path.",
    )
    return parser.parse_args(script_args)


def target_to_blender(location: tuple[float, float, float]) -> tuple[float, float, float]:
    """Target coordinate system is X columns, Y vertical, Z depth.

    Blender is Z-up internally. The glTF exporter converts to Y-up on export.
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
    # Find the Principled BSDF by node TYPE (not its localised display name) so
    # this works on a non-English Blender, where "Principled BSDF" is renamed
    # and a name lookup would return None — silently leaving every material grey.
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
    return {
        "DarkWood": make_material("DarkWood", (0.12, 0.065, 0.035, 1), 0.04, 0.82),
        "DarkStone": make_material("DarkStone", (0.08, 0.085, 0.078, 1), 0.02, 0.9),
        "AgedBrass": make_material("AgedBrass", (0.68, 0.43, 0.16, 1), 0.68, 0.28),
        "DeepShadow": make_material("DeepShadow", (0.025, 0.018, 0.014, 1), 0.0, 0.95),
        "TileVariationA": make_material(
            "TileVariationA", (0.13, 0.135, 0.125, 1), 0.02, 0.88
        ),
        "TileVariationB": make_material(
            "TileVariationB", (0.105, 0.11, 0.105, 1), 0.02, 0.92
        ),
        "WarmRivet": make_material(
            "WarmRivet",
            (0.95, 0.68, 0.26, 1),
            0.55,
            0.25,
            emission=(0.45, 0.23, 0.05),
            emission_strength=0.18,
        ),
    }


def add_box(
    name: str,
    location: tuple[float, float, float],
    dimensions: tuple[float, float, float],
    material: bpy.types.Material,
    bevel: float = 0.02,
    rotation_y_degrees: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=target_to_blender(location))
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_Mesh"
    obj.dimensions = dimensions_to_blender(dimensions)
    obj.rotation_euler[2] = radians(rotation_y_degrees)
    obj.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    if bevel > 0:
        bevel_modifier = obj.modifiers.new(f"{name}_Bevel", "BEVEL")
        bevel_modifier.width = bevel
        bevel_modifier.segments = 2
        bevel_modifier.affect = "EDGES"
        normal_modifier = obj.modifiers.new(f"{name}_WeightedNormals", "WEIGHTED_NORMAL")
        normal_modifier.keep_sharp = True
    return obj


def add_cylinder(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    height: float,
    material: bpy.types.Material,
    vertices: int = 20,
    bevel: float = 0.005,
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

    if bevel > 0:
        bevel_modifier = obj.modifiers.new(f"{name}_Bevel", "BEVEL")
        bevel_modifier.width = bevel
        bevel_modifier.segments = 2
        normal_modifier = obj.modifiers.new(f"{name}_WeightedNormals", "WEIGHTED_NORMAL")
        normal_modifier.keep_sharp = True
    return obj


def add_crack(
    name: str,
    x: float,
    z: float,
    material: bpy.types.Material,
    angle: float,
    length: float,
) -> bpy.types.Object:
    return add_box(
        name,
        (x, 0.205, z),
        (length, 0.012, 0.018),
        material,
        bevel=0.002,
        rotation_y_degrees=angle,
    )


def add_board_base(materials: dict[str, bpy.types.Material]) -> None:
    add_box(
        "Board_Base",
        (0, -0.42, 0),
        (BOARD_WIDTH, 0.72, BOARD_DEPTH),
        materials["DarkWood"],
        bevel=0.09,
    )
    add_box(
        "Board_Underside_Shadow",
        (0, -0.82, 0),
        (BOARD_WIDTH + 0.28, 0.16, BOARD_DEPTH + 0.28),
        materials["DeepShadow"],
        bevel=0.08,
    )
    add_box(
        "Board_Inset_Bed",
        (0, -0.05, 0),
        (7.58, 0.12, 7.58),
        materials["DarkStone"],
        bevel=0.035,
    )


def add_outer_frame(materials: dict[str, bpy.types.Material]) -> None:
    rail_y = 0.24
    edge = BOARD_WIDTH / 2 - 0.19
    add_box("Board_Frame_Front", (0, rail_y, edge), (BOARD_WIDTH, 0.45, 0.32), materials["AgedBrass"], bevel=0.07)
    add_box("Board_Frame_Back", (0, rail_y, -edge), (BOARD_WIDTH, 0.45, 0.32), materials["AgedBrass"], bevel=0.07)
    add_box("Board_Frame_Left", (-edge, rail_y, 0), (0.32, 0.45, BOARD_DEPTH), materials["AgedBrass"], bevel=0.07)
    add_box("Board_Frame_Right", (edge, rail_y, 0), (0.32, 0.45, BOARD_DEPTH), materials["AgedBrass"], bevel=0.07)

    add_box("Board_Inner_Lip_Front", (0, 0.42, edge - 0.24), (7.7, 0.12, 0.08), materials["DeepShadow"], bevel=0.018)
    add_box("Board_Inner_Lip_Back", (0, 0.42, -edge + 0.24), (7.7, 0.12, 0.08), materials["DeepShadow"], bevel=0.018)
    add_box("Board_Inner_Lip_Left", (-edge + 0.24, 0.42, 0), (0.08, 0.12, 7.7), materials["DeepShadow"], bevel=0.018)
    add_box("Board_Inner_Lip_Right", (edge - 0.24, 0.42, 0), (0.08, 0.12, 7.7), materials["DeepShadow"], bevel=0.018)

    for x_name, x in (("Left", -edge), ("Right", edge)):
        for z_name, z in (("Back", -edge), ("Front", edge)):
            add_box(
                f"Board_Corner_{x_name}_{z_name}",
                (x, 0.33, z),
                (0.68, 0.56, 0.68),
                materials["AgedBrass"],
                bevel=0.095,
            )
            add_cylinder(
                f"Rivet_Corner_{x_name}_{z_name}",
                (x, 0.66, z),
                0.085,
                0.055,
                materials["WarmRivet"],
                vertices=18,
            )


def add_tiles_and_grid(materials: dict[str, bpy.types.Material]) -> None:
    first = -(GRID_SIZE - 1) / 2
    for row in range(GRID_SIZE):
        for col in range(GRID_SIZE):
            x = (col + first) * CELL_SIZE
            z = (row + first) * CELL_SIZE
            material_name = "TileVariationA" if (row + col) % 2 == 0 else "TileVariationB"
            add_box(
                f"Tile_{row}_{col}",
                (x, 0.12, z),
                (TILE_SIZE, 0.13, TILE_SIZE),
                materials[material_name],
                bevel=0.035,
            )

            if (row * 7 + col) % 5 == 0:
                add_crack(
                    f"Tile_Crack_{row}_{col}_A",
                    x - 0.08,
                    z + 0.04,
                    materials["DeepShadow"],
                    angle=18 + row * 4,
                    length=0.34,
                )
            if (row * 7 + col) % 9 == 0:
                add_crack(
                    f"Tile_Crack_{row}_{col}_B",
                    x + 0.12,
                    z - 0.11,
                    materials["DeepShadow"],
                    angle=-32 + col * 3,
                    length=0.22,
                )

    separator_length = GRID_SIZE * CELL_SIZE - 0.14
    for index in range(1, GRID_SIZE):
        offset = (index - GRID_SIZE / 2) * CELL_SIZE
        add_box(
            f"Grid_Separator_X_{index}",
            (offset, 0.19, 0),
            (0.045, 0.07, separator_length),
            materials["AgedBrass"],
            bevel=0.008,
        )
        add_box(
            f"Grid_Separator_Z_{index}",
            (0, 0.19, offset),
            (separator_length, 0.07, 0.045),
            materials["AgedBrass"],
            bevel=0.008,
        )


def add_rivets(materials: dict[str, bpy.types.Material]) -> None:
    edge = BOARD_WIDTH / 2 - 0.19
    for index in range(GRID_SIZE):
        pos = (index - (GRID_SIZE - 1) / 2) * CELL_SIZE
        add_cylinder(
            f"Rivet_Front_{index}",
            (pos, 0.52, edge),
            0.055,
            0.045,
            materials["WarmRivet"],
        )
        add_cylinder(
            f"Rivet_Back_{index}",
            (pos, 0.52, -edge),
            0.055,
            0.045,
            materials["WarmRivet"],
        )
        add_cylinder(
            f"Rivet_Left_{index}",
            (-edge, 0.52, pos),
            0.055,
            0.045,
            materials["WarmRivet"],
        )
        add_cylinder(
            f"Rivet_Right_{index}",
            (edge, 0.52, pos),
            0.055,
            0.045,
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
    bpy.ops.object.light_add(type="AREA", location=(-3.5, -4.2, 7.0))
    key = bpy.context.object
    key.name = "Preview_Key_Light"
    key.data.energy = 620
    key.data.size = 5.2

    bpy.ops.object.light_add(type="POINT", location=(3.5, 2.8, 2.5))
    rim = bpy.context.object
    rim.name = "Preview_Warm_Rim_Light"
    rim.data.energy = 80
    rim.data.color = (1.0, 0.74, 0.38)

    preview_camera = add_preview_camera(
        "Preview_Camera",
        location=(6.6, -7.4, 5.9),
        target=(0.0, 0.0, 0.02),
        ortho_scale=10.8,
    )
    top_camera = add_preview_camera(
        "Preview_Top_Camera",
        location=(0.0, 0.0, 12.0),
        target=(0.0, 0.0, 0.0),
        ortho_scale=10.35,
    )
    bpy.context.scene.camera = preview_camera
    return {"preview": preview_camera, "top": top_camera}


def configure_scene() -> None:
    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.cycles.samples = 64
    bpy.context.scene.view_settings.view_transform = "Filmic"
    bpy.context.scene.view_settings.look = "Medium High Contrast"
    bpy.context.scene.render.resolution_x = 1400
    bpy.context.scene.render.resolution_y = 1000


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
    add_board_base(materials)
    add_tiles_and_grid(materials)
    add_outer_frame(materials)
    add_rivets(materials)
    cameras = add_camera_and_lights()
    configure_scene()

    export_glb(output_path)
    if args.preview:
        render_preview(preview_path, cameras["preview"], (1400, 1000))
        render_preview(top_preview_path, cameras["top"], (1200, 1200))

    print(f"Exported {output_path}")
    if args.preview:
        print(f"Rendered {preview_path}")
        print(f"Rendered {top_preview_path}")


if __name__ == "__main__":
    main()
