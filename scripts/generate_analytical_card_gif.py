from __future__ import annotations

import math
from bisect import bisect_left
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "img" / "home-analytical-aerodynamics.gif"
AIRCRAFT_ART = ROOT / "assets" / "img" / "home-analytical-aircraft-art.png"

WIDTH = 900
HEIGHT = 506
SCALE = 3
HINGE_X = 0.68
TOTAL_WINGBOXES = 6
FIXED_WINGBOXES = 3
OUTBOARD_START = FIXED_WINGBOXES / TOTAL_WINGBOXES
AILERON_SPAN_GAP = 0.018
ROOT_TIP_CHORD_RATIO = 1.6
RIB_STATIONS = tuple(idx / TOTAL_WINGBOXES for idx in range(TOTAL_WINGBOXES + 1))

TURQUOISE = (26, 188, 156)
PETER_RIVER = (52, 152, 219)
WET_ASPHALT = (52, 73, 94)
CLOUDS = (236, 240, 241)
SILVER = (189, 195, 199)
CONCRETE = (149, 165, 166)
ORANGE = (243, 156, 18)
PUMPKIN = (230, 126, 34)
BLACK = (0, 0, 0)
RED2 = (238, 0, 0)
DODGER_BLUE = (30, 144, 255)
DODGER_BLUE_DARK = (13, 93, 166)
DODGER_BLUE_PALE = (229, 243, 255)
RED2_PALE = (255, 229, 229)
SECTION_GRAY = (221, 226, 232)

BG = (255, 255, 255)
SURFACE = BLACK
FILL = SECTION_GRAY
FLAP = RED2
TEAL = DODGER_BLUE
MESH = BLACK
SHADOW = WET_ASPHALT
AIRCRAFT_ART_CACHE: Image.Image | None = None

LAYOUT_CENTER = (450.0, 244.0)
LAYOUT_RADIUS = 205.0
CYCLE_ARROW_RADIUS = 202.0
AIRFOIL_SIZE = (305.0, 190.0)
AIRCRAFT_SIZE = (325.0, 217.0)
AIRCRAFT_SELECTED_WING = (
    (0.50, 0.68),
    (0.66, 0.76),
    (0.73, 0.87),
    (0.56, 0.80),
)


def circle_anchor(degrees: float) -> tuple[float, float]:
    angle = math.radians(degrees)
    return (
        LAYOUT_CENTER[0] + LAYOUT_RADIUS * math.cos(angle),
        LAYOUT_CENTER[1] - LAYOUT_RADIUS * math.sin(angle),
    )


AIRFOIL_CENTER = circle_anchor(30)
WING_CENTER = circle_anchor(150)
AIRCRAFT_CENTER = (450.0, 380.0)


def ease(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3 - 2 * value)


def rgba(color: tuple[int, int, int], alpha: float) -> tuple[int, int, int, int]:
    return (*color, int(max(0, min(255, alpha))))


def scaled_box(values: tuple[float, float, float, float]) -> tuple[int, int, int, int]:
    return tuple(round(value * SCALE) for value in values)


def naca_2412_surfaces(count: int = 150) -> tuple[list[tuple[float, float]], list[tuple[float, float]]]:
    m = 0.02
    p = 0.4
    thickness = 0.12
    xs = cosine_xs(count)
    upper = []
    lower = []
    for x in xs:
        if x < p:
            camber = m / (p * p) * (2 * p * x - x * x)
            slope = 2 * m / (p * p) * (p - x)
        else:
            camber = m / ((1 - p) * (1 - p)) * ((1 - 2 * p) + 2 * p * x - x * x)
            slope = 2 * m / ((1 - p) * (1 - p)) * (p - x)
        theta = math.atan(slope)
        yt = 5 * thickness * (
            0.2969 * math.sqrt(max(x, 0.0))
            - 0.1260 * x
            - 0.3516 * x * x
            + 0.2843 * x * x * x
            - 0.1036 * x * x * x * x
        )
        upper.append((x - yt * math.sin(theta), camber + yt * math.cos(theta)))
        lower.append((x + yt * math.sin(theta), camber - yt * math.cos(theta)))
    upper.sort(key=lambda item: item[0])
    lower.sort(key=lambda item: item[0])
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


def cosine_xs(count: int = 120) -> list[float]:
    return [(1 - math.cos(math.pi * idx / (count - 1))) / 2 for idx in range(count)]


