"use client";

import Image from "next/image";
import {
  useCallback,
  useMemo,
  useRef,
} from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  Brain,
  CalendarDays,
  Clock,
  Compass,
  Flame,
  Leaf,
  Play,
  Settings,
  Sparkles,
  Sprout,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import { WorldShelf } from "@/components/WorldShelf";
import { getWorldMeta } from "@/data/worlds";
import { getDailyGoalProgress } from "@/engine/daily-goal";
import { isSuccessfulResult } from "@/engine/rewards";
import { PLAYABLE_STAGE_IDS } from "@/engine/stage-progress";
import { formatPlayedAt } from "@/engine/storage";
import type { Activity, GameId, GameResult } from "@/types/game";

interface GamifiedDashboardProps {
  activities: Activity[];
  recentResults: GameResult[];
  selectedGameId?: GameId | null;
  statusMessage?: string | null;
  onSelectedGameIdChange?: (gameId: GameId) => void;
  onSelectActivity: (activity: Activity) => void;
}

const stageVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const shelfVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

function getPlayableActivities(activities: Activity[]): Activity[] {
  const byId = Object.fromEntries(
    activities
      .filter((activity) => activity.status === "available" && activity.gameId)
      .map((activity) => [activity.gameId, activity]),
  );

  return PLAYABLE_STAGE_IDS.map((id) => byId[id]).filter(
    (activity): activity is Activity => Boolean(activity),
  );
}

function getDailySuggestion(
  playableActivities: Activity[],
  recentResults: GameResult[],
): Activity | undefined {
  const firstWorld = playableActivities[0];
  const lastGameId = recentResults[0]?.gameId;
  if (!firstWorld || !lastGameId) return firstWorld;

  const playedIds = new Set(recentResults.map((result) => result.gameId));
  const lastActivity = playableActivities.find(
    (activity) => activity.gameId === lastGameId,
  );
  const lastSkill = lastActivity?.skill;

  const freshDifferentSkill = playableActivities.find(
    (activity) =>
      activity.gameId !== lastGameId &&
      activity.skill !== lastSkill &&
      activity.gameId !== undefined &&
      !playedIds.has(activity.gameId),
  );
  if (freshDifferentSkill) return freshDifferentSkill;

  const differentSkill = playableActivities.find(
    (activity) =>
      activity.gameId !== lastGameId && activity.skill !== lastSkill,
  );
  if (differentSkill) return differentSkill;

  const lastIndex = playableActivities.findIndex(
    (activity) => activity.gameId === lastGameId,
  );
  return playableActivities[(lastIndex + 1) % playableActivities.length] ?? firstWorld;
}

function stationLabel(playableActivities: Activity[], gameId?: GameId): string {
  if (!gameId) return "Estação 1";
  const index = playableActivities.findIndex(
    (activity) => activity.gameId === gameId,
  );
  return `Estação ${index >= 0 ? index + 1 : 1}`;
}

function FocusChip({
  icon: Icon,
  value,
  label,
  tone,
}: {
  icon: LucideIcon;
  value: string | number;
  label: string;
  tone: "gold" | "ember" | "sage";
}) {
  return (
    <div className={`game-hud-chip game-hud-chip-${tone}`}>
      <span className="game-hud-chip-icon" aria-hidden>
        <Icon className="h-6 w-6" strokeWidth={2.2} />
      </span>
      <span>
        <strong>{value}</strong>
        <em>{label}</em>
      </span>
    </div>
  );
}

function ProgressPlaque({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  helper?: string;
}) {
  return (
    <div className="game-progress-plaque">
      <span className="game-progress-icon" aria-hidden>
        <Icon className="h-7 w-7" strokeWidth={2.2} />
      </span>
      <span className="min-w-0">
        <em>{label}</em>
        <strong>{value}</strong>
        {helper && <small>{helper}</small>}
      </span>
    </div>
  );
}

