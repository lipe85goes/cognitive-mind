export type MemoryPadId = 0 | 1 | 2 | 3;

export interface MemoryPadLayout {
  id: MemoryPadId;
  name: string;
  swatch: string;
  symbol: string;
  element: "flame" | "wave" | "leaf" | "sun";
  x: string;
  y: string;
}

export const MEMORY_CIRCUIT_BOARD_IMAGE =
  "/illustrations/memory-circuit/memory-circuit-board-v1.png";

export const MEMORY_PAD_LAYOUTS = [
  {
    id: 0,
    name: "Vermelho",
    swatch: "#ef5b3e",
    symbol: "Chama",
    element: "flame",
    x: "34%",
    y: "32%",
  },
  {
    id: 1,
    name: "Azul",
    swatch: "#1f7bd6",
    symbol: "Onda",
    element: "wave",
    x: "67%",
    y: "32%",
  },
  {
    id: 2,
    name: "Verde",
    swatch: "#2f9e44",
    symbol: "Folha",
    element: "leaf",
    x: "33%",
    y: "70%",
  },
  {
    id: 3,
    name: "Amarelo",
    swatch: "#e6aa12",
    symbol: "Sol",
    element: "sun",
    x: "68%",
    y: "70%",
  },
] as const satisfies readonly MemoryPadLayout[];