def catmull_rom(points: list[tuple[float, float]], samples_per_segment: int = 6) -> list[tuple[float, float]]:
    if len(points) < 4:
        return points
    padded = [points[0], *points, points[-1]]
    result: list[tuple[float, float]] = []
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


def rotate_aft(x: float, y: float, surface: list[tuple[float, float]], theta: float) -> tuple[float, float]:
    if x <= HINGE_X:
        return x, y
    local = ease(min(1.0, (x - HINGE_X) / 0.09))
    angle = theta * local
    hinge_y = interpolate(surface, HINGE_X)
    dx = x - HINGE_X
    dy = y - hinge_y
    ca = math.cos(angle)
    sa = math.sin(angle)
    return HINGE_X + dx * ca - dy * sa, hinge_y + dx * sa + dy * ca


def sampled_surfaces(
    upper: list[tuple[float, float]],
    lower: list[tuple[float, float]],
    theta: float,
    count: int = 118,
) -> tuple[list[tuple[float, float]], list[tuple[float, float]]]:
    xs = cosine_xs(count)
    upper_points = [rotate_aft(x, interpolate(upper, x), upper, theta) for x in xs]
    lower_points = [rotate_aft(x, interpolate(lower, x), lower, theta) for x in xs]
    return upper_points, lower_points


def closed_surface(upper_points: list[tuple[float, float]], lower_points: list[tuple[float, float]]):
    return upper_points + list(reversed(lower_points))


def make_projector(bounds: tuple[int, int, int, int], x_range, y_range):
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
        return (cx_plot + (x - cx_data) * scale, cy_plot - (y - cy_data) * scale)

    return project


def centered_bounds(center: tuple[float, float], size: tuple[float, float]) -> tuple[int, int, int, int]:
    half_width = 0.5 * size[0]
    half_height = 0.5 * size[1]
    return (
        round(center[0] - half_width),
        round(center[1] - half_height),
        round(center[0] + half_width),
        round(center[1] + half_height),
    )


def draw_polyline(draw: ImageDraw.ImageDraw, points, fill, width=1):
    if len(points) >= 2:
        draw.line(points, fill=fill, width=width, joint="curve")


def orbit_points(start_degrees: float, end_degrees: float, radius: float, steps: int = 48):
    points = []
    for idx in range(steps + 1):
        weight = idx / steps
        angle = math.radians(start_degrees + (end_degrees - start_degrees) * weight)
        points.append(
            (
                (LAYOUT_CENTER[0] + radius * math.cos(angle)) * SCALE,
                (LAYOUT_CENTER[1] - radius * math.sin(angle)) * SCALE,
            )
        )
    return points


def draw_arc_arrow(
    draw: ImageDraw.ImageDraw,
    start_degrees: float,
    end_degrees: float,
    color: tuple[int, int, int],
    radius: float = 113,
    width: float = 9,
):
    head = 19 * SCALE
    half_width = 11 * SCALE
    trim_degrees = math.degrees((head * 0.58) / (radius * SCALE))
    body_end = max(start_degrees, end_degrees - trim_degrees)
    points = orbit_points(start_degrees, body_end, radius, steps=52)
    scaled_width = round(width * SCALE)

    start = points[0]
    cap_radius = scaled_width / 2
    draw.ellipse((start[0] - cap_radius, start[1] - cap_radius, start[0] + cap_radius, start[1] + cap_radius), fill=rgba(color, 225))
    draw.line(points, fill=rgba(color, 225), width=scaled_width, joint="curve")

    end_angle = math.radians(end_degrees)
    tip = (
        (LAYOUT_CENTER[0] + radius * math.cos(end_angle)) * SCALE,
        (LAYOUT_CENTER[1] - radius * math.sin(end_angle)) * SCALE,
    )
    tx = -math.sin(end_angle)
    ty = -math.cos(end_angle)
    normal_x = -ty
    normal_y = tx
    back_x = tip[0] - head * tx
    back_y = tip[1] - head * ty
    draw.polygon(
        [
            tip,
            (back_x + half_width * normal_x, back_y + half_width * normal_y),
            (back_x - half_width * normal_x, back_y - half_width * normal_y),
        ],
        fill=rgba(color, 235),
    )


