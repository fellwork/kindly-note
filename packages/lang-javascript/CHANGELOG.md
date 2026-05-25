# @kindly-note/lang-javascript

## 0.1.0

### Minor Changes

- 167dfc9: Initial release of `@kindly-note/lang-javascript`: the JavaScript / JSX / MJS / CJS language definition. The default export is a deep-frozen `LanguageDefinition<JavaScriptExtensionPoints>` (spec §0 architectural shift #1 — languages-as-values; spec §8.2.1 worked example). Aliases: `js`, `jsx`, `mjs`, `cjs`. Publishes a typed `extensible: { PARAMS_CONTAINS, CLASS_REFERENCE }` surface for downstream extenders (TypeScript, CoffeeScript, etc.) — the parent half of the keystone API (spec §8.2 THE KEYSTONE).

### Patch Changes

- 167dfc9: Workspace src-resolution config — DX fix.

  Adds a root `vitest.shared.ts` that maps every `@kindly-note/*` import to the package's `packages/*/src/index.ts` for tests (plus the `core/regex` and `core/errors` subpath imports). Every per-package `vitest.config.ts` now extends the shared config via `mergeConfig`. Build-time resolution (rolldown for production consumers) is unchanged.

  Resolves the cohort-3b state-file lesson "Workspace src-resolution is a real v0 DX issue." Before this change, tests for downstream packages (e.g. `lang-json` consuming `lang-pack-ecmascript`'s runtime `EXTENDED_NUMBER_MODE` export) failed until `bun run build` ran, because Bun's workspace symlinks resolve via `package.json#main` → `dist/index.js`. After this change, `bun run test` works on a fresh checkout without any prior build step.

  Verified: deleting all `packages/*/dist/` directories and running `bun run test` from the repo root produces 235/235 passing tests across all 7 packages.

- Updated dependencies [a864e29]
- Updated dependencies [167dfc9]
- Updated dependencies [1d1632c]
- Updated dependencies [1366dc3]
- Updated dependencies [c866f88]
- Updated dependencies [167dfc9]
  - @kindly-note/core@0.1.0
  - @kindly-note/lang-helpers@0.1.0
  - @kindly-note/lang-pack-ecmascript@0.1.0
