"use client";

import { useRef } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  CircleCheck,
  Clock,
  Play,
  Sparkles,
  Target,
} from "lucide-react";
import { TrainingMap } from "@/components/TrainingMap";
import { getDailyGoalProgress } from "@/engine/daily-goal";
import {
  calculateStars,
  totalActivationSignalsFromResults,
} from "@/engine/rewards";
import { formatPlayedAt } from "@/engine/storage";
import type { Activity, GameResult } from "@/types/game";

interface GamifiedDashboardProps {
  activities: Activity[];
  recentResults: GameResult[];
  onSelectActivity: (activity: Activity) => void;
}

const heroVariants = {
  hidden: { opacity: 0, y: 24 },
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
    transition: { staggerChildren: 0.08, delayChildren: 0.12 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const },
  },
};

function ActivationPips({ count, max = 3 }: { count: number; max?: number }) {
  return (
    <div
      className="flex items-center gap-0.5"
      role="img"
      aria-label={`${count} de ${max} sinais de ativação`}
    >
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`h-2.5 w-7 rounded-full border sm:h-3 sm:w-8 ${
            i < count
              ? "border-teal-700 bg-teal-400"
              : "border-slate-300 bg-slate-100"
          }`}
          aria-hidden
        />
      ))}
    </div>
  );
}

