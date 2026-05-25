import type { GameResult } from "@/types/game";

const STORAGE_KEY = "cognitive-mind-recent-results";
const MAX_RESULTS = 12;

/** Read recent game results from localStorage (client-only). */
export function getRecentResults(): GameResult[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GameResult[];
    return Array.isArray(parsed) ? parsed : [];
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
