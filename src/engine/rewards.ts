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

interface WorldRewardCopy {
  successTitle: string;
  successSubtitle: string;
  attemptSubtitle: string;
  registeredLine: string;
}

const DEFAULT_REWARD_COPY: WorldRewardCopy = {
  successTitle: "Circuito ativado",
  successSubtitle: "Você praticou memória e atenção.",
  attemptSubtitle: "Você praticou memória e atenção.",
  registeredLine: "O circuito foi registrado na sua jornada.",
};

/** Reward copy per game; unknown ids (older saved results) use the default. */
const WORLD_REWARD_COPY: Record<GameResult["gameId"], WorldRewardCopy> = {
  "color-sequence": DEFAULT_REWARD_COPY,
  "escape-maze": {
    successTitle: "Rota concluída",
    successSubtitle: "Você praticou planejamento e estratégia.",
    attemptSubtitle: "Você praticou escolha de caminho e tomada de decisão.",
    registeredLine: "A rota foi registrada na sua jornada.",
  },
  "security-panel": {
    successTitle: "Central ativada",
    successSubtitle: "Você praticou foco e sequência.",
    attemptSubtitle: "Você praticou observação e controle de passos.",
    registeredLine: "A central foi registrada na sua jornada.",
  },
  "number-trail": {
    successTitle: "Trilha concluída",
    successSubtitle: "Você praticou atenção e ordem lógica.",
    attemptSubtitle: "Você praticou atenção visual e sequência.",
    registeredLine: "A trilha foi registrada na sua jornada.",
  },
  "seed-garden": {
    successTitle: "Jardim equilibrado",
    successSubtitle: "Você praticou contagem, planejamento e atenção.",
    attemptSubtitle: "Você praticou planejamento e causa e efeito.",
    registeredLine: "O jardim foi registrado na sua jornada.",
  },
};

/** Portuguese reward messages for the result modal. */
export function getRewardCopy(
  result: Pick<GameResult, "gameId" | "score" | "details">,
): RewardCopy {
  const success = isSuccessfulResult(result);
  const worldCopy = WORLD_REWARD_COPY[result.gameId] ?? DEFAULT_REWARD_COPY;

  if (success) {
    return {
      title: worldCopy.successTitle,
      subtitle: worldCopy.successSubtitle,
      progressLine: worldCopy.registeredLine,
      encouragement: "Continue sua rota no seu ritmo. Cada prática conta.",
    };
  }

  return {
    title: "Boa tentativa!",
    subtitle: worldCopy.attemptSubtitle,
    progressLine: "Esta prática foi registrada na sua jornada.",
    encouragement: "Observe com calma e tente novamente no seu ritmo.",
  };
}
