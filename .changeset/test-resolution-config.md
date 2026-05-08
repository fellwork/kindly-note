---
'@kindly-note/core': patch
'@kindly-note/lang-helpers': patch
'@kindly-note/emitters-html': patch
'@kindly-note/lang-pack-ecmascript': patch
'@kindly-note/lang-json': patch
'@kindly-note/lang-javascript': patch
'@kindly-note/lang-typescript': patch
---

Workspace src-resolution config — DX fix.

Adds a root `vitest.shared.ts` that maps every `@kindly-note/*` import to the package's `packages/*/src/index.ts` for tests (plus the `core/regex` and `core/errors` subpath imports). Every per-package `vitest.config.ts` now extends the shared config via `mergeConfig`. Build-time resolution (rolldown for production consumers) is unchanged.

Resolves the cohort-3b state-file lesson "Workspace src-resolution is a real v0 DX issue." Before this change, tests for downstream packages (e.g. `lang-json` consuming `lang-pack-ecmascript`'s runtime `EXTENDED_NUMBER_MODE` export) failed until `bun run build` ran, because Bun's workspace symlinks resolve via `package.json#main` → `dist/index.js`. After this change, `bun run test` works on a fresh checkout without any prior build step.

Verified: deleting all `packages/*/dist/` directories and running `bun run test` from the repo root produces 235/235 passing tests across all 7 packages.
