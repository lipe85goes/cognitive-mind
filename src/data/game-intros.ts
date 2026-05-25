import type { GameId } from "@/types/game";

export interface GameIntroContent {
  title: string;
  steps: [string, string, string];
}

/** Simple “Como jogar” copy shown before each activity starts. */
export const GAME_INTROS: Record<GameId, GameIntroContent> = {
  "color-sequence": {
    title: "Sequência de Cores",
    steps: [
      "Observe as cores que acendem.",
      "Depois toque nas cores na mesma ordem.",
      "Tente lembrar a maior sequência possível.",
    ],
  },
  "escape-maze": {
    title: "Labirinto de Fuga",
    steps: [
      "Leve o personagem até a saída.",
      "O guardião se move depois de você.",
      "Pense com calma antes de escolher a direção.",
    ],
  },
  "security-panel": {
    title: "Painel de Segurança",
    steps: [
      "Leia a instrução com atenção.",
      "Toque nos itens na ordem certa.",
      "Confirme quando terminar.",
    ],
  },
  "number-trail": {
    title: "Trilha de Números",
    steps: [
      "Encontre o número indicado.",
      "Toque nos números na ordem indicada.",
      "Complete a sequência no seu ritmo.",
    ],
  },
  "seed-garden": {
    title: "Jardim de Sementes",
    steps: [
      "Escolha um vaso com sementes.",
      "As sementes serão distribuídas nos próximos vasos.",
      "Complete o objetivo usando poucos movimentos.",
    ],
  },
};
