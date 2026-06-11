"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { Play } from "lucide-react";
import { getWorldMeta } from "@/data/worlds";
import {
  getBestActivationSignalsForGame,
  PLAYABLE_STAGE_IDS,
} from "@/engine/stage-progress";
import type { Activity, GameResult } from "@/types/game";

const stageVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as const },
  },
};

const MAX_SIGNALS = 3;

interface StationCardProps {
  activity: Activity;
  stationNumber: number;
  /** Best activation signals (0–3) earned on this device, 0 if never played. */
  bestSignals: number;
  reducedMotion: boolean | null;
  onSelect: (activity: Activity) => void;
}

function StationCard({
  activity,
  stationNumber,
  bestSignals,
  reducedMotion,
  onSelect,
}: StationCardProps) {
  const copy = getWorldMeta(activity.gameId ?? activity.id);

  return (
    <motion.li
      variants={reducedMotion ? undefined : stageVariants}
      className="min-w-0"
    >
      <motion.button
        type="button"
        onClick={() => onSelect(activity)}
        aria-label={`Iniciar ${copy.name}`}
        whileHover={reducedMotion ? undefined : { y: -5 }}
        whileTap={reducedMotion ? undefined : { y: 3, scale: 0.985 }}
        transition={{ type: "spring", stiffness: 400, damping: 26 }}
        className={`station-entry station-entry-${copy.world} flex h-full w-full min-w-0 flex-col overflow-hidden text-left focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus-ring)]`}
      >
        <div className="relative w-full">
          <div className="station-media" aria-hidden="true">
            <Image
              src={copy.image}
              alt=""
              fill
              sizes="(max-width: 639px) calc(100vw - 2rem), (max-width: 1023px) 50vw, (max-width: 1379px) 33vw, 18vw"
              className="station-image"
            />
          </div>
          <span className="station-badge">Estação {stationNumber}</span>
        </div>
        <div className="flex flex-1 flex-col px-4 pb-4 pt-4 sm:px-5 sm:pb-5">
          <h3 className="station-title text-2xl font-bold leading-tight text-slate-900">
            {copy.name}
          </h3>
          <p className="mb-3 mt-2 min-h-[3.2rem] text-base leading-snug text-slate-700">
            {copy.purpose}
          </p>
          {bestSignals > 0 && (
            <p className="station-progress mb-4">
              {Array.from({ length: MAX_SIGNALS }, (_, index) => (
                <span
                  key={index}
                  className={index < bestSignals ? "is-lit" : ""}
                  aria-hidden
                />
              ))}
              <span className="sr-only">
                Melhor resultado nesta estação: {bestSignals} de {MAX_SIGNALS} sinais.
              </span>
              <em>Visitada</em>
            </p>
          )}
          <span className="station-start mt-auto flex min-h-[3rem] w-full items-center justify-center gap-2 rounded-xl text-lg font-bold text-white">
            <Play className="h-5 w-5 fill-current" aria-hidden />
            Iniciar
          </span>
        </div>
      </motion.button>
    </motion.li>
  );
}

interface TrainingMapProps {
  activities: Activity[];
  recentResults: GameResult[];
  onSelect: (activity: Activity) => void;
}

/** Five illustrated, playable cognitive station entries on the home dashboard. */
export function TrainingMap({ activities, recentResults, onSelect }: TrainingMapProps) {
  const reducedMotion = useReducedMotion();
  const byId = Object.fromEntries(activities.map((activity) => [activity.id, activity]));
  const playable = PLAYABLE_STAGE_IDS.map((id) => byId[id]).filter(Boolean);

  return (
    <motion.ol
      className="station-grid grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-32px" }}
      variants={{ visible: { transition: { staggerChildren: 0.08 } } }}
      aria-label="Estações cognitivas disponíveis"
    >
      {playable.map((activity, index) => (
        <StationCard
          key={activity.id}
          activity={activity}
          stationNumber={index + 1}
          bestSignals={
            activity.gameId
              ? getBestActivationSignalsForGame(recentResults, activity.gameId)
              : 0
          }
          reducedMotion={reducedMotion}
          onSelect={onSelect}
        />
      ))}
    </motion.ol>
  );
}
