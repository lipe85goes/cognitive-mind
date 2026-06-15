import type { WorldKey } from "@/data/worlds";

/** Per-world material colors for the 3D prototype (kept close to the CSS world tones). */
export interface World3DPalette {
  /** Pedestal / primary surface. */
  base: string;
  /** Darker shade for bodies and shadowed faces. */
  deep: string;
  /** Emissive accent used for the selection halo and key glows. */
  glow: string;
  /** Vivid accents for per-world details (pads, buttons, crystals…). */
  accents: string[];
}

export const WORLD_3D_PALETTE: Record<WorldKey, World3DPalette> = {
  memory: {
    base: "#cf4964",
    deep: "#7c2238",
    glow: "#ff8fa3",
    accents: ["#ef4444", "#38bdf8", "#34d399", "#fbbf24"],
  },
  route: {
    base: "#2f80a2",
    deep: "#143f52",
    glow: "#7dd3fc",
    accents: ["#38bdf8", "#fb923c", "#34d399"],
  },
  commands: {
    base: "#149089",
    deep: "#0a403b",
    glow: "#5eead4",
    accents: ["#fbbf24", "#38bdf8", "#fb7185"],
  },
  logic: {
    base: "#5570b6",
    deep: "#2a3c6b",
    glow: "#a5b4fc",
    accents: ["#a78bfa", "#60a5fa", "#34d399"],
  },
  garden: {
    base: "#5d934e",
    deep: "#2c4a26",
    glow: "#bbf7d0",
    accents: ["#84cc16", "#22c55e", "#a3e635"],
  },
};
