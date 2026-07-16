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
 * resolução (1500x1200) — alinhamento pixel-perfeito por construção. Gerados
 * por tools/blender/create_memory_circuit_board.py.
 */
export const MEMORY_CIRCUIT_ASSETS = {
  background: "/illustrations/memory-circuit/memory-room-bg.webp",
  board: "/assets/memory-circuit/memory-board-master.png",
  corePulse: "/assets/memory-circuit/overlay-core-pulse.png",
} as const;

/** Proporção da renderização do board mestre (1500x1200). */
export const MEMORY_BOARD_ASPECT = "5 / 4";

export const MEMORY_PAD_LAYOUTS = [
  {
    id: 0,
    name: "Vermelho",
    swatch: "#ef5b3e",
    symbol: "Chama",
    element: "flame",
    overlay: "/assets/memory-circuit/overlay-flame-active.png",
    x: "50%",
    y: "29.3%",
    size: "24%",
  },
  {
    id: 1,
    name: "Azul",
    swatch: "#1f7bd6",
    symbol: "Onda",
    element: "wave",
    overlay: "/assets/memory-circuit/overlay-wave-active.png",
    x: "73.7%",
    y: "52.4%",
    size: "24%",
  },
  {
    id: 2,
    name: "Verde",
    swatch: "#2f9e44",
    symbol: "Folha",
    element: "leaf",
    overlay: "/assets/memory-circuit/overlay-leaf-active.png",
    x: "26.3%",
    y: "52.4%",
    size: "24%",
  },
  {
    id: 3,
    name: "Amarelo",
    swatch: "#e6aa12",
    symbol: "Sol",
    element: "sun",
    overlay: "/assets/memory-circuit/overlay-sun-active.png",
    x: "50%",
    y: "75.4%",
    size: "24%",
  },
] as const satisfies readonly MemoryPadLayout[];

export function formatMemorySignalCount(count: number) {
  return count === 1 ? "1 sinal" : `${count} sinais`;
}

export function normalizeMemorySignalText(text: string) {
  return text.replace(/\b1 sinais\b/g, "1 sinal");
}
