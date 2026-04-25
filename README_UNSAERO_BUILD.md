# Shared header/footer workflow

Edit:

- `partials/header.html`
- `partials/footer.html`

Then regenerate every page with:

```bash
python scripts/build_partials.py
```

The final HTML files contain the header/footer directly, so they work on GitHub Pages and also when opened locally without a server.


## SEO and asset audit — 2026-04-24

- Root favicon replaced with `icon.png` from the new vortex mark.
- Additional favicon assets generated: `favicon.ico`, `assets/favicon-16x16.png`, `assets/favicon-32x32.png`, `assets/apple-touch-icon.png`, `assets/icon-192.png`, `assets/icon-512.png`.
- Page-specific titles, descriptions, canonical URLs, Open Graph tags, Twitter cards, and JSON-LD metadata added or normalized.
- `robots.txt` and `sitemap.xml` regenerated.
- Removed unused `test.txt`.
- Active sitemap excludes the hidden Timeline page for now, since it is not exposed in the current navigation.
