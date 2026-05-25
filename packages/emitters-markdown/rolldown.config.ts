// spec §6.2: per-package build config template (rolldown + dts).
// spec §1.5 row `@kindly-note/emitters-markdown` + §13: a semantic-HTML emitter
// for the markdown token stream with security-first defaults. Depends on
// @kindly-note/core (peer) + @kindly-note/emitters-html (delegated for
// code-fence highlighting).
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
  // Every @kindly-note/* edge stays external — consumers de-dupe by import
  // resolution, no double-bundling.
  external: [/^@kindly-note\//],
  plugins: [dts()],
});
