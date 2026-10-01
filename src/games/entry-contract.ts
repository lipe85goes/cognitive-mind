import type { GameId } from "@/types/game";

/**
 * How the entry shell learns that a game has painted.
 *
 * - `explicit`: the game calls `onEntryReady` itself once its essential visual
 *   assets have painted; the shell waits for that call.
 * - `frame-fallback`: the game never reports; the shell treats it as ready two
 *   animation frames after mounting it.
 */
export type GameReadiness = "explicit" | "frame-fallback";

/**
 * What the platform needs to know about a game to bring the Explorador into
 * it. Metadata only: this module imports no game implementation, so the entry
 * shell can read it before (and without) loading the game's code.
 */
export interface GameEntryContract {
  readiness: GameReadiness;
  /**
   * Window for the entry watchdog's "preparing" phase. Omit it to use the
   * shell's default; declare it only when the game's first paint legitimately
   * takes longer than that.
   */
  entryWatchdogMs?: number;
}

/**
 * Entry contract of every playable game. `GAME_REGISTRY` pairs each one with
 * its component; add new games to both.
 */
export const GAME_ENTRY_CONTRACTS: Record<GameId, GameEntryContract> = {
  "color-sequence": { readiness: "explicit" },
  /**
   * A Rota inicializa uma engine 3D e carrega GLBs antes do primeiro frame; em
   * produção, medido com cache desligado, ela leva de 9,5 s (tablet) a 14,8 s
   * (mobile 390 com DPR 2) do CTA até a cena revelada. Com os 12 s padrão, o
   * watchdog disparava DURANTE um carregamento legítimo e mandava o Explorador
   * para o painel de erro. A janela é ampliada só para este mundo — os demais
   * seguem no padrão, porque só pintam imagens.
   */
  "escape-maze": { readiness: "explicit", entryWatchdogMs: 28_000 },
  "security-panel": { readiness: "frame-fallback" },
  "number-trail": { readiness: "frame-fallback" },
  "seed-garden": { readiness: "frame-fallback" },
};
