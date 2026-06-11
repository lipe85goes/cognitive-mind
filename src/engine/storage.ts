import type { GameResult } from "@/types/game";

const STORAGE_KEY = "cognitive-mind-recent-results";
const MAX_RESULTS = 12;

/** Shape check so one malformed stored entry can't break the dashboard. */
function isStoredResult(value: unknown): value is GameResult {
  if (typeof value !== "object" || value === null) return false;
  const result = value as Record<string, unknown>;
  return (
    typeof result.id === "string" &&
    typeof result.gameId === "string" &&
    typeof result.activityTitle === "string" &&
    typeof result.score === "number" &&
    typeof result.playedAt === "string" &&
    typeof result.summary === "string" &&
    typeof result.details === "object" &&
    result.details !== null
  );
}

/** Read recent game results from localStorage (client-only). */
export function getRecentResults(): GameResult[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isStoredResult) : [];
  } catch {
    return [];
  }
}

/** Persist a new result at the front of the list. */
export function saveGameResult(
  result: Omit<GameResult, "id" | "playedAt">,
): GameResult {
  const entry: GameResult = {
    ...result,
    id: `${result.gameId}-${Date.now()}`,
    playedAt: new Date().toISOString(),
  };

  const existing = getRecentResults();
  const updated = [entry, ...existing].slice(0, MAX_RESULTS);

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  return entry;
}

/** Format ISO date for the dashboard list. */
export function formatPlayedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
