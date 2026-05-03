#!/usr/bin/env node
/**
 * build.mjs — Bundle modular source into standalone HTML
 *
 * Usage:  node build.mjs [output.html]
 *         Default output: ../CouplesCardGame-v3.html
 *
 * Takes the ES module source under src/ and produces a single
 * self-contained HTML file with all JS inlined.
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname);

// ── Dependency order (topological: leaf → root) ──────────────
const MODULES = [
  'src/game/card.js',
  'src/game/deck.js',
  'src/game/rules.js',
  'src/game/state.js',
  'src/ai/easyBot.js',
  'src/ai/normalBot.js',
  'src/ai/V3-search.js',
  'src/ai/V3-high.js',
  'src/ai/V4.js',
  'src/ai/bot.js',
  'src/ui/adapter.js',
];

// ── Bundler ──────────────────────────────────────────────────

/** Strip import lines and export declarations from source code */
function stripImportsExports(code) {
  // 1. Remove multi-line export { ... } blocks
  code = code.replace(/export\s*\{[\s\S]*?\};/g, '');

  // 2. Remove single-line export { name };
  code = code.replace(/export\s*\{[^}]*\};\s*/g, '');

  // 3. Remove import lines (including multi-line imports)
  code = code.replace(/import\s*\{[\s\S]*?\}\s*from\s*['"][^'"]+['"]\s*;\s*/g, '');
  code = code.replace(/import\s+[^'"]+\s+from\s*['"][^'"]+['"]\s*;\s*/g, '');
  code = code.replace(/^\s*import\s+['"][^'"]+['"]\s*;\s*/gm, '');

  // 4. Remove standalone export keyword before function / const / let / var
  code = code.replace(/\bexport\s+(default\s+)?(function|const|let|var|class)\s+/g, '$2 ');

  return code;
}

/** Gather all source JS content in order */
function bundleJS() {
  let result = '// ════════════════════════════════════════════════════\n';
  result += '// 扑克牌对战 — 独立捆绑包\n';
  result += `// Built: ${new Date().toISOString().slice(0, 19).replace('T', ' ')}\n`;
  result += '// ════════════════════════════════════════════════════\n\n';

  for (const relPath of MODULES) {
    const fullPath = resolve(ROOT, relPath);
    let code = readFileSync(fullPath, 'utf-8');
    code = stripImportsExports(code);
    code = code.trim();

    result += `// ── ${relPath} ──────────────────────────────────────\n\n`;
    result += code;
    result += '\n\n';
  }

  return result;
}

function build() {
  const js = bundleJS();

  // Read HTML template
  const htmlPath = resolve(ROOT, 'src/ui/index.html');
  let html = readFileSync(htmlPath, 'utf-8');

  // Replace the module script tag with inline script
  const scriptTag = '<script type="module" src="adapter.js"></script>';
  const inlineScript = `<script>\n${js}\n</script>`;

  if (!html.includes(scriptTag)) {
    console.error('ERROR: expected <script type="module" src="adapter.js"> in src/ui/index.html');
    process.exit(1);
  }

  html = html.replace(scriptTag, inlineScript);

  // Write output
  const outputPath = resolve(ROOT, process.argv[2] || 'CouplesCardGame-v3.html');
  writeFileSync(outputPath, html, 'utf-8');
  console.log(`✅ Built: ${outputPath}`);
  const kb = (Buffer.byteLength(html, 'utf-8') / 1024).toFixed(1);
  console.log(`   Size:  ${kb} KB`);
}

build();
