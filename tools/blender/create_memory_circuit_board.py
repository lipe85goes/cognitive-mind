"""
Generate the Memory Circuit MASTER board + aligned state overlays (2.5D).

Run from the project root with Blender:
blender --background --python tools/blender/create_memory_circuit_board.py

Outputs (public/assets/memory-circuit/):
- memory-board-master.png      -> the whole board: platform, 4 integrated pads
                                  (flame N, wave E, leaf W, sun S), trails, core.
- overlay-flame-active.png     -> ONLY the lit state of the flame pad + trail.
- overlay-wave-active.png      -> idem wave.
- overlay-leaf-active.png      -> idem leaf.
- overlay-sun-active.png       -> idem sun.
- overlay-core-pulse.png       -> ONLY the lit core crystal + halo.

Every image is rendered from the SAME camera at the SAME resolution with a
transparent film, so overlays align with the master board pixel-for-pixel by
construction. The script also prints the projected pad centers/radii in view
percentages — paste those into memoryCircuitLayout.ts for the hitboxes.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector


OUT_DIR = Path(__file__).resolve().parents[2] / "public" / "assets" / "memory-circuit"
RES_X, RES_Y = 1500, 1200

# Visual mapping frozen by the mission: flame = top (far side), wave = right,
# leaf = left, sun = bottom (near side). Camera looks from -Z, so +Z is "top".
PAD_DEFS = {
    "flame": {"pos": (0.0, 1.78), "base": (0.62, 0.16, 0.10), "glow": (1.0, 0.27, 0.07)},
    "wave": {"pos": (1.78, 0.0), "base": (0.10, 0.30, 0.58), "glow": (0.25, 0.62, 1.0)},
    "leaf": {"pos": (-1.78, 0.0), "base": (0.12, 0.40, 0.16), "glow": (0.35, 0.95, 0.40)},
    "sun": {"pos": (0.0, -1.78), "base": (0.72, 0.50, 0.08), "glow": (1.0, 0.78, 0.22)},
}

BASE_OBJS: list[bpy.types.Object] = []
LIT_OBJS: dict[str, list[bpy.types.Object]] = {
    "flame": [],
    "wave": [],
    "leaf": [],
    "sun": [],
    "core": [],
}


def tb(location: tuple[float, float, float]) -> tuple[float, float, float]:
    """Target coords (X width, Y vertical, Z depth) -> Blender (Z-up)."""
    x, y, z = location
    return (x, z, y)


def _set_input(node: bpy.types.Node, identifier: str, value) -> None:
    for socket in node.inputs:
        if socket.identifier == identifier:
            socket.default_value = value
            return


def make_material(
    name: str,
    color: tuple[float, float, float],
    metallic: float,
    roughness: float,
    emission: tuple[float, float, float] | None = None,
    emission_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = next(
        (n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None
    )
    if bsdf:
        _set_input(bsdf, "Base Color", (*color, 1.0))
        _set_input(bsdf, "Metallic", metallic)
        _set_input(bsdf, "Roughness", roughness)
        if emission:
            _set_input(bsdf, "Emission Color", (*emission, 1.0))
            _set_input(bsdf, "Emission Strength", emission_strength)
    material.diffuse_color = (*color, 1.0)
    return material


def make_glow_material(
    name: str, color: tuple[float, float, float], strength: float
) -> bpy.types.Material:
    """Soft-edged glow: emission whose alpha fades radially (real PNG alpha)."""
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    tree = material.node_tree
    tree.nodes.clear()

    out = tree.nodes.new("ShaderNodeOutputMaterial")
    mix = tree.nodes.new("ShaderNodeMixShader")
    transparent = tree.nodes.new("ShaderNodeBsdfTransparent")
    emission = tree.nodes.new("ShaderNodeEmission")
    ramp = tree.nodes.new("ShaderNodeValToRGB")
    gradient = tree.nodes.new("ShaderNodeTexGradient")
    coords = tree.nodes.new("ShaderNodeTexCoord")

    gradient.gradient_type = "SPHERICAL"
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0, 0, 0, 1)
    ramp.color_ramp.elements[1].position = 0.85
    ramp.color_ramp.elements[1].color = (1, 1, 1, 1)

    _set_input(emission, "Color", (*color, 1.0))
    _set_input(emission, "Strength", strength)

    tree.links.new(coords.outputs["Object"], gradient.inputs["Vector"])
    tree.links.new(gradient.outputs["Color"], ramp.inputs["Fac"])
    tree.links.new(ramp.outputs["Color"], mix.inputs["Fac"])
    tree.links.new(transparent.outputs["BSDF"], mix.inputs[1])
    tree.links.new(emission.outputs["Emission"], mix.inputs[2])
    tree.links.new(mix.outputs["Shader"], out.inputs["Surface"])
    return material


def register(obj: bpy.types.Object, group: str | None) -> bpy.types.Object:
    if group is None:
        BASE_OBJS.append(obj)
    else:
        LIT_OBJS[group].append(obj)
    return obj


def add_cylinder(name, loc, radius, height, mat, group=None, vertices=96):
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices, radius=radius, depth=height, location=tb(loc)
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    return register(obj, group)


def add_cone(name, loc, r1, r2, height, mat, group=None, scale=None, vertices=48):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices, radius1=r1, radius2=r2, depth=height, location=tb(loc)
    )
    obj = bpy.context.object
    obj.name = name
    if scale:
        obj.scale = (scale[0], scale[2], scale[1])
        bpy.ops.object.transform_apply(scale=True)
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return register(obj, group)


def add_torus(name, loc, major, minor, mat, group=None, rot_x=0.0):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=72,
        minor_segments=18,
        location=tb(loc),
        rotation=(rot_x, 0, 0),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return register(obj, group)


def add_sphere(name, loc, radius, mat, group=None, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(
        radius=radius, segments=40, ring_count=20, location=tb(loc)
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = (scale[0], scale[2], scale[1])
    bpy.ops.object.transform_apply(scale=True)
    obj.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    return register(obj, group)


def add_ico(name, loc, radius, mat, group=None, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_ico_sphere_add(
        subdivisions=1, radius=radius, location=tb(loc)
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = (scale[0], scale[2], scale[1])
    bpy.ops.object.transform_apply(scale=True)
    obj.data.materials.append(mat)
    return register(obj, group)


def add_box(name, loc, dims, mat, group=None, rot_y_deg=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=tb(loc))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (dims[0], dims[2], dims[1])
    obj.rotation_euler[2] = math.radians(rot_y_deg)
    obj.data.materials.append(mat)
    bpy.ops.object.transform_apply(scale=True)
    return register(obj, group)


def build_symbol(element, cx, cz, mats, group=None, lit=False):
    """Small extruded 3D symbol sitting on the pad enamel (y~0.10)."""
    suffix = "Lit" if lit else "Base"
    m = mats[f"{element}_symbol_lit" if lit else f"{element}_symbol"]
    if element == "flame":
        add_cone(f"Sym_Flame_{suffix}", (cx - 0.02, 0.3, cz), 0.22, 0.012, 0.4, m, group,
                 scale=(1, 1, 0.66))
        add_cone(f"Sym_Flame_Side_{suffix}", (cx + 0.17, 0.2, cz - 0.02), 0.11, 0.01, 0.2, m,
                 group, scale=(1, 1, 0.66))
    elif element == "wave":
        # Três linhas d'água paralelas (cápsulas achatadas) — leitura calma de "onda".
        for i, (dz, width) in enumerate(((0.16, 0.5), (0.0, 0.62), (-0.16, 0.42))):
            add_sphere(f"Sym_Wave_{i}_{suffix}", (cx - 0.04 + (i % 2) * 0.08, 0.12, cz + dz),
                       0.5, m, group, scale=(width, 0.11, 0.11))
    elif element == "leaf":
        add_sphere(f"Sym_Leaf_{suffix}", (cx - 0.05, 0.13, cz), 0.3, m, group,
                   scale=(1.05, 0.2, 0.52))
        add_cone(f"Sym_Leaf_Tip_{suffix}", (cx - 0.38, 0.12, cz), 0.08, 0.01, 0.2, m, group,
                 scale=(1, 0.5, 1))
        add_box(f"Sym_Leaf_Vein_{suffix}", (cx - 0.04, 0.16, cz), (0.5, 0.02, 0.035), m, group)
        add_box(f"Sym_Leaf_Stem_{suffix}", (cx + 0.3, 0.12, cz - 0.06), (0.2, 0.035, 0.045), m,
                group, rot_y_deg=28)
    elif element == "sun":
        add_cylinder(f"Sym_Sun_{suffix}", (cx, 0.14, cz), 0.16, 0.07, m, group, vertices=40)
        for i in range(8):
            a = i * math.pi / 4
            rx, rz = cx + math.cos(a) * 0.27, cz + math.sin(a) * 0.27
            add_box(f"Sym_Sun_Ray_{i}_{suffix}", (rx, 0.12, rz), (0.14, 0.045, 0.05), m, group,
                    rot_y_deg=math.degrees(a))


def build_scene():
    mats = {
        "stone": make_material("BoardStone", (0.36, 0.32, 0.27), 0.05, 0.72),
        "slate": make_material("BoardSlate", (0.21, 0.21, 0.2), 0.04, 0.58),
        "gold": make_material("BoardGold", (0.85, 0.6, 0.26), 0.9, 0.24),
        "bronze": make_material("BoardBronze", (0.42, 0.27, 0.12), 0.82, 0.38),
        "inlay": make_material("TrailInlay", (0.2, 0.14, 0.07), 0.6, 0.5),
        "inlay_line": make_material("TrailLine", (0.62, 0.44, 0.2), 0.85, 0.3),
        "well": make_material("PadWell", (0.05, 0.05, 0.055), 0.0, 0.85),
        "gem": make_material("RimGem", (0.15, 0.42, 0.8), 0.0, 0.12, (0.06, 0.22, 0.5), 0.5),
        "crystal": make_material("CoreCrystal", (0.72, 0.9, 1.0), 0.0, 0.1, (0.3, 0.55, 0.7), 0.35),
        "crystal_lit": make_material("CoreCrystalLit", (0.85, 0.97, 1.0), 0.0, 0.1, (0.55, 0.85, 1.0), 3.2),
    }
    for key, d in PAD_DEFS.items():
        b, g = d["base"], d["glow"]
        mats[f"{key}_enamel"] = make_material(f"Pad_{key}", b, 0.1, 0.4, tuple(c * 0.5 for c in g), 0.12)
        mats[f"{key}_enamel_lit"] = make_material(f"Pad_{key}_Lit", g, 0.0, 0.3, g, 1.35)
        mats[f"{key}_symbol"] = make_material(
            f"Sym_{key}", tuple(min(1, c * 1.5 + 0.18) for c in b), 0.15, 0.35,
            tuple(c * 0.4 for c in g), 0.25)
        mats[f"{key}_symbol_lit"] = make_material(
            f"Sym_{key}_Lit", (1, 1, 1), 0.0, 0.25, tuple(min(1, c * 0.9 + 0.1) for c in g), 2.0)
        mats[f"{key}_glow"] = make_glow_material(f"Glow_{key}", g, 1.0)
        mats[f"{key}_trail_lit"] = make_material(
            f"Trail_{key}_Lit", g, 0.0, 0.3, g, 2.2)
    mats["core_glow"] = make_glow_material("Glow_Core", (0.55, 0.85, 1.0), 1.2)

    # ---- Platform (single coherent 2.5D object family) ----
    add_cylinder("Board_Body", (0, -0.3, 0), 3.05, 0.6, mats["stone"])
    add_cylinder("Board_Top", (0, 0.012, 0), 2.78, 0.06, mats["slate"])
    add_torus("Gold_Rim", (0, 0.045, 0), 2.9, 0.085, mats["gold"])
    add_torus("Skirt", (0, -0.58, 0), 2.96, 0.11, mats["bronze"])
    for i in range(4):
        a = math.pi / 4 + i * math.pi / 2
        gx, gz = math.cos(a) * 2.9, math.sin(a) * 2.9
        add_cylinder(f"Gem_Bezel_{i}", (gx, 0.07, gz), 0.17, 0.07, mats["gold"], vertices=8)
        add_ico(f"Rim_Gem_{i}", (gx, 0.14, gz), 0.12, mats["gem"], scale=(1, 0.75, 1))

    # ---- Center core ----
    add_torus("Rosette", (0, 0.045, 0), 0.52, 0.05, mats["gold"])
    add_cylinder("Core_Plate", (0, 0.03, 0), 0.45, 0.05, mats["well"])
    add_cone("Core_Base", (0, 0.1, 0), 0.24, 0.15, 0.12, mats["gold"])
    add_ico("Core_Crystal", (0, 0.42, 0), 0.2, mats["crystal"], scale=(1, 1.85, 1))

    # ---- Trails (recessed inlay from each pad to the rosette) ----
    for key, d in PAD_DEFS.items():
        px, pz = d["pos"]
        ux, uz = px / 1.78, pz / 1.78
        cx, cz = ux * 0.83, uz * 0.83  # midpoint between rosette (0.55) and pad well (1.1)
        angle = math.degrees(math.atan2(uz, ux))
        add_box(f"Trail_{key}", (cx * 1.0, 0.02, cz * 1.0), (0.62, 0.035, 0.17),
                mats["inlay"], rot_y_deg=angle)
        add_box(f"TrailLine_{key}", (cx, 0.032, cz), (0.6, 0.03, 0.055),
                mats["inlay_line"], rot_y_deg=angle)

    # ---- Pads integrated on the platform top ----
    for key, d in PAD_DEFS.items():
        px, pz = d["pos"]
        add_cylinder(f"Well_{key}", (px, 0.0, pz), 0.82, 0.09, mats["well"])
        add_torus(f"Ring_{key}", (px, 0.05, pz), 0.76, 0.055, mats["bronze"])
        add_cylinder(f"Enamel_{key}", (px, 0.035, pz), 0.65, 0.075, mats[f"{key}_enamel"])
        build_symbol(key, px, pz, mats)

        # ---- Lit overlay set (hidden in the master render) ----
        add_cylinder(f"Enamel_{key}_Lit", (px, 0.038, pz), 0.65, 0.078,
                     mats[f"{key}_enamel_lit"], group=key)
        add_torus(f"Ring_{key}_Lit", (px, 0.052, pz), 0.76, 0.056,
                  mats[f"{key}_trail_lit"], group=key)
        build_symbol(key, px, pz, mats, group=key, lit=True)
        add_sphere(f"GlowPool_{key}", (px, 0.14, pz), 1.02, mats[f"{key}_glow"],
                   group=key, scale=(1, 0.05, 1))
        ux, uz = px / 1.78, pz / 1.78
        angle = math.degrees(math.atan2(uz, ux))
        add_box(f"TrailLit_{key}", (ux * 0.83, 0.036, uz * 0.83), (0.6, 0.032, 0.06),
                mats[f"{key}_trail_lit"], group=key, rot_y_deg=angle)

    # ---- Core pulse overlay set ----
    add_ico("Core_Crystal_Lit", (0, 0.42, 0), 0.205, mats["crystal_lit"],
            group="core", scale=(1, 1.85, 1))
    add_sphere("Core_GlowPool", (0, 0.24, 0), 0.62, mats["core_glow"],
               group="core", scale=(1, 0.08, 1))


def add_camera_and_lights():
    elev = math.radians(52)
    dist = 11.0
    bpy.ops.object.camera_add(
        location=(0, -math.cos(elev) * dist, math.sin(elev) * dist)
    )
    cam = bpy.context.object
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = 7.5
    direction = Vector((0, 0.25, 0.0)) - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam

    bpy.ops.object.light_add(type="AREA", location=(-3.5, -4.5, 7.5))
    key = bpy.context.object
    key.data.energy = 950
    key.data.size = 6.5
    key.data.color = (1.0, 0.95, 0.86)

    bpy.ops.object.light_add(type="AREA", location=(3.6, -2.8, 5.0))
    fill = bpy.context.object
    fill.data.energy = 260
    fill.data.size = 5.0
    fill.data.color = (0.92, 0.96, 1.0)

    bpy.ops.object.light_add(type="POINT", location=(0, 4.2, 3.2))
    rim = bpy.context.object
    rim.data.energy = 140
    rim.data.color = (1.0, 0.85, 0.6)
    return cam


def configure_render():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 96
    scene.render.film_transparent = True
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.render.resolution_x = RES_X
    scene.render.resolution_y = RES_Y
    scene.render.image_settings.color_mode = "RGBA"


def render_to(path: Path, visible: set[bpy.types.Object]):
    everything = BASE_OBJS + [o for group in LIT_OBJS.values() for o in group]
    for obj in everything:
        obj.hide_render = obj not in visible
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    print(f"Rendered {path.name}")


def print_hitbox_coords(cam):
    scene = bpy.context.scene
    print("=== HITBOX COORDS (percent of image) ===")
    for key, d in PAD_DEFS.items():
        px, pz = d["pos"]
        center = world_to_camera_view(scene, cam, Vector(tb((px, 0.08, pz))))
        edge = world_to_camera_view(scene, cam, Vector(tb((px + 0.82, 0.08, pz))))
        radius_pct = abs(edge.x - center.x) * 100
        print(
            f"PAD {key}: x={center.x * 100:.1f}% y={(1 - center.y) * 100:.1f}% "
            f"size={radius_pct * 2:.1f}%"
        )
    core = world_to_camera_view(scene, cam, Vector(tb((0, 0.3, 0))))
    print(f"CORE: x={core.x * 100:.1f}% y={(1 - core.y) * 100:.1f}%")


def main():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    build_scene()
    cam = add_camera_and_lights()
    configure_render()
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    render_to(OUT_DIR / "memory-board-master.png", set(BASE_OBJS))
    for key in ("flame", "wave", "leaf", "sun"):
        render_to(OUT_DIR / f"overlay-{key}-active.png", set(LIT_OBJS[key]))
    render_to(OUT_DIR / "overlay-core-pulse.png", set(LIT_OBJS["core"]))
    # Composição de revisão: board base + pad chama aceso + pulso do núcleo,
    # renderizados JUNTOS — prova visual de que os overlays encaixam.
    render_to(
        OUT_DIR / "memory-kit-review.png",
        set(BASE_OBJS + LIT_OBJS["flame"] + LIT_OBJS["core"]),
    )

    print_hitbox_coords(cam)


if __name__ == "__main__":
    main()
