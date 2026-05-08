---
'@kindly-note/core': minor
---

Matcher and `extendLanguage` enhancements required by the cohort-4 keystone (spec §8.2):

1. **`variants` expansion at compile time** (spec §9.4 / cohort-3a open question #6). Mirrors upstream `expandOrCloneMode`: a Mode with `variants: [...]` is replaced by N sibling modes, each merged with the parent fields. lang-javascript uses this for `CLASS_OR_EXTENDS` (with-extends vs without) and `FUNCTION_DEFINITION` (named vs anonymous).

2. **Per-capture-group `beginScope` emit** (spec §8.2.1 / cohort-3a open question #4). When `match` (or `begin`) is an array AND `scope` (or `beginScope`) is a `ScopeMap`, the matcher emits each numbered capture group with its own scope. Mirrors upstream `emitMultiClass`. lang-javascript's class-declaration mode (`match: [/class/, /\s+/, IDENT_RE, ...]`) is the canonical use.

3. **Cycle resolution in `compileLanguage`** (spec §9.1). lang-javascript's SUBST ↔ TEMPLATE_STRING mutual recursion required a per-call memoisation map keyed on Mode reference. Same Mode reference compiles to the same CompiledMode within one call; cyclic references resolve to the placeholder.

4. **Ref-substitution in `extendLanguage`** (spec §8.2). The fundamental keystone fix: when `extendPoints.PARAMS_CONTAINS: (current) => [...current, DECORATOR]` produces a new array, every Mode in the parent's contains-tree that references the OLD array gets its `contains` field rewritten to point at the NEW array. Without this, the JS PARAMS Mode in TS's contains would still see the parent's pre-extension PARAMS_CONTAINS, and decorators inside function parameter lists would be invisible. The walk uses a WeakMap-based memo that handles cycles.

These four enhancements together make the typed `extendLanguage()` API a real architectural alternative to upstream's array-mutation pattern. The 18-test `keystone.test.ts` in `@kindly-note/lang-typescript` validates them end-to-end.
