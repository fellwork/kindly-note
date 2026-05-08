// Shared Vitest configuration for the kindly-note monorepo.
//
// This config solves the workspace src-resolution DX issue surfaced by cohort
// 3b's state file ("Workspace src-resolution is a real v0 DX issue."): Bun's
// workspace symlinks resolve `@kindly-note/*` via `package.json#main` →
// `dist/index.js`, which means tests for downstream packages fail until upstream
// builds run.
//
// The fix: an alias plugin that intercepts every `@kindly-note/<pkg>` import in
// test runs and resolves it to `packages/<pkg>/src/index.ts`. Build-time
// resolution (rolldown for production consumers) is unchanged.
//
// Per-package `vitest.config.ts` MUST extend this shared config via
// `mergeConfig(sharedConfig, defineConfig({ ... }))`.
//
// spec §0 architectural shifts #1 + #2: tests import language packages and
// helpers as values, not registrations; this alias preserves that property
// without an intermediate build step.

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const repoRoot = fileURLToPath(new URL('./', import.meta.url));

/**
 * Map every `@kindly-note/<pkg>` import to the package's `src/index.ts`. The
 * mapping is generated lazily by the alias-plugin loader; we keep the list
 * explicit so adding a package is a one-line update.
 */
const KINDLY_NOTE_PACKAGES: readonly string[] = [
  'core',
  'lang-helpers',
  'emitters-html',
  'lang-pack-ecmascript',
  'lang-json',
  'lang-javascript',
  'lang-typescript',
];

// Subpath aliases (e.g. `@kindly-note/core/regex` → `packages/core/src/regex.ts`)
// must resolve BEFORE the bare-package alias (Vite tries aliases in order).
// `@kindly-note/core` declares `./regex` and `./errors` subpath exports in
// `package.json#exports`; only these two are actively used today.
const subpathAliases = [
  {
    find: /^@kindly-note\/core\/regex$/,
    replacement: `${repoRoot}packages/core/src/regex.ts`,
  },
  {
    find: /^@kindly-note\/core\/errors$/,
    replacement: `${repoRoot}packages/core/src/errors.ts`,
  },
];

const bareAliases = KINDLY_NOTE_PACKAGES.map((pkg) => ({
  find: `@kindly-note/${pkg}`,
  replacement: `${repoRoot}packages/${pkg}/src/index.ts`,
}));

const aliases = [...subpathAliases, ...bareAliases];

export const sharedTestConfig = defineConfig({
  resolve: {
    alias: aliases,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    typecheck: { enabled: false },
  },
});

export default sharedTestConfig;