def draw_cycle_arrows(draw: ImageDraw.ImageDraw):
    draw_arc_arrow(draw, 48, 104, BLACK, radius=CYCLE_ARROW_RADIUS, width=7)
    draw_arc_arrow(draw, 176, 224, BLACK, radius=CYCLE_ARROW_RADIUS, width=7)
    draw_arc_arrow(draw, 314, 376, BLACK, radius=CYCLE_ARROW_RADIUS, width=7)


def draw_time_icon(draw: ImageDraw.ImageDraw):
    cx, cy = LAYOUT_CENTER
    clock_center = (cx - 18, cy + 2)
    radius = 32
    stroke = 4 * SCALE
    clock_box = scaled_box(
        (
            clock_center[0] - radius,
            clock_center[1] - radius,
            clock_center[0] + radius,
            clock_center[1] + radius,
        )
    )
    draw.ellipse(clock_box, outline=rgba(BLACK, 238), width=stroke)

    hand_origin = (clock_center[0] * SCALE, clock_center[1] * SCALE)
    minute_hand = (clock_center[0] * SCALE, (clock_center[1] - 21) * SCALE)
    hour_hand = ((clock_center[0] + 16) * SCALE, (clock_center[1] + 13) * SCALE)
    draw.line((hand_origin, minute_hand), fill=rgba(BLACK, 238), width=4 * SCALE)
    draw.line((hand_origin, hour_hand), fill=rgba(BLACK, 238), width=4 * SCALE)
    draw.ellipse((hand_origin[0] - 4 * SCALE, hand_origin[1] - 4 * SCALE, hand_origin[0] + 4 * SCALE, hand_origin[1] + 4 * SCALE), fill=rgba(BLACK, 245))

    for degrees in range(0, 360, 30):
        angle = math.radians(degrees)
        tick = 8 if degrees % 90 == 0 else 5
        inner = (
            (clock_center[0] + (radius - tick) * math.cos(angle)) * SCALE,
            (clock_center[1] - (radius - tick) * math.sin(angle)) * SCALE,
        )
        outer = (
            (clock_center[0] + (radius - 3) * math.cos(angle)) * SCALE,
            (clock_center[1] - (radius - 3) * math.sin(angle)) * SCALE,
        )
        draw.line((inner, outer), fill=rgba(BLACK, 218), width=(3 if degrees % 90 == 0 else 2) * SCALE)

    arrow_x = cx + 32
    arrow_top = cy - 27
    arrow_bottom = cy + 35
    arrow_outline = [
        ((arrow_x - 9) * SCALE, arrow_top * SCALE),
        ((arrow_x + 9) * SCALE, arrow_top * SCALE),
        ((arrow_x + 9) * SCALE, (arrow_bottom - 16) * SCALE),
        ((arrow_x + 22) * SCALE, (arrow_bottom - 16) * SCALE),
        (arrow_x * SCALE, arrow_bottom * SCALE),
        ((arrow_x - 22) * SCALE, (arrow_bottom - 16) * SCALE),
        ((arrow_x - 9) * SCALE, (arrow_bottom - 16) * SCALE),
        ((arrow_x - 9) * SCALE, arrow_top * SCALE),
    ]
    draw.line(arrow_outline, fill=rgba(BLACK, 238), width=4 * SCALE, joint="curve")


def outboard_weight(z: float) -> float:
    return ease((z - OUTBOARD_START) / (1 - OUTBOARD_START))


