const STORAGE_KEY = "mindflow-sound-on";

const COLOR_TONES = [261.63, 329.63, 392, 523.25];

let audioCtx: AudioContext | null = null;

export function isSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(STORAGE_KEY) === "true";
}

export function setSoundEnabled(on: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, on ? "true" : "false");
}

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

function playTone(
  frequency: number,
  durationSec = 0.14,
  volume = 0.07,
  type: OscillatorType = "sine",
): void {
  if (!isSoundEnabled()) return;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationSec);

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + durationSec);
  } catch {
    /* Web Audio unavailable — fail silently */
  }
}

export function playColorTone(colorId: number): void {
  playTone(COLOR_TONES[colorId] ?? 440, 0.12, 0.06);
}

export function playSuccessChime(): void {
  if (!isSoundEnabled()) return;
  playTone(523.25, 0.1, 0.06);
  window.setTimeout(() => playTone(659.25, 0.12, 0.05), 90);
}

export function playGentleErrorTone(): void {
  playTone(196, 0.18, 0.05, "triangle");
}
