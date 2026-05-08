import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // spec §1.2: lang-pack-ecmascript is a pure-data + factory package; no
    // DOM/Node dependencies. Tests run in node env.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    typecheck: { enabled: false },
  },
});
