import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // spec §1.2: lang-helpers has no DOM/Node dependencies; tests run in node env.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    typecheck: { enabled: false },
  },
});
