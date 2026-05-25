"use client";

import { motion, useReducedMotion } from "motion/react";
import { Lock, Play, Route } from "lucide-react";
import { ActivityIcon } from "@/components/ActivityIcon";
import {
  PLAYABLE_STAGE_IDS,
  getBestActivationSignalsForGame,
} from "@/engine/stage-progress";
import type { Activity, GameResult } from "@/types/game";

const stageVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const STATION_COPY: Record<
  string,
  {
    station: string;
    concept: string;
    purpose: string;
    border: string;
    depth: string;
    icon: string;
    action: string;
    motif: string;
  }
> = {
  "color-sequence": {
    station: "Circuito de Memória",
    concept: "Sequência de Cores",
    purpose: "Repita padrões de cores e fortaleça sua atenção.",
    border: "border-rose-300",
    depth: "[--station-depth:#fda4af]",
    icon: "border-rose-200 from-rose-50 to-amber-50 text-rose-700",
    action: "border-rose-800 bg-rose-600 shadow-[0_5px_0_0_#9f1239]",
    motif: "station-motif-memory",
  },
  "escape-maze": {
    station: "Rota Estratégica",
    concept: "Labirinto de Fuga",
    purpose: "Escolha caminhos com calma e evite o guardião.",
    border: "border-sky-300",
    depth: "[--station-depth:#7dd3fc]",
    icon: "border-sky-200 from-sky-50 to-teal-50 text-sky-700",
    action: "border-sky-800 bg-sky-700 shadow-[0_5px_0_0_#075985]",
    motif: "station-motif-route",
  },
  "security-panel": {
    station: "Central de Comandos",
    concept: "Painel de Segurança",
    purpose: "Siga instruções e ative o painel na ordem certa.",
    border: "border-teal-300",
    depth: "[--station-depth:#5eead4]",
    icon: "border-teal-200 from-teal-50 to-slate-50 text-teal-700",
    action: "border-teal-900 bg-teal-600 shadow-[0_5px_0_0_#115e59]",
    motif: "station-motif-commands",
  },
  "number-trail": {
    station: "Trilha Lógica",
    concept: "Trilha de Números",
    purpose: "Siga a ordem indicada e forme uma rota de números.",
    border: "border-indigo-300",
    depth: "[--station-depth:#a5b4fc]",
    icon: "border-indigo-200 from-indigo-50 to-sky-50 text-indigo-700",
    action: "border-indigo-900 bg-indigo-600 shadow-[0_5px_0_0_#3730a3]",
    motif: "station-motif-logic",
  },
  "seed-garden": {
    station: "Jardim de Sementes",
    concept: "Jogo de planejamento e contagem",
    purpose: "Distribua sementes entre vasos e complete o objetivo com calma.",
    border: "border-emerald-300",
    depth: "[--station-depth:#86efac]",
    icon: "border-emerald-200 from-emerald-50 to-amber-50 text-emerald-700",
    action: "border-emerald-900 bg-emerald-600 shadow-[0_5px_0_0_#065f46]",
    motif: "station-motif-garden",
  },
};

function ActivationPips({ count }: { count: number }) {
  return (
    <div
      className="flex items-center justify-start gap-1.5"
      role="img"
      aria-label={`${count} de 3 sinais de ativação nesta estação`}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`h-3 w-9 rounded-full border-2 ${
            i < count
              ? "border-teal-700 bg-teal-400 shadow-[0_0_10px_rgb(45_212_191/0.45)]"
              : "border-slate-300 bg-slate-100"
          }`}
          aria-hidden
        />
      ))}
    </div>
  );
}

