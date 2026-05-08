import { defineConfig, mergeConfig } from 'vitest/config';
import { sharedTestConfig } from '../../vitest.shared.js';

// Per-package Vitest config — extends the workspace-level shared config so
// `@kindly-note/*` imports resolve to sibling packages' `src/index.ts` for
// tests (no `bun run build` precondition). spec §1.2.
//
// spec §5.1, §1.2: core has zero DOM dependencies; tests run in node env to
// confirm that no DOM symbols leak into the package surface.
export default mergeConfig(
  sharedTestConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
    },
  }),
);
