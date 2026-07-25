from __future__ import annotations

import math
import re
from bisect import bisect_left
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SOURCE_HTML = ROOT / "source" / "geometric_decomposition_tool.html"
OUTPUT = ROOT / "assets" / "img" / "home-geometric-decomposition.gif"

WIDTH = 900
HEIGHT = 506
SCALE = 2
BG = (255, 255, 255)
POINT = (2, 132, 199)
SURFACE = (15, 23, 42)
GUESS = (180, 83, 9)
FINAL = (14, 116, 144)
NORMAL = (2, 132, 199)
TANGENT = (100, 116, 139)
ERROR = (244, 63, 94)


def ease(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3 - 2 * value)


def rgba(color: tuple[int, int, int], alpha: float):
    return (*color, int(max(0, min(255, alpha))))


def parse_wortmann_points() -> list[tuple[float, float]]:
    html = SOURCE_HTML.read_text(encoding="utf-8")
    match = re.search(r"const FX63137_SAMPLE_DATA = `(?P<data>.*?)`;", html, re.S)
    if not match:
        raise RuntimeError("Could not locate FX63137_SAMPLE_DATA in source/geometric_decomposition_tool.html")

    points: list[tuple[float, float]] = []
    for line in match.group("data").splitlines():
        parts = line.strip().split()
        if len(parts) != 2:
            continue
        try:
            points.append((float(parts[0]), float(parts[1])))
        except ValueError:
            continue
    if len(points) < 8:
        raise RuntimeError("Wortmann FX 63-137 coordinate set is unexpectedly small.")
    return points


def split_surface(points: list[tuple[float, float]]):
    le_index = min(range(len(points)), key=lambda idx: points[idx][0])
    upper = sorted(points[: le_index + 1], key=lambda item: item[0])
    lower = sorted(points[le_index:], key=lambda item: item[0])
    return upper, lower


def interpolate(points: list[tuple[float, float]], x: float) -> float:
    xs = [point[0] for point in points]
    idx = bisect_left(xs, x)
    if idx <= 0:
        return points[0][1]
    if idx >= len(points):
        return points[-1][1]
    x0, y0 = points[idx - 1]
    x1, y1 = points[idx]
    if abs(x1 - x0) < 1e-12:
        return y0
    weight = (x - x0) / (x1 - x0)
    return y0 + (y1 - y0) * weight


def camber_distribution(upper, lower, count=150):
    xs = [(1 - math.cos(math.pi * idx / (count - 1))) / 2 for idx in range(count)]
    camber = []
    for x in xs:
        yu = interpolate(upper, x)
        yl = interpolate(lower, x)
        camber.append((x, 0.5 * (yu + yl)))
    return camber


def candidate_offset(x: float) -> float:
    envelope = math.sin(math.pi * x) ** 0.7
    return envelope * (
        0.030 * math.sin(1.3 * math.pi * x + 0.5)
        - 0.019 * math.sin(2.7 * math.pi * x + 1.1)
        + 0.010 * math.sin(4.4 * math.pi * x)
    )


def candidate_camber(actual: list[tuple[float, float]], progress: float, frame: int):
    # A deliberately imperfect starting camber relaxes into the true midline.
    decay = 1 - ease(progress)
    swing = math.sin(frame * 0.24) * decay * 0.010
    result = []
    for x, y in actual:
        oscillation = swing * math.sin(2.6 * math.pi * x + 0.3) * math.sin(math.pi * x)
        result.append((x, y + decay * candidate_offset(x) + oscillation))
    return result


def catmull_rom(points, samples_per_segment=8):
    if len(points) < 4:
        return points
    padded = [points[0], *points, points[-1]]
    result = []
    for idx in range(1, len(padded) - 2):
        p0, p1, p2, p3 = padded[idx - 1], padded[idx], padded[idx + 1], padded[idx + 2]
        for step in range(samples_per_segment):
            u = step / samples_per_segment
            u2 = u * u
            u3 = u2 * u
            x = 0.5 * (
                2 * p1[0]
                + (-p0[0] + p2[0]) * u
                + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2
                + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3
            )
            y = 0.5 * (
                2 * p1[1]
                + (-p0[1] + p2[1]) * u
                + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2
                + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3
            )
            result.append((x, y))
    result.append(points[-1])
    return result


def draw_polyline(draw, points, fill, width=1):
    if len(points) >= 2:
        draw.line(points, fill=fill, width=width, joint="curve")


