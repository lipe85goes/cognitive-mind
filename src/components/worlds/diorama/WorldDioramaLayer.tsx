import Image from "next/image";
import type { CSSProperties } from "react";
import type { WorldDioramaLayerConfig } from "./worldDioramaLayout";

interface WorldDioramaLayerProps {
  layer: WorldDioramaLayerConfig;
  sizes: string;
}

export function WorldDioramaLayer({
  layer,
  sizes,
}: WorldDioramaLayerProps) {
  const style = {
    "--wd-depth": layer.depth,
    "--wd-x": `${layer.x ?? 0}px`,
    "--wd-y": `${layer.y ?? 0}px`,
    "--wd-scale": layer.scale ?? 1,
    "--wd-opacity": layer.opacity ?? 1,
  } as CSSProperties;

  return (
    <span
      className={["wd-layer", layer.className ?? ""].join(" ")}
      data-layer={layer.id}
      style={style}
      aria-hidden="true"
    >
      <Image
        src={layer.src}
        alt={layer.alt}
        fill
        sizes={sizes}
        loading={layer.priority ? "eager" : "lazy"}
        className="wd-layer-image"
        draggable={false}
      />
    </span>
  );
}
