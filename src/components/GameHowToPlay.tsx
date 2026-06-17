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

/**
 * Premium "station briefing" before a mini-world begins. Shared across all
 * games — it only restyles the presentation (dark cozy shell, wooden plaque,
 * brass panels, green CTA). All copy/props/callbacks are unchanged, so every
 * game's intro benefits and no game logic is touched.
 */
export function GameHowToPlay({
  intro,
  onStart,
  onBackToMap,
}: GameHowToPlayProps) {
  const IntroIcon = WORLDS[intro.world].icon;

  return (
    <div className={`pgi-shell pgi-${intro.world}`}>
      {/* Cozy dark library/workshop atmosphere, matching the Home + game. */}
      <div className="pgi-atmosphere" aria-hidden />
      <span className="pgi-vignette" aria-hidden />

      <div className="pgi-frame">
        <header className="pgi-topbar">
          <button
            type="button"
            onClick={onBackToMap}
            aria-label="Voltar à jornada cognitiva"
            className="pgi-back"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden />
            Voltar à jornada
          </button>
          <span className="pgi-kicker">
            <BookOpen className="h-5 w-5" aria-hidden />
            Como jogar
          </span>
        </header>

        <div className="pgi-plaque">
          <h1 id="intro-title" className="pgi-plaque-text">
            {intro.title}
          </h1>
        </div>

        <div className="pgi-grid">
          <section
            className="pgi-preview"
            aria-label={`Boas-vindas a ${intro.title}`}
          >
            <div className="pgi-preview-media" aria-hidden="true">
              <Image
                src={intro.image}
                alt=""
                fill
                sizes="(max-width: 767px) calc(100vw - 2rem), 40vw"
                className="pgi-preview-image"
              />
            </div>
            <div className="pgi-skill">
              <p>Você vai praticar</p>
              <strong>{intro.skill}</strong>
            </div>
          </section>

          <section className="pgi-briefing" aria-labelledby="intro-title">
            <p className="pgi-original">
              <IntroIcon className="h-5 w-5" aria-hidden />
              {intro.originalName}
            </p>
            <p className="pgi-desc">{intro.description}</p>

            <ol
              className="pgi-steps"
              aria-label={`Passos para jogar ${intro.title}`}
            >
              {intro.steps.map((step, index) => (
                <li key={step}>
                  <span aria-hidden>{index + 1}</span>
                  <p>{step}</p>
                </li>
              ))}
            </ol>

            <p className="pgi-reassurance">{intro.reassurance}</p>

            <div className="pgi-actions">
              <button
                type="button"
                onClick={onStart}
                aria-label={`Começar ${intro.title}`}
                className="pgi-cta"
              >
                <Play className="h-6 w-6 fill-current" aria-hidden />
                Começar
              </button>
              <button
                type="button"
                onClick={onBackToMap}
                aria-label="Voltar à jornada cognitiva"
                className="pgi-btn"
              >
                <ArrowLeft className="h-6 w-6" aria-hidden />
                Voltar à jornada
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
