"use client";

import Image from "next/image";
import { useCallback, useEffect, useId, useMemo, useReducer, useRef, useState, type CSSProperties } from "react";
import { ArrowLeft, Check, DoorOpen, Lightbulb, ListChecks, RotateCcw, Search } from "lucide-react";
import type { DifficultyLevel, GameComponentProps } from "@/types/game";
import type { CameraView, HiddenObjectsSceneController, SceneTap } from "@/games/hidden-objects/hidden-objects-controller";
import {
  HIDDEN_OBJECTS_SUBTITLE,
  HIDDEN_OBJECTS_TITLE,
  announcementFor,
  buildHiddenObjectsResult,
  createSession,
  hintButtonLabel,
  hintCameraMove,
  hintHalo,
  hintMessage,
  hintRung,
  hintSubject,
  listEntryFor,
  sessionReducer,
  subjectText,
  targetById,
} from "@/games/hidden-objects/hidden-objects-model";
import {
  DIFFICULTY_ORDER,
  DIFFICULTY_PRESETS,
  type SceneDefinition,
} from "@/games/hidden-objects/hidden-objects-scene";
import { SCENES, forgetScene, rememberScene, rememberedScene } from "@/games/hidden-objects/hidden-objects-scenes";
import { HiddenObjectsScene, type SceneFeedback, type SceneLoadState } from "@/games/hidden-objects/HiddenObjectsScene";
import "@/games/hidden-objects/hidden-objects.css";

/** The closing card waits this long, so the last find's glow is seen first. */
export const COMPLETION_CARD_DELAY_MS = 700;

const DIFFICULTY_NOTE: Record<DifficultyLevel, string> = {
  easy: "lista com imagens · a pista pode mostrar onde está",
  medium: "a lista dá pistas, não nomes · a pista nunca revela",
  hard: "pistas indiretas · objetos mais escondidos",
};

/**
 * A new round's seed, drawn once per exploration — when "Explorar" is pressed,
 * never during a render. It is the only randomness in the game: the list itself
 * is a pure function of the room, the difficulty and this number.
 */
function freshRoundSeed(): number {
  return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
}

/** "1, 2 e 3 vão para Janela, Mesa e Estante": the keyboard's station keys, said for this room. */
function stationKeysLine(scene: SceneDefinition): string {
  const join = (items: readonly string[]) =>
    items.length > 1 ? `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}` : items.join("");
  return `${join(scene.stations.map((_, index) => String(index + 1)))} vão para ${join(scene.stations.map((station) => station.label))}`;
}

/**
 * Estúdio das Descobertas (GAME03-SKELETON-01, GAME03-EXPERIENCE-02,
 * GAME03-MULTISCENE-03). React owns the session and the HUD; the camera,
 * gestures and hit geometry live in plain modules and reach React only as
 * discrete events (a tap, a settled view). The room is data: the setup offers
 * every room of the registry, and the same session, scene and HUD play it.
 */
