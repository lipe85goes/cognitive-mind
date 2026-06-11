"use client";

import Image from "next/image";
import { ArrowLeft, BookOpen, Play } from "lucide-react";
import type { GameIntroContent } from "@/data/game-intros";
import { WORLDS } from "@/data/worlds";

interface GameHowToPlayProps {
  intro: GameIntroContent;
  onStart: () => void;
  onBackToMap: () => void;
}

/** Illustrated welcome screen before a mini-world begins. */
export function GameHowToPlay({
  intro,
  onStart,
  onBackToMap,
}: GameHowToPlayProps) {
  const IntroIcon = WORLDS[intro.world].icon;

  return (
    <div className={`game-intro game-intro-${intro.world}`}>
      <button
        type="button"
        onClick={onBackToMap}
        aria-label="Voltar à jornada cognitiva"
        className="btn-ghost intro-back inline-flex w-fit items-center gap-2"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden />
        Voltar à jornada
      </button>

      <div className="intro-world-grid">
        <section className="intro-art-card" aria-label={`Boas-vindas a ${intro.title}`}>
          <div className="intro-art-label">
            <IntroIcon className="h-5 w-5" aria-hidden />
            <span>{intro.title}</span>
          </div>
          <div className="intro-art-media" aria-hidden="true">
            <Image
              src={intro.image}
              alt=""
              fill
              sizes="(max-width: 767px) calc(100vw - 2rem), 42vw"
              className="intro-art-image"
            />
          </div>
          <div className="intro-skill-panel">
            <p>Você vai praticar</p>
            <strong>{intro.skill}</strong>
          </div>
        </section>

        <section className="intro-instruction-card" aria-labelledby="intro-title">
          <p className="intro-kicker">
            <BookOpen className="h-5 w-5" aria-hidden />
            Como jogar
          </p>
          <p className="intro-original-name">{intro.originalName}</p>
          <h1 id="intro-title">{intro.title}</h1>
          <p className="intro-description">{intro.description}</p>

          <ol className="intro-step-list" aria-label={`Passos para jogar ${intro.title}`}>
            {intro.steps.map((step, index) => (
              <li key={step}>
                <span aria-hidden>{index + 1}</span>
                <p>{step}</p>
              </li>
            ))}
          </ol>

          <p className="intro-reassurance">{intro.reassurance}</p>

          <div className="intro-actions">
            <button
              type="button"
              onClick={onStart}
              aria-label={`Começar ${intro.title}`}
              className="btn-primary flex min-h-[3.25rem] w-full items-center justify-center gap-2 text-lg"
            >
              <Play className="h-6 w-6 fill-current" aria-hidden />
              Começar
            </button>
            <button
              type="button"
              onClick={onBackToMap}
              aria-label="Voltar à jornada cognitiva"
              className="btn-secondary flex min-h-[3.25rem] w-full items-center justify-center gap-2 text-lg"
            >
              <ArrowLeft className="h-6 w-6" aria-hidden />
              Voltar à jornada
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
