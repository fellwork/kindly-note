import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // spec §5.1, §1.2: core has zero DOM dependencies; tests run in node env to confirm
    // that no DOM symbols leak into the package surface.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    typecheck: { enabled: false },
  },
});
