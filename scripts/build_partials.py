from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HEADER = (ROOT / "partials" / "header.html").read_text(encoding="utf-8")
FOOTER = (ROOT / "partials" / "footer.html").read_text(encoding="utf-8")
PAGES = [
    ROOT / "index.html",
    ROOT / "theory.html",
    ROOT / "tools.html",
    ROOT / "research.html",
    ROOT / "contact.html",
    ROOT / "source" / "timeline.html",
    ROOT / "source" / "analytical_aerodynamics.html",
    ROOT / "source" / "geometric_decomposition_tool.html",
    ROOT / "source" / "airfoil_surface_tool.html",
]

def replace_between(text, start, end, replacement):
    i = text.find(start)
    j = text.find(end)
    if i < 0 or j < 0 or j < i:
        return text
    j += len(end)
    return text[:i] + start + "\n" + replacement + "\n" + end + text[j:]

for page in PAGES:
    rel = "../" if page.parent.name == "source" else ""
    text = page.read_text(encoding="utf-8")
    text = replace_between(text, "<!-- UNSAERO_HEADER_START -->", "<!-- UNSAERO_HEADER_END -->", HEADER.replace("{{ROOT}}", rel))
    text = replace_between(text, "<!-- UNSAERO_FOOTER_START -->", "<!-- UNSAERO_FOOTER_END -->", FOOTER)
    page.write_text(text, encoding="utf-8")
    print(f"Updated {page.relative_to(ROOT)}")
