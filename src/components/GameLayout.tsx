import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { skillForWorld, WORLDS, type WorldKey } from "@/data/worlds";

interface GameLayoutProps {
  title: string;
  description?: string;
  world?: WorldKey;
  wide?: boolean;
  onBack: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Shared shell for in-game screens: a single calm "console frame" that wraps
 * every game so they read as cognitive stations, not web pages.
 *
 * It only frames the chrome (return bar, station header, tabletop stage). Each
 * game keeps its own board, controls and live feedback (StatusBanner) inside
 * `children` — this component never touches game logic.
 */
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
  const skill = skillForWorld(world);

  return (
    <div
      className={`game-world game-console game-world-${world} mx-auto flex w-full min-w-0 flex-1 flex-col overflow-x-hidden px-4 pb-10 pt-4 sm:px-6 ${
        wide ? "game-world-wide max-w-[78rem]" : "max-w-xl"
      }`}
    >
      <div className="console-bar mb-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar à jornada cognitiva"
          className="btn-ghost console-back inline-flex items-center gap-2"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
          Voltar à jornada
        </button>
        <span className="console-tagline">
          <WorldIcon className="h-4 w-4" strokeWidth={2.4} aria-hidden />
          {worldCopy.tagline}
        </span>
      </div>

      <header className="surface-game world-header console-header mb-5">
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
            {skill && (
              <p className="console-skill">
                <span>O que treina</span>
                {skill}
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="world-content world-stage flex min-w-0 w-full flex-1 flex-col">
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
