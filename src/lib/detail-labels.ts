import type { DifficultyLevel } from "@/types/game";

/** Portuguese labels for result detail keys. */
export const DETAIL_LABELS: Record<string, string> = {
  level: "Nível",
  sequenceLength: "Sequência",
  errors: "Erros",
  maxErrors: "Máx. erros",
  turns: "Turnos",
  won: "Vitória",
  blockedMoves: "Bloqueios",
  difficulty: "Dificuldade",
  currentStep: "Etapa atual",
  panelsCompleted: "Painéis concluídos",
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
