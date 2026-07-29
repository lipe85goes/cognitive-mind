export type MemoryPadId = 0 | 1 | 2 | 3;

export interface MemoryPadLayout {
  id: MemoryPadId;
  name: string;
  swatch: string;
  symbol: string;
  element: "flame" | "wave" | "leaf" | "sun";
  /** Overlay transparente do estado aceso — mesmo enquadramento do board. */
  overlay: string;
  /** Centro do hitbox, em % da caixa do board (projeção exata da câmera). */
  x: string;
  y: string;
  /** Diâmetro do hitbox em % da largura do board (pad ~21.9% + folga tátil). */
  size: string;
}

/**
 * Caminho ativo (RESET-CIRCUIT-MAX): um board MESTRE único 2.5D com os 4 pads
 * integrados + overlays transparentes renderizados pela MESMA câmera na mesma
 * resolução (1280x1024) — alinhamento pixel-perfeito por construção. Gerados
 * por tools/blender/create_memory_circuit_visual_v2.py.
 */
export const MEMORY_CIRCUIT_ASSETS = {
  background: "/illustrations/memory-circuit/memory-room-bg.webp",
  board: "/assets/memory-circuit/v2/memory-board.webp",
  corePulse: "/assets/memory-circuit/v2/overlay-core.webp",
  complete: "/assets/memory-circuit/v2/overlay-complete.webp",
} as const;

/** Proporção da renderização do board mestre (1280x1024). */
export const MEMORY_BOARD_ASPECT = "5 / 4";

export const MEMORY_PAD_LAYOUTS = [
  {
    id: 0,
    name: "Vermelho",
    swatch: "#ef5b3e",
    symbol: "Chama",
    element: "flame",
    overlay: "/assets/memory-circuit/v2/overlay-flame.webp",
    x: "50%",
    y: "27.5%",
    size: "24%",
  },
  {
    id: 1,
    name: "Azul",
    swatch: "#1f7bd6",
    symbol: "Onda",
    element: "wave",
    overlay: "/assets/memory-circuit/v2/overlay-wave.webp",
    x: "73.9%",
    y: "51.4%",
    size: "24%",
  },
  {
    id: 2,
    name: "Verde",
    swatch: "#2f9e44",
    symbol: "Folha",
    element: "leaf",
    overlay: "/assets/memory-circuit/v2/overlay-leaf.webp",
    x: "26.1%",
    y: "51.4%",
    size: "24%",
  },
  {
    id: 3,
    name: "Amarelo",
    swatch: "#e6aa12",
    symbol: "Sol",
    element: "sun",
    overlay: "/assets/memory-circuit/v2/overlay-sun.webp",
    x: "50%",
    y: "75.3%",
    size: "24%",
  },
] as const satisfies readonly MemoryPadLayout[];

export function formatMemorySignalCount(count: number) {
  return count === 1 ? "1 sinal" : `${count} sinais`;
}

export function normalizeMemorySignalText(text: string) {
  return text.replace(/\b1 sinais\b/g, "1 sinal");
}
