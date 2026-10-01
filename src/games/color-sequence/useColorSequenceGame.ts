"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  playColorTone,
  playGentleErrorTone,
  playSuccessChime,
} from "@/lib/game-sounds";
import {
  calculateColorSequenceScore,
  COLOR_SEQUENCE_MAX_ERRORS,
} from "@/engine/scoring";
import type { GameResult } from "@/types/game";

export type MemoryPhase = "idle" | "showing" | "input" | "round-complete";
export type TapFeedback = "correct" | "wrong" | null;
export type StatusVariant = "neutral" | "info" | "success" | "error";

/** Playback timings — kept identical to the original Color Sequence game. */
const SHOW_MS = 850;
const GAP_MS = 400;
const TAP_FLASH_MS = 280;

function randomColorId(): number {
  return Math.floor(Math.random() * 4);
}

/**
 * One play session: from Ativar or Recomeçar until the result is emitted, the
 * player restarts, or the game unmounts. It owns every timeout scheduled on its
 * behalf — playback steps, tap flashes, the mistake and round-complete windows —
 * so ending it ends all of them at once.
 */
interface Session {
  readonly timers: Set<number>;
}

/** The live session, or null before Ativar and after the session ended. */
type SessionRef = RefObject<Session | null>;

/** End the live session and clear every timeout it still owns. */
function revokeSession(sessionRef: SessionRef): void {
  const session = sessionRef.current;
  if (!session) return;
  sessionRef.current = null;
  for (const id of session.timers) window.clearTimeout(id);
  session.timers.clear();
}

/** Replace the live session with a new one; nothing the old one scheduled runs. */
function openSession(sessionRef: SessionRef): void {
  revokeSession(sessionRef);
  sessionRef.current = { timers: new Set() };
}

/**
 * `window.setTimeout` on behalf of the live session. The callback runs only if
 * that same session is still live when it fires; with no live session nothing
 * is scheduled.
 */
function scheduleForSession(
  sessionRef: SessionRef,
  callback: () => void,
  ms: number,
): void {
  const session = sessionRef.current;
  if (!session) return;
  const id = window.setTimeout(() => {
    session.timers.delete(id);
    if (sessionRef.current === session) callback();
  }, ms);
  session.timers.add(id);
}

/**
 * Resolves after `ms` on behalf of the live session. If the session ends first
 * the timeout is cleared and the promise never settles, so a playback awaiting
 * it never resumes.
 */
function sessionDelay(sessionRef: SessionRef, ms: number): Promise<void> {
  return new Promise((resolve) => scheduleForSession(sessionRef, resolve, ms));
}

type CompleteFn = (result: Omit<GameResult, "id" | "playedAt">) => void;

/**
 * The Circuito de Memória (color-sequence) game logic, extracted verbatim from
 * the original `ColorSequenceGame` so the state machine, scoring, max-errors
 * behaviour and completion contract are preserved exactly. The 3D console scene
 * and the accessible control row are both pure views over this state.
 */
