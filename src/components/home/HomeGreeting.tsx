import type { GameResult } from "@/types/game";

interface HomeGreetingProps {
  recentResult?: GameResult;
  statusMessage?: string | null;
}

export function HomeGreeting({
  recentResult,
  statusMessage,
}: HomeGreetingProps) {
  const heading = recentResult ? "Que bom te ver de novo." : "Bem-vindo, Explorador.";

  return (
    <header className="hj-greeting" aria-labelledby="hj-home-title">
      <p className="hj-greeting-kicker">O Ateliê dos Mundos</p>
      <h1 id="hj-home-title" className="hj-greeting-title">
        {heading}
      </h1>
      <p className="hj-greeting-copy">Escolha um mundo para pensar em paz.</p>
      {statusMessage ? (
        <p className="hj-greeting-notice" role="status">
          {statusMessage}
        </p>
      ) : null}
    </header>
  );
}
