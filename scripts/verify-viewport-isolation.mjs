#!/usr/bin/env node
/**
 * verify-viewport-isolation.mjs
 *
 * Asserts that every CSS selector in packages/frontend/src/styles/viewport-iphone.css
 * begins with `html[data-viewport^="iphone"]` (or a more specific iphone variant).
 * Additionally fails on any occurrence of `!important` or `@media` inside the file.
 *
 * Exit 0 = clean. Exit 1 = violations printed with file:line.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(__dirname, '../packages/frontend/src/styles/viewport-iphone.css');

const REQUIRED_PREFIX = /^html\[data-viewport(\^=|=)"iphone/;
const BANNED_IMPORTANT = /!important/;
const BANNED_MEDIA = /@media/;

// A "selector line" is a line that contains `{` (start of a rule block)
// and is not a comment line and not a continuation of a multi-line comment.

function stripBlockComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, '');
}

async function main() {
  let text;
  try {
    text = await readFile(TARGET, 'utf8');
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.log(`[verify-viewport-isolation] ${TARGET} does not exist yet — skipping.`);
      process.exit(0);
    }
    throw err;
  }

  const errors = [];
  const stripped = stripBlockComments(text);
  const lines = stripped.split('\n');

  // Banned tokens anywhere in the file
  lines.forEach((line, i) => {
    if (BANNED_IMPORTANT.test(line)) {
      errors.push(`${TARGET}:${i + 1}: !important is banned in viewport-iphone.css`);
    }
    if (BANNED_MEDIA.test(line)) {
      errors.push(`${TARGET}:${i + 1}: @media is banned in viewport-iphone.css (use attribute scoping instead)`);
    }
  });

  // Collect selector lines. Walk lines accumulating selector text across
  // comma-continuations. A rule block opens when we encounter `{` anywhere
  // on the current accumulated content; we take everything before the first
  // `{` as the selector list. This handles both multi-line selectors
  // (continuation via trailing `,`) and single-line rules (e.g.
  // `.foo { color: red; }` on one line).
  let buf = '';
  let startLine = 0;
  lines.forEach((line, i) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('//')) return;

    if (buf === '') startLine = i + 1;
    buf += ' ' + trimmed;

    const braceIdx = buf.indexOf('{');
    if (braceIdx !== -1) {
      const selectorText = buf.slice(0, braceIdx).trim();
      // Split on commas (multi-selector rule)
      const selectors = selectorText.split(',').map((s) => s.trim()).filter(Boolean);
      selectors.forEach((sel) => {
        if (!REQUIRED_PREFIX.test(sel)) {
          errors.push(`${TARGET}:${startLine}: selector "${sel}" does not start with html[data-viewport^="iphone"…]`);
        }
      });
      buf = '';
    } else if (!trimmed.endsWith(',')) {
      // Line is a declaration or `}` with no open brace — reset buffer
      buf = '';
    }
  });

  if (errors.length > 0) {
    console.error('[verify-viewport-isolation] FAIL');
    errors.forEach((e) => console.error('  ' + e));
    process.exit(1);
  }

  console.log('[verify-viewport-isolation] OK — all selectors scoped to html[data-viewport^="iphone"]');
}

main().catch((err) => {
  console.error('[verify-viewport-isolation] unexpected error:', err);
  process.exit(2);
});
