// Copy static assets (CSS files + tokens.json) from `styles/` and `src/` to
// `dist/` so the package's `exports` map resolves consistently from `./dist/`.
//
// `tsc -b` already emits `dist/index.js` + `dist/index.d.ts` from `src/`,
// but it does NOT copy non-TS assets. This script fills that gap. Run via
// `bun run build:assets`.
//
// Why a script instead of `cp -r`: kindly-note targets Windows + Unix; bun
// gives us a portable filesystem API.

import { copyFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(here, '..');
const stylesDir = join(pkgRoot, 'styles');
const srcDir = join(pkgRoot, 'src');
const distDir = join(pkgRoot, 'dist');

async function copyDir(from: string, to: string, ext: string): Promise<number> {
  await mkdir(to, { recursive: true });
  const entries = await readdir(from, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith(ext)) {
      await copyFile(join(from, entry.name), join(to, entry.name));
      count += 1;
    }
  }
  return count;
}

const cssCount = await copyDir(stylesDir, distDir, '.css');
const jsonCount = await copyDir(srcDir, distDir, '.json');

console.log(
  `[themes-default] copy-assets: ${cssCount} CSS file(s) + ${jsonCount} JSON file(s) → dist/`,
);
