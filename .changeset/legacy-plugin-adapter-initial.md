---
'@kindly-note/legacy-plugin-adapter': minor
---

Initial release of `@kindly-note/legacy-plugin-adapter`: wraps an upstream-shaped `HLJSPlugin` (six legacy `before:* / after:*` hooks) into a modern `@kindly-note/core` `Plugin`. Mutation semantics from upstream's `fire()` dispatch are preserved inside the adapter; the modern plugin protocol stays pure (per-phase tree-shaking, per-plugin error isolation). Worked example: `highlightjs-line-numbers.js` runs end-to-end via `adaptLegacyPlugin(lineNumbersLegacy)`. Spec §3.
