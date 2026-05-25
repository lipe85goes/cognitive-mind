import type { GameResult } from "@/types/game";

/**
 * Internal score tiers used as activation signals in the interface.
 * The scoring shape is preserved so saved results keep the same behavior.
 */
export function calculateStars(score: number): number {
  if (score >= 300) return 3;
  if (score >= 150) return 2;
  if (score > 0) return 1;
  return 0;
}

/** Whether the session counts as a successful completion for rewards/confetti. */
export function isSuccessfulResult(
  result: Pick<GameResult, "details" | "score">,
): boolean {
  if (result.details.won === true) return true;
  if (result.details.won === false) return false;

  if (typeof result.details.panelsCompleted === "number") {
    return result.details.panelsCompleted > 0;
  }

  if (typeof result.details.level === "number") {
    return result.details.level > 1;
  }

  return result.score >= 150;
}

export interface RewardCopy {
  title: string;
  subtitle: string;
  progressLine: string;
  encouragement: string;
}

/** Portuguese reward messages for the result modal. */
export function getRewardCopy(
  result: Pick<GameResult, "activityTitle" | "score" | "details">,
  stars: number,
): RewardCopy {
  const success = isSuccessfulResult(result);
  const title = result.activityTitle.toLowerCase();
  const worldCopy = title.includes("rota")
    ? {
        successTitle: "Rota concluída",
        successSubtitle: "Você praticou planejamento e estratégia.",
        attemptSubtitle: "Você praticou escolha de caminho e tomada de decisão.",
        unit: "rota",
      }
    : title.includes("central")
      ? {
          successTitle: "Central ativada",
          successSubtitle: "Você praticou foco e sequência.",
          attemptSubtitle: "Você praticou observação e controle de passos.",
          unit: "central",
        }
      : title.includes("trilha")
        ? {
            successTitle: "Trilha concluída",
            successSubtitle: "Você praticou atenção e ordem lógica.",
            attemptSubtitle: "Você praticou atenção visual e sequência.",
            unit: "trilha",
          }
        : title.includes("jardim")
          ? {
              successTitle: "Jardim equilibrado",
              successSubtitle: "Você praticou contagem, planejamento e atenção.",
              attemptSubtitle: "Você praticou planejamento e causa e efeito.",
              unit: "jardim",
            }
        : {
            successTitle: "Circuito ativado",
            successSubtitle: "Você praticou memória e atenção.",
            attemptSubtitle: "Você praticou memória e atenção.",
            unit: "circuito",
          };

  if (success) {
    const progressLine =
      stars === 1
        ? `${worldCopy.unit[0].toUpperCase()}${worldCopy.unit.slice(1)} iniciado com atenção.`
        : stars === 2
          ? `${worldCopy.unit[0].toUpperCase()}${worldCopy.unit.slice(1)} bem ativado.`
          : stars >= 3
            ? `${worldCopy.unit[0].toUpperCase()}${worldCopy.unit.slice(1)} ativado com firmeza.`
            : "Continue praticando para abrir novos caminhos.";

    return {
      title: worldCopy.successTitle,
      subtitle: worldCopy.successSubtitle,
      progressLine,
      encouragement: "Continue sua rota no seu ritmo. Cada prática conta.",
    };
  }

  const progressLine =
    stars > 0
      ? "Você manteve o circuito em movimento."
      : "Quase lá — tente outra rota com calma.";

  return {
    title: "Boa tentativa!",
    subtitle: worldCopy.attemptSubtitle,
    progressLine,
    encouragement: "Observe com calma e tente novamente no seu ritmo.",
  };
}

export function totalActivationSignalsFromResults(
  results: Pick<GameResult, "score">[],
): number {
  return results.reduce((sum, r) => sum + calculateStars(r.score), 0);
}
