import {
  ArrowLeft,
  Grid3x3,
  Hash,
  LayoutGrid,
  Palette,
  Sprout,
} from "lucide-react";
import type { ReactNode } from "react";

type GameWorld = "memory" | "route" | "commands" | "logic" | "garden";

interface GameLayoutProps {
  title: string;
  description?: string;
  world?: GameWorld;
  onBack: () => void;
  children: ReactNode;
  footer?: ReactNode;
}

const WORLD_COPY = {
  memory: { label: "Circuito de memória", icon: Palette },
  route: { label: "Tabuleiro de rota", icon: Grid3x3 },
  commands: { label: "Console de comandos", icon: LayoutGrid },
  logic: { label: "Caminho lógico", icon: Hash },
  garden: { label: "Tabuleiro de sementes", icon: Sprout },
} satisfies Record<GameWorld, { label: string; icon: typeof Palette }>;

/** Shared shell for in-game screens (back nav + content area). */
export function GameLayout({
  title,
  description,
  world = "memory",
  onBack,
  children,
  footer,
}: GameLayoutProps) {
  const worldCopy = WORLD_COPY[world];
  const WorldIcon = worldCopy.icon;

  return (
    <div className={`game-world game-world-${world} mx-auto flex w-full min-w-0 max-w-xl flex-1 flex-col overflow-x-hidden px-4 pb-10 pt-4 sm:px-6`}>
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
              {worldCopy.label}
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
