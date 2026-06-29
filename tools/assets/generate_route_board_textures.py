"""Generate stylized texture maps for the Rota Estrategica board.

The maps are intentionally small, deterministic and dependency-free. They are
not photoreal textures; they are painted board-game surfaces matching the
current concept direction: blue-gray slate tiles, warm dark wood, controlled
bronze and rich blue gems.
"""

from __future__ import annotations

import argparse
import math
import random
import struct
import zlib
from pathlib import Path


Color = tuple[int, int, int]
Image = list[list[Color]]

TEXTURE_SIZE = 512


def project_root() -> Path:
    return Path(__file__).resolve().parents[2]


def clamp(value: float, low: int = 0, high: int = 255) -> int:
    return max(low, min(high, int(round(value))))


def mix(a: Color, b: Color, t: float) -> Color:
    return (
        clamp(a[0] + (b[0] - a[0]) * t),
        clamp(a[1] + (b[1] - a[1]) * t),
        clamp(a[2] + (b[2] - a[2]) * t),
    )


def shade(color: Color, amount: float) -> Color:
    return (
        clamp(color[0] * amount),
        clamp(color[1] * amount),
        clamp(color[2] * amount),
    )


def blend(base: Color, overlay: Color, alpha: float) -> Color:
    return mix(base, overlay, max(0.0, min(1.0, alpha)))


def blank(color: Color, size: int = TEXTURE_SIZE) -> Image:
    return [[color for _ in range(size)] for _ in range(size)]


def write_png(path: Path, pixels: Image) -> None:
    height = len(pixels)
    width = len(pixels[0])
    raw_rows = []
    for row in pixels:
        raw_rows.append(b"\x00" + bytes(channel for pixel in row for channel in pixel))
    raw = b"".join(raw_rows)

    def chunk(kind: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(
        b"IHDR",
        struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0),
    )
    png += chunk(b"IDAT", zlib.compress(raw, level=9))
    png += chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def smoothstep(t: float) -> float:
    return t * t * (3 - 2 * t)


