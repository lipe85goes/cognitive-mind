"""
Generate the premium Rota Estrategica board asset.

Run from the project root with Blender:
blender --background --python tools/blender/create_route_board_glb.py

The script exports:
public/models/route/board.glb

Optional preview render:
blender --background --python tools/blender/create_route_board_glb.py -- --preview

This is an "ancient tactical board": a dark-wood body with a darker grain inlay
band, a recessed dark-slate play bed framed by a bronze inner ledge + polished
brass bead, a sculpted three-tier aged-brass outer frame, tiered decorative
corner caps with crown rivets, a brass lattice of tile separators, domed brass
rivets, and subtle brass rune inlays on a few perimeter tiles.

Contract preserved for the live Babylon scene (do not break these):
- 7x7 grid, CELL_SIZE = 1.0, tile centres at x = col-3, z = row-3
- centred on the world origin in X/Z
- play surface (tile tops) stays at ~Y = 0.185 so pieces placed at the scene's
  fixed BOARD_SURFACE_Y keep resting on the tiles (no sink / no float)
- same general orientation and overall footprint
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

# Top of the slate tiles. The Babylon scene rests every gameplay piece on its
# own fixed BOARD_SURFACE_Y (~0.2), so this MUST stay put across upgrades.
TILE_TOP_Y = 0.185


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
        # Warm dark-wood body (richer brown) + darker grain inlay band.
        "DarkWood": make_material("DarkWood", (0.18, 0.105, 0.058, 1), 0.06, 0.6),
        "WoodGrainDark": make_material(
            "WoodGrainDark", (0.1, 0.056, 0.03, 1), 0.06, 0.7
        ),
        # Recessed sage/teal slate play bed.
        "DarkStone": make_material("DarkStone", (0.11, 0.138, 0.137, 1), 0.04, 0.66),
        # Clean warm brass / bronze metal family (premium gold, not dirty bronze).
        "AgedBrass": make_material("AgedBrass", (0.86, 0.6, 0.26, 1), 0.9, 0.2),
        "BronzeDark": make_material("BronzeDark", (0.5, 0.32, 0.14, 1), 0.85, 0.32),
        "BrassPolished": make_material(
            "BrassPolished", (1.0, 0.82, 0.42, 1), 0.95, 0.1
        ),
        "DeepShadow": make_material("DeepShadow", (0.022, 0.02, 0.018, 1), 0.0, 0.9),
        # Three sage/teal slate tile variations — brighter, cleaner, toy-like,
        # still readable under the bright emissive game pieces.
        "TileVariationA": make_material(
            "TileVariationA", (0.205, 0.245, 0.232, 1), 0.04, 0.56
        ),
        "TileVariationB": make_material(
            "TileVariationB", (0.16, 0.205, 0.198, 1), 0.04, 0.62
        ),
        "TileVariationC": make_material(
            "TileVariationC", (0.135, 0.178, 0.182, 1), 0.04, 0.66
        ),
        # Brass rune inlay (metallic catch-light, not emissive — stays subtle).
        "RuneInlay": make_material("RuneInlay", (0.9, 0.66, 0.34, 1), 0.88, 0.16),
        # Signature blue gemstone for the corner caps — glossy dielectric with a
        # soft cyan glow so it reads from the game camera without overexposing.
        "CornerGem": make_material(
            "CornerGem",
            (0.1, 0.34, 0.74, 1),
            0.0,
            0.1,
            emission=(0.05, 0.22, 0.5),
            emission_strength=0.55,
        ),
        "WarmRivet": make_material(
            "WarmRivet",
            (1.0, 0.78, 0.36, 1),
            0.7,
            0.18,
            emission=(0.5, 0.28, 0.08),
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
    rotation_y_degrees: float = 0.0,
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
    obj.rotation_euler[2] = radians(rotation_y_degrees)
    obj.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    if bevel > 0:
        bevel_modifier = obj.modifiers.new(f"{name}_Bevel", "BEVEL")
        bevel_modifier.width = bevel
        bevel_modifier.segments = 2
        normal_modifier = obj.modifiers.new(f"{name}_WeightedNormals", "WEIGHTED_NORMAL")
        normal_modifier.keep_sharp = True
    return obj


def add_dome_rivet(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    material: bpy.types.Material,
    height_scale: float = 0.6,
) -> bpy.types.Object:
    """A flattened sphere whose centre sits on the surface -> a domed bolt head."""
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=radius,
        segments=16,
        ring_count=9,
        location=target_to_blender(location),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_Mesh"
    # target scale (width, vertical, depth) -> Blender (width, depth, vertical)
    obj.scale = (1.0, 1.0, height_scale)
    obj.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.shade_smooth()
    return obj


def add_gem(
    name: str,
    location: tuple[float, float, float],
    radius: float,
    material: bpy.types.Material,
    height_scale: float = 1.0,
) -> bpy.types.Object:
    """A flat-shaded icosphere — reads as a faceted cut gemstone."""
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=1,
        radius=radius,
        location=target_to_blender(location),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.name = f"{name}_Mesh"
    # target scale (width, vertical, depth) -> Blender (width, depth, vertical)
    obj.scale = (1.0, 1.0, height_scale)
    obj.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    # Left flat-shaded on purpose so each facet catches light like a cut gem.
    return obj


# Simple angular glyphs: lists of (dx, dz, length, angle_degrees) brass strokes.
RUNE_PATTERNS = [
    [(0.0, 0.0, 0.32, 90), (0.0, 0.07, 0.16, 38), (0.0, -0.07, 0.16, -38)],
    [(0.0, 0.0, 0.30, 45), (0.0, 0.0, 0.30, -45)],
    [(0.0, 0.0, 0.32, 90), (0.0, 0.10, 0.18, 0)],
    [(0.0, 0.0, 0.32, 90), (0.06, 0.0, 0.14, 0), (0.06, -0.09, 0.13, 38)],
    [(-0.06, 0.0, 0.24, 65), (0.06, 0.0, 0.24, -65)],
]


def add_rune(name: str, x: float, z: float, material: bpy.types.Material, index: int) -> None:
    """A subtle flush brass rune inlay, sitting just proud of the tile top."""
    pattern = RUNE_PATTERNS[index % len(RUNE_PATTERNS)]
    for i, (dx, dz, length, angle) in enumerate(pattern):
        add_box(
            f"{name}_{i}",
            (x + dx, TILE_TOP_Y + 0.012, z + dz),
            (length, 0.016, 0.034),
            material,
            bevel=0.004,
            rotation_y_degrees=angle,
        )


def add_crack(
    name: str,
    x: float,
    z: float,
    material: bpy.types.Material,
    angle: float,
    length: float,
) -> bpy.types.Object:
    """A thin recessed line that reads as a hairline crack / wear on a tile."""
    return add_box(
        name,
        (x, TILE_TOP_Y + 0.004, z),
        (length, 0.01, 0.016),
        material,
        bevel=0.002,
        rotation_y_degrees=angle,
    )


def add_board_base(materials: dict[str, bpy.types.Material]) -> None:
    # Dark-wood body.
    add_box(
        "Board_Base",
        (0, -0.42, 0),
        (BOARD_WIDTH, 0.72, BOARD_DEPTH),
        materials["DarkWood"],
        bevel=0.10,
    )
    # Soft contact shadow slab under the body.
    add_box(
        "Board_Underside_Shadow",
        (0, -0.82, 0),
        (BOARD_WIDTH + 0.28, 0.16, BOARD_DEPTH + 0.28),
        materials["DeepShadow"],
        bevel=0.08,
    )
    # Darker grain inlay band wrapping the body sides (separates body from frame).
    add_box(
        "Board_Body_Band",
        (0, -0.18, 0),
        (BOARD_WIDTH + 0.05, 0.12, BOARD_DEPTH + 0.05),
        materials["WoodGrainDark"],
        bevel=0.03,
    )
    # Recessed dark-slate play bed.
    add_box(
        "Board_Inset_Bed",
        (0, -0.05, 0),
        (7.66, 0.14, 7.66),
        materials["DarkStone"],
        bevel=0.035,
    )


def add_inner_border(materials: dict[str, bpy.types.Material]) -> None:
    """Bronze ledge + polished brass bead + dark moat framing the 7x7 field.

    Kept low (top ~0.245, only ~0.06 above the tiles) so it reads as a recessed
    arena rim without occluding pieces from the game camera.
    """
    inner = 3.72
    span = 7.66
    sides = (
        ("Front", (0, 0, inner), (span, 0, 0.17)),
        ("Back", (0, 0, -inner), (span, 0, 0.17)),
        ("Left", (-inner, 0, 0), (0.17, 0, span)),
        ("Right", (inner, 0, 0), (0.17, 0, span)),
    )
    for label, (lx, _ly, lz), (dw, _dh, dd) in sides:
        # Bronze ledge.
        add_box(
            f"Inner_Border_{label}",
            (lx, 0.13, lz),
            (dw, 0.17, dd),
            materials["BronzeDark"],
            bevel=0.025,
        )
        # Polished brass bead on top of the ledge.
        bead_w = dw - 0.12 if dw > dd else 0.09
        bead_d = 0.09 if dw > dd else dd - 0.12
        add_box(
            f"Inner_Bead_{label}",
            (lx, 0.225, lz),
            (bead_w, 0.035, bead_d),
            materials["BrassPolished"],
            bevel=0.012,
        )
    # Dark moat line just inside the ledge (a recess shadow around the field).
    moat = 3.55
    for label, loc, dims in (
        ("Front", (0, 0.11, moat), (7.3, 0.06, 0.05)),
        ("Back", (0, 0.11, -moat), (7.3, 0.06, 0.05)),
        ("Left", (-moat, 0.11, 0), (0.05, 0.06, 7.3)),
        ("Right", (moat, 0.11, 0), (0.05, 0.06, 7.3)),
    ):
        add_box(f"Inner_Moat_{label}", loc, dims, materials["DeepShadow"], bevel=0.01)
    # Small brass corner studs where the ledge meets at the field corners.
    for sx in (-inner, inner):
        for sz in (-inner, inner):
            add_dome_rivet(
                f"Inner_Stud_{'L' if sx < 0 else 'R'}_{'B' if sz < 0 else 'F'}",
                (sx, 0.22, sz),
                0.07,
                materials["BrassPolished"],
            )


def add_outer_frame(materials: dict[str, bpy.types.Material]) -> None:
    """Sculpted three-tier outer frame: bronze skirt, brass rail, brass bead."""
    edge = BOARD_WIDTH / 2 - 0.19  # 4.135 — keep the overall footprint unchanged
    rails = (
        ("Front", (0, 0, edge), "x"),
        ("Back", (0, 0, -edge), "x"),
        ("Left", (-edge, 0, 0), "z"),
        ("Right", (edge, 0, 0), "z"),
    )
    for label, (lx, _ly, lz), axis in rails:
        # Lower bronze skirt (wider, anchors the frame to the body).
        skirt = (BOARD_WIDTH, 0.30, 0.42) if axis == "x" else (0.42, 0.30, BOARD_DEPTH)
        add_box(f"Frame_Skirt_{label}", (lx, 0.07, lz), skirt, materials["BronzeDark"], bevel=0.05)
        # Main aged-brass rail (slightly inset, taller).
        rail = (BOARD_WIDTH, 0.34, 0.32) if axis == "x" else (0.32, 0.34, BOARD_DEPTH)
        add_box(f"Frame_Rail_{label}", (lx, 0.31, lz), rail, materials["AgedBrass"], bevel=0.06)
        # Polished brass crown bead along the top of the rail.
        bead = (BOARD_WIDTH, 0.06, 0.20) if axis == "x" else (0.20, 0.06, BOARD_DEPTH)
        add_box(f"Frame_Bead_{label}", (lx, 0.51, lz), bead, materials["BrassPolished"], bevel=0.025)

    # Thin dark inner lip = shadow gap between the frame and the play field.
    lip = edge - 0.30
    for label, loc, dims in (
        ("Front", (0, 0.40, lip), (7.74, 0.12, 0.07)),
        ("Back", (0, 0.40, -lip), (7.74, 0.12, 0.07)),
        ("Left", (-lip, 0.40, 0), (0.07, 0.12, 7.74)),
        ("Right", (lip, 0.40, 0), (0.07, 0.12, 7.74)),
    ):
        add_box(f"Frame_Inner_Lip_{label}", loc, dims, materials["DeepShadow"], bevel=0.015)

    # Tiered decorative corner caps + crown rivets.
    for x_name, x in (("Left", -edge), ("Right", edge)):
        for z_name, z in (("Back", -edge), ("Front", edge)):
            add_box(
                f"Corner_Plate_{x_name}_{z_name}",
                (x, 0.10, z),
                (0.82, 0.42, 0.82),
                materials["AgedBrass"],
                bevel=0.07,
            )
            add_box(
                f"Corner_Block_{x_name}_{z_name}",
                (x, 0.42, z),
                (0.66, 0.30, 0.66),
                materials["BronzeDark"],
                bevel=0.06,
            )
            # Octagonal polished cap.
            add_cylinder(
                f"Corner_Cap_{x_name}_{z_name}",
                (x, 0.60, z),
                0.33,
                0.10,
                materials["BrassPolished"],
                vertices=8,
                bevel=0.02,
                rotation_y_degrees=22.5,
            )
            # Octagonal brass bezel that "sets" the gemstone.
            add_cylinder(
                f"Corner_Bezel_{x_name}_{z_name}",
                (x, 0.67, z),
                0.2,
                0.07,
                materials["AgedBrass"],
                vertices=8,
                bevel=0.012,
                rotation_y_degrees=22.5,
            )
            # Signature faceted blue gemstone corner cap (matches the mockup).
            add_gem(
                f"Corner_Gem_{x_name}_{z_name}",
                (x, 0.74, z),
                0.16,
                materials["CornerGem"],
                height_scale=0.9,
            )


def add_tiles_and_grid(materials: dict[str, bpy.types.Material]) -> None:
    first = -(GRID_SIZE - 1) / 2
    tile_variations = ("TileVariationA", "TileVariationB", "TileVariationC")
    # Controlled set of perimeter tiles that carry a brass rune inlay (keeps the
    # inner 5x5 play area clean for pieces and hazards).
    rune_tiles = {
        (0, 0): 0,
        (0, 6): 1,
        (6, 0): 2,
        (6, 6): 3,
        (0, 3): 4,
        (3, 0): 0,
        (3, 6): 1,
        (6, 3): 2,
    }
    for row in range(GRID_SIZE):
        for col in range(GRID_SIZE):
            x = (col + first) * CELL_SIZE
            z = (row + first) * CELL_SIZE
            # Subtle 3-way slate variation (checker base + an occasional 3rd tone).
            if (row * 7 + col) % 11 == 0:
                material_name = "TileVariationC"
            else:
                material_name = tile_variations[(row + col) % 2]
            add_box(
                f"Tile_{row}_{col}",
                (x, 0.12, z),
                (TILE_SIZE, 0.13, TILE_SIZE),
                materials[material_name],
                bevel=0.035,
            )

            if (row, col) in rune_tiles:
                add_rune(
                    f"Tile_Rune_{row}_{col}",
                    x,
                    z,
                    materials["RuneInlay"],
                    rune_tiles[(row, col)],
                )
            elif (row * 7 + col) % 6 == 0:
                # A light scattering of hairline cracks for age (not on runes).
                add_crack(
                    f"Tile_Crack_{row}_{col}",
                    x - 0.07,
                    z + 0.05,
                    materials["DeepShadow"],
                    angle=18 + row * 5,
                    length=0.32,
                )

    # More prominent brass lattice separators between the tiles.
    separator_length = GRID_SIZE * CELL_SIZE - 0.12
    for index in range(1, GRID_SIZE):
        offset = (index - GRID_SIZE / 2) * CELL_SIZE
        add_box(
            f"Grid_Separator_X_{index}",
            (offset, 0.195, 0),
            (0.05, 0.085, separator_length),
            materials["AgedBrass"],
            bevel=0.01,
        )
        add_box(
            f"Grid_Separator_Z_{index}",
            (0, 0.195, offset),
            (separator_length, 0.085, 0.05),
            materials["AgedBrass"],
            bevel=0.01,
        )


def add_rivets(materials: dict[str, bpy.types.Material]) -> None:
    """Domed brass rivets along the frame, aligned with the grid columns/rows."""
    edge = BOARD_WIDTH / 2 - 0.19
    for index in range(GRID_SIZE):
        pos = (index - (GRID_SIZE - 1) / 2) * CELL_SIZE
        add_dome_rivet(f"Rivet_Front_{index}", (pos, 0.55, edge), 0.07, materials["WarmRivet"])
        add_dome_rivet(f"Rivet_Back_{index}", (pos, 0.55, -edge), 0.07, materials["WarmRivet"])
        add_dome_rivet(f"Rivet_Left_{index}", (-edge, 0.55, pos), 0.07, materials["WarmRivet"])
        add_dome_rivet(f"Rivet_Right_{index}", (edge, 0.55, pos), 0.07, materials["WarmRivet"])


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
        location=(6.7, -7.5, 5.6),
        target=(0.0, 0.0, 0.12),
        ortho_scale=10.9,
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
    add_inner_border(materials)
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
