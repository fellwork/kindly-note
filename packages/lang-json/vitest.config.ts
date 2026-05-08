import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // spec §1.2: lang-json is a value-only language pack; no DOM/Node
    // dependencies in the source. Tests run in node env.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    typecheck: { enabled: false },
  },
});
