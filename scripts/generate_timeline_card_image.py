from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageOps


CANVAS = (900, 506)
HALF_WIDTH = CANVAS[0] // 2


def photo_fill(
    image: Image.Image,
    size: tuple[int, int],
    centering: tuple[float, float],
    mirror: bool = False,
) -> Image.Image:
    image = image.convert("RGB")
    if mirror:
        image = ImageOps.mirror(image)
    image = ImageOps.grayscale(image)
    image = ImageOps.autocontrast(image, cutoff=1)
    image = ImageOps.colorize(image, black="#171715", white="#eee9df", mid="#827d72")
    return ImageOps.fit(image, size, method=Image.Resampling.LANCZOS, centering=centering)


def make_card(glauert_path: Path, prandtl_path: Path, output_path: Path) -> None:
    left = photo_fill(Image.open(glauert_path), (HALF_WIDTH, CANVAS[1]), centering=(0.55, 0.43))
    right = photo_fill(Image.open(prandtl_path), (CANVAS[0] - HALF_WIDTH, CANVAS[1]), centering=(0.54, 0.36), mirror=True)

    canvas = Image.new("RGB", CANVAS, "#f6f8fb")
    canvas.paste(left, (0, 0))
    canvas.paste(right, (HALF_WIDTH, 0))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path, quality=94)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--glauert", default=Path("assets/img/home-timeline-glauert.png"), type=Path)
    parser.add_argument("--prandtl", default=Path("assets/img/home-timeline-prandtl.jpg"), type=Path)
    parser.add_argument("--output", default=Path("assets/img/home-aerodynamics-timeline.png"), type=Path)
    args = parser.parse_args()
    make_card(args.glauert, args.prandtl, args.output)


if __name__ == "__main__":
    main()
