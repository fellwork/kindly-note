// spec §6.2: per-package build config template (rolldown + dts).
// spec §1.2 row `@kindly-note/loader-fetch`: depends on @kindly-note/core only.
// spec §4.2.3: Workers/Edge runtime — uses globalThis.fetch.
import { defineConfig } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';

export default defineConfig({
  input: {
    index: 'src/index.ts',
  },
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: true,
    entryFileNames: '[name].js',
  },
  // spec §1.2 / §4.2.3: zero Node built-ins; runs on Workers/Edge,
  // browsers, Deno, Bun. No `node:fetch`, no `node:fs` — the loader is
  // explicitly designed for environments where dynamic import() is
  // unavailable but globalThis.fetch is.
  platform: 'neutral',
  treeshake: true,
  external: [/^@kindly-note\//],
  plugins: [dts()],
});
