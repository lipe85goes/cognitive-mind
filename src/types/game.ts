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
  status: ActivityStatus;
  icon: string;
}

/**
 * Where a Rota journey goes next: the Route to open and the mode to open it on.
 * `useEscapeMaze` writes it when a Route ends — won or lost, the next one is
 * N+1 — and only `RouteStrategyGame` reads it back.
 *
 * ROTA-DIFFICULTY-04B: progression remounts the game component, so the mode the
 * player chose dies with the previous instance unless it travels with the Route.
 */
export interface RouteContinuation {
  kind: "escape-maze-route";
  routeNumber: number;
  difficulty: DifficultyLevel;
}

/**
 * A game's request that its next session resume where this one ended instead of
 * starting over.
 *
 * One member per game that resumes, told apart by `kind`; only the game that
 * owns a kind reads its fields. The platform stores the value and hands it back
 * unopened — all it knows is whether there is one: a session that resumes skips
 * the intro, because the Explorador is already mid-journey in that world.
 */
export type GameContinuation = RouteContinuation;

/** Outcome of a completed game session. */
export interface GameResult {
  id: string;
  activityId: string;
  activityTitle: string;
  gameId: GameId;
  score: number;
  playedAt: string;
  summary: string;
  /**
   * What happened, for history, the result screen and metrics. Never read to
   * decide what opens next: that is `continuation`.
   */
  details: Record<string, number | string | boolean>;
  /**
   * The session "play again" resumes, written by the game that produced this
   * result. Absent: "play again" replays the game from its own start. Results
   * saved before the contract existed have none.
   */
  continuation?: GameContinuation;
}

export type DashboardView = "home" | "game" | "result";

/** Props shared by playable game components. */
export interface GameComponentProps {
  onComplete: (result: Omit<GameResult, "id" | "playedAt">) => void;
  onExit: () => void;
  /**
   * The continuation this session resumes, exactly as a session of this game
   * wrote it into `GameResult.continuation`. Undefined for a fresh entry. A game
   * reads only its own `kind` and treats anything else as a fresh entry.
   */
  continuation?: GameContinuation;
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
