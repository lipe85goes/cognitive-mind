"""Generate the Rota Estrategica trap prop asset."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent))

from route_prop_asset_utils import (
    add_camera_and_lights,
    add_cone,
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
        "TrapShadow": make_material("TrapShadow", (0.012, 0.006, 0.006, 1), 0.0, 1.0),
        "TrapDarkBase": make_material("TrapDarkBase", (0.16, 0.08, 0.055, 1), 0.12, 0.7),
        "TrapBronze": make_material("TrapBronze", (0.68, 0.38, 0.16, 1), 0.68, 0.38),
        "TrapCrystalRed": make_material(
            "TrapCrystalRed",
            (0.98, 0.15, 0.12, 1),
            0.0,
            0.26,
            emission=(0.78, 0.04, 0.03),
            emission_strength=1.7,
        ),
        "TrapCrystalHighlight": make_material(
            "TrapCrystalHighlight",
            (1.0, 0.44, 0.34, 1),
            0.0,
            0.18,
            emission=(0.95, 0.12, 0.08),
            emission_strength=1.2,
        ),
    }


def build_trap(materials) -> None:
    add_cylinder("Trap_Shadow", (0, 0.006, 0), 0.30, 0.012, materials["TrapShadow"])
    add_cylinder("Trap_Base", (0, 0.045, 0), 0.29, 0.09, materials["TrapDarkBase"], 40)
    add_torus("Trap_Base_Trim", (0, 0.095, 0), 0.24, 0.022, materials["TrapBronze"])
    add_cone("Trap_Main_Crystal", (0, 0.36, 0), 0.19, 0.035, 0.56, materials["TrapCrystalRed"], vertices=5, smooth=False)
    add_cone("Trap_Left_Shard", (-0.13, 0.25, 0.04), 0.08, 0.018, 0.32, materials["TrapCrystalRed"], vertices=5, smooth=False, rotation=(0.12, 0, -0.25))
    add_cone("Trap_Right_Shard", (0.13, 0.24, -0.035), 0.075, 0.018, 0.29, materials["TrapCrystalRed"], vertices=5, smooth=False, rotation=(-0.08, 0, 0.28))
    add_sphere("Trap_Tip_Highlight", (-0.025, 0.57, -0.06), 0.035, materials["TrapCrystalHighlight"], target_scale=(0.7, 1.0, 0.45), segments=14, rings=8)


def main() -> None:
    args = parse_prop_args("trap", "Create route trap GLB.")
    clear_scene()
    build_trap(create_materials())
    output_path = Path(args.output).resolve()
    preview_path = Path(args.preview_output).resolve()
    top_preview_path = Path(args.top_preview_output).resolve()
    export_glb(output_path)
    print(f"Exported {output_path}")
    if args.preview:
        cameras = add_camera_and_lights(preview_ortho_scale=1.05, top_ortho_scale=0.9, target=(0, 0, 0.3))
        configure_scene()
        render_preview(preview_path, cameras["preview"], (1100, 1100))
        render_preview(top_preview_path, cameras["top"], (1100, 1100))
        print(f"Rendered {preview_path}")
        print(f"Rendered {top_preview_path}")


if __name__ == "__main__":
    main()