def draw_left_airfoil(draw: ImageDraw.ImageDraw, upper, lower, theta: float):
    max_theta = math.radians(15)
    envelope = []
    for test_theta in (-max_theta, max_theta):
        u, l = sampled_surfaces(upper, lower, test_theta)
        envelope.extend(closed_surface(u, l))
    ys = [point[1] for point in envelope]
    y_mid = 0.5 * (max(ys) + min(ys))
    y_half = max(max(ys) - y_mid, y_mid - min(ys)) * 1.18
    project = make_projector(centered_bounds(AIRFOIL_CENTER, AIRFOIL_SIZE), (-0.04, 1.04), (y_mid - y_half, y_mid + y_half))

    u, l = sampled_surfaces(upper, lower, theta)
    path = catmull_rom([project(point) for point in closed_surface(u, l)], samples_per_segment=5)
    flap_upper = catmull_rom([project(point) for point in u if point[0] >= HINGE_X - 0.002], samples_per_segment=5)
    flap_lower = catmull_rom([project(point) for point in l if point[0] >= HINGE_X - 0.002], samples_per_segment=5)

    draw.polygon(path, fill=rgba(FILL, 214), outline=rgba(SURFACE, 190))
    draw_polyline(draw, path + [path[0]], rgba(SURFACE, 235), width=2 * SCALE)
    draw_polyline(draw, flap_upper, rgba(FLAP, 245), width=5 * SCALE)
    draw_polyline(draw, flap_lower, rgba(FLAP, 245), width=5 * SCALE)

    hinge_upper = project((HINGE_X, interpolate(upper, HINGE_X)))
    hinge_lower = project((HINGE_X, interpolate(lower, HINGE_X)))
    draw.line([hinge_upper, hinge_lower], fill=rgba(SURFACE, 185), width=1 * SCALE)
    for point in (hinge_upper, hinge_lower):
        radius = 3 * SCALE
        draw.ellipse((point[0] - radius, point[1] - radius, point[0] + radius, point[1] + radius), fill=rgba(TEAL, 215))


def project_wing(x: float, y: float, z: float) -> tuple[float, float]:
    root_chord = 182
    tip_chord = root_chord / ROOT_TIP_CHORD_RATIO
    chord = (root_chord + (tip_chord - root_chord) * z) * SCALE
    thickness = chord * 1.58
    origin_x = (WING_CENTER[0] - 148) * SCALE
    origin_y = (WING_CENTER[1] + 64) * SCALE
    span_x = 168 * SCALE
    span_y = -128 * SCALE
    sweep_x = 8 * z * SCALE
    return origin_x + span_x * z + sweep_x + x * chord, origin_y + span_y * z - y * thickness


def sample_x_range(x_min: float, x_max: float, count: int = 70) -> list[float]:
    if count <= 1:
        return [x_min, x_max]
    return [x_min + (x_max - x_min) * value for value in cosine_xs(count)]


def section_at_z(
    upper: list[tuple[float, float]],
    lower: list[tuple[float, float]],
    theta: float,
    z: float,
    x_min: float = 0.0,
    x_max: float = 1.0,
    count: int = 80,
) -> tuple[list[tuple[float, float]], list[tuple[float, float]]]:
    xs = sample_x_range(x_min, x_max, count)
    u = [rotate_aft(x, interpolate(upper, x), upper, theta) for x in xs]
    l = [rotate_aft(x, interpolate(lower, x), lower, theta) for x in xs]
    return [(x, y, z) for x, y in u], [(x, y, z) for x, y in l]


def wing_projected_surface(surface: list[tuple[float, float, float]]):
    return [project_wing(x, y, z) for x, y, z in surface]


def span_panel_polygon(
    upper: list[tuple[float, float]],
    lower: list[tuple[float, float]],
    z0: float,
    z1: float,
    theta0: float,
    theta1: float,
    x_min: float,
    x_max: float,
    count: int = 72,
):
    u0, _ = section_at_z(upper, lower, theta0, z0, x_min, x_max, count=count)
    u1, _ = section_at_z(upper, lower, theta1, z1, x_min, x_max, count=count)
    return wing_projected_surface(u0) + list(reversed(wing_projected_surface(u1)))


def draw_span_panel(
    draw: ImageDraw.ImageDraw,
    upper: list[tuple[float, float]],
    lower: list[tuple[float, float]],
    z0: float,
    z1: float,
    theta0: float,
    theta1: float,
    x_min: float,
    x_max: float,
    color: tuple[int, int, int],
    alpha: float,
    count: int = 72,
):
    draw.polygon(span_panel_polygon(upper, lower, z0, z1, theta0, theta1, x_min, x_max, count=count), fill=rgba(color, alpha))


def draw_leading_edge_wrap(
    draw: ImageDraw.ImageDraw,
    upper: list[tuple[float, float]],
    lower: list[tuple[float, float]],
    z0: float,
    z1: float,
    color: tuple[int, int, int],
    alpha: float,
    x_cap: float = 0.115,
):
    u0, l0 = section_at_z(upper, lower, 0.0, z0, 0.0, x_cap, count=34)
    u1, l1 = section_at_z(upper, lower, 0.0, z1, 0.0, x_cap, count=34)
    cap = (
        wing_projected_surface(u0)
        + list(reversed(wing_projected_surface(u1)))
        + wing_projected_surface(l1)
        + list(reversed(wing_projected_surface(l0)))
    )
    draw.polygon(cap, fill=rgba(color, alpha))


