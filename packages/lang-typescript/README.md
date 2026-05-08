# @kindly-note/lang-typescript

TypeScript language definition for [kindly-note](../../README.md), built via
the typed `extendLanguage(javascript, ...)` keystone API — no mutation of the
parent JavaScript definition, no untyped `exports` field, no array `.push()`
into a frozen contains list. Decorators, generics, `interface`, `type`, and
`enum` are layered on top of `@kindly-note/lang-javascript` through
declarative, statically-typed transforms.

## Install

```sh
bun add @kindly-note/core @kindly-note/lang-typescript
# or
npm install @kindly-note/core @kindly-note/lang-typescript
```

`@kindly-note/lang-javascript`, `@kindly-note/lang-helpers`, and
`@kindly-note/lang-pack-ecmascript` are workspace peers and are pulled in
transitively.

## Usage

```ts
import { createHighlighter } from '@kindly-note/core';
import typescript from '@kindly-note/lang-typescript';

const hl = createHighlighter({ languages: [typescript] });

const result = hl.highlight(
  `interface User<T> {\n  readonly id: T;\n}\n` +
  `function greet(@injected user: User<string>) { return user.id; }`,
  { language: 'ts' }
);

console.log(result.value); // emitter-rendered output
```

The default export is a deep-frozen `LanguageDefinition` — registering it
twice is a no-op, and downstream code can rely on reference stability.

## Aliases

The language is registered under the following identifiers:

| Alias | Typical extension          |
|-------|----------------------------|
| `ts`  | `.ts`                      |
| `tsx` | `.tsx` (JSX-in-TypeScript) |
| `mts` | `.mts` (ESM TypeScript)    |
| `cts` | `.cts` (CommonJS TypeScript) |

Auto-detect uses `supersetOf: 'javascript'` so plain-JS snippets that score
equally under both languages resolve to JavaScript — register both packages
to opt in to that tie-breaker (see spec §1.2 / §10.2).

## Architecture note: the keystone

This package is THE KEYSTONE of the kindly-note architecture. Spec
[§0 architectural shift #5](../../docs/plan/architect-spec.md#0-architectural-shifts-from-highlightjs)
states that TypeScript inherits from JavaScript through a typed `extend()`
API, not through array-mutation of an untyped `exports` field. This package
proves that contract end-to-end.

The entire definition is built through one call to `extendLanguage`:

```ts
const typescript = extendLanguage(javascript, {
  name: 'TypeScript',
  aliases: ['ts', 'tsx', 'mts', 'cts'],
  supersetOf: 'javascript',
  extendKeywords: { keyword: TS_KEYWORDS, built_in: TS_TYPES },
  extendPoints: {
    PARAMS_CONTAINS: (current) => [...current, DECORATOR],
  },
  addContains: [DECORATOR, NAMESPACE, INTERFACE_MODE],
  replaceModes: [
    { label: 'shebang', with: shebang() },
    { label: 'use_strict', with: TS_USE_STRICT },
  ],
  transformLabeledMode: [
    { label: 'func.def', transform: (m) => ({ ...m, relevance: 0 }) },
  ],
});
```

Decorator support (`@injected`, `@Component`), generics, and the
`interface` / `type` / `enum` / `readonly` / `public` / `private` keywords
all come from the `extendKeywords`, `extendPoints`, and `addContains`
transforms above — `@kindly-note/lang-javascript` is never mutated. The
parent's `PARAMS_CONTAINS` is consumed as a frozen `current` argument and a
fresh array is returned. The `INTERFACE_MODE` reaches the parent's
`CLASS_REFERENCE` mode through the typed `javascript.extensible` surface,
not by indexing into the JS package's internal arrays.

What the keystone forbids — and this package does NOT do:

- `Object.assign(jsLang.keywords, …)` — upstream highlight.js's pattern, banned.
- `jsLang.contains.push(…)` — would throw at runtime; the parent is deep-frozen.
- `jsLang.exports.PARAMS_CONTAINS.push(…)` — the untyped `exports: any`
  field has been removed entirely (spec §8 Cat 5).

The 18 keystone tests in
[`tests/keystone.test.ts`](tests/keystone.test.ts) verify these properties:
parent reference equality before/after `extendLanguage`, runtime throws on
attempted mutation, and end-to-end tokenization of real-world TypeScript.
For the full rationale and worked code samples see
[architect-spec.md §8.2 — Cat 2 (THE KEYSTONE)](../../docs/plan/architect-spec.md#8-coupling-debt-resolution-table)
and §8.2.2.

## Status

v0. Default-exports a deep-frozen `LanguageDefinition`. Aliases `ts`, `tsx`,
`mts`, `cts` are stable. Tagged-template descent into HTML/CSS (via the
`starts` link) is not yet wired — see cohort 4 open question #2 in
[`docs/plan/build-manifest-c4.md`](../../docs/plan/build-manifest-c4.md).

## License

BSD-3-Clause. See [LICENSE](../../LICENSE).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
