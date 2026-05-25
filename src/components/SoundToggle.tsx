"use client";

import { useEffect, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { isSoundEnabled, setSoundEnabled } from "@/lib/game-sounds";

interface SoundToggleProps {
  className?: string;
}

/** Optional soft sounds — default off, persisted on device. */
export function SoundToggle({ className = "" }: SoundToggleProps) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only preference
    setOn(isSoundEnabled());
  }, []);

  const toggle = () => {
    const next = !on;
    setOn(next);
    setSoundEnabled(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={on ? "Desligar sons suaves" : "Ligar sons suaves"}
      aria-pressed={on}
      className={`inline-flex min-h-[3rem] min-w-[3rem] items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 text-base font-bold text-slate-800 shadow-[0_3px_0_0_#e2e8f0] transition hover:border-teal-500 hover:bg-teal-50 ${className}`.trim()}
    >
      {on ? (
        <Volume2 className="h-5 w-5 text-teal-700" aria-hidden />
      ) : (
        <VolumeX className="h-5 w-5 text-slate-500" aria-hidden />
      )}
      <span>Som: {on ? "ligado" : "desligado"}</span>
    </button>
  );
}
