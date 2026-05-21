import { Brain } from "lucide-react";

interface HeaderProps {
  title?: string;
  subtitle?: string;
}

/** Dashboard welcome header — clear and calm for all ages. */
export function Header({
  title = "MindFlow",
  subtitle = "Exercícios cognitivos leves para praticar memória, planejamento e foco.",
}: HeaderProps) {
  return (
    <header className="surface-card mb-6 p-4 sm:p-5" role="banner">
      <div className="flex items-start gap-3 sm:gap-4">
        <div
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal-600 text-white"
          aria-hidden
        >
          <Brain className="h-7 w-7" strokeWidth={2} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="section-label mb-1">Bem-vindo</p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.75rem]">
            {title}
          </h1>
          <p className="text-muted mt-2 max-w-xl text-[1rem] leading-relaxed">
            {subtitle}
          </p>
        </div>
      </div>

      <ul className="mt-4 flex flex-wrap gap-2">
        <li className="badge badge-skill">3 atividades prontas</li>
        <li className="badge badge-skill">Fácil de ler</li>
        <li className="badge badge-skill">Pontuação neste aparelho</li>
      </ul>
    </header>
  );
}
