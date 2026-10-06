"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState } from "react";
import { ArrowLeft, Check, Lightbulb, RotateCcw, Search } from "lucide-react";
import type { DifficultyLevel, GameComponentProps } from "@/types/game";
import type { CameraView, HiddenObjectsSceneController, SceneTap } from "@/games/hidden-objects/hidden-objects-controller";
import {
  HIDDEN_OBJECTS_SUBTITLE,
  HIDDEN_OBJECTS_TITLE,
  announcementFor,
  buildHiddenObjectsResult,
  createSession,
  hintButtonLabel,
  hintHalo,
  hintMessage,
  hintSubject,
  regionBounds,
  sessionReducer,
  targetById,
  targetsFor,
} from "@/games/hidden-objects/hidden-objects-model";
import {
  DIFFICULTY_ORDER,
  DIFFICULTY_PRESETS,
  SCENE_STATIONS,
  thumbnailSrc,
} from "@/games/hidden-objects/hidden-objects-scene";
import { HiddenObjectsScene, type SceneFeedback } from "@/games/hidden-objects/HiddenObjectsScene";
import "@/games/hidden-objects/hidden-objects.css";

/** The closing card waits this long, so the last find's glow is seen first. */
export const COMPLETION_CARD_DELAY_MS = 700;

const DIFFICULTY_NOTE: Record<DifficultyLevel, string> = {
  easy: "5 objetos · lista com imagens",
  medium: "6 objetos · lista com silhuetas",
  hard: "8 objetos · lista só com palavras",
};

/**
 * Estúdio das Descobertas (GAME03-SKELETON-01). React owns the session and
 * the HUD; the camera, gestures and hit geometry live in plain modules and
 * reach React only as discrete events (a tap, a settled view).
 */
