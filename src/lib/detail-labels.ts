import type { DifficultyLevel } from "@/types/game";

/** Portuguese labels for result detail keys. */
export const DETAIL_LABELS: Record<string, string> = {
  level: "Etapa",
  sequenceLength: "Sequência",
  errors: "Tentativas",
  maxErrors: "Limite da sessão",
  turns: "Turnos",
  won: "Vitória",
  starsCollected: "Luzes coletadas",
  totalStars: "Total de luzes",
  blockedMoves: "Bloqueios",
  difficulty: "Modo",
  routeNumber: "Rota",
  routeStage: "Etapa da rota",
  nextRouteNumber: "Pr\u00f3xima rota",
  nextRouteStage: "Pr\u00f3xima etapa",
  journeyCompleted: "Jornada conclu\u00edda",
  trapsTriggered: "Armadilhas ativadas",
  chestOpened: "Baú aberto",
  rewardChosen: "Ferramenta escolhida",
  rewardSpent: "Ferramenta usada",
  wallBroken: "Parede quebrada",
  currentStep: "Etapa atual",
  currentNumber: "Número atual",
  roundsCompleted: "Rodadas concluídas",
  correctNumbers: "Números corretos",
  panelsCompleted: "Painéis concluídos",
  movesUsed: "Movimentos usados",
  movesRemaining: "Movimentos restantes",
  targetCompleted: "Objetivo concluído",
  foundObjects: "Objetos encontrados",
  totalObjects: "Objetos da lista",
  completed: "Exploração concluída",
};

export const DIFFICULTY_PT: Record<DifficultyLevel, string> = {
  easy: "Aberto",
  medium: "Equilibrado",
  hard: "Desafiador",
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

export interface ResultDetailLine {
  key: string;
  label: string;
  value: string;
}

/**
 * The details a result screen lists. Without options: every stored detail that
 * is not an object, in stored order, with the shared labels. A game may list
 * only `detailKeys` (in that order) and name its own modes (`modeLabels`, for
 * the `difficulty` detail) — see `getResultPresentation` in engine/rewards.
 */
export function formatResultDetails(
  details: Record<string, unknown>,
  options: {
    detailKeys?: readonly string[] | null;
    modeLabels?: Readonly<Record<DifficultyLevel, string>> | null;
  } = {},
): ResultDetailLine[] {
  const keys = options.detailKeys ?? Object.keys(details);
  return keys.flatMap((key) => {
    const value = details[key];
    if (typeof value !== "number" && typeof value !== "string" && typeof value !== "boolean") return [];
    const mode =
      key === "difficulty" && options.modeLabels && (value === "easy" || value === "medium" || value === "hard")
        ? options.modeLabels[value]
        : null;
    return [{ key, label: formatDetailKeyPt(key), value: mode ?? formatDetailValuePt(value) }];
  });
}
