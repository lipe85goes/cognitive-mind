import type { DifficultyLevel } from "@/types/game";

/** Portuguese labels for result detail keys. */
export const DETAIL_LABELS: Record<string, string> = {
  level: "Etapa",
  sequenceLength: "Sequência",
  errors: "Erros",
  maxErrors: "Máx. erros",
  turns: "Turnos",
  won: "Vitória",
  starsCollected: "Luzes coletadas",
  totalStars: "Total de luzes",
  blockedMoves: "Bloqueios",
  difficulty: "Dificuldade",
  currentStep: "Etapa atual",
  currentNumber: "Número atual",
  roundsCompleted: "Rodadas concluídas",
  correctNumbers: "Números corretos",
  panelsCompleted: "Painéis concluídos",
  movesUsed: "Movimentos usados",
  movesRemaining: "Movimentos restantes",
  targetCompleted: "Objetivo concluído",
};

export const DIFFICULTY_PT: Record<DifficultyLevel, string> = {
  easy: "Fácil",
  medium: "Médio",
  hard: "Difícil",
};

export function formatDetailKeyPt(key: string): string {
  return DETAIL_LABELS[key] ?? key.replace(/([A-Z])/g, " $1").trim();
}

export function formatDetailValuePt(value: number | string | boolean): string {
  if (typeof value === "boolean") return value ? "Sim" : "Não";
  if (value === "easy" || value === "medium" || value === "hard") {
    return DIFFICULTY_PT[value];
  }
  return String(value);
}