export function HiddenObjectsGame({ onComplete, onExit, onEntryReady, onEntryError }: GameComponentProps) {
  const [state, dispatch] = useReducer(sessionReducer, undefined, () => createSession());
  const [view, setView] = useState<CameraView | null>(null);
  const [cardRound, setCardRound] = useState<number | null>(null);
  const [dismissedRound, setDismissedRound] = useState<number | null>(null);
  const controllerRef = useRef<HiddenObjectsSceneController | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const concludeRef = useRef<HTMLButtonElement>(null);
  const completionSent = useRef(false);
  const instructionsId = useId();

  const listed = targetsFor(state.difficulty);
  const preset = DIFFICULTY_PRESETS[state.difficulty];
  const playing = state.status === "playing";
  const finished = state.status === "completed";
  const cardVisible = finished && cardRound === state.round && dismissedRound !== state.round;
  const subject = hintSubject(state);
  const hintText =
    state.hintTarget && state.hintStage > 0 ? hintMessage(state.hintTarget, state.hintStage) : "";
  const hintedStation =
    state.hintTarget && state.hintStage >= 1 ? targetById(state.hintTarget).station : null;

  const handleTap = useCallback((tap: SceneTap) => {
    dispatch({ type: "tap", point: tap.point, scale: tap.scale, pointerType: tap.pointerType });
  }, []);

  // Every start and restart: the camera goes back to the table.
  useEffect(() => {
    if (state.round > 0) controllerRef.current?.reset();
  }, [state.round]);

  // A start moves the keyboard into the room (the reticle shows for keyboard users).
  useEffect(() => {
    if (state.round > 0) viewportRef.current?.focus({ preventScroll: true });
  }, [state.round]);

  // The hint ladder moves the camera only because the Explorador asked.
  useEffect(() => {
    const event = state.lastEvent;
    const controller = controllerRef.current;
    if (!controller || event?.kind !== "hint") return;
    const target = targetById(event.targetId);
    if (event.stage === 1) controller.goToStation(target.station);
    if (event.stage === 2) {
      const halo = hintHalo(event.targetId, state.difficulty, 2);
      if (halo) controller.showCircle({ x: halo.cx, y: halo.cy }, halo.r);
    }
    if (event.stage === 3) controller.reveal(regionBounds(target.region));
  }, [state.eventSeq, state.lastEvent, state.difficulty]);

  // The closing card follows the last find after a short pause (cleared on restart/unmount).
  useEffect(() => {
    if (state.status !== "completed") return;
    const round = state.round;
    const timer = window.setTimeout(() => setCardRound(round), COMPLETION_CARD_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [state.status, state.round]);

  useEffect(() => {
    if (cardVisible) concludeRef.current?.focus();
  }, [cardVisible]);

  /** One result per session: the first "Concluir" sends it; nothing else ever does. */
  const conclude = () => {
    if (completionSent.current || state.status !== "completed") return;
    completionSent.current = true;
    onComplete(buildHiddenObjectsResult(state));
  };

  const feedback = useMemo<SceneFeedback>(() => {
    const event = state.lastEvent;
    const seq = state.eventSeq;
    const haloStage = state.hintTarget ? state.hintStage : 0;
    const halo =
      state.hintTarget && (haloStage === 2 || haloStage === 3)
        ? hintHalo(state.hintTarget, state.difficulty, haloStage)
        : null;
    const haloSeq = state.hintSeq;
    return {
      found: state.foundIds,
      latestFound: event?.kind === "found" ? { id: event.targetId, seq } : null,
      again: event?.kind === "already" ? { id: event.targetId, seq } : null,
      ripple: event?.kind === "miss" ? { x: event.point.x, y: event.point.y, seq } : null,
      halo: halo ? { ...halo, kind: haloStage === 3 ? "reveal" : "hint", seq: haloSeq } : null,
    };
  }, [state.lastEvent, state.eventSeq, state.foundIds, state.hintTarget, state.hintStage, state.hintSeq, state.difficulty]);

  const announcement = announcementFor(state);

  return (
    <div className="hos-shell" data-status={state.status} data-list={preset.listStyle}>
      <header className="hos-topbar">
        <button type="button" className="hos-chip-button" onClick={onExit} aria-label="Voltar à jornada">
          <ArrowLeft size={20} aria-hidden="true" />
          <span className="hos-hide-narrow">Voltar à jornada</span>
        </button>
        <div className="hos-title">
          <strong>{HIDDEN_OBJECTS_TITLE}</strong>
          <span className="hos-hide-narrow">{HIDDEN_OBJECTS_SUBTITLE}</span>
        </div>
        <button
          type="button"
          className="hos-chip-button"
          onClick={() => dispatch({ type: "restart" })}
          disabled={state.status === "setup"}
          aria-label="Recomeçar a exploração"
        >
          <RotateCcw size={19} aria-hidden="true" />
          <span className="hos-hide-narrow">Recomeçar</span>
        </button>
      </header>

      <div className="hos-body">
        <div className="hos-scene-column" inert={state.status === "setup" ? true : undefined}>
          <HiddenObjectsScene
            controllerRef={controllerRef}
            viewportRef={viewportRef}
            feedback={feedback}
            view={view}
            interactive={state.status !== "setup"}
            instructionsId={instructionsId}
            onTap={handleTap}
            onSettle={setView}
            onReady={onEntryReady}
            onError={onEntryError}
          />
          {hintText && (
            <p className="hos-hint-banner" key={`hint-${state.hintSeq}`}>
              <Lightbulb size={18} aria-hidden="true" />
              {hintText}
            </p>
          )}
        </div>

        <aside className="hos-panel" aria-label="Objetos para encontrar" inert={state.status === "setup" ? true : undefined}>
          <div className="hos-panel-head">
            <h2>Objetos para encontrar</h2>
            <p className="hos-progress-text">
              <strong>{state.foundIds.length}/{listed.length}</strong> encontrados
            </p>
            <div
              className="hos-progress"
              role="progressbar"
              aria-label="Objetos encontrados"
              aria-valuemin={0}
              aria-valuemax={listed.length}
              aria-valuenow={state.foundIds.length}
              aria-valuetext={`${state.foundIds.length} de ${listed.length}`}
            >
              <span style={{ width: `${(100 * state.foundIds.length) / listed.length}%` }} />
            </div>
          </div>

          <ul className="hos-list">
            {listed.map((id) => {
              const target = targetById(id);
              const found = state.foundIds.includes(id);
              const focused = !found && subject === id && state.focusedTarget === id;
              const showArt = found || preset.listStyle !== "word";
              return (
                <li key={id}>
                  <button
                    type="button"
                    className="hos-item"
                    data-found={found ? "true" : undefined}
                    data-focused={focused ? "true" : undefined}
                    aria-pressed={found ? undefined : focused}
                    disabled={found || !playing}
                    onClick={() => dispatch({ type: "focus-target", targetId: id })}
                    aria-label={found ? `${target.accessibleLabel}: encontrado` : `${target.accessibleLabel}: procurar`}
                  >
                    {showArt && (
                      <span className="hos-item-art" data-style={found ? "picture" : preset.listStyle}>
                        <Image src={thumbnailSrc(id)} alt="" width={64} height={64} unoptimized loading="eager" draggable={false} />
                      </span>
                    )}
                    <span className="hos-item-label">{target.label}</span>
                    <span className="hos-item-state" aria-hidden="true">
                      {found ? <Check size={18} strokeWidth={3.2} /> : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="hos-hint-row">
            <button
              type="button"
              className="hos-hint-button"
              onClick={() => dispatch({ type: "hint" })}
              disabled={!playing || !subject}
            >
              <Lightbulb size={19} aria-hidden="true" />
              <span>
                {hintButtonLabel(state)}
                {subject && playing ? <small>{targetById(subject).label}</small> : null}
              </span>
            </button>
            {finished && !cardVisible && (
              <button type="button" className="hos-primary-small" onClick={conclude}>
                Concluir exploração
              </button>
            )}
          </div>

          <nav className="hos-stations" aria-label="Estações">
            {SCENE_STATIONS.map((station) => (
              <button
                key={station.id}
                type="button"
                className="hos-station"
                aria-pressed={view?.station === station.id}
                data-hinted={hintedStation === station.id ? "true" : undefined}
                disabled={state.status === "setup"}
                onClick={() => controllerRef.current?.goToStation(station.id)}
              >
                {station.label}
              </button>
            ))}
          </nav>
        </aside>
      </div>

      <p id={instructionsId} className="hos-sr-only">
        Arraste para explorar a sala; aproxime com dois dedos, com a roda do mouse ou com os botões mais e menos.
        No teclado: setas movem, mais e menos aproximam, 1, 2 e 3 vão para Janela, Mesa e Estante, 0 recentra e
        Enter toca no centro da mira.
      </p>
      <p className="hos-sr-only" aria-live="polite" key={`live-${state.eventSeq}`}>
        {announcement}
      </p>

      {state.status === "setup" && (
        <SetupCard
          difficulty={state.difficulty}
          onDifficulty={(difficulty) => dispatch({ type: "select-difficulty", difficulty })}
          onStart={() => dispatch({ type: "start" })}
        />
      )}

      {cardVisible && (
        <div className="hos-overlay hos-overlay-complete">
          <section className="hos-card" role="dialog" aria-modal="false" aria-labelledby="hos-complete-title">
            <span className="hos-card-emblem" aria-hidden="true">
              <Search size={26} />
            </span>
            <h2 id="hos-complete-title">Estúdio explorado</h2>
            <p>Você encontrou os {listed.length} objetos. Observe com calma sempre que quiser voltar.</p>
            <div className="hos-card-actions">
              <button ref={concludeRef} type="button" className="hos-primary" onClick={conclude}>
                Concluir exploração
              </button>
              <button type="button" className="hos-secondary" onClick={() => setDismissedRound(state.round)}>
                Continuar olhando
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function SetupCard({
  difficulty,
  onDifficulty,
  onStart,
}: {
  difficulty: DifficultyLevel;
  onDifficulty: (difficulty: DifficultyLevel) => void;
  onStart: () => void;
}) {
  return (
    <div className="hos-overlay hos-overlay-setup">
      <section className="hos-card hos-setup" aria-labelledby="hos-setup-title">
        <p className="hos-kicker">Preparar</p>
        <h2 id="hos-setup-title">{HIDDEN_OBJECTS_TITLE}</h2>
        <p className="hos-subtitle">{HIDDEN_OBJECTS_SUBTITLE}</p>
        <p className="hos-setup-copy">Observe com calma. Há mais do que parece.</p>
        <fieldset className="hos-difficulty">
          <legend>Dificuldade</legend>
          {DIFFICULTY_ORDER.map((level) => (
            <label key={level} className="hos-difficulty-option" data-selected={level === difficulty ? "true" : undefined}>
              <input
                type="radio"
                name="hos-difficulty"
                value={level}
                checked={level === difficulty}
                onChange={() => onDifficulty(level)}
              />
              <span>
                <strong>{DIFFICULTY_PRESETS[level].label}</strong>
                <small>{DIFFICULTY_NOTE[level]}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="hos-controls-line">Arraste para explorar · pince, use a roda ou + e − para aproximar</p>
        <button type="button" className="hos-primary" onClick={onStart}>
          <Search size={20} aria-hidden="true" />
          Explorar
        </button>
      </section>
    </div>
  );
}