/** Premium game-menu home. Game routing and result behavior stay external. */
export function GamifiedDashboard({
  activities,
  recentResults,
  selectedGameId,
  statusMessage,
  onSelectedGameIdChange,
  onSelectActivity,
}: GamifiedDashboardProps) {
  const reducedMotion = useReducedMotion();
  const shelfRef = useRef<HTMLElement>(null);

  const dailyGoal = getDailyGoalProgress(recentResults);
  const dailyProgressPct = Math.round((dailyGoal.completed / dailyGoal.target) * 100);
  const successfulResults = recentResults.filter(isSuccessfulResult);
  const playableActivities = useMemo(
    () => getPlayableActivities(activities),
    [activities],
  );
  const exploredWorlds = useMemo(
    () => new Set(recentResults.map((result) => result.gameId)).size,
    [recentResults],
  );
  const activityByGameId = useMemo(
    () =>
      new Map(
        playableActivities
          .filter((activity) => activity.gameId)
          .map((activity) => [activity.gameId as GameId, activity]),
      ),
    [playableActivities],
  );

  const lastResult = recentResults[0];
  const lastActivity = lastResult
    ? activityByGameId.get(lastResult.gameId)
    : undefined;
  const firstActivity = playableActivities[0];
  const continueActivity = lastActivity ?? firstActivity;
  const continueMeta = continueActivity?.gameId
    ? getWorldMeta(continueActivity.gameId)
    : undefined;
  const dailySuggestion = useMemo(
    () => getDailySuggestion(playableActivities, recentResults),
    [playableActivities, recentResults],
  );
  const suggestionMeta = dailySuggestion?.gameId
    ? getWorldMeta(dailySuggestion.gameId)
    : undefined;

  const focusLabel =
    dailyGoal.completed > 0
      ? "Continue assim"
      : "Comece hoje";
  const continueHint =
    lastResult && continueActivity?.gameId && continueMeta
      ? `Continue de onde parou · ${stationLabel(playableActivities, continueActivity.gameId)} · ${continueMeta.name}`
      : "Comece sua primeira jornada · Estação 1 · Circuito de Memória";

  const startContinueActivity = useCallback(() => {
    if (!continueActivity) return;
    onSelectActivity(continueActivity);
  }, [continueActivity, onSelectActivity]);

  const showSuggestion = useCallback(() => {
    if (!dailySuggestion?.gameId) return;
    onSelectedGameIdChange?.(dailySuggestion.gameId);
    shelfRef.current?.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "center",
    });
  }, [dailySuggestion, onSelectedGameIdChange, reducedMotion]);

  return (
    <div className="game-menu-home">
      <section className="game-opening-stage" aria-label="Entrada da jornada MindFlow">
        <div className="game-opening-bg" aria-hidden>
          <Image
            src="/illustrations/hero-journey.png"
            alt=""
            fill
            priority
            sizes="100vw"
            className="game-opening-image"
          />
        </div>

        <header className="game-topbar" aria-label="MindFlow">
          <div className="game-brand-lockup">
            <span className="game-brandmark" aria-hidden>
              <Brain className="h-8 w-8" strokeWidth={2.2} />
            </span>
            <span>
              <strong>MindFlow</strong>
              <em>Jornada cognitiva com calma</em>
            </span>
          </div>

          <div className="game-topbar-status" aria-label="Resumo rápido">
            <FocusChip
              icon={Trophy}
              value={successfulResults.length}
              label="Circuitos"
              tone="gold"
            />
            <FocusChip
              icon={Flame}
              value={`${dailyGoal.completed}/${dailyGoal.target}`}
              label="Foco hoje"
              tone="ember"
            />
            <div className="game-profile-chip">
              <span aria-hidden>N</span>
              <span>
                <strong>Olá</strong>
                <em>Explore com calma</em>
              </span>
            </div>
            <button
              type="button"
              className="game-settings-button"
              aria-label="Configurações"
            >
              <Settings className="h-6 w-6" strokeWidth={2.3} aria-hidden />
            </button>
          </div>
        </header>

        <motion.div
          className="game-hero-copy"
          initial={reducedMotion ? false : "hidden"}
          animate="visible"
          variants={reducedMotion ? undefined : stageVariants}
        >
          <h1>Sua mente é seu maior superpoder.</h1>
          <p>
            Treine com calma. Avance no seu ritmo. Viva novas jornadas todos os dias.
          </p>
          <motion.button
            type="button"
            onClick={startContinueActivity}
            disabled={!continueActivity}
            aria-label={lastResult ? "Continuar jornada" : "Começar jornada"}
            whileHover={reducedMotion ? undefined : { y: -3 }}
            whileTap={reducedMotion ? undefined : { y: 2, scale: 0.98 }}
            className="game-play-cta"
          >
            <Play className="h-8 w-8 fill-current" aria-hidden />
            {lastResult ? "Continuar jornada" : "Começar jornada"}
          </motion.button>
          <p className="game-continue-hint">
            <Leaf className="h-5 w-5" strokeWidth={2.4} aria-hidden />
            {continueHint}
          </p>
        </motion.div>

        {statusMessage && (
          <p className="game-save-ribbon" role="status" aria-live="polite">
            {statusMessage}. Jornada atualizada.
          </p>
        )}
      </section>

      <motion.section
        ref={shelfRef}
        className="game-world-stage"
        aria-labelledby="world-stage-heading"
        initial={reducedMotion ? false : "hidden"}
        whileInView="visible"
        viewport={{ once: true, margin: "-50px" }}
        variants={reducedMotion ? undefined : shelfVariants}
      >
        <div className="game-world-plaque">
          <Sparkles className="h-7 w-7" aria-hidden />
          <div>
            <h2 id="world-stage-heading">Escolha seu mundo de treino</h2>
            <p>Explore, treine e desbloqueie novas habilidades.</p>
          </div>
          <Sparkles className="h-7 w-7" aria-hidden />
        </div>

        <WorldShelf
          activities={activities}
          recentResults={recentResults}
          selectedGameId={selectedGameId}
          onSelectedGameIdChange={onSelectedGameIdChange}
          onSelect={onSelectActivity}
        />
      </motion.section>

      <section className="game-bottom-hud" aria-label="Progresso da jornada">
        <div className="game-general-progress">
          <span className="game-growth-orb" aria-hidden>
            <Sprout className="h-8 w-8" strokeWidth={2.2} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p>Seu progresso geral</p>
              <strong>{dailyProgressPct}%</strong>
            </div>
            <div
              className="game-hud-progress"
              role="progressbar"
              aria-label={`Progresso de hoje: ${dailyGoal.completed} de ${dailyGoal.target}`}
              aria-valuemin={0}
              aria-valuemax={dailyGoal.target}
              aria-valuenow={dailyGoal.completed}
            >
              <span style={{ width: `${dailyProgressPct}%` }} />
            </div>
            <small>Continue assim, você está indo muito bem.</small>
          </div>
        </div>

        <ProgressPlaque
          icon={Sprout}
          label="Estações prontas"
          value={playableActivities.length}
        />
        <ProgressPlaque
          icon={Compass}
          label="Mundos explorados"
          value={`${exploredWorlds}/${playableActivities.length}`}
        />
        <ProgressPlaque
          icon={Trophy}
          label="Circuitos concluídos"
          value={successfulResults.length}
        />
        <ProgressPlaque
          icon={CalendarDays}
          label="Sequência de foco"
          value={focusLabel}
          helper="Treino salvo neste aparelho"
        />
      </section>

      <section className="game-mission-notes" aria-label="Cartas da jornada">
        <article className="game-note-card">
          <span className="game-note-icon" aria-hidden>
            <Clock className="h-6 w-6" strokeWidth={2.2} />
          </span>
          <div>
            <p>Seu último treino</p>
            <strong>{continueMeta?.name ?? "Circuito de Memória"}</strong>
            <span>
              {lastResult
                ? formatPlayedAt(lastResult.playedAt)
                : "Quando concluir um mundo, ele aparecerá aqui."}
            </span>
          </div>
        </article>

        {dailySuggestion && suggestionMeta && (
          <article className="game-note-card is-suggestion">
            <span className="game-note-icon" aria-hidden>
              <TargetIcon />
            </span>
            <div>
              <p>Estação sugerida</p>
              <strong>{suggestionMeta.name}</strong>
              <span>Hoje sugerimos praticar {suggestionMeta.skill.toLowerCase()}.</span>
            </div>
            <button type="button" onClick={showSuggestion}>
              Ver sugestão
            </button>
          </article>
        )}
      </section>

      <footer className="game-home-footer">
        O MindFlow é uma ferramenta de prática cognitiva amigável e não substitui orientação médica.
      </footer>
    </div>
  );
}

function TargetIcon() {
  return <Sparkles className="h-6 w-6" strokeWidth={2.2} aria-hidden />;
}
