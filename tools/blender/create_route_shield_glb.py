"""Generate the Rota Estrategica shield pickup prop asset."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent))

from route_prop_asset_utils import (
    add_camera_and_lights,
    add_cylinder,
    add_flat_prism,
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
        "ShieldShadow": make_material("ShieldShadow", (0.006, 0.01, 0.014, 1), 0.0, 1.0),
        "ShieldDarkBase": make_material("ShieldDarkBase", (0.04, 0.08, 0.14, 1), 0.16, 0.58),
        "ShieldBronze": make_material("ShieldBronze", (0.72, 0.46, 0.18, 1), 0.68, 0.36),
        "ShieldBlue": make_material(
            "ShieldBlue",
            (0.12, 0.48, 0.95, 1),
            0.0,
            0.24,
            emission=(0.02, 0.20, 0.72),
            emission_strength=0.8,
        ),
        "ShieldCyanGlow": make_material(
            "ShieldCyanGlow",
            (0.42, 0.86, 1.0, 1),
            0.0,
            0.16,
            emission=(0.12, 0.58, 1.0),
            emission_strength=2.8,
        ),
    }


def build_shield(materials) -> None:
    add_cylinder("Shield_Shadow", (0, 0.006, 0), 0.31, 0.012, materials["ShieldShadow"])
    add_cylinder("Shield_Base", (0, 0.045, 0), 0.28, 0.09, materials["ShieldDarkBase"], 48)
    add_torus("Shield_Base_Glow", (0, 0.095, 0), 0.23, 0.023, materials["ShieldCyanGlow"])
    add_cylinder("Shield_Stand", (0, 0.25, 0.06), 0.055, 0.32, materials["ShieldBronze"], 24)
    shield_points = [(-0.22, 0.20), (0.22, 0.20), (0.18, -0.10), (0.0, -0.34), (-0.18, -0.10)]
    add_flat_prism("Shield_Body", (0, 0.48, -0.06), shield_points, 0.085, materials["ShieldBlue"])
    star_points = [
        (0.0, 0.13),
        (0.045, 0.035),
        (0.14, 0.025),
        (0.065, -0.035),
        (0.085, -0.13),
        (0.0, -0.075),
        (-0.085, -0.13),
        (-0.065, -0.035),
        (-0.14, 0.025),
        (-0.045, 0.035),
    ]
    add_flat_prism("Shield_Star_Glow", (0, 0.47, -0.115), star_points, 0.035, materials["ShieldCyanGlow"])
    add_sphere("Shield_Top_Gem", (0, 0.7, -0.06), 0.055, materials["ShieldCyanGlow"], target_scale=(1, 0.75, 0.7), segments=18, rings=10)


def main() -> None:
    args = parse_prop_args("shield", "Create route shield GLB.")
    clear_scene()
    build_shield(create_materials())
    output_path = Path(args.output).resolve()
    preview_path = Path(args.preview_output).resolve()
    top_preview_path = Path(args.top_preview_output).resolve()
    export_glb(output_path)
    print(f"Exported {output_path}")
    if args.preview:
        cameras = add_camera_and_lights(preview_ortho_scale=1.05, top_ortho_scale=0.9, target=(0, 0, 0.32))
        configure_scene()
        render_preview(preview_path, cameras["preview"], (1100, 1100))
        render_preview(top_preview_path, cameras["top"], (1100, 1100))
        print(f"Rendered {preview_path}")
        print(f"Rendered {top_preview_path}")


if __name__ == "__main__":
    main()
