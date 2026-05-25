"use client";

import { ArrowLeft, BookOpen, Play } from "lucide-react";

interface GameHowToPlayProps {
  activityTitle: string;
  steps: readonly string[];
  onStart: () => void;
  onBackToMap: () => void;
}

/**
 * Short “Como jogar” screen before an activity — large text, calm layout.
 */
export function GameHowToPlay({
  activityTitle,
  steps,
  onStart,
  onBackToMap,
}: GameHowToPlayProps) {
  return (
    <div className="mx-auto flex w-full min-w-0 max-w-lg flex-1 flex-col overflow-x-hidden px-4 pb-10 pt-4 sm:px-6">
      <div className="surface-game mb-5 border-teal-300">
        <p className="section-label mb-1 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-teal-700" aria-hidden />
          Como jogar
        </p>
        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
          {activityTitle}
        </h1>
        <p className="text-muted mt-2 text-lg leading-relaxed">
          Três passos simples. Leia com calma e toque em Começar quando estiver
          pronto.
        </p>
      </div>

      <ol
        className="mb-8 space-y-4"
        aria-label={`Passos para jogar ${activityTitle}`}
      >
        {steps.map((step, index) => (
          <li
            key={step}
            className="tactile-tile flex min-w-0 items-start gap-4 rounded-2xl border-2 border-[#cfccb9] bg-[#fffdf8] p-4"
          >
            <span
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-teal-700 bg-teal-600 text-xl font-bold text-white"
              aria-hidden
            >
              {index + 1}
            </span>
            <p className="min-w-0 flex-1 pt-2 text-lg font-semibold leading-snug text-slate-800 sm:text-xl">
              {step}
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-auto flex flex-col gap-3">
        <button
          type="button"
          onClick={onStart}
          aria-label={`Começar ${activityTitle}`}
          className="btn-primary flex min-h-[3.25rem] w-full items-center justify-center gap-2 text-lg"
        >
          <Play className="h-6 w-6 fill-current" aria-hidden />
          Começar
        </button>
        <button
          type="button"
          onClick={onBackToMap}
          aria-label="Voltar à jornada cognitiva"
          className="btn-secondary flex min-h-[3.25rem] w-full items-center justify-center gap-2 text-lg"
        >
          <ArrowLeft className="h-6 w-6" aria-hidden />
          Voltar à jornada
        </button>
      </div>
    </div>
  );
}
