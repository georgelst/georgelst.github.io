from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HEADER = (ROOT / "partials" / "header.html").read_text(encoding="utf-8").strip()
FOOTER = (ROOT / "partials" / "footer.html").read_text(encoding="utf-8").strip()

ACTIVE_PAGES = [
    ROOT / "index.html",
    ROOT / "theory.html",
    ROOT / "tools.html",
    ROOT / "research.html",
    ROOT / "contact.html",
    ROOT / "source" / "analytical_aerodynamics.html",
    ROOT / "source" / "geometric_decomposition_tool.html",
    ROOT / "source" / "harmonic_oscillating_airfoils.html",
    ROOT / "source" / "timeline.html",
    ROOT / "source" / "unsteady_airfoil_simulator.html",
]

HEADER_START = "<!-- UNSAERO_HEADER_START -->"
HEADER_END = "<!-- UNSAERO_HEADER_END -->"
FOOTER_START = "<!-- UNSAERO_FOOTER_START -->"
FOOTER_END = "<!-- UNSAERO_FOOTER_END -->"
HEADER_SLOT = '<div id="unsaero-header"></div>'
FOOTER_SLOT = '<div id="unsaero-footer"></div>'


def replace_between(text: str, start: str, end: str, replacement: str) -> str:
    i = text.find(start)
    j = text.find(end)
    if i < 0 or j < 0 or j < i:
        return text
    j += len(end)
    return text[:i] + start + "\n" + replacement + "\n" + end + text[j:]


def ensure_footer_markers(text: str) -> str:
    if FOOTER_START in text and FOOTER_END in text:
        return text
    if FOOTER not in text:
        raise ValueError("Page has neither shared footer markers nor canonical footer markup")
    return text.replace(
        FOOTER,
        f"{FOOTER_START}\n{FOOTER_SLOT}\n{FOOTER_END}",
        1,
    )


def ensure_loader(text: str, root_prefix: str) -> str:
    if "assets/js/partials.js" in text:
        return text
    loader = (
        f'<script defer src="{root_prefix}assets/js/partials.js" '
        f'data-root="{root_prefix}"></script>'
    )
    return text.replace("</head>", f"  {loader}\n</head>", 1)


for page in ACTIVE_PAGES:
    depth = len(page.relative_to(ROOT).parent.parts)
    root_prefix = "../" * depth
    text = page.read_text(encoding="utf-8")
    text = ensure_footer_markers(text)
    text = replace_between(text, HEADER_START, HEADER_END, HEADER_SLOT)
    text = replace_between(text, FOOTER_START, FOOTER_END, FOOTER_SLOT)
    text = ensure_loader(text, root_prefix)
    page.write_text(text, encoding="utf-8")
    print(f"Updated {page.relative_to(ROOT)}")
