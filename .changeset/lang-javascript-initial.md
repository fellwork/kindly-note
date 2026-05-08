---
'@kindly-note/lang-javascript': minor
---

Initial release of `@kindly-note/lang-javascript`: the JavaScript / JSX / MJS / CJS language definition. The default export is a deep-frozen `LanguageDefinition<JavaScriptExtensionPoints>` (spec §0 architectural shift #1 — languages-as-values; spec §8.2.1 worked example). Aliases: `js`, `jsx`, `mjs`, `cjs`. Publishes a typed `extensible: { PARAMS_CONTAINS, CLASS_REFERENCE }` surface for downstream extenders (TypeScript, CoffeeScript, etc.) — the parent half of the keystone API (spec §8.2 THE KEYSTONE).