def draw_partial_polyline(draw, points, progress, fill, width=1):
    if len(points) < 2:
        return
    count = max(2, int(2 + ease(progress) * (len(points) - 2)))
    draw_polyline(draw, points[:count], fill, width)


def distance_weighted_width(distance: float) -> float:
    normalized = max(0.0, min(1.0, distance / 0.085))
    return (0.8 + 7.0 * (1 - normalized) ** 1.75) * SCALE


def make_equal_axis_projector(x_range, y_range, bounds=(54, 54, 846, 430)):
    left, top, right, bottom = [value * SCALE for value in bounds]
    xmin, xmax = x_range
    ymin, ymax = y_range
    scale = min((right - left) / (xmax - xmin), (bottom - top) / (ymax - ymin))
    cx_plot = 0.5 * (left + right)
    cy_plot = 0.5 * (top + bottom)
    cx_data = 0.5 * (xmin + xmax)
    cy_data = 0.5 * (ymin + ymax)

    def project(point: tuple[float, float]):
        x, y = point
        px = cx_plot + (x - cx_data) * scale
        py = cy_plot - (y - cy_data) * scale
        return (px, py)

    return project


def tangent_normal_from_slope(slope: float, upward: bool):
    tangent_length = math.hypot(1.0, slope)
    tangent = (1.0 / tangent_length, slope / tangent_length)
    nx, ny = -slope, 1.0
    normal_length = math.hypot(nx, ny)
    normal = (nx / normal_length, ny / normal_length)
    if upward and normal[1] < 0:
        normal = (-normal[0], -normal[1])
    if not upward and normal[1] > 0:
        normal = (-normal[0], -normal[1])
    return tangent, normal


def normal_intersection(x0, y0, slope, surface, upward=True):
    _, (nx, ny) = tangent_normal_from_slope(slope, upward)

    def value(distance):
        x = x0 + nx * distance
        if x < 0.0 or x > 1.0:
            return None
        y = y0 + ny * distance
        return y - interpolate(surface, x), x, y

    start = value(0.0)
    if start is None:
        y_surface = interpolate(surface, x0)
        return (x0, y_surface), abs(y0 - y_surface), False

    f0, _, _ = start
    previous_distance = 0.0
    previous_value = f0
    best_distance = 0.0
    best_abs = abs(f0)
    best_point = (x0, y0)

    step = 0.006
    distance = step
    while distance <= 0.34:
        current = value(distance)
        if current is None:
            break
        f1, x1, y1 = current
        if abs(f1) < best_abs:
            best_abs = abs(f1)
            best_distance = distance
            best_point = (x1, y1)
        if previous_value == 0 or previous_value * f1 <= 0:
            low = previous_distance
            high = distance
            flow = previous_value
            for _ in range(28):
                mid = 0.5 * (low + high)
                mid_value = value(mid)
                if mid_value is None:
                    high = mid
                    continue
                fm, _, _ = mid_value
                if flow * fm <= 0:
                    high = mid
                else:
                    low = mid
                    flow = fm
            _, xr, yr = value(high)
            return (xr, yr), high, True
        previous_distance = distance
        previous_value = f1
        distance += step

    # This fallback should be rare; it keeps the visual finite if a deliberately
    # bad camber guess misses a surface near the trailing edge.
    return best_point, best_distance, False


def local_slope(curve, x):
    dx = 0.006
    y0 = interpolate(curve, max(0.0, x - dx))
    y1 = interpolate(curve, min(1.0, x + dx))
    return (y1 - y0) / (2 * dx)


