# @kindly-note/legacy-plugin-adapter

## 1.0.0

### Patch Changes

- Updated dependencies [2d654b6]
  - @kindly-note/core@0.2.0

## 0.1.0

### Minor Changes

- 749458d: Initial release of `@kindly-note/legacy-plugin-adapter`: wraps an upstream-shaped `HLJSPlugin` (six legacy `before:* / after:*` hooks) into a modern `@kindly-note/core` `Plugin`. Mutation semantics from upstream's `fire()` dispatch are preserved inside the adapter; the modern plugin protocol stays pure (per-phase tree-shaking, per-plugin error isolation). Worked example: `highlightjs-line-numbers.js` runs end-to-end via `adaptLegacyPlugin(lineNumbersLegacy)`. Spec §3.

### Patch Changes

- Updated dependencies [a864e29]
- Updated dependencies [167dfc9]
- Updated dependencies [c866f88]
- Updated dependencies [167dfc9]
  - @kindly-note/core@0.1.0
