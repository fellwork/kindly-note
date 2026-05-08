import { defineConfig, mergeConfig } from 'vitest/config';
import { sharedTestConfig } from '../../vitest.shared.js';

// Per-package Vitest config — extends the workspace-level shared config so
// `@kindly-note/*` imports resolve to sibling packages' `src/index.ts` for
// tests (no `bun run build` precondition). spec §1.2.
//
// spec §1.2: lang-javascript is a value-only language pack; no DOM/Node
// dependencies in the source. Tests run in node env.
export default mergeConfig(
  sharedTestConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
    },
  }),
);
