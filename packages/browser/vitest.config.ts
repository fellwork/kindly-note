import { defineConfig, mergeConfig } from 'vitest/config';
import { sharedTestConfig } from '../../vitest.shared.js';

// Per-package Vitest config — extends the workspace-level shared config so
// `@kindly-note/*` imports resolve to sibling packages' `src/index.ts` for
// tests (no `bun run build` precondition). spec §1.2.
//
// spec §1.2 row `@kindly-note/browser`: this is the FIRST package whose
// runtime contract is "I drive a real DOM". Tests therefore run in a
// happy-dom environment (NOT 'node'), overriding the shared default.
// happy-dom is faster than jsdom for the small surface we exercise (a few
// `<pre><code>` elements + a MutationObserver). If a future test case needs
// behaviour happy-dom doesn't implement, fall back to jsdom and document why.
export default mergeConfig(
  sharedTestConfig,
  defineConfig({
    test: {
      environment: 'happy-dom',
      include: ['tests/**/*.test.ts'],
    },
  }),
);
