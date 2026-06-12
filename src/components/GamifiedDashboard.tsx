"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Brain,
  CircleCheck,
  Clock,
  Leaf,
  Play,
  Sprout,
  Target,
} from "lucide-react";
import { WorldShelf } from "@/components/WorldShelf";
import { getWorldMeta } from "@/data/worlds";
import { getDailyGoalProgress } from "@/engine/daily-goal";
import { isSuccessfulResult } from "@/engine/rewards";
import { formatPlayedAt } from "@/engine/storage";
import type { Activity, GameResult } from "@/types/game";

interface GamifiedDashboardProps {
  activities: Activity[];
  recentResults: GameResult[];
  onSelectActivity: (activity: Activity) => void;
}

const heroVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const sectionVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.08 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] as const },
  },
};

/** Calm greeting matching the local time of day. */
function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return "Bom dia";
  if (hour >= 12 && hour < 18) return "Boa tarde";
  return "Boa noite";
}

function HeroIllustration() {
  return (
    <div className="hero-visual-panel" aria-hidden="true">
      <div className="hero-media">
        <Image
          src="/illustrations/hero-journey.png"
          alt=""
          fill
          preload
          sizes="(max-width: 767px) calc(100vw - 3rem), 46vw"
          className="hero-image"
        />
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  helper,
  tone,
  children,
}: {
  icon: typeof CircleCheck;
  label: string;
  value: string | number;
  helper: string;
  tone: "sage" | "sky" | "clay";
  children?: ReactNode;
}) {
  return (
    <motion.div variants={cardVariants} className={`dashboard-summary dashboard-summary-${tone}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="dashboard-summary-label">{label}</p>
          <p className="dashboard-summary-value tabular-nums">{value}</p>
        </div>
        <div className="dashboard-summary-icon" aria-hidden>
          <Icon className="h-7 w-7" strokeWidth={2.2} />
        </div>
      </div>
      {children}
      <p className="dashboard-summary-helper">{helper}</p>
    </motion.div>
  );
}

/** Premium, accessible home view. Data and navigation behavior remain external. */
export function GamifiedDashboard({
  activities,
  recentResults,
  onSelectActivity,
}: GamifiedDashboardProps) {
  const reducedMotion = useReducedMotion();
  const challengeSectionRef = useRef<HTMLElement>(null);
  // Neutral on the server render; resolved after mount so hydration matches.
  const [greeting, setGreeting] = useState("Olá");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only clock read
    setGreeting(greetingForHour(new Date().getHours()));
  }, []);

  const availableCount = activities.filter((activity) => activity.status === "available").length;
  const dailyGoal = getDailyGoalProgress(recentResults);
  const dailyProgressPct = Math.round((dailyGoal.completed / dailyGoal.target) * 100);

  const scrollToChallenges = () => {
    challengeSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="dashboard-home min-w-0 w-full max-w-full">
      <header className="dashboard-brandbar mb-7" aria-label="MindFlow">
        <div className="flex min-w-0 items-center gap-3">
          <div className="dashboard-brandmark" aria-hidden>
            <Brain className="h-8 w-8" strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <p className="dashboard-wordmark text-4xl font-bold leading-tight text-slate-900 sm:text-5xl">
              MindFlow
            </p>
            <p className="text-lg font-semibold text-teal-800">
              Jornada cognitiva com calma
            </p>
          </div>
        </div>
        <span className="dashboard-calm-pill">No seu ritmo</span>
      </header>

      <section className="dashboard-top-grid mb-9" aria-label="Inicio da jornada">
        <motion.section
          className="dashboard-hero overflow-hidden"
          aria-labelledby="welcome-heading"
          initial={reducedMotion ? false : "hidden"}
          animate="visible"
          variants={reducedMotion ? undefined : heroVariants}
        >
        <div className="relative z-[1] flex min-w-0 flex-col justify-center px-5 py-7 sm:px-8 sm:py-9">
          <p className="mb-2 text-lg font-bold text-teal-800">Bem-vindo ao MindFlow</p>
          <h1
            id="welcome-heading"
            className="dashboard-display max-w-xl text-4xl font-bold leading-tight text-slate-900 sm:text-5xl"
          >
            {greeting}
          </h1>
          <p className="mt-3 max-w-lg text-lg leading-relaxed text-slate-700">
            Vamos treinar sua mente no seu ritmo.
          </p>
          <motion.button
            type="button"
            onClick={scrollToChallenges}
            aria-label="Começar jornada e escolher um desafio"
            whileHover={reducedMotion ? undefined : { y: -3 }}
            whileTap={reducedMotion ? undefined : { y: 2, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            className="btn-primary mt-6 inline-flex w-full items-center justify-center gap-2 sm:w-fit"
          >
            <Play className="h-6 w-6 fill-current" aria-hidden />
            Começar jornada
          </motion.button>
          <ul className="hero-assurances" aria-label="Como o MindFlow funciona">
            <li>Sem cronômetro</li>
            <li>Sem pressão</li>
            <li>Dados só no seu aparelho</li>
          </ul>
        </div>
        <HeroIllustration />
        </motion.section>

        <motion.section
          className="dashboard-summary-grid"
          aria-label="Resumo da jornada"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-36px" }}
          variants={sectionVariants}
        >
        <SummaryCard
          icon={Sprout}
          label="Estações prontas"
          value={availableCount}
          helper="Mini-mundos para explorar"
          tone="sage"
        />
        <SummaryCard
          icon={Target}
          label="Progresso de hoje"
          value={`${dailyGoal.completed}/${dailyGoal.target}`}
          helper={dailyGoal.reached ? "Jornada de hoje concluída" : "Continue com calma"}
          tone="sky"
        >
          <div
            className="dashboard-progress mt-3"
            role="progressbar"
            aria-valuenow={dailyGoal.completed}
            aria-valuemin={0}
            aria-valuemax={dailyGoal.target}
            aria-label={`Progresso de hoje: ${dailyGoal.completed} de ${dailyGoal.target}`}
          >
            <span style={{ width: `${dailyProgressPct}%` }} />
          </div>
        </SummaryCard>
        <SummaryCard
          icon={CircleCheck}
          label="Circuitos concluídos"
          value={recentResults.length}
          helper="Salvos neste aparelho"
          tone="clay"
        />
        </motion.section>
      </section>

      <motion.section
        ref={challengeSectionRef}
        className="mb-10 scroll-mt-5"
        aria-labelledby="challenges-heading"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-40px" }}
        variants={sectionVariants}
      >
        <motion.div variants={cardVariants} className="mb-6">
          <p className="section-label text-teal-800">Estações da mente</p>
          <h2 id="challenges-heading" className="dashboard-display mt-1 text-4xl font-bold text-slate-900">
            Escolha um desafio
          </h2>
          <p className="mt-2 max-w-2xl text-lg text-slate-700">
            Cada estação é um pequeno mundo tátil. Toque em uma estação para
            conhecer e comece quando quiser.
          </p>
        </motion.div>
        <motion.div variants={cardVariants}>
          <WorldShelf
            activities={activities}
            recentResults={recentResults}
            onSelect={onSelectActivity}
          />
        </motion.div>
      </motion.section>

      <motion.aside
        variants={cardVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-40px" }}
        className="daily-tip mb-8"
        aria-labelledby="daily-tip-heading"
      >
        <div className="daily-tip-media" aria-hidden="true">
          <Image
            src="/illustrations/tip-of-day.png"
            alt=""
            fill
            sizes="(max-width: 767px) calc(100vw - 2rem), 14rem"
            className="daily-tip-image"
          />
        </div>
        <div className="daily-tip-copy">
          <div className="daily-tip-icon" aria-hidden>
            <Leaf className="h-7 w-7" />
          </div>
          <div className="min-w-0">
            <h2 id="daily-tip-heading" className="dashboard-display text-2xl font-bold text-teal-900">
              Dica do dia
            </h2>
            <p className="daily-tip-quote mt-2">
              Pequenos passos todos os dias constroem grandes conquistas.
            </p>
          </div>
        </div>
        <p className="daily-tip-note">
          Reserve um momento tranquilo para a próxima estação.
        </p>
        <Sprout className="daily-tip-sprout" aria-hidden />
      </motion.aside>

      <motion.section
          className="mb-8 min-w-0"
          aria-labelledby="results-heading"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-40px" }}
          variants={sectionVariants}
        >
          <motion.div variants={cardVariants} className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="section-label text-teal-800">Progresso pessoal</p>
              <h2 id="results-heading" className="dashboard-display mt-1 text-3xl font-bold text-slate-900">
                Circuitos recentes
              </h2>
            </div>
            {recentResults.length > 0 && (
              <span className="rounded-full border-2 border-teal-200 bg-teal-50 px-4 py-2 text-base font-bold text-teal-800">
                {recentResults.length} {recentResults.length === 1 ? "registro" : "registros"}
              </span>
            )}
          </motion.div>

          {recentResults.length === 0 ? (
            <motion.div variants={cardVariants} className="recent-empty">
              <CircleCheck className="h-8 w-8 text-teal-700" aria-hidden />
              <div>
                <p className="text-lg font-bold text-slate-900">Sua jornada começa aqui</p>
                <p className="text-base text-slate-700">
                  Ao concluir um desafio, o circuito aparece nesta área.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.ul
              className="recent-list grid gap-3"
              aria-label="Lista de circuitos recentes"
              variants={sectionVariants}
            >
              {recentResults.map((result, index) => {
                const world = getWorldMeta(result.gameId);
                const WorldIcon = world.icon;
                const completed = isSuccessfulResult(result);

                return (
                  <motion.li
                    key={result.id}
                    variants={cardVariants}
                    className={`recent-circuit recent-circuit-${result.gameId} ${index === 0 ? "is-latest" : ""}`}
                  >
                    <div className="recent-world-icon" aria-hidden>
                      <WorldIcon className="h-7 w-7" strokeWidth={2.1} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-bold text-slate-900">{world.name}</p>
                        {index === 0 && <span className="recent-latest">Mais recente</span>}
                      </div>
                      <p className="recent-skill">{world.skill}</p>
                      <p className="mt-2 flex items-start gap-2 text-base text-slate-700">
                        <Clock className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" aria-hidden />
                        <span className="line-clamp-2">
                          {formatPlayedAt(result.playedAt)} - {result.summary}
                        </span>
                      </p>
                    </div>
                    <div className="recent-result">
                      <span className={completed ? "is-complete" : "is-practice"}>
                        {completed ? "Concluído" : "Em prática"}
                      </span>
                      <p className="recent-score">
                        <span>Pontos</span>
                        {result.score}
                      </p>
                    </div>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
      </motion.section>

      <footer className="px-2 text-center text-sm leading-relaxed text-slate-600">
        O MindFlow é uma ferramenta de prática cognitiva amigável e não substitui orientação médica.
      </footer>
    </div>
  );
}