export function useColorSequenceGame(onComplete: CompleteFn) {
  const [sequence, setSequence] = useState<number[]>([]);
  const [level, setLevel] = useState(1);
  const [errors, setErrors] = useState(0);
  const [phase, setPhase] = useState<MemoryPhase>("idle");
  const [activeColor, setActiveColor] = useState<number | null>(null);
  const [showStep, setShowStep] = useState(0);
  const [inputIndex, setInputIndex] = useState(0);
  const [roundMessage, setRoundMessage] = useState<TapFeedback>(null);
  const [lastTapped, setLastTapped] = useState<number | null>(null);
  const [tapFeedback, setTapFeedback] = useState<TapFeedback>(null);
  const [inputLocked, setInputLocked] = useState(true);
  const [shakeToken, setShakeToken] = useState(0);

  const sessionRef = useRef<Session | null>(null);

  // Unmounting — Voltar à jornada, or the result screen replacing the game —
  // ends the session and everything it still had pending.
  useEffect(() => () => revokeSession(sessionRef), []);

  const score = calculateColorSequenceScore({
    level,
    sequenceLength: sequence.length,
    errors,
  });

  const finishGame = useCallback(
    (stats: { level: number; sequenceLength: number; errors: number }) => {
      // A session reports exactly one result. Encerrar and the last mistake's
      // window can both get here; the first one ends the session, and with it
      // whatever the other still had pending.
      if (!sessionRef.current) return;
      revokeSession(sessionRef);
      onComplete({
        activityId: "color-sequence",
        activityTitle: "Circuito de Memória",
        gameId: "color-sequence",
        score: calculateColorSequenceScore(stats),
        summary:
          stats.level > 1
            ? `Circuito ativado! Você chegou à etapa ${stats.level}.`
            : "Boa tentativa! Observe o circuito com calma e tente novamente.",
        details: {
          level: stats.level,
          sequenceLength: stats.sequenceLength,
          errors: stats.errors,
          maxErrors: COLOR_SEQUENCE_MAX_ERRORS,
        },
      });
    },
    [onComplete],
  );

  /** Play the current sequence with highlight animation. */
  const playSequence = useCallback(async (seq: number[]) => {
    const session = sessionRef.current;
    if (!session) return;
    setInputLocked(true);
    setPhase("showing");
    setRoundMessage(null);
    setTapFeedback(null);
    setLastTapped(null);
    setShowStep(0);

    for (let i = 0; i < seq.length; i++) {
      if (sessionRef.current !== session) return;

      setShowStep(i + 1);
      setActiveColor(seq[i]);
      playColorTone(seq[i]);
      await sessionDelay(sessionRef, SHOW_MS);
      if (sessionRef.current !== session) return;

      setActiveColor(null);
      await sessionDelay(sessionRef, GAP_MS);
      if (sessionRef.current !== session) return;
    }

    setShowStep(0);
    setPhase("input");
    setInputIndex(0);
    setInputLocked(false);
  }, []);

  const startRound = useCallback(
    (nextSequence: number[]) => {
      setSequence(nextSequence);
      void playSequence(nextSequence);
    },
    [playSequence],
  );

  const restartSession = useCallback(() => {
    openSession(sessionRef);
    setLevel(1);
    setErrors(0);
    setInputIndex(0);
    setRoundMessage(null);
    setTapFeedback(null);
    setLastTapped(null);
    setActiveColor(null);
    setShowStep(0);
    const first = [randomColorId()];
    startRound(first);
  }, [startRound]);

  const beginGame = useCallback(() => {
    openSession(sessionRef);
    const first = [randomColorId()];
    setLevel(1);
    setErrors(0);
    setInputIndex(0);
    setRoundMessage(null);
    setTapFeedback(null);
    setLastTapped(null);
    startRound(first);
  }, [startRound]);

  const handleMistake = useCallback(
    (currentErrors: number, currentSequence: number[]) => {
      setShakeToken((t) => t + 1);
      playGentleErrorTone();
      setRoundMessage("wrong");
      setTapFeedback("wrong");
      const nextErrors = currentErrors + 1;
      setErrors(nextErrors);

      scheduleForSession(sessionRef, () => {
        setRoundMessage(null);
        setTapFeedback(null);
        setLastTapped(null);

        if (nextErrors >= COLOR_SEQUENCE_MAX_ERRORS) {
          finishGame({
            level,
            sequenceLength: currentSequence.length,
            errors: nextErrors,
          });
          return;
        }

        setInputIndex(0);
        void playSequence(currentSequence);
      }, 750);
    },
    [finishGame, level, playSequence],
  );

  /** Player taps a color (from a 3D pad or the accessible control row). */
  const handleColorPress = (colorId: number) => {
    if (inputLocked || phase !== "input") return;

    setInputLocked(true);
    setLastTapped(colorId);
    setActiveColor(colorId);

    const expected = sequence[inputIndex];
    if (colorId !== expected) {
      scheduleForSession(sessionRef, () => setActiveColor(null), TAP_FLASH_MS);
      handleMistake(errors, sequence);
      return;
    }

    setTapFeedback("correct");
    playColorTone(colorId);
    scheduleForSession(sessionRef, () => {
      setActiveColor(null);
      setTapFeedback(null);
      setLastTapped(null);
    }, TAP_FLASH_MS);

    const nextIndex = inputIndex + 1;
    if (nextIndex < sequence.length) {
      setInputIndex(nextIndex);
      setInputLocked(false);
      return;
    }

    setPhase("round-complete");
    setRoundMessage("correct");
    playSuccessChime();
    const nextLevel = level + 1;
    const extended = [...sequence, randomColorId()];

    scheduleForSession(sessionRef, () => {
      setRoundMessage(null);
      setLevel(nextLevel);
      setInputIndex(0);
      startRound(extended);
    }, 700);
  };

  const endSession = useCallback(() => {
    finishGame({ level, sequenceLength: sequence.length, errors });
  }, [errors, finishGame, level, sequence.length]);

  const statusMessage = (() => {
    if (phase === "idle") return "Toque em Ativar para acender o circuito.";
    if (phase === "showing") {
      return showStep > 0
        ? `Observe o circuito (${showStep} de ${sequence.length})`
        : "Observe o circuito";
    }
    if (tapFeedback === "wrong" || roundMessage === "wrong") {
      return "Tente novamente com calma.";
    }
    if (phase === "round-complete" || roundMessage === "correct") {
      return "Circuito ativado!";
    }
    if (tapFeedback === "correct") {
      return inputIndex % 2 === 0 ? "Boa lembrança." : "Boa memória!";
    }
    if (phase === "input") {
      return sequence.length > 0
        ? `Agora repita — ${sequence.length} sinais`
        : "Agora é sua vez";
    }
    return "";
  })();

  const statusVariant: StatusVariant = (() => {
    if (phase === "showing") return "info";
    if (roundMessage === "wrong" || tapFeedback === "wrong") return "error";
    if (
      roundMessage === "correct" ||
      tapFeedback === "correct" ||
      phase === "round-complete"
    ) {
      return "success";
    }
    if (phase === "input") return "info";
    return "neutral";
  })();

  const canTap = phase === "input" && !inputLocked;

  return {
    sequence,
    level,
    errors,
    phase,
    activeColor,
    showStep,
    inputIndex,
    roundMessage,
    lastTapped,
    tapFeedback,
    shakeToken,
    score,
    canTap,
    maxErrors: COLOR_SEQUENCE_MAX_ERRORS,
    statusMessage,
    statusVariant,
    beginGame,
    restartSession,
    handleColorPress,
    endSession,
  };
}
