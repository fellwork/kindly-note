---
'@kindly-note/lang-typescript': minor
---

Initial release of `@kindly-note/lang-typescript`: the TypeScript / TSX language definition. The default export is a deep-frozen `LanguageDefinition` produced via the typed `extendLanguage()` API on top of `@kindly-note/lang-javascript` (spec §0 architectural shift #5; spec §8.2 THE KEYSTONE; spec §8.2.2 worked example). Aliases: `ts`, `tsx`, `mts`, `cts`. **This package is the keystone end-to-end proof point**: TypeScript inherits from JavaScript through the typed `extend()` API — never through array-mutation of an `exports` field, never through reaching into the parent's internal `contains` array. The 18-test `keystone.test.ts` proves the parent is untouched, frozen-array runtime push throws, decorators are visible in TS but not in JS, TS-specific keywords (`interface`, `type`, etc.) are recognised, generics tokenize without illegal-syntax, and a 20-line real-world TS snippet renders with at least 5 distinct `kn-*` CSS classes.
