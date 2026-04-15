#!/usr/bin/env node
/**
 * verify-viewport-isolation.test.mjs
 *
 * Self-test harness for scripts/verify-viewport-isolation.mjs.
 *
 * For each fixture:
 *  - create a temp root via mkdtemp
 *  - mirror the repo layout the real lint expects:
 *      <root>/scripts/verify-viewport-isolation.mjs   (copy of real script)
 *      <root>/packages/frontend/src/styles/viewport-iphone.css  (optional)
 *  - spawnSync a fresh node child against the copied script
 *  - compare exit status against expected
 *
 * The copy (vs. symlink) approach ensures __dirname math inside the script
 * resolves to the temp root so only the temp fixture CSS file is seen.
 *
 * Zero dependencies — node built-ins only.
 */

import { mkdtemp, mkdir, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REAL_SCRIPT = resolve(__dirname, 'verify-viewport-isolation.mjs');

const FIXTURES = [
  {
    name: 'PASS - valid scoped selector',
    css: 'html[data-viewport^="iphone"] .foo { color: red; }\n',
    expectCode: 0,
  },
  {
    name: 'PASS - exact-match variant',
    css: 'html[data-viewport="iphone-portrait"] .bar { padding: 4px; }\n',
    expectCode: 0,
  },
  {
    name: 'PASS - file missing (skip)',
    css: null,
    expectCode: 0,
  },
  {
    name: 'FAIL - unscoped selector',
    css: '.foo { color: red; }\n',
    expectCode: 1,
  },
  {
    name: 'FAIL - !important ban',
    css: 'html[data-viewport^="iphone"] .foo { color: red !important; }\n',
    expectCode: 1,
  },
  {
    name: 'FAIL - @media ban',
    css: '@media (max-width: 500px) { html[data-viewport^="iphone"] .foo { color: red; } }\n',
    expectCode: 1,
  },
];

async function runFixture(fixture) {
  const root = await mkdtemp(join(tmpdir(), 'verify-viewport-isolation-'));
  try {
    // Mirror repo layout
    const scriptsDir = join(root, 'scripts');
    const stylesDir = join(root, 'packages', 'frontend', 'src', 'styles');
    await mkdir(scriptsDir, { recursive: true });
    await mkdir(stylesDir, { recursive: true });

    // Copy real script into temp root so __dirname/.. math points at temp root
    const tempScript = join(scriptsDir, 'verify-viewport-isolation.mjs');
    await copyFile(REAL_SCRIPT, tempScript);

    // Write (or omit) fixture CSS
    if (fixture.css !== null) {
      await writeFile(join(stylesDir, 'viewport-iphone.css'), fixture.css, 'utf8');
    }

    // Spawn a fresh node process against the copied script
    const result = spawnSync(process.execPath, [tempScript], {
      encoding: 'utf8',
    });

    const actualCode = result.status;
    const ok = actualCode === fixture.expectCode;
    return {
      ok,
      name: fixture.name,
      expected: fixture.expectCode,
      actual: actualCode,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function main() {
  const results = [];
  for (const fixture of FIXTURES) {
    // If the real script doesn't exist, copyFile will throw — surface that as a clear failure.
    let res;
    try {
      res = await runFixture(fixture);
    } catch (err) {
      res = {
        ok: false,
        name: fixture.name,
        expected: fixture.expectCode,
        actual: `error: ${err.message}`,
        stdout: '',
        stderr: '',
      };
    }
    results.push(res);
    if (res.ok) {
      console.log(`ok - ${res.name}`);
    } else {
      console.error(`FAIL - ${res.name}`);
      console.error(`  expected exit ${res.expected}, got ${res.actual}`);
      if (res.stdout) console.error(`  stdout: ${res.stdout.trim()}`);
      if (res.stderr) console.error(`  stderr: ${res.stderr.trim()}`);
    }
  }

  const failed = results.filter((r) => !r.ok).length;
  if (failed > 0) {
    console.error(`\n${failed}/${results.length} fixtures FAILED`);
    process.exit(1);
  }
  console.log(`\nAll ${results.length} fixtures passed`);
}

main().catch((err) => {
  console.error('[verify-viewport-isolation.test] unexpected error:', err);
  process.exit(1);
});
