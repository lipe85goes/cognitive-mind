"use client";

import Image from "next/image";
import { useState } from "react";
import { WorldDioramaArt } from "@/components/WorldDioramaArt";
import type { WorldKey } from "@/data/worlds";

interface WorldDioramaFrameProps {
  world: WorldKey;
  imageSrc: string;
}

/**
 * Production Home art pipeline:
 * 1. Prefer final rendered 2.5D / 3D-style WebP assets.
 * 2. If an asset is not present yet, keep the existing CSS diorama as fallback.
 */
export function WorldDioramaFrame({
  world,
  imageSrc,
}: WorldDioramaFrameProps) {
  const [imageAvailable, setImageAvailable] = useState(Boolean(imageSrc));

  return (
    <span
      className={`world-rendered-frame ${
        imageAvailable ? "has-rendered-art" : "is-fallback"
      }`}
      data-world={world}
      aria-hidden
    >
      <span className="world-rendered-inner">
        {imageAvailable ? (
          <Image
            src={imageSrc}
            alt=""
            fill
            sizes="(max-width: 767px) 84vw, 18rem"
            className="world-rendered-image"
            onError={() => setImageAvailable(false)}
          />
        ) : (
          <WorldDioramaArt world={world} />
        )}
      </span>
    </span>
  );
}
