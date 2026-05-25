import { Lock, Play } from "lucide-react";
import { ActivityIcon } from "@/components/ActivityIcon";
import { SKILL_LABELS } from "@/data/activities";
import type { Activity } from "@/types/game";

interface ActivityCardProps {
  activity: Activity;
  onSelect: (activity: Activity) => void;
}

/** Single activity tile on the dashboard grid. */
export function ActivityCard({ activity, onSelect }: ActivityCardProps) {
  const isLocked = activity.status === "locked";

  const ariaLabel = isLocked
    ? `${activity.title}, em breve, ainda não disponível`
    : `Iniciar desafio: ${activity.title}. ${activity.description}`;

  return (
    <button
      type="button"
      disabled={isLocked}
      onClick={() => onSelect(activity)}
      aria-label={ariaLabel}
      className={`surface-card flex w-full min-w-0 flex-col p-4 text-left ${
        isLocked
          ? "cursor-not-allowed bg-slate-50 opacity-90"
          : "surface-card-interactive"
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2 ${
            isLocked
              ? "border-slate-200 bg-slate-100 text-slate-400"
              : "border-teal-200 bg-teal-50 text-teal-700"
          }`}
          aria-hidden
        >
          <ActivityIcon
            activityId={activity.id}
            skill={activity.skill}
            className="h-6 w-6"
          />
        </div>

        <span
          className={`badge shrink-0 ${isLocked ? "badge-locked" : "badge-play"}`}
          aria-hidden
        >
          {isLocked ? (
            <>
              <Lock className="h-3.5 w-3.5" />
              Em breve
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 fill-current" />
              Pronto
            </>
          )}
        </span>
      </div>

      <h3 className="mb-1.5 text-lg font-bold leading-snug text-slate-900">
        {activity.title}
      </h3>
      <p className="mb-3 line-clamp-2 text-[0.9375rem] leading-snug text-slate-600">
        {activity.description}
      </p>

      <span className="badge badge-skill mb-3 w-fit text-[0.8125rem]" aria-hidden>
        {SKILL_LABELS[activity.skill]}
      </span>

      {!isLocked ? (
        <span
          className="mt-auto flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-[var(--radius-lg)] border-2 border-teal-700 bg-teal-600 text-base font-bold text-white"
          aria-hidden
        >
          <Play className="h-5 w-5 fill-current" />
          Iniciar desafio
        </span>
      ) : (
        <p
          className="mt-auto rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 px-3 py-2.5 text-center text-[0.9375rem] font-semibold text-slate-500"
          aria-hidden
        >
          Ainda não disponível
        </p>
      )}
    </button>
  );
}
