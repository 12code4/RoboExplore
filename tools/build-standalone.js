/* RoboExplore — build a single self-contained HTML file.
 * Reads index.html and inlines the stylesheet and every classic <script src>
 * (in the exact declared order) into one portable roboexplore.html that runs by
 * double-clicking — no build step, no server, no external files.
 *
 *   node tools/build-standalone.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'roboexplore.html');

let html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

// Inline the stylesheet(s).
html = html.replace(/[ \t]*<link[^>]*href="([^"]+\.css)"[^>]*>\s*/g, (m, href) => {
  const css = fs.readFileSync(path.join(ROOT, href), 'utf8').trimEnd();
  return '  <style>\n' + css + '\n  </style>\n';
});

// Inline each classic script in declared order. Escape any literal </script>
// inside source (defensive) so the inlined block can't terminate early.
let bytes = 0, count = 0;
html = html.replace(/[ \t]*<script src="([^"]+\.js)"><\/script>\s*/g, (m, src) => {
  const js = fs.readFileSync(path.join(ROOT, src), 'utf8').replace(/<\/script>/gi, '<\\/script>');
  bytes += js.length; count++;
  return '  <script>\n/* ==== ' + src + ' ==== */\n' + js.trimEnd() + '\n  </script>\n';
});

// Drop the dev-only rotate hint stays; nothing else external remains.
fs.writeFileSync(OUT, html);

const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
// Sanity: no remaining external local references.
const leftover = (html.match(/(?:src|href)="(?!https?:|data:|#)[^"]+"/g) || []);
console.log(`✓ built roboexplore.html — ${count} scripts inlined, ${kb} KB total`);
if (leftover.length) console.warn('  ⚠ remaining external refs:', leftover);
else console.log('  no external file references remain — fully standalone');
