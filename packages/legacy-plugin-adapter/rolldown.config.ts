// spec §6.2: per-package build config template (rolldown + dts).
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
  // spec §1.2: zero Node built-ins; runs on browsers, Workers, Edge, Deno, Bun, Node.
  platform: 'neutral',
  treeshake: true,
  // @kindly-note/core is a peer; never bundle it into the adapter package.
  external: [/^@kindly-note\//],
  plugins: [dts()],
});