export function HiddenObjectsGame({ onComplete, onExit, onEntryReady, onEntryError }: GameComponentProps) {
  const [state, dispatch] = useReducer(sessionReducer, undefined, () => createSession(rememberedScene()));
  const [view, setView] = useState<CameraView | null>(null);
  const [cardRound, setCardRound] = useState<number | null>(null);
  const [dismissedRound, setDismissedRound] = useState<number | null>(null);
  /** The objectives tray can fold away so the room takes the screen (never remembered: the game stores nothing). */
  const [trayOpen, setTrayOpen] = useState(true);
  /** How the room on screen is loading; `attempt` remounts it for "Tentar de novo". */
  const [load, setLoad] = useState<{ sceneId: string; attempt: number; state: SceneLoadState }>(() => ({
    sceneId: state.scene.id,
    attempt: 0,
    state: "loading",
  }));
  /** Once a room has painted, the entry is behind us: a room chosen later is waited for by the setup card. */
  const [painted, setPainted] = useState(false);
  const controllerRef = useRef<HiddenObjectsSceneController | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const concludeRef = useRef<HTMLButtonElement>(null);
  const completionSent = useRef(false);
  const instructionsId = useId();
  const trayId = useId();

  const scene = state.scene;
  const sceneLoad = load.sceneId === scene.id ? load.state : "loading";
  const listed = state.targets;
  const preset = DIFFICULTY_PRESETS[state.difficulty];
  /** In setup no list is drawn yet: the panel counts what the chosen difficulty will ask for. */
  const total = state.status === "setup" ? preset.count : listed.length;
  const playing = state.status === "playing";
  const finished = state.status === "completed";
  const cardVisible = finished && cardRound === state.round && dismissedRound !== state.round;
  const subject = hintSubject(state);
  const hintText =
    state.hintTarget && state.hintStage > 0 ? hintMessage(scene, state.hintTarget, state.difficulty, state.hintStage, state.clues) : "";
  const hintedStation =
    state.hintTarget && state.hintStage >= 1 ? targetById(scene, state.hintTarget).station : null;

  const handleTap = useCallback((tap: SceneTap) => {
    dispatch({ type: "tap", point: tap.point, scale: tap.scale, pointerType: tap.pointerType });
  }, []);

  /** The room's own readiness, for the setup card (the shell hears it through onEntryReady / onEntryError). */
  const handleLoad = useCallback(
    (next: SceneLoadState) => {
      setLoad((current) => (current.sceneId === scene.id ? { ...current, state: next } : current));
      if (next === "ready") setPainted(true);
      // a room that cannot load is not offered first next time: the next entry opens on one that works
      if (next === "failed") forgetScene(scene);
    },
    [scene],
  );

  const chooseScene = (next: SceneDefinition) => {
    if (next === scene) return;
    dispatch({ type: "select-scene", scene: next });
    setLoad({ sceneId: next.id, attempt: 0, state: "loading" });
  };

  const retryScene = () => setLoad((current) => ({ sceneId: scene.id, attempt: current.attempt + 1, state: "loading" }));

  const explore = () => {
    rememberScene(scene);
    dispatch({ type: "start", seed: freshRoundSeed() });
  };

  // Every start and restart: the camera goes back to where the room opens.
  useEffect(() => {
    if (state.round > 0) controllerRef.current?.reset();
  }, [state.round]);

  // A start moves the keyboard into the room (the reticle shows for keyboard users).
  useEffect(() => {
    if (state.round > 0) viewportRef.current?.focus({ preventScroll: true });
  }, [state.round]);

  // The hint ladder moves the camera only because the Explorador asked, and only as far as its rung allows.
  useEffect(() => {
    const event = state.lastEvent;
    const controller = controllerRef.current;
    if (!controller || event?.kind !== "hint") return;
    const move = hintCameraMove(state.scene, event.targetId, state.difficulty, event.stage);
    if (move?.kind === "station") controller.goToStation(move.station);
    if (move?.kind === "circle") controller.showCircle(move.center, move.radius);
    if (move?.kind === "frame") controller.reveal(move.bounds);
  }, [state.eventSeq, state.lastEvent, state.difficulty, state.scene]);

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
    const halo = state.hintTarget ? hintHalo(state.scene, state.hintTarget, state.difficulty, state.hintStage) : null;
    const reveal = state.hintTarget ? hintRung(state.difficulty, state.hintStage) === "reveal" : false;
    return {
      found: state.foundIds,
      latestFound:
        event?.kind === "found" ? { id: event.targetId, seq, label: targetById(state.scene, event.targetId).label } : null,
      again: event?.kind === "already" ? { id: event.targetId, seq } : null,
      ripple: event?.kind === "miss" ? { x: event.point.x, y: event.point.y, seq } : null,
      halo: halo ? { ...halo, kind: reveal ? "reveal" : "hint", seq: state.hintSeq } : null,
    };
  }, [state.lastEvent, state.eventSeq, state.foundIds, state.hintTarget, state.hintStage, state.hintSeq, state.difficulty, state.scene]);

  const announcement = announcementFor(state);
  const trayShown = trayOpen || state.status === "setup";

  return (
    <div
      className="hos-shell"
      data-status={state.status}
      data-list={preset.listStyle}
      data-tray={trayShown ? "open" : "closed"}
      data-scene={scene.id}
      data-round-seed={state.roundSeed ?? undefined}
    >
      <header className="hos-topbar">
        <button type="button" className="hos-chip-button" onClick={onExit} aria-label="Voltar à jornada">
          <ArrowLeft size={20} aria-hidden="true" />
          <span className="hos-hide-narrow">Voltar à jornada</span>
        </button>
        <div className="hos-title">
          <strong>{HIDDEN_OBJECTS_TITLE}</strong>
          <span className="hos-hide-narrow">
            {state.status === "setup" ? HIDDEN_OBJECTS_SUBTITLE : `${scene.name} · ${preset.label}`}
          </span>
        </div>
        <div className="hos-topbar-actions">
          <button
            type="button"
            className="hos-chip-button"
            onClick={() => dispatch({ type: "change-scene" })}
            disabled={state.status !== "playing"}
            aria-label="Trocar de cena"
          >
            <DoorOpen size={19} aria-hidden="true" />
            <span className="hos-hide-narrow">Trocar de cena</span>
          </button>
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
        </div>
      </header>

      <div className="hos-body">
        <div className="hos-scene-column" inert={state.status === "setup" ? true : undefined}>
          <HiddenObjectsScene
            key={`${scene.id}:${load.sceneId === scene.id ? load.attempt : 0}`}
            scene={scene}
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
            onLoad={handleLoad}
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
              <strong>{state.foundIds.length}/{total}</strong> encontrados
            </p>
            <div
              className="hos-progress"
              role="progressbar"
              aria-label="Objetos encontrados"
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={state.foundIds.length}
              aria-valuetext={`${state.foundIds.length} de ${total}`}
            >
              <span style={{ width: `${(100 * state.foundIds.length) / total}%` }} />
            </div>
            <button
              type="button"
              className="hos-tray-toggle"
              aria-expanded={trayShown}
              aria-controls={trayId}
              aria-label={
                trayShown
                  ? "Recolher a lista de objetos"
                  : `Mostrar a lista de objetos: ${state.foundIds.length} de ${total} encontrados`
              }
              onClick={() => setTrayOpen((open) => !open)}
            >
              <ListChecks size={18} aria-hidden="true" />
              <span>{trayShown ? "Recolher" : "Lista"}</span>
              <span className="hos-tray-count">
                {state.foundIds.length}/{total}
              </span>
            </button>
          </div>

          <ul className="hos-list" id={trayId} hidden={!trayShown}>
            {listed.map((id) => {
              const entry = listEntryFor(state, id);
              const focused = !entry.found && subject === id && state.focusedTarget === id;
              return (
                <li key={id}>
                  <button
                    type="button"
                    className="hos-item"
                    data-target={id}
                    data-found={entry.found ? "true" : undefined}
                    data-focused={focused ? "true" : undefined}
                    data-clue={entry.answered !== null || (!entry.found && preset.listStyle === "clue") ? "true" : undefined}
                    aria-pressed={entry.found ? undefined : focused}
                    disabled={entry.found || !playing}
                    onClick={() => dispatch({ type: "focus-target", targetId: id })}
                    aria-label={entry.accessibleText}
                  >
                    {entry.art && (
                      <span className="hos-item-art" data-style={entry.art}>
                        <Image src={scene.thumbnail(id)} alt="" width={64} height={64} unoptimized loading="eager" draggable={false} />
                      </span>
                    )}
                    <span className="hos-item-label">
                      {entry.text}
                      {entry.answered && <small className="hos-item-answered">{entry.answered}</small>}
                    </span>
                    <span className="hos-item-state" aria-hidden="true">
                      {entry.found ? <Check size={18} strokeWidth={3.2} /> : null}
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
                {subject && playing ? <small>{subjectText(state, subject)}</small> : null}
              </span>
            </button>
            {finished && !cardVisible && (
              <button type="button" className="hos-primary-small" onClick={conclude}>
                Concluir exploração
              </button>
            )}
          </div>

          <nav
            className="hos-stations"
            aria-label="Estações"
            style={{ "--hos-station-count": scene.stations.length } as CSSProperties}
          >
            {scene.stations.map((station) => (
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
        No teclado: setas movem, mais e menos aproximam, {stationKeysLine(scene)}, 0 recentra e Enter toca no
        centro da mira.
      </p>
      <p className="hos-sr-only" aria-live="polite" key={`live-${state.eventSeq}`}>
        {announcement}
      </p>

      {state.status === "setup" && (
        <SetupCard
          scene={scene}
          sceneLoad={sceneLoad}
          // before the first paint the entry transition covers the room; after it, the card waits for a new one
          waitForScene={painted}
          difficulty={state.difficulty}
          onScene={chooseScene}
          onRetryScene={retryScene}
          onDifficulty={(difficulty) => dispatch({ type: "select-difficulty", difficulty })}
          onStart={explore}
        />
      )}

      {cardVisible && (
        <div className="hos-overlay hos-overlay-complete">
          <section className="hos-card" role="dialog" aria-modal="false" aria-labelledby="hos-complete-title">
            <span className="hos-card-emblem" aria-hidden="true">
              <Search size={26} />
            </span>
            <h2 id="hos-complete-title">{scene.copy.completeTitle}</h2>
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
  scene,
  sceneLoad,
  waitForScene,
  difficulty,
  onScene,
  onRetryScene,
  onDifficulty,
  onStart,
}: {
  scene: SceneDefinition;
  sceneLoad: SceneLoadState;
  waitForScene: boolean;
  difficulty: DifficultyLevel;
  onScene: (scene: SceneDefinition) => void;
  onRetryScene: () => void;
  onDifficulty: (difficulty: DifficultyLevel) => void;
  onStart: () => void;
}) {
  const failed = sceneLoad === "failed";
  const preparing = waitForScene && sceneLoad === "loading";
  return (
    <div className="hos-overlay hos-overlay-setup">
      <section className="hos-card hos-setup" aria-labelledby="hos-setup-title">
        <p className="hos-kicker">Preparar</p>
        <h2 id="hos-setup-title">{HIDDEN_OBJECTS_TITLE}</h2>
        <p className="hos-subtitle">{HIDDEN_OBJECTS_SUBTITLE}</p>
        <p className="hos-setup-copy">Observe com calma. A cada visita, a sala pede outros objetos e outras pistas.</p>
        <fieldset className="hos-scenes">
          <legend>Cena</legend>
          {SCENES.map((option) => (
            <label key={option.id} className="hos-scene-option" data-selected={option === scene ? "true" : undefined}>
              <input
                type="radio"
                name="hos-scene"
                value={option.id}
                checked={option === scene}
                onChange={() => onScene(option)}
              />
              <span className="hos-scene-preview" aria-hidden="true">
                <Image
                  src={option.preview}
                  alt=""
                  width={320}
                  height={240}
                  sizes="(max-width: 599px) 45vw, 16rem"
                  loading="eager"
                  draggable={false}
                />
              </span>
              <span className="hos-scene-text">
                <strong>{option.name}</strong>
                <small>{option.copy.tagline}</small>
              </span>
            </label>
          ))}
        </fieldset>
        {failed && (
          <div className="hos-scene-failed" role="status">
            <p>Não foi possível abrir o {scene.name} agora.</p>
            <button type="button" className="hos-secondary" onClick={onRetryScene}>
              Tentar de novo
            </button>
          </div>
        )}
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
                <small>
                  {DIFFICULTY_PRESETS[level].count} objetos · {DIFFICULTY_NOTE[level]}
                </small>
              </span>
            </label>
          ))}
        </fieldset>
        <p className="hos-controls-line">Arraste para explorar · pince, use a roda ou + e − para aproximar</p>
        <button type="button" className="hos-primary" onClick={onStart} disabled={failed || preparing}>
          <Search size={20} aria-hidden="true" />
          {preparing ? "Preparando a cena…" : "Explorar"}
        </button>
      </section>
    </div>
  );
}
