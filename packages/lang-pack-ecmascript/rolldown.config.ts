// spec §6.2: per-package build config template (rolldown + dts).
// spec §1.2 row `@kindly-note/lang-pack-ecmascript`: a flat-named-export shared
// pack consumed by every ECMAScript-family `@kindly-note/lang-*` package.
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
  // @kindly-note/core is a types-only edge; @kindly-note/lang-helpers is a value
  // edge but always external (the consumer language pack imports it directly
  // too, so de-duping by reference is the right outcome).
  external: [/^@kindly-note\//],
  plugins: [dts()],
});
