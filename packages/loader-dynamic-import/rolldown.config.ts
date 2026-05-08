// spec §6.2: per-package build config template (rolldown + dts).
// spec §1.2 row `@kindly-note/loader-dynamic-import`: depends on
// @kindly-note/core only.
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
  // spec §1.2 / §4.2.2: zero Node built-ins; the loader uses native dynamic
  // import() and runs on every runtime that supports it (Node, modern
  // browsers, Deno, Bun).
  platform: 'neutral',
  treeshake: true,
  external: [/^@kindly-note\//],
  plugins: [dts()],
});
