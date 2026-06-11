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
    skill: "memory",
    status: "available",
    icon: "🎨",
  },
  {
    id: "escape-maze",
    gameId: "escape-maze",
    title: "Labirinto de Fuga",
    description: "Rota Estratégica: escolha caminhos e evite o guardião.",
    skill: "planning",
    status: "available",
    icon: "🧩",
  },
  {
    id: "security-panel",
    gameId: "security-panel",
    title: "Painel de Segurança",
    description:
      "Central de Comandos: siga instruções e ative o painel.",
    skill: "attention",
    status: "available",
    icon: "🛡️",
  },
  {
    id: "number-trail",
    gameId: "number-trail",
    title: "Trilha de Números",
    description: "Trilha Lógica: siga a ordem indicada pelos números.",
    skill: "attention",
    status: "available",
    icon: "🔢",
  },
  {
    id: "seed-garden",
    gameId: "seed-garden",
    title: "Jardim de Sementes",
    description:
      "Jogo de planejamento e contagem: distribua sementes entre vasos.",
    skill: "planning",
    status: "available",
    icon: "🌱",
  },
  {
    id: "quick-tap",
    title: "Toque Rápido",
    description: "Toque nos alvos assim que aparecerem.",
    skill: "reaction",
    status: "locked",
    icon: "⚡",
  },
  {
    id: "pattern-match",
    title: "Padrões Iguais",
    description: "Encontre o padrão igual.",
    skill: "attention",
    status: "locked",
    icon: "🔍",
  },
  {
    id: "word-sprint",
    title: "Caça-Palavras",
    description: "Encontre palavras escondidas.",
    skill: "memory",
    status: "locked",
    icon: "📝",
  },
  {
    id: "path-planner",
    title: "Planeje o Caminho",
    description: "Planeje o melhor caminho.",
    skill: "planning",
    status: "locked",
    icon: "🗺️",
  },
  {
    id: "focus-grid",
    title: "Grade de Foco",
    description: "Encontre o elemento diferente.",
    skill: "attention",
    status: "locked",
    icon: "👁️",
  },
  {
    id: "dual-task",
    title: "Dupla Tarefa",
    description: "Faça duas tarefas simples ao mesmo tempo.",
    skill: "reaction",
    status: "locked",
    icon: "🎯",
  },
];

/** Portuguese labels for skill areas (used when surfacing skills in UI). */
export const SKILL_LABELS: Record<Activity["skill"], string> = {
  attention: "Atenção",
  memory: "Memória",
  planning: "Planejamento",
  reaction: "Reação",
  spatial: "Espacial",
};
