import { Clock, Trophy } from "lucide-react";
import { formatPlayedAt } from "@/engine/storage";
import type { GameResult } from "@/types/game";

interface RecentResultsProps {
  results: GameResult[];
}

/** Dashboard recent scores list. */
export function RecentResults({ results }: RecentResultsProps) {
  if (results.length === 0) {
    return (
      <div className="surface-card flex flex-col items-center px-5 py-10 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border-2 border-slate-200 bg-slate-50">
          <Trophy className="h-6 w-6 text-slate-400" strokeWidth={2} aria-hidden />
        </div>
        <p className="text-lg font-bold text-slate-800">Nenhuma sessão ainda</p>
        <p className="text-muted mt-2 max-w-sm">
          Ao terminar uma atividade, sua pontuação aparece aqui. Tudo fica só neste
          aparelho.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-2.5" aria-label="Lista de resultados recentes">
      {results.map((result) => (
        <li
          key={result.id}
          className="surface-card flex items-center gap-3 px-4 py-3.5 sm:px-5"
        >
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border-2 border-teal-200 bg-teal-50">
            <Trophy
              className="h-5 w-5 text-teal-700"
              strokeWidth={2}
              aria-hidden
            />
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold text-slate-900">
              {result.activityTitle}
            </p>
            <p className="mt-0.5 flex items-start gap-1.5 text-[0.9375rem] text-slate-600">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span className="line-clamp-2">
                {formatPlayedAt(result.playedAt)} — {result.summary}
              </span>
            </p>
          </div>

          <div className="shrink-0 rounded-xl border-2 border-teal-200 bg-teal-50 px-2.5 py-1.5 text-center">
            <p className="text-[0.6875rem] font-bold uppercase tracking-wide text-teal-800">
              Pontuação
            </p>
            <p className="text-xl font-bold tabular-nums text-teal-700">
              {result.score}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
