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
    description:
      "Escolha caminhos, colete todas as luzes e ative o portal de saída.",
    reassurance: "Cada movimento pode ser pensado com calma.",
    steps: [
      "Colete todas as luzes do tabuleiro.",
      "O guardião se move depois de você.",
      "Quando o portal ativar, leve seu explorador até a saída.",
    ],
  },
  "security-panel": {
    originalName: "Painel de Segurança",
    description:
      "Acenda os sistemas da estação — Luz, Som, Água e Energia — seguindo um comando de cada vez.",
    reassurance:
      "Como seguir uma receita: leia o comando inteiro antes de começar.",
    steps: [
      "Veja quais sistemas o comando pede.",
      "Toque nos sistemas na ordem indicada.",
      "Finalize em Ativar para acender a central.",
    ],
  },
  "number-trail": {
    originalName: "Trilha de Números",
    description:
      "Toque nas pedras numeradas, em ordem, e veja a trilha se acender atrás de você.",
    reassurance: "A ordem muda a cada trilha; não há cronômetro.",
    steps: [
      "Veja o número da próxima pedra.",
      "Toque nas pedras na ordem certa.",
      "Ilumine a trilha completa no seu ritmo.",
    ],
  },
  "seed-garden": {
    originalName: "Jogo de planejamento e contagem",
    description:
      "Semeie como em um jardim de verdade: o vaso escolhido se esvazia e cada semente cai no vaso seguinte.",
    reassurance:
      "Escolher um vaso só mostra a prévia — nada é gasto até você distribuir.",
    steps: [
      "Toque em um vaso com sementes.",
      "Veja a prévia: cada semente vai para o vaso seguinte, uma a uma.",
      "Deixe 3 vasos com 3 sementes para o jardim florescer.",
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
