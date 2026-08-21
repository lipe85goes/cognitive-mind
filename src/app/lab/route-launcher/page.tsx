"use client";

import { useCallback, useEffect, useState } from "react";
import { GameScreen } from "@/components/GameScreen";
import {
  armRouteRandomSeed,
  clearRouteRandomSeed,
  getArmedRouteSeed,
} from "@/engine/route-random";
import { createTransientGameResult } from "@/engine/storage";
import type { DifficultyLevel, GameResult } from "@/types/game";

/**
 * ROTA-DIFFICULTY-04C — developer / playtest tooling. Not a product feature.
 *
 * It reaches the real game the same way `/lab/3d-home` does: through
 * `GameScreen`, into the same `useEscapeMaze`, the same renderer, the same
 * Hunter, Sentinel, Chest, Pickaxe, Second Chance, traps, portal and lights.
 * There is no second engine here and no gameplay rule is restated — the page's
 * whole job is to supply three inputs and then get out of the way.
 *
 * The parent lab layout exposes it only in local development. Nothing links to
 * it, diagnostic results stay transient, and the seeded stream is disarmed
 * when this page unmounts so normal journeys remain stochastic.
 */

const DIFFICULTIES: readonly DifficultyLevel[] = ["easy", "medium", "hard"];
const DIFFICULTY_LABEL: Record<DifficultyLevel, string> = {
  easy: "easy (Aberto)",
  medium: "medium (Equilibrado)",
  hard: "hard (Desafiador)",
};

/** The same-seed BEFORE/AFTER witnesses, in the suggested playtest order. */
const SCENARIOS: ReadonlyArray<{
  id: string;
  seed: number;
  routeNumber: number;
  difficulty: DifficultyLevel;
  why: string;
}> = [
  { id: "BASE-1", seed: 12420031, routeNumber: 2, difficulty: "easy", why: "Hunter começa a distância 9 — pressão baixa, referência de normalidade" },
  { id: "BASE-2", seed: 12430048, routeNumber: 3, difficulty: "easy", why: "Chest detour de 10 — o baú vale o desvio?" },
  { id: "BASE-3", seed: 12421027, routeNumber: 2, difficulty: "medium", why: "Pickaxe melhora 10 moves — a Picareta compensa o turno?" },
  { id: "HARD-1", seed: 12412046, routeNumber: 1, difficulty: "hard", why: "amostra representativa — mais walls, decisões e exposição já na Route 1" },
  { id: "HARD-2", seed: 12422073, routeNumber: 2, difficulty: "hard", why: "amostra representativa — observe o compromisso de rota e os choke points" },
  { id: "OUT-1", seed: 12432116, routeNumber: 3, difficulty: "hard", why: "mesma seed após o rebalance — compare com o antigo forced streak de 10" },
  { id: "OUT-2", seed: 12432045, routeNumber: 3, difficulty: "hard", why: "mesma seed após o rebalance — compare com a antiga rota de 43 moves" },
];

interface ActiveSession {
  seed: number;
  routeNumber: number;
  difficulty: DifficultyLevel;
  key: number;
}

function parseSeed(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  if (!Number.isSafeInteger(value) || value < 0 || value > 0xffffffff) return null;
  return value;
}

function parseRoute(raw: string): number | null {
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const value = Number(trimmed);
  // Routes are unbounded by design; stage is ((n - 1) % 3) + 1. The ceiling is
  // a sanity bound for a text field, not a product rule, and this mission does
  // not decide where a journey ends.
  if (!Number.isSafeInteger(value) || value < 1 || value > 999) return null;
  return value;
}

