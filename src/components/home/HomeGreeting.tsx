interface HomeGreetingProps {
  statusMessage?: string | null;
}

export function HomeGreeting({ statusMessage }: HomeGreetingProps) {
  return (
    <header className="hj-greeting" aria-labelledby="hj-home-title">
      <p className="hj-greeting-kicker">O Ateliê dos Mundos</p>
      <h1 id="hj-home-title" className="hj-greeting-title">
        Que bom te ver de novo.
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
