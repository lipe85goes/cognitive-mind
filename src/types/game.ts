/** Cognitive skill areas used for labeling activities (no medical claims). */
export type CognitiveSkill =
  | "attention"
  | "memory"
  | "planning"
  | "reaction"
  | "spatial";

export type ActivityStatus = "available" | "locked";

export type GameId =
  | "color-sequence"
  | "escape-maze"
  | "security-panel"
  | "number-trail"
  | "seed-garden";

export type DifficultyLevel = "easy" | "medium" | "hard";

/** Activity definition shown on the dashboard. */
export interface Activity {
  id: string;
  gameId?: GameId;
  title: string;
  description: string;
  skill: CognitiveSkill;
  status: ActivityStatus;
  icon: string;
}

/** Outcome of a completed game session. */
export interface GameResult {
  id: string;
  activityId: string;
  activityTitle: string;
  gameId: GameId;
  score: number;
  playedAt: string;
  summary: string;
  details: Record<string, number | string | boolean>;
}

export type DashboardView = "home" | "game" | "result";

/** Props shared by playable game components. */
export interface GameComponentProps {
  onComplete: (result: Omit<GameResult, "id" | "playedAt">) => void;
  onExit: () => void;
  /** Optional continuation hook for games with internal route/session progression. */
  initialRouteNumber?: number;
  /** Entry shell callback after essential visual assets have painted. */
  onEntryReady?: () => void;
  /** Entry shell callback for failures that would expose an incomplete world. */
  onEntryError?: (error: Error) => void;
}

/** Escape Maze game stats tracked during play. */
export interface EscapeMazeStats {
  turns: number;
  won: boolean;
  blockedMoves: number;
  errors: number;
  starsCollected: number;
  totalStars: number;
  score: number;
  difficulty: DifficultyLevel;
}

export interface GridPosition {
  row: number;
  col: number;
}
