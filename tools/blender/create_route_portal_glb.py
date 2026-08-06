"""Generate the Rota Estrategica portal / exit prop asset."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent))

from route_prop_asset_utils import (
    add_box,
    add_camera_and_lights,
    add_cylinder,
    add_sphere,
    add_torus,
    clear_scene,
    configure_scene,
    export_glb,
    make_material,
    parse_prop_args,
    render_preview,
)


def create_materials():
    return {
        "PortalShadow": make_material("PortalShadow", (0.01, 0.012, 0.01, 1), 0.0, 1.0),
        "PortalStone": make_material("PortalStone", (0.26, 0.24, 0.18, 1), 0.05, 0.72),
        "PortalBronze": make_material(
            "PortalBronze", (0.68, 0.43, 0.18, 1), 0.72, 0.38
        ),
        "PortalGreenGlow": make_material(
            "PortalGreenGlow",
            (0.10, 0.86, 0.78, 1),
            0.0,
            0.22,
            emission=(0.03, 0.78, 0.68),
            emission_strength=3.4,
        ),
        "PortalGlassCore": make_material(
            "PortalGlassCore",
            (0.30, 0.95, 0.88, 1),
            0.0,
            0.12,
            emission=(0.06, 0.86, 0.78),
            emission_strength=2.2,
        ),
        "PortalThreshold": make_material(
            "PortalThreshold",
            (0.05, 0.16, 0.16, 1),
            0.05,
            0.66,
        ),
        "PortalBlueGem": make_material(
            "PortalBlueGem",
            (0.14, 0.54, 1.0, 1),
            0.0,
            0.12,
            emission=(0.04, 0.28, 0.85),
            emission_strength=1.5,
        ),
    }


def build_portal(materials) -> None:
    # Grounded stone footing.
    add_cylinder("Portal_Shadow", (0, 0.006, 0.0), 0.42, 0.012, materials["PortalShadow"])
    add_box("Portal_Base", (0, 0.06, 0.02), (0.86, 0.12, 0.46), materials["PortalStone"], 0.04)
    add_box("Portal_Base_Trim", (0, 0.145, 0.02), (0.76, 0.05, 0.36), materials["PortalBronze"], 0.02)
    add_box("Portal_Step", (0, 0.03, 0.28), (0.58, 0.06, 0.2), materials["PortalStone"], 0.02)

    # Tall uprights: the passage stands, it does not lie down.
    add_cylinder("Portal_Left_Pillar", (-0.31, 0.62, 0.02), 0.1, 1.0, materials["PortalStone"], 24)
    add_cylinder("Portal_Right_Pillar", (0.31, 0.62, 0.02), 0.1, 1.0, materials["PortalStone"], 24)
    add_cylinder("Portal_Left_Cap", (-0.31, 1.14, 0.02), 0.125, 0.09, materials["PortalBronze"], 24)
    add_cylinder("Portal_Right_Cap", (0.31, 1.14, 0.02), 0.125, 0.09, materials["PortalBronze"], 24)

    # Arch: a bronze ring with a recessed dark jamb behind it, so the opening
    # has visible depth instead of reading as a flat disc.
    add_torus("Portal_Arch_Bronze", (0, 0.95, 0.0), 0.4, 0.05, materials["PortalBronze"], face_front=True)
    add_torus("Portal_Arch_Jamb", (0, 0.95, -0.09), 0.38, 0.06, materials["PortalThreshold"], face_front=True)
    add_torus("Portal_Arch_Glow", (0, 0.95, -0.05), 0.31, 0.03, materials["PortalGreenGlow"], face_front=True)

    # The threshold itself: an upright energy surface filling the opening.
    add_sphere(
        "Portal_Threshold_Field",
        (0, 0.9, -0.06),
        0.31,
        materials["PortalGlassCore"],
        target_scale=(1.0, 1.12, 0.1),
        segments=40,
        rings=20,
    )
    add_sphere(
        "Portal_Threshold_Depth",
        (0, 0.9, -0.14),
        0.26,
        materials["PortalThreshold"],
        target_scale=(1.0, 1.1, 0.12),
        segments=32,
        rings=16,
    )
    add_sphere("Portal_Top_Gem", (0, 1.28, 0.0), 0.07, materials["PortalBlueGem"], target_scale=(1, 0.8, 1))


def main() -> None:
    args = parse_prop_args("portal", "Create route portal GLB.")
    clear_scene()
    build_portal(create_materials())
    output_path = Path(args.output).resolve()
    preview_path = Path(args.preview_output).resolve()
    top_preview_path = Path(args.top_preview_output).resolve()
    export_glb(output_path)
    print(f"Exported {output_path}")
    if args.preview:
        cameras = add_camera_and_lights(preview_ortho_scale=1.3, top_ortho_scale=1.08, target=(0, 0, 0.38))
        configure_scene()
        render_preview(preview_path, cameras["preview"], (1100, 1100))
        render_preview(top_preview_path, cameras["top"], (1100, 1100))
        print(f"Rendered {preview_path}")
        print(f"Rendered {top_preview_path}")


if __name__ == "__main__":
    main()