function RewardStat({
  icon: Icon,
  label,
  value,
  accentClass,
}: {
  icon: typeof CircleCheck;
  label: string;
  value: string | number;
  accentClass: string;
}) {
  return (
    <div
      className={`flex min-h-[4.5rem] min-w-0 flex-1 flex-col items-center justify-center rounded-2xl border-2 px-3 py-3 text-center shadow-[0_4px_0_0_var(--border-strong),0_6px_16px_rgb(15_23_42/0.06)] ${accentClass}`}
    >
      <Icon className="mb-1 h-6 w-6 shrink-0" strokeWidth={2.25} aria-hidden />
      <p className="text-[0.8125rem] font-bold uppercase tracking-wide text-slate-600">
        {label}
      </p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}

/**
 * Gamified, accessible dashboard — visual layer only; data and handlers come from the page.
 */
export function GamifiedDashboard({
  activities,
  recentResults,
  onSelectActivity,
}: GamifiedDashboardProps) {
  const reducedMotion = useReducedMotion();
  const mapSectionRef = useRef<HTMLElement>(null);

  const availableCount = activities.filter((a) => a.status === "available").length;
  const totalActivations = totalActivationSignalsFromResults(recentResults);
  const dailyGoal = getDailyGoalProgress(recentResults);
  const dailyProgressPct = Math.round(
    (dailyGoal.completed / dailyGoal.target) * 100,
  );

  const scrollToTrainingMap = () => {
    mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-w-0 w-full max-w-full">
      <motion.header
        className="table-surface relative mb-7 overflow-hidden border-teal-500 p-5 sm:p-7"
        role="banner"
        initial={reducedMotion ? false : "hidden"}
        animate="visible"
        variants={reducedMotion ? undefined : heroVariants}
      >
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <p className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-teal-800">
              <Sparkles className="h-5 w-5 text-amber-500" aria-hidden />
              Jornada Cognitiva
            </p>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              MindFlow
            </h1>
            <p className="mt-3 max-w-xl text-lg leading-relaxed text-slate-700">
              Entre em circuitos leves de memória, atenção e estratégia. Cada
              desafio ativa uma rota mental, sempre no seu ritmo.
            </p>
            <p className="mt-4 inline-flex rounded-full border-2 border-amber-200 bg-amber-50 px-4 py-2 text-base font-bold text-slate-800">
              Escolha uma estação para começar
            </p>
          </div>

          <div className="journey-preview w-full shrink-0 lg:w-[18.5rem]">
            <div className="mb-4 hidden grid-cols-3 gap-2 sm:grid" aria-hidden>
              <span className="journey-piece journey-piece-memory">1</span>
              <span className="journey-line" />
              <span className="journey-piece journey-piece-route">2</span>
              <span className="journey-piece journey-piece-commands">3</span>
              <span className="journey-line journey-line-vertical" />
              <span className="journey-piece journey-piece-logic">4</span>
              <span />
              <span className="journey-piece journey-piece-garden">5</span>
            </div>
            <motion.button
              type="button"
              onClick={scrollToTrainingMap}
              aria-label="Iniciar jornada — ir para os desafios cognitivos"
              whileHover={reducedMotion ? undefined : { y: -3 }}
              whileTap={reducedMotion ? undefined : { y: 2, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 26 }}
              className="flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-2xl border-2 border-teal-900 bg-teal-600 px-6 text-lg font-bold text-white shadow-[0_5px_0_0_#115e59,0_8px_20px_rgb(13_148_136/0.35)] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)]"
            >
              <Play className="h-6 w-6 fill-current" aria-hidden />
              Iniciar jornada
            </motion.button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 min-[400px]:grid-cols-3">
          <RewardStat
            icon={Target}
            label="Estações da mente"
            value={availableCount}
            accentClass="border-sky-200 bg-sky-50 text-sky-800"
          />
          <RewardStat
            icon={Sparkles}
            label="Circuitos ativados"
            value={totalActivations}
            accentClass="border-teal-200 bg-teal-50 text-teal-800"
          />
          <RewardStat
            icon={CircleCheck}
            label="Caminhos concluídos"
            value={recentResults.length}
            accentClass="border-emerald-200 bg-emerald-50 text-emerald-800"
          />
        </div>

        <p className="mt-4 text-center text-base font-semibold text-slate-600 sm:text-left">
          {availableCount} estações prontas — escolha a próxima rota cognitiva.
        </p>
      </motion.header>

      <motion.section
        className="mb-6"
        aria-labelledby="daily-goal-heading"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-40px" }}
        variants={sectionVariants}
      >
        <motion.div
          variants={cardVariants}
          className="surface-panel border-sky-200 bg-gradient-to-br from-sky-50 via-[#fffdf8] to-white p-5"
        >
          <div className="mb-3 flex items-start gap-3">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-sky-300 bg-white text-sky-700"
              aria-hidden
            >
              <Target className="h-6 w-6" strokeWidth={2.25} />
            </div>
            <div className="min-w-0 flex-1">
              <h2
                id="daily-goal-heading"
                className="text-xl font-bold text-slate-900 sm:text-2xl"
              >
                Progresso de hoje
              </h2>
              <p className="mt-1 text-lg leading-relaxed text-slate-700">
                Complete 3 desafios leves para manter a jornada em movimento.
              </p>
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between gap-2 text-base font-bold text-slate-800">
            <span className="text-xl tabular-nums text-sky-900">
              {dailyGoal.completed}/{dailyGoal.target}
            </span>
            {dailyGoal.reached && (
              <span className="rounded-full border-2 border-emerald-600 bg-emerald-50 px-2.5 py-0.5 text-sm font-bold text-emerald-800">
                Rota concluída
              </span>
            )}
          </div>

          <div
            className="h-4 overflow-hidden rounded-full border-2 border-sky-200 bg-white"
            role="progressbar"
            aria-valuenow={dailyGoal.completed}
            aria-valuemin={0}
            aria-valuemax={dailyGoal.target}
            aria-label={`Progresso da meta de hoje: ${dailyGoal.completed} de ${dailyGoal.target}`}
          >
            <div
              className="h-full rounded-full bg-sky-500 transition-[width] duration-300"
              style={{ width: `${dailyProgressPct}%` }}
            />
          </div>

          <p className="mt-3 text-lg font-semibold text-slate-700">
            {dailyGoal.reached
              ? "Rota de hoje concluída. Muito bem."
              : dailyGoal.completed === 0
                ? "Escolha uma estação para começar com calma."
                : "Continue sua rota no seu ritmo."}
          </p>
        </motion.div>
      </motion.section>

      <motion.section
        ref={mapSectionRef}
        className="mb-8 scroll-mt-4"
        aria-labelledby="activities-heading"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-40px" }}
        variants={sectionVariants}
      >
          <motion.div variants={cardVariants} className="mb-5">
          <h2 id="activities-heading" className="text-2xl font-bold text-slate-900">
            Desafios disponíveis
          </h2>
          <p className="text-muted mt-2 text-lg">
            Cada estação ativa uma habilidade cognitiva de forma interativa.
          </p>
        </motion.div>

        <TrainingMap
          activities={activities}
          recentResults={recentResults}
          onSelect={onSelectActivity}
        />
      </motion.section>

      <motion.section
        aria-labelledby="results-heading"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-40px" }}
        variants={sectionVariants}
      >
        <motion.div
          variants={cardVariants}
          className="mb-4 flex flex-wrap items-end justify-between gap-2"
        >
          <div>
            <h2 id="results-heading" className="text-2xl font-bold text-slate-900">
              Circuitos recentes
            </h2>
            <p className="text-muted mt-2 text-lg">Salvos neste aparelho</p>
          </div>
          {recentResults.length > 0 && (
            <span className="inline-flex min-h-[2.5rem] items-center gap-1.5 rounded-full border-2 border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-bold text-teal-800">
              <CircleCheck className="h-4 w-4" aria-hidden />
              {recentResults.length} salvos
            </span>
          )}
        </motion.div>

        {recentResults.length === 0 ? (
          <motion.div
            variants={cardVariants}
            className="surface-panel flex flex-col items-center px-5 py-10 text-center"
          >
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-amber-200 bg-amber-50">
              <CircleCheck
                className="h-7 w-7 text-teal-700"
                strokeWidth={2}
                aria-hidden
              />
            </div>
            <p className="text-xl font-bold text-slate-800">
              Seus circuitos aparecem aqui
            </p>
            <p className="text-muted mt-2 max-w-sm text-lg">
              Cada desafio concluído fica salvo neste aparelho para você
              acompanhar sua rota.
            </p>
          </motion.div>
        ) : (
          <motion.ul
            className="space-y-3"
            aria-label="Lista de circuitos recentes"
            variants={sectionVariants}
          >
            {recentResults.map((result) => {
              const stars = calculateStars(result.score);
              return (
                <motion.li
                  key={result.id}
                  variants={cardVariants}
                  className="surface-panel flex min-w-0 items-center gap-3 px-4 py-4 sm:gap-4 sm:px-5"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border-2 border-teal-200 bg-teal-50">
                    <CircleCheck
                      className="h-6 w-6 text-teal-700"
                      strokeWidth={2}
                      aria-hidden
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-bold text-slate-900">
                      {result.activityTitle}
                    </p>
                    <div className="mt-1.5">
                      <ActivationPips count={stars} />
                    </div>
                    <p className="mt-1.5 flex items-start gap-1.5 text-base text-slate-600">
                      <Clock className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                      <span className="line-clamp-2">
                        {formatPlayedAt(result.playedAt)} — {result.summary}
                      </span>
                    </p>
                  </div>

                  <div className="shrink-0 rounded-2xl border-2 border-teal-200 bg-teal-50 px-3 py-2 text-center shadow-[0_3px_0_0_#99f6e4]">
                    <p className="text-xs font-bold uppercase tracking-wide text-teal-800">
                      Pontos
                    </p>
                    <p className="text-2xl font-bold tabular-nums text-teal-700">
                      {result.score}
                    </p>
                  </div>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </motion.section>

      <motion.section
        className="mt-10"
        aria-labelledby="about-heading"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-40px" }}
        variants={sectionVariants}
      >
        <motion.div
          variants={cardVariants}
          className="surface-panel bg-white/70 p-5 sm:p-6"
        >
          <h2
            id="about-heading"
            className="text-xl font-bold text-slate-900 sm:text-2xl"
          >
            Sobre o MindFlow
          </h2>
          <p className="mt-3 text-lg leading-relaxed text-slate-700">
            O MindFlow é um treino mental leve em formato de jogo — um MVP
            pensado para praticar no dia a dia, com calma e sem pressa.
          </p>
          <p className="mt-3 text-lg leading-relaxed text-slate-700">
            Os desafios ajudam a exercitar{" "}
            <strong className="font-bold text-slate-900">memória</strong>,{" "}
            <strong className="font-bold text-slate-900">foco</strong>,{" "}
            <strong className="font-bold text-slate-900">planejamento</strong> e{" "}
            <strong className="font-bold text-slate-900">atenção</strong> de
            forma simples e acessível.
          </p>
          <p className="mt-4 border-t border-slate-200 pt-3 text-sm leading-relaxed text-slate-500">
            Não substitui orientação médica nem promete resultados clínicos — é
            uma ferramenta de prática cognitiva amigável, salva só neste
            aparelho.
          </p>
        </motion.div>
      </motion.section>

      <motion.p
        className="mt-6 text-center text-lg text-slate-500"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        MindFlow — jornada cognitiva no seu ritmo
      </motion.p>
    </div>
  );
}
