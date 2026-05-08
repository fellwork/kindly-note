// spec §6.2: per-package build config template (rolldown + dts).
// spec §1.2: lang-helpers exposes only the root entry; consumers tree-shake
// individual helpers via named imports.
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
  // @kindly-note/core is a types-only import (`import type ...`); after dts
  // erasure there is no runtime reference to it. We still mark it external
  // defensively — nothing changes if it stays a side-effect-free type-only edge.
  external: ['@kindly-note/core'],
  plugins: [dts()],
});
