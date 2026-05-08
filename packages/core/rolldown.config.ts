// spec §6.2: per-package build config template (rolldown + dts).
import { defineConfig } from 'rolldown';
import { dts } from 'rolldown-plugin-dts';

export default defineConfig({
  // Multi-entry: top-level package + the typed subpaths declared in package.json#exports
  // (spec §6.4). Each input becomes a separate `dist/<name>.{js,d.ts,js.map}` file.
  input: {
    index: 'src/index.ts',
    regex: 'src/regex.ts',
    errors: 'src/errors.ts',
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
  plugins: [dts()],
});
