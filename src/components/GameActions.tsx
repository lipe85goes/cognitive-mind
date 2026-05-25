import { RotateCcw, Square } from "lucide-react";

interface GameActionsProps {
  onRestart: () => void;
  onEndSession?: () => void;
  restartLabel?: string;
  endLabel?: string;
  disabled?: boolean;
  /** Less prominent styling for secondary actions (e.g. maze restart). */
  subtle?: boolean;
}

/** Shared in-game controls: restart and optional end session. */
export function GameActions({
  onRestart,
  onEndSession,
  restartLabel = "Reiniciar",
  endLabel = "Encerrar sessão",
  disabled = false,
  subtle = false,
}: GameActionsProps) {
  const restartClass = subtle
    ? "btn-subtle flex w-full items-center justify-center gap-2 sm:w-auto"
    : "btn-secondary flex flex-1 items-center justify-center gap-2";

  return (
    <div
      className={`rounded-2xl border border-[var(--world-border,var(--border))] bg-white/45 p-3 ${subtle ? "mt-4 flex items-center justify-center" : "mt-6 flex flex-col gap-2.5 sm:flex-row"}`}
    >
      <button
        type="button"
        onClick={onRestart}
        disabled={disabled}
        aria-label={restartLabel}
        className={`${restartClass} disabled:opacity-50`}
      >
        <RotateCcw className="h-5 w-5" aria-hidden />
        {restartLabel}
      </button>
      {onEndSession && (
        <button
          type="button"
          onClick={onEndSession}
          disabled={disabled}
          aria-label={endLabel}
          className="btn-ghost flex min-h-[3rem] flex-1 items-center justify-center gap-2 text-base font-semibold disabled:opacity-50"
        >
          <Square className="h-4 w-4" aria-hidden />
          {endLabel}
        </button>
      )}
    </div>
  );
}
