import { GAME_WORLDS, type WorldKey } from "@/data/worlds";
import type { GameId } from "@/types/game";

export interface GameIntroContent {
  title: string;
  originalName: string;
  description: string;
  skill: string;
  reassurance: string;
  image: string;
  world: WorldKey;
  steps: [string, string, string];
}

/** Intro-only copy; title/skill/image/world come from the worlds registry. */
const INTRO_COPY: Record<
  GameId,
  Pick<GameIntroContent, "originalName" | "description" | "reassurance" | "steps">
> = {
  "color-sequence": {
    originalName: "Sequência de Cores",
    description: "Observe as luzes do circuito e reative o padrão na mesma ordem.",
    reassurance: "Observe primeiro. Responda somente quando estiver pronto.",
    steps: [
      "Observe as luzes coloridas que acendem.",
      "Toque nos pads na mesma sequência.",
      "Ative circuitos maiores no seu ritmo.",
    ],
  },
  "escape-maze": {
    originalName: "Labirinto de Fuga",
    description: "Escolha caminhos em um pequeno tabuleiro e encontre a saída.",
    reassurance: "Cada movimento pode ser pensado com calma.",
    steps: [
      "Leve seu explorador até a saída.",
      "O guardião se move depois de você.",
      "Colete luzes se desejar ampliar sua rota.",
    ],
  },
  "security-panel": {
    originalName: "Painel de Segurança",
    description: "Acione controles táteis seguindo uma instrução de cada vez.",
    reassurance: "Leia o comando inteiro antes de começar.",
    steps: [
      "Observe a instrução com atenção.",
      "Ative botões e fios na ordem indicada.",
      "Confirme para acender a central.",
    ],
  },
  "number-trail": {
    originalName: "Trilha de Números",
    description: "Encontre as peças numéricas e ilumine uma rota de atenção.",
    reassurance: "A sequência muda; não há cronômetro.",
    steps: [
      "Encontre o número indicado.",
      "Toque nos números na ordem indicada.",
      "Complete a trilha no seu ritmo.",
    ],
  },
  "seed-garden": {
    originalName: "Jogo de planejamento e contagem",
    description: "Distribua sementes em vasos e ajude seu jardim a florescer.",
    reassurance: "Escolha, visualize e distribua sem pressa.",
    steps: [
      "Escolha um vaso com sementes.",
      "As sementes serão distribuídas nos próximos vasos.",
      "Complete o objetivo usando poucos movimentos.",
    ],
  },
};

/** Calm welcome copy and illustration for each cognitive mini-world. */
export const GAME_INTROS: Record<GameId, GameIntroContent> = Object.fromEntries(
  (Object.keys(INTRO_COPY) as GameId[]).map((gameId) => {
    const world = GAME_WORLDS[gameId];
    return [
      gameId,
      {
        ...INTRO_COPY[gameId],
        title: world.name,
        skill: world.skill,
        image: world.image,
        world: world.world,
      },
    ];
  }),
) as Record<GameId, GameIntroContent>;
