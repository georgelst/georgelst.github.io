const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
const header = fs.readFileSync(path.join(root, 'partials', 'header.html'), 'utf8');
const footer = fs.readFileSync(path.join(root, 'partials', 'footer.html'), 'utf8');
const pages = [
  'index.html', 'theory.html', 'tools.html', 'research.html', 'contact.html',
  'source/timeline.html', 'source/analytical_aerodynamics.html', 'source/geometric_decomposition_tool.html', 'source/airfoil_surface_tool.html'
];
function replaceBetween(text, start, end, replacement) {
  const i = text.indexOf(start);
  const j0 = text.indexOf(end);
  if (i < 0 || j0 < 0 || j0 < i) return text;
  const j = j0 + end.length;
  return text.slice(0, i) + start + '\n' + replacement + '\n' + end + text.slice(j);
}
for (const p of pages) {
  const full = path.join(root, p);
  const rel = p.startsWith('source/') ? '../' : '';
  let text = fs.readFileSync(full, 'utf8');
  text = replaceBetween(text, '<!-- UNSAERO_HEADER_START -->', '<!-- UNSAERO_HEADER_END -->', header.replaceAll('{{ROOT}}', rel));
  text = replaceBetween(text, '<!-- UNSAERO_FOOTER_START -->', '<!-- UNSAERO_FOOTER_END -->', footer);
  fs.writeFileSync(full, text, 'utf8');
  console.log('Updated ' + p);
}
