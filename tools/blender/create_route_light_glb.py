"""Generate the Rota Estrategica collectible light prop asset."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent))

from route_prop_asset_utils import (
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
        "LightShadow": make_material("LightShadow", (0.012, 0.01, 0.006, 1), 0.0, 1.0),
        "LightDarkBase": make_material("LightDarkBase", (0.12, 0.085, 0.045, 1), 0.15, 0.66),
        "LightBronze": make_material("LightBronze", (0.72, 0.45, 0.18, 1), 0.72, 0.34),
        "LightWarmOrb": make_material(
            "LightWarmOrb",
            (1.0, 0.78, 0.22, 1),
            0.0,
            0.16,
            emission=(1.0, 0.68, 0.12),
            emission_strength=4.8,
        ),
        "LightGlassHighlight": make_material(
            "LightGlassHighlight",
            (1.0, 0.96, 0.68, 1),
            0.0,
            0.08,
            emission=(1.0, 0.82, 0.24),
            emission_strength=1.4,
        ),
    }


def build_light(materials) -> None:
    add_cylinder("Light_Shadow", (0, 0.006, 0), 0.28, 0.012, materials["LightShadow"])
    add_cylinder("Light_Base", (0, 0.045, 0), 0.26, 0.09, materials["LightDarkBase"], 48)
    add_torus("Light_Base_Ring", (0, 0.095, 0), 0.22, 0.024, materials["LightBronze"])
    add_cylinder("Light_Pedestal", (0, 0.19, 0), 0.14, 0.18, materials["LightBronze"], 36)
    add_torus("Light_Orb_Cradle", (0, 0.285, 0), 0.13, 0.018, materials["LightBronze"])
    add_sphere("Light_Orb", (0, 0.43, 0), 0.18, materials["LightWarmOrb"], target_scale=(1, 1.08, 1), segments=40, rings=20)
    add_sphere("Light_Orb_Highlight", (-0.045, 0.51, -0.06), 0.045, materials["LightGlassHighlight"], target_scale=(1, 0.7, 0.45), segments=18, rings=10)


def main() -> None:
    args = parse_prop_args("light", "Create route collectible light GLB.")
    clear_scene()
    build_light(create_materials())
    output_path = Path(args.output).resolve()
    preview_path = Path(args.preview_output).resolve()
    top_preview_path = Path(args.top_preview_output).resolve()
    export_glb(output_path)
    print(f"Exported {output_path}")
    if args.preview:
        cameras = add_camera_and_lights(preview_ortho_scale=1.0, top_ortho_scale=0.92, target=(0, 0, 0.28))
        configure_scene()
        render_preview(preview_path, cameras["preview"], (1100, 1100))
        render_preview(top_preview_path, cameras["top"], (1100, 1100))
        print(f"Rendered {preview_path}")
        print(f"Rendered {top_preview_path}")


if __name__ == "__main__":
    main()
