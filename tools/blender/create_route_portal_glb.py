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
            (0.2, 0.95, 0.48, 1),
            0.0,
            0.22,
            emission=(0.06, 0.9, 0.36),
            emission_strength=4.2,
        ),
        "PortalGlassCore": make_material(
            "PortalGlassCore",
            (0.38, 1.0, 0.62, 1),
            0.0,
            0.12,
            emission=(0.08, 1.0, 0.44),
            emission_strength=2.8,
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
    add_cylinder("Portal_Shadow", (0, 0.006, 0.0), 0.38, 0.012, materials["PortalShadow"])
    add_box("Portal_Base", (0, 0.055, 0.02), (0.74, 0.11, 0.44), materials["PortalStone"], 0.035)
    add_box("Portal_Base_Trim", (0, 0.13, 0.02), (0.66, 0.045, 0.34), materials["PortalBronze"], 0.018)
    add_cylinder("Portal_Left_Pillar", (-0.25, 0.38, 0.02), 0.105, 0.56, materials["PortalStone"], 24)
    add_cylinder("Portal_Right_Pillar", (0.25, 0.38, 0.02), 0.105, 0.56, materials["PortalStone"], 24)
    add_cylinder("Portal_Left_Cap", (-0.25, 0.68, 0.02), 0.13, 0.08, materials["PortalBronze"], 24)
    add_cylinder("Portal_Right_Cap", (0.25, 0.68, 0.02), 0.13, 0.08, materials["PortalBronze"], 24)
    add_torus("Portal_Arch_Bronze", (0, 0.54, -0.04), 0.30, 0.045, materials["PortalBronze"], face_front=True)
    add_torus("Portal_Arch_Glow", (0, 0.54, -0.07), 0.22, 0.026, materials["PortalGreenGlow"], face_front=True)
    add_sphere(
        "Portal_Glow_Core",
        (0, 0.49, -0.09),
        0.19,
        materials["PortalGlassCore"],
        target_scale=(0.9, 1.35, 0.18),
        segments=36,
        rings=18,
    )
    add_sphere("Portal_Top_Gem", (0, 0.77, -0.01), 0.065, materials["PortalBlueGem"], target_scale=(1, 0.75, 1))


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