export default function RouteLauncherPage() {
  const [seedInput, setSeedInput] = useState("12432045");
  const [routeInput, setRouteInput] = useState("3");
  const [difficulty, setDifficulty] = useState<DifficultyLevel>("hard");
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [lastResult, setLastResult] = useState<GameResult | null>(null);

  // Disarm when the page goes away, so nothing seeded survives into a normal
  // journey. This is the whole containment story — there is no storage, no
  // global flag and no query string to leave behind.
  useEffect(() => clearRouteRandomSeed, []);

  const launch = useCallback(
    (seed: number, routeNumber: number, mode: DifficultyLevel) => {
      setError(null);
      setLastResult(null);
      // Armed BEFORE the game mounts, so the hook's first generation is the
      // first draw of the seeded stream.
      armRouteRandomSeed(seed);
      setSession((previous) => ({
        seed,
        routeNumber,
        difficulty: mode,
        key: (previous?.key ?? 0) + 1,
      }));
    },
    [],
  );

  const launchFromForm = () => {
    const seed = parseSeed(seedInput);
    const routeNumber = parseRoute(routeInput);
    if (seed === null) {
      setError("Seed inválida: use um inteiro de 0 a 4294967295.");
      return;
    }
    if (routeNumber === null) {
      setError("Route inválida: use um inteiro de 1 a 999.");
      return;
    }
    launch(seed, routeNumber, difficulty);
  };

  const exitDiagnostic = () => {
    clearRouteRandomSeed();
    setSession(null);
    setLastResult(null);
  };

  if (session) {
    return (
      <main style={S.sessionShell}>
        <header style={S.banner}>
          <strong style={S.bannerTitle}>DIAGNÓSTICO</strong>
          <span style={S.bannerItem}>
            Route <b>{session.routeNumber}</b>
          </span>
          <span style={S.bannerItem}>
            Difficulty <b>{session.difficulty}</b>
          </span>
          <span style={S.bannerItem}>
            Seed <b>{session.seed}</b>
          </span>
          <span style={S.bannerItem}>
            armado <b>{String(getArmedRouteSeed() ?? "não")}</b>
          </span>
          <button type="button" onClick={exitDiagnostic} style={S.bannerButton}>
            Sair do diagnóstico
          </button>
          <button
            type="button"
            onClick={() => launch(session.seed, session.routeNumber, session.difficulty)}
            style={S.bannerButton}
          >
            Relançar
          </button>
        </header>

        {lastResult && (
          <p style={S.resultLine}>
            Fim: <b>{lastResult.details.won === true ? "vitória" : "derrota"}</b> ·
            turnos <b>{String(lastResult.details.turns ?? "?")}</b> · recompensa{" "}
            <b>{String(lastResult.details.rewardChosen ?? "—")}</b> · parede quebrada{" "}
            <b>{lastResult.details.wallBroken === true ? "sim" : "não"}</b>
          </p>
        )}

        <GameScreen
          key={session.key}
          gameId="escape-maze"
          sessionKey={session.key}
          initialRouteNumber={session.routeNumber}
          initialDifficulty={session.difficulty}
          skipIntro
          onComplete={(partial) =>
            setLastResult(createTransientGameResult(partial))
          }
          onExit={exitDiagnostic}
        />
      </main>
    );
  }

  return (
    <main style={S.formShell}>
      <h1 style={S.h1}>Route launcher — diagnóstico</h1>
      <p style={S.note}>
        Ferramenta de engenharia. Inicia a Rota Estratégica real com Route,
        Difficulty e Seed explícitos. Não faz parte do produto e não aparece na
        Home.
      </p>

      <div style={S.row}>
        <label style={S.label}>
          Route
          <input
            value={routeInput}
            onChange={(event) => setRouteInput(event.target.value)}
            inputMode="numeric"
            style={S.input}
          />
        </label>
        <label style={S.label}>
          Difficulty
          <select
            value={difficulty}
            onChange={(event) => setDifficulty(event.target.value as DifficultyLevel)}
            style={S.input}
          >
            {DIFFICULTIES.map((level) => (
              <option key={level} value={level}>
                {DIFFICULTY_LABEL[level]}
              </option>
            ))}
          </select>
        </label>
        <label style={S.label}>
          Seed
          <input
            value={seedInput}
            onChange={(event) => setSeedInput(event.target.value)}
            inputMode="numeric"
            style={S.input}
          />
        </label>
        <button type="button" onClick={launchFromForm} style={S.launch}>
          Launch
        </button>
      </div>

      {error && <p style={S.error}>{error}</p>}

      <h2 style={S.h2}>Bateria sugerida</h2>
      <p style={S.note}>
        Na ordem: dois cenários de referência antes dos outliers, para haver
        base de comparação.
      </p>
      <ol style={S.list}>
        {SCENARIOS.map((scenario) => (
          <li key={scenario.id} style={S.listItem}>
            <button
              type="button"
              onClick={() =>
                launch(scenario.seed, scenario.routeNumber, scenario.difficulty)
              }
              style={S.scenarioButton}
            >
              {scenario.id} · R{scenario.routeNumber} {scenario.difficulty} ·{" "}
              {scenario.seed}
            </button>
            <span style={S.why}>{scenario.why}</span>
          </li>
        ))}
      </ol>
    </main>
  );
}

