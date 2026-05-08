import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // spec §1.2 / §5.1: emitter has zero DOM dependencies; tests run in node env to
    // confirm no DOM symbols leak into the package surface (acceptance gate D-7).
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    typecheck: { enabled: false },
  },
});
