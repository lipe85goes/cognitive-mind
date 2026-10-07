import type { DifficultyLevel, GameResult } from "@/types/game";

/** Whether the session counts as a successful completion for rewards/confetti. */
export function isSuccessfulResult(
  result: Pick<GameResult, "details" | "score">,
): boolean {
  if (result.details.won === true) return true;
  if (result.details.won === false) return false;
  // A game without winning or losing (the Estúdio) says it finished.
  if (result.details.completed === true) return true;

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
  /**
   * How the result screen presents this game's record (GAME03-EXPERIENCE-02,
   * the platform's second consumer). Every field is optional: a game without
   * them is shown exactly as before.
   */
  presentation?: Partial<ResultPresentation>;
}

/** What the result screen shows of a record, beyond its copy. */
export interface ResultPresentation {
  /** The score card's caption. */
  scoreLabel: string;
  /**
   * The details listed, in this order; absent = every stored detail, in stored
   * order. A detail left out is still in the saved result, only not listed.
   */
  detailKeys: readonly string[] | null;
  /** The game's own names for its difficulty levels (the `difficulty` detail). */
  modeLabels: Readonly<Record<DifficultyLevel, string>> | null;
}

const DEFAULT_PRESENTATION: ResultPresentation = {
  scoreLabel: "Registro da prática",
  detailKeys: null,
  modeLabels: null,
};

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
  "hidden-objects": {
    successTitle: "Estúdio explorado",
    successSubtitle: "Você praticou atenção e observação.",
    attemptSubtitle: "Você praticou atenção e observação.",
    registeredLine: "A exploração foi registrada na sua jornada.",
    // The score is how many objects were found: it says so, the screen names the
    // modes as the game does, and "concluída: Sim" or the list size repeat nothing.
    presentation: {
      scoreLabel: "Objetos encontrados",
      detailKeys: ["difficulty"],
      modeLabels: { easy: "Fácil", medium: "Médio", hard: "Difícil" },
    },
  },
  "seed-garden": {
    successTitle: "Jardim equilibrado",
    successSubtitle: "Você praticou contagem, planejamento e atenção.",
    attemptSubtitle: "Você praticou planejamento e causa e efeito.",
    registeredLine: "O jardim foi registrado na sua jornada.",
  },
};

/** How the result screen presents a record; unknown ids (older saved results) use the defaults. */
export function getResultPresentation(result: Pick<GameResult, "gameId">): ResultPresentation {
  const own = WORLD_REWARD_COPY[result.gameId]?.presentation;
  return { ...DEFAULT_PRESENTATION, ...own };
}

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
