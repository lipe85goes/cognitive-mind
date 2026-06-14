import type { WorldKey } from "@/data/worlds";

interface WorldDioramaArtProps {
  world: WorldKey;
}

export function WorldDioramaArt({ world }: WorldDioramaArtProps) {
  return (
    <span className={`world-mini-scene world-mini-${world}`} aria-hidden>
      <span className="world-mini-light" />
      <span className="world-mini-stage-base" />
      <span className="world-mini-backdrop" />

      {world === "memory" && (
        <>
          <span className="memory-orb" />
          <span className="memory-console">
            <span className="memory-pad memory-pad-one" />
            <span className="memory-pad memory-pad-two" />
            <span className="memory-pad memory-pad-three" />
            <span className="memory-pad memory-pad-four" />
          </span>
          <span className="memory-circuit memory-circuit-one" />
          <span className="memory-circuit memory-circuit-two" />
        </>
      )}

      {world === "route" && (
        <>
          <span className="route-island" />
          <span className="route-path">
            <span />
            <span />
            <span />
            <span />
          </span>
          <span className="route-pawn" />
          <span className="route-flag" />
          <span className="route-sign" />
        </>
      )}

      {world === "commands" && (
        <>
          <span className="command-machine">
            <span className="command-screen" />
            <span className="command-lever command-lever-one" />
            <span className="command-lever command-lever-two" />
            <span className="command-button command-button-one" />
            <span className="command-button command-button-two" />
            <span className="command-button command-button-three" />
          </span>
          <span className="command-signal command-signal-one" />
          <span className="command-signal command-signal-two" />
        </>
      )}

      {world === "logic" && (
        <>
          <span className="logic-route-line" />
          <span className="logic-stone logic-stone-one">1</span>
          <span className="logic-stone logic-stone-two">2</span>
          <span className="logic-stone logic-stone-three">3</span>
          <span className="logic-crystal logic-crystal-one" />
          <span className="logic-crystal logic-crystal-two" />
        </>
      )}

      {world === "garden" && (
        <>
          <span className="garden-tray" />
          <span className="garden-pot garden-pot-one">
            <span />
          </span>
          <span className="garden-pot garden-pot-two">
            <span />
          </span>
          <span className="garden-pot garden-pot-three">
            <span />
          </span>
          <span className="garden-tool" />
          <span className="garden-sprout" />
        </>
      )}
    </span>
  );
}
