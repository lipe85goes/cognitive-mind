import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { WORLDS, type WorldKey } from "@/data/worlds";

interface GameLayoutProps {
  title: string;
  description?: string;
  world?: WorldKey;
  wide?: boolean;
  onBack: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/** Shared shell for in-game screens (back nav + content area). */
export function GameLayout({
  title,
  description,
  world = "memory",
  wide = false,
  onBack,
  children,
  footer,
}: GameLayoutProps) {
  const worldCopy = WORLDS[world];
  const WorldIcon = worldCopy.icon;

  return (
    <div
      className={`game-world game-world-${world} mx-auto flex w-full min-w-0 flex-1 flex-col overflow-x-hidden px-4 pb-10 pt-4 sm:px-6 ${
        wide ? "game-world-wide max-w-[78rem]" : "max-w-xl"
      }`}
    >
      <button
        type="button"
        onClick={onBack}
        aria-label="Voltar à jornada cognitiva"
        className="btn-ghost mb-5 inline-flex w-fit items-center gap-2"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden />
        Voltar à jornada
      </button>

      <div className="surface-game world-header mb-5">
        <div className="flex items-start gap-3">
          <div className="world-emblem" aria-hidden>
            <WorldIcon className="h-7 w-7" strokeWidth={2.2} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="section-label mb-1 text-[var(--world-accent-deep)]">
              {worldCopy.boardLabel}
            </p>
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h2>
            {description && (
              <p className="text-muted mt-2 leading-relaxed">{description}</p>
            )}
          </div>
        </div>
      </div>

      <div className="world-content flex min-w-0 w-full flex-1 flex-col">
        {children}
      </div>

      {footer && (
        <div className="world-note mt-6 rounded-2xl border px-4 py-3 text-base text-slate-600">
          {footer}
        </div>
      )}
    </div>
  );
}