def value_noise(width: int, height: int, cell: int, seed: int) -> list[list[float]]:
    rng = random.Random(seed)
    grid_w = width // cell + 3
    grid_h = height // cell + 3
    grid = [[rng.random() for _ in range(grid_w)] for _ in range(grid_h)]
    values: list[list[float]] = []
    for y in range(height):
        gy = y / cell
        y0 = int(gy)
        fy = smoothstep(gy - y0)
        row: list[float] = []
        for x in range(width):
            gx = x / cell
            x0 = int(gx)
            fx = smoothstep(gx - x0)
            a = grid[y0][x0]
            b = grid[y0][x0 + 1]
            c = grid[y0 + 1][x0]
            d = grid[y0 + 1][x0 + 1]
            row.append((a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy)
        values.append(row)
    return values


def draw_line(
    pixels: Image,
    start: tuple[int, int],
    end: tuple[int, int],
    color: Color,
    alpha: float,
    width: int = 1,
) -> None:
    x0, y0 = start
    x1, y1 = end
    dx = abs(x1 - x0)
    dy = -abs(y1 - y0)
    sx = 1 if x0 < x1 else -1
    sy = 1 if y0 < y1 else -1
    err = dx + dy
    x, y = x0, y0
    radius = max(0, width // 2)
    while True:
        for yy in range(y - radius, y + radius + 1):
            for xx in range(x - radius, x + radius + 1):
                if 0 <= yy < len(pixels) and 0 <= xx < len(pixels[0]):
                    pixels[yy][xx] = blend(pixels[yy][xx], color, alpha)
        if x == x1 and y == y1:
            break
        e2 = 2 * err
        if e2 >= dy:
            err += dy
            x += sx
        if e2 <= dx:
            err += dx
            y += sy


def add_speckles(pixels: Image, seed: int, color: Color, count: int, alpha: float) -> None:
    rng = random.Random(seed)
    height = len(pixels)
    width = len(pixels[0])
    for _ in range(count):
        x = rng.randrange(width)
        y = rng.randrange(height)
        pixels[y][x] = blend(pixels[y][x], color, alpha * rng.uniform(0.35, 1.0))


def generate_tile_texture(seed: int, base: Color, accent: Color, path: Path) -> None:
    rng = random.Random(seed)
    size = TEXTURE_SIZE
    low_noise = value_noise(size, size, 54, seed)
    high_noise = value_noise(size, size, 17, seed + 41)
    pixels = blank(base, size)
    center = (size - 1) / 2

    for y in range(size):
        for x in range(size):
            nx = abs(x - center) / center
            ny = abs(y - center) / center
            edge = max(nx, ny)
            n = (low_noise[y][x] - 0.5) * 0.22 + (high_noise[y][x] - 0.5) * 0.08
            tint = 1.0 + n - max(0.0, edge - 0.72) * 0.22
            color = shade(base, tint)
            if (x + y + seed) % 97 == 0:
                color = blend(color, accent, 0.16)
            pixels[y][x] = color

    mark_dark = shade(base, 0.62)
    mark_light = mix(base, (150, 164, 144), 0.42)
    draw_line(pixels, (188, 268), (322, 230), mark_dark, 0.22, 3)
    draw_line(pixels, (220, 174), (284, 238), mark_dark, 0.18, 3)
    draw_line(pixels, (286, 174), (222, 238), mark_dark, 0.16, 3)
    draw_line(pixels, (86, 96), (148, 92), mark_light, 0.15, 2)
    draw_line(pixels, (92, 100), (92, 155), mark_light, 0.12, 2)
    for _ in range(12):
        sx = rng.randrange(58, 450)
        sy = rng.randrange(58, 450)
        length = rng.randrange(24, 90)
        angle = rng.uniform(-0.75, 0.75)
        ex = clamp(sx + math.cos(angle) * length, 0, size - 1)
        ey = clamp(sy + math.sin(angle) * length, 0, size - 1)
        draw_line(pixels, (sx, sy), (ex, ey), mark_dark, rng.uniform(0.04, 0.1), 1)

    add_speckles(pixels, seed + 7, shade(base, 0.5), 1200, 0.07)
    add_speckles(pixels, seed + 9, mark_light, 800, 0.05)
    write_png(path, pixels)


def generate_wood_texture(path: Path) -> None:
    size = TEXTURE_SIZE
    pixels = blank((74, 42, 20), size)
    grain = value_noise(size, size, 42, 840)
    fine = value_noise(size, size, 9, 841)
    dark = (45, 24, 12)
    warm = (111, 64, 28)
    highlight = (137, 82, 38)
    for y in range(size):
        for x in range(size):
            wave = math.sin(y * 0.08 + grain[y][x] * 5.5 + math.sin(x * 0.018) * 0.8)
            amount = 0.92 + wave * 0.08 + (fine[y][x] - 0.5) * 0.16
            color = shade((82, 47, 23), amount)
            if wave > 0.74:
                color = blend(color, highlight, 0.18)
            if wave < -0.72:
                color = blend(color, dark, 0.24)
            if x < 22 or x > size - 23 or y < 22 or y > size - 23:
                color = blend(color, warm, 0.1)
            pixels[y][x] = color

    rng = random.Random(842)
    for _ in range(65):
        y = rng.randrange(22, size - 22)
        x0 = rng.randrange(0, size // 3)
        x1 = rng.randrange(size * 2 // 3, size)
        draw_line(pixels, (x0, y), (x1, y + rng.randrange(-14, 15)), dark, 0.12, 1)
    add_speckles(pixels, 843, (24, 13, 8), 1100, 0.08)
    write_png(path, pixels)


def generate_bronze_texture(path: Path) -> None:
    size = TEXTURE_SIZE
    pixels = blank((151, 96, 39), size)
    broad = value_noise(size, size, 58, 910)
    fine = value_noise(size, size, 8, 911)
    shadow = (92, 52, 20)
    glint = (205, 144, 62)
    for y in range(size):
        for x in range(size):
            brushed = math.sin((x + y * 0.24) * 0.11) * 0.04
            amount = 0.95 + (broad[y][x] - 0.5) * 0.18 + (fine[y][x] - 0.5) * 0.08 + brushed
            color = shade((156, 99, 41), amount)
            if (x + y) % 41 == 0:
                color = blend(color, glint, 0.08)
            if y % 37 == 0:
                color = blend(color, shadow, 0.08)
            pixels[y][x] = color
    for y in range(42, size, 74):
        draw_line(pixels, (0, y), (size - 1, y + 12), shadow, 0.13, 2)
    add_speckles(pixels, 912, (232, 174, 82), 600, 0.08)
    write_png(path, pixels)


def generate_gem_texture(path: Path) -> None:
    size = 256
    pixels = blank((24, 93, 184), size)
    center = (size - 1) / 2
    for y in range(size):
        for x in range(size):
            dx = (x - center) / center
            dy = (y - center) / center
            dist = min(1.0, math.sqrt(dx * dx + dy * dy))
            angular = math.sin(math.atan2(dy, dx) * 7) * 0.12
            color = mix((8, 49, 142), (42, 141, 230), 1.0 - dist * 0.72 + angular)
            if dx < -0.25 and dy < -0.18:
                color = blend(color, (156, 220, 255), 0.45)
            pixels[y][x] = color
    write_png(path, pixels)


def generate_all(root: Path | None = None) -> list[Path]:
    root = root or project_root()
    texture_dir = root / "public" / "models" / "route" / "textures"
    outputs = [
        texture_dir / "route_tile_slate_a.png",
        texture_dir / "route_tile_slate_b.png",
        texture_dir / "route_tile_slate_c.png",
        texture_dir / "route_wood_painted.png",
        texture_dir / "route_bronze_brushed.png",
        texture_dir / "route_gem_blue.png",
    ]
    generate_tile_texture(310, (76, 101, 98), (137, 124, 83), outputs[0])
    generate_tile_texture(311, (65, 88, 85), (120, 111, 78), outputs[1])
    generate_tile_texture(312, (86, 104, 91), (142, 128, 83), outputs[2])
    generate_wood_texture(outputs[3])
    generate_bronze_texture(outputs[4])
    generate_gem_texture(outputs[5])
    return outputs


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate Rota board texture maps.")
    parser.add_argument(
        "--root",
        default=str(project_root()),
        help="Repository root. Defaults to the root inferred from this script.",
    )
    args = parser.parse_args()
    outputs = generate_all(Path(args.root).resolve())
    for output in outputs:
        print(f"Wrote {output}")


if __name__ == "__main__":
    main()
