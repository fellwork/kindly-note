import { defineConfig, mergeConfig } from 'vitest/config';
import { sharedTestConfig } from '../../vitest.shared.js';

// Per-package Vitest config — extends the workspace-level shared config so
// `@kindly-note/*` imports resolve to sibling packages' `src/index.ts` for
// tests (no `bun run build` precondition). spec §1.2.
//
// spec §1.2: auto-detect is a pure function over the registered language set;
// no DOM, no Node built-ins. Tests run in node env.
export default mergeConfig(
  sharedTestConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
    },
  }),
);
