import type { Activity } from "@/types/game";

/**
 * All platform activities. Only entries with status "available" are playable.
 * Add new activities here and wire them in games/index.ts.
 */
export const ACTIVITIES: Activity[] = [
  {
    id: "color-sequence",
    gameId: "color-sequence",
    title: "Sequência de Cores",
    description: "Circuito de Memória: repita padrões de cores com atenção.",
    status: "available",
    icon: "🎨",
  },
  {
    id: "escape-maze",
    gameId: "escape-maze",
    title: "Labirinto de Fuga",
    description: "Rota Estratégica: escolha caminhos e evite o guardião.",
    status: "available",
    icon: "🧩",
  },
  {
    id: "security-panel",
    gameId: "security-panel",
    title: "Painel de Segurança",
    description:
      "Central de Comandos: siga instruções e ative o painel.",
    status: "available",
    icon: "🛡️",
  },
  {
    id: "hidden-objects",
    gameId: "hidden-objects",
    title: "Estúdio das Descobertas",
    description: "Explore e encontre: observe o estúdio e descubra os objetos da lista.",
    status: "available",
    icon: "🔎",
  },
  {
    id: "seed-garden",
    gameId: "seed-garden",
    title: "Jardim de Sementes",
    description:
      "Jogo de planejamento e contagem: distribua sementes entre vasos.",
    status: "available",
    icon: "🌱",
  },
  {
    id: "quick-tap",
    title: "Toque Rápido",
    description: "Toque nos alvos assim que aparecerem.",
    status: "locked",
    icon: "⚡",
  },
  {
    id: "pattern-match",
    title: "Padrões Iguais",
    description: "Encontre o padrão igual.",
    status: "locked",
    icon: "🔍",
  },
  {
    id: "word-sprint",
    title: "Caça-Palavras",
    description: "Encontre palavras escondidas.",
    status: "locked",
    icon: "📝",
  },
  {
    id: "path-planner",
    title: "Planeje o Caminho",
    description: "Planeje o melhor caminho.",
    status: "locked",
    icon: "🗺️",
  },
  {
    id: "focus-grid",
    title: "Grade de Foco",
    description: "Encontre o elemento diferente.",
    status: "locked",
    icon: "👁️",
  },
  {
    id: "dual-task",
    title: "Dupla Tarefa",
    description: "Faça duas tarefas simples ao mesmo tempo.",
    status: "locked",
    icon: "🎯",
  },
];