def main():
    surface_points = parse_wortmann_points()
    upper, lower = split_surface(surface_points)
    actual = camber_distribution(upper, lower)
    initial = candidate_camber(actual, 0.0, 0)

    all_y = [point[1] for point in surface_points] + [point[1] for point in initial]
    y_mid = 0.5 * (max(all_y) + min(all_y))
    y_half = max(max(all_y) - y_mid, y_mid - min(all_y)) * 1.26
    project = make_equal_axis_projector((-0.015, 1.015), (y_mid - y_half, y_mid + y_half))

    surface_projected = [project(point) for point in surface_points]
    surface_fit = catmull_rom(surface_projected, samples_per_segment=7)
    point_projected = [project(point) for point in surface_points[::2]]
    control_xs = [0.17, 0.36, 0.55, 0.72]

    frames = []
    durations = []
    total = 126

    for frame in range(total):
        image = Image.new("RGB", (WIDTH * SCALE, HEIGHT * SCALE), BG)
        draw = ImageDraw.Draw(image, "RGBA")

        points_in = ease((frame + 8) / 18)
        fit_in = ease((frame - 10) / 28)
        guess_in = ease((frame - 38) / 20)
        probe_in = ease((frame - 50) / 18)
        fit_progress = ease((frame - 66) / 46)
        final_in = ease((frame - 101) / 16)

        visible_points = int(points_in * len(point_projected))
        point_alpha = 220 - 70 * fit_progress
        for idx, point in enumerate(point_projected[:visible_points]):
            pulse = 0.75 + 0.25 * math.sin(frame * 0.18 + idx * 0.58)
            radius = int((3.0 + pulse * 0.7) * SCALE)
            draw.ellipse(
                [point[0] - radius, point[1] - radius, point[0] + radius, point[1] + radius],
                fill=rgba(POINT, point_alpha),
            )

        if fit_in > 0:
            surface_alpha = 235 - 95 * fit_progress
            draw_partial_polyline(draw, surface_fit, fit_in, rgba(SURFACE, surface_alpha), width=5 * SCALE)
            draw_partial_polyline(draw, surface_fit, fit_in, rgba((255, 255, 255), min(120, surface_alpha)), width=2 * SCALE)

        candidate = candidate_camber(actual, fit_progress, frame)
        candidate_curve = catmull_rom([project(point) for point in candidate], samples_per_segment=5)
        actual_curve = catmull_rom([project(point) for point in actual], samples_per_segment=5)

        if guess_in > 0:
            draw_partial_polyline(draw, candidate_curve, guess_in, rgba(GUESS, 235), width=4 * SCALE)

        if probe_in > 0:
            for idx, x in enumerate(control_xs):
                local = ease(probe_in * len(control_xs) - idx)
                if local <= 0:
                    continue

                y = interpolate(candidate, x)
                slope = local_slope(candidate, x)
                center = project((x, y))
                tangent, _ = tangent_normal_from_slope(slope, upward=True)
                tangent_span = 0.075
                tangent_a = project((x - tangent[0] * tangent_span, y - tangent[1] * tangent_span))
                tangent_b = project((x + tangent[0] * tangent_span, y + tangent[1] * tangent_span))
                upper_hit, upper_distance, upper_exact = normal_intersection(x, y, slope, upper, upward=True)
                lower_hit, lower_distance, lower_exact = normal_intersection(x, y, slope, lower, upward=False)
                upper_p = project(upper_hit)
                lower_p = project(lower_hit)

                upper_width = distance_weighted_width(upper_distance)
                lower_width = distance_weighted_width(lower_distance)
                tangent_width = max(1.0, min(upper_width, lower_width) * 0.46)
                alpha = 210 * local * (1 - 0.34 * final_in)
                error_alpha = 180 * local * (1 - fit_progress)
                if not (upper_exact and lower_exact):
                    alpha *= 0.42

                draw.line([tangent_a, tangent_b], fill=rgba(TANGENT, alpha), width=int(tangent_width))
                draw.line([center, upper_p], fill=rgba(NORMAL, alpha), width=int(upper_width))
                draw.line([center, lower_p], fill=rgba(NORMAL, alpha), width=int(lower_width))

                radius = int((4.3 + 0.7 * local) * SCALE)
                draw.ellipse(
                    [center[0] - radius, center[1] - radius, center[0] + radius, center[1] + radius],
                    fill=rgba(ERROR, 210 * local),
                )

                if error_alpha > 4:
                    gap = abs(upper_distance - lower_distance)
                    er = max(2.0, min(9.0, gap * 95)) * SCALE
                    draw.ellipse(
                        [center[0] - er, center[1] - er, center[0] + er, center[1] + er],
                        outline=rgba(ERROR, error_alpha),
                        width=max(1, int(1.5 * SCALE)),
                    )

        if final_in > 0:
            draw_polyline(draw, actual_curve, rgba(FINAL, 220 * final_in), width=4 * SCALE)

        resized = image.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)
        frames.append(resized.convert("P", palette=Image.Palette.ADAPTIVE, colors=80))
        durations.append(44)

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        OUTPUT,
        save_all=True,
        append_images=frames[1:],
        duration=durations,
        loop=0,
        optimize=False,
        disposal=2,
    )
    print(OUTPUT)


if __name__ == "__main__":
    main()