def draw_span_panel_outline(
    draw: ImageDraw.ImageDraw,
    upper: list[tuple[float, float]],
    lower: list[tuple[float, float]],
    z0: float,
    z1: float,
    theta0: float,
    theta1: float,
    x_min: float,
    x_max: float,
    color: tuple[int, int, int],
    alpha: float,
    width: int,
    count: int = 72,
):
    outline = span_panel_polygon(upper, lower, z0, z1, theta0, theta1, x_min, x_max, count=count)
    draw_polyline(draw, outline + [outline[0]], rgba(color, alpha), width=width)


def draw_wing_section(
    draw: ImageDraw.ImageDraw,
    upper: list[tuple[float, float]],
    lower: list[tuple[float, float]],
    z: float,
    theta: float,
    x_min: float = 0.0,
    x_max: float = 1.0,
    fill=rgba(SURFACE, 150),
    width: int = 1,
):
    zu, _ = section_at_z(upper, lower, theta, z, x_min, x_max, count=76)
    section = wing_projected_surface(zu)
    draw_polyline(draw, section, fill, width=width)


def draw_wing_body_section(
    draw: ImageDraw.ImageDraw,
    upper: list[tuple[float, float]],
    lower: list[tuple[float, float]],
    z: float,
    theta: float,
    x_min: float = 0.0,
    x_max: float = 1.0,
    fill=rgba(SURFACE, 150),
    width: int = 1,
):
    zu, zl = section_at_z(upper, lower, theta, z, x_min, x_max, count=76)
    section = wing_projected_surface(zu + list(reversed(zl)))
    draw.polygon(section, fill=rgba(SECTION_GRAY, 226))
    draw_polyline(draw, section + [section[0]], fill, width=width)


def draw_chordwise_span_line(
    draw: ImageDraw.ImageDraw,
    upper: list[tuple[float, float]],
    lower: list[tuple[float, float]],
    x: float,
    z_values: tuple[float, ...],
    theta: float,
    fill,
    width: int,
):
    upper_line = []
    for z in z_values:
        xu, yu = rotate_aft(x, interpolate(upper, x), upper, theta)
        upper_line.append(project_wing(xu, yu, z))
    draw_polyline(draw, upper_line, fill, width=width)


def draw_leading_edge_surface_line(
    draw: ImageDraw.ImageDraw,
    upper: list[tuple[float, float]],
    z_values: tuple[float, ...],
    fill,
    width: int,
):
    nose_surface_x = 0.028
    points = []
    for z in z_values:
        points.append(project_wing(nose_surface_x, interpolate(upper, nose_surface_x), z))
    draw_polyline(draw, points, fill, width=width)


def draw_wing(draw: ImageDraw.ImageDraw, upper, lower, theta: float):
    wing_surface = SECTION_GRAY
    active_surface = RED2
    moving_start = OUTBOARD_START + AILERON_SPAN_GAP

    draw_leading_edge_wrap(draw, upper, lower, 0.0, 1.0, wing_surface, 255)
    draw_span_panel(draw, upper, lower, 0.0, 1.0, 0.0, 0.0, 0.0, HINGE_X, wing_surface, 255, count=92)
    draw_span_panel(draw, upper, lower, 0.0, moving_start, 0.0, 0.0, HINGE_X, 1.0, wing_surface, 255, count=72)
    draw_span_panel(draw, upper, lower, moving_start, 1.0, theta, theta, HINGE_X, 1.0, active_surface, 66, count=66)

    frame = rgba(SURFACE, 210)
    draw_wing_body_section(draw, upper, lower, 0.0, 0.0, 0.0, 1.0, fill=frame, width=3 * SCALE)
    draw_wing_section(draw, upper, lower, 1.0, 0.0, 0.0, HINGE_X, fill=frame, width=2 * SCALE)

    draw_leading_edge_surface_line(draw, upper, tuple(idx / 40 for idx in range(41)), frame, width=2 * SCALE)
    draw_chordwise_span_line(draw, upper, lower, 1.0, (0.0, moving_start), 0.0, frame, width=2 * SCALE)
    draw_span_panel_outline(draw, upper, lower, moving_start, 1.0, theta, theta, HINGE_X, 1.0, FLAP, 210, width=2 * SCALE, count=66)


