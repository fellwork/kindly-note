// spec §6.2: per-package build config template (rolldown + dts).
// spec §1.2 row `@kindly-note/browser`: depends on @kindly-note/core; takes
// @kindly-note/auto-detect as a peer-optional. Both stay external.
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
  // spec §1.2: zero Node built-ins; the package itself is DOM-bound, but the
  // bundle target is platform-neutral so consumer bundlers (esbuild, Vite,
  // rolldown) can tree-shake the whole package away on Workers/Edge.
  platform: 'neutral',
  treeshake: true,
  // Every @kindly-note/* edge stays external — consumers de-dupe by import
  // resolution, no double-bundling.
  external: [/^@kindly-note\//],
  plugins: [dts()],
});