function PathGuide() {
  return (
    <div className="mb-6 flex min-w-0 items-start gap-4 rounded-2xl border-2 border-amber-200/90 bg-gradient-to-r from-amber-50 to-teal-50/60 p-4 shadow-[0_4px_0_0_#fcd34d] sm:p-5">
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border-2 border-teal-200 bg-white text-teal-700 shadow-[0_3px_0_0_#99f6e4]"
        aria-hidden
      >
        <Route className="h-8 w-8" strokeWidth={2.25} />
      </div>
      <p className="min-w-0 flex-1 pt-1 text-lg font-semibold leading-snug text-slate-800 sm:text-xl">
        Continue sua jornada cognitiva por uma estação de foco.
      </p>
    </div>
  );
}

function PlayableStageCard({
  activity,
  stageNum,
  activationSignals,
  reducedMotion,
  onSelect,
}: {
  activity: Activity;
  stageNum: number;
  activationSignals: number;
  reducedMotion: boolean | null;
  onSelect: (activity: Activity) => void;
}) {
  const copy = STATION_COPY[activity.id] ?? {
    station: activity.title,
    concept: activity.description,
    purpose: activity.description,
    border: "border-teal-300",
    depth: "[--station-depth:#99f6e4]",
    icon: "border-teal-200 from-teal-50 to-white text-teal-700",
    action: "border-teal-900 bg-teal-600 shadow-[0_5px_0_0_#115e59]",
    motif: "station-motif-commands",
  };

  return (
    <motion.li
      variants={reducedMotion ? undefined : stageVariants}
      className={`min-w-0 ${activity.id === "seed-garden" ? "md:col-span-2 md:mx-auto md:w-[min(100%,28rem)]" : ""}`}
    >
      <motion.button
        type="button"
        onClick={() => onSelect(activity)}
        aria-label={`Rota ${stageNum}: ${copy.station}. Iniciar desafio.`}
        whileHover={reducedMotion ? undefined : { y: -5 }}
        whileTap={reducedMotion ? undefined : { y: 3, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 26 }}
        className={`station-card station-piece ${copy.border} ${copy.depth} ${copy.motif} relative flex h-full w-full min-w-0 flex-col items-start overflow-hidden p-4 text-left focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)] sm:p-5`}
      >
        <div className="mb-4 flex w-full items-center justify-between gap-3">
          <div
            className={`tactile-tile flex h-16 w-16 items-center justify-center rounded-2xl border-2 bg-gradient-to-br ${copy.icon}`}
            aria-hidden
          >
            <ActivityIcon
              activityId={activity.id}
              skill={activity.skill}
              className="h-9 w-9"
            />
          </div>
          <span className="station-number" aria-hidden>
            <span>Estação</span>
            {stageNum}
          </span>
        </div>

        <h3 className="text-xl font-bold text-slate-900 sm:text-2xl">
          {copy.station}
        </h3>
        <p className="mt-1 text-base font-bold text-teal-800">
          {copy.concept}
        </p>
        <p className="mt-1 line-clamp-2 max-w-full text-base text-slate-600">
          {copy.purpose}
        </p>

        <div className="mt-auto w-full pt-4">
          <ActivationPips count={activationSignals} />
          <p className="mt-2 text-sm font-bold uppercase tracking-wide text-slate-500">
            {activationSignals > 0 ? "Circuito ativado" : "Circuito novo"}
          </p>
        </div>

        <span
          className={`mt-4 flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-xl border-2 text-lg font-bold text-white ${copy.action}`}
          aria-hidden
        >
          <Play className="h-6 w-6 fill-current" />
          Iniciar desafio
        </span>
      </motion.button>
    </motion.li>
  );
}

function LockedStageCard({
  activity,
  reducedMotion,
}: {
  activity: Activity;
  reducedMotion: boolean | null;
}) {
  return (
    <motion.li
      variants={reducedMotion ? undefined : stageVariants}
      className="min-w-0"
    >
      <div
        className="flex min-h-[9rem] w-full min-w-0 flex-col items-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/75 px-4 py-4 text-center opacity-90"
        aria-label={`${activity.title}, em breve`}
      >
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl border-2 border-slate-200 bg-white text-slate-400">
          <ActivityIcon
            activityId={activity.id}
            skill={activity.skill}
            className="h-6 w-6"
          />
        </div>
        <p className="text-lg font-bold text-slate-500">{activity.title}</p>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border-2 border-slate-300 bg-white px-3 py-1 text-sm font-bold text-slate-500">
          <Lock className="h-4 w-4" aria-hidden />
          Estação em breve
        </p>
      </div>
    </motion.li>
  );
}

interface TrainingMapProps {
  activities: Activity[];
  recentResults: GameResult[];
  onSelect: (activity: Activity) => void;
}

/**
 * Cognitive tabletop with distinct stations and subdued future routes.
 */
export function TrainingMap({
  activities,
  recentResults,
  onSelect,
}: TrainingMapProps) {
  const reducedMotion = useReducedMotion();
  const byId = Object.fromEntries(activities.map((a) => [a.id, a]));
  const playable = PLAYABLE_STAGE_IDS.map((id) => byId[id]).filter(Boolean);
  const locked = activities.filter((a) => a.status === "locked");
  return (
    <div className="min-w-0 max-w-full overflow-x-hidden">
      <PathGuide />

      <div className="journey-table relative mx-auto min-w-0 max-w-4xl px-3 py-4 sm:px-5 sm:py-5">
        <motion.ol
          className="relative grid gap-5 md:grid-cols-2"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-32px" }}
          variants={{
            visible: { transition: { staggerChildren: 0.12 } },
          }}
        >
          {playable.map((activity, index) => {
              const stageNum = index + 1;
              const activationSignals = activity.gameId
                ? getBestActivationSignalsForGame(recentResults, activity.gameId)
                : 0;

              return (
                <PlayableStageCard
                  key={activity.id}
                  activity={activity}
                  stageNum={stageNum}
                  activationSignals={activationSignals}
                  reducedMotion={reducedMotion}
                  onSelect={onSelect}
                />
              );
          })}
        </motion.ol>

        {locked.length > 0 && (
          <div className="mt-8 border-t-2 border-dashed border-slate-300 pt-5">
            <p className="mb-4 text-center text-base font-semibold text-slate-600">
              Próximas estações da jornada - disponíveis em breve.
            </p>
            <motion.ul
              className="grid gap-3 sm:grid-cols-2"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-32px" }}
            >
              {locked.map((activity) => (
                <LockedStageCard
                  key={activity.id}
                  activity={activity}
                  reducedMotion={reducedMotion}
                />
              ))}
            </motion.ul>
          </div>
        )}
      </div>
    </div>
  );
}