def strengthen_aircraft_art(aircraft: Image.Image) -> Image.Image:
    alpha = aircraft.getchannel("A")
    darkness = aircraft.convert("L").point(lambda value: min(255, max(0, int((255 - value) * 2.6))))
    ink_mask = ImageChops.multiply(alpha, darkness)
    outline_alpha = ink_mask.filter(ImageFilter.MaxFilter(5)).point(lambda value: min(142, int(value * 0.9)))
    outline = Image.new("RGBA", aircraft.size, (0, 0, 0, 0))
    outline.putalpha(outline_alpha)

    ink_alpha = ink_mask.point(lambda value: min(210, int(value * 1.1)))
    ink = Image.new("RGBA", aircraft.size, (0, 0, 0, 0))
    ink.putalpha(ink_alpha)
    return Image.alpha_composite(outline, Image.alpha_composite(aircraft, ink))


def load_aircraft_art() -> Image.Image:
    global AIRCRAFT_ART_CACHE
    if AIRCRAFT_ART_CACHE is not None:
        return AIRCRAFT_ART_CACHE
    aircraft = Image.open(AIRCRAFT_ART).convert("RGBA")
    bbox = aircraft.getbbox()
    if not bbox:
        raise RuntimeError(f"Aircraft art is empty: {AIRCRAFT_ART}")
    aircraft = aircraft.crop(bbox)
    target_width = AIRCRAFT_SIZE[0] * SCALE
    target_height = AIRCRAFT_SIZE[1] * SCALE
    scale = min(target_width / aircraft.width, target_height / aircraft.height)
    size = (max(1, int(aircraft.width * scale)), max(1, int(aircraft.height * scale)))
    AIRCRAFT_ART_CACHE = strengthen_aircraft_art(aircraft.resize(size, Image.Resampling.LANCZOS))
    return AIRCRAFT_ART_CACHE


def aircraft_art_rect() -> tuple[float, float, float, float]:
    aircraft = load_aircraft_art()
    width = aircraft.width / SCALE
    height = aircraft.height / SCALE
    left = AIRCRAFT_CENTER[0] - 0.5 * width
    top = AIRCRAFT_CENTER[1] - 0.5 * height
    return left, top, width, height


def aircraft_wing_polygon() -> list[tuple[float, float]]:
    left, top, width, height = aircraft_art_rect()
    return [(left + nx * width, top + ny * height) for nx, ny in AIRCRAFT_SELECTED_WING]


def aircraft_wing_target() -> tuple[float, float]:
    polygon = aircraft_wing_polygon()
    return (
        sum(point[0] for point in polygon) / len(polygon),
        sum(point[1] for point in polygon) / len(polygon),
    )


def draw_aircraft(image: Image.Image, draw: ImageDraw.ImageDraw):
    aircraft = load_aircraft_art()
    left, top, _, _ = aircraft_art_rect()
    x = round(left * SCALE)
    y = round(top * SCALE)
    image.paste(aircraft, (x, y), aircraft)


def make_frame(upper, lower, frame: int, total: int) -> Image.Image:
    phase = 2 * math.pi * frame / total
    theta = math.radians(14) * math.sin(phase)

    image = Image.new("RGB", (WIDTH * SCALE, HEIGHT * SCALE), BG)
    draw = ImageDraw.Draw(image, "RGBA")

    draw_cycle_arrows(draw)
    draw_left_airfoil(draw, upper, lower, theta)
    draw_wing(draw, upper, lower, theta)
    draw_aircraft(image, draw)
    draw_time_icon(draw)

    return image.resize((WIDTH, HEIGHT), Image.Resampling.LANCZOS)


def main() -> None:
    upper, lower = naca_2412_surfaces()

    frames = []
    total = 84
    for idx in range(total):
        frame = make_frame(upper, lower, idx, total)
        frames.append(frame.convert("P", palette=Image.Palette.ADAPTIVE, colors=96))

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        OUTPUT,
        save_all=True,
        append_images=frames[1:],
        duration=46,
        loop=0,
        optimize=False,
        disposal=2,
    )
    print(OUTPUT)


if __name__ == "__main__":
    main()
