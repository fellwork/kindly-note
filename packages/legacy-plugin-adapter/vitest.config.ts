import { defineConfig, mergeConfig } from 'vitest/config';
import { sharedTestConfig } from '../../vitest.shared.js';

// Per-package Vitest config — extends the workspace-level shared config so
// `@kindly-note/*` imports resolve to sibling packages' `src/index.ts` for
// tests (no `bun run build` precondition). spec §1.2.
//
// spec §3 (legacy-plugin adapter design): the adapter is DOM-type-aware via
// `Element` from `lib.dom`, but does not depend on any DOM at runtime — all
// element handling is by reference passthrough. Tests run in `node` env to
// confirm no DOM symbols leak into the package surface.
export default mergeConfig(
  sharedTestConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['tests/**/*.test.ts'],
    },
  }),
);
