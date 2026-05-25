import { ArrowLeft, RotateCcw, Trophy } from "lucide-react";
import {
  formatDetailKeyPt,
  formatDetailValuePt,
} from "@/lib/detail-labels";
import type { GameResult } from "@/types/game";

interface ResultPanelProps {
  result: GameResult;
  onPlayAgain: () => void;
  onDashboard: () => void;
}

/** Post-game summary with score and key stats. */
export function ResultPanel({
  result,
  onPlayAgain,
  onDashboard,
}: ResultPanelProps) {
  const detailEntries = Object.entries(result.details).filter(
    ([, value]) => typeof value !== "object",
  );
  const isLoss = result.details.won === false;

  return (
    <div className="surface-panel mx-auto w-full max-w-lg p-6 sm:p-8">
      <div className="mb-4 flex items-center gap-3">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl border-2 ${
            isLoss
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-teal-200 bg-teal-50 text-teal-700"
          }`}
        >
          <Trophy className="h-6 w-6" aria-hidden />
        </div>
        <p className="text-lg font-bold text-slate-800">
          {isLoss ? "Sessão encerrada" : "Muito bem!"}
        </p>
      </div>

      <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">
        {result.activityTitle}
      </h2>
      <p className="text-muted mt-3">{result.summary}</p>

      <div className="mt-6 rounded-xl border-2 border-teal-300 bg-teal-50 p-6 text-center">
        <p className="text-base font-bold uppercase tracking-wide text-teal-800">
          Sua pontuação
        </p>
        <p className="mt-2 text-5xl font-bold tabular-nums text-teal-700">
          {result.score}
        </p>
      </div>

      {detailEntries.length > 0 && (
        <dl className="mt-5 grid grid-cols-2 gap-3">
          {detailEntries.map(([key, value]) => (
            <div key={key} className="surface-stat text-left">
              <dt className="text-sm font-bold text-slate-600">
                {formatDetailKeyPt(key)}
              </dt>
              <dd className="mt-1 text-lg font-bold text-slate-900">
                {formatDetailValuePt(value)}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onPlayAgain}
          aria-label="Repetir este desafio"
          className="btn-primary flex flex-1 items-center justify-center gap-2"
        >
          <RotateCcw className="h-5 w-5" aria-hidden />
          Repetir desafio
        </button>
        <button
          type="button"
          onClick={onDashboard}
          aria-label="Voltar ao painel principal"
          className="btn-secondary flex flex-1 items-center justify-center gap-2"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
          Voltar ao painel
        </button>
      </div>
    </div>
  );
}