/**
 * Inline styles on purpose: this page must not grow a design system, and it
 * must not pull the product's CSS into a shape that exists only for tooling.
 */
const S: Record<string, React.CSSProperties> = {
  formShell: {
    minHeight: "100vh",
    padding: "2rem",
    background: "#12100c",
    color: "#f4ead6",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  sessionShell: { minHeight: "100vh", background: "#12100c" },
  h1: { fontSize: "1.2rem", fontWeight: 700, marginBottom: "0.5rem" },
  h2: { fontSize: "1rem", fontWeight: 700, margin: "1.75rem 0 0.4rem" },
  note: { fontSize: "0.82rem", opacity: 0.72, maxWidth: "60ch", lineHeight: 1.5 },
  row: { display: "flex", gap: "0.75rem", alignItems: "flex-end", flexWrap: "wrap", marginTop: "1.25rem" },
  label: { display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.78rem" },
  input: {
    background: "#1d1a14",
    color: "#f4ead6",
    border: "1px solid #4a4133",
    borderRadius: "0.35rem",
    padding: "0.45rem 0.6rem",
    fontFamily: "inherit",
    fontSize: "0.9rem",
    minWidth: "12rem",
  },
  launch: {
    background: "#c9903f",
    color: "#12100c",
    border: 0,
    borderRadius: "0.35rem",
    padding: "0.5rem 1.2rem",
    fontWeight: 800,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  error: { color: "#ff9b8a", marginTop: "0.8rem", fontSize: "0.85rem" },
  list: { listStyle: "decimal inside", display: "grid", gap: "0.5rem", marginTop: "0.6rem" },
  listItem: { display: "flex", gap: "0.6rem", alignItems: "baseline", flexWrap: "wrap" },
  scenarioButton: {
    background: "#1d1a14",
    color: "#f4ead6",
    border: "1px solid #4a4133",
    borderRadius: "0.35rem",
    padding: "0.32rem 0.7rem",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "0.82rem",
  },
  why: { fontSize: "0.78rem", opacity: 0.66 },
  banner: {
    display: "flex",
    gap: "0.9rem",
    alignItems: "center",
    flexWrap: "wrap",
    padding: "0.45rem 0.9rem",
    background: "#2a1f10",
    color: "#f4ead6",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.76rem",
    borderBottom: "1px solid #4a4133",
  },
  bannerTitle: { letterSpacing: "0.08em", color: "#f0c274" },
  bannerItem: { opacity: 0.85 },
  bannerButton: {
    marginLeft: "auto",
    background: "transparent",
    color: "#f0c274",
    border: "1px solid #7a6338",
    borderRadius: "0.3rem",
    padding: "0.22rem 0.6rem",
    cursor: "pointer",
    fontFamily: "inherit",
    fontSize: "0.74rem",
  },
  resultLine: {
    padding: "0.4rem 0.9rem",
    background: "#1d1a14",
    color: "#f4ead6",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.76rem",
  },
};
