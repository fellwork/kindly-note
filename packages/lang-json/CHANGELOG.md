# @kindly-note/lang-json

## 0.1.1

### Patch Changes

- Updated dependencies [2d654b6]
  - @kindly-note/core@0.2.0
  - @kindly-note/lang-helpers@0.1.1
  - @kindly-note/lang-pack-ecmascript@0.1.1

## 0.1.0

### Minor Changes

- 1366dc3: Initial release of `@kindly-note/lang-json`: the JSON / JSONC / JSON5 language definition. The default export is a deep-frozen `LanguageDefinition` (spec §0 architectural shift #1 — languages-as-values). Aliases: `json`, `jsonc`, `json5`. First real `@kindly-note/lang-*` package — exercises the cohort-3a deepened matcher end-to-end.

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
